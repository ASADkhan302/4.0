import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Building2, 
  Trash2, 
  AlertTriangle, 
  X, 
  Check, 
  ArrowRight,
  BookOpen,
  Clock,
  HelpCircle,
  ShieldAlert
} from 'lucide-react';
import { Almari, Book } from '../../types/library';
import { AlmariService } from '../../services/almariService';

export interface DeleteAlmariModalProps {
  almari: Almari;
  allBooks: Book[];
  isOpen: boolean;
  onClose: () => void;
  onConfirmDelete: (almariId: string, action: 'move' | 'unassign', targetAlmariId?: string) => void;
}

export const DeleteAlmariModal: React.FC<DeleteAlmariModalProps> = ({
  almari,
  allBooks,
  isOpen,
  onClose,
  onConfirmDelete,
}) => {
  const [action, setAction] = useState<'move' | 'unassign'>('unassign');
  const [targetAlmariId, setTargetAlmariId] = useState<string>('');
  const [hasConfirmedCheckbox, setHasConfirmedCheckbox] = useState(false);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);

  // Compute books placed in this almari
  const placedBooks = useMemo(() => {
    return allBooks.filter(b => b.is_active && b.almari_id === almari.id);
  }, [allBooks, almari.id]);

  // Compute on loan books
  const booksOnLoan = useMemo(() => {
    return placedBooks.filter(b => {
      const avail = b.available_quantity !== undefined ? b.available_quantity : b.total_quantity;
      return (b.total_quantity - avail) > 0;
    });
  }, [placedBooks]);

  const totalCopies = useMemo(() => {
    return placedBooks.reduce((sum, b) => sum + (b.total_quantity || 1), 0);
  }, [placedBooks]);

  // Available destination almaris with capacity left
  const availableAlmaris = useMemo(() => {
    const list = AlmariService.getAlmaris().filter(a => a.is_active && a.id !== almari.id);
    return list.map(a => {
      const bks = allBooks.filter(b => b.is_active && b.almari_id === a.id);
      const totalPlaced = bks.reduce((sum, b) => sum + (b.total_quantity || 1), 0);
      const cap = AlmariService.getAlmariTotalCapacity(a);
      const capacityLeft = Math.max(0, cap - totalPlaced);
      return {
        ...a,
        totalPlaced,
        totalCapacity: cap,
        capacityLeft,
      };
    });
  }, [allBooks, almari.id]);

  useEffect(() => {
    if (action === 'move' && !targetAlmariId && availableAlmaris.length > 0) {
      setTargetAlmariId(availableAlmaris[0].id);
    }
  }, [action, targetAlmariId, availableAlmaris]);

  if (!isOpen || typeof document === 'undefined') return null;

  const hasBooks = placedBooks.length > 0;
  const canDelete = !hasBooks || (hasConfirmedCheckbox && (action !== 'move' || Boolean(targetAlmariId)));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (hasBooks) {
      if (action === 'move' && (!targetAlmariId || availableAlmaris.length === 0)) {
        setBlockedMessage('Delete blocked: Please select a valid destination almari to receive the books.');
        return;
      }
      if (!hasConfirmedCheckbox) {
        setBlockedMessage(`Delete blocked: Please confirm the checkbox acknowledging that ${placedBooks.length} book(s) will be ${action === 'move' ? 'moved' : 'unassigned'}.`);
        return;
      }
    }
    setBlockedMessage(null);
    onConfirmDelete(almari.id, action, action === 'move' ? targetAlmariId : undefined);
  };

  return createPortal(
    <div 
      onClick={onClose}
      className="fixed inset-0 z-[9999] w-screen h-screen flex items-center justify-center p-4 bg-slate-900/35 dark:bg-[#090514]/80 backdrop-blur-xl backdrop-saturate-[180%] animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-almari-title"
    >
      <div 
        onClick={e => e.stopPropagation()}
        className="w-full max-w-[540px] rounded-[24px] p-6 bg-gradient-to-br from-white/95 via-white/90 to-white/85 dark:from-[#1C1132]/95 dark:via-[#140C26]/95 dark:to-[#0E081C]/95 backdrop-blur-2xl backdrop-saturate-[190%] border border-slate-200/90 dark:border-rose-500/30 shadow-[0_24px_64px_rgba(15,23,42,0.22)] dark:shadow-[0_24px_64px_rgba(0,0,0,0.75)] overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150 text-slate-900 dark:text-white"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 dark:border-white/[0.10]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-500/35 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 id="delete-almari-title" className="text-[16px] font-bold text-slate-900 dark:text-white leading-snug font-['Plus_Jakarta_Sans']">
                Delete {almari.name_en} - {almari.code}?
              </h3>
              <p className="text-[12px] text-slate-600 dark:text-slate-300 font-urdu" dir="auto">
                {almari.name_ur}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Scrollable Body */}
        <form onSubmit={handleSubmit} className="pt-4 overflow-y-auto space-y-4 text-[13px] pr-1">
          {/* Reassurance Banner: Books are NEVER deleted */}
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/35 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong className="text-amber-800 dark:text-amber-300 font-bold block mb-0.5">Books are NEVER deleted:</strong>
              Deleting this cupboard only removes the physical cupboard structure and shelves. All {placedBooks.length} titles and {totalCopies} copies remain safely in the catalog registry.
            </div>
          </div>

          {/* Impact Summary Metrics */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3 rounded-xl bg-white/75 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.10] text-center">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider block font-bold">Shelves</span>
              <span className="text-[18px] font-['Space_Grotesk'] font-bold tabular-nums text-slate-900 dark:text-white">{almari.shelf_count}</span>
            </div>
            <div className="p-3 rounded-xl bg-white/75 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.10] text-center">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider block font-bold">Placed Books</span>
              <span className={`text-[18px] font-['Space_Grotesk'] font-bold tabular-nums ${hasBooks ? 'text-amber-700 dark:text-amber-300' : 'text-slate-900 dark:text-white'}`}>
                {placedBooks.length} <span className="text-xs text-slate-500 dark:text-slate-400">({totalCopies} cps)</span>
              </span>
            </div>
            <div className="p-3 rounded-xl bg-white/75 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.10] text-center">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider block font-bold">On Loan</span>
              <span className={`text-[18px] font-['Space_Grotesk'] font-bold tabular-nums ${booksOnLoan.length > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
                {booksOnLoan.length}
              </span>
            </div>
          </div>

          {/* Placement Choice (if books exist) */}
          {hasBooks ? (
            <div className="space-y-3 pt-1">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 tracking-wide">
                Where should the {placedBooks.length} placed books go?
              </label>

              <div className="space-y-2.5">
                {/* Option A: Move to another Almari */}
                <label 
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                    action === 'move'
                      ? 'bg-amber-500/10 border-amber-500/40'
                      : 'bg-white/60 dark:bg-white/[0.03] border-slate-200/80 dark:border-white/[0.10]'
                  }`}
                >
                  <input
                    type="radio"
                    name="delete-action"
                    checked={action === 'move'}
                    onChange={() => {
                      setAction('move');
                      if (!targetAlmariId && availableAlmaris.length > 0) {
                        setTargetAlmariId(availableAlmaris[0].id);
                      }
                    }}
                    className="accent-amber-600 mt-1 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-slate-900 dark:text-white block">Move the books to another almari</span>
                    <span className="text-[12px] text-slate-600 dark:text-slate-300/85 block mt-0.5">
                      Transfers the books' placement into another active cupboard.
                    </span>

                    {action === 'move' && (
                      <div className="mt-3">
                        <select
                          value={targetAlmariId}
                          onChange={e => setTargetAlmariId(e.target.value)}
                          className="w-full h-9 px-3 bg-white dark:bg-[#19112D] border border-amber-500/50 rounded-xl text-[12px] font-mono font-bold text-slate-900 dark:text-white focus:outline-none cursor-pointer"
                        >
                          {availableAlmaris.map(a => (
                            <option key={a.id} value={a.id}>
                              {a.code} — {a.name_en} ({a.capacityLeft} slots available of {a.totalCapacity})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </label>

                {/* Option B: Leave Unassigned */}
                <label 
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                    action === 'unassign'
                      ? 'bg-amber-500/10 border-amber-500/40'
                      : 'bg-white/60 dark:bg-white/[0.03] border-slate-200/80 dark:border-white/[0.10]'
                  }`}
                >
                  <input
                    type="radio"
                    name="delete-action"
                    checked={action === 'unassign'}
                    onChange={() => setAction('unassign')}
                    className="accent-amber-600 mt-1 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block">Leave them unassigned (No almari)</span>
                    <span className="text-[12px] text-slate-600 dark:text-slate-300/85 block mt-0.5">
                      Books remain in the catalog and will appear under the "No Almari (Unassigned)" banner for future manual assignment.
                    </span>
                  </div>
                </label>
              </div>

              {/* Confirmation Checkbox */}
              <div className="pt-1">
                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-200 cursor-pointer text-xs font-bold">
                  <input
                    type="checkbox"
                    checked={hasConfirmedCheckbox}
                    onChange={e => {
                      setHasConfirmedCheckbox(e.target.checked);
                      if (blockedMessage) setBlockedMessage(null);
                    }}
                    className="accent-rose-600 w-4 h-4 cursor-pointer rounded"
                  />
                  <span>I understand the books will be {action === 'move' ? 'moved' : 'unassigned'} and this cupboard will be removed</span>
                </label>
              </div>
            </div>
          ) : (
            <p className="text-slate-600 dark:text-slate-300 text-xs font-medium">
              This cupboard is currently empty (0 books). Deleting it will mark it inactive and update campus capacity counters immediately.
            </p>
          )}

          {/* Blocked message notice */}
          {blockedMessage && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <span>{blockedMessage}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200/80 dark:border-white/[0.10]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-700 dark:text-white text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`px-5 h-10 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-2 cursor-pointer ${
                canDelete
                  ? 'bg-rose-600 hover:bg-rose-500 !text-white shadow-lg shadow-rose-600/30'
                  : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30'
              }`}
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Almari</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

