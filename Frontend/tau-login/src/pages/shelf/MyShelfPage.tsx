import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DashboardHeader from "@/components/layout/DashboardHeader";
import { api } from "@/shared/api/client";
import { namesFrom } from "@/shared/ui/text";
import bookImg from "@/assets/images/image.png";

type Book = {
  id: number | string;
  title: string;
  cover?: string | null;
  authors?: string[];
};

type BookListResponse = { items: Book[] };

export default function MyShelfPage() {
  const [items, setItems] = useState<Book[]>([]);
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

  useEffect(() => {
    try {
      const favs: string[] = JSON.parse(localStorage.getItem("favorites") || "[]");
      setFavorites(new Set((Array.isArray(favs) ? favs : []).map(String)));
    } catch {
      setFavorites(new Set());
    }
  }, []);

  const filtered = useMemo(() => {
    if (tab === "fav") return items.filter(b => favorites.has(String(b.id)));
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
          : filtered.map((book) => (
              <Link
                to={`/catalog/${book.id}`}
                key={String(book.id)}
                className="block bg-white border border-gray-100 rounded-lg p-3 text-center shadow-sm hover:shadow-md transition-shadow"
              >
                <img src={book.cover || bookImg} alt={`book-${book.id}`} className="w-full h-40 sm:h-56 object-contain rounded-md mb-3 bg-slate-100 p-2" />
                <div className="text-sm font-medium text-slate-800 truncate">{book.title}</div>
                {namesFrom((book as any).authors).length ? (
                  <div className="text-xs text-slate-400 truncate">{namesFrom((book as any).authors).join(", ")}</div>
                ) : null}
              </Link>
            ))}
      </div>

      {!loading && filtered.length === 0 && (
        <div className="text-slate-500 mt-4">No books here yet.</div>
      )}
    </div>
  );
}
