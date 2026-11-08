import React, { useEffect } from 'react';
import { 
  X, 
  BookOpen, 
  MapPin, 
  Barcode as BarcodeIcon, 
  Clock, 
  Edit3, 
  Printer, 
  ArrowRightLeft, 
  User, 
  CheckCircle2, 
  AlertTriangle,
  Trash2,
  Calendar
} from 'lucide-react';
import { Book, Transaction } from '../../types/library';
import { formatDisplayDate } from '../../utils/dateUtils';
import { isArabicOrUrduScript } from '../../utils/urduUtils';
import { AlmariService } from '../../services/almariService';
import { resolveBookAlmariAndShelf } from '../../services/libraryStorageAndMigration';

interface BookDetailsModalProps {
  book: Book | null;
  transactions: Transaction[];
  isOpen: boolean;
  onClose: () => void;
  onEdit: (book: Book) => void;
  onLoan: (book: Book) => void;
  onPrintBarcode: (book: Book) => void;
  onReturnLoan: (transactionId: string) => void;
  onDelete?: (book: Book) => void;
}

export const BookDetailsModal: React.FC<BookDetailsModalProps> = ({
  book,
  transactions,
  isOpen,
  onClose,
  onEdit,
  onLoan,
  onPrintBarcode,
  onReturnLoan,
  onDelete,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !book) return null;

  const isAvailable = book.available_quantity > 0;
  const activeLoans = transactions.filter(t => t.book_id === book.id && t.status !== 'RETURNED');
  const almaris = AlmariService.getAlmaris();
  const groups = AlmariService.getGroups();
  const resolvedPlacement = resolveBookAlmariAndShelf(book, almaris, groups);

  const renderBarcodeStrip = (code: string) => {
    return (
      <div 
        className="barcode-container flex items-center gap-[2px] h-10 px-3 py-1 bg-white rounded border border-slate-300 select-none shadow-xs"
        data-barcode-container="true"
      >
        {code.split('').map((char, idx) => {
          const num = parseInt(char, 10) || 3;
          const w = (num % 3) + 1.5;
          return (
            <div 
              key={idx} 
              className="barcode-bar h-full" 
              style={{ width: `${w}px`, backgroundColor: '#000000', minWidth: '1.5px' }} 
            />
          );
        })}
      </div>
    );
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-2xl bg-white/95 dark:bg-[#140D22]/95 backdrop-blur-2xl border-2 border-[#C8963E]/50 dark:border-white/15 text-slate-900 dark:text-white rounded-2xl shadow-[0_25px_70px_-15px_rgba(20,12,32,0.55)] overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top 24K Gold Accent Hairline */}
        <div className="h-[3px] w-full bg-gradient-to-r from-[#541A72] via-[#D49B27] to-[#541A72] shrink-0" />

        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-50/90 dark:bg-[#0D0917] border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-mono text-[#8A4B00] dark:text-[#FFD147] font-extrabold uppercase tracking-wider">
            <BookOpen className="w-4 h-4" />
            <span>Book Record Details · Accession #{book.accession_no || '1'}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white border border-slate-200 dark:border-white/10 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-5 flex-1 text-slate-900 dark:text-white">
          <div className="flex flex-col sm:flex-row gap-5">
            {/* Cover image or fallback */}
            <div 
              data-preserve-dark="true"
              className="w-36 h-52 rounded-xl ulm-preserve-dark shadow-xl relative overflow-hidden flex flex-col justify-between p-3 shrink-0 mx-auto sm:mx-0 bg-gradient-to-br from-[#2B1538] to-[#12091C] border border-[#C8963E]/50"
            >
              {book.book_image_path ? (
                <img
                  src={book.book_image_path}
                  alt={book.book_name}
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : null}
              <div className="absolute left-0 top-0 bottom-0 w-2.5 bg-gradient-to-r from-amber-700/80 via-amber-400 to-amber-700/40 z-10 shadow" />
              <div className="relative z-0 text-[10px] space-y-1 pl-1.5">
                <span className="text-[9px] font-mono-code text-amber-300 font-bold uppercase">ULM PRESS</span>
                <p data-preserve-white="true" className="font-header font-bold text-[#F1F5F9] text-xs leading-snug line-clamp-4">{book.book_name}</p>
              </div>
              <span className="relative z-0 text-[9px] font-mono-code text-slate-300 pl-1.5">{book.dewey_call_number}</span>
            </div>

            {/* Main Meta Details */}
            <div className="flex-1 space-y-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-md text-xs font-extrabold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                  {resolvedPlacement.displayGroup || book.category}
                </span>
                {(book.language === 'Urdu' || isArabicOrUrduScript(book.book_name)) ? (
                  <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    اردو · Nastaliq
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-md text-xs font-mono font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/15">
                    {book.language || 'English'}
                  </span>
                )}
                <span className="text-xs font-mono font-semibold text-slate-500 dark:text-slate-400">
                  {book.edition} · {book.publication_year}
                </span>
              </div>

              <h2 
                dir="auto"
                style={{ unicodeBidi: 'plaintext' }}
                className={`font-extrabold font-header text-slate-900 dark:text-white leading-snug ${
                  isArabicOrUrduScript(book.book_name) ? 'font-urdu text-2xl leading-[2.1] py-1' : 'text-xl'
                }`}
              >
                {book.book_name}
              </h2>
              {book.title_roman && (
                <p className="text-xs font-mono text-amber-700 dark:text-amber-400 font-semibold">
                  Roman Urdu: {book.title_roman}
                </p>
              )}

              <p 
                dir="auto"
                style={{ unicodeBidi: 'plaintext' }}
                className={`text-xs text-slate-600 dark:text-slate-300 ${
                  isArabicOrUrduScript(book.author) ? 'font-urdu text-base leading-[2]' : ''
                }`}
              >
                Author: <span className="font-bold text-slate-900 dark:text-white">{book.author}</span>
                {book.author_roman && (
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-mono ml-1.5">({book.author_roman})</span>
                )}
              </p>

              {book.publisher && (
                <p 
                  dir="auto"
                  style={{ unicodeBidi: 'plaintext' }}
                  className={`text-xs text-slate-600 dark:text-slate-400 ${
                    isArabicOrUrduScript(book.publisher) ? 'font-urdu leading-[2]' : ''
                  }`}
                >
                  Publisher: <span className="font-semibold text-slate-800 dark:text-slate-200">{book.publisher}</span>
                </p>
              )}

              {/* Physical Almari & Shelf Location */}
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-500/40 text-xs">
                <MapPin className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
                <span className="font-bold">Almari Placement:</span>
                <span className="font-mono font-extrabold">
                  {resolvedPlacement.almariCode ? `${resolvedPlacement.almariCode} (${resolvedPlacement.almariName}) · Shelf ${resolvedPlacement.shelfNo}` : resolvedPlacement.shelfLabel}
                </span>
              </div>

              {/* Dewey Call Number, ISBN & Date Added */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10">
                  <span className="text-[10px] uppercase font-mono text-slate-500 dark:text-slate-400 font-bold block">Dewey Class</span>
                  <span className="font-mono font-extrabold text-amber-700 dark:text-amber-400 truncate block">{book.dewey_call_number}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10">
                  <span className="text-[10px] uppercase font-mono text-slate-500 dark:text-slate-400 font-bold block">ISBN-13</span>
                  <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 break-all block">{book.isbn || 'N/A'}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10">
                  <span className="text-[10px] uppercase font-mono text-slate-500 dark:text-slate-400 font-bold block">Date Added</span>
                  <span className="font-mono text-amber-700 dark:text-[#FFD147] text-xs font-bold truncate flex items-center gap-1">
                    <Calendar className="w-3 h-3 shrink-0" />
                    {formatDisplayDate(book.date_added || book.created_at)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Barcode & Availability Bar */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-3 text-slate-900 dark:text-white">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-mono font-bold text-slate-500 dark:text-slate-400 block">Scannable Barcode Identifier</span>
              <div className="flex items-center gap-3">
                <span className="text-sm font-mono font-extrabold text-slate-900 dark:text-white tracking-widest">{book.barcode}</span>
                {renderBarcodeStrip(book.barcode)}
              </div>
            </div>

            <div className="flex items-center gap-5">
              <div className="text-right">
                <span className="text-[10px] uppercase font-mono font-bold text-slate-500 dark:text-slate-400 block">Total Stacks</span>
                <span className="text-base font-mono font-extrabold text-slate-900 dark:text-white tabular-nums">{book.total_quantity}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-mono font-bold text-slate-500 dark:text-slate-400 block">Available</span>
                <span className={`text-base font-mono font-extrabold tabular-nums ${isAvailable ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {book.available_quantity}
                </span>
              </div>
            </div>
          </div>

          {/* Description */}
          {book.description && (
            <div className="space-y-1.5">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">Catalog Abstract & Course Notes</span>
              <p 
                dir="auto"
                style={{ unicodeBidi: 'plaintext' }}
                className={`text-sm text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-white/[0.04] p-4 rounded-xl border border-slate-200 dark:border-white/10 ${
                  isArabicOrUrduScript(book.description) ? 'font-urdu leading-[2.1]' : ''
                }`}
              >
                {book.description}
              </p>
            </div>
          )}

          {/* Active Loans */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-extrabold text-slate-700 dark:text-slate-300">
                Active Circulation Checkouts ({activeLoans.length} of {book.total_quantity} {book.total_quantity === 1 ? 'copy' : 'copies'})
              </span>
            </div>

            {activeLoans.length === 0 ? (
              <p className="text-xs text-slate-600 dark:text-slate-400 italic bg-slate-50 dark:bg-white/[0.04] p-3 rounded-xl border border-slate-200 dark:border-white/10">
                {book.total_quantity === 1 ? '1 copy on shelf — available for loan.' : `All ${book.total_quantity} copies are currently on shelves and available for loan.`}
              </p>
            ) : (
              <div className="space-y-1.5">
                {activeLoans.map(loan => (
                  <div key={loan.id} className="flex items-center justify-between bg-slate-50 dark:bg-white/[0.04] p-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs">
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                      <span className="font-bold text-slate-900 dark:text-white">{loan.borrower_name}</span>
                      <span className="font-mono text-slate-500 dark:text-slate-400">({loan.student_id})</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-slate-600 dark:text-slate-400">Due: {loan.due_date}</span>
                      <button
                        onClick={() => onReturnLoan(loan.id)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] border border-emerald-300 dark:border-emerald-500/30 transition-colors cursor-pointer"
                      >
                        Return Copy
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Action Footer */}
        <div className="px-5 py-3.5 bg-slate-50/90 dark:bg-[#0D0917] border-t border-slate-200 dark:border-white/10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onEdit(book)}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-300 dark:border-white/15 shadow-2xs transition-colors cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Title</span>
            </button>
            <button
              onClick={() => onPrintBarcode(book)}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 dark:bg-white/10 dark:hover:bg-white/15 text-amber-800 dark:text-amber-300 text-xs font-bold flex items-center gap-1.5 border border-slate-300 dark:border-white/15 shadow-2xs transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Barcode</span>
            </button>
            {onDelete && (
              <button
                onClick={() => onDelete(book)}
                className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-1.5 border border-rose-200 dark:border-rose-500/30 transition-colors cursor-pointer"
                title="Delete or archive this book"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Book</span>
              </button>
            )}
          </div>

          <button
            onClick={() => onLoan(book)}
            disabled={!isAvailable}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer ${
              isAvailable
                ? 'bg-gradient-to-r from-[#541A72] to-[#3B1054] hover:from-[#65208A] hover:to-[#4A1568] text-white border border-[#FFD147]/45'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-slate-700'
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-[#FFD147]" />
            <span>Issue Copy</span>
          </button>
        </div>
      </div>
    </div>
  );
};

