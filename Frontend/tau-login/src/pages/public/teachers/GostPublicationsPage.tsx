import { useEffect } from "react";
import { PublicPageLayout } from "@/components/layout/PublicPageLayout";
import { t } from "@/shared/i18n";

export default function GostPublicationsPage() {
  useEffect(() => {
    document.title = "ГОСТы на оформление научных публикаций - TAU";
  }, []);

  return (
    <PublicPageLayout>
      <section className="rounded-2xl border bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">ГОСТы на оформление научных публикаций</h1>
        <p className="mt-2 text-sm leading-7 text-slate-700">Требования, стили оформления и примеры.</p>
      </section>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <p className="text-sm leading-7 text-slate-700">{t("publicHome.common.comingSoon")}</p>
      </section>
    </PublicPageLayout>
  );
}

