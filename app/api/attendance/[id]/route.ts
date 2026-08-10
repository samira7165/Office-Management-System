import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { attendance } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const body = await req.json();

  if (session?.role === "employee") {
    const [existing] = await db.select().from(attendance).where(eq(attendance.id, Number(id)));
    if (!existing || existing.employeeId !== session.employeeId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if ("approvalStatus" in body) {
      return NextResponse.json({ error: "Only admins can approve attendance" }, { status: 403 });
    }
  }

  await db.update(attendance).set(body).where(eq(attendance.id, Number(id)));
  const [updated] = await db.select().from(attendance).where(eq(attendance.id, Number(id)));
  return NextResponse.json(updated);
}
