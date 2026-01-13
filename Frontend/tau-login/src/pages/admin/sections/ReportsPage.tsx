import { useEffect, useMemo, useState } from "react";
import { api } from "@/shared/api/client";
import { t } from "@/shared/i18n";

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authStats, setAuthStats] = useState<any | null>(null);
  const [catalogStats, setCatalogStats] = useState<any | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const ta = (key: string, vars?: Record<string, any>) => t(`admin.analytics.${key}`, vars);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    Promise.all([
      api<any>("/api/auth/admin/stats"),
      api<any>("/api/catalog/admin/stats"),
    ])
      .then(([auth, catalog]) => {
        if (!alive) return;
        setAuthStats(auth);
        setCatalogStats(catalog);
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
  }, []);

  const roleRows = useMemo(() => {
    const roles = authStats?.roles || {};
    return Object.entries(roles).sort((a: any, b: any) => (b[1] as number) - (a[1] as number));
  }, [authStats]);

  const formatDate = (d?: Date | null) => {
    if (!d) return "-";
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
  };

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
        </div>
      )}
    </div>
  );
}
