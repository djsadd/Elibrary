import { t } from "@/shared/i18n";

export default function AnalyticsUsersPage() {
  return (
    <div className="space-y-2">
      <h3 className="text-base font-semibold text-slate-800">{t("analytics.tabs.users")}</h3>
      <div className="text-sm text-slate-500">{t("analytics.empty")}</div>
    </div>
  );
}

