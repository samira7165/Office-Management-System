// Shared client helpers — no DB imports, safe for both API routes and client components.
import { CLIENT_TYPES, type ClientType } from "@/lib/projects";

export type ClientInput = {
  name: string; type: ClientType; contactPerson: string; email: string;
  phone: string; address: string; notes: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validates a create (partial=false) or edit (partial=true) body; copies only known fields. */
export function parseClientInput(body: Record<string, unknown>, partial: boolean):
  { data: Partial<ClientInput>; error?: undefined } | { data?: undefined; error: string } {
  const out: Partial<ClientInput> = {};
  const has = (k: string) => k in body;
  const str = (k: string) => (typeof body[k] === "string" ? (body[k] as string).trim() : "");

  if (!partial || has("name")) {
    if (!str("name")) return { error: "Client name is required" };
    if (str("name").length > 191) return { error: "Client name is too long" };
    out.name = str("name");
  }
  if (!partial || has("type")) {
    const t = str("type") || "client";
    if (!(CLIENT_TYPES as readonly string[]).includes(t)) return { error: "Type must be client or agency" };
    out.type = t as ClientType;
  }
  if (has("email")) {
    if (str("email") && !EMAIL_RE.test(str("email"))) return { error: "Email address looks invalid" };
    out.email = str("email");
  }
  for (const k of ["contactPerson", "phone", "address", "notes"] as const) {
    if (has(k)) out[k] = str(k);
  }
  return { data: out };
}
