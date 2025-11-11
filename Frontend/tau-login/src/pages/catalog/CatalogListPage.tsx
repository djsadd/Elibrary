import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import DashboardHeader from "../../components/layout/DashboardHeader";
import { api } from "@/shared/api/client";
import { namesFrom } from "@/shared/ui/text";
import bookImg from "@/assets/images/image.png";

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
  const [items, setItems] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  

  const SkeletonCard = ({ imageHeight }: { imageHeight: string }) => (
    <div className="bg-white border border-gray-100 rounded-lg p-3 text-center shadow-sm">
      <div className={`w-full ${imageHeight} rounded-md mb-3 bg-slate-200 animate-pulse`} />
      <div className="h-4 bg-slate-200 rounded mb-1 animate-pulse" />
      <div className="h-3 bg-slate-200 rounded w-2/3 mx-auto animate-pulse" />
    </div>
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await api<BookListResponse>("/api/catalog/books");
        if (!cancelled) setItems(Array.isArray(data.items) ? data.items : []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // load favorites from localStorage
  useEffect(() => {
    try {
      const favs: string[] = JSON.parse(localStorage.getItem("favorites") || "[]");
      setFavorites(new Set((Array.isArray(favs) ? favs : []).map(String)));
    } catch {
      setFavorites(new Set());
    }
  }, []);

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

  return (
    <div>
      <DashboardHeader />
      <h1 className="text-2xl font-semibold text-[#7b0f2b] mb-4">Catalog</h1>
      {error && <div className="text-red-600">Failed to load: {error}</div>}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-4">
        {loading
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
      {!loading && !error && items.length === 0 && (
        <div className="text-slate-500 mt-4">No books found</div>
      )}
    </div>
  );
}
