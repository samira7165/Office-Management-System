"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownCircle, Landmark, Users, ArrowUpCircle, Wallet, Plus, Trash2, Pencil, Search,
  FileSpreadsheet, ImageIcon, ImagePlus, Receipt, Paperclip, HandCoins,
} from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import {
  TX_TYPES, TX_TYPE_LABEL, CATEGORY_SUGGESTIONS, ACCOUNT_SUGGESTIONS, RECEIPT_TYPES,
  isInflow, summarizeLedger, receiptProblem, type TxType,
} from "@/lib/finance";

type Transaction = {
  id: number; type: string; category: string; description: string | null; amount: number; date: string;
  account: string | null; method: string | null; hasReceipt: boolean; receiptName: string | null;
  clientId: number | null; client: { id: number; name: string; type: string } | null;
  dealAmount: number | null; parentId: number | null;
  deal: { received: number; due: number; payments: number } | null; // set on advance deals
  parent: { id: number; date: string; category: string; description: string | null; dealAmount: number | null } | null; // set on payments
};
type ClientOpt = { id: number; name: string; type: string };
type Invoice = { id: number; invoiceNo: string; clientName: string; clientEmail: string; amount: number; issueDate: string; dueDate: string; status: string; notes: string };

const today = () => new Date().toISOString().slice(0, 10);
// clientId: "" = no client, "new" = create one from newClientName/newClientType, else a client id.
const EMPTY_TX = {
  type: "cash_in" as TxType, category: "", amount: "", date: "", account: "", description: "",
  clientId: "", newClientName: "", newClientType: "client",
  // Advance: isAdvance + dealAmount on a deal; parentId when recording a later payment on one.
  isAdvance: false, dealAmount: "", parentId: "",
};
const clientTypeLabel = (t: string) => (t === "agency" ? "Agency client" : "Direct client");
const taka = (n: number) => `৳${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const typeLabel = (t: string) => TX_TYPE_LABEL[t as TxType] ?? (t === "income" ? "Cash In" : t);
const inputCls = "w-full rounded-lg border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30";
// Older rows stored a payment method instead of an account name.
const accountOf = (t: Transaction) => t.account || (t.method ? t.method.replace("_", " ").replace(/^\w/, (c) => c.toUpperCase()) : "");

function csvCell(v: string | number) {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function FinancePage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | TxType>("");
  const [dueOnly, setDueOnly] = useState(false);

  const [txModalOpen, setTxModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [txForm, setTxForm] = useState(EMPTY_TX);
  const [txReceipt, setTxReceipt] = useState<File | null>(null);
  const [txError, setTxError] = useState("");
  const [txSaving, setTxSaving] = useState(false);

  const uploadInput = useRef<HTMLInputElement>(null);
  const [uploadFor, setUploadFor] = useState<number | null>(null);
  const [uploadingId, setUploadingId] = useState<number | null>(null);

  const [invModalOpen, setInvModalOpen] = useState(false);
  const [invForm, setInvForm] = useState({ clientName: "", clientEmail: "", amount: "", issueDate: "", dueDate: "", notes: "" });
  const [invError, setInvError] = useState("");

  async function load() {
    const [t, i, c] = await Promise.all([
      fetch("/api/transactions").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/invoices").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/clients").then((r) => (r.ok ? r.json() : [])),
    ]);
    setTransactions(t);
    setInvoices(i);
    setClients(c);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);
  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => setRole(d.user?.role || ""));
  }, []);

  const totals = useMemo(() => summarizeLedger(transactions), [transactions]);
  const outstanding = useMemo(() => invoices.filter((i) => i.status === "unpaid" || i.status === "overdue").reduce((s, i) => s + i.amount, 0), [invoices]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return transactions.filter((t) =>
      (!dueOnly || (t.deal?.due ?? 0) > 0) &&
      (!typeFilter || t.type === typeFilter || (typeFilter === "cash_in" && t.type === "income")) &&
      (!needle || [t.category, t.description, accountOf(t), typeLabel(t.type), t.date, String(t.amount), t.client?.name]
        .some((v) => v?.toLowerCase().includes(needle)))
    );
  }, [transactions, q, typeFilter, dueOnly]);

  const dues = useMemo(() => {
    const open = transactions.filter((t) => (t.deal?.due ?? 0) > 0);
    return { total: open.reduce((s, t) => s + t.deal!.due, 0), count: open.length };
  }, [transactions]);

  // ---- Ledger: add / edit ----
  function openAddTx() {
    setEditingTx(null);
    setTxForm({ ...EMPTY_TX, date: today() });
    setTxReceipt(null);
    setTxError("");
    setTxModalOpen(true);
  }

  function openEditTx(t: Transaction) {
    setEditingTx(t);
    setTxForm({
      type: (t.type === "income" ? "cash_in" : t.type) as TxType, category: t.category, amount: String(t.amount),
      date: t.date, account: accountOf(t), description: t.description || "",
      clientId: t.clientId ? String(t.clientId) : "", newClientName: "", newClientType: "client",
      isAdvance: t.dealAmount != null, dealAmount: t.dealAmount != null ? String(t.dealAmount) : "",
      parentId: t.parentId ? String(t.parentId) : "",
    });
    setTxReceipt(null);
    setTxError("");
    setTxModalOpen(true);
  }

  /** Record a later payment against an advance deal; amount defaults to what's still due. */
  function openAddPayment(deal: Transaction) {
    setEditingTx(null);
    setTxForm({
      ...EMPTY_TX, type: "cash_in", category: deal.category, date: today(), account: accountOf(deal),
      amount: String(deal.deal?.due ?? ""), clientId: deal.clientId ? String(deal.clientId) : "",
      parentId: String(deal.id), description: deal.description ? `Payment — ${deal.description}` : "",
    });
    setTxReceipt(null);
    setTxError("");
    setTxModalOpen(true);
  }

  async function handleTxSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTxError("");
    if (!txForm.category.trim() || !txForm.amount || !txForm.date) { setTxError("Category, amount and date are required"); return; }
    if (Number(txForm.amount) <= 0) { setTxError("Amount must be more than 0"); return; }
    if (txReceipt) { const p = receiptProblem(txReceipt); if (p) { setTxError(p); return; } }
    if (txForm.clientId === "new" && !txForm.newClientName.trim()) { setTxError("Enter the new client's name"); return; }
    const advance = txForm.type === "cash_in" && txForm.isAdvance && !txForm.parentId;
    if (advance) {
      if (!txForm.dealAmount || Number(txForm.dealAmount) <= 0) { setTxError("Enter the total deal amount"); return; }
      if (Number(txForm.amount) > Number(txForm.dealAmount)) { setTxError("Advance received can't be more than the total deal amount"); return; }
    }

    setTxSaving(true);
    // A brand-new client is added to the Clients list first (or reused if the name exists).
    let clientId = txForm.clientId;
    if (clientId === "new") {
      const cr = await fetch("/api/clients", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: txForm.newClientName, type: txForm.newClientType }),
      });
      const cd = await cr.json().catch(() => ({}));
      if (cr.ok || (cr.status === 409 && cd.id)) clientId = String(cd.id);
      else { setTxSaving(false); setTxError(cd.error || "Couldn't add the client"); return; }
    }
    const payload = {
      type: txForm.type, category: txForm.category, amount: txForm.amount, date: txForm.date,
      account: txForm.account, description: txForm.description, clientId,
      dealAmount: advance ? txForm.dealAmount : "", parentId: txForm.parentId,
    };

    let res: Response;
    if (editingTx) {
      res = await fetch(`/api/transactions/${editingTx.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      if (res.ok && txReceipt) res = await uploadReceipt(editingTx.id, txReceipt);
    } else {
      const fd = new FormData();
      Object.entries(payload).forEach(([k, v]) => fd.append(k, String(v)));
      if (txReceipt) fd.append("receipt", txReceipt);
      res = await fetch("/api/transactions", { method: "POST", body: fd });
    }
    setTxSaving(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); setTxError(d.error || "Couldn't save the transaction"); return; }
    setTxModalOpen(false);
    load();
  }

  async function handleDeleteTx(t: Transaction) {
    if (!confirm(`Delete this ${typeLabel(t.type)} of ${taka(t.amount)}?${t.hasReceipt ? " Its receipt will be deleted too." : ""}`)) return;
    const res = await fetch(`/api/transactions/${t.id}`, { method: "DELETE" });
    if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || "Couldn't delete the transaction"); return; }
    load();
  }

  // ---- Receipts ----
  function uploadReceipt(id: number, file: File) {
    const fd = new FormData();
    fd.append("receipt", file);
    return fetch(`/api/transactions/${id}/receipt`, { method: "POST", body: fd });
  }

  function pickReceiptFor(id: number) {
    setUploadFor(id);
    uploadInput.current?.click();
  }

  async function onReceiptPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || uploadFor === null) return;
    const p = receiptProblem(file);
    if (p) { alert(p); return; }
    setUploadingId(uploadFor);
    const res = await uploadReceipt(uploadFor, file);
    setUploadingId(null);
    if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || "Couldn't upload the receipt"); return; }
    load();
  }

  // ---- Export (CSV opens directly in Excel; BOM keeps Bangla text intact) ----
  function exportExcel() {
    const header = ["Date", "Type", "Category", "Client", "Client type", "Amount (BDT)", "Account / Source", "Reference / Note",
      "Deal total", "Deal received", "Deal due", "Payment for deal (date)", "Receipt"];
    const rows = filtered.map((t) => [
      t.date, typeLabel(t.type), t.category, t.client?.name ?? "", t.client ? clientTypeLabel(t.client.type) : "",
      (isInflow(t.type) ? 1 : -1) * t.amount,
      accountOf(t), t.description || "",
      t.dealAmount ?? "", t.deal?.received ?? "", t.deal?.due ?? "", t.parent?.date ?? "",
      t.hasReceipt ? "Yes" : "No",
    ]);
    const s = summarizeLedger(filtered);
    const pad = ["", "", "", ""]; // line totals up under "Amount (BDT)"
    const summary = [[], ["Total Cash In", ...pad, s.cashIn], ["Total Loans", ...pad, s.loans], ["Total Salary", ...pad, -s.salary],
      ["Total Expenses", ...pad, -s.expenses], ["Net Balance", ...pad, s.net]];
    const csv = [header, ...rows, ...summary].map((r) => r.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `finance-ledger-${today()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---- Invoices (unchanged) ----
  async function markPaid(id: number) {
    await fetch(`/api/invoices/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "paid" }) });
    load();
  }

  async function handleDeleteInvoice(id: number) {
    if (!confirm("Delete this invoice?")) return;
    await fetch(`/api/invoices/${id}`, { method: "DELETE" });
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

  const typeTabs: ("" | TxType)[] = ["", ...TX_TYPES];
  const isOut = !isInflow(txForm.type);
  // Advance / deal helpers for the form.
  const payingDeal = txForm.parentId ? transactions.find((t) => t.id === Number(txForm.parentId)) ?? null : null;
  // When editing an existing payment, its own amount is already counted in the deal's "received".
  const payingDealDue = payingDeal
    ? (payingDeal.deal?.due ?? 0) + (editingTx?.parentId === payingDeal.id ? editingTx.amount : 0)
    : 0;
  const canBeAdvance = txForm.type === "cash_in" && !txForm.parentId;
  const showAdvance = canBeAdvance && txForm.isAdvance;
  const laterPayments = editingTx?.deal ? editingTx.deal.received - editingTx.amount : 0;
  const previewDue = Math.round((Number(txForm.dealAmount) - Number(txForm.amount || 0) - laterPayments) * 100) / 100;
  const directClients = clients.filter((c) => c.type !== "agency");
  const agencyClients = clients.filter((c) => c.type === "agency");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Wallet className="w-5 h-5 text-primary" /> Finance Ledger</h1>
          <p className="text-sm text-muted mt-0.5">Cash in, expenses, loans, salary & bKash/bank receipts</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportExcel} disabled={filtered.length === 0} className="flex items-center gap-1.5 bg-success hover:opacity-90 text-white text-sm font-semibold rounded-lg px-4 py-2.5 transition disabled:opacity-50">
            <FileSpreadsheet className="w-4 h-4" /> Export Excel
          </button>
          <button onClick={openAddTx} className="flex items-center gap-1.5 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-lg px-4 py-2.5 transition">
            <Plus className="w-4 h-4" /> Add transaction
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Total cash in" value={taka(totals.cashIn)} icon={ArrowDownCircle} tint="success" />
        <StatCard label="Total loans" value={taka(totals.loans)} icon={Landmark} tint="warning" />
        <StatCard label="Total salary" value={taka(totals.salary)} icon={Users} tint="info" />
        <StatCard label="Total expenses" value={taka(totals.expenses)} icon={ArrowUpCircle} tint="danger" />
        <StatCard label="Net balance" value={taka(totals.net)} icon={Wallet} tint="primary" />
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center gap-3 justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-base">Transactions</h2>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search transactions..." className={`${inputCls} pl-9 py-2`} />
          </div>
        </div>
        {dues.count > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 border-b border-border bg-warning-light/60 text-sm">
            <span>
              <span className="font-semibold text-warning">{taka(dues.total)}</span> still due from clients on {dues.count} advance deal{dues.count === 1 ? "" : "s"}
            </span>
            <button onClick={() => setDueOnly(!dueOnly)} className="text-xs font-semibold text-primary hover:underline">
              {dueOnly ? "Show all transactions" : "Show only deals with dues"}
            </button>
          </div>
        )}
        <div className="flex flex-wrap gap-1.5 px-5 py-3 border-b border-border">
          {typeTabs.map((t) => (
            <button
              key={t || "all"}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${typeFilter === t ? "bg-primary text-white" : "bg-background text-foreground/70 hover:bg-primary-light hover:text-primary"}`}
            >
              {t ? TX_TYPE_LABEL[t] : "All"}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted border-b border-border">
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Category</th>
                <th className="px-5 py-3 font-medium">Client</th>
                <th className="px-5 py-3 font-medium text-right">Amount (BDT)</th>
                <th className="px-5 py-3 font-medium">Account / source</th>
                <th className="px-5 py-3 font-medium">Reference / note</th>
                <th className="px-5 py-3 font-medium text-center">Receipt</th>
                <th className="px-5 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const inflow = isInflow(t.type);
                return (
                  <tr key={t.id} className="border-b border-border last:border-0">
                    <td className="px-5 py-3 text-muted whitespace-nowrap">{t.date}</td>
                    <td className="px-5 py-3"><Badge status={t.type} /></td>
                    <td className="px-5 py-3 font-medium capitalize">{t.category}</td>
                    <td className="px-5 py-3">
                      {t.client ? (
                        <>
                          <p className="font-medium whitespace-nowrap">{t.client.name}</p>
                          <div className="mt-1"><Badge status={t.client.type} /></div>
                        </>
                      ) : <span className="text-muted">—</span>}
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <p className={`font-semibold ${inflow ? "text-success" : "text-danger"}`}>{inflow ? "+" : "−"} {taka(t.amount)}</p>
                      {t.deal && t.dealAmount != null && (
                        <>
                          <p className="text-[11px] text-muted mt-0.5">advance of {taka(t.dealAmount)}</p>
                          {t.deal.due > 0
                            ? <p className="text-[11px] font-semibold text-warning">{taka(t.deal.due)} due</p>
                            : <p className="text-[11px] font-semibold text-success">Paid in full</p>}
                        </>
                      )}
                    </td>
                    <td className="px-5 py-3 text-muted">{accountOf(t) || "—"}</td>
                    <td className="px-5 py-3 text-muted max-w-[240px]" title={t.description || ""}>
                      <p className="truncate">{t.description || "—"}</p>
                      {t.parent && (
                        <p className="text-[11px] text-primary mt-0.5 truncate">
                          ↳ payment for {t.parent.date} deal{t.parent.dealAmount != null ? ` (${taka(t.parent.dealAmount)})` : ""}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-center">
                      {t.hasReceipt ? (
                        <a href={`/api/transactions/${t.id}/receipt`} target="_blank" rel="noopener" title={t.receiptName || "View receipt"}
                          className="inline-flex w-8 h-8 rounded-lg border border-info/40 bg-info-light text-info items-center justify-center hover:opacity-80 transition">
                          <ImageIcon className="w-3.5 h-3.5" />
                        </a>
                      ) : (
                        <button onClick={() => pickReceiptFor(t.id)} disabled={uploadingId === t.id} title="Attach receipt"
                          className="inline-flex w-8 h-8 rounded-lg border border-dashed border-border text-muted items-center justify-center hover:border-primary hover:text-primary transition disabled:opacity-50">
                          {uploadingId === t.id ? <span className="text-[10px]">...</span> : <ImagePlus className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {(t.deal?.due ?? 0) > 0 && (
                          <button onClick={() => openAddPayment(t)} title="Add a payment against this deal"
                            className="h-8 px-2.5 rounded-lg border border-success/40 bg-success-light text-success text-xs font-semibold flex items-center gap-1 hover:opacity-80 transition whitespace-nowrap">
                            <HandCoins className="w-3.5 h-3.5" /> Payment
                          </button>
                        )}
                        <button onClick={() => openEditTx(t)} title="Edit" className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-primary-light hover:text-primary transition">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeleteTx(t)} title="Delete" className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-danger-light hover:text-danger transition">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={9} className="px-5 py-10 text-center text-muted text-sm">
                  {transactions.length === 0 ? "No transactions yet." : "No transactions match your search."}
                </td></tr>
              )}
              {loading && <tr><td colSpan={9} className="px-5 py-10 text-center text-muted text-sm">Loading transactions...</td></tr>}
            </tbody>
          </table>
        </div>
        <input ref={uploadInput} type="file" accept={RECEIPT_TYPES.join(",")} className="hidden" onChange={onReceiptPicked} />
      </div>

      <div className="card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="font-semibold text-base flex items-center gap-2"><Receipt className="w-4 h-4 text-muted" /> Invoices</h2>
            <p className="text-xs text-muted mt-0.5">Outstanding: <span className="font-semibold text-warning">{taka(outstanding)}</span></p>
          </div>
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
                      {role === "SUPER_ADMIN" && (
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

      <Modal open={txModalOpen} onClose={() => setTxModalOpen(false)} title={editingTx ? "Edit transaction" : "Add transaction"}>
        <form onSubmit={handleTxSubmit} className="space-y-4">
          {payingDeal && (
            <div className="rounded-xl bg-success-light/70 border border-success/30 px-3.5 py-2.5 text-sm">
              <p className="font-semibold flex items-center gap-1.5"><HandCoins className="w-4 h-4 text-success" /> Payment against a deal</p>
              <p className="text-xs text-muted mt-0.5">
                {payingDeal.client?.name ?? "No client"} · deal of {taka(payingDeal.dealAmount ?? 0)} from {payingDeal.date} ·{" "}
                <span className="font-semibold text-warning">{taka(payingDealDue)} still due</span>
              </p>
            </div>
          )}
          <div>
            <label className="text-sm font-medium block mb-1.5">Type</label>
            <div className="grid grid-cols-4 gap-1.5">
              {TX_TYPES.map((t) => (
                <button
                  type="button" key={t} disabled={!!txForm.parentId || (editingTx?.deal?.payments ?? 0) > 0}
                  onClick={() => setTxForm({ ...txForm, type: t, category: CATEGORY_SUGGESTIONS[t].includes(txForm.category) ? "" : txForm.category })}
                  className={`py-2 rounded-lg text-xs font-semibold border transition disabled:cursor-not-allowed ${txForm.type === t ? "bg-primary text-white border-primary" : "border-border hover:border-primary hover:text-primary disabled:opacity-40 disabled:hover:border-border disabled:hover:text-inherit"}`}
                >
                  {TX_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted mt-1.5">{isOut ? "Money going out — subtracted from the net balance." : "Money coming in — added to the net balance."}</p>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">
              Client <span className="text-muted font-normal">(optional — who paid, or who was paid)</span>
            </label>
            <select value={txForm.clientId} disabled={!!txForm.parentId} onChange={(e) => setTxForm({ ...txForm, clientId: e.target.value })} className={`${inputCls} disabled:bg-background disabled:text-muted`}>
              <option value="">No client</option>
              {directClients.length > 0 && (
                <optgroup label="Direct clients">
                  {directClients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </optgroup>
              )}
              {agencyClients.length > 0 && (
                <optgroup label="Agency clients">
                  {agencyClients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </optgroup>
              )}
              <option value="new">+ Add a new client</option>
            </select>
          </div>
          {txForm.clientId === "new" && (
            <div className="rounded-xl border border-dashed border-border p-3 space-y-3">
              <div>
                <label className="text-sm font-medium block mb-1.5">Client name</label>
                <input type="text" value={txForm.newClientName} onChange={(e) => setTxForm({ ...txForm, newClientName: e.target.value })} placeholder="e.g. IMS Gut" className={inputCls} />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Client type</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(["client", "agency"] as const).map((ct) => (
                    <button
                      type="button" key={ct}
                      onClick={() => setTxForm({ ...txForm, newClientType: ct })}
                      className={`py-2 rounded-lg text-xs font-semibold border transition ${txForm.newClientType === ct ? "bg-primary text-white border-primary" : "border-border hover:border-primary hover:text-primary"}`}
                    >
                      {clientTypeLabel(ct)}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted">This client will also be added to the Clients page.</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1.5">Category</label>
              <input list="tx-categories" value={txForm.category} onChange={(e) => setTxForm({ ...txForm, category: e.target.value })} placeholder={CATEGORY_SUGGESTIONS[txForm.type][0]} className={inputCls} />
              <datalist id="tx-categories">{CATEGORY_SUGGESTIONS[txForm.type].map((c) => <option key={c} value={c} />)}</datalist>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">{showAdvance ? "Advance received now (৳)" : "Amount (৳)"}</label>
              <input type="number" min="0" step="0.01" value={txForm.amount} onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })} className={inputCls} />
            </div>
          </div>
          {canBeAdvance && (
            <div className={`rounded-xl border p-3 space-y-3 ${showAdvance ? "border-primary/40 bg-primary-light/40" : "border-dashed border-border"}`}>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox" checked={txForm.isAdvance} className="mt-0.5 w-4 h-4 accent-[var(--primary)]"
                  disabled={(editingTx?.deal?.payments ?? 0) > 0}
                  onChange={(e) => setTxForm({ ...txForm, isAdvance: e.target.checked })}
                />
                <span>
                  <span className="text-sm font-medium block">Advance / partial payment</span>
                  <span className="text-xs text-muted">The client is paying part now — the rest stays as &quot;due&quot; until you add more payments.</span>
                </span>
              </label>
              {showAdvance && (
                <div>
                  <label className="text-sm font-medium block mb-1.5">Total deal amount (৳)</label>
                  <input type="number" min="0" step="0.01" value={txForm.dealAmount} onChange={(e) => setTxForm({ ...txForm, dealAmount: e.target.value })} placeholder="Full agreed amount" className={inputCls} />
                  {Number(txForm.dealAmount) > 0 && (
                    <p className={`text-xs mt-1.5 font-medium ${previewDue < 0 ? "text-danger" : previewDue === 0 ? "text-success" : "text-warning"}`}>
                      {previewDue < 0
                        ? "Advance is more than the total deal amount"
                        : previewDue === 0
                          ? "Paid in full with this payment"
                          : `${taka(previewDue)} will be due after this ${editingTx?.deal?.payments ? "(including later payments)" : "advance"}`}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1.5">Date</label>
              <input type="date" value={txForm.date} onChange={(e) => setTxForm({ ...txForm, date: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">Account / source</label>
              <input list="tx-accounts" value={txForm.account} onChange={(e) => setTxForm({ ...txForm, account: e.target.value })} placeholder="City Bank, bKash, Cash..." className={inputCls} />
              <datalist id="tx-accounts">{ACCOUNT_SUGGESTIONS.map((a) => <option key={a} value={a} />)}</datalist>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Reference / note</label>
            <input type="text" value={txForm.description} onChange={(e) => setTxForm({ ...txForm, description: e.target.value })} placeholder="e.g. Reza Oct 2026 salary, TrxID 9F3K..." className={inputCls} />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">
              Receipt <span className="text-muted font-normal">(bKash / bank slip — image or PDF, max 4 MB)</span>
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3.5 py-2.5 text-sm cursor-pointer hover:border-primary">
              <Paperclip className="w-4 h-4 text-muted" />
              <span className={txReceipt ? "" : "text-muted"}>
                {txReceipt ? txReceipt.name : editingTx?.hasReceipt ? `Replace ${editingTx.receiptName || "current receipt"}` : "Choose a file..."}
              </span>
              <input type="file" accept={RECEIPT_TYPES.join(",")} className="hidden" onChange={(e) => setTxReceipt(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          {txError && <div className="text-sm text-danger bg-danger-light rounded-lg px-3 py-2">{txError}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setTxModalOpen(false)} className="px-4 py-2.5 text-sm font-medium rounded-lg border border-border hover:bg-background">Cancel</button>
            <button type="submit" disabled={txSaving} className="px-4 py-2.5 text-sm font-semibold rounded-lg bg-primary text-white hover:bg-primary-dark disabled:opacity-60">
              {txSaving ? "Saving..." : editingTx ? "Save changes" : "Add transaction"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={invModalOpen} onClose={() => setInvModalOpen(false)} title="Add invoice">
        <form onSubmit={handleInvSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1.5">Client name</label>
            <input type="text" value={invForm.clientName} onChange={(e) => setInvForm({ ...invForm, clientName: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Client email</label>
            <input type="email" value={invForm.clientEmail} onChange={(e) => setInvForm({ ...invForm, clientEmail: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Amount (৳)</label>
            <input type="number" value={invForm.amount} onChange={(e) => setInvForm({ ...invForm, amount: e.target.value })} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1.5">Issue date</label>
              <input type="date" value={invForm.issueDate} onChange={(e) => setInvForm({ ...invForm, issueDate: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">Due date</label>
              <input type="date" value={invForm.dueDate} onChange={(e) => setInvForm({ ...invForm, dueDate: e.target.value })} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Notes</label>
            <textarea value={invForm.notes} onChange={(e) => setInvForm({ ...invForm, notes: e.target.value })} rows={3} className={inputCls} />
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
