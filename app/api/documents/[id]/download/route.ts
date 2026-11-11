import { NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { db } from "@/lib/db";
import { documents } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { checkAccess, isInScope, getEmployeeDepartmentId } from "@/lib/authz";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const [doc] = await db.select().from(documents).where(eq(documents.id, Number(id)));
  if (!doc?.url) return NextResponse.json({ error: "No file attached to this document" }, { status: 404 });

  const { allowed, scope } = await checkAccess(session, "DOCUMENTS", "VIEW");
  const targetDeptId = await getEmployeeDepartmentId(doc.employeeId);
  if (!allowed || !isInScope(scope, { employeeId: session!.employeeId, departmentId: session!.departmentId }, { employeeId: doc.employeeId, departmentId: targetDeptId })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await get(doc.url, { access: "private" });
  if (!result?.stream) return NextResponse.json({ error: "File not found" }, { status: 404 });

  return new NextResponse(result.stream, {
    headers: {
      "Content-Type": result.blob.contentType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${doc.name}"`,
    },
  });
}
