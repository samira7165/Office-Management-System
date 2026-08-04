"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Leave = { id: number; type: string; startDate: string; endDate: string; status: string; employee: { name: string } | null };

const TYPE_COLOR: Record<string, string> = {
  sick: "var(--danger)", casual: "var(--info)", annual: "var(--primary)", unpaid: "var(--muted)",
};

export default function CalendarPage() {
  const [cursor, setCursor] = useState(new Date());
  const [leaves, setLeaves] = useState<Leave[]>([]);

  useEffect(() => { fetch("/api/leaves").then((r) => r.json()).then(setLeaves); }, []);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = useMemo(() => {
    const arr: (number | null)[] = [];
    for (let i = 0; i < startOffset; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(d);
    return arr;
  }, [startOffset, daysInMonth]);

  function leavesOnDay(day: number) {
    const ds = new Date(year, month, day).toISOString().slice(0, 10);
    return leaves.filter((l) => l.status === "approved" && l.startDate <= ds && l.endDate >= ds);
  }

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between card p-4">
        <h2 className="font-semibold">{cursor.toLocaleString("default", { month: "long", year: "numeric" })}</h2>
        <div className="flex gap-2">
          <button onClick={() => setCursor(new Date(year, month - 1, 1))} className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-background"><ChevronLeft className="w-4 h-4" /></button>
          <button onClick={() => setCursor(new Date())} className="px-3 h-8 rounded-lg border border-border text-xs font-medium hover:bg-background">Today</button>
          <button onClick={() => setCursor(new Date(year, month + 1, 1))} className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-background"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="card p-4">
        <div className="grid grid-cols-7 gap-2 mb-2">
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
            <div key={d} className="text-xs font-medium text-muted text-center py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {cells.map((day, i) => {
            const ds = day ? new Date(year, month, day).toISOString().slice(0, 10) : "";
            const dayLeaves = day ? leavesOnDay(day) : [];
            return (
              <div key={i} className={`min-h-[90px] rounded-lg border p-1.5 ${day ? "border-border" : "border-transparent"} ${ds === todayStr ? "bg-primary-light border-primary" : ""}`}>
                {day && (
                  <>
                    <p className={`text-xs font-medium mb-1 ${ds === todayStr ? "text-primary" : "text-muted"}`}>{day}</p>
                    <div className="space-y-1">
                      {dayLeaves.slice(0, 2).map((l) => (
                        <div key={l.id} className="text-[10px] px-1.5 py-0.5 rounded truncate" style={{ background: `${TYPE_COLOR[l.type]}1a`, color: TYPE_COLOR[l.type] }}>
                          {l.employee?.name?.split(" ")[0]}
                        </div>
                      ))}
                      {dayLeaves.length > 2 && <p className="text-[10px] text-muted">+{dayLeaves.length - 2} more</p>}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex gap-4 text-xs">
        {Object.entries(TYPE_COLOR).map(([type, color]) => (
          <span key={type} className="flex items-center gap-1.5 capitalize text-muted">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} /> {type}
          </span>
        ))}
      </div>
    </div>
  );
}
