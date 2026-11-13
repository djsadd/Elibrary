import type React from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import DashboardHeader from "../../components/layout/DashboardHeader";
import { api } from "@/shared/api/client";
import { getLang } from "@/shared/i18n";
import { displayNamesFrom } from "@/shared/ui/text";
import bookPdf from "../../assets/books/book.pdf";

// Using pdfjs-dist to render pages into canvases
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";

// Configure worker for Vite
// @ts-ignore
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.js", import.meta.url).toString();

type Theme = "light" | "sepia" | "dark";
type FitMode = "page" | "width";
type Prefs = { theme?: Theme; twoPage?: boolean; fitMode?: FitMode; notesOpen?: boolean };

const PREFS_KEY = "reader:prefs";
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
const PAGE_GAP = 16;
const clampZoom = (v: number) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, v));

function readPrefs(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}");
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

const matches = (query: string) => {
  try { return window.matchMedia(query).matches; } catch { return false; }
};

const COPY = {
  ru: {
    back: "К книге", book: "Книга", loading: "Открываем книгу…", failed: "Не удалось открыть книгу",
    failedHint: "Проверьте соединение и попробуйте ещё раз.", retry: "Повторить",
    prev: "Предыдущая страница", next: "Следующая страница", page: "Страница", of: "из",
    zoomIn: "Увеличить", zoomOut: "Уменьшить", resetZoom: "Сбросить масштаб",
    settings: "Вид", theme: "Тема", light: "Светлая", sepia: "Сепия", dark: "Тёмная",
    layout: "Разворот", single: "Одна страница", double: "Две страницы",
    fit: "Подгонка", fitPage: "Страница целиком", fitWidth: "По ширине", zoom: "Масштаб",
    fullscreen: "Полный экран", exitFullscreen: "Выйти из полного экрана",
    notes: "Заметки", closeNotes: "Закрыть заметки", notesFor: "Заметка к странице {page}",
    notesPlaceholder: "Мысли, цитаты, вопросы к этой странице…", allNotes: "Все заметки",
    saving: "Сохранение…", saved: "Сохранено", error: "Ошибка сохранения", autosave: "Автосохранение",
    shortcuts: "← → листать · + − масштаб · F полный экран",
  },
  kk: {
    back: "Кітапқа", book: "Кітап", loading: "Кітап ашылуда…", failed: "Кітапты ашу мүмкін болмады",
    failedHint: "Байланысты тексеріп, қайталап көріңіз.", retry: "Қайталау",
    prev: "Алдыңғы бет", next: "Келесі бет", page: "Бет", of: "/",
    zoomIn: "Үлкейту", zoomOut: "Кішірейту", resetZoom: "Масштабты қалпына келтіру",
    settings: "Көрініс", theme: "Тақырып", light: "Ашық", sepia: "Сепия", dark: "Қараңғы",
    layout: "Бет орналасуы", single: "Бір бет", double: "Екі бет",
    fit: "Сыйдыру", fitPage: "Бетті толық", fitWidth: "Ені бойынша", zoom: "Масштаб",
    fullscreen: "Толық экран", exitFullscreen: "Толық экраннан шығу",
    notes: "Жазбалар", closeNotes: "Жазбаларды жабу", notesFor: "{page}-бетке жазба",
    notesPlaceholder: "Осы бетке ойлар, дәйексөздер, сұрақтар…", allNotes: "Барлық жазбалар",
    saving: "Сақталуда…", saved: "Сақталды", error: "Сақтау қатесі", autosave: "Автосақтау",
    shortcuts: "← → парақтау · + − масштаб · F толық экран",
  },
  en: {
    back: "Back to book", book: "Book", loading: "Opening the book…", failed: "Could not open the book",
    failedHint: "Check your connection and try again.", retry: "Retry",
    prev: "Previous page", next: "Next page", page: "Page", of: "of",
    zoomIn: "Zoom in", zoomOut: "Zoom out", resetZoom: "Reset zoom",
    settings: "View", theme: "Theme", light: "Light", sepia: "Sepia", dark: "Dark",
    layout: "Layout", single: "Single page", double: "Two pages",
    fit: "Fit", fitPage: "Whole page", fitWidth: "Page width", zoom: "Zoom",
    fullscreen: "Fullscreen", exitFullscreen: "Exit fullscreen",
    notes: "Notes", closeNotes: "Close notes", notesFor: "Note for page {page}",
    notesPlaceholder: "Thoughts, quotes, questions about this page…", allNotes: "All notes",
    saving: "Saving…", saved: "Saved", error: "Save failed", autosave: "Autosave",
    shortcuts: "← → turn pages · + − zoom · F fullscreen",
  },
} as const;

const ICONS = {
  back: "M15 18l-6-6 6-6",
  prev: "M15 6l-6 6 6 6",
  next: "M9 6l6 6-6 6",
  minus: "M5 12h14",
  plus: "M12 5v14M5 12h14",
  settings: "M4 7h10M18 7h2M4 17h4M12 17h8M14 4v6M8 14v6",
  notes: "M5 4h14v16H5zM9 8h6M9 12h6M9 16h3",
  close: "M6 6l12 12M18 6L6 18",
  expand: "M15 3h6v6M21 3l-7 7M9 21H3v-6M3 21l7-7",
  shrink: "M4 14h6v6M10 14l-7 7M20 10h-6V4M14 10l7-7",
  alert: "M12 8v5M12 16.5v.5M10.3 3.9L2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
} as const;

function Icon({ name, size = 18 }: { name: keyof typeof ICONS; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

export default function ReaderPage() {
  const [searchParams] = useSearchParams();
  const pdfUrlParam = searchParams.get("url");
  const bookIdParam = searchParams.get("book");
  const pageParam = searchParams.get("page") || searchParams.get("p");
  // Prefer configured API base; fall back to current origin for same-origin deployments.
  const BASE = (import.meta.env.VITE_API_URL as string | undefined) || window.location.origin;
  const initialPrefs = useRef<Prefs>(readPrefs()).current;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const pagesRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const leftCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rightCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pdf, setPdf] = useState<any>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [page, setPage] = useState(1);
  // Zoom relative to the fitted size: 1 = the page fits the stage.
  const [scale, setScale] = useState(1);
  const [twoPage, setTwoPage] = useState(Boolean(initialPrefs.twoPage));
  const [fitMode, setFitMode] = useState<FitMode>(initialPrefs.fitMode || (matches("(max-width: 767px)") ? "width" : "page"));
  const [theme, setTheme] = useState<Theme>(initialPrefs.theme || "light");
  const [isNarrow, setIsNarrow] = useState(() => matches("(max-width: 899px)"));
  const [isWide, setIsWide] = useState(() => matches("(min-width: 1024px)"));
  const [notesOpen, setNotesOpen] = useState(() => matches("(min-width: 1024px)") && initialPrefs.notesOpen !== false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
  const [topOffset, setTopOffset] = useState(0);
  const [rendering, setRendering] = useState(false);
  const [pageDraft, setPageDraft] = useState<string | null>(null);
  const [scrub, setScrub] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const notesMapRef = useRef<Map<number, string>>(new Map());
  const notesIdMapRef = useRef<Map<number, string | number>>(new Map());
  const prefetchedRef = useRef<Set<number>>(new Set());
  const inflightRef = useRef<Set<number>>(new Set());
  const lastSentRef = useRef<string>("");
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const [overlayFullscreen, setOverlayFullscreen] = useState(false);

  const [userbookId, setUserbookId] = useState<string | null>(null);
  const [bookMeta, setBookMeta] = useState<any | null>(null);
  const PREFETCH_RADIUS = 10;
  const [, setLangTick] = useState(0);
  const L = COPY[getLang()] || COPY.ru;
  // Two-page spreads are unreadable on narrow screens, so they apply only from 900px up.
  const twoUp = twoPage && !isNarrow;

  useEffect(() => {
    const handler = () => setLangTick((v) => v + 1);
    window.addEventListener("lang:changed", handler);
    return () => window.removeEventListener("lang:changed", handler);
  }, []);

  useEffect(() => {
    const narrow = window.matchMedia("(max-width: 899px)");
    const wide = window.matchMedia("(min-width: 1024px)");
    const handler = () => {
      setIsNarrow(narrow.matches);
      setIsWide(wide.matches);
    };
    handler();
    narrow.addEventListener?.("change", handler);
    wide.addEventListener?.("change", handler);
    return () => {
      narrow.removeEventListener?.("change", handler);
      wide.removeEventListener?.("change", handler);
    };
  }, []);

  // Persist view preferences (the notes panel state only on wide screens, where it is a sidebar).
  useEffect(() => {
    try {
      const next: Prefs = { ...readPrefs(), theme, twoPage, fitMode };
      if (isWide) next.notesOpen = notesOpen;
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {}
  }, [theme, twoPage, fitMode, notesOpen, isWide]);

  // The reader fills the viewport below the app header.
  useLayoutEffect(() => {
    const measure = () => {
      const el = containerRef.current;
      if (!el) return;
      setTopOffset(Math.max(0, Math.round(el.getBoundingClientRect().top + window.scrollY)));
    };
    measure();
    const late = window.setTimeout(measure, 400);
    window.addEventListener("resize", measure);
    return () => {
      window.clearTimeout(late);
      window.removeEventListener("resize", measure);
    };
  }, []);

  // Track the stage size so pages are fitted to the space available.
  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.floor(entry.contentRect.width);
      const h = Math.floor(entry.contentRect.height);
      setStageSize((prev) => (Math.abs(prev.w - w) < 2 && Math.abs(prev.h - h) < 2 ? prev : { w, h }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Listen to fullscreenchange to keep UI state in sync
  useEffect(() => {
    const onFsChange = () => {
      const isFs = !!(document as any).fullscreenElement || !!(document as any).webkitFullscreenElement || !!(document as any).mozFullScreenElement || !!(document as any).msFullscreenElement;
      setNativeFullscreen(isFs);
      if (!isFs) {
        // when native FS exits, ensure body scroll restored if overlay wasn't used
        if (!overlayFullscreen) {
          try { document.documentElement.style.overflow = ""; } catch {}
        }
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    // Safari/WebKit
    document.addEventListener('webkitfullscreenchange' as any, onFsChange as any);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange' as any, onFsChange as any);
    };
  }, [overlayFullscreen]);

  // Fetch book metadata for header
  useEffect(() => {
    if (!bookIdParam) { setBookMeta(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const data = await api<any>(`/api/catalog/books/${encodeURIComponent(String(bookIdParam))}`);
        if (!cancelled) setBookMeta(data);
      } catch (e: any) {
        if (!cancelled) {
          try { console.warn("[ReaderPage] GET book meta failed:", e?.message || String(e)); } catch {}
          setBookMeta(null);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [bookIdParam]);

  // Fetch existing notes for this book and populate per-page drafts
  useEffect(() => {
    if (!bookIdParam) return;
    let cancelled = false;
    (async () => {
      try {
        const qs = new URLSearchParams();
        qs.set("book_id", String(bookIdParam));
        const data = await api<any[]>(`/api/catalog/notes?${qs.toString()}`);
        if (cancelled) return;
        const map = new Map<number, string>();
        const idMap = new Map<number, string | number>();
        (Array.isArray(data) ? data : []).forEach((n: any) => {
          const p = Number(n?.page ?? 0);
          const t = String(n?.note ?? "").trim();
          const id = n?.id ?? n?.note_id ?? n?.uuid;
          if (p > 0 && t) {
            // last one wins if multiple
            map.set(p, t);
            if (id != null) idMap.set(p, id);
          }
        });
        notesMapRef.current = map;
        notesIdMapRef.current = idMap;
        // hydrate current page textarea if present
        setNotes(notesMapRef.current.get(page) ?? "");
        try { console.info("[ReaderPage] GET /api/catalog/notes ->", data); } catch {}
      } catch (e: any) {
        try { console.warn("[ReaderPage] GET /api/catalog/notes failed:", e?.message || String(e)); } catch {}
      }
    })();
    return () => { cancelled = true; };
  }, [bookIdParam, page]);

  // sync note text with current page (keep per-page draft)
  useEffect(() => {
    const existing = notesMapRef.current.get(page) ?? "";
    setNotes(existing);
  }, [page]);

  // Load existing userbook id (created from detail page)
  useEffect(() => {
    if (!bookIdParam) return;
    try {
      const raw = localStorage.getItem(`userbook:${bookIdParam}`);
      if (raw) {
        const obj = JSON.parse(raw);
        if (obj && obj.id != null) setUserbookId(String(obj.id));
        if (obj && obj.current_page) setPage(Number(obj.current_page) || 1);
      }
    } catch {}
  }, [bookIdParam]);

  // If page is provided in querystring, respect it initially
  useEffect(() => {
    if (!pageParam) return;
    const n = Number(pageParam);
    if (!Number.isNaN(n) && n > 0) setPage(n);
  }, [pageParam]);

  // Temporary: ensure userbook by book_id using shared API client.
  useEffect(() => {
    if (!bookIdParam) return;
    let cancelled = false;
    (async () => {
      try {
        // 1) Try to get existing userbook by book id
        const existing: any = await api<any>(`/api/catalog/userbook/by-book/${encodeURIComponent(String(bookIdParam))}`);
        if (cancelled) return;
        if (existing?.id != null) {
          setUserbookId(String(existing.id));
          const cp = Number(existing.current_page);
          if (!Number.isNaN(cp) && cp > 0) setPage(cp);
          try { localStorage.setItem(`userbook:${bookIdParam}`, JSON.stringify(existing)); } catch {}
        }
        return; // do not create new
      } catch (err: any) {
        if (cancelled) return;
        const msg = err?.message ? String(err.message) : "";
        const notFound = /404|not\s*found/i.test(msg);
        if (!notFound) {
          console.warn("[ReaderPage] userbook GET via api failed:", msg);
          return; // do not attempt create on other errors
        }
        // 2) If not found, create a new one
        const payload = {
          book_id: Number(bookIdParam),
          current_page: 0,
          total_pages: null as any,
          progress_percent: 0.0,
          status: "reading",
          reading_time: 0.0,
        };
        try {
          const created = await api<any>("/api/catalog/userbook", {
            method: "POST",
            body: JSON.stringify(payload),
          });
          if (cancelled) return;
          if (created?.id != null) {
            setUserbookId(String(created.id));
            const cp = Number(created.current_page);
            if (!Number.isNaN(cp) && cp > 0) setPage(cp);
            try { localStorage.setItem(`userbook:${bookIdParam}`, JSON.stringify(created)); } catch {}
          }
        } catch (e: any) {
          if (cancelled) return;
          console.warn("[ReaderPage] userbook POST via api failed:", e?.message || String(e));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [bookIdParam, BASE]);

  // Reading-time tracking for personal insights: count only time when the tab is visible
  // and the reader was interacted with recently, then flush to the backend once a minute.
  const activityRef = useRef({ seconds: 0, pages: 0, lastInteraction: Date.now(), prevPage: 0 });
  useEffect(() => {
    const a = activityRef.current;
    if (a.prevPage && a.prevPage !== page) a.pages += 1;
    a.prevPage = page;
    a.lastInteraction = Date.now();
  }, [page]);
  useEffect(() => {
    if (!userbookId) return;
    const TICK_MS = 10_000;
    const IDLE_MS = 3 * 60_000;
    const bump = () => { activityRef.current.lastInteraction = Date.now(); };
    const inputEvents = ["mousemove", "keydown", "wheel", "touchstart", "scroll"] as const;
    inputEvents.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const flush = () => {
      const a = activityRef.current;
      const seconds = Math.min(Math.round(a.seconds), 900);
      const pages = Math.min(a.pages, 200);
      if (seconds < 5 && pages === 0) return;
      a.seconds = 0;
      a.pages = 0;
      api(`/api/catalog/userbook/${userbookId}/activity`, {
        method: "POST",
        body: JSON.stringify({ seconds, pages }),
        keepalive: true,
      }).catch(() => {});
    };
    const tick = window.setInterval(() => {
      const a = activityRef.current;
      if (document.visibilityState === "visible" && Date.now() - a.lastInteraction < IDLE_MS) a.seconds += TICK_MS / 1000;
    }, TICK_MS);
    const sender = window.setInterval(flush, 60_000);
    const onVisibility = () => { if (document.visibilityState === "hidden") flush(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(sender);
      document.removeEventListener("visibilitychange", onVisibility);
      inputEvents.forEach((e) => window.removeEventListener(e, bump));
      flush();
    };
  }, [userbookId]);

  // Keep the current page inside the document once its length is known.
  useEffect(() => {
    if (pageCount > 0 && page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  // Send progress update on page change (debounced)
  useEffect(() => {
    if (!userbookId || pageCount <= 0) return;
    const payload = {
      current_page: page,
      total_pages: pageCount,
      progress_percent: Math.max(0, Math.min(100, Math.round((page / pageCount) * 100))),
      // Mark as finished on the last page; otherwise keep the stored status (a finished book stays finished).
      ...(page >= pageCount ? { status: "readed" } : {}),
    } as any;
    const t = setTimeout(async () => {
      try {
        await api(`/api/catalog/userbook/${userbookId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        try {
          if (bookIdParam) {
            const raw = localStorage.getItem(`userbook:${bookIdParam}`);
            const base = raw ? JSON.parse(raw) : {};
            localStorage.setItem(`userbook:${bookIdParam}`, JSON.stringify({ ...base, ...payload, id: userbookId }));
          }
        } catch {}
      } catch (e) {
        // ignore update errors
        console.warn("[ReaderPage] progress PATCH failed:", (e as any)?.message || String(e));
      }
    }, 500);
    return () => clearTimeout(t);
  }, [page, pageCount, userbookId, bookIdParam]);

  // Auto-save notes to backend (debounced)
  useEffect(() => {
    if (!bookIdParam) return;
    // keep local draft per page
    notesMapRef.current.set(page, notes);
    const trimmed = notes.trim();
    const signature = `${bookIdParam}|${page}|${trimmed}`;
    if (!trimmed) { lastSentRef.current = ""; setSaving("idle"); return; }
    let cancelled = false;
    setSaving("saving");
    const t = setTimeout(async () => {
      if (cancelled) return;
      if (lastSentRef.current === signature) { setSaving("saved"); return; }
      try {
        const existingId = notesIdMapRef.current.get(page);
        const body = { book_id: Number(bookIdParam), page, note: trimmed } as any;
        let resp: any;
        if (existingId != null) {
          // update existing note (PATCH)
          resp = await api<any>(`/api/catalog/notes/${encodeURIComponent(String(existingId))}`, {
            method: "PATCH",
            body: JSON.stringify({ page, note: trimmed }),
          });
        } else {
          // create new
          resp = await api<any>(`/api/catalog/notes`, { method: "POST", body: JSON.stringify(body) });
        }
        // remember id after create
        const newId = resp?.id ?? resp?.note_id ?? resp?.uuid ?? existingId;
        if (newId != null) notesIdMapRef.current.set(page, newId);
        lastSentRef.current = signature;
        if (!cancelled) setSaving("saved");
      } catch (e: any) {
        if (!cancelled) setSaving("error");
        try { console.warn("[ReaderPage] save note failed:", e?.message || String(e)); } catch {}
      }
    }, 800);
    return () => { cancelled = true; clearTimeout(t); };
  }, [notes, page, bookIdParam]);

  // Keep the latest metadata in a ref: the PDF loader reads download_url only as a fallback,
  // so metadata arriving later must not restart (and re-download) an already streaming book.
  const bookMetaRef = useRef<any | null>(null);
  bookMetaRef.current = bookMeta;

  useEffect(() => {
    let cancelled = false;
    let activeTask: any = null;
    let openedDoc: any = null;
    setStatus("loading");

    // Read just the first bytes of a candidate and abort, so a server that ignores Range
    // never makes us download the whole book only to check its signature.
    const probePdf = async (url: string, headers?: Record<string, string>): Promise<boolean> => {
      const ctrl = new AbortController();
      try {
        const resp = await fetch(url, { method: 'GET', headers: { ...(headers || {}), Range: 'bytes=0-1023' }, signal: ctrl.signal });
        if (!resp.ok || !resp.body) {
          console.warn('[ReaderPage] Probe non-OK', resp.status, 'for', url);
          return false;
        }
        const reader = resp.body.getReader();
        const head: number[] = [];
        while (head.length < 5) {
          const { value, done } = await reader.read();
          if (done || !value) break;
          head.push(...value.slice(0, 5 - head.length));
        }
        ctrl.abort();
        const ok = String.fromCharCode(...head) === '%PDF-';
        if (!ok) console.warn('[ReaderPage] Non-PDF response from', url);
        return ok;
      } catch (e) {
        if (!ctrl.signal.aborted) console.warn('[ReaderPage] Probe failed for', url, e);
        return false;
      } finally {
        ctrl.abort();
      }
    };

    const load = async () => {
      // Build a list of candidate sources and try them in order.
      const isPrivateHost = (h: string) => /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/i.test(h);
      const toAbsolute = (u: string) => (/^https?:\/\//i.test(u) ? u : `${BASE}${u.startsWith('/') ? '' : '/'}${u}`);

      const candidates: { url: string; reason: string }[] = [];
      if (pdfUrlParam) {
        candidates.push({ url: toAbsolute(pdfUrlParam), reason: 'query-param' });
      }
      if (bookIdParam) {
        // Range-aware endpoint: only the bytes of the pages around the current one are fetched.
        candidates.push({ url: `${BASE}/api/catalog/books/${bookIdParam}/stream`, reason: 'api-stream' });
      }
      const du = (bookMetaRef.current as any)?.download_url as string | undefined;
      if (du) {
        try {
          const abs = toAbsolute(du);
          const host = new URL(abs, window.location.href).hostname;
          if (!isPrivateHost(host)) {
            candidates.push({ url: abs, reason: 'bookMeta.download_url' });
          }
        } catch {}
      }
      if (bookIdParam) {
        // Fallback to download endpoint
        candidates.push({ url: `${BASE}/api/catalog/books/${bookIdParam}/download`, reason: 'api-download' });
      }
      // Always include demo asset last
      candidates.push({ url: bookPdf as any, reason: 'demo-asset' });

      const token = localStorage.getItem("token") || sessionStorage.getItem("token");

      for (const cand of candidates) {
        if (cancelled) return;
        let headers: Record<string, string> | undefined = undefined;
        try {
          const srcUrl = new URL(cand.url, window.location.href);
          const baseUrl = new URL(BASE, window.location.href);
          const sameOrigin = srcUrl.origin === baseUrl.origin || srcUrl.origin === window.location.origin;
          if (sameOrigin && token) headers = { Authorization: `Bearer ${token}` };
        } catch {
          if (token) headers = { Authorization: `Bearer ${token}` };
        }

        // Probe for PDF signature (reads only the first bytes)
        const okPdf = await probePdf(cand.url, headers);
        if (cancelled) return;
        if (!okPdf) continue;

        try {
          const loadingTask = pdfjsLib.getDocument({
            url: cand.url as any,
            httpHeaders: headers as any,
            // Page-window streaming: no full-file stream and no background auto-fetch.
            // pdf.js reads the xref, then fetches byte ranges only for pages we actually request
            // (the current page and the ±PREFETCH_RADIUS window below).
            disableStream: true,
            disableAutoFetch: true,
            disableRange: false,
            rangeChunkSize: 524288, // 512KB per range request: few requests, still far from the whole file
            withCredentials: false,
          } as any);
          activeTask = loadingTask;
          const doc = await loadingTask.promise;
          if (cancelled) { try { doc.destroy(); } catch {} return; }
          openedDoc = doc;
          setPdf(doc);
          setPageCount(doc.numPages);
          setStatus("ready");
          return; // success
        } catch (e) {
          if (cancelled) return;
          console.warn('[ReaderPage] pdf.js failed to open candidate', cand, e);
          // try next candidate
        } finally {
          activeTask = null;
        }
      }

      console.error('[ReaderPage] No usable PDF source');
      if (!cancelled) setStatus("error");
    };
    load();
    return () => {
      cancelled = true;
      // Abort pending range requests and free the worker-side document.
      try { activeTask?.destroy(); } catch {}
      try { openedDoc?.destroy(); } catch {}
      setPdf(null);
    };
  }, [pdfUrlParam, bookIdParam, BASE, reloadKey]);

  const leftRenderTaskRef = useRef<any>(null);
  const rightRenderTaskRef = useRef<any>(null);

  // Render the visible page(s) fitted to the stage, at device pixel density for crisp text.
  // Each page is drawn off-screen first and copied in one step, so flipping never flashes a blank canvas.
  useEffect(() => {
    if (!pdf || stageSize.w <= 0 || stageSize.h <= 0) return;
    let cancelled = false;
    const cols = twoUp ? 2 : 1;
    const availW = Math.max(120, (stageSize.w - (cols - 1) * PAGE_GAP) / cols);
    const availH = Math.max(160, stageSize.h);
    const dpr = Math.min(window.devicePixelRatio || 1, 3);

    const renderPage = async (pNum: number, canvas: HTMLCanvasElement | null, taskRef: React.MutableRefObject<any>) => {
      if (!canvas) return;
      // A canvas can host only one render at a time: cancel the previous one on fast page flips.
      try { taskRef.current?.cancel(); } catch {}
      try {
        const pageObj = await pdf.getPage(pNum);
        if (cancelled) return;
        const base = pageObj.getViewport({ scale: 1 });
        const fitW = availW / base.width;
        const fit = fitMode === "width" ? fitW : Math.min(fitW, availH / base.height);
        const cssScale = fit * scale;
        // Cap the bitmap size so deep zoom on dense screens stays within canvas limits.
        let ratio = dpr;
        const pixels = base.width * base.height * (cssScale * ratio) ** 2;
        const MAX_PIXELS = 16_000_000;
        if (pixels > MAX_PIXELS) ratio *= Math.sqrt(MAX_PIXELS / pixels);
        const viewport = pageObj.getViewport({ scale: cssScale * ratio });

        const off = document.createElement("canvas");
        off.width = Math.floor(viewport.width);
        off.height = Math.floor(viewport.height);
        const offCtx = off.getContext("2d");
        if (!offCtx) return;
        const task = pageObj.render({ canvasContext: offCtx, viewport } as any);
        taskRef.current = task;
        await task.promise;
        if (cancelled) return;

        canvas.width = off.width;
        canvas.height = off.height;
        canvas.style.width = `${Math.floor(viewport.width / ratio)}px`;
        canvas.style.height = `${Math.floor(viewport.height / ratio)}px`;
        canvas.getContext("2d")?.drawImage(off, 0, 0);
        off.width = 0;
        off.height = 0;
      } catch {
        // ignore (including RenderingCancelledException)
      }
    };

    setRendering(true);
    const jobs = [renderPage(page, leftCanvasRef.current, leftRenderTaskRef)];
    if (twoUp && page + 1 <= pageCount) jobs.push(renderPage(page + 1, rightCanvasRef.current, rightRenderTaskRef));
    Promise.all(jobs).finally(() => { if (!cancelled) setRendering(false); });
    return () => { cancelled = true; };
  }, [pdf, page, scale, twoUp, pageCount, fitMode, stageSize]);

  // A new page starts at its top.
  useEffect(() => {
    stageRef.current?.scrollTo({ top: 0 });
  }, [page]);

  // Pages whose data (content streams, fonts, images) has been streamed in, keyed by page number.
  const loadedPagesRef = useRef<Map<number, any>>(new Map());

  useEffect(() => {
    prefetchedRef.current = new Set();
    inflightRef.current = new Set();
    loadedPagesRef.current = new Map();
  }, [pdf]);

  // Sliding window streaming: load pages [page - R, page + R], release everything outside it.
  useEffect(() => {
    if (!pdf || pageCount <= 0) return;
    let cancelled = false;

    const lo = Math.max(1, page - PREFETCH_RADIUS);
    const hi = Math.min(pageCount, page + (twoUp ? 1 : 0) + PREFETCH_RADIUS);

    // Drop pages that left the window so memory stays bounded while reading long books.
    for (const [pNum, pageObj] of loadedPagesRef.current) {
      if (pNum < lo || pNum > hi) {
        try { pageObj.cleanup(); } catch {}
        loadedPagesRef.current.delete(pNum);
        prefetchedRef.current.delete(pNum);
      }
    }

    const prefetchPage = async (pNum: number) => {
      if (pNum < lo || pNum > hi) return;
      if (prefetchedRef.current.has(pNum) || inflightRef.current.has(pNum)) return;
      inflightRef.current.add(pNum);
      try {
        const pageObj = await pdf.getPage(pNum);
        // getPage() alone only parses the page dictionary; getOperatorList() makes pdf.js
        // request the byte ranges of the page content, fonts and images, so the flip is instant.
        await pageObj.getOperatorList();
        prefetchedRef.current.add(pNum);
        loadedPagesRef.current.set(pNum, pageObj);
      } catch {
        // ignore prefetch errors; render will retry on demand
      } finally {
        inflightRef.current.delete(pNum);
      }
    };

    const buildOrder = (center: number) => {
      const order: number[] = [];
      const seen = new Set<number>();
      const push = (n: number) => {
        if (n < 1 || n > pageCount || seen.has(n)) return;
        seen.add(n);
        order.push(n);
      };
      push(center);
      if (twoUp) push(center + 1);
      for (let i = 1; i <= PREFETCH_RADIUS; i += 1) {
        push(center + i);
        push(center - i);
      }
      return order;
    };

    const run = async () => {
      for (const pNum of buildOrder(page)) {
        if (cancelled) return;
        await prefetchPage(pNum);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [pdf, page, pageCount, twoUp]);

  const step = twoUp ? 2 : 1;
  const prevSpread = () => setPage((p) => Math.max(1, p - step));
  const nextSpread = () => setPage((p) => (pageCount ? Math.min(pageCount, p + step) : p));
  const goTo = (n: number) => {
    if (!Number.isFinite(n) || pageCount <= 0) return;
    setPage(Math.max(1, Math.min(pageCount, Math.round(n))));
  };

  const zoomOut = () => setScale((s) => clampZoom(+(s - 0.1).toFixed(2)));
  const zoomIn = () => setScale((s) => clampZoom(+(s + 0.1).toFixed(2)));

  const enterNativeFullscreen = async (el: HTMLElement): Promise<boolean> => {
    try {
      const anyEl: any = el;
      if (anyEl.requestFullscreen) { await anyEl.requestFullscreen(); return true; }
      if (anyEl.webkitRequestFullscreen) { await anyEl.webkitRequestFullscreen(); return true; }
      if (anyEl.mozRequestFullScreen) { await anyEl.mozRequestFullScreen(); return true; }
      if (anyEl.msRequestFullscreen) { await anyEl.msRequestFullscreen(); return true; }
    } catch (e) {
      try { console.warn('[ReaderPage] enterNativeFullscreen failed:', e); } catch {}
    }
    return false;
  };

  const exitNativeFullscreen = async (): Promise<boolean> => {
    try {
      const anyDoc: any = document as any;
      if (!anyDoc.fullscreenElement && !anyDoc.webkitFullscreenElement) return false;
      if (anyDoc.exitFullscreen) { await anyDoc.exitFullscreen(); return true; }
      if (anyDoc.webkitExitFullscreen) { await anyDoc.webkitExitFullscreen(); return true; }
      if (anyDoc.mozCancelFullScreen) { await anyDoc.mozCancelFullScreen(); return true; }
      if (anyDoc.msExitFullscreen) { await anyDoc.msExitFullscreen(); return true; }
    } catch (e) {
      try { console.warn('[ReaderPage] exitNativeFullscreen failed:', e); } catch {}
    }
    return false;
  };

  const isFullscreen = nativeFullscreen || overlayFullscreen;

  const toggleFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;
    if (isFullscreen) {
      // Try exit native first; then fallback to overlay exit
      const exited = await exitNativeFullscreen();
      if (!exited && overlayFullscreen) {
        setOverlayFullscreen(false);
        try { document.documentElement.style.overflow = ""; } catch {}
      }
      return;
    }
    // Try native fullscreen
    const ok = await enterNativeFullscreen(el);
    if (ok) { setNativeFullscreen(true); return; }
    // Fallback: overlay fullscreen (mobile/iOS Safari)
    setOverlayFullscreen(true);
    try { document.documentElement.style.overflow = "hidden"; } catch {}
  };

  // Latest handlers for the long-lived keyboard and gesture listeners below.
  const live = useRef<any>({});
  live.current = {
    scale, pageCount, menuOpen, notesOpen, isWide, overlayFullscreen,
    prev: prevSpread, next: nextSpread, zoomIn, zoomOut, toggleFullscreen,
  };

  // Keyboard: ← → / PageUp PageDown turn pages, Home/End jump, + − 0 zoom, F fullscreen, Esc closes overlays.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const a = live.current;
      if (e.key === "Escape") {
        if (a.menuOpen) setMenuOpen(false);
        else if (a.notesOpen && !a.isWide) setNotesOpen(false);
        else if (a.overlayFullscreen) a.toggleFullscreen();
        return;
      }
      const target = e.target as HTMLElement | null;
      if (target?.closest?.("input, textarea, select, [contenteditable='true']")) return;
      if (e.altKey || e.metaKey || e.ctrlKey) return;
      switch (e.key) {
        case "ArrowRight": case "PageDown": a.next(); break;
        case "ArrowLeft": case "PageUp": a.prev(); break;
        case "Home": setPage(1); break;
        case "End": if (a.pageCount) setPage(a.pageCount); break;
        case "+": case "=": a.zoomIn(); break;
        case "-": case "_": a.zoomOut(); break;
        case "0": setScale(1); break;
        case "f": case "F": a.toggleFullscreen(); break;
        default: return;
      }
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Close the view menu on an outside click.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [menuOpen]);

  // Gestures on the stage: Ctrl/⌘ + wheel zoom, pinch zoom, horizontal swipe to turn pages.
  // Native listeners are needed because React registers wheel/touch handlers as passive.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let pinchStart = 0;
    let pinchRatio = 1;
    let swipe: { x: number; y: number; t: number } | null = null;
    const distance = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.0025);
      setScale((s) => clampZoom(+(s * factor).toFixed(3)));
    };
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinchStart = distance(e.touches);
        pinchRatio = 1;
        swipe = null;
      } else if (e.touches.length === 1) {
        swipe = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !pinchStart) return;
      e.preventDefault();
      // Preview the pinch with a CSS transform; the page is re-rendered once the fingers lift.
      const current = live.current.scale as number;
      pinchRatio = clampZoom(current * (distance(e.touches) / pinchStart)) / current;
      if (pagesRef.current) pagesRef.current.style.transform = `scale(${pinchRatio})`;
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (pinchStart && e.touches.length < 2) {
        if (pagesRef.current) pagesRef.current.style.transform = "";
        const ratio = pinchRatio;
        pinchStart = 0;
        pinchRatio = 1;
        swipe = null;
        if (Math.abs(ratio - 1) > 0.02) setScale((s) => clampZoom(+(s * ratio).toFixed(3)));
        return;
      }
      if (swipe && e.touches.length === 0 && e.changedTouches.length) {
        const touch = e.changedTouches[0];
        const dx = touch.clientX - swipe.x;
        const dy = touch.clientY - swipe.y;
        const quick = Date.now() - swipe.t < 700;
        const canPan = stage.scrollWidth > stage.clientWidth + 4;
        if (!canPan && quick && Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.6) {
          if (dx < 0) live.current.next(); else live.current.prev();
        }
        swipe = null;
      }
    };

    stage.addEventListener("wheel", onWheel, { passive: false });
    stage.addEventListener("touchstart", onTouchStart, { passive: true });
    stage.addEventListener("touchmove", onTouchMove, { passive: false });
    stage.addEventListener("touchend", onTouchEnd);
    stage.addEventListener("touchcancel", onTouchEnd);
    return () => {
      stage.removeEventListener("wheel", onWheel);
      stage.removeEventListener("touchstart", onTouchStart);
      stage.removeEventListener("touchmove", onTouchMove);
      stage.removeEventListener("touchend", onTouchEnd);
      stage.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);

  const authors = displayNamesFrom((bookMeta as any)?.authors);
  const subtitle = [authors.join(", "), (bookMeta as any)?.year].filter(Boolean).join(" · ");
  const title = bookMeta?.title || L.book;
  const lastVisible = twoUp ? Math.min(page + 1, pageCount) : page;
  const progress = pageCount ? Math.round((lastVisible / pageCount) * 100) : 0;
  const pageLabel = twoUp && page + 1 <= pageCount ? `${page}–${page + 1}` : String(page);
  const backHref = bookIdParam ? `/catalog/${encodeURIComponent(bookIdParam)}` : "/catalog";
  const savingLabel = saving === "saving" ? L.saving : saving === "saved" ? L.saved : saving === "error" ? L.error : L.autosave;
  const ready = status === "ready" && pageCount > 0;

  const commitPageDraft = () => {
    if (pageDraft != null) goTo(Number(pageDraft));
    setPageDraft(null);
  };
  const commitScrub = () => {
    if (scrub != null) goTo(scrub);
    setScrub(null);
  };

  const containerClass = [
    "rd",
    overlayFullscreen ? "rd--overlay" : "",
    isFullscreen ? "is-fullscreen" : "",
    notesOpen ? "has-notes" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className="reader-page">
      <DashboardHeader />

      <div
        ref={containerRef}
        className={containerClass}
        data-theme={theme}
        style={{ "--rd-top": `${topOffset}px` } as React.CSSProperties}
      >
        <header className="rd-bar">
          <Link to={backHref} className="rd-back" title={L.back}>
            <Icon name="back" />
            <span>{L.back}</span>
          </Link>

          <div className="rd-title">
            <strong title={title}>{title}</strong>
            {subtitle ? <span title={subtitle}>{subtitle}</span> : null}
          </div>

          <div className="rd-tools">
            <div className="rd-zoom" role="group" aria-label={L.zoom}>
              <button type="button" className="rd-icon" onClick={zoomOut} disabled={scale <= ZOOM_MIN} aria-label={L.zoomOut} title={L.zoomOut}>
                <Icon name="minus" />
              </button>
              <button type="button" className="rd-zoom__value" onClick={() => setScale(1)} title={L.resetZoom}>
                {Math.round(scale * 100)}%
              </button>
              <button type="button" className="rd-icon" onClick={zoomIn} disabled={scale >= ZOOM_MAX} aria-label={L.zoomIn} title={L.zoomIn}>
                <Icon name="plus" />
              </button>
            </div>

            <div className="rd-menu" ref={menuRef}>
              <button
                type="button"
                className={`rd-icon ${menuOpen ? "is-active" : ""}`}
                onClick={() => setMenuOpen((v) => !v)}
                aria-expanded={menuOpen}
                aria-haspopup="dialog"
                aria-label={L.settings}
                title={L.settings}
              >
                <Icon name="settings" />
              </button>
              {menuOpen ? (
                <div className="rd-popover" role="dialog" aria-label={L.settings}>
                  <div className="rd-popover__group">
                    <span className="rd-popover__label">{L.theme}</span>
                    <div className="rd-themes">
                      {(["light", "sepia", "dark"] as Theme[]).map((key) => (
                        <button
                          key={key}
                          type="button"
                          className={`rd-theme rd-theme--${key} ${theme === key ? "is-active" : ""}`}
                          aria-pressed={theme === key}
                          onClick={() => setTheme(key)}
                        >
                          <i aria-hidden="true">Aa</i>
                          <span>{L[key]}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rd-popover__group">
                    <span className="rd-popover__label">{L.fit}</span>
                    <div className="rd-segment">
                      {(["page", "width"] as FitMode[]).map((key) => (
                        <button key={key} type="button" aria-pressed={fitMode === key} className={fitMode === key ? "is-active" : ""} onClick={() => { setFitMode(key); setScale(1); }}>
                          {key === "page" ? L.fitPage : L.fitWidth}
                        </button>
                      ))}
                    </div>
                  </div>

                  {!isNarrow ? (
                    <div className="rd-popover__group">
                      <span className="rd-popover__label">{L.layout}</span>
                      <div className="rd-segment">
                        <button type="button" aria-pressed={!twoPage} className={!twoPage ? "is-active" : ""} onClick={() => setTwoPage(false)}>{L.single}</button>
                        <button type="button" aria-pressed={twoPage} className={twoPage ? "is-active" : ""} onClick={() => setTwoPage(true)}>{L.double}</button>
                      </div>
                    </div>
                  ) : (
                    <div className="rd-popover__group rd-popover__group--zoom">
                      <span className="rd-popover__label">{L.zoom}</span>
                      <div className="rd-zoom rd-zoom--wide">
                        <button type="button" className="rd-icon" onClick={zoomOut} disabled={scale <= ZOOM_MIN} aria-label={L.zoomOut}><Icon name="minus" /></button>
                        <button type="button" className="rd-zoom__value" onClick={() => setScale(1)} title={L.resetZoom}>{Math.round(scale * 100)}%</button>
                        <button type="button" className="rd-icon" onClick={zoomIn} disabled={scale >= ZOOM_MAX} aria-label={L.zoomIn}><Icon name="plus" /></button>
                      </div>
                    </div>
                  )}

                  <p className="rd-popover__hint">{L.shortcuts}</p>
                </div>
              ) : null}
            </div>

            {bookIdParam ? (
              <button
                type="button"
                className={`rd-icon ${notesOpen ? "is-active" : ""}`}
                onClick={() => setNotesOpen((v) => !v)}
                aria-pressed={notesOpen}
                aria-label={L.notes}
                title={L.notes}
              >
                <Icon name="notes" />
              </button>
            ) : null}

            <button
              type="button"
              className="rd-icon"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? L.exitFullscreen : L.fullscreen}
              title={isFullscreen ? L.exitFullscreen : L.fullscreen}
            >
              <Icon name={isFullscreen ? "shrink" : "expand"} />
            </button>
          </div>
        </header>

        <div className="rd-progress" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>

        <div className="rd-body">
          <div className="rd-viewport">
            <div ref={stageRef} className="rd-stage">
              <div ref={pagesRef} className={`rd-pages ${ready ? "" : "is-hidden"}`}>
                <canvas ref={leftCanvasRef} className="rd-page" />
                {twoUp && page + 1 <= pageCount ? <canvas ref={rightCanvasRef} className="rd-page" /> : null}
              </div>
            </div>

            {status === "loading" ? (
              <div className="rd-state" role="status">
                <span className="rd-spinner" aria-hidden="true" />
                <span>{L.loading}</span>
              </div>
            ) : status === "error" ? (
              <div className="rd-state rd-state--error" role="alert">
                <Icon name="alert" size={28} />
                <strong>{L.failed}</strong>
                <span>{L.failedHint}</span>
                <button type="button" className="rd-btn" onClick={() => setReloadKey((k) => k + 1)}>{L.retry}</button>
              </div>
            ) : null}

            {ready ? (
              <>
                <button type="button" className="rd-nav rd-nav--prev" onClick={prevSpread} disabled={page <= 1} aria-label={L.prev}>
                  <Icon name="prev" size={22} />
                </button>
                <button type="button" className="rd-nav rd-nav--next" onClick={nextSpread} disabled={lastVisible >= pageCount} aria-label={L.next}>
                  <Icon name="next" size={22} />
                </button>
                {rendering ? <span className="rd-busy" aria-hidden="true" /> : null}
              </>
            ) : null}
          </div>

          {bookIdParam && notesOpen ? (
            <>
              <div className="rd-scrim" onClick={() => setNotesOpen(false)} aria-hidden="true" />
              <aside className="rd-notes" aria-label={L.notes}>
                <div className="rd-notes__head">
                  <div>
                    <strong>{L.notesFor.replace("{page}", String(page))}</strong>
                    <span className={`rd-save rd-save--${saving}`}>{savingLabel}</span>
                  </div>
                  <button type="button" className="rd-icon" onClick={() => setNotesOpen(false)} aria-label={L.closeNotes} title={L.closeNotes}>
                    <Icon name="close" />
                  </button>
                </div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={L.notesPlaceholder}
                  aria-label={L.notesFor.replace("{page}", String(page))}
                />
                <Link to={`/catalog/${encodeURIComponent(bookIdParam)}/notes`} className="rd-notes__all">
                  {L.allNotes}
                  <Icon name="next" size={16} />
                </Link>
              </aside>
            </>
          ) : null}
        </div>

        <footer className="rd-foot">
          <button type="button" className="rd-icon rd-icon--lg" onClick={prevSpread} disabled={!ready || page <= 1} aria-label={L.prev} title={L.prev}>
            <Icon name="prev" size={20} />
          </button>

          <label className="rd-pageno">
            <span className="sr-only">{L.page}</span>
            <input
              type="text"
              inputMode="numeric"
              value={pageDraft ?? (scrub != null ? String(scrub) : pageLabel)}
              onFocus={(e) => { setPageDraft(String(page)); requestAnimationFrame(() => e.target.select()); }}
              onChange={(e) => setPageDraft(e.target.value.replace(/[^\d]/g, ""))}
              onBlur={commitPageDraft}
              onKeyDown={(e) => {
                if (e.key === "Enter") { commitPageDraft(); (e.target as HTMLInputElement).blur(); }
                if (e.key === "Escape") { setPageDraft(null); (e.target as HTMLInputElement).blur(); }
              }}
              disabled={!ready}
              aria-label={L.page}
              style={{ width: `${Math.max(2, String(pageCount || 0).length, pageLabel.length) + 1.5}ch` }}
            />
            <span>{L.of} {pageCount || "—"}</span>
          </label>

          <input
            type="range"
            className="rd-scrub"
            min={1}
            max={Math.max(1, pageCount)}
            step={1}
            value={scrub ?? page}
            disabled={!ready}
            onChange={(e) => setScrub(Number(e.target.value))}
            onPointerUp={commitScrub}
            onTouchEnd={commitScrub}
            onKeyUp={commitScrub}
            onBlur={commitScrub}
            aria-label={L.page}
            style={{ "--rd-fill": `${pageCount > 1 ? (((scrub ?? page) - 1) / (pageCount - 1)) * 100 : 0}%` } as React.CSSProperties}
          />

          <span className="rd-percent">{progress}%</span>

          <button type="button" className="rd-icon rd-icon--lg" onClick={nextSpread} disabled={!ready || lastVisible >= pageCount} aria-label={L.next} title={L.next}>
            <Icon name="next" size={20} />
          </button>
        </footer>
      </div>
    </div>
  );
}
