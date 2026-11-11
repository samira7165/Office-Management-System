import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { employees, attendance, leaves, payroll, departments } from "@/lib/schema";
import { sql, eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { checkAccess } from "@/lib/authz";

export async function GET(req: NextRequest) {
  const session = await getSession();
  const { allowed, scope } = await checkAccess(session, "DASHBOARD", "VIEW");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (scope === "SELF") {
    return NextResponse.json(await selfStats(session!.employeeId));
  }

  const requestedDeptId = req.nextUrl.searchParams.get("departmentId");

  // DEPARTMENT scope is always pinned to the caller's own department, regardless of any
  // query param — ALL scope (SUPER_ADMIN) can optionally narrow via ?departmentId=.
  let deptId: number | null = null;
  if (scope === "DEPARTMENT") {
    deptId = session!.departmentId;
  } else if (scope === "ALL" && requestedDeptId) {
    deptId = Number(requestedDeptId);
  }

  const employeeScope = deptId ? eq(employees.departmentId, deptId) : undefined;
  const deptEmployeeIds = deptId
    ? (await db.select({ id: employees.id }).from(employees).where(eq(employees.departmentId, deptId))).map((e) => e.id)
    : null;

  const totalEmployees = (await db.select({ c: sql<number>`count(*)` }).from(employees).where(employeeScope))[0].c;
  const activeEmployees = (await db.select({ c: sql<number>`count(*)` }).from(employees).where(employeeScope ? and(employeeScope, eq(employees.status, "active")) : eq(employees.status, "active")))[0].c;
  const onLeaveToday = (await db.select({ c: sql<number>`count(*)` }).from(employees).where(employeeScope ? and(employeeScope, eq(employees.status, "on_leave")) : eq(employees.status, "on_leave")))[0].c;

  const today = new Date().toISOString().slice(0, 10);
  const attToday = await db.select().from(attendance).where(sql`${attendance.date} = ${today} AND ${attendance.status} IN ('present','late')`);
  const presentToday = deptEmployeeIds ? attToday.filter((r) => deptEmployeeIds.includes(r.employeeId)).length : attToday.length;

  const pendingLeaveRows = await db
    .select({ l: leaves, employee: employees })
    .from(leaves)
    .leftJoin(employees, eq(leaves.employeeId, employees.id))
    .where(eq(leaves.status, "pending"));
  const pendingLeaves = (deptId ? pendingLeaveRows.filter((r) => r.employee?.departmentId === deptId) : pendingLeaveRows).length;

  let pendingPayroll = 0;
  if (!deptId) {
    pendingPayroll = (await db.select({ c: sql<number>`count(*)` }).from(payroll).where(eq(payroll.status, "pending")))[0].c;
  }

  // attendance trend last 7 days
  const attRows = await db.select().from(attendance);
  const scopedAttRows = deptEmployeeIds ? attRows.filter((r) => deptEmployeeIds.includes(r.employeeId)) : attRows;
  const days: { date: string; present: number; absent: number; late: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    const dayRows = scopedAttRows.filter((r) => r.date === ds);
    days.push({
      date: ds,
      present: dayRows.filter((r) => r.status === "present").length,
      late: dayRows.filter((r) => r.status === "late").length,
      absent: dayRows.filter((r) => r.status === "absent").length,
    });
  }

  const depts = await db
    .select({ name: departments.name, color: departments.color, count: sql<number>`count(${employees.id})` })
    .from(departments)
    .leftJoin(employees, eq(employees.departmentId, departments.id))
    .where(deptId ? eq(departments.id, deptId) : undefined)
    .groupBy(departments.id);

  return NextResponse.json({
    totalEmployees,
    activeEmployees,
    onLeaveToday,
    presentToday,
    pendingLeaves,
    pendingPayroll,
    attendanceTrend: days,
    departmentBreakdown: depts,
  });
}

// EMPLOYEE (DASHBOARD VIEW(SELF)) sees a personal-scale version of the same shape: their
// own attendance/leave/payroll, not company-wide figures.
async function selfStats(employeeId: number | null) {
  if (!employeeId) {
    return {
      totalEmployees: 0, activeEmployees: 0, onLeaveToday: 0, presentToday: 0,
      pendingLeaves: 0, pendingPayroll: 0, attendanceTrend: [], departmentBreakdown: [],
    };
  }

  const [employee] = await db.select().from(employees).where(eq(employees.id, employeeId));
  const [dept] = employee?.departmentId
    ? await db.select().from(departments).where(eq(departments.id, employee.departmentId))
    : [null];

  const today = new Date().toISOString().slice(0, 10);
  const myAttendance = await db.select().from(attendance).where(eq(attendance.employeeId, employeeId));
  const presentToday = myAttendance.some((r) => r.date === today && (r.status === "present" || r.status === "late")) ? 1 : 0;

  const pendingLeaves = (await db.select({ c: sql<number>`count(*)` }).from(leaves).where(and(eq(leaves.employeeId, employeeId), eq(leaves.status, "pending"))))[0].c;
  const pendingPayroll = (await db.select({ c: sql<number>`count(*)` }).from(payroll).where(and(eq(payroll.employeeId, employeeId), eq(payroll.status, "pending"))))[0].c;

  const days: { date: string; present: number; absent: number; late: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    const row = myAttendance.find((r) => r.date === ds);
    days.push({
      date: ds,
      present: row?.status === "present" ? 1 : 0,
      late: row?.status === "late" ? 1 : 0,
      absent: row?.status === "absent" ? 1 : 0,
    });
  }

  return {
    totalEmployees: 1,
    activeEmployees: employee?.status === "active" ? 1 : 0,
    onLeaveToday: employee?.status === "on_leave" ? 1 : 0,
    presentToday,
    pendingLeaves,
    pendingPayroll,
    attendanceTrend: days,
    departmentBreakdown: dept ? [{ name: dept.name, color: dept.color, count: 1 }] : [],
  };
}
