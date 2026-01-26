import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "@/shared/api/client";
import { namesFrom } from "@/shared/ui/text";
import { t } from "@/shared/i18n";

type Book = {
  id: number | string;
  title?: string | null;
  year?: string | number | null;
  lang?: string | null;
  pub_info?: string | null;
  summary?: string | null;
  cover?: string | null;
  file_id?: string | null;
  download_url?: string | null;
  authors?: Array<string | { name?: string | null }> | null;
  subjects?: Array<string | { name?: string | null }> | null;
  source?: string | null;
  formats?: string[] | string | null;
  isbn?: string | null;
  edition?: string | null;
  page_count?: number | null;
  available_copies?: number | null;
  is_public?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function isDisplayableImageSrc(src: string): boolean {
  return (
    /^data:image\//i.test(src) ||
    /^https?:\/\//i.test(src) ||
    src.startsWith("/")
  );
}

function normalizeList(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean);
  if (typeof v === "string") return v.split(",").map((s) => s.trim()).filter(Boolean);
  return [String(v)];
}

function fmtBool(v: boolean | null | undefined): string {
  if (v === true) return "Yes";
  if (v === false) return "No";
  return "-";
}

function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

function Row({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div className="grid grid-cols-12 gap-3 py-2 border-b last:border-b-0">
      <div className="col-span-12 md:col-span-4 text-slate-500 text-sm">{label}</div>
      <div className="col-span-12 md:col-span-8 text-slate-900 text-sm break-words">{value ?? "-"}</div>
    </div>
  );
}

export default function AdminBookDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await api<Book>(`/api/catalog/books/${id}`);
        if (!cancelled) setBook(data);
      } catch (e: unknown) {
        if (!cancelled) setError(errorMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const authors = useMemo(() => namesFrom(book?.authors), [book?.authors]);
  const subjects = useMemo(() => namesFrom(book?.subjects), [book?.subjects]);
  const formats = useMemo(() => normalizeList(book?.formats), [book?.formats]);
  const coverSrc = book?.cover && isDisplayableImageSrc(book.cover) ? book.cover : null;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">{book?.title || t("admin.books.heading")}</div>
          <div className="text-sm text-slate-500">ID: {id}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-3 py-2 border rounded hover:bg-slate-50 text-sm"
          >
            Back
          </button>
          <Link
            to={`/admin/books/${id}/edit`}
            className="px-3 py-2 border rounded hover:bg-slate-50 text-sm"
          >
            {t("admin.common.edit")}
          </Link>
          <Link
            to={`/catalog/${id}`}
            className="px-3 py-2 bg-[#7b0f2b] hover:bg-rose-800 text-white rounded text-sm"
          >
            Open in catalog
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="text-slate-500">{t("admin.common.loading")}</div>
      ) : error ? (
        <div className="text-red-600">
          {t("admin.common.failed")}: {error}
        </div>
      ) : !book ? (
        <div className="text-slate-500">Not found</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-4">
            <div className="border rounded-md p-4 bg-white">
              <div className="text-sm font-semibold text-slate-700 mb-3">Cover</div>
              {coverSrc ? (
                <img
                  src={coverSrc}
                  alt={book.title || "Cover"}
                  className="w-full max-w-[260px] h-auto rounded border bg-slate-50"
                />
              ) : (
                <div className="text-sm text-slate-500">No cover</div>
              )}
            </div>
          </div>

          <div className="lg:col-span-8">
            <div className="border rounded-md p-4 bg-white">
              <div className="text-sm font-semibold text-slate-700 mb-2">Details</div>
              <Row label="Title" value={book.title || "-"} />
              <Row label="Authors" value={authors.length ? authors.join(", ") : "-"} />
              <Row label="Subjects" value={subjects.length ? subjects.join(", ") : "-"} />
              <Row label="Year" value={book.year != null && book.year !== "" ? String(book.year) : "-"} />
              <Row label="Language" value={book.lang || "-"} />
              <Row label="ISBN" value={book.isbn || "-"} />
              <Row label="Edition" value={book.edition || "-"} />
              <Row label="Page count" value={book.page_count ?? "-"} />
              <Row label="Available copies" value={book.available_copies ?? "-"} />
              <Row label="Formats" value={formats.length ? formats.join(", ") : "-"} />
              <Row label="Source" value={book.source || "-"} />
              <Row label="Public" value={fmtBool(book.is_public)} />
              <Row label="Publisher info" value={book.pub_info || "-"} />
              <Row
                label="Summary"
                value={
                  book.summary ? (
                    <div className="whitespace-pre-wrap leading-relaxed">{book.summary}</div>
                  ) : (
                    "-"
                  )
                }
              />
              <Row label="File ID" value={book.file_id || "-"} />
              <Row
                label="Download URL"
                value={
                  book.download_url ? (
                    <a
                      href={book.download_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#7b0f2b] hover:underline"
                    >
                      {book.download_url}
                    </a>
                  ) : (
                    "-"
                  )
                }
              />
              {book.created_at ? <Row label="Created" value={book.created_at} /> : null}
              {book.updated_at ? <Row label="Updated" value={book.updated_at} /> : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
