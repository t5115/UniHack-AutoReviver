const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const { demoListings } = require("./demoListings");

const dataDir = path.join(__dirname, "..", "..", "data");
const dbPath = path.join(dataDir, "autoreviver.sqlite");

fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(dbPath);

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    part_type TEXT,
    category TEXT,
    make TEXT,
    model TEXT,
    year TEXT,
    side TEXT,
    condition TEXT,
    part_number TEXT,
    colour TEXT,
    engine_size TEXT,
    location TEXT,
    confidence INTEGER,
    image_url TEXT,
    seed_key TEXT UNIQUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

const ensureSeedKeyColumn = () => {
  const columns = db.prepare("PRAGMA table_info(listings)").all();
  const hasSeedKey = columns.some((column) => column.name === "seed_key");

  if (!hasSeedKey) {
    db.exec("ALTER TABLE listings ADD COLUMN seed_key TEXT");
  }

  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS listings_seed_key_unique ON listings(seed_key) WHERE seed_key IS NOT NULL");
};

ensureSeedKeyColumn();

const toNullableString = (value) => {
  if (value === null || value === undefined) return null;

  const text = String(value).trim();
  return text || null;
};

const normaliseListingInput = (listing = {}) => ({
  title: toNullableString(listing.title),
  part_type: toNullableString(listing.part_type || listing.partType),
  category: toNullableString(listing.category || listing.part_category),
  make: toNullableString(listing.make),
  model: toNullableString(listing.model),
  year: toNullableString(listing.year),
  side: toNullableString(listing.side),
  condition: toNullableString(listing.condition),
  part_number: toNullableString(listing.part_number || listing.partNumber),
  colour: toNullableString(listing.colour || listing.color),
  engine_size: toNullableString(listing.engine_size || listing.engineSize),
  location: toNullableString(listing.location),
  confidence: Number.isFinite(Number(listing.confidence)) ? Math.round(Number(listing.confidence)) : null,
  image_url: toNullableString(listing.image_url || listing.imageUrl),
  seed_key: toNullableString(listing.seed_key || listing.seedKey),
});

const mapListingRow = (row) => ({
  id: String(row.id),
  title: row.title,
  partType: row.part_type,
  category: row.category,
  make: row.make,
  model: row.model,
  year: row.year,
  side: row.side,
  condition: row.condition,
  partNumber: row.part_number,
  colour: row.colour,
  engineSize: row.engine_size,
  location: row.location,
  confidence: row.confidence,
  imageUrl: row.image_url,
  seedKey: row.seed_key,
  postedAt: row.created_at,
});

const createListing = (input) => {
  const listing = normaliseListingInput(input);

  if (!listing.title) {
    const error = new Error("Listing title is required");
    error.status = 400;
    throw error;
  }

  const result = db
    .prepare(
      `
      INSERT INTO listings (
        title,
        part_type,
        category,
        make,
        model,
        year,
        side,
        condition,
        part_number,
        colour,
        engine_size,
        location,
        confidence,
        image_url,
        seed_key
      ) VALUES (
        @title,
        @part_type,
        @category,
        @make,
        @model,
        @year,
        @side,
        @condition,
        @part_number,
        @colour,
        @engine_size,
        @location,
        @confidence,
        @image_url,
        @seed_key
      )
    `
    )
    .run(listing);

  return getListingById(result.lastInsertRowid);
};

const getListingById = (id) => {
  const row = db.prepare("SELECT * FROM listings WHERE id = ?").get(id);
  return row ? mapListingRow(row) : null;
};

const listListings = () =>
  db
    .prepare("SELECT * FROM listings ORDER BY datetime(created_at) DESC, id DESC")
    .all()
    .map(mapListingRow);

const seedDemoListings = () => {
  const insertListing = db.prepare(`
    INSERT INTO listings (
      title,
      part_type,
      category,
      make,
      model,
      year,
      side,
      condition,
      part_number,
      colour,
      engine_size,
      location,
      confidence,
      image_url,
      seed_key
    ) VALUES (
      @title,
      @part_type,
      @category,
      @make,
      @model,
      @year,
      @side,
      @condition,
      @part_number,
      @colour,
      @engine_size,
      @location,
      @confidence,
      @image_url,
      @seed_key
    )
  `);

  const updateListing = db.prepare(`
    UPDATE listings
    SET
      title = @title,
      part_type = @part_type,
      category = @category,
      make = @make,
      model = @model,
      year = @year,
      side = @side,
      condition = @condition,
      part_number = @part_number,
      colour = @colour,
      engine_size = @engine_size,
      location = @location,
      confidence = @confidence,
      image_url = @image_url
    WHERE seed_key = @seed_key
  `);

  const findSeededListing = db.prepare("SELECT id FROM listings WHERE seed_key = ?");
  const saveSeededListing = db.transaction((listings) => {
    listings.forEach((demoListing) => {
      const listing = normaliseListingInput(demoListing);

      if (findSeededListing.get(listing.seed_key)) {
        updateListing.run(listing);
        return;
      }

      insertListing.run(listing);
    });
  });

  saveSeededListing(demoListings);
};

seedDemoListings();

module.exports = {
  createListing,
  getListingById,
  listListings,
};
