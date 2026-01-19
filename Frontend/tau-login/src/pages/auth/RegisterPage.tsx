import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import logo from "@/assets/images/Logo.svg";
import { register, verify } from "@/features/auth/api";
import LanguageSwitcher from "@/components/common/LanguageSwitcher";
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

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [iin, setIin] = useState("");
  const [phone, setPhone] = useState("");
  const [institution, setInstitution] = useState("");
  const [faculty, setFaculty] = useState("");
  const [groupName, setGroupName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [step, setStep] = useState<1 | 2>(1);
  const [verificationCode, setVerificationCode] = useState("");

  const nav = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (step === 1) {
        if (password !== confirm) {
          setError(t("auth.register.passwordMismatch"));
          return;
        }

        try {
          await register({
            email,
            password,
            iin: iin || undefined,
            phone: phone || undefined,
            institution: institution || undefined,
            faculty: faculty || undefined,
            group_name: groupName || undefined,
            role: "student",
            subscription_type: "free",
          });
        } catch (err) {
          console.warn("register call failed; continuing demo flow", err);
        }

        setStep(2);
      } else {
        await verify({ email, code: verificationCode });
        nav("/");
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Register failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#7b0f2b] via-[#8d1837] to-[#f2f2f5] flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl shadow-2xl bg-white/95 backdrop-blur border border-white/70 px-8 py-8">
        <div className="flex justify-between items-center mb-3 gap-3">
          <div className="flex-1 flex justify-center">
            {logo ? (
              <img src={logo} alt="TAU" className="h-10" />
            ) : (
              <div className="text-xl font-semibold text-[#7b0f2b]">TAU</div>
            )}
          </div>
          <LanguageSwitcher />
        </div>

        <h2 className="text-center text-slate-800 font-semibold">{t("auth.register.title")}</h2>
        <div className="text-center text-xs text-slate-500 mb-4">
          {step === 1 ? t("auth.register.subtitle") : t("auth.register.verifySubtitle")}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {step === 1 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("auth.register.iinLabel")}</label>
              <input
                value={iin}
                onChange={(e) => setIin(e.target.value)}
                maxLength={12}
                placeholder={t("auth.register.iinPlaceholder")}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </div>
          )}

          {step === 1 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("auth.register.email")}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("auth.register.emailPlaceholder")}
                required
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </div>
          )}

          {step === 1 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("auth.register.phoneLabel")}</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t("auth.register.phonePlaceholder")}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </div>
          )}

          {step === 1 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("auth.register.institutionLabel")}</label>
              <input
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder={t("auth.register.institutionPlaceholder")}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </div>
          )}

          {step === 1 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("auth.register.facultyLabel")}</label>
              <input
                value={faculty}
                onChange={(e) => setFaculty(e.target.value)}
                placeholder={t("auth.register.facultyPlaceholder")}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </div>
          )}

          {step === 1 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("auth.register.groupLabel")}</label>
              <input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder={t("auth.register.groupPlaceholder")}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </div>
          )}

          {step === 2 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("auth.common.verificationCodeLabel")}</label>
              <input
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
                autoComplete="one-time-code"
              />
              <div className="mt-1 text-xs text-slate-500">{t("auth.common.verificationCodeHelp")}</div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t("auth.register.password")}</label>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder={t("auth.register.passwordPlaceholder")}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute inset-y-0 right-0 px-3 text-slate-500 hover:text-slate-700"
                aria-label={showPwd ? t("auth.common.hidePassword") : t("auth.common.showPassword")}
              >
                {showPwd ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t("auth.register.confirmPassword")}</label>
            <div className="relative">
              <input
                type={showPwd2 ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                placeholder={t("auth.register.confirmPasswordPlaceholder")}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPwd2((v) => !v)}
                className="absolute inset-y-0 right-0 px-3 text-slate-500 hover:text-slate-700"
                aria-label={showPwd2 ? t("auth.common.hidePassword") : t("auth.common.showPassword")}
              >
                {showPwd2 ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-[#7b0f2b] text-white font-semibold py-2.5 disabled:opacity-70 hover:bg-[#6b0d26] transition"
          >
            {isSubmitting ? t("auth.register.success") : step === 1 ? t("auth.register.submit") : t("auth.common.verify")}
          </button>
        </form>

        <div className="mt-5 flex items-center justify-between text-sm text-slate-600">
          <div>
            {t("auth.register.haveAccountPrefix")}{" "}
            <Link to="/auth/login" className="text-[#7b0f2b] hover:underline">
              {t("auth.register.actionLink")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

