import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Library,
  Plus,
  MapPin,
  CheckCircle2,
  AlertCircle,
  X,
  GripVertical,
  BookMarked,
  Database,
  Edit2,
  Trash2,
  Settings2,
  AlertTriangle,
  Search,
  ArrowRightLeft,
  Undo2,
  Eye,
  ChevronDown,
  Layers,
} from 'lucide-react';
import { Book, Almari } from '../types/library';
import { AlmariService } from '../services/almariService';
import { LibraryStorage } from '../services/storage';
import { persistManualBookShelfAssignments } from '../services/libraryStorageAndMigration';

export interface AlmariViewProps {
  books: Book[];
  onUpdateBooks?: (updatedBooks: Book[]) => void;
  onSelectBook?: (book: Book) => void;
  onOpenBook?: (book: Book) => void;
  onEditBook?: (book: Book) => void;
  onOpenSettingsTab?: () => void;
  onNavigateToCatalogWithFilter?: (almariId: string, shelfNo?: number) => void;
  onCatalogBooksUpdated?: (books: Book[], message: string) => void;
}

const ACTIVE_ALMARI_KEY = 'ulm_active_almari_id_v3';
const UNASSIGNED_PAGE_STEP = 50;

// Academic book spine binding palettes
const SPINE_PALETTES = [
  { bg: 'from-[#2A0845] to-[#1B032E]', border: 'border-[#FFD147]/50', text: 'text-[#FFD147]' },
  { bg: 'from-[#7F1D1D] to-[#450A0A]', border: 'border-red-400/40', text: 'text-amber-200' },
  { bg: 'from-[#1E3A8A] to-[#0F172A]', border: 'border-blue-400/40', text: 'text-sky-200' },
  { bg: 'from-[#064E3B] to-[#022C22]', border: 'border-emerald-400/40', text: 'text-emerald-200' },
  { bg: 'from-[#78350F] to-[#451A03]', border: 'border-amber-400/50', text: 'text-amber-300' },
  { bg: 'from-[#1E293B] to-[#0F172A]', border: 'border-slate-400/30', text: 'text-slate-200' },
];

const isBookCheckedOut = (book: Book): boolean => {
  if (!book) return false;
  if (book.is_checked_out) return true;
  const st = String(book.status || '').toUpperCase();
  if (st === 'ISSUED' || st === 'CHECKED_OUT' || st === 'LOANED' || st === 'OVERDUE') return true;
  if (book.available_copies !== undefined && Number(book.available_copies) <= 0) return true;
  if (book.available_quantity !== undefined && Number(book.available_quantity) <= 0) return true;
  return false;
};

const getBookSearchKey = (b: Book): string => {
  if (b._searchKey) return b._searchKey;
  return `${b.book_name || ''} ${b.author || ''} ${b.barcode || ''} ${b.accession_no || ''} ${b.isbn || ''} ${b.category || ''}`.toLowerCase();
};

export const AlmariView: React.FC<AlmariViewProps> = ({
  books,
  onUpdateBooks,
  onSelectBook,
  onOpenBook,
  onCatalogBooksUpdated,
}) => {
  // 1. Persistent Cupboards Registry
  const [almaris, setAlmaris] = useState<Almari[]>(() => AlmariService.getAlmaris());

  // 2. Search Queries (Cupboards & High-Scale Unassigned Queue with 150ms debounce)
  const [almariSearchQuery, setAlmariSearchQuery] = useState<string>('');
  const [unassignedSearchInput, setUnassignedSearchInput] = useState<string>('');
  const [debouncedUnassignedQuery, setDebouncedUnassignedQuery] = useState<string>('');
  const [unassignedLimit, setUnassignedLimit] = useState<number>(UNASSIGNED_PAGE_STEP);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedUnassignedQuery(unassignedSearchInput.trim().toLowerCase());
      setUnassignedLimit(UNASSIGNED_PAGE_STEP);
    }, 150);
    return () => window.clearTimeout(timer);
  }, [unassignedSearchInput]);

  // 3. Persistent Selected Almari ID (auto-recovers if selected cupboard was deleted)
  const [selectedAlmariId, setSelectedAlmariId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(ACTIVE_ALMARI_KEY);
      const all = AlmariService.getAlmaris();
      if (saved && all.some((a) => a.id === saved)) return saved;
      return all[0]?.id || '';
    } catch {
      return '';
    }
  });

  // 4. Sync counter triggered when external views emit 'ulm-library-sync'
  const [syncRevision, setSyncRevision] = useState<number>(0);

  // 5. Persistent Shelf Capacities (1–200, keyed `${almari.id}::shelf-${shelfNo}`)
  const [shelfCapacities, setShelfCapacities] = useState<Record<string, number>>(() =>
    AlmariService.getShelfCapacities()
  );

  useEffect(() => {
    const handleSync = () => {
      const latestAlmaris = AlmariService.getAlmaris();
      setAlmaris(latestAlmaris);
      setShelfCapacities(AlmariService.getShelfCapacities());
      setSyncRevision((r) => r + 1);
    };
    window.addEventListener('ulm-library-sync', handleSync);
    window.addEventListener('ulm-library-data-changed', handleSync);
    return () => {
      window.removeEventListener('ulm-library-sync', handleSync);
      window.removeEventListener('ulm-library-data-changed', handleSync);
    };
  }, []);

  // Ensure selectedAlmariId always points to an existing cupboard (or '' if 0 cupboards)
  useEffect(() => {
    if (almaris.length === 0) {
      if (selectedAlmariId !== '') {
        setSelectedAlmariId('');
        try {
          localStorage.setItem(ACTIVE_ALMARI_KEY, '');
        } catch {}
      }
      return;
    }
    if (!almaris.some((a) => a.id === selectedAlmariId)) {
      const fallbackId = almaris[0].id;
      setSelectedAlmariId(fallbackId);
      try {
        localStorage.setItem(ACTIVE_ALMARI_KEY, fallbackId);
      } catch {}
    }
  }, [almaris, selectedAlmariId]);

  // 6. IMPLICIT STATE 3: Deterministic O(N) Reconciliation on load & every book/almari change
  const reconciledState = useMemo(() => {
    void syncRevision;
    return AlmariService.reconcileAlmariPlacements(books, almaris, {
      persist: false,
      outOfBoundsMode: 'unassign',
    });
  }, [books, almaris, syncRevision]);

  const localBooks = reconciledState.books;

  // Persist initial reconciliation cleanups if orphaned or out-of-bounds books were healed on load
  const lastHealedSignatureRef = useRef<string>('');
  useEffect(() => {
    const healedTotal = reconciledState.orphanedCount + reconciledState.outOfBoundsCount;
    if (healedTotal <= 0 || localBooks.length === 0) return;
    const sig = `${almaris.map((a) => `${a.id}:${a.shelf_count}`).join('|')}#${healedTotal}`;
    if (lastHealedSignatureRef.current === sig) return;
    lastHealedSignatureRef.current = sig;
    LibraryStorage.saveBooks(localBooks);
    if (onUpdateBooks) onUpdateBooks(localBooks);
  }, [reconciledState.orphanedCount, reconciledState.outOfBoundsCount, localBooks, almaris, onUpdateBooks]);

  // 7. Direct O(N) Placement Map (by almari+shelf, by almari, and unassigned queue)
  const placementMap = useMemo(() => {
    const byAlmariShelf = new Map<string, Book[]>();
    const byAlmari = new Map<string, Book[]>();
    const unassigned: Book[] = [];

    const almariById = new Map<string, Almari>();
    const almariByCode = new Map<string, Almari>();
    for (const a of almaris) {
      almariById.set(a.id, a);
      almariByCode.set(a.code.toUpperCase(), a);
    }

    for (let i = 0; i < localBooks.length; i++) {
      const book = localBooks[i];
      if (!book || book.is_active === false) continue;

      const matchedAlmari =
        (book.almari_id && almariById.get(book.almari_id)) ||
        (book.almari_code && almariByCode.get(book.almari_code.toUpperCase())) ||
        (book.cupboard && almariByCode.get(book.cupboard.toUpperCase())) ||
        null;
      const shelfNum = Number(book.shelf_no) || 0;

      if (matchedAlmari && shelfNum >= 1 && shelfNum <= Math.max(1, matchedAlmari.shelf_count || 5)) {
        const shelfKey = `${matchedAlmari.id}::${shelfNum}`;
        let shelfList = byAlmariShelf.get(shelfKey);
        if (!shelfList) {
          shelfList = [];
          byAlmariShelf.set(shelfKey, shelfList);
        }
        shelfList.push(book);

        let almList = byAlmari.get(matchedAlmari.id);
        if (!almList) {
          almList = [];
          byAlmari.set(matchedAlmari.id, almList);
        }
        almList.push(book);
      } else {
        unassigned.push(book);
      }
    }

    return { byAlmariShelf, byAlmari, unassigned };
  }, [localBooks, almaris]);

  // 8. O(1)-Indexed Cupboard Search (Zero O(N^2) scan on 50,000+ books!)
  const filteredAlmaris = useMemo(() => {
    const q = almariSearchQuery.trim().toLowerCase();
    if (!q) return almaris;
    return almaris.filter((a) => {
      const codeMatch = a.code.toLowerCase().includes(q);
      const nameEnMatch = a.name_en ? a.name_en.toLowerCase().includes(q) : false;
      const nameUrMatch = a.name_ur ? a.name_ur.toLowerCase().includes(q) : false;
      const locMatch = (a.location || a.location_note || '').toLowerCase().includes(q);
      if (codeMatch || nameEnMatch || nameUrMatch || locMatch) return true;

      const booksInCupboard = placementMap.byAlmari.get(a.id) || [];
      for (let i = 0; i < booksInCupboard.length; i++) {
        if (getBookSearchKey(booksInCupboard[i]).includes(q)) return true;
      }
      return false;
    });
  }, [almaris, almariSearchQuery, placementMap.byAlmari]);

  // 9. IMPLICIT STATE 7: High-Scale Unassigned Queue (Debounced Filter + 50-item Pagination)
  const filteredUnassigned = useMemo(() => {
    const list = placementMap.unassigned;
    if (!debouncedUnassignedQuery) return list;
    const matched: Book[] = [];
    for (let i = 0; i < list.length; i++) {
      if (getBookSearchKey(list[i]).includes(debouncedUnassignedQuery)) {
        matched.push(list[i]);
      }
    }
    return matched;
  }, [placementMap.unassigned, debouncedUnassignedQuery]);

  const visibleUnassigned = useMemo(
    () => filteredUnassigned.slice(0, unassignedLimit),
    [filteredUnassigned, unassignedLimit]
  );

  // 10. Drag-and-Drop State (All 4 Flows + Zero Stuck Highlights)
  const [dragOverShelfNo, setDragOverShelfNo] = useState<number | null>(null);
  const [dragOverAlmariId, setDragOverAlmariId] = useState<string | null>(null);
  const [dragOverUnassigned, setDragOverUnassigned] = useState<boolean>(false);
  const [isDraggingBook, setIsDraggingBook] = useState<boolean>(false);
  const [hoveredBook, setHoveredBook] = useState<Book | null>(null);
  const [capacityWarningBanner, setCapacityWarningBanner] = useState<string | null>(null);

  const draggedBookIdRef = useRef<string | null>(null);
  const sourceAlmariIdRef = useRef<string | null>(null);
  const sourceShelfRef = useRef<number | null>(null);

  const clearAllDragStates = useCallback(() => {
    setDragOverShelfNo(null);
    setDragOverAlmariId(null);
    setDragOverUnassigned(false);
    setIsDraggingBook(false);
    draggedBookIdRef.current = null;
    sourceAlmariIdRef.current = null;
    sourceShelfRef.current = null;
  }, []);

  // 11. Modals State (All rendered via createPortal at z-[9999])
  const [isAddAlmariOpen, setIsAddAlmariOpen] = useState<boolean>(false);
  const [newAlmariCode, setNewAlmariCode] = useState<string>('');
  const [newAlmariName, setNewAlmariName] = useState<string>('');
  const [newAlmariWing, setNewAlmariWing] = useState<string>('Main Hall • Ground Floor');
  const [newAlmariShelves, setNewAlmariShelves] = useState<number>(5);
  const [newAlmariShelfCap, setNewAlmariShelfCap] = useState<number>(24);

  const [isEditAlmariOpen, setIsEditAlmariOpen] = useState<boolean>(false);
  const [editingAlmari, setEditingAlmari] = useState<Almari | null>(null);
  const [editAlmariCode, setEditAlmariCode] = useState<string>('');
  const [editAlmariName, setEditAlmariName] = useState<string>('');
  const [editAlmariWing, setEditAlmariWing] = useState<string>('');
  const [editAlmariShelves, setEditAlmariShelves] = useState<number>(5);
  const [editAlmariShelfCap, setEditAlmariShelfCap] = useState<number>(24);

  const [almariToDelete, setAlmariToDelete] = useState<Almari | null>(null);

  // Quick-Move / Spine Inspection Modal State
  const [quickMoveBook, setQuickMoveBook] = useState<Book | null>(null);
  const [quickMoveAlmariId, setQuickMoveAlmariId] = useState<string>('');
  const [quickMoveShelfNo, setQuickMoveShelfNo] = useState<number>(1);

  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'warning'; text: string } | null>(null);

  // Escape key dismissal for all 4 portaled Almari modals
  useEffect(() => {
    if (!isAddAlmariOpen && !isEditAlmariOpen && !almariToDelete && !quickMoveBook) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (quickMoveBook) setQuickMoveBook(null);
      else if (almariToDelete) setAlmariToDelete(null);
      else if (isEditAlmariOpen) setIsEditAlmariOpen(false);
      else if (isAddAlmariOpen) setIsAddAlmariOpen(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isAddAlmariOpen, isEditAlmariOpen, almariToDelete, quickMoveBook]);

  const selectedAlmari = useMemo(() => {
    return almaris.find((a) => a.id === selectedAlmariId) || almaris[0] || null;
  }, [almaris, selectedAlmariId]);

  const handleSelectAlmari = useCallback((id: string) => {
    setSelectedAlmariId(id);
    setCapacityWarningBanner(null);
    try {
      localStorage.setItem(ACTIVE_ALMARI_KEY, id);
    } catch {}
  }, []);

  const getShelfCapacity = useCallback(
    (almari: Almari, shelfNo: number): number => {
      return AlmariService.getShelfCapacity(almari, shelfNo, shelfCapacities);
    },
    [shelfCapacities]
  );

  const handleSetShelfCapacity = useCallback((almari: Almari, shelfNo: number, cap: number) => {
    const updated = AlmariService.setShelfCapacity(almari, shelfNo, cap);
    setShelfCapacities(updated);
  }, []);

  // Helper: Find exact individual copy strictly by book.id (fallback only to exact unique barcode)
  const findExactBookByDragKey = useCallback(
    (dragKey: string): Book | undefined => {
      const clean = String(dragKey || '').trim();
      if (!clean) return undefined;
      const byId = localBooks.find((b) => b.id && String(b.id).trim() === clean);
      if (byId) return byId;
      return localBooks.find((b) => b.barcode && String(b.barcode).trim() === clean);
    },
    [localBooks]
  );

  // Single Source of Truth Reassignment (IMPLICIT STATES 1, 2, 6)
  const executeAssignBook = useCallback(
    (bookOrId: Book | string, targetAlmari: Almari, targetShelf: number) => {
      const targetBook =
        typeof bookOrId === 'string' ? findExactBookByDragKey(bookOrId) : bookOrId;
      if (!targetBook || !targetAlmari) return;

      const maxShelves = Math.max(1, targetAlmari.shelf_count || 5);
      const clampedShelf = Math.max(1, Math.min(maxShelves, Math.round(Number(targetShelf) || 1)));

      const isAlreadySameSlot =
        targetBook.almari_id === targetAlmari.id && Number(targetBook.shelf_no) === clampedShelf;
      if (isAlreadySameSlot) return;

      const currentShelfBooks =
        placementMap.byAlmariShelf.get(`${targetAlmari.id}::${clampedShelf}`) || [];
      const capacity = getShelfCapacity(targetAlmari, clampedShelf);
      const isOverCapacity = currentShelfBooks.length >= capacity;

      if (isOverCapacity) {
        const warnText = `Capacity Alert: ${targetAlmari.code} • Shelf ${clampedShelf} is at full capacity (${currentShelfBooks.length}/${capacity} vols). "${targetBook.book_name}" was placed — consider increasing Shelf Max or moving to an open shelf.`;
        setCapacityWarningBanner(warnText);
        setToastMessage({ type: 'warning', text: warnText });
      } else {
        setCapacityWarningBanner(null);
      }

      const res = AlmariService.assignBookPlacement(
        targetBook,
        targetAlmari.id,
        clampedShelf,
        localBooks
      );
      if (!res.success || !res.updatedBook) return;

      try {
        persistManualBookShelfAssignments([res.updatedBook]);
      } catch {}

      if (!isOverCapacity) {
        setToastMessage({
          type: 'success',
          text: `Moved "${targetBook.book_name}" (Acc #${targetBook.accession_no || targetBook.barcode || targetBook.id}) to ${targetAlmari.code} • Shelf ${clampedShelf}.`,
        });
      }

      if (onUpdateBooks) onUpdateBooks(res.updatedBooks);
      if (onCatalogBooksUpdated) onCatalogBooksUpdated(res.updatedBooks, res.message);
      setSyncRevision((r) => r + 1);
    },
    [findExactBookByDragKey, placementMap.byAlmariShelf, getShelfCapacity, localBooks, onUpdateBooks, onCatalogBooksUpdated]
  );

  // Single Source of Truth Unassignment (IMPLICIT STATES 1, 2, 5)
  const executeUnassignBook = useCallback(
    (bookOrId: Book | string) => {
      const targetBook =
        typeof bookOrId === 'string' ? findExactBookByDragKey(bookOrId) : bookOrId;
      if (!targetBook) return;
      if (!targetBook.almari_id && (!targetBook.shelf_no || Number(targetBook.shelf_no) < 1)) {
        return; // Already unassigned
      }

      const res = AlmariService.unassignBookPlacement(targetBook, localBooks);
      if (!res.success) return;

      setCapacityWarningBanner(null);
      setToastMessage({
        type: 'success',
        text: `Unassigned "${targetBook.book_name}" back to Unassigned Queue.`,
      });

      if (onUpdateBooks) onUpdateBooks(res.updatedBooks);
      if (onCatalogBooksUpdated) onCatalogBooksUpdated(res.updatedBooks, res.message);
      setSyncRevision((r) => r + 1);
    },
    [findExactBookByDragKey, localBooks, onUpdateBooks, onCatalogBooksUpdated]
  );

  // Helper: Find first open shelf (< capacity) in a target cupboard for Flow 3 (Cupboard Card Drop)
  const findFirstOpenShelf = useCallback(
    (almari: Almari): number => {
      const shelfCount = Math.max(1, almari.shelf_count || 5);
      for (let s = 1; s <= shelfCount; s++) {
        const list = placementMap.byAlmariShelf.get(`${almari.id}::${s}`) || [];
        const cap = getShelfCapacity(almari, s);
        if (list.length < cap) return s;
      }
      return 1;
    },
    [placementMap.byAlmariShelf, getShelfCapacity]
  );

  // DRAG HANDLERS (ALL 4 FLOWS + ZERO STUCK HIGHLIGHTS)
  const handleDragStart = (
    e: React.DragEvent,
    book: Book,
    currentAlmariId?: string,
    currentShelf?: number
  ) => {
    const strictKey = (book.id && String(book.id).trim()) || (book.barcode && String(book.barcode).trim()) || '';
    if (!strictKey) return;
    e.dataTransfer.setData('text/plain', strictKey);
    e.dataTransfer.effectAllowed = 'move';
    draggedBookIdRef.current = strictKey;
    sourceAlmariIdRef.current = currentAlmariId ?? null;
    sourceShelfRef.current = currentShelf ?? null;
    setIsDraggingBook(true);
  };

  const handleDragEnd = () => {
    clearAllDragStates();
  };

  // Flow 1 & 2: Drop onto Shelf (1..N) in Active Cupboard
  const handleShelfDragOver = (e: React.DragEvent, shelfNo: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverShelfNo !== shelfNo) setDragOverShelfNo(shelfNo);
    if (dragOverAlmariId !== null) setDragOverAlmariId(null);
    if (dragOverUnassigned) setDragOverUnassigned(false);
  };

  const handleShelfDragLeave = (e: React.DragEvent, shelfNo: number) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    if (dragOverShelfNo === shelfNo) setDragOverShelfNo(null);
  };

  const handleShelfDrop = (e: React.DragEvent, targetShelfNo: number) => {
    e.preventDefault();
    const bookKey = e.dataTransfer.getData('text/plain') || draggedBookIdRef.current;
    clearAllDragStates();
    if (bookKey && selectedAlmari) {
      executeAssignBook(bookKey, selectedAlmari, targetShelfNo);
    }
  };

  // Flow 3: Drop onto Another Cupboard Card in Left Cupboards List (places on first open shelf)
  const handleCupboardCardDragOver = (e: React.DragEvent, almariId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverAlmariId !== almariId) setDragOverAlmariId(almariId);
    if (dragOverShelfNo !== null) setDragOverShelfNo(null);
    if (dragOverUnassigned) setDragOverUnassigned(false);
  };

  const handleCupboardCardDragLeave = (e: React.DragEvent, almariId: string) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    if (dragOverAlmariId === almariId) setDragOverAlmariId(null);
  };

  const handleCupboardCardDrop = (e: React.DragEvent, targetAlmari: Almari) => {
    e.preventDefault();
    e.stopPropagation();
    const bookKey = e.dataTransfer.getData('text/plain') || draggedBookIdRef.current;
    clearAllDragStates();
    if (bookKey && targetAlmari) {
      const openShelf = findFirstOpenShelf(targetAlmari);
      executeAssignBook(bookKey, targetAlmari, openShelf);
    }
  };

  // Flow 4: Drop onto Unassigned Queue Dropzone (Unassigns cleanly)
  const handleUnassignedDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!dragOverUnassigned) setDragOverUnassigned(true);
    if (dragOverShelfNo !== null) setDragOverShelfNo(null);
    if (dragOverAlmariId !== null) setDragOverAlmariId(null);
  };

  const handleUnassignedDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDragOverUnassigned(false);
  };

  const handleUnassignedDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const bookKey = e.dataTransfer.getData('text/plain') || draggedBookIdRef.current;
    clearAllDragStates();
    if (bookKey) {
      executeUnassignBook(bookKey);
    }
  };

  // Quick-Move Popover Handlers
  const openQuickMovePopover = (book: Book) => {
    setQuickMoveBook(book);
    const defaultAlmId =
      (book.almari_id && almaris.some((a) => a.id === book.almari_id) && book.almari_id) ||
      selectedAlmari?.id ||
      almaris[0]?.id ||
      '';
    setQuickMoveAlmariId(defaultAlmId);

    const targetAlm = almaris.find((a) => a.id === defaultAlmId);
    if (targetAlm) {
      const currentShelf = Number(book.shelf_no) || 0;
      if (book.almari_id === targetAlm.id && currentShelf >= 1 && currentShelf <= (targetAlm.shelf_count || 5)) {
        setQuickMoveShelfNo(currentShelf);
      } else {
        setQuickMoveShelfNo(findFirstOpenShelf(targetAlm));
      }
    } else {
      setQuickMoveShelfNo(1);
    }
  };

  const handleQuickMoveAlmariChange = (nextAlmariId: string) => {
    setQuickMoveAlmariId(nextAlmariId);
    const targetAlm = almaris.find((a) => a.id === nextAlmariId);
    if (targetAlm) {
      setQuickMoveShelfNo(findFirstOpenShelf(targetAlm));
    } else {
      setQuickMoveShelfNo(1);
    }
  };

  const handleConfirmQuickMove = () => {
    if (!quickMoveBook || !quickMoveAlmariId) return;
    const targetAlm = almaris.find((a) => a.id === quickMoveAlmariId);
    if (!targetAlm) return;
    executeAssignBook(quickMoveBook, targetAlm, quickMoveShelfNo);
    setQuickMoveBook(null);
  };

  const handleQuickMoveUnassign = () => {
    if (!quickMoveBook) return;
    executeUnassignBook(quickMoveBook);
    setQuickMoveBook(null);
  };

  const handleOpenFullBookDetails = (book: Book) => {
    setQuickMoveBook(null);
    if (onSelectBook) onSelectBook(book);
    else if (onOpenBook) onOpenBook(book);
  };

  // Add Almari Handler
  const handleCreateManualAlmari = (e: React.FormEvent) => {
    e.preventDefault();
    const code =
      newAlmariCode.trim().toUpperCase() || `ALM-${String(almaris.length + 1).padStart(2, '0')}`;
    const nameEn = newAlmariName.trim() || `Academic Cupboard ${almaris.length + 1}`;
    const shelfCount = Math.max(1, Math.min(12, Number(newAlmariShelves) || 5));
    const perShelfCap = Math.max(1, Math.min(200, Number(newAlmariShelfCap) || 24));

    const created = AlmariService.saveAlmari({
      code,
      name_en: nameEn,
      name_ur: nameEn,
      location: newAlmariWing.trim() || 'Main Library Wing',
      location_note: newAlmariWing.trim() || 'Main Library Wing',
      shelf_count: shelfCount,
      books_per_shelf: perShelfCap,
      approx_capacity: shelfCount * perShelfCap,
      is_active: true,
    });

    let updatedCaps = AlmariService.getShelfCapacities();
    for (let s = 1; s <= shelfCount; s++) {
      updatedCaps = AlmariService.setShelfCapacity(created, s, perShelfCap);
    }
    setShelfCapacities(updatedCaps);

    const refreshed = [...AlmariService.getAlmaris()];
    setAlmaris(refreshed);
    handleSelectAlmari(created.id);
    setIsAddAlmariOpen(false);
    setNewAlmariCode('');
    setNewAlmariName('');
    setToastMessage({
      type: 'success',
      text: `Created Physical Almari ${created.code} (${shelfCount} shelves · ${perShelfCap} vols/shelf).`,
    });
  };

  // Open Edit Modal
  const handleOpenEditModal = (almariToEdit: Almari) => {
    setEditingAlmari(almariToEdit);
    setEditAlmariCode(almariToEdit.code);
    setEditAlmariName(almariToEdit.name_en);
    setEditAlmariWing(almariToEdit.location_note || almariToEdit.location || 'Main Hall • Ground Floor');
    setEditAlmariShelves(almariToEdit.shelf_count || 5);
    setEditAlmariShelfCap(getShelfCapacity(almariToEdit, 1));
    setIsEditAlmariOpen(true);
  };

  // Save Edited Almari + Deterministic Reconciliation for Out-of-Bounds Shelves (IMPLICIT STATE 3)
  const handleSaveEditedAlmari = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAlmari) return;

    const updatedCode = editAlmariCode.trim().toUpperCase() || editingAlmari.code;
    const updatedName = editAlmariName.trim() || editingAlmari.name_en;
    const updatedShelves = Math.max(1, Math.min(12, Number(editAlmariShelves) || 5));
    const updatedShelfCap = Math.max(1, Math.min(200, Number(editAlmariShelfCap) || 24));
    const prevShelves = Math.max(1, editingAlmari.shelf_count || 5);

    const updatedAlmari: Almari = {
      ...editingAlmari,
      code: updatedCode,
      name_en: updatedName,
      name_ur: updatedName,
      location_note: editAlmariWing.trim() || 'Main Library Wing',
      location: editAlmariWing.trim() || 'Main Library Wing',
      shelf_count: updatedShelves,
      books_per_shelf: updatedShelfCap,
      approx_capacity: updatedShelves * updatedShelfCap,
      is_active: true,
    };

    AlmariService.saveAlmari(updatedAlmari);

    let updatedCaps = AlmariService.getShelfCapacities();
    for (let s = 1; s <= updatedShelves; s++) {
      updatedCaps = AlmariService.setShelfCapacity(updatedAlmari, s, updatedShelfCap);
    }
    setShelfCapacities(updatedCaps);

    const refreshedAlmaris = [...AlmariService.getAlmaris()];
    setAlmaris(refreshedAlmaris);

    // Reconcile immediately: returns out-of-bounds books from removed shelves to Unassigned Queue & syncs renamed almari_code
    const recon = AlmariService.reconcileAlmariPlacements(localBooks, refreshedAlmaris, {
      persist: true,
      outOfBoundsMode: 'unassign',
    });

    if (recon.changedCount > 0) {
      if (onUpdateBooks) onUpdateBooks(recon.books);
      if (onCatalogBooksUpdated) {
        onCatalogBooksUpdated(
          recon.books,
          `Updated Cupboard ${updatedAlmari.code} and reconciled ${recon.changedCount} volume placement(s).`
        );
      }
    }

    handleSelectAlmari(updatedAlmari.id);
    setIsEditAlmariOpen(false);
    setEditingAlmari(null);
    setSyncRevision((r) => r + 1);

    const extraNote =
      updatedShelves < prevShelves && recon.outOfBoundsCount > 0
        ? ` ${recon.outOfBoundsCount} volume(s) from removed shelves returned to Unassigned Queue.`
        : '';
    setToastMessage({
      type: 'success',
      text: `Updated Cupboard ${updatedAlmari.code} (${updatedName}).${extraNote}`,
    });
  };

  // Safe Delete Almari Handler + Deterministic Reconciliation (IMPLICIT STATE 3)
  const handleConfirmDeleteAlmari = () => {
    if (!almariToDelete) return;
    const deletedId = almariToDelete.id;
    const deletedCode = almariToDelete.code;

    // 1. Delete cupboard from persistent AlmariService
    AlmariService.deleteAlmari(deletedId);
    const refreshedAlmaris = [...AlmariService.getAlmaris()];
    setAlmaris(refreshedAlmaris);

    // 2. Run deterministic reconciliation to unassign every orphaned volume cleanly
    const recon = AlmariService.reconcileAlmariPlacements(localBooks, refreshedAlmaris, {
      persist: true,
      outOfBoundsMode: 'unassign',
    });

    // 3. Auto-switch activeAlmariId to first remaining cupboard (or '' if 0 left)
    const nextAlmariId = refreshedAlmaris[0]?.id || '';
    handleSelectAlmari(nextAlmariId);

    // 4. Sync parent & catalog
    if (onUpdateBooks) onUpdateBooks(recon.books);
    if (onCatalogBooksUpdated) {
      onCatalogBooksUpdated(
        recon.books,
        `Cupboard ${deletedCode} deleted. ${recon.orphanedCount} allocated volume(s) returned to Unassigned Queue.`
      );
    }

    setAlmariToDelete(null);
    setIsEditAlmariOpen(false);
    setEditingAlmari(null);
    setSyncRevision((r) => r + 1);
    setToastMessage({
      type: 'success',
      text: `Cupboard ${deletedCode} deleted. ${recon.orphanedCount} volume(s) safely returned to Unassigned Queue.`,
    });
  };

  // IMPLICIT STATE 9: Dynamic Header & Cupboard Stats via useMemo
  const activeAlmariBooksCount = useMemo(() => {
    if (!selectedAlmari) return 0;
    return (placementMap.byAlmari.get(selectedAlmari.id) || []).length;
  }, [selectedAlmari, placementMap.byAlmari]);

  const activeAlmariCheckedOutCount = useMemo(() => {
    if (!selectedAlmari) return 0;
    const list = placementMap.byAlmari.get(selectedAlmari.id) || [];
    let count = 0;
    for (let i = 0; i < list.length; i++) {
      if (isBookCheckedOut(list[i])) count++;
    }
    return count;
  }, [selectedAlmari, placementMap.byAlmari]);

  const quickMoveTargetAlmari = useMemo(
    () => almaris.find((a) => a.id === quickMoveAlmariId) || null,
    [almaris, quickMoveAlmariId]
  );

  return (
    <div className="space-y-4 pb-16 select-none">
      {/* 1. Top Toolbar Banner (Frosted Crystal Liquid-Glass + Live Header Sync) */}
      <div className="ulm-preserve-glass p-4 rounded-[22px] bg-gradient-to-br from-white/60 via-white/40 to-white/25 dark:from-white/[0.08] dark:via-white/[0.035] dark:to-white/[0.015] backdrop-blur-2xl backdrop-saturate-[180%] border border-white/70 dark:border-white/[0.15] shadow-[inset_1.5px_1.5px_2px_rgba(255,255,255,0.6),0_10px_28px_rgba(15,23,42,0.07)] dark:shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.22),0_10px_28px_rgba(0,0,0,0.2)] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#541A72] to-[#3B1054] border border-[#FFD147]/50 flex items-center justify-center text-[#FFD147] shadow-sm shrink-0">
            <Library className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                Physical Almari Cupboard &amp; 3D Bookshelf Registry
              </h2>
              {activeAlmariCheckedOutCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/35">
                  {activeAlmariCheckedOutCount} OUT ON LOAN
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Drag volumes between shelves, onto any cupboard card, or back to Unassigned Queue — or click any spine for instant Quick-Move.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsAddAlmariOpen(true)}
            className="h-9 px-4 rounded-xl text-xs font-extrabold bg-gradient-to-r from-[#541A72] to-[#B4690E] !text-white border border-[#FFD147]/50 shadow-xs hover:brightness-110 cursor-pointer flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5 !text-white" />
            <span className="!text-white">Add Almari</span>
          </button>
        </div>
      </div>

      {/* Inline Toast / Status Banner */}
      {toastMessage && (
        <div
          className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 border ${
            toastMessage.type === 'warning'
              ? 'bg-amber-500/15 border-amber-500/40 text-amber-900 dark:text-amber-200'
              : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-900 dark:text-emerald-200'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {toastMessage.type === 'warning' ? (
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            )}
            <span className="truncate">{toastMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-[11px] underline opacity-80 hover:opacity-100 cursor-pointer shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* 2. Left Column: Cupboards Panel (Drop-Target Cards) + High-Scale Unassigned Queue (Dropzone) */}
        <div className="lg:col-span-3 space-y-3">
          {/* Cupboards List */}
          <div className="ulm-preserve-glass p-3.5 rounded-[22px] bg-gradient-to-br from-white/60 via-white/40 to-white/25 dark:from-white/[0.075] dark:via-white/[0.03] dark:to-white/[0.015] backdrop-blur-2xl backdrop-saturate-[180%] border border-white/70 dark:border-white/[0.14] shadow-[inset_1.5px_1.5px_2px_rgba(255,255,255,0.55),0_8px_24px_rgba(15,23,42,0.06)] dark:shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.2),0_8px_24px_rgba(0,0,0,0.18)] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Cupboards ({almaris.length})
              </span>
              <span className="text-[11px] font-mono font-bold text-amber-700 dark:text-[#FFD147]">
                Unassigned: {placementMap.unassigned.length.toLocaleString()}
              </span>
            </div>

            {/* Search Almari Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none z-10" />
              <input
                type="text"
                value={almariSearchQuery}
                onChange={(e) => setAlmariSearchQuery(e.target.value)}
                placeholder="Search almari code, name, book..."
                style={{ paddingLeft: '2.25rem', paddingRight: '2rem', height: '32px' }}
                className="ulm-compact-control w-full h-8 pl-9 pr-8 text-xs rounded-xl bg-white/65 dark:bg-white/[0.06] border border-slate-200/80 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#C8963E]/80 focus:ring-1 focus:ring-[#C8963E]/40 transition-all"
              />
              {almariSearchQuery && (
                <button
                  type="button"
                  onClick={() => setAlmariSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer z-10"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {filteredAlmaris.map((almari) => {
                const isSelected = selectedAlmari?.id === almari.id;
                const isDropTarget = dragOverAlmariId === almari.id;
                const shelfCount = Math.max(1, almari.shelf_count || 5);
                let allocated = 0;
                let capacity = 0;
                for (let s = 1; s <= shelfCount; s++) {
                  const list = placementMap.byAlmariShelf.get(`${almari.id}::${s}`) || [];
                  allocated += list.length;
                  capacity += getShelfCapacity(almari, s);
                }
                const ratio = Math.min(100, Math.round((allocated / Math.max(1, capacity)) * 100));
                const nextOpenShelf = isDropTarget ? findFirstOpenShelf(almari) : 1;

                return (
                  <div
                    key={almari.id}
                    onClick={() => handleSelectAlmari(almari.id)}
                    onDragOver={(e) => handleCupboardCardDragOver(e, almari.id)}
                    onDragLeave={(e) => handleCupboardCardDragLeave(e, almari.id)}
                    onDrop={(e) => handleCupboardCardDrop(e, almari)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer relative group ${
                      isDropTarget
                        ? 'bg-[#FFD147]/20 dark:bg-[#FFD147]/15 border-[#C8963E] dark:border-[#FFD147] ring-2 ring-[#FFD147]/70 scale-[1.01] shadow-lg'
                        : isSelected
                          ? 'ulm-dark-plaque bg-gradient-to-r from-[#541A72]/90 to-[#3B1054]/90 !text-white border-[#FFD147]/70 shadow-md ring-1 ring-[#FFD147]/45'
                          : 'bg-white/55 dark:bg-white/[0.04] text-slate-800 dark:text-slate-100 border-slate-200/80 dark:border-white/10 hover:border-[#C8963E]/60 hover:bg-white/75 dark:hover:bg-white/[0.07]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span
                        className={`font-mono text-[11px] font-extrabold px-2 py-0.5 rounded-md border ${
                          isSelected && !isDropTarget
                            ? 'bg-black/25 text-[#FFD147] border-[#FFD147]/40'
                            : 'bg-[#541A72]/10 dark:bg-white/10 text-[#541A72] dark:text-[#FFD147] border-[#541A72]/20 dark:border-white/15'
                        }`}
                      >
                        {almari.code}
                      </span>
                      <div className="flex items-center gap-1">
                        <span
                          className={`text-[11px] font-mono font-bold tabular-nums ${
                            isSelected && !isDropTarget
                              ? '!text-white'
                              : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {allocated} / {capacity} vols
                        </span>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditModal(almari);
                          }}
                          className="p-1 rounded-md opacity-85 hover:opacity-100 hover:bg-white/20 transition-all cursor-pointer"
                          title="Edit Almari Settings"
                        >
                          <Edit2
                            className={`w-3 h-3 ${
                              isSelected && !isDropTarget
                                ? 'text-[#FFD147]'
                                : 'text-[#541A72] dark:text-[#FFD147]'
                            }`}
                          />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAlmariToDelete(almari);
                          }}
                          className="p-1 rounded-md opacity-85 hover:opacity-100 hover:bg-rose-500/20 text-rose-500 dark:text-rose-400 transition-all cursor-pointer"
                          title="Delete Almari"
                        >
                          <Trash2 className="w-3 h-3 text-rose-500 dark:text-rose-400" />
                        </button>
                      </div>
                    </div>

                    <p
                      className={`font-bold text-xs mt-1 truncate ${
                        isSelected && !isDropTarget
                          ? '!text-white'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {almari.name_en}
                    </p>
                    <p
                      className={`text-[10px] flex items-center gap-1 mt-0.5 truncate ${
                        isSelected && !isDropTarget
                          ? '!text-white/85'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      <MapPin className="w-2.5 h-2.5 shrink-0" />
                      <span className={isSelected && !isDropTarget ? '!text-white/85' : ''}>
                        {almari.location_note || almari.location || 'Main Wing'}
                      </span>
                    </p>

                    {isDropTarget && (
                      <div className="mt-1.5 px-2 py-1 rounded-lg bg-[#541A72] text-[#FFD147] text-[10px] font-mono font-bold text-center">
                        Drop to place on Shelf {nextOpenShelf}
                      </div>
                    )}

                    <div
                      className={`mt-2 h-1.5 w-full rounded-full overflow-hidden ${
                        isSelected && !isDropTarget
                          ? 'bg-black/25'
                          : 'bg-slate-200/80 dark:bg-white/10'
                      }`}
                    >
                      <div
                        className={`h-full transition-all ${
                          ratio >= 100
                            ? 'bg-rose-500'
                            : ratio >= 85
                              ? 'bg-amber-400'
                              : ratio >= 60
                                ? 'bg-[#FFD147]'
                                : 'bg-emerald-400'
                        }`}
                        style={{ width: `${ratio}%` }}
                      />
                    </div>
                  </div>
                );
              })}

              {almaris.length > 0 && filteredAlmaris.length === 0 && (
                <div className="p-4 text-center text-xs text-slate-400 dark:text-slate-500 rounded-xl bg-white/40 dark:bg-white/[0.02] border border-dashed border-slate-200 dark:border-white/10">
                  No cupboards found matching &quot;{almariSearchQuery}&quot;
                </div>
              )}

              {almaris.length === 0 && (
                <div className="p-4 text-center space-y-2 rounded-xl bg-white/40 dark:bg-white/[0.02] border border-dashed border-slate-300/80 dark:border-white/15">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    No cupboards yet
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsAddAlmariOpen(true)}
                    className="h-7 px-3 rounded-lg text-[11px] font-bold bg-[#541A72] !text-white cursor-pointer hover:brightness-110"
                  >
                    + Create First Almari
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* High-Scale Draggable Unassigned Queue + Flow 4 Unassign Dropzone */}
          <div
            onDragOver={handleUnassignedDragOver}
            onDragLeave={handleUnassignedDragLeave}
            onDrop={handleUnassignedDrop}
            className={`ulm-preserve-glass p-3.5 rounded-[22px] backdrop-blur-2xl backdrop-saturate-[180%] border transition-all space-y-2.5 ${
              dragOverUnassigned
                ? 'bg-amber-500/15 dark:bg-amber-500/15 border-amber-500 ring-2 ring-amber-400/60 shadow-lg'
                : isDraggingBook && sourceShelfRef.current !== null
                  ? 'bg-gradient-to-br from-white/65 via-white/45 to-white/30 dark:from-white/[0.09] dark:via-white/[0.04] dark:to-white/[0.02] border-dashed border-amber-500/70 dark:border-[#FFD147]/60'
                  : 'bg-gradient-to-br from-white/60 via-white/40 to-white/25 dark:from-white/[0.075] dark:via-white/[0.03] dark:to-white/[0.015] border-white/70 dark:border-white/[0.14] shadow-[inset_1.5px_1.5px_2px_rgba(255,255,255,0.55),0_8px_24px_rgba(15,23,42,0.06)] dark:shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.2),0_8px_24px_rgba(0,0,0,0.18)]'
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Unassigned Queue ({placementMap.unassigned.length.toLocaleString()})
              </span>
              <span className="text-[9px] font-mono text-slate-400 dark:text-slate-400">
                {dragOverUnassigned ? 'Release to unassign' : 'Drag or click'}
              </span>
            </div>

            {dragOverUnassigned && (
              <div className="p-2.5 rounded-xl border-2 border-dashed border-amber-500 bg-amber-500/15 text-amber-800 dark:text-amber-200 text-[11px] font-bold text-center flex items-center justify-center gap-1.5">
                <Undo2 className="w-3.5 h-3.5" />
                <span>Drop volume here to unassign to queue</span>
              </div>
            )}

            {/* Compact Debounced Search Input inside Unassigned Queue (IMPLICIT STATE 7) */}
            {placementMap.unassigned.length > 0 && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none z-10" />
                <input
                  type="text"
                  value={unassignedSearchInput}
                  onChange={(e) => setUnassignedSearchInput(e.target.value)}
                  placeholder="Search unassigned title, barcode, Acc #..."
                  style={{ paddingLeft: '2rem', paddingRight: '1.75rem', height: '30px' }}
                  className="ulm-compact-control w-full text-[11px] rounded-xl bg-white/65 dark:bg-white/[0.06] border border-slate-200/80 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#C8963E]/80 focus:ring-1 focus:ring-[#C8963E]/40"
                />
                {unassignedSearchInput && (
                  <button
                    type="button"
                    onClick={() => setUnassignedSearchInput('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer z-10"
                    title="Clear queue search"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}

            {/* Live Showing X of Y counter */}
            {placementMap.unassigned.length > 0 && (
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400 px-0.5">
                <span>
                  Showing {visibleUnassigned.length.toLocaleString()} of{' '}
                  {filteredUnassigned.length.toLocaleString()} unassigned
                </span>
                {debouncedUnassignedQuery && (
                  <span className="text-[#8A4B00] dark:text-[#FFD147]">Filtered</span>
                )}
              </div>
            )}

            <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
              {visibleUnassigned.map((b, uIdx) => {
                const strictId = b.id || b.barcode || `unassigned-${uIdx}`;
                const checkedOut = isBookCheckedOut(b);
                return (
                  <div
                    key={strictId}
                    draggable
                    onDragStart={(e) => handleDragStart(e, b)}
                    onDragEnd={handleDragEnd}
                    onClick={() => openQuickMovePopover(b)}
                    className="p-2 rounded-xl bg-white/60 dark:bg-white/[0.04] backdrop-blur-md border border-slate-200/80 dark:border-white/10 text-xs flex items-center justify-between gap-1.5 cursor-grab active:cursor-grabbing hover:border-[#C8963E]/70 shadow-2xs transition-all group"
                    title="Drag onto any shelf/cupboard or click to quick-assign"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <p className="font-bold truncate text-[11px] text-slate-800 dark:text-slate-200">
                          {b.book_name}
                        </p>
                        {checkedOut && (
                          <span className="px-1 py-[1px] rounded text-[8px] font-mono font-extrabold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40 shrink-0">
                            OUT
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-[9px] text-[#8A4B00] dark:text-[#C8963E] block truncate">
                        #{b.barcode || b.accession_no || b.id}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openQuickMovePopover(b);
                        }}
                        className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-[#541A72]/10 dark:bg-[#FFD147]/15 text-[#541A72] dark:text-[#FFD147] border border-[#541A72]/20 dark:border-[#FFD147]/30 hover:brightness-110 cursor-pointer"
                        title="Quick-Assign to Shelf"
                      >
                        Place
                      </button>
                      <GripVertical className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    </div>
                  </div>
                );
              })}

              {/* Show 50 More Button (IMPLICIT STATE 7) */}
              {visibleUnassigned.length < filteredUnassigned.length && (
                <button
                  type="button"
                  onClick={() => setUnassignedLimit((prev) => prev + UNASSIGNED_PAGE_STEP)}
                  className="w-full py-2 mt-1 rounded-xl text-[11px] font-bold bg-[#541A72]/10 hover:bg-[#541A72]/20 dark:bg-white/[0.08] dark:hover:bg-white/[0.14] text-[#541A72] dark:text-[#FFD147] border border-[#541A72]/20 dark:border-[#FFD147]/30 flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                  <span>
                    Show {Math.min(UNASSIGNED_PAGE_STEP, filteredUnassigned.length - visibleUnassigned.length)} More (
                    {(filteredUnassigned.length - visibleUnassigned.length).toLocaleString()} left)
                  </span>
                </button>
              )}

              {/* Search empty state */}
              {placementMap.unassigned.length > 0 && filteredUnassigned.length === 0 && (
                <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center py-4">
                  No unassigned books matching &quot;{unassignedSearchInput}&quot;
                </p>
              )}

              {/* IMPLICIT STATE 8: 0 Unassigned Books State (Crisp Emerald Status Pill) */}
              {placementMap.unassigned.length === 0 && (
                <div className="py-3 px-2.5 rounded-xl bg-emerald-500/12 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-[11px] font-semibold text-center flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>✓ All cataloged volumes are assigned to physical shelves</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 3. Right Column: Theme-Aware Frosted 3D Physical Cupboard & Shelves */}
        <div className="lg:col-span-9 space-y-4">
          {selectedAlmari ? (
            <div className="ulm-preserve-glass rounded-[26px] bg-gradient-to-br from-white/65 via-white/45 to-white/30 dark:from-white/[0.07] dark:via-[#180E29]/55 dark:to-[#10081E]/45 backdrop-blur-2xl backdrop-saturate-[180%] border border-white/80 dark:border-[#C8963E]/35 p-5 shadow-[inset_1.5px_1.5px_2px_rgba(255,255,255,0.8),0_16px_40px_rgba(15,23,42,0.08)] dark:shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.22),0_20px_50px_rgba(0,0,0,0.45)] relative overflow-hidden">
              {/* Cupboard Plaque Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200/80 dark:border-[#C8963E]/25">
                <div className="flex items-center gap-3">
                  <div className="px-3 py-1 rounded-xl bg-[#541A72]/12 dark:bg-[#FFD147]/15 border border-[#541A72]/25 dark:border-[#FFD147]/45 text-[#541A72] dark:text-[#FFD147] font-mono font-extrabold text-xs shadow-2xs">
                    {selectedAlmari.code}
                  </div>
                  <div>
                    <h3
                      className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight"
                      style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                    >
                      {selectedAlmari.name_en}
                    </h3>
                    <p className="text-[11px] text-[#8A4B00] dark:text-[#FFD147]/85 flex items-center gap-1.5 font-mono mt-0.5">
                      <MapPin className="w-3 h-3 text-[#C8963E] dark:text-[#FFD147]" />
                      <span>
                        {selectedAlmari.location_note || selectedAlmari.location || 'Main Wing'} •{' '}
                        {selectedAlmari.shelf_count || 5} Physical Shelves
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(selectedAlmari)}
                    className="h-8 px-3.5 rounded-xl text-xs font-bold bg-[#541A72]/10 hover:bg-[#541A72]/20 dark:bg-white/10 dark:hover:bg-white/20 text-[#541A72] dark:text-[#FFD147] border border-[#541A72]/25 dark:border-[#FFD147]/40 flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                    title="Edit Cupboard Title, Code, Location & Shelves"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit Cupboard</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAlmariToDelete(selectedAlmari)}
                    className="h-8 px-3 rounded-xl text-xs font-bold bg-rose-500/12 hover:bg-rose-500/22 text-rose-700 dark:text-rose-300 border border-rose-500/35 flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                    title="Delete Cupboard"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>

              {/* IMPLICIT STATE 6: Inline Over-Capacity Guard Warning Banner */}
              {capacityWarningBanner && (
                <div className="mt-3 px-3.5 py-2 rounded-xl bg-amber-500/15 border border-amber-500/45 text-amber-900 dark:text-amber-200 text-xs font-semibold flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>{capacityWarningBanner}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCapacityWarningBanner(null)}
                    className="text-[11px] underline shrink-0 cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              )}

              {/* Pure 3D Physical Shelves */}
              <div className="mt-4 space-y-4">
                {Array.from({ length: Math.max(1, selectedAlmari.shelf_count || 5) }, (_, idx) => {
                  const shelfNo = idx + 1;
                  const shelfBooks =
                    placementMap.byAlmariShelf.get(`${selectedAlmari.id}::${shelfNo}`) || [];
                  const capacity = getShelfCapacity(selectedAlmari, shelfNo);
                  const isDragTarget = dragOverShelfNo === shelfNo;
                  const isFull = shelfBooks.length >= capacity;
                  const isOverfull = shelfBooks.length > capacity;

                  return (
                    <div
                      key={shelfNo}
                      onDragOver={(e) => handleShelfDragOver(e, shelfNo)}
                      onDragLeave={(e) => handleShelfDragLeave(e, shelfNo)}
                      onDrop={(e) => handleShelfDrop(e, shelfNo)}
                      className={`ulm-preserve-glass relative rounded-2xl p-3.5 transition-all duration-200 border backdrop-blur-xl ${
                        isDragTarget
                          ? isFull
                            ? 'bg-amber-500/15 border-amber-500 ring-2 ring-amber-400/60 shadow-lg'
                            : 'bg-[#FFD147]/15 border-[#C8963E] dark:border-[#FFD147] ring-2 ring-[#FFD147]/50 shadow-lg'
                          : 'bg-slate-900/[0.035] dark:bg-black/30 border-slate-200/90 dark:border-white/[0.10] hover:border-[#C8963E]/50 dark:hover:border-[#FFD147]/35 shadow-[inset_0_2px_6px_rgba(15,23,42,0.04)] dark:shadow-[inset_0_2px_8px_rgba(0,0,0,0.35)]'
                      }`}
                    >
                      {/* Shelf Top Bar */}
                      <div className="flex items-center justify-between flex-wrap gap-2 text-xs mb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-extrabold text-[11px] px-2.5 py-0.5 rounded-md bg-[#541A72]/12 dark:bg-[#FFD147]/15 text-[#541A72] dark:text-[#FFD147] border border-[#541A72]/25 dark:border-[#FFD147]/35">
                            SHELF {shelfNo}
                          </span>
                          <span className="text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-300 tabular-nums">
                            {shelfBooks.length} / {capacity} Volumes
                          </span>
                          {/* IMPLICIT STATE 6: [ FULL ] Micro-Tag */}
                          {isFull && (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono font-extrabold tracking-wider border ${
                                isOverfull
                                  ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/45'
                                  : 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/45'
                              }`}
                            >
                              [ FULL ]
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 text-[11px]">
                          <span className="font-medium text-slate-500 dark:text-slate-400">Max:</span>
                          <input
                            type="number"
                            min={1}
                            max={200}
                            value={capacity}
                            onChange={(e) => {
                              const parsed = parseInt(e.target.value, 10);
                              handleSetShelfCapacity(
                                selectedAlmari,
                                shelfNo,
                                Number.isFinite(parsed) ? parsed : 24
                              );
                            }}
                            className="ulm-compact-control w-14 h-6 px-1.5 text-center font-mono font-bold rounded-lg bg-white/75 dark:bg-white/[0.07] border border-slate-300/80 dark:border-white/20 text-slate-900 dark:text-[#FFD147] focus:outline-none focus:border-[#C8963E] dark:focus:border-[#FFD147] shadow-2xs"
                            title="Shelf capacity (1–200 volumes)"
                          />
                        </div>
                      </div>

                      {/* 3D Spines Container */}
                      <div className="relative min-h-[145px] flex items-end px-3 pt-4 pb-0 overflow-x-auto gap-1.5 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:bg-[#C8963E]/40 [&::-webkit-scrollbar-thumb]:rounded-full">
                        {shelfBooks.length === 0 ? (
                          /* IMPLICIT STATE 8: Empty Shelf State */
                          <div className="w-full h-24 rounded-xl border border-dashed border-slate-300/80 dark:border-white/15 flex items-center justify-center text-xs text-slate-500 dark:text-slate-400 font-mono italic text-center px-4">
                            Empty Shelf — Drag books here or click an unassigned book to place
                          </div>
                        ) : (
                          shelfBooks.map((book, bIdx) => {
                            const strictKey = book.id || book.barcode || `shelf-${shelfNo}-${bIdx}`;
                            const palette = SPINE_PALETTES[bIdx % SPINE_PALETTES.length];
                            const isUrdu = /[\u0600-\u06FF]/.test(book.book_name || '');
                            const checkedOut = isBookCheckedOut(book);

                            return (
                              <div
                                key={strictKey}
                                draggable
                                onDragStart={(e) => handleDragStart(e, book, selectedAlmari.id, shelfNo)}
                                onDragEnd={handleDragEnd}
                                onClick={() => openQuickMovePopover(book)}
                                onMouseEnter={() => setHoveredBook(book)}
                                onMouseLeave={() => setHoveredBook(null)}
                                className={`ulm-dark-plaque group relative h-32 w-8 hover:w-10 rounded-t-[4px] bg-gradient-to-r ${palette.bg} shadow-lg cursor-grab active:cursor-grabbing hover:-translate-y-3 hover:scale-105 hover:z-30 transition-all duration-150 flex flex-col justify-between p-1 shrink-0 overflow-hidden select-none ${
                                  checkedOut
                                    ? 'border-2 border-dashed border-amber-400/90 opacity-75 ring-1 ring-amber-400/35'
                                    : `border-t-2 border-r border-l ${palette.border}`
                                }`}
                                title={
                                  checkedOut
                                    ? `[CHECKED OUT — Home Slot Reserved] ${book.book_name} (#${book.barcode || book.accession_no || book.id})`
                                    : `${book.book_name} (#${book.barcode || book.accession_no || book.id}) — Click to Quick-Move or Inspect`
                                }
                              >
                                <div className="absolute left-[3px] top-0 bottom-0 w-[1px] bg-white/20" />
                                {/* IMPLICIT STATE 4: Checked-Out Book Spine OUT Micro-Badge */}
                                {checkedOut ? (
                                  <span className="w-full py-[1px] rounded-[2px] bg-amber-400 !text-slate-950 text-[6.5px] font-mono font-black tracking-tighter text-center uppercase shadow-2xs">
                                    OUT
                                  </span>
                                ) : (
                                  <span
                                    className={`text-[6px] font-mono font-bold tracking-widest text-center ${palette.text} uppercase`}
                                  >
                                    ULM
                                  </span>
                                )}
                                <div className="flex-1 flex items-center justify-center overflow-hidden py-1">
                                  <span
                                    className={`text-[9px] font-bold !text-white tracking-wider truncate [writing-mode:vertical-rl] rotate-180 max-h-20 ${
                                      isUrdu ? 'font-serif text-[10px]' : ''
                                    }`}
                                  >
                                    {book.book_name}
                                  </span>
                                </div>
                                <div className="w-full py-0.5 rounded-[2px] bg-white !text-slate-950 font-mono text-[6.5px] font-extrabold text-center shadow-xs">
                                  {String(book.barcode || book.accession_no || book.id).slice(-4)}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Wooden Shelf Beam */}
                      <div className="h-3 w-full rounded bg-gradient-to-r from-[#9A6B24] via-[#FFD147] to-[#8C5D19] border-t border-white/40 shadow-[0_4px_12px_rgba(0,0,0,0.35)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.6)] relative z-10" />
                    </div>
                  );
                })}
              </div>

              {/* Hover Inspection Bar */}
              {hoveredBook && (
                <div className="mt-4 p-3 rounded-xl bg-white/75 dark:bg-[#0F0819]/90 backdrop-blur-md border border-[#C8963E]/40 dark:border-[#FFD147]/40 flex items-center justify-between gap-3 text-xs animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <BookMarked className="w-4 h-4 text-[#8A4B00] dark:text-[#FFD147] shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-slate-900 dark:text-white truncate">
                          {hoveredBook.book_name}
                        </p>
                        {isBookCheckedOut(hoveredBook) && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-extrabold bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/40">
                            CHECKED OUT · HOME SLOT RESERVED
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#8A4B00] dark:text-[#FFD147]/80 font-mono truncate">
                        Barcode: #{hoveredBook.barcode || hoveredBook.accession_no || hoveredBook.id} • Author:{' '}
                        {hoveredBook.author || 'Unknown'} • Category: {hoveredBook.category || 'General'}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold shrink-0">
                    Click for Quick-Move &amp; Details
                  </span>
                </div>
              )}
            </div>
          ) : (
            /* IMPLICIT STATE 8: 0 Cupboards Empty State & Recovery */
            <div className="ulm-preserve-glass rounded-[26px] bg-gradient-to-br from-white/65 via-white/45 to-white/30 dark:from-white/[0.07] dark:via-[#180E29]/55 dark:to-[#10081E]/45 backdrop-blur-2xl backdrop-saturate-[180%] border border-white/80 dark:border-[#C8963E]/35 p-12 shadow-xl text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-[#541A72]/12 dark:bg-[#FFD147]/15 border border-[#541A72]/25 dark:border-[#FFD147]/40 flex items-center justify-center text-[#541A72] dark:text-[#FFD147]">
                <Library className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                  No Physical Almaris Configured
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  Create your first physical library cupboard to organize shelves, track per-shelf capacity, and drag volumes into locked positions.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddAlmariOpen(true)}
                className="h-10 px-5 rounded-xl text-xs font-extrabold bg-gradient-to-r from-[#541A72] to-[#B4690E] !text-white border border-[#FFD147]/50 shadow-md hover:brightness-110 cursor-pointer inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4 !text-white" />
                <span className="!text-white">+ Create First Almari</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================
          PORTALED MODALS (IMPLICIT STATE 9: createPortal at fixed inset-0 z-[9999])
         ======================================================================== */}

      {/* MODAL 1: ADD MANUAL ALMARI */}
      {isAddAlmariOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 modal-backdrop ulm-modal-backdrop bg-slate-900/20 dark:bg-slate-950/65 backdrop-blur-[10px] backdrop-saturate-150">
            <form
              onSubmit={handleCreateManualAlmari}
              className="ulm-preserve-glass w-full max-w-md rounded-[26px] bg-gradient-to-br from-white/85 via-white/70 to-white/55 dark:from-[#1A102E]/92 dark:via-[#140C24]/88 dark:to-[#0F081C]/85 backdrop-blur-2xl border border-white/85 dark:border-[#C8963E]/60 p-5 space-y-4 shadow-2xl text-slate-900 dark:text-white"
            >
              <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-white/10 pb-3">
                <h3 className="text-base font-extrabold text-[#541A72] dark:text-[#FFD147]">
                  Add New Physical Almari Cupboard
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAddAlmariOpen(false)}
                  className="p-1 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold mb-1 text-slate-800 dark:text-slate-200">
                    Almari Code
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ALM-CS-02"
                    value={newAlmariCode}
                    onChange={(e) => setNewAlmariCode(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl bg-white/80 dark:bg-black/40 border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1 text-slate-800 dark:text-slate-200">
                    Cupboard Title / Department
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. AI & Robotics Research Cupboard"
                    value={newAlmariName}
                    onChange={(e) => setNewAlmariName(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl bg-white/80 dark:bg-black/40 border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1 text-slate-800 dark:text-slate-200">
                    Physical Location / Wing
                  </label>
                  <input
                    type="text"
                    value={newAlmariWing}
                    onChange={(e) => setNewAlmariWing(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl bg-white/80 dark:bg-black/40 border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold mb-1 text-slate-800 dark:text-slate-200">
                      Physical Shelves (1–12)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={newAlmariShelves}
                      onChange={(e) => setNewAlmariShelves(parseInt(e.target.value, 10) || 5)}
                      className="w-full h-9 px-3 rounded-xl bg-white/80 dark:bg-black/40 border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-1 text-slate-800 dark:text-slate-200">
                      Capacity / Shelf (1–200)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={newAlmariShelfCap}
                      onChange={(e) => setNewAlmariShelfCap(parseInt(e.target.value, 10) || 24)}
                      className="w-full h-9 px-3 rounded-xl bg-white/80 dark:bg-black/40 border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddAlmariOpen(false)}
                  className="h-9 px-4 rounded-xl text-xs font-semibold border border-slate-300 dark:border-white/15 text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-9 px-4 rounded-xl text-xs font-extrabold bg-gradient-to-r from-[#541A72] to-[#B4690E] !text-white cursor-pointer"
                >
                  Create Cupboard
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}

      {/* MODAL 2: EDIT EXISTING ALMARI */}
      {isEditAlmariOpen &&
        editingAlmari &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 modal-backdrop ulm-modal-backdrop bg-slate-900/20 dark:bg-slate-950/65 backdrop-blur-[10px] backdrop-saturate-150">
            <form
              onSubmit={handleSaveEditedAlmari}
              className="ulm-preserve-glass w-full max-w-md rounded-[26px] bg-gradient-to-br from-white/85 via-white/70 to-white/55 dark:from-[#1A102E]/92 dark:via-[#140C24]/88 dark:to-[#0F081C]/85 backdrop-blur-2xl border border-white/85 dark:border-[#FFD147]/60 p-5 space-y-4 shadow-2xl text-slate-900 dark:text-white"
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-[#8A4B00] dark:text-[#FFD147]" />
                  <h3 className="text-base font-extrabold text-[#541A72] dark:text-[#FFD147]">
                    Edit Almari ({editingAlmari.code})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditAlmariOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold mb-1 text-slate-800 dark:text-slate-200">
                    Cupboard Code
                  </label>
                  <input
                    type="text"
                    required
                    value={editAlmariCode}
                    onChange={(e) => setEditAlmariCode(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl bg-white/85 dark:bg-black/40 border border-slate-300 dark:border-white/15 font-mono text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1 text-slate-800 dark:text-slate-200">
                    Cupboard Title / Department
                  </label>
                  <input
                    type="text"
                    required
                    value={editAlmariName}
                    onChange={(e) => setEditAlmariName(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl bg-white/85 dark:bg-black/40 border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1 text-slate-800 dark:text-slate-200">
                    Location / Campus Wing
                  </label>
                  <input
                    type="text"
                    value={editAlmariWing}
                    onChange={(e) => setEditAlmariWing(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl bg-white/85 dark:bg-black/40 border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold mb-1 text-slate-800 dark:text-slate-200">
                      Number of Shelves (1–12)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={editAlmariShelves}
                      onChange={(e) => setEditAlmariShelves(parseInt(e.target.value, 10) || 5)}
                      className="w-full h-9 px-3 rounded-xl bg-white/85 dark:bg-black/40 border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-1 text-slate-800 dark:text-slate-200">
                      Capacity / Shelf (1–200)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={editAlmariShelfCap}
                      onChange={(e) => setEditAlmariShelfCap(parseInt(e.target.value, 10) || 24)}
                      className="w-full h-9 px-3 rounded-xl bg-white/85 dark:bg-black/40 border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                </div>
                {editAlmariShelves < (editingAlmari.shelf_count || 5) && (
                  <p className="text-[11px] text-amber-800 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
                    Reducing shelves from {editingAlmari.shelf_count} to {editAlmariShelves} will automatically return any volumes on removed shelves to the <strong>Unassigned Queue</strong> so zero books become orphaned.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setAlmariToDelete(editingAlmari);
                    setIsEditAlmariOpen(false);
                  }}
                  className="h-9 px-3.5 rounded-xl text-xs bg-rose-500/15 hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 border border-rose-500/40 font-extrabold flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                  <span>Delete Cupboard</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditAlmariOpen(false)}
                    className="h-9 px-3.5 rounded-xl text-xs font-semibold border border-slate-300 dark:border-white/15 text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="h-9 px-4 rounded-xl text-xs font-extrabold bg-gradient-to-r from-[#541A72] to-[#B4690E] !text-white cursor-pointer shadow-xs"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </form>
          </div>,
          document.body
        )}

      {/* MODAL 3: CONFIRM DELETE ALMARI (SAFE DELETION) */}
      {almariToDelete &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 modal-backdrop ulm-modal-backdrop bg-slate-900/20 dark:bg-slate-950/65 backdrop-blur-[10px] backdrop-saturate-150">
            <div className="ulm-preserve-glass w-full max-w-sm rounded-[26px] bg-gradient-to-br from-white/85 via-white/70 to-white/55 dark:from-[#1A102E]/92 dark:via-[#140C24]/88 dark:to-[#0F081C]/85 backdrop-blur-2xl border-2 border-rose-500/50 p-5 space-y-4 shadow-2xl text-slate-900 dark:text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-500 dark:text-rose-400 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Delete Cupboard {almariToDelete.code}?
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {almariToDelete.name_en}
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-white/60 dark:bg-black/40 p-3 rounded-xl border border-slate-200/80 dark:border-white/10">
                Are you sure you want to delete this physical cupboard?
                <br />
                <br />
                <strong className="text-amber-700 dark:text-amber-400">Safe Protection:</strong> Any books currently placed inside this Almari will <strong>NOT be deleted</strong>. They will automatically be returned to the <strong>Unassigned Queue</strong>.
              </p>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setAlmariToDelete(null)}
                  className="h-9 px-4 rounded-xl text-xs font-semibold border border-slate-300 dark:border-white/15 text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteAlmari}
                  className="h-9 px-4 rounded-xl text-xs font-extrabold bg-rose-600 hover:bg-rose-700 !text-white cursor-pointer shadow-xs"
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* MODAL 4: CLICK-TO-INSPECT & QUICK-MOVE POPOVER (IMPLICIT STATES 5 & 9) */}
      {quickMoveBook &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            onClick={() => setQuickMoveBook(null)}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 modal-backdrop ulm-modal-backdrop bg-slate-900/20 dark:bg-slate-950/65 backdrop-blur-[10px] backdrop-saturate-150"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="ulm-preserve-glass w-full max-w-md rounded-[26px] bg-gradient-to-br from-white/88 via-white/75 to-white/60 dark:from-[#1A102E]/94 dark:via-[#140C24]/90 dark:to-[#0F081C]/88 backdrop-blur-2xl border border-white/85 dark:border-[#FFD147]/50 p-5 space-y-4 shadow-2xl text-slate-900 dark:text-white"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3 border-b border-slate-200/80 dark:border-white/10 pb-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#541A72] to-[#3B1054] border border-[#FFD147]/45 flex items-center justify-center text-[#FFD147] shrink-0">
                    <ArrowRightLeft className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white leading-snug line-clamp-2">
                      {quickMoveBook.book_name}
                    </h3>
                    <p className="text-[11px] font-mono text-[#8A4B00] dark:text-[#FFD147]/85 mt-0.5 truncate">
                      Acc/Barcode: #{quickMoveBook.barcode || quickMoveBook.accession_no || quickMoveBook.id}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setQuickMoveBook(null)}
                  className="p-1 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Current Status Summary */}
              <div className="p-3 rounded-xl bg-white/60 dark:bg-black/35 border border-slate-200/80 dark:border-white/10 text-xs space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500 dark:text-slate-400">Current Location:</span>
                  <span className="font-mono font-bold text-[#541A72] dark:text-[#FFD147]">
                    {quickMoveBook.almari_code && Number(quickMoveBook.shelf_no) >= 1
                      ? `${quickMoveBook.almari_code} · Shelf ${quickMoveBook.shelf_no}`
                      : 'Unassigned Queue'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500 dark:text-slate-400">Copy Availability:</span>
                  {isBookCheckedOut(quickMoveBook) ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/40">
                      OUT ON LOAN · Home Slot Reserved
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/35">
                      ON SHELF · Available
                    </span>
                  )}
                </div>
              </div>

              {/* Quick-Move Controls */}
              {almaris.length > 0 ? (
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block font-bold mb-1 text-slate-800 dark:text-slate-200">
                      Change Almari Cupboard
                    </label>
                    <select
                      value={quickMoveAlmariId}
                      onChange={(e) => handleQuickMoveAlmariChange(e.target.value)}
                      className="w-full h-9 px-3 rounded-xl bg-white/85 dark:bg-black/45 border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white font-semibold"
                    >
                      {almaris.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} — {a.name_en} ({a.shelf_count || 5} shelves)
                        </option>
                      ))}
                    </select>
                  </div>

                  {quickMoveTargetAlmari && (
                    <div>
                      <label className="block font-bold mb-1.5 text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-[#8A4B00] dark:text-[#FFD147]" />
                        <span>Change Shelf (1–{Math.max(1, quickMoveTargetAlmari.shelf_count || 5)})</span>
                      </label>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                        {Array.from(
                          { length: Math.max(1, quickMoveTargetAlmari.shelf_count || 5) },
                          (_, i) => {
                            const sNo = i + 1;
                            const count = (
                              placementMap.byAlmariShelf.get(`${quickMoveTargetAlmari.id}::${sNo}`) ||
                              []
                            ).length;
                            const cap = getShelfCapacity(quickMoveTargetAlmari, sNo);
                            const full = count >= cap;
                            const isSelectedShelf = quickMoveShelfNo === sNo;

                            return (
                              <button
                                key={sNo}
                                type="button"
                                onClick={() => setQuickMoveShelfNo(sNo)}
                                className={`py-1.5 px-2 rounded-xl border text-center transition-all cursor-pointer ${
                                  isSelectedShelf
                                    ? 'bg-gradient-to-r from-[#541A72] to-[#3B1054] !text-white border-[#FFD147] ring-1 ring-[#FFD147]/50'
                                    : full
                                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-900 dark:text-amber-200 hover:bg-amber-500/20'
                                      : 'bg-white/70 dark:bg-white/[0.05] border-slate-200 dark:border-white/15 text-slate-800 dark:text-slate-200 hover:border-[#C8963E]'
                                }`}
                              >
                                <div className="font-mono font-extrabold text-[11px]">Shelf {sNo}</div>
                                <div
                                  className={`font-mono text-[9.5px] ${
                                    isSelectedShelf ? 'text-[#FFD147]' : 'opacity-75'
                                  }`}
                                >
                                  {count}/{cap}
                                  {full ? ' FULL' : ''}
                                </div>
                              </button>
                            );
                          }
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-900 dark:text-amber-200">
                  No physical Almaris exist yet. Create an Almari first to place this volume.
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/80 dark:border-white/10">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleOpenFullBookDetails(quickMoveBook)}
                    className="h-9 px-3 rounded-xl text-xs font-bold bg-slate-900/5 hover:bg-slate-900/10 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-slate-200 border border-slate-300/70 dark:border-white/15 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Full Details</span>
                  </button>

                  {Boolean(quickMoveBook.almari_id && Number(quickMoveBook.shelf_no) >= 1) && (
                    <button
                      type="button"
                      onClick={handleQuickMoveUnassign}
                      className="h-9 px-3 rounded-xl text-xs font-bold bg-rose-500/12 hover:bg-rose-500/22 text-rose-700 dark:text-rose-300 border border-rose-500/35 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                      <span>Unassign</span>
                    </button>
                  )}
                </div>

                {almaris.length > 0 && (
                  <button
                    type="button"
                    onClick={handleConfirmQuickMove}
                    className="h-9 px-4 rounded-xl text-xs font-extrabold bg-gradient-to-r from-[#541A72] to-[#B4690E] !text-white border border-[#FFD147]/50 shadow-xs hover:brightness-110 cursor-pointer"
                  >
                    Save Shelf Placement
                  </button>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default AlmariView;
