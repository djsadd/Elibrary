import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/shared/api/client";

type Book = { id: number | string; title: string };
type Playlist = { id: number | string; title: string; description?: string | null; created_at?: string; books?: Book[] };

export default function PlaylistsListPage() {
  const [items, setItems] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [q, setQ] = useState("");

  // create form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createOk, setCreateOk] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const pls = await api<Playlist[]>("/api/catalog/playlists");
        if (!cancelled) setItems(Array.isArray(pls) ? pls : []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshTick]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(p => String(p.title || "").toLowerCase().includes(needle));
  }, [items, q]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Playlists</h2>
        <div className="flex items-center gap-2">
          <input value={q} onChange={(e)=>setQ(e.target.value)} className="px-3 py-2 rounded-md border border-slate-200 text-sm" placeholder="Search…" />
          <button onClick={()=>setModalOpen(true)} className="px-3 py-2 rounded-md bg-[#7b0f2b] text-white text-sm">Add</button>
        </div>
      </div>
      {loading && <div className="text-slate-500">Loading…</div>}
      {error && <div className="text-red-600">Failed to load: {error}</div>}
      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="py-2">Title</th>
                <th>Description</th>
                <th>Books</th>
                <th>Created</th>
                <th className="w-16 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={String(p.id)} className="border-t">
                  <td className="py-2">{p.title}</td>
                  <td className="text-slate-600">{p.description || '-'}</td>
                  <td className="text-slate-600">{(p.books||[]).length}</td>
                  <td className="text-xs text-slate-400">{p.created_at ? new Date(p.created_at).toLocaleString() : '-'}</td>
                  <td className="text-center">
                    <Link
                      to={`/admin/playlists/${p.id}/edit`}
                      className="inline-flex items-center justify-center w-8 h-8 rounded hover:bg-slate-100"
                      title="Edit"
                      aria-label="Edit"
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
                <tr><td colSpan={5} className="py-6 text-center text-slate-500">No playlists yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Playlist Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={()=>setModalOpen(false)} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-lg shadow-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="text-lg font-semibold">Add Playlist</div>
                <button onClick={()=>setModalOpen(false)} className="p-2 rounded-md hover:bg-slate-100" aria-label="Close">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 6l12 12M6 18L18 6"/></svg>
                </button>
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setCreateError(null);
                  setCreateOk(null);
                  const t = title.trim();
                  if (!t) { setCreateError("Title is required"); return; }
                  try {
                    setCreating(true);
                    await api("/api/catalog/playlists", {
                      method: "POST",
                      body: JSON.stringify({ title: t, description: description.trim() || undefined }),
                    });
                    setTitle("");
                    setDescription("");
                    setCreateOk("Playlist created");
                    setRefreshTick(x => x + 1);
                    setModalOpen(false);
                  } catch (err: any) {
                    setCreateError(err?.message || String(err));
                  } finally {
                    setCreating(false);
                    setTimeout(() => setCreateOk(null), 1500);
                  }
                }}
                className="space-y-3"
              >
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Title</label>
                  <input value={title} onChange={(e)=>setTitle(e.target.value)} className="w-full px-3 py-2 rounded-md border border-slate-200 text-sm" placeholder="Title" />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Description (optional)</label>
                  <input value={description} onChange={(e)=>setDescription(e.target.value)} className="w-full px-3 py-2 rounded-md border border-slate-200 text-sm" placeholder="Description" />
                </div>
                {createError && <div className="text-sm text-red-600">{createError}</div>}
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button type="button" onClick={()=>setModalOpen(false)} className="px-3 py-2 rounded-md border text-sm hover:bg-slate-50">Cancel</button>
                  <button type="submit" disabled={creating} className="px-4 py-2 rounded-md bg-[#7b0f2b] text-white text-sm disabled:opacity-60">{creating ? "Adding…" : "Create"}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
