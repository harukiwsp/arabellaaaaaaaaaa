import type { Config, Context } from "@netlify/functions";
import { max } from "drizzle-orm";
import { db } from "../../db/index.js";
import { songs } from "../../db/schema.js";
import { MAX_PART_BYTES, MAX_SONG_PARTS, fail, files, getConfig, json, requireOwner } from "../lib/valley.js";

// Song audio is uploaded in ≤3 MB chunks so large songs fit within function request limits.
// The final chunk adds the song to the end of the playlist.
export default async (req: Request, context: Context) => {
  const { uploadId, part: partParam } = context.params;
  const part = Number(partParam);
  if (!/^[\w-]{8,64}$/.test(uploadId ?? "") || !Number.isInteger(part) || part < 0 || part >= MAX_SONG_PARTS) {
    return fail("Unknown song", 404);
  }
  const key = `music/${uploadId}/${part}`;

  if (req.method === "GET") {
    const data = await files().get(key, { type: "arrayBuffer" });
    if (!data) return fail("Song unavailable", 404);
    return new Response(data, {
      headers: { "content-type": "application/octet-stream", "cache-control": "public, max-age=31536000, immutable" },
    });
  }

  const denied = await requireOwner(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const total = Number(url.searchParams.get("total"));
  if (!Number.isInteger(total) || total < 1 || total > MAX_SONG_PARTS || part >= total) {
    return fail("That song is too large — please pick one under 36 MB");
  }
  const body = await req.arrayBuffer();
  if (!body.byteLength || body.byteLength > MAX_PART_BYTES) return fail("Upload chunk was the wrong size");
  await files().set(key, body);

  if (part < total - 1) return json({ ok: true });

  const title = (url.searchParams.get("title") ?? "").trim().slice(0, 120) || "Untitled song";
  const type = (url.searchParams.get("type") ?? "").slice(0, 60) || "audio/mpeg";
  const [{ last }] = await db.select({ last: max(songs.position) }).from(songs);
  await db
    .insert(songs)
    .values({ uploadId, title, type, parts: total, position: (last ?? -1) + 1 })
    .onConflictDoNothing();
  return json(await getConfig());
};

export const config: Config = { path: "/api/music/:uploadId/:part", method: ["GET", "POST"] };
