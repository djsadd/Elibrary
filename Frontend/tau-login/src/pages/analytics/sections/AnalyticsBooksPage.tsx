import { useEffect, useState } from "react";
import { api } from "@/shared/api/client";
import { ChartCard, ColumnChart, KpiTile, RankedBars, ShareBar } from "@/components/charts/Charts";
import { CHART, fmtInt, fmtNum } from "@/components/charts/chartUtils";
import { useAnalytics } from "../analyticsContext";
import { fmtMinutes, fmtMonth, i18nName, ti, useLangVersion } from "../../insights/shared";
import { KpiGrid, SourceState } from "./common";

function useBookTitles(ids: number[]) {
  const [titles, setTitles] = useState<Record<number, string>>({});
  const key = ids.join(",");
  useEffect(() => {
    if (!ids.length) return;
    let alive = true;
    api<{ id: number; title: string }[]>(`/api/catalog/books/batch?ids=${key}`)
      .then((books) => {
        if (!alive || !Array.isArray(books)) return;
        setTitles(Object.fromEntries(books.map((b) => [b.id, b.title])));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return titles;
}

const LANG_NAMES: Record<string, string> = { ru: "Русский", kk: "Қазақша", en: "English", kz: "Қазақша" };

export default function AnalyticsBooksPage() {
  useLangVersion();
  const { traffic, library, reload } = useAnalytics();
  const tr = traffic.data;
  const lib = library.data;
  const titles = useBookTitles(tr?.book_views.map((b) => b.book_id) ?? []);

  return (
    <SourceState loading={traffic.loading && library.loading} error={traffic.error && library.error} hasData={!!(tr || lib)} onRetry={reload}>
      <div className="space-y-4">
        <KpiGrid>
          <KpiTile
            label={ti("admin.books.catalog")}
            value={lib ? fmtInt(lib.catalog.total) : "—"}
            hint={lib ? ti("admin.books.catalogHint", { n: fmtInt(lib.catalog.public) }) : undefined}
          />
          <KpiTile
            accent
            label={ti("admin.books.coverage")}
            value={lib ? `${fmtNum(lib.catalog.coverage, 0)}%` : "—"}
            hint={lib ? ti("admin.books.coverageHint", { n: fmtInt(lib.catalog.never_opened) }) : undefined}
          />
          <KpiTile label={ti("admin.books.completion")} value={lib ? `${fmtNum(lib.kpi.completion_rate, 0)}%` : "—"} />
          <KpiTile
            label={ti("admin.books.notes")}
            value={lib ? fmtInt(lib.kpi.notes_total) : "—"}
            hint={lib ? ti("admin.books.notesHint", { n: fmtInt(lib.kpi.notes_window) }) : undefined}
          />
          <KpiTile label={ti("admin.books.downloads")} value={tr ? fmtInt(tr.downloads) : "—"} />
          <KpiTile label={ti("admin.books.searches")} value={tr ? fmtInt(tr.searches.total) : "—"} />
        </KpiGrid>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {tr && (
            <ChartCard title={ti("admin.books.mostViewed")} subtitle={ti("admin.books.mostViewedSub")}>
              <RankedBars
                items={tr.book_views.map((b) => ({
                  key: b.book_id,
                  label: titles[b.book_id] ?? ti("admin.books.unknownBook", { id: b.book_id }),
                  href: `/admin/books/${b.book_id}`,
                  value: b.visitors,
                  sub: `${fmtInt(b.views)} ${ti("admin.books.views")}`,
                }))}
                color={CHART.s2}
                emptyText={ti("common.noData")}
              />
            </ChartCard>
          )}
          {lib && (
            <ChartCard title={ti("admin.books.mostRead")} subtitle={ti("admin.books.mostReadSub")}>
              <RankedBars
                items={lib.top_books.map((b) => ({
                  key: b.id,
                  label: b.title,
                  href: `/admin/books/${b.id}`,
                  value: b.readers,
                  sub: ti("admin.books.finished", { p: fmtNum(b.completion_rate, 0) }),
                }))}
                emptyText={ti("common.noData")}
              />
            </ChartCard>
          )}
        </div>

        {lib && (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <ChartCard title={ti("admin.books.trending")} subtitle={ti("admin.books.trendingSub")}>
              <RankedBars
                items={lib.trending_books.map((b) => ({
                  key: b.id,
                  label: b.title,
                  href: `/admin/books/${b.id}`,
                  value: b.minutes,
                  sub: `${fmtInt(b.readers)} ${ti("admin.books.readers")}`,
                }))}
                format={(v) => fmtMinutes(v)}
                emptyText={ti("common.noData")}
              />
            </ChartCard>
            <ChartCard title={ti("admin.books.subjects")}>
              <RankedBars
                items={lib.top_subjects.map((s) => ({ key: s.id, label: i18nName(s), value: s.readers }))}
                format={(v) => `${fmtInt(v)} ${ti("admin.books.readers")}`}
                emptyText={ti("common.noData")}
              />
            </ChartCard>
            <ChartCard title={ti("admin.books.authors")}>
              <RankedBars
                items={lib.top_authors.map((s) => ({ key: s.id, label: i18nName(s), value: s.readers }))}
                format={(v) => `${fmtInt(v)} ${ti("admin.books.readers")}`}
                emptyText={ti("common.noData")}
              />
            </ChartCard>
          </div>
        )}

        {tr && (
          <ChartCard title={ti("admin.books.topSearches")} subtitle={tr.searches.top.length ? undefined : ti("admin.books.topSearchesHint")}>
            <RankedBars
              items={tr.searches.top.map((q) => ({ key: q.query, label: `“${q.query}”`, value: q.count }))}
              color={CHART.s2}
              emptyText={ti("common.noData")}
            />
          </ChartCard>
        )}

        {lib && (
          <>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <ChartCard title={ti("admin.books.byLang")}>
                <ShareBar
                  items={lib.catalog.by_lang}
                  labelFor={(k) => LANG_NAMES[k] ?? k}
                  otherLabel={ti("common.other")}
                  emptyText={ti("common.noData")}
                />
              </ChartCard>
              <ChartCard title={ti("admin.books.byFormat")}>
                <ShareBar items={lib.catalog.by_format} otherLabel={ti("common.other")} emptyText={ti("common.noData")} />
              </ChartCard>
              <ChartCard title={ti("admin.books.bySource")}>
                <ShareBar
                  items={lib.catalog.by_source}
                  labelFor={(k) => {
                    const v = ti(`common.sources.${k}`);
                    return v.startsWith("insights.") ? k : v;
                  }}
                  otherLabel={ti("common.other")}
                  emptyText={ti("common.noData")}
                />
              </ChartCard>
            </div>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <ChartCard title={ti("admin.books.byDecade")}>
                <ColumnChart
                  data={lib.catalog.by_decade.map((d) => ({ label: d.key.replace(/^(\d{2})(\d{2})s$/, "’$2"), tip: d.key, value: d.count }))}
                  color={CHART.s2}
                  emptyText={ti("common.noData")}
                />
              </ChartCard>
              <ChartCard title={ti("admin.books.added")}>
                <ColumnChart
                  data={lib.catalog.added_monthly.map((m) => ({ label: fmtMonth(m.month), value: m.count }))}
                  highlight={lib.catalog.added_monthly.length - 1}
                  emptyText={ti("common.noData")}
                />
              </ChartCard>
            </div>
          </>
        )}
      </div>
    </SourceState>
  );
}
