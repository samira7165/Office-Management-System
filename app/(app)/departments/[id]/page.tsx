"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Users, CircleDollarSign, Landmark, CalendarCheck, Pencil } from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";

type Employee = {
  id: number; name: string; email: string; phone: string; position: string;
  joinDate: string; status: string; avatarColor: string; baseSalary: number;
};
type Head = { id: number; name: string; avatarColor: string } | null;
type Detail = {
  id: number; name: string; description: string; color: string;
  headEmployeeId: number | null; budget: number; head: Head;
  employees: Employee[]; monthlyCost: number; attendanceRate: number;
};
type EmployeeOption = { id: number; name: string };

export default function DepartmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [employeeOptions, setEmployeeOptions] = useState<EmployeeOption[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", color: "#6C5DD3", headEmployeeId: "", budget: "" });
  const [error, setError] = useState("");

  async function load() {
    const [d, e] = await Promise.all([
      fetch(`/api/departments/${id}/detail`).then((r) => r.json()),
      fetch("/api/employees").then((r) => r.json()),
    ]);
    setDetail(d);
    setEmployeeOptions(e);
  }
  useEffect(() => { load(); }, [id]);

  function openEdit() {
    if (!detail) return;
    setForm({
      name: detail.name, description: detail.description, color: detail.color,
      headEmployeeId: detail.headEmployeeId ? String(detail.headEmployeeId) : "", budget: String(detail.budget),
    });
    setError("");
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.name) { setError("Department name is required"); return; }
    const payload = {
      ...form,
      headEmployeeId: form.headEmployeeId ? Number(form.headEmployeeId) : null,
      budget: form.budget ? Number(form.budget) : 0,
    };
    const res = await fetch(`/api/departments/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    if (!res.ok) { const d = await res.json(); setError(d.error); return; }
    setModalOpen(false);
    load();
  }

  if (!detail) return <div className="text-sm text-muted">Loading...</div>;

  const usagePct = detail.budget > 0 ? Math.round((detail.monthlyCost / detail.budget) * 100) : 0;
  const barColor = usagePct > 100 ? "bg-danger" : usagePct >= 80 ? "bg-warning" : "bg-success";

  return (
    <div className="space-y-4">
      <Link href="/departments" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition">
        <ArrowLeft className="w-4 h-4" /> Back to departments
      </Link>

      <div className="card p-5 flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${detail.color}1a`, color: detail.color }}>
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold">{detail.name}</h2>
            <p className="text-sm text-muted mt-0.5">{detail.description || "No description"}</p>
            <div className="flex items-center gap-2 mt-2">
              {detail.head ? (
                <>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-semibold shrink-0" style={{ background: detail.head.avatarColor }}>
                    {detail.head.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                  </div>
                  <span className="text-xs text-muted">{detail.head.name} · Department head</span>
                </>
              ) : (
                <span className="text-xs text-muted">No head assigned</span>
              )}
            </div>
          </div>
        </div>
        <button onClick={openEdit} className="flex items-center gap-1.5 text-sm font-medium rounded-lg border border-border px-3.5 py-2 hover:bg-background transition">
          <Pencil className="w-3.5 h-3.5" /> Edit
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Headcount" value={detail.employees.length} icon={Users} tint="primary" />
        <StatCard label="Monthly payroll cost" value={`৳${detail.monthlyCost.toLocaleString()}`} icon={CircleDollarSign} tint="danger" />
        <StatCard label="Monthly budget" value={`৳${detail.budget.toLocaleString()}`} icon={Landmark} tint="info" />
        <StatCard label="Attendance rate (30d)" value={`${detail.attendanceRate}%`} icon={CalendarCheck} tint="success" />
      </div>

      {detail.budget > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">Budget usage</p>
            <p className="text-sm font-semibold">{usagePct}%</p>
          </div>
          <div className="w-full h-2.5 rounded-full bg-border overflow-hidden">
            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(usagePct, 100)}%` }} />
          </div>
          <p className="text-xs text-muted mt-2">
            ৳{detail.monthlyCost.toLocaleString()} of ৳{detail.budget.toLocaleString()} monthly budget used
            {usagePct > 100 && <span className="text-danger font-medium"> — over budget</span>}
          </p>
        </div>
      )}

      <div className="card overflow-x-auto">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-base">Team members</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted border-b border-border">
              <th className="px-5 py-3 font-medium">Employee</th>
              <th className="px-5 py-3 font-medium">Position</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Join date</th>
            </tr>
          </thead>
          <tbody>
            {detail.employees.map((e) => (
              <tr key={e.id} className="border-b border-border last:border-0">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold" style={{ background: e.avatarColor }}>
                      {e.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                    </div>
                    <p className="font-medium">{e.name}</p>
                  </div>
                </td>
                <td className="px-5 py-3 text-muted">{e.position}</td>
                <td className="px-5 py-3"><Badge status={e.status} /></td>
                <td className="px-5 py-3 text-muted">{e.joinDate}</td>
              </tr>
            ))}
            {detail.employees.length === 0 && (
              <tr><td colSpan={4} className="px-5 py-10 text-center text-muted text-sm">No employees in this department yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Edit department">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1.5">Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Department head</label>
            <select value={form.headEmployeeId} onChange={(e) => setForm({ ...form, headEmployeeId: e.target.value })} className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30">
              <option value="">No head assigned</option>
              {employeeOptions.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1.5">Monthly budget (৳)</label>
              <input type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">Color</label>
              <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-full h-[42px] rounded-lg border border-border" />
            </div>
          </div>
          {error && <div className="text-sm text-danger bg-danger-light rounded-lg px-3 py-2">{error}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2.5 text-sm font-medium rounded-lg border border-border hover:bg-background">Cancel</button>
            <button type="submit" className="px-4 py-2.5 text-sm font-semibold rounded-lg bg-primary text-white hover:bg-primary-dark">Save changes</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
