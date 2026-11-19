"use client";

import { useMemo, useState } from "react";
import { FolderKanban, Users, Zap, Coffee, Package, Landmark, Receipt } from "lucide-react";
import { ledgerBreakdown, fmtTaka } from "@/lib/finance";

type Row = { type: string; amount: number; category: string; date: string; projectId?: number | null };

const PERIODS = [
  { key: "this_month", label: "This month" },
  { key: "last_month", label: "Last month" },
  { key: "this_year", label: "This year" },
  { key: "all", label: "All time" },
] as const;
type PeriodKey = (typeof PERIODS)[number]["key"];

function inPeriod(date: string, period: PeriodKey) {
  if (period === "all") return true;
  const now = new Date();
  const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  if (period === "this_month") return date.startsWith(ym(now));
  if (period === "last_month") return date.startsWith(ym(new Date(now.getFullYear(), now.getMonth() - 1, 1)));
  return date.startsWith(String(now.getFullYear()));
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div className="h-2 rounded-full bg-border overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${max > 0 ? Math.min(100, (value / max) * 100) : 0}%`, background: color }} />
    </div>
  );
}

function CostLine({ icon: Icon, label, hint, value, max, color }: {
  icon: typeof Zap; label: string; hint?: string; value: number; max: number; color: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-sm mb-1.5">
        <span className="flex items-center gap-2 min-w-0">
          <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}1f`, color }}>
            <Icon className="w-3.5 h-3.5" />
          </span>
          <span className="min-w-0">
            <span className="font-medium block truncate">{label}</span>
            {hint && <span className="text-[11px] text-muted block truncate">{hint}</span>}
          </span>
        </span>
        <span className="font-semibold whitespace-nowrap tabular-nums">{fmtTaka(value)}</span>
      </div>
      <Bar value={value} max={max} color={color} />
    </div>
  );
}

export default function FinanceBreakdown({ rows }: { rows: Row[] }) {
  const [period, setPeriod] = useState<PeriodKey>("this_month");
  const b = useMemo(() => ledgerBreakdown(rows.filter((r) => inPeriod(r.date, period))), [rows, period]);

  const costMax = Math.max(b.salary, b.utilities, b.daily, b.otherExpenses, b.assets, b.loans, 1);
  const inMax = Math.max(b.projectCashIn, b.otherCashIn, b.salary, 1);
  const share = b.salaryShareOfProject;
  const shareColor = share === null ? "var(--muted)" : share > 100 ? "var(--danger)" : share > 70 ? "var(--warning)" : "var(--success)";
  const topCats = b.categories.slice(0, 6);
  const catMax = Math.max(...topCats.map((c) => c.amount), 1);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Breakdown</h2>
        <div className="flex flex-wrap gap-1.5">
          {PERIODS.map((p) => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${period === p.key ? "bg-primary text-white" : "bg-card border border-border text-foreground/70 hover:text-primary"}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
        {/* 4. Project cash in vs salary disbursement */}
        <div className="card p-4 sm:p-5">
          <h3 className="font-semibold text-sm mb-1">Project income vs salary</h3>
          <p className="text-xs text-muted mb-4">How much of the money from projects went to salaries</p>

          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="flex items-center gap-1.5 font-medium"><FolderKanban className="w-3.5 h-3.5 text-success" /> Cash in from projects</span>
                <span className="font-semibold tabular-nums text-success">{fmtTaka(b.projectCashIn)}</span>
              </div>
              <Bar value={b.projectCashIn} max={inMax} color="var(--success)" />
            </div>
            <div>
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="flex items-center gap-1.5 font-medium"><Receipt className="w-3.5 h-3.5 text-info" /> Other cash in</span>
                <span className="font-semibold tabular-nums">{fmtTaka(b.otherCashIn)}</span>
              </div>
              <Bar value={b.otherCashIn} max={inMax} color="var(--info)" />
            </div>
            <div>
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="flex items-center gap-1.5 font-medium"><Users className="w-3.5 h-3.5 text-primary" /> Salary disbursed</span>
                <span className="font-semibold tabular-nums text-danger">− {fmtTaka(b.salary)}</span>
              </div>
              <Bar value={b.salary} max={inMax} color="var(--primary)" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-4">
            <div className="rounded-xl bg-background p-3">
              <p className="text-[11px] text-muted font-medium">Salary portion</p>
              <p className="font-bold text-lg tabular-nums" style={{ color: shareColor }}>{share === null ? "N/A" : `${share.toFixed(1)}%`}</p>
              <p className="text-[11px] text-muted">of project income</p>
            </div>
            <div className="rounded-xl bg-background p-3">
              <p className="text-[11px] text-muted font-medium">Left after salary</p>
              <p className={`font-bold text-lg tabular-nums whitespace-nowrap truncate ${b.projectLeftAfterSalary < 0 ? "text-danger" : "text-success"}`} title={fmtTaka(b.projectLeftAfterSalary)}>
                {fmtTaka(b.projectLeftAfterSalary)}
              </p>
              <p className="text-[11px] text-muted">project income − salary</p>
            </div>
          </div>
          {share !== null && share > 100 && (
            <p className="text-xs text-danger mt-2 font-medium">Salary is more than the money received from projects in this period.</p>
          )}
          {b.salaryShareOfAll !== null && (
            <p className="text-[11px] text-muted mt-2">Salary is {b.salaryShareOfAll.toFixed(1)}% of all cash in ({fmtTaka(b.totalCashIn)}).</p>
          )}
        </div>

        {/* 5 & 6. Utility, daily, assets, loans */}
        <div className="card p-4 sm:p-5">
          <h3 className="font-semibold text-sm mb-1">Costs & office money</h3>
          <p className="text-xs text-muted mb-4">Utilities, daily office spending, assets bought and office loans</p>
          <div className="space-y-3.5">
            <CostLine icon={Zap} label="Utility cost" hint="Electricity, water, gas, internet" value={b.utilities} max={costMax} color="#f6a723" />
            <CostLine icon={Coffee} label="Daily office expense" hint="Tea, snacks, conveyance, petty cash" value={b.daily} max={costMax} color="#3db2ff" />
            <CostLine icon={Receipt} label="Other expenses" hint="Rent, marketing, software..." value={b.otherExpenses} max={costMax} color="#f45252" />
            <CostLine icon={Package} label="Asset buy" hint="Computers, furniture, equipment" value={b.assets} max={costMax} color="#6c5dd3" />
            <CostLine icon={Landmark} label="Office loan taken" hint="Money in, to be repaid" value={b.loans} max={costMax} color="#1dbf73" />
          </div>
        </div>

        {/* Where the money went, by category */}
        <div className="card p-4 sm:p-5">
          <h3 className="font-semibold text-sm mb-1">Top spending categories</h3>
          <p className="text-xs text-muted mb-4">Expenses and asset buys, biggest first</p>
          {topCats.length === 0 ? (
            <p className="text-sm text-muted">No expenses in this period.</p>
          ) : (
            <div className="space-y-3">
              {topCats.map((c) => (
                <div key={`${c.type}:${c.category}`}>
                  <div className="flex items-center justify-between gap-3 text-sm mb-1.5">
                    <span className="font-medium truncate capitalize">{c.category}{c.type === "asset" && <span className="text-[11px] text-primary font-normal"> · asset</span>}</span>
                    <span className="font-semibold whitespace-nowrap tabular-nums">{fmtTaka(c.amount)}</span>
                  </div>
                  <Bar value={c.amount} max={catMax} color={c.type === "asset" ? "var(--primary)" : "var(--danger)"} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
