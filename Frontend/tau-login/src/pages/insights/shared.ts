import { useCallback, useEffect, useRef, useState } from "react";
import { getLang, t } from "@/shared/i18n";

/** Translate a key under `insights.` */
export const ti = (key: string, vars?: Record<string, string | number>) => t(`insights.${key}`, vars);
/** Translated list (months / weekdays) */
export const tl = (key: string): string[] => {
  const v = t(`insights.${key}`) as unknown;
  return Array.isArray(v) ? (v as string[]) : [];
};

export function fmtMinutes(min: number): string {
  const m = Math.round(min || 0);
  const h = ti("common.h");
  const mm = ti("common.min");
  if (m < 60) return `${m} ${mm}`;
  const hours = Math.floor(m / 60);
  if (hours >= 100) return `${new Intl.NumberFormat().format(hours)} ${h}`;
  const rest = m % 60;
  return rest ? `${hours} ${h} ${rest} ${mm}` : `${hours} ${h}`;
}

/** "2026-11-12" -> "12 Nov" */
export function fmtDay(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${tl("common.months")[m - 1] ?? m}`;
}

/** "2026-11" -> "Nov" (adds the year in January) */
export function fmtMonth(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const name = tl("common.months")[m - 1] ?? String(m);
  return m === 1 ? `${name} ’${String(y).slice(2)}` : name;
}

export function fmtDateTime(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

const pad2 = (n: number) => String(n).padStart(2, "0");
export const ymd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

export function rangeForDays(days: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - (days - 1));
  return { from: ymd(from), to: ymd(to) };
}

/** Re-render when the UI language changes. */
export function useLangVersion(): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    const on = () => setV((x) => x + 1);
    window.addEventListener("lang:changed", on);
    return () => window.removeEventListener("lang:changed", on);
  }, []);
  return v;
}

export type AsyncState<T> = { data: T | null; error: string | null; loading: boolean; reload: () => void };

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fnRef
      .current()
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e?.message || ti("common.failed")))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, error, loading, reload };
}

/** Pick the localized name of an author/subject. */
export function i18nName(obj: { name: string; name_ru?: string | null; name_kk?: string | null; name_en?: string | null }): string {
  const lang = getLang();
  const v = lang === "ru" ? obj.name_ru : lang === "kk" ? obj.name_kk : lang === "en" ? obj.name_en : null;
  return (v && v.trim()) || obj.name;
}

/** Compact minutes for chart axes: "45 мин", "3 ч", "1,2K ч". */
export function fmtMinutesAxis(min: number): string {
  if (min < 60) return `${Math.round(min)} ${ti("common.min")}`;
  const h = min / 60;
  const n = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(h);
  return `${n} ${ti("common.h")}`;
}
