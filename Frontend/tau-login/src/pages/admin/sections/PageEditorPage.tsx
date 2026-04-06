import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import RichTextEditor from "@/components/admin/RichTextEditor";
import { t } from "@/shared/i18n";

import {
  deletePage,
  emptyPageForm,
  ensureUniqueSlug,
  flattenMenuItems,
  loadContentSummary,
  resolveMenuTitle,
  savePage,
  syncMenuBinding,
  toPageForm,
  type ContentPage,
  type MenuItem,
  type PageFormState,
} from "./contentPages";

export default function PageEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isCreateMode = !id || id === "new";

  const [pages, setPages] = useState<ContentPage[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [form, setForm] = useState<PageFormState>(emptyPageForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await loadContentSummary();
      setPages(result.pages);
      setMenuItems(result.menu_items);

      if (isCreateMode) {
        setForm(emptyPageForm());
        return;
      }

      const page = result.pages.find((item) => String(item.id) === String(id));
      if (!page) {
        setError(t("admin.pages.errors.notFound"));
        return;
      }

      setForm(toPageForm(page, result.menu_items));
    } catch (e: any) {
      setError(e?.message || "Failed to load page");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [id]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const savedPage = await savePage(form);
      await syncMenuBinding(savedPage.id, form.menu_item_id, menuItems);
      navigate(`/content/pages/${savedPage.id}`, { replace: true });
      setForm((prev) => ({ ...prev, id: savedPage.id }));
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to save page");
    } finally {
      setSaving(false);
    }
  };

  const removeCurrentPage = async () => {
    if (!form.id) return;
    if (!window.confirm(t("admin.pages.confirmDelete"))) return;
    try {
      await deletePage(form.id);
      navigate("/content/pages", { replace: true });
    } catch (e: any) {
      setError(e?.message || "Failed to delete page");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm text-slate-500">
            <Link to="/content/pages" className="hover:text-slate-700">
              {t("admin.pages.listTitle")}
            </Link>
            {" / "}
            <span>{form.id ? t("admin.pages.editPage") : t("admin.pages.newPage")}</span>
          </div>
          <h2 className="mt-2 text-lg font-semibold">
            {form.id ? t("admin.pages.editPage") : t("admin.pages.newPage")}
          </h2>
          <p className="mt-1 text-sm text-slate-600">{t("admin.pages.editorHint")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/content/pages"
            className="rounded-md border px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            {t("admin.common.cancel")}
          </Link>
          {form.slug && (
            <a
              href={`/public/page/${form.slug}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              {t("admin.pages.preview")}
            </a>
          )}
          {form.id && (
            <button
              type="button"
              onClick={() => void removeCurrentPage()}
              className="rounded-md border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
            >
              {t("admin.common.delete")}
            </button>
          )}
          <button
            type="submit"
            form="content-page-form"
            disabled={saving || loading}
            className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? t("admin.pages.saving") : t("admin.pages.save")}
          </button>
        </div>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="rounded-md border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
          {t("admin.common.loading")}
        </div>
      ) : (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <form id="content-page-form" onSubmit={submit} className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-2">
              <label className="text-sm">
                <div className="mb-1 text-slate-600">{t("admin.pages.fields.title")}</div>
                <input
                  value={form.title}
                  onChange={(e) => {
                    const title = e.target.value;
                    setForm((prev) => ({ ...prev, title, slug: ensureUniqueSlug(title, pages, prev.id) }));
                  }}
                  className="w-full rounded-md border px-3 py-2"
                  required
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 text-slate-600">{t("admin.pages.fields.slug")}</div>
                <input
                  value={form.slug}
                  readOnly
                  className="w-full rounded-md border bg-slate-50 px-3 py-2 text-slate-600"
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 text-slate-600">{t("admin.pages.fields.titleRu")}</div>
                <input
                  value={form.title_ru}
                  onChange={(e) => setForm((prev) => ({ ...prev, title_ru: e.target.value }))}
                  className="w-full rounded-md border px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 text-slate-600">{t("admin.pages.fields.titleKk")}</div>
                <input
                  value={form.title_kk}
                  onChange={(e) => setForm((prev) => ({ ...prev, title_kk: e.target.value }))}
                  className="w-full rounded-md border px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 text-slate-600">{t("admin.pages.fields.titleEn")}</div>
                <input
                  value={form.title_en}
                  onChange={(e) => setForm((prev) => ({ ...prev, title_en: e.target.value }))}
                  className="w-full rounded-md border px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 text-slate-600">{t("admin.pages.fields.status")}</div>
                <select
                  value={form.status}
                  onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as "draft" | "published" }))}
                  className="w-full rounded-md border px-3 py-2"
                >
                  <option value="draft">{t("admin.pages.draft")}</option>
                  <option value="published">{t("admin.pages.published")}</option>
                </select>
              </label>
              <label className="text-sm lg:col-span-2">
                <div className="mb-1 text-slate-600">{t("admin.pages.fields.menuItem")}</div>
                <select
                  value={form.menu_item_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, menu_item_id: e.target.value }))}
                  className="w-full rounded-md border px-3 py-2"
                >
                  <option value="">{t("admin.pages.options.noMenuItem")}</option>
                  {flattenMenuItems(menuItems).map((item) => (
                    <option key={item.id} value={item.id}>
                      {"- ".repeat(item.level)}
                      {resolveMenuTitle(item)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <label className="block text-sm">
                <div className="mb-1 text-slate-600">{t("admin.pages.fields.summary")}</div>
                <textarea
                  value={form.summary}
                  onChange={(e) => setForm((prev) => ({ ...prev, summary: e.target.value }))}
                  className="min-h-24 w-full rounded-md border px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <div className="mb-1 text-slate-600">{t("admin.pages.fields.summaryRu")}</div>
                <textarea
                  value={form.summary_ru}
                  onChange={(e) => setForm((prev) => ({ ...prev, summary_ru: e.target.value }))}
                  className="min-h-24 w-full rounded-md border px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <div className="mb-1 text-slate-600">{t("admin.pages.fields.summaryKk")}</div>
                <textarea
                  value={form.summary_kk}
                  onChange={(e) => setForm((prev) => ({ ...prev, summary_kk: e.target.value }))}
                  className="min-h-24 w-full rounded-md border px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <div className="mb-1 text-slate-600">{t("admin.pages.fields.summaryEn")}</div>
                <textarea
                  value={form.summary_en}
                  onChange={(e) => setForm((prev) => ({ ...prev, summary_en: e.target.value }))}
                  className="min-h-24 w-full rounded-md border px-3 py-2"
                />
              </label>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-slate-900">{t("admin.pages.fields.content")}</div>
                <div className="text-xs text-slate-500">{t("admin.pages.safeHtmlHint")}</div>
              </div>
              <div className="grid gap-6">
                <div className="space-y-2">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{t("admin.pages.fields.contentDefault")}</div>
                  <RichTextEditor
                    value={form.content_html}
                    onChange={(content_html) => setForm((prev) => ({ ...prev, content_html }))}
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{t("admin.pages.fields.contentRu")}</div>
                  <RichTextEditor
                    value={form.content_html_ru}
                    onChange={(content_html_ru) => setForm((prev) => ({ ...prev, content_html_ru }))}
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{t("admin.pages.fields.contentKk")}</div>
                  <RichTextEditor
                    value={form.content_html_kk}
                    onChange={(content_html_kk) => setForm((prev) => ({ ...prev, content_html_kk }))}
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{t("admin.pages.fields.contentEn")}</div>
                  <RichTextEditor
                    value={form.content_html_en}
                    onChange={(content_html_en) => setForm((prev) => ({ ...prev, content_html_en }))}
                  />
                </div>
              </div>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
