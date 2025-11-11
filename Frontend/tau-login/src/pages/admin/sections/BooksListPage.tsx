import { useEffect, useState } from "react";
import { api } from "@/shared/api/client";

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
        <h2 className="text-lg font-semibold">Books</h2>
        <a href="/admin/books/new" className="px-3 py-2 rounded-md bg-slate-700 text-white text-sm">Add book</a>
      </div>
      {loading && <div className="text-slate-500">Loading…</div>}
      {error && <div className="text-red-600">Failed to load: {error}</div>}
      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr><th className="py-2">Title</th><th>Year</th><th>Lang</th><th>Authors</th></tr>
            </thead>
            <tbody>
              {items.map(b => (
                <tr key={String(b.id)} className="border-t">
                  <td className="py-2">{b.title}</td>
                  <td className="text-slate-600">{b.year || '-'}</td>
                  <td className="text-slate-600">{b.lang || '-'}</td>
                  <td className="text-slate-600">{Array.isArray((b as any).authors) ? (b as any).authors.map((x:any)=> typeof x==='string'?x: x?.name).filter(Boolean).join(', ') : '-'}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={4} className="py-6 text-center text-slate-500">No books</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

