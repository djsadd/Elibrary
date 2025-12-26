export type Book = {
  id: number | string;
  title: string;
  year?: string | null;
  lang?: string | null;
  pub_info?: string | null;
  summary?: string | null;
  cover?: string | null;
  authors?: string[] | any[];
  subjects?: string[] | any[];
  formats?: string[] | string | null;
  file_id?: string | null;
  download_url?: string | null;
};

export type Playlist = {
  id: number | string;
  title: string;
  description?: string | null;
  books: Book[];
};

export type UserBook = {
  id: number | string;
  progress_percent?: number | null;
  status?: string | null;
  book: Book;
};

export type AiBook = {
  Language?: string;
  title?: string;
  pub_info?: string;
  year?: string;
  subjects?: string;
  source?: string;
};

export type AiVectorResult = {
  title?: string;
  download_url?: string;
  text_snippet?: string;
};

export type BookListResponse = {
  items: Book[];
  page?: { limit: number; offset: number; total: number };
};

export type Review = {
  id: string;
  rating: number;
  text: string;
  author?: string;
  created_at: string;
};
