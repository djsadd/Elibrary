import LibraryBrand from "@/components/common/LibraryBrand";
import { designCopy } from "@/shared/designCopy";
import { useSidebar } from "@/shared/SidebarContext";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { t } from "@/shared/i18n";
import { MobileDashboardHeader } from "./DashboardHeader";
import { useAuth } from "@/shared/auth/AuthContext";

export default function Sidebar() {
  const loc = useLocation();
  const { close } = useSidebar();
  const { token, logout } = useAuth();
  const navigate = useNavigate();

  function rolesFromToken(t: string | null): string[] {
    if (!t) return [];
    try {
      const parts = t.split(".");
      if (parts.length < 2) return [];
      const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
      const r = payload?.roles;
      if (!r) return [];
      if (Array.isArray(r)) return r.map((x) => String(x));
      if (typeof r === "string") return [r];
      return [];
    } catch {
      return [];
    }
  }

  const roles = rolesFromToken(token);
  const isContentAdmin = roles.some(r => /^admin$/i.test(r));
  const isAdmin = roles.some((r) => /^(admin|librarian)$/i.test(String(r)));

  const items = [
    
    { to: "/", label: t("nav.home"), icon: HomeIcon },
    { to: "/catalog", label: t("nav.catalog"), icon: CatalogIcon },
    { to: "/shelf", label: t("nav.shelf"), icon: ShelfIcon },
    { to: "/favorites", label: t("nav.favorites"), icon: HeartIcon },
    ...(isAdmin
      ? ([
          { to: "/admin", label: t("nav.admin"), icon: AdminIcon },
          { to: "/analytics", label: t("nav.analytics"), icon: AnalyticsIcon },
          ...(isContentAdmin ? [{ to: "/content", label: t("nav.content"), icon: ContentIcon }] : []),
        ] as any)
      : ([] as any)),
    { to: "/intelligent-search", label: t("header.search.ariaLabel"), icon: SearchIcon },
    { to: "/profile", label: t("nav.profile"), icon: UserIcon },
  ];

  return (
    <div className="library-sidebar">
      <Link to="/" className="sidebar-brand" onClick={close}><LibraryBrand/></Link>
      <MobileDashboardHeader />
      <div className="sidebar-label">{designCopy().workspace}</div>
      <nav aria-label={designCopy().navigation}><ul>{items.map((it) => {
        const active = it.to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(it.to);
        return <li key={it.to}><Link to={it.to} onClick={close} aria-current={active ? 'page' : undefined} className={`sidebar-link ${active ? 'is-active' : ''}`}><it.icon className="sidebar-icon"/><span>{it.label}</span>{active && <span className="sidebar-active-dot"/>}</Link></li>;
      })}</ul></nav>
      <div className="sidebar-bottom"><Link to="/public" onClick={close}>{designCopy().back}</Link><button className="sidebar-logout" onClick={() => { logout(); close(); navigate("/auth/login"); }}>{designCopy().logout}</button><small>{designCopy().university}</small></div>
    </div>
  );
}

function HomeIcon({ className = "", ...props }: any) {
  return (
    <svg
      {...props}
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M3 12l9-9 9 9v8a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-8z" />
    </svg>
  );
}

function GlobeIcon({ className = "", ...props }: any) {
  return (
    <svg {...props} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" strokeLinecap="round" />
      <path d="M12 3c2.8 2.9 4.2 6 4.2 9S14.8 18.1 12 21c-2.8-2.9-4.2-6-4.2-9S9.2 5.9 12 3Z" />
    </svg>
  );
}

function SearchIcon({ className = "", ...props }: any) {
  return (
    <svg
      {...props}
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 21l-4.35-4.35"
      />
      <circle cx="10" cy="10" r="6" />
    </svg>
  );
}

function CatalogIcon({ className = "", ...props }: any) {
  return (
    <svg
      {...props}
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
    >
      <path d="M4 5a2 2 0 0 1 2-2h6v16H6a2 2 0 0 1-2-2V5z" />
      <path d="M20 5a2 2 0 0 0-2-2h-6v16h6a2 2 0 0 0 2-2V5z" />
      <path d="M8 6h2" />
      <path d="M16 6h-2" />
    </svg>
  );
}

function ShelfIcon({ className = "", ...props }: any) {
  return (
    <svg
      {...props}
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M3 6h18v2H3zM3 11h18v2H3zM3 16h18v2H3z" />
    </svg>
  );
}

function ContributeIcon({ className = "", ...props }: any) {
  return (
    <svg
      {...props}
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M12 2a10 10 0 100 20 10 10 0 000-20zM11 6h2v6h-2V6zm0 8h2v2h-2v-2z" />
    </svg>
  );
}

function AdminIcon({ className = "", ...props }: any) {
  return (
    <svg
      {...props}
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M4 5h16v2H4V5zm0 4h16v10H4V9zm2 2v6h12v-6H6z" />
    </svg>
  );
}

function AnalyticsIcon({ className = "", ...props }: any) {
  return (
    <svg {...props} className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M4 19h16v2H4v-2zm2-8h3v6H6v-6zm5-4h3v10h-3V7zm5 2h3v8h-3V9z" />
    </svg>
  );
}

function ContentIcon({ className = "", ...props }: any) {
  return (
    <svg {...props} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
      <path d="M8 8h8M8 12h8M8 16h5" strokeLinecap="round" />
    </svg>
  );
}

function UserIcon({ className = "", ...props }: any) {
  return (
    <svg
      {...props}
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
    >
      <path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5z" />
      <path d="M4 22c0-4.418 3.582-8 8-8s8 3.582 8 8" />
    </svg>
  );
}

function HeartIcon({ className = "", ...props }: any) {
  return (
    <svg
      {...props}
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.41 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.41 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  );
}
