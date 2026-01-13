import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "@/shared/api/client";
import { t } from "@/shared/i18n";

type AdminUser = {
  id: number;
  email: string;
  iin?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  role?: string | null;
  permissions?: string | null;
  institution?: string | null;
  faculty?: string | null;
  group_name?: string | null;
  student_id?: string | null;
  subscription_type?: string | null;
  subscription_expire_at?: string | null;
  is_active?: boolean | null;
  email_verified?: boolean | null;
  phone_verified?: boolean | null;
  last_login_at?: string | null;
  last_activity_at?: string | null;
  reading_history_count?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type UserStats = {
  total_books: number;
  reading: number;
  completed: number;
  dropped: number;
  avg_progress: number;
  total_reading_time: number;
  notes_count: number;
  first_started_at?: string | null;
  last_opened_at?: string | null;
};

type UserBook = {
  id: number;
  current_page: number;
  total_pages?: number | null;
  progress_percent: number;
  status: string;
  reading_time?: number | null;
  book: {
    id: number;
    title: string;
    cover?: string | null;
    authors?: { id: number; name: string }[];
    formats?: string[];
  };
};

type UserNote = {
  id: number;
  user_id: number;
  book_id: number;
  page?: number | null;
  note: string;
  created_at?: string | null;
  updated_at?: string | null;
};

export default function UserDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [userbooks, setUserbooks] = useState<UserBook[]>([]);
  const [notes, setNotes] = useState<UserNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const td = (key: string, vars?: Record<string, any>) => t(`admin.userDetails.${key}`, vars);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    setLoading(true);
    setError(null);
    Promise.all([
      api<AdminUser>(`/api/auth/users/${encodeURIComponent(String(id))}`),
      api<UserStats>(`/api/catalog/admin/users/${encodeURIComponent(String(id))}/stats`),
      api<UserBook[]>(`/api/catalog/admin/users/${encodeURIComponent(String(id))}/userbooks`),
      api<UserNote[]>(`/api/catalog/admin/users/${encodeURIComponent(String(id))}/notes`),
    ])
      .then(([userRes, statsRes, booksRes, notesRes]) => {
        if (!alive) return;
        setUser(userRes);
        setStats(statsRes);
        setUserbooks(Array.isArray(booksRes) ? booksRes : []);
        setNotes(Array.isArray(notesRes) ? notesRes : []);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e?.message || td("failed"));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id]);

  const bookById = useMemo(() => {
    const map = new Map<number, UserBook["book"]>();
    userbooks.forEach((ub) => {
      if (ub.book?.id != null) map.set(ub.book.id, ub.book);
    });
    return map;
  }, [userbooks]);

  const derivedStats = useMemo(() => {
    const total = stats?.total_books ?? userbooks.length;
    const reading = stats?.reading ?? userbooks.filter((u) => u.status === "reading").length;
    const completed = stats?.completed ?? userbooks.filter((u) => u.status === "readed").length;
    const dropped = stats?.dropped ?? userbooks.filter((u) => u.status === "dropped").length;
    const avgProgress =
      stats?.avg_progress ??
      (userbooks.length
        ? userbooks.reduce((acc, u) => acc + (u.progress_percent || 0), 0) / userbooks.length
        : 0);
    const totalReadingTime =
      stats?.total_reading_time ??
      userbooks.reduce((acc, u) => acc + (u.reading_time || 0), 0);
    const notesCount = stats?.notes_count ?? notes.length;
    return {
      total,
      reading,
      completed,
      dropped,
      avgProgress,
      totalReadingTime,
      notesCount,
      firstStartedAt: stats?.first_started_at,
      lastOpenedAt: stats?.last_opened_at,
    };
  }, [stats, userbooks, notes.length]);

  const topFormats = useMemo(() => {
    const tally = new Map<string, number>();
    userbooks.forEach((ub) => {
      (ub.book?.formats || []).forEach((f) => {
        const key = String(f).trim();
        if (!key) return;
        tally.set(key, (tally.get(key) || 0) + 1);
      });
    });
    return Array.from(tally.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [userbooks]);

  const topAuthors = useMemo(() => {
    const tally = new Map<string, number>();
    userbooks.forEach((ub) => {
      (ub.book?.authors || []).forEach((a) => {
        const name = String(a?.name || "").trim();
        if (!name) return;
        tally.set(name, (tally.get(name) || 0) + 1);
      });
    });
    return Array.from(tally.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [userbooks]);

  const formatDate = (value?: string | null) => {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
  };

  const formatMinutes = (value?: number | null) => {
    const minutes = Math.round(value || 0);
    if (minutes <= 0) return `0 ${td("time.min")}`;
    if (minutes < 60) return `${minutes} ${td("time.min")}`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}${td("time.h")} ${m}${td("time.min")}`;
  };

  const formatProgress = (ub: UserBook) => {
    const pct = Math.round(ub.progress_percent || 0);
    const pages =
      ub.total_pages && ub.total_pages > 0
        ? `${ub.current_page || 0}/${ub.total_pages}`
        : `${ub.current_page || 0}`;
    return `${pct}% (${pages})`;
  };

  const statusLabel = (value?: string | null) => {
    if (!value) return "reading";
    if (value === "readed") return td("status.completed");
    if (value === "reading") return td("status.reading");
    if (value === "dropped") return td("status.dropped");
    return value;
  };

  if (!id) {
    return <div className="text-slate-600">{td("missingId")}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">{td("title")}</div>
          <div className="text-sm text-slate-500">{td("id")}: {id}</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="px-3 py-2 border rounded-md hover:bg-slate-50">
            {td("back")}
          </button>
          {user?.email && (
            <a href={`mailto:${user.email}`} className="px-3 py-2 border rounded-md hover:bg-slate-50">
              {td("emailAction")}
            </a>
          )}
        </div>
      </div>

      {loading && <div className="text-slate-500 text-sm">{td("loading")}</div>}
      {!loading && error && <div className="text-red-600 text-sm">{error}</div>}
      {!loading && !error && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white border rounded-md p-4 shadow-sm lg:col-span-2">
              <div className="text-sm font-semibold text-slate-700 mb-3">{td("sections.account")}</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-slate-500">{td("fields.fullName")}</div>
                  <div className="font-medium">
                    {([user?.first_name, user?.last_name].filter(Boolean).join(" ") || "-")}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">{td("fields.email")}</div>
                  <div className="font-medium">{user?.email || "-"}</div>
                </div>
                <div>
                  <div className="text-slate-500">{td("fields.role")}</div>
                  <div className="font-medium">{user?.role || "-"}</div>
                </div>
                <div>
                  <div className="text-slate-500">{td("fields.phone")}</div>
                  <div className="font-medium">{user?.phone || "-"}</div>
                </div>
                <div>
                  <div className="text-slate-500">{td("fields.iin")}</div>
                  <div className="font-medium">{user?.iin || "-"}</div>
                </div>
                <div>
                  <div className="text-slate-500">{td("fields.institution")}</div>
                  <div className="font-medium">{user?.institution || "-"}</div>
                </div>
                <div>
                  <div className="text-slate-500">{td("fields.facultyGroup")}</div>
                  <div className="font-medium">
                    {user?.faculty || "-"} {user?.group_name ? `- ${user.group_name}` : ""}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">{td("fields.subscription")}</div>
                  <div className="font-medium">
                    {user?.subscription_type || "-"} {user?.subscription_expire_at ? `- ${td("until")} ${formatDate(user.subscription_expire_at)}` : ""}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">{td("fields.status")}</div>
                  <div className="font-medium">
                    {user?.is_active ? td("status.active") : td("status.inactive")} | {td("status.email")}{" "}
                    {user?.email_verified ? td("status.verified") : td("status.notVerified")} | {td("status.phone")}{" "}
                    {user?.phone_verified ? td("status.verified") : td("status.notVerified")}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">{td("fields.lastLogin")}</div>
                  <div className="font-medium">{formatDate(user?.last_login_at)}</div>
                </div>
                <div>
                  <div className="text-slate-500">{td("fields.lastActivity")}</div>
                  <div className="font-medium">{formatDate(user?.last_activity_at)}</div>
                </div>
                <div>
                  <div className="text-slate-500">{td("fields.created")}</div>
                  <div className="font-medium">{formatDate(user?.created_at)}</div>
                </div>
                <div>
                  <div className="text-slate-500">{td("fields.updated")}</div>
                  <div className="font-medium">{formatDate(user?.updated_at)}</div>
                </div>
              </div>
            </div>

            <div className="bg-white border rounded-md p-4 shadow-sm">
              <div className="text-sm font-semibold text-slate-700 mb-3">{td("sections.pulse")}</div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">{td("metrics.totalBooks")}</span>
                  <span className="font-medium">{derivedStats.total}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">{td("metrics.reading")}</span>
                  <span className="font-medium">{derivedStats.reading}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">{td("metrics.completed")}</span>
                  <span className="font-medium">{derivedStats.completed}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">{td("metrics.dropped")}</span>
                  <span className="font-medium">{derivedStats.dropped}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">{td("metrics.avgProgress")}</span>
                  <span className="font-medium">{Math.round(derivedStats.avgProgress || 0)}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">{td("metrics.readingTime")}</span>
                  <span className="font-medium">{formatMinutes(derivedStats.totalReadingTime)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">{td("metrics.notes")}</span>
                  <span className="font-medium">{derivedStats.notesCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">{td("metrics.firstStarted")}</span>
                  <span className="font-medium">{formatDate(derivedStats.firstStartedAt)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">{td("metrics.lastOpened")}</span>
                  <span className="font-medium">{formatDate(derivedStats.lastOpenedAt)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white border rounded-md p-4 shadow-sm">
              <div className="text-sm font-semibold text-slate-700 mb-3">{td("sections.topFormats")}</div>
              {topFormats.length === 0 ? (
                <div className="text-sm text-slate-500">{td("empty.formats")}</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {topFormats.map(([format, count]) => (
                    <div key={format} className="px-2 py-1 rounded-full bg-slate-100 text-xs text-slate-700">
                      {format} - {count}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border rounded-md p-4 shadow-sm">
              <div className="text-sm font-semibold text-slate-700 mb-3">{td("sections.topAuthors")}</div>
              {topAuthors.length === 0 ? (
                <div className="text-sm text-slate-500">{td("empty.authors")}</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {topAuthors.map(([name, count]) => (
                    <div key={name} className="px-2 py-1 rounded-full bg-slate-100 text-xs text-slate-700">
                      {name} - {count}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border rounded-md p-4 shadow-sm">
            <div className="text-sm font-semibold text-slate-700 mb-3">{td("sections.readingList")}</div>
            {userbooks.length === 0 ? (
              <div className="text-sm text-slate-500">{td("empty.readingList")}</div>
            ) : (
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-slate-500">
                    <tr>
                      <th className="text-left px-3 py-2">{td("table.book")}</th>
                      <th className="text-left px-3 py-2">{td("table.status")}</th>
                      <th className="text-left px-3 py-2">{td("table.progress")}</th>
                      <th className="text-left px-3 py-2">{td("table.formats")}</th>
                      <th className="text-left px-3 py-2">{td("table.authors")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userbooks.map((ub) => (
                      <tr key={ub.id} className="border-t border-slate-100">
                        <td className="px-3 py-2">
                          <Link to={`/catalog/books/${encodeURIComponent(String(ub.book?.id))}`} className="text-[#7b0f2b] hover:underline">
                            {ub.book?.title || "Untitled"}
                          </Link>
                        </td>
                        <td className="px-3 py-2">{statusLabel(ub.status)}</td>
                        <td className="px-3 py-2">{formatProgress(ub)}</td>
                        <td className="px-3 py-2">{(ub.book?.formats || []).join(", ") || "-"}</td>
                        <td className="px-3 py-2">{(ub.book?.authors || []).map((a) => a.name).join(", ") || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white border rounded-md p-4 shadow-sm">
            <div className="text-sm font-semibold text-slate-700 mb-3">{td("sections.notes")}</div>
            {notes.length === 0 ? (
              <div className="text-sm text-slate-500">{td("empty.notes")}</div>
            ) : (
              <div className="space-y-3">
                {notes.slice(0, 20).map((n) => {
                  const book = bookById.get(n.book_id);
                  return (
                    <div key={n.id} className="border border-slate-100 rounded-md p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                        <div>
                          <span className="font-medium text-slate-700">
                            {book?.title || td("bookFallback", { id: n.book_id })}
                          </span>
                          {n.page != null ? ` - ${td("page")} ${n.page}` : ""}
                        </div>
                        <div>{formatDate(n.created_at)}</div>
                      </div>
                      <div className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">{n.note}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
