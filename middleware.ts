import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET || "office-hub-dev-secret-change-me"
);

const PUBLIC_PATHS = ["/login", "/api/auth/login"];

// employees get a restricted self-service view — everything else is admin/HR only
const EMPLOYEE_PAGE_PREFIXES = ["/my-attendance", "/my-tasks"];
const EMPLOYEE_API_PREFIXES = ["/api/auth", "/api/attendance", "/api/tasks"];

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

  if (role === "employee") {
    if (pathname.startsWith("/api")) {
      if (!EMPLOYEE_API_PREFIXES.some((p) => pathname.startsWith(p))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (!EMPLOYEE_PAGE_PREFIXES.some((p) => pathname.startsWith(p))) {
      const url = req.nextUrl.clone();
      url.pathname = "/my-attendance";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

