import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks, employees } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { checkAccess, applyScopeFilter, isInScope } from "@/lib/authz";

export async function GET() {
  const session = await getSession();
  const { allowed, scope } = await checkAccess(session, "TASKS", "VIEW");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await db
    .select({ t: tasks, assignee: employees })
    .from(tasks)
    .leftJoin(employees, eq(tasks.assigneeId, employees.id))
    .orderBy(desc(tasks.createdAt));
  let data = rows.map((r) => ({ ...r.t, assignee: r.assignee }));

  data = applyScopeFilter(data, scope, { employeeId: session!.employeeId, departmentId: session!.departmentId }, {
    employeeId: (r) => r.assigneeId,
    departmentId: (r) => r.assignee?.departmentId,
  });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const { allowed, scope } = await checkAccess(session, "TASKS", "CREATE");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  if (!body.title) return NextResponse.json({ error: "Task title is required" }, { status: 400 });

  const assigneeId = scope === "SELF" ? session!.employeeId : (body.assigneeId || null);

  if (scope === "DEPARTMENT" && assigneeId) {
    const [emp] = await db.select().from(employees).where(eq(employees.id, assigneeId));
    if (!isInScope(scope, { employeeId: session!.employeeId, departmentId: session!.departmentId }, { departmentId: emp?.departmentId ?? null })) {
      return NextResponse.json({ error: "Can only assign tasks within your own department" }, { status: 403 });
    }
  }

  const [created] = await db.insert(tasks).values({
    title: body.title,
    description: body.description || "",
    assigneeId,
    dueDate: body.dueDate || null,
    priority: body.priority || "medium",
    status: body.status || "todo",
    createdAt: new Date().toISOString(),
  }).returning();
  return NextResponse.json(created, { status: 201 });
}
