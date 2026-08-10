import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const body = await req.json();

  if (session?.role === "employee") {
    const [existing] = await db.select().from(tasks).where(eq(tasks.id, Number(id)));
    if (!existing || existing.assigneeId !== session.employeeId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const allowedKeys = Object.keys(body).every((k) => k === "status");
    if (!allowedKeys) {
      return NextResponse.json({ error: "Employees can only update task status" }, { status: 403 });
    }
  }

  await db.update(tasks).set(body).where(eq(tasks.id, Number(id)));
  const [updated] = await db.select().from(tasks).where(eq(tasks.id, Number(id)));
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (session?.role === "employee") {
    return NextResponse.json({ error: "Only admins can delete tasks" }, { status: 403 });
  }
  const { id } = await params;
  await db.delete(tasks).where(eq(tasks.id, Number(id)));
  return NextResponse.json({ ok: true });
}
