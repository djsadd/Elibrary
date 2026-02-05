import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { PublicPageLayout } from "@/components/layout/PublicPageLayout";
import { t } from "@/shared/i18n";

export default function AboutPage() {
  const [aboutData, setAboutData] = useState<{
    founded_date: string;
    mission: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = `${t("publicHome.nav.about")} - ${t("publicHome.brand")}`;
  }, []);

  useEffect(() => {
    const fetchAboutData = async () => {
      try {
        const response = await fetch("/api/catalog/about");
        if (!response.ok) throw new Error("Failed to fetch about information");
        const data = await response.json();
        setAboutData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchAboutData();
  }, []);

  return (
    <PublicPageLayout>
      <section className="rounded-2xl border bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">{t("publicHome.nav.about")}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-700">{t("publicHome.about.intro")}</p>
      </section>

      {loading && (
        <div className="rounded-2xl border bg-white p-8 shadow-sm text-center">
          <p className="text-slate-600">{t("publicHome.common.loading")}</p>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm">
          <p className="text-red-800">{t("publicHome.common.error")}: {error}</p>
        </div>
      )}

      {aboutData && !loading && (
        <>
          <section className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">{t("publicHome.about.historyTitle")}</h2>
            <p className="mt-4 text-sm leading-7 text-slate-700">{aboutData.founded_date}</p>
          </section>

          <section className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">{t("publicHome.about.missionTitle")}</h2>
            <div className="mt-4 text-sm leading-7 text-slate-700 space-y-3">
              <p>{aboutData.mission}</p>
            </div>
          </section>
        </>
      )}

      <div className="rounded-2xl border bg-white p-6 shadow-sm text-center">
        <p className="text-sm text-slate-700 mb-4">{t("publicHome.about.catalogCta")}</p>
        <Link
          to="/auth/login"
          className="inline-block rounded-full bg-[color:var(--public-accent)] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[color:var(--public-accent-hover)]"
        >
          {t("publicHome.actions.login")}
        </Link>
      </div>
    </PublicPageLayout>
  );
}

