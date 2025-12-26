import React, { useEffect, useState } from "react";
import { useFonts, Manrope_400Regular, Manrope_600SemiBold, Manrope_700Bold } from "@expo-google-fonts/manrope";
import { apiPost } from "./src/lib/api";
import { clearTokens, loadTokens, persistTokens, TokenPair } from "./src/lib/storage";
import AppShell from "./src/screens/AppShell";
import AuthScreen from "./src/screens/AuthScreen";

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);

  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_600SemiBold,
    Manrope_700Bold
  });

  useEffect(() => {
    const init = async () => {
      try {
        const stored = await loadTokens();
        setAccessToken(stored.accessToken);
        setRefreshToken(stored.refreshToken);
        if (!stored.accessToken && stored.refreshToken) {
          await refreshAccessToken(stored.refreshToken);
        }
      } finally {
        setIsReady(true);
      }
    };
    init();
  }, []);

  const refreshAccessToken = async (rt?: string | null): Promise<string | null> => {
    const token = rt || refreshToken;
    if (!token) return null;
    try {
      const resp = await apiPost<TokenPair>("/api/auth/refresh", { token });
      const nextAccess = resp?.access_token || null;
      const nextRefresh = resp?.refresh_token || token;
      if (nextAccess) setAccessToken(nextAccess);
      setRefreshToken(nextRefresh);
      await persistTokens({ access_token: nextAccess || undefined, refresh_token: nextRefresh || undefined });
      return nextAccess;
    } catch {
      await clearTokens();
      setAccessToken(null);
      setRefreshToken(null);
      return null;
    }
  };

  const fetchWithAuth = async <T,>(path: string): Promise<T> => {
    const doFetch = async (token?: string | null) =>
      fetch(`https://api-library.tau-edu.kz${path}`, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });

    let res = await doFetch(accessToken);
    if (res.status === 401 && refreshToken) {
      const newToken = await refreshAccessToken(refreshToken);
      if (newToken) {
        res = await doFetch(newToken);
      }
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      let message = text || `HTTP ${res.status}`;
      try {
        const data = JSON.parse(text);
        message = data?.detail || data?.message || data?.error || message;
      } catch {}
      throw new Error(message);
    }
    return res.json();
  };

  const handleAuthSuccess = async (tokens: TokenPair) => {
    await persistTokens(tokens);
    setAccessToken(tokens?.access_token || null);
    setRefreshToken(tokens?.refresh_token || null);
  };

  const handleLogout = async () => {
    await clearTokens();
    setAccessToken(null);
    setRefreshToken(null);
  };

  if (!fontsLoaded || !isReady) {
    return null;
  }

  if (!accessToken) {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} />;
  }

  return <AppShell accessToken={accessToken} fetchWithAuth={fetchWithAuth} onLogout={handleLogout} />;
}
