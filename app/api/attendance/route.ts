import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { attendance, employees } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  const rows = await db
    .select({ a: attendance, employee: employees })
    .from(attendance)
    .leftJoin(employees, eq(attendance.employeeId, employees.id))
    .orderBy(desc(attendance.date));
  const data = rows
    .filter((r) => (date ? r.a.date === date : true))
    .map((r) => ({ ...r.a, employee: r.employee }));
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.employeeId || !body.date) {
    return NextResponse.json({ error: "Employee and date are required" }, { status: 400 });
  }
  const [result] = await db.insert(attendance).values({
    employeeId: body.employeeId,
    date: body.date,
    checkIn: body.checkIn || null,
    checkOut: body.checkOut || null,
    status: body.status || "present",
  });
  const [created] = await db.select().from(attendance).where(eq(attendance.id, result.insertId));
  return NextResponse.json(created, { status: 201 });
}
