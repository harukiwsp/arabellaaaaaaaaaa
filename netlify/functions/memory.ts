import type { Config, Context } from "@netlify/functions";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { memories } from "../../db/schema.js";
import { LILY_COUNT, fail, files, getConfig, json, requireOwner } from "../lib/valley.js";

export default async (req: Request, context: Context) => {
  const slot = Number(context.params.slot);
  if (!Number.isInteger(slot) || slot < 0 || slot >= LILY_COUNT) return fail("Unknown lily", 404);
  const denied = await requireOwner(req);
  if (denied) return denied;

  const [existing] = await db.select().from(memories).where(eq(memories.slot, slot));

  if (req.method === "DELETE") {
    if (existing) {
      await db.delete(memories).where(eq(memories.slot, slot));
      await files().delete(existing.photoKey);
    }
    return json(await getConfig());
  }
  if (req.method !== "POST") return fail("Method not allowed", 405);

  const form = await req.formData();
  const photo = form.get("photo");
  const caption = String(form.get("caption") ?? "").trim().slice(0, 280);
  const date = String(form.get("date") ?? "").trim().slice(0, 40);

  let photoKey = existing?.photoKey;
  if (photo instanceof File && photo.size > 0) {
    if (photo.size > 5 * 1024 * 1024) return fail("That photo is too large");
    photoKey = `photos/${slot}-${crypto.randomUUID()}`;
    await files().set(photoKey, await photo.arrayBuffer());
    if (existing) await files().delete(existing.photoKey);
  }
  if (!photoKey) return fail("Choose a photo first");

  await db
    .insert(memories)
    .values({ slot, photoKey, caption, date })
    .onConflictDoUpdate({ target: memories.slot, set: { photoKey, caption, date, updatedAt: new Date() } });
  return json(await getConfig());
};

export const config: Config = { path: "/api/memory/:slot", method: ["POST", "DELETE"] };
