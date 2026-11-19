"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface Series {
  key: string;
  label: string;
  slot?: 1 | 2 | 3 | 4 | 5;
}

const color = (s: Series, i: number) => `var(--chart-${s.slot ?? (i % 5) + 1})`;
const AXIS = { fill: "var(--muted-foreground, #94A3B8)", fontSize: 11 };
const defaultFormat = (v: number) => v.toLocaleString();

export interface ChartCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function ChartCard({ title, subtitle, actions, className, children, ...rest }: ChartCardProps) {
  return (
    <figure
      className={cn(
        "m-0 grid gap-4 rounded-[22px] bg-gradient-to-br from-white/50 via-white/30 to-white/15 dark:from-white/[0.075] dark:via-white/[0.03] dark:to-white/[0.015] backdrop-blur-xl backdrop-saturate-[175%] p-5 text-slate-900 dark:text-white border border-white/60 dark:border-white/[0.14] shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.45),inset_-1px_-1px_1px_rgba(255,255,255,0.12),0_8px_24px_rgba(0,0,0,0.16)]",
        className
      )}
      {...rest}
    >
      <figcaption className="flex items-start justify-between gap-3">
        <div className="grid gap-0.5">
          <span className="text-[14px] font-bold tracking-[-0.01em] text-slate-900 dark:text-white">{title}</span>
          {subtitle && <span className="text-[12px] text-slate-500 dark:text-slate-400 font-medium">{subtitle}</span>}
        </div>
        {actions}
      </figcaption>
      {children}
    </figure>
  );
}

function Legend({ series }: { series: Series[] }) {
  if (series.length < 2) return null;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5" aria-hidden>
      {series.map((s, i) => (
        <li key={s.key} className="flex items-center gap-1.5 text-[12px] font-medium text-slate-600 dark:text-slate-300">
          <span className="h-2.5 w-2.5 rounded-[4px]" style={{ background: color(s, i) }} />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

interface TooltipPayloadItem {
  dataKey?: string | number;
  name?: string | number;
  value?: number | string;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
  series: Series[];
  format: (v: number) => string;
  labelFormat?: (l: string) => string;
}

function ChartTooltip({
  active,
  payload,
  label,
  series,
  format,
  labelFormat,
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[140px] rounded-[12px] bg-white/95 dark:bg-[#1A102D]/95 backdrop-blur-md px-3.5 py-2.5 text-[12px] text-slate-900 dark:text-white shadow-xl border border-slate-200/80 dark:border-white/15">
      {label !== undefined && (
        <p className="mb-1.5 font-bold text-slate-900 dark:text-white">{labelFormat ? labelFormat(String(label)) : label}</p>
      )}
      <ul className="grid gap-1">
        {payload.map((p) => {
          const i = series.findIndex((s) => s.key === p.dataKey);
          const s = series[i] ?? { key: String(p.dataKey ?? ""), label: String(p.name ?? p.dataKey ?? "") };
          return (
            <li key={s.key} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
                <span className="h-2 w-2 rounded-[3px]" style={{ background: color(s, Math.max(i, 0)) }} />
                {s.label}
              </span>
              <span className="font-mono font-bold tabular-nums text-slate-900 dark:text-white">{format(Number(p.value ?? 0))}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function DataTableFallback<T extends Record<string, unknown>>({
  caption,
  data,
  xKey,
  series,
  format,
}: {
  caption: string;
  data: T[];
  xKey: string;
  series: Series[];
  format: (v: number) => string;
}) {
  return (
    <div className="sr-only">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{xKey}</th>
            {series.map((s) => (
              <th key={s.key} scope="col">{s.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              <th scope="row">{String(row[xKey])}</th>
              {series.map((s) => (
                <td key={s.key}>{format(Number(row[s.key]))}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface CartesianProps<T> {
  data: T[];
  xKey: keyof T & string;
  series: Series[];
  format?: (v: number) => string;
  xFormat?: (v: string) => string;
  height?: number;
  description: string;
  className?: string;
}

export function AreaTrend<T extends Record<string, unknown>>({
  data,
  xKey,
  series,
  format = defaultFormat,
  xFormat,
  height = 220,
  description,
  stacked = false,
  className,
}: CartesianProps<T> & { stacked?: boolean }) {
  const rawId = React.useId();
  const id = `area-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  return (
    <div className={cn("grid gap-3", className)}>
      <Legend series={series} />
      <div role="img" aria-label={description} style={{ height }}>
        <div aria-hidden className="h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
              <defs>
                {series.map((s, i) => (
                  <linearGradient key={s.key} id={`${id}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color(s, i)} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={color(s, i)} stopOpacity={0.02} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" opacity={0.5} />
              <XAxis dataKey={xKey as any} tickLine={false} axisLine={false} tick={AXIS} tickMargin={8} tickFormatter={xFormat} minTickGap={20} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={AXIS}
                tickFormatter={format}
                width={62}
                allowDecimals={false}
              />
              <RTooltip
                cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
                content={<ChartTooltip series={series} format={format} labelFormat={xFormat} />}
              />
              {series.map((s, i) => (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stackId={stacked ? "a" : undefined}
                  stroke={color(s, i)}
                  strokeWidth={2}
                  fill={`url(#${id}-${s.key})`}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)", fill: color(s, i) }}
                  isAnimationActive={false}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      <DataTableFallback caption={description} data={data} xKey={xKey} series={series} format={format} />
    </div>
  );
}

export function BarCompare<T extends Record<string, unknown>>({
  data,
  xKey,
  series,
  format = defaultFormat,
  xFormat,
  height = 220,
  description,
  stacked = false,
  className,
}: CartesianProps<T> & { stacked?: boolean }) {
  return (
    <div className={cn("grid gap-3", className)}>
      <Legend series={series} />
      <div role="img" aria-label={description} style={{ height }}>
        <div aria-hidden className="h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 0 }} barGap={4} barCategoryGap="24%">
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" opacity={0.5} />
              <XAxis dataKey={xKey as any} tickLine={false} axisLine={false} tick={AXIS} tickMargin={8} tickFormatter={xFormat} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={AXIS}
                tickFormatter={format}
                width={62}
                allowDecimals={false}
              />
              <RTooltip
                cursor={{ fill: "var(--muted)", opacity: 0.25 }}
                content={<ChartTooltip series={series} format={format} labelFormat={xFormat} />}
              />
              {series.map((s, i) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  stackId={stacked ? "a" : undefined}
                  fill={color(s, i)}
                  maxBarSize={42}
                  radius={stacked && i < series.length - 1 ? 0 : [6, 6, 0, 0]}
                  stroke={stacked ? "var(--card)" : undefined}
                  strokeWidth={stacked ? 2 : 0}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <DataTableFallback caption={description} data={data} xKey={xKey} series={series} format={format} />
    </div>
  );
}

export interface DonutSlice {
  label: string;
  value: number;
  slot?: 1 | 2 | 3 | 4 | 5;
}

export function DonutBreakdown({
  data,
  format = defaultFormat,
  centerLabel = "Total",
  description,
  size = 176,
  className,
}: {
  data: DonutSlice[];
  format?: (v: number) => string;
  centerLabel?: string;
  description: string;
  size?: number;
  className?: string;
}) {
  const total = data.reduce((n, d) => n + d.value, 0);
  const series: Series[] = data.map((d, i) => ({
    key: d.label,
    label: d.label,
    slot: d.slot ?? (((i % 5) + 1) as 1),
  }));

  return (
    <div className={cn("flex flex-wrap items-center gap-6", className)}>
      <div role="img" aria-label={description} className="relative shrink-0" style={{ width: size, height: size }}>
        <div aria-hidden className="h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                innerRadius="68%"
                outerRadius="100%"
                stroke="var(--card)"
                strokeWidth={2}
                startAngle={90}
                endAngle={-270}
                rootTabIndex={-1}
                isAnimationActive={false}
              >
                {data.map((d, i) => (
                  <Cell key={d.label} fill={color(series[i], i)} />
                ))}
              </Pie>
              <RTooltip content={<ChartTooltip series={[]} format={format} />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{centerLabel}</span>
          <span
            className="text-[18px] font-bold tabular-nums text-slate-900 dark:text-white mt-0.5"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {format(total)}
          </span>
        </div>
      </div>
      <ul className="grid min-w-[220px] flex-1 gap-2.5">
        {data.map((d, i) => {
          const pct = total ? Math.round((d.value / total) * 100) : 0;
          return (
            <li
              key={d.label}
              className="rounded-xl bg-white/35 dark:bg-white/[0.04] border border-white/50 dark:border-white/[0.08] p-2.5"
            >
              <div className="flex items-center justify-between gap-4 text-[12.5px]">
                <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-semibold truncate">
                  <span className="h-2.5 w-2.5 rounded-[3px] shrink-0" style={{ background: color(series[i], i) }} />
                  <span className="truncate">{d.label}</span>
                </span>
                <span className="tabular-nums font-mono shrink-0">
                  <span className="font-bold text-slate-900 dark:text-white">{format(d.value)}</span>
                  <span className="ml-2 text-slate-500 dark:text-slate-400 text-[11px]">{pct}%</span>
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-200/70 dark:bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${Math.max(4, pct)}%`, background: color(series[i], i) }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function Sparkline({
  data,
  slot = 1,
  height = 36,
  className,
}: {
  data: number[];
  slot?: 1 | 2 | 3 | 4 | 5;
  height?: number;
  className?: string;
}) {
  const rows = data.map((v, i) => ({ i, v }));
  return (
    <div aria-hidden className={className} style={{ height }}>
      <div aria-hidden className="h-full w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <Line
              type="monotone"
              dataKey="v"
              stroke={`var(--chart-${slot})`}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              strokeLinecap="round"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export interface KpiCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: React.ReactNode;
  delta?: number;
  good?: "up" | "down";
  period?: string;
  trend?: number[];
  icon?: React.ReactNode;
}

export function KpiCard({
  label,
  value,
  period,
  icon,
  className,
  ...rest
}: KpiCardProps) {
  return (
    <div
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      className={cn(
        "flex flex-col justify-between gap-2 rounded-[22px] bg-gradient-to-br from-white/50 via-white/30 to-white/15 dark:from-white/[0.075] dark:via-white/[0.03] dark:to-white/[0.015] backdrop-blur-xl backdrop-saturate-[175%] p-4 text-slate-900 dark:text-white border border-white/60 dark:border-white/[0.14] shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.45),inset_-1px_-1px_1px_rgba(255,255,255,0.12),0_8px_24px_rgba(0,0,0,0.16)] hover:border-[#FFD147]/55 transition-all",
        className
      )}
      {...rest}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.13em] text-slate-600 dark:text-slate-300">
          {label}
        </span>
        {icon && (
          <div className="w-7 h-7 rounded-xl bg-white/40 dark:bg-white/[0.07] border border-white/50 dark:border-white/15 flex items-center justify-center text-[#541A72] dark:text-[#FFD147] shrink-0">
            {icon}
          </div>
        )}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span
          className="text-[26px] leading-none font-bold tracking-tight tabular-nums text-slate-900 dark:text-white"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {value}
        </span>
      </div>
      {period && (
        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
          {period}
        </p>
      )}
    </div>
  );
}

export { ChartCard as Component };
