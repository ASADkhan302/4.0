import React, { useState, useMemo, useEffect, useRef, useDeferredValue } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  BookOpen,
  Layers,
  CheckCircle2,
  Clock,
  LayoutGrid,
  List,
  Library,
  BarChart3,
  SlidersHorizontal,
  Upload,
  Printer,
  FileSpreadsheet,
  Trash2,
  Plus,
  Edit3,
  Copy,
  Check,
  BookMarked,
  MapPin,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  Building2,
  Calendar,
  RotateCcw,
  X,
} from 'lucide-react';
import { Book, Transaction, NavigationTab } from '../types/library';
import { CatalogVisualAnalytics } from './library/CatalogVisualAnalytics';
import { AlmariView } from './AlmariView';
import { BulkAssignModal } from './modals/BulkAssignModal';
import { AlmariService } from '../services/almariService';
import { AccessionSeriesEngine } from '../services/accessionSeriesEngine';
import { LibraryStorage, reconcileBooksWithLoans } from '../services/storage';
import { parseSerialNumber, resolveBookAlmariAndShelf, syncMasterExcelRegister } from '../services/libraryStorageAndMigration';
import { sortBooksCatalog } from '../utils/almariSortUtils';
import { isArabicOrUrduScript, matchesUrduSearch } from '../utils/urduUtils';
import { LiquidGlassCard } from './ui/liquid-weather-glass';
import { LiquidPillOverlay, LiquidIconFx } from './ui/liquid-pill-physics';
import { runHeavyLibraryTask } from '../utils/heavyTaskRunner';

interface CatalogGlassOption {
  value: string;
  label: string;
}

interface CatalogGlassDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: CatalogGlassOption[];
  minWidthClass?: string;
  maxWidthClass?: string;
  compact?: boolean;
  ariaLabel?: string;
}

const CatalogGlassDropdown: React.FC<CatalogGlassDropdownProps> = ({
  value,
  onChange,
  options,
  minWidthClass = 'min-w-[136px]',
  maxWidthClass = 'max-w-[172px]',
  compact = false,
  ariaLabel,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 188,
  });

  const updatePos = () => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const menuWidth = Math.max(rect.width, 192);
    const maxLeft = typeof window !== 'undefined' ? Math.max(8, window.innerWidth - menuWidth - 12) : rect.left;
    setMenuPos({
      top: rect.bottom + 6,
      left: Math.min(rect.left, maxLeft),
      width: menuWidth,
    });
  };

  const toggleOpen = () => {
    if (!isOpen) {
      updatePos();
    }
    setIsOpen((prev) => !prev);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleReposition = () => updatePos();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  return (
    <div className="relative shrink-0">
      <button
        ref={btnRef}
        type="button"
        onClick={toggleOpen}
        aria-label={ariaLabel || selectedOption?.label}
        aria-expanded={isOpen}
        className={`${
          compact ? 'h-8 px-2.5 rounded-lg' : 'h-[38px] px-3.5 rounded-xl'
        } ${minWidthClass} ${maxWidthClass} inline-flex items-center justify-between gap-2 text-xs font-semibold bg-white/75 dark:bg-[#1B1130]/80 hover:bg-white/95 dark:hover:bg-[#24163E]/90 backdrop-blur-xl border ${
          isOpen
            ? 'border-[#C8963E] dark:border-[#FFD147]/80 ring-2 ring-[#C8963E]/20'
            : 'border-slate-200/90 dark:border-white/15 hover:border-[#C8963E]/60 dark:hover:border-[#FFD147]/50'
        } text-slate-800 dark:text-slate-100 shadow-2xs transition-all cursor-pointer shrink-0`}
      >
        <span className="truncate">{selectedOption?.label || value}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[#C8963E] dark:text-[#FFD147] shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[99998]" onClick={() => setIsOpen(false)} />
            <div
              style={{
                top: `${menuPos.top}px`,
                left: `${menuPos.left}px`,
                minWidth: `${menuPos.width}px`,
              }}
              className="fixed z-[99999] rounded-2xl p-1.5 bg-white/[0.98] dark:bg-[#170E2C]/[0.98] backdrop-blur-2xl backdrop-saturate-[200%] border border-slate-300/90 dark:border-purple-400/35 shadow-[0_20px_50px_rgba(15,23,42,0.22)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.85)] max-h-[300px] overflow-y-auto custom-scrollbar space-y-0.5 animate-in fade-in zoom-in-95 duration-150"
            >
              {options.map((opt) => {
                const active = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={`w-full px-3.5 py-2 rounded-xl text-left text-[12px] font-['Plus_Jakarta_Sans'] flex items-center justify-between gap-3 transition-all cursor-pointer ${
                      active
                        ? 'bg-gradient-to-r from-[#581C87] to-[#7E22CE] !text-white font-semibold shadow-sm'
                        : 'text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/[0.10] font-medium'
                    }`}
                  >
                    <span className={`truncate ${active ? '!text-white' : ''}`}>{opt.label}</span>
                    {active && <Check className="w-3.5 h-3.5 text-amber-300 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </>,
          document.body
        )}
    </div>
  );
};

export interface BooksCatalogViewProps {
  books: Book[];
  transactions?: Transaction[];
  initialViewMode?: 'grid' | 'list' | 'almaris' | 'analytics' | 'chart';
  onOpenAddBook: () => void;
  onOpenIssueModal?: (book: Book) => void;
  onQuickLoan?: (book: Book) => void;
  onReturnBook?: (transactionIdOrBookId: string) => void;
  onSelectBook?: (book: Book) => void;
  onEditBook?: (book: Book) => void;
  onDeleteBook?: (book: Book) => void;
  onPrintBarcode?: (book: Book) => void;
  onImportExcel?: () => void;
  onOpenImportBookEntrySheet?: () => void;
  onExportCatalog?: () => void;
  onOpenBatchLabelPrint?: () => void;
  onUpdateBooks?: (updatedBooks: Book[]) => void;
  onBooksUpdated?: (updatedBooks: Book[], message: string, batchId?: string) => void;
  onNavigateToAlmaris?: () => void;
  onTabChange?: (tab: NavigationTab) => void;
  totalDbBooksCount?: number;
}

export const BooksCatalogView: React.FC<BooksCatalogViewProps> = ({
  books,
  transactions = [],
  initialViewMode,
  onOpenAddBook,
  onOpenIssueModal,
  onQuickLoan,
  onReturnBook,
  onSelectBook,
  onEditBook,
  onDeleteBook,
  onPrintBarcode,
  onImportExcel,
  onOpenImportBookEntrySheet,
  onExportCatalog,
  onOpenBatchLabelPrint,
  onUpdateBooks,
  onBooksUpdated,
  onTabChange,
  totalDbBooksCount,
}) => {
  // Grid View is FIRST and DEFAULT
  const [catalogView, setCatalogView] = useState<'grid' | 'list' | 'almaris' | 'analytics'>(() => {
    if (initialViewMode === 'chart' || initialViewMode === 'analytics') return 'analytics';
    if (initialViewMode === 'list') return 'list';
    if (initialViewMode === 'almaris') return 'almaris';
    return 'grid';
  });

  useEffect(() => {
    if (initialViewMode === 'chart' || initialViewMode === 'analytics') {
      setCatalogView('analytics');
    } else if (initialViewMode === 'list') {
      setCatalogView('list');
    } else if (initialViewMode === 'almaris') {
      setCatalogView('almaris');
    } else if (initialViewMode === 'grid') {
      setCatalogView('grid');
    }
  }, [initialViewMode]);

  const viewSwitcherRef = useRef<HTMLDivElement | null>(null);
  const viewItemRefs = useRef<Record<string, HTMLElement | null>>({});
  const [animTick, setAnimTick] = useState(1);

  const iconFxForMode = (mode: 'grid' | 'list' | 'almaris' | 'analytics'): LiquidIconFx => {
    if (mode === 'grid') return 'pop';
    if (mode === 'list') return 'hop';
    if (mode === 'almaris') return 'wave';
    return 'spin';
  };

  const handleSelectCatalogView = (mode: 'grid' | 'list' | 'almaris' | 'analytics') => {
    setAnimTick((t) => t + 1);
    setCatalogView(mode);
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const deferredSearch = useDeferredValue(debouncedSearch);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 180);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const [selectedDiscipline, setSelectedDiscipline] = useState('all');
  const [selectedLanguage, setSelectedLanguage] = useState('all');
  const [selectedAlmari, setSelectedAlmari] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isSecondaryFiltersOpen, setIsSecondaryFiltersOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'title' | 'author' | 'accession' | 'almari_order' | 'dewey_decimal'>('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);
  const [selectedBookIds, setSelectedBookIds] = useState<Set<string>>(new Set());
  const [bulkModalMode, setBulkModalMode] = useState<'assign_group' | 'assign_almari' | null>(null);
  const [copiedBarcodeId, setCopiedBarcodeId] = useState<string | null>(null);
  const [extendPopoverBookId, setExtendPopoverBookId] = useState<string | null>(null);
  const [extendPopoverCount, setExtendPopoverCount] = useState<number>(1);
  const [seriesExtendToast, setSeriesExtendToast] = useState<string | null>(null);

  // Quick keyboard shortcut: Pressing "/" or Ctrl+F focuses the spotlight search input
  useEffect(() => {
    const handleGlobalSearchKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable;
      if (!isInput && (e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f'))) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleGlobalSearchKey);
    return () => window.removeEventListener('keydown', handleGlobalSearchKey);
  }, []);

  // 1. Authoritative Master Placements Sync
  const masterPlacements = useMemo<Record<string, any>>(() => {
    try {
      const raw = localStorage.getItem('ulm_almari_placements_master_v3');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }, [books, catalogView]);

  // 2. Resolved Books with Placements Applied + Reconciled Against Active Loans (skip cloning if already reconciled)
  const booksWithPlacements = useMemo(() => {
    const hasPlacements = masterPlacements && Object.keys(masterPlacements).length > 0;
    const placed = hasPlacements
      ? books.map((b) => {
          const idKey = b.id ? String(b.id).trim() : '';
          const barcodeKey = b.barcode ? String(b.barcode).trim() : '';
          const override = (idKey && masterPlacements[idKey]) || (barcodeKey && masterPlacements[barcodeKey]);
          if (override) {
            return {
              ...b,
              almari_id: override.almari_id,
              almari_code: override.almari_code,
              cupboard: override.almari_code,
              shelf_no: override.shelf_no,
            };
          }
          return b;
        })
      : books;

    if (transactions.length === 0 && placed.length > 0 && placed[0].sibling_total_copies !== undefined) {
      return placed;
    }
    return reconcileBooksWithLoans(placed, transactions);
  }, [books, masterPlacements, transactions]);

  // Active books
  const activeBooks = useMemo(() => {
    return booksWithPlacements.filter(
      (b) =>
        b &&
        b.is_active !== false &&
        (b.is_active as unknown) !== 0 &&
        (b.is_active as unknown) !== '0'
    );
  }, [booksWithPlacements]);

  const activeAlmarisList = useMemo(
    () => AlmariService.getAlmaris().filter((a) => a.is_active),
    [books, catalogView]
  );
  const activeGroupsList = useMemo(
    () => AlmariService.getGroups().filter((g) => g.is_active),
    [books, catalogView]
  );

  // Single O(N) useMemo Pass for ALL 4 KPIs, Disciplines, Languages, and Next Series Accession
  const catalogAggregates = useMemo(() => {
    const distinctTitles = new Set<string>();
    const disciplineSet = new Set<string>();
    const languageSet = new Set<string>(['English', 'Urdu', 'Pashto']);
    let availableCount = 0;
    let loanedCount = 0;
    let maxAcc = 0;

    for (let i = 0; i < activeBooks.length; i++) {
      const b = activeBooks[i];
      const isbnClean = b.isbn ? String(b.isbn).replace(/[^0-9Xx]/g, '') : '';
      const groupKey =
        isbnClean.length >= 6
          ? `isbn:${isbnClean}`
          : `title:${String(b.book_name || b.title || '').trim().toLowerCase()}|${String(b.author || '').trim().toLowerCase()}`;
      distinctTitles.add(groupKey);

      const isCheckedOut =
        Boolean(b.is_checked_out) ||
        Number(b.available_copies ?? b.available_quantity ?? 1) === 0;
      if (isCheckedOut) {
        loanedCount++;
      } else {
        availableCount++;
      }

      if (b.category) disciplineSet.add(b.category);
      if (b.language) languageSet.add(b.language);

      const rawAcc = b.accession_no ? parseInt(String(b.accession_no).replace(/\D/g, ''), 10) : 0;
      if (!Number.isNaN(rawAcc) && rawAcc > maxAcc) maxAcc = rawAcc;
    }

    return {
      totalCataloged: distinctTitles.size,
      totalPhysicalVolumes:
        totalDbBooksCount && totalDbBooksCount > activeBooks.length
          ? totalDbBooksCount
          : activeBooks.length,
      totalAvailable: availableCount,
      activeLoans: loanedCount,
      disciplines: Array.from(disciplineSet).sort(),
      languages: Array.from(languageSet).sort(),
      nextSeriesAccession: maxAcc + 1,
    };
  }, [activeBooks, totalDbBooksCount]);

  const {
    totalCataloged,
    totalPhysicalVolumes,
    totalAvailable,
    activeLoans,
    disciplines,
    languages,
    nextSeriesAccession,
  } = catalogAggregates;

  // High-speed O(N) filtering against pre-computed _searchKey using debounced + deferred query
  const filteredBooks = useMemo(() => {
    const q = deferredSearch.trim();
    const qLower = q.toLowerCase();
    const hasUrduQuery = q.length > 0 && /[\u0600-\u06FF]/.test(q);
    const needsPlacementCheck = selectedAlmari !== 'all' || selectedGroupFilter !== 'all';

    const hasAnyFilter =
      qLower.length > 0 ||
      selectedDiscipline !== 'all' ||
      selectedLanguage !== 'all' ||
      needsPlacementCheck ||
      selectedStatus !== 'all' ||
      Boolean(dateFrom) ||
      Boolean(dateTo);

    let filtered: Book[];
    if (!hasAnyFilter) {
      filtered = activeBooks;
    } else {
      filtered = [];
      for (let i = 0; i < activeBooks.length; i++) {
        const b = activeBooks[i];

        if (qLower.length > 0) {
          const searchKey =
            b._searchKey ||
            b.search_text ||
            `${b.book_name || ''} ${b.author || ''} ${b.barcode || ''} ${b.accession_no || ''} ${b.isbn || ''}`.toLowerCase();
          const fastHit = searchKey.includes(qLower);
          if (!fastHit && !(hasUrduQuery && matchesUrduSearch(q, searchKey))) {
            continue;
          }
        }

        if (selectedDiscipline !== 'all' && b.category !== selectedDiscipline) {
          continue;
        }

        if (selectedLanguage !== 'all') {
          const matchLang =
            selectedLanguage === 'Urdu'
              ? (b.language || '').toLowerCase() === 'urdu' ||
                isArabicOrUrduScript(b.book_name || '')
              : b.language === selectedLanguage;
          if (!matchLang) continue;
        }

        if (selectedStatus !== 'all') {
          const isBookIssued =
            Boolean(b.is_checked_out) ||
            String(b.status || '').trim().toUpperCase() === 'ISSUED';
          const isBookAvailable = !isBookIssued && (b.available_quantity ?? 1) > 0;
          if (selectedStatus === 'AVAILABLE' && !isBookAvailable) continue;
          if (selectedStatus === 'LOANED' && isBookAvailable) continue;
        }

        if (needsPlacementCheck) {
          const placement = resolveBookAlmariAndShelf(b, activeAlmarisList, activeGroupsList);
          const almariCode = b.almari_code || placement?.almariCode || '';
          const resolvedAlmId = placement?.almari_id || b.almari_id || '';
          if (selectedAlmari !== 'all') {
            const matchAlmari =
              (selectedAlmari === 'unassigned' && !almariCode && !resolvedAlmId) ||
              almariCode === selectedAlmari ||
              resolvedAlmId === selectedAlmari;
            if (!matchAlmari) continue;
          }
          if (selectedGroupFilter !== 'all') {
            const resolvedGrpId = placement?.group_id || b.group_id || '';
            const matchGroup =
              (selectedGroupFilter === 'NO_GROUP' && !resolvedGrpId) ||
              resolvedGrpId === selectedGroupFilter;
            if (!matchGroup) continue;
          }
        }

        if (dateFrom || dateTo) {
          const bookDate =
            b.date_added || (b.created_at ? b.created_at.split(' ')[0] : '') || '';
          if (dateFrom && (!bookDate || bookDate < dateFrom)) continue;
          if (dateTo && (!bookDate || bookDate > dateTo)) continue;
        }

        filtered.push(b);
      }
    }

    if (sortBy === 'newest') {
      return filtered;
    }

    if (sortBy === 'almari_order' || sortBy === 'dewey_decimal') {
      const groupsMap = new Map(activeGroupsList.map((g) => [g.id, g]));
      const almarisMap = new Map(activeAlmarisList.map((a) => [a.id, a]));
      return sortBooksCatalog(filtered, sortBy, groupsMap, almarisMap);
    }

    return [...filtered].sort((a, b) => {
      if (sortBy === 'title') return (a.book_name || '').localeCompare(b.book_name || '');
      if (sortBy === 'author') return (a.author || '').localeCompare(b.author || '');
      if (sortBy === 'accession') {
        const numA = parseSerialNumber(a.accession_no || a.barcode);
        const numB = parseSerialNumber(b.accession_no || b.barcode);
        if (numA !== numB) return numA - numB;
        return (a.barcode || '').localeCompare(b.barcode || '');
      }
      return 0;
    });
  }, [
    activeBooks,
    deferredSearch,
    selectedDiscipline,
    selectedLanguage,
    selectedAlmari,
    selectedStatus,
    selectedGroupFilter,
    dateFrom,
    dateTo,
    sortBy,
    activeAlmarisList,
    activeGroupsList,
  ]);

  // Strict Pagination Cap (24, 48, 96 per page — never mounts 50,000 DOM nodes)
  const safePageSize = pageSize === 48 || pageSize === 96 ? pageSize : 24;
  const totalPages = Math.max(1, Math.ceil(filteredBooks.length / safePageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedBooks = useMemo(() => {
    const start = (safeCurrentPage - 1) * safePageSize;
    return filteredBooks.slice(start, start + safePageSize);
  }, [filteredBooks, safeCurrentPage, safePageSize]);

  // Resolve Almari placements lazily ONLY for the 24–96 visible cards/rows on the active page
  const placementByBookId = useMemo(() => {
    const map = new Map<string, ReturnType<typeof resolveBookAlmariAndShelf>>();
    for (let i = 0; i < paginatedBooks.length; i++) {
      const b = paginatedBooks[i];
      map.set(b.id, resolveBookAlmariAndShelf(b, activeAlmarisList, activeGroupsList));
    }
    return map;
  }, [paginatedBooks, activeAlmarisList, activeGroupsList]);

  const handleToggleSelectAll = () => {
    if (selectedBookIds.size === paginatedBooks.length && paginatedBooks.length > 0) {
      setSelectedBookIds(new Set());
    } else {
      setSelectedBookIds(new Set(paginatedBooks.map((b) => b.id || b.barcode)));
    }
  };

  const handleSelectAllFiltered = () => {
    setSelectedBookIds(new Set(filteredBooks.map((b) => b.id || b.barcode)));
  };

  const handleToggleSelectOne = (id: string) => {
    const next = new Set(selectedBookIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedBookIds(next);
  };

  const selectedBooksList = useMemo(() => {
    if (selectedBookIds.size === 0) return [];
    return activeBooks.filter((b) => selectedBookIds.has(b.id || b.barcode));
  }, [activeBooks, selectedBookIds]);

  const handleIssueBookAction = (book: Book) => {
    if (onOpenIssueModal) {
      onOpenIssueModal(book);
    } else if (onQuickLoan) {
      onQuickLoan(book);
    }
  };

  const handleReturnCopyAction = (book: Book) => {
    const targetId = book.active_loan_id || book.id || book.barcode;
    if (onReturnBook) {
      onReturnBook(targetId);
    } else {
      const res = LibraryStorage.returnBook(targetId);
      if (res.success) {
        const freshBooks = LibraryStorage.getBooks();
        onUpdateBooks?.(freshBooks);
        onBooksUpdated?.(freshBooks, res.message);
      }
    }
  };

  const handleImportExcelAction = () => {
    if (onImportExcel) {
      onImportExcel();
    } else if (onOpenImportBookEntrySheet) {
      onOpenImportBookEntrySheet();
    }
  };

  const handleDownloadCsvTemplate = () => {
    if (onExportCatalog) {
      onExportCatalog();
      return;
    }
    const templateCsv =
      'AccessionNo,Barcode,ISBN,BookTitle,Author,Category,TotalCopies,Shelf,DeweyCallNumber,Publisher,Edition,Year,Language,DateAdded\r\nULM-00001,0092000000001,978-0131103627,The C Programming Language,Brian W. Kernighan,Computer Science,1,ALM-01 - Shelf 1,005.133 ULM,Prentice Hall,2nd Edition,1988,English,2024-01-15\r\n';
    const blob = new Blob([templateCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'ULM_Books_Catalog_Import_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyBarcode = (barcode: string, bookKey: string) => {
    if (!barcode) return;
    navigator.clipboard?.writeText(barcode).catch(() => {});
    setCopiedBarcodeId(bookKey);
    setTimeout(() => {
      setCopiedBarcodeId((prev) => (prev === bookKey ? null : prev));
    }, 1500);
  };

  // PIPELINE B (Trigger 1): Extend existing book copies in strict series order from Catalog Card or Row
  const handleConfirmExtendBookCopies = (book: Book) => {
    const countToAdd = Math.max(1, Math.min(50, Number(extendPopoverCount) || 1));
    const executeExtend = () => {
      const res = AccessionSeriesEngine.addOrExtendBookInSeries(books, {
        baseBook: book,
        copiesToAdd: countToAdd,
      });
      const toastMsg = `Added ${countToAdd} new ${countToAdd === 1 ? 'copy' : 'copies'} of "${book.book_name}" in series (#${res.firstAccession} → #${res.lastAccession} • ${res.firstBarcode} → ${res.lastBarcode}).`;
      onUpdateBooks?.(res.updatedCatalog);
      onBooksUpdated?.(res.updatedCatalog, toastMsg);
      void syncMasterExcelRegister();
      setExtendPopoverBookId(null);
      setExtendPopoverCount(1);
      setSeriesExtendToast(toastMsg);
      setTimeout(() => {
        setSeriesExtendToast((prev) => (prev === toastMsg ? null : prev));
      }, 6000);
    };

    if (countToAdd >= 10) {
      void runHeavyLibraryTask(
        `Allocating +${countToAdd} Duplicate Copies`,
        `Registering "${book.book_name}" in continuous Accession & 13-digit Barcode series...`,
        async () => {
          executeExtend();
        }
      );
    } else {
      executeExtend();
    }
  };

  const activeSecondaryFilterCount =
    (selectedStatus !== 'all' ? 1 : 0) +
    (selectedGroupFilter !== 'all' ? 1 : 0) +
    (dateFrom || dateTo ? 1 : 0);

  return (
    <div className="w-full px-4 lg:px-6 pt-3 pb-16 select-none">
      <div className="max-w-[1920px] w-full mx-auto space-y-3.5">
        {seriesExtendToast && (
          <div className="p-3 rounded-xl bg-emerald-500/15 dark:bg-emerald-500/20 backdrop-blur-xl border border-emerald-500/40 text-emerald-900 dark:text-emerald-200 text-xs font-mono font-bold flex items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{seriesExtendToast}</span>
            </div>
            <button
              type="button"
              onClick={() => setSeriesExtendToast(null)}
              className="p-1 rounded hover:bg-emerald-500/20 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {/* Top 4 Frosted Metric Stat Cards — Clean 3-Tier Layout (No Dashed/Dotted Lines) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          {/* Card 1: Cataloged Titles */}
          <LiquidGlassCard borderRadius="22px" blurIntensity="xl" className="ulm-preserve-glass p-4 flex flex-col justify-between gap-2 hover:border-[#FFD147]/60">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.13em] text-slate-600 dark:text-slate-300">Cataloged Titles</span>
              <div className="w-7 h-7 rounded-xl bg-purple-500/15 border border-purple-400/30 flex items-center justify-center text-purple-600 dark:text-purple-300">
                <BookOpen className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-[26px] font-bold tabular-nums tracking-tight text-slate-900 dark:text-white leading-none" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                {totalCataloged.toLocaleString()}
              </span>
              <span className="text-[11px] italic font-medium text-slate-500 dark:text-slate-300/80">Distinct records</span>
            </div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              Across {disciplines.length} academic {disciplines.length === 1 ? 'discipline' : 'disciplines'}
            </div>
          </LiquidGlassCard>

          {/* Card 2: Physical Volumes */}
          <LiquidGlassCard borderRadius="22px" blurIntensity="xl" className="ulm-preserve-glass p-4 flex flex-col justify-between gap-2 hover:border-[#FFD147]/60">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.13em] text-slate-600 dark:text-slate-300">Physical Volumes</span>
              <div className="w-7 h-7 rounded-xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-amber-600 dark:text-[#FFD147]">
                <Layers className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-[26px] font-bold tabular-nums tracking-tight text-slate-900 dark:text-white leading-none" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                {totalPhysicalVolumes.toLocaleString()}
              </span>
              <span className="text-[11px] italic font-medium text-slate-500 dark:text-slate-300/80">Physical items</span>
            </div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              Total holdings in campus collection
            </div>
          </LiquidGlassCard>

          {/* Card 3: Shelf Availability */}
          <LiquidGlassCard borderRadius="22px" blurIntensity="xl" className="ulm-preserve-glass p-4 flex flex-col justify-between gap-2 hover:border-[#FFD147]/60">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.13em] text-slate-600 dark:text-slate-300">Shelf Availability</span>
              <div className="w-7 h-7 rounded-xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-emerald-600 dark:text-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-[26px] font-bold tabular-nums tracking-tight text-slate-900 dark:text-white leading-none" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                {totalAvailable.toLocaleString()}
              </span>
              <span className="text-[11px] italic font-medium text-slate-500 dark:text-slate-300/80">Available now</span>
            </div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              {totalAvailable.toLocaleString()} / {totalPhysicalVolumes.toLocaleString()} volumes on shelf
            </div>
          </LiquidGlassCard>

          {/* Card 4: Active Loans */}
          <LiquidGlassCard borderRadius="22px" blurIntensity="xl" className="ulm-preserve-glass p-4 flex flex-col justify-between gap-2 hover:border-[#FFD147]/60">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.13em] text-slate-600 dark:text-slate-300">Active Loans</span>
              <div className="w-7 h-7 rounded-xl bg-sky-500/15 border border-sky-400/30 flex items-center justify-center text-sky-600 dark:text-sky-300">
                <Clock className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-[26px] font-bold tabular-nums tracking-tight text-slate-900 dark:text-white leading-none" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                {activeLoans.toLocaleString()}
              </span>
              <span className="text-[11px] italic font-medium text-slate-500 dark:text-slate-300/80">On loan</span>
            </div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              Currently checked out to members
            </div>
          </LiquidGlassCard>
        </div>

        {/* =========================================================================
            2. FROSTED LIQUID-GLASS SEARCH & FILTER TOOLBAR
            ========================================================================= */}
        <LiquidGlassCard
          borderRadius="22px"
          blurIntensity="xl"
          shadowIntensity="sm"
          glowIntensity="xs"
          className="ulm-preserve-glass p-3 space-y-2.5"
        >
          {/* ROW 1: Spotlight Search & ALL 4 Dropdowns on ONE Single Line */}
          <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
            {/* Search Input (Expands to fill space) */}
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-[#C8963E] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && searchQuery) {
                    e.stopPropagation();
                    setSearchQuery('');
                  }
                }}
                style={{
                  paddingLeft: '2.5rem',
                  paddingRight: searchQuery ? '2rem' : '0.875rem',
                  height: '38px',
                }}
                placeholder="Search title, author, barcode, accession, ISBN..."
                className="ulm-compact-control w-full h-[38px] pl-10 pr-3.5 rounded-xl text-xs font-medium bg-white/55 dark:bg-[#1B1130]/75 backdrop-blur-xl border border-white/60 dark:border-white/15 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#C8963E] transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer z-10"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Compact Dropdown 1: Disciplines */}
            <CatalogGlassDropdown
              value={selectedDiscipline}
              onChange={(val) => {
                setSelectedDiscipline(val);
                setCurrentPage(1);
              }}
              ariaLabel="Filter by Academic Discipline"
              minWidthClass="min-w-[142px]"
              maxWidthClass="max-w-[172px]"
              options={[
                { value: 'all', label: 'All Disciplines' },
                ...disciplines.map((d) => ({ value: d, label: d })),
              ]}
            />

            {/* Compact Dropdown 2: Languages */}
            <CatalogGlassDropdown
              value={selectedLanguage}
              onChange={(val) => {
                setSelectedLanguage(val);
                setCurrentPage(1);
              }}
              ariaLabel="Filter by Language"
              minWidthClass="min-w-[134px]"
              maxWidthClass="max-w-[158px]"
              options={[
                { value: 'all', label: 'All Languages' },
                ...languages.map((l) => ({ value: l, label: l })),
              ]}
            />

            {/* Compact Dropdown 3: Almaris */}
            <CatalogGlassDropdown
              value={selectedAlmari}
              onChange={(val) => {
                setSelectedAlmari(val);
                setCurrentPage(1);
              }}
              ariaLabel="Filter by Almari Cupboard"
              minWidthClass="min-w-[132px]"
              maxWidthClass="max-w-[168px]"
              options={[
                { value: 'all', label: 'All Almaris' },
                { value: 'unassigned', label: 'Unassigned' },
                ...activeAlmarisList.map((alm) => ({
                  value: alm.id,
                  label: `${alm.code} — ${alm.name_en}`,
                })),
              ]}
            />

            {/* Compact Dropdown 4: Sort */}
            <CatalogGlassDropdown
              value={sortBy}
              onChange={(val) => setSortBy(val as any)}
              ariaLabel="Sort Catalog Records"
              minWidthClass="min-w-[138px]"
              maxWidthClass="max-w-[168px]"
              options={[
                { value: 'newest', label: 'Sort: Newest' },
                { value: 'title', label: 'Sort: Title' },
                { value: 'author', label: 'Sort: Author' },
                { value: 'accession', label: 'Sort: Accession' },
                { value: 'almari_order', label: 'Sort: Almari' },
                { value: 'dewey_decimal', label: 'Sort: Dewey Call #' },
              ]}
            />

            {/* Filter Toggle Button */}
            <button
              type="button"
              onClick={() => setIsSecondaryFiltersOpen(!isSecondaryFiltersOpen)}
              className={`h-[38px] px-3.5 rounded-xl text-xs font-semibold backdrop-blur-xl border flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors ${
                isSecondaryFiltersOpen || activeSecondaryFilterCount > 0
                  ? 'bg-amber-500/15 border-[#C8963E] text-[#8A4B00] dark:text-[#FFD147]'
                  : 'bg-white/75 dark:bg-[#1B1130]/80 border-slate-200/90 dark:border-white/15 text-slate-800 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#C8963E]" />
              <span className="hidden sm:inline">Filters</span>
              {activeSecondaryFilterCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-[#C8963E] text-slate-950 font-bold text-[10px] flex items-center justify-center">
                  {activeSecondaryFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Secondary Filters Panel (Collapsible) */}
          {isSecondaryFiltersOpen && (
            <div className="p-2.5 rounded-xl bg-black/5 dark:bg-black/30 border border-slate-200/70 dark:border-white/10 flex flex-wrap items-center gap-2.5">
              <CatalogGlassDropdown
                compact
                value={selectedStatus}
                onChange={(val) => {
                  setSelectedStatus(val);
                  setCurrentPage(1);
                }}
                ariaLabel="Filter by Availability Status"
                minWidthClass="min-w-[126px]"
                maxWidthClass="max-w-[156px]"
                options={[
                  { value: 'all', label: 'All Copies' },
                  { value: 'AVAILABLE', label: 'Available Now' },
                  { value: 'LOANED', label: 'Fully Loaned' },
                ]}
              />

              <CatalogGlassDropdown
                compact
                value={selectedGroupFilter}
                onChange={(val) => {
                  setSelectedGroupFilter(val);
                  setCurrentPage(1);
                }}
                ariaLabel="Filter by Almari Subject Group"
                minWidthClass="min-w-[132px]"
                maxWidthClass="max-w-[172px]"
                options={[
                  { value: 'all', label: 'All Groups' },
                  { value: 'NO_GROUP', label: 'Unassigned Group' },
                  ...activeGroupsList.map((g) => ({
                    value: g.id,
                    label: g.name_en,
                  })),
                ]}
              />

              <div className="h-8 flex items-center gap-1.5 bg-white/80 dark:bg-black/40 border border-slate-200 dark:border-white/15 rounded-lg px-2.5 text-xs">
                <Calendar className="w-3 h-3 text-[#C8963E]" />
                <span className="text-slate-500 dark:text-slate-400 font-mono text-[10px]">From:</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  style={{ width: 'auto', height: '26px' }}
                  className="ulm-compact-control bg-transparent text-[11px] font-mono text-slate-800 dark:text-white focus:outline-none cursor-pointer"
                />
                <span className="text-slate-500 dark:text-slate-400 font-mono text-[10px]">To:</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  style={{ width: 'auto', height: '26px' }}
                  className="ulm-compact-control bg-transparent text-[11px] font-mono text-slate-800 dark:text-white focus:outline-none cursor-pointer"
                />
              </div>

              {activeSecondaryFilterCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStatus('all');
                    setSelectedGroupFilter('all');
                    setDateFrom('');
                    setDateTo('');
                  }}
                  className="text-xs text-[#C8963E] hover:underline font-semibold cursor-pointer ml-auto"
                >
                  Reset Filters
                </button>
              )}
            </div>
          )}

          {/* ROW 2: View Switcher (GRID FIRST) & Compact Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/50 dark:border-white/10">
            {/* iOS Segmented Capsule: Grid View FIRST with Waterline Liquid Physics */}
            <div
              ref={viewSwitcherRef}
              className="relative isolate inline-flex items-center rounded-xl bg-black/5 dark:bg-black/35 backdrop-blur-xl p-0.5 border border-slate-200/80 dark:border-white/10 gap-0.5"
            >
              <LiquidPillOverlay
                containerRef={viewSwitcherRef}
                itemRefs={viewItemRefs}
                activeKey={catalogView}
                axis="x"
                variant="purple-pill"
                triggerTick={animTick}
              />

              <button
                ref={(el) => {
                  viewItemRefs.current['grid'] = el;
                }}
                type="button"
                onClick={() => handleSelectCatalogView('grid')}
                aria-pressed={catalogView === 'grid'}
                data-liquid-active={catalogView === 'grid' ? 'true' : undefined}
                className={`relative z-10 h-8 px-3 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  catalogView === 'grid'
                    ? '!text-white'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                <span
                  className="ulm-nv-ico"
                  key={catalogView === 'grid' ? animTick : 0}
                  data-fx={catalogView === 'grid' ? iconFxForMode('grid') : undefined}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </span>
                <span>Grid View</span>
              </button>

              <button
                ref={(el) => {
                  viewItemRefs.current['list'] = el;
                }}
                type="button"
                onClick={() => handleSelectCatalogView('list')}
                aria-pressed={catalogView === 'list'}
                data-liquid-active={catalogView === 'list' ? 'true' : undefined}
                className={`relative z-10 h-8 px-3 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  catalogView === 'list'
                    ? '!text-white'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                <span
                  className="ulm-nv-ico"
                  key={catalogView === 'list' ? animTick : 0}
                  data-fx={catalogView === 'list' ? iconFxForMode('list') : undefined}
                >
                  <List className="w-3.5 h-3.5" />
                </span>
                <span>List View</span>
              </button>

              <button
                ref={(el) => {
                  viewItemRefs.current['almaris'] = el;
                }}
                type="button"
                onClick={() => handleSelectCatalogView('almaris')}
                aria-pressed={catalogView === 'almaris'}
                data-liquid-active={catalogView === 'almaris' ? 'true' : undefined}
                className={`relative z-10 h-8 px-3 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  catalogView === 'almaris'
                    ? '!text-white'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                <span
                  className="ulm-nv-ico"
                  key={catalogView === 'almaris' ? animTick : 0}
                  data-fx={catalogView === 'almaris' ? iconFxForMode('almaris') : undefined}
                >
                  <Library className="w-3.5 h-3.5" />
                </span>
                <span>Almari View</span>
              </button>

              <button
                ref={(el) => {
                  viewItemRefs.current['analytics'] = el;
                }}
                type="button"
                onClick={() => handleSelectCatalogView('analytics')}
                aria-pressed={catalogView === 'analytics'}
                data-liquid-active={catalogView === 'analytics' ? 'true' : undefined}
                className={`relative z-10 h-8 px-3 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  catalogView === 'analytics'
                    ? '!text-white'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                <span
                  className="ulm-nv-ico"
                  key={catalogView === 'analytics' ? animTick : 0}
                  data-fx={catalogView === 'analytics' ? iconFxForMode('analytics') : undefined}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                </span>
                <span>Analytics</span>
              </button>
            </div>

            {/* Action Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={handleImportExcelAction}
                className="h-8 px-2.5 rounded-lg text-xs font-semibold bg-white/70 dark:bg-white/10 border border-slate-200 dark:border-white/15 text-slate-800 dark:text-slate-200 hover:bg-white dark:hover:bg-white/15 cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Upload className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span>Import</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (onOpenBatchLabelPrint) {
                    onOpenBatchLabelPrint();
                  } else if (onPrintBarcode && paginatedBooks[0]) {
                    onPrintBarcode(paginatedBooks[0]);
                  }
                }}
                className="h-8 px-2.5 rounded-lg text-xs font-semibold bg-white/70 dark:bg-white/10 border border-slate-200 dark:border-white/15 text-slate-800 dark:text-slate-200 hover:bg-white dark:hover:bg-white/15 cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Printer className="w-3 h-3 text-slate-500" />
                <span>Print Barcodes</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadCsvTemplate}
                className="h-8 px-2.5 rounded-lg text-xs font-semibold bg-white/70 dark:bg-white/10 border border-slate-200 dark:border-white/15 text-slate-800 dark:text-slate-200 hover:bg-white dark:hover:bg-white/15 cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <FileSpreadsheet className="w-3 h-3 text-[#C8963E]" />
                <span>CSV Template</span>
              </button>

              <button
                type="button"
                onClick={onOpenAddBook}
                className="h-8 px-3.5 rounded-lg text-xs font-extrabold bg-gradient-to-r from-[#541A72] to-[#B4690E] !text-white border border-[#FFD147]/50 shadow-xs hover:brightness-110 cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5 !text-white" />
                <span className="!text-white">Add Book</span>
              </button>
            </div>
          </div>
        </LiquidGlassCard>

        {/* Bulk Selection Action Strip */}
        {selectedBookIds.size > 0 && (
          <div className="h-11 rounded-xl bg-white/85 dark:bg-[#1A102D]/90 backdrop-blur-xl border border-[#C8963E] px-3.5 shadow-sm flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-xs">
              <span className="px-2 py-0.5 rounded bg-[#C8963E] text-slate-950 font-extrabold font-mono">
                {selectedBookIds.size}
              </span>
              <span className="text-slate-900 dark:text-white font-bold">
                selected ({filteredBooks.length} match)
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {selectedBookIds.size < filteredBooks.length && (
                <button
                  type="button"
                  onClick={handleSelectAllFiltered}
                  className="h-7 px-2.5 bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-slate-200 rounded-lg text-[11px] font-semibold cursor-pointer"
                >
                  Select all {filteredBooks.length}
                </button>
              )}
              <button
                type="button"
                onClick={() => setBulkModalMode('assign_almari')}
                className="h-7 px-2.5 bg-[#C8963E] text-slate-950 font-bold text-[11px] rounded-lg flex items-center gap-1 cursor-pointer"
              >
                <Building2 className="w-3 h-3" />
                <span>Place in Almari</span>
              </button>
              <button
                type="button"
                onClick={() => setBulkModalMode('assign_group')}
                className="h-7 px-2.5 bg-[#541A72] text-white font-bold text-[11px] rounded-lg flex items-center gap-1 cursor-pointer"
              >
                <Layers className="w-3 h-3" />
                <span>Assign Group</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedBookIds(new Set())}
                className="h-7 px-2 text-slate-500 hover:text-slate-900 dark:hover:text-white text-[11px] font-medium cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* =========================================================================
            3. CONDITIONAL VIEWS (GRID VIEW FIRST)
            ========================================================================= */}

        {/* VIEW A: IPHONE LIQUID-GLASS GRID VIEW (DEFAULT) */}
        {catalogView === 'grid' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
            {paginatedBooks.map((book) => {
              const bookKey = book.id || book.barcode;
              const isSelected = selectedBookIds.has(bookKey);
              const isUrdu = /[\u0600-\u06FF]/.test(book.book_name || '');
              const placement = placementByBookId.get(book.id);
              const almariCode =
                (book as Book & { almari_code?: string }).almari_code ||
                placement?.almariCode ||
                '';
              const shelfLabel =
                placement?.shelfNo
                  ? `Shelf ${placement.shelfNo}`
                  : book.shelf_no
                  ? `Shelf ${book.shelf_no}`
                  : book.shelf || 'Shelf 1';
              const isCheckedOut =
                Boolean(book.is_checked_out) ||
                String(book.status || '').toLowerCase() === 'issued' ||
                Number(book.available_copies ?? book.available_quantity ?? 1) === 0;

              return (
                <div
                  key={bookKey}
                  style={{ contentVisibility: 'auto', containIntrinsicSize: '220px' }}
                  className={`ulm-preserve-glass group relative rounded-[22px] bg-gradient-to-br from-white/50 via-white/30 to-white/15 dark:from-white/[0.07] dark:via-white/[0.03] dark:to-white/[0.015] backdrop-blur-xl backdrop-saturate-[175%] border transition-all duration-150 p-3.5 flex flex-col justify-between shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.45),inset_-1px_-1px_1px_rgba(255,255,255,0.12),0_8px_24px_rgba(0,0,0,0.16)] hover:border-[#FFD147]/60 hover:-translate-y-0.5 ${
                    isSelected
                      ? 'border-[#FFD147] ring-1.5 ring-[#FFD147]/40'
                      : 'border-white/60 dark:border-white/[0.14]'
                  }`}
                >
                  <div>
                    <div className="flex items-start gap-3">
                      {/* Compact 3D Leather Volume Spine */}
                      <div
                        onClick={() => onSelectBook && onSelectBook(book)}
                        className="w-[52px] h-[70px] rounded-lg bg-gradient-to-br from-[#240836] via-[#3B1054] to-[#1E0730] border border-[#FFD147]/40 shadow-xs flex flex-col items-center justify-between p-1 shrink-0 relative overflow-hidden cursor-pointer"
                      >
                        <div className="absolute left-1 top-0 bottom-0 w-[1.5px] bg-black/40" />
                        <span className="text-[6.5px] font-mono font-bold text-[#FFD147] tracking-widest uppercase">
                          ULM
                        </span>
                        <BookMarked className="w-3.5 h-3.5 text-[#FFD147]" />
                        <span className="text-[5.5px] font-extrabold uppercase text-white/80 tracking-widest">
                          PRESS
                        </span>
                      </div>

                      {/* Book Metadata */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="px-1.5 py-0.5 rounded text-[8.5px] font-bold bg-[#541A72]/15 text-[#541A72] dark:text-[#FFD147] border border-[#541A72]/30">
                              {book.category || 'General'}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[8.5px] font-semibold bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                              {book.language || 'English'}
                            </span>
                            {book.edition && (
                              <span className="px-1.5 py-0.5 rounded text-[8.5px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400">
                                {book.edition}
                              </span>
                            )}
                          </div>

                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectOne(bookKey)}
                            className="w-3.5 h-3.5 rounded text-[#541A72] border-slate-300 dark:border-white/20 cursor-pointer shrink-0"
                          />
                        </div>

                        <h3
                          onClick={() => onSelectBook && onSelectBook(book)}
                          dir="auto"
                          className={`font-extrabold text-[13px] text-slate-900 dark:text-white line-clamp-2 cursor-pointer hover:text-[#541A72] dark:hover:text-[#FFD147] transition-colors leading-snug ${
                            isUrdu ? 'font-urdu text-sm leading-relaxed' : ''
                          }`}
                          title={book.book_name}
                        >
                          {book.book_name}
                        </h3>

                        <p
                          dir="auto"
                          className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate"
                        >
                          by {book.author || 'Unknown'}
                        </p>
                      </div>
                    </div>

                    {/* Accession & Barcode Strip */}
                    <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-white/10 flex items-center justify-between gap-2 text-[10px]">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-800 dark:text-amber-300 font-mono font-bold text-[9px] shrink-0">
                          {book.accession_no || book.dewey_call_number || '000 ULM'}
                        </span>
                        <span className="font-mono text-slate-500 dark:text-slate-400 font-semibold truncate max-w-[110px] text-[9.5px]">
                          #{book.barcode}
                        </span>
                        {(book.copy_total_in_batch || 1) > 1 && (
                          <span className="px-1.5 py-0.5 rounded bg-[#541A72]/15 text-[#541A72] dark:text-[#FFD147] font-mono font-bold text-[8.5px] shrink-0">
                            Copy {book.copy_number || 1} of {book.copy_total_in_batch}
                          </span>
                        )}
                      </div>

                      {isCheckedOut ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/35 text-amber-600 dark:text-amber-400 font-['JetBrains_Mono'] text-[10px] font-semibold uppercase tracking-wider shrink-0">
                          <span className="w-1.5 h-1.5 rounded-[1.5px] bg-amber-400 shadow-[0_0_5px_rgba(251,191,36,0.8)] shrink-0" />
                          CHECKED OUT
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-slate-900/[0.04] dark:bg-white/[0.04] border border-slate-300/70 dark:border-white/[0.10] text-emerald-600 dark:text-emerald-400 font-['JetBrains_Mono'] text-[10px] font-semibold uppercase tracking-wider shrink-0">
                          <span className="w-1.5 h-1.5 rounded-[1.5px] bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.75)] shrink-0" />
                          {(book.sibling_total_copies || 1) > 1
                            ? `IN STACK (${book.sibling_available_copies}/${book.sibling_total_copies})`
                            : 'IN STACK'}
                        </span>
                      )}
                    </div>

                    {/* Shelf Location */}
                    <div className="mt-1.5 flex items-center gap-1 text-[10.5px] text-slate-600 dark:text-slate-300">
                      <MapPin className="w-3 h-3 text-[#C8963E] shrink-0" />
                      <span className="truncate font-medium">
                        {almariCode ? `${almariCode} • ${shelfLabel}` : 'Unassigned (No Almari)'}
                      </span>
                    </div>
                  </div>

                  {/* Inline + Copy Series Extension Popover */}
                  {extendPopoverBookId === bookKey && (
                    <div className="mt-2.5 p-2.5 rounded-xl bg-amber-500/15 dark:bg-[#1E1136]/95 border border-amber-500/45 space-y-2 text-[11px]">
                      <div className="flex items-center justify-between font-bold text-amber-900 dark:text-[#FFD147]">
                        <span>Extend Copies in Series</span>
                        <button
                          type="button"
                          onClick={() => setExtendPopoverBookId(null)}
                          className="p-0.5 rounded hover:bg-black/10 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="text-[10px] font-mono text-slate-700 dark:text-slate-300">
                        Allocates #{nextSeriesAccession} → #{nextSeriesAccession + extendPopoverCount - 1} (
                        <code>{AccessionSeriesEngine.formatBarcode(nextSeriesAccession)}</code> →{' '}
                        <code>
                          {AccessionSeriesEngine.formatBarcode(
                            nextSeriesAccession + extendPopoverCount - 1
                          )}
                        </code>
                        )
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center h-7 border border-amber-500/40 rounded-lg overflow-hidden bg-white dark:bg-[#121014]">
                          <button
                            type="button"
                            onClick={() => setExtendPopoverCount(Math.max(1, extendPopoverCount - 1))}
                            className="w-6 h-full text-slate-700 dark:text-slate-300 font-bold cursor-pointer"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min={1}
                            max={50}
                            value={extendPopoverCount}
                            onChange={(e) =>
                              setExtendPopoverCount(
                                Math.min(50, Math.max(1, parseInt(e.target.value, 10) || 1))
                              )
                            }
                            className="w-10 text-center font-mono font-bold text-[11px] bg-transparent text-slate-900 dark:text-white focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => setExtendPopoverCount(Math.min(50, extendPopoverCount + 1))}
                            className="w-6 h-full text-slate-700 dark:text-slate-300 font-bold cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleConfirmExtendBookCopies(book)}
                          className="h-7 px-2.5 rounded-lg bg-[#C8963E] text-slate-950 font-extrabold font-mono text-[10.5px] hover:brightness-110 cursor-pointer"
                        >
                          + Add {extendPopoverCount} in Series
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Footer Actions */}
                  <div className="mt-3 pt-2 border-t border-slate-200/60 dark:border-white/10 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onSelectBook && onSelectBook(book)}
                        className="h-6 px-2.5 rounded-lg text-[10.5px] font-semibold bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
                      >
                        Details
                      </button>
                      {isCheckedOut ? (
                        <button
                          type="button"
                          onClick={() => handleReturnCopyAction(book)}
                          className="h-6 px-2.5 rounded-lg text-[10.5px] font-extrabold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 cursor-pointer shadow-xs inline-flex items-center gap-1"
                          title={book.borrower_name ? `Checked out to ${book.borrower_name} — Click to Return` : 'Return this copy to shelf'}
                        >
                          <RotateCcw className="w-2.5 h-2.5" />
                          <span>Return</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleIssueBookAction(book)}
                          className="h-6 px-3 rounded-lg text-[10.5px] font-extrabold bg-[#C8963E] text-slate-950 hover:brightness-110 cursor-pointer shadow-xs"
                        >
                          Issue
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (extendPopoverBookId === bookKey) {
                            setExtendPopoverBookId(null);
                          } else {
                            setExtendPopoverBookId(bookKey);
                            setExtendPopoverCount(1);
                          }
                        }}
                        className="h-6 px-2 rounded-lg text-[10.5px] font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-[#FFD147] border border-amber-500/35 cursor-pointer flex items-center gap-0.5"
                        title="Extend existing book with +N new copies in strict series order"
                      >
                        <Plus className="w-2.5 h-2.5" />
                        <span>Copy</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1 text-slate-400">
                      <button
                        type="button"
                        onClick={() => handleCopyBarcode(book.barcode, bookKey)}
                        className="p-1 rounded hover:text-slate-900 dark:hover:text-white cursor-pointer"
                        title="Copy Barcode"
                      >
                        {copiedBarcodeId === bookKey ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditBook && onEditBook(book)}
                        className="p-1 rounded hover:text-slate-900 dark:hover:text-white cursor-pointer"
                        title="Edit"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteBook && onDeleteBook(book)}
                        className="p-1 rounded hover:text-rose-600 cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* VIEW B: LIST VIEW (AUTO-ADJUSTING BALANCED TABLE) */}
        {catalogView === 'list' && (
          <LiquidGlassCard
            borderRadius="22px"
            blurIntensity="xl"
            className="ulm-preserve-glass overflow-hidden border border-white/55 dark:border-white/[0.14]"
          >
            <div className="overflow-x-auto">
              <table className="w-full table-auto border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-white/10 bg-slate-900/[0.03] dark:bg-white/[0.03] text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300 divide-x divide-slate-200/40 dark:divide-white/[0.05]">
                    <th className="w-10 px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={
                          paginatedBooks.length > 0 &&
                          selectedBookIds.size === paginatedBooks.length
                        }
                        onChange={handleToggleSelectAll}
                        className="w-3.5 h-3.5 rounded accent-[#541A72] dark:accent-[#C8963E] cursor-pointer"
                      />
                    </th>
                    <th className="px-3.5 py-3 min-w-[180px] max-w-[260px]">Book Title & Author</th>
                    <th className="px-3.5 py-3 whitespace-nowrap">Category</th>
                    <th className="px-3.5 py-3 whitespace-nowrap">Language</th>
                    <th className="px-3.5 py-3 whitespace-nowrap">Barcode / Call No</th>
                    <th className="px-3 py-3 text-center whitespace-nowrap w-16">Total</th>
                    <th className="px-3 py-3 text-center whitespace-nowrap w-20">Avail</th>
                    <th className="px-3.5 py-3 whitespace-nowrap">Shelf / Row</th>
                    <th className="px-3.5 py-3 text-right whitespace-nowrap w-44">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-white/[0.06] text-xs">
                  {paginatedBooks.map((book, idx) => {
                    const bookKey = book.id || book.barcode;
                    const seqNo = (safeCurrentPage - 1) * pageSize + idx + 1;
                    const totalCopies = book.total_copies ?? book.total_quantity ?? 1;
                    const availCopies =
                      book.available_copies ?? book.available_quantity ?? totalCopies;
                    const isUrdu = isArabicOrUrduScript(
                      `${book.book_name || ''} ${book.author || ''}`
                    );
                    const placement = placementByBookId.get(book.id);
                    const almariCode =
                      (book as Book & { almari_code?: string }).almari_code ||
                      placement?.almariCode ||
                      '';
                    const callNo =
                      (book as Book & { dewey_call_no?: string }).dewey_call_no ||
                      book.dewey_call_number ||
                      '';

                    return (
                      <tr
                        key={bookKey}
                        style={{ contentVisibility: 'auto', containIntrinsicSize: '64px' }}
                        className={`transition-colors hover:bg-purple-500/[0.05] dark:hover:bg-white/[0.04] divide-x divide-slate-200/30 dark:divide-white/[0.04] ${
                          selectedBookIds.has(bookKey)
                            ? 'bg-purple-500/[0.08] dark:bg-purple-500/[0.12]'
                            : ''
                        }`}
                      >
                        {/* 1. Checkbox */}
                        <td className="w-10 px-3 py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={selectedBookIds.has(bookKey)}
                            onChange={() => handleToggleSelectOne(bookKey)}
                            className="w-3.5 h-3.5 rounded accent-[#541A72] dark:accent-[#C8963E] cursor-pointer"
                          />
                        </td>

                        {/* 2. Book Title & Author with Compact Spine */}
                        <td className="px-3.5 py-2.5 min-w-[180px] max-w-[260px]">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-9 rounded-md shrink-0 bg-gradient-to-b from-[#541A72] to-[#2A0845] border border-[#FFD147]/45 flex flex-col items-center justify-between py-1 shadow-sm">
                              <span className="text-[7px] font-mono text-[#FFD147]/90 font-bold leading-none">
                                ULM
                              </span>
                              <span className="text-[7px] font-mono text-white/80 leading-none">
                                #{book.accession_no || seqNo}
                              </span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div
                                onClick={() => onSelectBook && onSelectBook(book)}
                                className={`font-bold text-slate-900 dark:text-white truncate cursor-pointer hover:text-[#541A72] dark:hover:text-[#FFD147] ${
                                  isUrdu ? 'urdu-text text-sm' : 'text-[13px]'
                                }`}
                              >
                                {book.book_name || 'Untitled Volume'}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                {book.author || 'Unknown Author'}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 3. Category / Discipline Pill */}
                        <td className="px-3.5 py-2.5 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-purple-500/10 dark:bg-purple-500/15 text-purple-800 dark:text-purple-200 border border-purple-500/25">
                            {book.category || 'General'}
                          </span>
                        </td>

                        {/* 4. Language Pill */}
                        <td className="px-3.5 py-2.5 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-medium bg-slate-900/[0.04] dark:bg-white/[0.05] text-slate-700 dark:text-slate-300 border border-slate-300/60 dark:border-white/10">
                            {book.language || 'English'}
                          </span>
                        </td>

                        {/* 5. Barcode / Call No */}
                        <td className="px-3.5 py-2.5 whitespace-nowrap">
                          <div className="font-mono text-[11.5px] font-semibold text-slate-800 dark:text-slate-200 tracking-tight">
                            {book.barcode}
                          </div>
                          <div className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                            {callNo ? `DDC: ${callNo}` : `Acc #${book.accession_no || seqNo}`}
                          </div>
                        </td>

                        {/* 6. Total Copies */}
                        <td className="px-3 py-2.5 text-center whitespace-nowrap font-mono font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                          {totalCopies}
                        </td>

                        {/* 7. Available (Refined Architectural Micro-Tag) */}
                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                          {Boolean(book.is_checked_out) ||
                          String(book.status || '').toLowerCase() === 'issued' ||
                          availCopies === 0 ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/35 text-amber-600 dark:text-amber-400 font-['JetBrains_Mono'] text-[10px] font-semibold uppercase tracking-wider">
                              <span className="w-1.5 h-1.5 rounded-[1.5px] bg-amber-400 shadow-[0_0_5px_rgba(251,191,36,0.8)] shrink-0" />
                              CHECKED OUT
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-slate-900/[0.04] dark:bg-white/[0.04] border border-slate-300/70 dark:border-white/[0.10] text-emerald-600 dark:text-emerald-400 font-['JetBrains_Mono'] text-[10px] font-semibold uppercase tracking-wider">
                              <span className="w-1.5 h-1.5 rounded-[1.5px] bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.75)] shrink-0" />
                              {(book.sibling_total_copies || 1) > 1
                                ? `IN STACK (${book.sibling_available_copies}/${book.sibling_total_copies})`
                                : 'IN STACK'}
                            </span>
                          )}
                        </td>

                        {/* 8. Shelf / Row Location */}
                        <td className="px-3.5 py-2.5 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                            <MapPin className="w-3 h-3 text-[#C8963E] shrink-0" />
                            {almariCode
                              ? `${almariCode} · Shelf ${placement?.shelfNo || book.shelf_no || 1}`
                              : book.shelf || 'Unassigned'}
                          </span>
                        </td>

                        {/* 9. Actions (Dynamic Issue vs Return + Existing Handlers) */}
                        <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {Boolean(book.is_checked_out) ||
                            String(book.status || '').toLowerCase() === 'issued' ||
                            availCopies === 0 ? (
                              <button
                                type="button"
                                onClick={() => handleReturnCopyAction(book)}
                                className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 font-bold cursor-pointer inline-flex items-center gap-1"
                              >
                                <RotateCcw className="w-2.5 h-2.5" />
                                <span>Return</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleIssueBookAction(book)}
                                className="px-2 py-0.5 rounded bg-[#C8963E] text-slate-950 font-bold hover:brightness-110 cursor-pointer"
                              >
                                Issue
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                if (extendPopoverBookId === `row-${bookKey}`) {
                                  setExtendPopoverBookId(null);
                                } else {
                                  setExtendPopoverBookId(`row-${bookKey}`);
                                  setExtendPopoverCount(1);
                                }
                              }}
                              className="px-2 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-[#FFD147] border border-amber-500/35 font-bold cursor-pointer flex items-center gap-0.5"
                              title="Extend copies in series"
                            >
                              <Plus className="w-2.5 h-2.5" />
                              <span>Copy</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onEditBook && onEditBook(book)}
                              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-white/10 cursor-pointer"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                            {onDeleteBook && (
                              <button
                                type="button"
                                onClick={() => onDeleteBook(book)}
                                className="p-1 rounded text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                                title="Delete Book"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          {extendPopoverBookId === `row-${bookKey}` && (
                            <div className="mt-2 p-2 rounded-xl bg-amber-500/15 dark:bg-[#1E1136]/95 border border-amber-500/45 flex items-center justify-end gap-2 text-[11px]">
                              <span className="font-mono text-slate-700 dark:text-slate-300">
                                #{nextSeriesAccession}→#{nextSeriesAccession + extendPopoverCount - 1}:
                              </span>
                              <div className="flex items-center h-6 border border-amber-500/40 rounded overflow-hidden bg-white dark:bg-[#121014]">
                                <button
                                  type="button"
                                  onClick={() => setExtendPopoverCount(Math.max(1, extendPopoverCount - 1))}
                                  className="w-5 h-full font-bold cursor-pointer"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min={1}
                                  max={50}
                                  value={extendPopoverCount}
                                  onChange={(e) =>
                                    setExtendPopoverCount(
                                      Math.min(50, Math.max(1, parseInt(e.target.value, 10) || 1))
                                    )
                                  }
                                  className="w-9 text-center font-mono font-bold text-[11px] bg-transparent focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => setExtendPopoverCount(Math.min(50, extendPopoverCount + 1))}
                                  className="w-5 h-full font-bold cursor-pointer"
                                >
                                  +
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleConfirmExtendBookCopies(book)}
                                className="h-6 px-2 rounded bg-[#C8963E] text-slate-950 font-extrabold font-mono text-[10.5px] cursor-pointer"
                              >
                                + Add {extendPopoverCount}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </LiquidGlassCard>
        )}

        {/* VIEW C: PHYSICAL ALMARI & SHELF VIEW */}
        {catalogView === 'almaris' && (
          <AlmariView
            books={books}
            onSelectBook={onSelectBook}
            onOpenBook={onSelectBook}
            onEditBook={onEditBook}
            onUpdateBooks={onUpdateBooks}
            onCatalogBooksUpdated={onBooksUpdated}
            onOpenSettingsTab={() => onTabChange && onTabChange('settings')}
          />
        )}

        {/* VIEW D: CATALOG VISUAL ANALYTICS */}
        {catalogView === 'analytics' && (
          <CatalogVisualAnalytics
            books={books}
            transactions={transactions}
            onSelectCategory={(cat) => {
              setSelectedDiscipline(cat);
              setCatalogView('grid');
            }}
            onSwitchView={(mode) => setCatalogView(mode)}
          />
        )}

        {/* =========================================================================
            4. COMPACT PAGINATION FOOTER (44px HEIGHT)
            ========================================================================= */}
        {catalogView !== 'analytics' && catalogView !== 'almaris' && (
          <div className="h-11 rounded-xl bg-white/60 dark:bg-[#140D22]/60 backdrop-blur-xl border border-[#C8963E]/30 dark:border-white/10 px-4 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 shadow-xs">
            <div className="flex items-center gap-3">
              <span>
                Showing{' '}
                <strong>
                  {filteredBooks.length === 0
                    ? 0
                    : ((safeCurrentPage - 1) * safePageSize + 1).toLocaleString()}
                </strong>{' '}
                to{' '}
                <strong>
                  {Math.min(safeCurrentPage * safePageSize, filteredBooks.length).toLocaleString()}
                </strong>{' '}
                of <strong>{filteredBooks.length.toLocaleString()}</strong> books
              </span>
              <div className="flex items-center gap-1.5">
                <span>Per page:</span>
                <select
                  value={safePageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  style={{ width: 'auto', height: '28px' }}
                  className="ulm-compact-control w-auto h-7 px-1.5 rounded-lg bg-white/80 dark:bg-black/35 border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white text-[11px] cursor-pointer"
                >
                  <option value={24}>24</option>
                  <option value={48}>48</option>
                  <option value={96}>96</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={safeCurrentPage <= 1}
                onClick={() => setCurrentPage(1)}
                className="p-1 rounded-md border border-slate-200 dark:border-white/10 disabled:opacity-30 hover:bg-black/5 cursor-pointer"
              >
                <ChevronsLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={safeCurrentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1 rounded-md border border-slate-200 dark:border-white/10 disabled:opacity-30 hover:bg-black/5 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-2.5 py-0.5 font-mono font-bold text-slate-900 dark:text-white text-[11px]">
                Page {safeCurrentPage} of {totalPages}
              </span>
              <button
                type="button"
                disabled={safeCurrentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1 rounded-md border border-slate-200 dark:border-white/10 disabled:opacity-30 hover:bg-black/5 cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={safeCurrentPage >= totalPages}
                onClick={() => setCurrentPage(totalPages)}
                className="p-1 rounded-md border border-slate-200 dark:border-white/10 disabled:opacity-30 hover:bg-black/5 cursor-pointer"
              >
                <ChevronsRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Bulk Placement Modal */}
        {bulkModalMode && (
          <BulkAssignModal
            isOpen={!!bulkModalMode}
            onClose={() => setBulkModalMode(null)}
            selectedBooks={selectedBooksList}
            allBooks={books}
            mode={bulkModalMode}
            onComplete={(updatedBooks, msg, batchId) => {
              setBulkModalMode(null);
              setSelectedBookIds(new Set());
              if (onBooksUpdated) onBooksUpdated(updatedBooks, msg, batchId);
            }}
          />
        )}
      </div>
    </div>
  );
};

export default BooksCatalogView;
