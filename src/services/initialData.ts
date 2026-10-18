import { Book, Borrower, Transaction, HistoryEntry, SystemSettings } from '../types/library';

const RAW_INITIAL_BOOKS: Omit<Book, 'title_sort' | 'author_sort' | 'search_text'>[] = [];

export const INITIAL_BOOKS: Book[] = [];

export const INITIAL_BORROWERS: Borrower[] = [];

export const INITIAL_TRANSACTIONS: Transaction[] = [];

export const INITIAL_HISTORY: HistoryEntry[] = [];

export const INITIAL_SETTINGS: SystemSettings = {
  library_name: 'Central Campus Library',
  university_name: 'University of Lakki Marwat',
  campus_address: 'Main Campus, Bannu-Mianwali Road, Lakki Marwat, Khyber Pakhtunkhwa, Pakistan',
  phone: '+92 969 511819',
  email: 'library@ulm.edu.pk',
  auto_submit_scan: true,
  scanner_sound: true,
  error_sound: true,
  db_path: 'C:\\ProgramData\\ULM_LMS\\library.db',
  wal_mode: true,
  station_id: 'LMS-WIN-01',
  barcode_prefix: 'ULM',
  first_accession_number: 1,
};
