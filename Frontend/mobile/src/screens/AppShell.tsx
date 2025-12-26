import React, { useState } from "react";
import { SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { Book } from "../types";
import BookDetailModal from "../components/BookDetailModal";
import HomeScreen from "./HomeScreen";
import CatalogScreen from "./CatalogScreen";
import ShelfScreen from "./ShelfScreen";
import FavoritesScreen from "./FavoritesScreen";
import SearchScreen from "./SearchScreen";
import ProfileScreen from "./ProfileScreen";

type Props = {
  accessToken: string | null;
  fetchWithAuth: <T,>(path: string) => Promise<T>;
  onLogout: () => void;
};

export default function AppShell({ accessToken, fetchWithAuth, onLogout }: Props) {
  const [activeTab, setActiveTab] = useState("Home");
  const [selectedBookId, setSelectedBookId] = useState<string | number | null>(null);

  const tabs = [
    { key: "Home", icon: "home" },
    { key: "Catalog", icon: "book-open" },
    { key: "Shelf", icon: "layers" },
    { key: "Favorites", icon: "heart" },
    { key: "Search", icon: "search" },
    { key: "Profile", icon: "user" }
  ] as const;

  const handleBookPress = (book: Book) => {
    setSelectedBookId(book.id);
  };

  const renderContent = () => {
    if (activeTab === "Home") {
      return <HomeScreen fetchWithAuth={fetchWithAuth} onBookPress={handleBookPress} />;
    }
    if (activeTab === "Catalog") {
      return <CatalogScreen fetchWithAuth={fetchWithAuth} onBookPress={handleBookPress} />;
    }
    if (activeTab === "Shelf") {
      return <ShelfScreen fetchWithAuth={fetchWithAuth} onBookPress={handleBookPress} />;
    }
    if (activeTab === "Favorites") {
      return <FavoritesScreen fetchWithAuth={fetchWithAuth} onBookPress={handleBookPress} />;
    }
    if (activeTab === "Search") {
      return <SearchScreen accessToken={accessToken} fetchWithAuth={fetchWithAuth} onBookPress={handleBookPress} />;
    }
    if (activeTab === "Profile") {
      return <ProfileScreen onLogout={onLogout} />;
    }
    return <Text style={styles.placeholder}>Section: {activeTab}</Text>;
  };

  return (
    <View style={styles.root}>
      <BookDetailModal
        visible={Boolean(selectedBookId)}
        bookId={selectedBookId}
        accessToken={accessToken}
        fetchWithAuth={fetchWithAuth}
        onClose={() => setSelectedBookId(null)}
      />
      <StatusBar barStyle="dark-content" />
      <LinearGradient colors={["#ffffff", "#ffffff", "#ffffff"]} style={styles.gradient} />
      <SafeAreaView style={styles.safe}>
        <View style={styles.appShell}>
          <View style={styles.appHeader}>
            <Text style={styles.appTitle}>{activeTab}</Text>
          </View>
          <View style={styles.appBody}>{renderContent()}</View>
        </View>
      </SafeAreaView>
      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            style={[styles.tabItem, activeTab === tab.key && styles.tabItemActive]}
          >
            <View style={[styles.tabIcon, activeTab === tab.key && styles.tabIconActive]}>
              <Feather name={tab.icon} size={22} color={activeTab === tab.key ? "#7b0f2b" : "#9ca3af"} />
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#ffffff"
  },
  gradient: {
    ...StyleSheet.absoluteFillObject
  },
  safe: {
    flex: 1
  },
  appShell: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24
  },
  appHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16
  },
  appTitle: {
    fontFamily: "Manrope_700Bold",
    fontSize: 20,
    color: "#111827"
  },
  appBody: {
    flex: 1,
    paddingTop: 8
  },
  placeholder: {
    fontFamily: "Manrope_400Regular",
    fontSize: 14,
    color: "#111827"
  },
  tabBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8
  },
  tabItemActive: {
    backgroundColor: "transparent"
  },
  tabIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(123, 15, 43, 0.08)"
  },
  tabIconActive: {
    backgroundColor: "#ffffff"
  }
});
