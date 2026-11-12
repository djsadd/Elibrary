/** Dependency-free SVG chart kit for the analytics pages. Colours and formatters live in chartUtils.ts. */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { CHART, fmtInt, fmtNum, niceMax, seqColor } from "./chartUtils";

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(([entry]) => setW(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/* ------------------------------------------------------------------ */
/* Tooltip                                                             */
/* ------------------------------------------------------------------ */

type Tip = { x: number; y: number; content: ReactNode } | null;

function useTooltip(container: React.RefObject<HTMLElement | null>) {
  const [tip, setTip] = useState<Tip>(null);
  const show = (e: { clientX: number; clientY: number }, content: ReactNode) => {
    const box = container.current?.getBoundingClientRect();
    if (!box) return;
    setTip({ x: e.clientX - box.left, y: e.clientY - box.top, content });
  };
  const hide = () => setTip(null);
  const layer = tip ? (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-20 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 shadow-lg whitespace-nowrap"
      style={{
        left: tip.x,
        top: tip.y,
        transform: `translate(${tip.x > (container.current?.clientWidth ?? 0) / 2 ? "calc(-100% - 12px)" : "12px"}, -110%)`,
      }}
    >
      {tip.content}
    </div>
  ) : null;
  return { show, hide, layer };
}

/* ------------------------------------------------------------------ */
/* Layout pieces                                                       */
/* ------------------------------------------------------------------ */

export function ChartCard({
  title,
  subtitle,
  actions,
  children,
  className = "",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {actions}
      </header>
      {children}
    </section>
  );
}

export function EmptyChart({ text, height = 120 }: { text: string; height?: number }) {
  return (
    <div className="flex items-center justify-center rounded-lg bg-slate-50 text-sm text-slate-500" style={{ minHeight: height }}>
      {text}
    </div>
  );
}

export function KpiTile({
  label,
  value,
  delta,
  goodWhen = "up",
  hint,
  accent = false,
}: {
  label: ReactNode;
  value: ReactNode;
  /** percentage change vs previous period; null = no comparison */
  delta?: number | null;
  goodWhen?: "up" | "down";
  hint?: ReactNode;
  accent?: boolean;
}) {
  let deltaEl: ReactNode = null;
  if (delta !== undefined && delta !== null && Number.isFinite(delta)) {
    const up = delta > 0;
    const flat = Math.abs(delta) < 0.5;
    const good = flat ? null : (up ? goodWhen === "up" : goodWhen === "down");
    deltaEl = (
      <span
        className={`inline-flex items-center gap-0.5 text-xs font-medium ${
          good === null ? "text-slate-500" : good ? "text-emerald-700" : "text-red-700"
        }`}
      >
        <span aria-hidden>{flat ? "→" : up ? "▲" : "▼"}</span>
        {flat ? "0%" : `${up ? "+" : ""}${fmtNum(delta, Math.abs(delta) < 10 ? 1 : 0)}%`}
      </span>
    );
  }
  return (
    <div
      className={`rounded-xl border p-4 shadow-sm ${
        accent ? "border-transparent bg-[#800020] text-white" : "border-slate-200 bg-white"
      }`}
    >
      <div className={`text-xs ${accent ? "text-white/80" : "text-slate-500"}`}>{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <div className={`text-2xl font-semibold tabular-nums ${accent ? "text-white" : "text-slate-900"}`}>{value}</div>
        {deltaEl}
      </div>
      {hint && <div className={`mt-1 text-xs ${accent ? "text-white/80" : "text-slate-500"}`}>{hint}</div>}
    </div>
  );
}

export function SegmentedControl<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label?: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
            o.value === value ? "bg-[#800020] text-white" : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Trend (line / area)                                                 */
/* ------------------------------------------------------------------ */

export type TrendSeries = { key: string; label: string; color?: string };

export function TrendChart({
  data,
  xKey,
  series,
  height = 220,
  format = fmtInt,
  formatX = (x: string) => x,
  formatAxis,
  emptyText = "—",
}: {
  data: Record<string, string | number>[];
  xKey: string;
  series: TrendSeries[];
  height?: number;
  format?: (n: number) => string;
  formatX?: (x: string) => string;
  /** compact formatter for y-axis ticks (defaults to format) */
  formatAxis?: (n: number) => string;
  emptyText?: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const { show, hide, layer } = useTooltip(ref);
  const [hover, setHover] = useState<number | null>(null);
  const colors = series.map((s, i) => s.color || (i === 0 ? CHART.s1 : CHART.s2));
  const max = niceMax(Math.max(0, ...data.flatMap((d) => series.map((s) => Number(d[s.key]) || 0))));
  const total = data.reduce((acc, d) => acc + series.reduce((a, s) => a + (Number(d[s.key]) || 0), 0), 0);

  const pad = { l: 40, r: 12, t: 8, b: 24 };
  const iw = Math.max(0, width - pad.l - pad.r);
  const ih = height - pad.t - pad.b;
  const n = data.length;
  const x = (i: number) => pad.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => pad.t + ih - (v / max) * ih;

  const paths = series.map((s) => {
    const pts = data.map((d, i) => [x(i), y(Number(d[s.key]) || 0)] as const);
    const line = pts.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join("");
    const area = pts.length ? `${line}L${pts[pts.length - 1][0].toFixed(1)},${pad.t + ih}L${pts[0][0].toFixed(1)},${pad.t + ih}Z` : "";
    return { line, area };
  });

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const xLabelIdx = n <= 1 ? [0] : Array.from(new Set([0, Math.round((n - 1) / 3), Math.round((2 * (n - 1)) / 3), n - 1]));

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    if (!n) return;
    const box = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const rel = e.clientX - box.left - pad.l;
    const i = Math.max(0, Math.min(n - 1, Math.round(n <= 1 ? 0 : (rel / iw) * (n - 1))));
    setHover(i);
    const d = data[i];
    show(
      e,
      <div>
        <div className="mb-0.5 font-medium text-slate-900">{formatX(String(d[xKey]))}</div>
        {series.map((s, si) => (
          <div key={s.key} className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: colors[si] }} />
            <span className="text-slate-500">{s.label}</span>
            <span className="ml-auto pl-3 font-medium tabular-nums text-slate-900">{format(Number(d[s.key]) || 0)}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div>
      {series.length > 1 && (
        <div className="mb-2 flex flex-wrap gap-4 text-xs text-slate-600">
          {series.map((s, i) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 rounded" style={{ background: colors[i] }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
      <div ref={ref} className="relative w-full">
        {total === 0 ? (
          <EmptyChart text={emptyText} height={height} />
        ) : (
          width > 0 && (
            <svg width={width} height={height} role="img" aria-label={series.map((s) => s.label).join(", ")}>
              {ticks.map((tv) => (
                <g key={tv}>
                  <line x1={pad.l} x2={pad.l + iw} y1={y(tv)} y2={y(tv)} stroke={CHART.grid} strokeWidth={1} />
                  <text x={pad.l - 6} y={y(tv)} dy="0.32em" textAnchor="end" fontSize={10} fill={CHART.axis}>
                    {(formatAxis ?? format)(tv)}
                  </text>
                </g>
              ))}
              {xLabelIdx.map((i) => (
                <text
                  key={i}
                  x={x(i)}
                  y={height - 6}
                  textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
                  fontSize={10}
                  fill={CHART.axis}
                >
                  {formatX(String(data[i]?.[xKey] ?? ""))}
                </text>
              ))}
              {paths.map((p, i) => (
                <g key={series[i].key}>
                  {i === 0 && <path d={p.area} fill={colors[i]} opacity={0.1} />}
                  <path d={p.line} fill="none" stroke={colors[i]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                </g>
              ))}
              {hover !== null && data[hover] && (
                <g pointerEvents="none">
                  <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} stroke={CHART.axis} strokeDasharray="3 3" />
                  {series.map((s, i) => (
                    <circle
                      key={s.key}
                      cx={x(hover)}
                      cy={y(Number(data[hover][s.key]) || 0)}
                      r={4.5}
                      fill={colors[i]}
                      stroke="#fff"
                      strokeWidth={2}
                    />
                  ))}
                </g>
              )}
              <rect
                x={pad.l}
                y={pad.t}
                width={iw}
                height={ih}
                fill="transparent"
                onMouseMove={onMove}
                onMouseLeave={() => {
                  setHover(null);
                  hide();
                }}
              />
            </svg>
          )
        )}
        {layer}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Columns                                                             */
/* ------------------------------------------------------------------ */

export function ColumnChart({
  data,
  height = 160,
  format = fmtInt,
  color = CHART.s1,
  highlight,
  emptyText = "—",
  labelEvery,
}: {
  data: { label: string; value: number; tip?: string }[];
  height?: number;
  format?: (n: number) => string;
  color?: string;
  /** index to emphasise (e.g. the current period); others are drawn lighter */
  highlight?: number | null;
  emptyText?: string;
  labelEvery?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const { show, hide, layer } = useTooltip(ref);
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const total = data.reduce((a, d) => a + d.value, 0);
  const pad = { l: 4, r: 4, t: 16, b: 20 };
  const iw = Math.max(0, width - pad.l - pad.r);
  const ih = height - pad.t - pad.b;
  const n = data.length;
  const slot = n ? iw / n : 0;
  const gap = Math.max(2, Math.min(8, slot * 0.25));
  const bw = Math.max(2, slot - gap);
  const every = labelEvery ?? (n > 16 ? Math.ceil(n / 8) : 1);
  const maxIdx = data.reduce((best, d, i) => (d.value > (data[best]?.value ?? -1) ? i : best), 0);

  return (
    <div ref={ref} className="relative w-full">
      {total === 0 ? (
        <EmptyChart text={emptyText} height={height} />
      ) : (
        width > 0 && (
          <svg width={width} height={height} role="img">
            <line x1={pad.l} x2={pad.l + iw} y1={pad.t + ih} y2={pad.t + ih} stroke={CHART.grid} />
            {data.map((d, i) => {
              const h = (d.value / max) * ih;
              const bx = pad.l + i * slot + gap / 2;
              const by = pad.t + ih - h;
              const r = Math.min(4, bw / 2, h);
              const dim = highlight !== undefined && highlight !== null ? i !== highlight : false;
              return (
                <g key={i}>
                  {h > 0 && (
                    <path
                      d={`M${bx},${pad.t + ih}V${by + r}Q${bx},${by} ${bx + r},${by}H${bx + bw - r}Q${bx + bw},${by} ${bx + bw},${by + r}V${pad.t + ih}Z`}
                      fill={color}
                      opacity={hover === i ? 1 : dim ? 0.45 : 0.9}
                    />
                  )}
                  {i === maxIdx && d.value > 0 && n <= 31 && (
                    <text x={bx + bw / 2} y={by - 4} textAnchor="middle" fontSize={10} fontWeight={600} fill="#334155">
                      {format(d.value)}
                    </text>
                  )}
                  {i % every === 0 && (
                    <text x={bx + bw / 2} y={height - 5} textAnchor="middle" fontSize={10} fill={CHART.axis}>
                      {d.label}
                    </text>
                  )}
                  <rect
                    x={pad.l + i * slot}
                    y={pad.t}
                    width={slot}
                    height={ih}
                    fill="transparent"
                    onMouseMove={(e) => {
                      setHover(i);
                      show(
                        e,
                        <span>
                          <span className="text-slate-500">{d.tip ?? d.label}: </span>
                          <span className="font-medium tabular-nums text-slate-900">{format(d.value)}</span>
                        </span>
                      );
                    }}
                    onMouseLeave={() => {
                      setHover(null);
                      hide();
                    }}
                  />
                </g>
              );
            })}
          </svg>
        )
      )}
      {layer}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ranked horizontal bars                                              */
/* ------------------------------------------------------------------ */

export type RankedItem = { key: string | number; label: ReactNode; value: number; sub?: ReactNode; href?: string };

export function RankedBars({
  items,
  format = fmtInt,
  color = CHART.s1,
  emptyText = "—",
  max,
}: {
  items: RankedItem[];
  format?: (n: number) => string;
  color?: string;
  emptyText?: string;
  max?: number;
}) {
  if (!items.length) return <EmptyChart text={emptyText} height={80} />;
  const top = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <ol className="space-y-2.5">
      {items.map((it, idx) => {
        const label = it.href ? (
          <Link to={it.href} className="truncate text-slate-800 hover:text-[#b51e3e] hover:underline">
            {it.label}
          </Link>
        ) : (
          <span className="truncate text-slate-800">{it.label}</span>
        );
        return (
          <li key={it.key}>
            <div className="flex items-baseline gap-2 text-sm">
              <span className="w-5 shrink-0 text-xs tabular-nums text-slate-400">{idx + 1}</span>
              <div className="min-w-0 flex-1 truncate">{label}</div>
              <span className="shrink-0 font-medium tabular-nums text-slate-900">{format(it.value)}</span>
            </div>
            <div className="ml-7 mt-1 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full" style={{ width: `${Math.max(2, (it.value / top) * 100)}%`, background: color }} />
              </div>
              {it.sub && <span className="shrink-0 text-[11px] text-slate-500">{it.sub}</span>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/* Share bar (composition)                                             */
/* ------------------------------------------------------------------ */

export function ShareBar({
  items,
  otherLabel = "Other",
  emptyText = "—",
  labelFor = (k: string) => k,
}: {
  items: { key: string; count: number }[];
  otherLabel?: string;
  emptyText?: string;
  labelFor?: (k: string) => string;
}) {
  const sorted = [...items].filter((i) => i.count > 0).sort((a, b) => b.count - a.count);
  const total = sorted.reduce((a, i) => a + i.count, 0);
  if (!total) return <EmptyChart text={emptyText} height={60} />;
  const head = sorted.slice(0, CHART.categorical.length);
  const rest = sorted.slice(CHART.categorical.length).reduce((a, i) => a + i.count, 0);
  const segs = [
    ...head.map((h, i) => ({ label: labelFor(h.key), count: h.count, color: CHART.categorical[i] })),
    ...(rest ? [{ label: otherLabel, count: rest, color: CHART.other }] : []),
  ];
  return (
    <div>
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full" role="img">
        {segs.map((s) => (
          <div key={s.label} title={`${s.label}: ${fmtInt(s.count)}`} style={{ width: `${(s.count / total) * 100}%`, background: s.color }} />
        ))}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        {segs.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
            <span className="truncate text-slate-700">{s.label}</span>
            <span className="ml-auto tabular-nums text-slate-900">{fmtNum((s.count / total) * 100, 0)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Calendar heatmap (GitHub-style)                                     */
/* ------------------------------------------------------------------ */

export function CalendarHeatmap({
  days,
  format = fmtInt,
  weekdayLabels,
  monthLabels,
  lessLabel = "Less",
  moreLabel = "More",
  formatDay = (d: string) => d,
}: {
  days: { day: string; value: number }[];
  format?: (n: number) => string;
  /** Mon..Sun */
  weekdayLabels: string[];
  monthLabels: string[];
  lessLabel?: string;
  moreLabel?: string;
  formatDay?: (d: string) => string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { show, hide, layer } = useTooltip(wrapRef);
  const cell = 12;
  const gap = 3;
  const step = cell + gap;

  const { weeks, max, months } = useMemo(() => {
    const out: ({ day: string; value: number } | null)[][] = [];
    let week: ({ day: string; value: number } | null)[] = [];
    if (days.length) {
      const first = new Date(days[0].day + "T00:00:00");
      const lead = (first.getDay() + 6) % 7; // Monday-based
      for (let i = 0; i < lead; i++) week.push(null);
    }
    for (const d of days) {
      week.push(d);
      if (week.length === 7) {
        out.push(week);
        week = [];
      }
    }
    if (week.length) out.push(week);
    const monthMarks: { col: number; label: string }[] = [];
    let lastMonth = -1;
    out.forEach((w, col) => {
      const firstReal = w.find(Boolean);
      if (!firstReal) return;
      const m = new Date(firstReal.day + "T00:00:00").getMonth();
      if (m !== lastMonth) {
        if (col > 0 || out.length < 5) monthMarks.push({ col, label: monthLabels[m] });
        lastMonth = m;
      }
    });
    return { weeks: out, max: Math.max(0, ...days.map((d) => d.value)), months: monthMarks };
  }, [days, monthLabels]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [weeks.length]);

  const left = 28;
  const top = 16;
  const width = left + weeks.length * step;
  const height = top + 7 * step;
  const level = (v: number) => (max > 0 ? Math.ceil((v / max) * 4) / 4 : 0);

  return (
    <div ref={wrapRef} className="relative">
      <div ref={scrollRef} className="overflow-x-auto pb-1">
        <svg width={width} height={height} role="img">
          {months.map((m) => (
            <text key={`${m.col}-${m.label}`} x={left + m.col * step} y={10} fontSize={10} fill={CHART.axis}>
              {m.label}
            </text>
          ))}
          {[0, 2, 4].map((r) => (
            <text key={r} x={0} y={top + r * step + cell - 2} fontSize={9} fill={CHART.axis}>
              {weekdayLabels[r]}
            </text>
          ))}
          {weeks.map((w, col) =>
            w.map((d, row) =>
              d ? (
                <rect
                  key={d.day}
                  x={left + col * step}
                  y={top + row * step}
                  width={cell}
                  height={cell}
                  rx={2.5}
                  fill={seqColor(level(d.value))}
                  onMouseMove={(e) =>
                    show(
                      e,
                      <span>
                        <span className="font-medium text-slate-900">{format(d.value)}</span>
                        <span className="text-slate-500"> · {formatDay(d.day)}</span>
                      </span>
                    )
                  }
                  onMouseLeave={hide}
                />
              ) : null
            )
          )}
        </svg>
      </div>
      <div className="mt-2 flex items-center justify-end gap-1.5 text-[11px] text-slate-500">
        <span>{lessLabel}</span>
        {[0, 0.25, 0.5, 0.75, 1].map((lv) => (
          <span key={lv} className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: seqColor(lv) }} />
        ))}
        <span>{moreLabel}</span>
      </div>
      {layer}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Weekday x hour matrix                                               */
/* ------------------------------------------------------------------ */

export function MatrixHeatmap({
  matrix,
  rowLabels,
  format = fmtInt,
  unit = "",
}: {
  matrix: number[][];
  rowLabels: string[];
  format?: (n: number) => string;
  unit?: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const { show, hide, layer } = useTooltip(ref);
  const max = Math.max(0, ...matrix.flat());
  const left = 30;
  const top = 2;
  const bottom = 16;
  const cols = 24;
  const step = Math.max(8, (width - left) / cols);
  const cell = step - 2;
  const height = top + matrix.length * step + bottom;
  return (
    <div ref={ref} className="relative w-full">
      {width > 0 && (
        <svg width={width} height={height} role="img">
          {matrix.map((row, r) => (
            <g key={r}>
              <text x={0} y={top + r * step + cell / 2} dy="0.32em" fontSize={10} fill={CHART.axis}>
                {rowLabels[r]}
              </text>
              {row.map((v, h) => (
                <rect
                  key={h}
                  x={left + h * step}
                  y={top + r * step}
                  width={cell}
                  height={cell}
                  rx={2}
                  fill={seqColor(max ? v / max : 0)}
                  onMouseMove={(e) =>
                    show(
                      e,
                      <span>
                        <span className="text-slate-500">
                          {rowLabels[r]} {String(h).padStart(2, "0")}:00–{String((h + 1) % 24).padStart(2, "0")}:00 ·{" "}
                        </span>
                        <span className="font-medium tabular-nums text-slate-900">
                          {format(v)} {unit}
                        </span>
                      </span>
                    )
                  }
                  onMouseLeave={hide}
                />
              ))}
            </g>
          ))}
          {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => (
            <text key={h} x={left + h * step} y={height - 4} fontSize={10} fill={CHART.axis}>
              {String(h).padStart(2, "0")}
            </text>
          ))}
        </svg>
      )}
      {layer}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Funnel                                                              */
/* ------------------------------------------------------------------ */

export function Funnel({ steps, emptyText = "—" }: { steps: { label: string; value: number }[]; emptyText?: string }) {
  const first = steps[0]?.value || 0;
  if (!first) return <EmptyChart text={emptyText} height={120} />;
  return (
    <ol className="space-y-2">
      {steps.map((s, i) => {
        const pct = (s.value / first) * 100;
        const prev = i > 0 ? steps[i - 1].value : null;
        const stepConv = prev ? (s.value / prev) * 100 : null;
        return (
          <li key={s.label}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
              <span className="text-slate-700">{s.label}</span>
              <span className="tabular-nums text-slate-900">
                <span className="font-semibold">{fmtInt(s.value)}</span>
                <span className="text-slate-500"> · {fmtNum(pct, 0)}%</span>
                {stepConv !== null && <span className="text-slate-400"> (→ {fmtNum(stepConv, 0)}%)</span>}
              </span>
            </div>
            <div className="h-5 w-full rounded-md bg-slate-100">
              <div
                className="h-full rounded-md"
                style={{ width: `${Math.max(1.5, pct)}%`, background: seqColor(0.35 + (0.65 * i) / Math.max(1, steps.length - 1)) }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/* Retention cohorts                                                   */
/* ------------------------------------------------------------------ */

export function CohortGrid({
  cohorts,
  cohortLabel,
  sizeLabel,
  weekLabel,
  formatCohort = (c: string) => c,
  emptyText = "—",
}: {
  cohorts: { cohort: string; size: number; retention: number[] }[];
  cohortLabel: string;
  sizeLabel: string;
  weekLabel: (n: number) => string;
  formatCohort?: (c: string) => string;
  emptyText?: string;
}) {
  if (!cohorts.length) return <EmptyChart text={emptyText} height={120} />;
  const weeks = Math.max(...cohorts.map((c) => c.retention.length));
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate text-xs" style={{ borderSpacing: 2 }}>
        <thead>
          <tr className="text-slate-500">
            <th className="px-2 py-1 text-left font-medium">{cohortLabel}</th>
            <th className="px-2 py-1 text-right font-medium">{sizeLabel}</th>
            {Array.from({ length: weeks }, (_, i) => (
              <th key={i} className="px-2 py-1 text-center font-medium">
                {weekLabel(i)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohorts.map((c) => (
            <tr key={c.cohort}>
              <td className="whitespace-nowrap px-2 py-1 text-slate-700">{formatCohort(c.cohort)}</td>
              <td className="px-2 py-1 text-right tabular-nums text-slate-900">{fmtInt(c.size)}</td>
              {Array.from({ length: weeks }, (_, i) => {
                const v = c.retention[i];
                if (v === undefined) return <td key={i} />;
                return (
                  <td
                    key={i}
                    className="rounded px-2 py-1 text-center tabular-nums"
                    style={{ background: seqColor(v / 100), color: v > 55 ? "#fff" : "#1f2937" }}
                  >
                    {fmtNum(v, 0)}%
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Progress meter                                                      */
/* ------------------------------------------------------------------ */

export function Meter({ value, color = CHART.s1 }: { value: number; color?: string }) {
  const v = Math.max(0, Math.min(100, value || 0));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100" role="meter" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full" style={{ width: `${v}%`, background: color }} />
    </div>
  );
}
