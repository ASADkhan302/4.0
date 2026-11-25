import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import * as XLSX from 'xlsx';
import {
  FolderOpen,
  FileSpreadsheet,
  ArrowRight,
  AlertCircle,
  Sparkles,
  ArchiveRestore,
  X,
} from 'lucide-react';
import { ULM_OFFICIAL_CREST_DATA_URI, handleCrestFallback } from '../../constants/ulmOfficialCrest';
import { useInstitutionalIdentity, saveInstitutionalIdentity } from '../../utils/themeTransition';
import { LibraryStorage, reconcileBooksWithLoans } from '../../services/storage';
import { AlmariService } from '../../services/almariService';
import { notifyGlassToast } from '../ui/LiquidGlassToast';
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
import {
  saveRepoDirHandle,
} from '../../services/desktopBridge';
import { idbSet } from '../../services/indexedDbStorage';
import { syncMasterExcelToDisk } from '../../services/masterExcelSync';

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

export const WorkstationSetupModal: React.FC<WorkstationSetupModalProps> = ({
  isOpen,
  onClose,
  onNavigateToCatalog,
  onCompleteMessage,
  onConfigured,
}) => {
  const identity = useInstitutionalIdentity();

  const [repoPath, setRepoPath] = useState<string>(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return (
          localStorage.getItem('ulm_library_repo_path_v1') ||
          'Documents\\ULM Library Data'
        );
      }
    } catch {
      // ignore storage restrictions
    }
    return 'Documents\\ULM Library Data';
  });

  const [isSelectingFolder, setIsSelectingFolder] = useState(false);
  const [pathSavedNotice, setPathSavedNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const pathInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);

  // Attach webkitdirectory & directory directly to the real DOM input
  useEffect(() => {
    const el = folderInputRef.current;
    if (el) {
      (el as any).webkitdirectory = true;
      el.setAttribute('webkitdirectory', '');
      el.setAttribute('directory', '');
    }
  }, [isOpen]);

  // Listen for live path updates from System Settings (never overwrite user edits back to default)
  useEffect(() => {
    const onRepoPathSync = (ev: Event) => {
      const next = (ev as CustomEvent<{ path?: string }>).detail?.path;
      if (typeof next === 'string' && next.trim()) {
        setRepoPath((prev) => (prev === next ? prev : next));
      }
    };
    window.addEventListener('ulm-repo-path-sync', onRepoPathSync);
    return () => window.removeEventListener('ulm-repo-path-sync', onRepoPathSync);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = localStorage.getItem('ulm_library_repo_path_v1');
        if (saved && saved.trim()) {
          setRepoPath(saved);
        }
      }
    } catch {
      // ignore storage restrictions
    }
    setErrorMsg(null);
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') return null;

  const commitRepoPath = (
    rawPath: string,
    options?: { isTyping?: boolean; mode?: string; showBadge?: boolean }
  ) => {
    const isTyping = options?.isTyping === true;
    const clean = (rawPath || '').trim() || 'Documents\\ULM Library Data';
    setRepoPath(isTyping ? rawPath : clean);
    try {
      localStorage.setItem('ulm_library_repo_path_v1', clean);
      localStorage.setItem(
        'ulm_data_folder_config_v1',
        JSON.stringify({
          mode: options?.mode || 'configured',
          folderPath: clean,
          configuredAt: new Date().toISOString(),
          isConfigured: true,
        })
      );
      const loc = LibraryStorage.getStorageLocation();
      LibraryStorage.saveStorageLocation({
        ...loc,
        folderPath: clean,
        isConfigured: true,
      });
    } catch {}
    window.dispatchEvent(new CustomEvent('ulm-repo-path-sync', { detail: { path: clean } }));
    if (options?.showBadge) {
      setPathSavedNotice('✓ Path updated');
    }
    return clean;
  };

  const markSetupFinished = (mode: string, pathValue: string) => {
    const cleanPath = commitRepoPath(pathValue, { mode });
    try {
      localStorage.setItem('ulm_setup_completed_v1', 'true');
      markWorkstationSetupCompleted(mode);
    } catch {}
    // Immediately write initial Master Excel (.xlsx) & AutoBackup (.json) into chosen folder
    void syncMasterExcelToDisk(
      LibraryStorage.getBooks(),
      LibraryStorage.getBorrowers(),
      LibraryStorage.getTransactions(),
      AlmariService.getAlmaris()
    );
    return cleanPath;
  };

  const applySelectedFolderPath = async (selectedPath: string, mode = 'folder_selected') => {
    const cleanPath = commitRepoPath(selectedPath, { mode, showBadge: true });
    const syncRes = await syncMasterExcelToDisk(
      LibraryStorage.getBooks(),
      LibraryStorage.getBorrowers(),
      LibraryStorage.getTransactions(),
      AlmariService.getAlmaris()
    ).catch(() => ({ excelWritten: false, backupWritten: false }));
    setPathSavedNotice(
      syncRes.excelWritten
        ? `✓ Path updated · Master Excel synced (${cleanPath})`
        : `✓ Path updated · ${cleanPath}`
    );
    notifyGlassToast({
      type: 'success',
      title: 'Repository Folder Updated',
      message: syncRes.excelWritten
        ? 'Path saved and Master Excel synced.'
        : 'Library repository folder updated.',
      meta: cleanPath,
    });
  };

  // 1. Synchronous Browse Folder Handler (Zero await before .click() so Chrome keeps user-gesture!)
  const handleBrowseFolder = () => {
    setErrorMsg(null);
    setPathSavedNotice(null);

    // 1. Native Windows Desktop .exe (C# WPF + WebView2 / Electron)
    const nativeApi = (window as any).desktopAPI || (window as any).electronAPI;
    if (nativeApi?.selectLibraryFolder || nativeApi?.selectFolder) {
      setIsSelectingFolder(true);
      const call = nativeApi.selectLibraryFolder
        ? nativeApi.selectLibraryFolder()
        : nativeApi.selectFolder();
      Promise.resolve(call)
        .then((res: any) => {
          const selectedPath =
            typeof res === 'string'
              ? res.trim()
              : res && !res.canceled && typeof res.path === 'string'
              ? res.path.trim()
              : '';
          if (selectedPath) {
            void applySelectedFolderPath(selectedPath, 'desktop_ipc_folder');
          }
        })
        .catch(() => {})
        .finally(() => setIsSelectingFolder(false));
      return;
    }

    if ((window as any).ulmLibraryApi?.selectCustomDataFolder) {
      setIsSelectingFolder(true);
      Promise.resolve((window as any).ulmLibraryApi.selectCustomDataFolder())
        .then((res: any) => {
          if (res && !res.canceled && res.activeDataDir) {
            void applySelectedFolderPath(res.activeDataDir, 'native_folder');
          }
        })
        .catch(() => {})
        .finally(() => setIsSelectingFolder(false));
      return;
    }

    // 2. Standalone Browser Tab (NOT inside a cross-origin iframe)
    let isInIframe = true;
    try {
      isInIframe = window.self !== window.top;
    } catch {
      isInIframe = true;
    }
    if (!isInIframe && typeof (window as any).showDirectoryPicker === 'function') {
      setIsSelectingFolder(true);
      (window as any)
        .showDirectoryPicker({ mode: 'readwrite' })
        .then(async (dirHandle: any) => {
          if (dirHandle?.name) {
            await idbSet('ulm_repo_dir_handle', dirHandle).catch(() => {});
            await saveRepoDirHandle(dirHandle).catch(() => {});
            await applySelectedFolderPath(`Documents\\${dirHandle.name}`, 'fs_access_api');
          }
        })
        .catch(() => {})
        .finally(() => setIsSelectingFolder(false));
      return;
    }

    // 3. Inside Google AI Studio Preview Iframe (or Firefox/Safari):
    // Fire .click() SYNCHRONOUSLY inside the click handler with ZERO await!
    const el = folderInputRef.current;
    if (el) {
      (el as any).webkitdirectory = true;
      el.setAttribute('webkitdirectory', '');
      el.setAttribute('directory', '');
      el.value = '';
      el.click();
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
            'ulm_lms_members_v1',
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

          // 2. Save setup completed flag & repository path (do NOT force-reseed Almaris/Groups when factory-empty)
          const cleanPath = markSetupFinished('new_library', repoPath);

          // 3. Sync empty master register metadata
          try {
            await syncMasterExcelRegister([]);
          } catch {}

          // 4. Dispatch 'ulm-library-sync' so App.tsx and BooksCatalogView immediately show 0 books starting at #1
          window.dispatchEvent(
            new CustomEvent('ulm-library-sync', {
              detail: {
                books: [],
                members: [],
                loans: [],
                almaris: AlmariService.getAlmaris(),
                bookGroups: AlmariService.getGroups(),
                timestamp: Date.now(),
              },
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
      const msg = `Failed to initialize clean catalog: ${err?.message || 'Unknown error'}`;
      setErrorMsg(msg);
      notifyGlassToast({
        type: 'danger',
        title: 'Initialization Failed',
        message: err?.message || 'Could not initialize clean catalog.',
      });
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

      markSetupFinished('import_excel', repoPath);

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
      const msg = err?.message || 'Failed to import Excel / CSV file.';
      setErrorMsg(msg);
      notifyGlassToast({
        type: 'danger',
        title: 'Excel Import Failed',
        message: msg,
        meta: file.name,
      });
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
        localStorage.removeItem('ulm_factory_reset_empty_v1');
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

        markSetupFinished('restore_package', repoPath);

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

      markSetupFinished('restore_package', repoPath);

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
      const msg = err?.message || 'Failed to restore backup package.';
      setErrorMsg(msg);
      notifyGlassToast({
        type: 'danger',
        title: 'Backup Restore Failed',
        message: msg,
        meta: file.name,
      });
    } finally {
      finishHeavyTask();
      setIsBusy(false);
      e.target.value = '';
    }
  };

  // 5. Enter Library Workstation & Top-Right Close Button (✕)
  const handleEnterOrCloseWorkstation = () => {
    const cleanPath = markSetupFinished('enter_workstation', repoPath);
    if (onConfigured) {
      onConfigured(cleanPath);
    }
    if (onClose) {
      onClose();
    }
  };

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.32 }}
      className="fixed inset-0 z-[99998] w-screen h-screen flex items-center justify-center p-5 bg-slate-900/25 dark:bg-[#080412]/72 backdrop-blur-2xl backdrop-saturate-[185%] select-none"
      onClick={handleEnterOrCloseWorkstation}
    >
      {/* Visually-Hidden Universal Windows File Explorer Folder Picker (webkitdirectory attached via useEffect) */}
      <input
        ref={folderInputRef}
        type="file"
        multiple
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        onChange={(e) => {
          const files = e.target.files;
          if (files && files.length > 0) {
            const relPath = (files[0] as any).webkitRelativePath || '';
            const folderName = relPath.split('/')[0] || 'ULM Library Data';
            void applySelectedFolderPath(`Documents\\${folderName}`, 'explorer_webkitdirectory');
          } else {
            setPathSavedNotice(null);
            setErrorMsg('Empty folder selected in browser preview. Type your desired path directly above (native Explorer supports empty folders in the Desktop .exe).');
          }
          e.target.value = '';
        }}
      />

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

      {/* Minimal Frosted Crystal Liquid-Glass Dialog Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        className="ulm-preserve-glass w-full max-w-[860px] rounded-[28px] p-7 sm:p-8 space-y-6 relative overflow-hidden max-h-[92dvh] overflow-y-auto custom-scrollbar bg-gradient-to-br from-white/88 via-white/78 to-white/68 dark:from-[#1F1438]/78 dark:via-[#150D29]/72 dark:to-[#0E081D]/78 backdrop-blur-2xl backdrop-saturate-[190%] border border-white/80 dark:border-white/[0.16] shadow-[inset_1.5px_1.5px_2px_rgba(255,255,255,0.80),0_32px_90px_rgba(15,23,42,0.18)] dark:shadow-[inset_1.5px_1.5px_2px_rgba(255,255,255,0.20),0_32px_90px_rgba(0,0,0,0.75)] text-slate-900 dark:text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. MINIMAL CLEAN HEADER */}
        <div className="flex items-center justify-between gap-4 pb-5 border-b border-slate-200/70 dark:border-white/[0.09]">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-14 h-14 rounded-2xl p-2 bg-amber-500/12 border border-amber-400/35 flex items-center justify-center shrink-0">
              <img
                src={identity.customCrestUrl || ULM_OFFICIAL_CREST_DATA_URI}
                alt={identity.universityName}
                onError={handleCrestFallback}
                className="w-full h-full object-contain drop-shadow-sm select-none"
                draggable={false}
              />
            </div>

            <div className="min-w-0">
              <h2 className="font-['Playfair_Display'] text-[23px] font-extrabold text-slate-900 dark:text-white leading-tight truncate">
                {identity.universityName}
              </h2>
              <p className="font-['JetBrains_Mono'] text-[10.5px] font-semibold tracking-[0.16em] text-amber-700 dark:text-amber-300 mt-1 truncate">
                {identity.libraryDepartmentName.toUpperCase()} · WORKSTATION SETUP
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleEnterOrCloseWorkstation}
            title="Close and Enter Library Workstation"
            aria-label="Close setup modal"
            style={{ padding: 0, width: '36px', height: '36px', minWidth: '36px', minHeight: '36px' }}
            className="w-9 h-9 p-0 !rounded-xl bg-slate-900/[0.05] dark:bg-white/[0.06] hover:bg-rose-500/15 hover:text-rose-500 hover:border-rose-500/35 border border-slate-200/80 dark:border-white/[0.14] text-slate-700 dark:text-slate-200 flex items-center justify-center transition-all cursor-pointer shrink-0"
          >
            <X className="w-4 h-4 stroke-[2.25] shrink-0" />
          </button>
        </div>

        {/* 2. MINIMAL REPOSITORY PATH CARD */}
        <div className="rounded-[22px] p-5 bg-white/65 dark:bg-white/[0.035] border border-slate-200/80 dark:border-white/[0.11] space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <label
              htmlFor="ulm-setup-repo-path-input"
              className="!flex !mb-0 items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-300"
            >
              <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" />
              <span>DESIGNATED LIBRARY REPOSITORY PATH</span>
            </label>

            {pathSavedNotice && (
              <span className="font-['JetBrains_Mono'] text-[10.5px] font-semibold text-emerald-600 dark:text-emerald-400">
                {pathSavedNotice}
              </span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <input
              id="ulm-setup-repo-path-input"
              ref={pathInputRef}
              type="text"
              value={repoPath}
              onChange={(e) => {
                commitRepoPath(e.target.value, { isTyping: true, mode: 'manual_input' });
                if (e.target.value.trim()) {
                  setPathSavedNotice('✓ Path updated');
                }
              }}
              onBlur={() => {
                if (!repoPath.trim()) {
                  commitRepoPath('Documents\\ULM Library Data', { mode: 'manual_input' });
                }
              }}
              placeholder="Documents\ULM Library Data"
              className="ulm-compact-control flex-1 h-11 min-h-[44px] py-0 px-4 !rounded-xl bg-white/90 dark:bg-[#0D071B]/80 border border-slate-300/85 dark:border-white/[0.14] font-['JetBrains_Mono'] text-[13px] leading-normal text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-amber-400/75 transition-colors select-text"
            />

            <button
              type="button"
              onClick={handleBrowseFolder}
              disabled={isSelectingFolder}
              style={{ height: '44px', minHeight: '44px' }}
              className="h-11 px-5 !rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/45 text-amber-700 dark:text-amber-300 font-semibold text-[12.5px] inline-flex items-center justify-center gap-2 whitespace-nowrap transition-all cursor-pointer shrink-0"
            >
              <FolderOpen className="w-4 h-4 shrink-0" />
              <span>{isSelectingFolder ? 'Opening Explorer...' : 'Browse Folder'}</span>
            </button>
          </div>
        </div>

        {/* 3. SPACIOUS 3-CARD INITIALIZATION GRID */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
          {/* CARD 1 (Amber Accent): Start as a New Library */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            onClick={handleInitializeCleanCatalog}
            className="rounded-[22px] p-5 bg-white/70 dark:bg-white/[0.035] hover:bg-white/90 dark:hover:bg-white/[0.06] border border-slate-200/85 dark:border-white/[0.12] hover:border-amber-400/50 flex flex-col justify-between gap-5 transition-all duration-200 hover:-translate-y-1 cursor-pointer"
          >
            <div className="space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/35 flex items-center justify-center text-amber-600 dark:text-amber-300 shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-500/12 border border-amber-500/30 font-['JetBrains_Mono'] text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300 leading-none">
                  RECOMMENDED
                </span>
              </div>

              <div>
                <h3 className="font-['Plus_Jakarta_Sans'] text-[15px] font-extrabold text-slate-900 dark:text-white leading-snug">
                  Start as a New Library
                </h3>
                <p className="text-[12px] text-slate-600 dark:text-slate-300/85 mt-1.5 leading-relaxed">
                  Start a clean 0-book catalog with continuous accession series at{' '}
                  <span className="font-['JetBrains_Mono'] font-bold text-amber-700 dark:text-amber-300">
                    #1
                  </span>{' '}
                  and live Master Excel sync.
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
              className="h-10 w-full px-3.5 rounded-xl whitespace-nowrap bg-gradient-to-r from-[#B8731B] to-[#D49B27] hover:from-[#9E6012] hover:to-[#B8731B] text-white font-semibold text-[12.5px] flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <span>Initialize Clean Catalog</span>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </button>
          </motion.div>

          {/* CARD 2 (Emerald Accent): Import My Existing Excel Sheet */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.14 }}
            onClick={() => excelInputRef.current?.click()}
            className="rounded-[22px] p-5 bg-white/70 dark:bg-white/[0.035] hover:bg-white/90 dark:hover:bg-white/[0.06] border border-slate-200/85 dark:border-white/[0.12] hover:border-emerald-500/55 dark:hover:border-emerald-400/50 flex flex-col justify-between gap-5 transition-all duration-200 hover:-translate-y-1 cursor-pointer"
          >
            <div className="space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/35 flex items-center justify-center text-emerald-600 dark:text-emerald-300 shrink-0">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-500/12 border border-emerald-500/30 font-['JetBrains_Mono'] text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 leading-none">
                  EXCEL / CSV
                </span>
              </div>

              <div>
                <h3 className="font-['Plus_Jakarta_Sans'] text-[15px] font-extrabold text-slate-900 dark:text-white leading-snug">
                  Import My Existing Excel Sheet
                </h3>
                <p className="text-[12px] text-slate-600 dark:text-slate-300/85 mt-1.5 leading-relaxed">
                  Import your{' '}
                  <span className="font-['JetBrains_Mono'] font-bold">.xlsx</span> or{' '}
                  <span className="font-['JetBrains_Mono'] font-bold">.csv</span> register with automatic 13-digit Code-128 barcodes.
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
              className="h-10 w-full px-3.5 rounded-xl whitespace-nowrap bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[12.5px] flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <span>Select Excel / CSV File</span>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </button>
          </motion.div>

          {/* CARD 3 (Purple Accent): Restore Library Package (.ulmpack) */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.20 }}
            onClick={() => backupInputRef.current?.click()}
            className="rounded-[22px] p-5 bg-white/70 dark:bg-white/[0.035] hover:bg-white/90 dark:hover:bg-white/[0.06] border border-slate-200/85 dark:border-white/[0.12] hover:border-purple-500/55 dark:hover:border-purple-400/50 flex flex-col justify-between gap-5 transition-all duration-200 hover:-translate-y-1 cursor-pointer"
          >
            <div className="space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="w-11 h-11 rounded-2xl bg-purple-500/15 border border-purple-500/35 flex items-center justify-center text-purple-700 dark:text-purple-300 shrink-0">
                  <ArchiveRestore className="w-5 h-5" />
                </div>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-purple-500/12 border border-purple-500/30 font-['JetBrains_Mono'] text-[10px] font-semibold uppercase tracking-wider text-purple-700 dark:text-purple-300 leading-none">
                  BACKUP RESTORE
                </span>
              </div>

              <div>
                <h3 className="font-['Plus_Jakarta_Sans'] text-[15px] font-extrabold text-slate-900 dark:text-white leading-snug">
                  Restore Library Package (.ulmpack)
                </h3>
                <p className="text-[12px] text-slate-600 dark:text-slate-300/85 mt-1.5 leading-relaxed">
                  Restore a verified{' '}
                  <span className="font-['JetBrains_Mono'] font-bold">.ulmpack</span>,{' '}
                  <span className="font-['JetBrains_Mono'] font-bold">.zip</span>, or{' '}
                  <span className="font-['JetBrains_Mono'] font-bold">.json</span> library snapshot with all records intact.
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
              className="h-10 w-full px-3.5 rounded-xl whitespace-nowrap bg-[#581C87] hover:bg-[#6B21A8] text-white font-semibold text-[12.5px] flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <span>Restore Backup</span>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </button>
          </motion.div>
        </div>

        {/* Inline Error Banner (Never Fails Silently) */}
        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/35 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center justify-between gap-3">
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

        {/* 4. CLEAN MINIMAL FOOTER */}
        <div className="pt-2 flex items-center justify-end">
          <button
            type="button"
            onClick={handleEnterOrCloseWorkstation}
            style={{ color: '#FFFFFF' }}
            className="h-11 px-6 rounded-xl bg-gradient-to-r from-[#6B21A8] via-[#7E22CE] to-amber-500 hover:opacity-95 text-white font-bold text-[13px] shadow-lg inline-flex items-center justify-center gap-2 whitespace-nowrap transition-all cursor-pointer shrink-0"
          >
            <span>Enter Library Workstation</span>
            <ArrowRight className="w-4 h-4 shrink-0" />
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
};

export default WorkstationSetupModal;
