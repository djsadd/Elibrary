import { useEffect } from "react";
import { PublicPageLayout } from "@/components/layout/PublicPageLayout";
import { t } from "@/shared/i18n";

export default function UdcBbkPage() {
  useEffect(() => {
    document.title = "Индекс УДК/ББК - TAU";
  }, []);

  return (
    <PublicPageLayout>
      <section className="rounded-2xl border bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">Индекс УДК/ББК</h1>
        <p className="mt-2 text-sm leading-7 text-slate-700">Как получить индекс на статью или издание.</p>
      </section>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <p className="text-sm leading-7 text-slate-700">{t("publicHome.common.comingSoon")}</p>
      </section>
    </PublicPageLayout>
  );
}

