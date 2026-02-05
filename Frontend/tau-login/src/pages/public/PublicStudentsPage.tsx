import { useEffect } from "react";
import { Link } from "react-router-dom";
import { PublicPageLayout } from "@/components/layout/PublicPageLayout";
import { t } from "@/shared/i18n";

export default function PublicStudentsPage() {
  useEffect(() => {
    document.title = `${t("publicHome.nav.students")} - TAU`;
  }, []);

  return (
    <PublicPageLayout>
      <section className="rounded-2xl border bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">{t("publicHome.sections.students.title")}</h1>
        <p className="mt-2 text-sm leading-7 text-slate-700">{t("publicHome.sections.students.body")}</p>
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
          <Link
            to="/public/students/database-instructions"
            className="rounded-xl border bg-slate-50 p-4 hover:bg-slate-100"
          >
            <div className="text-sm font-semibold text-slate-900">Инструкции по базам данных</div>
            <div className="mt-1 text-sm text-slate-700">Руководства по работе с ресурсами.</div>
          </Link>
          <Link to="/public/students/bibliographic-list" className="rounded-xl border bg-slate-50 p-4 hover:bg-slate-100">
            <div className="text-sm font-semibold text-slate-900">Библиографический список литературы</div>
            <div className="mt-1 text-sm text-slate-700">Как правильно оформить список.</div>
          </Link>
          <Link to="/public/students/udc-bbk" className="rounded-xl border bg-slate-50 p-4 hover:bg-slate-100">
            <div className="text-sm font-semibold text-slate-900">Индекс УДК/ББК</div>
            <div className="mt-1 text-sm text-slate-700">Как получить индекс на статью или издание.</div>
          </Link>
          <Link to="/public/students/lost-book" className="rounded-xl border bg-slate-50 p-4 hover:bg-slate-100">
            <div className="text-sm font-semibold text-slate-900">Утрата библиотечной книги</div>
            <div className="mt-1 text-sm text-slate-700">Что делать в случае утраты.</div>
          </Link>
          <Link to="/public/students/digital-copies" className="rounded-xl border bg-slate-50 p-4 hover:bg-slate-100">
            <div className="text-sm font-semibold text-slate-900">Цифровые копии книг</div>
            <div className="mt-1 text-sm text-slate-700">Как получить доступ к копиям.</div>
          </Link>
          <Link to="/public/students/reading-room" className="rounded-xl border bg-slate-50 p-4 hover:bg-slate-100">
            <div className="text-sm font-semibold text-slate-900">Читальный зал</div>
            <div className="mt-1 text-sm text-slate-700">Как получить книгу в читальном зале.</div>
          </Link>
        </div>
      </section>
    </PublicPageLayout>
  );
}

