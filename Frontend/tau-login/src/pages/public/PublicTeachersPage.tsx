import { useEffect } from "react";
import { Link } from "react-router-dom";
import { PublicPageLayout } from "@/components/layout/PublicPageLayout";
import { t } from "@/shared/i18n";

export default function PublicTeachersPage() {
  useEffect(() => {
    document.title = `${t("publicHome.nav.teachers")} - TAU`;
  }, []);

  return (
    <PublicPageLayout>
      <section className="rounded-2xl border bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">{t("publicHome.sections.teachers.title")}</h1>
        <p className="mt-2 text-sm leading-7 text-slate-700">{t("publicHome.sections.teachers.body")}</p>
        <div className="mt-4 flex flex-wrap gap-3">
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

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">{t("publicHome.common.materials")}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Link to="/public/teachers/citation-index" className="rounded-xl border bg-slate-50 p-4 hover:bg-slate-100">
            <div className="text-sm font-semibold text-slate-900">Индекс цитирования</div>
            <div className="mt-1 text-sm text-slate-700">Справочная информация и рекомендации.</div>
          </Link>
          <Link to="/public/teachers/gost-publications" className="rounded-xl border bg-slate-50 p-4 hover:bg-slate-100">
            <div className="text-sm font-semibold text-slate-900">ГОСТы на оформление научных публикаций</div>
            <div className="mt-1 text-sm text-slate-700">Требования и примеры оформления.</div>
          </Link>
          <Link to="/public/teachers/acquisition-requests" className="rounded-xl border bg-slate-50 p-4 hover:bg-slate-100 sm:col-span-2">
            <div className="text-sm font-semibold text-slate-900">
              Порядок подачи заявок на приобретение литературы
            </div>
            <div className="mt-1 text-sm text-slate-700">Для фонда библиотеки.</div>
          </Link>
        </div>
      </section>
    </PublicPageLayout>
  );
}

