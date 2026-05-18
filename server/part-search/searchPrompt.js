const buildPartSearchPrompt = ({ searchInput = {}, candidates = [] } = {}) => `You are matching a buyer's car-part search against current used-part listings on a UK marketplace.
Use the buyer's written search details as the highest priority. Use the uploaded image only to fill gaps or clarify the visible part. If the image conflicts with written fields, trust the written fields.

Return only a valid JSON object with no extra text.
Be strict about part type and side. A right headlight should not score highly against a left tail light. Vehicle make, model, year, part number, colour, engine size, and location improve the score when present, but do not invent missing values.
Use match_rating from 0 to 100:
- 90-100: same part and strong vehicle/side/part-number compatibility
- 70-89: likely useful match with minor missing details
- 45-69: plausible but important details are missing or uncertain
- 1-44: weak match
- 0: not a match

Buyer search details:
${JSON.stringify(searchInput, null, 2)}

Current listing candidates:
${JSON.stringify(candidates, null, 2)}

{
  "search_intent": {
    "part_type": "part type or null",
    "make": "make or null",
    "model": "model or null",
    "year": "year or year range or null",
    "side": "left, right, front, rear, or null",
    "part_number": "part number or null",
    "colour": "colour or null",
    "engine_size": "engine size or null",
    "location": "location or null",
    "summary": "short buyer-facing summary of what was searched"
  },
  "matches": [
    {
      "id": "listing id exactly as provided",
      "match_rating": 86,
      "reason": "short reason for the rating"
    }
  ]
}`;

module.exports = {
  buildPartSearchPrompt,
};
