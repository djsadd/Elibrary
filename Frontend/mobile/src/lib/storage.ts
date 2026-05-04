import AsyncStorage from "@react-native-async-storage/async-storage";

export type TokenPair = {
  access_token?: string;
  refresh_token?: string;
  accessToken?: string | null;
  refreshToken?: string | null;
};

const ACCESS_TOKEN_KEY = "elib.accessToken";
const REFRESH_TOKEN_KEY = "elib.refreshToken";
const FAVORITE_IDS_KEY = "elib.favoriteIds";

const normalizeToken = (value?: string | null): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

export async function persistTokens(tokens: TokenPair): Promise<void> {
  const accessToken = normalizeToken(tokens.access_token ?? tokens.accessToken);
  const refreshToken = normalizeToken(tokens.refresh_token ?? tokens.refreshToken);

  if (accessToken) {
    await AsyncStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  } else {
    await AsyncStorage.removeItem(ACCESS_TOKEN_KEY);
  }

  if (refreshToken) {
    await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  } else {
    await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}

export async function loadTokens(): Promise<{ accessToken: string | null; refreshToken: string | null }> {
  const [accessToken, refreshToken] = await Promise.all([
    AsyncStorage.getItem(ACCESS_TOKEN_KEY),
    AsyncStorage.getItem(REFRESH_TOKEN_KEY)
  ]);

  return {
    accessToken: normalizeToken(accessToken),
    refreshToken: normalizeToken(refreshToken)
  };
}

export async function clearTokens(): Promise<void> {
  await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
}

export async function getFavoriteIds(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(FAVORITE_IDS_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch {
    return [];
  }
}

export async function setFavoriteIds(ids: Array<string | number>): Promise<void> {
  const uniqueIds = Array.from(new Set(ids.map((item) => String(item))));
  await AsyncStorage.setItem(FAVORITE_IDS_KEY, JSON.stringify(uniqueIds));
}
