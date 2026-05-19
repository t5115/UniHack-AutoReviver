const OpenAI = require("openai");
const { buildPartSearchPrompt } = require("./searchPrompt");

const DEFAULT_MODEL = "gpt-5.1";
const MAX_AI_CANDIDATES = 30;

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

const getPrefilteredCandidates = (listings, searchInput) => {
  const scoredListings = listings
    .map((listing) => scoreListingHeuristically(listing, searchInput))
    .sort((a, b) => b.matchRating - a.matchRating || new Date(b.postedAt) - new Date(a.postedAt));

  const hasSearchText = Object.values(searchInput).some(Boolean);
  if (!hasSearchText) return scoredListings.slice(0, MAX_AI_CANDIDATES);

  const likelyMatches = scoredListings.filter((listing) => listing.matchRating > 0);
  return (likelyMatches.length ? likelyMatches : scoredListings).slice(0, MAX_AI_CANDIDATES);
};

const mergeAiMatches = ({ listings, searchInput, aiResult }) => {
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
      return aiMatch ? { ...listing, ...aiMatch } : { ...listing, matchRating: 0, matchReason: "Not selected as a strong AI match." };
    })
    .filter((listing) => listing.matchRating > 0)
    .sort((a, b) => b.matchRating - a.matchRating || new Date(b.postedAt) - new Date(a.postedAt))
    .map((listing) => ({
      ...listing,
      searchIntent: aiResult?.search_intent || null,
    }));
};

const rankListingsWithAi = async ({ searchInput, listings, imageBuffer, mimeType }) => {
  const apiKey = process.env.OPENAI_API_KEY;
  const candidates = getPrefilteredCandidates(listings, searchInput);

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
  });
  const content = [{ type: "input_text", text: prompt }];

  if (imageBuffer && mimeType) {
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
      listings: mergeAiMatches({ listings: candidates, searchInput, aiResult }),
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
