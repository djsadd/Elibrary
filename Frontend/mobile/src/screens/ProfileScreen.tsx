import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Props = {
  onLogout: () => void;
};

export default function ProfileScreen({ onLogout }: Props) {
  return (
    <View style={styles.content}>
      <Text style={styles.title}>Profile</Text>
      <TouchableOpacity onPress={onLogout} style={styles.logoutButton}>
        <Text style={styles.logoutText}>Log out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 16
  },
  title: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 14,
    color: "#111827"
  },
  logoutButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16
  },
  logoutText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 13,
    color: "#111827"
  }
});
