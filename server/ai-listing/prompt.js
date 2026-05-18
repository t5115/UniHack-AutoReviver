const buildPartListingPrompt = ({
  partDescription = "",
  partNumber = "",
  donorReg = "",
  vehicleMake = "",
  vehicleModel = "",
  vin = "",
  colour = "",
  engineSize = "",
  location = "",
} = {}) => `You are an expert automotive parts identifier for a UK used car parts marketplace.
Analyze this image and identify every visible car part that could reasonably become its own used-parts listing.
${partDescription ? `Seller provided description: ${partDescription}` : ""}
${partNumber ? `Seller provided part number: ${partNumber}` : ""}
${donorReg ? `Donor vehicle registration: ${donorReg}` : ""}
${vehicleMake ? `Vehicle make: ${vehicleMake}` : ""}
${vehicleModel ? `Vehicle model: ${vehicleModel}` : ""}
${vin ? `VIN: ${vin}` : ""}
${colour ? `Vehicle or part colour: ${colour}` : ""}
${engineSize ? `Engine size: ${engineSize}` : ""}
${location ? `Seller location: ${location}` : ""}

Return only a valid JSON object with no extra text.
Find all obvious and plausible sellable parts in the photo, not just the main one. Include separate rows for distinct parts such as headlights, mirrors, bumpers, wings, doors, wheels, grilles, trim pieces, lamps, alternators, engine parts, interior controls, and panels when visible.
Do not include price, notes, explanations, markdown, or prose outside the JSON.
Do not invent make, model, year, side, or part number. Use seller-provided details only when they fit what is visible. Use null when uncertain.
For each detected part, include a bounding_box when you can localise it in the image. Use percentage coordinates relative to the full image: x and y are the top-left corner, width and height are the box size, all from 0 to 100. Keep the box tight around the visible part, with a little context. Use null if the part cannot be localised.
Keep titles concise and marketplace-ready. A good title format is: Make Model year/range side part type key variant.
Use UK terms such as bonnet, boot lid, wing, number plate light, nearside/offside only if you are confident. Otherwise use left/right/front/rear.

{
  "listing_draft": {
    "title": "best title for the first/highest-confidence detected part",
    "make": "vehicle make or null",
    "model": "vehicle model or null",
    "year": "single year or year range e.g. 2013-2017, or null",
    "condition": "seller-facing condition e.g. Used, good - light marks",
    "part_number": "visible OEM/part number or seller provided part number, or null",
    "category": "listing category e.g. lighting, bodywork, electrical, engine",
    "location": "seller location if provided, otherwise null"
  },
  "detected_parts": [
    {
      "title": "specific selectable part title",
      "part_type": "e.g. headlight, alternator, wing mirror, bumper",
      "part_category": "e.g. lighting, electrical, bodywork, engine",
      "make": "vehicle make or null",
      "model": "vehicle model or null",
      "year": "single year or range, or null",
      "side": "left, right, front, rear, or null",
      "condition": "seller-facing condition",
      "part_number": "visible OEM/part number or null",
      "location": "seller location if provided, otherwise null",
      "bounding_box": { "x": 12, "y": 18, "width": 34, "height": 22 },
      "confidence": 85
    }
  ],
  "part_type": "e.g. headlight, alternator, wing mirror, bumper",
  "part_category": "e.g. lighting, electrical, bodywork, engine",
  "part_number": "any part number or OEM stamp visible in image, or null",
  "side": "left, right, or null if not applicable",
  "condition": "excellent, good, fair, or poor",
  "title": "professional UK marketplace listing title e.g. Ford Fiesta Mk7 Right Headlight 2013-2017 Halogen OEM",
  "suggested_vehicles": [
    { "make": "Ford", "model": "Fiesta", "year_from": 2013, "year_to": 2017 }
  ],
  "confidence": 85
}`;

module.exports = {
  buildPartListingPrompt,
};
