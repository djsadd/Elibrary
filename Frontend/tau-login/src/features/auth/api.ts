// src/features/auth/api.ts
import { api } from "@/shared/api/client";
import type { LoginDto, LoginResp } from "./types";

// Try a handful of common auth endpoints and return the first successful response.
export async function login(body: LoginDto) {
  const paths = ["/api/auth", "/api/auth/login", "/api/auth/token", "/token"];
  let lastErr: any = null;
  for (const p of paths) {
    try {
      return await api<LoginResp>(p, {
        method: "POST",
        body: JSON.stringify(body),
      });
    } catch (err) {
      lastErr = err;
      // try next
      console.debug(`login attempt ${p} failed:`, err);
    }
  }
  // all attempts failed — throw the last error
  throw lastErr;
}

// Registration helper: tries common endpoints
export type RegisterDto = { email: string; password: string; reg_no?: string };
export async function register(body: RegisterDto) {
  const paths = [
    "/api/auth/register",
    "/auth/register",
    "/api/register",
    "/register",
  ];
  let lastErr: any = null;
  for (const p of paths) {
    try {
      return await api<any>(p, { method: "POST", body: JSON.stringify(body) });
    } catch (err) {
      lastErr = err;
      console.debug(`register attempt ${p} failed:`, err);
    }
  }
  throw lastErr;
}
