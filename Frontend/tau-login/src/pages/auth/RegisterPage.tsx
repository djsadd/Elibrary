import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import logo from "@/assets/images/Logo.svg";
import { register, verify } from "@/features/auth/api";
import LanguageSwitcher from "@/components/common/LanguageSwitcher";
import { t } from "@/shared/i18n";

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
          setError("Passwords do not match");
          return;
        }
        // Шаг 1: регистрация и отправка кода
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
        // Шаг 2: подтверждение кода и автоматический логин
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
            {logo ? <img src={logo} alt="TAU" className="h-10" /> : <div className="text-xl font-semibold text-[#7b0f2b]">TAU</div>}
          </div>
          <LanguageSwitcher />
        </div>
        <h2 className="text-center text-slate-800 font-semibold">
          {step === 1 ? t("auth.register.title") : t("auth.register.title")}
        </h2>
        <div className="text-center text-xs text-slate-500 mb-4">
          {step === 1
            ? t("auth.register.subtitle")
            : "Введите код подтверждения, отправленный на почту"}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {step === 1 && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">ИИН</label>
            <input
              value={iin}
              onChange={(e)=>setIin(e.target.value)}
              maxLength={12}
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </div>
          )}
          {false && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t("auth.register.regNo")}</label>
            
          </div>
          )}
          {false && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Студенческий ID</label>
            
          </div>
          )}
          {step === 1 && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t("auth.register.email")}</label>
            <input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="username@collegename.ac.in" required className="w-full rounded-lg border border-slate-200 px-3 py-2" />
          </div>
          )}
          {step === 1 && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Телефон</label>
            <input value={phone} onChange={(e)=>setPhone(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2" />
          </div>
          )}
          {step === 1 && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Учреждение (ВУЗ)</label>
            <input value={institution} onChange={(e)=>setInstitution(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2" />
          </div>
          )}
          {step === 1 && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Факультет</label>
            <input value={faculty} onChange={(e)=>setFaculty(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2" />
          </div>
          )}
          {step === 1 && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Группа</label>
            <input value={groupName} onChange={(e)=>setGroupName(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2" />
          </div>
          )}

          {step === 2 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Код подтверждения
              </label>
              <input
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
              <div className="mt-1 text-xs text-slate-500">
                Введите код из письма. Если код не пришёл, проверьте спам.
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t("auth.register.password")}</label>
            <div className="relative">
              <input type={showPwd?"text":"password"} value={password} onChange={(e)=>setPassword(e.target.value)} required className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-10" />
              <button type="button" onClick={()=>setShowPwd(v=>!v)} className="absolute inset-y-0 right-0 px-3 text-slate-500">{showPwd?"🙈":"👁️"}</button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t("auth.register.confirmPassword")}</label>
            <div className="relative">
              <input type={showPwd2?"text":"password"} value={confirm} onChange={(e)=>setConfirm(e.target.value)} required className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-10" />
              <button type="button" onClick={()=>setShowPwd2(v=>!v)} className="absolute inset-y-0 right-0 px-3 text-slate-500">{showPwd2?"🙈":"👁️"}</button>
            </div>
          </div>

          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

          <button type="submit" disabled={isSubmitting} className="w-full rounded-lg bg-[#7b0f2b] text-white font-semibold py-2.5 disabled:opacity-70 hover:bg-[#6b0d26] transition">
            {isSubmitting
              ? t("auth.register.success")
              : step === 1
              ? t("auth.register.submit")
              : "Подтвердить"}
          </button>
        </form>

        <div className="mt-5 flex items-center justify-between text-sm text-slate-600">
          <div>
            Already a User?{" "}
            <Link to="/auth/login" className="text-[#7b0f2b] hover:underline">{t("auth.register.actionLink")}</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
