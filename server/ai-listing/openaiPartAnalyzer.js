const OpenAI = require("openai");
const { buildPartListingPrompt } = require("./prompt");

const DEFAULT_MODEL = "gpt-5.1";

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
  const detectedParts = Array.isArray(analysis.detected_parts) ? analysis.detected_parts.map(normalisePart) : [];

  return {
    listing_draft: {
      title: listingDraft.title || legacyDraft.title || null,
      make: listingDraft.make || legacyDraft.make || null,
      model: listingDraft.model || legacyDraft.model || null,
      year: listingDraft.year || legacyDraft.year || null,
      condition: listingDraft.condition || legacyDraft.condition || null,
      part_number: listingDraft.part_number || legacyDraft.part_number || null,
      category: listingDraft.category || legacyDraft.category || null,
      location: listingDraft.location || legacyDraft.location || null,
    },
    detected_parts: detectedParts.length ? detectedParts : [normalisePart({ ...legacyDraft, ...analysis })],
    part_type: analysis.part_type || detectedParts[0]?.part_type || null,
    part_category: analysis.part_category || listingDraft.category || detectedParts[0]?.part_category || null,
    part_number: analysis.part_number || listingDraft.part_number || detectedParts[0]?.part_number || null,
    side: analysis.side || detectedParts[0]?.side || null,
    condition: analysis.condition || listingDraft.condition || detectedParts[0]?.condition || null,
    title: analysis.title || listingDraft.title || detectedParts[0]?.title || null,
    suggested_vehicles: Array.isArray(analysis.suggested_vehicles) ? analysis.suggested_vehicles : [],
    confidence: clampConfidence(analysis.confidence || detectedParts[0]?.confidence),
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
            detail: "low",
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
