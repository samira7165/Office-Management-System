"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Eye, EyeOff, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"staff" | "employee">("staff");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function selectMode(m: "staff" | "employee") {
    setMode(m);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed");
        setLoading(false);
        return;
      }

      const role = data.user?.role;
      const isEmployee = role === "employee";
      if (mode === "employee" && !isEmployee) {
        await fetch("/api/auth/logout", { method: "POST" });
        setError("This is an admin/HR account — use the Admin / HR login instead.");
        setLoading(false);
        return;
      }
      if (mode === "staff" && isEmployee) {
        await fetch("/api/auth/logout", { method: "POST" });
        setError("This is an employee account — use the Employee login instead.");
        setLoading(false);
        return;
      }

      router.push(isEmployee ? "/my-attendance" : "/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 justify-center mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">OfficeHub</span>
        </div>

        <div className="card p-8 shadow-sm">
          <h1 className="text-xl font-semibold mb-1">Welcome back</h1>
          <p className="text-sm text-muted mb-6">Sign in to manage your office</p>

          <div className="grid grid-cols-2 gap-1.5 bg-background rounded-lg p-1 mb-6">
            <button
              type="button"
              onClick={() => selectMode("staff")}
              className={`text-sm font-semibold rounded-md py-2 transition ${
                mode === "staff" ? "bg-primary text-white" : "text-muted hover:text-foreground"
              }`}
            >
              Admin / HR
            </button>
            <button
              type="button"
              onClick={() => selectMode("employee")}
              className={`text-sm font-semibold rounded-md py-2 transition ${
                mode === "employee" ? "bg-primary text-white" : "text-muted hover:text-foreground"
              }`}
            >
              Employee
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium block mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-sm text-danger bg-danger-light rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-lg py-2.5 transition flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Sign in
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
