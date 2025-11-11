import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";


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
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  // server-provided lists (combined with local additions)
  const [authors, setAuthors] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [langs, setLangs] = useState<string[]>([]);

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

  const navigate = useNavigate();

  useEffect(() => { localStorage.setItem("local_authors", JSON.stringify(localAuthors)); }, [localAuthors]);
  useEffect(() => { localStorage.setItem("local_subjects", JSON.stringify(localSubjects)); }, [localSubjects]);

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

      // Build form-data as required by backend
      const form = new FormData();
      form.append("title", title);
      if (year) form.append("year", year);
      if (lang) form.append("lang", lang);
      if (pubInfo) form.append("pub_info", pubInfo);
      if (summary) form.append("summary", summary);
      if (coverDataUrl) form.append("cover", coverDataUrl);
      // lists as repeated form fields
      selectedAuthors.forEach((a) => form.append("authors", a));
      selectedSubjects.forEach((s) => form.append("subjects", s));
      if (fileMeta?.file_id || fileMeta?.id) form.append("file_id", fileMeta?.file_id ?? fileMeta?.id);
      if (fileMeta?.download_url || fileMeta?.url) form.append("download_url", fileMeta?.download_url ?? fileMeta?.url);

      const tokenHdr = localStorage.getItem("token");
      const createdRes = await fetch(`${BASE}${apiBooksPath}`, {
        method: "POST",
        headers: {
          ...(tokenHdr ? { Authorization: `Bearer ${tokenHdr}` } : {}),
        },
        body: form,
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

    setTitle(""); setYear(""); setLang(""); setPubInfo(""); setSummary(""); setCoverFile(null); setPdfFile(null);
      setSelectedAuthors([]); setSelectedSubjects([]);

      alert("Book created on server.");
      navigate("/admin");
    } catch (err: any) {
      console.error(err);
      alert("Failed to create book on server: " + (err?.message || err));
    }
  };

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Create Book</h3>
      <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">Title</label>
          <input required value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full border rounded-md px-3 py-2" />

          <label className="block text-sm font-medium mt-3">Year</label>
          <input value={year} onChange={(e) => setYear(e.target.value)} className="mt-1 w-full border rounded-md px-3 py-2" />

          <label className="block text-sm font-medium mt-3">Language</label>
          {langs.length > 0 ? (
            <select value={lang} onChange={(e) => setLang(e.target.value)} className="mt-1 w-full border rounded-md px-3 py-2">
              <option value="">— select —</option>
              {langs.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          ) : (
            <input value={lang} onChange={(e) => setLang(e.target.value)} className="mt-1 w-full border rounded-md px-3 py-2" />
          )}

          <label className="block text-sm font-medium mt-3">Publication Info</label>
          <input value={pubInfo} onChange={(e) => setPubInfo(e.target.value)} className="mt-1 w-full border rounded-md px-3 py-2" />

          <label className="block text-sm font-medium mt-3">Summary</label>
          <textarea value={summary} onChange={(e) => setSummary(e.target.value)} className="mt-1 w-full border rounded-md px-3 py-2" rows={6} />
        </div>

        <div>
          <label className="block text-sm font-medium">Authors (select)</label>
          <select multiple value={selectedAuthors} onChange={(e) => setSelectedAuthors(Array.from(e.target.selectedOptions).map(o => o.value))} className="mt-1 w-full border rounded-md px-3 py-2 h-32">
            {authors.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <div className="flex gap-2 mt-2">
            <input placeholder="Add author" value={newAuthor} onChange={(e) => setNewAuthor(e.target.value)} className="flex-1 border rounded-md px-3 py-2" />
            <button type="button" onClick={addAuthor} className="px-3 py-2 bg-slate-700 text-white rounded-md">Add</button>
          </div>

          <label className="block text-sm font-medium mt-4">Subjects (select)</label>
          <select multiple value={selectedSubjects} onChange={(e) => setSelectedSubjects(Array.from(e.target.selectedOptions).map(o => o.value))} className="mt-1 w-full border rounded-md px-3 py-2 h-32">
            {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <div className="flex gap-2 mt-2">
            <input placeholder="Add subject" value={newSubject} onChange={(e) => setNewSubject(e.target.value)} className="flex-1 border rounded-md px-3 py-2" />
            <button type="button" onClick={addSubject} className="px-3 py-2 bg-slate-700 text-white rounded-md">Add</button>
          </div>

          <label className="block text-sm font-medium mt-4">Cover image</label>
          <input type="file" accept="image/*" onChange={(e) => setCoverFile(e.target.files?.[0] || null)} className="mt-1" />
          <label className="block text-sm font-medium mt-4">Book file (PDF)</label>
          <input type="file" accept="application/pdf" onChange={(e) => setPdfFile(e.target.files?.[0] || null)} className="mt-1" />
        </div>

        <div className="md:col-span-2 flex items-center justify-between mt-4">
          <div className="text-sm text-slate-500">Data saved locally (demo). To persist to server, integrate the backend API.</div>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-md">Save Book</button>
            <button type="button" onClick={() => { localStorage.removeItem('books'); alert('Cleared demo books'); }} className="px-4 py-2 border rounded-md">Clear demo</button>
          </div>
        </div>
      </form>
    </div>
  );
}
