"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ShieldAlert } from "lucide-react";

const MODULE_LABEL: Record<string, string> = {
  DASHBOARD: "the dashboard", EMPLOYEES: "employees", ATTENDANCE: "attendance",
  LEAVES: "leaves", TASKS: "tasks", PAYROLL: "payroll", DOCUMENTS: "documents",
  FINANCE: "finance", DEPARTMENTS: "departments", CALENDAR: "the calendar",
  ANNOUNCEMENTS: "announcements", AUDIT_LOG: "the audit log",
};

// proxy.ts redirects a permission-denied page request to ?denied=<MODULE> — this reads
// that flag once, shows a toast, and strips it from the URL so a refresh doesn't re-show it.
export default function DeniedToast() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const denied = searchParams.get("denied");
  const [visible, setVisible] = useState(!!denied);

  useEffect(() => {
    if (!denied) return;
    setVisible(true);
    const params = new URLSearchParams(searchParams);
    params.delete("denied");
    router.replace(params.size ? `${pathname}?${params}` : pathname, { scroll: false });
    const t = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [denied]);

  if (!visible || !denied) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-2.5 bg-card border border-danger/30 shadow-lg rounded-lg px-4 py-3 text-sm">
      <ShieldAlert className="w-4 h-4 text-danger shrink-0" />
      <span>You don&apos;t have access to {MODULE_LABEL[denied] || "that"}.</span>
    </div>
  );
}
