import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leaves, employees } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const rows = await db
    .select({ l: leaves, employee: employees })
    .from(leaves)
    .leftJoin(employees, eq(leaves.employeeId, employees.id))
    .orderBy(desc(leaves.appliedOn));
  return NextResponse.json(rows.map((r) => ({ ...r.l, employee: r.employee })));
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.employeeId || !body.type || !body.startDate || !body.endDate) {
    return NextResponse.json({ error: "Employee, type, and dates are required" }, { status: 400 });
  }
  const [result] = await db.insert(leaves).values({
    employeeId: body.employeeId,
    type: body.type,
    startDate: body.startDate,
    endDate: body.endDate,
    reason: body.reason || "",
    status: "pending",
    appliedOn: new Date().toISOString(),
  });
  const [created] = await db.select().from(leaves).where(eq(leaves.id, result.insertId));
  return NextResponse.json(created, { status: 201 });
}
