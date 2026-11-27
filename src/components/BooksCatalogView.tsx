import React, { useState, useMemo, useEffect, useRef, useDeferredValue, useCallback, useTransition } from 'react';
import { createPortal } from 'react-dom';
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
  ChevronDown,
  Building2,
  Calendar,
  RotateCcw,
  X,
} from 'lucide-react';
import { Book, Transaction, NavigationTab } from '../types/library';
import { CatalogVisualAnalytics } from './library/CatalogVisualAnalytics';
import { AlmariView } from './AlmariView';
import { BulkAssignModal } from './modals/BulkAssignModal';
import { AlmariService } from '../services/almariService';
import { AccessionSeriesEngine } from '../services/accessionSeriesEngine';
import { LibraryStorage, reconcileBooksWithLoans } from '../services/storage';
import { parseSerialNumber, syncMasterExcelRegister } from '../services/libraryStorageAndMigration';
import { sortBooksCatalog } from '../utils/almariSortUtils';
import { isArabicOrUrduScript, matchesUrduSearch } from '../utils/urduUtils';
import { LiquidGlassCard } from './ui/liquid-weather-glass';
import { LiquidPillOverlay, LiquidIconFx } from './ui/liquid-pill-physics';
import { notifyGlassToast } from './ui/LiquidGlassToast';
import { runHeavyLibraryTask } from '../utils/heavyTaskRunner';
import { AnimatedCounter } from './ui/MotionPrimitives';

interface CatalogGlassOption {
  value: string;
  label: string;
}

const SORT_OPTIONS: CatalogGlassOption[] = [
  { value: 'newest', label: 'Sort: Newest' },
  { value: 'title', label: 'Sort: Title' },
  { value: 'author', label: 'Sort: Author' },
  { value: 'accession', label: 'Sort: Accession' },
  { value: 'almari_order', label: 'Sort: Almari' },
  { value: 'dewey_decimal', label: 'Sort: Dewey Call #' },
];

const STATUS_OPTIONS: CatalogGlassOption[] = [
  { value: 'all', label: 'All Copies' },
  { value: 'AVAILABLE', label: 'Available Now' },
  { value: 'LOANED', label: 'Fully Loaned' },
];

interface IndexedCatalogBook {
  book: Book;
  bookKey: string;
  searchBlob: string;
  category: string;
  language: string;
  languageLower: string;
  isUrduTitle: boolean;
  isUrduTitleOrAuthor: boolean;
  isCheckedOut: boolean;
  isAvailable: boolean;
  almariId: string;
  almariCode: string;
  shelfNo: number;
  shelfLabel: string;
  groupId: string;
  bookDate: string;
  accessionNum: number;
}

const RE_CS = /computer|software|programming|algorithm|data|network|cyber|ai|artificial|system|it\b|tech/i;
const RE_SCI = /math|calculus|algebra|geometry|statistic|physics|quantum|mechanics|chemistry|organic|biology|botany|zoology|science/i;
const RE_PHY = /physics/i;
const RE_CHEM = /chem|engineer/i;
const RE_ISL = /islam|quran|hadith|fiqh|seerah|tafseer|arabic|history|philosophy|sociology|political|humanities|اسلام/i;
const RE_LIT = /urdu|pashto|persian|literature|poetry|novel|linguistics|english literature|اردو|پشتو|فارسی/i;
const RE_LIT_LANG = /^(urdu|pashto|persian|arabic)$/i;
const RE_PASHTO = /pashto|پشتو/i;
const RE_LAW_EDU = /law|legal|constitution|governance|education|teaching|economics|business|management|commerce|reference|encyclopedia/i;
const RE_LAW = /law|legal|constitution/i;
const RE_EDU = /education|teaching/i;
const RE_GENERIC_PLACEHOLDER = /^(stack[-_\s]?0?1|cs[-_\s]?rack[-_\s]?0?1|unassigned.*|no\s*almari.*)$/i;
const RE_SHELF_NUM = /(?:shelf|row|s)[-_\s#]*(\d+)/i;
const RE_ROW_NUM = /(\d+)/;
const RE_DIGITS_ONLY = /^\d+$/;

interface CatalogGlassDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: CatalogGlassOption[];
  minWidthClass?: string;
  maxWidthClass?: string;
  compact?: boolean;
  ariaLabel?: string;
}

const CatalogGlassDropdown: React.FC<CatalogGlassDropdownProps> = React.memo(({
  value,
  onChange,
  options,
  minWidthClass = 'min-w-[136px]',
  maxWidthClass = 'max-w-[172px]',
  compact = false,
  ariaLabel,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 188,
  });

  const updatePos = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const menuWidth = Math.max(rect.width, 192);
    const maxLeft = typeof window !== 'undefined' ? Math.max(8, window.innerWidth - menuWidth - 12) : rect.left;
    setMenuPos({
      top: rect.bottom + 6,
      left: Math.min(rect.left, maxLeft),
      width: menuWidth,
    });
  }, []);

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => {
      if (!prev) updatePos();
      return !prev;
    });
  }, [updatePos]);

  useEffect(() => {
    if (!isOpen) return;
    const handleReposition = () => updatePos();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, updatePos]);

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value) || options[0],
    [options, value]
  );

  return (
    <div className="relative shrink-0">
      <button
        ref={btnRef}
        type="button"
        onClick={toggleOpen}
        aria-label={ariaLabel || selectedOption?.label}
        aria-expanded={isOpen}
        className={`${
          compact ? 'h-8 px-2.5 rounded-lg' : 'h-[38px] px-3.5 rounded-xl'
        } ${minWidthClass} ${maxWidthClass} inline-flex items-center justify-between gap-2 text-xs font-semibold bg-white/80 dark:bg-[#1B1130]/85 hover:bg-white/95 dark:hover:bg-[#24163E]/95 border ${
          isOpen
            ? 'border-[#C8963E] dark:border-[#FFD147]/80 ring-2 ring-[#C8963E]/20'
            : 'border-slate-200/90 dark:border-white/15 hover:border-[#C8963E]/60 dark:hover:border-[#FFD147]/50'
        } text-slate-800 dark:text-slate-100 shadow-2xs transition-colors duration-150 cursor-pointer shrink-0`}
      >
        <span className="truncate">{selectedOption?.label || value}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[#C8963E] dark:text-[#FFD147] shrink-0 transition-transform duration-150 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[99998]" onClick={() => setIsOpen(false)} />
            <div
              style={{
                top: `${menuPos.top}px`,
                left: `${menuPos.left}px`,
                minWidth: `${menuPos.width}px`,
              }}
              className="fixed z-[99999] rounded-2xl p-1.5 bg-white/[0.98] dark:bg-[#170E2C]/[0.98] backdrop-blur-2xl backdrop-saturate-[200%] border border-slate-300/90 dark:border-purple-400/35 shadow-[0_20px_50px_rgba(15,23,42,0.22)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.85)] max-h-[300px] overflow-y-auto custom-scrollbar space-y-0.5 animate-in fade-in zoom-in-95 duration-150"
            >
              {options.map((opt) => {
                const active = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      if (opt.value !== value) {
                        onChange(opt.value);
                      }
                    }}
                    className={`w-full px-3.5 py-2 rounded-xl text-left text-[12px] font-['Plus_Jakarta_Sans'] flex items-center justify-between gap-3 transition-colors duration-100 cursor-pointer ${
                      active
                        ? 'bg-gradient-to-r from-[#581C87] to-[#7E22CE] !text-white font-semibold shadow-sm'
                        : 'text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/[0.10] font-medium'
                    }`}
                  >
                    <span className={`truncate ${active ? '!text-white' : ''}`}>{opt.label}</span>
                    {active && <Check className="w-3.5 h-3.5 text-amber-300 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </>,
          document.body
        )}
    </div>
  );
});
CatalogGlassDropdown.displayName = 'CatalogGlassDropdown';

interface CatalogBookCardProps {
  entry: IndexedCatalogBook;
  cardIdx: number;
  isSelected: boolean;
  isCopied: boolean;
  isExtendOpen: boolean;
  extendCount: number;
  nextSeriesAccession: number;
  onSelectBook?: (book: Book) => void;
  onToggleSelect: (bookKey: string, idx: number, shiftKey: boolean) => void;
  onIssue: (book: Book) => void;
  onReturn: (book: Book) => void;
  onToggleExtend: (bookKey: string) => void;
  onCloseExtend: () => void;
  onChangeExtendCount: (nextCount: number) => void;
  onConfirmExtend: (book: Book) => void;
  onCopyBarcode: (barcode: string, bookKey: string) => void;
  onEditBook?: (book: Book) => void;
  onDeleteBook?: (book: Book) => void;
}

const CatalogBookCard: React.FC<CatalogBookCardProps> = React.memo(({
  entry,
  cardIdx,
  isSelected,
  isCopied,
  isExtendOpen,
  extendCount,
  nextSeriesAccession,
  onSelectBook,
  onToggleSelect,
  onIssue,
  onReturn,
  onToggleExtend,
  onCloseExtend,
  onChangeExtendCount,
  onConfirmExtend,
  onCopyBarcode,
  onEditBook,
  onDeleteBook,
}) => {
  const { book, bookKey, isUrduTitle, almariCode, shelfLabel, isCheckedOut } = entry;

  return (
    <div
      style={{
        contentVisibility: 'auto',
        containIntrinsicSize: '220px',
      }}
      className={`ulm-preserve-glass group relative rounded-[22px] bg-white/90 dark:bg-[#17132d]/92 border p-3.5 flex flex-col justify-between shadow-[0_8px_22px_rgba(15,23,42,0.08)] dark:shadow-[0_10px_26px_rgba(0,0,0,0.34)] transition-colors duration-150 hover:border-[#FFD147]/65 ${
        isSelected
          ? 'border-[#FFD147] ring-1.5 ring-[#FFD147]/40'
          : 'border-slate-200/85 dark:border-white/[0.13]'
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

              {/* Custom Frosted Crystal Checkbox with Shift+Click Range Support */}
              <button
                type="button"
                role="checkbox"
                aria-checked={isSelected}
                aria-label={`Select ${book.book_name}`}
                title="Click to select (Shift+Click for range)"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSelect(bookKey, cardIdx, e.shiftKey);
                }}
                style={{ padding: 0, width: '20px', height: '20px', minWidth: '20px', minHeight: '20px' }}
                className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors duration-150 cursor-pointer shrink-0 border ${
                  isSelected
                    ? 'bg-gradient-to-br from-[#D49B27] to-[#B8731B] border-[#FFD147] text-slate-950 shadow-xs'
                    : 'bg-white/80 dark:bg-white/[0.06] border-slate-300/90 dark:border-white/25 hover:border-amber-500/70 text-transparent'
                }`}
              >
                <Check className="w-3 h-3 stroke-[3]" />
              </button>
            </div>

            <h3
              onClick={() => onSelectBook && onSelectBook(book)}
              dir="auto"
              className={`font-extrabold text-[13px] text-slate-900 dark:text-white line-clamp-2 cursor-pointer hover:text-[#541A72] dark:hover:text-[#FFD147] transition-colors leading-snug ${
                isUrduTitle ? 'font-urdu text-sm leading-relaxed' : ''
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
            {(book.copy_total_in_batch || 1) > 1 && (
              <span className="px-1.5 py-0.5 rounded bg-[#541A72]/15 text-[#541A72] dark:text-[#FFD147] font-mono font-bold text-[8.5px] shrink-0">
                Copy {book.copy_number || 1} of {book.copy_total_in_batch}
              </span>
            )}
          </div>

          {isCheckedOut ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/35 text-amber-600 dark:text-amber-400 font-['JetBrains_Mono'] text-[10px] font-semibold uppercase tracking-wider shrink-0">
              <span className="w-1.5 h-1.5 rounded-[1.5px] bg-amber-400 shadow-[0_0_5px_rgba(251,191,36,0.8)] shrink-0" />
              CHECKED OUT
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-slate-900/[0.04] dark:bg-white/[0.04] border border-slate-300/70 dark:border-white/[0.10] text-emerald-600 dark:text-emerald-400 font-['JetBrains_Mono'] text-[10px] font-semibold uppercase tracking-wider shrink-0">
              <span className="w-1.5 h-1.5 rounded-[1.5px] bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.75)] shrink-0" />
              {(book.sibling_total_copies || 1) > 1
                ? `IN STACK (${book.sibling_available_copies}/${book.sibling_total_copies})`
                : 'IN STACK'}
            </span>
          )}
        </div>

        {/* Shelf Location */}
        <div className="mt-1.5 flex items-center gap-1 text-[10.5px] text-slate-600 dark:text-slate-300">
          <MapPin className="w-3 h-3 text-[#C8963E] shrink-0" />
          <span className="truncate font-medium">
            {almariCode ? `${almariCode} • ${shelfLabel}` : 'Unassigned (No Almari)'}
          </span>
        </div>
      </div>

      {/* Inline + Copy Series Extension Popover */}
      {isExtendOpen && (
        <div className="mt-2.5 !rounded-2xl p-3 bg-amber-500/[0.09] dark:bg-[#22153A] border border-amber-400/35 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 min-w-0">
              <span className="w-1.5 h-1.5 rounded-[1.5px] bg-amber-400 shrink-0" />
              <span className="ulm-kpi-label text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 font-['Plus_Jakarta_Sans'] truncate">
                Extend Copies in Series
              </span>
            </div>
            <button
              type="button"
              onClick={onCloseExtend}
              className="!w-6 !h-6 !min-h-0 !p-0 !rounded-lg hover:bg-amber-500/20 text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center justify-center text-xs transition-colors shrink-0 cursor-pointer"
              aria-label="Close extend copies panel"
            >
              ✕
            </button>
          </div>

          <div className="px-2.5 py-1.5 rounded-xl bg-white/75 dark:bg-[#0F081E]/85 border border-slate-200/80 dark:border-white/[0.08] font-['JetBrains_Mono'] ulm-kpi-label text-[10.5px] text-slate-700 dark:text-slate-200 leading-relaxed">
            {extendCount === 1 ? (
              <span>
                Next:{' '}
                <strong className="text-amber-600 dark:text-amber-300">
                  #{nextSeriesAccession}
                </strong>{' '}
                ·{' '}
                <span className="text-slate-500 dark:text-slate-400">
                  {AccessionSeriesEngine.formatBarcode(nextSeriesAccession)}
                </span>
              </span>
            ) : (
              <span>
                Range:{' '}
                <strong className="text-amber-600 dark:text-amber-300">
                  #{nextSeriesAccession} → #{nextSeriesAccession + extendCount - 1}
                </strong>{' '}
                <span className="text-slate-500 dark:text-slate-400">
                  ({extendCount} vols)
                </span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex items-center h-8 rounded-xl bg-white dark:bg-[#0E071C] border border-amber-400/40 p-0.5 shrink-0">
              <button
                type="button"
                onClick={() => onChangeExtendCount(Math.max(1, extendCount - 1))}
                className="ulm-btn-tactile !w-7 !h-7 !min-h-0 !p-0 !rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.10] text-slate-800 dark:text-white font-bold text-xs flex items-center justify-center cursor-pointer"
              >
                −
              </button>
              <input
                type="number"
                min={1}
                max={50}
                value={extendCount}
                onChange={(e) =>
                  onChangeExtendCount(Math.min(50, Math.max(1, parseInt(e.target.value, 10) || 1)))
                }
                className="ulm-scanner-bare-input w-10 h-7 text-center bg-transparent font-['Space_Grotesk'] text-[12.5px] font-bold text-slate-900 dark:text-white focus:outline-none p-0"
              />
              <button
                type="button"
                onClick={() => onChangeExtendCount(Math.min(50, extendCount + 1))}
                className="ulm-btn-tactile !w-7 !h-7 !min-h-0 !p-0 !rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.10] text-slate-800 dark:text-white font-bold text-xs flex items-center justify-center cursor-pointer"
              >
                +
              </button>
            </div>

            <button
              type="button"
              onClick={() => onConfirmExtend(book)}
              className="ulm-btn-tactile ulm-kpi-label flex-1 h-8 px-3 !rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-[11.5px] font-['Plus_Jakarta_Sans'] whitespace-nowrap shadow-sm transition-colors cursor-pointer inline-flex items-center justify-center"
            >
              + Add {extendCount} in Series
            </button>
          </div>
        </div>
      )}

      {/* Footer Actions */}
      <div className="mt-3 pt-2 border-t border-slate-200/60 dark:border-white/10 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onSelectBook && onSelectBook(book)}
            className="ulm-btn-tactile ulm-kpi-label h-8 px-3 !rounded-xl bg-slate-900/[0.06] dark:bg-white/[0.07] hover:bg-slate-900/[0.11] dark:hover:bg-white/[0.12] border border-slate-300/70 dark:border-white/[0.12] text-slate-800 dark:text-slate-100 text-[11.5px] font-semibold font-['Plus_Jakarta_Sans'] inline-flex items-center justify-center transition-colors cursor-pointer"
          >
            Details
          </button>
          {isCheckedOut ? (
            <button
              type="button"
              onClick={() => onReturn(book)}
              className="ulm-btn-tactile ulm-kpi-label h-8 px-3.5 !rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[11.5px] font-bold font-['Plus_Jakarta_Sans'] inline-flex items-center justify-center gap-1 shadow-sm transition-colors cursor-pointer"
              title={book.borrower_name ? `Checked out to ${book.borrower_name} — Click to Return` : 'Return this copy to shelf'}
            >
              <RotateCcw className="w-3 h-3" />
              <span>Return</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onIssue(book)}
              className="ulm-btn-tactile ulm-kpi-label h-8 px-3.5 !rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-[11.5px] font-bold font-['Plus_Jakarta_Sans'] inline-flex items-center justify-center shadow-sm transition-colors cursor-pointer"
            >
              Issue
            </button>
          )}
          <button
            type="button"
            onClick={() => onToggleExtend(bookKey)}
            className="ulm-btn-tactile ulm-kpi-label h-8 px-3 !rounded-xl bg-amber-500/12 hover:bg-amber-500/22 border border-amber-400/40 text-amber-700 dark:text-amber-300 text-[11.5px] font-semibold font-['Plus_Jakarta_Sans'] inline-flex items-center justify-center gap-1 transition-colors cursor-pointer"
            title="Extend existing book with +N new copies in strict series order"
          >
            <Plus className="w-3 h-3" />
            <span>Copy</span>
          </button>
        </div>

        <div className="flex items-center gap-1 text-slate-400">
          <button
            type="button"
            onClick={() => onCopyBarcode(book.barcode, bookKey)}
            className="p-1 rounded hover:text-slate-900 dark:hover:text-white cursor-pointer"
            title="Copy Barcode"
          >
            {isCopied ? (
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
            onClick={(e) => {
              e.stopPropagation();
              if (onDeleteBook) onDeleteBook(book);
            }}
            className="p-1 rounded hover:text-rose-600 cursor-pointer"
            title="Delete Book"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
});
CatalogBookCard.displayName = 'CatalogBookCard';

interface CatalogListRowProps {
  entry: IndexedCatalogBook;
  idx: number;
  seqNo: number;
  isSelected: boolean;
  isExtendOpen: boolean;
  extendCount: number;
  nextSeriesAccession: number;
  onSelectBook?: (book: Book) => void;
  onToggleSelect: (bookKey: string, idx: number, shiftKey: boolean) => void;
  onIssue: (book: Book) => void;
  onReturn: (book: Book) => void;
  onToggleExtend: (rowKey: string) => void;
  onChangeExtendCount: (nextCount: number) => void;
  onConfirmExtend: (book: Book) => void;
  onEditBook?: (book: Book) => void;
  onDeleteBook?: (book: Book) => void;
}

const CatalogListRow: React.FC<CatalogListRowProps> = React.memo(({
  entry,
  idx,
  seqNo,
  isSelected,
  isExtendOpen,
  extendCount,
  nextSeriesAccession,
  onSelectBook,
  onToggleSelect,
  onIssue,
  onReturn,
  onToggleExtend,
  onChangeExtendCount,
  onConfirmExtend,
  onEditBook,
  onDeleteBook,
}) => {
  const { book, bookKey, isUrduTitleOrAuthor, almariCode, shelfNo, isCheckedOut } = entry;
  const totalCopies = book.total_copies ?? book.total_quantity ?? 1;
  const callNo =
    (book as Book & { dewey_call_no?: string }).dewey_call_no ||
    book.dewey_call_number ||
    '';

  return (
    <tr
      style={{ contentVisibility: 'auto', containIntrinsicSize: '64px' }}
      className={`transition-colors hover:bg-purple-500/[0.05] dark:hover:bg-white/[0.04] divide-x divide-slate-200/30 dark:divide-white/[0.04] ${
        isSelected ? 'bg-purple-500/[0.08] dark:bg-purple-500/[0.12]' : ''
      }`}
    >
      {/* 1. Checkbox */}
      <td className="w-10 px-3 py-2.5 text-center">
        <button
          type="button"
          role="checkbox"
          aria-checked={isSelected}
          aria-label={`Select ${book.book_name}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(bookKey, idx, e.shiftKey);
          }}
          className={`w-5 h-5 mx-auto rounded-md border flex items-center justify-center transition-colors cursor-pointer ${
            isSelected
              ? 'bg-gradient-to-br from-[#FFD147] to-[#D4A02A] border-[#FFD147] text-slate-950 shadow-xs'
              : 'bg-white/80 dark:bg-white/[0.06] border-slate-300 dark:border-white/25 hover:border-amber-400'
          }`}
          title="Select volume (hold Shift to select a range)"
        >
          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
        </button>
      </td>

      {/* 2. Book Title & Author with Compact Spine */}
      <td className="px-3.5 py-2.5 min-w-[180px] max-w-[260px]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-9 rounded-md shrink-0 bg-gradient-to-b from-[#541A72] to-[#2A0845] border border-[#FFD147]/45 flex flex-col items-center justify-between py-1 shadow-sm">
            <span className="text-[7px] font-mono text-[#FFD147]/90 font-bold leading-none">
              ULM
            </span>
            <span className="text-[7px] font-mono text-white/80 leading-none">
              #{book.accession_no || seqNo}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div
              onClick={() => onSelectBook && onSelectBook(book)}
              className={`font-bold text-slate-900 dark:text-white truncate cursor-pointer hover:text-[#541A72] dark:hover:text-[#FFD147] ${
                isUrduTitleOrAuthor ? 'urdu-text text-sm' : 'text-[13px]'
              }`}
            >
              {book.book_name || 'Untitled Volume'}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {book.author || 'Unknown Author'}
            </div>
          </div>
        </div>
      </td>

      {/* 3. Category / Discipline Pill */}
      <td className="px-3.5 py-2.5 whitespace-nowrap">
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-purple-500/10 dark:bg-purple-500/15 text-purple-800 dark:text-purple-200 border border-purple-500/25">
          {book.category || 'General'}
        </span>
      </td>

      {/* 4. Language Pill */}
      <td className="px-3.5 py-2.5 whitespace-nowrap">
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-medium bg-slate-900/[0.04] dark:bg-white/[0.05] text-slate-700 dark:text-slate-300 border border-slate-300/60 dark:border-white/10">
          {book.language || 'English'}
        </span>
      </td>

      {/* 5. Barcode / Call No */}
      <td className="px-3.5 py-2.5 whitespace-nowrap">
        <div className="font-mono text-[11.5px] font-semibold text-slate-800 dark:text-slate-200 tracking-tight">
          {book.barcode}
        </div>
        <div className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
          {callNo ? `DDC: ${callNo}` : `Acc #${book.accession_no || seqNo}`}
        </div>
      </td>

      {/* 6. Total Copies */}
      <td className="px-3 py-2.5 text-center whitespace-nowrap font-mono font-bold text-slate-800 dark:text-slate-200 tabular-nums">
        {totalCopies}
      </td>

      {/* 7. Available */}
      <td className="px-3 py-2.5 text-center whitespace-nowrap">
        {isCheckedOut ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/35 text-amber-600 dark:text-amber-400 font-['JetBrains_Mono'] text-[10px] font-semibold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-[1.5px] bg-amber-400 shadow-[0_0_5px_rgba(251,191,36,0.8)] shrink-0" />
            CHECKED OUT
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-slate-900/[0.04] dark:bg-white/[0.04] border border-slate-300/70 dark:border-white/[0.10] text-emerald-600 dark:text-emerald-400 font-['JetBrains_Mono'] text-[10px] font-semibold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-[1.5px] bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.75)] shrink-0" />
            {(book.sibling_total_copies || 1) > 1
              ? `IN STACK (${book.sibling_available_copies}/${book.sibling_total_copies})`
              : 'IN STACK'}
          </span>
        )}
      </td>

      {/* 8. Shelf / Row Location */}
      <td className="px-3.5 py-2.5 whitespace-nowrap">
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 dark:text-slate-300">
          <MapPin className="w-3 h-3 text-[#C8963E] shrink-0" />
          {almariCode
            ? `${almariCode} · Shelf ${shelfNo || book.shelf_no || 1}`
            : book.shelf || 'Unassigned'}
        </span>
      </td>

      {/* 9. Actions */}
      <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
        <div className="inline-flex items-center justify-end gap-1.5">
          {isCheckedOut ? (
            <button
              type="button"
              onClick={() => onReturn(book)}
              className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 font-bold cursor-pointer inline-flex items-center gap-1"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>Return</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onIssue(book)}
              className="px-2 py-0.5 rounded bg-[#C8963E] text-slate-950 font-bold hover:brightness-110 cursor-pointer"
            >
              Issue
            </button>
          )}
          <button
            type="button"
            onClick={() => onToggleExtend(`row-${bookKey}`)}
            className="px-2 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-[#FFD147] border border-amber-500/35 font-bold cursor-pointer flex items-center gap-0.5"
            title="Extend copies in series"
          >
            <Plus className="w-2.5 h-2.5" />
            <span>Copy</span>
          </button>
          <button
            type="button"
            onClick={() => onEditBook && onEditBook(book)}
            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-white/10 cursor-pointer"
          >
            <Edit3 className="w-3 h-3" />
          </button>
          {onDeleteBook && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteBook(book);
              }}
              className="p-1 rounded text-rose-500 hover:bg-rose-500/10 cursor-pointer"
              title="Delete Book"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
        {isExtendOpen && (
          <div className="mt-2 p-2 rounded-xl bg-amber-500/15 dark:bg-[#1E1136] border border-amber-500/45 flex items-center justify-end gap-2 text-[11px]">
            <span className="font-mono text-slate-700 dark:text-slate-300">
              #{nextSeriesAccession}→#{nextSeriesAccession + extendCount - 1}:
            </span>
            <div className="flex items-center h-6 border border-amber-500/40 rounded overflow-hidden bg-white dark:bg-[#121014]">
              <button
                type="button"
                onClick={() => onChangeExtendCount(Math.max(1, extendCount - 1))}
                className="ulm-btn-tactile w-5 h-full font-bold cursor-pointer"
              >
                -
              </button>
              <input
                type="number"
                min={1}
                max={50}
                value={extendCount}
                onChange={(e) =>
                  onChangeExtendCount(Math.min(50, Math.max(1, parseInt(e.target.value, 10) || 1)))
                }
                className="w-9 text-center font-mono font-bold text-[11px] bg-transparent focus:outline-none"
              />
              <button
                type="button"
                onClick={() => onChangeExtendCount(Math.min(50, extendCount + 1))}
                className="ulm-btn-tactile w-5 h-full font-bold cursor-pointer"
              >
                +
              </button>
            </div>
            <button
              type="button"
              onClick={() => onConfirmExtend(book)}
              className="ulm-btn-tactile h-6 px-2 rounded bg-[#C8963E] text-slate-950 font-extrabold font-mono text-[10.5px] cursor-pointer"
            >
              + Add {extendCount}
            </button>
          </div>
        )}
      </td>
    </tr>
  );
});
CatalogListRow.displayName = 'CatalogListRow';

export interface BooksCatalogViewProps {
  books: Book[];
  transactions?: Transaction[];
  initialViewMode?: 'grid' | 'list' | 'almaris' | 'analytics' | 'chart';
  onOpenAddBook: () => void;
  onOpenIssueModal?: (book: Book) => void;
  onQuickLoan?: (book: Book) => void;
  onReturnBook?: (transactionIdOrBookId: string) => void;
  onSelectBook?: (book: Book) => void;
  onEditBook?: (book: Book) => void;
  onDeleteBook?: (book: Book) => void;
  onDeleteSelectedBooks?: (books: Book[]) => void;
  onPrintBarcode?: (book: Book) => void;
  onImportExcel?: () => void;
  onOpenImportBookEntrySheet?: () => void;
  onExportCatalog?: () => void;
  onOpenBatchLabelPrint?: (selectedIds?: string[]) => void;
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
  onReturnBook,
  onSelectBook,
  onEditBook,
  onDeleteBook,
  onDeleteSelectedBooks,
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

  const viewSwitcherRef = useRef<HTMLDivElement | null>(null);
  const viewItemRefs = useRef<Record<string, HTMLElement | null>>({});
  const [animTick, setAnimTick] = useState(1);

  const iconFxForMode = (mode: 'grid' | 'list' | 'almaris' | 'analytics'): LiquidIconFx => {
    if (mode === 'grid') return 'pop';
    if (mode === 'list') return 'hop';
    if (mode === 'almaris') return 'wave';
    return 'spin';
  };

  const [isPending, startTransition] = useTransition();
  const [almariSyncTick, setAlmariSyncTick] = useState(0);

  const handleSelectCatalogView = useCallback((mode: 'grid' | 'list' | 'almaris' | 'analytics') => {
    setAnimTick((t) => t + 1);
    startTransition(() => {
      setCatalogView(mode);
    });
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const deferredSearch = useDeferredValue(debouncedSearch);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      startTransition(() => {
        setDebouncedSearch(searchQuery);
        setCurrentPage(1);
      });
    }, 150);
    return () => clearTimeout(timer);
  }, [searchQuery]);

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
  const [pageSize, setPageSize] = useState(24);
  const [selectedBookIds, setSelectedBookIds] = useState<Set<string>>(new Set());
  const lastSelectedIndexRef = useRef<number | null>(null);
  const [bulkModalMode, setBulkModalMode] = useState<'assign_group' | 'assign_almari' | null>(null);
  const [copiedBarcodeId, setCopiedBarcodeId] = useState<string | null>(null);
  const [extendPopoverBookId, setExtendPopoverBookId] = useState<string | null>(null);
  const [extendPopoverCount, setExtendPopoverCount] = useState<number>(1);

  // Non-blocking React 18 transition filter handlers (zero main-thread freeze on click)
  const handleDisciplineChange = useCallback((val: string) => {
    startTransition(() => {
      setSelectedDiscipline(val);
      setCurrentPage(1);
    });
  }, []);

  const handleLanguageChange = useCallback((val: string) => {
    startTransition(() => {
      setSelectedLanguage(val);
      setCurrentPage(1);
    });
  }, []);

  const handleAlmariChange = useCallback((val: string) => {
    startTransition(() => {
      setSelectedAlmari(val);
      setCurrentPage(1);
    });
  }, []);

  const handleSortChange = useCallback((val: string) => {
    startTransition(() => {
      setSortBy(val as 'newest' | 'title' | 'author' | 'accession' | 'almari_order' | 'dewey_decimal');
    });
  }, []);

  const handleStatusChange = useCallback((val: string) => {
    startTransition(() => {
      setSelectedStatus(val);
      setCurrentPage(1);
    });
  }, []);

  const handleGroupFilterChange = useCallback((val: string) => {
    startTransition(() => {
      setSelectedGroupFilter(val);
      setCurrentPage(1);
    });
  }, []);

  const handleDateFromChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    startTransition(() => {
      setDateFrom(next);
      setCurrentPage(1);
    });
  }, []);

  const handleDateToChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    startTransition(() => {
      setDateTo(next);
      setCurrentPage(1);
    });
  }, []);

  const handleResetSecondaryFilters = useCallback(() => {
    startTransition(() => {
      setSelectedStatus('all');
      setSelectedGroupFilter('all');
      setDateFrom('');
      setDateTo('');
      setCurrentPage(1);
    });
  }, []);

  const handlePageSizeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextSize = Number(e.target.value);
    startTransition(() => {
      setPageSize(nextSize);
      setCurrentPage(1);
    });
  }, []);

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

  // 1. Authoritative Master Placements Sync (decoupled from catalogView and all filters!)
  const masterPlacements = useMemo<Record<string, any>>(() => {
    try {
      const raw = localStorage.getItem('ulm_almari_placements_master_v3');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }, [books, almariSyncTick]);

  const manualShelfOverrides = useMemo<Record<string, any>>(() => {
    try {
      const raw = localStorage.getItem('ulm_manual_shelf_assignments_v2');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }, [books, almariSyncTick]);

  // 2. Resolved Books with Placements Applied + Reconciled Against Active Loans (skip cloning if already reconciled)
  const booksWithPlacements = useMemo(() => {
    const hasPlacements = masterPlacements && Object.keys(masterPlacements).length > 0;
    const placed = hasPlacements
      ? books.map((b) => {
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
        })
      : books;

    if (transactions.length === 0 && placed.length > 0 && placed[0].sibling_total_copies !== undefined) {
      return placed;
    }
    return reconcileBooksWithLoans(placed, transactions);
  }, [books, masterPlacements, transactions]);

  // Active books
  const activeBooks = useMemo(() => {
    return booksWithPlacements.filter(
      (b) =>
        b &&
        b.is_active !== false &&
        (b.is_active as unknown) !== 0 &&
        (b.is_active as unknown) !== '0'
    );
  }, [booksWithPlacements]);

  const activeAlmarisList = useMemo(
    () => AlmariService.getAlmaris().filter((a) => a.is_active),
    [books, almariSyncTick]
  );
  const activeGroupsList = useMemo(
    () => AlmariService.getGroups().filter((g) => g.is_active),
    [books, almariSyncTick]
  );

  // Single O(N) useMemo Pass for ALL 4 KPIs, Disciplines, Languages, and Next Series Accession (decoupled from filters)
  const catalogAggregates = useMemo(() => {
    const distinctTitles = new Set<string>();
    const disciplineSet = new Set<string>();
    const languageSet = new Set<string>(['English', 'Urdu', 'Pashto']);
    let availableCount = 0;
    let loanedCount = 0;
    let maxAcc = 0;

    for (let i = 0; i < activeBooks.length; i++) {
      const b = activeBooks[i];
      const isbnClean = b.isbn ? String(b.isbn).replace(/[^0-9Xx]/g, '') : '';
      const groupKey =
        isbnClean.length >= 6
          ? `isbn:${isbnClean}`
          : `title:${String(b.book_name || b.title || '').trim().toLowerCase()}|${String(b.author || '').trim().toLowerCase()}`;
      distinctTitles.add(groupKey);

      const isCheckedOut =
        Boolean(b.is_checked_out) ||
        Number(b.available_copies ?? b.available_quantity ?? 1) === 0;
      if (isCheckedOut) {
        loanedCount++;
      } else {
        availableCount++;
      }

      if (b.category) disciplineSet.add(b.category);
      if (b.language) languageSet.add(b.language);

      const rawAcc = b.accession_no ? parseInt(String(b.accession_no).replace(/\D/g, ''), 10) : 0;
      if (!Number.isNaN(rawAcc) && rawAcc > maxAcc) maxAcc = rawAcc;
    }

    return {
      totalCataloged: distinctTitles.size,
      totalPhysicalVolumes:
        totalDbBooksCount && totalDbBooksCount > activeBooks.length
          ? totalDbBooksCount
          : activeBooks.length,
      totalAvailable: availableCount,
      activeLoans: loanedCount,
      disciplines: Array.from(disciplineSet).sort(),
      languages: Array.from(languageSet).sort(),
      nextSeriesAccession: maxAcc + 1,
    };
  }, [activeBooks, totalDbBooksCount]);

  const {
    totalCataloged,
    totalPhysicalVolumes,
    totalAvailable,
    activeLoans,
    disciplines,
    languages,
    nextSeriesAccession,
  } = catalogAggregates;

  // Memoized dropdown option lists (independent from active filter selections)
  const disciplineOptions = useMemo<CatalogGlassOption[]>(
    () => [
      { value: 'all', label: 'All Disciplines' },
      ...disciplines.map((d) => ({ value: d, label: d })),
    ],
    [disciplines]
  );

  const languageOptions = useMemo<CatalogGlassOption[]>(
    () => [
      { value: 'all', label: 'All Languages' },
      ...languages.map((l) => ({ value: l, label: l })),
    ],
    [languages]
  );

  const almariOptions = useMemo<CatalogGlassOption[]>(
    () => [
      { value: 'all', label: 'All Almaris' },
      { value: 'unassigned', label: 'Unassigned' },
      ...activeAlmarisList.map((alm) => ({
        value: alm.id,
        label: `${alm.code} — ${alm.name_en}`,
      })),
    ],
    [activeAlmarisList]
  );

  const groupOptions = useMemo<CatalogGlassOption[]>(
    () => [
      { value: 'all', label: 'All Groups' },
      { value: 'NO_GROUP', label: 'Unassigned Group' },
      ...activeGroupsList.map((g) => ({
        value: g.id,
        label: g.name_en,
      })),
    ],
    [activeGroupsList]
  );

  // Pre-index ONCE in O(N) using O(1) Map lookups — ZERO localStorage/JSON.parse/find inside filter clicks!
  const indexedBooks = useMemo<IndexedCatalogBook[]>(() => {
    const almariByKey = new Map<string, (typeof activeAlmarisList)[number]>();
    const almariCodeEntries: Array<{ codeUpper: string; almari: (typeof activeAlmarisList)[number] }> = [];
    for (let i = 0; i < activeAlmarisList.length; i++) {
      const a = activeAlmarisList[i];
      const idKey = String(a.id).trim().toUpperCase();
      const codeKey = String(a.code).trim().toUpperCase();
      const nameKey = String(a.name_en).trim().toUpperCase();
      if (idKey) almariByKey.set(idKey, a);
      if (codeKey) {
        almariByKey.set(codeKey, a);
        almariCodeEntries.push({ codeUpper: codeKey, almari: a });
      }
      if (nameKey && !almariByKey.has(nameKey)) almariByKey.set(nameKey, a);
    }

    const groupById = new Map<string, (typeof activeGroupsList)[number]>();
    const groupByNameLower = new Map<string, (typeof activeGroupsList)[number]>();
    const groupFirstWordEntries: Array<{ firstWord: string; group: (typeof activeGroupsList)[number] }> = [];
    for (let i = 0; i < activeGroupsList.length; i++) {
      const g = activeGroupsList[i];
      groupById.set(g.id, g);
      const nameLower = g.name_en.toLowerCase();
      groupByNameLower.set(nameLower, g);
      const firstWord = nameLower.split(' ')[0];
      if (firstWord) groupFirstWordEntries.push({ firstWord, group: g });
    }

    const hasManualV2 = manualShelfOverrides && Object.keys(manualShelfOverrides).length > 0;
    const len = activeBooks.length;
    const result = new Array<IndexedCatalogBook>(len);

    for (let i = 0; i < len; i++) {
      const b = activeBooks[i];
      const bookRec = b as Record<string, any>;
      const bookKey = b.id || b.barcode;

      const manualOverride =
        hasManualV2 && b.id && !b.almari_id && !b.almari_code
          ? manualShelfOverrides[String(b.id)]
          : undefined;
      const eff = manualOverride ? { ...bookRec, ...manualOverride } : bookRec;

      const rawTitle = String(b.book_name || b.title || '');
      const rawAuthor = String(b.author || '');
      const rawCat = String(eff.group || eff.discipline || eff.category || eff.subject || '').trim();
      const rawLang = String(eff.language || '').trim();

      // 1. O(1) Almari resolution matching resolveBookAlmariAndShelf
      const rawAlmariKey = String(
        eff.almari_id || eff.almariId || eff.almari_code || eff.cupboard || eff.almari || ''
      )
        .trim()
        .toUpperCase();
      const rawShelfStr = String(eff.shelf || eff.shelf_label || eff.shelfLabel || '').trim();

      let matchedAlmari = rawAlmariKey ? almariByKey.get(rawAlmariKey) : undefined;
      if (!matchedAlmari && rawShelfStr && almariCodeEntries.length > 0) {
        const isGeneric = !rawAlmariKey && RE_GENERIC_PLACEHOLDER.test(rawShelfStr);
        if (!isGeneric) {
          const shelfUpper = rawShelfStr.toUpperCase();
          for (let j = 0; j < almariCodeEntries.length; j++) {
            const { codeUpper, almari } = almariCodeEntries[j];
            if (
              shelfUpper === codeUpper ||
              shelfUpper.startsWith(`${codeUpper} `) ||
              shelfUpper.startsWith(`${codeUpper}-`) ||
              shelfUpper.startsWith(`${codeUpper}·`) ||
              shelfUpper.startsWith(`${codeUpper},`)
            ) {
              matchedAlmari = almari;
              break;
            }
          }
        }
      }

      let shelfNo = 0;
      if (matchedAlmari) {
        const shelfCount = Math.max(1, matchedAlmari.shelf_count || 5);
        shelfNo = Number(eff.shelf_no ?? eff.shelfNo ?? 0);
        if (!shelfNo || shelfNo < 1) {
          const shelfMatch =
            rawShelfStr.match(RE_SHELF_NUM) || String(eff.row || '').match(RE_ROW_NUM);
          if (shelfMatch) {
            const parsed = parseInt(shelfMatch[1], 10);
            if (parsed >= 1) shelfNo = Math.min(parsed, shelfCount);
          } else if (RE_DIGITS_ONLY.test(rawShelfStr)) {
            const parsed = parseInt(rawShelfStr, 10);
            if (parsed >= 1) shelfNo = Math.min(parsed, shelfCount);
          }
        }
        if (!shelfNo || shelfNo < 1) shelfNo = 1;
        else if (shelfNo > shelfCount) shelfNo = shelfCount;
      }

      const almariId = matchedAlmari?.id || b.almari_id || '';
      const almariCode = b.almari_code || matchedAlmari?.code || '';
      const shelfLabel = shelfNo
        ? `Shelf ${shelfNo}`
        : b.shelf_no
        ? `Shelf ${b.shelf_no}`
        : b.shelf || 'Shelf 1';

      // 2. Group resolution matching resolveBookAlmariAndShelf
      let groupId = String(eff.group_id || '').trim();
      let displayGroup = rawCat && rawCat.toLowerCase() !== 'general' ? rawCat : '';
      if (!groupId || !groupById.has(groupId)) {
        const combinedText = `${rawCat} ${rawLang} ${rawTitle}`.toLowerCase();
        if (RE_CS.test(combinedText)) {
          groupId = groupId || 'grp-cs';
          displayGroup = displayGroup || 'Computer Science';
        } else if (RE_SCI.test(combinedText)) {
          if (RE_PHY.test(combinedText)) {
            groupId = groupId || 'grp-phy';
            displayGroup = displayGroup || 'Physics';
          } else if (RE_CHEM.test(combinedText)) {
            groupId = groupId || 'grp-chem';
            displayGroup = displayGroup || 'Chemistry & Engineering';
          } else {
            groupId = groupId || 'grp-math';
            displayGroup = displayGroup || 'Mathematics';
          }
        } else if (RE_ISL.test(combinedText)) {
          groupId = groupId || 'grp-isl';
          displayGroup = displayGroup || 'Islamic Studies';
        } else if (RE_LIT.test(combinedText) || RE_LIT_LANG.test(rawLang)) {
          if (RE_PASHTO.test(combinedText)) {
            groupId = groupId || 'grp-ps';
            displayGroup = displayGroup || 'Pashto Literature';
          } else {
            groupId = groupId || 'grp-ur';
            displayGroup = displayGroup || 'Urdu Literature';
          }
        } else if (RE_LAW_EDU.test(combinedText)) {
          if (RE_LAW.test(combinedText)) {
            groupId = groupId || 'grp-law';
            displayGroup = displayGroup || 'Law & Governance';
          } else if (RE_EDU.test(combinedText)) {
            groupId = groupId || 'grp-edu';
            displayGroup = displayGroup || 'Education';
          } else {
            groupId = groupId || 'grp-gen';
            displayGroup = displayGroup || 'General Reference';
          }
        }

        if (activeGroupsList.length > 0) {
          let matchedGroup = groupId ? groupById.get(groupId) : undefined;
          if (!matchedGroup && displayGroup) {
            const dgLower = displayGroup.toLowerCase();
            matchedGroup = groupByNameLower.get(dgLower);
            if (!matchedGroup) {
              for (let j = 0; j < groupFirstWordEntries.length; j++) {
                if (dgLower.includes(groupFirstWordEntries[j].firstWord)) {
                  matchedGroup = groupFirstWordEntries[j].group;
                  break;
                }
              }
            }
          }
          if (matchedGroup) {
            groupId = matchedGroup.id;
          }
        }
      }
      const finalGroupId = groupId || 'grp-gen';

      // 3. Status, Search Blob, Urdu Script, Date, and Accession Number
      const statusUpper = String(b.status || '').trim().toUpperCase();
      const isBookIssued = Boolean(b.is_checked_out) || statusUpper === 'ISSUED';
      const isAvailable = !isBookIssued && (b.available_quantity ?? 1) > 0;
      const isCheckedOut =
        isBookIssued || Number(b.available_copies ?? b.available_quantity ?? 1) === 0;
      const isUrduTitle = isArabicOrUrduScript(rawTitle);
      const isUrduTitleOrAuthor = isUrduTitle || isArabicOrUrduScript(rawAuthor);
      const searchBlob =
        b._searchKey ||
        b.search_text ||
        `${rawTitle} ${rawAuthor} ${b.barcode || ''} ${b.accession_no || ''} ${b.isbn || ''}`.toLowerCase();
      const bookDate =
        b.date_added || (b.created_at ? b.created_at.split(' ')[0] : '') || '';

      result[i] = {
        book: b,
        bookKey,
        searchBlob,
        category: b.category || '',
        language: b.language || '',
        languageLower: rawLang.toLowerCase(),
        isUrduTitle,
        isUrduTitleOrAuthor,
        isCheckedOut,
        isAvailable,
        almariId,
        almariCode,
        shelfNo,
        shelfLabel,
        groupId: finalGroupId,
        bookDate,
        accessionNum: parseSerialNumber(b.accession_no || b.barcode),
      };
    }

    return result;
  }, [activeBooks, activeAlmarisList, activeGroupsList, manualShelfOverrides]);

  // Ultra-fast O(N) filtering against pre-indexed primitives (< 5ms on 50,000 books!)
  const filteredEntries = useMemo<IndexedCatalogBook[]>(() => {
    const q = deferredSearch.trim();
    const qLower = q.toLowerCase();
    const hasUrduQuery = q.length > 0 && /[\u0600-\u06FF]/.test(q);
    const hasSearch = qLower.length > 0;
    const hasDisc = selectedDiscipline !== 'all';
    const hasLang = selectedLanguage !== 'all';
    const isUrduFilter = selectedLanguage === 'Urdu';
    const hasStatus = selectedStatus !== 'all';
    const wantAvailable = selectedStatus === 'AVAILABLE';
    const hasAlmari = selectedAlmari !== 'all';
    const wantUnassignedAlmari = selectedAlmari === 'unassigned';
    const hasGroup = selectedGroupFilter !== 'all';
    const wantNoGroup = selectedGroupFilter === 'NO_GROUP';
    const hasDate = Boolean(dateFrom) || Boolean(dateTo);

    const hasAnyFilter =
      hasSearch || hasDisc || hasLang || hasStatus || hasAlmari || hasGroup || hasDate;

    let matched: IndexedCatalogBook[];
    if (!hasAnyFilter) {
      matched = indexedBooks;
    } else {
      matched = [];
      for (let i = 0; i < indexedBooks.length; i++) {
        const item = indexedBooks[i];

        if (hasDisc && item.category !== selectedDiscipline) continue;

        if (hasLang) {
          if (isUrduFilter) {
            if (item.languageLower !== 'urdu' && !item.isUrduTitle) continue;
          } else if (item.language !== selectedLanguage) {
            continue;
          }
        }

        if (hasStatus) {
          if (wantAvailable ? !item.isAvailable : item.isAvailable) continue;
        }

        if (hasAlmari) {
          if (wantUnassignedAlmari) {
            if (item.almariCode || item.almariId) continue;
          } else if (item.almariCode !== selectedAlmari && item.almariId !== selectedAlmari) {
            continue;
          }
        }

        if (hasGroup) {
          if (wantNoGroup) {
            if (item.groupId) continue;
          } else if (item.groupId !== selectedGroupFilter) {
            continue;
          }
        }

        if (hasDate) {
          if (dateFrom && (!item.bookDate || item.bookDate < dateFrom)) continue;
          if (dateTo && (!item.bookDate || item.bookDate > dateTo)) continue;
        }

        if (hasSearch) {
          if (
            !item.searchBlob.includes(qLower) &&
            !(hasUrduQuery && matchesUrduSearch(q, item.searchBlob))
          ) {
            continue;
          }
        }

        matched.push(item);
      }
    }

    if (sortBy === 'newest') {
      return matched;
    }

    if (sortBy === 'almari_order' || sortBy === 'dewey_decimal') {
      const groupsMap = new Map(activeGroupsList.map((g) => [g.id, g]));
      const almarisMap = new Map(activeAlmarisList.map((a) => [a.id, a]));
      const sortedBooks = sortBooksCatalog(
        matched.map((e) => e.book),
        sortBy,
        groupsMap,
        almarisMap
      );
      const entryByBook = new Map<Book, IndexedCatalogBook>();
      for (let i = 0; i < matched.length; i++) entryByBook.set(matched[i].book, matched[i]);
      return sortedBooks.map((b) => entryByBook.get(b)!);
    }

    return [...matched].sort((a, b) => {
      if (sortBy === 'title') return (a.book.book_name || '').localeCompare(b.book.book_name || '');
      if (sortBy === 'author') return (a.book.author || '').localeCompare(b.book.author || '');
      if (sortBy === 'accession') {
        if (a.accessionNum !== b.accessionNum) return a.accessionNum - b.accessionNum;
        return (a.book.barcode || '').localeCompare(b.book.barcode || '');
      }
      return 0;
    });
  }, [
    indexedBooks,
    deferredSearch,
    selectedDiscipline,
    selectedLanguage,
    selectedAlmari,
    selectedStatus,
    selectedGroupFilter,
    dateFrom,
    dateTo,
    sortBy,
    activeAlmarisList,
    activeGroupsList,
  ]);

  // Strict Pagination Cap (24, 36, 48 per page — keeps DOM lightweight & instant in WebView2/Chromium)
  const safePageSize = pageSize === 36 || pageSize === 48 ? pageSize : 24;
  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / safePageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedEntries = useMemo(() => {
    const start = (safeCurrentPage - 1) * safePageSize;
    return filteredEntries.slice(start, start + safePageSize);
  }, [filteredEntries, safeCurrentPage, safePageSize]);

  const paginatedEntriesRef = useRef(paginatedEntries);
  paginatedEntriesRef.current = paginatedEntries;

  // Auto-prune deleted book IDs from selection when catalog mutates
  useEffect(() => {
    setSelectedBookIds((prev) => {
      if (prev.size === 0) return prev;
      const validKeys = new Set(activeBooks.map((b) => b.id || b.barcode));
      let changed = false;
      const next = new Set<string>();
      prev.forEach((id) => {
        if (validKeys.has(id)) next.add(id);
        else changed = true;
      });
      return changed ? next : prev;
    });
  }, [activeBooks]);

  // Listen to explicit library sync events (deletions & almari/placement mutations)
  useEffect(() => {
    const handleLibrarySync = (e: Event) => {
      const custom = e as CustomEvent<{ reason?: string; deletedCount?: number }>;
      if (custom.detail?.reason === 'delete' || (custom.detail?.deletedCount ?? 0) > 0) {
        setSelectedBookIds(new Set());
        lastSelectedIndexRef.current = null;
      }
      setAlmariSyncTick((v) => v + 1);
    };
    window.addEventListener('ulm-library-sync', handleLibrarySync);
    return () => window.removeEventListener('ulm-library-sync', handleLibrarySync);
  }, []);

  const allPageSelected = useMemo(
    () =>
      paginatedEntries.length > 0 &&
      paginatedEntries.every((e) => selectedBookIds.has(e.bookKey)),
    [paginatedEntries, selectedBookIds]
  );

  const handleToggleSelectAll = useCallback(() => {
    const currentEntries = paginatedEntriesRef.current;
    const pageKeys = currentEntries.map((e) => e.bookKey);
    setSelectedBookIds((prev) => {
      const allSelected = pageKeys.length > 0 && pageKeys.every((key) => prev.has(key));
      const next = new Set(prev);
      if (allSelected) {
        pageKeys.forEach((k) => next.delete(k));
      } else {
        pageKeys.forEach((k) => next.add(k));
      }
      return next;
    });
  }, []);

  const handleSelectAllFiltered = useCallback(() => {
    setSelectedBookIds(new Set(filteredEntries.map((e) => e.bookKey)));
  }, [filteredEntries]);

  const handleToggleSelectOne = useCallback(
    (id: string, pageIndex?: number, shiftKey: boolean = false) => {
      const currentEntries = paginatedEntriesRef.current;
      setSelectedBookIds((prev) => {
        const next = new Set(prev);
        if (
          shiftKey &&
          typeof pageIndex === 'number' &&
          lastSelectedIndexRef.current !== null &&
          currentEntries.length > 0
        ) {
          const start = Math.min(lastSelectedIndexRef.current, pageIndex);
          const end = Math.max(lastSelectedIndexRef.current, pageIndex);
          const shouldSelect = !next.has(id);
          for (let i = start; i <= end; i++) {
            const entry = currentEntries[i];
            if (!entry) continue;
            if (shouldSelect) next.add(entry.bookKey);
            else next.delete(entry.bookKey);
          }
        } else {
          if (next.has(id)) next.delete(id);
          else next.add(id);
        }
        return next;
      });
      if (typeof pageIndex === 'number') {
        lastSelectedIndexRef.current = pageIndex;
      }
    },
    []
  );

  const selectedBooksList = useMemo(() => {
    if (selectedBookIds.size === 0) return [];
    return activeBooks.filter((b) => selectedBookIds.has(b.id || b.barcode));
  }, [activeBooks, selectedBookIds]);

  const handleIssueBookAction = useCallback((book: Book) => {
    if (onOpenIssueModal) {
      onOpenIssueModal(book);
    } else if (onQuickLoan) {
      onQuickLoan(book);
    }
  }, [onOpenIssueModal, onQuickLoan]);

  const handleReturnCopyAction = useCallback((book: Book) => {
    const targetId = book.active_loan_id || book.id || book.barcode;
    if (onReturnBook) {
      onReturnBook(targetId);
    } else {
      const res = LibraryStorage.returnBook(targetId);
      if (res.success) {
        const freshBooks = LibraryStorage.getBooks();
        onUpdateBooks?.(freshBooks);
        onBooksUpdated?.(freshBooks, res.message);
      }
    }
  }, [onReturnBook, onUpdateBooks, onBooksUpdated]);

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
    notifyGlassToast({
      type: 'info',
      title: 'Export Saved',
      message: 'Catalog CSV import template downloaded.',
      meta: 'ULM_Books_Catalog_Import_Template.csv',
    });
  };

  const handleCopyBarcode = useCallback((barcode: string, bookKey: string) => {
    if (!barcode) return;
    navigator.clipboard?.writeText(barcode).catch(() => {});
    setCopiedBarcodeId(bookKey);
    notifyGlassToast({
      type: 'info',
      title: 'Barcode Copied',
      message: '13-digit barcode copied to clipboard.',
      meta: barcode,
    });
    setTimeout(() => {
      setCopiedBarcodeId((prev) => (prev === bookKey ? null : prev));
    }, 1500);
  }, []);

  const handleToggleExtendPopover = useCallback((key: string) => {
    setExtendPopoverBookId((prev) => {
      if (prev === key) return null;
      setExtendPopoverCount(1);
      return key;
    });
  }, []);

  const handleCloseExtendPopover = useCallback(() => {
    setExtendPopoverBookId(null);
  }, []);

  const extendPopoverCountRef = useRef(extendPopoverCount);
  extendPopoverCountRef.current = extendPopoverCount;
  const booksRef = useRef(books);
  booksRef.current = books;

  // PIPELINE B (Trigger 1): Extend existing book copies in strict series order from Catalog Card or Row
  const handleConfirmExtendBookCopies = useCallback((book: Book) => {
    const countToAdd = Math.max(1, Math.min(50, Number(extendPopoverCountRef.current) || 1));
    const executeExtend = () => {
      const res = AccessionSeriesEngine.addOrExtendBookInSeries(booksRef.current, {
        baseBook: book,
        copiesToAdd: countToAdd,
      });
      const toastMsg = `Added ${countToAdd} new ${countToAdd === 1 ? 'copy' : 'copies'} of "${book.book_name}" in series (#${res.firstAccession} → #${res.lastAccession} • ${res.firstBarcode} → ${res.lastBarcode}).`;
      onUpdateBooks?.(res.updatedCatalog);
      onBooksUpdated?.(res.updatedCatalog, toastMsg);
      void syncMasterExcelRegister();
      setExtendPopoverBookId(null);
      setExtendPopoverCount(1);
      notifyGlassToast({
        type: 'success',
        title: 'Series Copies Added',
        message: `Added ${countToAdd} new ${countToAdd === 1 ? 'copy' : 'copies'} of "${book.book_name}" in series.`,
        meta: `Acc #${res.firstAccession} → #${res.lastAccession} · ${res.firstBarcode}`,
      });
    };

    if (countToAdd >= 10) {
      void runHeavyLibraryTask(
        `Allocating +${countToAdd} Duplicate Copies`,
        `Registering "${book.book_name}" in continuous Accession & 13-digit Barcode series...`,
        async () => {
          executeExtend();
        }
      );
    } else {
      executeExtend();
    }
  }, [onUpdateBooks, onBooksUpdated]);

  const activeSecondaryFilterCount =
    (selectedStatus !== 'all' ? 1 : 0) +
    (selectedGroupFilter !== 'all' ? 1 : 0) +
    (dateFrom || dateTo ? 1 : 0);

  return (
    <div className="w-full px-4 lg:px-6 pt-3 pb-16 select-none">
      <div className="max-w-[1920px] w-full mx-auto space-y-3.5">
        {/* Top 4 Frosted Metric Stat Cards — Clean 3-Tier Layout (No Dashed/Dotted Lines) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          {/* Card 1: Cataloged Titles */}
          <LiquidGlassCard borderRadius="22px" blurIntensity="xl" style={{ animationDelay: '0ms' }} className="ulm-preserve-glass ulm-stagger-card ulm-card-hover p-4 flex flex-col justify-between gap-2 hover:border-[#FFD147]/60">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.13em] text-slate-600 dark:text-slate-300">Cataloged Titles</span>
              <div className="w-7 h-7 rounded-xl bg-purple-500/15 border border-purple-400/30 flex items-center justify-center text-purple-600 dark:text-purple-300">
                <BookOpen className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-[26px] font-bold tabular-nums tracking-tight text-slate-900 dark:text-white leading-none" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                <AnimatedCounter value={totalCataloged} />
              </span>
              <span className="text-[11px] italic font-medium text-slate-500 dark:text-slate-300/80">Distinct records</span>
            </div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              Across {disciplines.length} academic {disciplines.length === 1 ? 'discipline' : 'disciplines'}
            </div>
          </LiquidGlassCard>

          {/* Card 2: Physical Volumes */}
          <LiquidGlassCard borderRadius="22px" blurIntensity="xl" style={{ animationDelay: '45ms' }} className="ulm-preserve-glass ulm-stagger-card ulm-card-hover p-4 flex flex-col justify-between gap-2 hover:border-[#FFD147]/60">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.13em] text-slate-600 dark:text-slate-300">Physical Volumes</span>
              <div className="w-7 h-7 rounded-xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-amber-600 dark:text-[#FFD147]">
                <Layers className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-[26px] font-bold tabular-nums tracking-tight text-slate-900 dark:text-white leading-none" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                <AnimatedCounter value={totalPhysicalVolumes} />
              </span>
              <span className="text-[11px] italic font-medium text-slate-500 dark:text-slate-300/80">Physical items</span>
            </div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              Total holdings in campus collection
            </div>
          </LiquidGlassCard>

          {/* Card 3: Shelf Availability */}
          <LiquidGlassCard borderRadius="22px" blurIntensity="xl" style={{ animationDelay: '90ms' }} className="ulm-preserve-glass ulm-stagger-card ulm-card-hover p-4 flex flex-col justify-between gap-2 hover:border-[#FFD147]/60">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.13em] text-slate-600 dark:text-slate-300">Shelf Availability</span>
              <div className="w-7 h-7 rounded-xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-emerald-600 dark:text-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-[26px] font-bold tabular-nums tracking-tight text-slate-900 dark:text-white leading-none" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                <AnimatedCounter value={totalAvailable} />
              </span>
              <span className="text-[11px] italic font-medium text-slate-500 dark:text-slate-300/80">Available now</span>
            </div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              {totalAvailable.toLocaleString()} / {totalPhysicalVolumes.toLocaleString()} volumes on shelf
            </div>
          </LiquidGlassCard>

          {/* Card 4: Active Loans */}
          <LiquidGlassCard borderRadius="22px" blurIntensity="xl" style={{ animationDelay: '135ms' }} className="ulm-preserve-glass ulm-stagger-card ulm-card-hover p-4 flex flex-col justify-between gap-2 hover:border-[#FFD147]/60">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.13em] text-slate-600 dark:text-slate-300">Active Loans</span>
              <div className="w-7 h-7 rounded-xl bg-sky-500/15 border border-sky-400/30 flex items-center justify-center text-sky-600 dark:text-sky-300">
                <Clock className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-[26px] font-bold tabular-nums tracking-tight text-slate-900 dark:text-white leading-none" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                <AnimatedCounter value={activeLoans} />
              </span>
              <span className="text-[11px] italic font-medium text-slate-500 dark:text-slate-300/80">On loan</span>
            </div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              Currently checked out to members
            </div>
          </LiquidGlassCard>
        </div>

        {/* =========================================================================
            2. FROSTED LIQUID-GLASS SEARCH & FILTER TOOLBAR
            ========================================================================= */}
        <LiquidGlassCard
          borderRadius="22px"
          blurIntensity="xl"
          shadowIntensity="sm"
          glowIntensity="xs"
          className="ulm-preserve-glass p-3 space-y-2.5"
        >
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
                className="ulm-compact-control w-full h-[38px] pl-10 pr-3.5 rounded-xl text-xs font-medium bg-white/55 dark:bg-[#1B1130]/75 backdrop-blur-xl border border-white/60 dark:border-white/15 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#C8963E] transition-all"
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
            <CatalogGlassDropdown
              value={selectedDiscipline}
              onChange={handleDisciplineChange}
              ariaLabel="Filter by Academic Discipline"
              minWidthClass="min-w-[142px]"
              maxWidthClass="max-w-[172px]"
              options={disciplineOptions}
            />

            {/* Compact Dropdown 2: Languages */}
            <CatalogGlassDropdown
              value={selectedLanguage}
              onChange={handleLanguageChange}
              ariaLabel="Filter by Language"
              minWidthClass="min-w-[134px]"
              maxWidthClass="max-w-[158px]"
              options={languageOptions}
            />

            {/* Compact Dropdown 3: Almaris */}
            <CatalogGlassDropdown
              value={selectedAlmari}
              onChange={handleAlmariChange}
              ariaLabel="Filter by Almari Cupboard"
              minWidthClass="min-w-[132px]"
              maxWidthClass="max-w-[168px]"
              options={almariOptions}
            />

            {/* Compact Dropdown 4: Sort */}
            <CatalogGlassDropdown
              value={sortBy}
              onChange={handleSortChange}
              ariaLabel="Sort Catalog Records"
              minWidthClass="min-w-[138px]"
              maxWidthClass="max-w-[168px]"
              options={SORT_OPTIONS}
            />

            {/* Filter Toggle Button */}
            <button
              type="button"
              onClick={() => setIsSecondaryFiltersOpen(!isSecondaryFiltersOpen)}
              className={`h-[38px] px-3.5 rounded-xl text-xs font-semibold backdrop-blur-xl border flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors ${
                isSecondaryFiltersOpen || activeSecondaryFilterCount > 0
                  ? 'bg-amber-500/15 border-[#C8963E] text-[#8A4B00] dark:text-[#FFD147]'
                  : 'bg-white/75 dark:bg-[#1B1130]/80 border-slate-200/90 dark:border-white/15 text-slate-800 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white'
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
              <CatalogGlassDropdown
                compact
                value={selectedStatus}
                onChange={handleStatusChange}
                ariaLabel="Filter by Availability Status"
                minWidthClass="min-w-[126px]"
                maxWidthClass="max-w-[156px]"
                options={STATUS_OPTIONS}
              />

              <CatalogGlassDropdown
                compact
                value={selectedGroupFilter}
                onChange={handleGroupFilterChange}
                ariaLabel="Filter by Almari Subject Group"
                minWidthClass="min-w-[132px]"
                maxWidthClass="max-w-[172px]"
                options={groupOptions}
              />

              <div className="h-8 flex items-center gap-1.5 bg-white/80 dark:bg-black/40 border border-slate-200 dark:border-white/15 rounded-lg px-2.5 text-xs">
                <Calendar className="w-3 h-3 text-[#C8963E]" />
                <span className="text-slate-500 dark:text-slate-400 font-mono text-[10px]">From:</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={handleDateFromChange}
                  style={{ width: 'auto', height: '26px' }}
                  className="ulm-compact-control bg-transparent text-[11px] font-mono text-slate-800 dark:text-white focus:outline-none cursor-pointer"
                />
                <span className="text-slate-500 dark:text-slate-400 font-mono text-[10px]">To:</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={handleDateToChange}
                  style={{ width: 'auto', height: '26px' }}
                  className="ulm-compact-control bg-transparent text-[11px] font-mono text-slate-800 dark:text-white focus:outline-none cursor-pointer"
                />
              </div>

              {activeSecondaryFilterCount > 0 && (
                <button
                  type="button"
                  onClick={handleResetSecondaryFilters}
                  className="text-xs text-[#C8963E] hover:underline font-semibold cursor-pointer ml-auto"
                >
                  Reset Filters
                </button>
              )}
            </div>
          )}

          {/* ROW 2: View Switcher (GRID FIRST) & Compact Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/50 dark:border-white/10">
            {/* iOS Segmented Capsule: Grid View FIRST with Waterline Liquid Physics */}
            <div
              ref={viewSwitcherRef}
              className="relative isolate inline-flex items-center rounded-xl bg-black/5 dark:bg-black/35 backdrop-blur-xl p-0.5 border border-slate-200/80 dark:border-white/10 gap-0.5"
            >
              <LiquidPillOverlay
                containerRef={viewSwitcherRef}
                itemRefs={viewItemRefs}
                activeKey={catalogView}
                axis="x"
                variant="purple-pill"
                triggerTick={animTick}
              />

              <button
                ref={(el) => {
                  viewItemRefs.current['grid'] = el;
                }}
                type="button"
                onClick={() => handleSelectCatalogView('grid')}
                aria-pressed={catalogView === 'grid'}
                data-liquid-active={catalogView === 'grid' ? 'true' : undefined}
                className={`relative z-10 h-8 px-3 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  catalogView === 'grid'
                    ? '!text-white'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                <span
                  className="ulm-nv-ico"
                  key={catalogView === 'grid' ? animTick : 0}
                  data-fx={catalogView === 'grid' ? iconFxForMode('grid') : undefined}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </span>
                <span>Grid View</span>
              </button>

              <button
                ref={(el) => {
                  viewItemRefs.current['list'] = el;
                }}
                type="button"
                onClick={() => handleSelectCatalogView('list')}
                aria-pressed={catalogView === 'list'}
                data-liquid-active={catalogView === 'list' ? 'true' : undefined}
                className={`relative z-10 h-8 px-3 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  catalogView === 'list'
                    ? '!text-white'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                <span
                  className="ulm-nv-ico"
                  key={catalogView === 'list' ? animTick : 0}
                  data-fx={catalogView === 'list' ? iconFxForMode('list') : undefined}
                >
                  <List className="w-3.5 h-3.5" />
                </span>
                <span>List View</span>
              </button>

              <button
                ref={(el) => {
                  viewItemRefs.current['almaris'] = el;
                }}
                type="button"
                onClick={() => handleSelectCatalogView('almaris')}
                aria-pressed={catalogView === 'almaris'}
                data-liquid-active={catalogView === 'almaris' ? 'true' : undefined}
                className={`relative z-10 h-8 px-3 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  catalogView === 'almaris'
                    ? '!text-white'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                <span
                  className="ulm-nv-ico"
                  key={catalogView === 'almaris' ? animTick : 0}
                  data-fx={catalogView === 'almaris' ? iconFxForMode('almaris') : undefined}
                >
                  <Library className="w-3.5 h-3.5" />
                </span>
                <span>Almari View</span>
              </button>

              <button
                ref={(el) => {
                  viewItemRefs.current['analytics'] = el;
                }}
                type="button"
                onClick={() => handleSelectCatalogView('analytics')}
                aria-pressed={catalogView === 'analytics'}
                data-liquid-active={catalogView === 'analytics' ? 'true' : undefined}
                className={`relative z-10 h-8 px-3 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  catalogView === 'analytics'
                    ? '!text-white'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                <span
                  className="ulm-nv-ico"
                  key={catalogView === 'analytics' ? animTick : 0}
                  data-fx={catalogView === 'analytics' ? iconFxForMode('analytics') : undefined}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                </span>
                <span>Analytics</span>
              </button>
            </div>

            {/* Action Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={handleImportExcelAction}
                className="ulm-btn-tactile h-8 px-2.5 rounded-lg text-xs font-semibold bg-white/70 dark:bg-white/10 border border-slate-200 dark:border-white/15 text-slate-800 dark:text-slate-200 hover:bg-white dark:hover:bg-white/15 cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Upload className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span>Import</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (onOpenBatchLabelPrint) {
                    onOpenBatchLabelPrint();
                  } else if (onPrintBarcode && paginatedEntries[0]) {
                    onPrintBarcode(paginatedEntries[0].book);
                  }
                }}
                className="ulm-btn-tactile h-8 px-2.5 rounded-lg text-xs font-semibold bg-white/70 dark:bg-white/10 border border-slate-200 dark:border-white/15 text-slate-800 dark:text-slate-200 hover:bg-white dark:hover:bg-white/15 cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Printer className="w-3 h-3 text-slate-500" />
                <span>Print Barcodes</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadCsvTemplate}
                className="ulm-btn-tactile h-8 px-2.5 rounded-lg text-xs font-semibold bg-white/70 dark:bg-white/10 border border-slate-200 dark:border-white/15 text-slate-800 dark:text-slate-200 hover:bg-white dark:hover:bg-white/15 cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <FileSpreadsheet className="w-3 h-3 text-[#C8963E]" />
                <span>CSV Template</span>
              </button>

              <button
                type="button"
                onClick={onOpenAddBook}
                className="ulm-btn-tactile h-8 px-3.5 rounded-lg text-xs font-extrabold bg-gradient-to-r from-[#541A72] to-[#B4690E] !text-white border border-[#FFD147]/50 shadow-xs hover:brightness-110 cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5 !text-white" />
                <span className="!text-white">Add Book</span>
              </button>
            </div>
          </div>
        </LiquidGlassCard>

        {/* Professional Frosted Crystal Floating Bulk Action Bar */}
        {selectedBookIds.size > 0 && (
          <div
            style={{ animationDuration: '200ms' }}
            className="ulm-preserve-glass ulm-stagger-card rounded-[20px] px-4 py-2.5 bg-gradient-to-r from-white/92 via-white/85 to-white/90 dark:from-[#1D1234]/95 dark:via-[#170E2B]/92 dark:to-[#1E1336]/95 backdrop-blur-2xl backdrop-saturate-[185%] border border-amber-500/45 dark:border-[#FFD147]/40 shadow-[0_12px_32px_rgba(15,23,42,0.12)] dark:shadow-[0_12px_32px_rgba(0,0,0,0.45)] flex flex-wrap items-center justify-between gap-2.5"
          >
            {/* Left: Live Selection Counter + Quick Select Page / Select All */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/18 border border-amber-500/40 text-amber-800 dark:text-[#FFD147] font-['JetBrains_Mono'] font-extrabold text-[11.5px] tabular-nums">
                <Check className="w-3.5 h-3.5 stroke-[2.75]" />
                <span>{selectedBookIds.size} selected</span>
              </span>

              <button
                type="button"
                onClick={handleToggleSelectAll}
                className="ulm-btn-tactile h-8 px-2.5 rounded-xl bg-slate-900/[0.05] hover:bg-slate-900/[0.10] dark:bg-white/[0.06] dark:hover:bg-white/[0.12] border border-slate-300/70 dark:border-white/[0.12] text-slate-700 dark:text-slate-200 text-[11px] font-semibold transition-colors cursor-pointer"
              >
                Select Page
              </button>

              {selectedBookIds.size < filteredEntries.length && (
                <button
                  type="button"
                  onClick={handleSelectAllFiltered}
                  className="ulm-btn-tactile h-8 px-2.5 rounded-xl bg-slate-900/[0.05] hover:bg-slate-900/[0.10] dark:bg-white/[0.06] dark:hover:bg-white/[0.12] border border-slate-300/70 dark:border-white/[0.12] text-slate-700 dark:text-slate-200 text-[11px] font-semibold transition-colors cursor-pointer tabular-nums"
                >
                  Select All ({filteredEntries.length.toLocaleString()})
                </button>
              )}
            </div>

            {/* Right: Bulk Actions */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setBulkModalMode('assign_almari')}
                className="ulm-btn-tactile h-8 px-3 rounded-xl bg-amber-500/18 hover:bg-amber-500/28 border border-amber-500/45 text-amber-900 dark:text-[#FFD147] font-bold text-[11px] inline-flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Building2 className="w-3.5 h-3.5 shrink-0" />
                <span>Place in Almari</span>
              </button>

              <button
                type="button"
                onClick={() => setBulkModalMode('assign_group')}
                className="ulm-btn-tactile h-8 px-3 rounded-xl bg-purple-600/18 hover:bg-purple-600/28 border border-purple-500/40 text-purple-900 dark:text-purple-200 font-bold text-[11px] inline-flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 shrink-0" />
                <span>Assign Group</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const ids = selectedBooksList.map((b) => b.id);
                  if (onOpenBatchLabelPrint) {
                    onOpenBatchLabelPrint(ids);
                  }
                }}
                className="ulm-btn-tactile h-8 px-3 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/40 text-sky-800 dark:text-sky-300 font-bold text-[11px] inline-flex items-center gap-1.5 transition-all cursor-pointer tabular-nums"
              >
                <Printer className="w-3.5 h-3.5 shrink-0" />
                <span>Print Barcodes ({selectedBookIds.size})</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (selectedBooksList.length === 0) return;
                  if (onDeleteSelectedBooks) {
                    onDeleteSelectedBooks(selectedBooksList);
                  } else if (selectedBooksList.length === 1 && onDeleteBook) {
                    onDeleteBook(selectedBooksList[0]);
                  }
                }}
                className="ulm-btn-tactile h-8 px-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/40 text-rose-700 dark:text-rose-400 font-bold text-[11px] inline-flex items-center gap-1.5 transition-all cursor-pointer tabular-nums"
              >
                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                <span>Delete Selected ({selectedBookIds.size})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedBookIds(new Set());
                  lastSelectedIndexRef.current = null;
                }}
                className="ulm-btn-tactile h-8 px-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.08] text-[11px] font-semibold transition-colors cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* =========================================================================
            3. CONDITIONAL VIEWS (GRID VIEW FIRST)
            ========================================================================= */}
        <div
          key={catalogView}
          className={`ulm-page-enter transition-opacity duration-150 ${isPending ? 'opacity-75' : 'opacity-100'}`}
        >
        {/* VIEW A: IPHONE LIQUID-GLASS GRID VIEW (DEFAULT) */}
        {catalogView === 'grid' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
            {paginatedEntries.map((entry, cardIdx) => (
              <CatalogBookCard
                key={entry.bookKey}
                entry={entry}
                cardIdx={cardIdx}
                isSelected={selectedBookIds.has(entry.bookKey)}
                isCopied={copiedBarcodeId === entry.bookKey}
                isExtendOpen={extendPopoverBookId === entry.bookKey}
                extendCount={extendPopoverBookId === entry.bookKey ? extendPopoverCount : 1}
                nextSeriesAccession={nextSeriesAccession}
                onSelectBook={onSelectBook}
                onToggleSelect={handleToggleSelectOne}
                onIssue={handleIssueBookAction}
                onReturn={handleReturnCopyAction}
                onToggleExtend={handleToggleExtendPopover}
                onCloseExtend={handleCloseExtendPopover}
                onChangeExtendCount={setExtendPopoverCount}
                onConfirmExtend={handleConfirmExtendBookCopies}
                onCopyBarcode={handleCopyBarcode}
                onEditBook={onEditBook}
                onDeleteBook={onDeleteBook}
              />
            ))}
          </div>
        )}

        {/* VIEW B: LIST VIEW (AUTO-ADJUSTING BALANCED TABLE) */}
        {catalogView === 'list' && (
          <LiquidGlassCard
            borderRadius="22px"
            blurIntensity="xl"
            className="ulm-preserve-glass overflow-hidden border border-white/55 dark:border-white/[0.14]"
          >
            <div className="overflow-x-auto">
              <table className="w-full table-auto border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-white/10 bg-slate-900/[0.03] dark:bg-white/[0.03] text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300 divide-x divide-slate-200/40 dark:divide-white/[0.05]">
                    <th className="w-10 px-3 py-3 text-center">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={allPageSelected}
                        aria-label="Select all volumes on current page"
                        onClick={handleToggleSelectAll}
                        className={`w-5 h-5 mx-auto rounded-md border flex items-center justify-center transition-colors cursor-pointer ${
                          allPageSelected
                            ? 'bg-gradient-to-br from-[#FFD147] to-[#D4A02A] border-[#FFD147] text-slate-950 shadow-xs'
                            : 'bg-white/80 dark:bg-white/[0.06] border-slate-300 dark:border-white/25 hover:border-amber-400'
                        }`}
                      >
                        {allPageSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </button>
                    </th>
                    <th className="px-3.5 py-3 min-w-[180px] max-w-[260px]">Book Title & Author</th>
                    <th className="px-3.5 py-3 whitespace-nowrap">Category</th>
                    <th className="px-3.5 py-3 whitespace-nowrap">Language</th>
                    <th className="px-3.5 py-3 whitespace-nowrap">Barcode / Call No</th>
                    <th className="px-3 py-3 text-center whitespace-nowrap w-16">Total</th>
                    <th className="px-3 py-3 text-center whitespace-nowrap w-20">Avail</th>
                    <th className="px-3.5 py-3 whitespace-nowrap">Shelf / Row</th>
                    <th className="px-3.5 py-3 text-right whitespace-nowrap w-44">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-white/[0.06] text-xs">
                  {paginatedEntries.map((entry, idx) => (
                    <CatalogListRow
                      key={entry.bookKey}
                      entry={entry}
                      idx={idx}
                      seqNo={(safeCurrentPage - 1) * safePageSize + idx + 1}
                      isSelected={selectedBookIds.has(entry.bookKey)}
                      isExtendOpen={extendPopoverBookId === `row-${entry.bookKey}`}
                      extendCount={extendPopoverBookId === `row-${entry.bookKey}` ? extendPopoverCount : 1}
                      nextSeriesAccession={nextSeriesAccession}
                      onSelectBook={onSelectBook}
                      onToggleSelect={handleToggleSelectOne}
                      onIssue={handleIssueBookAction}
                      onReturn={handleReturnCopyAction}
                      onToggleExtend={handleToggleExtendPopover}
                      onChangeExtendCount={setExtendPopoverCount}
                      onConfirmExtend={handleConfirmExtendBookCopies}
                      onEditBook={onEditBook}
                      onDeleteBook={onDeleteBook}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </LiquidGlassCard>
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
              startTransition(() => {
                setSelectedDiscipline(cat);
                setCurrentPage(1);
                setCatalogView('grid');
              });
            }}
            onSwitchView={(mode) => handleSelectCatalogView(mode)}
          />
        )}
        </div>

        {/* =========================================================================
            4. COMPACT PAGINATION FOOTER (44px HEIGHT)
            ========================================================================= */}
        {catalogView !== 'analytics' && catalogView !== 'almaris' && (
          <div className="h-11 rounded-xl bg-white/60 dark:bg-[#140D22]/60 backdrop-blur-xl border border-[#C8963E]/30 dark:border-white/10 px-4 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 shadow-xs">
            <div className="flex items-center gap-3">
              <span>
                Showing{' '}
                <strong>
                  {filteredEntries.length === 0
                    ? 0
                    : ((safeCurrentPage - 1) * safePageSize + 1).toLocaleString()}
                </strong>{' '}
                to{' '}
                <strong>
                  {Math.min(safeCurrentPage * safePageSize, filteredEntries.length).toLocaleString()}
                </strong>{' '}
                of <strong>{filteredEntries.length.toLocaleString()}</strong> books
              </span>
              <div className="flex items-center gap-1.5">
                <span>Per page:</span>
                <select
                  value={safePageSize}
                  onChange={handlePageSizeChange}
                  style={{ width: 'auto', height: '28px' }}
                  className="ulm-compact-control w-auto h-7 px-1.5 rounded-lg bg-white/80 dark:bg-black/35 border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white text-[11px] cursor-pointer"
                >
                  <option value={24}>24</option>
                  <option value={36}>36</option>
                  <option value={48}>48</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={safeCurrentPage <= 1}
                onClick={() => startTransition(() => setCurrentPage(1))}
                className="p-1 rounded-md border border-slate-200 dark:border-white/10 disabled:opacity-30 hover:bg-black/5 cursor-pointer"
              >
                <ChevronsLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={safeCurrentPage <= 1}
                onClick={() => startTransition(() => setCurrentPage((p) => Math.max(1, p - 1)))}
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
                onClick={() => startTransition(() => setCurrentPage((p) => Math.min(totalPages, p + 1)))}
                className="p-1 rounded-md border border-slate-200 dark:border-white/10 disabled:opacity-30 hover:bg-black/5 cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={safeCurrentPage >= totalPages}
                onClick={() => startTransition(() => setCurrentPage(totalPages))}
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
              const updatedById = new Map(updatedBooks.map((b) => [b.id, b]));
              const mergedCatalog = books.map((b) => updatedById.get(b.id) || b);
              if (onBooksUpdated) onBooksUpdated(mergedCatalog, msg, batchId);
            }}
          />
        )}
      </div>
    </div>
  );
};

export default BooksCatalogView;
