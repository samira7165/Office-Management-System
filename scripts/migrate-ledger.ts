// Upgrades the transactions table to the Finance Ledger format without deleting anything.
// Additive and idempotent — safe to run more than once:
//   1. adds account, receipt_url, receipt_name, client_id, deal_amount, parent_id columns
//   2. converts old types: income -> cash_in, expense with category "salaries" -> salary
//   3. fills account from the old payment method where account is empty
//
// Run with:  npm run migrate:ledger
import "./load-env";
import { sql } from "drizzle-orm";
import { db } from "../lib/db";

async function main() {
  await db.execute(sql`ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "account" varchar(64) DEFAULT ''`);
  await db.execute(sql`ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "receipt_url" varchar(512)`);
  await db.execute(sql`ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "receipt_name" varchar(191)`);
  // Needs the clients table (npm run migrate:clients) to exist first.
  await db.execute(sql`ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "client_id" integer REFERENCES "clients"("id")`);
  await db.execute(sql`ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "deal_amount" double precision`);
  await db.execute(sql`ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "parent_id" integer REFERENCES "transactions"("id")`);
  console.log("✓ account / receipt / client / deal columns exist");

  const cashIn = await db.execute(sql`UPDATE "transactions" SET "type" = 'cash_in' WHERE "type" = 'income' RETURNING "id"`);
  const salary = await db.execute(sql`
    UPDATE "transactions" SET "type" = 'salary', "category" = 'Salary'
    WHERE "type" = 'expense' AND lower("category") IN ('salaries', 'salary') RETURNING "id"`);
  console.log(`✓ types: ${cashIn.rows.length} income -> cash_in, ${salary.rows.length} salary expenses -> salary`);

  const accounts = await db.execute(sql`
    UPDATE "transactions" SET "account" = CASE "method"
        WHEN 'bank' THEN 'Bank' WHEN 'cash' THEN 'Cash'
        WHEN 'mobile_banking' THEN 'Mobile banking' WHEN 'card' THEN 'Card' ELSE '' END
    WHERE coalesce("account", '') = '' AND "method" IS NOT NULL RETURNING "id"`);
  console.log(`✓ account filled from old payment method on ${accounts.rows.length} row(s)`);
}

main().catch((err) => {
  console.error("Migration failed:", err.message || err);
  process.exit(1);
});
