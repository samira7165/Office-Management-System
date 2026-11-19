// Adds the Clients feature to an EXISTING database without deleting anything.
// Additive and idempotent — safe to run more than once:
//   1. adds 'CLIENTS' to the `module` enum
//   2. creates the `clients` table
//   3. adds projects.client_id
//   4. turns any client names already typed on projects into client records and links them
//   5. inserts the CLIENTS permission rows (skips any that already exist)
//
// Run with:  npm run migrate:clients   (after migrate:projects)
import "./load-env";
import { sql } from "drizzle-orm";
import { db } from "../lib/db";
import { permissions } from "../lib/schema";
import { PERMISSION_SEED } from "../lib/authz";

async function main() {
  await db.execute(sql`ALTER TYPE "module" ADD VALUE IF NOT EXISTS 'CLIENTS'`);
  console.log("✓ module enum has CLIENTS");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "clients" (
      "id" serial PRIMARY KEY,
      "name" varchar(191) NOT NULL UNIQUE,
      "type" varchar(16) NOT NULL DEFAULT 'client',
      "contact_person" varchar(191) DEFAULT '',
      "email" varchar(191) DEFAULT '',
      "phone" varchar(32) DEFAULT '',
      "address" varchar(512) DEFAULT '',
      "notes" text DEFAULT '',
      "created_at" varchar(64) NOT NULL
    )
  `);
  console.log("✓ clients table exists");

  await db.execute(sql`ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "client_id" integer REFERENCES "clients"("id")`);
  console.log("✓ projects.client_id exists");

  // Backfill: one client per distinct (case-insensitive) name typed on unlinked projects.
  const created = await db.execute(sql`
    INSERT INTO "clients" ("name", "type", "email", "created_at")
    SELECT DISTINCT ON (lower(p."client_name")) p."client_name", p."client_type", coalesce(p."client_email", ''), now()::text
    FROM "projects" p
    WHERE p."client_id" IS NULL
      AND NOT EXISTS (SELECT 1 FROM "clients" c WHERE lower(c."name") = lower(p."client_name"))
    ORDER BY lower(p."client_name"), p."id"
    RETURNING "id"
  `);
  const linked = await db.execute(sql`
    UPDATE "projects" p SET "client_id" = c."id"
    FROM "clients" c
    WHERE p."client_id" IS NULL AND lower(c."name") = lower(p."client_name")
    RETURNING p."id"
  `);
  console.log(`✓ backfill: ${created.rows.length} client(s) created from projects, ${linked.rows.length} project(s) linked`);

  const rows = PERMISSION_SEED.filter((p) => p.module === "CLIENTS");
  const inserted = await db
    .insert(permissions)
    .values(rows.map((p) => ({ role: p.role, module: p.module, action: p.action, scope: p.scope, isAllowed: true })))
    .onConflictDoNothing()
    .returning({ id: permissions.id });
  console.log(`✓ CLIENTS permissions: ${inserted.length} added, ${rows.length - inserted.length} already present`);
}

main().catch((err) => {
  console.error("Migration failed:", err.message || err);
  process.exit(1);
});
