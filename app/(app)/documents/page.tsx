"use client";

import { useEffect, useState } from "react";
import { Plus, FileText, Trash2, Download } from "lucide-react";
import Modal from "@/components/ui/Modal";

type Employee = { id: number; name: string };
type Doc = { id: number; name: string; category: string; uploadDate: string; size: string; employee: Employee | null };

const CAT_COLORS: Record<string, string> = {
  contract: "var(--primary)", id: "var(--info)", certificate: "var(--success)", general: "var(--muted)",
};

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: "", employeeId: "", category: "general" });
  const [error, setError] = useState("");

  async function load() {
    const [d, e] = await Promise.all([
      fetch("/api/documents").then((r) => r.json()),
      fetch("/api/employees").then((r) => r.json()),
    ]);
    setDocs(d);
    setEmployees(e);
  }
  useEffect(() => { load(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.name) { setError("Document name is required"); return; }
    const res = await fetch("/api/documents", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, employeeId: form.employeeId ? Number(form.employeeId) : null, size: `${Math.floor(Math.random() * 900 + 50)} KB` }),
    });
    if (!res.ok) { const d = await res.json(); setError(d.error); return; }
    setModalOpen(false);
    setForm({ name: "", employeeId: "", category: "general" });
    load();
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this document record?")) return;
    await fetch(`/api/documents/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setModalOpen(true)} className="flex items-center gap-1.5 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-lg px-4 py-2.5 transition">
          <Plus className="w-4 h-4" /> Add document
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {docs.map((d) => (
          <div key={d.id} className="card p-4 flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${CAT_COLORS[d.category]}1a`, color: CAT_COLORS[d.category] }}>
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm truncate">{d.name}</p>
              <p className="text-xs text-muted mt-0.5">{d.employee?.name || "Company-wide"} • {d.size}</p>
              <p className="text-xs text-muted">{d.uploadDate}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <button className="w-7 h-7 rounded-md border border-border flex items-center justify-center text-muted hover:text-primary hover:bg-primary-light transition"><Download className="w-3.5 h-3.5" /></button>
              <button onClick={() => handleDelete(d.id)} className="w-7 h-7 rounded-md border border-border flex items-center justify-center text-muted hover:text-danger hover:bg-danger-light transition"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
        {docs.length === 0 && <p className="text-sm text-muted col-span-full text-center py-10">No documents yet.</p>}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add document">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1.5">Document name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Employment Contract.pdf" className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Employee (optional)</label>
            <select value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30">
              <option value="">Company-wide</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Category</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30">
              <option value="general">General</option>
              <option value="contract">Contract</option>
              <option value="id">ID</option>
              <option value="certificate">Certificate</option>
            </select>
          </div>
          {error && <div className="text-sm text-danger bg-danger-light rounded-lg px-3 py-2">{error}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2.5 text-sm font-medium rounded-lg border border-border hover:bg-background">Cancel</button>
            <button type="submit" className="px-4 py-2.5 text-sm font-semibold rounded-lg bg-primary text-white hover:bg-primary-dark">Add document</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
