"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import Topbar from "./Topbar";
import DeniedToast from "./DeniedToast";

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
}: {
  children: React.ReactNode;
  userName: string;
  userRole: string;
}) {
  const pathname = usePathname();
  const match = Object.keys(TITLES).find((k) => pathname.startsWith(k));
  const meta = match ? TITLES[match] : { title: "OfficeHub", subtitle: "" };

  return (
    <>
      <Suspense fallback={null}>
        <DeniedToast />
      </Suspense>
      <Topbar title={meta.title} subtitle={meta.subtitle} userName={userName} userRole={userRole} />
      <main className="p-6">{children}</main>
    </>
  );
}
