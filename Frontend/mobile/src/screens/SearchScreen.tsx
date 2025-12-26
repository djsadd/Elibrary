import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { AiBook, AiVectorResult, Book, BookListResponse } from "../types";
import BookCard from "../components/BookCard";
import { apiPost } from "../lib/api";
import { API_BASE } from "../lib/constants";

type Props = {
  accessToken: string | null;
  fetchWithAuth: <T,>(path: string) => Promise<T>;
  onBookPress: (book: Book) => void;
};

export default function SearchScreen({ accessToken, fetchWithAuth, onBookPress }: Props) {
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [aiQuery, setAiQuery] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiBooks, setAiBooks] = useState<AiBook[]>([]);
  const [aiVectors, setAiVectors] = useState<AiVectorResult[]>([]);
  const [aiReply, setAiReply] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiActiveTab, setAiActiveTab] = useState<"book" | "vector">("book");
  const [aiSelectedVector, setAiSelectedVector] = useState<AiVectorResult | null>(null);
  const [aiVectorExplanation, setAiVectorExplanation] = useState<string>("");

  useEffect(() => {
    if (!query) {
      setItems([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        params.set("limit", "8");
        params.set("offset", "0");
        params.set("q", query);
        const data = await fetchWithAuth<BookListResponse>(`/api/catalog/books/search?${params.toString()}`);
        if (!cancelled) setItems(Array.isArray(data?.items) ? data.items : []);
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
  }, [fetchWithAuth, query]);

  const runAiSearch = async () => {
    const trimmed = aiQuery.trim();
    if (!trimmed) {
      setAiError("Enter a search query.");
      return;
    }
    try {
      setAiLoading(true);
      setAiError(null);
      setAiBooks([]);
      setAiVectors([]);
      setAiReply(null);
      setAiSelectedVector(null);
      setAiVectorExplanation("");
      const data = await apiPost<any>("/api/ai/chat_card", { query: trimmed }, accessToken);
      if (Array.isArray(data?.book_search)) setAiBooks(data.book_search);
      if (Array.isArray(data?.vector_search)) setAiVectors(data.vector_search);
      if (typeof data?.reply === "string") setAiReply(data.reply);
    } catch (err) {
      const text = err instanceof Error ? err.message : "Request failed.";
      setAiError(text);
    } finally {
      setAiLoading(false);
    }
  };

  const loadVectorExplanation = async (v: AiVectorResult) => {
    try {
      setAiSelectedVector(v);
      setAiVectorExplanation("");
      const response = await fetch(`${API_BASE}/api/generate_llm_context`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify({
          query: aiQuery.trim(),
          title: v.title ?? "",
          text_snippet: v.text_snippet ?? ""
        })
      });
      const text = await response.text();
      setAiVectorExplanation(text);
    } catch (err) {
      const text = err instanceof Error ? err.message : "Failed to load.";
      setAiVectorExplanation(text);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Search</Text>
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Feather name="search" size={16} color="#9ca3af" />
            <TextInput
              placeholder="Search catalog"
              placeholderTextColor="#9ca3af"
              style={styles.searchInput}
              value={queryInput}
              onChangeText={setQueryInput}
              onSubmitEditing={() => {
                const next = queryInput.trim();
                setQuery(next);
              }}
              returnKeyType="search"
            />
            {queryInput.length ? (
              <TouchableOpacity
                onPress={() => {
                  setQueryInput("");
                  setQuery("");
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
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Intelligent search</Text>
        <View style={styles.aiBox}>
          <View style={styles.aiInputRow}>
            <Feather name="search" size={16} color="#9ca3af" />
            <TextInput
              placeholder="Ask a question"
              placeholderTextColor="#9ca3af"
              style={styles.aiInput}
              value={aiQuery}
              onChangeText={setAiQuery}
              onSubmitEditing={() => !aiLoading && runAiSearch()}
              returnKeyType="search"
            />
          </View>
          <TouchableOpacity
            style={[styles.aiButton, aiLoading && styles.aiButtonDisabled]}
            onPress={() => !aiLoading && runAiSearch()}
            disabled={aiLoading}
          >
            <Text style={styles.aiButtonText}>{aiLoading ? "Searching..." : "Run AI search"}</Text>
          </TouchableOpacity>
        </View>

        {aiError ? <Text style={styles.errorText}>Failed to load: {aiError}</Text> : null}
        {aiReply ? <Text style={styles.aiReply}>AI: {aiReply}</Text> : null}

        <View style={styles.aiTabs}>
          <TouchableOpacity
            style={[styles.aiTab, aiActiveTab === "book" && styles.aiTabActive]}
            onPress={() => setAiActiveTab("book")}
          >
            <Text style={[styles.aiTabText, aiActiveTab === "book" && styles.aiTabTextActive]}>
              Book results {aiBooks.length ? `(${aiBooks.length})` : ""}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.aiTab, aiActiveTab === "vector" && styles.aiTabActive]}
            onPress={() => setAiActiveTab("vector")}
          >
            <Text style={[styles.aiTabText, aiActiveTab === "vector" && styles.aiTabTextActive]}>
              Vector results {aiVectors.length ? `(${aiVectors.length})` : ""}
            </Text>
          </TouchableOpacity>
        </View>

        {aiActiveTab === "book" ? (
          aiBooks.length ? (
            <View style={styles.aiList}>
              {aiBooks.map((b, idx) => (
                <View key={`${b.title || "book"}-${idx}`} style={styles.aiCard}>
                  <Text style={styles.aiCardTitle}>{b.title || "Untitled"}</Text>
                  <Text style={styles.aiCardMeta}>{[b.year, b.Language].filter(Boolean).join(" - ")}</Text>
                  {b.subjects ? <Text style={styles.aiCardMeta}>{b.subjects}</Text> : null}
                  {b.source ? <Text style={styles.aiCardTag}>source: {b.source}</Text> : null}
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>No AI book results yet.</Text>
          )
        ) : aiVectors.length ? (
          <View style={styles.aiList}>
            {aiVectors.map((v, idx) => (
              <View key={`${v.title || "vector"}-${idx}`} style={styles.aiCard}>
                <Text style={styles.aiCardTitle}>{v.title || "Untitled"}</Text>
                {v.text_snippet ? <Text style={styles.aiSnippet}>{v.text_snippet}</Text> : null}
                <TouchableOpacity style={styles.aiExplainButton} onPress={() => loadVectorExplanation(v)}>
                  <Text style={styles.aiExplainText}>Explain</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>No AI vector results yet.</Text>
        )}

        {aiSelectedVector && aiVectorExplanation ? (
          <View style={styles.aiExplanationBox}>
            <Text style={styles.aiExplanationTitle}>Explanation</Text>
            <Text style={styles.aiExplanationText}>{aiVectorExplanation}</Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 20
  },
  section: {
    marginBottom: 18
  },
  sectionTitle: {
    fontFamily: "Manrope_700Bold",
    fontSize: 18,
    color: "#111827"
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
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
  aiBox: {
    marginTop: 8,
    gap: 10
  },
  aiInputRow: {
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
  aiInput: {
    flex: 1,
    fontFamily: "Manrope_400Regular",
    fontSize: 13,
    color: "#111827"
  },
  aiButton: {
    alignSelf: "flex-start",
    backgroundColor: "#7b0f2b",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14
  },
  aiButtonDisabled: {
    opacity: 0.6
  },
  aiButtonText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 12,
    color: "#ffffff"
  },
  aiReply: {
    marginTop: 10,
    fontFamily: "Manrope_400Regular",
    fontSize: 12,
    color: "#374151"
  },
  aiTabs: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    marginBottom: 8
  },
  aiTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff"
  },
  aiTabActive: {
    borderColor: "#7b0f2b",
    backgroundColor: "#fdf2f5"
  },
  aiTabText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 11,
    color: "#6b7280"
  },
  aiTabTextActive: {
    color: "#7b0f2b"
  },
  aiList: {
    gap: 10
  },
  aiCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    padding: 12
  },
  aiCardTitle: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 13,
    color: "#111827"
  },
  aiCardMeta: {
    fontFamily: "Manrope_400Regular",
    fontSize: 11,
    color: "#6b7280",
    marginTop: 4
  },
  aiCardTag: {
    fontFamily: "Manrope_400Regular",
    fontSize: 10,
    color: "#6b7280",
    marginTop: 6
  },
  aiSnippet: {
    fontFamily: "Manrope_400Regular",
    fontSize: 11,
    color: "#374151",
    marginTop: 6
  },
  aiExplainButton: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff"
  },
  aiExplainText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 11,
    color: "#111827"
  },
  aiExplanationBox: {
    marginTop: 12,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    padding: 12
  },
  aiExplanationTitle: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 12,
    color: "#111827",
    marginBottom: 6
  },
  aiExplanationText: {
    fontFamily: "Manrope_400Regular",
    fontSize: 11,
    color: "#374151"
  },
  emptyText: {
    fontFamily: "Manrope_400Regular",
    fontSize: 12,
    color: "#6b7280",
    marginTop: 8
  }
});
