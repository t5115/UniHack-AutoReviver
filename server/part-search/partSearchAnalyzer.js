const OpenAI = require("openai");
const { buildPartSearchPrompt } = require("./searchPrompt");

const DEFAULT_MODEL = "gpt-5.1";
const MAX_AI_CANDIDATES = 45;
const IMAGE_SEARCH_EXPLORATION_CANDIDATES = 18;

const extractJsonObject = (text) => {
  const cleanedText = String(text || "")
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(cleanedText);
  } catch {
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not parse AI response as JSON");
    }

    return JSON.parse(jsonMatch[0]);
  }
};

const toText = (value) => String(value || "").trim();
const normaliseText = (value) => toText(value).toLowerCase();
const clampRating = (value) => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));

const tokenize = (value) =>
  normaliseText(value)
    .replace(/[^a-z0-9.\s-]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 2);

const partText = (...values) => normaliseText(values.filter(Boolean).join(" "));

const getPartFamily = (...values) => {
  const text = partText(...values);

  if (!text) return null;
  if (/\bfog\b/.test(text) && /\b(covers?|trims?|bezels?|grilles?|grills?|surrounds?|blanks?)\b/.test(text)) return "fog_light_cover";
  if (/\bfog\b/.test(text) && /\b(lights?|lamps?)\b/.test(text)) return "fog_light";
  if (/\b(headlights?|headlamps?|head lights?)\b/.test(text)) return "headlight";
  if (/\b(tail lights?|taillights?|rear lights?|tail lamps?|taillamps?)\b/.test(text)) return "tail_light";
  if (/\b(indicators?|turn signals?|side repeaters?)\b/.test(text)) return "indicator";
  if (/\bbrake\b/.test(text) && /\b(disc|discs|rotor|rotors)\b/.test(text)) return "brake_disc";
  if (/\b(covers?|trims?|bezels?|grilles?|grills?|surrounds?|blanks?)\b/.test(text)) return "cover_trim";

  return null;
};

const getSearchPartFamily = ({ searchInput = {}, aiResult = {} } = {}) =>
  getPartFamily(
    aiResult?.search_intent?.part_type,
    aiResult?.search_intent?.summary,
    searchInput.part_description,
    searchInput.part
  );

const getWrittenPartFamily = (searchInput = {}) => getPartFamily(searchInput.part_description, searchInput.part);

const getVisiblePartFamilies = (aiResult = {}) => {
  const visiblePartTypes = Array.isArray(aiResult?.search_intent?.visible_part_types)
    ? aiResult.search_intent.visible_part_types
    : [];
  const families = visiblePartTypes.map((partType) => getPartFamily(partType)).filter(Boolean);

  return [...new Set(families)];
};

const isBroadVisualSearch = ({ searchInput = {}, aiResult = {}, hasImage = false } = {}) => {
  if (!hasImage || getWrittenPartFamily(searchInput)) return false;

  const partFocus = normaliseText(aiResult?.search_intent?.part_focus);
  const visibleFamilies = getVisiblePartFamilies(aiResult);

  return partFocus === "broad" || visibleFamilies.length > 1;
};

const getEffectiveSearchFamily = ({ searchInput = {}, aiResult = {}, hasImage = false } = {}) => {
  if (isBroadVisualSearch({ searchInput, aiResult, hasImage })) return null;

  return getSearchPartFamily({ searchInput, aiResult });
};

const getListingPartFamily = (listing = {}) =>
  getPartFamily(listing.partType, listing.part_type, listing.title, listing.category);

const arePartFamiliesCompatible = (searchFamily, listingFamily) => {
  if (!searchFamily || !listingFamily) return true;
  if (searchFamily === listingFamily) return true;

  const compatibleFamilies = {
    fog_light_cover: new Set(["fog_light"]),
    fog_light: new Set(["fog_light_cover"]),
    cover_trim: new Set(["fog_light_cover"]),
  };

  return compatibleFamilies[searchFamily]?.has(listingFamily) || false;
};

const capSubstituteRating = (rating, searchFamily, listingFamily) => {
  if (!searchFamily || !listingFamily || searchFamily === listingFamily) return rating;

  if (searchFamily === "fog_light_cover" && listingFamily === "fog_light") {
    return Math.min(rating, 74);
  }

  if (searchFamily === "fog_light" && listingFamily === "fog_light_cover") {
    return Math.min(rating, 64);
  }

  return rating;
};

const textMatchesWhenPresent = (expected, actual) => {
  const expectedText = normaliseText(expected);
  const actualText = normaliseText(actual);

  return !expectedText || !actualText || expectedText.includes(actualText) || actualText.includes(expectedText);
};

const listingMatchesIntentVehicle = (listing = {}, intent = {}) =>
  textMatchesWhenPresent(intent.make, listing.make) && textMatchesWhenPresent(intent.model, listing.model);

const getBroadSupplementalRating = (listing, aiResult) => {
  const intent = aiResult?.search_intent || {};
  const hasVehicleMatch = Boolean(
    (intent.make && normaliseText(listing.make).includes(normaliseText(intent.make))) ||
      (intent.model && normaliseText(listing.model).includes(normaliseText(intent.model)))
  );

  return hasVehicleMatch ? 58 : 42;
};

const compactListing = (listing) => ({
  id: listing.id,
  title: listing.title,
  part_type: listing.partType,
  category: listing.category,
  make: listing.make,
  model: listing.model,
  year: listing.year,
  side: listing.side,
  condition: listing.condition,
  part_number: listing.partNumber,
  colour: listing.colour,
  engine_size: listing.engineSize,
  location: listing.location,
});

const buildSearchInput = (input = {}) => ({
  part_description: toText(input.part || input.part_description),
  plate: toText(input.plate),
  make: toText(input.brand || input.make),
  model: toText(input.model),
  part_number: toText(input.partNumber || input.part_number),
  vin: toText(input.vin),
  colour: toText(input.colour || input.color),
  engine_size: toText(input.engineSize || input.engine_size || input["engine-size"]),
  location: toText(input.location),
  condition: toText(input.condition),
});

const listingText = (listing) =>
  normaliseText(
    [
      listing.title,
      listing.partType,
      listing.category,
      listing.make,
      listing.model,
      listing.year,
      listing.side,
      listing.condition,
      listing.partNumber,
      listing.colour,
      listing.engineSize,
      listing.location,
    ].join(" ")
  );

const scoreListingHeuristically = (listing, searchInput) => {
  const text = listingText(listing);
  const tokens = tokenize(Object.values(searchInput).join(" "));
  let score = 0;
  const reasons = [];

  tokens.forEach((token) => {
    if (text.includes(token)) score += 4;
  });

  [
    ["part_number", "partNumber", 38, "part number"],
    ["make", "make", 14, "make"],
    ["model", "model", 14, "model"],
    ["colour", "colour", 7, "colour"],
    ["engine_size", "engineSize", 7, "engine"],
    ["location", "location", 5, "location"],
    ["condition", "condition", 5, "condition"],
  ].forEach(([inputKey, listingKey, weight, label]) => {
    const inputValue = normaliseText(searchInput[inputKey]);
    const listingValue = normaliseText(listing[listingKey]);

    if (!inputValue) return;
    if (listingValue && (listingValue.includes(inputValue) || inputValue.includes(listingValue))) {
      score += weight;
      reasons.push(label);
    } else if (["part_number", "make", "model"].includes(inputKey)) {
      score -= Math.round(weight * 0.75);
    }
  });

  const descriptionTokens = tokenize(searchInput.part_description);
  const partSignals = [listing.partType, listing.category, listing.title].map(normaliseText).filter(Boolean);
  if (descriptionTokens.some((token) => partSignals.some((signal) => signal.includes(token)))) {
    score += 24;
    reasons.push("part type");
  }

  return {
    ...listing,
    matchRating: clampRating(score),
    matchReason: reasons.length ? `Matched ${[...new Set(reasons)].join(", ")}.` : "Ranked from text overlap.",
  };
};

const getPrefilteredCandidates = (listings, searchInput, { hasImage = false } = {}) => {
  const scoredListings = listings
    .map((listing) => scoreListingHeuristically(listing, searchInput))
    .sort((a, b) => b.matchRating - a.matchRating || new Date(b.postedAt) - new Date(a.postedAt));

  const hasSearchText = Object.values(searchInput).some(Boolean);
  if (!hasSearchText) return scoredListings.slice(0, MAX_AI_CANDIDATES);

  if (hasImage) {
    const strongTextMatches = scoredListings.filter((listing) => listing.matchRating > 0);
    const exploratoryMatches = scoredListings
      .filter((listing) => listing.matchRating <= 0)
      .sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt))
      .slice(0, IMAGE_SEARCH_EXPLORATION_CANDIDATES);
    const candidatesById = new Map();

    [...strongTextMatches, ...exploratoryMatches, ...scoredListings].forEach((listing) => {
      if (candidatesById.size < MAX_AI_CANDIDATES && !candidatesById.has(listing.id)) {
        candidatesById.set(listing.id, listing);
      }
    });

    return [...candidatesById.values()];
  }

  const likelyMatches = scoredListings.filter((listing) => listing.matchRating > 0);
  return (likelyMatches.length ? likelyMatches : scoredListings).slice(0, MAX_AI_CANDIDATES);
};

const mergeAiMatches = ({ listings, searchInput, aiResult, hasImage = false }) => {
  const searchFamily = getEffectiveSearchFamily({ searchInput, aiResult, hasImage });
  const broadVisualSearch = isBroadVisualSearch({ searchInput, aiResult, hasImage });
  const visibleFamilies = getVisiblePartFamilies(aiResult);
  const matchesById = new Map(
    (Array.isArray(aiResult?.matches) ? aiResult.matches : []).map((match) => [
      String(match.id),
      {
        matchRating: clampRating(match.match_rating ?? match.matchRating),
        matchReason: toText(match.reason) || "AI ranked this as a possible match.",
      },
    ])
  );

  return listings
    .map((listing) => {
      const aiMatch = matchesById.get(String(listing.id));
      const listingFamily = getListingPartFamily(listing);

      if (!aiMatch) {
        if (
          broadVisualSearch &&
          visibleFamilies.includes(listingFamily) &&
          listingMatchesIntentVehicle(listing, aiResult?.search_intent)
        ) {
          return {
            ...listing,
            matchRating: getBroadSupplementalRating(listing, aiResult),
            matchReason: "Included because this part type is clearly visible in the uploaded vehicle photo.",
          };
        }

        return { ...listing, matchRating: 0, matchReason: "Not selected as a strong AI match." };
      }

      if (!arePartFamiliesCompatible(searchFamily, listingFamily)) {
        return {
          ...listing,
          matchRating: 0,
          matchReason: `Filtered out because ${listing.partType || listing.category || "this listing"} is not the requested part family.`,
        };
      }

      const matchRating = capSubstituteRating(aiMatch.matchRating, searchFamily, listingFamily);
      const substituteReason =
        matchRating < aiMatch.matchRating
          ? " Exact part type was not available, so this substitute was capped below an exact match."
          : "";

      return {
        ...listing,
        ...aiMatch,
        matchRating,
        matchReason: `${aiMatch.matchReason}${substituteReason}`,
      };
    })
    .filter((listing) => listing.matchRating >= 35)
    .sort((a, b) => b.matchRating - a.matchRating || new Date(b.postedAt) - new Date(a.postedAt))
    .map((listing) => ({
      ...listing,
      searchIntent: aiResult?.search_intent || null,
    }));
};

const rankListingsWithAi = async ({ searchInput, listings, imageBuffer, mimeType }) => {
  const apiKey = process.env.OPENAI_API_KEY;
  const hasImage = Boolean(imageBuffer && mimeType);
  const candidates = getPrefilteredCandidates(listings, searchInput, { hasImage });

  if (!candidates.length) {
    return {
      searchIntent: null,
      listings: [],
      usedAi: false,
    };
  }

  if (!apiKey) {
    return {
      searchIntent: null,
      listings: candidates.filter((listing) => listing.matchRating > 0),
      usedAi: false,
    };
  }

  const client = new OpenAI({ apiKey });
  const prompt = buildPartSearchPrompt({
    searchInput,
    candidates: candidates.map(compactListing),
    hasImage,
  });
  const content = [{ type: "input_text", text: prompt }];

  if (hasImage) {
    content.push({
      type: "input_image",
      image_url: `data:${mimeType};base64,${imageBuffer.toString("base64")}`,
      detail: process.env.OPENAI_IMAGE_DETAIL || "auto",
    });
  }

  try {
    const response = await client.responses.create({
      model: process.env.OPENAI_SEARCH_MODEL || process.env.OPENAI_MODEL || DEFAULT_MODEL,
      input: [
        {
          role: "user",
          content,
        },
      ],
      text: {
        format: { type: "json_object" },
      },
    });
    const aiResult = extractJsonObject(response.output_text);

    return {
      searchIntent: aiResult.search_intent || null,
      listings: mergeAiMatches({ listings: candidates, searchInput, aiResult, hasImage }),
      usedAi: true,
    };
  } catch (error) {
    console.warn("AI ranking unavailable, using heuristic search:", error.message);
    return {
      searchIntent: null,
      listings: candidates.filter((listing) => listing.matchRating > 0),
      usedAi: false,
    };
  }
};

module.exports = {
  buildSearchInput,
  rankListingsWithAi,
};
