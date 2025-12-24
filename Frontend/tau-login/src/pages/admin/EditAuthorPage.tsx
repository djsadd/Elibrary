import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/shared/api/client";

type AuthorBook = {
  id: number | string;
  title: string;
  authors?: { id: number | string; name: string }[];
  formats?: string[];
  cover?: string | null;
};
type AuthorDetail = { id: number | string; name: string; books?: AuthorBook[] };

export default function EditAuthorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<AuthorDetail | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        if (!id) throw new Error("Missing author id");
        const data = await api<AuthorDetail>(`/api/catalog/authors/${id}`);
        if (!cancelled) {
          setItem(data || null);
          setName(data?.name || "");
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  async function onSave() {
    if (!id || saving) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required");
      return;
    }
    try {
      setSaving(true);
      setError(null);
      await api(`/api/catalog/authors/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      navigate("/admin/authors");
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg p-5 bg-gradient-to-r from-[#7b0f2b] to-rose-600 text-white shadow">
        <div className="text-xl font-semibold">Edit Author</div>
        <div className="text-sm opacity-90">ID: {id}</div>
      </div>

      {loading ? (
        <div className="text-slate-500">Loading...</div>
      ) : error ? (
        <div className="text-red-600">Failed to load: {error}</div>
      ) : item ? (
        <div className="bg-white border rounded-md shadow-sm p-4 space-y-4 max-w-xl">
          <div>
            <div className="text-sm text-slate-700">Name</div>
            <input
              className="mt-1 w-full border rounded px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={256}
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => navigate(-1)}
              type="button"
              className="px-3 py-2 border rounded hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              disabled={saving}
              className="px-4 py-2 bg-[#7b0f2b] text-white rounded hover:bg-rose-800 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      ) : (
        <div className="text-slate-500">Not found</div>
      )}

      {!loading && item ? (
        <div className="bg-white border rounded-md shadow-sm p-4 max-w-2xl">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-slate-700">Books by this author</div>
            <div className="text-xs text-slate-500">{item.books?.length || 0} items</div>
          </div>
          <div className="mt-3 border rounded-md divide-y max-h-80 overflow-auto">
            {(item.books || []).map((b) => (
              <div key={String(b.id)} className="px-3 py-2 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-slate-800 truncate">{b.title}</div>
                  {b.authors?.length ? (
                    <div className="text-xs text-slate-500 truncate">
                      {b.authors.map((a) => a.name).filter(Boolean).join(", ")}
                    </div>
                  ) : null}
                </div>
                {b.formats?.length ? (
                  <div className="text-xs text-slate-500">{b.formats.join(", ")}</div>
                ) : null}
              </div>
            ))}
            {!item.books?.length ? (
              <div className="px-3 py-6 text-center text-slate-500 text-sm">No books linked yet</div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
