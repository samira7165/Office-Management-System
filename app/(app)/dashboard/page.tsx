"use client";

import { useEffect, useState } from "react";
import { Users, UserCheck, Plane, Wallet, CheckCircle2 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import StatCard from "@/components/ui/StatCard";
import Badge from "@/components/ui/Badge";

type Stats = {
  totalEmployees: number;
  activeEmployees: number;
  onLeaveToday: number;
  presentToday: number;
  pendingLeaves: number;
  pendingPayroll: number;
  attendanceTrend: { date: string; present: number; absent: number; late: number }[];
  departmentBreakdown: { name: string; color: string; count: number }[];
};

type LeaveRow = { id: number; type: string; status: string; startDate: string; endDate: string; employee: { name: string } | null };
type TaskRow = { id: number; title: string; status: string; priority: string; dueDate: string | null; assignee: { name: string } | null };

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);

  useEffect(() => {
    fetch("/api/dashboard/stats").then((r) => r.json()).then(setStats);
    fetch("/api/leaves").then((r) => r.json()).then((d) => setLeaves(d.slice(0, 5)));
    fetch("/api/tasks").then((r) => r.json()).then((d) => setTasks(d.slice(0, 5)));
  }, []);

  if (!stats) return <div className="text-sm text-muted">Loading dashboard...</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Total Employees" value={stats.totalEmployees} icon={Users} tint="primary" />
        <StatCard label="Active" value={stats.activeEmployees} icon={UserCheck} tint="success" />
        <StatCard label="Present Today" value={stats.presentToday} icon={CheckCircle2} tint="info" />
        <StatCard label="On Leave" value={stats.onLeaveToday} icon={Plane} tint="warning" />
        <StatCard label="Pending Payroll" value={stats.pendingPayroll} icon={Wallet} tint="danger" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">Attendance — last 7 days</h3>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={stats.attendanceTrend}>
              <defs>
                <linearGradient id="present" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6C5DD3" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#6C5DD3" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} tick={{ fontSize: 11, fill: "#8b8da3" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#8b8da3" }} axisLine={false} tickLine={false} width={28} />
              <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #eaeaf3", fontSize: 12 }} />
              <Area type="monotone" dataKey="present" stroke="#6C5DD3" strokeWidth={2} fill="url(#present)" name="Present" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h3 className="font-semibold text-sm mb-4">Team by department</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={stats.departmentBreakdown} dataKey="count" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={3}>
                {stats.departmentBreakdown.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #eaeaf3", fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {stats.departmentBreakdown.map((d) => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                  {d.name}
                </span>
                <span className="text-muted font-medium">{d.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="font-semibold text-sm mb-4">Recent leave requests</h3>
          <div className="space-y-3">
            {leaves.length === 0 && <p className="text-sm text-muted">No leave requests yet.</p>}
            {leaves.map((l) => (
              <div key={l.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">{l.employee?.name || "—"}</p>
                  <p className="text-xs text-muted capitalize">{l.type} • {l.startDate} → {l.endDate}</p>
                </div>
                <Badge status={l.status} />
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <h3 className="font-semibold text-sm mb-4">Upcoming tasks</h3>
          <div className="space-y-3">
            {tasks.length === 0 && <p className="text-sm text-muted">No tasks yet.</p>}
            {tasks.map((t) => (
              <div key={t.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">{t.title}</p>
                  <p className="text-xs text-muted">{t.assignee?.name || "Unassigned"} {t.dueDate ? `• due ${t.dueDate}` : ""}</p>
                </div>
                <Badge status={t.status} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
