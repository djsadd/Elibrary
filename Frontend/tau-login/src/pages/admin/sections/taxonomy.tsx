import { useEffect, useMemo, useState } from "react";
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
};

type TaxonomyBook = {
  id: number | string;
  title: string;
  authors?: { id: number | string; name: string }[];
  formats?: string[];
};

type TaxonomyDetail = TaxonomyItem & { books?: TaxonomyBook[] };

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
/* List page: search, create, select & merge                           */
/* ------------------------------------------------------------------ */

function MergePanel({
  kind,
  selected,
  onClear,
  onMerged,
}: {
  kind: TaxonomyKind;
  selected: TaxonomyItem[];
  onClear: () => void;
  onMerged: () => void;
}) {
  const [mainId, setMainId] = useState<string>(String(selected[0]?.id ?? ""));
  const [name, setName] = useState("");
  const [names, setNames] = useState<I18nNames>(EMPTY_NAMES);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const main = selected.find((s) => String(s.id) === mainId) || selected[0];

  // keep a valid main record when selection changes
  useEffect(() => {
    if (!selected.some((s) => String(s.id) === mainId)) setMainId(String(selected[0]?.id ?? ""));
  }, [selected, mainId]);

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
  }, [mainId, selected.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (selected.length === 0) return null;

  async function run() {
    if (!main || busy) return;
    if (selected.length < 2) {
      setError(t("admin.taxonomy.merge.needTwo"));
      return;
    }
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
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white border border-[#b51e3e]/30 rounded-md p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold">
          {t("admin.taxonomy.merge.title")} · {t("admin.taxonomy.merge.selected", { n: selected.length })}
        </div>
        <button type="button" onClick={onClear} className="text-sm text-slate-500 hover:underline">
          {t("admin.taxonomy.merge.clear")}
        </button>
      </div>
      <div className="text-xs text-slate-500">{t("admin.taxonomy.merge.hint")}</div>

      <ul className="border rounded divide-y">
        {selected.map((s) => (
          <li key={String(s.id)} className="px-3 py-2 flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-600 shrink-0">
              <input
                type="radio"
                name={`merge-main-${kind}`}
                checked={String(s.id) === String(main?.id)}
                onChange={() => setMainId(String(s.id))}
              />
              {t("admin.taxonomy.merge.main")}
            </label>
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate">{s.name}</div>
              {translationsLine(s) ? <div className="text-xs text-slate-500 truncate">{translationsLine(s)}</div> : null}
            </div>
            <span className="text-xs text-slate-400">#{s.id}</span>
          </li>
        ))}
      </ul>

      <label className="block">
        <span className="text-xs text-slate-600">{t("admin.taxonomy.merge.newName")}</span>
        <input
          className="mt-1 w-full border rounded px-3 py-2 text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={256}
        />
      </label>
      <I18nNameFields value={names} onChange={setNames} />

      <div className="flex items-center justify-end gap-3">
        {error && <div className="text-sm text-red-600 mr-auto">{error}</div>}
        <button
          type="button"
          onClick={run}
          disabled={busy || selected.length < 2}
          className="px-4 py-2 rounded-md bg-[#b51e3e] text-white text-sm disabled:opacity-60"
        >
          {busy ? t("admin.taxonomy.merge.running") : t("admin.taxonomy.merge.run")}
        </button>
      </div>
    </div>
  );
}

export function TaxonomyListPage({ kind }: { kind: TaxonomyKind }) {
  const tk = `admin.taxonomy.${kind}`;
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(50);
  const [items, setItems] = useState<TaxonomyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createOk, setCreateOk] = useState<string | null>(null);

  // selection survives searching, so duplicates with different spellings can be collected
  const [selected, setSelected] = useState<Map<string, TaxonomyItem>>(new Map());
  const [mergeOk, setMergeOk] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        if (q.trim()) params.set("q", q.trim());
        if (limit) params.set("limit", String(limit));
        const data = await api<TaxonomyItem[]>(`/api/catalog/${kind}/details${params.size ? `?${params.toString()}` : ""}`);
        if (!cancelled) setItems(Array.isArray(data) ? data : []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [kind, q, limit, refreshTick]);

  const grouped = useMemo(() => {
    const map = new Map<string, TaxonomyItem[]>();
    for (const item of items) {
      const key = (item?.name?.[0] || "?").toUpperCase();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [items]);

  const selectedList = useMemo(() => Array.from(selected.values()), [selected]);

  function toggle(item: TaxonomyItem) {
    setSelected((prev) => {
      const next = new Map(prev);
      const key = String(item.id);
      if (next.has(key)) next.delete(key);
      else next.set(key, item);
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
    } catch (err: any) {
      setCreateError(err?.message || String(err));
    } finally {
      setCreating(false);
      setTimeout(() => setCreateOk(null), 1500);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={onCreate} className="bg-white border rounded-md p-4 flex items-end gap-3">
        <div className="flex-1">
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

      <MergePanel
        key={kind}
        kind={kind}
        selected={selectedList}
        onClear={() => setSelected(new Map())}
        onMerged={() => {
          setSelected(new Map());
          setMergeOk(t("admin.taxonomy.merge.done"));
          setRefreshTick((x) => x + 1);
          setTimeout(() => setMergeOk(null), 2000);
        }}
      />
      {mergeOk && <div className="text-sm text-emerald-600">{mergeOk}</div>}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t(`${tk}.heading`)}</h2>
          <div className="text-slate-500 text-sm">{t(`${tk}.subheading`)}</div>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t(`${tk}.searchPlaceholder`)}
            className="px-3 py-2 rounded-md border border-slate-200 text-sm min-w-[220px]"
          />
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value) || 50)}
            className="px-2 py-2 rounded-md border border-slate-200 text-sm"
          >
            {[25, 50, 100, 150, 200].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="text-sm text-red-600">Failed to load: {error}</div>}

      <div className="bg-white border rounded-md">
        {loading ? (
          <div className="p-6 text-slate-500">{t("admin.taxonomy.edit.loading")}</div>
        ) : grouped.length === 0 ? (
          <div className="p-6 text-slate-500">{t(`${tk}.empty`)}</div>
        ) : (
          grouped.map(([letter, group]) => (
            <div key={letter}>
              <div className="px-4 py-2 text-xs font-semibold uppercase text-slate-500 bg-slate-50 border-b">{letter}</div>
              <ul className="divide-y">
                {group.map((item) => {
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
                      {langBadges(item)}
                      <Link to={`/admin/${kind}/${item.id}/edit`} className="text-sm text-[#b51e3e] hover:underline">
                        {t("admin.taxonomy.edit.edit")}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>
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
      } catch (e: any) {
        if (!cancelled) setError(e?.message || String(e));
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
    } catch (e: any) {
      setError(e?.message || String(e));
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
