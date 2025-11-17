import type React from "react";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import DashboardHeader from "../../components/layout/DashboardHeader";
import { api } from "@/shared/api/client";
import { namesFrom } from "@/shared/ui/text";
import bookPdf from "../../assets/books/book.pdf";

// Using pdfjs-dist to render pages into canvases
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";

// Configure worker for Vite
// @ts-ignore
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.js", import.meta.url).toString();

export default function ReaderPage() {
  const [searchParams] = useSearchParams();
  const pdfUrlParam = searchParams.get("url");
  const bookIdParam = searchParams.get("book");
  const pageParam = searchParams.get("page") || searchParams.get("p");
  // Prefer configured API base; fall back to current origin for same-origin deployments.
  const BASE = (import.meta.env.VITE_API_URL as string | undefined) || window.location.origin;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const leftCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rightCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pdf, setPdf] = useState<any>(null);
  const [pageCount, setPageCount] = useState(0);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [twoPage, setTwoPage] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [fav, setFav] = useState(false);
  const [notes, setNotes] = useState("");
  const notesMapRef = useRef<Map<number, string>>(new Map());
  const notesIdMapRef = useRef<Map<number, string | number>>(new Map());
  const lastSentRef = useRef<string>("");
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const dragStartX = useRef<number | null>(null);
  const dragging = useRef(false);
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartScaleRef = useRef<number>(1);
  const lastTouchXRef = useRef<number | null>(null);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const [overlayFullscreen, setOverlayFullscreen] = useState(false);

  const [userbookId, setUserbookId] = useState<string | null>(null);
  const [bookMeta, setBookMeta] = useState<any | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    console.info("[ReaderPage] Bearer token:", token);
  }, []);

  // detect mobile viewport and adapt layout (iPhone 13 target ~390px width)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const handler = () => setIsMobile(mq.matches);
    handler();
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  // force single page layout on mobile
  useEffect(() => {
    if (isMobile) setTwoPage(false);
  }, [isMobile]);

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
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      console.info("[ReaderPage] Ensuring userbook via api(); token:", token);

      try {
        // 1) Try to get existing userbook by book id
        const existing: any = await api<any>(`/api/catalog/userbook/by-book/${encodeURIComponent(String(bookIdParam))}`);
        if (cancelled) return;
        console.info("[ReaderPage] userbook exists (GET via api):", existing);
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
          console.info("[ReaderPage] userbook created (POST via api):", created);
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

  // Send progress update on page change (debounced)
  useEffect(() => {
    if (!userbookId || pageCount <= 0) return;
    const payload = {
      current_page: page,
      total_pages: pageCount,
      progress_percent: Math.max(0, Math.min(100, Math.round((page / pageCount) * 100))),
      status: "reading",
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
        try { console.info("[ReaderPage] notes saved:", resp); } catch {}
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

  // Temporarily disabled: do not persist or update userbook from ReaderPage

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      // Build a list of candidate sources and try them in order.
      const isPrivateHost = (h: string) => /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/i.test(h);
      const toAbsolute = (u: string) => (/^https?:\/\//i.test(u) ? u : `${BASE}${u.startsWith('/') ? '' : '/'}${u}`);

      const candidates: { url: string; reason: string }[] = [];
      if (pdfUrlParam) {
        candidates.push({ url: toAbsolute(pdfUrlParam), reason: 'query-param' });
      }
      const du = (bookMeta as any)?.download_url as string | undefined;
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
        // Prefer streaming endpoint for faster first paint
        candidates.push({ url: `${BASE}/api/catalog/books/${bookIdParam}/stream`, reason: 'api-stream' });
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

        // Probe for PDF signature
        let okPdf = false;
        try {
          const probe = await fetch(cand.url, {
            method: 'GET',
            headers: { ...(headers || {}), Range: 'bytes=0-1023' } as any,
          });
          if (probe.ok) {
            const buf = await probe.arrayBuffer();
            const sig = new TextDecoder('ascii').decode(new Uint8Array(buf).slice(0, 5));
            okPdf = sig === '%PDF-';
            if (!okPdf) {
              const text = new TextDecoder('utf-8').decode(new Uint8Array(buf));
              console.warn('[ReaderPage] Non-PDF response sample:', text.slice(0, 256), 'from', cand);
            }
          } else {
            console.warn('[ReaderPage] Probe non-OK', probe.status, 'for', cand);
          }
        } catch (e) {
          console.warn('[ReaderPage] Probe failed for', cand, e);
        }

        if (!okPdf) continue;

        try {
          const loadingTask = pdfjsLib.getDocument({
            url: cand.url as any,
            httpHeaders: headers as any,
            // Enable streaming and range-based incremental loading
            disableStream: false,
            disableAutoFetch: true, // fetch only needed ranges/pages
            rangeChunkSize: 65536,  // 64KB chunks
            withCredentials: false,
          } as any);
          try {
            loadingTask.onProgress = (p: any) => {
              try { console.info('[ReaderPage] PDF loading progress', p?.loaded, '/', p?.total); } catch {}
            };
          } catch {}
          const doc = await loadingTask.promise;
          if (cancelled) return;
          setPdf(doc);
          setPageCount(doc.numPages);
          return; // success
        } catch (e) {
          console.warn('[ReaderPage] pdf.js failed to open candidate', cand, e);
          // try next candidate
        }
      }

      console.error('[ReaderPage] No usable PDF source');
    };
    load();
    return () => { cancelled = true; };
  }, [pdfUrlParam, bookIdParam, BASE, bookMeta]);

  useEffect(() => {
    if (!pdf) return;

    const renderPage = async (pNum: number, canvas: HTMLCanvasElement | null) => {
      if (!canvas) return;
      try {
        const pageObj = await pdf.getPage(pNum);
        const viewport = pageObj.getViewport({ scale });
        const context = canvas.getContext("2d");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        if (!context) return;
        const renderContext = {
          canvasContext: context,
          viewport,
        } as any;
        await pageObj.render(renderContext).promise;
      } catch (e) {
        // ignore
      }
    };

    // render left page (current)
    renderPage(page, leftCanvasRef.current);
    // render right page (current+1) if twoPage and exists
    if (twoPage && page + 1 <= pageCount) {
      renderPage(page + 1, rightCanvasRef.current);
    } else if (rightCanvasRef.current) {
      // clear right canvas
      const c = rightCanvasRef.current.getContext("2d");
      if (c && rightCanvasRef.current) {
        c.clearRect(0, 0, rightCanvasRef.current.width, rightCanvasRef.current.height);
      }
    }
  }, [pdf, page, scale, twoPage, pageCount]);

  const prev = () => setPage((p) => Math.max(1, p - 1));
  const next = () => setPage((p) => Math.min(pageCount, p + 1));

  const prevSpread = () => setPage((p) => Math.max(1, p - (twoPage ? 2 : 1)));
  const nextSpread = () => setPage((p) => Math.min(pageCount, p + (twoPage ? 2 : 1)));

  const zoomOut = () => setScale((s) => Math.max(0.5, +(s - 0.1).toFixed(2)));
  const zoomIn = () => setScale((s) => Math.min(2.5, +(s + 0.1).toFixed(2)));

  const onWheel = (e: React.WheelEvent) => {
    // Only handle Ctrl+wheel for zoom. Do not flip pages on scroll.
    if (!e.ctrlKey) return;
    e.preventDefault();
    if (e.deltaY < 0) zoomIn(); else zoomOut();
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture?.(e.pointerId);
    dragStartX.current = e.clientX;
    dragging.current = true;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragging.current || dragStartX.current == null) return;
    const dx = e.clientX - dragStartX.current;
    dragging.current = false;
    dragStartX.current = null;
    const threshold = 50;
    if (dx > threshold) prevSpread();
    else if (dx < -threshold) nextSpread();
  };
  const onPointerMove = (_e: React.PointerEvent) => {
    // no-op; placeholder for future panning
  };

  const enterNativeFullscreen = async (el: HTMLElement): Promise<boolean> => {
    try {
      const anyEl: any = el;
      if (anyEl.requestFullscreen) { await anyEl.requestFullscreen(); return true; }
      if (anyEl.webkitRequestFullscreen) { await anyEl.webkitRequestFullscreen(); return true; }
      if (anyEl.mozRequestFullScreen) { await anyEl.mozRequestFullScreen(); return true; }
      if (anyEl.msRequestFullscreen) { await anyEl.msRequestFullscreen(); return true; }
      const root: any = document.documentElement as any;
      if (root && root.requestFullscreen) { await root.requestFullscreen(); return true; }
      if (root && root.webkitRequestFullscreen) { await root.webkitRequestFullscreen(); return true; }
    } catch (e) {
      try { console.warn('[ReaderPage] enterNativeFullscreen failed:', e); } catch {}
    }
    return false;
  };

  const exitNativeFullscreen = async (): Promise<boolean> => {
    try {
      const anyDoc: any = document as any;
      if (anyDoc.exitFullscreen) { await anyDoc.exitFullscreen(); return true; }
      if (anyDoc.webkitExitFullscreen) { await anyDoc.webkitExitFullscreen(); return true; }
      if (anyDoc.mozCancelFullScreen) { await anyDoc.mozCancelFullScreen(); return true; }
      if (anyDoc.msExitFullscreen) { await anyDoc.msExitFullscreen(); return true; }
    } catch (e) {
      try { console.warn('[ReaderPage] exitNativeFullscreen failed:', e); } catch {}
    }
    return false;
  };

  const toggleFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;
    const currentlyFs = nativeFullscreen || overlayFullscreen;
    if (currentlyFs) {
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

  return (
    <div className="space-y-4 overflow-x-hidden">
      <DashboardHeader />

      <div
        ref={containerRef}
        className={`bg-slate-800 ${overlayFullscreen ? 'fixed inset-0 z-50 p-0 sm:p-0 rounded-none' : 'p-3 sm:p-4 rounded-md'} overflow-hidden`}
        style={overlayFullscreen ? { width: '100vw', height: '100vh' } : undefined}
      >
        <div className="bg-slate-700 text-white rounded-t-md px-3 sm:px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            <Link to="/" className="text-sm hover:underline flex items-center gap-1">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Back</span>
            </Link>
            <div>
              <div className="text-sm font-semibold">{bookMeta?.title || 'Book'}</div>
              <div className="text-xs opacity-80">
                {(() => {
                  const authors = namesFrom((bookMeta as any)?.authors);
                  const authorLine = authors.length ? authors.join(', ') : '';
                  const year = (bookMeta as any)?.year || '';
                  const sep = authorLine && year ? ' — ' : '';
                  return `${authorLine}${sep}${year}` || '-';
                })()}
              </div>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 sm:gap-3">
            <button onClick={prevSpread} className="p-2.5 rounded-md hover:bg-slate-600"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
            <div className="text-sm">{page}{twoPage ? ` & ${Math.min(page + 1, pageCount)}` : ''} of {pageCount}</div>
            <button onClick={nextSpread} className="p-2.5 rounded-md hover:bg-slate-600"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg></button>

            <div className="flex items-center gap-1">
              <button onClick={zoomOut} className="p-2.5 rounded-md hover:bg-slate-600">-</button>
              <div className="text-sm">{Math.round(scale * 100)}%</div>
              <button onClick={zoomIn} className="p-2.5 rounded-md hover:bg-slate-600">+</button>
            </div>
            <input type="range" min={0.5} max={2.5} step={0.05} value={scale} onChange={(e) => setScale(parseFloat(e.target.value))} className="w-32 sm:w-40" />

            <button onClick={() => setFav((v) => !v)} className={`p-2 rounded-md ${fav ? 'bg-red-600 text-white' : 'hover:bg-slate-600'}`}>вќ¤</button>

            <button onClick={toggleFullscreen} className="p-2 rounded-md hover:bg-slate-600">{(nativeFullscreen||overlayFullscreen)?'Exit':'Full'}</button>

            <button onClick={() => setTwoPage((v) => !v)} className="p-2 rounded-md hover:bg-slate-600">{twoPage ? '2-up' : '1-up'}</button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3 sm:gap-4 bg-slate-800 p-3 sm:p-6 max-w-full overflow-x-auto" onWheel={onWheel} onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerMove={onPointerMove} onTouchStart={(e)=>{ if (e.touches.length===2){ const [a,b]=[e.touches[0],e.touches[1]]; const dx=a.clientX-b.clientX; const dy=a.clientY-b.clientY; pinchStartDistRef.current=Math.hypot(dx,dy); pinchStartScaleRef.current=scale; } else if (e.touches.length===1){ lastTouchXRef.current=e.touches[0].clientX; } }} onTouchMove={(e)=>{ if (e.touches.length===2 && pinchStartDistRef.current){ e.preventDefault(); const [a,b]=[e.touches[0],e.touches[1]]; const dx=a.clientX-b.clientX; const dy=a.clientY-b.clientY; const dist=Math.hypot(dx,dy); const ratio=dist/(pinchStartDistRef.current||1); const next=Math.max(0.5, Math.min(2.5, +(pinchStartScaleRef.current*ratio).toFixed(2))); setScale(next);} }} onTouchEnd={(e)=>{ if (pinchStartDistRef.current && e.touches.length<2){ pinchStartDistRef.current=null;} if (e.changedTouches && e.changedTouches.length===1 && lastTouchXRef.current!=null){ const dx=e.changedTouches[0].clientX - lastTouchXRef.current; const threshold=60; if (dx>threshold) prevSpread(); else if (dx<-threshold) nextSpread(); lastTouchXRef.current=null; } }}>
          <div className="flex-1 min-w-0 flex items-start justify-center">
            <div className="bg-slate-100 p-3 sm:p-4 rounded-md shadow-inner max-w-full overflow-x-auto mx-auto w-full sm:w-auto sm:max-w-full max-w-[420px]">
              <div className="flex gap-3 sm:gap-4 flex-wrap md:flex-nowrap items-start justify-center">
                <canvas ref={leftCanvasRef} className="bg-white max-w-full h-auto" />
                {twoPage && <canvas ref={rightCanvasRef} className="bg-white max-w-full h-auto" />}
              </div>
            </div>
          </div>

          {!isMobile && (<aside className="w-full md:w-72 shrink-0 bg-white rounded-md p-3 sm:p-4 flex flex-col">
            <div className="mb-2 text-sm text-slate-500 flex items-center justify-between">
              <span>Notes</span>
              <span className={`text-[11px] ${saving==='saving'?'text-amber-600': saving==='saved'?'text-emerald-600': saving==='error'?'text-red-600':'text-slate-400'}`}>
                {saving === 'saving' ? 'SavingвЂ¦' : saving === 'saved' ? 'Saved' : saving === 'error' ? 'Error' : 'Auto-save'}
              </span>
            </div>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Write your notes here (per page)" className="flex-1 border rounded-md p-2 text-sm min-h-[8rem] md:min-h-0" />
            <div className="text-xs text-slate-400 mt-2">Saved per page вЂў book {bookIdParam || '-'} вЂў page {page}</div>
          </aside>)}
        </div>

        <div className="hidden sm:flex bg-slate-700 text-white rounded-b-md px-3 sm:px-4 py-3 mt-0 items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <button onClick={prevSpread} className="p-2.5 rounded-md hover:bg-slate-600"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
            <div className="text-sm">{page}{twoPage ? ` & ${Math.min(page + 1, pageCount)}` : ''} of {pageCount}</div>
            <button onClick={nextSpread} className="p-2.5 rounded-md hover:bg-slate-600"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={zoomOut} className="p-2.5 rounded-md hover:bg-slate-600">-</button>
            <input type="range" min={0.5} max={2.5} step={0.05} value={scale} onChange={(e) => setScale(parseFloat(e.target.value))} className="w-32 sm:w-40" />
            <button onClick={zoomIn} className="p-2.5 rounded-md hover:bg-slate-600">+</button>
            <button onClick={() => setTwoPage((v) => !v)} className="ml-2 p-2 rounded-md hover:bg-slate-600">{twoPage ? '2-up' : '1-up'}</button>
          </div>
        </div>

        {isMobile && (
          <>
            <button aria-label="Open notes" onClick={() => setNotesOpen(true)} className="fixed bottom-4 right-4 z-50 p-3 rounded-full bg-white shadow border text-slate-700">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M4 4h16v12H7l-3 3V4z" />
                <path d="M14 8l-4 4" />
                <path d="M10 8l4 4" />
              </svg>
            </button>
            <button aria-label="Toggle fullscreen" title="Fullscreen" onClick={toggleFullscreen} className="fixed bottom-4 left-4 z-50 p-3 rounded-full bg-white shadow border text-slate-700">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 3h6v6" />
                <path d="M21 3l-7 7" />
                <path d="M9 21H3v-6" />
                <path d="M3 21l7-7" />
              </svg>
            </button>
            {notesOpen && (
              <div className="fixed inset-0 z-50">
                <div className="absolute inset-0 bg-black/50" onClick={() => setNotesOpen(false)} />
                <div className="absolute inset-x-4 top-16 bottom-16 bg-white rounded-lg shadow p-4 flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium text-slate-700">Notes (page {page})</div>
                    <button onClick={() => setNotesOpen(false)} className="p-2 rounded hover:bg-slate-100" aria-label="Close">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 6l12 12M6 18L18 6"/></svg>
                    </button>
                  </div>
                  <div className="text-[11px] text-slate-500 mb-2">{saving === 'saving' ? 'Saving…' : saving === 'saved' ? 'Saved' : saving === 'error' ? 'Error' : 'Auto-save'}</div>
                  <textarea value={notes} onChange={(e)=>setNotes(e.target.value)} className="flex-1 border rounded-md p-2 text-sm" placeholder="Write your notes here (per page)" />
                  <div className="mt-2 text-xs text-slate-400">book {bookIdParam || '-'} • page {page}</div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
