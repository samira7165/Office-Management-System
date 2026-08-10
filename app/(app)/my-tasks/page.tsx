"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";

type Task = { id: number; title: string; description: string; dueDate: string | null; priority: string; status: string; assigneeId: number | null };

const COLUMNS = [
  { key: "todo", label: "To do" },
  { key: "in_progress", label: "In progress" },
  { key: "done", label: "Done" },
];

export default function MyTasksPage() {
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", dueDate: "", priority: "medium" });
  const [error, setError] = useState("");

  async function load() {
    const t = await fetch("/api/tasks").then((r) => r.json());
    setTasks(t);
  }

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => setEmployeeId(d.user?.employeeId ?? null));
    load();
  }, []);

  const myTasks = useMemo(() => tasks.filter((t) => t.assigneeId === employeeId), [tasks, employeeId]);

  async function moveTask(id: number, status: string) {
    await fetch(`/api/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    load();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.title) { setError("Task title is required"); return; }
    const res = await fetch("/api/tasks", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) { const d = await res.json(); setError(d.error); return; }
    setModalOpen(false);
    setForm({ title: "", description: "", dueDate: "", priority: "medium" });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setModalOpen(true)} className="flex items-center gap-1.5 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-lg px-4 py-2.5 transition">
          <Plus className="w-4 h-4" /> New task
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {COLUMNS.map((col) => (
          <div key={col.key} className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">{col.label}</h3>
              <span className="text-xs text-muted">{myTasks.filter((t) => t.status === col.key).length}</span>
            </div>
            <div className="space-y-3 min-h-[80px]">
              {myTasks.filter((t) => t.status === col.key).map((t) => (
                <div key={t.id} className="border border-border rounded-xl p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{t.title}</p>
                    <Badge status={t.priority} />
                  </div>
                  {t.description && <p className="text-xs text-muted mt-1 line-clamp-2">{t.description}</p>}
                  <div className="flex items-center justify-between mt-3">
                    {t.dueDate ? <span className="text-[11px] text-muted">{t.dueDate}</span> : <span />}
                    <select value={t.status} onChange={(e) => moveTask(t.id, e.target.value)} className="text-[11px] border border-border rounded-md px-1.5 py-1 outline-none">
                      {COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </select>
                  </div>
                </div>
              ))}
              {myTasks.filter((t) => t.status === col.key).length === 0 && (
                <p className="text-xs text-muted text-center py-4">Nothing here.</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New task">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1.5">Title</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1.5">Due date</label>
              <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">Priority</label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
          {error && <div className="text-sm text-danger bg-danger-light rounded-lg px-3 py-2">{error}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2.5 text-sm font-medium rounded-lg border border-border hover:bg-background">Cancel</button>
            <button type="submit" className="px-4 py-2.5 text-sm font-semibold rounded-lg bg-primary text-white hover:bg-primary-dark">Create task</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
