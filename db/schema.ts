import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

// One row (id = 1) holding the valley's name, letter and the hashed decorate passcode.
export const settings = pgTable("settings", {
  id: integer().primaryKey(),
  name: text().notNull().default("My Love, Arabella."),
  message: text()
    .notNull()
    .default(
      "Happy birthday, my love. I planted this valley for you — every lily holds a moment of us. Wander slowly, look up at the aurora, and know that each star out here is a wish I made for you.",
    ),
  ownerKeyHash: text("owner_key_hash"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// A photo memory planted in one of the lilies (slot 0–11). The image itself lives in Blobs.
export const memories = pgTable("memories", {
  slot: integer().primaryKey(),
  photoKey: text("photo_key").notNull(),
  caption: text().notNull().default(""),
  date: text().notNull().default(""),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Songs in the playlist. Audio is uploaded in chunks to Blobs under music/<uploadId>/<part>.
export const songs = pgTable("songs", {
  id: serial().primaryKey(),
  uploadId: text("upload_id").notNull().unique(),
  title: text().notNull(),
  type: text().notNull().default("audio/mpeg"),
  parts: integer().notNull(),
  position: integer().notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});
