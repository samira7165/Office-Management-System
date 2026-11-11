import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET || "office-hub-dev-secret-change-me"
);

const PUBLIC_PATHS = ["/login", "/api/auth/login"];

// SUPER_ADMIN and HR are unrestricted (today's admin/hr behavior). DEPT_HEAD/TEAM_LEAD
// get the management pages minus payroll/finance; EMPLOYEE gets self-service only.
// Row-level department/self scoping happens in the route handlers, not here — middleware
// only gates which page/API prefixes a role may reach at all.
const DEPT_PAGE_PREFIXES = ["/dashboard", "/employees", "/attendance", "/leaves", "/tasks", "/departments", "/calendar", "/documents"];
const DEPT_API_PREFIXES = ["/api/auth", "/api/dashboard", "/api/employees", "/api/attendance", "/api/leaves", "/api/tasks", "/api/departments", "/api/documents"];

const EMPLOYEE_PAGE_PREFIXES = ["/my-attendance", "/my-tasks", "/my-leaves", "/my-payroll", "/my-documents"];
const EMPLOYEE_API_PREFIXES = ["/api/auth", "/api/attendance", "/api/tasks", "/api/leaves", "/api/payroll", "/api/documents"];

const DEFAULT_LANDING: Record<string, string> = {
  DEPT_HEAD: "/dashboard",
  TEAM_LEAD: "/dashboard",
  EMPLOYEE: "/my-attendance",
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get("session")?.value;
  let role: string | undefined;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, secret);
      role = payload.role as string | undefined;
    } catch {
      role = undefined;
    }
  }

  if (!role) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  const isApi = pathname.startsWith("/api");

  if (role === "DEPT_HEAD" || role === "TEAM_LEAD") {
    const allowed = isApi ? DEPT_API_PREFIXES : DEPT_PAGE_PREFIXES;
    if (!allowed.some((p) => pathname.startsWith(p))) {
      if (isApi) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      const url = req.nextUrl.clone();
      url.pathname = DEFAULT_LANDING[role];
      return NextResponse.redirect(url);
    }
  } else if (role === "EMPLOYEE") {
    const allowed = isApi ? EMPLOYEE_API_PREFIXES : EMPLOYEE_PAGE_PREFIXES;
    if (!allowed.some((p) => pathname.startsWith(p))) {
      if (isApi) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      const url = req.nextUrl.clone();
      url.pathname = DEFAULT_LANDING.EMPLOYEE;
      return NextResponse.redirect(url);
    }
  } else if (role === "HR") {
    // HR is unrestricted like SUPER_ADMIN, except finance (transactions/invoices)
    // stays super-admin only.
    const blocked = isApi ? ["/api/transactions", "/api/invoices"] : ["/finance"];
    if (blocked.some((p) => pathname.startsWith(p))) {
      if (isApi) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

