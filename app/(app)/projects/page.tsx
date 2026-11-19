"use client";

import { useEffect, useMemo, useState } from "react";
import { FolderKanban, PlayCircle, CircleDollarSign, Hourglass, Plus, Pencil, Trash2, Search, HandCoins } from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { usePermission, usePermissionScope } from "@/components/PermissionsProvider";
import { PROJECT_STATUSES, CLIENT_TYPES, LONG_TERM_MONTHS, durationLabel, isLongTerm, summarizeProjects } from "@/lib/projects";
import { ACCOUNT_SUGGESTIONS, fmtTaka } from "@/lib/finance";
import ProjectPaymentsModal, { type PaymentsInfo } from "@/components/ProjectPaymentsModal";

type Project = {
  id: number; name: string; description: string | null;
  clientName: string; clientType: string; clientEmail: string | null;
  value: number; startDate: string; endDate: string | null; status: string;
  departmentId: number | null; managerId: number | null; clientId: number | null; longTerm: boolean;
  department: { id: number; name: string; color: string | null } | null;
  manager: { id: number; name: string } | null;
  payments: PaymentsInfo | null; // only for finance admins
};
type Dept = { id: number; name: string };
type Emp = { id: number; name: string; departmentId: number | null };

type ClientOpt = { id: number; name: string; type: string };

// clientId: "" = not chosen yet, "new" = create a client from the inline fields, else an id.
const EMPTY_FORM = {
  name: "", description: "", clientId: "", clientName: "", clientType: "client", clientEmail: "",
  value: "", startDate: "", endDate: "", status: "planned", departmentId: "", managerId: "",
  // Money (new projects, finance admins only): advance already received + expected installments.
  hasAdvance: false, advanceAmount: "", advanceDate: "", advanceAccount: "",
  schedule: [] as { label: string; amount: string; dueDate: string }[],
};
const money = (n: number) => `৳${Math.round(n).toLocaleString()}`;
const label = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
const inputCls = "w-full rounded-lg border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [employees, setEmployees] = useState<Emp[]>([]);
  const [clients, setClients] = useState<ClientOpt[]>([]);

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
  const canCreateClient = usePermission("CLIENTS", "CREATE");
  const canMoney = usePermissionScope("FINANCE", "CREATE") === "ALL";
  const [paymentsFor, setPaymentsFor] = useState<number | null>(null);
  const allScope = viewScope === "ALL";

  function loadClients() {
    fetch("/api/clients").then((r) => (r.ok ? r.json() : [])).then(setClients);
  }

  async function load() {
    const res = await fetch("/api/projects");
    setProjects(res.ok ? await res.json() : []);
    setLoading(false);
  }
  useEffect(() => {
    load();
    loadClients();
    fetch("/api/employees").then((r) => (r.ok ? r.json() : [])).then(setEmployees);
    // Arriving from the Clients page ("View projects") pre-fills the search with that client.
    const fromClient = new URLSearchParams(window.location.search).get("client");
    if (fromClient) setQ(fromClient);
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
      name: p.name, description: p.description || "",
      // Older projects with a typed-in client (no clientId) open as "new client" so saving links them.
      clientId: p.clientId ? String(p.clientId) : "new",
      clientName: p.clientName, clientType: p.clientType,
      clientEmail: p.clientEmail || "", value: String(p.value), startDate: p.startDate, endDate: p.endDate || "",
      status: p.status, departmentId: p.departmentId ? String(p.departmentId) : "", managerId: p.managerId ? String(p.managerId) : "",
      hasAdvance: false, advanceAmount: "", advanceDate: "", advanceAccount: "", schedule: [],
    });
    setError("");
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const newClient = form.clientId === "new";
    if (!form.name || !form.clientId || (newClient && !form.clientName.trim()) || form.value === "" || !form.startDate) {
      setError("Project name, client / agency, value, and start date are required");
      return;
    }
    if (form.endDate && form.endDate < form.startDate) { setError("End date can't be before the start date"); return; }
    const withMoney = !editing && canMoney;
    if (withMoney) {
      if (form.hasAdvance && (!(Number(form.advanceAmount) > 0) || !form.advanceDate)) { setError("Enter the advance amount and the date it was received"); return; }
      if (form.schedule.some((s) => !s.label.trim() || !(Number(s.amount) > 0) || !s.dueDate)) { setError("Each scheduled payment needs a name, amount and expected date"); return; }
      if (plannedTotal > Number(form.value) + 0.005) { setError("Advance plus scheduled payments can't be more than the project value"); return; }
    }

    setSaving(true);
    let clientId = Number(form.clientId);
    if (newClient) {
      // Create the client first (or reuse it if that name already exists), then link it.
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.clientName, type: form.clientType, email: form.clientEmail }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) clientId = d.id;
      else if (res.status === 409 && d.id) clientId = d.id;
      else { setSaving(false); setError(d.error || "Couldn't add the client"); return; }
      loadClients();
    }

    const body: Record<string, unknown> = {
      name: form.name,
      description: form.description,
      clientId,
      value: Number(form.value),
      startDate: form.startDate,
      endDate: form.endDate || null,
      status: form.status,
      managerId: form.managerId ? Number(form.managerId) : null,
    };
    // Dept-scoped users are pinned to their own department by the server.
    if (allScope) body.departmentId = form.departmentId ? Number(form.departmentId) : null;
    if (withMoney) {
      if (form.hasAdvance) body.advance = { amount: Number(form.advanceAmount), date: form.advanceDate, account: form.advanceAccount };
      body.schedule = form.schedule.map((s) => ({ label: s.label, amount: Number(s.amount), dueDate: s.dueDate }));
    }

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
  const plannedTotal = (form.hasAdvance ? Number(form.advanceAmount) || 0 : 0) + form.schedule.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const leftToPlan = Math.round(((Number(form.value) || 0) - plannedTotal) * 100) / 100;
  const setRow = (i: number, patch: Partial<{ label: string; amount: string; dueDate: string }>) =>
    setForm({ ...form, schedule: form.schedule.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const paymentsProject = paymentsFor ? projects.find((p) => p.id === paymentsFor) ?? null : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Total projects" value={summary.total} icon={FolderKanban} tint="primary" />
        <StatCard label="Active projects" value={summary.active} icon={PlayCircle} tint="success" />
        <StatCard label="Total project value" value={money(summary.totalValue)} icon={CircleDollarSign} tint="info" />
        <StatCard label="Long-term projects" value={summary.longTerm} icon={Hourglass} tint="warning" />
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center gap-3 justify-between px-4 sm:px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-base">{allScope ? "All projects" : "Team projects"}</h2>
          {canCreate && (
            <button onClick={openAdd} className="flex items-center gap-1.5 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-lg px-4 py-2.5 transition">
              <Plus className="w-4 h-4" /> Add project
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2 px-4 sm:px-5 py-3 border-b border-border">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search project or client..." className={`${inputCls} pl-9 py-2`} />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`${inputCls} w-full sm:w-auto py-2`}>
            <option value="">All statuses</option>
            {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
          </select>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={`${inputCls} w-full sm:w-auto py-2`}>
            <option value="">Clients & agencies</option>
            <option value="client">Clients only</option>
            <option value="agency">Agencies only</option>
          </select>
          <select value={termFilter} onChange={(e) => setTermFilter(e.target.value)} className={`${inputCls} w-full sm:w-auto py-2`}>
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
                {(canEdit || canDelete || canMoney) && <th className="px-5 py-3 font-medium text-right">Action</th>}
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
                      ) : "N/A"}
                    </td>
                  )}
                  <td className="px-5 py-3 text-muted">{p.manager?.name || "N/A"}</td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    <p className="font-semibold">{money(p.value)}</p>
                    {p.payments && (
                      <div className="mt-1 text-[11px] leading-snug">
                        <div className="h-1.5 w-28 ml-auto rounded-full bg-border overflow-hidden mb-1">
                          <div className="h-full bg-success" style={{ width: `${p.value > 0 ? Math.min(100, (p.payments.received / p.value) * 100) : 0}%` }} />
                        </div>
                        <p className="text-success font-medium">{money(p.payments.received)} received</p>
                        {p.payments.due > 0
                          ? <p className="text-warning font-medium">{money(p.payments.due)} due</p>
                          : p.value > 0 && <p className="text-success font-medium">Paid in full</p>}
                        {p.payments.nextDue && (
                          <p className={p.payments.nextDue.overdue ? "text-danger font-medium" : "text-muted"}>
                            {p.payments.nextDue.overdue ? "Overdue: " : "Next: "}{money(p.payments.nextDue.remaining)} by {p.payments.nextDue.dueDate}
                          </p>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-muted whitespace-nowrap">
                    <p>{p.startDate} → {p.endDate || "ongoing"}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-xs">{durationLabel(p.startDate, p.endDate)}</span>
                      <Badge status={p.longTerm ? "long_term" : "short_term"} />
                    </div>
                  </td>
                  <td className="px-5 py-3"><Badge status={p.status} /></td>
                  {(canEdit || canDelete || canMoney) && (
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {canMoney && p.payments && (
                          <button onClick={() => setPaymentsFor(p.id)} title="Payment schedule & payments"
                            className="h-8 px-2.5 rounded-lg border border-success/40 bg-success-light text-success text-xs font-semibold flex items-center gap-1 hover:opacity-80 transition whitespace-nowrap">
                            <HandCoins className="w-3.5 h-3.5" /> Payments
                          </button>
                        )}
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
                <tr><td colSpan={8} className="px-5 py-10 text-left sm:text-center text-muted text-sm">
                  {projects.length === 0 ? "No projects yet." : "No projects match these filters."}
                </td></tr>
              )}
              {loading && <tr><td colSpan={8} className="px-5 py-10 text-left sm:text-center text-muted text-sm">Loading projects...</td></tr>}
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

          <div>
            <label className="text-sm font-medium block mb-1.5">Client / agency</label>
            <select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} className={inputCls}>
              <option value="">Select a client...</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.type === "agency" ? "Agency client" : "Direct client"})</option>)}
              {canCreateClient && <option value="new">+ Add a new client</option>}
            </select>
          </div>
          {form.clientId === "new" && (
            <div className="rounded-xl border border-dashed border-border p-3 space-y-3">
              <p className="text-xs text-muted">This client will be added to the Clients list when you save.</p>
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
            </div>
          )}

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
              {durationLabel(form.startDate, form.endDate || null)}, so this will count as{" "}
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

          {!editing && canMoney && (
            <div className="rounded-xl border border-border p-3.5 space-y-3">
              <p className="text-sm font-semibold flex items-center gap-1.5"><HandCoins className="w-4 h-4 text-success" /> Payments <span className="text-muted font-normal text-xs">(optional)</span></p>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" checked={form.hasAdvance} className="mt-0.5 w-4 h-4 accent-[var(--primary)]"
                  onChange={(e) => setForm({ ...form, hasAdvance: e.target.checked, advanceDate: form.advanceDate || new Date().toISOString().slice(0, 10) })} />
                <span>
                  <span className="text-sm font-medium block">Client paid an advance</span>
                  <span className="text-xs text-muted">It&apos;s added to the Finance Ledger as Cash In from this client.</span>
                </span>
              </label>
              {form.hasAdvance && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs font-medium block mb-1">Advance received (৳)</label>
                    <input type="number" min="0" step="0.01" value={form.advanceAmount} onChange={(e) => setForm({ ...form, advanceAmount: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1">Received on</label>
                    <input type="date" value={form.advanceDate} onChange={(e) => setForm({ ...form, advanceDate: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1">Account</label>
                    <input list="adv-accounts" value={form.advanceAccount} onChange={(e) => setForm({ ...form, advanceAccount: e.target.value })} placeholder="bKash, City Bank..." className={inputCls} />
                    <datalist id="adv-accounts">{ACCOUNT_SUGGESTIONS.map((a) => <option key={a} value={a} />)}</datalist>
                  </div>
                </div>
              )}

              <div>
                <p className="text-sm font-medium">Payment schedule <span className="text-xs text-muted font-normal">(estimated installments)</span></p>
                <div className="space-y-2 mt-2">
                  {form.schedule.map((r, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1fr_auto] sm:grid-cols-[1fr_110px_140px_auto] gap-2">
                      <input value={r.label} onChange={(e) => setRow(i, { label: e.target.value })} placeholder={i === 0 ? "e.g. 2nd payment" : "e.g. Final on delivery"} className={`${inputCls} col-span-3 sm:col-span-1`} />
                      <input type="number" min="0" step="0.01" value={r.amount} onChange={(e) => setRow(i, { amount: e.target.value })} placeholder="Amount" className={inputCls} />
                      <input type="date" value={r.dueDate} onChange={(e) => setRow(i, { dueDate: e.target.value })} className={inputCls} />
                      <button type="button" title="Remove" onClick={() => setForm({ ...form, schedule: form.schedule.filter((_, j) => j !== i) })}
                        className="w-9 h-[42px] rounded-lg border border-border flex items-center justify-center hover:bg-danger-light hover:text-danger"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
                <button type="button"
                  onClick={() => setForm({ ...form, schedule: [...form.schedule, { label: "", amount: leftToPlan > 0 ? String(leftToPlan) : "", dueDate: "" }] })}
                  className="mt-2 text-xs font-semibold text-primary flex items-center gap-1 hover:underline">
                  <Plus className="w-3.5 h-3.5" /> Add expected payment
                </button>
              </div>

              {Number(form.value) > 0 && (plannedTotal > 0) && (
                <p className={`text-xs font-medium ${leftToPlan < 0 ? "text-danger" : leftToPlan === 0 ? "text-success" : "text-muted"}`}>
                  {leftToPlan < 0
                    ? `Planned ${fmtTaka(plannedTotal)} is more than the project value`
                    : leftToPlan === 0
                      ? "The full project value is covered"
                      : `${fmtTaka(leftToPlan)} of ${fmtTaka(Number(form.value))} not scheduled yet (you can add it later)`}
                </p>
              )}
            </div>
          )}
          {editing && canMoney && (
            <p className="text-xs text-muted">To change the advance, schedule or payments, use the <span className="font-semibold">Payments</span> button on the project.</p>
          )}
          {error && <div className="text-sm text-danger bg-danger-light rounded-lg px-3 py-2">{error}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2.5 text-sm font-medium rounded-lg border border-border hover:bg-background">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2.5 text-sm font-semibold rounded-lg bg-primary text-white hover:bg-primary-dark disabled:opacity-60">
              {saving ? "Saving..." : editing ? "Save changes" : "Add project"}
            </button>
          </div>
        </form>
      </Modal>

      <ProjectPaymentsModal project={paymentsProject} onClose={() => setPaymentsFor(null)} onChanged={load} />
    </div>
  );
}
