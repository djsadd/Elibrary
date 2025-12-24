import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/shared/api/client";
import { t } from "@/shared/i18n";

type Book = { id: number | string; title: string; year?: string | null; lang?: string | null; authors?: any };

export default function BooksListPage() {
  const [items, setItems] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setOffset(0);
  }, [q, limit]);

  useEffect(() => {
    let cancelled = false;
    const tmr = setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        if (q.trim()) params.set("q", q.trim());
        params.set("limit", String(limit));
        params.set("offset", String(offset));
        const data = await api<{ items: Book[]; page?: { limit: number; offset: number; total: number } }>(
          `/api/catalog/books?${params.toString()}`
        );
        if (!cancelled) {
          setItems(Array.isArray(data.items) ? data.items : []);
          setTotal(data?.page?.total || 0);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(tmr); };
  }, [q, limit, offset]);

  const page = Math.floor(offset / limit) + 1;
  const pages = Math.max(1, Math.ceil((total || 0) / limit));
  const canPrev = offset > 0;
  const canNext = offset + limit < total;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">{t('admin.books.heading')}</h2>
        <a href="/admin/books/new" className="px-3 py-2 rounded-md bg-slate-700 text-white text-sm">{t('admin.books.addBook')}</a>
      </div>
      <div className="flex items-end justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('admin.common.search')}
            className="px-3 py-2 rounded-md border border-slate-200 text-sm min-w-[220px]"
          />
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value) || 20)}
            className="px-2 py-2 rounded-md border border-slate-200 text-sm"
          >
            {[10,20,50,100].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="text-sm text-slate-500">
          {total ? `Page ${page} of ${pages}` : ""}
        </div>
      </div>
      {loading && <div className="text-slate-500">Loading…</div>}
      {error && <div className="text-red-600">Failed to load: {error}</div>}
      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="py-2">{t('admin.books.table.title')}</th>
                <th>{t('admin.books.table.year')}</th>
                <th>{t('admin.books.table.lang')}</th>
                <th>{t('admin.books.table.authors')}</th>
                <th className="w-16 text-center">{t('admin.books.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map(b => (
                <tr key={String(b.id)} className="border-t">
                  <td className="py-2">{b.title}</td>
                  <td className="text-slate-600">{b.year || '-'}</td>
                  <td className="text-slate-600">{b.lang || '-'}</td>
                  <td className="text-slate-600">{Array.isArray((b as any).authors) ? (b as any).authors.map((x:any)=> typeof x==='string'?x: x?.name).filter(Boolean).join(', ') : '-'}</td>
                  <td className="text-center">
                    <Link
                      to={`/admin/books/${b.id}/edit`}
                      className="inline-flex items-center justify-center w-8 h-8 rounded hover:bg-slate-100"
                      title={t('admin.common.edit')}
                      aria-label={t('admin.common.edit')}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7b0f2b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9"/>
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
                      </svg>
                    </Link>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-slate-500">{t('admin.books.empty')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {!loading && !error && (
        <div className="flex items-center justify-between mt-3">
          <div className="text-sm text-slate-500">
            {total ? `Showing ${Math.min(offset + 1, total)}-${Math.min(offset + items.length, total)} of ${total}` : ""}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOffset((o) => Math.max(0, o - limit))}
              disabled={!canPrev}
              className="px-3 py-2 border rounded disabled:opacity-50"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setOffset((o) => o + limit)}
              disabled={!canNext}
              className="px-3 py-2 border rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
