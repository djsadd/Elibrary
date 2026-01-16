import { api } from "./client";

export type SearchBook = {
  id: number;
  title: string;
  authors?: string[];
  subjects?: string[];
  lang?: string | null;
  year?: string | null;
  summary?: string | null;
  cover?: string | null;
  popularity?: number;
};

export type SearchPage = {
  limit: number;
  offset: number;
  total: number;
};

export type SearchResponse = {
  items: SearchBook[];
  page: SearchPage;
};

export type SuggestItem = {
  id: number;
  title: string;
  authors?: string[];
};

export type SuggestResponse = {
  q: string;
  items: SuggestItem[];
};

export async function searchBooks(
  q: string,
  opts: { lang?: string; year?: string; limit?: number; offset?: number; signal?: AbortSignal } = {}
): Promise<SearchResponse> {
  const params = new URLSearchParams();
  params.set("q", q);
  if (opts.lang) params.set("lang", opts.lang);
  if (opts.year) params.set("year", opts.year);
  if (typeof opts.limit === "number") params.set("limit", String(opts.limit));
  if (typeof opts.offset === "number") params.set("offset", String(opts.offset));
  return api<SearchResponse>(`/api/search?${params.toString()}`, { signal: opts.signal });
}

export async function suggestBooks(
  q: string,
  opts: { lang?: string; limit?: number; signal?: AbortSignal } = {}
): Promise<SuggestResponse> {
  const params = new URLSearchParams();
  params.set("q", q);
  if (opts.lang) params.set("lang", opts.lang);
  if (typeof opts.limit === "number") params.set("limit", String(opts.limit));
  return api<SuggestResponse>(`/api/search/suggest?${params.toString()}`, { signal: opts.signal });
}

