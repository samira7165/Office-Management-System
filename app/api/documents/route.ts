import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents, employees } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const rows = await db
    .select({ d: documents, employee: employees })
    .from(documents)
    .leftJoin(employees, eq(documents.employeeId, employees.id))
    .orderBy(desc(documents.uploadDate));
  return NextResponse.json(rows.map((r) => ({ ...r.d, employee: r.employee })));
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.name) return NextResponse.json({ error: "Document name is required" }, { status: 400 });
  const [result] = await db.insert(documents).values({
    employeeId: body.employeeId || null,
    name: body.name,
    category: body.category || "general",
    uploadDate: new Date().toISOString().slice(0, 10),
    size: body.size || "—",
  });
  const [created] = await db.select().from(documents).where(eq(documents.id, result.insertId));
  return NextResponse.json(created, { status: 201 });
}
