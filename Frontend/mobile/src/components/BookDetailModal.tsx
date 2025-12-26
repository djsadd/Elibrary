import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import * as FileSystem from "expo-file-system";
import { Book, Review } from "../types";
import { API_BASE } from "../lib/constants";
import { getFavoriteIds, setFavoriteIds } from "../lib/storage";
import { apiPost } from "../lib/api";
import { humanizeFormat, humanizeFormatList, namesFrom } from "../lib/format";

type Props = {
  visible: boolean;
  bookId: string | number | null;
  accessToken: string | null;
  fetchWithAuth: <T,>(path: string) => Promise<T>;
  onClose: () => void;
};

export default function BookDetailModal({ visible, bookId, accessToken, fetchWithAuth, onClose }: Props) {
  const [bookDetail, setBookDetail] = useState<Book | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "details" | "reviews" | "related" | "lists">("overview");
  const [readingCount, setReadingCount] = useState({ currently_reading: 0, have_read: 0 });
  const [favorite, setFavorite] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [readerOpen, setReaderOpen] = useState(false);
  const [readerHtml, setReaderHtml] = useState<string | null>(null);
  const [readerLoading, setReaderLoading] = useState(false);
  const [readerError, setReaderError] = useState<string | null>(null);
  const [readerPage, setReaderPage] = useState(1);
  const [readerPageCount, setReaderPageCount] = useState(0);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesText, setNotesText] = useState("");
  const [userbookId, setUserbookId] = useState<string | null>(null);
  const notesMapRef = useRef<Map<number, string>>(new Map());
  const notesIdMapRef = useRef<Map<number, string | number>>(new Map());
  const progressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!bookId || !visible) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        setTab("overview");
        setReviews([]);
        setRating(0);
        setReviewText("");
        const data = await fetchWithAuth<Book>(`/api/catalog/books/${bookId}`);
        if (!cancelled) setBookDetail(data);
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
  }, [bookId, visible, fetchWithAuth]);

  useEffect(() => {
    if (!bookId || !visible) return;
    let cancelled = false;
    (async () => {
      try {
        const stats = await fetchWithAuth<{ currently_reading?: number; have_read?: number }>(
          `/api/catalog/userbook/reading_count/${bookId}`
        );
        if (!cancelled) {
          setReadingCount({
            currently_reading: Number(stats?.currently_reading ?? 0),
            have_read: Number(stats?.have_read ?? 0)
          });
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [bookId, visible, fetchWithAuth]);

  useEffect(() => {
    if (!bookId || !visible) return;
    (async () => {
      const ids = await getFavoriteIds();
      setFavorite(ids.includes(String(bookId)));
    })();
  }, [bookId, visible]);

  useEffect(() => {
    if (!readerOpen) return;
    const existing = notesMapRef.current.get(readerPage) ?? "";
    setNotesText(existing);
  }, [readerOpen, readerPage]);

  useEffect(() => {
    if (!readerOpen || !bookId || !userbookId || readerPageCount <= 0) return;
    if (progressTimerRef.current) clearTimeout(progressTimerRef.current);
    progressTimerRef.current = setTimeout(async () => {
      const payload = {
        current_page: readerPage,
        total_pages: readerPageCount,
        progress_percent: Math.max(0, Math.min(100, Math.round((readerPage / readerPageCount) * 100))),
        status: "reading"
      };
      try {
        await apiJson(`/api/catalog/userbook/${userbookId}`, {
          method: "PATCH",
          body: JSON.stringify(payload)
        });
      } catch {}
    }, 800);
    return () => {
      if (progressTimerRef.current) clearTimeout(progressTimerRef.current);
    };
  }, [readerOpen, readerPage, readerPageCount, userbookId, bookId]);

  useEffect(() => {
    if (!readerOpen || !bookId) return;
    notesMapRef.current.set(readerPage, notesText);
    if (notesTimerRef.current) clearTimeout(notesTimerRef.current);
    notesTimerRef.current = setTimeout(async () => {
      const trimmed = notesText.trim();
      if (!trimmed) return;
      const existingId = notesIdMapRef.current.get(readerPage);
      const body = { book_id: Number(bookId), page: readerPage, note: trimmed };
      try {
        let resp: any = null;
        if (existingId != null) {
          resp = await apiJson(`/api/catalog/notes/${encodeURIComponent(String(existingId))}`, {
            method: "PATCH",
            body: JSON.stringify(body)
          });
        } else {
          resp = await apiJson(`/api/catalog/notes`, {
            method: "POST",
            body: JSON.stringify(body)
          });
        }
        const newId = resp?.id ?? resp?.note_id ?? resp?.uuid;
        if (newId != null) notesIdMapRef.current.set(readerPage, newId);
      } catch {}
    }, 800);
    return () => {
      if (notesTimerRef.current) clearTimeout(notesTimerRef.current);
    };
  }, [readerOpen, readerPage, notesText, bookId]);

  if (!visible || !bookId) return null;

  const authorNames = namesFrom(bookDetail?.authors);
  const subjectNames = namesFrom(bookDetail?.subjects);
  const downloadHref = bookId ? `${API_BASE}/api/catalog/books/${bookId}/download` : bookDetail?.download_url || null;

  const apiJson = async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const res = await fetch(`${API_BASE}${path}`, {
      ...(init || {}),
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...((init?.headers as any) || {})
      }
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || `HTTP ${res.status}`);
    }
    return res.json();
  };

  const ensureUserbook = async (): Promise<number> => {
    if (!bookId) return 1;
    try {
      const existing: any = await apiJson(`/api/catalog/userbook/by-book/${encodeURIComponent(String(bookId))}`);
      if (existing?.id != null) {
        setUserbookId(String(existing.id));
        const cp = Number(existing.current_page);
        return !Number.isNaN(cp) && cp > 0 ? cp : 1;
      }
    } catch (err: any) {
      const msg = err?.message ? String(err.message) : "";
      if (!/404|not\s*found/i.test(msg)) return 1;
      const payload = {
        book_id: Number(bookId),
        current_page: 0,
        total_pages: null,
        progress_percent: 0.0,
        status: "reading",
        reading_time: 0.0
      };
      try {
        const created: any = await apiJson("/api/catalog/userbook", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        if (created?.id != null) setUserbookId(String(created.id));
        const cp = Number(created?.current_page);
        return !Number.isNaN(cp) && cp > 0 ? cp : 1;
      } catch {}
    }
    return 1;
  };

  const loadNotes = async (page: number) => {
    if (!bookId) return;
    try {
      const qs = new URLSearchParams();
      qs.set("book_id", String(bookId));
      const data = await apiJson<any[]>(`/api/catalog/notes?${qs.toString()}`);
      const map = new Map<number, string>();
      const idMap = new Map<number, string | number>();
      (Array.isArray(data) ? data : []).forEach((n: any) => {
        const p = Number(n?.page ?? 0);
        const t = String(n?.note ?? "").trim();
        const id = n?.id ?? n?.note_id ?? n?.uuid;
        if (p > 0 && t) {
          map.set(p, t);
          if (id != null) idMap.set(p, id);
        }
      });
      notesMapRef.current = map;
      notesIdMapRef.current = idMap;
      setNotesText(map.get(page) ?? "");
    } catch {}
  };

  const openReader = async () => {
    if (!downloadHref) {
      setReaderError("No PDF available for this book.");
      setReaderOpen(true);
      return;
    }
    try {
      setReaderLoading(true);
      setReaderError(null);
      setNotesOpen(false);
      const initialPage = await ensureUserbook();
      setReaderPage(initialPage);
      await loadNotes(initialPage);
      const target = `${FileSystem.cacheDirectory}book-${String(bookId)}.pdf`;
      const result = await FileSystem.downloadAsync(downloadHref, target, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
      });
      const base64 = await FileSystem.readAsStringAsync(result.uri, {
        encoding: FileSystem.EncodingType.Base64
      });
      setReaderHtml(buildPdfHtml(base64, initialPage));
      setReaderOpen(true);
    } catch (err) {
      const text = err instanceof Error ? err.message : "Failed to open PDF.";
      setReaderError(text);
      setReaderOpen(true);
    } finally {
      setReaderLoading(false);
    }
  };

  const buildPdfHtml = (base64: string, initialPage: number) => {
    const safeBase64 = base64.replace(/\\s+/g, "");
    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { margin: 0; background: #ffffff; font-family: sans-serif; }
      #toolbar { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-bottom: 1px solid #e5e7eb; }
      #toolbar button { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 6px 10px; }
      #pageInfo { font-size: 12px; color: #111827; }
      #viewer { display: flex; justify-content: center; }
      canvas { width: 100%; height: auto; }
    </style>
  </head>
  <body>
    <div id="toolbar">
      <button id="prev">Prev</button>
      <div id="pageInfo">Page 1 / 1</div>
      <button id="next">Next</button>
    </div>
    <div id="viewer">
      <canvas id="pdfCanvas"></canvas>
    </div>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
    <script>
      const raw = atob("${safeBase64}");
      const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

      const pdfjsLib = window['pdfjs-dist/build/pdf'];
      pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      let pdfDoc = null;
      let pageNum = Math.max(1, ${initialPage || 1});
      const canvas = document.getElementById('pdfCanvas');
      const ctx = canvas.getContext('2d');

      function renderPage(num) {
        pdfDoc.getPage(num).then(function(page) {
          const viewport = page.getViewport({ scale: 1.2 });
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          page.render({ canvasContext: ctx, viewport });
          document.getElementById('pageInfo').innerText = 'Page ' + num + ' / ' + pdfDoc.numPages;
          try {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'page', page: num, total: pdfDoc.numPages }));
          } catch (e) {}
        });
      }

      pdfjsLib.getDocument({ data: bytes }).promise.then(function(pdf) {
        pdfDoc = pdf;
        renderPage(pageNum);
      });

      document.getElementById('prev').addEventListener('click', function() {
        if (pageNum <= 1) return;
        pageNum--;
        renderPage(pageNum);
      });
      document.getElementById('next').addEventListener('click', function() {
        if (!pdfDoc || pageNum >= pdfDoc.numPages) return;
        pageNum++;
        renderPage(pageNum);
      });
    </script>
  </body>
</html>`;
  };

  return (
    <Modal visible onRequestClose={onClose} animationType="slide">
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.back}>
            <Feather name="chevron-left" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Book</Text>
          <View style={styles.headerSpacer} />
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="small" color="#7b0f2b" />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>Failed to load: {error}</Text>
          </View>
        ) : bookDetail ? (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.coverCard}>
              {bookDetail.cover ? (
                <Image source={{ uri: bookDetail.cover }} style={styles.cover} resizeMode="contain" />
              ) : (
                <View style={styles.coverPlaceholder}>
                  <Feather name="book-open" size={28} color="#c1c4cb" />
                </View>
              )}
            </View>

            <Text style={styles.title}>{bookDetail.title}</Text>
            <Text style={styles.meta}>
              {authorNames.length ? authorNames.join(", ") : "-"}
              {bookDetail.year ? `, ${bookDetail.year}` : ""}
            </Text>

            <View style={styles.ratingRow}>
              <View style={styles.stars}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Feather key={String(i)} name="star" size={14} color="#f59e0b" />
                ))}
                <Text style={styles.ratingText}>5.0 Ratings</Text>
              </View>
              <Text style={styles.counter}>{readingCount.currently_reading} currently reading</Text>
              <Text style={styles.counter}>{readingCount.have_read} have read</Text>
            </View>

            {Array.isArray(bookDetail.formats) && bookDetail.formats.length ? (
              <View style={styles.formats}>
                {bookDetail.formats.map((f, i) => (
                  <View key={`${f}-${i}`} style={styles.formatChip}>
                    <View style={styles.formatDot} />
                    <Text style={styles.formatText}>{humanizeFormat(f)}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.actions}>
              <TouchableOpacity style={styles.primary} onPress={openReader}>
                <Feather name="book-open" size={16} color="#ffffff" />
                <Text style={styles.primaryText}>Read online</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondary, favorite && styles.secondaryActive]}
                onPress={async () => {
                  const sid = String(bookId);
                  const ids = await getFavoriteIds();
                  const already = ids.includes(sid);
                  const next = already ? ids.filter((x) => x !== sid) : [...ids, sid];
                  await setFavoriteIds(next);
                  setFavorite(next.includes(sid));
                  try {
                    if (!already) {
                      await apiPost("/api/favourites/", { book_id: Number(bookId) }, accessToken || undefined);
                    } else {
                      await fetch(`${API_BASE}/api/favourites/${Number(bookId)}`, {
                        method: "DELETE",
                        headers: {
                          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
                        }
                      });
                    }
                  } catch {}
                }}
              >
                <Feather name="heart" size={16} color={favorite ? "#b91c1c" : "#6b7280"} />
                <Text style={styles.secondaryText}>{favorite ? "Remove favorite" : "Add favorite"}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.tabs}>
              {(["overview", "details", "reviews", "lists", "related"] as const).map((key) => (
                <TouchableOpacity
                  key={key}
                  onPress={() => setTab(key)}
                  style={[styles.tab, tab === key && styles.tabActive]}
                >
                  <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{key}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {tab === "overview" ? (
              <View style={styles.section}>
                <View style={styles.grid}>
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Publish Date</Text>
                    <Text style={styles.fieldValue}>{bookDetail.year || "-"}</Text>
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Publisher</Text>
                    <Text style={styles.fieldValue}>{bookDetail.pub_info || "-"}</Text>
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Language</Text>
                    <Text style={styles.fieldValue}>{bookDetail.lang || "-"}</Text>
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Formats</Text>
                    <Text style={styles.fieldValue}>{humanizeFormatList(bookDetail.formats)}</Text>
                  </View>
                </View>
                {bookDetail.summary ? <Text style={styles.summary}>{bookDetail.summary}</Text> : null}
              </View>
            ) : null}

            {tab === "details" ? (
              <View style={styles.section}>
                <Text style={styles.line}>
                  <Text style={styles.lineLabel}>ID: </Text>
                  {String(bookDetail.id)}
                </Text>
                <Text style={styles.line}>
                  <Text style={styles.lineLabel}>Title: </Text>
                  {bookDetail.title}
                </Text>
                <Text style={styles.line}>
                  <Text style={styles.lineLabel}>Year: </Text>
                  {bookDetail.year || "-"}
                </Text>
                <Text style={styles.line}>
                  <Text style={styles.lineLabel}>Language: </Text>
                  {bookDetail.lang || "-"}
                </Text>
                <Text style={styles.line}>
                  <Text style={styles.lineLabel}>Publisher: </Text>
                  {bookDetail.pub_info || "-"}
                </Text>
                <Text style={styles.line}>
                  <Text style={styles.lineLabel}>Formats: </Text>
                  {humanizeFormatList(bookDetail.formats)}
                </Text>
                <Text style={styles.line}>
                  <Text style={styles.lineLabel}>Authors: </Text>
                  {authorNames.join(", ") || "-"}
                </Text>
                <Text style={styles.line}>
                  <Text style={styles.lineLabel}>Subjects: </Text>
                  {subjectNames.join(", ") || "-"}
                </Text>
                <Text style={styles.line}>
                  <Text style={styles.lineLabel}>File ID: </Text>
                  {bookDetail.file_id || "-"}
                </Text>
                <Text style={styles.line}>
                  <Text style={styles.lineLabel}>Download URL: </Text>
                  {bookDetail.download_url || "-"}
                </Text>
              </View>
            ) : null}

            {tab === "reviews" ? (
              <View style={styles.section}>
                {reviews.length === 0 ? (
                  <Text style={styles.emptyText}>No reviews yet.</Text>
                ) : (
                  <View style={styles.reviewList}>
                    {reviews.map((r) => (
                      <View key={r.id} style={styles.reviewCard}>
                        <View style={styles.reviewHeader}>
                          <View style={styles.reviewStars}>
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Feather
                                key={String(i)}
                                name="star"
                                size={12}
                                color={i < r.rating ? "#f59e0b" : "#cbd5f5"}
                              />
                            ))}
                          </View>
                          <Text style={styles.reviewDate}>{new Date(r.created_at).toLocaleDateString()}</Text>
                        </View>
                        <Text style={styles.reviewText}>{r.text}</Text>
                        {r.author ? <Text style={styles.reviewAuthor}>- {r.author}</Text> : null}
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.reviewForm}>
                  <Text style={styles.reviewFormTitle}>Write a review</Text>
                  <View style={styles.reviewStarsRow}>
                    {Array.from({ length: 5 }).map((_, i) => {
                      const idx = i + 1;
                      const active = idx <= rating;
                      return (
                        <TouchableOpacity key={String(idx)} onPress={() => setRating(idx)} style={styles.starButton}>
                          <Feather name="star" size={18} color={active ? "#f59e0b" : "#cbd5f5"} />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <TextInput
                    value={reviewText}
                    onChangeText={setReviewText}
                    placeholder="Share your thoughts about this book"
                    placeholderTextColor="#9ca3af"
                    multiline
                    style={styles.reviewInput}
                  />
                  <TouchableOpacity
                    style={styles.reviewSubmit}
                    onPress={async () => {
                      if (!rating || !reviewText.trim()) return;
                      const next: Review = {
                        id: String(Date.now()),
                        rating,
                        text: reviewText.trim(),
                        author: "You",
                        created_at: new Date().toISOString()
                      };
                      setReviews((prev) => [next, ...prev]);
                      setRating(0);
                      setReviewText("");
                      try {
                        await apiPost(
                          "/api/reviews",
                          { rating: next.rating, comment: next.text, book_id: Number(bookId) },
                          accessToken || undefined
                        );
                      } catch {}
                    }}
                  >
                    <Text style={styles.reviewSubmitText}>Submit review</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {tab === "lists" ? (
              <View style={styles.section}>
                <Text style={styles.emptyText}>This book is not in any lists yet.</Text>
              </View>
            ) : null}

            {tab === "related" ? (
              <View style={styles.section}>
                <Text style={styles.emptyText}>Related books will appear here.</Text>
              </View>
            ) : null}
          </ScrollView>
        ) : null}
      </SafeAreaView>

      <Modal visible={readerOpen} onRequestClose={() => setReaderOpen(false)} animationType="slide">
        <SafeAreaView style={styles.readerRoot}>
          <View style={styles.readerHeader}>
            <TouchableOpacity onPress={() => setReaderOpen(false)} style={styles.readerBack}>
              <Feather name="chevron-left" size={22} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.readerTitle}>
              Reader{readerPageCount ? ` • ${readerPage}/${readerPageCount}` : ` • ${readerPage}`}
            </Text>
            <View style={styles.readerExternal} />
          </View>
          <TouchableOpacity style={styles.readerNotesFab} onPress={() => setNotesOpen(true)}>
            <Feather name="edit-3" size={18} color="#111827" />
          </TouchableOpacity>
          {readerLoading ? (
            <View style={styles.center}>
              <ActivityIndicator size="small" color="#7b0f2b" />
            </View>
          ) : readerError ? (
            <View style={styles.center}>
              <Text style={styles.errorText}>{readerError}</Text>
            </View>
          ) : readerHtml ? (
            <WebView
              originWhitelist={["*"]}
              source={{ html: readerHtml }}
              onMessage={(event) => {
                try {
                  const data = JSON.parse(event.nativeEvent.data);
                  if (data?.type === "page") {
                    const p = Number(data.page);
                    const t = Number(data.total);
                    if (!Number.isNaN(p) && p > 0) setReaderPage(p);
                    if (!Number.isNaN(t) && t > 0) setReaderPageCount(t);
                  }
                } catch {}
              }}
            />
          ) : (
            <View style={styles.center}>
              <Text style={styles.errorText}>No PDF available.</Text>
            </View>
          )}

          {notesOpen && (
            <View style={styles.notesOverlay}>
              <TouchableOpacity style={styles.notesBackdrop} onPress={() => setNotesOpen(false)} />
              <View style={styles.notesPanel}>
                <View style={styles.notesHeader}>
                  <Text style={styles.notesTitle}>Notes (page {readerPage})</Text>
                  <TouchableOpacity onPress={() => setNotesOpen(false)}>
                    <Feather name="x" size={18} color="#111827" />
                  </TouchableOpacity>
                </View>
                <TextInput
                  value={notesText}
                  onChangeText={setNotesText}
                  placeholder="Write your notes here (per page)"
                  placeholderTextColor="#9ca3af"
                  multiline
                  style={styles.notesInput}
                />
                <TouchableOpacity style={styles.notesSave} onPress={() => setNotesOpen(false)}>
                  <Text style={styles.notesSaveText}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#ffffff"
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb"
  },
  back: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center"
  },
  headerTitle: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 16,
    color: "#111827"
  },
  headerSpacer: {
    width: 32
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24
  },
  coverCard: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14
  },
  cover: {
    width: "100%",
    height: 220,
    borderRadius: 12,
    backgroundColor: "#f3f4f6"
  },
  coverPlaceholder: {
    width: "100%",
    height: 220,
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center"
  },
  title: {
    fontFamily: "Manrope_700Bold",
    fontSize: 18,
    color: "#111827"
  },
  meta: {
    fontFamily: "Manrope_400Regular",
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4
  },
  ratingRow: {
    marginTop: 10,
    gap: 6
  },
  stars: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  ratingText: {
    fontFamily: "Manrope_400Regular",
    fontSize: 11,
    color: "#6b7280",
    marginLeft: 6
  },
  counter: {
    fontFamily: "Manrope_400Regular",
    fontSize: 11,
    color: "#6b7280"
  },
  formats: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  formatChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  formatDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10b981"
  },
  formatText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 11,
    color: "#374151"
  },
  actions: {
    marginTop: 14,
    gap: 10
  },
  primary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#f97316",
    paddingVertical: 12,
    borderRadius: 14
  },
  primaryText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 13,
    color: "#ffffff"
  },
  secondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingVertical: 12,
    borderRadius: 14
  },
  secondaryActive: {
    borderColor: "#fca5a5",
    backgroundColor: "#fff1f2"
  },
  secondaryText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 12,
    color: "#374151"
  },
  tabs: {
    marginTop: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
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
    fontSize: 11,
    color: "#6b7280",
    textTransform: "capitalize"
  },
  tabTextActive: {
    color: "#7b0f2b"
  },
  section: {
    marginTop: 16
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  field: {
    width: "47%",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 10,
    backgroundColor: "#ffffff"
  },
  fieldLabel: {
    fontFamily: "Manrope_400Regular",
    fontSize: 10,
    color: "#9ca3af"
  },
  fieldValue: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 12,
    color: "#111827",
    marginTop: 4
  },
  summary: {
    marginTop: 12,
    fontFamily: "Manrope_400Regular",
    fontSize: 12,
    color: "#374151",
    lineHeight: 18
  },
  line: {
    fontFamily: "Manrope_400Regular",
    fontSize: 12,
    color: "#374151",
    marginBottom: 6
  },
  lineLabel: {
    color: "#9ca3af"
  },
  reviewList: {
    gap: 10
  },
  reviewCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#ffffff"
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  reviewStars: {
    flexDirection: "row",
    gap: 2
  },
  reviewDate: {
    fontFamily: "Manrope_400Regular",
    fontSize: 10,
    color: "#9ca3af"
  },
  reviewText: {
    fontFamily: "Manrope_400Regular",
    fontSize: 12,
    color: "#111827",
    marginTop: 6
  },
  reviewAuthor: {
    fontFamily: "Manrope_400Regular",
    fontSize: 10,
    color: "#6b7280",
    marginTop: 4
  },
  reviewForm: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#ffffff"
  },
  reviewFormTitle: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 13,
    color: "#111827",
    marginBottom: 8
  },
  reviewStarsRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 8
  },
  starButton: {
    padding: 2
  },
  reviewInput: {
    minHeight: 90,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontFamily: "Manrope_400Regular",
    fontSize: 12,
    color: "#111827"
  },
  reviewSubmit: {
    marginTop: 10,
    backgroundColor: "#7b0f2b",
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center"
  },
  reviewSubmitText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 12,
    color: "#ffffff"
  },
  emptyText: {
    fontFamily: "Manrope_400Regular",
    fontSize: 12,
    color: "#6b7280",
    marginTop: 8
  },
  errorText: {
    fontFamily: "Manrope_400Regular",
    fontSize: 12,
    color: "#b91c1c"
  },
  readerRoot: {
    flex: 1,
    backgroundColor: "#ffffff"
  },
  readerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb"
  },
  readerBack: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center"
  },
  readerTitle: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 16,
    color: "#111827"
  },
  readerExternal: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center"
  },
  readerNotesFab: {
    position: "absolute",
    right: 16,
    bottom: 24,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5
  },
  notesOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10
  },
  notesBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.35)"
  },
  notesPanel: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16
  },
  notesHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10
  },
  notesTitle: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 14,
    color: "#111827"
  },
  notesInput: {
    minHeight: 140,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontFamily: "Manrope_400Regular",
    fontSize: 12,
    color: "#111827"
  },
  notesSave: {
    marginTop: 12,
    backgroundColor: "#7b0f2b",
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center"
  },
  notesSaveText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 12,
    color: "#ffffff"
  }
});
