import { Link, useSearchParams } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import DashboardHeader from "@/components/layout/DashboardHeader";
import { api } from "@/shared/api/client";
import { namesFrom } from "@/shared/ui/text";
import bookImg from "@/assets/images/Image.png";

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
  const [sp] = useSearchParams();
  const q = (sp.get('q') || '').trim();
  const [items, setItems] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialFetched = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!q) { setItems([]); setError(null); return; }
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        params.set('q', q);
        params.set('limit', '24');
        params.set('offset', '0');
        const url = `/api/catalog/books/search?${params.toString()}`;
        let data: BookListResponse;
        try {
          data = await api<BookListResponse>(url);
        } catch (e) {
          // fallback: client-side filter of first 100 catalog items
          try { console.warn('[Search] server search failed, fallback to client filter:', e); } catch {}
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
          data = { items: filtered, page: { limit: filtered.length, offset: 0, total: filtered.length } };
        }
        if (cancelled) return;
        setItems(Array.isArray(data.items) ? data.items : []);
        try { console.info('[Search] items:', data.items?.length ?? 0); } catch {}
      } catch (e: any) {
        if (!cancelled) setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
        initialFetched.current = true;
      }
    })();
    return () => { cancelled = true; };
  }, [q]);

  const SkeletonCard = () => (
    <div className="bg-white border border-gray-100 rounded-lg p-3 text-center shadow-sm">
      <div className="w-full h-44 rounded-md mb-3 bg-slate-200 animate-pulse" />
      <div className="h-4 bg-slate-200 rounded mb-1 animate-pulse" />
      <div className="h-3 bg-slate-200 rounded w-2/3 mx-auto animate-pulse" />
    </div>
  );

  return (
    <div>
      <DashboardHeader />
      <h1 className="text-2xl font-semibold text-[#7b0f2b] mb-4">Search</h1>
      {error && <div className="text-red-600 mb-2">{error}</div>}
      {!q && initialFetched.current && <div className="text-slate-500">Type a query to search.</div>}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-3 sm:gap-4">
        {loading
          ? Array.from({ length: 12 }).map((_, idx) => <SkeletonCard key={`sk-${idx}`} />)
          : items.map((book) => (
              <Link
                to={`/catalog/${book.id}`}
                key={String(book.id)}
                className="group relative block bg-white border border-gray-100 rounded-lg p-2 sm:p-3 text-center shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="relative mb-3">
                  <img src={book.cover || bookImg} alt={`book-${book.id}`} className="w-full h-44 sm:h-56 object-contain rounded-md bg-slate-100 p-2" />
                </div>
                <div className="text-sm font-medium text-slate-800 truncate">{book.title}</div>
                {namesFrom((book as any).authors).length ? (
                  <div className="text-xs text-slate-400 truncate">{namesFrom((book as any).authors).join(", ")}</div>
                ) : null}
              </Link>
            ))}
      </div>
      {!loading && !error && q && items.length === 0 && (
        <div className="text-slate-500 mt-4">No results</div>
      )}
    </div>
  );
}

