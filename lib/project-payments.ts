import { db } from "@/lib/db";
import { transactions, projectInstallments, projects } from "@/lib/schema";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { isRevenue, fmtTaka } from "@/lib/finance";
import type { SessionPayload } from "@/lib/auth";
import { checkAccess } from "@/lib/authz";

const r2 = (n: number) => Math.round(n * 100) / 100;
const EPS = 0.005;

export type InstallmentStatus = "paid" | "partly_paid" | "overdue" | "upcoming";

export type ProjectPayments = {
  received: number; due: number; scheduled: number; unscheduled: number;
  dealId: number | null;
  installments: { id: number; label: string; amount: number; dueDate: string; paid: number; status: InstallmentStatus }[];
  nextDue: { id: number; label: string; remaining: number; dueDate: string; overdue: boolean } | null;
  payments: { id: number; amount: number; date: string; account: string | null; description: string | null; installmentId: number | null; hasReceipt: boolean }[];
};

/** Payment info is company finance — only for roles with company-wide FINANCE access. */
export async function canSeeProjectMoney(session: SessionPayload | null, action: "VIEW" | "CREATE" | "EDIT" = "VIEW") {
  const { allowed, scope } = await checkAccess(session, "FINANCE", action);
  return allowed && scope === "ALL";
}

/** Received / due / schedule status for each project, computed from the ledger. */
export async function getProjectPayments(projectRows: { id: number; value: number }[]): Promise<Map<number, ProjectPayments>> {
  const ids = projectRows.map((p) => p.id);
  const out = new Map<number, ProjectPayments>();
  if (ids.length === 0) return out;

  const [txRows, instRows] = await Promise.all([
    db.select().from(transactions).where(inArray(transactions.projectId, ids)),
    db.select().from(projectInstallments).where(inArray(projectInstallments.projectId, ids)),
  ]);
  const today = new Date().toISOString().slice(0, 10);

  for (const p of projectRows) {
    const pays = txRows.filter((t) => t.projectId === p.id && isRevenue(t.type)).sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
    const received = r2(pays.reduce((s, t) => s + t.amount, 0));
    const installments = instRows
      .filter((i) => i.projectId === p.id)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id - b.id)
      .map((i) => {
        const paid = r2(pays.filter((t) => t.installmentId === i.id).reduce((s, t) => s + t.amount, 0));
        const status: InstallmentStatus =
          paid >= i.amount - EPS ? "paid" : paid > 0 ? "partly_paid" : i.dueDate < today ? "overdue" : "upcoming";
        return { id: i.id, label: i.label, amount: i.amount, dueDate: i.dueDate, paid, status };
      });
    const scheduled = r2(installments.reduce((s, i) => s + i.amount, 0));
    const open = installments.find((i) => i.status !== "paid");
    out.set(p.id, {
      received,
      due: Math.max(0, r2(p.value - received)),
      scheduled,
      unscheduled: Math.max(0, r2(p.value - scheduled)),
      dealId: pays.find((t) => t.dealAmount != null)?.id ?? null,
      installments,
      nextDue: open
        ? { id: open.id, label: open.label, remaining: r2(open.amount - open.paid), dueDate: open.dueDate, overdue: open.dueDate < today && open.paid < open.amount }
        : null,
      payments: pays.map((t) => ({
        id: t.id, amount: t.amount, date: t.date, account: t.account, description: t.description,
        installmentId: t.installmentId, hasReceipt: !!t.receiptUrl,
      })),
    });
  }
  return out;
}

export type PaymentInput = { amount: number; date: string; account?: string; description?: string; installmentId?: number | null };

/**
 * Record money received for a project in the Finance Ledger. The first payment becomes the
 * project's "deal" row (dealAmount = project value); later ones are payments against it, so
 * the Finance page shows the same received / due figures as the project.
 */
export async function recordProjectPayment(projectId: number, input: PaymentInput): Promise<{ error: string } | { id: number }> {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) return { error: "Project not found" };
  if (!(input.amount > 0)) return { error: "Payment amount must be more than 0" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return { error: "Payment date is required" };

  let label = "Payment";
  if (input.installmentId) {
    const [inst] = await db.select().from(projectInstallments)
      .where(and(eq(projectInstallments.id, input.installmentId), eq(projectInstallments.projectId, projectId)));
    if (!inst) return { error: "That installment isn't part of this project" };
    label = inst.label;
  }

  const summary = (await getProjectPayments([project])).get(project.id)!;
  if (input.amount > summary.due + EPS) {
    return { error: summary.due <= EPS ? "This project is already fully paid" : `This is more than the ${fmtTaka(summary.due)} still due on the project` };
  }

  const [deal] = await db.select().from(transactions)
    .where(and(eq(transactions.projectId, projectId), isNotNull(transactions.dealAmount)));

  const [created] = await db.insert(transactions).values({
    type: "cash_in",
    category: "Client",
    description: (input.description || `${label}: ${project.name}`).slice(0, 255),
    amount: r2(input.amount),
    date: input.date,
    account: (input.account || "").slice(0, 64),
    clientId: project.clientId,
    projectId,
    installmentId: input.installmentId ?? null,
    dealAmount: deal ? null : project.value,
    parentId: deal ? deal.id : null,
    createdAt: new Date().toISOString(),
  }).returning({ id: transactions.id });
  return { id: created.id };
}

export type InstallmentInput = { label: string; amount: number; dueDate: string };

export function parseInstallment(raw: unknown): { data: InstallmentInput } | { error: string } {
  const o = (raw ?? {}) as Record<string, unknown>;
  const label = typeof o.label === "string" ? o.label.trim().slice(0, 100) : "";
  const amount = r2(Number(o.amount));
  const dueDate = typeof o.dueDate === "string" ? o.dueDate.trim() : "";
  if (!label) return { error: "Each installment needs a name" };
  if (!Number.isFinite(amount) || amount <= 0) return { error: `Installment "${label}" needs an amount more than 0` };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return { error: `Installment "${label}" needs an expected date` };
  return { data: { label, amount, dueDate } };
}
