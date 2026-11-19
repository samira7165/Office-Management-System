import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { checkAccess, isInScope } from "@/lib/authz";
import { parseProjectInput } from "@/lib/projects";
import { validateProjectRelations, applyClientLink } from "@/lib/projects-db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const { allowed, scope } = await checkAccess(session, "PROJECTS", "EDIT");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [existing] = await db.select().from(projects).where(eq(projects.id, Number(id)));
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ctx = { employeeId: session!.employeeId, departmentId: session!.departmentId };
  if (!isInScope(scope, ctx, { departmentId: existing.departmentId })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const clientErr = await applyClientLink(body);
  if (clientErr) return NextResponse.json({ error: clientErr }, { status: 400 });
  const parsed = parseProjectInput(body, true);
  if (!parsed.data) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const changes = parsed.data;

  // Department-scoped roles can't move a project out of their department.
  if (scope !== "ALL") delete changes.departmentId;

  const merged = { ...existing, ...changes };
  const check = await validateProjectRelations(merged.departmentId, merged.managerId, merged.startDate, merged.endDate);
  if (check) return NextResponse.json({ error: check }, { status: 400 });

  if (Object.keys(changes).length > 0) {
    await db.update(projects).set(changes).where(eq(projects.id, Number(id)));
  }
  const [updated] = await db.select().from(projects).where(eq(projects.id, Number(id)));
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  const { allowed } = await checkAccess(session, "PROJECTS", "DELETE");
  if (!allowed) return NextResponse.json({ error: "Not allowed to delete projects" }, { status: 403 });

  const { id } = await params;
  await db.delete(projects).where(eq(projects.id, Number(id)));
  return NextResponse.json({ ok: true });
}
