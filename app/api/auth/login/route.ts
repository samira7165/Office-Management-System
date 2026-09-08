import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { createSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }
  let user;
  try {
    [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim()));
  } catch (err) {
    console.error("Login DB error:", err);
    return NextResponse.json({ error: "Database unavailable. Please try again later." }, { status: 503 });
  }
  if (!user) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }
  await createSession({
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    employeeId: user.employeeId,
  });
  return NextResponse.json({ ok: true, user: { name: user.name, email: user.email, role: user.role } });
}
