// src/features/auth/api.ts
import { api } from "@/shared/api/client";
import type { LoginDto, LoginResp } from "./types";

// Use only the canonical login endpoint
export async function login(body: LoginDto) {
  return api<LoginResp>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// Registration helper: tries common endpoints (left unchanged)
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

