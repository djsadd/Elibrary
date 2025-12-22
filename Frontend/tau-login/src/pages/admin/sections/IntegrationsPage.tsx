import { useState } from "react";
import { t } from "@/shared/i18n";
import { api } from "@/shared/api/client";

type LibtauPreviewResponse = {
  total?: number;
  preview?: any[];
  message?: string;
};

type LibtauActionState = {
  loading: boolean;
  error: string | null;
  lastResponse: any | null;
};

export default function IntegrationsPage() {
  const [crawlState, setCrawlState] = useState<LibtauActionState>({
    loading: false,
    error: null,
    lastResponse: null,
  });
  const [migrateState, setMigrateState] = useState<LibtauActionState>({
    loading: false,
    error: null,
    lastResponse: null,
  });

  const callLibtau = async (
    path: string,
    setter: (s: LibtauActionState) => void,
    method: "GET" | "POST" = "GET",
  ) => {
    setter({ loading: true, error: null, lastResponse: null });
    try {
      const res = await api<any>(`/api/libtau${path}`, {
        method,
      });
      setter({ loading: false, error: null, lastResponse: res });
    } catch (e: any) {
      setter({
        loading: false,
        error: e?.message || "Request failed",
        lastResponse: null,
      });
    }
  };

  const callLibtauAndReload = (path: string, method: "GET" | "POST" = "POST") => {
    void api<any>(`/api/libtau${path}`, { method });
    window.location.reload();
  };

  const lastCrawl = crawlState.lastResponse as LibtauPreviewResponse | null;
  const lastMigrate = migrateState.lastResponse as LibtauPreviewResponse | null;

  const crawlPreview = (lastCrawl?.preview || []) as any[];
  const migratePreview = (lastMigrate?.preview || []) as any[];

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold mb-3">
        {t("admin.nav.integrations")}
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="border rounded-md p-4 space-y-3 bg-white">
          <div className="font-medium">
            {t("admin.integrations.libtau.crawl.title")}
          </div>
          <p className="text-sm text-slate-600">
            {t("admin.integrations.libtau.crawl.description")}
          </p>
          <div className="flex flex-wrap gap-2 text-sm">
            <button
              type="button"
              onClick={() => callLibtau("/crawl_pdfs", setCrawlState, "GET")}
              className="px-3 py-2 rounded-md bg-slate-700 text-white disabled:opacity-60"
              disabled={crawlState.loading}
            >
              {crawlState.loading
                ? t("admin.integrations.common.loading")
                : t("admin.integrations.libtau.crawl.previewBtn")}
            </button>
            <button
              type="button"
              onClick={() =>
                callLibtau("/crawl_pdfs/commit", setCrawlState, "POST")
              }
              className="px-3 py-2 rounded-md border border-emerald-600 text-emerald-700 disabled:opacity-60"
              disabled={crawlState.loading}
            >
              {t("admin.integrations.common.commit")}
            </button>
            <button
              type="button"
              onClick={() =>
                callLibtau("/crawl_pdfs/cancel", setCrawlState, "POST")
              }
              className="px-3 py-2 rounded-md border border-slate-300 text-slate-700 disabled:opacity-60"
              disabled={crawlState.loading}
            >
              {t("admin.integrations.common.cancel")}
            </button>
          </div>
          <div className="space-y-2">
            <div className="text-xs text-slate-500 space-y-1">
              {crawlState.error && (
                <div className="text-red-600">{crawlState.error}</div>
              )}
              {lastCrawl && (
                <div className="flex flex-wrap gap-4 items-center">
                  {typeof lastCrawl.total === "number" && (
                    <div>
                      {t("admin.integrations.common.total")}:{" "}
                      <span className="font-semibold">{lastCrawl.total}</span>
                    </div>
                  )}
                  {lastCrawl.message && (
                    <div className="text-slate-500">{lastCrawl.message}</div>
                  )}
                </div>
              )}
            </div>

            {crawlPreview.length > 0 && (
              <div className="border rounded-md overflow-hidden">
                <div className="max-h-72 overflow-auto">
                  <table className="min-w-full text-xs">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-2 py-1 text-left">PDF ID</th>
                        <th className="px-2 py-1 text-left">Title</th>
                        <th className="px-2 py-1 text-left">Integrated</th>
                        <th className="px-2 py-1 text-left">Indexed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {crawlPreview.map((row, idx) => (
                        <tr key={row.pdf_id ?? idx} className="hover:bg-slate-50">
                          <td className="px-2 py-1 font-mono">
                            {row.pdf_id ?? "-"}
                          </td>
                          <td className="px-2 py-1">
                            <div className="truncate max-w-[220px]" title={row.title}>
                              {row.title ?? "-"}
                            </div>
                          </td>
                          <td className="px-2 py-1">
                            {row.is_integrated ? (
                              <span className="inline-flex px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                                Yes
                              </span>
                            ) : (
                              <span className="inline-flex px-2 py-0.5 rounded-full bg-slate-50 text-slate-500">
                                No
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-1">
                            {(row.file_is_indexed || row.title_is_indexed) ? (
                              <span className="inline-flex px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                                Yes
                              </span>
                            ) : (
                              <span className="inline-flex px-2 py-0.5 rounded-full bg-slate-50 text-slate-500">
                                No
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-2 py-1 text-[11px] text-slate-400 border-t bg-slate-50">
                  Showing preview of first {crawlPreview.length} items
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="border rounded-md p-4 space-y-3 bg-white">
          <div className="font-medium">
            {t("admin.integrations.libtau.migrate.title")}
          </div>
          <p className="text-sm text-slate-600">
            {t("admin.integrations.libtau.migrate.description")}
          </p>
          <div className="flex flex-wrap gap-2 text-sm">
            <button
              type="button"
              onClick={() =>
                callLibtau("/migrate_subjects/preview", setMigrateState, "GET")
              }
              className="px-3 py-2 rounded-md bg-slate-700 text-white disabled:opacity-60"
              disabled={migrateState.loading}
            >
              {migrateState.loading
                ? t("admin.integrations.common.loading")
                : t("admin.integrations.libtau.migrate.previewBtn")}
            </button>
            <button
              type="button"
              onClick={() =>
                callLibtauAndReload("/migrate_subjects/commit", "POST")
              }
              className="px-3 py-2 rounded-md border border-emerald-600 text-emerald-700 disabled:opacity-60"
              disabled={migrateState.loading}
            >
              {t("admin.integrations.common.commit")}
            </button>
            <button
              type="button"
              onClick={() =>
                callLibtauAndReload("/migrate_subjects/cancel", "POST")
              }
              className="px-3 py-2 rounded-md border border-slate-300 text-slate-700 disabled:opacity-60"
              disabled={migrateState.loading}
            >
              {t("admin.integrations.common.cancel")}
            </button>
          </div>
          <div className="space-y-2">
            <div className="text-xs text-slate-500 space-y-1">
              {migrateState.error && (
                <div className="text-red-600">{migrateState.error}</div>
              )}
              {lastMigrate && (
                <div className="flex flex-wrap gap-4 items-center">
                  {typeof lastMigrate.total === "number" && (
                    <div>
                      {t("admin.integrations.common.total")}:{" "}
                      <span className="font-semibold">{lastMigrate.total}</span>
                    </div>
                  )}
                  {lastMigrate.message && (
                    <div className="text-slate-500">{lastMigrate.message}</div>
                  )}
                </div>
              )}
            </div>

            {migratePreview.length > 0 && (
              <div className="border rounded-md overflow-hidden">
                <div className="max-h-72 overflow-auto">
                  <table className="min-w-full text-xs">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-2 py-1 text-left">ID</th>
                        <th className="px-2 py-1 text-left">Title</th>
                        <th className="px-2 py-1 text-left">PDF ID</th>
                        <th className="px-2 py-1 text-left">Path</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {migratePreview.map((row, idx) => (
                        <tr key={row.id ?? idx} className="hover:bg-slate-50">
                          <td className="px-2 py-1 font-mono text-[11px]">
                            {row.id ?? "-"}
                          </td>
                          <td className="px-2 py-1">
                            <div className="truncate max-w-[220px]" title={row.title}>
                              {row.title ?? "-"}
                            </div>
                          </td>
                          <td className="px-2 py-1 font-mono text-[11px]">
                            {row.pdf_id ?? "-"}
                          </td>
                          <td className="px-2 py-1">
                            <div
                              className="truncate max-w-[260px] text-slate-500"
                              title={row.path_titles}
                            >
                              {row.path_titles ?? "-"}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-2 py-1 text-[11px] text-slate-400 border-t bg-slate-50">
                  Showing preview of first {migratePreview.length} items
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
