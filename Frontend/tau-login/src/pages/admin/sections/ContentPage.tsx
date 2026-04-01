import { useEffect, useMemo, useState, type ReactNode } from "react";

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

type MenuKind = "link" | "dropdown";

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
  kind: MenuKind;
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

type ContentTab = "pages" | "menu";

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
  kind: "link",
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

function FilterChip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
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

export default function ContentPage() {
  const [tab, setTab] = useState<ContentTab>("pages");
  const [data, setData] = useState<ContentSummary>({ pages: [], menu_items: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedPageId, setSelectedPageId] = useState<number | null>(null);
  const [pageQuery, setPageQuery] = useState("");
  const [pageStatusFilter, setPageStatusFilter] = useState<"all" | "draft" | "published">("all");

  const [pageForm, setPageForm] = useState<PageFormState>(emptyPageForm);
  const [menuForm, setMenuForm] = useState<MenuFormState>(emptyMenuForm);
  const [blockForm, setBlockForm] = useState<BlockFormState>(emptyBlockForm);
  const [showPageForm, setShowPageForm] = useState(false);
  const [showMenuForm, setShowMenuForm] = useState(false);

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
      setError(e?.message || "Failed to load content");
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

  const filteredPages = useMemo(() => {
    const query = pageQuery.trim().toLowerCase();
    return data.pages.filter((page) => {
      const byStatus = pageStatusFilter === "all" || page.status === pageStatusFilter;
      const haystack = `${page.title} ${page.slug} ${page.menu_title || ""}`.toLowerCase();
      const byQuery = !query || haystack.includes(query);
      return byStatus && byQuery;
    });
  }, [data.pages, pageQuery, pageStatusFilter]);

  const menuOptions = useMemo(() => flattenMenuItems(data.menu_items), [data.menu_items]);

  const refreshAfterChange = async () => {
    await load();
  };

  const startCreatePage = () => {
    setPageForm(emptyPageForm());
    setBlockForm(emptyBlockForm());
    setShowPageForm(true);
  };

  const startEditPage = (page: Page) => {
    setSelectedPageId(page.id);
    setShowPageForm(true);
    setPageForm({
      id: page.id,
      title: page.title,
      slug: page.slug,
      menu_title: page.menu_title || "",
      summary: page.summary || "",
      status: page.status,
    });
  };

  const startCreateMenuItem = (parent?: MenuItem & { level?: number }) => {
    setShowMenuForm(true);
    setMenuForm({
      ...emptyMenuForm(),
      parent_id: parent ? String(parent.id) : "",
    });
  };

  const startEditMenuItem = (item: MenuItem) => {
    setShowMenuForm(true);
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
      kind: inferMenuKind(item),
    });
  };

  const startEditBlock = (block: PageBlock) => {
    setBlockForm({
      id: block.id,
      type: block.type,
      title: block.title || "",
      body: block.body || "",
      image_url: block.image_url || "",
      link_label: block.link_label || "",
      link_url: block.link_url || "",
      sort_order: String(block.sort_order || 0),
    });
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
        await api(`/api/catalog/admin/content/pages/${pageForm.id}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await api("/api/catalog/admin/content/pages", { method: "POST", body: JSON.stringify(payload) });
      }
      setPageForm(emptyPageForm());
      setShowPageForm(false);
      await refreshAfterChange();
    } catch (e: any) {
      setError(e?.message || "Failed to save page");
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
        page_id: menuForm.kind === "link" && menuForm.page_id ? Number(menuForm.page_id) : null,
        external_url: menuForm.kind === "link" ? menuForm.external_url || null : null,
        sort_order: Number(menuForm.sort_order || "0"),
        is_visible: menuForm.is_visible,
      };
      if (menuForm.id) {
        await api(`/api/catalog/admin/content/menu/${menuForm.id}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await api("/api/catalog/admin/content/menu", { method: "POST", body: JSON.stringify(payload) });
      }
      setMenuForm(emptyMenuForm());
      setShowMenuForm(false);
      await refreshAfterChange();
    } catch (e: any) {
      setError(e?.message || "Failed to save menu item");
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
        await api(`/api/catalog/admin/content/blocks/${blockForm.id}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await api(`/api/catalog/admin/content/pages/${selectedPage.id}/blocks`, { method: "POST", body: JSON.stringify(payload) });
      }
      setBlockForm(emptyBlockForm());
      await refreshAfterChange();
      setSelectedPageId(selectedPage.id);
    } catch (e: any) {
      setError(e?.message || "Failed to save block");
    } finally {
      setSavingBlock(false);
    }
  };

  const deletePage = async (pageId: number) => {
    if (!window.confirm("Delete page and all its blocks?")) return;
    try {
      await api(`/api/catalog/admin/content/pages/${pageId}`, { method: "DELETE" });
      if (selectedPageId === pageId) {
        setSelectedPageId(null);
        setBlockForm(emptyBlockForm());
      }
      await refreshAfterChange();
    } catch (e: any) {
      setError(e?.message || "Failed to delete page");
    }
  };

  const deleteMenuItem = async (itemId: number) => {
    if (!window.confirm("Delete menu item?")) return;
    try {
      await api(`/api/catalog/admin/content/menu/${itemId}`, { method: "DELETE" });
      await refreshAfterChange();
    } catch (e: any) {
      setError(e?.message || "Failed to delete menu item");
    }
  };

  const deleteBlock = async (blockId: number) => {
    if (!window.confirm("Delete block?")) return;
    try {
      await api(`/api/catalog/admin/content/blocks/${blockId}`, { method: "DELETE" });
      setBlockForm(emptyBlockForm());
      await refreshAfterChange();
    } catch (e: any) {
      setError(e?.message || "Failed to delete block");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Content</h2>
          <p className="mt-1 text-sm text-slate-600">
            Separate workspace for pages and menu structure management.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-md border px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      <div className="flex gap-2">
        <FilterChip active={tab === "pages"} onClick={() => setTab("pages")}>
          Pages
        </FilterChip>
        <FilterChip active={tab === "menu"} onClick={() => setTab("menu")}>
          Menu
        </FilterChip>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="text-sm text-slate-500">Loading...</div>
      ) : tab === "pages" ? (
        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <section className="rounded-md border p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-medium text-slate-900">Pages list</div>
                <div className="text-xs text-slate-500">Search, filter and open pages for editing</div>
              </div>
              <button
                type="button"
                onClick={startCreatePage}
                className="rounded-md border px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
              >
                New page
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <input
                value={pageQuery}
                onChange={(e) => setPageQuery(e.target.value)}
                placeholder="Search by title or slug"
                className="w-full rounded-md border px-3 py-2 text-sm"
              />

              <div className="flex flex-wrap gap-2">
                <FilterChip active={pageStatusFilter === "all"} onClick={() => setPageStatusFilter("all")}>
                  All
                </FilterChip>
                <FilterChip active={pageStatusFilter === "draft"} onClick={() => setPageStatusFilter("draft")}>
                  Draft
                </FilterChip>
                <FilterChip active={pageStatusFilter === "published"} onClick={() => setPageStatusFilter("published")}>
                  Published
                </FilterChip>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {filteredPages.length === 0 ? (
                <div className="text-sm text-slate-500">No pages found.</div>
              ) : (
                filteredPages.map((page) => (
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
                        <div className="mt-1 text-xs text-slate-500">
                          /{page.slug} | {page.status} | {page.blocks.length} blocks
                        </div>
                      </button>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEditPage(page)}
                          className="rounded-md border px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void deletePage(page.id)}
                          className="rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <div className="space-y-6">
            <section className="rounded-md border p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium text-slate-900">Page form</div>
                  <div className="text-xs text-slate-500">
                    {pageForm.id ? "Edit selected page" : "Create a new page"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPageForm((v) => !v)}
                  className="rounded-md border px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                >
                  {showPageForm ? "Hide form" : "Open form"}
                </button>
              </div>

              {showPageForm ? (
              <form onSubmit={onSubmitPage} className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="text-sm">
                    <div className="mb-1 text-slate-600">Title</div>
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
                    <div className="mb-1 text-slate-600">Menu label</div>
                    <input
                      value={pageForm.menu_title}
                      onChange={(e) => setPageForm((prev) => ({ ...prev, menu_title: e.target.value }))}
                      className="w-full rounded-md border px-3 py-2"
                    />
                  </label>
                  <label className="text-sm">
                    <div className="mb-1 text-slate-600">Status</div>
                    <select
                      value={pageForm.status}
                      onChange={(e) => setPageForm((prev) => ({ ...prev, status: e.target.value as "draft" | "published" }))}
                      className="w-full rounded-md border px-3 py-2"
                    >
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                    </select>
                  </label>
                </div>

                <label className="block text-sm">
                  <div className="mb-1 text-slate-600">Summary</div>
                  <textarea
                    value={pageForm.summary}
                    onChange={(e) => setPageForm((prev) => ({ ...prev, summary: e.target.value }))}
                    className="min-h-24 w-full rounded-md border px-3 py-2"
                  />
                </label>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={savingPage}
                    className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {savingPage ? "Saving..." : pageForm.id ? "Save page" : "Create page"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPageForm(emptyPageForm());
                      setShowPageForm(false);
                    }}
                    className="rounded-md border px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
              ) : (
                <div className="text-sm text-slate-500">Form is collapsed. Use "Open form" or "New page".</div>
              )}
            </section>

            <section className="rounded-md border p-4">
              <div className="mb-4">
                <div className="font-medium text-slate-900">Page blocks</div>
                <div className="text-xs text-slate-500">
                  {selectedPage ? `Selected page: ${selectedPage.title}` : "Select a page from the list first"}
                </div>
              </div>

              {!selectedPage ? (
                <div className="text-sm text-slate-500">No page selected.</div>
              ) : (
                <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                  <form onSubmit={onSubmitBlock} className="space-y-3 rounded-md bg-slate-50 p-4">
                    <label className="block text-sm">
                      <div className="mb-1 text-slate-600">Block type</div>
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
                      <div className="mb-1 text-slate-600">Title</div>
                      <input
                        value={blockForm.title}
                        onChange={(e) => setBlockForm((prev) => ({ ...prev, title: e.target.value }))}
                        className="w-full rounded-md border px-3 py-2"
                      />
                    </label>
                    <label className="block text-sm">
                      <div className="mb-1 text-slate-600">Body</div>
                      <textarea
                        value={blockForm.body}
                        onChange={(e) => setBlockForm((prev) => ({ ...prev, body: e.target.value }))}
                        className="min-h-28 w-full rounded-md border px-3 py-2"
                      />
                    </label>
                    <label className="block text-sm">
                      <div className="mb-1 text-slate-600">Image URL</div>
                      <input
                        value={blockForm.image_url}
                        onChange={(e) => setBlockForm((prev) => ({ ...prev, image_url: e.target.value }))}
                        className="w-full rounded-md border px-3 py-2"
                      />
                    </label>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="text-sm">
                        <div className="mb-1 text-slate-600">Button label</div>
                        <input
                          value={blockForm.link_label}
                          onChange={(e) => setBlockForm((prev) => ({ ...prev, link_label: e.target.value }))}
                          className="w-full rounded-md border px-3 py-2"
                        />
                      </label>
                      <label className="text-sm">
                        <div className="mb-1 text-slate-600">Button URL</div>
                        <input
                          value={blockForm.link_url}
                          onChange={(e) => setBlockForm((prev) => ({ ...prev, link_url: e.target.value }))}
                          className="w-full rounded-md border px-3 py-2"
                        />
                      </label>
                    </div>
                    <label className="block text-sm">
                      <div className="mb-1 text-slate-600">Sort order</div>
                      <input
                        type="number"
                        value={blockForm.sort_order}
                        onChange={(e) => setBlockForm((prev) => ({ ...prev, sort_order: e.target.value }))}
                        className="w-full rounded-md border px-3 py-2"
                      />
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={savingBlock}
                        className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                      >
                        {savingBlock ? "Saving..." : blockForm.id ? "Save block" : "Add block"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setBlockForm(emptyBlockForm())}
                        className="rounded-md border px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        Reset
                      </button>
                    </div>
                  </form>

                  <div className="space-y-3">
                    {selectedPage.blocks.length === 0 ? (
                      <div className="text-sm text-slate-500">No blocks yet.</div>
                    ) : (
                      selectedPage.blocks
                        .slice()
                        .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
                        .map((block) => (
                          <div key={block.id} className="rounded-md border px-4 py-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="font-medium text-slate-900">
                                  {block.title || "Untitled"} <span className="text-xs font-normal text-slate-500">[{block.type}]</span>
                                </div>
                                <div className="mt-1 text-xs text-slate-500">Sort: {block.sort_order}</div>
                                {block.body && <div className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{block.body}</div>}
                                {block.image_url && (
                                  <img
                                    src={block.image_url}
                                    alt={block.title || "block"}
                                    className="mt-3 max-h-40 rounded-md border object-cover"
                                  />
                                )}
                              </div>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => startEditBlock(block)}
                                  className="rounded-md border px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void deleteBlock(block.id)}
                                  className="rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50"
                                >
                                  Delete
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
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <section className="rounded-md border p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="font-medium text-slate-900">Menu form</div>
                <div className="text-xs text-slate-500">
                  {menuForm.id ? "Edit selected menu item" : "Create a new menu item"}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => startCreateMenuItem()}
                  className="rounded-md border px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                >
                  New item
                </button>
                <button
                  type="button"
                  onClick={() => setShowMenuForm((v) => !v)}
                  className="rounded-md border px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                >
                  {showMenuForm ? "Hide form" : "Open form"}
                </button>
              </div>
            </div>

            {showMenuForm ? (
            <form onSubmit={onSubmitMenu} className="space-y-3">
              <div className="flex gap-2">
                <FilterChip active={menuForm.kind === "link"} onClick={() => setMenuForm((prev) => ({ ...prev, kind: "link" }))}>
                  Link item
                </FilterChip>
                <FilterChip active={menuForm.kind === "dropdown"} onClick={() => setMenuForm((prev) => ({ ...prev, kind: "dropdown", page_id: "", external_url: "" }))}>
                  Dropdown
                </FilterChip>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm">
                  <div className="mb-1 text-slate-600">Title</div>
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
                  <div className="mb-1 text-slate-600">Parent item</div>
                  <select
                    value={menuForm.parent_id}
                    onChange={(e) => setMenuForm((prev) => ({ ...prev, parent_id: e.target.value }))}
                    className="w-full rounded-md border px-3 py-2"
                  >
                    <option value="">Top level</option>
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
                  <div className="mb-1 text-slate-600">Sort order</div>
                  <input
                    type="number"
                    value={menuForm.sort_order}
                    onChange={(e) => setMenuForm((prev) => ({ ...prev, sort_order: e.target.value }))}
                    className="w-full rounded-md border px-3 py-2"
                  />
                </label>
              </div>
              {menuForm.kind === "link" && (
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="text-sm">
                    <div className="mb-1 text-slate-600">Page target</div>
                    <select
                      value={menuForm.page_id}
                      onChange={(e) => setMenuForm((prev) => ({ ...prev, page_id: e.target.value }))}
                      className="w-full rounded-md border px-3 py-2"
                    >
                      <option value="">No page selected</option>
                      {data.pages.map((page) => (
                        <option key={page.id} value={page.id}>
                          {page.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm">
                    <div className="mb-1 text-slate-600">External URL</div>
                    <input
                      value={menuForm.external_url}
                      onChange={(e) => setMenuForm((prev) => ({ ...prev, external_url: e.target.value }))}
                      placeholder="https://..."
                      className="w-full rounded-md border px-3 py-2"
                    />
                  </label>
                </div>
              )}
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm">
                  <div className="mb-1 text-slate-600">Image URL</div>
                  <input
                    value={menuForm.image_url}
                    onChange={(e) => setMenuForm((prev) => ({ ...prev, image_url: e.target.value }))}
                    className="w-full rounded-md border px-3 py-2"
                  />
                </label>
                <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={menuForm.is_visible}
                    onChange={(e) => setMenuForm((prev) => ({ ...prev, is_visible: e.target.checked }))}
                  />
                  Visible in public menu
                </label>
              </div>
              <label className="block text-sm">
                <div className="mb-1 text-slate-600">Description</div>
                <textarea
                  value={menuForm.description}
                  onChange={(e) => setMenuForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="min-h-24 w-full rounded-md border px-3 py-2"
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={savingMenu}
                  className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  {savingMenu ? "Saving..." : menuForm.id ? "Save item" : "Create item"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuForm(emptyMenuForm());
                    setShowMenuForm(false);
                  }}
                  className="rounded-md border px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
            ) : (
              <div className="text-sm text-slate-500">Form is collapsed. Use "Open form" or "New item".</div>
            )}
          </section>

          <section className="rounded-md border p-4">
            <div className="mb-4">
              <div className="font-medium text-slate-900">Menu list</div>
              <div className="text-xs text-slate-500">Build top-level items, dropdowns and nested sub-items</div>
            </div>

            {menuOptions.length === 0 ? (
              <div className="text-sm text-slate-500">No menu items yet.</div>
            ) : (
              <div className="space-y-2">
                {menuOptions.map((item) => {
                  const kind = inferMenuKind(item);
                  return (
                    <div key={item.id} className="rounded-md border px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900">
                            {"- ".repeat(item.level)}{item.title}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {kind === "dropdown" ? "dropdown" : "link"} | /{item.slug} | {item.is_visible ? "visible" : "hidden"}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {item.path || item.external_url || "No target"}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => startCreateMenuItem(item)}
                            className="rounded-md border px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                          >
                            Add child
                          </button>
                          <button
                            type="button"
                            onClick={() => startEditMenuItem(item)}
                            className="rounded-md border px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteMenuItem(item.id)}
                            className="rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50"
                          >
                            Delete
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
      )}
    </div>
  );
}
