import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  Building2,
  Calendar,
  X,
} from 'lucide-react';
import { Book, Transaction, NavigationTab } from '../types/library';
import { CatalogVisualAnalytics } from './library/CatalogVisualAnalytics';
import { AlmariView } from './AlmariView';
import { BulkAssignModal } from './modals/BulkAssignModal';
import { AlmariService } from '../services/almariService';
import { parseSerialNumber, resolveBookAlmariAndShelf } from '../services/libraryStorageAndMigration';
import { sortBooksCatalog } from '../utils/almariSortUtils';
import { isArabicOrUrduScript, matchesUrduSearch } from '../utils/urduUtils';

export interface BooksCatalogViewProps {
  books: Book[];
  transactions?: Transaction[];
  initialViewMode?: 'grid' | 'list' | 'almaris' | 'analytics' | 'chart';
  onOpenAddBook: () => void;
  onOpenIssueModal?: (book: Book) => void;
  onQuickLoan?: (book: Book) => void;
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

  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
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
  const [pageSize, setPageSize] = useState(48);
  const [selectedBookIds, setSelectedBookIds] = useState<Set<string>>(new Set());
  const [bulkModalMode, setBulkModalMode] = useState<'assign_group' | 'assign_almari' | null>(null);
  const [copiedBarcodeId, setCopiedBarcodeId] = useState<string | null>(null);

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
  const masterPlacements = useMemo(() => {
    try {
      const raw = localStorage.getItem('ulm_almari_placements_master_v3');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }, [books, catalogView]);

  // 2. Resolved Books with Placements Applied
  const booksWithPlacements = useMemo(() => {
    return books.map((b) => {
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
    });
  }, [books, masterPlacements]);

  // Active books and Almari placement resolver
  const activeBooks = useMemo(() => {
    return booksWithPlacements.filter(
      (b) =>
        b.is_active === undefined ||
        b.is_active === true ||
        (b.is_active as unknown) === 1 ||
        (b.is_active as unknown) === '1' ||
        b.is_active !== false
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

  const placementByBookId = useMemo(() => {
    const map = new Map<string, ReturnType<typeof resolveBookAlmariAndShelf>>();
    for (const b of activeBooks) {
      map.set(b.id, resolveBookAlmariAndShelf(b, activeAlmarisList, activeGroupsList));
    }
    return map;
  }, [activeBooks, activeAlmarisList, activeGroupsList]);

  // Metrics computation
  const totalCataloged =
    totalDbBooksCount && totalDbBooksCount > activeBooks.length
      ? totalDbBooksCount
      : activeBooks.length;

  const totalPhysicalVolumes = useMemo(() => {
    if (totalDbBooksCount && totalDbBooksCount > activeBooks.length) {
      return totalDbBooksCount;
    }
    return activeBooks.reduce((sum, b) => sum + (Number(b.total_quantity ?? b.copies) || 1), 0);
  }, [activeBooks, totalDbBooksCount]);

  const activeLoans = useMemo(() => {
    const fromTxs = transactions.filter(
      (t) =>
        (t.status as string) === 'ISSUED' ||
        t.status === 'ACTIVE' ||
        t.status === 'OVERDUE' ||
        (!t.return_date && t.status !== 'RETURNED')
    ).length;
    if (fromTxs > 0) return fromTxs;

    const fromAvailableDiff = activeBooks.reduce((sum, b) => {
      const total = Number(b.total_quantity ?? b.copies) || 1;
      const avail = Number(b.available_quantity ?? b.available_copies ?? total);
      return sum + Math.max(0, total - avail);
    }, 0);
    return Math.max(0, fromAvailableDiff);
  }, [transactions, activeBooks]);

  const totalAvailable = Math.max(0, totalPhysicalVolumes - activeLoans);

  // Extract unique filters
  const disciplines = useMemo(() => {
    const set = new Set<string>();
    activeBooks.forEach((b) => {
      if (b.category) set.add(b.category);
    });
    return Array.from(set).sort();
  }, [activeBooks]);

  const languages = useMemo(() => {
    const set = new Set<string>(['English', 'Urdu', 'Pashto']);
    activeBooks.forEach((b) => {
      if (b.language) set.add(b.language);
    });
    return Array.from(set).sort();
  }, [activeBooks]);

  // Filter and sort books
  const filteredBooks = useMemo(() => {
    const filtered = activeBooks.filter((b) => {
      const q = searchQuery.trim();
      const qLower = q.toLowerCase();
      const matchQuery =
        !q ||
        matchesUrduSearch(
          q,
          b.search_text ||
            `${b.book_name || ''} ${b.author || ''} ${b.barcode || ''} ${b.accession_no || ''} ${b.isbn || ''} ${b.dewey_call_number || ''}`
        ) ||
        (b.book_name || '').toLowerCase().includes(qLower) ||
        (b.author || '').toLowerCase().includes(qLower) ||
        (b.barcode || '').toLowerCase().includes(qLower) ||
        (b.isbn || '').toLowerCase().includes(qLower) ||
        (b.accession_no || '').toLowerCase().includes(qLower);

      const matchDiscipline = selectedDiscipline === 'all' || b.category === selectedDiscipline;
      const matchLanguage =
        selectedLanguage === 'all' ||
        (selectedLanguage === 'Urdu' &&
          ((b.language || '').toLowerCase() === 'urdu' ||
            isArabicOrUrduScript(b.book_name || ''))) ||
        b.language === selectedLanguage;

      const placement = placementByBookId.get(b.id);
      const almariCode =
        (b as Book & { almari_code?: string }).almari_code || placement?.almariCode || '';
      const resolvedAlmId = placement?.almari_id || b.almari_id || '';

      const matchAlmari =
        selectedAlmari === 'all' ||
        (selectedAlmari === 'unassigned' && !almariCode && !resolvedAlmId) ||
        almariCode === selectedAlmari ||
        resolvedAlmId === selectedAlmari;

      const isBookIssued = String(b.status || '').trim().toUpperCase() === 'ISSUED';
      const isBookAvailable = !isBookIssued && (b.available_quantity ?? 1) > 0;
      const matchStatus =
        selectedStatus === 'all' ||
        (selectedStatus === 'AVAILABLE' && isBookAvailable) ||
        (selectedStatus === 'LOANED' && !isBookAvailable);

      const resolvedGrpId = placement?.group_id || b.group_id || '';
      const matchGroup =
        selectedGroupFilter === 'all' ||
        (selectedGroupFilter === 'NO_GROUP' && !resolvedGrpId) ||
        resolvedGrpId === selectedGroupFilter;

      const bookDate =
        b.date_added || (b.created_at ? b.created_at.split(' ')[0] : '') || '';
      const matchDateFrom = !dateFrom || (bookDate && bookDate >= dateFrom);
      const matchDateTo = !dateTo || (bookDate && bookDate <= dateTo);

      return (
        matchQuery &&
        matchDiscipline &&
        matchLanguage &&
        matchAlmari &&
        matchStatus &&
        matchGroup &&
        matchDateFrom &&
        matchDateTo
      );
    });

    if (['almari_order', 'dewey_decimal'].includes(sortBy)) {
      const groupsMap = new Map(AlmariService.getGroups().map((g) => [g.id, g]));
      const almarisMap = new Map(AlmariService.getAlmaris().map((a) => [a.id, a]));
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
      return 0; // default newest
    });
  }, [
    activeBooks,
    searchQuery,
    selectedDiscipline,
    selectedLanguage,
    selectedAlmari,
    selectedStatus,
    selectedGroupFilter,
    dateFrom,
    dateTo,
    sortBy,
    placementByBookId,
  ]);

  // Pagination slice
  const totalPages = Math.max(1, Math.ceil(filteredBooks.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedBooks = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredBooks.slice(start, start + pageSize);
  }, [filteredBooks, safeCurrentPage, pageSize]);

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

  const activeSecondaryFilterCount =
    (selectedStatus !== 'all' ? 1 : 0) +
    (selectedGroupFilter !== 'all' ? 1 : 0) +
    (dateFrom || dateTo ? 1 : 0);

  return (
    <div className="w-full px-4 lg:px-6 pt-3 pb-16 select-none">
      <div className="max-w-[1920px] w-full mx-auto space-y-3.5">
        {/* =========================================================================
            EXACT REPLICA METRIC STAT CARDS (MATCHING SCREENSHOTS 3720aea1 & 0a0dd112)
            ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 1: Cataloged Titles */}
          <div className="rounded-2xl bg-white/70 dark:bg-[#140D22]/70 backdrop-blur-2xl border border-slate-200/80 dark:border-white/10 p-4 shadow-sm hover:border-[#C8963E]/45 transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-[0.10em] text-slate-500 dark:text-slate-400">
                CATALOGED TITLES
              </span>
              <BookOpen className="w-4 h-4 text-slate-400 dark:text-slate-500 opacity-60 shrink-0" />
            </div>
            <div className="mt-2.5 flex items-baseline">
              <span className="text-2xl xl:text-[28px] font-extrabold font-display tabular-nums tracking-tight text-slate-900 dark:text-white leading-none">
                {totalCataloged.toLocaleString()}
              </span>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 ml-2">
                Distinct records
              </span>
            </div>
            <div className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-1">
              Across {new Set(books.map((b) => (b.discipline || b.category || 'General').trim())).size} academic {new Set(books.map((b) => (b.discipline || b.category || 'General').trim())).size === 1 ? 'discipline' : 'disciplines'}
            </div>
          </div>

          {/* Card 2: Physical Volumes */}
          <div className="rounded-2xl bg-white/70 dark:bg-[#140D22]/70 backdrop-blur-2xl border border-slate-200/80 dark:border-white/10 p-4 shadow-sm hover:border-[#C8963E]/45 transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-[0.10em] text-slate-500 dark:text-slate-400">
                PHYSICAL VOLUMES
              </span>
              <Layers className="w-4 h-4 text-slate-400 dark:text-slate-500 opacity-60 shrink-0" />
            </div>
            <div className="mt-2.5 flex items-baseline">
              <span className="text-2xl xl:text-[28px] font-extrabold font-display tabular-nums tracking-tight text-slate-900 dark:text-white leading-none">
                {totalPhysicalVolumes.toLocaleString()}
              </span>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 ml-2">
                Physical items
              </span>
            </div>
            <div className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-1">
              Total holdings in campus collection
            </div>
          </div>

          {/* Card 3: Shelf Availability */}
          <div className="rounded-2xl bg-white/70 dark:bg-[#140D22]/70 backdrop-blur-2xl border border-slate-200/80 dark:border-white/10 p-4 shadow-sm hover:border-[#C8963E]/45 transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-[0.10em] text-slate-500 dark:text-slate-400">
                SHELF AVAILABILITY
              </span>
              <CheckCircle2 className="w-4 h-4 text-slate-400 dark:text-slate-500 opacity-60 shrink-0" />
            </div>
            <div className="mt-2.5 flex items-baseline">
              <span className="text-2xl xl:text-[28px] font-extrabold font-display tabular-nums tracking-tight text-slate-900 dark:text-white leading-none">
                {totalAvailable.toLocaleString()}
              </span>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 ml-2">
                Available now
              </span>
            </div>
            <div className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-1">
              {totalAvailable.toLocaleString()} / {totalPhysicalVolumes.toLocaleString()} volumes on shelf
            </div>
          </div>

          {/* Card 4: Active Loans */}
          <div className="rounded-2xl bg-white/70 dark:bg-[#140D22]/70 backdrop-blur-2xl border border-slate-200/80 dark:border-white/10 p-4 shadow-sm hover:border-[#C8963E]/45 transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-[0.10em] text-slate-500 dark:text-slate-400">
                ACTIVE LOANS
              </span>
              <Clock className="w-4 h-4 text-slate-400 dark:text-slate-500 opacity-60 shrink-0" />
            </div>
            <div className="mt-2.5 flex items-baseline">
              <span className="text-2xl xl:text-[28px] font-extrabold font-display tabular-nums tracking-tight text-slate-900 dark:text-white leading-none">
                {activeLoans.toLocaleString()}
              </span>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 ml-2">
                On loan
              </span>
            </div>
            <div className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-1">
              Currently checked out to members
            </div>
          </div>
        </div>

        {/* =========================================================================
            2. COMPRESSED SINGLE-LINE SEARCH & FILTER TOOLBAR (44px HEIGHT)
            ========================================================================= */}
        <div className="rounded-2xl bg-white/60 dark:bg-[#140D22]/60 backdrop-blur-2xl border border-[#C8963E]/30 dark:border-white/10 p-2.5 shadow-xs space-y-2">
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
                className="ulm-compact-control w-full h-[38px] pl-10 pr-3.5 rounded-xl text-xs font-medium bg-white/80 dark:bg-black/40 backdrop-blur-xl border border-slate-200/90 dark:border-white/15 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#C8963E] transition-all"
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
            <select
              value={selectedDiscipline}
              onChange={(e) => {
                setSelectedDiscipline(e.target.value);
                setCurrentPage(1);
              }}
              style={{ width: 'auto', height: '38px' }}
              className="ulm-compact-control w-auto h-[38px] px-3 rounded-xl text-xs font-medium bg-white/80 dark:bg-black/40 backdrop-blur-xl border border-slate-200/90 dark:border-white/15 text-slate-800 dark:text-slate-200 cursor-pointer shrink-0 max-w-[148px]"
            >
              <option value="all">All Disciplines</option>
              {disciplines.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            {/* Compact Dropdown 2: Languages */}
            <select
              value={selectedLanguage}
              onChange={(e) => {
                setSelectedLanguage(e.target.value);
                setCurrentPage(1);
              }}
              style={{ width: 'auto', height: '38px' }}
              className="ulm-compact-control w-auto h-[38px] px-3 rounded-xl text-xs font-medium bg-white/80 dark:bg-black/40 backdrop-blur-xl border border-slate-200/90 dark:border-white/15 text-slate-800 dark:text-slate-200 cursor-pointer shrink-0 max-w-[132px]"
            >
              <option value="all">All Languages</option>
              {languages.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>

            {/* Compact Dropdown 3: Almaris */}
            <select
              value={selectedAlmari}
              onChange={(e) => {
                setSelectedAlmari(e.target.value);
                setCurrentPage(1);
              }}
              style={{ width: 'auto', height: '38px' }}
              className="ulm-compact-control w-auto h-[38px] px-3 rounded-xl text-xs font-medium bg-white/80 dark:bg-black/40 backdrop-blur-xl border border-slate-200/90 dark:border-white/15 text-slate-800 dark:text-slate-200 cursor-pointer shrink-0 max-w-[142px]"
            >
              <option value="all">All Almaris</option>
              <option value="unassigned">Unassigned</option>
              {activeAlmarisList.map((alm) => (
                <option key={alm.id} value={alm.id}>
                  {alm.code} — {alm.name_en}
                </option>
              ))}
            </select>

            {/* Compact Dropdown 4: Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              style={{ width: 'auto', height: '38px' }}
              className="ulm-compact-control w-auto h-[38px] px-3 rounded-xl text-xs font-medium bg-white/80 dark:bg-black/40 backdrop-blur-xl border border-slate-200/90 dark:border-white/15 text-slate-800 dark:text-slate-200 cursor-pointer shrink-0 max-w-[148px]"
            >
              <option value="newest">Sort: Newest</option>
              <option value="title">Sort: Title</option>
              <option value="author">Sort: Author</option>
              <option value="accession">Sort: Accession</option>
              <option value="almari_order">Sort: Almari</option>
              <option value="dewey_decimal">Sort: Dewey Call #</option>
            </select>

            {/* Filter Toggle Button */}
            <button
              type="button"
              onClick={() => setIsSecondaryFiltersOpen(!isSecondaryFiltersOpen)}
              className={`h-[38px] px-3 rounded-xl text-xs font-semibold backdrop-blur-xl border flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors ${
                isSecondaryFiltersOpen || activeSecondaryFilterCount > 0
                  ? 'bg-amber-500/15 border-[#C8963E] text-[#8A4B00] dark:text-[#FFD147]'
                  : 'bg-white/80 dark:bg-black/40 border-slate-200/90 dark:border-white/15 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
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
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setCurrentPage(1);
                }}
                style={{ width: 'auto', height: '32px' }}
                className="ulm-compact-control w-auto h-8 px-2.5 rounded-lg text-xs font-medium bg-white/80 dark:bg-black/40 border border-slate-200 dark:border-white/15 text-slate-800 dark:text-slate-200 cursor-pointer"
              >
                <option value="all">All Copies</option>
                <option value="AVAILABLE">Available Now</option>
                <option value="LOANED">Fully Loaned</option>
              </select>

              <select
                value={selectedGroupFilter}
                onChange={(e) => {
                  setSelectedGroupFilter(e.target.value);
                  setCurrentPage(1);
                }}
                style={{ width: 'auto', height: '32px' }}
                className="ulm-compact-control w-auto h-8 px-2.5 rounded-lg text-xs font-medium bg-white/80 dark:bg-black/40 border border-slate-200 dark:border-white/15 text-slate-800 dark:text-slate-200 cursor-pointer"
              >
                <option value="all">All Groups</option>
                <option value="NO_GROUP">Unassigned Group</option>
                {activeGroupsList.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name_en}
                  </option>
                ))}
              </select>

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
            {/* iOS Segmented Capsule: Grid View FIRST */}
            <div className="inline-flex rounded-xl bg-black/5 dark:bg-black/35 backdrop-blur-xl p-0.5 border border-slate-200/80 dark:border-white/10 gap-0.5">
              <button
                type="button"
                onClick={() => setCatalogView('grid')}
                aria-pressed={catalogView === 'grid'}
                className={`h-8 px-3 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  catalogView === 'grid'
                    ? 'bg-gradient-to-r from-[#541A72] to-[#3B1054] text-white border border-[#FFD147]/50 shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Grid View</span>
              </button>

              <button
                type="button"
                onClick={() => setCatalogView('list')}
                aria-pressed={catalogView === 'list'}
                className={`h-8 px-3 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  catalogView === 'list'
                    ? 'bg-gradient-to-r from-[#541A72] to-[#3B1054] text-white border border-[#FFD147]/50 shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>List View</span>
              </button>

              <button
                type="button"
                onClick={() => setCatalogView('almaris')}
                aria-pressed={catalogView === 'almaris'}
                className={`h-8 px-3 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  catalogView === 'almaris'
                    ? 'bg-gradient-to-r from-[#541A72] to-[#3B1054] text-white border border-[#FFD147]/50 shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                <Library className="w-3.5 h-3.5" />
                <span>Almari View</span>
              </button>

              <button
                type="button"
                onClick={() => setCatalogView('analytics')}
                aria-pressed={catalogView === 'analytics'}
                className={`h-8 px-3 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  catalogView === 'analytics'
                    ? 'bg-gradient-to-r from-[#541A72] to-[#3B1054] text-white border border-[#FFD147]/50 shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
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
                <span className="!text-white">+ Add Book</span>
              </button>
            </div>
          </div>
        </div>

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
              const availCount = book.available_quantity ?? book.available_copies ?? 1;

              return (
                <div
                  key={bookKey}
                  className={`group relative rounded-2xl bg-white/65 hover:bg-white/85 dark:bg-[#150D24]/65 dark:hover:bg-[#1A102D]/85 backdrop-blur-2xl border transition-all duration-150 p-3.5 flex flex-col justify-between shadow-[0_4px_20px_rgba(0,0,0,0.03),inset_0_1px_0_rgba(255,255,255,0.7)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.08)] hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(200,150,62,0.16)] ${
                    isSelected
                      ? 'border-[#FFD147] ring-1.5 ring-[#FFD147]/40'
                      : 'border-[#C8963E]/30 dark:border-white/10'
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
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-full text-[8.5px] font-bold border shrink-0 ${
                          availCount > 0
                            ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-500/30'
                        }`}
                      >
                        {availCount > 0 ? `🟢 ${availCount} Available` : '🔴 On Loan'}
                      </span>
                    </div>

                    {/* Shelf Location */}
                    <div className="mt-1.5 flex items-center gap-1 text-[10.5px] text-slate-600 dark:text-slate-300">
                      <MapPin className="w-3 h-3 text-[#C8963E] shrink-0" />
                      <span className="truncate font-medium">
                        {almariCode ? `${almariCode} • ${shelfLabel}` : 'Unassigned (No Almari)'}
                      </span>
                    </div>
                  </div>

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
                      <button
                        type="button"
                        onClick={() => handleIssueBookAction(book)}
                        className="h-6 px-3 rounded-lg text-[10.5px] font-extrabold bg-[#C8963E] text-slate-950 hover:brightness-110 cursor-pointer shadow-xs"
                      >
                        Issue
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

        {/* VIEW B: LIST VIEW (TABLE) */}
        {catalogView === 'list' && (
          <div className="rounded-2xl bg-white/60 dark:bg-[#140D22]/60 backdrop-blur-2xl border border-[#C8963E]/30 dark:border-white/10 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 dark:bg-black/35 border-b border-slate-200/80 dark:border-white/10 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold">
                  <tr>
                    <th className="py-2.5 px-3.5 w-10">
                      <input
                        type="checkbox"
                        checked={
                          selectedBookIds.size === paginatedBooks.length &&
                          paginatedBooks.length > 0
                        }
                        onChange={handleToggleSelectAll}
                        className="rounded cursor-pointer"
                      />
                    </th>
                    <th className="py-2.5 px-3.5">Book Title & Author</th>
                    <th className="py-2.5 px-3.5">Category</th>
                    <th className="py-2.5 px-3.5">Language</th>
                    <th className="py-2.5 px-3.5">Barcode / Call No</th>
                    <th className="py-2.5 px-3.5">Total</th>
                    <th className="py-2.5 px-3.5">Avail</th>
                    <th className="py-2.5 px-3.5">Shelf / Row</th>
                    <th className="py-2.5 px-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-white/10 text-slate-800 dark:text-slate-200">
                  {paginatedBooks.map((book) => {
                    const bookKey = book.id || book.barcode;
                    const placement = placementByBookId.get(book.id);
                    const almariCode =
                      (book as Book & { almari_code?: string }).almari_code ||
                      placement?.almariCode ||
                      '';
                    const shelfLabel =
                      placement?.shelfNo
                        ? `S${placement.shelfNo}`
                        : book.shelf_no
                        ? `S${book.shelf_no}`
                        : book.shelf || 'S1';

                    return (
                      <tr
                        key={bookKey}
                        className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                      >
                        <td className="py-2.5 px-3.5">
                          <input
                            type="checkbox"
                            checked={selectedBookIds.has(bookKey)}
                            onChange={() => handleToggleSelectOne(bookKey)}
                            className="rounded cursor-pointer"
                          />
                        </td>
                        <td className="py-2.5 px-3.5 max-w-[280px]">
                          <p
                            onClick={() => onSelectBook && onSelectBook(book)}
                            className="font-bold text-slate-900 dark:text-white truncate cursor-pointer hover:text-[#541A72] dark:hover:text-[#FFD147]"
                          >
                            {book.book_name}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {book.author}
                          </p>
                        </td>
                        <td className="py-2.5 px-3.5">{book.category || 'General'}</td>
                        <td className="py-2.5 px-3.5">{book.language || 'English'}</td>
                        <td className="py-2.5 px-3.5 font-mono">{book.barcode}</td>
                        <td className="py-2.5 px-3.5 font-mono font-bold">
                          {book.total_quantity ?? 1}
                        </td>
                        <td className="py-2.5 px-3.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {book.available_quantity ?? 1}
                        </td>
                        <td className="py-2.5 px-3.5 text-slate-500 dark:text-slate-400">
                          {almariCode ? `${almariCode} • ${shelfLabel}` : 'Unassigned'}
                        </td>
                        <td className="py-2.5 px-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleIssueBookAction(book)}
                              className="px-2 py-0.5 rounded bg-[#C8963E] text-slate-950 font-bold hover:brightness-110 cursor-pointer"
                            >
                              Loan
                            </button>
                            <button
                              type="button"
                              onClick={() => onEditBook && onEditBook(book)}
                              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-white/10 cursor-pointer"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
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
                  {filteredBooks.length === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1}
                </strong>{' '}
                to <strong>{Math.min(safeCurrentPage * pageSize, filteredBooks.length)}</strong> of{' '}
                <strong>{filteredBooks.length.toLocaleString()}</strong> books
              </span>
              <div className="flex items-center gap-1.5">
                <span>Per page:</span>
                <select
                  value={pageSize}
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
