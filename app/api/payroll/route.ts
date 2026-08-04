import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { payroll, employees } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const rows = await db
    .select({ p: payroll, employee: employees })
    .from(payroll)
    .leftJoin(employees, eq(payroll.employeeId, employees.id))
    .orderBy(desc(payroll.year), desc(payroll.month));
  return NextResponse.json(rows.map((r) => ({ ...r.p, employee: r.employee })));
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.employeeId || !body.month || !body.year) {
    return NextResponse.json({ error: "Employee, month, and year are required" }, { status: 400 });
  }
  const basic = Number(body.basic || 0);
  const bonus = Number(body.bonus || 0);
  const deduction = Number(body.deduction || 0);
  const [result] = await db.insert(payroll).values({
    employeeId: body.employeeId,
    month: body.month,
    year: body.year,
    basic,
    bonus,
    deduction,
    net: basic + bonus - deduction,
    status: "pending",
  });
  const [created] = await db.select().from(payroll).where(eq(payroll.id, result.insertId));
  return NextResponse.json(created, { status: 201 });
}
