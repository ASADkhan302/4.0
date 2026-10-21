import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  BookOpen, 
  Layers, 
  CheckCircle2, 
  Clock, 
  Search, 
  LayoutGrid, 
  List, 
  Plus, 
  ArrowRightLeft, 
  Edit3, 
  Printer, 
  Barcode as BarcodeIcon,
  MapPin,
  ExternalLink,
  BookMarked,
  Trash2,
  BarChart3,
  X,
  Calendar,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  FileSpreadsheet,
  Building2,
  Sparkles,
  CheckSquare,
  Check,
  Library,
  Filter,
  SlidersHorizontal
} from 'lucide-react';
import { ULM_CREST_LOGO } from '../constants/branding';
import { Book, Transaction } from '../types/library';
import { CatalogChartsView } from './catalog/CatalogChartsView';
import { AlmariView } from './catalog/AlmariView';
import { AlmariErrorBoundary } from './catalog/AlmariErrorBoundary';
import { BulkAssignModal } from './modals/BulkAssignModal';
import { KpiCard } from './shared/SharedCards';
import { AlmariService } from '../services/almariService';
import { parseSerialNumber } from '../services/libraryStorageAndMigration';
import { sortBooksCatalog } from '../utils/almariSortUtils';
import { CountUp } from '@/components/ui/count-up';
import { CardSkeleton, TableSkeleton } from '@/components/ui/skeleton';
import CustomSelect from './ui/CustomSelect';
import { EmptyStateBooksDeco } from './decorative/EmptyStateBooksDeco';
import { formatDisplayDate } from '../utils/dateUtils';
import { isArabicOrUrduScript, matchesUrduSearch } from '../utils/urduUtils';

interface BooksCatalogViewProps {
  books: Book[];
  transactions: Transaction[];
  initialViewMode?: 'grid' | 'list' | 'chart' | 'almari';
  onOpenAddBook: () => void;
  onSelectBook: (book: Book) => void;
  onEditBook: (book: Book) => void;
  onDeleteBook: (book: Book) => void;
  onQuickLoan: (book: Book) => void;
  onPrintBarcode: (book: Book) => void;
  onOpenImportBookEntrySheet?: () => void;
  onOpenBatchLabelPrint?: () => void;
  onBooksUpdated?: (updatedBooks: Book[], message: string, batchId?: string) => void;
  totalDbBooksCount?: number;
}

export const BooksCatalogView: React.FC<BooksCatalogViewProps> = ({
  books,
  transactions,
  initialViewMode,
  onOpenAddBook,
  onSelectBook,
  onEditBook,
  onDeleteBook,
  onQuickLoan,
  onPrintBarcode,
  onOpenImportBookEntrySheet,
  onOpenBatchLabelPrint,
  onBooksUpdated,
  totalDbBooksCount,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedLanguage, setSelectedLanguage] = useState('ALL');
  const [sortBy, setSortBy] = useState<string>(() => {
    return localStorage.getItem('ulm_lms_catalog_sort') || 'newest_added';
  });
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('ALL');
  const [selectedAlmariFilter, setSelectedAlmariFilter] = useState('ALL');
  const [almarisRevision, setAlmarisRevision] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'chart' | 'almari'>(initialViewMode || 'list');
  const [isSecondaryFiltersOpen, setIsSecondaryFiltersOpen] = useState(false);

  useEffect(() => {
    if (initialViewMode) {
      setViewMode(initialViewMode);
    }
  }, [initialViewMode]);

  // Bulk selection state
  const [selectedBookIds, setSelectedBookIds] = useState<Set<string>>(new Set());
  const [bulkModalMode, setBulkModalMode] = useState<'assign_group' | 'assign_almari' | null>(null);

  const toggleSelectBook = (bookId: string) => {
    setSelectedBookIds(prev => {
      const next = new Set(prev);
      if (next.has(bookId)) next.delete(bookId);
      else next.add(bookId);
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    const next = new Set<string>();
    filteredBooks.forEach(b => next.add(b.id));
    setSelectedBookIds(next);
  };

  const handleClearSelection = () => {
    setSelectedBookIds(new Set());
  };

  const selectedBooksList = useMemo(() => {
    if (selectedBookIds.size === 0) return [];
    return books.filter(b => selectedBookIds.has(b.id));
  }, [books, selectedBookIds]);

  // Quick keyboard shortcut: Pressing "/" or Ctrl+F focuses the catalog search input
  useEffect(() => {
    const handleGlobalSearchKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if (!isInput && (e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f'))) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleGlobalSearchKey);
    return () => window.removeEventListener('keydown', handleGlobalSearchKey);
  }, []);

  const handleSortChange = (newSort: string) => {
    setSortBy(newSort);
    try {
      localStorage.setItem('ulm_lms_catalog_sort', newSort);
    } catch {
      // Ignore storage errors
    }
  };

  const handleToggleDateSort = () => {
    const next = sortBy === 'newest_added' ? 'oldest_added' : 'newest_added';
    handleSortChange(next);
  };

  const handleDownloadBookCsvTemplate = () => {
    const templateCsv = 'AccessionNo,Barcode,ISBN,BookTitle,Author,Category,TotalCopies,Shelf,DeweyCallNumber,Publisher,Edition,Year,Language,DateAdded\r\nULM-00001,0092000000001,978-0131103627,The C Programming Language,Brian W. Kernighan,Computer Science,1,ALM-01 - Shelf 1,005.133 ULM,Prentice Hall,2nd Edition,1988,English,2024-01-15\r\n';
    const blob = new Blob([templateCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'ULM_Books_Catalog_Import_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Compute metrics from actual database (honoring full database scale past localStorage limit)
  const activeBooks = useMemo(() => {
    return books.filter(b => b.is_active === undefined || b.is_active === true || (b.is_active as any) === 1 || (b.is_active as any) === '1' || b.is_active !== false);
  }, [books]);

  const totalTitles = totalDbBooksCount && totalDbBooksCount > activeBooks.length ? totalDbBooksCount : activeBooks.length;
  const totalCopies = totalDbBooksCount && totalDbBooksCount > activeBooks.length 
    ? totalDbBooksCount 
    : activeBooks.reduce((sum, b) => sum + (Number(b.total_quantity) || 1), 0);

  // Active loans calculated ONLY from actual active loan transactions or books explicitly marked 'ISSUED'
  const activeBorrowed = useMemo(() => {
    const fromTxs = transactions.filter(t => (t.status as string) === 'ISSUED' || t.status === 'ACTIVE' || (!t.return_date && t.status !== 'RETURNED')).length;
    if (fromTxs > 0) return fromTxs;
    return activeBooks.filter(b => String(b.status || '').trim().toUpperCase() === 'ISSUED').length;
  }, [transactions, activeBooks]);

  // Total available calculated as total copies minus actual active loans
  const totalAvailable = Math.max(0, totalCopies - activeBorrowed);
  const availPercent = totalCopies > 0 ? Math.round((totalAvailable / totalCopies) * 100) : 100;

  const overdueCount = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return transactions.filter(t => t.status === 'OVERDUE' || (t.status === 'ACTIVE' && t.due_date < today)).length;
  }, [transactions]);

  // Categories list across academic disciplines
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const b of activeBooks) {
      const cat = String(b.category || (b as any).discipline || (b as any).subject || (b as any).department || 'General').trim();
      if (cat) set.add(cat);
    }
    const arr = Array.from(set).filter(Boolean);
    return arr.length > 0 ? arr : (activeBooks.length > 0 ? ['General'] : []);
  }, [activeBooks]);

  // Filtered & sorted books
  const filteredBooks = useMemo(() => {
    const filtered = activeBooks
      .filter(book => {
        const query = searchQuery.trim();
        const matchesQuery = !query || 
          matchesUrduSearch(query, book.search_text || `${book.book_name || ''} ${book.author || ''} ${book.barcode || ''} ${book.accession_no || ''} ${book.isbn || ''} ${book.dewey_call_number || ''}`) ||
          (book.accession_no && book.accession_no.toLowerCase().includes(query.toLowerCase())) ||
          (book.shelf && book.shelf.toLowerCase().includes(query.toLowerCase())) ||
          (book.publisher && book.publisher.toLowerCase().includes(query.toLowerCase())) ||
          (book.title_roman && book.title_roman.toLowerCase().includes(query.toLowerCase())) ||
          (book.author_roman && book.author_roman.toLowerCase().includes(query.toLowerCase())) ||
          (book.barcode && book.barcode.toLowerCase().includes(query.toLowerCase())) ||
          (book.isbn && book.isbn.toLowerCase().includes(query.toLowerCase())) ||
          (book.dewey_call_number && book.dewey_call_number.toLowerCase().includes(query.toLowerCase()));

        const isDefaultCategory = !selectedCategory || selectedCategory === 'ALL' || selectedCategory === 'All Disciplines' || selectedCategory === 'All Categories' || selectedCategory === '';
        const bookCat = String(book.category || (book as any).discipline || (book as any).subject || (book as any).department || 'General').trim();
        const matchesCategory = isDefaultCategory || bookCat.toLowerCase() === selectedCategory.trim().toLowerCase() || (book.category || '').toLowerCase() === selectedCategory.trim().toLowerCase();

        const isDefaultStatus = !selectedStatus || selectedStatus === 'ALL' || selectedStatus === 'All Copies' || selectedStatus === '';
        const isBookIssued = String(book.status || '').trim().toUpperCase() === 'ISSUED';
        const isBookAvailable = !isBookIssued && ((book.available_quantity ?? 1) > 0 || ((book as any).available_copies ?? 1) > 0);
        const matchesStatus = 
          isDefaultStatus ||
          (selectedStatus === 'AVAILABLE' && isBookAvailable) ||
          (selectedStatus === 'LOANED' && !isBookAvailable);

        const isDefaultLanguage = !selectedLanguage || selectedLanguage === 'ALL' || selectedLanguage === 'All Languages' || selectedLanguage === '';
        const matchesLanguage = isDefaultLanguage ||
          (selectedLanguage === 'Urdu' && ((book.language || '').toLowerCase() === 'urdu' || isArabicOrUrduScript(book.book_name || ''))) ||
          (selectedLanguage === 'English' && (!book.language || (book.language || '').toLowerCase() === 'english') && !isArabicOrUrduScript(book.book_name || '')) ||
          ((book.language || '').toLowerCase() === selectedLanguage.toLowerCase());

        const bookDate = book.date_added || (book.created_at ? book.created_at.split(' ')[0] : '') || (book as any).date_of_entry || '';
        const matchesDateFrom = !dateFrom || dateFrom === '' || (bookDate && bookDate >= dateFrom);
        const matchesDateTo = !dateTo || dateTo === '' || (bookDate && bookDate <= dateTo);

        // Group filter
        const isDefaultGroup = !selectedGroupFilter || selectedGroupFilter === 'ALL' || selectedGroupFilter === 'All Groups' || selectedGroupFilter === '';
        const matchesGroup = 
          isDefaultGroup ||
          (selectedGroupFilter === 'NO_GROUP' && !book.group_id) ||
          book.group_id === selectedGroupFilter;

        // Almari filter
        const isDefaultAlmari = !selectedAlmariFilter || selectedAlmariFilter === 'ALL' || selectedAlmariFilter === 'All Almaris' || selectedAlmariFilter === '';
        const matchesAlmari = 
          isDefaultAlmari ||
          (selectedAlmariFilter === 'NO_ALMARI' && !book.almari_id) ||
          book.almari_id === selectedAlmariFilter;

        return matchesQuery && matchesCategory && matchesStatus && matchesLanguage && matchesDateFrom && matchesDateTo && matchesGroup && matchesAlmari;
      });

    // Check if using the high-performance Almari/Dewey sort modes
    if (['almari_order', 'group_then_almari', 'dewey_decimal', 'shelf_location'].includes(sortBy)) {
      const groupsMap = new Map(AlmariService.getGroups().map(g => [g.id, g]));
      const almarisMap = new Map(AlmariService.getAlmaris().map(a => [a.id, a]));
      return sortBooksCatalog(filtered, sortBy, groupsMap, almarisMap);
    }

    return [...filtered].sort((a: Book, b: Book) => {
        if (sortBy === 'newest_added') {
          const dateA = a.date_added || (a.created_at ? a.created_at.split(' ')[0] : '1970-01-01');
          const dateB = b.date_added || (b.created_at ? b.created_at.split(' ')[0] : '1970-01-01');
          if (dateA !== dateB) return dateB.localeCompare(dateA);

          // Tie 1: created_at
          const timeA = a.created_at || '';
          const timeB = b.created_at || '';
          if (timeA !== timeB) return timeB.localeCompare(timeA);

          // Tie 2: accession no. (strict numeric series)
          const numA = parseSerialNumber(a.accession_no || a.barcode);
          const numB = parseSerialNumber(b.accession_no || b.barcode);
          if (numA !== numB) return numB - numA;
          return (a.accession_no || a.barcode || '').localeCompare(b.accession_no || b.barcode || '', undefined, { numeric: true });
        }

        if (sortBy === 'oldest_added') {
          const dateA = a.date_added || (a.created_at ? a.created_at.split(' ')[0] : '1970-01-01');
          const dateB = b.date_added || (b.created_at ? b.created_at.split(' ')[0] : '1970-01-01');
          if (dateA !== dateB) return dateA.localeCompare(dateB);

          // Tie 1: created_at
          const timeA = a.created_at || '';
          const timeB = b.created_at || '';
          if (timeA !== timeB) return timeA.localeCompare(timeB);

          // Tie 2: accession no. (strict numeric series)
          const numA = parseSerialNumber(a.accession_no || a.barcode);
          const numB = parseSerialNumber(b.accession_no || b.barcode);
          if (numA !== numB) return numA - numB;
          return (a.accession_no || a.barcode || '').localeCompare(b.accession_no || b.barcode || '', undefined, { numeric: true });
        }

        if (sortBy === 'accession') {
          const numA = parseSerialNumber(a.accession_no || a.barcode);
          const numB = parseSerialNumber(b.accession_no || b.barcode);
          if (numA !== numB) return numA - numB;
          return (a.accession_no || a.barcode || '').localeCompare(b.accession_no || b.barcode || '', undefined, { numeric: true });
        }

        if (sortBy === 'accession_desc') {
          const numA = parseSerialNumber(a.accession_no || a.barcode);
          const numB = parseSerialNumber(b.accession_no || b.barcode);
          if (numA !== numB) return numB - numA;
          return (b.accession_no || b.barcode || '').localeCompare(a.accession_no || a.barcode || '', undefined, { numeric: true });
        }

        if (sortBy === 'title') {
          const keyA = a.title_sort || a.book_name;
          const keyB = b.title_sort || b.book_name;
          return keyA.localeCompare(keyB);
        }

        if (sortBy === 'title_desc') {
          const keyA = a.title_sort || a.book_name;
          const keyB = b.title_sort || b.book_name;
          return keyB.localeCompare(keyA);
        }

        if (sortBy === 'author') {
          const keyA = a.author_sort || a.author;
          const keyB = b.author_sort || b.author;
          return keyA.localeCompare(keyB);
        }

        if (sortBy === 'author_desc') {
          const keyA = a.author_sort || a.author;
          const keyB = b.author_sort || b.author;
          return keyB.localeCompare(keyA);
        }

        if (sortBy === 'copies') return b.total_quantity - a.total_quantity;
        if (sortBy === 'year') return b.publication_year - a.publication_year;
        return 0;
      });
  }, [activeBooks, searchQuery, selectedCategory, selectedStatus, selectedLanguage, selectedGroupFilter, selectedAlmariFilter, sortBy, dateFrom, dateTo]);

  // Controlled pagination & GPU optimization (default 50 rows per page to prevent UI freezing on 4,000+ books)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);

  // Automatically reset active Catalog search/category/almari filters right after import finishes
  const prevBooksCountRef = useRef(books.length);
  useEffect(() => {
    if (books.length > prevBooksCountRef.current) {
      setSearchQuery('');
      setSelectedCategory('ALL');
      setSelectedStatus('ALL');
      setSelectedLanguage('ALL');
      setSelectedGroupFilter('ALL');
      setSelectedAlmariFilter('ALL');
      setDateFrom('');
      setDateTo('');
      setCurrentPage(1);
    }
    prevBooksCountRef.current = books.length;
  }, [books.length]);

  // Reset to page 1 on search or filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, selectedStatus, selectedLanguage, selectedGroupFilter, selectedAlmariFilter, dateFrom, dateTo, sortBy]);

  const totalMatchingBooks = filteredBooks.length;
  const totalPages = Math.max(1, Math.ceil(totalMatchingBooks / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedBooks = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * pageSize;
    return filteredBooks.slice(startIndex, startIndex + pageSize);
  }, [filteredBooks, safeCurrentPage, pageSize]);

  // Generate SVG-like barcode bars based on barcode string (always high contrast in light & dark)
  const renderBarcodeStrip = (code: string) => {
    return (
      <div 
        className="barcode-container flex items-center gap-[1.5px] h-6 px-1.5 py-0.5 bg-white rounded-[4px] border border-white/20 select-none shadow-xs" 
        title={`Barcode: ${code}`}
        data-barcode-container="true"
      >
        {code.split('').map((char, idx) => {
          const num = parseInt(char, 10) || 3;
          const w = (num % 3) + 1;
          return (
            <div
              key={idx}
              className="barcode-bar h-full"
              style={{ width: `${w}px`, backgroundColor: '#000000', minWidth: '1px' }}
            />
          );
        })}
      </div>
    );
  };

  const activeSecondaryFilterCount = (selectedStatus !== 'ALL' && selectedStatus !== '' ? 1 : 0) +
    (selectedGroupFilter !== 'ALL' && selectedGroupFilter !== '' ? 1 : 0) +
    (dateFrom || dateTo ? 1 : 0);

  return (
    <div className="flex-1 w-full bg-transparent px-6 py-5 overflow-y-auto space-y-5">
      <div className="max-w-[1920px] mx-auto space-y-5">
        
        {/* Only render KPI metrics and Catalog Toolbar when NOT in dedicated Almari View */}
        {viewMode !== 'almari' && (
          <>
            {/* Operational Collection Metrics (Unified Institutional Surfaces - Rule 4) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                label="Cataloged Titles"
                value={totalTitles}
                note="Distinct records"
                icon={BookOpen}
                subLabel={`Across ${categories.length} academic disciplines`}
              />
              <KpiCard
                label="Physical Volumes"
                value={totalCopies}
                note="Physical items"
                icon={Layers}
                subLabel="Total holdings in campus collection"
              />
              <KpiCard
                label="Shelf Availability"
                value={totalAvailable}
                note="Available now"
                icon={CheckCircle2}
                subLabel={`${totalAvailable.toLocaleString()} / ${totalCopies.toLocaleString()} volumes on shelf`}
              />
              <KpiCard
                label="Active Loans"
                value={activeBorrowed}
                note={overdueCount > 0 ? `${overdueCount} overdue` : 'On loan'}
                icon={Clock}
                isGoldNumber={activeBorrowed > 0}
                isDanger={overdueCount > 0}
                subLabel={overdueCount > 0 ? `${overdueCount} books require overdue follow-up` : 'Currently checked out to members'}
              />
            </div>

            {/* Decluttered 2-Row Filter & Search Action Bar (Rule 5) */}
            <div className="ulm-liquid-glass rounded-xl p-3.5 space-y-3 shadow-xs">
              {/* Row 1: Search & Primary Filters */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Search Input */}
                <div className="relative flex-1 min-w-[260px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    id="catalog-search-input"
                    name="catalogSearch"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setIsSearchFocused(false)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape' && searchQuery) {
                        e.stopPropagation();
                        setSearchQuery('');
                      }
                    }}
                    placeholder="Search title, author, barcode, accession, ISBN..."
                    aria-label="Search catalog books"
                    autoComplete="off"
                    spellCheck={false}
                    className={`w-full h-10 bg-[#0B1220] hover:bg-[#0E1525] focus:bg-[#0B1220] border rounded-lg pl-10 pr-8 text-[13px] text-white placeholder:text-slate-400 transition-colors ${
                      isSearchFocused
                        ? 'border-[#BC881B] ring-1 ring-[#BC881B] outline-none'
                        : 'border-white/10 hover:border-white/20'
                    }`}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        searchInputRef.current?.focus();
                      }}
                      className="w-5 h-5 flex items-center justify-center absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer"
                      title="Clear search"
                      aria-label="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* 4 Clean Select Dropdowns */}
                {/* 1. Discipline */}
                <div className="w-44 min-w-[150px]">
                  <CustomSelect
                    value={selectedCategory}
                    onChange={(val) => setSelectedCategory(val)}
                    options={[
                      { value: 'ALL', label: 'All Disciplines' },
                      ...categories.map(c => ({ value: c, label: c }))
                    ]}
                    searchable
                    variant="dark"
                  />
                </div>

                {/* 2. Language (Rule 5: Clean labels, never Nastaliq overflowing) */}
                <div className="w-36 min-w-[130px]">
                  <CustomSelect
                    value={selectedLanguage}
                    onChange={(val) => setSelectedLanguage(val)}
                    options={[
                      { value: 'ALL', label: 'All Languages' },
                      { value: 'English', label: 'English' },
                      { value: 'Urdu', label: 'Urdu (اردو)' },
                      { value: 'Pashto', label: 'Pashto (پښتو)' },
                    ]}
                    variant="dark"
                  />
                </div>

                {/* 3. Almari */}
                <div className="w-40 min-w-[140px]">
                  <CustomSelect
                    value={selectedAlmariFilter}
                    onChange={(val) => setSelectedAlmariFilter(val)}
                    options={[
                      { value: 'ALL', label: 'All Almaris' },
                      { value: 'NO_ALMARI', label: 'No Almari' },
                      ...AlmariService.getAlmaris().filter(a => a.is_active).map(a => ({ value: a.id, label: `${a.code} - ${a.name_en}` }))
                    ]}
                    searchable
                    variant="dark"
                  />
                </div>

                {/* 4. Sort */}
                <div className="w-44 min-w-[150px]">
                  <CustomSelect
                    value={sortBy}
                    onChange={(val) => handleSortChange(val)}
                    options={[
                      { value: 'newest_added', label: 'Sort: Newest Added' },
                      { value: 'oldest_added', label: 'Sort: Oldest Added' },
                      { value: 'almari_order', label: 'Sort: Almari Order' },
                      { value: 'group_then_almari', label: 'Sort: Group & Almari' },
                      { value: 'dewey_decimal', label: 'Sort: Call # (Dewey)' },
                      { value: 'accession', label: 'Sort: Accession (Asc)' },
                      { value: 'accession_desc', label: 'Sort: Accession (Desc)' },
                      { value: 'title', label: 'Sort: Title (A-Z)' },
                      { value: 'author', label: 'Sort: Author (A-Z)' },
                    ]}
                    variant="dark"
                  />
                </div>

                {/* Secondary Filters Popover Button */}
                <button
                  type="button"
                  onClick={() => setIsSecondaryFiltersOpen(!isSecondaryFiltersOpen)}
                  className={`h-10 px-3.5 rounded-lg border text-[13px] font-medium flex items-center gap-2 transition-colors cursor-pointer shrink-0 ${
                    isSecondaryFiltersOpen || activeSecondaryFilterCount > 0
                      ? 'bg-[#151C2C] border-[#BC881B] text-[#E0B450]'
                      : 'bg-[#0B1220] border-white/10 text-slate-300 hover:bg-[#151C2C] hover:text-white'
                  }`}
                  title="Toggle more filters (copies, groups, date added)"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Filters</span>
                  {activeSecondaryFilterCount > 0 && (
                    <span className="w-5 h-5 rounded-full bg-[#BC881B] text-slate-950 font-bold text-[11px] flex items-center justify-center">
                      {activeSecondaryFilterCount}
                    </span>
                  )}
                </button>
              </div>

              {/* Secondary Filters Popover Panel */}
              {isSecondaryFiltersOpen && (
                <div className="p-3 bg-[#0B1220] border border-white/10 rounded-xl flex flex-wrap items-center gap-3 animate-in fade-in">
                  {/* Copies / Availability */}
                  <div className="w-40 min-w-[140px]">
                    <CustomSelect
                      value={selectedStatus}
                      onChange={(val) => setSelectedStatus(val)}
                      options={[
                        { value: 'ALL', label: 'All Copies' },
                        { value: 'AVAILABLE', label: 'Available Now' },
                        { value: 'LOANED', label: 'Fully Loaned' }
                      ]}
                      variant="dark"
                    />
                  </div>

                  {/* Group Filter */}
                  <div className="w-44 min-w-[150px]">
                    <CustomSelect
                      value={selectedGroupFilter}
                      onChange={(val) => setSelectedGroupFilter(val)}
                      options={[
                        { value: 'ALL', label: 'All Groups' },
                        { value: 'NO_GROUP', label: 'Unassigned Group' },
                        ...AlmariService.getGroups().map(g => ({ value: g.id, label: g.name_en }))
                      ]}
                      searchable
                      variant="dark"
                    />
                  </div>

                  {/* Date Added Range */}
                  <div className="h-10 flex items-center gap-2 bg-[#0E1525] border border-white/10 rounded-lg px-3 text-[12px]">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="text-slate-400 font-mono text-[11px]">From:</span>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="[color-scheme:dark] bg-transparent text-[12px] font-mono text-white focus:outline-none cursor-pointer"
                    />
                    <span className="text-slate-400 font-mono text-[11px] px-0.5">To:</span>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="[color-scheme:dark] bg-transparent text-[12px] font-mono text-white focus:outline-none cursor-pointer"
                    />
                    {(dateFrom || dateTo) && (
                      <button
                        type="button"
                        onClick={() => { setDateFrom(''); setDateTo(''); }}
                        className="p-1 text-slate-400 hover:text-white cursor-pointer rounded"
                        title="Clear date range"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {activeSecondaryFilterCount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedStatus('ALL');
                        setSelectedGroupFilter('ALL');
                        setDateFrom('');
                        setDateTo('');
                      }}
                      className="text-xs text-[#BC881B] hover:underline font-medium cursor-pointer ml-auto"
                    >
                      Reset Secondary Filters
                    </button>
                  )}
                </div>
              )}

              {/* Row 2: View Switcher & Secondary Actions (Rule 5) */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-white/[0.06]">
                {/* Left: Segmented View Switcher */}
                <div className="bg-[#0B1220] p-1 rounded-lg border border-white/10 inline-flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    aria-pressed={viewMode === 'list'}
                    className={`flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                      viewMode === 'list' 
                        ? 'bg-[#BC881B] text-slate-950 font-semibold shadow-xs' 
                        : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
                    }`}
                    title="Switch to Table List View"
                  >
                    <List className="w-3.5 h-3.5" />
                    <span>List View</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    aria-pressed={viewMode === 'grid'}
                    className={`flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                      viewMode === 'grid' 
                        ? 'bg-[#BC881B] text-slate-950 font-semibold shadow-xs' 
                        : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
                    }`}
                    title="Switch to Card Grid View"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>Grid View</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('almari')}
                    aria-pressed={(viewMode as string) === 'almari'}
                    className={`flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                      (viewMode as string) === 'almari' 
                        ? 'bg-[#BC881B] text-slate-950 font-semibold shadow-xs' 
                        : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
                    }`}
                    title="Switch to Almari & Shelves Visual View"
                  >
                    <Library className="w-3.5 h-3.5" />
                    <span>Almari View</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('chart')}
                    aria-pressed={viewMode === 'chart'}
                    className={`flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                      viewMode === 'chart' 
                        ? 'bg-[#BC881B] text-slate-950 font-semibold shadow-xs' 
                        : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
                    }`}
                    title="Switch to Analytics View"
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>Analytics</span>
                  </button>
                </div>

                {/* Right: Quiet Secondary Actions (No duplicate Add Book, no neon button fills) */}
                <div className="flex items-center gap-2">
                  {onOpenImportBookEntrySheet && (
                    <button
                      type="button"
                      onClick={onOpenImportBookEntrySheet}
                      className="h-9 px-3 rounded-lg bg-[#151C2C] border border-white/10 text-slate-200 hover:bg-slate-800 text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Upload a .xlsx or .csv file to validate and add books"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Import Excel/CSV</span>
                    </button>
                  )}

                  {onOpenBatchLabelPrint && (
                    <button
                      type="button"
                      onClick={onOpenBatchLabelPrint}
                      className="h-9 px-3 rounded-lg bg-[#151C2C] border border-white/10 text-slate-200 hover:bg-slate-800 text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Batch Barcode Labels Generator"
                    >
                      <Printer className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Batch Labels</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleDownloadBookCsvTemplate}
                    className="h-9 px-3 rounded-lg bg-[#151C2C] border border-white/10 text-slate-200 hover:bg-slate-800 text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Download official catalog CSV template"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>CSV Template</span>
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Floating/Sticky Selection Bar for Catalog Placement */}
        {selectedBookIds.size > 0 && viewMode !== 'almari' && (
          <div className="bg-[#221F26] border border-[#BC881B] rounded-[14px] p-3 sm:p-3.5 shadow-[0_8px_24px_rgba(0,0,0,0.6)] flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#BC881B] text-[#1A1A1A] font-extrabold flex items-center justify-center font-mono text-sm">
                {selectedBookIds.size}
              </div>
              <div>
                <span className="text-white font-bold text-sm">
                  {selectedBookIds.size} book{selectedBookIds.size !== 1 ? 's' : ''} selected
                </span>
                <span className="text-xs text-[#B3AABD] ml-2">
                  ({filteredBooks.length} match current filters)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {selectedBookIds.size < filteredBooks.length && (
                <button
                  type="button"
                  onClick={handleSelectAllFiltered}
                  className="px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.12] text-[#E0D8E6] rounded-lg text-xs font-semibold border border-white/10 transition-colors cursor-pointer"
                >
                  Select all {filteredBooks.length} matching filter
                </button>
              )}
              <button
                type="button"
                onClick={() => setBulkModalMode('assign_almari')}
                className="px-3.5 py-1.5 bg-[#BC881B] hover:bg-[#D4A02A] text-[#1A1A1A] font-bold text-xs rounded-lg flex items-center gap-1.5 shadow transition-colors cursor-pointer"
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Place in Almari...</span>
              </button>
              <button
                type="button"
                onClick={() => setBulkModalMode('assign_group')}
                className="px-3 py-1.5 bg-[#541A72] hover:bg-[#6D2394] text-white font-bold text-xs rounded-lg flex items-center gap-1.5 border border-[#A66BC9]/40 shadow transition-colors cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Assign Group...</span>
              </button>
              <button
                type="button"
                onClick={handleClearSelection}
                className="px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-[#B3AABD] hover:text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Catalog Display: Almari View, Chart View, Grid View or List View */}
        {viewMode === 'almari' ? (
          <AlmariErrorBoundary fallbackTitle="Error loading Almari View" onReset={() => setViewMode('almari')}>
            <AlmariView
              books={books}
              onOpenBook={onSelectBook}
              onEditBook={onEditBook}
              selectedCatalogBookIds={selectedBookIds}
              onClearCatalogSelection={handleClearSelection}
              onReloadAlmaris={() => setAlmarisRevision(r => r + 1)}
              onFilterCatalogByShelf={(almariCode, shelfNo) => {
                setSearchQuery(shelfNo ? `${almariCode} Shelf ${shelfNo}` : almariCode);
                setViewMode('grid');
              }}
              onCatalogBooksUpdated={(updated, msg, batchId) => {
                if (onBooksUpdated) onBooksUpdated(updated, msg, batchId);
              }}
            />
          </AlmariErrorBoundary>
        ) : viewMode === 'chart' ? (
          <CatalogChartsView
            books={books}
            transactions={transactions}
            onSelectCategory={(cat) => {
              setSelectedCategory(cat);
              setViewMode('grid');
            }}
            onSwitchView={(mode) => setViewMode(mode)}
          />
        ) : activeBooks.length === 0 ? (
          <div className="bg-[#141214] border border-[#BC881B]/30 rounded-xl p-12 text-center text-[var(--text-muted)] space-y-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
            <div className="w-16 h-16 mx-auto rounded-full bg-[#541A72]/30 border border-[#BC881B]/40 flex items-center justify-center text-[#E0B450]">
              <Library className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h4 className="text-lg font-cinzel font-bold text-white tracking-wide">Library Catalog is Empty</h4>
              <p className="text-sm text-[#B3AABD] max-w-md mx-auto">
                The library database is clean and ready (0 books registered). You can register a book manually or import books from your Excel spreadsheet.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2 flex-wrap">
              <button
                type="button"
                onClick={onOpenAddBook}
                className="h-10 px-5 rounded-[10px] bg-gradient-to-r from-[#BC881B] to-[#E0B450] text-[#141214] font-bold text-xs uppercase tracking-wider shadow-md hover:brightness-110 active:scale-95 transition-all cursor-pointer inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Register First Book</span>
              </button>
              {onOpenImportBookEntrySheet && (
                <button
                  type="button"
                  onClick={onOpenImportBookEntrySheet}
                  className="h-10 px-5 rounded-[10px] bg-[#541A72] hover:bg-[#6A2290] text-white font-semibold text-xs uppercase tracking-wider border border-[#A66BC9]/30 transition-all cursor-pointer inline-flex items-center gap-2"
                >
                  <FileSpreadsheet className="w-4 h-4 text-[#E0B450]" />
                  <span>Import Excel / CSV</span>
                </button>
              )}
            </div>
          </div>
        ) : filteredBooks.length === 0 ? (
          <div className="bg-[#141214] border border-white/[0.08] rounded-xl p-12 text-center text-slate-400 space-y-3 shadow-2xs">
            <div className="flex items-center justify-center gap-3">
              <BookMarked className="w-12 h-12 text-[#BC881B]/60" />
              <EmptyStateBooksDeco />
            </div>
            <h4 className="text-base font-semibold text-white">No matching books found</h4>
            <p className="text-xs text-[#B3AABD] max-w-md mx-auto">
              No titles match your active filter criteria. Try clearing your search keyword or resetting category and status filters.
            </p>
            <button
              onClick={() => { setSearchQuery(''); setSelectedCategory('ALL'); setSelectedStatus('ALL'); setSelectedLanguage('ALL'); setDateFrom(''); setDateTo(''); }}
              className="px-4 py-2 bg-[#221F26] hover:bg-[#2E2A33] text-white text-xs font-semibold rounded-lg border border-white/10 transition-colors cursor-pointer"
            >
              Reset Search Filters
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          /* 4-column responsive grid of high-fidelity book cards */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {paginatedBooks.map((book, idx) => {
              const isAvailable = book.available_quantity > 0;
              const isLowStock = isAvailable && book.available_quantity <= 2;
              const issuedCount = book.total_quantity - book.available_quantity;
              const capacityPercent = book.total_quantity > 0 
                ? Math.min(100, Math.round((issuedCount / book.total_quantity) * 100)) 
                : 0;

              return (
                <div
                  key={book.id}
                  style={{ animationDelay: `${Math.min((idx % 12) * 35, 300)}ms`, contentVisibility: 'auto', containIntrinsicSize: '0 320px' }}
                  className="book-card-enter rounded-[14px] ulm-liquid-glass overflow-hidden flex flex-col justify-between group transition-all duration-200 relative hover:-translate-y-[3px] hover:border-[#BC881B] h-full"
                >
                  {/* Selection Checkbox */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelectBook(book.id);
                    }}
                    className={`absolute top-2.5 right-2.5 z-20 w-6 h-6 rounded-md flex items-center justify-center border transition-all cursor-pointer ${
                      selectedBookIds.has(book.id)
                        ? 'bg-[#BC881B] border-[#BC881B] text-[#1A1A1A] shadow-sm'
                        : 'bg-white/40 dark:bg-[#141214]/80 border-[var(--border-subtle)] text-transparent hover:border-[#BC881B] hover:text-royal-gold'
                    }`}
                    title={selectedBookIds.has(book.id) ? 'Deselect book' : 'Select book for Almari placement'}
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </button>

                  {/* Card Body */}
                  <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                    {/* Top Section: Thumbnail + Flexible Meta Info Header */}
                    <div className="flex gap-3.5 items-start">
                      {/* Book Cover Thumbnail with realistic spine (gold stripe) & ULM PRESS mark only */}
                      <div 
                        onClick={() => onSelectBook(book)}
                        className="w-[88px] min-h-[124px] shrink-0 rounded-[10px] overflow-hidden bg-[#141214] border border-white/[0.1] shadow-md relative group/cover cursor-pointer flex flex-col justify-between transition-transform duration-200 group-hover:scale-[1.02]"
                        title={book.book_name}
                      >
                        {/* Elegant Spine with Gold Stripe & ULM PRESS mark only on the spine */}
                        <div className="absolute left-0 top-0 bottom-0 w-3 bg-gradient-to-r from-[#8C600D] via-[#E0B450] to-[#BC881B] z-10 shadow-sm flex items-center justify-center">
                          <span className="font-mono text-[7px] text-[#1A1A1A] font-extrabold uppercase tracking-widest -rotate-90 select-none whitespace-nowrap">
                            ULM PRESS
                          </span>
                        </div>

                        {book.book_image_path ? (
                          <img
                            src={book.book_image_path}
                            alt={book.book_name}
                            referrerPolicy="no-referrer"
                            className="absolute inset-0 w-full h-full object-cover pl-3"
                            onError={(e) => {
                              // Zero-broken-image fallback to styled cover
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : null}

                        {/* Geometric styling fallback behind image - clean book pattern, NO title or call number printed over it */}
                        <div className="relative z-0 h-full w-full pl-3 min-h-[124px] flex items-center justify-center bg-gradient-to-br from-[#2B2730] to-[#1A1A1A]">
                          <BookOpen className="w-6 h-6 text-[#BC881B]/40 stroke-[1.5]" />
                        </div>
                      </div>

                      {/* Header Meta Info (flexible layout without fixed height clipping) */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between space-y-1.5">
                        <div className="space-y-1">
                          {/* Badges row with wrap support */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="inline-flex items-center text-[11px] font-semibold text-blue-500 dark:text-[#6FA8D2] bg-blue-500/10 border border-blue-500/30 px-2 py-0.5 rounded-[6px] shrink-0">
                              {book.category}
                            </span>
                            {(book.language === 'Urdu' || isArabicOrUrduScript(book.book_name)) ? (
                              <span className="inline-flex items-center text-[11px] font-semibold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-[6px] shrink-0">
                                اردو · Nastaliq
                              </span>
                            ) : (
                              <span className="inline-flex items-center text-[11px] font-mono text-[var(--text-muted)] shrink-0">
                                {book.language || 'English'}
                              </span>
                            )}
                            <span className="inline-flex items-center text-[11px] font-mono font-semibold text-royal-gold bg-[#BC881B]/15 border border-[#BC881B]/30 px-2 py-0.5 rounded-[6px] shrink-0">
                              {book.edition}
                            </span>
                          </div>

                          {/* Clamped 2-line title with tooltip and unclipped Urdu script support */}
                          <h4 
                            onClick={() => onSelectBook(book)}
                            dir="auto"
                            style={{ unicodeBidi: 'plaintext' }}
                            className={`font-bold text-[var(--text-strong)] hover:text-royal-gold transition-colors mt-1 line-clamp-2 cursor-pointer min-h-[38px] ${
                              isArabicOrUrduScript(book.book_name) ? 'font-urdu text-[15px] leading-[2.1]' : 'text-[14px] leading-snug'
                            }`}
                            title={book.book_name}
                          >
                            {book.book_name}
                          </h4>
                          {book.title_roman && (
                            <p className="text-[11px] text-royal-gold/80 font-mono truncate" title={book.title_roman}>
                              ({book.title_roman})
                            </p>
                          )}

                          {/* Single-line author with ellipsis and tooltip */}
                          <p 
                            dir="auto"
                            style={{ unicodeBidi: 'plaintext' }}
                            className={`text-[12px] text-[var(--text-muted)] truncate ${
                              isArabicOrUrduScript(book.author) ? 'font-urdu leading-[2]' : ''
                            }`}
                            title={book.author}
                          >
                            by <span className="text-[var(--text-strong)] font-medium">{book.author}</span>
                            {book.author_roman && (
                              <span className="text-[11px] text-[var(--text-muted)] font-mono ml-1">· {book.author_roman}</span>
                            )}
                          </p>
                        </div>

                        {/* Call number & Shelf location with pin icon */}
                        <div 
                          className="text-[12px] text-[var(--text-muted)] flex items-center gap-1.5 pt-1"
                          title={`${book.shelf} · Row ${book.row}`}
                        >
                          <MapPin className="w-3.5 h-3.5 text-[#29658E] shrink-0" />
                          <span className="truncate">{book.shelf} · Row {book.row}</span>
                        </div>
                      </div>
                    </div>

                    {/* Sleek Unified Crystal Glass Shelf Bar (Replaces 3 nested boxes) */}
                    <div className="bg-white/10 dark:bg-black/25 rounded-xl p-2.5 border border-[var(--border-subtle)] space-y-2 mt-auto">
                      <div className="flex items-center justify-between text-[11.5px] font-mono">
                        <div className="truncate flex items-center gap-1.5 text-[var(--text-muted)]">
                          <Calendar className="w-3.5 h-3.5 text-royal-gold shrink-0" />
                          <span>Added:</span>
                          <span className="text-[var(--text-strong)] font-medium">{formatDisplayDate(book.date_added || book.created_at)}</span>
                        </div>
                        <span className="text-royal-gold font-mono text-[11px] font-semibold bg-[#BC881B]/15 px-2 py-0.5 rounded-[6px] border border-[#BC881B]/25">
                          {book.dewey_call_number}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-[var(--border-subtle)]">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <BarcodeIcon className="w-4 h-4 text-royal-gold shrink-0" />
                          <span className="font-mono text-[12px] text-[var(--text-strong)] font-bold tracking-wider truncate">
                            {book.barcode}
                          </span>
                        </div>
                        <div className="shrink-0">
                          {renderBarcodeStrip(book.barcode)}
                        </div>
                      </div>
                    </div>

                    {/* Availability Status & Capacity Bar */}
                    <div className="flex items-center justify-between h-[36px] pt-0.5">
                      {!isAvailable ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-500 dark:text-rose-300 text-[12px] font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                          <span>0 Available (All Issued)</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-300 text-[12px] font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span>{book.available_quantity} Available</span>
                        </div>
                      )}
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[12px] text-[var(--text-muted)] font-mono tabular-nums">
                          {issuedCount} issued / {book.total_quantity} total
                        </span>
                        <div className="w-20 bg-white/20 dark:bg-white/[0.08] h-1.5 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-[#BC881B] rounded-full transition-all duration-300" 
                            style={{ width: `${capacityPercent}%` }} 
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Action Footer */}
                  <div className="px-3.5 py-2.5 bg-[#141214]/60 border-t border-white/[0.06] flex items-center justify-between gap-2 h-[52px]">
                    {/* Quick Loan Button */}
                    <button
                      onClick={() => onQuickLoan(book)}
                      disabled={!isAvailable}
                      className={`flex-1 h-9 min-h-[36px] flex items-center justify-center gap-2 py-1.5 px-3 rounded-[10px] text-[12px] font-bold transition-all duration-150 border cursor-pointer ${
                        isAvailable
                          ? 'border-[#BC881B] bg-[#BC881B]/15 text-[#E0B450] hover:bg-[#BC881B] hover:text-[#1A1A1A] hover:shadow-[0_2px_12px_rgba(188,136,27,0.35)] active:scale-95'
                          : 'border-transparent bg-[#2B1538] text-[#8B719B] cursor-not-allowed pointer-events-none'
                      } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E0B450]`}
                      title={isAvailable ? 'Quickly issue a copy of this book' : 'No available copies left on shelf'}
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5 shrink-0" />
                      <span className="btn-label">Quick Loan</span>
                    </button>

                    {/* Edit Button */}
                    <button
                      onClick={() => onEditBook(book)}
                      className="w-9 h-9 flex items-center justify-center rounded-[10px] bg-[#141214] border border-white/[0.08] text-[#B3AABD] hover:text-[#E0B450] hover:border-[#BC881B]/40 hover:bg-[#BC881B]/10 transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#29658E] cursor-pointer"
                      title="Edit book details & inventory quantities"
                      aria-label="Edit book details"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    {/* Barcode Print Button */}
                    <button
                      onClick={() => onPrintBarcode(book)}
                      className="w-9 h-9 flex items-center justify-center rounded-[10px] bg-[#141214] border border-white/[0.08] text-[#B3AABD] hover:text-[#E0B450] hover:border-[#BC881B]/40 hover:bg-[#BC881B]/10 transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#29658E] cursor-pointer"
                      title="Print official barcode sticker with campus insignia"
                      aria-label="Print official barcode sticker"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete Book Button (turns red on hover) */}
                    <button
                      onClick={() => onDeleteBook(book)}
                      className="w-9 h-9 flex items-center justify-center rounded-[10px] bg-[#141214] border border-white/[0.08] text-[#B3AABD] hover:text-rose-400 hover:border-rose-500/40 hover:bg-rose-500/10 transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#29658E] cursor-pointer"
                      title="Delete or archive book"
                      aria-label="Delete book"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Details modal trigger */}
                    <button
                      onClick={() => onSelectBook(book)}
                      className="w-9 h-9 flex items-center justify-center rounded-[10px] bg-[#141214] border border-white/[0.08] text-[#B3AABD] hover:text-[#6FA8D2] hover:border-[#29658E]/40 hover:bg-[#29658E]/10 transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#29658E] cursor-pointer"
                      title="Full book specification & history"
                      aria-label="Full book specification & history"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* List View: Wide table on desktop, automatically switches to compact cards on narrow / restored screens (< 1024px) */
          <>
            <div className="hidden lg:block ulm-liquid-glass rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-[var(--text-body)]">
                  <thead className="bg-black/10 dark:bg-black/30 text-[var(--text-strong)] uppercase font-mono-code text-[11px] border-b border-[var(--border-subtle)]">
                    <tr>
                      <th className="py-3 px-3 text-center w-10">
                      <input
                        type="checkbox"
                        checked={filteredBooks.length > 0 && selectedBookIds.size === filteredBooks.length}
                        onChange={(e) => {
                          if (e.target.checked) handleSelectAllFiltered();
                          else handleClearSelection();
                        }}
                        className="accent-[var(--gold)] cursor-pointer"
                        title="Select / Deselect all filtered books"
                      />
                    </th>
                    <th className="py-3 px-4">Book Title & Author</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Language</th>
                    <th className="py-3 px-4">Barcode / Call No</th>
                    <th 
                      onClick={handleToggleDateSort}
                      className="py-3 px-4 cursor-pointer hover:text-amber-300 transition-colors select-none"
                      title="Click to toggle sorting by Date Added"
                    >
                      <div className="flex items-center gap-1">
                        <span>Date Added</span>
                        {sortBy === 'newest_added' ? (
                          <ArrowDown className="w-3 h-3 text-royal-gold" />
                        ) : sortBy === 'oldest_added' ? (
                          <ArrowUp className="w-3 h-3 text-royal-gold" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-500" />
                        )}
                      </div>
                    </th>
                    <th className="py-3 px-4 text-center">Total</th>
                    <th className="py-3 px-4 text-center">Available</th>
                    <th className="py-3 px-4 text-center">Issued</th>
                    <th className="py-3 px-4">Shelf / Row</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {paginatedBooks.map((book) => {
                    const isAvailable = book.available_quantity > 0;
                    const issued = book.total_quantity - book.available_quantity;
                    const isUrduBook = book.language === 'Urdu' || isArabicOrUrduScript(book.book_name);

                    return (
                      <tr key={book.id} style={{ contentVisibility: 'auto', containIntrinsicSize: '0 52px' }} className="hover:bg-slate-100/80 dark:hover:bg-slate-800/40 border-b border-slate-200/70 dark:border-white/5 transition-colors min-h-[48px] h-[52px]">
                        <td className="py-3 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedBookIds.has(book.id)}
                            onChange={() => toggleSelectBook(book.id)}
                            className="accent-[var(--gold)] cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-9 rounded bg-white/20 dark:bg-slate-800 border border-[var(--border-subtle)] shrink-0 overflow-hidden flex items-center justify-center font-serif text-[10px] text-royal-gold font-bold">
                              {isUrduBook ? <BookOpen className="w-3.5 h-3.5 text-royal-gold" /> : (book.book_name || 'ULM').slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p 
                                onClick={() => onSelectBook(book)}
                                dir="auto"
                                style={{ unicodeBidi: 'plaintext' }}
                                className={`font-semibold text-[var(--text-strong)] hover:text-royal-gold cursor-pointer truncate max-w-xs md:max-w-md ${
                                  isArabicOrUrduScript(book.book_name) ? 'font-urdu text-[15px] leading-[2.1]' : ''
                                }`}
                                title={book.book_name}
                              >
                                {book.book_name}
                                {book.title_roman && (
                                  <span className="text-[10px] text-amber-400/90 font-mono ml-2 font-normal">
                                    ({book.title_roman})
                                  </span>
                                )}
                              </p>
                              <p 
                                dir="auto"
                                style={{ unicodeBidi: 'plaintext' }}
                                className={`text-[11px] text-slate-400 mt-0.5 truncate ${
                                  isArabicOrUrduScript(book.author) ? 'font-urdu leading-[2]' : ''
                                }`}
                              >
                                {book.author}
                                {book.author_roman && (
                                  <span className="text-[10px] text-slate-500 font-mono ml-1.5">
                                    · {book.author_roman}
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                            {book.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {isUrduBook ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/70 text-emerald-300 border border-emerald-800">
                              اردو · Nastaliq
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                              {book.language || 'English'}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono-code">
                          <p className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100">{book.barcode}</p>
                          <p className="font-mono text-[11px] font-semibold text-amber-700 dark:text-amber-400 mt-0.5">{book.dewey_call_number}</p>
                        </td>
                        <td className="py-3 px-4 font-mono-code text-[11px] text-slate-300 whitespace-nowrap">
                          {formatDisplayDate(book.date_added || book.created_at)}
                        </td>
                        <td className="py-3 px-4 text-center font-mono-code tabular-nums font-semibold text-slate-700 dark:text-slate-300">
                          {book.total_quantity}
                        </td>
                        <td className="py-3 px-4 text-center font-mono-code tabular-nums font-bold">
                          <span className={isAvailable ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                            {book.available_quantity}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-mono-code tabular-nums text-slate-500 dark:text-slate-400">
                          {issued}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                          {book.shelf} · Row {book.row}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => onQuickLoan(book)}
                              disabled={!isAvailable}
                              className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                                isAvailable
                                  ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 hover:bg-amber-500/25 border border-amber-500/30'
                                  : 'bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-600 border border-slate-200 dark:border-slate-800 cursor-not-allowed'
                              }`}
                            >
                              <ArrowRightLeft className="w-3 h-3" />
                              <span>Loan</span>
                            </button>
                            <button
                              onClick={() => onEditBook(book)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-[#F1F5F9] border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                              title="Edit"
                              aria-label="Edit title record"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onPrintBarcode(book)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-300 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                              title="Print Barcode"
                              aria-label="Print Barcode"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onDeleteBook(book)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 hover:border-rose-300 dark:hover:border-rose-900 transition-colors cursor-pointer"
                              title="Delete Book"
                              aria-label="Delete Book"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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

          {/* List View on Narrow / Restored Screens (< 1024px): Responsive Compact Card View */}
          <div className="lg:hidden flex flex-col gap-3">
            {paginatedBooks.map((book) => {
              const isAvailable = book.available_quantity > 0;
              const issued = book.total_quantity - book.available_quantity;
              const isUrduBook = book.language === 'Urdu' || isArabicOrUrduScript(book.book_name);

              return (
                <div 
                  key={book.id} 
                  style={{ contentVisibility: 'auto', containIntrinsicSize: '0 100px' }}
                  className="rounded-[12px] ulm-liquid-glass p-3.5 flex flex-col gap-2.5 shadow-sm hover:border-[#BC881B] transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={selectedBookIds.has(book.id)}
                        onChange={() => toggleSelectBook(book.id)}
                        className="accent-[var(--gold)] cursor-pointer mt-1"
                        aria-label={`Select ${book.book_name}`}
                      />
                      <div className="min-w-0">
                        <h4 
                          onClick={() => onSelectBook(book)}
                          dir="auto"
                          style={{ unicodeBidi: 'plaintext' }}
                          className={`font-semibold text-[#F1F5F9] hover:text-[#E0B450] cursor-pointer truncate ${
                            isUrduBook ? 'font-urdu text-[15px] leading-relaxed' : 'text-[14px]'
                          }`}
                          title={book.book_name}
                        >
                          {book.book_name}
                          {book.title_roman && (
                            <span className="text-[11px] text-amber-400/90 font-mono ml-1.5 font-normal">
                              ({book.title_roman})
                            </span>
                          )}
                        </h4>
                        <p 
                          dir="auto"
                          style={{ unicodeBidi: 'plaintext' }}
                          className="text-[12px] text-slate-400 truncate mt-0.5"
                        >
                          {book.author}
                          {book.author_roman && (
                            <span className="text-[11px] text-slate-500 font-mono ml-1">· {book.author_roman}</span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        isAvailable ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60' : 'bg-rose-950/60 text-rose-300 border border-rose-800/60'
                      }`}>
                        {book.available_quantity}/{book.total_quantity} Avail
                      </span>
                    </div>
                  </div>

                  {/* Metadata Chips Row */}
                  <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-300">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">
                      {book.category}
                    </span>
                    <span className="font-mono text-[#E0B450] bg-[#BC881B]/15 px-2 py-0.5 rounded border border-[#BC881B]/30">
                      {book.barcode}
                    </span>
                    <span className="font-mono text-slate-400">
                      {book.dewey_call_number}
                    </span>
                    <span className="text-slate-400">
                      📍 {book.shelf} · Row {book.row}
                    </span>
                  </div>

                  {/* Actions Row */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/[0.06]">
                    <span className="text-[11px] font-mono text-slate-400">
                      Added {formatDisplayDate(book.date_added || book.created_at)}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onQuickLoan(book)}
                        disabled={!isAvailable}
                        className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                          isAvailable
                            ? 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 border border-amber-500/30'
                            : 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed'
                        }`}
                      >
                        <ArrowRightLeft className="w-3 h-3" />
                        <span>Loan</span>
                      </button>
                      <button
                        onClick={() => onEditBook(book)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                        title="Edit"
                        aria-label="Edit title record"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onPrintBarcode(book)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                        title="Print Barcode"
                        aria-label="Print Barcode"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteBook(book)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-700 transition-colors cursor-pointer"
                        title="Delete Book"
                        aria-label="Delete Book"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
        )}

        {/* Database-side / LRU-Cached Pagination Bar (50/100/200 selector, instant 0ms switching) */}
        {filteredBooks.length > 0 && viewMode !== 'almari' && viewMode !== 'chart' && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-[12px] bg-[#1A1A1A] border border-white/[0.08] text-xs text-[#B3AABD] mt-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span>
                Showing <strong className="text-white font-mono">{totalMatchingBooks === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1}</strong> to{' '}
                <strong className="text-white font-mono">{Math.min(safeCurrentPage * pageSize, totalMatchingBooks)}</strong> of{' '}
                <strong className="text-white font-mono">{totalMatchingBooks.toLocaleString()}</strong> books
              </span>
              <div className="flex items-center gap-1.5 ml-2">
                <span>Per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-[#221F26] border border-white/[0.12] rounded px-2 py-1 text-white font-mono focus:border-[#BC881B] focus:outline-none cursor-pointer"
                >
                  <option value={50}>50 per page</option>
                  <option value={100}>100 per page</option>
                  <option value={200}>200 per page</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={safeCurrentPage <= 1}
                className="px-2.5 py-1.5 rounded-lg bg-[#221F26] hover:bg-white/[0.08] text-white disabled:opacity-40 disabled:cursor-not-allowed border border-white/[0.08] font-mono cursor-pointer transition-colors"
                title="First Page"
              >
                « First
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={safeCurrentPage <= 1}
                className="px-3 py-1.5 rounded-lg bg-[#221F26] hover:bg-white/[0.08] text-white disabled:opacity-40 disabled:cursor-not-allowed border border-white/[0.08] font-medium cursor-pointer transition-colors"
              >
                ‹ Prev
              </button>
              <span className="px-3 py-1.5 rounded-lg bg-[#541A72]/40 border border-[#A66BC9]/30 text-[#E0B450] font-mono font-bold">
                Page {safeCurrentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={safeCurrentPage >= totalPages}
                className="px-3 py-1.5 rounded-lg bg-[#221F26] hover:bg-white/[0.08] text-white disabled:opacity-40 disabled:cursor-not-allowed border border-white/[0.08] font-medium cursor-pointer transition-colors"
              >
                Next ›
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={safeCurrentPage >= totalPages}
                className="px-2.5 py-1.5 rounded-lg bg-[#221F26] hover:bg-white/[0.08] text-white disabled:opacity-40 disabled:cursor-not-allowed border border-white/[0.08] font-mono cursor-pointer transition-colors"
                title="Last Page"
              >
                Last »
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
