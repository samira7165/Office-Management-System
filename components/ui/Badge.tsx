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
  todo: { bg: "var(--info-light)", text: "var(--info)", label: "To do" },
  in_progress: { bg: "var(--info-light)", text: "var(--info)", label: "In progress" },
  half_day: { bg: "var(--info-light)", text: "var(--info)", label: "Half day" },
  high: { bg: "var(--danger-light)", text: "var(--danger)" },
  medium: { bg: "var(--warning-light)", text: "var(--warning)" },
  low: { bg: "var(--info-light)", text: "var(--info)" },
  income: { bg: "var(--success-light)", text: "var(--success)" },
  expense: { bg: "var(--danger-light)", text: "var(--danger)" },
  unpaid: { bg: "var(--warning-light)", text: "var(--warning)" },
  overdue: { bg: "var(--danger-light)", text: "var(--danger)" },
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
