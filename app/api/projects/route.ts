import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects, departments, employees } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { checkAccess, applyScopeFilter } from "@/lib/authz";
import { parseProjectInput, isLongTerm, type ProjectInput } from "@/lib/projects";
import { validateProjectRelations } from "@/lib/projects-db";

export async function GET() {
  const session = await getSession();
  const { allowed, scope } = await checkAccess(session, "PROJECTS", "VIEW");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await db
    .select({ p: projects, department: departments, manager: employees })
    .from(projects)
    .leftJoin(departments, eq(projects.departmentId, departments.id))
    .leftJoin(employees, eq(projects.managerId, employees.id))
    .orderBy(desc(projects.startDate));

  let data = rows.map((r) => ({
    ...r.p,
    longTerm: isLongTerm(r.p.startDate, r.p.endDate),
    department: r.department ? { id: r.department.id, name: r.department.name, color: r.department.color } : null,
    manager: r.manager ? { id: r.manager.id, name: r.manager.name } : null,
  }));

  data = applyScopeFilter(data, scope, { employeeId: session!.employeeId, departmentId: session!.departmentId }, {
    departmentId: (r) => r.departmentId,
  });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const { allowed, scope } = await checkAccess(session, "PROJECTS", "CREATE");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = parseProjectInput(await req.json(), false);
  if (!parsed.data) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const input = parsed.data as ProjectInput;

  // Department-scoped roles can only create projects for their own department.
  const departmentId = scope === "ALL" ? input.departmentId ?? null : session!.departmentId;
  const check = await validateProjectRelations(departmentId, input.managerId ?? null, input.startDate, input.endDate ?? null);
  if (check) return NextResponse.json({ error: check }, { status: 400 });

  const [created] = await db.insert(projects).values({
    name: input.name,
    description: input.description ?? "",
    clientName: input.clientName,
    clientType: input.clientType,
    clientEmail: input.clientEmail ?? "",
    value: input.value,
    startDate: input.startDate,
    endDate: input.endDate ?? null,
    status: input.status,
    departmentId,
    managerId: input.managerId ?? null,
    createdAt: new Date().toISOString(),
  }).returning();
  return NextResponse.json(created, { status: 201 });
}
