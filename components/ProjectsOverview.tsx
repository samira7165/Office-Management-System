"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FolderKanban, PlayCircle, CircleDollarSign, Hourglass, ArrowRight } from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import Badge from "@/components/ui/Badge";
import { PROJECT_STATUSES, summarizeProjects, type ProjectLike } from "@/lib/projects";

const money = (n: number) => `৳${Math.round(n).toLocaleString()}`;
const STATUS_COLOR: Record<string, string> = {
  planned: "var(--info)", active: "var(--success)", on_hold: "var(--warning)",
  completed: "var(--primary)", cancelled: "var(--muted)",
};

export default function ProjectsOverview() {
  const [rows, setRows] = useState<ProjectLike[] | null>(null);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => (r.ok ? r.json() : []))
      .then(setRows)
      .catch(() => setRows([]));
  }, []);

  const s = useMemo(() => (rows ? summarizeProjects(rows) : null), [rows]);
  if (!s) return <div className="card p-5 text-sm text-muted">Loading projects...</div>;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Projects</h2>
        <Link href="/projects" className="text-xs font-medium text-primary flex items-center gap-1 hover:underline">
          All projects <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Total projects" value={s.total} icon={FolderKanban} tint="primary" />
        <StatCard label="Active projects" value={s.active} icon={PlayCircle} tint="success" />
        <StatCard label="Total project value" value={money(s.totalValue)} icon={CircleDollarSign} tint="info" />
        <StatCard label="Long-term projects" value={s.longTerm} icon={Hourglass} tint="warning" />
      </div>

      {s.total > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card p-5">
            <h3 className="font-semibold text-sm mb-4">Projects by status</h3>
            <div className="flex h-2.5 rounded-full overflow-hidden bg-border gap-0.5 mb-4">
              {PROJECT_STATUSES.filter((st) => s.byStatus[st] > 0).map((st) => (
                <div key={st} style={{ width: `${(s.byStatus[st] / s.total) * 100}%`, background: STATUS_COLOR[st] }} />
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-2 text-xs">
              {PROJECT_STATUSES.map((st) => (
                <span key={st} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLOR[st] }} />
                  <span className="capitalize text-muted">{st.replace("_", " ")}</span>
                  <span className="font-semibold">{s.byStatus[st]}</span>
                </span>
              ))}
            </div>
            <p className="text-xs text-muted mt-4">
              {s.clientCount} client{s.clientCount === 1 ? "" : "s"} · {s.agencyCount} agenc{s.agencyCount === 1 ? "y" : "ies"} ·
              active work worth <span className="font-semibold text-foreground">{money(s.activeValue)}</span>
            </p>
          </div>

          <div className="card p-5">
            <h3 className="font-semibold text-sm mb-4">Top clients & agencies by project value</h3>
            <div className="space-y-3">
              {s.topClients.map((c) => (
                <div key={c.name} className="flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="font-medium truncate">{c.name}</span>
                    <Badge status={c.type} />
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold">{money(c.value)}</p>
                    <p className="text-[11px] text-muted">{c.count} project{c.count === 1 ? "" : "s"}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
