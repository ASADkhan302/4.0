import { Book, Almari } from '../types/library';
import { AlmariService } from './almariService';
import { StorageEngine } from './storageEngine';
import { LibraryStorage, reconcileBooksWithLoans } from './storage';
import { computeSortKey, computeSearchText } from '../utils/urduUtils';
import { updateHeavyTaskProgress } from '../utils/heavyTaskRunner';
import { computeBookSearchKey } from './indexedDbStorage';

const MASTER_PLACEMENTS_KEY = 'ulm_almari_placements_master_v3';

export interface SeriesAllocationResult {
  newCopies: Book[];
  updatedCatalog: Book[];
  firstAccession: number;
  lastAccession: number;
  nextAvailableAccession: number;
  firstBarcode: string;
  lastBarcode: string;
  existingSiblingsCount: number;
  totalCopiesAfterAdd: number;
}

export class AccessionSeriesEngine {
  /**
   * Scans ONLY the active books currently in the catalog to find used Accession integers
   * and Barcodes. Never inflates maxAccession with stale deleted counters.
   */
  public static getSeriesState(books: Book[]): {
    usedAccessions: Set<number>;
    usedBarcodes: Set<string>;
    maxAccession: number;
    nextAccession: number;
  } {
    const usedAccessions = new Set<number>();
    const usedBarcodes = new Set<string>();
    let maxAccession = 0;

    const activeBooks = (books || []).filter(
      (b) => b && b.is_active !== false && (b.is_active as unknown) !== 0
    );

    for (const b of activeBooks) {
      const rawAcc = String(b.accession_no ?? '').replace(/\D/g, '');
      const accNum = parseInt(rawAcc, 10);
      if (!isNaN(accNum) && accNum > 0) {
        usedAccessions.add(accNum);
        if (accNum > maxAccession) maxAccession = accNum;
      }
      if (b.barcode) {
        const cleanBc = String(b.barcode).trim().toUpperCase();
        usedBarcodes.add(cleanBc);
        if (/^0092\d{9}$/.test(cleanBc)) {
          const bcSeq = parseInt(cleanBc.slice(4), 10);
          if (!isNaN(bcSeq) && bcSeq > 0) {
            usedAccessions.add(bcSeq);
            if (bcSeq > maxAccession) maxAccession = bcSeq;
          }
        }
      }
    }

    // Keep ulm_highest_serial_number_v1 strictly synced to actual active catalog maxAccession
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('ulm_highest_serial_number_v1', String(maxAccession));
      } catch {}
    }

    return {
      usedAccessions,
      usedBarcodes,
      maxAccession,
      nextAccession: maxAccession + 1,
    };
  }

  /**
   * Formats an integer Accession number into the official 13-digit ULM barcode.
   */
  public static formatBarcode(accessionNumber: number): string {
    return `0092${String(Math.max(1, accessionNumber)).padStart(9, '0')}`;
  }

  /**
   * Finds existing sibling copies of a book in the catalog by group_id, ISBN, or normalized Title + Author.
   */
  public static findExistingSiblings(
    currentBooks: Book[],
    baseBook: Partial<Book>
  ): Book[] {
    const normTitle = (baseBook.book_name || baseBook.title || '').trim().toLowerCase();
    const normAuthor = (baseBook.author || '').trim().toLowerCase();
    const normIsbn = (baseBook.isbn || '').trim().replace(/[-\s]/g, '').toLowerCase();

    if (!normTitle && !normIsbn && !baseBook.group_id) return [];

    return (currentBooks || []).filter((b) => {
      if (!b || b.is_active === false || (b.is_active as unknown) === 0) return false;
      if (baseBook.group_id && b.group_id && baseBook.group_id === b.group_id) return true;
      const bIsbn = (b.isbn || '').trim().replace(/[-\s]/g, '').toLowerCase();
      if (normIsbn && bIsbn && normIsbn.length >= 6 && normIsbn === bIsbn) return true;
      const bTitle = (b.book_name || b.title || '').trim().toLowerCase();
      const bAuthor = (b.author || '').trim().toLowerCase();
      return (
        normTitle !== '' &&
        bTitle === normTitle &&
        (normAuthor === '' || bAuthor === '' || bAuthor === normAuthor)
      );
    });
  }

  /**
   * PIPELINE A & B:
   * Adds a new book (with 1..N copies) OR extends an existing book with +N additional copies
   * strictly following the global Accession & Barcode series.
   */
  public static addOrExtendBookInSeries(
    currentBooks: Book[],
    params: {
      baseBook: Partial<Book>;
      copiesToAdd: number;
      preferredStartAccession?: number;
      preferredStartBarcode?: string;
      almari?: Almari | null;
      shelfNo?: number;
    }
  ): SeriesAllocationResult {
    const count = Math.max(1, Math.min(500, Number(params.copiesToAdd) || 1));
    const { usedAccessions, usedBarcodes, nextAccession } = this.getSeriesState(currentBooks);

    const existingSiblings = this.findExistingSiblings(currentBooks, params.baseBook);
    const existingCopyCount = existingSiblings.length;
    const totalCopiesAfterAdd = existingCopyCount + count;
    const sharedGroupId =
      existingSiblings[0]?.group_id ||
      params.baseBook.group_id ||
      `grp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // If extending an existing book, ALWAYS start at nextAccession (end of global series).
    // Otherwise use preferredStartAccession if unused, else nextAccession.
    let cursorAcc =
      existingCopyCount === 0 &&
      params.preferredStartAccession &&
      params.preferredStartAccession > 0 &&
      !usedAccessions.has(params.preferredStartAccession)
        ? params.preferredStartAccession
        : nextAccession;

    // Resolve Almari & Shelf (inherit from existing sibling if extending and not overridden)
    const allAlmaris = AlmariService.getAlmaris();
    const resolvedAlmari =
      params.almari ||
      (params.baseBook.almari_id
        ? allAlmaris.find((a) => a.id === params.baseBook.almari_id)
        : null) ||
      (params.baseBook.almari_code
        ? allAlmaris.find(
            (a) => a.code.toLowerCase() === String(params.baseBook.almari_code).trim().toLowerCase()
          )
        : null) ||
      (existingSiblings[0]?.almari_id
        ? allAlmaris.find((a) => a.id === existingSiblings[0].almari_id)
        : null) ||
      null;

    const resolvedShelfNo = resolvedAlmari
      ? Number(params.shelfNo || params.baseBook.shelf_no || existingSiblings[0]?.shelf_no || 1)
      : 0;

    const newCopies: Book[] = [];
    const nowIso = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const todayDate = new Date().toISOString().split('T')[0];

    // Check if user explicitly typed a custom non-0092 barcode
    const rawCustomBc = (params.preferredStartBarcode || '').trim();
    const isCustomNonStandardBc = rawCustomBc !== '' && !/^0092\d{9}$/.test(rawCustomBc);

    for (let i = 0; i < count; i++) {
      while (usedAccessions.has(cursorAcc) || usedBarcodes.has(this.formatBarcode(cursorAcc))) {
        cursorAcc++;
      }

      const accStr = String(cursorAcc);
      // Guarantee Barcode strictly matches cursorAcc for all standard 0092 barcodes
      const barcodeStr =
        i === 0 && isCustomNonStandardBc && !usedBarcodes.has(rawCustomBc.toUpperCase())
          ? rawCustomBc
          : this.formatBarcode(cursorAcc);

      usedAccessions.add(cursorAcc);
      usedBarcodes.add(barcodeStr.toUpperCase());

      const copyIndex = existingCopyCount + i + 1;
      const template = existingSiblings[0] || ({} as Partial<Book>);

      const cleanTitle = (
        params.baseBook.book_name ||
        params.baseBook.title ||
        template.book_name ||
        'Untitled Volume'
      ).trim();
      const cleanAuthor = (
        params.baseBook.author ||
        template.author ||
        'ULM Library Collection'
      ).trim();
      const cleanPublisher = (
        params.baseBook.publisher ||
        template.publisher ||
        'ULM Press'
      ).trim();
      const cleanCategory = (
        params.baseBook.category ||
        params.baseBook.discipline ||
        template.category ||
        template.discipline ||
        'General'
      ).trim();
      const cleanIsbn = (params.baseBook.isbn ?? template.isbn ?? '').trim();
      const cleanDewey = (
        params.baseBook.dewey_call_number ||
        params.baseBook.dewey_call_no ||
        template.dewey_call_number ||
        '005.133 ULM'
      ).trim();

      const newCopy: Book = {
        ...template,
        ...params.baseBook,
        id: `book-${cursorAcc}-${Date.now()}-${i}`,
        accession_no: accStr,
        barcode: barcodeStr,
        book_name: cleanTitle,
        title: cleanTitle,
        author: cleanAuthor,
        discipline: cleanCategory,
        category: cleanCategory,
        language: params.baseBook.language || template.language || 'English',
        isbn: cleanIsbn,
        edition: (params.baseBook.edition || template.edition || '1st Edition').trim(),
        publication_year:
          Number(params.baseBook.publication_year || template.publication_year) ||
          new Date().getFullYear(),
        publisher: cleanPublisher,
        place: (params.baseBook.place || params.baseBook.place_of_pub || template.place || 'Lakki Marwat').trim(),
        place_of_pub: (params.baseBook.place_of_pub || params.baseBook.place || template.place_of_pub || 'Lakki Marwat').trim(),
        pages: Number(params.baseBook.pages ?? template.pages ?? 320),
        total_pages: Number(params.baseBook.total_pages ?? params.baseBook.pages ?? template.pages ?? 320),
        binding: params.baseBook.binding || template.binding || 'HB',
        price: Number(params.baseBook.price ?? params.baseBook.price_pkr ?? template.price ?? 850),
        price_pkr: Number(params.baseBook.price_pkr ?? params.baseBook.price ?? template.price_pkr ?? 850),
        dewey_call_number: cleanDewey,
        dewey_call_no: cleanDewey,
        title_sort: computeSortKey(cleanTitle),
        author_sort: computeSortKey(cleanAuthor),
        search_text: computeSearchText({
          book_name: cleanTitle,
          author: cleanAuthor,
          title_roman: params.baseBook.title_roman || template.title_roman,
          author_roman: params.baseBook.author_roman || template.author_roman,
          publisher: cleanPublisher,
          category: cleanCategory,
          barcode: barcodeStr,
          isbn: cleanIsbn,
          dewey_call_number: cleanDewey,
        }),
        _searchKey: computeBookSearchKey({
          book_name: cleanTitle,
          author: cleanAuthor,
          barcode: barcodeStr,
          accession_no: accStr,
          isbn: cleanIsbn,
          category: cleanCategory,
          publisher: cleanPublisher,
          dewey_call_number: cleanDewey,
          language: params.baseBook.language || template.language || 'English',
          almari_code: resolvedAlmari ? resolvedAlmari.code : '',
        }),
        total_copies: 1,
        available_copies: 1,
        total_quantity: 1,
        available_quantity: 1,
        copies: 1,
        quantity: 1,
        status: 'AVAILABLE',
        almari_id: resolvedAlmari ? resolvedAlmari.id : '',
        almari_code: resolvedAlmari ? resolvedAlmari.code : '',
        cupboard: resolvedAlmari ? resolvedAlmari.code : '',
        shelf_no: resolvedShelfNo,
        shelf:
          resolvedAlmari && resolvedShelfNo > 0
            ? `${resolvedAlmari.code} · Shelf ${resolvedShelfNo}`
            : params.baseBook.shelf || template.shelf || 'Unassigned (No Almari)',
        row: resolvedShelfNo > 0 ? String(resolvedShelfNo) : '',
        section: params.baseBook.section || template.section || 'Main Stacks',
        source_remarks: params.baseBook.source_remarks || template.source_remarks || 'University Purchase',
        book_image_path: params.baseBook.book_image_path ?? template.book_image_path ?? '',
        description: params.baseBook.description ?? template.description ?? '',
        date_added: params.baseBook.date_added || template.date_added || todayDate,
        created_at: nowIso,
        updated_at: nowIso,
        is_active: true,
        group_id: sharedGroupId,
        copy_number: copyIndex,
        copy_total_in_batch: totalCopiesAfterAdd,
      };

      newCopies.push(newCopy);
      cursorAcc++;
    }

    // Update sibling metadata (and sync updated bibliographic fields across all siblings)
    const siblingIds = new Set(existingSiblings.map((s) => s.id));
    let siblingRunIdx = 1;
    const updatedExisting = currentBooks.map((b) => {
      if (siblingIds.has(b.id)) {
        const assignedCopyNo = b.copy_number || siblingRunIdx++;
        return {
          ...b,
          book_name: newCopies[0]?.book_name || b.book_name,
          title: newCopies[0]?.title || b.title,
          author: newCopies[0]?.author || b.author,
          discipline: newCopies[0]?.discipline || b.discipline,
          category: newCopies[0]?.category || b.category,
          language: newCopies[0]?.language || b.language,
          isbn: newCopies[0]?.isbn || b.isbn,
          group_id: sharedGroupId,
          copy_number: assignedCopyNo,
          copy_total_in_batch: totalCopiesAfterAdd,
        };
      }
      return b;
    });

    const rawCatalog = [...newCopies, ...updatedExisting];
    const updatedCatalog = reconcileBooksWithLoans(rawCatalog, LibraryStorage.getTransactions());

    // Persist to all storage engines & Almari Master Placements
    this.persistCatalogAndPlacements(updatedCatalog, newCopies, cursorAcc - 1);

    const firstAcc = parseInt(newCopies[0].accession_no || '1', 10);
    const lastAcc = parseInt(newCopies[newCopies.length - 1].accession_no || '1', 10);

    return {
      newCopies,
      updatedCatalog,
      firstAccession: firstAcc,
      lastAccession: lastAcc,
      nextAvailableAccession: cursorAcc,
      firstBarcode: newCopies[0].barcode,
      lastBarcode: newCopies[newCopies.length - 1].barcode,
      existingSiblingsCount: existingCopyCount,
      totalCopiesAfterAdd,
    };
  }

  public static persistCatalogAndPlacements(
    updatedCatalog: Book[],
    newlyAddedCopies: Book[],
    highestAllocatedAccession?: number
  ): void {
    try {
      const reconciledCatalog = reconcileBooksWithLoans(updatedCatalog, LibraryStorage.getTransactions());
      if (highestAllocatedAccession && highestAllocatedAccession > 0) {
        try {
          localStorage.setItem('ulm_highest_serial_number_v1', String(highestAllocatedAccession));
        } catch {}
      }
      LibraryStorage.saveBooks(reconciledCatalog);
    } catch (e) {
      console.warn('[AccessionSeriesEngine] LocalStorage book sync note:', e);
    }

    const copiesWithPlacements = newlyAddedCopies.filter(
      (copy) => copy.almari_id && copy.almari_code && Number(copy.shelf_no) >= 1
    );
    if (copiesWithPlacements.length > 0) {
      try {
        const rawPlacements = localStorage.getItem(MASTER_PLACEMENTS_KEY);
        const placements = rawPlacements ? JSON.parse(rawPlacements) : {};

        for (const copy of copiesWithPlacements) {
          const entry = {
            almari_id: copy.almari_id,
            almari_code: copy.almari_code,
            shelf_no: Number(copy.shelf_no),
          };
          if (copy.id) placements[copy.id] = entry;
          if (copy.barcode) placements[copy.barcode] = entry;
        }

        localStorage.setItem(MASTER_PLACEMENTS_KEY, JSON.stringify(placements));
      } catch (e) {
        console.warn('[AccessionSeriesEngine] Placement sync note:', e);
      }
    }

    if (newlyAddedCopies.length <= 25) {
      for (const copy of newlyAddedCopies) {
        StorageEngine.upsertBook({
          accession: copy.barcode || copy.accession_no || copy.id,
          title: copy.book_name,
          author: copy.author,
          isbn: copy.isbn || '',
          category: copy.category || 'General',
          almariId: copy.almari_id || '',
          shelfId: String(copy.shelf_no || 0),
          status: 'AVAILABLE',
          updatedAt: new Date().toISOString(),
        }).catch(() => {});

        if (typeof window !== 'undefined' && window.ulmLibraryApi?.saveBook) {
          void window.ulmLibraryApi.saveBook(
            {
              id: copy.id,
              accession_number: String(copy.accession_no || ''),
              accessionNumber: String(copy.accession_no || ''),
              barcode: copy.barcode,
              title: copy.book_name,
              author: copy.author,
              publisher: copy.publisher,
              place: copy.place || 'Lakki Marwat',
              publication_year: String(copy.publication_year || ''),
              publicationYear: String(copy.publication_year || ''),
              edition: copy.edition,
              pages: String(copy.pages || '320'),
              binding: copy.binding || 'HB',
              price_rs: Number(copy.price || 0),
              priceRs: Number(copy.price || 0),
              price: Number(copy.price || 0),
              source_remarks: copy.source_remarks || 'University Purchase',
              sourceRemarks: copy.source_remarks || 'University Purchase',
              call_number: copy.dewey_call_number,
              callNumber: copy.dewey_call_number,
              category: copy.category,
              language: copy.language,
              isbn: copy.isbn,
              almari_id: copy.almari_id || null,
              almariId: copy.almari_id || null,
              shelf_id: copy.shelf_no ? String(copy.shelf_no) : null,
              shelfId: copy.shelf_no ? String(copy.shelf_no) : null,
              shelf_label: copy.shelf,
              shelfLabel: copy.shelf,
              status: 'AVAILABLE',
              cover_image_path: copy.book_image_path,
              coverImagePath: copy.book_image_path,
              remarks: copy.description,
              date_of_entry: copy.date_added,
              dateOfEntry: copy.date_added,
              is_active: 1,
              isActive: true,
            },
            'upsert'
          );
        }
      }
    } else if (typeof window !== 'undefined' && window.ulmLibraryApi?.importBooksChunked) {
      const records = newlyAddedCopies.map((copy) => ({
        id: copy.id,
        accession_number: String(copy.accession_no || ''),
        accessionNumber: String(copy.accession_no || ''),
        barcode: copy.barcode,
        title: copy.book_name,
        author: copy.author,
        publisher: copy.publisher,
        place: copy.place || 'Lakki Marwat',
        publication_year: String(copy.publication_year || ''),
        edition: copy.edition,
        pages: String(copy.pages || '320'),
        binding: copy.binding || 'HB',
        price_rs: Number(copy.price || 0),
        source_remarks: copy.source_remarks || 'University Purchase',
        call_number: copy.dewey_call_number,
        category: copy.category,
        language: copy.language,
        isbn: copy.isbn,
        almari_id: copy.almari_id || null,
        shelf_id: copy.shelf_no ? String(copy.shelf_no) : null,
        shelf_label: copy.shelf,
        status: 'AVAILABLE',
        cover_image_path: copy.book_image_path,
        remarks: copy.description,
        date_of_entry: copy.date_added,
        is_active: 1,
      }));
      void window.ulmLibraryApi.importBooksChunked(records as any, { onDuplicate: 'upsert', chunkSize: 250 });
    }
  }
}

/**
 * O(1) Async Chunked Book Import Engine (500 rows per chunk with main-thread yielding).
 * Eliminates O(N^2) sibling scans and per-row storage writes when importing 5,000 to 50,000+ books.
 */
export async function importBooksInChunks(
  currentBooks: Book[],
  rawRows: Array<Record<string, any>>,
  onProgress?: (processed: number, total: number) => void
): Promise<Book[]> {
  const CHUNK_SIZE = 500;
  const total = rawRows.length;
  if (total === 0) return currentBooks;

  const { usedAccessions, usedBarcodes, nextAccession } = AccessionSeriesEngine.getSeriesState(currentBooks);
  let cursorAcc = nextAccession;

  const allAlmaris = AlmariService.getAlmaris();
  const almariByIdOrCode = new Map<string, Almari>();
  for (const a of allAlmaris) {
    if (a.id) almariByIdOrCode.set(a.id.toLowerCase(), a);
    if (a.code) almariByIdOrCode.set(a.code.toLowerCase(), a);
  }

  // O(1) Sibling group lookup map
  const siblingGroupMap = new Map<string, { groupId: string; count: number; template: Partial<Book> }>();
  const getSiblingKey = (title: string, author: string, isbn: string) => {
    const cleanIsbn = isbn.replace(/[-\s]/g, '').toLowerCase();
    if (cleanIsbn.length >= 6) return `isbn:${cleanIsbn}`;
    return `ta:${title.toLowerCase()}|${author.toLowerCase()}`;
  };

  for (const b of currentBooks) {
    if (!b || b.is_active === false) continue;
    const key = getSiblingKey(
      String(b.book_name || b.title || '').trim(),
      String(b.author || '').trim(),
      String(b.isbn || '').trim()
    );
    const existing = siblingGroupMap.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      siblingGroupMap.set(key, {
        groupId: b.group_id || `grp-${b.id}`,
        count: 1,
        template: b,
      });
    }
  }

  const newlyCreatedCopies: Book[] = [];
  const nowIso = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const todayDate = new Date().toISOString().split('T')[0];

  for (let start = 0; start < total; start += CHUNK_SIZE) {
    const end = Math.min(start + CHUNK_SIZE, total);

    for (let idx = start; idx < end; idx++) {
      const row = rawRows[idx];
      const title = String(
        row.title || row.book_name || row['Book Title'] || row['Title'] || ''
      ).trim();
      if (!title) continue;

      const author = String(row.author || row['Author'] || 'ULM Library Collection').trim();
      const isbn = String(row.isbn || row['ISBN'] || '').trim();
      const category = String(
        row.category || row.discipline || row['Discipline'] || row['Category'] || 'General'
      ).trim();
      const language = String(row.language || row['Language'] || 'English').trim();
      const edition = String(row.edition || row['Edition'] || '1st Edition').trim();
      const pubYear =
        Number(row.year || row.publication_year || row['Year']) || new Date().getFullYear();
      const publisher = String(row.publisher || row['Publisher'] || 'ULM Press').trim();

      const copiesCount = Math.max(
        1,
        Math.min(
          500,
          parseInt(
            String(
              row.copies ||
                row.quantity ||
                row.total_copies ||
                row.total_quantity ||
                row['Copies'] ||
                row['Quantity'] ||
                '1'
            ),
            10
          ) || 1
        )
      );

      const sibKey = getSiblingKey(title, author, isbn);
      let sibEntry = siblingGroupMap.get(sibKey);
      if (!sibEntry) {
        sibEntry = {
          groupId: `grp-${Date.now()}-${idx}`,
          count: 0,
          template: {},
        };
        siblingGroupMap.set(sibKey, sibEntry);
      }

      const rawAlmKey = String(
        row.almari_id || row.almari_code || row.cupboard || row['Almari'] || ''
      )
        .trim()
        .toLowerCase();
      const resolvedAlmari = rawAlmKey ? almariByIdOrCode.get(rawAlmKey) || null : null;
      const resolvedShelfNo = resolvedAlmari
        ? Number(row.shelf_no || row['Shelf'] || 1) || 1
        : 0;

      const prefAcc = parseInt(
        String(row.accession_no || row.accession_number || row['Accession No'] || ''),
        10
      );

      for (let c = 0; c < copiesCount; c++) {
        let allocAcc =
          c === 0 && !isNaN(prefAcc) && prefAcc > 0 && !usedAccessions.has(prefAcc)
            ? prefAcc
            : cursorAcc;

        while (
          usedAccessions.has(allocAcc) ||
          usedBarcodes.has(AccessionSeriesEngine.formatBarcode(allocAcc))
        ) {
          allocAcc++;
        }
        if (allocAcc >= cursorAcc) {
          cursorAcc = allocAcc + 1;
        }

        const accStr = String(allocAcc);
        const barcodeStr = AccessionSeriesEngine.formatBarcode(allocAcc);
        usedAccessions.add(allocAcc);
        usedBarcodes.add(barcodeStr);

        sibEntry.count += 1;
        const copyNo = sibEntry.count;

        const deweyCall = String(row.dewey_call_number || row.call_number || '005.133 ULM');
        const almariCode = resolvedAlmari ? resolvedAlmari.code : '';
        const shelfLabel =
          resolvedAlmari && resolvedShelfNo > 0
            ? `${resolvedAlmari.code} · Shelf ${resolvedShelfNo}`
            : 'Unassigned (No Almari)';
        const searchKey = `${title} ${author} ${barcodeStr} ${accStr} ${isbn} ${category} ${publisher} ${deweyCall} ${language} ${almariCode} ${shelfLabel}`.toLowerCase();

        newlyCreatedCopies.push({
          id: `book-${allocAcc}-${Date.now()}-${idx}-${c}`,
          accession_no: accStr,
          barcode: barcodeStr,
          book_name: title,
          title,
          author,
          discipline: category,
          category,
          language,
          isbn,
          edition,
          publication_year: pubYear,
          publisher,
          place: 'Lakki Marwat',
          place_of_pub: 'Lakki Marwat',
          pages: Number(row.pages || 320) || 320,
          total_pages: Number(row.pages || 320) || 320,
          binding: String(row.binding || 'HB'),
          price: Number(row.price || 850) || 850,
          price_pkr: Number(row.price || 850) || 850,
          dewey_call_number: deweyCall,
          dewey_call_no: deweyCall,
          title_sort: computeSortKey(title),
          author_sort: computeSortKey(author),
          search_text: searchKey,
          _searchKey: searchKey,
          total_copies: 1,
          available_copies: 1,
          total_quantity: 1,
          available_quantity: 1,
          copies: 1,
          quantity: 1,
          status: 'AVAILABLE',
          almari_id: resolvedAlmari ? resolvedAlmari.id : '',
          almari_code: almariCode,
          cupboard: almariCode,
          shelf_no: resolvedShelfNo,
          shelf: shelfLabel,
          row: resolvedShelfNo > 0 ? String(resolvedShelfNo) : '',
          section: 'Main Stacks',
          source_remarks: String(row.source_remarks || 'Excel Import'),
          book_image_path: '',
          description: String(row.description || row.remarks || ''),
          date_added: todayDate,
          created_at: nowIso,
          updated_at: nowIso,
          is_active: true,
          group_id: sibEntry.groupId,
          copy_number: copyNo,
          copy_total_in_batch: copyNo,
        });
      }
    }

    onProgress?.(end, total);
    updateHeavyTaskProgress(
      end,
      total,
      `Indexed ${end.toLocaleString()} of ${total.toLocaleString()} rows in continuous series...`
    );
    await new Promise((r) => setTimeout(r, 0));
  }

  updateHeavyTaskProgress(
    total,
    total,
    `Saving ${(newlyCreatedCopies.length + currentBooks.length).toLocaleString()} books to async IndexedDB...`
  );
  await new Promise((r) => setTimeout(r, 0));

  const combined = [...newlyCreatedCopies, ...currentBooks];
  const reconciled = await LibraryStorage.saveBooksAsync(combined);

  // Sync Almari placements only for newly created copies that have placements
  const copiesWithPlacements = newlyCreatedCopies.filter(
    (c) => c.almari_id && c.almari_code && Number(c.shelf_no) >= 1
  );
  if (copiesWithPlacements.length > 0) {
    try {
      const rawPlacements = localStorage.getItem(MASTER_PLACEMENTS_KEY);
      const placements = rawPlacements ? JSON.parse(rawPlacements) : {};
      for (const copy of copiesWithPlacements) {
        const entry = {
          almari_id: copy.almari_id,
          almari_code: copy.almari_code,
          shelf_no: Number(copy.shelf_no),
        };
        if (copy.id) placements[copy.id] = entry;
        if (copy.barcode) placements[copy.barcode] = entry;
      }
      localStorage.setItem(MASTER_PLACEMENTS_KEY, JSON.stringify(placements));
    } catch (_) {}
  }

  return reconciled;
}

/**
 * PIPELINE C:
 * Bulk imports rows from Excel / CSV in strict Accession & Barcode series order.
 * Uses O(1) lookup maps and performs a SINGLE persistence write at the end.
 */
export function importRowsWithSequentialBarcodes(
  currentBooks: Book[],
  importedRows: Array<Record<string, any>>
): Book[] {
  if (!importedRows || importedRows.length === 0) return currentBooks;

  const { usedAccessions, usedBarcodes, nextAccession } = AccessionSeriesEngine.getSeriesState(currentBooks);
  let cursorAcc = nextAccession;
  const newlyCreatedCopies: Book[] = [];
  const nowIso = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const todayDate = new Date().toISOString().split('T')[0];

  for (let idx = 0; idx < importedRows.length; idx++) {
    const row = importedRows[idx];
    const title = String(
      row.title || row.book_name || row['Book Title'] || row['Title'] || ''
    ).trim();
    if (!title) continue;

    const author = String(row.author || row['Author'] || 'ULM Library Collection').trim();
    const category = String(
      row.category || row.discipline || row['Discipline'] || row['Category'] || 'General'
    ).trim();
    const language = String(row.language || row['Language'] || 'English').trim();
    const isbn = String(row.isbn || row['ISBN'] || '').trim();
    const edition = String(row.edition || row['Edition'] || '1st Edition').trim();
    const pubYear =
      Number(row.year || row.publication_year || row['Year']) || new Date().getFullYear();
    const publisher = String(row.publisher || row['Publisher'] || 'ULM Press').trim();

    const copiesCount = Math.max(
      1,
      Math.min(
        500,
        parseInt(
          String(
            row.copies ||
              row.quantity ||
              row.total_copies ||
              row.total_quantity ||
              row['Copies'] ||
              row['Quantity'] ||
              '1'
          ),
          10
        ) || 1
      )
    );

    const groupId = `grp-${Date.now()}-${idx}`;
    for (let c = 0; c < copiesCount; c++) {
      while (
        usedAccessions.has(cursorAcc) ||
        usedBarcodes.has(AccessionSeriesEngine.formatBarcode(cursorAcc))
      ) {
        cursorAcc++;
      }
      const accStr = String(cursorAcc);
      const barcodeStr = AccessionSeriesEngine.formatBarcode(cursorAcc);
      usedAccessions.add(cursorAcc);
      usedBarcodes.add(barcodeStr);

      newlyCreatedCopies.push({
        id: `book-${cursorAcc}-${Date.now()}-${idx}-${c}`,
        accession_no: accStr,
        barcode: barcodeStr,
        book_name: title,
        title,
        author,
        discipline: category,
        category,
        language,
        isbn,
        edition,
        publication_year: pubYear,
        publisher,
        place: 'Lakki Marwat',
        place_of_pub: 'Lakki Marwat',
        pages: 320,
        total_pages: 320,
        binding: 'HB',
        price: 850,
        price_pkr: 850,
        dewey_call_number: '005.133 ULM',
        dewey_call_no: '005.133 ULM',
        title_sort: computeSortKey(title),
        author_sort: computeSortKey(author),
        search_text: `${title} ${author} ${publisher} ${category} ${barcodeStr} ${isbn}`.toLowerCase(),
        total_copies: 1,
        available_copies: 1,
        total_quantity: 1,
        available_quantity: 1,
        copies: 1,
        quantity: 1,
        status: 'AVAILABLE',
        almari_id: String(row.almari_id || '').trim(),
        almari_code: String(row.almari_code || row.cupboard || row['Almari'] || '').trim(),
        cupboard: String(row.almari_code || row.cupboard || row['Almari'] || '').trim(),
        shelf_no: Number(row.shelf_no || row['Shelf'] || 0) || 0,
        shelf: 'Unassigned (No Almari)',
        row: '',
        section: 'Main Stacks',
        source_remarks: 'Excel Import',
        book_image_path: '',
        description: '',
        date_added: todayDate,
        created_at: nowIso,
        updated_at: nowIso,
        is_active: true,
        group_id: groupId,
        copy_number: c + 1,
        copy_total_in_batch: copiesCount,
      });
      cursorAcc++;
    }
  }

  const combined = [...newlyCreatedCopies, ...currentBooks];
  const reconciled = reconcileBooksWithLoans(combined, LibraryStorage.getTransactions());
  AccessionSeriesEngine.persistCatalogAndPlacements(reconciled, newlyCreatedCopies, cursorAcc - 1);
  return reconciled;
}

