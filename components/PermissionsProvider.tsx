"use client";

import { createContext, useContext, useMemo } from "react";
import type { Module, Action, Scope } from "@/lib/authz";

export type PermissionEntry = { module: Module; action: Action; scope: Scope };

type PermissionMap = Map<string, Scope>;

const PermissionsContext = createContext<PermissionMap>(new Map());

function key(module: string, action: string) {
  return `${module}:${action}`;
}

export default function PermissionsProvider({
  permissions,
  children,
}: {
  permissions: PermissionEntry[];
  children: React.ReactNode;
}) {
  const map = useMemo(() => {
    const m: PermissionMap = new Map();
    for (const p of permissions) m.set(key(p.module, p.action), p.scope);
    return m;
  }, [permissions]);

  return <PermissionsContext.Provider value={map}>{children}</PermissionsContext.Provider>;
}

/** Raw scope lookup — 'ALL' | 'DEPARTMENT' | 'SELF' | null (not permitted at all). */
export function usePermissionScope(module: Module, action: Action): Scope | null {
  const map = useContext(PermissionsContext);
  return map.get(key(module, action)) ?? null;
}

/**
 * usePermission(module, action) — client-side counterpart to checkAccess(): true if the
 * signed-in user's role may perform `action` on `module` (at any scope). Drives UI element
 * hiding — wrap buttons with `{canDelete && <DeleteButton />}`.
 *
 * This only controls what renders; the API routes are the actual enforcement boundary
 * (see lib/authz.ts checkAccess/applyScopeFilter), so hiding a button here is a UX nicety,
 * not the security guarantee.
 */
export function usePermission(module: Module, action: Action): boolean {
  return usePermissionScope(module, action) !== null;
}
