// Ledger rules shared by the finance API, the Finance page and the dashboard revenue analysis.
// No DB imports — safe to use from client components.

export const TX_TYPES = ["cash_in", "loan", "salary", "expense", "asset"] as const;
export type TxType = (typeof TX_TYPES)[number];

export const TX_TYPE_LABEL: Record<TxType, string> = {
  cash_in: "Cash In",
  loan: "Office Loan",
  salary: "Salary",
  expense: "Expense",
  asset: "Asset Buy",
};

/** Money coming in: cash received and loans taken. Salary, expenses and asset buys go out. */
export function isInflow(type: string): boolean {
  return type === "cash_in" || type === "loan" || type === "income"; // "income" = pre-ledger rows
}

/** Real earnings, for revenue figures — a loan is money in, but it isn't revenue. */
export function isRevenue(type: string): boolean {
  return type === "cash_in" || type === "income";
}

/** Money spent (salary, expenses, and assets bought — cash leaves the business either way). */
export function isSpending(type: string): boolean {
  return type === "salary" || type === "expense" || type === "asset";
}

/** Suggested categories per type (the field still accepts anything). */
export const CATEGORY_SUGGESTIONS: Record<TxType, string[]> = {
  cash_in: ["Client", "Sales", "Investment", "Refund", "Other"],
  loan: ["Bank loan", "Personal loan", "Director loan", "Other"],
  salary: ["Salary", "Bonus", "Advance", "Overtime"],
  expense: ["Daily expense", "Utilities", "Rent", "Marketing", "Software", "Office supplies", "Transport", "Food", "Other"],
  asset: ["Computer / laptop", "Furniture", "Office equipment", "Phone / tablet", "Vehicle", "Software license", "Other"],
};

/** Utility bills, matched from the category name (electricity, water, gas, internet...). */
export function isUtility(category: string): boolean {
  return /utilit|electric|water|gas\b|internet|wifi|wi-fi|broadband|phone bill|mobile bill/i.test(category);
}

/** Small day-to-day office spending (tea, snacks, stationery, conveyance...). */
export function isDailyExpense(category: string): boolean {
  return /daily|tea|snack|conveyance|petty/i.test(category);
}

type BreakdownRow = { type: string; amount: number; category: string; projectId?: number | null };

/**
 * Where the money came from and went. Feeds the Finance breakdown panel:
 * project income vs salary paid, plus utility, daily office, asset and loan totals.
 */
export function ledgerBreakdown(rows: BreakdownRow[]) {
  const sum = (pred: (r: BreakdownRow) => boolean) => Math.round(rows.filter(pred).reduce((s, r) => s + r.amount, 0) * 100) / 100;
  const projectCashIn = sum((r) => isRevenue(r.type) && !!r.projectId);
  const otherCashIn = sum((r) => isRevenue(r.type) && !r.projectId);
  const salary = sum((r) => r.type === "salary");
  const utilities = sum((r) => r.type === "expense" && isUtility(r.category));
  const daily = sum((r) => r.type === "expense" && !isUtility(r.category) && isDailyExpense(r.category));
  const otherExpenses = sum((r) => r.type === "expense" && !isUtility(r.category) && !isDailyExpense(r.category));
  const assets = sum((r) => r.type === "asset");
  const loans = sum((r) => r.type === "loan");

  // Expense + asset totals per category, biggest first.
  const byCategory = new Map<string, { category: string; type: string; amount: number }>();
  for (const r of rows) {
    if (r.type !== "expense" && r.type !== "asset") continue;
    const key = `${r.type}:${r.category.trim().toLowerCase()}`;
    const c = byCategory.get(key) ?? { category: r.category.trim(), type: r.type, amount: 0 };
    c.amount += r.amount;
    byCategory.set(key, c);
  }

  return {
    projectCashIn, otherCashIn, totalCashIn: projectCashIn + otherCashIn,
    salary,
    // Share of project income paid out as salary, and what's left after salary.
    salaryShareOfProject: projectCashIn > 0 ? (salary / projectCashIn) * 100 : null,
    salaryShareOfAll: projectCashIn + otherCashIn > 0 ? (salary / (projectCashIn + otherCashIn)) * 100 : null,
    projectLeftAfterSalary: projectCashIn - salary,
    utilities, daily, otherExpenses, assets, loans,
    categories: [...byCategory.values()].sort((a, b) => b.amount - a.amount),
  };
}

export const ACCOUNT_SUGGESTIONS = ["City Bank", "BRAC Bank", "Dutch-Bangla Bank", "bKash", "Nagad", "Rocket", "Cash"];

export type LedgerRow = { type: string; amount: number };

export function summarizeLedger(rows: LedgerRow[]) {
  const sum = (pred: (t: string) => boolean) => rows.filter((r) => pred(r.type)).reduce((s, r) => s + r.amount, 0);
  const cashIn = sum(isRevenue);
  const loans = sum((t) => t === "loan");
  const salary = sum((t) => t === "salary");
  const expenses = sum((t) => t === "expense");
  const assets = sum((t) => t === "asset");
  return { cashIn, loans, salary, expenses, assets, net: cashIn + loans - salary - expenses - assets };
}

/** Receipts: images or PDF, kept under Vercel's ~4.5 MB request limit. */
export const RECEIPT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
export const RECEIPT_MAX_BYTES = 4 * 1024 * 1024;

export function receiptProblem(file: { type: string; size: number }): string | null {
  if (!RECEIPT_TYPES.includes(file.type)) return "Receipt must be an image (JPG, PNG, WEBP, GIF) or a PDF";
  if (file.size > RECEIPT_MAX_BYTES) return "Receipt must be 4 MB or smaller";
  return null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type TxInput = {
  type: TxType; category: string; amount: number; date: string; account: string; description: string;
  clientId: number | null; dealAmount: number | null; parentId: number | null;
};

const money2 = (n: number) => Math.round(n * 100) / 100;
export const fmtTaka = (n: number) => `৳${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Validates ledger fields from a create (partial=false) or edit (partial=true) request. */
export function parseTxInput(get: (k: string) => unknown, has: (k: string) => boolean, partial: boolean):
  { data: Partial<TxInput>; error?: undefined } | { data?: undefined; error: string } {
  const out: Partial<TxInput> = {};
  const str = (k: string) => { const v = get(k); return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim(); };

  if (!partial || has("type")) {
    if (!(TX_TYPES as readonly string[]).includes(str("type"))) return { error: "Type must be Cash In, Office Loan, Salary, Expense or Asset Buy" };
    out.type = str("type") as TxType;
  }
  if (!partial || has("category")) {
    if (!str("category")) return { error: "Category is required" };
    out.category = str("category").slice(0, 64);
  }
  if (!partial || has("amount")) {
    const a = Number(str("amount"));
    if (!Number.isFinite(a) || a <= 0) return { error: "Amount must be more than 0" };
    out.amount = Math.round(a * 100) / 100;
  }
  if (!partial || has("date")) {
    if (!DATE_RE.test(str("date"))) return { error: "Date is required" };
    out.date = str("date");
  }
  if (has("account")) out.account = str("account").slice(0, 64);
  if (has("description")) out.description = str("description").slice(0, 255);
  if (has("clientId")) {
    const c = str("clientId");
    out.clientId = c === "" || c === "null" ? null : Number(c);
    if (out.clientId !== null && !Number.isInteger(out.clientId)) return { error: "Invalid client" };
  }
  if (has("dealAmount")) {
    const d = str("dealAmount");
    out.dealAmount = d === "" || d === "null" ? null : money2(Number(d));
    if (out.dealAmount !== null && (!Number.isFinite(out.dealAmount) || out.dealAmount <= 0)) return { error: "Total deal amount must be more than 0" };
  }
  if (has("parentId")) {
    const p = str("parentId");
    out.parentId = p === "" || p === "null" ? null : Number(p);
    if (out.parentId !== null && !Number.isInteger(out.parentId)) return { error: "Invalid deal" };
  }
  return { data: out };
}

/** Hide the private blob URL from the client — receipts are served through /api/transactions/[id]/receipt. */
export function publicTx<T extends { receiptUrl: string | null }>(row: T) {
  const { receiptUrl, ...rest } = row;
  return { ...rest, hasReceipt: !!receiptUrl };
}
