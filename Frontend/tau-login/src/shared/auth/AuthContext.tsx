// src/shared/auth/AuthContext.tsx
import React, { createContext, useContext, useMemo, useState, useEffect } from "react";

type AuthState = {
  token: string | null;
  setToken: (t: string | null, remember?: boolean) => void;
  logout: () => void;
};

const Ctx = createContext<AuthState | null>(null);

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

  // auto-logout when token_exp is reached or when external auth:logout event dispatched
  useEffect(() => {
    const onAuthLogout = () => {
      setTokenState(null);
      try { localStorage.removeItem("token"); localStorage.removeItem("token_exp"); localStorage.removeItem("refresh_token"); } catch {}
      try { sessionStorage.removeItem("token"); sessionStorage.removeItem("token_exp"); sessionStorage.removeItem("refresh_token"); } catch {}
    };

    window.addEventListener("auth:logout", onAuthLogout as EventListener);

    // set interval to check expiry every 15s
    const t = setInterval(() => {
      const expStr = localStorage.getItem("token_exp") || sessionStorage.getItem("token_exp");
      if (!expStr) return;
      const exp = Number(expStr);
      if (!isNaN(exp) && Date.now()/1000 >= exp) {
        onAuthLogout();
      }
    }, 15000);

    return () => { window.removeEventListener("auth:logout", onAuthLogout as EventListener); clearInterval(t); };
  }, []);

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
