import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leaves, employees } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { checkAccess, applyScopeFilter } from "@/lib/authz";

export async function GET() {
  const session = await getSession();
  const { allowed, scope } = await checkAccess(session, "LEAVES", "VIEW");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await db
    .select({ l: leaves, employee: employees })
    .from(leaves)
    .leftJoin(employees, eq(leaves.employeeId, employees.id))
    .orderBy(desc(leaves.appliedOn));
  let data = rows.map((r) => ({ ...r.l, employee: r.employee }));

  data = applyScopeFilter(data, scope, { employeeId: session!.employeeId, departmentId: session!.departmentId }, {
    employeeId: (r) => r.employeeId,
    departmentId: (r) => r.employee?.departmentId,
  });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const { allowed, scope } = await checkAccess(session, "LEAVES", "CREATE");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const employeeId = scope === "SELF" ? session!.employeeId : body.employeeId;
  if (!employeeId || !body.type || !body.startDate || !body.endDate) {
    return NextResponse.json({ error: "Employee, type, and dates are required" }, { status: 400 });
  }

  const [created] = await db.insert(leaves).values({
    employeeId,
    type: body.type,
    startDate: body.startDate,
    endDate: body.endDate,
    reason: body.reason || "",
    status: "pending",
    appliedOn: new Date().toISOString(),
  }).returning();
  return NextResponse.json(created, { status: 201 });
}
