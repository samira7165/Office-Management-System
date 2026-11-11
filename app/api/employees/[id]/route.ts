import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { employees } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { checkAccess } from "@/lib/authz";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  const { allowed } = await checkAccess(session, "EMPLOYEES", "EDIT");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  await db.update(employees).set(body).where(eq(employees.id, Number(id)));
  const [updated] = await db.select().from(employees).where(eq(employees.id, Number(id)));
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  const { allowed } = await checkAccess(session, "EMPLOYEES", "DELETE");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await db.delete(employees).where(eq(employees.id, Number(id)));
  return NextResponse.json({ ok: true });
}
