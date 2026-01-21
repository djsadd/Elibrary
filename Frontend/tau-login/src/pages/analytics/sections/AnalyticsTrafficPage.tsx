import { useEffect, useMemo, useState } from "react";
import { api } from "@/shared/api/client";
import { t } from "@/shared/i18n";

type DailyStatsRow = {
  day: string; // YYYY-MM-DD
  total: number;
  users: number;
  guests: number;
};

type VisitorRow = {
  kind: "user" | "guest";
  user_id: number | null;
  anon_id: string | null;
  ip: string | null;
  events: number;
  sessions: number;
  paths: number;
  first_seen: string;
  last_seen: string;
};

type VisitorsPage = {
  total: number;
  items: VisitorRow[];
};

type EventOut = {
  id: number;
  event_time: string;
  event_type: string;
  user_id: number | null;
  anon_id: string | null;
  session_id: string | null;
  path: string | null;
  method: string | null;
  status_code: number | null;
  user_agent?: string | null;
  referrer?: string | null;
  ip: string | null;
  ip_hash?: string | null;
  request_id?: string | null;
  service: string | null;
  is_authenticated?: boolean | null;
  meta?: any;
};

type EventsPage = {
  total: number;
  items: EventOut[];
};

function toYmdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtDateTime(s?: string | null): string {
  if (!s) return "-";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
}

function fmtTime(s?: string | null): string {
  if (!s) return "-";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleTimeString();
}

function prettyJson(value: any): string {
  if (value == null) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function AnalyticsTrafficPage() {
  const today = useMemo(() => new Date(), []);
  const [fromStr, setFromStr] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return toYmdLocal(d);
  });
  const [toStr, setToStr] = useState(() => toYmdLocal(today));
  const [who, setWho] = useState<"all" | "users" | "guests">("all");

  const [loadingDaily, setLoadingDaily] = useState(true);
  const [dailyError, setDailyError] = useState<string | null>(null);
  const [daily, setDaily] = useState<DailyStatsRow[]>([]);

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [visitors, setVisitors] = useState<VisitorsPage | null>(null);
  const [events, setEvents] = useState<EventsPage | null>(null);
  const [userEmails, setUserEmails] = useState<Record<string, string>>({});

  const [eventModalId, setEventModalId] = useState<number | null>(null);
  const [eventModalLoading, setEventModalLoading] = useState(false);
  const [eventModalError, setEventModalError] = useState<string | null>(null);
  const [eventModalEvent, setEventModalEvent] = useState<EventOut | null>(null);

  useEffect(() => {
    let alive = true;
    setLoadingDaily(true);
    setDailyError(null);
    api<DailyStatsRow[]>(`/api/analytics/stats/daily?from=${fromStr}&to=${toStr}&event_type=api_request`)
      .then((rows) => {
        if (!alive) return;
        const list = Array.isArray(rows) ? rows : [];
        setDaily(list);
        setSelectedDay((prev) => prev && list.some((r) => r.day === prev) ? prev : (list.at(-1)?.day ?? null));
      })
      .catch((e) => {
        if (!alive) return;
        setDailyError(e?.message || t("analytics.traffic.failed"));
      })
      .finally(() => {
        if (!alive) return;
        setLoadingDaily(false);
      });

    return () => {
      alive = false;
    };
  }, [fromStr, toStr]);

  useEffect(() => {
    let alive = true;
    if (!selectedDay) return;
    setLoadingDetails(true);
    setDetailsError(null);
    Promise.all([
      api<VisitorsPage>(`/api/analytics/stats/visitors?from=${selectedDay}&to=${selectedDay}&event_type=api_request&who=${who}&limit=200`),
      api<EventsPage>(`/api/analytics/stats/events?from=${selectedDay}&to=${selectedDay}&event_type=api_request&who=${who}&limit=200`),
    ])
      .then(([v, ev]) => {
        if (!alive) return;
        setVisitors(v);
        setEvents(ev);
      })
      .catch((e) => {
        if (!alive) return;
        setDetailsError(e?.message || t("analytics.traffic.failed"));
      })
      .finally(() => {
        if (!alive) return;
        setLoadingDetails(false);
      });
    return () => {
      alive = false;
    };
  }, [selectedDay, who]);

  useEffect(() => {
    let alive = true;
    const ids =
      (visitors?.items || [])
        .filter((v) => v.kind === "user" && v.user_id != null)
        .map((v) => v.user_id as number) || [];
    const unique = Array.from(new Set(ids)).filter((id) => !userEmails[String(id)]);
    if (unique.length === 0) return;

    const load = async () => {
      const next: Record<string, string> = {};
      for (const id of unique.slice(0, 50)) {
        try {
          const u = await api<{ id: number; email: string }>(`/api/auth/users/${encodeURIComponent(String(id))}`);
          if (u?.email) next[String(id)] = u.email;
        } catch {
          // ignore
        }
      }
      if (!alive) return;
      if (Object.keys(next).length) setUserEmails((prev) => ({ ...prev, ...next }));
    };
    load();
    return () => {
      alive = false;
    };
  }, [visitors, userEmails]);

  useEffect(() => {
    if (eventModalId == null) return;
    let alive = true;
    setEventModalLoading(true);
    setEventModalError(null);
    setEventModalEvent(null);
    api<EventOut>(`/api/analytics/traffic/${encodeURIComponent(String(eventModalId))}`)
      .then((ev) => {
        if (!alive) return;
        setEventModalEvent(ev);
      })
      .catch((e) => {
        if (!alive) return;
        setEventModalError(e?.message || t("analytics.traffic.failed"));
      })
      .finally(() => {
        if (!alive) return;
        setEventModalLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [eventModalId]);

  useEffect(() => {
    if (eventModalId == null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEventModalId(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [eventModalId]);

  const maxDaily = useMemo(() => daily.reduce((max, r) => Math.max(max, r.total || 0), 0), [daily]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-slate-800">{t("analytics.tabs.traffic")}</h3>
          <div className="text-xs text-slate-500">{t("analytics.traffic.hint")}</div>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-slate-600">
            {t("analytics.traffic.from")}
            <input
              type="date"
              value={fromStr}
              onChange={(e) => setFromStr(e.target.value)}
              className="ml-2 border rounded px-2 py-1 text-sm"
            />
          </label>
          <label className="text-xs text-slate-600">
            {t("analytics.traffic.to")}
            <input
              type="date"
              value={toStr}
              onChange={(e) => setToStr(e.target.value)}
              className="ml-2 border rounded px-2 py-1 text-sm"
            />
          </label>
          <label className="text-xs text-slate-600">
            {t("analytics.traffic.who")}
            <select
              value={who}
              onChange={(e) => setWho(e.target.value as any)}
              className="ml-2 border rounded px-2 py-1 text-sm bg-white"
            >
              <option value="all">{t("analytics.traffic.whoAll")}</option>
              <option value="users">{t("analytics.traffic.whoUsers")}</option>
              <option value="guests">{t("analytics.traffic.whoGuests")}</option>
            </select>
          </label>
        </div>
      </div>

      <div className="border rounded-md p-3">
        <div className="text-sm font-semibold text-slate-700 mb-2">{t("analytics.traffic.dailyHeading")}</div>
        {loadingDaily && <div className="text-sm text-slate-500">{t("analytics.traffic.loading")}</div>}
        {!loadingDaily && dailyError && <div className="text-sm text-red-600">{dailyError}</div>}
        {!loadingDaily && !dailyError && daily.length === 0 && (
          <div className="text-sm text-slate-500">{t("analytics.empty")}</div>
        )}

        {!loadingDaily && !dailyError && daily.length > 0 && (
          <div className="space-y-3">
            <div className="space-y-2">
              {daily.map((row) => {
                const pct = maxDaily ? Math.round((row.total / maxDaily) * 100) : 0;
                const active = selectedDay === row.day;
                return (
                  <button
                    type="button"
                    key={row.day}
                    onClick={() => setSelectedDay(row.day)}
                    className={`w-full text-left border rounded-md px-3 py-2 ${
                      active ? "border-slate-900 bg-slate-50" : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span className="font-medium text-slate-800">{row.day}</span>
                      <span>
                        {t("analytics.traffic.total")}: <span className="font-semibold text-slate-900">{row.total}</span>
                        {" • "}
                        {t("analytics.traffic.users")}: {row.users}
                        {" • "}
                        {t("analytics.traffic.guests")}: {row.guests}
                      </span>
                    </div>
                    <div className="mt-2 h-2 rounded bg-slate-100 overflow-hidden">
                      <div className="h-full bg-slate-900" style={{ width: `${pct}%` }} />
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-slate-500">
                  <tr>
                    <th className="text-left py-2">{t("analytics.traffic.day")}</th>
                    <th className="text-right py-2">{t("analytics.traffic.total")}</th>
                    <th className="text-right py-2">{t("analytics.traffic.users")}</th>
                    <th className="text-right py-2">{t("analytics.traffic.guests")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {daily.map((row) => (
                    <tr key={row.day} className={selectedDay === row.day ? "bg-slate-50" : ""}>
                      <td className="py-2">
                        <button type="button" className="text-[#7b0f2b] hover:underline" onClick={() => setSelectedDay(row.day)}>
                          {row.day}
                        </button>
                      </td>
                      <td className="py-2 text-right">{row.total}</td>
                      <td className="py-2 text-right">{row.users}</td>
                      <td className="py-2 text-right">{row.guests}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="border rounded-md p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-700">
            {t("analytics.traffic.detailsFor")}: <span className="text-slate-900">{selectedDay || "-"}</span>
          </div>
          {loadingDetails && <div className="text-xs text-slate-500">{t("analytics.traffic.loading")}</div>}
        </div>
        {detailsError && <div className="text-sm text-red-600">{detailsError}</div>}

        {!detailsError && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="border rounded-md p-3">
              <div className="text-sm font-semibold text-slate-700 mb-2">
                {t("analytics.traffic.visitors")} ({visitors?.total ?? 0})
              </div>
              {!visitors || visitors.items.length === 0 ? (
                <div className="text-sm text-slate-500">{t("analytics.empty")}</div>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-slate-500">
                      <tr>
                        <th className="text-left py-2">{t("analytics.traffic.kind")}</th>
                        <th className="text-left py-2">{t("analytics.traffic.visitor")}</th>
                        <th className="text-left py-2">{t("analytics.traffic.ip")}</th>
                        <th className="text-right py-2">{t("analytics.traffic.events")}</th>
                        <th className="text-right py-2">{t("analytics.traffic.sessions")}</th>
                        <th className="text-right py-2">{t("analytics.traffic.paths")}</th>
                        <th className="text-left py-2">{t("analytics.traffic.lastSeen")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {visitors.items.map((v) => (
                        <tr key={`${v.kind}:${v.user_id ?? ""}:${v.anon_id ?? ""}:${v.ip ?? ""}`}>
                          <td className="py-2">{v.kind}</td>
                          <td className="py-2">
                            {v.kind === "user"
                              ? (v.user_id != null ? (userEmails[String(v.user_id)] || `user:${v.user_id}`) : "-")
                              : `anon:${(v.anon_id || "-").slice(0, 12)}`}
                          </td>
                          <td className="py-2 font-mono text-xs text-slate-600">{v.ip || "-"}</td>
                          <td className="py-2 text-right">{v.events}</td>
                          <td className="py-2 text-right">{v.sessions}</td>
                          <td className="py-2 text-right">{v.paths}</td>
                          <td className="py-2">{fmtDateTime(v.last_seen)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="border rounded-md p-3">
              <div className="text-sm font-semibold text-slate-700 mb-2">
                {t("analytics.traffic.eventsTable")} ({events?.total ?? 0})
              </div>
              {!events || events.items.length === 0 ? (
                <div className="text-sm text-slate-500">{t("analytics.empty")}</div>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-slate-500">
                      <tr>
                        <th className="text-left py-2">{t("analytics.traffic.time")}</th>
                        <th className="text-left py-2">{t("analytics.traffic.kind")}</th>
                        <th className="text-left py-2">{t("analytics.traffic.visitor")}</th>
                        <th className="text-left py-2">{t("analytics.traffic.path")}</th>
                        <th className="text-left py-2">{t("analytics.traffic.method")}</th>
                        <th className="text-right py-2">{t("analytics.traffic.status")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {events.items.map((ev) => {
                        const kind = ev.user_id ? "user" : "guest";
                        const visitor = ev.user_id
                          ? (userEmails[String(ev.user_id)] || `user:${ev.user_id}`)
                          : `anon:${(ev.anon_id || "-").slice(0, 12)}`;
                        return (
                          <tr
                            key={ev.id}
                            className="hover:bg-slate-50 cursor-pointer"
                            onClick={() => setEventModalId(ev.id)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") setEventModalId(ev.id);
                            }}
                          >
                            <td className="py-2">{fmtTime(ev.event_time)}</td>
                            <td className="py-2">{kind}</td>
                            <td className="py-2">{visitor}</td>
                            <td className="py-2 text-slate-700">{ev.path || "-"}</td>
                            <td className="py-2 text-slate-600">{ev.method || "-"}</td>
                            <td className="py-2 text-right">{ev.status_code ?? "-"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {eventModalId != null && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEventModalId(null)} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-3xl bg-white rounded-lg shadow-xl">
              <div className="flex items-center justify-between px-5 py-4 border-b">
                <div>
                  <div className="text-lg font-semibold text-slate-900">{t("analytics.traffic.eventDetails")}</div>
                  <div className="text-xs text-slate-500">
                    ID: <span className="font-mono">{eventModalId}</span>
                  </div>
                </div>
                <button
                  onClick={() => setEventModalId(null)}
                  className="p-2 rounded-md hover:bg-slate-100"
                  aria-label={t("analytics.traffic.close")}
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M6 6l12 12M6 18L18 6" />
                  </svg>
                </button>
              </div>

              <div className="p-5 space-y-4 max-h-[75vh] overflow-auto">
                {eventModalLoading && <div className="text-sm text-slate-500">{t("analytics.traffic.loading")}</div>}
                {eventModalError && <div className="text-sm text-red-600">{eventModalError}</div>}

                {!eventModalLoading && !eventModalError && eventModalEvent && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div className="border rounded-md p-3">
                        <div className="text-xs text-slate-500 mb-1">{t("analytics.traffic.time")}</div>
                        <div className="text-slate-900">{fmtDateTime(eventModalEvent.event_time)}</div>
                      </div>
                      <div className="border rounded-md p-3">
                        <div className="text-xs text-slate-500 mb-1">{t("analytics.traffic.status")}</div>
                        <div className="text-slate-900">{eventModalEvent.status_code ?? "-"}</div>
                      </div>
                      <div className="border rounded-md p-3 sm:col-span-2">
                        <div className="text-xs text-slate-500 mb-1">{t("analytics.traffic.request")}</div>
                        <div className="font-mono text-xs text-slate-900 break-all">
                          {(eventModalEvent.method || "GET").toUpperCase()} {eventModalEvent.path || "-"}
                        </div>
                      </div>
                      <div className="border rounded-md p-3">
                        <div className="text-xs text-slate-500 mb-1">{t("analytics.traffic.ip")}</div>
                        <div className="font-mono text-xs text-slate-900">{eventModalEvent.ip || "-"}</div>
                      </div>
                      <div className="border rounded-md p-3">
                        <div className="text-xs text-slate-500 mb-1">{t("analytics.traffic.service")}</div>
                        <div className="text-slate-900">{eventModalEvent.service || "-"}</div>
                      </div>
                      <div className="border rounded-md p-3">
                        <div className="text-xs text-slate-500 mb-1">{t("analytics.traffic.requestId")}</div>
                        <div className="font-mono text-xs text-slate-900 break-all">{eventModalEvent.request_id || "-"}</div>
                      </div>
                      <div className="border rounded-md p-3">
                        <div className="text-xs text-slate-500 mb-1">{t("analytics.traffic.visitor")}</div>
                        <div className="text-slate-900">
                          {eventModalEvent.user_id != null
                            ? (userEmails[String(eventModalEvent.user_id)] || `user:${eventModalEvent.user_id}`)
                            : `anon:${(eventModalEvent.anon_id || "-").slice(0, 12)}`}
                        </div>
                      </div>
                      <div className="border rounded-md p-3 sm:col-span-2">
                        <div className="text-xs text-slate-500 mb-1">{t("analytics.traffic.userAgent")}</div>
                        <div className="text-xs text-slate-700 break-words">{eventModalEvent.user_agent || "-"}</div>
                      </div>
                      <div className="border rounded-md p-3 sm:col-span-2">
                        <div className="text-xs text-slate-500 mb-1">{t("analytics.traffic.referrer")}</div>
                        <div className="text-xs text-slate-700 break-words">{eventModalEvent.referrer || "-"}</div>
                      </div>
                    </div>

                    <div className="border rounded-md p-3">
                      <div className="text-sm font-semibold text-slate-700 mb-2">{t("analytics.traffic.requestMeta")}</div>
                      {eventModalEvent.meta?.request ? (
                        <div className="space-y-3">
                          <div>
                            <div className="text-xs text-slate-500 mb-1">{t("analytics.traffic.query")}</div>
                            <pre className="text-xs bg-slate-50 rounded p-3 overflow-auto">{prettyJson(eventModalEvent.meta.request.query) || "{}"}</pre>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500 mb-1">{t("analytics.traffic.headers")}</div>
                            <pre className="text-xs bg-slate-50 rounded p-3 overflow-auto">{prettyJson(eventModalEvent.meta.request.headers) || "{}"}</pre>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500 mb-1">{t("analytics.traffic.body")}</div>
                            {eventModalEvent.meta.request.body_skipped ? (
                              <div className="text-xs text-slate-600">
                                {t("analytics.traffic.bodySkipped")}: {String(eventModalEvent.meta.request.body_skip_reason || "-")}
                              </div>
                            ) : (
                              <>
                                <div className="text-xs text-slate-600 mb-2">
                                  {t("analytics.traffic.contentType")}: {String(eventModalEvent.meta.request.body?.content_type || "-")} ·{" "}
                                  {t("analytics.traffic.bodySize")}: {String(eventModalEvent.meta.request.body?.body_size ?? "-")} ·{" "}
                                  {t("analytics.traffic.truncated")}: {String(!!eventModalEvent.meta.request.body?.body_truncated)}
                                </div>
                                {eventModalEvent.meta.request.body?.json != null ? (
                                  <pre className="text-xs bg-slate-50 rounded p-3 overflow-auto">
                                    {prettyJson(eventModalEvent.meta.request.body.json)}
                                  </pre>
                                ) : (
                                  <pre className="text-xs bg-slate-50 rounded p-3 overflow-auto">
                                    {String(eventModalEvent.meta.request.body?.body_preview || eventModalEvent.meta.request.body?.json_error || "-")}
                                  </pre>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-slate-500">{t("analytics.empty")}</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
