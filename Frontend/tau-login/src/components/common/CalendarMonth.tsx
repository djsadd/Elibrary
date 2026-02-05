import { useMemo, useState } from "react";
import { getLang, t } from "@/shared/i18n";

function addMonths(date: Date, delta: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + delta);
  return d;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function localeFromLang(lang: string) {
  if (lang === "ru") return "ru-RU";
  if (lang === "kk") return "kk-KZ";
  return "en-US";
}

export default function CalendarMonth({ className }: { className?: string }) {
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => startOfMonth(today));
  const lang = getLang();
  const locale = localeFromLang(lang);

  const monthLabel = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(cursor);
    } catch {
      return `${cursor.getMonth() + 1}/${cursor.getFullYear()}`;
    }
  }, [cursor, locale]);

  const weekdayLabels = useMemo(() => {
    const base = new Date(2023, 0, 1); // Sunday
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      try {
        return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(d);
      } catch {
        return ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"][i]!;
      }
    });
  }, [locale]);

  const days = useMemo(() => {
    const first = startOfMonth(cursor);
    const last = endOfMonth(cursor);

    // Build a 6x7 grid (42 cells). Start from Sunday of the first week.
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - first.getDay());

    const cells: Array<{ date: Date; inMonth: boolean }> = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      cells.push({ date: d, inMonth: d >= first && d <= last });
    }
    return cells;
  }, [cursor]);

  return (
    <section className={`rounded-2xl border bg-white p-4 shadow-sm ${className || ""}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-slate-900">{t("publicHome.calendar.title")}</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCursor((d) => startOfMonth(addMonths(d, -1)))}
            className="rounded-full border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50 active:scale-[0.99]"
            aria-label={t("publicHome.calendar.prev")}
            title={t("publicHome.calendar.prev")}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setCursor(startOfMonth(today))}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:scale-[0.99]"
          >
            {t("publicHome.calendar.today")}
          </button>
          <button
            type="button"
            onClick={() => setCursor((d) => startOfMonth(addMonths(d, 1)))}
            className="rounded-full border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50 active:scale-[0.99]"
            aria-label={t("publicHome.calendar.next")}
            title={t("publicHome.calendar.next")}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </div>

      <div className="mt-2 text-xs text-slate-600 capitalize">{monthLabel}</div>

      <div className="mt-3 grid grid-cols-7 gap-1">
        {weekdayLabels.map((w) => (
          <div key={w} className="px-1 py-1 text-center text-[11px] font-semibold text-slate-500">
            {w}
          </div>
        ))}
        {days.map(({ date, inMonth }) => {
          const isToday = sameDay(date, today);
          return (
            <div
              key={dayKey(date)}
              className={[
                "aspect-square rounded-lg px-1 py-1 text-center text-xs leading-6",
                inMonth ? "text-slate-900" : "text-slate-400",
                isToday ? "bg-[color:var(--public-accent)] text-white" : "hover:bg-[color:var(--public-surface-muted)]",
              ].join(" ")}
              title={date.toLocaleDateString(locale)}
            >
              {date.getDate()}
            </div>
          );
        })}
      </div>
    </section>
  );
}
