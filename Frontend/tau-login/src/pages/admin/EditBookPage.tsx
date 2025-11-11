import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/shared/api/client";

type Book = { id: number | string; title: string; year?: string | null; lang?: string | null; summary?: string | null };

export default function EditBookPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await api<Book>(`/api/catalog/books/${id}`);
        if (!cancelled) setItem(data);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg p-5 bg-gradient-to-r from-[#7b0f2b] to-rose-600 text-white shadow">
        <div className="text-xl font-semibold">Edit Book</div>
        <div className="text-sm opacity-90">ID: {id}</div>
      </div>
      {loading ? (
        <div className="text-slate-500">Loading…</div>
      ) : error ? (
        <div className="text-red-600">Failed to load: {error}</div>
      ) : item ? (
        <div className="bg-white border rounded-md shadow-sm p-4 space-y-3">
          <div className="text-sm text-slate-700">Title</div>
          <input className="w-full border rounded px-3 py-2" defaultValue={item.title} />
          <div className="text-sm text-slate-700">Year</div>
          <input className="w-full border rounded px-3 py-2" defaultValue={item.year ?? ''} />
          <div className="text-sm text-slate-700">Language</div>
          <input className="w-full border rounded px-3 py-2" defaultValue={item.lang ?? ''} />
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => navigate(-1)} className="px-3 py-2 border rounded hover:bg-slate-50">Cancel</button>
            <button className="px-4 py-2 bg-[#7b0f2b] text-white rounded hover:bg-rose-800">Save (disabled)</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

