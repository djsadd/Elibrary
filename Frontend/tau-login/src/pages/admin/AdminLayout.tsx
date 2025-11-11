import { NavLink, Outlet, useLocation } from "react-router-dom";
import DashboardHeader from "../../components/layout/DashboardHeader";

const nav = [
  { to: "/admin", label: "Overview", end: true },
  { to: "/admin/books", label: "Books" },
  { to: "/admin/books/new", label: "Add Book" },
  { to: "/admin/playlists", label: "Playlists" },
  { to: "/admin/playlists/new", label: "Add Playlist" },
  { to: "/admin/authors", label: "Authors" },
  { to: "/admin/subjects", label: "Subjects" },
  { to: "/admin/files", label: "Files" },
  { to: "/admin/users", label: "Users" },
  { to: "/admin/roles", label: "Roles" },
  { to: "/admin/reports", label: "Reports" },
  { to: "/admin/settings", label: "Settings" },
];

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
                  {item.label}
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
