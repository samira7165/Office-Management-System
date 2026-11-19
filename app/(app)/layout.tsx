import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getPermissionsForRole } from "@/lib/authz";
import AppShell from "@/components/AppShell";
import PermissionsProvider from "@/components/PermissionsProvider";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const permissions = await getPermissionsForRole(session.role);

  return (
    <PermissionsProvider permissions={permissions}>
      <AppShell userName={session.name} userRole={session.role} permissions={permissions}>
        {children}
      </AppShell>
    </PermissionsProvider>
  );
}
