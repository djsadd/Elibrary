import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import DashboardHeader from "@/components/layout/DashboardHeader";
import { SegmentedControl } from "@/components/charts/Charts";
import { api } from "@/shared/api/client";
import { t } from "@/shared/i18n";
import { daysBetween, fmtDay, rangeForDays, ti, useAsync, useLangVersion, ymd } from "../insights/shared";
import type { LibraryInsights, TrafficInsights } from "./types";
import type { AnalyticsContext } from "./analyticsContext";

const tabs = [
  { to: "", key: "overview", end: true },
  { to: "users", key: "users" },
  { to: "books", key: "books" },
  { to: "traffic", key: "traffic" },
] as const;

const PERIODS = [7, 30, 90, 180, 365] as const;
const MAX_DAYS = 366;
const STORAGE_KEY = "analytics:period";

/** A rolling preset ("last N days") or an explicit inclusive date range. */
type Period = { kind: "preset"; days: number } | { kind: "custom"; from: string; to: string };

const DEFAULT_PERIOD: Period = { kind: "preset", days: 30 };

function isValidRange(from: string, to: string): boolean {
  const n = daysBetween(from, to);
  return n > 0 && n <= MAX_DAYS;
}

function readStoredPeriod(): Period {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PERIOD;
    const p = JSON.parse(raw) as Period;
    if (p?.kind === "preset" && (PERIODS as readonly number[]).includes(p.days)) return p;
    if (p?.kind === "custom" && isValidRange(p.from, p.to)) return p;
  } catch {
    /* fall through */
  }
  return DEFAULT_PERIOD;
}

function resolveRange(p: Period): { from: string; to: string } {
  return p.kind === "preset" ? rangeForDays(p.days) : { from: p.from, to: p.to };
}

/** Calendar year: Jan 1 – Dec 31, clipped to today for the current year. */
function yearRange(year: number): { from: string; to: string } {
  const today = ymd(new Date());
  const end = `${year}-12-31`;
  return { from: `${year}-01-01`, to: end < today ? end : today };
}

export default function AnalyticsLayout() {
  useLangVersion();
  const loc = useLocation();
  const [period, setPeriod] = useState<Period>(readStoredPeriod);
  const [customOpen, setCustomOpen] = useState(false);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(period));
    } catch {
      /* per-viewer convenience only */
    }
  }, [period]);

  const range = useMemo(() => resolveRange(period), [period]);
  const days = daysBetween(range.from, range.to);

  const traffic = useAsync(
    () => api<TrafficInsights>(`/api/analytics/stats/insights?from=${range.from}&to=${range.to}`),
    [range.from, range.to]
  );
  const library = useAsync(
    () => api<LibraryInsights>(`/api/catalog/admin/insights?from=${range.from}&to=${range.to}`),
    [range.from, range.to]
  );

  const onTraffic = /\/analytics\/traffic/.test(loc.pathname);
  const loading = traffic.loading || library.loading;
  const reload = () => {
    traffic.reload();
    library.reload();
  };

  return (
    <div className="workspace-section space-y-4">
      <DashboardHeader />
      <div className="page-heading flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1>{t("nav.analytics")}</h1>
          {!onTraffic && (
            <div className="mt-1 text-xs text-slate-500 tabular-nums">
              {fmtDay(range.from)} {range.from.slice(0, 4)} – {fmtDay(range.to)} {range.to.slice(0, 4)}
            </div>
          )}
        </div>
        {!onTraffic && (
          <div className="relative flex flex-wrap items-center gap-2">
            <SegmentedControl<number | "custom">
              label={ti("common.period")}
              value={period.kind === "preset" ? period.days : "custom"}
              onChange={(v) => {
                if (v === "custom") {
                  setCustomOpen(true);
                } else {
                  setCustomOpen(false);
                  setPeriod({ kind: "preset", days: v });
                }
              }}
              options={[
                ...PERIODS.map((p) => ({ value: p as number | "custom", label: ti(`common.d${p}`) })),
                { value: "custom" as const, label: ti("common.custom") },
              ]}
            />
            <button
              type="button"
              onClick={reload}
              className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50"
              aria-label={ti("common.retry")}
              title={ti("common.retry")}
            >
              <svg viewBox="0 0 24 24" className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
                <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />
              </svg>
            </button>
            {customOpen && (
              <CustomRangePopover
                initial={range}
                onClose={() => setCustomOpen(false)}
                onApply={(r) => {
                  setPeriod({ kind: "custom", ...r });
                  setCustomOpen(false);
                }}
              />
            )}
          </div>
        )}
      </div>

      <nav className="workspace-tabs border-b">
        <div className="flex flex-wrap gap-2 pb-3">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={"end" in tab ? tab.end : undefined}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md text-sm border ${
                  isActive ? "bg-[#b51e3e] text-white border-[#b51e3e]" : "bg-white text-slate-700 hover:bg-slate-50"
                }`
              }
            >
              {ti(`admin.tabs.${tab.key}`)}
            </NavLink>
          ))}
        </div>
      </nav>

      <Outlet
        context={
          {
            days,
            range,
            traffic: { data: traffic.data, error: traffic.error, loading: traffic.loading },
            library: { data: library.data, error: library.error, loading: library.loading },
            reload,
          } satisfies AnalyticsContext
        }
      />
    </div>
  );
}

function CustomRangePopover({
  initial,
  onApply,
  onClose,
}: {
  initial: { from: string; to: string };
  onApply: (r: { from: string; to: string }) => void;
  onClose: () => void;
}) {
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const ref = useRef<HTMLDivElement>(null);
  const today = ymd(new Date());
  const thisYear = new Date().getFullYear();
  const years = [thisYear, thisYear - 1, thisYear - 2];
  const valid = isValidRange(from, to) && to <= today;

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={ti("common.customRange")}
      className="absolute right-0 top-full z-30 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-3 shadow-lg"
    >
      <div className="mb-2 text-xs font-semibold text-slate-700">{ti("common.calendarYear")}</div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {years.map((y) => (
          <button
            key={y}
            type="button"
            onClick={() => onApply(yearRange(y))}
            className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            {y}
          </button>
        ))}
      </div>
      <div className="mb-2 text-xs font-semibold text-slate-700">{ti("common.customRange")}</div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-slate-500">
          {ti("common.from")}
          <input
            type="date"
            value={from}
            max={to || today}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-800"
          />
        </label>
        <label className="text-xs text-slate-500">
          {ti("common.to")}
          <input
            type="date"
            value={to}
            min={from}
            max={today}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-800"
          />
        </label>
      </div>
      {!valid && from && to && <div className="mt-2 text-xs text-red-600">{ti("common.rangeTooLong")}</div>}
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          disabled={!valid}
          onClick={() => onApply({ from, to })}
          className="rounded-md bg-[#800020] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
        >
          {ti("common.apply")}
        </button>
      </div>
    </div>
  );
}
