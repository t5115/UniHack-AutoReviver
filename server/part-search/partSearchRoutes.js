const express = require("express");
const multer = require("multer");
const { listListings } = require("../listings/listingDb");
const { buildSearchInput, rankListingsWithAi } = require("./partSearchAnalyzer");

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

const createPartSearchRouter = () => {
  const router = express.Router();

  router.post("/search-listings", upload.single("image"), async (req, res) => {
    try {
      const searchInput = buildSearchInput(req.body || {});
      const hasSearchInput = Object.values(searchInput).some(Boolean);

      if (!hasSearchInput && !req.file) {
        res.json({
          success: true,
          data: {
            query: searchInput,
            searchIntent: null,
            listings: listListings().map((listing) => ({
              ...listing,
              matchRating: null,
              matchReason: "Add search details or a photo to get an AI match rating.",
            })),
            usedAi: false,
          },
        });
        return;
      }

      const rankedResults = await rankListingsWithAi({
        searchInput,
        listings: listListings(),
        imageBuffer: req.file?.buffer,
        mimeType: req.file?.mimetype,
      });

      res.json({
        success: true,
        data: {
          query: searchInput,
          ...rankedResults,
        },
      });
    } catch (error) {
      console.error("AI part search error:", error.message);
      res.status(500).json({
        success: false,
        error: "Part search failed",
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
  createPartSearchRouter,
};
