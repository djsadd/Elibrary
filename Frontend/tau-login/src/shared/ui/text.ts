export function namesFrom(arr: any): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x: any) => (typeof x === 'string' ? x : x?.name ?? ''))
    .filter(Boolean);
}

export function joinNames(arr: any, sep = ', '): string {
  return namesFrom(arr).join(sep);
}

