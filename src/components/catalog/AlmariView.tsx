import React, { useState, useMemo } from 'react';
import {
  Building2,
  Search,
  Layers,
  BookOpen,
  ArrowLeft,
  ArrowRight,
  X,
  Check,
  CheckCircle2,
  MoveRight,
  Plus,
  ClipboardPaste,
  Edit3,
  Trash2,
  Hash,
  Library,
  Inbox,
  CheckSquare,
  Square
} from 'lucide-react';
import { Book, Almari, BookGroup } from '../../types/library';
import { AlmariService } from '../../services/almariService';
import { LibraryStorage } from '../../services/storage';
import {
  resolveBookAlmariAndShelf,
  persistManualBookShelfAssignments,
  ResolvedAlmariPlacement
} from '../../services/libraryStorageAndMigration';
import { AddEditAlmariModal } from '../modals/AddEditAlmariModal';
import { DeleteAlmariModal } from '../modals/DeleteAlmariModal';
import { BulkAssignModal } from '../modals/BulkAssignModal';

export interface AlmariViewProps {
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

interface EnrichedBook {
  book: Book;
  placement: ResolvedAlmariPlacement;
}

export const AlmariView: React.FC<AlmariViewProps> = ({
  books,
  onOpenBook,
  onEditBook,
  onMoveBook,
  onReloadAlmaris,
  selectedCatalogBookIds,
  onClearCatalogSelection,
  onCatalogBooksUpdated,
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
  const [selectedShelfFilter, setSelectedShelfFilter] = useState<number | null>(null);

  // Selected spine / book detail panel
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [isMovePanelOpen, setIsMovePanelOpen] = useState<boolean>(false);
  const [targetMoveAlmariId, setTargetMoveAlmariId] = useState<string>('');
  const [targetMoveShelfNo, setTargetMoveShelfNo] = useState<number>(1);
  const [moveToast, setMoveToast] = useState<string | null>(null);

  // Global "Find a book" & Range Lookup state
  const [finderQuery, setFinderQuery] = useState<string>('');
  const [rangeLookupQuery, setRangeLookupQuery] = useState<string>('');

  // Modals and bulk placement states
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [almariToEdit, setAlmariToEdit] = useState<Almari | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [almariToDelete, setAlmariToDelete] = useState<Almari | null>(null);
  const [isPasteBulkModalOpen, setIsPasteBulkModalOpen] = useState(false);
  const [pasteTargetAlmariId, setPasteTargetAlmariId] = useState<string>('');
  const [pasteTargetShelfNo, setPasteTargetShelfNo] = useState<number>(1);

  // Manual Assign Books Modal state (triggered from Unassigned banner or Shelf "+ Assign Books to Shelf X")
  const [isManualAssignOpen, setIsManualAssignOpen] = useState(false);
  const [manualTargetAlmariId, setManualTargetAlmariId] = useState<string>('');
  const [manualTargetShelfNo, setManualTargetShelfNo] = useState<number>(1);
  const [manualAssignTab, setManualAssignTab] = useState<'pick' | 'range'>('pick');
  const [manualPickerSearch, setManualPickerSearch] = useState<string>('');
  const [manualPickerOnlyUnassigned, setManualPickerOnlyUnassigned] = useState<boolean>(true);
  const [manualPickerGroupFilter, setManualPickerGroupFilter] = useState<string>('ALL');
  const [manualCheckedBookIds, setManualCheckedBookIds] = useState<Set<string>>(new Set());
  const [manualRangeFrom, setManualRangeFrom] = useState<string>('1');
  const [manualRangeTo, setManualRangeTo] = useState<string>('50');

  // Pagination for "All Books in this Almari" table
  const [tablePage, setTablePage] = useState<number>(1);
  const tablePageSize = 50;

  const activeBooks = useMemo(
    () => books.filter(b => b.is_active === undefined || b.is_active !== false),
    [books]
  );

  // Resolve every book's manual Almari, manual Shelf, and Discipline Group
  const enrichedBooks = useMemo<EnrichedBook[]>(() => {
    return activeBooks.map(book => ({
      book,
      placement: resolveBookAlmariAndShelf(book, almaris, groups),
    }));
  }, [activeBooks, almaris, groups]);

  // Selected catalog books objects
  const selectedCatalogBooks = useMemo(() => {
    if (!selectedCatalogBookIds || selectedCatalogBookIds.size === 0) return [];
    return activeBooks.filter(b => selectedCatalogBookIds.has(b.id));
  }, [selectedCatalogBookIds, activeBooks]);

  const showToast = (msg: string) => {
    setMoveToast(msg);
    setTimeout(() => setMoveToast(null), 4000);
  };

  // Open Manual Assign Books Modal for a specific Almari & Shelf
  const openManualAssignModal = (almariId?: string, shelfNo?: number) => {
    const targetAlmId = almariId || selectedAlmariId || (almaris[0]?.id ?? '');
    if (!targetAlmId) {
      setAlmariToEdit(null);
      setIsAddEditOpen(true);
      return;
    }
    setManualTargetAlmariId(targetAlmId);
    setManualTargetShelfNo(shelfNo || 1);
    setManualCheckedBookIds(new Set());
    setManualPickerSearch('');
    setIsManualAssignOpen(true);
  };

  // Range Lookup Resolver (e.g., "1-500", "ULM-00010 to ULM-00100", or single accession "245")
  const rangeLookupResults = useMemo(() => {
    const q = rangeLookupQuery.trim().toUpperCase();
    if (!q) return null;

    let minNum: number | null = null;
    let maxNum: number | null = null;

    if (q.includes(' TO ')) {
      const [p1, p2] = q.split(' TO ');
      minNum = AlmariService.extractAccessionNumber(p1);
      maxNum = AlmariService.extractAccessionNumber(p2);
    } else if (q.includes('-') && /^\d+\s*-\s*\d+$/.test(q)) {
      const [p1, p2] = q.split('-');
      minNum = parseInt(p1.trim(), 10);
      maxNum = parseInt(p2.trim(), 10);
    } else {
      const single = AlmariService.extractAccessionNumber(q);
      if (single !== null) {
        minNum = single;
        maxNum = single;
      }
    }

    if (minNum === null || maxNum === null || isNaN(minNum) || isNaN(maxNum)) return null;
    const start = Math.min(minNum, maxNum);
    const end = Math.max(minNum, maxNum);

    const matching = enrichedBooks.filter(({ book }) => {
      const n = AlmariService.extractAccessionNumber(book.accession_no || book.barcode);
      return n !== null && n >= start && n <= end;
    });

    const summaryByAlmari = new Map<string, { almariCode: string; almariName: string; almariId: string; shelves: Set<number>; count: number }>();
    for (const { placement } of matching) {
      const key = placement.almari_id || 'UNASSIGNED';
      const existing = summaryByAlmari.get(key) || {
        almariCode: placement.almari_code || 'Unassigned',
        almariName: placement.almari_name_en || 'No Almari',
        almariId: placement.almari_id,
        shelves: new Set<number>(),
        count: 0,
      };
      if (placement.shelf_no > 0) existing.shelves.add(placement.shelf_no);
      existing.count += 1;
      summaryByAlmari.set(key, existing);
    }

    return {
      start,
      end,
      totalMatches: matching.length,
      breakdown: Array.from(summaryByAlmari.values()),
    };
  }, [rangeLookupQuery, enrichedBooks]);

  // Global Finder Results ("Find a book -> Which Almari & Shelf?")
  const finderResults = useMemo(() => {
    const q = finderQuery.trim().toLowerCase();
    if (!q) return [];
    return enrichedBooks
      .filter(({ book, placement }) => {
        return (
          (book.book_name || '').toLowerCase().includes(q) ||
          (book.author || '').toLowerCase().includes(q) ||
          (book.accession_no || '').toLowerCase().includes(q) ||
          (book.barcode || '').toLowerCase().includes(q) ||
          (book.dewey_call_number || '').toLowerCase().includes(q) ||
          (placement.almari_code || '').toLowerCase().includes(q)
        );
      })
      .slice(0, 8);
  }, [finderQuery, enrichedBooks]);

  // Group books by resolved manual Almari ID
  const booksByAlmariId = useMemo(() => {
    const map = new Map<string, EnrichedBook[]>();
    for (const alm of almaris) {
      map.set(alm.id, []);
    }
    for (const item of enrichedBooks) {
      if (!item.placement.almari_id) continue;
      const list = map.get(item.placement.almari_id) || [];
      list.push(item);
      map.set(item.placement.almari_id, list);
    }
    return map;
  }, [almaris, enrichedBooks]);

  // Unassigned books (books not yet manually assigned to any active Almari)
  const unassignedBooks = useMemo(() => {
    return enrichedBooks.filter(item => !item.placement.almari_id);
  }, [enrichedBooks]);

  const assignedBooksCount = activeBooks.length - unassignedBooks.length;

  // Filtered Almaris in Overview Grid
  const filteredAlmaris = useMemo(() => {
    return almaris.filter(alm => {
      const almBooks = booksByAlmariId.get(alm.id) || [];

      if (activeGroupFilter !== 'ALL') {
        const configuredGroups = AlmariService.getGroupsForAlmari(alm.id);
        const hasConfigured = configuredGroups.some(g => g.id === activeGroupFilter);
        const hasBookInGroup = almBooks.some(b => b.placement.group_id === activeGroupFilter);
        if (!hasConfigured && !hasBookInGroup) return false;
      }

      if (activeLangFilter !== 'ALL') {
        const hasLang = almBooks.some(
          b => (b.book.language || 'English').toLowerCase() === activeLangFilter.toLowerCase()
        );
        if (!hasLang && almBooks.length > 0) return false;
      }

      if (onlyOnLoan) {
        const hasLoan = almBooks.some(b => b.book.available_quantity < b.book.total_quantity);
        if (!hasLoan) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesMeta =
          alm.code.toLowerCase().includes(q) ||
          alm.name_en.toLowerCase().includes(q) ||
          alm.name_ur.toLowerCase().includes(q) ||
          (alm.notes || '').toLowerCase().includes(q);
        const matchesBook = almBooks.some(
          ({ book }) =>
            (book.book_name || '').toLowerCase().includes(q) ||
            (book.author || '').toLowerCase().includes(q) ||
            (book.accession_no || '').toLowerCase().includes(q) ||
            (book.barcode || '').toLowerCase().includes(q)
        );
        if (!matchesMeta && !matchesBook) return false;
      }

      return true;
    });
  }, [almaris, booksByAlmariId, activeGroupFilter, activeLangFilter, onlyOnLoan, searchQuery]);

  // Selected Almari object & its books
  const selectedAlmari = useMemo(
    () => (selectedAlmariId ? almarisMap.get(selectedAlmariId) || null : null),
    [selectedAlmariId, almarisMap]
  );

  const selectedAlmariEnrichedBooks = useMemo(() => {
    if (!selectedAlmari) return [];
    const raw = booksByAlmariId.get(selectedAlmari.id) || [];
    return raw.filter(({ book, placement }) => {
      if (activeGroupFilter !== 'ALL' && placement.group_id !== activeGroupFilter) return false;
      if (
        activeLangFilter !== 'ALL' &&
        (book.language || 'English').toLowerCase() !== activeLangFilter.toLowerCase()
      ) {
        return false;
      }
      if (onlyOnLoan && book.available_quantity >= book.total_quantity) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const match =
          (book.book_name || '').toLowerCase().includes(q) ||
          (book.author || '').toLowerCase().includes(q) ||
          (book.accession_no || '').toLowerCase().includes(q) ||
          (book.barcode || '').toLowerCase().includes(q) ||
          (book.dewey_call_number || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [selectedAlmari, booksByAlmariId, activeGroupFilter, activeLangFilter, onlyOnLoan, searchQuery]);

  // ONLY the Discipline Groups assigned to or actually present in the selected Almari
  const selectedAlmariDisciplineGroups = useMemo<BookGroup[]>(() => {
    if (!selectedAlmari) return [];
    const allInAlmari = booksByAlmariId.get(selectedAlmari.id) || [];
    const presentGroupIds = new Set<string>();
    for (const item of allInAlmari) {
      if (item.placement.group_id) presentGroupIds.add(item.placement.group_id);
    }
    const configured = AlmariService.getGroupsForAlmari(selectedAlmari.id);
    for (const g of configured) {
      if (presentGroupIds.size < 4) presentGroupIds.add(g.id);
    }
    const list = Array.from(presentGroupIds)
      .map(id => groupsMap.get(id))
      .filter((g): g is BookGroup => !!g);
    return list.length > 0 ? list : configured.slice(0, 3);
  }, [selectedAlmari, booksByAlmariId, groupsMap]);

  // Selected spine book details
  const selectedBookItem = useMemo(() => {
    if (!selectedBookId) return null;
    return enrichedBooks.find(b => b.book.id === selectedBookId) || null;
  }, [selectedBookId, enrichedBooks]);

  // Persist manual book placement update to both LocalStorage and IndexedDB
  const commitManualBookUpdates = (updatedBooks: Book[], toastMessage: string) => {
    LibraryStorage.saveBooks(updatedBooks);
    persistManualBookShelfAssignments(updatedBooks);
    if (onCatalogBooksUpdated) {
      onCatalogBooksUpdated(updatedBooks, toastMessage);
    }
    showToast(toastMessage);
  };

  // Move single book handler (from Spine Quick Inspector Drawer)
  const handleConfirmMoveBook = () => {
    if (!selectedBookItem || !targetMoveAlmariId) return;
    const targetAlm = almarisMap.get(targetMoveAlmariId);
    if (!targetAlm) return;

    const shelfStr = `${targetAlm.code} · Shelf ${targetMoveShelfNo}`;
    const updatedBooks = books.map(b => {
      if (b.id === selectedBookItem.book.id) {
        return {
          ...b,
          almari_id: targetAlm.id,
          shelf_no: targetMoveShelfNo,
          shelf: shelfStr,
          row: String(targetMoveShelfNo),
          group_id: b.group_id || selectedBookItem.placement.group_id,
          updated_at: new Date().toISOString(),
        };
      }
      return b;
    });

    if (onMoveBook) {
      onMoveBook(selectedBookItem.book, targetAlm.id, targetMoveShelfNo);
    }
    commitManualBookUpdates(
      updatedBooks,
      `Moved "${selectedBookItem.book.book_name}" to ${targetAlm.code} · Shelf ${targetMoveShelfNo}`
    );
    setIsMovePanelOpen(false);
  };

  // 1-Click Inline Row Shelf Change or Unassign in "All Books in this Almari" table
  const handleInlineRowShelfChange = (book: Book, newValue: string) => {
    if (!selectedAlmari) return;

    if (newValue === 'UNASSIGN') {
      const updatedBooks = books.map(b => {
        if (b.id === book.id) {
          return {
            ...b,
            almari_id: null,
            shelf_no: null,
            shelf: 'Unassigned (No Almari)',
            row: '',
            updated_at: new Date().toISOString(),
          };
        }
        return b;
      });
      if (selectedBookId === book.id) setSelectedBookId(null);
      commitManualBookUpdates(
        updatedBooks,
        `Unassigned "${book.book_name}" from ${selectedAlmari.code}`
      );
      return;
    }

    const newShelfNo = Math.max(1, parseInt(newValue, 10) || 1);
    const shelfStr = `${selectedAlmari.code} · Shelf ${newShelfNo}`;
    const updatedBooks = books.map(b => {
      if (b.id === book.id) {
        return {
          ...b,
          almari_id: selectedAlmari.id,
          shelf_no: newShelfNo,
          shelf: shelfStr,
          row: String(newShelfNo),
          updated_at: new Date().toISOString(),
        };
      }
      return b;
    });
    if (onMoveBook) {
      onMoveBook(book, selectedAlmari.id, newShelfNo);
    }
    commitManualBookUpdates(
      updatedBooks,
      `Assigned "${book.book_name}" to ${selectedAlmari.code} · Shelf ${newShelfNo}`
    );
  };

  // Candidate books for Manual Assign Modal (Tab 1: Pick Books)
  const manualPickerCandidates = useMemo(() => {
    const q = manualPickerSearch.trim().toLowerCase();
    return enrichedBooks
      .filter(({ book, placement }) => {
        if (manualPickerOnlyUnassigned && placement.almari_id) return false;
        if (manualPickerGroupFilter !== 'ALL' && placement.group_id !== manualPickerGroupFilter) {
          return false;
        }
        if (q) {
          const match =
            (book.book_name || '').toLowerCase().includes(q) ||
            (book.author || '').toLowerCase().includes(q) ||
            (book.accession_no || '').toLowerCase().includes(q) ||
            (book.barcode || '').toLowerCase().includes(q) ||
            (book.dewey_call_number || '').toLowerCase().includes(q);
          if (!match) return false;
        }
        return true;
      })
      .slice(0, 150);
  }, [enrichedBooks, manualPickerSearch, manualPickerOnlyUnassigned, manualPickerGroupFilter]);

  // Candidate books for Manual Assign Modal (Tab 2: Range Assignment)
  const manualRangeCandidates = useMemo(() => {
    const n1 = AlmariService.extractAccessionNumber(manualRangeFrom);
    const n2 = AlmariService.extractAccessionNumber(manualRangeTo);
    if (n1 === null || n2 === null) return [];
    const start = Math.min(n1, n2);
    const end = Math.max(n1, n2);
    return enrichedBooks.filter(({ book }) => {
      const num = AlmariService.extractAccessionNumber(book.accession_no || book.barcode);
      return num !== null && num >= start && num <= end;
    });
  }, [enrichedBooks, manualRangeFrom, manualRangeTo]);

  // Execute Manual Assign from Modal
  const handleConfirmManualAssignModal = () => {
    const targetAlm = almarisMap.get(manualTargetAlmariId);
    if (!targetAlm) return;

    const targetIds =
      manualAssignTab === 'pick'
        ? manualCheckedBookIds
        : new Set(manualRangeCandidates.map(item => item.book.id));

    if (targetIds.size === 0) return;

    const shelfStr = `${targetAlm.code} · Shelf ${manualTargetShelfNo}`;
    const nowIso = new Date().toISOString();
    const updatedBooks = books.map(b => {
      if (targetIds.has(b.id)) {
        return {
          ...b,
          almari_id: targetAlm.id,
          shelf_no: manualTargetShelfNo,
          shelf: shelfStr,
          row: String(manualTargetShelfNo),
          updated_at: nowIso,
        };
      }
      return b;
    });

    setIsManualAssignOpen(false);
    setManualCheckedBookIds(new Set());
    commitManualBookUpdates(
      updatedBooks,
      `Manually assigned ${targetIds.size.toLocaleString()} volume${targetIds.size === 1 ? '' : 's'} to ${targetAlm.code} (${targetAlm.name_en}) · Shelf ${manualTargetShelfNo}`
    );
  };

  // Filtered table books in Single Almari Inspector
  const inspectorTableBooks = useMemo(() => {
    if (!selectedAlmari) return [];
    if (selectedShelfFilter === null) return selectedAlmariEnrichedBooks;
    return selectedAlmariEnrichedBooks.filter(b => b.placement.shelf_no === selectedShelfFilter);
  }, [selectedAlmari, selectedAlmariEnrichedBooks, selectedShelfFilter]);

  const totalTablePages = Math.max(1, Math.ceil(inspectorTableBooks.length / tablePageSize));
  const safeTablePage = Math.min(tablePage, totalTablePages);
  const paginatedTableBooks = useMemo(() => {
    const start = (safeTablePage - 1) * tablePageSize;
    return inspectorTableBooks.slice(start, start + tablePageSize);
  }, [inspectorTableBooks, safeTablePage, tablePageSize]);

  return (
    <div className="w-full h-auto min-h-0 flex flex-col gap-5 bg-transparent px-6 pt-5 pb-12 overflow-visible">
      <div className="max-w-[1920px] w-full mx-auto space-y-5">

        {/* Toast Notification */}
        {moveToast && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-900 dark:text-emerald-200 text-xs font-bold flex items-center justify-between gap-3 shadow-sm animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{moveToast}</span>
            </div>
            <button
              type="button"
              onClick={() => setMoveToast(null)}
              className="p-1 rounded-lg hover:bg-black/10 text-emerald-800 dark:text-emerald-300 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Selected Catalog Books Placement Banner */}
        {selectedCatalogBooks.length > 0 && (
          <div className="bg-white/90 dark:bg-[#140D22]/90 backdrop-blur-2xl border-2 border-[#C8963E] rounded-2xl p-4 shadow-md flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#8E4F0B] to-[#CE851D] text-white font-extrabold flex items-center justify-center font-mono text-sm shadow-xs">
                {selectedCatalogBooks.length}
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  {selectedCatalogBooks.length} Catalog Book{selectedCatalogBooks.length !== 1 ? 's' : ''} Ready for Manual Shelf Placement
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Open any Almari below or click &ldquo;Place Selected Books...&rdquo; to manually assign these volumes to a physical shelf.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (almaris.length === 0) {
                    setAlmariToEdit(null);
                    setIsAddEditOpen(true);
                    return;
                  }
                  setPasteTargetAlmariId(selectedAlmariId || (almaris[0]?.id ?? ''));
                  setPasteTargetShelfNo(1);
                  setIsPasteBulkModalOpen(true);
                }}
                className="h-9 px-4 rounded-xl bg-gradient-to-r from-[#8E4F0B] via-[#B4690E] to-[#CE851D] !text-white text-xs font-extrabold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                <span>Place Selected Books...</span>
              </button>
              {onClearCatalogSelection && (
                <button
                  type="button"
                  onClick={onClearCatalogSelection}
                  className="h-9 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-300 dark:border-white/10 cursor-pointer"
                >
                  Clear Selection
                </button>
              )}
            </div>
          </div>
        )}

        {/* TOP EXECUTIVE BANNER & SEARCH / RANGE LOOKUP BAR */}
        <div className="bg-white/85 dark:bg-[#140D22]/85 backdrop-blur-2xl border border-[#C8963E]/35 dark:border-white/10 rounded-2xl p-5 shadow-[0_10px_30px_-10px_rgba(30,20,43,0.08)] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#F5E1B0] to-[#EBC97E] dark:from-[#541A72]/60 dark:to-[#3B1054]/60 border border-[#C8963E]/60 dark:border-[#FFD147]/40 flex items-center justify-center text-[#5E3200] dark:text-[#FFD147] shadow-xs shrink-0">
                <Library className="w-6 h-6 stroke-[2]" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-display font-extrabold text-slate-900 dark:text-white tracking-tight">
                    Almaris &amp; Physical Shelves (الماریاں اور شیلف)
                  </h2>
                  <span className="px-3 py-0.5 rounded-full text-xs font-extrabold bg-gradient-to-r from-[#F5E1B0] to-[#EBC97E] dark:from-[#FFD147]/20 dark:to-[#B8731B]/20 text-[#5E3200] dark:text-[#FFD147] border border-[#C59032]/50 font-mono">
                    {almaris.length} Manual Almari{almaris.length === 1 ? '' : 's'} · {assignedBooksCount.toLocaleString()} Assigned
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-0.5">
                  Create physical cupboards manually and assign books to specific shelves (Shelf 1–Shelf N) with 3D color-coded spine inspection.
                </p>
              </div>
            </div>

            {/* Right Actions: Manual Assign Control + Single "+ Add Almari" CTA */}
            <div className="flex items-center gap-2.5 flex-wrap">
              {almaris.length > 0 && (
                <button
                  type="button"
                  onClick={() => openManualAssignModal(selectedAlmariId || almaris[0]?.id, selectedShelfFilter || 1)}
                  className="h-10 px-4 rounded-xl bg-white/95 hover:bg-amber-50/80 dark:bg-white/10 dark:hover:bg-white/15 text-slate-900 dark:text-white border border-[#C8963E]/45 dark:border-[#FFD147]/30 text-xs font-extrabold flex items-center gap-2 shadow-xs hover:-translate-y-0.5 transition-all cursor-pointer"
                  title="Manually assign catalog books to a specific Almari and Shelf"
                >
                  <Inbox className="w-4 h-4 text-[#B4690E] dark:text-[#FFD147] shrink-0" />
                  <span>Assign to Almari &amp; Shelf ▾</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setAlmariToEdit(null);
                  setIsAddEditOpen(true);
                }}
                className="bg-gradient-to-r from-[#8E4F0B] via-[#B4690E] to-[#CE851D] hover:from-[#7A4207] hover:to-[#B57214] !text-white font-extrabold px-5 h-10 rounded-xl text-xs sm:text-sm flex items-center gap-2 shadow-md hover:-translate-y-0.5 transition-all cursor-pointer border border-[#E7BC61]/50"
              >
                <Plus className="w-4 h-4 stroke-[2.5] !text-white" />
                <span className="!text-white">+ Add Almari</span>
              </button>
            </div>
          </div>

          {/* Search & Range Lookup Toolbar Row (Zero Icon Overlap: pl-10 + left-3.5) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-3 border-t border-slate-200/80 dark:border-white/10">
            {/* 1. Find a Book -> Which Almari & Shelf? */}
            <div className="md:col-span-5 relative">
              <Search className="w-4 h-4 text-slate-400 dark:text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={finderQuery}
                onChange={e => setFinderQuery(e.target.value)}
                placeholder="Find any book title, accession #, or barcode → locate Almari & Shelf..."
                style={{ paddingLeft: '2.5rem' }}
                className="w-full h-10 pl-10 pr-8 rounded-xl bg-white/95 dark:bg-[#0B1220] border border-slate-300/90 dark:border-white/15 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 text-[13px] font-medium focus:border-[#B4690E] dark:focus:border-[#FFD147] focus:outline-none transition-colors shadow-2xs"
              />
              {finderQuery && (
                <button
                  type="button"
                  onClick={() => setFinderQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* 2. Filter Almaris or Current Almari Books */}
            <div className="md:col-span-4 relative">
              <Search className="w-4 h-4 text-slate-400 dark:text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setTablePage(1);
                }}
                placeholder={selectedAlmari ? `Search inside ${selectedAlmari.code} (${selectedAlmari.name_en})...` : 'Search Almaris by code, name, or book keyword...'}
                style={{ paddingLeft: '2.5rem' }}
                className="w-full h-10 pl-10 pr-8 rounded-xl bg-white/95 dark:bg-[#0B1220] border border-slate-300/90 dark:border-white/15 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 text-[13px] font-medium focus:border-[#B4690E] dark:focus:border-[#FFD147] focus:outline-none transition-colors shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* 3. Widened Accession Range Lookup Input */}
            <div className="md:col-span-3 relative min-w-[230px]">
              <Hash className="w-4 h-4 text-[#B4690E] dark:text-[#FFD147] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={rangeLookupQuery}
                onChange={e => setRangeLookupQuery(e.target.value)}
                placeholder="Range (e.g. 1-500)"
                style={{ paddingLeft: '2.5rem' }}
                className="w-full h-10 pl-10 pr-8 rounded-xl bg-white/95 dark:bg-[#0B1220] border border-slate-300/90 dark:border-white/15 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 text-[13px] font-mono focus:border-[#B4690E] dark:focus:border-[#FFD147] focus:outline-none transition-colors shadow-2xs"
              />
              {rangeLookupQuery && (
                <button
                  type="button"
                  onClick={() => setRangeLookupQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Global Book Finder Results Dropdown Panel */}
          {finderResults.length > 0 && (
            <div className="p-3.5 rounded-xl bg-slate-50/95 dark:bg-[#0D0917]/95 border border-[#C8963E]/40 space-y-2">
              <div className="flex items-center justify-between text-xs font-extrabold text-slate-700 dark:text-slate-200">
                <span>Instant Shelf Locator Results ({finderResults.length})</span>
                <button
                  type="button"
                  onClick={() => setFinderQuery('')}
                  className="text-[#B4690E] dark:text-[#FFD147] hover:underline cursor-pointer"
                >
                  Close
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {finderResults.map(({ book, placement }) => (
                  <div
                    key={book.id}
                    onClick={() => {
                      if (placement.almari_id) {
                        setSelectedAlmariId(placement.almari_id);
                        setSelectedShelfFilter(placement.shelf_no);
                        setSelectedBookId(book.id);
                      } else {
                        setManualCheckedBookIds(new Set([book.id]));
                        openManualAssignModal(almaris[0]?.id, 1);
                      }
                      setFinderQuery('');
                    }}
                    className="p-2.5 rounded-xl bg-white dark:bg-[#140D22] border border-slate-200 dark:border-white/10 hover:border-[#C8963E] flex items-center justify-between gap-3 cursor-pointer transition-all"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{book.book_name}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {book.author} · <span className="font-mono">{book.accession_no || book.barcode}</span>
                      </p>
                    </div>
                    {placement.almari_id ? (
                      <span className="shrink-0 px-2.5 py-1 rounded-lg bg-[#541A72]/10 dark:bg-[#FFD147]/15 text-[#541A72] dark:text-[#FFD147] border border-[#541A72]/25 dark:border-[#FFD147]/30 font-mono text-xs font-extrabold">
                        {placement.almari_code} · Shelf {placement.shelf_no}
                      </span>
                    ) : (
                      <span className="shrink-0 px-2.5 py-1 rounded-lg bg-amber-500/15 text-[#8A4B00] dark:text-[#FFD147] border border-[#C8963E]/40 font-mono text-xs font-bold">
                        Unassigned → Assign
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Range Lookup Results Breakdown */}
          {rangeLookupResults && (
            <div className="p-3.5 rounded-xl bg-amber-50/90 dark:bg-[#1C112B]/90 border border-[#C8963E]/50 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-bold text-slate-900 dark:text-white">
                Accession Range <span className="font-mono text-[#8A4B00] dark:text-[#FFD147]">#{rangeLookupResults.start} – #{rangeLookupResults.end}</span>:{' '}
                <span>{rangeLookupResults.totalMatches.toLocaleString()} matching volumes</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {rangeLookupResults.breakdown.map((item, idx) => (
                  <button
                    key={item.almariId || `unassigned-${idx}`}
                    type="button"
                    onClick={() => {
                      if (item.almariId) {
                        setSelectedAlmariId(item.almariId);
                        setSelectedShelfFilter(null);
                      } else {
                        setManualAssignTab('range');
                        setManualRangeFrom(String(rangeLookupResults.start));
                        setManualRangeTo(String(rangeLookupResults.end));
                        openManualAssignModal(almaris[0]?.id, 1);
                      }
                    }}
                    className="px-3 py-1 rounded-lg bg-white dark:bg-[#140D22] border border-[#C8963E]/40 text-xs font-extrabold text-slate-900 dark:text-white hover:border-[#B4690E] cursor-pointer"
                  >
                    {item.almariId
                      ? `${item.almariCode} (${item.count} bks · Shelves ${Array.from(item.shelves).sort().join(', ')})`
                      : `Unassigned (${item.count} bks → Click to Assign)`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Filter Pills Row: Discipline Group Filter & Loan Filter */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setActiveGroupFilter('ALL');
                  setTablePage(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer border ${
                  activeGroupFilter === 'ALL'
                    ? 'bg-[#541A72] !text-white border-[#FFD147]/50 shadow-xs'
                    : 'bg-slate-100/90 hover:bg-slate-200/80 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10'
                }`}
              >
                All Disciplines
              </button>
              {(selectedAlmari ? selectedAlmariDisciplineGroups : groups.slice(0, 8)).map(grp => {
                const isActive = activeGroupFilter === grp.id;
                return (
                  <button
                    key={grp.id}
                    type="button"
                    onClick={() => {
                      setActiveGroupFilter(isActive ? 'ALL' : grp.id);
                      setTablePage(1);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                      isActive
                        ? 'bg-[#541A72] !text-white border-[#FFD147]/60 shadow-xs'
                        : 'bg-white/90 hover:bg-slate-100 dark:bg-white/5 dark:hover:bg-white/10 text-slate-800 dark:text-slate-200 border-slate-200/90 dark:border-white/10'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: grp.color }} />
                    <span>{grp.name_en}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setOnlyOnLoan(!onlyOnLoan)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  onlyOnLoan
                    ? 'bg-amber-500/20 text-amber-900 dark:text-amber-300 border-amber-500/50'
                    : 'bg-slate-100/90 dark:bg-white/5 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10'
                }`}
              >
                {onlyOnLoan ? '✓ Showing Active Loans Only' : 'Filter: Active Loans'}
              </button>
              {(activeGroupFilter !== 'ALL' || activeLangFilter !== 'ALL' || onlyOnLoan || searchQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveGroupFilter('ALL');
                    setActiveLangFilter('ALL');
                    setOnlyOnLoan(false);
                    setSearchQuery('');
                    setSelectedShelfFilter(null);
                  }}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-500/10 border border-rose-500/25 hover:bg-rose-500/20 cursor-pointer"
                >
                  Reset Filters
                </button>
              )}
            </div>
          </div>
        </div>

        {/* COMPACT LIQUID GLASS "NO ALMARI (UNASSIGNED)" BANNER */}
        {unassignedBooks.length > 0 ? (
          <div className="bg-white/85 dark:bg-[#161024]/85 backdrop-blur-2xl border border-slate-200/90 dark:border-white/10 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-[#C8963E]/45 flex items-center justify-center text-[#8A4B00] dark:text-[#FFD147] shrink-0">
                <Inbox className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    No Almari (Unassigned) — {unassignedBooks.length.toLocaleString()} Volumes Currently Unassigned
                  </h4>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-500/15 text-[#8A4B00] dark:text-[#FFD147] border border-[#C8963E]/35">
                    100% Manual Placement
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                  Books are never auto-distributed into dummy cupboards. Assign books manually to any Almari &amp; Shelf whenever you choose.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => openManualAssignModal(selectedAlmariId || almaris[0]?.id, selectedShelfFilter || 1)}
              className="h-10 px-4 rounded-xl bg-gradient-to-r from-[#541A72] to-[#3B1054] hover:from-[#65208A] hover:to-[#4A1568] !text-white border border-[#FFD147]/45 text-xs font-extrabold flex items-center gap-2 shadow-sm hover:-translate-y-0.5 transition-all cursor-pointer"
            >
              <span>📥 Manually Assign Books to an Almari →</span>
            </button>
          </div>
        ) : activeBooks.length > 0 ? (
          <div className="bg-white/85 dark:bg-[#161024]/85 border border-emerald-500/35 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
            <span className="text-xs font-extrabold text-emerald-800 dark:text-emerald-300 inline-flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>✓ All {activeBooks.length.toLocaleString()} volumes are manually assigned to Almaris &amp; Shelves</span>
            </span>
          </div>
        ) : null}

        {/* =====================================================================
            MODE 1: ALL ALMARIS OVERVIEW GRID (selectedAlmari === null)
           ===================================================================== */}
        {!selectedAlmari ? (
          almaris.length === 0 ? (
            /* High-Contrast Empty State when 0 Manual Almaris exist */
            <div className="bg-white/85 dark:bg-[#161024]/85 backdrop-blur-2xl border border-[#C8963E]/35 dark:border-white/10 rounded-2xl p-8 sm:p-12 text-center space-y-4 shadow-sm">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-[#F5E1B0] to-[#EBC97E] dark:from-[#541A72]/60 dark:to-[#3B1054]/60 border-2 border-[#C8963E]/60 dark:border-[#FFD147]/40 flex items-center justify-center text-[#5E3200] dark:text-[#FFD147] shadow-md">
                <Building2 className="w-8 h-8 stroke-[2]" />
              </div>
              <div className="space-y-1.5 max-w-lg mx-auto">
                <h3 className="text-xl font-display font-extrabold text-slate-900 dark:text-white">
                  No Manual Almaris Created Yet (کوئی الماری موجود نہیں)
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  All pre-seeded dummy Almaris and automatic shelf optimizations are disabled. Click below to create your first physical Almari (e.g. <span className="font-mono font-bold text-[#8A4B00] dark:text-[#FFD147]">A-01</span>) with custom shelf counts and capacities.
                </p>
              </div>
              <div className="pt-2 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setAlmariToEdit(null);
                    setIsAddEditOpen(true);
                  }}
                  className="bg-gradient-to-r from-[#8E4F0B] via-[#B4690E] to-[#CE851D] hover:from-[#7A4207] hover:to-[#B57214] !text-white font-extrabold px-6 py-3 rounded-xl text-sm inline-flex items-center gap-2 shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer border border-[#E7BC61]/60"
                >
                  <Plus className="w-4 h-4 stroke-[2.5] !text-white" />
                  <span className="!text-white">+ Add Your First Almari</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredAlmaris.map(alm => {
                const almBooks = booksByAlmariId.get(alm.id) || [];
                const totalCapacity = Math.max(alm.shelf_count * (alm.books_per_shelf || 30), almBooks.length || 150);
                const loadPct = Math.min(100, Math.round((almBooks.length / totalCapacity) * 100));
                const availableInAlm = almBooks.filter(b => b.book.available_quantity > 0).length;
                const onLoanInAlm = almBooks.length - availableInAlm;

                // Collect distinct discipline groups configured or present in this Almari
                const almGroupMap = new Map<string, { name: string; color: string; count: number }>();
                for (const item of almBooks) {
                  const gId = item.placement.group_id;
                  const existing = almGroupMap.get(gId) || {
                    name: item.placement.group_name_en,
                    color: item.placement.group_color,
                    count: 0,
                  };
                  existing.count += 1;
                  almGroupMap.set(gId, existing);
                }
                if (almGroupMap.size === 0) {
                  for (const g of AlmariService.getGroupsForAlmari(alm.id)) {
                    almGroupMap.set(g.id, { name: g.name_en, color: g.color, count: 0 });
                  }
                }
                const activeGroupsInAlmari = Array.from(almGroupMap.values()).sort((a, b) => b.count - a.count);

                return (
                  <div
                    key={alm.id}
                    onClick={() => {
                      setSelectedAlmariId(alm.id);
                      setSelectedShelfFilter(null);
                      setSelectedBookId(null);
                      setTablePage(1);
                    }}
                    className="bg-white/85 dark:bg-[#140D22]/85 backdrop-blur-xl border border-[#C8963E]/35 dark:border-white/10 hover:border-[#C8963E] rounded-2xl p-5 shadow-[0_8px_24px_-6px_rgba(30,20,43,0.07)] hover:shadow-[0_14px_32px_-8px_rgba(180,105,14,0.18)] transition-all duration-200 flex flex-col justify-between gap-4 cursor-pointer group"
                  >
                    {/* Top Header of Almari Card */}
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="px-3.5 py-2 rounded-xl bg-gradient-to-br from-[#F5E1B0] to-[#EBC97E] dark:from-[#541A72] dark:to-[#3B1054] border border-[#C8963E]/60 dark:border-[#FFD147]/40 text-[#5E3200] dark:text-[#FFD147] font-mono font-extrabold text-base shrink-0 shadow-2xs">
                            {alm.code}
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white truncate group-hover:text-[#8A4B00] dark:group-hover:text-[#FFD147] transition-colors">
                              {alm.name_en}
                            </h3>
                            <p className="text-xs font-bold text-amber-800 dark:text-[#FFD147]/80 font-urdu truncate" dir="auto">
                              {alm.name_ur} {alm.notes ? `· ${alm.notes}` : ''}
                            </p>
                          </div>
                        </div>

                        {/* Volume Count Pill */}
                        <div className="text-right shrink-0">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-mono font-extrabold bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">
                            {almBooks.length.toLocaleString()} Books
                          </span>
                          <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                            {availableInAlm.toLocaleString()} Avail · {onLoanInAlm} Loaned
                          </span>
                        </div>
                      </div>

                      {/* Discipline Group Chips inside this Almari */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {activeGroupsInAlmari.slice(0, 4).map((g, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-slate-200 border border-slate-200/90 dark:border-white/10"
                          >
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
                            <span>{g.name}</span>
                            <span className="font-mono text-[10px] opacity-75">({g.count})</span>
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Mini Visual Shelf Rack Preview Box (High Contrast in Light & Dark Mode) */}
                    <div className="bg-slate-50/90 dark:bg-[#0D0917]/80 border border-slate-200/80 dark:border-white/10 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                        <span>SHELF RACK INSPECTOR ({alm.shelf_count} SHELVES)</span>
                        <span className="font-mono text-[#8A4B00] dark:text-[#FFD147]">{loadPct}% Active Load</span>
                      </div>

                      <div className="space-y-1.5">
                        {Array.from({ length: alm.shelf_count }, (_, idx) => idx + 1).map(shelfNo => {
                          const shelfBooks = almBooks.filter(b => b.placement.shelf_no === shelfNo);
                          return (
                            <div
                              key={shelfNo}
                              onClick={e => {
                                e.stopPropagation();
                                setSelectedAlmariId(alm.id);
                                setSelectedShelfFilter(shelfNo);
                                setTablePage(1);
                              }}
                              className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-white/90 dark:bg-[#160F26] border border-slate-200/80 dark:border-white/10 hover:border-[#C8963E] transition-colors"
                            >
                              <span className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300 w-16 shrink-0">
                                Shelf {shelfNo}
                              </span>

                              {/* Mini colored spine bars */}
                              <div className="flex-1 flex items-center gap-[3px] h-3.5 overflow-hidden">
                                {shelfBooks.slice(0, 24).map(({ book, placement }) => (
                                  <span
                                    key={book.id}
                                    className="w-1.5 h-full rounded-[1px] shrink-0"
                                    style={{ backgroundColor: placement.group_color || '#C8963E' }}
                                  />
                                ))}
                                {shelfBooks.length === 0 && (
                                  <span className="text-[10px] text-slate-400 italic">Empty shelf</span>
                                )}
                              </div>

                              <span className="text-[11px] font-mono font-extrabold text-slate-900 dark:text-white shrink-0">
                                {shelfBooks.length} bks
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Card Footer Action Row */}
                    <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-200/70 dark:border-white/10">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            setAlmariToEdit(alm);
                            setIsAddEditOpen(true);
                          }}
                          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/15 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-white/10 transition-colors cursor-pointer shrink-0"
                          title="Edit Almari Settings"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            setAlmariToDelete(alm);
                            setIsDeleteModalOpen(true);
                          }}
                          className="p-2 rounded-xl bg-rose-50 hover:bg-rose-600 text-rose-700 hover:!text-white dark:bg-rose-950/40 dark:hover:bg-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50 transition-colors cursor-pointer shrink-0"
                          title="Delete Almari"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            openManualAssignModal(alm.id, 1);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-[#8A4B00] dark:text-[#FFD147] border border-[#C8963E]/40 text-[11px] font-extrabold cursor-pointer whitespace-nowrap shrink-0"
                          title="Manually assign books to this Almari"
                        >
                          + Assign Books
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          setSelectedAlmariId(alm.id);
                          setSelectedShelfFilter(null);
                          setTablePage(1);
                        }}
                        className="px-4 py-2 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 bg-[#541A72]/10 hover:bg-[#541A72] text-[#541A72] hover:!text-white dark:bg-[#FFD147]/15 dark:text-[#FFD147] dark:hover:bg-[#FFD147] dark:hover:!text-slate-950 border border-[#541A72]/20 dark:border-[#FFD147]/30 transition-all cursor-pointer"
                      >
                        <span>Open Shelves</span>
                        <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          /* =====================================================================
              MODE 2: SINGLE ALMARI INSPECTOR (3D Interactive Book Spines + Table)
             ===================================================================== */
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* Inspector Top Bar */}
            <div className="bg-white/85 dark:bg-[#140D22]/85 backdrop-blur-2xl border border-[#C8963E]/45 dark:border-white/15 rounded-2xl p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAlmariId(null);
                    setSelectedShelfFilter(null);
                    setSelectedBookId(null);
                  }}
                  className="h-10 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-900 dark:text-white border border-slate-300 dark:border-white/15 text-xs font-extrabold flex items-center gap-2 cursor-pointer transition-all"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>All Almaris</span>
                </button>

                <div className="px-3.5 py-2 rounded-xl bg-gradient-to-br from-[#F5E1B0] to-[#EBC97E] dark:from-[#541A72] dark:to-[#3B1054] border border-[#C8963E]/60 text-[#5E3200] dark:text-[#FFD147] font-mono font-extrabold text-base">
                  {selectedAlmari.code}
                </div>

                <div>
                  <h3 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5 flex-wrap">
                    <span>{selectedAlmari.name_en}</span>
                    <span className="text-sm font-urdu text-[#8A4B00] dark:text-[#FFD147]" dir="auto">
                      ({selectedAlmari.name_ur})
                    </span>
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {selectedAlmariEnrichedBooks.length.toLocaleString()} volumes manually housed across {selectedAlmari.shelf_count} physical shelves
                    {selectedAlmari.notes ? ` · ${selectedAlmari.notes}` : ''}
                  </p>
                </div>
              </div>

              {/* Right: ONLY Assigned Discipline Badges + Assign Books + Edit & High-Contrast Delete Almari */}
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap mr-1">
                  {selectedAlmariDisciplineGroups.map(grp => (
                    <span
                      key={grp.id}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white border border-slate-200 dark:border-white/15"
                    >
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: grp.color }} />
                      <span>{grp.name_en}</span>
                    </span>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => openManualAssignModal(selectedAlmari.id, selectedShelfFilter || 1)}
                  className="h-9 px-3.5 rounded-xl bg-gradient-to-r from-[#8E4F0B] via-[#B4690E] to-[#CE851D] !text-white text-xs font-extrabold flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 !text-white" />
                  <span className="!text-white">Assign Books to {selectedAlmari.code}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAlmariToEdit(selectedAlmari);
                    setIsAddEditOpen(true);
                  }}
                  className="h-9 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-white border border-slate-300 dark:border-white/15 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Almari</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAlmariToDelete(selectedAlmari);
                    setIsDeleteModalOpen(true);
                  }}
                  className="h-9 px-3.5 rounded-xl bg-rose-50 hover:bg-rose-600 text-rose-700 hover:!text-white dark:bg-rose-950/40 dark:hover:bg-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Almari</span>
                </button>
              </div>
            </div>

            {/* Selected Spine Quick Inspector Drawer (when a 3D spine is clicked) */}
            {selectedBookItem && (
              <div className="bg-white/95 dark:bg-[#181028]/95 backdrop-blur-2xl border-2 border-[#C8963E] rounded-2xl p-4 shadow-lg flex flex-wrap items-center justify-between gap-4 animate-in fade-in">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className="w-10 h-14 rounded-md flex items-center justify-center text-white font-mono text-xs font-extrabold shadow-sm shrink-0 border border-white/30"
                    style={{ backgroundColor: selectedBookItem.placement.group_color }}
                  >
                    {selectedBookItem.placement.almari_code}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono font-extrabold bg-amber-500/15 text-[#8A4B00] dark:text-[#FFD147] border border-[#C8963E]/40">
                        {selectedBookItem.placement.almari_code} · Shelf {selectedBookItem.placement.shelf_no}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-slate-200">
                        {selectedBookItem.placement.group_name_en}
                      </span>
                      <span className="font-mono text-xs font-bold text-slate-600 dark:text-slate-300">
                        #{selectedBookItem.book.accession_no || selectedBookItem.book.barcode}
                      </span>
                    </div>
                    <h4 className="text-base font-extrabold text-slate-900 dark:text-white truncate mt-1">
                      {selectedBookItem.book.book_name}
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 truncate">
                      by <strong>{selectedBookItem.book.author}</strong> · Call #: <span className="font-mono">{selectedBookItem.book.dewey_call_number}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => onOpenBook(selectedBookItem.book)}
                    className="h-9 px-3.5 rounded-xl bg-[#541A72] hover:bg-[#3B1054] !text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Open Full Details</span>
                  </button>
                  {onEditBook && (
                    <button
                      type="button"
                      onClick={() => onEditBook(selectedBookItem.book)}
                      className="h-9 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 text-slate-800 dark:text-white border border-slate-300 dark:border-white/15 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit Record</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setTargetMoveAlmariId(selectedBookItem.placement.almari_id);
                      setTargetMoveShelfNo(selectedBookItem.placement.shelf_no);
                      setIsMovePanelOpen(!isMovePanelOpen);
                    }}
                    className="h-9 px-3.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-[#8A4B00] dark:text-[#FFD147] border border-[#C8963E]/40 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                  >
                    <MoveRight className="w-3.5 h-3.5" />
                    <span>Relocate Shelf</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedBookId(null);
                      setIsMovePanelOpen(false);
                    }}
                    className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Inline Relocate Shelf Selector */}
                {isMovePanelOpen && (
                  <div className="w-full pt-3 mt-2 border-t border-slate-200 dark:border-white/10 flex flex-wrap items-center gap-3">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Move to Almari:</span>
                    <select
                      value={targetMoveAlmariId}
                      onChange={e => setTargetMoveAlmariId(e.target.value)}
                      className="h-9 px-3 rounded-xl bg-white dark:bg-[#0B1220] border border-slate-300 dark:border-white/15 text-xs font-bold text-slate-900 dark:text-white"
                    >
                      {almaris.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.code} — {a.name_en}
                        </option>
                      ))}
                    </select>

                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Shelf #:</span>
                    <select
                      value={targetMoveShelfNo}
                      onChange={e => setTargetMoveShelfNo(Number(e.target.value))}
                      className="h-9 px-3 rounded-xl bg-white dark:bg-[#0B1220] border border-slate-300 dark:border-white/15 text-xs font-bold text-slate-900 dark:text-white"
                    >
                      {Array.from(
                        { length: almarisMap.get(targetMoveAlmariId)?.shelf_count || selectedAlmari.shelf_count || 5 },
                        (_, idx) => idx + 1
                      ).map(n => (
                        <option key={n} value={n}>
                          Shelf {n}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={handleConfirmMoveBook}
                      className="h-9 px-4 rounded-xl bg-gradient-to-r from-[#8E4F0B] to-[#CE851D] !text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Confirm Move</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* VISUAL SHELF RACK: Interactive 3D Color-Coded Spines */}
            <div className="space-y-4">
              {Array.from({ length: selectedAlmari.shelf_count }, (_, idx) => idx + 1).map(shelfNo => {
                const shelfBooks = selectedAlmariEnrichedBooks.filter(b => b.placement.shelf_no === shelfNo);
                const isShelfSelected = selectedShelfFilter === shelfNo;
                const maxVisibleSpines = 35;
                const visibleSpines = shelfBooks.slice(0, maxVisibleSpines);
                const overflowCount = Math.max(0, shelfBooks.length - maxVisibleSpines);

                // Compact sleek h-14 (56px) bar when shelf has 0 books
                if (shelfBooks.length === 0) {
                  return (
                    <div
                      key={shelfNo}
                      className="h-14 px-5 rounded-2xl bg-white/85 dark:bg-[#140D22]/75 border border-slate-200/90 dark:border-white/10 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <span className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-slate-200 font-mono text-xs font-extrabold">
                          {selectedAlmari.code} · Shelf {shelfNo}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 italic">
                          Empty shelf (0 books manually assigned)
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {selectedCatalogBooks.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setPasteTargetAlmariId(selectedAlmari.id);
                              setPasteTargetShelfNo(shelfNo);
                              setIsPasteBulkModalOpen(true);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-[#541A72]/15 text-[#541A72] dark:bg-[#FFD147]/20 dark:text-[#FFD147] border border-[#541A72]/30 dark:border-[#FFD147]/40 text-xs font-extrabold cursor-pointer"
                          >
                            + Place {selectedCatalogBooks.length} Selected Here
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openManualAssignModal(selectedAlmari.id, shelfNo)}
                          className="px-3.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-[#8A4B00] dark:text-[#FFD147] border border-[#C8963E]/45 text-xs font-extrabold cursor-pointer transition-colors"
                        >
                          + Assign Books to Shelf {shelfNo}
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={shelfNo}
                    className={`rounded-2xl bg-white/85 dark:bg-[#140D22]/85 backdrop-blur-xl border transition-all p-4 space-y-3 ${
                      isShelfSelected
                        ? 'border-2 border-[#C8963E] shadow-md'
                        : 'border-slate-200/90 dark:border-white/10 shadow-xs'
                    }`}
                  >
                    {/* Shelf Header Row */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedShelfFilter(isShelfSelected ? null : shelfNo);
                            setTablePage(1);
                          }}
                          className={`px-3.5 py-1 rounded-xl font-mono text-xs font-extrabold border transition-colors cursor-pointer ${
                            isShelfSelected
                              ? 'bg-[#541A72] !text-white border-[#FFD147]/60'
                              : 'bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white border-slate-300 dark:border-white/15'
                          }`}
                        >
                          {selectedAlmari.code} · SHELF {shelfNo}
                        </button>
                        <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200">
                          {shelfBooks.length.toLocaleString()} Volumes on Shelf {shelfNo}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => openManualAssignModal(selectedAlmari.id, shelfNo)}
                          className="px-3 py-1 rounded-xl text-xs font-extrabold bg-amber-500/15 hover:bg-amber-500/25 text-[#8A4B00] dark:text-[#FFD147] border border-[#C8963E]/40 cursor-pointer transition-colors"
                        >
                          + Add Books to Shelf {shelfNo}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedShelfFilter(isShelfSelected ? null : shelfNo);
                            setTablePage(1);
                          }}
                          className="px-3 py-1 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-white/10 text-slate-800 dark:text-slate-200 cursor-pointer"
                        >
                          {isShelfSelected ? 'Showing Shelf in Table ✓' : 'Filter Table to Shelf ↓'}
                        </button>
                      </div>
                    </div>

                    {/* 3D Bookcase Shelf Plank & Interactive Book Spines */}
                    <div className="pt-4 pb-2 px-4 rounded-xl bg-gradient-to-b from-slate-100/90 to-slate-200/75 dark:from-[#0B0714] dark:to-[#130C21] border border-slate-300/70 dark:border-white/10 relative">
                      <div className="flex items-end gap-1.5 flex-wrap min-h-[116px]">
                        {visibleSpines.map(({ book, placement }) => {
                          const isAvailable = book.available_quantity > 0;
                          const isSelectedSpine = selectedBookId === book.id;
                          const shortLabel = (book.accession_no || book.barcode || book.book_name || 'ULM').slice(-9);

                          return (
                            <div
                              key={book.id}
                              onClick={() => setSelectedBookId(book.id)}
                              style={{
                                backgroundColor: placement.group_color || '#6D28D9',
                              }}
                              className={`w-7 sm:w-8 h-28 rounded-t-[4px] rounded-b-[2px] cursor-pointer hover:-translate-y-2 hover:scale-105 hover:z-20 transition-all duration-150 shadow-[2px_4px_8px_rgba(0,0,0,0.28)] border-l border-white/25 relative group flex flex-col items-center justify-between py-1.5 select-none ${
                                isSelectedSpine ? 'ring-2 ring-[#FFD147] -translate-y-2 z-20' : ''
                              }`}
                            >
                              {/* Top 24K Gold Foil Band */}
                              <div className="w-full h-[3px] bg-gradient-to-r from-[#D4AF37] via-[#FFF3B0] to-[#AA7C11] opacity-85 shrink-0" />

                              {/* Availability Status Dot */}
                              <span
                                className={`w-2 h-2 rounded-full border border-black/30 shrink-0 ${
                                  isAvailable ? 'bg-emerald-400' : 'bg-amber-300'
                                }`}
                              />

                              {/* Vertical Rotated Spine Label */}
                              <span
                                style={{ writingMode: 'vertical-rl' }}
                                className="text-[9px] font-mono font-extrabold text-white tracking-tighter truncate max-h-[68px] drop-shadow-[0_1px_1px_rgba(0,0,0,0.65)]"
                              >
                                {shortLabel}
                              </span>

                              {/* Bottom 24K Gold Foil Band */}
                              <div className="w-full h-[3px] bg-gradient-to-r from-[#D4AF37] via-[#FFF3B0] to-[#AA7C11] opacity-85 shrink-0" />

                              {/* Rich Hover Tooltip */}
                              <div className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 rounded-xl bg-[#140D22]/98 text-white border border-[#FFD147]/50 shadow-2xl z-40 text-left space-y-1">
                                <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-[#FFD147]">
                                  <span>{placement.almari_code} · Shelf {placement.shelf_no}</span>
                                  <span>#{book.accession_no || book.barcode}</span>
                                </div>
                                <p className="text-xs font-extrabold text-white line-clamp-2 leading-snug">
                                  {book.book_name}
                                </p>
                                <p className="text-[11px] text-slate-300 truncate">
                                  by {book.author}
                                </p>
                                <div className="pt-1 border-t border-white/15 flex items-center justify-between text-[10px]">
                                  <span className="font-semibold text-amber-300">{placement.group_name_en}</span>
                                  <span className={isAvailable ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                                    {isAvailable ? `${book.available_quantity} Available` : 'On Loan'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {/* Overflow Pill Button when > 35 books on shelf */}
                        {overflowCount > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedShelfFilter(shelfNo);
                              setTablePage(1);
                            }}
                            className="h-28 px-3 rounded-t-md bg-white/90 dark:bg-[#1E1430] hover:bg-[#541A72] text-slate-900 dark:text-[#FFD147] hover:!text-white border border-[#C8963E]/50 text-xs font-extrabold flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors shadow-sm"
                          >
                            <span className="font-mono text-sm">+{overflowCount}</span>
                            <span className="text-[10px] leading-tight text-center">more books<br />on Shelf {shelfNo} ↓</span>
                          </button>
                        )}
                      </div>

                      {/* Physical Wooden/Metallic Shelf Ledge */}
                      <div className="w-full h-2.5 mt-0.5 rounded-full bg-gradient-to-r from-[#8E4F0B] via-[#C8963E] to-[#8E4F0B] shadow-inner" />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ALL BOOKS IN THIS ALMARI TABLE (With Book Group Badges & 1-Click Manual Shelf / Unassign Dropdown) */}
            <div className="bg-white/85 dark:bg-[#140D22]/85 backdrop-blur-2xl border border-slate-200/90 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                    All Books in {selectedAlmari.code} ({selectedAlmari.name_en})
                  </h4>
                  {selectedShelfFilter !== null && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-[#541A72] text-white">
                      Filtered: Shelf {selectedShelfFilter}
                    </span>
                  )}
                  <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
                    ({inspectorTableBooks.length.toLocaleString()} volumes)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {selectedShelfFilter !== null && (
                    <button
                      type="button"
                      onClick={() => setSelectedShelfFilter(null)}
                      className="text-xs font-extrabold text-[#8A4B00] dark:text-[#FFD147] hover:underline cursor-pointer"
                    >
                      Show All {selectedAlmari.shelf_count} Shelves
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => openManualAssignModal(selectedAlmari.id, selectedShelfFilter || 1)}
                    className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-[#8A4B00] dark:text-[#FFD147] border border-[#C8963E]/40 text-xs font-extrabold cursor-pointer"
                  >
                    + Assign Books Here
                  </button>
                </div>
              </div>

              {inspectorTableBooks.length === 0 ? (
                <div className="p-8 text-center space-y-3">
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    No books are currently assigned to {selectedAlmari.code}
                    {selectedShelfFilter ? ` · Shelf ${selectedShelfFilter}` : ''}.
                  </p>
                  <button
                    type="button"
                    onClick={() => openManualAssignModal(selectedAlmari.id, selectedShelfFilter || 1)}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#8E4F0B] via-[#B4690E] to-[#CE851D] !text-white text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5 !text-white" />
                    <span className="!text-white">Manually Assign Books to {selectedAlmari.code}</span>
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-800 dark:text-slate-200">
                    <thead className="bg-slate-100/90 dark:bg-black/35 text-slate-700 dark:text-slate-300 uppercase font-mono text-[11px] border-b border-slate-200 dark:border-white/10">
                      <tr>
                        <th className="py-3 px-4">Accession / Barcode</th>
                        <th className="py-3 px-4">Book Title &amp; Author</th>
                        <th className="py-3 px-4">Book Group</th>
                        <th className="py-3 px-4">Manual Shelf Assignment</th>
                        <th className="py-3 px-4">Dewey Call #</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/70 dark:divide-white/5">
                      {paginatedTableBooks.map(({ book, placement }) => {
                        const isAvail = book.available_quantity > 0;
                        const bookGroupLabel =
                          (book as any).group ||
                          (book as any).discipline ||
                          book.category ||
                          placement.group_name_en ||
                          'Unassigned';
                        return (
                          <tr
                            key={book.id}
                            className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                          >
                            <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                              {book.accession_no || book.barcode}
                            </td>
                            <td className="py-3 px-4">
                              <p
                                onClick={() => onOpenBook(book)}
                                className="font-bold text-slate-900 dark:text-white hover:text-[#8A4B00] dark:hover:text-[#FFD147] cursor-pointer truncate max-w-md"
                              >
                                {book.book_name}
                              </p>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                {book.author}
                              </p>
                            </td>
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10">
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: placement.group_color }}
                                />
                                <span>{bookGroupLabel}</span>
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              {/* 1-Click Manual Shelf / Unassign Dropdown */}
                              <select
                                value={String(placement.shelf_no || 1)}
                                onChange={e => handleInlineRowShelfChange(book, e.target.value)}
                                className="h-8 px-2.5 rounded-lg font-mono text-xs font-extrabold bg-amber-500/15 text-[#8A4B00] dark:text-[#FFD147] border border-[#C8963E]/45 focus:outline-none focus:border-[#B4690E] cursor-pointer"
                                title="Change shelf or unassign book from this Almari"
                              >
                                {Array.from({ length: selectedAlmari.shelf_count }, (_, idx) => idx + 1).map(sNo => (
                                  <option
                                    key={sNo}
                                    value={String(sNo)}
                                    className="bg-white dark:bg-[#140D22] text-slate-900 dark:text-white"
                                  >
                                    {selectedAlmari.code} · Shelf {sNo}
                                  </option>
                                ))}
                                <option
                                  value="UNASSIGN"
                                  className="bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-bold"
                                >
                                  ✕ Unassign from {selectedAlmari.code}
                                </option>
                              </select>
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">
                              {book.dewey_call_number}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                  isAvail
                                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                                    : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                                }`}
                              >
                                {isAvail ? `${book.available_quantity} Avail` : 'On Loan'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => onOpenBook(book)}
                                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/10 text-slate-800 dark:text-white text-xs font-bold cursor-pointer"
                                >
                                  Details
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedBookId(book.id);
                                    setTargetMoveAlmariId(placement.almari_id);
                                    setTargetMoveShelfNo(placement.shelf_no);
                                    setIsMovePanelOpen(true);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-[#8A4B00] dark:text-[#FFD147] text-xs font-bold cursor-pointer"
                                >
                                  Move Almari
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Table Pagination Footer */}
              {totalTablePages > 1 && (
                <div className="p-3.5 border-t border-slate-200 dark:border-white/10 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                  <span>
                    Page <strong>{safeTablePage}</strong> of <strong>{totalTablePages}</strong> ({inspectorTableBooks.length.toLocaleString()} books)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={safeTablePage <= 1}
                      onClick={() => setTablePage(p => Math.max(1, p - 1))}
                      className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white font-bold disabled:opacity-40 cursor-pointer"
                    >
                      ‹ Prev
                    </button>
                    <button
                      type="button"
                      disabled={safeTablePage >= totalTablePages}
                      onClick={() => setTablePage(p => Math.min(totalTablePages, p + 1))}
                      className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white font-bold disabled:opacity-40 cursor-pointer"
                    >
                      Next ›
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* MANUAL ASSIGN BOOKS TO ALMARI & SHELF MODAL */}
        {isManualAssignOpen && (
          <div
            className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-150"
            onClick={() => setIsManualAssignOpen(false)}
          >
            <div
              onClick={e => e.stopPropagation()}
              className="w-full max-w-3xl bg-white/95 dark:bg-[#140D22]/95 backdrop-blur-2xl border-2 border-[#C8963E]/60 dark:border-white/15 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-900 dark:text-white"
            >
              {/* Header */}
              <div className="px-6 py-4 bg-slate-50/95 dark:bg-[#1C122E] border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F5E1B0] to-[#EBC97E] dark:from-[#541A72] dark:to-[#3B1054] border border-[#C8963E]/60 flex items-center justify-center text-[#5E3200] dark:text-[#FFD147]">
                    <Inbox className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                      Manually Assign Books to Almari &amp; Shelf
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Select target cupboard &amp; shelf, then pick specific books or enter an accession range.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsManualAssignOpen(false)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/10 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto space-y-5 flex-1">
                {/* Target Almari & Shelf Selectors */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50/90 dark:bg-black/30 border border-slate-200 dark:border-white/10">
                  <div>
                    <label className="block text-xs font-extrabold text-[#8A4B00] dark:text-[#FFD147] mb-1">
                      1. Target Almari (الماری) *
                    </label>
                    <select
                      value={manualTargetAlmariId}
                      onChange={e => {
                        setManualTargetAlmariId(e.target.value);
                        setManualTargetShelfNo(1);
                      }}
                      className="w-full h-10 px-3 rounded-xl bg-white dark:bg-[#0B1220] border border-slate-300 dark:border-white/15 text-xs sm:text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-[#B4690E]"
                    >
                      {almaris.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.code} — {a.name_en} ({a.name_ur})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-[#8A4B00] dark:text-[#FFD147] mb-1">
                      2. Target Shelf Level *
                    </label>
                    <select
                      value={manualTargetShelfNo}
                      onChange={e => setManualTargetShelfNo(Number(e.target.value))}
                      className="w-full h-10 px-3 rounded-xl bg-white dark:bg-[#0B1220] border border-slate-300 dark:border-white/15 text-xs sm:text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-[#B4690E]"
                    >
                      {Array.from(
                        { length: almarisMap.get(manualTargetAlmariId)?.shelf_count || 5 },
                        (_, idx) => idx + 1
                      ).map(sNo => (
                        <option key={sNo} value={sNo}>
                          Shelf {sNo}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Mode Switch Tabs */}
                <div className="flex items-center gap-2 border-b border-slate-200 dark:border-white/10 pb-3">
                  <button
                    type="button"
                    onClick={() => setManualAssignTab('pick')}
                    className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer border ${
                      manualAssignTab === 'pick'
                        ? 'bg-[#541A72] !text-white border-[#FFD147]/60 shadow-xs'
                        : 'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10'
                    }`}
                  >
                    Select Specific Books ({manualCheckedBookIds.size} checked)
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualAssignTab('range')}
                    className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer border ${
                      manualAssignTab === 'range'
                        ? 'bg-[#541A72] !text-white border-[#FFD147]/60 shadow-xs'
                        : 'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10'
                    }`}
                  >
                    Assign by Accession / Barcode Range
                  </button>
                </div>

                {manualAssignTab === 'pick' ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <div className="relative flex-1 min-w-[220px]">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={manualPickerSearch}
                          onChange={e => setManualPickerSearch(e.target.value)}
                          placeholder="Search by title, author, accession #, or barcode..."
                          style={{ paddingLeft: '2.5rem' }}
                          className="w-full h-9 pl-10 pr-3 rounded-xl bg-white dark:bg-[#0B1220] border border-slate-300 dark:border-white/15 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#B4690E]"
                        />
                      </div>

                      <select
                        value={manualPickerGroupFilter}
                        onChange={e => setManualPickerGroupFilter(e.target.value)}
                        className="h-9 px-3 rounded-xl bg-white dark:bg-[#0B1220] border border-slate-300 dark:border-white/15 text-xs font-bold text-slate-900 dark:text-white"
                      >
                        <option value="ALL">All Disciplines</option>
                        {groups.map(g => (
                          <option key={g.id} value={g.id}>
                            {g.name_en}
                          </option>
                        ))}
                      </select>

                      <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={manualPickerOnlyUnassigned}
                          onChange={e => setManualPickerOnlyUnassigned(e.target.checked)}
                          className="accent-[#B4690E] rounded"
                        />
                        <span>Unassigned only</span>
                      </label>

                      <button
                        type="button"
                        onClick={() => {
                          const next = new Set(manualCheckedBookIds);
                          manualPickerCandidates.forEach(c => next.add(c.book.id));
                          setManualCheckedBookIds(next);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/10 text-xs font-bold text-slate-800 dark:text-white cursor-pointer"
                      >
                        Select Shown ({manualPickerCandidates.length})
                      </button>
                    </div>

                    <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-200 dark:border-white/10 divide-y divide-slate-200/70 dark:divide-white/5 bg-white dark:bg-[#0B1220]">
                      {manualPickerCandidates.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-500">
                          No matching books found. Try unchecking &ldquo;Unassigned only&rdquo; or clearing the search filter.
                        </div>
                      ) : (
                        manualPickerCandidates.map(({ book, placement }) => {
                          const isChecked = manualCheckedBookIds.has(book.id);
                          return (
                            <div
                              key={book.id}
                              onClick={() => {
                                const next = new Set(manualCheckedBookIds);
                                if (isChecked) next.delete(book.id);
                                else next.add(book.id);
                                setManualCheckedBookIds(next);
                              }}
                              className={`px-3.5 py-2.5 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                                isChecked
                                  ? 'bg-amber-500/15 dark:bg-amber-500/20'
                                  : 'hover:bg-slate-50 dark:hover:bg-white/5'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                {isChecked ? (
                                  <CheckSquare className="w-4 h-4 text-[#B4690E] dark:text-[#FFD147] shrink-0" />
                                ) : (
                                  <Square className="w-4 h-4 text-slate-400 shrink-0" />
                                )}
                                <span className="font-mono text-xs font-extrabold text-[#8A4B00] dark:text-[#FFD147] shrink-0">
                                  #{book.accession_no || book.barcode}
                                </span>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                    {book.book_name}
                                  </p>
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                    {book.author} · {placement.group_name_en}
                                  </p>
                                </div>
                              </div>
                              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 shrink-0">
                                {placement.almari_id
                                  ? `${placement.almari_code} · Shelf ${placement.shelf_no}`
                                  : 'Unassigned'}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 p-4 rounded-xl bg-slate-50/90 dark:bg-black/30 border border-slate-200 dark:border-white/10">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                          From Accession # or Barcode
                        </label>
                        <input
                          type="text"
                          value={manualRangeFrom}
                          onChange={e => setManualRangeFrom(e.target.value)}
                          placeholder="e.g. 1 or ULM-00001"
                          className="w-full h-10 px-3 rounded-xl bg-white dark:bg-[#0B1220] border border-slate-300 dark:border-white/15 font-mono text-xs font-bold text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                          To Accession # or Barcode
                        </label>
                        <input
                          type="text"
                          value={manualRangeTo}
                          onChange={e => setManualRangeTo(e.target.value)}
                          placeholder="e.g. 50 or ULM-00050"
                          className="w-full h-10 px-3 rounded-xl bg-white dark:bg-[#0B1220] border border-slate-300 dark:border-white/15 font-mono text-xs font-bold text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                      <span>Matching catalog volumes in range:</span>
                      <span className="font-mono text-sm">{manualRangeCandidates.length.toLocaleString()} books</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-slate-50/95 dark:bg-[#1C122E] border-t border-slate-200 dark:border-white/10 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsManualAssignOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-200/80 hover:bg-slate-300/80 dark:bg-white/10 dark:hover:bg-white/15 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleConfirmManualAssignModal}
                  disabled={
                    !manualTargetAlmariId ||
                    (manualAssignTab === 'pick' ? manualCheckedBookIds.size === 0 : manualRangeCandidates.length === 0)
                  }
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#8E4F0B] via-[#B4690E] to-[#CE851D] !text-white text-xs font-extrabold flex items-center gap-2 shadow-md disabled:opacity-40 cursor-pointer"
                >
                  <Check className="w-4 h-4 !text-white" />
                  <span className="!text-white">
                    Assign{' '}
                    {manualAssignTab === 'pick'
                      ? manualCheckedBookIds.size.toLocaleString()
                      : manualRangeCandidates.length.toLocaleString()}{' '}
                    Book(s) to {almarisMap.get(manualTargetAlmariId)?.code || 'Almari'} · Shelf {manualTargetShelfNo}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add / Edit Almari Modal */}
        {isAddEditOpen && (
          <AddEditAlmariModal
            isOpen={isAddEditOpen}
            almariToEdit={almariToEdit}
            onClose={() => {
              setIsAddEditOpen(false);
              setAlmariToEdit(null);
            }}
            onSaved={(savedAlmari, message, batchId, updatedCatalog) => {
              setIsAddEditOpen(false);
              setAlmariToEdit(null);
              setAlmarisVersion(v => v + 1);
              onReloadAlmaris?.();
              if (updatedCatalog && updatedCatalog.length > 0) {
                persistManualBookShelfAssignments(updatedCatalog);
                if (onCatalogBooksUpdated) {
                  onCatalogBooksUpdated(updatedCatalog, message, batchId);
                }
              }
              showToast(message || `Saved Almari ${savedAlmari.code} (${savedAlmari.name_en})`);
            }}
          />
        )}

        {/* Delete Almari Confirmation Modal */}
        {isDeleteModalOpen && almariToDelete && (
          <DeleteAlmariModal
            isOpen={isDeleteModalOpen}
            almari={almariToDelete}
            allBooks={books}
            onClose={() => {
              setIsDeleteModalOpen(false);
              setAlmariToDelete(null);
            }}
            onConfirmDelete={(almId, action, targetAlmId) => {
              setIsDeleteModalOpen(false);
              setAlmariToDelete(null);
              const res = AlmariService.softDeleteAlmari(almId, action, targetAlmId, books);
              if (res.success) {
                if (selectedAlmariId === almId) {
                  setSelectedAlmariId(null);
                }
                setAlmarisVersion(v => v + 1);
                onReloadAlmaris?.();
                persistManualBookShelfAssignments(res.updatedBooks);
                if (onCatalogBooksUpdated) {
                  onCatalogBooksUpdated(res.updatedBooks, res.message, res.batchId);
                }
                showToast(res.message);
              }
            }}
          />
        )}

        {/* Bulk Assign Modal for Placing Selected Catalog Books */}
        {isPasteBulkModalOpen && (
          <BulkAssignModal
            isOpen={isPasteBulkModalOpen}
            onClose={() => setIsPasteBulkModalOpen(false)}
            selectedBooks={selectedCatalogBooks}
            allBooks={books}
            mode="assign_almari"
            initialAlmariId={pasteTargetAlmariId}
            initialShelfNo={pasteTargetShelfNo}
            onComplete={(updatedSlice, msg, batchId) => {
              setIsPasteBulkModalOpen(false);
              onClearCatalogSelection?.();
              const sliceMap = new Map(updatedSlice.map(b => [b.id, b]));
              const mergedBooks = books.map(b => {
                const up = sliceMap.get(b.id);
                if (!up) return b;
                const targetAlm = almarisMap.get(up.almari_id || '');
                return {
                  ...b,
                  ...up,
                  shelf: targetAlm ? `${targetAlm.code} · Shelf ${up.shelf_no || 1}` : b.shelf,
                  row: String(up.shelf_no || 1),
                };
              });
              LibraryStorage.saveBooks(mergedBooks);
              persistManualBookShelfAssignments(mergedBooks);
              if (onCatalogBooksUpdated) {
                onCatalogBooksUpdated(mergedBooks, msg, batchId);
              }
              showToast(msg);
            }}
          />
        )}

      </div>
    </div>
  );
};

export default AlmariView;
