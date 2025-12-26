import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Book, UserBook } from "../types";
import BookCard from "../components/BookCard";

type Props = {
  fetchWithAuth: <T,>(path: string) => Promise<T>;
  onBookPress: (book: Book) => void;
};

export default function ShelfScreen({ fetchWithAuth, onBookPress }: Props) {
  const [items, setItems] = useState<UserBook[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("EBOOK");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchWithAuth<UserBook[]>("/api/catalog/userbook");
        if (!cancelled) setItems(Array.isArray(data) ? data : []);
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

  const normalizeFormat = (s: string) =>
    s
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .replace(/^EBOOKS?$/, "EBOOK")
      .replace(/^AUDIOBOOKS?$/, "AUDIOBOOK")
      .replace(/^VIDEOBOOKS?$/, "VIDEOBOOK");

  const normalizedFormats = (b: Book): string[] => {
    const raw: any = (b as any)?.formats;
    const arr: any[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const vals = arr
      .map((v: any) => {
        if (typeof v === "string") return normalizeFormat(v);
        if (v && typeof v === "object") {
          const cand = v.id ?? v.code ?? v.value ?? v.name ?? "";
          return normalizeFormat(String(cand || ""));
        }
        return "";
      })
      .filter(Boolean);
    return Array.from(new Set(vals));
  };

  const tabs = [
    { key: "EBOOK", label: "E-Book" },
    { key: "AUDIOBOOK", label: "Audio" },
    { key: "VIDEOBOOK", label: "Video" },
    { key: "INTERACTIVE", label: "Interactive" },
    { key: "HARDCOPY", label: "Hardcopy" }
  ];

  const filtered = items.filter((ub) => normalizedFormats(ub.book).includes(tab));

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.tabs}>
        {tabs.map((t) => (
          <TouchableOpacity
            key={t.key}
            onPress={() => setTab(t.key)}
            style={[styles.tab, tab === t.key && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {error ? <Text style={styles.errorText}>Failed to load: {error}</Text> : null}
      <View style={styles.bookGrid}>
        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#7b0f2b" />
          </View>
        ) : (
          filtered.map((ub) => {
            const progress =
              typeof ub.progress_percent === "number"
                ? Math.max(0, Math.min(100, Math.round(ub.progress_percent)))
                : null;
            return (
              <BookCard
                key={`${ub.id}-${ub.book?.id}`}
                book={ub.book}
                onPress={onBookPress}
                showProgress={progress}
              />
            );
          })
        )}
      </View>
      {!loading && filtered.length === 0 ? (
        <Text style={styles.emptyText}>No items in this section yet.</Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 20
  },
  tabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12
  },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff"
  },
  tabActive: {
    borderColor: "#7b0f2b",
    backgroundColor: "#fdf2f5"
  },
  tabText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 12,
    color: "#6b7280"
  },
  tabTextActive: {
    color: "#7b0f2b"
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
  emptyText: {
    fontFamily: "Manrope_400Regular",
    fontSize: 12,
    color: "#6b7280",
    marginTop: 12
  }
});
