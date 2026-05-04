const extractName = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const candidates = [record.name, record.title, record.full_name, record.label];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
    }
  }

  return null;
};

export const namesFrom = (items?: unknown[] | string[] | null): string[] => {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => extractName(item))
    .filter((item): item is string => Boolean(item));
};

export const humanizeFormat = (value?: string | null): string => {
  if (!value) {
    return "Unknown";
  }

  const normalized = value.replace(/[_-]+/g, " ").trim();
  if (!normalized) {
    return "Unknown";
  }

  return normalized
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
};

export const humanizeFormatList = (value?: string[] | string | null): string => {
  if (Array.isArray(value)) {
    const items = value.map((item) => humanizeFormat(item)).filter(Boolean);
    return items.length ? items.join(", ") : "-";
  }

  if (typeof value === "string") {
    return humanizeFormat(value);
  }

  return "-";
};
