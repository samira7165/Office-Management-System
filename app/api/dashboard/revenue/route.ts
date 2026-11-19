import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { transactions, invoices } from "@/lib/schema";
import { getSession } from "@/lib/auth";
import { checkAccess } from "@/lib/authz";
import { isRevenue, isSpending } from "@/lib/finance";

// Revenue analysis for the dashboard. Finance data isn't department-scoped, so only roles
// with company-wide FINANCE VIEW (scope ALL — i.e. SUPER_ADMIN today) can see it.
export async function GET() {
  const session = await getSession();
  const { allowed, scope } = await checkAccess(session, "FINANCE", "VIEW");
  if (!allowed || scope !== "ALL") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [txRows, invRows] = await Promise.all([
    db.select().from(transactions),
    db.select().from(invoices),
  ]);

  // Last 6 calendar months, oldest first, keyed "YYYY-MM" (dates are stored as YYYY-MM-DD strings).
  const now = new Date();
  const months: { key: string; label: string; income: number; expense: number; net: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push({ key, label: d.toLocaleString("en-US", { month: "short" }), income: 0, expense: 0, net: 0 });
  }
  const byKey = new Map(months.map((m) => [m.key, m]));
  for (const t of txRows) {
    const m = byKey.get(t.date.slice(0, 7));
    if (!m) continue;
    // Loans are money in but not revenue, so they're left out of income/expense/net here.
    if (isRevenue(t.type)) m.income += t.amount;
    else if (isSpending(t.type)) m.expense += t.amount;
  }
  for (const m of months) m.net = m.income - m.expense;

  const thisMonth = months[months.length - 1];
  const lastMonth = months[months.length - 2];
  const growthPct = lastMonth.income > 0 ? ((thisMonth.income - lastMonth.income) / lastMonth.income) * 100 : null;

  const today = now.toISOString().slice(0, 10);
  const isOverdue = (i: (typeof invRows)[number]) => i.status === "overdue" || (i.status === "unpaid" && i.dueDate < today);

  let paid = 0, outstanding = 0, overdue = 0, overdueCount = 0;
  const clients = new Map<string, { name: string; billed: number; paid: number }>();
  for (const i of invRows) {
    if (i.status === "paid") paid += i.amount;
    else {
      outstanding += i.amount;
      if (isOverdue(i)) { overdue += i.amount; overdueCount++; }
    }
    const c = clients.get(i.clientName) ?? { name: i.clientName, billed: 0, paid: 0 };
    c.billed += i.amount;
    if (i.status === "paid") c.paid += i.amount;
    clients.set(i.clientName, c);
  }
  const billed = paid + outstanding;

  return NextResponse.json({
    thisMonth: { income: thisMonth.income, expense: thisMonth.expense, net: thisMonth.net },
    growthPct,
    trend: months,
    invoices: {
      billed,
      paid,
      outstanding,
      overdue,
      overdueCount,
      collectionRate: billed > 0 ? (paid / billed) * 100 : null,
    },
    topClients: [...clients.values()].sort((a, b) => b.billed - a.billed).slice(0, 5),
  });
}
