import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { attendance, employees } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { checkAccess, applyScopeFilter } from "@/lib/authz";

export async function GET(req: NextRequest) {
  const session = await getSession();
  const { allowed, scope } = await checkAccess(session, "ATTENDANCE", "VIEW");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const date = req.nextUrl.searchParams.get("date");
  const employeeId = req.nextUrl.searchParams.get("employeeId");
  const rows = await db
    .select({ a: attendance, employee: employees })
    .from(attendance)
    .leftJoin(employees, eq(attendance.employeeId, employees.id))
    .orderBy(desc(attendance.date));
  let data = rows.map((r) => ({ ...r.a, employee: r.employee }));

  data = applyScopeFilter(data, scope, { employeeId: session!.employeeId, departmentId: session!.departmentId }, {
    employeeId: (r) => r.employeeId,
    departmentId: (r) => r.employee?.departmentId,
  });

  if (scope === "ALL" && employeeId) data = data.filter((r) => r.employeeId === Number(employeeId));
  if (date) data = data.filter((r) => r.date === date);
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const { allowed, scope } = await checkAccess(session, "ATTENDANCE", "CREATE");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const employeeId = scope === "SELF" ? session!.employeeId : body.employeeId;
  if (!employeeId || !body.date) {
    return NextResponse.json({ error: "Employee and date are required" }, { status: 400 });
  }

  const [created] = await db.insert(attendance).values({
    employeeId,
    date: body.date,
    checkIn: body.checkIn || null,
    checkOut: body.checkOut || null,
    status: body.status || "present",
    approvalStatus: scope === "SELF" ? "pending" : "approved",
  }).returning();
  return NextResponse.json(created, { status: 201 });
}
