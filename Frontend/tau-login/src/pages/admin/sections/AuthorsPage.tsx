import { useEffect, useMemo, useState } from "react";
import { api } from "@/shared/api/client";
import { t } from "@/shared/i18n";

export default function AuthorsPage() {
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(50);
  const [authors, setAuthors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  // create-author form state
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createOk, setCreateOk] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        if (q.trim()) params.set("q", q.trim());
        if (limit) params.set("limit", String(limit));
        const data = await api<string[]>(`/api/catalog/authors${params.size ? `?${params.toString()}` : ""}`);
        if (!cancelled) setAuthors(Array.isArray(data) ? data : []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q, limit, refreshTick]);

  const grouped = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const name of authors) {
      const key = (name?.[0] || "?").toUpperCase();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(name);
    }
    return Array.from(map.entries()).sort(([a],[b]) => a.localeCompare(b));
  }, [authors]);

  const Avatar = ({ name }: { name: string }) => {
    const initial = (name?.[0] || "?").toUpperCase();
    return (
      <div className="w-8 h-8 rounded-full bg-[#7b0f2b]/10 text-[#7b0f2b] flex items-center justify-center text-sm font-semibold">
        {initial}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setCreateError(null);
          setCreateOk(null);
          const name = newName.trim();
          if (!name) { setCreateError(t('admin.taxonomy.errors.nameRequired')); return; }
          if (name.length > 256) { setCreateError(t('admin.taxonomy.errors.nameTooLong')); return; }
          try {
            setCreating(true);
            await api("/api/catalog/authors", {
              method: "POST",
              body: JSON.stringify({ name }),
            });
            setNewName("");
            setCreateOk(t('admin.taxonomy.errors.addedOk'));
            setRefreshTick((x) => x + 1); // reload list
          } catch (e: any) {
            setCreateError(e?.message || String(e));
          } finally {
            setCreating(false);
            setTimeout(() => { setCreateOk(null); }, 1500);
          }
        }}
        className="bg-white border rounded-md p-4 flex items-end gap-3"
      >
        <div className="flex-1">
          <label className="block text-sm text-slate-600 mb-1">Add Author</label>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Author name"
            className="w-full px-3 py-2 rounded-md border border-slate-200 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={creating}
          className="px-4 py-2 rounded-md bg-[#7b0f2b] text-white text-sm disabled:opacity-60"
        >
          {creating ? "Adding…" : "Add"}
        </button>
        {createError && <div className="text-sm text-red-600">{createError}</div>}
        {createOk && <div className="text-sm text-emerald-600">{createOk}</div>}
      </form>

      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Authors</h2>
          <div className="text-slate-500 text-sm">Browse and search authors</div>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search authors..."
            className="px-3 py-2 rounded-md border border-slate-200 text-sm min-w-[220px]"
          />
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value) || 50)}
            className="px-2 py-2 rounded-md border border-slate-200 text-sm"
          >
            {[25,50,100,150,200].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      {error && <div className="text-sm text-red-600">Failed to load: {error}</div>}

      <div className="bg-white border rounded-md">
        {loading ? (
          <div className="p-6 text-slate-500">Loading…</div>
        ) : (
          <div>
            {grouped.length === 0 ? (
              <div className="p-6 text-slate-500">No authors found.</div>
            ) : (
              grouped.map(([letter, names]) => (
                <div key={letter}>
                  <div className="px-4 py-2 text-xs font-semibold uppercase text-slate-500 bg-slate-50 border-b">{letter}</div>
                  <ul className="divide-y">
                    {names.map((name) => (
                      <li key={name} className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50">
                        <Avatar name={name} />
                        <div className="text-sm text-slate-800">{name}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
