import { db } from "@/lib/db";
import { employees, users, permissions } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import type { SessionPayload } from "@/lib/auth";

export const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  HR: "HR",
  DEPT_HEAD: "DEPT_HEAD",
  TEAM_LEAD: "TEAM_LEAD",
  EMPLOYEE: "EMPLOYEE",
} as const;

// ---------------------------------------------------------------------------
// Permission system (RBAC)
// ---------------------------------------------------------------------------

export type Role = "SUPER_ADMIN" | "HR" | "DEPT_HEAD" | "TEAM_LEAD" | "EMPLOYEE";

export const MODULES = [
  "DASHBOARD", "EMPLOYEES", "ATTENDANCE", "LEAVES", "TASKS",
  "PAYROLL", "DOCUMENTS", "FINANCE", "DEPARTMENTS", "CALENDAR",
  "ANNOUNCEMENTS", "AUDIT_LOG", "PROJECTS", "CLIENTS",
] as const;
export type Module = (typeof MODULES)[number];

export const ACTIONS = ["VIEW", "CREATE", "EDIT", "DELETE", "APPROVE", "EXPORT"] as const;
export type Action = (typeof ACTIONS)[number];

export const SCOPES = ["ALL", "DEPARTMENT", "SELF"] as const;
export type Scope = (typeof SCOPES)[number];

export type PermissionRule = { role: Role; module: Module; action: Action; scope: Scope };

// Single source of truth for the permission matrix — scripts/seed.ts inserts these rows
// into the `permissions` table, and checkAccess()/getPermissionsForRole() read them back
// from the DB at request time (so future changes only require editing DB rows, not code).
//
// TEAM_LEAD isn't in the spec's table — it's an existing role in this app (a read-only
// step below DEPT_HEAD within the same department, see isDeptScopedRole/canViewDept
// below), so it's given VIEW-only DEPARTMENT-scope rows mirroring DEPT_HEAD's, plus the
// TASKS/CREATE right the task-assignment routes already grant dept-scoped roles.
function buildPermissionSeed(): PermissionRule[] {
  const rows: PermissionRule[] = [];
  const add = (role: Role, module: Module, action: Action, scope: Scope) => rows.push({ role, module, action, scope });

  for (const module of MODULES) {
    for (const action of ACTIONS) add("SUPER_ADMIN", module, action, "ALL");
  }

  add("HR", "EMPLOYEES", "VIEW", "ALL");
  add("HR", "EMPLOYEES", "CREATE", "ALL");
  add("HR", "EMPLOYEES", "EDIT", "ALL");
  add("HR", "ATTENDANCE", "VIEW", "ALL");
  add("HR", "ATTENDANCE", "APPROVE", "ALL");
  add("HR", "ATTENDANCE", "EXPORT", "ALL");
  add("HR", "LEAVES", "VIEW", "ALL");
  add("HR", "LEAVES", "APPROVE", "ALL");
  add("HR", "TASKS", "VIEW", "ALL");
  add("HR", "TASKS", "CREATE", "ALL");
  add("HR", "PAYROLL", "VIEW", "ALL");
  add("HR", "PAYROLL", "CREATE", "ALL");
  add("HR", "PAYROLL", "EDIT", "ALL");
  add("HR", "DOCUMENTS", "VIEW", "ALL");
  add("HR", "DOCUMENTS", "CREATE", "ALL");
  add("HR", "FINANCE", "VIEW", "SELF");
  add("HR", "DEPARTMENTS", "VIEW", "ALL");
  add("HR", "DEPARTMENTS", "EDIT", "ALL");
  add("HR", "CALENDAR", "VIEW", "ALL");
  add("HR", "ANNOUNCEMENTS", "VIEW", "ALL");
  add("HR", "ANNOUNCEMENTS", "CREATE", "ALL");
  add("HR", "AUDIT_LOG", "VIEW", "ALL");
  add("HR", "DASHBOARD", "VIEW", "ALL");

  add("DEPT_HEAD", "EMPLOYEES", "VIEW", "DEPARTMENT");
  add("DEPT_HEAD", "ATTENDANCE", "VIEW", "DEPARTMENT");
  add("DEPT_HEAD", "ATTENDANCE", "APPROVE", "DEPARTMENT");
  add("DEPT_HEAD", "LEAVES", "VIEW", "DEPARTMENT");
  add("DEPT_HEAD", "LEAVES", "APPROVE", "DEPARTMENT");
  add("DEPT_HEAD", "TASKS", "VIEW", "DEPARTMENT");
  add("DEPT_HEAD", "TASKS", "CREATE", "DEPARTMENT");
  add("DEPT_HEAD", "TASKS", "EDIT", "DEPARTMENT");
  add("DEPT_HEAD", "PAYROLL", "VIEW", "DEPARTMENT");
  add("DEPT_HEAD", "DOCUMENTS", "VIEW", "DEPARTMENT");
  add("DEPT_HEAD", "DOCUMENTS", "CREATE", "DEPARTMENT");
  add("DEPT_HEAD", "DOCUMENTS", "EDIT", "DEPARTMENT");
  add("DEPT_HEAD", "FINANCE", "CREATE", "DEPARTMENT");
  add("DEPT_HEAD", "DEPARTMENTS", "VIEW", "SELF");
  add("DEPT_HEAD", "DEPARTMENTS", "EDIT", "SELF");
  add("DEPT_HEAD", "CALENDAR", "VIEW", "DEPARTMENT");
  add("DEPT_HEAD", "ANNOUNCEMENTS", "VIEW", "DEPARTMENT");
  add("DEPT_HEAD", "ANNOUNCEMENTS", "CREATE", "DEPARTMENT");
  add("DEPT_HEAD", "AUDIT_LOG", "VIEW", "DEPARTMENT");
  add("DEPT_HEAD", "DASHBOARD", "VIEW", "DEPARTMENT");
  // Projects: dept heads run their own department's projects (no delete — SUPER_ADMIN only).
  // HR and EMPLOYEE get no PROJECTS rows, so project values stay hidden from them.
  add("DEPT_HEAD", "PROJECTS", "VIEW", "DEPARTMENT");
  add("DEPT_HEAD", "PROJECTS", "CREATE", "DEPARTMENT");
  add("DEPT_HEAD", "PROJECTS", "EDIT", "DEPARTMENT");
  // Clients are company-wide (not owned by a department). Dept heads can see the list and
  // add new clients for their projects; editing/deleting client records is SUPER_ADMIN only.
  add("DEPT_HEAD", "CLIENTS", "VIEW", "ALL");
  add("DEPT_HEAD", "CLIENTS", "CREATE", "ALL");

  // TEAM_LEAD — read-only within their department (matches the existing canViewDept
  // behavior), plus the ability to create/assign tasks within their own department
  // (matches the existing tasks POST route).
  add("TEAM_LEAD", "DASHBOARD", "VIEW", "DEPARTMENT");
  add("TEAM_LEAD", "EMPLOYEES", "VIEW", "DEPARTMENT");
  add("TEAM_LEAD", "ATTENDANCE", "VIEW", "DEPARTMENT");
  add("TEAM_LEAD", "LEAVES", "VIEW", "DEPARTMENT");
  add("TEAM_LEAD", "TASKS", "VIEW", "DEPARTMENT");
  add("TEAM_LEAD", "TASKS", "CREATE", "DEPARTMENT");
  add("TEAM_LEAD", "DOCUMENTS", "VIEW", "DEPARTMENT");
  add("TEAM_LEAD", "DEPARTMENTS", "VIEW", "SELF");
  add("TEAM_LEAD", "CALENDAR", "VIEW", "DEPARTMENT");
  add("TEAM_LEAD", "ANNOUNCEMENTS", "VIEW", "DEPARTMENT");
  add("TEAM_LEAD", "AUDIT_LOG", "VIEW", "DEPARTMENT");
  add("TEAM_LEAD", "PROJECTS", "VIEW", "DEPARTMENT");
  add("TEAM_LEAD", "CLIENTS", "VIEW", "ALL");

  add("EMPLOYEE", "EMPLOYEES", "VIEW", "SELF");
  add("EMPLOYEE", "ATTENDANCE", "VIEW", "SELF");
  add("EMPLOYEE", "ATTENDANCE", "CREATE", "SELF");
  add("EMPLOYEE", "LEAVES", "VIEW", "SELF");
  add("EMPLOYEE", "LEAVES", "CREATE", "SELF");
  add("EMPLOYEE", "TASKS", "VIEW", "SELF");
  add("EMPLOYEE", "TASKS", "CREATE", "SELF");
  add("EMPLOYEE", "TASKS", "EDIT", "SELF");
  add("EMPLOYEE", "PAYROLL", "VIEW", "SELF");
  add("EMPLOYEE", "DOCUMENTS", "VIEW", "SELF");
  add("EMPLOYEE", "DOCUMENTS", "CREATE", "SELF");
  add("EMPLOYEE", "DEPARTMENTS", "VIEW", "SELF");
  add("EMPLOYEE", "CALENDAR", "VIEW", "SELF");
  add("EMPLOYEE", "ANNOUNCEMENTS", "VIEW", "SELF");
  add("EMPLOYEE", "DASHBOARD", "VIEW", "SELF");

  return rows;
}

export const PERMISSION_SEED: PermissionRule[] = buildPermissionSeed();

/**
 * checkAccess(session, module, action) — looks up whether the current session's role may
 * perform `action` on `module`, per the `permissions` table.
 *
 * Deviates slightly from a literal `checkAccess(userId, ...)` signature: role and
 * departmentId are already carried on the signed session (see SessionPayload), so no
 * extra DB round-trip to `users` is needed to resolve them — the session *is* "user role
 * and departmentId from session" step 1 asks for.
 */
export async function checkAccess(
  session: SessionPayload | null,
  module: Module,
  action: Action
): Promise<{ allowed: boolean; scope: Scope | null }> {
  if (!session) return { allowed: false, scope: null };
  if (session.role === "SUPER_ADMIN") return { allowed: true, scope: "ALL" };

  const [perm] = await db
    .select()
    .from(permissions)
    .where(and(eq(permissions.role, session.role as Role), eq(permissions.module, module), eq(permissions.action, action)));

  if (!perm || !perm.isAllowed) return { allowed: false, scope: null };
  return { allowed: true, scope: perm.scope };
}

/**
 * applyScopeFilter — narrows an already-fetched array of rows down to what `scope` allows.
 * Operates on JS arrays (matching this codebase's existing "fetch + join, then filter in
 * JS" pattern, e.g. app/api/attendance/route.ts) rather than composing a SQL WHERE clause,
 * since scope often depends on a joined table's column (e.g. attendance rows are scoped by
 * their employee's departmentId, not a column on attendance itself).
 */
export function applyScopeFilter<T>(
  rows: T[],
  scope: Scope | null,
  ctx: { employeeId: number | null; departmentId: number | null },
  accessors: {
    employeeId?: (row: T) => number | null | undefined;
    departmentId?: (row: T) => number | null | undefined;
  }
): T[] {
  if (!scope) return [];
  if (scope === "ALL") return rows;
  if (scope === "DEPARTMENT") {
    // No way to tell which rows belong to the caller's department without an accessor —
    // fail closed (nothing visible) rather than fail open (everything visible).
    if (!accessors.departmentId) return [];
    return rows.filter((r) => accessors.departmentId!(r) === ctx.departmentId);
  }
  if (scope === "SELF") {
    if (!accessors.employeeId) return [];
    return rows.filter((r) => accessors.employeeId!(r) === ctx.employeeId);
  }
  return [];
}

/** Single-target counterpart to applyScopeFilter — for write routes (PATCH/DELETE) that
 * need to check one existing record's department/owner against the caller's scope. */
export function isInScope(
  scope: Scope | null,
  ctx: { employeeId: number | null; departmentId: number | null },
  target: { employeeId?: number | null; departmentId?: number | null }
): boolean {
  if (!scope) return false;
  if (scope === "ALL") return true;
  if (scope === "DEPARTMENT") return target.departmentId != null && target.departmentId === ctx.departmentId;
  if (scope === "SELF") return target.employeeId != null && target.employeeId === ctx.employeeId;
  return false;
}

/** All (module, action, scope) rows a role is allowed — powers the sidebar and the client usePermission() hook. */
export async function getPermissionsForRole(role: string): Promise<{ module: Module; action: Action; scope: Scope }[]> {
  if (role === "SUPER_ADMIN") {
    return MODULES.flatMap((module) => ACTIONS.map((action) => ({ module, action, scope: "ALL" as Scope })));
  }
  const rows = await db
    .select()
    .from(permissions)
    .where(and(eq(permissions.role, role as Role), eq(permissions.isAllowed, true)));
  return rows.map((r) => ({ module: r.module, action: r.action, scope: r.scope }));
}

export function isDeptScopedRole(role: string | undefined) {
  return role === ROLES.DEPT_HEAD || role === ROLES.TEAM_LEAD;
}

// Approve / assign / edit rights within a department.
export function canManageDept(session: SessionPayload | null, targetDepartmentId: number | null) {
  if (!session) return false;
  if (session.role === ROLES.SUPER_ADMIN || session.role === ROLES.HR) return true;
  if (session.role === ROLES.DEPT_HEAD) {
    return targetDepartmentId !== null && session.departmentId === targetDepartmentId;
  }
  return false;
}

// Read-only visibility within a department (adds TEAM_LEAD on top of canManageDept).
export function canViewDept(session: SessionPayload | null, targetDepartmentId: number | null) {
  if (!session) return false;
  if (canManageDept(session, targetDepartmentId)) return true;
  if (session.role === ROLES.TEAM_LEAD) {
    return targetDepartmentId !== null && session.departmentId === targetDepartmentId;
  }
  return false;
}

export async function getEmployeeDepartmentId(employeeId: number | null | undefined): Promise<number | null> {
  if (!employeeId) return null;
  const [emp] = await db.select({ departmentId: employees.departmentId }).from(employees).where(eq(employees.id, employeeId));
  return emp?.departmentId ?? null;
}

// departments.headId is a FK to users.id, but the client still speaks in terms of
// employeeId (like every other assignee field in this app) — this keeps that wire
// contract stable while the DB stores the head's user account.
export async function resolveHeadId(headEmployeeId: unknown): Promise<number | null> {
  if (!headEmployeeId) return null;
  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.employeeId, Number(headEmployeeId)));
  return u?.id ?? null;
}
