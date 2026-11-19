"use client";

import { useEffect, useMemo, useState } from "react";
import { FolderKanban, PlayCircle, CircleDollarSign, Hourglass, Plus, Pencil, Trash2, Search } from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { usePermission, usePermissionScope } from "@/components/PermissionsProvider";
import { PROJECT_STATUSES, CLIENT_TYPES, LONG_TERM_MONTHS, durationLabel, isLongTerm, summarizeProjects } from "@/lib/projects";

type Project = {
  id: number; name: string; description: string | null;
  clientName: string; clientType: string; clientEmail: string | null;
  value: number; startDate: string; endDate: string | null; status: string;
  departmentId: number | null; managerId: number | null; longTerm: boolean;
  department: { id: number; name: string; color: string | null } | null;
  manager: { id: number; name: string } | null;
};
type Dept = { id: number; name: string };
type Emp = { id: number; name: string; departmentId: number | null };

const EMPTY_FORM = {
  name: "", description: "", clientName: "", clientType: "client", clientEmail: "",
  value: "", startDate: "", endDate: "", status: "planned", departmentId: "", managerId: "",
};
const money = (n: number) => `৳${Math.round(n).toLocaleString()}`;
const label = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
const inputCls = "w-full rounded-lg border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [employees, setEmployees] = useState<Emp[]>([]);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [termFilter, setTermFilter] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const viewScope = usePermissionScope("PROJECTS", "VIEW");
  const canCreate = usePermission("PROJECTS", "CREATE");
  const canEdit = usePermission("PROJECTS", "EDIT");
  const canDelete = usePermission("PROJECTS", "DELETE");
  const allScope = viewScope === "ALL";

  async function load() {
    const res = await fetch("/api/projects");
    setProjects(res.ok ? await res.json() : []);
    setLoading(false);
  }
  useEffect(() => {
    load();
    fetch("/api/employees").then((r) => (r.ok ? r.json() : [])).then(setEmployees);
  }, []);
  useEffect(() => {
    if (allScope) fetch("/api/departments").then((r) => (r.ok ? r.json() : [])).then(setDepartments);
  }, [allScope]);

  const summary = useMemo(() => summarizeProjects(projects), [projects]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return projects.filter((p) =>
      (!statusFilter || p.status === statusFilter) &&
      (!typeFilter || p.clientType === typeFilter) &&
      (!termFilter || (termFilter === "long" ? p.longTerm : !p.longTerm)) &&
      (!needle || p.name.toLowerCase().includes(needle) || p.clientName.toLowerCase().includes(needle))
    );
  }, [projects, q, statusFilter, typeFilter, termFilter]);

  // Manager picker only offers people from the project's department (when one is chosen).
  const managerOptions = useMemo(
    () => (form.departmentId ? employees.filter((e) => String(e.departmentId) === form.departmentId) : employees),
    [employees, form.departmentId]
  );

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError("");
    setModalOpen(true);
  }

  function openEdit(p: Project) {
    setEditing(p);
    setForm({
      name: p.name, description: p.description || "", clientName: p.clientName, clientType: p.clientType,
      clientEmail: p.clientEmail || "", value: String(p.value), startDate: p.startDate, endDate: p.endDate || "",
      status: p.status, departmentId: p.departmentId ? String(p.departmentId) : "", managerId: p.managerId ? String(p.managerId) : "",
    });
    setError("");
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.name || !form.clientName || form.value === "" || !form.startDate) {
      setError("Project name, client / agency, value, and start date are required");
      return;
    }
    if (form.endDate && form.endDate < form.startDate) { setError("End date can't be before the start date"); return; }

    const body: Record<string, unknown> = {
      ...form,
      value: Number(form.value),
      endDate: form.endDate || null,
      managerId: form.managerId ? Number(form.managerId) : null,
    };
    if (allScope) body.departmentId = form.departmentId ? Number(form.departmentId) : null;
    else delete body.departmentId; // server pins dept-scoped users to their own department

    setSaving(true);
    const res = await fetch(editing ? `/api/projects/${editing.id}` : "/api/projects", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || "Couldn't save the project"); return; }
    setModalOpen(false);
    load();
  }

  async function handleDelete(p: Project) {
    if (!confirm(`Delete project "${p.name}"? This can't be undone.`)) return;
    await fetch(`/api/projects/${p.id}`, { method: "DELETE" });
    load();
  }

  const formLongTerm = form.startDate ? isLongTerm(form.startDate, form.endDate || null) : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total projects" value={summary.total} icon={FolderKanban} tint="primary" />
        <StatCard label="Active projects" value={summary.active} icon={PlayCircle} tint="success" />
        <StatCard label="Total project value" value={money(summary.totalValue)} icon={CircleDollarSign} tint="info" />
        <StatCard label="Long-term projects" value={summary.longTerm} icon={Hourglass} tint="warning" />
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center gap-3 justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-base">{allScope ? "All projects" : "Team projects"}</h2>
          {canCreate && (
            <button onClick={openAdd} className="flex items-center gap-1.5 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-lg px-4 py-2.5 transition">
              <Plus className="w-4 h-4" /> Add project
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2 px-5 py-3 border-b border-border">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search project or client..." className={`${inputCls} pl-9 py-2`} />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`${inputCls} w-auto py-2`}>
            <option value="">All statuses</option>
            {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
          </select>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={`${inputCls} w-auto py-2`}>
            <option value="">Clients & agencies</option>
            <option value="client">Clients only</option>
            <option value="agency">Agencies only</option>
          </select>
          <select value={termFilter} onChange={(e) => setTermFilter(e.target.value)} className={`${inputCls} w-auto py-2`}>
            <option value="">Any duration</option>
            <option value="long">Long-term</option>
            <option value="short">Short-term</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted border-b border-border">
                <th className="px-5 py-3 font-medium">Project</th>
                <th className="px-5 py-3 font-medium">Client / agency</th>
                {allScope && <th className="px-5 py-3 font-medium">Department</th>}
                <th className="px-5 py-3 font-medium">Manager</th>
                <th className="px-5 py-3 font-medium text-right">Value</th>
                <th className="px-5 py-3 font-medium">Timeline</th>
                <th className="px-5 py-3 font-medium">Status</th>
                {(canEdit || canDelete) && <th className="px-5 py-3 font-medium text-right">Action</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0 align-top">
                  <td className="px-5 py-3">
                    <p className="font-medium">{p.name}</p>
                    {p.description && <p className="text-xs text-muted max-w-[240px] truncate">{p.description}</p>}
                  </td>
                  <td className="px-5 py-3">
                    <p className="font-medium">{p.clientName}</p>
                    <div className="mt-1"><Badge status={p.clientType} /></div>
                  </td>
                  {allScope && (
                    <td className="px-5 py-3 text-muted">
                      {p.department ? (
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ background: p.department.color || "#6C5DD3" }} />
                          {p.department.name}
                        </span>
                      ) : "—"}
                    </td>
                  )}
                  <td className="px-5 py-3 text-muted">{p.manager?.name || "—"}</td>
                  <td className="px-5 py-3 font-semibold text-right whitespace-nowrap">{money(p.value)}</td>
                  <td className="px-5 py-3 text-muted whitespace-nowrap">
                    <p>{p.startDate} → {p.endDate || "ongoing"}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-xs">{durationLabel(p.startDate, p.endDate)}</span>
                      <Badge status={p.longTerm ? "long_term" : "short_term"} />
                    </div>
                  </td>
                  <td className="px-5 py-3"><Badge status={p.status} /></td>
                  {(canEdit || canDelete) && (
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {canEdit && (
                          <button onClick={() => openEdit(p)} title="Edit" className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-primary-light hover:text-primary transition">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => handleDelete(p)} title="Delete" className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-danger-light hover:text-danger transition">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-muted text-sm">
                  {projects.length === 0 ? "No projects yet." : "No projects match these filters."}
                </td></tr>
              )}
              {loading && <tr><td colSpan={8} className="px-5 py-10 text-center text-muted text-sm">Loading projects...</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit project" : "Add project"} wide>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1.5">Project name</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Description</label>
            <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputCls} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="text-sm font-medium block mb-1.5">Client / agency name</label>
              <input type="text" value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">Type</label>
              <select value={form.clientType} onChange={(e) => setForm({ ...form, clientType: e.target.value })} className={inputCls}>
                {CLIENT_TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Client email</label>
            <input type="email" value={form.clientEmail} onChange={(e) => setForm({ ...form, clientEmail: e.target.value })} className={inputCls} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1.5">Project value (৳)</label>
              <input type="number" min={0} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inputCls}>
                {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1.5">Start date</label>
              <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">End date <span className="text-muted font-normal">(leave empty if ongoing)</span></label>
              <input type="date" value={form.endDate} min={form.startDate || undefined} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className={inputCls} />
            </div>
          </div>
          {formLongTerm !== null && (
            <p className="text-xs text-muted -mt-1">
              {durationLabel(form.startDate, form.endDate || null)} — this will count as{" "}
              <span className="font-semibold text-foreground">{formLongTerm ? "long-term" : "short-term"}</span>{" "}
              (long-term = over {LONG_TERM_MONTHS} months or no end date).
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {allScope && (
              <div>
                <label className="text-sm font-medium block mb-1.5">Department</label>
                <select
                  value={form.departmentId}
                  onChange={(e) => setForm({ ...form, departmentId: e.target.value, managerId: "" })}
                  className={inputCls}
                >
                  <option value="">No department</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="text-sm font-medium block mb-1.5">Project manager</label>
              <select value={form.managerId} onChange={(e) => setForm({ ...form, managerId: e.target.value })} className={inputCls}>
                <option value="">Unassigned</option>
                {managerOptions.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          </div>

          {error && <div className="text-sm text-danger bg-danger-light rounded-lg px-3 py-2">{error}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2.5 text-sm font-medium rounded-lg border border-border hover:bg-background">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2.5 text-sm font-semibold rounded-lg bg-primary text-white hover:bg-primary-dark disabled:opacity-60">
              {saving ? "Saving..." : editing ? "Save changes" : "Add project"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
