import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { t } from "@/shared/i18n";

import { type ContentPage, loadContentSummary } from "./contentPages";

type StatusFilter = "all" | "draft" | "published";

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

function getPageRange(page: number, perPage: number, total: number) {
  if (!total) return "0";
  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);
  return `${from}-${to}`;
}

export default function PagesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [pages, setPages] = useState<ContentPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const query = searchParams.get("q") || "";
  const status = (searchParams.get("status") as StatusFilter) || "all";
  const perPage = Number(searchParams.get("perPage") || 10);
  const page = Math.max(1, Number(searchParams.get("page") || 1));

  const setParam = (key: string, value?: string) => {
    const next = new URLSearchParams(searchParams);
    if (!value) next.delete(key);
    else next.set(key, value);
    if (key !== "page") next.set("page", "1");
    setSearchParams(next);
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await loadContentSummary();
      setPages(result.pages);
    } catch (e: any) {
      setError(e?.message || "Failed to load pages");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filteredPages = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return [...pages]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .filter((item) => {
        const statusMatches = status === "all" || item.status === status;
        const haystack = [
          item.title,
          item.title_ru,
          item.title_kk,
          item.title_en,
          item.slug,
          item.summary,
          item.summary_ru,
          item.summary_kk,
          item.summary_en,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return statusMatches && (!normalizedQuery || haystack.includes(normalizedQuery));
      });
  }, [pages, query, status]);

  const safePerPage = PAGE_SIZE_OPTIONS.includes(perPage as (typeof PAGE_SIZE_OPTIONS)[number]) ? perPage : 10;
  const totalPages = Math.max(1, Math.ceil(filteredPages.length / safePerPage));
  const currentPage = Math.min(page, totalPages);
  const offset = (currentPage - 1) * safePerPage;
  const paginatedPages = filteredPages.slice(offset, offset + safePerPage);
  const publishedCount = pages.filter((item) => item.status === "published").length;
  const draftCount = pages.length - publishedCount;

  useEffect(() => {
    if (currentPage !== page) {
      const next = new URLSearchParams(searchParams);
      next.set("page", String(currentPage));
      setSearchParams(next, { replace: true });
    }
  }, [currentPage, page, searchParams, setSearchParams]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{t("admin.pages.heading")}</h2>
          <p className="mt-1 text-sm text-slate-600">{t("admin.pages.description")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-md border px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            {t("admin.pages.refresh")}
          </button>
          <Link
            to="/content/pages/new"
            className="rounded-md bg-slate-800 px-3 py-2 text-sm font-medium text-white"
          >
            {t("admin.pages.create")}
          </Link>
        </div>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-3">
        <div className="rounded-lg bg-slate-50 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500">{t("admin.pages.meta.total")}</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">{pages.length}</div>
        </div>
        <div className="rounded-lg bg-emerald-50 p-4">
          <div className="text-xs uppercase tracking-wide text-emerald-700">{t("admin.pages.meta.published")}</div>
          <div className="mt-2 text-2xl font-semibold text-emerald-900">{publishedCount}</div>
        </div>
        <div className="rounded-lg bg-amber-50 p-4">
          <div className="text-xs uppercase tracking-wide text-amber-700">{t("admin.pages.meta.drafts")}</div>
          <div className="mt-2 text-2xl font-semibold text-amber-900">{draftCount}</div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_180px]">
          <label className="text-sm">
            <div className="mb-1 text-slate-600">{t("admin.pages.filters.search")}</div>
            <input
              value={query}
              onChange={(e) => setParam("q", e.target.value)}
              placeholder={t("admin.pages.filters.searchPlaceholder")}
              className="w-full rounded-md border px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <div className="mb-1 text-slate-600">{t("admin.pages.filters.status")}</div>
            <select
              value={status}
              onChange={(e) => setParam("status", e.target.value === "all" ? undefined : e.target.value)}
              className="w-full rounded-md border px-3 py-2"
            >
              <option value="all">{t("admin.pages.filters.allStatuses")}</option>
              <option value="draft">{t("admin.pages.draft")}</option>
              <option value="published">{t("admin.pages.published")}</option>
            </select>
          </label>
          <label className="text-sm">
            <div className="mb-1 text-slate-600">{t("admin.pages.filters.perPage")}</div>
            <select
              value={safePerPage}
              onChange={(e) => setParam("perPage", e.target.value)}
              className="w-full rounded-md border px-3 py-2"
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div>
            <div className="font-medium text-slate-900">{t("admin.pages.listTitle")}</div>
            <div className="text-sm text-slate-500">
              {t("admin.pages.pagination.summary", {
                shown: getPageRange(currentPage, safePerPage, filteredPages.length),
                total: filteredPages.length,
              })}
            </div>
          </div>
          <div className="text-sm text-slate-500">
            {t("admin.pages.pagination.page", { page: currentPage, total: totalPages })}
          </div>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="text-sm text-slate-500">{t("admin.common.loading")}</div>
          ) : paginatedPages.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
              {t("admin.pages.empty")}
            </div>
          ) : (
            <div className="space-y-3">
              {paginatedPages.map((pageItem) => (
                <PageRow key={pageItem.id} page={pageItem} />
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
          <div className="text-sm text-slate-500">
            {t("admin.pages.pagination.range", {
              shown: getPageRange(currentPage, safePerPage, filteredPages.length),
              total: filteredPages.length,
            })}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setParam("page", String(Math.max(1, currentPage - 1)))}
              disabled={currentPage <= 1}
              className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
            >
              {t("admin.pages.pagination.prev")}
            </button>
            <button
              type="button"
              onClick={() => setParam("page", String(Math.min(totalPages, currentPage + 1)))}
              disabled={currentPage >= totalPages}
              className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
            >
              {t("admin.pages.pagination.next")}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function PageRow({ page }: { page: ContentPage }) {
  const statusClass =
    page.status === "published"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-amber-200 bg-amber-50 text-amber-700";

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/content/pages/${page.id}`} className="font-medium text-slate-900 hover:text-slate-700">
              {page.title}
            </Link>
            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass}`}>
              {page.status === "published" ? t("admin.pages.published") : t("admin.pages.draft")}
            </span>
          </div>
          <div className="mt-1 text-sm text-slate-500">/{page.slug}</div>
          {page.summary && <div className="mt-3 line-clamp-2 text-sm text-slate-600">{page.summary}</div>}
        </div>

        <div className="flex flex-wrap gap-2">
          {page.slug && (
            <a
              href={`/public/page/${page.slug}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              {t("admin.pages.preview")}
            </a>
          )}
          <Link
            to={`/content/pages/${page.id}`}
            className="rounded-md bg-slate-800 px-3 py-2 text-sm font-medium text-white"
          >
            {t("admin.common.edit")}
          </Link>
        </div>
      </div>

      <div className="mt-4 grid gap-3 text-xs text-slate-500 md:grid-cols-3">
        <div>
          <span className="font-medium text-slate-700">{t("admin.pages.meta.updatedAt")}:</span>{" "}
          {new Date(page.updated_at).toLocaleString()}
        </div>
        <div>
          <span className="font-medium text-slate-700">{t("admin.pages.meta.blocks")}:</span> {page.blocks.length}
        </div>
        <div>
          <span className="font-medium text-slate-700">{t("admin.pages.meta.id")}:</span> {page.id}
        </div>
      </div>
    </div>
  );
}
