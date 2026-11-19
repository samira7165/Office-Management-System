import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { db } from "@/lib/db";
import { transactions } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { checkAccess } from "@/lib/authz";
import { parseTxInput, publicTx } from "@/lib/finance";
import { checkDealRules } from "@/lib/finance-db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  const { allowed, scope } = await checkAccess(session, "FINANCE", "EDIT");
  if (!allowed || scope !== "ALL") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  // Only ledger fields can change — not id, createdAt or the receipt URL.
  const parsed = parseTxInput((k) => body[k], (k) => k in body, true);
  if (!parsed.data) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const [existing] = await db.select().from(transactions).where(eq(transactions.id, Number(id)));
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Check the deal/advance rules against the row as it will look after this edit.
  const merged = { ...existing, ...parsed.data };
  const rules = await checkDealRules({
    id: existing.id, type: merged.type, amount: merged.amount, clientId: merged.clientId,
    dealAmount: merged.dealAmount, parentId: merged.parentId,
  });
  if (rules.error) return NextResponse.json({ error: rules.error }, { status: 400 });
  const changes = { ...parsed.data };
  if (merged.parentId) changes.clientId = rules.clientId ?? null; // payments follow their deal's client

  if (Object.keys(changes).length > 0) {
    await db.update(transactions).set(changes).where(eq(transactions.id, Number(id)));
    // Payments follow their deal's client when the deal's client changes.
    if (existing.dealAmount != null && "clientId" in changes) {
      await db.update(transactions).set({ clientId: changes.clientId ?? null }).where(eq(transactions.parentId, existing.id));
    }
  }
  const [updated] = await db.select().from(transactions).where(eq(transactions.id, Number(id)));
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(publicTx(updated));
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  const { allowed, scope } = await checkAccess(session, "FINANCE", "DELETE");
  if (!allowed || scope !== "ALL") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const [row] = await db.select().from(transactions).where(eq(transactions.id, Number(id)));
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(transactions).where(eq(transactions.parentId, Number(id)));
  if (n > 0) {
    return NextResponse.json(
      { error: `This deal has ${n} payment${n === 1 ? "" : "s"} recorded against it. Delete those payments first.` },
      { status: 409 }
    );
  }
  await db.delete(transactions).where(eq(transactions.id, Number(id)));
  // Remove the stored receipt too; a failed blob delete shouldn't undo the ledger delete.
  if (row?.receiptUrl) await del(row.receiptUrl).catch(() => {});
  return NextResponse.json({ ok: true });
}
