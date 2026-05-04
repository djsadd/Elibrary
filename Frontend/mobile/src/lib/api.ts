import { API_BASE } from "./constants";

const buildErrorMessage = async (response: Response): Promise<string> => {
  const text = await response.text().catch(() => "");
  if (!text) {
    return `HTTP ${response.status}`;
  }

  try {
    const data = JSON.parse(text);
    return data?.detail || data?.message || data?.error || text;
  } catch {
    return text;
  }
};

export async function apiPost<T = unknown>(
  path: string,
  body?: unknown,
  accessToken?: string
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
    },
    body: body == null ? undefined : JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(await buildErrorMessage(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
