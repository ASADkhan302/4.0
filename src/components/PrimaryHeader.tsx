import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  Plus, 
  BookOpen, 
  PanelLeftClose, 
  QrCode, 
  RotateCw, 
  HardDrive,
  AlertCircle,
  Menu
} from 'lucide-react';
import { NavigationTab } from '../types/library';
import { ULM_CREST_SRC } from '../assets/brand/crestData';

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

  const handleRefreshClick = () => {
    setIsRotating(true);
    if (onReloadData) onReloadData();
    setTimeout(() => setIsRotating(false), 600);
  };

  return (
    <header className="w-full shrink-0 z-40 select-none bg-gradient-to-r from-[#1A0E26] via-[#541A72]/25 to-[#0B1220] border-b border-[#BC881B]/30 h-16 xl:h-[4.5rem]">
      {/* Main Top Header Bar */}
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 h-full flex items-center justify-between gap-3">
        {/* Left Side: Sidebar Toggle + Institutional Insignia + Breadcrumb */}
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              title={isSidebarCollapsed ? "Open Menu" : "Close Menu"}
              className="md:hidden inline-flex items-center justify-center p-2 rounded-[8px] text-[#BC881B] hover:bg-white/[0.08] transition-colors"
              aria-label="Toggle Navigation Menu"
            >
              {isSidebarCollapsed ? (
                <Menu className="w-5 h-5" />
              ) : (
                <PanelLeftClose className="w-5 h-5 text-slate-400" />
              )}
            </button>
          )}

          {/* Insignia Crest Badge (2.75rem / 44px round badge) */}
          <div className="w-11 h-11 shrink-0 rounded-full bg-gradient-to-br from-[#BC881B]/30 via-transparent to-[#BC881B]/20 border border-[#BC881B]/50 flex items-center justify-center shadow-xs">
            <img 
              src={ULM_CREST_SRC} 
              alt="University of Lakki Marwat crest" 
              width={34} 
              height={34} 
              className="w-[34px] h-[34px] object-contain select-none"
              title="University of Lakki Marwat Official Crest"
            />
          </div>

          <div className="flex flex-col justify-center min-w-0">
            <h1 
              className="font-display font-bold text-[1.25rem] sm:text-[1.4rem] xl:text-[1.65rem] leading-[1.2] text-white truncate"
              title="University of Lakki Marwat"
            >
              University of Lakki Marwat
            </h1>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="font-ui font-semibold text-[11px] sm:text-[12px] tracking-[0.18em] uppercase text-[#BC881B] leading-none">
                CENTRAL CAMPUS LIBRARY
              </span>
              <span className="font-ui text-[11px] font-semibold text-[#BC881B] bg-[#BC881B]/15 border border-[#BC881B]/35 rounded-full px-2 py-0.5 tabular-nums leading-none">
                {(totalBooksCount ?? 0).toLocaleString()} Volumes
              </span>
            </div>
          </div>
        </div>

        {/* Right Section: Core Utility Actions (single horizontal flex row, 40px height, gap-2) */}
        <div className="flex items-center justify-end gap-2 shrink-0">
          {/* Storage / Database Chip */}
          <div 
            onClick={onOpenStorageConfig}
            className="h-10 px-3 rounded-[8px] border border-white/[0.12] bg-[#151C2C]/90 text-slate-200 font-ui text-[13px] font-semibold flex items-center gap-2 cursor-pointer hover:border-white/[0.25] transition-colors"
            title={`Database: ${storageLocationPath || 'ULM Library SQLite/IndexedDB Store'}`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
            <HardDrive className="w-4 h-4 text-[#BC881B] shrink-0" />
            <span className="hidden min-[1100px]:inline">ULM Library</span>
          </div>

          {/* Quick Barcode Station Launcher */}
          {activeTab !== 'scanner' && (
            <button
              onClick={() => onTabChange('scanner')}
              className="h-10 px-3 rounded-[8px] bg-[#151C2C] hover:bg-[#1E2638] text-slate-200 border border-white/[0.12] font-ui text-[13px] font-semibold transition-colors inline-flex items-center gap-2 cursor-pointer"
              title="Barcode Scanner Station (⌘2)"
            >
              <QrCode className="w-4 h-4 text-[#BC881B] shrink-0" />
              <span className="hidden min-[1100px]:inline">Barcode Station</span>
            </button>
          )}

          {/* Synchronize / Reload Data */}
          {onReloadData && (
            <button
              onClick={handleRefreshClick}
              className="h-10 px-3 rounded-[8px] bg-[#151C2C] hover:bg-[#1E2638] text-slate-200 border border-white/[0.12] font-ui text-[13px] font-semibold transition-colors inline-flex items-center gap-2 cursor-pointer"
              title="Sync Data / Refresh Catalog"
            >
              <RotateCw className={`w-4 h-4 text-[#BC881B] shrink-0 ${isRotating ? 'animate-spin' : ''}`} />
              <span className="hidden min-[1100px]:inline">Sync Data</span>
            </button>
          )}

          {/* Export Action */}
          <button
            onClick={onQuickExport}
            className="h-10 px-3 rounded-[8px] bg-[#151C2C] hover:bg-[#1E2638] text-slate-200 border border-white/[0.12] font-ui text-[13px] font-semibold transition-colors inline-flex items-center gap-2 cursor-pointer"
            title="Export Catalog & Transactions"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="hidden min-[1100px]:inline">Export</span>
          </button>

          {/* Single Gold Primary Action: + Add Book */}
          <button
            onClick={onOpenAddBook}
            className="h-10 px-4 rounded-[8px] bg-[#BC881B] hover:bg-[#D4A02A] active:scale-95 text-slate-950 font-ui font-semibold text-[13px] shadow-sm inline-flex items-center gap-1.5 transition-all cursor-pointer"
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
