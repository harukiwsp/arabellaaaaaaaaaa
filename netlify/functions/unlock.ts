import type { Config } from "@netlify/functions";
import { fail, unlock } from "../lib/valley.js";

export default async (req: Request) => (req.method === "POST" ? unlock(req) : fail("Method not allowed", 405));

export const config: Config = { path: "/api/unlock" };
