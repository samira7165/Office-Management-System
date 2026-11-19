import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { checkAccess, type Module } from "@/lib/authz";
import type { SessionPayload } from "@/lib/auth";

const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET || "office-hub-dev-secret-change-me"
);

const PUBLIC_PATHS = ["/login", "/api/auth/login"];

// /api/auth/me and /api/auth/logout just need *a* session, not a module permission —
// exempt the whole /api/auth prefix from the module gate below.
const AUTH_API_PREFIX = "/api/auth";

// Path prefix -> permissions module, for both pages and their backing API routes.
// This is what makes page-level protection permission-table-driven instead of a
// hardcoded per-role allowlist: a path's module VIEW permission decides reachability.
const PATH_MODULE_MAP: [string, Module][] = [
  ["/my-attendance", "ATTENDANCE"],
  ["/my-leaves", "LEAVES"],
  ["/my-tasks", "TASKS"],
  ["/my-payroll", "PAYROLL"],
  ["/my-documents", "DOCUMENTS"],
  ["/dashboard", "DASHBOARD"],
  ["/employees", "EMPLOYEES"],
  ["/attendance", "ATTENDANCE"],
  ["/leaves", "LEAVES"],
  ["/tasks", "TASKS"],
  ["/payroll", "PAYROLL"],
  ["/documents", "DOCUMENTS"],
  ["/finance", "FINANCE"],
  ["/departments", "DEPARTMENTS"],
  ["/calendar", "CALENDAR"],
  ["/projects", "PROJECTS"],
  ["/api/projects", "PROJECTS"],
  ["/api/dashboard", "DASHBOARD"],
  ["/api/employees", "EMPLOYEES"],
  ["/api/attendance", "ATTENDANCE"],
  ["/api/leaves", "LEAVES"],
  ["/api/tasks", "TASKS"],
  ["/api/payroll", "PAYROLL"],
  ["/api/documents", "DOCUMENTS"],
  ["/api/transactions", "FINANCE"],
  ["/api/invoices", "FINANCE"],
  ["/api/departments", "DEPARTMENTS"],
];

// Every role has DASHBOARD VIEW (see lib/authz.ts) — /api/dashboard/stats self-scopes
// for EMPLOYEE (own attendance/leave/payroll only), so /dashboard is a safe landing spot
// for all roles, not just management ones.
const DEFAULT_LANDING: Record<string, string> = {
  SUPER_ADMIN: "/dashboard",
  HR: "/dashboard",
  DEPT_HEAD: "/dashboard",
  TEAM_LEAD: "/dashboard",
  EMPLOYEE: "/dashboard",
};

function moduleForPath(pathname: string): Module | null {
  // Longest-prefix match so e.g. "/my-attendance" wins over a hypothetical "/my".
  let best: [string, Module] | null = null;
  for (const entry of PATH_MODULE_MAP) {
    const [prefix] = entry;
    if ((pathname === prefix || pathname.startsWith(prefix + "/")) && (!best || prefix.length > best[0].length)) {
      best = entry;
    }
  }
  return best ? best[1] : null;
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const isApi = pathname.startsWith("/api");
  const token = req.cookies.get("session")?.value;
  let session: SessionPayload | null = null;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, secret);
      session = payload as unknown as SessionPayload;
    } catch {
      session = null;
    }
  }

  if (!session) {
    if (isApi) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith(AUTH_API_PREFIX)) {
    return NextResponse.next();
  }

  const module = moduleForPath(pathname);
  if (module) {
    const { allowed } = await checkAccess(session, module, "VIEW");
    if (!allowed) {
      if (isApi) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      const url = req.nextUrl.clone();
      url.pathname = DEFAULT_LANDING[session.role] || "/login";
      url.searchParams.set("denied", module);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
