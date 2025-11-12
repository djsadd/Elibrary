// src/shared/api/client.ts
const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

// Track a single refresh in-flight to de-duplicate concurrent 401s
let refreshPromise: Promise<string | null> | null = null;

function parseJwtExp(token: string | null): number | null {
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (payload && typeof payload.exp === "number") return payload.exp;
  } catch {}
  return null;
}

function getActiveStorage(): Storage {
  // prefer where the token currently lives to preserve persistence semantics
  if (typeof localStorage !== "undefined" && localStorage.getItem("token")) return localStorage;
  return sessionStorage;
}

function saveTokens(accessToken: string | null, refreshToken?: string | null) {
  const store = getActiveStorage();
  if (accessToken) {
    store.setItem("token", accessToken);
    const exp = parseJwtExp(accessToken);
    if (exp) store.setItem("token_exp", String(exp)); else store.removeItem("token_exp");
  }
  if (refreshToken) {
    try { store.setItem("refresh_token", refreshToken); } catch {}
  }
}

async function tryRefresh(): Promise<string | null> {
  const store = getActiveStorage();
  const rt = store.getItem("refresh_token");
  if (!rt) return null;
  try {
    const r = await fetch(`${BASE}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Backend expects { token: <refresh_token> }
      body: JSON.stringify({ token: rt }),
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => `HTTP ${r.status}`);
      console.warn("refresh token failed", txt);
      return null;
    }
    const data = await r.json().catch(() => ({}));
    const token = extractAccessToken(data);
    const newRt = extractRefreshToken(data) || rt;
    if (token) {
      saveTokens(token, newRt);
      return token;
    }
  } catch (e) {
    console.warn("refresh token exception", e);
  }
  return null;
}

function extractAccessToken(obj: any): string | null {
  if (!obj) return null;
  if (typeof obj === "string") return obj;
  if (obj.access_token) return obj.access_token;
  if (obj.token) return obj.token;
  if (obj.jwt) return obj.jwt;
  if (obj.data) return extractAccessToken(obj.data);
  if (obj.result) return extractAccessToken(obj.result);
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (typeof v === "string" && /token|jwt|access/i.test(k)) return v;
  }
  return null;
}

function extractRefreshToken(obj: any): string | null {
  if (!obj) return null;
  if (obj.refresh_token) return obj.refresh_token;
  if (obj.data) return extractRefreshToken(obj.data);
  for (const k of Object.keys(obj)) {
    const v = (obj as any)[k];
    if (typeof v === "string" && /refresh/i.test(k)) return v;
  }
  return null;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("token") || sessionStorage.getItem("token");
  const isAuthEndpoint = /^\/?api\/auth\/(login|register|refresh)/i.test(path);
  if (!token && !isAuthEndpoint) {
    // Immediately redirect unauthenticated users to login for protected calls
    try { window.dispatchEvent(new CustomEvent("auth:logout")); } catch {}
    try { if (typeof window !== "undefined") window.location.assign("/login"); } catch {}
    throw new Error("No bearer token");
  }
  const doFetch = async (auth?: string) => {
    const mergedHeaders = {
      "Content-Type": "application/json",
      ...(init.headers || {} as any),
      ...(auth ? { Authorization: `Bearer ${auth}` } : (token ? { Authorization: `Bearer ${token}` } : {})),
    } as any;
    return fetch(`${BASE}${path}`, {
      ...init,
      headers: mergedHeaders,
    });
  };
  let res = await doFetch();
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    let message = txt || `HTTP ${res.status}`;
    try {
      const j = JSON.parse(txt);
      message = j?.detail || j?.message || j?.error || message;
    } catch {}
    // if unauthorized, clear stored token (server-side expired/invalidated) and notify app
    if (res.status === 401) {
      // attempt token refresh once
      if (!refreshPromise) refreshPromise = tryRefresh();
      const newToken = await refreshPromise.finally(() => { refreshPromise = null; });
      if (newToken) {
        res = await doFetch(newToken);
        if (res.ok) return res.json();
      }
      // no refresh or failed: clear and logout
      try {
        localStorage.removeItem("token"); localStorage.removeItem("token_exp"); localStorage.removeItem("refresh_token");
        sessionStorage.removeItem("token"); sessionStorage.removeItem("token_exp"); sessionStorage.removeItem("refresh_token");
      } catch {}
      try { window.dispatchEvent(new CustomEvent("auth:logout")); } catch {}
    }
    throw new Error(message);
  }
  return res.json();
}
