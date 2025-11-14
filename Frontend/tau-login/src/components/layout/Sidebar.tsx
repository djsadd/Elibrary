import { Link, useLocation } from "react-router-dom";
import logo from "@/assets/images/Logo.svg";
import { t } from "@/shared/i18n";
import { MobileDashboardHeader } from "./DashboardHeader";
import { useAuth } from "@/shared/auth/AuthContext";

export default function Sidebar() {
  const loc = useLocation();
  const { token } = useAuth();

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
  const isAdmin = roles.some((r) => /^(admin|librarian)$/i.test(String(r)));

  const items = [
    { to: "/", label: t('nav.home'), icon: HomeIcon },
    { to: "/catalog", label: t('nav.catalog'), icon: CatalogIcon },
    { to: "/shelf", label: t('nav.shelf'), icon: ShelfIcon },
    { to: "/favorites", label: t('nav.favorites'), icon: HeartIcon },
    ...(isAdmin ? [{ to: "/admin", label: t('nav.admin'), icon: AdminIcon }] : [] as any),
    { to: "/profile", label: t('nav.profile'), icon: UserIcon },
    { to: "#", label: t('nav.contribute'), icon: ContributeIcon },
  ];

  return (
    <div className="h-full flex flex-col justify-between bg-white">
      <div>
        {/* logo area - centered */}
        <div className="px-6 pt-8 pb-6 flex items-center justify-center">
          {logo ? (
            <img src={logo} alt="TAU" className="w-20 h-auto" />
          ) : (
            <div className="text-2xl font-bold text-[#7b0f2b]">TAU</div>
          )}
        </div>

        {/* mobile header controls - moved from top header into sidebar on mobile */}
        <MobileDashboardHeader />

        {/* menu */}
        <nav className="px-3 sm:px-4">
          <ul className="space-y-1.5">
            {items.map((it) => {
              const active = it.to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(it.to);
              return (
                <li key={it.label}>
                  <Link
                    to={it.to}
                    className={`flex items-center gap-3 px-4 py-3 sm:px-6 rounded-md transition-colors text-base sm:text-sm ${active ? 'text-[#7b0f2b] bg-slate-50 font-medium' : 'text-slate-600 hover:text-[#7b0f2b] hover:bg-slate-50'}`}
                  >
                    <span className="w-5 h-5 flex items-center justify-center">
                      <it.icon className={active ? 'w-6 h-6 sm:w-5 sm:h-5 text-[#7b0f2b]' : 'w-6 h-6 sm:w-5 sm:h-5 text-slate-400'} />
                    </span>
                    <span>{it.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      <div className="px-4 sm:px-6 py-6 sm:py-8 text-sm text-slate-400">
        <div className="space-y-2">
          <div className="hover:text-slate-600 cursor-pointer">About</div>
          <div className="hover:text-slate-600 cursor-pointer">Support</div>
          <div className="hover:text-slate-600 cursor-pointer">Terms & Condition</div>
        </div>
      </div>
    </div>
  );
}

function HomeIcon({ className = "", ...props }: any) {
  return (
    <svg {...props} className={`${className}`} viewBox="0 0 24 24" fill="currentColor"><path d="M3 12l9-9 9 9v8a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-8z"/></svg>
  );
}

function SearchIcon({ className = "", ...props }: any) {
  return (
    <svg {...props} className={`${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35"/></svg>
  );
}

function CatalogIcon({ className = "", ...props }: any) {
  return (
    <svg {...props} className={`${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <path d="M4 5a2 2 0 0 1 2-2h6v16H6a2 2 0 0 1-2-2V5z" />
      <path d="M20 5a2 2 0 0 0-2-2h-6v16h6a2 2 0 0 0 2-2V5z" />
      <path d="M8 6h2" />
      <path d="M16 6h-2" />
    </svg>
  );
}

function ShelfIcon({ className = "", ...props }: any) {
  return (
    <svg {...props} className={`${className}`} viewBox="0 0 24 24" fill="currentColor"><path d="M3 6h18v2H3zM3 11h18v2H3zM3 16h18v2H3z"/></svg>
  );
}

function ContributeIcon({ className = "", ...props }: any) {
  return (
    <svg {...props} className={`${className}`} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zM11 6h2v6h-2V6zm0 8h2v2h-2v-2z"/></svg>
  );
}

function AdminIcon({ className = "", ...props }: any) {
  return (
    <svg {...props} className={`${className}`} viewBox="0 0 24 24" fill="currentColor"><path d="M4 5h16v2H4V5zm0 4h16v10H4V9zm2 2v6h12v-6H6z"/></svg>
  );
}

function UserIcon({ className = "", ...props }: any) {
  return (
    <svg {...props} className={`${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5z" />
      <path d="M4 22c0-4.418 3.582-8 8-8s8 3.582 8 8" />
    </svg>
  );
}

function HeartIcon({ className = "", ...props }: any) {
  return (
    <svg {...props} className={`${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.41 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.41 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  );
}
