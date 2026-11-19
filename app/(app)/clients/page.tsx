"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Contact, Building2, Handshake, CircleDollarSign, Plus, Pencil, Trash2, Search, Mail, Phone, ArrowRight } from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { usePermission } from "@/components/PermissionsProvider";
import { CLIENT_TYPES } from "@/lib/projects";

type Client = {
  id: number; name: string; type: string; contactPerson: string | null; email: string | null;
  phone: string | null; address: string | null; notes: string | null;
  projectCount: number; activeProjects: number; totalValue: number;
  invoices: { billed: number; outstanding: number; received: number; dealDue: number } | null;
};

const EMPTY_FORM = { name: "", type: "client", contactPerson: "", email: "", phone: "", address: "", notes: "" };
const money = (n: number) => `৳${Math.round(n).toLocaleString()}`;
const label = (s: string) => s.replace(/^\w/, (c) => c.toUpperCase());
const inputCls = "w-full rounded-lg border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30";

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const canCreate = usePermission("CLIENTS", "CREATE");
  const canEdit = usePermission("CLIENTS", "EDIT");
  const canDelete = usePermission("CLIENTS", "DELETE");
  const canSeeProjects = usePermission("PROJECTS", "VIEW");

  async function load() {
    const res = await fetch("/api/clients");
    setClients(res.ok ? await res.json() : []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const showFinance = clients.some((c) => c.invoices !== null);
  const stats = useMemo(() => ({
    total: clients.length,
    agencies: clients.filter((c) => c.type === "agency").length,
    direct: clients.filter((c) => c.type !== "agency").length,
    value: clients.reduce((s, c) => s + c.totalValue, 0),
  }), [clients]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return clients.filter((c) =>
      (!typeFilter || c.type === typeFilter) &&
      (!needle || [c.name, c.contactPerson, c.email, c.phone].some((v) => v?.toLowerCase().includes(needle)))
    );
  }, [clients, q, typeFilter]);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError("");
    setModalOpen(true);
  }

  function openEdit(c: Client) {
    setEditing(c);
    setForm({
      name: c.name, type: c.type, contactPerson: c.contactPerson || "", email: c.email || "",
      phone: c.phone || "", address: c.address || "", notes: c.notes || "",
    });
    setError("");
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) { setError("Client name is required"); return; }
    setSaving(true);
    const res = await fetch(editing ? `/api/clients/${editing.id}` : "/api/clients", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || "Couldn't save the client"); return; }
    setModalOpen(false);
    load();
  }

  async function handleDelete(c: Client) {
    if (!confirm(`Delete client "${c.name}"?`)) return;
    const res = await fetch(`/api/clients/${c.id}`, { method: "DELETE" });
    if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || "Couldn't delete the client"); return; }
    load();
  }

  const cols = 5 + (showFinance ? 1 : 0) + (canEdit || canDelete ? 1 : 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total clients" value={stats.total} icon={Contact} tint="primary" />
        <StatCard label="Direct clients" value={stats.direct} icon={Building2} tint="info" />
        <StatCard label="Agencies" value={stats.agencies} icon={Handshake} tint="warning" />
        <StatCard label="Total project value" value={money(stats.value)} icon={CircleDollarSign} tint="success" />
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center gap-3 justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-base">Clients & agencies</h2>
          {canCreate && (
            <button onClick={openAdd} className="flex items-center gap-1.5 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-lg px-4 py-2.5 transition">
              <Plus className="w-4 h-4" /> Add client
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2 px-5 py-3 border-b border-border">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, contact, email, phone..." className={`${inputCls} pl-9 py-2`} />
          </div>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={`${inputCls} w-auto py-2`}>
            <option value="">Clients & agencies</option>
            <option value="client">Clients only</option>
            <option value="agency">Agencies only</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted border-b border-border">
                <th className="px-5 py-3 font-medium">Client</th>
                <th className="px-5 py-3 font-medium">Contact</th>
                <th className="px-5 py-3 font-medium text-right">Projects</th>
                <th className="px-5 py-3 font-medium text-right">Project value</th>
                {showFinance && <th className="px-5 py-3 font-medium text-right">Received / invoiced</th>}
                <th className="px-5 py-3 font-medium" />
                {(canEdit || canDelete) && <th className="px-5 py-3 font-medium text-right">Action</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 align-top">
                  <td className="px-5 py-3">
                    <p className="font-medium">{c.name}</p>
                    <div className="mt-1"><Badge status={c.type} /></div>
                    {c.address && <p className="text-xs text-muted mt-1 max-w-[220px] truncate">{c.address}</p>}
                  </td>
                  <td className="px-5 py-3 text-muted">
                    {c.contactPerson && <p className="text-foreground">{c.contactPerson}</p>}
                    {c.email && <p className="flex items-center gap-1.5 text-xs mt-0.5"><Mail className="w-3 h-3" />{c.email}</p>}
                    {c.phone && <p className="flex items-center gap-1.5 text-xs mt-0.5"><Phone className="w-3 h-3" />{c.phone}</p>}
                    {!c.contactPerson && !c.email && !c.phone && "N/A"}
                  </td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    <p className="font-semibold">{c.projectCount}</p>
                    {c.activeProjects > 0 && <p className="text-xs text-success">{c.activeProjects} active</p>}
                  </td>
                  <td className="px-5 py-3 text-right font-semibold whitespace-nowrap">{money(c.totalValue)}</td>
                  {showFinance && (
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <p className="text-success font-semibold">{money(c.invoices?.received ?? 0)}</p>
                      {(c.invoices?.dealDue ?? 0) > 0 && <p className="text-xs text-danger font-medium">{money(c.invoices!.dealDue)} due after advance</p>}
                      <p className="text-xs text-muted">{money(c.invoices?.billed ?? 0)} invoiced</p>
                      {(c.invoices?.outstanding ?? 0) > 0 && <p className="text-xs text-warning">{money(c.invoices!.outstanding)} due</p>}
                    </td>
                  )}
                  <td className="px-5 py-3 whitespace-nowrap">
                    {canSeeProjects && c.projectCount > 0 && (
                      <Link href={`/projects?client=${encodeURIComponent(c.name)}`} className="text-xs font-medium text-primary inline-flex items-center gap-1 hover:underline">
                        View projects <ArrowRight className="w-3 h-3" />
                      </Link>
                    )}
                  </td>
                  {(canEdit || canDelete) && (
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {canEdit && (
                          <button onClick={() => openEdit(c)} title="Edit" className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-primary-light hover:text-primary transition">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => handleDelete(c)} title="Delete" className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-danger-light hover:text-danger transition">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={cols} className="px-5 py-10 text-center text-muted text-sm">
                  {clients.length === 0 ? "No clients yet." : "No clients match your search."}
                </td></tr>
              )}
              {loading && <tr><td colSpan={cols} className="px-5 py-10 text-center text-muted text-sm">Loading clients...</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit client" : "Add client"} wide>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="text-sm font-medium block mb-1.5">Client / agency name</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={inputCls}>
                {CLIENT_TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1.5">Contact person</label>
              <input type="text" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">Phone</label>
              <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Address</label>
            <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Notes</label>
            <textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputCls} />
          </div>
          {editing && editing.projectCount > 0 && (
            <p className="text-xs text-muted">Changes to the name, type or email also update this client&apos;s {editing.projectCount} project{editing.projectCount === 1 ? "" : "s"}.</p>
          )}
          {error && <div className="text-sm text-danger bg-danger-light rounded-lg px-3 py-2">{error}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2.5 text-sm font-medium rounded-lg border border-border hover:bg-background">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2.5 text-sm font-semibold rounded-lg bg-primary text-white hover:bg-primary-dark disabled:opacity-60">
              {saving ? "Saving..." : editing ? "Save changes" : "Add client"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
