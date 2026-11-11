import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { db } from "@/lib/db";
import { documents, employees } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { checkAccess, applyScopeFilter, isInScope } from "@/lib/authz";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function GET() {
  const session = await getSession();
  const { allowed, scope } = await checkAccess(session, "DOCUMENTS", "VIEW");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await db
    .select({ d: documents, employee: employees })
    .from(documents)
    .leftJoin(employees, eq(documents.employeeId, employees.id))
    .orderBy(desc(documents.uploadDate));
  let data = rows.map((r) => ({ ...r.d, employee: r.employee }));

  data = applyScopeFilter(data, scope, { employeeId: session!.employeeId, departmentId: session!.departmentId }, {
    employeeId: (r) => r.employeeId,
    departmentId: (r) => r.employee?.departmentId,
  });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const { allowed, scope } = await checkAccess(session, "DOCUMENTS", "CREATE");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const name = (form.get("name") as string) || file?.name;
  const category = (form.get("category") as string) || "general";
  const employeeId = scope === "SELF" ? session!.employeeId : (form.get("employeeId") ? Number(form.get("employeeId")) : null);

  if (!file || !name) {
    return NextResponse.json({ error: "A file and document name are required" }, { status: 400 });
  }

  if (scope === "DEPARTMENT" && employeeId) {
    const [emp] = await db.select().from(employees).where(eq(employees.id, employeeId));
    if (!isInScope(scope, { employeeId: session!.employeeId, departmentId: session!.departmentId }, { departmentId: emp?.departmentId ?? null })) {
      return NextResponse.json({ error: "Can only upload documents within your own department" }, { status: 403 });
    }
  }

  const pathname = `documents/${Date.now()}-${file.name}`;
  const blob = await put(pathname, file, { access: "private", contentType: file.type || undefined });

  const [created] = await db.insert(documents).values({
    employeeId,
    name,
    category,
    uploadDate: new Date().toISOString().slice(0, 10),
    size: formatSize(file.size),
    url: blob.url,
  }).returning();
  return NextResponse.json(created, { status: 201 });
}
