"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";

type Leave = { id: number; type: string; startDate: string; endDate: string; reason: string; status: string };

export default function MyLeavesPage() {
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ type: "casual", startDate: "", endDate: "", reason: "" });
  const [error, setError] = useState("");

  async function load() {
    const l = await fetch("/api/leaves").then((r) => r.json());
    setLeaves(l);
  }
  useEffect(() => { load(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.startDate || !form.endDate) { setError("Fill in all required fields"); return; }
    const res = await fetch("/api/leaves", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) { const d = await res.json(); setError(d.error); return; }
    setModalOpen(false);
    setForm({ type: "casual", startDate: "", endDate: "", reason: "" });
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
              <th className="px-5 py-3 font-medium">Type</th>
              <th className="px-5 py-3 font-medium">Dates</th>
              <th className="px-5 py-3 font-medium">Reason</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {leaves.map((l) => (
              <tr key={l.id} className="border-b border-border last:border-0">
                <td className="px-5 py-3 capitalize text-muted">{l.type}</td>
                <td className="px-5 py-3 text-muted">{l.startDate} → {l.endDate}</td>
                <td className="px-5 py-3 text-muted max-w-[280px] truncate">{l.reason || "N/A"}</td>
                <td className="px-5 py-3"><Badge status={l.status} /></td>
              </tr>
            ))}
            {leaves.length === 0 && <tr><td colSpan={4} className="px-5 py-10 text-center text-muted text-sm">No leave requests yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Request leave">
        <form onSubmit={handleSubmit} className="space-y-4">
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
