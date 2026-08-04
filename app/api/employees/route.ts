import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { employees, departments } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const rows = await db.select().from(employees).leftJoin(departments, eq(employees.departmentId, departments.id));
  const data = rows.map((r) => ({ ...r.employees, department: r.departments }));
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.name || !body.email || !body.position) {
    return NextResponse.json({ error: "Name, email, and position are required" }, { status: 400 });
  }
  const colors = ["#6C5DD3", "#3DB2FF", "#F6A723", "#1DBF73", "#F45252", "#8B5CF6", "#EC4899"];
  const [result] = await db.insert(employees).values({
    name: body.name,
    email: body.email,
    phone: body.phone || "",
    position: body.position,
    departmentId: body.departmentId || null,
    joinDate: body.joinDate || new Date().toISOString().slice(0, 10),
    status: body.status || "active",
    avatarColor: colors[Math.floor(Math.random() * colors.length)],
    baseSalary: body.baseSalary || 0,
    address: body.address || "",
  });
  const [created] = await db.select().from(employees).where(eq(employees.id, result.insertId));
  return NextResponse.json(created, { status: 201 });
}
