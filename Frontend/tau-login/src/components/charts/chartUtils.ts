/**
 * Colour roles and formatters for the chart kit (validated with the dataviz palette checker, light surface):
 *  - series 1 = brand rose #b51e3e, series 2 = blue #2a78d6 (CVD-safe pair)
 *  - sequential = one rose hue, light -> dark
 *  - categorical shares = fixed-order slots, always shown with labels + values
 */
export const CHART = {
  s1: "#b51e3e",
  s2: "#2a78d6",
  grid: "#ecebe8",
  axis: "#8a8984",
  empty: "#f0efec",
  categorical: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"],
  other: "#a8a7a2",
};

const SEQ_FROM = [0xf7, 0xe1, 0xe6];
const SEQ_TO = [0x6b, 0x0f, 0x24];

/** Sequential rose ramp, t in [0, 1]. Zero values get the neutral empty colour. */
export function seqColor(t: number): string {
  if (!(t > 0)) return CHART.empty;
  const k = Math.min(1, 0.12 + 0.88 * t);
  const c = SEQ_FROM.map((from, i) => Math.round(from + (SEQ_TO[i] - from) * k));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export const fmtInt = (n: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n || 0);
export const fmtNum = (n: number, digits = 1) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(n || 0);

export function niceMax(v: number): number {
  if (v <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * exp;
}

/** Percentage change; null when there is no baseline to compare with. */
export function pctDelta(cur: number, prev: number): number | null {
  if (!prev) return cur ? null : 0;
  return ((cur - prev) / prev) * 100;
}
