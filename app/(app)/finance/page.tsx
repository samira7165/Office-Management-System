"use client";

import { useEffect, useMemo, useState } from "react";
import { TrendingUp, TrendingDown, CircleDollarSign, Receipt, Plus, Trash2 } from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";

type Transaction = { id: number; type: string; category: string; description: string; amount: number; date: string; method: string };
type Invoice = { id: number; invoiceNo: string; clientName: string; clientEmail: string; amount: number; issueDate: string; dueDate: string; status: string; notes: string };

const CATEGORIES = ["sales", "salaries", "rent", "utilities", "marketing", "software", "other"];
const METHODS = ["bank", "cash", "mobile_banking", "card"];

export default function FinancePage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [role, setRole] = useState("");

  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txForm, setTxForm] = useState({ type: "income", category: "sales", description: "", amount: "", date: "", method: "bank" });
  const [txError, setTxError] = useState("");

  const [invModalOpen, setInvModalOpen] = useState(false);
  const [invForm, setInvForm] = useState({ clientName: "", clientEmail: "", amount: "", issueDate: "", dueDate: "", notes: "" });
  const [invError, setInvError] = useState("");

  async function load() {
    const [t, i] = await Promise.all([
      fetch("/api/transactions").then((r) => r.json()),
      fetch("/api/invoices").then((r) => r.json()),
    ]);
    setTransactions(t);
    setInvoices(i);
  }
  useEffect(() => { load(); }, []);
  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => setRole(d.user?.role || ""));
  }, []);

  const totalIncome = useMemo(() => transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0), [transactions]);
  const totalExpenses = useMemo(() => transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0), [transactions]);
  const netProfit = totalIncome - totalExpenses;
  const outstanding = useMemo(() => invoices.filter((i) => i.status === "unpaid" || i.status === "overdue").reduce((s, i) => s + i.amount, 0), [invoices]);

  async function markPaid(id: number) {
    await fetch(`/api/invoices/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "paid" }) });
    load();
  }

  async function handleDeleteInvoice(id: number) {
    if (!confirm("Delete this invoice?")) return;
    await fetch(`/api/invoices/${id}`, { method: "DELETE" });
    load();
  }

  async function handleTxSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTxError("");
    if (!txForm.type || !txForm.category || !txForm.amount || !txForm.date) { setTxError("Type, category, amount, and date are required"); return; }
    const res = await fetch("/api/transactions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...txForm, amount: Number(txForm.amount) }),
    });
    if (!res.ok) { const d = await res.json(); setTxError(d.error); return; }
    setTxModalOpen(false);
    setTxForm({ type: "income", category: "sales", description: "", amount: "", date: "", method: "bank" });
    load();
  }

  async function handleInvSubmit(e: React.FormEvent) {
    e.preventDefault();
    setInvError("");
    if (!invForm.clientName || !invForm.amount || !invForm.issueDate || !invForm.dueDate) { setInvError("Client, amount, issue date, and due date are required"); return; }
    const res = await fetch("/api/invoices", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...invForm, amount: Number(invForm.amount) }),
    });
    if (!res.ok) { const d = await res.json(); setInvError(d.error); return; }
    setInvModalOpen(false);
    setInvForm({ clientName: "", clientEmail: "", amount: "", issueDate: "", dueDate: "", notes: "" });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total income" value={`৳${totalIncome.toLocaleString()}`} icon={TrendingUp} tint="success" />
        <StatCard label="Total expenses" value={`৳${totalExpenses.toLocaleString()}`} icon={TrendingDown} tint="danger" />
        <StatCard label="Net profit" value={`৳${netProfit.toLocaleString()}`} icon={CircleDollarSign} tint="primary" />
        <StatCard label="Outstanding invoices" value={`৳${outstanding.toLocaleString()}`} icon={Receipt} tint="warning" />
      </div>

      <div className="card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-base">Transactions</h2>
          <button onClick={() => setTxModalOpen(true)} className="flex items-center gap-1.5 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-lg px-4 py-2.5 transition">
            <Plus className="w-4 h-4" /> Add transaction
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted border-b border-border">
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Category</th>
                <th className="px-5 py-3 font-medium">Description</th>
                <th className="px-5 py-3 font-medium">Amount</th>
                <th className="px-5 py-3 font-medium">Method</th>
                <th className="px-5 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} className="border-b border-border last:border-0">
                  <td className="px-5 py-3"><Badge status={t.type} /></td>
                  <td className="px-5 py-3 capitalize text-muted">{t.category}</td>
                  <td className="px-5 py-3 text-muted max-w-[220px] truncate">{t.description || "—"}</td>
                  <td className={`px-5 py-3 font-semibold ${t.type === "income" ? "text-success" : "text-danger"}`}>
                    {t.type === "income" ? "+" : "-"}৳{t.amount.toLocaleString()}
                  </td>
                  <td className="px-5 py-3 capitalize text-muted">{t.method.replace("_", " ")}</td>
                  <td className="px-5 py-3 text-muted">{t.date}</td>
                </tr>
              ))}
              {transactions.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-muted text-sm">No transactions yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-base">Invoices</h2>
          <button onClick={() => setInvModalOpen(true)} className="flex items-center gap-1.5 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-lg px-4 py-2.5 transition">
            <Plus className="w-4 h-4" /> Add invoice
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted border-b border-border">
                <th className="px-5 py-3 font-medium">Invoice no.</th>
                <th className="px-5 py-3 font-medium">Client</th>
                <th className="px-5 py-3 font-medium">Amount</th>
                <th className="px-5 py-3 font-medium">Issue date</th>
                <th className="px-5 py-3 font-medium">Due date</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={i.id} className="border-b border-border last:border-0">
                  <td className="px-5 py-3 font-medium">{i.invoiceNo}</td>
                  <td className="px-5 py-3 text-muted">{i.clientName}</td>
                  <td className="px-5 py-3 font-semibold">৳{i.amount.toLocaleString()}</td>
                  <td className="px-5 py-3 text-muted">{i.issueDate}</td>
                  <td className="px-5 py-3 text-muted">{i.dueDate}</td>
                  <td className="px-5 py-3"><Badge status={i.status} /></td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-3">
                      {(i.status === "unpaid" || i.status === "overdue") && (
                        <button onClick={() => markPaid(i.id)} className="text-xs font-semibold text-primary hover:underline">Mark paid</button>
                      )}
                      {role === "admin" && (
                        <button onClick={() => handleDeleteInvoice(i.id)} className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-danger-light hover:text-danger transition">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && <tr><td colSpan={7} className="px-5 py-10 text-center text-muted text-sm">No invoices yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={txModalOpen} onClose={() => setTxModalOpen(false)} title="Add transaction">
        <form onSubmit={handleTxSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1.5">Type</label>
              <select value={txForm.type} onChange={(e) => setTxForm({ ...txForm, type: e.target.value })} className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30">
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">Category</label>
              <select value={txForm.category} onChange={(e) => setTxForm({ ...txForm, category: e.target.value })} className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Description</label>
            <input type="text" value={txForm.description} onChange={(e) => setTxForm({ ...txForm, description: e.target.value })} className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1.5">Amount (৳)</label>
              <input type="number" value={txForm.amount} onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })} className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">Date</label>
              <input type="date" value={txForm.date} onChange={(e) => setTxForm({ ...txForm, date: e.target.value })} className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Method</label>
            <select value={txForm.method} onChange={(e) => setTxForm({ ...txForm, method: e.target.value })} className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30">
              {METHODS.map((m) => <option key={m} value={m}>{m.replace("_", " ").replace(/^\w/, (c) => c.toUpperCase())}</option>)}
            </select>
          </div>
          {txError && <div className="text-sm text-danger bg-danger-light rounded-lg px-3 py-2">{txError}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setTxModalOpen(false)} className="px-4 py-2.5 text-sm font-medium rounded-lg border border-border hover:bg-background">Cancel</button>
            <button type="submit" className="px-4 py-2.5 text-sm font-semibold rounded-lg bg-primary text-white hover:bg-primary-dark">Add transaction</button>
          </div>
        </form>
      </Modal>

      <Modal open={invModalOpen} onClose={() => setInvModalOpen(false)} title="Add invoice">
        <form onSubmit={handleInvSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1.5">Client name</label>
            <input type="text" value={invForm.clientName} onChange={(e) => setInvForm({ ...invForm, clientName: e.target.value })} className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Client email</label>
            <input type="email" value={invForm.clientEmail} onChange={(e) => setInvForm({ ...invForm, clientEmail: e.target.value })} className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Amount (৳)</label>
            <input type="number" value={invForm.amount} onChange={(e) => setInvForm({ ...invForm, amount: e.target.value })} className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1.5">Issue date</label>
              <input type="date" value={invForm.issueDate} onChange={(e) => setInvForm({ ...invForm, issueDate: e.target.value })} className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">Due date</label>
              <input type="date" value={invForm.dueDate} onChange={(e) => setInvForm({ ...invForm, dueDate: e.target.value })} className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Notes</label>
            <textarea value={invForm.notes} onChange={(e) => setInvForm({ ...invForm, notes: e.target.value })} rows={3} className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          {invError && <div className="text-sm text-danger bg-danger-light rounded-lg px-3 py-2">{invError}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setInvModalOpen(false)} className="px-4 py-2.5 text-sm font-medium rounded-lg border border-border hover:bg-background">Cancel</button>
            <button type="submit" className="px-4 py-2.5 text-sm font-semibold rounded-lg bg-primary text-white hover:bg-primary-dark">Create invoice</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
