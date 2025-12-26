import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Book } from "../types";
import { namesFrom } from "../lib/format";

type Props = {
  book: Book;
  onPress?: (book: Book) => void;
  showProgress?: number | null;
};

export default function BookCard({ book, onPress, showProgress }: Props) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress?.(book)}
      activeOpacity={0.8}
    >
      {book.cover ? (
        <Image source={{ uri: book.cover }} style={styles.cover} resizeMode="cover" />
      ) : (
        <View style={styles.coverPlaceholder}>
          <Feather name="book-open" size={18} color="#c1c4cb" />
        </View>
      )}
      <Text numberOfLines={1} style={styles.title}>
        {book.title}
      </Text>
      {namesFrom(book.authors).length ? (
        <Text numberOfLines={1} style={styles.author}>
          {namesFrom(book.authors).join(", ")}
        </Text>
      ) : null}
      {typeof showProgress === "number" ? (
        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${showProgress}%` }]} />
          </View>
          <Text style={styles.progressText}>{showProgress}%</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "47%",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    padding: 10
  },
  cover: {
    width: "100%",
    height: 120,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: "#f3f4f6"
  },
  coverPlaceholder: {
    width: "100%",
    height: 120,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center"
  },
  title: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 12,
    color: "#111827"
  },
  author: {
    fontFamily: "Manrope_400Regular",
    fontSize: 11,
    color: "#6b7280",
    marginTop: 2
  },
  progressWrap: {
    marginTop: 8
  },
  progressTrack: {
    height: 4,
    backgroundColor: "#e5e7eb",
    borderRadius: 999
  },
  progressFill: {
    height: 4,
    backgroundColor: "#10b981",
    borderRadius: 999
  },
  progressText: {
    fontFamily: "Manrope_400Regular",
    fontSize: 10,
    color: "#6b7280",
    marginTop: 4
  }
});
