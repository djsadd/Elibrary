import { api } from "@/shared/api/client";

export type PageBlock = {
  id: number;
  type: "text" | "image" | "hero" | "cta";
  title?: string | null;
  body?: string | null;
  image_url?: string | null;
  link_label?: string | null;
  link_url?: string | null;
};

export type ContentPage = {
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

export type MenuItem = {
  id: number;
  title: string;
  title_ru?: string | null;
  title_kk?: string | null;
  title_en?: string | null;
  parent_id?: number | null;
  page_id?: number | null;
  children: MenuItem[];
};

export type ContentSummary = {
  pages: ContentPage[];
  menu_items: MenuItem[];
};

export type PageFormState = {
  id?: number;
  title: string;
  title_ru: string;
  title_kk: string;
  title_en: string;
  slug: string;
  summary: string;
  summary_ru: string;
  summary_kk: string;
  summary_en: string;
  content_html: string;
  content_html_ru: string;
  content_html_kk: string;
  content_html_en: string;
  status: "draft" | "published";
  menu_item_id: string;
};

export const emptyPageHtml = {
  default: "<h2>Новая страница</h2><p>Добавьте текст, изображения, ссылки, таблицы и другие элементы оформления.</p>",
  ru: "<h2>Новая страница</h2><p>Добавьте текст, изображения, ссылки, таблицы и другие элементы оформления.</p>",
  kk: "<h2>Жаңа бет</h2><p>Мәтін, суреттер, сілтемелер, кестелер және басқа безендіру элементтерін қосыңыз.</p>",
  en: "<h2>New page</h2><p>Add text, images, links, tables and other layout elements.</p>",
} as const;

export const emptyPageForm = (): PageFormState => ({
  title: "",
  title_ru: "",
  title_kk: "",
  title_en: "",
  slug: "",
  summary: "",
  summary_ru: "",
  summary_kk: "",
  summary_en: "",
  content_html: emptyPageHtml.default,
  content_html_ru: emptyPageHtml.ru,
  content_html_kk: emptyPageHtml.kk,
  content_html_en: emptyPageHtml.en,
  status: "draft",
  menu_item_id: "",
});

export function toSlug(value: string): string {
  const transliterated = value
    .split("")
    .map((char) => {
      const map: Record<string, string> = {
        а: "a", ә: "a", б: "b", в: "v", г: "g", ғ: "g", д: "d", е: "e", ё: "e", ж: "zh",
        з: "z", и: "i", й: "i", к: "k", қ: "k", л: "l", м: "m", н: "n", ң: "n", о: "o",
        ө: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ұ: "u", ү: "u", ф: "f", х: "h",
        һ: "h", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", і: "i", ь: "", э: "e",
        ю: "yu", я: "ya",
        А: "a", Ә: "a", Б: "b", В: "v", Г: "g", Ғ: "g", Д: "d", Е: "e", Ё: "e", Ж: "zh",
        З: "z", И: "i", Й: "i", К: "k", Қ: "k", Л: "l", М: "m", Н: "n", Ң: "n", О: "o",
        Ө: "o", П: "p", Р: "r", С: "s", Т: "t", У: "u", Ұ: "u", Ү: "u", Ф: "f", Х: "h",
        Һ: "h", Ц: "ts", Ч: "ch", Ш: "sh", Щ: "shch", Ъ: "", Ы: "y", І: "i", Ь: "", Э: "e",
        Ю: "yu", Я: "ya",
      };
      return map[char] ?? char;
    })
    .join("");

  const slug = transliterated
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-_]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "page";
}

export function ensureUniqueSlug(value: string, pages: ContentPage[], currentPageId?: number): string {
  const baseSlug = toSlug(value);
  const usedSlugs = new Set(
    pages
      .filter((page) => page.id !== currentPageId)
      .map((page) => page.slug.toLowerCase()),
  );

  if (!usedSlugs.has(baseSlug)) return baseSlug;

  let index = 2;
  let candidate = `${baseSlug}-${index}`;
  while (usedSlugs.has(candidate)) {
    index += 1;
    candidate = `${baseSlug}-${index}`;
  }
  return candidate;
}

export function blocksToHtml(blocks: PageBlock[]): string {
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

export function flattenMenuItems(items: MenuItem[], level = 0): Array<MenuItem & { level: number }> {
  return items.flatMap((item) => [{ ...item, level }, ...flattenMenuItems(item.children || [], level + 1)]);
}

export function resolveMenuTitle(item: Pick<MenuItem, "title" | "title_ru" | "title_kk" | "title_en">): string {
  return item.title_ru || item.title_kk || item.title_en || item.title || "";
}

export function findMenuItemByPageId(items: MenuItem[], pageId: number): MenuItem | null {
  for (const item of items) {
    if (item.page_id === pageId) return item;
    const nested = findMenuItemByPageId(item.children || [], pageId);
    if (nested) return nested;
  }
  return null;
}

export function toPageForm(page: ContentPage, menuItems: MenuItem[]): PageFormState {
  const linkedMenuItem = findMenuItemByPageId(menuItems, page.id);
  const html = page.content_html || blocksToHtml(page.blocks) || emptyPageHtml.default;

  return {
    id: page.id,
    title: page.title,
    title_ru: page.title_ru || page.title || "",
    title_kk: page.title_kk || page.title || "",
    title_en: page.title_en || page.title || "",
    slug: page.slug,
    summary: page.summary || "",
    summary_ru: page.summary_ru || page.summary || "",
    summary_kk: page.summary_kk || page.summary || "",
    summary_en: page.summary_en || page.summary || "",
    content_html: html,
    content_html_ru: page.content_html_ru || page.content_html || blocksToHtml(page.blocks) || emptyPageHtml.ru,
    content_html_kk: page.content_html_kk || page.content_html || blocksToHtml(page.blocks) || emptyPageHtml.kk,
    content_html_en: page.content_html_en || page.content_html || blocksToHtml(page.blocks) || emptyPageHtml.en,
    status: page.status,
    menu_item_id: linkedMenuItem ? String(linkedMenuItem.id) : "",
  };
}

export async function loadContentSummary(): Promise<ContentSummary> {
  return api<ContentSummary>("/api/catalog/admin/content");
}

export async function savePage(form: PageFormState): Promise<ContentPage> {
  const payload = {
    title: form.title,
    title_ru: form.title_ru || null,
    title_kk: form.title_kk || null,
    title_en: form.title_en || null,
    slug: form.slug,
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
    return api<ContentPage>(`/api/catalog/admin/content/pages/${form.id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  return api<ContentPage>("/api/catalog/admin/content/pages", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deletePage(pageId: number): Promise<void> {
  await api(`/api/catalog/admin/content/pages/${pageId}`, { method: "DELETE" });
}

export async function syncMenuBinding(pageId: number, menuItemId: string, menuItems: MenuItem[]): Promise<void> {
  const flat = flattenMenuItems(menuItems);
  const currentlyLinked = flat.find((item) => item.page_id === pageId);

  if (currentlyLinked && String(currentlyLinked.id) !== menuItemId) {
    await api(`/api/catalog/admin/content/menu/${currentlyLinked.id}`, {
      method: "PUT",
      body: JSON.stringify({ page_id: null }),
    });
  }

  if (!menuItemId) return;

  const target = flat.find((item) => String(item.id) === menuItemId);
  if (!target || target.page_id === pageId) return;

  await api(`/api/catalog/admin/content/menu/${target.id}`, {
    method: "PUT",
    body: JSON.stringify({ page_id: pageId }),
  });
}
