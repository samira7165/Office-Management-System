// Shared project helpers — no DB imports, so both API routes and client components use them.

export const PROJECT_STATUSES = ["planned", "active", "on_hold", "completed", "cancelled"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const CLIENT_TYPES = ["client", "agency"] as const;
export type ClientType = (typeof CLIENT_TYPES)[number];

/** A project longer than this many months (or with no end date) counts as long-term. */
export const LONG_TERM_MONTHS = 6;

export type ProjectLike = {
  value: number;
  status: string;
  startDate: string;
  endDate: string | null;
  clientName: string;
  clientType: string;
};

/** Ongoing projects (no end date) are long-term; otherwise end must be past start + 6 months. */
export function isLongTerm(startDate: string, endDate: string | null): boolean {
  if (!endDate) return true;
  const start = new Date(startDate + "T00:00:00");
  const cutoff = new Date(start);
  cutoff.setMonth(cutoff.getMonth() + LONG_TERM_MONTHS);
  return new Date(endDate + "T00:00:00") > cutoff;
}

/** Whole months between start and end (or "Ongoing"), for display. */
export function durationLabel(startDate: string, endDate: string | null): string {
  if (!endDate) return "Ongoing";
  const s = new Date(startDate + "T00:00:00");
  const e = new Date(endDate + "T00:00:00");
  const months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + (e.getDate() >= s.getDate() ? 0 : -1);
  if (months < 1) {
    const days = Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000));
    return `${days} day${days === 1 ? "" : "s"}`;
  }
  return `${months} month${months === 1 ? "" : "s"}`;
}

export type ProjectInput = {
  name: string; description: string; clientName: string; clientType: ClientType; clientEmail: string;
  value: number; startDate: string; endDate: string | null; status: ProjectStatus;
  departmentId: number | null; managerId: number | null;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates a create (partial=false) or edit (partial=true) body. Only known fields are
 * copied, so a request can't set id/createdAt or anything else on the row.
 */
export function parseProjectInput(body: Record<string, unknown>, partial: boolean):
  { data: Partial<ProjectInput>; error?: undefined } | { data?: undefined; error: string } {
  const out: Partial<ProjectInput> = {};
  const has = (k: string) => k in body;
  const str = (k: string) => (typeof body[k] === "string" ? (body[k] as string).trim() : "");

  if (!partial || has("name")) {
    if (!str("name")) return { error: "Project name is required" };
    out.name = str("name");
  }
  if (!partial || has("clientName")) {
    if (!str("clientName")) return { error: "Client / agency name is required" };
    out.clientName = str("clientName");
  }
  if (has("description")) out.description = str("description");
  if (has("clientEmail")) out.clientEmail = str("clientEmail");
  if (!partial || has("clientType")) {
    const t = str("clientType") || "client";
    if (!(CLIENT_TYPES as readonly string[]).includes(t)) return { error: "Client type must be client or agency" };
    out.clientType = t as ClientType;
  }
  if (!partial || has("value")) {
    const v = Number(body.value);
    if (!Number.isFinite(v) || v < 0) return { error: "Project value must be a number of 0 or more" };
    out.value = v;
  }
  if (!partial || has("startDate")) {
    if (!DATE_RE.test(str("startDate"))) return { error: "Start date is required" };
    out.startDate = str("startDate");
  }
  if (has("endDate")) {
    const e = str("endDate");
    if (e && !DATE_RE.test(e)) return { error: "End date is invalid" };
    out.endDate = e || null;
  }
  if (!partial || has("status")) {
    const s = str("status") || "planned";
    if (!(PROJECT_STATUSES as readonly string[]).includes(s)) return { error: "Invalid status" };
    out.status = s as ProjectStatus;
  }
  for (const k of ["departmentId", "managerId"] as const) {
    if (has(k)) {
      const raw = body[k];
      out[k] = raw === null || raw === "" || raw === undefined ? null : Number(raw);
      if (out[k] !== null && !Number.isInteger(out[k])) return { error: `Invalid ${k}` };
    }
  }
  return { data: out };
}

export function summarizeProjects(rows: ProjectLike[]) {
  const live = rows.filter((p) => p.status !== "cancelled");
  const byStatus = Object.fromEntries(PROJECT_STATUSES.map((s) => [s, 0])) as Record<ProjectStatus, number>;
  for (const p of rows) if (p.status in byStatus) byStatus[p.status as ProjectStatus]++;

  const clients = new Map<string, { name: string; type: string; value: number; count: number }>();
  for (const p of live) {
    const c = clients.get(p.clientName) ?? { name: p.clientName, type: p.clientType, value: 0, count: 0 };
    c.value += p.value;
    c.count++;
    clients.set(p.clientName, c);
  }

  return {
    total: rows.length,
    active: byStatus.active,
    // Cancelled work isn't money the company expects to earn, so it's left out of value totals.
    totalValue: live.reduce((s, p) => s + p.value, 0),
    activeValue: rows.filter((p) => p.status === "active").reduce((s, p) => s + p.value, 0),
    longTerm: live.filter((p) => isLongTerm(p.startDate, p.endDate)).length,
    agencyCount: new Set(live.filter((p) => p.clientType === "agency").map((p) => p.clientName)).size,
    clientCount: new Set(live.filter((p) => p.clientType !== "agency").map((p) => p.clientName)).size,
    byStatus,
    topClients: [...clients.values()].sort((a, b) => b.value - a.value).slice(0, 5),
  };
}
