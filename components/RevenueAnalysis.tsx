"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TrendingUp, TrendingDown, CircleDollarSign, Receipt, AlertTriangle, ArrowRight } from "lucide-react";
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from "recharts";

type Revenue = {
  thisMonth: { income: number; expense: number; net: number };
  growthPct: number | null;
  trend: { key: string; label: string; income: number; expense: number; net: number }[];
  invoices: { billed: number; paid: number; outstanding: number; overdue: number; overdueCount: number; collectionRate: number | null };
  topClients: { name: string; billed: number; paid: number }[];
};

const money = (n: number) => `৳${Math.round(n).toLocaleString()}`;
const compact = (n: number) =>
  Math.abs(n) >= 100000 ? `৳${(n / 100000).toFixed(1)}L` : Math.abs(n) >= 1000 ? `৳${Math.round(n / 1000)}k` : `৳${n}`;

function Tile({
  label, value, icon: Icon, tint, note, noteTone = "muted",
}: {
  label: string; value: string; icon: typeof TrendingUp;
  tint: string; note?: string; noteTone?: "up" | "down" | "muted" | "danger";
}) {
  const tones = { up: "text-success", down: "text-danger", danger: "text-danger", muted: "text-muted" };
  return (
    <div className="card p-5 flex items-start justify-between">
      <div className="min-w-0">
        <p className="text-xs text-muted font-medium mb-1.5">{label}</p>
        <p className="text-2xl font-bold truncate">{value}</p>
        {note && <p className={`text-xs mt-1.5 font-medium ${tones[noteTone]}`}>{note}</p>}
      </div>
      <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center ${tint}`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
  );
}

export default function RevenueAnalysis() {
  const [data, setData] = useState<Revenue | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/dashboard/revenue")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError(true));
  }, []);

  if (error) return null;
  if (!data) return <div className="card p-5 text-sm text-muted">Loading revenue...</div>;

  const { thisMonth, growthPct, trend, invoices, topClients } = data;
  const growthNote =
    growthPct === null ? "No income last month" : `${growthPct >= 0 ? "▲" : "▼"} ${Math.abs(growthPct).toFixed(1)}% vs last month`;
  const maxBilled = Math.max(1, ...topClients.map((c) => c.billed));

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Revenue analysis</h2>
        <Link href="/finance" className="text-xs font-medium text-primary flex items-center gap-1 hover:underline">
          Open finance <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile
          label="Revenue this month" value={money(thisMonth.income)} icon={TrendingUp}
          tint="bg-success-light text-success" note={growthNote}
          noteTone={growthPct === null ? "muted" : growthPct >= 0 ? "up" : "down"}
        />
        <Tile
          label="Net profit this month" value={money(thisMonth.net)} icon={CircleDollarSign}
          tint="bg-primary-light text-primary" note={`Expenses ${money(thisMonth.expense)}`}
          noteTone={thisMonth.net >= 0 ? "muted" : "danger"}
        />
        <Tile
          label="Outstanding invoices" value={money(invoices.outstanding)} icon={Receipt}
          tint="bg-warning-light text-warning"
          note={invoices.collectionRate === null ? undefined : `${invoices.collectionRate.toFixed(0)}% of billed collected`}
        />
        <Tile
          label="Overdue" value={money(invoices.overdue)} icon={invoices.overdue > 0 ? AlertTriangle : TrendingDown}
          tint="bg-danger-light text-danger"
          note={`${invoices.overdueCount} invoice${invoices.overdueCount === 1 ? "" : "s"} past due`}
          noteTone={invoices.overdueCount > 0 ? "danger" : "muted"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-5 lg:col-span-2">
          <h3 className="font-semibold text-sm mb-4">Income vs expenses: last 6 months</h3>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={trend} barGap={4}>
              <CartesianGrid vertical={false} stroke="#eaeaf3" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#8b8da3" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={compact} tick={{ fontSize: 11, fill: "#8b8da3" }} axisLine={false} tickLine={false} width={52} />
              <Tooltip
                formatter={(v) => money(Number(v))}
                contentStyle={{ borderRadius: 10, border: "1px solid #eaeaf3", fontSize: 12 }}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="income" name="Income" fill="#1dbf73" radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar dataKey="expense" name="Expenses" fill="#f45252" radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Line dataKey="net" name="Net" type="monotone" stroke="#6c5dd3" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h3 className="font-semibold text-sm mb-4">Top clients by billing</h3>
          {topClients.length === 0 && <p className="text-sm text-muted">No invoices yet.</p>}
          <div className="space-y-3.5">
            {topClients.map((c) => (
              <div key={c.name}>
                <div className="flex items-center justify-between text-xs mb-1.5 gap-2">
                  <span className="font-medium truncate">{c.name}</span>
                  <span className="text-muted shrink-0">{money(c.billed)}</span>
                </div>
                {/* full bar = billed, filled part = paid */}
                <div className="h-2 rounded-full bg-primary-light overflow-hidden" style={{ width: `${(c.billed / maxBilled) * 100}%` }}>
                  <div className="h-full bg-primary rounded-full" style={{ width: `${(c.paid / c.billed) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          {topClients.length > 0 && (
            <div className="flex items-center gap-4 mt-4 text-[11px] text-muted">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary" />Paid</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary-light border border-primary/30" />Unpaid</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
