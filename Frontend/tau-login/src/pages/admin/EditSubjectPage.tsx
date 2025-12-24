import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/shared/api/client";

type Subject = { id: number | string; name: string };

export default function EditSubjectPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<Subject | null>(null);
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
        if (!id) throw new Error("Missing subject id");
        const data = await api<Subject>(`/api/catalog/subjects/${id}`);
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
      await api(`/api/catalog/subjects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      navigate("/admin/subjects");
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg p-5 bg-gradient-to-r from-[#7b0f2b] to-rose-600 text-white shadow">
        <div className="text-xl font-semibold">Edit Subject</div>
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
    </div>
  );
}
