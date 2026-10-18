/**
 * ULM Central Campus Library Management System
 * High-Scale Excel & CSV Processing Service (src/services/excel.ts)
 *
 * Unlimited Collection Support:
 * - Zero 5,000-book caps (supports 1,00,000+ to 10,00,000+ volumes)
 * - Auto-generates unique accession numbers when missing or when consecutive sheets restart numbering
 * - Bulk generator for high-scale test datasets (+25,000 books)
 */

import { Book } from '../types/library';
import { getTrueDatabaseBookCount } from './libraryStorageAndMigration';

export const MAX_IMPORT_ROWS = Number.MAX_SAFE_INTEGER; // Unlimited books

export interface ExcelImportOptions {
  currentTotalCount?: number;
  onDuplicate?: 'skip' | 'upsert' | 'increment';
}

/**
 * Normalizes raw Excel rows and generates clean, non-colliding Accession Numbers
 * even if multiple consecutive files have row numbers starting at 1.
 */
export function processRawExcelRows(
  rawRows: Array<Record<string, unknown>>,
  options: ExcelImportOptions = {}
): Array<Record<string, unknown>> {
  const currentTotal = options.currentTotalCount || 0;
  const processed: Array<Record<string, unknown>> = [];
  const seenAccessions = new Set<string>();
  const seenBarcodes = new Set<string>();

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i] || {};
    const normalizedKeys: Record<string, unknown> = {};

    for (const [k, v] of Object.entries(raw)) {
      normalizedKeys[k.trim().toLowerCase().replace(/[\s._-]+/g, '_')] = v;
    }

    const pick = (...keys: string[]): string => {
      for (const k of keys) {
        const val = normalizedKeys[k] ?? raw[k];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          return String(val).trim();
        }
      }
      return '';
    };

    let accessionNo = pick('accession_no', 'accession_number', 'acc_no', 'accession', 'sr_no');
    // If accession number is empty or repeated/colliding across sheets, auto-generate unique accession
    if (!accessionNo || seenAccessions.has(accessionNo.toLowerCase())) {
      accessionNo = String(currentTotal + i + 1).padStart(6, '0');
      if (seenAccessions.has(accessionNo.toLowerCase())) {
        accessionNo = `${accessionNo}_${i + 1}`;
      }
    }
    seenAccessions.add(accessionNo.toLowerCase());

    const title = pick('title', 'book_title', 'name_of_book', 'book_name') || `Volume #${currentTotal + i + 1}`;
    const author = pick('author', 'author_name', 'writer') || 'Unknown Author';
    const category = pick('category', 'discipline', 'subject', 'department') || 'General';
    const language = pick('language', 'lang') || 'English';
    const publisher = pick('publisher', 'publisher_name') || 'University of Lakki Marwat Press';
    const callNumber = pick('call_number', 'call_no', 'dewey_call_no') || '000 ULM';
    const shelf = pick('shelf', 'shelf_label', 'almari_shelf') || 'Stack-01';

    let barcode = pick('barcode', 'barcode_no');
    if (!barcode || seenBarcodes.has(barcode.toLowerCase())) {
      barcode = `ULM-${accessionNo}`;
      if (seenBarcodes.has(barcode.toLowerCase())) {
        barcode = `ULM-${accessionNo}-${i + 1}`;
      }
    }
    seenBarcodes.add(barcode.toLowerCase());

    const totalCopies = Number(pick('copies', 'total_copies', 'total_quantity', 'quantity')) || 1;
    const rawAvail = pick('available_copies', 'available_quantity');
    const availCopies = (rawAvail !== '' && rawAvail !== undefined) ? (Number(rawAvail) || 0) : totalCopies;
    const isIssued = pick('status').toUpperCase() === 'ISSUED';
    const status = isIssued ? 'ISSUED' : 'AVAILABLE';

    processed.push({
      ...raw,
      id: String(raw.id || `book_${accessionNo}_${currentTotal + i + 1}`),
      accession_number: accessionNo,
      accessionNumber: accessionNo,
      barcode,
      title,
      author,
      category,
      discipline: category,
      language,
      publisher,
      call_number: callNumber,
      shelf_label: shelf,
      total_quantity: totalCopies,
      available_quantity: isIssued ? 0 : Math.max(1, availCopies),
      copies: totalCopies,
      available_copies: isIssued ? 0 : Math.max(1, availCopies),
      status,
      is_active: 1,
    });
  }

  return processed;
}

/**
 * Generates +25,000 synthetic test books in 500-record chunks
 * to stress test and verify 1,00,000+ book scalability.
 */
export async function generateAndInsert25000TestBooks(
  onProgress?: (progress: { inserted: number; total: number; percent: number }) => void
): Promise<{ success: boolean; insertedCount: number; newTotal: number }> {
  const currentCount = await getTrueDatabaseBookCount();
  const targetTotal = 25000;
  const chunkSize = 500;
  let insertedSoFar = 0;

  const categories = ['Computer Science', 'Islamic Studies', 'Urdu Literature', 'Mathematics', 'Physics', 'Chemistry', 'English Literature', 'Education', 'Political Science', 'Economics'];
  const authors = ['Dr. Tariq Khan', 'Prof. Mohammad Usman', 'Dr. Asma Bibi', 'Prof. Ahmad Shah', 'Allama Iqbal', 'Mirza Ghalib', 'Al-Khwarizmi', 'Ibn Sina', 'Dr. Farooq Marwat', 'Prof. Gul Zaman'];
  const publishers = ['ULM Academic Press', 'Oxford University Press', 'Sang-e-Meel Publications', 'Ferozsons Lahore', 'Caravan Book House', 'National Language Authority'];

  const bridge = typeof window !== 'undefined' ? (window.ulmLibraryApi || (window as any).ulmElectronSqlite) : null;

  for (let offset = 0; offset < targetTotal; offset += chunkSize) {
    const chunk: Array<Record<string, unknown>> = [];
    const thisChunkSize = Math.min(chunkSize, targetTotal - offset);

    for (let j = 0; j < thisChunkSize; j++) {
      const globalIndex = currentCount + offset + j + 1;
      const acc = String(globalIndex).padStart(6, '0');
      const cat = categories[globalIndex % categories.length];
      const author = authors[globalIndex % authors.length];
      const pub = publishers[globalIndex % publishers.length];
      const year = 1990 + (globalIndex % 34);

      chunk.push({
        id: `test_book_${acc}`,
        accession_number: acc,
        accessionNumber: acc,
        barcode: `ULM-${acc}`,
        title: `ULM Academic Treatise Vol. ${globalIndex} (${cat})`,
        author,
        publisher: pub,
        publication_year: String(year),
        category: cat,
        language: globalIndex % 4 === 0 ? 'Urdu' : globalIndex % 7 === 0 ? 'Pashto' : 'English',
        call_number: `${100 + (globalIndex % 800)} ULM.${acc.slice(-3)}`,
        shelf_label: `ALM-${String(1 + (globalIndex % 30)).padStart(2, '0')}-S${1 + (globalIndex % 5)}`,
        status: 'AVAILABLE',
        price_rs: 450 + (globalIndex % 1500),
        binding: globalIndex % 2 === 0 ? 'Hardbound' : 'Paperback',
        pages: String(180 + (globalIndex % 500)),
        is_active: 1,
      });
    }

    if (bridge && typeof bridge.importSingleChunk === 'function') {
      await bridge.importSingleChunk(chunk, {
        onDuplicate: 'upsert',
        rowOffset: currentCount + offset,
        isFinalChunk: offset + thisChunkSize >= targetTotal,
      });
    } else if (typeof indexedDB !== 'undefined') {
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('ulm_library_idb_v1', 1);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('books', 'readwrite');
          const store = tx.objectStore('books');
          for (const item of chunk) {
            store.put(item);
          }
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error);
          };
        };
        req.onerror = () => reject(req.error);
      });
    }

    insertedSoFar += thisChunkSize;
    if (onProgress) {
      onProgress({
        inserted: insertedSoFar,
        total: targetTotal,
        percent: Math.round((insertedSoFar / targetTotal) * 100),
      });
    }

    // Yield to keep UI smooth
    await new Promise((r) => setTimeout(r, 0));
  }

  const finalCount = await getTrueDatabaseBookCount();
  return {
    success: true,
    insertedCount: insertedSoFar,
    newTotal: finalCount,
  };
}
