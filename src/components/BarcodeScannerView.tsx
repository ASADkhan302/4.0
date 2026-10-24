import React, { useState, useEffect, useRef } from 'react';
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
  GraduationCap,
  Sparkles,
  CreditCard,
  Calendar,
  Check,
  Layers,
  Clock,
  X,
  ChevronRight
} from 'lucide-react';
import { Book, Transaction, Borrower } from '../types/library';
import { playSuccessBarcodeBeep, playErrorBeep } from '../services/audio';
import { LibraryStorage } from '../services/storage';
import { ULM_CREST_LOGO } from '../constants/branding';

interface BarcodeScannerViewProps {
  books: Book[];
  transactions: Transaction[];
  borrowers?: Borrower[];
  onOpenBookDetails: (bookId: string) => void;
  onQuickLoan: (book: Book) => void;
  onQuickReturn: (transactionId: string) => void;
  onPrintBarcode: (book: Book) => void;
  onOpenAddBookWithBarcode: (barcode: string) => void;
  onIssueBookToBorrower?: (bookId: string, borrowerId: string) => void;
}

export const BarcodeScannerView: React.FC<BarcodeScannerViewProps> = ({
  books,
  transactions,
  borrowers,
  onOpenBookDetails,
  onQuickLoan,
  onQuickReturn,
  onPrintBarcode,
  onOpenAddBookWithBarcode,
  onIssueBookToBorrower,
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

  // Mode A: Inline Almari & Shelf placement state
  const [isPlacingInAlmari, setIsPlacingInAlmari] = useState(false);
  const [placementAlmari, setPlacementAlmari] = useState('ALM-01');
  const [placementShelf, setPlacementShelf] = useState(1);
  const [placementSuccessMsg, setPlacementSuccessMsg] = useState<string | null>(null);

  // Mode A: Chained Scan (Book -> Student ID Barcode -> Loan Duration Selector)
  const [isChainedIssueActive, setIsChainedIssueActive] = useState(false);
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

  const inputRef = useRef<HTMLInputElement>(null);
  const issueInputRef = useRef<HTMLInputElement>(null);
  const chainedStudentInputRef = useRef<HTMLInputElement>(null);

  // Auto focus input on mount and whenever returning to idle
  useEffect(() => {
    if (scanState === 'IDLE') {
      inputRef.current?.focus();
    } else if (scanState === 'BORROWER_FOUND') {
      issueInputRef.current?.focus();
    }
  }, [scanState]);

  useEffect(() => {
    if (isChainedIssueActive) {
      chainedStudentInputRef.current?.focus();
    }
  }, [isChainedIssueActive]);

  const activeBorrowersList = borrowers && borrowers.length > 0 
    ? borrowers 
    : LibraryStorage.getBorrowers();

  const handleSearch = (codeToSearch: string) => {
    const cleanCode = codeToSearch.trim();
    if (!cleanCode) return;

    setSearchedBarcode(cleanCode);
    const cleanLower = cleanCode.toLowerCase();

    // 1. Check if the scanned barcode matches a Borrower Card / ID
    const borrower = activeBorrowersList.find(b => 
      b.is_active && (
        b.barcode?.toLowerCase() === cleanLower ||
        b.university_id?.toLowerCase() === cleanLower ||
        b.student_id?.toLowerCase() === cleanLower ||
        b.id?.toLowerCase() === cleanLower ||
        b.name?.toLowerCase() === cleanLower
      )
    );

    if (borrower) {
      setFoundBorrower(borrower);
      setFoundBook(null);
      setScanState('BORROWER_FOUND');
      setIssueMessage(null);
      setIssueBookInput('');
      setIsPlacingInAlmari(false);
      setIsChainedIssueActive(false);
      setIsScanSuccessFlash(true);
      setTimeout(() => setIsScanSuccessFlash(false), 300);
      if (soundEnabled) playSuccessBarcodeBeep();
      return;
    }

    // 2. Check if the scanned barcode matches a Cataloged Book
    const book = books.find(b => 
      b.is_active && (
        b.barcode.trim().toUpperCase() === cleanCode.toUpperCase() ||
        (b.accession_no && b.accession_no.trim().toUpperCase() === cleanCode.toUpperCase()) ||
        (b.isbn && b.isbn.replace(/[-\s]/g, '') === cleanCode.replace(/[-\s]/g, ''))
      )
    );

    if (book) {
      setFoundBook(book);
      setFoundBorrower(null);
      setScanState('BOOK_FOUND');
      setIsPlacingInAlmari(false);
      setIsChainedIssueActive(false);
      setPlacementSuccessMsg(null);
      if (book.almari_id) setPlacementAlmari(book.almari_id);
      if (book.shelf_no) setPlacementShelf(book.shelf_no);
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
    setIsPlacingInAlmari(false);
    setIsChainedIssueActive(false);
    setPlacementSuccessMsg(null);
    setIsDurationSelectorOpen(false);
    setPendingDurationTarget(null);
    setScanState('IDLE');
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  // Save Almari and Shelf placement directly
  const handleSavePlacement = () => {
    if (!foundBook) return;
    const shelfCode = `${placementAlmari}-Shelf-${placementShelf}`;
    LibraryStorage.updateBook(foundBook.id, {
      almari_id: placementAlmari,
      shelf_no: placementShelf,
      shelf: shelfCode,
    });
    setFoundBook({
      ...foundBook,
      almari_id: placementAlmari,
      shelf_no: placementShelf,
      shelf: shelfCode,
    });
    setPlacementSuccessMsg(`Book location saved to ${placementAlmari} · Shelf ${placementShelf}.`);
    if (soundEnabled) playSuccessBarcodeBeep();
    setTimeout(() => setPlacementSuccessMsg(null), 3500);
  };

  // Chained scan: Book -> Student scan -> Auto prompt Loan Duration
  const handleChainedStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!foundBook) return;
    const q = chainedStudentInput.trim().toLowerCase();
    if (!q) return;

    const student = activeBorrowersList.find(b => 
      b.is_active && (
        b.barcode?.toLowerCase() === q ||
        b.university_id?.toLowerCase() === q ||
        b.student_id?.toLowerCase() === q ||
        b.id?.toLowerCase() === q ||
        b.name?.toLowerCase().includes(q) ||
        (b.roll_number && b.roll_number.toLowerCase().includes(q))
      )
    );

    if (!student) {
      setChainedStudentError(`Student/Member "${chainedStudentInput}" not found in database.`);
      if (soundEnabled) playErrorBeep();
      return;
    }

    setChainedStudentError(null);
    setChainedStudentInput('');
    setIsChainedIssueActive(false);

    // Auto-open Loan Duration Selector
    setPendingDurationTarget({ book: foundBook, borrower: student });
    setSelectedDurationDays(14);
    setCustomDaysInput('14');
    setIsDurationSelectorOpen(true);
  };

  // Mode B: Select book to issue to active student
  const handleSelectBookForStudent = (targetBook: Book) => {
    if (!foundBorrower) return;
    if (targetBook.available_quantity <= 0) {
      setIssueMessage({
        type: 'error',
        text: `All copies of "${targetBook.book_name}" are currently on loan.`,
      });
      if (soundEnabled) playErrorBeep();
      return;
    }

    // Auto-open Loan Duration Selector
    setPendingDurationTarget({ book: targetBook, borrower: foundBorrower });
    setSelectedDurationDays(14);
    setCustomDaysInput('14');
    setIsDurationSelectorOpen(true);
  };

  // Confirm issue loan after selecting loan duration
  const handleConfirmIssueLoan = () => {
    if (!pendingDurationTarget) return;
    setIsSubmittingLoan(true);
    const duration = selectedDurationDays;

    if (onIssueBookToBorrower) {
      onIssueBookToBorrower(pendingDurationTarget.book.id, pendingDurationTarget.borrower.id);
    } else {
      LibraryStorage.issueBook(pendingDurationTarget.book.id, pendingDurationTarget.borrower.id, duration);
    }

    if (soundEnabled) playSuccessBarcodeBeep();
    setIssueMessage({
      type: 'success',
      text: `Successfully issued "${pendingDurationTarget.book.book_name}" to ${pendingDurationTarget.borrower.name} for ${duration} days!`,
    });

    setIsSubmittingLoan(false);
    setIsDurationSelectorOpen(false);
    setPendingDurationTarget(null);

    // Refresh active book / borrower
    if (foundBook && foundBook.id === pendingDurationTarget.book.id) {
      setFoundBook({
        ...foundBook,
        available_quantity: Math.max(0, foundBook.available_quantity - 1),
      });
    }
  };

  // Loans for active book
  const activeBookLoans = foundBook 
    ? transactions.filter(t => t.book_id === foundBook.id && t.status !== 'RETURNED')
    : [];

  // Loans and quota metrics for active borrower
  const borrowerActiveLoans = foundBorrower 
    ? transactions.filter(t => t.borrower_id === foundBorrower.id && t.status !== 'RETURNED')
    : [];

  const todayIso = new Date().toISOString().split('T')[0];
  let borrowerOverdueCount = 0;
  let borrowerTotalFine = 0;

  borrowerActiveLoans.forEach(loan => {
    if (loan.due_date && loan.due_date < todayIso) {
      borrowerOverdueCount++;
      const msDiff = new Date(todayIso).getTime() - new Date(loan.due_date).getTime();
      const daysOverdue = Math.max(0, Math.floor(msDiff / (1000 * 60 * 60 * 24)));
      borrowerTotalFine += daysOverdue * 10; // Rs. 10 per day overdue
    }
  });

  const maxAllowedQuota = foundBorrower 
    ? (foundBorrower.borrow_limit || (foundBorrower.role === 'Faculty' ? 10 : foundBorrower.role === 'Staff' ? 5 : 3))
    : 3;

  const isQuotaReached = borrowerActiveLoans.length >= maxAllowedQuota;
  const isBlockedOverdue = borrowerOverdueCount > 0 || borrowerTotalFine > 0;

  // Handle Quick Issue Book directly inside Borrower Card
  const handleIssueBookToActiveBorrower = (e: React.FormEvent) => {
    e.preventDefault();
    if (!foundBorrower) return;

    const cleanBookCode = issueBookInput.trim();
    if (!cleanBookCode) return;

    if (isBlockedOverdue) {
      setIssueMessage({
        type: 'error',
        text: `Cannot issue book: Member has ${borrowerOverdueCount} overdue book(s) and unpaid fine of Rs. ${borrowerTotalFine}.`,
      });
      if (soundEnabled) playErrorBeep();
      return;
    }

    if (isQuotaReached) {
      setIssueMessage({
        type: 'error',
        text: `Cannot issue book: Member has reached maximum borrowing quota (${borrowerActiveLoans.length} / ${maxAllowedQuota} Books).`,
      });
      if (soundEnabled) playErrorBeep();
      return;
    }

    const targetBook = books.find(b => 
      b.is_active && (
        b.barcode.trim().toUpperCase() === cleanBookCode.toUpperCase() ||
        (b.accession_no && b.accession_no.trim().toUpperCase() === cleanBookCode.toUpperCase())
      )
    );

    if (!targetBook) {
      setIssueMessage({
        type: 'error',
        text: `Book with barcode/accession "${cleanBookCode}" not found in catalog.`,
      });
      if (soundEnabled) playErrorBeep();
      return;
    }

    if (targetBook.available_quantity <= 0) {
      setIssueMessage({
        type: 'error',
        text: `All copies of "${targetBook.book_name}" are currently on loan.`,
      });
      if (soundEnabled) playErrorBeep();
      return;
    }

    handleSelectBookForStudent(targetBook);
    setIssueBookInput('');
  };

  return (
    <div className="w-full h-auto min-h-0 flex flex-col gap-5 px-4 sm:px-6 lg:px-8 pt-5 pb-12 overflow-visible">
      <div className="max-w-[1280px] w-full mx-auto space-y-6">

        {/* Top Header Card */}
        <div className="flex flex-wrap items-center justify-between gap-4 ulm-liquid-glass rounded-xl p-4 sm:p-5 shadow-sm transition-all">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[var(--text-strong)] flex items-center gap-2 font-display">
              <QrCode className="w-5 h-5 text-royal-gold" />
              <span>Barcode Scanner &amp; Hardware Station</span>
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-1 font-ui">
              Unified laser lookup: Scans both Book Barcodes (0092...) and Student/Faculty Cards (ULM-STD-..., STD-...).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium font-ui transition-all cursor-pointer ${
                soundEnabled 
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400' 
                  : 'bg-white/[0.04] border-white/10 text-[var(--text-muted)]'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span>Chirp: {soundEnabled ? 'ON' : 'OFF'}</span>
            </button>

            <button
              onClick={() => setAutoSubmit(!autoSubmit)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium font-ui transition-all cursor-pointer ${
                autoSubmit 
                  ? 'bg-[#BC881B]/20 border-[#BC881B]/40 text-[#E0B450]' 
                  : 'bg-white/[0.04] border-white/10 text-[var(--text-muted)]'
              }`}
            >
              <span>Auto-Enter: {autoSubmit ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </div>

        {/* Scanner Laser Input Centerpiece */}
        <div className={`ulm-liquid-glass rounded-2xl p-6 sm:p-8 shadow-sm relative overflow-hidden transition-all ${
          isScanSuccessFlash ? 'ring-4 ring-emerald-500/50' : ''
        }`}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="text-center space-y-1">
              <span className="text-xs font-mono font-bold text-royal-gold uppercase tracking-wider">
                POINT USB SCANNER OR TYPE BARCODE / MEMBER CARD ID
              </span>
              <p className="text-xs text-[var(--text-muted)] font-ui">
                Ready for physical barcode scanners (Symbol/Honeywell/Datalogic) or manual keyboard accession entry.
              </p>
            </div>

            <div className="max-w-2xl w-full mx-auto relative flex items-center bg-white/90 dark:bg-[#0B1220] border-2 border-[#BC881B]/50 focus-within:border-[#BC881B] focus-within:ring-2 focus-within:ring-[#BC881B]/20 rounded-xl transition-all shadow-md">
              <BarcodeIcon className="w-5 h-5 text-[#BC881B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={barcodeInput}
                onChange={(e) => {
                  setBarcodeInput(e.target.value);
                  if (autoSubmit && e.target.value.length >= 13) {
                    handleSearch(e.target.value);
                  }
                }}
                placeholder="[ Scan book barcode or borrower card ID ]"
                className="w-full h-12 pl-11 pr-32 bg-transparent border-0 text-center text-base sm:text-lg font-mono font-bold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 tracking-wider focus:outline-none focus:ring-0"
              />
              <button
                type="submit"
                className="absolute right-1.5 top-1.5 bottom-1.5 px-5 rounded-lg bg-[#BC881B] hover:bg-[#D4A02A] active:bg-[#A87B16] text-[#0B1220] font-bold text-xs flex items-center gap-2 shadow-sm tracking-wide transition-all cursor-pointer shrink-0 font-ui"
              >
                <Search className="w-3.5 h-3.5 text-[#0B1220] stroke-[2.5]" />
                <span>Lookup</span>
              </button>
            </div>
          </form>

          {/* Quick Test Barcodes */}
          <div className="mt-5 pt-4 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-center gap-2.5">
            <span className="text-[11px] font-mono text-[var(--text-muted)]">Quick Test Scans:</span>
            {activeBorrowersList.slice(0, 2).map(b => (
              <button
                key={b.id}
                onClick={() => handleTestScan(b.barcode || b.university_id || b.student_id)}
                className="px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-[11px] font-mono text-indigo-400 border border-indigo-500/30 tracking-wide transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <CreditCard className="w-3 h-3 text-indigo-400" />
                <span>Card: {b.barcode || b.university_id || b.name}</span>
              </button>
            ))}
            {books.slice(0, 2).map(b => (
              <button
                key={b.id}
                onClick={() => handleTestScan(b.barcode)}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-mono text-[var(--text-strong)] border border-[var(--border-subtle)] tracking-wide transition-colors cursor-pointer"
              >
                Book: {b.barcode} ({b.book_name.slice(0, 12)}...)
              </button>
            ))}
          </div>
        </div>

        {/* ---------------- SECTION: 2-COLUMN LIVE BORROWER ID CARD + SCANNED BOOK DESK (IDLE STATE) ---------------- */}
        {scanState === 'IDLE' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-200">
            {/* Column 1: Live Borrower ID Card Preview Desk */}
            <div className="bg-white/90 dark:bg-[#131B2E] border border-slate-200/80 dark:border-white/10 text-slate-900 dark:text-white rounded-2xl p-5 sm:p-6 space-y-4 flex flex-col justify-between shadow-sm">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[var(--border-subtle)]">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-royal-gold" />
                    <h3 className="font-bold text-[15px] text-slate-900 dark:text-white">Live Borrower ID Card Desk</h3>
                  </div>
                  <span className="text-[11px] font-mono text-slate-600 dark:text-[var(--text-muted)] bg-slate-100 dark:bg-white/10 px-2 py-0.5 rounded">
                    Hardware Scanner Ready
                  </span>
                </div>

                {activeBorrowersList.length > 0 ? (
                  <div className="mt-4 p-4 rounded-xl ulm-preserve-dark border border-[#BC881B]/40 relative overflow-hidden shadow-lg">
                    {/* Background Crest Watermark */}
                    <img 
                      src={ULM_CREST_LOGO} 
                      alt="" 
                      className="absolute -right-4 -bottom-4 w-32 h-32 object-contain opacity-10 pointer-events-none" 
                    />
                    
                    <div className="flex items-start justify-between gap-3 relative z-10">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-[#131B2E] border border-[#BC881B]/40 p-1 flex items-center justify-center shrink-0">
                          <img src={ULM_CREST_LOGO} alt="ULM" className="w-10 h-10 object-contain" />
                        </div>
                        <div>
                          <p className="font-serif font-bold text-base text-amber-200 leading-tight">
                            {activeBorrowersList[0].name}
                          </p>
                          <p className="text-[11px] text-slate-300 font-mono mt-0.5">
                            {activeBorrowersList[0].department} · {(activeBorrowersList[0].role || 'STUDENT').toUpperCase()}
                          </p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        {activeBorrowersList[0].status}
                      </span>
                    </div>

                    {/* Member Barcode in Locked Safe-Pad */}
                    <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between gap-3 relative z-10">
                      <div>
                        <span className="text-[10px] text-slate-400 font-mono block">CARD ACCESSION / ID</span>
                        <span className="font-mono text-xs font-bold text-amber-300">
                          {activeBorrowersList[0].university_id || activeBorrowersList[0].barcode || 'ULM-STD-001'}
                        </span>
                      </div>
                      <div className="ulm-barcode-safepad px-3 py-1 flex items-center gap-1 select-none">
                        <BarcodeIcon className="w-4 h-4 text-black shrink-0" />
                        <span className="font-mono text-xs font-bold tracking-widest text-black">
                          {activeBorrowersList[0].barcode || 'ULM-STD-001'}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[var(--text-muted)] py-6 text-center">No borrower records in database.</p>
                )}
              </div>

              {activeBorrowersList.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleTestScan(activeBorrowersList[0].barcode || activeBorrowersList[0].university_id || activeBorrowersList[0].student_id)}
                  className="w-full h-10 rounded-xl bg-[#BC881B]/15 hover:bg-[#BC881B]/25 text-royal-gold border border-[#BC881B]/40 font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Simulate Scanner Reading Member Card</span>
                </button>
              )}
            </div>

            {/* Column 2: Live Scanned Book Desk Preview */}
            <div className="bg-white/90 dark:bg-[#131B2E] border border-slate-200/80 dark:border-white/10 text-slate-900 dark:text-white rounded-2xl p-5 sm:p-6 space-y-4 flex flex-col justify-between shadow-sm">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-royal-gold" />
                    <h3 className="font-bold text-[15px] text-[var(--text-strong)]">Live Scanned Book Desk</h3>
                  </div>
                  <span className="text-[11px] font-mono text-[var(--text-muted)] bg-white/10 px-2 py-0.5 rounded">
                    Catalog Hot-Scan Ready
                  </span>
                </div>

                {books.length > 0 ? (
                  <div className="mt-4 p-4 rounded-xl border border-[var(--border-subtle)] bg-white/30 dark:bg-[#0B1220]/60 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-16 rounded bg-[#141214] border border-[#BC881B]/30 flex items-center justify-center text-royal-gold shrink-0">
                        <BookOpen className="w-6 h-6 stroke-[1.5]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-semibold bg-blue-500/15 text-blue-500 dark:text-blue-400 px-1.5 py-0.5 rounded">
                            {books[0].category}
                          </span>
                          <span className="text-[11px] font-mono text-royal-gold font-bold">
                            #{books[0].accession_no || books[0].barcode}
                          </span>
                        </div>
                        <h4 className="font-bold text-[14px] text-[var(--text-strong)] line-clamp-1 mt-1" title={books[0].book_name}>
                          {books[0].book_name}
                        </h4>
                        <p className="text-xs text-[var(--text-muted)] truncate">by {books[0].author}</p>
                      </div>
                    </div>

                    {/* Book Barcode in Locked Safe-Pad */}
                    <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between gap-3">
                      <div className="text-[11px] text-[var(--text-muted)] font-mono">
                        Shelf: <span className="font-semibold text-[var(--text-strong)]">{books[0].shelf || 'ALM-01'}</span> · Row {books[0].row || '1'}
                      </div>
                      <div className="ulm-barcode-safepad px-3 py-1 flex items-center gap-1.5 select-none">
                        <BarcodeIcon className="w-4 h-4 text-black shrink-0" />
                        <span className="font-mono text-xs font-bold tracking-widest text-black">
                          {books[0].barcode}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[var(--text-muted)] py-6 text-center">No catalog books available.</p>
                )}
              </div>

              {books.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleTestScan(books[0].barcode)}
                  className="w-full h-10 rounded-xl bg-[#BC881B] hover:bg-[#D4A02A] text-slate-950 font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  <BarcodeIcon className="w-4 h-4" />
                  <span>Test Scan Book Barcode (#{books[0].accession_no || books[0].barcode})</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* ---------------- SECTION: BORROWER STATUS CARD (MODE B: STUDENT FIRST) ---------------- */}
        {scanState === 'BORROWER_FOUND' && foundBorrower && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-150">
            {/* Left Column: Full Student Profile & Printable CR80 ID Card */}
            <div className="bg-white/95 dark:bg-[#151C2C] border-2 border-[#BC881B]/50 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5 relative overflow-hidden flex flex-col justify-between">
              <div className="space-y-4">
                {/* Header: Member Identity & Status Badge */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-white/[0.08] pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#131B2E] border border-[#BC881B]/50 p-1 flex items-center justify-center shrink-0">
                      <img src={ULM_CREST_LOGO} alt="ULM Crest" className="w-8 h-8 object-contain" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white font-serif">
                        {foundBorrower.name}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-[#B3AABD] font-mono">
                        {foundBorrower.department} · {(foundBorrower.role || 'STUDENT').toUpperCase()}
                      </p>
                    </div>
                  </div>

                  <div>
                    {isBlockedOverdue ? (
                      <span className="px-3 py-1 rounded-lg text-[11px] font-bold uppercase bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/40 flex items-center gap-1.5 shadow-2xs">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>BLOCKED (Rs. {borrowerTotalFine})</span>
                      </span>
                    ) : isQuotaReached ? (
                      <span className="px-3 py-1 rounded-lg text-[11px] font-bold uppercase bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/40 flex items-center gap-1.5 shadow-2xs">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>QUOTA FULL ({borrowerActiveLoans.length}/{maxAllowedQuota})</span>
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-lg text-[11px] font-bold uppercase bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 shadow-2xs">
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>ELIGIBLE</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* CR80 Live Printable Card Preview with .ulm-preserve-dark */}
                <div className="p-4 rounded-xl ulm-preserve-dark border border-[#BC881B]/40 relative overflow-hidden shadow-lg">
                  <img 
                    src={ULM_CREST_LOGO} 
                    alt="" 
                    aria-hidden="true" 
                    className="ulm-membercard-watermark absolute -right-2 -bottom-2 w-32 h-32 object-contain opacity-[0.10] pointer-events-none select-none"
                    style={{ clipPath: 'none' }}
                  />
                  <div className="flex items-start justify-between gap-3 relative z-10">
                    <div>
                      <span className="text-[10px] text-amber-400 font-mono block uppercase tracking-wider">
                        UNIVERSITY OF LAKKI MARWAT · CR80 CARD
                      </span>
                      <p className="font-serif font-bold text-lg text-amber-200 mt-0.5 leading-tight">
                        {foundBorrower.name}
                      </p>
                      <p className="text-xs text-slate-300 font-mono mt-0.5">
                        Roll: {foundBorrower.roll_number || foundBorrower.university_id || 'N/A'}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {foundBorrower.program || foundBorrower.department}
                      </p>
                    </div>
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      {foundBorrower.status || 'ACTIVE'}
                    </span>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between gap-3 relative z-10">
                    <div>
                      <span className="text-[9px] text-slate-400 font-mono block">CARD ACCESSION / BARCODE</span>
                      <span className="font-mono text-xs font-bold text-amber-300">
                        {foundBorrower.barcode || foundBorrower.university_id || 'ULM-STD-001'}
                      </span>
                    </div>
                    <div className="ulm-barcode-safepad px-2.5 py-1 flex items-center gap-1 select-none">
                      <BarcodeIcon className="w-3.5 h-3.5 text-black shrink-0" />
                      <span className="font-mono text-[11px] font-bold tracking-wider text-black">
                        {foundBorrower.barcode || foundBorrower.university_id || 'ULM-STD-001'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quota & Fine Metric Strip */}
                <div className="grid grid-cols-3 gap-2 text-center p-3 rounded-xl bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-white/10">
                  <div>
                    <span className="text-[10px] uppercase font-mono text-slate-500 dark:text-slate-400 block">Quota Used</span>
                    <p className="text-sm font-bold font-mono text-slate-900 dark:text-white">
                      {borrowerActiveLoans.length} / {maxAllowedQuota}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-mono text-slate-500 dark:text-slate-400 block">Overdue</span>
                    <p className={`text-sm font-bold font-mono ${borrowerOverdueCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {borrowerOverdueCount} Books
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-mono text-slate-500 dark:text-slate-400 block">Payable Fine</span>
                    <p className="text-sm font-bold font-mono text-[#BC881B] dark:text-[#E0B450]">
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
                    <span className="text-[10px] text-slate-500 font-mono">Policy: Rs. 10/day</span>
                  </div>

                  {borrowerActiveLoans.length === 0 ? (
                    <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-white/10 text-center text-xs text-slate-500">
                      Member has 0 books borrowed. Full quota available.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {borrowerActiveLoans.map(loan => {
                        const isOverdue = loan.due_date && loan.due_date < todayIso;
                        return (
                          <div 
                            key={loan.id} 
                            className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 text-xs ${
                              isOverdue 
                                ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-500/30' 
                                : 'bg-slate-50 dark:bg-[#0B1220] border-slate-200 dark:border-white/10'
                            }`}
                          >
                            <div className="truncate">
                              <p className="font-semibold text-slate-900 dark:text-white truncate text-xs">
                                {loan.book_name}
                              </p>
                              <span className="text-[10px] text-slate-500 font-mono">
                                Due: {loan.due_date} {isOverdue && '(OVERDUE)'}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => onQuickReturn(loan.id)}
                              className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors shrink-0"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Return</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-white/10 flex items-center justify-between">
                <button
                  type="button"
                  onClick={resetScanner}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer transition-colors"
                >
                  ← Scan Another Student or Book
                </button>
              </div>
            </div>

            {/* Right Column: "Which Book Does This Student Want?" (Scan Barcode or Search Title/Author) */}
            <div className="bg-white/95 dark:bg-[#151C2C] border-2 border-[#BC881B]/50 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-[#BC881B]" />
                    <h3 className="font-bold text-base text-slate-900 dark:text-white">
                      Which Book Does This Student Want?
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono text-[#BC881B] bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    Auto Loan-Duration Prompt
                  </span>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Scan book barcode or search by title/author. When selected, the <strong>Loan Duration Selector</strong> will automatically prompt for borrowing duration.
                </p>

                {/* Fast Scan Barcode / Search Input */}
                <form onSubmit={handleIssueBookToActiveBorrower} className="space-y-2">
                  <div className="relative">
                    <BarcodeIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#BC881B]" />
                    <input
                      ref={issueInputRef}
                      type="text"
                      value={issueBookInput}
                      onChange={(e) => {
                        setIssueBookInput(e.target.value);
                        setBookSearchForStudent(e.target.value);
                      }}
                      placeholder="Scan or enter book barcode (0092... / Acc # / ISBN)..."
                      className="w-full h-11 pl-9 pr-24 rounded-xl bg-slate-50 dark:bg-[#0B1220] border border-slate-300 dark:border-white/15 text-xs text-slate-900 dark:text-white font-mono placeholder:text-slate-400 focus:outline-none focus:border-[#BC881B]"
                    />
                    <button
                      type="submit"
                      disabled={isBlockedOverdue || isQuotaReached}
                      className={`absolute right-1.5 top-1.5 bottom-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                        isBlockedOverdue || isQuotaReached
                          ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                          : 'bg-[#BC881B] hover:bg-[#D4A02A] text-slate-950 cursor-pointer shadow-sm'
                      }`}
                    >
                      Prompt ↵
                    </button>
                  </div>
                </form>

                {issueMessage && (
                  <div className={`text-xs p-3 rounded-xl flex items-center gap-2 font-medium ${
                    issueMessage.type === 'success' 
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/15 dark:border-emerald-500/30 dark:text-emerald-300' 
                      : 'bg-rose-50 text-rose-800 border border-rose-300 dark:bg-rose-500/15 dark:border-rose-500/30 dark:text-rose-300'
                  }`}>
                    {issueMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                    <span>{issueMessage.text}</span>
                  </div>
                )}

                {/* Available Books List (Instant select to prompt duration) */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                    Available Catalog Volumes (1-Click Select):
                  </span>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {books
                      .filter(b => b.is_active && b.available_quantity > 0)
                      .filter(b => {
                        if (!bookSearchForStudent.trim()) return true;
                        const q = bookSearchForStudent.toLowerCase();
                        return (
                          b.book_name.toLowerCase().includes(q) ||
                          b.author.toLowerCase().includes(q) ||
                          b.barcode.toLowerCase().includes(q) ||
                          (b.accession_no && b.accession_no.toLowerCase().includes(q))
                        );
                      })
                      .slice(0, 8)
                      .map(b => (
                        <div
                          key={b.id}
                          onClick={() => !isBlockedOverdue && !isQuotaReached && handleSelectBookForStudent(b)}
                          className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 text-xs transition-all ${
                            isBlockedOverdue || isQuotaReached
                              ? 'opacity-60 cursor-not-allowed bg-slate-50 dark:bg-[#0B1220] border-slate-200'
                              : 'cursor-pointer hover:border-[#BC881B] hover:bg-amber-50/50 dark:hover:bg-[#BC881B]/10 bg-slate-50 dark:bg-[#0B1220] border-slate-200 dark:border-white/10'
                          }`}
                        >
                          <div className="truncate">
                            <p className="font-bold text-slate-900 dark:text-white truncate">{b.book_name}</p>
                            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono mt-0.5">
                              <span>by {b.author}</span>
                              <span>•</span>
                              <span>Acc: {b.accession_no || b.barcode}</span>
                              <span>•</span>
                              <span className="text-[#BC881B] font-semibold">{b.shelf || 'ALM-01'}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={isBlockedOverdue || isQuotaReached}
                            className="px-2.5 py-1 rounded-lg bg-[#BC881B] hover:bg-[#D4A02A] text-slate-950 font-bold text-[11px] shrink-0"
                          >
                            Select ↵
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- SCAN RESULTS: BOOK FOUND (MODE A: BOOK FIRST) ---------------- */}
        {scanState === 'BOOK_FOUND' && foundBook && (
          <div className="bg-white/95 dark:bg-[#151C2C] border-2 border-emerald-500/50 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4 animate-in fade-in duration-150 transition-colors">
            {/* Header: Status & Accession Barcode Info */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-white/10 pb-3">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm sm:text-base font-ui">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <span>Book Barcode Verified in Catalog</span>
              </div>
              <span className="text-xs font-mono text-slate-600 dark:text-[#B3AABD]">
                Accession: <strong className="text-slate-900 dark:text-white">{foundBook.accession_no || foundBook.barcode}</strong> · Barcode: <strong className="text-slate-900 dark:text-white">{foundBook.barcode}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              {/* Cover thumbnail */}
              <div className="w-32 h-44 rounded-xl bg-slate-900 border border-[#BC881B]/40 shadow-md relative overflow-hidden flex flex-col justify-between p-2.5 shrink-0 mx-auto md:mx-0">
                {foundBook.book_image_path ? (
                  <img
                    src={foundBook.book_image_path}
                    alt={foundBook.book_name}
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : null}
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#BC881B] z-10" />
                <div className="relative z-0 text-[10px] space-y-1">
                  <span className="text-[8px] font-mono text-[#BC881B] font-bold">ULM PRESS</span>
                  <p className="font-serif font-bold text-white line-clamp-3">{foundBook.book_name}</p>
                </div>
                <span className="relative z-0 text-[8.5px] font-mono text-amber-200">{foundBook.dewey_call_number}</span>
              </div>

              {/* Book Info */}
              <div className="md:col-span-3 space-y-3">
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-[#B3AABD]">
                    <span className="font-semibold text-[#BC881B]">{foundBook.category}</span>
                    <span>·</span>
                    <span className="font-mono">Dewey {foundBook.dewey_call_number}</span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-0.5 font-serif">
                    {foundBook.book_name}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-[#B3AABD]">
                    by <span className="font-medium text-slate-900 dark:text-white">{foundBook.author}</span> · {foundBook.edition} ({foundBook.publication_year})
                  </p>
                </div>

                {/* Copies & Location Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-50 dark:bg-[#0B1220] p-3 rounded-xl border border-slate-200 dark:border-white/10">
                  <div>
                    <span className="text-[10px] uppercase font-mono text-slate-500">Total Copies</span>
                    <p className="text-sm font-bold font-mono text-slate-900 dark:text-white mt-0.5">{foundBook.total_quantity}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-mono text-slate-500">Available on Shelf</span>
                    <p className={`text-sm font-bold font-mono mt-0.5 ${foundBook.available_quantity > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {foundBook.available_quantity} copies
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-mono text-slate-500">Almari / Shelf</span>
                    <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5 flex items-center gap-1 font-mono">
                      <MapPin className="w-3.5 h-3.5 text-[#BC881B]" />
                      <span>{foundBook.shelf || `${foundBook.almari_id || 'ALM-01'} · Shelf ${foundBook.shelf_no || 1}`}</span>
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-mono text-slate-500">Binding & Status</span>
                    <p className="text-xs font-semibold text-slate-900 dark:text-white mt-0.5 font-mono">
                      {foundBook.binding || 'HB'} · {foundBook.available_quantity > 0 ? 'AVAILABLE' : 'LOANED'}
                    </p>
                  </div>
                </div>

                {/* Active Loans if any */}
                {activeBookLoans.length > 0 && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-white/10 space-y-1.5">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Currently Loaned Copies ({activeBookLoans.length}):
                    </span>
                    <div className="space-y-1">
                      {activeBookLoans.map(loan => (
                        <div key={loan.id} className="flex items-center justify-between text-xs bg-white dark:bg-[#151C2C] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10">
                          <div>
                            <span className="font-semibold text-slate-900 dark:text-white">{loan.borrower_name}</span>
                            <span className="text-slate-500 ml-2 font-mono">({loan.student_id})</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-slate-500 font-mono">Due: {loan.due_date}</span>
                            <button
                              onClick={() => onQuickReturn(loan.id)}
                              className="px-2.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                            >
                              <RotateCcw className="w-2.5 h-2.5" />
                              <span>Return</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Inline Almari & Shelf Placement Panel */}
                {isPlacingInAlmari && (
                  <div className="p-3.5 rounded-xl bg-amber-50/60 dark:bg-[#131B2E] border border-amber-300 dark:border-[#BC881B]/40 space-y-3 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-[#BC881B]" />
                        <span>Place in Almari &amp; Shelf Location</span>
                      </span>
                      <button
                        onClick={() => setIsPlacingInAlmari(false)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1">
                          Almari Cupboard
                        </label>
                        <select
                          value={placementAlmari}
                          onChange={(e) => setPlacementAlmari(e.target.value)}
                          className="h-9 px-3 rounded-lg bg-white dark:bg-[#0B1220] border border-slate-300 dark:border-white/15 text-xs text-slate-900 dark:text-white font-mono focus:border-[#BC881B] outline-none"
                        >
                          <option value="ALM-01">ALM-01 — General Stacks</option>
                          <option value="ALM-02">ALM-02 — Computer Science</option>
                          <option value="ALM-03">ALM-03 — Engineering & Tech</option>
                          <option value="ALM-04">ALM-04 — Management & Commerce</option>
                          <option value="ALM-05">ALM-05 — Islamic & Oriental Studies</option>
                          <option value="ALM-06">ALM-06 — Reference & Archival</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1">
                          Shelf Row
                        </label>
                        <select
                          value={placementShelf}
                          onChange={(e) => setPlacementShelf(Number(e.target.value))}
                          className="h-9 px-3 rounded-lg bg-white dark:bg-[#0B1220] border border-slate-300 dark:border-white/15 text-xs text-slate-900 dark:text-white font-mono focus:border-[#BC881B] outline-none"
                        >
                          <option value={1}>Shelf 1 (Top Tier)</option>
                          <option value={2}>Shelf 2 (Eye Level)</option>
                          <option value={3}>Shelf 3 (Middle Tier)</option>
                          <option value={4}>Shelf 4 (Lower Tier)</option>
                          <option value={5}>Shelf 5 (Base Shelf)</option>
                        </select>
                      </div>

                      <div className="self-end">
                        <button
                          type="button"
                          onClick={handleSavePlacement}
                          className="h-9 px-4 rounded-lg bg-[#BC881B] hover:bg-[#D4A02A] text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Save Location ↵</span>
                        </button>
                      </div>
                    </div>

                    {placementSuccessMsg && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{placementSuccessMsg}</span>
                      </p>
                    )}
                  </div>
                )}

                {/* Chained Student Scan Panel */}
                {isChainedIssueActive && (
                  <div className="p-3.5 rounded-xl bg-purple-50/70 dark:bg-[#1A1028] border border-purple-300 dark:border-purple-500/40 space-y-2.5 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                        <ArrowRightLeft className="w-4 h-4 text-[#BC881B]" />
                        <span>Chained Issue: Scan Student ID Barcode or Search Member</span>
                      </span>
                      <button
                        onClick={() => setIsChainedIssueActive(false)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <form onSubmit={handleChainedStudentSubmit} className="flex gap-2">
                      <input
                        ref={chainedStudentInputRef}
                        type="text"
                        value={chainedStudentInput}
                        onChange={(e) => setChainedStudentInput(e.target.value)}
                        placeholder="Scan student ID card barcode (ULM-STD-...) or enter Roll # / Name..."
                        className="flex-1 h-10 px-3 rounded-lg bg-white dark:bg-[#0B1220] border border-purple-300 dark:border-purple-500/30 text-xs text-slate-900 dark:text-white font-mono placeholder:text-slate-400 focus:outline-none focus:border-[#BC881B]"
                      />
                      <button
                        type="submit"
                        className="h-10 px-4 rounded-lg bg-[#BC881B] hover:bg-[#D4A02A] text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm shrink-0"
                      >
                        <span>Prompt Loan Time ↵</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </form>

                    {chainedStudentError && (
                      <p className="text-xs text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>{chainedStudentError}</span>
                      </p>
                    )}
                  </div>
                )}

                {/* Mode A Primary Action Buttons */}
                <div className="flex flex-wrap items-center gap-2.5 pt-2">
                  {/* Action 1: [📤 Issue This Book] */}
                  <button
                    type="button"
                    onClick={() => {
                      if (foundBook.available_quantity <= 0 && activeBookLoans.length > 0) {
                        onQuickReturn(activeBookLoans[0].id);
                      } else {
                        setIsChainedIssueActive(!isChainedIssueActive);
                        setIsPlacingInAlmari(false);
                      }
                    }}
                    className={`px-4.5 py-2.5 rounded-xl text-xs font-bold tracking-wide flex items-center gap-2 transition-all cursor-pointer shadow-sm ${
                      foundBook.available_quantity > 0
                        ? 'bg-[#BC881B] hover:bg-[#D4A02A] text-slate-950'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                    <span>
                      {foundBook.available_quantity > 0 ? '📤 Issue This Book' : '📥 Return Book'}
                    </span>
                  </button>

                  {/* Action 2: [🗄️ Place in Almari & Shelf] */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsPlacingInAlmari(!isPlacingInAlmari);
                      setIsChainedIssueActive(false);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-white/15 text-xs font-semibold tracking-wide flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Layers className="w-4 h-4 text-[#BC881B]" />
                    <span>🗄️ Place in Almari &amp; Shelf</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenBookDetails(foundBook.id)}
                    className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-white/15 text-xs font-semibold tracking-wide flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Record</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onPrintBarcode(foundBook)}
                    className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-white/15 text-xs font-semibold tracking-wide flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-[#BC881B]" />
                    <span>Print Label</span>
                  </button>

                  <button
                    type="button"
                    onClick={resetScanner}
                    className="px-3.5 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 text-xs font-medium ml-auto transition-colors cursor-pointer"
                  >
                    Scan Another
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- SCAN RESULTS: NOT FOUND ---------------- */}
        {scanState === 'NOT_FOUND' && (
          <div className="bg-white/95 dark:bg-[#151C2C] border-2 border-rose-400 dark:border-rose-500/40 rounded-2xl p-6 shadow-sm space-y-3 text-center animate-in fade-in duration-150 transition-colors">
            <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 mx-auto">
              <XCircle className="w-5 h-5" />
            </div>

            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-serif">Unrecognized Barcode or Member Card</h3>
              <p className="text-xs text-slate-600 dark:text-[#B3AABD] mt-1 max-w-md mx-auto">
                No active book or registered borrower matches identifier <span className="font-mono font-bold text-[#BC881B]">{searchedBarcode}</span>. You can register this accession immediately.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => onOpenAddBookWithBarcode(searchedBarcode || '')}
                className="px-4 py-2 rounded-lg bg-[#BC881B] hover:bg-[#D4A02A] text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Register Book with this Barcode</span>
              </button>

              <button
                onClick={resetScanner}
                className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors cursor-pointer"
              >
                Scan Again
              </button>
            </div>
          </div>
        )}

        {/* ---------------- LOAN DURATION SELECTOR MODAL DIALOG ---------------- */}
        {isDurationSelectorOpen && pendingDurationTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
              {/* Header */}
              <div className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-[#BC881B] shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900 dark:text-white font-serif">
                      Loan Duration Selector
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      How much time does the student want this book?
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDurationSelectorOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Book & Borrower Summary */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-white/10 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Borrower:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{pendingDurationTarget.borrower.name}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Card ID / Roll:</span>
                  <span className="font-mono text-slate-900 dark:text-white">
                    {pendingDurationTarget.borrower.university_id || pendingDurationTarget.borrower.barcode}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Book:</span>
                  <span className="font-bold text-slate-900 dark:text-white truncate max-w-[220px]">
                    {pendingDurationTarget.book.book_name}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Accession:</span>
                  <span className="font-mono text-[#BC881B]">
                    {pendingDurationTarget.book.accession_no || pendingDurationTarget.book.barcode}
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
                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                        selectedDurationDays === preset.days
                          ? 'border-[#BC881B] bg-amber-50/70 dark:bg-[#BC881B]/20 ring-1 ring-[#BC881B]'
                          : 'border-slate-200 dark:border-white/10 hover:border-slate-300 bg-slate-50 dark:bg-[#0B1220]'
                      }`}
                    >
                      <span className="font-bold text-xs text-slate-900 dark:text-white block">
                        {preset.label}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                        {preset.desc}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Custom Days Input */}
                <div className="pt-1 flex items-center gap-2">
                  <span className="text-xs text-slate-600 dark:text-slate-400 shrink-0">Custom Days:</span>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={customDaysInput}
                    onChange={(e) => {
                      setCustomDaysInput(e.target.value);
                      const d = parseInt(e.target.value, 10);
                      if (!isNaN(d) && d > 0) setSelectedDurationDays(d);
                    }}
                    className="w-24 h-9 px-3 rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-300 dark:border-white/15 text-xs text-slate-900 dark:text-white font-mono focus:border-[#BC881B] outline-none"
                  />
                  <span className="text-xs text-slate-500">days</span>
                </div>
              </div>

              {/* Due Date & Overdue Policy Notice */}
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-[#BC881B]/10 border border-amber-200 dark:border-[#BC881B]/30 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] font-mono text-amber-800 dark:text-amber-300 block uppercase">Calculated Due Date</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                    {new Date(Date.now() + selectedDurationDays * 86400000).toISOString().split('T')[0]}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-mono text-slate-500 block">Overdue Fine</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">Rs. 10 / day</span>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setIsDurationSelectorOpen(false)}
                  className="px-4 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmittingLoan}
                  onClick={handleConfirmIssueLoan}
                  className="px-5 h-10 rounded-xl bg-[#BC881B] hover:bg-[#D4A02A] text-slate-950 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-md transition-all"
                >
                  <Check className="w-4 h-4" />
                  <span>Confirm Issue ↵</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default BarcodeScannerView;
