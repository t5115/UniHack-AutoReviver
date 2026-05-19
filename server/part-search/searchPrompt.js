const buildPartSearchPrompt = ({ searchInput = {}, candidates = [], hasImage = false } = {}) => `You are matching a buyer's car-part search against current used-part listings on a UK used car parts marketplace.
Use the buyer's written search details and uploaded image together. Written vehicle details, side, part number, make, model, year, colour, engine size, and location are high priority. When the written text is vague, describes a fault/damage/missing item, or uses casual wording, use the image to identify the actual target part.
If the uploaded image shows a whole vehicle area, such as the full front of a car, and the written text does not ask for one specific part, treat it as a broad visual search. In broad visual searches, do not focus on only one small part. Identify and rank multiple clearly visible relevant listings such as headlights, fog lights, grille, bumper, bonnet, or trims when candidates exist.

Return only a valid JSON object with no extra text.
Be strict about actual part type and side. A right headlight should not score highly against a left tail light. Vehicle make, model, year, part number, colour, engine size, and location improve the score when present, but do not invent missing values.
Interpret problem phrases such as "missing cover", "broken clip", "cracked lens", "needs cap", or "lost trim" as buyer context, not always the part type. For example, if the image shows a fog light area and the text says "missing cover", consider fog light cover, fog light trim, fog light bezel, fog light grille, or a complete fog light assembly as related matches depending on the candidate listing.
Match useful substitutes when appropriate: a complete assembly can be a useful match for a missing cover/trim query, but rate an exact cover/trim/bezel higher than a whole assembly. Do not match unrelated covers from different areas of the vehicle.
Never treat headlights, tail lights, indicators, or generic lamps as matches for a fog light, fog light cover, fog light trim, fog light grille, or fog light bezel query. Shared vehicle make/model is not enough when the visible/requested part family is different.
For broad visual searches, this wrong-family rule only applies between unrelated areas. A front-of-car image can reasonably return both headlights and fog-light/fog-cover listings, each scored according to how clearly that part is visible and how well the vehicle data matches.
If an uploaded image is present, use visible clues from the image to infer the target part and vehicle area, but do not invent make/model/year/side unless supported by text, candidate data, or clear visible evidence.
Set search_intent.part_focus to "specific" when the buyer clearly asks for one part or the image is a close-up of one part. Set it to "broad" when the image shows a larger vehicle area with multiple sellable parts and the text does not narrow the search to one part.
Use match_rating from 0 to 100:
- 90-100: same part and strong vehicle/side/part-number compatibility
- 70-89: likely useful match or a very close substitute with minor missing details
- 45-69: plausible substitute but important details are missing or uncertain
- 1-44: weak match
- 0: not a match
Return only listings worth showing to a buyer. If the part family is wrong, use 0 and omit it from matches.

Uploaded image provided: ${hasImage ? "yes" : "no"}

Buyer search details:
${JSON.stringify(searchInput)}

Current listing candidates:
${JSON.stringify(candidates)}

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
    "part_focus": "specific or broad",
    "visible_part_types": ["clear visible part types from the image, or empty array"],
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
