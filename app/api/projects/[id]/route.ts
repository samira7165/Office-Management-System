import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects, transactions, projectInstallments } from "@/lib/schema";
import { and, eq, isNotNull } from "drizzle-orm";
import { getProjectPayments } from "@/lib/project-payments";
import { fmtTaka } from "@/lib/finance";
import { getSession } from "@/lib/auth";
import { checkAccess, isInScope } from "@/lib/authz";
import { parseProjectInput } from "@/lib/projects";
import { validateProjectRelations, applyClientLink } from "@/lib/projects-db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const { allowed, scope } = await checkAccess(session, "PROJECTS", "EDIT");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [existing] = await db.select().from(projects).where(eq(projects.id, Number(id)));
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ctx = { employeeId: session!.employeeId, departmentId: session!.departmentId };
  if (!isInScope(scope, ctx, { departmentId: existing.departmentId })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const clientErr = await applyClientLink(body);
  if (clientErr) return NextResponse.json({ error: clientErr }, { status: 400 });
  const parsed = parseProjectInput(body, true);
  if (!parsed.data) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const changes = parsed.data;

  // Department-scoped roles can't move a project out of their department.
  if (scope !== "ALL") delete changes.departmentId;

  const merged = { ...existing, ...changes };
  const check = await validateProjectRelations(merged.departmentId, merged.managerId, merged.startDate, merged.endDate);
  if (check) return NextResponse.json({ error: check }, { status: 400 });

  // The value can't drop below money already received or scheduled for this project.
  if (changes.value !== undefined && changes.value !== existing.value) {
    const pay = (await getProjectPayments([{ id: existing.id, value: changes.value }])).get(existing.id)!;
    if (changes.value + 0.005 < pay.received) {
      return NextResponse.json({ error: `Project value can't be less than the ${fmtTaka(pay.received)} already received` }, { status: 400 });
    }
    if (changes.value + 0.005 < pay.scheduled) {
      return NextResponse.json({ error: `Project value can't be less than the ${fmtTaka(pay.scheduled)} in the payment schedule` }, { status: 400 });
    }
  }

  if (Object.keys(changes).length > 0) {
    await db.update(projects).set(changes).where(eq(projects.id, Number(id)));
    // Keep the project's ledger deal in step with its value and client.
    const sync: { dealAmount?: number; clientId?: number | null } = {};
    if (changes.value !== undefined) sync.dealAmount = changes.value;
    if ("clientId" in changes) sync.clientId = changes.clientId ?? null;
    if (Object.keys(sync).length > 0) {
      await db.update(transactions).set(sync).where(and(eq(transactions.projectId, existing.id), isNotNull(transactions.dealAmount)));
    }
    if ("clientId" in changes) {
      await db.update(transactions).set({ clientId: changes.clientId ?? null }).where(eq(transactions.projectId, existing.id));
    }
  }
  const [updated] = await db.select().from(projects).where(eq(projects.id, Number(id)));
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  const { allowed } = await checkAccess(session, "PROJECTS", "DELETE");
  if (!allowed) return NextResponse.json({ error: "Not allowed to delete projects" }, { status: 403 });

  const { id } = await params;
  // Money already received stays in the Finance Ledger; it just stops pointing at the project.
  await db.update(transactions).set({ projectId: null, installmentId: null }).where(eq(transactions.projectId, Number(id)));
  await db.delete(projectInstallments).where(eq(projectInstallments.projectId, Number(id)));
  await db.delete(projects).where(eq(projects.id, Number(id)));
  return NextResponse.json({ ok: true });
}
