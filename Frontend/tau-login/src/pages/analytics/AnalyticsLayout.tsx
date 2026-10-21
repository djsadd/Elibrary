import DashboardHeader from "@/components/layout/DashboardHeader";
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
    <div className="workspace-section space-y-4">
      <DashboardHeader/>
      <div className="page-heading"><h1>{t("nav.analytics")}</h1></div>

      <nav className="workspace-tabs border-b">
        <div className="flex flex-wrap gap-2 pb-3">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={"end" in tab ? tab.end : undefined}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md text-sm border ${
                  isActive ? "bg-[#b51e3e] text-white border-[#b51e3e]" : "bg-white text-slate-700 hover:bg-slate-50"
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
