import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { login, platonusEmailRequest, platonusEmailVerify, platonusLogin as platonusLoginApi, resend2fa, verify, verify2fa } from "@/features/auth/api";
import LanguageSwitcher from "@/components/common/LanguageSwitcher";
import { useAuth } from "@/shared/auth/AuthContext";
import { t } from "@/shared/i18n";

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 3l18 18" />
      <path d="M10.58 10.58A3 3 0 0 0 12 15a3 3 0 0 0 2.42-4.42" />
      <path d="M9.88 5.09A10.43 10.43 0 0 1 12 5c6.5 0 10 7 10 7a18.3 18.3 0 0 1-3.16 4.3" />
      <path d="M6.61 6.61A18.3 18.3 0 0 0 2 12s3.5 7 10 7a10.43 10.43 0 0 0 2.12-.21" />
    </svg>
  );
}

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

  const [twofaChallengeId, setTwofaChallengeId] = useState<string | null>(null);
  const [twofaCode, setTwofaCode] = useState("");
  const [twofaResendCooldown, setTwofaResendCooldown] = useState<number>(0);

  const [isPlatonusMode, setIsPlatonusMode] = useState(true);
  const [platonusLogin, setPlatonusLogin] = useState("");
  const [platonusPassword, setPlatonusPassword] = useState("");
  const [platonusEmailChallengeId, setPlatonusEmailChallengeId] = useState<string | null>(null);
  const [platonusNewEmail, setPlatonusNewEmail] = useState("");
  const [platonusEmailCode, setPlatonusEmailCode] = useState("");
  const [platonusEmailCodeSent, setPlatonusEmailCodeSent] = useState(false);
  const [platonusEmailResendCooldown, setPlatonusEmailResendCooldown] = useState(0);
  const [platonusEmailFixed, setPlatonusEmailFixed] = useState(false);

  function extractToken(obj: any): string | null {
    if (!obj) return null;
    if (typeof obj === "string") return obj;
    if (obj.access_token) return obj.access_token;
    if (obj.token) return obj.token;
    if (obj.jwt) return obj.jwt;
    if (obj.data) return extractToken(obj.data);
    if (obj.result) return extractToken(obj.result);
    for (const key of Object.keys(obj)) {
      const v = obj[key];
      if (typeof v === "string" && /token|jwt|access/i.test(key)) return v;
    }
    return null;
  }

  function extractRefresh(obj: any): string | null {
    if (!obj) return null;
    if (typeof obj === "string") return null;
    if (obj.refresh_token) return obj.refresh_token;
    if (obj.data) return extractRefresh(obj.data);
    for (const key of Object.keys(obj)) {
      const v = (obj as any)[key];
      if (typeof v === "string" && /refresh/i.test(key)) return v;
    }
    return null;
  }

  function storeTokens(token: string, refreshToken: string | null) {
    setToken(token, remember);
    try {
      const store = remember ? localStorage : sessionStorage;
      if (refreshToken) store.setItem("refresh_token", refreshToken);
    } catch {}
  }

  function startPlatonusEmailCooldown(seconds = 30) {
    setPlatonusEmailResendCooldown(seconds);
    const interval = window.setInterval(() => {
      setPlatonusEmailResendCooldown((v) => {
        if (v <= 1) {
          window.clearInterval(interval);
          return 0;
        }
        return v - 1;
      });
    }, 1000);
  }

  function tokenMissingError(resp: unknown) {
    const anyResp = resp as any;
    const unwrap = (v: any): any => (v && typeof v === "object" ? (v.data ?? v.result ?? v) : v);
    const v = unwrap(anyResp);

    if (v?.requires_email && v?.challenge_id) {
      setPlatonusEmailChallengeId(String(v.challenge_id));
      setPlatonusEmailCode("");
      const bound = typeof v?.bound_email === "string" ? v.bound_email : "";
      const codeSent = Boolean(v?.code_sent) && Boolean(bound);
      setPlatonusNewEmail(codeSent ? bound : "");
      setPlatonusEmailFixed(codeSent);
      setPlatonusEmailCodeSent(codeSent);
      setPlatonusEmailResendCooldown(0);
      setError(codeSent ? null : (v?.message || t("auth.login.errorGeneric")));
      if (codeSent) startPlatonusEmailCooldown(30);
      return;
    }
    if (v?.requires_2fa && v?.challenge_id) {
      setTwofaChallengeId(String(v.challenge_id));
      setTwofaCode("");
      setTwofaResendCooldown(0);
      return;
    }

    setError(t("auth.login.errorTokenMissing", { response: JSON.stringify(resp) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email || (step === 1 && !password)) return setError(t("auth.login.errorMissing"));

    setSubmitting(true);
    try {
      const resp = step === 1 ? await login({ email, password }) : await verify({ email, code: verificationCode });
      const anyResp = resp as any;

      if (step === 1 && anyResp?.verification_required) {
        setStep(2);
        return;
      }

      if (step === 1 && anyResp?.requires_2fa && anyResp?.challenge_id) {
        setTwofaChallengeId(String(anyResp.challenge_id));
        setTwofaCode("");
        setTwofaResendCooldown(0);
        return;
      }

      const token = extractToken(resp);
      const refreshToken = extractRefresh(resp);
      if (!token) return tokenMissingError(resp);

      storeTokens(token, refreshToken);
      const to = loc?.state?.from?.pathname || "/";
      nav(to, { replace: true });
    } catch (err: any) {
      setError(err?.message || JSON.stringify(err) || t("auth.login.errorGeneric"));
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
      const token = extractToken(resp);
      const refreshToken = extractRefresh(resp);
      if (!token) return tokenMissingError(resp);

      storeTokens(token, refreshToken);
      const to = loc?.state?.from?.pathname || "/";
      nav(to, { replace: true });
    } catch (err: any) {
      setError(err?.message || JSON.stringify(err) || t("auth.login.errorGeneric"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTwofaSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!twofaChallengeId || !twofaCode) return setError(t("auth.login.errorMissing"));

    setSubmitting(true);
    try {
      const resp = await verify2fa({ challenge_id: twofaChallengeId, code: twofaCode });
      const token = extractToken(resp);
      const refreshToken = extractRefresh(resp);
      if (!token) return tokenMissingError(resp);

      storeTokens(token, refreshToken);

      setTwofaChallengeId(null);
      setTwofaCode("");

      const to = loc?.state?.from?.pathname || "/";
      nav(to, { replace: true });
    } catch (err: any) {
      setError(err?.message || JSON.stringify(err) || t("auth.login.errorGeneric"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTwofaResend() {
    setError(null);
    if (!twofaChallengeId) return;
    if (twofaResendCooldown > 0) return;

    setSubmitting(true);
    try {
      await resend2fa({ challenge_id: twofaChallengeId });
      setTwofaResendCooldown(30);
      const interval = window.setInterval(() => {
        setTwofaResendCooldown((v) => {
          if (v <= 1) {
            window.clearInterval(interval);
            return 0;
          }
          return v - 1;
        });
      }, 1000);
    } catch (err: any) {
      setError(err?.message || JSON.stringify(err) || t("auth.login.errorGeneric"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePlatonusSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!platonusLogin || !platonusPassword) return setError(t("auth.login.errorMissing"));

    setSubmitting(true);
    try {
      const resp = await platonusLoginApi({ login: platonusLogin, password: platonusPassword });
      const anyResp = resp as any;
      if (anyResp?.requires_email && anyResp?.challenge_id) {
        setPlatonusEmailChallengeId(String(anyResp.challenge_id));
        setPlatonusEmailCode("");
        const bound = typeof anyResp?.bound_email === "string" ? anyResp.bound_email : "";
        const codeSent = Boolean(anyResp?.code_sent) && Boolean(bound);
        setPlatonusNewEmail(codeSent ? bound : "");
        setPlatonusEmailFixed(codeSent);
        setPlatonusEmailCodeSent(codeSent);
        setPlatonusEmailResendCooldown(0);
        setError(codeSent ? null : (anyResp?.message || t("auth.login.errorGeneric")));
        if (codeSent) startPlatonusEmailCooldown(30);
        return;
      }
      if (anyResp?.requires_2fa && anyResp?.challenge_id) {
        setTwofaChallengeId(String(anyResp.challenge_id));
        setTwofaCode("");
        setTwofaResendCooldown(0);
        return;
      }

      const token = extractToken(resp);
      const refreshToken = extractRefresh(resp);
      if (!token) return tokenMissingError(resp);

      storeTokens(token, refreshToken);
      const to = loc?.state?.from?.pathname || "/";
      nav(to, { replace: true });
    } catch (err: any) {
      setError(err?.message || JSON.stringify(err) || t("auth.login.errorGeneric"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePlatonusEmailSend() {
    setError(null);
    if (!platonusEmailChallengeId) return;
    const email = platonusNewEmail.trim();
    if (!email) return setError(t("auth.login.errorMissing"));
    setSubmitting(true);
    try {
      await platonusEmailRequest({ challenge_id: platonusEmailChallengeId, email });
      setPlatonusEmailCodeSent(true);
      startPlatonusEmailCooldown(30);
    } catch (err: any) {
      setError(err?.message || JSON.stringify(err) || t("auth.login.errorGeneric"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePlatonusEmailVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!platonusEmailChallengeId) return;
    const email = platonusNewEmail.trim();
    if (!email || !platonusEmailCode) return setError(t("auth.login.errorMissing"));
    setSubmitting(true);
    try {
      const resp = await platonusEmailVerify({ challenge_id: platonusEmailChallengeId, email, code: platonusEmailCode });
      const token = extractToken(resp);
      const refreshToken = extractRefresh(resp);
      if (!token) return tokenMissingError(resp);
      storeTokens(token, refreshToken);
      const to = loc?.state?.from?.pathname || "/";
      nav(to, { replace: true });
    } catch (err: any) {
      setError(err?.message || JSON.stringify(err) || t("auth.login.errorGeneric"));
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
          <h1 className="text-xl font-semibold text-[#7b0f2b]">
            {isPlatonusMode ? t("auth.login.platonusTitle") : t("auth.login.title")}
          </h1>
          <p className="text-slate-500 text-sm">
            {isPlatonusMode ? t("auth.login.platonusSubtitle") : t("auth.login.subtitle")}
          </p>
        </div>

        {twofaChallengeId ? (
          <form onSubmit={handleTwofaSubmit} className="space-y-4">
            <div className="text-slate-600 text-sm">{t("auth.login.twofaPrompt")}</div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("auth.login.twofaCodeLabel")}</label>
              <input
                type="text"
                inputMode="numeric"
                className="w-full rounded-lg border border-slate-200 focus:border-[#7b0f2b] focus:ring-[#7b0f2b] px-3 py-2 outline-none"
                value={twofaCode}
                onChange={(e) => setTwofaCode(e.target.value)}
                placeholder="000000"
                autoComplete="one-time-code"
                required
              />
            </div>

            {error && <div className="text-sm text-red-600">{error}</div>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-[#7b0f2b] text-white py-2 font-medium disabled:opacity-60"
            >
              {isSubmitting ? t("auth.login.loading") : t("auth.common.verify")}
            </button>

            <button
              type="button"
              onClick={handleTwofaResend}
              disabled={isSubmitting || twofaResendCooldown > 0}
              className="w-full rounded-lg border border-slate-200 py-2 font-medium disabled:opacity-60"
            >
              {twofaResendCooldown > 0
                ? t("auth.common.resendCooldown", { seconds: twofaResendCooldown })
                : t("auth.common.resendCode")}
            </button>
          </form>
        ) : platonusEmailChallengeId ? (
          <form onSubmit={handlePlatonusEmailVerify} className="space-y-4">
            <div className="text-slate-600 text-sm">
              {platonusEmailFixed
                ? t("auth.login.platonusEmailVerifyPrompt")
                : t("auth.login.platonusEmailChangePrompt")}
            </div>

            {platonusEmailFixed ? (
              <div className="text-sm text-slate-700">
                <span className="font-medium">{t("auth.login.emailLabel")}:</span> {platonusNewEmail}
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t("auth.login.emailLabel")}</label>
                <input
                  type="email"
                  className="w-full rounded-lg border border-slate-200 focus:border-[#7b0f2b] focus:ring-[#7b0f2b] px-3 py-2 outline-none"
                  value={platonusNewEmail}
                  onChange={(e) => setPlatonusNewEmail(e.target.value)}
                  placeholder={t("auth.login.emailPlaceholder")}
                  autoComplete="email"
                  required
                />
              </div>
            )}

            {platonusEmailCodeSent && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t("auth.login.verifyCodeLabel")}</label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="w-full rounded-lg border border-slate-200 focus:border-[#7b0f2b] focus:ring-[#7b0f2b] px-3 py-2 outline-none"
                  value={platonusEmailCode}
                  onChange={(e) => setPlatonusEmailCode(e.target.value)}
                  placeholder="000000"
                  autoComplete="one-time-code"
                  required
                />
              </div>
            )}

            {error && <div className="text-sm text-red-600">{error}</div>}

            {!platonusEmailCodeSent ? (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handlePlatonusEmailSend}
                className="w-full rounded-lg bg-[#7b0f2b] text-white py-2 font-medium disabled:opacity-60"
              >
                {isSubmitting ? t("auth.login.loading") : t("auth.common.sendCode")}
              </button>
            ) : (
              <>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-lg bg-[#7b0f2b] text-white py-2 font-medium disabled:opacity-60"
                >
                  {isSubmitting ? t("auth.login.loading") : t("auth.common.verify")}
                </button>
                <button
                  type="button"
                  onClick={handlePlatonusEmailSend}
                  disabled={isSubmitting || platonusEmailResendCooldown > 0}
                  className="w-full rounded-lg border border-slate-200 py-2 font-medium disabled:opacity-60"
                >
                  {platonusEmailResendCooldown > 0
                    ? t("auth.common.resendCooldown", { seconds: platonusEmailResendCooldown })
                    : t("auth.common.resendCode")}
                </button>
              </>
            )}
          </form>
        ) : !isPlatonusMode ? (
          <>
            <form onSubmit={step === 1 ? handleSubmit : handleVerifySubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t("auth.login.emailLabel")}</label>
                <input
                  type="email"
                  className="w-full rounded-lg border border-slate-200 focus:border-[#7b0f2b] focus:ring-[#7b0f2b] px-3 py-2 outline-none"
                  placeholder={t("auth.login.emailPlaceholder")}
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
                    aria-label={showPassword ? t("auth.common.hidePassword") : t("auth.common.showPassword")}
                  >
                    {showPassword ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
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
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t("auth.common.verificationCodeLabel")}</label>
                  <input
                    className="w-full rounded-lg border border-slate-200 focus:border-[#7b0f2b] focus:ring-[#7b0f2b] px-3 py-2 outline-none"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    autoComplete="one-time-code"
                  />
                  <p className="mt-1 text-xs text-slate-500">{t("auth.common.verificationCodeHelp")}</p>
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
                {isSubmitting ? t("auth.login.loading") : step === 1 ? t("auth.login.submit") : t("auth.common.verify")}
              </button>
            </form>

            <div className="mt-4 flex items-center gap-2">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-xs text-slate-400">{t("auth.common.or")}</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            <button
              type="button"
              onClick={() => {
                setIsPlatonusMode(true);
                setError(null);
              }}
              className="mt-3 w-full rounded-lg border border-[#7b0f2b] text-[#7b0f2b] font-semibold py-2.5 hover:bg-[#7b0f2b]/5 transition"
            >
              {t("auth.login.platonusButton")}
            </button>
          </>
        ) : (
          <>
            <form onSubmit={handlePlatonusSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t("auth.login.platonusLoginLabel")}</label>
                <input
                  className="w-full rounded-lg border border-slate-200 focus:border-[#7b0f2b] focus:ring-[#7b0f2b] px-3 py-2 outline-none"
                  placeholder={t("auth.login.platonusLoginPlaceholder")}
                  value={platonusLogin}
                  onChange={(e) => setPlatonusLogin(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t("auth.login.platonusPasswordLabel")}</label>
                <input
                  type="password"
                  className="w-full rounded-lg border border-slate-200 focus:border-[#7b0f2b] focus:ring-[#7b0f2b] px-3 py-2 outline-none"
                  placeholder={t("auth.login.platonusPasswordPlaceholder")}
                  value={platonusPassword}
                  onChange={(e) => setPlatonusPassword(e.target.value)}
                />
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-lg bg-[#7b0f2b] text-white font-semibold py-2.5 hover:bg-[#6b0d26] transition"
              >
                {isSubmitting ? t("auth.login.loading") : t("auth.login.platonusButton")}
              </button>
            </form>

            <button
              type="button"
              onClick={() => {
                setIsPlatonusMode(false);
                setError(null);
              }}
              className="mt-4 w-full rounded-lg border border-slate-200 text-slate-600 font-medium py-2.5 hover:bg-slate-50 transition text-sm"
            >
              {t("auth.login.backToDefault")}
            </button>
          </>
        )}

        <div className="mt-5 flex items-center justify-between text-sm text-slate-600">
          <div>
            {t("auth.login.newUserPrefix")}{" "}
            <Link to="/auth/register" className="text-[#7b0f2b] hover:underline">
              {t("auth.login.actionLink")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
