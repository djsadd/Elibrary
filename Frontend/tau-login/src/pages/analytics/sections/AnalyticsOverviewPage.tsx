import { ChartCard, EmptyChart, KpiTile, MatrixHeatmap, RankedBars, ShareBar, TrendChart } from "@/components/charts/Charts";
import { CHART, fmtInt, fmtNum, pctDelta } from "@/components/charts/chartUtils";
import { useAnalytics } from "../analyticsContext";
import { fmtDay, fmtMinutes, fmtMinutesAxis, ti, tl, useLangVersion } from "../../insights/shared";
import { KpiGrid, SourceState } from "./common";

export default function AnalyticsOverviewPage() {
  useLangVersion();
  const { traffic, library, reload } = useAnalytics();
  const tr = traffic.data;
  const lib = library.data;
  const weekdays = tl("common.weekdays");

  const visitors = tr ? tr.current.users + tr.current.guests : 0;
  const visitorsPrev = tr ? tr.previous.users + tr.previous.guests : 0;
  const errRate = tr && tr.current.events ? (100 * tr.current.errors_5xx) / tr.current.events : 0;
  const errRatePrev = tr && tr.previous.events ? (100 * tr.previous.errors_5xx) / tr.previous.events : 0;

  const deviceLabel = (k: string) => ti(`common.devices.${k}`);
  const statusRows = tr
    ? ["2xx", "3xx", "4xx", "5xx"].map((k) => ({ key: k, label: k, value: tr.status[k] || 0 })).filter((r) => r.value > 0)
    : [];

  return (
    <SourceState loading={traffic.loading && library.loading} error={traffic.error && library.error} hasData={!!(tr || lib)} onRetry={reload}>
      <div className="space-y-4">
        <KpiGrid>
          <KpiTile
            label={ti("admin.overview.visitors")}
            value={tr ? fmtInt(visitors) : "—"}
            delta={tr ? pctDelta(visitors, visitorsPrev) : null}
            hint={tr ? ti("admin.overview.visitorsHint", { u: fmtInt(tr.current.users), g: fmtInt(tr.current.guests) }) : undefined}
          />
          <KpiTile
            label={ti("admin.overview.sessions")}
            value={tr ? fmtInt(tr.current.sessions) : "—"}
            delta={tr ? pctDelta(tr.current.sessions, tr.previous.sessions) : null}
          />
          <KpiTile
            label={ti("admin.overview.activeReaders")}
            value={lib ? fmtInt(lib.kpi.active_readers) : "—"}
            delta={lib ? pctDelta(lib.kpi.active_readers, lib.kpi.active_readers_prev) : null}
          />
          <KpiTile
            label={ti("admin.overview.readingTime")}
            value={lib ? fmtMinutes(lib.kpi.minutes) : "—"}
            delta={lib ? pctDelta(lib.kpi.minutes, lib.kpi.minutes_prev) : null}
          />
          <KpiTile
            label={ti("admin.overview.requests")}
            value={tr ? fmtInt(tr.current.events) : "—"}
            delta={tr ? pctDelta(tr.current.events, tr.previous.events) : null}
          />
          <KpiTile
            label={ti("admin.overview.errorRate")}
            value={tr ? `${fmtNum(errRate, 2)}%` : "—"}
            delta={tr ? pctDelta(errRate, errRatePrev) : null}
            goodWhen="down"
            hint={tr ? ti("admin.overview.errorHint", { n: fmtInt(tr.current.errors_5xx) }) : undefined}
          />
        </KpiGrid>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <ChartCard title={ti("admin.overview.trend")} subtitle={ti("admin.overview.trendSub")}>
            {tr ? (
              <TrendChart
                data={tr.daily}
                xKey="day"
                formatX={fmtDay}
                series={[
                  { key: "users", label: ti("admin.overview.users"), color: CHART.s1 },
                  { key: "guests", label: ti("admin.overview.guests"), color: CHART.s2 },
                ]}
                emptyText={ti("common.noData")}
              />
            ) : (
              <EmptyChart text={traffic.error || ti("common.loading")} height={220} />
            )}
          </ChartCard>
          <ChartCard title={ti("admin.overview.readingTrend")} subtitle={ti("admin.overview.readingTrendSub")}>
            {lib ? (
              <TrendChart
                data={lib.daily}
                xKey="day"
                formatX={fmtDay}
                format={(v) => fmtMinutes(v)}
                formatAxis={fmtMinutesAxis}
                series={[{ key: "minutes", label: ti("admin.overview.minutes"), color: CHART.s1 }]}
                emptyText={ti("common.noData")}
              />
            ) : (
              <EmptyChart text={library.error || ti("common.loading")} height={220} />
            )}
          </ChartCard>
        </div>

        {tr && (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <ChartCard title={ti("admin.overview.heatmap")} subtitle={ti("admin.overview.heatmapSub")} className="xl:col-span-2">
              {tr.heatmap.flat().some((v) => v > 0) ? (
                <MatrixHeatmap matrix={tr.heatmap} rowLabels={weekdays} unit={ti("admin.overview.sessionsUnit")} />
              ) : (
                <EmptyChart text={ti("common.noData")} height={180} />
              )}
            </ChartCard>
            <ChartCard title={ti("admin.overview.topPages")} subtitle={ti("admin.overview.topPagesSub")}>
              <RankedBars
                items={tr.top_pages.slice(0, 8).map((p) => ({
                  key: p.path,
                  label: <code className="text-xs">{p.path}</code>,
                  value: p.sessions,
                }))}
                emptyText={ti("common.noData")}
              />
            </ChartCard>
          </div>
        )}

        {tr && (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <ChartCard title={ti("admin.overview.devices")}>
              <ShareBar items={tr.devices.device} labelFor={deviceLabel} otherLabel={ti("common.other")} emptyText={ti("common.noData")} />
            </ChartCard>
            <ChartCard title={ti("admin.overview.browsers")}>
              <ShareBar items={tr.devices.browser} otherLabel={ti("common.other")} emptyText={ti("common.noData")} />
            </ChartCard>
            <ChartCard title={ti("admin.overview.os")}>
              <ShareBar items={tr.devices.os} otherLabel={ti("common.other")} emptyText={ti("common.noData")} />
            </ChartCard>
          </div>
        )}

        {tr && (
          <ChartCard title={ti("admin.overview.health")} subtitle={ti("admin.overview.healthSub")}>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <RankedBars items={statusRows} color="#64748b" emptyText={ti("common.noData")} />
              <div>
                <div className="mb-2 text-xs font-medium text-slate-500">{ti("admin.overview.errorPaths")}</div>
                {tr.error_paths.length === 0 ? (
                  <div className="text-sm text-slate-600">{ti("admin.overview.noErrors")}</div>
                ) : (
                  <ul className="space-y-1.5 text-sm">
                    {tr.error_paths.slice(0, 5).map((e) => (
                      <li key={e.path} className="flex items-center gap-2">
                        <span className="rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-semibold text-red-700">{e.status}</span>
                        <code className="min-w-0 flex-1 truncate text-xs text-slate-700">{e.path}</code>
                        <span className="tabular-nums text-slate-900">{fmtInt(e.count)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </ChartCard>
        )}
      </div>
    </SourceState>
  );
}
