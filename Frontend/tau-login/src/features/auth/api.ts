// src/features/auth/api.ts
import { api } from "@/shared/api/client";
import type {
  LoginDto,
  LoginResp,
  PlatonusLoginDto,
  PlatonusLoginResp,
  PlatonusEmailRequestDto,
  PlatonusEmailVerifyDto,
  TwoFAResendDto,
  TwoFAVerifyDto,
} from "./types";

// Use only the canonical login endpoint
export async function login(body: LoginDto) {
  return api<LoginResp>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function platonusLogin(body: PlatonusLoginDto) {
  return api<PlatonusLoginResp>("/api/auth/platonus", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function platonusEmailRequest(body: PlatonusEmailRequestDto) {
  return api<{ ok: boolean; expires_in?: number }>("/api/auth/platonus/email/request", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function platonusEmailVerify(body: PlatonusEmailVerifyDto) {
  return api<LoginResp>("/api/auth/platonus/email/verify", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// Registration helper: tries common endpoints (left unchanged)
export type RegisterDto = {
  email: string;
  password: string;
  iin?: string;
  phone?: string;
  avatar_url?: string | null;
  role?: string;
  permissions?: string | null;
  institution?: string;
  faculty?: string;
  group_name?: string;
  subscription_type?: string;
  subscription_expire_at?: string | null;
  google_id?: string | null;
  github_id?: string | null;
};

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

export type VerifyDto = {
  email: string;
  code: string;
};

export async function verify(body: VerifyDto) {
  return api<LoginResp>("/api/auth/verify", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function verify2fa(body: TwoFAVerifyDto) {
  return api<LoginResp>("/api/auth/2fa/verify", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function resend2fa(body: TwoFAResendDto) {
  return api<{ ok: boolean; expires_in?: number }>("/api/auth/2fa/resend", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
