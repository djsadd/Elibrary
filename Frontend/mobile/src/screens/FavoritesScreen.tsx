import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Book } from "../types";
import BookCard from "../components/BookCard";

const PAGE_SIZE = 12;

type Props = {
  fetchWithAuth: <T,>(path: string) => Promise<T>;
  onBookPress: (book: Book) => void;
};

export default function FavoritesScreen({ fetchWithAuth, onBookPress }: Props) {
  const [items, setItems] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const pickArray = (obj: any): any[] => {
    if (!obj) return [];
    if (Array.isArray(obj)) return obj;
    if (Array.isArray(obj.items)) return obj.items;
    if (Array.isArray(obj.data)) return obj.data;
    if (Array.isArray(obj.results)) return obj.results;
    if (Array.isArray(obj.favourites)) return obj.favourites;
    if (Array.isArray(obj.favorites)) return obj.favorites;
    return [];
  };

  const normaliseToBooks = async (raw: any[]): Promise<Book[]> => {
    const out: Book[] = [];
    const missingIds: (string | number)[] = [];
    for (const it of raw) {
      if (!it) continue;
      if (typeof it === "number" || typeof it === "string") {
        missingIds.push(it);
        continue;
      }
      if (it.book && typeof it.book === "object" && (it.book.title || it.book.id)) {
        out.push(it.book as Book);
        continue;
      }
      if (it.book_data && (it.book_data.title || it.book_data.id)) {
        out.push(it.book_data as Book);
        continue;
      }
      const bid = it.book_id ?? it.bookId ?? it.catalog_id ?? it.catalogId ?? null;
      if (bid != null) missingIds.push(bid);
    }
    if (!missingIds.length) return out;
    const pool = 6;
    for (let i = 0; i < missingIds.length; i += pool) {
      const chunk = missingIds.slice(i, i + pool);
      const res = await Promise.all(
        chunk.map((id) => fetchWithAuth<Book>(`/api/catalog/books/${id}`).catch(() => null))
      );
      for (const b of res) if (b && b.id != null) out.push(b);
    }
    return out;
  };

  const fetchPage = async (initial = false) => {
    const nextOffset = initial ? 0 : offset;
    const params = new URLSearchParams();
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(nextOffset));
    const data = await fetchWithAuth<any>(`/api/favourites/?${params.toString()}`);
    const raw = pickArray(data);
    const pageMeta = data?.page || data?.pagination || (typeof data?.total === "number" ? { total: data.total } : null);
    const books = await normaliseToBooks(raw);
    setItems((prev) => {
      const seen = new Set(prev.map((b) => String(b.id)));
      const add = books.filter((b) => !seen.has(String(b.id)));
      return initial ? add : [...prev, ...add];
    });
    const pageCount = Array.isArray(raw) ? raw.length : 0;
    if (pageMeta && typeof (pageMeta.total ?? pageMeta.count) === "number") {
      const total = Number(pageMeta.total ?? pageMeta.count);
      const newOffset = nextOffset + pageCount;
      setOffset(newOffset);
      setHasMore(newOffset < total);
    } else {
      setOffset(nextOffset + pageCount);
      setHasMore(pageCount >= PAGE_SIZE);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        setOffset(0);
        setHasMore(true);
        await fetchPage(true);
      } catch (err) {
        if (!cancelled) {
          const text = err instanceof Error ? err.message : "Failed to load.";
          setError(text);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchWithAuth]);

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {error ? <Text style={styles.errorText}>Failed to load: {error}</Text> : null}
      <View style={styles.bookGrid}>
        {loading && items.length === 0 ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#7b0f2b" />
          </View>
        ) : (
          items.map((b) => <BookCard key={String(b.id)} book={b} onPress={onBookPress} />)
        )}
      </View>
      {!loading && items.length === 0 ? <Text style={styles.emptyText}>No favorites yet.</Text> : null}
      {hasMore ? (
        <TouchableOpacity
          style={[styles.loadMoreButton, loading && styles.loadMoreButtonDisabled]}
          onPress={async () => {
            if (loading) return;
            try {
              setLoading(true);
              setError(null);
              await fetchPage(false);
            } catch (err) {
              const text = err instanceof Error ? err.message : "Failed to load.";
              setError(text);
            } finally {
              setLoading(false);
            }
          }}
        >
          <Text style={styles.loadMoreText}>{loading ? "Loading..." : "Load more"}</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 20
  },
  bookGrid: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  loadingRow: {
    paddingVertical: 12
  },
  errorText: {
    fontFamily: "Manrope_400Regular",
    fontSize: 12,
    color: "#b91c1c",
    marginTop: 6
  },
  emptyText: {
    fontFamily: "Manrope_400Regular",
    fontSize: 12,
    color: "#6b7280",
    marginTop: 12
  },
  loadMoreButton: {
    alignSelf: "center",
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 16
  },
  loadMoreButtonDisabled: {
    opacity: 0.6
  },
  loadMoreText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 12,
    color: "#111827"
  }
});
