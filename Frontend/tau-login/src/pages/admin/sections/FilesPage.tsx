import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/shared/api/client";
import { t } from "@/shared/i18n";

type Author = { id?: number; name?: string };
type BookMinimal = {
  id: number | string;
  title: string;
  authors?: Author[];
  formats?: string[];
};
type FileItem = {
  file_id: string;
  download_url?: string | null;
  books: BookMinimal[];
};
type FilesList = {
  items: FileItem[];
  page?: { limit: number; offset: number; total: number };
};

export default function FilesPage() {
  const [items, setItems] = useState<FileItem[]>([]);
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
        const data = await api<FilesList>(`/api/catalog/files?${params.toString()}`);
        if (!cancelled) {
          setItems(Array.isArray(data?.items) ? data.items : []);
          setTotal(data?.page?.total || 0);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(tmr); };
  }, [q, limit, offset]);

  const totalBooks = useMemo(
    () => items.reduce((sum, item) => sum + (Array.isArray(item.books) ? item.books.length : 0), 0),
    [items]
  );
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.max(1, Math.ceil((total || 0) / limit));
  const canPrev = offset > 0;
  const canNext = offset + limit < total;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">{t('admin.nav.files')}</h2>
        <div className="text-sm text-slate-500">
          {items.length ? `${items.length} files, ${totalBooks} books` : ""}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by file id or book title"
            className="px-3 py-2 rounded-md border border-slate-200 text-sm min-w-[260px]"
          />
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value) || 20)}
            className="px-2 py-2 rounded-md border border-slate-200 text-sm"
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <div className="text-sm text-slate-500">
          {total ? `Page ${page} of ${pages}` : ""}
        </div>
      </div>
      {loading && <div className="text-slate-500">Loading...</div>}
      {error && <div className="text-red-600">Failed to load: {error}</div>}
      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="py-2">File</th>
                <th>Books</th>
              </tr>
            </thead>
            <tbody>
              {items.map((f) => (
                <tr key={f.file_id} className="border-t align-top">
                  <td className="py-3 pr-4">
                    <div className="font-mono text-xs text-slate-700 break-all">{f.file_id}</div>
                    {f.download_url && (
                      <a
                        className="text-xs text-slate-500 hover:text-slate-800"
                        href={f.download_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        download
                      </a>
                    )}
                  </td>
                  <td className="py-3">
                    <div className="flex flex-col gap-2">
                      {(f.books || []).map((b) => {
                        const authors = Array.isArray(b.authors)
                          ? b.authors.map((a) => a?.name).filter(Boolean).join(", ")
                          : "";
                        return (
                          <div key={String(b.id)} className="flex items-center gap-3">
                            <Link to={`/admin/books/${b.id}/edit`} className="text-slate-900 hover:text-[#7b0f2b]">
                              {b.title}
                            </Link>
                            {authors && <span className="text-xs text-slate-500">{authors}</span>}
                            <a
                              className="text-xs text-slate-500 hover:text-slate-800"
                              href={`/api/catalog/books/${encodeURIComponent(String(b.id))}/download`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              pdf
                            </a>
                          </div>
                        );
                      })}
                      {(!f.books || f.books.length === 0) && (
                        <div className="text-slate-500 text-sm">No linked books</div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={2} className="py-6 text-center text-slate-500">No files found</td>
                </tr>
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
