"use client";

import { usePathname } from "next/navigation";
import Topbar from "./Topbar";

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
      <Topbar title={meta.title} subtitle={meta.subtitle} userName={userName} userRole={userRole} />
      <main className="p-6">{children}</main>
    </>
  );
}
