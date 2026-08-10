import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { attendance, employees } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  const employeeId = req.nextUrl.searchParams.get("employeeId");
  const rows = await db
    .select({ a: attendance, employee: employees })
    .from(attendance)
    .leftJoin(employees, eq(attendance.employeeId, employees.id))
    .orderBy(desc(attendance.date));
  const data = rows
    .filter((r) => (date ? r.a.date === date : true))
    .filter((r) => (employeeId ? r.a.employeeId === Number(employeeId) : true))
    .map((r) => ({ ...r.a, employee: r.employee }));
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const body = await req.json();

  const isEmployee = session?.role === "employee";
  const employeeId = isEmployee ? session!.employeeId : body.employeeId;
  if (!employeeId || !body.date) {
    return NextResponse.json({ error: "Employee and date are required" }, { status: 400 });
  }

  const [result] = await db.insert(attendance).values({
    employeeId,
    date: body.date,
    checkIn: body.checkIn || null,
    checkOut: body.checkOut || null,
    status: body.status || "present",
    approvalStatus: isEmployee ? "pending" : "approved",
  });
  const [created] = await db.select().from(attendance).where(eq(attendance.id, result.insertId));
  return NextResponse.json(created, { status: 201 });
}
