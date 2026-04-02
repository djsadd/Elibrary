import { useEffect, useMemo, useState } from "react";

import RichTextEditor from "@/components/admin/RichTextEditor";
import { api } from "@/shared/api/client";
import { t } from "@/shared/i18n";

type PageBlock = {
  id: number;
  type: "text" | "image" | "hero" | "cta";
  title?: string | null;
  body?: string | null;
  image_url?: string | null;
  link_label?: string | null;
  link_url?: string | null;
};

type ContentPage = {
  id: number;
  title: string;
  title_ru?: string | null;
  title_kk?: string | null;
  title_en?: string | null;
  slug: string;
  menu_title?: string | null;
  menu_title_ru?: string | null;
  menu_title_kk?: string | null;
  menu_title_en?: string | null;
  summary?: string | null;
  summary_ru?: string | null;
  summary_kk?: string | null;
  summary_en?: string | null;
  content_html?: string | null;
  content_html_ru?: string | null;
  content_html_kk?: string | null;
  content_html_en?: string | null;
  status: "draft" | "published";
  blocks: PageBlock[];
  updated_at: string;
};

type ContentSummary = {
  pages: ContentPage[];
};

type PageFormState = {
  id?: number;
  title: string;
  title_ru: string;
  title_kk: string;
  title_en: string;
  slug: string;
  menu_title: string;
  menu_title_ru: string;
  menu_title_kk: string;
  menu_title_en: string;
  summary: string;
  summary_ru: string;
  summary_kk: string;
  summary_en: string;
  content_html: string;
  content_html_ru: string;
  content_html_kk: string;
  content_html_en: string;
  status: "draft" | "published";
};

const emptyForm = (): PageFormState => ({
  title: "",
  title_ru: "",
  title_kk: "",
  title_en: "",
  slug: "",
  menu_title: "",
  menu_title_ru: "",
  menu_title_kk: "",
  menu_title_en: "",
  summary: "",
  summary_ru: "",
  summary_kk: "",
  summary_en: "",
  content_html: "<h2>Новая страница</h2><p>Добавьте текст, изображения, ссылки, таблицы и другие блоки оформления.</p>",
  content_html_ru: "<h2>Новая страница</h2><p>Добавьте текст, изображения, ссылки, таблицы и другие блоки оформления.</p>",
  content_html_kk: "<h2>Жаңа бет</h2><p>Мәтін, суреттер, сілтемелер, кестелер және басқа безендіру элементтерін қосыңыз.</p>",
  content_html_en: "<h2>New page</h2><p>Add text, images, links, tables and other layout elements.</p>",
  status: "draft",
});

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-_]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function blocksToHtml(blocks: PageBlock[]): string {
  if (!blocks.length) return "";
  return blocks
    .map((block) => {
      const title = block.title ? `<h2>${block.title}</h2>` : "";
      const body = block.body ? `<p>${block.body.replace(/\n/g, "<br>")}</p>` : "";
      const image = block.image_url ? `<p><img src="${block.image_url}" alt="${block.title || ""}"></p>` : "";
      const link =
        block.link_url
          ? `<p><a href="${block.link_url}" target="_blank" rel="noreferrer">${block.link_label || block.link_url}</a></p>`
          : "";
      return `${title}${body}${image}${link}`;
    })
    .join("");
}

export default function PagesPage() {
  const [pages, setPages] = useState<ContentPage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<number | null>(null);
  const [form, setForm] = useState<PageFormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api<ContentSummary>("/api/catalog/admin/content");
      setPages(result.pages);
      const selectedPage = result.pages.find((page) => page.id === selectedPageId) || result.pages[0] || null;
      if (selectedPage) {
        setSelectedPageId(selectedPage.id);
        setForm({
          id: selectedPage.id,
          title: selectedPage.title,
          title_ru: selectedPage.title_ru || selectedPage.title || "",
          title_kk: selectedPage.title_kk || selectedPage.title || "",
          title_en: selectedPage.title_en || selectedPage.title || "",
          slug: selectedPage.slug,
          menu_title: selectedPage.menu_title || "",
          menu_title_ru: selectedPage.menu_title_ru || selectedPage.menu_title || selectedPage.title_ru || selectedPage.title || "",
          menu_title_kk: selectedPage.menu_title_kk || selectedPage.menu_title || selectedPage.title_kk || selectedPage.title || "",
          menu_title_en: selectedPage.menu_title_en || selectedPage.menu_title || selectedPage.title_en || selectedPage.title || "",
          summary: selectedPage.summary || "",
          summary_ru: selectedPage.summary_ru || selectedPage.summary || "",
          summary_kk: selectedPage.summary_kk || selectedPage.summary || "",
          summary_en: selectedPage.summary_en || selectedPage.summary || "",
          content_html: selectedPage.content_html || blocksToHtml(selectedPage.blocks) || "",
          content_html_ru: selectedPage.content_html_ru || selectedPage.content_html || blocksToHtml(selectedPage.blocks) || "",
          content_html_kk: selectedPage.content_html_kk || selectedPage.content_html || blocksToHtml(selectedPage.blocks) || "",
          content_html_en: selectedPage.content_html_en || selectedPage.content_html || blocksToHtml(selectedPage.blocks) || "",
          status: selectedPage.status,
        });
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load pages");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const sortedPages = useMemo(
    () => [...pages].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    [pages],
  );

  const selectPage = (page: ContentPage) => {
    setSelectedPageId(page.id);
    setForm({
      id: page.id,
      title: page.title,
      title_ru: page.title_ru || page.title || "",
      title_kk: page.title_kk || page.title || "",
      title_en: page.title_en || page.title || "",
      slug: page.slug,
      menu_title: page.menu_title || "",
      menu_title_ru: page.menu_title_ru || page.menu_title || page.title_ru || page.title || "",
      menu_title_kk: page.menu_title_kk || page.menu_title || page.title_kk || page.title || "",
      menu_title_en: page.menu_title_en || page.menu_title || page.title_en || page.title || "",
      summary: page.summary || "",
      summary_ru: page.summary_ru || page.summary || "",
      summary_kk: page.summary_kk || page.summary || "",
      summary_en: page.summary_en || page.summary || "",
      content_html: page.content_html || blocksToHtml(page.blocks) || "",
      content_html_ru: page.content_html_ru || page.content_html || blocksToHtml(page.blocks) || "",
      content_html_kk: page.content_html_kk || page.content_html || blocksToHtml(page.blocks) || "",
      content_html_en: page.content_html_en || page.content_html || blocksToHtml(page.blocks) || "",
      status: page.status,
    });
  };

  const createNew = () => {
    setSelectedPageId(null);
    setForm(emptyForm());
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: form.title,
        title_ru: form.title_ru || null,
        title_kk: form.title_kk || null,
        title_en: form.title_en || null,
        slug: form.slug,
        menu_title: form.menu_title || null,
        menu_title_ru: form.menu_title_ru || null,
        menu_title_kk: form.menu_title_kk || null,
        menu_title_en: form.menu_title_en || null,
        summary: form.summary || null,
        summary_ru: form.summary_ru || null,
        summary_kk: form.summary_kk || null,
        summary_en: form.summary_en || null,
        content_html: form.content_html || null,
        content_html_ru: form.content_html_ru || null,
        content_html_kk: form.content_html_kk || null,
        content_html_en: form.content_html_en || null,
        status: form.status,
      };
      if (form.id) {
        await api(`/api/catalog/admin/content/pages/${form.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await api("/api/catalog/admin/content/pages", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to save page");
    } finally {
      setSaving(false);
    }
  };

  const removePage = async () => {
    if (!form.id) return;
    if (!window.confirm(t("admin.pages.confirmDelete"))) return;
    try {
      await api(`/api/catalog/admin/content/pages/${form.id}`, { method: "DELETE" });
      setSelectedPageId(null);
      setForm(emptyForm());
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to delete page");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{t("admin.pages.heading")}</h2>
          <p className="mt-1 text-sm text-slate-600">{t("admin.pages.description")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-md border px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            {t("admin.pages.refresh")}
          </button>
          <button
            type="button"
            onClick={createNew}
            className="rounded-md bg-slate-800 px-3 py-2 text-sm font-medium text-white"
          >
            {t("admin.pages.create")}
          </button>
        </div>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <section className="rounded-md border p-4">
          <div className="mb-4 font-medium text-slate-900">{t("admin.pages.listTitle")}</div>
          {loading ? (
            <div className="text-sm text-slate-500">{t("admin.common.loading")}</div>
          ) : sortedPages.length === 0 ? (
            <div className="text-sm text-slate-500">{t("admin.pages.empty")}</div>
          ) : (
            <div className="space-y-2">
              {sortedPages.map((page) => (
                <button
                  key={page.id}
                  type="button"
                  onClick={() => selectPage(page)}
                  className={[
                    "w-full rounded-xl border px-4 py-3 text-left transition",
                    selectedPageId === page.id ? "border-slate-900 bg-slate-50" : "hover:bg-slate-50",
                  ].join(" ")}
                >
                  <div className="font-medium text-slate-900">{page.title}</div>
                  <div className="mt-1 text-xs text-slate-500">/{page.slug}</div>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                    <span>{page.status === "published" ? t("admin.pages.published") : t("admin.pages.draft")}</span>
                    <span>{new Date(page.updated_at).toLocaleString()}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-md border p-4">
          <form onSubmit={submit} className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-medium text-slate-900">
                  {form.id ? t("admin.pages.editPage") : t("admin.pages.newPage")}
                </div>
                <div className="text-xs text-slate-500">{t("admin.pages.editorHint")}</div>
              </div>
              <div className="flex flex-wrap gap-2">
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
                    onClick={() => void removePage()}
                    className="rounded-md border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                  >
                    {t("admin.common.delete")}
                  </button>
                )}
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  {saving ? t("admin.pages.saving") : t("admin.pages.save")}
                </button>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <label className="text-sm">
                <div className="mb-1 text-slate-600">{t("admin.pages.fields.title")}</div>
                <input
                  value={form.title}
                  onChange={(e) => {
                    const title = e.target.value;
                    setForm((prev) => ({ ...prev, title, slug: prev.id ? prev.slug : toSlug(title) }));
                  }}
                  className="w-full rounded-md border px-3 py-2"
                  required
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
                <div className="mb-1 text-slate-600">{t("admin.pages.fields.slug")}</div>
                <input
                  value={form.slug}
                  onChange={(e) => setForm((prev) => ({ ...prev, slug: toSlug(e.target.value) }))}
                  className="w-full rounded-md border px-3 py-2"
                  required
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 text-slate-600">{t("admin.pages.fields.menuTitle")}</div>
                <input
                  value={form.menu_title}
                  onChange={(e) => setForm((prev) => ({ ...prev, menu_title: e.target.value }))}
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
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <label className="text-sm">
                <div className="mb-1 text-slate-600">{t("admin.pages.fields.menuTitle")}</div>
                <input
                  value={form.menu_title}
                  onChange={(e) => setForm((prev) => ({ ...prev, menu_title: e.target.value }))}
                  className="w-full rounded-md border px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 text-slate-600">{t("admin.pages.fields.menuTitleRu")}</div>
                <input
                  value={form.menu_title_ru}
                  onChange={(e) => setForm((prev) => ({ ...prev, menu_title_ru: e.target.value }))}
                  className="w-full rounded-md border px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 text-slate-600">{t("admin.pages.fields.menuTitleKk")}</div>
                <input
                  value={form.menu_title_kk}
                  onChange={(e) => setForm((prev) => ({ ...prev, menu_title_kk: e.target.value }))}
                  className="w-full rounded-md border px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 text-slate-600">{t("admin.pages.fields.menuTitleEn")}</div>
                <input
                  value={form.menu_title_en}
                  onChange={(e) => setForm((prev) => ({ ...prev, menu_title_en: e.target.value }))}
                  className="w-full rounded-md border px-3 py-2"
                />
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
      </div>
    </div>
  );
}
