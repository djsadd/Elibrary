import { getLang } from '@/shared/i18n';

export function namesFrom(arr: any): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x: any) => (typeof x === 'string' ? x : x?.name ?? ''))
    .filter(Boolean);
}

export function joinNames(arr: any, sep = ', '): string {
  return namesFrom(arr).join(sep);
}


/** Name of an author/subject in the current UI language (name_ru / name_kk / name_en), falling back to `name`. */
export function localizedName(x: any): string {
  if (typeof x === 'string') return x;
  if (!x) return '';
  const lang = getLang();
  const own = x[`name_${lang}`];
  if (typeof own === 'string' && own.trim()) return own.trim();
  return x.name ?? x.name_ru ?? x.name_kk ?? x.name_en ?? '';
}

/** Like namesFrom, but localized — use only for display, never for saving. */
export function displayNamesFrom(arr: any): string[] {
  if (!Array.isArray(arr)) return [];
  return arr.map(localizedName).filter(Boolean);
}
