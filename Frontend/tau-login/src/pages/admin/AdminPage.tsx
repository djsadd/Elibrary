import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardHeader from "../../components/layout/DashboardHeader";

type Book = {
  id: string;
  title: string;
  year?: string | null;
  lang?: string | null;
  pub_info?: string | null;
  summary?: string | null;
  cover?: string | null; // data URL for small cover
  fileName?: string | null;
  download_url?: string | null; // not persisted across sessions for blob URLs
  authors: string[];
  subjects: string[];
  created_at: string;
  updated_at: string;
};

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result));
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
}

export default function AdminPage() {
  const [title, setTitle] = useState("");
  const [year, setYear] = useState("");
  const [lang, setLang] = useState("");
  const [pubInfo, setPubInfo] = useState("");
  const [summary, setSummary] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  const [authors, setAuthors] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("authors") || "[]");
    } catch { return []; }
  });
  const [subjects, setSubjects] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("subjects") || "[]");
    } catch { return []; }
  });

  const [selectedAuthors, setSelectedAuthors] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);

  const [newAuthor, setNewAuthor] = useState("");
  const [newSubject, setNewSubject] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    localStorage.setItem("authors", JSON.stringify(authors));
  }, [authors]);
  useEffect(() => {
    localStorage.setItem("subjects", JSON.stringify(subjects));
  }, [subjects]);

  const addAuthor = () => {
    const v = newAuthor.trim();
    if (!v) return;
    if (!authors.includes(v)) setAuthors((a) => [...a, v]);
    setSelectedAuthors((s) => Array.from(new Set([...s, v])));
    setNewAuthor("");
  };

  const addSubject = () => {
    const v = newSubject.trim();
    if (!v) return;
    if (!subjects.includes(v)) setSubjects((s) => [...s, v]);
    setSelectedSubjects((s) => Array.from(new Set([...s, v])));
    setNewSubject("");
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = String(Date.now());
    let coverDataUrl: string | null = null;
    if (coverFile) {
      try { coverDataUrl = await readAsDataUrl(coverFile); } catch {}
    }

    // create blob URL for pdf for current session
    const download_url = pdfFile ? URL.createObjectURL(pdfFile) : null;

    const book: Book = {
      id,
      title,
      year: year || null,
      lang: lang || null,
      pub_info: pubInfo || null,
      summary: summary || null,
      cover: coverDataUrl,
      fileName: pdfFile?.name || null,
      download_url,
      authors: selectedAuthors,
      subjects: selectedSubjects,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const books = JSON.parse(localStorage.getItem("books") || "[]");
    books.unshift(book);
    localStorage.setItem("books", JSON.stringify(books));

    // clear form
    setTitle(""); setYear(""); setLang(""); setPubInfo(""); setSummary(""); setCoverFile(null); setPdfFile(null);
    setSelectedAuthors([]); setSelectedSubjects([]);

    alert("Book saved locally (demo). Use the catalog or reader to access it in this session.");
    navigate("/");
  };

  return (
    <div className="space-y-4">
      <DashboardHeader />

      <div className="bg-white rounded-md p-6">
        <h2 className="text-xl font-semibold mb-4">Admin — Add Book</h2>
        <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium">Title</label>
            <input required value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full border rounded-md px-3 py-2" />

            <label className="block text-sm font-medium mt-3">Year</label>
            <input value={year} onChange={(e) => setYear(e.target.value)} className="mt-1 w-full border rounded-md px-3 py-2" />

            <label className="block text-sm font-medium mt-3">Language</label>
            <input value={lang} onChange={(e) => setLang(e.target.value)} className="mt-1 w-full border rounded-md px-3 py-2" />

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

            <label className="block text-sm font-medium mt-4">PDF file</label>
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
    </div>
  );
}
