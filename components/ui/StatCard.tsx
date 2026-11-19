import { LucideIcon } from "lucide-react";

export default function StatCard({
  label, value, icon: Icon, tint, delta,
}: {
  label: string; value: string | number; icon: LucideIcon; tint: "primary" | "success" | "warning" | "danger" | "info"; delta?: string;
}) {
  const tints: Record<string, string> = {
    primary: "bg-primary-light text-primary",
    success: "bg-success-light text-success",
    warning: "bg-warning-light text-warning",
    danger: "bg-danger-light text-danger",
    info: "bg-info-light text-info",
  };
  // The icon sits beside the label so the value gets the card's full width, and the value
  // never wraps mid-number. Phones show two cards per row, so everything is tighter there.
  return (
    <div className="card p-3.5 sm:p-5 min-w-0">
      <div className="flex items-start justify-between gap-2 mb-1 sm:mb-2">
        <p className="text-[11px] sm:text-xs text-muted font-medium pt-0.5">{label}</p>
        <div className={`hidden sm:flex w-9 h-9 -mt-1 -mr-1 shrink-0 rounded-xl items-center justify-center ${tints[tint]}`}>
          <Icon className="w-[18px] h-[18px]" />
        </div>
      </div>
      <p className="text-base sm:text-xl 2xl:text-2xl font-bold leading-tight whitespace-nowrap truncate tabular-nums" title={String(value)}>
        {value}
      </p>
      {delta && <p className="text-xs text-success mt-1.5 font-medium">{delta}</p>}
    </div>
  );
}
