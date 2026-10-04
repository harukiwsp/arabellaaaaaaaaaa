import type { Config, Context } from "@netlify/functions";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { songs } from "../../db/schema.js";
import { deleteSongFiles, fail, getConfig, json, requireOwner } from "../lib/valley.js";

// Playlist editing for decorate mode: rename (PATCH), remove (DELETE), and reorder (PUT /api/songs/order).
export default async (req: Request, context: Context) => {
  const denied = await requireOwner(req);
  if (denied) return denied;
  const uploadId = context.params.uploadId ?? "";

  if (uploadId === "order") {
    if (req.method !== "PUT") return fail("Method not allowed", 405);
    const body = await req.json().catch(() => ({}));
    const order: unknown[] = Array.isArray(body.order) ? body.order : [];
    await Promise.all(
      order.map((id, position) => db.update(songs).set({ position }).where(eq(songs.uploadId, String(id)))),
    );
    return json(await getConfig());
  }

  const [song] = await db.select().from(songs).where(eq(songs.uploadId, uploadId));
  if (!song) return fail("That song is no longer in the playlist", 404);

  if (req.method === "PATCH") {
    const body = await req.json().catch(() => ({}));
    const title = String(body.title ?? "").trim().slice(0, 120);
    if (!title) return fail("Give the song a name");
    await db.update(songs).set({ title }).where(eq(songs.uploadId, uploadId));
    return json(await getConfig());
  }

  if (req.method === "DELETE") {
    await db.delete(songs).where(eq(songs.uploadId, uploadId));
    await deleteSongFiles(uploadId, song.parts);
    return json(await getConfig());
  }

  return fail("Method not allowed", 405);
};

export const config: Config = { path: "/api/songs/:uploadId", method: ["PATCH", "DELETE", "PUT"] };
