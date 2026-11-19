import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects, projectInstallments } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { canSeeProjectMoney, getProjectPayments, parseInstallment } from "@/lib/project-payments";
import { fmtTaka } from "@/lib/finance";

/** Add an expected installment to a project's payment schedule. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!(await canSeeProjectMoney(session, "EDIT"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const [project] = await db.select().from(projects).where(eq(projects.id, Number(id)));
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const parsed = parseInstallment(await req.json());
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const pay = (await getProjectPayments([project])).get(project.id)!;
  if (parsed.data.amount > pay.unscheduled + 0.005) {
    return NextResponse.json(
      { error: pay.unscheduled <= 0.005
          ? "The whole project value is already scheduled. Edit an existing installment instead."
          : `Only ${fmtTaka(pay.unscheduled)} of the project value is left to schedule` },
      { status: 400 }
    );
  }
  const [created] = await db.insert(projectInstallments)
    .values({ ...parsed.data, projectId: project.id, createdAt: new Date().toISOString() })
    .returning();
  return NextResponse.json(created, { status: 201 });
}
