import { NavLink, Outlet } from "react-router-dom";

import { t } from "@/shared/i18n";

const tabs = [
  { to: "pages", label: () => t("admin.nav.pages") },
  { to: "menu", label: () => t("admin.nav.menu") },
] as const;

export default function ContentLayout() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t("nav.content")}</h2>
      </div>

      <nav className="border-b">
        <div className="flex flex-wrap gap-2 pb-3">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
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
