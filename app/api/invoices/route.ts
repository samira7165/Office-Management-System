import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { invoices } from "@/lib/schema";
import { desc, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { checkAccess, applyScopeFilter } from "@/lib/authz";

export async function GET() {
  const session = await getSession();
  const { allowed, scope } = await checkAccess(session, "FINANCE", "VIEW");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // auto-flip unpaid invoices past due date to overdue, for display consistency
  const today = new Date().toISOString().slice(0, 10);
  await db.execute(
    sql`UPDATE invoices SET status = 'overdue' WHERE status = 'unpaid' AND due_date < ${today}`
  );
  const rows = await db.select().from(invoices).orderBy(desc(invoices.issueDate));
  const data = applyScopeFilter(rows, scope, { employeeId: session!.employeeId, departmentId: session!.departmentId }, {});
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const { allowed, scope } = await checkAccess(session, "FINANCE", "CREATE");
  if (!allowed || scope !== "ALL") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  if (!body.clientName || !body.amount || !body.issueDate || !body.dueDate) {
    return NextResponse.json({ error: "Client, amount, issue date, and due date are required" }, { status: 400 });
  }
  const invoiceNo = `INV-${Date.now().toString().slice(-8)}`;
  const [created] = await db.insert(invoices).values({
    invoiceNo,
    clientName: body.clientName,
    clientEmail: body.clientEmail || "",
    amount: Number(body.amount),
    issueDate: body.issueDate,
    dueDate: body.dueDate,
    status: "unpaid",
    notes: body.notes || "",
    createdAt: new Date().toISOString(),
  }).returning();
  return NextResponse.json(created, { status: 201 });
}
