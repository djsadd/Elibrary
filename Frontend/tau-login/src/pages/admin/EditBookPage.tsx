import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/shared/api/client";
import MultiSelect from "@/components/ui/MultiSelect";
import { namesFrom } from "@/shared/ui/text";

type Book = {
  id: number | string;
  title: string;
  year?: string | null;
  lang?: string | null;
  pub_info?: string | null;
  summary?: string | null;
  cover?: string | null;
  file_id?: string | null;
  download_url?: string | null;
  authors?: string[] | null;
  subjects?: string[] | null;
  source?: string | null;
  formats?: string[] | null;
  isbn?: string | null;
  edition?: string | null;
  page_count?: number | null;
  available_copies?: number | null;
  is_public?: boolean | null;
};

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result));
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
}

export default function EditBookPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initial, setInitial] = useState<Book | null>(null);

  // fields
  const [title, setTitle] = useState("");
  const [year, setYear] = useState("");
  const [lang, setLang] = useState("");
  const [pubInfo, setPubInfo] = useState("");
  const [summary, setSummary] = useState("");
  const [isbn, setIsbn] = useState("");
  const [edition, setEdition] = useState("");
  const [pageCount, setPageCount] = useState<string>("");
  const [availableCopies, setAvailableCopies] = useState<string>("");
  const [source, setSource] = useState("LIBRARY");
  const [formats, setFormats] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState<boolean>(true);

  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  // lists
  const [authors, setAuthors] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [langs, setLangs] = useState<string[]>([]);
  const [selectedAuthors, setSelectedAuthors] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [formatOptions] = useState<string[]>(["EBOOK", "HARDCOPY", "AUDIOBOOK", "ARTICLE"]);
  const [sourceOptions] = useState<string[]>(["KABIS", "LIBRARY", "RMEB", "OTHER"]);

  // fetch lists + book
  useEffect(() => {
    let cancelled = false;
    const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
    const base = `${BASE}/api/catalog`;
    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

    const fetchLists = async () => {
      try {
        const [aRes, sRes, lRes] = await Promise.all([
          fetch(`${base}/authors?limit=200`, { headers }),
          fetch(`${base}/subjects?limit=200`, { headers }),
          fetch(`${base}/langs`, { headers }),
        ]);
        if (aRes.ok) {
          const raw = await aRes.json();
          const list = Array.isArray(raw) ? raw.map((x: any) => (typeof x === 'string' ? x : (x?.name ?? ''))).filter(Boolean) : [];
          setAuthors(list);
        }
        if (sRes.ok) {
          const raw = await sRes.json();
          const list = Array.isArray(raw) ? raw.map((x: any) => (typeof x === 'string' ? x : (x?.name ?? ''))).filter(Boolean) : [];
          setSubjects(list);
        }
        if (lRes.ok) setLangs(await lRes.json());
      } catch {}
    };

    const fetchBook = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await api<Book>(`/api/catalog/books/${id}`);
        if (cancelled) return;
        setInitial(data);
        setTitle(data.title || "");
        setYear(String(data.year || ""));
        setLang(String(data.lang || ""));
        setPubInfo(String(data.pub_info || ""));
        setSummary(String(data.summary || ""));
        setIsbn(String(data.isbn || ""));
        setEdition(String(data.edition || ""));
        setPageCount(data.page_count != null ? String(data.page_count) : "");
        setAvailableCopies(data.available_copies != null ? String(data.available_copies) : "");
        setSource(String((data.source || "LIBRARY").toString().toUpperCase()));
        setFormats(Array.isArray(data.formats) ? data.formats : (data.formats ? [String(data.formats)] : []));
        setIsPublic(Boolean(data.is_public ?? true));
        setSelectedAuthors(namesFrom((data as any)?.authors));
        setSelectedSubjects(namesFrom((data as any)?.subjects));
      } catch (e: any) {
        setError(e?.message || String(e));
      } finally {
        setLoading(false);
      }
    };

    fetchLists();
    fetchBook();
    return () => { cancelled = true; };
  }, [id]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // optionally upload new PDF first
      const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
      const uploadRawUrl = `${BASE}/api/catalog/upload/raw`;
      let fileMeta: any = null;
      if (pdfFile) {
        const safeName = encodeURIComponent(pdfFile.name);
        const res = await fetch(uploadRawUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "x_filename": safeName,
            ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}),
          },
          body: pdfFile,
        });
        if (!res.ok) throw new Error(`Upload failed ${res.status}`);
        const data = await res.json();
        fileMeta = data.file ?? data;
      }

      // optional cover as data URL
      let coverDataUrl: string | null = null;
      if (coverFile) {
        try { coverDataUrl = await readAsDataUrl(coverFile); } catch {}
      }

      // Build PATCH payload
      const payload: any = {};
      const normSource = source ? String(source).trim().toUpperCase() : undefined;
      const normFormats = formats.map(f => String(f).trim().toUpperCase());

      const apply = (k: string, v: any) => { if (v !== undefined) payload[k] = v; };
      apply("title", title);
      apply("year", year || undefined);
      apply("lang", lang || undefined);
      apply("pub_info", pubInfo || undefined);
      apply("summary", summary || undefined);
      apply("isbn", isbn || undefined);
      apply("edition", edition || undefined);
      apply("page_count", pageCount ? Number(pageCount) : undefined);
      apply("available_copies", availableCopies ? Number(availableCopies) : undefined);
      apply("source", normSource);
      apply("formats", normFormats.length ? normFormats : undefined);
      apply("is_public", typeof isPublic === 'boolean' ? isPublic : undefined);
      apply("authors", selectedAuthors.length ? selectedAuthors : undefined);
      apply("subjects", selectedSubjects.length ? selectedSubjects : undefined);
      apply("cover", coverDataUrl || undefined);
      if (fileMeta?.file_id || fileMeta?.id) apply("file_id", fileMeta?.file_id ?? fileMeta?.id);
      if (fileMeta?.download_url || fileMeta?.url) apply("download_url", fileMeta?.download_url ?? fileMeta?.url);

      await api<Book>(`/api/catalog/books/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      alert("Book updated.");
      navigate(`/catalog/${id}`);
    } catch (err: any) {
      console.error(err);
      alert("Failed to update book: " + (err?.message || String(err)));
    }
  };

  const canSubmit = useMemo(() => !!title, [title]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg p-5 bg-gradient-to-r from-[#7b0f2b] to-rose-600 text-white shadow">
        <div className="text-xl font-semibold">Edit Book</div>
        <div className="text-sm opacity-90">ID: {id}</div>
      </div>
      {loading ? (
        <div className="text-slate-500">Loading...</div>
      ) : error ? (
        <div className="text-red-600">Failed to load: {error}</div>
      ) : (
        <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-md p-4 border shadow-sm">
            <label className="block text-sm font-medium">Title</label>
            <input required value={title} onChange={(e)=>setTitle(e.target.value)} className="mt-1 w-full border rounded-md px-3 py-2" />

            <label className="block text-sm font-medium mt-3">Year</label>
            <input value={year} onChange={(e)=>setYear(e.target.value)} className="mt-1 w-full border rounded-md px-3 py-2" />

            <label className="block text-sm font-medium mt-3">Language</label>
            {langs.length ? (
              <select value={lang} onChange={(e)=>setLang(e.target.value)} className="mt-1 w-full border rounded-md px-3 py-2">
                <option value="">Select language</option>
                {langs.map(l=> <option key={l} value={l}>{l}</option>)}
              </select>
            ) : (
              <input value={lang} onChange={(e)=>setLang(e.target.value)} className="mt-1 w-full border rounded-md px-3 py-2" />
            )}

            <label className="block text-sm font-medium mt-3">Publisher info</label>
            <input value={pubInfo} onChange={(e)=>setPubInfo(e.target.value)} className="mt-1 w-full border rounded-md px-3 py-2" />

            <label className="block text-sm font-medium mt-3">Summary</label>
            <textarea value={summary} onChange={(e)=>setSummary(e.target.value)} className="mt-1 w-full border rounded-md px-3 py-2 min-h-24" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              <div>
                <label className="block text-sm font-medium">ISBN</label>
                <input value={isbn} onChange={(e)=>setIsbn(e.target.value)} className="mt-1 w-full border rounded-md px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium">Edition</label>
                <input value={edition} onChange={(e)=>setEdition(e.target.value)} className="mt-1 w-full border rounded-md px-3 py-2" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              <div>
                <label className="block text-sm font-medium">Page count</label>
                <input type="number" min={0} value={pageCount} onChange={(e)=>setPageCount(e.target.value)} className="mt-1 w-full border rounded-md px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium">Available copies</label>
                <input type="number" min={0} value={availableCopies} onChange={(e)=>setAvailableCopies(e.target.value)} className="mt-1 w-full border rounded-md px-3 py-2" />
              </div>
            </div>

            <label className="block text-sm font-medium mt-3">Source</label>
            <select value={source} onChange={(e)=>setSource(e.target.value)} className="mt-1 w-full border rounded-md px-3 py-2">
              {sourceOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <div className="mb-4 mt-3">
              <MultiSelect
                label="Formats"
                options={formatOptions}
                selected={formats}
                onChange={setFormats}
                placeholder="Select formats"
              />
            </div>

            <div className="mb-4">
              <MultiSelect
                label="Authors"
                options={authors}
                selected={selectedAuthors}
                onChange={setSelectedAuthors}
                placeholder="Search or add author"
                onCreate={(v)=>{ if (!authors.includes(v)) setAuthors(a=>[...a, v]); if (!selectedAuthors.includes(v)) setSelectedAuthors(s=>[...s, v]); }}
              />
            </div>
            <div className="mb-4">
              <MultiSelect
                label="Subjects"
                options={subjects}
                selected={selectedSubjects}
                onChange={setSelectedSubjects}
                placeholder="Search or add subject"
                onCreate={(v)=>{ if (!subjects.includes(v)) setSubjects(a=>[...a, v]); if (!selectedSubjects.includes(v)) setSelectedSubjects(s=>[...s, v]); }}
              />
            </div>

            <div className="flex items-center gap-2 mt-1">
              <input id="is-public" type="checkbox" checked={isPublic} onChange={(e)=> setIsPublic(e.target.checked)} />
              <label htmlFor="is-public" className="text-sm">Publicly visible</label>
            </div>
          </div>

          <div className="bg-white rounded-md p-4 border shadow-sm">
            <div className="text-sm font-semibold text-slate-700 mb-3">Files</div>
            <label className="block text-sm font-medium">Cover image (optional)</label>
            <input type="file" accept="image/*" onChange={(e)=> setCoverFile(e.target.files?.[0] || null)} className="mt-1 block w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-[#7b0f2b]/10 file:text-[#7b0f2b] hover:file:bg-[#7b0f2b]/20" />

            <label className="block text-sm font-medium mt-4">Replace Book file (PDF, optional)</label>
            <input type="file" accept="application/pdf" onChange={(e)=> setPdfFile(e.target.files?.[0] || null)} className="mt-1 block w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-emerald-600/10 file:text-emerald-700 hover:file:bg-emerald-600/20" />
            <div className="text-xs text-slate-500 mt-2">If provided, the file is uploaded as RAW and the book is patched with returned file_id/download_url.</div>
          </div>

          <div className="md:col-span-2 flex items-center justify-between mt-1">
            <div className="text-sm text-slate-500">Update only fields you need; file/cover are optional.</div>
            <div className="flex gap-2">
              <button type="button" onClick={() => navigate(-1)} className="px-3 py-2 border rounded hover:bg-slate-50">Cancel</button>
              <button type="submit" disabled={!canSubmit} className="px-4 py-2 bg-[#7b0f2b] hover:bg-rose-800 text-white rounded-md shadow-sm transition-colors disabled:opacity-60">Save Changes</button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
