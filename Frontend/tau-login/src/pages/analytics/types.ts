export type KeyCount = { key: string; count: number };
type Named = { id: number; name: string; name_ru?: string | null; name_kk?: string | null; name_en?: string | null };
type BookBrief = { id: number; title: string; authors: string[]; year?: string | null };

export type TrafficSummary = {
  events: number;
  users: number;
  guests: number;
  sessions: number;
  errors_5xx: number;
  errors_4xx: number;
};

export type TrafficInsights = {
  range: { from: string; to: string; prev_from: string; prev_to: string };
  current: TrafficSummary;
  previous: TrafficSummary;
  stickiness: { dau: number; wau: number; mau: number; avg_dau: number; ratio: number };
  daily: { day: string; events: number; users: number; guests: number; sessions: number; errors: number }[];
  heatmap: number[][];
  status: Record<string, number>;
  error_paths: { path: string; count: number; status: number }[];
  devices: { device: KeyCount[]; browser: KeyCount[]; os: KeyCount[] };
  top_pages: { path: string; sessions: number; visitors: number }[];
  book_views: { book_id: number; views: number; visitors: number }[];
  downloads: number;
  searches: { total: number; top: { query: string; count: number }[] };
  users: {
    new: number;
    returning: number;
    top: { user_id: number; events: number; sessions: number; active_days: number; last_seen: string }[];
  };
  cohorts: { cohort: string; size: number; retention: number[] }[];
};

export type LibraryInsights = {
  range: { from: string; to: string; days: number };
  kpi: {
    active_readers: number;
    active_readers_prev: number;
    minutes: number;
    minutes_prev: number;
    pages: number;
    new_readers: number;
    added_to_shelves: number;
    readers_total: number;
    avg_minutes_per_reader: number;
    completion_rate: number;
    notes_total: number;
    notes_window: number;
  };
  catalog: {
    total: number;
    public: number;
    never_opened: number;
    coverage: number;
    by_lang: KeyCount[];
    by_source: KeyCount[];
    by_format: KeyCount[];
    by_decade: KeyCount[];
    added_monthly: { month: string; count: number }[];
  };
  daily: { day: string; readers: number; minutes: number; pages: number }[];
  weekday_minutes: number[];
  funnel: { started: number; p25: number; p50: number; p75: number; completed: number };
  top_books: (BookBrief & { readers: number; completed: number; completion_rate: number; avg_progress: number; minutes: number })[];
  trending_books: (BookBrief & { minutes: number; readers: number })[];
  top_subjects: (Named & { readers: number; shelves: number })[];
  top_authors: (Named & { readers: number; shelves: number })[];
};
