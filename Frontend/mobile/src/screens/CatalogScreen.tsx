import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Book, BookListResponse } from "../types";
import BookCard from "../components/BookCard";

const PAGE_SIZE = 8;

type Props = {
  fetchWithAuth: <T,>(path: string) => Promise<T>;
  onBookPress: (book: Book) => void;
};

export default function CatalogScreen({ fetchWithAuth, onBookPress }: Props) {
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState<number | null>(null);
  const [items, setItems] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        params.set("limit", String(PAGE_SIZE));
        params.set("offset", String(page * PAGE_SIZE));
        if (query) params.set("q", query);
        const endpoint = query ? "/api/catalog/books/search" : "/api/catalog/books";
        const data = await fetchWithAuth<BookListResponse>(`${endpoint}?${params.toString()}`);
        if (!cancelled) {
          setItems(Array.isArray(data?.items) ? data.items : []);
          setTotal(typeof data?.page?.total === "number" ? data.page.total : null);
        }
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
  }, [fetchWithAuth, page, query]);

  const totalPages = total ? Math.ceil(total / PAGE_SIZE) : null;
  const canPrev = page > 0;
  const canNext = totalPages !== null ? page + 1 < totalPages : items.length === PAGE_SIZE;

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Feather name="search" size={16} color="#9ca3af" />
          <TextInput
            placeholder="Search books"
            placeholderTextColor="#9ca3af"
            style={styles.searchInput}
            value={queryInput}
            onChangeText={setQueryInput}
            onSubmitEditing={() => {
              const next = queryInput.trim();
              setQuery(next);
              setPage(0);
            }}
            returnKeyType="search"
          />
          {queryInput.length ? (
            <TouchableOpacity
              onPress={() => {
                setQueryInput("");
                setQuery("");
                setPage(0);
              }}
            >
              <Feather name="x" size={16} color="#9ca3af" />
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity
          style={styles.searchButton}
          onPress={() => {
            const next = queryInput.trim();
            setQuery(next);
            setPage(0);
          }}
        >
          <Text style={styles.searchButtonText}>Search</Text>
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.errorText}>Failed to load: {error}</Text> : null}

      <View style={styles.bookGrid}>
        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#7b0f2b" />
          </View>
        ) : (
          items.map((b) => <BookCard key={String(b.id)} book={b} onPress={onBookPress} />)
        )}
      </View>

      <View style={styles.paginationRow}>
        <TouchableOpacity
          style={[styles.pageButton, !canPrev && styles.pageButtonDisabled]}
          onPress={() => canPrev && setPage((p) => Math.max(0, p - 1))}
          disabled={!canPrev}
        >
          <Text style={styles.pageButtonText}>Prev</Text>
        </TouchableOpacity>
        <Text style={styles.pageInfo}>{totalPages ? `${page + 1} / ${totalPages}` : `Page ${page + 1}`}</Text>
        <TouchableOpacity
          style={[styles.pageButton, !canNext && styles.pageButtonDisabled]}
          onPress={() => canNext && setPage((p) => p + 1)}
          disabled={!canNext}
        >
          <Text style={styles.pageButtonText}>Next</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 20
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  searchInput: {
    flex: 1,
    fontFamily: "Manrope_400Regular",
    fontSize: 13,
    color: "#111827"
  },
  searchButton: {
    backgroundColor: "#7b0f2b",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14
  },
  searchButtonText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 12,
    color: "#ffffff"
  },
  errorText: {
    fontFamily: "Manrope_400Regular",
    fontSize: 12,
    color: "#b91c1c",
    marginTop: 6
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
  paginationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16
  },
  pageButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff"
  },
  pageButtonDisabled: {
    opacity: 0.5
  },
  pageButtonText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 12,
    color: "#111827"
  },
  pageInfo: {
    fontFamily: "Manrope_400Regular",
    fontSize: 12,
    color: "#6b7280"
  }
});
