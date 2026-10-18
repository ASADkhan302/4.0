import React, { useState, useEffect, useRef } from 'react';
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
  Copy
} from 'lucide-react';
import { Book, BookGroup, Almari } from '../../types/library';
import { LibraryStorage } from '../../services/storage';
import { BarcodeService } from '../../services/barcodeService';
import { BookSheetService } from '../../services/bookSheetService';
import { AlmariService } from '../../services/almariService';
import CustomSelect from '../ui/CustomSelect';
import { getTodayIso, formatDisplayDate, normalizeDateAdded } from '../../utils/dateUtils';
import { isArabicOrUrduScript, sanitizeBidiOverrides } from '../../utils/urduUtils';

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
  const [totalQuantity, setTotalQuantity] = useState<number>(3);
  const [availableQuantity, setAvailableQuantity] = useState<number>(3);
  const [bookImagePath, setBookImagePath] = useState<string>('');

  // Form UI states
  const [fastEntryMode, setFastEntryMode] = useState<boolean>(true);
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

  // Autocomplete lists from library catalog
  const [authorSuggestions, setAuthorSuggestions] = useState<string[]>([]);
  const [publisherSuggestions, setPublisherSuggestions] = useState<string[]>([]);
  const [placeSuggestions, setPlaceSuggestions] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  // Initialize or reload data when modal opens
  useEffect(() => {
    if (!isOpen) return;

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
      const numMatch = bookToEdit.barcode.match(/\d+/);
      const acc = numMatch ? numMatch[0] : '10001';
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
      setShelf(bookToEdit.shelf || 'CS-Rack-01');
      setRow(bookToEdit.row || 'A-1');
      setSection(bookToEdit.section || 'Main Stacks');
      setDeweyCallNumber(bookToEdit.dewey_call_number || '005.133 ULM');
      setGroupId(bookToEdit.group_id || '');
      setAlmariId(bookToEdit.almari_id || '');
      setShelfNo(bookToEdit.shelf_no || 1);
      const editDate = bookToEdit.date_added || (bookToEdit.created_at ? bookToEdit.created_at.split(' ')[0] : getTodayIso());
      setDateAdded(editDate);
      setDateAddedRaw(formatDisplayDate(editDate));
    } else {
      // New book: Pre-fill automatic accession number per specification
      const nextAccInfo = BookSheetService.getNextAccessionNumber();
      const nextAcc = nextAccInfo.accessionNo;
      const formattedBarcode = initialBarcode || BarcodeService.generateBarcode(nextAcc).barcode;

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
      setShelf('CS-Rack-01');
      setRow('A-1');
      setSection('Main Stacks');
      setLanguage('English');

      // Manual Group & Almari assignment (no auto-suggest)
      const chosenGrpId = cachedValues.groupId || '';
      const chosenAlmId = cachedValues.almariId || '';
      const chosenShelf = cachedValues.shelfNo || 1;

      setGroupId(chosenGrpId);
      setAlmariId(chosenAlmId);
      setShelfNo(chosenShelf);
      setDescription('');
      setBookImagePath('');
      setTotalQuantity(3);
      setAvailableQuantity(3);
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

  const executeSave = (isNext: boolean) => {
    if (!bookName.trim()) {
      setErrorMessage('Book Title is mandatory.');
      titleInputRef.current?.focus();
      return;
    }
    if (!barcode.trim()) {
      setErrorMessage('Barcode / Accession is mandatory.');
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
      setSaveState('idle');
      return;
    }

    setSaveState('loading');

    // Build payload conforming exactly to Book schema
    const payload = {
      barcode: barcode.trim(),
      accession_no: accessionNo.trim(),
      isbn: isbn.trim(),
      book_name: bookName.trim(),
      author: author.trim() || 'Anonymous / Organization',
      publisher: publisher.trim(),
      place: place.trim(),
      binding: binding,
      pages: Number(pages) || 0,
      price: (Number(priceRs) || 0) + ((Number(pricePs) || 0) / 100),
      source_remarks: sourceRemarks.trim(),
      category: category,
      edition: edition.trim(),
      publication_year: Number(publicationYear) || 2024,
      language: language || (isArabicOrUrduScript(bookName) ? 'Urdu' : 'English'),
      title_roman: titleRoman.trim() || undefined,
      author_roman: authorRoman.trim() || undefined,
      description: description.trim(),
      book_image_path: bookImagePath.trim(),
      total_quantity: Number(totalQuantity) || 1,
      available_quantity: Math.min(Number(availableQuantity), Number(totalQuantity)),
      shelf: shelf.trim(),
      row: row.trim(),
      section: section.trim(),
      dewey_call_number: deweyCallNumber.trim(),
      group_id: groupId || null,
      almari_id: almariId || null,
      shelf_no: shelfNo ? Number(shelfNo) : null,
      date_added: dateRes.date!,
    };

    // Cache common fields for fast successive ledger entry (Save & Next keeps the last group and almari)
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
      const res = onUpdate(bookToEdit.id, payload);
      if (!res.success) {
        setErrorMessage(res.message);
        setSaveState('idle');
        return;
      }
    } else {
      const res = onSave(payload);
      if (!res.success) {
        setErrorMessage(res.message);
        setSaveState('idle');
        return;
      }
    }

    setSaveState('success');

    if (isNext && !bookToEdit) {
      // Fast entry next: increment accession, clear title & author, focus title
      setTimeout(() => {
        const nextAccInfo = BookSheetService.getNextAccessionNumber();
        const nextAcc = nextAccInfo.accessionNo;
        setAccessionNo(nextAcc);
        setBarcode(BarcodeService.generateBarcode(nextAcc).barcode);
        setAccessionNotice(null);
        setAccessionError(null);
        setBookName('');
        setAuthor('');
        setIsbn(`978-0-${String(nextAcc).slice(-4)}-101-2`);
        setSaveState('idle');
        setErrorMessage(null);
        titleInputRef.current?.focus();
      }, 500);
    } else {
      setTimeout(() => {
        setSaveState('idle');
        onClose();
      }, 700);
    }
  };

  const handleFormKeyDown = (e: React.KeyboardEvent) => {
    // Enter key triggers Save & Next when fastEntryMode is active
    if (e.key === 'Enter' && !e.shiftKey && e.target instanceof HTMLInputElement) {
      if (fastEntryMode && !bookToEdit) {
        e.preventDefault();
        executeSave(true);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Modal Dialog Window */}
      <div 
        className="w-full max-w-5xl bg-[#17141A] border border-[#2E2A33] rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col max-h-[92vh] select-none text-[#F1F5F9]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle Gold / Amber Accent Hairline on Top */}
        <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[#BC881B] to-transparent shrink-0" />

        {/* 1. INSTITUTIONAL ACCREDITED MODAL HEADER */}
        <div className="px-6 py-4 bg-[#141214] border-b border-[#2E2A33] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#BC881B]/15 border border-[#BC881B]/35 flex items-center justify-center text-[#E0B450] shrink-0 shadow-inner">
              <BookOpen className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="font-cinzel text-base sm:text-lg font-bold tracking-wider text-white">
                  {bookToEdit ? 'EDIT ACCESSION RECORD' : 'ACCESSION REGISTER · NEW VOLUME'}
                </h3>
                <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-[#BC881B]/20 text-[#E0B450] border border-[#BC881B]/40">
                  {bookToEdit ? `RECORD #${accessionNo}` : `ACCESSION #${accessionNo}`}
                </span>
              </div>
              <p className="text-[11px] text-[#B3AABD] font-sans mt-0.5 flex items-center gap-2">
                <span>University of Lakki Marwat</span>
                <span className="text-[#4E4758]">·</span>
                <span>Central Campus Library Accession Ledger</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Fast Entry Switch for Rapid Paper Ledger Transcription */}
            {!bookToEdit && (
              <label 
                title="When active, pressing Enter saves and prepares the next sequential accession number automatically"
                className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1F1B24] border border-[#2E2A33] text-xs font-mono cursor-pointer hover:border-[#BC881B]/60 transition-colors"
              >
                <Zap className={`w-3.5 h-3.5 ${fastEntryMode ? 'text-[#E0B450]' : 'text-slate-500'}`} />
                <span className="text-slate-300 font-medium text-[11px]">Save &amp; Next (Enter ↵)</span>
                <input 
                  type="checkbox"
                  checked={fastEntryMode}
                  onChange={(e) => setFastEntryMode(e.target.checked)}
                  className="rounded text-[#BC881B] focus:ring-[#BC881B] bg-[#121014] border-[#2E2A33] cursor-pointer"
                />
              </label>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-[#221F26] hover:bg-[#2B2730] text-slate-300 hover:text-white transition-colors border border-[#2E2A33] cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs Bar for Instant Section Filtering & Clean Order */}
        <div className="px-6 py-2.5 bg-[#121013] border-b border-[#2E2A33] flex items-center gap-2 overflow-x-auto shrink-0 select-none scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveFormTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeFormTab === 'all'
                ? 'bg-[#BC881B] text-[#0F0D11] shadow-xs font-bold'
                : 'text-slate-300 hover:text-white bg-[#1B171F] hover:bg-[#25202B] border border-[#2B2730]'
            }`}
          >
            All Sections (1–26)
          </button>
          <button
            type="button"
            onClick={() => setActiveFormTab('identity')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeFormTab === 'identity'
                ? 'bg-[#BC881B] text-[#0F0D11] shadow-xs font-bold'
                : 'text-slate-300 hover:text-white bg-[#1B171F] hover:bg-[#25202B] border border-[#2B2730]'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>1. Book Identity (1–8)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveFormTab('publication')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeFormTab === 'publication'
                ? 'bg-[#BC881B] text-[#0F0D11] shadow-xs font-bold'
                : 'text-slate-300 hover:text-white bg-[#1B171F] hover:bg-[#25202B] border border-[#2B2730]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>2. Publication &amp; Price (9–16)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveFormTab('shelving')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeFormTab === 'shelving'
                ? 'bg-[#BC881B] text-[#0F0D11] shadow-xs font-bold'
                : 'text-slate-300 hover:text-white bg-[#1B171F] hover:bg-[#25202B] border border-[#2B2730]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>3. Almari &amp; Stacks (17–22)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveFormTab('inventory')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeFormTab === 'inventory'
                ? 'bg-[#BC881B] text-[#0F0D11] shadow-xs font-bold'
                : 'text-slate-300 hover:text-white bg-[#1B171F] hover:bg-[#25202B] border border-[#2B2730]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>4. Inventory &amp; Media (23–26)</span>
          </button>
        </div>

        {/* 2. FORM BODY - ORDERLY, SYMMETRICAL 4-COLUMN ALIGNED GRID */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 bg-[#0E0C10] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-[#2B2730] [&::-webkit-scrollbar-thumb]:rounded-full">
          
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs sm:text-sm flex items-center gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="font-medium">{errorMessage}</span>
            </div>
          )}

          {/* Form Grid */}
          <form onKeyDown={handleFormKeyDown} onSubmit={(e) => { e.preventDefault(); executeSave(false); }} className="space-y-6">

            {/* SECTION 1: BOOK IDENTITY & PRIMARY DETAILS */}
            {(activeFormTab === 'all' || activeFormTab === 'identity') && (
              <div className="p-5 sm:p-6 rounded-xl bg-[#17141A] border border-[#2E2A33] shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-[#2E2A33] pb-3">
                  <div className="flex items-center gap-2">
                    <Bookmark className="w-4 h-4 text-[#E0B450]" />
                    <span className="text-xs font-bold uppercase tracking-wider text-white">
                      1. Book Identity &amp; Accession Code
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-[#B3AABD]">
                    Fields 1 to 8
                  </span>
                </div>

                {/* Symmetrical 4-Column Aligned Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
                  {/* Field 1: Accession Number */}
                  <div className="space-y-1.5">
                    <label className="h-5 flex items-center justify-between text-xs font-semibold text-slate-300">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="w-4 h-4 rounded-full bg-[#BC881B]/20 text-[#E0B450] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">1</span>
                        <span className="text-slate-200 truncate">Accession No</span>
                        <span className="text-rose-400 font-bold">*</span>
                      </span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        tabIndex={1}
                        value={accessionNo}
                        onChange={(e) => handleAccessionChange(e.target.value)}
                        placeholder="e.g. 1"
                        className={`w-full h-10 bg-[#121014] border rounded-lg px-3 text-sm font-mono font-bold focus:outline-none transition-colors ${
                          accessionError
                            ? 'border-rose-500 text-rose-300 focus:border-rose-500'
                            : 'border-[#2B2730] text-[#E0B450] focus:border-[#BC881B] focus:ring-1 focus:ring-[#BC881B]'
                        }`}
                      />
                      <Hash className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-3.5 pointer-events-none" />
                    </div>
                    {accessionError && (
                      <p className="text-[11px] text-rose-400 font-medium flex items-center gap-1 mt-1 truncate">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span className="truncate">{accessionError}</span>
                      </p>
                    )}
                  </div>

                  {/* Field 2: Barcode */}
                  <div className="space-y-1.5">
                    <label className="h-5 flex items-center justify-between text-xs font-semibold text-slate-300">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="w-4 h-4 rounded-full bg-[#BC881B]/20 text-[#E0B450] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">2</span>
                        <span className="text-slate-200 truncate">Barcode No</span>
                      </span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        readOnly
                        tabIndex={-1}
                        value={barcode}
                        placeholder="ULM-00000"
                        className="w-full h-10 bg-[#121014] border border-[#2B2730] rounded-lg px-3 text-sm font-mono font-bold text-[#E0B450] cursor-not-allowed select-all"
                      />
                      <BarcodeIcon className="w-3.5 h-3.5 text-[#B3AABD] absolute right-3 top-3.5 pointer-events-none" />
                    </div>
                  </div>

                  {/* Field 3: Title of the Book (Spans 2 columns) */}
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="h-5 flex items-center justify-between text-xs font-semibold text-slate-200">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="w-4 h-4 rounded-full bg-[#BC881B]/20 text-[#E0B450] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">3</span>
                        <span className="text-slate-200 font-semibold truncate">Title of the Book</span>
                        <span className="text-rose-400 font-bold">*</span>
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
                      className={`w-full h-10 bg-[#121014] border border-[#2B2730] rounded-lg px-3 text-sm font-semibold text-[#F1F5F9] placeholder:text-slate-600 focus:outline-none focus:border-[#BC881B] focus:ring-1 focus:ring-[#BC881B] transition-colors ${
                        isArabicOrUrduScript(bookName) ? 'font-urdu text-base leading-tight' : ''
                      }`}
                    />
                  </div>

                  {/* Field 4: Author / Editor / Org (Spans 2 columns) */}
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="h-5 flex items-center justify-between text-xs font-semibold text-slate-200">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="w-4 h-4 rounded-full bg-[#BC881B]/20 text-[#E0B450] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">4</span>
                        <span className="text-slate-200 font-semibold truncate">Author / Editor / Org</span>
                      </span>
                      <div className="relative group inline-flex items-center">
                        <button
                          type="button"
                          onClick={() => handleDittoField('author')}
                          className="w-5 h-5 rounded flex items-center justify-center text-[#E0B450] hover:text-amber-200 bg-[#221F26] hover:bg-[#2B2730] border border-[#2E2A33] hover:border-[#BC881B]/60 transition-colors cursor-pointer shrink-0"
                          aria-label="Copy previous author"
                        >
                          <Copy className="w-3 h-3 opacity-90" />
                        </button>
                        <div className="absolute bottom-full right-0 mb-1.5 hidden group-hover:flex flex-col items-end pointer-events-none z-50 whitespace-nowrap">
                          <div className="bg-[#1F1B24] border border-[#3E3846] text-[#F1F5F9] text-[10.5px] font-medium px-2 py-0.5 rounded shadow-lg shadow-black/80">
                            Copy from previous entry
                          </div>
                          <div className="w-1.5 h-1.5 bg-[#1F1B24] border-r border-b border-[#3E3846] rotate-45 -mt-0.75 mr-2"></div>
                        </div>
                      </div>
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
                      className={`w-full h-10 bg-[#121014] border border-[#2B2730] rounded-lg px-3 text-sm text-[#F1F5F9] placeholder:text-slate-600 focus:outline-none focus:border-[#BC881B] focus:ring-1 focus:ring-[#BC881B] transition-colors ${
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
                    <label className="h-5 flex items-center justify-between text-xs font-semibold text-slate-300">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="w-4 h-4 rounded-full bg-[#BC881B]/20 text-[#E0B450] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">5</span>
                        <span className="text-slate-200 truncate">Discipline / Category</span>
                      </span>
                    </label>
                    <CustomSelect
                      value={category}
                      onChange={(val) => setCategory(val)}
                      options={CATEGORY_OPTIONS.map((c) => ({ value: c, label: c }))}
                      searchable
                      className="h-10 w-full"
                      triggerClassName="h-10 bg-[#121014] border-[#2B2730] text-[#F1F5F9]"
                    />
                  </div>

                  {/* Field 6: Language */}
                  <div className="space-y-1.5">
                    <label className="h-5 flex items-center justify-between text-xs font-semibold text-slate-300">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="w-4 h-4 rounded-full bg-[#BC881B]/20 text-[#E0B450] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">6</span>
                        <span className="text-slate-200 truncate">Language / زبان</span>
                      </span>
                    </label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="w-full h-10 bg-[#121014] border border-[#2B2730] rounded-lg px-3 text-sm text-[#F1F5F9] focus:outline-none focus:border-[#BC881B] focus:ring-1 focus:ring-[#BC881B] transition-colors"
                    >
                      <option value="English" className="bg-[#18151C] text-white">English</option>
                      <option value="Urdu" className="bg-[#18151C] text-white">Urdu (اردو)</option>
                      <option value="Arabic" className="bg-[#18151C] text-white">Arabic (العربية)</option>
                      <option value="Pashto" className="bg-[#18151C] text-white">Pashto (پښتو)</option>
                      <option value="Persian" className="bg-[#18151C] text-white">Persian (فارسی)</option>
                      <option value="Other" className="bg-[#18151C] text-white">Other</option>
                    </select>
                  </div>

                  {/* Field 7: ISBN */}
                  <div className="space-y-1.5">
                    <label className="h-5 flex items-center justify-between text-xs font-semibold text-slate-300">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="w-4 h-4 rounded-full bg-[#BC881B]/20 text-[#E0B450] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">7</span>
                        <span className="text-slate-200 truncate">ISBN (10 or 13)</span>
                      </span>
                    </label>
                    <input
                      type="text"
                      tabIndex={14}
                      value={isbn}
                      onChange={(e) => setIsbn(e.target.value)}
                      placeholder="978-0-262-03384-8"
                      className={`w-full h-10 bg-[#121014] border rounded-lg px-3 text-sm font-mono text-[#F1F5F9] focus:outline-none transition-colors ${
                        isDuplicateIsbn 
                          ? 'border-amber-500/80 focus:border-amber-400' 
                          : 'border-[#2B2730] focus:border-[#BC881B] focus:ring-1 focus:ring-[#BC881B]'
                      }`}
                    />
                    {isbnWarning && (
                      <p className="text-[11px] font-mono text-amber-400 flex items-center gap-1 mt-1 truncate">
                        <span className="truncate">{isbnWarning}</span>
                      </p>
                    )}
                  </div>

                  {/* Field 8: Phonetic Search / Romanized Title */}
                  <div className="space-y-1.5">
                    <label className="h-5 flex items-center justify-between text-xs font-semibold text-slate-300">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="w-4 h-4 rounded-full bg-[#BC881B]/20 text-[#E0B450] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">8</span>
                        <span className="text-slate-200 truncate">Romanized Title</span>
                      </span>
                    </label>
                    <input
                      type="text"
                      value={titleRoman}
                      onChange={(e) => setTitleRoman(e.target.value)}
                      placeholder="e.g. Bang-e-Dra or Algorithms"
                      className="w-full h-10 bg-[#121014] border border-[#2B2730] rounded-lg px-3 text-sm text-[#F1F5F9] placeholder:text-slate-600 focus:outline-none focus:border-[#BC881B] focus:ring-1 focus:ring-[#BC881B] transition-colors"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 2: PUBLICATION & PRICING SPECIFICS */}
            {(activeFormTab === 'all' || activeFormTab === 'publication') && (
              <div className="p-5 sm:p-6 rounded-xl bg-[#17141A] border border-[#2E2A33] shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-[#2E2A33] pb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#6FA8D2]" />
                    <span className="text-xs font-bold uppercase tracking-wider text-white">
                      2. Publication &amp; Pricing Specifics
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-[#B3AABD]">
                    Fields 9 to 16
                  </span>
                </div>

                {/* Symmetrical 4-Column Aligned Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
                  {/* Field 9: Edition */}
                  <div className="space-y-1.5">
                    <label className="h-5 flex items-center justify-between text-xs font-semibold text-slate-300">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="w-4 h-4 rounded-full bg-[#BC881B]/20 text-[#E0B450] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">9</span>
                        <span className="text-slate-200 truncate">Edition</span>
                      </span>
                    </label>
                    <input
                      type="text"
                      tabIndex={5}
                      value={edition}
                      onChange={(e) => setEdition(e.target.value)}
                      placeholder="e.g. 1st Edition"
                      className="w-full h-10 bg-[#121014] border border-[#2B2730] rounded-lg px-3 text-sm text-[#F1F5F9] focus:outline-none focus:border-[#BC881B] focus:ring-1 focus:ring-[#BC881B] transition-colors"
                    />
                  </div>

                  {/* Field 10: Place of Publication */}
                  <div className="space-y-1.5">
                    <label className="h-5 flex items-center justify-between text-xs font-semibold text-slate-300">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="w-4 h-4 rounded-full bg-[#BC881B]/20 text-[#E0B450] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">10</span>
                        <span className="text-slate-200 truncate">Place of Pub.</span>
                      </span>
                      <div className="relative group inline-flex items-center">
                        <button
                          type="button"
                          onClick={() => handleDittoField('place')}
                          className="w-5 h-5 rounded flex items-center justify-center text-[#E0B450] hover:text-amber-200 bg-[#221F26] hover:bg-[#2B2730] border border-[#2E2A33] hover:border-[#BC881B]/60 transition-colors cursor-pointer shrink-0"
                          aria-label="Copy previous place of publication"
                        >
                          <Copy className="w-3 h-3 opacity-90" />
                        </button>
                        <div className="absolute bottom-full right-0 mb-1.5 hidden group-hover:flex flex-col items-end pointer-events-none z-50 whitespace-nowrap">
                          <div className="bg-[#1F1B24] border border-[#3E3846] text-[#F1F5F9] text-[10.5px] font-medium px-2 py-0.5 rounded shadow-lg shadow-black/80">
                            Copy from previous entry
                          </div>
                          <div className="w-1.5 h-1.5 bg-[#1F1B24] border-r border-b border-[#3E3846] rotate-45 -mt-0.75 mr-2"></div>
                        </div>
                      </div>
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
                      className={`w-full h-10 bg-[#121014] border border-[#2B2730] rounded-lg px-3 text-sm text-[#F1F5F9] focus:outline-none focus:border-[#BC881B] focus:ring-1 focus:ring-[#BC881B] transition-colors ${
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
                    <label className="h-5 flex items-center justify-between text-xs font-semibold text-slate-300">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="w-4 h-4 rounded-full bg-[#BC881B]/20 text-[#E0B450] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">11</span>
                        <span className="text-slate-200 truncate">Publisher</span>
                      </span>
                      <div className="relative group inline-flex items-center">
                        <button
                          type="button"
                          onClick={() => handleDittoField('publisher')}
                          className="w-5 h-5 rounded flex items-center justify-center text-[#E0B450] hover:text-amber-200 bg-[#221F26] hover:bg-[#2B2730] border border-[#2E2A33] hover:border-[#BC881B]/60 transition-colors cursor-pointer shrink-0"
                          aria-label="Copy previous publisher"
                        >
                          <Copy className="w-3 h-3 opacity-90" />
                        </button>
                        <div className="absolute bottom-full right-0 mb-1.5 hidden group-hover:flex flex-col items-end pointer-events-none z-50 whitespace-nowrap">
                          <div className="bg-[#1F1B24] border border-[#3E3846] text-[#F1F5F9] text-[10.5px] font-medium px-2 py-0.5 rounded shadow-lg shadow-black/80">
                            Copy from previous entry
                          </div>
                          <div className="w-1.5 h-1.5 bg-[#1F1B24] border-r border-b border-[#3E3846] rotate-45 -mt-0.75 mr-2"></div>
                        </div>
                      </div>
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
                      className={`w-full h-10 bg-[#121014] border border-[#2B2730] rounded-lg px-3 text-sm text-[#F1F5F9] focus:outline-none focus:border-[#BC881B] focus:ring-1 focus:ring-[#BC881B] transition-colors ${
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
                    <label className="h-5 flex items-center justify-between text-xs font-semibold text-slate-300">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="w-4 h-4 rounded-full bg-[#BC881B]/20 text-[#E0B450] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">12</span>
                        <span className="text-slate-200 truncate">Year (4 Digits)</span>
                      </span>
                    </label>
                    <input
                      type="number"
                      tabIndex={8}
                      min={1800}
                      max={2030}
                      value={publicationYear}
                      onChange={(e) => setPublicationYear(Number(e.target.value))}
                      className="w-full h-10 bg-[#121014] border border-[#2B2730] rounded-lg px-3 text-sm font-mono text-[#F1F5F9] focus:outline-none focus:border-[#BC881B] focus:ring-1 focus:ring-[#BC881B] transition-colors"
                    />
                  </div>

                  {/* Field 13: Pages */}
                  <div className="space-y-1.5">
                    <label className="h-5 flex items-center justify-between text-xs font-semibold text-slate-300">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="w-4 h-4 rounded-full bg-[#BC881B]/20 text-[#E0B450] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">13</span>
                        <span className="text-slate-200 truncate">Total Pages</span>
                      </span>
                    </label>
                    <input
                      type="text"
                      tabIndex={9}
                      value={pages}
                      onChange={(e) => setPages(e.target.value)}
                      placeholder="e.g. 480"
                      className="w-full h-10 bg-[#121014] border border-[#2B2730] rounded-lg px-3 text-sm font-mono text-[#F1F5F9] focus:outline-none focus:border-[#BC881B] focus:ring-1 focus:ring-[#BC881B] transition-colors"
                    />
                  </div>

                  {/* Field 14: Price (Pakistani Rupees & Paisa) */}
                  <div className="space-y-1.5">
                    <label className="h-5 flex items-center justify-between text-xs font-semibold text-slate-300">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="w-4 h-4 rounded-full bg-[#BC881B]/20 text-[#E0B450] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">14</span>
                        <span className="text-slate-200 truncate">Price (PKR)</span>
                      </span>
                    </label>
                    <div className="h-10 flex items-center bg-[#121014] border border-[#2B2730] rounded-lg overflow-hidden focus-within:border-[#BC881B] focus-within:ring-1 focus-within:ring-[#BC881B] transition-colors">
                      <div className="flex items-center pl-3 pr-1 text-xs font-mono text-slate-400 font-bold shrink-0">
                        Rs
                      </div>
                      <input
                        type="text"
                        tabIndex={10}
                        value={priceRs}
                        onChange={(e) => setPriceRs(e.target.value)}
                        placeholder="850"
                        className="w-full h-full bg-transparent px-2 text-sm font-mono text-[#F1F5F9] focus:outline-none"
                      />
                      <div className="h-5 w-[1px] bg-[#2E2A33] shrink-0" />
                      <div className="flex items-center pl-2 pr-1 text-xs font-mono text-slate-400 font-bold shrink-0">
                        Ps
                      </div>
                      <input
                        type="text"
                        tabIndex={11}
                        maxLength={2}
                        value={pricePs}
                        onChange={(e) => setPricePs(e.target.value)}
                        placeholder="00"
                        className="w-14 h-full bg-transparent px-2 text-sm font-mono text-[#F1F5F9] focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Field 15: Binding & Code */}
                  <div className="space-y-1.5">
                    <label className="h-5 flex items-center justify-between text-xs font-semibold text-slate-300">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="w-4 h-4 rounded-full bg-[#BC881B]/20 text-[#E0B450] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">15</span>
                        <span className="text-slate-200 truncate">Binding &amp; Code</span>
                      </span>
                    </label>
                    <div className="h-10 flex items-center bg-[#121014] border border-[#2B2730] rounded-lg overflow-hidden focus-within:border-[#BC881B] focus-within:ring-1 focus-within:ring-[#BC881B] transition-colors">
                      <select
                        value={binding}
                        onChange={(e) => setBinding(e.target.value)}
                        className="flex-1 h-full bg-transparent px-2.5 text-xs text-[#F1F5F9] focus:outline-none"
                      >
                        <option value="HB" className="bg-[#18151C] text-white">HB (Hard Bound)</option>
                        <option value="SB" className="bg-[#18151C] text-white">SB (Soft Bound)</option>
                        <option value="Leather" className="bg-[#18151C] text-white">Leather Bound</option>
                        <option value="Other" className="bg-[#18151C] text-white">Other</option>
                      </select>
                      <div className="h-5 w-[1px] bg-[#2E2A33] shrink-0" />
                      <input
                        type="text"
                        tabIndex={13}
                        maxLength={4}
                        value={bindingCode}
                        onChange={(e) => setBindingCode(e.target.value)}
                        placeholder="Code 01"
                        title="Binding Code"
                        className="w-20 h-full bg-transparent px-2 text-xs font-mono text-center text-[#E0B450] focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Field 16: Date Added */}
                  <div className="space-y-1.5">
                    <label className="h-5 flex items-center justify-between text-xs font-semibold text-slate-300">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="w-4 h-4 rounded-full bg-[#BC881B]/20 text-[#E0B450] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">16</span>
                        <span className="text-slate-200 truncate">Date Added</span>
                      </span>
                      <div className="relative group inline-flex items-center">
                        <button
                          type="button"
                          onClick={() => handleDittoField('date_added')}
                          className="w-5 h-5 rounded flex items-center justify-center text-[#E0B450] hover:text-amber-200 bg-[#221F26] hover:bg-[#2B2730] border border-[#2E2A33] hover:border-[#BC881B]/60 transition-colors cursor-pointer shrink-0"
                          aria-label="Copy previous date"
                        >
                          <Copy className="w-3 h-3 opacity-90" />
                        </button>
                        <div className="absolute bottom-full right-0 mb-1.5 hidden group-hover:flex flex-col items-end pointer-events-none z-50 whitespace-nowrap">
                          <div className="bg-[#1F1B24] border border-[#3E3846] text-[#F1F5F9] text-[10.5px] font-medium px-2 py-0.5 rounded shadow-lg shadow-black/80">
                            Copy from previous entry
                          </div>
                          <div className="w-1.5 h-1.5 bg-[#1F1B24] border-r border-b border-[#3E3846] rotate-45 -mt-0.75 mr-2"></div>
                        </div>
                      </div>
                    </label>
                    <div className="h-10 flex items-center bg-[#121014] border border-[#2B2730] rounded-lg overflow-hidden focus-within:border-[#BC881B] focus-within:ring-1 focus-within:ring-[#BC881B] transition-colors">
                      <input
                        type="text"
                        tabIndex={16}
                        value={dateAddedRaw}
                        onChange={(e) => handleDateTextChange(e.target.value)}
                        onBlur={handleDateBlur}
                        placeholder="02-Oct-2026"
                        className={`flex-1 h-full bg-transparent px-3 text-sm font-mono text-[#F1F5F9] focus:outline-none ${
                          dateAddedError ? 'text-rose-400' : ''
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
                        <div className="w-8 h-8 rounded-md bg-[#221F26] hover:bg-[#2B2730] border border-[#2E2A33] flex items-center justify-center text-[#E0B450] pointer-events-none transition-colors">
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
              <div className="p-5 sm:p-6 rounded-xl bg-[#17141A] border border-[#2E2A33] shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-[#2E2A33] pb-3">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#A66BC9]" />
                    <span className="text-xs font-bold uppercase tracking-wider text-white">
                      3. Archival Shelving &amp; Almari Location
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-[#B3AABD]">
                    Fields 17 to 22
                  </span>
                </div>

                {/* Symmetrical 4-Column Aligned Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
                  {/* Field 17: Almari (الماری) */}
                  <div className="space-y-1.5">
                    <label className="h-5 flex items-center justify-between text-xs font-semibold text-slate-300">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="w-4 h-4 rounded-full bg-[#BC881B]/20 text-[#E0B450] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">17</span>
                        <span className="text-slate-200 truncate">Almari (الماری)</span>
                      </span>
                    </label>
                    <select
                      value={almariId}
                      onChange={(e) => setAlmariId(e.target.value)}
                      className="w-full h-10 bg-[#121014] border border-[#2B2730] rounded-lg px-2.5 text-xs sm:text-sm text-[#F1F5F9] focus:outline-none focus:border-[#BC881B] focus:ring-1 focus:ring-[#BC881B] transition-colors"
                    >
                      <option value="" className="bg-[#18151C] text-white">(No almari assigned)</option>
                      {AlmariService.getAlmaris().filter(a => a.is_active).map(a => (
                        <option key={a.id} value={a.id} className="bg-[#18151C] text-white">
                          {a.code} - {a.name_en}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Field 18: Shelf Number */}
                  <div className="space-y-1.5">
                    <label className="h-5 flex items-center justify-between text-xs font-semibold text-slate-300">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="w-4 h-4 rounded-full bg-[#BC881B]/20 text-[#E0B450] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">18</span>
                        <span className="text-slate-200 truncate">Shelf Level (1-12)</span>
                      </span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="12"
                      value={shelfNo}
                      onChange={(e) => setShelfNo(parseInt(e.target.value, 10) || 1)}
                      className="w-full h-10 bg-[#121014] border border-[#2B2730] rounded-lg px-3 text-sm font-mono text-[#F1F5F9] focus:outline-none focus:border-[#BC881B] focus:ring-1 focus:ring-[#BC881B] transition-colors"
                    />
                  </div>

                  {/* Field 19: Book Group (گروپ) */}
                  <div className="space-y-1.5">
                    <label className="h-5 flex items-center justify-between text-xs font-semibold text-slate-300">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="w-4 h-4 rounded-full bg-[#BC881B]/20 text-[#E0B450] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">19</span>
                        <span className="text-slate-200 truncate">Classification Group</span>
                      </span>
                    </label>
                    <select
                      value={groupId}
                      onChange={(e) => setGroupId(e.target.value)}
                      className="w-full h-10 bg-[#121014] border border-[#2B2730] rounded-lg px-2.5 text-xs sm:text-sm text-[#F1F5F9] focus:outline-none focus:border-[#BC881B] focus:ring-1 focus:ring-[#BC881B] transition-colors"
                    >
                      <option value="" className="bg-[#18151C] text-white">(Unassigned group)</option>
                      {AlmariService.getGroups().filter(g => g.is_active).map(g => (
                        <option key={g.id} value={g.id} className="bg-[#18151C] text-white">
                          {g.name_en} ({g.name_ur})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Field 20: Dewey Call Number */}
                  <div className="space-y-1.5">
                    <label className="h-5 flex items-center justify-between text-xs font-semibold text-slate-300">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="w-4 h-4 rounded-full bg-[#BC881B]/20 text-[#E0B450] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">20</span>
                        <span className="text-slate-200 truncate">Dewey Call No</span>
                      </span>
                    </label>
                    <input
                      type="text"
                      tabIndex={17}
                      value={deweyCallNumber}
                      onChange={(e) => setDeweyCallNumber(e.target.value)}
                      placeholder="005.133 ULM"
                      className="w-full h-10 bg-[#121014] border border-[#2B2730] rounded-lg px-3 text-sm font-mono text-[#F1F5F9] focus:outline-none focus:border-[#BC881B] focus:ring-1 focus:ring-[#BC881B] transition-colors"
                    />
                  </div>

                  {/* Field 21: Archival Section (2 columns) */}
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="h-5 flex items-center justify-between text-xs font-semibold text-slate-300">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="w-4 h-4 rounded-full bg-[#BC881B]/20 text-[#E0B450] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">21</span>
                        <span className="text-slate-200 truncate">Archival Stacks Section</span>
                      </span>
                    </label>
                    <input
                      type="text"
                      tabIndex={19}
                      value={section}
                      onChange={(e) => setSection(e.target.value)}
                      placeholder="e.g. Main Stacks or Reference Wing"
                      className="w-full h-10 bg-[#121014] border border-[#2B2730] rounded-lg px-3 text-sm text-[#F1F5F9] focus:outline-none focus:border-[#BC881B] focus:ring-1 focus:ring-[#BC881B] transition-colors"
                    />
                  </div>

                  {/* Field 22: Source / Acquisition Remarks (2 columns) */}
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="h-5 flex items-center justify-between text-xs font-semibold text-slate-300">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="w-4 h-4 rounded-full bg-[#BC881B]/20 text-[#E0B450] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">22</span>
                        <span className="text-slate-200 truncate">Source / Acquisition Remarks</span>
                      </span>
                      <div className="relative group inline-flex items-center">
                        <button
                          type="button"
                          onClick={() => handleDittoField('source')}
                          className="w-5 h-5 rounded flex items-center justify-center text-[#E0B450] hover:text-amber-200 bg-[#221F26] hover:bg-[#2B2730] border border-[#2E2A33] hover:border-[#BC881B]/60 transition-colors cursor-pointer shrink-0"
                          aria-label="Copy previous source remarks"
                        >
                          <Copy className="w-3 h-3 opacity-90" />
                        </button>
                        <div className="absolute bottom-full right-0 mb-1.5 hidden group-hover:flex flex-col items-end pointer-events-none z-50 whitespace-nowrap">
                          <div className="bg-[#1F1B24] border border-[#3E3846] text-[#F1F5F9] text-[10.5px] font-medium px-2 py-0.5 rounded shadow-lg shadow-black/80">
                            Copy from previous entry
                          </div>
                          <div className="w-1.5 h-1.5 bg-[#1F1B24] border-r border-b border-[#3E3846] rotate-45 -mt-0.75 mr-2"></div>
                        </div>
                      </div>
                    </label>
                    <input
                      type="text"
                      tabIndex={15}
                      dir="auto"
                      style={{ unicodeBidi: 'plaintext' }}
                      value={sourceRemarks}
                      onChange={(e) => setSourceRemarks(e.target.value)}
                      placeholder="e.g. University Purchase or HEC Grant"
                      className="w-full h-10 bg-[#121014] border border-[#2B2730] rounded-lg px-3 text-sm text-[#F1F5F9] focus:outline-none focus:border-[#BC881B] focus:ring-1 focus:ring-[#BC881B] transition-colors"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 4: INVENTORY, COVER ART & DESCRIPTION */}
            {(activeFormTab === 'all' || activeFormTab === 'inventory') && (
              <div className="p-5 sm:p-6 rounded-xl bg-[#17141A] border border-[#2E2A33] shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-[#2E2A33] pb-3">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-[#34D399]" />
                    <span className="text-xs font-bold uppercase tracking-wider text-white">
                      4. Inventory Quantity, Cover &amp; Notes
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowMediaStudio(!showMediaStudio)}
                    className="text-xs font-mono text-[#E0B450] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>{showMediaStudio ? 'Hide Cover Studio' : 'Edit Cover Image'}</span>
                  </button>
                </div>

                {/* Symmetrical 4-Column Aligned Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
                  {/* Field 23: Total Copies */}
                  <div className="space-y-1.5">
                    <label className="h-5 flex items-center justify-between text-xs font-semibold text-slate-300">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="w-4 h-4 rounded-full bg-[#BC881B]/20 text-[#E0B450] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">23</span>
                        <span className="text-slate-200 truncate">Total Copies</span>
                      </span>
                    </label>
                    <div className="flex items-center h-10 border border-[#2B2730] rounded-lg overflow-hidden bg-[#121014]">
                      <button
                        type="button"
                        onClick={() => setTotalQuantity(Math.max(1, totalQuantity - 1))}
                        className="w-10 h-full text-slate-400 hover:text-white hover:bg-[#221F26] flex items-center justify-center font-bold text-base cursor-pointer transition-colors"
                      >
                        -
                      </button>
                      <span className="flex-1 text-center font-mono font-bold text-sm text-[#F1F5F9]">
                        {totalQuantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => setTotalQuantity(totalQuantity + 1)}
                        className="w-10 h-full text-slate-400 hover:text-white hover:bg-[#221F26] flex items-center justify-center font-bold text-base cursor-pointer transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Field 24: Available in Circulation */}
                  <div className="space-y-1.5">
                    <label className="h-5 flex items-center justify-between text-xs font-semibold text-slate-300">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="w-4 h-4 rounded-full bg-[#BC881B]/20 text-[#E0B450] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">24</span>
                        <span className="text-slate-200 truncate">Loan Availability</span>
                      </span>
                    </label>
                    <div className="h-10 px-3 rounded-lg bg-[#121014] border border-[#2B2730] flex items-center justify-between text-xs font-mono font-bold text-emerald-400">
                      <span>In Stacks:</span>
                      <span>{Math.min(availableQuantity, totalQuantity)} of {totalQuantity} Copies</span>
                    </div>
                  </div>

                  {/* Field 25: Cover Preview / Toggle (2 columns) */}
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="h-5 flex items-center justify-between text-xs font-semibold text-slate-300">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="w-4 h-4 rounded-full bg-[#BC881B]/20 text-[#E0B450] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">25</span>
                        <span className="text-slate-200 truncate">Book Cover Image</span>
                      </span>
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={bookImagePath}
                        onChange={(e) => setBookImagePath(e.target.value)}
                        placeholder="Image URL or upload below..."
                        className="flex-1 h-10 bg-[#121014] border border-[#2B2730] rounded-lg px-3 text-xs sm:text-sm font-mono text-[#F1F5F9] focus:outline-none focus:border-[#BC881B] focus:ring-1 focus:ring-[#BC881B] transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowMediaStudio(!showMediaStudio)}
                        className="h-10 px-3 rounded-lg bg-[#221F26] hover:bg-[#2B2730] text-xs font-semibold text-white border border-[#2E2A33] shrink-0 cursor-pointer transition-colors"
                      >
                        {showMediaStudio ? 'Close' : 'Presets / Upload'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Collapsible Cover Studio */}
                {showMediaStudio && (
                  <div className="p-4 rounded-xl bg-[#141214] border border-[#2E2A33] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-[#E0B450]" />
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
                          className="px-3 py-1.5 rounded-lg bg-[#221F26] hover:bg-[#2B2730] border border-[#2E2A33] text-xs font-medium text-slate-200 cursor-pointer transition-colors"
                        >
                          {isProcessingImage ? 'Processing...' : 'Upload Image'}
                        </button>
                        {bookImagePath && (
                          <button
                            type="button"
                            onClick={() => setBookImagePath('')}
                            className="px-2 py-1 text-xs text-rose-400 hover:text-rose-300 cursor-pointer"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Presets Row */}
                    <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-[#2E2A33]">
                      <span className="text-[11px] text-[#B3AABD] font-mono">Academic Presets:</span>
                      {PRESET_COVERS.map((preset) => (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => setBookImagePath(preset.url)}
                          className="px-2.5 py-1 rounded-md bg-[#121014] hover:bg-[#25202B] border border-[#2B2730] text-[11px] text-slate-300 font-medium cursor-pointer transition-colors"
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Field 26: Description / Syllabus Notes */}
                <div className="space-y-1.5 pt-3 border-t border-[#2E2A33]">
                  <label className="h-5 flex items-center justify-between text-xs font-semibold text-slate-300">
                    <span className="flex items-center gap-1.5 truncate">
                      <span className="w-4 h-4 rounded-full bg-[#BC881B]/20 text-[#E0B450] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">26</span>
                      <span className="text-slate-200 truncate">Catalog Description, Syllabus Reference &amp; Course Notes</span>
                    </span>
                  </label>
                  <textarea
                    rows={2}
                    tabIndex={20}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Course codes, syllabus overview, prerequisites, or condition notes..."
                    className="w-full bg-[#121014] border border-[#2B2730] rounded-lg p-3 text-xs sm:text-sm text-[#F1F5F9] placeholder:text-slate-600 focus:outline-none focus:border-[#BC881B] focus:ring-1 focus:ring-[#BC881B] leading-relaxed resize-y transition-colors"
                  />
                </div>
              </div>
            )}
          </form>
        </div>

        {/* 3. MODAL FOOTER BAR */}
        <div className="px-6 py-3.5 bg-[#141214] border-t border-[#2E2A33] flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {bookToEdit && onDelete && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onDelete(bookToEdit);
                }}
                className="px-3.5 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Withdraw Title</span>
              </button>
            )}
            <div className="text-[11px] text-[#B3AABD] flex items-center gap-1.5 font-mono">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>SQLite WAL Atomic Record</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-[#221F26] hover:bg-[#2B2730] text-slate-300 text-xs font-semibold border border-[#2E2A33] transition-colors cursor-pointer"
            >
              Cancel (Esc)
            </button>

            {!bookToEdit && (
              <button
                type="button"
                onClick={() => executeSave(true)}
                disabled={saveState !== 'idle'}
                className="px-4 py-2 rounded-lg bg-[#1F1B24] hover:bg-[#2B2533] text-[#E0B450] font-semibold text-xs border border-[#BC881B]/40 flex items-center gap-1.5 transition-all cursor-pointer"
                title="Save current volume and immediately prepare next accession entry"
              >
                <Zap className="w-3.5 h-3.5 text-[#E0B450]" />
                <span>Save &amp; Next (Enter ↵)</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => executeSave(false)}
              disabled={saveState !== 'idle'}
              className="px-6 py-2 rounded-lg bg-gradient-to-r from-[#BC881B] to-[#D4A02A] hover:brightness-110 active:scale-[0.98] text-[#0F0D11] font-bold text-xs shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {saveState === 'loading' ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Recording...</span>
                </>
              ) : saveState === 'success' ? (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Committed</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5 stroke-[2.2]" />
                  <span>{bookToEdit ? 'Save Changes' : 'Register Volume'}</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
