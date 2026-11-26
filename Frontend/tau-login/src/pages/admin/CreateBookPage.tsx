import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import MultiSelect from "@/components/ui/MultiSelect";
import { t } from "@/shared/i18n";


function readAsDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result));
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
}

function getApiBase(): string {
  const raw = import.meta.env.VITE_API_URL as string | undefined;
  if (raw && /^https?:\/\//i.test(raw)) return raw.replace(/\/$/, "");
  return window.location.origin;
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const GUIDE_KEY = "admin_create_book_guide_open";
const BOOK_EXTS = [".pdf", ".epub", ".djvu"];

const inputCls =
  "mt-1 w-full rounded-md border border-[var(--tau-line)] bg-white px-3 py-2 text-sm transition " +
  "focus:border-[var(--tau-red)] focus:outline-none focus:ring-2 focus:ring-[var(--tau-red)]/15";
const labelCls = "block text-sm font-medium text-[var(--tau-ink)]";
const hintCls = "mt-1 text-xs leading-relaxed text-[var(--tau-muted)]";

function Section({ n, title, desc, children }: { n: number; title: string; desc: string; children: ReactNode }) {
  return (
    <section className="rounded-md border border-[var(--tau-line)] bg-white p-5 shadow-sm">
      <header className="mb-4 flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--tau-red)] text-xs font-semibold text-white">
          {n}
        </span>
        <div>
          <h2 className="text-base font-semibold text-[var(--tau-ink)]">{title}</h2>
          <p className="text-xs text-[var(--tau-muted)]">{desc}</p>
        </div>
      </header>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function FileDrop({
  label, hint, file, onFile, accepts, acceptAttr, previewUrl, labels,
}: {
  label: string;
  hint: string;
  file: File | null;
  onFile: (f: File | null) => void;
  accepts: (f: File) => boolean;
  acceptAttr: string;
  previewUrl?: string | null;
  labels: { drop: string; change: string; remove: string; wrongType: string };
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const take = (f: File | null | undefined) => {
    if (!f) return;
    if (!accepts(f)) { setError(labels.wrongType); return; }
    setError(null);
    onFile(f);
  };

  return (
    <div>
      <div className={labelCls}>{label}</div>
      <input
        ref={inputRef}
        type="file"
        accept={acceptAttr}
        className="hidden"
        onChange={(e) => { take(e.target.files?.[0]); e.target.value = ""; }}
      />
      {file ? (
        <div className="mt-1 flex items-center gap-3 rounded-md border border-[var(--tau-line)] bg-[var(--tau-wine)] p-3">
          {previewUrl ? (
            <img src={previewUrl} alt="" className="h-20 w-14 shrink-0 rounded object-cover shadow-sm" />
          ) : (
            <div className="flex h-12 w-10 shrink-0 items-center justify-center rounded bg-white text-[10px] font-bold uppercase text-[var(--tau-red)] shadow-sm">
              {file.name.split(".").pop()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-[var(--tau-ink)]" title={file.name}>{file.name}</div>
            <div className="text-xs text-[var(--tau-muted)]">{formatSize(file.size)}</div>
            <div className="mt-1 flex gap-3 text-xs">
              <button type="button" onClick={() => inputRef.current?.click()} className="font-medium text-[var(--tau-red)] hover:underline">{labels.change}</button>
              <button type="button" onClick={() => onFile(null)} className="text-[var(--tau-muted)] hover:text-[var(--tau-ink)] hover:underline">{labels.remove}</button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); take(e.dataTransfer.files?.[0]); }}
          className={
            "mt-1 flex w-full flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed px-4 py-6 text-center transition " +
            (dragging
              ? "border-[var(--tau-red)] bg-[var(--tau-red)]/5"
              : "border-[var(--tau-line)] bg-[var(--tau-wine)] hover:border-[var(--tau-red)]/50")
          }
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-[var(--tau-red)]" aria-hidden>
            <path d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-sm text-[var(--tau-ink)]">{labels.drop}</span>
        </button>
      )}
      <p className={hintCls}>{hint}</p>
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}

function CheckItem({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      <span
        className={
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] " +
          (ok ? "bg-emerald-600 text-white" : "border border-[var(--tau-line)] bg-white text-transparent")
        }
        aria-hidden
      >
        ✓
      </span>
      <span className={ok ? "text-[var(--tau-ink)]" : "text-[var(--tau-muted)]"}>{children}</span>
    </li>
  );
}

export default function CreateBookPage() {
  const tr = (key: string, vars?: Record<string, any>) => t(`admin.createBook.${key}`, vars);
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
  const [externalUrl, setExternalUrl] = useState("");
  const [formats, setFormats] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState<boolean>(true);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  // server-provided lists (combined with local additions)
  const [authors, setAuthors] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [langs, setLangs] = useState<string[]>([]);
  const [formatOptions] = useState<string[]>(["EBOOK", "HARDCOPY", "AUDIOBOOK", "ARTICLE"]);
  const [sourceOptions] = useState<string[]>(["KABIS", "LIBRARY", "RMEB", "IPRBOOKS", "EXTERNAL", "OTHER"]);

  // locally persisted additions (kept separate so we don't overwrite server lists)
  const [localAuthors, setLocalAuthors] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("local_authors") || "[]"); } catch { return []; }
  });
  const [localSubjects, setLocalSubjects] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("local_subjects") || "[]"); } catch { return []; }
  });

  const [selectedAuthors, setSelectedAuthors] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);

  const [users, setUsers] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("ui_users") || "[]"); } catch { return []; }
  });
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  const [guideOpen, setGuideOpen] = useState<boolean>(() => {
    try { return localStorage.getItem(GUIDE_KEY) !== "0"; } catch { return true; }
  });
  const [phase, setPhase] = useState<"idle" | "uploading" | "saving">("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const navigate = useNavigate();

  useEffect(() => { try { localStorage.setItem("local_authors", JSON.stringify(localAuthors)); } catch {} }, [localAuthors]);
  useEffect(() => { try { localStorage.setItem("local_subjects", JSON.stringify(localSubjects)); } catch {} }, [localSubjects]);
  useEffect(() => { try { localStorage.setItem("ui_users", JSON.stringify(users)); } catch {} }, [users]);
  useEffect(() => { try { localStorage.setItem(GUIDE_KEY, guideOpen ? "1" : "0"); } catch {} }, [guideOpen]);

  useEffect(() => {
    if (!coverFile) { setCoverPreview(null); return; }
    const url = URL.createObjectURL(coverFile);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);

  // fetch server lists on mount and whenever local additions change
  useEffect(() => {
    const apiBase = getApiBase();
    const base = `${apiBase}/api/catalog`;
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

  const busy = phase !== "idle";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setSubmitError(null);
    // Upload the book file as a RAW request first (bypasses multipart part-size limits),
    // then POST book metadata as JSON including the returned file_id/download_url.
    const BASE = getApiBase();
    const apiBooksPath = "/api/catalog/books";
    const uploadRawUrl = `${BASE}/api/catalog/upload/raw`;

    async function uploadRawFile(file: File, token?: string) {
      // HTTP header values must be ISO-8859-1; file.name may contain Unicode, so encode it.
      const safeName = encodeURIComponent(file.name);
      const res = await fetch(uploadRawUrl, {
        method: "POST",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          "X-Filename": safeName,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: file,
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`${res.status} ${txt}`);
      }
      const data = await res.json();
      // server may return { file: { file_id, download_url } } or { file_id, download_url }
      return data.file ?? data;
    }

    try {
      const token = localStorage.getItem("token");

      let fileMeta: any = null;
      if (pdfFile) {
        setPhase("uploading");
        fileMeta = await uploadRawFile(pdfFile, token || undefined);
      }
      setPhase("saving");

      let coverDataUrl: string | null = null;
      if (coverFile) {
        try { coverDataUrl = await readAsDataUrl(coverFile); } catch {}
      }

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
        ...(externalUrl.trim() ? { external_url: externalUrl.trim() } : {}),
        ...(coverDataUrl ? { cover: coverDataUrl } : {}),
        ...(selectedAuthors.length ? { authors: selectedAuthors } : {}),
        ...(selectedSubjects.length ? { subjects: selectedSubjects } : {}),
        ...(formats.length ? { formats: formats.map(f => String(f).trim().toUpperCase()) } : {}),
        ...((fileMeta?.file_id || fileMeta?.id) ? { file_id: fileMeta?.file_id ?? fileMeta?.id } : {}),
        ...((fileMeta?.download_url || fileMeta?.url) ? { download_url: fileMeta?.download_url ?? fileMeta?.url } : {}),
      };

      const createdRes = await fetch(`${BASE}${apiBooksPath}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!createdRes.ok) {
        const err = await createdRes.text();
        throw new Error(`${createdRes.status} ${err}`);
      }
      const created = await createdRes.json();
      try {
        const books = JSON.parse(localStorage.getItem("books") || "[]");
        books.unshift(created);
        localStorage.setItem("books", JSON.stringify(books));
      } catch {}

      alert(tr("messages.created"));
      navigate("/admin");
    } catch (err: any) {
      console.error(err);
      setSubmitError(`${tr("messages.createFailed")}: ${err?.message || err}`);
    } finally {
      setPhase("idle");
    }
  };

  const uploadLabels = {
    drop: tr("upload.drop"),
    change: tr("upload.change"),
    remove: tr("upload.remove"),
    wrongType: tr("upload.wrongType"),
  };

  const steps = [1, 2, 3, 4, 5, 6];

  return (
    <div className="space-y-5">
      <div className="admin-editor-banner">
        <h1>{tr("title")}</h1>
        <p>{tr("subtitle")}</p>
      </div>

      {/* Built-in guide */}
      <section className="rounded-md border border-[var(--tau-line)] bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setGuideOpen(o => !o)}
          aria-expanded={guideOpen}
          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
        >
          <span className="flex items-center gap-2 text-base font-semibold text-[var(--tau-ink)]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--tau-red)]" aria-hidden>
              <circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" strokeLinecap="round" />
            </svg>
            {tr("guide.title")}
          </span>
          <span className="text-sm text-[var(--tau-red)]">{guideOpen ? tr("guide.hide") : tr("guide.show")}</span>
        </button>
        {guideOpen && (
          <ol className="grid gap-3 border-t border-[var(--tau-line)] p-5 sm:grid-cols-2 lg:grid-cols-3">
            {steps.map(n => (
              <li key={n} className="flex gap-3 rounded-md bg-[var(--tau-wine)] p-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--tau-red)] text-xs font-semibold text-[var(--tau-red)]">
                  {n}
                </span>
                <div>
                  <div className="text-sm font-semibold text-[var(--tau-ink)]">{tr(`guide.step${n}.title`)}</div>
                  <p className="mt-0.5 text-xs leading-relaxed text-[var(--tau-muted)]">{tr(`guide.step${n}.text`)}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Section n={1} title={tr("sections.main.title")} desc={tr("sections.main.desc")}>
            <div>
              <label htmlFor="cb-title" className={labelCls}>
                {tr("fields.title")} <span className="text-[var(--tau-red)]">*</span>
              </label>
              <input id="cb-title" required value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
            </div>
            <div>
              <MultiSelect
                label={tr("fields.authors")}
                options={authors}
                selected={selectedAuthors}
                onChange={setSelectedAuthors}
                onCreate={(v)=>{ if (!authors.includes(v)) setAuthors(a=>[...a, v]); if (!localAuthors.includes(v)) setLocalAuthors(a=>[...a, v]); }}
                placeholder={tr("placeholders.author")}
                createOptionLabel={(value) => tr("addOption", { value })}
                noResultsText={tr("noResults")}
                removeLabel={tr("remove")}
              />
              <p className={hintCls}>{tr("hints.authors")}</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="cb-year" className={labelCls}>{tr("fields.year")}</label>
                <input id="cb-year" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2024" className={inputCls} />
              </div>
              <div>
                <label htmlFor="cb-lang" className={labelCls}>{tr("fields.language")}</label>
                {langs.length > 0 ? (
                  <select id="cb-lang" value={lang} onChange={(e) => setLang(e.target.value)} className={inputCls}>
                    <option value="">{tr("placeholders.selectLanguage")}</option>
                    {langs.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                ) : (
                  <input id="cb-lang" value={lang} onChange={(e) => setLang(e.target.value)} className={inputCls} />
                )}
              </div>
            </div>
            <div>
              <label htmlFor="cb-summary" className={labelCls}>{tr("fields.summary")}</label>
              <textarea id="cb-summary" value={summary} onChange={(e) => setSummary(e.target.value)} rows={4} className={inputCls} />
            </div>
          </Section>

          <Section n={2} title={tr("sections.publication.title")} desc={tr("sections.publication.desc")}>
            <div>
              <label htmlFor="cb-pub" className={labelCls}>{tr("fields.publisherInfo")}</label>
              <input id="cb-pub" value={pubInfo} onChange={(e) => setPubInfo(e.target.value)} className={inputCls} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="cb-isbn" className={labelCls}>ISBN</label>
                <input id="cb-isbn" value={isbn} onChange={(e) => setIsbn(e.target.value)} placeholder="978-..." className={inputCls} />
              </div>
              <div>
                <label htmlFor="cb-edition" className={labelCls}>{tr("fields.edition")}</label>
                <input id="cb-edition" value={edition} onChange={(e) => setEdition(e.target.value)} placeholder={tr("placeholders.edition")} className={inputCls} />
              </div>
              <div>
                <label htmlFor="cb-pages" className={labelCls}>{tr("fields.pageCount")}</label>
                <input id="cb-pages" type="number" min={0} value={pageCount} onChange={(e) => setPageCount(e.target.value)} className={inputCls} />
              </div>
            </div>
          </Section>

          <Section n={3} title={tr("sections.classification.title")} desc={tr("sections.classification.desc")}>
            <div>
              <MultiSelect
                label={tr("fields.subjects")}
                options={subjects}
                selected={selectedSubjects}
                onChange={setSelectedSubjects}
                onCreate={(v)=>{ if (!subjects.includes(v)) setSubjects(s=>[...s, v]); if (!localSubjects.includes(v)) setLocalSubjects(s=>[...s, v]); }}
                placeholder={tr("placeholders.subject")}
                createOptionLabel={(value) => tr("addOption", { value })}
                noResultsText={tr("noResults")}
                removeLabel={tr("remove")}
              />
              <p className={hintCls}>{tr("hints.subjects")}</p>
            </div>
            <div>
              <MultiSelect
                label={tr("fields.formats")}
                options={formatOptions}
                selected={formats}
                onChange={setFormats}
                placeholder={tr("placeholders.selectFormats")}
                noResultsText={tr("noResults")}
              />
              <p className={hintCls}>{tr("hints.formats")}</p>
            </div>
          </Section>

          <Section n={4} title={tr("sections.access.title")} desc={tr("sections.access.desc")}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="cb-source" className={labelCls}>{tr("fields.source")}</label>
                <select id="cb-source" value={source} onChange={(e) => setSource(e.target.value)} className={inputCls}>
                  {sourceOptions.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="cb-copies" className={labelCls}>{tr("fields.availableCopies")}</label>
                <input id="cb-copies" type="number" min={0} value={availableCopies} onChange={(e) => setAvailableCopies(e.target.value)} className={inputCls} />
                <p className={hintCls}>{tr("hints.copies")}</p>
              </div>
            </div>
            <div>
              <label htmlFor="cb-url" className={labelCls}>{t("bookImport.externalUrl")}</label>
              <input
                id="cb-url"
                type="url"
                value={externalUrl}
                onChange={(e) => { setExternalUrl(e.target.value); if (e.target.value.trim() && !pdfFile) setSource("EXTERNAL"); }}
                placeholder="https://..."
                className={inputCls}
              />
              <p className={hintCls}>{t("bookImport.externalUrlHint")}</p>
            </div>
            <label htmlFor="is-public" className="flex cursor-pointer items-start gap-3 rounded-md border border-[var(--tau-line)] p-3 hover:bg-[var(--tau-wine)]">
              <input id="is-public" type="checkbox" checked={isPublic} onChange={(e)=> setIsPublic(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--tau-red)]" />
              <span>
                <span className="block text-sm font-medium text-[var(--tau-ink)]">{tr("fields.publiclyVisible")}</span>
                <span className="block text-xs text-[var(--tau-muted)]">{tr("hints.publiclyVisible")}</span>
              </span>
            </label>
            <div>
              <MultiSelect
                label={tr("fields.usersOptional")}
                options={users}
                selected={selectedUsers}
                onChange={setSelectedUsers}
                onCreate={(v)=>{ if (!users.includes(v)) setUsers(prev=>[...prev, v]); }}
                placeholder={tr("placeholders.user")}
                createOptionLabel={(value) => tr("addOption", { value })}
                noResultsText={tr("noResults")}
                removeLabel={tr("remove")}
              />
              <p className={hintCls}>{tr("hints.users")}</p>
            </div>
          </Section>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-4 lg:self-start">
          <section className="space-y-5 rounded-md border border-[var(--tau-line)] bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-[var(--tau-ink)]">{tr("files.title")}</h2>
            <FileDrop
              label={tr("files.cover")}
              hint={tr("upload.coverHint")}
              file={coverFile}
              onFile={setCoverFile}
              accepts={(f) => f.type.startsWith("image/")}
              acceptAttr="image/*"
              previewUrl={coverPreview}
              labels={uploadLabels}
            />
            <FileDrop
              label={tr("files.pdf")}
              hint={tr("upload.fileHint")}
              file={pdfFile}
              onFile={setPdfFile}
              accepts={(f) => BOOK_EXTS.some(ext => f.name.toLowerCase().endsWith(ext))}
              acceptAttr={BOOK_EXTS.join(",")}
              labels={uploadLabels}
            />
          </section>

          <section className="rounded-md border border-[var(--tau-line)] bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-base font-semibold text-[var(--tau-ink)]">{tr("status.title")}</h2>
            <ul className="space-y-2">
              <CheckItem ok={!!title.trim()}>{tr("status.titleOk")} <span className="text-xs text-[var(--tau-red)]">({tr("required")})</span></CheckItem>
              <CheckItem ok={selectedAuthors.length > 0}>{tr("status.authors")}</CheckItem>
              <CheckItem ok={!!coverFile}>{tr("status.cover")}</CheckItem>
              <CheckItem ok={!!pdfFile || !!externalUrl.trim()}>{tr("status.content")}</CheckItem>
            </ul>
            <p className="mt-3 text-xs text-[var(--tau-muted)]">{tr("status.note")}</p>

            {submitError && (
              <div role="alert" className="mt-4 break-words rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                {submitError}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-[var(--tau-red)] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:brightness-110 disabled:cursor-wait disabled:opacity-70"
            >
              {busy && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />}
              {phase === "uploading" ? tr("uploadingFile") : phase === "saving" ? tr("saving") : tr("actions.save")}
            </button>
          </section>
        </aside>
      </form>
    </div>
  );
}
