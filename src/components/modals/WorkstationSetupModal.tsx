import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import {
  FolderOpen,
  FileSpreadsheet,
  ArrowRight,
  AlertCircle,
  Sparkles,
  ArchiveRestore,
  X,
  Check,
  HardDrive,
} from 'lucide-react';
import { ULM_OFFICIAL_CREST_DATA_URI, handleCrestFallback } from '../../constants/ulmOfficialCrest';
import { useInstitutionalIdentity, saveInstitutionalIdentity } from '../../utils/themeTransition';
import { LibraryStorage, reconcileBooksWithLoans } from '../../services/storage';
import { AlmariService } from '../../services/almariService';
import { importBooksInChunks } from '../../services/accessionSeriesEngine';
import { UsbBackupService } from '../../services/usbBackupService';
import {
  syncMasterExcelRegister,
  markWorkstationSetupCompleted,
  importExcelOrCsvToSqlite,
} from '../../services/libraryStorageAndMigration';
import {
  startHeavyTask,
  updateHeavyTaskProgress,
  finishHeavyTask,
  runHeavyLibraryTask,
} from '../../utils/heavyTaskRunner';

export interface WorkstationSetupModalProps {
  isOpen: boolean;
  isResetMode?: boolean;
  onClose?: () => void;
  onNavigateToCatalog?: () => void;
  onCompleteMessage?: (message: string) => void;
  onConfigured?: (
    folderPath: string,
    action?: 'add_manual' | 'import_excel' | 'restore_package' | 'new_library'
  ) => void;
}

const PRESET_REPO_PATHS = [
  'Documents\\ULM Library Data',
  'C:\\ULM_Library_Database',
  'D:\\ULM_Central_Library_Archive',
];

export const WorkstationSetupModal: React.FC<WorkstationSetupModalProps> = ({
  isOpen,
  isResetMode = false,
  onClose,
  onNavigateToCatalog,
  onCompleteMessage,
  onConfigured,
}) => {
  const identity = useInstitutionalIdentity();

  const [repositoryPath, setRepositoryPath] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      return (
        localStorage.getItem('ulm_library_repo_path_v1') ||
        'Documents\\ULM Library Data'
      );
    }
    return 'Documents\\ULM Library Data';
  });

  const [isSelectingFolder, setIsSelectingFolder] = useState(false);
  const [showInlineFolderPicker, setShowInlineFolderPicker] = useState(false);
  const [pathSavedNotice, setPathSavedNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const pathInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && typeof window !== 'undefined' && window.localStorage) {
      const saved = localStorage.getItem('ulm_library_repo_path_v1');
      if (saved) setRepositoryPath(saved);
      setErrorMsg(null);
      setPathSavedNotice(null);
    }
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') return null;

  const persistRepositoryPath = (pathValue: string, mode = 'configured') => {
    const cleanPath = (pathValue || '').trim() || 'Documents\\ULM Library Data';
    setRepositoryPath(cleanPath);
    try {
      localStorage.setItem('ulm_library_repo_path_v1', cleanPath);
      localStorage.setItem(
        'ulm_data_folder_config_v1',
        JSON.stringify({
          mode,
          folderPath: cleanPath,
          configuredAt: new Date().toISOString(),
          isConfigured: true,
        })
      );
      const loc = LibraryStorage.getStorageLocation();
      LibraryStorage.saveStorageLocation({
        ...loc,
        folderPath: cleanPath,
        isConfigured: true,
      });
    } catch {}
    return cleanPath;
  };

  const markSetupFinished = (mode: string, pathValue: string) => {
    const cleanPath = persistRepositoryPath(pathValue, mode);
    try {
      localStorage.setItem('ulm_setup_completed_v1', 'true');
      markWorkstationSetupCompleted(mode);
    } catch {}
    return cleanPath;
  };

  // 1. Browse Folder Handler (Electron IPC -> File System Access API -> Inline Preset/Custom Path Selector)
  const handleBrowseFolder = async () => {
    setIsSelectingFolder(true);
    setErrorMsg(null);
    setPathSavedNotice(null);

    try {
      const win = window as any;

      // A. Check Electron IPC (window.electronAPI?.selectLibraryFolder or window.ulmLibraryApi?.selectCustomDataFolder)
      if (win?.electronAPI?.selectLibraryFolder) {
        const selected = await win.electronAPI.selectLibraryFolder();
        if (selected && typeof selected === 'string') {
          persistRepositoryPath(selected, 'electron_folder');
          setPathSavedNotice(`✓ Repository folder set to ${selected}`);
          return;
        }
      }

      if (win?.ulmLibraryApi?.selectCustomDataFolder) {
        const res = await win.ulmLibraryApi.selectCustomDataFolder();
        if (res && !res.canceled && res.activeDataDir) {
          persistRepositoryPath(res.activeDataDir, 'native_folder');
          setPathSavedNotice(`✓ Repository folder set to ${res.activeDataDir}`);
          return;
        }
      }

      // B. Try Browser File System Access API (showDirectoryPicker)
      if (typeof win?.showDirectoryPicker === 'function') {
        try {
          const dirHandle = await win.showDirectoryPicker({
            mode: 'readwrite',
            startIn: 'documents',
          });
          if (dirHandle && dirHandle.name) {
            win.__ulm_data_dir_handle = dirHandle;
            const fullPath = `Documents\\${dirHandle.name}`;
            persistRepositoryPath(fullPath, 'fs_access_api');
            setPathSavedNotice(`✓ Connected local directory: ${fullPath}`);
            setShowInlineFolderPicker(false);
            return;
          }
        } catch (pickerErr: any) {
          if (pickerErr?.name === 'AbortError') {
            return;
          }
          // If blocked by iframe security policy, fall through to inline Custom Path Editor / Preset Selector
        }
      }

      // C. Fallback in browser / iframe preview: Open Inline Custom Path & Preset Selector
      setShowInlineFolderPicker((prev) => !prev);
      setTimeout(() => {
        pathInputRef.current?.focus();
        pathInputRef.current?.select();
      }, 40);
    } catch (err: any) {
      setShowInlineFolderPicker(true);
    } finally {
      setIsSelectingFolder(false);
    }
  };

  // 2. Card 1 — Initialize Clean Catalog (Start as a New Library)
  const handleInitializeCleanCatalog = async () => {
    if (isBusy) return;
    setIsBusy(true);
    setErrorMsg(null);

    try {
      await runHeavyLibraryTask(
        'Initializing Clean Library Catalog',
        'Resetting accession series to #1 and configuring local repository...',
        async () => {
          // 1. Clear all old/demo catalog, loan, and member arrays to [] across all storage keys & IndexedDB
          await LibraryStorage.clearAllDatabaseStores();

          const emptyJson = '[]';
          const arrayKeysToZero = [
            'ulm_lms_books_v1',
            'ulm_library_books_master_v1',
            'ulm_storage_engine_books_v1',
            'ulm_lms_transactions_v1',
            'ulm_circulation_records_v1',
            'ulm_lms_borrowers_v1',
          ];
          for (const key of arrayKeysToZero) {
            try {
              localStorage.setItem(key, emptyJson);
            } catch {}
          }

          try {
            localStorage.setItem('ulm_almari_placements_master_v3', '{}');
            localStorage.setItem('ulm_highest_serial_number_v1', '0');
            localStorage.setItem('ulm_database_cleared', 'true');
            localStorage.setItem('ulm_initialized_empty', 'true');
          } catch {}

          LibraryStorage.saveBooks([]);
          LibraryStorage.saveBorrowers([]);
          LibraryStorage.saveTransactions([]);

          // 2. Initialize default Almari cupboards registry if empty
          AlmariService.getAlmaris();

          // 3. Save setup completed flag & repository path
          const cleanPath = markSetupFinished('new_library', repositoryPath);

          // 4. Sync empty master register metadata
          try {
            await syncMasterExcelRegister([]);
          } catch {}

          // 5. Dispatch 'ulm-library-sync' so App.tsx and BooksCatalogView immediately show 0 books starting at #1
          window.dispatchEvent(
            new CustomEvent('ulm-library-sync', {
              detail: { books: [], loans: [], timestamp: Date.now() },
            })
          );
          window.dispatchEvent(new CustomEvent('ulm-library-data-changed'));

          onCompleteMessage?.(
            `Clean 0-book catalog initialized at ${cleanPath} (Accession series starting at #1).`
          );
          onNavigateToCatalog?.();
          onClose?.();
        }
      );
    } catch (err: any) {
      setErrorMsg(`Failed to initialize clean catalog: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsBusy(false);
    }
  };

  // 3. Card 2 — Select Excel / CSV File (Import My Existing Excel Sheet)
  const handleSetupExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsBusy(true);
    setErrorMsg(null);

    try {
      await startHeavyTask(
        'Importing Library Catalog Batch',
        `Reading "${file.name}" and allocating sequential Accession & 0092 Barcodes...`,
        100
      );

      const arrayBuffer = await file.arrayBuffer();

      // Clear previous zero-lock flags before importing
      try {
        localStorage.removeItem('ulm_database_cleared');
        localStorage.removeItem('ulm_initialized_empty');
      } catch {}

      // Parse workbook sheets to extract raw rows
      const workbook = XLSX.read(arrayBuffer, {
        type: 'array',
        cellDates: true,
        raw: false,
      });

      const sheetNames = workbook.SheetNames || [];
      if (sheetNames.length === 0) {
        throw new Error('The selected Excel/CSV file contains no worksheets.');
      }

      const headerKeywords = [
        'title', 'book', 'author', 'writer', 'accession', 'acc', 'serial', 'sr',
        'publisher', 'barcode', 'isbn', 'price', 'pages', 'year', 'edition',
        'category', 'subject', 'department', 'call', 'dewey', 'shelf', 'language'
      ];

      let rawRows: Array<Record<string, any>> = [];
      for (const sName of sheetNames) {
        if (sheetNames.length > 1 && /^(instructions|guide|readme|help)$/i.test(sName.trim())) {
          continue;
        }
        const ws = workbook.Sheets[sName];
        if (!ws) continue;

        const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, {
          header: 1,
          raw: false,
          defval: '',
        });
        if (aoa.length === 0) continue;

        let bestHeaderRow = 0;
        let bestScore = 0;
        for (let r = 0; r < Math.min(15, aoa.length); r++) {
          const rowArr = Array.isArray(aoa[r]) ? aoa[r] : [];
          let score = 0;
          for (const cell of rowArr) {
            const cellText = String(cell || '').trim().toLowerCase();
            if (cellText && headerKeywords.some((kw) => cellText.includes(kw))) {
              score++;
            }
          }
          if (score > bestScore) {
            bestScore = score;
            bestHeaderRow = r;
          }
        }

        const parsedRows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, {
          range: bestScore >= 2 ? bestHeaderRow : 0,
          raw: false,
          defval: '',
        });
        if (parsedRows.length > rawRows.length) {
          rawRows = parsedRows;
        }
      }

      if (rawRows.length === 0) {
        throw new Error('No book rows were found in the selected spreadsheet.');
      }

      // Run 250-row non-blocking chunked series allocation & persistence
      const currentBooks = LibraryStorage.getBooks();
      const updatedCatalog = await importBooksInChunks(
        currentBooks,
        rawRows,
        (processed, total) => {
          updateHeavyTaskProgress(
            processed,
            total,
            `Importing "${file.name}": ${processed.toLocaleString()} of ${total.toLocaleString()} rows...`
          );
        }
      );

      // Also ensure IndexedDB / SQLite chunked store is synced if needed
      if (updatedCatalog.length === currentBooks.length) {
        // Fallback to importExcelOrCsvToSqlite if sheet used non-standard headers
        const summary = await importExcelOrCsvToSqlite(arrayBuffer, {
          fileName: file.name,
          chunkSize: 250,
        });
        if (summary.inserted === 0) {
          throw new Error(
            'Could not find valid book titles in the spreadsheet. Please ensure a "Title" or "Book Name" column exists.'
          );
        }
      }

      const finalBooks = await LibraryStorage.loadAllBooksFromDb();
      const reconciled = reconcileBooksWithLoans(finalBooks, LibraryStorage.getTransactions());

      markSetupFinished('import_excel', repositoryPath);

      window.dispatchEvent(
        new CustomEvent('ulm-library-sync', {
          detail: {
            books: reconciled,
            loans: LibraryStorage.getTransactions(),
            timestamp: Date.now(),
          },
        })
      );
      window.dispatchEvent(new CustomEvent('ulm-library-data-changed'));

      onCompleteMessage?.(
        `Successfully imported ${reconciled.length.toLocaleString()} books from "${file.name}".`
      );
      onNavigateToCatalog?.();
      onClose?.();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to import Excel / CSV file.');
    } finally {
      finishHeavyTask();
      setIsBusy(false);
      e.target.value = '';
    }
  };

  // 4. Card 3 — Restore Backup Package (.ulmpack / .zip / .json)
  const handleSetupBackupRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsBusy(true);
    setErrorMsg(null);

    await startHeavyTask(
      'Restoring Library Backup Package',
      `Verifying and restoring "${file.name}"...`,
      100
    );

    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      // Detect whether file is a ZIP archive (PK\x03\x04 magic bytes) or JSON text
      const isZipArchive =
        bytes.length >= 4 &&
        bytes[0] === 0x50 &&
        bytes[1] === 0x4b &&
        bytes[2] === 0x03 &&
        bytes[3] === 0x04;

      try {
        localStorage.removeItem('ulm_database_cleared');
        localStorage.removeItem('ulm_initialized_empty');
      } catch {}

      if (isZipArchive) {
        const restoreRes = await UsbBackupService.importFromUsb(
          bytes,
          'REPLACE',
          (pct, stage) => {
            updateHeavyTaskProgress(pct, 100, `${stage} (${pct}%)`);
          }
        );

        if (!restoreRes.success) {
          throw new Error(restoreRes.message || 'Invalid or corrupted .ulmpack / .zip archive.');
        }

        const restoredBooks = await LibraryStorage.loadAllBooksFromDb();
        const reconciled = reconcileBooksWithLoans(
          restoredBooks,
          LibraryStorage.getTransactions()
        );

        markSetupFinished('restore_package', repositoryPath);

        window.dispatchEvent(
          new CustomEvent('ulm-library-sync', {
            detail: {
              books: reconciled,
              loans: LibraryStorage.getTransactions(),
              timestamp: Date.now(),
            },
          })
        );
        window.dispatchEvent(new CustomEvent('ulm-branding-sync'));
        window.dispatchEvent(new CustomEvent('ulm-library-data-changed'));

        onCompleteMessage?.(restoreRes.message || `Restored library backup from "${file.name}".`);
        onNavigateToCatalog?.();
        onClose?.();
        return;
      }

      // Otherwise parse as JSON / JSON-formatted .ulmpack or .ulmlib
      const text = new TextDecoder('utf-8').decode(bytes);
      let payload: any;
      try {
        payload = JSON.parse(text);
      } catch {
        throw new Error(
          'Malformed backup file: The selected file is neither a valid ZIP (.ulmpack/.zip) nor a valid JSON snapshot.'
        );
      }

      const rawBooks =
        payload.books ||
        payload.catalog ||
        payload.data?.books ||
        (Array.isArray(payload) ? payload : null);

      if (!Array.isArray(rawBooks)) {
        throw new Error(
          'Invalid backup format: No books array found inside the backup file.'
        );
      }

      const rawBorrowers =
        payload.borrowers || payload.members || payload.data?.borrowers || [];
      const rawLoans =
        payload.transactions ||
        payload.loans ||
        payload.circulation ||
        payload.data?.transactions ||
        [];
      const rawAlmaris = payload.almaris || payload.data?.almaris || null;
      const rawPlacements =
        payload.placements || payload.almari_placements || payload.data?.placements || null;
      const rawIdentity =
        payload.institutional_identity || payload.identity || null;

      updateHeavyTaskProgress(
        45,
        100,
        `Restoring ${rawBooks.length.toLocaleString()} books and ${rawBorrowers.length.toLocaleString()} members...`
      );

      if (Array.isArray(rawAlmaris) && rawAlmaris.length > 0) {
        AlmariService.saveAlmaris(rawAlmaris);
      }
      if (rawPlacements && typeof rawPlacements === 'object') {
        try {
          localStorage.setItem(
            'ulm_almari_placements_master_v3',
            JSON.stringify(rawPlacements)
          );
        } catch {}
      }
      if (rawIdentity && typeof rawIdentity === 'object') {
        saveInstitutionalIdentity(rawIdentity);
      }

      if (Array.isArray(rawBorrowers) && rawBorrowers.length > 0) {
        LibraryStorage.saveBorrowers(rawBorrowers);
      }
      if (Array.isArray(rawLoans)) {
        LibraryStorage.saveTransactions(rawLoans);
        try {
          localStorage.setItem('ulm_circulation_records_v1', JSON.stringify(rawLoans));
        } catch {}
      }

      const reconciled = reconcileBooksWithLoans(rawBooks, rawLoans);
      LibraryStorage.saveBooks(reconciled);

      markSetupFinished('restore_package', repositoryPath);

      window.dispatchEvent(
        new CustomEvent('ulm-library-sync', {
          detail: {
            books: reconciled,
            loans: LibraryStorage.getTransactions(),
            timestamp: Date.now(),
          },
        })
      );
      window.dispatchEvent(new CustomEvent('ulm-branding-sync'));
      window.dispatchEvent(new CustomEvent('ulm-library-data-changed'));

      onCompleteMessage?.(
        `Restored ${reconciled.length.toLocaleString()} books, ${rawBorrowers.length.toLocaleString()} members, and ${rawLoans.length.toLocaleString()} loans from "${file.name}".`
      );
      onNavigateToCatalog?.();
      onClose?.();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to restore backup package.');
    } finally {
      finishHeavyTask();
      setIsBusy(false);
      e.target.value = '';
    }
  };

  // 5. Enter Library Workstation & Top-Right Close Button (✕)
  const handleEnterOrCloseWorkstation = () => {
    const cleanPath = markSetupFinished('enter_workstation', repositoryPath);
    if (onConfigured) {
      onConfigured(cleanPath);
    }
    if (onClose) {
      onClose();
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[99995] w-screen h-screen flex items-center justify-center p-4 bg-slate-900/25 dark:bg-[#090514]/78 backdrop-blur-xl backdrop-saturate-[180%] animate-in fade-in duration-200 select-none"
      onClick={handleEnterOrCloseWorkstation}
    >
      {/* Hidden File Inputs for Card 2 (Excel/CSV) and Card 3 (Backup Restore) */}
      <input
        ref={excelInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleSetupExcelImport}
      />
      <input
        ref={backupInputRef}
        type="file"
        accept=".ulmpack,.zip,.json,.ulmlib"
        className="hidden"
        onChange={handleSetupBackupRestore}
      />

      {/* Frosted Crystal Dialog Shell */}
      <div
        className="w-full max-w-[880px] rounded-[28px] overflow-hidden flex flex-col max-h-[92dvh] bg-gradient-to-br from-white/95 via-white/90 to-white/85 dark:from-[#1B1130]/95 dark:via-[#130B24]/95 dark:to-[#0D071A]/95 backdrop-blur-2xl backdrop-saturate-[190%] border border-slate-200/90 dark:border-white/[0.16] shadow-[inset_1.5px_1.5px_2px_rgba(255,255,255,0.85),0_28px_80px_rgba(15,23,42,0.22)] dark:shadow-[inset_1.5px_1.5px_2px_rgba(255,255,255,0.20),0_28px_80px_rgba(0,0,0,0.80)] text-slate-900 dark:text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Amethyst-to-Gold Refractive Highlight Line */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#581C87] via-amber-400 to-[#7E22CE] shrink-0" />

        {/* Scrollable Body */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6 sm:p-7 space-y-5">
          {/* 1. LIVE-SYNCED HEADER */}
          <div className="flex items-start justify-between gap-4 pb-5 border-b border-slate-200/80 dark:border-white/[0.10]">
            <div className="flex items-start gap-4 min-w-0">
              {/* Custom or Official Crest Emblem */}
              <div className="w-14 h-14 rounded-2xl p-2 bg-amber-500/15 border border-amber-400/40 flex items-center justify-center shrink-0 shadow-inner">
                <img
                  src={identity.customCrestUrl || ULM_OFFICIAL_CREST_DATA_URI}
                  alt={identity.universityName}
                  onError={handleCrestFallback}
                  className="w-full h-full object-contain drop-shadow-sm select-none"
                  draggable={false}
                />
              </div>

              <div className="space-y-1 min-w-0">
                {/* Architectural Status Micro-Tag */}
                <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 font-['JetBrains_Mono'] text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-300">
                  <span className="w-1.5 h-1.5 rounded-[1.5px] bg-amber-500 dark:bg-amber-400 shrink-0" />
                  <span>
                    {isResetMode
                      ? 'POST-RESET WORKSTATION INITIALIZATION'
                      : 'WORKSTATION SETUP & ONBOARDING'}
                  </span>
                </div>

                {/* Live Institution Name */}
                <h2 className="font-['Playfair_Display'] text-[22px] font-extrabold text-slate-900 dark:text-white leading-tight truncate">
                  {identity.universityName}
                </h2>

                {/* Live Library Department Subtitle */}
                <p className="font-['JetBrains_Mono'] text-[10.5px] font-semibold uppercase tracking-[0.14em] text-amber-600 dark:text-amber-300/90 truncate">
                  {identity.libraryDepartmentName.toUpperCase()} · WORKSTATION SETUP SUITE
                </p>

                <p className="text-[12.5px] text-slate-600 dark:text-slate-300/90 leading-relaxed pt-0.5">
                  Welcome to the official offline campus library workstation. Choose how you would like to initialize your local catalog and live Master Excel Register below.
                </p>
              </div>
            </div>

            {/* Crisp Top-Right ✕ Close Button */}
            <button
              type="button"
              onClick={handleEnterOrCloseWorkstation}
              title="Close and Enter Library Workstation"
              aria-label="Close setup modal"
              style={{ padding: 0, width: '36px', height: '36px', minWidth: '36px', minHeight: '36px' }}
              className="w-9 h-9 p-0 rounded-xl bg-slate-900/[0.05] dark:bg-white/[0.06] hover:bg-rose-500/15 hover:text-rose-500 hover:border-rose-500/35 border border-slate-200/80 dark:border-white/[0.14] text-slate-700 dark:text-slate-200 flex items-center justify-center transition-all cursor-pointer shrink-0"
            >
              <X className="w-4 h-4 stroke-[2.25] shrink-0" />
            </button>
          </div>

          {/* 2. CLEAN REPOSITORY PATH BAR (Inline Folder Icon + Working Browse Folder) */}
          <div className="p-4 rounded-[20px] bg-white/80 dark:bg-white/[0.035] border border-slate-200/85 dark:border-white/[0.12] space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <label
                htmlFor="ulm-setup-repo-path-input"
                className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.13em] text-slate-500 dark:text-slate-400"
              >
                <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" />
                <span>DESIGNATED LIBRARY REPOSITORY PATH</span>
              </label>

              {pathSavedNotice && (
                <span className="inline-flex items-center gap-1 text-[11px] font-['JetBrains_Mono'] font-semibold text-emerald-600 dark:text-emerald-400">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span>{pathSavedNotice}</span>
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <input
                id="ulm-setup-repo-path-input"
                ref={pathInputRef}
                type="text"
                value={repositoryPath}
                onChange={(e) => {
                  setRepositoryPath(e.target.value);
                  try {
                    localStorage.setItem('ulm_library_repo_path_v1', e.target.value);
                  } catch {}
                }}
                placeholder="Documents\ULM Library Data"
                className="flex-1 font-['JetBrains_Mono'] text-[12.5px] h-10 px-3.5 rounded-xl bg-white dark:bg-[#110A20]/90 border border-slate-200/90 dark:border-white/[0.14] text-slate-900 dark:text-white focus:outline-none focus:border-amber-500/70"
              />

              <button
                type="button"
                onClick={handleBrowseFolder}
                disabled={isSelectingFolder}
                className="h-10 px-4 rounded-xl bg-slate-900/[0.05] hover:bg-slate-900/[0.09] dark:bg-white/[0.07] dark:hover:bg-white/[0.12] border border-slate-200/90 dark:border-white/[0.15] text-slate-800 dark:text-white text-[12px] font-bold inline-flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0"
              >
                <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" />
                <span>{isSelectingFolder ? 'Selecting...' : 'Browse Folder'}</span>
              </button>
            </div>

            {/* Inline Custom Path & Preset Selector (Opens smoothly when native folder dialog is blocked in browser/iframe preview) */}
            {showInlineFolderPicker && (
              <div className="pt-2.5 mt-2 border-t border-slate-200/70 dark:border-white/[0.10] flex flex-wrap items-center justify-between gap-2 animate-in fade-in duration-150">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10.5px] font-['JetBrains_Mono'] uppercase tracking-wider text-slate-500 dark:text-slate-400 mr-1 flex items-center gap-1">
                    <HardDrive className="w-3.5 h-3.5 text-amber-500" />
                    Presets:
                  </span>
                  {PRESET_REPO_PATHS.map((preset) => {
                    const isCurrent = repositoryPath.trim() === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          persistRepositoryPath(preset, 'preset_selected');
                          setPathSavedNotice(`✓ Saved: ${preset}`);
                        }}
                        className={`h-8 px-2.5 rounded-lg font-['JetBrains_Mono'] text-[11px] font-semibold border transition-all cursor-pointer ${
                          isCurrent
                            ? 'bg-amber-500/15 border-amber-500/50 text-amber-700 dark:text-amber-300'
                            : 'bg-white/70 dark:bg-white/[0.04] border-slate-200/80 dark:border-white/[0.12] text-slate-700 dark:text-slate-300 hover:border-amber-500/40'
                        }`}
                      >
                        {preset}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const saved = persistRepositoryPath(repositoryPath, 'custom_path_confirmed');
                    setPathSavedNotice(`✓ Path confirmed: ${saved}`);
                    setShowInlineFolderPicker(false);
                  }}
                  className="h-8 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Confirm Path</span>
                </button>
              </div>
            )}
          </div>

          {/* 3. BALANCED 3-CARD INITIALIZATION GRID */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* CARD 1 (Amber Accent): Start as a New Library */}
            <div
              onClick={handleInitializeCleanCatalog}
              className="rounded-[22px] p-5 bg-white/75 dark:bg-white/[0.035] border border-amber-500/45 dark:border-amber-400/35 hover:border-amber-500 dark:hover:border-amber-400 flex flex-col justify-between gap-4 transition-all hover:-translate-y-[2px] shadow-sm cursor-pointer"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/35 flex items-center justify-center text-amber-600 dark:text-amber-300 shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-500/12 border border-amber-500/35 font-['JetBrains_Mono'] text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                    <span className="w-1.5 h-1.5 rounded-[1.5px] bg-amber-500 shrink-0" />
                    <span>RECOMMENDED</span>
                  </span>
                </div>

                <div>
                  <h3 className="font-['Plus_Jakarta_Sans'] text-[15.5px] font-extrabold text-slate-900 dark:text-white leading-snug">
                    Start as a New Library
                  </h3>
                  <p className="text-[12px] text-slate-600 dark:text-slate-300/85 mt-1.5 leading-relaxed">
                    Initialize a clean 0-book institutional catalog with continuous accession series starting at{' '}
                    <span className="font-['JetBrains_Mono'] font-bold text-amber-700 dark:text-amber-300">
                      #1
                    </span>{' '}
                    and auto-synced Master Excel Register.
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={isBusy}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleInitializeCleanCatalog();
                }}
                style={{ color: '#FFFFFF' }}
                className="w-full h-10 px-3.5 rounded-xl whitespace-nowrap bg-gradient-to-r from-[#B8731B] to-[#D49B27] hover:from-[#9E6012] hover:to-[#B8731B] text-white font-bold text-[12px] flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <span>Initialize Clean Catalog</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </button>
            </div>

            {/* CARD 2 (Emerald Accent): Import My Existing Excel Sheet */}
            <div
              onClick={() => excelInputRef.current?.click()}
              className="rounded-[22px] p-5 bg-white/75 dark:bg-white/[0.035] border border-slate-200/85 dark:border-white/[0.12] hover:border-emerald-500/60 dark:hover:border-emerald-400/50 flex flex-col justify-between gap-4 transition-all hover:-translate-y-[2px] shadow-sm cursor-pointer"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/35 flex items-center justify-center text-emerald-600 dark:text-emerald-300 shrink-0">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-500/12 border border-emerald-500/35 font-['JetBrains_Mono'] text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                    <span className="w-1.5 h-1.5 rounded-[1.5px] bg-emerald-500 shrink-0" />
                    <span>EXCEL / CSV</span>
                  </span>
                </div>

                <div>
                  <h3 className="font-['Plus_Jakarta_Sans'] text-[15.5px] font-extrabold text-slate-900 dark:text-white leading-snug">
                    Import My Existing Excel Sheet
                  </h3>
                  <p className="text-[12px] text-slate-600 dark:text-slate-300/85 mt-1.5 leading-relaxed">
                    Upload your existing{' '}
                    <span className="font-['JetBrains_Mono'] font-bold">.xlsx</span> or{' '}
                    <span className="font-['JetBrains_Mono'] font-bold">.csv</span> register. Streams up to 100,000+ books with automatic 13-digit Code-128 barcodes.
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={isBusy}
                onClick={(e) => {
                  e.stopPropagation();
                  excelInputRef.current?.click();
                }}
                style={{ color: '#FFFFFF' }}
                className="w-full h-10 px-3.5 rounded-xl whitespace-nowrap bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[12px] flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <span>Select Excel / CSV File</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </button>
            </div>

            {/* CARD 3 (Purple Accent): Restore Library Package (.ulmpack) */}
            <div
              onClick={() => backupInputRef.current?.click()}
              className="rounded-[22px] p-5 bg-white/75 dark:bg-white/[0.035] border border-slate-200/85 dark:border-white/[0.12] hover:border-purple-500/60 dark:hover:border-purple-400/50 flex flex-col justify-between gap-4 transition-all hover:-translate-y-[2px] shadow-sm cursor-pointer"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="w-11 h-11 rounded-2xl bg-purple-500/15 border border-purple-500/35 flex items-center justify-center text-purple-700 dark:text-purple-300 shrink-0">
                    <ArchiveRestore className="w-5 h-5" />
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-purple-500/12 border border-purple-500/35 font-['JetBrains_Mono'] text-[10px] font-semibold uppercase tracking-wider text-purple-700 dark:text-purple-300">
                    <span className="w-1.5 h-1.5 rounded-[1.5px] bg-purple-500 shrink-0" />
                    <span>BACKUP RESTORE</span>
                  </span>
                </div>

                <div>
                  <h3 className="font-['Plus_Jakarta_Sans'] text-[15.5px] font-extrabold text-slate-900 dark:text-white leading-snug">
                    Restore Library Package (.ulmpack)
                  </h3>
                  <p className="text-[12px] text-slate-600 dark:text-slate-300/85 mt-1.5 leading-relaxed">
                    Restore a verified{' '}
                    <span className="font-['JetBrains_Mono'] font-bold">.ulmpack</span>,{' '}
                    <span className="font-['JetBrains_Mono'] font-bold">.zip</span>, or{' '}
                    <span className="font-['JetBrains_Mono'] font-bold">.json</span> snapshot including books, members, loans, and almari shelves.
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={isBusy}
                onClick={(e) => {
                  e.stopPropagation();
                  backupInputRef.current?.click();
                }}
                style={{ color: '#FFFFFF' }}
                className="w-full h-10 px-3.5 rounded-xl whitespace-nowrap bg-[#581C87] hover:bg-[#6B21A8] text-white font-bold text-[12px] flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <span>Restore Backup</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </button>
            </div>
          </div>

          {/* Inline Error Banner (Never Fails Silently) */}
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/35 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-2.5 min-w-0">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span className="break-words">{errorMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrorMsg(null)}
                style={{ padding: 0, width: '24px', height: '24px', minWidth: '24px', minHeight: '24px' }}
                className="w-6 h-6 p-0 rounded-lg hover:bg-rose-500/15 flex items-center justify-center text-rose-500 cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* 4. CLEAN FOOTER BAR */}
        <div className="px-6 py-4 bg-slate-900/[0.03] dark:bg-black/30 border-t border-slate-200/80 dark:border-white/[0.10] flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="inline-flex items-center gap-2 text-[11.5px] text-emerald-600 dark:text-emerald-400 font-medium">
            <span className="w-2 h-2 rounded-[2px] bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.75)] shrink-0" />
            <span>100% Offline Local Storage · Never overwrites an existing catalog</span>
          </div>

          <button
            type="button"
            onClick={handleEnterOrCloseWorkstation}
            style={{ color: '#FFFFFF' }}
            className="h-10 px-5 rounded-xl bg-gradient-to-r from-[#581C87] via-[#7E22CE] to-amber-500 hover:brightness-110 text-white font-bold text-[12.5px] shadow-md inline-flex items-center gap-2 transition-all cursor-pointer shrink-0"
          >
            <span>Enter Library Workstation</span>
            <ArrowRight className="w-4 h-4 shrink-0" />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default WorkstationSetupModal;
