import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { departments, employees, users } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getSession } from "@/lib/auth";
import { checkAccess, resolveHeadId } from "@/lib/authz";

const headUser = alias(users, "head_user");
const headEmployee = alias(employees, "head_employee");

export async function GET() {
  const session = await getSession();
  const { allowed, scope } = await checkAccess(session, "DEPARTMENTS", "VIEW");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await db
    .select({
      id: departments.id,
      name: departments.name,
      description: departments.description,
      color: departments.color,
      budget: departments.budget,
      headcount: sql<number>`count(distinct ${employees.id})`,
      headEmployeeId: headEmployee.id,
      headName: headUser.name,
      headAvatarColor: headEmployee.avatarColor,
    })
    .from(departments)
    .leftJoin(employees, eq(employees.departmentId, departments.id))
    .leftJoin(headUser, eq(headUser.id, departments.headId))
    .leftJoin(headEmployee, eq(headEmployee.id, headUser.employeeId))
    .groupBy(departments.id, headUser.id, headEmployee.id);

  let data = rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    color: r.color,
    budget: r.budget,
    headcount: r.headcount,
    headEmployeeId: r.headEmployeeId ?? null,
    head: r.headEmployeeId ? { id: r.headEmployeeId, name: r.headName, avatarColor: r.headAvatarColor } : null,
  }));

  // DEPARTMENTS' "SELF" scope means "my own department", not "my own employee record" —
  // the one module where that idiom applies (see DEPT_HEAD/EMPLOYEE rows in lib/authz.ts).
  if (scope === "SELF") {
    data = data.filter((d) => d.id === session!.departmentId);
  } else if (scope === "DEPARTMENT") {
    data = data.filter((d) => d.id === session!.departmentId);
  }
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const { allowed } = await checkAccess(session, "DEPARTMENTS", "CREATE");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  if (!body.name) return NextResponse.json({ error: "Department name is required" }, { status: 400 });
  const [created] = await db.insert(departments).values({
    name: body.name,
    description: body.description || "",
    color: body.color || "#6C5DD3",
    headId: await resolveHeadId(body.headEmployeeId),
    budget: Number(body.budget || 0),
  }).returning();
  return NextResponse.json(created, { status: 201 });
}
