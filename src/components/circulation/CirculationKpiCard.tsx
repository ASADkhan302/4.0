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
      className={`group relative w-full text-left rounded-xl p-4 transition-all cursor-pointer flex flex-col justify-between overflow-hidden outline-none select-none bg-white/90 dark:bg-[#131B2E] border border-slate-200/80 dark:border-white/10 shadow-sm ${
        isSelected
          ? 'border-[#BC881B] ring-1 ring-[#BC881B] shadow-md'
          : 'hover:border-[#BC881B]/40'
      }`}
    >
      {/* Selected Indicator Top Accent Hairline */}
      {isSelected && (
        <div
          className="absolute top-0 left-0 right-0 h-[2.5px] bg-[#BC881B]"
        />
      )}

      {/* Row 1: Label on left, muted 16px icon on right */}
      <div className="flex items-center justify-between gap-2.5 w-full">
        <span
          className={`font-sans text-[11px] font-bold uppercase tracking-[0.06em] truncate leading-none ${
            isSelected ? 'text-amber-700 dark:text-[#E0B450]' : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          {label}
        </span>
        <Icon className="w-4 h-4 text-slate-400 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      </div>

      {/* Row 2: Value + Note */}
      <div className="my-2.5 flex items-baseline gap-2.5 flex-wrap min-w-0">
        <span
          className={`text-2xl sm:text-3xl font-extrabold tabular-nums leading-none ${
            isDangerNumber && count > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'
          }`}
        >
          {count.toLocaleString()}
        </span>

        {note && (
          <span
            className="text-[12px] text-slate-500 dark:text-slate-400 font-normal leading-normal truncate"
          >
            {note}
          </span>
        )}
      </div>

      {/* Row 3: Subtext */}
      <div className="text-[12px] text-slate-500 dark:text-slate-400 leading-snug font-sans truncate">
        {barTooltip || (isDangerNumber && count > 0 ? <span className="text-rose-500 dark:text-rose-400 font-medium">Overdue requires resolution</span> : <span>Circulation obligations</span>)}
      </div>
    </button>
  );
};
