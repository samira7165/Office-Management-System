import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { payroll, employees } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { checkAccess, applyScopeFilter } from "@/lib/authz";

export async function GET() {
  const session = await getSession();
  const { allowed, scope } = await checkAccess(session, "PAYROLL", "VIEW");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await db
    .select({ p: payroll, employee: employees })
    .from(payroll)
    .leftJoin(employees, eq(payroll.employeeId, employees.id))
    .orderBy(desc(payroll.year), desc(payroll.month));
  let data = rows.map((r) => ({ ...r.p, employee: r.employee }));

  data = applyScopeFilter(data, scope, { employeeId: session!.employeeId, departmentId: session!.departmentId }, {
    employeeId: (r) => r.employeeId,
    departmentId: (r) => r.employee?.departmentId,
  });

  if (scope === "DEPARTMENT") {
    // "Summary only, no individual salaries" — collapse to one aggregated row per period.
    type Group = { month: number; year: number; basic: number; bonus: number; deduction: number; net: number; count: number; status: string };
    const groups = new Map<string, Group>();
    for (const r of data) {
      const key = `${r.year}-${r.month}`;
      const g = groups.get(key) || { month: r.month, year: r.year, basic: 0, bonus: 0, deduction: 0, net: 0, count: 0, status: "paid" };
      g.basic += r.basic;
      g.bonus += r.bonus;
      g.deduction += r.deduction;
      g.net += r.net;
      g.count += 1;
      if (r.status === "pending") g.status = "pending";
      groups.set(key, g);
    }
    const summary = Array.from(groups.values()).sort((a, b) => b.year - a.year || b.month - a.month);
    return NextResponse.json(summary.map((g, i) => ({ id: -(i + 1), ...g, employee: null, aggregated: true })));
  }

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const { allowed } = await checkAccess(session, "PAYROLL", "CREATE");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  if (!body.employeeId || !body.month || !body.year) {
    return NextResponse.json({ error: "Employee, month, and year are required" }, { status: 400 });
  }
  const basic = Number(body.basic || 0);
  const bonus = Number(body.bonus || 0);
  const deduction = Number(body.deduction || 0);
  const [created] = await db.insert(payroll).values({
    employeeId: body.employeeId,
    month: body.month,
    year: body.year,
    basic,
    bonus,
    deduction,
    net: basic + bonus - deduction,
    status: "pending",
  }).returning();
  return NextResponse.json(created, { status: 201 });
}
