const OpenAI = require("openai");
const { buildPartListingPrompt } = require("./prompt");

const DEFAULT_MODEL = "gpt-5.1";
const MIN_CLEAR_PART_CONFIDENCE = 70;

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

const clampConfidence = (value) => Math.max(0, Math.min(100, Number(value) || 0));

const clampPercentage = (value) => Math.max(0, Math.min(100, Number(value)));

const normaliseBoundingBox = (box) => {
  if (!box || typeof box !== "object") return null;

  const x = clampPercentage(box.x ?? box.left);
  const y = clampPercentage(box.y ?? box.top);
  const width = clampPercentage(box.width ?? box.w);
  const height = clampPercentage(box.height ?? box.h);
  const clippedWidth = Math.min(width, 100 - x);
  const clippedHeight = Math.min(height, 100 - y);

  if (![x, y, clippedWidth, clippedHeight].every(Number.isFinite) || clippedWidth <= 0 || clippedHeight <= 0) {
    return null;
  }

  return {
    x,
    y,
    width: clippedWidth,
    height: clippedHeight,
  };
};

const normalisePart = (part = {}) => ({
  title: part.title || part.part_type || null,
  part_type: part.part_type || null,
  part_category: part.part_category || part.category || null,
  make: part.make || null,
  model: part.model || null,
  year: part.year || part.year_range || null,
  side: part.side || null,
  condition: part.condition || null,
  part_number: part.part_number || null,
  location: part.location || null,
  bounding_box: normaliseBoundingBox(part.bounding_box || part.bbox || part.box),
  confidence: clampConfidence(part.confidence),
});

const normalisePartName = (value) => String(value || "").trim().toLowerCase();

const isSpecificPartName = (value) => {
  const name = normalisePartName(value);
  if (!name) return false;

  return !["part", "car part", "vehicle part", "unknown", "unknown part", "automotive part"].includes(name);
};

const isClearDetectedPart = (part) =>
  Boolean(part) &&
  part.confidence >= MIN_CLEAR_PART_CONFIDENCE &&
  (isSpecificPartName(part.part_type) || isSpecificPartName(part.title));

const normaliseAnalysis = (analysis) => {
  const listingDraft = analysis.listing_draft || {};
  const legacyDraft = {
    title: analysis.title,
    make: analysis.make,
    model: analysis.model,
    year: analysis.year,
    condition: analysis.condition,
    part_number: analysis.part_number,
    category: analysis.part_category,
    location: analysis.location,
  };
  const detectedParts = Array.isArray(analysis.detected_parts)
    ? analysis.detected_parts.map(normalisePart).filter(isClearDetectedPart)
    : [];
  const legacyPart = normalisePart({ ...legacyDraft, ...analysis });
  const fallbackParts = detectedParts.length ? detectedParts : isClearDetectedPart(legacyPart) ? [legacyPart] : [];
  const primaryPart = fallbackParts[0] || {};
  const hasClearPart = fallbackParts.length > 0;

  return {
    listing_draft: {
      title: hasClearPart ? listingDraft.title || primaryPart.title || legacyDraft.title || null : null,
      make: hasClearPart ? listingDraft.make || legacyDraft.make || null : null,
      model: hasClearPart ? listingDraft.model || legacyDraft.model || null : null,
      year: hasClearPart ? listingDraft.year || legacyDraft.year || null : null,
      condition: hasClearPart ? listingDraft.condition || legacyDraft.condition || null : null,
      part_number: hasClearPart ? listingDraft.part_number || legacyDraft.part_number || null : null,
      category: hasClearPart ? listingDraft.category || legacyDraft.category || null : null,
      location: listingDraft.location || legacyDraft.location || null,
    },
    detected_parts: fallbackParts,
    part_type: hasClearPart ? analysis.part_type || primaryPart.part_type || null : null,
    part_category: hasClearPart ? analysis.part_category || listingDraft.category || primaryPart.part_category || null : null,
    part_number: hasClearPart ? analysis.part_number || listingDraft.part_number || primaryPart.part_number || null : null,
    side: hasClearPart ? analysis.side || primaryPart.side || null : null,
    condition: hasClearPart ? analysis.condition || listingDraft.condition || primaryPart.condition || null : null,
    title: hasClearPart ? analysis.title || listingDraft.title || primaryPart.title || null : null,
    suggested_vehicles: Array.isArray(analysis.suggested_vehicles) ? analysis.suggested_vehicles : [],
    confidence: hasClearPart ? clampConfidence(analysis.confidence || primaryPart.confidence) : 0,
  };
};

const analyzePartImage = async ({
  imageBuffer,
  mimeType,
  partDescription,
  partNumber,
  donorReg,
  vehicleMake,
  vehicleModel,
  vin,
  colour,
  engineSize,
  location,
}) => {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const client = new OpenAI({ apiKey });
  const prompt = buildPartListingPrompt({
    partDescription,
    partNumber,
    donorReg,
    vehicleMake,
    vehicleModel,
    vin,
    colour,
    engineSize,
    location,
  });

  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          {
            type: "input_image",
            image_url: `data:${mimeType};base64,${imageBuffer.toString("base64")}`,
            detail: process.env.OPENAI_IMAGE_DETAIL || "auto",
          },
        ],
      },
    ],
    text: {
      format: { type: "json_object" },
    },
  });

  return normaliseAnalysis(extractJsonObject(response.output_text));
};

module.exports = {
  analyzePartImage,
};
