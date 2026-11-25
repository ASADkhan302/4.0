import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  Trash2,
  X,
  Archive,
  AlertOctagon,
  ShieldAlert,
  BookOpen,
  Loader2,
} from 'lucide-react';
import { Book, Transaction } from '../../types/library';

interface DeleteBookConfirmModalProps {
  book?: Book | null;
  booksToDelete?: Book[];
  transactions: Transaction[];
  isOpen: boolean;
  onClose: () => void;
  onConfirmDelete: (
    book: Book,
    permanent: boolean,
    forceCloseActiveLoan?: boolean
  ) => Promise<void> | void;
  onConfirmBulkDelete?: (
    books: Book[],
    permanent: boolean,
    forceCloseActiveLoans?: boolean
  ) => Promise<void> | void;
}

export const DeleteBookConfirmModal: React.FC<DeleteBookConfirmModalProps> = ({
  book,
  booksToDelete,
  transactions,
  isOpen,
  onClose,
  onConfirmDelete,
  onConfirmBulkDelete,
}) => {
  const [isPermanent, setIsPermanent] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');
  const [forceCloseChecked, setForceCloseChecked] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const targetList = useMemo<Book[]>(() => {
    if (booksToDelete && booksToDelete.length > 0) return booksToDelete;
    if (book) return [book];
    return [];
  }, [book, booksToDelete]);

  const isBulkMode = targetList.length > 1;
  const primaryBook = targetList[0] || null;

  useEffect(() => {
    if (!isOpen) {
      setIsPermanent(false);
      setConfirmInput('');
      setForceCloseChecked(false);
      setIsDeleting(false);
      return;
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDeleting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, isDeleting]);

  const { activeLoans, checkedOutBooks } = useMemo(() => {
    const idSet = new Set(targetList.map((b) => String(b.id || '').trim()).filter(Boolean));
    const barcodeSet = new Set(
      targetList.map((b) => String(b.barcode || '').trim().toUpperCase()).filter(Boolean)
    );

    const matchedLoans = transactions.filter((t) => {
      const isReturned =
        String(t.status || '').toUpperCase() === 'RETURNED' || Boolean(t.return_date);
      if (isReturned) return false;
      const tBookId = String(t.book_id || '').trim();
      const tBarcode = String(t.barcode || '').trim().toUpperCase();
      return (
        (tBookId !== '' && idSet.has(tBookId)) ||
        (tBarcode !== '' && barcodeSet.has(tBarcode))
      );
    });

    const loanedIds = new Set(matchedLoans.map((l) => String(l.book_id || '').trim()));
    const loanedBarcodes = new Set(
      matchedLoans.map((l) => String(l.barcode || '').trim().toUpperCase())
    );

    const checkedOut = targetList.filter((b) => {
      const bId = String(b.id || '').trim();
      const bBc = String(b.barcode || '').trim().toUpperCase();
      const statusUpper = String((b as Book & { status?: string }).status || '').toUpperCase();
      return (
        Boolean(b.is_checked_out) ||
        statusUpper === 'ISSUED' ||
        statusUpper === 'CHECKED OUT' ||
        (b.available_copies !== undefined && Number(b.available_copies) === 0) ||
        (bId !== '' && loanedIds.has(bId)) ||
        (bBc !== '' && loanedBarcodes.has(bBc))
      );
    });

    return { activeLoans: matchedLoans, checkedOutBooks: checkedOut };
  }, [targetList, transactions]);

  if (!isOpen || targetList.length === 0 || typeof document === 'undefined') return null;

  const hasActiveLoans = activeLoans.length > 0 || checkedOutBooks.length > 0;
  const availableCount = Math.max(0, targetList.length - checkedOutBooks.length);
  const allCheckedOut = hasActiveLoans && availableCount === 0;
  const isPermanentBlocked = isPermanent && confirmInput.trim().toUpperCase() !== 'DELETE';
  const isDeleteDisabled =
    isDeleting ||
    isPermanentBlocked ||
    (!isBulkMode && hasActiveLoans && !forceCloseChecked) ||
    (isBulkMode && allCheckedOut && !forceCloseChecked);

  const handleDelete = async () => {
    if (isDeleteDisabled) return;
    const shouldForceClose = hasActiveLoans && forceCloseChecked;
    const isMassiveBatch = targetList.length > 200;

    if (isMassiveBatch) {
      // Close immediately so the full-screen BackgroundGradientAnimation overlay takes over cleanly
      onClose();
      if (isBulkMode && onConfirmBulkDelete) {
        void onConfirmBulkDelete(targetList, isPermanent, shouldForceClose);
      } else if (primaryBook) {
        void onConfirmDelete(primaryBook, isPermanent, shouldForceClose);
      }
      return;
    }

    setIsDeleting(true);
    try {
      if (isBulkMode && onConfirmBulkDelete) {
        await onConfirmBulkDelete(targetList, isPermanent, shouldForceClose);
      } else if (primaryBook) {
        await onConfirmDelete(primaryBook, isPermanent, shouldForceClose);
      }
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 modal-backdrop ulm-modal-backdrop bg-slate-900/35 dark:bg-slate-950/78 backdrop-blur-md"
      onClick={() => {
        if (!isDeleting) onClose();
      }}
    >
      <div
        className="ulm-modal-dialog ulm-preserve-glass w-full max-w-lg rounded-[24px] bg-gradient-to-br from-white/95 via-white/90 to-white/85 dark:from-[#1A102E]/95 dark:via-[#140C24]/95 dark:to-[#0F081C]/95 backdrop-blur-2xl border border-rose-300/70 dark:border-rose-500/40 shadow-[0_24px_70px_rgba(15,23,42,0.3)] dark:shadow-[0_24px_70px_rgba(0,0,0,0.82)] overflow-hidden flex flex-col max-h-[92vh] text-slate-900 dark:text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Crisp Architectural Top Header (Zero Oval Clipping) */}
        <div className="px-6 py-4 bg-rose-500/[0.09] dark:bg-rose-950/45 border-b border-rose-200/75 dark:border-rose-500/25 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/35 flex items-center justify-center shrink-0">
              <Trash2 className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white leading-tight truncate">
                {isBulkMode
                  ? `Delete ${targetList.length} Selected Volumes from Catalog`
                  : 'Delete Volume from Catalog'}
              </h3>
              <p className="text-[11px] text-rose-700 dark:text-rose-300 font-['JetBrains_Mono'] truncate mt-0.5">
                {isBulkMode
                  ? 'Bulk Catalog De-Registration Guard'
                  : 'Catalog De-Registration Guard'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-900/[0.06] hover:bg-slate-900/[0.12] dark:bg-white/[0.08] dark:hover:bg-white/[0.16] border border-slate-200/80 dark:border-white/[0.12] text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
          {/* Single or Multi-Book Summary Card */}
          {!isBulkMode && primaryBook ? (
            <div className="flex gap-4 p-3.5 bg-white/70 dark:bg-black/35 rounded-2xl border border-slate-200/80 dark:border-white/10">
              <div
                data-preserve-dark="true"
                className="ulm-dark-plaque w-14 h-20 shrink-0 rounded-xl overflow-hidden bg-gradient-to-br from-[#2A0845] to-[#120420] border border-[#FFD147]/35 shadow-sm relative flex flex-col justify-between p-1.5"
              >
                {primaryBook.book_image_path ? (
                  <img
                    src={primaryBook.book_image_path}
                    alt={primaryBook.book_name || 'Book cover'}
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : null}
                <div className="relative z-0 h-full flex flex-col justify-between text-[7px] leading-tight select-none">
                  <span className="font-mono text-[6.5px] text-[#FFD147] font-bold uppercase tracking-wider">
                    ULM
                  </span>
                  <span
                    data-preserve-white="true"
                    className="text-[7.5px] font-bold !text-white line-clamp-3"
                  >
                    {primaryBook.book_name || 'Untitled Volume'}
                  </span>
                  <span className="text-[6.5px] font-mono text-slate-300">
                    {primaryBook.dewey_call_number || 'GEN'}
                  </span>
                </div>
              </div>

              <div className="flex-1 min-w-0 flex flex-col justify-between">
                <div>
                  <p className="text-[11px] font-semibold text-[#8A4B00] dark:text-[#FFD147]">
                    {primaryBook.category || 'General'}
                  </p>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 line-clamp-2 leading-snug">
                    {primaryBook.book_name || 'Untitled Volume'}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 truncate mt-0.5">
                    by <span className="font-medium">{primaryBook.author || 'Unknown Author'}</span>
                  </p>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400 font-['JetBrains_Mono'] tabular-nums mt-1.5 flex-wrap">
                  <span>
                    Barcode:{' '}
                    <strong className="text-slate-900 dark:text-white">
                      {primaryBook.barcode || '—'}
                    </strong>
                  </span>
                  {primaryBook.accession_no && (
                    <>
                      <span>·</span>
                      <span>Acc #{primaryBook.accession_no}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-white/70 dark:bg-black/35 rounded-2xl border border-slate-200/80 dark:border-white/10 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-rose-500" />
                  <span>{targetList.length} Volumes Selected for Removal</span>
                </span>
                <span className="px-2 py-0.5 rounded-md bg-rose-500/15 border border-rose-400/35 font-['JetBrains_Mono'] text-[10.5px] font-bold text-rose-700 dark:text-rose-300">
                  BULK ACTION
                </span>
              </div>
              <div className="max-h-28 overflow-y-auto custom-scrollbar divide-y divide-slate-200/60 dark:divide-white/[0.08] pr-1">
                {targetList.slice(0, 12).map((b) => (
                  <div
                    key={b.id || b.barcode}
                    className="py-1.5 flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {b.book_name || 'Untitled Volume'}
                    </span>
                    <span className="font-['JetBrains_Mono'] text-[10.5px] text-slate-500 dark:text-slate-400 shrink-0">
                      #{b.accession_no || b.barcode}
                    </span>
                  </div>
                ))}
                {targetList.length > 12 && (
                  <p className="pt-1.5 text-[11px] font-['JetBrains_Mono'] text-slate-500 dark:text-slate-400">
                    + {targetList.length - 12} additional volumes
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Active Loans Guard with Optional Force-Close Loan & Delete */}
          {hasActiveLoans && (
            <div className="p-4 bg-amber-500/12 border border-amber-500/40 rounded-2xl space-y-3">
              <div className="flex items-start gap-2.5 text-amber-900 dark:text-amber-200">
                <AlertOctagon className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div className="space-y-1">
                  <h5 className="text-xs font-extrabold uppercase tracking-wider">
                    {checkedOutBooks.length === 1
                      ? 'Volume Currently Checked Out'
                      : `${checkedOutBooks.length} Selected Volumes Currently Checked Out`}
                  </h5>
                  <p className="text-xs leading-relaxed">
                    Return checked-out copies first at the Circulation Desk, or authorize{' '}
                    <strong>Force-Close Active Loan(s) &amp; Delete</strong> below for lost or damaged items.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5 pl-7 max-h-28 overflow-y-auto custom-scrollbar">
                {checkedOutBooks.map((cb) => {
                  const loan = activeLoans.find(
                    (l) =>
                      l.book_id === cb.id ||
                      (cb.barcode && l.barcode && String(l.barcode).trim() === String(cb.barcode).trim())
                  );
                  return (
                    <div
                      key={cb.id || cb.barcode}
                      className="flex items-center justify-between gap-2 text-xs bg-white/75 dark:bg-black/40 px-3 py-1.5 rounded-xl border border-amber-500/30"
                    >
                      <span className="font-semibold text-slate-900 dark:text-white truncate">
                        {cb.book_name} ({loan?.borrower_name || cb.borrower_name || 'Checked Out'})
                      </span>
                      <span className="font-['JetBrains_Mono'] text-[11px] text-amber-800 dark:text-amber-300 tabular-nums shrink-0">
                        Due: {loan?.due_date || '—'}
                      </span>
                    </div>
                  );
                })}
              </div>

              <label className="!flex !mb-0 items-start gap-2.5 p-3 rounded-xl bg-white/75 dark:bg-black/45 border border-rose-500/35 cursor-pointer">
                <input
                  type="checkbox"
                  checked={forceCloseChecked}
                  onChange={(e) => setForceCloseChecked(e.target.checked)}
                  className="mt-0.5 accent-rose-600 cursor-pointer shrink-0"
                />
                <span className="text-xs text-slate-800 dark:text-slate-200 leading-snug">
                  <strong className="text-rose-700 dark:text-rose-300">
                    Force-Close Active Loan(s) &amp; Delete:
                  </strong>{' '}
                  Automatically mark active loan(s) closed, record an audit log entry, and proceed with removing{' '}
                  {isBulkMode ? 'these volumes' : 'this volume'}.
                </span>
              </label>
            </div>
          )}

          {/* Deletion Mode Selector (Crisp rounded-2xl Radio Cards) */}
          <div className="space-y-2.5">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Choose deletion mode for {isBulkMode ? `these ${targetList.length} records` : 'this catalog record'}:
            </p>

            <label
              className={`!flex !mb-0 items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                !isPermanent
                  ? 'bg-amber-500/12 border-amber-500/45 shadow-2xs'
                  : 'bg-white/60 dark:bg-white/[0.03] border-slate-200/80 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
              }`}
            >
              <input
                type="radio"
                name="deleteMode"
                checked={!isPermanent}
                onChange={() => setIsPermanent(false)}
                className="mt-0.5 accent-amber-600 shrink-0"
              />
              <div className="space-y-0.5 flex-1 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                  <Archive className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>Archive &amp; Remove from Catalog (Recommended)</span>
                </div>
                <p className="text-[11.5px] text-slate-600 dark:text-slate-400 leading-normal font-normal">
                  Removes {isBulkMode ? 'selected copies' : 'this copy'} from active catalog, shelves, and Master Excel while preserving historical audit logs.
                </p>
              </div>
            </label>

            <label
              className={`!flex !mb-0 items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                isPermanent
                  ? 'bg-rose-500/12 border-rose-500/50 shadow-2xs'
                  : 'bg-white/60 dark:bg-white/[0.03] border-slate-200/80 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
              }`}
            >
              <input
                type="radio"
                name="deleteMode"
                checked={isPermanent}
                onChange={() => setIsPermanent(true)}
                className="mt-0.5 accent-rose-600 shrink-0"
              />
              <div className="space-y-0.5 flex-1 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-rose-700 dark:text-rose-300">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                  <span>Permanent Database Purge</span>
                </div>
                <p className="text-[11.5px] text-slate-600 dark:text-slate-400 leading-normal font-normal">
                  Permanently wipes {isBulkMode ? 'these records' : 'this copy record'} from IndexedDB and all local storage mirrors. Cannot be undone.
                </p>
              </div>
            </label>

            {/* Clean Architectural Safeguard Box (rounded-2xl, zero oval border!) */}
            {isPermanent && (
              <div className="rounded-2xl p-4 bg-rose-500/10 border border-rose-400/35 space-y-2 animate-in fade-in duration-150">
                <div className="flex items-center gap-2 text-xs font-bold text-rose-700 dark:text-rose-300">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>Permanent Purge Safeguard</span>
                </div>
                <p className="text-[11.5px] text-slate-700 dark:text-slate-300">
                  Type{' '}
                  <code className="px-1.5 py-0.5 bg-rose-500/15 border border-rose-400/35 font-['JetBrains_Mono'] font-bold text-rose-800 dark:text-rose-200 rounded-md">
                    DELETE
                  </code>{' '}
                  to confirm permanent removal:
                </p>
                <input
                  type="text"
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  placeholder="Type DELETE to confirm"
                  autoFocus
                  className="ulm-compact-control w-full h-10 px-3.5 rounded-xl bg-white/90 dark:bg-[#110A20]/90 border border-rose-400/45 text-xs font-['JetBrains_Mono'] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-rose-500"
                />
              </div>
            )}
          </div>
        </div>

        {/* Action Footer */}
        <div className="px-6 py-4 bg-white/60 dark:bg-black/35 border-t border-slate-200/80 dark:border-white/10 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="h-10 px-5 rounded-xl bg-slate-900/[0.06] hover:bg-slate-900/[0.11] dark:bg-white/[0.08] dark:hover:bg-white/[0.14] border border-slate-200/80 dark:border-white/[0.12] text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={isDeleteDisabled}
            className={`h-10 px-5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all shadow-md ${
              isDeleteDisabled
                ? 'bg-slate-200 dark:bg-white/10 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                : 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 !text-white cursor-pointer shadow-rose-600/30'
            }`}
          >
            {isDeleting ? (
              <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4 shrink-0" />
            )}
            <span>
              {isDeleting
                ? 'Deleting & Syncing...'
                : hasActiveLoans && forceCloseChecked
                  ? isPermanent
                    ? isBulkMode
                      ? `Force-Close & Purge (${targetList.length} Books)`
                      : 'Force-Close Loan & Purge'
                    : isBulkMode
                      ? `Force-Close & Delete (${targetList.length} Books)`
                      : 'Force-Close Loan & Delete'
                  : isBulkMode && hasActiveLoans && availableCount > 0
                    ? isPermanent
                      ? `Purge ${availableCount} Available Books`
                      : `Confirm Delete (${availableCount} Available)`
                    : isPermanent
                      ? isBulkMode
                        ? `Purge ${targetList.length} Books`
                        : 'Purge Permanently'
                      : isBulkMode
                        ? `Confirm Delete (${targetList.length} Books)`
                        : 'Confirm Delete Book'}
            </span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
