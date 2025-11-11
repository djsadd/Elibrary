import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import logo from "@/assets/images/Logo.svg";
import { register } from "@/features/auth/api";

export default function RegisterPage() {
  const [regNo, setRegNo] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nav = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setSubmitting(true);
    try {
      // Try backend registration; fallback to demo success
      try {
        await register({ email, password, reg_no: regNo || undefined });
      } catch (err) {
        // If no backend, keep UX flowing
        console.warn("register call failed; continuing demo flow", err);
      }
      nav("/auth/login");
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
        <div className="flex justify-center mb-4">
          {logo ? <img src={logo} alt="TAU" className="h-10" /> : <div className="text-xl font-semibold text-[#7b0f2b]">TAU</div>}
        </div>
        <h2 className="text-center text-slate-800 font-semibold">Registration</h2>
        <div className="text-center text-xs text-slate-500 mb-4">For Both Staff & Students</div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Reg No.</label>
            <input value={regNo} onChange={(e)=>setRegNo(e.target.value)} placeholder="College Reg. No." className="w-full rounded-lg border border-slate-200 px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">College Email ID</label>
            <input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="username@collegename.ac.in" required className="w-full rounded-lg border border-slate-200 px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <div className="relative">
              <input type={showPwd?"text":"password"} value={password} onChange={(e)=>setPassword(e.target.value)} required className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-10" />
              <button type="button" onClick={()=>setShowPwd(v=>!v)} className="absolute inset-y-0 right-0 px-3 text-slate-500">{showPwd?"🙈":"👁️"}</button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Confirm Password</label>
            <div className="relative">
              <input type={showPwd2?"text":"password"} value={confirm} onChange={(e)=>setConfirm(e.target.value)} required className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-10" />
              <button type="button" onClick={()=>setShowPwd2(v=>!v)} className="absolute inset-y-0 right-0 px-3 text-slate-500">{showPwd2?"🙈":"👁️"}</button>
            </div>
          </div>

          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

          <button type="submit" disabled={isSubmitting} className="w-full rounded-lg bg-[#7b0f2b] text-white font-semibold py-2.5 disabled:opacity-70 hover:bg-[#6b0d26] transition">{isSubmitting?"Registering...":"Register"}</button>
        </form>

        <div className="mt-5 flex items-center justify-between text-sm text-slate-600">
          <div>
            Already a User?{" "}
            <Link to="/auth/login" className="text-[#7b0f2b] hover:underline">Login now</Link>
          </div>
          <Link to="/" className="text-slate-500 hover:text-slate-700">Use as Guest</Link>
        </div>
      </div>
    </div>
  );
}
