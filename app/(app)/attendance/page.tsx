"use client";

import { useEffect, useState } from "react";
import { LogIn, LogOut } from "lucide-react";
import Badge from "@/components/ui/Badge";

type Employee = { id: number; name: string; avatarColor: string; position: string };
type AttRow = { id: number; employeeId: number; date: string; checkIn: string | null; checkOut: string | null; status: string; approvalStatus: string; employee: Employee | null };

export default function AttendancePage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<AttRow[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  async function load() {
    const [a, e] = await Promise.all([
      fetch(`/api/attendance?date=${date}`).then((r) => r.json()),
      fetch("/api/employees").then((r) => r.json()),
    ]);
    setRows(a);
    setEmployees(e);
  }

  useEffect(() => { load(); }, [date]);

  const marked = new Set(rows.map((r) => r.employeeId));
  const unmarked = employees.filter((e) => !marked.has(e.id));

  async function checkIn(employeeId: number) {
    const time = new Date().toTimeString().slice(0, 5);
    await fetch("/api/attendance", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId, date, checkIn: time, status: "present" }),
    });
    load();
  }

  async function checkOut(id: number) {
    const time = new Date().toTimeString().slice(0, 5);
    await fetch(`/api/attendance/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkOut: time }),
    });
    load();
  }

  async function setApproval(id: number, approvalStatus: string) {
    await fetch(`/api/attendance/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approvalStatus }),
    });
    load();
  }

  const present = rows.filter((r) => r.status === "present").length;
  const late = rows.filter((r) => r.status === "late").length;
  const absent = rows.filter((r) => r.status === "absent").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-3 text-sm">
          <span className="badge" style={{ background: "var(--success-light)", color: "var(--success)" }}>{present} present</span>
          <span className="badge" style={{ background: "var(--warning-light)", color: "var(--warning)" }}>{late} late</span>
          <span className="badge" style={{ background: "var(--danger-light)", color: "var(--danger)" }}>{absent} absent</span>
        </div>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-border px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted border-b border-border">
              <th className="px-5 py-3 font-medium">Employee</th>
              <th className="px-5 py-3 font-medium">Check-in</th>
              <th className="px-5 py-3 font-medium">Check-out</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Approval</th>
              <th className="px-5 py-3 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold" style={{ background: r.employee?.avatarColor || "#6C5DD3" }}>
                      {r.employee?.name.split(" ").map((p) => p[0]).slice(0, 2).join("") || "?"}
                    </div>
                    <div>
                      <p className="font-medium">{r.employee?.name || "—"}</p>
                      <p className="text-xs text-muted">{r.employee?.position}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3 text-muted">{r.checkIn || "—"}</td>
                <td className="px-5 py-3 text-muted">{r.checkOut || "—"}</td>
                <td className="px-5 py-3"><Badge status={r.status} /></td>
                <td className="px-5 py-3">
                  {r.approvalStatus === "pending" ? (
                    <div className="flex items-center gap-2">
                      <Badge status={r.approvalStatus} />
                      <button onClick={() => setApproval(r.id, "approved")} className="text-xs font-semibold text-success hover:underline">Approve</button>
                      <button onClick={() => setApproval(r.id, "rejected")} className="text-xs font-semibold text-danger hover:underline">Reject</button>
                    </div>
                  ) : (
                    <Badge status={r.approvalStatus} />
                  )}
                </td>
                <td className="px-5 py-3 text-right">
                  {r.checkIn && !r.checkOut && (
                    <button onClick={() => checkOut(r.id)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-danger hover:underline">
                      <LogOut className="w-3.5 h-3.5" /> Check out
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {unmarked.map((e) => (
              <tr key={"un-" + e.id} className="border-b border-border last:border-0 opacity-70">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold" style={{ background: e.avatarColor }}>
                      {e.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                    </div>
                    <div>
                      <p className="font-medium">{e.name}</p>
                      <p className="text-xs text-muted">{e.position}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3 text-muted">—</td>
                <td className="px-5 py-3 text-muted">—</td>
                <td className="px-5 py-3"><span className="text-xs text-muted">Not marked</span></td>
                <td className="px-5 py-3 text-muted">—</td>
                <td className="px-5 py-3 text-right">
                  <button onClick={() => checkIn(e.id)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                    <LogIn className="w-3.5 h-3.5" /> Check in
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
