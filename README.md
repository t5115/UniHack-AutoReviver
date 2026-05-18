# AutoReviver MVP

AutoReviver is a simple hackathon prototype for the UK used car parts market.

It helps users:

- Check whether a used car part fits a vehicle.
- Search and filter a small database of cars, parts, and compatibility data.
- Generate a professional seller listing from part details.

The project intentionally uses a simple stack:

- HTML
- CSS
- JavaScript
- Node.js
- Express
- SQLite

No React, Next.js, TypeScript, Tailwind, Firebase, or Supabase.

## How To Open The Project

Open a terminal in this folder:

```txt
UniHack-AutoReviver
```

Install dependencies:

```bash
npm install
```

Start the app:

```bash
npm start
```

Then open this in your browser:

```txt
http://localhost:3000
```

For development, you can run:

```bash
npm run dev
```

That restarts the server when backend files change.

## Reset The Demo Database

The app uses a local SQLite database at:

```txt
data/autoreviver.sqlite
```

This file is ignored by git because it is generated locally.

To reset and reseed the database:

```bash
npm run seed
```

## Project Structure

```txt
UniHack-AutoReviver/
  data/
    db.js
    seed.js
  public/
    app.js
    index.html
    styles.css
  .gitignore
  package.json
  package-lock.json
  server.js
```

## What Each File Does

### `server.js`

This is the Node.js and Express backend.

It:

- Starts the local server on `http://localhost:3000`.
- Serves frontend files from the `public/` folder.
- Provides API routes for cars, parts, fitment checks, and seller listings.

Important API routes:

```txt
GET  /api/cars
GET  /api/parts
GET  /api/metadata
POST /api/check-fitment
POST /api/listings
GET  /api/listings
```

### `data/db.js`

This creates and connects to the SQLite database.

It:

- Creates the `cars`, `parts`, `compatibility`, and `seller_listings` tables.
- Seeds starter demo data if the database is empty.
- Exports database helper functions used by `server.js`.

### `data/seed.js`

This resets the demo database.

Run it with:

```bash
npm run seed
```

### `public/index.html`

This is the home page.

It is currently blank because the frontend was cleared. Add your homepage HTML here when you are ready to rebuild the page.

### `public/styles.css`

This controls the visual design.

It is currently blank. Add CSS here when you want to style the homepage or any other page in `public/`.

### `public/app.js`

This is the frontend JavaScript.

It is currently blank. Add browser-side JavaScript here when you want the page to call the backend API, handle button clicks, search parts, or submit forms.

### `package.json`

This lists the project scripts and dependencies.

Useful scripts:

```bash
npm start
npm run dev
npm run seed
```

### `.gitignore`

This tells git not to commit generated files such as:

- `node_modules/`
- The local SQLite database
- Log files

## Where Is The Home Page?

The home HTML page is:

```txt
public/index.html
```

In the browser, this is what loads when you open:

```txt
http://localhost:3000
```

To edit the homepage:

1. Open `public/index.html`.
2. Change the HTML text, headings, forms, or sections.
3. Save the file.
4. Refresh the browser.

If you change styling, edit:

```txt
public/styles.css
```

If you change behaviour, edit:

```txt
public/app.js
```

## How To Make A New Page

Create a new `.html` file inside the `public/` folder.

Example:

```txt
public/about.html
```

You can then open it at:

```txt
http://localhost:3000/about.html
```

Basic example:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>About AutoReviver</title>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <main class="panel">
      <h1>About AutoReviver</h1>
      <p>This page explains the project.</p>
      <a href="/">Back home</a>
    </main>
  </body>
</html>
```

To link to the new page from the homepage, add this somewhere in `public/index.html`:

```html
<a href="/about.html">About</a>
```

## Team Notes

- Keep frontend files inside `public/`.
- Keep backend/API code in `server.js`.
- Keep database setup and seed data in `data/`.
- Restart the server if backend files change.
- Refresh the browser if HTML, CSS, or frontend JavaScript changes.
