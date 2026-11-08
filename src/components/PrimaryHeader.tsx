import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  Plus, 
  RotateCw, 
  Sun,
  Moon,
  Monitor,
  IdCard,
  Database
} from 'lucide-react';
import { NavigationTab } from '../types/library';
import { ULM_OFFICIAL_CREST_SRC } from '../constants/ulmOfficialAssets';
import { handleCrestFallback } from '../constants/ulmOfficialCrest';
import { syncMasterExcelRegister, downloadMasterExcelRegister } from '../services/libraryStorageAndMigration';
import { StorageEngine } from '../services/storageEngine';
import { 
  getStoredThemeConfig, 
  saveThemeConfig, 
  subscribeThemeConfig,
  getStoredResolutionConfig,
  saveResolutionConfig,
  subscribeResolutionConfig,
  calculateAutoFitScale
} from '../services/displayResolutionManager';

export interface PrimaryHeaderProps {
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
  onTabChange,
  onOpenAddBook,
  onQuickExport,
  onReloadData,
  universityName = 'University of Lakki Marwat',
  libraryName = 'Campus Catalog & Circulation',
  customLogoDataUri,
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

  const handleDatabaseBackup = async () => {
    await StorageEngine.triggerOneClickBackupDownload();
  };

  const secondaryButtonClass =
    'inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 h-8 px-2.5 rounded-lg text-xs font-semibold bg-white/80 hover:bg-white dark:bg-white/10 dark:hover:bg-white/20 backdrop-blur-xl text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-white/15 ring-1 ring-[#C8963E]/25 shadow-xs transition-all duration-150 cursor-pointer';

  return (
    <header className="shrink-0 w-full max-w-none mx-0 min-h-[56px] px-4 lg:px-6 py-2 bg-white/65 dark:bg-[#140D22]/68 backdrop-blur-2xl backdrop-saturate-200 border-b border-[#C8963E]/45 dark:border-[#FFD147]/25 shadow-[0_8px_24px_-8px_rgba(30,20,43,0.10),inset_0_1px_0_rgba(255,255,255,0.85)] dark:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.12)] z-30 select-none no-print">
      <div className="w-full max-w-none mx-0 flex flex-wrap lg:flex-nowrap items-center justify-between gap-3">
        
        {/* FAR-LEFT SIDE: Enlarged Crest Pedestal + Luxury Academic Serif Title */}
        <div className="flex items-center gap-4 xl:gap-5 mr-auto shrink-0">
          {/* Enlarged Crest Pedestal (60px-66px) with Gold Double-Rim */}
          <div className="w-[58px] h-[58px] xl:w-[66px] xl:h-[66px] rounded-2xl p-1 bg-white/95 dark:bg-white/10 backdrop-blur-xl border-2 border-[#C8963E] dark:border-[#FFD147]/80 ring-2 ring-[#C8963E]/30 shadow-lg flex items-center justify-center shrink-0">
            <img
              src={customLogoDataUri || ULM_OFFICIAL_CREST_SRC}
              alt="University Official Crest"
              draggable={false}
              onError={handleCrestFallback}
              className="w-full h-full object-contain drop-shadow-xs"
            />
          </div>

          {/* Luxury Academic Serif Title Stack */}
          <div className="flex flex-col justify-center">
            <h1
              className="font-['Playfair_Display',Georgia,serif] !text-2xl xl:!text-[28px] 2xl:!text-[32px] !font-black !tracking-tight !leading-tight !text-[#1A1027] dark:!text-white drop-shadow-[0_1px_0_rgba(255,255,255,0.8)] dark:drop-shadow-none"
            >
              {universityName || 'University of Lakki Marwat'}
            </h1>
            <div className="flex items-center gap-2.5 mt-1 flex-wrap">
              <span className="text-xs xl:text-sm font-extrabold uppercase tracking-[0.22em] text-[#8A4B00] dark:text-[#FFD147]">
                {libraryName ? libraryName.toUpperCase() : 'CENTRAL CAMPUS LIBRARY'}
              </span>
            </div>
          </div>
        </div>

        {/* FAR-RIGHT SIDE: Compact Single-Row Action Toolbar */}
        <div className="flex items-center justify-end gap-1.5 ml-auto shrink-0 flex-wrap">
          {/* 1. White Glass / Dark Glass Theme Toggle */}
          <button
            type="button"
            onClick={handleToggleTheme}
            className={secondaryButtonClass}
            title={themeConfig.themeMode === 'light' ? 'Switch to Dark Obsidian Mode' : 'Switch to Soft Eye-Comfort White Glass Mode'}
          >
            {themeConfig.themeMode === 'light' ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="hidden sm:inline">White Glass</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="hidden sm:inline">Dark Glass</span>
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
            <Monitor className="w-3.5 h-3.5 text-[#B8731B] dark:text-[#FFD147] shrink-0" />
            <span className="font-mono tabular-nums">
              {resolutionConfig.mode === 'auto' ? 'Auto' : `${Math.round(resolutionConfig.scale * 100)}%`}
            </span>
          </button>

          {/* 3. Print ID Card Studio Shortcut */}
          <button
            type="button"
            onClick={() => onTabChange('borrowers')}
            className={secondaryButtonClass}
            title="Open CR80 Smart Library ID Card Studio"
          >
            <IdCard className="w-3.5 h-3.5 text-[#541A72] dark:text-[#FFD147] shrink-0" />
            <span className="hidden md:inline">ID Card</span>
          </button>

          {/* 4. Database Backup */}
          <button
            type="button"
            onClick={handleDatabaseBackup}
            className={secondaryButtonClass}
            title="One-Click JSON Database Backup"
          >
            <Database className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="hidden lg:inline">Backup</span>
          </button>

          {/* 5. Sync Sheet / Reload Catalog */}
          <button
            type="button"
            onClick={handleRefreshClick}
            className={secondaryButtonClass}
            title="Synchronize Sheet & Refresh Catalog"
          >
            <RotateCw className={`w-3.5 h-3.5 text-[#B8731B] dark:text-[#FFD147] shrink-0 ${isRotating ? 'animate-spin' : ''}`} />
            <span className="hidden lg:inline">Sync</span>
          </button>

          {/* 6. Export Action */}
          <button
            type="button"
            onClick={onQuickExport}
            className={secondaryButtonClass}
            title="Export Catalog & Transactions"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#64748B] dark:text-slate-300 shrink-0" />
            <span className="hidden md:inline">Export</span>
          </button>

          {/* 7. Master Excel Auto-Sync & Download */}
          <button
            type="button"
            onClick={handleSyncMasterExcel}
            disabled={isSyncingMasterExcel}
            className={`${secondaryButtonClass} disabled:opacity-50`}
            title="Auto-Sync & Download Live Master Excel Register (ULM_Master_Books_Register.xlsx)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="hidden xl:inline">{isSyncingMasterExcel ? 'Syncing...' : 'Master Excel'}</span>
          </button>

          {/* 8. Primary CTA Button: + Add Book */}
          <button
            type="button"
            onClick={onOpenAddBook}
            className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 h-8 px-3.5 rounded-lg text-xs font-extrabold bg-gradient-to-r from-[#541A72] via-[#6B21A8] to-[#B4690E] hover:brightness-110 !text-white border border-[#FFD147]/45 shadow-xs transition-all duration-150 cursor-pointer"
            title="Catalog a New Book Volume"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5] !text-white shrink-0" />
            <span className="!text-white">+ Add Book</span>
          </button>
        </div>

      </div>
    </header>
  );
};

export default PrimaryHeader;
