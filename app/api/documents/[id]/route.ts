import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { db } from "@/lib/db";
import { documents } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
