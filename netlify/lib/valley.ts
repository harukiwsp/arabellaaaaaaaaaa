import { getStore } from "@netlify/blobs";
import { asc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { memories, settings, songs } from "../../db/schema.js";

export const LILY_COUNT = 12;
export const MAX_SONG_PARTS = 12;
export const MAX_PART_BYTES = 3 * 1024 * 1024;

// Photos and song chunks are binary files, so they live in Blobs; everything else is in the database.
export const files = () => getStore("valley-files");

export const json = (body: unknown, status = 200) => Response.json(body, { status });
export const fail = (error: string, status = 400) => json({ error }, status);

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function getSettings() {
  const [row] = await db.select().from(settings).where(eq(settings.id, 1));
  if (row) return row;
  const [created] = await db.insert(settings).values({ id: 1 }).onConflictDoNothing().returning();
  return created ?? (await db.select().from(settings).where(eq(settings.id, 1)))[0];
}

/** Checks the passcode sent in `x-owner-key`. Returns an error Response when it is not valid. */
export async function requireOwner(req: Request): Promise<Response | null> {
  const key = req.headers.get("x-owner-key")?.trim() ?? "";
  if (key.length < 4) return fail("Enter your passcode first", 403);
  const row = await getSettings();
  if (!row.ownerKeyHash) return fail("Set a passcode first — tap the lock in the bottom-left corner", 403);
  if ((await sha256(key)) !== row.ownerKeyHash) return fail("That passcode isn't right", 403);
  return null;
}

/** Claims the valley with this passcode the first time; afterwards only verifies it. */
export async function unlock(req: Request) {
  const key = req.headers.get("x-owner-key")?.trim() ?? "";
  if (key.length < 4 || key.length > 64) return fail("Passcodes need 4 to 64 characters");
  const row = await getSettings();
  if (!row.ownerKeyHash) {
    await db.update(settings).set({ ownerKeyHash: await sha256(key), updatedAt: new Date() }).where(eq(settings.id, 1));
    return json({ ok: true, claimed: true });
  }
  if ((await sha256(key)) !== row.ownerKeyHash) return fail("That passcode isn't right", 403);
  return json({ ok: true, claimed: true });
}

export async function getPlaylist() {
  const rows = await db.select().from(songs).orderBy(asc(songs.position), asc(songs.id));
  return rows.map(({ uploadId, title, type, parts }) => ({ uploadId, title, type, parts }));
}

/** The public shape of the valley that the page renders. Never includes the passcode hash. */
export async function getConfig() {
  const [row, memoryRows, playlist] = await Promise.all([getSettings(), db.select().from(memories), getPlaylist()]);
  const mem: Record<number, { photoKey: string; caption: string; date: string }> = {};
  for (const m of memoryRows) mem[m.slot] = { photoKey: m.photoKey, caption: m.caption, date: m.date };
  return { name: row.name, message: row.message, memories: mem, playlist, claimed: Boolean(row.ownerKeyHash) };
}

export async function updateSettings(values: { name?: string; message?: string }) {
  await getSettings();
  await db.update(settings).set({ ...values, updatedAt: new Date() }).where(eq(settings.id, 1));
}

export async function deleteSongFiles(uploadId: string, parts: number) {
  const store = files();
  await Promise.all(Array.from({ length: parts }, (_, i) => store.delete(`music/${uploadId}/${i}`)));
}
