import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import DashboardHeader from "@/components/layout/DashboardHeader";
import { api } from "@/shared/api/client";
import placeholder from "@/assets/images/image.png";
import { namesFrom } from "@/shared/ui/text";

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

type Review = { id: string; rating: number; text: string; author?: string; created_at: string };

export default function CatalogDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favorite, setFavorite] = useState(false);
  const [tab, setTab] = useState<"overview" | "editions" | "details" | "reviews" | "lists" | "related">("overview");

  const [reviews, setReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState<number>(0);
  const [reviewText, setReviewText] = useState<string>("");

  const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

  useEffect(() => {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    console.info("[CatalogDetailPage] Bearer token:", token);
  }, []);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await api<Book>(`/api/catalog/books/${id}`);
        if (!cancelled) setBook(data);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    // load favorites
    try {
      const favs = JSON.parse(localStorage.getItem("favorites") || "[]");
      const isFav = Array.isArray(favs) && id ? favs.includes(String(id)) : false;
      setFavorite(Boolean(isFav));
    } catch {
      setFavorite(false);
    }
  }, [id]);

  useEffect(() => {
    // load reviews by book
    if (!id) return;
    try {
      const raw = localStorage.getItem(`reviews:${id}`);
      const arr = raw ? JSON.parse(raw) : [];
      setReviews(Array.isArray(arr) ? arr : []);
    } catch {
      setReviews([]);
    }
  }, [id]);

  const saveReviews = (arr: Review[]) => {
    try { localStorage.setItem(`reviews:${id}`, JSON.stringify(arr)); } catch {}
  };

  const toggleFavorite = () => {
    try {
      const key = "favorites";
      const raw = localStorage.getItem(key);
      const arr: string[] = raw ? JSON.parse(raw) : [];
      const sid = String(id ?? "");
      const next = arr.includes(sid) ? arr.filter((x) => x !== sid) : [...arr, sid];
      localStorage.setItem(key, JSON.stringify(next));
      setFavorite(next.includes(sid));
    } catch {}
  };

  const coverUrl = useMemo(() => {
    if (!book?.cover) return placeholder;
    return book.cover;
  }, [book]);

  const downloadHref = useMemo(() => {
    if (id) return `${BASE}/api/catalog/books/${id}/download`;
    if (!book?.download_url) return null;
    return book.download_url.startsWith("/") ? `${BASE}${book.download_url}` : book.download_url;
  }, [book, BASE, id]);

  const authorNames = useMemo(() => namesFrom((book as any)?.authors), [book]);
  const subjectNames = useMemo(() => namesFrom((book as any)?.subjects), [book]);

  async function startReading() {
    if (!id) return;
    // No userbook calls: just navigate to reader
    navigate(`/reader?book=${encodeURIComponent(String(id))}`);
  }

  return (
    <div className="space-y-4">
      <DashboardHeader />
      {loading && <div className="text-slate-500">Loading...</div>}
      {error && <div className="text-red-600">Failed to load: {error}</div>}
      {!loading && !error && book && (
        <div className="space-y-4">
          <div className="text-sm text-slate-500">
            <Link to="/catalog" className="hover:underline">Back to results</Link>
          </div>

          <div className="bg-white rounded-md p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: cover and quick actions */}
            <div className="lg:col-span-3">
              <div className="bg-slate-100 rounded-md p-2 flex items-center justify-center">
                <img src={coverUrl} alt={book.title} className="w-full max-w-xs object-contain" />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs text-slate-600">
                <button type="button" className="border rounded-md py-3 flex flex-col items-center gap-1 hover:bg-slate-50">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M4 5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H8l-4 3V5z" />
                    <path d="M8 7h7M8 10h7M8 13h5" />
                  </svg>
                  <span>Review</span>
                </button>
                <button type="button" className="border rounded-md py-3 flex flex-col items-center gap-1 hover:bg-slate-50">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M4 5a2 2 0 0 1 2-2h8l4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5z" />
                    <path d="M9 14l6-6" />
                    <path d="M13 14h-4v-4" />
                  </svg>
                  <span>Notes</span>
                </button>
                <button type="button" className="border rounded-md py-3 flex flex-col items-center gap-1 hover:bg-slate-50">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <circle cx="6" cy="12" r="2" />
                    <circle cx="18" cy="6" r="2" />
                    <circle cx="18" cy="18" r="2" />
                    <path d="M8 12l8-6M8 12l8 6" />
                  </svg>
                  <span>Share</span>
                </button>
              </div>
            </div>

            {/* Middle: title and actions */}
            <div className="lg:col-span-6 space-y-2">
              <h1 className="text-2xl font-semibold text-slate-800">{book.title}</h1>
              {authorNames.length ? (
                <div className="text-slate-600">By {authorNames.join(", ")}{book.year ? `, ${book.year}` : ""}</div>
              ) : (
                <div className="text-slate-600">{book.year ?? ""}</div>
              )}
              <div className="text-xs text-slate-500">Second Edition</div>

              {/* Ratings and counters (placeholders) */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 mt-2">
                <div className="flex items-center gap-1">★★★★★ <span className="ml-1">5.0 Ratings</span></div>
                <div>25 Currently reading</div>
                <div>119 Have read</div>
              </div>

              {/* Availability and status chips (UI only) */}
              <div className="flex flex-wrap items-center gap-3 mt-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"/>E-Book</span>
                  <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"/>Audio book</span>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-4 flex flex-wrap gap-3">
                <button onClick={startReading} className="px-4 py-2 bg-orange-500 text-white rounded-md">Read Online</button>
                <button
                  type="button"
                  onClick={toggleFavorite}
                  className={`px-4 py-2 rounded-md border ${favorite ? 'bg-rose-50 text-rose-600 border-rose-300' : 'bg-white text-slate-700 border-slate-300'}`}
                >
                  {favorite ? 'Remove from Favorites' : 'Add to Favorites'}
                </button>
                {downloadHref && (
                  <>
                    <button onClick={startReading} className="px-4 py-2 bg-emerald-600 text-white rounded-md">Open Reader</button>
                    <a href={downloadHref} target="_blank" rel="noreferrer" className="px-4 py-2 bg-slate-700 text-white rounded-md">Download PDF</a>
                  </>
                )}
              </div>

            </div>

            {/* Right: about author */}
            <aside className="lg:col-span-3 bg-white border rounded-md p-4 h-max">
              <div className="text-[#EB5231] font-semibold mb-1">About Author</div>
              <div className="text-slate-800 font-medium">{authorNames[0] || 'Unknown'}</div>
              <p className="text-sm text-slate-600 mt-2">Author bio is not provided.</p>
            </aside>
          </div>

          {/* Full-width Tabs below hero */}
          <div className="bg-white rounded-md p-0">
            <div className="px-6 pt-4 border-b">
              <div className="flex items-center gap-6 text-sm">
                {(([
                  ["overview","Overview"],
                  ["editions","Editions"],
                  ["details","Details"],
                  ["reviews","Reviews"],
                  ["lists","Lists"],
                  ["related","Related"],
                ]) as [typeof tab,string][]).map(([key,label]) => (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    className={`py-3 -mb-px border-b-2 ${tab===key ? 'border-[#7b0f2b] text-[#7b0f2b]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                  >{label}</button>
                ))}
              </div>
            </div>

            <div className="p-6">
              {tab === 'overview' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-white border rounded-md p-3">
                      <div className="text-xs text-slate-500 mb-1">Publish Date</div>
                      <div className="text-sm text-slate-800">{book.year || '-'}</div>
                    </div>
                    <div className="bg-white border rounded-md p-3">
                      <div className="text-xs text-slate-500 mb-1">Publisher</div>
                      <div className="text-sm text-slate-800">{book.pub_info || '-'}</div>
                    </div>
                    <div className="bg-white border rounded-md p-3">
                      <div className="text-xs text-slate-500 mb-1">Language</div>
                      <div className="text-sm text-slate-800">{book.lang || '-'}</div>
                    </div>
                    <div className="bg-white border rounded-md p-3">
                      <div className="text-xs text-slate-500 mb-1">Pages</div>
                      <div className="text-sm text-slate-800">-</div>
                    </div>
                  </div>
                  {book.summary && (
                    <div className="text-slate-700 whitespace-pre-line">{book.summary}</div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border rounded-md p-4">
                      <div className="font-medium text-slate-800 mb-2">Book Details</div>
                      <div className="text-sm text-slate-600">Published in -</div>
                    </div>
                    <div className="border rounded-md p-4">
                      <div className="font-medium text-slate-800 mb-2">Community Reviews</div>
                      <div className="text-sm text-slate-600">No reviews yet.</div>
                    </div>
                  </div>
                </div>
              )}

              {tab === 'editions' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[1,2,3].map((i) => (
                    <div key={i} className="border rounded-md p-3">
                      <div className="text-sm font-medium text-slate-800">Edition #{i}</div>
                      <div className="text-xs text-slate-500">Hardcover • 200{i} • English</div>
                    </div>
                  ))}
                </div>
              )}

              {tab === 'details' && (
                <div className="text-sm">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                    <div><span className="text-slate-500">ID:</span> <span className="text-slate-800">{String(book.id)}</span></div>
                    <div><span className="text-slate-500">Title:</span> <span className="text-slate-800">{book.title}</span></div>
                    <div><span className="text-slate-500">Year:</span> <span className="text-slate-800">{book.year || '-'}</span></div>
                    <div><span className="text-slate-500">Language:</span> <span className="text-slate-800">{book.lang || '-'}</span></div>
                    <div><span className="text-slate-500">Publisher:</span> <span className="text-slate-800">{book.pub_info || '-'}</span></div>
                    <div><span className="text-slate-500">Authors:</span> <span className="text-slate-800">{authorNames.join(', ') || '-'}</span></div>
                    <div><span className="text-slate-500">Subjects:</span> <span className="text-slate-800">{subjectNames.join(', ') || '-'}</span></div>
                    <div><span className="text-slate-500">File ID:</span> <span className="text-slate-800">{book.file_id || '-'}</span></div>
                    <div><span className="text-slate-500">Download URL:</span> <span className="text-slate-800">{book.download_url || '-'}</span></div>
                  </div>
                </div>
              )}

              {tab === 'reviews' && (
                <div className="space-y-6">
                  <div>
                    <div className="text-base font-medium text-slate-800 mb-2">Reviews</div>
                    {reviews.length === 0 ? (
                      <div className="text-slate-600 text-sm">No reviews yet. Be the first to review this book.</div>
                    ) : (
                      <div className="space-y-3">
                        {reviews.map((r) => (
                          <div key={r.id} className="border rounded-md p-3 bg-white">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1 text-amber-500">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <svg key={i} viewBox="0 0 24 24" className={`w-4 h-4 ${i < r.rating ? 'fill-current' : ''}`} fill={i < r.rating ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5"><path d="M12 17.3l-5.2 3.1 1.4-5.9L3 9.8l6-0.5L12 3l3 6.3 6 0.5-5.2 4.7 1.4 5.9z"/></svg>
                                ))}
                              </div>
                              <div className="text-xs text-slate-500">{new Date(r.created_at).toLocaleString()}</div>
                            </div>
                            <div className="mt-2 text-sm text-slate-800 whitespace-pre-line">{r.text}</div>
                            {r.author && <div className="mt-1 text-xs text-slate-500">— {r.author}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <form
                    className="border rounded-md p-4 bg-white"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const rt = Math.max(0, Math.min(5, rating));
                      const txt = reviewText.trim();
                      if (!rt) return alert('Select rating');
                      if (!txt) return alert('Write a short review');
                      const next: Review = {
                        id: (crypto as any)?.randomUUID ? (crypto as any).randomUUID() : String(Date.now()),
                        rating: rt,
                        text: txt,
                        author: 'You',
                        created_at: new Date().toISOString(),
                      };
                      const arr = [next, ...reviews];
                      setReviews(arr);
                      saveReviews(arr);
                      setRating(0);
                      setReviewText('');
                    }}
                  >
                    <div className="text-base font-medium text-slate-800 mb-3">Write a review</div>
                    <div className="flex items-center gap-2 mb-3">
                      {Array.from({ length: 5 }).map((_, i) => {
                        const idx = i + 1;
                        const active = idx <= rating;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setRating(idx)}
                            className="p-1"
                            aria-label={`Rate ${idx} star${idx>1?'s':''}`}
                          >
                            <svg viewBox="0 0 24 24" className={`w-6 h-6 ${active ? 'text-amber-500 fill-amber-500' : 'text-slate-400'}`} fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
                              <path d="M12 17.3l-5.2 3.1 1.4-5.9L3 9.8l6-0.5L12 3l3 6.3 6 0.5-5.2 4.7 1.4 5.9z"/>
                            </svg>
                          </button>
                        );
                      })}
                    </div>
                    <textarea
                      value={reviewText}
                      onChange={(e)=>setReviewText(e.target.value)}
                      placeholder="Share your thoughts about this book"
                      className="w-full border rounded-md px-3 py-2 h-28"
                    />
                    <div className="mt-3">
                      <button type="submit" className="px-4 py-2 bg-[#7b0f2b] text-white rounded-md">Submit review</button>
                    </div>
                  </form>
                </div>
              )}

              {tab === 'lists' && (
                <div className="text-slate-600 text-sm">This book is not in any lists yet.</div>
              )}

              {tab === 'related' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[1,2].map((i) => (
                    <div key={i} className="border rounded-md p-3">
                      <div className="text-sm font-medium text-slate-800">Related Book #{i}</div>
                      <div className="text-xs text-slate-500">Placeholder</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
