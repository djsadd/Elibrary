import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/shared/api/client";
import { namesFrom } from "@/shared/ui/text";

type Book = {
  id: number | string;
  title: string;
  authors?: string[];
};

type BookListResponse = { items: any[] };

export default function CreatePlaylistPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const nav = useNavigate();

  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return books;
    return books.filter((b) => {
      const t = b.title?.toLowerCase() ?? "";
      const a = (b.authors ?? []).join(" ").toLowerCase();
      return t.includes(q) || a.includes(q);
    });
  }, [books, query]);

  const toggle = (id: number | string) => {
    const sid = String(id);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid);
      else next.add(sid);
      return next;
    });
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await api<BookListResponse>("/api/catalog/books");
        if (!cancelled) {
          const items = Array.isArray(data.items) ? data.items : [];
          const normalized: Book[] = items.map((b: any) => ({
            id: b.id,
            title: b.title,
            authors: namesFrom(b.authors),
          }));
          setBooks(normalized);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(e.target as Node)) {
        // collapse dropdown on outside click by clearing query if results open
        // optional: keep query; here we keep it, just for UX we could hide list
      }
    }
    document.addEventListener("mousedown", onDocMouseDown, true);
    return () => document.removeEventListener("mousedown", onDocMouseDown, true);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || submitting) return;
    try {
      setSubmitting(true);
      setError(null);
      const book_ids = Array.from(selected)
        .map((x) => Number(x))
        .filter((n) => Number.isFinite(n));
      const payload: { title: string; description?: string; book_ids: number[] } = {
        title: title.trim(),
        description: description.trim() || undefined,
        book_ids,
      };
      await api("/api/catalog/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      nav("/admin/playlists");
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg p-5 bg-gradient-to-r from-[#7b0f2b] to-rose-600 text-white shadow">
        <div className="text-xl font-semibold">Create Playlist</div>
        <div className="text-sm opacity-90">Name your playlist and quickly search books to add.</div>
      </div>

      <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1 space-y-3 bg-white rounded-md p-4 border shadow-sm">
          <div>
            <label className="block text-sm font-medium">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#7b0f2b]/30"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full border rounded-md px-3 py-2 h-28 focus:outline-none focus:ring-2 focus:ring-[#7b0f2b]/30"
            />
          </div>
          {error ? (
            <div className="text-xs text-red-600">{error}</div>
          ) : (
            <div className="text-xs text-slate-500">Selected: {selected.size}</div>
          )}
          <div className="flex items-center justify-between">
            <div />
            <div className="flex gap-2">
              {selected.size > 0 && (
                <button
                  type="button"
                  onClick={() => setSelected(new Set())}
                  className="px-3 py-1.5 text-xs border rounded-md hover:bg-slate-50"
                >
                  Clear
                </button>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-[#7b0f2b] hover:bg-rose-800 disabled:opacity-60 text-white rounded-md shadow-sm transition-colors"
              >
                {submitting ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>

        <div className="md:col-span-2 bg-white rounded-md p-4 border shadow-sm" ref={dropdownRef}>
          <label className="block text-sm font-medium">Books</label>
          <div className="relative mt-1">
            <input
              placeholder={loading ? "Loading…" : "Type to search title or author"}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={loading}
              className="w-full border rounded-md px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-[#7b0f2b]/30"
            />
            <svg
              className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-3.5-3.5" />
            </svg>
            {!loading && !error && query.trim() && (
              <div className="absolute z-50 mt-1 w-full max-h-64 overflow-auto bg-white border rounded-md shadow">
                {filtered.length === 0 ? (
                  <div className="px-3 py-3 text-sm text-slate-500">No results</div>
                ) : (
                  filtered.slice(0, 50).map((b) => {
                    const sid = String(b.id);
                    const active = selected.has(sid);
                    return (
                      <button
                        key={sid}
                        type="button"
                        onClick={() => toggle(b.id)}
                        className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-slate-50 ${
                          active ? "bg-slate-50" : ""
                        }`}
                      >
                        <span
                          className={`inline-block w-4 h-4 rounded border ${
                            active ? "bg-[#7b0f2b] border-[#7b0f2b]" : "border-slate-300"
                          }`}
                        />
                        <span className="flex-1 truncate">{b.title}</span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {loading ? (
            <div className="text-slate-500 mt-3">Loading…</div>
          ) : error ? (
            <div className="text-red-600 mt-3">Failed to load books: {error}</div>
          ) : (
            <div className="mt-3 border rounded-md divide-y max-h-96 overflow-auto bg-white">
              {(query.trim() ? filtered : books).map((b) => {
                const sid = String(b.id);
                const checked = selected.has(sid);
                return (
                  <label
                    key={sid}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer"
                  >
                    <input type="checkbox" checked={checked} onChange={() => toggle(b.id)} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-800 truncate">{b.title}</div>
                      {b.authors?.length ? (
                        <div className="text-xs text-slate-500 truncate">{b.authors.join(", ")}</div>
                      ) : null}
                    </div>
                  </label>
                );
              })}
              {filtered.length === 0 && query.trim() && (
                <div className="px-3 py-6 text-center text-slate-500 text-sm">
                  No books match your search
                </div>
              )}
            </div>
          )}
        </div>
      </form>
    </div>
  );
}

