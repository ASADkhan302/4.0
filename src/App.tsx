/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { WindowsTitleBar } from './components/WindowsTitleBar';
import { PrimaryHeader } from './components/PrimaryHeader';
import { BooksCatalogView } from './components/BooksCatalogView';
import { CirculationDeskView } from './components/CirculationDeskView';
import { BorrowersView } from './components/BorrowersView';
import { ReportsView } from './components/ReportsView';
import { BarcodeScannerView } from './components/BarcodeScannerView';
import { ExcelCenterView } from './components/ExcelCenterView';
import { SettingsView } from './components/SettingsView';
import { LmsSidebar } from './components/LmsSidebar';
import { AlmariView } from './components/AlmariView';
import { AlmariErrorBoundary } from './components/catalog/AlmariErrorBoundary';
import { AppOpeningSplash } from './components/AppOpeningSplash';
import { LiquidGlassToastContainer, notifyGlassToast } from './components/ui/LiquidGlassToast';

import { AddEditBookModal } from './components/modals/AddEditBookModal';
import { BookDetailsModal } from './components/modals/BookDetailsModal';
import { BorrowerDetailsModal } from './components/modals/BorrowerDetailsModal';
import { BarcodePrintModal } from './components/modals/BarcodePrintModal';
import { DeleteBookConfirmModal } from './components/modals/DeleteBookConfirmModal';
import { DeleteBorrowerConfirmModal } from './components/modals/DeleteBorrowerConfirmModal';
import { StorageLocationModal } from './components/modals/StorageLocationModal';
import { WorkstationSetupModal } from './components/modals/WorkstationSetupModal';
import { BookImportModal } from './components/modals/BookImportModal';
import { ExcelImportModal } from './components/modals/ExcelImportModal';
import { BatchLabelPrintModal } from './components/modals/BatchLabelPrintModal';
import { DataFilesDiffModal } from './components/modals/DataFilesDiffModal';
import { IssueBookFlowModal } from './components/modals/IssueBookFlowModal';
import { AddEditBorrowerModal } from './components/modals/AddEditBorrowerModal';

import { Book, Borrower, BorrowerStatus, Transaction, HistoryEntry, SystemSettings, NavigationTab, StorageLocationConfig } from './types/library';
import { LibraryStorage, hardDeleteBooksCascade } from './services/storage';
import { AlmariService } from './services/almariService';
import { SharedCountService } from './services/sharedCountService';
import { playSuccessBarcodeBeep, playClickSound, playErrorBeep } from './services/audio';
import { LibraryDataFilesService, ExternalChangesSummary } from './services/libraryDataFilesService';
import { BarcodeService } from './services/barcodeService';
import { BookSheetService } from './services/bookSheetService';
import { LibraryFolderService } from './services/libraryFolderService';
import { 
  runSafeLocalStorageMigration, 
  getTrueDatabaseBookCount, 
  computeNextSerial,
  resetEntireDatabaseToZero,
  repairAllBookSeriesAndBarcodes,
  isWorkstationAlreadyInstalledAndConfigured,
  markWorkstationSetupCompleted
} from './services/libraryStorageAndMigration';
import { initDisplayAndThemeSystem } from './services/displayResolutionManager';
import { ULM_OFFICIAL_CREST_SRC, syncAppDesktopAndFaviconIcon } from './constants/ulmOfficialAssets';
import { ULM_OFFICIAL_CREST_DATA_URI } from './constants/ulmOfficialCrest';
import { useInstitutionalIdentity } from './utils/themeTransition';
import {
  GlobalHeavyTaskOverlay,
  startHeavyTask,
  updateHeavyTaskProgress,
  finishHeavyTask,
  runHeavyLibraryTask,
} from './utils/heavyTaskRunner';

export default function App() {
  const identity = useInstitutionalIdentity();
  // Valid navigation tabs (developer screens removed)
  const VALID_TABS: NavigationTab[] = ['catalog', 'circulation', 'borrowers', 'reports', 'scanner', 'excel', 'settings', 'almaris'];

  // Navigation (if a removed screen was previously saved as last visited view, fallback to catalog)
  const [activeTab, setActiveTab] = useState<NavigationTab>(() => {
    try {
      const savedTab = localStorage.getItem('ulm_lms_last_tab') || localStorage.getItem('ulm_lms_active_view');
      if (savedTab && (savedTab === 'sqlite' || savedTab === 'cpp_native')) {
        localStorage.removeItem('ulm_lms_last_tab');
        localStorage.removeItem('ulm_lms_active_view');
        return 'catalog';
      }
      if (savedTab && ['catalog', 'circulation', 'borrowers', 'reports', 'scanner', 'excel', 'settings', 'almaris'].includes(savedTab)) {
        return savedTab as NavigationTab;
      }
    } catch {}
    return 'catalog';
  });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 1024;
    }
    return false;
  });

  useEffect(() => {
    let prevWidth = typeof window !== 'undefined' ? window.innerWidth : 1440;
    const handleResize = () => {
      const currentWidth = window.innerWidth;
      if (prevWidth >= 1024 && currentWidth < 1024) {
        setIsSidebarCollapsed(true);
      } else if (prevWidth < 1024 && currentWidth >= 1024) {
        setIsSidebarCollapsed(false);
      }
      prevWidth = currentWidth;
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  // Core Data
  const [books, setBooks] = useState<Book[]>([]);
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [settings, setSettings] = useState<SystemSettings>(LibraryStorage.getSettings());

  // Modals
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [bookToEdit, setBookToEdit] = useState<Book | null>(null);
  const [initialBarcodeForAdd, setInitialBarcodeForAdd] = useState('');
  
  const [selectedBookForDetails, setSelectedBookForDetails] = useState<Book | null>(null);
  const [selectedBorrowerIdForDetails, setSelectedBorrowerIdForDetails] = useState<string | null>(null);
  const [bookForPrint, setBookForPrint] = useState<Book | null>(null);
  const [bookToDelete, setBookToDelete] = useState<Book | null>(null);
  const [borrowerToDelete, setBorrowerToDelete] = useState<Borrower | null>(null);

  // One Issue Flow Dialog State
  const [isIssueFlowOpen, setIsIssueFlowOpen] = useState(false);
  const [issueFlowInitialBook, setIssueFlowInitialBook] = useState<Book | null>(null);
  const [issueFlowInitialBorrower, setIssueFlowInitialBorrower] = useState<Borrower | null>(null);
  const [isAddPersonFromFlowOpen, setIsAddPersonFromFlowOpen] = useState(false);
  const [newlyRegisteredBorrowerForFlow, setNewlyRegisteredBorrowerForFlow] = useState<Borrower | null>(null);

  // Book Entry Sheet Import & Barcode Batch Print Modals
  const [isBookImportOpen, setIsBookImportOpen] = useState(false);
  const [isBatchLabelPrintOpen, setIsBatchLabelPrintOpen] = useState(false);
  const [batchPrintBookIds, setBatchPrintBookIds] = useState<string[]>([]);
  const [dataFileDiffSummary, setDataFileDiffSummary] = useState<ExternalChangesSummary | null>(null);
  const [isDataFileDiffOpen, setIsDataFileDiffOpen] = useState(false);
  const [isWelcomeModalOpen, setIsWelcomeModalOpen] = useState(false);
  const [isMissingLibrary, setIsMissingLibrary] = useState(false);
  const [missingLibraryPath, setMissingLibraryPath] = useState('');
  const [storageModalOption, setStorageModalOption] = useState<'create_new' | 'open_existing'>('create_new');

  // Database Storage Location State (Configurable on startup and anytime)
  const [storageConfig, setStorageConfig] = useState<StorageLocationConfig>(() => LibraryStorage.getStorageLocation());
  const [isStorageModalOpen, setIsStorageModalOpen] = useState<boolean>(false);
  const [waitingSheetCount, setWaitingSheetCount] = useState<number>(0);

  // Rule 1: First-Priority Setup Gate on Fresh Install (`ulm_setup_completed_v1 !== 'true'`) or after Factory Reset
  const initialNeedsSetup = useMemo(() => {
    try {
      const setupFlag = localStorage.getItem('ulm_setup_completed_v1');
      if (setupFlag === 'false') return true;
      if (setupFlag !== 'true' && !isWorkstationAlreadyInstalledAndConfigured(0)) return true;
      return false;
    } catch {
      return !isWorkstationAlreadyInstalledAndConfigured(0);
    }
  }, []);

  const [isStorageSetupModalOpen, setIsStorageSetupModalOpen] = useState<boolean>(initialNeedsSetup);
  const [isStorageSetupResetMode, setIsStorageSetupResetMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ulm_setup_completed_v1') === 'false';
    } catch {
      return false;
    }
  });
  const [isExcelImportModalOpen, setIsExcelImportModalOpen] = useState(false);

  // App opening animation state — skip splash straight into WorkstationSetupModal on fresh install / post-reset
  const [showSplash, setShowSplash] = useState<boolean>(!initialNeedsSetup);
  const [isAppEntered, setIsAppEntered] = useState<boolean>(initialNeedsSetup);

  // True Database Total Book Count (Queried from SQLite / IndexedDB without 5,000 localStorage limit)
  const [dbTotalBooksCount, setDbTotalBooksCount] = useState<number>(0);

  const [booksToBulkDelete, setBooksToBulkDelete] = useState<Book[]>([]);

  // Auto-mark setup completed if IndexedDB / SQLite hydrates with existing books (> 0)
  useEffect(() => {
    let explicitlyReset = false;
    try {
      explicitlyReset = localStorage.getItem('ulm_setup_completed_v1') === 'false';
    } catch {}
    if (explicitlyReset) return;
    const currentBooks = Math.max(dbTotalBooksCount, books.length);
    if (currentBooks > 0) {
      markWorkstationSetupCompleted('existing_catalog_hydrated');
      setIsStorageSetupModalOpen(false);
      setIsWelcomeModalOpen(false);
    }
  }, [dbTotalBooksCount, books.length]);

  const refreshTrueCount = useCallback(async () => {
    try {
      const count = await getTrueDatabaseBookCount();
      if (count > 0) {
        setDbTotalBooksCount(count);
        markWorkstationSetupCompleted('existing_catalog_hydrated');
      }
    } catch (_) {}
  }, []);

  // Initialize Display Resolution Manager & Liquid Glass Theme Orchestrator
  useEffect(() => {
    initDisplayAndThemeSystem();
  }, []);

  // Initialize BookSheetService and monitor waiting items
  useEffect(() => {
    BookSheetService.init();
    const updateCount = () => {
      const q = BookSheetService.getQueue();
      setWaitingSheetCount(q.filter(i => i.status === 'waiting').length);
    };
    updateCount();
    const interval = setInterval(updateCount, 2500);

    // Auto-refresh data files on app close (beforeunload)
    const handleBeforeUnload = () => {
      LibraryFolderService.refreshDataFiles(true).catch(() => {});
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Safe LocalStorage to SQLite / IndexedDB Migration (automatic, non-destructive)
  useEffect(() => {
    runSafeLocalStorageMigration().then(report => {
      if (report?.success && report.counts?.finalDbBooks) {
        console.log('[ULM-Storage] Safe database migration verified:', report.counts);
      }
      // Purge stuck 5MB localStorage books caches forever
      try {
        localStorage.removeItem('ulm_books');
        localStorage.removeItem('ulm_lms_books');
        localStorage.removeItem('books');
        localStorage.removeItem('ulm_library_books');
        localStorage.removeItem('library_books');
      } catch (_) {}
      void refreshTrueCount();
    }).catch(err => {
      console.warn('[ULM-Storage] Migration verification check note:', err);
      try {
        localStorage.removeItem('ulm_books');
        localStorage.removeItem('ulm_lms_books');
        localStorage.removeItem('books');
      } catch (_) {}
    });
  }, [refreshTrueCount]);

  // Sync document.title and Desktop/Favicon Icon with official ULM 2017 Crest or Custom Crest
  useEffect(() => {
    const activeCrest = identity.customCrestUrl || settings.customLogoDataUri || ULM_OFFICIAL_CREST_SRC;
    syncAppDesktopAndFaviconIcon(activeCrest);
    const activeUniv = identity.universityName || settings.university_name || 'University of Lakki Marwat';
    const activeLib = identity.libraryDepartmentName || settings.library_name || 'Central Campus Library';
    document.title = `${activeUniv} — ${activeLib}`;
  }, [identity, settings.university_name, settings.library_name, settings.customLogoDataUri]);

  const handleSplashComplete = useCallback(async () => {
    setShowSplash(false);
    setIsAppEntered(true);

    const trueCount = await getTrueDatabaseBookCount();
    const alreadyConfigured = isWorkstationAlreadyInstalledAndConfigured(
      Math.max(trueCount, dbTotalBooksCount, books.length)
    );

    if (!alreadyConfigured) {
      setIsStorageSetupResetMode(false);
      setIsStorageSetupModalOpen(true);
      return;
    }

    // Workstation is already configured — ensure modals stay closed on subsequent launches
    setIsStorageSetupModalOpen(false);
    setIsWelcomeModalOpen(false);
    const loc = LibraryStorage.getStorageLocation();
    setStorageConfig(loc);
  }, [dbTotalBooksCount, books.length]);

  const handleRetrySheetSync = async () => {
    const res = await BookSheetService.processQueue();
    const q = BookSheetService.getQueue();
    setWaitingSheetCount(q.filter(i => i.status === 'waiting').length);
    notifyGlassToast({
      type: 'info',
      title: 'Sheet Queue Sync',
      message: res.message,
    });
  };

  const handleStorageLocationSaved = (config: StorageLocationConfig) => {
    setStorageConfig(config);
    reloadData();
    notifyGlassToast({
      type: 'success',
      title: 'Repository Folder Updated',
      message: 'Storage repository mounted permanently for future launches.',
      meta: config.folderPath,
    });
  };

  const handleReplaySplash = useCallback(() => {
    setShowSplash(true);
    setIsAppEntered(false);
  }, []);

  // Screen switch transition: outgoing screen fades out slightly (120ms), incoming screen enters with subtle 6px upward slide and fade (200ms)
  const [isScreenExiting, setIsScreenExiting] = useState(false);
  const handleTabChange = useCallback((newTab: NavigationTab | string) => {
    const targetTab: NavigationTab = VALID_TABS.includes(newTab as NavigationTab) ? (newTab as NavigationTab) : 'catalog';
    if (targetTab === activeTab) return;
    setIsNavigating(true);
    setIsScreenExiting(true);
    setTimeout(() => {
      setActiveTab(targetTab);
      setIsScreenExiting(false);
      setTimeout(() => {
        setIsNavigating(false);
      }, 200);
    }, 120);
  }, [activeTab, VALID_TABS]);

  const showToast = useCallback((text: string, isError = false) => {
    notifyGlassToast({
      type: isError ? 'danger' : 'success',
      title: isError ? 'Action Notice' : 'Operation Complete',
      message: text,
    });
  }, []);

  // Reload all data from local repository & persistent IndexedDB directly
  const reloadData = useCallback(async (showLoadingOverlay = false) => {
    if (showLoadingOverlay) {
      await startHeavyTask(
        'Loading Library Database',
        'Hydrating catalog & circulation records from IndexedDB...',
        0
      );
    }
    try {
      const isCleared = typeof window !== 'undefined' && localStorage.getItem('ulm_database_cleared') === 'true';
      if (isCleared) {
        setBooks([]);
        setDbTotalBooksCount(0);
      } else {
        const dbBooks = await LibraryStorage.loadAllBooksFromDb();
        if (showLoadingOverlay) {
          updateHeavyTaskProgress(
            dbBooks.length,
            Math.max(1, dbBooks.length),
            `Loaded ${dbBooks.length.toLocaleString()} volumes from IndexedDB...`
          );
        }
        setBooks(dbBooks);
        setDbTotalBooksCount(dbBooks.length);
        if (dbBooks && dbBooks.length > 0) {
          const serialInfo = computeNextSerial(dbBooks);
          try {
            localStorage.setItem('ulm_highest_serial_number_v1', String(serialInfo.maxSerial));
            localStorage.setItem('ulm_catalog_total_count_v1', String(dbBooks.length));
          } catch (_) {}
          // Mirror to localStorage ONLY when <= 1500 books to prevent synchronous JSON.stringify hangs
          if (dbBooks.length <= 1500) {
            try {
              const json = JSON.stringify(dbBooks);
              localStorage.setItem('ulm_lms_books_v1', json);
              localStorage.setItem('ulm_library_books_master_v1', json);
            } catch (_) {}
            LibraryStorage.syncBookAlmariPlacements(dbBooks);
          }
        }
      }
    } catch (_) {
      setBooks([]);
    } finally {
      if (showLoadingOverlay) {
        finishHeavyTask();
      }
    }
    setBorrowers(LibraryStorage.getBorrowers());
    setTransactions(LibraryStorage.getTransactions());
    setHistory(LibraryStorage.getHistory());
    setSettings(LibraryStorage.getSettings());
    void refreshTrueCount();
  }, [refreshTrueCount]);

  useEffect(() => {
    void reloadData(!initialNeedsSetup);
  }, [reloadData, initialNeedsSetup]);

  // Rule #5 & User Choice: Automatically repair legacy duplicate barcodes on launch
  useEffect(() => {
    repairAllBookSeriesAndBarcodes().then(res => {
      if (res.repairedCount > 0) {
        console.log(`[ULM-Barcode] Auto-repaired ${res.repairedCount} books with unique sequential 13-digit barcodes`);
        void reloadData(false);
      }
    }).catch(err => {
      console.warn('[ULM-Barcode] Auto-repair note:', err);
    });
  }, [reloadData]);

  // Real-time reactive data sync: whenever books, loans, or imports change, refresh app state instantly
  useEffect(() => {
    const handleDataChanged = (e: Event) => {
      const custom = e as CustomEvent<{ reason?: string }>;
      // 'mutation' events already broadcast fresh reconciled state via 'ulm-library-sync'
      if (custom?.detail?.reason === 'mutation') return;
      void reloadData(false);
    };
    const handleSyncEvent = (e: Event) => {
      const custom = e as CustomEvent<{ books?: Book[]; loans?: Transaction[] }>;
      if (custom.detail?.books && Array.isArray(custom.detail.books)) {
        // Always replace authoritatively — NEVER merge back stale deleted books
        setBooks([...custom.detail.books]);
        setDbTotalBooksCount(custom.detail.books.length);
      }
      if (custom.detail?.loans && Array.isArray(custom.detail.loans)) {
        setTransactions([...custom.detail.loans]);
      }
      setBorrowers(LibraryStorage.getBorrowers());
      setHistory(LibraryStorage.getHistory());
    };
    const handleStorageEvent = () => {
      LibraryStorage.clearBooksCache();
      void reloadData();
    };
    const handleBrandingSync = () => {
      setSettings(LibraryStorage.getSettings());
    };

    window.addEventListener('ulm-library-data-changed', handleDataChanged);
    window.addEventListener('ulm-library-sync', handleSyncEvent);
    window.addEventListener('storage', handleStorageEvent);
    window.addEventListener('ulm-branding-sync', handleBrandingSync);
    return () => {
      window.removeEventListener('ulm-library-data-changed', handleDataChanged);
      window.removeEventListener('ulm-library-sync', handleSyncEvent);
      window.removeEventListener('storage', handleStorageEvent);
      window.removeEventListener('ulm-branding-sync', handleBrandingSync);
    };
  }, [reloadData]);

  // Global Keyboard shortcuts (e.g. Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        handleTabChange('catalog');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleTabChange]);

  // Dev-only automated WCAG AAA/AA Contrast Scanner (not shipped in the final production build)
  useEffect(() => {
    if (import.meta.env.DEV) {
      let isMounted = true;
      const timer = setTimeout(() => {
        import('./utils/contrastChecker').then(({ runContrastCheck }) => {
          if (isMounted) {
            runContrastCheck();
          }
        });
      }, 400);
      return () => {
        isMounted = false;
        clearTimeout(timer);
      };
    }
  }, [activeTab]);

  // Book CRUD actions
  const handleSaveBook = (bookData: Omit<Book, 'id' | 'created_at' | 'updated_at' | 'is_active'> & Partial<Book>) => {
    const freshCatalog = LibraryStorage.getBooks();
    const alreadyPersistedBySeriesEngine = freshCatalog.some(
      (b) =>
        (bookData.id && b.id === bookData.id) ||
        (bookData.barcode && b.barcode.trim().toUpperCase() === bookData.barcode.trim().toUpperCase())
    );

    if (alreadyPersistedBySeriesEngine) {
      setBooks([...freshCatalog]);
      reloadData();
      playSuccessBarcodeBeep();
      const batchTotal = Number(bookData.copy_total_in_batch) || 1;
      const metaLabel = bookData.accession_no
        ? `Acc #${bookData.accession_no}${bookData.barcode ? ` · ${bookData.barcode}` : ''}`
        : bookData.barcode || undefined;
      notifyGlassToast({
        type: 'success',
        title: batchTotal > 1 ? 'Series Copies Added' : 'Book Saved to Catalog',
        message:
          batchTotal > 1
            ? `"${bookData.book_name}" (${batchTotal} total copies in series) saved.`
            : `"${bookData.book_name}" saved to catalog database.`,
        meta: metaLabel,
      });
      return { success: true, message: 'Saved via AccessionSeriesEngine.' };
    }

    const res = LibraryStorage.addBook(bookData);
    if (res.success) {
      const updatedCatalog = LibraryStorage.getBooks();
      if (Array.isArray(updatedCatalog) && updatedCatalog.length > 0) {
        setBooks([...updatedCatalog]);
      }
      reloadData();
      playSuccessBarcodeBeep();
      const metaLabel = bookData.accession_no
        ? `Acc #${bookData.accession_no}${bookData.barcode ? ` · ${bookData.barcode}` : ''}`
        : bookData.barcode || undefined;
      notifyGlassToast({
        type: 'success',
        title: 'Book Saved to Catalog',
        message: `"${bookData.book_name}" saved to catalog database.`,
        meta: metaLabel,
      });
    }
    return res;
  };

  const handleUpdateBook = (id: string, updates: Partial<Book>) => {
    const res = LibraryStorage.updateBook(id, updates);
    if (res.success) {
      reloadData();
      playClickSound();
      const metaLabel = updates.accession_no
        ? `Acc #${updates.accession_no}${updates.barcode ? ` · ${updates.barcode}` : ''}`
        : updates.barcode || undefined;
      notifyGlassToast({
        type: 'success',
        title: 'Book Record Updated',
        message: updates.book_name ? `Updated "${updates.book_name}".` : 'Book record updated successfully.',
        meta: metaLabel,
      });
      if (selectedBookForDetails && selectedBookForDetails.id === id) {
        setSelectedBookForDetails(prev => prev ? { ...prev, ...updates } : null);
      }
    }
    return res;
  };

  const handleDeleteBookRequest = (book: Book) => {
    setBooksToBulkDelete([]);
    setBookToDelete(book);
  };

  const handleBulkDeleteBooksRequest = (selectedBooks: Book[]) => {
    if (!selectedBooks || selectedBooks.length === 0) return;
    if (selectedBooks.length === 1) {
      setBooksToBulkDelete([]);
      setBookToDelete(selectedBooks[0]);
      return;
    }
    setBookToDelete(null);
    setBooksToBulkDelete(selectedBooks);
  };

  const executeBooksDeletion = useCallback(
    async (
      targetBooks: Book[],
      permanent: boolean,
      forceCloseActiveLoans: boolean = false
    ) => {
      if (!targetBooks || targetBooks.length === 0) return;

      const runCascade = async (
        onProgress?: (processed: number, total: number, detail: string) => void
      ) =>
        hardDeleteBooksCascade(books, targetBooks, transactions, {
          forceDeleteCheckedOut: forceCloseActiveLoans,
          mode: permanent ? 'purge' : 'archive',
          onProgress,
        });

      const res =
        targetBooks.length > 200
          ? await runHeavyLibraryTask(
              `Deleting ${targetBooks.length.toLocaleString()} Selected Volumes`,
              'Purging volumes across SQLite, IndexedDB, Almari shelves & Master Excel...',
              async (update) =>
                runCascade((processed, total, detail) => update(processed, total, detail))
            )
          : await runCascade();

      if (res.deletedCount > 0) {
        const deletedIds = new Set(res.deletedBooks.map((b) => String(b.id || '').trim()).filter(Boolean));
        const deletedBarcodes = new Set(
          res.deletedBooks.map((b) => String(b.barcode || '').trim().toUpperCase()).filter(Boolean)
        );

        setBooks(res.remainingBooks);
        setDbTotalBooksCount(res.remainingBooks.length);
        setTransactions(res.updatedLoans);
        setHistory(LibraryStorage.getHistory());
        setBookToDelete(null);
        setBooksToBulkDelete([]);

        if (
          selectedBookForDetails &&
          (deletedIds.has(String(selectedBookForDetails.id || '').trim()) ||
            (selectedBookForDetails.barcode &&
              deletedBarcodes.has(String(selectedBookForDetails.barcode).trim().toUpperCase())))
        ) {
          setSelectedBookForDetails(null);
        }
        if (
          bookToEdit &&
          (deletedIds.has(String(bookToEdit.id || '').trim()) ||
            (bookToEdit.barcode &&
              deletedBarcodes.has(String(bookToEdit.barcode).trim().toUpperCase())))
        ) {
          setIsAddEditOpen(false);
          setBookToEdit(null);
        }

        playClickSound();
        const skippedNote =
          res.skippedCheckedOut.length > 0
            ? `${res.skippedCheckedOut.length} checked-out skipped`
            : undefined;
        notifyGlassToast({
          type: 'danger',
          title: res.deletedCount === 1 ? 'Volume Deleted' : 'Volumes Deleted',
          message:
            res.deletedCount === 1
              ? 'Deleted 1 volume & synced Master Excel.'
              : `Deleted ${res.deletedCount.toLocaleString()} volumes & synced Master Excel.`,
          meta: skippedNote,
        });
      } else if (res.skippedCheckedOut.length > 0) {
        playErrorBeep();
        const names = res.skippedCheckedOut
          .slice(0, 2)
          .map((b) => `"${b.book_name}"`)
          .join(', ');
        notifyGlassToast({
          type: 'warning',
          title: 'Checked-Out Volume Protected',
          message: `Cannot delete ${res.skippedCheckedOut.length} checked-out volume(s) (${names}). Return first or enable Force-Close Loan.`,
        });
      } else {
        playErrorBeep();
        notifyGlassToast({
          type: 'danger',
          title: 'Deletion Failed',
          message: 'Selected volume(s) could not be deleted.',
        });
      }
    },
    [books, transactions, selectedBookForDetails, bookToEdit]
  );

  const handleConfirmDeleteBook = async (
    targetBook: Book,
    permanent: boolean,
    forceCloseActiveLoan: boolean = false
  ) => {
    await executeBooksDeletion([targetBook], permanent, forceCloseActiveLoan);
  };

  const handleConfirmBulkDeleteBooks = async (
    targetBooks: Book[],
    permanent: boolean,
    forceCloseActiveLoans: boolean = false
  ) => {
    await executeBooksDeletion(targetBooks, permanent, forceCloseActiveLoans);
  };

  // Borrower CRUD actions
  const handleAddBorrower = (borrowerData: Omit<Borrower, 'id' | 'created_at' | 'updated_at' | 'is_active'>) => {
    const res = LibraryStorage.addBorrower(borrowerData);
    if (res.success) {
      reloadData();
      playClickSound();
      notifyGlassToast({
        type: 'success',
        title: 'Member Enrolled',
        message: `Member "${borrowerData.name}" enrolled successfully.`,
        meta: borrowerData.university_id || borrowerData.student_id || undefined,
      });
    } else {
      playErrorBeep();
      notifyGlassToast({
        type: 'danger',
        title: 'Enrollment Failed',
        message: res.message,
      });
    }
    return res;
  };

  const handleUpdateBorrower = (id: string, updates: Partial<Borrower>) => {
    const res = LibraryStorage.updateBorrower(id, updates);
    if (res.success) {
      reloadData();
      playClickSound();
      notifyGlassToast({
        type: 'success',
        title: 'Member Profile Updated',
        message: updates.name ? `Updated profile for "${updates.name}".` : 'Member profile updated successfully.',
        meta: updates.university_id || undefined,
      });
    } else {
      playErrorBeep();
      notifyGlassToast({
        type: 'danger',
        title: 'Update Failed',
        message: res.message,
      });
    }
    return res;
  };

  const handleBatchImportBorrowers = (borrowersList: Omit<Borrower, 'id' | 'created_at' | 'updated_at' | 'is_active'>[]) => {
    let imported = 0;
    const errors: string[] = [];
    borrowersList.forEach((b) => {
      const res = LibraryStorage.addBorrower(b);
      if (res.success) {
        imported++;
      } else {
        errors.push(`${b.university_id || b.name}: ${res.message}`);
      }
    });
    if (imported > 0) {
      reloadData();
      playSuccessBarcodeBeep();
      notifyGlassToast({
        type: 'success',
        title: 'Members Batch Imported',
        message: `Enrolled ${imported} member(s) into database.`,
        meta: errors.length > 0 ? `${errors.length} skipped` : undefined,
      });
    }
    return { success: true, imported, errors };
  };

  const handleDeleteBorrowerRequest = (borrower: Borrower) => {
    setBorrowerToDelete(borrower);
  };

  const handleConfirmDeleteBorrower = (borrowerId: string, permanent: boolean) => {
    const res = LibraryStorage.deleteBorrower(borrowerId, permanent);
    if (res.success) {
      reloadData();
      playClickSound();
      notifyGlassToast({
        type: 'danger',
        title: 'Member Removed',
        message: res.message,
      });
      if (selectedBorrowerIdForDetails === borrowerId) {
        setSelectedBorrowerIdForDetails(null);
      }
    } else {
      playErrorBeep();
      notifyGlassToast({
        type: 'warning',
        title: 'Member Removal Blocked',
        message: res.message,
      });
    }
  };

  // Circulation Actions
  const handleIssueBook = (
    bookId: string,
    borrowerId: string,
    daysOrDueDate: number | string = 14,
    options?: { overrideQuota?: boolean; overrideReason?: string }
  ) => {
    const res = LibraryStorage.issueBook(bookId, borrowerId, daysOrDueDate, options);
    if (res.success) {
      reloadData();
      playSuccessBarcodeBeep();
      notifyGlassToast({
        type: 'success',
        title: 'Book Issued to Member',
        message: res.message,
        meta: res.transaction
          ? `Due ${res.transaction.due_date}${res.transaction.barcode ? ` · ${res.transaction.barcode}` : ''}`
          : undefined,
      });
    } else {
      playErrorBeep();
      notifyGlassToast({
        type: 'warning',
        title: 'Borrowing Policy Warning',
        message: res.message,
      });
    }
    return res;
  };

  const handleOpenIssueFlow = (book?: Book | null, borrower?: Borrower | null) => {
    setIssueFlowInitialBook(book || null);
    setIssueFlowInitialBorrower(borrower || null);
    setIsIssueFlowOpen(true);
  };

  const handleReturnBook = (transactionId: string) => {
    const txBefore = transactions.find(
      t =>
        t.id === transactionId ||
        ((t.book_id === transactionId || t.barcode === transactionId) &&
          String(t.status || '').toUpperCase() !== 'RETURNED' &&
          !t.return_date)
    );
    const res = LibraryStorage.returnBook(transactionId);
    if (res.success) {
      reloadData();
      playSuccessBarcodeBeep();
      let fineMeta = 'On Time · Rs. 0';
      if (txBefore?.due_date) {
        const todayStr = new Date().toISOString().split('T')[0];
        if (txBefore.due_date < todayStr) {
          const diffMs = new Date(todayStr).getTime() - new Date(txBefore.due_date).getTime();
          const diffDays = Number.isFinite(diffMs) && diffMs > 0 ? Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24))) : 0;
          const fineRate = Number.isFinite(Number(settings.fine_per_day_pkr)) ? Math.max(0, Number(settings.fine_per_day_pkr)) : 50;
          const fine = diffDays * fineRate;
          fineMeta = fine > 0 ? `Overdue ${diffDays}d · Fine: Rs. ${fine}` : 'On Time · Rs. 0';
        }
      }
      notifyGlassToast({
        type: 'success',
        title: 'Book Returned to Shelf',
        message: txBefore ? `"${txBefore.book_name}" returned by ${txBefore.borrower_name}.` : res.message,
        meta: txBefore?.barcode ? `${fineMeta} · ${txBefore.barcode}` : fineMeta,
      });
    } else {
      playErrorBeep();
      notifyGlassToast({
        type: 'danger',
        title: 'Return Failed',
        message: res.message,
      });
    }
    return res;
  };

  // Quick Export
  const handleQuickExport = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const data = books.filter(b => b.is_active).map(b => ({
      Barcode: b.barcode,
      ISBN: b.isbn,
      Title: b.book_name,
      Author: b.author,
      Category: b.category,
      TotalCopies: b.total_quantity,
      AvailableCopies: b.available_quantity,
      Shelf: b.shelf,
      DeweyCallNumber: b.dewey_call_number,
    }));
    const exportFilename = `ULM_LMS_Catalog_Export_${todayStr}.csv`;
    LibraryStorage.exportCsv(data, exportFilename);
    notifyGlassToast({
      type: 'success',
      title: 'Export Saved',
      message: `Exported ${data.length.toLocaleString()} catalog record(s) to CSV.`,
      meta: exportFilename,
    });
  };

  // Reset to Demo Data & First-Time Launch State
  const handleResetDemoData = async () => {
    await LibraryStorage.clearAllDatabaseStores();
    LibraryStorage.resetToFirstTimeOpen();
    setBooks([]);
    setDbTotalBooksCount(0);
    await reloadData();
    setShowSplash(true);
    setIsAppEntered(false);
  };

  const handleClearDemoData = async () => {
    await LibraryStorage.clearAllDatabaseStores();
    const res = LibraryStorage.clearDemoData();
    try {
      localStorage.setItem('ulm_setup_completed_v1', 'false');
    } catch (_) {}
    setBooks([]);
    setDbTotalBooksCount(0);
    await reloadData();
    playClickSound();
    notifyGlassToast({
      type: 'danger',
      title: 'Catalog Reset to Zero',
      message: res.message,
    });
    setIsStorageSetupResetMode(true);
    setIsStorageSetupModalOpen(true);
  };

  // Shared aggregate counts
  const sharedCounts = useMemo(() => {
    return SharedCountService.computeCounts(books, borrowers, transactions);
  }, [books, borrowers, transactions]);

  const isExplicitlyCleared = (() => {
    try {
      return typeof window !== 'undefined' && localStorage.getItem('ulm_database_cleared') === 'true';
    } catch {
      return false;
    }
  })();
  const activeLoansCount = sharedCounts.activeLoans;
  const totalBooksCount = isExplicitlyCleared ? 0 : Math.max(dbTotalBooksCount, sharedCounts.totalTitles);
  const totalBorrowersCount = sharedCounts.totalRegisteredBorrowers;

  const selectedBorrowerObj = selectedBorrowerIdForDetails 
    ? borrowers.find(b => b.id === selectedBorrowerIdForDetails) || null
    : null;

  // Master Scroll Container Ref — Reset scroll to top on every navigation tab change
  const mainScrollRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
  }, [activeTab]);

  return (
    <div className="w-full h-dvh max-h-dvh flex flex-col overflow-hidden relative bg-gradient-to-br from-[#FCFBF7] via-[#F7F2FA] to-[#F3EDE0] dark:from-[#1C1233] dark:via-[#17112B] dark:to-[#1E1836] text-[var(--text-primary)] select-none">
      {/* Thin 2px accent progress bar during screen changes and async operations */}
      {isNavigating && (
        <div className="top-route-progress" />
      )}

      {/* 1. FIXED TOP HEADER BARS (Never scrolls away) */}
      <div className="shrink-0 w-full max-w-none mx-0 z-30">
        {/* WINDOWS 11 TITLE BAR (Slides down on app entry) */}
        <div className={isAppEntered ? 'animate-slide-down' : ''}>
          <WindowsTitleBar
            stationId={identity.workstationNodeId || settings.station_id}
            universityName={identity.universityName || settings.university_name}
            libraryName={identity.libraryDepartmentName || settings.library_name}
            onReplayOpeningAnimation={handleReplaySplash}
          />
        </div>

        {/* PRIMARY DESKTOP HEADER */}
        <PrimaryHeader
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onOpenAddBook={() => {
            setBookToEdit(null);
            setInitialBarcodeForAdd('');
            setIsAddEditOpen(true);
          }}
          onQuickExport={handleQuickExport}
          onReloadData={reloadData}
          onOpenStorageConfig={() => setIsStorageModalOpen(true)}
          storageLocationPath={storageConfig.folderPath}
          totalBooksCount={totalBooksCount}
          activeLoansCount={activeLoansCount}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          onOpenSearch={() => setIsSearchOpen(true)}
          universityName={identity.universityName || settings.university_name}
          libraryName={identity.libraryDepartmentName || settings.library_name}
          customLogoDataUri={identity.customCrestUrl || settings.customLogoDataUri}
          waitingBooksCount={waitingSheetCount}
          onRetrySheetSync={handleRetrySheetSync}
        />
      </div>

      {/* 2. MAIN WORKSPACE ROW: LOCKED LEFT SIDEBAR + SCROLLABLE RIGHT VIEW */}
      <div className="flex-1 min-h-0 w-full flex flex-row overflow-hidden relative gap-3 pt-2.5 pb-2.5 pr-2.5 sm:pt-3 sm:pb-3.5 sm:pr-3.5">
        {/* 2A. LOCKED LEFT SIDEBAR (Never scrolls with page, never moves, collapsible icon rail) */}
        <div className={`shrink-0 h-full min-h-0 flex flex-col overflow-hidden z-30 ${isAppEntered ? 'animate-slide-right' : ''}`}>
          <LmsSidebar
            activeTab={activeTab}
            onTabChange={handleTabChange}
            totalBooksCount={totalBooksCount}
            activeLoansCount={activeLoansCount}
            totalBorrowersCount={totalBorrowersCount}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            isSearchOpen={isSearchOpen}
            onToggleSearch={setIsSearchOpen}
            catalogBooks={books}
            onSelectBook={(book) => setSelectedBookForDetails(book)}
            universityName={identity.universityName || settings.university_name}
            libraryName={identity.libraryDepartmentName || settings.library_name}
          />
        </div>

        {/* 2B. SCROLLABLE PAGE WORKSPACE (All 8 pages scroll smoothly here) */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0 h-full relative overflow-hidden rounded-[26px]">
          {/* Ambient Refractive Background Orbs + Official ULM Crest Watermark */}
          <div id="ulm-liquid-orbs" className="fixed inset-0 pointer-events-none select-none z-0 overflow-hidden print:hidden" aria-hidden="true">
            {/* Subtle Liquid-Glass Header/Sidebar Junction Glow Orbs */}
            <div className="w-[460px] h-[220px] rounded-full bg-[#FFD147]/20 dark:bg-[#FFD147]/12 blur-3xl absolute -top-20 left-8 pointer-events-none" />
            <div className="w-[520px] h-[240px] rounded-full bg-[#541A72]/15 dark:bg-[#541A72]/28 blur-3xl absolute -top-24 right-12 pointer-events-none" />
            {/* 1. ULM Royal Amethyst Orb (top-left) */}
            <div className="w-[580px] h-[580px] rounded-full ulm-ambient-purple-orb absolute -top-48 -left-48 pointer-events-none opacity-80" />
            {/* 2. ULM 24K Liquid Gold Orb (bottom-right) */}
            <div className="w-[640px] h-[640px] rounded-full ulm-ambient-gold-orb absolute -bottom-56 -right-56 pointer-events-none opacity-75" />
            {/* 3. Campus Sky Cyan Orb (top-right) */}
            <div className="w-[520px] h-[520px] rounded-full ulm-ambient-cyan-orb absolute -top-32 right-1/4 pointer-events-none opacity-70" />
            {/* 4. Emerald Scholar Mist Orb (bottom-left) */}
            <div className="w-[480px] h-[480px] rounded-full ulm-ambient-emerald-orb absolute -bottom-36 left-1/3 pointer-events-none opacity-65" />
            {/* 5. Liquid Amber Orb (center) */}
            <div className="w-[500px] h-[500px] rounded-full ulm-ambient-amber-orb absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-60" />

            {/* Official ULM 2017 Crest Full-Application Background Watermark */}
            <div
              id="app-bg-watermark"
              aria-hidden="true"
              className="pointer-events-none select-none fixed inset-0 z-0 flex items-center justify-center overflow-hidden"
              style={{ left: '15rem', top: '3.75rem' }}
            >
              <img
                src={identity.customCrestUrl || settings.customLogoDataUri || ULM_OFFICIAL_CREST_SRC}
                alt={`${identity.universityName} Watermark`}
                draggable={false}
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = ULM_OFFICIAL_CREST_SRC;
                }}
                className="ulm-app-bg-watermark w-[380px] h-[380px] md:w-[460px] md:h-[460px] object-contain opacity-[0.045] dark:opacity-[0.055] pointer-events-none select-none z-0"
              />
            </div>
          </div>

          <main 
            id="ulm-main-scroll-view"
            ref={mainScrollRef}
            className={`ulm-page-scroll-container custom-scrollbar flex-1 flex flex-col min-h-0 min-w-0 h-full overflow-y-auto overflow-x-hidden relative z-10 overscroll-y-contain ${
              isScreenExiting ? 'screen-view-exit' : ''
            }`}
          >
        <div key={activeTab} className="ulm-page-enter w-full flex-1 flex flex-col min-h-0">
        {(activeTab === 'catalog' || !['almaris', 'circulation', 'borrowers', 'reports', 'scanner', 'excel', 'settings'].includes(activeTab)) && (
          <BooksCatalogView
            books={books}
            transactions={transactions}
            totalDbBooksCount={totalBooksCount}
            onNavigateToAlmaris={() => handleTabChange('almaris')}
            onSelectBook={(book) => setSelectedBookForDetails(book)}
            onEditBook={(book) => {
              setBookToEdit(book);
              setIsAddEditOpen(true);
            }}
            onDeleteBook={handleDeleteBookRequest}
            onDeleteSelectedBooks={handleBulkDeleteBooksRequest}
            onQuickLoan={(book) => {
              handleOpenIssueFlow(book, null);
            }}
            onReturnBook={handleReturnBook}
            onOpenAddBook={() => {
              setBookToEdit(null);
              setInitialBarcodeForAdd('');
              setIsAddEditOpen(true);
            }}
            onPrintBarcode={(book) => setBookForPrint(book)}
            onOpenImportBookEntrySheet={() => setIsExcelImportModalOpen(true)}
            onOpenBatchLabelPrint={(ids) => {
              setBatchPrintBookIds(Array.isArray(ids) && ids.length > 0 ? ids : []);
              setIsBatchLabelPrintOpen(true);
            }}
            onUpdateBooks={(updatedBooks) => {
              setBooks(updatedBooks);
            }}
            onBooksUpdated={(updatedBooks, _msg) => {
              setBooks(updatedBooks);
            }}
          />
        )}

        {activeTab === 'almaris' && (
          <AlmariErrorBoundary fallbackTitle="Error loading Almaris & Shelves" onReset={() => handleTabChange('almaris')}>
            <AlmariView
              books={books}
              onUpdateBooks={(updatedBooks) => {
                setBooks(updatedBooks);
              }}
              onSelectBook={(book) => setSelectedBookForDetails(book)}
              onOpenBook={(book) => setSelectedBookForDetails(book)}
              onEditBook={(book) => {
                setBookToEdit(book);
                setIsAddEditOpen(true);
              }}
              onOpenSettingsTab={() => handleTabChange('settings')}
              onCatalogBooksUpdated={(updatedBooks, _msg) => {
                setBooks(updatedBooks);
              }}
            />
          </AlmariErrorBoundary>
        )}

        {activeTab === 'circulation' && (
          <CirculationDeskView
            transactions={transactions}
            books={books}
            borrowers={borrowers}
            onIssueBook={handleIssueBook}
            onOpenIssueDialog={() => {
              handleOpenIssueFlow(null, null);
            }}
            onReturnBook={handleReturnBook}
            onOpenBookDetails={(bookId) => {
              const b = books.find(item => item.id === bookId);
              if (b) setSelectedBookForDetails(b);
            }}
            onOpenBorrowerDetails={(borrowerId) => setSelectedBorrowerIdForDetails(borrowerId)}
          />
        )}

        {activeTab === 'borrowers' && (
          <BorrowersView
            borrowers={borrowers}
            transactions={transactions}
            onAddBorrower={handleAddBorrower}
            onUpdateBorrower={handleUpdateBorrower}
            onDeleteBorrower={handleDeleteBorrowerRequest}
            onIssueBook={(b: Borrower) => {
              handleOpenIssueFlow(null, b);
            }}
            onOpenCirculationForBorrower={(borrowerId: string) => {
              const b = borrowers.find(item => item.id === borrowerId);
              handleOpenIssueFlow(null, b || null);
            }}
            onReturnLoan={handleReturnBook}
            onOpenBookDetails={(bookId: string) => {
              const b = books.find(item => item.id === bookId);
              if (b) setSelectedBookForDetails(b);
            }}
            onBatchImportBorrowers={handleBatchImportBorrowers}
            onReloadData={reloadData}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsView
            books={books}
            borrowers={borrowers}
            transactions={transactions}
            totalDbBooksCount={totalBooksCount}
            onNavigateTab={handleTabChange}
          />
        )}

        {activeTab === 'scanner' && (
          <BarcodeScannerView
            books={books}
            borrowers={borrowers}
            transactions={transactions}
            onOpenAddBookWithBarcode={(barcode) => {
              setBookToEdit(null);
              setInitialBarcodeForAdd(barcode);
              setIsAddEditOpen(true);
            }}
            onOpenAddBorrower={() => {
              setIsAddPersonFromFlowOpen(true);
            }}
            onOpenBookDetails={(bookId) => {
              const b = books.find(item => item.id === bookId);
              if (b) setSelectedBookForDetails(b);
            }}
            onQuickLoan={() => {
              setActiveTab('circulation');
            }}
            onQuickReturn={handleReturnBook}
            onPrintBarcode={(book) => setBookForPrint(book)}
            onIssueBookToBorrower={handleIssueBook}
            onUpdateBooks={(updatedBooks) => {
              setBooks(updatedBooks);
            }}
            onCatalogBooksUpdated={(updatedBooks, _msg) => {
              setBooks(updatedBooks);
            }}
          />
        )}

        {activeTab === 'excel' && (
          <ExcelCenterView
            books={books}
            borrowers={borrowers}
            transactions={transactions}
            history={history}
            onRefreshData={reloadData}
            onOpenImportEntrySheet={() => setIsBookImportOpen(true)}
            onOpenTransferZipModal={() => {
              setIsStorageSetupResetMode(false);
              setIsStorageSetupModalOpen(true);
            }}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            onUpdateSettings={(newSettings) => {
              setSettings(newSettings);
            }}
            onResetDemoData={handleResetDemoData}
            onClearDemoData={handleClearDemoData}
            onResetToZeroComplete={async () => {
              await resetEntireDatabaseToZero();
              AlmariService.clearAllToZero();
              try {
                localStorage.setItem('ulm_factory_reset_empty_v1', 'true');
                localStorage.setItem('ulm_setup_completed_v1', 'false');
              } catch (_) {}
              setBooks([]);
              setBorrowers([]);
              setTransactions([]);
              setHistory([]);
              setDbTotalBooksCount(0);
              window.dispatchEvent(
                new CustomEvent('ulm-library-sync', {
                  detail: { books: [], members: [], loans: [], almaris: [], bookGroups: [] },
                })
              );
              window.dispatchEvent(new CustomEvent('ulm-library-data-changed'));
              setShowSplash(false);
              setIsAppEntered(true);
              setIsWelcomeModalOpen(false);
              setIsStorageSetupResetMode(true);
              setIsStorageSetupModalOpen(true);
              notifyGlassToast({
                type: 'danger',
                title: 'Workstation Reset to Zero',
                message: 'All books, members, loans, Almaris & groups purged cleanly.',
              });
            }}
            onPlayBootAnimation={handleReplaySplash}
            onOpenStorageModal={() => setIsStorageModalOpen(true)}
            onOpenWelcomeModal={() => {
              setIsWelcomeModalOpen(false);
              setIsStorageSetupResetMode(true);
              setIsStorageSetupModalOpen(true);
            }}
          />
        )}
        </div>
        </main>
        </div>
      </div>

      {/* MODALS */}
      {/* Add / Edit Book Modal */}
      <AddEditBookModal
        isOpen={isAddEditOpen}
        bookToEdit={bookToEdit}
        initialBarcode={initialBarcodeForAdd}
        onClose={() => {
          setIsAddEditOpen(false);
          setBookToEdit(null);
          setInitialBarcodeForAdd('');
        }}
        onSave={handleSaveBook}
        onUpdate={handleUpdateBook}
        onDelete={(book) => {
          setIsAddEditOpen(false);
          handleDeleteBookRequest(book);
        }}
      />

      {/* Book Details Specification Modal */}
      <BookDetailsModal
        book={selectedBookForDetails}
        transactions={transactions}
        isOpen={!!selectedBookForDetails}
        onClose={() => setSelectedBookForDetails(null)}
        onEdit={(book) => {
          setSelectedBookForDetails(null);
          setBookToEdit(book);
          setIsAddEditOpen(true);
        }}
        onLoan={() => {
          const currentBook = selectedBookForDetails;
          setSelectedBookForDetails(null);
          handleOpenIssueFlow(currentBook, null);
        }}
        onPrintBarcode={(book) => setBookForPrint(book)}
        onReturnLoan={handleReturnBook}
        onDelete={(book) => {
          setSelectedBookForDetails(null);
          handleDeleteBookRequest(book);
        }}
      />

      {/* Delete Book Confirmation Modal (Single & Bulk) */}
      <DeleteBookConfirmModal
        book={bookToDelete}
        booksToDelete={booksToBulkDelete}
        transactions={transactions}
        isOpen={!!bookToDelete || booksToBulkDelete.length > 0}
        onClose={() => {
          setBookToDelete(null);
          setBooksToBulkDelete([]);
        }}
        onConfirmDelete={handleConfirmDeleteBook}
        onConfirmBulkDelete={handleConfirmBulkDeleteBooks}
      />

      {/* Borrower Details & History Modal */}
      <BorrowerDetailsModal
        borrower={selectedBorrowerObj}
        transactions={transactions}
        isOpen={!!selectedBorrowerIdForDetails}
        onClose={() => setSelectedBorrowerIdForDetails(null)}
        onReturnLoan={handleReturnBook}
        onOpenBookDetails={(bookId) => {
          const b = books.find(item => item.id === bookId);
          if (b) setSelectedBookForDetails(b);
        }}
        onIssueBook={(b) => {
          setSelectedBorrowerIdForDetails(null);
          handleOpenIssueFlow(null, b);
        }}
        onToggleStatus={(b) => {
          const newStatus: BorrowerStatus = b.status === 'active' ? 'suspended' : 'active';
          handleUpdateBorrower(b.id, { status: newStatus, is_active: newStatus === 'active' });
        }}
      />

      {/* Delete Borrower Confirmation Modal */}
      <DeleteBorrowerConfirmModal
        borrower={borrowerToDelete}
        transactions={transactions}
        isOpen={!!borrowerToDelete}
        onClose={() => setBorrowerToDelete(null)}
        onConfirmDelete={handleConfirmDeleteBorrower}
      />

      {/* Barcode Label Print Preview Modal */}
      <BarcodePrintModal
        book={bookForPrint}
        isOpen={!!bookForPrint}
        onClose={() => setBookForPrint(null)}
        onOpenBatchStudio={(bookId) => {
          setBookForPrint(null);
          setBatchPrintBookIds([bookId]);
          setIsBatchLabelPrintOpen(true);
        }}
      />

      {/* Database Storage Location Configuration Modal */}
      <StorageLocationModal
        isOpen={isStorageModalOpen}
        initialOption={storageModalOption}
        onClose={() => setIsStorageModalOpen(false)}
        onLocationSaved={handleStorageLocationSaved}
      />

      {/* Book Entry Sheet Import Engine Modal */}
      <BookImportModal
        isOpen={isBookImportOpen}
        onClose={() => setIsBookImportOpen(false)}
        onImportComplete={(batchId, count, bookIds, acceptedBooks) => {
          if (acceptedBooks && acceptedBooks.length > 0) {
            setBooks(prev => {
              const existingIds = new Set(prev.map(b => b.id));
              const fresh = acceptedBooks.filter(b => !existingIds.has(b.id));
              return [...fresh, ...prev];
            });
            setDbTotalBooksCount(prev => prev + acceptedBooks.length);
          }
          reloadData();
          notifyGlassToast({
            type: 'success',
            title: 'Import Complete',
            message: `Successfully imported ${count.toLocaleString()} book(s) from entry sheet.`,
            meta: batchId ? `Batch ${batchId}` : undefined,
          });
          if (bookIds && bookIds.length > 0) {
            setBatchPrintBookIds(bookIds);
          }
        }}
        onOpenLabelBatchPrint={(bookIds) => {
          setBatchPrintBookIds(bookIds);
          setIsBatchLabelPrintOpen(true);
        }}
      />

      {/* Permanent Excel Import Modal with 250-row Chunks & Strict Series (Rule 2 & 4) */}
      <ExcelImportModal
        isOpen={isExcelImportModalOpen}
        onClose={() => setIsExcelImportModalOpen(false)}
        onImportComplete={(importedCount) => {
          reloadData();
          notifyGlassToast({
            type: 'success',
            title: 'Excel Import Complete',
            message: `Imported ${importedCount.toLocaleString()} book(s) into persistent storage.`,
          });
        }}
      />

      {/* Single Unified Authoritative Workstation Setup & Post-Reset Initialization Modal */}
      <WorkstationSetupModal
        isOpen={isStorageSetupModalOpen || isWelcomeModalOpen}
        isResetMode={isStorageSetupResetMode}
        onClose={() => {
          markWorkstationSetupCompleted('dismissed');
          setIsStorageSetupModalOpen(false);
          setIsWelcomeModalOpen(false);
        }}
        onNavigateToCatalog={() => {
          handleTabChange('catalog');
        }}
        onCompleteMessage={(msg) => {
          reloadData();
          void refreshTrueCount();
          notifyGlassToast({
            type: 'success',
            title: 'Workstation Ready',
            message: msg,
          });
        }}
        onConfigured={(_path, action) => {
          markWorkstationSetupCompleted(action || 'configured');
          setIsStorageSetupModalOpen(false);
          setIsWelcomeModalOpen(false);
          reloadData();
          void refreshTrueCount();
        }}
      />

      {/* Batch Thermal Barcode Label Print Modal */}
      <BatchLabelPrintModal
        isOpen={isBatchLabelPrintOpen}
        bookIds={batchPrintBookIds.length > 0 ? batchPrintBookIds : undefined}
        books={books.filter(b => b.is_active)}
        onClose={() => {
          setIsBatchLabelPrintOpen(false);
        }}
      />

      {/* External Library Data Files Diff Modal */}
      <DataFilesDiffModal
        isOpen={isDataFileDiffOpen}
        summary={dataFileDiffSummary}
        onImportChanges={(applyDeletions, preferredSource) => {
          reloadData();
          setIsDataFileDiffOpen(false);
          setDataFileDiffSummary(null);
          notifyGlassToast({
            type: 'success',
            title: 'External Changes Synced',
            message: 'External data file changes incorporated into local catalog.',
          });
        }}
        onIgnoreAndRewrite={() => {
          LibraryDataFilesService.writeLibraryDataFiles().then(() => {
            setIsDataFileDiffOpen(false);
            setDataFileDiffSummary(null);
            notifyGlassToast({
              type: 'info',
              title: 'Data Files Rewritten',
              message: 'Rewrote external data files with active library catalog.',
            });
          });
        }}
        onClose={() => {
          setIsDataFileDiffOpen(false);
          setDataFileDiffSummary(null);
        }}
      />

      {/* Unified ONE ISSUE FLOW Modal (Book -> Person -> Time & Person -> Book -> Time) */}
      <IssueBookFlowModal
        isOpen={isIssueFlowOpen}
        onClose={() => {
          setIsIssueFlowOpen(false);
          setIssueFlowInitialBook(null);
          setIssueFlowInitialBorrower(null);
          setNewlyRegisteredBorrowerForFlow(null);
        }}
        initialBook={issueFlowInitialBook}
        initialBorrower={issueFlowInitialBorrower}
        books={books}
        borrowers={borrowers}
        transactions={transactions}
        onIssueBook={handleIssueBook}
        onOpenAddBorrower={() => {
          setIsAddPersonFromFlowOpen(true);
        }}
        newlyRegisteredBorrower={newlyRegisteredBorrowerForFlow}
      />

      {/* In-Flow "Register New Person" Modal */}
      {isAddPersonFromFlowOpen && (
        <AddEditBorrowerModal
          isOpen={isAddPersonFromFlowOpen}
          allBorrowers={borrowers}
          onClose={() => setIsAddPersonFromFlowOpen(false)}
          onSave={handleAddBorrower}
          onCreated={(createdBorrower) => {
            setNewlyRegisteredBorrowerForFlow(createdBorrower);
            setIsAddPersonFromFlowOpen(false);
          }}
        />
      )}

      {/* Note: Duplicate WelcomeLibraryModal removed — unified into WorkstationSetupModal above */}

      {/* Global Frosted Crystal Liquid-Glass Notification Portal */}
      <LiquidGlassToastContainer />

      {/* App Opening / Boot Animation Ceremony */}
      {showSplash && (
        <AppOpeningSplash
          onComplete={handleSplashComplete}
          booksCount={totalBooksCount}
        />
      )}

      {/* Full-Viewport BackgroundGradientAnimation Heavy Task Processing Overlay */}
      <GlobalHeavyTaskOverlay />

    </div>
  );
}
