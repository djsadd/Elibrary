import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/shared/api/client";
import { t } from "@/shared/i18n";

type AdminUser = {
  id: number;
  email: string;
  iin?: string | null;
  phone?: string | null;
  role?: string | null;
  permissions?: string | null;
  institution?: string | null;
  faculty?: string | null;
  group_name?: string | null;
  subscription_type?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
};

type UsersResponse = {
  items: AdminUser[];
  total: number;
  limit: number;
  offset: number;
};

export default function UsersPage() {
  const [data, setData] = useState<UsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    api<UsersResponse>("/api/auth/users")
      .then((res) => {
        if (!alive) return;
        setData(res);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e?.message || t("admin.common.failed"));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const users = data?.items || [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const hay = [
        u.email,
        u.iin,
        u.role,
        u.institution,
        u.faculty,
        u.group_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [users, query]);

  const formatDate = (value?: string | null) => {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString();
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="text-lg font-semibold">{t("admin.nav.users")}</h2>
        <div className="flex items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-60 max-w-full border border-slate-200 rounded-md px-3 py-1.5 text-sm"
            placeholder={t("admin.users.searchPlaceholder")}
          />
          {data && (
            <div className="text-xs text-slate-500">
              {t("admin.users.total")}: {filtered.length}
            </div>
          )}
        </div>
      </div>
      {loading && <div className="text-slate-500 text-sm">{t("admin.common.loading")}</div>}
      {!loading && error && <div className="text-red-600 text-sm">{error}</div>}
      {!loading && !error && (
        <div className="overflow-auto border border-slate-200 rounded-md">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-3 py-2">{t("admin.users.table.id")}</th>
                <th className="text-left px-3 py-2">{t("admin.users.table.email")}</th>
                <th className="text-left px-3 py-2">{t("admin.users.table.role")}</th>
                <th className="text-left px-3 py-2">{t("admin.users.table.iin")}</th>
                <th className="text-left px-3 py-2">{t("admin.users.table.institution")}</th>
                <th className="text-left px-3 py-2">{t("admin.users.table.faculty")}</th>
                <th className="text-left px-3 py-2">{t("admin.users.table.group")}</th>
                <th className="text-left px-3 py-2">{t("admin.users.table.active")}</th>
                <th className="text-left px-3 py-2">{t("admin.users.table.created")}</th>
                <th className="text-left px-3 py-2">{t("admin.users.table.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center text-slate-500 py-6">
                    {t("admin.users.empty")}
                  </td>
                </tr>
              )}
              {filtered.map((u) => (
                <tr key={u.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">{u.id}</td>
                  <td className="px-3 py-2">{u.email}</td>
                  <td className="px-3 py-2">{u.role || "-"}</td>
                  <td className="px-3 py-2">{u.iin || "-"}</td>
                  <td className="px-3 py-2">{u.institution || "-"}</td>
                  <td className="px-3 py-2">{u.faculty || "-"}</td>
                  <td className="px-3 py-2">{u.group_name || "-"}</td>
                  <td className="px-3 py-2">{u.is_active ? "Yes" : "No"}</td>
                  <td className="px-3 py-2">{formatDate(u.created_at)}</td>
                  <td className="px-3 py-2">
                    <Link to={`/admin/users/${encodeURIComponent(String(u.id))}`} className="text-[#7b0f2b] hover:underline">
                      {t("admin.users.details")}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
