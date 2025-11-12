import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DashboardHeader from "@/components/layout/DashboardHeader";
import { api } from "@/shared/api/client";
import bookImg from "@/assets/images/image.png";

type AuthorMin = { id: number | string; name: string };
type BookMin = { id: number | string; title: string; cover?: string | null; authors?: AuthorMin[] };
type UserBook = {
  id: number | string;
  current_page?: number | null;
  total_pages?: number | null;
  progress_percent?: number | null;
  status?: string | null;
  reading_time?: number | null;
  book: BookMin;
};

export default function MyShelfPage() {
  const [items, setItems] = useState<UserBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"all" | "fav" | "borrowed" | "ebooks" | "audio" | "articles">("all");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await api<UserBook[]>("/api/catalog/userbook");
        if (!cancelled) {
          try { console.info("[MyShelf] userbook GET response:", data); } catch {}
          setItems(Array.isArray(data) ? data : []);
        }
      } catch (e: any) {
        if (!cancelled) {
          try { console.warn("[MyShelf] userbook GET failed:", e?.message || String(e)); } catch {}
          setError(e?.message || String(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    try {
      const favs: string[] = JSON.parse(localStorage.getItem("favorites") || "[]");
      setFavorites(new Set((Array.isArray(favs) ? favs : []).map(String)));
    } catch {
      setFavorites(new Set());
    }
  }, []);

  const filtered = useMemo(() => {
    if (tab === "fav") return items.filter(ub => favorites.has(String(ub.book?.id)));
    // other tabs are placeholders for now
    return items;
  }, [items, tab, favorites]);

  const SkeletonCard = ({ imageHeight }: { imageHeight: string }) => (
    <div className="bg-white border border-gray-100 rounded-lg p-3 text-center shadow-sm">
      <div className={`w-full ${imageHeight} rounded-md mb-3 bg-slate-200 animate-pulse`} />
      <div className="h-4 bg-slate-200 rounded mb-1 animate-pulse" />
      <div className="h-3 bg-slate-200 rounded w-2/3 mx-auto animate-pulse" />
    </div>
  );

  

  return (
    <div>
      <DashboardHeader />
      <h1 className="text-2xl font-semibold text-slate-800 mb-4">My Shelf</h1>

      <div className="flex items-center gap-4 border-b mb-4">
        {([
          ["all","All Books"],
          ["fav","Favourite"],
          ["borrowed","Borrowed Books"],
          ["ebooks","E-Books"],
          ["audio","Audio Books"],
          ["articles","Articles & Journals"],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`py-2 -mb-px border-b-2 text-sm ${tab===k ? 'border-[#7b0f2b] text-[#7b0f2b]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >{label}</button>
        ))}
      </div>

      {error && <div className="text-red-600 mb-3">Failed to load: {error}</div>}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-4">
        {loading
          ? Array.from({ length: 12 }).map((_, idx) => (
              <SkeletonCard key={`skeleton-${idx}`} imageHeight="h-40 sm:h-56" />
            ))
          : filtered.map((ub) => {
              const b = ub.book || ({} as BookMin);
              const authorNames = Array.isArray(b.authors) ? b.authors.map(a => a.name).filter(Boolean) : [];
              const progress = typeof ub.progress_percent === 'number' ? Math.max(0, Math.min(100, Math.round(ub.progress_percent))) : null;
              return (
                <Link
                  to={`/catalog/books/${encodeURIComponent(String(b.id ?? ''))}`}
                  key={`${ub.id}-${b.id}`}
                  className="block bg-white border border-gray-100 rounded-lg p-3 text-center shadow-sm hover:shadow-md transition-shadow"
                >
                  <img src={b.cover || bookImg} alt={`book-${b.id}`} className="w-full h-40 sm:h-56 object-contain rounded-md mb-3 bg-slate-100 p-2" />
                  <div className="text-sm font-medium text-slate-800 truncate">{b.title || '-'}</div>
                  {authorNames.length ? (
                    <div className="text-xs text-slate-400 truncate">{authorNames.join(", ")}</div>
                  ) : null}
                  {progress != null && (
                    <div className="mt-2">
                      <div className="w-full h-1.5 bg-slate-200 rounded">
                        <div className="h-1.5 bg-emerald-500 rounded" style={{ width: `${progress}%` }} />
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">{progress}% read</div>
                    </div>
                  )}
                </Link>
              );
            })}
      </div>

      {!loading && filtered.length === 0 && (
        <div className="text-slate-500 mt-4">No books here yet.</div>
      )}
    </div>
  );
}
