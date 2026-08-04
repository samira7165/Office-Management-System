import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { employees, attendance, leaves, payroll, departments } from "@/lib/schema";
import { sql, eq } from "drizzle-orm";

export async function GET() {
  const totalEmployees = (await db.select({ c: sql<number>`count(*)` }).from(employees))[0].c;
  const activeEmployees = (await db.select({ c: sql<number>`count(*)` }).from(employees).where(eq(employees.status, "active")))[0].c;
  const onLeaveToday = (await db.select({ c: sql<number>`count(*)` }).from(employees).where(eq(employees.status, "on_leave")))[0].c;

  const today = new Date().toISOString().slice(0, 10);
  const presentToday = (await db.select({ c: sql<number>`count(*)` }).from(attendance).where(sql`${attendance.date} = ${today} AND ${attendance.status} IN ('present','late')`))[0].c;

  const pendingLeaves = (await db.select({ c: sql<number>`count(*)` }).from(leaves).where(eq(leaves.status, "pending")))[0].c;

  const pendingPayroll = (await db.select({ c: sql<number>`count(*)` }).from(payroll).where(eq(payroll.status, "pending")))[0].c;

  // attendance trend last 7 days
  const attRows = await db.select().from(attendance);
  const days: { date: string; present: number; absent: number; late: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    const dayRows = attRows.filter((r) => r.date === ds);
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
