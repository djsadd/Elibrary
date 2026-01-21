import { useEffect, useMemo, useState } from "react";
import { api } from "@/shared/api/client";
import { t } from "@/shared/i18n";

const MIDDLE_DOT = String.fromCharCode(0x00b7);
const ELLIPSIS = String.fromCharCode(0x2026);

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

function visitorKey(v: VisitorRow): string {
  return `${v.kind}:${v.user_id ?? ""}:${v.anon_id ?? ""}:${v.ip ?? ""}`;
}

function clipText(s: string, n: number): string {
  if (s.length <= n) return s;
  return `${s.slice(0, n)}…`;
}

function chipLabel(kind: string, value: string): string {
  return `${kind}: ${value}`;
}

function clip(s: string, n: number): string {
  if (s.length <= n) return s;
  return `${s.slice(0, n)}…`;
}

function ymdToDate(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return new Date(y, mo - 1, d, 12, 0, 0, 0);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0, 0);
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function clampRange(from: Date, to: Date): { from: Date; to: Date } {
  return from.getTime() <= to.getTime() ? { from, to } : { from: to, to: from };
}

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
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [visitors, setVisitors] = useState<VisitorsPage | null>(null);
  const [events, setEvents] = useState<EventsPage | null>(null);
  const [userProfiles, setUserProfiles] = useState<Record<string, { email?: string; first_name?: string; last_name?: string }>>({});
  const [selectedVisitor, setSelectedVisitor] = useState<VisitorRow | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [methodFilter, setMethodFilter] = useState<string>("");
  const [statusCodeFilter, setStatusCodeFilter] = useState<string>("");
  const [pathPrefixFilter, setPathPrefixFilter] = useState<string>("");
  const [userIdFilter, setUserIdFilter] = useState<string>("");
  const [eventsLimit, setEventsLimit] = useState<number>(50);
  const [eventsOffset, setEventsOffset] = useState<number>(0);
  const [loadingVisitors, setLoadingVisitors] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);

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
    setSelectedVisitor(null);
    setSelectedRequestId(null);
    setEventsOffset(0);
  }, [selectedDay, who]);

  useEffect(() => {
    if (eventsOffset === 0) return;
    setEventsOffset(0);
  }, [selectedVisitor, selectedRequestId, methodFilter, statusCodeFilter, pathPrefixFilter, userIdFilter, eventsLimit, eventsOffset]);

  const formatUserLabel = (id: number): string => {
    const p = userProfiles[String(id)];
    const fio = [p?.last_name, p?.first_name].filter(Boolean).join(" ").trim();
    const email = p?.email || "";
    if (fio && email) return `${fio} ${MIDDLE_DOT} ${email}`;
    if (fio) return fio;
    if (email) return email;
    return `user:${id}`;
  };

  const selectedVisitorLabel = useMemo(() => {
    if (!selectedVisitor) return "";
    if (selectedVisitor.kind === "user") {
      const id = selectedVisitor.user_id;
      if (id == null) return "-";
      return formatUserLabel(id);
    }
    const anon = `anon:${(selectedVisitor.anon_id || "-").slice(0, 12)}`;
    return selectedVisitor.ip ? `${anon} · ${selectedVisitor.ip}` : anon;
  }, [selectedVisitor, userProfiles]);

  const selectedRequestLabel = useMemo(() => {
    if (!selectedRequestId) return "";
    return clipText(selectedRequestId, 24);
  }, [selectedRequestId]);

  const userOptions = useMemo(() => {
    const items = (visitors?.items || []).filter((v) => v.kind === "user" && v.user_id != null);
    const unique = new Map<number, string>();
    for (const v of items) {
      const id = v.user_id as number;
      const label = formatUserLabel(id);
      unique.set(id, label);
    }
    return Array.from(unique.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, label]) => ({ id, label }));
  }, [visitors, userProfiles]);

  const selectedUserLabel = useMemo(() => {
    const raw = userIdFilter.trim();
    if (!raw) return "";
    const id = Number(raw);
    if (!Number.isFinite(id)) return raw;
    return formatUserLabel(id);
  }, [userIdFilter, userProfiles]);

  const selectedVisitorLabelDisplay = useMemo(() => {
    const badDot = String.fromCharCode(0x0412, 0x00b7);
    return selectedVisitorLabel.replace(badDot, "·");
  }, [selectedVisitorLabel]);

  const selectedVisitorLabelUi = useMemo(
    () => selectedVisitorLabel.replace(String.fromCharCode(0x0412, 0x00b7), MIDDLE_DOT),
    [selectedVisitorLabel],
  );

  const buildEventsUrl = (offset: number, limit: number) => {
    if (!selectedDay) return "";
    const q = new URLSearchParams();
    q.set("from", selectedDay);
    q.set("to", selectedDay);
    const userIdNum = userIdFilter.trim() ? Number(userIdFilter.trim()) : NaN;
    const hasUserId = Number.isFinite(userIdNum) && userIdNum > 0;
    q.set("who", selectedVisitor || hasUserId ? "all" : who);
    q.set("limit", String(limit));
    q.set("offset", String(offset));

    if (selectedVisitor) {
      if (selectedVisitor.kind === "user" && selectedVisitor.user_id != null) {
        q.set("user_id", String(selectedVisitor.user_id));
      } else {
        if (selectedVisitor.anon_id) q.set("anon_id", selectedVisitor.anon_id);
        if (selectedVisitor.ip) q.set("ip", selectedVisitor.ip);
      }
    } else if (hasUserId) {
      q.set("user_id", String(Math.trunc(userIdNum)));
    }

    if (selectedRequestId) q.set("request_id", selectedRequestId);
    if (methodFilter) q.set("method", methodFilter);
    const statusNum = statusCodeFilter.trim() ? Number(statusCodeFilter.trim()) : NaN;
    if (Number.isFinite(statusNum)) q.set("status_code", String(Math.trunc(statusNum)));
    if (pathPrefixFilter.trim()) q.set("path_prefix", pathPrefixFilter.trim());

    return `/api/analytics/traffic?${q.toString()}`;
  };

  useEffect(() => {
    let alive = true;
    if (!selectedDay) return;
    setLoadingVisitors(true);
    setDetailsError(null);
    api<VisitorsPage>(`/api/analytics/stats/visitors?from=${selectedDay}&to=${selectedDay}&event_type=api_request&who=${who}&limit=200`)
      .then((v) => {
        if (!alive) return;
        setVisitors(v);
      })
      .catch((e) => {
        if (!alive) return;
        setDetailsError(e?.message || t("analytics.traffic.failed"));
      })
      .finally(() => {
        if (!alive) return;
        setLoadingVisitors(false);
      });
    return () => {
      alive = false;
    };
  }, [selectedDay, who]);

  useEffect(() => {
    let alive = true;
    if (!selectedDay) return;
    const url = buildEventsUrl(eventsOffset, eventsLimit);
    if (!url) return;
    setLoadingEvents(true);
    setDetailsError(null);
    setEvents(null);
    api<EventsPage>(url)
      .then((ev) => {
        if (!alive) return;
        setEvents(ev);
      })
      .catch((e) => {
        if (!alive) return;
        setDetailsError(e?.message || t("analytics.traffic.failed"));
      })
      .finally(() => {
        if (!alive) return;
        setLoadingEvents(false);
      });
    return () => {
      alive = false;
    };
  }, [selectedDay, who, selectedVisitor, selectedRequestId, methodFilter, statusCodeFilter, pathPrefixFilter, userIdFilter, eventsOffset, eventsLimit]);

  useEffect(() => {
    let alive = true;
    const ids =
      (visitors?.items || [])
        .filter((v) => v.kind === "user" && v.user_id != null)
        .map((v) => v.user_id as number) || [];
    const unique = Array.from(new Set(ids)).filter((id) => !userProfiles[String(id)]);
    if (unique.length === 0) return;

    const load = async () => {
      const next: Record<string, { email?: string; first_name?: string; last_name?: string }> = {};
      for (const id of unique.slice(0, 50)) {
        try {
          const u = await api<{ id: number; email?: string; first_name?: string; last_name?: string }>(
            `/api/auth/users/${encodeURIComponent(String(id))}`,
          );
          next[String(id)] = { email: u?.email, first_name: u?.first_name, last_name: u?.last_name };
        } catch {
          // ignore
        }
      }
      if (!alive) return;
      if (Object.keys(next).length) setUserProfiles((prev) => ({ ...prev, ...next }));
    };
    load();
    return () => {
      alive = false;
    };
  }, [visitors, userProfiles]);

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
  const selectedDayRow = useMemo(() => (selectedDay ? daily.find((d) => d.day === selectedDay) : null), [daily, selectedDay]);

  const selectedVisitorId = selectedVisitor ? visitorKey(selectedVisitor) : "";

  const loadingDetails = loadingVisitors || loadingEvents;
  const totalEvents = events?.total ?? 0;
  const page = eventsLimit > 0 ? Math.floor(eventsOffset / eventsLimit) + 1 : 1;
  const totalPages = eventsLimit > 0 ? Math.max(1, Math.ceil(totalEvents / eventsLimit)) : 1;
  const canPrevPage = eventsOffset > 0;
  const canNextPage = eventsOffset + eventsLimit < totalEvents;

  const clearAllFilters = () => {
    setWho("all");
    setSelectedVisitor(null);
    setSelectedRequestId(null);
    setMethodFilter("");
    setStatusCodeFilter("");
    setPathPrefixFilter("");
    setUserIdFilter("");
    setEventsOffset(0);
  };

  const FilterChip = ({ label, onClear }: { label: string; onClear?: () => void }) => (
    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 shadow-sm">
      <span className="whitespace-nowrap">{label}</span>
      {onClear && (
        <button
          type="button"
          className="rounded-full p-1 text-slate-500 hover:bg-slate-50 hover:text-slate-800"
          aria-label={t("analytics.traffic.clearFilter")}
          onClick={onClear}
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M6 6l12 12M6 18L18 6" />
          </svg>
        </button>
      )}
    </span>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-slate-900">{t("analytics.tabs.traffic")}</h3>
          <div className="text-xs text-slate-500">{t("analytics.traffic.hint")}</div>
        </div>

        <div />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="text-sm font-semibold text-slate-800">{t("analytics.traffic.dailyHeading")}</div>
          <div className="text-xs text-slate-500">
            {fromStr} – {toStr}
          </div>
        </div>
        {loadingDaily && <div className="text-sm text-slate-500">{t("analytics.traffic.loading")}</div>}
        {!loadingDaily && dailyError && <div className="text-sm text-red-600">{dailyError}</div>}
        {!loadingDaily && !dailyError && daily.length === 0 && (
          <div className="text-sm text-slate-500">{t("analytics.empty")}</div>
        )}

        {!loadingDaily && !dailyError && daily.length > 0 && (
          <>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              <div className="lg:col-span-4">
                <div className="text-xs text-slate-500">{t("analytics.traffic.detailsFor")}</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">{selectedDay || "-"}</div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[11px] text-slate-500">{t("analytics.traffic.total")}</div>
                    <div className="mt-1 text-base font-semibold text-slate-900">{selectedDayRow?.total ?? "-"}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[11px] text-slate-500">{t("analytics.traffic.users")}</div>
                    <div className="mt-1 text-base font-semibold text-slate-900">{selectedDayRow?.users ?? "-"}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[11px] text-slate-500">{t("analytics.traffic.guests")}</div>
                    <div className="mt-1 text-base font-semibold text-slate-900">{selectedDayRow?.guests ?? "-"}</div>
                  </div>
                </div>
                <div className="mt-3 text-xs text-slate-500">{t("analytics.traffic.clickDayHint")}</div>
              </div>

              <div className="lg:col-span-8">
                <div className="flex h-44 items-end gap-1 rounded-lg border border-slate-200 bg-gradient-to-b from-white to-slate-50 px-3 pb-3 pt-10">
                  {daily.map((row) => {
                    const active = selectedDay === row.day;
                    const h = maxDaily ? Math.max(6, Math.min(92, Math.round((row.total / maxDaily) * 100))) : 6;
                    const visitorsCount = (row.users || 0) + (row.guests || 0);
                    const reqPerVisitor = visitorsCount ? (row.total / visitorsCount).toFixed(1) : "-";
                    return (
                      <button
                        key={row.day}
                        type="button"
                        title={`${row.day} · ${t("analytics.traffic.total")}: ${row.total}`}
                        onClick={() => setSelectedDay(row.day)}
                        className={`flex-1 relative rounded-md transition ${active ? "bg-slate-900" : "bg-slate-200 hover:bg-slate-300"}`}
                        style={{ height: `${h}%` }}
                        aria-label={row.day}
                      >
                        <span
                          className={`absolute -top-7 left-1/2 -translate-x-1/2 text-[10px] leading-none whitespace-nowrap pointer-events-none ${
                            active ? "text-slate-900 font-semibold" : "text-slate-600 font-medium"
                          }`}
                        >
                          {row.total}
                          <br />
                          <span className="text-[9px] text-slate-500 font-normal">
                            {row.users}/{row.guests} · {reqPerVisitor}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                  <div>{daily.at(0)?.day || ""}</div>
                  <div>{daily.at(-1)?.day || ""}</div>
                </div>
                <div className="mt-3 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
                  <DateRangePicker
                    fromStr={fromStr}
                    toStr={toStr}
                    onApply={(nextFrom, nextTo) => {
                      setFromStr(nextFrom);
                      setToStr(nextTo);
                    }}
                  />
                  <label className="text-xs text-slate-600">
                    {t("analytics.traffic.who")}
                    <select
                      value={who}
                      onChange={(e) => setWho(e.target.value as any)}
                      className="ml-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm"
                    >
                      <option value="all">{t("analytics.traffic.whoAll")}</option>
                      <option value="users">{t("analytics.traffic.whoUsers")}</option>
                      <option value="guests">{t("analytics.traffic.whoGuests")}</option>
                    </select>
                  </label>
                </div>
              </div>
            </div>

            <div className="space-y-3 hidden">
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
          </>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-slate-800">
              {t("analytics.traffic.detailsFor")}: <span className="text-slate-900">{selectedDay || "-"}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <FilterChip label={chipLabel(t("analytics.traffic.range"), `${fromStr} – ${toStr}`)} />
              <FilterChip
                label={chipLabel(
                  t("analytics.traffic.who"),
                  who === "all" ? t("analytics.traffic.whoAll") : who === "users" ? t("analytics.traffic.whoUsers") : t("analytics.traffic.whoGuests"),
                )}
                onClear={who === "all" ? undefined : () => setWho("all")}
              />
              {selectedVisitor && (
                <FilterChip label={chipLabel(t("analytics.traffic.visitor"), selectedVisitorLabelUi)} onClear={() => setSelectedVisitor(null)} />
              )}
              {selectedRequestId && (
                <FilterChip
                  label={chipLabel(t("analytics.traffic.requestId"), selectedRequestLabel)}
                  onClear={() => setSelectedRequestId(null)}
                />
              )}
              {!!userIdFilter.trim() && !selectedVisitor && (
                <FilterChip label={chipLabel(t("analytics.traffic.user"), selectedUserLabel)} onClear={() => setUserIdFilter("")} />
              )}
              {!!methodFilter && <FilterChip label={chipLabel(t("analytics.traffic.method"), methodFilter)} onClear={() => setMethodFilter("")} />}
              {!!statusCodeFilter.trim() && (
                <FilterChip label={chipLabel(t("analytics.traffic.status"), statusCodeFilter.trim())} onClear={() => setStatusCodeFilter("")} />
              )}
              {!!pathPrefixFilter.trim() && (
                <FilterChip label={chipLabel(t("analytics.traffic.path"), pathPrefixFilter.trim())} onClear={() => setPathPrefixFilter("")} />
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {(selectedVisitor || selectedRequestId || who !== "all" || methodFilter || statusCodeFilter || pathPrefixFilter || userIdFilter) && (
              <button
                type="button"
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 shadow-sm"
                onClick={clearAllFilters}
              >
                {t("analytics.traffic.clearAll")}
              </button>
            )}
            {loadingDetails && <div className="text-xs text-slate-500">{t("analytics.traffic.loading")}</div>}
          </div>
        </div>
        {detailsError && <div className="text-sm text-red-600">{detailsError}</div>}

        {!detailsError && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
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
                        <tr
                          key={visitorKey(v)}
                          className={`hover:bg-slate-50 cursor-pointer ${selectedVisitorId === visitorKey(v) ? "bg-slate-50" : ""}`}
                          onClick={() => {
                            setSelectedVisitor(v);
                            setUserIdFilter("");
                            setSelectedRequestId(null);
                            setEventsOffset(0);
                          }}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              setSelectedVisitor(v);
                              setUserIdFilter("");
                              setSelectedRequestId(null);
                              setEventsOffset(0);
                            }
                          }}
                        >
                          <td className="py-2">{v.kind}</td>
                          <td className="py-2">
                            {v.kind === "user"
                              ? (v.user_id != null ? formatUserLabel(v.user_id) : "-")
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

            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="text-sm font-semibold text-slate-700">
                  {t("analytics.traffic.eventsTable")} ({events?.total ?? 0})
                </div>
                {(selectedVisitor || selectedRequestId) && (
                  <button
                    type="button"
                    className="text-xs text-[#7b0f2b] hover:underline whitespace-nowrap"
                    onClick={clearAllFilters}
                  >
                    {t("analytics.traffic.clearAll")}
                  </button>
                )}
              </div>
              {(selectedVisitor || selectedRequestId) && (
                <div className="hidden text-xs text-slate-500 mb-2">
                  {t("analytics.traffic.filteredBy")}:{" "}
                  <span className="text-slate-700">
                    {selectedVisitor ? chipLabel(t("analytics.traffic.visitor"), selectedVisitorLabelUi) : ""}
                    {selectedVisitor && selectedRequestId ? " · " : ""}
                    {selectedRequestId ? chipLabel(t("analytics.traffic.requestId"), selectedRequestLabel) : ""}
                  </span>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-2 mb-2">
                <label className="md:col-span-5 text-[11px] text-slate-600">
                  {t("analytics.traffic.path")}
                  <input
                    value={pathPrefixFilter}
                    onChange={(e) => setPathPrefixFilter(e.target.value)}
                    placeholder={t("analytics.traffic.pathPlaceholder")}
                    className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs shadow-sm"
                  />
                </label>
                <label className="md:col-span-2 text-[11px] text-slate-600">
                  {t("analytics.traffic.method")}
                  <select
                    value={methodFilter}
                    onChange={(e) => setMethodFilter(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs shadow-sm"
                  >
                    <option value="">{t("analytics.traffic.any")}</option>
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="PATCH">PATCH</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                </label>
                <label className="md:col-span-2 text-[11px] text-slate-600">
                  {t("analytics.traffic.status")}
                  <input
                    inputMode="numeric"
                    value={statusCodeFilter}
                    onChange={(e) => setStatusCodeFilter(e.target.value)}
                    placeholder={t("analytics.traffic.statusPlaceholder")}
                    list="traffic-statuses"
                    className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs shadow-sm"
                  />
                </label>
                <label className="md:col-span-2 text-[11px] text-slate-600">
                  {t("analytics.traffic.user")}
                  <select
                    value={userIdFilter}
                    onChange={(e) => {
                      setUserIdFilter(e.target.value);
                      if (e.target.value) setSelectedVisitor(null);
                    }}
                    disabled={!!selectedVisitor}
                    className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs shadow-sm disabled:bg-slate-50 disabled:text-slate-500"
                  >
                    <option value="">{t("analytics.traffic.any")}</option>
                    {userOptions.map((u) => (
                      <option key={u.id} value={String(u.id)}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="md:col-span-1 text-[11px] text-slate-600">
                  {t("analytics.traffic.perPage")}
                  <select
                    value={eventsLimit}
                    onChange={(e) => setEventsLimit(Number(e.target.value))}
                    className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs shadow-sm"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </label>
              </div>
              <datalist id="traffic-statuses">
                {["200", "201", "204", "301", "302", "304", "400", "401", "403", "404", "409", "422", "429", "500", "502", "503"].map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
              {!events || events.items.length === 0 ? (
                <div className="text-sm text-slate-500">{t("analytics.empty")}</div>
              ) : (
                <div className="space-y-2">
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
                            ? formatUserLabel(ev.user_id)
                            : `anon:${(ev.anon_id || "-").slice(0, 12)}`;
                          const req = ev.request_id ? clipText(String(ev.request_id), 16) : "";
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
                              <td className="py-2">
                                <div className="text-slate-900">{visitor}</div>
                                {req && (
                                  <button
                                    type="button"
                                    className="mt-0.5 text-[11px] text-slate-500 font-mono hover:underline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedRequestId(String(ev.request_id));
                                      setEventsOffset(0);
                                    }}
                                  >
                                    req:{req}
                                  </button>
                                )}
                              </td>
                              <td className="py-2 text-slate-700">{ev.path || "-"}</td>
                              <td className="py-2 text-slate-600">{ev.method || "-"}</td>
                              <td className="py-2 text-right">{ev.status_code ?? "-"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-1">
                    <div className="text-xs text-slate-500">
                      {t("analytics.traffic.page")} {page} {t("analytics.traffic.of")} {totalPages} · {totalEvents} {t("analytics.traffic.events")}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        disabled={!canPrevPage}
                        onClick={() => setEventsOffset(Math.max(0, eventsOffset - eventsLimit))}
                      >
                        {t("analytics.traffic.prev")}
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        disabled={!canNextPage}
                        onClick={() => setEventsOffset(eventsOffset + eventsLimit)}
                      >
                        {t("analytics.traffic.next")}
                      </button>
                    </div>
                  </div>
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
                <div className="flex items-center gap-2">
                  {!eventModalLoading && !eventModalError && eventModalEvent && (
                    <>
                      <button
                        type="button"
                        className="hidden sm:inline-flex rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 shadow-sm"
                        onClick={() => {
                          const ev = eventModalEvent;
                          if (ev.user_id != null) {
                            setSelectedVisitor({
                              kind: "user",
                              user_id: ev.user_id,
                              anon_id: null,
                              ip: ev.ip,
                              events: 0,
                              sessions: 0,
                              paths: 0,
                              first_seen: ev.event_time,
                              last_seen: ev.event_time,
                            });
                          } else {
                            setSelectedVisitor({
                              kind: "guest",
                              user_id: null,
                              anon_id: ev.anon_id || null,
                              ip: ev.ip,
                              events: 0,
                              sessions: 0,
                              paths: 0,
                              first_seen: ev.event_time,
                              last_seen: ev.event_time,
                            });
                          }
                          setUserIdFilter("");
                          setSelectedRequestId(null);
                          setEventsOffset(0);
                          setEventModalId(null);
                        }}
                      >
                        {t("analytics.traffic.filterByVisitor")}
                      </button>
                      <button
                        type="button"
                        className="hidden sm:inline-flex rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 shadow-sm disabled:opacity-60"
                        disabled={!eventModalEvent.request_id}
                        onClick={() => {
                          if (eventModalEvent.request_id) setSelectedRequestId(String(eventModalEvent.request_id));
                          setEventsOffset(0);
                          setEventModalId(null);
                        }}
                      >
                        {t("analytics.traffic.filterByRequest")}
                      </button>
                    </>
                  )}
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
                            ? formatUserLabel(eventModalEvent.user_id)
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

function DateRangePicker({
  fromStr,
  toStr,
  onApply,
}: {
  fromStr: string;
  toStr: string;
  onApply: (fromStr: string, toStr: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const fromDate = useMemo(() => ymdToDate(fromStr), [fromStr]);
  const toDate = useMemo(() => ymdToDate(toStr), [toStr]);
  const initialMonth = useMemo(() => startOfMonth(toDate || fromDate || new Date()), [fromDate, toDate]);

  const [draftFrom, setDraftFrom] = useState(fromStr);
  const [draftTo, setDraftTo] = useState(toStr);
  const [viewMonth, setViewMonth] = useState<Date>(initialMonth);
  const [pickMode, setPickMode] = useState<"from" | "to">("from");

  useEffect(() => {
    if (!open) return;
    setDraftFrom(fromStr);
    setDraftTo(toStr);
    setViewMonth(initialMonth);
    setPickMode("from");
  }, [open, fromStr, toStr, initialMonth]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const label = `${fromStr} – ${toStr}`;

  const draftFromDate = useMemo(() => ymdToDate(draftFrom), [draftFrom]);
  const draftToDate = useMemo(() => ymdToDate(draftTo), [draftTo]);

  const monthLabel = useMemo(() => {
    try {
      return viewMonth.toLocaleString(undefined, { month: "long", year: "numeric" });
    } catch {
      return `${viewMonth.getFullYear()}-${String(viewMonth.getMonth() + 1).padStart(2, "0")}`;
    }
  }, [viewMonth]);

  const weeks = useMemo(() => {
    const first = startOfMonth(viewMonth);
    const firstDow = (first.getDay() + 6) % 7; // Monday=0
    const start = addDays(first, -firstDow);
    const out: Date[][] = [];
    for (let w = 0; w < 6; w++) {
      const row: Date[] = [];
      for (let d = 0; d < 7; d++) row.push(addDays(start, w * 7 + d));
      out.push(row);
    }
    return out;
  }, [viewMonth]);

  const isInRange = (d: Date) => {
    if (!draftFromDate || !draftToDate) return false;
    const r = clampRange(draftFromDate, draftToDate);
    const t = d.getTime();
    return t >= r.from.getTime() && t <= r.to.getTime();
  };

  const isStart = (d: Date) => !!draftFromDate && sameDay(d, draftFromDate);
  const isEnd = (d: Date) => !!draftToDate && sameDay(d, draftToDate);

  const selectDay = (d: Date) => {
    const ymd = toYmdLocal(d);
    if (pickMode === "from") {
      setDraftFrom(ymd);
      if (draftToDate && d.getTime() > draftToDate.getTime()) setDraftTo(ymd);
      setPickMode("to");
      return;
    }
    setDraftTo(ymd);
    if (draftFromDate && d.getTime() < draftFromDate.getTime()) setDraftFrom(ymd);
    setPickMode("from");
  };

  const apply = () => {
    const f = ymdToDate(draftFrom);
    const tTo = ymdToDate(draftTo);
    if (!f || !tTo) return;
    const r = clampRange(f, tTo);
    onApply(toYmdLocal(r.from), toYmdLocal(r.to));
    setOpen(false);
  };

  const setPreset = (kind: "last7" | "last30" | "thisMonth" | "prevMonth") => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    if (kind === "last7") {
      setDraftFrom(toYmdLocal(addDays(today, -6)));
      setDraftTo(toYmdLocal(today));
      setViewMonth(startOfMonth(today));
      return;
    }
    if (kind === "last30") {
      setDraftFrom(toYmdLocal(addDays(today, -29)));
      setDraftTo(toYmdLocal(today));
      setViewMonth(startOfMonth(today));
      return;
    }
    if (kind === "thisMonth") {
      const start = startOfMonth(today);
      setDraftFrom(toYmdLocal(start));
      setDraftTo(toYmdLocal(today));
      setViewMonth(startOfMonth(today));
      return;
    }
    const prev = startOfMonth(addDays(startOfMonth(today), -1));
    const prevEnd = addDays(startOfMonth(today), -1);
    setDraftFrom(toYmdLocal(prev));
    setDraftTo(toYmdLocal(prevEnd));
    setViewMonth(startOfMonth(prev));
  };

  return (
    <div className="relative">
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm hover:bg-slate-50"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("analytics.traffic.range")}
      >
        <svg className="h-4 w-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M8 7V3M16 7V3M4 11h16M5 6h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
        </svg>
        <span className="font-medium">{label}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 z-50 w-[340px] rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="p-3 border-b border-slate-100">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-semibold text-slate-700">{t("analytics.traffic.range")}</div>
                <div className="text-[11px] text-slate-500">{draftFrom} – {draftTo}</div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button type="button" className="rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50" onClick={() => setPreset("last7")}>
                  {t("analytics.traffic.last7")}
                </button>
                <button type="button" className="rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50" onClick={() => setPreset("last30")}>
                  {t("analytics.traffic.last30")}
                </button>
                <button type="button" className="rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50" onClick={() => setPreset("thisMonth")}>
                  {t("analytics.traffic.thisMonth")}
                </button>
                <button type="button" className="rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50" onClick={() => setPreset("prevMonth")}>
                  {t("analytics.traffic.prevMonth")}
                </button>
              </div>
            </div>

            <div className="p-3">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  className="rounded-md p-2 hover:bg-slate-50 text-slate-600"
                  onClick={() => setViewMonth((d) => startOfMonth(addDays(d, -1)))}
                  aria-label="Prev month"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </button>
                <div className="text-sm font-semibold text-slate-800 capitalize">{monthLabel}</div>
                <button
                  type="button"
                  className="rounded-md p-2 hover:bg-slate-50 text-slate-600"
                  onClick={() => setViewMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1, 12, 0, 0, 0))}
                  aria-label="Next month"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </button>
              </div>

              <div className="mt-2 grid grid-cols-7 gap-1 text-[11px] text-slate-500">
                {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
                  <div key={d} className="text-center py-1">{d}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {weeks.flat().map((d) => {
                  const outside = d.getMonth() !== viewMonth.getMonth();
                  const inRange = isInRange(d);
                  const start = isStart(d);
                  const end = isEnd(d);
                  const base = "h-9 w-9 rounded-md text-sm flex items-center justify-center transition";
                  const cls =
                    start || end
                      ? `${base} bg-slate-900 text-white`
                      : inRange
                        ? `${base} bg-slate-900/10 text-slate-900 hover:bg-slate-900/15`
                        : `${base} hover:bg-slate-50 ${outside ? "text-slate-400" : "text-slate-700"}`;
                  return (
                    <button
                      key={d.toISOString()}
                      type="button"
                      className={cls}
                      onClick={() => selectDay(d)}
                    >
                      {d.getDate()}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="text-[11px] text-slate-600">
                  {t("analytics.traffic.from")}
                  <input
                    type="date"
                    value={draftFrom}
                    onChange={(e) => {
                      setDraftFrom(e.target.value);
                      setPickMode("to");
                    }}
                    className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs shadow-sm"
                  />
                </label>
                <label className="text-[11px] text-slate-600">
                  {t("analytics.traffic.to")}
                  <input
                    type="date"
                    value={draftTo}
                    onChange={(e) => {
                      setDraftTo(e.target.value);
                      setPickMode("from");
                    }}
                    className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs shadow-sm"
                  />
                </label>
              </div>

              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                  onClick={() => setOpen(false)}
                >
                  {t("analytics.traffic.cancel")}
                </button>
                <button
                  type="button"
                  className="rounded-md bg-slate-900 px-3 py-2 text-xs text-white hover:bg-slate-800 disabled:opacity-60"
                  disabled={!ymdToDate(draftFrom) || !ymdToDate(draftTo)}
                  onClick={apply}
                >
                  {t("analytics.traffic.apply")}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
