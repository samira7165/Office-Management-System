import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getPermissionsForRole } from "@/lib/authz";
import Sidebar from "@/components/Sidebar";
import AppShell from "@/components/AppShell";
import PermissionsProvider from "@/components/PermissionsProvider";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const permissions = await getPermissionsForRole(session.role);

  return (
    <PermissionsProvider permissions={permissions}>
      <div className="flex min-h-screen bg-background">
        <Sidebar role={session.role} permissions={permissions} />
        <div className="flex-1 min-w-0">
          <AppShell userName={session.name} userRole={session.role}>
            {children}
          </AppShell>
        </div>
      </div>
    </PermissionsProvider>
  );
}
