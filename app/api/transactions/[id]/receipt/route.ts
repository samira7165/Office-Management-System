import { NextRequest, NextResponse } from "next/server";
import { get, put, del } from "@vercel/blob";
import { db } from "@/lib/db";
import { transactions } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { checkAccess } from "@/lib/authz";
import { receiptProblem } from "@/lib/finance";

/** View a transaction's receipt inline (opens in a new tab). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  const { allowed, scope } = await checkAccess(session, "FINANCE", "VIEW");
  if (!allowed || scope !== "ALL") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const [tx] = await db.select().from(transactions).where(eq(transactions.id, Number(id)));
  if (!tx?.receiptUrl) return NextResponse.json({ error: "No receipt attached" }, { status: 404 });

  const result = await get(tx.receiptUrl, { access: "private" });
  if (!result?.stream) return NextResponse.json({ error: "Receipt file not found" }, { status: 404 });

  const filename = (tx.receiptName || "receipt").replace(/["\r\n]/g, "");
  return new NextResponse(result.stream, {
    headers: {
      "Content-Type": result.blob.contentType || "application/octet-stream",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

/** Attach or replace a receipt on an existing transaction (multipart field "receipt"). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  const { allowed, scope } = await checkAccess(session, "FINANCE", "EDIT");
  if (!allowed || scope !== "ALL") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const [tx] = await db.select().from(transactions).where(eq(transactions.id, Number(id)));
  if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const form = await req.formData();
  const file = form.get("receipt");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Choose a receipt file" }, { status: 400 });
  const problem = receiptProblem(file);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const blob = await put(`receipts/${Date.now()}-${file.name}`, file, { access: "private", contentType: file.type });
  await db.update(transactions).set({ receiptUrl: blob.url, receiptName: file.name.slice(0, 191) }).where(eq(transactions.id, tx.id));
  if (tx.receiptUrl) await del(tx.receiptUrl).catch(() => {});
  return NextResponse.json({ ok: true, receiptName: file.name });
}
