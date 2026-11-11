import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { t } from "@/shared/i18n";

type RowStatus = "created" | "skipped" | "error";

type ImportRow = {
  row: number;
  num: string;
  title: string;
  status: RowStatus;
  message: string;
  book_id: number | null;
  kind: "file" | "external" | null;
};

type ImportReport = {
  dry_run: boolean;
  total_rows: number;
  created: number;
  skipped: number;
  errors: number;
  with_file: number;
  external: number;
  unused_files: string[];
  rows: ImportRow[];
};

const COLUMNS = ["№", "Название", "Автор", "Жанры через запятую", "Язык", "Ссылка"];
const tr = (key: string, vars?: Record<string, string | number>) => t(`bookImport.${key}`, vars);

function getApiBase(): string {
  const raw = import.meta.env.VITE_API_URL as string | undefined;
  if (raw && /^https?:\/\//i.test(raw)) return raw.replace(/\/$/, "");
  return "";
}

function getToken(): string | null {
  return localStorage.getItem("token") || sessionStorage.getItem("token");
}

function errorText(status: number, body: string): string {
  try {
    const j = JSON.parse(body);
    if (typeof j?.detail === "string") return j.detail;
    if (Array.isArray(j?.detail)) return j.detail.map((d: { msg?: string }) => d?.msg).filter(Boolean).join("; ");
  } catch {
    // ответ не JSON — покажем как есть
  }
  return body || `HTTP ${status}`;
}

/** XHR вместо fetch — чтобы показывать прогресс загрузки большого архива. */
function postImport(form: FormData, onProgress: (pct: number | null) => void): Promise<ImportReport> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${getApiBase()}/api/catalog/admin/import/books`);
    const token = getToken();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (e) => onProgress(e.lengthComputable ? Math.round((e.loaded / e.total) * 100) : null);
    xhr.upload.onload = () => onProgress(100);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); } catch { reject(new Error("Invalid server response")); }
      } else {
        reject(new Error(errorText(xhr.status, xhr.responseText)));
      }
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(form);
  });
}

async function downloadTemplate() {
  const token = getToken();
  const res = await fetch(`${getApiBase()}/api/catalog/admin/import/books/template`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(errorText(res.status, await res.text().catch(() => "")));
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = "books_import_template.xlsx";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const STATUS_STYLE: Record<RowStatus, string> = {
  created: "bg-emerald-50 text-emerald-700 border-emerald-200",
  skipped: "bg-amber-50 text-amber-700 border-amber-200",
  error: "bg-rose-50 text-rose-700 border-rose-200",
};

export default function ImportBooksPage() {
  const [excel, setExcel] = useState<File | null>(null);
  const [archive, setArchive] = useState<File | null>(null);
  const [isPublic, setIsPublic] = useState(true);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [busy, setBusy] = useState<false | "check" | "run">(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [filter, setFilter] = useState<"all" | RowStatus>("all");

  const rows = useMemo(
    () => (report?.rows || []).filter((r) => filter === "all" || r.status === filter),
    [report, filter],
  );

  async function submit(dryRun: boolean) {
    if (!excel) { setError(tr("needExcel")); return; }
    setBusy(dryRun ? "check" : "run");
    setError(null);
    setProgress(0);
    try {
      const form = new FormData();
      form.append("excel", excel);
      if (archive) form.append("archive", archive);
      form.append("dry_run", String(dryRun));
      form.append("is_public", String(isPublic));
      form.append("skip_duplicates", String(skipDuplicates));
      const data = await postImport(form, setProgress);
      setReport(data);
      setFilter(data.errors ? "error" : "all");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  const fileInput = "mt-1 block w-full text-sm file:mr-3 file:px-3 file:py-2 file:rounded-md file:border-0 file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{tr("heading")}</h2>
        <button
          type="button"
          onClick={() => downloadTemplate().catch((e) => setError(e?.message || String(e)))}
          className="px-3 py-2 rounded-md border border-slate-300 text-sm hover:bg-slate-50"
        >
          {tr("template")}
        </button>
      </div>

      <div className="rounded-xl border bg-white p-4 text-sm text-slate-600 space-y-3">
        <p>{tr("intro")}</p>
        <div>
          <div className="font-medium text-slate-800 mb-1">{tr("columns")}</div>
          <div className="overflow-x-auto">
            <table className="text-xs border-collapse">
              <tbody>
                <tr>
                  {COLUMNS.map((c) => (
                    <td key={c} className="border border-slate-200 bg-slate-50 px-2 py-1 font-medium whitespace-nowrap">{c}</td>
                  ))}
                </tr>
                <tr className="text-slate-500">
                  {["15", "Алгебра 7", "Иванов И. И.; Петров П.", "Математика, Учебник", "Russian", "https://…"].map((c, i) => (
                    <td key={i} className="border border-slate-200 px-2 py-1 whitespace-nowrap">{c}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs">{tr("columnsHint")}</p>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4 grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-medium">
          {tr("excel")}
          <input
            type="file"
            accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => { setExcel(e.target.files?.[0] || null); setReport(null); }}
            className={fileInput}
          />
        </label>
        <label className="block text-sm font-medium">
          {tr("archive")}
          <input
            type="file"
            accept=".zip,application/zip"
            onChange={(e) => { setArchive(e.target.files?.[0] || null); setReport(null); }}
            className={fileInput}
          />
          <span className="block mt-1 text-xs font-normal text-slate-500">{tr("archiveHint")}</span>
        </label>
        <div className="md:col-span-2 flex flex-col gap-2 text-sm">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
            {tr("isPublic")}
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={skipDuplicates} onChange={(e) => setSkipDuplicates(e.target.checked)} />
            {tr("skipDuplicates")}
          </label>
        </div>
        <div className="md:col-span-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!!busy || !excel}
            onClick={() => submit(true)}
            className="px-4 py-2 rounded-md border border-[#b51e3e] text-[#b51e3e] text-sm disabled:opacity-50"
          >
            {tr("check")}
          </button>
          <button
            type="button"
            disabled={!!busy || !excel}
            onClick={() => submit(false)}
            className="px-4 py-2 rounded-md bg-[#b51e3e] text-white text-sm disabled:opacity-50"
          >
            {tr("run")}
          </button>
          {busy && (
            <span className="text-sm text-slate-500">
              {progress !== null && progress < 100 ? `${tr("uploading")}: ${progress}%` : tr("processing")}
            </span>
          )}
        </div>
        {error && <div className="md:col-span-2 text-sm text-rose-600">{error}</div>}
      </div>

      {report && (
        <div className="rounded-xl border bg-white p-4 space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-semibold">{report.dry_run ? tr("check") : tr("done")}</h3>
            {report.dry_run && <span className="text-sm text-amber-700">{tr("dryRunNote")}</span>}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label={tr("total")} value={report.total_rows} />
            <Stat
              label={report.dry_run ? tr("willCreate") : tr("created")}
              value={report.created}
              hint={`${report.with_file} ${tr("withFile")} · ${report.external} ${tr("external")}`}
              tone="text-emerald-700"
            />
            <Stat label={tr("skipped")} value={report.skipped} tone="text-amber-700" />
            <Stat label={tr("errors")} value={report.errors} tone="text-rose-700" />
          </div>

          {report.unused_files.length > 0 && (
            <div className="text-sm rounded-md bg-slate-50 border p-3">
              <div className="font-medium mb-1">{tr("unused")} ({report.unused_files.length})</div>
              <div className="text-slate-600 break-words">{report.unused_files.join(", ")}</div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 text-sm">
            {(["all", "created", "skipped", "error"] as const).map((f) => {
              const count = f === "all" ? report.rows.length : report.rows.filter((r) => r.status === f).length;
              const label = f === "all" ? tr("filterAll") : f === "created" ? tr("statusCreated") : f === "skipped" ? tr("statusSkipped") : tr("statusError");
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-full border ${filter === f ? "bg-slate-800 text-white border-slate-800" : "border-slate-300 text-slate-700"}`}
                >
                  {label} · {count}
                </button>
              );
            })}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="py-2 pr-3">{tr("row")}</th>
                  <th className="pr-3">{tr("num")}</th>
                  <th className="pr-3">{tr("title")}</th>
                  <th className="pr-3">{tr("status")}</th>
                  <th>{tr("message")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.row} className="border-t align-top">
                    <td className="py-2 pr-3 text-slate-500">{r.row}</td>
                    <td className="pr-3 text-slate-500">{r.num || "–"}</td>
                    <td className="pr-3">{r.title || "–"}</td>
                    <td className="pr-3">
                      <span className={`inline-block whitespace-nowrap px-2 py-0.5 rounded-full border text-xs ${STATUS_STYLE[r.status]}`}>
                        {r.status === "created" ? tr("statusCreated") : r.status === "skipped" ? tr("statusSkipped") : tr("statusError")}
                      </span>
                    </td>
                    <td className="text-slate-600">
                      {r.message}
                      {r.book_id ? (
                        <> · <Link to={`/admin/books/${r.book_id}`} className="text-[#b51e3e] hover:underline">{tr("open")}</Link></>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, hint, tone = "text-slate-800" }: { label: string; value: number; hint?: string; tone?: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-2xl font-semibold ${tone}`}>{value}</div>
      {hint && <div className="text-xs text-slate-500 mt-0.5">{hint}</div>}
    </div>
  );
}
