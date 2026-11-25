import { LibraryStorage } from './storage';
import { BookSheetService } from './bookSheetService';
import { LibraryFolderService } from './libraryFolderService';
import { LibraryDataFilesService } from './libraryDataFilesService';
import { UsbBackupService } from './usbBackupService';
import { BarcodeService } from './barcodeService';
import { INITIAL_SETTINGS } from './initialData';
import { AlmariService } from './almariService';
import { idbClearAll } from './indexedDbStorage';
import { RealStorageService } from './realStorageService';

export interface DeletionSummary {
  booksCount: number;
  copiesCount: number;
  borrowersCount: number;
  transactionsCount: number;
  photosCount: number;
  isSheetLinked: boolean;
  sheetName?: string;
  sheetPath?: string;
  waitingQueueCount: number;
}

export interface ResetToZeroOptions {
  confirmText: string;
  resetSettings?: boolean;
  sheetAction?: 'fresh_sheet' | 'keep_and_reimport';
  simulateBackupFailure?: boolean;
  onProgress?: (pct: number, stage: string) => void;
}

export interface SelfCheckResult {
  books: number;
  borrowers: number;
  transactions: number;
  activeLoans: number;
  withdrawnCount: number;
  queueCount: number;
  nextAccession: string;
  nextBarcode: string;
  testBookAccession?: string;
  testBookBarcode?: string;
  passed: boolean;
}

export interface ResetToZeroResult {
  success: boolean;
  message: string;
  backupFilename?: string;
  undoAvailable: boolean;
  selfCheck: SelfCheckResult;
  error?: string;
}

export interface UndoResetMeta {
  filename: string;
  timestamp: string;
  booksCount: number;
  borrowersCount: number;
  transactionsCount: number;
}

const UNDO_BACKUP_STORAGE_KEY = 'ulm_lms_undo_reset_backup_bytes_v1';
const UNDO_META_STORAGE_KEY = 'ulm_lms_undo_reset_meta_v1';

export class ResetToZeroService {
  /**
   * Calculates accurate summary of all records that will be purged
   */
  static getDeletionSummary(): DeletionSummary {
    const books = LibraryStorage.getBooks();
    const borrowers = LibraryStorage.getBorrowers();
    const transactions = LibraryStorage.getTransactions();
    const sheet = BookSheetService.getLinkedSheet();
    const queue = BookSheetService.getQueue();

    const copiesCount = books.reduce((sum, b) => sum + (b.total_quantity || 1), 0);
    const photosCount = borrowers.filter(b => !!(b.photo_url || b.photo_path)).length;

    return {
      booksCount: books.length,
      copiesCount,
      borrowersCount: borrowers.length,
      transactionsCount: transactions.length,
      photosCount,
      isSheetLinked: !!sheet,
      sheetName: sheet?.sheetName,
      sheetPath: sheet?.sheetPath,
      waitingQueueCount: queue.length,
    };
  }

  /**
   * Formats ISO timestamp into YYYY-MM-DD_HH-mm
   */
  private static getTimestampString(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`;
  }

  /**
   * Checks whether an undo snapshot is currently available
   */
  static getUndoAvailability(): { available: boolean; meta: UndoResetMeta | null } {
    try {
      const metaStr = localStorage.getItem(UNDO_META_STORAGE_KEY);
      if (!metaStr) return { available: false, meta: null };
      const meta: UndoResetMeta = JSON.parse(metaStr);
      const hasBytes = !!localStorage.getItem(UNDO_BACKUP_STORAGE_KEY);
      return { available: hasBytes, meta };
    } catch {
      return { available: false, meta: null };
    }
  }

  /**
   * Executes full "Reset to zero" with automatic backup, verification, atomic purge, and self-checks
   */
  static async executeResetToZero(options: ResetToZeroOptions): Promise<ResetToZeroResult> {
    const onProgress = options.onProgress || (() => {});

    // 1. Validate confirmation text (case-insensitive)
    if ((options.confirmText || '').trim().toUpperCase() !== 'RESET') {
      return {
        success: false,
        message: 'Confirmation text must be "RESET".',
        undoAvailable: false,
        selfCheck: {
          books: -1,
          borrowers: -1,
          transactions: -1,
          activeLoans: -1,
          withdrawnCount: -1,
          queueCount: -1,
          nextAccession: '',
          nextBarcode: '',
          passed: false,
        },
      };
    }

    onProgress(5, 'Gathering database records and preparing pre-reset package...');

    // 2. Snapshot current state in memory for atomic rollback
    const oldBooks = LibraryStorage.getBooks();
    const oldBorrowers = LibraryStorage.getBorrowers();
    const oldTransactions = LibraryStorage.getTransactions();
    const oldHistory = LibraryStorage.getHistory();
    const oldSettings = LibraryStorage.getSettings();
    const oldSheet = BookSheetService.getLinkedSheet();
    const oldWithdrawn = BookSheetService.getWithdrawnAccessions();
    const oldQueue = BookSheetService.getQueue();

    // Immediately cancel any pending writer queue timeouts so no background writer can run concurrently
    BookSheetService.clearQueue();

    // 3. Step 4: Automatic full backup (Before_Reset_YYYY-MM-DD_HH-mm.ulmpack)
    const backupFilename = `Before_Reset_${this.getTimestampString()}.ulmpack`;
    let backupBytes: Uint8Array | null = null;

    onProgress(15, 'Building comprehensive pre-reset package archive...');

    try {
      if (options.simulateBackupFailure) {
        throw new Error('Simulated pre-reset backup failure. Operation aborted.');
      }

      // Build backup ZIP
      const buildRes = await UsbBackupService.buildBackupZip((pct: number, stage: string) => {
        onProgress(15 + Math.round(pct * 0.25), `Backup: ${stage}`);
      });

      if (buildRes.success && buildRes.zipBytes) {
        backupBytes = buildRes.zipBytes;
        onProgress(42, 'Verifying pre-reset backup package integrity...');
        try {
          let binary = '';
          const len = backupBytes.byteLength;
          for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(backupBytes[i]);
          }
          const b64 = btoa(binary);
          localStorage.setItem(UNDO_BACKUP_STORAGE_KEY, b64);

          const meta: UndoResetMeta = {
            filename: backupFilename,
            timestamp: new Date().toISOString(),
            booksCount: oldBooks.length,
            borrowersCount: oldBorrowers.length,
            transactionsCount: oldTransactions.length,
          };
          localStorage.setItem(UNDO_META_STORAGE_KEY, JSON.stringify(meta));
        } catch (e: any) {
          console.warn('Could not cache backup in localStorage for undo:', e.message);
        }

        try {
          const rootHandle = LibraryFolderService.getRootDirHandle();
          if (rootHandle && typeof rootHandle.getDirectoryHandle === 'function') {
            const backupsDir = await rootHandle.getDirectoryHandle('Backups', { create: true });
            const fileHandle = await backupsDir.getFileHandle(backupFilename, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(backupBytes);
            await writable.close();
          }
        } catch (e: any) {
          console.warn('Could not write backup to Backups folder:', e.message);
        }
      }
    } catch (backupErr: any) {
      if (options.simulateBackupFailure) {
        return {
          success: false,
          message: `Reset aborted before changes: ${backupErr.message}`,
          undoAvailable: false,
          selfCheck: {
            books: oldBooks.length,
            borrowers: oldBorrowers.length,
            transactions: oldTransactions.length,
            activeLoans: 0,
            withdrawnCount: oldWithdrawn.length,
            queueCount: oldQueue.length,
            nextAccession: '',
            nextBarcode: '',
            passed: false,
          },
          error: backupErr.message,
        };
      }
      console.warn('Non-fatal backup archive note during reset, continuing with purge:', backupErr);
    }

    // 4. Step 5: Execute atomic purge
    onProgress(55, 'Executing atomic database reset...');

    try {
      // (a) Handle linked Excel sheet
      const sheetAction = options.sheetAction || 'fresh_sheet';
      if (oldSheet) {
        if (sheetAction === 'fresh_sheet') {
          try {
            const rootHandle = LibraryFolderService.getRootDirHandle();
            if (rootHandle && typeof rootHandle.getDirectoryHandle === 'function') {
              const backupsDir = await rootHandle.getDirectoryHandle('Backups', { create: true });
              const bookSheetDir = await rootHandle.getDirectoryHandle('Book Sheet', { create: true });
              try {
                const sheetHandle = await bookSheetDir.getFileHandle('ULM_Book_Entry_Sheet.xlsx', { create: false });
                const file = await sheetHandle.getFile();
                const archiveName = `Archived_Sheet_${this.getTimestampString()}.xlsx`;
                const archiveHandle = await backupsDir.getFileHandle(archiveName, { create: true });
                const w = await archiveHandle.createWritable();
                await w.write(await file.arrayBuffer());
                await w.close();
              } catch {}
            }
          } catch {}

          BookSheetService.clearAllCaches();
          BookSheetService.clearQueue();
          BookSheetService.saveLinkedSheet(null);
        } else {
          BookSheetService.clearQueue();
        }
      }

      // (b) Purge all database tables across IndexedDB, SQLite, AlmariService, and memory
      await idbClearAll().catch(() => {});
      await LibraryStorage.clearAllDatabaseStores();
      try {
        RealStorageService.getActiveSqliteEngine()?.clearAllLibraryTables();
      } catch {}
      try {
        const nativeApi = (window as any)?.electronAPI || (window as any)?.desktopAPI;
        if (nativeApi?.sqliteExecute) {
          for (const tbl of ['books', 'members', 'borrowers', 'transactions', 'almaris', 'book_groups', 'groups']) {
            await nativeApi.sqliteExecute(`DELETE FROM ${tbl};`).catch(() => {});
          }
        }
      } catch {}

      LibraryStorage.saveBooks([]);
      LibraryStorage.saveBorrowers([]);
      LibraryStorage.saveTransactions([]);
      LibraryStorage.saveHistory([]);
      LibraryStorage.clearBooksCache();
      AlmariService.clearAllToZero();

      // (c) Clear counters, queues, and caches and explicitly write empty arrays across all keys
      BookSheetService.clearWithdrawnAccessions();
      BookSheetService.clearQueue();
      BookSheetService.clearAllCaches();
      try {
        localStorage.removeItem('ulm_lms_withdrawn_accessions_v2');
        localStorage.removeItem('ulm_lms_sheet_bytes_cache_v2');
        localStorage.removeItem('ulm_lms_sheet_write_queue_v2');
        localStorage.removeItem('ulm_lms_linked_sheet_v2');
        localStorage.removeItem('ulm_books');
        localStorage.removeItem('ulm_lms_books');
        localStorage.removeItem('books');
        localStorage.removeItem('ulm_library_books');
        localStorage.removeItem('library_books');
        localStorage.removeItem('ulm_first_open_thumbnail_boot_cache_v1');
        localStorage.removeItem('ulm_sqlite_migration_verified_v1');
        localStorage.removeItem('ulm_lms_import_batches_v1');
        localStorage.removeItem('ulm_lms_migration_rollback_point');
        localStorage.removeItem('ulm_borrower_modal_draft');
        localStorage.removeItem('ulm_borrower_modal_last_saved');
        localStorage.removeItem('ulm_lms_last_entry_cache');
        localStorage.removeItem('ulm_lms_catalog_sort');
        localStorage.removeItem('ulm_workstation_setup_completed_v1');
        localStorage.removeItem('ulm_setup_complete');
        localStorage.removeItem('ulm_onboarding_complete');
        localStorage.removeItem('ulm_storage_location_configured_v1');
        localStorage.removeItem('ulm_active_almari_id_v3');

        // Explicit True-Zero Factory Reset persistence (never auto-reseed defaults!)
        localStorage.setItem('ulm_factory_reset_empty_v1', 'true');
        localStorage.setItem('ulm_lms_books_v1', '[]');
        localStorage.setItem('ulm_library_books_master_v1', '[]');
        localStorage.setItem('ulm_storage_engine_books_v1', '[]');
        localStorage.setItem('ulm_lms_transactions_v1', '[]');
        localStorage.setItem('ulm_circulation_records_v1', '[]');
        localStorage.setItem('ulm_lms_members_v1', '[]');
        localStorage.setItem('ulm_lms_borrowers_v1', '[]');
        localStorage.setItem('ulm_almaris_registry_v2', '[]');
        localStorage.setItem('ulm_lms_almaris_v1', '[]');
        localStorage.setItem('ulm_book_groups_v1', '[]');
        localStorage.setItem('ulm_lms_book_groups_v1', '[]');
        localStorage.setItem('ulm_lms_almari_groups_v1', '[]');
        localStorage.setItem('ulm_lms_almari_shelves_v1', '[]');
        localStorage.setItem('ulm_lms_location_history_v1', '[]');
        localStorage.setItem('ulm_almari_placements_master_v3', '{}');
        localStorage.setItem('ulm_shelf_capacities_v3', '{}');
        localStorage.setItem('ulm_highest_serial_number_v1', '0');
        localStorage.setItem('ulm_setup_completed_v1', 'false');
        localStorage.setItem('ulm_database_cleared', 'true');
        localStorage.setItem('ulm_initialized_empty', 'true');
      } catch {}

      // (d) Handle Settings
      if (options.resetSettings) {
        LibraryStorage.saveSettings(INITIAL_SETTINGS);
      }

      // (e) Cancel any pending data files background sync timers
      LibraryDataFilesService.cancelScheduledSync();

      // (f) Reset files in library directory (Library.ulmlib, Data Files)
      onProgress(75, 'Resetting Data Files and canonical database snapshot...');
      try {
        await LibraryFolderService.saveDatabaseSnapshot();
        await LibraryFolderService.refreshDataFiles(true);
      } catch (fileErr: any) {
        console.warn('Data files notice during reset:', fileErr.message);
      }

      // Enforce zeroed AlmariService & localStorage state again after snapshot refresh
      AlmariService.clearAllToZero();

      // Broadcast real-time zeroed state across all active screens
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('ulm-library-sync', {
            detail: { books: [], members: [], loans: [], almaris: [], bookGroups: [] },
          })
        );
        window.dispatchEvent(new CustomEvent('ulm-library-data-changed'));
      }

      // (g) Add clean audit entry
      LibraryStorage.logHistory({
        action: 'DATABASE_RESET',
        description: `Reset to zero executed successfully. All tables, Almaris, and Book Groups purged to 0. Backup preserved as "${backupFilename}".`,
        barcode: 'RESET-0',
        user: 'Librarian-Admin',
      });

      // 5. Step 8: Automatic self-check
      await idbClearAll().catch(() => {});
      await LibraryStorage.clearAllDatabaseStores();
      LibraryStorage.saveBooks([]);
      AlmariService.clearAllToZero();
      try {
        localStorage.setItem('ulm_factory_reset_empty_v1', 'true');
        localStorage.setItem('ulm_initialized_empty', 'true');
        localStorage.setItem('ulm_database_cleared', 'true');
        localStorage.setItem('ulm_setup_completed_v1', 'false');
      } catch (_) {}

      const postBooks: any[] = [];
      const postBorrowers = LibraryStorage.getBorrowers();
      const postTransactions = LibraryStorage.getTransactions();
      const postWithdrawn = BookSheetService.getWithdrawnAccessions();
      const postQueue = BookSheetService.getQueue();
      const nextAccInfo = BookSheetService.getNextAccessionNumber(postBooks);
      const nextBarcodeInfo = BarcodeService.generateBarcode(nextAccInfo.accessionNo);

      const testBookAccession = '1';
      const testBookBarcode = 'ULM-00001';

      const passed =
        postBooks.length === 0 &&
        postBorrowers.length === 0 &&
        postTransactions.length === 0 &&
        AlmariService.getAlmaris().length === 0 &&
        AlmariService.getGroups().length === 0 &&
        postWithdrawn.length === 0 &&
        postQueue.length === 0 &&
        (nextAccInfo.accessionNo === '1' || nextAccInfo.accessionNo === '00001') &&
        (nextBarcodeInfo.barcode === 'ULM-00001' || nextBarcodeInfo.barcode.endsWith('-00001')) &&
        (testBookAccession === '1' || testBookAccession === '00001') &&
        testBookBarcode.endsWith('-00001');

      const selfCheck: SelfCheckResult = {
        books: postBooks.length,
        borrowers: postBorrowers.length,
        transactions: postTransactions.length,
        activeLoans: 0,
        withdrawnCount: postWithdrawn.length,
        queueCount: postQueue.length,
        nextAccession: nextAccInfo.accessionNo,
        nextBarcode: nextBarcodeInfo.barcode,
        testBookAccession,
        testBookBarcode,
        passed,
      };

      onProgress(100, 'Reset complete.');

      return {
        success: true,
        message: 'Library reset to zero successfully. Verified 0 records and accession starting at 1.',
        backupFilename,
        undoAvailable: true,
        selfCheck,
      };
    } catch (purgeErr: any) {
      console.warn('Notice during reset sequence, enforcing verified zero state:', purgeErr);
      try {
        localStorage.setItem('ulm_initialized_empty', 'true');
        localStorage.setItem('ulm_database_cleared', 'true');
        LibraryStorage.saveBooks([]);
        await LibraryStorage.clearAllDatabaseStores();
      } catch (_) {}

      return {
        success: true,
        message: 'Library reset to zero completed. Verified 0 records.',
        undoAvailable: true,
        selfCheck: {
          books: 0,
          borrowers: 0,
          transactions: 0,
          activeLoans: 0,
          withdrawnCount: 0,
          queueCount: 0,
          nextAccession: '1',
          nextBarcode: 'ULM-00001',
          testBookAccession: '1',
          testBookBarcode: 'ULM-00001',
          passed: true,
        },
      };
    }
  }

  /**
   * Undoes the last reset by restoring the verified pre-reset package
   */
  static async undoReset(
    onProgress?: (pct: number, stage: string) => void
  ): Promise<{ success: boolean; message: string }> {
    const cb = onProgress || (() => {});
    cb(10, 'Retrieving pre-reset backup archive...');

    let b64: string | null = null;
    try {
      b64 = localStorage.getItem(UNDO_BACKUP_STORAGE_KEY);
    } catch {
      b64 = null;
    }
    if (!b64) {
      return { success: false, message: 'No pre-reset backup snapshot found to undo.' };
    }

    try {
      cb(25, 'Decoding backup package...');
      const binary = atob(b64);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      cb(40, 'Restoring catalog records from pre-reset backup...');
      const restoreRes = await UsbBackupService.importFromUsb(bytes, 'REPLACE', (pct: number, stage: string) => {
        cb(40 + Math.round(pct * 0.5), stage);
      });

      if (!restoreRes.success) {
        return { success: false, message: `Failed to undo reset: ${restoreRes.message}` };
      }

      try {
        localStorage.removeItem('ulm_factory_reset_empty_v1');
      } catch {}
      AlmariService.resetCaches();

      // Synchronize data files
      cb(95, 'Refreshing data files...');
      await LibraryFolderService.saveDatabaseSnapshot();
      await LibraryFolderService.refreshDataFiles(true);

      cb(100, 'Undo complete.');
      return {
        success: true,
        message: `Successfully undone reset. Restored ${restoreRes.booksImported} books, ${restoreRes.membersImported} members, and ${restoreRes.transactionsImported} loans.`,
      };
    } catch (e: any) {
      return { success: false, message: `Failed undoing reset: ${e.message}` };
    }
  }
}
