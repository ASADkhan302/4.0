import * as XLSX from 'xlsx';
import type { Almari, Book, Borrower, Transaction } from '../types/library';
import { saveAutoBackupToDisk, writeFileToRepoFolder } from './desktopBridge';

export const MASTER_EXCEL_DISK_FILENAME = 'ULM_Master_Books_Register.xlsx';
export const AUTO_BACKUP_DISK_FILENAME = 'ULM_Library_AutoBackup.json';
const LAST_SYNC_META_KEY = 'ulm_last_master_excel_sync_v1';

export interface MasterExcelSyncResult {
  ok: boolean;
  excelWritten: boolean;
  backupWritten: boolean;
  bookCount: number;
  syncedAt: string;
  fullPath?: string;
}

/**
 * Builds the official multi-sheet ULM Master Excel workbook (`Books Catalog`, `Members`, `Circulation Loans`, `Almaris`)
 * and writes both `ULM_Master_Books_Register.xlsx` and `ULM_Library_AutoBackup.json` into the chosen data folder.
 */
export async function syncMasterExcelToDisk(
  books: Book[],
  members: Borrower[] = [],
  loans: Transaction[] = [],
  almaris: Almari[] = []
): Promise<MasterExcelSyncResult> {
  const syncedAt = new Date().toISOString();
  const safeBooks = Array.isArray(books) ? books.filter((b) => b && b.is_active !== false) : [];
  const safeMembers = Array.isArray(members) ? members : [];
  const safeLoans = Array.isArray(loans) ? loans : [];
  const safeAlmaris = Array.isArray(almaris) ? almaris : [];

  try {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Books Catalog
    const bookRows = safeBooks.map((b, idx) => ({
      'S.No': idx + 1,
      'Accession No': b.accession_no || '',
      'Barcode': b.barcode || '',
      'Title': b.book_name || '',
      'Author': b.author || '',
      'Category': b.category || '',
      'ISBN': b.isbn || '',
      'Dewey Call No': b.dewey_call_number || '',
      'Publisher': b.publisher || '',
      'Edition': b.edition || '',
      'Year': b.publication_year || '',
      'Language': b.language || 'English',
      'Almari': (b as Book & { almari_code?: string }).almari_code || b.almari_id || '',
      'Shelf No': b.shelf_no || b.shelf || '',
      'Status': b.is_checked_out || Number(b.available_quantity ?? 1) === 0 ? 'CHECKED OUT' : 'AVAILABLE',
      'Date Added': b.date_added || (b.created_at ? b.created_at.slice(0, 10) : ''),
    }));
    const booksSheet = XLSX.utils.json_to_sheet(
      bookRows.length > 0
        ? bookRows
        : [
            {
              'S.No': '',
              'Accession No': '',
              'Barcode': '',
              'Title': '',
              'Author': '',
              'Category': '',
              'ISBN': '',
              'Dewey Call No': '',
              'Publisher': '',
              'Edition': '',
              'Year': '',
              'Language': '',
              'Almari': '',
              'Shelf No': '',
              'Status': '',
              'Date Added': '',
            },
          ]
    );
    XLSX.utils.book_append_sheet(wb, booksSheet, 'Books Catalog');

    // Sheet 2: Members
    const memberRows = safeMembers.map((m, idx) => ({
      'S.No': idx + 1,
      'Member ID': m.university_id || m.student_id || '',
      'Barcode': m.barcode || m.university_id || m.student_id || '',
      'Full Name': m.name || '',
      'Role': m.role || 'Student',
      'Department': m.department || '',
      'Program': m.program || '',
      'Roll No': m.roll_number || '',
      'Session': m.session || '',
      'Phone': m.phone || '',
      'Email': m.email || '',
      'Status': m.status || 'active',
      'Borrow Limit': m.borrow_limit ?? 3,
      'Valid Until': m.valid_until || '',
    }));
    const membersSheet = XLSX.utils.json_to_sheet(
      memberRows.length > 0
        ? memberRows
        : [
            {
              'S.No': '',
              'Member ID': '',
              'Barcode': '',
              'Full Name': '',
              'Role': '',
              'Department': '',
              'Program': '',
              'Roll No': '',
              'Session': '',
              'Phone': '',
              'Email': '',
              'Status': '',
              'Borrow Limit': '',
              'Valid Until': '',
            },
          ]
    );
    XLSX.utils.book_append_sheet(wb, membersSheet, 'Members');

    // Sheet 3: Circulation Loans
    const loanRows = safeLoans.map((t, idx) => ({
      'S.No': idx + 1,
      'Loan ID': t.id || '',
      'Book Title': t.book_name || '',
      'Barcode': t.barcode || '',
      'Borrower Name': t.borrower_name || '',
      'Member ID': t.student_id || t.borrower_id || '',
      'Issue Date': t.issue_date || '',
      'Due Date': t.due_date || '',
      'Return Date': t.return_date || '',
      'Status': t.status || '',
      'Fine Amount': (t as Transaction & { fine_amount?: number }).fine_amount ?? 0,
    }));
    const loansSheet = XLSX.utils.json_to_sheet(
      loanRows.length > 0
        ? loanRows
        : [
            {
              'S.No': '',
              'Loan ID': '',
              'Book Title': '',
              'Barcode': '',
              'Borrower Name': '',
              'Member ID': '',
              'Issue Date': '',
              'Due Date': '',
              'Return Date': '',
              'Status': '',
              'Fine Amount': '',
            },
          ]
    );
    XLSX.utils.book_append_sheet(wb, loansSheet, 'Circulation Loans');

    // Sheet 4: Almaris
    const almariRows = safeAlmaris.map((a, idx) => ({
      'S.No': idx + 1,
      'Code': a.code || '',
      'Name': a.name_en || '',
      'Shelves': a.shelf_count || 5,
      'Books Per Shelf': a.books_per_shelf || 30,
      'Location': a.location_note || '',
      'Active': a.is_active !== false ? 'Yes' : 'No',
    }));
    const almarisSheet = XLSX.utils.json_to_sheet(
      almariRows.length > 0
        ? almariRows
        : [
            {
              'S.No': '',
              'Code': '',
              'Name': '',
              'Shelves': '',
              'Books Per Shelf': '',
              'Location': '',
              'Active': '',
            },
          ]
    );
    XLSX.utils.book_append_sheet(wb, almarisSheet, 'Almaris');

    const xlsxArrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
    const xlsxBytes = new Uint8Array(xlsxArrayBuffer);

    const excelWriteRes = await writeFileToRepoFolder(
      MASTER_EXCEL_DISK_FILENAME,
      xlsxBytes,
      true
    );

    const backupPayload = {
      schema_version: '2.0',
      application: 'ULM Central Campus Library Management System',
      synced_at: syncedAt,
      counts: {
        books: safeBooks.length,
        members: safeMembers.length,
        loans: safeLoans.length,
        almaris: safeAlmaris.length,
      },
      books: safeBooks,
      borrowers: safeMembers,
      transactions: safeLoans,
      almaris: safeAlmaris,
    };

    const backupWriteRes = await saveAutoBackupToDisk(backupPayload, AUTO_BACKUP_DISK_FILENAME);

    try {
      localStorage.setItem(
        LAST_SYNC_META_KEY,
        JSON.stringify({
          syncedAt,
          bookCount: safeBooks.length,
          memberCount: safeMembers.length,
          loanCount: safeLoans.length,
          excelWritten: excelWriteRes.ok,
          backupWritten: backupWriteRes.ok,
          fullPath: excelWriteRes.fullPath || backupWriteRes.fullPath || null,
        })
      );
      localStorage.setItem('ulm_master_excel_book_count', String(safeBooks.length));
    } catch {
      // Ignore storage quota restrictions
    }

    return {
      ok: excelWriteRes.ok || backupWriteRes.ok,
      excelWritten: excelWriteRes.ok,
      backupWritten: backupWriteRes.ok,
      bookCount: safeBooks.length,
      syncedAt,
      fullPath: excelWriteRes.fullPath || backupWriteRes.fullPath,
    };
  } catch (err) {
    console.warn('[ULM-MasterExcelSync] Silent sync note:', err);
    return {
      ok: false,
      excelWritten: false,
      backupWritten: false,
      bookCount: safeBooks.length,
      syncedAt,
    };
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Debounced (800ms) live Master Excel & AutoBackup disk sync.
 * Call after any add, copy, edit, delete, import, or initial setup action.
 */
export function scheduleMasterExcelSync(
  getSnapshot: () => {
    books: Book[];
    members: Borrower[];
    loans: Transaction[];
    almaris: Almari[];
  },
  delayMs: number = 800
): void {
  if (typeof window === 'undefined') return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    try {
      const snap = getSnapshot();
      void syncMasterExcelToDisk(snap.books, snap.members, snap.loans, snap.almaris);
    } catch {
      // Never block UI on background disk sync
    }
  }, delayMs);
}
