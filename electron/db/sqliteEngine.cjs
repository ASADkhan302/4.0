/**
 * ULM Central Campus Library Management System
 * High-Performance SQLite Storage Engine (electron/db/sqliteEngine.cjs)
 *
 * Hardware, RAM & CPU Optimizations for 4,000 - 50,000+ Books:
 * - 256 MB RAM Memory-Mapped I/O (`PRAGMA mmap_size = 268435456`) so reads run directly from OS RAM
 * - 64 MB RAM Page Cache (`PRAGMA cache_size = -64000`) + `PRAGMA temp_store = MEMORY`
 * - Composite covering indexes eliminating TEMP B-TREE sorts on paginated queries
 * - Prepared statements for O(log N) lookups and fast active book counts
 * - Deferred shelf occupancy recalculation during multi-chunk imports
 * - Content-addressed file storage for Base64 book covers (book-covers/)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_FILENAME = 'ulm-library.sqlite';
const CONFIG_FILENAME = 'ulm-db-config.json';
const COVERS_DIRNAME = 'book-covers';
const BACKUPS_DIRNAME = 'backups';

function normalizeIdentifier(rawValue) {
  if (rawValue === null || rawValue === undefined) return '';
  let str = String(rawValue).trim();
  if (!str) return '';
  if (/^\d+\.0+$/.test(str)) {
    str = str.replace(/\.0+$/, '');
  }
  return str;
}

class UlmSqliteEngine {
  constructor(options = {}) {
    if (!options.defaultUserDataDir) {
      throw new Error('defaultUserDataDir is required to initialize UlmSqliteEngine.');
    }
    this.defaultUserDataDir = path.resolve(options.defaultUserDataDir);
    this.configPath = path.join(this.defaultUserDataDir, CONFIG_FILENAME);
    this.DatabaseDriver = options.DatabaseDriver || require('better-sqlite3');
    this.db = null;
    this.activeDataDir = this._resolveConfiguredDataDir();
    this.dbPath = path.join(this.activeDataDir, DB_FILENAME);
    this.coversDir = path.join(this.activeDataDir, COVERS_DIRNAME);
    this.backupsDir = path.join(this.activeDataDir, BACKUPS_DIRNAME);
    this.journalMode = 'WAL';
    this._stmts = {};
  }

  _resolveConfiguredDataDir() {
    try {
      fs.mkdirSync(this.defaultUserDataDir, { recursive: true });
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.customDataDir === 'string' && parsed.customDataDir.trim()) {
          const customDir = path.resolve(parsed.customDataDir.trim());
          fs.mkdirSync(customDir, { recursive: true });
          return customDir;
        }
      }
    } catch (err) {
      console.error('[ULM-SQLite] Failed to read custom data dir config, using default userData:', err.message);
    }
    return this.defaultUserDataDir;
  }

  init() {
    fs.mkdirSync(this.activeDataDir, { recursive: true });
    fs.mkdirSync(this.coversDir, { recursive: true });
    fs.mkdirSync(this.backupsDir, { recursive: true });

    this.db = new this.DatabaseDriver(this.dbPath);

    try {
      this.db.pragma('journal_mode = WAL');
      this.journalMode = 'WAL';
    } catch (_) {
      try {
        this.db.pragma('journal_mode = TRUNCATE');
        this.journalMode = 'TRUNCATE';
      } catch (__) {
        this.db.pragma('journal_mode = MEMORY');
        this.journalMode = 'MEMORY';
      }
    }

    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('cache_size = -64000'); // 64 MB hot page cache in RAM
    this.db.pragma('mmap_size = 536870912'); // 512 MB memory-mapped I/O in RAM for 100,000+ (1 Lakh+) books
    this.db.pragma('temp_store = MEMORY'); // Keep temporary B-trees and sort buffers in RAM
    this.db.pragma('busy_timeout = 5000');

    this._createSchema();
    this._prepareStatements();

    return {
      dbPath: this.dbPath,
      activeDataDir: this.activeDataDir,
      coversDir: this.coversDir,
      backupsDir: this.backupsDir,
      journalMode: this.journalMode,
    };
  }

  _checkpointSafely() {
    if (!this.db) return;
    try {
      if (this.journalMode === 'WAL') {
        this.db.pragma('wal_checkpoint(TRUNCATE)');
      }
    } catch (_) {}
  }

  _createSchema() {
    const ddl = `
      CREATE TABLE IF NOT EXISTS almaris (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        section TEXT DEFAULT 'General',
        location_hall TEXT DEFAULT 'Main Hall',
        floor TEXT DEFAULT 'Ground Floor',
        total_shelves INTEGER NOT NULL DEFAULT 5,
        default_category TEXT DEFAULT '',
        active_status INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS shelves (
        id TEXT PRIMARY KEY,
        almari_id TEXT NOT NULL,
        shelf_number TEXT NOT NULL,
        capacity INTEGER NOT NULL DEFAULT 100,
        current_count INTEGER NOT NULL DEFAULT 0,
        category_label TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(almari_id, shelf_number),
        FOREIGN KEY (almari_id) REFERENCES almaris(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS books (
        id TEXT PRIMARY KEY,
        accession_number TEXT NOT NULL UNIQUE,
        date_of_entry TEXT NOT NULL DEFAULT (date('now')),
        barcode TEXT UNIQUE,
        author TEXT NOT NULL DEFAULT 'Unknown Author',
        co_authors TEXT DEFAULT '',
        title TEXT NOT NULL,
        subtitle TEXT DEFAULT '',
        publisher TEXT DEFAULT '',
        place TEXT DEFAULT '',
        publication_year TEXT DEFAULT '',
        edition TEXT DEFAULT '',
        pages TEXT DEFAULT '',
        binding TEXT DEFAULT 'Hardbound',
        price_rs NUMERIC DEFAULT 0,
        price_ps NUMERIC DEFAULT 0,
        price NUMERIC DEFAULT 0,
        source_remarks TEXT DEFAULT '',
        call_number TEXT DEFAULT '',
        dewey_class TEXT DEFAULT '',
        category TEXT DEFAULT 'General',
        language TEXT DEFAULT 'English',
        isbn TEXT DEFAULT '',
        almari_id TEXT DEFAULT NULL,
        shelf_id TEXT DEFAULT NULL,
        shelf_label TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'ISSUED', 'RESERVED', 'LOST', 'DAMAGED')),
        condition TEXT DEFAULT 'Good',
        cover_image_path TEXT DEFAULT '',
        remarks TEXT DEFAULT '',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (almari_id) REFERENCES almaris(id) ON DELETE SET NULL,
        FOREIGN KEY (shelf_id) REFERENCES shelves(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS borrowers (
        id TEXT PRIMARY KEY,
        member_id TEXT NOT NULL UNIQUE,
        barcode TEXT UNIQUE,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'STUDENT' CHECK (role IN ('STUDENT', 'FACULTY', 'STAFF', 'EXTERNAL')),
        department TEXT DEFAULT '',
        batch_year TEXT DEFAULT '',
        phone TEXT DEFAULT '',
        email TEXT DEFAULT '',
        max_books_allowed INTEGER NOT NULL DEFAULT 3,
        active_loans_count INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'EXPIRED')),
        photo_path TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS loans (
        id TEXT PRIMARY KEY,
        loan_slip_number TEXT NOT NULL UNIQUE,
        book_id TEXT NOT NULL,
        borrower_id TEXT NOT NULL,
        issue_date TEXT NOT NULL,
        due_date TEXT NOT NULL,
        return_date TEXT DEFAULT NULL,
        renewal_count INTEGER NOT NULL DEFAULT 0,
        late_fine_amount NUMERIC NOT NULL DEFAULT 0,
        fine_status TEXT NOT NULL DEFAULT 'NONE' CHECK (fine_status IN ('NONE', 'UNPAID', 'PAID', 'WAIVED')),
        status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ISSUED', 'RETURNED', 'OVERDUE', 'LOST')),
        notes TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE RESTRICT,
        FOREIGN KEY (borrower_id) REFERENCES borrowers(id) ON DELETE RESTRICT
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL DEFAULT (datetime('now')),
        user_action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT DEFAULT '',
        details TEXT DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_books_accession ON books(accession_number);
      CREATE INDEX IF NOT EXISTS idx_books_barcode ON books(barcode);
      CREATE INDEX IF NOT EXISTS idx_books_active_accession ON books(is_active, accession_number);
      CREATE INDEX IF NOT EXISTS idx_books_active_title ON books(is_active, title COLLATE NOCASE);
      CREATE INDEX IF NOT EXISTS idx_books_active_author ON books(is_active, author COLLATE NOCASE);
      CREATE INDEX IF NOT EXISTS idx_books_active_category_acc ON books(is_active, category, accession_number);
      CREATE INDEX IF NOT EXISTS idx_books_active_language_acc ON books(is_active, language, accession_number);
      CREATE INDEX IF NOT EXISTS idx_books_active_status_acc ON books(is_active, status, accession_number);
      CREATE INDEX IF NOT EXISTS idx_books_almari_shelf ON books(is_active, almari_id, shelf_id);
      CREATE INDEX IF NOT EXISTS idx_borrowers_member_id ON borrowers(member_id);
      CREATE INDEX IF NOT EXISTS idx_loans_book_id ON loans(book_id);
      CREATE INDEX IF NOT EXISTS idx_loans_borrower_id ON loans(borrower_id);
      CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
    `;
    this.db.exec(ddl);
  }

  _prepareStatements() {
    this._stmts = {
      getBookByAccession: this.db.prepare(
        'SELECT * FROM books WHERE accession_number = ? LIMIT 1'
      ),
      getBookByBarcode: this.db.prepare(
        'SELECT * FROM books WHERE barcode = ? LIMIT 1'
      ),
      getBookById: this.db.prepare(
        'SELECT * FROM books WHERE id = ? LIMIT 1'
      ),
      checkAccessionExists: this.db.prepare(
        'SELECT id FROM books WHERE accession_number = ? LIMIT 1'
      ),
      checkBarcodeExists: this.db.prepare(
        'SELECT accession_number FROM books WHERE barcode = ? LIMIT 1'
      ),
      insertBook: this.db.prepare(`
        INSERT INTO books (
          id, accession_number, date_of_entry, barcode, author, co_authors,
          title, subtitle, publisher, place, publication_year, edition,
          pages, binding, price_rs, price_ps, price, source_remarks,
          call_number, dewey_class, category, language, isbn,
          almari_id, shelf_id, shelf_label, status, condition,
          cover_image_path, remarks, is_active, created_at, updated_at
        ) VALUES (
          @id, @accession_number, @date_of_entry, @barcode, @author, @co_authors,
          @title, @subtitle, @publisher, @place, @publication_year, @edition,
          @pages, @binding, @price_rs, @price_ps, @price, @source_remarks,
          @call_number, @dewey_class, @category, @language, @isbn,
          @almari_id, @shelf_id, @shelf_label, @status, @condition,
          @cover_image_path, @remarks, @is_active, @created_at, @updated_at
        )
      `),
      upsertBook: this.db.prepare(`
        INSERT INTO books (
          id, accession_number, date_of_entry, barcode, author, co_authors,
          title, subtitle, publisher, place, publication_year, edition,
          pages, binding, price_rs, price_ps, price, source_remarks,
          call_number, dewey_class, category, language, isbn,
          almari_id, shelf_id, shelf_label, status, condition,
          cover_image_path, remarks, is_active, created_at, updated_at
        ) VALUES (
          @id, @accession_number, @date_of_entry, @barcode, @author, @co_authors,
          @title, @subtitle, @publisher, @place, @publication_year, @edition,
          @pages, @binding, @price_rs, @price_ps, @price, @source_remarks,
          @call_number, @dewey_class, @category, @language, @isbn,
          @almari_id, @shelf_id, @shelf_label, @status, @condition,
          @cover_image_path, @remarks, @is_active, @created_at, @updated_at
        )
        ON CONFLICT(accession_number) DO UPDATE SET
          date_of_entry = excluded.date_of_entry,
          barcode = COALESCE(excluded.barcode, books.barcode),
          author = excluded.author,
          co_authors = excluded.co_authors,
          title = excluded.title,
          subtitle = excluded.subtitle,
          publisher = excluded.publisher,
          place = excluded.place,
          publication_year = excluded.publication_year,
          edition = excluded.edition,
          pages = excluded.pages,
          binding = excluded.binding,
          price_rs = excluded.price_rs,
          price_ps = excluded.price_ps,
          price = excluded.price,
          source_remarks = excluded.source_remarks,
          call_number = excluded.call_number,
          dewey_class = excluded.dewey_class,
          category = excluded.category,
          language = excluded.language,
          isbn = excluded.isbn,
          almari_id = COALESCE(excluded.almari_id, books.almari_id),
          shelf_id = COALESCE(excluded.shelf_id, books.shelf_id),
          shelf_label = excluded.shelf_label,
          status = excluded.status,
          condition = excluded.condition,
          cover_image_path = CASE WHEN excluded.cover_image_path != '' THEN excluded.cover_image_path ELSE books.cover_image_path END,
          remarks = excluded.remarks,
          is_active = excluded.is_active,
          updated_at = datetime('now')
      `),
      deleteBookById: this.db.prepare('DELETE FROM books WHERE id = ?'),
      countActiveBooks: this.db.prepare('SELECT COUNT(*) AS total FROM books WHERE is_active = 1'),
      defaultCatalogPageAsc: this.db.prepare(`
        SELECT * FROM books
        WHERE is_active = 1
        ORDER BY accession_number ASC
        LIMIT @limit OFFSET @offset
      `),
      defaultCatalogPageDesc: this.db.prepare(`
        SELECT * FROM books
        WHERE is_active = 1
        ORDER BY accession_number DESC
        LIMIT @limit OFFSET @offset
      `),
      insertAuditLog: this.db.prepare(
        'INSERT INTO audit_logs (user_action, entity_type, entity_id, details) VALUES (?, ?, ?, ?)'
      ),
      getSetting: this.db.prepare('SELECT value FROM system_settings WHERE key = ?'),
      setSetting: this.db.prepare(`
        INSERT INTO system_settings (key, value, updated_at)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
      `),
    };
  }

  persistCoverImageToFile(rawImageValue, accessionNumber = 'book') {
    if (!rawImageValue || typeof rawImageValue !== 'string') return '';
    const trimmed = rawImageValue.trim();
    if (!trimmed) return '';

    if (!trimmed.startsWith('data:image/') && trimmed.length < 260) {
      return trimmed;
    }

    try {
      let ext = 'jpg';
      let base64Data = trimmed;
      const dataUriMatch = trimmed.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/s);
      if (dataUriMatch) {
        ext = dataUriMatch[1].toLowerCase() === 'jpeg' ? 'jpg' : dataUriMatch[1].toLowerCase();
        base64Data = dataUriMatch[2];
      } else if (trimmed.length >= 260 && /^[A-Za-z0-9+/=\r\n]+$/.test(trimmed)) {
        ext = 'jpg';
      } else {
        return trimmed;
      }

      const buffer = Buffer.from(base64Data, 'base64');
      if (!buffer || buffer.length === 0) return '';

      const hash = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16);
      const safeAcc = String(accessionNumber).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 32) || 'cover';
      const fileName = `${safeAcc}_${hash}.${ext}`;
      const fullPath = path.join(this.coversDir, fileName);

      if (!fs.existsSync(fullPath)) {
        fs.writeFileSync(fullPath, buffer);
      }
      return path.join(COVERS_DIRNAME, fileName);
    } catch (err) {
      console.warn('[ULM-SQLite] Cover image file extraction failed:', err.message);
      return '';
    }
  }

  normalizeAndValidateBook(rawBook, rowIndex = 0) {
    if (!rawBook || typeof rawBook !== 'object') {
      return { valid: false, error: `Row ${rowIndex + 1}: Record is not a valid object.` };
    }

    let accessionNumber = normalizeIdentifier(
      rawBook.accession_number ??
      rawBook.accessionNumber ??
      rawBook.accessionNo ??
      rawBook.accession_no ??
      rawBook['Accession No'] ??
      rawBook['Accession Number'] ??
      rawBook['Acc No']
    );

    if (!accessionNumber) {
      let activeCount = 0;
      try {
        if (this._stmts && this._stmts.countActiveBooks) {
          activeCount = this._stmts.countActiveBooks.get().total || 0;
        }
      } catch (_) {}
      accessionNumber = String(activeCount + rowIndex + 1).padStart(5, '0');
    }

    const title = String(
      rawBook.title ??
      rawBook.bookTitle ??
      rawBook['Title'] ??
      rawBook['Book Title'] ??
      ''
    ).trim();

    if (!title) {
      return {
        valid: false,
        accessionNumber,
        error: `Row ${rowIndex + 1} (Accession "${accessionNumber}"): Missing required Book Title.`,
      };
    }

    const author = String(
      rawBook.author ??
      rawBook.authorName ??
      rawBook['Author'] ??
      rawBook['Author Name'] ??
      'Unknown Author'
    ).trim() || 'Unknown Author';

    const rawBarcode = normalizeIdentifier(
      rawBook.barcode ??
      rawBook.barcodeNumber ??
      rawBook['Barcode'] ??
      rawBook['Barcode No']
    );
    const barcode = rawBarcode ? rawBarcode : null;

    const priceRs = Number(rawBook.price_rs ?? rawBook.priceRs ?? rawBook['Price Rs'] ?? rawBook.price ?? rawBook['Price'] ?? 0) || 0;
    const pricePs = Number(rawBook.price_ps ?? rawBook.pricePs ?? rawBook['Price Ps'] ?? 0) || 0;
    const totalPrice = Number(rawBook.price ?? (priceRs + pricePs / 100)) || 0;

    const rawCover =
      rawBook.cover_image_path ??
      rawBook.coverImagePath ??
      rawBook.coverImage ??
      rawBook.cover_image ??
      rawBook.image ??
      '';

    const coverImagePath = this.persistCoverImageToFile(rawCover, accessionNumber);

    const allowedStatuses = new Set(['AVAILABLE', 'ISSUED', 'RESERVED', 'LOST', 'DAMAGED']);
    const rawStatus = String(rawBook.status ?? rawBook['Status'] ?? 'AVAILABLE').trim().toUpperCase();
    const status = allowedStatuses.has(rawStatus) ? rawStatus : 'AVAILABLE';

    const nowIso = new Date().toISOString();

    const record = {
      id: String(rawBook.id || `book_${accessionNumber}`),
      accession_number: accessionNumber,
      date_of_entry: String(
        rawBook.date_of_entry ??
        rawBook.dateOfEntry ??
        rawBook.acquisition_date ??
        rawBook['Date of Entry'] ??
        nowIso.slice(0, 10)
      ).trim(),
      barcode,
      author,
      co_authors: String(rawBook.co_authors ?? rawBook.coAuthors ?? rawBook['Co-Authors'] ?? '').trim(),
      title,
      subtitle: String(rawBook.subtitle ?? rawBook['Subtitle'] ?? '').trim(),
      publisher: String(rawBook.publisher ?? rawBook['Publisher'] ?? '').trim(),
      place: String(rawBook.place ?? rawBook.placeOfPublication ?? rawBook['Place'] ?? '').trim(),
      publication_year: normalizeIdentifier(
        rawBook.publication_year ?? rawBook.publicationYear ?? rawBook.year ?? rawBook['Year'] ?? ''
      ),
      edition: String(rawBook.edition ?? rawBook['Edition'] ?? '').trim(),
      pages: normalizeIdentifier(rawBook.pages ?? rawBook['Pages'] ?? ''),
      binding: String(rawBook.binding ?? rawBook['Binding'] ?? 'Hardbound').trim(),
      price_rs: priceRs,
      price_ps: pricePs,
      price: totalPrice,
      source_remarks: String(
        rawBook.source_remarks ?? rawBook.sourceRemarks ?? rawBook['Source Remarks'] ?? rawBook.source ?? ''
      ).trim(),
      call_number: String(
        rawBook.call_number ?? rawBook.callNumber ?? rawBook.deweyCallNo ?? rawBook['Dewey Call No'] ?? rawBook['Call No'] ?? ''
      ).trim(),
      dewey_class: String(rawBook.dewey_class ?? rawBook.deweyClass ?? '').trim(),
      category: String(rawBook.category ?? rawBook['Category'] ?? 'General').trim() || 'General',
      language: String(rawBook.language ?? rawBook['Language'] ?? 'English').trim() || 'English',
      isbn: normalizeIdentifier(rawBook.isbn ?? rawBook['ISBN'] ?? ''),
      almari_id: rawBook.almari_id || rawBook.almariId || null,
      shelf_id: rawBook.shelf_id || rawBook.shelfId || null,
      shelf_label: String(rawBook.shelf_label ?? rawBook.shelfLabel ?? rawBook.shelf ?? rawBook['Shelf'] ?? '').trim(),
      status,
      condition: String(rawBook.condition ?? rawBook['Condition'] ?? 'Good').trim(),
      cover_image_path: coverImagePath,
      remarks: String(rawBook.remarks ?? rawBook['Remarks'] ?? '').trim(),
      is_active: rawBook.is_active !== undefined ? (rawBook.is_active ? 1 : 0) : 1,
      created_at: String(rawBook.created_at ?? rawBook.createdAt ?? nowIso),
      updated_at: nowIso,
    };

    return { valid: true, record };
  }

  _hydrateBookForRenderer(row) {
    if (!row) return null;
    return {
      ...row,
      accessionNumber: row.accession_number,
      accessionNo: row.accession_number,
      dateOfEntry: row.date_of_entry,
      coAuthors: row.co_authors,
      publicationYear: row.publication_year,
      year: row.publication_year,
      priceRs: row.price_rs,
      pricePs: row.price_ps,
      sourceRemarks: row.source_remarks,
      callNumber: row.call_number,
      deweyCallNo: row.call_number,
      deweyClass: row.dewey_class,
      almariId: row.almari_id,
      shelfId: row.shelf_id,
      shelfLabel: row.shelf_label,
      shelf: row.shelf_label,
      coverImagePath: row.cover_image_path,
      coverImage: row.cover_image_path,
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  importBookBatchTransactional(rawBooks, options = {}) {
    const onDuplicate = options.onDuplicate || 'skip';
    const rowOffset = options.rowOffset || 0;
    const skipShelfRecalc = Boolean(options.skipShelfRecalc);

    const report = {
      processed: rawBooks.length,
      inserted: 0,
      updated: 0,
      skippedDuplicates: 0,
      rejected: 0,
      errors: [],
    };

    const runBatch = this.db.transaction((items) => {
      for (let i = 0; i < items.length; i++) {
        const globalRowIndex = rowOffset + i;
        const validation = this.normalizeAndValidateBook(items[i], globalRowIndex);

        if (!validation.valid) {
          report.rejected++;
          report.errors.push({
            row: globalRowIndex + 1,
            accessionNumber: validation.accessionNumber || '',
            reason: validation.error,
          });
          continue;
        }

        const record = validation.record;

        try {
          const existingByAcc = this._stmts.checkAccessionExists.get(record.accession_number);
          if (existingByAcc) {
            if (onDuplicate === 'upsert') {
              this._stmts.upsertBook.run(record);
              report.updated++;
            } else {
              report.skippedDuplicates++;
              report.errors.push({
                row: globalRowIndex + 1,
                accessionNumber: record.accession_number,
                reason: `Duplicate Accession Number "${record.accession_number}" skipped.`,
              });
            }
            continue;
          }

          if (record.barcode) {
            const existingByBarcode = this._stmts.checkBarcodeExists.get(record.barcode);
            if (existingByBarcode) {
              report.skippedDuplicates++;
              report.errors.push({
                row: globalRowIndex + 1,
                accessionNumber: record.accession_number,
                reason: `Duplicate Barcode "${record.barcode}" (already assigned to Accession "${existingByBarcode.accession_number}").`,
              });
              continue;
            }
          }

          this._stmts.insertBook.run(record);
          report.inserted++;
        } catch (dbErr) {
          report.rejected++;
          report.errors.push({
            row: globalRowIndex + 1,
            accessionNumber: record.accession_number,
            reason: `Database error: ${dbErr.message}`,
          });
        }
      }
    });

    runBatch(rawBooks);
    if (!skipShelfRecalc) {
      this._recalculateShelfOccupancy();
    }
    return report;
  }

  saveBook(rawBook, mode = 'upsert') {
    const validation = this.normalizeAndValidateBook(rawBook, 0);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    const record = validation.record;
    const existing = this._stmts.checkAccessionExists.get(record.accession_number);

    if (existing && mode === 'insert') {
      throw new Error(`Accession Number "${record.accession_number}" already exists.`);
    }

    if (existing) {
      this._stmts.upsertBook.run(record);
      this._stmts.insertAuditLog.run('UPDATE_BOOK', 'books', record.id, `Updated Acc #${record.accession_number}`);
    } else {
      this._stmts.insertBook.run(record);
      this._stmts.insertAuditLog.run('CREATE_BOOK', 'books', record.id, `Created Acc #${record.accession_number}`);
    }

    if (record.shelf_id) {
      this._recalculateShelfOccupancy();
    }
    return this._hydrateBookForRenderer(this._stmts.getBookByAccession.get(record.accession_number));
  }

  deleteBook(idOrAccession) {
    const target =
      this._stmts.getBookById.get(idOrAccession) ||
      this._stmts.getBookByAccession.get(normalizeIdentifier(idOrAccession));
    if (!target) {
      return { deleted: false, reason: 'Book not found' };
    }
    this._stmts.deleteBookById.run(target.id);
    this._stmts.insertAuditLog.run('DELETE_BOOK', 'books', target.id, `Deleted Acc #${target.accession_number}`);
    if (target.shelf_id) {
      this._recalculateShelfOccupancy();
    }
    return { deleted: true, id: target.id, accessionNumber: target.accession_number };
  }

  /**
   * Executes a single atomic SQLite UPDATE for "Select All Filtered" bulk actions
   * (e.g., Assign to Almari/Shelf or Subject Group across 1,00,000+ books)
   * without loading 1,00,000 IDs into React state.
   */
  bulkUpdateByFilter(filterParams = {}, patch = {}) {
    if (!this.db) throw new Error('Database not initialized');
    const whereClauses = ['is_active = 1'];
    const bindParams = {};

    const search = String(filterParams.search || '').trim();
    if (search) {
      whereClauses.push(
        '(accession_number LIKE @search OR barcode LIKE @search OR title LIKE @search OR author LIKE @search OR call_number LIKE @search)'
      );
      bindParams.search = `%${search}%`;
    }
    if (filterParams.category && filterParams.category !== 'ALL') {
      whereClauses.push('category = @category');
      bindParams.category = String(filterParams.category);
    }
    if (filterParams.language && filterParams.language !== 'ALL') {
      whereClauses.push('language = @language');
      bindParams.language = String(filterParams.language);
    }
    if (filterParams.status && filterParams.status !== 'ALL') {
      whereClauses.push('status = @status');
      bindParams.status = String(filterParams.status);
    }
    if (filterParams.almariId && filterParams.almariId !== 'ALL') {
      whereClauses.push('almari_id = @almariId');
      bindParams.almariId = String(filterParams.almariId);
    }

    const setClauses = ["updated_at = datetime('now')"];
    if (patch.almari_id !== undefined || patch.almariId !== undefined) {
      setClauses.push('almari_id = @patchAlmariId');
      bindParams.patchAlmariId = patch.almari_id ?? patch.almariId;
    }
    if (patch.shelf_id !== undefined || patch.shelfId !== undefined) {
      setClauses.push('shelf_id = @patchShelfId');
      bindParams.patchShelfId = patch.shelf_id ?? patch.shelfId;
    }
    if (patch.shelf_label !== undefined || patch.shelfLabel !== undefined || patch.shelf_no !== undefined) {
      setClauses.push('shelf_label = @patchShelfLabel');
      bindParams.patchShelfLabel = String(patch.shelf_label ?? patch.shelfLabel ?? patch.shelf_no ?? '');
    }
    if (patch.category !== undefined) {
      setClauses.push('category = @patchCategory');
      bindParams.patchCategory = String(patch.category);
    }
    if (patch.status !== undefined) {
      setClauses.push('status = @patchStatus');
      bindParams.patchStatus = String(patch.status);
    }

    const sql = `UPDATE books SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')}`;
    const info = this.db.prepare(sql).run(bindParams);
    this._recalculateShelfOccupancy();
    return { updatedCount: info.changes };
  }

  queryBooks(params = {}) {
    const page = Math.max(1, Number(params.page) || 1);
    const maxAllowed = params.exportAll ? Number.MAX_SAFE_INTEGER : 200;
    const pageSize = Math.min(maxAllowed, Math.max(1, Number(params.pageSize) || 50));
    const offset = (page - 1) * pageSize;

    const search = String(params.search || '').trim();
    const category = String(params.category || '').trim();
    const language = String(params.language || '').trim();
    const status = String(params.status || '').trim();
    const almariId = String(params.almariId || '').trim();
    const shelfId = String(params.shelfId || '').trim();

    const allowedSortColumns = {
      accession_number: 'accession_number',
      accessionNumber: 'accession_number',
      title: 'title',
      author: 'author',
      category: 'category',
      publication_year: 'publication_year',
      created_at: 'created_at',
      status: 'status',
    };
    const sortBy = allowedSortColumns[params.sortBy] || 'accession_number';
    const sortOrder = String(params.sortOrder || 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const isUnfiltered =
      !search &&
      (!category || category === 'ALL') &&
      (!language || language === 'ALL') &&
      (!status || status === 'ALL') &&
      (!almariId || almariId === 'ALL') &&
      (!shelfId || shelfId === 'ALL');

    if (isUnfiltered && sortBy === 'accession_number') {
      const { total } = this._stmts.countActiveBooks.get();
      const stmt =
        sortOrder === 'DESC'
          ? this._stmts.defaultCatalogPageDesc
          : this._stmts.defaultCatalogPageAsc;
      const rows = stmt.all({ limit: pageSize, offset });
      return {
        items: rows.map((r) => this._hydrateBookForRenderer(r)),
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      };
    }

    const { whereSql, bindParams } = this._buildWhereClause({
      search,
      category,
      language,
      status,
      almariId,
      shelfId,
    });

    const countStmt = this.db.prepare(`SELECT COUNT(*) AS total FROM books ${whereSql}`);
    const { total } = countStmt.get(bindParams);

    const dataStmt = this.db.prepare(`
      SELECT * FROM books
      ${whereSql}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT @limit OFFSET @offset
    `);

    const rows = dataStmt.all({
      ...bindParams,
      limit: pageSize,
      offset,
    });

    return {
      items: rows.map((r) => this._hydrateBookForRenderer(r)),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  _buildWhereClause({ search, category, language, status, almariId, shelfId }) {
    const whereClauses = ['is_active = 1'];
    const bindParams = {};

    if (search) {
      whereClauses.push(`(
        accession_number LIKE @searchPrefix OR
        barcode LIKE @searchPrefix OR
        title LIKE @searchContains OR
        author LIKE @searchContains OR
        publisher LIKE @searchContains OR
        call_number LIKE @searchContains OR
        isbn LIKE @searchPrefix
      )`);
      bindParams.searchPrefix = `${search}%`;
      bindParams.searchContains = `%${search}%`;
    }

    if (category && category !== 'ALL') {
      whereClauses.push('category = @category');
      bindParams.category = category;
    }

    if (language && language !== 'ALL') {
      whereClauses.push('language = @language');
      bindParams.language = language;
    }

    if (status && status !== 'ALL') {
      whereClauses.push('status = @status');
      bindParams.status = status;
    }

    if (almariId && almariId !== 'ALL') {
      whereClauses.push('almari_id = @almariId');
      bindParams.almariId = almariId;
    }

    if (shelfId && shelfId !== 'ALL') {
      whereClauses.push('shelf_id = @shelfId');
      bindParams.shelfId = shelfId;
    }

    return {
      whereSql: `WHERE ${whereClauses.join(' AND ')}`,
      bindParams,
    };
  }

  explainCatalogueQueryPlan(params = {}) {
    const search = String(params.search || '').trim();
    const category = String(params.category || '').trim();
    const language = String(params.language || '').trim();
    const status = String(params.status || '').trim();
    const almariId = String(params.almariId || '').trim();
    const shelfId = String(params.shelfId || '').trim();
    const sortBy = params.sortBy || 'accession_number';
    const sortOrder = String(params.sortOrder || 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const { whereSql, bindParams } = this._buildWhereClause({
      search,
      category,
      language,
      status,
      almariId,
      shelfId,
    });

    const sql = `
      EXPLAIN QUERY PLAN
      SELECT * FROM books
      ${whereSql}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT 50 OFFSET 0
    `;
    return this.db.prepare(sql).all(bindParams);
  }

  /**
   * Returns a single-call "First-Open Boot Snapshot" containing:
   * - Lightweight thumbnail stubs for Page 1 (first 50 books, ~120 bytes each)
   * - Pre-aggregated Dashboard KPI counts
   * Allows the app to open and render in < 5ms without loading all 4,000+ full records.
   */
  getStartupBootSnapshot(pageSize = 50) {
    const safeLimit = Math.min(100, Math.max(10, Number(pageSize) || 50));
    const stubStmt = this.db.prepare(`
      SELECT
        id, accession_number, barcode, title, author,
        category, language, call_number, shelf_label, status, cover_image_path
      FROM books
      WHERE is_active = 1
      ORDER BY accession_number ASC
      LIMIT ?
    `);
    const stubs = stubStmt.all(safeLimit).map((r) => ({
      id: r.id,
      accession_number: r.accession_number,
      accessionNumber: r.accession_number,
      barcode: r.barcode,
      title: r.title,
      author: r.author,
      category: r.category,
      language: r.language,
      call_number: r.call_number,
      callNumber: r.call_number,
      shelf_label: r.shelf_label,
      shelfLabel: r.shelf_label,
      status: r.status,
      cover_image_path: r.cover_image_path,
      coverImagePath: r.cover_image_path,
      isStub: true,
    }));
    const stats = this.getDashboardStats();
    return {
      stubs,
      totalBooks: stats.totalBooks,
      stats,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * On-Demand Full Hydration: fetches all 17 ULM Accession Register columns
   * only when a user clicks to View, Edit, or Issue a specific book.
   */
  getFullBookDetails(idOrAccession) {
    const clean = normalizeIdentifier(idOrAccession);
    const row =
      this._stmts.getBookById.get(idOrAccession) ||
      this._stmts.getBookByAccession.get(clean) ||
      this._stmts.getBookByBarcode.get(clean);
    return this._hydrateBookForRenderer(row);
  }

  findBookByScanCode(code) {
    const clean = normalizeIdentifier(code);
    if (!clean) return null;
    const row =
      this._stmts.getBookByBarcode.get(clean) ||
      this._stmts.getBookByAccession.get(clean);
    return this._hydrateBookForRenderer(row);
  }

  getDashboardStats() {
    const bookCounts = this.db.prepare(`
      SELECT
        COUNT(*) AS totalBooks,
        SUM(CASE WHEN status = 'AVAILABLE' THEN 1 ELSE 0 END) AS availableBooks,
        SUM(CASE WHEN status = 'ISSUED' THEN 1 ELSE 0 END) AS issuedBooks,
        SUM(CASE WHEN status = 'RESERVED' THEN 1 ELSE 0 END) AS reservedBooks,
        SUM(CASE WHEN status = 'LOST' THEN 1 ELSE 0 END) AS lostBooks,
        SUM(CASE WHEN status = 'DAMAGED' THEN 1 ELSE 0 END) AS damagedBooks,
        COALESCE(SUM(price), 0) AS totalValuationRs
      FROM books
      WHERE is_active = 1
    `).get();

    const borrowerCounts = this.db.prepare(`
      SELECT
        COUNT(*) AS totalBorrowers,
        SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) AS activeBorrowers
      FROM borrowers
    `).get();

    const loanCounts = this.db.prepare(`
      SELECT
        COUNT(*) AS totalLoans,
        SUM(CASE WHEN status IN ('ACTIVE', 'ISSUED') THEN 1 ELSE 0 END) AS activeLoans,
        SUM(CASE WHEN status = 'OVERDUE' OR (status IN ('ACTIVE', 'ISSUED') AND due_date < date('now')) THEN 1 ELSE 0 END) AS overdueLoans,
        SUM(CASE WHEN status = 'RETURNED' THEN 1 ELSE 0 END) AS returnedLoans,
        COALESCE(SUM(late_fine_amount), 0) AS totalFinesRs
      FROM loans
    `).get();

    const categoryBreakdown = this.db.prepare(`
      SELECT category, COUNT(*) AS count
      FROM books
      WHERE is_active = 1
      GROUP BY category
      ORDER BY count DESC
    `).all();

    const languageBreakdown = this.db.prepare(`
      SELECT language, COUNT(*) AS count
      FROM books
      WHERE is_active = 1
      GROUP BY language
      ORDER BY count DESC
    `).all();

    return {
      totalBooks: bookCounts.totalBooks || 0,
      availableBooks: bookCounts.availableBooks || 0,
      issuedBooks: bookCounts.issuedBooks || 0,
      reservedBooks: bookCounts.reservedBooks || 0,
      lostBooks: bookCounts.lostBooks || 0,
      damagedBooks: bookCounts.damagedBooks || 0,
      totalValuationRs: bookCounts.totalValuationRs || 0,
      totalBorrowers: borrowerCounts.totalBorrowers || 0,
      activeBorrowers: borrowerCounts.activeBorrowers || 0,
      totalLoans: loanCounts.totalLoans || 0,
      activeLoans: loanCounts.activeLoans || 0,
      overdueLoans: loanCounts.overdueLoans || 0,
      returnedLoans: loanCounts.returnedLoans || 0,
      totalFinesRs: loanCounts.totalFinesRs || 0,
      categoryBreakdown,
      languageBreakdown,
    };
  }

  _recalculateShelfOccupancy() {
    this.db.exec(`
      UPDATE shelves
      SET current_count = (
        SELECT COUNT(*) FROM books
        WHERE books.shelf_id = shelves.id AND books.is_active = 1
      ),
      updated_at = datetime('now');
    `);
  }

  recalculateShelfOccupancy() {
    this._recalculateShelfOccupancy();
  }

  migrateFromLocalStoragePayload(payload = {}, options = {}) {
    const batchSize = Math.max(100, Number(options.batchSize) || 250);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const preMigrationBackupPath = path.join(
      this.backupsDir,
      `pre-migration-localstorage-${timestamp}.json`
    );

    fs.writeFileSync(preMigrationBackupPath, JSON.stringify(payload, null, 2), 'utf8');

    const sourceBooks = Array.isArray(payload.books) ? payload.books : [];
    const sourceAlmaris = Array.isArray(payload.almaris) ? payload.almaris : [];
    const sourceShelves = Array.isArray(payload.shelves) ? payload.shelves : [];
    const sourceBorrowers = Array.isArray(payload.borrowers) ? payload.borrowers : [];
    const sourceLoans = Array.isArray(payload.loans) ? payload.loans : [];

    const initialBookCount = this._stmts.countActiveBooks.get().total;

    if (
      sourceBooks.length === 0 &&
      sourceAlmaris.length === 0 &&
      sourceBorrowers.length === 0 &&
      initialBookCount > 0
    ) {
      return {
        success: true,
        alreadyMigratedOrEmptySource: true,
        preMigrationBackupPath,
        message: 'SQLite database already contains records and localStorage source is empty; skipped empty overwrite.',
        counts: {
          sourceBooks: 0,
          initialDbBooks: initialBookCount,
          finalDbBooks: initialBookCount,
        },
      };
    }

    const migrateAlmarisAndShelves = this.db.transaction(() => {
      const upsertAlmari = this.db.prepare(`
        INSERT INTO almaris (id, code, name, section, location_hall, floor, total_shelves, default_category, active_status)
        VALUES (@id, @code, @name, @section, @location_hall, @floor, @total_shelves, @default_category, @active_status)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          section = excluded.section,
          location_hall = excluded.location_hall,
          total_shelves = excluded.total_shelves,
          default_category = excluded.default_category,
          updated_at = datetime('now')
      `);

      for (const a of sourceAlmaris) {
        if (!a || !a.id) continue;
        upsertAlmari.run({
          id: String(a.id),
          code: String(a.code || a.id),
          name: String(a.name || a.code || 'Almari'),
          section: String(a.section || 'General'),
          location_hall: String(a.location_hall || a.locationHall || 'Main Hall'),
          floor: String(a.floor || 'Ground Floor'),
          total_shelves: Number(a.total_shelves ?? a.totalShelves ?? 5) || 5,
          default_category: String(a.default_category ?? a.defaultCategory ?? ''),
          active_status: a.active_status !== undefined ? (a.active_status ? 1 : 0) : 1,
        });
      }

      const upsertShelf = this.db.prepare(`
        INSERT INTO shelves (id, almari_id, shelf_number, capacity, current_count, category_label)
        VALUES (@id, @almari_id, @shelf_number, @capacity, @current_count, @category_label)
        ON CONFLICT(id) DO UPDATE SET
          capacity = excluded.capacity,
          category_label = excluded.category_label,
          updated_at = datetime('now')
      `);

      for (const s of sourceShelves) {
        if (!s || !s.id || !(s.almari_id || s.almariId)) continue;
        upsertShelf.run({
          id: String(s.id),
          almari_id: String(s.almari_id || s.almariId),
          shelf_number: String(s.shelf_number ?? s.shelfNumber ?? '1'),
          capacity: Number(s.capacity || 100),
          current_count: Number(s.current_count ?? s.currentCount ?? 0),
          category_label: String(s.category_label ?? s.categoryLabel ?? ''),
        });
      }
    });
    migrateAlmarisAndShelves();

    let totalInserted = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalRejected = 0;
    const allErrors = [];

    for (let offset = 0; offset < sourceBooks.length; offset += batchSize) {
      const chunk = sourceBooks.slice(offset, offset + batchSize);
      const batchResult = this.importBookBatchTransactional(chunk, {
        onDuplicate: 'skip',
        rowOffset: offset,
        skipShelfRecalc: true,
      });
      totalInserted += batchResult.inserted;
      totalUpdated += batchResult.updated;
      totalSkipped += batchResult.skippedDuplicates;
      totalRejected += batchResult.rejected;
      if (batchResult.errors.length > 0) {
        allErrors.push(...batchResult.errors);
      }
    }
    this._recalculateShelfOccupancy();

    let migratedBorrowers = 0;
    let migratedLoans = 0;
    const migrateBorrowersAndLoans = this.db.transaction(() => {
      const upsertBorrower = this.db.prepare(`
        INSERT INTO borrowers (
          id, member_id, barcode, full_name, role, department,
          batch_year, phone, email, max_books_allowed, active_loans_count, status
        ) VALUES (
          @id, @member_id, @barcode, @full_name, @role, @department,
          @batch_year, @phone, @email, @max_books_allowed, @active_loans_count, @status
        )
        ON CONFLICT(member_id) DO NOTHING
      `);

      for (const b of sourceBorrowers) {
        if (!b) continue;
        const memberId = normalizeIdentifier(b.member_id ?? b.memberId ?? b.id);
        if (!memberId) continue;
        const info = upsertBorrower.run({
          id: String(b.id || `borrower_${memberId}`),
          member_id: memberId,
          barcode: normalizeIdentifier(b.barcode) || null,
          full_name: String(b.full_name ?? b.fullName ?? b.name ?? 'Unknown Member'),
          role: ['STUDENT', 'FACULTY', 'STAFF', 'EXTERNAL'].includes(String(b.role || '').toUpperCase())
            ? String(b.role).toUpperCase()
            : 'STUDENT',
          department: String(b.department || ''),
          batch_year: String(b.batch_year ?? b.batchYear ?? ''),
          phone: String(b.phone || ''),
          email: String(b.email || ''),
          max_books_allowed: Number(b.max_books_allowed ?? b.maxBooksAllowed ?? 3) || 3,
          active_loans_count: Number(b.active_loans_count ?? b.activeLoansCount ?? 0) || 0,
          status: ['ACTIVE', 'SUSPENDED', 'EXPIRED'].includes(String(b.status || '').toUpperCase())
            ? String(b.status).toUpperCase()
            : 'ACTIVE',
        });
        if (info.changes > 0) migratedBorrowers++;
      }

      const upsertLoan = this.db.prepare(`
        INSERT INTO loans (
          id, loan_slip_number, book_id, borrower_id, issue_date,
          due_date, return_date, renewal_count, late_fine_amount, fine_status, status, notes
        ) VALUES (
          @id, @loan_slip_number, @book_id, @borrower_id, @issue_date,
          @due_date, @return_date, @renewal_count, @late_fine_amount, @fine_status, @status, @notes
        )
        ON CONFLICT(loan_slip_number) DO NOTHING
      `);

      for (const l of sourceLoans) {
        if (!l) continue;
        const bookId = String(l.book_id ?? l.bookId ?? '');
        const borrowerId = String(l.borrower_id ?? l.borrowerId ?? '');
        if (!bookId || !borrowerId) continue;
        const bookExists = this._stmts.getBookById.get(bookId);
        if (!bookExists) continue;
        const slipNo = normalizeIdentifier(l.loan_slip_number ?? l.loanSlipNumber ?? l.id);
        const info = upsertLoan.run({
          id: String(l.id || `loan_${slipNo}`),
          loan_slip_number: slipNo,
          book_id: bookId,
          borrower_id: borrowerId,
          issue_date: String(l.issue_date ?? l.issueDate ?? new Date().toISOString().slice(0, 10)),
          due_date: String(l.due_date ?? l.dueDate ?? new Date().toISOString().slice(0, 10)),
          return_date: l.return_date ?? l.returnDate ?? null,
          renewal_count: Number(l.renewal_count ?? l.renewalCount ?? 0) || 0,
          late_fine_amount: Number(l.late_fine_amount ?? l.lateFineAmount ?? 0) || 0,
          fine_status: ['NONE', 'UNPAID', 'PAID', 'WAIVED'].includes(String(l.fine_status || '').toUpperCase())
            ? String(l.fine_status).toUpperCase()
            : 'NONE',
          status: ['ACTIVE', 'ISSUED', 'RETURNED', 'OVERDUE', 'LOST'].includes(String(l.status || '').toUpperCase())
            ? String(l.status).toUpperCase()
            : 'ACTIVE',
          notes: String(l.notes || ''),
        });
        if (info.changes > 0) migratedLoans++;
      }
    });
    migrateBorrowersAndLoans();

    const finalDbBooks = this._stmts.countActiveBooks.get().total;
    const sampleChecks = [];
    if (sourceBooks.length > 0) {
      const indicesToVerify = Array.from(
        new Set([0, Math.floor(sourceBooks.length / 2), sourceBooks.length - 1])
      );
      for (const idx of indicesToVerify) {
        const normalized = this.normalizeAndValidateBook(sourceBooks[idx], idx);
        if (normalized.valid) {
          const dbRow = this._stmts.getBookByAccession.get(normalized.record.accession_number);
          sampleChecks.push({
            index: idx,
            accessionNumber: normalized.record.accession_number,
            expectedTitle: normalized.record.title,
            foundInDb: Boolean(dbRow && dbRow.accession_number === normalized.record.accession_number),
          });
        }
      }
    }

    const allSamplesVerified = sampleChecks.every((s) => s.foundInDb);
    const expectedAccountedFor =
      totalInserted + totalUpdated + totalSkipped + totalRejected === sourceBooks.length;
    const verificationPassed =
      expectedAccountedFor &&
      allSamplesVerified &&
      finalDbBooks >= totalInserted;

    if (verificationPassed) {
      this._stmts.setSetting.run('localstorage_migration_verified', new Date().toISOString());
      this._stmts.insertAuditLog.run(
        'MIGRATE_LOCALSTORAGE',
        'system',
        'ulm-library.sqlite',
        `Verified migration: source=${sourceBooks.length}, inserted=${totalInserted}, skipped=${totalSkipped}, rejected=${totalRejected}, final=${finalDbBooks}`
      );
    }

    return {
      success: verificationPassed,
      preMigrationBackupPath,
      counts: {
        sourceBooks: sourceBooks.length,
        initialDbBooks: initialBookCount,
        migratedInserted: totalInserted,
        migratedUpdated: totalUpdated,
        skippedDuplicates: totalSkipped,
        failedRejected: totalRejected,
        finalDbBooks,
        migratedBorrowers,
        migratedLoans,
      },
      sampleChecks,
      errors: allErrors.slice(0, 200),
    };
  }

  changeDataDirectory(newDirectoryPath) {
    if (!newDirectoryPath || typeof newDirectoryPath !== 'string') {
      throw new Error('A valid target folder path is required.');
    }
    const resolvedTarget = path.resolve(newDirectoryPath.trim());
    if (resolvedTarget === this.activeDataDir) {
      return { changed: false, activeDataDir: this.activeDataDir, dbPath: this.dbPath };
    }

    fs.mkdirSync(resolvedTarget, { recursive: true });
    const expectedCount = this._stmts.countActiveBooks.get().total;

    this._checkpointSafely();
    this.db.close();

    const targetDbPath = path.join(resolvedTarget, DB_FILENAME);
    const targetCoversDir = path.join(resolvedTarget, COVERS_DIRNAME);
    const targetBackupsDir = path.join(resolvedTarget, BACKUPS_DIRNAME);

    fs.mkdirSync(targetCoversDir, { recursive: true });
    fs.mkdirSync(targetBackupsDir, { recursive: true });

    if (fs.existsSync(this.dbPath) && !fs.existsSync(targetDbPath)) {
      fs.copyFileSync(this.dbPath, targetDbPath);
    }

    if (fs.existsSync(this.coversDir)) {
      for (const file of fs.readdirSync(this.coversDir)) {
        const srcFile = path.join(this.coversDir, file);
        const destFile = path.join(targetCoversDir, file);
        if (!fs.existsSync(destFile) && fs.statSync(srcFile).isFile()) {
          fs.copyFileSync(srcFile, destFile);
        }
      }
    }

    this.activeDataDir = resolvedTarget;
    this.dbPath = targetDbPath;
    this.coversDir = targetCoversDir;
    this.backupsDir = targetBackupsDir;
    this.init();

    const verifiedCount = this._stmts.countActiveBooks.get().total;
    if (verifiedCount < expectedCount) {
      throw new Error(
        `Data folder switch verification failed: expected ${expectedCount} books, found ${verifiedCount}.`
      );
    }

    fs.writeFileSync(
      this.configPath,
      JSON.stringify({ customDataDir: resolvedTarget, updatedAt: new Date().toISOString() }, null, 2),
      'utf8'
    );

    return {
      changed: true,
      activeDataDir: this.activeDataDir,
      dbPath: this.dbPath,
      verifiedBookCount: verifiedCount,
    };
  }

  createBackupSnapshot(customOutputPath = null) {
    this._checkpointSafely();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDbPath =
      customOutputPath ||
      path.join(this.backupsDir, `ulm-library-backup-${timestamp}.sqlite`);

    fs.mkdirSync(path.dirname(backupDbPath), { recursive: true });
    fs.copyFileSync(this.dbPath, backupDbPath);

    const fileBuffer = fs.readFileSync(backupDbPath);
    const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    const stats = this.getDashboardStats();

    const manifest = {
      createdAt: new Date().toISOString(),
      backupDbPath,
      sha256,
      sizeBytes: fileBuffer.length,
      totalBooks: stats.totalBooks,
      totalBorrowers: stats.totalBorrowers,
      totalLoans: stats.totalLoans,
    };

    fs.writeFileSync(`${backupDbPath}.manifest.json`, JSON.stringify(manifest, null, 2), 'utf8');
    this._stmts.insertAuditLog.run('CREATE_BACKUP', 'system', backupDbPath, `SHA256: ${sha256}`);

    return manifest;
  }

  restoreBackupSnapshot(sourceBackupDbPath) {
    const resolvedBackup = path.resolve(sourceBackupDbPath);
    if (!fs.existsSync(resolvedBackup)) {
      throw new Error(`Backup file not found: ${resolvedBackup}`);
    }

    const testDb = new this.DatabaseDriver(resolvedBackup, { readonly: true });
    const integrity = testDb.pragma('integrity_check', { simple: true });
    const backupBookCount = testDb.prepare('SELECT COUNT(*) AS total FROM books').get().total;
    testDb.close();

    if (integrity !== 'ok') {
      throw new Error(`Backup file failed SQLite integrity check: ${integrity}`);
    }

    const preRestoreSafetyBackup = this.createBackupSnapshot(
      path.join(this.backupsDir, `pre-restore-safety-${Date.now()}.sqlite`)
    );

    this.db.close();
    fs.copyFileSync(resolvedBackup, this.dbPath);
    for (const suffix of ['-wal', '-shm']) {
      const walFile = `${this.dbPath}${suffix}`;
      if (fs.existsSync(walFile)) fs.unlinkSync(walFile);
    }

    this.init();
    this._stmts.insertAuditLog.run(
      'RESTORE_BACKUP',
      'system',
      resolvedBackup,
      `Restored ${backupBookCount} books (safety backup: ${preRestoreSafetyBackup.backupDbPath})`
    );

    return {
      restored: true,
      restoredBookCount: backupBookCount,
      preRestoreSafetyBackupPath: preRestoreSafetyBackup.backupDbPath,
    };
  }

  close() {
    if (this.db) {
      try {
        this._checkpointSafely();
        this.db.close();
      } catch (_) {}
      this.db = null;
    }
  }
}

module.exports = {
  UlmSqliteEngine,
  normalizeIdentifier,
};
