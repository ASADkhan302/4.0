import React, { useState, useRef } from 'react';
import {
  X,
  FileSpreadsheet,
  FilePlus2,
  Package,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Loader2,
  FolderSearch,
  ExternalLink,
  ShieldAlert,
  Info,
  Sparkles,
} from 'lucide-react';
import { BookSheetService } from '../../services/bookSheetService';
import { LibraryFolderService } from '../../services/libraryFolderService';
import { UsbBackupService } from '../../services/usbBackupService';
import { LibraryStorage } from '../../services/storage';
import { ULM_OFFICIAL_CREST_DATA_URI, handleCrestFallback } from '../../constants/ulmOfficialCrest';
import { markWorkstationSetupCompleted } from '../../services/libraryStorageAndMigration';

interface WelcomeLibraryModalProps {
  isOpen: boolean;
  isMissingPath?: boolean;
  missingPath?: string;
  onClose: () => void;
  onComplete: (message: string) => void;
  onOpenStorageModal?: (option?: 'create_new' | 'open_existing') => void;
}

export const WelcomeLibraryModal: React.FC<WelcomeLibraryModalProps> = ({
  isOpen,
  isMissingPath = false,
  missingPath = '',
  onClose,
  onComplete,
  onOpenStorageModal,
}) => {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [beginnerSuccess, setBeginnerSuccess] = useState<{ folderPath: string; sheetBlob?: Blob } | null>(null);

  const packageInputRef = useRef<HTMLInputElement>(null);
  const existingSheetInputRef = useRef<HTMLInputElement>(null);
  const locateFileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleCloseAndMarkDone = () => {
    markWorkstationSetupCompleted('welcome_closed');
    onClose();
  };

  // Action 1: [Open library package (.ulmpack)]
  const handleOpenPackageFile = async (file: File) => {
    setErrorMsg(null);
    setLoadingAction('package');
    setStatusMessage('Validating package manifest, SHA-256 signatures, and database snapshot...');

    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      const val = await UsbBackupService.validateBackupZip(bytes);
      if (!val.valid) {
        setErrorMsg(val.errors.join(' | '));
        setLoadingAction(null);
        return;
      }

      setStatusMessage(
        `Restoring ${val.manifest?.recordCounts.books || 0} books and ${val.manifest?.recordCounts.members || 0} members from package...`
      );
      const restoreRes = await UsbBackupService.importFromUsb(bytes, 'REPLACE', (pct, stage) => {
        setStatusMessage(`${stage} (${pct}%)`);
      });

      if (restoreRes.success) {
        await LibraryFolderService.saveDatabaseFile();
        await LibraryFolderService.refreshDataFiles(true);
        markWorkstationSetupCompleted('restored_package');
        onComplete(restoreRes.message);
        onClose();
      } else {
        setErrorMsg(restoreRes.message);
        setLoadingAction(null);
      }
    } catch (err: any) {
      setErrorMsg(`Failed to open package: ${err.message}`);
      setLoadingAction(null);
    }
  };

  // Action 2: [Start as a new library]
  const handleStartAsBeginner = async () => {
    setErrorMsg(null);
    setLoadingAction('beginner');
    setStatusMessage('Setting up library folder, empty book sheet, and data files...');

    try {
      LibraryStorage.saveBooks([]);
      LibraryStorage.saveTransactions([]);
      const s = LibraryStorage.getSettings();
      LibraryStorage.saveSettings({ ...s, first_accession_number: 1 });

      const res = await LibraryFolderService.startAsBeginner(undefined, 'Documents\\ULM Library');
      markWorkstationSetupCompleted('new_library');
      if (res.success) {
        setBeginnerSuccess({ folderPath: res.folderPath });
        setStatusMessage('Library folder, empty book sheet, and data files successfully created.');
        setLoadingAction(null);
      } else {
        setErrorMsg(res.message);
        setLoadingAction(null);
      }
    } catch (err: any) {
      setErrorMsg(`Beginner setup error: ${err.message}`);
      setLoadingAction(null);
    }
  };

  // Action 3: [Start as a beginner and use my existing Excel sheet]
  const handleStartWithExistingSheet = async (file: File) => {
    setErrorMsg(null);
    setLoadingAction('existing_sheet');
    setStatusMessage('Setting up library folder and scanning your existing Excel sheet...');

    try {
      const folderRes = await LibraryFolderService.startAsBeginner(undefined, 'Documents\\ULM Library');
      if (!folderRes.success && !folderRes.message.includes('already contains')) {
        setErrorMsg(folderRes.message);
        setLoadingAction(null);
        return;
      }

      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const res = await BookSheetService.chooseAndConnectSheet(bytes, file.name);

      if (res.success) {
        await LibraryFolderService.saveDatabaseFile();
        await LibraryFolderService.refreshDataFiles(true);
        markWorkstationSetupCompleted('existing_excel_sheet');
        if (res.importedCount === 0) {
          onComplete('0 books found: the sheet is empty. Enter books in the sheet and import again.');
        } else {
          onComplete(`${folderRes.message} ${res.message}`);
        }
        onClose();
      } else {
        setErrorMsg(res.message);
        setLoadingAction(null);
      }
    } catch (err: any) {
      setErrorMsg(`Failed to import existing sheet: ${err.message}`);
      setLoadingAction(null);
    }
  };

  // Locate missing library file (.ulmlib or folder)
  const handleLocateMissing = async (file: File) => {
    setErrorMsg(null);
    setLoadingAction('locate');
    setStatusMessage('Reading and verifying library database file...');

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (data.format !== 'ULM_LIBRARY_DATABASE' && data.schema_version !== 3 && !data.books) {
        setErrorMsg('The selected file is not a valid ULM Library database (Library.ulmlib).');
        setLoadingAction(null);
        return;
      }

      markWorkstationSetupCompleted('located_database');
      onComplete(`Library database mounted from ${file.name}.`);
      onClose();
    } catch (err: any) {
      setErrorMsg(`Failed to locate library: ${err.message}`);
      setLoadingAction(null);
    }
  };

  // Open the newly created book sheet in Excel
  const handleOpenBookSheetInExcel = () => {
    const cached = BookSheetService.getCachedBytes();
    if (cached) {
      const blob = new Blob([cached as BlobPart], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ULM_Book_Entry_Sheet.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    markWorkstationSetupCompleted('book_sheet_opened');
    onComplete('Library setup complete. Book sheet downloaded for editing in Microsoft Excel.');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-md animate-in fade-in duration-150"
      onClick={handleCloseAndMarkDone}
    >
      <div
        className="w-full max-w-4xl bg-gradient-to-b from-[#FFFDF9] via-[#FAF6EC] to-[#F3EBD9] dark:from-[#150E22] dark:via-[#110B1C] dark:to-[#0C0814] border-2 border-[#D4B475]/65 dark:border-[#FFD147]/30 rounded-3xl shadow-[0_25px_70px_-15px_rgba(20,12,32,0.55)] overflow-hidden flex flex-col max-h-[88dvh] relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top 24K Gold Accent Bar */}
        <div className="h-2 w-full bg-gradient-to-r from-[#541A72] via-[#D49B27] to-[#541A72] shrink-0" />

        {/* Hidden inputs */}
        <input
          ref={packageInputRef}
          type="file"
          accept=".ulmpack,.zip"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleOpenPackageFile(f);
          }}
        />
        <input
          ref={existingSheetInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleStartWithExistingSheet(f);
          }}
        />
        <input
          ref={locateFileInputRef}
          type="file"
          accept=".ulmlib,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleLocateMissing(f);
          }}
        />

        {/* Header */}
        <div className="px-6 py-5 border-b border-[#DCCB9E] dark:border-white/10 flex items-center justify-between shrink-0 bg-white/70 dark:bg-white/[0.03]">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl p-1.5 bg-gradient-to-br from-white via-[#FBF4E4] to-[#EFE0BE] dark:from-white/15 dark:to-white/5 border-2 border-[#C8963E]/65 dark:border-[#FFD147]/40 shadow-md flex items-center justify-center shrink-0">
              <img
                src={ULM_OFFICIAL_CREST_DATA_URI}
                alt="University of Lakki Marwat Official Crest"
                onError={handleCrestFallback}
                className="w-full h-full object-contain drop-shadow-sm select-none"
                draggable={false}
              />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-display font-extrabold text-[#1A1027] dark:text-white tracking-tight">
                {isMissingPath ? 'Library File Not Found' : 'University of Lakki Marwat'}
              </h2>
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#8A4B00] dark:text-[#FFD147] mt-0.5">
                {isMissingPath
                  ? 'The configured library database file could not be located'
                  : 'Central Campus Library · Workstation Setup & Onboarding'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCloseAndMarkDone}
            className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/80 hover:bg-white dark:bg-white/10 dark:hover:bg-white/20 text-[#1A1027] dark:text-white border border-[#DCCB9E] dark:border-white/15 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 sm:p-8 space-y-6 flex-1 min-h-0 overflow-y-auto custom-scrollbar">
          {/* Missing File Notice */}
          {isMissingPath && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/35 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Library file not found at:</span>
                <span className="font-mono text-[11px] block break-all mt-0.5">
                  {missingPath || 'Documents\\ULM Library\\Library.ulmlib'}
                </span>
                <span className="block mt-1 text-[11px]">
                  Please choose one of the options below to locate your database, restore from a package, or start fresh.
                </span>
              </div>
            </div>
          )}

          {/* Error notification */}
          {errorMsg && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2.5 shadow-xs">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span className="flex-1 font-semibold">{errorMsg}</span>
            </div>
          )}

          {loadingAction ? (
            <div className="py-12 text-center space-y-4">
              <Loader2 className="w-10 h-10 text-[#B8731B] dark:text-[#FFD147] animate-spin mx-auto" />
              <div>
                <p className="text-base font-extrabold text-[#1A1027] dark:text-white">
                  Configuring Library Workstation...
                </p>
                <p className="text-xs text-[#4A3B5C] dark:text-slate-300 mt-1">{statusMessage}</p>
              </div>
            </div>
          ) : beginnerSuccess ? (
            <div className="py-8 text-center space-y-5">
              <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-extrabold text-[#1A1027] dark:text-white">
                  Library Initialized Successfully
                </h3>
                <p className="text-xs text-[#4A3B5C] dark:text-slate-300">
                  Your library folder is ready at{' '}
                  <span className="font-mono font-bold text-[#1A1027] dark:text-white">
                    {beginnerSuccess.folderPath}
                  </span>
                  .
                </p>
                <p className="text-xs text-[#4A3B5C] dark:text-slate-300">
                  The official Master Books Register (Universal Unlimited Rows — Auto-Synced) and Data Files have been generated.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleOpenBookSheetInExcel}
                  className="px-5 h-11 rounded-xl bg-gradient-to-r from-[#B8731B] to-[#D49B27] text-white font-extrabold text-xs flex items-center gap-2 cursor-pointer shadow-md transition-all"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Open Book Sheet in Excel</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    markWorkstationSetupCompleted('beginner_complete');
                    onComplete('Started as a new library. Ready for catalog entries.');
                    onClose();
                  }}
                  className="px-5 h-11 rounded-xl bg-[#541A72] hover:bg-[#3E1156] text-white font-extrabold text-xs cursor-pointer transition-all"
                >
                  Continue to Catalog
                </button>
              </div>
            </div>
          ) : isMissingPath ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Option 1: Locate it */}
              <div
                onClick={() => {
                  markWorkstationSetupCompleted('locate_existing');
                  if (onOpenStorageModal) {
                    onOpenStorageModal('open_existing');
                  } else {
                    locateFileInputRef.current?.click();
                  }
                }}
                className="p-5 rounded-2xl bg-white/95 dark:bg-white/[0.05] border-2 border-[#C8963E] dark:border-[#FFD147]/50 hover:-translate-y-1 transition-all cursor-pointer flex flex-col justify-between space-y-4 group shadow-sm"
              >
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#FEF3C7] dark:bg-[#FFD147]/20 border border-[#D49B27]/40 flex items-center justify-center text-[#92400E] dark:text-[#FFD147]">
                    <FolderSearch className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-[#1A1027] dark:text-white leading-snug">
                      Locate Existing Database
                    </h3>
                    <p className="text-xs text-[#4A3B5C] dark:text-slate-300 mt-1.5 leading-relaxed">
                      Select your existing Library.ulmlib file or the folder where your database was moved.
                    </p>
                  </div>
                </div>
                <span className="text-xs font-extrabold text-[#8A4B00] dark:text-[#FFD147] flex items-center gap-1.5 pt-2">
                  <span>Browse File</span>
                  <ArrowRight className="w-4 h-4" />
                </span>
              </div>

              {/* Option 2: Open library package */}
              <div
                onClick={() => packageInputRef.current?.click()}
                className="p-5 rounded-2xl bg-white/95 dark:bg-white/[0.05] border-2 border-[#541A72]/45 dark:border-purple-400/40 hover:-translate-y-1 transition-all cursor-pointer flex flex-col justify-between space-y-4 group shadow-sm"
              >
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#541A72]/15 dark:bg-purple-500/20 border border-[#541A72]/30 flex items-center justify-center text-[#541A72] dark:text-purple-300">
                    <Package className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-[#1A1027] dark:text-white leading-snug">
                      Restore Library Package (.ulmpack)
                    </h3>
                    <p className="text-xs text-[#4A3B5C] dark:text-slate-300 mt-1.5 leading-relaxed">
                      Restore catalog from a transfer package from USB or another workstation.
                    </p>
                  </div>
                </div>
                <span className="text-xs font-extrabold text-[#541A72] dark:text-purple-300 flex items-center gap-1.5 pt-2">
                  <span>Choose Package</span>
                  <ArrowRight className="w-4 h-4" />
                </span>
              </div>

              {/* Option 3: Start as a beginner */}
              <div
                onClick={() => {
                  markWorkstationSetupCompleted('create_new');
                  if (onOpenStorageModal) {
                    onOpenStorageModal('create_new');
                  } else {
                    handleStartAsBeginner();
                  }
                }}
                className="p-5 rounded-2xl bg-white/95 dark:bg-white/[0.05] border-2 border-emerald-600/45 dark:border-emerald-400/40 hover:-translate-y-1 transition-all cursor-pointer flex flex-col justify-between space-y-4 group shadow-sm"
              >
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-700 dark:text-emerald-300">
                    <FilePlus2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-[#1A1027] dark:text-white leading-snug">
                      Start as a New Library
                    </h3>
                    <p className="text-xs text-[#4A3B5C] dark:text-slate-300 mt-1.5 leading-relaxed">
                      Initialize a fresh library folder, template sheet, and clean database.
                    </p>
                  </div>
                </div>
                <span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5 pt-2">
                  <span>Start Fresh</span>
                  <ArrowRight className="w-4 h-4" />
                </span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Card 1: Start as a new library */}
              <div
                onClick={() => {
                  markWorkstationSetupCompleted('new_library');
                  if (onOpenStorageModal) {
                    onOpenStorageModal('create_new');
                  } else {
                    handleStartAsBeginner();
                  }
                }}
                className="p-5 rounded-2xl bg-white/95 dark:bg-white/[0.05] border-2 border-[#C8963E] dark:border-[#FFD147]/60 shadow-[0_10px_25px_-8px_rgba(180,105,14,0.22)] hover:-translate-y-1 transition-all cursor-pointer flex flex-col justify-between space-y-4 group"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#FEF3C7] to-[#FDE68A] dark:from-[#FFD147]/25 dark:to-[#B8731B]/20 border border-[#D49B27]/50 flex items-center justify-center text-[#92400E] dark:text-[#FFD147]">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-gradient-to-r from-[#541A72] to-[#7A28A3] text-[#FFD147]">
                      Recommended
                    </span>
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-[#1A1027] dark:text-white leading-snug">
                      Start as a New Library
                    </h3>
                    <p className="text-xs text-[#4A3B5C] dark:text-slate-300 mt-1.5 leading-relaxed">
                      Creates the library folder, empty book sheet with headers, and clean catalog starting at Series #1.
                    </p>
                  </div>
                </div>
                <span className="text-xs font-extrabold text-[#8A4B00] dark:text-[#FFD147] flex items-center gap-1.5 pt-2">
                  <span>Start New Library</span>
                  <ArrowRight className="w-4 h-4" />
                </span>
              </div>

              {/* Card 2: Import existing Excel sheet */}
              <div
                onClick={() => existingSheetInputRef.current?.click()}
                className="p-5 rounded-2xl bg-white/95 dark:bg-white/[0.05] border-2 border-emerald-600/50 dark:border-emerald-400/40 hover:-translate-y-1 transition-all cursor-pointer flex flex-col justify-between space-y-4 group shadow-sm"
              >
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/35 flex items-center justify-center text-emerald-700 dark:text-emerald-300">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-[#1A1027] dark:text-white leading-snug">
                      Import My Existing Excel Sheet
                    </h3>
                    <p className="text-xs text-[#4A3B5C] dark:text-slate-300 mt-1.5 leading-relaxed">
                      Choose your existing .xlsx book sheet. Links it, scans all books, and imports them automatically.
                    </p>
                  </div>
                </div>
                <span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5 pt-2">
                  <span>Import Excel Sheet</span>
                  <ArrowRight className="w-4 h-4" />
                </span>
              </div>

              {/* Card 3: Open library package (.ulmpack) */}
              <div
                onClick={() => packageInputRef.current?.click()}
                className="p-5 rounded-2xl bg-white/95 dark:bg-white/[0.05] border-2 border-[#7A28A3]/45 dark:border-purple-400/40 hover:-translate-y-1 transition-all cursor-pointer flex flex-col justify-between space-y-4 group shadow-sm"
              >
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#541A72]/15 dark:bg-purple-500/20 border border-[#541A72]/35 flex items-center justify-center text-[#541A72] dark:text-purple-300">
                    <Package className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-[#1A1027] dark:text-white leading-snug">
                      Restore Library Package (.ulmpack)
                    </h3>
                    <p className="text-xs text-[#4A3B5C] dark:text-slate-300 mt-1.5 leading-relaxed">
                      Transfer package (.ulmpack) from another computer. Restores all books, members, loans, and settings.
                    </p>
                  </div>
                </div>
                <span className="text-xs font-extrabold text-[#541A72] dark:text-purple-300 flex items-center gap-1.5 pt-2">
                  <span>Restore Package</span>
                  <ArrowRight className="w-4 h-4" />
                </span>
              </div>
            </div>
          )}

          {/* Footer Note */}
          <div className="p-4 rounded-2xl bg-white/85 dark:bg-white/[0.04] border border-[#DCCB9E] dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#4A3B5C] dark:text-slate-300">
            <div className="flex items-center gap-2.5">
              <Info className="w-4 h-4 text-[#B8731B] dark:text-[#FFD147] shrink-0" />
              <span>
                Your library data is saved locally on this machine inside{' '}
                <span className="font-mono font-bold text-[#1A1027] dark:text-white">
                  Documents\ULM Library
                </span>
                . Never overwrites an existing catalog.
              </span>
            </div>

            <button
              type="button"
              onClick={handleCloseAndMarkDone}
              className="h-10 px-5 rounded-xl bg-gradient-to-r from-[#2D124D] via-[#431975] to-[#5E239D] text-[#FFD147] border border-[#FFD147]/55 font-extrabold text-xs inline-flex items-center gap-2 shrink-0 cursor-pointer shadow-sm"
            >
              <span>Enter Library Workstation</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
