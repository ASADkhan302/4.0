import React, { useEffect, useId, useMemo, useRef, useState } from 'react';

/* ============================================================================
   1. ANIMATED NUMERIC COUNTER (650ms easeOutCubic · Reduced-Motion Safe)
   ============================================================================ */

export interface AnimatedCounterProps {
  value: number;
  format?: 'number' | 'percent';
  decimals?: number;
  suffix?: string;
  durationMs?: number;
  className?: string;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  format = 'number',
  decimals = 0,
  suffix = '',
  durationMs = 650,
  className = '',
}) => {
  const safeTarget = Number.isFinite(value) ? value : 0;
  const [display, setDisplay] = useState<number>(safeTarget);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setDisplay(safeTarget);
      return;
    }

    const reducedMotion =
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion || durationMs <= 0) {
      setDisplay(safeTarget);
      return;
    }

    const startTime = performance.now();
    const fromVal = 0;

    const step = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / durationMs);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      const current = fromVal + (safeTarget - fromVal) * eased;
      setDisplay(t >= 1 ? safeTarget : current);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [safeTarget, durationMs]);

  const formatted = useMemo(() => {
    if (format === 'percent') {
      return `${display.toFixed(decimals)}%`;
    }
    if (decimals > 0) {
      return display.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    }
    return Math.round(display).toLocaleString();
  }, [display, format, decimals]);

  return (
    <span className={`tabular-nums ${className}`}>
      {formatted}
      {suffix}
    </span>
  );
};

/* ============================================================================
   UTILITY HELPERS — COMPACT TICKS & SMOOTH MONOTONE CUBIC BEZIER PATHS
   ============================================================================ */

function formatCompactTick(val: number): string {
  if (!Number.isFinite(val)) return '0';
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(val % 1_000_000 === 0 ? 0 : 1)}M`;
  if (val >= 1000) return `${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}k`;
  return String(Math.round(val));
}

function computeNiceAxis(rawMax: number, minTop = 4): { top: number; ticks: number[] } {
  const safeMax = Math.max(0, Number.isFinite(rawMax) ? rawMax : 0);
  if (safeMax <= minTop) {
    const step = minTop / 4;
    return {
      top: minTop,
      ticks: [minTop, minTop - step, minTop - step * 2, minTop - step * 3, 0],
    };
  }
  const roughStep = safeMax / 4;
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const residual = roughStep / magnitude;
  let niceStep = magnitude;
  if (residual <= 1) niceStep = 1 * magnitude;
  else if (residual <= 2) niceStep = 2 * magnitude;
  else if (residual <= 2.5) niceStep = 2.5 * magnitude;
  else if (residual <= 5) niceStep = 5 * magnitude;
  else niceStep = 10 * magnitude;

  const top = Math.max(minTop, Math.ceil(safeMax / niceStep) * niceStep);
  const actualStep = top / 4;
  return {
    top,
    ticks: [top, actualStep * 3, actualStep * 2, actualStep, 0],
  };
}

interface Point2D {
  x: number;
  y: number;
}

/**
 * Generates a smooth monotone cubic Bezier SVG path clamped so curves
 * never dip below baselineY or overshoot above topY.
 */
function buildSmoothBezierPath(points: Point2D[], topY: number, baselineY: number): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

  const clampY = (y: number) => Math.max(topY, Math.min(baselineY, y));
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const dx = p2.x - p1.x;
    const tension = 0.24;

    // Monotone-safe tangents: flatten tangent when neighboring segment is flat or reverses direction
    const slopePrev = i > 0 ? p1.y - p0.y : p2.y - p1.y;
    const slopeCur = p2.y - p1.y;
    const slopeNext = i < points.length - 2 ? p3.y - p2.y : p2.y - p1.y;

    const cp1x = p1.x + dx * 0.36;
    const cp1y =
      slopePrev * slopeCur <= 0
        ? p1.y
        : clampY(p1.y + (p2.y - p0.y) * tension * 0.5);

    const cp2x = p2.x - dx * 0.36;
    const cp2y =
      slopeCur * slopeNext <= 0
        ? p2.y
        : clampY(p2.y - (p3.y - p1.y) * tension * 0.5);

    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }

  return d;
}

/* ============================================================================
   2. GLASS BEZIER AREA CHART (Circulation Velocity & Circulation Over Time)
   ============================================================================ */

export interface BezierSeriesConfig {
  key: string;
  label: string;
  color: string;
  showArea?: boolean;
}

export interface GlassBezierAreaChartProps {
  data: Array<Record<string, any>>;
  xKey: string;
  series: BezierSeriesConfig[];
  height?: number;
  valueUnit?: string;
  showLegend?: boolean;
  minMaxDomain?: number;
  ariaLabel?: string;
}

export const GlassBezierAreaChart: React.FC<GlassBezierAreaChartProps> = ({
  data,
  xKey,
  series,
  height = 220,
  valueUnit = 'vols',
  showLegend = true,
  minMaxDomain = 4,
  ariaLabel = 'Circulation trend over time',
}) => {
  const uid = useId().replace(/:/g, '');
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const safeData = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) {
      return [{ [xKey]: '—', ...Object.fromEntries(series.map((s) => [s.key, 0])) }];
    }
    return data;
  }, [data, xKey, series]);

  const rawMax = useMemo(() => {
    let max = 0;
    for (const row of safeData) {
      for (const s of series) {
        const v = Number(row[s.key]) || 0;
        if (v > max) max = v;
      }
    }
    return max;
  }, [safeData, series]);

  const { top: yMax, ticks: yTicks } = useMemo(
    () => computeNiceAxis(rawMax, minMaxDomain),
    [rawMax, minMaxDomain]
  );

  // Normalized SVG coordinate space (1000 x 260) for crisp scaling with non-scaling-stroke
  const VB_W = 1000;
  const VB_H = 260;
  const PAD_T = 16;
  const PAD_B = 14;
  const PAD_X = 18;
  const PLOT_H = VB_H - PAD_T - PAD_B;
  const PLOT_W = VB_W - PAD_X * 2;
  const BASELINE_Y = PAD_T + PLOT_H;

  const xCoords = useMemo(() => {
    const n = safeData.length;
    if (n <= 1) return [PAD_X + PLOT_W / 2];
    return safeData.map((_, i) => PAD_X + (i / (n - 1)) * PLOT_W);
  }, [safeData, PLOT_W]);

  const seriesGeometries = useMemo(() => {
    return series.map((s) => {
      const pts: Point2D[] = safeData.map((row, idx) => {
        const val = Math.max(0, Number(row[s.key]) || 0);
        const ratio = yMax > 0 ? val / yMax : 0;
        return {
          x: xCoords[idx],
          y: BASELINE_Y - ratio * PLOT_H,
        };
      });
      const linePath = buildSmoothBezierPath(pts, PAD_T, BASELINE_Y);
      const areaPath =
        pts.length >= 2
          ? `${linePath} L ${pts[pts.length - 1].x.toFixed(2)} ${BASELINE_Y.toFixed(2)} L ${pts[0].x.toFixed(2)} ${BASELINE_Y.toFixed(2)} Z`
          : '';
      return {
        ...s,
        pts,
        linePath,
        areaPath,
      };
    });
  }, [series, safeData, xCoords, yMax, BASELINE_Y, PLOT_H]);

  const activePointPct = useMemo(() => {
    if (hoverIdx === null || !xCoords[hoverIdx]) return 50;
    return (xCoords[hoverIdx] / VB_W) * 100;
  }, [hoverIdx, xCoords]);

  const hoveredRow = hoverIdx !== null ? safeData[hoverIdx] : null;

  // Compact X-axis labels (avoid crowding if > 8 points)
  const labelStride = safeData.length > 9 ? Math.ceil(safeData.length / 7) : 1;

  return (
    <div className="w-full select-none" role="img" aria-label={ariaLabel}>
      {showLegend && (
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex flex-wrap items-center gap-4 text-[11.5px] font-medium">
            {series.map((s) => (
              <span
                key={s.key}
                className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{
                    backgroundColor: s.color,
                    boxShadow: `0 0 8px ${s.color}70`,
                  }}
                />
                <span>{s.label}</span>
              </span>
            ))}
          </div>

          {hoveredRow ? (
            <span className="font-['JetBrains_Mono'] text-[11px] font-semibold tabular-nums text-slate-700 dark:text-amber-300 transition-opacity">
              {String(hoveredRow[xKey] ?? '')}
              {series.map((s) => ` · ${Number(hoveredRow[s.key] || 0).toLocaleString()} ${s.label.split(' ').pop()?.toLowerCase()}`)}
            </span>
          ) : (
            <span className="font-['JetBrains_Mono'] text-[10.5px] text-slate-400 dark:text-slate-500">
              Hover timeline to inspect
            </span>
          )}
        </div>
      )}

      {/* Plot Row: Y-Axis + Interactive SVG Canvas */}
      <div className="flex items-stretch gap-2.5">
        {/* Compact Single-Line Y-Axis */}
        <div
          className="flex flex-col justify-between text-right pr-0.5 py-1.5 shrink-0 w-9 font-['JetBrains_Mono'] text-[10.5px] tabular-nums text-slate-500 dark:text-slate-400"
          style={{ height }}
        >
          {yTicks.map((tick, idx) => (
            <span key={idx} className="leading-none whitespace-nowrap">
              {formatCompactTick(tick)}
            </span>
          ))}
        </div>

        {/* SVG Chart + Invisible Hover Crosshair Columns */}
        <div className="relative flex-1 min-w-0" style={{ height }}>
          <svg
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            preserveAspectRatio="none"
            className="w-full h-full overflow-visible block"
          >
            <defs>
              {seriesGeometries.map((s, idx) => (
                <linearGradient
                  key={s.key}
                  id={`ulm-bezier-area-${uid}-${idx}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
                  <stop offset="85%" stopColor={s.color} stopOpacity={0.05} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0.01} />
                </linearGradient>
              ))}
            </defs>

            {/* Horizontal Dashed Gridlines */}
            {yTicks.map((_, idx) => {
              const y = PAD_T + (idx / Math.max(1, yTicks.length - 1)) * PLOT_H;
              return (
                <line
                  key={idx}
                  x1={0}
                  y1={y}
                  x2={VB_W}
                  y2={y}
                  stroke="currentColor"
                  strokeOpacity={idx === yTicks.length - 1 ? 0.16 : 0.1}
                  strokeDasharray={idx === yTicks.length - 1 ? undefined : '4 5'}
                  vectorEffect="non-scaling-stroke"
                  className="text-slate-500 dark:text-slate-300"
                />
              );
            })}

            {/* Animated Line-Draw & Soft Area Glow Group */}
            <g className="ulm-line-reveal">
              {seriesGeometries.map((s, idx) =>
                s.showArea !== false && s.areaPath ? (
                  <path
                    key={`area-${s.key}`}
                    d={s.areaPath}
                    fill={`url(#ulm-bezier-area-${uid}-${idx})`}
                  />
                ) : null
              )}

              {seriesGeometries.map((s) => (
                <path
                  key={`line-${s.key}`}
                  d={s.linePath}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </g>

            {/* Active Vertical Dashed Crosshair Line */}
            {hoverIdx !== null && xCoords[hoverIdx] !== undefined && (
              <line
                x1={xCoords[hoverIdx]}
                y1={PAD_T - 4}
                x2={xCoords[hoverIdx]}
                y2={BASELINE_Y}
                stroke="currentColor"
                strokeOpacity={0.35}
                strokeWidth={1.25}
                strokeDasharray="3 3"
                vectorEffect="non-scaling-stroke"
                className="text-purple-600 dark:text-amber-300"
              />
            )}
          </svg>

          {/* Crisp Non-Stretched Glowing Active Dots (HTML overlay so circles are always 1:1 round!) */}
          {hoverIdx !== null &&
            seriesGeometries.map((s) => {
              const pt = s.pts[hoverIdx];
              if (!pt) return null;
              const leftPct = (pt.x / VB_W) * 100;
              const topPct = (pt.y / VB_H) * 100;
              return (
                <span
                  key={`dot-${s.key}`}
                  aria-hidden="true"
                  className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-100"
                  style={{
                    left: `${leftPct}%`,
                    top: `${topPct}%`,
                    width: '10px',
                    height: '10px',
                    backgroundColor: s.color,
                    border: '2px solid #ffffff',
                    boxShadow: `0 0 0 4px ${s.color}38, 0 2px 8px ${s.color}80`,
                  }}
                />
              );
            })}

          {/* Clamped Floating Frosted Crystal Tooltip */}
          {hoverIdx !== null && hoveredRow && (
            <div
              className="pointer-events-none absolute top-2 z-30 -translate-x-1/2 rounded-xl backdrop-blur-xl bg-white/95 dark:bg-[#170E2C]/95 border border-slate-200/90 dark:border-white/[0.16] shadow-lg px-3 py-2 min-w-[138px] transition-all duration-100"
              style={{
                left: `clamp(76px, ${activePointPct}%, calc(100% - 76px))`,
              }}
            >
              <p className="font-['JetBrains_Mono'] text-[10.5px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 whitespace-nowrap">
                {String(hoveredRow[xKey] ?? '')}
              </p>
              <div className="space-y-1">
                {series.map((s) => {
                  const val = Number(hoveredRow[s.key]) || 0;
                  return (
                    <div
                      key={s.key}
                      className="flex items-center justify-between gap-3 text-[11.5px] whitespace-nowrap"
                    >
                      <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-200 font-medium">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: s.color }}
                        />
                        <span>{s.label}</span>
                      </span>
                      <span className="font-['JetBrains_Mono'] font-bold tabular-nums text-slate-900 dark:text-white">
                        {val.toLocaleString()} {valueUnit}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Full-Height Invisible Hover Zones (1 per data point) */}
          <div
            className="absolute inset-0 z-20 flex items-stretch"
            onMouseLeave={() => setHoverIdx(null)}
          >
            {safeData.map((row, idx) => (
              <div
                key={idx}
                tabIndex={0}
                role="button"
                aria-label={`${String(row[xKey] ?? '')}: ${series
                  .map((s) => `${s.label} ${Number(row[s.key] || 0)}`)
                  .join(', ')}`}
                onMouseEnter={() => setHoverIdx(idx)}
                onFocus={() => setHoverIdx(idx)}
                onBlur={() => setHoverIdx((cur) => (cur === idx ? null : cur))}
                className="flex-1 h-full cursor-crosshair outline-none focus-visible:bg-purple-500/[0.06] dark:focus-visible:bg-white/[0.05] transition-colors"
              />
            ))}
          </div>
        </div>
      </div>

      {/* X-Axis Labels Row */}
      <div className="flex items-center pl-11 pt-2">
        <div className="relative flex-1 h-4">
          {safeData.map((row, idx) => {
            const isEdge = idx === 0 || idx === safeData.length - 1;
            const show = isEdge || idx % labelStride === 0;
            if (!show) return null;
            const leftPct = (xCoords[idx] / VB_W) * 100;
            const isHovered = hoverIdx === idx;
            return (
              <span
                key={idx}
                className={`absolute top-0 -translate-x-1/2 font-['JetBrains_Mono'] text-[10.5px] whitespace-nowrap transition-colors ${
                  isHovered
                    ? 'font-bold text-purple-700 dark:text-amber-300'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
                style={{
                  left:
                    idx === 0 && safeData.length > 1
                      ? `${Math.max(4, leftPct)}%`
                      : idx === safeData.length - 1 && safeData.length > 1
                        ? `${Math.min(96, leftPct)}%`
                        : `${leftPct}%`,
                }}
              >
                {String(row[xKey] ?? '')}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
   3. GLASS HATCHED STACK CHART (Holdings by Academic Discipline)
   ============================================================================ */

export interface HatchedStackDatum {
  label: string;
  available: number;
  issued: number;
  total?: number;
}

export interface GlassHatchedStackChartProps {
  data: HatchedStackDatum[];
  height?: number;
  availableLabel?: string;
  issuedLabel?: string;
  ariaLabel?: string;
}

export const GlassHatchedStackChart: React.FC<GlassHatchedStackChartProps> = ({
  data,
  height = 224,
  availableLabel = 'On Shelf Available',
  issuedLabel = 'Currently Issued',
  ariaLabel = 'Holdings comparison across academic disciplines',
}) => {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [lockedIdx, setLockedIdx] = useState<number | null>(null);

  const safeData = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) {
      return [{ label: 'General', available: 0, issued: 0, total: 0 }];
    }
    return data.map((d) => ({
      ...d,
      available: Math.max(0, Number(d.available) || 0),
      issued: Math.max(0, Number(d.issued) || 0),
      total: Math.max(0, Number(d.total ?? (Number(d.available) || 0) + (Number(d.issued) || 0))),
    }));
  }, [data]);

  const rawMax = useMemo(
    () => safeData.reduce((m, d) => Math.max(m, d.available + d.issued), 0),
    [safeData]
  );

  const { top: yMax, ticks: yTicks } = useMemo(() => computeNiceAxis(rawMax, 4), [rawMax]);

  const highlightedIdx = activeIdx ?? lockedIdx;
  const highlightedDatum = highlightedIdx !== null ? safeData[highlightedIdx] : null;

  return (
    <div className="w-full select-none" role="img" aria-label={ariaLabel}>
      {/* Legend + Live Monospace Header Readout */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 min-h-[20px]">
        <div className="flex flex-wrap items-center gap-4 text-[11.5px] font-medium">
          <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <span className="w-2.5 h-2.5 rounded-[3px] bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] shrink-0" />
            <span>{availableLabel}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <span
              className="w-2.5 h-2.5 rounded-[3px] shrink-0 border border-amber-500/60"
              style={{
                background:
                  'repeating-linear-gradient(138deg, #F59E0B 0 3px, rgba(255,255,255,0.5) 3px 5px)',
              }}
            />
            <span>{issuedLabel}</span>
          </span>
        </div>

        {highlightedDatum ? (
          <span className="font-['JetBrains_Mono'] text-[11px] font-semibold tabular-nums text-slate-800 dark:text-amber-300 truncate max-w-full">
            {highlightedDatum.label} · {highlightedDatum.available.toLocaleString()} on shelf ·{' '}
            {highlightedDatum.issued.toLocaleString()} issued
          </span>
        ) : (
          <span className="font-['JetBrains_Mono'] text-[10.5px] text-slate-400 dark:text-slate-500">
            Hover or click discipline bar
          </span>
        )}
      </div>

      {/* Y-Axis + Stacked Bars Plot Area */}
      <div className="flex items-stretch gap-2.5">
        {/* Compact Single-Line Y-Axis */}
        <div
          className="flex flex-col justify-between text-right pr-0.5 py-1 shrink-0 w-9 font-['JetBrains_Mono'] text-[10.5px] tabular-nums text-slate-500 dark:text-slate-400"
          style={{ height }}
        >
          {yTicks.map((tick, idx) => (
            <span key={idx} className="leading-none whitespace-nowrap">
              {formatCompactTick(tick)}
            </span>
          ))}
        </div>

        {/* Bar Plot Field */}
        <div
          className="relative flex-1 min-w-0 flex items-end justify-around gap-2 px-2 pb-0.5 pt-2"
          style={{ height }}
          onMouseLeave={() => setActiveIdx(null)}
        >
          {/* Dashed Horizontal Gridlines */}
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between py-1">
            {yTicks.map((_, idx) => (
              <div
                key={idx}
                className={
                  idx === yTicks.length - 1
                    ? 'w-full border-b border-slate-300/75 dark:border-white/[0.14]'
                    : 'w-full border-b border-dashed border-slate-300/55 dark:border-white/[0.08]'
                }
              />
            ))}
          </div>

          {/* Interactive Discipline Columns */}
          {safeData.map((d, idx) => {
            const total = d.available + d.issued;
            const totalPct = yMax > 0 ? Math.min(100, (total / yMax) * 100) : 0;
            const availRatio = total > 0 ? (d.available / total) * 100 : 0;
            const issuedRatio = total > 0 ? (d.issued / total) * 100 : 0;
            const isHighlighted = highlightedIdx === idx;
            const isDimmed = highlightedIdx !== null && highlightedIdx !== idx;

            return (
              <button
                key={`${d.label}-${idx}`}
                type="button"
                onMouseEnter={() => setActiveIdx(idx)}
                onFocus={() => setActiveIdx(idx)}
                onBlur={() => setActiveIdx((cur) => (cur === idx ? null : cur))}
                onClick={() => setLockedIdx((cur) => (cur === idx ? null : idx))}
                className={`relative z-10 flex-1 max-w-[104px] h-full flex flex-col items-center justify-end rounded-xl px-1.5 pt-2 pb-0 transition-all duration-150 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60 ${
                  isHighlighted
                    ? 'bg-slate-900/[0.045] dark:bg-white/[0.065]'
                    : 'hover:bg-slate-900/[0.03] dark:hover:bg-white/[0.04]'
                }`}
                title={`${d.label}: ${d.available.toLocaleString()} on shelf, ${d.issued.toLocaleString()} issued`}
              >
                {/* Floating Total Pill Above Bar on Hover/Select */}
                <span
                  className={`font-['JetBrains_Mono'] text-[10px] font-bold tabular-nums mb-1.5 transition-all duration-150 whitespace-nowrap ${
                    isHighlighted
                      ? 'opacity-100 -translate-y-0.5 text-slate-900 dark:text-amber-300'
                      : 'opacity-70 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {formatCompactTick(total)}
                </span>

                {/* Animated Stacked Bar Body */}
                <div
                  className="ulm-stack-bar w-full max-w-[54px] rounded-t-[9px] overflow-hidden flex flex-col justify-end shadow-[0_6px_18px_rgba(16,185,129,0.20)] dark:shadow-[0_8px_22px_rgba(0,0,0,0.45)] transition-opacity duration-150"
                  style={{
                    height: `${total > 0 ? Math.max(6, totalPct) : 2}%`,
                    animationDelay: `${idx * 42}ms`,
                    opacity: isDimmed ? 0.48 : 1,
                  }}
                >
                  {/* Upper Segment — Currently Issued (Diagonal Hatched Institutional Gold) */}
                  {d.issued > 0 && (
                    <div
                      className="w-full shrink-0 border-b border-white/40 dark:border-black/25"
                      style={{
                        height: `${Math.max(8, issuedRatio)}%`,
                        minHeight: '6px',
                        background:
                          'repeating-linear-gradient(138deg, #F59E0B 0 4px, rgba(255,255,255,0.45) 4px 6px)',
                      }}
                    />
                  )}

                  {/* Lower Segment — On Shelf Available (Rich Emerald) */}
                  {d.available > 0 && (
                    <div
                      className="w-full flex-1 bg-gradient-to-t from-emerald-600 via-emerald-500 to-emerald-400"
                      style={{
                        height: `${availRatio}%`,
                        minHeight: '4px',
                      }}
                    />
                  )}

                  {total === 0 && (
                    <div className="w-full h-full bg-slate-300/60 dark:bg-white/10" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Discipline X-Axis Labels */}
      <div className="flex items-start pl-11 pt-2 px-2 justify-around gap-2">
        {safeData.map((d, idx) => {
          const isHighlighted = highlightedIdx === idx;
          return (
            <span
              key={`lbl-${d.label}-${idx}`}
              className={`flex-1 max-w-[104px] text-center text-[11px] font-medium truncate transition-colors ${
                isHighlighted
                  ? 'font-bold text-slate-900 dark:text-amber-300'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
              title={d.label}
            >
              {d.label}
            </span>
          );
        })}
      </div>
    </div>
  );
};

/* ============================================================================
   4. GLASS SWEEP DONUT CHART (Clock-Sweep SVG Mask + Click-to-Isolate)
   ============================================================================ */

export interface GlassDonutSlice {
  label: string;
  value: number;
  color?: string;
  gradient?: [string, string];
}

export interface GlassSweepDonutChartProps {
  slices: GlassDonutSlice[];
  total: number;
  size?: number;
  thickness?: number;
  centerDefaultLabel?: string;
  centerUnit?: string;
  selectedLabel?: string | null;
  onSelectSlice?: (label: string | null) => void;
  ariaLabel?: string;
}

const DEFAULT_DONUT_GRADIENTS: Array<[string, string]> = [
  ['#7E22CE', '#F59E0B'], // Royal Purple -> Amber Gold
  ['#D97706', '#FBBF24'], // Institutional Gold
  ['#059669', '#34D399'], // Emerald
  ['#0284C7', '#38BDF8'], // Sky
  ['#DB2777', '#F472B6'], // Rose
  ['#4F46E5', '#818CF8'], // Indigo
  ['#0D9488', '#2DD4BF'], // Teal
  ['#9333EA', '#C084FC'], // Violet
];

export const GlassSweepDonutChart: React.FC<GlassSweepDonutChartProps> = ({
  slices,
  total,
  size = 204,
  thickness = 22,
  centerDefaultLabel = 'TOTAL VOLUMES',
  centerUnit = 'volumes',
  selectedLabel: controlledSelected,
  onSelectSlice,
  ariaLabel = 'Collection holdings breakdown',
}) => {
  const uid = useId().replace(/:/g, '');
  const [internalSelected, setInternalSelected] = useState<string | null>(null);
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);

  const selectedLabel =
    controlledSelected !== undefined ? controlledSelected : internalSelected;

  const handleToggleSlice = (label: string) => {
    const next = selectedLabel === label ? null : label;
    if (controlledSelected === undefined) {
      setInternalSelected(next);
    }
    if (onSelectSlice) onSelectSlice(next);
  };

  const activeSlices = useMemo(
    () => slices.filter((s) => Number(s.value) > 0),
    [slices]
  );

  const sumValues = useMemo(
    () => activeSlices.reduce((acc, s) => acc + Number(s.value), 0),
    [activeSlices]
  );

  const denom = Math.max(1, sumValues || total);
  const cx = size / 2;
  const cy = size / 2;
  const radius = Math.max(24, (size - thickness - 12) / 2);

  // Build normalized pathLength=100 segments (zero cornerRadius glitches even at 100%)
  const segments = useMemo(() => {
    const hasMultiple = activeSlices.length > 1;
    const gap = hasMultiple ? 0.9 : 0;
    let offset = 0;

    return activeSlices.map((s, idx) => {
      const pct = (Number(s.value) / denom) * 100;
      const visibleLen = hasMultiple ? Math.max(0.6, pct - gap) : 100;
      const seg = {
        ...s,
        idx,
        pct,
        length: visibleLen,
        offset,
        gradId: `ulm-sweep-grad-${uid}-${idx}`,
        gradPair: s.gradient || (s.color ? [s.color, s.color] : DEFAULT_DONUT_GRADIENTS[idx % DEFAULT_DONUT_GRADIENTS.length]),
      };
      offset += pct;
      return seg;
    });
  }, [activeSlices, denom, uid]);

  const focusedLabel = selectedLabel || hoveredLabel;
  const focusedSegment = focusedLabel
    ? segments.find((s) => s.label === focusedLabel) || null
    : null;
  const activeKey = focusedSegment ? `slice-${focusedSegment.idx}` : 'total';

  const centerTitle = focusedSegment
    ? focusedSegment.label
    : centerDefaultLabel;
  const centerValue = focusedSegment ? focusedSegment.value : total;
  const centerSubtitle = focusedSegment
    ? `${Math.round(focusedSegment.pct)}% share`
    : centerUnit;

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className="relative shrink-0 flex items-center justify-center select-none"
      style={{ width: size, height: size }}
    >
      {/* Ambient Royal Purple + Amber Gold Glow Halo */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-5 rounded-full bg-gradient-to-tr from-[#7E22CE]/18 via-[#A855F7]/14 to-amber-400/18 blur-xl dark:from-[#7E22CE]/28 dark:via-[#A855F7]/18 dark:to-amber-400/18"
      />

      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="relative z-10 overflow-visible"
      >
        <defs>
          {segments.map((seg) => (
            <linearGradient
              key={seg.gradId}
              id={seg.gradId}
              gradientUnits="userSpaceOnUse"
              x1={thickness}
              y1={thickness}
              x2={size - thickness}
              y2={size - thickness}
            >
              <stop offset="0%" stopColor={seg.gradPair[0]} />
              <stop offset="100%" stopColor={seg.gradPair[1]} />
            </linearGradient>
          ))}

          {/* Clock-Sweep Reveal Mask (0.85s cubic-bezier) */}
          <mask id={`ulm-sweep-mask-${uid}`}>
            <circle
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke="#ffffff"
              strokeWidth={thickness + 10}
              pathLength={100}
              transform={`rotate(-90 ${cx} ${cy})`}
              className="ulm-donut-mask"
            />
          </mask>
        </defs>

        {/* Subtle Recessed Track Ring */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={thickness}
          className="text-slate-200/75 dark:text-white/[0.06]"
        />

        {/* Animated Swept Segments with Smooth 260ms Expand + Glow Transitions */}
        <g mask={`url(#ulm-sweep-mask-${uid})`}>
          {segments.map((seg) => {
            const isDimmed =
              focusedLabel !== null && focusedLabel !== seg.label;
            const isActive = focusedLabel === seg.label;
            return (
              <circle
                key={seg.label}
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                stroke={`url(#${seg.gradId})`}
                strokeWidth={isActive ? thickness + 2.5 : thickness}
                strokeDasharray={`${seg.length} ${Math.max(0, 100 - seg.length)}`}
                strokeDashoffset={-seg.offset}
                strokeLinecap={segments.length === 1 ? 'butt' : 'round'}
                pathLength={100}
                transform={`rotate(-90 ${cx} ${cy})`}
                onClick={() => handleToggleSlice(seg.label)}
                onMouseEnter={() => setHoveredLabel(seg.label)}
                onMouseLeave={() =>
                  setHoveredLabel((cur) => (cur === seg.label ? null : cur))
                }
                style={{
                  opacity: isDimmed ? 0.25 : 1,
                  filter: isActive
                    ? 'drop-shadow(0 0 8px rgba(168, 85, 247, 0.55))'
                    : 'none',
                  transition:
                    'opacity 260ms ease, stroke-width 260ms cubic-bezier(0.22, 1, 0.36, 1), filter 260ms ease',
                  cursor: 'pointer',
                }}
              />
            );
          })}
        </g>
      </svg>

      {/* 100% Transparent Center Readout Overlay (Zero Dark Box / Zero Border / Smooth Pop-Fade) */}
      <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center text-center bg-transparent border-0 shadow-none px-6">
        <div
          key={activeKey}
          className="ulm-donut-center-pop flex flex-col items-center justify-center text-center max-w-[116px] bg-transparent border-0 shadow-none"
        >
          <span className="text-[8.5px] font-bold uppercase tracking-[0.11em] text-slate-500 dark:text-slate-400 max-w-full truncate">
            {centerTitle}
          </span>
          <span className="font-['Space_Grotesk'] text-[20px] font-bold tabular-nums text-slate-900 dark:text-white leading-tight mt-0.5 whitespace-nowrap">
            <AnimatedCounter value={centerValue} />
          </span>
          <span className="text-[10px] italic text-purple-700 dark:text-amber-300/90 leading-none mt-0.5 truncate max-w-full">
            {centerSubtitle}
          </span>
        </div>
      </div>
    </div>
  );
};
