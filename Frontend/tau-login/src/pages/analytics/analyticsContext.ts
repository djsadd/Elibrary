import { useOutletContext } from "react-router-dom";
import type { LibraryInsights, TrafficInsights } from "./types";

export type AnalyticsContext = {
  days: number;
  /** Inclusive "YYYY-MM-DD" range the data was requested for. */
  range: { from: string; to: string };
  traffic: { data: TrafficInsights | null; error: string | null; loading: boolean };
  library: { data: LibraryInsights | null; error: string | null; loading: boolean };
  reload: () => void;
};

/** Shared admin analytics data, fetched once in AnalyticsLayout for the selected period. */
export function useAnalytics() {
  return useOutletContext<AnalyticsContext>();
}
