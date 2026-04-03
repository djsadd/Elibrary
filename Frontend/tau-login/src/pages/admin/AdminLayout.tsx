import { NavLink, Outlet, useLocation } from "react-router-dom";

import DashboardHeader from "../../components/layout/DashboardHeader";
import { t } from "@/shared/i18n";
import { useAuth } from "@/shared/auth/AuthContext";

const nav = [
  { to: "/admin", label: () => t("admin.nav.overview"), end: true },
  { to: "/admin/articles/quick", label: () => "Quick Article" },
  { to: "/admin/books", label: () => t("admin.nav.books") },
  { to: "/admin/books/new", label: () => t("admin.nav.addBook") },
  { to: "/admin/playlists", label: () => t("admin.nav.playlists") },
  { to: "/admin/playlists/new", label: () => t("admin.nav.addPlaylist") },
  { to: "/admin/authors", label: () => t("admin.nav.authors") },
  { to: "/admin/subjects", label: () => t("admin.nav.subjects") },
  { to: "/admin/files", label: () => t("admin.nav.files") },
  { to: "/admin/users", label: () => t("admin.nav.users") },
  { to: "/admin/roles", label: () => t("admin.nav.roles") },
  { to: "/admin/reports", label: () => t("admin.nav.reports") },
  { to: "/admin/integrations", label: () => t("admin.nav.integrations") },
  { to: "/admin/settings", label: () => t("admin.nav.settings") },
  { to: "/admin/protection", label: () => t("admin.nav.protection") },
] as const;

export default function AdminLayout() {
  const location = useLocation();
  const { token } = useAuth();

  const roles = (() => {
    if (!token) return [];
    try {
      const parts = token.split(".");
      if (parts.length < 2) return [];
      const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
      const value = payload?.roles;
      if (Array.isArray(value)) return value.map((item: unknown) => String(item));
      if (typeof value === "string") return [value];
      return [];
    } catch {
      return [];
    }
  })();
  const isAdmin = roles.some((role) => /^admin$/i.test(String(role)));
  const visibleNav = nav.filter((item) => !("adminOnly" in item) || isAdmin);

  return (
    <div className="space-y-4">
      <DashboardHeader />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        <aside className="md:col-span-3 lg:col-span-2">
          <nav className="divide-y rounded-md border bg-white p-2">
            <div className="grid grid-cols-2 gap-2 md:block md:gap-0">
              {visibleNav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={"end" in item ? item.end : undefined}
                  className={({ isActive }) =>
                    `block rounded-md px-3 py-2 text-sm hover:bg-slate-50 ${
                      isActive || location.pathname.startsWith(item.to)
                        ? "bg-slate-100 font-medium text-slate-900"
                        : "text-slate-600"
                    }`
                  }
                >
                  {typeof item.label === "function" ? item.label() : item.label}
                </NavLink>
              ))}
            </div>
          </nav>
        </aside>

        <main className="md:col-span-9 lg:col-span-10">
          <div className="rounded-md border bg-white p-4">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
