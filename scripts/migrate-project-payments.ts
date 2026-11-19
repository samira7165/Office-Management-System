// Adds project payment schedules + project-linked payments without deleting anything.
// Additive and idempotent — safe to run more than once:
//   1. creates the project_installments table (expected installments per project)
//   2. adds transactions.project_id and transactions.installment_id
//
// Run with:  npm run migrate:project-payments   (after migrate:projects and migrate:ledger)
import "./load-env";
import { sql } from "drizzle-orm";
import { db } from "../lib/db";

async function main() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "project_installments" (
      "id" serial PRIMARY KEY,
      "project_id" integer NOT NULL REFERENCES "projects"("id"),
      "label" varchar(100) NOT NULL,
      "amount" double precision NOT NULL,
      "due_date" varchar(16) NOT NULL,
      "created_at" varchar(64) NOT NULL
    )
  `);
  console.log("✓ project_installments table exists");

  await db.execute(sql`ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "project_id" integer REFERENCES "projects"("id")`);
  await db.execute(sql`ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "installment_id" integer REFERENCES "project_installments"("id")`);
  console.log("✓ transactions.project_id / installment_id exist");
}

main().catch((err) => {
  console.error("Migration failed:", err.message || err);
  process.exit(1);
});
