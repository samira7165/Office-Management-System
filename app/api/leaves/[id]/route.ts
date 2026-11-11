import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leaves, employees } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { checkAccess, isInScope, getEmployeeDepartmentId } from "@/lib/authz";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const body = await req.json();

  const [existing] = await db.select().from(leaves).where(eq(leaves.id, Number(id)));
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if ("status" in body) {
    const targetDeptId = await getEmployeeDepartmentId(existing.employeeId);

    // TEAM_LEAD has no generic APPROVE permission (view-only role), but can "recommend" a
    // leave within their own department — a narrower business rule, not a general RBAC action.
    if (session?.role === "TEAM_LEAD") {
      if (targetDeptId !== session.departmentId || body.status !== "recommended") {
        return NextResponse.json({ error: "TEAM_LEAD can only recommend leaves in their own department" }, { status: 403 });
      }
    } else {
      const { allowed, scope } = await checkAccess(session, "LEAVES", "APPROVE");
      if (!allowed || !isInScope(scope, { employeeId: session!.employeeId, departmentId: session!.departmentId }, { departmentId: targetDeptId })) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
  }

  await db.update(leaves).set(body).where(eq(leaves.id, Number(id)));
  const [updated] = await db.select().from(leaves).where(eq(leaves.id, Number(id)));

  if (body.status === "approved" && updated) {
    await db.update(employees).set({ status: "on_leave" }).where(eq(employees.id, updated.employeeId));
  }
  return NextResponse.json(updated);
}
