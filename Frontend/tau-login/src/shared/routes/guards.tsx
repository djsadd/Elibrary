import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/shared/auth/AuthContext";

function readTokenFromStorage(): string | null {
  return localStorage.getItem("token") || sessionStorage.getItem("token");
}

function readTokenExpFromStorage(): number | null {
  const v = localStorage.getItem("token_exp") || sessionStorage.getItem("token_exp");
  if (!v) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function clearStoredToken() {
  try { localStorage.removeItem("token"); localStorage.removeItem("token_exp"); } catch {}
  try { sessionStorage.removeItem("token"); sessionStorage.removeItem("token_exp"); } catch {}
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  // Try to read token from context first; if context is not available for some reason,
  // fall back to reading from storage directly. This makes the guard robust in dev.
  let token: string | null = null;
  try {
    token = useAuth().token;
  } catch {
    token = readTokenFromStorage();
  }

  const loc = useLocation();
  if (!token) return <Navigate to="/login" replace state={{ from: loc }} />;
  return <>{children}</>;
}

export function PublicRoute({ children }: { children: React.ReactNode }) {
  // Redirect to home if already authenticated. Like ProtectedRoute, try context then storage.
  let token: string | null = null;
  try {
    token = useAuth().token;
  } catch {
    token = readTokenFromStorage();
  }
  if (token) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// Synchronous route guards (do not use hooks) — safer to use at router-level to
// immediately redirect based on stored token. These are used by the router so
// navigation doesn't depend on React context initialization timing.
export function ProtectedRouteSync({ children }: { children: React.ReactNode }) {
  const token = readTokenFromStorage();
  const exp = readTokenExpFromStorage();
  if (!token) return <Navigate to="/login" replace />;
  if (exp && Date.now()/1000 >= exp) {
    // token expired — clear and redirect to login
    clearStoredToken();
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export function PublicRouteSync({ children }: { children: React.ReactNode }) {
  const token = readTokenFromStorage();
  const exp = readTokenExpFromStorage();
  if (!token) return <>{children}</>;
  if (exp && Date.now()/1000 >= exp) {
    clearStoredToken();
    return <>{children}</>;
  }
  return <Navigate to="/" replace />;
}
