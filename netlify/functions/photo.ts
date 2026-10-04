import type { Config, Context } from "@netlify/functions";
import { files } from "../lib/valley.js";

export default async (_req: Request, context: Context) => {
  const id = String(context.params.id ?? "");
  if (!/^[\w-]+$/.test(id)) return new Response("Not found", { status: 404 });
  const data = await files().get(`photos/${id}`, { type: "arrayBuffer" });
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(data, {
    headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=31536000, immutable" },
  });
};

export const config: Config = { path: "/api/photo/:id", method: "GET" };
