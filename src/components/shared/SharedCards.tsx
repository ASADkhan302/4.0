import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { CountUp } from '../ui/count-up';

/**
 * 1. ITEM CARD (Loans, Members)
 * surface-1 (#1A1A1A), radius 14, 1px border-subtle (#2E2A33), padding 16.
 * Hover: border purple-light at 45% (#A66BC9), lift 2px (180ms, transform & shadow only).
 */
export interface ItemCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export const ItemCard: React.FC<ItemCardProps> = ({
  children,
  className = '',
  onClick,
  style,
}) => {
  return (
    <div
      onClick={onClick}
      style={style}
      className={`relative rounded-[14px] ulm-liquid-glass p-4 flex flex-col justify-between transition-all duration-[180ms] ease-out hover:border-[#BC881B]/50 hover:-translate-y-[2px] overflow-hidden ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
};

/**
 * 2. PANEL CARD (Reports, Migration)
 * Ultra-Transparent Crystal Liquid Glass, radius 14, specular crystal rim, padding 20.
 */
export interface PanelCardProps {
  children: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  headerAction?: React.ReactNode;
  hairlineColor?: string; // e.g. '#BC881B' or '#A66BC9'
  className?: string;
  onClick?: () => void;
}

export const PanelCard: React.FC<PanelCardProps> = ({
  children,
  title,
  subtitle,
  headerAction,
  hairlineColor,
  className = '',
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`relative rounded-[14px] ulm-liquid-glass p-5 overflow-hidden flex flex-col ${
        onClick
          ? 'cursor-pointer transition-all duration-[180ms] ease-out hover:border-[#BC881B]/50 hover:-translate-y-[2px]'
          : ''
      } ${className}`}
    >
      {hairlineColor && (
        <div 
          className="absolute top-0 left-0 right-0 h-[2.5px]" 
          style={{ backgroundColor: hairlineColor }} 
        />
      )}

      {(title || headerAction) && (
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 border-b border-slate-200/80 dark:border-[var(--border-subtle)]">
          <div>
            {typeof title === 'string' ? (
              <h3 className="text-[15px] font-bold text-slate-900 dark:text-[var(--text-strong)] tracking-tight leading-snug">
                {title}
              </h3>
            ) : (
              title
            )}
            {subtitle && (
              <p className="text-[12px] text-slate-600 dark:text-[var(--text-muted)] mt-0.5 font-sans">
                {subtitle}
              </p>
            )}
          </div>
          {headerAction && (
            <div className="flex items-center gap-2">
              {headerAction}
            </div>
          )}
        </div>
      )}

      {children}
    </div>
  );
};

/**
 * 3. KPI CARD (Reports Overview, Catalog Metrics, Circulation KPIs)
 * Clean liquid glass, high-contrast typography, no muddy gradient washes
 */
export interface KpiCardProps {
  label: string;
  value: number;
  subLabel?: React.ReactNode;
  icon?: LucideIcon;
  iconColor?: string;
  accentBarColor?: string;
  accentColor?: string;
  note?: string;
  fractionTooltip?: string;
  percentBar?: {
    value: number;
    max: number;
    color?: string;
  };
  trend?: {
    percentage: number;
    direction: 'up' | 'down';
    label: string;
  };
  isDanger?: boolean;
  isGoldNumber?: boolean;
  className?: string;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  subLabel,
  icon: Icon,
  note,
  fractionTooltip,
  isDanger = false,
  isGoldNumber = false,
  className = '',
}) => {
  return (
    <div
      className={`rounded-xl ulm-liquid-glass p-4 flex flex-col justify-between transition-all ${
        isDanger ? 'border-rose-500/40' : ''
      } ${className}`}
    >
      {/* Top row: Clean uppercase label + small muted 16px icon */}
      <div className="flex items-center justify-between gap-3">
        <span className="font-sans text-[11px] font-semibold text-slate-600 dark:text-[var(--text-muted)] uppercase tracking-[0.06em] truncate">
          {label}
        </span>
        {Icon && (
          <Icon className="w-4 h-4 text-slate-400 dark:text-[var(--text-muted)] shrink-0" strokeWidth={1.75} />
        )}
      </div>

      {/* Value: Playfair Display / serif with high contrast */}
      <div className="my-2.5 flex items-baseline gap-2.5 flex-wrap">
        <div 
          className={`text-2xl sm:text-3xl font-bold font-serif tabular-nums leading-none ${
            isDanger ? 'text-rose-600 dark:text-rose-400' : isGoldNumber ? 'text-amber-700 dark:text-royal-gold' : 'text-slate-900 dark:text-[var(--text-strong)]'
          }`}
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          {value.toLocaleString()}
        </div>

        {note && (
          <span className="text-[12px] text-slate-500 dark:text-[var(--text-muted)] font-normal leading-normal select-none">
            {note}
          </span>
        )}
      </div>

      {/* Subtext */}
      <div className="text-[12px] text-slate-600 dark:text-[var(--text-muted)] leading-snug font-sans truncate">
        {subLabel || fractionTooltip || (isDanger ? <span className="text-rose-600 dark:text-rose-400 font-medium">Items require attention</span> : <span>Active catalog inventory</span>)}
      </div>
    </div>
  );
};

