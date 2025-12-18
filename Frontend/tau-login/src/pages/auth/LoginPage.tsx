// src/pages/auth/LoginPage.tsx
import React, { useState } from "react";
import { login, verify } from "@/features/auth/api";
import { useAuth } from "@/shared/auth/AuthContext";
import { Link, useLocation, useNavigate } from "react-router-dom";
import LanguageSwitcher from "@/components/common/LanguageSwitcher";
import { t } from "@/shared/i18n";

export default function LoginPage() {
  const nav = useNavigate();
  const loc = useLocation() as any;
  const { setToken } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [verificationCode, setVerificationCode] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email || (step === 1 && !password)) return setError(t("auth.login.errorMissing"));

    setSubmitting(true);
    try {
      const resp =
        step === 1
          ? await login({ email, password })
          : await verify({ email, code: verificationCode });
      const anyResp = resp as any;
      if (step === 1 && anyResp && (anyResp as any).verification_required) {
        setStep(2);
        return;
      }

      // robust token extraction (supports several common shapes)
      function extractToken(obj: any): string | null {
        if (!obj) return null;
        if (typeof obj === "string") return obj;
        if (obj.access_token) return obj.access_token;
        if (obj.token) return obj.token;
        if (obj.jwt) return obj.jwt;
        if (obj.data) return extractToken(obj.data);
        if (obj.result) return extractToken(obj.result);
        // try first string property
        for (const k of Object.keys(obj)) {
          const v = obj[k];
          if (typeof v === "string" && /token|jwt|access/i.test(k)) return v;
        }
        return null;
      }

      const token = extractToken(resp);
      function extractRefresh(obj: any): string | null {
        if (!obj) return null;
        if (typeof obj === "string") return null;
        if (obj.refresh_token) return obj.refresh_token;
        if (obj.data) return extractRefresh(obj.data);
        for (const k of Object.keys(obj)) {
          const v = (obj as any)[k];
          if (typeof v === "string" && /refresh/i.test(k)) return v;
        }
        return null;
      }
      const refreshToken = extractRefresh(resp);

      if (!token) {
        // show server response to help debugging
        setError(
          `Не удалось получить токен из ответа сервера. Response: ${JSON.stringify(resp)}`
        );
        return;
      }

      setToken(token, remember);
      // persist refresh token alongside access token in the same storage
      try {
        const store = remember ? localStorage : sessionStorage;
        if (refreshToken) store.setItem("refresh_token", refreshToken);
      } catch {}
      const to = loc?.state?.from?.pathname || "/"; // вернуться туда, откуда редиректнули
      nav(to, { replace: true });
    } catch (err: any) {
      // if fetch/api client throws Error with message, show it; otherwise stringify
      setError(err?.message || JSON.stringify(err) || "Не удалось выполнить вход");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifySubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email || !verificationCode) return setError(t("auth.login.errorMissing"));

    setSubmitting(true);
    try {
      const resp = await verify({ email, code: verificationCode });

      function extractToken(obj: any): string | null {
        if (!obj) return null;
        if (typeof obj === "string") return obj;
        if ((obj as any).access_token) return (obj as any).access_token;
        if ((obj as any).token) return (obj as any).token;
        if ((obj as any).jwt) return (obj as any).jwt;
        if ((obj as any).data) return extractToken((obj as any).data);
        if ((obj as any).result) return extractToken((obj as any).result);
        for (const k of Object.keys(obj)) {
          const v = (obj as any)[k];
          if (typeof v === "string" && /token|jwt|access/i.test(k)) return v;
        }
        return null;
      }
      function extractRefresh(obj: any): string | null {
        if (!obj) return null;
        if (typeof obj === "string") return null;
        if ((obj as any).refresh_token) return (obj as any).refresh_token;
        if ((obj as any).data) return extractRefresh((obj as any).data);
        for (const k of Object.keys(obj)) {
          const v = (obj as any)[k];
          if (typeof v === "string" && /refresh/i.test(k)) return v;
        }
        return null;
      }

      const token = extractToken(resp);
      const refreshToken = extractRefresh(resp);

      if (!token) {
        setError(
          `Не удалось извлечь токен доступа из ответа. Response: ${JSON.stringify(resp)}`
        );
        return;
      }

      setToken(token, remember);
      try {
        const store = remember ? localStorage : sessionStorage;
        if (refreshToken) store.setItem("refresh_token", refreshToken);
      } catch {}
      const to = loc?.state?.from?.pathname || "/";
      nav(to, { replace: true });
    } catch (err: any) {
      setError(err?.message || JSON.stringify(err) || "Не удалось выполнить подтверждение");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#7b0f2b] via-[#8d1837] to-[#f2f2f5] flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl shadow-2xl bg-white/95 backdrop-blur border border-white/70 px-8 py-8">
        <div className="flex justify-end mb-4">
          <LanguageSwitcher />
        </div>
        <div className="text-center mb-6">
          <h1 className="text-xl font-semibold text-[#7b0f2b]">{t("auth.login.title")}</h1>
          <p className="text-slate-500 text-sm">{t("auth.login.subtitle")}</p>
        </div>

        <form onSubmit={step === 1 ? handleSubmit : handleVerifySubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t("auth.login.emailLabel")}</label>
            <input
              type="email"
              className="w-full rounded-lg border border-slate-200 focus:border-[#7b0f2b] focus:ring-[#7b0f2b] px-3 py-2 outline-none"
              placeholder="username@collegename.ac.in"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t("auth.login.passwordLabel")}</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                className="w-full rounded-lg border border-slate-200 focus:border-[#7b0f2b] focus:ring-[#7b0f2b] px-3 py-2 pr-10 outline-none"
                placeholder={t("auth.login.passwordPlaceholder")}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 px-3 text-slate-500 hover:text-slate-700"
                aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                className="rounded border-slate-300 text-[#7b0f2b] focus:ring-[#7b0f2b]"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <span className="text-slate-600">{t("auth.login.remember")}</span>
            </label>
            <Link to="/auth/forgot" className="text-[#7b0f2b] hover:underline">
              {t("auth.login.forgot")}
            </Link>
          </div>

          {step === 2 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Код подтверждения</label>
              <input
                className="w-full rounded-lg border border-slate-200 focus:border-[#7b0f2b] focus:ring-[#7b0f2b] px-3 py-2 outline-none"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
              />
              <p className="mt-1 text-xs text-slate-500">
                Мы отправили код на вашу почту. Введите его, чтобы завершить вход.
              </p>
            </div>
          )}

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-[#7b0f2b] text-white font-semibold py-2.5 disabled:opacity-70 hover:bg-[#6b0d26] transition"
          >
            {isSubmitting
              ? t("auth.register.success")
              : step === 1
              ? t("auth.login.submit")
              : "Подтвердить"}
          </button>
        </form>

          <div className="mt-5 flex items-center justify-between text-sm text-slate-600">
            <div>
              New User?{" "}
              <Link to="/auth/register" className="text-[#7b0f2b] hover:underline">
                {t("auth.login.actionLink")}
              </Link>
            </div>
            <a href="#" className="text-slate-500 hover:text-slate-700">
              {t("auth.login.guest")}
            </a>
          </div>
      </div>
    </div>
  );
}
