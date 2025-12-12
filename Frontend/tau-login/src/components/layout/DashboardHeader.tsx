// Desktop header (hidden on small screens)
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { getLang } from "@/shared/i18n";
import { api } from "@/shared/api/client";

export default function DashboardHeader() {
  const [filterOpen, setFilterOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [filter, setFilter] = useState<string>(() => localStorage.getItem("ui_filter") || "All");
  const [lang, setLang] = useState<string>(() => localStorage.getItem("ui_lang") || "EN");
  const [time, setTime] = useState<string>("");
  const [dateStr, setDateStr] = useState<string>("");
  const [query, setQuery] = useState("");
  const nav = useNavigate();

  const filterRef = useRef<HTMLDivElement | null>(null);
  const langRef = useRef<HTMLDivElement | null>(null);
  const userRef = useRef<HTMLDivElement | null>(null);
  const notifRef = useRef<HTMLDivElement | null>(null);

  type Notif = { id: string; title: string; body?: string; time?: string; read?: boolean; type?: 'info'|'success'|'warning' };
  const [notifs, setNotifs] = useState<Notif[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('ui_notifs') || '[]');
      if (Array.isArray(saved) && saved.length) return saved;
    } catch {}
    const now = new Date();
    return [
      { id: 'n1', title: 'New book added', body: '“Design of Everyday Things” is now available.', time: now.toLocaleTimeString(), read: false, type: 'success' },
      { id: 'n2', title: 'System update', body: 'Library catalogue was refreshed.', time: now.toLocaleTimeString(), read: false, type: 'info' },
      { id: 'n3', title: 'Reminder', body: 'Check out latest AI articles.', time: now.toLocaleTimeString(), read: true, type: 'warning' },
    ];
  });
  useEffect(() => { try { localStorage.setItem('ui_notifs', JSON.stringify(notifs)); } catch {} }, [notifs]);

  // Fetch notifications for current user from backend
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api<any>(`/api/notification/`);
        const arr: any[] = Array.isArray(res)
          ? res
          : (Array.isArray(res?.items) ? res.items : (Array.isArray(res?.data) ? res.data : []));
        const mapped = arr.map((n: any, idx: number) => {
          const id = String(n.id ?? n.uuid ?? idx);
          const title = n.title ?? n.subject ?? n.header ?? 'Notification';
          const body = n.body ?? n.message ?? n.text ?? '';
          const time = n.time ?? n.created_at ?? n.createdAt ?? n.date ?? undefined;
          const read = Boolean(n.read ?? n.seen ?? n.is_read ?? false);
          const type = (n.type ?? n.level ?? 'info');
          return { id, title, body, time, read, type } as any;
        });
        if (!cancelled) setNotifs(mapped);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      const now = new Date();
      setTime(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      setDateStr(now.toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" }));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onDocDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (filterRef.current && !filterRef.current.contains(t)) setFilterOpen(false);
      if (langRef.current && !langRef.current.contains(t)) setLangOpen(false);
      if (userRef.current && !userRef.current.contains(t)) setUserOpen(false);
      if (notifRef.current && !notifRef.current.contains(t)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", onDocDown, true);
    return () => document.removeEventListener("mousedown", onDocDown, true);
  }, []);

  const doSearch = () => {
    const q = query.trim();
    if (!q) return;
    // Navigate to dedicated search page
    nav(`/search?q=${encodeURIComponent(q)}`);
  };

  const Capsule = ({ children }: { children: React.ReactNode }) => (
    <div className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-white border text-sm shadow-sm">
      {children}
    </div>
  );

  return (
    <div className="hidden sm:flex items-center justify-between mb-6">
      {/* left: filter + search */}
      <div className="flex-1 flex items-center gap-3">
        <div ref={filterRef} className="relative">
          <Capsule>
            <button onClick={() => setFilterOpen(v=>!v)} className="flex items-center gap-2">
              <span>{filter}</span>
              <svg className="w-4 h-4 text-slate-400" viewBox="0 0 20 20" fill="none"><path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </Capsule>
          {filterOpen && (
            <div className="absolute z-50 mt-2 w-40 bg-white border rounded-md shadow" onMouseDown={(e)=>e.stopPropagation()}>
              {["All","Books","E-Books","Audio","Articles"].map(opt => (
                <button key={opt} onClick={()=>{ setFilter(opt); localStorage.setItem("ui_filter", opt); setFilterOpen(false); }} className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm">{opt}</button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 relative">
          <input value={query} onChange={(e)=>setQuery(e.target.value)} onKeyDown={(e)=>{ if(e.key==='Enter') doSearch(); }} placeholder="Search" className="w-full border rounded-full py-2 px-4 text-sm pr-10" />
          <button onClick={doSearch} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#7b0f2b] flex items-center justify-center w-8 h-8 rounded-full hover:bg-[#fff1f2]" aria-label="Search">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none"><path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.5" /></svg>
          </button>
        </div>
      </div>

      {/* right: language, time, date, user */}
      <div className="flex items-center gap-3">
        <div ref={langRef} className="relative">
          <Capsule>
            <button onClick={()=>setLangOpen(v=>!v)} className="flex items-center gap-2">
              {/* Language (globe) icon */}
              <svg className="w-4 h-4 text-[#7b0f2b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18" strokeLinecap="round" />
                <path d="M12 3c2.6 2.6 3.9 5.6 3.9 9s-1.3 6.4-3.9 9" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12 3c-2.6 2.6-3.9 5.6-3.9 9s1.3 6.4 3.9 9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>{lang}</span>
              <svg className="w-4 h-4 text-slate-400" viewBox="0 0 20 20" fill="none"><path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </Capsule>
          {langOpen && (
            <div className="absolute z-50 right-0 mt-2 w-32 bg-white border rounded-md shadow" onMouseDown={(e)=>e.stopPropagation()}>
              {["EN","RU","KK"].map(l => (
                <button
                  key={l}
                  onClick={()=>{
                    setLang(l);
                    try { localStorage.setItem("ui_lang", l); } catch {}
                    setLangOpen(false);
                    try { window.dispatchEvent(new Event('lang:changed')); } catch {}
                    // simplest: refresh to re-render everything
                    window.location.reload();
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm"
                >{l}</button>
              ))}
            </div>
          )}
        </div>

        <div ref={notifRef} className="relative">
          <Capsule>
            {/* Notifications bell */}
            <button type="button" aria-label="Notifications" onClick={()=>setNotifOpen(v=>!v)} className="flex items-center gap-2">
              <span className="relative">
                {/* Notification (bell) icon */}
                <svg className="w-5 h-5 text-[#7b0f2b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                  <path d="M18 8a6 6 0 10-12 0v3c0 .7-.3 1.3-1 2l-1 1h16l-1-1c-.7-.7-1-1.3-1-2V8" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M10 21h4" strokeLinecap="round" />
                </svg>
                {notifs.some(n=>!n.read) && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500" />}
              </span>
              <span className="hidden md:inline text-xs text-slate-600">Notifications</span>
            </button>
          </Capsule>
          {notifOpen && (
            <div className="absolute z-50 right-0 mt-2 w-80 bg-white border rounded-md shadow max-h-96 overflow-auto" onMouseDown={(e)=>e.stopPropagation()}>
              <div className="flex items-center justify-between px-3 py-2 border-b">
                <div className="text-sm font-medium">Notifications</div>
                <div className="flex items-center gap-2 text-xs">
                  <button className="px-2 py-1 rounded border" onClick={()=>setNotifs(ns=>ns.map(n=>({...n, read:true })))}>Mark all read</button>
                  <button className="px-2 py-1 rounded border" onClick={()=>setNotifs([])}>Clear</button>
                </div>
              </div>
              {notifs.length === 0 ? (
                <div className="p-4 text-sm text-slate-500">No notifications</div>
              ) : notifs.map(n => (
                <button key={n.id} onClick={()=>setNotifs(ns=>ns.map(x=>x.id===n.id?{...x,read:true}:x))} className={`w-full text-left px-3 py-2 flex items-start gap-3 hover:bg-slate-50 ${n.read? 'opacity-75':''}`}>
                  <span className={`mt-1 w-2 h-2 rounded-full ${n.read? 'bg-slate-300':'bg-emerald-500'}`} />
                  <span className="flex-1">
                    <div className="text-sm text-slate-800">{n.title}</div>
                    {n.body && <div className="text-xs text-slate-500 mt-0.5">{n.body}</div>}
                  </span>
                  {n.time && <span className="text-xs text-slate-400">{n.time}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <div ref={userRef} className="relative">
          <Capsule>
            <button onClick={()=>setUserOpen(v=>!v)} className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-slate-300 flex items-center justify-center overflow-hidden"><span className="text-xs font-medium text-white">U</span></div>
              <div className="text-sm">User</div>
              <svg className="w-4 h-4 text-slate-400" viewBox="0 0 20 20" fill="none"><path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </Capsule>
          {userOpen && (
            <div className="absolute z-50 right-0 mt-2 w-48 bg-white border rounded-md shadow" onMouseDown={(e)=>e.stopPropagation()}>
              <button onClick={()=>{ setUserOpen(false); nav('/profile'); }} className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm">Profile</button>
              <button onClick={()=>{ setUserOpen(false); nav('/shelf'); }} className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm">My Shelf</button>
              <button onClick={()=>{ setUserOpen(false); try{ localStorage.removeItem('token'); sessionStorage.removeItem('token'); window.dispatchEvent(new CustomEvent('auth:logout')); }catch{} nav('/login'); }} className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm text-rose-600">Logout</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Mobile fragment: to be shown inside the sidebar on mobile
const LANGS = [
  { code: "en", label: "English" },
  { code: "ru", label: "Русский" },
  { code: "kk", label: "Қазақша" },
];

export function MobileDashboardHeader() {
  const currentLang = getLang();
  const handleLangChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value;
    localStorage.setItem("ui_lang", next);
    try {
      window.dispatchEvent(new Event("lang:changed"));
    } catch {}
    window.location.reload();
  };

  const currentLabel = LANGS.find((lang) => lang.code === currentLang)?.label ?? LANGS[0].label;

  return (
    <div className="sm:hidden px-4 pt-3 pb-2 border-b">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-slate-800">TAU</div>
        <label className="relative inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium shadow-sm text-[#7b0f2b]">
          <span>{currentLabel}</span>
          <svg className="w-3 h-3" viewBox="0 0 10 7" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <select
            value={currentLang}
            onChange={handleLangChange}
            className="absolute inset-0 opacity-0"
            aria-label="Select language"
          >
            {LANGS.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

