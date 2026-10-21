import BookCard from "@/components/common/BookCard";
import CatalogSearch from "@/components/common/CatalogSearch";
import { t } from "@/shared/i18n";
import { designCopy } from "@/shared/designCopy";
import { Link, useSearchParams } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import DashboardHeader from "@/components/layout/DashboardHeader";
import { api } from "@/shared/api/client";
import { searchBooks, type SearchResponse } from "@/shared/api/search";

type FilterId = "all" | "books" | "ebooks" | "audio" | "articles";
const FILTER_TO_FORMAT: Record<FilterId, string | null> = {
  all: null,
  books: "HARDCOPY",
  ebooks: "EBOOK",
  audio: "AUDIOBOOK",
  articles: "ARTICLE",
};

type Book = {
  id: number | string;
  title: string;
  year?: string | null;
  lang?: string | null;
  cover?: string | null;
  authors?: string[];
  subjects?: string[];
};

type BookListResponse = {
  items: Book[];
  page?: { limit: number; offset: number; total: number };
};

export default function SearchResultsPage() {
  const [sp, setSp] = useSearchParams();
  const q = (sp.get('q') || '').trim();
  const rawFilter = (sp.get("filter") || "all").trim().toLowerCase();
  const filter: FilterId = (["all", "books", "ebooks", "audio", "articles"] as const).includes(rawFilter as any)
    ? (rawFilter as FilterId)
    : "all";
  const rawPage = Number(sp.get('page') || '1');
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const DEFAULT_LIMIT = 15;
  const offset = (page - 1) * DEFAULT_LIMIT;
  const [items, setItems] = useState<Book[]>([]);
  const [pageInfo, setPageInfo] = useState<{ limit: number; offset: number; total: number }>({ limit: DEFAULT_LIMIT, offset: 0, total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialFetched = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!q) { setItems([]); setPageInfo({ limit: DEFAULT_LIMIT, offset: 0, total: 0 }); setError(null); return; }
      try {
        setLoading(true);
        setError(null);
        let data: BookListResponse;
        const normalizeFormats = (raw: any): string[] => {
          const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
          return arr
            .map((s) => String(s).trim().toUpperCase().replace(/[^A-Z]/g, ""))
            .map((s) => s.replace(/^EBOOKS?$/, "EBOOK").replace(/^AUDIOBOOKS?$/, "AUDIOBOOK").replace(/^VIDEOBOOKS?$/, "VIDEOBOOK"))
            .filter(Boolean);
        };

        const format = FILTER_TO_FORMAT[filter] ?? null;
        const matchesFormat = (book: any, f: string) => {
          const formats = normalizeFormats(book?.formats);
          if (f === "HARDCOPY") return formats.includes("HARDCOPY") || (!formats.length && !!book);
          return formats.includes(f);
        };

        if (format) {
          const params = new URLSearchParams();
          params.set("q", q);
          params.set("offset", "0");
          const url = `/api/catalog/books/search?${params.toString()}`;
          const raw = await api<BookListResponse>(url);
          const allItems = Array.isArray(raw.items) ? raw.items : [];
          const filtered = allItems.filter((b: any) => matchesFormat(b, format));
          const pageItems = filtered.slice(offset, offset + DEFAULT_LIMIT);
          data = { items: pageItems, page: { limit: DEFAULT_LIMIT, offset, total: filtered.length } };
        } else {
          try {
            const s: SearchResponse = await searchBooks(q, { limit: DEFAULT_LIMIT, offset });
            data = { items: (s.items || []) as any, page: s.page as any };
          } catch (e) {
            // fallback: catalog search endpoint (and then client-side filter if needed)
            try { console.warn('[Search] search service failed, fallback to catalog search:', e); } catch {}
            const params = new URLSearchParams();
            params.set('q', q);
            params.set('limit', String(DEFAULT_LIMIT));
            params.set('offset', String(offset));
            const url = `/api/catalog/books/search?${params.toString()}`;
            try {
              data = await api<BookListResponse>(url);
            } catch (e2) {
              try { console.warn('[Search] catalog search failed, fallback to client filter:', e2); } catch {}
              const url2 = `/api/catalog/books?limit=100&offset=0`;
              const data2 = await api<BookListResponse>(url2);
              const needle = q.toLocaleLowerCase();
              const inText = (s?: string | null) => (s ? s.toLocaleLowerCase().includes(needle) : false);
              const filtered = (Array.isArray(data2.items) ? data2.items : []).filter((b: any) => {
                if (inText(b?.title)) return true;
                const a = (b?.authors || []).map((x: any) => (typeof x === 'string' ? x : x?.name || '')).filter(Boolean);
                const s = (b?.subjects || []).map((x: any) => (typeof x === 'string' ? x : x?.name || '')).filter(Boolean);
                return a.some(inText) || s.some(inText);
              });
              const pageItems = filtered.slice(offset, offset + DEFAULT_LIMIT);
              data = { items: pageItems, page: { limit: DEFAULT_LIMIT, offset, total: filtered.length } };
            }
          }
        }
        if (cancelled) return;
        setItems(Array.isArray(data.items) ? data.items : []);
        const p = data.page || { limit: DEFAULT_LIMIT, offset, total: (Array.isArray(data.items) ? data.items.length : 0) };
        setPageInfo({
          limit: Math.max(1, Number(p.limit) || DEFAULT_LIMIT),
          offset: Math.max(0, Number(p.offset) || 0),
          total: Math.max(0, Number(p.total) || 0),
        });
        try { console.info('[Search] items:', data.items?.length ?? 0); } catch {}
      } catch (e: any) {
        if (!cancelled) setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
        initialFetched.current = true;
      }
    })();
    return () => { cancelled = true; };
  }, [q, page, filter]);

  const SkeletonCard = () => (
    <div className="bg-white border border-gray-100 rounded-lg p-3 text-center shadow-sm">
      <div className="w-full h-44 rounded-md mb-3 bg-slate-200 animate-pulse" />
      <div className="h-4 bg-slate-200 rounded mb-1 animate-pulse" />
      <div className="h-3 bg-slate-200 rounded w-2/3 mx-auto animate-pulse" />
    </div>
  );

  const totalPages = Math.max(1, Math.ceil(pageInfo.total / DEFAULT_LIMIT));
  const goToPage = (nextPage: number) => {
    const normalized = Math.min(Math.max(1, nextPage), totalPages);
    const params = new URLSearchParams(sp);
    if (q) params.set("q", q); else params.delete("q");
    if (filter !== "all") params.set("filter", filter); else params.delete("filter");
    if (normalized > 1) params.set("page", String(normalized)); else params.delete("page");
    setSp(params, { replace: false });
  };

  const pageNumbers = (() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const nums = new Set<number>([1, totalPages, page - 2, page - 1, page, page + 1, page + 2]);
    return Array.from(nums).filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);
  })();

  return (
    <div>
      <DashboardHeader />
      <div className="page-heading"><h1>{t("header.search.ariaLabel")}</h1><p>{q || designCopy().searchHint}</p></div>
      {error && <div className="text-red-600 mb-2">{error}</div>}
      <CatalogSearch key={q} initialValue={q}/>
      <div className="book-grid">
        {loading
          ? Array.from({ length: 12 }).map((_, idx) => <SkeletonCard key={`sk-${idx}`} />)
          : items.map(book=><BookCard key={book.id} book={book} to={`/catalog/${book.id}?from=vector-search&q=${encodeURIComponent(q)}`}/>)}
      </div>
      {!loading && !error && q && items.length > 0 && totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
          <button
            type="button"
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1}
            className="px-3 py-1 rounded border text-sm disabled:opacity-50"
          >
            {designCopy().previous}
          </button>
          {pageNumbers.map((n, idx) => {
            const prev = pageNumbers[idx - 1];
            const gap = prev && n - prev > 1;
            return (
              <span key={`p-${n}`} className="flex items-center gap-2">
                {gap && <span className="text-slate-400">...</span>}
                <button
                  type="button"
                  onClick={() => goToPage(n)}
                  className={n === page
                    ? "px-3 py-1 rounded bg-[#b51e3e] text-white text-sm"
                    : "px-3 py-1 rounded border text-sm"}
                >
                  {n}
                </button>
              </span>
            );
          })}
          <button
            type="button"
            onClick={() => goToPage(page + 1)}
            disabled={page >= totalPages}
            className="px-3 py-1 rounded border text-sm disabled:opacity-50"
          >
            {designCopy().next}
          </button>
        </div>
      )}
      {!loading && !error && q && items.length === 0 && (
        <div className="text-slate-500 mt-4">{designCopy().noResults}</div>
      )}
    </div>
  );
}
