const MAP: Record<string, { bg: string; text: string; label?: string }> = {
  active: { bg: "var(--success-light)", text: "var(--success)" },
  present: { bg: "var(--success-light)", text: "var(--success)" },
  approved: { bg: "var(--success-light)", text: "var(--success)" },
  paid: { bg: "var(--success-light)", text: "var(--success)" },
  done: { bg: "var(--success-light)", text: "var(--success)" },
  inactive: { bg: "var(--danger-light)", text: "var(--danger)" },
  absent: { bg: "var(--danger-light)", text: "var(--danger)" },
  rejected: { bg: "var(--danger-light)", text: "var(--danger)" },
  on_leave: { bg: "var(--warning-light)", text: "var(--warning)", label: "On leave" },
  late: { bg: "var(--warning-light)", text: "var(--warning)" },
  pending: { bg: "var(--warning-light)", text: "var(--warning)" },
  recommended: { bg: "var(--info-light)", text: "var(--info)" },
  todo: { bg: "var(--info-light)", text: "var(--info)", label: "To do" },
  in_progress: { bg: "var(--info-light)", text: "var(--info)", label: "In progress" },
  half_day: { bg: "var(--info-light)", text: "var(--info)", label: "Half day" },
  high: { bg: "var(--danger-light)", text: "var(--danger)" },
  medium: { bg: "var(--warning-light)", text: "var(--warning)" },
  low: { bg: "var(--info-light)", text: "var(--info)" },
  income: { bg: "var(--success-light)", text: "var(--success)", label: "Cash In" },
  cash_in: { bg: "var(--success-light)", text: "var(--success)", label: "Cash In" },
  loan: { bg: "var(--warning-light)", text: "var(--warning)" },
  salary: { bg: "var(--primary-light)", text: "var(--primary)" },
  expense: { bg: "var(--danger-light)", text: "var(--danger)" },
  unpaid: { bg: "var(--warning-light)", text: "var(--warning)" },
  overdue: { bg: "var(--danger-light)", text: "var(--danger)" },
  planned: { bg: "var(--info-light)", text: "var(--info)" },
  upcoming: { bg: "var(--info-light)", text: "var(--info)" },
  partly_paid: { bg: "var(--warning-light)", text: "var(--warning)", label: "Partly paid" },
  on_hold: { bg: "var(--warning-light)", text: "var(--warning)", label: "On hold" },
  completed: { bg: "var(--primary-light)", text: "var(--primary)" },
  cancelled: { bg: "var(--border)", text: "var(--muted)" },
  client: { bg: "var(--info-light)", text: "var(--info)", label: "Direct client" },
  agency: { bg: "var(--primary-light)", text: "var(--primary)", label: "Agency client" },
  long_term: { bg: "var(--primary-light)", text: "var(--primary)", label: "Long-term" },
  short_term: { bg: "var(--border)", text: "var(--muted)", label: "Short-term" },
};

export default function Badge({ status }: { status: string }) {
  const cfg = MAP[status] || { bg: "var(--border)", text: "var(--muted)" };
  const label = cfg.label || status.replace(/_/g, " ");
  return (
    <span
      className="badge capitalize"
      style={{ background: cfg.bg, color: cfg.text }}
    >
      {label}
    </span>
  );
}
