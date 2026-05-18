const express = require("express");
const multer = require("multer");
const { analyzePartImage } = require("./openaiPartAnalyzer");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, callback) => {
    if (file.mimetype && file.mimetype.startsWith("image/")) {
      callback(null, true);
      return;
    }

    callback(new Error("Only image uploads are supported"));
  },
});

const createAiListingRouter = () => {
  const router = express.Router();

  router.post("/analyze-part", upload.single("image"), async (req, res) => {
    if (!req.file) {
      res.status(400).json({ success: false, error: "No image provided" });
      return;
    }

    try {
      const data = await analyzePartImage({
        imageBuffer: req.file.buffer,
        mimeType: req.file.mimetype,
        partDescription: req.body.part_description || "",
        partNumber: req.body.part_number || "",
        donorReg: req.body.donor_reg || "",
        vehicleMake: req.body.vehicle_make || "",
        vehicleModel: req.body.vehicle_model || "",
        vin: req.body.vin || "",
        colour: req.body.colour || "",
        engineSize: req.body.engine_size || "",
        location: req.body.location || "",
      });

      res.json({ success: true, data });
    } catch (error) {
      console.error("AI listing analysis error:", error.message);
      res.status(500).json({
        success: false,
        error: "AI analysis failed",
        details: error.message,
      });
    }
  });

  router.use((error, req, res, next) => {
    if (!error) {
      next();
      return;
    }

    const status = error instanceof multer.MulterError ? 400 : 415;
    res.status(status).json({
      success: false,
      error: error.message,
    });
  });

  return router;
};

module.exports = {
  createAiListingRouter,
};
