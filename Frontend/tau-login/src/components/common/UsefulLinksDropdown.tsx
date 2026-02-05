import { useState } from "react";
import { Link } from "react-router-dom";
import { t } from "@/shared/i18n";
import { USEFUL_LINK_CATEGORIES } from "@/shared/usefulLinks";

interface UsefulLinksDropdownProps {
  variant?: "header" | "section";
  basePath?: string;
  tone?: "default" | "inverse";
}

function normalizeBasePath(basePath: string) {
  return basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
}

export function UsefulLinksDropdown({
  variant = "section",
  basePath = "/links",
  tone = "default",
}: UsefulLinksDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const normalizedBasePath = normalizeBasePath(basePath);

  const headerButtonClassName =
    tone === "inverse"
      ? "flex items-center gap-2 rounded-xl px-4 py-2 text-base font-medium text-white/90 hover:bg-white/10 hover:text-white transition"
      : "flex items-center gap-2 rounded-xl px-4 py-2 text-base font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition";

  if (variant === "header") {
    return (
      <div className="relative inline-block">
        <button onClick={() => setIsOpen(!isOpen)} className={headerButtonClassName} type="button">
          {t("publicHome.nav.links")}
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
          <div
            className="absolute top-full left-0 mt-2 bg-white border border-[color:var(--public-border)] rounded-xl shadow-xl z-50"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-2">
              {USEFUL_LINK_CATEGORIES.map((cat) => (
                <Link
                  key={cat.id}
                  to={`${normalizedBasePath}/${cat.id}`}
                  onClick={() => setIsOpen(false)}
                  className="block w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-100 hover:text-[color:var(--public-accent)] rounded-lg transition-colors"
                >
                  {t(cat.labelKey)}
                </Link>
              ))}
            </div>
          </div>
        )}

        {isOpen && <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />}
      </div>
    );
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--public-border)] bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-[color:var(--public-surface-muted)]"
        type="button"
      >
        {t("publicHome.nav.links")}
        <svg
          className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {isOpen && (
        <div
          className="absolute top-full left-0 mt-2 bg-white border border-[color:var(--public-border)] rounded-xl shadow-xl z-50"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-2">
            {USEFUL_LINK_CATEGORIES.map((cat) => (
              <Link
                key={cat.id}
                to={`${normalizedBasePath}/${cat.id}`}
                onClick={() => setIsOpen(false)}
                className="block w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-100 hover:text-[color:var(--public-accent)] rounded-lg transition-colors"
              >
                {t(cat.labelKey)}
              </Link>
            ))}
          </div>
        </div>
      )}

      {isOpen && <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />}
    </div>
  );
}
