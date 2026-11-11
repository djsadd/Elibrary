import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "@/shared/api/client";
import { getLang, t } from "@/shared/i18n";

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
  description_ru?: string | null;
  description_kk?: string | null;
  description_en?: string | null;
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
/* Descriptions (authors only), icons, delete, create modal            */
/* ------------------------------------------------------------------ */

type I18nDescriptions = Record<`description_${NameLang}`, string>;
const EMPTY_DESCRIPTIONS: I18nDescriptions = { description_ru: "", description_kk: "", description_en: "" };

/** Only authors have a description. */
const hasDescription = (kind: TaxonomyKind) => kind === "authors";

function descriptionsOf(item?: TaxonomyItem | null): I18nDescriptions {
  return {
    description_ru: item?.description_ru || "",
    description_kk: item?.description_kk || "",
    description_en: item?.description_en || "",
  };
}

function trimDescriptions(d: I18nDescriptions): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const lang of LANGS) out[`description_${lang}`] = d[`description_${lang}`].trim() || null;
  return out;
}

export function DescriptionFields({
  value,
  onChange,
}: {
  value: I18nDescriptions;
  onChange: (next: I18nDescriptions) => void;
}) {
  const [tab, setTab] = useState<NameLang>(() => {
    const lang = getLang();
    return (LANGS as readonly string[]).includes(lang) ? (lang as NameLang) : "ru";
  });
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-slate-700">{t("admin.taxonomy.description.label")}</span>
        <div className="flex gap-1" role="tablist">
          {LANGS.map((lang) => {
            const filled = Boolean(value[`description_${lang}`].trim());
            return (
              <button
                key={lang}
                type="button"
                role="tab"
                aria-selected={tab === lang}
                onClick={() => setTab(lang)}
                className={`text-xs px-2 py-1 rounded border ${
                  tab === lang ? "bg-[#b51e3e] border-[#b51e3e] text-white" : "bg-white hover:bg-slate-50"
                }`}
              >
                {t(`admin.taxonomy.names.${lang}`)}
                {filled && tab !== lang ? <span className="ml-1 text-emerald-600">●</span> : null}
              </button>
            );
          })}
        </div>
      </div>
      <textarea
        className="mt-1 w-full border rounded px-3 py-2 text-sm min-h-[120px]"
        value={value[`description_${tab}`]}
        onChange={(e) => onChange({ ...value, [`description_${tab}`]: e.target.value })}
        maxLength={20000}
      />
    </div>
  );
}

const iconProps = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const EyeIcon = () => (
  <svg {...iconProps}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const PencilIcon = () => (
  <svg {...iconProps}>
    <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    <path d="m15 5 4 4" />
  </svg>
);

const TrashIcon = () => (
  <svg {...iconProps}>
    <path d="M3 6h18" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M10 11v6M14 11v6" />
  </svg>
);

const iconBtn =
  "w-8 h-8 inline-flex items-center justify-center rounded-md border border-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-transparent";

/** Eye / pencil / trash. Trash is disabled while books are linked. */
function RowActions({
  kind,
  item,
  booksCount,
  onDeleted,
}: {
  kind: TaxonomyKind;
  item: TaxonomyItem;
  booksCount: number;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [toLangOpen, setToLangOpen] = useState(false);
  // a subject with books can still be removed: its books get a language instead
  const canConvert = kind === "subjects" && booksCount > 0;
  const blocked = booksCount > 0 && !canConvert;

  async function onDelete() {
    if (canConvert) {
      setToLangOpen(true);
      return;
    }
    if (blocked || busy) return;
    if (!window.confirm(t("admin.taxonomy.row.deleteConfirm", { name: item.name }))) return;
    try {
      setBusy(true);
      await api(`/api/catalog/${kind}/${item.id}`, { method: "DELETE" });
      onDeleted();
    } catch (e: unknown) {
      window.alert(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-0.5 shrink-0">
      <Link to={`/admin/${kind}/${item.id}`} className={iconBtn} title={t("admin.taxonomy.row.view")} aria-label={t("admin.taxonomy.row.view")}>
        <EyeIcon />
      </Link>
      <Link to={`/admin/${kind}/${item.id}/edit`} className={iconBtn} title={t("admin.taxonomy.row.edit")} aria-label={t("admin.taxonomy.row.edit")}>
        <PencilIcon />
      </Link>
      {/* span keeps the tooltip working on a disabled button */}
      <span
        title={
          blocked
            ? t("admin.taxonomy.row.deleteBlocked", { n: booksCount })
            : canConvert
              ? t("admin.taxonomy.toLang.tooltip", { n: booksCount })
              : t("admin.taxonomy.row.delete")
        }
      >
        <button
          type="button"
          onClick={onDelete}
          disabled={blocked || busy}
          aria-label={t("admin.taxonomy.row.delete")}
          className={`${iconBtn} ${blocked ? "" : "hover:!text-red-600 hover:!bg-red-50"}`}
        >
          <TrashIcon />
        </button>
      </span>
      {toLangOpen ? (
        <ToLanguageModal
          item={item}
          booksCount={booksCount}
          onClose={() => setToLangOpen(false)}
          onDone={() => {
            setToLangOpen(false);
            onDeleted();
          }}
        />
      ) : null}
    </div>
  );
}

const BOOK_LANGS = ["Russian", "English", "Kazakh"] as const;

/** Pre-select the language when the subject name obviously is one ("Russian", "Русский", "Қазақша"...). */
function guessBookLang(item: TaxonomyItem): string {
  const text = [item.name, item.name_ru, item.name_kk, item.name_en].filter(Boolean).join(" ").toLowerCase();
  if (/kazakh|казах|қазақ|kaz\b|\bkk\b/.test(text)) return "Kazakh";
  if (/english|англ|ағылшын|\ben\b|\beng\b/.test(text)) return "English";
  if (/russian|рус|орыс|\bru\b|\brus\b/.test(text)) return "Russian";
  return "";
}

/** Delete a subject and assign the chosen language to all of its books. */
function ToLanguageModal({
  item,
  booksCount,
  onClose,
  onDone,
}: {
  item: TaxonomyItem;
  booksCount: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const [lang, setLang] = useState<string>(() => guessBookLang(item));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (busy) return;
    if (!lang) {
      setError(t("admin.taxonomy.toLang.pickLang"));
      return;
    }
    try {
      setBusy(true);
      setError(null);
      await api(`/api/catalog/subjects/${item.id}/to-language`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang }),
      });
      onDone();
    } catch (e: unknown) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell
      title={t("admin.taxonomy.toLang.title", { name: item.name })}
      busy={busy}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className="px-3 py-2 border rounded bg-white hover:bg-slate-50 text-sm">
            {t("admin.taxonomy.merge.cancel")}
          </button>
          <button
            type="button"
            onClick={run}
            disabled={busy || !lang}
            className="px-4 py-2 rounded bg-[#b51e3e] text-white text-sm hover:bg-rose-800 disabled:opacity-60"
          >
            {busy ? t("admin.taxonomy.toLang.running") : t("admin.taxonomy.toLang.run")}
          </button>
        </>
      }
    >
      <div className="text-sm text-slate-600">{t("admin.taxonomy.toLang.hint", { n: booksCount })}</div>
      <label className="block">
        <span className="text-sm text-slate-700">{t("admin.taxonomy.toLang.lang")}</span>
        <select
          className="mt-1 w-full border rounded px-3 py-2 text-sm"
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          disabled={busy}
        >
          <option value="">{t("admin.taxonomy.toLang.pickLang")}</option>
          {BOOK_LANGS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </label>
      {error && <div className="text-sm text-red-600">{error}</div>}
    </ModalShell>
  );
}

function ModalShell({
  title,
  busy,
  onClose,
  children,
  footer,
}: {
  title: string;
  busy?: boolean;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-2xl max-h-[90vh] overflow-auto bg-white rounded-lg shadow-xl">
        <div className="flex items-center justify-between gap-2 px-5 py-4 border-b">
          <div className="text-base font-semibold">{title}</div>
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
        <div className="px-5 py-4 space-y-4">{children}</div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t bg-slate-50 rounded-b-lg">{footer}</div>
      </div>
    </div>
  );
}

function CreateModal({ kind, onClose, onCreated }: { kind: TaxonomyKind; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [names, setNames] = useState<I18nNames>(EMPTY_NAMES);
  const [descriptions, setDescriptions] = useState<I18nDescriptions>(EMPTY_DESCRIPTIONS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (busy) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("admin.taxonomy.errors.nameRequired"));
      return;
    }
    try {
      setBusy(true);
      setError(null);
      await api(`/api/catalog/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          ...trimNames(names),
          ...(hasDescription(kind) ? trimDescriptions(descriptions) : {}),
        }),
      });
      onCreated();
    } catch (err: unknown) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell
      title={t(`admin.taxonomy.create.${kind}`)}
      busy={busy}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className="px-3 py-2 border rounded bg-white hover:bg-slate-50 text-sm">
            {t("admin.taxonomy.merge.cancel")}
          </button>
          <button
            type="button"
            onClick={() => submit()}
            disabled={busy}
            className="px-4 py-2 rounded bg-[#b51e3e] text-white text-sm hover:bg-rose-800 disabled:opacity-60"
          >
            {busy ? t("admin.taxonomy.create.creating") : t("admin.taxonomy.create.submit")}
          </button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="text-sm text-slate-700">{t("admin.taxonomy.names.main")} *</span>
          <input
            className="mt-1 w-full border rounded px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t(`admin.taxonomy.${kind}.namePlaceholder`)}
            maxLength={256}
            autoFocus
          />
        </label>
        <I18nNameFields value={names} onChange={setNames} />
        {hasDescription(kind) ? <DescriptionFields value={descriptions} onChange={setDescriptions} /> : null}
        {error && <div className="text-sm text-red-600">{error}</div>}
        <button type="submit" hidden />
      </form>
    </ModalShell>
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

  const [createOpen, setCreateOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  function flash(message: string) {
    setNotice(message);
    setTimeout(() => setNotice(null), 2500);
  }

  // selection survives searching and paging, so duplicates with different spellings can be collected
  const [selected, setSelected] = useState<Map<string, TaxonomyItem>>(new Map());
  const [mergeOpen, setMergeOpen] = useState(false);

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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t(`${tk}.heading`)}</h2>
          <div className="text-slate-500 text-sm">{t(`${tk}.subheading`)}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {notice && <span className="text-sm text-emerald-600">{notice}</span>}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t(`${tk}.searchPlaceholder`)}
            className="px-3 py-2 rounded-md border border-slate-200 text-sm min-w-[220px]"
          />
          <ActionsMenu count={selected.size} onMerge={() => setMergeOpen(true)} onClear={() => setSelected(new Map())} />
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="px-4 py-2 rounded-md bg-[#b51e3e] text-white text-sm hover:bg-rose-800"
          >
            + {t(`admin.taxonomy.create.${kind}`)}
          </button>
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
                  <RowActions
                    kind={kind}
                    item={item}
                    booksCount={item.books_count ?? 0}
                    onDeleted={() => {
                      setSelected((prev) => {
                        const next = new Map(prev);
                        next.delete(String(item.id));
                        return next;
                      });
                      flash(t("admin.taxonomy.row.deleted"));
                      setRefreshTick((x) => x + 1);
                    }}
                  />
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
            flash(t("admin.taxonomy.merge.done"));
            setRefreshTick((x) => x + 1);
          }}
        />
      ) : null}

      {createOpen ? (
        <CreateModal
          kind={kind}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            flash(t("admin.taxonomy.errors.addedOk"));
            setRefreshTick((x) => x + 1);
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
  const [descriptions, setDescriptions] = useState<I18nDescriptions>(EMPTY_DESCRIPTIONS);
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
          setDescriptions(descriptionsOf(data));
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
        body: JSON.stringify({
          name: trimmed,
          ...trimNames(names),
          ...(hasDescription(kind) ? trimDescriptions(descriptions) : {}),
        }),
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
          {hasDescription(kind) ? <DescriptionFields value={descriptions} onChange={setDescriptions} /> : null}
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

/* ------------------------------------------------------------------ */
/* View page (eye icon): profile, description and analytics            */
/* ------------------------------------------------------------------ */

type NamedCount = { key: string; count: number };

type TaxonomyStats = {
  books_total: number;
  books_public: number;
  books_hidden: number;
  readers_total: number;
  reading: number;
  finished: number;
  dropped: number;
  avg_progress: number | null;
  years: string | null;
  by_lang: NamedCount[];
  by_format: NamedCount[];
  related: NamedCount[];
  books: {
    id: number;
    title: string;
    year?: string | null;
    lang?: string | null;
    is_public: boolean;
    formats: string[];
    readers: number;
    reading: number;
    finished: number;
  }[];
};

function StatTile({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="bg-white border rounded-md p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</div>
      {hint ? <div className="mt-0.5 text-xs text-slate-500">{hint}</div> : null}
    </div>
  );
}

function Distribution({ title, rows }: { title: string; rows: NamedCount[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="bg-white border rounded-md p-4">
      <div className="text-sm font-medium text-slate-700 mb-3">{title}</div>
      {rows.length === 0 ? (
        <div className="text-sm text-slate-400">{t("admin.taxonomy.view.noData")}</div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.key} className="text-sm">
              <div className="flex justify-between gap-2">
                <span className="truncate text-slate-700">{r.key}</span>
                <span className="tabular-nums text-slate-500">{r.count}</span>
              </div>
              <div className="mt-1 h-1.5 rounded bg-slate-100">
                <div className="h-1.5 rounded bg-[#b51e3e]" style={{ width: `${(r.count / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TaxonomyViewPage({ kind }: { kind: TaxonomyKind }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<TaxonomyDetail | null>(null);
  const [stats, setStats] = useState<TaxonomyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [descLang, setDescLang] = useState<NameLang>(() => {
    const lang = getLang();
    return (LANGS as readonly string[]).includes(lang) ? (lang as NameLang) : "ru";
  });
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        if (!id) throw new Error("Missing id");
        const [detail, st] = await Promise.all([
          api<TaxonomyDetail>(`/api/catalog/${kind}/${id}`),
          api<TaxonomyStats>(`/api/catalog/${kind}/${id}/stats`),
        ]);
        if (cancelled) return;
        setItem(detail || null);
        setStats(st || null);
        // show the first language that actually has a description
        if (hasDescription(kind) && detail && !(detail[`description_${descLang}`] || "").trim()) {
          const filled = LANGS.find((l) => (detail[`description_${l}`] || "").trim());
          if (filled) setDescLang(filled);
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
  }, [id, kind]); // eslint-disable-line react-hooks/exhaustive-deps

  const booksTotal = stats?.books_total ?? 0;
  const blocked = booksTotal > 0;

  async function onDelete() {
    if (!item || blocked || deleting) return;
    if (!window.confirm(t("admin.taxonomy.row.deleteConfirm", { name: item.name }))) return;
    try {
      setDeleting(true);
      await api(`/api/catalog/${kind}/${item.id}`, { method: "DELETE" });
      navigate(`/admin/${kind}`);
    } catch (e: unknown) {
      window.alert(errorText(e));
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <div className="text-slate-500">{t("admin.taxonomy.edit.loading")}</div>;
  if (!item) {
    return error ? <div className="text-red-600">{error}</div> : <div className="text-slate-500">{t("admin.taxonomy.edit.notFound")}</div>;
  }

  const description = hasDescription(kind) ? (item[`description_${descLang}`] || "").trim() : "";

  return (
    <div className="space-y-4">
      <Link to={`/admin/${kind}`} className="text-sm text-[#b51e3e] hover:underline">
        ← {t("admin.taxonomy.view.back")}
      </Link>

      <div className="admin-editor-banner flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xl font-semibold break-words">{item.name}</div>
          <div className="text-sm opacity-90">ID: {item.id}</div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to={`/admin/${kind}/${item.id}/edit`}
            className="px-3 py-2 rounded-md bg-white/90 text-slate-800 text-sm inline-flex items-center gap-2 hover:bg-white"
          >
            <PencilIcon /> {t("admin.taxonomy.row.edit")}
          </Link>
          <span title={blocked ? t("admin.taxonomy.row.deleteBlocked", { n: booksTotal }) : undefined}>
            <button
              type="button"
              onClick={onDelete}
              disabled={blocked || deleting}
              className="px-3 py-2 rounded-md bg-white/90 text-red-700 text-sm inline-flex items-center gap-2 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <TrashIcon /> {t("admin.taxonomy.row.delete")}
            </button>
          </span>
        </div>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className={`grid gap-4 ${hasDescription(kind) ? "lg:grid-cols-3" : ""}`}>
        <div className="bg-white border rounded-md p-4">
          <div className="text-sm font-medium text-slate-700 mb-3">{t("admin.taxonomy.view.translations")}</div>
          <dl className="space-y-2 text-sm">
            {LANGS.map((lang) => (
              <div key={lang} className="flex gap-3">
                <dt className="w-24 shrink-0 text-slate-500">{t(`admin.taxonomy.names.${lang}`)}</dt>
                <dd className={item[`name_${lang}`] ? "text-slate-800" : "text-slate-400"}>{item[`name_${lang}`] || "—"}</dd>
              </div>
            ))}
          </dl>
        </div>

        {hasDescription(kind) ? (
          <div className="bg-white border rounded-md p-4 lg:col-span-2">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="text-sm font-medium text-slate-700">{t("admin.taxonomy.description.label")}</div>
              <div className="flex gap-1" role="tablist">
                {LANGS.map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    role="tab"
                    aria-selected={descLang === lang}
                    onClick={() => setDescLang(lang)}
                    className={`text-xs px-2 py-1 rounded border ${
                      descLang === lang ? "bg-[#b51e3e] border-[#b51e3e] text-white" : "bg-white hover:bg-slate-50"
                    }`}
                  >
                    {lang.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            {description ? (
              <p className="text-sm text-slate-700 whitespace-pre-line">{description}</p>
            ) : (
              <p className="text-sm text-slate-400">
                {t("admin.taxonomy.description.empty")}{" "}
                <Link to={`/admin/${kind}/${item.id}/edit`} className="text-[#b51e3e] hover:underline">
                  {t("admin.taxonomy.row.edit")}
                </Link>
              </p>
            )}
          </div>
        ) : null}
      </div>

      {stats ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <StatTile
              label={t("admin.taxonomy.view.books")}
              value={stats.books_total}
              hint={`${stats.books_public} ${t("admin.taxonomy.view.public")} · ${stats.books_hidden} ${t("admin.taxonomy.view.hidden")}`}
            />
            <StatTile label={t("admin.taxonomy.view.readers")} value={stats.readers_total} />
            <StatTile label={t("admin.taxonomy.view.reading")} value={stats.reading} />
            <StatTile
              label={t("admin.taxonomy.view.finished")}
              value={stats.finished}
              hint={stats.dropped ? `${t("admin.taxonomy.view.dropped")}: ${stats.dropped}` : undefined}
            />
            <StatTile label={t("admin.taxonomy.view.avgProgress")} value={stats.avg_progress != null ? `${stats.avg_progress}%` : "—"} />
            <StatTile label={t("admin.taxonomy.view.years")} value={<span className="text-lg">{stats.years || "—"}</span>} />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Distribution title={t("admin.taxonomy.view.byLang")} rows={stats.by_lang} />
            <Distribution title={t("admin.taxonomy.view.byFormat")} rows={stats.by_format} />
            <Distribution
              title={t(kind === "authors" ? "admin.taxonomy.view.relatedAuthors" : "admin.taxonomy.view.relatedSubjects")}
              rows={stats.related}
            />
          </div>

          <div className="bg-white border rounded-md">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div className="text-sm font-medium text-slate-700">{t("admin.taxonomy.view.books")}</div>
              <div className="text-xs text-slate-500">{stats.books.length}</div>
            </div>
            {stats.books.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">{t("admin.taxonomy.edit.noBooks")}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th className="text-left font-medium px-4 py-2">{t("admin.taxonomy.view.title")}</th>
                      <th className="text-left font-medium px-4 py-2">{t("admin.taxonomy.view.year")}</th>
                      <th className="text-left font-medium px-4 py-2">{t("admin.taxonomy.view.lang")}</th>
                      <th className="text-left font-medium px-4 py-2">{t("admin.taxonomy.view.status")}</th>
                      <th className="text-right font-medium px-4 py-2">{t("admin.taxonomy.view.readers")}</th>
                      <th className="text-right font-medium px-4 py-2">{t("admin.taxonomy.view.reading")}</th>
                      <th className="text-right font-medium px-4 py-2">{t("admin.taxonomy.view.finished")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {stats.books.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2">
                          <Link to={`/admin/books/${b.id}`} className="text-slate-800 hover:text-[#b51e3e] hover:underline">
                            {b.title}
                          </Link>
                          {b.formats.length ? <div className="text-xs text-slate-400">{b.formats.join(", ")}</div> : null}
                        </td>
                        <td className="px-4 py-2 text-slate-600">{b.year || "—"}</td>
                        <td className="px-4 py-2 text-slate-600">{b.lang || "—"}</td>
                        <td className="px-4 py-2">
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${
                              b.is_public ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {b.is_public ? t("admin.taxonomy.view.publicBadge") : t("admin.taxonomy.view.hiddenBadge")}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">{b.readers}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{b.reading}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{b.finished}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
