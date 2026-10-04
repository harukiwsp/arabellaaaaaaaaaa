# AGENTS.md

## Architecture

- `index.html` — the whole valley UI (intro, HUD, music player + playlist panel, dialogs, owner panel). A small inline
  script handles the passcode lock and redirects into `?edit` (decorate mode) after `/api/unlock` succeeds.
- `src/scene.js` — the three.js scene (terrain, lilies, aurora, fireflies, camera flights, picking). It is a port of the
  original compiled build, so identifiers are terse; the public surface is `createValley(canvas, { onPick })` and
  `LILY_COUNT`. three.js names are aliased in the import block at the top — keep three pinned to 0.170.x.
- `src/main.js` — app logic: API client, memories, letter, tour, and the playlist player (`music` state object,
  `loadSong`, `syncPlaylist`, `renderPlaylist`).
- `src/qr.js` + `qr.html` — heart-shaped QR code generator served at `/qr` (redirect in `netlify.toml`).
- `netlify/functions/*.ts` — API routes: `config`, `unlock`, `memory/:slot`, `photo/:id`, `music/:uploadId/:part`
  (chunk upload/download), `songs/:uploadId` (PATCH rename, DELETE remove, PUT `songs/order` reorder).
- `netlify/lib/valley.ts` — shared helpers: passcode check (`x-owner-key` header, SHA-256 hash in `settings`),
  `getConfig()` (the JSON shape the page renders), Blobs store `valley-files`.
- `db/schema.ts` — Drizzle schema (`settings` single row id=1, `memories`, `songs`). Migrations in
  `netlify/database/migrations` — never edit applied ones; generate new ones with drizzle-kit.

## Conventions & decisions

- Every write endpoint returns the full config so the client just calls `applyConfig(result)`.
- Binary data (photos, audio chunks) goes in Blobs; structured data goes in Netlify Database.
- Songs are fetched whole (all chunks) and played from an object URL; URLs are cached per `uploadId` and revoked when
  a song is removed.
- `body.editing` + `.edit-only` CSS hides owner tools from visitors; the server still enforces the passcode.
- Player preferences (volume, repeat, shuffle) are per-device in localStorage.
