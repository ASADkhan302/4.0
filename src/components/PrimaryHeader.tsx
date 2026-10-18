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
    <header className="w-full transition-colors duration-150 border-b shrink-0 z-40 select-none border-[var(--border)] bg-[#141214]/95 backdrop-blur-md shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
      {/* Main Top Header Bar */}
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 h-24 md:h-[98px] flex items-center justify-between gap-4">
        {/* Left Side: Sidebar Toggle + Institutional Insignia + Breadcrumb */}
        <div className="flex items-center gap-4 sm:gap-5 min-w-0">
          {onToggleSidebar && (
            <>
              {/* Mobile Menu button below 768px */}
              <button
                onClick={onToggleSidebar}
                title={isSidebarCollapsed ? "Open Menu" : "Close Menu"}
                className="btn-icon md:hidden inline-flex items-center justify-center p-2 rounded-[8px] text-[var(--gold-text)] hover:bg-[#2B2730] transition-colors"
                aria-label="Toggle Navigation Menu"
              >
                {isSidebarCollapsed ? (
                  <Menu className="w-6 h-6 text-[var(--text-accent)]" />
                ) : (
                  <PanelLeftClose className="w-6 h-6 text-[var(--text-muted)]" />
                )}
              </button>
            </>
          )}

          {/* Insignia Crest Badge (Prominent, majestic executive size with gold ambient glow) */}
          <div className="relative shrink-0 flex items-center justify-center p-1.5 rounded-full bg-gradient-to-br from-[#BC881B]/40 via-transparent to-[#BC881B]/25 border-2 border-[#BC881B]/60 shadow-[0_0_24px_rgba(188,136,27,0.4)]">
            <img 
              src={ULM_CREST_SRC} 
              alt="University of Lakki Marwat crest" 
              width={84} 
              height={84} 
              className="w-16 h-16 sm:w-20 sm:h-20 md:w-[84px] md:h-[84px] object-contain drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)] select-none transition-transform hover:scale-105 duration-200"
              style={{ imageRendering: '-webkit-optimize-contrast' }}
              title="University of Lakki Marwat Official Crest"
            />
          </div>

          <div className="flex flex-col justify-center min-w-0">
            <span className="font-cinzel font-black text-[24px] sm:text-[28px] md:text-[32px] lg:text-[36px] tracking-[0.06em] uppercase truncate leading-tight text-white drop-shadow-[0_3px_10px_rgba(0,0,0,0.85)]">
              {universityName}
            </span>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <span className="text-[14px] sm:text-[16px] md:text-[18px] font-bold text-[#E0B450] tracking-[0.14em] uppercase font-sans truncate leading-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)]">
                {libraryName}
              </span>
              {totalBooksCount !== undefined && (
                <span className="px-2.5 py-0.5 rounded-full bg-[#541A72] border border-[#BC881B]/40 text-[#E0B450] font-mono font-bold text-xs shadow-xs">
                  {totalBooksCount.toLocaleString()} Volumes
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Section: Core Utility Actions */}
        <div className="flex items-center justify-end gap-2.5 shrink-0">
          {/* Quick Barcode Station Launcher */}
          {activeTab !== 'scanner' && activeTab !== 'catalog' && (
            <button
              onClick={() => onTabChange('scanner')}
              className="h-9 px-3.5 rounded-[10px] bg-[#541A72] hover:bg-[#6A2290] active:bg-[#3F1256] text-white border border-[#A66BC9]/30 text-[12px] font-semibold transition-all duration-150 hover:-translate-y-0.5 active:scale-95 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#29658E] focus-visible:ring-offset-2 focus-visible:ring-offset-[#141214] hidden lg:inline-flex items-center justify-center gap-2 cursor-pointer"
              title="Barcode Scanner Station (⌘2)"
            >
              <QrCode className="w-4 h-4 text-[#E0B450] shrink-0" />
              <span>Barcode Station</span>
            </button>
          )}

          {/* Database Storage Location Configuration */}
          {onOpenStorageConfig && (
            <button
              onClick={onOpenStorageConfig}
              className="h-9 px-3.5 rounded-[10px] bg-[#541A72] hover:bg-[#6A2290] active:bg-[#3F1256] text-white border border-[#A66BC9]/30 text-[12px] font-semibold transition-all duration-150 hover:-translate-y-0.5 active:scale-95 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#29658E] focus-visible:ring-offset-2 focus-visible:ring-offset-[#141214] inline-flex items-center justify-center gap-2 max-w-[180px] sm:max-w-[220px] cursor-pointer"
              title={`Database Storage Directory: ${storageLocationPath || 'C:\\ULM_Library_Database'}. Click to configure storage location.`}
            >
              <HardDrive className="w-4 h-4 text-[#E0B450] shrink-0" />
              <span className="hidden md:inline font-mono text-[12px] truncate">
                {storageLocationPath ? (storageLocationPath.split(/[\\/]/).pop() || storageLocationPath) : 'Storage'}
              </span>
            </button>
          )}

          {/* Synchronize / Refresh Database Store */}
          {onReloadData && (
            <button
              onClick={handleRefreshClick}
              className="h-9 px-3.5 rounded-[10px] bg-[#541A72] hover:bg-[#6A2290] active:bg-[#3F1256] text-white border border-[#A66BC9]/30 text-[12px] font-semibold transition-all duration-150 hover:-translate-y-0.5 active:scale-95 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#29658E] focus-visible:ring-offset-2 focus-visible:ring-offset-[#141214] inline-flex items-center justify-center gap-2 cursor-pointer"
              title="Synchronize UI with Database / Reload"
            >
              <RotateCw className={`w-4 h-4 text-[#E0B450] shrink-0 ${isRotating ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sync Data</span>
            </button>
          )}

          {/* Export Center Trigger */}
          <button
            onClick={onQuickExport}
            className="h-9 px-3.5 rounded-[10px] bg-[#541A72] hover:bg-[#6A2290] active:bg-[#3F1256] text-white border border-[#A66BC9]/30 text-[12px] font-semibold transition-all duration-150 hover:-translate-y-0.5 active:scale-95 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#29658E] focus-visible:ring-offset-2 focus-visible:ring-offset-[#141214] inline-flex items-center justify-center gap-2 cursor-pointer"
            title="Export Catalog & Transactions to CSV"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="hidden sm:inline">Export</span>
          </button>

          {/* Sheet Write Waiting Indicator (Excel Lock) */}
          {waitingBooksCount !== undefined && waitingBooksCount > 0 && (
            <button
              type="button"
              onClick={onRetrySheetSync}
              className="h-9 px-3 rounded-[8px] bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer animate-pulse"
              title="Excel file lock detected. Close Excel and click here to synchronize."
            >
              <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>{waitingBooksCount} {waitingBooksCount === 1 ? 'book' : 'books'} waiting for the sheet - close Excel</span>
            </button>
          )}

          {/* Primary Action: Add Book */}
          <button
            onClick={onOpenAddBook}
            className="h-9 px-4 rounded-[10px] bg-gradient-to-r from-[#BC881B] to-[#D4A02A] hover:from-[#D4A02A] hover:to-[#E0B450] active:scale-95 text-[#1A1A1A] font-bold text-[12px] shadow-[0_2px_12px_rgba(188,136,27,0.35)] hover:shadow-[0_4px_16px_rgba(188,136,27,0.5)] border border-[#E0B450]/40 transition-all duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#29658E] focus-visible:ring-offset-2 focus-visible:ring-offset-[#141214] inline-flex items-center justify-center gap-2 cursor-pointer"
            title="Add New Book Title to Catalog"
          >
            <Plus className="w-4 h-4 stroke-[2.5] shrink-0" />
            <span>Add Book</span>
          </button>
        </div>
      </div>
    </header>
  );
};
