import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  QrCode,
  Search,
  Volume2,
  VolumeX,
  CheckCircle2,
  XCircle,
  BookOpen,
  ArrowRightLeft,
  RotateCcw,
  Printer,
  PlusCircle,
  Barcode as BarcodeIcon,
  MapPin,
  Eye,
  UserCheck,
  AlertTriangle,
  ShieldAlert,
  CreditCard,
  Check,
  Layers,
  Clock,
  X,
  ChevronRight,
  Plus,
} from 'lucide-react';
import { Book, Transaction, Borrower, Almari } from '../types/library';
import { playSuccessBarcodeBeep, playErrorBeep } from '../services/audio';
import { LibraryStorage } from '../services/storage';
import { AlmariService } from '../services/almariService';
import { StorageEngine } from '../services/storageEngine';
import { persistManualBookShelfAssignments } from '../services/libraryStorageAndMigration';
import { ULM_CREST_LOGO } from '../constants/branding';
import { MemberCard } from './cards/MemberCard';

interface BarcodeScannerViewProps {
  books: Book[];
  transactions: Transaction[];
  borrowers?: Borrower[];
  onOpenBookDetails: (bookId: string) => void;
  onQuickLoan: (book: Book) => void;
  onQuickReturn: (transactionId: string) => void;
  onPrintBarcode: (book: Book) => void;
  onOpenAddBookWithBarcode: (barcode: string) => void;
  onIssueBookToBorrower?: (
    bookId: string,
    borrowerId: string,
    daysOrDueDate?: number | string
  ) => { success?: boolean; message?: string } | void;
  onUpdateBooks?: (updatedBooks: Book[]) => void;
  onCatalogBooksUpdated?: (updatedBooks: Book[], message: string) => void;
}

const MASTER_PLACEMENTS_KEY = 'ulm_almari_placements_master_v3';
const ACTIVE_ALMARI_KEY = 'ulm_active_almari_id_v3';
const SHELF_CAPACITIES_KEY = 'ulm_shelf_capacities_v3';

const GLASS_PANEL_CLASS =
  'ulm-preserve-glass rounded-[24px] p-5 sm:p-6 bg-gradient-to-br from-white/60 via-white/40 to-white/25 dark:from-white/[0.08] dark:via-white/[0.035] dark:to-white/[0.015] backdrop-blur-2xl backdrop-saturate-[180%] border border-white/75 dark:border-white/[0.15] shadow-[inset_1.5px_1.5px_2px_rgba(255,255,255,0.65),0_12px_32px_rgba(15,23,42,0.07)] dark:shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.22),0_12px_32px_rgba(0,0,0,0.24)] text-slate-900 dark:text-white transition-all';

const GLASS_SUBCARD_CLASS =
  'rounded-2xl p-3.5 bg-white/55 dark:bg-white/[0.04] backdrop-blur-xl border border-white/70 dark:border-white/[0.10] shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.5)] dark:shadow-none';

export const BarcodeScannerView: React.FC<BarcodeScannerViewProps> = ({
  books,
  transactions,
  borrowers,
  onOpenBookDetails,
  onQuickReturn,
  onPrintBarcode,
  onOpenAddBookWithBarcode,
  onIssueBookToBorrower,
  onUpdateBooks,
  onCatalogBooksUpdated,
}) => {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoSubmit, setAutoSubmit] = useState(true);
  const [searchedBarcode, setSearchedBarcode] = useState<string | null>(null);
  const [foundBook, setFoundBook] = useState<Book | null>(null);
  const [foundBorrower, setFoundBorrower] = useState<Borrower | null>(null);
  const [scanState, setScanState] = useState<'IDLE' | 'BOOK_FOUND' | 'BORROWER_FOUND' | 'NOT_FOUND'>('IDLE');
  const [isScanSuccessFlash, setIsScanSuccessFlash] = useState(false);

  // Quick Issue input state for active borrower
  const [issueBookInput, setIssueBookInput] = useState('');
  const [issueMessage, setIssueMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ---------------- STATE 1: LIVE CUPBOARDS REGISTRY & AUTHORITATIVE PLACEMENTS ----------------
  const [almaris, setAlmaris] = useState<Almari[]>(() => {
    AlmariService.resetCaches();
    return AlmariService.getAlmaris();
  });

  const [masterPlacements, setMasterPlacements] = useState<
    Record<string, { almari_id: string; almari_code: string; shelf_no: number }>
  >(() => {
    try {
      const raw = localStorage.getItem(MASTER_PLACEMENTS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const [shelfCapacities, setShelfCapacities] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem(SHELF_CAPACITIES_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const refreshAlmarisAndPlacements = useCallback(() => {
    AlmariService.resetCaches();
    const freshAlmaris = AlmariService.getAlmaris();
    setAlmaris(freshAlmaris);
    try {
      const rawPlacements = localStorage.getItem(MASTER_PLACEMENTS_KEY);
      if (rawPlacements) setMasterPlacements(JSON.parse(rawPlacements));
    } catch {}
    try {
      const rawCaps = localStorage.getItem(SHELF_CAPACITIES_KEY);
      if (rawCaps) setShelfCapacities(JSON.parse(rawCaps));
    } catch {}
    return freshAlmaris;
  }, []);

  // Mode A: Inline Almari & Shelf placement state
  const [isPlacingInAlmari, setIsPlacingInAlmari] = useState(false);
  const [selectedPlacementAlmariId, setSelectedPlacementAlmariId] = useState<string>('');
  const [selectedPlacementShelfNo, setSelectedPlacementShelfNo] = useState<number>(1);
  const [applyToSiblingCopies, setApplyToSiblingCopies] = useState<boolean>(false);
  const [placementSuccessMsg, setPlacementSuccessMsg] = useState<string | null>(null);
  const [postReturnReshelveBanner, setPostReturnReshelveBanner] = useState<{
    type: 'assigned' | 'unassigned';
    text: string;
  } | null>(null);

  // State 6: Quick Create Cupboard inline state
  const [isQuickCreatingAlmari, setIsQuickCreatingAlmari] = useState<boolean>(false);
  const [quickAlmariCode, setQuickAlmariCode] = useState<string>('');
  const [quickAlmariName, setQuickAlmariName] = useState<string>('');
  const [quickAlmariShelves, setQuickAlmariShelves] = useState<number>(5);

  // Mode A: Chained Scan (Book -> Student ID Barcode -> Loan Duration Selector)
  const [isChainedIssueActive, setIsChainedIssueActive] = useState(true);
  const [chainedStudentInput, setChainedStudentInput] = useState('');
  const [chainedStudentError, setChainedStudentError] = useState<string | null>(null);

  // Mode B: Book search / selection inside Student View
  const [bookSearchForStudent, setBookSearchForStudent] = useState('');

  // Loan Duration Selector Dialog State
  const [isDurationSelectorOpen, setIsDurationSelectorOpen] = useState(false);
  const [pendingDurationTarget, setPendingDurationTarget] = useState<{ book: Book; borrower: Borrower } | null>(null);
  const [selectedDurationDays, setSelectedDurationDays] = useState<number>(14);
  const [customDaysInput, setCustomDaysInput] = useState<string>('14');
  const [isSubmittingLoan, setIsSubmittingLoan] = useState(false);

  // Local optimistic tracking of newly issued / returned book IDs before parent re-render
  const [locallyIssuedBookIds, setLocallyIssuedBookIds] = useState<Record<string, boolean>>({});

  const inputRef = useRef<HTMLInputElement>(null);
  const issueInputRef = useRef<HTMLInputElement>(null);
  const chainedStudentInputRef = useRef<HTMLInputElement>(null);

  // Sync local optimistic map whenever props change
  useEffect(() => {
    setLocallyIssuedBookIds({});
  }, [books, transactions]);

  // Keep foundBook synced with latest books prop
  useEffect(() => {
    if (foundBook) {
      const updated = books.find(b => b.id === foundBook.id);
      if (updated) {
        setFoundBook(updated);
      }
    }
  }, [books, foundBook]);

  // Auto focus input on mount and whenever returning to idle
  useEffect(() => {
    if (scanState === 'IDLE') {
      inputRef.current?.focus();
    } else if (scanState === 'BORROWER_FOUND') {
      issueInputRef.current?.focus();
    } else if (scanState === 'BOOK_FOUND') {
      chainedStudentInputRef.current?.focus();
    }
  }, [scanState]);

  const activeBorrowersList = useMemo(() => {
    return borrowers && borrowers.length > 0 ? borrowers : LibraryStorage.getBorrowers();
  }, [borrowers]);

  // ---------------- AUTHORITATIVE BOOK PLACEMENT RESOLVER (NEVER SHOWS RAW alm-ih-01) ----------------
  const resolveBookPlacement = useCallback(
    (
      book: Book | null | undefined,
      customAlmaris?: Almari[],
      customPlacements?: Record<string, { almari_id: string; almari_code: string; shelf_no: number }>
    ) => {
      if (!book) {
        return {
          almari: null as Almari | null,
          shelfNo: 0,
          label: 'Unassigned (No Almari)',
          fullLabel: 'Unassigned (In Queue)',
        };
      }

      const activeAlmaris = customAlmaris || almaris;
      const activePlacements = customPlacements || masterPlacements;

      const idKey = book.id ? String(book.id).trim() : '';
      const bcKey = book.barcode ? String(book.barcode).trim() : '';
      const override = (idKey ? activePlacements[idKey] : undefined) || (bcKey ? activePlacements[bcKey] : undefined);

      const targetAlmariId = override ? override.almari_id : book.almari_id || '';
      const targetAlmariCode = override
        ? override.almari_code
        : (book as any).almari_code || book.cupboard || '';
      const targetShelfNo = Number(override ? override.shelf_no : book.shelf_no ?? 0);

      const matchedAlmari =
        activeAlmaris.find(
          a =>
            (targetAlmariId && a.id === targetAlmariId) ||
            (targetAlmariCode && a.code.toUpperCase() === targetAlmariCode.toUpperCase())
        ) || null;

      if (matchedAlmari && targetShelfNo >= 1) {
        return {
          almari: matchedAlmari,
          shelfNo: targetShelfNo,
          label: `${matchedAlmari.code} · Shelf ${targetShelfNo}`,
          fullLabel: `${matchedAlmari.code} (${matchedAlmari.name_en}) · Shelf ${targetShelfNo}`,
        };
      }

      return {
        almari: null,
        shelfNo: 0,
        label: 'Unassigned (No Almari)',
        fullLabel: 'Unassigned (In Queue)',
      };
    },
    [almaris, masterPlacements]
  );

  // ---------------- STATE 2: DYNAMIC SHELF CAPACITY & LIVE OCCUPANCY ----------------
  const getShelfCapacity = useCallback(
    (almari: Almari | null | undefined, shelfNo: number): number => {
      if (!almari) return 25;
      const key = `${almari.id}::${shelfNo}`;
      if (shelfCapacities[key] !== undefined) return shelfCapacities[key];
      if (almari.books_per_shelf && almari.books_per_shelf > 0) return almari.books_per_shelf;
      return Math.max(
        1,
        Math.min(50, Math.round((almari.approx_capacity || 125) / Math.max(1, almari.shelf_count || 5)))
      );
    },
    [shelfCapacities]
  );

  const getShelfOccupancyCount = useCallback(
    (almariId: string, shelfNo: number): number => {
      if (!almariId || shelfNo < 1) return 0;
      let count = 0;
      for (const b of books) {
        if (!b.is_active) continue;
        const resolved = resolveBookPlacement(b);
        if (resolved.almari?.id === almariId && resolved.shelfNo === shelfNo) {
          count++;
        }
      }
      return count;
    },
    [books, resolveBookPlacement]
  );

  const activePlacementAlmari = useMemo(() => {
    if (!selectedPlacementAlmariId || selectedPlacementAlmariId === '__UNASSIGN__') return null;
    return almaris.find(a => a.id === selectedPlacementAlmariId) || almaris[0] || null;
  }, [almaris, selectedPlacementAlmariId]);

  // Clamp selectedPlacementShelfNo whenever activePlacementAlmari changes
  useEffect(() => {
    if (activePlacementAlmari) {
      const maxShelves = Math.max(1, activePlacementAlmari.shelf_count || 5);
      if (selectedPlacementShelfNo > maxShelves || selectedPlacementShelfNo < 1) {
        setSelectedPlacementShelfNo(1);
      }
    }
  }, [activePlacementAlmari, selectedPlacementShelfNo]);

  // Initialize placement selector values for a given book
  const syncPlacementControlsForBook = useCallback(
    (book: Book, freshAlmarisList?: Almari[]) => {
      const list = freshAlmarisList || almaris;
      const current = resolveBookPlacement(book, list);
      if (current.almari && current.shelfNo >= 1) {
        setSelectedPlacementAlmariId(current.almari.id);
        setSelectedPlacementShelfNo(
          Math.min(Math.max(1, current.almari.shelf_count || 5), current.shelfNo)
        );
      } else if (list.length > 0) {
        setSelectedPlacementAlmariId(list[0].id);
        setSelectedPlacementShelfNo(1);
      } else {
        setSelectedPlacementAlmariId('__UNASSIGN__');
        setSelectedPlacementShelfNo(1);
      }
      setApplyToSiblingCopies(false);
    },
    [almaris, resolveBookPlacement]
  );

  // ---------------- STATE 5: SIBLING COPIES DETECTION ----------------
  const siblingCopiesInfo = useMemo(() => {
    if (!foundBook) return { allSiblings: [] as Book[], unassignedSiblings: [] as Book[] };
    const normTitle = (foundBook.book_name || '').trim().toLowerCase();
    const normAuthor = (foundBook.author || '').trim().toLowerCase();
    const allSiblings = books.filter(
      b =>
        b.is_active &&
        b.id !== foundBook.id &&
        (b.book_name || '').trim().toLowerCase() === normTitle &&
        (b.author || '').trim().toLowerCase() === normAuthor
    );
    const unassignedSiblings = allSiblings.filter(b => !resolveBookPlacement(b).almari);
    return { allSiblings, unassignedSiblings };
  }, [foundBook, books, resolveBookPlacement]);

  // Helper: Determine if a specific book copy is currently checked out
  const isCopyCheckedOut = useCallback(
    (book: Book | null | undefined): boolean => {
      if (!book) return false;
      if (locallyIssuedBookIds[book.id] === true) return true;
      if (locallyIssuedBookIds[book.id] === false) return false;

      const st = String(book.status || '').toUpperCase();
      if (st === 'ISSUED' || st === 'BORROWED' || st === 'ON_LOAN') return true;
      if (Number(book.available_copies ?? book.available_quantity ?? 1) <= 0) return true;

      const totalCopies = Math.max(1, Number(book.total_quantity ?? book.copies ?? 1));
      const activeLoanCount = transactions.filter(t => {
        const txStatus = String(t.status || '').toUpperCase();
        if (txStatus === 'RETURNED') return false;
        return (
          String(t.book_id || '') === String(book.id) ||
          (Boolean(book.barcode) && String(t.barcode || '') === String(book.barcode))
        );
      }).length;

      return activeLoanCount >= totalCopies;
    },
    [transactions, locallyIssuedBookIds]
  );

  // Helper: Check borrower eligibility
  const checkBorrowerEligibility = useCallback(
    (borrower: Borrower) => {
      const activeLoans = transactions.filter(
        t => t.borrower_id === borrower.id && t.status !== 'RETURNED'
      );
      const todayIsoStr = new Date().toISOString().split('T')[0];
      let overdueCount = 0;
      let totalFine = 0;
      activeLoans.forEach(loan => {
        if (loan.due_date && loan.due_date < todayIsoStr) {
          overdueCount++;
          const msDiff = new Date(todayIsoStr).getTime() - new Date(loan.due_date).getTime();
          const daysOverdue = Math.max(0, Math.floor(msDiff / (1000 * 60 * 60 * 24)));
          totalFine += daysOverdue * 10;
        }
      });
      const quotaLimit =
        borrower.borrow_limit ||
        (borrower.role === 'Faculty' ? 10 : borrower.role === 'Staff' ? 5 : 3);
      return {
        activeLoans,
        overdueCount,
        totalFine,
        quotaLimit,
        isQuotaReached: activeLoans.length >= quotaLimit,
        isBlockedOverdue: overdueCount > 0 || totalFine > 0,
      };
    },
    [transactions]
  );

  // Helper: Open Loan Duration Selector Modal for a (book, borrower) pair
  const openDurationSelectorModal = useCallback(
    (targetBook: Book, targetBorrower: Borrower) => {
      if (isCopyCheckedOut(targetBook)) {
        setIssueMessage({
          type: 'error',
          text: `Copy "${targetBook.book_name}" (Acc #${targetBook.accession_no || targetBook.barcode}) is already checked out.`,
        });
        if (soundEnabled) playErrorBeep();
        return;
      }

      const elig = checkBorrowerEligibility(targetBorrower);
      if (elig.isBlockedOverdue) {
        setIssueMessage({
          type: 'error',
          text: `Cannot issue book: ${targetBorrower.name} has ${elig.overdueCount} overdue book(s) and unpaid fine of Rs. ${elig.totalFine}.`,
        });
        if (soundEnabled) playErrorBeep();
        return;
      }
      if (elig.isQuotaReached) {
        setIssueMessage({
          type: 'error',
          text: `Cannot issue book: ${targetBorrower.name} has reached maximum borrowing quota (${elig.activeLoans.length} / ${elig.quotaLimit} Books).`,
        });
        if (soundEnabled) playErrorBeep();
        return;
      }

      setPendingDurationTarget({ book: targetBook, borrower: targetBorrower });
      setSelectedDurationDays(targetBorrower.role === 'Faculty' ? 30 : 14);
      setCustomDaysInput(String(targetBorrower.role === 'Faculty' ? 30 : 14));
      setIsDurationSelectorOpen(true);
    },
    [isCopyCheckedOut, checkBorrowerEligibility, soundEnabled]
  );

  const handleSearch = (codeToSearch: string) => {
    const cleanCode = codeToSearch.trim();
    if (!cleanCode) return;

    const freshAlmaris = refreshAlmarisAndPlacements();
    setSearchedBarcode(cleanCode);
    const cleanLower = cleanCode.toLowerCase();

    // 1. Check if the scanned barcode matches a Borrower Card / ID
    const borrower = activeBorrowersList.find(
      b =>
        b.is_active &&
        (b.barcode?.toLowerCase() === cleanLower ||
          b.university_id?.toLowerCase() === cleanLower ||
          b.student_id?.toLowerCase() === cleanLower ||
          b.id?.toLowerCase() === cleanLower ||
          b.name?.toLowerCase() === cleanLower ||
          (b.roll_number && b.roll_number.toLowerCase() === cleanLower))
    );

    if (borrower) {
      // IMPLICIT PAIRING: If a book was ALREADY scanned first and is available, pair them immediately!
      if (scanState === 'BOOK_FOUND' && foundBook && !isCopyCheckedOut(foundBook)) {
        setFoundBorrower(borrower);
        setChainedStudentError(null);
        setIsScanSuccessFlash(true);
        setTimeout(() => setIsScanSuccessFlash(false), 300);
        if (soundEnabled) playSuccessBarcodeBeep();
        openDurationSelectorModal(foundBook, borrower);
        return;
      }

      setFoundBorrower(borrower);
      setFoundBook(null);
      setScanState('BORROWER_FOUND');
      setIssueMessage(null);
      setIssueBookInput('');
      setIsPlacingInAlmari(false);
      setPostReturnReshelveBanner(null);
      setIsChainedIssueActive(false);
      setIsScanSuccessFlash(true);
      setTimeout(() => setIsScanSuccessFlash(false), 300);
      if (soundEnabled) playSuccessBarcodeBeep();
      return;
    }

    // 2. Check if the scanned barcode matches a Cataloged Book
    const book = books.find(
      b =>
        b.is_active &&
        (b.barcode.trim().toUpperCase() === cleanCode.toUpperCase() ||
          (b.accession_no && b.accession_no.trim().toUpperCase() === cleanCode.toUpperCase()) ||
          (b.isbn && b.isbn.replace(/[-\s]/g, '') === cleanCode.replace(/[-\s]/g, '')))
    );

    if (book) {
      // IMPLICIT PAIRING: If a borrower is ALREADY active and scans a book in the top scanner, pair them immediately!
      if (scanState === 'BORROWER_FOUND' && foundBorrower && !isCopyCheckedOut(book)) {
        setFoundBook(book);
        setIsScanSuccessFlash(true);
        setTimeout(() => setIsScanSuccessFlash(false), 300);
        if (soundEnabled) playSuccessBarcodeBeep();
        openDurationSelectorModal(book, foundBorrower);
        return;
      }

      setFoundBook(book);
      setFoundBorrower(null);
      setScanState('BOOK_FOUND');
      setIssueMessage(null);
      setIsPlacingInAlmari(false);
      setPostReturnReshelveBanner(null);
      setIsChainedIssueActive(true);
      setChainedStudentError(null);
      setPlacementSuccessMsg(null);
      syncPlacementControlsForBook(book, freshAlmaris);
      setIsScanSuccessFlash(true);
      setTimeout(() => setIsScanSuccessFlash(false), 300);
      if (soundEnabled) playSuccessBarcodeBeep();
      return;
    }

    // 3. Not Found in either table
    setFoundBook(null);
    setFoundBorrower(null);
    setScanState('NOT_FOUND');
    if (soundEnabled) playErrorBeep();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(barcodeInput);
  };

  const handleTestScan = (testBarcode: string) => {
    setBarcodeInput(testBarcode);
    handleSearch(testBarcode);
  };

  const resetScanner = () => {
    setBarcodeInput('');
    setSearchedBarcode(null);
    setFoundBook(null);
    setFoundBorrower(null);
    setIssueMessage(null);
    setIssueBookInput('');
    setBookSearchForStudent('');
    setIsPlacingInAlmari(false);
    setPostReturnReshelveBanner(null);
    setIsChainedIssueActive(true);
    setChainedStudentInput('');
    setChainedStudentError(null);
    setPlacementSuccessMsg(null);
    setIsDurationSelectorOpen(false);
    setPendingDurationTarget(null);
    setScanState('IDLE');
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  // ---------------- STATE 3: ATOMIC 4-LAYER SAVE (100% SYNCED WITH 3D MANUAL ALMARI VIEW) ----------------
  const executePlacementSave = (overrideShelfNo?: number) => {
    if (!foundBook) return;

    const targetShelfNo = overrideShelfNo ?? selectedPlacementShelfNo;
    let nextPlacements: Record<string, { almari_id: string; almari_code: string; shelf_no: number }> = {
      ...masterPlacements,
    };
    try {
      const raw = localStorage.getItem(MASTER_PLACEMENTS_KEY);
      if (raw) {
        nextPlacements = { ...JSON.parse(raw), ...nextPlacements };
      }
    } catch {}

    // Determine target books (just foundBook, or foundBook + sibling copies if checked)
    const booksToMove: Book[] = [foundBook];
    if (applyToSiblingCopies && selectedPlacementAlmariId !== '__UNASSIGN__') {
      const targetSiblings =
        siblingCopiesInfo.unassignedSiblings.length > 0
          ? siblingCopiesInfo.unassignedSiblings
          : siblingCopiesInfo.allSiblings;
      booksToMove.push(...targetSiblings);
    }

    const moveIdsSet = new Set(booksToMove.map(b => b.id));
    const updatedBooksToPersist: Book[] = [];

    if (selectedPlacementAlmariId === '__UNASSIGN__') {
      // Unassign from Cupboard
      for (const b of booksToMove) {
        const idKey = b.id ? String(b.id).trim() : '';
        const bcKey = b.barcode ? String(b.barcode).trim() : '';
        if (idKey) delete nextPlacements[idKey];
        if (bcKey) delete nextPlacements[bcKey];

        const unassignedBook: Book = {
          ...b,
          almari_id: undefined,
          almari_code: '',
          almari_name: '',
          cupboard: '',
          shelf_no: 0,
          shelf: 'Unassigned (No Almari)',
          row: '',
          placement_locked: false,
          location_source: 'manual',
          updated_at: new Date().toISOString(),
        };
        updatedBooksToPersist.push(unassignedBook);
      }

      try {
        localStorage.setItem(MASTER_PLACEMENTS_KEY, JSON.stringify(nextPlacements));
      } catch {}
      setMasterPlacements(nextPlacements);

      const primaryUpdated = updatedBooksToPersist[0];
      setFoundBook(primaryUpdated);

      for (const ub of updatedBooksToPersist) {
        try {
          LibraryStorage.updateBook(ub.id, ub);
        } catch {}
      }

      const updatedAllBooks = books.map(b => {
        const match = updatedBooksToPersist.find(u => u.id === b.id);
        return match || b;
      });
      if (onUpdateBooks) onUpdateBooks(updatedAllBooks);
      if (onCatalogBooksUpdated) {
        onCatalogBooksUpdated(
          updatedAllBooks,
          `Removed "${primaryUpdated.book_name}" from Almari (moved to Unassigned Queue).`
        );
      }

      setPlacementSuccessMsg(
        `✓ Removed "${primaryUpdated.book_name}" (Acc #${primaryUpdated.accession_no || primaryUpdated.barcode}) from Almari — now in Unassigned Queue.`
      );
      setPostReturnReshelveBanner(null);
      if (soundEnabled) playSuccessBarcodeBeep();
      setTimeout(() => setPlacementSuccessMsg(null), 5000);
      return;
    }

    // Assigning to targetAlmari & targetShelfNo
    const targetAlmari =
      almaris.find(a => a.id === selectedPlacementAlmariId) || activePlacementAlmari;
    if (!targetAlmari) return;

    const clampedShelfNo = Math.max(
      1,
      Math.min(Math.max(1, targetAlmari.shelf_count || 5), Number(targetShelfNo) || 1)
    );
    setSelectedPlacementShelfNo(clampedShelfNo);

    const entry = {
      almari_id: targetAlmari.id,
      almari_code: targetAlmari.code,
      shelf_no: clampedShelfNo,
    };

    for (const b of booksToMove) {
      const idKey = b.id ? String(b.id).trim() : '';
      const bcKey = b.barcode ? String(b.barcode).trim() : '';
      if (idKey) nextPlacements[idKey] = entry;
      if (bcKey) nextPlacements[bcKey] = entry;

      const updatedBook: Book = {
        ...b,
        almari_id: targetAlmari.id,
        almari_code: targetAlmari.code,
        almari_name: targetAlmari.name_en,
        cupboard: targetAlmari.code,
        shelf_no: clampedShelfNo,
        shelf: `${targetAlmari.code} · Shelf ${clampedShelfNo}`,
        row: `Shelf ${clampedShelfNo}`,
        section: targetAlmari.name_en,
        placement_locked: true,
        location_source: 'manual',
        updated_at: new Date().toISOString(),
      };
      updatedBooksToPersist.push(updatedBook);
    }

    // 1. Write dual-key override to ulm_almari_placements_master_v3 & active almari ID
    try {
      localStorage.setItem(MASTER_PLACEMENTS_KEY, JSON.stringify(nextPlacements));
      localStorage.setItem(ACTIVE_ALMARI_KEY, targetAlmari.id);
    } catch {}
    setMasterPlacements(nextPlacements);

    const primaryUpdated = updatedBooksToPersist[0];
    setFoundBook(primaryUpdated);

    // 2. Persist to LibraryStorage & SQLite/IDB migration tables
    try {
      for (const ub of updatedBooksToPersist) {
        LibraryStorage.updateBook(ub.id, ub);
        StorageEngine.upsertBook({
          accession: ub.barcode || ub.accession_no || ub.id || '',
          title: ub.book_name,
          author: ub.author,
          isbn: ub.isbn || '',
          category: ub.category || 'General',
          almariId: targetAlmari.id,
          shelfId: String(clampedShelfNo),
          status: ub.status === 'ISSUED' ? 'ISSUED' : 'AVAILABLE',
          updatedAt: new Date().toISOString(),
        }).catch(() => {});
      }
      persistManualBookShelfAssignments(updatedBooksToPersist);
    } catch {}

    // 3. Update parent App.tsx books list
    const updatedAllBooks = books.map(b => {
      if (!moveIdsSet.has(b.id)) return b;
      return updatedBooksToPersist.find(u => u.id === b.id) || b;
    });

    const confirmationText =
      updatedBooksToPersist.length > 1
        ? `✓ Stored ${updatedBooksToPersist.length} copies of "${primaryUpdated.book_name}" in ${targetAlmari.code} (${targetAlmari.name_en}) • Shelf ${clampedShelfNo}`
        : `✓ Stored "${primaryUpdated.book_name}" (Acc #${primaryUpdated.accession_no || primaryUpdated.barcode}) in ${targetAlmari.code} (${targetAlmari.name_en}) • Shelf ${clampedShelfNo}`;

    if (onUpdateBooks) onUpdateBooks(updatedAllBooks);
    if (onCatalogBooksUpdated) onCatalogBooksUpdated(updatedAllBooks, confirmationText);

    setPlacementSuccessMsg(confirmationText);
    setPostReturnReshelveBanner(null);
    setApplyToSiblingCopies(false);
    if (soundEnabled) playSuccessBarcodeBeep();
    setTimeout(() => setPlacementSuccessMsg(null), 5000);
  };

  // ---------------- STATE 6: INLINE QUICK CREATE CUPBOARD ----------------
  const handleQuickCreateAlmari = (e: React.FormEvent) => {
    e.preventDefault();
    const code =
      quickAlmariCode.trim().toUpperCase() ||
      `ALM-${String(almaris.length + 1).padStart(2, '0')}`;
    const nameEn = quickAlmariName.trim() || `Academic Cupboard ${almaris.length + 1}`;
    const shelfCount = Math.max(1, Math.min(12, Number(quickAlmariShelves) || 5));

    const created = AlmariService.saveAlmari({
      code,
      name_en: nameEn,
      name_ur: nameEn,
      location: 'Main Hall • Ground Floor',
      location_note: 'Main Hall • Ground Floor',
      shelf_count: shelfCount,
      books_per_shelf: 25,
      approx_capacity: shelfCount * 25,
      is_active: true,
    });

    const refreshed = refreshAlmarisAndPlacements();
    setSelectedPlacementAlmariId(created.id);
    setSelectedPlacementShelfNo(1);
    setIsQuickCreatingAlmari(false);
    setQuickAlmariCode('');
    setQuickAlmariName('');
    setPlacementSuccessMsg(
      `✓ Created Cupboard ${created.code} (${created.name_en}) with ${shelfCount} shelves (${refreshed.length} total cupboards).`
    );
    if (soundEnabled) playSuccessBarcodeBeep();
  };

  // Chained scan: Book -> Student scan -> Auto prompt Loan Duration
  const handleChainedStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!foundBook) return;
    const q = chainedStudentInput.trim().toLowerCase();
    if (!q) return;

    const student = activeBorrowersList.find(
      b =>
        b.is_active &&
        (b.barcode?.toLowerCase() === q ||
          b.university_id?.toLowerCase() === q ||
          b.student_id?.toLowerCase() === q ||
          b.id?.toLowerCase() === q ||
          b.name?.toLowerCase().includes(q) ||
          (b.roll_number && b.roll_number.toLowerCase().includes(q)))
    );

    if (!student) {
      setChainedStudentError(`Student/Member "${chainedStudentInput}" not found in database.`);
      if (soundEnabled) playErrorBeep();
      return;
    }

    setChainedStudentError(null);
    setChainedStudentInput('');
    openDurationSelectorModal(foundBook, student);
  };

  // Mode B: Select book to issue to active student
  const handleSelectBookForStudent = (targetBook: Book) => {
    if (!foundBorrower) return;
    openDurationSelectorModal(targetBook, foundBorrower);
  };

  // Confirm issue loan after selecting loan duration
  const handleConfirmIssueLoan = () => {
    if (!pendingDurationTarget) return;
    const { book: targetBook, borrower: targetBorrower } = pendingDurationTarget;

    if (isCopyCheckedOut(targetBook)) {
      setIssueMessage({
        type: 'error',
        text: `Copy "${targetBook.book_name}" (Acc #${targetBook.accession_no || targetBook.barcode}) is already checked out.`,
      });
      setIsDurationSelectorOpen(false);
      setPendingDurationTarget(null);
      if (soundEnabled) playErrorBeep();
      return;
    }

    setIsSubmittingLoan(true);
    const duration = selectedDurationDays;

    let issueSuccess = true;
    let issueMsg = `Successfully issued "${targetBook.book_name}" (Acc #${targetBook.accession_no || targetBook.barcode}) to ${targetBorrower.name} for ${duration} days!`;

    if (onIssueBookToBorrower) {
      const res = onIssueBookToBorrower(targetBook.id, targetBorrower.id, duration);
      if (res && typeof res === 'object' && res.success === false) {
        issueSuccess = false;
        issueMsg = res.message || 'Could not issue book.';
      }
    } else {
      const res = LibraryStorage.issueBook(targetBook.id, targetBorrower.id, duration);
      issueSuccess = res.success;
      if (!res.success) issueMsg = res.message;
    }

    if (issueSuccess) {
      setLocallyIssuedBookIds(prev => ({ ...prev, [targetBook.id]: true }));
      if (soundEnabled) playSuccessBarcodeBeep();
      setIssueMessage({
        type: 'success',
        text: issueMsg,
      });

      if (foundBook && foundBook.id === targetBook.id) {
        const nextAvail = Math.max(0, (foundBook.available_quantity ?? 1) - 1);
        setFoundBook({
          ...foundBook,
          available_quantity: nextAvail,
          available_copies: nextAvail,
          status: nextAvail <= 0 ? 'ISSUED' : 'AVAILABLE',
        });
      }
    } else {
      if (soundEnabled) playErrorBeep();
      setIssueMessage({
        type: 'error',
        text: issueMsg,
      });
    }

    setIsSubmittingLoan(false);
    setIsDurationSelectorOpen(false);
    setPendingDurationTarget(null);
  };

  // ---------------- STATE 4: POST-RETURN RESHELVING PROMPT ----------------
  const handleInstantReturn = (loan: Transaction) => {
    onQuickReturn(loan.id);
    if (loan.book_id) {
      setLocallyIssuedBookIds(prev => ({ ...prev, [loan.book_id]: false }));
    }

    const freshAlmaris = refreshAlmarisAndPlacements();

    if (foundBook && (foundBook.id === loan.book_id || foundBook.barcode === loan.barcode)) {
      const nextAvail = Math.min(
        Math.max(1, foundBook.total_quantity || 1),
        (foundBook.available_quantity || 0) + 1
      );
      const updatedReturnedBook: Book = {
        ...foundBook,
        available_quantity: nextAvail,
        available_copies: nextAvail,
        status: 'AVAILABLE',
      };
      setFoundBook(updatedReturnedBook);

      // Automatically open Place in Almari & Shelf Location panel with Post-Return Reshelving Prompt
      const currentPlacement = resolveBookPlacement(updatedReturnedBook, freshAlmaris);
      syncPlacementControlsForBook(updatedReturnedBook, freshAlmaris);
      setIsPlacingInAlmari(true);

      if (currentPlacement.almari && currentPlacement.shelfNo >= 1) {
        setPostReturnReshelveBanner({
          type: 'assigned',
          text: `✓ Book Returned to Stack! Reshelve in ${currentPlacement.almari.code} (${currentPlacement.almari.name_en}) • Shelf ${currentPlacement.shelfNo} — or select a different shelf below to relocate it.`,
        });
      } else {
        setPostReturnReshelveBanner({
          type: 'unassigned',
          text: `✓ Book Returned! This volume has no Almari assigned yet — select an Almari Cupboard and Shelf below and click Save Location.`,
        });
      }
    }

    setIssueMessage({
      type: 'success',
      text: `Returned "${loan.book_name}" to catalog shelf (+1 available).`,
    });
  };

  // Loans for active book
  const activeBookLoans = useMemo(() => {
    if (!foundBook) return [];
    return transactions.filter(
      t =>
        (t.book_id === foundBook.id || (foundBook.barcode && t.barcode === foundBook.barcode)) &&
        t.status !== 'RETURNED'
    );
  }, [foundBook, transactions]);

  // Loans and quota metrics for active borrower
  const borrowerEligibility = useMemo(() => {
    if (!foundBorrower) {
      return {
        activeLoans: [] as Transaction[],
        overdueCount: 0,
        totalFine: 0,
        quotaLimit: 3,
        isQuotaReached: false,
        isBlockedOverdue: false,
      };
    }
    return checkBorrowerEligibility(foundBorrower);
  }, [foundBorrower, checkBorrowerEligibility]);

  const borrowerActiveLoans = borrowerEligibility.activeLoans;
  const borrowerOverdueCount = borrowerEligibility.overdueCount;
  const borrowerTotalFine = borrowerEligibility.totalFine;
  const maxAllowedQuota = borrowerEligibility.quotaLimit;
  const isQuotaReached = borrowerEligibility.isQuotaReached;
  const isBlockedOverdue = borrowerEligibility.isBlockedOverdue;
  const todayIso = new Date().toISOString().split('T')[0];

  // Available catalog volumes filtered strictly by !isCopyCheckedOut(b)
  const availableCatalogVolumes = useMemo(() => {
    return books
      .filter(b => b.is_active && !isCopyCheckedOut(b))
      .filter(b => {
        if (!bookSearchForStudent.trim()) return true;
        const q = bookSearchForStudent.toLowerCase();
        return (
          b.book_name.toLowerCase().includes(q) ||
          b.author.toLowerCase().includes(q) ||
          b.barcode.toLowerCase().includes(q) ||
          (b.accession_no && b.accession_no.toLowerCase().includes(q)) ||
          (b.category && b.category.toLowerCase().includes(q))
        );
      });
  }, [books, isCopyCheckedOut, bookSearchForStudent]);

  // Eligible members filtered for Book-First quick selection
  const matchingBorrowersForBook = useMemo(() => {
    const q = chainedStudentInput.trim().toLowerCase();
    return activeBorrowersList
      .filter(b => b.is_active)
      .filter(b => {
        if (!q) return true;
        return (
          b.name?.toLowerCase().includes(q) ||
          b.barcode?.toLowerCase().includes(q) ||
          b.university_id?.toLowerCase().includes(q) ||
          b.student_id?.toLowerCase().includes(q) ||
          b.roll_number?.toLowerCase().includes(q) ||
          b.department?.toLowerCase().includes(q)
        );
      })
      .slice(0, 6);
  }, [activeBorrowersList, chainedStudentInput]);

  // Handle Quick Issue Book directly inside Borrower Card
  const handleIssueBookToActiveBorrower = (e: React.FormEvent) => {
    e.preventDefault();
    if (!foundBorrower) return;

    const cleanBookCode = issueBookInput.trim();
    if (!cleanBookCode) return;

    const targetBook = books.find(
      b =>
        b.is_active &&
        (b.barcode.trim().toUpperCase() === cleanBookCode.toUpperCase() ||
          (b.accession_no && b.accession_no.trim().toUpperCase() === cleanBookCode.toUpperCase()) ||
          b.book_name.toLowerCase() === cleanBookCode.toLowerCase())
    );

    if (!targetBook) {
      setIssueMessage({
        type: 'error',
        text: `Book with barcode/accession "${cleanBookCode}" not found in catalog.`,
      });
      if (soundEnabled) playErrorBeep();
      return;
    }

    if (isCopyCheckedOut(targetBook)) {
      setIssueMessage({
        type: 'error',
        text: `Copy "${targetBook.book_name}" (Acc #${targetBook.accession_no || targetBook.barcode}) is already checked out.`,
      });
      if (soundEnabled) playErrorBeep();
      return;
    }

    openDurationSelectorModal(targetBook, foundBorrower);
    setIssueBookInput('');
    setBookSearchForStudent('');
  };

  // Preview book for IDLE right desk
  const previewDeskBook = foundBook || books[0] || null;
  const isPreviewBookCheckedOut = previewDeskBook ? isCopyCheckedOut(previewDeskBook) : false;
  const isFoundBookCheckedOut = foundBook ? isCopyCheckedOut(foundBook) : false;
  const foundBookCurrentPlacement = useMemo(
    () => resolveBookPlacement(foundBook),
    [foundBook, resolveBookPlacement]
  );

  return (
    <div className="w-full h-auto min-h-0 flex flex-col gap-5 px-4 sm:px-6 lg:px-8 pt-5 pb-12 overflow-visible">
      <div className="max-w-[1280px] w-full mx-auto space-y-6">
        {/* Top Header Card */}
        <div className={`flex flex-wrap items-center justify-between gap-4 ${GLASS_PANEL_CLASS}`}>
          <div>
            <h2
              className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2.5 tracking-tight"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              <div className="w-9 h-9 rounded-xl bg-[#C8963E]/15 border border-[#C8963E]/40 flex items-center justify-center text-[#C8963E] shrink-0">
                <QrCode className="w-5 h-5" />
              </div>
              <span>Barcode Scanner &amp; Hardware Station</span>
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
              Unified laser lookup: Scan either a <strong>Student/Faculty Card</strong> or a <strong>Book Barcode</strong> in any order to issue, return, or locate volumes.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                soundEnabled
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                  : 'bg-white/40 dark:bg-white/[0.04] border-slate-300/80 dark:border-white/10 text-slate-600 dark:text-slate-400'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span>Chirp: {soundEnabled ? 'ON' : 'OFF'}</span>
            </button>

            <button
              type="button"
              onClick={() => setAutoSubmit(!autoSubmit)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                autoSubmit
                  ? 'bg-[#C8963E]/20 border-[#C8963E]/50 text-[#9A6B1A] dark:text-[#FFD147]'
                  : 'bg-white/40 dark:bg-white/[0.04] border-slate-300/80 dark:border-white/10 text-slate-600 dark:text-slate-400'
              }`}
            >
              <span>Auto-Enter: {autoSubmit ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </div>

        {/* Scanner Laser Input Centerpiece */}
        <div
          className={`${GLASS_PANEL_CLASS} relative overflow-hidden ${
            isScanSuccessFlash ? 'ring-4 ring-emerald-500/50' : ''
          }`}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="text-center space-y-1">
              <span className="text-xs font-mono font-extrabold text-[#B88228] dark:text-[#FFD147] uppercase tracking-[0.14em]">
                POINT USB SCANNER OR TYPE BARCODE / MEMBER CARD ID
              </span>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Ready for physical barcode scanners (Symbol/Honeywell/Datalogic) or manual keyboard accession entry.
              </p>
            </div>

            <div className="max-w-2xl w-full mx-auto relative flex items-center gap-3 px-4 py-1.5 bg-white/85 dark:bg-[#0D0718]/85 backdrop-blur-xl border-2 border-[#C8963E]/65 focus-within:border-[#C8963E] focus-within:ring-4 focus-within:ring-[#C8963E]/20 rounded-2xl transition-all shadow-md">
              <BarcodeIcon className="w-5 h-5 text-[#C8963E] shrink-0 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={barcodeInput}
                onChange={e => {
                  setBarcodeInput(e.target.value);
                  if (autoSubmit && e.target.value.length >= 13) {
                    handleSearch(e.target.value);
                  }
                }}
                placeholder="Scan book barcode (0092...) or borrower card ID (ULM...)..."
                className="ulm-scanner-bare-input flex-1 min-w-0 h-11 px-2 bg-transparent border-0 text-left sm:text-center text-base sm:text-lg font-mono font-bold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 tracking-wider focus:outline-none focus:ring-0"
              />
              <button
                type="submit"
                className="h-10 px-5 rounded-xl bg-gradient-to-r from-[#BC881B] to-[#D4A02A] hover:from-[#D4A02A] hover:to-[#E0B450] active:bg-[#A87B16] !text-[#0B1220] font-bold text-xs sm:text-sm inline-flex items-center justify-center gap-2 shadow-sm tracking-wide transition-all cursor-pointer shrink-0 whitespace-nowrap"
              >
                <Search className="w-4 h-4 !text-[#0B1220] stroke-[2.5] shrink-0" />
                <span className="font-bold !text-[#0B1220] leading-none tracking-wide">Lookup</span>
              </button>
            </div>
          </form>

          {/* Quick Test Barcodes */}
          <div className="mt-5 pt-4 border-t border-slate-300/60 dark:border-white/10 flex flex-wrap items-center justify-center gap-2.5">
            <span className="text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-400">
              Quick Test Scans:
            </span>
            {activeBorrowersList.slice(0, 2).map(b => (
              <button
                key={b.id}
                type="button"
                onClick={() => handleTestScan(b.barcode || b.university_id || b.student_id)}
                className="px-3 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-[11px] font-mono font-semibold text-purple-800 dark:text-purple-300 border border-purple-500/30 tracking-wide transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <CreditCard className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <span>Card: {b.barcode || b.university_id || b.name}</span>
              </button>
            ))}
            {books.slice(0, 2).map(b => {
              const checkedOut = isCopyCheckedOut(b);
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => handleTestScan(b.barcode)}
                  className="px-3 py-1.5 rounded-xl bg-white/60 dark:bg-white/10 hover:bg-white/85 dark:hover:bg-white/20 text-[11px] font-mono font-semibold text-slate-800 dark:text-white border border-slate-300/80 dark:border-white/15 tracking-wide transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <BarcodeIcon className="w-3.5 h-3.5 text-[#C8963E]" />
                  <span>
                    Book: {b.barcode} ({b.book_name.slice(0, 14)} · {checkedOut ? 'Issued' : 'In Stack'})
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ---------------- SECTION: 2-COLUMN LIVE BORROWER ID CARD + SCANNED BOOK DESK (IDLE STATE) ---------------- */}
        {scanState === 'IDLE' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-200">
            {/* Column 1: Live Borrower ID Card Preview Desk */}
            <div className={`${GLASS_PANEL_CLASS} space-y-4 flex flex-col justify-between`}>
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-300/60 dark:border-white/10">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-[#C8963E]" />
                    <h3
                      className="font-bold text-[15px] text-slate-900 dark:text-white"
                      style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                    >
                      Live Borrower ID Card Desk
                    </h3>
                  </div>
                  <span className="text-[10.5px] font-mono font-semibold text-slate-600 dark:text-slate-300 bg-white/60 dark:bg-white/10 border border-white/80 dark:border-white/15 px-2.5 py-0.5 rounded-lg">
                    Hardware Scanner Ready
                  </span>
                </div>

                {activeBorrowersList.length > 0 ? (
                  <div className="mt-4 flex flex-col items-center justify-center overflow-x-auto py-1">
                    <MemberCard member={activeBorrowersList[0]} side="front" scale={0.92} />
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400 py-6 text-center">
                    No borrower records in database.
                  </p>
                )}
              </div>

              {activeBorrowersList.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    handleTestScan(
                      activeBorrowersList[0].barcode ||
                        activeBorrowersList[0].university_id ||
                        activeBorrowersList[0].student_id
                    )
                  }
                  className="w-full h-10 rounded-xl bg-[#C8963E]/15 hover:bg-[#C8963E]/25 text-[#9A6B1A] dark:text-[#FFD147] border border-[#C8963E]/40 font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Simulate Scanner Reading Member Card</span>
                </button>
              )}
            </div>

            {/* Column 2: Live Scanned Book Desk Preview (Full Book Dossier & Authoritative Location) */}
            <div className={`${GLASS_PANEL_CLASS} space-y-4 flex flex-col justify-between`}>
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-300/60 dark:border-white/10">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-[#C8963E]" />
                    <h3
                      className="font-bold text-[15px] text-slate-900 dark:text-white"
                      style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                    >
                      Live Scanned Book Desk
                    </h3>
                  </div>
                  <span className="text-[10.5px] font-mono font-semibold text-slate-600 dark:text-slate-300 bg-white/60 dark:bg-white/10 border border-white/80 dark:border-white/15 px-2.5 py-0.5 rounded-lg">
                    Catalog Hot-Scan Ready
                  </span>
                </div>

                {previewDeskBook ? (
                  <div className={`mt-4 ${GLASS_SUBCARD_CLASS} space-y-3.5`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-12 h-16 rounded-xl bg-gradient-to-br from-[#240836] to-[#3B1054] border border-[#C8963E]/40 flex items-center justify-center text-[#FFD147] shrink-0 shadow-xs">
                          <BookOpen className="w-6 h-6 stroke-[1.5]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-500/15 text-purple-800 dark:text-purple-300 border border-purple-500/25 px-2 py-0.5 rounded-md">
                              {previewDeskBook.category || 'General'}
                            </span>
                            <span className="text-[10px] font-mono font-bold text-[#B88228] dark:text-[#FFD147] bg-[#C8963E]/15 border border-[#C8963E]/30 px-2 py-0.5 rounded-md">
                              Acc #{previewDeskBook.accession_no || previewDeskBook.barcode}
                            </span>
                          </div>
                          <h4
                            className="font-bold text-[15px] text-slate-900 dark:text-white line-clamp-1 mt-1"
                            title={previewDeskBook.book_name}
                          >
                            {previewDeskBook.book_name}
                          </h4>
                          <p className="text-xs text-slate-600 dark:text-slate-300 truncate">
                            by <span className="font-semibold">{previewDeskBook.author}</span> ·{' '}
                            {previewDeskBook.edition || '1st Ed.'} ({previewDeskBook.publication_year || 2026})
                          </p>
                        </div>
                      </div>

                      {/* Architectural Availability Micro-Tag */}
                      <div className="shrink-0">
                        {isPreviewBookCheckedOut ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-500/15 border border-rose-500/35 text-[10px] font-mono font-bold text-rose-700 dark:text-rose-300 uppercase tracking-wider">
                            <span className="w-1.5 h-1.5 rounded-[2px] bg-rose-500" />
                            <span>CHECKED OUT</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/75 dark:bg-white/[0.08] border border-slate-300/80 dark:border-white/20 text-[10px] font-mono font-bold text-slate-800 dark:text-white uppercase tracking-wider">
                            <span className="w-1.5 h-1.5 rounded-[2px] bg-emerald-500" />
                            <span>1 | IN STACK</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Clean Metadata Strip */}
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-300/60 dark:border-white/10 text-[11px]">
                      <div>
                        <span className="text-[9.5px] font-mono uppercase text-slate-500 dark:text-slate-400 block">
                          Almari &amp; Shelf
                        </span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white flex items-center gap-1 mt-0.5 truncate">
                          <MapPin className="w-3 h-3 text-[#C8963E] shrink-0" />
                          <span className="truncate">{resolveBookPlacement(previewDeskBook).label}</span>
                        </span>
                      </div>
                      <div>
                        <span className="text-[9.5px] font-mono uppercase text-slate-500 dark:text-slate-400 block">
                          Dewey Call No
                        </span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white block mt-0.5 truncate">
                          {previewDeskBook.dewey_call_number || '000 ULM'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9.5px] font-mono uppercase text-slate-500 dark:text-slate-400 block">
                          Language / Binding
                        </span>
                        <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 block mt-0.5 truncate">
                          {previewDeskBook.language || 'English'} · {previewDeskBook.binding || 'HB'}
                        </span>
                      </div>
                    </div>

                    {/* Book Barcode in Locked Safe-Pad */}
                    <div className="pt-2.5 border-t border-slate-300/60 dark:border-white/10 flex items-center justify-between gap-3">
                      <span className="text-[11px] text-slate-600 dark:text-slate-300 font-mono">
                        ISBN: <strong className="text-slate-900 dark:text-white">{previewDeskBook.isbn || '—'}</strong>
                      </span>
                      <div className="ulm-barcode-safepad bg-white !text-black px-3 py-1.5 rounded-lg border border-slate-300 shadow-xs flex items-center gap-1.5 select-none shrink-0">
                        <BarcodeIcon className="w-4 h-4 !text-black stroke-black shrink-0" />
                        <span className="font-mono text-xs font-bold tracking-widest !text-black">
                          {previewDeskBook.barcode}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400 py-6 text-center">
                    No catalog books available.
                  </p>
                )}
              </div>

              {previewDeskBook && (
                <button
                  type="button"
                  onClick={() => handleTestScan(previewDeskBook.barcode)}
                  className="w-full h-10 rounded-xl bg-gradient-to-r from-[#BC881B] to-[#D4A02A] hover:from-[#D4A02A] hover:to-[#E0B450] !text-slate-950 font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  <BarcodeIcon className="w-4 h-4 !text-slate-950" />
                  <span className="!text-slate-950">
                    Inspect / Issue Book Barcode (#{previewDeskBook.accession_no || previewDeskBook.barcode})
                  </span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* ---------------- SECTION: BORROWER STATUS CARD (MODE B: STUDENT FIRST) ---------------- */}
        {scanState === 'BORROWER_FOUND' && foundBorrower && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-150">
            {/* Left Column: Full Student Profile & Printable CR80 ID Card */}
            <div className={`${GLASS_PANEL_CLASS} space-y-5 relative overflow-hidden flex flex-col justify-between`}>
              <div className="space-y-4">
                {/* Header: Member Identity & Status Badge */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-300/60 dark:border-white/10 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#1B1030] border border-[#C8963E]/50 p-1 flex items-center justify-center shrink-0">
                      <img src={ULM_CREST_LOGO} alt="ULM Crest" className="w-8 h-8 object-contain" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white font-serif">
                        {foundBorrower.name}
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-300 font-mono">
                        {foundBorrower.department} · {(foundBorrower.role || 'STUDENT').toUpperCase()}
                      </p>
                    </div>
                  </div>

                  <div>
                    {isBlockedOverdue ? (
                      <span className="px-3 py-1 rounded-lg text-[11px] font-bold uppercase bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/40 flex items-center gap-1.5 shadow-2xs">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>BLOCKED (Rs. {borrowerTotalFine})</span>
                      </span>
                    ) : isQuotaReached ? (
                      <span className="px-3 py-1 rounded-lg text-[11px] font-bold uppercase bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/40 flex items-center gap-1.5 shadow-2xs">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>
                          QUOTA FULL ({borrowerActiveLoans.length}/{maxAllowedQuota})
                        </span>
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-lg text-[11px] font-bold uppercase bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 shadow-2xs">
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>ELIGIBLE</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* CR80 Live Printable Card Preview */}
                <div className="flex flex-col items-center justify-center overflow-x-auto py-1">
                  <MemberCard member={foundBorrower} side="front" scale={0.95} />
                </div>

                {/* Quota & Fine Metric Strip */}
                <div className={`grid grid-cols-3 gap-2 text-center ${GLASS_SUBCARD_CLASS}`}>
                  <div>
                    <span className="text-[10px] uppercase font-mono text-slate-500 dark:text-slate-400 block">
                      Quota Used
                    </span>
                    <p
                      className="text-sm font-bold font-mono text-slate-900 dark:text-white"
                      style={{ fontFamily: "'Space Grotesk', monospace" }}
                    >
                      {borrowerActiveLoans.length} / {maxAllowedQuota}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-mono text-slate-500 dark:text-slate-400 block">
                      Overdue
                    </span>
                    <p
                      className={`text-sm font-bold font-mono ${
                        borrowerOverdueCount > 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                      style={{ fontFamily: "'Space Grotesk', monospace" }}
                    >
                      {borrowerOverdueCount} Books
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-mono text-slate-500 dark:text-slate-400 block">
                      Payable Fine
                    </span>
                    <p
                      className="text-sm font-bold font-mono text-[#B88228] dark:text-[#FFD147]"
                      style={{ fontFamily: "'Space Grotesk', monospace" }}
                    >
                      Rs. {borrowerTotalFine}
                    </p>
                  </div>
                </div>

                {/* Currently Borrowed Books with 1-click Return */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      Currently Issued Books ({borrowerActiveLoans.length})
                    </h4>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                      Policy: Rs. 10/day
                    </span>
                  </div>

                  {borrowerActiveLoans.length === 0 ? (
                    <div className={`${GLASS_SUBCARD_CLASS} text-center text-xs text-slate-500 dark:text-slate-400`}>
                      Member has 0 books borrowed. Full quota available.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {borrowerActiveLoans.map(loan => {
                        const isOverdue = loan.due_date && loan.due_date < todayIso;
                        return (
                          <div
                            key={loan.id}
                            className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs backdrop-blur-md ${
                              isOverdue
                                ? 'bg-rose-500/10 border-rose-400/40'
                                : 'bg-white/60 dark:bg-white/[0.04] border-white/75 dark:border-white/10'
                            }`}
                          >
                            <div className="truncate">
                              <p className="font-bold text-slate-900 dark:text-white truncate text-xs">
                                {loan.book_name}
                              </p>
                              <span className="text-[10px] text-slate-600 dark:text-slate-400 font-mono">
                                Barcode: {loan.barcode} · Due: {loan.due_date} {isOverdue && '(OVERDUE)'}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleInstantReturn(loan)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 !text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors shrink-0 shadow-xs"
                            >
                              <RotateCcw className="w-3 h-3 !text-white" />
                              <span className="!text-white">Return</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-300/60 dark:border-white/10 flex items-center justify-between">
                <button
                  type="button"
                  onClick={resetScanner}
                  className="px-3.5 py-1.5 rounded-xl bg-white/60 hover:bg-white/85 dark:bg-white/10 dark:hover:bg-white/15 border border-slate-300/70 dark:border-white/15 text-slate-800 dark:text-slate-200 text-xs font-semibold cursor-pointer transition-colors"
                >
                  ← Scan Another Student or Book
                </button>
              </div>
            </div>

            {/* Right Column: "Which Book Does This Student Want?" (Scan Barcode or Search Title/Author) */}
            <div className={`${GLASS_PANEL_CLASS} space-y-4 flex flex-col justify-between`}>
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-300/60 dark:border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-[#C8963E]" />
                    <h3
                      className="font-bold text-base text-slate-900 dark:text-white"
                      style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                    >
                      Which Book Does This Student Want?
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-[#9A6B1A] dark:text-[#FFD147] bg-[#C8963E]/15 px-2.5 py-0.5 rounded-lg border border-[#C8963E]/30">
                    Auto Loan-Duration Prompt
                  </span>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Scan book barcode or search by title/author/accession. When selected, the{' '}
                  <strong>Loan Duration Selector</strong> will automatically prompt for borrowing duration.
                </p>

                {/* Fast Scan Barcode / Search Input */}
                <form onSubmit={handleIssueBookToActiveBorrower} className="space-y-2">
                  <div className="relative flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl bg-white/80 dark:bg-[#0D0718]/80 backdrop-blur-xl border border-slate-300 dark:border-white/15 focus-within:border-[#C8963E] focus-within:ring-2 focus-within:ring-[#C8963E]/25 transition-all">
                    <BarcodeIcon className="w-4 h-4 text-[#C8963E] shrink-0 pointer-events-none" />
                    <input
                      ref={issueInputRef}
                      type="text"
                      value={issueBookInput}
                      onChange={e => {
                        setIssueBookInput(e.target.value);
                        setBookSearchForStudent(e.target.value);
                      }}
                      placeholder="Scan or enter book barcode (0092... / Acc # / Title)..."
                      className="ulm-scanner-bare-input flex-1 min-w-0 h-9 px-1 bg-transparent border-0 text-xs text-slate-900 dark:text-white font-mono placeholder:text-slate-400 focus:outline-none focus:ring-0"
                    />
                    <button
                      type="submit"
                      disabled={isBlockedOverdue || isQuotaReached}
                      className={`h-8 px-3.5 rounded-lg text-xs font-bold inline-flex items-center justify-center shrink-0 whitespace-nowrap transition-all ${
                        isBlockedOverdue || isQuotaReached
                          ? 'bg-slate-200 dark:bg-white/10 text-slate-400 cursor-not-allowed'
                          : 'bg-gradient-to-r from-[#BC881B] to-[#D4A02A] hover:from-[#D4A02A] hover:to-[#E0B450] !text-slate-950 cursor-pointer shadow-xs'
                      }`}
                    >
                      <span className="!text-slate-950">Prompt ↵</span>
                    </button>
                  </div>
                </form>

                {issueMessage && (
                  <div
                    className={`text-xs p-3 rounded-xl flex items-center gap-2 font-medium backdrop-blur-md ${
                      issueMessage.type === 'success'
                        ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border border-emerald-500/35'
                        : 'bg-rose-500/15 text-rose-800 dark:text-rose-200 border border-rose-500/35'
                    }`}
                  >
                    {issueMessage.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                    )}
                    <span>{issueMessage.text}</span>
                  </div>
                )}

                {/* Available Books List (Strictly excludes checked-out copies) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Available Catalog Volumes (1-Click Select):
                    </span>
                    <span className="text-[10.5px] font-mono font-bold text-emerald-700 dark:text-emerald-300">
                      {availableCatalogVolumes.length} In Stack
                    </span>
                  </div>

                  {availableCatalogVolumes.length === 0 ? (
                    <div className={`${GLASS_SUBCARD_CLASS} text-center py-6 space-y-1`}>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                        No available copies in stack matching filter
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        All matching catalog copies are currently checked out on loan.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                      {availableCatalogVolumes.slice(0, 12).map(b => (
                        <div
                          key={b.id}
                          onClick={() => !isBlockedOverdue && !isQuotaReached && handleSelectBookForStudent(b)}
                          className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs transition-all backdrop-blur-md ${
                            isBlockedOverdue || isQuotaReached
                              ? 'opacity-60 cursor-not-allowed bg-white/40 dark:bg-white/[0.02] border-slate-200 dark:border-white/5'
                              : 'cursor-pointer hover:border-[#C8963E] hover:bg-amber-50/60 dark:hover:bg-[#C8963E]/15 bg-white/60 dark:bg-white/[0.04] border-white/80 dark:border-white/10 shadow-2xs'
                          }`}
                        >
                          <div className="truncate min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-slate-900 dark:text-white truncate">{b.book_name}</p>
                              <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-[9.5px] font-mono font-bold text-emerald-700 dark:text-emerald-300 shrink-0">
                                Available ({Math.max(1, b.available_quantity ?? 1)})
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-[10.5px] text-slate-600 dark:text-slate-400 font-mono mt-0.5">
                              <span>by {b.author}</span>
                              <span>•</span>
                              <span className="font-semibold text-slate-800 dark:text-slate-200">
                                Acc: {b.accession_no || b.barcode}
                              </span>
                              <span>•</span>
                              <span className="text-[#B88228] dark:text-[#FFD147] font-semibold">
                                {resolveBookPlacement(b).label}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={isBlockedOverdue || isQuotaReached}
                            className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#BC881B] to-[#D4A02A] hover:from-[#D4A02A] hover:to-[#E0B450] !text-slate-950 font-bold text-[11px] shrink-0 shadow-2xs"
                          >
                            <span className="!text-slate-950">Select ↵</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- SCAN RESULTS: BOOK FOUND (MODE A: BOOK FIRST) ---------------- */}
        {scanState === 'BOOK_FOUND' && foundBook && (
          <div className={`${GLASS_PANEL_CLASS} space-y-5 animate-in fade-in duration-150`}>
            {/* Header: Status & Accession Barcode Info */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-300/60 dark:border-white/10 pb-3.5">
              <div className="flex items-center gap-2.5 text-emerald-700 dark:text-emerald-300 font-bold text-sm sm:text-base">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                <span style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  Book Barcode Verified in Catalog
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-xs font-mono text-slate-600 dark:text-slate-300">
                  Accession:{' '}
                  <strong className="text-slate-900 dark:text-white">
                    #{foundBook.accession_no || foundBook.barcode}
                  </strong>{' '}
                  · Barcode:{' '}
                  <strong className="text-slate-900 dark:text-white">{foundBook.barcode}</strong>
                </span>

                {/* Architectural Availability Micro-Tag */}
                {isFoundBookCheckedOut ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-500/15 border border-rose-500/35 text-[10.5px] font-mono font-bold text-rose-700 dark:text-rose-300 uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-[2px] bg-rose-500" />
                    <span>CHECKED OUT</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/75 dark:bg-white/[0.08] border border-slate-300/80 dark:border-white/20 text-[10.5px] font-mono font-bold text-slate-800 dark:text-white uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-[2px] bg-emerald-500" />
                    <span>{Math.max(1, foundBook.available_quantity ?? 1)} | IN STACK</span>
                  </span>
                )}
              </div>
            </div>

            {issueMessage && (
              <div
                className={`text-xs p-3 rounded-xl flex items-center gap-2 font-medium backdrop-blur-md ${
                  issueMessage.type === 'success'
                    ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border border-emerald-500/35'
                    : 'bg-rose-500/15 text-rose-800 dark:text-rose-200 border border-rose-500/35'
                }`}
              >
                {issueMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                )}
                <span>{issueMessage.text}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-[140px_1fr] gap-6">
              {/* Cover thumbnail */}
              <div className="w-32 h-44 rounded-2xl bg-gradient-to-br from-[#240836] to-[#13061E] border border-[#C8963E]/50 shadow-lg relative overflow-hidden flex flex-col justify-between p-3 shrink-0 mx-auto md:mx-0">
                {foundBook.book_image_path ? (
                  <img
                    src={foundBook.book_image_path}
                    alt={foundBook.book_name}
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : null}
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#C8963E] z-10" />
                <div className="relative z-0 text-[10px] space-y-1">
                  <span className="text-[8px] font-mono text-[#FFD147] font-bold">ULM LIBRARY</span>
                  <p className="font-serif font-bold !text-white line-clamp-3">{foundBook.book_name}</p>
                </div>
                <span className="relative z-0 text-[8.5px] font-mono !text-[#FFD147]">
                  {foundBook.dewey_call_number}
                </span>
              </div>

              {/* Book Dossier & Bidirectional Action Controls */}
              <div className="space-y-4 min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="px-2.5 py-0.5 rounded-md bg-purple-500/15 text-purple-800 dark:text-purple-200 border border-purple-500/25 font-bold text-[10.5px] uppercase tracking-wider">
                        {foundBook.category || 'General'}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-white/60 dark:bg-white/10 border border-slate-300/70 dark:border-white/15 font-mono text-[10.5px] font-semibold text-slate-700 dark:text-slate-300">
                        {foundBook.language || 'English'}
                      </span>
                      <span className="font-mono text-xs text-[#B88228] dark:text-[#FFD147] font-bold">
                        Dewey {foundBook.dewey_call_number || '000 ULM'}
                      </span>
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mt-1.5 font-serif">
                      {foundBook.book_name}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                      by <span className="font-semibold text-slate-900 dark:text-white">{foundBook.author}</span> ·{' '}
                      {foundBook.publisher || 'ULM Press'} · {foundBook.edition || '1st Edition'} (
                      {foundBook.publication_year || 2026})
                    </p>
                  </div>

                  {/* Safe-pad Barcode Pill */}
                  <div className="ulm-barcode-safepad bg-white !text-black px-3.5 py-1.5 rounded-xl border border-slate-300 shadow-xs flex items-center gap-2 select-none shrink-0">
                    <BarcodeIcon className="w-4 h-4 !text-black stroke-black shrink-0" />
                    <span className="font-mono text-xs font-bold tracking-widest !text-black">
                      {foundBook.barcode}
                    </span>
                  </div>
                </div>

                {/* Copies & Location Grid */}
                <div className={`grid grid-cols-2 sm:grid-cols-4 gap-3 ${GLASS_SUBCARD_CLASS}`}>
                  <div>
                    <span className="text-[10px] uppercase font-mono text-slate-500 dark:text-slate-400 block">
                      Total Copies
                    </span>
                    <p
                      className="text-sm font-bold font-mono text-slate-900 dark:text-white mt-0.5"
                      style={{ fontFamily: "'Space Grotesk', monospace" }}
                    >
                      {foundBook.total_quantity || 1} Volume(s)
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-mono text-slate-500 dark:text-slate-400 block">
                      Shelf Status
                    </span>
                    <p
                      className={`text-sm font-bold font-mono mt-0.5 ${
                        !isFoundBookCheckedOut
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                      style={{ fontFamily: "'Space Grotesk', monospace" }}
                    >
                      {!isFoundBookCheckedOut
                        ? `${Math.max(1, foundBook.available_quantity ?? 1)} Available`
                        : '0 Available (Issued)'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-mono text-slate-500 dark:text-slate-400 block">
                      Almari &amp; Shelf
                    </span>
                    <p
                      className="text-xs font-bold text-slate-900 dark:text-white mt-0.5 flex items-center gap-1 font-mono truncate"
                      title={foundBookCurrentPlacement.fullLabel}
                    >
                      <MapPin className="w-3.5 h-3.5 text-[#C8963E] shrink-0" />
                      <span className="truncate">{foundBookCurrentPlacement.label}</span>
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-mono text-slate-500 dark:text-slate-400 block">
                      ISBN &amp; Price
                    </span>
                    <p className="text-xs font-semibold text-slate-900 dark:text-white mt-0.5 font-mono truncate">
                      {foundBook.isbn || '—'} · Rs. {foundBook.price || 0}
                    </p>
                  </div>
                </div>

                {/* Active Loans if Checked Out */}
                {activeBookLoans.length > 0 && (
                  <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-2.5 backdrop-blur-md">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-rose-800 dark:text-rose-200 flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-rose-500" />
                        <span>Currently Checked Out ({activeBookLoans.length} Active Loan):</span>
                      </span>
                      <span className="text-[10.5px] font-mono text-rose-700 dark:text-rose-300">
                        1-Click Return Ready
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {activeBookLoans.map(loan => (
                        <div
                          key={loan.id}
                          className="flex flex-wrap items-center justify-between gap-2 text-xs bg-white/80 dark:bg-[#140B24]/85 px-3.5 py-2.5 rounded-xl border border-rose-300/60 dark:border-rose-500/30"
                        >
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white">
                              {loan.borrower_name}
                            </span>
                            <span className="text-slate-500 dark:text-slate-400 ml-2 font-mono">
                              ({loan.student_id})
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-slate-600 dark:text-slate-300 font-mono">
                              Due: <strong>{loan.due_date}</strong>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleInstantReturn(loan)}
                              className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 !text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                            >
                              <RotateCcw className="w-3 h-3 !text-white" />
                              <span className="!text-white">Return Book Now</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ---------------- INLINE ALMARI & SHELF PLACEMENT PANEL (STATES 1–6) ---------------- */}
                {isPlacingInAlmari && (
                  <div className={`${GLASS_SUBCARD_CLASS} border-[#C8963E]/50 space-y-3.5 animate-in fade-in duration-150`}>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-300/50 dark:border-white/10 pb-2.5">
                      <span className="text-xs font-bold text-slate-900 dark:text-amber-200 flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-[#C8963E]" />
                        <span>Place in Almari &amp; Shelf Location</span>
                        <span className="text-[10.5px] font-mono font-semibold text-slate-500 dark:text-slate-400 ml-1">
                          (Current: {foundBookCurrentPlacement.label})
                        </span>
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsQuickCreatingAlmari(!isQuickCreatingAlmari)}
                          className="px-2.5 py-1 rounded-lg bg-[#C8963E]/15 hover:bg-[#C8963E]/25 border border-[#C8963E]/35 text-[10.5px] font-bold text-[#9A6B1A] dark:text-[#FFD147] flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                          <span>New Cupboard</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsPlacingInAlmari(false);
                            setPostReturnReshelveBanner(null);
                          }}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* STATE 4: Post-Return Reshelving Callout Banner */}
                    {postReturnReshelveBanner && (
                      <div
                        className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 ${
                          postReturnReshelveBanner.type === 'assigned'
                            ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-800 dark:text-emerald-200'
                            : 'bg-amber-500/15 border-amber-500/35 text-amber-800 dark:text-amber-200'
                        }`}
                      >
                        <span>{postReturnReshelveBanner.text}</span>
                      </div>
                    )}

                    {/* STATE 6: Inline Quick Create Cupboard Form (when toggled or almaris.length === 0) */}
                    {(isQuickCreatingAlmari || almaris.length === 0) && (
                      <form
                        onSubmit={handleQuickCreateAlmari}
                        className="p-3 rounded-xl bg-white/70 dark:bg-white/[0.04] border border-[#C8963E]/40 space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-[#9A6B1A] dark:text-[#FFD147]">
                            + Quick Create Cupboard in Registry
                          </span>
                          {almaris.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setIsQuickCreatingAlmari(false)}
                              className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-[11px]"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                          <input
                            type="text"
                            value={quickAlmariCode}
                            onChange={e => setQuickAlmariCode(e.target.value)}
                            placeholder="Code (e.g. TEST 1)"
                            className="h-9 px-3 rounded-lg bg-white dark:bg-[#0D0718] border border-slate-300 dark:border-white/15 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-[#C8963E]"
                          />
                          <input
                            type="text"
                            value={quickAlmariName}
                            onChange={e => setQuickAlmariName(e.target.value)}
                            placeholder="Cupboard Name (e.g. Main Stack)"
                            className="sm:col-span-2 h-9 px-3 rounded-lg bg-white dark:bg-[#0D0718] border border-slate-300 dark:border-white/15 text-xs text-slate-900 dark:text-white outline-none focus:border-[#C8963E]"
                          />
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={1}
                              max={12}
                              value={quickAlmariShelves}
                              onChange={e => setQuickAlmariShelves(Number(e.target.value) || 5)}
                              className="w-16 h-9 px-2 rounded-lg bg-white dark:bg-[#0D0718] border border-slate-300 dark:border-white/15 text-xs font-mono font-bold text-center text-slate-900 dark:text-white outline-none"
                              title="Number of Shelves"
                            />
                            <button
                              type="submit"
                              className="flex-1 h-9 px-3 rounded-lg bg-gradient-to-r from-[#BC881B] to-[#D4A02A] !text-slate-950 font-bold text-xs cursor-pointer"
                            >
                              Create
                            </button>
                          </div>
                        </div>
                      </form>
                    )}

                    {/* STATE 1 & 2: Dynamic Real Cupboards Dropdown + Dynamic Shelf Row Selector */}
                    <div className="grid grid-cols-1 sm:grid-cols-[1.2fr_1fr_auto] gap-3 items-end">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1">
                          Almari Cupboard ({almaris.length} Active)
                        </label>
                        <select
                          value={selectedPlacementAlmariId}
                          onChange={e => {
                            const nextId = e.target.value;
                            setSelectedPlacementAlmariId(nextId);
                            setSelectedPlacementShelfNo(1);
                          }}
                          className="w-full h-10 px-3.5 rounded-xl bg-white/85 dark:bg-[#181028]/90 border border-slate-300/80 dark:border-white/15 text-xs font-bold text-slate-900 dark:text-white font-mono focus:outline-none focus:border-[#C8963E]"
                        >
                          <option
                            value="__UNASSIGN__"
                            className="bg-white dark:bg-[#181028] text-amber-700 dark:text-amber-300"
                          >
                            — Unassigned Queue (Remove from Almari) —
                          </option>
                          {almaris.map(a => (
                            <option
                              key={a.id}
                              value={a.id}
                              className="bg-white dark:bg-[#181028] text-slate-900 dark:text-white"
                            >
                              {a.code} — {a.name_en} ({a.location_note || a.location || 'Main Hall'})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1">
                          Shelf Row (Live Occupancy)
                        </label>
                        <select
                          disabled={selectedPlacementAlmariId === '__UNASSIGN__'}
                          value={selectedPlacementShelfNo}
                          onChange={e => setSelectedPlacementShelfNo(Number(e.target.value) || 1)}
                          className="w-full h-10 px-3.5 rounded-xl bg-white/85 dark:bg-[#181028]/90 border border-slate-300/80 dark:border-white/15 text-xs font-bold text-slate-900 dark:text-white font-mono focus:outline-none focus:border-[#C8963E] disabled:opacity-50"
                        >
                          {Array.from(
                            { length: Math.max(1, activePlacementAlmari?.shelf_count || 5) },
                            (_, idx) => {
                              const sNo = idx + 1;
                              const occ = getShelfOccupancyCount(activePlacementAlmari?.id || '', sNo);
                              const cap = getShelfCapacity(activePlacementAlmari, sNo);
                              const isCurrentShelf =
                                foundBookCurrentPlacement.almari?.id === activePlacementAlmari?.id &&
                                foundBookCurrentPlacement.shelfNo === sNo;
                              const isFull = occ >= cap && !isCurrentShelf;
                              return (
                                <option
                                  key={sNo}
                                  value={sNo}
                                  className="bg-white dark:bg-[#181028] text-slate-900 dark:text-white"
                                >
                                  Shelf {sNo} — {occ} / {cap} Vols{' '}
                                  {isCurrentShelf
                                    ? '(Current Shelf)'
                                    : isFull
                                    ? '(FULL)'
                                    : `(${Math.max(0, cap - occ)} free)`}
                                </option>
                              );
                            }
                          )}
                        </select>
                      </div>

                      <div>
                        <button
                          type="button"
                          onClick={() => executePlacementSave()}
                          className="w-full sm:w-auto h-10 px-4 rounded-xl bg-gradient-to-r from-[#BC881B] to-[#D4A02A] hover:from-[#D4A02A] hover:to-[#E0B450] !text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all whitespace-nowrap"
                        >
                          <Check className="w-3.5 h-3.5 !text-slate-950" />
                          <span className="!text-slate-950">Save Location ↵</span>
                        </button>
                      </div>
                    </div>

                    {/* Visual 1-Click Shelf Pills with Live Occupancy */}
                    {activePlacementAlmari && selectedPlacementAlmariId !== '__UNASSIGN__' && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 mr-1">
                          Quick Select Shelf:
                        </span>
                        {Array.from(
                          { length: Math.max(1, activePlacementAlmari.shelf_count || 5) },
                          (_, idx) => {
                            const sNo = idx + 1;
                            const occ = getShelfOccupancyCount(activePlacementAlmari.id, sNo);
                            const cap = getShelfCapacity(activePlacementAlmari, sNo);
                            const isSelected = selectedPlacementShelfNo === sNo;
                            const isCurrent =
                              foundBookCurrentPlacement.almari?.id === activePlacementAlmari.id &&
                              foundBookCurrentPlacement.shelfNo === sNo;
                            return (
                              <button
                                key={sNo}
                                type="button"
                                onClick={() => {
                                  setSelectedPlacementShelfNo(sNo);
                                }}
                                className={`px-2.5 py-1 rounded-lg border text-[10.5px] font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                  isSelected
                                    ? 'bg-[#C8963E]/25 border-[#C8963E] text-slate-900 dark:text-[#FFD147] ring-1 ring-[#C8963E]/50'
                                    : 'bg-white/60 dark:bg-white/[0.04] border-slate-300/70 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-[#C8963E]/50'
                                }`}
                              >
                                <span>Shelf {sNo}</span>
                                <span className="text-[9.5px] opacity-80">
                                  ({occ}/{cap})
                                </span>
                                {isCurrent && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Current Shelf" />
                                )}
                              </button>
                            );
                          }
                        )}
                      </div>
                    )}

                    {/* STATE 5: Batch Sibling Copies Placement Checkbox */}
                    {siblingCopiesInfo.allSiblings.length > 0 &&
                      selectedPlacementAlmariId !== '__UNASSIGN__' &&
                      activePlacementAlmari && (
                        <label className="flex items-center gap-2 pt-1 text-xs text-slate-700 dark:text-slate-200 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={applyToSiblingCopies}
                            onChange={e => setApplyToSiblingCopies(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 text-[#C8963E] focus:ring-[#C8963E]"
                          />
                          <span>
                            Also place{' '}
                            <strong>
                              {siblingCopiesInfo.unassignedSiblings.length > 0
                                ? `all ${siblingCopiesInfo.unassignedSiblings.length} unassigned`
                                : `all ${siblingCopiesInfo.allSiblings.length}`}{' '}
                              sibling copies
                            </strong>{' '}
                            of &ldquo;{foundBook.book_name}&rdquo; into{' '}
                            <span className="font-mono font-bold text-[#9A6B1A] dark:text-[#FFD147]">
                              {activePlacementAlmari.code} • Shelf {selectedPlacementShelfNo}
                            </span>
                          </span>
                        </label>
                      )}

                    {placementSuccessMsg && (
                      <p className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/25 px-3 py-2 rounded-xl">
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                        <span>{placementSuccessMsg}</span>
                      </p>
                    )}
                  </div>
                )}

                {/* Book-First Issue Panel: Scan Student ID Card or 1-Click Select Student */}
                {!isFoundBookCheckedOut && isChainedIssueActive && (
                  <div className={`${GLASS_SUBCARD_CLASS} border-[#C8963E]/50 space-y-3 animate-in fade-in duration-150`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <ArrowRightLeft className="w-4 h-4 text-[#C8963E]" />
                        <span>Issue This Book — Scan Student Card or Select Member (1-Click):</span>
                      </span>
                      <span className="text-[10.5px] font-mono text-[#9A6B1A] dark:text-[#FFD147]">
                        Opens Loan Duration Selector
                      </span>
                    </div>

                    <form onSubmit={handleChainedStudentSubmit} className="flex flex-wrap sm:flex-nowrap gap-2">
                      <input
                        ref={chainedStudentInputRef}
                        type="text"
                        value={chainedStudentInput}
                        onChange={e => {
                          setChainedStudentInput(e.target.value);
                          setChainedStudentError(null);
                        }}
                        placeholder="Scan student ID barcode (ULM...) or type Roll # / Name..."
                        className="flex-1 min-w-0 h-10 px-3.5 rounded-xl bg-white/85 dark:bg-[#0D0718]/85 border border-slate-300 dark:border-white/15 text-xs text-slate-900 dark:text-white font-mono placeholder:text-slate-400 focus:outline-none focus:border-[#C8963E]"
                      />
                      <button
                        type="submit"
                        className="h-10 px-4 rounded-xl bg-gradient-to-r from-[#BC881B] to-[#D4A02A] hover:from-[#D4A02A] hover:to-[#E0B450] !text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0"
                      >
                        <span className="!text-slate-950">Prompt Loan Time ↵</span>
                        <ChevronRight className="w-3.5 h-3.5 !text-slate-950" />
                      </button>
                    </form>

                    {chainedStudentError && (
                      <p className="text-xs text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>{chainedStudentError}</span>
                      </p>
                    )}

                    {/* 1-Click Eligible Student List inside Book-First View */}
                    {matchingBorrowersForBook.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 max-h-44 overflow-y-auto pr-1">
                        {matchingBorrowersForBook.map(member => {
                          const elig = checkBorrowerEligibility(member);
                          const disabled = elig.isBlockedOverdue || elig.isQuotaReached;
                          return (
                            <div
                              key={member.id}
                              onClick={() => !disabled && openDurationSelectorModal(foundBook, member)}
                              className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs transition-all ${
                                disabled
                                  ? 'opacity-55 cursor-not-allowed bg-white/30 dark:bg-white/[0.02] border-slate-200 dark:border-white/5'
                                  : 'cursor-pointer bg-white/70 dark:bg-white/[0.05] hover:bg-amber-50/70 dark:hover:bg-[#C8963E]/15 border-white/80 dark:border-white/10 hover:border-[#C8963E]'
                              }`}
                            >
                              <div className="min-w-0">
                                <p className="font-bold text-slate-900 dark:text-white truncate">
                                  {member.name}
                                </p>
                                <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate">
                                  {member.barcode || member.university_id} · Quota {elig.activeLoans.length}/
                                  {elig.quotaLimit}
                                </p>
                              </div>
                              <span className="px-2 py-1 rounded-lg bg-[#C8963E]/20 text-[#9A6B1A] dark:text-[#FFD147] font-bold text-[10.5px] shrink-0">
                                Issue ↵
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Mode A Primary Action Buttons */}
                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (isFoundBookCheckedOut && activeBookLoans.length > 0) {
                        handleInstantReturn(activeBookLoans[0]);
                      } else {
                        setIsChainedIssueActive(!isChainedIssueActive);
                        setIsPlacingInAlmari(false);
                      }
                    }}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold tracking-wide flex items-center gap-2 transition-all cursor-pointer shadow-xs ${
                      !isFoundBookCheckedOut
                        ? 'bg-gradient-to-r from-[#BC881B] to-[#D4A02A] hover:from-[#D4A02A] hover:to-[#E0B450] !text-slate-950'
                        : 'bg-emerald-600 hover:bg-emerald-700 !text-white'
                    }`}
                  >
                    <ArrowRightLeft className={`w-4 h-4 ${!isFoundBookCheckedOut ? '!text-slate-950' : '!text-white'}`} />
                    <span className={!isFoundBookCheckedOut ? '!text-slate-950' : '!text-white'}>
                      {!isFoundBookCheckedOut ? '📤 Issue This Book' : '📥 Return Book Now'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const nextOpen = !isPlacingInAlmari;
                      if (nextOpen) {
                        const fresh = refreshAlmarisAndPlacements();
                        syncPlacementControlsForBook(foundBook, fresh);
                      }
                      setIsPlacingInAlmari(nextOpen);
                    }}
                    className={`px-4 py-2.5 rounded-xl border text-xs font-semibold tracking-wide flex items-center gap-2 transition-colors cursor-pointer ${
                      isPlacingInAlmari
                        ? 'bg-[#C8963E]/20 border-[#C8963E] text-slate-900 dark:text-[#FFD147]'
                        : 'bg-white/65 hover:bg-white/90 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-slate-200 border-slate-300/80 dark:border-white/15'
                    }`}
                  >
                    <Layers className="w-4 h-4 text-[#C8963E]" />
                    <span>🗄️ Place in Almari &amp; Shelf</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenBookDetails(foundBook.id)}
                    className="px-3.5 py-2.5 rounded-xl bg-white/65 hover:bg-white/90 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-slate-200 border border-slate-300/80 dark:border-white/15 text-xs font-semibold tracking-wide flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Record</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onPrintBarcode(foundBook)}
                    className="px-3.5 py-2.5 rounded-xl bg-white/65 hover:bg-white/90 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-slate-200 border border-slate-300/80 dark:border-white/15 text-xs font-semibold tracking-wide flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-[#C8963E]" />
                    <span>Print Label</span>
                  </button>

                  <button
                    type="button"
                    onClick={resetScanner}
                    className="px-3.5 py-2.5 rounded-xl hover:bg-white/60 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 text-xs font-semibold ml-auto transition-colors cursor-pointer"
                  >
                    ← Scan Another
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- SCAN RESULTS: NOT FOUND ---------------- */}
        {scanState === 'NOT_FOUND' && (
          <div className={`${GLASS_PANEL_CLASS} border-rose-400/60 dark:border-rose-500/40 space-y-3 text-center animate-in fade-in duration-150`}>
            <div className="w-11 h-11 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500 mx-auto">
              <XCircle className="w-5 h-5" />
            </div>

            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-serif">
                Unrecognized Barcode or Member Card
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-md mx-auto">
                No active book or registered borrower matches identifier{' '}
                <span className="font-mono font-bold text-[#B88228] dark:text-[#FFD147]">{searchedBarcode}</span>.
                You can register this accession immediately.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => onOpenAddBookWithBarcode(searchedBarcode || '')}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#BC881B] to-[#D4A02A] hover:from-[#D4A02A] hover:to-[#E0B450] !text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5 !text-slate-950" />
                <span className="!text-slate-950">Register Book with this Barcode</span>
              </button>

              <button
                type="button"
                onClick={resetScanner}
                className="px-3.5 py-2 rounded-xl bg-white/65 hover:bg-white/90 dark:bg-white/10 dark:hover:bg-white/15 border border-slate-300/70 dark:border-white/15 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                Scan Again
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ---------------- LOAN DURATION SELECTOR MODAL DIALOG (PORTAL TO DOCUMENT.BODY) ---------------- */}
      {isDurationSelectorOpen &&
        pendingDurationTarget &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/20 dark:bg-slate-950/70 backdrop-blur-[10px] backdrop-saturate-150 overflow-y-auto animate-in fade-in duration-150"
            onClick={() => setIsDurationSelectorOpen(false)}
          >
            <div
              className="ulm-preserve-glass relative w-full max-w-md rounded-[26px] bg-gradient-to-br from-white/85 via-white/70 to-white/55 dark:from-[#1B1030]/92 dark:via-[#140B24]/88 dark:to-[#0E071B]/85 backdrop-blur-2xl backdrop-saturate-[180%] border border-white/85 dark:border-[#C8963E]/40 p-5 sm:p-6 shadow-[inset_1.5px_1.5px_2px_rgba(255,255,255,0.9),0_24px_60px_rgba(15,23,42,0.25)] dark:shadow-[inset_1.5px_1.5px_2px_rgba(255,255,255,0.22),0_24px_60px_rgba(0,0,0,0.65)] text-slate-900 dark:text-white space-y-5"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3 border-b border-slate-300/60 dark:border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-[#C8963E]/15 border border-[#C8963E]/40 flex items-center justify-center text-[#C8963E] shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3
                      className="font-bold text-base text-slate-900 dark:text-white"
                      style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                    >
                      Loan Duration Selector
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      How much time does the student want this book?
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDurationSelectorOpen(false)}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Book & Borrower Summary */}
              <div className="p-3.5 rounded-2xl bg-white/65 dark:bg-white/[0.05] border border-white/80 dark:border-white/10 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span>Borrower:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {pendingDurationTarget.borrower.name}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span>Card ID / Roll:</span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-white">
                    {pendingDurationTarget.borrower.university_id || pendingDurationTarget.borrower.barcode}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span>Book:</span>
                  <span className="font-bold text-slate-900 dark:text-white truncate max-w-[220px]">
                    {pendingDurationTarget.book.book_name}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span>Accession:</span>
                  <span className="font-mono font-bold text-[#B88228] dark:text-[#FFD147]">
                    #{pendingDurationTarget.book.accession_no || pendingDurationTarget.book.barcode}
                  </span>
                </div>
              </div>

              {/* Quick Presets */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                  Select Loan Period
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { days: 7, label: '7 Days', desc: 'Short Assignment' },
                    { days: 14, label: '14 Days', desc: 'Standard Campus Loan' },
                    { days: 30, label: '30 Days', desc: 'Monthly Research' },
                    { days: 120, label: 'Full Semester (120 D)', desc: 'Faculty / Project' },
                  ].map(preset => (
                    <button
                      key={preset.days}
                      type="button"
                      onClick={() => {
                        setSelectedDurationDays(preset.days);
                        setCustomDaysInput(String(preset.days));
                      }}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                        selectedDurationDays === preset.days
                          ? 'border-[#C8963E] bg-[#C8963E]/15 dark:bg-[#C8963E]/25 ring-1 ring-[#C8963E]'
                          : 'border-white/80 dark:border-white/10 hover:border-[#C8963E]/50 bg-white/55 dark:bg-white/[0.04]'
                      }`}
                    >
                      <span className="font-bold text-xs text-slate-900 dark:text-white block">
                        {preset.label}
                      </span>
                      <span className="text-[10px] text-slate-600 dark:text-slate-400 block mt-0.5">
                        {preset.desc}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Custom Days Input */}
                <div className="pt-1 flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 shrink-0">
                    Custom Days:
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={customDaysInput}
                    onChange={e => {
                      setCustomDaysInput(e.target.value);
                      const d = parseInt(e.target.value, 10);
                      if (!isNaN(d) && d > 0) setSelectedDurationDays(d);
                    }}
                    className="w-24 h-9 px-3 rounded-xl bg-white/80 dark:bg-[#0D0718] border border-slate-300 dark:border-white/15 text-xs text-slate-900 dark:text-white font-mono font-bold focus:border-[#C8963E] outline-none"
                  />
                  <span className="text-xs text-slate-500 dark:text-slate-400">days</span>
                </div>
              </div>

              {/* Due Date & Overdue Policy Notice */}
              <div className="p-3.5 rounded-2xl bg-[#C8963E]/12 border border-[#C8963E]/35 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] font-mono font-bold text-[#9A6B1A] dark:text-[#FFD147] block uppercase">
                    Calculated Due Date
                  </span>
                  <span
                    className="font-mono font-bold text-slate-900 dark:text-white text-sm"
                    style={{ fontFamily: "'Space Grotesk', monospace" }}
                  >
                    {new Date(Date.now() + selectedDurationDays * 86400000).toISOString().split('T')[0]}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-mono text-slate-600 dark:text-slate-400 block">
                    Overdue Fine
                  </span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">Rs. 10 / day</span>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-300/60 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setIsDurationSelectorOpen(false)}
                  className="px-4 h-10 rounded-xl bg-white/65 hover:bg-white/90 dark:bg-white/10 dark:hover:bg-white/15 border border-slate-300/70 dark:border-white/15 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmittingLoan}
                  onClick={handleConfirmIssueLoan}
                  className="px-5 h-10 rounded-xl bg-gradient-to-r from-[#BC881B] to-[#D4A02A] hover:from-[#D4A02A] hover:to-[#E0B450] !text-slate-950 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-md transition-all"
                >
                  <Check className="w-4 h-4 !text-slate-950" />
                  <span className="!text-slate-950">Confirm Issue ↵</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default BarcodeScannerView;
