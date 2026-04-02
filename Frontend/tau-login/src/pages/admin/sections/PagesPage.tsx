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
  slug: string;
  menu_title?: string | null;
  summary?: string | null;
  content_html?: string | null;
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
  slug: string;
  menu_title: string;
  summary: string;
  content_html: string;
  status: "draft" | "published";
};

const emptyForm = (): PageFormState => ({
  title: "",
  slug: "",
  menu_title: "",
  summary: "",
  content_html: "<h2>Новая страница</h2><p>Добавьте текст, изображения, ссылки, таблицы и другие блоки оформления.</p>",
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
          slug: selectedPage.slug,
          menu_title: selectedPage.menu_title || "",
          summary: selectedPage.summary || "",
          content_html: selectedPage.content_html || blocksToHtml(selectedPage.blocks) || "",
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
      slug: page.slug,
      menu_title: page.menu_title || "",
      summary: page.summary || "",
      content_html: page.content_html || blocksToHtml(page.blocks) || "",
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
        slug: form.slug,
        menu_title: form.menu_title || null,
        summary: form.summary || null,
        content_html: form.content_html || null,
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

            <label className="block text-sm">
              <div className="mb-1 text-slate-600">{t("admin.pages.fields.summary")}</div>
              <textarea
                value={form.summary}
                onChange={(e) => setForm((prev) => ({ ...prev, summary: e.target.value }))}
                className="min-h-24 w-full rounded-md border px-3 py-2"
              />
            </label>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-slate-900">{t("admin.pages.fields.content")}</div>
                <div className="text-xs text-slate-500">{t("admin.pages.safeHtmlHint")}</div>
              </div>
              <RichTextEditor
                value={form.content_html}
                onChange={(content_html) => setForm((prev) => ({ ...prev, content_html }))}
              />
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
