import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects, departments, employees, projectInstallments } from "@/lib/schema";
import {
  canSeeProjectMoney, getProjectPayments, recordProjectPayment, parseInstallment, type InstallmentInput,
} from "@/lib/project-payments";
import { eq, desc } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { checkAccess, applyScopeFilter } from "@/lib/authz";
import { parseProjectInput, isLongTerm, type ProjectInput } from "@/lib/projects";
import { validateProjectRelations, applyClientLink } from "@/lib/projects-db";

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

  // Received / due / schedule only for company-wide finance roles.
  if (await canSeeProjectMoney(session)) {
    const money = await getProjectPayments(data);
    return NextResponse.json(data.map((p) => ({ ...p, payments: money.get(p.id) ?? null })));
  }
  return NextResponse.json(data.map((p) => ({ ...p, payments: null })));
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const { allowed, scope } = await checkAccess(session, "PROJECTS", "CREATE");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const clientErr = await applyClientLink(body);
  if (clientErr) return NextResponse.json({ error: clientErr }, { status: 400 });
  const parsed = parseProjectInput(body, false);
  if (!parsed.data) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const input = parsed.data as ProjectInput;

  // Department-scoped roles can only create projects for their own department.
  const departmentId = scope === "ALL" ? input.departmentId ?? null : session!.departmentId;
  const check = await validateProjectRelations(departmentId, input.managerId ?? null, input.startDate, input.endDate ?? null);
  if (check) return NextResponse.json({ error: check }, { status: 400 });

  // Optional money parts: an advance already received and a schedule of expected installments.
  const wantsMoney = (body.advance && Number(body.advance.amount) > 0) || (Array.isArray(body.schedule) && body.schedule.length > 0);
  if (wantsMoney && !(await canSeeProjectMoney(session, "CREATE"))) {
    return NextResponse.json({ error: "Only finance admins can record advances and payment schedules" }, { status: 403 });
  }
  const schedule: InstallmentInput[] = [];
  for (const raw of Array.isArray(body.schedule) ? body.schedule : []) {
    const parsedInst = parseInstallment(raw);
    if ("error" in parsedInst) return NextResponse.json({ error: parsedInst.error }, { status: 400 });
    schedule.push(parsedInst.data);
  }
  let advance: { amount: number; date: string; account: string } | null = null;
  if (body.advance && Number(body.advance.amount) > 0) {
    advance = { amount: Number(body.advance.amount), date: String(body.advance.date || ""), account: String(body.advance.account || "") };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(advance.date)) return NextResponse.json({ error: "Advance date is required" }, { status: 400 });
    if (advance.amount > input.value) return NextResponse.json({ error: "Advance can't be more than the project value" }, { status: 400 });
    if (!input.clientId) return NextResponse.json({ error: "Choose the client who paid the advance" }, { status: 400 });
  }
  const planned = schedule.reduce((s, i) => s + i.amount, 0) + (advance?.amount ?? 0);
  if (planned > input.value + 0.005) {
    return NextResponse.json({ error: "Advance plus scheduled payments can't add up to more than the project value" }, { status: 400 });
  }

  const [created] = await db.insert(projects).values({
    name: input.name,
    description: input.description ?? "",
    clientId: input.clientId ?? null,
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

  if (advance || schedule.length > 0) {
    const now = new Date().toISOString();
    const items = [
      ...(advance ? [{ label: "Advance", amount: advance.amount, dueDate: advance.date }] : []),
      ...schedule,
    ];
    const inst = await db.insert(projectInstallments)
      .values(items.map((i) => ({ ...i, projectId: created.id, createdAt: now })))
      .returning({ id: projectInstallments.id });
    if (advance) {
      const res = await recordProjectPayment(created.id, {
        amount: advance.amount, date: advance.date, account: advance.account, installmentId: inst[0].id,
        description: `Advance: ${created.name}`,
      });
      if ("error" in res) {
        // Don't leave a half-created project behind.
        await db.delete(projectInstallments).where(eq(projectInstallments.projectId, created.id));
        await db.delete(projects).where(eq(projects.id, created.id));
        return NextResponse.json({ error: res.error }, { status: 400 });
      }
    }
  }
  return NextResponse.json(created, { status: 201 });
}
