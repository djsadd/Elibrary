import { NavLink, Outlet } from "react-router-dom";
import { t } from "@/shared/i18n";

const tabs = [
  { to: "", label: () => t("analytics.tabs.overview"), end: true },
  { to: "users", label: () => t("analytics.tabs.users") },
  { to: "traffic", label: () => t("analytics.tabs.traffic") },
  { to: "books", label: () => t("analytics.tabs.books") },
] as const;

export default function AnalyticsLayout() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t("nav.analytics")}</h2>
      </div>

      <nav className="border-b">
        <div className="flex flex-wrap gap-2 pb-3">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={"end" in tab ? tab.end : undefined}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md text-sm border ${
                  isActive ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 hover:bg-slate-50"
                }`
              }
            >
              {tab.label()}
            </NavLink>
          ))}
        </div>
      </nav>

      <Outlet />
    </div>
  );
}
