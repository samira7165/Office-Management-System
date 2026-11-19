import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects, projectInstallments, transactions } from "@/lib/schema";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { canSeeProjectMoney, getProjectPayments, parseInstallment } from "@/lib/project-payments";
import { fmtTaka } from "@/lib/finance";

type Params = { params: Promise<{ id: string; installmentId: string }> };

async function load(params: Params["params"]) {
  const { id, installmentId } = await params;
  const [inst] = await db.select().from(projectInstallments)
    .where(and(eq(projectInstallments.id, Number(installmentId)), eq(projectInstallments.projectId, Number(id))));
  const [project] = inst ? await db.select().from(projects).where(eq(projects.id, inst.projectId)) : [];
  return { inst, project };
}

/** Change an installment's name, amount or expected date. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!(await canSeeProjectMoney(session, "EDIT"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { inst, project } = await load(params);
  if (!inst || !project) return NextResponse.json({ error: "Installment not found" }, { status: 404 });

  const parsed = parseInstallment({ label: inst.label, amount: inst.amount, dueDate: inst.dueDate, ...(await req.json()) });
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const pay = (await getProjectPayments([project])).get(project.id)!;
  const paidHere = pay.installments.find((i) => i.id === inst.id)?.paid ?? 0;
  if (parsed.data.amount + 0.005 < paidHere) {
    return NextResponse.json({ error: `This installment already has ${fmtTaka(paidHere)} paid against it` }, { status: 400 });
  }
  const otherScheduled = pay.scheduled - inst.amount;
  if (otherScheduled + parsed.data.amount > project.value + 0.005) {
    return NextResponse.json({ error: `Only ${fmtTaka(project.value - otherScheduled)} can be scheduled here without going over the project value` }, { status: 400 });
  }
  const [updated] = await db.update(projectInstallments).set(parsed.data).where(eq(projectInstallments.id, inst.id)).returning();
  return NextResponse.json(updated);
}

/** Remove an installment from the schedule. Payments made against it stay, just unassigned. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!(await canSeeProjectMoney(session, "EDIT"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { inst } = await load(params);
  if (!inst) return NextResponse.json({ error: "Installment not found" }, { status: 404 });
  await db.update(transactions).set({ installmentId: null }).where(eq(transactions.installmentId, inst.id));
  await db.delete(projectInstallments).where(eq(projectInstallments.id, inst.id));
  return NextResponse.json({ ok: true });
}
