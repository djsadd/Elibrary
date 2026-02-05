import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import MultiSelect from "@/components/ui/MultiSelect";

function getApiBase(): string {
  const raw = import.meta.env.VITE_API_URL as string | undefined;
  if (raw && /^https?:\/\//i.test(raw)) return raw.replace(/\/$/, "");
  return window.location.origin;
}

export default function QuickArticlePage() {
  const navigate = useNavigate();

  // Required fields
  const [title, setTitle] = useState("");
  const [fileId, setFileId] = useState("");
  const [formats, setFormats] = useState<string[]>(["EBOOK"]);

  // Optional fields
  const [year, setYear] = useState("");
  const [lang, setLang] = useState("");
  const [pubInfo, setPubInfo] = useState("");
  const [summary, setSummary] = useState("");
  const [isbn, setIsbn] = useState("");
  const [edition, setEdition] = useState("");
  const [pageCount, setPageCount] = useState<string>("");
  const [availableCopies, setAvailableCopies] = useState<string>("1");
  const [isPublic, setIsPublic] = useState(true);

  // Metadata
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [authors, setAuthors] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [selectedAuthors, setSelectedAuthors] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);

  // Local storage for persistent lists
  const [localAuthors, setLocalAuthors] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("local_authors") || "[]"); } catch { return []; }
  });
  const [localSubjects, setLocalSubjects] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("local_subjects") || "[]"); } catch { return []; }
  });

  const [langs, setLangs] = useState<string[]>([]);
  const [formatOptions] = useState<string[]>(["EBOOK", "AUDIOBOOK", "VIDEOBOOK", "ARTICLE"]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Persist local lists
  useEffect(() => { localStorage.setItem("local_authors", JSON.stringify(localAuthors)); }, [localAuthors]);
  useEffect(() => { localStorage.setItem("local_subjects", JSON.stringify(localSubjects)); }, [localSubjects]);

  // Fetch lists
  useEffect(() => {
    const apiBase = getApiBase();
    const base = `${apiBase}/api/catalog`;
    const token = localStorage.getItem("token");
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

  const handleFileUpload = async (file: File): Promise<string | null> => {
    const BASE = getApiBase();
    const uploadRawUrl = `${BASE}/api/catalog/upload/raw`;
    const token = localStorage.getItem("token");

    try {
      const safeName = encodeURIComponent(file.name);
      const res = await fetch(uploadRawUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "x_filename": safeName,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: file,
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Upload failed: ${res.status} ${txt}`);
      }

      const data = await res.json();
      return data.file?.file_id ?? data.file_id ?? null;
    } catch (err) {
      console.error("File upload error:", err);
      throw err;
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const token = localStorage.getItem("token");
      const BASE = getApiBase();

      // Validate required fields
      if (!title.trim()) {
        throw new Error("Title is required");
      }

      let uploadedFileId = fileId;

      // Upload PDF if provided
      if (pdfFile) {
        const uploadedId = await handleFileUpload(pdfFile);
        if (!uploadedId) {
          throw new Error("Failed to upload PDF file");
        }
        uploadedFileId = uploadedId;
      }

      if (!uploadedFileId) {
        throw new Error("File ID is required");
      }

      // Upload cover if provided
      let coverUrl: string | null = null;
      if (coverFile) {
        try {
          const reader = new FileReader();
          const coverDataUrl = await new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = reject;
            reader.readAsDataURL(coverFile);
          });
          coverUrl = coverDataUrl;
        } catch (err) {
          console.warn("Failed to read cover file", err);
        }
      }

      // Build payload for quick endpoint
      const payload: any = {
        title: title.trim(),
        file_id: uploadedFileId,
        formats: formats.length > 0 ? formats.map(f => String(f).trim().toUpperCase()) : ["EBOOK"],
        ...(year ? { year } : {}),
        ...(lang ? { lang } : {}),
        ...(pubInfo ? { pub_info: pubInfo } : {}),
        ...(summary ? { summary } : {}),
        ...(isbn ? { isbn } : {}),
        ...(edition ? { edition } : {}),
        ...(pageCount ? { page_count: Number(pageCount) } : {}),
        ...(availableCopies ? { available_copies: Number(availableCopies) } : {}),
        ...(typeof isPublic === "boolean" ? { is_public: isPublic } : {}),
        ...(coverUrl ? { cover: coverUrl } : {}),
        ...(selectedAuthors.length ? { authors: selectedAuthors } : {}),
        ...(selectedSubjects.length ? { subjects: selectedSubjects } : {}),
      };

      // Post to quick endpoint
      const res = await fetch(`${BASE}/api/catalog/books/quick`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Failed to create article: ${res.status} ${errText}`);
      }

      const created = await res.json();

      // Store in local cache
      const articles = JSON.parse(localStorage.getItem("articles") || "[]");
      articles.unshift(created);
      localStorage.setItem("articles", JSON.stringify(articles));

      // Show success and redirect
      alert("✅ Article created successfully!");
      navigate("/admin");
    } catch (err: any) {
      const msg = err?.message || String(err);
      setError(msg);
      console.error("Error creating article:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            type="button"
            onClick={() => navigate("/admin")}
            className="text-sm text-[#7b0f2b] hover:text-rose-700 font-medium mb-4 flex items-center gap-2"
          >
            ← Back to Admin
          </button>
          <div className="rounded-lg p-6 bg-gradient-to-r from-[#7b0f2b] via-rose-600 to-pink-500 text-white shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">⚡</span>
              <h1 className="text-3xl font-bold">Quick Article Upload</h1>
            </div>
            <p className="text-sm opacity-95">
              Quickly upload articles, documents and materials to the catalogue with minimal information required.
            </p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800 font-medium">⚠️ {error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={onSubmit} className="space-y-6">
          {/* Required Fields Section */}
          <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 mb-5">
              <span className="text-xl font-bold text-[#7b0f2b]">1</span>
              <h2 className="text-lg font-semibold text-slate-800">Essential Information</h2>
              <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">Required</span>
            </div>

            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  📝 Article Title *
                </label>
                <input
                  required
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter article title..."
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7b0f2b] focus:border-transparent transition"
                />
              </div>

              {/* File Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    📄 PDF File
                  </label>
                  <label className="block relative cursor-pointer">
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    <div className={`px-4 py-3 border-2 border-dashed rounded-lg text-center transition ${
                      pdfFile 
                        ? "border-emerald-500 bg-emerald-50" 
                        : "border-slate-300 hover:border-slate-400"
                    }`}>
                      {pdfFile ? (
                        <div className="text-sm">
                          <p className="font-semibold text-emerald-700">✓ {pdfFile.name}</p>
                          <p className="text-xs text-emerald-600">{(pdfFile.size / 1024 / 1024).toFixed(1)} MB</p>
                        </div>
                      ) : (
                        <div className="text-slate-500">
                          <p className="text-sm font-medium">Click to upload PDF</p>
                          <p className="text-xs text-slate-400">or drag and drop</p>
                        </div>
                      )}
                    </div>
                  </label>
                  {!pdfFile && fileId && (
                    <p className="text-xs text-emerald-600 mt-1">✓ File ID: {fileId}</p>
                  )}
                </div>

                {/* Format Selection */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    📦 Format
                  </label>
                  <div className="space-y-2">
                    {formatOptions.map((fmt) => (
                      <label key={fmt} className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formats.includes(fmt)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormats([...formats, fmt]);
                            } else {
                              setFormats(formats.filter((f) => f !== fmt));
                            }
                          }}
                          className="w-4 h-4 text-[#7b0f2b] rounded border-slate-300 focus:ring-2 focus:ring-[#7b0f2b]"
                        />
                        <span className="text-sm text-slate-700">{fmt}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Or File ID */}
              <div className="border-t pt-4">
                <p className="text-xs text-slate-500 mb-3">Or provide a file ID directly:</p>
                <input
                  type="text"
                  value={fileId}
                  onChange={(e) => setFileId(e.target.value)}
                  placeholder="Enter file ID (if already uploaded)..."
                  className="w-full px-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7b0f2b]"
                />
              </div>
            </div>
          </div>

          {/* Optional Fields Section */}
          <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 mb-5">
              <span className="text-xl font-bold text-slate-400">2</span>
              <h2 className="text-lg font-semibold text-slate-800">Details & Metadata</h2>
              <span className="text-xs text-slate-500">Optional</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Year */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Year</label>
                <input
                  type="text"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  placeholder="2024"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7b0f2b]/30"
                />
              </div>

              {/* Language */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Language</label>
                {langs.length > 0 ? (
                  <select
                    value={lang}
                    onChange={(e) => setLang(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7b0f2b]/30"
                  >
                    <option value="">Select language</option>
                    {langs.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={lang}
                    onChange={(e) => setLang(e.target.value)}
                    placeholder="ru, en..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7b0f2b]/30"
                  />
                )}
              </div>

              {/* ISBN */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">ISBN</label>
                <input
                  type="text"
                  value={isbn}
                  onChange={(e) => setIsbn(e.target.value)}
                  placeholder="978-..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7b0f2b]/30"
                />
              </div>

              {/* Edition */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Edition</label>
                <input
                  type="text"
                  value={edition}
                  onChange={(e) => setEdition(e.target.value)}
                  placeholder="1st edition..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7b0f2b]/30"
                />
              </div>

              {/* Page Count */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Pages</label>
                <input
                  type="number"
                  min="0"
                  value={pageCount}
                  onChange={(e) => setPageCount(e.target.value)}
                  placeholder="150"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7b0f2b]/30"
                />
              </div>

              {/* Available Copies */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Available Copies</label>
                <input
                  type="number"
                  min="0"
                  value={availableCopies}
                  onChange={(e) => setAvailableCopies(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7b0f2b]/30"
                />
              </div>
            </div>

            {/* Publisher Info */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Publisher Info</label>
              <input
                type="text"
                value={pubInfo}
                onChange={(e) => setPubInfo(e.target.value)}
                placeholder="Publishing details..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7b0f2b]/30"
              />
            </div>

            {/* Summary */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Summary / Description</label>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Brief description of the article..."
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7b0f2b]/30"
              />
            </div>
          </div>

          {/* Content Classification */}
          <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 mb-5">
              <span className="text-xl font-bold text-slate-400">3</span>
              <h2 className="text-lg font-semibold text-slate-800">Classification</h2>
            </div>

            <div className="space-y-4">
              {/* Authors */}
              <div>
                <MultiSelect
                  label="👥 Authors"
                  options={authors}
                  selected={selectedAuthors}
                  onChange={setSelectedAuthors}
                  onCreate={(v) => {
                    if (!authors.includes(v)) setAuthors((a) => [...a, v]);
                    if (!localAuthors.includes(v)) setLocalAuthors((a) => [...a, v]);
                  }}
                  placeholder="Search or add author..."
                />
              </div>

              {/* Subjects */}
              <div>
                <MultiSelect
                  label="🏷️ Subjects / Categories"
                  options={subjects}
                  selected={selectedSubjects}
                  onChange={setSelectedSubjects}
                  onCreate={(v) => {
                    if (!subjects.includes(v)) setSubjects((s) => [...s, v]);
                    if (!localSubjects.includes(v)) setLocalSubjects((s) => [...s, v]);
                  }}
                  placeholder="Search or add subject..."
                />
              </div>
            </div>
          </div>

          {/* Media Section */}
          <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 mb-5">
              <span className="text-xl font-bold text-slate-400">4</span>
              <h2 className="text-lg font-semibold text-slate-800">Cover Image</h2>
            </div>

            <label className="block">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              <div className={`px-4 py-4 border-2 border-dashed rounded-lg text-center cursor-pointer transition ${
                coverFile 
                  ? "border-blue-500 bg-blue-50" 
                  : "border-slate-300 hover:border-slate-400"
              }`}>
                {coverFile ? (
                  <div className="text-sm">
                    <p className="font-semibold text-blue-700">✓ {coverFile.name}</p>
                    <p className="text-xs text-blue-600">{(coverFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                ) : (
                  <div className="text-slate-500">
                    <p className="text-sm font-medium">Click to upload cover image</p>
                    <p className="text-xs text-slate-400">PNG, JPG, WEBP supported</p>
                  </div>
                )}
              </div>
            </label>
          </div>

          {/* Visibility */}
          <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-800">👁️ Public Access</h3>
                <p className="text-sm text-slate-500 mt-1">Make this article visible to all users</p>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="w-5 h-5 text-[#7b0f2b] rounded border-slate-300 focus:ring-2 focus:ring-[#7b0f2b]"
                />
                <span className={`font-medium ${isPublic ? "text-emerald-700" : "text-slate-500"}`}>
                  {isPublic ? "Public" : "Private"}
                </span>
              </label>
            </div>
          </div>

          {/* Submit Section */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => navigate("/admin")}
              className="flex-1 px-6 py-3 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-[#7b0f2b] to-rose-600 text-white font-semibold rounded-lg hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? "Creating..." : "🚀 Create Article"}
            </button>
          </div>

          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-xs text-blue-700">
              <strong>💡 Tip:</strong> This form is optimized for quick uploads. Only title and file are required. Fill other fields as needed.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
