import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canSeeProjectMoney, recordProjectPayment } from "@/lib/project-payments";

/** Record money received for a project (goes into the Finance Ledger as Cash In). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!(await canSeeProjectMoney(session, "CREATE"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const res = await recordProjectPayment(Number(id), {
    amount: Number(body.amount),
    date: String(body.date || ""),
    account: typeof body.account === "string" ? body.account : "",
    description: typeof body.description === "string" ? body.description.trim() : "",
    installmentId: body.installmentId ? Number(body.installmentId) : null,
  });
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json(res, { status: 201 });
}
