import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { departments } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { checkAccess, resolveHeadId } from "@/lib/authz";

// DEPARTMENTS' "SELF"/"DEPARTMENT" scopes both mean "my own department" here, not "my own
// employee record" — see the note in app/api/departments/route.ts.
function inOwnDepartmentScope(scope: string | null, session: { departmentId: number | null } | null, deptId: number) {
  if (scope === "ALL") return true;
  if ((scope === "SELF" || scope === "DEPARTMENT") && session) return session.departmentId === deptId;
  return false;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  const { id } = await params;
  const deptId = Number(id);
  const { allowed, scope } = await checkAccess(session, "DEPARTMENTS", "EDIT");
  if (!allowed || !inOwnDepartmentScope(scope, session, deptId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const patch: Record<string, unknown> = { ...body };
  if ("headEmployeeId" in patch) {
    patch.headId = await resolveHeadId(patch.headEmployeeId);
    delete patch.headEmployeeId;
  }
  await db.update(departments).set(patch).where(eq(departments.id, deptId));
  const [updated] = await db.select().from(departments).where(eq(departments.id, deptId));
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  const { allowed } = await checkAccess(session, "DEPARTMENTS", "DELETE");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await db.delete(departments).where(eq(departments.id, Number(id)));
  return NextResponse.json({ ok: true });
}
