import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks, employees } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function GET() {
  const rows = await db
    .select({ t: tasks, assignee: employees })
    .from(tasks)
    .leftJoin(employees, eq(tasks.assigneeId, employees.id))
    .orderBy(desc(tasks.createdAt));
  return NextResponse.json(rows.map((r) => ({ ...r.t, assignee: r.assignee })));
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const body = await req.json();
  if (!body.title) return NextResponse.json({ error: "Task title is required" }, { status: 400 });

  const isEmployee = session?.role === "employee";
  const assigneeId = isEmployee ? session!.employeeId : (body.assigneeId || null);

  const [result] = await db.insert(tasks).values({
    title: body.title,
    description: body.description || "",
    assigneeId,
    dueDate: body.dueDate || null,
    priority: body.priority || "medium",
    status: body.status || "todo",
    createdAt: new Date().toISOString(),
  });
  const [created] = await db.select().from(tasks).where(eq(tasks.id, result.insertId));
  return NextResponse.json(created, { status: 201 });
}
