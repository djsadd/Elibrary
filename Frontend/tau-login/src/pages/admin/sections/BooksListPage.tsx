import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/shared/api/client";
import { t } from "@/shared/i18n";

type Book = { id: number | string; title: string; year?: string | null; lang?: string | null; authors?: any };

export default function BooksListPage() {
  const [items, setItems] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await api<{ items: Book[] }>("/api/catalog/books");
        if (!cancelled) setItems(Array.isArray(data.items) ? data.items : []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">{t('admin.books.heading')}</h2>
        <a href="/admin/books/new" className="px-3 py-2 rounded-md bg-slate-700 text-white text-sm">{t('admin.books.addBook')}</a>
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
    </div>
  );
}
