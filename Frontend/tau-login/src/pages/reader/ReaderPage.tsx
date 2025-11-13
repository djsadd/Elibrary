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
  const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
  const containerRef = useRef<HTMLDivElement | null>(null);
  const leftCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rightCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pdf, setPdf] = useState<any>(null);
  const [pageCount, setPageCount] = useState(0);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [twoPage, setTwoPage] = useState(true);
  const [fav, setFav] = useState(false);
  const [notes, setNotes] = useState("");
  const notesMapRef = useRef<Map<number, string>>(new Map());
  const notesIdMapRef = useRef<Map<number, string | number>>(new Map());
  const lastSentRef = useRef<string>("");
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const dragStartX = useRef<number | null>(null);
  const dragging = useRef(false);

  const [userbookId, setUserbookId] = useState<string | null>(null);
  const [bookMeta, setBookMeta] = useState<any | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    console.info("[ReaderPage] Bearer token:", token);
  }, []);

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
      const src = bookIdParam ? `${BASE}/api/catalog/books/${bookIdParam}/download` : (pdfUrlParam || bookPdf);
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const loadingTask = pdfjsLib.getDocument({
        url: src as any,
        httpHeaders: token ? { Authorization: `Bearer ${token}` } : undefined,
      } as any);
      const doc = await loadingTask.promise;
      if (cancelled) return;
      setPdf(doc);
      setPageCount(doc.numPages);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [pdfUrlParam, bookIdParam, BASE]);

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

  const toggleFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;
    // @ts-ignore
    if (!document.fullscreenElement) {
      // @ts-ignore
      await el.requestFullscreen?.();
    } else {
      // @ts-ignore
      await document.exitFullscreen?.();
    }
  };

  return (
    <div className="space-y-4 overflow-x-hidden">
      <DashboardHeader />

      <div ref={containerRef} className="bg-slate-800 p-4 rounded-md overflow-hidden">
        <div className="bg-slate-700 text-white rounded-t-md px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
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

          <div className="flex items-center gap-3">
            <button onClick={prevSpread} className="p-2 rounded-md hover:bg-slate-600"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
            <div className="text-sm">{page}{twoPage ? ` & ${Math.min(page + 1, pageCount)}` : ''} of {pageCount}</div>
            <button onClick={nextSpread} className="p-2 rounded-md hover:bg-slate-600"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg></button>

            <div className="flex items-center gap-1">
              <button onClick={zoomOut} className="p-2 rounded-md hover:bg-slate-600">-</button>
              <div className="text-sm">{Math.round(scale * 100)}%</div>
              <button onClick={zoomIn} className="p-2 rounded-md hover:bg-slate-600">+</button>
            </div>
            <input type="range" min={0.5} max={2.5} step={0.05} value={scale} onChange={(e) => setScale(parseFloat(e.target.value))} className="w-28" />

            <button onClick={() => setFav((v) => !v)} className={`p-2 rounded-md ${fav ? 'bg-red-600 text-white' : 'hover:bg-slate-600'}`}>вќ¤</button>

            <button onClick={toggleFullscreen} className="p-2 rounded-md hover:bg-slate-600">Full</button>

            <button onClick={() => setTwoPage((v) => !v)} className="p-2 rounded-md hover:bg-slate-600">{twoPage ? '2-up' : '1-up'}</button>
          </div>
        </div>

        <div className="flex gap-4 bg-slate-800 p-6 max-w-full overflow-x-auto" onWheel={onWheel} onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerMove={onPointerMove}>
          <div className="flex-1 min-w-0 flex items-start justify-center">
            <div className="bg-slate-100 p-4 rounded-md shadow-inner max-w-full overflow-x-auto">
              <div className="flex gap-4 flex-wrap md:flex-nowrap items-start justify-center">
                <canvas ref={leftCanvasRef} className="bg-white max-w-full h-auto" />
                {twoPage && <canvas ref={rightCanvasRef} className="bg-white max-w-full h-auto" />}
              </div>
            </div>
          </div>

          <aside className="w-72 shrink-0 bg-white rounded-md p-4 flex flex-col">
            <div className="mb-2 text-sm text-slate-500 flex items-center justify-between">
              <span>Notes</span>
              <span className={`text-[11px] ${saving==='saving'?'text-amber-600': saving==='saved'?'text-emerald-600': saving==='error'?'text-red-600':'text-slate-400'}`}>
                {saving === 'saving' ? 'SavingвЂ¦' : saving === 'saved' ? 'Saved' : saving === 'error' ? 'Error' : 'Auto-save'}
              </span>
            </div>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Write your notes here (per page)" className="flex-1 border rounded-md p-2 text-sm" />
            <div className="text-xs text-slate-400 mt-2">Saved per page вЂў book {bookIdParam || '-'} вЂў page {page}</div>
          </aside>
        </div>

        <div className="bg-slate-700 text-white rounded-b-md px-4 py-3 mt-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={prevSpread} className="p-2 rounded-md hover:bg-slate-600"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
            <div className="text-sm">{page}{twoPage ? ` & ${Math.min(page + 1, pageCount)}` : ''} of {pageCount}</div>
            <button onClick={nextSpread} className="p-2 rounded-md hover:bg-slate-600"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={zoomOut} className="p-2 rounded-md hover:bg-slate-600">-</button>
            <input type="range" min={0.5} max={2.5} step={0.05} value={scale} onChange={(e) => setScale(parseFloat(e.target.value))} className="w-40" />
            <button onClick={zoomIn} className="p-2 rounded-md hover:bg-slate-600">+</button>
            <button onClick={() => setTwoPage((v) => !v)} className="ml-2 p-2 rounded-md hover:bg-slate-600">{twoPage ? '2-up' : '1-up'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}


