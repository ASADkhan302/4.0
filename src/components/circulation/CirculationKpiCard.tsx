import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface CirculationKpiCardProps {
  id: string;
  label: string;
  count: number;
  note: string;
  icon: LucideIcon;
  accentColor: string; // e.g. '#A66BC9', '#34D399', '#FB7185', '#6FA8D2'
  isSelected: boolean;
  onClick: () => void;
  barTooltip: string;
  barFraction: number; // 0 to 1
  isStackedBar?: boolean;
  stackedSegments?: {
    fraction: number;
    color: string;
    label: string;
  }[];
  isDangerNumber?: boolean;
  staggerIndex?: number;
}

export const CirculationKpiCard: React.FC<CirculationKpiCardProps> = ({
  id,
  label,
  count,
  note,
  icon: Icon,
  accentColor,
  isSelected,
  onClick,
  barTooltip,
  barFraction,
  isStackedBar = false,
  stackedSegments = [],
  isDangerNumber = false,
  staggerIndex = 0,
}) => {
  const isZero = count === 0;

  // Key navigation handler (Enter & Space)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  const activeTickCount = count > 0 ? Math.max(1, Math.min(12, Math.round(barFraction * 12))) : 0;

  return (
    <button
      type="button"
      id={`circulation-filter-${id.toLowerCase()}`}
      role="tab"
      aria-selected={isSelected}
      aria-pressed={isSelected}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={`ulm-preserve-glass group relative w-full text-left rounded-[22px] p-4 transition-all duration-300 cursor-pointer flex flex-col justify-between gap-2.5 overflow-hidden outline-none select-none bg-gradient-to-br from-white/50 via-white/30 to-white/15 dark:from-white/[0.08] dark:via-white/[0.04] dark:to-white/[0.02] backdrop-blur-2xl backdrop-saturate-[180%] shadow-[inset_1.5px_1.5px_2px_rgba(255,255,255,0.45),inset_-1.5px_-1.5px_1.5px_rgba(255,255,255,0.15),0_10px_30px_rgba(0,0,0,0.2)] hover:-translate-y-0.5 ${
        isSelected
          ? 'border-2 border-[#C8963E] dark:border-[#FFD147] ring-2 ring-[#FFD147]/35'
          : 'border border-white/60 dark:border-white/[0.16] hover:border-[#FFD147]/65'
      }`}
    >
      {/* Selected Indicator Top Specular Accent Hairline */}
      {isSelected && (
        <div
          className="absolute top-0 left-0 right-0 h-[2.5px] bg-gradient-to-r from-[#541A72] via-[#FFD147] to-[#B4690E]"
        />
      )}

      {/* Row 1: Plus Jakarta Sans Uppercase Label + 28x28px Frosted Icon Badge */}
      <div className="flex items-center justify-between gap-2.5 w-full">
        <span
          className={`ulm-kpi-label font-['Plus_Jakarta_Sans',sans-serif] text-[10.5px] font-bold uppercase tracking-[0.13em] truncate leading-none ${
            isSelected ? 'text-[#8A4B00] dark:text-[#FFD147]' : 'text-slate-600 dark:text-slate-300/90'
          }`}
        >
          {label}
        </span>
        <div
          className="w-7 h-7 rounded-xl bg-white/45 dark:bg-white/[0.08] border border-white/60 dark:border-white/15 flex items-center justify-center shrink-0"
        >
          <Icon
            className="w-3.5 h-3.5 shrink-0"
            style={{ color: accentColor }}
            strokeWidth={2}
            aria-hidden="true"
          />
        </div>
      </div>

      {/* Row 2: Space Grotesk 26px Tabular Numeral + Italic Unit Note */}
      <div className="flex items-baseline gap-2 flex-wrap min-w-0">
        <span
          className={`font-['Space_Grotesk',sans-serif] text-[26px] font-bold tabular-nums tracking-[-0.02em] leading-none ${
            isDangerNumber && count > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'
          }`}
        >
          {count.toLocaleString()}
        </span>

        {note && (
          <span
            className="font-['Plus_Jakarta_Sans',sans-serif] text-[11px] font-medium italic text-slate-500 dark:text-slate-400 leading-normal truncate"
          >
            {note}
          </span>
        )}
      </div>

      {/* Row 3: Subtext */}
      <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-snug font-sans truncate">
        {barTooltip || (isDangerNumber && count > 0 ? <span className="text-rose-600 dark:text-rose-400 font-semibold">Overdue requires resolution</span> : <span>Circulation obligations</span>)}
      </div>

      {/* Row 4: 12-Segment Micro Tick-Bar */}
      <div className="flex items-center gap-1 pt-1 w-full" title={barTooltip}>
        {isStackedBar && stackedSegments.length > 0 ? (
          (() => {
            const activeCount = Math.round((stackedSegments[0]?.fraction || 0) * 12);
            const overdueCount = Math.round((stackedSegments[1]?.fraction || 0) * 12);
            return Array.from({ length: 12 }).map((_, idx) => {
              let tickClass = 'bg-sky-500/80 dark:bg-sky-400/80';
              if (isZero) {
                tickClass = 'bg-slate-400/25 dark:bg-white/15';
              } else if (idx < activeCount) {
                tickClass = 'bg-emerald-500';
              } else if (idx < activeCount + overdueCount) {
                tickClass = 'bg-rose-500';
              }
              return <span key={idx} className={`h-1.5 flex-1 rounded-full ${tickClass}`} />;
            });
          })()
        ) : (
          Array.from({ length: 12 }).map((_, idx) => {
            const activeColorClass =
              id === 'OVERDUE'
                ? 'bg-rose-500'
                : id === 'ACTIVE'
                ? 'bg-emerald-500'
                : id === 'RETURNED'
                ? 'bg-sky-500'
                : 'bg-amber-500 dark:bg-[#FFD147]';
            return (
              <span
                key={idx}
                className={`h-1.5 flex-1 rounded-full ${
                  idx < activeTickCount ? activeColorClass : 'bg-slate-400/25 dark:bg-white/15'
                }`}
              />
            );
          })
        )}
      </div>
    </button>
  );
};
