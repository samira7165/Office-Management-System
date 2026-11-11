import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { employees, departments } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { checkAccess, applyScopeFilter } from "@/lib/authz";

export async function GET() {
  const session = await getSession();
  const { allowed, scope } = await checkAccess(session, "EMPLOYEES", "VIEW");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await db.select().from(employees).leftJoin(departments, eq(employees.departmentId, departments.id));
  let data = rows.map((r) => ({ ...r.employees, department: r.departments }));

  data = applyScopeFilter(data, scope, { employeeId: session!.employeeId, departmentId: session!.departmentId }, {
    departmentId: (r) => r.departmentId,
    employeeId: (r) => r.id,
  });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const { allowed } = await checkAccess(session, "EMPLOYEES", "CREATE");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  if (!body.name || !body.email || !body.position) {
    return NextResponse.json({ error: "Name, email, and position are required" }, { status: 400 });
  }
  const colors = ["#6C5DD3", "#3DB2FF", "#F6A723", "#1DBF73", "#F45252", "#8B5CF6", "#EC4899"];
  const [created] = await db.insert(employees).values({
    name: body.name,
    email: body.email,
    phone: body.phone || "",
    position: body.position,
    departmentId: body.departmentId || null,
    joinDate: body.joinDate || new Date().toISOString().slice(0, 10),
    status: body.status || "active",
    avatarColor: colors[Math.floor(Math.random() * colors.length)],
    baseSalary: body.baseSalary || 0,
    address: body.address || "",
  }).returning();
  return NextResponse.json(created, { status: 201 });
}
