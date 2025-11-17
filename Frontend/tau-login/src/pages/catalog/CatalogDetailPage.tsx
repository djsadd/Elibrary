import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import DashboardHeader from "@/components/layout/DashboardHeader";
import { t } from "@/shared/i18n";
import { api } from "@/shared/api/client";
import placeholder from "@/assets/images/Image.png";
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
  authors?: any[];
  subjects?: any[];
  formats?: string[] | null;
};

type Review = { id: string; rating: number; text: string; author?: string; created_at: string };

export default function CatalogDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favorite, setFavorite] = useState(false);
  const [tab, setTab] = useState<"overview" | "details" | "reviews" | "related" | "lists">("overview");

  const [readingCount, setReadingCount] = useState<{ currently_reading: number; have_read: number }>({
    currently_reading: 0,
    have_read: 0,
  });
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState<number>(0);
  const [reviewText, setReviewText] = useState<string>("");

  const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

  function humanizeFormat(val?: string | null): string {
    const v = String(val || "").toUpperCase();
    if (!v) return "-";
    const map: Record<string, string> = {
      EBOOK: "E-Book",
      HARDCOPY: "Hardbook",
      AUDIOBOOK: "Audio book",
      ARTICLE: "Article",
      VIDEOBOOK: "Video book",
      INTERACTIVE: "Interactive",
    };
    return map[v] || (v.charAt(0) + v.slice(1).toLowerCase());
  }

  const humanizeFormatList = (vals?: any) => {
    const arr: string[] = Array.isArray(vals) ? vals : vals ? [vals] : [];
    if (!arr.length) return "-";
    return arr.map((v) => humanizeFormat(v)).join(", ");
  };

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = (await api(`/api/catalog/books/${id}`)) as Book;
        if (!cancelled) setBook(data);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const stats = (await api(`/api/catalog/userbook/reading_count/${id}`)) as {
          currently_reading?: number;
          have_read?: number;
        };
        if (!cancelled)
          setReadingCount({
            currently_reading: Number(stats?.currently_reading ?? 0),
            have_read: Number(stats?.have_read ?? 0),
          });
      } catch (e: any) {
        if (!cancelled) {
          try {
            console.warn("[CatalogDetail] reading_count failed:", e?.message || String(e));
          } catch {}
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    try {
      const favs = JSON.parse(localStorage.getItem("favorites") || "[]");
      const isFav = Array.isArray(favs) && id ? favs.includes(String(id)) : false;
      setFavorite(Boolean(isFav));
    } catch {
      setFavorite(false);
    }
  }, [id]);

  const coverUrl = useMemo(() => (book?.cover ? book.cover : placeholder), [book]);
  const authorNames = useMemo(() => namesFrom((book as any)?.authors), [book]);
  const subjectNames = useMemo(() => namesFrom((book as any)?.subjects), [book]);
  const downloadHref = useMemo(() => {
    if (id) return `${BASE}/api/catalog/books/${id}/download`;
    if (!book?.download_url) return null;
    return book.download_url.startsWith("/") ? `${BASE}${book.download_url}` : book.download_url;
  }, [book, BASE, id]);

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

  async function startReading() {
    if (!id) return;
    navigate(`/reader?book=${encodeURIComponent(String(id))}`);
  }

  return (
    <div>
      <DashboardHeader />
      {error ? (
        <div className="text-red-600">Failed to load: {error}</div>
      ) : loading ? (
        <div className="text-slate-500">Loading…</div>
      ) : book ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: cover */}
            <div className="lg:col-span-3">
              <div className="bg-white rounded-xl border shadow-sm p-4 flex flex-col items-center">
                <div className="w-full flex justify-center">
                  <img
                    src={coverUrl}
                    alt="cover"
                    className="max-h-80 w-auto object-contain rounded-md bg-slate-100 p-2"
                  />
                </div>
                <div className="mt-4 w-full border-t pt-3">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <button
                      type="button"
                      onClick={() => setTab("reviews")}
                      className="group flex flex-col items-center py-2 hover:text-[#7b0f2b]"
                    >
                      <svg
                        className="w-7 h-7 text-slate-700 group-hover:text-[#7b0f2b]"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                      >
                        <path d="M4 4h16v12H7l-3 3V4z" />
                        <path d="M14 8l-4 4" />
                        <path d="M10 8l4 4" />
                      </svg>
                      <div className="mt-1 text-xs text-slate-700">{t("catalog.actions.review")}</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/catalog/${id}/notes`)}
                      className="group flex flex-col items-center py-2 hover:text-[#7b0f2b]"
                    >
                      <svg
                        className="w-7 h-7 text-slate-700 group-hover:text-[#7b0f2b]"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                      >
                        <rect x="4" y="3" width="16" height="18" rx="2" />
                        <path d="M8 7h8" />
                        <path d="M8 11h8" />
                      </svg>
                      <div className="mt-1 text-xs text-slate-700">{t("catalog.actions.notes")}</div>
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const url = window.location.href;
                          const text = `${book?.title || "Book"} — ${url}`;
                          if (navigator.share) {
                            await navigator.share({ title: book?.title || "Book", url, text });
                          } else {
                            await navigator.clipboard.writeText(url);
                            alert("Link copied");
                          }
                        } catch {}
                      }}
                      className="group flex flex-col items-center py-2 hover:text-[#7b0f2b]"
                    >
                      <svg
                        className="w-7 h-7 text-slate-700 group-hover:text-[#7b0f2b]"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                      >
                        <circle cx="18" cy="5" r="2" />
                        <circle cx="6" cy="12" r="2" />
                        <circle cx="18" cy="19" r="2" />
                        <path d="M8 12h8" />
                        <path d="M16 7l-8 4" />
                        <path d="M8 16l8 3" />
                      </svg>
                      <div className="mt-1 text-xs text-slate-700">{t("catalog.actions.share")}</div>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Middle: title and actions */}
            <div className="lg:col-span-6 space-y-2">
              <h1 className="text-2xl font-semibold text-slate-800">{book.title}</h1>
              {authorNames.length ? (
                <div className="text-slate-600">
                  By {authorNames.join(", ")}
                  {book.year ? `, ${book.year}` : ""}
                </div>
              ) : (
                <div className="text-slate-600">{book.year ?? ""}</div>
              )}
              <div className="text-xs text-slate-500">{t("catalog.secondEdition")}</div>

              {/* Ratings and counters */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 mt-2">
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <svg
                      key={i}
                      viewBox="0 0 24 24"
                      className="w-4 h-4 text-amber-500"
                      fill="currentColor"
                    >
                      <path d="M12 17.3l-5.2 3.1 1.4-5.9L3 9.8l6-.5L12 3l3 6.3 6 .5-5.2 4.7 1.4 5.9z" />
                    </svg>
                  ))}
                  <span className="ml-1">5.0 Ratings</span>
                </div>
                <div>
                  {readingCount.currently_reading} {t("catalog.currentlyReading")}
                </div>
                <div>
                  {readingCount.have_read} {t("catalog.haveRead")}
                </div>
              </div>

              {/* Availability and status chips (from API formats) */}
              <div className="flex flex-wrap items-center gap-3 mt-3 text-sm">
                {Array.isArray(book.formats) && book.formats.length ? (
                  <div className="flex items-center gap-2">
                    {book.formats.map((f, i) => (
                      <span key={`${f}-${i}`} className="inline-flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        {humanizeFormat(f)}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              {/* Actions */}
              <div className="mt-4 flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3">
                <button
                  onClick={startReading}
                  className="px-4 py-2.5 bg-orange-500 text-white rounded-md w-full sm:w-auto text-sm inline-flex items-center justify-center gap-2"
                >
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path d="M3 6.5A2.5 2.5 0 0 1 5.5 4H12v16H5.5A2.5 2.5 0 0 1 3 17.5v-11z" />
                    <path d="M21 6.5A2.5 2.5 0 0 0 18.5 4H12v16h6.5A2.5 2.5 0 0 0 21 17.5v-11z" />
                  </svg>
                  <span>{t("catalog.readOnline")}</span>
                </button>
                <button
                  type="button"
                  onClick={toggleFavorite}
                  className={`px-4 py-2.5 rounded-md border w-full sm:w-auto text-sm inline-flex items-center justify-center gap-2 ${
                    favorite
                      ? "bg-rose-50 text-rose-600 border-rose-300"
                      : "bg-white text-slate-700 border-slate-300"
                  }`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className={
                      favorite
                        ? "w-4 h-4 text-rose-600 fill-rose-600"
                        : "w-4 h-4 text-slate-500"
                    }
                    fill={favorite ? "currentColor" : "none"}
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.41 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.41 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                  <span>{favorite ? t("catalog.removeFav") : t("catalog.addFav")}</span>
                </button>
                {/* Removed Open Reader and Download PDF buttons per request */}
              </div>
            </div>

            {/* Right: about author */}
            <aside className="lg:col-span-3 bg-white border rounded-md p-4 h-max">
              <div className="text-[#EB5231] font-semibold mb-1">{t("catalog.aboutAuthor")}</div>
              <div className="text-slate-800 font-medium">{authorNames[0] || "Unknown"}</div>
              <p className="text-sm text-slate-600 mt-2">Author bio is not provided.</p>
            </aside>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-md p-0">
            <div className="px-4 sm:px-6 pt-4 border-b overflow-x-auto">
              <div className="flex items-center gap-6 text-sm whitespace-nowrap">
                {(
                  [
                    ["overview", "Overview"],
                    ["details", "Details"],
                    ["reviews", "Reviews"],
                    ["lists", "Lists"],
                    ["related", "Related"],
                  ] as [typeof tab, string][]
                ).map(([key]) => (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    className={`py-3 -mb-px border-b-2 ${
                      tab === key
                        ? "border-[#7b0f2b] text-[#7b0f2b]"
                        : "border-transparent text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {t(`catalog.tabs.${key}`)}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 sm:p-6">
              {tab === "overview" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
                    <div className="bg-white border rounded-md p-3">
                      <div className="text-xs text-slate-500 mb-1">
                        {t("catalog.fields.publishDate")}
                      </div>
                      <div className="text-sm text-slate-800">{book.year || "-"}</div>
                    </div>
                    <div className="bg-white border rounded-md p-3">
                      <div className="text-xs text-slate-500 mb-1">
                        {t("catalog.fields.publisher")}
                      </div>
                      <div className="text-sm text-slate-800">{book.pub_info || "-"}</div>
                    </div>
                    <div className="bg-white border rounded-md p-3">
                      <div className="text-xs text-slate-500 mb-1">
                        {t("catalog.fields.language")}
                      </div>
                      <div className="text-sm text-slate-800">{book.lang || "-"}</div>
                    </div>
                    <div className="bg-white border rounded-md p-3">
                      <div className="text-xs text-slate-500 mb-1">
                        {t("catalog.fields.formats")}
                      </div>
                      <div className="text-sm text-slate-800">
                        {humanizeFormatList(book.formats)}
                      </div>
                    </div>
                  </div>
                  {book.summary && (
                    <div className="text-slate-700 whitespace-pre-line text-sm sm:text-base">
                      {book.summary}
                    </div>
                  )}
                </div>
              )}

              {tab === "details" && (
                <div className="text-sm">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                    <div>
                      <span className="text-slate-500">ID:</span>{" "}
                      <span className="text-slate-800">{String(book.id)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Title:</span>{" "}
                      <span className="text-slate-800">{book.title}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Year:</span>{" "}
                      <span className="text-slate-800">{book.year || "-"}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Language:</span>{" "}
                      <span className="text-slate-800">{book.lang || "-"}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Publisher:</span>{" "}
                      <span className="text-slate-800">{book.pub_info || "-"}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Formats:</span>{" "}
                      <span className="text-slate-800">
                        {humanizeFormatList(book.formats)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Authors:</span>{" "}
                      <span className="text-slate-800">
                        {authorNames.join(", ") || "-"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Subjects:</span>{" "}
                      <span className="text-slate-800">
                        {subjectNames.join(", ") || "-"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">File ID:</span>{" "}
                      <span className="text-slate-800">{book.file_id || "-"}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Download URL:</span>{" "}
                      <span className="text-slate-800">
                        {book.download_url || "-"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {tab === "reviews" && (
                <div className="space-y-6">
                  <div>
                    <div className="text-base font-medium text-slate-800 mb-2">Reviews</div>
                    {reviews.length === 0 ? (
                      <div className="text-slate-600 text-sm">
                        No reviews yet. Be the first to review this book.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {reviews.map((r) => (
                          <div key={r.id} className="border rounded-md p-3 bg-white">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1 text-amber-500">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <svg
                                    key={i}
                                    viewBox="0 0 24 24"
                                    className={`w-4 h-4 ${
                                      i < r.rating ? "fill-current" : ""
                                    }`}
                                    fill={i < r.rating ? "currentColor" : "none"}
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                  >
                                    <path d="M12 17.3l-5.2 3.1 1.4-5.9L3 9.8l6-0.5L12 3l3 6.3 6 0.5-5.2 4.7 1.4 5.9z" />
                                  </svg>
                                ))}
                              </div>
                              <div className="text-xs text-slate-500">
                                {new Date(r.created_at).toLocaleString()}
                              </div>
                            </div>
                            <div className="mt-2 text-sm text-slate-800 whitespace-pre-line">
                              {r.text}
                            </div>
                            {r.author && (
                              <div className="mt-1 text-xs text-slate-500">
                                — {r.author}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <form
                    className="border rounded-md p-4 bg-white"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const rt = Math.max(0, Math.min(5, rating));
                      const txt = reviewText.trim();
                      if (!rt) return alert("Select rating");
                      if (!txt) return alert("Write a short review");
                      const next: Review = {
                        id: crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()),
                        rating: rt,
                        text: txt,
                        author: "You",
                        created_at: new Date().toISOString(),
                      };
                      const arr = [next, ...reviews];
                      setReviews(arr);
                      setRating(0);
                      setReviewText("");
                      try {
                        const body = { rating: rt, comment: txt, book_id: Number(id) } as any;
                        const resp = (await api(`/api/reviews`, {
                          method: "POST",
                          body: JSON.stringify(body),
                        })) as any;
                        try {
                          console.info("[CatalogDetail] POST /api/reviews response:", resp);
                        } catch {}
                      } catch (err: any) {
                        try {
                          console.warn(
                            "[CatalogDetail] POST /api/reviews failed:",
                            err?.message || String(err)
                          );
                        } catch {}
                      }
                    }}
                  >
                    <div className="text-base font-medium text-slate-800 mb-3">
                      Write a review
                    </div>
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
                            aria-label={`Rate ${idx} star${idx > 1 ? "s" : ""}`}
                          >
                            <svg
                              viewBox="0 0 24 24"
                              className={`w-6 h-6 ${
                                active
                                  ? "text-amber-500 fill-amber-500"
                                  : "text-slate-400"
                              }`}
                              fill={active ? "currentColor" : "none"}
                              stroke="currentColor"
                              strokeWidth="1.5"
                            >
                              <path d="M12 17.3l-5.2 3.1 1.4-5.9L3 9.8l6-0.5L12 3l3 6.3 6 0.5-5.2 4.7 1.4 5.9z" />
                            </svg>
                          </button>
                        );
                      })}
                    </div>
                    <textarea
                      value={reviewText}
                      onChange={(e) => setReviewText(e.target.value)}
                      placeholder="Share your thoughts about this book"
                      className="w-full border rounded-md px-3 py-2 h-28"
                    />
                    <div className="mt-3">
                      <button
                        type="submit"
                        className="px-4 py-2 bg-[#7b0f2b] text-white rounded-md"
                      >
                        Submit review
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {tab === "lists" && (
                <div className="text-slate-600 text-sm">
                  This book is not in any lists yet.
                </div>
              )}

              {tab === "related" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="border rounded-md p-3">
                      <div className="text-sm font-medium text-slate-800">
                        Related Book #{i}
                      </div>
                      <div className="text-xs text-slate-500">Placeholder</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

