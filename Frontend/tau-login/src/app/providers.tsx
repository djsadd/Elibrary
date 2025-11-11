import React from "react";
import { AuthProvider } from "@/shared/auth/AuthContext";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
