"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Topbar from "./Topbar";
import Sidebar from "./Sidebar";
import DeniedToast from "./DeniedToast";
import type { Module, Scope } from "@/lib/authz";

const TITLES: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": { title: "Dashboard", subtitle: "Overview of your office" },
  "/employees": { title: "Employees", subtitle: "Manage your team directory" },
  "/attendance": { title: "Attendance", subtitle: "Track daily check-ins" },
  "/calendar": { title: "Calendar", subtitle: "Leaves & events at a glance" },
  "/leaves": { title: "Leaves", subtitle: "Review and manage leave requests" },
  "/payroll": { title: "Payroll", subtitle: "Salary processing & history" },
  "/finance": { title: "Finance & Accounts", subtitle: "Income, expenses & invoices" },
  "/documents": { title: "Documents", subtitle: "Employee files & records" },
  "/tasks": { title: "Tasks", subtitle: "Assign and track work" },
  "/departments": { title: "Departments", subtitle: "Organize your teams" },
  "/projects": { title: "Projects", subtitle: "Client work, value & payments" },
  "/clients": { title: "Clients", subtitle: "Direct clients & agencies" },
  "/my-attendance": { title: "My Attendance", subtitle: "Check in, check out, track your record" },
  "/my-tasks": { title: "My Tasks", subtitle: "Your assigned work" },
  "/my-leaves": { title: "My Leaves", subtitle: "Apply for and track your leave requests" },
  "/my-payroll": { title: "My Payroll", subtitle: "Your payslips & payment history" },
  "/my-documents": { title: "My Documents", subtitle: "Your personal files & records" },
};

export default function AppShell({
  children,
  userName,
  userRole,
  permissions,
}: {
  children: React.ReactNode;
  userName: string;
  userRole: string;
  permissions: { module: Module; action: string; scope: Scope }[];
}) {
  const pathname = usePathname();
  const match = Object.keys(TITLES).find((k) => pathname.startsWith(k));
  const meta = match ? TITLES[match] : { title: "OfficeHub", subtitle: "" };

  // Mobile/tablet: the sidebar is a slide-in drawer. Close it whenever the page changes.
  const [navOpen, setNavOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setNavOpen(false);
  }
  useEffect(() => {
    // Stop the page behind the open drawer from scrolling.
    document.body.style.overflow = navOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [navOpen]);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={userRole} permissions={permissions} open={navOpen} onClose={() => setNavOpen(false)} />
      {navOpen && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setNavOpen(false)} aria-hidden />}
      <div className="flex-1 min-w-0">
        <Suspense fallback={null}>
          <DeniedToast />
        </Suspense>
        <Topbar title={meta.title} subtitle={meta.subtitle} userName={userName} userRole={userRole} onMenu={() => setNavOpen(true)} />
        <main className="p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
