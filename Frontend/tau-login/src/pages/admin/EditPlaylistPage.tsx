import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/shared/api/client";
import { namesFrom } from "@/shared/ui/text";

type Book = { id: number | string; title: string; authors?: string[] };
type Playlist = { id: number | string; title: string; description?: string | null; books?: Book[] };

export default function EditPlaylistPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<Playlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [books, setBooks] = useState<Book[]>([]);
  const [bLoading, setBLoading] = useState(true);
  const [bError, setBError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return books;
    return books.filter((b) =>
      (b.title ?? "").toLowerCase().includes(q) || (b.authors ?? []).join(" ").toLowerCase().includes(q)
    );
  }, [books, query]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const all = await api<Playlist[]>(`/api/catalog/playlists`);
        const found = (all || []).find((x) => String(x.id) === String(id)) || null;
        if (!cancelled) {
          setItem(found);
          if (found) {
            setTitle(found.title || "");
            setDescription(found.description || "");
            const initSel = new Set<string>((found.books || []).map((b) => String(b.id)));
            setSelected(initSel);
          }
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setBLoading(true);
        setBError(null);
        const data = await api<{ items: any[] }>("/api/catalog/books");
        if (!cancelled) {
          const items = Array.isArray(data.items) ? data.items : [];
          setBooks(items.map((b) => ({ id: b.id, title: b.title, authors: namesFrom(b.authors) })));
        }
      } catch (e: any) {
        if (!cancelled) setBError(e?.message || String(e));
      } finally {
        if (!cancelled) setBLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const toggle = (bid: number | string) => {
    const sid = String(bid);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid); else next.add(sid);
      return next;
    });
  };

  async function onSave() {
    if (!id) return;
    try {
      setSaving(true);
      setError(null);
      const payload: { title?: string; description?: string; book_ids?: number[] } = {};
      if (title.trim().length) payload.title = title.trim();
      payload.description = description.trim();
      payload.book_ids = Array.from(selected).map((x) => Number(x)).filter((n) => Number.isFinite(n));
      await api(`/api/catalog/playlists/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      navigate("/admin/playlists");
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!id || deleting) return;
    const ok = window.confirm("Are you sure you want to delete?");
    if (!ok) return;
    try {
      setDeleting(true);
      setError(null);
      await api(`/api/catalog/playlists/${id}`, { method: "DELETE" });
      navigate("/admin/playlists");
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg p-5 bg-gradient-to-r from-[#7b0f2b] to-rose-600 text-white shadow">
        <div className="text-xl font-semibold">Edit Playlist</div>
        <div className="text-sm opacity-90">ID: {id}</div>
      </div>
      {loading ? (
        <div className="text-slate-500">Loading…</div>
      ) : error ? (
        <div className="text-red-600">Failed to load: {error}</div>
      ) : item ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border rounded-md shadow-sm p-4 space-y-3 md:col-span-1">
            <div>
              <div className="text-sm text-slate-700">Title</div>
              <input className="mt-1 w-full border rounded px-3 py-2" value={title} onChange={(e)=>setTitle(e.target.value)} />
            </div>
            <div>
              <div className="text-sm text-slate-700">Description</div>
              <textarea className="mt-1 w-full border rounded px-3 py-2 h-28" value={description} onChange={(e)=>setDescription(e.target.value)} />
            </div>
            <div className="text-xs text-slate-500">Selected books: {selected.size}</div>
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={onDelete}
                disabled={deleting}
                className="px-3 py-2 rounded border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-60"
                title="Delete playlist"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
              <div className="flex gap-2">
                <button onClick={() => navigate(-1)} type="button" className="px-3 py-2 border rounded hover:bg-slate-50">Cancel</button>
                <button onClick={onSave} disabled={saving} className="px-4 py-2 bg-[#7b0f2b] text-white rounded hover:bg-rose-800 disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button>
              </div>
            </div>
          </div>
          <div className="bg-white border rounded-md shadow-sm p-4 md:col-span-2">
            <label className="block text-sm font-medium">Books</label>
            <div className="relative mt-1">
              <input
                placeholder={bLoading ? 'Loading…' : 'Type to search title or author'}
                value={query}
                onChange={(e)=>setQuery(e.target.value)}
                disabled={bLoading}
                className="w-full border rounded-md px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-[#7b0f2b]/30"
              />
              <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="11" cy="11" r="7"/><path d="M21 21l-3.5-3.5"/></svg>
            </div>

            {bLoading ? (
              <div className="text-slate-500 mt-3">Loading…</div>
            ) : bError ? (
              <div className="text-red-600 mt-3">Failed to load books: {bError}</div>
            ) : (
              <div className="mt-3 border rounded-md divide-y max-h-96 overflow-auto bg-white">
                {(query.trim() ? filtered : books).map((b) => {
                  const sid = String(b.id);
                  const checked = selected.has(sid);
                  return (
                    <label key={sid} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer">
                      <input type="checkbox" checked={checked} onChange={() => toggle(b.id)} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-slate-800 truncate">{b.title}</div>
                        {b.authors?.length ? <div className="text-xs text-slate-500 truncate">{b.authors.join(', ')}</div> : null}
                      </div>
                    </label>
                  );
                })}
                {filtered.length === 0 && query.trim() && (
                  <div className="px-3 py-6 text-center text-slate-500 text-sm">No books match your search</div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-slate-500">Not found</div>
      )}
    </div>
  );
}
