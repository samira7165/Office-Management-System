import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { db } from "@/lib/db";
import { documents } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { checkAccess } from "@/lib/authz";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  const { allowed } = await checkAccess(session, "DOCUMENTS", "DELETE");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const [doc] = await db.select().from(documents).where(eq(documents.id, Number(id)));
  if (doc?.url) {
    try {
      await del(doc.url);
    } catch {
      // blob already gone or unreachable — still remove the DB record
    }
  }
  await db.delete(documents).where(eq(documents.id, Number(id)));
  return NextResponse.json({ ok: true });
}
