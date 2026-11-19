import { db } from "@/lib/db";
import { transactions, clients } from "@/lib/schema";
import { and, eq, ne, sql } from "drizzle-orm";
import { fmtTaka } from "@/lib/finance";

type TxShape = {
  id?: number; type: string; amount: number;
  dealAmount: number | null; parentId: number | null; clientId: number | null;
};

const EPS = 0.005; // money is rounded to paisa; ignore float dust

async function paymentsTotal(dealId: number, excludeId?: number) {
  const where = excludeId
    ? and(eq(transactions.parentId, dealId), ne(transactions.id, excludeId))
    : eq(transactions.parentId, dealId);
  const [{ s }] = await db.select({ s: sql<number>`coalesce(sum(${transactions.amount}), 0)::float` }).from(transactions).where(where);
  return Number(s);
}

/**
 * Advance / deal rules, checked on create and edit (with the row as it WILL be saved).
 * Returns an error message, or null — plus the deal's client so payments inherit it.
 */
export async function checkDealRules(tx: TxShape): Promise<{ error: string | null; clientId?: number | null; projectId?: number | null }> {
  if (tx.clientId) {
    const [c] = await db.select({ id: clients.id }).from(clients).where(eq(clients.id, tx.clientId));
    if (!c) return { error: "Client not found" };
  }

  if (tx.dealAmount != null) {
    if (tx.type !== "cash_in") return { error: "Only Cash In entries can have a total deal amount" };
    if (tx.parentId) return { error: "A payment against a deal can't have its own deal amount" };
    if (tx.amount > tx.dealAmount + EPS) return { error: "Advance received can't be more than the total deal amount" };
    if (tx.id) {
      const later = await paymentsTotal(tx.id);
      if (tx.amount + later > tx.dealAmount + EPS) {
        return { error: `Total deal amount can't be less than the ${fmtTaka(tx.amount + later)} already received` };
      }
    }
  } else if (tx.id) {
    // Removing the deal amount from a row that already has payments would orphan them.
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(transactions).where(eq(transactions.parentId, tx.id));
    if (n > 0) return { error: "This deal has payments recorded against it, so it needs a total deal amount" };
  }

  if (tx.parentId) {
    if (tx.type !== "cash_in") return { error: "Payments against a deal must be Cash In" };
    if (tx.id && tx.parentId === tx.id) return { error: "A deal can't be a payment for itself" };
    const [deal] = await db.select().from(transactions).where(eq(transactions.id, tx.parentId));
    if (!deal || deal.dealAmount == null) return { error: "That deal was not found" };
    const due = deal.dealAmount - deal.amount - (await paymentsTotal(deal.id, tx.id));
    if (tx.amount > due + EPS) {
      return { error: due <= EPS ? "That deal is already fully paid" : `This payment is more than the ${fmtTaka(due)} still due on that deal` };
    }
    return { error: null, clientId: deal.clientId, projectId: deal.projectId };
  }
  return { error: null };
}
