import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { transactions } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const rows = await db.select().from(transactions).orderBy(desc(transactions.date));
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.type || !body.category || !body.amount || !body.date) {
    return NextResponse.json({ error: "Type, category, amount, and date are required" }, { status: 400 });
  }
  const [result] = await db.insert(transactions).values({
    type: body.type,
    category: body.category,
    description: body.description || "",
    amount: Number(body.amount),
    date: body.date,
    method: body.method || "bank",
    createdAt: new Date().toISOString(),
  });
  const [created] = await db.select().from(transactions).where(eq(transactions.id, result.insertId));
  return NextResponse.json(created, { status: 201 });
}
