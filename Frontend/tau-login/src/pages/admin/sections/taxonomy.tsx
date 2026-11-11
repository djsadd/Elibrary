import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "@/shared/api/client";
import { t } from "@/shared/i18n";

/**
 * Shared admin UI for authors and subjects (categories):
 * - names in three languages (name_ru / name_kk / name_en) next to the main `name`
 * - merging several duplicates into one record with a new name
 */

export type TaxonomyKind = "authors" | "subjects";

const LANGS = ["ru", "kk", "en"] as const;
type NameLang = (typeof LANGS)[number];
type I18nNames = Record<`name_${NameLang}`, string>;

export type TaxonomyItem = {
  id: number | string;
  name: string;
  name_ru?: string | null;
  name_kk?: string | null;
  name_en?: string | null;
  books_count?: number;
};

type TaxonomyBook = {
  id: number | string;
  title: string;
  authors?: { id: number | string; name: string }[];
  formats?: string[];
};

type TaxonomyDetail = TaxonomyItem & { books?: TaxonomyBook[] };

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

const EMPTY_NAMES: I18nNames = { name_ru: "", name_kk: "", name_en: "" };

function namesOf(item?: TaxonomyItem | null): I18nNames {
  return {
    name_ru: item?.name_ru || "",
    name_kk: item?.name_kk || "",
    name_en: item?.name_en || "",
  };
}

function trimNames(names: I18nNames): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const lang of LANGS) {
    const v = names[`name_${lang}`].trim();
    out[`name_${lang}`] = v || null;
  }
  return out;
}

function translationsLine(item: TaxonomyItem): string {
  return LANGS.map((lang) => {
    const v = (item[`name_${lang}`] || "").trim();
    return v && v !== item.name ? `${lang.toUpperCase()}: ${v}` : "";
  })
    .filter(Boolean)
    .join(" · ");
}

function langBadges(item: TaxonomyItem) {
  return (
    <div className="flex gap-1 shrink-0">
      {LANGS.map((lang) => {
        const filled = Boolean((item[`name_${lang}`] || "").trim());
        return (
          <span
            key={lang}
            title={filled ? String(item[`name_${lang}`]) : undefined}
            className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
              filled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400"
            }`}
          >
            {lang}
          </span>
        );
      })}
    </div>
  );
}

export function I18nNameFields({
  value,
  onChange,
}: {
  value: I18nNames;
  onChange: (next: I18nNames) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {LANGS.map((lang) => (
          <label key={lang} className="block">
            <span className="text-xs text-slate-600">{t(`admin.taxonomy.names.${lang}`)}</span>
            <input
              className="mt-1 w-full border rounded px-3 py-2 text-sm"
              value={value[`name_${lang}`]}
              onChange={(e) => onChange({ ...value, [`name_${lang}`]: e.target.value })}
              maxLength={256}
            />
          </label>
        ))}
      </div>
      <div className="text-xs text-slate-500">{t("admin.taxonomy.names.hint")}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* List page: search, create, pagination, "Actions" → merge modal      */
/* ------------------------------------------------------------------ */

type PageResponse = { items: TaxonomyItem[]; page: { limit: number; offset: number; total: number } };

const PAGE_SIZES = [25, 50, 100, 200];

function MergeModal({
  kind,
  selected,
  onClose,
  onMerged,
}: {
  kind: TaxonomyKind;
  selected: TaxonomyItem[];
  onClose: () => void;
  onMerged: () => void;
}) {
  const [mainId, setMainId] = useState<string>(String(selected[0]?.id ?? ""));
  const [name, setName] = useState("");
  const [names, setNames] = useState<I18nNames>(EMPTY_NAMES);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const main = selected.find((s) => String(s.id) === mainId) || selected[0];

  // prefill name and translations from the main record, then from the duplicates
  useEffect(() => {
    if (!main) return;
    setName(main.name);
    const next = { ...EMPTY_NAMES };
    for (const lang of LANGS) {
      const key = `name_${lang}` as const;
      const own = (main[key] || "").trim();
      const fromOthers = selected.map((s) => (s[key] || "").trim()).find(Boolean) || "";
      next[key] = own || fromOthers;
    }
    setNames(next);
    setError(null);
  }, [mainId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Esc closes, page behind does not scroll
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [busy, onClose]);

  async function run() {
    if (!main || busy) return;
    const finalName = name.trim() || main.name;
    if (!window.confirm(t("admin.taxonomy.merge.confirm", { n: selected.length, name: finalName }))) return;
    try {
      setBusy(true);
      setError(null);
      await api(`/api/catalog/${kind}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_id: Number(main.id),
          source_ids: selected.filter((s) => s.id !== main.id).map((s) => Number(s.id)),
          name: finalName,
          ...trimNames(names),
        }),
      });
      onMerged();
    } catch (e: unknown) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`merge-title-${kind}`}
        className="w-full max-w-2xl max-h-[90vh] overflow-auto bg-white rounded-lg shadow-xl"
      >
        <div className="flex items-center justify-between gap-2 px-5 py-4 border-b">
          <div id={`merge-title-${kind}`} className="text-base font-semibold">
            {t("admin.taxonomy.merge.title")} · {t("admin.taxonomy.merge.selected", { n: selected.length })}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label={t("admin.taxonomy.merge.cancel")}
            className="w-8 h-8 rounded hover:bg-slate-100 text-slate-500 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="text-sm text-slate-600">{t("admin.taxonomy.merge.hint")}</div>

          <ul className="border rounded divide-y">
            {selected.map((s) => {
              const isMain = String(s.id) === String(main?.id);
              return (
                <li key={String(s.id)}>
                  <label className={`px-3 py-2 flex items-center gap-3 cursor-pointer ${isMain ? "bg-rose-50/60" : ""}`}>
                    <input
                      type="radio"
                      name={`merge-main-${kind}`}
                      checked={isMain}
                      onChange={() => setMainId(String(s.id))}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">
                        {s.name}
                        {isMain ? (
                          <span className="ml-2 text-[10px] font-semibold uppercase text-[#b51e3e]">
                            {t("admin.taxonomy.merge.main")}
                          </span>
                        ) : null}
                      </div>
                      {translationsLine(s) ? <div className="text-xs text-slate-500 truncate">{translationsLine(s)}</div> : null}
                    </div>
                    <span className="text-xs text-slate-500 shrink-0">
                      {t("admin.taxonomy.booksCount", { n: s.books_count ?? 0 })}
                    </span>
                    <span className="text-xs text-slate-400 shrink-0">#{s.id}</span>
                  </label>
                </li>
              );
            })}
          </ul>

          <label className="block">
            <span className="text-sm text-slate-700">{t("admin.taxonomy.merge.newName")}</span>
            <input
              className="mt-1 w-full border rounded px-3 py-2 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={256}
              autoFocus
            />
          </label>
          <I18nNameFields value={names} onChange={setNames} />
          {error && <div className="text-sm text-red-600">{error}</div>}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t bg-slate-50 rounded-b-lg">
          <button type="button" onClick={onClose} disabled={busy} className="px-3 py-2 border rounded bg-white hover:bg-slate-50 text-sm">
            {t("admin.taxonomy.merge.cancel")}
          </button>
          <button
            type="button"
            onClick={run}
            disabled={busy}
            className="px-4 py-2 rounded bg-[#b51e3e] text-white text-sm hover:bg-rose-800 disabled:opacity-60"
          >
            {busy ? t("admin.taxonomy.merge.running") : t("admin.taxonomy.merge.run")}
          </button>
        </div>
      </div>
    </div>
  );
}

function ActionsMenu({
  count,
  onMerge,
  onClear,
}: {
  count: number;
  onMerge: () => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const canMerge = count >= 2;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="px-3 py-2 rounded-md border border-slate-200 bg-white text-sm hover:bg-slate-50 flex items-center gap-2"
      >
        {t("admin.taxonomy.actions.label")}
        {count > 0 ? (
          <span className="min-w-5 h-5 px-1.5 rounded-full bg-[#b51e3e] text-white text-xs flex items-center justify-center">
            {count}
          </span>
        ) : null}
        <span aria-hidden="true" className="text-xs">▾</span>
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 z-20 mt-1 w-64 bg-white border rounded-md shadow-lg py-1">
          <button
            type="button"
            role="menuitem"
            disabled={!canMerge}
            onClick={() => {
              setOpen(false);
              onMerge();
            }}
            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 disabled:text-slate-400 disabled:hover:bg-transparent"
          >
            {t("admin.taxonomy.actions.merge")}
            {!canMerge ? <div className="text-xs text-slate-400">{t("admin.taxonomy.actions.needTwo")}</div> : null}
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={count === 0}
            onClick={() => {
              setOpen(false);
              onClear();
            }}
            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 disabled:text-slate-400 disabled:hover:bg-transparent"
          >
            {t("admin.taxonomy.actions.clearSelection")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function pageNumbers(current: number, totalPages: number): (number | "gap")[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i);
  const out: (number | "gap")[] = [0];
  const start = Math.max(1, current - 1);
  const end = Math.min(totalPages - 2, current + 1);
  if (start > 1) out.push("gap");
  for (let i = start; i <= end; i++) out.push(i);
  if (end < totalPages - 2) out.push("gap");
  out.push(totalPages - 1);
  return out;
}

function Pager({
  page,
  pageSize,
  total,
  onPage,
  onPageSize,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
  onPageSize: (n: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  const btn = "min-w-8 h-8 px-2 rounded border text-sm disabled:opacity-40";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t">
      <div className="flex items-center gap-3 text-sm text-slate-600">
        <span>{t("admin.taxonomy.pager.range", { from, to, total })}</span>
        <label className="flex items-center gap-2">
          <span className="text-slate-500">{t("admin.taxonomy.pager.perPage")}</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSize(Number(e.target.value) || PAGE_SIZES[0])}
            className="px-2 py-1 rounded border border-slate-200 text-sm"
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      <nav className="flex items-center gap-1" aria-label="pagination">
        <button type="button" className={`${btn} bg-white hover:bg-slate-50`} disabled={page <= 0} onClick={() => onPage(page - 1)}>
          ‹ <span className="hidden sm:inline">{t("admin.taxonomy.pager.prev")}</span>
        </button>
        {pageNumbers(page, totalPages).map((p, i) =>
          p === "gap" ? (
            <span key={`gap-${i}`} className="px-1 text-slate-400">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPage(p)}
              aria-current={p === page ? "page" : undefined}
              className={`${btn} ${p === page ? "bg-[#b51e3e] border-[#b51e3e] text-white" : "bg-white hover:bg-slate-50"}`}
            >
              {p + 1}
            </button>
          ),
        )}
        <button
          type="button"
          className={`${btn} bg-white hover:bg-slate-50`}
          disabled={page >= totalPages - 1}
          onClick={() => onPage(page + 1)}
        >
          <span className="hidden sm:inline">{t("admin.taxonomy.pager.next")}</span> ›
        </button>
      </nav>
    </div>
  );
}

export function TaxonomyListPage({ kind }: { kind: TaxonomyKind }) {
  const tk = `admin.taxonomy.${kind}`;
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  const [items, setItems] = useState<TaxonomyItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createOk, setCreateOk] = useState<string | null>(null);

  // selection survives searching and paging, so duplicates with different spellings can be collected
  const [selected, setSelected] = useState<Map<string, TaxonomyItem>>(new Map());
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeOk, setMergeOk] = useState<string | null>(null);

  // new search / page size → back to the first page
  useEffect(() => {
    setPage(0);
  }, [q, pageSize]);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        if (q.trim()) params.set("q", q.trim());
        params.set("limit", String(pageSize));
        params.set("offset", String(page * pageSize));
        const data = await api<PageResponse>(`/api/catalog/${kind}/page?${params.toString()}`);
        if (cancelled) return;
        const list = Array.isArray(data?.items) ? data.items : [];
        const count = Number(data?.page?.total) || 0;
        // the last page became empty (e.g. after a merge) → step back
        if (list.length === 0 && page > 0 && count > 0) {
          setPage(Math.max(0, Math.ceil(count / pageSize) - 1));
          return;
        }
        setItems(list);
        setTotal(count);
      } catch (e: unknown) {
        if (!cancelled) setError(errorText(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [kind, q, page, pageSize, refreshTick]);

  const selectedList = useMemo(() => Array.from(selected.values()), [selected]);
  const allOnPageSelected = items.length > 0 && items.every((i) => selected.has(String(i.id)));

  function toggle(item: TaxonomyItem) {
    setSelected((prev) => {
      const next = new Map(prev);
      const key = String(item.id);
      if (next.has(key)) next.delete(key);
      else next.set(key, item);
      return next;
    });
  }

  function togglePage() {
    setSelected((prev) => {
      const next = new Map(prev);
      if (allOnPageSelected) items.forEach((i) => next.delete(String(i.id)));
      else items.forEach((i) => next.set(String(i.id), i));
      return next;
    });
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreateOk(null);
    const name = newName.trim();
    if (!name) {
      setCreateError(t("admin.taxonomy.errors.nameRequired"));
      return;
    }
    if (name.length > 256) {
      setCreateError(t("admin.taxonomy.errors.nameTooLong"));
      return;
    }
    try {
      setCreating(true);
      await api(`/api/catalog/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setNewName("");
      setCreateOk(t("admin.taxonomy.errors.addedOk"));
      setRefreshTick((x) => x + 1);
    } catch (err: unknown) {
      setCreateError(errorText(err));
    } finally {
      setCreating(false);
      setTimeout(() => setCreateOk(null), 1500);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={onCreate} className="bg-white border rounded-md p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm text-slate-600 mb-1">{t(`${tk}.addLabel`)}</label>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t(`${tk}.namePlaceholder`)}
            className="w-full px-3 py-2 rounded-md border border-slate-200 text-sm"
          />
        </div>
        <button type="submit" disabled={creating} className="px-4 py-2 rounded-md bg-[#b51e3e] text-white text-sm disabled:opacity-60">
          {creating ? t(`${tk}.adding`) : t(`${tk}.add`)}
        </button>
        {createError && <div className="text-sm text-red-600">{createError}</div>}
        {createOk && <div className="text-sm text-emerald-600">{createOk}</div>}
      </form>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t(`${tk}.heading`)}</h2>
          <div className="text-slate-500 text-sm">{t(`${tk}.subheading`)}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {mergeOk && <span className="text-sm text-emerald-600">{mergeOk}</span>}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t(`${tk}.searchPlaceholder`)}
            className="px-3 py-2 rounded-md border border-slate-200 text-sm min-w-[220px]"
          />
          <ActionsMenu count={selected.size} onMerge={() => setMergeOpen(true)} onClear={() => setSelected(new Map())} />
        </div>
      </div>

      {error && <div className="text-sm text-red-600">Failed to load: {error}</div>}

      <div className="bg-white border rounded-md">
        <div className="px-4 py-2 flex items-center gap-3 border-b bg-slate-50 text-xs text-slate-500">
          <input type="checkbox" checked={allOnPageSelected} onChange={togglePage} disabled={!items.length} aria-label="select page" />
          <span>{selected.size > 0 ? t("admin.taxonomy.merge.selected", { n: selected.size }) : null}</span>
        </div>
        {loading && items.length === 0 ? (
          <div className="p-6 text-slate-500">{t("admin.taxonomy.edit.loading")}</div>
        ) : items.length === 0 ? (
          <div className="p-6 text-slate-500">{t(`${tk}.empty`)}</div>
        ) : (
          <ul className={`divide-y ${loading ? "opacity-60" : ""}`}>
            {items.map((item) => {
              const isSelected = selected.has(String(item.id));
              const extra = translationsLine(item);
              return (
                <li
                  key={String(item.id)}
                  className={`px-4 py-3 flex items-center gap-3 hover:bg-slate-50 ${isSelected ? "bg-rose-50/60" : ""}`}
                >
                  <input type="checkbox" checked={isSelected} onChange={() => toggle(item)} aria-label={item.name} />
                  <div className="w-8 h-8 rounded-full bg-[#b51e3e]/10 text-[#b51e3e] flex items-center justify-center text-sm font-semibold shrink-0">
                    {(item.name?.[0] || "?").toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-800 truncate">{item.name}</div>
                    {extra ? <div className="text-xs text-slate-500 truncate">{extra}</div> : null}
                  </div>
                  <span className="hidden sm:inline text-xs text-slate-500 shrink-0">
                    {t("admin.taxonomy.booksCount", { n: item.books_count ?? 0 })}
                  </span>
                  {langBadges(item)}
                  <Link to={`/admin/${kind}/${item.id}/edit`} className="text-sm text-[#b51e3e] hover:underline">
                    {t("admin.taxonomy.edit.edit")}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <Pager page={page} pageSize={pageSize} total={total} onPage={setPage} onPageSize={setPageSize} />
      </div>

      {mergeOpen && selectedList.length >= 2 ? (
        <MergeModal
          kind={kind}
          selected={selectedList}
          onClose={() => setMergeOpen(false)}
          onMerged={() => {
            setMergeOpen(false);
            setSelected(new Map());
            setMergeOk(t("admin.taxonomy.merge.done"));
            setRefreshTick((x) => x + 1);
            setTimeout(() => setMergeOk(null), 2500);
          }}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Edit page: main name + three languages                              */
/* ------------------------------------------------------------------ */

export function TaxonomyEditPage({ kind }: { kind: TaxonomyKind }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<TaxonomyDetail | null>(null);
  const [name, setName] = useState("");
  const [names, setNames] = useState<I18nNames>(EMPTY_NAMES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        if (!id) throw new Error("Missing id");
        const data = await api<TaxonomyDetail>(`/api/catalog/${kind}/${id}`);
        if (!cancelled) {
          setItem(data || null);
          setName(data?.name || "");
          setNames(namesOf(data));
        }
      } catch (e: unknown) {
        if (!cancelled) setError(errorText(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, kind]);

  async function onSave() {
    if (!id || saving) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("admin.taxonomy.errors.nameRequired"));
      return;
    }
    try {
      setSaving(true);
      setError(null);
      await api(`/api/catalog/${kind}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, ...trimNames(names) }),
      });
      navigate(`/admin/${kind}`);
    } catch (e: unknown) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="admin-editor-banner">
        <div className="text-xl font-semibold">
          {t(kind === "authors" ? "admin.taxonomy.edit.authorTitle" : "admin.taxonomy.edit.subjectTitle")}
        </div>
        <div className="text-sm opacity-90">ID: {id}</div>
      </div>

      {loading ? (
        <div className="text-slate-500">{t("admin.taxonomy.edit.loading")}</div>
      ) : !item ? (
        error ? <div className="text-red-600">{error}</div> : <div className="text-slate-500">{t("admin.taxonomy.edit.notFound")}</div>
      ) : (
        <div className="bg-white border rounded-md shadow-sm p-4 space-y-4 max-w-2xl">
          <label className="block">
            <span className="text-sm text-slate-700">{t("admin.taxonomy.names.main")}</span>
            <input
              className="mt-1 w-full border rounded px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={256}
            />
          </label>
          <I18nNameFields value={names} onChange={setNames} />
          {error && <div className="text-sm text-red-600">{error}</div>}
          <div className="flex items-center justify-end gap-2">
            <button onClick={() => navigate(-1)} type="button" className="px-3 py-2 border rounded hover:bg-slate-50">
              {t("admin.taxonomy.edit.cancel")}
            </button>
            <button
              onClick={onSave}
              disabled={saving}
              className="px-4 py-2 bg-[#b51e3e] text-white rounded hover:bg-rose-800 disabled:opacity-60"
            >
              {saving ? t("admin.taxonomy.edit.saving") : t("admin.taxonomy.edit.save")}
            </button>
          </div>
        </div>
      )}

      {!loading && item ? (
        <div className="bg-white border rounded-md shadow-sm p-4 max-w-2xl">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-slate-700">{t("admin.taxonomy.edit.books")}</div>
            <div className="text-xs text-slate-500">{item.books?.length || 0}</div>
          </div>
          <div className="mt-3 border rounded-md divide-y max-h-80 overflow-auto">
            {(item.books || []).map((b) => (
              <div key={String(b.id)} className="px-3 py-2 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-slate-800 truncate">{b.title}</div>
                  {b.authors?.length ? (
                    <div className="text-xs text-slate-500 truncate">
                      {b.authors.map((a) => a.name).filter(Boolean).join(", ")}
                    </div>
                  ) : null}
                </div>
                {b.formats?.length ? <div className="text-xs text-slate-500">{b.formats.join(", ")}</div> : null}
              </div>
            ))}
            {!item.books?.length ? (
              <div className="px-3 py-6 text-center text-slate-500 text-sm">{t("admin.taxonomy.edit.noBooks")}</div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
