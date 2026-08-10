"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutGrid, Users, CalendarCheck, CalendarDays, Plane,
  Wallet, FileText, ListChecks, Building2, LogOut, Network, Landmark,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/employees", label: "Employees", icon: Users },
  { href: "/attendance", label: "Attendance", icon: CalendarCheck },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/leaves", label: "Leaves", icon: Plane },
  { href: "/payroll", label: "Payroll", icon: Wallet },
  { href: "/finance", label: "Finance", icon: Landmark },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/tasks", label: "Tasks", icon: ListChecks },
  { href: "/departments", label: "Departments", icon: Network },
];

const EMPLOYEE_NAV = [
  { href: "/my-attendance", label: "My Attendance", icon: CalendarCheck },
  { href: "/my-tasks", label: "My Tasks", icon: ListChecks },
];

export default function Sidebar({ role }: { role: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const nav = role === "employee" ? EMPLOYEE_NAV : NAV;

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
          {role === "employee" ? "Self Service" : "HR Management"}
        </p>
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
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
