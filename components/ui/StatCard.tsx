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
  return (
    <div className="card p-5 flex items-start justify-between">
      <div>
        <p className="text-xs text-muted font-medium mb-1.5">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
        {delta && <p className="text-xs text-success mt-1.5 font-medium">{delta}</p>}
      </div>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tints[tint]}`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
  );
}
