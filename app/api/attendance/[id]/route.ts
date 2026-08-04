import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { attendance } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  await db.update(attendance).set(body).where(eq(attendance.id, Number(id)));
  const [updated] = await db.select().from(attendance).where(eq(attendance.id, Number(id)));
  return NextResponse.json(updated);
}
