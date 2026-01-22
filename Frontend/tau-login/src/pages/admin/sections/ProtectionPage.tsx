import { useEffect, useMemo, useState } from "react";
import { t } from "@/shared/i18n";
import type { LockoutScope, LockoutItem } from "@/shared/api/authProtection";
import { banLockout, clearLockout, listLockouts } from "@/shared/api/authProtection";

function formatTtl(seconds?: number | null) {
  const s = Math.max(0, Number(seconds || 0));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

function formatTs(ts?: number | null) {
  if (!ts) return "-";
  const d = new Date(ts * 1000);
  if (Number.isNaN(d.getTime())) return String(ts);
  return d.toLocaleString();
}

export default function ProtectionPage() {
  const [scope, setScope] = useState<LockoutScope>("ip");
  const [data, setData] = useState<{ items: LockoutItem[]; next_cursor: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [banIdent, setBanIdent] = useState("");
  const [banReason, setBanReason] = useState("manual");
  const [banDuration, setBanDuration] = useState(900);
  const [submitting, setSubmitting] = useState(false);

  const items = data?.items || [];

  const reload = (cursor = 0) => {
    let alive = true;
    setLoading(true);
    setError(null);
    listLockouts(scope, cursor, 200)
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
  };

  useEffect(() => reload(0), [scope]);

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => (b.ttl_seconds || 0) - (a.ttl_seconds || 0));
  }, [items]);

  const onClear = async (ident: string) => {
    if (!ident) return;
    try {
      await clearLockout(scope, ident);
      await listLockouts(scope, 0, 200).then(setData);
    } catch (e: any) {
      setError(e?.message || t("admin.common.failed"));
    }
  };

  const onBan = async () => {
    const ident = banIdent.trim();
    if (!ident) return;
    setSubmitting(true);
    setError(null);
    try {
      await banLockout({
        scope,
        ident,
        reason: banReason.trim() || "manual",
        duration_seconds: Number(banDuration || 0),
      });
      setBanIdent("");
      await listLockouts(scope, 0, 200).then(setData);
    } catch (e: any) {
      setError(e?.message || t("admin.common.failed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t("admin.nav.protection")}</h2>
        <div className="flex items-center gap-2">
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as LockoutScope)}
            className="border border-slate-200 rounded-md px-3 py-1.5 text-sm"
          >
            <option value="ip">IP</option>
            <option value="email">Email</option>
          </select>
          <button
            onClick={() => reload(0)}
            className="px-3 py-1.5 rounded-md text-sm border border-slate-200 hover:bg-slate-50"
          >
            {t("admin.protection.refresh")}
          </button>
        </div>
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}

      <div className="border border-slate-200 rounded-md p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[240px]">
            <label className="block text-xs text-slate-500 mb-1">{t("admin.protection.ident")}</label>
            <input
              value={banIdent}
              onChange={(e) => setBanIdent(e.target.value)}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
              placeholder={scope === "ip" ? "1.2.3.4" : "user@example.com"}
            />
          </div>
          <div className="min-w-[180px]">
            <label className="block text-xs text-slate-500 mb-1">{t("admin.protection.reason")}</label>
            <input
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
              placeholder="manual"
            />
          </div>
          <div className="min-w-[140px]">
            <label className="block text-xs text-slate-500 mb-1">{t("admin.protection.duration")}</label>
            <input
              type="number"
              min={30}
              max={60 * 60 * 24 * 30}
              value={banDuration}
              onChange={(e) => setBanDuration(Number(e.target.value))}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <button
            disabled={submitting}
            onClick={onBan}
            className="px-3 py-2 rounded-md text-sm bg-[#7b0f2b] text-white hover:opacity-95 disabled:opacity-60"
          >
            {t("admin.protection.ban")}
          </button>
        </div>
        <div className="text-xs text-slate-500 mt-2">
          {t("admin.protection.note")}
        </div>
      </div>

      {loading && <div className="text-slate-500 text-sm">{t("admin.common.loading")}</div>}

      {!loading && (
        <div className="overflow-auto border border-slate-200 rounded-md">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-3 py-2">{t("admin.protection.table.ident")}</th>
                <th className="text-left px-3 py-2">{t("admin.protection.table.ttl")}</th>
                <th className="text-left px-3 py-2">{t("admin.protection.table.reason")}</th>
                <th className="text-left px-3 py-2">{t("admin.protection.table.lockedAt")}</th>
                <th className="text-left px-3 py-2">{t("admin.protection.table.failures")}</th>
                <th className="text-left px-3 py-2">{t("admin.protection.table.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-slate-500 py-6">
                    {t("admin.protection.empty")}
                  </td>
                </tr>
              )}
              {sorted.map((x) => (
                <tr key={`${x.scope}:${x.ident}`} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-mono text-xs">{x.ident}</td>
                  <td className="px-3 py-2">{formatTtl(x.ttl_seconds)}</td>
                  <td className="px-3 py-2">{x.reason || "-"}</td>
                  <td className="px-3 py-2">{formatTs(x.locked_at)}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {scope === "email"
                      ? `email=${x.email_failures ?? "-"}`
                      : `ip=${x.ip_failures ?? "-"}`}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => onClear(x.ident)}
                      className="text-[#7b0f2b] hover:underline"
                    >
                      {t("admin.protection.unban")}
                    </button>
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

