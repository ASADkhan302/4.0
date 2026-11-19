import React, { useState, useMemo, useRef } from 'react';
import { 
  ArrowRightLeft, 
  ArrowLeftRight,
  RotateCcw, 
  User, 
  BookOpen, 
  Barcode as BarcodeIcon, 
  Plus, 
  Clock, 
  Calendar, 
  X, 
  Loader2, 
  Check,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Search,
  LayoutGrid,
  List
} from 'lucide-react';
import { Transaction, Book, Borrower } from '../types/library';
import CustomSelect from './ui/CustomSelect';
import { TabCardItem } from './shared/TabCards';
import { StatusPill } from './shared/StatusPill';
import { DataTable, ColumnDef } from './shared/DataTable';
import { SharedCountService } from '../services/sharedCountService';
import { LiquidGlassCard } from './ui/liquid-weather-glass';
import { LiquidPillOverlay, LiquidIconFx } from './ui/liquid-pill-physics';

interface CirculationDeskProps {
  transactions: Transaction[];
  books: Book[];
  borrowers: Borrower[];
  onIssueBook: (bookId: string, borrowerId: string, days: number) => { success: boolean; message: string } | void;
  onOpenIssueDialog?: () => void;
  onReturnBook: (transactionId: string) => void;
  onOpenBookDetails: (bookId: string) => void;
  onOpenBorrowerDetails: (borrowerId: string) => void;
}

export const CirculationDeskView: React.FC<CirculationDeskProps> = ({
  transactions,
  books,
  borrowers,
  onIssueBook,
  onOpenIssueDialog,
  onReturnBook,
  onOpenBookDetails,
  onOpenBorrowerDetails,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'OVERDUE' | 'RETURNED'>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const viewSwitcherRef = useRef<HTMLDivElement | null>(null);
  const viewItemRefs = useRef<Record<string, HTMLElement | null>>({});
  const [animTick, setAnimTick] = useState(1);

  const iconFxForMode = (mode: 'grid' | 'list'): LiquidIconFx => (mode === 'grid' ? 'pop' : 'hop');

  const handleSelectViewMode = (mode: 'grid' | 'list') => {
    setAnimTick((t) => t + 1);
    setViewMode(mode);
  };

  // Issue modal/form inline controls
  const [isIssuing, setIsIssuing] = useState(false);
  const [selectedBookId, setSelectedBookId] = useState('');
  const [selectedBorrowerId, setSelectedBorrowerId] = useState('');
  const [loanPeriodDays, setLoanPeriodDays] = useState(14);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [issueButtonState, setIssueButtonState] = useState<'idle' | 'loading' | 'success'>('idle');
  const [returningTxState, setReturningTxState] = useState<Record<string, 'loading' | 'success' | 'idle'>>({});

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Shared aggregates calculation (Part 1.8)
  const sharedCounts = useMemo(() => {
    return SharedCountService.computeCounts(books, borrowers, transactions, todayStr);
  }, [books, borrowers, transactions, todayStr]);

  // Active available books for issue
  const availableBooks = useMemo(() => {
    return books.filter(b => b.is_active && b.available_quantity > 0);
  }, [books]);

  // Active borrowers
  const activeBorrowers = useMemo(() => {
    return borrowers.filter(b => b.is_active);
  }, [borrowers]);

  // Filtered transactions
  const filteredTxs = useMemo(() => {
    return transactions.filter(t => {
      const query = searchQuery.toLowerCase().trim();
      const matchesQuery = !query ||
        (t.book_name && t.book_name.toLowerCase().includes(query)) ||
        (t.borrower_name && t.borrower_name.toLowerCase().includes(query)) ||
        (t.barcode && t.barcode.toLowerCase().includes(query)) ||
        (t.student_id && t.student_id.toLowerCase().includes(query));

      const isReturned = t.status === 'RETURNED' || Boolean(t.return_date);
      const isOverdue = !isReturned && (t.status === 'OVERDUE' || (t.due_date && t.due_date < todayStr));
      const isActive = !isReturned && !isOverdue;

      if (statusFilter === 'ALL') return matchesQuery;
      if (statusFilter === 'OVERDUE') return matchesQuery && isOverdue;
      if (statusFilter === 'ACTIVE') return matchesQuery && isActive;
      if (statusFilter === 'RETURNED') return matchesQuery && isReturned;
      return matchesQuery;
    });
  }, [transactions, searchQuery, statusFilter, todayStr]);

  const handleCreateIssue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBookId) {
      setIssueError('Please select a book title with available shelf copies.');
      return;
    }
    if (!selectedBorrowerId) {
      setIssueError('Please select a registered library member.');
      return;
    }

    setIssueButtonState('loading');
    setTimeout(() => {
      const res = onIssueBook(selectedBookId, selectedBorrowerId, loanPeriodDays);
      if (res && !res.success) {
        setIssueError(res.message);
        setIssueButtonState('idle');
        return;
      }

      setIssueButtonState('success');
      setTimeout(() => {
        setSelectedBookId('');
        setSelectedBorrowerId('');
        setIsIssuing(false);
        setIssueError(null);
        setIssueButtonState('idle');
      }, 1200);
    }, 200);
  };

  const handleReturnAction = (transactionId: string) => {
    setReturningTxState(prev => ({ ...prev, [transactionId]: 'loading' }));
    setTimeout(() => {
      setReturningTxState(prev => ({ ...prev, [transactionId]: 'success' }));
      setTimeout(() => {
        onReturnBook(transactionId);
        setReturningTxState(prev => {
          const next = { ...prev };
          delete next[transactionId];
          return next;
        });
      }, 1200);
    }, 200);
  };

  // Helper to calculate days overdue
  const getDaysOverdue = (dueDateStr: string): number => {
    if (!dueDateStr) return 0;
    const dueTime = new Date(dueDateStr).getTime();
    const todayTime = new Date(todayStr).getTime();
    const diff = Math.floor((todayTime - dueTime) / (1000 * 3600 * 24));
    return Math.max(0, diff);
  };

  // Helper for initials
  const getInitials = (name: string): string => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Books lookup map for clean accession numbers on loan cards
  const booksMap = useMemo(() => new Map(books.map(b => [b.id, b])), [books]);
  const getLoanAccessionLabel = (tx: Transaction): string => {
    const b = booksMap.get(tx.book_id) || books.find(book => book.barcode === tx.barcode);
    if (b?.accession_no) return `Acc #${b.accession_no}`;
    if (tx.barcode) return `Acc #${tx.barcode}`;
    return 'Acc #00001';
  };

  // Four COUNT values and fractions for restyled Circulation Filter Cards
  const allLoansCount = transactions.length;
  // Shared count definition: active loans excluding overdue loans (not yet due)
  const activeLoansCount = Math.max(0, sharedCounts.activeLoans - sharedCounts.overdueLoans);
  const overdueLoansCount = sharedCounts.overdueLoans;
  const returnedLoansCount = sharedCounts.totalReturned;

  // Fraction calculations with zero-division safety (never NaN or Infinity)
  const activeFraction = allLoansCount > 0 ? activeLoansCount / allLoansCount : 0;
  const overdueFraction = allLoansCount > 0 ? overdueLoansCount / allLoansCount : 0;
  const returnedFraction = allLoansCount > 0 ? returnedLoansCount / allLoansCount : 0;

  // Stacked segments for All Loans card: active in green, overdue in danger, returned in muted blue
  const allLoansSegments = [
    { fraction: activeFraction, color: '#34D399', label: 'Active' },
    { fraction: overdueFraction, color: '#FB7185', label: 'Overdue' },
    { fraction: returnedFraction, color: '#6FA8D2', label: 'Returned' },
  ];

  // Preserved filterTabItems definition for reference and compatibility
  const filterTabItems: TabCardItem<'ALL' | 'ACTIVE' | 'OVERDUE' | 'RETURNED'>[] = [
    {
      id: 'ALL',
      label: 'All Loans',
      count: allLoansCount,
      accentColor: '#A66BC9', // purple
    },
    {
      id: 'ACTIVE',
      label: 'Active Loans',
      count: activeLoansCount,
      accentColor: '#34D399', // green
    },
    {
      id: 'OVERDUE',
      label: 'Overdue',
      count: overdueLoansCount,
      accentColor: '#FB7185', // danger
    },
    {
      id: 'RETURNED',
      label: 'Returned',
      count: returnedLoansCount,
      accentColor: '#6FA8D2', // muted-blue
    },
  ];

  // List View Columns
  const listColumns: ColumnDef<Transaction>[] = [
    {
      header: 'Accession / ID',
      width: '130px',
      cell: (tx) => (
        <span className="font-mono text-[12px] text-[#E0B450] font-bold" title={`Transaction ${tx.id} · Barcode ${tx.barcode || ''}`}>
          {getLoanAccessionLabel(tx)}
        </span>
      ),
    },
    {
      header: 'Status',
      width: '130px',
      cell: (tx) => {
        const isReturned = tx.status === 'RETURNED' || Boolean(tx.return_date);
        const isOverdue = !isReturned && (tx.status === 'OVERDUE' || (tx.due_date && tx.due_date < todayStr));
        if (isReturned) return <StatusPill label="Returned" variant="muted" dot />;
        if (isOverdue) return <StatusPill label="Overdue" variant="danger" dot />;
        return <StatusPill label="Active Loan" variant="green" dot />;
      },
    },
    {
      header: 'Book Title',
      cell: (tx) => (
        <div className="min-w-[180px]">
          <button
            type="button"
            onClick={() => onOpenBookDetails(tx.book_id)}
            className="text-[13px] font-semibold text-white hover:text-[#E0B450] text-left transition-colors cursor-pointer truncate max-w-[280px] block"
            title={tx.book_name}
            dir="auto"
          >
            {tx.book_name}
          </button>
          <span className="font-mono text-[11px] text-[#B3AABD] flex items-center gap-1 mt-0.5">
            <BarcodeIcon className="w-3 h-3 text-[#BC881B]" />
            <span>{tx.barcode}</span>
          </span>
        </div>
      ),
    },
    {
      header: 'Borrower',
      cell: (tx) => (
        <div className="flex items-center gap-2 min-w-[170px]">
          <div className="w-7 h-7 rounded-full bg-[#541A72]/30 border border-[#A66BC9]/30 text-[#C084FC] flex items-center justify-center font-bold text-[10px] shrink-0">
            {getInitials(tx.borrower_name || '')}
          </div>
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => onOpenBorrowerDetails(tx.borrower_id)}
              className="text-[13px] font-semibold text-white hover:text-[#E0B450] text-left transition-colors cursor-pointer truncate max-w-[150px] block"
              title={tx.borrower_name}
              dir="auto"
            >
              {tx.borrower_name}
            </button>
            <span className="font-mono text-[11px] font-bold text-[#E0B450]">
              {tx.student_id}
            </span>
          </div>
        </div>
      ),
    },
    {
      header: 'Issued Date',
      cell: (tx) => (
        <span className="font-mono text-[12px] text-[#B3AABD]">
          {tx.issue_date || 'N/A'}
        </span>
      ),
    },
    {
      header: 'Due Date',
      cell: (tx) => {
        const isReturned = tx.status === 'RETURNED' || Boolean(tx.return_date);
        const isOverdue = !isReturned && (tx.status === 'OVERDUE' || (tx.due_date && tx.due_date < todayStr));
        const daysOverdue = isOverdue ? getDaysOverdue(tx.due_date) : 0;

        return (
          <div className="flex items-center gap-2">
            <span className={`font-mono text-[13px] ${isOverdue ? 'text-rose-400 font-bold' : 'text-white'}`}>
              {tx.due_date || 'N/A'}
            </span>
            {isOverdue && daysOverdue > 0 && (
              <StatusPill label={`${daysOverdue}d overdue`} variant="danger" />
            )}
          </div>
        );
      },
    },
    {
      header: 'Action',
      align: 'right',
      width: '160px',
      cell: (tx) => {
        const isReturned = tx.status === 'RETURNED' || Boolean(tx.return_date);
        if (isReturned) {
          return (
            <span className="text-[12px] font-mono text-[#B3AABD] flex items-center justify-end gap-1">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Returned {tx.return_date || ''}</span>
            </span>
          );
        }

        const state = returningTxState[tx.id] || 'idle';

        return (
          <button
            type="button"
            onClick={() => handleReturnAction(tx.id)}
            disabled={state !== 'idle'}
            className="h-9 px-3.5 rounded-[8px] border border-[#34D399]/40 text-[#34D399] hover:bg-[rgba(52,211,153,0.12)] active:scale-95 text-[12px] font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer ml-auto"
            title="Return checked out volume"
          >
            {state === 'loading' ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Returning...</span>
              </>
            ) : state === 'success' ? (
              <>
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>Returned</span>
              </>
            ) : (
              <>
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Return Copy</span>
              </>
            )}
          </button>
        );
      },
    },
  ];

  return (
    <div className="w-full h-auto min-h-0 flex flex-col gap-5 px-4 sm:px-6 lg:px-8 pt-5 pb-12 overflow-visible">
      <div className="max-w-[1920px] w-full mx-auto space-y-5">

        {/* 1. Top Page Header Banner (Circulation Desk & Loan Registry) */}
        <div className="ulm-preserve-glass rounded-[24px] p-4 sm:p-5 bg-gradient-to-br from-white/60 via-white/40 to-white/25 dark:from-white/[0.08] dark:via-white/[0.035] dark:to-white/[0.015] backdrop-blur-2xl backdrop-saturate-[180%] border border-white/70 dark:border-white/[0.15] shadow-[inset_1.5px_1.5px_2px_rgba(255,255,255,0.65),0_10px_28px_rgba(15,23,42,0.06)] dark:shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.22),0_10px_28px_rgba(0,0,0,0.22)] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-[#C8963E]/15 border border-[#C8963E]/40 flex items-center justify-center text-[#C8963E] shrink-0 shadow-2xs">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2
                className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight truncate"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                Circulation Desk &amp; Loan Registry
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 truncate">
                Process campus checkouts, returns, loan renewals, and overdue records.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (onOpenIssueDialog) {
                onOpenIssueDialog();
              } else {
                setIsIssuing(!isIssuing);
                setIssueError(null);
              }
            }}
            className="h-10 px-4 rounded-xl bg-gradient-to-r from-[#BC881B] to-[#D4A02A] hover:from-[#D4A02A] hover:to-[#E0B450] !text-[#1A1A1A] font-bold text-[13px] shadow-[0_2px_12px_rgba(188,136,27,0.35)] hover:shadow-[0_4px_16px_rgba(188,136,27,0.5)] border border-[#E0B450]/40 transition-all duration-150 inline-flex items-center justify-center gap-2 cursor-pointer shrink-0"
            title="Open Issue Book Flow"
          >
            <Plus className="w-4 h-4 stroke-[2.5] !text-[#1A1A1A]" />
            <span className="!text-[#1A1A1A]">{isIssuing ? 'Cancel Issue' : 'Issue Book to Member'}</span>
          </button>
        </div>

        {/* Issue Drawer Form */}
        {isIssuing && (
          <form 
            onSubmit={handleCreateIssue}
            className="ulm-preserve-glass rounded-[22px] bg-gradient-to-br from-white/75 via-white/55 to-white/40 dark:from-[#1B1030]/90 dark:via-[#140B24]/85 dark:to-[#0E071B]/80 backdrop-blur-2xl border border-white/80 dark:border-[#BC881B]/45 p-5 sm:p-6 shadow-lg space-y-4 animate-in fade-in duration-200"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#2E2A33] pb-3">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
                <BookOpen className="w-4 h-4 text-[#E0B450]" />
                <span>New Book Issue Transaction</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="hidden sm:inline-block text-[11px] font-mono text-slate-500 dark:text-[#B3AABD]">
                  Auto-updates catalog shelf availability
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsIssuing(false);
                    setIssueError(null);
                  }}
                  className="p-1 rounded-[6px] text-slate-400 dark:text-[#B3AABD] hover:text-slate-700 dark:hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
                  title="Close Issue Form"
                  aria-label="Close"
                >
                  <X className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>
            </div>

            {issueError && (
              <div className="p-3 rounded-[10px] bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0" />
                <span>{issueError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Select Book */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#E7E2EC] mb-2 tracking-wide">
                  Select Book Title (Available Stock) <span className="text-[#E0B450]">*</span>
                </label>
                <CustomSelect
                  value={selectedBookId}
                  onChange={(val) => setSelectedBookId(val)}
                  placeholder="-- Choose Book from Stacks --"
                  options={availableBooks.map(b => ({
                    value: b.id,
                    label: b.book_name,
                    sublabel: `${b.barcode} · ${b.author}`,
                    badge: `${b.available_quantity} Avail`
                  }))}
                  searchable
                  variant="dark"
                />
              </div>

              {/* Select Borrower */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#E7E2EC] mb-2 tracking-wide">
                  Select Borrower (Member) <span className="text-[#E0B450]">*</span>
                </label>
                <CustomSelect
                  value={selectedBorrowerId}
                  onChange={(val) => setSelectedBorrowerId(val)}
                  placeholder="-- Choose Member / University ID --"
                  options={activeBorrowers.map(b => ({
                    value: b.id,
                    label: b.name,
                    sublabel: `${b.university_id || b.student_id} · ${b.department}`,
                    badge: b.role || 'Member'
                  }))}
                  searchable
                  variant="dark"
                />
              </div>

              {/* Loan Period */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#E7E2EC] mb-2 tracking-wide">
                  Loan Period Duration
                </label>
                <CustomSelect
                  value={loanPeriodDays}
                  onChange={(val) => setLoanPeriodDays(Number(val))}
                  options={[
                    { value: 7, label: '7 Days (Course Reserve)' },
                    { value: 14, label: '14 Days (Standard Undergraduate Loan)' },
                    { value: 30, label: '30 Days (Faculty / Research Loan)' },
                    { value: 60, label: '60 Days (Semester Extended Grant)' }
                  ]}
                  variant="dark"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-[#2E2A33]">
              <button
                type="button"
                onClick={() => {
                  setIsIssuing(false);
                  setIssueError(null);
                }}
                className="px-4 h-10 rounded-[8px] bg-slate-200/70 dark:bg-white/[0.06] hover:bg-slate-300/70 dark:hover:bg-white/[0.12] text-slate-700 dark:text-[#B3AABD] hover:text-slate-900 dark:hover:text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={issueButtonState !== 'idle'}
                className="px-5 h-10 rounded-[8px] bg-[#BC881B] hover:bg-[#D4A02A] !text-[#1A1A1A] text-xs font-bold shadow-md transition-all cursor-pointer inline-flex items-center gap-2"
              >
                {issueButtonState === 'loading' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin !text-[#1A1A1A]" />
                    <span className="!text-[#1A1A1A]">Validating &amp; Issuing...</span>
                  </>
                ) : issueButtonState === 'success' ? (
                  <>
                    <Check className="w-4 h-4 stroke-[3] !text-[#1A1A1A]" />
                    <span className="!text-[#1A1A1A]">Loan Issued!</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 stroke-[2.5] !text-[#1A1A1A]" />
                    <span className="!text-[#1A1A1A]">Confirm &amp; Issue Loan</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* 2. Top 4 Frosted Loan Metric Stat Cards — Exact Match to Books Catalog (No Dashed Lines) */}
        <div
          role="tablist"
          aria-label="Circulation desk loan status filters"
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          {/* Card 1: ALL LOANS */}
          <LiquidGlassCard
            borderRadius="22px"
            blurIntensity="xl"
            onClick={() => setStatusFilter('ALL')}
            className={`p-4 flex flex-col justify-between gap-2 cursor-pointer transition-all ${
              statusFilter === 'ALL'
                ? 'border-[#FFD147]/70 ring-1 ring-[#FFD147]/45'
                : 'hover:border-[#FFD147]/55'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.13em] text-slate-600 dark:text-slate-300">
                All Loans
              </span>
              <div className="w-7 h-7 rounded-full bg-purple-500/15 border border-purple-400/30 flex items-center justify-center text-purple-600 dark:text-purple-300 shrink-0">
                <ArrowLeftRight className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span
                className="text-[26px] font-bold tabular-nums tracking-tight text-slate-900 dark:text-white leading-none"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                {allLoansCount.toLocaleString()}
              </span>
              <span className="text-[11px] italic font-medium text-slate-500 dark:text-slate-300/80 pr-1">
                total loans
              </span>
            </div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              Active {activeLoansCount}, overdue {overdueLoansCount}, returned {returnedLoansCount} of {allLoansCount}
            </div>
          </LiquidGlassCard>

          {/* Card 2: ACTIVE LOANS */}
          <LiquidGlassCard
            borderRadius="22px"
            blurIntensity="xl"
            onClick={() => setStatusFilter('ACTIVE')}
            className={`p-4 flex flex-col justify-between gap-2 cursor-pointer transition-all ${
              statusFilter === 'ACTIVE'
                ? 'border-[#FFD147]/70 ring-1 ring-[#FFD147]/45'
                : 'hover:border-[#FFD147]/55'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.13em] text-slate-600 dark:text-slate-300">
                Active Loans
              </span>
              <div className="w-7 h-7 rounded-full bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-emerald-600 dark:text-emerald-300 shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span
                className="text-[26px] font-bold tabular-nums tracking-tight text-slate-900 dark:text-white leading-none"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                {activeLoansCount.toLocaleString()}
              </span>
              <span className="text-[11px] italic font-medium text-slate-500 dark:text-slate-300/80 pr-1">
                not yet due
              </span>
            </div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              {activeLoansCount} / {allLoansCount} active loans (not yet due)
            </div>
          </LiquidGlassCard>

          {/* Card 3: OVERDUE */}
          <LiquidGlassCard
            borderRadius="22px"
            blurIntensity="xl"
            onClick={() => setStatusFilter('OVERDUE')}
            className={`p-4 flex flex-col justify-between gap-2 cursor-pointer transition-all ${
              statusFilter === 'OVERDUE'
                ? 'border-[#FFD147]/70 ring-1 ring-[#FFD147]/45'
                : 'hover:border-[#FFD147]/55'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.13em] text-slate-600 dark:text-slate-300">
                Overdue
              </span>
              <div className="w-7 h-7 rounded-full bg-rose-500/15 border border-rose-400/30 flex items-center justify-center text-rose-600 dark:text-rose-300 shrink-0">
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span
                className="text-[26px] font-bold tabular-nums tracking-tight text-slate-900 dark:text-white leading-none"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                {overdueLoansCount.toLocaleString()}
              </span>
              <span className="text-[11px] italic font-medium text-slate-500 dark:text-slate-300/80 pr-1">
                {overdueLoansCount === 0 ? 'none overdue' : 'past due date'}
              </span>
            </div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              {overdueLoansCount} / {allLoansCount} loans overdue
            </div>
          </LiquidGlassCard>

          {/* Card 4: RETURNED */}
          <LiquidGlassCard
            borderRadius="22px"
            blurIntensity="xl"
            onClick={() => setStatusFilter('RETURNED')}
            className={`p-4 flex flex-col justify-between gap-2 cursor-pointer transition-all ${
              statusFilter === 'RETURNED'
                ? 'border-[#FFD147]/70 ring-1 ring-[#FFD147]/45'
                : 'hover:border-[#FFD147]/55'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.13em] text-slate-600 dark:text-slate-300">
                Returned
              </span>
              <div className="w-7 h-7 rounded-full bg-sky-500/15 border border-sky-400/30 flex items-center justify-center text-sky-600 dark:text-sky-300 shrink-0">
                <RotateCcw className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span
                className="text-[26px] font-bold tabular-nums tracking-tight text-slate-900 dark:text-white leading-none"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                {returnedLoansCount.toLocaleString()}
              </span>
              <span className="text-[11px] italic font-medium text-slate-500 dark:text-slate-300/80 pr-1">
                completed
              </span>
            </div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              {returnedLoansCount} / {allLoansCount} loans completed
            </div>
          </LiquidGlassCard>
        </div>

        {/* 3. Single-Row Frosted Search & View Switcher Toolbar (Fixes <Search /> Overlap & Empty Row) */}
        <LiquidGlassCard borderRadius="22px" blurIntensity="xl" className="p-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {/* Search Input with Proper pl-9 Icon Spacing */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by student, University ID, book title, or barcode..."
                className="w-full h-9 pl-9 pr-16 rounded-xl bg-white/55 dark:bg-white/[0.05] border border-slate-300/70 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#FFD147]/75 transition-all"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-400 dark:text-slate-500 bg-slate-200/60 dark:bg-white/[0.06] border border-slate-300/50 dark:border-white/10 pointer-events-none">
                Ctrl + K
              </span>
            </div>

            {/* View Switcher Pills (Same Row — No Empty Second Line) */}
            <div
              ref={viewSwitcherRef}
              className="relative isolate inline-flex items-center rounded-xl bg-slate-900/[0.04] dark:bg-white/[0.04] p-1 border border-slate-300/60 dark:border-white/10 gap-1 shrink-0"
            >
              <LiquidPillOverlay
                containerRef={viewSwitcherRef}
                itemRefs={viewItemRefs}
                activeKey={viewMode}
                axis="x"
                variant="purple-pill"
                triggerTick={animTick}
              />
              <button
                ref={(el) => {
                  viewItemRefs.current['grid'] = el;
                }}
                type="button"
                onClick={() => handleSelectViewMode('grid')}
                data-liquid-active={viewMode === 'grid' ? 'true' : undefined}
                className={`relative z-10 h-7 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                  viewMode === 'grid'
                    ? '!text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-white/40 dark:hover:bg-white/10'
                }`}
              >
                <span
                  className="ulm-nv-ico"
                  key={viewMode === 'grid' ? animTick : 0}
                  data-fx={viewMode === 'grid' ? iconFxForMode('grid') : undefined}
                >
                  <LayoutGrid className={`w-3.5 h-3.5 ${viewMode === 'grid' ? '!text-white' : ''}`} />
                </span>
                <span className={viewMode === 'grid' ? '!text-white' : ''}>Grid View</span>
              </button>
              <button
                ref={(el) => {
                  viewItemRefs.current['list'] = el;
                }}
                type="button"
                onClick={() => handleSelectViewMode('list')}
                data-liquid-active={viewMode === 'list' ? 'true' : undefined}
                className={`relative z-10 h-7 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                  viewMode === 'list'
                    ? '!text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-white/40 dark:hover:bg-white/10'
                }`}
              >
                <span
                  className="ulm-nv-ico"
                  key={viewMode === 'list' ? animTick : 0}
                  data-fx={viewMode === 'list' ? iconFxForMode('list') : undefined}
                >
                  <List className={`w-3.5 h-3.5 ${viewMode === 'list' ? '!text-white' : ''}`} />
                </span>
                <span className={viewMode === 'list' ? '!text-white' : ''}>List View</span>
              </button>
            </div>
          </div>
        </LiquidGlassCard>

        {/* 4. Transactions Display (Grid or List View) */}
        {filteredTxs.length === 0 ? (
          <div className="ulm-preserve-glass rounded-[22px] bg-gradient-to-br from-white/55 via-white/35 to-white/20 dark:from-white/[0.075] dark:via-white/[0.03] dark:to-white/[0.015] backdrop-blur-xl border border-white/65 dark:border-white/[0.14] p-12 text-center text-slate-600 dark:text-[#B3AABD] space-y-3 shadow-sm">
            <ArrowRightLeft className="w-12 h-12 mx-auto text-slate-400 dark:text-[#6F6879]" />
            <h4 className="text-base font-semibold text-slate-900 dark:text-white">No circulation records found</h4>
            <p className="text-xs text-slate-500 dark:text-[#B3AABD] max-w-md mx-auto">
              No active or past loans match your current search query and status filter.
            </p>
            <button
              type="button"
              onClick={() => { setSearchQuery(''); setStatusFilter('ALL'); }}
              className="px-4 py-2 bg-slate-900/[0.05] dark:bg-white/[0.06] hover:bg-slate-900/[0.10] dark:hover:bg-white/[0.12] text-slate-800 dark:text-white text-xs font-semibold rounded-xl border border-slate-300/70 dark:border-white/15 transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              Reset Circulation Filters
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          /* Loan Grid Cards with Frosted Crystal Liquid-Glass & Architectural Status Micro-Tags */
          <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
            {filteredTxs.map((tx, idx) => {
              const isReturned = tx.status === 'RETURNED' || Boolean(tx.return_date);
              const isOverdue = !isReturned && (tx.status === 'OVERDUE' || (tx.due_date && tx.due_date < todayStr));
              const isActiveLoan = !isReturned && !isOverdue;
              const daysOverdue = isOverdue ? getDaysOverdue(tx.due_date) : 0;
              const returnState = returningTxState[tx.id] || 'idle';

              // 4px left status bar color
              const statusColor = isReturned ? '#6F6879' : isOverdue ? '#FB7185' : '#34D399';

              return (
                <div
                  key={tx.id}
                  className="ulm-preserve-glass relative overflow-hidden rounded-[22px] pl-5 pr-4 py-4 bg-gradient-to-br from-white/55 via-white/35 to-white/20 dark:from-white/[0.075] dark:via-white/[0.03] dark:to-white/[0.015] backdrop-blur-xl backdrop-saturate-[175%] border border-white/65 dark:border-white/[0.14] shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.45),0_8px_24px_rgba(0,0,0,0.16)] hover:border-[#FFD147]/55 transition-all flex flex-col justify-between gap-3 min-h-[260px]"
                  style={
                    idx < 12
                      ? {
                          animation: `fadeUp 200ms cubic-bezier(0.16, 1, 0.3, 1) ${idx * 30}ms forwards`,
                        }
                      : undefined
                  }
                >
                  {/* 4px status bar on the left edge */}
                  <div 
                    className="absolute left-0 top-0 bottom-0 w-[4px]" 
                    style={{ backgroundColor: statusColor }} 
                  />

                  {/* Row 1: Accession Number + Issue Date + Architectural Status Micro-Tag */}
                  <div className="flex items-center justify-between gap-2.5 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="font-mono text-[12px] font-bold text-[#BC881B] dark:text-[#E0B450] bg-[#BC881B]/15 px-2.5 py-0.5 rounded-[6px] border border-[#BC881B]/30 whitespace-nowrap shrink-0"
                        title={`Transaction ${tx.id} · Barcode ${tx.barcode || ''}`}
                      >
                        {getLoanAccessionLabel(tx)}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {tx.issue_date ? `Issued ${tx.issue_date}` : ''}
                      </span>
                    </div>
                    <div className="shrink-0">
                      {isActiveLoan ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-900/[0.04] dark:bg-white/[0.04] border border-slate-300/70 dark:border-white/[0.10]">
                          <span className="w-1.5 h-1.5 rounded-[1.5px] bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.75)] shrink-0" />
                          <span className="text-[9.5px] font-semibold uppercase tracking-[0.06em] text-slate-700 dark:text-slate-200">
                            Active Loan
                          </span>
                        </span>
                      ) : isOverdue ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-500/10 border border-rose-400/40">
                          <span className="w-1.5 h-1.5 rounded-[1.5px] bg-rose-500 shadow-[0_0_5px_rgba(244,63,94,0.75)] shrink-0" />
                          <span className="text-[9.5px] font-semibold uppercase tracking-[0.06em] text-rose-700 dark:text-rose-300">
                            Overdue
                          </span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-900/[0.03] dark:bg-white/[0.03] border border-slate-300/50 dark:border-white/[0.08]">
                          <span className="w-1.5 h-1.5 rounded-[1.5px] bg-slate-400 dark:bg-slate-500 shrink-0" />
                          <span className="text-[9.5px] font-semibold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">
                            Returned
                          </span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Title & Barcode */}
                  <div className="space-y-1">
                    <h3
                      onClick={() => onOpenBookDetails(tx.book_id)}
                      className="text-[15px] font-semibold text-slate-900 dark:text-white hover:text-[#BC881B] dark:hover:text-[#E0B450] cursor-pointer transition-colors line-clamp-2 leading-snug"
                      title={tx.book_name}
                      dir="auto"
                    >
                      {tx.book_name}
                    </h3>
                    <div className="flex items-center gap-1.5 text-[12px] font-mono text-slate-600 dark:text-[#B3AABD]">
                      <BarcodeIcon className="w-3.5 h-3.5 text-[#BC881B] shrink-0" />
                      <span>{tx.barcode}</span>
                    </div>
                  </div>

                  {/* Borrower Row: 38px avatar, name, and gold university ID chip */}
                  <div className="flex items-center justify-between gap-2.5 pt-2 border-t border-slate-300/60 dark:border-white/10 flex-wrap">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-[38px] h-[38px] rounded-full bg-[#541A72]/20 border border-[#A66BC9]/30 text-[#7E22CE] dark:text-[#C084FC] flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                        {getInitials(tx.borrower_name || '')}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span
                          onClick={() => onOpenBorrowerDetails(tx.borrower_id)}
                          className="text-[14px] font-semibold text-slate-900 dark:text-white hover:text-[#BC881B] dark:hover:text-[#E0B450] cursor-pointer transition-colors block truncate"
                          title={tx.borrower_name}
                          dir="auto"
                        >
                          {tx.borrower_name}
                        </span>
                      </div>
                    </div>

                    <span className="px-2.5 py-0.5 rounded-[6px] text-[11px] font-mono font-bold bg-[rgba(188,136,27,0.14)] text-amber-800 dark:text-[#E0B450] border border-[#BC881B]/35 shrink-0 whitespace-nowrap">
                      {tx.student_id}
                    </span>
                  </div>

                  {/* Dates Row: 2 columns with calendar icons */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-300/60 dark:border-white/10 text-xs">
                    <div>
                      <span className="text-[11px] font-mono uppercase tracking-[0.06em] text-slate-500 dark:text-[#B3AABD] flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400 dark:text-[#B3AABD]" />
                        <span>ISSUED</span>
                      </span>
                      <p className="font-mono text-[14px] text-slate-900 dark:text-white mt-0.5">
                        {tx.issue_date || 'N/A'}
                      </p>
                    </div>

                    <div>
                      <span className="text-[11px] font-mono uppercase tracking-[0.06em] text-slate-500 dark:text-[#B3AABD] flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400 dark:text-[#B3AABD]" />
                        <span>DUE DATE</span>
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        <span className={`font-mono text-[14px] ${isOverdue ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-900 dark:text-white'}`}>
                          {tx.due_date || 'N/A'}
                        </span>
                        {isOverdue && daysOverdue > 0 && (
                          <StatusPill label={`${daysOverdue}d overdue`} variant="danger" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Footer Action: Return Copy (full width, 40px, green outline with return icon) */}
                  <div className="pt-2">
                    {isReturned ? (
                      <div className="flex items-center justify-center gap-2 py-2 text-[12px] font-mono text-slate-500 dark:text-[#B3AABD] border-t border-slate-300/60 dark:border-white/10">
                        <Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                        <span>Returned on {tx.return_date || tx.issue_date}</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleReturnAction(tx.id)}
                        disabled={returnState !== 'idle'}
                        className="w-full h-10 rounded-xl border border-[#34D399] dark:border-[#34D399]/40 text-emerald-700 dark:text-[#34D399] bg-emerald-500/10 dark:bg-transparent hover:bg-emerald-500/20 dark:hover:bg-[rgba(52,211,153,0.12)] active:scale-[0.98] font-bold text-[13px] flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
                      >
                        {returnState === 'loading' ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Processing Return...</span>
                          </>
                        ) : returnState === 'success' ? (
                          <>
                            <Check className="w-4 h-4 stroke-[3]" />
                            <span>Volume Returned</span>
                          </>
                        ) : (
                          <>
                            <RotateCcw className="w-4 h-4" />
                            <span>Return Book ↵</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* List View (48px rows, status pills, due date and days overdue, 36px Return button) */
          <DataTable
            data={filteredTxs}
            columns={listColumns}
            keyExtractor={(tx) => tx.id}
            rowHeightClass="min-h-[48px]"
          />
        )}

      </div>
    </div>
  );
};

export default CirculationDeskView;
