require("dotenv").config();

const express = require("express");
const path = require("path");
const { createAiListingRouter } = require("./server/ai-listing/aiListingRoutes");
const { createListingRouter } = require("./server/listings/listingRoutes");
const { createPartSearchRouter } = require("./server/part-search/partSearchRoutes");

const app = express();
const PORT = process.env.PORT || 3000;
const publicDir = path.join(__dirname, "public");

app.use(express.json({ limit: "8mb" }));
app.use(express.static(publicDir));
app.use("/api", createAiListingRouter());
app.use("/api", createPartSearchRouter());
app.use("/api", createListingRouter());

app.use((req, res) => {
  res.status(404).type("text/plain").send("Not found");
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
