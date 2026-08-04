import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { invoices } from "@/lib/schema";
import { eq, desc, sql } from "drizzle-orm";

export async function GET() {
  // auto-flip unpaid invoices past due date to overdue, for display consistency
  const today = new Date().toISOString().slice(0, 10);
  await db.execute(
    sql`UPDATE invoices SET status = 'overdue' WHERE status = 'unpaid' AND due_date < ${today}`
  );
  const rows = await db.select().from(invoices).orderBy(desc(invoices.issueDate));
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.clientName || !body.amount || !body.issueDate || !body.dueDate) {
    return NextResponse.json({ error: "Client, amount, issue date, and due date are required" }, { status: 400 });
  }
  const invoiceNo = `INV-${Date.now().toString().slice(-8)}`;
  const [result] = await db.insert(invoices).values({
    invoiceNo,
    clientName: body.clientName,
    clientEmail: body.clientEmail || "",
    amount: Number(body.amount),
    issueDate: body.issueDate,
    dueDate: body.dueDate,
    status: "unpaid",
    notes: body.notes || "",
    createdAt: new Date().toISOString(),
  });
  const [created] = await db.select().from(invoices).where(eq(invoices.id, result.insertId));
  return NextResponse.json(created, { status: 201 });
}
