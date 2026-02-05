import { useEffect } from "react";
import { Link } from "react-router-dom";
import { PublicPageLayout } from "@/components/layout/PublicPageLayout";
import { t } from "@/shared/i18n";

function FeatureCard({
  title,
  body,
  to,
  icon,
}: {
  title: string;
  body: string;
  to: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className="group rounded-3xl border border-slate-200 bg-white p-8 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start gap-4">
        <div className="rounded-2xl bg-[color:var(--public-surface-muted)] p-4 text-[color:var(--public-accent)]">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-xl font-semibold text-slate-900">{title}</div>
          <div className="mt-2 text-base leading-7 text-slate-700">{body}</div>
          <div className="mt-4 text-sm font-semibold text-[color:var(--public-accent)] group-hover:underline">
            {t("publicHome.common.go")} →
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function PublicHomePage() {
  useEffect(() => {
    document.title = t("publicHome.title");
  }, []);

  const hero = (
    <div>
      <section className="bg-[color:var(--public-accent)] text-white">
        <div className="mx-auto w-full max-w-7xl xl:max-w-screen-2xl px-4 py-20 sm:py-24 text-center">
          <h1 className="text-5xl sm:text-6xl font-semibold tracking-tight">{t("publicHome.subtitle")}</h1>
          <p className="mx-auto mt-6 max-w-4xl text-base sm:text-lg leading-8 text-white/80">
            {t("publicHome.hero.subtitle")}
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/auth/login"
              className="w-full sm:w-auto rounded-2xl bg-white px-10 py-4 text-lg font-semibold text-[color:var(--public-accent)] hover:bg-white/90 shadow-sm"
            >
              {t("publicHome.hero.cta")}
            </Link>
            <Link
              to="/public/resources"
              className="w-full sm:w-auto rounded-2xl border border-white/35 bg-white/10 px-10 py-4 text-lg font-semibold text-white hover:bg-white/15"
            >
              {t("publicHome.hero.learnMore")}
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto w-full max-w-7xl xl:max-w-screen-2xl px-4 py-14">
          <div className="grid gap-6 md:grid-cols-3">
            <FeatureCard
              title={t("publicHome.sections.teachers.title")}
              body={t("publicHome.sections.teachers.body")}
              to="/public/teachers"
              icon={
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M4 6.5l8-3 8 3v9l-8 3-8-3v-9z" />
                  <path d="M12 3.5v15" />
                </svg>
              }
            />
            <FeatureCard
              title={t("publicHome.sections.students.title")}
              body={t("publicHome.sections.students.body")}
              to="/public/students"
              icon={
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 3l9 5-9 5-9-5 9-5z" />
                  <path d="M21 10v6" />
                  <path d="M3 10v6c0 1.7 4 4 9 4s9-2.3 9-4v-6" />
                </svg>
              }
            />
            <FeatureCard
              title={t("publicHome.sections.resources.title")}
              body={t("publicHome.sections.resources.cards.guides.body")}
              to="/public/resources"
              icon={
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 0-3 3V4z" />
                  <path d="M8 20h11" />
                </svg>
              }
            />
          </div>
        </div>
      </section>
    </div>
  );

  return (
    <PublicPageLayout hero={hero} maxWidthClassName="max-w-7xl xl:max-w-screen-2xl" />
  );
}
