"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleDollarSign } from "lucide-react";
import Badge from "@/components/ui/Badge";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

type PayRow = { id: number; month: number; year: number; basic: number; bonus: number; deduction: number; net: number; status: string };

export default function MyPayrollPage() {
  const [rows, setRows] = useState<PayRow[]>([]);

  useEffect(() => {
    fetch("/api/payroll").then((r) => r.json()).then(setRows);
  }, []);

  const totalPaid = useMemo(() => rows.filter((r) => r.status === "paid").reduce((s, r) => s + r.net, 0), [rows]);
  const totalPending = useMemo(() => rows.filter((r) => r.status === "pending").reduce((s, r) => s + r.net, 0), [rows]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-success-light text-success flex items-center justify-center"><CircleDollarSign className="w-5 h-5" /></div>
          <div>
            <p className="text-xs text-muted">Total paid</p>
            <p className="text-xl font-bold">৳{totalPaid.toLocaleString()}</p>
          </div>
        </div>
        <div className="card p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-warning-light text-warning flex items-center justify-center"><CircleDollarSign className="w-5 h-5" /></div>
          <div>
            <p className="text-xs text-muted">Pending payout</p>
            <p className="text-xl font-bold">৳{totalPending.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted border-b border-border">
              <th className="px-5 py-3 font-medium">Period</th>
              <th className="px-5 py-3 font-medium">Basic</th>
              <th className="px-5 py-3 font-medium">Bonus</th>
              <th className="px-5 py-3 font-medium">Deduction</th>
              <th className="px-5 py-3 font-medium">Net pay</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0">
                <td className="px-5 py-3 text-muted">{MONTHS[r.month - 1]} {r.year}</td>
                <td className="px-5 py-3 text-muted">৳{r.basic.toLocaleString()}</td>
                <td className="px-5 py-3 text-success">+৳{r.bonus.toLocaleString()}</td>
                <td className="px-5 py-3 text-danger">-৳{r.deduction.toLocaleString()}</td>
                <td className="px-5 py-3 font-semibold">৳{r.net.toLocaleString()}</td>
                <td className="px-5 py-3"><Badge status={r.status} /></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-left sm:text-center text-muted text-sm">No payroll records yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
