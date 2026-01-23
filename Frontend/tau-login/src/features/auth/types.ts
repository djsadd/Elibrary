// src/features/auth/types.ts
export type LoginDto = { email: string; password: string };
export type LoginResp =
  | { access_token: string }
  | { token: string }
  | { jwt: string }
  | { refresh_token?: string }
  | { requires_2fa: true; challenge_id: string; expires_in?: number }
  | { data?: { access_token?: string; token?: string; jwt?: string; refresh_token?: string } };

export type PlatonusLoginDto = { login: string; password: string };
export type PlatonusLoginResp =
  | (LoginResp & { student_info?: Record<string, unknown> })
  | { requires_email: true; challenge_id: string; existing_email?: string; message?: string };

export type TwoFAVerifyDto = { challenge_id: string; code: string };
export type TwoFAResendDto = { challenge_id: string };

export type PlatonusEmailRequestDto = { challenge_id: string; email: string };
export type PlatonusEmailVerifyDto = { challenge_id: string; email: string; code: string };
