import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import DashboardHeader from "@/components/layout/DashboardHeader";
import { SegmentedControl } from "@/components/charts/Charts";
import { api } from "@/shared/api/client";
import { t } from "@/shared/i18n";
import { rangeForDays, ti, useAsync, useLangVersion } from "../insights/shared";
import type { LibraryInsights, TrafficInsights } from "./types";
import type { AnalyticsContext } from "./analyticsContext";

const tabs = [
  { to: "", key: "overview", end: true },
  { to: "users", key: "users" },
  { to: "books", key: "books" },
  { to: "traffic", key: "traffic" },
] as const;

const PERIODS = [7, 30, 90] as const;
const STORAGE_KEY = "analytics:days";

function readStoredDays(): number {
  try {
    const v = Number(localStorage.getItem(STORAGE_KEY));
    return (PERIODS as readonly number[]).includes(v) ? v : 30;
  } catch {
    return 30;
  }
}

export default function AnalyticsLayout() {
  useLangVersion();
  const loc = useLocation();
  const [days, setDays] = useState<number>(readStoredDays);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(days));
    } catch {
      /* per-viewer convenience only */
    }
  }, [days]);

  const traffic = useAsync(() => {
    const { from, to } = rangeForDays(days);
    return api<TrafficInsights>(`/api/analytics/stats/insights?from=${from}&to=${to}`);
  }, [days]);
  const library = useAsync(() => api<LibraryInsights>(`/api/catalog/admin/insights?days=${days}`), [days]);

  const onTraffic = /\/analytics\/traffic/.test(loc.pathname);

  return (
    <div className="workspace-section space-y-4">
      <DashboardHeader />
      <div className="page-heading flex flex-wrap items-end justify-between gap-3">
        <h1>{t("nav.analytics")}</h1>
        {!onTraffic && (
          <div className="flex items-center gap-2">
            <SegmentedControl
              label={ti("common.period")}
              value={days}
              onChange={setDays}
              options={PERIODS.map((p) => ({ value: p, label: ti(`common.d${p}`) }))}
            />
            <button
              type="button"
              onClick={() => {
                traffic.reload();
                library.reload();
              }}
              className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50"
              aria-label={ti("common.retry")}
              title={ti("common.retry")}
            >
              <svg viewBox="0 0 24 24" className={`h-4 w-4 ${traffic.loading || library.loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
                <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />
              </svg>
            </button>
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
            traffic: { data: traffic.data, error: traffic.error, loading: traffic.loading },
            library: { data: library.data, error: library.error, loading: library.loading },
            reload: () => {
              traffic.reload();
              library.reload();
            },
          } satisfies AnalyticsContext
        }
      />
    </div>
  );
}
