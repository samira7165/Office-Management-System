import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { checkAccess, isInScope, getEmployeeDepartmentId } from "@/lib/authz";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const body = await req.json();

  const [existing] = await db.select().from(tasks).where(eq(tasks.id, Number(id)));
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { allowed, scope } = await checkAccess(session, "TASKS", "EDIT");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const targetDeptId = await getEmployeeDepartmentId(existing.assigneeId);
  if (!isInScope(scope, { employeeId: session!.employeeId, departmentId: session!.departmentId }, { employeeId: existing.assigneeId, departmentId: targetDeptId })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (scope === "SELF") {
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
  const { allowed } = await checkAccess(session, "TASKS", "DELETE");
  if (!allowed) return NextResponse.json({ error: "Not allowed to delete tasks" }, { status: 403 });

  const { id } = await params;
  await db.delete(tasks).where(eq(tasks.id, Number(id)));
  return NextResponse.json({ ok: true });
}
