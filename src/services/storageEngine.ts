/**
 * University of Lakki Marwat (ULM) Central Digital Library System
 * Dual Storage & Persistence Engine (SQLite Electron IPC + Browser LocalStorage Fallback)
 */

export interface StorageBookRecord {
  accession: string;
  title: string;
  author: string;
  isbn: string;
  category: string;
  almariId: string;
  shelfId: string;
  status: 'AVAILABLE' | 'ISSUED' | 'LOST' | 'RESERVED';
  edition?: string;
  publicationYear?: number;
  updatedAt: string;
}

export interface StorageMemberRecord {
  memberId: string;
  name: string;
  rollNo: string;
  dept: string;
  program: string;
  session: string;
  bloodGroup: string;
  phone: string;
  role: 'STUDENT CARD' | 'FACULTY CARD' | 'STAFF CARD' | 'RESEARCH SCHOLAR';
  borrowingLimit: string;
  cardExpiry: string;
  photoUrl?: string;
  updatedAt: string;
}

export interface StorageAlmariRecord {
  almariId: string;
  almariCode: string;
  nameEn: string;
  location: string;
  category: string;
  shelfCount: number;
  shelfCapacities: Record<number, number>;
  updatedAt: string;
}

export interface StorageCirculationRecord {
  transactionId: string;
  bookId: string;
  accession: string;
  memberId: string;
  issueDate: string;
  dueDate: string;
  returnDate: string | null;
  fine: number;
  status: 'ACTIVE' | 'RETURNED' | 'OVERDUE';
  updatedAt: string;
}

export interface FullLibraryBackupPayload {
  schemaVersion: string;
  institution: string;
  exportedAt: string;
  engineMode: 'SQLITE_IPC' | 'LOCAL_STORAGE';
  counts: {
    books: number;
    members: number;
    almaris: number;
    circulation: number;
  };
  data: {
    books: StorageBookRecord[];
    members: StorageMemberRecord[];
    almaris: StorageAlmariRecord[];
    circulation: StorageCirculationRecord[];
  };
}

export interface BackupImportVerificationResult {
  valid: boolean;
  schemaVersion: string;
  restoredCounts: {
    books: number;
    members: number;
    almaris: number;
    circulation: number;
  };
  errors: string[];
}

interface ElectronSqliteBridge {
  sqliteQuery?: <T = unknown>(sql: string, params?: unknown[]) => Promise<T[]>;
  sqliteExecute?: (sql: string, params?: unknown[]) => Promise<{ changes: number; lastInsertRowid?: number | string }>;
}

declare global {
  interface Window {
    electronAPI?: ElectronSqliteBridge;
  }
}

const LS_KEYS = {
  BOOKS: 'ulm_storage_engine_books_v1',
  MEMBERS: 'ulm_storage_engine_members_v1',
  ALMARIS: 'ulm_storage_engine_almaris_v1',
  CIRCULATION: 'ulm_storage_engine_circulation_v1',
} as const;

const DEFAULT_SEED_BOOKS: StorageBookRecord[] = [
  {
    accession: 'ULM-ACC-00001',
    title: 'Introduction to Algorithms (4th Edition)',
    author: 'Thomas H. Cormen, Charles E. Leiserson',
    isbn: '978-0262046305',
    category: 'Computer Science',
    almariId: 'ALM-01',
    shelfId: '1',
    status: 'AVAILABLE',
    edition: '4th Edition',
    publicationYear: 2022,
    updatedAt: '2026-11-07T00:00:00.000Z',
  },
  {
    accession: 'ULM-ACC-00002',
    title: 'Artificial Intelligence: A Modern Approach',
    author: 'Stuart Russell, Peter Norvig',
    isbn: '978-0134610993',
    category: 'Computer Science',
    almariId: 'ALM-01',
    shelfId: '2',
    status: 'ISSUED',
    edition: '4th Edition',
    publicationYear: 2021,
    updatedAt: '2026-11-07T00:00:00.000Z',
  },
];

const DEFAULT_SEED_MEMBERS: StorageMemberRecord[] = [
  {
    memberId: 'ULM0329984',
    name: 'Asad Zeb',
    rollNo: 'BSCS-23-42',
    dept: 'Department of Computer Science',
    program: 'BS Computer Science (Regular)',
    session: 'FA23 (2023–2027)',
    bloodGroup: 'B-',
    phone: '0342-5252555',
    role: 'STUDENT CARD',
    borrowingLimit: '03 Books (14 Days)',
    cardExpiry: '30 JUN 2027',
    updatedAt: '2026-11-07T00:00:00.000Z',
  },
];

const DEFAULT_SEED_ALMARIS: StorageAlmariRecord[] = [
  {
    almariId: 'ALM-01',
    almariCode: 'ALM-CS-01',
    nameEn: 'Computer Science & AI Wing Cupboard 01',
    location: 'Ground Floor • East Wing',
    category: 'Computer Science',
    shelfCount: 5,
    shelfCapacities: { 1: 25, 2: 25, 3: 25, 4: 25, 5: 25 },
    updatedAt: '2026-11-07T00:00:00.000Z',
  },
];

const DEFAULT_SEED_CIRCULATION: StorageCirculationRecord[] = [
  {
    transactionId: 'TXN-ULM-2026-001',
    bookId: 'ULM-ACC-00002',
    accession: 'ULM-ACC-00002',
    memberId: 'ULM0329984',
    issueDate: '2026-11-01',
    dueDate: '2026-11-15',
    returnDate: null,
    fine: 0,
    status: 'ACTIVE',
    updatedAt: '2026-11-01T09:30:00.000Z',
  },
];

export class StorageEngine {
  private static sqliteInitPromise: Promise<boolean> | null = null;

  public static isSqliteIpcConnected(): boolean {
    return typeof window !== 'undefined' && typeof window.electronAPI?.sqliteQuery === 'function';
  }

  public static async initSqliteWasm(): Promise<boolean> {
    if (this.isSqliteIpcConnected()) {
      return true; // Electron Native SQLite IPC Active
    }

    if (this.sqliteInitPromise) {
      return this.sqliteInitPromise;
    }

    this.sqliteInitPromise = (async () => {
      try {
        if (typeof window === 'undefined') return false;

        // Check for sql.js global or dynamic import
        const initSqlJs = (window as any).initSqlJs || (await import('sql.js')).default;
        if (typeof initSqlJs !== 'function') {
          console.warn('[StorageEngine] sql.js runtime not found; operating in verified LocalStorage mode.');
          return false;
        }

        await initSqlJs({
          locateFile: (file: string) => `/${file}`,
        });

        console.info('[StorageEngine] SQLite WASM runtime successfully initialized.');
        return true;
      } catch (err) {
        console.warn('[StorageEngine] SQLite WASM initialization note (falling back to LocalStorage):', err);
        this.sqliteInitPromise = null; // Clean promise reset on failure
        return false;
      }
    })();

    return this.sqliteInitPromise;
  }

  public static getActiveEngineLabel(): 'SYSTEM LIVE • SQLITE CONNECTED' | 'SYSTEM LIVE • LOCAL STORAGE SYNCED' {
    return this.isSqliteIpcConnected()
      ? 'SYSTEM LIVE • SQLITE CONNECTED'
      : 'SYSTEM LIVE • LOCAL STORAGE SYNCED';
  }

  private static readLocalList<T>(key: string, fallback: T[]): T[] {
    if (typeof window === 'undefined') return fallback;
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) {
        window.localStorage.setItem(key, JSON.stringify(fallback));
        return fallback;
      }
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as T[]) : fallback;
    } catch {
      return fallback;
    }
  }

  private static writeLocalList<T>(key: string, items: T[]): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(key, JSON.stringify(items));
    } catch (err) {
      console.error(`[StorageEngine] Failed writing key ${key}:`, err);
    }
  }

  public static async getBooks(): Promise<StorageBookRecord[]> {
    if (this.isSqliteIpcConnected() && window.electronAPI?.sqliteQuery) {
      try {
        return await window.electronAPI.sqliteQuery<StorageBookRecord>(
          'SELECT accession, title, author, isbn, category, almariId, shelfId, status, edition, publicationYear, updatedAt FROM books ORDER BY accession ASC'
        );
      } catch (err) {
        console.warn('[StorageEngine] SQLite books query failed, using LocalStorage fallback:', err);
      }
    }
    return this.readLocalList<StorageBookRecord>(LS_KEYS.BOOKS, DEFAULT_SEED_BOOKS);
  }

  public static async upsertBook(book: StorageBookRecord): Promise<StorageBookRecord> {
    const record: StorageBookRecord = {
      ...book,
      updatedAt: new Date().toISOString(),
    };

    if (this.isSqliteIpcConnected() && window.electronAPI?.sqliteExecute) {
      try {
        await window.electronAPI.sqliteExecute(
          `INSERT INTO books (accession, title, author, isbn, category, almariId, shelfId, status, edition, publicationYear, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(accession) DO UPDATE SET
             title = excluded.title,
             author = excluded.author,
             isbn = excluded.isbn,
             category = excluded.category,
             almariId = excluded.almariId,
             shelfId = excluded.shelfId,
             status = excluded.status,
             edition = excluded.edition,
             publicationYear = excluded.publicationYear,
             updatedAt = excluded.updatedAt`,
          [
            record.accession,
            record.title,
            record.author,
            record.isbn,
            record.category,
            record.almariId,
            record.shelfId,
            record.status,
            record.edition ?? '',
            record.publicationYear ?? 2026,
            record.updatedAt,
          ]
        );
      } catch (err) {
        console.warn('[StorageEngine] SQLite upsertBook fallback to LocalStorage:', err);
      }
    }

    const current = this.readLocalList<StorageBookRecord>(LS_KEYS.BOOKS, DEFAULT_SEED_BOOKS);
    const idx = current.findIndex((b) => b.accession === record.accession);
    if (idx >= 0) {
      current[idx] = record;
    } else {
      current.unshift(record);
    }
    this.writeLocalList(LS_KEYS.BOOKS, current);
    return record;
  }

  public static async deleteBook(accession: string): Promise<boolean> {
    if (this.isSqliteIpcConnected() && window.electronAPI?.sqliteExecute) {
      try {
        await window.electronAPI.sqliteExecute('DELETE FROM books WHERE accession = ?', [accession]);
      } catch (err) {
        console.warn('[StorageEngine] SQLite deleteBook fallback:', err);
      }
    }
    const current = this.readLocalList<StorageBookRecord>(LS_KEYS.BOOKS, DEFAULT_SEED_BOOKS);
    const filtered = current.filter((b) => b.accession !== accession);
    this.writeLocalList(LS_KEYS.BOOKS, filtered);
    return filtered.length !== current.length;
  }

  public static async getMembers(): Promise<StorageMemberRecord[]> {
    if (this.isSqliteIpcConnected() && window.electronAPI?.sqliteQuery) {
      try {
        return await window.electronAPI.sqliteQuery<StorageMemberRecord>(
          'SELECT memberId, name, rollNo, dept, program, session, bloodGroup, phone, role, borrowingLimit, cardExpiry, photoUrl, updatedAt FROM members ORDER BY memberId ASC'
        );
      } catch (err) {
        console.warn('[StorageEngine] SQLite members query fallback:', err);
      }
    }
    return this.readLocalList<StorageMemberRecord>(LS_KEYS.MEMBERS, DEFAULT_SEED_MEMBERS);
  }

  public static async upsertMember(member: StorageMemberRecord): Promise<StorageMemberRecord> {
    const record: StorageMemberRecord = {
      ...member,
      updatedAt: new Date().toISOString(),
    };

    if (this.isSqliteIpcConnected() && window.electronAPI?.sqliteExecute) {
      try {
        await window.electronAPI.sqliteExecute(
          `INSERT INTO members (memberId, name, rollNo, dept, program, session, bloodGroup, phone, role, borrowingLimit, cardExpiry, photoUrl, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(memberId) DO UPDATE SET
             name = excluded.name,
             rollNo = excluded.rollNo,
             dept = excluded.dept,
             program = excluded.program,
             session = excluded.session,
             bloodGroup = excluded.bloodGroup,
             phone = excluded.phone,
             role = excluded.role,
             borrowingLimit = excluded.borrowingLimit,
             cardExpiry = excluded.cardExpiry,
             photoUrl = excluded.photoUrl,
             updatedAt = excluded.updatedAt`,
          [
            record.memberId,
            record.name,
            record.rollNo,
            record.dept,
            record.program,
            record.session,
            record.bloodGroup,
            record.phone,
            record.role,
            record.borrowingLimit,
            record.cardExpiry,
            record.photoUrl ?? '',
            record.updatedAt,
          ]
        );
      } catch (err) {
        console.warn('[StorageEngine] SQLite upsertMember fallback:', err);
      }
    }

    const current = this.readLocalList<StorageMemberRecord>(LS_KEYS.MEMBERS, DEFAULT_SEED_MEMBERS);
    const idx = current.findIndex((m) => m.memberId === record.memberId);
    if (idx >= 0) {
      current[idx] = record;
    } else {
      current.push(record);
    }
    this.writeLocalList(LS_KEYS.MEMBERS, current);
    return record;
  }

  public static async deleteMember(memberId: string): Promise<boolean> {
    if (this.isSqliteIpcConnected() && window.electronAPI?.sqliteExecute) {
      try {
        await window.electronAPI.sqliteExecute('DELETE FROM members WHERE memberId = ?', [memberId]);
      } catch (err) {
        console.warn('[StorageEngine] SQLite deleteMember fallback:', err);
      }
    }
    const current = this.readLocalList<StorageMemberRecord>(LS_KEYS.MEMBERS, DEFAULT_SEED_MEMBERS);
    const filtered = current.filter((m) => m.memberId !== memberId);
    this.writeLocalList(LS_KEYS.MEMBERS, filtered);
    return filtered.length !== current.length;
  }

  public static async getAlmaris(): Promise<StorageAlmariRecord[]> {
    if (this.isSqliteIpcConnected() && window.electronAPI?.sqliteQuery) {
      try {
        const rows = await window.electronAPI.sqliteQuery<StorageAlmariRecord>(
          'SELECT almariId, almariCode, nameEn, location, category, shelfCount, shelfCapacities, updatedAt FROM almaris ORDER BY almariCode ASC'
        );
        return rows.map((r) => ({
          ...r,
          shelfCapacities:
            typeof r.shelfCapacities === 'string'
              ? JSON.parse(r.shelfCapacities)
              : r.shelfCapacities || {},
        }));
      } catch (err) {
        console.warn('[StorageEngine] SQLite almaris query fallback:', err);
      }
    }
    return this.readLocalList<StorageAlmariRecord>(LS_KEYS.ALMARIS, DEFAULT_SEED_ALMARIS);
  }

  public static async upsertAlmari(almari: StorageAlmariRecord): Promise<StorageAlmariRecord> {
    const record: StorageAlmariRecord = {
      ...almari,
      shelfCapacities: almari.shelfCapacities || {},
      updatedAt: new Date().toISOString(),
    };

    if (this.isSqliteIpcConnected() && window.electronAPI?.sqliteExecute) {
      try {
        await window.electronAPI.sqliteExecute(
          `INSERT INTO almaris (almariId, almariCode, nameEn, location, category, shelfCount, shelfCapacities, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(almariId) DO UPDATE SET
             almariCode = excluded.almariCode,
             nameEn = excluded.nameEn,
             location = excluded.location,
             category = excluded.category,
             shelfCount = excluded.shelfCount,
             shelfCapacities = excluded.shelfCapacities,
             updatedAt = excluded.updatedAt`,
          [
            record.almariId,
            record.almariCode,
            record.nameEn,
            record.location,
            record.category,
            record.shelfCount,
            JSON.stringify(record.shelfCapacities),
            record.updatedAt,
          ]
        );
      } catch (err) {
        console.warn('[StorageEngine] SQLite upsertAlmari fallback:', err);
      }
    }

    const current = this.readLocalList<StorageAlmariRecord>(LS_KEYS.ALMARIS, DEFAULT_SEED_ALMARIS);
    const idx = current.findIndex((a) => a.almariId === record.almariId);
    if (idx >= 0) {
      current[idx] = record;
    } else {
      current.push(record);
    }
    this.writeLocalList(LS_KEYS.ALMARIS, current);
    return record;
  }

  public static async getCirculation(): Promise<StorageCirculationRecord[]> {
    if (this.isSqliteIpcConnected() && window.electronAPI?.sqliteQuery) {
      try {
        return await window.electronAPI.sqliteQuery<StorageCirculationRecord>(
          'SELECT transactionId, bookId, accession, memberId, issueDate, dueDate, returnDate, fine, status, updatedAt FROM circulation ORDER BY issueDate DESC'
        );
      } catch (err) {
        console.warn('[StorageEngine] SQLite circulation query fallback:', err);
      }
    }
    return this.readLocalList<StorageCirculationRecord>(LS_KEYS.CIRCULATION, DEFAULT_SEED_CIRCULATION);
  }

  public static async issueBookTransaction(params: {
    bookId: string;
    accession: string;
    memberId: string;
    loanDays?: number;
  }): Promise<StorageCirculationRecord> {
    const now = new Date();
    const due = new Date(now.getTime() + (params.loanDays ?? 14) * 86400000);
    const record: StorageCirculationRecord = {
      transactionId: `TXN-ULM-${now.getFullYear()}-${String(Date.now()).slice(-5)}`,
      bookId: params.bookId,
      accession: params.accession,
      memberId: params.memberId,
      issueDate: now.toISOString().slice(0, 10),
      dueDate: due.toISOString().slice(0, 10),
      returnDate: null,
      fine: 0,
      status: 'ACTIVE',
      updatedAt: now.toISOString(),
    };

    if (this.isSqliteIpcConnected() && window.electronAPI?.sqliteExecute) {
      try {
        await window.electronAPI.sqliteExecute(
          `INSERT INTO circulation (transactionId, bookId, accession, memberId, issueDate, dueDate, returnDate, fine, status, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            record.transactionId,
            record.bookId,
            record.accession,
            record.memberId,
            record.issueDate,
            record.dueDate,
            null,
            0,
            'ACTIVE',
            record.updatedAt,
          ]
        );
      } catch (err) {
        console.warn('[StorageEngine] SQLite issueBookTransaction error:', err);
      }
    }

    const current = this.readLocalList<StorageCirculationRecord>(LS_KEYS.CIRCULATION, DEFAULT_SEED_CIRCULATION);
    current.unshift(record);
    this.writeLocalList(LS_KEYS.CIRCULATION, current);

    const books = await this.getBooks();
    const targetBook = books.find((b) => b.accession === params.accession);
    if (targetBook) {
      await this.upsertBook({ ...targetBook, status: 'ISSUED' });
    }

    return record;
  }

  public static async returnBookTransaction(
    transactionId: string,
    returnDateStr?: string
  ): Promise<StorageCirculationRecord | null> {
    const current = await this.getCirculation();
    const idx = current.findIndex((t) => t.transactionId === transactionId);
    if (idx < 0) return null;

    const existing = current[idx];
    const retDate = returnDateStr || new Date().toISOString().slice(0, 10);
    const dueMs = new Date(existing.dueDate).getTime();
    const retMs = new Date(retDate).getTime();
    const overdueDays = Math.max(0, Math.floor((retMs - dueMs) / 86400000));
    const fineAmount = overdueDays * 10;

    const updated: StorageCirculationRecord = {
      ...existing,
      returnDate: retDate,
      fine: fineAmount,
      status: 'RETURNED',
      updatedAt: new Date().toISOString(),
    };

    if (this.isSqliteIpcConnected() && window.electronAPI?.sqliteExecute) {
      try {
        await window.electronAPI.sqliteExecute(
          `UPDATE circulation SET returnDate = ?, fine = ?, status = ?, updatedAt = ? WHERE transactionId = ?`,
          [retDate, fineAmount, 'RETURNED', updated.updatedAt, transactionId]
        );
      } catch (err) {
        console.warn('[StorageEngine] SQLite returnBookTransaction error:', err);
      }
    }

    const localList = this.readLocalList<StorageCirculationRecord>(LS_KEYS.CIRCULATION, DEFAULT_SEED_CIRCULATION);
    const lIdx = localList.findIndex((t) => t.transactionId === transactionId);
    if (lIdx >= 0) {
      localList[lIdx] = updated;
      this.writeLocalList(LS_KEYS.CIRCULATION, localList);
    }

    const books = await this.getBooks();
    const targetBook = books.find((b) => b.accession === existing.accession);
    if (targetBook) {
      await this.upsertBook({ ...targetBook, status: 'AVAILABLE' });
    }

    return updated;
  }

  public static async exportFullBackupJson(): Promise<FullLibraryBackupPayload & {
    version: string;
    university: string;
    books: any[];
    almaris: any[];
    masterPlacements: Record<string, any>;
    circulation: any[];
  }> {
    const [engineBooks, members, engineAlmaris, engineCirculation] = await Promise.all([
      this.getBooks(),
      this.getMembers(),
      this.getAlmaris(),
      this.getCirculation(),
    ]);

    let liveBooks: any[] = engineBooks;
    let liveAlmaris: any[] = engineAlmaris;
    let livePlacements: Record<string, any> = {};
    let liveCirculation: any[] = engineCirculation;

    if (typeof window !== 'undefined') {
      try {
        const rawBooks =
          localStorage.getItem('ulm_lms_books_v1') ||
          localStorage.getItem('ulm_library_books_master_v1') ||
          localStorage.getItem('ulm_storage_engine_books_v1');
        if (rawBooks) {
          const parsed = JSON.parse(rawBooks);
          if (Array.isArray(parsed) && parsed.length > 0) liveBooks = parsed;
        }
      } catch {}

      try {
        const rawAlmaris =
          localStorage.getItem('ulm_almaris_registry_v2') ||
          localStorage.getItem('ulm_lms_almaris_v1');
        if (rawAlmaris) {
          const parsed = JSON.parse(rawAlmaris);
          if (Array.isArray(parsed) && parsed.length > 0) liveAlmaris = parsed;
        }
      } catch {}

      try {
        const rawPlacements = localStorage.getItem('ulm_almari_placements_master_v3');
        if (rawPlacements) {
          const parsed = JSON.parse(rawPlacements);
          if (parsed && typeof parsed === 'object') livePlacements = parsed;
        }
      } catch {}

      try {
        const rawCirc =
          localStorage.getItem('ulm_lms_transactions_v1') ||
          localStorage.getItem('ulm_circulation_records_v1');
        if (rawCirc) {
          const parsed = JSON.parse(rawCirc);
          if (Array.isArray(parsed)) liveCirculation = parsed;
        }
      } catch {}
    }

    const exportedAt = new Date().toISOString();

    return {
      version: '3.0.0',
      schemaVersion: '3.0.0',
      university: 'University of Lakki Marwat (ULM)',
      institution: 'University of Lakki Marwat — Central Digital Library',
      exportedAt,
      engineMode: this.isSqliteIpcConnected() ? 'SQLITE_IPC' : 'LOCAL_STORAGE',
      books: liveBooks,
      almaris: liveAlmaris,
      masterPlacements: livePlacements,
      circulation: liveCirculation,
      counts: {
        books: liveBooks.length,
        members: members.length,
        almaris: liveAlmaris.length,
        circulation: liveCirculation.length,
      },
      data: {
        books: liveBooks,
        members,
        almaris: liveAlmaris,
        circulation: liveCirculation,
      },
    };
  }

  // Unified Institutional Backup (Exports 100% of Real Books, Almaris, and Placements)
  public static async triggerOneClickBackupDownload(): Promise<FullLibraryBackupPayload> {
    const backupPayload = await this.exportFullBackupJson();
    try {
      if (typeof window !== 'undefined') {
        const blob = new Blob([JSON.stringify(backupPayload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ULM_CENTRAL_LIBRARY_BACKUP_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('[StorageEngine] Failed to create unified backup:', err);
    }
    return backupPayload;
  }

  // Unified Restore Routine (Supports both v3.0.0 top-level format and legacy data wrapper)
  public static async importBackupData(backupJson: string): Promise<boolean> {
    try {
      const data = JSON.parse(backupJson);
      if (!data || typeof data !== 'object') return false;

      const books = Array.isArray(data.books)
        ? data.books
        : Array.isArray(data.data?.books)
          ? data.data.books
          : null;
      const almaris = Array.isArray(data.almaris)
        ? data.almaris
        : Array.isArray(data.data?.almaris)
          ? data.data.almaris
          : null;
      const masterPlacements =
        data.masterPlacements && typeof data.masterPlacements === 'object'
          ? data.masterPlacements
          : data.data?.masterPlacements && typeof data.data.masterPlacements === 'object'
            ? data.data.masterPlacements
            : null;
      const circulation = Array.isArray(data.circulation)
        ? data.circulation
        : Array.isArray(data.data?.circulation)
          ? data.data.circulation
          : null;
      const members = Array.isArray(data.members)
        ? data.members
        : Array.isArray(data.data?.members)
          ? data.data.members
          : null;

      if (books) {
        localStorage.setItem('ulm_lms_books_v1', JSON.stringify(books));
        localStorage.setItem('ulm_library_books_master_v1', JSON.stringify(books));
        localStorage.setItem('ulm_storage_engine_books_v1', JSON.stringify(books));
      }
      if (almaris) {
        localStorage.setItem('ulm_almaris_registry_v2', JSON.stringify(almaris));
        localStorage.setItem('ulm_lms_almaris_v1', JSON.stringify(almaris));
        localStorage.setItem('ulm_storage_engine_almaris_v1', JSON.stringify(almaris));
      }
      if (masterPlacements) {
        localStorage.setItem('ulm_almari_placements_master_v3', JSON.stringify(masterPlacements));
      }
      if (circulation) {
        localStorage.setItem('ulm_lms_transactions_v1', JSON.stringify(circulation));
        localStorage.setItem('ulm_circulation_records_v1', JSON.stringify(circulation));
        localStorage.setItem('ulm_storage_engine_circulation_v1', JSON.stringify(circulation));
      }
      if (members) {
        localStorage.setItem('ulm_storage_engine_members_v1', JSON.stringify(members));
      }
      return true;
    } catch (err) {
      console.error('[StorageEngine] Backup restore failed:', err);
      return false;
    }
  }

  public static async verifyAndRestoreBackupJson(rawJson: string): Promise<BackupImportVerificationResult> {
    const errors: string[] = [];
    try {
      const parsed = JSON.parse(rawJson);
      if (!parsed || typeof parsed !== 'object') {
        return {
          valid: false,
          schemaVersion: 'UNKNOWN',
          restoredCounts: { books: 0, members: 0, almaris: 0, circulation: 0 },
          errors: ['Invalid backup payload structure.'],
        };
      }

      const hasTopLevel =
        Array.isArray(parsed.books) ||
        Array.isArray(parsed.almaris) ||
        Array.isArray(parsed.circulation);
      const hasDataWrapper = parsed.data && typeof parsed.data === 'object';

      if (!hasTopLevel && !hasDataWrapper) {
        return {
          valid: false,
          schemaVersion: 'UNKNOWN',
          restoredCounts: { books: 0, members: 0, almaris: 0, circulation: 0 },
          errors: ['Invalid backup payload structure: missing books/almaris or data object.'],
        };
      }

      const books = Array.isArray(parsed.books)
        ? parsed.books
        : Array.isArray(parsed.data?.books)
          ? parsed.data.books
          : [];
      const members = Array.isArray(parsed.members)
        ? parsed.members
        : Array.isArray(parsed.data?.members)
          ? parsed.data.members
          : [];
      const almaris = Array.isArray(parsed.almaris)
        ? parsed.almaris
        : Array.isArray(parsed.data?.almaris)
          ? parsed.data.almaris
          : [];
      const circulation = Array.isArray(parsed.circulation)
        ? parsed.circulation
        : Array.isArray(parsed.data?.circulation)
          ? parsed.data.circulation
          : [];

      await this.importBackupData(rawJson);

      if (this.isSqliteIpcConnected()) {
        for (const b of books) await this.upsertBook(b);
        for (const m of members) await this.upsertMember(m);
        for (const a of almaris) await this.upsertAlmari(a);
      }

      return {
        valid: errors.length === 0,
        schemaVersion: parsed.version || parsed.schemaVersion || '3.0.0',
        restoredCounts: {
          books: books.length,
          members: members.length,
          almaris: almaris.length,
          circulation: circulation.length,
        },
        errors,
      };
    } catch (err) {
      return {
        valid: false,
        schemaVersion: 'INVALID_JSON',
        restoredCounts: { books: 0, members: 0, almaris: 0, circulation: 0 },
        errors: [err instanceof Error ? err.message : 'Failed to parse JSON backup file.'],
      };
    }
  }

  public static purgeAllDataAndResetFactory(): void {
    const keysToRemove = [
      'ulm_lms_books_v1',
      'ulm_library_books_master_v1',
      'ulm_storage_engine_books_v1',
      'ulm_lms_transactions_v1',
      'ulm_circulation_records_v1',
      'ulm_storage_engine_circulation_v1',
      'ulm_almari_placements_master_v3',
      'ulm_shelf_capacities_v3',
      'ulm_demo_mode_active_v1',
    ];

    keysToRemove.forEach((key) => {
      try {
        localStorage.removeItem(key);
      } catch {}
    });

    // Reset Almaris to only Institutional Holdings (IH) default
    try {
      const defaultIh = {
        id: 'alm-ih-01',
        code: 'IH',
        name_en: 'Institutional Holdings & Main Stack',
        name_ur: 'ادارہ جاتی ذخیرہ کتب',
        shelf_count: 5,
        books_per_shelf: 25,
        approx_capacity: 125,
        location: 'Main Hall • Ground Floor',
        location_note: 'Main Hall • Ground Floor',
        is_active: true,
        created_at: new Date().toISOString(),
      };
      localStorage.setItem('ulm_almaris_registry_v2', JSON.stringify([defaultIh]));
      localStorage.setItem('ulm_lms_almaris_v1', JSON.stringify([defaultIh]));
    } catch {}

    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }
}

export default StorageEngine;
