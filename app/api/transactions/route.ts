import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { db } from "@/lib/db";
import { transactions, clients, projects, projectInstallments } from "@/lib/schema";
import { desc, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { checkAccess, applyScopeFilter } from "@/lib/authz";
import { parseTxInput, receiptProblem, publicTx, type TxInput } from "@/lib/finance";
import { checkDealRules } from "@/lib/finance-db";

export async function GET() {
  const session = await getSession();
  const { allowed, scope } = await checkAccess(session, "FINANCE", "VIEW");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const joined = await db
    .select({ t: transactions, client: clients, project: { id: projects.id, name: projects.name }, installment: { label: projectInstallments.label } })
    .from(transactions)
    .leftJoin(clients, eq(transactions.clientId, clients.id))
    .leftJoin(projects, eq(transactions.projectId, projects.id))
    .leftJoin(projectInstallments, eq(transactions.installmentId, projectInstallments.id))
    .orderBy(desc(transactions.date), desc(transactions.id));
  // Advance deals: total received = the deal row's own advance + every payment linked to it.
  const paidLater = new Map<number, number>();
  for (const { t } of joined) if (t.parentId) paidLater.set(t.parentId, (paidLater.get(t.parentId) ?? 0) + t.amount);
  const byId = new Map(joined.map(({ t }) => [t.id, t]));

  const rows = joined.map((r) => {
    const t = r.t;
    const deal = t.dealAmount != null
      ? (() => {
          const received = Math.round((t.amount + (paidLater.get(t.id) ?? 0)) * 100) / 100;
          return { received, due: Math.max(0, Math.round((t.dealAmount - received) * 100) / 100), payments: joined.filter((x) => x.t.parentId === t.id).length };
        })()
      : null;
    const parent = t.parentId ? byId.get(t.parentId) : undefined;
    return {
      ...t,
      client: r.client ? { id: r.client.id, name: r.client.name, type: r.client.type } : null,
      deal,
      parent: parent ? { id: parent.id, date: parent.date, category: parent.category, description: parent.description, dealAmount: parent.dealAmount } : null,
      project: r.project?.id ? { id: r.project.id, name: r.project.name, installment: r.installment?.label ?? null } : null,
    };
  });
  // Company transactions have no per-employee/department owner column, so anything short
  // of "ALL" scope (e.g. HR's FINANCE VIEW(SELF)) resolves to nothing visible here — HR's
  // own finance visibility is through the payroll module, which they do have in full.
  const data = applyScopeFilter(rows, scope, { employeeId: session!.employeeId, departmentId: session!.departmentId }, {});
  return NextResponse.json(data.map(publicTx));
}

// Accepts multipart/form-data (so a receipt image can come with the entry) or plain JSON.
export async function POST(req: NextRequest) {
  const session = await getSession();
  const { allowed, scope } = await checkAccess(session, "FINANCE", "CREATE");
  // DEPT_HEAD's FINANCE CREATE(DEPARTMENT) is reserved for a future "expense request"
  // workflow — company ledger transactions stay ALL-scope (SUPER_ADMIN) only for now.
  if (!allowed || scope !== "ALL") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let get: (k: string) => unknown;
  let has: (k: string) => boolean;
  let receipt: File | null = null;
  if ((req.headers.get("content-type") || "").includes("multipart/form-data")) {
    const form = await req.formData();
    get = (k) => form.get(k);
    has = (k) => form.has(k);
    const f = form.get("receipt");
    if (f instanceof File && f.size > 0) receipt = f;
  } else {
    const body = await req.json();
    get = (k) => body[k];
    has = (k) => k in body;
  }

  const parsed = parseTxInput(get, has, false);
  if (!parsed.data) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const input = parsed.data as TxInput;

  const rules = await checkDealRules({
    type: input.type, amount: input.amount, clientId: input.clientId ?? null,
    dealAmount: input.dealAmount ?? null, parentId: input.parentId ?? null,
  });
  if (rules.error) return NextResponse.json({ error: rules.error }, { status: 400 });
  // A payment against a deal always belongs to the deal's client.
  const clientId = input.parentId ? rules.clientId ?? null : input.clientId ?? null;

  let receiptUrl: string | null = null;
  if (receipt) {
    const problem = receiptProblem(receipt);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });
    const blob = await put(`receipts/${Date.now()}-${receipt.name}`, receipt, { access: "private", contentType: receipt.type });
    receiptUrl = blob.url;
  }

  const [created] = await db.insert(transactions).values({
    type: input.type,
    category: input.category,
    description: input.description ?? "",
    amount: input.amount,
    date: input.date,
    account: input.account ?? "",
    clientId,
    // A payment against a project's deal counts toward that project too.
    projectId: input.parentId ? rules.projectId ?? null : null,
    dealAmount: input.dealAmount ?? null,
    parentId: input.parentId ?? null,
    receiptUrl,
    receiptName: receipt ? receipt.name.slice(0, 191) : null,
    createdAt: new Date().toISOString(),
  }).returning();
  return NextResponse.json(publicTx(created), { status: 201 });
}
