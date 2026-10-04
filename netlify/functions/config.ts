import type { Config } from "@netlify/functions";
import { fail, getConfig, json, requireOwner, updateSettings } from "../lib/valley.js";

export default async (req: Request) => {
  if (req.method === "GET") return json(await getConfig());
  if (req.method !== "POST") return fail("Method not allowed", 405);

  const denied = await requireOwner(req);
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim().slice(0, 60);
  const message = String(body.message ?? "").trim().slice(0, 3000);
  if (!name) return fail("Please add her name");
  await updateSettings({ name, message });
  return json(await getConfig());
};

export const config: Config = { path: "/api/config" };
