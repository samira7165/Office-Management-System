"use client";

import { useEffect, useState } from "react";
import { Plus, Check, X } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";

type Employee = { id: number; name: string; avatarColor: string };
type Leave = { id: number; type: string; startDate: string; endDate: string; reason: string; status: string; employee: Employee | null };

export default function LeavesPage() {
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ employeeId: "", type: "casual", startDate: "", endDate: "", reason: "" });
  const [error, setError] = useState("");

  async function load() {
    const [l, e] = await Promise.all([
      fetch("/api/leaves").then((r) => r.json()),
      fetch("/api/employees").then((r) => r.json()),
    ]);
    setLeaves(l);
    setEmployees(e);
  }
  useEffect(() => { load(); }, []);

  async function updateStatus(id: number, status: string) {
    await fetch(`/api/leaves/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    load();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.employeeId || !form.startDate || !form.endDate) { setError("Fill in all required fields"); return; }
    const res = await fetch("/api/leaves", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, employeeId: Number(form.employeeId) }),
    });
    if (!res.ok) { const d = await res.json(); setError(d.error); return; }
    setModalOpen(false);
    setForm({ employeeId: "", type: "casual", startDate: "", endDate: "", reason: "" });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setModalOpen(true)} className="flex items-center gap-1.5 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-lg px-4 py-2.5 transition">
          <Plus className="w-4 h-4" /> Request leave
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted border-b border-border">
              <th className="px-5 py-3 font-medium">Employee</th>
              <th className="px-5 py-3 font-medium">Type</th>
              <th className="px-5 py-3 font-medium">Dates</th>
              <th className="px-5 py-3 font-medium">Reason</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {leaves.map((l) => (
              <tr key={l.id} className="border-b border-border last:border-0">
                <td className="px-5 py-3 font-medium">{l.employee?.name || "—"}</td>
                <td className="px-5 py-3 capitalize text-muted">{l.type}</td>
                <td className="px-5 py-3 text-muted">{l.startDate} → {l.endDate}</td>
                <td className="px-5 py-3 text-muted max-w-[220px] truncate">{l.reason || "—"}</td>
                <td className="px-5 py-3"><Badge status={l.status} /></td>
                <td className="px-5 py-3">
                  {l.status === "pending" ? (
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => updateStatus(l.id, "approved")} className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-success-light hover:text-success transition">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => updateStatus(l.id, "rejected")} className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-danger-light hover:text-danger transition">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : <span className="text-xs text-muted block text-right">—</span>}
                </td>
              </tr>
            ))}
            {leaves.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-muted text-sm">No leave requests yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Request leave">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1.5">Employee</label>
            <select value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30">
              <option value="">Select employee</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Leave type</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30">
              <option value="casual">Casual</option>
              <option value="sick">Sick</option>
              <option value="annual">Annual</option>
              <option value="unpaid">Unpaid</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1.5">Start date</label>
              <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">End date</label>
              <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Reason</label>
            <textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={3} className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          {error && <div className="text-sm text-danger bg-danger-light rounded-lg px-3 py-2">{error}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2.5 text-sm font-medium rounded-lg border border-border hover:bg-background">Cancel</button>
            <button type="submit" className="px-4 py-2.5 text-sm font-semibold rounded-lg bg-primary text-white hover:bg-primary-dark">Submit request</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
