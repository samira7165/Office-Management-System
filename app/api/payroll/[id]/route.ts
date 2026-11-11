import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { payroll } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { checkAccess } from "@/lib/authz";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  const { allowed } = await checkAccess(session, "PAYROLL", "EDIT");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const patch: Record<string, unknown> = { ...body };
  if (body.status === "paid") {
    patch.paidOn = new Date().toISOString().slice(0, 10);
  }
  await db.update(payroll).set(patch).where(eq(payroll.id, Number(id)));
  const [updated] = await db.select().from(payroll).where(eq(payroll.id, Number(id)));
  return NextResponse.json(updated);
}
