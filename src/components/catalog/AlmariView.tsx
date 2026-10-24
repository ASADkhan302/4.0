import React, { useState, useMemo, useRef } from 'react';
import { 
  Building2, 
  Search, 
  Layers, 
  Clock, 
  BookOpen, 
  Printer, 
  ArrowRight, 
  ChevronRight, 
  X, 
  Sparkles, 
  Check, 
  Filter,
  MoveRight,
  ExternalLink,
  Info,
  HelpCircle,
  Plus,
  RotateCcw,
  ClipboardPaste,
  Edit3,
  Trash2
} from 'lucide-react';
import { Book, Almari, BookGroup, BookLocationHistory } from '../../types/library';
import { AlmariService } from '../../services/almariService';
import { LibraryStorage } from '../../services/storage';
import { SharedCountService } from '../../services/sharedCountService';
import { compareLanguageAware } from '../../utils/almariSortUtils';
import { AddEditAlmariModal } from '../modals/AddEditAlmariModal';
import { DeleteAlmariModal } from '../modals/DeleteAlmariModal';
import { BulkAssignModal } from '../modals/BulkAssignModal';

interface AlmariViewProps {
  books: Book[];
  onOpenBook: (book: Book) => void;
  onEditBook?: (book: Book) => void;
  onMoveBook?: (book: Book, newAlmariId: string, newShelfNo: number) => void;
  onOpenSettingsTab?: (tab: 'groups' | 'almaris') => void;
  onReloadAlmaris?: () => void;
  selectedCatalogBookIds?: Set<string>;
  onClearCatalogSelection?: () => void;
  onCatalogBooksUpdated?: (books: Book[], message: string, batchId?: string) => void;
  onFilterCatalogByShelf?: (almariCode: string, shelfNo?: number) => void;
}

export const AlmariView: React.FC<AlmariViewProps> = ({
  books,
  onOpenBook,
  onEditBook,
  onMoveBook,
  onOpenSettingsTab,
  onReloadAlmaris,
  selectedCatalogBookIds,
  onClearCatalogSelection,
  onCatalogBooksUpdated,
  onFilterCatalogByShelf,
}) => {
  const [almarisVersion, setAlmarisVersion] = useState(0);
  const almaris = useMemo(() => AlmariService.getAlmaris().filter(a => a.is_active), [almarisVersion]);
  const groups = useMemo(() => AlmariService.getGroups().filter(g => g.is_active), [almarisVersion]);
  const groupsMap = useMemo(() => new Map(groups.map(g => [g.id, g])), [groups]);
  const almarisMap = useMemo(() => new Map(almaris.map(a => [a.id, a])), [almaris]);

  // Selected Almari detail mode
  const [selectedAlmariId, setSelectedAlmariId] = useState<string | null>(null);
  const [activeGroupFilter, setActiveGroupFilter] = useState<string>('ALL');
  const [activeLangFilter, setActiveLangFilter] = useState<string>('ALL');
  const [onlyOnLoan, setOnlyOnLoan] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewByGroup, setViewByGroup] = useState<boolean>(false);

  // Selected spine / book detail panel
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [selectedShelfFilter, setSelectedShelfFilter] = useState<number | null>(null);
  const [isMovePanelOpen, setIsMovePanelOpen] = useState<boolean>(false);
  const [targetMoveAlmariId, setTargetMoveAlmariId] = useState<string>('');
  const [targetMoveShelfNo, setTargetMoveShelfNo] = useState<number>(1);
  const [moveToast, setMoveToast] = useState<string | null>(null);

  // Global "Find a book" finder state
  const [finderQuery, setFinderQuery] = useState<string>('');

  // Modals and bulk placement states
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [almariToEdit, setAlmariToEdit] = useState<Almari | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [almariToDelete, setAlmariToDelete] = useState<Almari | null>(null);
  const [isPasteBulkModalOpen, setIsPasteBulkModalOpen] = useState(false);
  const [pasteTargetAlmariId, setPasteTargetAlmariId] = useState<string>('');
  const [pasteTargetShelfNo, setPasteTargetShelfNo] = useState<number>(1);
  const [lastBatchId, setLastBatchId] = useState<string | null>(null);
  const [rangeLookupQuery, setRangeLookupQuery] = useState<string>('');
  const [undoToastTimeoutRef, setUndoToastTimeoutRef] = useState<NodeJS.Timeout | null>(null);

  const activeBooks = useMemo(() => books.filter(b => b.is_active), [books]);

  // Selected catalog books objects
  const selectedCatalogBooks = useMemo(() => {
    if (!selectedCatalogBookIds || selectedCatalogBookIds.size === 0) return [];
    return activeBooks.filter(b => selectedCatalogBookIds.has(b.id));
  }, [selectedCatalogBookIds, activeBooks]);

  // Range Lookup Resolver
  const rangeLookupResults = useMemo(() => {
    const q = rangeLookupQuery.trim().toUpperCase();
    if (!q) return null;

    let minNum: number | null = null;
    let maxNum: number | null = null;

    if (q.includes(' TO ')) {
      const [p1, p2] = q.split(' TO ');
      minNum = AlmariService.extractAccessionNumber(p1);
      maxNum = AlmariService.extractAccessionNumber(p2);
    } else {
      const single = AlmariService.extractAccessionNumber(q);
      if (single !== null) {
        minNum = single;
        maxNum = single;
      }
    }

    if (minNum === null) return null;
    const actualMin = Math.min(minNum, maxNum || minNum);
    const actualMax = Math.max(minNum, maxNum || minNum);

    const matches: Book[] = [];
    for (const b of activeBooks) {
      const num = AlmariService.extractAccessionNumber(b.barcode) ?? AlmariService.extractAccessionNumber(b.accession_no);
      if (num !== null && num >= actualMin && num <= actualMax) {
        matches.push(b);
      }
    }

    // Group matches by Almari and shelf
    const grouped = new Map<string, Book[]>();
    for (const b of matches) {
      const key = `${b.almari_id || 'unassigned'}:${b.shelf_no || 1}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(b);
    }

    return {
      minNum: actualMin,
      maxNum: actualMax,
      totalFound: matches.length,
      grouped,
    };
  }, [rangeLookupQuery, activeBooks]);

  const handleAlmariSaved = (alm: Almari, msg: string, batchId?: string, updatedBooks?: Book[]) => {
    setAlmarisVersion(v => v + 1);
    if (onReloadAlmaris) onReloadAlmaris();
    if (batchId) setLastBatchId(batchId);
    if (updatedBooks && onCatalogBooksUpdated) {
      onCatalogBooksUpdated(updatedBooks, msg, batchId);
    }
    setMoveToast(msg);
    setTimeout(() => setMoveToast(null), 4000);
  };

  const handlePasteComplete = (updatedBooks: Book[], msg: string, batchId?: string) => {
    setAlmarisVersion(v => v + 1);
    if (batchId) setLastBatchId(batchId);
    if (onCatalogBooksUpdated) onCatalogBooksUpdated(updatedBooks, msg, batchId);
    if (onClearCatalogSelection) onClearCatalogSelection();
    setMoveToast(msg);
    setTimeout(() => setMoveToast(null), 4000);
  };

  const handleConfirmDeleteAlmari = (almId: string, action: 'move' | 'unassign', targetAlmId?: string) => {
    setIsDeleteModalOpen(false);
    setAlmariToDelete(null);

    const res = AlmariService.softDeleteAlmari(almId, action, targetAlmId, books);
    if (res.success) {
      setAlmarisVersion(v => v + 1);
      setLastBatchId(res.batchId);
      if (selectedAlmariId === almId) {
        setSelectedAlmariId(null);
      }
      if (onCatalogBooksUpdated) {
        onCatalogBooksUpdated(res.updatedBooks, res.message, res.batchId);
      }
      if (onReloadAlmaris) onReloadAlmaris();

      // Show toast with [Undo] for 30 seconds
      setMoveToast(`${res.message}`);
      if (undoToastTimeoutRef) clearTimeout(undoToastTimeoutRef);
      const timer = setTimeout(() => {
        setMoveToast(null);
      }, 30000);
      setUndoToastTimeoutRef(timer);
    } else {
      setMoveToast(`Delete blocked: ${res.message}`);
      setTimeout(() => setMoveToast(null), 5000);
    }
  };

  const handleUndoBatch = () => {
    if (!lastBatchId) return;

    if (undoToastTimeoutRef) clearTimeout(undoToastTimeoutRef);

    // Check if this batch was an almari deletion
    const isAlmariDel = lastBatchId.startsWith('alm-del-');
    if (isAlmariDel) {
      const res = AlmariService.undoAlmariDeletion(lastBatchId, books);
      if (res.success) {
        setLastBatchId(null);
        setAlmarisVersion(v => v + 1);
        if (onCatalogBooksUpdated) onCatalogBooksUpdated(res.updatedBooks, res.message);
        if (onReloadAlmaris) onReloadAlmaris();
        setMoveToast(res.message);
        setTimeout(() => setMoveToast(null), 4000);
      }
    } else {
      const res = AlmariService.undoLocationBatch(lastBatchId, books);
      LibraryStorage.saveBooks(res.updatedBooks);
      setLastBatchId(null);
      setAlmarisVersion(v => v + 1);
      if (onCatalogBooksUpdated) onCatalogBooksUpdated(res.updatedBooks, res.message);
      if (onReloadAlmaris) onReloadAlmaris();
      setMoveToast(res.message);
      setTimeout(() => setMoveToast(null), 4000);
    }
  };

  // Compute shared counts per Almari
  const almariStats = useMemo(() => {
    const stats: Record<string, { totalCopies: number; totalTitles: number; inAlmari: number; onLoan: number }> = {};
    almaris.forEach(a => {
      stats[a.id] = { totalCopies: 0, totalTitles: 0, inAlmari: 0, onLoan: 0 };
    });

    let unassignedCopies = 0;
    let unassignedTitles = 0;
    let unassignedInAlmari = 0;
    let unassignedOnLoan = 0;

    activeBooks.forEach(b => {
      const copies = b.total_quantity || 1;
      const avail = b.available_quantity !== undefined ? b.available_quantity : copies;
      const loaned = Math.max(0, copies - avail);

      if (b.almari_id && stats[b.almari_id]) {
        const s = stats[b.almari_id];
        s.totalTitles += 1;
        s.totalCopies += copies;
        s.inAlmari += avail;
        s.onLoan += loaned;
      } else {
        unassignedTitles += 1;
        unassignedCopies += copies;
        unassignedInAlmari += avail;
        unassignedOnLoan += loaned;
      }
    });

    return {
      perAlmari: stats,
      unassigned: {
        totalCopies: unassignedCopies,
        totalTitles: unassignedTitles,
        inAlmari: unassignedInAlmari,
        onLoan: unassignedOnLoan,
      },
    };
  }, [activeBooks, almaris]);

  // Filtered almaris for overview
  const filteredAlmaris = useMemo(() => {
    return almaris.filter(alm => {
      // Group filter
      if (activeGroupFilter !== 'ALL') {
        const almGroups = AlmariService.getGroupsForAlmari(alm.id);
        if (!almGroups.some(g => g.id === activeGroupFilter)) return false;
      }

      const st = almariStats.perAlmari[alm.id];
      // Only on loan filter
      if (onlyOnLoan && (!st || st.onLoan === 0)) return false;

      // Language filter
      if (activeLangFilter !== 'ALL') {
        const booksInAlm = activeBooks.filter(b => b.almari_id === alm.id);
        const hasLang = booksInAlm.some(b => (b.language || '').toLowerCase() === activeLangFilter.toLowerCase());
        if (!hasLang) return false;
      }

      // Search box filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesCode = alm.code.toLowerCase().includes(q);
        const matchesEn = alm.name_en.toLowerCase().includes(q);
        const matchesUr = alm.name_ur.includes(q);
        if (!matchesCode && !matchesEn && !matchesUr) return false;
      }

      return true;
    });
  }, [almaris, activeGroupFilter, onlyOnLoan, activeLangFilter, searchQuery, almariStats, activeBooks]);

  // Selected Almari object
  const currentAlmari = useMemo(() => {
    if (!selectedAlmariId) return null;
    return almaris.find(a => a.id === selectedAlmariId) || null;
  }, [selectedAlmariId, almaris]);

  // Books in selected Almari
  const booksInCurrentAlmari = useMemo(() => {
    if (!selectedAlmariId) return [];
    return activeBooks.filter(b => b.almari_id === selectedAlmariId);
  }, [selectedAlmariId, activeBooks]);

  // Group books by shelf for cupboard visualization
  const shelfBooksMap = useMemo(() => {
    if (!currentAlmari) return new Map<number, Book[]>();
    const map = new Map<number, Book[]>();
    for (let s = 1; s <= currentAlmari.shelf_count; s++) {
      map.set(s, []);
    }

    booksInCurrentAlmari.forEach(b => {
      const s = Math.min(Math.max(1, b.shelf_no || 1), currentAlmari.shelf_count);
      const list = map.get(s) || [];
      list.push(b);
      map.set(s, list);
    });

    // Sort books on each shelf by group order, then call number / author language-aware
    for (let s = 1; s <= currentAlmari.shelf_count; s++) {
      const list = map.get(s) || [];
      list.sort((a, b) => {
        const grpOrdA = a.group_id ? groupsMap.get(a.group_id)?.sort_order || 999 : 999;
        const grpOrdB = b.group_id ? groupsMap.get(b.group_id)?.sort_order || 999 : 999;
        if (grpOrdA !== grpOrdB) return grpOrdA - grpOrdB;

        return compareLanguageAware(a.book_name, b.book_name, a.language);
      });
      map.set(s, list);
    }

    return map;
  }, [currentAlmari, booksInCurrentAlmari, groupsMap]);

  // Selected book object for details sidebar
  const selectedBook = useMemo(() => {
    if (!selectedBookId) return null;
    return activeBooks.find(b => b.id === selectedBookId) || null;
  }, [selectedBookId, activeBooks]);

  // Movement history of selected book
  const selectedBookHistory = useMemo(() => {
    if (!selectedBookId) return [];
    return AlmariService.getHistoryForBook(selectedBookId);
  }, [selectedBookId]);

  // Global Finder Result
  const finderResult = useMemo(() => {
    const q = finderQuery.trim().toLowerCase();
    if (!q) return null;
    const found = activeBooks.find(b => {
      return (
        b.book_name.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.barcode.toLowerCase() === q ||
        (b.isbn && b.isbn.replace(/[-\s]/g, '').includes(q.replace(/[-\s]/g, ''))) ||
        (b.dewey_call_number && b.dewey_call_number.toLowerCase().includes(q)) ||
        (b.accession_no && b.accession_no.toLowerCase() === q)
      );
    });

    if (!found) return { found: null, message: 'No book found matching search criteria' };

    if (!found.almari_id) {
      return { found, message: `Found "${found.book_name}": Currently has No Almari assigned.` };
    }

    const alm = almarisMap.get(found.almari_id);
    const code = alm?.code || 'A-??';
    const shelf = found.shelf_no || 1;
    // Calculate position on shelf
    const shelfList = (alm && shelfBooksMap.get(shelf)) || [];
    const pos = shelfList.findIndex(b => b.id === found.id);
    const posStr = pos >= 0 ? `, position ${pos + 1}` : '';

    return {
      found,
      almariId: found.almari_id,
      message: `Found: ${code}, Shelf ${shelf}${posStr}`,
    };
  }, [finderQuery, activeBooks, almarisMap, shelfBooksMap]);

  // Execute book move
  const handleExecuteMove = () => {
    if (!selectedBook || !targetMoveAlmariId) return;
    const alm = almaris.find(a => a.id === targetMoveAlmariId);
    const fromStr = selectedBook.almari_id
      ? `${almarisMap.get(selectedBook.almari_id)?.code || 'Almari'}, Shelf ${selectedBook.shelf_no || 1}`
      : 'No almari';
    const toStr = `${alm?.code}, Shelf ${targetMoveShelfNo}`;

    AlmariService.recordMove({
      book_id: selectedBook.id,
      from: fromStr,
      to: toStr,
      reason: 'Manual repositioning in Almari view',
    });

    if (onMoveBook) {
      onMoveBook(selectedBook, targetMoveAlmariId, targetMoveShelfNo);
    } else {
      LibraryStorage.updateBook(selectedBook.id, {
        almari_id: targetMoveAlmariId,
        shelf_no: targetMoveShelfNo,
        shelf: `${alm?.code}-Shelf-${targetMoveShelfNo}`,
      });
    }

    setMoveToast(`Moved "${selectedBook.book_name}" to ${alm?.code}, Shelf ${targetMoveShelfNo}`);
    setIsMovePanelOpen(false);
    setTimeout(() => setMoveToast(null), 3500);
  };

  // Print Almari Walking List
  const handlePrintAlmariList = () => {
    if (!currentAlmari) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const rows = booksInCurrentAlmari
      .sort((a, b) => {
        if ((a.shelf_no || 1) !== (b.shelf_no || 1)) {
          return (a.shelf_no || 1) - (b.shelf_no || 1);
        }
        return compareLanguageAware(a.book_name, b.book_name, a.language);
      })
      .map(
        (b, i) => `
        <tr>
          <td style="padding: 6px; border-bottom: 1px solid #ccc; text-align: center;">${i + 1}</td>
          <td style="padding: 6px; border-bottom: 1px solid #ccc; font-family: monospace;">Shelf ${b.shelf_no || 1}</td>
          <td style="padding: 6px; border-bottom: 1px solid #ccc; font-family: monospace;">${b.barcode}</td>
          <td style="padding: 6px; border-bottom: 1px solid #ccc; font-family: monospace;">${b.dewey_call_number || '-'}</td>
          <td style="padding: 6px; border-bottom: 1px solid #ccc; font-weight: bold;" dir="auto">${b.book_name}</td>
          <td style="padding: 6px; border-bottom: 1px solid #ccc;" dir="auto">${b.author}</td>
          <td style="padding: 6px; border-bottom: 1px solid #ccc;">${groupsMap.get(b.group_id || '')?.name_en || '-'}</td>
          <td style="padding: 6px; border-bottom: 1px solid #ccc; text-align: center;">${
            b.available_quantity > 0 ? 'On Shelf' : 'On Loan'
          }</td>
        </tr>
      `
      )
      .join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Almari Inventory: ${currentAlmari.code} - ${currentAlmari.name_en}</title>
          <style>
            body { font-family: "Segoe UI", Tahoma, Arial, sans-serif; margin: 24px; color: #111; background: #fff; }
            h1 { font-size: 18px; margin: 0 0 4px 0; }
            p { font-size: 12px; color: #555; margin: 0 0 16px 0; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th { text-align: left; padding: 6px; border-bottom: 2px solid #222; font-size: 10px; text-transform: uppercase; }
            @media print {
              body { margin: 10mm; }
            }
          </style>
        </head>
        <body>
          <h1>Almari Inventory Audit: ${currentAlmari.code} — ${currentAlmari.name_en}</h1>
          <p dir="auto">${currentAlmari.name_ur} · Total Titles: ${booksInCurrentAlmari.length} · Walking Order</p>
          <table>
            <thead>
              <tr>
                <th style="width: 30px;">#</th>
                <th style="width: 70px;">Shelf</th>
                <th style="width: 100px;">Barcode</th>
                <th style="width: 100px;">Call No.</th>
                <th>Book Title</th>
                <th>Author</th>
                <th>Group</th>
                <th style="width: 70px; text-align: center;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
          <script>window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="w-full h-auto min-h-0 flex flex-col gap-5 pb-12 overflow-visible bg-[var(--background)] text-[var(--text-body)]">
      {/* Toast Notification */}
      {moveToast && (
        <div className="m-4 p-3.5 bg-[#1A1A1A] border border-[var(--gold)]/40 rounded-[12px] text-[var(--gold-text)] text-[13px] flex items-center gap-2 shadow-lg animate-in fade-in">
          <Sparkles className="w-4 h-4 text-[var(--gold)] shrink-0" />
          <span>{moveToast}</span>
        </div>
      )}

      {/* TOP CONTROLS & FIND A BOOK BAR */}
      <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-[var(--border-subtle)] bg-white/90 dark:bg-[#1A1A1A] shrink-0 space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Breadcrumb / Title */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-[10px] bg-[var(--gold)]/15 border border-[var(--gold)]/30 flex items-center justify-center text-[var(--gold-text)] shrink-0">
              <Building2 className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                {selectedAlmariId ? (
                  <>
                    <button
                      onClick={() => {
                        setSelectedAlmariId(null);
                        setSelectedBookId(null);
                      }}
                      className="text-[13px] text-slate-600 dark:text-[var(--text-muted)] hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                    >
                      Almaris Overview
                    </button>
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                    <span className="text-[15px] font-bold text-slate-900 dark:text-white font-mono">
                      {currentAlmari?.code}: {currentAlmari?.name_en}
                    </span>
                  </>
                ) : (
                  <h2 className="text-[16px] font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Physical Cupboards & Shelves (الماریاں و تختے)</span>
                  </h2>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-[var(--text-muted)]">
                {selectedAlmariId
                  ? 'Visual cupboard shelving stack with language-aware book spine navigation'
                  : 'Overview cards for all physical cupboards with capacity thresholds and group bindings'}
              </p>
            </div>
          </div>

          {/* Top Actions: Add Almari, Auto-Arrange, Undo, Range Lookup & Global Book Finder */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Primary Almari Actions: Manual Cupboard Creation */}
            <button
              type="button"
              onClick={() => {
                setAlmariToEdit(null);
                setIsAddEditOpen(true);
              }}
              className="px-3.5 h-9 rounded-[8px] bg-[#BC881B] hover:bg-[#D4A02A] text-[#1A1A1A] text-[12px] font-bold flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer shadow-sm hover:shadow-md active:scale-95"
              title="Add a new manual Almari or cupboard (نیا الماری شامل کریں)"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add Almari</span>
            </button>

            {lastBatchId && (
              <button
                type="button"
                onClick={handleUndoBatch}
                className="px-3 h-9 rounded-[8px] bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 text-[12px] font-semibold flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                title="Undo the last bulk or auto-arrange movement batch"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Undo</span>
              </button>
            )}

            {/* Range Lookup input */}
            <div className="relative flex-1 md:w-64">
              <input
                type="text"
                value={rangeLookupQuery}
                onChange={e => setRangeLookupQuery(e.target.value)}
                placeholder="Range lookup (e.g. ULM-00001 to ULM-00020)..."
                className="w-full h-9 px-3 bg-white/90 dark:bg-[#131B2E] border border-slate-300 dark:border-[#BC881B]/40 rounded-[8px] text-[12px] font-mono text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#E0B450]"
              />
              {rangeLookupQuery && (
                <button
                  onClick={() => setRangeLookupQuery('')}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick Global Book Finder */}
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={finderQuery}
                onChange={e => setFinderQuery(e.target.value)}
                placeholder="Find a book (Title, Author, Barcode)..."
                className="w-full h-9 pl-10 pr-8 bg-white/90 dark:bg-[#131B2E] border border-slate-300 dark:border-white/10 rounded-[8px] text-[12px] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[var(--gold)]"
              />
              {finderQuery && (
                <button
                  onClick={() => setFinderQuery('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {selectedAlmariId && (
              <button
                type="button"
                onClick={handlePrintAlmariList}
                className="px-3 h-9 rounded-[8px] bg-[#2B2730] hover:bg-[#38333F] text-white border border-[var(--border-subtle)] text-[12px] font-semibold flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Print Walking List</span>
              </button>
            )}
          </div>
        </div>

        {/* Catalog Selection Active Banner */}
        {selectedCatalogBookIds && selectedCatalogBookIds.size > 0 && (
          <div className="p-3 rounded-xl bg-gradient-to-r from-[#541A72]/40 to-[#2A1338]/60 border border-[#BC881B]/50 flex items-center justify-between text-xs animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-full bg-[#BC881B]/20 text-[#E0B450] flex items-center justify-center font-bold">
                {selectedCatalogBookIds.size}
              </span>
              <span className="text-white font-medium">
                {selectedCatalogBookIds.size} books currently selected in Catalog. Click <span className="text-[#E0B450] font-bold">[Paste]</span> on any Almari or shelf below to position them.
              </span>
            </div>
            {onClearCatalogSelection && (
              <button
                onClick={onClearCatalogSelection}
                className="text-[#B3AABD] hover:text-white underline font-semibold cursor-pointer"
              >
                Clear Selection
              </button>
            )}
          </div>
        )}

        {/* Range Lookup Result Panel */}
        {rangeLookupResults && (
          <div className="p-3.5 rounded-xl bg-[#221F26] border border-[#BC881B]/50 text-xs space-y-2.5 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white flex items-center gap-2">
                <span className="font-mono text-[#E0B450]">
                  Range ULM-{String(rangeLookupResults.minNum).padStart(5, '0')} to ULM-{String(rangeLookupResults.maxNum).padStart(5, '0')}
                </span>
                <span>— {rangeLookupResults.totalFound} book(s) found</span>
              </span>
              <button
                onClick={() => setRangeLookupQuery('')}
                className="text-[#B3AABD] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {Array.from(rangeLookupResults.grouped.entries()).map(([key, bList]) => {
                const [almId, shelfStr] = key.split(':');
                const shelfNo = parseInt(shelfStr, 10);
                const alm = almarisMap.get(almId);
                const range = AlmariService.computeShelfRange(bList);

                return (
                  <div key={key} className="bg-[#1A1A1A] p-2.5 rounded-lg border border-white/[0.06] flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-white">
                        {alm ? `${alm.name_en} (${alm.code})` : 'Unassigned Stacks'}
                      </div>
                      <div className="text-[#B3AABD] text-[11px]">Shelf {shelfNo} · {bList.length} book(s)</div>
                      <div className="font-mono text-[#E0B450] text-[10px]">{range.rangeStr}</div>
                    </div>
                    {alm && (
                      <button
                        onClick={() => setSelectedAlmariId(alm.id)}
                        className="px-2 py-1 bg-[#BC881B]/20 hover:bg-[#BC881B]/40 text-[#E0B450] rounded text-[11px] font-bold"
                      >
                        Open
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Global Finder Result Bar */}
        {finderResult && (
          <div className="p-2.5 rounded-[10px] bg-[#221F26] border border-[var(--gold)]/40 flex items-center justify-between gap-3 text-[12px] animate-in fade-in">
            <div className="flex items-center gap-2 truncate">
              <Sparkles className="w-4 h-4 text-[var(--gold)] shrink-0" />
              <span className="font-semibold text-white font-mono">{finderResult.message}</span>
            </div>
            {finderResult.almariId && (
              <button
                onClick={() => {
                  setSelectedAlmariId(finderResult.almariId!);
                  if (finderResult.found) {
                    setSelectedBookId(finderResult.found.id);
                  }
                }}
                className="px-3 py-1 bg-[var(--gold)] hover:bg-[var(--gold-hover)] text-[#1A1A1A] font-semibold text-[11px] rounded-[6px] shrink-0 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span>Open this Almari</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        {/* Filters Toolbar (only in Overview mode) */}
        {!selectedAlmariId && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2 text-[12px]">
              {/* Group Filter */}
              <div className="flex items-center gap-1.5 bg-[#221F26] border border-[var(--border-subtle)] rounded-[8px] px-2 py-1">
                <Filter className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                <select
                  value={activeGroupFilter}
                  onChange={e => setActiveGroupFilter(e.target.value)}
                  className="bg-transparent text-white text-[12px] focus:outline-none"
                >
                  <option value="ALL">All Groups</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.name_en}
                    </option>
                  ))}
                </select>
              </div>

              {/* Language Filter */}
              <div className="flex items-center gap-1.5 bg-[#221F26] border border-[var(--border-subtle)] rounded-[8px] px-2 py-1">
                <select
                  value={activeLangFilter}
                  onChange={e => setActiveLangFilter(e.target.value)}
                  className="bg-transparent text-white text-[12px] focus:outline-none"
                >
                  <option value="ALL">All Languages</option>
                  <option value="Urdu">Urdu</option>
                  <option value="Pashto">Pashto</option>
                  <option value="English">English</option>
                </select>
              </div>

              {/* On Loan toggle */}
              <label className="flex items-center gap-2 px-2.5 py-1 rounded-[8px] bg-[#221F26] border border-[var(--border-subtle)] cursor-pointer text-white">
                <input
                  type="checkbox"
                  checked={onlyOnLoan}
                  onChange={e => setOnlyOnLoan(e.target.checked)}
                  className="accent-[var(--gold)] rounded"
                />
                <span>Has books on loan</span>
              </label>

              {/* By Group / By Almari Toggle */}
              <div className="flex items-center border border-[var(--border-subtle)] rounded-[8px] overflow-hidden bg-[#221F26]">
                <button
                  type="button"
                  onClick={() => setViewByGroup(false)}
                  className={`px-3 py-1 text-[12px] font-semibold transition-colors ${
                    !viewByGroup ? 'bg-[var(--gold)]/20 text-[var(--gold-text)]' : 'text-[var(--text-muted)]'
                  }`}
                >
                  By Almari
                </button>
                <button
                  type="button"
                  onClick={() => setViewByGroup(true)}
                  className={`px-3 py-1 text-[12px] font-semibold transition-colors ${
                    viewByGroup ? 'bg-[var(--gold)]/20 text-[var(--gold-text)]' : 'text-[var(--text-muted)]'
                  }`}
                >
                  By Group
                </button>
              </div>
            </div>

            {/* Quick Actions: Search almaris */}
            <div className="flex items-center gap-2">
              <div className="relative w-44 sm:w-60">
                <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search almaris..."
                  className="w-full h-8 pl-10 pr-3 bg-white/90 dark:bg-[#131B2E] border border-slate-300 dark:border-white/10 rounded-lg text-[12px] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[var(--gold)]"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MAIN VIEW CONTENT AREA */}
      <div className="w-full h-auto p-4 sm:p-6 space-y-6 overflow-visible">
        {/* ==================================================================== */}
        {/* 1. OVERVIEW MODE: CARD PER ALMARI OR BY GROUP                       */}
        {/* ==================================================================== */}
        {!selectedAlmariId && !viewByGroup && almaris.length === 0 && (
          <div className="max-w-2xl mx-auto p-8 rounded-[16px] bg-[#1A1A1A] border border-[var(--border-subtle)] shadow-[0_8px_30px_rgba(0,0,0,0.5)] text-center space-y-5">
            <div className="w-16 h-16 mx-auto rounded-[14px] bg-[#221F26] border border-[var(--gold)]/40 flex items-center justify-center text-[var(--gold-text)]">
              <Building2 className="w-8 h-8 stroke-[1.5]" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-white">Manage your almaris</h3>
              <p className="text-[13px] text-[var(--text-muted)] max-w-md mx-auto leading-relaxed">
                You don't have any cupboards (almaris) configured yet. Add cupboards manually to organize your library stacks.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setAlmariToEdit(null);
                  setIsAddEditOpen(true);
                }}
                className="btn-primary h-10 px-5 rounded-[10px] text-[13px] font-bold inline-flex items-center gap-2 cursor-pointer shadow-md"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Add Almari manually</span>
              </button>
              {onOpenSettingsTab && (
                <button
                  type="button"
                  onClick={() => onOpenSettingsTab('almaris')}
                  className="btn-secondary h-10 px-4 rounded-[10px] text-[13px] font-semibold inline-flex items-center gap-2 cursor-pointer"
                >
                  <Building2 className="w-4 h-4 text-[var(--gold)]" />
                  <span>Configure in Settings</span>
                </button>
              )}
            </div>
          </div>
        )}

        {!selectedAlmariId && !viewByGroup && almaris.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {/* "No almari" First Card */}
            <div className="p-5 rounded-[14px] bg-white/90 dark:bg-[#1A1A1A] border border-slate-200/80 dark:border-[var(--border-subtle)] flex flex-col justify-between shadow-sm relative overflow-hidden">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-[10px] bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                      <HelpCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-[15px]">No Almari (Unassigned)</h4>
                      <p className="text-[12px] text-slate-600 dark:text-[var(--text-muted)] font-urdu" dir="auto">
                        بغیر الماری کتب
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/30 font-bold">
                    {almariStats.unassigned.totalTitles} Titles
                  </span>
                </div>

                <div className="space-y-1 text-[13px]">
                  <div className="flex justify-between text-slate-800 dark:text-white">
                    <span>Total Copies:</span>
                    <span className="font-mono font-bold">{almariStats.unassigned.totalCopies}</span>
                  </div>
                  <div className="flex justify-between text-slate-500 dark:text-[var(--text-muted)] text-[12px]">
                    <span>In Library: {almariStats.unassigned.inAlmari}</span>
                    <span>On Loan: {almariStats.unassigned.onLoan}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200/80 dark:border-[var(--border-subtle)] mt-3">
                <div className="text-[11.5px] text-slate-500 dark:text-[#B3AABD] italic flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                  <span>Manual cupboard allocation</span>
                </div>
              </div>
            </div>

            {/* Almari Cards: Visual Bookcase Inspector */}
            {filteredAlmaris.map(alm => {
              const st = almariStats.perAlmari[alm.id] || { totalCopies: 0, totalTitles: 0, inAlmari: 0, onLoan: 0 };
              const almGroups = AlmariService.getGroupsForAlmari(alm.id);
              const almBooks = activeBooks.filter(b => b.almari_id === alm.id);
              const totalCap = AlmariService.getAlmariTotalCapacity(alm);
              const capPct = totalCap > 0 ? Math.round((st.totalCopies / totalCap) * 100) : 0;
              const freeCap = Math.max(0, totalCap - st.totalCopies);
              const range = AlmariService.computeShelfRange(almBooks, totalCap);

              const hallWing = alm.location || (alm.notes && alm.notes.includes('Wing') ? alm.notes : 'Main Hall');
              const categoryBadge = alm.category || almGroups[0]?.name_en || 'General Stacks';
              const healthStatus = st.totalCopies === 0 ? 'EMPTY' : capPct < 75 ? 'OPTIMAL' : capPct <= 90 ? 'NEAR FULL' : 'FULL';
              const healthBadgeColor = st.totalCopies === 0
                ? 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-500/20 dark:text-slate-300 dark:border-slate-500/35'
                : capPct < 75
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/35'
                : capPct <= 90
                ? 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-500/20 dark:text-[#E0B450] dark:border-amber-500/35'
                : 'bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-500/20 dark:text-rose-400 dark:border-rose-500/35';

              const shelfCount = Math.max(1, alm.shelf_count || 5);
              const shelves = AlmariService.getShelvesForAlmari(alm.id);

              return (
                <div
                  key={alm.id}
                  onClick={() => setSelectedAlmariId(alm.id)}
                  className="p-5 rounded-2xl bg-white/90 dark:bg-[#131B2E] border border-slate-200/80 dark:border-white/10 hover:border-[#BC881B] transition-all flex flex-col justify-between shadow-sm cursor-pointer group"
                >
                  <div className="space-y-3.5">
                    {/* Header: Drawing, Code, Title & Management Controls */}
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/10 border border-amber-500/30 dark:border-[#BC881B]/40 flex items-center justify-center text-amber-700 dark:text-[#E0B450] shrink-0 group-hover:scale-105 transition-transform">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-amber-700 dark:text-[#E0B450] text-[14px]">
                              {alm.code}
                            </span>
                            <span className="text-[14px] font-bold text-slate-900 dark:text-white truncate" title={alm.name_en}>
                              {alm.name_en}
                            </span>
                          </div>
                          <p className="text-[11.5px] text-slate-600 dark:text-slate-300 font-urdu truncate" dir="auto">
                            {alm.name_ur}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAlmariToEdit(alm);
                            setIsAddEditOpen(true);
                          }}
                          className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-800 dark:text-slate-200 hover:text-amber-800 dark:hover:text-[#E0B450] border border-slate-300 dark:border-white/10 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                          title={`Edit Almari ${alm.code}`}
                          aria-label={`Edit Almari ${alm.code}`}
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAlmariToDelete(alm);
                            setIsDeleteModalOpen(true);
                          }}
                          className="p-1 rounded-lg bg-slate-100 hover:bg-rose-100 dark:bg-white/10 dark:hover:bg-rose-950/40 text-slate-700 hover:text-rose-600 dark:text-slate-300 dark:hover:text-rose-400 border border-slate-300 dark:border-white/10 transition-colors"
                          title={`Delete Almari ${alm.code}`}
                          aria-label={`Delete Almari ${alm.code}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Meta Badges: Hall/Wing + Category + Capacity Health Status */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#29658E]/30 text-[#6FA8D2] border border-[#29658E]/40" title="Physical Wing Location">
                        {hallWing}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#541A72]/40 text-[#FFD147] border border-[#BC881B]/40" title="Stack Category">
                        {categoryBadge}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-bold uppercase tracking-wider border ${healthBadgeColor}`} title="Capacity Health">
                        {healthStatus}
                      </span>
                    </div>

                    {/* Continuous Accession Range Badge */}
                    <div className="flex items-center justify-between text-xs font-mono bg-white/10 px-3 py-1.5 rounded-xl border border-white/10">
                      <span className="text-[#E0B450] font-bold truncate max-w-[170px]" title={range.rangeStr}>
                        {range.count > 0 ? range.rangeStr : 'Empty'}
                      </span>
                      {range.gaps.length > 0 && (
                        <span 
                          className="text-rose-400 text-[11px] font-semibold"
                          title={`Missing accession numbers on shelf: ${range.gaps.slice(0, 8).join(', ')}${range.gaps.length > 8 ? '...' : ''}`}
                        >
                          ({range.gaps.length} gaps)
                        </span>
                      )}
                      <span className="text-slate-300 text-[11px]">{st.totalCopies} / {totalCap} Vol</span>
                    </div>

                    {/* Interactive Shelf Rack Bars (Shelf 1 .. Shelf N) with 12-Slot Book Spines */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] font-semibold">
                        <span>Shelf Rack Inspector ({shelfCount} Shelves)</span>
                        <span className="text-[10px] text-slate-500">Click shelf to filter</span>
                      </div>
                      
                      <div className="space-y-1 bg-[#151317] p-2 rounded-[10px] border border-white/[0.05]">
                        {Array.from({ length: shelfCount }, (_, idx) => {
                          const sNo = idx + 1;
                          const sBooks = almBooks.filter(b => (b.shelf_no || 1) === sNo);
                          const sCap = shelves.find(sh => sh.shelf_no === sNo)?.capacity || Math.max(1, Math.ceil(totalCap / shelfCount));
                          const sPct = Math.round((sBooks.length / sCap) * 100);
                          const filledSlots = Math.min(12, Math.ceil((sBooks.length / sCap) * 12));
                          const sStatusColor = sPct > 90 ? 'text-rose-400' : sPct >= 75 ? 'text-[#E0B450]' : 'text-emerald-400';

                          return (
                            <div
                              key={sNo}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onFilterCatalogByShelf) {
                                  onFilterCatalogByShelf(alm.code, sNo);
                                } else {
                                  setSelectedAlmariId(alm.id);
                                  setSelectedShelfFilter(sNo);
                                }
                              }}
                              className="flex items-center justify-between gap-2 px-2 py-1 rounded-[6px] hover:bg-white/[0.06] transition-colors cursor-pointer group/shelf"
                              title={`Click to filter catalog by ${alm.code} - Shelf ${sNo} (${sBooks.length}/${sCap} books)`}
                            >
                              <div className="flex items-center gap-1.5 min-w-[70px]">
                                <span className="text-[11px] font-semibold text-slate-300 group-hover/shelf:text-white">
                                  Shelf {sNo}
                                </span>
                              </div>

                              {/* 12-Slot Book-Spine Occupancy Segments */}
                              <div className="flex items-center gap-[2.5px] bg-black/50 px-1.5 py-0.5 rounded border border-white/[0.06]">
                                {Array.from({ length: 12 }, (_, segIdx) => {
                                  const isFilled = segIdx < filledSlots;
                                  return (
                                    <div
                                      key={segIdx}
                                      className={`w-1 h-3 rounded-[0.5px] transition-colors ${
                                        isFilled
                                          ? sPct > 90
                                            ? 'bg-rose-400'
                                            : sPct >= 75
                                            ? 'bg-[#E0B450]'
                                            : 'bg-emerald-400'
                                          : 'bg-white/[0.08]'
                                      }`}
                                    />
                                  );
                                })}
                              </div>

                              <div className="flex items-center gap-1 text-[11px] font-mono shrink-0">
                                <span className="text-slate-400">{sBooks.length}/{sCap}</span>
                                <span className={`font-bold ${sStatusColor}`}>
                                  {sPct}%
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Move Selected Books Action */}
                    {selectedCatalogBookIds && selectedCatalogBookIds.size > 0 ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPasteTargetAlmariId(alm.id);
                          setPasteTargetShelfNo(1);
                          setIsPasteBulkModalOpen(true);
                        }}
                        className="w-full py-2 bg-[#BC881B] hover:bg-[#D4A02A] text-slate-950 font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                      >
                        <ClipboardPaste className="w-3.5 h-3.5" />
                        <span>Move {selectedCatalogBookIds.size} Selected Books Here</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPasteTargetAlmariId(alm.id);
                          setPasteTargetShelfNo(1);
                          setIsPasteBulkModalOpen(true);
                        }}
                        className="w-full py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/[0.08] text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        title="Move books into this Almari"
                      >
                        <MoveRight className="w-3 h-3 text-[#BC881B]" />
                        <span>Move Books to this Almari</span>
                      </button>
                    )}
                  </div>

                  {/* Card Footer: Single Clean Glass Footer */}
                  <div className="pt-3 border-t border-white/15 mt-3 flex items-center justify-between text-[12px]">
                    <div className="text-slate-300 font-semibold flex items-center gap-1.5">
                      <span>{st.totalCopies} / {totalCap} Volumes</span>
                      <span className="text-slate-500">•</span>
                      <span className="text-emerald-400 font-bold">{st.inAlmari} Available</span>
                    </div>
                    <div className="flex items-center gap-1 text-[#E0B450] font-bold group-hover:translate-x-1 transition-transform">
                      <span>Inspect Shelves</span>
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Add New Almari Action Card in Grid */}
            <div
              onClick={() => {
                setAlmariToEdit(null);
                setIsAddEditOpen(true);
              }}
              className="p-5 rounded-[14px] bg-[#1A1A1A]/60 border-2 border-dashed border-[#BC881B]/40 hover:border-[#BC881B] hover:bg-[#221F26] transition-all flex flex-col items-center justify-center text-center shadow-[0_4px_16px_rgba(0,0,0,0.2)] cursor-pointer group min-h-[300px] space-y-3"
            >
              <div className="w-12 h-12 rounded-xl bg-[#BC881B]/15 border border-[#BC881B]/30 flex items-center justify-center text-[#E0B450] group-hover:scale-110 transition-transform">
                <Plus className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-white text-[15px] group-hover:text-[#E0B450] transition-colors">
                  Add New Almari / Cupboard
                </h4>
                <p className="text-[12px] text-[var(--text-muted)] font-urdu" dir="auto">
                  نیا الماری شامل کریں
                </p>
                <p className="text-[11.5px] text-[#B3AABD] max-w-[220px]">
                  Manually define code, English & Urdu titles, and shelf capacities
                </p>
              </div>
              <span className="px-3.5 py-1.5 rounded-lg bg-[#BC881B] group-hover:bg-[#D4A02A] text-[#1A1A1A] font-bold text-xs flex items-center gap-1.5 shadow-sm">
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Create Cupboard</span>
              </span>
            </div>
          </div>
        )}

        {/* Overview Toggle: By Group */}
        {!selectedAlmariId && viewByGroup && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {groups.map(grp => {
              const booksInGrp = activeBooks.filter(b => b.group_id === grp.id);
              const copies = booksInGrp.reduce((s, b) => s + (b.total_quantity || 1), 0);
              const almarisHolding = AlmariService.getAlmarisForGroup(grp.id);

              return (
                <div
                  key={grp.id}
                  className="p-5 rounded-[14px] bg-[#1A1A1A] border border-[var(--border-subtle)] shadow-[0_4px_16px_rgba(0,0,0,0.35)] space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-4 h-4 rounded-full border border-white/20 shrink-0"
                        style={{ backgroundColor: grp.color }}
                      />
                      <h4 className="font-bold text-white text-[15px]">{grp.name_en}</h4>
                    </div>
                    <span className="text-[12px] text-[var(--text-muted)] font-urdu" dir="auto">
                      {grp.name_ur}
                    </span>
                  </div>

                  <div className="p-3 bg-[#221F26] rounded-[10px] space-y-1 text-[12px]">
                    <div className="flex justify-between font-semibold text-white">
                      <span>Total Copies:</span>
                      <span className="font-mono">{copies}</span>
                    </div>
                    <div className="flex justify-between text-[var(--text-muted)]">
                      <span>Cataloged Titles:</span>
                      <span className="font-mono">{booksInGrp.length}</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] uppercase font-semibold text-[var(--text-muted)] block mb-1.5">
                      Holding Almaris:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {almarisHolding.length > 0 ? (
                        almarisHolding.map(alm => (
                          <button
                            key={alm.id}
                            onClick={() => setSelectedAlmariId(alm.id)}
                            className="px-2.5 py-1 rounded bg-[#2B2730] hover:bg-[#3E3845] text-white text-[12px] font-mono font-semibold border border-[var(--border-subtle)] cursor-pointer"
                          >
                            {alm.code}
                          </button>
                        ))
                      ) : (
                        <span className="text-[12px] text-amber-400 italic">No assigned Almari</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ==================================================================== */}
        {/* 2. DETAIL CUPBOARD VIEW: SHELVES & VISUAL BOOK SPINES               */}
        {/* ==================================================================== */}
        {selectedAlmariId && currentAlmari && (
          <div className="space-y-6">
            {/* Cupboard Frame */}
            <div className="p-5 sm:p-6 bg-white/90 dark:bg-[#171518] rounded-2xl border border-slate-200/80 dark:border-[var(--gold)]/50 shadow-sm dark:shadow-[0_20px_50px_rgba(0,0,0,0.6)] space-y-6">
              {/* Cupboard Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-[var(--border-subtle)] pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-[12px] bg-slate-100 dark:bg-[#221F26] border border-amber-500/30 dark:border-[var(--gold)]/40 flex items-center justify-center text-amber-700 dark:text-[var(--gold-text)] shrink-0">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white font-mono flex items-center gap-2">
                      <span>{currentAlmari.code} — {currentAlmari.name_en}</span>
                    </h3>
                    <p className="text-[13px] text-slate-600 dark:text-[var(--text-muted)] font-urdu" dir="auto">
                      {currentAlmari.name_ur} · {currentAlmari.notes || 'Main Library Stacks'}
                    </p>
                  </div>
                </div>

                {/* Group Legend and Header Action Buttons */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] uppercase font-semibold text-[var(--text-muted)] mr-1">
                      Groups:
                    </span>
                    {groups.map(g => (
                      <span
                        key={g.id}
                        className="px-2 py-0.5 rounded text-[11px] font-semibold border flex items-center gap-1.5"
                        style={{
                          backgroundColor: `${g.color}15`,
                          borderColor: `${g.color}40`,
                          color: g.color,
                        }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: g.color }} />
                        {g.name_en}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 pl-2 border-l border-white/10">
                    <button
                      type="button"
                      onClick={() => {
                        setAlmariToEdit(currentAlmari);
                        setIsAddEditOpen(true);
                      }}
                      className="px-3 h-8 rounded-[8px] bg-[#221F26] hover:bg-[#2B2730] text-white border border-white/10 text-[12px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Edit Cupboard metadata and shelf capacities"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-[#E0B450]" />
                      <span>Edit</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setAlmariToDelete(currentAlmari);
                        setIsDeleteModalOpen(true);
                      }}
                      className="px-3 h-8 rounded-[8px] bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 text-[12px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Delete this almari safely without deleting any books"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      <span>Delete Almari</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Shelves Container */}
              {booksInCurrentAlmari.length === 0 ? (
                <div className="py-14 px-6 text-center space-y-3 bg-[#1C1A1E] rounded-xl border border-[var(--border-subtle)]">
                  <div className="w-12 h-12 mx-auto rounded-full bg-[#221F26] border border-white/10 flex items-center justify-center text-[var(--text-muted)]">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
                    This cupboard is currently empty. You can select books in the catalog and paste them onto any shelf below.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                {Array.from({ length: currentAlmari.shelf_count }, (_, idx) => idx + 1).map(shelfNum => {
                  const shelfBooks = shelfBooksMap.get(shelfNum) || [];
                  const displayedBooks = shelfBooks.slice(0, 60);
                  const overflowCount = shelfBooks.length - 60;
                  const shelfCap = AlmariService.getShelvesForAlmari(currentAlmari.id).find(s => s.shelf_no === shelfNum)?.capacity || (currentAlmari.books_per_shelf || 30);
                  const shelfRange = AlmariService.computeShelfRange(shelfBooks, shelfCap);
                  const capacityPct = Math.round((shelfBooks.length / shelfCap) * 100);

                  return (
                    <div
                      key={shelfNum}
                      className="space-y-2.5 min-h-[84px] p-4 rounded-xl bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-white/10 shadow-sm"
                    >
                      {/* Shelf Level Header with Accession Range & Paste action */}
                      <div className="flex items-center justify-between text-xs pb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-white">Shelf {shelfNum}:</span>
                          <span className="font-mono text-amber-800 dark:text-[#E0B450] bg-amber-500/10 dark:bg-[#BC881B]/15 px-2 py-0.5 rounded border border-amber-500/30 dark:border-[#BC881B]/30">
                            {shelfRange.count > 0 ? shelfRange.rangeStr : 'Empty'}
                          </span>
                          {shelfRange.gaps.length > 0 && (
                            <span 
                              className="text-[#FB7185] text-[11px] font-semibold" 
                              title={`Missing numbers on shelf: ${shelfRange.gaps.slice(0, 6).join(', ')}${shelfRange.gaps.length > 6 ? '...' : ''}`}
                            >
                              ({shelfRange.gaps.length} gaps)
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-slate-500 dark:text-[#B3AABD] text-[11px] font-mono">{shelfBooks.length} / {shelfCap} books</span>
                          {selectedCatalogBookIds && selectedCatalogBookIds.size > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setPasteTargetAlmariId(currentAlmari.id);
                                setPasteTargetShelfNo(shelfNum);
                                setIsPasteBulkModalOpen(true);
                              }}
                              className="px-2.5 py-1 rounded bg-[#BC881B] hover:bg-[#D4A02A] text-[#1A1A1A] font-bold text-[11px] flex items-center gap-1 cursor-pointer shadow"
                            >
                              <ClipboardPaste className="w-3 h-3" />
                              <span>Paste {selectedCatalogBookIds.size} here</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Physical Shelf Book Spines */}
                      <div className="flex items-end gap-1 overflow-x-auto min-h-[56px] pb-1.5 px-1 border-b-2 border-slate-300 dark:border-[#3D3524] relative">
                        {displayedBooks.map((b, bIdx) => {
                          const grp = groupsMap.get(b.group_id || '');
                          const grpColor = grp?.color || '#78716C';
                          const isSelected = selectedBookId === b.id;
                          const isOnLoan = b.available_quantity === 0;

                          return (
                            <div
                              key={b.id}
                              tabIndex={0}
                              role="button"
                              aria-label={`${b.book_name} by ${b.author}, Call number: ${b.dewey_call_number || 'N/A'}`}
                              onClick={() => setSelectedBookId(b.id)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') setSelectedBookId(b.id);
                              }}
                              className={`h-14 rounded-t-sm transition-all duration-150 cursor-pointer relative flex flex-col justify-between p-0.5 select-none shrink-0 group ${
                                isSelected
                                  ? 'ring-2 ring-[var(--gold)] scale-105 z-10 shadow-lg'
                                  : 'hover:scale-102 hover:brightness-110'
                              } ${isOnLoan ? 'opacity-55' : ''}`}
                              style={{
                                width: '16px',
                                minWidth: '16px',
                                backgroundColor: grpColor,
                              }}
                              title={`${b.book_name} · ${b.author} · ${b.dewey_call_number || ''} · ${
                                isOnLoan ? 'ON LOAN' : 'AVAILABLE'
                              }`}
                            >
                              {/* Clock icon for on loan books */}
                              {isOnLoan && (
                                <Clock className="w-2.5 h-2.5 text-white/90 mx-auto" />
                              )}
                              <div className="flex-1" />
                              {/* Call number vertical indicator */}
                              <div className="w-full h-0.5 bg-white/40 rounded-full" />
                            </div>
                          );
                        })}

                        {/* +N more books overflow button */}
                        {overflowCount > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedShelfFilter(shelfNum)}
                            className="h-14 w-14 px-1 rounded-t-sm bg-slate-100 dark:bg-[#2B2730] hover:bg-slate-200 dark:hover:bg-[#3E3845] border border-slate-300 dark:border-[var(--gold)]/40 text-[#BC881B] text-[10px] font-bold flex flex-col items-center justify-center shrink-0 cursor-pointer transition-colors"
                          >
                            <span>+{overflowCount}</span>
                            <span className="text-[9px] text-slate-500">more</span>
                          </button>
                        )}

                        {shelfBooks.length === 0 && (
                          <div className="h-12 flex items-center justify-center w-full text-xs text-slate-400 dark:text-[var(--text-muted)] italic">
                            Empty shelf
                          </div>
                        )}
                      </div>

                      {/* Shelf Label & Capacity info */}
                      <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-[var(--text-muted)] px-1">
                        <span className="font-mono font-bold text-slate-800 dark:text-white">
                          Shelf {shelfNum} · {shelfBooks.length} books · {capacityPct}% full
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedShelfFilter(shelfNum === selectedShelfFilter ? null : shelfNum)}
                          className="text-[#BC881B] dark:text-[var(--gold-text)] hover:underline text-[11px] font-semibold cursor-pointer"
                        >
                          {selectedShelfFilter === shelfNum ? 'Show all shelves' : 'Filter table to this shelf'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              )}
            </div>

            {/* Selected Book Details Panel (Click a spine) */}
            {selectedBook && (
              <div className="p-5 rounded-xl bg-[#221F26] border border-[var(--gold)]/60 shadow-xl space-y-4 animate-in slide-in-from-top-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--gold-text)] font-bold">
                      Selected Book Spine
                    </span>
                    <h4 className="text-lg font-bold text-white mt-0.5" dir="auto">
                      {selectedBook.book_name}
                    </h4>
                    <p className="text-[13px] text-[var(--text-muted)]" dir="auto">
                      by {selectedBook.author} · Call #: {selectedBook.dewey_call_number || 'N/A'} · Barcode: {selectedBook.barcode}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedBookId(null)}
                    className="p-1 rounded text-[var(--text-muted)] hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[12px]">
                  <div className="p-2.5 rounded bg-[#1A1A1A] border border-[var(--border-subtle)]">
                    <span className="text-[10px] uppercase text-[var(--text-muted)] block">Group</span>
                    <span className="font-semibold text-white">
                      {groupsMap.get(selectedBook.group_id || '')?.name_en || 'Unassigned'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded bg-[#1A1A1A] border border-[var(--border-subtle)]">
                    <span className="text-[10px] uppercase text-[var(--text-muted)] block">Location</span>
                    <span className="font-semibold text-white font-mono">
                      {currentAlmari.code}, Shelf {selectedBook.shelf_no || 1}
                    </span>
                  </div>
                  <div className="p-2.5 rounded bg-[#1A1A1A] border border-[var(--border-subtle)]">
                    <span className="text-[10px] uppercase text-[var(--text-muted)] block">Circulation</span>
                    <span
                      className={`font-semibold ${
                        selectedBook.available_quantity > 0 ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      {selectedBook.available_quantity > 0 ? 'Available on Shelf' : 'On Loan'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded bg-[#1A1A1A] border border-[var(--border-subtle)]">
                    <span className="text-[10px] uppercase text-[var(--text-muted)] block">Total Copies</span>
                    <span className="font-semibold text-white font-mono">
                      {selectedBook.total_quantity} copies
                    </span>
                  </div>
                </div>

                {/* Move book form panel */}
                {isMovePanelOpen && (
                  <div className="p-4 rounded-lg bg-[#1A1A1A] border border-[var(--gold)]/40 space-y-3">
                    <h5 className="text-[13px] font-bold text-white flex items-center gap-2">
                      <MoveRight className="w-4 h-4 text-[var(--gold)]" />
                      Move Book to Another Almari / Shelf
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-[var(--text-muted)] uppercase mb-1">
                          Destination Almari:
                        </label>
                        <select
                          value={targetMoveAlmariId || currentAlmari.id}
                          onChange={e => setTargetMoveAlmariId(e.target.value)}
                          className="w-full h-9 px-3 bg-[#221F26] border border-[var(--border-subtle)] rounded text-[12px] text-white"
                        >
                          {almaris.map(a => (
                            <option key={a.id} value={a.id}>
                              {a.code} - {a.name_en}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] text-[var(--text-muted)] uppercase mb-1">
                          Destination Shelf:
                        </label>
                        <select
                          value={targetMoveShelfNo}
                          onChange={e => setTargetMoveShelfNo(Number(e.target.value))}
                          className="w-full h-9 px-3 bg-[#221F26] border border-[var(--border-subtle)] rounded text-[12px] text-white"
                        >
                          {Array.from(
                            {
                              length:
                                almaris.find(a => a.id === (targetMoveAlmariId || currentAlmari.id))?.shelf_count || 5,
                            },
                            (_, i) => i + 1
                          ).map(s => (
                            <option key={s} value={s}>
                              Shelf {s}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        onClick={() => setIsMovePanelOpen(false)}
                        className="px-3 py-1.5 bg-[#2B2730] text-white rounded text-[12px]"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleExecuteMove}
                        className="px-4 py-1.5 bg-[var(--gold)] hover:bg-[var(--gold-hover)] text-[#1A1A1A] font-semibold rounded text-[12px]"
                      >
                        Confirm Move
                      </button>
                    </div>
                  </div>
                )}

                {/* Audit movement history */}
                {selectedBookHistory.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[11px] uppercase font-semibold text-[var(--text-muted)]">
                      Recent Movement History:
                    </span>
                    <div className="space-y-1 max-h-24 overflow-y-auto">
                      {selectedBookHistory.slice(0, 3).map(h => (
                        <div key={h.id} className="text-[11px] text-[var(--text-muted)] font-mono">
                          Moved from {h.from} to {h.to} on {h.moved_at.split('T')[0]} ({h.reason || 'Relocation'})
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex items-center gap-2.5 pt-1">
                  <button
                    onClick={() => onOpenBook(selectedBook)}
                    className="px-4 py-2 bg-[var(--gold)] hover:bg-[var(--gold-hover)] text-[#1A1A1A] font-semibold text-[13px] rounded-[8px] flex items-center gap-2 cursor-pointer"
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>Open Book Details</span>
                  </button>
                  <button
                    onClick={() => {
                      setTargetMoveAlmariId(currentAlmari.id);
                      setTargetMoveShelfNo(selectedBook.shelf_no || 1);
                      setIsMovePanelOpen(!isMovePanelOpen);
                    }}
                    className="px-4 py-2 bg-[#2B2730] hover:bg-[#3D3745] text-white font-medium text-[13px] rounded-[8px] flex items-center gap-2 cursor-pointer border border-[var(--border-subtle)]"
                  >
                    <MoveRight className="w-4 h-4 text-[var(--gold)]" />
                    <span>Move to another shelf / Almari</span>
                  </button>
                </div>
              </div>
            )}

            {/* ==================================================================== */}
            {/* 3. SEARCHABLE, SORTABLE TABLE OF ALL BOOKS IN THIS ALMARI          */}
            {/* ==================================================================== */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h4 className="text-[15px] font-bold text-white flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-[var(--gold)]" />
                  All Books in this Almari ({booksInCurrentAlmari.length} titles)
                </h4>
                {selectedShelfFilter && (
                  <span className="px-2.5 py-0.5 rounded text-[12px] bg-[var(--gold)]/20 text-[var(--gold-text)] border border-[var(--gold)]/40 font-mono">
                    Showing Shelf {selectedShelfFilter} Only
                  </span>
                )}
              </div>

              <div className="bg-[#1A1A1A] border border-[var(--border-subtle)] rounded-[14px] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[12px]">
                    <thead className="bg-[#221F26] border-b border-[var(--border-subtle)] text-[11px] uppercase font-semibold text-[var(--text-muted)]">
                      <tr>
                        <th className="p-3 w-10 text-center">#</th>
                        <th className="p-3">Shelf</th>
                        <th className="p-3">Book Group</th>
                        <th className="p-3">Title & Author</th>
                        <th className="p-3">Call Number</th>
                        <th className="p-3">Barcode</th>
                        <th className="p-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle)]">
                      {booksInCurrentAlmari
                        .filter(b => selectedShelfFilter === null || b.shelf_no === selectedShelfFilter)
                        .map((b, idx) => {
                          const grp = groupsMap.get(b.group_id || '');
                          const isSelected = selectedBookId === b.id;

                          return (
                            <tr
                              key={b.id}
                              onClick={() => setSelectedBookId(b.id)}
                              className={`cursor-pointer transition-colors ${
                                isSelected ? 'bg-[var(--gold)]/15' : 'hover:bg-[#221F26]'
                              }`}
                            >
                              <td className="p-3 text-center font-mono text-[var(--text-muted)]">
                                {idx + 1}
                              </td>
                              <td className="p-3 font-mono font-bold text-white">
                                Shelf {b.shelf_no || 1}
                              </td>
                              <td className="p-3">
                                {grp ? (
                                  <span
                                    className="px-2 py-0.5 rounded text-[11px] font-semibold border inline-flex items-center gap-1.5"
                                    style={{
                                      backgroundColor: `${grp.color}15`,
                                      borderColor: `${grp.color}40`,
                                      color: grp.color,
                                    }}
                                  >
                                    <span
                                      className="w-1.5 h-1.5 rounded-full"
                                      style={{ backgroundColor: grp.color }}
                                    />
                                    {grp.name_en}
                                  </span>
                                ) : (
                                  <span className="text-stone-400 italic">No group</span>
                                )}
                              </td>
                              <td className="p-3">
                                <div className="font-semibold text-white truncate max-w-sm" dir="auto">
                                  {b.book_name}
                                </div>
                                <div className="text-[11px] text-[var(--text-muted)] truncate max-w-sm" dir="auto">
                                  {b.author}
                                </div>
                              </td>
                              <td className="p-3 font-mono text-slate-300">
                                {b.dewey_call_number || '-'}
                              </td>
                              <td className="p-3 font-mono text-slate-400">
                                {b.barcode}
                              </td>
                              <td className="p-3 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                    b.available_quantity > 0
                                      ? 'bg-emerald-950/30 text-emerald-400 border border-emerald-800/40'
                                      : 'bg-amber-950/30 text-amber-400 border border-amber-800/40'
                                  }`}
                                >
                                  {b.available_quantity > 0 ? 'On Shelf' : 'On Loan'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Almari Modal */}
      {isAddEditOpen && (
        <AddEditAlmariModal
          isOpen={isAddEditOpen}
          onClose={() => setIsAddEditOpen(false)}
          almariToEdit={almariToEdit}
          onSaved={handleAlmariSaved}
        />
      )}

      {/* Paste from Catalog Selection Modal */}
      {isPasteBulkModalOpen && (
        <BulkAssignModal
          isOpen={isPasteBulkModalOpen}
          onClose={() => setIsPasteBulkModalOpen(false)}
          selectedBooks={selectedCatalogBooks}
          allBooks={books}
          mode="assign_almari"
          initialAlmariId={pasteTargetAlmariId}
          initialShelfNo={pasteTargetShelfNo}
          onComplete={handlePasteComplete}
        />
      )}

      {/* Delete Almari Modal */}
      {isDeleteModalOpen && almariToDelete && (
        <DeleteAlmariModal
          isOpen={isDeleteModalOpen}
          almari={almariToDelete}
          allBooks={books}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setAlmariToDelete(null);
          }}
          onConfirmDelete={handleConfirmDeleteAlmari}
        />
      )}
    </div>
  );
};
