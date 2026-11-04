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
import { ULM_OFFICIAL_CREST_SRC } from '../constants/ulmOfficialAssets';
import { handleCrestFallback } from '../constants/ulmOfficialCrest';
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
  customLogoDataUri?: string;
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
  customLogoDataUri,
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

  const totalVolumes = totalBooksCount ?? 5000;
  const secondaryButtonClass =
    'inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 h-11 xl:h-12 px-4 xl:px-5 rounded-xl text-xs md:text-sm font-semibold bg-white/80 hover:bg-white dark:bg-white/10 dark:hover:bg-white/20 backdrop-blur-xl text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-white/15 ring-1 ring-[#C8963E]/25 shadow-xs hover:-translate-y-0.5 transition-all duration-150 cursor-pointer';

  return (
    <header className="shrink-0 w-full max-w-none mx-0 min-h-[88px] xl:min-h-[100px] px-5 lg:px-8 py-3.5 bg-white/65 dark:bg-[#140D22]/68 backdrop-blur-2xl backdrop-saturate-200 border-b border-[#C8963E]/35 dark:border-[#FFD147]/20 shadow-[0_12px_36px_-8px_rgba(30,20,43,0.10),inset_0_1px_1px_rgba(255,255,255,0.85)] dark:shadow-[0_12px_36px_-8px_rgba(0,0,0,0.55),inset_0_1px_1px_rgba(255,255,255,0.12)] z-30 select-none">
      <div className="w-full max-w-none mx-0 flex flex-wrap items-center justify-between gap-4 xl:gap-6">
        
        {/* FAR-LEFT SIDE: Official ULM 2017 Crest Pedestal + University Identity */}
        <div className="flex items-center gap-3.5 xl:gap-4 mr-auto shrink-0">
          <div className="w-12 h-12 xl:w-14 xl:h-14 rounded-full p-1 bg-white/90 dark:bg-white/10 backdrop-blur-xl border border-[#C8963E]/55 dark:border-[#FFD147]/40 ring-2 ring-[#C8963E]/30 shadow-md flex items-center justify-center shrink-0">
            <img
              src={customLogoDataUri || ULM_OFFICIAL_CREST_SRC}
              alt="University of Lakki Marwat Official 2017 Crest"
              draggable={false}
              onError={handleCrestFallback}
              className="w-full h-full object-contain drop-shadow-xs"
            />
          </div>

          <div className="flex flex-col justify-center">
            <h1 className="font-display !text-2xl xl:!text-[30px] !font-extrabold !tracking-tight !leading-[1.1] !text-[#1A1027] dark:!text-white drop-shadow-[0_1px_0_rgba(255,255,255,0.8)] dark:drop-shadow-none">
              {universityName || 'University of Lakki Marwat'}
            </h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-xs xl:text-sm font-extrabold uppercase tracking-[0.22em] text-[#8A4B00] dark:text-[#FFD147]">
                {libraryName && libraryName !== 'Campus Catalog & Circulation' ? libraryName.toUpperCase() : 'CENTRAL CAMPUS LIBRARY'}
              </span>
              <span className="inline-flex items-center px-3.5 py-0.5 rounded-full text-xs font-extrabold bg-gradient-to-r from-[#F5E1B0]/90 to-[#EBC97E]/90 dark:from-[#FFD147]/25 dark:to-[#B8731B]/25 backdrop-blur-md text-[#5E3200] dark:text-[#FFD147] border border-[#C59032]/55 shadow-inner tabular-nums">
                {totalVolumes.toLocaleString()} Volumes
              </span>
            </div>
          </div>
        </div>

        {/* FAR-RIGHT SIDE: Non-Merging Action Toolbar with Explicit Gap & Shrink-0 Pill Boundaries */}
        <div className="flex flex-wrap items-center justify-end gap-2.5 md:gap-3 ml-auto shrink-0">
          {/* 1. White Glass / Dark Glass Theme Switcher */}
          <button
            type="button"
            onClick={handleToggleTheme}
            className={secondaryButtonClass}
            title={themeConfig.themeMode === 'light' ? 'Switch to Dark Obsidian Mode' : 'Switch to Soft Eye-Comfort White Glass Mode'}
          >
            {themeConfig.themeMode === 'light' ? (
              <>
                <Sun className="w-4 h-4 xl:w-5 xl:h-5 text-amber-500 shrink-0" />
                <span>White Glass</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 xl:w-5 xl:h-5 text-blue-400 shrink-0" />
                <span>Dark Glass</span>
              </>
            )}
          </button>

          {/* 2. Resolution & Workspace Zoom Selector */}
          <button
            type="button"
            onClick={handleCycleResolution}
            className={secondaryButtonClass}
            title={`Current Resolution Scale: ${Math.round(resolutionConfig.scale * 100)}% (${resolutionConfig.mode === 'auto' ? 'Auto-Fit' : 'Manual'}). Click to cycle.`}
          >
            <Monitor className="w-4 h-4 xl:w-5 xl:h-5 text-[#B8731B] dark:text-[#FFD147] shrink-0" />
            <span className="font-mono tabular-nums">
              {resolutionConfig.mode === 'auto' ? 'Auto' : `${Math.round(resolutionConfig.scale * 100)}%`}
            </span>
          </button>

          {/* 3. Sync Sheet / Reload Catalog */}
          <button
            type="button"
            onClick={handleRefreshClick}
            className={secondaryButtonClass}
            title="Synchronize Sheet & Refresh Catalog"
          >
            <RotateCw className={`w-4 h-4 xl:w-5 xl:h-5 text-[#B8731B] dark:text-[#FFD147] shrink-0 ${isRotating ? 'animate-spin' : ''}`} />
            <span>Sync Sheet</span>
          </button>

          {/* 4. Export Action */}
          <button
            type="button"
            onClick={onQuickExport}
            className={secondaryButtonClass}
            title="Export Catalog & Transactions"
          >
            <FileSpreadsheet className="w-4 h-4 xl:w-5 xl:h-5 text-[#64748B] dark:text-slate-300 shrink-0" />
            <span>Export</span>
          </button>

          {/* 5. Master Excel Auto-Sync & Download */}
          <button
            type="button"
            onClick={handleSyncMasterExcel}
            disabled={isSyncingMasterExcel}
            className={`${secondaryButtonClass} disabled:opacity-50`}
            title="Auto-Sync & Download Live Master Excel Register (ULM_Master_Books_Register.xlsx)"
          >
            <FileSpreadsheet className="w-4 h-4 xl:w-5 xl:h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{isSyncingMasterExcel ? 'Syncing...' : 'Master Excel'}</span>
          </button>

          {/* 6. Primary CTA Button: + Add Book */}
          <button
            type="button"
            onClick={onOpenAddBook}
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 h-11 xl:h-12 px-5 xl:px-6 rounded-xl text-xs md:text-sm font-extrabold bg-gradient-to-r from-[#541A72] via-[#6B21A8] to-[#B4690E] hover:brightness-110 !text-white border border-[#FFD147]/45 shadow-md hover:-translate-y-0.5 transition-all duration-150 cursor-pointer"
            title="Catalog a New Book Volume"
          >
            <Plus className="w-4 h-4 xl:w-5 xl:h-5 stroke-[2.5] !text-white shrink-0" />
            <span className="!text-white">+ Add Book</span>
          </button>
        </div>

      </div>
    </header>
  );
};
