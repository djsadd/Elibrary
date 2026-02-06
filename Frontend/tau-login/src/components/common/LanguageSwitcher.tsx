import type { ChangeEvent } from "react";
import { getLang } from "@/shared/i18n";

const LANGS = [
  { code: "en", label: "English" },
  { code: "ru", label: "Русский" },
  { code: "kk", label: "Қазақша" },
];

export default function LanguageSwitcher({
  className,
  tone = "default",
}: {
  className?: string;
  tone?: "default" | "inverse";
}) {
  const currentLang = getLang();
  const textClassName = tone === "inverse" ? "text-white/80" : "text-slate-500";
  const selectClassName =
    tone === "inverse"
      ? "rounded-xl border border-white/25 bg-white/10 px-4 py-2 font-medium text-sm text-white shadow-sm focus:border-white focus:ring-1 focus:ring-white/50"
      : "rounded-xl border border-[color:var(--public-border)] bg-white px-4 py-2 font-medium text-sm text-slate-700 shadow-sm focus:border-[color:var(--public-accent)] focus:ring-1 focus:ring-[color:var(--public-accent)]";

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value;
    if (typeof window === "undefined") return;
    localStorage.setItem("ui_lang", next);
    try {
      window.dispatchEvent(new Event("lang:changed"));
    } catch {
      /* ignore */
    }
    window.location.reload();
  };

  return (
    <div className={`flex items-center gap-2 text-sm ${textClassName} ${className || ""}`}>
      <svg
        className="h-4 w-4 opacity-80"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
        <path d="M3 12h18" strokeLinecap="round" />
        <path d="M12 3c2.8 2.9 4.2 6 4.2 9S14.8 18.1 12 21c-2.8-2.9-4.2-6-4.2-9S9.2 5.9 12 3Z" />
      </svg>
      <select
        value={currentLang}
        onChange={handleChange}
        className={`${selectClassName} public-lang-select`}
        aria-label="Select language"
      >
        {LANGS.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.label}
          </option>
        ))}
      </select>
    </div>
  );
}
