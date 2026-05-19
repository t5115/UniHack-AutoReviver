# Auto Reviver
Auto Reviver is a hackathon project for making the used car parts marketplace faster, easier, and more efficient for both individual sellers and parts companies.

The idea is simple: instead of manually writing every listing, identifying every part, and searching through listings one by one, Auto Reviver uses AI-assisted image analysis and matching to help users list and find used vehicle parts with less friction.

## What It Does

### List Parts Faster

Sellers can upload a photo of a car part or a group of parts. The AI analyses the image and attempts to identify sellable parts such as headlights, bumpers, mirrors, panels, trim, lamps, wheels, and other visible components.

For each detected part, Auto Reviver helps generate marketplace-ready listing data including:

- Part title
- Part type and category
- Vehicle make/model/year when available
- Side/position when confident
- Condition
- Part number when visible or supplied
- Image crop/bounding box for the detected part

The listing flow also includes a discoverability review, which scores the listing and suggests improvements so posts are easier for buyers to find.

### Search For Parts

Buyers can search using text fields, part details, vehicle information, part numbers, location, or an uploaded image.

Auto Reviver gathers available listing data from the local SQLite database, prefilters the most likely candidates, then uses AI to rank the best matches based on the buyer's search intent.

### View Listings And Check Fitment

When a buyer opens a listing, the frontend includes a vehicle compatibility check area where they can enter a registration or VIN and simulate an availability/fitment check.

The original plan was to build a larger vehicle parts database and generate a "part DNA" profile for stronger compatibility matching. Due to hackathon time constraints, the frontend for this flow is in place as a simulation, with demo data used to show the intended experience.

## Tech Stack

- Node.js
- Express
- SQLite with `better-sqlite3`
- Vanilla HTML, CSS, and JavaScript
- OpenAI API for image understanding and listing/search assistance
- `multer` for image uploads
- Client-side image compression before AI analysis to reduce payload size and token/image cost

## AI Approach

Auto Reviver uses AI in two main places:

- **Listing analysis:** uploaded images are compressed, sent to the AI model, and converted into structured JSON for detected parts and listing drafts.
- **Search ranking:** database listings are compacted into efficient candidate records, then the AI ranks the best matches against the buyer's text and/or image query.

The demo model is configurable through environment variables. During the hackathon the project was built around a GPT-5.1-style model setup, with lighter/mini model experimentation for faster responses. The demo works, but the model is not perfect yet, especially for edge cases such as mirrored images, cropped parts, and ambiguous left/right orientation.

## Project Structure

```txt
UniHack-AutoReviver/
  public/
    index.html          # Home, list, and search entry points
    result.html         # AI listing review/results page
    listing.html        # Listing detail and fitment simulation
    search-results.html # Search results page
    app.js              # Frontend behaviour
    styles.css          # Frontend styling
  server/
    ai-listing/         # AI image-to-listing logic
    listings/           # SQLite listing database logic
    part-search/        # AI-assisted search ranking
  data/                 # Local generated SQLite database
  server.js             # Express app entry point
  package.json
```

## Getting Started

### 1. Clone The Repository

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
cd YOUR_REPO_NAME
```

If you are already inside the parent folder, move into the app folder:

```bash
cd UniHack-AutoReviver
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Create Your Environment File

Create a `.env` file in the project root. You can copy the example:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Then edit `.env` and add your OpenAI API key.

Example:

```env
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-5.1
OPENAI_SEARCH_MODEL=gpt-5.1
OPENAI_IMAGE_DETAIL=auto
PORT=3000
```

`OPENAI_SEARCH_MODEL` is optional. If it is not set, search uses `OPENAI_MODEL`. If neither model variable is set, the backend falls back to the default model defined in the code.
`OPENAI_IMAGE_DETAIL` is optional. Use `auto` for better recognition, or `low` if you need cheaper/faster image analysis during testing.

### 4. Run The App

For normal use:

```bash
npm start
```

For development with automatic Node reloads:

```bash
npm run dev
```

Open the app in your browser:

```txt
http://localhost:3000
```

## Database

The app uses a local SQLite database at:

```txt
data/autoreviver.sqlite
```

This file is generated locally and ignored by git. Listings created through the app are stored there.

## API Routes

```txt
POST /api/analyze-part     # Upload an image and get AI-generated listing data
POST /api/search-listings  # Search listings with text fields and/or an image
GET  /api/listings         # Get saved listings
GET  /api/listings/:id     # Get one listing
POST /api/listings         # Save a listing
```

## Hackathon Notes

This is an MVP built under time constraints. The core listing, AI-assisted search, and listing detail flows are functional for demo purposes.

Known limitations:

- The fitment/VIN database is simulated rather than fully implemented.
- AI side detection can still struggle with unusual image angles.
- Search quality depends on the amount and quality of listing data in the local database.
- The project currently uses a local SQLite database rather than a hosted production database.

## Future Improvements

- Build a proper vehicle fitment database.
- Create part DNA profiles for stronger compatibility matching.
- Add company seller accounts and bulk upload workflows.
- Improve AI confidence handling and human review tools.
- Add production authentication, hosting, and persistent image storage.

Live Site: (AI Features will be disabled)
Showcase: (Soon)
