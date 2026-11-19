import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  Trash2,
  X,
  Archive,
  AlertOctagon,
  ShieldAlert,
} from 'lucide-react';
import { Book, Transaction } from '../../types/library';

interface DeleteBookConfirmModalProps {
  book: Book | null;
  transactions: Transaction[];
  isOpen: boolean;
  onClose: () => void;
  onConfirmDelete: (bookId: string, permanent: boolean, forceCloseActiveLoan?: boolean) => void;
}

export const DeleteBookConfirmModal: React.FC<DeleteBookConfirmModalProps> = ({
  book,
  transactions,
  isOpen,
  onClose,
  onConfirmDelete,
}) => {
  const [isPermanent, setIsPermanent] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');
  const [forceCloseChecked, setForceCloseChecked] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIsPermanent(false);
      setConfirmInput('');
      setForceCloseChecked(false);
      return;
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !book || typeof document === 'undefined') return null;

  // Detect active loans by both copy ID AND barcode
  const bookBarcode = String(book.barcode || '').trim();
  const activeLoans = transactions.filter((t) => {
    const isReturned = String(t.status || '').toUpperCase() === 'RETURNED' || Boolean(t.return_date);
    if (isReturned) return false;
    return (
      t.book_id === book.id ||
      (bookBarcode !== '' && t.barcode && String(t.barcode).trim() === bookBarcode)
    );
  });
  const hasActiveLoans = activeLoans.length > 0 || Boolean(book.is_checked_out);
  const primaryLoan = activeLoans[0];

  const isPermanentBlocked = isPermanent && confirmInput.trim().toUpperCase() !== 'DELETE';
  const isDeleteDisabled = (hasActiveLoans && !forceCloseChecked) || isPermanentBlocked;

  const handleDelete = () => {
    if (isDeleteDisabled) return;
    onConfirmDelete(book.id, isPermanent, hasActiveLoans && forceCloseChecked);
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 modal-backdrop ulm-modal-backdrop bg-slate-900/35 dark:bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="ulm-preserve-glass w-full max-w-lg rounded-[26px] bg-gradient-to-br from-white/90 via-white/80 to-white/65 dark:from-[#1A102E]/95 dark:via-[#140C24]/92 dark:to-[#0F081C]/90 backdrop-blur-2xl border border-rose-300/70 dark:border-rose-500/45 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150 text-slate-900 dark:text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-rose-500/10 dark:bg-rose-950/40 border-b border-rose-200/70 dark:border-rose-500/25 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-rose-700 dark:text-rose-300 font-semibold">
            <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center">
              <Trash2 className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                Delete Volume from Catalog
              </h3>
              <p className="text-[11px] text-rose-700 dark:text-rose-300 font-mono">
                Catalog De-Registration Guard
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-200/70 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/20 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 overflow-y-auto">
          {/* Book Summary Card */}
          <div className="flex gap-4 p-3.5 bg-white/65 dark:bg-black/35 rounded-2xl border border-slate-200/80 dark:border-white/10">
            <div
              data-preserve-dark="true"
              className="ulm-dark-plaque w-14 h-20 shrink-0 rounded-lg overflow-hidden bg-gradient-to-br from-[#2A0845] to-[#120420] border border-[#FFD147]/35 shadow-sm relative flex flex-col justify-between p-1.5"
            >
              {book.book_image_path ? (
                <img
                  src={book.book_image_path}
                  alt={book.book_name || 'Book cover'}
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
                <span data-preserve-white="true" className="text-[7.5px] font-bold !text-white line-clamp-3">
                  {book.book_name || 'Untitled Volume'}
                </span>
                <span className="text-[6.5px] font-mono text-slate-300">
                  {book.dewey_call_number || 'GEN'}
                </span>
              </div>
            </div>

            <div className="flex-1 min-w-0 flex flex-col justify-between">
              <div>
                <p className="text-[11px] font-semibold text-[#8A4B00] dark:text-[#FFD147]">
                  {book.category || 'General'}
                </p>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 line-clamp-2 leading-snug">
                  {book.book_name || 'Untitled Volume'}
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 truncate mt-0.5">
                  by <span className="font-medium">{book.author || 'Unknown Author'}</span>
                </p>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400 font-mono tabular-nums mt-1.5 flex-wrap">
                <span>
                  Barcode: <strong className="text-slate-900 dark:text-white">{book.barcode || '—'}</strong>
                </span>
                {book.accession_no && (
                  <>
                    <span>·</span>
                    <span>Acc #{book.accession_no}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Active Loans Guard with Optional Force-Close Loan & Delete */}
          {hasActiveLoans && (
            <div className="p-4 bg-amber-500/12 border border-amber-500/40 rounded-2xl space-y-3">
              <div className="flex items-start gap-2.5 text-amber-900 dark:text-amber-200">
                <AlertOctagon className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div className="space-y-1">
                  <h5 className="text-xs font-extrabold uppercase tracking-wider">
                    Volume Currently Checked Out
                  </h5>
                  <p className="text-xs leading-relaxed">
                    This volume is currently issued to{' '}
                    <strong>{primaryLoan?.borrower_name || book.borrower_name || 'an active borrower'}</strong>.
                    Return it first at the Circulation Desk, or authorize a{' '}
                    <strong>Force-Close Loan &amp; Delete</strong> below for lost or damaged copies.
                  </p>
                </div>
              </div>

              {activeLoans.length > 0 && (
                <div className="space-y-1.5 pl-7">
                  {activeLoans.map((loan) => (
                    <div
                      key={loan.id}
                      className="flex items-center justify-between text-xs bg-white/70 dark:bg-black/40 px-3 py-1.5 rounded-xl border border-amber-500/30"
                    >
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {loan.borrower_name || 'Borrower'} ({loan.student_id || loan.borrower_id})
                      </span>
                      <span className="font-mono text-[11px] text-amber-800 dark:text-amber-300 tabular-nums">
                        Due: {loan.due_date || '—'}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-white/70 dark:bg-black/45 border border-rose-500/35 cursor-pointer">
                <input
                  type="checkbox"
                  checked={forceCloseChecked}
                  onChange={(e) => setForceCloseChecked(e.target.checked)}
                  className="mt-0.5 accent-rose-600 cursor-pointer"
                />
                <span className="text-xs text-slate-800 dark:text-slate-200 leading-snug">
                  <strong className="text-rose-700 dark:text-rose-300">Force-Close Active Loan &amp; Delete:</strong>{' '}
                  Automatically mark the active loan closed, record an audit log entry, and proceed with removing this volume.
                </span>
              </label>
            </div>
          )}

          {/* Deletion Mode Selector */}
          <div className="space-y-2.5">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Choose deletion mode for this catalog record:
            </p>

            <label
              className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                !isPermanent
                  ? 'bg-amber-500/12 border-amber-500/45 shadow-2xs'
                  : 'bg-white/55 dark:bg-black/30 border-slate-200/80 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
              }`}
            >
              <input
                type="radio"
                name="deleteMode"
                checked={!isPermanent}
                onChange={() => setIsPermanent(false)}
                className="mt-0.5 accent-amber-600"
              />
              <div className="space-y-0.5 flex-1 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                  <Archive className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Archive &amp; Remove from Catalog (Recommended)</span>
                </div>
                <p className="text-[11.5px] text-slate-600 dark:text-slate-400 leading-normal">
                  Removes this copy from active catalog &amp; shelves while preserving historical loan &amp; audit logs.
                </p>
              </div>
            </label>

            <label
              className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                isPermanent
                  ? 'bg-rose-500/12 border-rose-500/50 shadow-2xs'
                  : 'bg-white/55 dark:bg-black/30 border-slate-200/80 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
              }`}
            >
              <input
                type="radio"
                name="deleteMode"
                checked={isPermanent}
                onChange={() => setIsPermanent(true)}
                className="mt-0.5 accent-rose-600"
              />
              <div className="space-y-0.5 flex-1 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-rose-700 dark:text-rose-300">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                  <span>Permanent Database Purge</span>
                </div>
                <p className="text-[11.5px] text-slate-600 dark:text-slate-400 leading-normal">
                  Permanently wipes this copy record from IndexedDB. Accession number stays withdrawn and cannot be undone.
                </p>
              </div>
            </label>

            {isPermanent && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl space-y-1.5 animate-in fade-in duration-150">
                <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700 dark:text-rose-300">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Permanent Purge Safeguard</span>
                </div>
                <p className="text-[11px] text-slate-700 dark:text-slate-300">
                  Type{' '}
                  <code className="px-1.5 py-0.5 bg-rose-100 dark:bg-rose-950 font-mono font-bold text-rose-800 dark:text-rose-300 rounded">
                    DELETE
                  </code>{' '}
                  to confirm:
                </p>
                <input
                  type="text"
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  placeholder="Type DELETE to confirm"
                  className="w-full bg-white/85 dark:bg-black/50 border border-rose-300 dark:border-rose-500/40 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-rose-500"
                />
              </div>
            )}
          </div>
        </div>

        {/* Action Footer */}
        <div className="px-6 py-4 bg-white/50 dark:bg-black/35 border-t border-slate-200/80 dark:border-white/10 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-900/5 hover:bg-slate-900/10 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleteDisabled}
            className={`px-5 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all shadow-md ${
              isDeleteDisabled
                ? 'bg-slate-200 dark:bg-white/10 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                : 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 !text-white cursor-pointer shadow-rose-600/30'
            }`}
          >
            <Trash2 className="w-4 h-4" />
            <span>
              {hasActiveLoans && forceCloseChecked
                ? isPermanent
                  ? 'Force-Close Loan & Purge'
                  : 'Force-Close Loan & Delete'
                : isPermanent
                  ? 'Purge Book Record'
                  : 'Confirm Delete Book'}
            </span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
