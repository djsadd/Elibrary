import { Link, useSearchParams } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import DashboardHeader from "../../components/layout/DashboardHeader";
import { t } from "@/shared/i18n";
import { api } from "@/shared/api/client";
import { namesFrom } from "@/shared/ui/text";
import bookImg from "@/assets/images/Image.png";

type Book = {
  id: number | string;
  title: string;
  year?: string | null;
  lang?: string | null;
  pub_info?: string | null;
  summary?: string | null;
  cover?: string | null;
  file_id?: string | null;
  download_url?: string | null;
  authors?: string[];
  subjects?: string[];
};

type BookListResponse = {
  items: Book[];
  page?: { limit: number; offset: number; total: number };
};

export default function CatalogListPage() {
  const [sp] = useSearchParams();
  const q = (sp.get('q') || '').trim();
  const [items, setItems] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const DEFAULT_LIMIT = 24;
  const [pageInfo, setPageInfo] = useState<{ limit: number; offset: number; total: number }>({ limit: DEFAULT_LIMIT, offset: 0, total: 0 });
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const showError = !q && !!error;
  const [searchFallback, setSearchFallback] = useState(false);

  

  const SkeletonCard = ({ imageHeight }: { imageHeight: string }) => (
    <div className="bg-white border border-gray-100 rounded-lg p-3 text-center shadow-sm">
      <div className={`w-full ${imageHeight} rounded-md mb-3 bg-slate-200 animate-pulse`} />
      <div className="h-4 bg-slate-200 rounded mb-1 animate-pulse" />
      <div className="h-3 bg-slate-200 rounded w-2/3 mx-auto animate-pulse" />
    </div>
  );

  // initial fetch and when search query changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        setSearchFallback(false);
        const params = new URLSearchParams();
        params.set("limit", String(DEFAULT_LIMIT));
        params.set("offset", String(0));
        if (q) params.set('q', q);
        const endpoint = q ? '/api/catalog/books/search' : '/api/catalog/books';
        const url = `${endpoint}?${params.toString()}`;
        let data: BookListResponse;
        try {
          data = await api<BookListResponse>(url);
        } catch (e) {
          // Fallback path for search errors: fetch plain catalog and filter on client
          if (q) {
            try { console.warn('[Catalog] search endpoint failed, falling back to client-side filter:', e); } catch {}
            const p2 = new URLSearchParams();
            // grab more to improve match chance
            p2.set('limit', String(100));
            p2.set('offset', '0');
            const url2 = `/api/catalog/books?${p2.toString()}`;
            const data2 = await api<BookListResponse>(url2);
            const needle = q.toLocaleLowerCase();
            const inText = (s?: string | null) => (s ? s.toLocaleLowerCase().includes(needle) : false);
            const filtered = (Array.isArray(data2.items) ? data2.items : []).filter((b: any) => {
              if (inText(b?.title)) return true;
              const a = (b?.authors || []).map((x: any) => (typeof x === 'string' ? x : x?.name || '')).filter(Boolean);
              const s = (b?.subjects || []).map((x: any) => (typeof x === 'string' ? x : x?.name || '')).filter(Boolean);
              if (a.some(inText)) return true;
              if (s.some(inText)) return true;
              return false;
            });
            data = { items: filtered, page: { limit: filtered.length, offset: 0, total: filtered.length } };
            setSearchFallback(true);
          } else {
            throw e;
          }
        }
        try {
          console.groupCollapsed('[Catalog] fetch initial', { endpoint, q, limit: pageInfo.limit, offset: 0 });
          console.info('URL:', url);
          console.info('Raw response:', data);
        } catch {}
        if (cancelled) return;
        const arr = Array.isArray(data.items) ? data.items : [];
        try { console.info('Items parsed:', arr.length, arr.slice(0, 3)); console.groupEnd?.(); } catch {}
        setItems(arr);
        const total = data.page?.total ?? arr.length;
        const limit = Math.max(1, data.page?.limit ?? DEFAULT_LIMIT);
        const offset = data.page?.offset ?? 0;
        setPageInfo({ limit, offset: offset + arr.length, total });
        setHasMore(!q && (offset + arr.length < total));
      } catch (e: any) {
        try { console.warn('[Catalog] initial fetch failed:', e); } catch {}
        const msg = (e && typeof e.message === 'string')
          ? e.message
          : (typeof e === 'string' ? e : (()=>{ try { return JSON.stringify(e); } catch { return String(e); } })());
        if (!cancelled) setError(msg);
        // For search errors (e.g., 422), keep UI clean: just show empty list
        if (!cancelled && q) {
          setItems([]);
          setPageInfo((p) => ({ ...p, offset: 0, total: 0 }));
          setHasMore(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    if (q && searchFallback) return; // no pagination in fallback mode
    try {
      setLoadingMore(true);
      const params = new URLSearchParams();
      params.set("limit", String(pageInfo.limit));
      params.set("offset", String(pageInfo.offset));
      if (q) params.set('q', q);
      const endpoint = q ? '/api/catalog/books/search' : '/api/catalog/books';
      const url = `${endpoint}?${params.toString()}`;
      const data = await api<BookListResponse>(url);
      try {
        console.groupCollapsed('[Catalog] fetch more', { endpoint, q, limit: pageInfo.limit, offset: pageInfo.offset });
        console.info('URL:', url);
        console.info('Raw response:', data);
      } catch {}
      const arr = Array.isArray(data.items) ? data.items : [];
      try { console.info('Items parsed:', arr.length, arr.slice(0, 3)); console.groupEnd?.(); } catch {}
      setItems(prev => {
        const seen = new Set(prev.map((b) => String(b.id)));
        const add = arr.filter((b) => !seen.has(String(b.id)));
        return [...prev, ...add];
      });
      const total = data.page?.total ?? pageInfo.total;
      const nextOffset = pageInfo.offset + arr.length;
      setPageInfo((p) => ({ ...p, offset: nextOffset, total }));
      setHasMore(nextOffset < total);
    } catch (e) {
      try { console.warn('[Catalog] load more failed:', e); } catch {}
      // ignore load-more errors, keep hasMore true to allow retry on scroll
    } finally {
      setLoadingMore(false);
    }
  };

  // intersection observer to auto-load more on mobile scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      for (const ent of entries) {
        if (ent.isIntersecting) {
          loadMore();
        }
      }
    }, { rootMargin: "300px" });
    io.observe(el);
    return () => io.disconnect();
  }, [sentinelRef.current, hasMore, loadingMore, pageInfo.offset]);

  // load favorites from localStorage
  useEffect(() => {
    try {
      const favs: string[] = JSON.parse(localStorage.getItem("favorites") || "[]");
      setFavorites(new Set((Array.isArray(favs) ? favs : []).map(String)));
    } catch {
      setFavorites(new Set());
    }
  }, []);

  const toggleFavorite = async (id: string | number, e?: React.MouseEvent) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    const sid = String(id);
    const alreadyFav = favorites.has(sid);

    // optimistic toggle in UI/localStorage
    const next = new Set(favorites);
    if (alreadyFav) next.delete(sid); else next.add(sid);
    setFavorites(next);
    try { localStorage.setItem("favorites", JSON.stringify(Array.from(next))); } catch {}

    // network side-effect:
    // - POST on add
    // - DELETE /{book_id} on remove
    try {
      if (!alreadyFav) {
        await api<any>(`/api/favourites/`, {
          method: "POST",
          body: JSON.stringify({ book_id: Number(id) }),
        });
      } else {
        await api<any>(`/api/favourites/${Number(id)}`, {
          method: "DELETE",
        });
      }
    } catch (err: any) {
      // revert optimistic update on failure
      const reverted = new Set(favorites);
      if (alreadyFav) {
        reverted.add(sid);
      } else {
        reverted.delete(sid);
      }
      setFavorites(reverted);
      try { localStorage.setItem("favorites", JSON.stringify(Array.from(reverted))); } catch {}
      try { console.warn("[Catalog] favourite toggle failed:", err?.message || String(err)); } catch {}
    }
  };

  return (
    <div>
      <DashboardHeader />
      <h1 className="text-2xl font-semibold text-[#7b0f2b] mb-4">{t('catalog.title')}</h1>
      {showError && <div className="text-red-600">Failed to load: {error}</div>}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-3 sm:gap-4">
        {loading
          ? Array.from({ length: 12 }).map((_, idx) => (
              <SkeletonCard key={`skeleton-${idx}`} imageHeight="h-44 sm:h-56" />
            ))
          : items.map((book) => {
              const fav = favorites.has(String(book.id));
              return (
                <Link
                  to={`/catalog/${book.id}`}
                  key={String(book.id)}
                  className="group relative block bg-white border border-gray-100 rounded-lg p-2 sm:p-3 text-center shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="relative mb-3">
                    <img src={book.cover || bookImg} alt={`book-${book.id}`} className="w-full h-44 sm:h-56 object-contain rounded-md bg-slate-100 p-2" />
                    <button
                      aria-label={fav ? "Remove from favorites" : "Add to favorites"}
                      onClick={(e) => toggleFavorite(book.id, e)}
                      aria-pressed={fav}
                      className="absolute top-2 right-2 z-10 p-2 rounded-full bg-white/95 border shadow-sm opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                    >
                      <svg viewBox="0 0 24 24" className={fav ? "w-6 h-6 text-rose-600 fill-rose-600" : "w-6 h-6 text-slate-400"} fill={fav ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.8}>
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.41 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.41 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                      </svg>
                    </button>
                  </div>
                  <div className="text-sm font-medium text-slate-800 truncate">{book.title}</div>
                  {namesFrom((book as any).authors).length ? (
                    <div className="text-xs text-slate-400 truncate">{namesFrom((book as any).authors).join(", ")}</div>
                  ) : null}
                </Link>
              );
            })}
      </div>
      {(hasMore || loadingMore) && !loading && (
        <div ref={sentinelRef} className="py-6 text-center text-slate-400 text-sm">{loadingMore ? 'Loading more…' : 'Scroll to load more'}</div>
      )}
      {!loading && !showError && items.length === 0 && (
        <div className="text-slate-500 mt-4">{t('common.noBooks')}</div>
      )}
    </div>
  );
}
