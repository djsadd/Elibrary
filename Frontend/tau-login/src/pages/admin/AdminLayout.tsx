import { NavLink, Outlet, useLocation } from "react-router-dom";
import DashboardHeader from "../../components/layout/DashboardHeader";
import { t } from "@/shared/i18n";

const nav = [
  { to: "/admin", label: () => t('admin.nav.overview'), end: true },
  { to: "/admin/books", label: () => t('admin.nav.books') },
  { to: "/admin/books/new", label: () => t('admin.nav.addBook') },
  { to: "/admin/playlists", label: () => t('admin.nav.playlists') },
  { to: "/admin/playlists/new", label: () => t('admin.nav.addPlaylist') },
  { to: "/admin/authors", label: () => t('admin.nav.authors') },
  { to: "/admin/subjects", label: () => t('admin.nav.subjects') },
  { to: "/admin/files", label: () => t('admin.nav.files') },
  { to: "/admin/users", label: () => t('admin.nav.users') },
  { to: "/admin/roles", label: () => t('admin.nav.roles') },
  { to: "/admin/reports", label: () => t('admin.nav.reports') },
  { to: "/admin/settings", label: () => t('admin.nav.settings') },
] as const;

export default function AdminLayout() {
  const location = useLocation();
  return (
    <div className="space-y-4">
      <DashboardHeader />
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <aside className="md:col-span-3 lg:col-span-2">
          <nav className="bg-white rounded-md p-2 divide-y border">
            <div className="grid grid-cols-2 md:block gap-2 md:gap-0">
              {nav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end as any}
                  className={({ isActive }) =>
                    `block px-3 py-2 rounded-md text-sm hover:bg-slate-50 ${
                      isActive || location.pathname.startsWith(item.to)
                        ? 'bg-slate-100 text-slate-900 font-medium'
                        : 'text-slate-600'
                    }`
                  }
                >
                  {typeof item.label === 'function' ? item.label() : item.label}
                </NavLink>
              ))}
            </div>
          </nav>
        </aside>
        <main className="md:col-span-9 lg:col-span-10">
          <div className="bg-white rounded-md p-4 border">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
