import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { attendance } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { checkAccess, isInScope, getEmployeeDepartmentId } from "@/lib/authz";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const body = await req.json();

  const [existing] = await db.select().from(attendance).where(eq(attendance.id, Number(id)));
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isApproval = "approvalStatus" in body;
  const action = isApproval ? "APPROVE" : "CREATE"; // non-approval edits here are only ever the self clock-out step
  const { allowed, scope } = await checkAccess(session, "ATTENDANCE", action);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const targetDeptId = await getEmployeeDepartmentId(existing.employeeId);
  if (!isInScope(scope, { employeeId: session!.employeeId, departmentId: session!.departmentId }, { employeeId: existing.employeeId, departmentId: targetDeptId })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.update(attendance).set(body).where(eq(attendance.id, Number(id)));
  const [updated] = await db.select().from(attendance).where(eq(attendance.id, Number(id)));
  return NextResponse.json(updated);
}
