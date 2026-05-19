const express = require("express");
const { createListing, getListingById, listListings } = require("./listingDb");

const createListingRouter = () => {
  const router = express.Router();

  router.get("/listings", (req, res) => {
    res.json({
      success: true,
      data: listListings(),
    });
  });

  router.get("/listings/:id", (req, res) => {
    const listing = getListingById(req.params.id);

    if (!listing) {
      res.status(404).json({
        success: false,
        error: "Listing not found",
      });
      return;
    }

    res.json({
      success: true,
      data: listing,
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
