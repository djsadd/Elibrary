import DashboardHeader from "@/components/layout/DashboardHeader";
import { useEffect, useState } from "react";
import placeholder from "@/assets/images/Image.png";

// Отдельная авторизация для AI‑сервиса (не трогаем основную авторизацию приложения)
const AI_AUTH_BASE = import.meta.env.VITE_AI_AUTH_BASE ?? "http://192.168.112.182";
const AI_AUTH_USERNAME = import.meta.env.VITE_AI_AUTH_USER ?? "";
const AI_AUTH_PASSWORD = import.meta.env.VITE_AI_AUTH_PASS ?? "";

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

type ResultTab = "book_search" | "vector_search";

export default function IntelligentSearchPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiToken, setAiToken] = useState<string | null>(null);
  const [books, setBooks] = useState<AiBook[]>([]);
  const [vectors, setVectors] = useState<AiVectorResult[]>([]);
  const [replyText, setReplyText] = useState<string | null>(null);
  const [selectedBook, setSelectedBook] = useState<AiBook | null>(null);
  const [selectedVector, setSelectedVector] = useState<AiVectorResult | null>(
    null
  );
  const [vectorExplanation, setVectorExplanation] = useState("");
  const [vectorStreaming, setVectorStreaming] = useState(false);
  const [activeTab, setActiveTab] = useState<ResultTab>("book_search");

  // Логин в другой сервис при открытии раздела
  useEffect(() => {
    async function loginExternal() {
      if (!AI_AUTH_USERNAME || !AI_AUTH_PASSWORD) {
        console.log(
          "[IntelligentSearch] AI auth env vars are not set (VITE_AI_AUTH_USER / VITE_AI_AUTH_PASS); пропускаем логин"
        );
        return;
      }
      try {
        console.log("[IntelligentSearch] logging in to external AI service");
        const resp = await fetch(`${AI_AUTH_BASE}/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            username: AI_AUTH_USERNAME,
            password: AI_AUTH_PASSWORD,
          }).toString(),
        });
        const text = await resp.text();
        console.log("[IntelligentSearch] auth status:", resp.status);
        console.log("[IntelligentSearch] auth raw response:", text);
        let data: any = null;
        try {
          data = JSON.parse(text);
          console.log("[IntelligentSearch] auth parsed JSON:", data);
        } catch {
          // ответ не JSON — ничего страшного
        }
        if (resp.ok && data?.access_token) {
          setAiToken(data.access_token);
          console.log(
            "[IntelligentSearch] external AI auth success, token received"
          );
        } else {
          console.log(
            "[IntelligentSearch] external AI auth failed (no token)"
          );
        }
      } catch (e: any) {
        console.log(
          "[IntelligentSearch] external AI auth error:",
          e?.message || String(e)
        );
      }
    }

    loginExternal();
  }, []);

  async function runSearch() {
    const trimmed = query.trim();
    if (!trimmed) {
      alert("Введите запрос для поиска");
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
      if (aiToken) {
        headers["Authorization"] = `Bearer ${aiToken}`;
      } else {
        console.log(
          "[IntelligentSearch] no external token yet, sending request без Authorization"
        );
      }
      const resp = await fetch("http://192.168.112.182/api/chat_card", {
        method: "POST",
        headers,
        body: JSON.stringify({ query: trimmed }),
      });
      const text = await resp.text();
      console.log("[IntelligentSearch] status:", resp.status);
      console.log("[IntelligentSearch] raw response:", text);
      try {
        const json = JSON.parse(text);
        console.log("[IntelligentSearch] parsed JSON:", json);
        if (Array.isArray(json?.book_search)) {
          setBooks(json.book_search as AiBook[]);
        }
        if (Array.isArray(json?.vector_search)) {
          setVectors(json.vector_search as AiVectorResult[]);
        }
        if (typeof json?.reply === "string") {
          setReplyText(json.reply as string);
        }
      } catch {
        // ответ не JSON — это нормально
      }
    } catch (e: any) {
      console.log(
        "[IntelligentSearch] request failed:",
        e?.message || String(e)
      );
      alert("Не удалось выполнить запрос к 192.168.112.182/api/chat_card");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: any) {
    if (e.key === "Enter" && !loading) {
      e.preventDefault();
      runSearch();
    }
  }

  async function loadVectorExplanation(v: AiVectorResult) {
    if (!aiToken) {
      console.log(
        "[IntelligentSearch] no external token for generate_llm_context, skipping"
      );
      setVectorExplanation("");
      return;
    }
    try {
      setVectorStreaming(true);
      setVectorExplanation("");
      const resp = await fetch(
        "http://192.168.112.182/api/generate_llm_context",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${aiToken}`,
          },
          body: JSON.stringify({
            query,
            title: v.title ?? "",
            text_snippet: v.text_snippet ?? "",
          }),
        }
      );
      const reader = resp.body?.getReader();
      if (!reader) {
        const text = await resp.text();
        setVectorExplanation(text);
        return;
      }
      const decoder = new TextDecoder("utf-8");
      // читаем стрим и накапливаем текст
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          const chunk = decoder.decode(value);
          setVectorExplanation((prev) => prev + chunk);
        }
      }
    } catch (e: any) {
      console.log(
        "[IntelligentSearch] generate_llm_context failed:",
        e?.message || String(e)
      );
    } finally {
      setVectorStreaming(false);
    }
  }

  const hasBookResults = books.length > 0;
  const hasVectorResults = vectors.length > 0;

  return (
    <div>
      <DashboardHeader />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="mb-4">
          <div className="text-xs font-semibold tracking-wide uppercase text-[#7b0f2b]">
            Интеллектуальный поиск
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-semibold text-slate-900">
            Найдите идею, цитату или тему в своих книгах
          </h1>
          <p className="mt-2 text-sm text-slate-500 max-w-2xl">
            Здесь работает экспериментальный поиск по библиотеке. Результаты
            делятся на книги и фрагменты текста (vector search).
          </p>
        </div>

        <div className="mt-6">
          <div className="relative group">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-[#fbeff2] via-[#fde9e9] to-[#fff7ec] opacity-80 blur-sm group-hover:blur-md group-hover:opacity-100 transition-all" />
            <div className="relative rounded-3xl bg-white text-slate-900 border border-rose-100 shadow-xl overflow-hidden">
              <div className="absolute -top-24 -right-16 w-56 h-56 bg-gradient-to-br from-rose-100 via-rose-50 to-transparent rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-24 -left-10 w-60 h-60 bg-gradient-to-tr from-amber-100 via-rose-50 to-transparent rounded-full blur-3xl pointer-events-none" />

              <div className="relative px-4 sm:px-6 py-4 sm:py-5 flex flex-col gap-3">
                <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-wide text-rose-500">
                  <span className="px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-[10px] text-rose-600">
                    AI
                  </span>
                  <span>Экспериментальный режим</span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 flex items-center gap-2 bg-white border border-rose-100 rounded-2xl px-3 py-2.5 shadow-sm">
                    <svg
                      className="w-4 h-4 text-slate-400 flex-shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    >
                      <circle cx="11" cy="11" r="6" />
                      <path d="M16 16l4 4" />
                    </svg>
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Например: «философия лидерства» или «книги про Java»"
                      className="w-full bg-transparent border-none outline-none text-sm text-slate-900 placeholder-slate-400"
                    />
                    <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-[10px] text-rose-600 border border-rose-200">
                      <span className="text-xs">⏎</span>
                      <span>Искать</span>
                    </kbd>
                  </div>
                  <button
                    type="button"
                    onClick={() => !loading && runSearch()}
                    className="inline-flex items-center justify-center px-4 py-2 rounded-2xl bg-[#7b0f2b] text-xs sm:text-sm font-medium text-white hover:bg-rose-600 transition-colors shadow-md shadow-rose-300/60 disabled:opacity-60 disabled:cursor-not-allowed"
                    disabled={loading}
                  >
                    {loading ? "Запрос..." : "Запросить поиск"}
                  </button>
                </div>

                {replyText && (
                  <div className="mt-3 text-sm text-slate-700">
                    <span className="font-medium text-slate-900">Ответ:</span>{" "}
                    {replyText}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {(hasBookResults || hasVectorResults) && (
          <div className="mt-8">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">
                Найдено результатов
              </h2>
              <div className="inline-flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-full px-1 py-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("book_search")}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    activeTab === "book_search"
                      ? "bg-white text-[#7b0f2b] shadow-sm border border-rose-200"
                      : "text-slate-600 hover:text-slate-800"
                  }`}
                >
                  Книги (book_search{hasBookResults ? `: ${books.length}` : ""})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("vector_search")}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    activeTab === "vector_search"
                      ? "bg-white text-[#7b0f2b] shadow-sm border border-rose-200"
                      : "text-slate-600 hover:text-slate-800"
                  }`}
                >
                  Фрагменты (vector_search
                  {hasVectorResults ? `: ${vectors.length}` : ""})
                </button>
              </div>
            </div>

            {activeTab === "book_search" && (
              <>
                {hasBookResults ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {books.map((b, idx) => (
                      <button
                        key={`${b.title || "book"}-${idx}`}
                        type="button"
                        onClick={() => setSelectedBook(b)}
                        className="text-left bg-white border border-gray-100 rounded-lg p-3 shadow-sm hover:shadow-md hover:border-[#7b0f2b]/50 transition-shadow transition-colors"
                      >
                        <div className="w-full h-40 sm:h-48 bg-slate-50 rounded-md mb-3 flex items-center justify-center overflow-hidden">
                          <img
                            src={placeholder}
                            alt={b.title || "book-cover"}
                            className="w-full h-full object-contain p-2"
                          />
                        </div>
                        <div className="text-sm font-semibold text-slate-900 line-clamp-2">
                          {b.title || "Без названия"}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {b.year && <span className="mr-2">{b.year}</span>}
                          {b.Language && <span>{b.Language}</span>}
                        </div>
                        {b.subjects && (
                          <div className="mt-1 text-xs text-slate-500 line-clamp-2">
                            {b.subjects}
                          </div>
                        )}
                        {b.source && (
                          <div className="mt-2 inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-[10px] text-slate-500 border border-slate-100">
                            источник: {b.source}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">
                    Книжных результатов (book_search) нет для этого запроса.
                  </div>
                )}
              </>
            )}

            {activeTab === "vector_search" && (
              <>
                {hasVectorResults ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {vectors.map((v, idx) => (
                      <button
                        key={`${v.title || "vector"}-${idx}`}
                        type="button"
                        onClick={() => {
                          setSelectedVector(v);
                          loadVectorExplanation(v);
                        }}
                        className="text-left bg-white border border-gray-100 rounded-lg p-3 shadow-sm hover:shadow-md hover:border-[#7b0f2b]/50 transition-shadow transition-colors"
                      >
                        <div className="w-full h-40 sm:h-48 bg-slate-50 rounded-md mb-3 flex items-center justify-center overflow-hidden">
                          <img
                            src={placeholder}
                            alt={v.title || "vector-fragment"}
                            className="w-full h-full object-contain p-2"
                          />
                        </div>
                        <div className="text-sm font-semibold text-slate-900 line-clamp-2">
                          {v.title || "Фрагмент документа"}
                        </div>
                        {v.download_url && (
                          <div className="mt-2 inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-[10px] text-slate-500 border border-slate-100">
                            открыть документ
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">
                    Фрагментов (vector_search) нет для этого запроса.
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {selectedBook && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 px-4">
            <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <div>
                  <div className="text-xs font-semibold text-[#7b0f2b] uppercase tracking-wide">
                    Краткая карточка книги
                  </div>
                  <div className="text-sm font-medium text-slate-900 line-clamp-2">
                    {selectedBook.title || "Без названия"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedBook(null)}
                  className="ml-4 rounded-full p-1.5 hover:bg-slate-100 text-slate-500"
                  aria-label="Закрыть"
                >
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  >
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>

              <div className="px-4 py-3 space-y-2 text-sm text-slate-800 max-h-[70vh] overflow-y-auto">
                {selectedBook.year && (
                  <div>
                    <span className="text-slate-500">Год: </span>
                    <span>{selectedBook.year}</span>
                  </div>
                )}
                {selectedBook.Language && (
                  <div>
                    <span className="text-slate-500">Язык: </span>
                    <span>{selectedBook.Language}</span>
                  </div>
                )}
                {selectedBook.subjects && (
                  <div>
                    <span className="text-slate-500">Темы: </span>
                    <span>{selectedBook.subjects}</span>
                  </div>
                )}
                {selectedBook.pub_info && (
                  <div>
                    <span className="text-slate-500">Описание: </span>
                    <span className="whitespace-pre-line">
                      {selectedBook.pub_info}
                    </span>
                  </div>
                )}
                {selectedBook.source && (
                  <div className="text-xs text-slate-500 mt-2">
                    Источник: {selectedBook.source}
                  </div>
                )}
              </div>

              <div className="px-4 py-3 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedBook(null)}
                  className="px-4 py-2 text-sm rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50"
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        )}

        {selectedVector && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 px-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <div>
                  <div className="text-xs font-semibold text-[#7b0f2b] uppercase tracking-wide">
                    Фрагмент документа (vector_search)
                  </div>
                  <div className="text-sm font-medium text-slate-900 line-clamp-2">
                    {selectedVector.title || "Без названия"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedVector(null);
                    setVectorExplanation("");
                  }}
                  className="ml-4 rounded-full p-1.5 hover:bg-slate-100 text-slate-500"
                  aria-label="Закрыть"
                >
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  >
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>

              <div className="px-4 py-3 grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[70vh] overflow-y-auto text-sm text-slate-800">
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-500 uppercase">
                    Фрагмент
                  </div>
                  {selectedVector.text_snippet ? (
                    <div className="text-xs text-slate-800 whitespace-pre-line bg-slate-50 rounded-md px-3 py-2 max-h-56 overflow-y-auto">
                      {selectedVector.text_snippet}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500">
                      Текст фрагмента отсутствует.
                    </div>
                  )}
                  {selectedVector.download_url && (
                    <a
                      href={selectedVector.download_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center text-xs text-[#7b0f2b] hover:underline mt-1"
                    >
                      Открыть исходный документ
                    </a>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-500 uppercase">
                    Объяснение для студента
                  </div>
                  <div className="text-xs text-slate-800 whitespace-pre-line bg-rose-50/60 rounded-md px-3 py-2 max-h-56 overflow-y-auto border border-rose-100">
                    {vectorStreaming && !vectorExplanation && (
                      <span className="text-slate-500">
                        Генерируем пояснение с помощью LLM...
                      </span>
                    )}
                    {!vectorStreaming && !vectorExplanation && (
                      <span className="text-slate-500">
                        Нажмите на карточку, чтобы получить краткое объяснение,
                        чем этот источник полезен.
                      </span>
                    )}
                    {vectorExplanation && <span>{vectorExplanation}</span>}
                  </div>
                </div>
              </div>

              <div className="px-4 py-3 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedVector(null);
                    setVectorExplanation("");
                  }}
                  className="px-4 py-2 text-sm rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50"
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
