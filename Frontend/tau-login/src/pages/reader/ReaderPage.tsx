import type React from "react";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import DashboardHeader from "../../components/layout/DashboardHeader";
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
  const dragStartX = useRef<number | null>(null);
  const dragging = useRef(false);

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
            <Link to="/" className="text-sm hover:underline">← Back</Link>
            <div>
              <div className="text-sm font-semibold">INTRODUCTION</div>
              <div className="text-xs opacity-80">Don't Make Me Think — Steve Krug, 2010</div>
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

            <button onClick={() => setFav((v) => !v)} className={`p-2 rounded-md ${fav ? 'bg-red-600 text-white' : 'hover:bg-slate-600'}`}>❤</button>

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
            <div className="mb-2 text-sm text-slate-500">Notes</div>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Write your Notes Here" className="flex-1 border rounded-md p-2 text-sm" />
            <div className="text-xs text-slate-400 mt-2">Will Be Auto-Saved</div>
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
