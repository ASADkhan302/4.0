import React, { useState } from 'react';
import {
  FolderOpen,
  FileSpreadsheet,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  ArchiveRestore,
  X,
  CheckCircle2,
} from 'lucide-react';
import { ULM_OFFICIAL_CREST_DATA_URI, handleCrestFallback } from '../../constants/ulmOfficialCrest';
import {
  syncMasterExcelRegister,
  markWorkstationSetupCompleted,
} from '../../services/libraryStorageAndMigration';

export interface StorageSetupModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onConfigured: (
    folderPath: string,
    action?: 'add_manual' | 'import_excel' | 'restore_package' | 'new_library'
  ) => void;
  isResetMode?: boolean;
}

export const StorageSetupModal: React.FC<StorageSetupModalProps> = ({
  isOpen,
  onClose,
  onConfigured,
  isResetMode = false,
}) => {
  const [folderPath, setFolderPath] = useState<string>('Documents\\ULM Library Data');
  const [isSelecting, setIsSelecting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelectFolder = async () => {
    setIsSelecting(true);
    setErrorMsg(null);
    try {
      // 1. Electron / WebView2 Native folder selection
      if (typeof window !== 'undefined' && window.ulmLibraryApi?.selectCustomDataFolder) {
        const res = await window.ulmLibraryApi.selectCustomDataFolder();
        if (res && !res.canceled && res.activeDataDir) {
          setFolderPath(res.activeDataDir);
          return;
        }
      }

      // 2. Browser File System Access API
      if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
        try {
          const dirHandle = await (window as any).showDirectoryPicker({
            mode: 'readwrite',
            startIn: 'documents',
          });
          if (dirHandle && dirHandle.name) {
            (window as any).__ulm_data_dir_handle = dirHandle;
            const fullPath = `Documents\\${dirHandle.name}`;
            setFolderPath(fullPath);
            return;
          }
        } catch (pickerErr: any) {
          if (pickerErr.name !== 'AbortError') {
            console.warn('[StorageSetup] Picker note:', pickerErr);
          }
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Folder selection error');
    } finally {
      setIsSelecting(false);
    }
  };

  const handleCompleteOnboarding = async (
    mode: string,
    action?: 'add_manual' | 'import_excel' | 'restore_package' | 'new_library'
  ) => {
    const finalPath = folderPath.trim() || 'Documents\\ULM Library Data';
    try {
      const config = {
        mode,
        folderPath: finalPath,
        configuredAt: new Date().toISOString(),
        isConfigured: true,
      };
      localStorage.setItem('ulm_data_folder_config_v1', JSON.stringify(config));
      localStorage.removeItem('ulm_database_cleared');
      markWorkstationSetupCompleted(mode);

      // Initialize Master Excel Register in persistent folder
      try {
        await syncMasterExcelRegister([]);
      } catch (_) {}

      onConfigured(finalPath, action);
    } catch (err: any) {
      setErrorMsg(`Initialization failed: ${err.message || 'Unknown error'}`);
    }
  };

  const handleDismissClose = () => {
    const finalPath = folderPath.trim() || 'Documents\\ULM Library Data';
    markWorkstationSetupCompleted('dismissed_close');
    if (onClose) {
      onClose();
    } else {
      onConfigured(finalPath);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200"
      onClick={handleDismissClose}
    >
      <div
        className="relative max-w-5xl w-full rounded-2xl overflow-hidden flex flex-col max-h-[90dvh] bg-gradient-to-b from-[#FFFDF9] via-[#FAF6EC] to-[#F3EBD9] dark:from-[#150E22] dark:via-[#110B1C] dark:to-[#0C0814] border-2 border-[#C8963E]/70 dark:border-[#FFD147]/35 shadow-[0_25px_70px_-15px_rgba(20,12,32,0.65)] text-slate-900 dark:text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top 24K Gold Accent Bar */}
        <div className="h-2 w-full bg-gradient-to-r from-[#541A72] via-[#D49B27] to-[#541A72] shrink-0" />

        {/* Scrollable Executive Body */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6 sm:p-7 space-y-5">
          {/* Header Block with Official ULM 2017 Crest Pedestal */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4 pb-5 border-b border-[#DCCB9E]/80 dark:border-white/10 text-center sm:text-left">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 flex-1 min-w-0">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl p-2 bg-gradient-to-br from-white via-[#FBF4E4] to-[#EFE0BE] dark:from-white/15 dark:to-white/5 border-2 border-[#C8963E]/65 dark:border-[#FFD147]/40 shadow-[0_8px_24px_-4px_rgba(180,105,14,0.28),inset_0_1px_0_rgba(255,255,255,0.95)] flex items-center justify-center shrink-0">
                <img
                  src={ULM_OFFICIAL_CREST_DATA_URI}
                  alt="University of Lakki Marwat Official Crest"
                  onError={handleCrestFallback}
                  className="w-full h-full object-contain drop-shadow-sm select-none"
                  draggable={false}
                />
              </div>

              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-[#F5E1B0] to-[#EBC97E] dark:from-[#FFD147]/20 dark:to-[#B8731B]/20 border border-[#C59032]/55 text-[#5E3200] dark:text-[#FFD147] text-xs font-extrabold uppercase tracking-wider">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {isResetMode
                      ? 'Post-Reset Workstation Initialization'
                      : 'Official First-Install Workstation Onboarding'}
                  </span>
                </div>

                <h2 className="text-2xl sm:text-[26px] font-display font-extrabold text-[#1A1027] dark:text-white tracking-tight leading-tight">
                  University of Lakki Marwat
                </h2>

                <p className="text-xs sm:text-sm font-extrabold uppercase tracking-[0.18em] text-[#8A4B00] dark:text-[#FFD147]">
                  Central Campus Library · Workstation Setup Suite
                </p>

                <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed max-w-2xl pt-0.5">
                  Welcome to the official offline campus library workstation. Choose how you would like to initialize your local 100,000+ volume catalog and live Master Excel Register below.
                </p>
              </div>
            </div>

            {/* Top-Right Close Button aligned cleanly inside Header */}
            <button
              type="button"
              onClick={handleDismissClose}
              title="Close and Enter Workstation"
              style={{ minWidth: '36px', minHeight: '36px', padding: 0 }}
              className="w-9 h-9 rounded-xl flex items-center justify-center bg-white hover:bg-slate-100 dark:bg-white/10 dark:hover:bg-white/20 text-slate-800 dark:text-white border border-[#DCCB9E] dark:border-white/15 shadow-xs transition-all cursor-pointer shrink-0 self-end sm:self-start"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Compact Folder Path Selector Bar */}
          <div className="p-4 rounded-2xl bg-white/95 dark:bg-[#1A132B]/90 border border-[#DCCB9E] dark:border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="space-y-1 flex-1 min-w-0">
              <label className="text-xs font-extrabold uppercase tracking-wider text-[#8A4B00] dark:text-[#FFD147] flex items-center gap-1.5 mb-1">
                <FolderOpen className="w-3.5 h-3.5 shrink-0" />
                <span>Designated Library Repository Path</span>
              </label>
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
                <input
                  type="text"
                  value={folderPath}
                  onChange={(e) => setFolderPath(e.target.value)}
                  placeholder="Documents\ULM Library Data"
                  className="flex-1 min-w-[200px] h-10 px-3.5 rounded-xl bg-[#FAF6EC] dark:bg-[#0C0814] border border-[#D4B475]/70 dark:border-white/15 text-xs font-mono font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-[#B8731B]"
                />
                <button
                  type="button"
                  onClick={handleSelectFolder}
                  disabled={isSelecting}
                  className="h-10 px-4 rounded-xl bg-white hover:bg-[#FAF5E8] dark:bg-white/10 dark:hover:bg-white/15 text-slate-900 dark:text-white border border-[#C8963E]/60 dark:border-white/15 text-xs font-bold inline-flex items-center gap-2 transition-all cursor-pointer shrink-0 shadow-2xs"
                >
                  <FolderOpen className="w-4 h-4 text-[#B8731B] dark:text-[#FFD147] shrink-0" />
                  <span>{isSelecting ? 'Selecting...' : 'Browse Folder'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* 3-Column Horizontal Onboarding Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1 (Recommended — Gold Rim): Start as a New Library */}
            <div
              onClick={() => handleCompleteOnboarding('new_library')}
              className="group relative min-w-0 overflow-hidden rounded-2xl p-5 bg-white dark:bg-[#1A132B]/90 border-2 border-[#C8963E] dark:border-[#FFD147]/60 shadow-[0_10px_25px_-8px_rgba(180,105,14,0.20)] hover:-translate-y-0.5 transition-all duration-150 cursor-pointer flex flex-col justify-between gap-4"
            >
              <div className="space-y-3 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#FEF3C7] to-[#FDE68A] dark:from-[#FFD147]/25 dark:to-[#B8731B]/20 border border-[#D49B27]/50 flex items-center justify-center text-[#92400E] dark:text-[#FFD147] shadow-2xs shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-amber-100 dark:bg-[#FFD147]/20 text-[#78350F] dark:text-[#FFD147] border border-[#D49B27]/50 shrink-0">
                    Recommended
                  </span>
                </div>

                <div className="min-w-0">
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white leading-snug">
                    Start as a New Library
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
                    Initialize a clean 0-book institutional catalog with continuous accession series starting at <span className="font-mono font-bold text-[#8A4B00] dark:text-[#FFD147]">#1</span> and auto-synced Master Excel Register.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCompleteOnboarding('new_library');
                }}
                style={{ minWidth: 0, color: '#FFFFFF' }}
                className="w-full max-w-full min-w-0 overflow-hidden h-10 px-3 rounded-xl bg-gradient-to-r from-[#B8731B] to-[#D49B27] hover:from-[#9E6012] hover:to-[#B8731B] text-white font-extrabold text-xs tracking-wide flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
              >
                <span className="truncate">Initialize Clean Catalog</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </button>
            </div>

            {/* Card 2 (Emerald Rim): Import My Existing Excel Sheet */}
            <div
              onClick={() => handleCompleteOnboarding('import_excel', 'import_excel')}
              className="group relative min-w-0 overflow-hidden rounded-2xl p-5 bg-white dark:bg-[#1A132B]/90 border-2 border-emerald-600/55 dark:border-emerald-400/45 hover:border-emerald-600 dark:hover:border-emerald-400 shadow-[0_10px_25px_-8px_rgba(5,150,105,0.16)] hover:-translate-y-0.5 transition-all duration-150 cursor-pointer flex flex-col justify-between gap-4"
            >
              <div className="space-y-3 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/35 flex items-center justify-center text-emerald-700 dark:text-emerald-300 shadow-2xs shrink-0">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 shrink-0">
                    Excel / CSV
                  </span>
                </div>

                <div className="min-w-0">
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white leading-snug">
                    Import My Existing Excel Sheet
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
                    Upload your existing <span className="font-mono font-bold">.xlsx</span> or <span className="font-mono font-bold">.csv</span> register. Streams up to 100,000+ books with automatic 13-digit Code-128 barcodes.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCompleteOnboarding('import_excel', 'import_excel');
                }}
                style={{ minWidth: 0, color: '#FFFFFF' }}
                className="w-full max-w-full min-w-0 overflow-hidden h-10 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs tracking-wide flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
              >
                <span className="truncate">Select Excel / CSV File</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </button>
            </div>

            {/* Card 3 (Royal Purple Rim): Restore Library Package (.ulmpack) */}
            <div
              onClick={() => handleCompleteOnboarding('restore_package', 'restore_package')}
              className="group relative min-w-0 overflow-hidden rounded-2xl p-5 bg-white dark:bg-[#1A132B]/90 border-2 border-[#7A28A3]/50 dark:border-purple-400/45 hover:border-[#541A72] dark:hover:border-purple-400 shadow-[0_10px_25px_-8px_rgba(84,26,114,0.18)] hover:-translate-y-0.5 transition-all duration-150 cursor-pointer flex flex-col justify-between gap-4"
            >
              <div className="space-y-3 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="w-11 h-11 rounded-xl bg-[#541A72]/15 dark:bg-purple-500/20 border border-[#541A72]/35 dark:border-purple-400/35 flex items-center justify-center text-[#541A72] dark:text-purple-300 shadow-2xs shrink-0">
                    <ArchiveRestore className="w-5 h-5" />
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-[#541A72]/15 dark:bg-purple-500/20 text-[#541A72] dark:text-purple-300 border border-[#541A72]/30 shrink-0">
                    Backup Restore
                  </span>
                </div>

                <div className="min-w-0">
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white leading-snug">
                    Restore Library Package (.ulmpack)
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
                    Restore a verified <span className="font-mono font-bold">.ulmpack</span> or USB transfer snapshot including books, members, circulation loans, and almari shelves.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCompleteOnboarding('restore_package', 'restore_package');
                }}
                style={{ minWidth: 0, color: '#FFFFFF' }}
                className="w-full max-w-full min-w-0 overflow-hidden h-10 px-3 rounded-xl bg-[#541A72] hover:bg-[#3E1156] text-white font-extrabold text-xs tracking-wide flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
              >
                <span className="truncate">Restore Backup Package</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Bottom Assurance Footer Bar */}
        <div className="px-6 py-4 bg-[#F3EBD9]/95 dark:bg-[#0C0814]/95 border-t border-[#DCCB9E] dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              100% Offline Local Storage · Saved permanently so this setup screen never interrupts you again
            </span>
          </div>

          <button
            type="button"
            onClick={() => handleCompleteOnboarding('enter_workstation')}
            style={{ color: '#FFD147' }}
            className="h-10 px-5 rounded-xl bg-gradient-to-r from-[#2D124D] via-[#431975] to-[#5E239D] hover:from-[#391761] hover:to-[#6E2AB8] text-[#FFD147] border border-[#FFD147]/55 font-extrabold text-xs sm:text-sm tracking-wide inline-flex items-center gap-2 shadow-[0_6px_18px_-4px_rgba(67,25,117,0.5)] hover:-translate-y-0.5 transition-all cursor-pointer shrink-0"
          >
            <span>Enter Library Workstation</span>
            <ArrowRight className="w-4 h-4 shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default StorageSetupModal;
