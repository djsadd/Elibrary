import DashboardHeader from "@/components/layout/DashboardHeader";
import placeholder from "@/assets/images/Image.png";
import { getLang } from "@/shared/i18n";
import { api } from "@/shared/api/client";
import type { StudentProfile } from "@/shared/api/search";
import { useEffect, useState, type KeyboardEvent } from "react";

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) || window.location.origin;

type AiBook = {
  Language?: string;
  title?: string;
  pub_info?: string;
  year?: string;
  subjects?: string;
  source?: string;
};

type AiVectorResult = {
  title?: string;
  download_url?: string;
  text_snippet?: string;
};

type AuthProfile = StudentProfile & {
  id: number;
  email?: string | null;
};

type ResultTab = "book_search" | "vector_search";
type UiLang = "ru" | "en" | "kk";

const content: Record<
  UiLang,
  {
    pageTitle: string;
    badge: string;
    title: string;
    subtitle: string;
    helper: string;
    exampleLabel: string;
    examples: string[];
    inputPlaceholder: string;
    enterHint: string;
    search: string;
    searching: string;
    answer: string;
    emptyQuery: string;
    requestFailed: string;
    resultsTitle: string;
    resultsSubtitle: string;
    totalLabel: string;
    countLabel: string;
    resultModes: {
      book_search: { title: string; desc: string; empty: string; modalLabel: string };
      vector_search: { title: string; desc: string; empty: string; modalLabel: string };
    };
    labels: {
      untitled: string;
      source: string;
      year: string;
      language: string;
      subjects: string;
      description: string;
      fragment: string;
      explanation: string;
      openDocument: string;
      noSnippet: string;
      generating: string;
      idleExplanation: string;
      close: string;
      languageBadge: string;
    };
  }
> = {
  ru: {
    pageTitle: "Интеллектуальный поиск",
    badge: "AI поиск",
    title: "Ищите идеи, книги и точные фрагменты по смыслу",
    subtitle:
      "Страница показывает два типа результатов: найденные книги и релевантные текстовые фрагменты. Переключатели ниже выделены отдельно, чтобы `book_search` и `vector_search` были сразу заметны.",
    helper:
      "Подходит для тем, цитат, дисциплин, авторов и сложных естественных запросов.",
    exampleLabel: "Примеры запросов",
    examples: [
      "философия лидерства",
      "книги по Java",
      "цитаты о критическом мышлении",
    ],
    inputPlaceholder: "Например: «книги про искусственный интеллект в образовании»",
    enterHint: "Enter",
    search: "Запустить поиск",
    searching: "Поиск...",
    answer: "Ответ системы",
    emptyQuery: "Введите запрос для поиска.",
    requestFailed: "Не удалось выполнить запрос к интеллектуальному поиску.",
    resultsTitle: "Результаты поиска",
    resultsSubtitle: "Выберите режим просмотра и откройте нужную карточку.",
    totalLabel: "всего",
    countLabel: "кол-во",
    resultModes: {
      book_search: {
        title: "Книги",
        desc: "Подборка книг, наиболее близких к вашему запросу.",
        empty: "Книжных результатов для этого запроса нет.",
        modalLabel: "Карточка книги",
      },
      vector_search: {
        title: "Фрагменты",
        desc: "Точные текстовые совпадения и смысловые отрывки из документов.",
        empty: "Текстовых фрагментов для этого запроса нет.",
        modalLabel: "Фрагмент документа",
      },
    },
    labels: {
      untitled: "Без названия",
      source: "Источник",
      year: "Год",
      language: "Язык",
      subjects: "Темы",
      description: "Описание",
      fragment: "Фрагмент",
      explanation: "Объяснение для студента",
      openDocument: "Открыть исходный документ",
      noSnippet: "Текст фрагмента отсутствует.",
      generating: "Генерируем пояснение с помощью LLM...",
      idleExplanation: "Откройте карточку фрагмента, чтобы увидеть краткое пояснение.",
      close: "Закрыть",
      languageBadge: "3 языка",
    },
  },
  en: {
    pageTitle: "Intelligent Search",
    badge: "AI Search",
    title: "Search ideas, books, and exact fragments by meaning",
    subtitle:
      "This page shows two result types: matched books and relevant text fragments. The switches below make `book_search` and `vector_search` much more visible.",
    helper:
      "Useful for topics, quotations, disciplines, authors, and natural-language queries.",
    exampleLabel: "Example queries",
    examples: [
      "leadership philosophy",
      "books about Java",
      "quotes on critical thinking",
    ],
    inputPlaceholder: 'For example: "books about AI in education"',
    enterHint: "Enter",
    search: "Run search",
    searching: "Searching...",
    answer: "System reply",
    emptyQuery: "Enter a search query.",
    requestFailed: "Failed to complete the intelligent search request.",
    resultsTitle: "Search results",
    resultsSubtitle: "Choose a mode and open the card you need.",
    totalLabel: "total",
    countLabel: "count",
    resultModes: {
      book_search: {
        title: "Books",
        desc: "Books that best match your request.",
        empty: "No book results for this query.",
        modalLabel: "Book card",
      },
      vector_search: {
        title: "Fragments",
        desc: "Precise text matches and semantic fragments from documents.",
        empty: "No text fragments for this query.",
        modalLabel: "Document fragment",
      },
    },
    labels: {
      untitled: "Untitled",
      source: "Source",
      year: "Year",
      language: "Language",
      subjects: "Subjects",
      description: "Description",
      fragment: "Fragment",
      explanation: "Student explanation",
      openDocument: "Open source document",
      noSnippet: "No fragment text available.",
      generating: "Generating explanation with LLM...",
      idleExplanation: "Open a fragment card to see a short explanation.",
      close: "Close",
      languageBadge: "3 languages",
    },
  },
  kk: {
    pageTitle: "Интеллектуалды іздеу",
    badge: "AI іздеу",
    title: "Мағынасы бойынша идеяны, кітапты және нақты үзіндіні табыңыз",
    subtitle:
      "Бұл бет екі түрлі нәтижені көрсетеді: табылған кітаптар және маңызды мәтін үзінділері. Төмендегі `book_search` пен `vector_search` ауыстырғыштары енді айқынырақ көрсетілген.",
    helper:
      "Тақырыптар, дәйексөздер, пәндер, авторлар және еркін сұраныстар үшін ыңғайлы.",
    exampleLabel: "Сұраныс мысалдары",
    examples: [
      "көшбасшылық философиясы",
      "Java туралы кітаптар",
      "сыни ойлау туралы дәйексөздер",
    ],
    inputPlaceholder: "Мысалы: «білім берудегі жасанды интеллект туралы кітаптар»",
    enterHint: "Enter",
    search: "Іздеуді бастау",
    searching: "Ізделуде...",
    answer: "Жүйе жауабы",
    emptyQuery: "Іздеу сұранысын енгізіңіз.",
    requestFailed: "Интеллектуалды іздеу сұранысын орындау мүмкін болмады.",
    resultsTitle: "Іздеу нәтижелері",
    resultsSubtitle: "Көру режимін таңдап, қажетті карточканы ашыңыз.",
    totalLabel: "барлығы",
    countLabel: "саны",
    resultModes: {
      book_search: {
        title: "Кітаптар",
        desc: "Сұранысыңызға ең жақын кітаптар тізімі.",
        empty: "Бұл сұраныс бойынша кітап нәтижелері табылмады.",
        modalLabel: "Кітап карточкасы",
      },
      vector_search: {
        title: "Үзінділер",
        desc: "Құжаттардан нақты мәтіндік және мағыналық үзінділер.",
        empty: "Бұл сұраныс бойынша мәтін үзінділері табылмады.",
        modalLabel: "Құжат үзіндісі",
      },
    },
    labels: {
      untitled: "Атауы жоқ",
      source: "Дереккөз",
      year: "Жылы",
      language: "Тілі",
      subjects: "Тақырыптар",
      description: "Сипаттама",
      fragment: "Үзінді",
      explanation: "Студентке түсіндірме",
      openDocument: "Негізгі құжатты ашу",
      noSnippet: "Үзінді мәтіні жоқ.",
      generating: "LLM арқылы түсіндірме жасалып жатыр...",
      idleExplanation: "Қысқа түсіндірмені көру үшін үзінді карточкасын ашыңыз.",
      close: "Жабу",
      languageBadge: "3 тіл",
    },
  },
};

function getModeTone(tab: ResultTab, activeTab: ResultTab) {
  return activeTab === tab
    ? "border-[#7b0f2b] bg-[#7b0f2b] text-white shadow-xl shadow-rose-200/70"
    : "border-white/70 bg-white/85 text-slate-900 hover:border-rose-200 hover:bg-white";
}

export default function IntelligentSearchPage() {
  const [lang, setLang] = useState<UiLang>(getLang);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [books, setBooks] = useState<AiBook[]>([]);
  const [vectors, setVectors] = useState<AiVectorResult[]>([]);
  const [replyText, setReplyText] = useState<string | null>(null);
  const [selectedBook, setSelectedBook] = useState<AiBook | null>(null);
  const [selectedVector, setSelectedVector] = useState<AiVectorResult | null>(null);
  const [vectorExplanation, setVectorExplanation] = useState("");
  const [vectorStreaming, setVectorStreaming] = useState(false);
  const [activeTab, setActiveTab] = useState<ResultTab>("book_search");

  const copy = content[lang];
  const hasBookResults = books.length > 0;
  const hasVectorResults = vectors.length > 0;

  useEffect(() => {
    const syncLang = () => setLang(getLang());
    syncLang();
    window.addEventListener("lang:changed", syncLang);
    return () => window.removeEventListener("lang:changed", syncLang);
  }, []);

  useEffect(() => {
    document.title = `${copy.pageTitle} - TAU`;
  }, [copy.pageTitle]);

  async function runSearch() {
    const trimmed = query.trim();
    if (!trimmed) {
      alert(copy.emptyQuery);
      return;
    }

    try {
      setLoading(true);
      setBooks([]);
      setVectors([]);
      setReplyText(null);
      setSelectedBook(null);
      setSelectedVector(null);
      setVectorExplanation("");

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const resp = await fetch(`${API_BASE}/api/ai/chat_card`, {
        method: "POST",
        headers,
        body: JSON.stringify({ query: trimmed }),
      });

      const text = await resp.text();
      const json = JSON.parse(text);

      const nextBooks = Array.isArray(json?.book_search)
        ? (json.book_search as AiBook[])
        : [];
      const nextVectors = Array.isArray(json?.vector_search)
        ? (json.vector_search as AiVectorResult[])
        : [];

      setBooks(nextBooks);
      setVectors(nextVectors);
      setReplyText(typeof json?.reply === "string" ? json.reply : null);
      setActiveTab(nextBooks.length > 0 ? "book_search" : "vector_search");
    } catch (error: unknown) {
      console.log("[IntelligentSearch] request failed:", error);
      alert(copy.requestFailed);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !loading) {
      e.preventDefault();
      runSearch();
    }
  }

  async function loadVectorExplanation(v: AiVectorResult) {
    try {
      setVectorStreaming(true);
      setVectorExplanation("");

      let profile: AuthProfile | null = null;
      try {
        profile = await api<AuthProfile>("/api/auth/profile");
      } catch {}

      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-UI-Lang": lang,
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const resp = await fetch(`${API_BASE}/api/search/book-recommendation-explanation/stream`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          book: {
            id: 0,
            title: v.title ?? "",
            authors: [],
            subjects: [],
            summary: v.text_snippet ?? "",
            popularity: 0,
          },
          student_query: query.trim() || undefined,
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
        }),
      });

      if (!resp.ok) {
        throw new Error(await resp.text());
      }

      const reader = resp.body?.getReader();
      if (!reader) {
        setVectorExplanation(await resp.text());
        return;
      }

      const decoder = new TextDecoder("utf-8");
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          setVectorExplanation((prev) => prev + decoder.decode(value, { stream: true }));
        }
      }
    } catch (error: unknown) {
      console.log("[IntelligentSearch] generate_llm_context failed:", error);
    } finally {
      setVectorStreaming(false);
    }
  }

  return (
    <div>
      <DashboardHeader />

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 sm:py-8">
        <section className="relative overflow-hidden rounded-[32px] border border-rose-100 bg-[radial-gradient(circle_at_top_left,_rgba(123,15,43,0.13),_transparent_36%),radial-gradient(circle_at_bottom_right,_rgba(255,191,36,0.16),_transparent_28%),linear-gradient(135deg,_#fffaf8_0%,_#fff3f4_44%,_#ffffff_100%)] p-5 shadow-[0_30px_80px_-40px_rgba(123,15,43,0.45)] sm:p-8">
          <div className="absolute -top-24 right-0 h-56 w-56 rounded-full bg-rose-200/40 blur-3xl" />
          <div className="absolute -bottom-24 left-10 h-56 w-56 rounded-full bg-amber-200/40 blur-3xl" />

          <div className="relative flex flex-col gap-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full border border-rose-200 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#7b0f2b]">
                    {copy.badge}
                  </span>
                </div>
                <h1 className="max-w-2xl text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
                  {copy.title}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                  {copy.subtitle}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                {copy.exampleLabel}
              </span>
              {copy.examples.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setQuery(example)}
                  className="rounded-full border border-white/90 bg-white/80 px-3 py-1.5 text-sm text-slate-700 transition hover:border-rose-200 hover:text-[#7b0f2b]"
                >
                  {example}
                </button>
              ))}
            </div>

            <div className="rounded-[28px] border border-white/90 bg-white/85 p-4 shadow-xl shadow-rose-100/60 backdrop-blur sm:p-5">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 lg:flex-row">
                  <div className="flex min-h-16 flex-1 items-center gap-3 rounded-[24px] border border-rose-100 bg-white px-4 py-3 shadow-sm">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 text-[#7b0f2b]">
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                        <circle cx="11" cy="11" r="6" />
                        <path d="M16 16l4 4" />
                      </svg>
                    </span>
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={copy.inputPlaceholder}
                      className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 sm:text-base"
                    />
                    <kbd className="hidden rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-medium text-rose-700 sm:inline-flex">
                      {copy.enterHint}
                    </kbd>
                  </div>

                  <button
                    type="button"
                    onClick={() => !loading && runSearch()}
                    disabled={loading}
                    className="inline-flex min-h-16 items-center justify-center rounded-[24px] bg-[#7b0f2b] px-6 text-sm font-semibold text-white shadow-xl shadow-rose-300/60 transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {loading ? copy.searching : copy.search}
                  </button>
                </div>

                {replyText ? (
                  <div className="rounded-3xl border border-emerald-100 bg-emerald-50/80 px-4 py-3 text-sm text-slate-700">
                    <span className="font-semibold text-slate-900">{copy.answer}: </span>
                    {replyText}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">{copy.resultsTitle}</h2>
              <p className="text-sm text-slate-500">{copy.resultsSubtitle}</p>
            </div>
            <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-500 shadow-sm">
              {books.length + vectors.length} {copy.totalLabel}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <button
              type="button"
              onClick={() => setActiveTab("book_search")}
              className={`rounded-[28px] border p-5 text-left transition ${getModeTone("book_search", activeTab)}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] opacity-70">
                    book_search
                  </div>
                  <div className="mt-2 text-2xl font-semibold">
                    {copy.resultModes.book_search.title}
                  </div>
                  <p className="mt-2 max-w-md text-sm opacity-80">
                    {copy.resultModes.book_search.desc}
                  </p>
                </div>
                <div className="rounded-2xl bg-white/15 px-4 py-3 text-right backdrop-blur">
                  <div className="text-xs uppercase tracking-[0.2em] opacity-70">{copy.countLabel}</div>
                  <div className="text-3xl font-semibold">{books.length}</div>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("vector_search")}
              className={`rounded-[28px] border p-5 text-left transition ${getModeTone("vector_search", activeTab)}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] opacity-70">
                    vector_search
                  </div>
                  <div className="mt-2 text-2xl font-semibold">
                    {copy.resultModes.vector_search.title}
                  </div>
                  <p className="mt-2 max-w-md text-sm opacity-80">
                    {copy.resultModes.vector_search.desc}
                  </p>
                </div>
                <div className="rounded-2xl bg-white/15 px-4 py-3 text-right backdrop-blur">
                  <div className="text-xs uppercase tracking-[0.2em] opacity-70">{copy.countLabel}</div>
                  <div className="text-3xl font-semibold">{vectors.length}</div>
                </div>
              </div>
            </button>
          </div>

          <div className="mt-5">
            {activeTab === "book_search" ? (
              hasBookResults ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {books.map((book, idx) => (
                    <button
                      key={`${book.title || "book"}-${idx}`}
                      type="button"
                      onClick={() => setSelectedBook(book)}
                      className="group overflow-hidden rounded-[28px] border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-1 hover:border-rose-200 hover:shadow-xl hover:shadow-rose-100/70"
                    >
                      <div className="relative h-48 overflow-hidden bg-[linear-gradient(180deg,_#fff8f7_0%,_#f7f7fb_100%)]">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(123,15,43,0.10),_transparent_30%)]" />
                        <img
                          src={placeholder}
                          alt={book.title || copy.labels.untitled}
                          className="h-full w-full object-contain p-5 transition duration-300 group-hover:scale-[1.03]"
                        />
                      </div>
                      <div className="space-y-3 p-5">
                        <div>
                          <div className="line-clamp-2 text-lg font-semibold text-slate-900">
                            {book.title || copy.labels.untitled}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                            {book.year ? (
                              <span className="rounded-full bg-slate-100 px-2.5 py-1">{book.year}</span>
                            ) : null}
                            {book.Language ? (
                              <span className="rounded-full bg-slate-100 px-2.5 py-1">{book.Language}</span>
                            ) : null}
                          </div>
                        </div>

                        {book.subjects ? (
                          <p className="line-clamp-2 text-sm text-slate-500">{book.subjects}</p>
                        ) : null}

                        {book.source ? (
                          <div className="inline-flex rounded-full border border-rose-100 bg-rose-50 px-3 py-1 text-[11px] font-medium text-rose-700">
                            {copy.labels.source}: {book.source}
                          </div>
                        ) : null}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-[28px] border border-dashed border-slate-300 bg-white/80 px-6 py-10 text-center text-sm text-slate-500">
                  {copy.resultModes.book_search.empty}
                </div>
              )
            ) : hasVectorResults ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {vectors.map((vector, idx) => (
                  <button
                    key={`${vector.title || "vector"}-${idx}`}
                    type="button"
                    onClick={() => {
                      setSelectedVector(vector);
                      loadVectorExplanation(vector);
                    }}
                    className="group overflow-hidden rounded-[28px] border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-1 hover:border-rose-200 hover:shadow-xl hover:shadow-rose-100/70"
                  >
                    <div className="relative h-48 overflow-hidden bg-[linear-gradient(180deg,_#fff6ef_0%,_#f9fafe_100%)]">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,171,36,0.15),_transparent_28%)]" />
                      <img
                        src={placeholder}
                        alt={vector.title || copy.labels.fragment}
                        className="h-full w-full object-contain p-5 transition duration-300 group-hover:scale-[1.03]"
                      />
                    </div>
                    <div className="space-y-3 p-5">
                      <div className="line-clamp-2 text-lg font-semibold text-slate-900">
                        {vector.title || copy.labels.fragment}
                      </div>
                      <p className="line-clamp-4 text-sm leading-6 text-slate-500">
                        {vector.text_snippet || copy.labels.noSnippet}
                      </p>
                      {vector.download_url ? (
                        <div className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-800">
                          {copy.labels.openDocument}
                        </div>
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-[28px] border border-dashed border-slate-300 bg-white/80 px-6 py-10 text-center text-sm text-slate-500">
                {copy.resultModes.vector_search.empty}
              </div>
            )}
          </div>
        </section>

        {selectedBook ? (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/65 px-4 py-6">
            <div className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-[30px] bg-white shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7b0f2b]">
                    {copy.resultModes.book_search.modalLabel}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">
                    {selectedBook.title || copy.labels.untitled}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedBook(null)}
                  className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100"
                  aria-label={copy.labels.close}
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>

              <div className="max-h-[65vh] space-y-3 overflow-y-auto px-5 py-5 text-sm text-slate-700">
                {selectedBook.year ? (
                  <div>
                    <span className="font-medium text-slate-500">{copy.labels.year}: </span>
                    <span>{selectedBook.year}</span>
                  </div>
                ) : null}
                {selectedBook.Language ? (
                  <div>
                    <span className="font-medium text-slate-500">{copy.labels.language}: </span>
                    <span>{selectedBook.Language}</span>
                  </div>
                ) : null}
                {selectedBook.subjects ? (
                  <div>
                    <span className="font-medium text-slate-500">{copy.labels.subjects}: </span>
                    <span>{selectedBook.subjects}</span>
                  </div>
                ) : null}
                {selectedBook.pub_info ? (
                  <div>
                    <span className="font-medium text-slate-500">{copy.labels.description}: </span>
                    <span className="whitespace-pre-line">{selectedBook.pub_info}</span>
                  </div>
                ) : null}
                {selectedBook.source ? (
                  <div className="pt-2 text-xs text-slate-500">
                    {copy.labels.source}: {selectedBook.source}
                  </div>
                ) : null}
              </div>

              <div className="flex justify-end border-t border-slate-100 px-5 py-4">
                <button
                  type="button"
                  onClick={() => setSelectedBook(null)}
                  className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  {copy.labels.close}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {selectedVector ? (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/65 px-4 py-6">
            <div className="max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-[30px] bg-white shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7b0f2b]">
                    {copy.resultModes.vector_search.modalLabel}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">
                    {selectedVector.title || copy.labels.untitled}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedVector(null);
                    setVectorExplanation("");
                  }}
                  className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100"
                  aria-label={copy.labels.close}
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>

              <div className="grid max-h-[65vh] grid-cols-1 gap-4 overflow-y-auto px-5 py-5 md:grid-cols-2">
                <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                  <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {copy.labels.fragment}
                  </div>
                  {selectedVector.text_snippet ? (
                    <div className="whitespace-pre-line text-sm leading-6 text-slate-700">
                      {selectedVector.text_snippet}
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500">{copy.labels.noSnippet}</div>
                  )}
                  {selectedVector.download_url ? (
                    <a
                      href={selectedVector.download_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex text-sm font-medium text-[#7b0f2b] transition hover:underline"
                    >
                      {copy.labels.openDocument}
                    </a>
                  ) : null}
                </div>

                <div className="rounded-[24px] border border-rose-100 bg-rose-50/70 p-4">
                  <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-rose-700">
                    {copy.labels.explanation}
                  </div>
                  <div className="whitespace-pre-line text-sm leading-6 text-slate-700">
                    {vectorStreaming && !vectorExplanation ? copy.labels.generating : null}
                    {!vectorStreaming && !vectorExplanation ? copy.labels.idleExplanation : null}
                    {vectorExplanation ? vectorExplanation : null}
                  </div>
                </div>
              </div>

              <div className="flex justify-end border-t border-slate-100 px-5 py-4">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedVector(null);
                    setVectorExplanation("");
                  }}
                  className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  {copy.labels.close}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
