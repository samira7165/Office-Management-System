import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Tolerate a value pasted with surrounding quotes or whitespace (e.g. copied from .env.local
// into Vercel's env settings) — neon() rejects anything not starting with postgres(ql)://.
const DATABASE_URL = (process.env.DATABASE_URL || "").trim().replace(/^(["'])(.*)\1$/, "$2").trim();

const sql = neon(DATABASE_URL);

export const db = drizzle(sql, { schema });
