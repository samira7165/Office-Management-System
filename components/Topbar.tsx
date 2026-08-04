"use client";

import { Search, Bell } from "lucide-react";

export default function Topbar({
  title,
  subtitle,
  userName,
  userRole,
}: {
  title: string;
  subtitle?: string;
  userName: string;
  userRole: string;
}) {
  const initials = userName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="h-16 border-b border-border bg-card px-6 flex items-center justify-between sticky top-0 z-10">
      <div>
        <h1 className="text-lg font-semibold leading-tight">{title}</h1>
        {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-1.5 w-64">
          <Search className="w-4 h-4 text-muted" />
          <input
            placeholder="Search..."
            className="bg-transparent text-sm outline-none w-full placeholder:text-muted"
          />
        </div>
        <button className="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-muted hover:bg-background transition relative">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-danger" />
        </button>
        <div className="flex items-center gap-2.5 pl-3 border-l border-border">
          <div className="w-8 h-8 rounded-full bg-primary text-white text-xs font-semibold flex items-center justify-center">
            {initials}
          </div>
          <div className="hidden md:block leading-tight">
            <p className="text-sm font-medium">{userName}</p>
            <p className="text-[11px] text-muted capitalize">{userRole}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
