import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { invoices } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { checkAccess } from "@/lib/authz";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  const { allowed, scope } = await checkAccess(session, "FINANCE", "EDIT");
  if (!allowed || scope !== "ALL") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  await db.update(invoices).set(body).where(eq(invoices.id, Number(id)));
  const [updated] = await db.select().from(invoices).where(eq(invoices.id, Number(id)));
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  const { allowed, scope } = await checkAccess(session, "FINANCE", "DELETE");
  if (!allowed || scope !== "ALL") return NextResponse.json({ error: "Only admins can delete invoices" }, { status: 403 });

  const { id } = await params;
  await db.delete(invoices).where(eq(invoices.id, Number(id)));
  return NextResponse.json({ ok: true });
}
