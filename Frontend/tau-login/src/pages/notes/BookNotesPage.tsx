import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import DashboardHeader from "@/components/layout/DashboardHeader";
import { api } from "@/shared/api/client";

type Note = {
  id: string | number;
  book_id?: number | string;
  page?: number | null;
  note?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export default function BookNotesPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [items, setItems] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        params.set("book_id", String(id));
        const data = await api<any[]>(`/api/catalog/notes?${params.toString()}`);
        const arr = Array.isArray(data) ? data : [];
        const norm: Note[] = arr.map((n: any, i: number) => ({
          id: n?.id ?? n?.note_id ?? i,
          book_id: n?.book_id ?? id,
          page: Number(n?.page ?? 0) || null,
          note: String(n?.note ?? "") || null,
          created_at: n?.created_at || null,
          updated_at: n?.updated_at || null,
        }));
        if (!cancelled) setItems(norm);
      } catch (e: any) {
        if (!cancelled) {
          // fallback demo data when API not ready
          const demo: Note[] = [
            { id: "n1", book_id: id, page: 3, note: "Definition of UX patterns.", created_at: new Date().toISOString() },
            { id: "n2", book_id: id, page: 12, note: "Great example about navigation.", created_at: new Date().toISOString() },
            { id: "n3", book_id: id, page: 45, note: "Checklist for forms.", created_at: new Date().toISOString() },
          ];
          setItems(demo);
          setError(e?.message || String(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const arr = items.slice().sort((a, b) => (a.page || 0) - (b.page || 0));
    if (!qq) return arr;
    return arr.filter(n => (n.note || "").toLowerCase().includes(qq));
  }, [items, q]);

  const goReader = (page?: number | null) => {
    if (!id) return;
    const params = new URLSearchParams();
    params.set("book", String(id));
    if (page && page > 0) params.set("page", String(page));
    navigate(`/reader?${params.toString()}`);
  };

  return (
    <div>
      <DashboardHeader />
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold text-[#7b0f2b]">My Notes</h1>
        <Link to={`/catalog/${id}`} className="text-slate-600 hover:text-[#7b0f2b] text-sm">Back to book</Link>
      </div>

      <div className="bg-white border rounded-md p-3 mb-4 flex items-center gap-3">
        <input
          value={q}
          onChange={(e)=>setQ(e.target.value)}
          placeholder="Search in notes"
          className="flex-1 border rounded-md px-3 py-2 text-sm"
        />
        <div className="text-xs text-slate-500">{filtered.length} notes</div>
      </div>

      {loading ? (
        <div className="text-slate-500">Loading…</div>
      ) : (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="text-slate-500">No notes yet.</div>
          ) : (
            filtered.map((n) => (
              <div key={String(n.id)} className="bg-white border rounded-md p-3 flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-slate-500">Page {n.page ?? '-'}</div>
                  <div className="text-slate-800 whitespace-pre-line text-sm mt-1">{n.note || '-'}</div>
                  {n.created_at && (
                    <div className="text-[11px] text-slate-400 mt-1">{new Date(n.created_at).toLocaleString()}</div>
                  )}
                </div>
                <div className="shrink-0">
                  <button onClick={() => goReader(n.page)} className="px-3 py-1.5 text-sm rounded-md border hover:bg-slate-50">Open page</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

