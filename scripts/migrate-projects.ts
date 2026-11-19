// Adds the Projects feature to an EXISTING database without touching any current data.
// Purely additive and idempotent — safe to run more than once:
//   1. adds 'PROJECTS' to the `module` enum
//   2. creates the `projects` table
//   3. inserts the PROJECTS permission rows (skips any that already exist)
//
// Run with:  npm run migrate:projects
import "./load-env";
import { sql } from "drizzle-orm";
import { db } from "../lib/db";
import { permissions } from "../lib/schema";
import { PERMISSION_SEED } from "../lib/authz";

async function main() {
  await db.execute(sql`ALTER TYPE "module" ADD VALUE IF NOT EXISTS 'PROJECTS'`);
  console.log("✓ module enum has PROJECTS");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "projects" (
      "id" serial PRIMARY KEY,
      "name" varchar(191) NOT NULL,
      "description" text DEFAULT '',
      "client_name" varchar(191) NOT NULL,
      "client_type" varchar(16) NOT NULL DEFAULT 'client',
      "client_email" varchar(191) DEFAULT '',
      "value" double precision NOT NULL DEFAULT 0,
      "start_date" varchar(16) NOT NULL,
      "end_date" varchar(16),
      "status" varchar(16) NOT NULL DEFAULT 'planned',
      "department_id" integer REFERENCES "departments"("id"),
      "manager_id" integer REFERENCES "employees"("id"),
      "created_at" varchar(64) NOT NULL
    )
  `);
  console.log("✓ projects table exists");

  const rows = PERMISSION_SEED.filter((p) => p.module === "PROJECTS");
  const inserted = await db
    .insert(permissions)
    .values(rows.map((p) => ({ role: p.role, module: p.module, action: p.action, scope: p.scope, isAllowed: true })))
    .onConflictDoNothing()
    .returning({ id: permissions.id });
  console.log(`✓ PROJECTS permissions: ${inserted.length} added, ${rows.length - inserted.length} already present`);
}

main().catch((err) => {
  console.error("Migration failed:", err.message || err);
  process.exit(1);
});
