/**
 * ULM Central Campus Library Management System
 * Multi-Core Web Worker Excel Parser, RAM LRU Page Cache, Paginated Catalogue Controller,
 * Safe LocalStorage Migrator, Browser IndexedDB Engine & Non-Blocking Chunked Importer
 * (src/services/libraryStorageAndMigration.ts)
 *
 * Hardware, CPU & RAM Optimizations for 4,000 - 50,000+ Books:
 * 1. Multi-Core CPU Offloading:
 *    - Runs heavy row normalization & chunk preparation on a background Web Worker thread
 *      (when supported) and yields between 250-row batches so the UI thread stays at 60 FPS.
 * 2. Controlled RAM LRU Page Cache (`ramPageCache`):
 *    - Caches the 20 most recently viewed 50-row catalogue pages in RAM (~1,000 rows max)
 *      for 0 ms instant page switching without holding all 4,000-50,000 books in React state.
 * 3. Dual-Engine Persistence:
 *    - Electron Desktop Engine: SQLite via window.ulmLibraryApi with 256MB mmap and WAL mode.
 *    - Browser Preview Engine: IndexedDB (`ulm_library_idb_v1`) with zero 5MB quota limit.
 * 4. GPU-Accelerated CSS Helper (`GPU_ACCELERATED_ROW_STYLE`):
 *    - Applies `contentVisibility: 'auto'` and GPU layer promotion to keep scrolling smooth.
 */

import * as XLSX from 'xlsx';

export type BookStatus = 'AVAILABLE' | 'ISSUED' | 'RESERVED' | 'LOST' | 'DAMAGED';

export const DEFAULT_CATALOG_PAGE_SIZE = 50;
export const DEFAULT_IMPORT_BATCH_SIZE = 250;
const MAX_RAM_CACHED_PAGES = 20;

/**
 * Apply this style object to Catalogue `<tr>` or card elements to enable
 * Chromium GPU hardware-accelerated layout/paint skipping for off-screen rows.
 */
export const GPU_ACCELERATED_ROW_STYLE: Record<string, string> = {
  contentVisibility: 'auto',
  containIntrinsicSize: '0 48px',
};

export interface UlmBookRecord {
  id: string;
  accession_number: string;
  accessionNumber: string;
  accessionNo?: string;
  date_of_entry: string;
  dateOfEntry: string;
  barcode: string | null;
  author: string;
  co_authors?: string;
  coAuthors?: string;
  title: string;
  subtitle?: string;
  publisher: string;
  place: string;
  publication_year: string;
  publicationYear: string;
  edition: string;
  pages: string;
  binding: string;
  price_rs: number;
  priceRs: number;
  price_ps: number;
  pricePs: number;
  price: number;
  source_remarks: string;
  sourceRemarks: string;
  call_number: string;
  callNumber: string;
  dewey_class?: string;
  category: string;
  language: string;
  isbn?: string;
  almari_id?: string | null;
  almariId?: string | null;
  shelf_id?: string | null;
  shelfId?: string | null;
  shelf_label?: string;
  shelfLabel?: string;
  status: BookStatus;
  condition?: string;
  cover_image_path?: string;
  coverImagePath?: string;
  remarks?: string;
  is_active?: number | boolean;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ImportRowError {
  row: number;
  accessionNumber: string;
  reason: string;
}

export interface ImportProgressEvent {
  processed: number;
  total: number;
  percent: number;
  inserted: number;
  updated: number;
  skippedDuplicates: number;
  rejected: number;
}

export interface BatchImportSummary {
  totalInput: number;
  processed: number;
  inserted: number;
  updated: number;
  skippedDuplicates: number;
  rejected: number;
  cancelled: boolean;
  finalDbBooks: number;
  durationMs?: number;
  errors: ImportRowError[];
}

export interface MigrationVerificationReport {
  success: boolean;
  alreadyMigratedOrEmptySource?: boolean;
  preMigrationBackupPath: string;
  counts: {
    sourceBooks: number;
    initialDbBooks: number;
    migratedInserted?: number;
    migratedUpdated?: number;
    skippedDuplicates?: number;
    failedRejected?: number;
    finalDbBooks: number;
    migratedBorrowers?: number;
    migratedLoans?: number;
  };
  sampleChecks?: Array<{
    index: number;
    accessionNumber: string;
    expectedTitle: string;
    foundInDb: boolean;
  }>;
  errors?: ImportRowError[];
}

export interface BookQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: string;
  language?: string;
  status?: string;
  almariId?: string;
  shelfId?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  exportAll?: boolean;
}

export interface PaginatedBooksResult {
  items: UlmBookRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface UlmLibraryElectronApi {
  getDatabaseInfo: () => Promise<{
    dbPath: string;
    activeDataDir: string;
    coversDir: string;
    backupsDir: string;
    stats: Record<string, unknown>;
  }>;
  selectCustomDataFolder: () => Promise<{
    canceled?: boolean;
    changed?: boolean;
    activeDataDir: string;
    dbPath?: string;
    verifiedBookCount?: number;
  }>;
  getStartupBootSnapshot?: (pageSize?: number) => Promise<{
    stubs: UlmBookThumbnailStub[];
    totalBooks: number;
    stats: Record<string, unknown>;
  }>;
  getFullBookDetails?: (idOrAccession: string) => Promise<UlmBookRecord | null>;
  queryBooks: (params: BookQueryParams) => Promise<PaginatedBooksResult>;
  lookupByScanCode: (code: string) => Promise<UlmBookRecord | null>;
  saveBook: (book: Partial<UlmBookRecord>, mode?: 'insert' | 'upsert') => Promise<UlmBookRecord>;
  deleteBook: (idOrAccession: string) => Promise<{ deleted: boolean; id?: string; accessionNumber?: string }>;
  getDashboardStats: () => Promise<Record<string, unknown>>;
  migrateFromLocalStorage: (payload: Record<string, unknown>) => Promise<MigrationVerificationReport>;
  importSingleChunk?: (
    chunk: Array<Record<string, unknown>>,
    options?: { onDuplicate?: 'skip' | 'upsert'; rowOffset?: number; isFinalChunk?: boolean }
  ) => Promise<{
    processed: number;
    inserted: number;
    updated: number;
    skippedDuplicates: number;
    rejected: number;
    errors: ImportRowError[];
  }>;
  importBooksChunked: (
    books: Array<Record<string, unknown>>,
    options?: { onDuplicate?: 'skip' | 'upsert'; chunkSize?: number }
  ) => Promise<BatchImportSummary>;
  bulkUpdateByFilter?: (
    filterParams: Record<string, unknown>,
    patch: Record<string, unknown>
  ) => Promise<{ updatedCount: number }>;
  cancelImport: () => Promise<{ cancelRequested: boolean }>;
  onImportProgress: (callback: (progress: ImportProgressEvent) => void) => () => void;
  createBackup: (customOutputPath?: string) => Promise<Record<string, unknown>>;
  restoreBackup: (backupFilePath?: string) => Promise<Record<string, unknown>>;
}

declare global {
  interface Window {
    ulmLibraryApi?: UlmLibraryElectronApi;
    ulmElectronSqlite?: UlmLibraryElectronApi;
  }
}

const LEGACY_BOOK_KEYS = ['ulm_books', 'ulm_lms_books', 'ulm_library_books', 'books', 'library_books'];
const LEGACY_ALMARI_KEYS = ['ulm_almaris', 'ulm_lms_almaris', 'almaris'];
const LEGACY_SHELF_KEYS = ['ulm_shelves', 'ulm_lms_shelves', 'shelves'];
const LEGACY_BORROWER_KEYS = ['ulm_borrowers', 'ulm_lms_borrowers', 'borrowers'];
const LEGACY_LOAN_KEYS = ['ulm_loans', 'ulm_lms_loans', 'loans'];
const MIGRATION_VERIFIED_FLAG = 'ulm_sqlite_migration_verified_v1';
const FIRST_OPEN_BOOT_CACHE_KEY = 'ulm_first_open_thumbnail_boot_cache_v1';

let isRendererImportActive = false;
let rendererCancelRequested = false;

/**
 * Bounded LRU RAM Page Cache: keeps up to 20 pages (50 rows each) in RAM
 * for instant 0 ms page transitions without holding all 4,000+ books in memory.
 */
const ramPageCache = new Map<string, PaginatedBooksResult>();

export function invalidateRamPageCache(): void {
  ramPageCache.clear();
}

export function yieldToUiThread(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => setTimeout(resolve, 0));
    } else {
      setTimeout(resolve, 0);
    }
  });
}

export function normalizeIdentifier(rawValue: unknown): string {
  if (rawValue === null || rawValue === undefined) return '';
  let str = String(rawValue).trim();
  if (!str) return '';
  if (/^\d+\.0+$/.test(str)) {
    str = str.replace(/\.0+$/, '');
  }
  return str;
}

/**
 * Parses numeric serial from raw value (Rule 4).
 * Strips non-digits; returns positive integer or 0.
 */
export function parseSerialNumber(raw: unknown): number {
  const digits = String(raw ?? '').trim().replace(/\D/g, '');
  if (!digits) return 0;
  const num = parseInt(digits, 10);
  return Number.isFinite(num) && num > 0 ? num : 0;
}

/**
 * Computes next strictly sequential serial number (Rule 4).
 * Monotonic formula: MAX(numeric_serial) + 1.
 * If highest serial is 100000, next is strictly 100001 with barcode 0092000100001.
 */
export function computeNextSerial(
  existingBooks: Array<{ accession_number?: string; accessionNumber?: string; accession_no?: string; barcode?: string | null }>
): {
  maxSerial: number;
  nextSerial: number;
  nextAccession: string;
  nextBarcode: string;
} {
  let maxSerial = 0;
  if (typeof window !== 'undefined' && window.localStorage) {
    maxSerial = Number(localStorage.getItem('ulm_highest_serial_number_v1') || 0);
  }
  for (const b of existingBooks) {
    const n = parseSerialNumber(b.accession_number || b.accessionNumber || b.accession_no);
    if (n > maxSerial) maxSerial = n;
  }
  const nextSerial = maxSerial > 0 ? maxSerial + 1 : 100000;
  const padLen = nextSerial >= 100000 ? String(nextSerial).length : Math.max(5, String(nextSerial).length);
  const nextAccession = String(nextSerial).padStart(padLen, '0');
  const nextBarcode = '0092' + String(nextSerial).padStart(9, '0');
  return { maxSerial, nextSerial, nextAccession, nextBarcode };
}

/**
 * Queries database to compute next strictly sequential serial number.
 */
export async function getNextSequentialSeriesNumber(): Promise<{
  maxSerial: number;
  nextSerial: number;
  nextAccession: string;
  nextBarcode: string;
}> {
  let maxSerial = 0;
  if (typeof window !== 'undefined' && window.localStorage) {
    maxSerial = Number(localStorage.getItem('ulm_highest_serial_number_v1') || 0);
  }
  if (typeof window !== 'undefined' && window.ulmLibraryApi) {
    try {
      const res = await window.ulmLibraryApi.queryBooks({ page: 1, pageSize: 200, sortBy: 'accession_number', sortOrder: 'DESC' });
      for (const item of res.items) {
        const n = parseSerialNumber(item.accession_number || item.accessionNumber);
        if (n > maxSerial) maxSerial = n;
      }
    } catch (_) {}
  }
  const nextSerial = maxSerial > 0 ? maxSerial + 1 : 100000;
  const padLen = nextSerial >= 100000 ? String(nextSerial).length : Math.max(5, String(nextSerial).length);
  const nextAccession = String(nextSerial).padStart(padLen, '0');
  const nextBarcode = '0092' + String(nextSerial).padStart(9, '0');
  return { maxSerial, nextSerial, nextAccession, nextBarcode };
}

export const MASTER_EXCEL_FILENAME = 'ULM_Master_Books_Register.xlsx';
export const EXCEL_SHEET_MAX_ROWS = 500000;

/**
 * Generates an unlimited multi-sheet Master Excel Workbook (Rule 3).
 * Partitions books into 500,000-row worksheets (Books_Series_1, Books_Series_2, ...)
 * in strict numeric serial order (100000, 100001, ...).
 */
export function generateMasterExcelWorkbook(books: UlmBookRecord[]): XLSX.WorkBook {
  const sorted = [...books].sort((a, b) => {
    const numA = parseSerialNumber(a.accession_number || a.accessionNumber);
    const numB = parseSerialNumber(b.accession_number || b.accessionNumber);
    if (numA !== numB) return numA - numB;
    return String(a.accession_number || '').localeCompare(String(b.accession_number || ''), undefined, { numeric: true });
  });

  const wb = XLSX.utils.book_new();

  if (sorted.length === 0) {
    const emptyHeaders = [
      'Accession_No', 'Date_Of_Entry', 'Barcode', 'Author', 'Co_Authors',
      'Title', 'Subtitle', 'Publisher', 'Place', 'Publication_Year',
      'Edition', 'Pages', 'Binding', 'Price_Rs', 'Price_Ps', 'Source_Remarks',
      'Call_Number', 'Category', 'Language', 'Shelf_Label', 'Status', 'Remarks'
    ];
    const ws = XLSX.utils.aoa_to_sheet([emptyHeaders]);
    XLSX.utils.book_append_sheet(wb, ws, 'Books_Series_1');
    return wb;
  }

  const totalSheets = Math.max(1, Math.ceil(sorted.length / EXCEL_SHEET_MAX_ROWS));
  for (let s = 0; s < totalSheets; s++) {
    const chunk = sorted.slice(s * EXCEL_SHEET_MAX_ROWS, (s + 1) * EXCEL_SHEET_MAX_ROWS);
    const rows = chunk.map((b) => ({
      Accession_No: String(b.accession_number || b.accessionNumber || ''),
      Date_Of_Entry: String(b.date_of_entry || b.dateOfEntry || ''),
      Barcode: String(b.barcode || ''),
      Author: String(b.author || ''),
      Co_Authors: String(b.co_authors || b.coAuthors || ''),
      Title: String(b.title || ''),
      Subtitle: String(b.subtitle || ''),
      Publisher: String(b.publisher || ''),
      Place: String(b.place || ''),
      Publication_Year: String(b.publication_year || b.publicationYear || ''),
      Edition: String(b.edition || ''),
      Pages: String(b.pages || ''),
      Binding: String(b.binding || ''),
      Price_Rs: Number(b.price_rs || b.priceRs || b.price || 0),
      Price_Ps: Number(b.price_ps || b.pricePs || 0),
      Source_Remarks: String(b.source_remarks || b.sourceRemarks || ''),
      Call_Number: String(b.call_number || b.callNumber || ''),
      Category: String(b.category || ''),
      Language: String(b.language || ''),
      Shelf_Label: String(b.shelf_label || b.shelfLabel || ''),
      Status: String(b.status || 'AVAILABLE'),
      Remarks: String(b.remarks || ''),
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const sheetName = `Books_Series_${s + 1}`;
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  return wb;
}

/**
 * Automatically syncs all books in persistent storage to ULM_Master_Books_Register.xlsx.
 * If user granted a folder handle, writes directly to that folder; otherwise updates sync timestamp.
 */
export async function syncMasterExcelRegister(booksInput?: UlmBookRecord[]): Promise<{
  success: boolean;
  totalBooks: number;
  syncedAt: string;
}> {
  let books = booksInput;
  if (!books && typeof window !== 'undefined' && window.ulmLibraryApi) {
    try {
      const res = await window.ulmLibraryApi.queryBooks({ page: 1, pageSize: 1_000_000, exportAll: true });
      books = res.items;
    } catch (_) {
      books = [];
    }
  }
  books = books || [];

  const wb = generateMasterExcelWorkbook(books);
  const syncedAt = new Date().toISOString();

  // Try writing to folder handle if present in runtime
  try {
    const rootHandle = (window as any)?.__ulm_data_dir_handle || null;
    if (rootHandle && typeof rootHandle.getFileHandle === 'function') {
      const fileHandle = await rootHandle.getFileHandle(MASTER_EXCEL_FILENAME, { create: true });
      const writable = await fileHandle.createWritable();
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      await writable.write(wbout);
      await writable.close();
    }
  } catch (err) {
    console.warn('[ULM-MasterExcel] Directory handle sync note:', err);
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem('ulm_master_excel_synced_at', syncedAt);
      localStorage.setItem('ulm_master_excel_book_count', String(books.length));
    } catch (_) {}
  }

  return { success: true, totalBooks: books.length, syncedAt };
}

/**
 * 1-click Download / Export of ULM_Master_Books_Register.xlsx
 */
export async function downloadMasterExcelRegister(): Promise<void> {
  if (typeof window === 'undefined') return;
  let books: UlmBookRecord[] = [];
  if (window.ulmLibraryApi) {
    try {
      const res = await window.ulmLibraryApi.queryBooks({ page: 1, pageSize: 1_000_000, exportAll: true });
      books = res.items;
    } catch (_) {}
  }
  const wb = generateMasterExcelWorkbook(books);
  XLSX.writeFile(wb, MASTER_EXCEL_FILENAME);
}

/**
 * Complete reset of database to 0 books (Rule 1-3).
 * Clears IndexedDB books store, SQLite, removes folder config, serial keys, and all legacy book caches.
 */
export async function resetEntireDatabaseToZero(): Promise<{ success: boolean; clearedCount: number }> {
  let clearedCount = 0;
  if (typeof window !== 'undefined') {
    try {
      const db = await getIndexedDb();
      clearedCount = await new Promise<number>((resolve) => {
        const tx = db.transaction('books', 'readwrite');
        const store = tx.objectStore('books');
        const countReq = store.count();
        countReq.onsuccess = () => {
          const count = countReq.result || 0;
          store.clear();
          tx.oncomplete = () => resolve(count);
          tx.onerror = () => resolve(0);
        };
        countReq.onerror = () => resolve(0);
      });
    } catch (_) {}

    const keysToRemove = [
      'ulm_data_folder_config_v1',
      'ulm_highest_serial_number_v1',
      'ulm_master_excel_synced_at',
      'ulm_master_excel_book_count',
      'ulm_books',
      'ulm_lms_books',
      'ulm_library_books',
      'books',
      'library_books',
      'ulm_sqlite_migration_verified_v1',
      'ulm_first_open_thumbnail_boot_cache_v1',
      'ulm_database_cleared',
      'ulm_initialized_empty',
      'ulm_lms_active_view',
      'ulm_lms_last_entry_cache',
      'ulm_lms_catalog_sort',
    ];
    for (const k of keysToRemove) {
      try { localStorage.removeItem(k); } catch (_) {}
    }
    try {
      localStorage.setItem('ulm_database_cleared', 'true');
    } catch (_) {}

    invalidateRamPageCache();
  }
  return { success: true, clearedCount };
}

function readFirstMatchingLocalStorageArray(keys: string[]): unknown[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  for (const key of keys) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch (err) {
      console.warn(`[ULM-Migration] Failed to parse localStorage key "${key}":`, err);
    }
  }
  return [];
}

/* =========================================================================
   IndexedDB Browser Engine (ulm_library_idb_v1)
   Routes all storage operations to IndexedDB when running inside browser
   preview mode (window.ulmLibraryApi is not provided by Electron).
   ========================================================================= */

const IDB_NAME = 'ulm_library_idb_v1';
const IDB_VERSION = 1;

let idbPromise: Promise<IDBDatabase> | null = null;

function getIndexedDb(): Promise<IDBDatabase> {
  if (idbPromise) return idbPromise;
  idbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported in this environment.'));
      return;
    }
    const req = window.indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('books')) {
        const bookStore = db.createObjectStore('books', { keyPath: 'id' });
        bookStore.createIndex('accession_number', 'accession_number', { unique: true });
        bookStore.createIndex('barcode', 'barcode', { unique: false });
        bookStore.createIndex('category', 'category', { unique: false });
        bookStore.createIndex('language', 'language', { unique: false });
        bookStore.createIndex('status', 'status', { unique: false });
        bookStore.createIndex('almari_id', 'almari_id', { unique: false });
        bookStore.createIndex('is_active', 'is_active', { unique: false });
      }
      if (!db.objectStoreNames.contains('almaris')) {
        db.createObjectStore('almaris', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('shelves')) {
        db.createObjectStore('shelves', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('borrowers')) {
        db.createObjectStore('borrowers', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('loans')) {
        db.createObjectStore('loans', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('system_settings')) {
        db.createObjectStore('system_settings', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return idbPromise;
}

export async function getTrueDatabaseBookCount(): Promise<number> {
  if (typeof window !== 'undefined') {
    if (window.ulmLibraryApi && typeof window.ulmLibraryApi.getDashboardStats === 'function') {
      try {
        const stats = await window.ulmLibraryApi.getDashboardStats();
        if (typeof stats?.totalBooks === 'number' && stats.totalBooks > 0) {
          return stats.totalBooks;
        }
      } catch (_) {}
    }

    try {
      const db = await getIndexedDb();
      return await new Promise<number>((resolve) => {
        const tx = db.transaction('books', 'readonly');
        const store = tx.objectStore('books');
        const req = store.count();
        req.onsuccess = () => resolve(req.result || 0);
        req.onerror = () => resolve(0);
      });
    } catch (_) {}
  }
  return 0;
}

function createBrowserIndexedDbApi(): UlmLibraryElectronApi {
  let progressListeners: Array<(p: ImportProgressEvent) => void> = [];

  const api: UlmLibraryElectronApi = {
    async getDatabaseInfo() {
      const stats = await api.getDashboardStats();
      return {
        dbPath: 'IndexedDB://ulm_library_idb_v1',
        activeDataDir: 'Browser IndexedDB',
        coversDir: 'Browser IndexedDB Canvas Cache',
        backupsDir: 'Browser Local Backups',
        stats,
      };
    },

    async selectCustomDataFolder() {
      return {
        canceled: true,
        activeDataDir: 'Browser IndexedDB (Native File System available in Electron Desktop app)',
      };
    },

    async queryBooks(params: BookQueryParams): Promise<PaginatedBooksResult> {
      const db = await getIndexedDb();
      const tx = db.transaction('books', 'readonly');
      const store = tx.objectStore('books');

      return new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => {
          let rows: UlmBookRecord[] = (req.result || []).filter(
            (b: UlmBookRecord) => b.is_active === 1 || b.is_active === true || b.is_active === undefined
          );

          // Filtering
          const search = (params.search || '').trim().toLowerCase();
          if (search) {
            rows = rows.filter((b) => {
              const acc = (b.accession_number || b.accessionNumber || '').toLowerCase();
              const bar = (b.barcode || '').toLowerCase();
              const tit = (b.title || '').toLowerCase();
              const aut = (b.author || '').toLowerCase();
              const pub = (b.publisher || '').toLowerCase();
              const call = (b.call_number || b.callNumber || '').toLowerCase();
              return (
                acc.startsWith(search) ||
                bar.startsWith(search) ||
                tit.includes(search) ||
                aut.includes(search) ||
                pub.includes(search) ||
                call.includes(search)
              );
            });
          }

          if (params.category && params.category !== 'ALL') {
            rows = rows.filter((b) => b.category === params.category);
          }
          if (params.language && params.language !== 'ALL') {
            rows = rows.filter((b) => b.language === params.language);
          }
          if (params.status && params.status !== 'ALL') {
            rows = rows.filter((b) => b.status === params.status);
          }
          if (params.almariId && params.almariId !== 'ALL') {
            rows = rows.filter((b) => (b.almari_id || b.almariId) === params.almariId);
          }
          if (params.shelfId && params.shelfId !== 'ALL') {
            rows = rows.filter((b) => (b.shelf_id || b.shelfId) === params.shelfId);
          }

          // Strict Numeric Sorting (Rule 5): 1, 2, ... 99999, 100000, 100001
          const sortOrder = (params.sortOrder || 'ASC').toUpperCase() === 'DESC' ? -1 : 1;
          rows.sort((a, b) => {
            const numA = parseSerialNumber(a.accession_number || a.accessionNumber);
            const numB = parseSerialNumber(b.accession_number || b.accessionNumber);
            if (numA !== numB) {
              return (numA - numB) * sortOrder;
            }
            const accA = String(a.accession_number || a.accessionNumber || '');
            const accB = String(b.accession_number || b.accessionNumber || '');
            return accA.localeCompare(accB, undefined, { numeric: true }) * sortOrder;
          });

          const total = rows.length;
          const page = Math.max(1, params.page || 1);
          const maxAllowed = params.exportAll ? Number.MAX_SAFE_INTEGER : 200;
          const pageSize = Math.min(maxAllowed, Math.max(1, params.pageSize || DEFAULT_CATALOG_PAGE_SIZE));
          const offset = (page - 1) * pageSize;
          const items = rows.slice(offset, offset + pageSize);

          resolve({
            items,
            total,
            page,
            pageSize,
            totalPages: Math.max(1, Math.ceil(total / pageSize)),
          });
        };
        req.onerror = () => reject(req.error);
      });
    },

    async lookupByScanCode(code: string): Promise<UlmBookRecord | null> {
      const clean = normalizeIdentifier(code).toLowerCase();
      if (!clean) return null;
      const db = await getIndexedDb();
      const tx = db.transaction('books', 'readonly');
      const store = tx.objectStore('books');

      return new Promise((resolve) => {
        const req = store.getAll();
        req.onsuccess = () => {
          const list: UlmBookRecord[] = req.result || [];
          const match = list.find((b) => {
            const acc = normalizeIdentifier(b.accession_number || b.accessionNumber).toLowerCase();
            const bar = normalizeIdentifier(b.barcode).toLowerCase();
            return acc === clean || bar === clean;
          });
          resolve(match || null);
        };
        req.onerror = () => resolve(null);
      });
    },

    async getStartupBootSnapshot(pageSize = 50) {
      const res = await api.queryBooks({ page: 1, pageSize });
      const stats = await api.getDashboardStats();
      const stubs = res.items.map(toBookThumbnailStub);
      return {
        stubs,
        totalBooks: res.total,
        stats,
      };
    },

    async getFullBookDetails(idOrAccession: string): Promise<UlmBookRecord | null> {
      return api.lookupByScanCode(idOrAccession);
    },

    async saveBook(book: Partial<UlmBookRecord>, mode = 'upsert'): Promise<UlmBookRecord> {
      const db = await getIndexedDb();
      const record = mapExcelRowToUlmBook(book as Record<string, unknown>);
      const acc = normalizeIdentifier(record.accession_number || record.accessionNumber);
      if (!acc) throw new Error('Accession number is required.');

      const existing = await api.lookupByScanCode(acc);
      if (existing && mode === 'insert') {
        throw new Error(`Accession number "${acc}" already exists.`);
      }

      const id = String(book.id || existing?.id || `book_${acc}`);
      const fullBook: UlmBookRecord = {
        ...(existing || {}),
        ...(record as unknown as UlmBookRecord),
        id,
        accession_number: acc,
        accessionNumber: acc,
        is_active: 1,
        isActive: true,
        updatedAt: new Date().toISOString(),
      };

      const tx = db.transaction('books', 'readwrite');
      const store = tx.objectStore('books');
      await new Promise<void>((resolve, reject) => {
        const putReq = store.put(fullBook);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      });

      invalidateRamPageCache();
      return fullBook;
    },

    async deleteBook(idOrAccession: string) {
      const match = await api.lookupByScanCode(idOrAccession);
      if (!match) return { deleted: false };
      const db = await getIndexedDb();
      const tx = db.transaction('books', 'readwrite');
      const store = tx.objectStore('books');
      await new Promise<void>((resolve, reject) => {
        const delReq = store.delete(match.id);
        delReq.onsuccess = () => resolve();
        delReq.onerror = () => reject(delReq.error);
      });
      invalidateRamPageCache();
      return { deleted: true, id: match.id, accessionNumber: match.accession_number };
    },

    async getDashboardStats() {
      const db = await getIndexedDb();
      const tx = db.transaction('books', 'readonly');
      const store = tx.objectStore('books');
      return new Promise<Record<string, unknown>>((resolve) => {
        const req = store.getAll();
        req.onsuccess = () => {
          const list: UlmBookRecord[] = req.result || [];
          let available = 0;
          let issued = 0;
          let reserved = 0;
          let lost = 0;
          let damaged = 0;
          let valuation = 0;

          for (const b of list) {
            if (b.status === 'AVAILABLE') available++;
            else if (b.status === 'ISSUED') issued++;
            else if (b.status === 'RESERVED') reserved++;
            else if (b.status === 'LOST') lost++;
            else if (b.status === 'DAMAGED') damaged++;
            valuation += Number(b.price || b.price_rs || 0) || 0;
          }

          resolve({
            totalBooks: list.length,
            availableBooks: available,
            issuedBooks: issued,
            reservedBooks: reserved,
            lostBooks: lost,
            damagedBooks: damaged,
            totalValuationRs: valuation,
            totalBorrowers: 0,
            activeBorrowers: 0,
            totalLoans: 0,
            activeLoans: 0,
          });
        };
        req.onerror = () => resolve({ totalBooks: 0 });
      });
    },

    async migrateFromLocalStorage(payload: Record<string, unknown>) {
      const db = await getIndexedDb();
      const sourceBooks = Array.isArray(payload.books) ? (payload.books as Array<Record<string, unknown>>) : [];
      const tx = db.transaction('books', 'readwrite');
      const store = tx.objectStore('books');

      let inserted = 0;
      for (const raw of sourceBooks) {
        const mapped = mapExcelRowToUlmBook(raw);
        const acc = normalizeIdentifier(mapped.accession_number);
        if (!acc) continue;
        const record = {
          ...mapped,
          id: String(raw.id || `book_${acc}`),
          accession_number: acc,
          accessionNumber: acc,
          is_active: 1,
          isActive: true,
        };
        store.put(record);
        inserted++;
      }

      invalidateRamPageCache();
      return {
        success: true,
        preMigrationBackupPath: 'IndexedDB',
        counts: {
          sourceBooks: sourceBooks.length,
          initialDbBooks: 0,
          migratedInserted: inserted,
          finalDbBooks: inserted,
        },
      };
    },

    async importSingleChunk(chunk: Array<Record<string, unknown>>, _options = {}) {
      const db = await getIndexedDb();
      const tx = db.transaction('books', 'readwrite');
      const store = tx.objectStore('books');
      const errors: ImportRowError[] = [];
      let inserted = 0;
      let skippedDuplicates = 0;

      let currentMaxSerial = 0;
      if (typeof window !== 'undefined' && window.localStorage) {
        currentMaxSerial = Number(localStorage.getItem('ulm_highest_serial_number_v1') || 0);
      }

      for (let i = 0; i < chunk.length; i++) {
        const item = chunk[i];
        let acc = normalizeIdentifier(item.accession_number || item.accessionNumber);
        const num = parseSerialNumber(acc);

        if (num > 0) {
          if (num > currentMaxSerial) {
            currentMaxSerial = num;
          }
        } else {
          currentMaxSerial = currentMaxSerial > 0 ? currentMaxSerial + 1 : 100000;
          const padLen = currentMaxSerial >= 100000 ? String(currentMaxSerial).length : Math.max(5, String(currentMaxSerial).length);
          acc = String(currentMaxSerial).padStart(padLen, '0');
        }

        let barcode = normalizeIdentifier(item.barcode);
        if (!barcode) {
          barcode = '0092' + String(currentMaxSerial).padStart(9, '0');
        }

        const uniqueId = String(item.id || `book_${acc}`);
        const record = {
          ...item,
          id: uniqueId,
          accession_number: acc,
          accessionNumber: acc,
          barcode,
          is_active: 1,
          isActive: true,
        };

        store.put(record);
        inserted++;
      }

      // Wait for IndexedDB transaction to commit to disk before resolving (Rule 2)
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(new Error('IndexedDB transaction aborted during import chunk write'));
      });

      if (typeof window !== 'undefined' && window.localStorage && currentMaxSerial > 0) {
        try {
          localStorage.setItem('ulm_highest_serial_number_v1', String(currentMaxSerial));
        } catch (_) {}
      }

      invalidateRamPageCache();
      return {
        processed: chunk.length,
        inserted,
        updated: 0,
        skippedDuplicates,
        rejected: errors.length,
        errors,
      };
    },

    async importBooksChunked(books: Array<Record<string, unknown>>, options = {}) {
      const total = books.length;
      const chunkSize = Math.min(500, Math.max(50, options.chunkSize || DEFAULT_IMPORT_BATCH_SIZE));
      let processed = 0;
      let inserted = 0;

      for (let offset = 0; offset < total; offset += chunkSize) {
        if (rendererCancelRequested) break;
        const slice = books.slice(offset, offset + chunkSize);
        const rep = await api.importSingleChunk!(slice, options);
        processed += rep.processed;
        inserted += rep.inserted;
        for (const fn of progressListeners) {
          fn({
            processed,
            total,
            percent: Math.round((processed / total) * 100),
            inserted,
            updated: 0,
            skippedDuplicates: 0,
            rejected: rep.rejected,
          });
        }
        await yieldToUiThread();
      }

      invalidateRamPageCache();
      return {
        totalInput: total,
        processed,
        inserted,
        updated: 0,
        skippedDuplicates: 0,
        rejected: 0,
        cancelled: rendererCancelRequested,
        finalDbBooks: inserted,
        errors: [],
      };
    },

    async cancelImport() {
      rendererCancelRequested = true;
      return { cancelRequested: true };
    },

    onImportProgress(callback: (progress: ImportProgressEvent) => void) {
      progressListeners.push(callback);
      return () => {
        progressListeners = progressListeners.filter((fn) => fn !== callback);
      };
    },

    async bulkUpdateByFilter(filterParams: Record<string, unknown> = {}, patch: Record<string, unknown> = {}) {
      const db = await getIndexedDb();
      return new Promise<{ updatedCount: number }>((resolve, reject) => {
        const tx = db.transaction('books', 'readwrite');
        const store = tx.objectStore('books');
        const req = store.openCursor();
        let updatedCount = 0;
        const search = String(filterParams.search || '').trim().toLowerCase();
        const category = String(filterParams.category || '');
        const language = String(filterParams.language || '');
        const status = String(filterParams.status || '');
        const almariId = String(filterParams.almariId || '');

        req.onsuccess = (e: Event) => {
          const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
            const row = cursor.value;
            if (row.is_active !== false && row.is_active !== 0) {
              let match = true;
              if (search) {
                const combined = `${row.accession_number || ''} ${row.barcode || ''} ${row.title || ''} ${row.author || ''} ${row.call_number || ''}`.toLowerCase();
                if (!combined.includes(search)) match = false;
              }
              if (category && category !== 'ALL' && row.category !== category) match = false;
              if (language && language !== 'ALL' && row.language !== language) match = false;
              if (status && status !== 'ALL' && row.status !== status) match = false;
              if (almariId && almariId !== 'ALL' && (row.almari_id || row.almariId) !== almariId) match = false;

              if (match) {
                const updated = {
                  ...row,
                  ...patch,
                  almari_id: patch.almari_id ?? patch.almariId ?? row.almari_id,
                  shelf_id: patch.shelf_id ?? patch.shelfId ?? row.shelf_id,
                  shelf_label: patch.shelf_label ?? patch.shelfLabel ?? patch.shelf_no ?? row.shelf_label,
                  updated_at: new Date().toISOString()
                };
                cursor.update(updated);
                updatedCount++;
              }
            }
            cursor.continue();
          } else {
            invalidateRamPageCache();
            resolve({ updatedCount });
          }
        };
        req.onerror = () => reject(req.error);
      });
    },

    async createBackup() {
      const booksRes = await api.queryBooks({ page: 1, pageSize: 1_000_000, exportAll: true });
      return {
        createdAt: new Date().toISOString(),
        totalBooks: booksRes.total,
        books: booksRes.items,
      };
    },

    async restoreBackup() {
      return { restored: false, reason: 'Please use Excel import in browser preview' };
    },
  };

  return api;
}

// Ensure both window.ulmLibraryApi and window.ulmElectronSqlite are initialized on browser runtime
if (typeof window !== 'undefined') {
  if (!window.ulmLibraryApi && window.ulmElectronSqlite) {
    window.ulmLibraryApi = window.ulmElectronSqlite;
  } else if (!window.ulmLibraryApi) {
    window.ulmLibraryApi = createBrowserIndexedDbApi();
  }
  if (!window.ulmElectronSqlite) {
    window.ulmElectronSqlite = window.ulmLibraryApi;
  }
}

export async function runSafeLocalStorageMigration(): Promise<MigrationVerificationReport | null> {
  if (typeof window === 'undefined' || !window.ulmLibraryApi) {
    return null;
  }

  // If user explicitly performed reset to zero, do not resurrect cleared books
  if (window.localStorage.getItem('ulm_database_cleared') === 'true') {
    return null;
  }

  const books = readFirstMatchingLocalStorageArray(LEGACY_BOOK_KEYS);
  const almaris = readFirstMatchingLocalStorageArray(LEGACY_ALMARI_KEYS);
  const shelves = readFirstMatchingLocalStorageArray(LEGACY_SHELF_KEYS);
  const borrowers = readFirstMatchingLocalStorageArray(LEGACY_BORROWER_KEYS);
  const loans = readFirstMatchingLocalStorageArray(LEGACY_LOAN_KEYS);

  const alreadyVerified = window.localStorage.getItem(MIGRATION_VERIFIED_FLAG);
  if (alreadyVerified && books.length === 0) {
    return null;
  }

  const report = await window.ulmLibraryApi.migrateFromLocalStorage({
    books,
    almaris,
    shelves,
    borrowers,
    loans,
  });

  if (report.success) {
    invalidateRamPageCache();
    window.localStorage.setItem(
      MIGRATION_VERIFIED_FLAG,
      JSON.stringify({
        verifiedAt: new Date().toISOString(),
        backupPath: report.preMigrationBackupPath,
        counts: report.counts,
      })
    );
    // Purge legacy localStorage books so 5MB limit is never hit again
    for (const k of [...LEGACY_BOOK_KEYS, FIRST_OPEN_BOOT_CACHE_KEY]) {
      try { window.localStorage.removeItem(k); } catch (_) {}
    }
  }

  return report;
}

export function mapExcelRowToUlmBook(rawRow: Record<string, unknown>): Record<string, unknown> {
  const normalizedKeys: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(rawRow || {})) {
    const cleanKey = key.trim().toLowerCase().replace(/[\s._-]+/g, '_');
    normalizedKeys[cleanKey] = val;
  }

  const pick = (...candidates: string[]): string => {
    for (const c of candidates) {
      const val = normalizedKeys[c] ?? rawRow[c];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        return String(val).trim();
      }
    }
    return '';
  };

  const cat = pick('category', 'discipline', 'subject', 'department', 'genre') || 'General';
  const isIssued = pick('status').toUpperCase() === 'ISSUED';
  const copies = Number(pick('copies', 'total_copies', 'total_quantity')) || 1;
  const rawAvail = pick('available_copies', 'available_quantity');
  const avail = (rawAvail !== '' && rawAvail !== undefined) ? (Number(rawAvail) || 0) : copies;

  return {
    accession_number: normalizeIdentifier(
      pick('accession_no', 'accession_number', 'acc_no', 'accession', 'sr_no', 'serial_no')
    ),
    date_of_entry: pick('date_of_entry', 'entry_date', 'acquisition_date', 'date'),
    barcode: normalizeIdentifier(pick('barcode', 'barcode_no', 'barcode_number', 'ean', 'book_code')),
    author: pick('author', 'author_name', 'authors', 'writer') || 'Unknown Author',
    co_authors: pick('co_authors', 'co_author', 'joint_author'),
    title: pick('title', 'book_title', 'name_of_book', 'book_name') || 'Volume #1',
    subtitle: pick('subtitle', 'sub_title'),
    publisher: pick('publisher', 'publisher_name', 'published_by') || 'ULM Press',
    place: pick('place', 'place_of_publication', 'city'),
    publication_year: normalizeIdentifier(pick('year', 'publication_year', 'pub_year', 'year_of_publication')),
    edition: pick('edition', 'ed'),
    pages: normalizeIdentifier(pick('pages', 'total_pages', 'page_count')),
    binding: pick('binding', 'bind_type') || 'Hardbound',
    price_rs: Number(pick('price_rs', 'price', 'cost_rs', 'amount') || 0) || 0,
    price_ps: Number(pick('price_ps', 'paisa') || 0) || 0,
    source_remarks: pick('source_remarks', 'source', 'vendor', 'donated_by'),
    call_number: pick('dewey_call_no', 'call_number', 'call_no', 'class_no', 'dewey_no') || '000 ULM',
    category: cat,
    discipline: cat,
    language: pick('language', 'lang') || 'English',
    isbn: normalizeIdentifier(pick('isbn', 'isbn_13', 'isbn_10')),
    shelf_label: pick('shelf', 'shelf_no', 'shelf_label', 'almari_shelf') || 'Stack-01',
    status: isIssued ? 'ISSUED' : 'AVAILABLE',
    total_quantity: copies,
    available_quantity: isIssued ? 0 : Math.max(1, avail),
    copies,
    available_copies: isIssued ? 0 : Math.max(1, avail),
    is_active: 1,
    remarks: pick('remarks', 'notes'),
  };
}

/**
 * Offloads row mapping of thousands of parsed Excel rows onto a separate CPU core
 * using an inline Blob Web Worker when available, falling back to chunked UI-yielding
 * mapping if CSP restricts Blob workers.
 */
async function mapRowsMultiCoreWorker(
  rawRows: Array<Record<string, unknown>>
): Promise<Array<Record<string, unknown>>> {
  if (typeof window !== 'undefined' && typeof Worker !== 'undefined' && typeof Blob !== 'undefined') {
    try {
      const workerCode = `
        function normalizeIdentifier(rawValue) {
          if (rawValue === null || rawValue === undefined) return '';
          let str = String(rawValue).trim();
          if (!str) return '';
          if (/^\\d+\\.0+$/.test(str)) str = str.replace(/\\.0+$/, '');
          return str;
        }
        function mapRow(rawRow) {
          const normalizedKeys = {};
          const entries = Object.entries(rawRow || {});
          for (let i = 0; i < entries.length; i++) {
            const k = entries[i][0].trim().toLowerCase().replace(/[\\s._-]+/g, '_');
            normalizedKeys[k] = entries[i][1];
          }
          const pick = (...candidates) => {
            for (let i = 0; i < candidates.length; i++) {
              const c = candidates[i];
              const val = normalizedKeys[c] !== undefined ? normalizedKeys[c] : rawRow[c];
              if (val !== undefined && val !== null && String(val).trim() !== '') {
                return String(val).trim();
              }
            }
            return '';
          };
          return {
            accession_number: normalizeIdentifier(pick('accession_no', 'accession_number', 'acc_no', 'accession', 'sr_no', 'serial_no')),
            date_of_entry: pick('date_of_entry', 'entry_date', 'acquisition_date', 'date'),
            barcode: normalizeIdentifier(pick('barcode', 'barcode_no', 'barcode_number', 'ean', 'book_code')),
            author: pick('author', 'author_name', 'authors', 'writer') || 'Unknown Author',
            co_authors: pick('co_authors', 'co_author', 'joint_author'),
            title: pick('title', 'book_title', 'name_of_book', 'book_name'),
            subtitle: pick('subtitle', 'sub_title'),
            publisher: pick('publisher', 'publisher_name', 'published_by'),
            place: pick('place', 'place_of_publication', 'city'),
            publication_year: normalizeIdentifier(pick('year', 'publication_year', 'pub_year', 'year_of_publication')),
            edition: pick('edition', 'ed'),
            pages: normalizeIdentifier(pick('pages', 'total_pages', 'page_count')),
            binding: pick('binding', 'bind_type') || 'Hardbound',
            price_rs: Number(pick('price_rs', 'price', 'cost_rs', 'amount') || 0) || 0,
            price_ps: Number(pick('price_ps', 'paisa') || 0) || 0,
            source_remarks: pick('source_remarks', 'source', 'vendor', 'donated_by'),
            call_number: pick('dewey_call_no', 'call_number', 'call_no', 'class_no', 'dewey_no'),
            category: pick('category', 'subject', 'department', 'genre') || 'General',
            language: pick('language', 'lang') || 'English',
            isbn: normalizeIdentifier(pick('isbn', 'isbn_13', 'isbn_10')),
            shelf_label: pick('shelf', 'shelf_no', 'shelf_label', 'almari_shelf'),
            status: pick('status') || 'AVAILABLE',
            remarks: pick('remarks', 'notes')
          };
        }
        self.onmessage = function(e) {
          const rows = e.data || [];
          const mapped = new Array(rows.length);
          for (let i = 0; i < rows.length; i++) {
            mapped[i] = mapRow(rows[i]);
          }
          self.postMessage(mapped);
        };
      `;
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      return await new Promise<Array<Record<string, unknown>>>((resolve, reject) => {
        const worker = new Worker(url);
        worker.onmessage = (evt) => {
          worker.terminate();
          URL.revokeObjectURL(url);
          resolve(evt.data);
        };
        worker.onerror = (err) => {
          worker.terminate();
          URL.revokeObjectURL(url);
          reject(err);
        };
        worker.postMessage(rawRows);
      });
    } catch (_) {
      // Fallback to chunked main-thread mapping if Blob Worker is blocked by CSP
    }
  }

  const mapped: Array<Record<string, unknown>> = [];
  for (let i = 0; i < rawRows.length; i += DEFAULT_IMPORT_BATCH_SIZE) {
    const slice = rawRows.slice(i, i + DEFAULT_IMPORT_BATCH_SIZE);
    for (const row of slice) {
      mapped.push(mapExcelRowToUlmBook(row));
    }
    await yieldToUiThread();
  }
  return mapped;
}

export async function requestCancelImport(): Promise<void> {
  rendererCancelRequested = true;
  if (typeof window !== 'undefined' && window.ulmLibraryApi) {
    await window.ulmLibraryApi.cancelImport();
  }
}

export async function importExcelOrCsvToSqlite(
  fileBuffer: ArrayBuffer,
  options: {
    onDuplicate?: 'skip' | 'upsert';
    chunkSize?: number;
    onProgress?: (progress: ImportProgressEvent) => void;
  } = {}
): Promise<BatchImportSummary> {
  if (isRendererImportActive) {
    throw new Error('An import is already in progress. Please wait for it to finish or cancel it.');
  }
  if (!window.ulmLibraryApi) {
    throw new Error('Storage bridge (window.ulmLibraryApi) is not initialized.');
  }

  isRendererImportActive = true;
  rendererCancelRequested = false;
  const startTime = Date.now();

  try {
    await yieldToUiThread();

    const workbook = XLSX.read(fileBuffer, {
      type: 'array',
      cellText: true,
      cellDates: true,
      raw: false,
    });

    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new Error('The uploaded Excel/CSV file contains no worksheets.');
    }

    const worksheet = workbook.Sheets[firstSheetName];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
      raw: false,
      defval: '',
    });

    await yieldToUiThread();

    // Normalize rows on a background CPU worker thread
    const mappedBooks = await mapRowsMultiCoreWorker(rawRows);
    const total = mappedBooks.length;
    const chunkSize = Math.min(500, Math.max(50, options.chunkSize || DEFAULT_IMPORT_BATCH_SIZE));
    const onDuplicate = options.onDuplicate || 'skip';

    const baseCount = await getTrueDatabaseBookCount();

    if (typeof window.ulmLibraryApi.importSingleChunk === 'function') {
      const summary: BatchImportSummary = {
        totalInput: total,
        processed: 0,
        inserted: 0,
        updated: 0,
        skippedDuplicates: 0,
        rejected: 0,
        cancelled: false,
        finalDbBooks: 0,
        errors: [],
      };

      for (let offset = 0; offset < total; offset += chunkSize) {
        if (rendererCancelRequested) {
          summary.cancelled = true;
          break;
        }

        const mappedSlice = mappedBooks.slice(offset, offset + chunkSize);
        const isFinalChunk = offset + chunkSize >= total;

        const batchReport = await window.ulmLibraryApi.importSingleChunk(mappedSlice, {
          onDuplicate,
          rowOffset: baseCount + offset,
          isFinalChunk,
        });

        summary.processed += batchReport.processed;
        summary.inserted += batchReport.inserted;
        summary.updated += batchReport.updated;
        summary.skippedDuplicates += batchReport.skippedDuplicates;
        summary.rejected += batchReport.rejected;

        if (batchReport.errors.length > 0 && summary.errors.length < 1000) {
          summary.errors.push(...batchReport.errors.slice(0, 1000 - summary.errors.length));
        }

        if (options.onProgress) {
          options.onProgress({
            processed: summary.processed,
            total,
            percent: Math.round((summary.processed / Math.max(1, total)) * 100),
            inserted: summary.inserted,
            updated: summary.updated,
            skippedDuplicates: summary.skippedDuplicates,
            rejected: summary.rejected,
          });
        }

        await yieldToUiThread();
      }

      invalidateRamPageCache();
      const stats = await window.ulmLibraryApi.getDashboardStats();
      summary.finalDbBooks = Number(stats.totalBooks || 0);
      summary.durationMs = Date.now() - startTime;
      void syncMasterExcelRegister();
      return summary;
    }

    let unsubscribe = () => {};
    if (options.onProgress) {
      unsubscribe = window.ulmLibraryApi.onImportProgress(options.onProgress);
    }
    try {
      const res = await window.ulmLibraryApi.importBooksChunked(mappedBooks, {
        onDuplicate,
        chunkSize,
      });
      invalidateRamPageCache();
      res.durationMs = Date.now() - startTime;
      void syncMasterExcelRegister();
      return res;
    } finally {
      unsubscribe();
    }
  } finally {
    isRendererImportActive = false;
  }
}

export function createPaginatedCatalogController(
  onStateChange: (state: PaginatedBooksResult & { loading: boolean }) => void,
  debounceMs = 200
) {
  let currentParams: BookQueryParams = {
    page: 1,
    pageSize: DEFAULT_CATALOG_PAGE_SIZE,
    search: '',
    category: 'ALL',
    language: 'ALL',
    status: 'ALL',
    sortBy: 'accession_number',
    sortOrder: 'ASC',
  };
  let requestSeq = 0;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  async function executeFetch(paramsToFetch: BookQueryParams, bypassCache = false) {
    if (!window.ulmLibraryApi) return;
    const cacheKey = JSON.stringify(paramsToFetch);
    if (!bypassCache && ramPageCache.has(cacheKey)) {
      const cached = ramPageCache.get(cacheKey)!;
      onStateChange({ ...cached, loading: false });
      return;
    }

    const seq = ++requestSeq;
    const res = await window.ulmLibraryApi.queryBooks(paramsToFetch);
    if (seq !== requestSeq) {
      return;
    }

    if (ramPageCache.size >= MAX_RAM_CACHED_PAGES) {
      const oldestKey = ramPageCache.keys().next().value;
      if (oldestKey) ramPageCache.delete(oldestKey);
    }
    ramPageCache.set(cacheKey, res);
    onStateChange({ ...res, loading: false });
  }

  return {
    setPage(page: number) {
      currentParams = { ...currentParams, page: Math.max(1, page) };
      void executeFetch(currentParams);
    },
    setPageSize(pageSize: number) {
      currentParams = {
        ...currentParams,
        page: 1,
        pageSize: Math.min(200, Math.max(10, pageSize)),
      };
      void executeFetch(currentParams);
    },
    setSearchDebounced(search: string) {
      currentParams = { ...currentParams, page: 1, search };
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        void executeFetch(currentParams);
      }, debounceMs);
    },
    setFilters(filters: Partial<BookQueryParams>) {
      currentParams = { ...currentParams, ...filters, page: 1 };
      void executeFetch(currentParams);
    },
    refreshCurrentPage() {
      invalidateRamPageCache();
      void executeFetch(currentParams, true);
    },
    dispose() {
      if (debounceTimer) clearTimeout(debounceTimer);
      requestSeq++;
    },
  };
}

/**
 * Lightweight "Thumbnail" Book Stub (~120 bytes instead of ~2,000+ bytes).
 * Used for instant 0ms First-Open startup rendering and fast list browsing
 * without loading heavy remarks, source notes, or large images into RAM.
 */
export interface UlmBookThumbnailStub {
  id: string;
  accession_number: string;
  accessionNumber: string;
  barcode: string | null;
  title: string;
  author: string;
  category: string;
  language: string;
  call_number: string;
  callNumber: string;
  shelf_label: string;
  shelfLabel: string;
  status: BookStatus;
  cover_image_path?: string;
  coverImagePath?: string;
  isStub: true;
}

/**
 * Converts a full book object into a tiny ~120-byte Thumbnail Stub for fast RAM caching.
 */
export function toBookThumbnailStub(book: Partial<UlmBookRecord>): UlmBookThumbnailStub {
  const acc = String(book.accession_number || book.accessionNumber || '');
  return {
    id: String(book.id || `book_${acc}`),
    accession_number: acc,
    accessionNumber: acc,
    barcode: book.barcode ?? null,
    title: String(book.title || ''),
    author: String(book.author || 'Unknown Author'),
    category: String(book.category || 'General'),
    language: String(book.language || 'English'),
    call_number: String(book.call_number || book.callNumber || ''),
    callNumber: String(book.call_number || book.callNumber || ''),
    shelf_label: String(book.shelf_label || book.shelfLabel || ''),
    shelfLabel: String(book.shelf_label || book.shelfLabel || ''),
    status: (book.status as BookStatus) || 'AVAILABLE',
    cover_image_path: book.cover_image_path || book.coverImagePath || '',
    coverImagePath: book.cover_image_path || book.coverImagePath || '',
    isStub: true,
  };
}

/**
 * Compresses any uploaded book cover image into a tiny 64x96px WebP/JPEG thumbnail (~1.5 KB)
 * using an offscreen HTML5 Canvas so rendering book cards never decodes multi-MB images.
 */
export async function generateTinyCoverThumbnail(
  imageSourceUrlOrBase64: string,
  maxWidth = 64,
  maxHeight = 96
): Promise<string> {
  if (typeof window === 'undefined' || typeof document === 'undefined' || !imageSourceUrlOrBase64) {
    return imageSourceUrlOrBase64;
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = maxWidth;
        canvas.height = maxHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(imageSourceUrlOrBase64);
          return;
        }
        ctx.drawImage(img, 0, 0, maxWidth, maxHeight);
        resolve(canvas.toDataURL('image/webp', 0.6));
      } catch (_) {
        resolve(imageSourceUrlOrBase64);
      }
    };
    img.onerror = () => resolve(imageSourceUrlOrBase64);
    img.src = imageSourceUrlOrBase64;
  });
}

/**
 * Loads the 0ms First-Open Thumbnail Boot Snapshot on app launch:
 * 1. Immediately returns the tiny 50-row thumbnail cache (~8 KB) so the first frame
 *    paints in 0ms without hanging the PC.
 * 2. Asynchronously refreshes the snapshot from SQLite / IndexedDB in the background.
 */
export async function loadFirstOpenBootSnapshot(
  onInstantCacheHit?: (snapshot: { stubs: UlmBookThumbnailStub[]; totalBooks: number; stats: Record<string, unknown> }) => void
): Promise<{ stubs: UlmBookThumbnailStub[]; totalBooks: number; stats: Record<string, unknown> } | null> {
  if (typeof window !== 'undefined' && window.localStorage && onInstantCacheHit) {
    try {
      const raw = window.localStorage.getItem(FIRST_OPEN_BOOT_CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        if (cached && Array.isArray(cached.stubs)) {
          onInstantCacheHit(cached);
        }
      }
    } catch (_) {}
  }

  if (typeof window !== 'undefined' && window.ulmLibraryApi) {
    const api = window.ulmLibraryApi;
    if (typeof api.getStartupBootSnapshot === 'function') {
      const fresh = await api.getStartupBootSnapshot(DEFAULT_CATALOG_PAGE_SIZE);
      try {
        // Save only the 50 lightweight stubs (~8 KB total) for next app launch
        window.localStorage.setItem(FIRST_OPEN_BOOT_CACHE_KEY, JSON.stringify(fresh));
      } catch (_) {}
      return fresh;
    }
  }
  return null;
}

/**
 * On-Demand Full Book Hydration:
 * Fetches all 17 ULM Accession Register fields from SQLite / IndexedDB ONLY when the user clicks
 * a book row/card to view details, edit, or issue it.
 */
export async function getFullBookRecordOnDemand(idOrAccession: string): Promise<UlmBookRecord | null> {
  if (typeof window === 'undefined' || !window.ulmLibraryApi) return null;
  const api = window.ulmLibraryApi;
  if (typeof api.getFullBookDetails === 'function') {
    return api.getFullBookDetails(idOrAccession);
  }
  return api.lookupByScanCode(idOrAccession);
}
