"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutGrid, Users, CalendarCheck, CalendarDays, Plane,
  Wallet, FileText, ListChecks, Building2, LogOut, Network, Landmark, FolderKanban,
  type LucideIcon,
} from "lucide-react";
import type { Module, Scope } from "@/lib/authz";

type PermissionEntry = { module: Module; action: string; scope: Scope };
type NavItem = { href: string; label: string; icon: LucideIcon };

// Module -> page. Resolves a role's scope on a module to the page that renders it, so the
// nav is generated from permission rows rather than hardcoded per role — a role that gains
// a new (module, VIEW) permission row picks up the matching item automatically, with no
// sidebar code changes. Modules with no page built yet (ANNOUNCEMENTS, AUDIT_LOG, and
// FINANCE outside ALL scope) resolve to null and are simply omitted.
const MODULE_ORDER: Module[] = [
  "DASHBOARD", "PROJECTS", "EMPLOYEES", "ATTENDANCE", "LEAVES", "TASKS",
  "PAYROLL", "DOCUMENTS", "FINANCE", "DEPARTMENTS", "CALENDAR",
  "ANNOUNCEMENTS", "AUDIT_LOG",
];

const MODULE_ICON: Record<Module, LucideIcon> = {
  DASHBOARD: LayoutGrid,
  EMPLOYEES: Users,
  ATTENDANCE: CalendarCheck,
  LEAVES: Plane,
  TASKS: ListChecks,
  PAYROLL: Wallet,
  DOCUMENTS: FileText,
  FINANCE: Landmark,
  DEPARTMENTS: Network,
  CALENDAR: CalendarDays,
  ANNOUNCEMENTS: CalendarDays,
  AUDIT_LOG: Network,
  PROJECTS: FolderKanban,
};

function resolveNavItem(module: Module, scope: Scope): { href: string; label: string } | null {
  switch (module) {
    case "DASHBOARD":
      return { href: "/dashboard", label: "Dashboard" };
    case "EMPLOYEES":
      if (scope === "ALL") return { href: "/employees", label: "All Employees" };
      if (scope === "DEPARTMENT") return { href: "/employees", label: "My Team" };
      return { href: "/employees", label: "My Profile" };
    case "ATTENDANCE":
      if (scope === "SELF") return { href: "/my-attendance", label: "My Attendance" };
      return { href: "/attendance", label: scope === "DEPARTMENT" ? "Team Attendance" : "Attendance" };
    case "LEAVES":
      if (scope === "SELF") return { href: "/my-leaves", label: "My Leaves" };
      return { href: "/leaves", label: scope === "DEPARTMENT" ? "Team Leaves" : "Leaves" };
    case "TASKS":
      if (scope === "SELF") return { href: "/my-tasks", label: "My Tasks" };
      return { href: "/tasks", label: scope === "DEPARTMENT" ? "Team Tasks" : "Tasks" };
    case "PAYROLL":
      if (scope === "SELF") return { href: "/my-payroll", label: "My Payroll" };
      return { href: "/payroll", label: scope === "DEPARTMENT" ? "Payroll Summary" : "Payroll" };
    case "DOCUMENTS":
      if (scope === "SELF") return { href: "/my-documents", label: "My Documents" };
      return { href: "/documents", label: scope === "DEPARTMENT" ? "Department Docs" : "Documents" };
    case "FINANCE":
      return scope === "ALL" ? { href: "/finance", label: "Finance" } : null;
    case "DEPARTMENTS":
      return scope === "ALL" ? { href: "/departments", label: "Departments" } : { href: "/departments", label: "My Department" };
    case "CALENDAR":
      return { href: "/calendar", label: scope === "DEPARTMENT" ? "Team Calendar" : "Calendar" };
    case "PROJECTS":
      return { href: "/projects", label: scope === "DEPARTMENT" ? "Team Projects" : "Projects" };
    default:
      return null; // ANNOUNCEMENTS, AUDIT_LOG — no page built yet
  }
}

function navFor(permissions: PermissionEntry[]): NavItem[] {
  const scopeByModule = new Map<Module, Scope>();
  for (const p of permissions) {
    if (p.action === "VIEW") scopeByModule.set(p.module, p.scope);
  }
  const items: NavItem[] = [];
  for (const module of MODULE_ORDER) {
    const scope = scopeByModule.get(module);
    if (!scope) continue;
    const resolved = resolveNavItem(module, scope);
    if (!resolved) continue;
    items.push({ ...resolved, icon: MODULE_ICON[module] });
  }
  return items;
}

const GROUP_LABEL: Record<string, string> = {
  EMPLOYEE: "Self Service",
  DEPT_HEAD: "Team Management",
  TEAM_LEAD: "Team Management",
  HR: "HR Management",
  SUPER_ADMIN: "Administration",
};

export default function Sidebar({ role, permissions }: { role: string; permissions: PermissionEntry[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const nav = navFor(permissions);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="w-60 shrink-0 h-screen sticky top-0 bg-card border-r border-border flex flex-col">
      <div className="flex items-center gap-2 px-5 h-16 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <Building2 className="w-4 h-4 text-white" />
        </div>
        <span className="font-bold text-[15px] tracking-tight">OfficeHub</span>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-muted mb-2">
          {GROUP_LABEL[role] || "Menu"}
        </p>
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href + item.label}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                active
                  ? "bg-primary text-white"
                  : "text-foreground/70 hover:bg-primary-light hover:text-primary"
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground/70 hover:bg-danger-light hover:text-danger transition"
        >
          <LogOut className="w-4 h-4" />
          Log out
        </button>
      </div>
    </aside>
  );
}
