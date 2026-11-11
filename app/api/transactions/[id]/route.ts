import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { transactions } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { checkAccess } from "@/lib/authz";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  const { allowed, scope } = await checkAccess(session, "FINANCE", "EDIT");
  if (!allowed || scope !== "ALL") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  await db.update(transactions).set(body).where(eq(transactions.id, Number(id)));
  const [updated] = await db.select().from(transactions).where(eq(transactions.id, Number(id)));
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  const { allowed, scope } = await checkAccess(session, "FINANCE", "DELETE");
  if (!allowed || scope !== "ALL") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await db.delete(transactions).where(eq(transactions.id, Number(id)));
  return NextResponse.json({ ok: true });
}
