import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/shared/auth/AuthContext";

function readTokenFromStorage(): string | null {
  return localStorage.getItem("token") || sessionStorage.getItem("token");
}

function rolesFromToken(token: string | null): string[] {
  if (!token) return [];
  try {
    const parts = token.split(".");
    if (parts.length < 2) return [];
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    const r = payload?.roles;
    if (!r) return [];
    if (Array.isArray(r)) return r.map((x) => String(x));
    if (typeof r === "string") return [r];
    return [];
  } catch {
    return [];
  }
}

function isAdminOrLibrarian(token: string | null): boolean {
  const roles = rolesFromToken(token);
  return roles.some((r) => /^(admin|librarian)$/i.test(String(r)));
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
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function AdminRouteSync({ children }: { children: React.ReactNode }) {
  const token = readTokenFromStorage();
  if (!token) return <Navigate to="/login" replace />;
  if (!isAdminOrLibrarian(token)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function PublicRouteSync({ children }: { children: React.ReactNode }) {
  const token = readTokenFromStorage();
  if (!token) return <>{children}</>;
  return <Navigate to="/" replace />;
}
