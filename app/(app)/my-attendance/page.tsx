"use client";

import { useEffect, useMemo, useState } from "react";
import { LogIn, LogOut } from "lucide-react";
import Badge from "@/components/ui/Badge";

type AttRow = { id: number; employeeId: number; date: string; checkIn: string | null; checkOut: string | null; status: string; approvalStatus: string };

const today = new Date().toISOString().slice(0, 10);

export default function MyAttendancePage() {
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [rows, setRows] = useState<AttRow[]>([]);
  const [loading, setLoading] = useState(false);

  async function load(empId: number) {
    const r = await fetch(`/api/attendance?employeeId=${empId}`).then((r) => r.json());
    setRows(r);
  }

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => {
      if (d.user?.employeeId) {
        setEmployeeId(d.user.employeeId);
        load(d.user.employeeId);
      }
    });
  }, []);

  const todayRow = useMemo(() => rows.find((r) => r.date === today) || null, [rows]);

  async function checkIn() {
    if (!employeeId) return;
    setLoading(true);
    const time = new Date().toTimeString().slice(0, 5);
    await fetch("/api/attendance", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: today, checkIn: time, status: "present" }),
    });
    await load(employeeId);
    setLoading(false);
  }

  async function checkOut() {
    if (!todayRow || !employeeId) return;
    setLoading(true);
    const time = new Date().toTimeString().slice(0, 5);
    await fetch(`/api/attendance/${todayRow.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkOut: time }),
    });
    await load(employeeId);
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      <div className="card p-5 flex items-center justify-between">
        <div>
          <p className="font-semibold">Today — {today}</p>
          {todayRow ? (
            <p className="text-sm text-muted mt-1">
              In: {todayRow.checkIn || "—"} · Out: {todayRow.checkOut || "—"}
            </p>
          ) : (
            <p className="text-sm text-muted mt-1">You haven&apos;t checked in yet today.</p>
          )}
        </div>
        {!todayRow && (
          <button onClick={checkIn} disabled={loading} className="flex items-center gap-1.5 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-lg px-4 py-2.5 transition disabled:opacity-70">
            <LogIn className="w-4 h-4" /> Check in
          </button>
        )}
        {todayRow && !todayRow.checkOut && (
          <button onClick={checkOut} disabled={loading} className="flex items-center gap-1.5 bg-danger hover:opacity-90 text-white text-sm font-semibold rounded-lg px-4 py-2.5 transition disabled:opacity-70">
            <LogOut className="w-4 h-4" /> Check out
          </button>
        )}
        {todayRow?.checkOut && <Badge status={todayRow.approvalStatus} />}
      </div>

      <div className="card overflow-x-auto">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-base">My attendance history</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted border-b border-border">
              <th className="px-5 py-3 font-medium">Date</th>
              <th className="px-5 py-3 font-medium">Check-in</th>
              <th className="px-5 py-3 font-medium">Check-out</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Approval</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0">
                <td className="px-5 py-3 font-medium">{r.date}</td>
                <td className="px-5 py-3 text-muted">{r.checkIn || "—"}</td>
                <td className="px-5 py-3 text-muted">{r.checkOut || "—"}</td>
                <td className="px-5 py-3"><Badge status={r.status} /></td>
                <td className="px-5 py-3"><Badge status={r.approvalStatus} /></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center text-muted text-sm">No attendance records yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
