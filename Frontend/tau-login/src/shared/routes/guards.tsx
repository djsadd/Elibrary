import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/shared/auth/AuthContext";

function readTokenFromStorage(): string | null {
  return localStorage.getItem("token") || sessionStorage.getItem("token");
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

export function PublicRouteSync({ children }: { children: React.ReactNode }) {
  const token = readTokenFromStorage();
  if (!token) return <>{children}</>;
  return <Navigate to="/" replace />;
}
