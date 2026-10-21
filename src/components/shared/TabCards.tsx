import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface TabCardItem<T = string> {
  id: T;
  label: string;
  count?: number | string;
  subLabel?: string;
  accentColor?: string; // hex or tailwind class for 3px bottom bar
  icon?: LucideIcon;
  badge?: string;
}

export interface TabCardsProps<T = string> {
  items: TabCardItem<T>[];
  activeId: T;
  onChange: (id: T) => void;
  variant?: 'count' | 'label';
  className?: string;
}

export function TabCards<T extends string = string>({
  items,
  activeId,
  onChange,
  variant = 'label',
  className = '',
}: TabCardsProps<T>) {
  if (variant === 'count') {
    return (
      <div className={`grid grid-cols-2 sm:grid-cols-4 gap-3 ${className}`}>
        {items.map((item) => {
          const isSelected = activeId === item.id;
          const barColor = item.accentColor || '#A66BC9';

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              aria-selected={isSelected}
              className={`relative overflow-hidden rounded-[14px] p-3.5 sm:p-4 text-left transition-all duration-150 cursor-pointer flex flex-col justify-between min-h-[82px] border ${
                isSelected
                  ? 'bg-purple-500/10 dark:bg-[rgba(166,107,201,0.14)] border-amber-600 dark:border-[#E0B450] text-slate-900 dark:text-white shadow-xs'
                  : 'bg-white dark:bg-[#1A1A1A] border-slate-200 dark:border-[#2E2A33] hover:border-slate-300 dark:hover:border-[#6F6879] hover:bg-slate-50 dark:hover:bg-white/[0.02]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`text-[12px] font-medium leading-tight ${isSelected ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-600 dark:text-[#B3AABD]'}`}>
                  {item.label}
                </span>
                {item.icon && (
                  <item.icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-amber-700 dark:text-[#E0B450]' : 'text-slate-500 dark:text-[#B3AABD]'}`} />
                )}
              </div>

              <div className="flex items-baseline justify-between gap-2 mt-1.5">
                <span className="text-[22px] font-mono font-bold text-slate-900 dark:text-white tabular-nums tracking-tight leading-none">
                  {item.count !== undefined ? item.count : '0'}
                </span>
                {item.subLabel && (
                  <span className="text-[11px] font-mono text-slate-500 dark:text-[#B3AABD]">
                    {item.subLabel}
                  </span>
                )}
              </div>

              {/* 3px Accent Bar at the bottom */}
              <div
                className="absolute bottom-0 left-0 right-0 h-[3px] transition-all"
                style={{ backgroundColor: isSelected ? barColor : `${barColor}66` }}
              />
            </button>
          );
        })}
      </div>
    );
  }

  // LABEL variant (Reports, Migration)
  return (
    <div className={`flex flex-wrap items-center gap-2 border-b border-slate-200/80 dark:border-[#2E2A33] pb-1 ${className}`}>
      {items.map((item) => {
        const isSelected = activeId === item.id;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            aria-selected={isSelected}
            className={`relative px-4 py-2.5 rounded-t-[10px] text-[13px] font-semibold transition-all duration-150 cursor-pointer inline-flex items-center gap-2 border-t border-x ${
              isSelected
                ? 'bg-white dark:bg-[#1A1A1A] text-amber-800 dark:text-[#E0B450] border-amber-500 dark:border-[#E0B450] border-b-transparent shadow-xs font-bold'
                : 'bg-slate-100/90 dark:bg-[#1A1A1A]/60 text-slate-700 dark:text-[#B3AABD] border-slate-200/80 dark:border-transparent hover:text-slate-950 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-white/[0.04]'
            }`}
          >
            {item.icon && (
              <item.icon className={`w-4 h-4 ${isSelected ? 'text-amber-700 dark:text-[#E0B450]' : 'text-slate-500 dark:text-[#B3AABD]'}`} />
            )}
            <span>{item.label}</span>
            {item.count !== undefined && (
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold tabular-nums ${
                  isSelected
                    ? 'bg-amber-100 text-amber-900 border border-amber-300 dark:bg-[#E0B450]/20 dark:text-[#E0B450] dark:border-[#E0B450]/40'
                    : 'bg-slate-200 text-slate-700 dark:bg-white/[0.06] dark:text-[#B3AABD]'
                }`}
              >
                {item.count}
              </span>
            )}
            {item.badge && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-amber-100 text-amber-900 border border-amber-300 dark:bg-[#BC881B]/20 dark:text-[#E0B450] dark:border-[#BC881B]/40">
                {item.badge}
              </span>
            )}
            {isSelected && (
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-amber-600 dark:bg-[#E0B450]" />
            )}
          </button>
        );
      })}
    </div>
  );
}
