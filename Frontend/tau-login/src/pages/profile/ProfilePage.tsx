import { useEffect, useRef, useState } from "react";
import { api } from "@/shared/api/client";
import { t } from "@/shared/i18n";

type Profile = {
  fullName: string;
  email: string;
  regNo: string;
  phone: string;
  bio: string;
   institution?: string;
   faculty?: string;
   groupName?: string;
   studentId?: string;
  avatar?: string | null; // dataURL
};

const defaultProfile: Profile = {
  fullName: "Reinhard Kenson",
  email: "kensoncs.official@college.com",
  regNo: "6020220",
  phone: "+7 777 123 45 67",
  bio: "I'm a Student",
  institution: "",
  faculty: "",
  groupName: "",
  studentId: "",
  avatar: null,
};

export default function ProfilePage() {
  const [tab, setTab] = useState<"account" | "security" | "notifications" | "interface">("account");
  const [form, setForm] = useState<Profile>(() => {
    try {
      return { ...defaultProfile, ...(JSON.parse(localStorage.getItem("ui_profile") || "{}") || {}) };
    } catch {
      return defaultProfile;
    }
  });
  const [avatarPreview, setAvatarPreview] = useState<string | null>(form.avatar || null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [readingCount, setReadingCount] = useState<number>(0);
  const aliveRef = useRef(true);

  useEffect(() => {
    try { localStorage.setItem("ui_profile", JSON.stringify({ ...form, avatar: avatarPreview })); } catch {}
  }, [form, avatarPreview]);

  // Load actual profile from backend: GET /api/auth/profile
  useEffect(() => {
    aliveRef.current = true;
    (async () => {
      try {
        const data: any = await api<any>(`/api/auth/profile`);
        if (!aliveRef.current || !data) return;
        setForm(prev => ({
          ...prev,
          email: data.email ?? prev.email,
          phone: data.phone ?? prev.phone,
          regNo: (data.student_id != null ? String(data.student_id) : prev.regNo),
          studentId: (data.student_id != null ? String(data.student_id) : prev.studentId),
          institution: data.institution ?? prev.institution,
          faculty: data.faculty ?? prev.faculty,
          groupName: data.group_name ?? prev.groupName,
          // if backend later returns name/full_name, prefer it here
          fullName: data.full_name ?? data.name ?? prev.fullName,
        }));
        if (typeof data.reading_history_count === 'number') setReadingCount(data.reading_history_count);
        if (data.avatar_url) setAvatarPreview(String(data.avatar_url));
      } catch {
        // keep local defaults on failure
      }
    })();
    return () => { aliveRef.current = false; };
  }, []);

  const onAvatarPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(String(reader.result));
    reader.readAsDataURL(f);
  };

  const Stat = ({ color, icon, value, label }: { color: string; icon: React.ReactNode; value: number; label: string }) => (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg text-white" style={{ backgroundColor: color }}>
      <div className="w-9 h-9 rounded-md bg-white/20 flex items-center justify-center">{icon}</div>
      <div>
        <div className="text-lg font-semibold leading-none">{value}</div>
        <div className="text-xs opacity-90">{label}</div>
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-6">
      <h2 className="text-2xl font-semibold mb-4">{t('profile.title')}</h2>

      <div className="bg-white rounded-xl shadow-sm border">
        {/* Tabs */}
        <div className="px-4 md:px-6 pt-4 border-b flex items-center gap-6 text-sm">
          {([
            ["account", t('profile.tabs.account')],
            ["security", t('profile.tabs.security')],
            ["notifications", t('profile.tabs.notifications')],
            ["interface", t('profile.tabs.interface')],
          ] as const).map(([key,label]) => (
            <button key={key} onClick={()=>setTab(key)} className={`py-3 -mb-px border-b-2 ${tab===key ? 'border-[#7b0f2b] text-[#7b0f2b]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>{label}</button>
          ))}
        </div>

        <div className="p-4 md:p-6">
          {tab === 'account' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left: avatar + stats */}
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center">
                    {avatarPreview ? <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" /> : <span className="text-slate-500">U</span>}
                  </div>
                  <div>
                    <button onClick={()=>fileRef.current?.click()} className="text-xs text-[#7b0f2b] hover:underline">{t('profile.account.uploadPhoto')}</button>
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onAvatarPick} />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Stat color="#F97316" value={readingCount} label={t('profile.stats.readings')} icon={<svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 6h16v12H4z" /><path d="M8 6v12" /></svg>} />
                  <Stat color="#7C3AED" value={10} label={t('profile.stats.contribution')} icon={<svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 3v18" /><path d="M5 8h14" /></svg>} />
                </div>
              </div>

              {/* Right: form */}
              <div className="lg:col-span-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">{t('profile.account.fullName')}</label>
                    <input value={form.fullName} onChange={(e)=>setForm({...form, fullName:e.target.value})} className="w-full border rounded-md px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">{t('profile.account.email')}</label>
                    <input type="email" value={form.email} onChange={(e)=>setForm({...form, email:e.target.value})} className="w-full border rounded-md px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">{t('profile.account.regNo')}</label>
                    <input value={form.regNo} onChange={(e)=>setForm({...form, regNo:e.target.value})} className="w-full border rounded-md px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">{t('profile.account.phone')}</label>
                    <input value={form.phone} onChange={(e)=>setForm({...form, phone:e.target.value})} className="w-full border rounded-md px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Учреждение (ВУЗ)</label>
                    <input value={form.institution || ""} onChange={(e)=>setForm({...form, institution:e.target.value})} className="w-full border rounded-md px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Факультет</label>
                    <input value={form.faculty || ""} onChange={(e)=>setForm({...form, faculty:e.target.value})} className="w-full border rounded-md px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Группа</label>
                    <input value={form.groupName || ""} onChange={(e)=>setForm({...form, groupName:e.target.value})} className="w-full border rounded-md px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Студенческий ID</label>
                    <input value={form.studentId || ""} onChange={(e)=>setForm({...form, studentId:e.target.value})} className="w-full border rounded-md px-3 py-2" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm text-slate-600 mb-1">{t('profile.account.bio')}</label>
                    <textarea value={form.bio} onChange={(e)=>setForm({...form, bio:e.target.value})} className="w-full border rounded-md px-3 py-2 h-24" />
                  </div>
                </div>

                <div className="mt-4 flex items-center">
                  <button
                    type="button"
                    className="px-4 py-2 rounded-md bg-[#7b0f2b] text-white"
                    onClick={async () => {
                      try {
                        await api(`/api/auth/profile`, {
                          method: "PUT",
                          body: JSON.stringify({
                            phone: form.phone || undefined,
                            avatar_url: avatarPreview || undefined,
                            institution: form.institution || undefined,
                            faculty: form.faculty || undefined,
                            group_name: form.groupName || undefined,
                            student_id: (form.studentId || form.regNo) || undefined,
                          }),
                        });
                      } catch {
                        // keep silent on failure for now
                      }
                    }}
                  >
                    {t('profile.account.update')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === 'security' && (
            <div className="text-sm text-slate-600 space-y-3">
              <div className="font-medium text-slate-800">Login & Security</div>
              <div>Two‑factor authentication: <span className="text-amber-600">Disabled</span></div>
              <div>Last password change: 3 months ago</div>
              <button className="px-3 py-2 rounded-md border">Change password</button>
            </div>
          )}

          {tab === 'notifications' && (
            <div className="text-sm text-slate-600 space-y-2">
              <div className="font-medium text-slate-800">Notifications</div>
              <label className="flex items-center gap-2"><input type="checkbox" defaultChecked /> Email updates</label>
              <label className="flex items-center gap-2"><input type="checkbox" /> New releases</label>
              <label className="flex items-center gap-2"><input type="checkbox" defaultChecked /> Weekly digest</label>
            </div>
          )}

          {tab === 'interface' && (
            <div className="text-sm text-slate-600 space-y-3">
              <div className="font-medium text-slate-800">Interface</div>
              <label className="flex items-center gap-2"><input type="checkbox" defaultChecked /> Compact mode</label>
              <label className="flex items-center gap-2"><input type="checkbox" /> High contrast</label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
