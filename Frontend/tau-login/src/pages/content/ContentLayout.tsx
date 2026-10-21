import DashboardHeader from "@/components/layout/DashboardHeader";
import { NavLink, Outlet } from "react-router-dom";

import { t } from "@/shared/i18n";

const tabs = [
  { to: "pages", label: () => t("admin.nav.pages") },
  { to: "menu", label: () => t("admin.nav.menu") },
] as const;

export default function ContentLayout() {
  return (
    <div className="workspace-section space-y-4">
      <DashboardHeader/>
      <div className="page-heading"><h1>{t("nav.content")}</h1></div>

      <nav className="workspace-tabs border-b">
        <div className="flex flex-wrap gap-2 pb-3">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
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
