import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Book, Playlist } from "../types";
import BookCard from "../components/BookCard";

type Props = {
  fetchWithAuth: <T,>(path: string) => Promise<T>;
  onBookPress: (book: Book) => void;
};

export default function HomeScreen({ fetchWithAuth, onBookPress }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [quoteIndex, setQuoteIndex] = useState(0);

  const heroQuotes = useMemo(
    () => [
      { text: "Reading gives us someplace to go when we have to stay where we are.", author: "Mason Cooley" },
      { text: "A room without books is like a body without a soul.", author: "Marcus Tullius Cicero" },
      { text: "So many books, so little time.", author: "Frank Zappa" }
    ],
    []
  );

  useEffect(() => {
    const id = setInterval(() => {
      setQuoteIndex((i) => (i + 1) % heroQuotes.length);
    }, 4500);
    return () => clearInterval(id);
  }, [heroQuotes.length]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const pls = await fetchWithAuth<Playlist[]>("/api/catalog/playlists");
        if (!cancelled && Array.isArray(pls) && pls.length) {
          setPlaylists(pls);
          setLoading(false);
          return;
        }
      } catch {
        // ignore and fallback
      }
      try {
        const data = await fetchWithAuth<{ items: Book[] }>("/api/catalog/books");
        if (!cancelled) setBooks(Array.isArray(data.items) ? data.items : []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchWithAuth]);

  const renderSection = (title: string, subtitle: string, items: Book[]) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      {!!error && <Text style={styles.sectionError}>Failed to load: {error}</Text>}
      <View style={styles.bookGrid}>
        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#111827" />
          </View>
        ) : (
          items.slice(0, 8).map((b) => <BookCard key={String(b.id)} book={b} onPress={onBookPress} />)
        )}
      </View>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={["#EB5231", "#571FCF"]} style={styles.heroCard}>
        <Text style={styles.heroTitle}>Welcome back</Text>
        <Text style={styles.heroQuote}>{heroQuotes[quoteIndex].text}</Text>
        <View style={styles.heroFooter}>
          <Text style={styles.heroAuthor}>- {heroQuotes[quoteIndex].author}</Text>
          <View style={styles.heroDots}>
            {heroQuotes.map((_, i) => (
              <TouchableOpacity
                key={String(i)}
                onPress={() => setQuoteIndex(i)}
                style={[styles.heroDot, quoteIndex === i && styles.heroDotActive]}
              />
            ))}
          </View>
        </View>
      </LinearGradient>

      {playlists.length
        ? playlists.map((pl) =>
            renderSection(pl.title, pl.description || "Recommended for You", pl.books || [])
          )
        : renderSection("Good Morning", "Recommended for You", books)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 20
  },
  heroCard: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 16
  },
  heroTitle: {
    fontFamily: "Manrope_700Bold",
    fontSize: 18,
    color: "#ffffff"
  },
  heroQuote: {
    fontFamily: "Manrope_400Regular",
    fontSize: 13,
    color: "#ffffff",
    marginTop: 10,
    lineHeight: 18
  },
  heroFooter: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  heroAuthor: {
    fontFamily: "Manrope_400Regular",
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.9)"
  },
  heroDots: {
    flexDirection: "row",
    gap: 6
  },
  heroDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.4)"
  },
  heroDotActive: {
    backgroundColor: "#ffffff"
  },
  section: {
    marginBottom: 18
  },
  sectionTitle: {
    fontFamily: "Manrope_700Bold",
    fontSize: 18,
    color: "#111827"
  },
  sectionSubtitle: {
    fontFamily: "Manrope_400Regular",
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4
  },
  sectionError: {
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
  }
});
