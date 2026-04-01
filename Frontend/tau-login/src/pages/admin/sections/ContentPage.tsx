import { useEffect, useMemo, useState } from "react";
import { api } from "@/shared/api/client";

type PageBlock = {
  id: number;
  page_id: number;
  type: "text" | "image" | "hero" | "cta";
  title?: string | null;
  body?: string | null;
  image_url?: string | null;
  link_label?: string | null;
  link_url?: string | null;
  sort_order: number;
};

type Page = {
  id: number;
  title: string;
  slug: string;
  menu_title?: string | null;
  summary?: string | null;
  status: "draft" | "published";
  blocks: PageBlock[];
};

type MenuItem = {
  id: number;
  title: string;
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

type PageFormState = {
  id?: number;
  title: string;
  slug: string;
  menu_title: string;
  summary: string;
  status: "draft" | "published";
};

type MenuFormState = {
  id?: number;
  title: string;
  slug: string;
  description: string;
  image_url: string;
  parent_id: string;
  page_id: string;
  external_url: string;
  sort_order: string;
  is_visible: boolean;
};

type BlockFormState = {
  id?: number;
  type: "text" | "image" | "hero" | "cta";
  title: string;
  body: string;
  image_url: string;
  link_label: string;
  link_url: string;
  sort_order: string;
};

const emptyPageForm = (): PageFormState => ({
  title: "",
  slug: "",
  menu_title: "",
  summary: "",
  status: "draft",
});

const emptyMenuForm = (): MenuFormState => ({
  title: "",
  slug: "",
  description: "",
  image_url: "",
  parent_id: "",
  page_id: "",
  external_url: "",
  sort_order: "0",
  is_visible: true,
});

const emptyBlockForm = (): BlockFormState => ({
  type: "text",
  title: "",
  body: "",
  image_url: "",
  link_label: "",
  link_url: "",
  sort_order: "0",
});

function flattenMenuItems(items: MenuItem[], level = 0): Array<MenuItem & { level: number }> {
  return items.flatMap((item) => [{ ...item, level }, ...flattenMenuItems(item.children || [], level + 1)]);
}

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9а-яёқңғүұһәі-\s]/gi, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export default function ContentPage() {
  const [data, setData] = useState<ContentSummary>({ pages: [], menu_items: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<number | null>(null);
  const [pageForm, setPageForm] = useState<PageFormState>(emptyPageForm);
  const [menuForm, setMenuForm] = useState<MenuFormState>(emptyMenuForm);
  const [blockForm, setBlockForm] = useState<BlockFormState>(emptyBlockForm);
  const [savingPage, setSavingPage] = useState(false);
  const [savingMenu, setSavingMenu] = useState(false);
  const [savingBlock, setSavingBlock] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api<ContentSummary>("/api/catalog/admin/content");
      setData(result);
      setSelectedPageId((prev) => prev ?? result.pages[0]?.id ?? null);
    } catch (e: any) {
      setError(e?.message || "Не удалось загрузить контент");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const selectedPage = useMemo(
    () => data.pages.find((page) => page.id === selectedPageId) ?? null,
    [data.pages, selectedPageId],
  );
  const menuOptions = useMemo(() => flattenMenuItems(data.menu_items), [data.menu_items]);

  const refreshAfterChange = async () => {
    await load();
  };

  const onSubmitPage = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPage(true);
    setError(null);
    try {
      const payload = {
        title: pageForm.title,
        slug: pageForm.slug,
        menu_title: pageForm.menu_title || null,
        summary: pageForm.summary || null,
        status: pageForm.status,
      };
      if (pageForm.id) {
        await api(`/api/catalog/admin/content/pages/${pageForm.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await api(`/api/catalog/admin/content/pages`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setPageForm(emptyPageForm());
      await refreshAfterChange();
    } catch (e: any) {
      setError(e?.message || "Не удалось сохранить страницу");
    } finally {
      setSavingPage(false);
    }
  };

  const onSubmitMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingMenu(true);
    setError(null);
    try {
      const payload = {
        title: menuForm.title,
        slug: menuForm.slug,
        description: menuForm.description || null,
        image_url: menuForm.image_url || null,
        parent_id: menuForm.parent_id ? Number(menuForm.parent_id) : null,
        page_id: menuForm.page_id ? Number(menuForm.page_id) : null,
        external_url: menuForm.external_url || null,
        sort_order: Number(menuForm.sort_order || "0"),
        is_visible: menuForm.is_visible,
      };
      if (menuForm.id) {
        await api(`/api/catalog/admin/content/menu/${menuForm.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await api(`/api/catalog/admin/content/menu`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setMenuForm(emptyMenuForm());
      await refreshAfterChange();
    } catch (e: any) {
      setError(e?.message || "Не удалось сохранить пункт меню");
    } finally {
      setSavingMenu(false);
    }
  };

  const onSubmitBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPage) return;
    setSavingBlock(true);
    setError(null);
    try {
      const payload = {
        type: blockForm.type,
        title: blockForm.title || null,
        body: blockForm.body || null,
        image_url: blockForm.image_url || null,
        link_label: blockForm.link_label || null,
        link_url: blockForm.link_url || null,
        sort_order: Number(blockForm.sort_order || "0"),
      };
      if (blockForm.id) {
        await api(`/api/catalog/admin/content/blocks/${blockForm.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await api(`/api/catalog/admin/content/pages/${selectedPage.id}/blocks`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setBlockForm(emptyBlockForm());
      await refreshAfterChange();
      setSelectedPageId(selectedPage.id);
    } catch (e: any) {
      setError(e?.message || "Не удалось сохранить блок");
    } finally {
      setSavingBlock(false);
    }
  };

  const deletePage = async (pageId: number) => {
    if (!window.confirm("Удалить страницу и все ее блоки?")) return;
    try {
      await api(`/api/catalog/admin/content/pages/${pageId}`, { method: "DELETE" });
      if (selectedPageId === pageId) {
        setSelectedPageId(null);
        setBlockForm(emptyBlockForm());
      }
      await refreshAfterChange();
    } catch (e: any) {
      setError(e?.message || "Не удалось удалить страницу");
    }
  };

  const deleteMenuItem = async (itemId: number) => {
    if (!window.confirm("Удалить пункт меню?")) return;
    try {
      await api(`/api/catalog/admin/content/menu/${itemId}`, { method: "DELETE" });
      await refreshAfterChange();
    } catch (e: any) {
      setError(e?.message || "Не удалось удалить пункт меню");
    }
  };

  const deleteBlock = async (blockId: number) => {
    if (!window.confirm("Удалить блок?")) return;
    try {
      await api(`/api/catalog/admin/content/blocks/${blockId}`, { method: "DELETE" });
      setBlockForm(emptyBlockForm());
      await refreshAfterChange();
    } catch (e: any) {
      setError(e?.message || "Не удалось удалить блок");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Контент и меню</h2>
          <p className="mt-1 text-sm text-slate-600">
            Создавайте разделы, страницы и пункты публичного меню без правок в коде.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-md border px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Обновить
        </button>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="text-sm text-slate-500">Загрузка контента...</div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-2">
            <section className="rounded-md border p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium text-slate-900">Страницы</div>
                  <div className="text-xs text-slate-500">Заголовок, slug, статус и блоки контента</div>
                </div>
                <button
                  type="button"
                  onClick={() => setPageForm(emptyPageForm())}
                  className="rounded-md border px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                >
                  Новая страница
                </button>
              </div>

              <form onSubmit={onSubmitPage} className="space-y-3 rounded-md bg-slate-50 p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="text-sm">
                    <div className="mb-1 text-slate-600">Заголовок</div>
                    <input
                      value={pageForm.title}
                      onChange={(e) => {
                        const title = e.target.value;
                        setPageForm((prev) => ({ ...prev, title, slug: prev.id ? prev.slug : toSlug(title) }));
                      }}
                      className="w-full rounded-md border px-3 py-2"
                      required
                    />
                  </label>
                  <label className="text-sm">
                    <div className="mb-1 text-slate-600">Slug</div>
                    <input
                      value={pageForm.slug}
                      onChange={(e) => setPageForm((prev) => ({ ...prev, slug: toSlug(e.target.value) }))}
                      className="w-full rounded-md border px-3 py-2"
                      required
                    />
                  </label>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="text-sm">
                    <div className="mb-1 text-slate-600">Название в меню</div>
                    <input
                      value={pageForm.menu_title}
                      onChange={(e) => setPageForm((prev) => ({ ...prev, menu_title: e.target.value }))}
                      className="w-full rounded-md border px-3 py-2"
                    />
                  </label>
                  <label className="text-sm">
                    <div className="mb-1 text-slate-600">Статус</div>
                    <select
                      value={pageForm.status}
                      onChange={(e) => setPageForm((prev) => ({ ...prev, status: e.target.value as "draft" | "published" }))}
                      className="w-full rounded-md border px-3 py-2"
                    >
                      <option value="draft">Черновик</option>
                      <option value="published">Опубликована</option>
                    </select>
                  </label>
                </div>
                <label className="block text-sm">
                  <div className="mb-1 text-slate-600">Краткое описание</div>
                  <textarea
                    value={pageForm.summary}
                    onChange={(e) => setPageForm((prev) => ({ ...prev, summary: e.target.value }))}
                    className="min-h-24 w-full rounded-md border px-3 py-2"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={savingPage}
                    className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {savingPage ? "Сохранение..." : pageForm.id ? "Сохранить страницу" : "Создать страницу"}
                  </button>
                  {pageForm.id && (
                    <button
                      type="button"
                      onClick={() => setPageForm(emptyPageForm())}
                      className="rounded-md border px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      Сбросить
                    </button>
                  )}
                </div>
              </form>

              <div className="mt-4 space-y-2">
                {data.pages.length === 0 ? (
                  <div className="text-sm text-slate-500">Страницы еще не созданы.</div>
                ) : (
                  data.pages.map((page) => (
                    <div
                      key={page.id}
                      className={[
                        "rounded-md border px-4 py-3",
                        selectedPageId === page.id ? "border-slate-800 bg-slate-50" : "border-slate-200",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => setSelectedPageId(page.id)}
                          className="min-w-0 text-left"
                        >
                          <div className="font-medium text-slate-900">{page.title}</div>
                          <div className="mt-1 text-xs text-slate-500">/{page.slug} • {page.status}</div>
                          <div className="mt-1 text-xs text-slate-500">{page.blocks.length} блок(ов)</div>
                        </button>
                        <div className="flex shrink-0 gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setPageForm({
                                id: page.id,
                                title: page.title,
                                slug: page.slug,
                                menu_title: page.menu_title || "",
                                summary: page.summary || "",
                                status: page.status,
                              })
                            }
                            className="rounded-md border px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                          >
                            Изменить
                          </button>
                          <button
                            type="button"
                            onClick={() => void deletePage(page.id)}
                            className="rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50"
                          >
                            Удалить
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-md border p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium text-slate-900">Меню разделов</div>
                  <div className="text-xs text-slate-500">Пункт может вести на страницу, внешний URL или быть вложенным</div>
                </div>
                <button
                  type="button"
                  onClick={() => setMenuForm(emptyMenuForm())}
                  className="rounded-md border px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                >
                  Новый пункт
                </button>
              </div>

              <form onSubmit={onSubmitMenu} className="space-y-3 rounded-md bg-slate-50 p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="text-sm">
                    <div className="mb-1 text-slate-600">Название</div>
                    <input
                      value={menuForm.title}
                      onChange={(e) => {
                        const title = e.target.value;
                        setMenuForm((prev) => ({ ...prev, title, slug: prev.id ? prev.slug : toSlug(title) }));
                      }}
                      className="w-full rounded-md border px-3 py-2"
                      required
                    />
                  </label>
                  <label className="text-sm">
                    <div className="mb-1 text-slate-600">Slug</div>
                    <input
                      value={menuForm.slug}
                      onChange={(e) => setMenuForm((prev) => ({ ...prev, slug: toSlug(e.target.value) }))}
                      className="w-full rounded-md border px-3 py-2"
                      required
                    />
                  </label>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="text-sm">
                    <div className="mb-1 text-slate-600">Родительский пункт</div>
                    <select
                      value={menuForm.parent_id}
                      onChange={(e) => setMenuForm((prev) => ({ ...prev, parent_id: e.target.value }))}
                      className="w-full rounded-md border px-3 py-2"
                    >
                      <option value="">Без родителя</option>
                      {menuOptions
                        .filter((item) => item.id !== menuForm.id)
                        .map((item) => (
                          <option key={item.id} value={item.id}>
                            {"- ".repeat(item.level)}{item.title}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="text-sm">
                    <div className="mb-1 text-slate-600">Привязанная страница</div>
                    <select
                      value={menuForm.page_id}
                      onChange={(e) => setMenuForm((prev) => ({ ...prev, page_id: e.target.value }))}
                      className="w-full rounded-md border px-3 py-2"
                    >
                      <option value="">Не выбрано</option>
                      {data.pages.map((page) => (
                        <option key={page.id} value={page.id}>
                          {page.title}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="text-sm">
                    <div className="mb-1 text-slate-600">Внешняя ссылка</div>
                    <input
                      value={menuForm.external_url}
                      onChange={(e) => setMenuForm((prev) => ({ ...prev, external_url: e.target.value }))}
                      className="w-full rounded-md border px-3 py-2"
                      placeholder="https://..."
                    />
                  </label>
                  <label className="text-sm">
                    <div className="mb-1 text-slate-600">Картинка URL</div>
                    <input
                      value={menuForm.image_url}
                      onChange={(e) => setMenuForm((prev) => ({ ...prev, image_url: e.target.value }))}
                      className="w-full rounded-md border px-3 py-2"
                    />
                  </label>
                </div>
                <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                  <label className="text-sm">
                    <div className="mb-1 text-slate-600">Описание</div>
                    <textarea
                      value={menuForm.description}
                      onChange={(e) => setMenuForm((prev) => ({ ...prev, description: e.target.value }))}
                      className="min-h-24 w-full rounded-md border px-3 py-2"
                    />
                  </label>
                  <div className="space-y-3">
                    <label className="block text-sm">
                      <div className="mb-1 text-slate-600">Порядок</div>
                      <input
                        type="number"
                        value={menuForm.sort_order}
                        onChange={(e) => setMenuForm((prev) => ({ ...prev, sort_order: e.target.value }))}
                        className="w-28 rounded-md border px-3 py-2"
                      />
                    </label>
                    <label className="flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={menuForm.is_visible}
                        onChange={(e) => setMenuForm((prev) => ({ ...prev, is_visible: e.target.checked }))}
                      />
                      Видимый
                    </label>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={savingMenu}
                    className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {savingMenu ? "Сохранение..." : menuForm.id ? "Сохранить пункт" : "Создать пункт"}
                  </button>
                  {menuForm.id && (
                    <button
                      type="button"
                      onClick={() => setMenuForm(emptyMenuForm())}
                      className="rounded-md border px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      Сбросить
                    </button>
                  )}
                </div>
              </form>

              <div className="mt-4 space-y-2">
                {menuOptions.length === 0 ? (
                  <div className="text-sm text-slate-500">Пункты меню еще не созданы.</div>
                ) : (
                  menuOptions.map((item) => (
                    <div key={item.id} className="rounded-md border px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900">
                            {"- ".repeat(item.level)}{item.title}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            /{item.slug} {item.path ? `• ${item.path}` : ""} {item.is_visible ? "• visible" : "• hidden"}
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setMenuForm({
                                id: item.id,
                                title: item.title,
                                slug: item.slug,
                                description: item.description || "",
                                image_url: item.image_url || "",
                                parent_id: item.parent_id ? String(item.parent_id) : "",
                                page_id: item.page_id ? String(item.page_id) : "",
                                external_url: item.external_url || "",
                                sort_order: String(item.sort_order || 0),
                                is_visible: item.is_visible,
                              })
                            }
                            className="rounded-md border px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                          >
                            Изменить
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteMenuItem(item.id)}
                            className="rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50"
                          >
                            Удалить
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          <section className="rounded-md border p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="font-medium text-slate-900">Блоки страницы</div>
                <div className="text-xs text-slate-500">
                  {selectedPage ? `Редактируется: ${selectedPage.title}` : "Выберите страницу слева"}
                </div>
              </div>
            </div>

            {!selectedPage ? (
              <div className="text-sm text-slate-500">Сначала выберите или создайте страницу.</div>
            ) : (
              <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
                <form onSubmit={onSubmitBlock} className="space-y-3 rounded-md bg-slate-50 p-4">
                  <label className="block text-sm">
                    <div className="mb-1 text-slate-600">Тип блока</div>
                    <select
                      value={blockForm.type}
                      onChange={(e) => setBlockForm((prev) => ({ ...prev, type: e.target.value as BlockFormState["type"] }))}
                      className="w-full rounded-md border px-3 py-2"
                    >
                      <option value="text">Text</option>
                      <option value="image">Image</option>
                      <option value="hero">Hero</option>
                      <option value="cta">CTA</option>
                    </select>
                  </label>
                  <label className="block text-sm">
                    <div className="mb-1 text-slate-600">Заголовок</div>
                    <input
                      value={blockForm.title}
                      onChange={(e) => setBlockForm((prev) => ({ ...prev, title: e.target.value }))}
                      className="w-full rounded-md border px-3 py-2"
                    />
                  </label>
                  <label className="block text-sm">
                    <div className="mb-1 text-slate-600">Текст</div>
                    <textarea
                      value={blockForm.body}
                      onChange={(e) => setBlockForm((prev) => ({ ...prev, body: e.target.value }))}
                      className="min-h-28 w-full rounded-md border px-3 py-2"
                    />
                  </label>
                  <label className="block text-sm">
                    <div className="mb-1 text-slate-600">URL картинки</div>
                    <input
                      value={blockForm.image_url}
                      onChange={(e) => setBlockForm((prev) => ({ ...prev, image_url: e.target.value }))}
                      className="w-full rounded-md border px-3 py-2"
                    />
                  </label>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="text-sm">
                      <div className="mb-1 text-slate-600">Текст кнопки</div>
                      <input
                        value={blockForm.link_label}
                        onChange={(e) => setBlockForm((prev) => ({ ...prev, link_label: e.target.value }))}
                        className="w-full rounded-md border px-3 py-2"
                      />
                    </label>
                    <label className="text-sm">
                      <div className="mb-1 text-slate-600">Ссылка кнопки</div>
                      <input
                        value={blockForm.link_url}
                        onChange={(e) => setBlockForm((prev) => ({ ...prev, link_url: e.target.value }))}
                        className="w-full rounded-md border px-3 py-2"
                      />
                    </label>
                  </div>
                  <label className="block text-sm">
                    <div className="mb-1 text-slate-600">Порядок</div>
                    <input
                      type="number"
                      value={blockForm.sort_order}
                      onChange={(e) => setBlockForm((prev) => ({ ...prev, sort_order: e.target.value }))}
                      className="w-full rounded-md border px-3 py-2"
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="submit"
                      disabled={savingBlock}
                      className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                    >
                      {savingBlock ? "Сохранение..." : blockForm.id ? "Сохранить блок" : "Добавить блок"}
                    </button>
                    {blockForm.id && (
                      <button
                        type="button"
                        onClick={() => setBlockForm(emptyBlockForm())}
                        className="rounded-md border px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        Сбросить
                      </button>
                    )}
                  </div>
                </form>

                <div className="space-y-3">
                  {selectedPage.blocks.length === 0 ? (
                    <div className="text-sm text-slate-500">На странице пока нет блоков.</div>
                  ) : (
                    selectedPage.blocks
                      .slice()
                      .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
                      .map((block) => (
                        <div key={block.id} className="rounded-md border px-4 py-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-medium text-slate-900">
                                {block.title || "Без заголовка"} <span className="text-xs font-normal text-slate-500">[{block.type}]</span>
                              </div>
                              <div className="mt-1 text-xs text-slate-500">Порядок: {block.sort_order}</div>
                              {block.body && <div className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{block.body}</div>}
                              {block.image_url && (
                                <div className="mt-3">
                                  <img src={block.image_url} alt={block.title || "block"} className="max-h-40 rounded-md border object-cover" />
                                </div>
                              )}
                              {(block.link_label || block.link_url) && (
                                <div className="mt-2 text-xs text-slate-500">
                                  {block.link_label || "Кнопка"} {block.link_url ? `• ${block.link_url}` : ""}
                                </div>
                              )}
                            </div>
                            <div className="flex shrink-0 gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setBlockForm({
                                    id: block.id,
                                    type: block.type,
                                    title: block.title || "",
                                    body: block.body || "",
                                    image_url: block.image_url || "",
                                    link_label: block.link_label || "",
                                    link_url: block.link_url || "",
                                    sort_order: String(block.sort_order || 0),
                                  })
                                }
                                className="rounded-md border px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                              >
                                Изменить
                              </button>
                              <button
                                type="button"
                                onClick={() => void deleteBlock(block.id)}
                                className="rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50"
                              >
                                Удалить
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
