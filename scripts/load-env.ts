// Side-effect import for CLI scripts: load env the way Next.js does (.env.local wins over .env).
// Must be the FIRST import, so DATABASE_URL is set before lib/db.ts creates the client.
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });
