import { Link } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import DashboardHeader from "@/components/layout/DashboardHeader";
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

export default function FavoritesPage() {
  const [items, setItems] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [limit] = useState(24);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const aliveRef = useRef(true);

  const SkeletonCard = ({ imageHeight }: { imageHeight: string }) => (
    <div className="bg-white border border-gray-100 rounded-lg p-3 text-center shadow-sm">
      <div className={`w-full ${imageHeight} rounded-md mb-3 bg-slate-200 animate-pulse`} />
      <div className="h-4 bg-slate-200 rounded mb-1 animate-pulse" />
      <div className="h-3 bg-slate-200 rounded w-2/3 mx-auto animate-pulse" />
    </div>
  );

  // lifecycle guard for async updates and hydrate favorites from storage
  useEffect(() => {
    aliveRef.current = true;
    try {
      const favs: string[] = JSON.parse(localStorage.getItem("favorites") || "[]");
      setFavorites(new Set((Array.isArray(favs) ? favs : []).map(String)));
    } catch {
      setFavorites(new Set());
    }
    return () => { aliveRef.current = false; };
  }, []);

  // Fetch favourites from backend and render as books
  async function normaliseToBooks(data: any): Promise<Book[]> {
    const arr = Array.isArray(data) ? data : [];
    const out: Book[] = [];
    const missingIds: (string|number)[] = [];
    for (const it of arr) {
      if (!it) continue;
      if (typeof it === 'number' || typeof it === 'string') { missingIds.push(it); continue; }
      // common shapes from API
      if (it.book && typeof it.book === 'object' && (it.book.title || it.book.id)) { out.push(it.book as Book); continue; }
      if (it.book && (typeof it.book === 'number' || typeof it.book === 'string')) { missingIds.push(it.book); continue; }
      if (it.book_data && (it.book_data.title || it.book_data.id)) { out.push(it.book_data as Book); continue; }
      // prefer explicit book id fields; avoid using generic record id which is often favourite id
      const bid = it.book_id ?? it.bookId ?? it.catalog_id ?? it.catalogId ?? null;
      if (bid != null) missingIds.push(bid);
    }
    // fetch missing book details in parallel (bounded)
    const pool = 8;
    for (let i=0; i<missingIds.length; i+=pool) {
      const chunk = missingIds.slice(i, i+pool);
      const res = await Promise.all(chunk.map(id => api<Book>(`/api/catalog/books/${id}`).catch(()=>null)));
      for (const b of res) if (b && b.id != null) out.push(b);
    }
    return out;
  }

  const fetchPage = async (initial = false) => {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    params.set('offset', String(initial ? 0 : offset));
    const data = await api<any>(`/api/favourites/?${params.toString()}`);
    try { console.info('[Favorites] GET /api/favourites', data); } catch {}
    // tolerate various response shapes
    const pickArr = (obj: any): any[] => {
      if (!obj) return [];
      if (Array.isArray(obj)) return obj;
      if (Array.isArray(obj.items)) return obj.items;
      if (Array.isArray(obj.data)) return obj.data;
      if (Array.isArray(obj.results)) return obj.results;
      if (Array.isArray(obj.favourites)) return obj.favourites;
      if (Array.isArray(obj.favorites)) return obj.favorites;
      return [];
    };
    const raw = pickArr(data);
    const pageMeta = data?.page || data?.pagination || (typeof data?.total === 'number' ? { total: data.total } : null);
    // fast-path: if server already provided embedded book objects, use them immediately
    const quickBooks: Book[] = raw
      .map((it: any) => {
        if (!it) return null;
        if (it.book_data && (it.book_data.id != null || it.book_data.title)) return it.book_data as Book;
        if (it.book && typeof it.book === 'object' && (it.book.id != null || it.book.title)) return it.book as Book;
        return null;
      })
      .filter(Boolean) as Book[];
    const books = quickBooks.length > 0 ? quickBooks : await normaliseToBooks(raw);
    // de-duplicate by id
    if (!aliveRef.current) return;
    setItems(prev => {
      const seen = new Set(prev.map(b => String(b.id)));
      const add = books.filter(b => !seen.has(String(b.id)));
      return initial ? add : [...prev, ...add];
    });
    // update favorites set from ids
    setFavorites(prev => {
      const next = new Set(prev);
      books.forEach(b => next.add(String(b.id)));
      return next;
    });
    // pagination handling across shapes
    const pageCount = Array.isArray(raw) ? raw.length : 0;
    if (pageMeta && typeof (pageMeta.total ?? pageMeta.count) === 'number') {
      const total = Number(pageMeta.total ?? pageMeta.count);
      const nextOffset = (initial ? 0 : offset) + pageCount;
      setOffset(nextOffset);
      setHasMore(nextOffset < total);
    } else {
      setOffset((initial ? 0 : offset) + pageCount);
      setHasMore(pageCount >= limit);
    }
    try {
      console.debug('[Favorites] parsed', { raw: pageCount, added: books.length, totalKnown: pageMeta?.total ?? pageMeta?.count });
    } catch {}
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        await fetchPage(true);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((ents) => {
      for (const ent of ents) if (ent.isIntersecting) {
        if (!loadingMore && hasMore) {
          setLoadingMore(true);
          fetchPage(false).finally(() => setLoadingMore(false));
        }
      }
    }, { rootMargin: '300px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadingMore, offset]);

  // remove legacy filtering effect — now data comes from API

  const toggleFavorite = (id: string | number, e?: React.MouseEvent) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    const sid = String(id);
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid); else next.add(sid);
      try { localStorage.setItem("favorites", JSON.stringify(Array.from(next))); } catch {}
      return next;
    });
  };

  const title = useMemo(() => `${t('favorites.title')} (${items.length})`, [items]);

  return (
    <div>
      <DashboardHeader />
      <h1 className="text-2xl font-semibold text-[#7b0f2b] mb-4">{title}</h1>
      {error && <div className="text-red-600">{t('favorites.failed')}: {error}</div>}
      {!loading && items.length === 0 && (
        <div className="text-slate-500 mb-4">{t('favorites.none')}</div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-4">
        {loading && items.length === 0
          ? Array.from({ length: 12 }).map((_, idx) => (
              <SkeletonCard key={`skeleton-${idx}`} imageHeight="h-40 sm:h-56" />
            ))
          : items.map((book) => {
              const fav = favorites.has(String(book.id));
              return (
                <Link
                  to={`/catalog/${book.id}`}
                  key={String(book.id)}
                  className="group relative block bg-white border border-gray-100 rounded-lg p-3 text-center shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="relative mb-3">
                    <img src={book.cover || bookImg} alt={`book-${book.id}`} className="w-full h-40 sm:h-56 object-contain rounded-md bg-slate-100 p-2" />
                    <button
                      aria-label={fav ? "Remove from favorites" : "Add to favorites"}
                      onClick={(e) => toggleFavorite(book.id, e)}
                      className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-white/95 border shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <svg viewBox="0 0 24 24" className={fav ? "w-5 h-5 text-rose-600 fill-rose-600" : "w-5 h-5 text-slate-400"} fill={fav ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.8}>
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
        <div ref={sentinelRef} className="py-6 text-center text-slate-400 text-sm">{loadingMore ? t('favorites.loadingMore') : t('favorites.loadMore')}</div>
      )}
    </div>
  );
}
