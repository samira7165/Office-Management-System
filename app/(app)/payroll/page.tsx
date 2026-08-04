"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleDollarSign, Plus } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

type Employee = { id: number; name: string; baseSalary: number; avatarColor: string };
type PayRow = { id: number; month: number; year: number; basic: number; bonus: number; deduction: number; net: number; status: string; employee: Employee | null };

export default function PayrollPage() {
  const [rows, setRows] = useState<PayRow[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const now = new Date();
  const [form, setForm] = useState({ employeeId: "", month: String(now.getMonth() + 1), year: String(now.getFullYear()), basic: "", bonus: "0", deduction: "0" });
  const [error, setError] = useState("");

  async function load() {
    const [p, e] = await Promise.all([
      fetch("/api/payroll").then((r) => r.json()),
      fetch("/api/employees").then((r) => r.json()),
    ]);
    setRows(p);
    setEmployees(e);
  }
  useEffect(() => { load(); }, []);

  const totalPaid = useMemo(() => rows.filter((r) => r.status === "paid").reduce((s, r) => s + r.net, 0), [rows]);
  const totalPending = useMemo(() => rows.filter((r) => r.status === "pending").reduce((s, r) => s + r.net, 0), [rows]);

  async function markPaid(id: number) {
    await fetch(`/api/payroll/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "paid" }) });
    load();
  }

  function selectEmployee(id: string) {
    const emp = employees.find((e) => String(e.id) === id);
    setForm({ ...form, employeeId: id, basic: emp ? String(emp.baseSalary) : form.basic });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.employeeId || !form.basic) { setError("Employee and basic salary are required"); return; }
    const res = await fetch("/api/payroll", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, employeeId: Number(form.employeeId), month: Number(form.month), year: Number(form.year), basic: Number(form.basic), bonus: Number(form.bonus), deduction: Number(form.deduction) }),
    });
    if (!res.ok) { const d = await res.json(); setError(d.error); return; }
    setModalOpen(false);
    load();
  }

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

      <div className="flex justify-end">
        <button onClick={() => setModalOpen(true)} className="flex items-center gap-1.5 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-lg px-4 py-2.5 transition">
          <Plus className="w-4 h-4" /> New payroll entry
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted border-b border-border">
              <th className="px-5 py-3 font-medium">Employee</th>
              <th className="px-5 py-3 font-medium">Period</th>
              <th className="px-5 py-3 font-medium">Basic</th>
              <th className="px-5 py-3 font-medium">Bonus</th>
              <th className="px-5 py-3 font-medium">Deduction</th>
              <th className="px-5 py-3 font-medium">Net pay</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0">
                <td className="px-5 py-3 font-medium">{r.employee?.name || "—"}</td>
                <td className="px-5 py-3 text-muted">{MONTHS[r.month - 1]} {r.year}</td>
                <td className="px-5 py-3 text-muted">৳{r.basic.toLocaleString()}</td>
                <td className="px-5 py-3 text-success">+৳{r.bonus.toLocaleString()}</td>
                <td className="px-5 py-3 text-danger">-৳{r.deduction.toLocaleString()}</td>
                <td className="px-5 py-3 font-semibold">৳{r.net.toLocaleString()}</td>
                <td className="px-5 py-3"><Badge status={r.status} /></td>
                <td className="px-5 py-3 text-right">
                  {r.status === "pending" && (
                    <button onClick={() => markPaid(r.id)} className="text-xs font-semibold text-primary hover:underline">Mark paid</button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={8} className="px-5 py-10 text-center text-muted text-sm">No payroll records yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New payroll entry">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1.5">Employee</label>
            <select value={form.employeeId} onChange={(e) => selectEmployee(e.target.value)} className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30">
              <option value="">Select employee</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1.5">Month</label>
              <select value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30">
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">Year</label>
              <input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1.5">Basic (৳)</label>
              <input type="number" value={form.basic} onChange={(e) => setForm({ ...form, basic: e.target.value })} className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">Bonus (৳)</label>
              <input type="number" value={form.bonus} onChange={(e) => setForm({ ...form, bonus: e.target.value })} className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">Deduction (৳)</label>
              <input type="number" value={form.deduction} onChange={(e) => setForm({ ...form, deduction: e.target.value })} className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>
          {error && <div className="text-sm text-danger bg-danger-light rounded-lg px-3 py-2">{error}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2.5 text-sm font-medium rounded-lg border border-border hover:bg-background">Cancel</button>
            <button type="submit" className="px-4 py-2.5 text-sm font-semibold rounded-lg bg-primary text-white hover:bg-primary-dark">Create entry</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
