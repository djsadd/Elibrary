// src/shared/auth/AuthContext.tsx
import React, { createContext, useContext, useMemo, useState, useEffect } from "react";

type AuthState = {
  token: string | null;
  setToken: (t: string | null, remember?: boolean) => void;
  logout: () => void;
};

const Ctx = createContext<AuthState | null>(null);

function revokeSession(fallbackToken: string | null) {
  const token = localStorage.getItem("token") || sessionStorage.getItem("token") || fallbackToken;
  const refresh = localStorage.getItem("refresh_token") || sessionStorage.getItem("refresh_token");
  if (!token) return;
  const base = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
  void fetch(`${base}/api/auth/logout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: refresh ? JSON.stringify({ token: refresh }) : undefined,
    keepalive: true,
  }).catch(() => {});
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [tokenState, setTokenState] = useState<string | null>(
    localStorage.getItem("token") || sessionStorage.getItem("token")
  );

  // helper to parse exp from JWT (returns exp as seconds since epoch) or null
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

  // auto-logout when external auth:logout event dispatched
  useEffect(() => {
    const onAuthLogout = () => {
      revokeSession(tokenState);
      setTokenState(null);
      try { localStorage.removeItem("token"); localStorage.removeItem("token_exp"); localStorage.removeItem("refresh_token"); } catch {}
      try { sessionStorage.removeItem("token"); sessionStorage.removeItem("token_exp"); sessionStorage.removeItem("refresh_token"); } catch {}
    };

    window.addEventListener("auth:logout", onAuthLogout as EventListener);
    return () => { window.removeEventListener("auth:logout", onAuthLogout as EventListener); };
  }, [tokenState]);

  const value = useMemo<AuthState>(
    () => ({
      token: tokenState,
      setToken: (t, remember) => {
        setTokenState(t);
        if (t) {
          const exp = parseJwtExp(t);
          if (remember) {
            localStorage.setItem("token", t);
            if (exp) localStorage.setItem("token_exp", String(exp));
            else localStorage.removeItem("token_exp");
          } else {
            sessionStorage.setItem("token", t);
            if (exp) sessionStorage.setItem("token_exp", String(exp));
            else sessionStorage.removeItem("token_exp");
          }
        } else {
          localStorage.removeItem("token");
          localStorage.removeItem("token_exp");
          localStorage.removeItem("refresh_token");
          sessionStorage.removeItem("token");
          sessionStorage.removeItem("token_exp");
          sessionStorage.removeItem("refresh_token");
        }
      },
      logout: () => {
        revokeSession(tokenState);
        setTokenState(null);
        localStorage.removeItem("token"); localStorage.removeItem("token_exp"); localStorage.removeItem("refresh_token");
        sessionStorage.removeItem("token"); sessionStorage.removeItem("token_exp"); sessionStorage.removeItem("refresh_token");
      },
    }),
    [tokenState]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
