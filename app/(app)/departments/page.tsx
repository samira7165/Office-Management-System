"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Users, Pencil } from "lucide-react";
import Modal from "@/components/ui/Modal";

type Head = { id: number; name: string; avatarColor: string } | null;
type Employee = { id: number; name: string };
type Dept = {
  id: number; name: string; description: string; color: string; headcount: number;
  headEmployeeId: number | null; budget: number; head: Head;
};

const EMPTY = { name: "", description: "", color: "#6C5DD3", headEmployeeId: "", budget: "" };

export default function DepartmentsPage() {
  const [depts, setDepts] = useState<Dept[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Dept | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");

  async function load() {
    const [d, e] = await Promise.all([
      fetch("/api/departments").then((r) => r.json()),
      fetch("/api/employees").then((r) => r.json()),
    ]);
    setDepts(d);
    setEmployees(e);
  }
  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY);
    setError("");
    setModalOpen(true);
  }

  function openEdit(d: Dept) {
    setEditing(d);
    setForm({
      name: d.name, description: d.description, color: d.color,
      headEmployeeId: d.headEmployeeId ? String(d.headEmployeeId) : "", budget: String(d.budget),
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
    const res = await fetch(editing ? `/api/departments/${editing.id}` : "/api/departments", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) { const d = await res.json(); setError(d.error); return; }
    setModalOpen(false);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={openAdd} className="flex items-center gap-1.5 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-lg px-4 py-2.5 transition">
          <Plus className="w-4 h-4" /> Add department
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {depts.map((d) => (
          <Link key={d.id} href={`/departments/${d.id}`} className="card p-5 block relative group hover:shadow-md transition">
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); openEdit(d); }}
              className="absolute top-4 right-4 w-7 h-7 rounded-md border border-border flex items-center justify-center text-muted hover:text-primary hover:bg-primary-light transition opacity-0 group-hover:opacity-100"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: `${d.color}1a`, color: d.color }}>
              <Users className="w-5 h-5" />
            </div>
            <p className="font-semibold">{d.name}</p>
            <p className="text-xs text-muted mt-1 line-clamp-2">{d.description || "No description"}</p>

            <div className="flex items-center gap-2 mt-3">
              {d.head ? (
                <>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-semibold shrink-0" style={{ background: d.head.avatarColor }}>
                    {d.head.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                  </div>
                  <span className="text-xs text-muted truncate">{d.head.name}</span>
                </>
              ) : (
                <span className="text-xs text-muted">No head assigned</span>
              )}
            </div>

            <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
              <span className="text-xs text-muted">Headcount</span>
              <span className="text-sm font-semibold">{d.headcount}</span>
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-xs text-muted">Monthly budget</span>
              <span className="text-sm font-semibold">৳{d.budget.toLocaleString()}</span>
            </div>
          </Link>
        ))}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit department" : "Add department"}>
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
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
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
            <button type="submit" className="px-4 py-2.5 text-sm font-semibold rounded-lg bg-primary text-white hover:bg-primary-dark">{editing ? "Save changes" : "Add department"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
