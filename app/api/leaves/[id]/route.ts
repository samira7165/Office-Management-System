import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leaves, employees } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  await db.update(leaves).set(body).where(eq(leaves.id, Number(id)));
  const [updated] = await db.select().from(leaves).where(eq(leaves.id, Number(id)));

  if (body.status === "approved" && updated) {
    await db.update(employees).set({ status: "on_leave" }).where(eq(employees.id, updated.employeeId));
  }
  return NextResponse.json(updated);
}
