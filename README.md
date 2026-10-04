# A Valley of Lilies

A birthday surprise: a 3D valley of glowing lilies under an aurora. Each lily can hold a photo memory, there's a
birthday letter, a heart-shaped QR code to share the link, and a music player with a full playlist of "our songs".

## Features

- **3D valley** (three.js) — drag to wander, tap a glowing lily to open its memory, or start an automatic tour.
- **Memories** — up to 12 photos with captions and dates, planted into lilies in decorate mode.
- **Letter** — a personal birthday message and recipient name.
- **Playlist player** — play/pause, previous/next, seek, volume, repeat-one and shuffle for every visitor.
  In decorate mode the owner can add several songs at once, rename (✎ or double-click), reorder (↑/↓) and remove (×).
- **Decorate mode** — protected by a passcode chosen the first time someone taps the lock in the bottom-left corner.
- **Heart QR** at `/qr` — a printable heart-shaped QR code that opens the valley.

## Tech

- Vite + vanilla JavaScript, three.js 0.170 with bloom post-processing
- Netlify Functions (`netlify/functions`) for the API
- Netlify Database (Postgres via Drizzle ORM) for the name, letter, passcode hash, memories and playlist
- Netlify Blobs for photo files and song audio (uploaded in 3 MB chunks, up to 36 MB per song)

## Running locally

```bash
npm install
netlify dev
```

Then open the URL printed by the CLI. Database migrations live in `netlify/database/migrations` and are applied
automatically on deploy; after changing `db/schema.ts` run `npx drizzle-kit generate --name <change>`.
