import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { t } from "@/shared/i18n";

import {
  flattenMenuItems,
  inferMenuKind,
  loadMenuSummary,
  resolveMenuTitle,
  type MenuItem,
} from "./contentMenu";

type KindFilter = "all" | "link" | "dropdown";
type VisibilityFilter = "all" | "visible" | "hidden";
type LevelSort = "asc" | "desc";

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

function getPageRange(page: number, perPage: number, total: number) {
  if (!total) return "0";
  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);
  return `${from}-${to}`;
}

export default function MenuPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const query = searchParams.get("q") || "";
  const kind = (searchParams.get("kind") as KindFilter) || "all";
  const visibility = (searchParams.get("visibility") as VisibilityFilter) || "all";
  const levelFilter = searchParams.get("level") || "all";
  const levelSort = (searchParams.get("levelSort") as LevelSort) || "asc";
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
      const result = await loadMenuSummary();
      setMenuItems(result.menu_items);
    } catch (e: any) {
      setError(e?.message || "Failed to load menu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const flatItems = useMemo(() => flattenMenuItems(menuItems), [menuItems]);
  const availableLevels = useMemo(() => Array.from(new Set(flatItems.map((item) => item.level))).sort((a, b) => a - b), [flatItems]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const normalizedLevel = levelFilter === "all" ? null : Number(levelFilter);
    return [...flatItems]
      .sort((a, b) => {
        const levelDiff = levelSort === "desc" ? b.level - a.level : a.level - b.level;
        return levelDiff || a.sort_order - b.sort_order || a.id - b.id;
      })
      .filter((item) => {
        const itemKind = inferMenuKind(item);
        const kindMatches = kind === "all" || itemKind === kind;
        const visibilityMatches =
          visibility === "all" || (visibility === "visible" ? item.is_visible : !item.is_visible);
        const levelMatches = normalizedLevel === null || item.level === normalizedLevel;
        const haystack = [
          item.title,
          item.title_ru,
          item.title_kk,
          item.title_en,
          item.slug,
          item.description,
          item.path,
          item.external_url,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return (
          kindMatches &&
          visibilityMatches &&
          levelMatches &&
          (!normalizedQuery || haystack.includes(normalizedQuery))
        );
      });
  }, [flatItems, kind, levelFilter, levelSort, query, visibility]);

  const safePerPage = PAGE_SIZE_OPTIONS.includes(perPage as (typeof PAGE_SIZE_OPTIONS)[number]) ? perPage : 10;
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / safePerPage));
  const currentPage = Math.min(page, totalPages);
  const offset = (currentPage - 1) * safePerPage;
  const paginatedItems = filteredItems.slice(offset, offset + safePerPage);
  const visibleCount = flatItems.filter((item) => item.is_visible).length;
  const dropdownCount = flatItems.filter((item) => inferMenuKind(item) === "dropdown").length;

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
          <h2 className="text-lg font-semibold">{t("admin.nav.menu")}</h2>
          <p className="mt-1 text-sm text-slate-600">{t("admin.menu.description")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-md border px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            {t("admin.menu.refresh")}
          </button>
          <Link
            to="/content/menu/new"
            className="rounded-md bg-slate-800 px-3 py-2 text-sm font-medium text-white"
          >
            {t("admin.menu.actions.createMenu")}
          </Link>
        </div>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-3">
        <div className="rounded-lg bg-slate-50 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500">{t("admin.menu.meta.total")}</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">{flatItems.length}</div>
        </div>
        <div className="rounded-lg bg-emerald-50 p-4">
          <div className="text-xs uppercase tracking-wide text-emerald-700">{t("admin.menu.meta.visible")}</div>
          <div className="mt-2 text-2xl font-semibold text-emerald-900">{visibleCount}</div>
        </div>
        <div className="rounded-lg bg-amber-50 p-4">
          <div className="text-xs uppercase tracking-wide text-amber-700">{t("admin.menu.meta.dropdowns")}</div>
          <div className="mt-2 text-2xl font-semibold text-amber-900">{dropdownCount}</div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px_180px_180px_180px_160px]">
          <label className="text-sm">
            <div className="mb-1 text-slate-600">{t("admin.menu.filters.search")}</div>
            <input
              value={query}
              onChange={(e) => setParam("q", e.target.value)}
              placeholder={t("admin.menu.filters.searchPlaceholder")}
              className="w-full rounded-md border px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <div className="mb-1 text-slate-600">{t("admin.menu.filters.kind")}</div>
            <select
              value={kind}
              onChange={(e) => setParam("kind", e.target.value === "all" ? undefined : e.target.value)}
              className="w-full rounded-md border px-3 py-2"
            >
              <option value="all">{t("admin.menu.filters.allKinds")}</option>
              <option value="link">{t("admin.menu.kinds.link")}</option>
              <option value="dropdown">{t("admin.menu.kinds.dropdown")}</option>
            </select>
          </label>
          <label className="text-sm">
            <div className="mb-1 text-slate-600">{t("admin.menu.filters.level")}</div>
            <select
              value={levelFilter}
              onChange={(e) => setParam("level", e.target.value === "all" ? undefined : e.target.value)}
              className="w-full rounded-md border px-3 py-2"
            >
              <option value="all">{t("admin.menu.filters.allLevels")}</option>
              {availableLevels.map((level) => (
                <option key={level} value={level}>
                  {t("admin.menu.filters.levelValue", { level })}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <div className="mb-1 text-slate-600">{t("admin.menu.filters.visibility")}</div>
            <select
              value={visibility}
              onChange={(e) => setParam("visibility", e.target.value === "all" ? undefined : e.target.value)}
              className="w-full rounded-md border px-3 py-2"
            >
              <option value="all">{t("admin.menu.filters.allVisibility")}</option>
              <option value="visible">{t("admin.menu.states.visible")}</option>
              <option value="hidden">{t("admin.menu.states.hidden")}</option>
            </select>
          </label>
          <label className="text-sm">
            <div className="mb-1 text-slate-600">{t("admin.menu.filters.levelSort")}</div>
            <select
              value={levelSort}
              onChange={(e) => setParam("levelSort", e.target.value === "asc" ? undefined : e.target.value)}
              className="w-full rounded-md border px-3 py-2"
            >
              <option value="asc">{t("admin.menu.filters.levelSortAsc")}</option>
              <option value="desc">{t("admin.menu.filters.levelSortDesc")}</option>
            </select>
          </label>
          <label className="text-sm">
            <div className="mb-1 text-slate-600">{t("admin.menu.filters.perPage")}</div>
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
            <div className="font-medium text-slate-900">{t("admin.menu.list.title")}</div>
            <div className="text-sm text-slate-500">
              {t("admin.menu.pagination.summary", {
                shown: getPageRange(currentPage, safePerPage, filteredItems.length),
                total: filteredItems.length,
              })}
            </div>
          </div>
          <div className="text-sm text-slate-500">
            {t("admin.menu.pagination.page", { page: currentPage, total: totalPages })}
          </div>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="text-sm text-slate-500">{t("admin.common.loading")}</div>
          ) : paginatedItems.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
              {t("admin.menu.list.empty")}
            </div>
          ) : (
            <div className="space-y-3">
              {paginatedItems.map((item) => (
                <MenuRow key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
          <div className="text-sm text-slate-500">
            {t("admin.menu.pagination.range", {
              shown: getPageRange(currentPage, safePerPage, filteredItems.length),
              total: filteredItems.length,
            })}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setParam("page", String(Math.max(1, currentPage - 1)))}
              disabled={currentPage <= 1}
              className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
            >
              {t("admin.menu.pagination.prev")}
            </button>
            <button
              type="button"
              onClick={() => setParam("page", String(Math.min(totalPages, currentPage + 1)))}
              disabled={currentPage >= totalPages}
              className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
            >
              {t("admin.menu.pagination.next")}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function MenuRow({ item }: { item: MenuItem & { level: number } }) {
  const kind = inferMenuKind(item);
  const visibilityClass = item.is_visible
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-slate-200 bg-slate-100 text-slate-600";

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/content/menu/${item.id}`} className="font-medium text-slate-900 hover:text-slate-700">
              {"- ".repeat(item.level)}
              {resolveMenuTitle(item)}
            </Link>
            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${visibilityClass}`}>
              {item.is_visible ? t("admin.menu.states.visible") : t("admin.menu.states.hidden")}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600">
              {kind === "dropdown" ? t("admin.menu.kinds.dropdown") : t("admin.menu.kinds.link")}
            </span>
          </div>
          <div className="mt-1 text-sm text-slate-500">/{item.slug}</div>
          <div className="mt-2 text-sm text-slate-600">{item.path || item.external_url || t("admin.menu.states.noTarget")}</div>
          {item.description && <div className="mt-3 line-clamp-2 text-sm text-slate-600">{item.description}</div>}
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            to={`/content/menu/new?parentId=${item.id}`}
            className="rounded-md border px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            {t("admin.menu.actions.addChild")}
          </Link>
          <Link
            to={`/content/menu/${item.id}`}
            className="rounded-md bg-slate-800 px-3 py-2 text-sm font-medium text-white"
          >
            {t("admin.common.edit")}
          </Link>
        </div>
      </div>

      <div className="mt-4 grid gap-3 text-xs text-slate-500 md:grid-cols-4">
        <div>
          <span className="font-medium text-slate-700">{t("admin.menu.meta.id")}:</span> {item.id}
        </div>
        <div>
          <span className="font-medium text-slate-700">{t("admin.menu.meta.level")}:</span> {item.level}
        </div>
        <div>
          <span className="font-medium text-slate-700">{t("admin.menu.meta.sortOrder")}:</span> {item.sort_order}
        </div>
        <div>
          <span className="font-medium text-slate-700">{t("admin.menu.meta.children")}:</span> {item.children.length}
        </div>
      </div>
    </div>
  );
}
