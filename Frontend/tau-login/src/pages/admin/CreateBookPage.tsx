import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import MultiSelect from "@/components/ui/MultiSelect";


function readAsDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result));
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
}

export default function CreateBookPage() {
  const [title, setTitle] = useState("");
  const [year, setYear] = useState("");
  const [lang, setLang] = useState("");
  const [pubInfo, setPubInfo] = useState("");
  const [summary, setSummary] = useState("");
  // new metadata fields
  const [isbn, setIsbn] = useState("");
  const [edition, setEdition] = useState("");
  const [pageCount, setPageCount] = useState<string>("");
  const [availableCopies, setAvailableCopies] = useState<string>("");
  const [source, setSource] = useState("LIBRARY");
  const [formats, setFormats] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState<boolean>(true);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  // server-provided lists (combined with local additions)
  const [authors, setAuthors] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [langs, setLangs] = useState<string[]>([]);
  const [formatOptions] = useState<string[]>(["EBOOK", "HARDCOPY", "AUDIOBOOK", "ARTICLE"]);
  const [sourceOptions] = useState<string[]>(["KABIS", "LIBRARY", "RMEB", "OTHER"]);

  // locally persisted additions (kept separate so we don't overwrite server lists)
  const [localAuthors, setLocalAuthors] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("local_authors") || "[]"); } catch { return []; }
  });
  const [localSubjects, setLocalSubjects] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("local_subjects") || "[]"); } catch { return []; }
  });

  const [selectedAuthors, setSelectedAuthors] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);

  const [newAuthor, setNewAuthor] = useState("");
  const [newSubject, setNewSubject] = useState("");

  // Users selection (restored)
  const [users, setUsers] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("ui_users") || "[]"); } catch { return []; }
  });
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  const navigate = useNavigate();

  useEffect(() => { localStorage.setItem("local_authors", JSON.stringify(localAuthors)); }, [localAuthors]);
  useEffect(() => { localStorage.setItem("local_subjects", JSON.stringify(localSubjects)); }, [localSubjects]);
  useEffect(() => { try { localStorage.setItem("ui_users", JSON.stringify(users)); } catch {} }, [users]);

  // fetch server lists on mount and whenever local additions change
  useEffect(() => {
    const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
    const base = `${BASE}/api/catalog`;
    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

    const fetchAuthors = async () => {
      try {
  const res = await fetch(`${base}/authors?limit=200`, { headers });
        if (!res.ok) throw new Error(`Authors fetch ${res.status}`);
        const data: string[] = await res.json();
        setAuthors(Array.from(new Set([...(data || []), ...localAuthors])));
      } catch (err) {
        console.warn("Failed to fetch authors, using local only", err);
        setAuthors(Array.from(new Set([...localAuthors])));
      }
    };

    const fetchSubjects = async () => {
      try {
  const res = await fetch(`${base}/subjects?limit=200`, { headers });
        if (!res.ok) throw new Error(`Subjects fetch ${res.status}`);
        const data: string[] = await res.json();
        setSubjects(Array.from(new Set([...(data || []), ...localSubjects])));
      } catch (err) {
        console.warn("Failed to fetch subjects, using local only", err);
        setSubjects(Array.from(new Set([...localSubjects])));
      }
    };

    const fetchLangs = async () => {
      try {
  const res = await fetch(`${base}/langs`, { headers });
        if (!res.ok) throw new Error(`Langs fetch ${res.status}`);
        const data: string[] = await res.json();
        setLangs(data || []);
        if (!lang && data?.length) setLang(data[0]);
      } catch (err) {
        console.warn("Failed to fetch langs", err);
      }
    };

    fetchAuthors();
    fetchSubjects();
    fetchLangs();
  }, [localAuthors, localSubjects]);

  const addAuthor = () => {
    const v = newAuthor.trim();
    if (!v) return;
    if (!authors.includes(v)) setAuthors(a => Array.from(new Set([...a, v])));
    if (!localAuthors.includes(v)) setLocalAuthors(a => [...a, v]);
    setSelectedAuthors(s => Array.from(new Set([...s, v])));
    setNewAuthor("");
  };
  const addSubject = () => {
    const v = newSubject.trim();
    if (!v) return;
    if (!subjects.includes(v)) setSubjects(s => Array.from(new Set([...s, v])));
    if (!localSubjects.includes(v)) setLocalSubjects(s => [...s, v]);
    setSelectedSubjects(s => Array.from(new Set([...s, v])));
    setNewSubject("");
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // New flow: if a PDF is attached, upload it as a RAW request first to bypass part-size limits,
    // then POST book metadata as multipart/form-data including returned file_id/download_url.
    const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
    const apiBooksPath = "/api/catalog/books";
    const uploadRawUrl = `${BASE}/api/catalog/upload/raw`; // raw upload endpoint

    async function uploadRawFile(file: File, token?: string) {
      // HTTP header values must be ISO-8859-1; file.name may contain Unicode.
      // Encode filename using encodeURIComponent so header is safe. Server should decode it.
      const safeName = encodeURIComponent(file.name);
      const res = await fetch(uploadRawUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          // Backend expects underscore header name due to convert_underscores=False
          "x_filename": safeName,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: file,
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        try { console.error("upload/raw error", res.status, txt); } catch {}
        throw new Error(`${res.status} ${txt}`);
      }
      const data = await res.json();
      // server may return { file: { file_id, download_url } } or { file_id, download_url }
      try { console.log("upload/raw response", data); } catch {}
      return data.file ?? data;
    }

    try {
      const token = localStorage.getItem("token");

      // optionally upload PDF first
      let fileMeta: any = null;
      if (pdfFile) {
        fileMeta = await uploadRawFile(pdfFile, token || undefined);
      }

      // prepare optional cover as data URL string
      let coverDataUrl: string | null = null;
      if (coverFile) {
        try { coverDataUrl = await readAsDataUrl(coverFile); } catch {}
      }

      // Build JSON payload as required by backend
      const payload: any = {
        title,
        ...(year ? { year } : {}),
        ...(lang ? { lang } : {}),
        ...(pubInfo ? { pub_info: pubInfo } : {}),
        ...(summary ? { summary } : {}),
        ...(isbn ? { isbn } : {}),
        ...(edition ? { edition } : {}),
        ...(pageCount ? { page_count: Number(pageCount) } : {}),
        ...(availableCopies ? { available_copies: Number(availableCopies) } : {}),
        ...(typeof isPublic === "boolean" ? { is_public: isPublic } : {}),
        ...(source ? { source: String(source).trim().toUpperCase() } : {}),
        ...(coverDataUrl ? { cover: coverDataUrl } : {}),
        ...(selectedAuthors.length ? { authors: selectedAuthors } : {}),
        ...(selectedSubjects.length ? { subjects: selectedSubjects } : {}),
        ...(formats.length ? { formats: formats.map(f => String(f).trim().toUpperCase()) } : {}),
        ...((fileMeta?.file_id || fileMeta?.id) ? { file_id: fileMeta?.file_id ?? fileMeta?.id } : {}),
        ...((fileMeta?.download_url || fileMeta?.url) ? { download_url: fileMeta?.download_url ?? fileMeta?.url } : {}),
      };

      const tokenHdr = localStorage.getItem("token");
      const createdRes = await fetch(`${BASE}${apiBooksPath}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(tokenHdr ? { Authorization: `Bearer ${tokenHdr}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!createdRes.ok) {
        const err = await createdRes.text();
        throw new Error(`${createdRes.status} ${err}`);
      }
      const created = await createdRes.json();
      // Optionally store created book in local demo list for immediate visibility
    const books = JSON.parse(localStorage.getItem("books") || "[]");
      books.unshift(created);
      localStorage.setItem("books", JSON.stringify(books));

    setTitle(""); setYear(""); setLang(""); setPubInfo(""); setSummary("");
      setIsbn(""); setEdition(""); setPageCount(""); setAvailableCopies(""); setSource(""); setFormats([]); setIsPublic(true);
      setCoverFile(null); setPdfFile(null);
      setSelectedAuthors([]); setSelectedSubjects([]);

      alert("Book created on server.");
      navigate("/admin");
    } catch (err: any) {
      console.error(err);
      alert("Failed to create book on server: " + (err?.message || err));
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg p-5 bg-gradient-to-r from-[#7b0f2b] to-rose-600 text-white shadow">
        <div className="text-xl font-semibold">Create Book</div>
        <div className="text-sm opacity-90">Upload files and fill metadata to add a new book to the catalogue.</div>
      </div>
      <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-md p-4 border shadow-sm">
          <label className="block text-sm font-medium">Title</label>
          <input required value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#7b0f2b]/30" />

          <label className="block text-sm font-medium mt-3">Year</label>
          <input value={year} onChange={(e) => setYear(e.target.value)} className="mt-1 w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#7b0f2b]/30" />

          <label className="block text-sm font-medium mt-3">Language</label>
          {langs.length > 0 ? (
            <select value={lang} onChange={(e) => setLang(e.target.value)} className="mt-1 w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#7b0f2b]/30">
              <option value="">Select language</option>
              {langs.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          ) : (
            <input value={lang} onChange={(e) => setLang(e.target.value)} className="mt-1 w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#7b0f2b]/30" />
          )}

          <label className="block text-sm font-medium mt-3">Publisher info</label>
          <input value={pubInfo} onChange={(e) => setPubInfo(e.target.value)} className="mt-1 w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#7b0f2b]/30" />

          <label className="block text-sm font-medium mt-3">Summary</label>
          <textarea value={summary} onChange={(e) => setSummary(e.target.value)} className="mt-1 w-full border rounded-md px-3 py-2 min-h-24 focus:outline-none focus:ring-2 focus:ring-[#7b0f2b]/30" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <div>
              <label className="block text-sm font-medium">ISBN</label>
              <input value={isbn} onChange={(e) => setIsbn(e.target.value)} placeholder="978-..." className="mt-1 w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#7b0f2b]/30" />
            </div>
            <div>
              <label className="block text-sm font-medium">Edition</label>
              <input value={edition} onChange={(e) => setEdition(e.target.value)} placeholder="3-е издание" className="mt-1 w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#7b0f2b]/30" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <div>
              <label className="block text-sm font-medium">Page count</label>
              <input type="number" min={0} value={pageCount} onChange={(e) => setPageCount(e.target.value)} className="mt-1 w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#7b0f2b]/30" />
            </div>
            <div>
              <label className="block text-sm font-medium">Available copies</label>
              <input type="number" min={0} value={availableCopies} onChange={(e) => setAvailableCopies(e.target.value)} className="mt-1 w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#7b0f2b]/30" />
            </div>
          </div>

          <label className="block text-sm font-medium mt-3">Source</label>
          <select value={source} onChange={(e) => setSource(e.target.value)} className="mt-1 w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#7b0f2b]/30">
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
              onCreate={(v)=>{ if (!authors.includes(v)) setAuthors(a=>[...a, v]); if (!localAuthors.includes(v)) setLocalAuthors(a=>[...a, v]); }}
              placeholder="Search or add author"
            />
          </div>
          <div className="mb-4">
            <MultiSelect
              label="Subjects"
              options={subjects}
              selected={selectedSubjects}
              onChange={setSelectedSubjects}
              onCreate={(v)=>{ if (!subjects.includes(v)) setSubjects(s=>[...s, v]); if (!localSubjects.includes(v)) setLocalSubjects(s=>[...s, v]); }}
              placeholder="Search or add subject"
            />
          </div>
          <div className="flex items-center gap-2 mt-1">
            <input id="is-public" type="checkbox" checked={isPublic} onChange={(e)=> setIsPublic(e.target.checked)} />
            <label htmlFor="is-public" className="text-sm">Publicly visible</label>
          </div>
          <div className="mb-4">
            <MultiSelect
              label="Users (optional)"
              options={users}
              selected={selectedUsers}
              onChange={setSelectedUsers}
              onCreate={(v)=>{ if (!users.includes(v)) setUsers(prev=>[...prev, v]); }}
              placeholder="Search or add user (email/login)"
            />
          </div>

        </div>

        <div className="bg-white rounded-md p-4 border shadow-sm">
          <div className="text-sm font-semibold text-slate-700 mb-3">Files</div>
          <label className="block text-sm font-medium">Cover image</label>
          <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0] || null; setCoverFile(f); }} className="mt-1 block w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-[#7b0f2b]/10 file:text-[#7b0f2b] hover:file:bg-[#7b0f2b]/20" />
          <label className="block text-sm font-medium mt-4">Book file (PDF)</label>
          <input type="file" accept="application/pdf" onChange={(e) => setPdfFile(e.target.files?.[0] || null)} className="mt-1 block w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-emerald-600/10 file:text-emerald-700 hover:file:bg-emerald-600/20" />
          <div className="text-xs text-slate-500 mt-2">PDF is uploaded as RAW, then the book is created and linked.</div>

        </div>

        <div className="md:col-span-2 flex items-center justify-between mt-1">
          <div className="text-sm text-slate-500">We first upload files, then create the book with metadata.</div>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 bg-[#7b0f2b] hover:bg-rose-800 text-white rounded-md shadow-sm transition-colors">Save Book</button>
            <button type="button" onClick={() => { localStorage.removeItem('books'); alert('Cleared demo books'); }} className="px-4 py-2 border rounded-md hover:bg-slate-50">Clear demo</button>
          </div>
        </div>
      </form>
    </div>
  );
}









