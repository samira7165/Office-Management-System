import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clients, projects, invoices, transactions } from "@/lib/schema";
import { asc, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { checkAccess, applyScopeFilter } from "@/lib/authz";
import { parseClientInput, type ClientInput } from "@/lib/clients";
import { isRevenue } from "@/lib/finance";

export async function GET() {
  const session = await getSession();
  const { allowed } = await checkAccess(session, "CLIENTS", "VIEW");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const ctx = { employeeId: session!.employeeId, departmentId: session!.departmentId };
  const [clientRows, projectAccess, financeAccess] = await Promise.all([
    db.select().from(clients).orderBy(asc(clients.name)),
    checkAccess(session, "PROJECTS", "VIEW"),
    checkAccess(session, "FINANCE", "VIEW"),
  ]);

  // Project stats only count projects the caller is allowed to see (a dept head sees their
  // own department's work per client, not company-wide totals).
  const visibleProjects = projectAccess.allowed
    ? applyScopeFilter(await db.select().from(projects), projectAccess.scope, ctx, { departmentId: (p) => p.departmentId })
    : [];

  // Invoice totals are company finance — only for roles with company-wide FINANCE access.
  // Invoices store a client name (not an id), so they're matched by name, case-insensitively.
  const showFinance = financeAccess.allowed && financeAccess.scope === "ALL";
  const [invoiceRows, txRows] = showFinance
    ? await Promise.all([db.select().from(invoices), db.select().from(transactions)])
    : [[], []];

  const data = clientRows.map((c) => {
    const mine = visibleProjects.filter((p) => p.clientId === c.id);
    const live = mine.filter((p) => p.status !== "cancelled");
    const key = c.name.toLowerCase();
    const inv = invoiceRows.filter((i) => i.clientName.toLowerCase() === key);
    return {
      ...c,
      projectCount: mine.length,
      activeProjects: mine.filter((p) => p.status === "active").length,
      totalValue: live.reduce((s, p) => s + p.value, 0),
      invoices: showFinance
        ? {
            billed: inv.reduce((s, i) => s + i.amount, 0),
            outstanding: inv.filter((i) => i.status !== "paid").reduce((s, i) => s + i.amount, 0),
            // Cash In ledger entries linked to this client.
            received: txRows.filter((t) => t.clientId === c.id && isRevenue(t.type)).reduce((s, t) => s + t.amount, 0),
            // Still owed on advance deals: deal total − (advance + payments against it).
            dealDue: txRows
              .filter((t) => t.clientId === c.id && t.dealAmount != null)
              .reduce((s, d) => {
                const paid = d.amount + txRows.filter((p) => p.parentId === d.id).reduce((x, p) => x + p.amount, 0);
                return s + Math.max(0, d.dealAmount! - paid);
              }, 0),
          }
        : null,
    };
  });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const { allowed } = await checkAccess(session, "CLIENTS", "CREATE");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = parseClientInput(await req.json(), false);
  if (!parsed.data) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const input = parsed.data as ClientInput;

  const [dupe] = await db.select({ id: clients.id }).from(clients).where(sql`lower(${clients.name}) = lower(${input.name})`);
  if (dupe) return NextResponse.json({ error: `A client named "${input.name}" already exists`, id: dupe.id }, { status: 409 });

  const [created] = await db.insert(clients).values({
    name: input.name,
    type: input.type,
    contactPerson: input.contactPerson ?? "",
    email: input.email ?? "",
    phone: input.phone ?? "",
    address: input.address ?? "",
    notes: input.notes ?? "",
    createdAt: new Date().toISOString(),
  }).returning();
  return NextResponse.json(created, { status: 201 });
}
