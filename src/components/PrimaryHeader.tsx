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
import { ULM_OFFICIAL_CREST_DATA_URI, handleCrestFallback } from '../constants/ulmOfficialCrest';
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

  const totalVolumes = totalBooksCount ?? 5000;
  const secondaryButtonClass =
    'h-12 xl:h-[52px] px-5 xl:px-6 rounded-2xl text-[15px] xl:text-base font-extrabold flex items-center gap-2.5 bg-white/95 hover:bg-white dark:bg-white/10 dark:hover:bg-white/15 text-[#1E142B] dark:text-white border border-[#DCCB9E] dark:border-white/15 hover:border-[#B8731B] shadow-[0_4px_12px_-2px_rgba(30,20,43,0.07),inset_0_1px_0_rgba(255,255,255,0.95)] hover:-translate-y-0.5 transition-all duration-150 cursor-pointer';

  return (
    <header className="shrink-0 w-full max-w-none mx-0 min-h-[96px] xl:min-h-[108px] px-5 lg:px-8 py-4 bg-gradient-to-r from-[#FFFDF9]/95 via-[#FAF5E8]/95 to-[#F6EFE0]/95 dark:from-[#160D22]/95 dark:via-[#1C112B]/95 dark:to-[#120B1B]/95 backdrop-blur-2xl border-b-2 border-[#D4B475]/55 dark:border-[#FFD147]/25 shadow-[0_10px_30px_-10px_rgba(30,20,43,0.10)] z-30 select-none">
      <div className="w-full max-w-none mx-0 flex items-center justify-between gap-6">
        
        {/* FAR-LEFT SIDE: Executive ULM Crest Pedestal + Large University Identity */}
        <div className="flex items-center gap-4 xl:gap-5 mr-auto shrink-0">
          <div className="w-16 h-16 xl:w-20 xl:h-20 rounded-2xl p-2 bg-gradient-to-br from-[#FFFFFF] via-[#FBF4E4] to-[#EFE0BE] dark:from-white/15 dark:to-white/5 border-2 border-[#C8963E]/65 dark:border-[#FFD147]/40 shadow-[0_6px_20px_-4px_rgba(180,105,14,0.28),inset_0_1px_0_rgba(255,255,255,0.95)] flex items-center justify-center shrink-0">
            <img
              src={ULM_OFFICIAL_CREST_DATA_URI}
              alt="University of Lakki Marwat Crest"
              draggable={false}
              onError={handleCrestFallback}
              className="w-full h-full object-contain drop-shadow-sm"
            />
          </div>

          <div className="flex flex-col justify-center">
            <h1 className="font-display !text-3xl xl:!text-[34px] !font-extrabold !tracking-tight !leading-[1.08] !text-[#1A1027] dark:!text-white drop-shadow-[0_1px_0_rgba(255,255,255,0.8)] dark:drop-shadow-none">
              University of Lakki Marwat
            </h1>
            <div className="flex items-center gap-3.5 mt-1.5 flex-wrap">
              <span className="text-sm xl:text-[15px] font-extrabold uppercase tracking-[0.24em] text-[#8A4B00] dark:text-[#FFD147]">
                CENTRAL CAMPUS LIBRARY
              </span>
              <span className="inline-flex items-center px-4 py-1 rounded-full text-xs xl:text-sm font-extrabold bg-gradient-to-r from-[#F5E1B0] to-[#EBC97E] dark:from-[#FFD147]/25 dark:to-[#B8731B]/25 text-[#5E3200] dark:text-[#FFD147] border border-[#C59032]/55 shadow-inner tabular-nums">
                {totalVolumes.toLocaleString()} Volumes
              </span>
            </div>
          </div>
        </div>

        {/* FAR-RIGHT SIDE: Premium High-Profile Action Toolbar Flush to Right Edge */}
        <div className="flex items-center gap-3 xl:gap-3.5 ml-auto shrink-0 flex-wrap justify-end">
          {/* 1. White Glass / Dark Glass Theme Switcher */}
          <button
            onClick={handleToggleTheme}
            className={secondaryButtonClass}
            title={themeConfig.themeMode === 'light' ? 'Switch to Dark Obsidian Mode' : 'Switch to Soft Eye-Comfort White Glass Mode'}
          >
            {themeConfig.themeMode === 'light' ? (
              <>
                <Sun className="w-5 h-5 xl:w-[22px] xl:h-[22px] text-amber-500 shrink-0" />
                <span>White Glass</span>
              </>
            ) : (
              <>
                <Moon className="w-5 h-5 xl:w-[22px] xl:h-[22px] text-blue-400 shrink-0" />
                <span>Dark Glass</span>
              </>
            )}
          </button>

          {/* 2. Resolution & Workspace Zoom Selector */}
          <button
            onClick={handleCycleResolution}
            className={secondaryButtonClass}
            title={`Current Resolution Scale: ${Math.round(resolutionConfig.scale * 100)}% (${resolutionConfig.mode === 'auto' ? 'Auto-Fit' : 'Manual'}). Click to cycle.`}
          >
            <Monitor className="w-5 h-5 xl:w-[22px] xl:h-[22px] text-[#B8731B] dark:text-[#FFD147] shrink-0" />
            <span className="font-mono tabular-nums">
              {resolutionConfig.mode === 'auto' ? 'Auto' : `${Math.round(resolutionConfig.scale * 100)}%`}
            </span>
          </button>

          {/* 3. Sync Sheet / Reload Catalog */}
          <button
            onClick={handleRefreshClick}
            className={secondaryButtonClass}
            title="Synchronize Sheet & Refresh Catalog"
          >
            <RotateCw className={`w-5 h-5 xl:w-[22px] xl:h-[22px] text-[#B8731B] dark:text-[#FFD147] shrink-0 ${isRotating ? 'animate-spin' : ''}`} />
            <span>Sync Sheet</span>
          </button>

          {/* 4. Export Action */}
          <button
            onClick={onQuickExport}
            className={secondaryButtonClass}
            title="Export Catalog & Transactions"
          >
            <FileSpreadsheet className="w-5 h-5 xl:w-[22px] xl:h-[22px] text-[#64748B] dark:text-slate-300 shrink-0" />
            <span>Export</span>
          </button>

          {/* 5. Master Excel Auto-Sync & Download */}
          <button
            onClick={handleSyncMasterExcel}
            disabled={isSyncingMasterExcel}
            className={`${secondaryButtonClass} disabled:opacity-50`}
            title="Auto-Sync & Download Live Master Excel Register (ULM_Master_Books_Register.xlsx)"
          >
            <FileSpreadsheet className="w-5 h-5 xl:w-[22px] xl:h-[22px] text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{isSyncingMasterExcel ? 'Syncing...' : 'Master Excel'}</span>
          </button>

          {/* 6. Primary CTA Button: + Add Book */}
          <button
            onClick={onOpenAddBook}
            className="h-12 xl:h-[52px] px-6 xl:px-7 rounded-2xl text-[15px] xl:text-base font-extrabold flex items-center gap-2.5 bg-gradient-to-r from-[#8E4F0B] via-[#B4690E] to-[#CE851D] hover:from-[#7A4207] hover:to-[#B57214] !text-white border border-[#E7BC61]/60 shadow-[0_8px_22px_-4px_rgba(180,105,14,0.45),inset_0_1px_0_rgba(255,255,255,0.35)] hover:-translate-y-0.5 transition-all duration-150 cursor-pointer"
            title="Catalog a New Book Volume"
          >
            <Plus className="w-5 h-5 xl:w-[22px] xl:h-[22px] stroke-[2.5] !text-white shrink-0" />
            <span className="!text-white">Add Book</span>
          </button>
        </div>

      </div>
    </header>
  );
};
