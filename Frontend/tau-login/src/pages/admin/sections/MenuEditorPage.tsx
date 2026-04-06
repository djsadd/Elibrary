import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { t } from "@/shared/i18n";

import {
  deleteMenuItem,
  emptyMenuForm,
  flattenMenuItems,
  loadMenuSummary,
  resolveMenuTitle,
  saveMenuItem,
  toMenuForm,
  toSlug,
  type MenuFormState,
  type MenuItem,
  type MenuPageRef,
} from "./contentMenu";

function KindToggle({
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

export default function MenuEditorPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isCreateMode = !id || id === "new";
  const presetParentId = searchParams.get("parentId") || "";

  const [pages, setPages] = useState<MenuPageRef[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [form, setForm] = useState<MenuFormState>(emptyMenuForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const flatMenuItems = useMemo(() => flattenMenuItems(menuItems), [menuItems]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await loadMenuSummary();
      setPages(result.pages);
      setMenuItems(result.menu_items);

      if (isCreateMode) {
        setForm({
          ...emptyMenuForm(),
          parent_id: presetParentId,
        });
        return;
      }

      const current = flattenMenuItems(result.menu_items).find((item) => String(item.id) === String(id));
      if (!current) {
        setError(t("admin.menu.errors.notFound"));
        return;
      }

      setForm(toMenuForm(current));
    } catch (e: any) {
      setError(e?.message || "Failed to load menu item");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [id, presetParentId]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await saveMenuItem(form);
      navigate("/content/menu", { replace: !form.id });
    } catch (e: any) {
      setError(e?.message || "Failed to save menu item");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!form.id) return;
    if (!window.confirm(t("admin.menu.confirmDelete"))) return;
    try {
      await deleteMenuItem(form.id);
      navigate("/content/menu", { replace: true });
    } catch (e: any) {
      setError(e?.message || "Failed to delete menu item");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm text-slate-500">
            <Link to="/content/menu" className="hover:text-slate-700">
              {t("admin.menu.list.title")}
            </Link>
            {" / "}
            <span>{form.id ? t("admin.menu.form.editing") : t("admin.menu.form.creating")}</span>
          </div>
          <h2 className="mt-2 text-lg font-semibold">
            {form.id ? t("admin.menu.form.editing") : t("admin.menu.form.creating")}
          </h2>
          <p className="mt-1 text-sm text-slate-600">{t("admin.menu.description")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/content/menu"
            className="rounded-md border px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            {t("admin.common.cancel")}
          </Link>
          {form.id && (
            <button
              type="button"
              onClick={() => void onDelete()}
              className="rounded-md border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
            >
              {t("admin.common.delete")}
            </button>
          )}
          <button
            type="submit"
            form="content-menu-form"
            disabled={saving || loading}
            className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? t("admin.menu.actions.saving") : form.id ? t("admin.menu.actions.saveMenu") : t("admin.menu.actions.createMenu")}
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
          <form id="content-menu-form" onSubmit={onSubmit} className="space-y-4">
            <div className="flex gap-2">
              <KindToggle active={form.kind === "link"} onClick={() => setForm((prev) => ({ ...prev, kind: "link" }))}>
                {t("admin.menu.kinds.link")}
              </KindToggle>
              <KindToggle
                active={form.kind === "dropdown"}
                onClick={() => setForm((prev) => ({ ...prev, kind: "dropdown", page_id: "", external_url: "" }))}
              >
                {t("admin.menu.kinds.dropdown")}
              </KindToggle>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
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
                <div className="mb-1 text-slate-600">{t("admin.menu.fields.slug")}</div>
                <input
                  value={form.slug}
                  onChange={(e) => setForm((prev) => ({ ...prev, slug: toSlug(e.target.value) }))}
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
                <div className="mb-1 text-slate-600">{t("admin.menu.fields.sortOrder")}</div>
                <input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm((prev) => ({ ...prev, sort_order: e.target.value }))}
                  className="w-full rounded-md border px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 text-slate-600">{t("admin.menu.fields.parent")}</div>
                <select
                  value={form.parent_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, parent_id: e.target.value }))}
                  className="w-full rounded-md border px-3 py-2"
                >
                  <option value="">{t("admin.menu.options.topLevel")}</option>
                  {flatMenuItems
                    .filter((item) => item.id !== form.id)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {"- ".repeat(item.level)}
                        {resolveMenuTitle(item)}
                      </option>
                    ))}
                </select>
              </label>
              {form.kind === "link" && (
                <>
                  <label className="text-sm">
                    <div className="mb-1 text-slate-600">{t("admin.menu.fields.pageTarget")}</div>
                    <select
                      value={form.page_id}
                      onChange={(e) => setForm((prev) => ({ ...prev, page_id: e.target.value }))}
                      className="w-full rounded-md border px-3 py-2"
                    >
                      <option value="">{t("admin.menu.options.noPage")}</option>
                      {pages.map((page) => (
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
                </>
              )}
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
          </form>
        </section>
      )}
    </div>
  );
}
