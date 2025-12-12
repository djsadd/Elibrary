import { ChangeEvent } from "react";
import { getLang } from "@/shared/i18n";

const LANGS = [
  { code: "en", label: "English" },
  { code: "ru", label: "Русский" },
  { code: "kk", label: "Қазақша" },
];

export default function LanguageSwitcher({ className }: { className?: string }) {
  const currentLang = getLang();

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value;
    if (typeof window === "undefined") return;
    localStorage.setItem("ui_lang", next);
    try {
      window.dispatchEvent(new Event("lang:changed"));
    } catch {}
    window.location.reload();
  };

  return (
    <div className={`flex items-center gap-2 text-xs text-slate-500 ${className || ""}`}>
      <span className="hidden sm:inline">Language</span>
      <select
        value={currentLang}
        onChange={handleChange}
        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-medium text-xs text-slate-700 shadow-sm focus:border-[#7b0f2b] focus:ring-1 focus:ring-[#7b0f2b]"
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
