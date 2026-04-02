import { useEffect, useMemo, useState } from "react";

import { api } from "@/shared/api/client";
import { getLang, t } from "@/shared/i18n";

type Page = {
  id: number;
  title: string;
};

type MenuItem = {
  id: number;
  title: string;
  title_ru?: string | null;
  title_kk?: string | null;
  title_en?: string | null;
  slug: string;
  description?: string | null;
  image_url?: string | null;
  parent_id?: number | null;
  page_id?: number | null;
  external_url?: string | null;
  sort_order: number;
  is_visible: boolean;
  children: MenuItem[];
  path?: string | null;
};

type ContentSummary = {
  pages: Page[];
  menu_items: MenuItem[];
};

type MenuKind = "link" | "dropdown";

type MenuFormState = {
  id?: number;
  title: string;
  title_ru: string;
  title_kk: string;
  title_en: string;
  slug: string;
  description: string;
  image_url: string;
  parent_id: string;
  page_id: string;
  external_url: string;
  sort_order: string;
  is_visible: boolean;
  kind: MenuKind;
};

const emptyMenuForm = (): MenuFormState => ({
  title: "",
  title_ru: "",
  title_kk: "",
  title_en: "",
  slug: "",
  description: "",
  image_url: "",
  parent_id: "",
  page_id: "",
  external_url: "",
  sort_order: "0",
  is_visible: true,
  kind: "link",
});

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-_]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function flattenMenuItems(items: MenuItem[], level = 0): Array<MenuItem & { level: number }> {
  return items.flatMap((item) => [{ ...item, level }, ...flattenMenuItems(item.children || [], level + 1)]);
}

function inferMenuKind(item: Pick<MenuItem, "children" | "page_id" | "external_url">): MenuKind {
  if ((item.children?.length || 0) > 0) return "dropdown";
  if (!item.page_id && !item.external_url) return "dropdown";
  return "link";
}

function resolveMenuTitle(item: Pick<MenuItem, "title" | "title_ru" | "title_kk" | "title_en">): string {
  const lang = getLang();
  if (lang === "ru" && item.title_ru?.trim()) return item.title_ru;
  if (lang === "kk" && item.title_kk?.trim()) return item.title_kk;
  if (lang === "en" && item.title_en?.trim()) return item.title_en;
  return item.title?.trim() || item.title_ru?.trim() || item.title_kk?.trim() || item.title_en?.trim() || "";
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full border px-3 py-1.5 text-xs font-medium transition",
        active ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export default function MenuPage() {
  const [data, setData] = useState<ContentSummary>({ pages: [], menu_items: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<MenuFormState>(emptyMenuForm);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api<ContentSummary>("/api/catalog/admin/content");
      setData(result);
    } catch (e: any) {
      setError(e?.message || "Failed to load menu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const menuItems = useMemo(() => flattenMenuItems(data.menu_items), [data.menu_items]);

  const openCreateForm = (parent?: MenuItem & { level?: number }) => {
    setForm({
      ...emptyMenuForm(),
      parent_id: parent ? String(parent.id) : "",
    });
    setShowForm(true);
  };

  const openEditForm = (item: MenuItem) => {
    setForm({
      id: item.id,
      title: item.title,
      title_ru: item.title_ru || "",
      title_kk: item.title_kk || "",
      title_en: item.title_en || "",
      slug: item.slug,
      description: item.description || "",
      image_url: item.image_url || "",
      parent_id: item.parent_id ? String(item.parent_id) : "",
      page_id: item.page_id ? String(item.page_id) : "",
      external_url: item.external_url || "",
      sort_order: String(item.sort_order || 0),
      is_visible: item.is_visible,
      kind: inferMenuKind(item),
    });
    setShowForm(true);
  };

  const onSubmit = async (e: React.FormEvent) => {
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
        description: form.description || null,
        image_url: form.image_url || null,
        parent_id: form.parent_id ? Number(form.parent_id) : null,
        page_id: form.kind === "link" && form.page_id ? Number(form.page_id) : null,
        external_url: form.kind === "link" ? form.external_url || null : null,
        sort_order: Number(form.sort_order || "0"),
        is_visible: form.is_visible,
      };
      if (form.id) {
        await api(`/api/catalog/admin/content/menu/${form.id}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await api("/api/catalog/admin/content/menu", { method: "POST", body: JSON.stringify(payload) });
      }
      setForm(emptyMenuForm());
      setShowForm(false);
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to save menu item");
    } finally {
      setSaving(false);
    }
  };

  const removeItem = async (id: number) => {
    if (!window.confirm(t("admin.menu.confirmDelete"))) return;
    try {
      await api(`/api/catalog/admin/content/menu/${id}`, { method: "DELETE" });
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to delete menu item");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{t("admin.nav.menu")}</h2>
          <p className="mt-1 text-sm text-slate-600">{t("admin.menu.description")}</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-md border px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          {t("admin.menu.refresh")}
        </button>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <section className="rounded-md border p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="font-medium text-slate-900">{t("admin.menu.form.title")}</div>
              <div className="text-xs text-slate-500">
                {form.id ? t("admin.menu.form.editing") : t("admin.menu.form.creating")}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => openCreateForm()}
                className="rounded-md border px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
              >
                  {t("admin.menu.actions.createMenu")}
                </button>
              <button
                type="button"
                onClick={() => setShowForm((v) => !v)}
                className="rounded-md border px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
              >
                  {showForm ? t("admin.menu.actions.hideForm") : t("admin.menu.actions.openForm")}
                </button>
              </div>
            </div>

          {showForm ? (
            <form onSubmit={onSubmit} className="space-y-3">
              <div className="flex gap-2">
                <Pill active={form.kind === "link"} onClick={() => setForm((prev) => ({ ...prev, kind: "link" }))}>
                  {t("admin.menu.kinds.link")}
                </Pill>
                <Pill active={form.kind === "dropdown"} onClick={() => setForm((prev) => ({ ...prev, kind: "dropdown", page_id: "", external_url: "" }))}>
                  {t("admin.menu.kinds.dropdown")}
                </Pill>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm">
                  <div className="mb-1 text-slate-600">{t("admin.menu.fields.title")}</div>
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
                  <div className="mb-1 text-slate-600">{t("admin.menu.fields.titleRu")}</div>
                  <input
                    value={form.title_ru}
                    onChange={(e) => setForm((prev) => ({ ...prev, title_ru: e.target.value }))}
                    className="w-full rounded-md border px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  <div className="mb-1 text-slate-600">{t("admin.menu.fields.titleKk")}</div>
                  <input
                    value={form.title_kk}
                    onChange={(e) => setForm((prev) => ({ ...prev, title_kk: e.target.value }))}
                    className="w-full rounded-md border px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  <div className="mb-1 text-slate-600">{t("admin.menu.fields.titleEn")}</div>
                  <input
                    value={form.title_en}
                    onChange={(e) => setForm((prev) => ({ ...prev, title_en: e.target.value }))}
                    className="w-full rounded-md border px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  <div className="mb-1 text-slate-600">{t("admin.menu.fields.slug")}</div>
                  <input
                    value={form.slug}
                    onChange={(e) => setForm((prev) => ({ ...prev, slug: toSlug(e.target.value) }))}
                    className="w-full rounded-md border px-3 py-2"
                    required
                  />
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm">
                  <div className="mb-1 text-slate-600">{t("admin.menu.fields.parent")}</div>
                  <select
                    value={form.parent_id}
                    onChange={(e) => setForm((prev) => ({ ...prev, parent_id: e.target.value }))}
                    className="w-full rounded-md border px-3 py-2"
                  >
                    <option value="">{t("admin.menu.options.topLevel")}</option>
                    {menuItems
                      .filter((item) => item.id !== form.id)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {"- ".repeat(item.level)}{resolveMenuTitle(item)}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="text-sm">
                  <div className="mb-1 text-slate-600">{t("admin.menu.fields.sortOrder")}</div>
                  <input
                    type="number"
                    value={form.sort_order}
                    onChange={(e) => setForm((prev) => ({ ...prev, sort_order: e.target.value }))}
                    className="w-full rounded-md border px-3 py-2"
                  />
                </label>
              </div>

              {form.kind === "link" && (
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="text-sm">
                    <div className="mb-1 text-slate-600">{t("admin.menu.fields.pageTarget")}</div>
                    <select
                      value={form.page_id}
                      onChange={(e) => setForm((prev) => ({ ...prev, page_id: e.target.value }))}
                      className="w-full rounded-md border px-3 py-2"
                    >
                      <option value="">{t("admin.menu.options.noPage")}</option>
                      {data.pages.map((page) => (
                        <option key={page.id} value={page.id}>
                          {page.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm">
                    <div className="mb-1 text-slate-600">{t("admin.menu.fields.externalUrl")}</div>
                    <input
                      value={form.external_url}
                      onChange={(e) => setForm((prev) => ({ ...prev, external_url: e.target.value }))}
                      placeholder="https://..."
                      className="w-full rounded-md border px-3 py-2"
                    />
                  </label>
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm">
                  <div className="mb-1 text-slate-600">{t("admin.menu.fields.imageUrl")}</div>
                  <input
                    value={form.image_url}
                    onChange={(e) => setForm((prev) => ({ ...prev, image_url: e.target.value }))}
                    className="w-full rounded-md border px-3 py-2"
                  />
                </label>
                <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.is_visible}
                    onChange={(e) => setForm((prev) => ({ ...prev, is_visible: e.target.checked }))}
                  />
                  {t("admin.menu.fields.visible")}
                </label>
              </div>

              <label className="block text-sm">
                <div className="mb-1 text-slate-600">{t("admin.menu.fields.description")}</div>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="min-h-24 w-full rounded-md border px-3 py-2"
                />
              </label>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  {saving ? t("admin.menu.actions.saving") : form.id ? t("admin.menu.actions.saveMenu") : t("admin.menu.actions.createMenu")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setForm(emptyMenuForm());
                    setShowForm(false);
                  }}
                  className="rounded-md border px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  {t("admin.common.cancel")}
                </button>
              </div>
            </form>
          ) : (
            <div className="text-sm text-slate-500">{t("admin.menu.form.collapsed")}</div>
          )}
        </section>

        <section className="rounded-md border p-4">
          <div className="mb-4">
            <div className="font-medium text-slate-900">{t("admin.menu.list.title")}</div>
            <div className="text-xs text-slate-500">{t("admin.menu.list.description")}</div>
          </div>

          {loading ? (
            <div className="text-sm text-slate-500">{t("admin.common.loading")}</div>
          ) : menuItems.length === 0 ? (
            <div className="text-sm text-slate-500">{t("admin.menu.list.empty")}</div>
          ) : (
            <div className="space-y-2">
              {menuItems.map((item) => {
                const kind = inferMenuKind(item);
                return (
                  <div key={item.id} className="rounded-md border px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900">
                          {"- ".repeat(item.level)}{resolveMenuTitle(item)}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {kind === "dropdown" ? t("admin.menu.kinds.dropdown") : t("admin.menu.kinds.link")} | /{item.slug} | {item.is_visible ? t("admin.menu.states.visible") : t("admin.menu.states.hidden")}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">{item.path || item.external_url || t("admin.menu.states.noTarget")}</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openCreateForm(item)}
                          className="rounded-md border px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                        >
                          {t("admin.menu.actions.addChild")}
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditForm(item)}
                          className="rounded-md border px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                        >
                          {t("admin.common.edit")}
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeItem(item.id)}
                          className="rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50"
                        >
                          {t("admin.common.delete")}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
