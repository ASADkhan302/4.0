import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  User, 
  GraduationCap, 
  Phone, 
  Mail, 
  BookOpen, 
  RotateCcw, 
  AlertTriangle, 
  CheckCircle2, 
  Barcode as BarcodeIcon, 
  Printer, 
  Edit3, 
  Coins, 
  FileText, 
  Clock, 
  ShieldAlert, 
  PlusCircle,
  MapPin,
  Calendar
} from 'lucide-react';
import { Borrower, Transaction } from '../../types/library';
import { LibraryStorage } from '../../services/storage';
import { ULM_OFFICIAL_CREST_SRC } from '../../constants/ulmOfficialAssets';

interface BorrowerDetailsModalProps {
  borrower: Borrower | null;
  transactions: Transaction[];
  isOpen: boolean;
  onClose: () => void;
  onReturnLoan: (transactionId: string) => void;
  onOpenBookDetails: (bookId: string) => void;
  onEditBorrower?: (borrower: Borrower) => void;
  onIssueBook?: (borrower: Borrower) => void;
  onPrintCard?: (borrower: Borrower) => void;
  onToggleStatus?: (borrower: Borrower) => void;
}

export const BorrowerDetailsModal: React.FC<BorrowerDetailsModalProps> = ({
  borrower,
  transactions,
  isOpen,
  onClose,
  onReturnLoan,
  onOpenBookDetails,
  onEditBorrower,
  onIssueBook,
  onPrintCard,
  onToggleStatus,
}) => {
  const [activeTab, setActiveTab] = useState<'current' | 'history' | 'fines' | 'notes'>('current');

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

  if (!isOpen || !borrower) return null;

  const todayStr = new Date().toISOString().split('T')[0];
  const todayMs = new Date(todayStr).getTime();
  const uid = borrower.university_id || borrower.student_id;
  const borrowerTxs = transactions.filter(t => t.borrower_id === borrower.id);
  const activeLoans = borrowerTxs.filter(t => String(t.status || '').toUpperCase() !== 'RETURNED' && !t.return_date);
  const pastLoans = borrowerTxs.filter(t => String(t.status || '').toUpperCase() === 'RETURNED' || Boolean(t.return_date));

  // Fine calculations: clamped live fine_per_day_pkr with NaN/negative guard
  const rawFineRate = Number(LibraryStorage.getSettings().fine_per_day_pkr);
  const fineRate = Number.isFinite(rawFineRate) ? Math.max(0, rawFineRate) : 50;
  let totalUnpaidFine = 0;
  const activeLoansWithFine = activeLoans.map(loan => {
    const isOverdue = loan.status === 'OVERDUE' || (Boolean(loan.due_date) && loan.due_date < todayStr);
    let daysOverdue = 0;
    let fineDue = 0;
    if (loan.due_date && loan.due_date < todayStr) {
      const dueMs = new Date(loan.due_date).getTime();
      const diffMs = todayMs - dueMs;
      if (Number.isFinite(diffMs) && diffMs > 0) {
        daysOverdue = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
        fineDue = Math.max(0, daysOverdue * fineRate);
        totalUnpaidFine += fineDue;
      }
    }
    return { ...loan, isOverdue, daysOverdue, fineDue };
  });

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div 
      className="ulm-modal-backdrop fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="ulm-modal-dialog ulm-preserve-glass w-full max-w-2xl bg-gradient-to-br from-white/95 via-white/90 to-white/85 dark:from-[#1B1130]/95 dark:via-[#130B24]/95 dark:to-[#0D071A]/95 backdrop-blur-2xl backdrop-saturate-[180%] border border-white/80 dark:border-white/[0.14] rounded-[26px] shadow-[0_28px_80px_rgba(15,23,42,0.32)] dark:shadow-[0_28px_80px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col max-h-[90vh] text-slate-900 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-white/70 dark:bg-white/[0.03] border-b border-slate-200/80 dark:border-white/[0.10] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full p-1 bg-white dark:bg-[#110A20] border border-amber-500/40 ring-1 ring-amber-500/25 flex items-center justify-center shrink-0">
              <img src={ULM_OFFICIAL_CREST_SRC} alt="ULM 2017 Official Crest" className="w-full h-full object-contain" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white font-cinzel leading-tight">
                Institutional Member Detail Dossier
              </h3>
              <p className="text-[11px] font-mono text-slate-500 dark:text-[#B3AABD]">
                ULM Central Campus Library Ledger · Real-Time Account Verification
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-100/80 hover:bg-slate-200/80 dark:bg-white/[0.05] dark:hover:bg-white/[0.12] border border-slate-200/80 dark:border-white/[0.10] transition-colors cursor-pointer shrink-0"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Member Profile Banner */}
        <div className="relative overflow-hidden p-6 border-b border-slate-200/80 dark:border-white/[0.10] bg-slate-50/70 dark:bg-white/[0.025] flex flex-wrap items-center justify-between gap-4">
          <img
            src={ULM_OFFICIAL_CREST_SRC}
            alt=""
            aria-hidden="true"
            className="pointer-events-none select-none absolute right-6 top-1/2 -translate-y-1/2 w-28 h-28 object-contain opacity-[0.07] z-0"
          />
          <div className="relative z-10 flex items-center gap-4 min-w-0">
            {borrower.photo_url || borrower.photo_path ? (
              <img
                src={borrower.photo_url || borrower.photo_path}
                alt={borrower.name}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-amber-500/50 shadow-md shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-amber-500/[0.14] border-2 border-amber-500/40 flex items-center justify-center text-amber-700 dark:text-[#FFD147] font-cinzel font-black text-2xl shrink-0">
                {borrower.name.charAt(0)}
              </div>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white font-['Plus_Jakarta_Sans'] truncate">
                  {borrower.name}
                </h2>
                {borrower.name_urdu && (
                  <span
                    dir="rtl"
                    className="font-urdu text-amber-700 dark:text-[#FFD147] font-bold text-base mr-1 leading-none"
                    style={{ fontFamily: 'var(--font-urdu)' }}
                  >
                    {borrower.name_urdu}
                  </span>
                )}
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider ${
                  borrower.role === 'Faculty'
                    ? 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/20 dark:text-sky-300 dark:border-sky-500/40'
                    : borrower.role === 'Staff'
                    ? 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-500/20 dark:text-teal-300 dark:border-teal-500/40'
                    : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40'
                }`}>
                  {borrower.role}
                </span>

                <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider ${
                  borrower.status === 'active'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/12 dark:text-emerald-400 dark:border-emerald-500/30'
                    : borrower.status === 'suspended'
                    ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/12 dark:text-rose-400 dark:border-rose-500/30'
                    : 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-white/[0.08] dark:text-slate-300 dark:border-white/[0.15]'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-[1.5px] ${
                    borrower.status === 'active' ? 'bg-emerald-500' : borrower.status === 'suspended' ? 'bg-rose-500' : 'bg-slate-400'
                  }`} />
                  {borrower.status}
                </span>

                {borrower.blood_group && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md border border-red-200 dark:border-red-500/40 bg-red-50 dark:bg-red-500/12 text-red-700 dark:text-red-300 font-mono">
                    Blood: {borrower.blood_group}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-xs font-mono text-amber-700 dark:text-[#FFD147] font-semibold tracking-wide">
                  {uid}
                </span>
                {borrower.roll_number && (
                  <span className="text-[11px] font-mono text-slate-700 dark:text-slate-300 bg-white/80 dark:bg-white/[0.06] px-1.5 py-0.5 rounded-md border border-slate-200 dark:border-white/[0.10]">
                    Roll: {borrower.roll_number}
                  </span>
                )}
                {borrower.employee_no && (
                  <span className="text-[11px] font-mono text-slate-700 dark:text-slate-300 bg-white/80 dark:bg-white/[0.06] px-1.5 py-0.5 rounded-md border border-slate-200 dark:border-white/[0.10]">
                    Emp: {borrower.employee_no}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-[#B3AABD] mt-1 flex-wrap">
                <span className="flex items-center gap-1">
                  <GraduationCap className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{borrower.department}</span>
                </span>
                <span>•</span>
                <span>
                  {borrower.role === 'Student'
                    ? `${borrower.degree_level ? borrower.degree_level + ' ' : ''}${borrower.program || 'Student'} (${borrower.session || 'Class'}${borrower.study_mode ? ` · ${borrower.study_mode}` : ''}) · Sem ${borrower.semester || 1}`
                    : (borrower.designation || borrower.role)}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-2.5 text-right relative z-10">
            <div className="px-3 py-2 rounded-xl bg-white/80 dark:bg-white/[0.05] border border-slate-200/85 dark:border-white/[0.12]">
              <span className="text-[10px] font-mono text-slate-500 dark:text-[#B3AABD] block uppercase">Quota Limit</span>
              <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                {activeLoans.length} / {borrower.borrow_limit} Books
              </span>
            </div>

            <div className="px-3 py-2 rounded-xl bg-white/80 dark:bg-white/[0.05] border border-slate-200/85 dark:border-white/[0.12]">
              <span className="text-[10px] font-mono text-slate-500 dark:text-[#B3AABD] block uppercase">Unpaid Fines</span>
              <span className={`text-xs font-mono font-bold ${totalUnpaidFine > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                Rs {totalUnpaidFine}
              </span>
            </div>
          </div>
        </div>

        {/* Contact Strip */}
        <div className="px-6 py-2.5 bg-white/60 dark:bg-white/[0.02] border-b border-slate-200/80 dark:border-white/[0.08] flex flex-wrap items-center justify-between text-xs text-slate-600 dark:text-[#B3AABD] gap-3">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1.5 font-mono text-slate-800 dark:text-slate-200">
              <Phone className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span>{borrower.phone}</span>
            </span>
            {borrower.email && (
              <span className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                <Mail className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                <span>{borrower.email}</span>
              </span>
            )}
            {borrower.address && (
              <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 truncate max-w-xs">
                <MapPin className="w-3.5 h-3.5 text-slate-500" />
                <span className="truncate">{borrower.address}</span>
              </span>
            )}
          </div>

          <div className="text-[11px] font-mono text-slate-500 dark:text-[#B3AABD] flex items-center gap-2">
            <span>Joined: {borrower.joined_date}</span>
            {borrower.valid_until && <span>· Valid: {borrower.valid_until}</span>}
          </div>
        </div>

        {/* Segmented Tabs Navigation */}
        <div className="px-6 pt-3 bg-slate-100/60 dark:bg-white/[0.02] border-b border-slate-200/80 dark:border-white/[0.10] flex items-center gap-2 overflow-x-auto">
          {[
            { id: 'current', label: `Current Loans (${activeLoans.length})`, icon: BookOpen },
            { id: 'history', label: `Loan History (${pastLoans.length})`, icon: Clock },
            { id: 'fines', label: `Fines & Ledger`, icon: Coins },
            { id: 'notes', label: `Notes & Details`, icon: FileText },
          ].map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2 px-3 rounded-t-xl text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  isSelected
                    ? 'border-[#BC881B] text-amber-800 dark:text-[#FFD147] bg-amber-500/12 font-bold'
                    : 'border-transparent text-slate-600 dark:text-[#B3AABD] hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/[0.05]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Panels */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* TAB 1: CURRENT LOANS */}
          {activeTab === 'current' && (
            <div className="space-y-3">
              {activeLoansWithFine.length === 0 ? (
                <div className="p-8 rounded-2xl bg-white/70 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.10] text-center space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">No Active Borrowed Books</h4>
                  <p className="text-xs text-slate-600 dark:text-[#B3AABD] max-w-sm mx-auto">
                    Borrower account is in good standing with full circulation quota available.
                  </p>
                </div>
              ) : (
                activeLoansWithFine.map((loan) => (
                  <div
                    key={loan.id}
                    className={`p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-3 text-xs transition-colors ${
                      loan.isOverdue
                        ? 'bg-rose-50 dark:bg-rose-950/25 border-rose-300 dark:border-rose-500/40'
                        : 'bg-white/75 dark:bg-white/[0.03] border-slate-200/85 dark:border-white/[0.10]'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <button
                        onClick={() => onOpenBookDetails(loan.book_id)}
                        className="font-bold text-sm text-slate-900 dark:text-white hover:text-amber-700 dark:hover:text-[#FFD147] text-left block truncate transition-colors cursor-pointer"
                      >
                        {loan.book_name}
                      </button>
                      <p className="text-[11px] font-mono text-slate-500 dark:text-[#B3AABD] mt-0.5 flex items-center gap-2">
                        <BarcodeIcon className="w-3 h-3 text-slate-400" />
                        <span>{loan.barcode}</span>
                        <span>·</span>
                        <span>Issued: {loan.issue_date}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-mono text-slate-500 dark:text-[#B3AABD] block">Due Date</span>
                        <span className={`font-mono font-bold ${loan.isOverdue ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-200'}`}>
                          {loan.due_date}
                        </span>
                        {loan.isOverdue && (
                          <span className="text-[10px] font-mono text-rose-600 dark:text-rose-400 block font-semibold">
                            {loan.daysOverdue} days overdue · Fine Rs {loan.fineDue}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => onReturnLoan(loan.id)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Return Copy</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 2: HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-2">
              {pastLoans.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-[#B3AABD] italic p-6 rounded-2xl bg-white/70 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.10] text-center">
                  No historical loan transactions recorded for this member yet.
                </p>
              ) : (
                pastLoans.map((loan) => (
                  <div
                    key={loan.id}
                    className="p-3 rounded-xl bg-white/75 dark:bg-white/[0.03] border border-slate-200/85 dark:border-white/[0.10] flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 font-mono"
                  >
                    <div className="truncate mr-3">
                      <span className="text-slate-900 dark:text-white font-medium block truncate">{loan.book_name}</span>
                      <span className="text-[10px] text-slate-500 dark:text-[#B3AABD]">{loan.barcode} · Issued {loan.issue_date}</span>
                    </div>
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 shrink-0 font-semibold">
                      Returned {loan.return_date || '-'}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 3: FINES & LEDGER */}
          {activeTab === 'fines' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-white/75 dark:bg-white/[0.03] border border-slate-200/85 dark:border-white/[0.10] space-y-1">
                  <span className="text-[10.5px] font-mono uppercase tracking-wider text-slate-500 dark:text-[#B3AABD] block font-semibold">
                    Current Outstanding Fine
                  </span>
                  <p className={`text-xl font-mono font-bold ${totalUnpaidFine > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    Rs {totalUnpaidFine}
                  </p>
                  <p className="text-[10.5px] text-slate-500 dark:text-[#B3AABD] font-mono">
                    Rate: Rs 50 / day per overdue book
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white/75 dark:bg-white/[0.03] border border-slate-200/85 dark:border-white/[0.10] space-y-1">
                  <span className="text-[10.5px] font-mono uppercase tracking-wider text-slate-500 dark:text-[#B3AABD] block font-semibold">
                    Account Clearance Status
                  </span>
                  <p className={`text-xl font-bold ${totalUnpaidFine > 500 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {totalUnpaidFine > 500 ? 'Blocked (> Rs 500)' : 'Clear (Within Limits)'}
                  </p>
                  <p className="text-[10.5px] text-slate-500 dark:text-[#B3AABD] font-mono">
                    Max threshold before blocking: Rs 500
                  </p>
                </div>
              </div>

              {totalUnpaidFine > 0 ? (
                <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-500/12 border border-amber-200 dark:border-amber-500/30 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>Overdue Fines Payable at Desk</span>
                  </div>
                  <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
                    Fines are calculated automatically and receipted when books are checked in at the circulation desk.
                  </p>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-500/12 border border-emerald-200 dark:border-emerald-500/30 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>No outstanding fines. Borrower ledger is completely clear.</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: NOTES & DETAILS */}
          {activeTab === 'notes' && (
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-white/75 dark:bg-white/[0.03] border border-slate-200/85 dark:border-white/[0.10] space-y-2">
                <span className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-[#B3AABD] font-bold block">
                  Institutional Record Remarks
                </span>
                <p className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {borrower.notes || 'No custom administrative remarks logged for this member.'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs font-mono text-slate-500 dark:text-[#B3AABD]">
                <div className="p-3 rounded-xl bg-white/75 dark:bg-white/[0.03] border border-slate-200/85 dark:border-white/[0.10]">
                  <span className="block text-[10px] text-slate-500 dark:text-[#B3AABD] uppercase">Created Timestamp</span>
                  <span className="text-slate-800 dark:text-slate-200">{borrower.created_at}</span>
                </div>
                <div className="p-3 rounded-xl bg-white/75 dark:bg-white/[0.03] border border-slate-200/85 dark:border-white/[0.10]">
                  <span className="block text-[10px] text-slate-500 dark:text-[#B3AABD] uppercase">Last Updated</span>
                  <span className="text-slate-800 dark:text-slate-200">{borrower.updated_at}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Footer with Non-Merging Buttons: Edit, Issue book, Print member card */}
        <div className="px-6 py-4 bg-white/80 dark:bg-white/[0.03] border-t border-slate-200/80 dark:border-white/[0.10] flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            {onToggleStatus && (
              <button
                type="button"
                onClick={() => onToggleStatus(borrower)}
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 h-9 px-3.5 rounded-xl bg-slate-200/85 hover:bg-slate-300/85 dark:bg-white/[0.07] dark:hover:bg-white/[0.13] text-slate-800 dark:text-slate-100 border border-slate-300/80 dark:border-white/[0.14] text-xs font-semibold transition-colors cursor-pointer"
              >
                <span>{borrower.status === 'active' ? 'Suspend Account' : 'Reactivate Account'}</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {onPrintCard && (
              <button
                type="button"
                onClick={() => onPrintCard(borrower)}
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 h-9 px-3.5 rounded-xl bg-amber-500/[0.14] hover:bg-amber-500/25 text-amber-900 dark:text-[#FFD147] border border-amber-500/40 text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                <Printer className="w-3.5 h-3.5 shrink-0" />
                <span>Print Member Card</span>
              </button>
            )}

            {onIssueBook && (
              <button
                type="button"
                onClick={() => onIssueBook(borrower)}
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 h-9 px-4 rounded-xl bg-[#2563EB] hover:bg-[#3B82F6] active:bg-[#1D4ED8] !text-white font-bold text-xs transition-colors cursor-pointer shadow-xs"
              >
                <PlusCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Issue Book</span>
              </button>
            )}

            {onEditBorrower && (
              <button
                type="button"
                onClick={() => onEditBorrower(borrower)}
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 h-9 px-4 rounded-xl bg-gradient-to-r from-[#BC881B] to-[#D4A02A] hover:brightness-110 text-[#1A1A1A] font-bold text-xs transition-all cursor-pointer shadow-md border border-[#FFD147]/50"
              >
                <Edit3 className="w-3.5 h-3.5 shrink-0" />
                <span>Edit Profile</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
};

export default BorrowerDetailsModal;
