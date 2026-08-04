import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { departments, employees, attendance } from "@/lib/schema";
import { eq, gte } from "drizzle-orm";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deptId = Number(id);

  const [dept] = await db.select().from(departments).where(eq(departments.id, deptId));
  if (!dept) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const deptEmployees = await db.select().from(employees).where(eq(employees.departmentId, deptId));

  const empIds = deptEmployees.map((e) => e.id);
  const monthlyCost = deptEmployees
    .filter((e) => e.status !== "inactive")
    .reduce((sum, e) => sum + e.baseSalary, 0);

  // attendance rate over the last 30 days for this department's employees
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceStr = since.toISOString().slice(0, 10);

  let attendanceRate = 0;
  if (empIds.length > 0) {
    const rows = await db.select().from(attendance).where(gte(attendance.date, sinceStr));
    const deptRows = rows.filter((r) => empIds.includes(r.employeeId));
    const presentCount = deptRows.filter((r) => r.status === "present" || r.status === "late").length;
    attendanceRate = deptRows.length > 0 ? Math.round((presentCount / deptRows.length) * 100) : 0;
  }

  let head = null;
  if (dept.headEmployeeId) {
    const [h] = await db.select().from(employees).where(eq(employees.id, dept.headEmployeeId));
    head = h || null;
  }

  return NextResponse.json({
    ...dept,
    head,
    employees: deptEmployees,
    monthlyCost,
    attendanceRate,
  });
}
