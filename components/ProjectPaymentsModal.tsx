"use client";

import { useState } from "react";
import { CalendarClock, HandCoins, Pencil, Trash2, Check, X, Plus, ImageIcon } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import { ACCOUNT_SUGGESTIONS, fmtTaka } from "@/lib/finance";

export type Installment = { id: number; label: string; amount: number; dueDate: string; paid: number; status: string };
export type PaymentsInfo = {
  received: number; due: number; scheduled: number; unscheduled: number;
  installments: Installment[];
  nextDue: { id: number; label: string; remaining: number; dueDate: string; overdue: boolean } | null;
  payments: { id: number; amount: number; date: string; account: string | null; description: string | null; installmentId: number | null; hasReceipt: boolean }[];
};
type ProjectLite = { id: number; name: string; value: number; clientName: string; payments: PaymentsInfo | null };

const today = () => new Date().toISOString().slice(0, 10);
const inputCls = "w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30";

export default function ProjectPaymentsModal({
  project, onClose, onChanged,
}: { project: ProjectLite | null; onClose: () => void; onChanged: () => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pay, setPay] = useState({ amount: "", date: today(), account: "", installmentId: "", description: "" });
  const [inst, setInst] = useState({ label: "", amount: "", dueDate: "" });
  const [editId, setEditId] = useState<number | null>(null);
  const [edit, setEdit] = useState({ label: "", amount: "", dueDate: "" });

  if (!project || !project.payments) return null;
  const p = project.payments;
  const pct = project.value > 0 ? Math.min(100, (p.received / project.value) * 100) : 0;
  const instLabel = (id: number | null) => p.installments.find((i) => i.id === id)?.label;

  async function call(url: string, method: string, body?: unknown) {
    setBusy(true);
    setError("");
    const res = await fetch(url, {
      method, headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    setBusy(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || "Something went wrong"); return false; }
    onChanged();
    return true;
  }

  function startPayment(i?: Installment) {
    setPay({
      amount: i ? String(Math.round((i.amount - i.paid) * 100) / 100) : String(p.due),
      date: today(), account: pay.account, installmentId: i ? String(i.id) : "", description: "",
    });
    setError("");
  }

  async function recordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!(Number(pay.amount) > 0)) { setError("Enter the amount received"); return; }
    const ok = await call(`/api/projects/${project!.id}/payments`, "POST", {
      ...pay, amount: Number(pay.amount), installmentId: pay.installmentId ? Number(pay.installmentId) : null,
    });
    if (ok) setPay({ amount: "", date: today(), account: pay.account, installmentId: "", description: "" });
  }

  async function addInstallment(e: React.FormEvent) {
    e.preventDefault();
    const ok = await call(`/api/projects/${project!.id}/installments`, "POST", { ...inst, amount: Number(inst.amount) });
    if (ok) setInst({ label: "", amount: "", dueDate: "" });
  }

  async function saveEdit(id: number) {
    const ok = await call(`/api/projects/${project!.id}/installments/${id}`, "PATCH", { ...edit, amount: Number(edit.amount) });
    if (ok) setEditId(null);
  }

  async function removeInstallment(i: Installment) {
    if (!confirm(`Remove "${i.label}" from the schedule?${i.paid > 0 ? " Payments already made stay recorded." : ""}`)) return;
    await call(`/api/projects/${project!.id}/installments/${i.id}`, "DELETE");
  }

  return (
    <Modal open onClose={onClose} title={`Payments: ${project.name}`} wide>
      <div className="space-y-5">
        {/* Summary */}
        <div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-background p-3">
              <p className="text-[11px] text-muted font-medium">Project value</p>
              <p className="font-bold">{fmtTaka(project.value)}</p>
            </div>
            <div className="rounded-xl bg-success-light p-3">
              <p className="text-[11px] text-muted font-medium">Received</p>
              <p className="font-bold text-success">{fmtTaka(p.received)}</p>
            </div>
            <div className={`rounded-xl p-3 ${p.due > 0 ? "bg-warning-light" : "bg-success-light"}`}>
              <p className="text-[11px] text-muted font-medium">Due</p>
              <p className={`font-bold ${p.due > 0 ? "text-warning" : "text-success"}`}>{p.due > 0 ? fmtTaka(p.due) : "Paid in full"}</p>
            </div>
          </div>
          <div className="h-2 rounded-full bg-border overflow-hidden mt-3">
            <div className="h-full bg-success rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-muted mt-1.5">{project.clientName} · {pct.toFixed(0)}% received</p>
        </div>

        {/* Schedule (estimate) */}
        <section>
          <h3 className="font-semibold text-sm flex items-center gap-1.5 mb-2"><CalendarClock className="w-4 h-4 text-primary" /> Payment schedule</h3>
          {p.installments.length === 0 && <p className="text-sm text-muted mb-2">No installments planned yet.</p>}
          <div className="space-y-2">
            {p.installments.map((i) => (
              <div key={i.id} className="rounded-xl border border-border p-3">
                {editId === i.id ? (
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_140px_auto] gap-2 items-center">
                    <input value={edit.label} onChange={(e) => setEdit({ ...edit, label: e.target.value })} className={inputCls} />
                    <input type="number" min="0" step="0.01" value={edit.amount} onChange={(e) => setEdit({ ...edit, amount: e.target.value })} className={inputCls} />
                    <input type="date" value={edit.dueDate} onChange={(e) => setEdit({ ...edit, dueDate: e.target.value })} className={inputCls} />
                    <div className="flex gap-1.5">
                      <button onClick={() => saveEdit(i.id)} disabled={busy} title="Save" className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center"><Check className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setEditId(null)} title="Cancel" className="w-8 h-8 rounded-lg border border-border flex items-center justify-center"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm flex items-center gap-2">{i.label} <Badge status={i.status} /></p>
                      <p className="text-xs text-muted mt-0.5">
                        Expected {fmtTaka(i.amount)} by {i.dueDate}
                        {i.paid > 0 && i.paid < i.amount && <> · <span className="text-success font-medium">{fmtTaka(i.paid)} paid</span></>}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {i.status !== "paid" && p.due > 0 && (
                        <button onClick={() => startPayment(i)} className="h-8 px-2.5 rounded-lg border border-success/40 bg-success-light text-success text-xs font-semibold flex items-center gap-1">
                          <HandCoins className="w-3.5 h-3.5" /> Record
                        </button>
                      )}
                      <button onClick={() => { setEditId(i.id); setEdit({ label: i.label, amount: String(i.amount), dueDate: i.dueDate }); }} title="Edit"
                        className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-primary-light hover:text-primary"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => removeInstallment(i)} title="Remove"
                        className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-danger-light hover:text-danger"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          {p.unscheduled > 0 ? (
            <form onSubmit={addInstallment} className="mt-2 rounded-xl border border-dashed border-border p-3">
              <p className="text-xs text-muted mb-2">{fmtTaka(p.unscheduled)} of the project value isn&apos;t scheduled yet. Add an expected installment:</p>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_140px_auto] gap-2">
                <input value={inst.label} onChange={(e) => setInst({ ...inst, label: e.target.value })} placeholder="e.g. 2nd payment" className={inputCls} />
                <input type="number" min="0" step="0.01" value={inst.amount} onChange={(e) => setInst({ ...inst, amount: e.target.value })} placeholder="Amount" className={inputCls} />
                <input type="date" value={inst.dueDate} onChange={(e) => setInst({ ...inst, dueDate: e.target.value })} className={inputCls} />
                <button type="submit" disabled={busy} className="h-[38px] px-3 rounded-lg bg-primary text-white text-sm font-semibold flex items-center gap-1 justify-center disabled:opacity-60"><Plus className="w-4 h-4" /> Add</button>
              </div>
            </form>
          ) : (
            p.installments.length > 0 && <p className="text-xs text-success mt-2">The full project value is scheduled.</p>
          )}
        </section>

        {/* Record a payment */}
        {p.due > 0 && (
          <section>
            <h3 className="font-semibold text-sm flex items-center gap-1.5 mb-2"><HandCoins className="w-4 h-4 text-success" /> Record a payment received</h3>
            <form onSubmit={recordPayment} className="rounded-xl border border-border p-3 space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <input type="number" min="0" step="0.01" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} placeholder={`Max ${fmtTaka(p.due)}`} className={inputCls} />
                <input type="date" value={pay.date} onChange={(e) => setPay({ ...pay, date: e.target.value })} className={inputCls} />
                <input list="pay-accounts" value={pay.account} onChange={(e) => setPay({ ...pay, account: e.target.value })} placeholder="Account (bKash...)" className={inputCls} />
                <datalist id="pay-accounts">{ACCOUNT_SUGGESTIONS.map((a) => <option key={a} value={a} />)}</datalist>
                <select value={pay.installmentId} onChange={(e) => setPay({ ...pay, installmentId: e.target.value })} className={inputCls}>
                  <option value="">Not for a specific installment</option>
                  {p.installments.filter((i) => i.status !== "paid").map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <input value={pay.description} onChange={(e) => setPay({ ...pay, description: e.target.value })} placeholder="Note / TrxID (optional)" className={inputCls} />
                <button type="submit" disabled={busy} className="shrink-0 px-4 rounded-lg bg-success text-white text-sm font-semibold disabled:opacity-60">{busy ? "Saving..." : "Record payment"}</button>
              </div>
              <p className="text-[11px] text-muted">Saved to the Finance Ledger as Cash In for {project.clientName}. Attach a receipt there if you have one.</p>
            </form>
          </section>
        )}

        {error && <div className="text-sm text-danger bg-danger-light rounded-lg px-3 py-2">{error}</div>}

        {/* Payments received */}
        <section>
          <h3 className="font-semibold text-sm mb-2">Payments received</h3>
          {p.payments.length === 0 ? (
            <p className="text-sm text-muted">Nothing received yet.</p>
          ) : (
            <div className="rounded-xl border border-border divide-y divide-border">
              {p.payments.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">{t.date}{instLabel(t.installmentId) && <span className="text-muted font-normal"> · {instLabel(t.installmentId)}</span>}</p>
                    <p className="text-xs text-muted truncate">{[t.account, t.description].filter(Boolean).join(" · ") || "No note"}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {t.hasReceipt && (
                      <a href={`/api/transactions/${t.id}/receipt`} target="_blank" rel="noopener" title="View receipt" className="text-info"><ImageIcon className="w-4 h-4" /></a>
                    )}
                    <span className="font-semibold text-success">+ {fmtTaka(t.amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </Modal>
  );
}
