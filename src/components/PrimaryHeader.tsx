import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  Plus, 
  PanelLeftClose, 
  RotateCw, 
  Menu,
  Sun,
  Moon,
  Monitor
} from 'lucide-react';
import { NavigationTab } from '../types/library';
import { ULM_CREST_LOGO } from '../constants/branding';
import { ULM_OFFICIAL_CREST_DATA_URI } from '../constants/ulmOfficialCrest';
import { syncMasterExcelRegister, downloadMasterExcelRegister } from '../services/libraryStorageAndMigration';
import { 
  getStoredThemeConfig, 
  saveThemeConfig, 
  subscribeThemeConfig,
  getStoredResolutionConfig,
  saveResolutionConfig,
  subscribeResolutionConfig,
  calculateAutoFitScale
} from '../services/displayResolutionManager';

interface PrimaryHeaderProps {
  activeTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  onOpenAddBook: () => void;
  onQuickExport: () => void;
  onReloadData?: () => void;
  onOpenStorageConfig?: () => void;
  storageLocationPath?: string;
  totalBooksCount?: number;
  activeLoansCount?: number;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  onOpenSearch?: () => void;
  universityName?: string;
  libraryName?: string;
  waitingBooksCount?: number;
  onRetrySheetSync?: () => void;
}

export const PrimaryHeader: React.FC<PrimaryHeaderProps> = ({
  activeTab,
  onTabChange,
  onOpenAddBook,
  onQuickExport,
  onReloadData,
  onOpenStorageConfig,
  storageLocationPath,
  totalBooksCount,
  isSidebarCollapsed = false,
  onToggleSidebar,
  universityName = 'University of Lakki Marwat',
  libraryName = 'Campus Catalog & Circulation',
  waitingBooksCount = 0,
  onRetrySheetSync,
}) => {
  const [isRotating, setIsRotating] = useState(false);
  const [isSyncingMasterExcel, setIsSyncingMasterExcel] = useState(false);
  const [themeConfig, setThemeConfig] = useState(getStoredThemeConfig);
  const [resolutionConfig, setResolutionConfig] = useState(getStoredResolutionConfig);

  useEffect(() => {
    const unsubTheme = subscribeThemeConfig(setThemeConfig);
    const unsubRes = subscribeResolutionConfig(setResolutionConfig);
    return () => {
      unsubTheme();
      unsubRes();
    };
  }, []);

  const handleToggleTheme = () => {
    const nextMode: 'light' | 'dark' = themeConfig.themeMode === 'light' ? 'dark' : 'light';
    const updated = { ...themeConfig, themeMode: nextMode };
    setThemeConfig(updated);
    saveThemeConfig(updated);
  };

  const handleCycleResolution = () => {
    const scales = [
      { mode: 'auto' as const, scale: calculateAutoFitScale(), label: 'Auto' },
      { mode: 'manual' as const, scale: 0.30, label: '30%' },
      { mode: 'manual' as const, scale: 0.45, label: '45%' },
      { mode: 'manual' as const, scale: 0.65, label: '65%' },
      { mode: 'manual' as const, scale: 0.85, label: '85%' },
      { mode: 'manual' as const, scale: 1.00, label: '100%' },
      { mode: 'manual' as const, scale: 1.25, label: '125%' },
    ];
    let nextIdx = 0;
    if (resolutionConfig.mode === 'auto') {
      nextIdx = 1;
    } else {
      const curIdx = scales.findIndex(s => s.mode === 'manual' && Math.abs(s.scale - resolutionConfig.scale) < 0.08);
      nextIdx = (curIdx >= 0 && curIdx < scales.length - 1) ? curIdx + 1 : 0;
    }
    const next = scales[nextIdx];
    const updated = {
      mode: next.mode,
      preset: next.mode === 'auto' ? ('auto' as const) : ('custom' as const),
      scale: next.scale,
    };
    setResolutionConfig(updated);
    saveResolutionConfig(updated);
  };

  const handleRefreshClick = () => {
    setIsRotating(true);
    if (onReloadData) onReloadData();
    setTimeout(() => setIsRotating(false), 600);
  };

  const handleSyncMasterExcel = async () => {
    setIsSyncingMasterExcel(true);
    try {
      await syncMasterExcelRegister();
      await downloadMasterExcelRegister();
    } catch (e) {
      console.warn('[PrimaryHeader] Master Excel sync note:', e);
    } finally {
      setIsSyncingMasterExcel(false);
    }
  };

  return (
    <header className="w-full shrink-0 z-40 select-none ulm-liquid-glass border-b border-slate-200/80 dark:border-white/10 min-h-[3.75rem] h-auto shadow-xs dark:shadow-md dark:shadow-black/25">
      {/* Main Top Header Bar (flex-wrap anti-merge layout) */}
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-2 min-h-[3.75rem] h-auto flex flex-wrap items-center justify-between gap-3">
        {/* Left Side: Sidebar Toggle + Institutional Insignia + Header Typography */}
        <div className="flex items-center gap-3 sm:gap-4.5 min-w-0">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              title={isSidebarCollapsed ? "Open Menu" : "Close Menu"}
              className="md:hidden inline-flex items-center justify-center p-2 rounded-xl text-[#BC881B] hover:bg-white/[0.08] transition-colors"
              aria-label="Toggle Navigation Menu"
            >
              {isSidebarCollapsed ? (
                <Menu className="w-5 h-5" />
              ) : (
                <PanelLeftClose className="w-5 h-5 text-slate-400" />
              )}
            </button>
          )}

          {/* Official Crest Badge (Unclipped transparent PNG with sun rays, wreath & 2017 preserved) */}
          <div className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center flex-shrink-0 bg-transparent transition-transform hover:scale-105">
            <img
              src={ULM_OFFICIAL_CREST_DATA_URI}
              alt="ULM Official Crest"
              className="w-10 h-10 object-contain select-none pointer-events-none bg-transparent"
              style={{ clipPath: 'none' }}
            />
          </div>

          <div className="flex flex-col justify-center min-w-0">
            <h1 
              className="font-serif font-bold text-[22px] sm:text-[24px] lg:text-[26px] leading-[1.18] tracking-[-0.01em] text-slate-900 dark:text-white drop-shadow-xs truncate select-none"
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
              title="University of Lakki Marwat"
            >
              University of Lakki Marwat
            </h1>
            <div className="flex items-center gap-2.5 mt-1 flex-wrap">
              <span className="font-sans font-bold text-[12px] sm:text-[13px] tracking-[0.22em] uppercase text-[#BC881B] dark:text-[#E0B450] leading-none select-none">
                CENTRAL CAMPUS LIBRARY
              </span>
              <span className="font-sans text-[12px] sm:text-[12.5px] font-bold text-amber-800 dark:text-[#F6D88E] bg-amber-500/15 dark:bg-[#BC881B]/25 border border-amber-500/30 dark:border-[#BC881B]/50 rounded-full px-3 py-1 tabular-nums leading-none shadow-xs">
                {(totalBooksCount ?? 5000).toLocaleString()} Volumes
              </span>
            </div>
          </div>
        </div>

        {/* Right Section: Theme Toggle, Resolution Zoom, Sync Sheet, Export, Master Excel, and + Add Book */}
        <div className="flex items-center justify-end gap-2 shrink-0">
          {/* 1-Click Soft White / Dark Obsidian Theme Switcher */}
          <button
            onClick={handleToggleTheme}
            className="h-10 px-3 rounded-lg bg-[#151C2C]/80 hover:bg-slate-800 text-slate-200 border border-white/10 text-xs font-semibold transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-sm hover:scale-[1.02] active:scale-[0.98]"
            title={themeConfig.themeMode === 'light' ? 'Switch to Dark Obsidian Mode' : 'Switch to Soft Eye-Comfort White Glass Mode'}
          >
            {themeConfig.themeMode === 'light' ? (
              <>
                <Sun className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="hidden lg:inline text-[11px]">☀️ White Glass</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="hidden lg:inline text-[11px]">🌙 Dark Glass</span>
              </>
            )}
          </button>

          {/* Quick Resolution & Workspace Zoom Selector */}
          <button
            onClick={handleCycleResolution}
            className="h-10 px-3 rounded-lg bg-[#151C2C]/80 hover:bg-slate-800 text-slate-200 border border-white/10 text-xs font-semibold transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-sm hover:scale-[1.02] active:scale-[0.98]"
            title={`Current Resolution Scale: ${Math.round(resolutionConfig.scale * 100)}% (${resolutionConfig.mode === 'auto' ? 'Auto-Fit' : 'Manual'}). Click to cycle.`}
          >
            <Monitor className="w-3.5 h-3.5 text-[#BC881B] shrink-0" />
            <span className="font-mono text-[11px] text-amber-300">
              {resolutionConfig.mode === 'auto' ? 'Auto' : `${Math.round(resolutionConfig.scale * 100)}%`}
            </span>
          </button>

          {/* Synchronize Sheet / Reload Catalog */}
          <button
            onClick={handleRefreshClick}
            className="h-10 px-3 rounded-lg bg-[#151C2C]/80 hover:bg-slate-800 text-slate-200 border border-white/10 text-xs font-medium transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            title="Synchronize Sheet & Refresh Catalog"
          >
            <RotateCw className={`w-3.5 h-3.5 text-[#BC881B] shrink-0 ${isRotating ? 'animate-spin' : ''}`} />
            <span className="hidden xl:inline">Sync Sheet</span>
          </button>

          {/* Export Action */}
          <button
            onClick={onQuickExport}
            className="h-10 px-3 rounded-lg bg-[#151C2C]/80 hover:bg-slate-800 text-slate-200 border border-white/10 text-xs font-medium transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            title="Export Catalog & Transactions"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="hidden xl:inline">Export</span>
          </button>

          {/* Master Excel Auto-Sync & Download (Rule 3) */}
          <button
            onClick={handleSyncMasterExcel}
            disabled={isSyncingMasterExcel}
            className="h-10 px-3 rounded-lg bg-[#151C2C]/80 hover:bg-slate-800 text-slate-200 border border-white/10 text-xs font-medium transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Auto-Sync & Download Live Master Excel Register (ULM_Master_Books_Register.xlsx)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="hidden xl:inline">
              {isSyncingMasterExcel ? 'Syncing...' : 'Master Excel'}
            </span>
          </button>

          {/* Primary Gold Action: + Add Book */}
          <button
            onClick={onOpenAddBook}
            className="h-10 px-4 rounded-lg bg-[#BC881B] hover:bg-[#D4A02A] active:scale-95 text-slate-950 font-semibold text-xs tracking-wide shadow-sm inline-flex items-center gap-1.5 transition-all cursor-pointer"
            title="Catalog a New Book Volume"
          >
            <Plus className="w-4 h-4 stroke-[2.5] shrink-0" />
            <span>Add Book</span>
          </button>
        </div>
      </div>
    </header>
  );
};
