"use client";

import { useEffect, useState } from "react";
import { Plus, Search, Pencil, Trash2, Mail, Phone } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";

type Dept = { id: number; name: string };
type Employee = {
  id: number; name: string; email: string; phone: string; position: string;
  departmentId: number | null; joinDate: string; status: string; avatarColor: string;
  baseSalary: number; address: string; department: Dept | null;
};

const EMPTY = {
  name: "", email: "", phone: "", position: "", departmentId: "", joinDate: new Date().toISOString().slice(0, 10),
  status: "active", baseSalary: "", address: "",
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [q, setQ] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);
  const [error, setError] = useState("");

  async function load() {
    const [e, d] = await Promise.all([
      fetch("/api/employees").then((r) => r.json()),
      fetch("/api/departments").then((r) => r.json()),
    ]);
    setEmployees(e);
    setDepartments(d);
  }

  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY);
    setError("");
    setModalOpen(true);
  }

  function openEdit(emp: Employee) {
    setEditing(emp);
    setForm({
      name: emp.name, email: emp.email, phone: emp.phone, position: emp.position,
      departmentId: emp.departmentId ? String(emp.departmentId) : "",
      joinDate: emp.joinDate, status: emp.status, baseSalary: String(emp.baseSalary), address: emp.address,
    });
    setError("");
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const payload = {
      ...form,
      departmentId: form.departmentId ? Number(form.departmentId) : null,
      baseSalary: form.baseSalary ? Number(form.baseSalary) : 0,
    };
    const res = await fetch(editing ? `/api/employees/${editing.id}` : "/api/employees", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "Something went wrong");
      return;
    }
    setModalOpen(false);
    load();
  }

  async function handleDelete(id: number) {
    if (!confirm("Remove this employee?")) return;
    await fetch(`/api/employees/${id}`, { method: "DELETE" });
    load();
  }

  const filtered = employees.filter((e) =>
    (e.name + e.email + e.position).toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2 w-full sm:w-72">
          <Search className="w-4 h-4 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search employees..." className="bg-transparent text-sm outline-none w-full" />
        </div>
        <button onClick={openAdd} className="flex items-center gap-1.5 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-lg px-4 py-2.5 transition">
          <Plus className="w-4 h-4" /> Add employee
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted border-b border-border">
              <th className="px-5 py-3 font-medium">Employee</th>
              <th className="px-5 py-3 font-medium">Department</th>
              <th className="px-5 py-3 font-medium">Contact</th>
              <th className="px-5 py-3 font-medium">Join date</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id} className="border-b border-border last:border-0 hover:bg-background/60">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold" style={{ background: e.avatarColor }}>
                      {e.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                    </div>
                    <div>
                      <p className="font-medium">{e.name}</p>
                      <p className="text-xs text-muted">{e.position}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3 text-muted">{e.department?.name || "—"}</td>
                <td className="px-5 py-3">
                  <p className="flex items-center gap-1.5 text-xs text-muted"><Mail className="w-3 h-3" />{e.email}</p>
                  <p className="flex items-center gap-1.5 text-xs text-muted mt-0.5"><Phone className="w-3 h-3" />{e.phone || "—"}</p>
                </td>
                <td className="px-5 py-3 text-muted">{e.joinDate}</td>
                <td className="px-5 py-3"><Badge status={e.status} /></td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => openEdit(e)} className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-primary-light hover:text-primary transition">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(e.id)} className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-danger-light hover:text-danger transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-10 text-center text-muted text-sm">No employees found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit employee" : "Add employee"} wide>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Full name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
          <Field label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required />
          <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          <Field label="Position" value={form.position} onChange={(v) => setForm({ ...form, position: v })} required />
          <div>
            <label className="text-sm font-medium block mb-1.5">Department</label>
            <select value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })} className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30">
              <option value="">Unassigned</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Status</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30">
              <option value="active">Active</option>
              <option value="on_leave">On leave</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <Field label="Join date" type="date" value={form.joinDate} onChange={(v) => setForm({ ...form, joinDate: v })} />
          <Field label="Base salary (৳)" type="number" value={form.baseSalary} onChange={(v) => setForm({ ...form, baseSalary: v })} />
          <div className="sm:col-span-2">
            <Field label="Address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
          </div>

          {error && <div className="sm:col-span-2 text-sm text-danger bg-danger-light rounded-lg px-3 py-2">{error}</div>}

          <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2.5 text-sm font-medium rounded-lg border border-border hover:bg-background">Cancel</button>
            <button type="submit" className="px-4 py-2.5 text-sm font-semibold rounded-lg bg-primary text-white hover:bg-primary-dark">{editing ? "Save changes" : "Add employee"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <div>
      <label className="text-sm font-medium block mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
      />
    </div>
  );
}
