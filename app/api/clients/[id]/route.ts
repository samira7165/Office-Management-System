import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clients, projects, transactions } from "@/lib/schema";
import { and, eq, ne, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { checkAccess } from "@/lib/authz";
import { parseClientInput } from "@/lib/clients";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clientId = Number(id);
  const session = await getSession();
  const { allowed } = await checkAccess(session, "CLIENTS", "EDIT");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [existing] = await db.select().from(clients).where(eq(clients.id, clientId));
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = parseClientInput(await req.json(), true);
  if (!parsed.data) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const changes = parsed.data;

  if (changes.name) {
    const [dupe] = await db.select({ id: clients.id }).from(clients)
      .where(and(sql`lower(${clients.name}) = lower(${changes.name})`, ne(clients.id, clientId)));
    if (dupe) return NextResponse.json({ error: `A client named "${changes.name}" already exists` }, { status: 409 });
  }

  if (Object.keys(changes).length > 0) {
    await db.update(clients).set(changes).where(eq(clients.id, clientId));
  }
  const [updated] = await db.select().from(clients).where(eq(clients.id, clientId));

  // Keep the copy of the client's details on linked projects in sync.
  await db.update(projects)
    .set({ clientName: updated.name, clientType: updated.type, clientEmail: updated.email ?? "" })
    .where(eq(projects.clientId, clientId));

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  const { allowed } = await checkAccess(session, "CLIENTS", "DELETE");
  if (!allowed) return NextResponse.json({ error: "Not allowed to delete clients" }, { status: 403 });

  const { id } = await params;
  const clientId = Number(id);
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(projects).where(eq(projects.clientId, clientId));
  if (n > 0) {
    return NextResponse.json(
      { error: `This client has ${n} project${n === 1 ? "" : "s"}. Delete or move those projects first.` },
      { status: 409 }
    );
  }
  const [{ t }] = await db.select({ t: sql<number>`count(*)::int` }).from(transactions).where(eq(transactions.clientId, clientId));
  if (t > 0) {
    return NextResponse.json(
      { error: `This client has ${t} finance transaction${t === 1 ? "" : "s"} linked. Remove the client from those first.` },
      { status: 409 }
    );
  }
  await db.delete(clients).where(eq(clients.id, clientId));
  return NextResponse.json({ ok: true });
}
