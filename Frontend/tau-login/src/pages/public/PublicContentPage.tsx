import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { PublicPageLayout } from "@/components/layout/PublicPageLayout";
import { getLang, t } from "@/shared/i18n";

type PageBlock = {
  id: number;
  type: "text" | "image" | "hero" | "cta";
  title?: string | null;
  body?: string | null;
  image_url?: string | null;
  link_label?: string | null;
  link_url?: string | null;
};

type ContentPageResponse = {
  id: number;
  title: string;
  title_ru?: string | null;
  title_kk?: string | null;
  title_en?: string | null;
  slug: string;
  summary?: string | null;
  summary_ru?: string | null;
  summary_kk?: string | null;
  summary_en?: string | null;
  content_html?: string | null;
  content_html_ru?: string | null;
  content_html_kk?: string | null;
  content_html_en?: string | null;
  blocks: PageBlock[];
};

function pickLocalizedValue(
  page: ContentPageResponse,
  field: "title" | "summary" | "content_html",
): string | null | undefined {
  const lang = getLang();
  if (lang === "ru") return (page as any)[`${field}_ru`] || page[field];
  if (lang === "kk") return (page as any)[`${field}_kk`] || page[field];
  if (lang === "en") return (page as any)[`${field}_en`] || page[field];
  return page[field];
}

function ActionLink({ href, label }: { href?: string | null; label: string }) {
  if (!href) return null;
  if (/^https?:\/\//i.test(href)) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="inline-flex rounded-full bg-[color:var(--public-accent)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[color:var(--public-accent-hover)]"
      >
        {label}
      </a>
    );
  }
  return (
    <Link
      to={href}
      className="inline-flex rounded-full bg-[color:var(--public-accent)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[color:var(--public-accent-hover)]"
    >
      {label}
    </Link>
  );
}

export default function PublicContentPage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const [page, setPage] = useState<ContentPageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/catalog/public/content/pages/${slug}`);
        if (!response.ok) throw new Error("Page not found");
        const data = await response.json();
        setPage(data);
        const localizedTitle = pickLocalizedValue(data, "title") || data.title;
        document.title = `${localizedTitle} - ${t("publicHome.brand")}`;
      } catch (e: any) {
        setError(e?.message || "Failed to load page");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [slug]);

  return (
    <PublicPageLayout>
      {loading ? (
        <div className="rounded-2xl border bg-white p-8 text-center text-slate-600">{t("publicHome.common.loading")}</div>
      ) : error || !page ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-red-700">
          {t("publicHome.common.error")}: {error || "Page not found"}
        </div>
      ) : (
        (() => {
          const localizedTitle = pickLocalizedValue(page, "title") || page.title;
          const localizedSummary = pickLocalizedValue(page, "summary");
          const localizedContentHtml = pickLocalizedValue(page, "content_html");
          return (
        <>
          <section className="rounded-2xl border bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm">
            <h1 className="text-3xl font-semibold text-slate-900">{localizedTitle}</h1>
            {localizedSummary && <p className="mt-2 text-sm leading-7 text-slate-700">{localizedSummary}</p>}
          </section>

          {localizedContentHtml ? (
            <section className="rounded-2xl border bg-white p-6 shadow-sm">
              <div className="public-rich-text" dangerouslySetInnerHTML={{ __html: localizedContentHtml }} />
            </section>
          ) : page.blocks.map((block) => {
            if (block.type === "image") {
              return (
                <section key={block.id} className="rounded-2xl border bg-white p-6 shadow-sm">
                  {block.title && <h2 className="text-xl font-semibold text-slate-900">{block.title}</h2>}
                  {block.image_url && (
                    <img
                      src={block.image_url}
                      alt={block.title || page.title}
                      className="mt-4 max-h-[420px] w-full rounded-2xl border object-cover"
                    />
                  )}
                  {block.body && <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">{block.body}</p>}
                </section>
              );
            }

            if (block.type === "hero") {
              return (
                <section key={block.id} className="rounded-2xl border bg-[color:var(--public-accent)] p-8 text-white shadow-sm">
                  {block.title && <h2 className="text-3xl font-semibold">{block.title}</h2>}
                  {block.body && <p className="mt-3 whitespace-pre-wrap text-base leading-8 text-white/85">{block.body}</p>}
                  <div className="mt-5">
                    <ActionLink href={block.link_url} label={block.link_label || t("publicHome.common.go")} />
                  </div>
                </section>
              );
            }

            if (block.type === "cta") {
              return (
                <section key={block.id} className="rounded-2xl border bg-white p-6 shadow-sm">
                  {block.title && <h2 className="text-xl font-semibold text-slate-900">{block.title}</h2>}
                  {block.body && <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">{block.body}</p>}
                  <div className="mt-5">
                    <ActionLink href={block.link_url} label={block.link_label || "Открыть"} />
                  </div>
                </section>
              );
            }

            return (
              <section key={block.id} className="rounded-2xl border bg-white p-6 shadow-sm">
                {block.title && <h2 className="text-xl font-semibold text-slate-900">{block.title}</h2>}
                {block.body && <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">{block.body}</div>}
                {block.image_url && (
                  <img
                    src={block.image_url}
                    alt={block.title || page.title}
                    className="mt-4 max-h-[420px] w-full rounded-2xl border object-cover"
                  />
                )}
              </section>
            );
          })}
        </>
          );
        })()
      )}
    </PublicPageLayout>
  );
}
