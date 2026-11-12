import { Link } from "react-router-dom";
import { api } from "@/shared/api/client";
import DashboardHeader from "@/components/layout/DashboardHeader";
import { CalendarHeatmap, ChartCard, ColumnChart, EmptyChart, KpiTile, Meter } from "@/components/charts/Charts";
import { fmtInt, fmtNum, pctDelta } from "@/components/charts/chartUtils";
import { fmtDateTime, fmtDay, fmtMinutes, fmtMonth, i18nName, ti, tl, useAsync, useLangVersion } from "./shared";

type Named = { id: number; name: string; name_ru?: string | null; name_kk?: string | null; name_en?: string | null; count: number };

export type MyInsights = {
  range: { from: string; to: string; days: number };
  totals: { books: number; reading: number; completed: number; minutes: number; pages: number; notes: number; avg_progress: number };
  window: {
    minutes: number;
    active_days: number;
    avg_minutes_per_active_day: number;
    last30_minutes: number;
    prev30_minutes: number;
    best_day: { day: string; minutes: number } | null;
  };
  streak: { current: number; longest: number; read_today: boolean };
  daily: { day: string; minutes: number; pages: number }[];
  weekday_minutes: number[];
  monthly: { month: string; minutes: number }[];
  top_subjects: Named[];
  top_authors: Named[];
  in_progress: {
    id: number;
    title: string;
    authors: string[];
    progress: number;
    current_page?: number | null;
    total_pages?: number | null;
    minutes: number;
    last_opened_at?: string | null;
  }[];
};

type MyActivity = {
  events: number;
  sessions: number;
  active_days: number;
  last_seen?: string | null;
  hourly: number[];
  peak_hour: number | null;
  devices: { device: string; browser: string; os: string; last_seen?: string | null }[];
};

function DeviceIcon({ kind }: { kind: string }) {
  const path =
    kind === "mobile"
      ? "M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm3 17h2"
      : kind === "tablet"
        ? "M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm5 17h2"
        : "M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zm5 16h8m-4-4v4";
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-500" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden>
      <path d={path} />
    </svg>
  );
}

export function MyInsightsContent() {
  useLangVersion();
  const reading = useAsync(() => api<MyInsights>("/api/catalog/me/insights?days=365"), []);
  const activity = useAsync(() => api<MyActivity>("/api/analytics/me/activity?days=30"), []);
  const weekdays = tl("common.weekdays");
  const months = tl("common.months");

  if (reading.loading) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-busy="true">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />
        ))}
        <div className="col-span-full h-48 animate-pulse rounded-xl bg-slate-100" />
      </div>
    );
  }
  if (reading.error || !reading.data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {reading.error || ti("common.failed")}{" "}
        <button className="ml-2 underline" onClick={reading.reload}>
          {ti("common.retry")}
        </button>
      </div>
    );
  }

  const d = reading.data;
  const hasAnything = d.totals.books > 0 || d.totals.pages > 0 || d.window.minutes > 0;
  const last30Delta = pctDelta(d.window.last30_minutes, d.window.prev30_minutes);
  const a = activity.data;

  if (!hasAnything) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#800020]/10 text-[#800020]">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
            <path d="M4 19V5m0 14h16M8 15l3-4 3 2 5-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-slate-900">{ti("my.emptyTitle")}</h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{ti("my.emptyBody")}</p>
        <Link to="/catalog" className="tau-button tau-button--red mt-4 inline-flex">
          {ti("my.toCatalog")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          accent
          label={ti("my.streak")}
          value={
            <span>
              {d.streak.current > 0 && <span aria-hidden>🔥 </span>}
              {ti("my.days", { n: d.streak.current })}
            </span>
          }
          hint={
            <>
              {d.streak.read_today ? ti("my.readToday") : ti("my.notToday")}
              <br />
              {ti("my.longest", { n: d.streak.longest })}
            </>
          }
        />
        <KpiTile
          label={ti("my.readingTime")}
          value={fmtMinutes(d.totals.minutes)}
          delta={last30Delta}
          hint={ti("my.last30", { v: fmtMinutes(d.window.last30_minutes) })}
        />
        <KpiTile label={ti("my.pages")} value={fmtInt(d.totals.pages)} hint={`${ti("my.avgProgress")}: ${fmtNum(d.totals.avg_progress, 0)}%`} />
        <KpiTile label={ti("my.completed")} value={fmtInt(d.totals.completed)} hint={ti("my.onShelf", { n: d.totals.books })} />
      </div>

      <ChartCard title={ti("my.calendar")} subtitle={ti("my.calendarSub")}>
        <CalendarHeatmap
          days={d.daily.map((x) => ({ day: x.day, value: x.minutes }))}
          format={(v) => fmtMinutes(v)}
          weekdayLabels={weekdays}
          monthLabels={months}
          lessLabel={ti("common.less")}
          moreLabel={ti("common.more")}
          formatDay={fmtDay}
        />
      </ChartCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title={ti("my.weekday")} subtitle={ti("my.weekdaySub")}>
          <ColumnChart
            data={d.weekday_minutes.map((v, i) => ({ label: weekdays[i], value: v }))}
            format={(v) => fmtMinutes(v)}
            emptyText={ti("common.noData")}
          />
        </ChartCard>
        <ChartCard title={ti("my.monthly")} subtitle={ti("my.monthlySub")}>
          <ColumnChart
            data={d.monthly.map((m) => ({ label: fmtMonth(m.month), value: m.minutes }))}
            format={(v) => fmtMinutes(v)}
            highlight={d.monthly.length - 1}
            emptyText={ti("common.noData")}
          />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard title={ti("my.inProgress")} className="lg:col-span-2">
          {d.in_progress.length === 0 ? (
            <EmptyChart text={ti("my.noProgress")} height={80} />
          ) : (
            <ul className="divide-y divide-slate-100">
              {d.in_progress.map((b) => (
                <li key={b.id} className="flex items-center gap-4 py-3">
                  <div className="min-w-0 flex-1">
                    <Link to={`/catalog/${b.id}`} className="block truncate text-sm font-medium text-slate-900 hover:text-[#b51e3e]">
                      {b.title}
                    </Link>
                    <div className="truncate text-xs text-slate-500">{b.authors.join(", ") || "—"}</div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <Meter value={b.progress} />
                      <span className="w-10 shrink-0 text-right text-xs tabular-nums text-slate-700">{fmtNum(b.progress, 0)}%</span>
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500">
                      {b.current_page && b.total_pages ? ti("my.pageOf", { p: b.current_page, t: b.total_pages }) + " · " : ""}
                      {fmtMinutes(b.minutes)}
                    </div>
                  </div>
                  <Link
                    to={`/reader?book=${encodeURIComponent(String(b.id))}${b.current_page ? `&page=${b.current_page}` : ""}`}
                    className="shrink-0 rounded-md border border-[#800020] px-3 py-1.5 text-xs font-medium text-[#800020] hover:bg-[#800020] hover:text-white"
                  >
                    {ti("my.continue")}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>

        <ChartCard title={ti("my.habits")}>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
            <div>
              <dt className="text-xs text-slate-500">{ti("my.activeDays")}</dt>
              <dd className="font-semibold tabular-nums text-slate-900">{fmtInt(d.window.active_days)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">{ti("my.avgPerDay")}</dt>
              <dd className="font-semibold tabular-nums text-slate-900">{fmtMinutes(d.window.avg_minutes_per_active_day)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">{ti("my.bestDay")}</dt>
              <dd className="font-semibold tabular-nums text-slate-900">
                {d.window.best_day ? `${fmtMinutes(d.window.best_day.minutes)}` : "—"}
                {d.window.best_day && <span className="block text-xs font-normal text-slate-500">{fmtDay(d.window.best_day.day)}</span>}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">{ti("my.notes")}</dt>
              <dd className="font-semibold tabular-nums text-slate-900">{fmtInt(d.totals.notes)}</dd>
            </div>
          </dl>
          {d.top_subjects.length > 0 && (
            <div className="mt-4">
              <div className="mb-1.5 text-xs font-medium text-slate-500">{ti("my.topSubjects")}</div>
              <div className="flex flex-wrap gap-1.5">
                {d.top_subjects.map((s) => (
                  <span key={s.id} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                    {i18nName(s)} <span className="text-slate-400">· {s.count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          {d.top_authors.length > 0 && (
            <div className="mt-3">
              <div className="mb-1.5 text-xs font-medium text-slate-500">{ti("my.topAuthors")}</div>
              <div className="flex flex-wrap gap-1.5">
                {d.top_authors.map((s) => (
                  <span key={s.id} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                    {i18nName(s)} <span className="text-slate-400">· {s.count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </ChartCard>
      </div>

      {a && (
        <ChartCard title={ti("my.app")} subtitle={ti("my.appSub")}>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <dl className="grid grid-cols-2 gap-3 text-sm lg:grid-cols-1">
              <div>
                <dt className="text-xs text-slate-500">{ti("my.sessions")}</dt>
                <dd className="text-lg font-semibold tabular-nums text-slate-900">{fmtInt(a.sessions)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{ti("my.activeDays")}</dt>
                <dd className="text-lg font-semibold tabular-nums text-slate-900">{fmtInt(a.active_days)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{ti("my.peakHour")}</dt>
                <dd className="text-lg font-semibold tabular-nums text-slate-900">
                  {a.peak_hour === null ? "—" : `${String(a.peak_hour).padStart(2, "0")}:00`}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{ti("my.lastSeen")}</dt>
                <dd className="text-sm font-medium text-slate-900">{fmtDateTime(a.last_seen)}</dd>
              </div>
            </dl>
            <div className="lg:col-span-2">
              <div className="mb-1 text-xs font-medium text-slate-500">{ti("my.hourly")}</div>
              <ColumnChart
                data={a.hourly.map((v, h) => ({ label: String(h).padStart(2, "0"), value: v, tip: `${String(h).padStart(2, "0")}:00` }))}
                labelEvery={3}
                height={140}
                color="#2a78d6"
                emptyText={ti("common.noData")}
              />
              {a.devices.length > 0 && (
                <div className="mt-3">
                  <div className="mb-1.5 text-xs font-medium text-slate-500">{ti("my.yourDevices")}</div>
                  <ul className="flex flex-wrap gap-2">
                    {a.devices.map((dv) => (
                      <li key={`${dv.device}-${dv.browser}-${dv.os}`} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
                        <DeviceIcon kind={dv.device} />
                        <div className="text-xs">
                          <div className="font-medium text-slate-800">
                            {dv.browser} · {dv.os}
                          </div>
                          <div className="text-slate-500">{fmtDateTime(dv.last_seen)}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </ChartCard>
      )}
    </div>
  );
}

export default function MyInsightsPage() {
  useLangVersion();
  return (
    <div className="workspace-section space-y-4">
      <DashboardHeader />
      <div className="page-heading">
        <h1>{ti("my.title")}</h1>
        <p className="mt-1 text-sm text-slate-500">{ti("my.subtitle")}</p>
      </div>
      <MyInsightsContent />
    </div>
  );
}
