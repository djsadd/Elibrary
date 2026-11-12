import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import DashboardHeader from "@/components/layout/DashboardHeader";
import { getLang, t } from "@/shared/i18n";
import { api } from "@/shared/api/client";
import { getBookRecommendationExplanation, type StudentProfile } from "@/shared/api/search";
import placeholder from "@/assets/images/book-placeholder.svg";
import { displayNamesFrom, namesFrom } from "@/shared/ui/text";

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
  external_url?: string | null;
  source?: string | null;
  authors?: any[];
  subjects?: any[];
  formats?: string[] | null;
};

type Review = { id: string; rating: number; text: string; author?: string; created_at: string };

type AuthProfile = StudentProfile & {
  id: number;
  email?: string | null;
};

const COPY = {
  ru: {
    back: "Каталог", by: "Автор", loading: "Загрузка…", failed: "Не удалось загрузить книгу",
    retry: "Повторить", showMore: "Показать полностью", showLess: "Свернуть",
    noSummary: "Описание пока не добавлено.", subjects: "Темы", ratings: "рейтинг",
    authorBio: "Биография автора не указана.", unknownAuthor: "Автор не указан",
    aiSearch: "Интеллектуальный поиск", aiPlaceholder: "Найти идею, цитату или тему",
    aiHint: "Напишите любой вопрос — позже подключим умный поиск по книге.",
    reviewsEmpty: "Отзывов пока нет. Станьте первым!", writeReview: "Оставить отзыв",
    reviewPlaceholder: "Поделитесь впечатлениями о книге", submitReview: "Отправить",
    selectRating: "Выберите оценку", writeShort: "Напишите короткий отзыв",
    listsEmpty: "Книга пока не добавлена ни в один список.", relatedEmpty: "Похожие книги не найдены.",
    linkCopied: "Ссылка скопирована", you: "Вы",
    aiMatch: "Почему эта книга подходит именно вам", aiQuery: "По вашему запросу:",
    aiLoading: "Подбираем персональное объяснение…", aiNone: "Объяснение пока недоступно.",
    aiDown: "AI временно недоступен:",
  },
  kk: {
    back: "Каталог", by: "Автор", loading: "Жүктелуде…", failed: "Кітапты жүктеу мүмкін болмады",
    retry: "Қайталау", showMore: "Толық көрсету", showLess: "Жасыру",
    noSummary: "Сипаттама әлі қосылмаған.", subjects: "Тақырыптар", ratings: "рейтинг",
    authorBio: "Автордың өмірбаяны көрсетілмеген.", unknownAuthor: "Автор көрсетілмеген",
    aiSearch: "Зияткерлік іздеу", aiPlaceholder: "Идея, дәйексөз немесе тақырып табу",
    aiHint: "Кез келген сұрақ жазыңыз — кейін кітап бойынша ақылды іздеуді қосамыз.",
    reviewsEmpty: "Пікірлер әлі жоқ. Бірінші болыңыз!", writeReview: "Пікір қалдыру",
    reviewPlaceholder: "Кітап туралы ойыңызбен бөлісіңіз", submitReview: "Жіберу",
    selectRating: "Бағаны таңдаңыз", writeShort: "Қысқа пікір жазыңыз",
    listsEmpty: "Кітап әлі ешбір тізімге қосылмаған.", relatedEmpty: "Ұқсас кітаптар табылмады.",
    linkCopied: "Сілтеме көшірілді", you: "Сіз",
    aiMatch: "Бұл кітап сізге неге сәйкес келеді", aiQuery: "Сіздің сұрауыңыз бойынша:",
    aiLoading: "Жеке түсініктеме дайындалуда…", aiNone: "Түсініктеме әзірге қолжетімсіз.",
    aiDown: "AI уақытша қолжетімсіз:",
  },
  en: {
    back: "Catalog", by: "By", loading: "Loading…", failed: "Failed to load the book",
    retry: "Retry", showMore: "Show more", showLess: "Show less",
    noSummary: "No description yet.", subjects: "Subjects", ratings: "rating",
    authorBio: "Author bio is not provided.", unknownAuthor: "Unknown author",
    aiSearch: "Smart search", aiPlaceholder: "Find an idea, quote or topic",
    aiHint: "Ask anything — smart in-book search is coming soon.",
    reviewsEmpty: "No reviews yet. Be the first to review this book.", writeReview: "Write a review",
    reviewPlaceholder: "Share your thoughts about this book", submitReview: "Submit review",
    selectRating: "Select rating", writeShort: "Write a short review",
    listsEmpty: "This book is not in any lists yet.", relatedEmpty: "No related books found.",
    linkCopied: "Link copied", you: "You",
    aiMatch: "Why this book fits you", aiQuery: "For your query:",
    aiLoading: "Preparing a personal explanation…", aiNone: "Explanation is not available yet.",
    aiDown: "AI is temporarily unavailable:",
  },
} as const;

const STAR_PATH = "M12 17.3l-5.2 3.1 1.4-5.9L3 9.8l6-.5L12 3l3 6.3 6 .5-5.2 4.7 1.4 5.9z";

function getApiBase(): string {
  const raw = import.meta.env.VITE_API_URL as string | undefined;
  if (raw && /^https?:\/\//i.test(raw)) return raw.replace(/\/$/, "");
  return window.location.origin;
}

export default function CatalogDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favorite, setFavorite] = useState(false);
  const [tab, setTab] = useState<"overview" | "details" | "reviews" | "related" | "lists">("overview");
  const [related, setRelated] = useState<Book[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [relatedError, setRelatedError] = useState<string | null>(null);
  const [llmExplanation, setLlmExplanation] = useState<string | null>(null);
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState<string | null>(null);

  const [readingCount, setReadingCount] = useState<{ currently_reading: number; have_read: number }>({
    currently_reading: 0,
    have_read: 0,
  });
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState<number>(0);
  const [reviewText, setReviewText] = useState<string>("");
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const tabsRef = useRef<HTMLDivElement | null>(null);
  const L = COPY[getLang()] || COPY.ru;

  const openTab = (next: typeof tab) => {
    setTab(next);
    requestAnimationFrame(() => tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const BASE = getApiBase();
  const openedFromVectorSearch = searchParams.get("from") === "vector-search";
  const vectorSearchQuery = (searchParams.get("q") || "").trim();

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
    if (!book || !openedFromVectorSearch) {
      setLlmExplanation(null);
      setLlmError(null);
      setLlmLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      try {
        setLlmLoading(true);
        setLlmError(null);

        let profile: AuthProfile | null = null;
        try {
          profile = await api<AuthProfile>("/api/auth/profile", { signal: controller.signal });
        } catch {}

        const result = await getBookRecommendationExplanation(
          {
            book: {
              id: Number(book.id),
              title: book.title,
              authors: namesFrom(book.authors),
              subjects: namesFrom(book.subjects),
              lang: book.lang || null,
              year: book.year || null,
              summary: book.summary || null,
              cover: book.cover || null,
              popularity: 0,
            },
            student_query: vectorSearchQuery || undefined,
            student_profile: profile
              ? {
                  first_name: profile.first_name || null,
                  last_name: profile.last_name || null,
                  role: profile.role || null,
                  faculty: profile.faculty || null,
                  group_name: profile.group_name || null,
                  institution: profile.institution || null,
                }
              : null,
          },
          { signal: controller.signal }
        );

        if (!cancelled) {
          setLlmExplanation(result.explanation || null);
        }
      } catch (e: any) {
        if (!cancelled) {
          setLlmError(e?.message || String(e));
          setLlmExplanation(null);
        }
      } finally {
        if (!cancelled) setLlmLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [book, openedFromVectorSearch, vectorSearchQuery]);

  useEffect(() => {
    if (!id) return;
    if (tab !== "related") return;
    let cancelled = false;
    (async () => {
      try {
        setRelatedLoading(true);
        setRelatedError(null);
        const items = (await api(`/api/catalog/books/${id}/related?limit=10`)) as any[];
        if (cancelled) return;
        setRelated(Array.isArray(items) ? (items as any) : []);
      } catch (e: any) {
        if (!cancelled) setRelatedError(e?.message || String(e));
      } finally {
        if (!cancelled) setRelatedLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, tab]);

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
    if (!id) return;
    let cancelled = false;
    const sid = String(id);
    // quick local cache first
    try {
      const favs = JSON.parse(localStorage.getItem("favorites") || "[]");
      const isFav = Array.isArray(favs) && sid ? favs.includes(sid) : false;
      if (!cancelled) setFavorite(Boolean(isFav));
    } catch {
      if (!cancelled) setFavorite(false);
    }
    // then sync with API
    (async () => {
      try {
        const list = (await api<any[]>("/api/favourites")) || [];
        if (cancelled) return;
        const ids = new Set(
          list
            .map((f) => f?.book_id)
            .filter((v) => v != null)
            .map(String)
        );
        setFavorite(ids.has(sid));
        try { localStorage.setItem("favorites", JSON.stringify(Array.from(ids))); } catch {}
      } catch (e: any) {
        if (!cancelled) {
          try {
            console.warn("[CatalogDetail] favourites fetch failed:", e?.message || String(e));
          } catch {}
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const coverUrl = useMemo(() => (book?.cover ? book.cover : placeholder), [book]);
  const authorNames = useMemo(() => displayNamesFrom((book as any)?.authors), [book, getLang()]);
  const subjectNames = useMemo(() => displayNamesFrom((book as any)?.subjects), [book, getLang()]);
  const downloadHref = useMemo(() => {
    if (id) return `${BASE}/api/catalog/books/${id}/download`;
    if (!book?.download_url) return null;
    return book.download_url.startsWith("/") ? `${BASE}${book.download_url}` : book.download_url;
  }, [book, BASE, id]);

  const toggleFavorite = async () => {
    if (!id) return;
    const sid = String(id);
    const wasFav = favorite;
    const nextFav = !wasFav;
    setFavorite(nextFav);
    try {
      const key = "favorites";
      const raw = localStorage.getItem(key);
      const arr: string[] = raw ? JSON.parse(raw) : [];
      const next = nextFav ? Array.from(new Set([...arr, sid])) : arr.filter((x) => x !== sid);
      try { localStorage.setItem(key, JSON.stringify(next)); } catch {}

      // backend: POST on add, DELETE /{book_id} on remove
      if (nextFav) {
        await api<any>(`/api/favourites/`, {
          method: "POST",
          body: JSON.stringify({ book_id: Number(id) }),
        });
      } else {
        await api<any>(`/api/favourites/${Number(id)}`, {
          method: "DELETE",
        });
      }
    } catch (err) {
      // revert on failure
      setFavorite(wasFav);
      try {
        const key = "favorites";
        const raw = localStorage.getItem(key);
        const arr: string[] = raw ? JSON.parse(raw) : [];
        const reverted = wasFav ? Array.from(new Set([...arr, sid])) : arr.filter((x) => x !== sid);
        localStorage.setItem(key, JSON.stringify(reverted));
      } catch {}
      try {
        console.warn("[CatalogDetail] favourite toggle failed:", (err as any)?.message || String(err));
      } catch {}
    }
  };

  const externalHref = useMemo(() => {
    const raw = (book?.external_url || "").trim();
    return /^https?:\/\//i.test(raw) ? raw : null;
  }, [book]);
  const hasLocalFile = Boolean(book?.file_id);

  async function startReading() {
    if (!id) return;
    navigate(`/reader?book=${encodeURIComponent(String(id))}`);
  }

  async function shareBook() {
    try {
      const url = window.location.href;
      const title = book?.title || "Book";
      if (navigator.share) {
        await navigator.share({ title, url, text: `${title} — ${url}` });
      } else {
        await navigator.clipboard.writeText(url);
        setShareNotice(L.linkCopied);
        window.setTimeout(() => setShareNotice(null), 2200);
      }
    } catch {}
  }

  async function submitReview(e: { preventDefault: () => void }) {
    e.preventDefault();
    const rt = Math.max(0, Math.min(5, rating));
    const txt = reviewText.trim();
    if (!rt) return alert(L.selectRating);
    if (!txt) return alert(L.writeShort);
    const next: Review = {
      id: crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()),
      rating: rt,
      text: txt,
      author: L.you,
      created_at: new Date().toISOString(),
    };
    setReviews([next, ...reviews]);
    setRating(0);
    setReviewText("");
    try {
      const body = { rating: rt, comment: txt, book_id: Number(id) } as any;
      const resp = (await api(`/api/reviews`, { method: "POST", body: JSON.stringify(body) })) as any;
      try { console.info("[CatalogDetail] POST /api/reviews response:", resp); } catch {}
    } catch (err: any) {
      try { console.warn("[CatalogDetail] POST /api/reviews failed:", err?.message || String(err)); } catch {}
    }
  }

  const externalHost = useMemo(() => {
    if (!externalHref) return null;
    try { return new URL(externalHref).hostname; } catch { return externalHref; }
  }, [externalHref]);
  const canReadLocally = hasLocalFile || !externalHref;
  const summaryIsLong = (book?.summary || "").length > 600;
  const formatList: string[] = Array.isArray(book?.formats) ? (book!.formats as string[]) : [];

  const facts: [string, string][] = book
    ? [
        [t("catalog.fields.publishDate"), book.year || "—"],
        [t("catalog.fields.publisher"), book.pub_info || "—"],
        [t("catalog.fields.language"), book.lang || "—"],
        [t("catalog.fields.formats"), humanizeFormatList(book.formats)],
      ]
    : [];

  const icons = {
    read: (
      <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M3 6.5A2.5 2.5 0 0 1 5.5 4H12v16H5.5A2.5 2.5 0 0 1 3 17.5v-11z" />
        <path d="M21 6.5A2.5 2.5 0 0 0 18.5 4H12v16h6.5A2.5 2.5 0 0 0 21 17.5v-11z" />
      </svg>
    ),
    external: (
      <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M14 4h6v6" />
        <path d="M20 4l-9 9" />
        <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
      </svg>
    ),
    heart: (
      <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill={favorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.41 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.41 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      </svg>
    ),
    review: (
      <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
        <path d="M4 4h16v12H7l-3 3V4z" />
        <path d="M8 9h8M8 12h5" />
      </svg>
    ),
    notes: (
      <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 7h8M8 11h8M8 15h5" />
      </svg>
    ),
    share: (
      <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
        <circle cx="18" cy="5" r="2.2" />
        <circle cx="6" cy="12" r="2.2" />
        <circle cx="18" cy="19" r="2.2" />
        <path d="M8 11l8-5M8 13l8 5" />
      </svg>
    ),
  };

  const Stars = ({ value, size = "w-4 h-4" }: { value: number; size?: string }) => (
    <span className="bd-stars" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} viewBox="0 0 24 24" className={size} fill={i < value ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5">
          <path d={STAR_PATH} />
        </svg>
      ))}
    </span>
  );

  const primaryAction = canReadLocally ? (
    <button type="button" onClick={startReading} className="bd-btn bd-btn--primary">
      {icons.read}
      <span>{t("catalog.readOnline")}</span>
    </button>
  ) : externalHref ? (
    <a href={externalHref} target="_blank" rel="noopener noreferrer" className="bd-btn bd-btn--primary">
      {icons.external}
      <span>{t("bookImport.openExternal")}</span>
    </a>
  ) : null;

  return (
    <div className="book-detail-page bd">
      <DashboardHeader />
      {error ? (
        <div className="bd-state bd-state--error" role="alert">
          <strong>{L.failed}</strong>
          <span>{error}</span>
          <button type="button" className="bd-btn bd-btn--ghost" onClick={() => window.location.reload()}>
            {L.retry}
          </button>
        </div>
      ) : loading ? (
        <div className="bd-skeleton" aria-busy="true" aria-label={L.loading}>
          <div className="bd-skeleton__cover" />
          <div className="bd-skeleton__lines">
            <span style={{ width: "30%" }} />
            <span style={{ width: "85%", height: 34 }} />
            <span style={{ width: "50%" }} />
            <span style={{ width: "65%" }} />
            <span style={{ width: "40%", height: 46, marginTop: 16 }} />
          </div>
        </div>
      ) : book ? (
        <>
          <nav className="bd-crumbs" aria-label="breadcrumb">
            <Link to="/catalog" className="bd-crumbs__back">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              {L.back}
            </Link>
            <span aria-hidden="true">/</span>
            <span className="bd-crumbs__current">{book.title}</span>
          </nav>

          {/* Hero */}
          <section className="bd-hero">
            <div className="bd-cover">
              <img src={coverUrl} alt={book.title} loading="eager" />
              {formatList.length ? (
                <div className="bd-cover__formats">
                  {formatList.map((f, i) => (
                    <span key={`${f}-${i}`}>
                      <i aria-hidden="true" />
                      {humanizeFormat(f)}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="bd-head">
              {subjectNames.length ? (
                <ul className="bd-chips" aria-label={L.subjects}>
                  {subjectNames.slice(0, 4).map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              ) : null}

              <h1>{book.title}</h1>

              <p className="bd-authors">
                {authorNames.length ? (
                  <>
                    <span className="bd-authors__label">{L.by}</span> <strong>{authorNames.join(", ")}</strong>
                  </>
                ) : (
                  <span>{L.unknownAuthor}</span>
                )}
                {book.year ? <span className="bd-authors__year"> · {book.year}</span> : null}
              </p>

              <div className="bd-stats">
                <div className="bd-stat">
                  <Stars value={5} />
                  <span><strong>5.0</strong> {L.ratings}</span>
                </div>
                <div className="bd-stat">
                  <strong>{readingCount.currently_reading}</strong>
                  <span>{t("catalog.currentlyReading")}</span>
                </div>
                <div className="bd-stat">
                  <strong>{readingCount.have_read}</strong>
                  <span>{t("catalog.haveRead")}</span>
                </div>
              </div>

              {externalHost ? (
                <div className="bd-badge">
                  <i aria-hidden="true" />
                  {t("bookImport.externalBadge")}: {externalHost}
                </div>
              ) : null}

              <div className="bd-actions">
                {primaryAction}
                {canReadLocally && externalHref ? (
                  <a href={externalHref} target="_blank" rel="noopener noreferrer" className="bd-btn bd-btn--outline">
                    {icons.external}
                    <span>{t("bookImport.openExternal")}</span>
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={toggleFavorite}
                  aria-pressed={favorite}
                  className={`bd-btn bd-btn--ghost ${favorite ? "is-active" : ""}`}
                >
                  {icons.heart}
                  <span>{favorite ? t("catalog.removeFav") : t("catalog.addFav")}</span>
                </button>
              </div>

              <div className="bd-quick">
                <button type="button" onClick={() => openTab("reviews")}>
                  {icons.review}
                  <span>{t("catalog.actions.review")}</span>
                </button>
                <button type="button" onClick={() => navigate(`/catalog/${id}/notes`)}>
                  {icons.notes}
                  <span>{t("catalog.actions.notes")}</span>
                </button>
                <button type="button" onClick={shareBook}>
                  {icons.share}
                  <span>{shareNotice || t("catalog.actions.share")}</span>
                </button>
              </div>

              {openedFromVectorSearch ? (
                <div className="bd-ai">
                  <div className="bd-ai__head">
                    <div>
                      <div className="bd-ai__eyebrow">AI Match</div>
                      <div className="bd-ai__title">{L.aiMatch}</div>
                    </div>
                    <span className="bd-ai__tag">Vector Search</span>
                  </div>
                  {vectorSearchQuery ? (
                    <div className="bd-ai__query">
                      {L.aiQuery} <strong>{vectorSearchQuery}</strong>
                    </div>
                  ) : null}
                  <p className={llmLoading ? "bd-ai__text is-loading" : "bd-ai__text"}>
                    {llmLoading ? L.aiLoading : llmExplanation || L.aiNone}
                  </p>
                  {llmError ? <div className="bd-ai__error">{L.aiDown} {llmError}</div> : null}
                </div>
              ) : null}
            </div>
          </section>

          {/* Body */}
          <div className="bd-body">
            <div className="bd-main">
              <div className="bd-tabs" ref={tabsRef} role="tablist">
                {(["overview", "details", "reviews", "lists", "related"] as (typeof tab)[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={tab === key}
                    onClick={() => setTab(key)}
                    className={tab === key ? "is-active" : ""}
                  >
                    {t(`catalog.tabs.${key}`)}
                    {key === "reviews" && reviews.length ? <em>{reviews.length}</em> : null}
                  </button>
                ))}
              </div>

              <div className="bd-panel" role="tabpanel">
                {tab === "overview" && (
                  <div className="bd-overview">
                    <dl className="bd-facts">
                      {facts.map(([label, value]) => (
                        <div key={label}>
                          <dt>{label}</dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                    </dl>
                    {book.summary ? (
                      <div>
                        <div className={`bd-summary ${summaryIsLong && !summaryExpanded ? "is-clamped" : ""}`}>
                          {book.summary}
                        </div>
                        {summaryIsLong ? (
                          <button type="button" className="bd-link" onClick={() => setSummaryExpanded((v) => !v)}>
                            {summaryExpanded ? L.showLess : L.showMore}
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      <p className="bd-muted">{L.noSummary}</p>
                    )}
                    {subjectNames.length ? (
                      <div>
                        <h3 className="bd-subhead">{L.subjects}</h3>
                        <ul className="bd-chips bd-chips--plain">
                          {subjectNames.map((s) => (
                            <li key={s}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                )}

                {tab === "details" && (
                  <dl className="bd-details">
                    {(
                      [
                        ["ID", String(book.id)],
                        ["Title", book.title],
                        ["Year", book.year || "—"],
                        ["Language", book.lang || "—"],
                        ["Publisher", book.pub_info || "—"],
                        ["Formats", humanizeFormatList(book.formats)],
                        ["Authors", authorNames.join(", ") || "—"],
                        ["Subjects", subjectNames.join(", ") || "—"],
                        ["File ID", book.file_id || "—"],
                        ["Download URL", book.download_url || "—"],
                      ] as [string, string][]
                    ).map(([label, value]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                )}

                {tab === "reviews" && (
                  <div className="bd-reviews">
                    <form className="bd-review-form" onSubmit={submitReview}>
                      <h3 className="bd-subhead">{L.writeReview}</h3>
                      <div className="bd-rate" role="radiogroup">
                        {Array.from({ length: 5 }).map((_, i) => {
                          const idx = i + 1;
                          const active = idx <= rating;
                          return (
                            <button
                              key={idx}
                              type="button"
                              role="radio"
                              aria-checked={rating === idx}
                              onClick={() => setRating(idx)}
                              className={active ? "is-active" : ""}
                              aria-label={`${idx} / 5`}
                            >
                              <svg viewBox="0 0 24 24" className="w-7 h-7" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5">
                                <path d={STAR_PATH} />
                              </svg>
                            </button>
                          );
                        })}
                      </div>
                      <textarea
                        value={reviewText}
                        onChange={(e) => setReviewText(e.target.value)}
                        placeholder={L.reviewPlaceholder}
                        rows={4}
                      />
                      <button type="submit" className="bd-btn bd-btn--primary">
                        {L.submitReview}
                      </button>
                    </form>

                    {reviews.length === 0 ? (
                      <p className="bd-muted">{L.reviewsEmpty}</p>
                    ) : (
                      <ul className="bd-review-list">
                        {reviews.map((r) => (
                          <li key={r.id}>
                            <div className="bd-review-list__head">
                              <span className="bd-avatar" aria-hidden="true">
                                {(r.author || "?").charAt(0).toUpperCase()}
                              </span>
                              <div>
                                <strong>{r.author || "—"}</strong>
                                <Stars value={r.rating} size="w-3.5 h-3.5" />
                              </div>
                              <time>{new Date(r.created_at).toLocaleDateString()}</time>
                            </div>
                            <p>{r.text}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {tab === "lists" && <p className="bd-muted">{L.listsEmpty}</p>}

                {tab === "related" && (
                  <div>
                    {relatedLoading ? (
                      <div className="bd-related">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <div key={i} className="bd-related__ghost" />
                        ))}
                      </div>
                    ) : relatedError ? (
                      <p className="bd-error">{relatedError}</p>
                    ) : related.length ? (
                      <div className="bd-related">
                        {related.map((b) => {
                          const names = displayNamesFrom((b as any).authors);
                          return (
                            <Link key={String(b.id)} to={`/catalog/${b.id}`} className="bd-related__card">
                              <div className="bd-related__cover">
                                <img src={b.cover || placeholder} alt="" loading="lazy" />
                              </div>
                              <div className="bd-related__title">{b.title}</div>
                              {names.length ? <div className="bd-related__author">{names.join(", ")}</div> : null}
                            </Link>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="bd-muted">{L.relatedEmpty}</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <aside className="bd-aside">
              <section className="bd-card">
                <h2 className="bd-card__title">{t("catalog.aboutAuthor")}</h2>
                <div className="bd-author">
                  <span className="bd-avatar bd-avatar--lg" aria-hidden="true">
                    {(authorNames[0] || "?").charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <strong>{authorNames[0] || L.unknownAuthor}</strong>
                    {authorNames.length > 1 ? <span>+{authorNames.length - 1}</span> : null}
                  </div>
                </div>
                <p className="bd-muted">{L.authorBio}</p>
              </section>

              <section className="bd-card">
                <h2 className="bd-card__title">{L.aiSearch}</h2>
                <label className="bd-search">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <circle cx="11" cy="11" r="6" />
                    <path d="M16 16l4 4" />
                  </svg>
                  <input type="search" placeholder={L.aiPlaceholder} aria-label={L.aiSearch} />
                  <span>AI</span>
                </label>
                <p className="bd-hint">{L.aiHint}</p>
              </section>
            </aside>
          </div>

          {/* Mobile sticky action bar */}
          <div className="bd-mobilebar">
            {primaryAction}
            <button
              type="button"
              onClick={toggleFavorite}
              aria-pressed={favorite}
              aria-label={favorite ? t("catalog.removeFav") : t("catalog.addFav")}
              className={`bd-btn bd-btn--ghost bd-btn--icon ${favorite ? "is-active" : ""}`}
            >
              {icons.heart}
            </button>
            <button type="button" onClick={shareBook} aria-label={t("catalog.actions.share")} className="bd-btn bd-btn--ghost bd-btn--icon">
              {icons.share}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
