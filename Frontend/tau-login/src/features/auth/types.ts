// src/features/auth/types.ts
export type LoginDto = { email: string; password: string };
export type LoginResp =
  | { access_token: string }
  | { token: string }
  | { jwt: string }
  | { refresh_token?: string }
  | { data?: { access_token?: string; token?: string; jwt?: string; refresh_token?: string } };
