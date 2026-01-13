import { useEffect, useMemo, useState } from "react";
import { api } from "@/shared/api/client";
import { t } from "@/shared/i18n";

type SummaryStats = {
  total: number;
  users: number;
  guests: number;
};

type DailyStatsRow = {
  day: string;
  total: number;
  users: number;
  guests: number;
};

type TopPathRow = {
  path: string;
  count: number;
};

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authStats, setAuthStats] = useState<any | null>(null);
  const [catalogStats, setCatalogStats] = useState<any | null>(null);
  const [summaryStats, setSummaryStats] = useState<SummaryStats | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyStatsRow[]>([]);
  const [topPaths, setTopPaths] = useState<TopPathRow[]>([]);
  const [rangeDays, setRangeDays] = useState(30);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const ta = (key: string, vars?: Record<string, any>) => t(`admin.analytics.${key}`, vars);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - (rangeDays - 1));
    const toStr = to.toISOString().slice(0, 10);
    const fromStr = from.toISOString().slice(0, 10);

    Promise.all([
      api<any>("/api/auth/admin/stats"),
      api<any>("/api/catalog/admin/stats"),
      api<SummaryStats>(`/api/analytics/stats/summary?from=${fromStr}&to=${toStr}`),
      api<DailyStatsRow[]>(`/api/analytics/stats/daily?from=${fromStr}&to=${toStr}`),
      api<TopPathRow[]>(`/api/analytics/stats/top-paths?from=${fromStr}&to=${toStr}&limit=10`),
    ])
      .then(([auth, catalog, summary, daily, top]) => {
        if (!alive) return;
        setAuthStats(auth);
        setCatalogStats(catalog);
        setSummaryStats(summary);
        setDailyStats(Array.isArray(daily) ? daily : []);
        setTopPaths(Array.isArray(top) ? top : []);
        setLastUpdated(new Date());
      })
      .catch((e) => {
        if (!alive) return;
        setError(e?.message || ta("failed"));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [rangeDays]);

  const roleRows = useMemo(() => {
    const roles = authStats?.roles || {};
    return Object.entries(roles).sort((a: any, b: any) => (b[1] as number) - (a[1] as number));
  }, [authStats]);

  const formatDate = (d?: Date | null) => {
    if (!d) return "-";
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
  };

  const maxDaily = useMemo(() => {
    return dailyStats.reduce((max, row) => Math.max(max, row.total || 0), 0);
  }, [dailyStats]);

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">{t('admin.nav.reports')}</h2>
      {loading && <div className="text-slate-500 text-sm">{ta("loading")}</div>}
      {!loading && error && <div className="text-red-600 text-sm">{error}</div>}
      {!loading && !error && (
        <div className="space-y-4">
          <div className="text-xs text-slate-500">{ta("lastUpdated")}: {formatDate(lastUpdated)}</div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-white border rounded-md p-4 shadow-sm">
              <div className="text-xs text-slate-500 mb-1">{ta("cards.totalUsers")}</div>
              <div className="text-2xl font-semibold text-slate-800">{authStats?.total_users ?? 0}</div>
            </div>
            <div className="bg-white border rounded-md p-4 shadow-sm">
              <div className="text-xs text-slate-500 mb-1">{ta("cards.activeUsers")}</div>
              <div className="text-2xl font-semibold text-slate-800">{authStats?.active_users ?? 0}</div>
            </div>
            <div className="bg-white border rounded-md p-4 shadow-sm">
              <div className="text-xs text-slate-500 mb-1">{ta("cards.booksTotal")}</div>
              <div className="text-2xl font-semibold text-slate-800">{catalogStats?.total_books ?? 0}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white border rounded-md p-4 shadow-sm">
              <div className="text-sm font-semibold text-slate-700 mb-3">{ta("sections.users")}</div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-slate-500">{ta("metrics.totalUsers")}</div>
                  <div className="font-medium">{authStats?.total_users ?? 0}</div>
                </div>
                <div>
                  <div className="text-slate-500">{ta("metrics.inactiveUsers")}</div>
                  <div className="font-medium">{authStats?.inactive_users ?? 0}</div>
                </div>
                <div>
                  <div className="text-slate-500">{ta("metrics.activeUsers")}</div>
                  <div className="font-medium">{authStats?.active_users ?? 0}</div>
                </div>
              </div>
              <div className="mt-4">
                <div className="text-xs font-semibold text-slate-500 mb-2">{ta("metrics.roles")}</div>
                {roleRows.length === 0 ? (
                  <div className="text-sm text-slate-500">{ta("empty.roles")}</div>
                ) : (
                  <div className="space-y-2 text-sm">
                    {roleRows.map(([role, count]) => (
                      <div key={role as any} className="flex items-center justify-between">
                        <span className="text-slate-600">{role}</span>
                        <span className="font-medium text-slate-800">{count as any}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white border rounded-md p-4 shadow-sm">
              <div className="text-sm font-semibold text-slate-700 mb-3">{ta("sections.catalog")}</div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-slate-500">{ta("metrics.totalBooks")}</div>
                  <div className="font-medium">{catalogStats?.total_books ?? 0}</div>
                </div>
                <div>
                  <div className="text-slate-500">{ta("metrics.publicBooks")}</div>
                  <div className="font-medium">{catalogStats?.public_books ?? 0}</div>
                </div>
                <div>
                  <div className="text-slate-500">{ta("metrics.authors")}</div>
                  <div className="font-medium">{catalogStats?.authors ?? 0}</div>
                </div>
                <div>
                  <div className="text-slate-500">{ta("metrics.subjects")}</div>
                  <div className="font-medium">{catalogStats?.subjects ?? 0}</div>
                </div>
                <div>
                  <div className="text-slate-500">{ta("metrics.playlists")}</div>
                  <div className="font-medium">{catalogStats?.playlists ?? 0}</div>
                </div>
                <div>
                  <div className="text-slate-500">{ta("metrics.files")}</div>
                  <div className="font-medium">{catalogStats?.files ?? 0}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border rounded-md p-4 shadow-sm">
            <div className="text-sm font-semibold text-slate-700 mb-3">{ta("sections.reading")}</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <div className="text-slate-500">{ta("metrics.userbooks")}</div>
                <div className="font-medium">{catalogStats?.userbooks ?? 0}</div>
              </div>
              <div>
                <div className="text-slate-500">{ta("metrics.notes")}</div>
                <div className="font-medium">{catalogStats?.notes ?? 0}</div>
              </div>
              <div>
                <div className="text-slate-500">{ta("metrics.reading")}</div>
                <div className="font-medium">{catalogStats?.reading ?? 0}</div>
              </div>
              <div>
                <div className="text-slate-500">{ta("metrics.completed")}</div>
                <div className="font-medium">{catalogStats?.completed ?? 0}</div>
              </div>
            </div>
          </div>

          <div className="bg-white border rounded-md p-4 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div className="text-sm font-semibold text-slate-700">{ta("sections.traffic")}</div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500">{ta("range.label")}</span>
                {[7, 30, 90].map((days) => (
                  <button
                    key={days}
                    onClick={() => setRangeDays(days)}
                    className={`px-2 py-1 rounded border ${
                      rangeDays === days ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600"
                    }`}
                  >
                    {ta(`range.${days}d`)}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div className="border rounded-md p-3">
                <div className="text-slate-500">{ta("metrics.totalEvents")}</div>
                <div className="text-xl font-semibold text-slate-800">{summaryStats?.total ?? 0}</div>
              </div>
              <div className="border rounded-md p-3">
                <div className="text-slate-500">{ta("metrics.uniqueUsers")}</div>
                <div className="text-xl font-semibold text-slate-800">{summaryStats?.users ?? 0}</div>
              </div>
              <div className="border rounded-md p-3">
                <div className="text-slate-500">{ta("metrics.uniqueGuests")}</div>
                <div className="text-xl font-semibold text-slate-800">{summaryStats?.guests ?? 0}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="border rounded-md p-3">
                <div className="text-sm font-semibold text-slate-700 mb-2">{ta("sections.daily")}</div>
                {dailyStats.length === 0 ? (
                  <div className="text-sm text-slate-500">{ta("empty.daily")}</div>
                ) : (
                  <div className="space-y-2">
                    {dailyStats.map((row) => {
                      const pct = maxDaily ? Math.round((row.total / maxDaily) * 100) : 0;
                      return (
                        <div key={row.day} className="text-xs text-slate-600">
                          <div className="flex items-center justify-between">
                            <span>{row.day}</span>
                            <span className="font-medium text-slate-800">{row.total}</span>
                          </div>
                          <div className="h-2 rounded bg-slate-100 overflow-hidden">
                            <div className="h-full bg-slate-900" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="border rounded-md p-3">
                <div className="text-sm font-semibold text-slate-700 mb-2">{ta("sections.topPaths")}</div>
                {topPaths.length === 0 ? (
                  <div className="text-sm text-slate-500">{ta("empty.topPaths")}</div>
                ) : (
                  <div className="space-y-2 text-sm">
                    {topPaths.map((row) => (
                      <div key={row.path} className="flex items-center justify-between">
                        <span className="text-slate-600 truncate">{row.path}</span>
                        <span className="font-medium text-slate-800">{row.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
