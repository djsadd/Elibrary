import { useEffect } from "react";
import { Link } from "react-router-dom";
import { PublicPageLayout } from "@/components/layout/PublicPageLayout";
import { t } from "@/shared/i18n";

export default function PublicResourcesPage() {
  useEffect(() => {
    document.title = `${t("publicHome.nav.resources")} - TAU`;
  }, []);

  return (
    <PublicPageLayout>
        <section className="rounded-2xl border bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm">
          <h1 className="text-3xl font-semibold text-slate-900">{t("publicHome.sections.resources.title")}</h1>
          <p className="mt-2 text-sm leading-7 text-slate-700">{t("publicHome.sections.resources.body")}</p>
        </section>

        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">
                {t("publicHome.sections.resources.cards.guides.title")}
              </div>
              <div className="mt-1 text-sm text-slate-700">{t("publicHome.sections.resources.cards.guides.body")}</div>
            </div>
            <div className="rounded-xl border bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">
                {t("publicHome.sections.resources.cards.databases.title")}
              </div>
              <div className="mt-1 text-sm text-slate-700">
                {t("publicHome.sections.resources.cards.databases.body")}
              </div>
            </div>
            <div className="rounded-xl border bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">
                {t("publicHome.sections.resources.cards.citations.title")}
              </div>
              <div className="mt-1 text-sm text-slate-700">
                {t("publicHome.sections.resources.cards.citations.body")}
              </div>
            </div>
            <div className="rounded-xl border bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">
                {t("publicHome.sections.resources.cards.contacts.title")}
              </div>
              <div className="mt-1 text-sm text-slate-700">
                {t("publicHome.sections.resources.cards.contacts.body")}
              </div>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              to="/auth/login"
              className="rounded-full bg-[color:var(--public-accent)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[color:var(--public-accent-hover)]"
            >
              {t("publicHome.actions.login")}
            </Link>
            <Link
              to="/public"
              className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              {t("publicHome.nav.home")}
            </Link>
          </div>
        </section>
    </PublicPageLayout>
  );
}
