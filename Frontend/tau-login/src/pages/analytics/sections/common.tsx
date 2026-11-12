import type { ReactNode } from "react";
import { ti } from "../../insights/shared";

/** Loading / error wrapper for one data source of an analytics page. */
export function SourceState({
  loading,
  error,
  hasData,
  children,
  onRetry,
}: {
  loading: boolean;
  error: string | null;
  hasData: boolean;
  children: ReactNode;
  onRetry?: () => void;
}) {
  if (loading && !hasData) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-busy="true">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />
        ))}
        <div className="col-span-full h-56 animate-pulse rounded-xl bg-slate-100" />
      </div>
    );
  }
  if (error && !hasData) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {ti("common.failed")}: {error}
        {onRetry && (
          <button className="ml-2 underline" onClick={onRetry}>
            {ti("common.retry")}
          </button>
        )}
      </div>
    );
  }
  return <>{children}</>;
}

export function KpiGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{children}</div>;
}
