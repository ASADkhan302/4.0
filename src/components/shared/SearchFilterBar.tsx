import React from 'react';
import { Search, X, LayoutGrid, List } from 'lucide-react';

export interface SearchFilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchPlaceholder?: string;
  searchShortcutLabel?: string;
  filters?: React.ReactNode;
  viewMode?: 'grid' | 'list' | 'table';
  onViewModeChange?: (mode: 'grid' | 'list' | 'table') => void;
  viewModeLabels?: {
    grid?: string;
    list?: string;
  };
  extraActions?: React.ReactNode;
  className?: string;
}

export const SearchFilterBar: React.FC<SearchFilterBarProps> = ({
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Search records...',
  searchShortcutLabel = 'Ctrl + K',
  filters,
  viewMode,
  onViewModeChange,
  viewModeLabels = { grid: 'Grid View', list: 'List View' },
  extraActions,
  className = '',
}) => {
  return (
    <div 
      className={`ulm-preserve-glass rounded-[22px] bg-gradient-to-br from-white/50 via-white/30 to-white/15 dark:from-white/[0.08] dark:via-white/[0.04] dark:to-white/[0.02] backdrop-blur-2xl backdrop-saturate-[180%] border border-white/60 dark:border-white/[0.16] p-3 sm:p-3.5 shadow-[inset_1.5px_1.5px_2px_rgba(255,255,255,0.45),inset_-1.5px_-1.5px_1.5px_rgba(255,255,255,0.15),0_10px_30px_rgba(0,0,0,0.2)] space-y-3 ${className}`}
    >
      {/* Row 1: 44px Full-width Search Bar */}
      <div className="relative w-full">
        <Search className="w-4 h-4 text-[#C8963E] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full h-11 bg-white/55 dark:bg-[#1B1130]/75 backdrop-blur-xl border border-white/60 dark:border-white/15 rounded-xl pl-10 pr-24 py-2 text-[13px] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#BC881B] focus:ring-2 focus:ring-[#BC881B]/20 transition-all font-sans"
          dir="auto"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="w-8 h-8 min-w-[32px] min-h-[32px] flex items-center justify-center absolute right-20 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer rounded-[6px] z-10"
            title="Clear search query"
            aria-label="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        {searchShortcutLabel && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-[6px] bg-black/5 dark:bg-white/[0.06] border border-slate-300/70 dark:border-white/[0.1] text-[11px] font-mono text-slate-500 dark:text-[#B3AABD] select-none shadow-2xs pointer-events-none z-10">
            <span>{searchShortcutLabel}</span>
          </div>
        )}
      </div>

      {/* Row 2: Dropdown Filters & Segmented View Controls (Wrapped on narrow screens, nothing truncated) */}
      {(filters || onViewModeChange || extraActions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-0.5">
          {/* Filters area */}
          {filters && (
            <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[200px]">
              {filters}
            </div>
          )}

          {/* Right controls: Segmented View Mode Toggle + Extra actions */}
          <div className="flex items-center gap-2.5 flex-wrap ml-auto">
            {extraActions}

            {onViewModeChange && viewMode && (
              <div className="h-10 flex items-center bg-[#141214] border border-[#2E2A33] rounded-[10px] p-1 gap-1">
                <button
                  type="button"
                  onClick={() => onViewModeChange('grid')}
                  aria-pressed={viewMode === 'grid'}
                  className={`btn-segmented flex items-center gap-1.5 px-3 h-8 rounded-[8px] text-[12px] font-semibold transition-all duration-150 cursor-pointer ${
                    viewMode === 'grid'
                      ? 'btn-selected bg-[#BC881B] text-[#1A1A1A] font-bold shadow-[0_2px_8px_rgba(188,136,27,0.35)]'
                      : 'text-[#B3AABD] hover:text-white hover:bg-white/[0.05]'
                  }`}
                  title={viewModeLabels.grid || 'Grid View'}
                  aria-label={viewModeLabels.grid || 'Grid View'}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span className="btn-label">{viewModeLabels.grid || 'Grid View'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onViewModeChange(viewMode === 'table' ? 'table' : 'list')}
                  aria-pressed={viewMode === 'list' || viewMode === 'table'}
                  className={`btn-segmented flex items-center gap-1.5 px-3 h-8 rounded-[8px] text-[12px] font-semibold transition-all duration-150 cursor-pointer ${
                    viewMode === 'list' || viewMode === 'table'
                      ? 'btn-selected bg-[#BC881B] text-[#1A1A1A] font-bold shadow-[0_2px_8px_rgba(188,136,27,0.35)]'
                      : 'text-[#B3AABD] hover:text-white hover:bg-white/[0.05]'
                  }`}
                  title={viewModeLabels.list || 'List View'}
                  aria-label={viewModeLabels.list || 'List View'}
                >
                  <List className="w-3.5 h-3.5" />
                  <span className="btn-label">{viewModeLabels.list || 'List View'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
