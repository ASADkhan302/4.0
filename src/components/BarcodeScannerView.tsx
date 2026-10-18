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
  Check
} from 'lucide-react';
import { Book, Transaction, Borrower } from '../types/library';
import { playSuccessBarcodeBeep, playErrorBeep } from '../services/audio';
import { LibraryStorage } from '../services/storage';

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

  const inputRef = useRef<HTMLInputElement>(null);
  const issueInputRef = useRef<HTMLInputElement>(null);

  // Auto focus input on mount and whenever returning to idle
  useEffect(() => {
    if (scanState === 'IDLE') {
      inputRef.current?.focus();
    } else if (scanState === 'BORROWER_FOUND') {
      issueInputRef.current?.focus();
    }
  }, [scanState]);

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
    setScanState('IDLE');
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
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

    if (onIssueBookToBorrower) {
      onIssueBookToBorrower(targetBook.id, foundBorrower.id);
    } else {
      LibraryStorage.issueBook(targetBook.id, foundBorrower.id, 14);
    }

    if (soundEnabled) playSuccessBarcodeBeep();
    setIssueMessage({
      type: 'success',
      text: `Successfully issued "${targetBook.book_name}" (Accession: ${targetBook.accession_no || targetBook.barcode}) to ${foundBorrower.name}!`,
    });
    setIssueBookInput('');
  };

  return (
    <div className="flex-1 w-full bg-[#0B1220] px-4 sm:px-6 lg:px-8 py-5 sm:py-6 overflow-y-auto space-y-6">
      <div className="max-w-[1280px] mx-auto space-y-6">

        {/* Top Header Card */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-[#151C2C] border border-[#BC881B]/30 rounded-xl p-4 sm:p-5 shadow-sm transition-colors">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2 font-display">
              <QrCode className="w-5 h-5 text-[#BC881B]" />
              <span>Barcode Scanner &amp; Hardware Station</span>
            </h2>
            <p className="text-xs text-[#B3AABD] mt-1 font-ui">
              Unified lookup: Scans both Book Barcodes and Student/Faculty Card IDs (e.g. ULM-STD-001, STD-...).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium font-ui transition-colors cursor-pointer ${
                soundEnabled 
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' 
                  : 'bg-white/[0.04] border-white/10 text-slate-400'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span>Chirp: {soundEnabled ? 'ON' : 'OFF'}</span>
            </button>

            <button
              onClick={() => setAutoSubmit(!autoSubmit)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium font-ui transition-colors cursor-pointer ${
                autoSubmit 
                  ? 'bg-[#BC881B]/20 border-[#BC881B]/40 text-[#E0B450]' 
                  : 'bg-white/[0.04] border-white/10 text-slate-400'
              }`}
            >
              <span>Auto-Enter: {autoSubmit ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </div>

        {/* Scanner Laser Input Centerpiece */}
        <div className={`bg-[#151C2C] border-2 border-white/10 focus-within:border-[#BC881B] rounded-2xl p-6 sm:p-8 shadow-sm relative overflow-hidden transition-all ${
          isScanSuccessFlash ? 'ring-4 ring-emerald-500/50' : ''
        }`}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="text-center space-y-1">
              <span className="text-xs font-mono font-bold text-[#E0B450] uppercase tracking-wider">
                POINT USB SCANNER OR TYPE BARCODE / MEMBER CARD ID
              </span>
              <p className="text-xs text-[#B3AABD] font-ui">
                Ready for Book Barcode (0092...) or Borrower ID (ULM-STD-..., ULM-FAC-...).
              </p>
            </div>

            <div className="max-w-xl mx-auto flex items-center bg-[#0B1220] border-2 border-[#BC881B]/40 focus-within:border-[#BC881B] focus-within:ring-2 focus-within:ring-[#BC881B]/20 rounded-xl p-1.5 transition-all shadow-md">
              <BarcodeIcon className="w-5 h-5 text-[#BC881B] ml-3 shrink-0 pointer-events-none" />
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
                className="flex-1 h-11 bg-transparent border-0 text-center text-base sm:text-lg font-mono font-bold text-white placeholder:text-slate-500 tracking-wider focus:outline-none focus:ring-0 px-3"
              />
              <button
                type="submit"
                className="h-10 px-5 rounded-lg bg-[#BC881B] hover:bg-[#D4A02A] active:bg-[#A87B16] text-[#0B1220] font-bold text-xs flex items-center gap-2 shadow-sm tracking-wide transition-all cursor-pointer shrink-0 font-ui"
              >
                <Search className="w-3.5 h-3.5 text-[#0B1220] stroke-[2.5]" />
                <span>Lookup</span>
              </button>
            </div>
          </form>

          {/* Quick Test Barcodes */}
          <div className="mt-5 pt-4 border-t border-white/[0.08] flex flex-wrap items-center justify-center gap-2.5">
            <span className="text-[11px] font-mono text-[#B3AABD]">Quick Test Scans:</span>
            {activeBorrowersList.slice(0, 2).map(b => (
              <button
                key={b.id}
                onClick={() => handleTestScan(b.barcode || b.university_id || b.student_id)}
                className="px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-[11px] font-mono text-indigo-300 border border-indigo-500/30 tracking-wide transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <CreditCard className="w-3 h-3 text-indigo-400" />
                <span>Card: {b.barcode || b.university_id || b.name}</span>
              </button>
            ))}
            {books.slice(0, 2).map(b => (
              <button
                key={b.id}
                onClick={() => handleTestScan(b.barcode)}
                className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[11px] font-mono text-slate-300 border border-white/10 tracking-wide transition-colors cursor-pointer"
              >
                Book: {b.barcode} ({b.book_name.slice(0, 12)}...)
              </button>
            ))}
          </div>
        </div>

        {/* ---------------- SECTION 9: BORROWER STATUS CARD ---------------- */}
        {scanState === 'BORROWER_FOUND' && foundBorrower && (
          <div className="bg-[#151C2C] border-2 border-[#BC881B]/50 rounded-xl p-5 sm:p-6 shadow-xl space-y-5 animate-in fade-in duration-150">
            {/* Header: Member Identity & Status Badge */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-[#541A72]/40 border border-[#BC881B]/40 flex items-center justify-center text-[#E0B450] shrink-0 shadow-sm">
                  <GraduationCap className="w-6 h-6 stroke-[2]" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="text-base sm:text-lg font-bold text-white font-display">
                      {foundBorrower.name}
                    </h3>
                    <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-[#BC881B]/15 text-[#E0B450] border border-[#BC881B]/35">
                      Card ID: {foundBorrower.barcode || foundBorrower.university_id || foundBorrower.student_id}
                    </span>
                  </div>
                  <p className="text-xs text-[#B3AABD] font-ui mt-0.5">
                    Role: <strong className="text-white capitalize">{foundBorrower.role}</strong> · Dept: <strong className="text-white">{foundBorrower.department}</strong> · Program: {foundBorrower.program}
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              <div>
                {isBlockedOverdue ? (
                  <span className="px-3.5 py-1.5 rounded-lg text-xs font-bold font-ui uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/50 flex items-center gap-1.5 shadow-sm">
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                    <span>BLOCKED — OVERDUE FINE (Rs. {borrowerTotalFine})</span>
                  </span>
                ) : isQuotaReached ? (
                  <span className="px-3.5 py-1.5 rounded-lg text-xs font-bold font-ui uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/50 flex items-center gap-1.5 shadow-sm">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span>QUOTA REACHED ({borrowerActiveLoans.length} / {maxAllowedQuota})</span>
                  </span>
                ) : (
                  <span className="px-3.5 py-1.5 rounded-lg text-xs font-bold font-ui uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 flex items-center gap-1.5 shadow-sm">
                    <UserCheck className="w-4 h-4 text-emerald-400" />
                    <span>ELIGIBLE / ACTIVE</span>
                  </span>
                )}
              </div>
            </div>

            {/* Quota Meter & Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#0B1220] p-4 rounded-xl border border-white/[0.08]">
              <div>
                <span className="text-[11px] uppercase font-mono text-[#B3AABD] block">Active Loans</span>
                <p className="text-base font-bold font-mono text-white mt-0.5">
                  {borrowerActiveLoans.length} <span className="text-xs text-[#B3AABD] font-normal">/ {maxAllowedQuota} allowed</span>
                </p>
              </div>

              <div>
                <span className="text-[11px] uppercase font-mono text-[#B3AABD] block">Remaining Quota</span>
                <p className={`text-base font-bold font-mono mt-0.5 ${maxAllowedQuota - borrowerActiveLoans.length > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {Math.max(0, maxAllowedQuota - borrowerActiveLoans.length)} Books
                </p>
              </div>

              <div>
                <span className="text-[11px] uppercase font-mono text-[#B3AABD] block">Overdue Volumes</span>
                <p className={`text-base font-bold font-mono mt-0.5 ${borrowerOverdueCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {borrowerOverdueCount} Overdue
                </p>
              </div>

              <div>
                <span className="text-[11px] uppercase font-mono text-[#B3AABD] block">Total Payable Fine</span>
                <p className={`text-base font-bold font-mono mt-0.5 ${borrowerTotalFine > 0 ? 'text-rose-400' : 'text-[#E0B450]'}`}>
                  Rs. {borrowerTotalFine.toLocaleString()}
                </p>
              </div>
            </div>

            {/* FOCUSED: Scan Book Barcode to Issue Directly to this Member */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-[#541A72]/30 via-[#2A1338]/40 to-[#151C2C] border border-[#BC881B]/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white font-ui flex items-center gap-1.5">
                  <ArrowRightLeft className="w-4 h-4 text-[#BC881B]" />
                  <span>Scan Book Barcode to Issue to {foundBorrower.name}</span>
                </span>
                <span className="text-[11px] text-[#B3AABD] font-mono">14-Day Standard Campus Loan</span>
              </div>

              <form onSubmit={handleIssueBookToActiveBorrower} className="flex items-center gap-2">
                <div className="relative flex-1">
                  <BarcodeIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#BC881B]" />
                  <input
                    ref={issueInputRef}
                    type="text"
                    value={issueBookInput}
                    onChange={(e) => setIssueBookInput(e.target.value)}
                    placeholder="Scan or type book barcode (e.g. 0092... or ULM-00001) to issue now..."
                    className="w-full h-10 pl-9 pr-3 rounded-lg bg-[#0B1220] border border-white/15 text-xs text-white font-mono placeholder:text-slate-500 focus:outline-none focus:border-[#BC881B]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isBlockedOverdue || isQuotaReached}
                  className={`h-10 px-4 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 font-ui ${
                    isBlockedOverdue || isQuotaReached
                      ? 'bg-white/10 text-slate-500 cursor-not-allowed'
                      : 'bg-[#BC881B] hover:bg-[#D4A02A] text-[#0B1220] cursor-pointer shadow-md'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Issue Book</span>
                </button>
              </form>

              {issueMessage && (
                <div className={`text-xs p-2.5 rounded-lg flex items-center gap-2 font-medium ${
                  issueMessage.type === 'success' 
                    ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300' 
                    : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
                }`}>
                  {issueMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                  <span>{issueMessage.text}</span>
                </div>
              )}
            </div>

            {/* List of Books Currently Borrowed by this Member */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider font-ui flex items-center justify-between">
                <span>Currently Borrowed Volumes ({borrowerActiveLoans.length})</span>
                <span className="text-[11px] text-[#B3AABD] font-mono">Return fine: Rs. 10/day overdue</span>
              </h4>

              {borrowerActiveLoans.length === 0 ? (
                <div className="p-4 rounded-lg bg-[#0B1220] border border-white/[0.08] text-center text-xs text-[#B3AABD]">
                  No active loans. Member has 0 books borrowed and full quota available.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {borrowerActiveLoans.map(loan => {
                    const isOverdue = loan.due_date && loan.due_date < todayIso;
                    const bookRecord = books.find(b => b.id === loan.book_id);
                    return (
                      <div 
                        key={loan.id} 
                        className={`p-3 rounded-lg border flex flex-wrap items-center justify-between gap-3 text-xs transition-colors ${
                          isOverdue 
                            ? 'bg-rose-950/20 border-rose-500/30' 
                            : 'bg-[#0B1220] border-white/[0.08]'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <p className="font-semibold text-white text-[13px]">
                            {loan.book_name || bookRecord?.book_name || 'Book Volume'}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-[#B3AABD] font-mono">
                            <span>Accession: {bookRecord?.accession_no || loan.barcode || 'N/A'}</span>
                            <span>•</span>
                            <span>Barcode: {loan.barcode || bookRecord?.barcode}</span>
                            <span>•</span>
                            <span className={isOverdue ? 'text-rose-400 font-bold' : 'text-[#B3AABD]'}>
                              Due: {loan.due_date} {isOverdue && '(OVERDUE)'}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => onQuickReturn(loan.id)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Return Book</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-white/[0.08]">
              <button
                type="button"
                onClick={resetScanner}
                className="px-4 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 hover:text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
              >
                Scan Another Member or Book
              </button>
            </div>
          </div>
        )}

        {/* ---------------- SCAN RESULTS: BOOK FOUND ---------------- */}
        {scanState === 'BOOK_FOUND' && foundBook && (
          <div className="bg-[#151C2C] border border-emerald-500/40 rounded-xl p-5 sm:p-6 shadow-sm space-y-4 animate-in fade-in duration-150 transition-colors">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm sm:text-base font-ui">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span>Book Barcode Verified in Catalog</span>
              </div>
              <span className="text-xs font-mono text-[#B3AABD]">
                Accession: {foundBook.accession_no || foundBook.barcode} · Barcode: {foundBook.barcode}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              {/* Cover thumbnail */}
              <div className="w-32 h-44 rounded-lg bg-[#0B1220] border border-white/10 shadow-sm relative overflow-hidden flex flex-col justify-between p-2.5 shrink-0 mx-auto md:mx-0">
                {foundBook.book_image_path ? (
                  <img
                    src={foundBook.book_image_path}
                    alt={foundBook.book_name}
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : null}
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#BC881B] z-10" />
                <div className="relative z-0 text-[10px] space-y-1">
                  <span className="text-[8px] font-mono text-[#BC881B] font-bold">ULM PRESS</span>
                  <p className="font-display font-bold text-white line-clamp-3">{foundBook.book_name}</p>
                </div>
                <span className="relative z-0 text-[8.5px] font-mono text-[#B3AABD]">{foundBook.dewey_call_number}</span>
              </div>

              {/* Book Info */}
              <div className="md:col-span-3 space-y-3">
                <div>
                  <div className="flex items-center gap-2 text-xs text-[#B3AABD]">
                    <span className="font-semibold text-[#E0B450]">{foundBook.category}</span>
                    <span>·</span>
                    <span className="font-mono">Dewey {foundBook.dewey_call_number}</span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-white mt-1 font-display">
                    {foundBook.book_name}
                  </h3>
                  <p className="text-xs text-[#B3AABD]">
                    by <span className="font-medium text-white">{foundBook.author}</span> · {foundBook.edition} ({foundBook.publication_year})
                  </p>
                </div>

                {/* Copies Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-[#0B1220] p-3 rounded-lg border border-white/[0.08]">
                  <div>
                    <span className="text-[10px] uppercase font-mono text-[#B3AABD]">Total Copies</span>
                    <p className="text-sm font-bold font-mono text-white mt-0.5">{foundBook.total_quantity}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-mono text-[#B3AABD]">Available Now</span>
                    <p className={`text-sm font-bold font-mono mt-0.5 ${foundBook.available_quantity > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {foundBook.available_quantity} on shelf
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-mono text-[#B3AABD]">Almari / Shelf</span>
                    <p className="text-xs font-semibold text-white mt-0.5 flex items-center gap-1 font-mono">
                      <MapPin className="w-3 h-3 text-[#BC881B]" />
                      <span>{foundBook.shelf || 'ALM-01'}</span>
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-mono text-[#B3AABD]">Stack Row</span>
                    <p className="text-xs font-semibold text-white mt-0.5 font-mono">
                      Row {foundBook.row || '1'}
                    </p>
                  </div>
                </div>

                {/* Active Loans */}
                {activeBookLoans.length > 0 && (
                  <div className="p-3 rounded-lg bg-[#0B1220] border border-white/[0.08] space-y-2">
                    <span className="text-xs font-semibold text-slate-300">
                      Currently Loaned Copies ({activeBookLoans.length}):
                    </span>
                    <div className="space-y-1">
                      {activeBookLoans.map(loan => (
                        <div key={loan.id} className="flex items-center justify-between text-xs bg-[#151C2C] px-3 py-1.5 rounded border border-white/[0.08]">
                          <div>
                            <span className="font-semibold text-white">{loan.borrower_name}</span>
                            <span className="text-[#B3AABD] ml-2 font-mono">({loan.student_id})</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[#B3AABD] font-mono">Due: {loan.due_date}</span>
                            <button
                              onClick={() => onQuickReturn(loan.id)}
                              className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold text-[11px] border border-emerald-500/30 flex items-center gap-1 cursor-pointer"
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

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    onClick={() => onQuickLoan(foundBook)}
                    disabled={foundBook.available_quantity <= 0}
                    className={`px-5 py-2.5 rounded-xl text-xs font-bold tracking-wide flex items-center gap-2 transition-all font-ui ${
                      foundBook.available_quantity > 0
                        ? 'bg-[#BC881B] hover:bg-[#D4A02A] active:bg-[#A87B16] text-[#0B1220] cursor-pointer shadow-md'
                        : 'bg-white/10 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>Issue Loan</span>
                  </button>

                  <button
                    onClick={() => onOpenBookDetails(foundBook.id)}
                    className="px-4.5 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 text-xs font-semibold tracking-wide flex items-center gap-2 transition-colors cursor-pointer font-ui"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Record</span>
                  </button>

                  <button
                    onClick={() => onPrintBarcode(foundBook)}
                    className="px-4.5 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 text-xs font-semibold tracking-wide flex items-center gap-2 transition-colors cursor-pointer font-ui"
                  >
                    <Printer className="w-3.5 h-3.5 text-[#BC881B]" />
                    <span>Print Label</span>
                  </button>

                  <button
                    onClick={resetScanner}
                    className="px-4 py-2.5 rounded-xl hover:bg-white/[0.06] text-[#B3AABD] hover:text-white text-xs font-medium tracking-wide ml-auto transition-colors cursor-pointer font-ui"
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
          <div className="bg-[#151C2C] border border-rose-500/40 rounded-xl p-6 shadow-sm space-y-3 text-center animate-in fade-in duration-150 transition-colors">
            <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
              <XCircle className="w-5 h-5" />
            </div>

            <div>
              <h3 className="text-sm sm:text-base font-bold text-white font-display">Unrecognized Barcode or Member Card</h3>
              <p className="text-xs text-[#B3AABD] mt-1 max-w-md mx-auto font-ui">
                No active book or registered borrower matches identifier <span className="font-mono font-bold text-[#E0B450]">{searchedBarcode}</span>. You can register this accession immediately.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => onOpenAddBookWithBarcode(searchedBarcode || '')}
                className="px-4 py-2 rounded-lg bg-[#BC881B] hover:bg-[#D4A02A] text-[#0B1220] font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer font-ui"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Register Book with this Barcode</span>
              </button>

              <button
                onClick={resetScanner}
                className="px-3.5 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 hover:text-white text-xs font-medium transition-colors cursor-pointer font-ui"
              >
                Scan Again
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default BarcodeScannerView;
