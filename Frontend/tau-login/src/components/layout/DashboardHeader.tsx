// Desktop header (hidden on small screens)
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { t } from "@/shared/i18n";
import { api } from "@/shared/api/client";
import { suggestBooks, type SuggestItem } from "@/shared/api/search";
import { namesFrom } from "@/shared/ui/text";
import LanguageSwitcher from "@/components/common/LanguageSwitcher";

type FilterId = "all" | "books" | "ebooks" | "audio" | "articles";
const FILTER_TO_FORMAT: Record<FilterId, string | null> = {
  all: null,
  books: "HARDCOPY",
  ebooks: "EBOOK",
  audio: "AUDIOBOOK",
  articles: "ARTICLE",
};
const FILTERS: Array<{ id: FilterId; icon: React.ReactNode }> = [
  {
    id: "all",
    icon: (
      <svg className="w-4 h-4 text-[#7b0f2b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <path d="M4 6h16M6 12h12M8 18h8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "books",
    icon: (
      <svg className="w-4 h-4 text-[#7b0f2b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <path d="M6 4h11a2 2 0 012 2v14a2 2 0 00-2-2H6a2 2 0 00-2 2V6a2 2 0 012-2z" strokeLinejoin="round" />
        <path d="M6 18h11" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "ebooks",
    icon: (
      <svg className="w-4 h-4 text-[#7b0f2b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <path d="M7 4h10a2 2 0 012 2v14a2 2 0 00-2-2H7a2 2 0 00-2 2V6a2 2 0 012-2z" strokeLinejoin="round" />
        <path d="M9 8h6M9 11h6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "audio",
    icon: (
      <svg className="w-4 h-4 text-[#7b0f2b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <path d="M9 18a2 2 0 100-4 2 2 0 000 4z" />
        <path d="M11 14V6l10-2v8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M19 16a2 2 0 100-4 2 2 0 000 4z" />
      </svg>
    ),
  },
  {
    id: "articles",
    icon: (
      <svg className="w-4 h-4 text-[#7b0f2b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <path d="M6 4h9l3 3v13a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2z" strokeLinejoin="round" />
        <path d="M15 4v4h4" strokeLinejoin="round" />
        <path d="M7 12h10M7 15h10" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function DashboardHeader() {
  const [filterOpen, setFilterOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [filter, setFilter] = useState<FilterId>(() => {
    const raw = (localStorage.getItem("ui_filter") || "").trim().toLowerCase();
    const legacy: Record<string, FilterId> = {
      all: "all",
      books: "books",
      "e-books": "ebooks",
      ebooks: "ebooks",
      audio: "audio",
      articles: "articles",
    };
    return legacy[raw] ?? "all";
  });
  const [time, setTime] = useState<string>("");
  const [dateStr, setDateStr] = useState<string>("");
  const [query, setQuery] = useState("");
  const nav = useNavigate();

  const filterRef = useRef<HTMLDivElement | null>(null);
  const userRef = useRef<HTMLDivElement | null>(null);
  const notifRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLDivElement | null>(null);

  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestItems, setSuggestItems] = useState<SuggestItem[]>([]);
  const [activeIdx, setActiveIdx] = useState<number>(-1);

  const queryTrimmed = useMemo(() => query.trim(), [query]);
  const notifLabel = t("header.notifications.label");
  const notifTitle = t("header.notifications.title");
  const notifMarkAllRead = t("header.notifications.markAllRead");
  const notifClear = t("header.notifications.clear");
  const notifEmpty = t("header.notifications.empty");
  const filterLabel = t(`header.filters.${filter}`);
  const searchPlaceholder = t("header.search.placeholder");
  const searchAriaLabel = t("header.search.ariaLabel");
  const suggestionsLabel = t("header.search.suggestions");
  const searchingLabel = t("header.search.searching");
  const openFullResultsLabel = t("header.search.openFullResults");
  const searchForLabel = t("header.search.searchFor", { q: queryTrimmed });
  const bookLabel = t("header.search.book");
  const openLabel = t("header.search.open");
  const noSuggestionsLabel = t("header.search.noSuggestions");

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
        const res = await api<any>(`/notification/`);
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
      if (userRef.current && !userRef.current.contains(t)) setUserOpen(false);
      if (notifRef.current && !notifRef.current.contains(t)) setNotifOpen(false);
      if (searchRef.current && !searchRef.current.contains(t)) {
        setSuggestOpen(false);
        setActiveIdx(-1);
      }
    };
    document.addEventListener("mousedown", onDocDown, true);
    return () => document.removeEventListener("mousedown", onDocDown, true);
  }, []);

  useEffect(() => {
    if (queryTrimmed.length < 2) {
      setSuggestLoading(false);
      setSuggestItems([]);
      setSuggestOpen(false);
      setActiveIdx(-1);
      return;
    }

    const controller = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        setSuggestLoading(true);
        const format = FILTER_TO_FORMAT[filter] ?? null;

        const normalizeFormats = (raw: any): string[] => {
          const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
          return arr
            .map((s) => String(s).trim().toUpperCase().replace(/[^A-Z]/g, ""))
            .map((s) => s.replace(/^EBOOKS?$/, "EBOOK").replace(/^AUDIOBOOKS?$/, "AUDIOBOOK").replace(/^VIDEOBOOKS?$/, "VIDEOBOOK"))
            .filter(Boolean);
        };

        const matchesFormat = (book: any, f: string) => {
          const formats = normalizeFormats(book?.formats);
          if (f === "HARDCOPY") return formats.includes("HARDCOPY") || (!formats.length && !!book);
          return formats.includes(f);
        };

        if (!format) {
          const resp = await suggestBooks(queryTrimmed, { limit: 8, signal: controller.signal });
          setSuggestItems(Array.isArray(resp.items) ? resp.items : []);
        } else {
          const params = new URLSearchParams();
          params.set("q", queryTrimmed);
          params.set("limit", "40");
          params.set("offset", "0");
          const data: any = await api<any>(`/api/catalog/books/search?${params.toString()}`, { signal: controller.signal });
          const rawItems: any[] = Array.isArray(data?.items) ? data.items : [];
          const filtered = rawItems.filter((b) => matchesFormat(b, format));
          const mapped: SuggestItem[] = filtered
            .slice(0, 8)
            .map((b) => ({
              id: Number(b?.id),
              title: String(b?.title || ""),
              authors: namesFrom(b?.authors),
            }))
            .filter((s) => Number.isFinite(s.id) && s.title);
          setSuggestItems(mapped);
        }
        setSuggestOpen(true);
        setActiveIdx(-1);
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        setSuggestItems([]);
        setSuggestOpen(false);
      } finally {
        setSuggestLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(t);
    };
  }, [queryTrimmed, filter]);

  const doSearch = () => {
    if (!queryTrimmed) return;
    // Navigate to dedicated search page
    const params = new URLSearchParams();
    params.set("q", queryTrimmed);
    if (filter !== "all") params.set("filter", filter);
    nav(`/search?${params.toString()}`);
    setSuggestOpen(false);
    setActiveIdx(-1);
  };

  const goToBook = (id: number) => {
    setSuggestOpen(false);
    setActiveIdx(-1);
    nav(`/catalog/${id}`);
  };

  const highlight = (text: string, q: string) => {
    const hay = (text || "").toLowerCase();
    const needle = (q || "").toLowerCase();
    const idx = needle ? hay.indexOf(needle) : -1;
    if (idx < 0) return <span>{text}</span>;
    const before = text.slice(0, idx);
    const mid = text.slice(idx, idx + needle.length);
    const after = text.slice(idx + needle.length);
    return (
      <span>
        {before}
        <span className="text-[#7b0f2b] font-semibold">{mid}</span>
        {after}
      </span>
    );
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
              {FILTERS.find((f) => f.id === filter)?.icon}
              <span className="font-medium text-slate-800">{filterLabel}</span>
              <svg className="w-4 h-4 text-slate-400" viewBox="0 0 20 20" fill="none"><path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </Capsule>
          {filterOpen && (
            <div className="absolute z-50 mt-2 w-48 bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden" onMouseDown={(e)=>e.stopPropagation()}>
              {FILTERS.map((opt) => {
                const active = opt.id === filter;
                return (
                  <button
                    key={opt.id}
                    onClick={() => {
                      setFilter(opt.id);
                      localStorage.setItem("ui_filter", opt.id);
                      setFilterOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 flex items-center gap-2 text-sm hover:bg-slate-50 ${active ? "bg-slate-50" : ""}`}
                  >
                    {opt.icon}
                    <span className="flex-1">{t(`header.filters.${opt.id}`)}</span>
                    {active ? (
                      <svg className="w-4 h-4 text-emerald-600" viewBox="0 0 20 20" fill="none" aria-hidden>
                        <path d="M16 6l-7 7-3-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div ref={searchRef} className="flex-1 relative">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              if (queryTrimmed.length >= 2 && suggestItems.length) setSuggestOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setSuggestOpen(false);
                setActiveIdx(-1);
                return;
              }
              if (e.key === "ArrowDown") {
                e.preventDefault();
                if (!suggestOpen) setSuggestOpen(true);
                setActiveIdx((i) => Math.min((suggestItems?.length || 0) - 1, i + 1));
                return;
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIdx((i) => Math.max(-1, i - 1));
                return;
              }
              if (e.key === "Enter") {
                if (suggestOpen && activeIdx >= 0 && suggestItems[activeIdx]) {
                  e.preventDefault();
                  goToBook(suggestItems[activeIdx].id);
                  return;
                }
                doSearch();
              }
            }}
            placeholder={searchPlaceholder}
            className="w-full border rounded-full py-2 px-4 text-sm pr-10"
            aria-label={searchAriaLabel}
          />
          <button
            onClick={doSearch}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[#7b0f2b] flex items-center justify-center w-8 h-8 rounded-full hover:bg-[#fff1f2]"
            aria-label={searchAriaLabel}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none"><path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.5" /></svg>
          </button>

          {suggestOpen && queryTrimmed.length >= 2 && (
            <div
              className="absolute z-50 mt-2 w-full bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden"
              onMouseDown={(e) => e.preventDefault()}
              role="listbox"
              aria-label={suggestionsLabel}
            >
              <div className="px-4 py-2 text-xs text-slate-500 flex items-center justify-between">
                <span>{suggestionsLabel}</span>
                {suggestLoading ? <span className="animate-pulse">{searchingLabel}</span> : null}
              </div>
              <div className="max-h-80 overflow-auto">
                <button
                  type="button"
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3"
                  onClick={doSearch}
                >
                  <span className="w-8 h-8 rounded-full bg-[#fff1f2] text-[#7b0f2b] flex items-center justify-center">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M21 21l-4.35-4.35" />
                      <circle cx="10" cy="10" r="6" />
                    </svg>
                  </span>
                  <span className="flex-1">
                    <div className="text-sm text-slate-900">{searchForLabel}</div>
                    <div className="text-xs text-slate-500">{openFullResultsLabel}</div>
                  </span>
                </button>

                {suggestItems.map((it, idx) => {
                  const active = idx === activeIdx;
                  return (
                    <button
                      key={it.id}
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={`w-full text-left px-4 py-3 flex items-start gap-3 ${active ? "bg-slate-100" : "hover:bg-slate-50"}`}
                      onMouseEnter={() => setActiveIdx(idx)}
                      onClick={() => goToBook(it.id)}
                    >
                      <span className="mt-0.5 w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                          <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20" />
                          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
                        </svg>
                      </span>
                      <span className="flex-1 min-w-0">
                        <div className="text-sm text-slate-900 truncate">{highlight(it.title, queryTrimmed)}</div>
                        {Array.isArray(it.authors) && it.authors.length ? (
                          <div className="text-xs text-slate-500 truncate">{it.authors.join(", ")}</div>
                        ) : (
                          <div className="text-xs text-slate-500 truncate">{bookLabel}</div>
                        )}
                      </span>
                      <span className="text-xs text-slate-400 mt-1">{openLabel}</span>
                    </button>
                  );
                })}

                {!suggestLoading && suggestItems.length === 0 ? (
                  <div className="px-4 py-4 text-sm text-slate-500">{noSuggestionsLabel}</div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* right: time, date, user */}
      <div className="flex items-center gap-3">
        <LanguageSwitcher />
        <div ref={notifRef} className="relative">
          <Capsule>
            {/* Notifications bell */}
            <button type="button" aria-label={notifLabel} onClick={()=>setNotifOpen(v=>!v)} className="flex items-center gap-2">
              <span className="relative">
                {/* Notification (bell) icon */}
                <svg className="w-5 h-5 text-[#7b0f2b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                  <path d="M18 8a6 6 0 10-12 0v3c0 .7-.3 1.3-1 2l-1 1h16l-1-1c-.7-.7-1-1.3-1-2V8" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M10 21h4" strokeLinecap="round" />
                </svg>
                {notifs.some(n=>!n.read) && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500" />}
              </span>
              <span className="hidden md:inline text-xs text-slate-600">{notifLabel}</span>
            </button>
          </Capsule>
          {notifOpen && (
            <div className="absolute z-50 right-0 mt-2 w-80 bg-white border rounded-md shadow max-h-96 overflow-auto" onMouseDown={(e)=>e.stopPropagation()}>
              <div className="flex items-center justify-between px-3 py-2 border-b">
                <div className="text-sm font-medium">{notifTitle}</div>
                <div className="flex items-center gap-2 text-xs">
                  <button className="px-2 py-1 rounded border" onClick={()=>setNotifs(ns=>ns.map(n=>({...n, read:true })))}>{notifMarkAllRead}</button>
                  <button className="px-2 py-1 rounded border" onClick={()=>setNotifs([])}>{notifClear}</button>
                </div>
              </div>
              {notifs.length === 0 ? (
                <div className="p-4 text-sm text-slate-500">{notifEmpty}</div>
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
export function MobileDashboardHeader() {
  return (
    <div className="sm:hidden px-4 pt-3 pb-2 border-b">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-slate-800">TAU</div>
        <LanguageSwitcher className="ml-auto" />
      </div>
    </div>
  );
}

