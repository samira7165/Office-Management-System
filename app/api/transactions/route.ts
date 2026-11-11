import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { transactions } from "@/lib/schema";
import { desc } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { checkAccess, applyScopeFilter } from "@/lib/authz";

export async function GET() {
  const session = await getSession();
  const { allowed, scope } = await checkAccess(session, "FINANCE", "VIEW");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await db.select().from(transactions).orderBy(desc(transactions.date));
  // Company transactions have no per-employee/department owner column, so anything short
  // of "ALL" scope (e.g. HR's FINANCE VIEW(SELF)) resolves to nothing visible here — HR's
  // own finance visibility is through the payroll module, which they do have in full.
  const data = applyScopeFilter(rows, scope, { employeeId: session!.employeeId, departmentId: session!.departmentId }, {});
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const { allowed, scope } = await checkAccess(session, "FINANCE", "CREATE");
  // DEPT_HEAD's FINANCE CREATE(DEPARTMENT) is reserved for a future "expense request"
  // workflow — company ledger transactions stay ALL-scope (SUPER_ADMIN) only for now.
  if (!allowed || scope !== "ALL") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  if (!body.type || !body.category || !body.amount || !body.date) {
    return NextResponse.json({ error: "Type, category, amount, and date are required" }, { status: 400 });
  }
  const [created] = await db.insert(transactions).values({
    type: body.type,
    category: body.category,
    description: body.description || "",
    amount: Number(body.amount),
    date: body.date,
    method: body.method || "bank",
    createdAt: new Date().toISOString(),
  }).returning();
  return NextResponse.json(created, { status: 201 });
}
