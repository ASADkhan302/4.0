import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  BookOpen, 
  Save, 
  Sparkles, 
  AlertCircle, 
  Barcode as BarcodeIcon,
  MapPin,
  Layers,
  UploadCloud,
  Image as ImageIcon,
  Trash2,
  Link2,
  CheckCircle2,
  FileText,
  Palette,
  Loader2,
  Check,
  RotateCcw,
  Zap,
  Info,
  ShieldCheck,
  ChevronDown,
  Hash,
  DollarSign,
  Bookmark,
  Calendar,
  Copy,
  Search
} from 'lucide-react';
import { Book, BookGroup, Almari } from '../../types/library';
import { LibraryStorage, generateUniqueBarcodeCopies } from '../../services/storage';
import { AccessionSeriesEngine } from '../../services/accessionSeriesEngine';
import { BarcodeService } from '../../services/barcodeService';
import { BookSheetService } from '../../services/bookSheetService';
import { AlmariService } from '../../services/almariService';
import { computeNextSerial, parseSerialNumber, syncMasterExcelRegister, resolveBookAlmariAndShelf } from '../../services/libraryStorageAndMigration';
import CustomSelect from '../ui/CustomSelect';
import { getTodayIso, formatDisplayDate, normalizeDateAdded } from '../../utils/dateUtils';
import { isArabicOrUrduScript, sanitizeBidiOverrides } from '../../utils/urduUtils';
import { useInstitutionalIdentity } from '../../utils/themeTransition';

export { generateUniqueBarcodeCopies, AccessionSeriesEngine };

interface AddEditBookModalProps {
  isOpen: boolean;
  bookToEdit?: Book | null;
  initialBarcode?: string;
  onClose: () => void;
  onSave: (bookData: Omit<Book, 'id' | 'created_at' | 'updated_at' | 'is_active'>) => { success: boolean; message: string };
  onUpdate: (id: string, updates: Partial<Book>) => { success: boolean; message: string };
  onDelete?: (book: Book) => void;
}

// Curated academic presets for 1-click book covers
const PRESET_COVERS = [
  {
    name: 'CS / Cyber',
    url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=600&q=80',
    theme: 'Deep Navy & Cyber'
  },
  {
    name: 'Algorithms',
    url: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=600&q=80',
    theme: 'Amber & Charcoal'
  },
  {
    name: 'Mathematics',
    url: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=600&q=80',
    theme: 'Emerald & Sage'
  },
  {
    name: 'Physics & Law',
    url: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=600&q=80',
    theme: 'Crimson & Slate'
  }
];

const CATEGORY_OPTIONS = [
  'Computer Science',
  'Physics',
  'Mathematics',
  'Chemistry',
  'Law',
  'Islamic Studies',
  'English Literature',
  'Pakistan History',
  'Civil Engineering',
  'General Reference'
];

export const AddEditBookModal: React.FC<AddEditBookModalProps> = ({
  isOpen,
  bookToEdit,
  initialBarcode,
  onClose,
  onSave,
  onUpdate,
  onDelete,
}) => {
  const identity = useInstitutionalIdentity();
  // Official Accession Register Fields in Paper Sequence
  const [accessionNo, setAccessionNo] = useState<string>('1');
  const [accessionNotice, setAccessionNotice] = useState<string | null>(null);
  const [accessionError, setAccessionError] = useState<string | null>(null);
  const [barcode, setBarcode] = useState<string>('ULM-00001');
  const [author, setAuthor] = useState<string>('');
  const [bookName, setBookName] = useState<string>('');
  const [edition, setEdition] = useState<string>('1st Edition');
  const [place, setPlace] = useState<string>('Lakki Marwat');
  const [publisher, setPublisher] = useState<string>('ULM Press');
  const [publicationYear, setPublicationYear] = useState<number>(2024);
  const [pages, setPages] = useState<string>('480');
  const [priceRs, setPriceRs] = useState<string>('850');
  const [pricePs, setPricePs] = useState<string>('00');
  const [binding, setBinding] = useState<string>('HB'); // HB, SB, Other
  const [bindingCode, setBindingCode] = useState<string>('01');
  const [isbn, setIsbn] = useState<string>('');
  const [sourceRemarks, setSourceRemarks] = useState<string>('University Purchase');
  const [dateAdded, setDateAdded] = useState<string>(getTodayIso());
  const [dateAddedRaw, setDateAddedRaw] = useState<string>(formatDisplayDate(getTodayIso()));
  const [dateAddedError, setDateAddedError] = useState<string | null>(null);

  // Classification & Archival Coordinates
  const [category, setCategory] = useState<string>('Computer Science');
  const [deweyCallNumber, setDeweyCallNumber] = useState<string>('005.133 ULM');
  const [shelf, setShelf] = useState<string>('CS-Rack-01');
  const [row, setRow] = useState<string>('A-1');
  const [section, setSection] = useState<string>('Main Stacks');
  const [language, setLanguage] = useState<string>('English');
  const [titleRoman, setTitleRoman] = useState<string>('');
  const [authorRoman, setAuthorRoman] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  // Book Groups & Almaris (Phase 1)
  const [groupId, setGroupId] = useState<string>('');
  const [almariId, setAlmariId] = useState<string>('');
  const [shelfNo, setShelfNo] = useState<number>(1);

  // Media & Inventory
  const [totalQuantity, setTotalQuantity] = useState<number>(1);
  const [availableQuantity, setAvailableQuantity] = useState<number>(1);
  const [bookImagePath, setBookImagePath] = useState<string>('');

  // Form UI states
  const [saveAndNext, setSaveAndNext] = useState<boolean>(false);
  const [isCommitted, setIsCommitted] = useState<boolean>(false);
  const fastEntryMode = saveAndNext;
  const setFastEntryMode = setSaveAndNext;
  const [activeFormTab, setActiveFormTab] = useState<'all' | 'identity' | 'publication' | 'shelving' | 'inventory'>('all');
  const [showMediaStudio, setShowMediaStudio] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isbnWarning, setIsbnWarning] = useState<string | null>(null);
  const [isDuplicateIsbn, setIsDuplicateIsbn] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [showUrlInput, setShowUrlInput] = useState<boolean>(false);
  const [tempUrl, setTempUrl] = useState<string>('');
  const [isProcessingImage, setIsProcessingImage] = useState<boolean>(false);
  const [saveState, setSaveState] = useState<'idle' | 'loading' | 'success'>('idle');
  const [extendCopiesCount, setExtendCopiesCount] = useState<number>(1);
  const [extendSuccessBanner, setExtendSuccessBanner] = useState<string | null>(null);
  const [acquisitionMode, setAcquisitionMode] = useState<'new' | 'duplicate'>('new');
  const [duplicateSearchQuery, setDuplicateSearchQuery] = useState<string>('');
  const [isDuplicateDropdownOpen, setIsDuplicateDropdownOpen] = useState<boolean>(false);

  // Distinct existing books for 1-Click Duplicate Copy Lookup
  const distinctCatalogBooks = React.useMemo(() => {
    if (!isOpen) return [] as Array<{ representative: Book; count: number; avail: number }>;
    const allBooks = LibraryStorage.getBooks().filter(b => b && b.is_active !== false);
    const map = new Map<string, { representative: Book; count: number; avail: number }>();
    for (const b of allBooks) {
      const isbnClean = String(b.isbn || '').replace(/[^0-9Xx]/g, '');
      const key =
        isbnClean.length >= 6
          ? `isbn:${isbnClean}`
          : `title:${String(b.book_name || b.title || '').trim().toLowerCase()}|${String(b.author || '').trim().toLowerCase()}`;
      const existing = map.get(key);
      const isAvail = !b.is_checked_out && Number(b.available_copies ?? b.available_quantity ?? 1) > 0;
      if (existing) {
        existing.count += 1;
        if (isAvail) existing.avail += 1;
      } else {
        map.set(key, { representative: b, count: 1, avail: isAvail ? 1 : 0 });
      }
    }
    return Array.from(map.values());
  }, [isOpen, extendSuccessBanner, bookName]);

  const filteredDuplicateCatalogBooks = React.useMemo(() => {
    const q = duplicateSearchQuery.trim().toLowerCase();
    if (!q) return distinctCatalogBooks.slice(0, 8);
    return distinctCatalogBooks
      .filter(({ representative: b }) => {
        return (
          String(b.book_name || '').toLowerCase().includes(q) ||
          String(b.author || '').toLowerCase().includes(q) ||
          String(b.isbn || '').toLowerCase().includes(q) ||
          String(b.barcode || '').toLowerCase().includes(q) ||
          String(b.accession_no || '').toLowerCase().includes(q)
        );
      })
      .slice(0, 8);
  }, [distinctCatalogBooks, duplicateSearchQuery]);

  const handleSelectExistingBookForDuplicate = (match: Book) => {
    const allBooks = LibraryStorage.getBooks();
    const { nextAccession } = AccessionSeriesEngine.getSeriesState(allBooks);
    setAccessionNo(String(nextAccession));
    setBarcode(AccessionSeriesEngine.formatBarcode(nextAccession));
    setBookName(match.book_name || match.title || '');
    setAuthor(match.author || '');
    setCategory(match.category || match.discipline || 'Computer Science');
    setLanguage(match.language || 'English');
    setIsbn(match.isbn || '');
    setTitleRoman(match.title_roman || '');
    setAuthorRoman(match.author_roman || '');
    setEdition(match.edition || '1st Edition');
    setPlace(match.place || match.place_of_pub || 'Lakki Marwat');
    setPublisher(match.publisher || 'ULM Press');
    setPublicationYear(Number(match.publication_year) || new Date().getFullYear());
    setPages(String(match.pages || match.total_pages || '320'));
    setPriceRs(String(Math.floor(Number(match.price || match.price_pkr || 850))));
    setPricePs('00');
    setBinding(match.binding || '01 — Hardbound');
    setAlmariId(match.almari_id || '');
    setShelfNo(Number(match.shelf_no) || 1);
    setGroupId(match.group_id || '');
    setDeweyCallNumber(match.dewey_call_number || match.dewey_call_no || '005.133 ULM');
    setSection(match.section || 'Main Stacks');
    setSourceRemarks(match.source_remarks || 'University Purchase');
    setBookImagePath(match.book_image_path || '');
    setDescription(match.description || '');
    setDuplicateSearchQuery(match.book_name || '');
    setIsDuplicateDropdownOpen(false);
    setErrorMessage(null);
    setAccessionError(null);
  };

  // Live detection of existing sibling copies in the catalog for Pipeline B Series Extension
  const existingSiblingsInfo = React.useMemo(() => {
    if (!isOpen) {
      return { siblings: [] as Book[], count: 0, lastBarcode: '', nextAcc: 1 };
    }
    const allBooks = LibraryStorage.getBooks();
    const { nextAccession } = AccessionSeriesEngine.getSeriesState(allBooks);
    const matches = AccessionSeriesEngine.findExistingSiblings(allBooks, {
      book_name: bookName,
      author,
      isbn,
    });
    const sortedMatches = [...matches].sort((a, b) => {
      const accA = parseInt(String(a.accession_no || '').replace(/\D/g, ''), 10) || 0;
      const accB = parseInt(String(b.accession_no || '').replace(/\D/g, ''), 10) || 0;
      return accA - accB;
    });
    const lastSibling = sortedMatches[sortedMatches.length - 1];
    return {
      siblings: sortedMatches,
      count: sortedMatches.length,
      lastBarcode: lastSibling?.barcode || AccessionSeriesEngine.formatBarcode(1),
      nextAcc: nextAccession,
    };
  }, [isOpen, bookName, author, isbn, extendSuccessBanner]);

  // Autocomplete lists from library catalog
  const [authorSuggestions, setAuthorSuggestions] = useState<string[]>([]);
  const [publisherSuggestions, setPublisherSuggestions] = useState<string[]>([]);
  const [placeSuggestions, setPlaceSuggestions] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  // Always unlock the submit button when modal opens or user edits any field
  useEffect(() => {
    setIsCommitted(false);
    setSaveState('idle');
  }, [isOpen, bookName, author, isbn, totalQuantity, accessionNo, barcode, almariId, shelfNo]);

  // Initialize or reload data when modal opens
  useEffect(() => {
    if (!isOpen) return;

    setIsCommitted(false);
    setSaveState('idle');
    setAcquisitionMode('new');
    setDuplicateSearchQuery('');
    setIsDuplicateDropdownOpen(false);

    const allBooks = LibraryStorage.getBooks();

    // Extract distinct suggestions
    const authors = Array.from(new Set(allBooks.map(b => b.author).filter(Boolean))).slice(0, 8);
    const publishers = Array.from(new Set(allBooks.map(b => b.publisher).filter(Boolean))).slice(0, 8);
    const places = Array.from(new Set(['Lakki Marwat', 'Peshawar', 'Islamabad', 'Lahore', 'Karachi', 'Cambridge, MA', 'Oxford', 'New York']));

    setAuthorSuggestions(authors);
    setPublisherSuggestions(publishers);
    setPlaceSuggestions(places);

    if (bookToEdit) {
      // Editing existing book
      const numMatch = (bookToEdit.accession_no || bookToEdit.barcode || '').match(/\d+/);
      const acc = numMatch ? numMatch[0] : '1';
      const resolvedPlacement = resolveBookAlmariAndShelf(
        bookToEdit,
        AlmariService.getAlmaris(),
        AlmariService.getGroups()
      );
      setAccessionNo(acc);
      setBarcode(bookToEdit.barcode);
      setIsbn(bookToEdit.isbn || '');
      setBookName(bookToEdit.book_name || '');
      setAuthor(bookToEdit.author || '');
      setPublisher(bookToEdit.publisher || 'ULM Press');
      setCategory(bookToEdit.category || 'Computer Science');
      setEdition(bookToEdit.edition || '1st Edition');
      setPublicationYear(bookToEdit.publication_year || 2024);
      setLanguage(bookToEdit.language || (isArabicOrUrduScript(bookToEdit.book_name) ? 'Urdu' : 'English'));
      setTitleRoman(bookToEdit.title_roman || '');
      setAuthorRoman(bookToEdit.author_roman || '');
      setDescription(bookToEdit.description || '');
      setBookImagePath(bookToEdit.book_image_path || '');
      setTotalQuantity(bookToEdit.total_quantity || 1);
      setAvailableQuantity(bookToEdit.available_quantity || 1);
      setShelf(
        bookToEdit.shelf ||
          (resolvedPlacement.almariCode
            ? `${resolvedPlacement.almariCode} · Shelf ${resolvedPlacement.shelfNo}`
            : 'Unassigned (No Almari)')
      );
      setRow(bookToEdit.row || (resolvedPlacement.shelfNo ? String(resolvedPlacement.shelfNo) : ''));
      setSection(bookToEdit.section || 'Main Stacks');
      setDeweyCallNumber(bookToEdit.dewey_call_number || '005.133 ULM');
      setGroupId(bookToEdit.group_id || resolvedPlacement.groupId || '');
      setAlmariId(bookToEdit.almari_id || resolvedPlacement.almariId || '');
      setShelfNo(bookToEdit.shelf_no || resolvedPlacement.shelfNo || 1);
      const editDate = bookToEdit.date_added || (bookToEdit.created_at ? bookToEdit.created_at.split(' ')[0] : getTodayIso());
      setDateAdded(editDate);
      setDateAddedRaw(formatDisplayDate(editDate));
    } else {
      // New book (Rule 4): Pre-fill sequential accession number and barcode strictly from active catalog series
      const { nextAccession: nextAcc } = AccessionSeriesEngine.getSeriesState(allBooks);
      const formattedBarcode = initialBarcode || AccessionSeriesEngine.formatBarcode(nextAcc);

      // Check last entry memory from localStorage for rapid fast ledger entry
      const lastEntryStr = localStorage.getItem('ulm_lms_last_entry_cache');
      let cachedValues: Partial<{
        place: string;
        publisher: string;
        year: number;
        binding: string;
        bindingCode: string;
        source: string;
        category: string;
        dateAdded: string;
        groupId: string;
        almariId: string;
        shelfNo: number;
      }> = {};

      if (lastEntryStr) {
        try {
          cachedValues = JSON.parse(lastEntryStr);
        } catch {
          // Ignore parse errors
        }
      }

      setAccessionNo(String(nextAcc));
      setBarcode(formattedBarcode);
      setBookName('');
      setAuthor('');
      setEdition('1st Edition');
      setPlace(cachedValues.place || 'Lakki Marwat');
      setPublisher(cachedValues.publisher || 'ULM Press');
      setPublicationYear(cachedValues.year || 2024);
      setPages('350');
      setPriceRs('750');
      setPricePs('00');
      setBinding(cachedValues.binding || 'HB');
      setBindingCode(cachedValues.bindingCode || '01');
      setIsbn(`978-0-${String(nextAcc).slice(-4)}-101-2`);
      setSourceRemarks(cachedValues.source || 'University Purchase');
      const initialDate = cachedValues.dateAdded || getTodayIso();
      setDateAdded(initialDate);
      setDateAddedRaw(formatDisplayDate(initialDate));
      const initialCat = cachedValues.category || 'Computer Science';
      setCategory(initialCat);
      setDeweyCallNumber('005.133 ULM');
      setShelf('Unassigned (No Almari)');
      setRow('');
      setSection('Main Stacks');
      setLanguage('English');

      // Manual Group & Almari assignment (no auto-suggest)
      const activeManualAlmaris = AlmariService.getAlmaris().filter(a => a.is_active);
      const chosenGrpId = cachedValues.groupId || '';
      const chosenAlmId =
        cachedValues.almariId && activeManualAlmaris.some(a => a.id === cachedValues.almariId)
          ? cachedValues.almariId
          : '';
      const chosenShelf = cachedValues.shelfNo || 1;

      setGroupId(chosenGrpId);
      setAlmariId(chosenAlmId);
      setShelfNo(chosenShelf);
      setDescription('');
      setBookImagePath('');
      setTotalQuantity(1);
      setAvailableQuantity(1);
    }

    setErrorMessage(null);
    setIsbnWarning(null);
    setShowUrlInput(false);
    setTempUrl('');

    // Focus title field for instant keyboard entry
    setTimeout(() => {
      titleInputRef.current?.focus();
    }, 100);
  }, [bookToEdit, initialBarcode, isOpen]);

  // Helper: Detect Duplicate Title or ISBN and auto-fill metadata with unique accession & barcode
  const handleDetectDuplicateTitleOrIsbn = () => {
    const allBooks = LibraryStorage.getBooks();
    const cleanIsbn = isbn.replace(/[-\s]/g, '').trim().toLowerCase();
    const cleanTitle = bookName.trim().toLowerCase();

    if (!cleanIsbn && !cleanTitle) {
      setErrorMessage('Please enter an ISBN or Title first to detect an existing book in the library.');
      return;
    }

    const match = allBooks.find(b => {
      if (cleanIsbn && b.isbn && b.isbn.replace(/[-\s]/g, '').toLowerCase() === cleanIsbn) return true;
      if (cleanTitle && b.book_name && b.book_name.trim().toLowerCase() === cleanTitle) return true;
      return false;
    });

    if (!match) {
      setIsbnWarning('No existing copy found matching this Title or ISBN.');
      return;
    }

    // Pre-fill bibliographic details from existing book
    setBookName(match.book_name);
    setAuthor(match.author || '');
    setPublisher(match.publisher || 'ULM Press');
    setCategory(match.category || 'Computer Science');
    setEdition(match.edition || '1st Edition');
    setPublicationYear(match.publication_year || 2024);
    setLanguage(match.language || 'English');
    setDeweyCallNumber(match.dewey_call_number || '005.133 ULM');
    setShelf(match.shelf || 'ALM-01');
    setAlmariId(match.almari_id || '');
    setShelfNo(match.shelf_no || 1);
    setDescription(match.description || '');

    // Assign fresh next accession and unique barcode for this new copy
    const nextAccInfo = BookSheetService.getNextAccessionNumber();
    const nextAcc = nextAccInfo.accessionNo;
    setAccessionNo(nextAcc);
    setBarcode(BarcodeService.generateBarcode(nextAcc).barcode);
    setIsDuplicateIsbn(true);
    setIsbnWarning(`Copy detected of "${match.book_name}". Pre-filled metadata and assigned fresh Accession #${nextAcc}.`);
    setErrorMessage(null);
  };

  // ISBN checksum and duplicate checker
  useEffect(() => {
    if (!isbn.trim()) {
      setIsbnWarning(null);
      setIsDuplicateIsbn(false);
      return;
    }

    const clean = isbn.replace(/[-\s]/g, '');
    
    // Check duplicates in catalog
    const allBooks = LibraryStorage.getBooks();
    const isDup = allBooks.some(b => 
      b.isbn && b.isbn.replace(/[-\s]/g, '') === clean && (!bookToEdit || b.id !== bookToEdit.id)
    );
    setIsDuplicateIsbn(isDup);

    // Advisory checksum warning (never blocks)
    if (clean.length === 10) {
      let sum = 0;
      for (let i = 0; i < 9; i++) {
        sum += parseInt(clean[i], 10) * (10 - i);
      }
      const lastChar = clean[9].toUpperCase();
      const lastVal = lastChar === 'X' ? 10 : parseInt(lastChar, 10);
      sum += lastVal;
      if (sum % 11 !== 0) {
        setIsbnWarning('ISBN-10 checksum mismatch (advisory notice)');
      } else {
        setIsbnWarning(null);
      }
    } else if (clean.length === 13) {
      let sum = 0;
      for (let i = 0; i < 12; i++) {
        sum += parseInt(clean[i], 10) * (i % 2 === 0 ? 1 : 3);
      }
      const check = (10 - (sum % 10)) % 10;
      if (check !== parseInt(clean[12], 10)) {
        setIsbnWarning('ISBN-13 checksum mismatch (advisory notice)');
      } else {
        setIsbnWarning(null);
      }
    } else if (clean.length > 0 && clean.length !== 10 && clean.length !== 13) {
      setIsbnWarning('Non-standard ISBN character length (advisory)');
    } else {
      setIsbnWarning(null);
    }
  }, [isbn, bookToEdit]);

  // Sync accession number change with automatic barcode and validation (Section 2)
  const handleAccessionChange = (val: string) => {
    setAccessionNo(val);
    if (val.trim()) {
      const gen = BarcodeService.generateBarcode(val);
      setBarcode(gen.barcode);
      const validation = BookSheetService.validateAccessionNumber(val, bookToEdit?.id);
      if (!validation.valid) {
        setAccessionError(validation.message || 'Duplicate accession number blocked.');
        setAccessionNotice(null);
      } else {
        setAccessionError(null);
        if (validation.message) {
          setAccessionNotice(validation.message);
        } else {
          setAccessionNotice(null);
        }
      }
    } else {
      setAccessionError('Accession number is required.');
      setAccessionNotice(null);
    }
  };

  // Copy values from previous entry ("Copy Previous")
  const handleDittoField = (field: 'author' | 'publisher' | 'place' | 'edition' | 'category' | 'source' | 'date_added') => {
    let cached: any = null;
    try {
      const raw = localStorage.getItem('ulm_lms_last_entry_cache');
      if (raw) cached = JSON.parse(raw);
    } catch {
      // ignore
    }
    const allBooks = LibraryStorage.getBooks();
    const last = allBooks.length > 0 ? allBooks[0] : null;

    if (field === 'author') {
      const val = last?.author || cached?.author;
      if (val) setAuthor(val);
    }
    if (field === 'place') {
      const val = cached?.place || last?.place;
      if (val) setPlace(val);
    }
    if (field === 'publisher') {
      const val = cached?.publisher || last?.publisher;
      if (val) setPublisher(val);
    }
    if (field === 'category') {
      const val = cached?.category || last?.category;
      if (val) setCategory(val);
    }
    if (field === 'edition') {
      const val = cached?.edition || last?.edition;
      if (val) setEdition(val);
    }
    if (field === 'source') {
      const val = cached?.source || last?.source_remarks || 'University Purchase';
      setSourceRemarks(val);
    }
    if (field === 'date_added') {
      const lastDate = cached?.dateAdded || last?.date_added || (last?.created_at ? last.created_at.split(' ')[0] : getTodayIso());
      setDateAdded(lastDate);
      setDateAddedRaw(formatDisplayDate(lastDate));
      setDateAddedError(null);
    }
  };

  const handleDatePick = (isoVal: string) => {
    if (!isoVal) return;
    setDateAdded(isoVal);
    setDateAddedRaw(formatDisplayDate(isoVal));
    const valRes = normalizeDateAdded(isoVal);
    if (!valRes.valid) {
      setDateAddedError(valRes.error || 'Invalid date');
    } else {
      setDateAddedError(null);
    }
  };

  const handleDateTextChange = (text: string) => {
    setDateAddedRaw(text);
    const valRes = normalizeDateAdded(text);
    if (valRes.valid && valRes.date) {
      setDateAdded(valRes.date);
      setDateAddedError(null);
    } else {
      setDateAddedError(valRes.error || 'Invalid date');
    }
  };

  const handleDateBlur = () => {
    const valRes = normalizeDateAdded(dateAddedRaw);
    if (valRes.valid && valRes.date) {
      setDateAdded(valRes.date);
      setDateAddedRaw(formatDisplayDate(valRes.date));
      setDateAddedError(null);
    } else {
      setDateAddedError(valRes.error || 'Invalid date. Must be real date between 1900 and today.');
    }
  };

  // Process uploaded image file
  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file (PNG, JPG, WebP).');
      return;
    }
    
    setIsProcessingImage(true);
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const maxW = 500;
        const maxH = 700;
        let width = img.width;
        let height = img.height;

        if (width > maxW || height > maxH) {
          if (width / height > maxW / maxH) {
            height = Math.round((height * maxW) / width);
            width = maxW;
          } else {
            width = Math.round((width * maxH) / height);
            height = maxH;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.85);
          setBookImagePath(compressed);
        }
        setIsProcessingImage(false);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveBook = (keepOpenForNext: boolean) => {
    if (!bookName.trim()) {
      setErrorMessage('Book Title is mandatory.');
      titleInputRef.current?.focus();
      return;
    }
    if (!accessionNo.trim()) {
      setErrorMessage('Accession Number is mandatory.');
      return;
    }
    if (!category.trim()) {
      setErrorMessage('Category / Discipline is mandatory.');
      return;
    }
    if (accessionError) {
      setErrorMessage(accessionError);
      return;
    }

    const dateRes = normalizeDateAdded(dateAddedRaw || dateAdded);
    if (!dateRes.valid) {
      setDateAddedError(dateRes.error || 'Date Added must be a valid date between 1900 and today.');
      setErrorMessage(dateRes.error || 'Date Added must be a valid date between 1900 and today.');
      setIsCommitted(false);
      setSaveState('idle');
      return;
    }

    setSaveState('loading');

    const selectedAlmariObj = almariId
      ? AlmariService.getAlmaris().find(a => a.id === almariId && a.is_active)
      : undefined;
    const resolvedShelfLevel = selectedAlmariObj ? Number(shelfNo) || 1 : 0;
    const computedShelfStr = selectedAlmariObj
      ? `${selectedAlmariObj.code} · Shelf ${resolvedShelfLevel}`
      : 'Unassigned (No Almari)';

    const copyCount = Math.max(1, Math.min(500, Number(totalQuantity) || 1));
    const availCount = bookToEdit
      ? Math.max(0, Math.min(Number(availableQuantity) || copyCount, copyCount))
      : copyCount;
    const computedPrice = (Number(priceRs) || 0) + ((Number(pricePs) || 0) / 100);
    const effectiveBarcode =
      barcode.trim() || `0092${String(accessionNo).replace(/\D/g, '').padStart(9, '0')}`;

    // Build single Book record payload with copyCount (never flooding 15 separate cards)
    const payload = {
      barcode: effectiveBarcode,
      accession_no: String(accessionNo).trim(),
      isbn: isbn.trim(),
      book_name: bookName.trim(),
      title: bookName.trim(),
      author: author.trim() || 'ULM Library Collection',
      publisher: publisher.trim() || 'ULM Press',
      place: place.trim() || 'Lakki Marwat',
      place_of_pub: place.trim() || 'Lakki Marwat',
      binding: binding || 'HB',
      pages: Number(pages) || 0,
      total_pages: Number(pages) || 0,
      price: computedPrice,
      price_pkr: computedPrice,
      source_remarks: sourceRemarks.trim(),
      category: category || 'General',
      discipline: category || 'General',
      edition: edition.trim() || '1st Edition',
      publication_year: Number(publicationYear) || new Date().getFullYear(),
      language: language || (isArabicOrUrduScript(bookName) ? 'Urdu' : 'English'),
      title_roman: titleRoman.trim() || undefined,
      author_roman: authorRoman.trim() || undefined,
      description: description.trim(),
      book_image_path: bookImagePath.trim(),
      total_copies: copyCount,
      available_copies: availCount,
      total_quantity: copyCount,
      available_quantity: availCount,
      copies: copyCount,
      quantity: copyCount,
      status: availCount > 0 ? 'AVAILABLE' : 'ISSUED',
      shelf: computedShelfStr,
      row: selectedAlmariObj ? String(resolvedShelfLevel) : '',
      section: section.trim(),
      dewey_call_number: deweyCallNumber.trim() || '005.133 ULM',
      dewey_call_no: deweyCallNumber.trim() || '005.133 ULM',
      group_id: groupId || null,
      almari_id: selectedAlmariObj ? selectedAlmariObj.id : '',
      almari_code: selectedAlmariObj ? selectedAlmariObj.code : '',
      cupboard: selectedAlmariObj ? selectedAlmariObj.code : '',
      shelf_no: resolvedShelfLevel,
      date_added: dateRes.date!,
    };

    // Cache common fields for fast successive ledger entry
    try {
      localStorage.setItem('ulm_lms_last_entry_cache', JSON.stringify({
        place,
        publisher,
        year: publicationYear,
        binding,
        bindingCode,
        source: sourceRemarks,
        category,
        dateAdded: dateRes.date!,
        groupId,
        almariId,
        shelfNo: Number(shelfNo) || 1,
      }));
    } catch {
      // Ignore cache storage error
    }

    if (bookToEdit) {
      const singleCopyPayload = {
        ...payload,
        total_copies: 1,
        available_copies: availCount > 0 ? 1 : 0,
        total_quantity: 1,
        available_quantity: availCount > 0 ? 1 : 0,
        copies: 1,
        quantity: 1,
      };
      const res = onUpdate(bookToEdit.id, singleCopyPayload);
      if (!res.success) {
        setErrorMessage(res.message);
        setIsCommitted(false);
        setSaveState('idle');
        return;
      }

      // If the user increased Copies / Quantity > 1 while editing this single copy,
      // generate the additional (copyCount - 1) copies in strict series order starting at maxAccession + 1
      if (copyCount > 1) {
        const extRes = AccessionSeriesEngine.addOrExtendBookInSeries(LibraryStorage.getBooks(), {
          baseBook: {
            ...bookToEdit,
            ...singleCopyPayload,
            title_roman: titleRoman.trim() || undefined,
            author_roman: authorRoman.trim() || undefined,
          },
          copiesToAdd: copyCount - 1,
          almari: selectedAlmariObj || null,
          shelfNo: resolvedShelfLevel,
        });
        if (extRes.newCopies.length > 0) {
          onSave(extRes.newCopies[0]);
        }
      }

      void syncMasterExcelRegister();
      setIsCommitted(false);
      setSaveState('idle');
      onClose();
      return;
    }

    // PIPELINE A & B: Allocate 1..N sequential copies (or extend existing book in strict series order)
    const existingBooks = LibraryStorage.getBooks();
    const preferredAcc = parseInt(String(accessionNo).replace(/\D/g, ''), 10) || undefined;
    const seriesResult = AccessionSeriesEngine.addOrExtendBookInSeries(existingBooks, {
      baseBook: {
        ...payload,
        title_roman: titleRoman.trim() || undefined,
        author_roman: authorRoman.trim() || undefined,
      },
      copiesToAdd: copyCount,
      preferredStartAccession: preferredAcc,
      preferredStartBarcode: barcode.trim() || undefined,
      almari: selectedAlmariObj || null,
      shelfNo: resolvedShelfLevel,
    });

    // Notify parent App.tsx with the first newly allocated copy so toasts, sound, and state refresh fire
    if (seriesResult.newCopies.length > 0) {
      onSave(seriesResult.newCopies[0]);
    }
    void syncMasterExcelRegister();

    if (keepOpenForNext || saveAndNext) {
      // Flash "✓ Saved! Ready for Next" briefly (300ms), then immediately unlock for the next book
      setIsCommitted(true);
      setSaveState('success');
      setTimeout(() => {
        setIsCommitted(false);
        setSaveState('idle');
      }, 300);

      // Advance Accession & Barcode to nextAvailableAccession (e.g. #16 after adding 15 copies)
      const nextAcc = seriesResult.nextAvailableAccession;
      setAccessionNo(String(nextAcc));
      setBarcode(AccessionSeriesEngine.formatBarcode(nextAcc));
      setAccessionNotice(null);
      setAccessionError(null);
      setBookName('');
      setAuthor('');
      setIsbn('');
      setTitleRoman('');
      setAuthorRoman('');
      setTotalQuantity(1);
      setAvailableQuantity(1);
      setErrorMessage(null);
      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 50);
    } else {
      // Normal + Add Book & Close: Reset state and close modal immediately
      setIsCommitted(false);
      setSaveState('idle');
      onClose();
    }
  };

  // PIPELINE B (Trigger 2): Extend an existing book directly inside Edit Book Modal
  const handleExtendExistingBookInModal = () => {
    if (!bookToEdit) return;
    const countToAdd = Math.max(1, Math.min(50, Number(extendCopiesCount) || 1));
    const currentBooks = LibraryStorage.getBooks();
    const selectedAlmariObj = almariId
      ? AlmariService.getAlmaris().find((a) => a.id === almariId && a.is_active)
      : undefined;

    const res = AccessionSeriesEngine.addOrExtendBookInSeries(currentBooks, {
      baseBook: {
        ...bookToEdit,
        book_name: bookName.trim() || bookToEdit.book_name,
        title: bookName.trim() || bookToEdit.book_name,
        author: author.trim() || bookToEdit.author,
        isbn: isbn.trim() || bookToEdit.isbn,
        category: category || bookToEdit.category,
        discipline: category || bookToEdit.discipline || bookToEdit.category,
        language: language || bookToEdit.language,
        edition: edition.trim() || bookToEdit.edition,
        publisher: publisher.trim() || bookToEdit.publisher,
        publication_year: Number(publicationYear) || bookToEdit.publication_year,
        dewey_call_number: deweyCallNumber.trim() || bookToEdit.dewey_call_number,
        almari_id: selectedAlmariObj ? selectedAlmariObj.id : bookToEdit.almari_id,
        almari_code: selectedAlmariObj ? selectedAlmariObj.code : bookToEdit.almari_code,
        shelf_no: selectedAlmariObj ? Number(shelfNo) || 1 : (bookToEdit.shelf_no ?? undefined),
      },
      copiesToAdd: countToAdd,
      almari: selectedAlmariObj || null,
      shelfNo: selectedAlmariObj ? Number(shelfNo) || 1 : (bookToEdit.shelf_no ?? undefined),
    });

    if (res.newCopies.length > 0) {
      onSave(res.newCopies[0]);
    }
    void syncMasterExcelRegister();
    setExtendSuccessBanner(
      `Added +${countToAdd} new ${countToAdd === 1 ? 'copy' : 'copies'} in series (#${res.firstAccession} → #${res.lastAccession} • ${res.firstBarcode} → ${res.lastBarcode}). Total copies in catalog: ${res.totalCopiesAfterAdd}.`
    );
  };

  const executeSave = handleSaveBook;

  const handleFormKeyDown = (e: React.KeyboardEvent) => {
    // Enter key triggers Save & Next when saveAndNext is active
    if (e.key === 'Enter' && !e.shiftKey && e.target instanceof HTMLInputElement) {
      if (saveAndNext && !bookToEdit) {
        e.preventDefault();
        handleSaveBook(true);
      }
    }
  };

  if (!isOpen) return null;

  const inputBaseClass =
    'w-full h-10 bg-white dark:bg-[#121014] border border-slate-300 dark:border-[#2B2730] rounded-lg px-3 text-sm text-slate-900 dark:text-[#F1F5F9] placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-[#BC881B] focus:ring-1 focus:ring-[#BC881B] transition-colors';

  const startAcc = Math.max(1, parseInt(String(accessionNo || '1').replace(/\D/g, ''), 10) || 1);
  const startBarcode = barcode || AccessionSeriesEngine.formatBarcode(startAcc);
  const copies = Math.max(1, Number(totalQuantity) || 1);

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] w-screen h-screen flex items-center justify-center p-4 bg-slate-900/35 dark:bg-[#090514]/80 backdrop-blur-xl backdrop-saturate-[180%] transition-all overflow-y-auto animate-in fade-in duration-200"
      onClick={() => {
        setIsCommitted(false);
        setSaveState('idle');
        onClose();
      }}
    >
      {/* Modal Dialog Container */}
      <div
        className="w-full max-w-[960px] max-h-[90vh] flex flex-col rounded-[26px] overflow-hidden bg-gradient-to-br from-white/95 via-white/90 to-white/85 dark:from-[#1B1130]/95 dark:via-[#130B24]/95 dark:to-[#0D071A]/95 backdrop-blur-2xl backdrop-saturate-[190%] border border-slate-200/90 dark:border-white/[0.16] shadow-[0_24px_70px_rgba(15,23,42,0.22)] dark:shadow-[0_24px_70px_rgba(0,0,0,0.75)] text-slate-900 dark:text-white select-none my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Gold Accent Rim */}
        <div className="h-1 w-full bg-gradient-to-r from-[#541A72] via-[#FFD147] to-[#C8963E] shrink-0" />

        {/* 1. UNWRAPPED SINGLE-LINE MODAL HEADER */}
        <div className="px-6 py-4 border-b border-slate-200/80 dark:border-white/[0.10] flex flex-wrap items-center justify-between gap-4 shrink-0">
          {/* Left Identity Block */}
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-400/35 flex items-center justify-center text-amber-700 dark:text-amber-300 shrink-0">
              <BookOpen className="w-5 h-5 stroke-[2]" />
            </div>
            <div className="min-w-0">
              <h3 className="font-['Plus_Jakarta_Sans'] text-[17px] font-bold tracking-tight text-slate-900 dark:text-white truncate">
                {bookToEdit ? 'Accession Register · Edit Volume' : 'Accession Register · Book Acquisition'}
              </h3>
              <p className="text-[11.5px] font-medium text-slate-500 dark:text-slate-400 truncate">
                {identity.universityName} · {identity.libraryDepartmentName} Ledger
              </p>
            </div>
          </div>

          {/* Right Single-Line Telemetry & Controls */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Live Series Allocation Badge */}
            <div className="h-9 px-3.5 rounded-xl bg-amber-500/15 border border-amber-400/35 text-amber-700 dark:text-amber-300 font-['JetBrains_Mono'] text-[11.5px] font-semibold inline-flex items-center gap-2 whitespace-nowrap">
              <BarcodeIcon className="w-3.5 h-3.5 shrink-0" />
              <span>
                {copies === 1
                  ? `ACC #${startAcc} · ${startBarcode}`
                  : `ACC #${startAcc} → #${startAcc + copies - 1} (${copies} COPIES)`}
              </span>
            </div>

            {/* Single-Line Save & Next Toggle Pill */}
            {!bookToEdit && (
              <label
                title="When active, pressing Enter saves and prepares the next sequential accession number automatically"
                className="h-9 px-3 rounded-xl bg-slate-900/[0.04] dark:bg-white/[0.05] border border-slate-200/80 dark:border-white/[0.12] text-xs font-mono cursor-pointer hover:border-amber-400/50 transition-colors inline-flex items-center gap-2 whitespace-nowrap"
              >
                <Zap className={`w-3.5 h-3.5 shrink-0 ${fastEntryMode ? 'text-amber-600 dark:text-[#FFD147]' : 'text-slate-400'}`} />
                <span className="text-slate-700 dark:text-slate-200 font-semibold text-[11px] whitespace-nowrap">
                  Save &amp; Next (Enter ↵)
                </span>
                <input
                  type="checkbox"
                  checked={fastEntryMode}
                  onChange={(e) => setFastEntryMode(e.target.checked)}
                  className="rounded text-[#BC881B] focus:ring-[#BC881B] bg-white dark:bg-[#121014] border-slate-300 dark:border-white/20 cursor-pointer"
                />
              </label>
            )}

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-900/[0.04] dark:bg-white/[0.05] hover:bg-rose-500/15 hover:text-rose-500 border border-slate-200/80 dark:border-white/[0.12] flex items-center justify-center transition-all cursor-pointer shrink-0"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. TOP-LEVEL "QUICK ACQUISITION & DUPLICATE COPY BAR" */}
        {!bookToEdit && (
          <div className="px-6 py-3.5 bg-slate-900/[0.025] dark:bg-white/[0.03] border-b border-slate-200/80 dark:border-white/[0.09] space-y-3 shrink-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Mode Switcher */}
              <div className="p-1 rounded-xl bg-slate-900/[0.05] dark:bg-white/[0.05] border border-slate-200/80 dark:border-white/[0.08] inline-flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setAcquisitionMode('new')}
                  className={`h-8 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    acquisitionMode === 'new'
                      ? 'bg-gradient-to-r from-[#541A72] to-[#3B1054] text-white border border-[#FFD147]/50 shadow-xs'
                      : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>✨ New Book Title</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAcquisitionMode('duplicate');
                    setIsDuplicateDropdownOpen(true);
                  }}
                  className={`h-8 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    acquisitionMode === 'duplicate'
                      ? 'bg-gradient-to-r from-[#541A72] to-[#3B1054] text-white border border-[#FFD147]/50 shadow-xs'
                      : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>📚 Add Duplicate Copies to Existing Book</span>
                </button>
              </div>

              {/* Top-Level Copies to Add Stepper + Quick Preset Pills (1x, +2, +3, +5, +10) */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Copies to Add:
                </span>
                <div className="flex items-center h-8 border border-slate-300 dark:border-white/[0.15] rounded-xl overflow-hidden bg-white dark:bg-[#121014]">
                  <button
                    type="button"
                    onClick={() => {
                      const nextVal = Math.max(1, totalQuantity - 1);
                      setTotalQuantity(nextVal);
                      setAvailableQuantity(nextVal);
                    }}
                    className="w-7 h-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 font-bold cursor-pointer"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={totalQuantity}
                    onChange={(e) => {
                      const nextVal = Math.min(500, Math.max(1, parseInt(e.target.value, 10) || 1));
                      setTotalQuantity(nextVal);
                      setAvailableQuantity(nextVal);
                    }}
                    className="w-12 text-center font-['JetBrains_Mono'] font-bold text-xs bg-transparent text-slate-900 dark:text-white focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const nextVal = Math.min(500, totalQuantity + 1);
                      setTotalQuantity(nextVal);
                      setAvailableQuantity(nextVal);
                    }}
                    className="w-7 h-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 font-bold cursor-pointer"
                  >
                    +
                  </button>
                </div>

                {/* Quick Preset Pills */}
                <div className="inline-flex items-center gap-1">
                  {[
                    { label: '1x', val: 1 },
                    { label: '+2', val: 2 },
                    { label: '+3', val: 3 },
                    { label: '+5', val: 5 },
                    { label: '+10', val: 10 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setTotalQuantity(preset.val);
                        setAvailableQuantity(preset.val);
                      }}
                      className={`h-7 px-2.5 rounded-lg font-['JetBrains_Mono'] text-[11px] font-bold transition-all cursor-pointer ${
                        totalQuantity === preset.val
                          ? 'bg-amber-500 text-slate-950 shadow-2xs'
                          : 'bg-slate-900/[0.05] dark:bg-white/[0.06] text-slate-700 dark:text-slate-300 hover:bg-amber-500/20 border border-slate-200/80 dark:border-white/[0.10]'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 1-Click Existing Book Lookup & Auto-Fill Dropdown when in Duplicate Mode */}
            {acquisitionMode === 'duplicate' && (
              <div className="relative">
                <div className="relative flex items-center">
                  <Search className="w-4 h-4 text-amber-600 dark:text-[#FFD147] absolute left-3.5 pointer-events-none" />
                  <input
                    type="text"
                    value={duplicateSearchQuery}
                    onFocus={() => setIsDuplicateDropdownOpen(true)}
                    onChange={(e) => {
                      setDuplicateSearchQuery(e.target.value);
                      setIsDuplicateDropdownOpen(true);
                    }}
                    placeholder="Search existing book by Title, Author, ISBN, or Barcode 0092... to auto-fill & append copies"
                    className="w-full h-9 pl-9 pr-28 rounded-xl bg-white dark:bg-[#121014] border border-amber-400/50 dark:border-amber-400/40 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                  {duplicateSearchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setDuplicateSearchQuery('');
                        setIsDuplicateDropdownOpen(true);
                      }}
                      className="absolute right-3 text-[11px] font-semibold text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {isDuplicateDropdownOpen && filteredDuplicateCatalogBooks.length > 0 && (
                  <div className="mt-1.5 max-h-48 overflow-y-auto rounded-xl bg-white dark:bg-[#181028] border border-slate-200 dark:border-white/15 shadow-lg divide-y divide-slate-100 dark:divide-white/[0.06] z-30">
                    {filteredDuplicateCatalogBooks.map(({ representative: b, count, avail }) => (
                      <button
                        key={b.id || b.barcode}
                        type="button"
                        onClick={() => handleSelectExistingBookForDuplicate(b)}
                        className="w-full px-3.5 py-2 text-left hover:bg-amber-500/10 dark:hover:bg-white/[0.06] flex items-center justify-between gap-3 transition-colors cursor-pointer"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {b.book_name}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {b.author || 'Unknown Author'} · {b.category || 'General'} · ISBN: {b.isbn || 'N/A'}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-['JetBrains_Mono'] text-[10px] font-semibold">
                            {avail}/{count} in stack
                          </span>
                          <span className="px-2.5 py-1 rounded-lg bg-[#C8963E] text-slate-950 font-['JetBrains_Mono'] text-[10.5px] font-extrabold">
                            Auto-Fill →
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Section Filter Pills Bar */}
        <div className="px-6 py-2 bg-slate-900/[0.015] dark:bg-white/[0.015] border-b border-slate-200/70 dark:border-white/[0.08] flex items-center gap-2 overflow-x-auto shrink-0 select-none scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveFormTab('all')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeFormTab === 'all'
                ? 'bg-[#BC881B] text-[#0F0D11] shadow-xs font-bold'
                : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white/80 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.10]'
            }`}
          >
            All Sections (1–26)
          </button>
          <button
            type="button"
            onClick={() => setActiveFormTab('identity')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeFormTab === 'identity'
                ? 'bg-[#BC881B] text-[#0F0D11] shadow-xs font-bold'
                : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white/80 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.10]'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>1. Book Identity (1–8)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveFormTab('publication')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeFormTab === 'publication'
                ? 'bg-[#BC881B] text-[#0F0D11] shadow-xs font-bold'
                : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white/80 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.10]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>2. Publication &amp; Price (9–16)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveFormTab('shelving')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeFormTab === 'shelving'
                ? 'bg-[#BC881B] text-[#0F0D11] shadow-xs font-bold'
                : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white/80 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.10]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>3. Almari &amp; Stacks (17–22)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveFormTab('inventory')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeFormTab === 'inventory'
                ? 'bg-[#BC881B] text-[#0F0D11] shadow-xs font-bold'
                : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white/80 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.10]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>4. Inventory &amp; Media (23–26)</span>
          </button>
        </div>

        {/* 3. FORM BODY - 4 FROSTED CRYSTAL SECTION CARDS */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-4 space-y-4">
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-300 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs sm:text-sm flex items-center gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span className="font-semibold">{errorMessage}</span>
            </div>
          )}

          {/* Form Grid */}
          <form onKeyDown={handleFormKeyDown} onSubmit={(e) => { e.preventDefault(); executeSave(false); }} className="space-y-4">

            {/* SECTION 1: BOOK IDENTITY & PRIMARY DETAILS */}
            {(activeFormTab === 'all' || activeFormTab === 'identity') && (
              <div className="rounded-[20px] p-4 bg-white/70 dark:bg-white/[0.03] border border-slate-200/85 dark:border-white/[0.10] shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-white/[0.08] pb-2.5">
                  <div className="flex items-center gap-2">
                    <Bookmark className="w-4 h-4 text-amber-700 dark:text-[#E0B450]" />
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
                      1. Book Identity &amp; Accession Code
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500 dark:text-[#B3AABD]">
                    Fields 1 to 8
                  </span>
                </div>

                {/* Symmetrical 4-Column Aligned Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
                  {/* Field 1: Accession Number */}
                  <div className="space-y-1.5">
                    <label className="h-5 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="w-4 h-4 rounded-full bg-amber-500/15 dark:bg-[#BC881B]/20 text-amber-800 dark:text-[#E0B450] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">1</span>
                        <span className="text-slate-800 dark:text-slate-200 truncate">Accession No</span>
                        <span className="text-rose-500 font-bold">*</span>
                      </span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        tabIndex={1}
                        value={accessionNo}
                        onChange={(e) => handleAccessionChange(e.target.value)}
                        placeholder="e.g. 1"
                        className={`w-full h-10 bg-white dark:bg-[#121014] border rounded-lg px-3 text-sm font-mono font-bold focus:outline-none transition-colors ${
                          accessionError
                            ? 'border-rose-500 text-rose-600 dark:text-rose-300 focus:border-rose-500'
                            : 'border-slate-300 dark:border-[#2B2730] text-amber-800 dark:text-[#E0B450] focus:border-[#BC881B] focus:ring-1 focus:ring-[#BC881B]'
                        }`}
                      />
                      <Hash className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute right-3 top-3.5 pointer-events-none" />
                    </div>
                    {accessionError && (
                      <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1 mt-1 truncate">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span className="truncate">{accessionError}</span>
                      </p>
                    )}
                  </div>

                  {/* Field 2: Barcode */}
                  <div className="space-y-1.5">
                    <label className="h-5 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="w-4 h-4 rounded-full bg-amber-500/15 dark:bg-[#BC881B]/20 text-amber-800 dark:text-[#E0B450] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">2</span>
                        <span className="text-slate-800 dark:text-slate-200 truncate">Barcode No</span>
                      </span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        readOnly
                        tabIndex={-1}
                        value={barcode}
                        placeholder="ULM-00000"
                        className="w-full h-10 bg-slate-100 dark:bg-[#121014] border border-slate-300 dark:border-[#2B2730] rounded-lg px-3 text-sm font-mono font-bold text-amber-800 dark:text-[#E0B450] cursor-not-allowed select-all"
                      />
                      <BarcodeIcon className="w-3.5 h-3.5 text-slate-400 dark:text-[#B3AABD] absolute right-3 top-3.5 pointer-events-none" />
                    </div>
                    {Number(totalQuantity) > 1 && (
                      <div className="mt-1.5 text-[11px] font-mono text-amber-600 dark:text-[#FFD147] bg-amber-500/10 border border-amber-500/30 rounded-lg px-2.5 py-1">
                        Generates <strong>{totalQuantity} unique barcodes</strong>: {' '}
                        <code>0092{String(Number(accessionNo) || 1).padStart(9, '0')}</code> → {' '}
                        <code>0092{String((Number(accessionNo) || 1) + Number(totalQuantity) - 1).padStart(9, '0')}</code>
                      </div>
                    )}
                  </div>

                  {/* Field 3: Title of the Book (Spans 2 columns) */}
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="h-5 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-200">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="w-4 h-4 rounded-full bg-amber-500/15 dark:bg-[#BC881B]/20 text-amber-800 dark:text-[#E0B450] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">3</span>
                        <span className="text-slate-800 dark:text-slate-200 font-semibold truncate">Title of the Book</span>
                        <span className="text-rose-500 font-bold">*</span>
                      </span>
                    </label>
                    <input
                      ref={titleInputRef}
                      type="text"
                      tabIndex={4}
                      dir="auto"
                      style={{ unicodeBidi: 'plaintext' }}
                      value={bookName}
                      onChange={(e) => {
                        const v = e.target.value;
                        setBookName(v);
                        if (isArabicOrUrduScript(v) && language === 'English') {
                          setLanguage('Urdu');
                        }
                      }}
                      placeholder="e.g. Introduction to Algorithms or بانگِ درا"
                      className={`${inputBaseClass} font-semibold ${
                        isArabicOrUrduScript(bookName) ? 'font-urdu text-base leading-tight' : ''
                      }`}
                    />
                    {!bookToEdit && existingSiblingsInfo.count > 0 && (
                      <div className="mt-2 p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-900 dark:text-[#FFD147] text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="leading-snug">
                          <strong>Matching book found in catalog ({existingSiblingsInfo.count} {existingSiblingsInfo.count === 1 ? 'copy' : 'copies'} in stack).</strong>{' '}
                          Next sequential barcode:{' '}
                          <code className="font-mono font-bold">
                            {AccessionSeriesEngine.formatBarcode(existingSiblingsInfo.nextAcc)}
                          </code>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const match = existingSiblingsInfo.siblings[0];
                            if (match) {
                              handleSelectExistingBookForDuplicate(match);
                              setAcquisitionMode('duplicate');
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg bg-[#C8963E] hover:brightness-110 text-slate-950 font-extrabold text-[11px] font-mono shrink-0 cursor-pointer shadow-xs whitespace-nowrap"
                        >
                          Pre-Fill &amp; Add Duplicate Copies →
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Field 4: Author / Editor / Org (Spans 2 columns) */}
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="h-5 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-200">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="w-4 h-4 rounded-full bg-amber-500/15 dark:bg-[#BC881B]/20 text-amber-800 dark:text-[#E0B450] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">4</span>
                        <span className="text-slate-800 dark:text-slate-200 font-semibold truncate">Author / Editor / Org</span>
                      </span>
                    </label>
                    <input
                      type="text"
                      tabIndex={3}
                      dir="auto"
                      style={{ unicodeBidi: 'plaintext' }}
                      value={author}
                      onChange={(e) => setAuthor(e.target.value)}
                      placeholder="e.g. Thomas H. Cormen or علامہ محمد اقبال"
                      list="authors-list"
                      className={`${inputBaseClass} ${
                        isArabicOrUrduScript(author) ? 'font-urdu text-base leading-tight' : ''
                      }`}
                    />
                    <datalist id="authors-list">
                      {authorSuggestions.map((a, i) => (
                        <option key={i} value={a} />
                      ))}
                    </datalist>
                  </div>

                  {/* Field 5: Category */}
                  <div className="space-y-1.5">
                    <label className="h-5 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="w-4 h-4 rounded-full bg-amber-500/15 dark:bg-[#BC881B]/20 text-amber-800 dark:text-[#E0B450] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">5</span>
                        <span className="text-slate-800 dark:text-slate-200 truncate">Discipline / Category</span>
                      </span>
                    </label>
                    <CustomSelect
                      value={category}
                      onChange={(val) => setCategory(val)}
                      options={CATEGORY_OPTIONS.map((c) => ({ value: c, label: c }))}
                      searchable
                      className="h-10 w-full"
                    />
                  </div>

                  {/* Field 6: Language */}
                  <div className="space-y-1.5">
                    <label className="h-5 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="w-4 h-4 rounded-full bg-amber-500/15 dark:bg-[#BC881B]/20 text-amber-800 dark:text-[#E0B450] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">6</span>
                        <span className="text-slate-800 dark:text-slate-200 truncate">Language / زبان</span>
                      </span>
                    </label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className={inputBaseClass}
                    >
                      <option value="English">English</option>
                      <option value="Urdu">Urdu (اردو)</option>
                      <option value="Arabic">Arabic (العربية)</option>
                      <option value="Pashto">Pashto (پښتو)</option>
                      <option value="Persian">Persian (فارسی)</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  {/* Field 7: ISBN */}
                  <div className="space-y-1.5">
                    <label className="h-5 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="w-4 h-4 rounded-full bg-amber-500/15 dark:bg-[#BC881B]/20 text-amber-800 dark:text-[#E0B450] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">7</span>
                        <span className="text-slate-800 dark:text-slate-200 truncate">ISBN (10 or 13)</span>
                      </span>
                    </label>
                    <input
                      type="text"
                      tabIndex={14}
                      value={isbn}
                      onChange={(e) => setIsbn(e.target.value)}
                      placeholder="978-0-262-03384-8"
                      className={`w-full h-10 bg-white dark:bg-[#121014] border rounded-lg px-3 text-sm font-mono text-slate-900 dark:text-[#F1F5F9] focus:outline-none transition-colors ${
                        isDuplicateIsbn 
                          ? 'border-amber-500/80 focus:border-amber-400' 
                          : 'border-slate-300 dark:border-[#2B2730] focus:border-[#BC881B] focus:ring-1 focus:ring-[#BC881B]'
                      }`}
                    />
                    {isbnWarning && (
                      <p className="text-[11px] font-mono text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-1 truncate">
                        <span className="truncate">{isbnWarning}</span>
                      </p>
                    )}
                  </div>

                  {/* Field 8: Phonetic Search / Romanized Title */}
                  <div className="space-y-1.5">
                    <label className="h-5 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="w-4 h-4 rounded-full bg-amber-500/15 dark:bg-[#BC881B]/20 text-amber-800 dark:text-[#E0B450] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">8</span>
                        <span className="text-slate-800 dark:text-slate-200 truncate">Romanized Title</span>
                      </span>
                    </label>
                    <input
                      type="text"
                      value={titleRoman}
                      onChange={(e) => setTitleRoman(e.target.value)}
                      placeholder="e.g. Bang-e-Dra or Algorithms"
                      className={inputBaseClass}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 2: PUBLICATION & PRICING SPECIFICS */}
            {(activeFormTab === 'all' || activeFormTab === 'publication') && (
              <div className="rounded-[20px] p-4 bg-white/70 dark:bg-white/[0.03] border border-slate-200/85 dark:border-white/[0.10] shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-white/[0.08] pb-2.5">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-sky-600 dark:text-[#6FA8D2]" />
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
                      2. Publication &amp; Pricing Specifics
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500 dark:text-[#B3AABD]">
                    Fields 9 to 16
                  </span>
                </div>

                {/* Symmetrical 4-Column Aligned Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
                  {/* Field 9: Edition */}
                  <div className="space-y-1.5">
                    <label className="h-5 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="w-4 h-4 rounded-full bg-amber-500/15 dark:bg-[#BC881B]/20 text-amber-800 dark:text-[#E0B450] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">9</span>
                        <span className="text-slate-800 dark:text-slate-200 truncate">Edition</span>
                      </span>
                    </label>
                    <input
                      type="text"
                      tabIndex={5}
                      value={edition}
                      onChange={(e) => setEdition(e.target.value)}
                      placeholder="e.g. 1st Edition"
                      className={inputBaseClass}
                    />
                  </div>

                  {/* Field 10: Place of Publication */}
                  <div className="space-y-1.5">
                    <label className="h-5 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="w-4 h-4 rounded-full bg-amber-500/15 dark:bg-[#BC881B]/20 text-amber-800 dark:text-[#E0B450] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">10</span>
                        <span className="text-slate-800 dark:text-slate-200 truncate">Place of Pub.</span>
                      </span>
                    </label>
                    <input
                      type="text"
                      tabIndex={6}
                      dir="auto"
                      style={{ unicodeBidi: 'plaintext' }}
                      value={place}
                      onChange={(e) => setPlace(e.target.value)}
                      placeholder="e.g. Lakki Marwat or Lahore"
                      list="places-list"
                      className={`${inputBaseClass} ${
                        isArabicOrUrduScript(place) ? 'font-urdu' : ''
                      }`}
                    />
                    <datalist id="places-list">
                      {placeSuggestions.map((p, i) => (
                        <option key={i} value={p} />
                      ))}
                    </datalist>
                  </div>

                  {/* Field 11: Publisher */}
                  <div className="space-y-1.5">
                    <label className="h-5 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="w-4 h-4 rounded-full bg-amber-500/15 dark:bg-[#BC881B]/20 text-amber-800 dark:text-[#E0B450] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">11</span>
                        <span className="text-slate-800 dark:text-slate-200 truncate">Publisher</span>
                      </span>
                    </label>
                    <input
                      type="text"
                      tabIndex={7}
                      dir="auto"
                      style={{ unicodeBidi: 'plaintext' }}
                      value={publisher}
                      onChange={(e) => setPublisher(e.target.value)}
                      placeholder="e.g. ULM Press or Oxford"
                      list="publishers-list"
                      className={`${inputBaseClass} ${
                        isArabicOrUrduScript(publisher) ? 'font-urdu' : ''
                      }`}
                    />
                    <datalist id="publishers-list">
                      {publisherSuggestions.map((p, i) => (
                        <option key={i} value={p} />
                      ))}
                    </datalist>
                  </div>

                  {/* Field 12: Publication Year */}
                  <div className="space-y-1.5">
                    <label className="h-5 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="w-4 h-4 rounded-full bg-amber-500/15 dark:bg-[#BC881B]/20 text-amber-800 dark:text-[#E0B450] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">12</span>
                        <span className="text-slate-800 dark:text-slate-200 truncate">Year (4 Digits)</span>
                      </span>
                    </label>
                    <input
                      type="number"
                      tabIndex={8}
                      min={1800}
                      max={2030}
                      value={publicationYear}
                      onChange={(e) => setPublicationYear(Number(e.target.value))}
                      className={`${inputBaseClass} font-mono`}
                    />
                  </div>

                  {/* Field 13: Pages */}
                  <div className="space-y-1.5">
                    <label className="h-5 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="w-4 h-4 rounded-full bg-amber-500/15 dark:bg-[#BC881B]/20 text-amber-800 dark:text-[#E0B450] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">13</span>
                        <span className="text-slate-800 dark:text-slate-200 truncate">Total Pages</span>
                      </span>
                    </label>
                    <input
                      type="text"
                      tabIndex={9}
                      value={pages}
                      onChange={(e) => setPages(e.target.value)}
                      placeholder="e.g. 480"
                      className={`${inputBaseClass} font-mono`}
                    />
                  </div>

                  {/* Field 14: Price (Pakistani Rupees & Paisa) */}
                  <div className="space-y-1.5">
                    <label className="h-5 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="w-4 h-4 rounded-full bg-amber-500/15 dark:bg-[#BC881B]/20 text-amber-800 dark:text-[#E0B450] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">14</span>
                        <span className="text-slate-800 dark:text-slate-200 truncate">Price (PKR)</span>
                      </span>
                    </label>
                    <div className="h-10 grid grid-cols-[1fr_72px] bg-white dark:bg-[#121014] border border-slate-300 dark:border-[#2B2730] rounded-lg overflow-hidden focus-within:border-[#BC881B] focus-within:ring-1 focus-within:ring-[#BC881B] transition-colors">
                      <div className="flex items-center min-w-0 px-2.5 border-r border-slate-200 dark:border-[#2E2A33]">
                        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 font-bold shrink-0 mr-1.5">
                          Rs.
                        </span>
                        <input
                          type="text"
                          tabIndex={10}
                          value={priceRs}
                          onChange={(e) => setPriceRs(e.target.value)}
                          placeholder="850"
                          className="w-full h-full bg-transparent text-sm font-mono text-slate-900 dark:text-[#F1F5F9] focus:outline-none min-w-0"
                        />
                      </div>
                      <div className="flex items-center min-w-0 px-2">
                        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 font-bold shrink-0 mr-1">
                          Ps.
                        </span>
                        <input
                          type="text"
                          tabIndex={11}
                          maxLength={2}
                          value={pricePs}
                          onChange={(e) => setPricePs(e.target.value)}
                          placeholder="00"
                          className="w-full h-full bg-transparent text-sm font-mono text-slate-900 dark:text-[#F1F5F9] focus:outline-none min-w-0"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Field 15: Binding & Code */}
                  <div className="space-y-1.5">
                    <label className="h-5 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="w-4 h-4 rounded-full bg-amber-500/15 dark:bg-[#BC881B]/20 text-amber-800 dark:text-[#E0B450] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">15</span>
                        <span className="text-slate-800 dark:text-slate-200 truncate">Binding &amp; Code</span>
                      </span>
                    </label>
                    <select
                      value={binding || '01 — Hardbound'}
                      onChange={(e) => {
                        const val = e.target.value;
                        setBinding(val);
                        if (val.startsWith('01')) setBindingCode('01');
                        else if (val.startsWith('02')) setBindingCode('02');
                        else if (val.startsWith('03')) setBindingCode('03');
                        else if (val.startsWith('04')) setBindingCode('04');
                      }}
                      className={inputBaseClass}
                    >
                      <option value="01 — Hardbound">01 — Hardbound</option>
                      <option value="02 — Paperback">02 — Paperback</option>
                      <option value="03 — Spiral / Report">03 — Spiral / Report</option>
                      <option value="04 — Leather Archival">04 — Leather Archival</option>
                    </select>
                  </div>

                  {/* Field 16: Date Added */}
                  <div className="space-y-1.5">
                    <label className="h-5 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="w-4 h-4 rounded-full bg-amber-500/15 dark:bg-[#BC881B]/20 text-amber-800 dark:text-[#E0B450] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">16</span>
                        <span className="text-slate-800 dark:text-slate-200 truncate">Date Added</span>
                      </span>
                    </label>
                    <div className="h-10 flex items-center bg-white dark:bg-[#121014] border border-slate-300 dark:border-[#2B2730] rounded-lg overflow-hidden focus-within:border-[#BC881B] focus-within:ring-1 focus-within:ring-[#BC881B] transition-colors">
                      <input
                        type="text"
                        tabIndex={16}
                        value={dateAddedRaw}
                        onChange={(e) => handleDateTextChange(e.target.value)}
                        onBlur={handleDateBlur}
                        placeholder="02-Oct-2026"
                        className={`flex-1 h-full bg-transparent px-3 text-sm font-mono text-slate-900 dark:text-[#F1F5F9] focus:outline-none ${
                          dateAddedError ? 'text-rose-500 dark:text-rose-400' : ''
                        }`}
                      />
                      <div className="relative shrink-0 pr-1">
                        <input
                          type="date"
                          max={getTodayIso()}
                          min="1900-01-01"
                          value={dateAdded}
                          onChange={(e) => handleDatePick(e.target.value)}
                          className="w-8 h-8 opacity-0 absolute inset-0 cursor-pointer z-10"
                          title="Pick date"
                        />
                        <div className="w-8 h-8 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-[#221F26] dark:hover:bg-[#2B2730] border border-slate-200 dark:border-[#2E2A33] flex items-center justify-center text-amber-700 dark:text-[#E0B450] pointer-events-none transition-colors">
                          <Calendar className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 3: ARCHIVAL SHELVING & ALMARI LOCATION */}
            {(activeFormTab === 'all' || activeFormTab === 'shelving') && (
              <div className="rounded-[20px] p-4 bg-white/70 dark:bg-white/[0.03] border border-slate-200/85 dark:border-white/[0.10] shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-white/[0.08] pb-2.5">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-purple-700 dark:text-[#A66BC9]" />
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
                      3. Archival Shelving &amp; Almari Location
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500 dark:text-[#B3AABD]">
                    Fields 17 to 22
                  </span>
                </div>

                {/* Symmetrical 4-Column Aligned Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
                  {/* Field 17: Almari (الماری) */}
                  <div className="space-y-1.5">
                    <label className="h-5 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="w-4 h-4 rounded-full bg-amber-500/15 dark:bg-[#BC881B]/20 text-amber-800 dark:text-[#E0B450] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">17</span>
                        <span className="text-slate-800 dark:text-slate-200 truncate">Almari (الماری)</span>
                      </span>
                    </label>
                    <select
                      value={almariId}
                      onChange={(e) => setAlmariId(e.target.value)}
                      className={inputBaseClass}
                    >
                      <option value="">(Unassigned — No Almari)</option>
                      {AlmariService.getAlmaris().filter(a => a.is_active).map(a => (
                        <option key={a.id} value={a.id}>
                          {a.code} - {a.name_en}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Field 18: Shelf Number */}
                  <div className="space-y-1.5">
                    <label className="h-5 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="w-4 h-4 rounded-full bg-amber-500/15 dark:bg-[#BC881B]/20 text-amber-800 dark:text-[#E0B450] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">18</span>
                        <span className="text-slate-800 dark:text-slate-200 truncate">Shelf Level (1-12)</span>
                      </span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="12"
                      value={shelfNo}
                      onChange={(e) => setShelfNo(parseInt(e.target.value, 10) || 1)}
                      className={`${inputBaseClass} font-mono`}
                    />
                  </div>

                  {/* Field 19: Book Group (گروپ) */}
                  <div className="space-y-1.5">
                    <label className="h-5 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="w-4 h-4 rounded-full bg-amber-500/15 dark:bg-[#BC881B]/20 text-amber-800 dark:text-[#E0B450] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">19</span>
                        <span className="text-slate-800 dark:text-slate-200 truncate">Classification Group</span>
                      </span>
                    </label>
                    <select
                      value={groupId}
                      onChange={(e) => setGroupId(e.target.value)}
                      className={inputBaseClass}
                    >
                      <option value="">(Auto-resolved from Category)</option>
                      {AlmariService.getGroups().filter(g => g.is_active).map(g => (
                        <option key={g.id} value={g.id}>
                          {g.name_en} ({g.name_ur})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Field 20: Dewey Call Number */}
                  <div className="space-y-1.5">
                    <label className="h-5 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="w-4 h-4 rounded-full bg-amber-500/15 dark:bg-[#BC881B]/20 text-amber-800 dark:text-[#E0B450] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">20</span>
                        <span className="text-slate-800 dark:text-slate-200 truncate">Dewey Call No</span>
                      </span>
                    </label>
                    <input
                      type="text"
                      tabIndex={17}
                      value={deweyCallNumber}
                      onChange={(e) => setDeweyCallNumber(e.target.value)}
                      placeholder="005.133 ULM"
                      className={`${inputBaseClass} font-mono`}
                    />
                  </div>

                  {/* Field 21: Archival Section (2 columns) */}
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="h-5 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="w-4 h-4 rounded-full bg-amber-500/15 dark:bg-[#BC881B]/20 text-amber-800 dark:text-[#E0B450] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">21</span>
                        <span className="text-slate-800 dark:text-slate-200 truncate">Archival Stacks Section</span>
                      </span>
                    </label>
                    <input
                      type="text"
                      tabIndex={19}
                      value={section}
                      onChange={(e) => setSection(e.target.value)}
                      placeholder="e.g. Main Stacks or Reference Wing"
                      className={inputBaseClass}
                    />
                  </div>

                  {/* Field 22: Source / Acquisition Remarks (2 columns) */}
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="h-5 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="w-4 h-4 rounded-full bg-amber-500/15 dark:bg-[#BC881B]/20 text-amber-800 dark:text-[#E0B450] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">22</span>
                        <span className="text-slate-800 dark:text-slate-200 truncate">Source / Acquisition Remarks</span>
                      </span>
                    </label>
                    <input
                      type="text"
                      tabIndex={15}
                      dir="auto"
                      style={{ unicodeBidi: 'plaintext' }}
                      value={sourceRemarks}
                      onChange={(e) => setSourceRemarks(e.target.value)}
                      placeholder="e.g. University Purchase or HEC Grant"
                      className={inputBaseClass}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 4: INVENTORY, COVER ART & DESCRIPTION */}
            {(activeFormTab === 'all' || activeFormTab === 'inventory') && (
              <div className="rounded-[20px] p-4 bg-white/70 dark:bg-white/[0.03] border border-slate-200/85 dark:border-white/[0.10] shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-white/[0.08] pb-2.5">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-emerald-600 dark:text-[#34D399]" />
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
                      4. Inventory Quantity, Cover &amp; Notes
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowMediaStudio(!showMediaStudio)}
                    className="text-xs font-mono font-bold text-amber-700 dark:text-[#E0B450] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>{showMediaStudio ? 'Hide Cover Studio' : 'Edit Cover Image'}</span>
                  </button>
                </div>

                {/* Symmetrical 4-Column Aligned Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
                  {/* Field 23: Total Copies */}
                  <div className="space-y-1.5">
                    <label className="h-5 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="w-4 h-4 rounded-full bg-amber-500/15 dark:bg-[#BC881B]/20 text-amber-800 dark:text-[#E0B450] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">23</span>
                        <span className="text-slate-800 dark:text-slate-200 truncate">Copies / Quantity (1–500)</span>
                      </span>
                    </label>
                    <div className="flex items-center h-10 border border-slate-300 dark:border-[#2B2730] rounded-lg overflow-hidden bg-white dark:bg-[#121014]">
                      <button
                        type="button"
                        onClick={() => {
                          const nextVal = Math.max(1, totalQuantity - 1);
                          setTotalQuantity(nextVal);
                          if (!bookToEdit) setAvailableQuantity(nextVal);
                        }}
                        className="w-10 h-full text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#221F26] flex items-center justify-center font-bold text-base cursor-pointer transition-colors"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={500}
                        value={totalQuantity}
                        onChange={(e) => {
                          const nextVal = Math.min(500, Math.max(1, parseInt(e.target.value, 10) || 1));
                          setTotalQuantity(nextVal);
                          if (!bookToEdit) setAvailableQuantity(nextVal);
                        }}
                        className="flex-1 w-16 bg-transparent text-center font-mono font-bold text-sm text-slate-900 dark:text-[#F1F5F9] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const nextVal = Math.min(500, totalQuantity + 1);
                          setTotalQuantity(nextVal);
                          if (!bookToEdit) setAvailableQuantity(nextVal);
                        }}
                        className="w-10 h-full text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#221F26] flex items-center justify-center font-bold text-base cursor-pointer transition-colors"
                      >
                        +
                      </button>
                    </div>
                    {Number(totalQuantity) > 1 && (
                      <div className="mt-1.5 text-[11px] font-mono text-amber-600 dark:text-[#FFD147] bg-amber-500/10 border border-amber-500/30 rounded-lg px-2.5 py-1">
                        Generates <strong>{totalQuantity} unique barcodes</strong>: {' '}
                        <code>0092{String(Number(accessionNo) || 1).padStart(9, '0')}</code> → {' '}
                        <code>0092{String((Number(accessionNo) || 1) + Number(totalQuantity) - 1).padStart(9, '0')}</code>
                      </div>
                    )}
                  </div>

                  {/* Field 24: Available in Circulation */}
                  <div className="space-y-1.5">
                    <label className="h-5 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="w-4 h-4 rounded-full bg-amber-500/15 dark:bg-[#BC881B]/20 text-amber-800 dark:text-[#E0B450] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">24</span>
                        <span className="text-slate-800 dark:text-slate-200 truncate">Loan Availability</span>
                      </span>
                    </label>
                    <div className="h-10 px-3 rounded-lg bg-emerald-50/70 dark:bg-[#121014] border border-emerald-300 dark:border-[#2B2730] flex items-center justify-between text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400">
                      <span>In Stacks:</span>
                      <span>{bookToEdit ? Math.min(availableQuantity, totalQuantity) : totalQuantity} of {totalQuantity} Copies</span>
                    </div>
                  </div>

                  {/* PIPELINE B (Trigger 2): Extend Stock (+ Add New Copies in Series) inside Edit Book Modal */}
                  {bookToEdit && (
                    <div className="md:col-span-4 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/35 space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="text-xs font-extrabold text-amber-900 dark:text-[#FFD147] flex items-center gap-1.5">
                            <Copy className="w-3.5 h-3.5" />
                            <span>Extend Stock (+ Add New Copies in Series)</span>
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 font-mono mt-0.5">
                            Currently {existingSiblingsInfo.count || 1} sibling{' '}
                            {(existingSiblingsInfo.count || 1) === 1 ? 'copy' : 'copies'} in catalog. Next series
                            allocation: <strong>#{existingSiblingsInfo.nextAcc}</strong> (
                            <code>{AccessionSeriesEngine.formatBarcode(existingSiblingsInfo.nextAcc)}</code>) →{' '}
                            <strong>#{existingSiblingsInfo.nextAcc + extendCopiesCount - 1}</strong> (
                            <code>
                              {AccessionSeriesEngine.formatBarcode(
                                existingSiblingsInfo.nextAcc + extendCopiesCount - 1
                              )}
                            </code>
                            )
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center h-9 border border-amber-500/40 rounded-lg overflow-hidden bg-white dark:bg-[#121014]">
                            <button
                              type="button"
                              onClick={() => setExtendCopiesCount(Math.max(1, extendCopiesCount - 1))}
                              className="w-8 h-full text-slate-700 dark:text-slate-300 hover:bg-amber-500/15 font-bold cursor-pointer"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min={1}
                              max={50}
                              value={extendCopiesCount}
                              onChange={(e) =>
                                setExtendCopiesCount(
                                  Math.min(50, Math.max(1, parseInt(e.target.value, 10) || 1))
                                )
                              }
                              className="w-12 text-center font-mono font-bold text-xs bg-transparent text-slate-900 dark:text-white focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => setExtendCopiesCount(Math.min(50, extendCopiesCount + 1))}
                              className="w-8 h-full text-slate-700 dark:text-slate-300 hover:bg-amber-500/15 font-bold cursor-pointer"
                            >
                              +
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={handleExtendExistingBookInModal}
                            className="h-9 px-3.5 rounded-lg bg-[#C8963E] hover:brightness-110 text-slate-950 font-extrabold text-xs font-mono cursor-pointer shadow-xs"
                          >
                            + Append {extendCopiesCount} {extendCopiesCount === 1 ? 'Copy' : 'Copies'} in Series
                          </button>
                        </div>
                      </div>

                      {extendSuccessBanner && (
                        <div className="p-2 rounded-lg bg-emerald-500/15 border border-emerald-500/35 text-emerald-800 dark:text-emerald-300 text-xs font-mono font-bold flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>{extendSuccessBanner}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Field 25: Cover Preview / Toggle (2 columns) */}
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="h-5 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="w-4 h-4 rounded-full bg-amber-500/15 dark:bg-[#BC881B]/20 text-amber-800 dark:text-[#E0B450] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">25</span>
                        <span className="text-slate-800 dark:text-slate-200 truncate">Book Cover Image</span>
                      </span>
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={bookImagePath}
                        onChange={(e) => setBookImagePath(e.target.value)}
                        placeholder="Image URL or upload below..."
                        className={`${inputBaseClass} flex-1 font-mono`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowMediaStudio(!showMediaStudio)}
                        className="h-10 px-3.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#221F26] dark:hover:bg-[#2B2730] text-xs font-bold text-slate-800 dark:text-white border border-slate-300 dark:border-[#2E2A33] shrink-0 cursor-pointer transition-colors"
                      >
                        {showMediaStudio ? 'Close' : 'Presets / Upload'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Collapsible Cover Studio */}
                {showMediaStudio && (
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#141214] border border-slate-200 dark:border-[#2E2A33] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-amber-700 dark:text-[#E0B450]" />
                        Choose Cover Image or Upload
                      </span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => e.target.files?.[0] && processImageFile(e.target.files[0])}
                        className="hidden"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 dark:bg-[#221F26] dark:hover:bg-[#2B2730] border border-slate-300 dark:border-[#2E2A33] text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer transition-colors"
                        >
                          {isProcessingImage ? 'Processing...' : 'Upload Image'}
                        </button>
                        {bookImagePath && (
                          <button
                            type="button"
                            onClick={() => setBookImagePath('')}
                            className="px-2 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-500 cursor-pointer"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Presets Row */}
                    <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-200 dark:border-[#2E2A33]">
                      <span className="text-[11px] text-slate-500 dark:text-[#B3AABD] font-mono">Academic Presets:</span>
                      {PRESET_COVERS.map((preset) => (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => setBookImagePath(preset.url)}
                          className="px-2.5 py-1 rounded-md bg-white hover:bg-slate-100 dark:bg-[#121014] dark:hover:bg-[#25202B] border border-slate-300 dark:border-[#2B2730] text-[11px] text-slate-700 dark:text-slate-300 font-semibold cursor-pointer transition-colors"
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Field 26: Description / Syllabus Notes */}
                <div className="space-y-1.5 pt-3 border-t border-slate-200 dark:border-[#2E2A33]">
                  <label className="h-5 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1.5 truncate">
                      <span className="w-4 h-4 rounded-full bg-amber-500/15 dark:bg-[#BC881B]/20 text-amber-800 dark:text-[#E0B450] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">26</span>
                      <span className="text-slate-800 dark:text-slate-200 truncate">Catalog Description, Syllabus Reference &amp; Course Notes</span>
                    </span>
                  </label>
                  <textarea
                    rows={2}
                    tabIndex={20}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Course codes, syllabus overview, prerequisites, or condition notes..."
                    className="w-full bg-white dark:bg-[#121014] border border-slate-300 dark:border-[#2B2730] rounded-lg p-3 text-xs sm:text-sm text-slate-900 dark:text-[#F1F5F9] placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-[#BC881B] focus:ring-1 focus:ring-[#BC881B] leading-relaxed resize-y transition-colors"
                  />
                </div>
              </div>
            )}
          </form>
        </div>

        {/* 3. MODAL FOOTER BAR */}
        <div className="px-6 py-3.5 bg-white/45 dark:bg-white/[0.03] backdrop-blur-md border-t border-white/75 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {bookToEdit && onDelete && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onDelete(bookToEdit);
                }}
                className="px-3.5 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                <span>Withdraw Title</span>
              </button>
            )}
            <div className="text-[11px] text-slate-500 dark:text-[#B3AABD] flex items-center gap-1.5 font-mono">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>SQLite WAL Atomic Record</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                setIsCommitted(false);
                setSaveState('idle');
                onClose();
              }}
              className="h-9 px-4 rounded-xl text-xs font-semibold bg-slate-200/80 hover:bg-slate-300/80 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-white/15 cursor-pointer transition-all"
            >
              Cancel (Esc)
            </button>

            {/* Button 1: Save & Next (Saves current book, increments Accession #, keeps modal open & unlocked) */}
            {!bookToEdit && (
              <button
                type="button"
                onClick={() => handleSaveBook(true)}
                className="h-9 px-4 rounded-xl text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-900 dark:text-[#FFD147] border border-amber-500/40 dark:border-[#FFD147]/40 flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <span>⚡ Save &amp; Next (Enter ↵)</span>
              </button>
            )}

            {/* Button 2: Primary Add Book & Close (Dynamically labeled by mode & copy count) */}
            <button
              type="button"
              onClick={() => handleSaveBook(false)}
              className="h-9 px-5 rounded-xl text-xs font-extrabold bg-gradient-to-r from-[#6D28D9] to-[#C8963E] hover:brightness-110 !text-white border border-[#FFD147]/60 shadow-md flex items-center gap-1.5 cursor-pointer transition-all whitespace-nowrap"
            >
              <span>
                {bookToEdit
                  ? 'Save Changes'
                  : isCommitted
                  ? '✓ Saved! Ready for Next'
                  : existingSiblingsInfo.count > 0 || acquisitionMode === 'duplicate'
                  ? `+ Add ${copies} Duplicate Cop${copies > 1 ? 'ies' : 'y'} (Total: ${existingSiblingsInfo.count + copies})`
                  : copies > 1
                  ? `+ Add ${copies} Copies in Series & Close`
                  : '+ Add Book & Close'}
              </span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};

