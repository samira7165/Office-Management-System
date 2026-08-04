import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { departments, employees } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";

const head = alias(employees, "head");

export async function GET() {
  const rows = await db
    .select({
      id: departments.id,
      name: departments.name,
      description: departments.description,
      color: departments.color,
      headEmployeeId: departments.headEmployeeId,
      budget: departments.budget,
      headcount: sql<number>`count(distinct ${employees.id})`,
      head: { id: head.id, name: head.name, avatarColor: head.avatarColor },
    })
    .from(departments)
    .leftJoin(employees, eq(employees.departmentId, departments.id))
    .leftJoin(head, eq(head.id, departments.headEmployeeId))
    .groupBy(departments.id, head.id);
  return NextResponse.json(rows.map((r) => ({ ...r, head: r.head?.id ? r.head : null })));
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.name) return NextResponse.json({ error: "Department name is required" }, { status: 400 });
  const [result] = await db.insert(departments).values({
    name: body.name,
    description: body.description || "",
    color: body.color || "#6C5DD3",
    headEmployeeId: body.headEmployeeId || null,
    budget: Number(body.budget || 0),
  });
  const [created] = await db.select().from(departments).where(eq(departments.id, result.insertId));
  return NextResponse.json(created, { status: 201 });
}
