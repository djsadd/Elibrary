import bookImg from "@/assets/images/image.png";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { api } from "@/shared/api/client";
import DashboardHeader from "../../components/layout/DashboardHeader";
import { namesFrom } from "@/shared/ui/text";

function HeroQuotes() {
  const quotes = [
    { text: "Reading gives us someplace to go when we have to stay where we are.", author: "Mason Cooley" },
    { text: "A room without books is like a body without a soul.", author: "Marcus Tullius Cicero" },
    { text: "So many books, so little time.", author: "Frank Zappa" },
  ];

  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % quotes.length), 4500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="bg-gradient-to-r from-[#EB5231] to-[#571FCF] text-white rounded-lg p-5 md:p-6 min-h-[120px] md:min-h-[150px] flex flex-col justify-between">
      <div>
        <div className="text-xl font-semibold">Welcome back</div>
        <p className="mt-4 text-sm opacity-90">{quotes[index].text}</p>
      </div>

      <div className="flex items-center justify-between mt-4">
        <div className="text-sm opacity-90">— {quotes[index].author}</div>
        <div className="flex items-center gap-2">
          {quotes.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`Show quote ${i + 1}`}
              className={`w-2 h-2 rounded-full transition-colors ${index === i ? 'bg-white' : 'bg-white/40'}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  type Book = {
    id: number | string;
    title: string;
    cover?: string | null;
    authors?: string[];
  };
  type Playlist = { id: number | string; title: string; description?: string | null; books: Book[] };

  const SkeletonCard = ({ imageHeight }: { imageHeight: string }) => (
    <div className="bg-white border border-gray-100 rounded-lg p-2 sm:p-3 text-center shadow-sm w-full sm:w-auto">
      <div className={`w-full ${imageHeight} rounded-md mb-2 sm:mb-3 bg-slate-200 animate-pulse`} />
      <div className="h-4 bg-slate-200 rounded mb-1 animate-pulse" />
      <div className="h-3 bg-slate-200 rounded w-2/3 mx-auto animate-pulse" />
    </div>
  );

  const [items, setItems] = useState<Book[]>([]); // fallback
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const pls = await api<Playlist[]>("/api/catalog/playlists");
        // eslint-disable-next-line no-console
        console.log("/api/catalog/playlists response", pls);
        if (Array.isArray(pls) && !cancelled) {
          setPlaylists(pls);
          setLoading(false);
          if (pls.length) return;
        }
      } catch (e) {
        // ignore and fallback
      }
      try {
        const data = await api<{ items: Book[] }>("/api/catalog/books");
        if (!cancelled) setItems(Array.isArray(data.items) ? data.items : []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      <div className="space-y-4">
        <DashboardHeader />

        <div className="flex gap-6 mb-6">
          <div className="flex-1">
            <HeroQuotes />
          </div>
        </div>

        {playlists.length === 0 ? (
          <section className="mb-6">
          <h2 className="text-2xl font-semibold text-slate-800">Good Morning</h2>
          <div className="text-sm text-slate-500 mt-1">Recommended for You</div>
          {error && <div className="text-red-600 mt-2">Failed to load: {error}</div>}

          <div className="mt-4">
            <div className="grid sm:hidden grid-cols-2 gap-3">
              {loading
                ? Array.from({ length: 6 }).map((_, idx) => (
                    <SkeletonCard key={`skeleton-m-${idx}`} imageHeight="h-40" />
                  ))
                : items.slice(0, 7).map((book) => (
                    <Link
                      to={`/catalog/${book.id}`}
                      key={String(book.id)}
                      className="block w-full bg-white border border-gray-100 rounded-lg p-3 text-center shadow-sm hover:shadow-md transition-shadow"
                    >
                      <img src={book.cover || bookImg} alt={`book-${book.id}`} className="w-full h-40 object-contain rounded-md mb-2 bg-slate-100 p-1" />
                      <div className="text-sm font-medium text-slate-800 truncate">{book.title}</div>
                      {namesFrom((book as any).authors).length ? (
                        <div className="text-xs text-slate-400 truncate">{namesFrom((book as any).authors).join(", ")}</div>
                      ) : null}
                    </Link>
                  ))}
            </div>

            {/* Grid for sm+ */}
            <div className="hidden sm:grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-4">
              {loading
                ? Array.from({ length: 7 }).map((_, idx) => (
                    <div key={`skeleton-g-${idx}`}>
                      <SkeletonCard imageHeight="h-56" />
                    </div>
                  ))
                : items.slice(0, 7).map((book) => (
                    <Link
                      to={`/catalog/${book.id}`}
                      key={String(book.id)}
                      className="block bg-white border border-gray-100 rounded-lg p-3 text-center shadow-sm hover:shadow-md transition-shadow"
                    >
                      <img src={book.cover || bookImg} alt={`book-${book.id}`} className="w-full h-56 object-contain rounded-md mb-3 bg-slate-100 p-2" />
                      <div className="text-sm font-medium text-slate-800 truncate">{book.title}</div>
                      {namesFrom((book as any).authors).length ? (
                        <div className="text-xs text-slate-400 truncate">{namesFrom((book as any).authors).join(", ")}</div>
                      ) : null}
                    </Link>
                  ))}
            </div>
          </div>
        </section>
        ) : (
          playlists.map((pl) => (
            <section key={String(pl.id)} className="mb-6">
              <h2 className="text-2xl font-semibold text-slate-800">{pl.title}</h2>
              <div className="text-sm text-slate-500 mt-1">{pl.description || "Recommended for You"}</div>
              {error && <div className="text-red-600 mt-2">Failed to load: {error}</div>}

              <div className="mt-4">
                <div className="grid sm:hidden grid-cols-2 gap-3">
                  {(pl.books || []).slice(0,7).map((book) => (
                    <Link
                      to={`/catalog/${book.id}`}
                      key={`m-${pl.id}-${String(book.id)}`}
                      className="block w-full bg-white border border-gray-100 rounded-lg p-3 text-center shadow-sm hover:shadow-md transition-shadow"
                    >
                      <img src={book.cover || bookImg} alt={`book-${book.id}`} className="w-full h-40 object-contain rounded-md mb-2 bg-slate-100 p-1" />
                      <div className="text-sm font-medium text-slate-800 truncate">{book.title}</div>
                      {namesFrom((book as any).authors).length ? (
                        <div className="text-xs text-slate-400 truncate">{namesFrom((book as any).authors).join(", ")}</div>
                      ) : null}
                    </Link>
                  ))}
                </div>

                <div className="hidden sm:grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-4">
                  {(pl.books || []).slice(0,7).map((book) => (
                    <Link
                      to={`/catalog/${book.id}`}
                      key={`g-${pl.id}-${String(book.id)}`}
                      className="block bg-white border border-gray-100 rounded-lg p-3 text-center shadow-sm hover:shadow-md transition-shadow"
                    >
                      <img src={book.cover || bookImg} alt={`book-${book.id}`} className="w-full h-56 object-contain rounded-md mb-3 bg-slate-100 p-2" />
                      <div className="text-sm font-medium text-slate-800 truncate">{book.title}</div>
                      {namesFrom((book as any).authors).length ? (
                        <div className="text-xs text-slate-400 truncate">{namesFrom((book as any).authors).join(", ")}</div>
                      ) : null}
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          ))
        )}
      </div>
    </>
  );
}
