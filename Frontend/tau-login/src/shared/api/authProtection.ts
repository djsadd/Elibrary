import { api } from "@/shared/api/client";

export type LockoutScope = "ip" | "email";

export type LockoutItem = {
  scope: LockoutScope;
  ident: string;
  ttl_seconds: number;
  reason?: string | null;
  locked_at?: number | null;
  email_failures?: number | null;
  ip_failures?: number | null;
  extra?: Record<string, any> | null;
};

export type LockoutListResponse = {
  items: LockoutItem[];
  next_cursor: number;
};

export async function listLockouts(scope: LockoutScope, cursor = 0, limit = 100) {
  const qs = new URLSearchParams({
    scope,
    cursor: String(cursor || 0),
    limit: String(limit || 100),
  });
  return api<LockoutListResponse>(`/api/auth/protection/lockouts?${qs.toString()}`);
}

export async function clearLockout(scope: LockoutScope, ident: string) {
  const qs = new URLSearchParams({ scope, ident });
  return api<{ ok: boolean }>(`/api/auth/protection/lockouts?${qs.toString()}`, { method: "DELETE" });
}

export async function banLockout(body: {
  scope: LockoutScope;
  ident: string;
  duration_seconds?: number;
  reason?: string;
  extra?: Record<string, any> | null;
}) {
  return api<{ ok: boolean; ttl_seconds?: number }>(`/api/auth/protection/lockouts/ban`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

