import { useState } from "react";
import { Link } from "react-router-dom";

export interface NavDropdownItem {
  label: string;
  to?: string;
  href?: string;
  external?: boolean;
}

interface NavDropdownProps {
  label: string;
  items: NavDropdownItem[];
  variant?: "default" | "inverse";
}

export function NavDropdown({ label, items, variant = "default" }: NavDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonClassName =
    variant === "inverse"
      ? "flex items-center gap-2 rounded-xl px-4 py-2 text-base font-medium text-white/90 hover:bg-white/10 hover:text-white transition"
      : "flex items-center gap-2 rounded-xl px-4 py-2 text-base font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition";

  return (
    <div className="relative inline-block">
      <button onClick={() => setIsOpen(!isOpen)} className={buttonClassName}>
        {label}
        <svg
          className={`h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 bg-white border border-[color:var(--public-border)] rounded-xl shadow-xl z-50">
          <div className="p-2 min-w-64">
            {items.map((item) => (
              item.external || (item.href && /^https?:\/\//i.test(item.href)) ? (
                <a
                  key={item.href || item.label}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setIsOpen(false)}
                  className="block w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-100 hover:text-[color:var(--public-accent)] rounded-lg transition-colors"
                >
                  {item.label}
                </a>
              ) : (
                <Link
                  key={item.to || item.href || item.label}
                  to={item.to || item.href || "#"}
                  onClick={() => setIsOpen(false)}
                  className="block w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-100 hover:text-[color:var(--public-accent)] rounded-lg transition-colors"
                >
                  {item.label}
                </Link>
              )
            ))}
          </div>
        </div>
      )}

      {isOpen && <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />}
    </div>
  );
}
