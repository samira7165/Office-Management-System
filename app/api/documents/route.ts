import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { db } from "@/lib/db";
import { documents, employees } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function GET() {
  const rows = await db
    .select({ d: documents, employee: employees })
    .from(documents)
    .leftJoin(employees, eq(documents.employeeId, employees.id))
    .orderBy(desc(documents.uploadDate));
  return NextResponse.json(rows.map((r) => ({ ...r.d, employee: r.employee })));
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file") as File | null;
  const name = (form.get("name") as string) || file?.name;
  const employeeId = form.get("employeeId") ? Number(form.get("employeeId")) : null;
  const category = (form.get("category") as string) || "general";

  if (!file || !name) {
    return NextResponse.json({ error: "A file and document name are required" }, { status: 400 });
  }

  const pathname = `documents/${Date.now()}-${file.name}`;
  const blob = await put(pathname, file, { access: "private", contentType: file.type || undefined });

  const [result] = await db.insert(documents).values({
    employeeId,
    name,
    category,
    uploadDate: new Date().toISOString().slice(0, 10),
    size: formatSize(file.size),
    url: blob.url,
  });
  const [created] = await db.select().from(documents).where(eq(documents.id, result.insertId));
  return NextResponse.json(created, { status: 201 });
}
