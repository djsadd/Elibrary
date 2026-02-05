import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import DashboardHeader from "@/components/layout/DashboardHeader";
import { api } from "@/shared/api/client";
import { t } from "@/shared/i18n";

type AuthProfile = {
  id: number;
  email: string;
  iin?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  role?: string | null;
  institution?: string | null;
  faculty?: string | null;
  group_name?: string | null;
  subscription_type?: string | null;
  subscription_expire_at?: string | null;
  created_at?: string | null;
};

type UserBook = {
  id: number | string;
  current_page?: number | null;
  total_pages?: number | null;
  progress_percent?: number | null;
  status?: string | null;
  reading_time?: number | null;
  book: {
    id: number | string;
    title: string;
    cover?: string | null;
    authors?: { id: number | string; name: string }[];
    formats?: unknown;
  };
};

type Favourite = {
  id: number | string;
  user_id: number | string;
  book_id: number;
  created_at: string;
  book_data?: { title?: string | null } | null;
};

type Note = {
  id: number | string;
  user_id: number | string;
  book_id: number;
  page?: number | null;
  note: string;
  created_at: string;
  updated_at: string;
};

type Review = {
  id: number | string;
  book_id: number;
  user_id: number;
  rating: number;
  comment?: string | null;
  created_at: string;
};

type EventsPage = { total: number; items: { event_time?: string | null }[] };

type EditProfile = {
  first_name: string;
  last_name: string;
  phone: string;
  iin: string;
  institution: string;
  faculty: string;
  group_name: string;
  avatar_url: string;
};

function ymd(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDateTime(value?: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
}

function clampInt(n: unknown, fallback = 0): number {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) ? Math.trunc(v) : fallback;
}

export default function ProfilePage() {
  type TabKey = "account" | "library" | "notes" | "analytics" | "security" | "notifications" | "interface";
  const [tab, setTab] = useState<TabKey>("account");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [edit, setEdit] = useState<EditProfile>({
    first_name: "",
    last_name: "",
    phone: "",
    iin: "",
    institution: "",
    faculty: "",
    group_name: "",
    avatar_url: "",
  });

  const [userbooks, setUserbooks] = useState<UserBook[]>([]);
  const [favourites, setFavourites] = useState<Favourite[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoaded, setReviewsLoaded] = useState(false);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [traffic7d, setTraffic7d] = useState<{ total: number; lastSeen?: string | null } | null>(null);
  const [traffic30d, setTraffic30d] = useState<{ total: number; lastSeen?: string | null } | null>(null);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const p = await api<AuthProfile>("/api/auth/profile");
        if (cancelled) return;
        setProfile(p);
        setEdit({
          first_name: String(p?.first_name ?? ""),
          last_name: String(p?.last_name ?? ""),
          phone: String(p?.phone ?? ""),
          iin: String(p?.iin ?? ""),
          institution: String(p?.institution ?? ""),
          faculty: String(p?.faculty ?? ""),
          group_name: String(p?.group_name ?? ""),
          avatar_url: String(p?.avatar_url ?? ""),
        });
        setAvatarPreview(p?.avatar_url ? String(p.avatar_url) : null);

        const [ubR, favR, notesR] = await Promise.allSettled([
          api<UserBook[]>("/api/catalog/userbook"),
          api<Favourite[]>("/api/favourites"),
          api<Note[]>("/api/catalog/notes"),
        ]);
        if (cancelled) return;
        if (ubR.status === "fulfilled") setUserbooks(Array.isArray(ubR.value) ? ubR.value : []);
        if (favR.status === "fulfilled") setFavourites(Array.isArray(favR.value) ? favR.value : []);
        if (notesR.status === "fulfilled") setNotes(Array.isArray(notesR.value) ? notesR.value : []);

        const userId = clampInt(p?.id, 0);
        if (userId > 0) {
          const to = new Date();
          const from7 = new Date(to);
          from7.setDate(to.getDate() - 7);
          const from30 = new Date(to);
          from30.setDate(to.getDate() - 30);
          const qs = (from: Date, to: Date) =>
            `from=${encodeURIComponent(ymd(from))}&to=${encodeURIComponent(ymd(to))}&who=users&user_id=${encodeURIComponent(String(userId))}&limit=1`;
          const [t7, t30] = await Promise.allSettled([
            api<EventsPage>(`/api/analytics/traffic?${qs(from7, to)}`),
            api<EventsPage>(`/api/analytics/traffic?${qs(from30, to)}`),
          ]);
          if (cancelled) return;
          if (t7.status === "fulfilled") setTraffic7d({ total: clampInt(t7.value?.total, 0), lastSeen: t7.value?.items?.[0]?.event_time ?? null });
          if (t30.status === "fulfilled") setTraffic30d({ total: clampInt(t30.value?.total, 0), lastSeen: t30.value?.items?.[0]?.event_time ?? null });
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!cancelled) setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const userId = clampInt(profile?.id, 0);
    if (userId <= 0) return;
    if (tab !== "library") return;
    if (reviewsLoaded || reviewsLoading) return;
    (async () => {
      try {
        setReviewsLoading(true);
        const data = await api<Review[]>("/api/reviews");
        if (!cancelled) {
          setReviews(Array.isArray(data) ? data : []);
          setReviewsLoaded(true);
        }
      } catch {
        if (!cancelled) setReviewsLoaded(true);
      } finally {
        if (!cancelled) setReviewsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, profile?.id, reviewsLoaded, reviewsLoading]);

  const derived = useMemo(() => {
    const byStatus = (s: string) => userbooks.filter((ub) => String(ub.status || "").toLowerCase() === s).length;
    const reading = byStatus("reading");
    const completed = byStatus("readed");
    const minutes = userbooks.reduce((acc, ub) => acc + (typeof ub.reading_time === "number" ? ub.reading_time : 0), 0);
    const myReviews = reviews.filter((r) => r && typeof r.user_id === "number" && profile?.id && r.user_id === profile.id);
    return {
      reading,
      completed,
      shelfTotal: userbooks.length,
      minutes: Math.round(minutes || 0),
      favourites: favourites.length,
      notes: notes.length,
      reviews: myReviews.length,
      myReviews,
    };
  }, [userbooks, favourites.length, notes.length, reviews, profile?.id]);

  const bookById = useMemo(() => {
    const map = new Map<number, { id: number; title: string }>();
    userbooks.forEach((ub) => {
      const id = clampInt(ub?.book?.id, 0);
      const title = String(ub?.book?.title || "").trim();
      if (id > 0 && title) map.set(id, { id, title });
    });
    favourites.forEach((f) => {
      const id = clampInt(f?.book_id, 0);
      const title = String(f?.book_data?.title || "").trim();
      if (id > 0 && title && !map.has(id)) map.set(id, { id, title });
    });
    return map;
  }, [userbooks, favourites]);

  const sortedNotes = useMemo(() => {
    const arr = Array.isArray(notes) ? [...notes] : [];
    arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return arr;
  }, [notes]);

  const sortedFavourites = useMemo(() => {
    const arr = Array.isArray(favourites) ? [...favourites] : [];
    arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return arr;
  }, [favourites]);

  const onAvatarPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(String(reader.result));
    reader.readAsDataURL(f);
  };

  const Stat = ({ color, icon, value, label }: { color: string; icon: React.ReactNode; value: number; label: string }) => (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg text-white" style={{ backgroundColor: color }}>
      <div className="w-9 h-9 rounded-md bg-white/20 flex items-center justify-center">{icon}</div>
      <div>
        <div className="text-lg font-semibold leading-none">{value}</div>
        <div className="text-xs opacity-90">{label}</div>
      </div>
    </div>
  );

  const fullName = [edit.first_name, edit.last_name].map((s) => String(s || "").trim()).filter(Boolean).join(" ") || "-";

  return (
    <div>
      <DashboardHeader />
      <div className="p-4 md:p-6">
        <h2 className="text-2xl font-semibold mb-4">{t("profile.title")}</h2>

        {loading && <div className="text-sm text-slate-500">{t("profile.loading")}</div>}
        {!loading && error && <div className="text-sm text-red-600">{error}</div>}

        <div className="bg-white rounded-xl shadow-sm border">
          <div className="px-4 md:px-6 pt-4 border-b flex items-center gap-6 text-sm overflow-x-auto">
            {([
              ["account", t("profile.tabs.account")],
              ["library", t("profile.tabs.library")],
              ["notes", t("profile.tabs.notes")],
              ["analytics", t("profile.tabs.analytics")],
              ["security", t("profile.tabs.security")],
              ["notifications", t("profile.tabs.notifications")],
              ["interface", t("profile.tabs.interface")],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`py-3 -mb-px border-b-2 whitespace-nowrap ${
                  tab === key ? "border-[#7b0f2b] text-[#7b0f2b]" : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="p-4 md:p-6">
            {tab === "account" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center">
                      {avatarPreview ? <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" /> : <span className="text-slate-500">U</span>}
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-slate-800">{fullName}</div>
                      <button onClick={() => fileRef.current?.click()} className="text-xs text-[#7b0f2b] hover:underline">
                        {t("profile.account.uploadPhoto")}
                      </button>
                      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onAvatarPick} />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Stat
                      color="#F97316"
                      value={derived.reading}
                      label={t("profile.stats.readingNow")}
                      icon={
                        <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                          <path d="M4 6h16v12H4z" />
                          <path d="M8 6v12" />
                        </svg>
                      }
                    />
                    <Stat
                      color="#10B981"
                      value={derived.completed}
                      label={t("profile.stats.completed")}
                      icon={
                        <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      }
                    />
                    <Stat
                      color="#7C3AED"
                      value={derived.notes}
                      label={t("profile.stats.notes")}
                      icon={
                        <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                          <path d="M4 4h16v16H4z" />
                          <path d="M8 8h8" />
                          <path d="M8 12h8" />
                        </svg>
                      }
                    />
                  </div>

                  <div className="text-xs text-slate-500">
                    {t("profile.account.id")}: <span className="text-slate-700">{profile?.id ?? "-"}</span>
                    {profile?.created_at ? (
                      <>
                        {" "}
                        • {t("profile.account.createdAt")}: <span className="text-slate-700">{formatDateTime(profile.created_at)}</span>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="lg:col-span-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-slate-600 mb-1">{t("profile.account.firstName")}</label>
                      <input value={edit.first_name} onChange={(e) => setEdit({ ...edit, first_name: e.target.value })} className="w-full border rounded-md px-3 py-2" />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-600 mb-1">{t("profile.account.lastName")}</label>
                      <input value={edit.last_name} onChange={(e) => setEdit({ ...edit, last_name: e.target.value })} className="w-full border rounded-md px-3 py-2" />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-600 mb-1">{t("profile.account.email")}</label>
                      <input type="email" value={profile?.email || ""} readOnly className="w-full border rounded-md px-3 py-2 bg-slate-50 text-slate-600" />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-600 mb-1">{t("profile.account.phone")}</label>
                      <input value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} className="w-full border rounded-md px-3 py-2" />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-600 mb-1">{t("profile.account.iin")}</label>
                      <input value={edit.iin} onChange={(e) => setEdit({ ...edit, iin: e.target.value })} className="w-full border rounded-md px-3 py-2" />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-600 mb-1">{t("profile.account.role")}</label>
                      <input value={String(profile?.role || "")} readOnly className="w-full border rounded-md px-3 py-2 bg-slate-50 text-slate-600" />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-600 mb-1">{t("profile.account.institution")}</label>
                      <input value={edit.institution} onChange={(e) => setEdit({ ...edit, institution: e.target.value })} className="w-full border rounded-md px-3 py-2" />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-600 mb-1">{t("profile.account.faculty")}</label>
                      <input value={edit.faculty} onChange={(e) => setEdit({ ...edit, faculty: e.target.value })} className="w-full border rounded-md px-3 py-2" />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-600 mb-1">{t("profile.account.group")}</label>
                      <input value={edit.group_name} onChange={(e) => setEdit({ ...edit, group_name: e.target.value })} className="w-full border rounded-md px-3 py-2" />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-600 mb-1">{t("profile.account.subscription")}</label>
                      <input
                        value={
                          profile?.subscription_type
                            ? `${profile.subscription_type}${profile.subscription_expire_at ? ` • ${formatDateTime(profile.subscription_expire_at)}` : ""}`
                            : "-"
                        }
                        readOnly
                        className="w-full border rounded-md px-3 py-2 bg-slate-50 text-slate-600"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm text-slate-600 mb-1">{t("profile.account.avatarUrl")}</label>
                      <input
                        value={edit.avatar_url}
                        onChange={(e) => {
                          setEdit({ ...edit, avatar_url: e.target.value });
                          setAvatarPreview(e.target.value.trim() || null);
                        }}
                        className="w-full border rounded-md px-3 py-2"
                        placeholder="https://..."
                      />
                      <div className="text-xs text-slate-500 mt-1">{t("profile.account.avatarHint")}</div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-3">
                    <button
                      type="button"
                      className="px-4 py-2 rounded-md bg-[#7b0f2b] text-white"
                      onClick={async () => {
                        try {
                          await api(`/api/auth/profile`, {
                            method: "PUT",
                            body: JSON.stringify({
                              first_name: edit.first_name || undefined,
                              last_name: edit.last_name || undefined,
                              phone: edit.phone || undefined,
                              iin: edit.iin || undefined,
                              avatar_url: edit.avatar_url || undefined,
                              institution: edit.institution || undefined,
                              faculty: edit.faculty || undefined,
                              group_name: edit.group_name || undefined,
                            }),
                          });
                        } catch (e: unknown) {
                          const msg = e instanceof Error ? e.message : String(e);
                          setError(msg);
                        }
                      }}
                    >
                      {t("profile.account.update")}
                    </button>
                    <button
                      type="button"
                      className="px-4 py-2 rounded-md border hover:bg-slate-50"
                      onClick={() => {
                        setEdit({
                          first_name: String(profile?.first_name ?? ""),
                          last_name: String(profile?.last_name ?? ""),
                          phone: String(profile?.phone ?? ""),
                          iin: String(profile?.iin ?? ""),
                          institution: String(profile?.institution ?? ""),
                          faculty: String(profile?.faculty ?? ""),
                          group_name: String(profile?.group_name ?? ""),
                          avatar_url: String(profile?.avatar_url ?? ""),
                        });
                        setAvatarPreview(profile?.avatar_url ? String(profile.avatar_url) : null);
                      }}
                    >
                      {t("profile.account.reset")}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {tab === "library" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="border rounded-md p-3">
                    <div className="text-xs text-slate-500">{t("profile.library.stats.shelf")}</div>
                    <div className="text-lg font-semibold text-slate-800">{derived.shelfTotal}</div>
                  </div>
                  <div className="border rounded-md p-3">
                    <div className="text-xs text-slate-500">{t("profile.library.stats.reading")}</div>
                    <div className="text-lg font-semibold text-slate-800">{derived.reading}</div>
                  </div>
                  <div className="border rounded-md p-3">
                    <div className="text-xs text-slate-500">{t("profile.library.stats.completed")}</div>
                    <div className="text-lg font-semibold text-slate-800">{derived.completed}</div>
                  </div>
                  <div className="border rounded-md p-3">
                    <div className="text-xs text-slate-500">{t("profile.library.stats.favourites")}</div>
                    <div className="text-lg font-semibold text-slate-800">{derived.favourites}</div>
                  </div>
                  <div className="border rounded-md p-3">
                    <div className="text-xs text-slate-500">{t("profile.library.stats.notes")}</div>
                    <div className="text-lg font-semibold text-slate-800">{derived.notes}</div>
                  </div>
                  <div className="border rounded-md p-3">
                    <div className="text-xs text-slate-500">{t("profile.library.stats.reviews")}</div>
                    <div className="text-lg font-semibold text-slate-800">{reviewsLoaded ? derived.reviews : "-"}</div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Link to="/shelf" className="px-3 py-2 border rounded-md hover:bg-slate-50 text-sm">
                    {t("profile.library.actions.openShelf")}
                  </Link>
                  <Link to="/favorites" className="px-3 py-2 border rounded-md hover:bg-slate-50 text-sm">
                    {t("profile.library.actions.openFavourites")}
                  </Link>
                </div>

                <div className="bg-slate-50 border rounded-md p-4">
                  <div className="text-sm font-semibold text-slate-700 mb-2">{t("profile.library.readingListTitle")}</div>
                  {userbooks.length === 0 ? (
                    <div className="text-sm text-slate-500">{t("profile.library.emptyShelf")}</div>
                  ) : (
                    <div className="overflow-auto">
                      <table className="min-w-full text-sm">
                        <thead className="text-slate-500">
                          <tr>
                            <th className="text-left px-3 py-2">{t("profile.library.table.book")}</th>
                            <th className="text-left px-3 py-2">{t("profile.library.table.status")}</th>
                            <th className="text-left px-3 py-2">{t("profile.library.table.progress")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...userbooks]
                            .sort((a, b) => String(a.status || "").localeCompare(String(b.status || "")))
                            .slice(0, 20)
                            .map((ub) => {
                              const pct = Math.round(Number(ub.progress_percent || 0));
                              const pages = ub.total_pages && ub.total_pages > 0 ? `${ub.current_page || 0}/${ub.total_pages}` : `${ub.current_page || 0}`;
                              return (
                                <tr key={ub.id} className="border-t border-slate-200">
                                  <td className="px-3 py-2">
                                    <Link to={`/catalog/books/${encodeURIComponent(String(ub.book?.id ?? ""))}`} className="text-[#7b0f2b] hover:underline">
                                      {ub.book?.title || "-"}
                                    </Link>
                                  </td>
                                  <td className="px-3 py-2">{String(ub.status || "-")}</td>
                                  <td className="px-3 py-2">
                                    {pct}% ({pages})
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="border rounded-md p-4">
                    <div className="text-sm font-semibold text-slate-700 mb-2">{t("profile.library.favouritesTitle")}</div>
                    {sortedFavourites.length === 0 ? (
                      <div className="text-sm text-slate-500">{t("profile.library.emptyFavourites")}</div>
                    ) : (
                      <div className="space-y-2">
                        {sortedFavourites.slice(0, 12).map((f) => {
                          const bookTitle = String(f?.book_data?.title || bookById.get(f.book_id)?.title || "");
                          return (
                            <div key={f.id} className="flex items-center justify-between gap-3 text-sm">
                              <Link to={`/catalog/books/${encodeURIComponent(String(f.book_id))}`} className="text-[#7b0f2b] hover:underline truncate">
                                {bookTitle || t("profile.notes.bookFallback", { id: f.book_id })}
                              </Link>
                              <span className="text-xs text-slate-500 whitespace-nowrap">{formatDateTime(f.created_at)}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="border rounded-md p-4">
                    <div className="text-sm font-semibold text-slate-700 mb-2">{t("profile.library.reviewsTitle")}</div>
                    {!reviewsLoaded || reviewsLoading ? (
                      <div className="text-sm text-slate-500">{t("profile.loading")}</div>
                    ) : derived.myReviews.length === 0 ? (
                      <div className="text-sm text-slate-500">{t("profile.library.emptyReviews")}</div>
                    ) : (
                      <div className="space-y-3">
                        {[...derived.myReviews]
                          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                          .slice(0, 10)
                          .map((r) => {
                            const bookTitle = bookById.get(r.book_id)?.title || t("profile.notes.bookFallback", { id: r.book_id });
                            return (
                              <div key={r.id} className="border border-slate-100 rounded-md p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                                  <Link to={`/catalog/books/${encodeURIComponent(String(r.book_id))}`} className="text-[#7b0f2b] hover:underline font-medium">
                                    {bookTitle}
                                  </Link>
                                  <span>{formatDateTime(r.created_at)}</span>
                                </div>
                                <div className="text-sm text-slate-700 mt-2">
                                  {t("profile.library.rating")}: <span className="font-medium">{Number(r.rating).toFixed(1)}</span>
                                </div>
                                {r.comment ? <div className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{r.comment}</div> : null}
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {tab === "notes" && (
              <div className="space-y-3">
                <div className="text-sm text-slate-500">{t("profile.notes.hint")}</div>
                {sortedNotes.length === 0 ? (
                  <div className="text-sm text-slate-500">{t("profile.notes.empty")}</div>
                ) : (
                  <div className="space-y-3">
                    {sortedNotes.slice(0, 30).map((n) => {
                      const bookTitle = bookById.get(n.book_id)?.title || t("profile.notes.bookFallback", { id: n.book_id });
                      return (
                        <div key={n.id} className="border rounded-md p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                            <div className="flex flex-wrap items-center gap-2">
                              <Link to={`/catalog/books/${encodeURIComponent(String(n.book_id))}`} className="text-[#7b0f2b] hover:underline font-medium">
                                {bookTitle}
                              </Link>
                              {n.page != null ? <span>• {t("profile.notes.page", { page: n.page })}</span> : null}
                            </div>
                            <div>{formatDateTime(n.created_at)}</div>
                          </div>
                          <div className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">{n.note}</div>
                          <div className="mt-2">
                            <Link to={`/catalog/${encodeURIComponent(String(n.book_id))}/notes`} className="text-xs text-[#7b0f2b] hover:underline">
                              {t("profile.notes.openBookNotes")}
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {tab === "analytics" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="border rounded-md p-4">
                    <div className="text-xs text-slate-500">{t("profile.analytics.readingTime")}</div>
                    <div className="text-lg font-semibold text-slate-800">
                      {derived.minutes < 60
                        ? `${derived.minutes} ${t("profile.analytics.min")}`
                        : `${Math.floor(derived.minutes / 60)}${t("profile.analytics.h")} ${derived.minutes % 60}${t("profile.analytics.min")}`}
                    </div>
                  </div>
                  <div className="border rounded-md p-4">
                    <div className="text-xs text-slate-500">{t("profile.analytics.api7d")}</div>
                    <div className="text-lg font-semibold text-slate-800">{traffic7d?.total ?? 0}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      {t("profile.analytics.lastSeen")}: <span className="text-slate-700">{formatDateTime(traffic7d?.lastSeen || null)}</span>
                    </div>
                  </div>
                  <div className="border rounded-md p-4">
                    <div className="text-xs text-slate-500">{t("profile.analytics.api30d")}</div>
                    <div className="text-lg font-semibold text-slate-800">{traffic30d?.total ?? 0}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      {t("profile.analytics.lastSeen")}: <span className="text-slate-700">{formatDateTime(traffic30d?.lastSeen || null)}</span>
                    </div>
                  </div>
                </div>
                <div className="text-sm text-slate-500">{t("profile.analytics.hint")}</div>
              </div>
            )}

            {tab === "security" && (
              <div className="text-sm text-slate-600 space-y-3">
                <div className="font-medium text-slate-800">{t("profile.security.title")}</div>
                <div>
                  {t("profile.security.twoFactor")}: <span className="text-amber-600">{t("profile.security.disabled")}</span>
                </div>
                <div>{t("profile.security.lastPasswordChange")}</div>
                <button className="px-3 py-2 rounded-md border">{t("profile.security.changePassword")}</button>
              </div>
            )}

            {tab === "notifications" && (
              <div className="text-sm text-slate-600 space-y-2">
                <div className="font-medium text-slate-800">{t("profile.notifications.title")}</div>
                <label className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked /> {t("profile.notifications.emailUpdates")}
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" /> {t("profile.notifications.newReleases")}
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked /> {t("profile.notifications.weeklyDigest")}
                </label>
              </div>
            )}

            {tab === "interface" && (
              <div className="text-sm text-slate-600 space-y-3">
                <div className="font-medium text-slate-800">{t("profile.interface.title")}</div>
                <label className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked /> {t("profile.interface.compactMode")}
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" /> {t("profile.interface.highContrast")}
                </label>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
