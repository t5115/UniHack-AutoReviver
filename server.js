require("dotenv").config();
const express = require("express");
const multer = require("multer");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/analyze-part", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No image provided" });
  }

  const imageBase64 = req.file.buffer.toString("base64");
  const mediaType = req.file.mimetype;
  const partNumber = req.body.part_number || "";
  const donorReg = req.body.donor_reg || "";

  const prompt = `You are an expert automotive parts identifier for a UK used car parts marketplace.
Analyze this image of a car part.
${partNumber ? `Seller provided part number: ${partNumber}` : ""}
${donorReg ? `Donor vehicle registration: ${donorReg}` : ""}

Return ONLY a valid JSON object with no extra text:
{
  "part_type": "e.g. headlight, alternator, wing mirror, bumper",
  "part_category": "e.g. lighting, electrical, bodywork, engine",
  "part_number": "any part number or OEM stamp visible in image, or null",
  "side": "left, right, or null if not applicable",
  "condition": "excellent, good, fair, or poor",
  "condition_notes": "specific observations about condition (scratches, cracks, missing tabs etc)",
  "title": "professional UK marketplace listing title e.g. Ford Fiesta Mk7 Right Headlight 2013-2017 Halogen OEM",
  "description": "2-3 sentence professional listing description mentioning condition, fitment, and any important notes for buyers",
  "suggested_vehicles": [
    { "make": "Ford", "model": "Fiesta", "year_from": 2013, "year_to": 2017 }
  ],
  "confidence": 85
}`;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent([
      prompt,
      { inlineData: { mimeType: mediaType, data: imageBase64 } },
    ]);

    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ error: "Could not parse AI response" });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    res.json({ success: true, data: parsed });
  } catch (error) {
    console.error("AI analysis error:", error.message);
    res.status(500).json({ error: "AI analysis failed", details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`AutoReviver running at http://localhost:${PORT}`);
});
