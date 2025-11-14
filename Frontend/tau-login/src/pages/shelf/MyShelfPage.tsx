import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DashboardHeader from "@/components/layout/DashboardHeader";
import { api } from "@/shared/api/client";
import { t } from "@/shared/i18n";
import bookImg from "@/assets/images/image.png";

type AuthorMin = { id: number | string; name: string };
type BookMin = { id: number | string; title: string; cover?: string | null; authors?: AuthorMin[]; formats?: string[] | string | null };
type UserBook = {
  id: number | string;
  current_page?: number | null;
  total_pages?: number | null;
  progress_percent?: number | null;
  status?: string | null;
  reading_time?: number | null;
  book: BookMin;
};

export default function MyShelfPage() {
  const [items, setItems] = useState<UserBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  type TabKey = "EBOOK" | "AUDIOBOOK" | "VIDEOBOOK" | "INTERACTIVE" | "HARDCOPY";
  const [tab, setTab] = useState<TabKey>("EBOOK");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await api<UserBook[]>("/api/catalog/userbook");
        if (!cancelled) {
          try {
            console.groupCollapsed("[MyShelf] GET /api/catalog/userbook");
            console.info("Raw response:", data);
            const rows = (Array.isArray(data) ? data : []).map((ub: any) => {
              const b = ub?.book || {};
              const raw = (b as any)?.formats;
              const arr = Array.isArray(raw) ? raw : (raw ? [raw] : []);
              const norm = arr.map((v: any) => {
                const s = typeof v === 'string' ? v : (v?.id ?? v?.code ?? v?.value ?? v?.name ?? '');
                return String(s).toUpperCase().replace(/[^A-Z]/g, '').replace(/^EBOOKS?$/, 'EBOOK').replace(/^AUDIOBOOKS?$/, 'AUDIOBOOK').replace(/^VIDEOBOOKS?$/, 'VIDEOBOOK');
              });
              return {
                userbook_id: String(ub?.id ?? ''),
                book_id: String(b?.id ?? ''),
                title: String(b?.title ?? ''),
                formats_raw: JSON.stringify(raw ?? null),
                formats_norm: norm.join(',') || '-'
              };
            });
            try { console.table(rows); } catch { console.log(rows); }
            console.groupEnd();
          } catch {}
          setItems(Array.isArray(data) ? data : []);
        }
      } catch (e: any) {
        if (!cancelled) {
          try {
            console.warn("[MyShelf] GET /api/catalog/userbook failed:", e?.message || String(e));
            if (e && e.stack) console.debug(e.stack);
          } catch {}
          setError(e?.message || String(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const normCode = (s: string) => s
    .toUpperCase()
    .replace(/[^A-Z]/g, "") // drop spaces/dashes (E-Book -> EBOOK)
    .replace(/^EBOOKS?$/, "EBOOK")
    .replace(/^AUDIOBOOKS?$/, "AUDIOBOOK")
    .replace(/^VIDEOBOOKS?$/, "VIDEOBOOK");

  const normalizedFormats = (b: BookMin): string[] => {
    const raw: any = (b as any)?.formats;
    const arr: any[] = Array.isArray(raw) ? raw : (raw ? [raw] : []);
    const vals = arr.map((v: any) => {
      if (typeof v === 'string') return normCode(v);
      if (v && typeof v === 'object') {
        const cand = v.id ?? v.code ?? v.value ?? v.name ?? '';
        return normCode(String(cand || ''));
      }
      return '';
    }).filter(Boolean);
    // de-duplicate
    return Array.from(new Set(vals));
  };

  const filtered = useMemo(() => {
    return items.filter((ub) => normalizedFormats(ub.book).includes(tab));
  }, [items, tab]);

  // If current tab has no items, switch to first tab that has items
  useEffect(() => {
    const order: TabKey[] = ["EBOOK","AUDIOBOOK","VIDEOBOOK","INTERACTIVE","HARDCOPY"];
    if (loading || items.length === 0) return;
    const has = (t: TabKey) => items.some(ub => normalizedFormats(ub.book).includes(t));
    if (!has(tab)) {
      const next = order.find(has);
      if (next) setTab(next);
    }
    try {
      const counts: Record<string, number> = {};
      for (const t of order) counts[t] = items.filter(ub => normalizedFormats(ub.book).includes(t)).length;
      console.info("[MyShelf] distribution by formats:", counts, "current tab:", tab, "visible:", filtered.length);
    } catch {}
  }, [items, loading]);

  const SkeletonCard = ({ imageHeight }: { imageHeight: string }) => (
    <div className="bg-white border border-gray-100 rounded-lg p-3 text-center shadow-sm">
      <div className={`w-full ${imageHeight} rounded-md mb-3 bg-slate-200 animate-pulse`} />
      <div className="h-4 bg-slate-200 rounded mb-1 animate-pulse" />
      <div className="h-3 bg-slate-200 rounded w-2/3 mx-auto animate-pulse" />
    </div>
  );

  

  return (
    <div>
      <DashboardHeader />
      <h1 className="text-2xl font-semibold text-slate-800 mb-4">{t('shelf.title')}</h1>
      <div className="border-b mb-4 overflow-x-auto -mx-4 sm:mx-0">
        <div className="flex items-center gap-3 sm:gap-4 px-4 sm:px-0 flex-nowrap min-w-max">
          {([
            ["EBOOK", t('shelf.tabs.EBOOK')],
            ["AUDIOBOOK", t('shelf.tabs.AUDIOBOOK')],
            ["VIDEOBOOK", t('shelf.tabs.VIDEOBOOK')],
            ["INTERACTIVE", t('shelf.tabs.INTERACTIVE')],
            ["HARDCOPY", t('shelf.tabs.HARDCOPY')],
          ] as [TabKey, string][]).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`py-2 -mb-px border-b-2 text-sm ${tab===k ? 'border-[#7b0f2b] text-[#7b0f2b]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >{label}</button>
        ))}
        </div>
      </div>

      {error && <div className="text-red-600 mb-3">{t('shelf.failed')}: {error}</div>}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-4">
        {loading
          ? Array.from({ length: 12 }).map((_, idx) => (
              <SkeletonCard key={`skeleton-${idx}`} imageHeight="h-40 sm:h-56" />
            ))
          : filtered.map((ub) => {
              const b = ub.book || ({} as BookMin);
              const authorNames = Array.isArray(b.authors) ? b.authors.map(a => a.name).filter(Boolean) : [];
              const progress = typeof ub.progress_percent === 'number' ? Math.max(0, Math.min(100, Math.round(ub.progress_percent))) : null;
              return (
                <Link
                  to={`/catalog/books/${encodeURIComponent(String(b.id ?? ''))}`}
                  key={`${ub.id}-${b.id}`}
                  className="block bg-white border border-gray-100 rounded-lg p-3 text-center shadow-sm hover:shadow-md transition-shadow"
                >
                  <img src={b.cover || bookImg} alt={`book-${b.id}`} className="w-full h-40 sm:h-56 object-contain rounded-md mb-3 bg-slate-100 p-2" />
                  <div className="text-sm font-medium text-slate-800 truncate">{b.title || '-'}</div>
                  {authorNames.length ? (
                    <div className="text-xs text-slate-400 truncate">{authorNames.join(", ")}</div>
                  ) : null}
                  {progress != null && (
                    <div className="mt-2">
                      <div className="w-full h-1.5 bg-slate-200 rounded">
                        <div className="h-1.5 bg-emerald-500 rounded" style={{ width: `${progress}%` }} />
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">{progress}%</div>
                    </div>
                  )}
                </Link>
              );
            })}
      </div>

      {!loading && filtered.length === 0 && (
        <div className="text-slate-500 mt-4">{t('shelf.empty')}</div>
      )}
    </div>
  );
}

