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

export default function FilesPage() {
  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    let cancelled = false;
    const tmr = setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        if (q.trim()) params.set("q", q.trim());
        const data = await api<FileItem[]>(`/api/catalog/files${params.size ? `?${params.toString()}` : ""}`);
        if (!cancelled) {
          setItems(Array.isArray(data) ? data : []);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(tmr); };
  }, [q]);

  const totalBooks = useMemo(
    () => items.reduce((sum, item) => sum + (Array.isArray(item.books) ? item.books.length : 0), 0),
    [items]
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">{t('admin.nav.files')}</h2>
        <div className="text-sm text-slate-500">
          {items.length ? `${items.length} files, ${totalBooks} books` : ""}
        </div>
      </div>
      <div className="flex items-center gap-2 mb-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by file id or book title"
          className="px-3 py-2 rounded-md border border-slate-200 text-sm min-w-[260px]"
        />
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
    </div>
  );
}
