import { useEffect, useState } from "react";
import { api } from "@/shared/api/client";

type Book = { id: number | string; title: string };
type Playlist = { id: number | string; title: string; description?: string | null; created_at?: string; books?: Book[] };

export default function PlaylistsListPage() {
  const [items, setItems] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Playlists</h2>
        <a href="/admin/playlists/new" className="px-3 py-2 rounded-md bg-indigo-600 text-white text-sm">Create playlist</a>
      </div>
      {loading && <div className="text-slate-500">Loading…</div>}
      {error && <div className="text-red-600">Failed to load: {error}</div>}
      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr><th className="py-2">Title</th><th>Description</th><th>Books</th><th>Created</th></tr>
            </thead>
            <tbody>
              {items.map(p => (
                <tr key={String(p.id)} className="border-t">
                  <td className="py-2">{p.title}</td>
                  <td className="text-slate-600">{p.description || '-'}</td>
                  <td className="text-slate-600">{(p.books||[]).length}</td>
                  <td className="text-xs text-slate-400">{p.created_at ? new Date(p.created_at).toLocaleString() : '-'}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={4} className="py-6 text-center text-slate-500">No playlists yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

