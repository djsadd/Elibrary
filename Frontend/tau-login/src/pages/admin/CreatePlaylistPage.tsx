import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/shared/api/client";

type Book = {
  id: number | string;
  title: string;
  authors?: string[];
};

type BookListResponse = { items: Book[] };

export default function CreatePlaylistPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const nav = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await api<BookListResponse>("/api/catalog/books");
        if (!cancelled) setBooks(Array.isArray(data.items) ? data.items : []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return books;
    return books.filter(b =>
      b.title?.toLowerCase().includes(q) ||
      (b.authors || []).some(a => a.toLowerCase().includes(q))
    );
  }, [books, query]);

  const toggle = (id: number | string) => {
    const sid = String(id);
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid); else next.add(sid);
      return next;
    });
  };

  async function createPlaylist(payload: { title: string; description?: string; book_ids: number[] }) {
    const path = "/api/catalog/playlists";
    return api<any>(path, { method: "POST", body: JSON.stringify(payload) });
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return alert("Title is required");
    const book_ids = Array.from(selected).map(s => Number(s)).filter(n => !isNaN(n));
    try {
      await createPlaylist({ title: title.trim(), description: description || undefined, book_ids });
      alert("Playlist created");
      nav("/admin");
    } catch (err: any) {
      console.error(err);
      alert("Failed to create playlist: " + (err?.message || String(err)));
    }
  };

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Create Playlist</h3>
      <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1 space-y-3">
          <div>
            <label className="block text-sm font-medium">Title</label>
            <input value={title} onChange={(e)=>setTitle(e.target.value)} className="mt-1 w-full border rounded-md px-3 py-2" required />
          </div>
          <div>
            <label className="block text-sm font-medium">Description</label>
            <textarea value={description} onChange={(e)=>setDescription(e.target.value)} className="mt-1 w-full border rounded-md px-3 py-2 h-24" />
          </div>
          <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-md">Create</button>
        </div>

        <div className="md:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-slate-600">Select books to include</div>
            <div className="text-xs text-slate-500">Selected: {selected.size}</div>
          </div>
          <input placeholder="Search by title or author" value={query} onChange={(e)=>setQuery(e.target.value)} className="w-full border rounded-md px-3 py-2 mb-3" />

          {loading ? (
            <div className="text-slate-500">Loading…</div>
          ) : error ? (
            <div className="text-red-600">Failed to load books: {error}</div>
          ) : (
            <div className="border rounded-md divide-y max-h-96 overflow-auto bg-white">
              {filtered.map(b => {
                const sid = String(b.id);
                const checked = selected.has(sid);
                return (
                  <label key={sid} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer">
                    <input type="checkbox" checked={checked} onChange={()=>toggle(b.id)} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-800 truncate">{b.title}</div>
                      {b.authors?.length ? <div className="text-xs text-slate-500 truncate">{b.authors.join(', ')}</div> : null}
                    </div>
                  </label>
                );
              })}
              {filtered.length === 0 && (
                <div className="px-3 py-6 text-center text-slate-500 text-sm">No books match your search</div>
              )}
            </div>
          )}
        </div>
      </form>
    </div>
  );
}

