const express = require("express");
const { createListing, listListings } = require("./listingDb");

const createListingRouter = () => {
  const router = express.Router();

  router.get("/listings", (req, res) => {
    res.json({
      success: true,
      data: listListings(),
    });
  });

  router.post("/listings", (req, res) => {
    try {
      const listing = createListing(req.body || {});
      res.status(201).json({
        success: true,
        data: listing,
      });
    } catch (error) {
      res.status(error.status || 500).json({
        success: false,
        error: error.message || "Could not save listing",
      });
    }
  });

  return router;
};

module.exports = {
  createListingRouter,
};
