import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/shared/api/client";
import { ChartCard, CohortGrid, ColumnChart, EmptyChart, Funnel, KpiTile, ShareBar, TrendChart } from "@/components/charts/Charts";
import { CHART, fmtInt, fmtNum, pctDelta } from "@/components/charts/chartUtils";
import { useAnalytics } from "../analyticsContext";
import { fmtDateTime, fmtDay, fmtMinutes, ti, tl, useLangVersion } from "../../insights/shared";
import { KpiGrid, SourceState } from "./common";

type AuthUser = { id: number; email?: string | null; first_name?: string | null; last_name?: string | null };

function useUserNames(ids: number[]) {
  const [names, setNames] = useState<Record<number, string>>({});
  const key = ids.join(",");
  useEffect(() => {
    if (!ids.length) return;
    let alive = true;
    Promise.allSettled(ids.map((id) => api<AuthUser>(`/api/auth/users/${id}`))).then((results) => {
      if (!alive) return;
      const out: Record<number, string> = {};
      results.forEach((r, i) => {
        if (r.status !== "fulfilled" || !r.value) return;
        const u = r.value;
        const full = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
        out[ids[i]] = full || u.email || `#${ids[i]}`;
      });
      setNames(out);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return names;
}

export default function AnalyticsUsersPage() {
  useLangVersion();
  const { traffic, library, reload } = useAnalytics();
  const tr = traffic.data;
  const lib = library.data;
  const names = useUserNames(tr?.users.top.map((u) => u.user_id) ?? []);
  const weekdays = tl("common.weekdays");
  const months = tl("common.months");

  const fmtCohort = (iso: string) => {
    const [, m, d] = iso.split("-").map(Number);
    return `${d} ${months[m - 1] ?? ""}`;
  };

  return (
    <SourceState loading={traffic.loading && library.loading} error={traffic.error && library.error} hasData={!!(tr || lib)} onRetry={reload}>
      <div className="space-y-4">
        <KpiGrid>
          <KpiTile label={ti("admin.users.dau")} value={tr ? fmtInt(tr.stickiness.dau) : "—"} hint={ti("admin.users.dauHint")} />
          <KpiTile label={ti("admin.users.wau")} value={tr ? fmtInt(tr.stickiness.wau) : "—"} />
          <KpiTile label={ti("admin.users.mau")} value={tr ? fmtInt(tr.stickiness.mau) : "—"} />
          <KpiTile
            accent
            label={ti("admin.users.stickiness")}
            value={tr ? `${fmtNum(tr.stickiness.ratio, 0)}%` : "—"}
            hint={ti("admin.users.stickinessHint")}
          />
          <KpiTile
            label={ti("admin.users.newUsers")}
            value={tr ? fmtInt(tr.users.new) : "—"}
          />
          <KpiTile label={ti("admin.users.returning")} value={tr ? fmtInt(tr.users.returning) : "—"} />
        </KpiGrid>

        {tr && (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <ChartCard title={ti("admin.overview.trend")} subtitle={ti("admin.overview.trendSub")} className="xl:col-span-2">
              <TrendChart
                data={tr.daily}
                xKey="day"
                formatX={fmtDay}
                series={[{ key: "users", label: ti("admin.overview.users"), color: CHART.s1 }]}
                emptyText={ti("common.noData")}
              />
            </ChartCard>
            <ChartCard title={ti("admin.users.newVsReturning")}>
              <ShareBar
                items={[
                  { key: "new", count: tr.users.new },
                  { key: "returning", count: tr.users.returning },
                ]}
                labelFor={(k) => (k === "new" ? ti("admin.users.newUsers") : ti("admin.users.returning"))}
                emptyText={ti("common.noData")}
              />
              <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-slate-500">{ti("admin.users.newUsers")}</div>
                  <div className="text-xl font-semibold tabular-nums">{fmtInt(tr.users.new)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">{ti("admin.users.returning")}</div>
                  <div className="text-xl font-semibold tabular-nums">{fmtInt(tr.users.returning)}</div>
                </div>
              </div>
            </ChartCard>
          </div>
        )}

        {tr && (
          <ChartCard title={ti("admin.users.cohorts")} subtitle={ti("admin.users.cohortsSub")}>
            <CohortGrid
              cohorts={tr.cohorts}
              cohortLabel={ti("admin.users.cohort")}
              sizeLabel={ti("admin.users.size")}
              weekLabel={(n) => ti("admin.users.week", { n })}
              formatCohort={fmtCohort}
              emptyText={ti("common.noData")}
            />
          </ChartCard>
        )}

        {lib && (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <KpiTile
                label={ti("admin.overview.activeReaders")}
                value={fmtInt(lib.kpi.active_readers)}
                delta={pctDelta(lib.kpi.active_readers, lib.kpi.active_readers_prev)}
              />
              <KpiTile label={ti("admin.users.readersTotal")} value={fmtInt(lib.kpi.readers_total)} />
              <KpiTile label={ti("admin.users.newReaders")} value={fmtInt(lib.kpi.new_readers)} />
              <KpiTile label={ti("admin.users.avgMinutes")} value={fmtMinutes(lib.kpi.avg_minutes_per_reader)} />
            </div>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <ChartCard title={ti("admin.users.funnel")} subtitle={ti("admin.users.funnelSub")}>
                <Funnel
                  steps={[
                    { label: ti("admin.users.started"), value: lib.funnel.started },
                    { label: ti("admin.users.p25"), value: lib.funnel.p25 },
                    { label: ti("admin.users.p50"), value: lib.funnel.p50 },
                    { label: ti("admin.users.p75"), value: lib.funnel.p75 },
                    { label: ti("admin.users.done"), value: lib.funnel.completed },
                  ]}
                  emptyText={ti("common.noData")}
                />
              </ChartCard>
              <ChartCard title={ti("admin.users.weekday")}>
                <ColumnChart
                  data={lib.weekday_minutes.map((v, i) => ({ label: weekdays[i], value: v }))}
                  format={(v) => fmtMinutes(v)}
                  height={200}
                  emptyText={ti("common.noData")}
                />
              </ChartCard>
            </div>
          </>
        )}

        {tr && (
          <ChartCard title={ti("admin.users.topUsers")} subtitle={ti("admin.users.topUsersSub")}>
            {tr.users.top.length === 0 ? (
              <EmptyChart text={ti("common.noData")} height={80} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                      <th className="py-2 pr-3 font-medium">{ti("admin.users.user")}</th>
                      <th className="py-2 pr-3 text-right font-medium">{ti("admin.users.activeDays")}</th>
                      <th className="py-2 pr-3 text-right font-medium">{ti("admin.users.sessions")}</th>
                      <th className="py-2 pr-3 text-right font-medium">{ti("admin.users.requests")}</th>
                      <th className="py-2 text-right font-medium">{ti("admin.users.lastSeen")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tr.users.top.map((u) => (
                      <tr key={u.user_id} className="border-b border-slate-100 last:border-0">
                        <td className="py-2 pr-3">
                          <Link to={`/admin/users/${u.user_id}`} className="text-slate-900 hover:text-[#b51e3e] hover:underline" title={ti("admin.users.open")}>
                            {names[u.user_id] ?? `#${u.user_id}`}
                          </Link>
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums font-medium">{fmtInt(u.active_days)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{fmtInt(u.sessions)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums text-slate-500">{fmtInt(u.events)}</td>
                        <td className="py-2 text-right text-slate-500">{fmtDateTime(u.last_seen)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ChartCard>
        )}
      </div>
    </SourceState>
  );
}
