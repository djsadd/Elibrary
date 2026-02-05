import { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { PublicPageLayout } from "@/components/layout/PublicPageLayout";
import { t } from "@/shared/i18n";
import { USEFUL_LINK_CATEGORIES, USEFUL_LINKS_BY_CATEGORY, isUsefulLinkCategoryId } from "@/shared/usefulLinks";

export default function UsefulLinksPage() {
  const params = useParams<{ category?: string }>();
  const category = isUsefulLinkCategoryId(params.category) ? params.category : "misc";

  useEffect(() => {
    document.title = `${t("publicHome.nav.links")} - ${t("publicHome.brand")}`;
  }, []);

  const currentCategory = USEFUL_LINK_CATEGORIES.find((c) => c.id === category);
  const currentCategoryLabel = currentCategory ? t(currentCategory.labelKey) : t("publicHome.nav.links");
  const links = USEFUL_LINKS_BY_CATEGORY[category];

  return (
    <PublicPageLayout maxWidthClassName="max-w-7xl xl:max-w-screen-2xl">
      <section className="rounded-2xl border bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">{t("publicHome.nav.links")}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-700">{currentCategoryLabel}</p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-2">
          {USEFUL_LINK_CATEGORIES.map((cat) => (
            <Link
              key={cat.id}
              to={`/links/${cat.id}`}
              className={[
                "block px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                category === cat.id
                  ? "bg-[color:var(--public-accent)] text-white"
                  : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50",
              ].join(" ")}
            >
              {t(cat.labelKey)}
            </Link>
          ))}
        </aside>

        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          {links.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">{t("publicHome.usefulLinks.table.title")}</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-900">{t("publicHome.usefulLinks.table.link")}</th>
                  </tr>
                </thead>
                <tbody>
                  {links.map((link, idx) => (
                    <tr key={idx} className="border-b last:border-b-0 hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-4 text-sm text-slate-700">{link.title}</td>
                      <td className="py-4 px-4 text-right">
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[color:var(--public-accent)] hover:text-[color:var(--public-accent-hover)] hover:underline text-sm font-medium"
                        >
                          {t("publicHome.usefulLinks.go")} →
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">
              <p className="text-sm">{t("publicHome.usefulLinks.empty")}</p>
            </div>
          )}
        </section>
      </div>
    </PublicPageLayout>
  );
}

