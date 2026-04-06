import { api } from "@/shared/api/client";
import { getLang } from "@/shared/i18n";

export type MenuPageRef = {
  id: number;
  title: string;
};

export type MenuItem = {
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

export type ContentSummary = {
  pages: MenuPageRef[];
  menu_items: MenuItem[];
};

export type MenuKind = "link" | "dropdown";

export type MenuFormState = {
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

export const emptyMenuForm = (): MenuFormState => ({
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

export function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-_]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function flattenMenuItems(items: MenuItem[], level = 0): Array<MenuItem & { level: number }> {
  return items.flatMap((item) => [{ ...item, level }, ...flattenMenuItems(item.children || [], level + 1)]);
}

export function inferMenuKind(item: Pick<MenuItem, "children" | "page_id" | "external_url">): MenuKind {
  if ((item.children?.length || 0) > 0) return "dropdown";
  if (!item.page_id && !item.external_url) return "dropdown";
  return "link";
}

export function resolveMenuTitle(item: Pick<MenuItem, "title" | "title_ru" | "title_kk" | "title_en">): string {
  const lang = getLang();
  if (lang === "ru" && item.title_ru?.trim()) return item.title_ru;
  if (lang === "kk" && item.title_kk?.trim()) return item.title_kk;
  if (lang === "en" && item.title_en?.trim()) return item.title_en;
  return item.title?.trim() || item.title_ru?.trim() || item.title_kk?.trim() || item.title_en?.trim() || "";
}

export function toMenuForm(item: MenuItem): MenuFormState {
  return {
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
  };
}

export async function loadMenuSummary(): Promise<ContentSummary> {
  return api<ContentSummary>("/api/catalog/admin/content");
}

export async function saveMenuItem(form: MenuFormState): Promise<void> {
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
    return;
  }

  await api("/api/catalog/admin/content/menu", { method: "POST", body: JSON.stringify(payload) });
}

export async function deleteMenuItem(id: number): Promise<void> {
  await api(`/api/catalog/admin/content/menu/${id}`, { method: "DELETE" });
}
