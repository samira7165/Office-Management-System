import { NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { db } from "@/lib/db";
import { documents } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [doc] = await db.select().from(documents).where(eq(documents.id, Number(id)));
  if (!doc?.url) return NextResponse.json({ error: "No file attached to this document" }, { status: 404 });

  const result = await get(doc.url, { access: "private" });
  if (!result?.stream) return NextResponse.json({ error: "File not found" }, { status: 404 });

  return new NextResponse(result.stream, {
    headers: {
      "Content-Type": result.blob.contentType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${doc.name}"`,
    },
  });
}
