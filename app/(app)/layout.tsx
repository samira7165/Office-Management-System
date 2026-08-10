import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
import AppShell from "@/components/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={session.role} />
      <div className="flex-1 min-w-0">
        <AppShell userName={session.name} userRole={session.role}>
          {children}
        </AppShell>
      </div>
    </div>
  );
}
