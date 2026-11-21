import React, { useState, useMemo, useRef } from 'react';
import { 
  Users, 
  UserPlus, 
  GraduationCap, 
  Briefcase, 
  BookOpen, 
  AlertTriangle, 
  Search, 
  LayoutGrid, 
  List, 
  Download, 
  FileSpreadsheet, 
  Printer, 
  Phone, 
  Mail, 
  IdCard, 
  Edit3, 
  Trash2, 
  ShieldAlert, 
  CheckCircle2, 
  X, 
  Plus, 
  RefreshCw, 
  Clock,
  ArrowRightLeft
} from 'lucide-react';
import { Borrower, Transaction, BorrowerRole, BorrowerStatus } from '../types/library';
import { AddEditBorrowerModal } from './modals/AddEditBorrowerModal';
import { BorrowerDetailsModal } from './modals/BorrowerDetailsModal';
import { BorrowerCsvImportModal } from './modals/BorrowerCsvImportModal';
import { MemberCardPrintModal } from './modals/MemberCardPrintModal';
import { KpiCard } from './shared/SharedCards';
import { StatusPill } from './shared/StatusPill';
import CustomSelect from './ui/CustomSelect';
import { CountUp } from '@/components/ui/count-up';
import { SharedCsvWriter } from '../utils/csvWriter';
import { matchesUrduSearch } from '../utils/urduUtils';
import { ULM_OFFICIAL_CREST_SRC } from '../constants/ulmOfficialAssets';
import { LiquidPillOverlay, LiquidIconFx } from './ui/liquid-pill-physics';

export interface BorrowersViewProps {
  borrowers: Borrower[];
  transactions: Transaction[];
  onAddBorrower: (borrowerData: Omit<Borrower, 'id' | 'created_at' | 'updated_at' | 'is_active'>) => { success: boolean; message: string; borrower?: Borrower };
  onUpdateBorrower: (id: string, updates: Partial<Borrower>) => { success: boolean; message: string; borrower?: Borrower };
  onDeleteBorrower: (borrower: Borrower) => void;
  onIssueBook: (borrower: Borrower) => void;
  onOpenCirculationForBorrower: (borrowerId: string) => void;
  onReturnLoan: (transactionId: string) => void;
  onOpenBookDetails: (bookId: string) => void;
  onBatchImportBorrowers: (borrowers: Omit<Borrower, 'id' | 'created_at' | 'updated_at' | 'is_active'>[]) => { success: boolean; imported: number; errors: string[] };
  onReloadData?: () => void;
}

export const BorrowersView: React.FC<BorrowersViewProps> = ({
  borrowers,
  transactions,
  onAddBorrower,
  onUpdateBorrower,
  onDeleteBorrower,
  onIssueBook,
  onOpenCirculationForBorrower,
  onReturnLoan,
  onOpenBookDetails,
  onBatchImportBorrowers,
  onReloadData,
}) => {
  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<'ALL' | BorrowerRole>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | BorrowerStatus>('ALL');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const viewSwitcherRef = useRef<HTMLDivElement | null>(null);
  const viewItemRefs = useRef<Record<string, HTMLElement | null>>({});
  const [animTick, setAnimTick] = useState(1);

  const iconFxForMode = (mode: 'grid' | 'table'): LiquidIconFx => (mode === 'grid' ? 'pop' : 'hop');

  const handleSelectViewMode = (mode: 'grid' | 'table') => {
    setAnimTick((t) => t + 1);
    setViewMode(mode);
  };

  // Modal states
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [borrowerToEdit, setBorrowerToEdit] = useState<Borrower | null>(null);

  const [selectedBorrowerForDetails, setSelectedBorrowerForDetails] = useState<Borrower | null>(null);
  const [isCsvImportModalOpen, setIsCsvImportModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printMembersList, setPrintMembersList] = useState<Borrower[]>([]);

  // Unique departments for filter
  const departments = useMemo(() => {
    const set = new Set<string>();
    borrowers.forEach((b) => {
      if (b.department && b.department.trim()) {
        set.add(b.department.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [borrowers]);

  // Active loan transactions map: borrower_id -> count
  const activeLoansMap = useMemo(() => {
    const map = new Map<string, number>();
    const overdueMap = new Map<string, number>();
    const now = new Date();

    transactions.forEach((tx) => {
      if (tx.status !== 'RETURNED') {
        map.set(tx.borrower_id, (map.get(tx.borrower_id) || 0) + 1);
        if (new Date(tx.due_date) < now) {
          overdueMap.set(tx.borrower_id, (overdueMap.get(tx.borrower_id) || 0) + 1);
        }
      }
    });
    return { countMap: map, overdueMap };
  }, [transactions]);

  // Metrics KPI calculations
  const totalBorrowers = borrowers.length;
  const studentCount = useMemo(() => borrowers.filter((b) => b.role === 'Student').length, [borrowers]);
  const facultyStaffCount = useMemo(() => borrowers.filter((b) => b.role === 'Faculty' || b.role === 'Staff').length, [borrowers]);
  
  const totalActiveLoansCount = useMemo(() => {
    return transactions.filter((t) => t.status !== 'RETURNED').length;
  }, [transactions]);

  const suspendedOrOverdueCount = useMemo(() => {
    return borrowers.filter((b) => {
      if (b.status === 'suspended') return true;
      const overdues = activeLoansMap.overdueMap.get(b.id) || 0;
      return overdues > 0;
    }).length;
  }, [borrowers, activeLoansMap]);

  // Filtered borrowers
  const filteredBorrowers = useMemo(() => {
    return borrowers.filter((b) => {
      // Role filter
      if (selectedRole !== 'ALL' && b.role !== selectedRole) {
        return false;
      }
      // Status filter
      if (selectedStatus !== 'ALL' && b.status !== selectedStatus) {
        return false;
      }
      // Department filter
      if (selectedDepartment !== 'ALL' && b.department !== selectedDepartment) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const composite = [
          b.name,
          b.name_urdu,
          b.university_id,
          b.student_id,
          b.barcode,
          b.roll_number,
          b.department,
          b.program,
          b.designation,
          b.employee_no,
          b.phone,
          b.email,
        ]
          .filter(Boolean)
          .join(' ');

        if (!composite.toLowerCase().includes(query)) {
          if (!b.name_urdu || !matchesUrduSearch(query, b.name_urdu)) {
            return false;
          }
        }
      }
      return true;
    });
  }, [borrowers, selectedRole, selectedStatus, selectedDepartment, searchQuery]);

  // Quick suspend/activate toggle
  const handleToggleStatus = (borrower: Borrower) => {
    const nextStatus: BorrowerStatus = borrower.status === 'active' ? 'suspended' : 'active';
    onUpdateBorrower(borrower.id, { status: nextStatus });
  };

  // Open single card print
  const handleOpenSinglePrint = (borrower: Borrower) => {
    setPrintMembersList([borrower]);
    setIsPrintModalOpen(true);
  };

  // Open all filtered print
  const handleOpenFilteredPrint = () => {
    if (filteredBorrowers.length === 0) return;
    setPrintMembersList(filteredBorrowers);
    setIsPrintModalOpen(true);
  };

  // Export filtered list to CSV
  const handleExportCsv = () => {
    const cols = [
      { header: 'University ID', key: 'university_id' },
      { header: 'Full Name', key: 'name' },
      { header: 'Urdu Name', key: 'name_urdu' },
      { header: 'Role', key: 'role' },
      { header: 'Department', key: 'department' },
      { header: 'Program', key: 'program' },
      { header: 'Session', key: 'session' },
      { header: 'Semester', key: 'semester' },
      { header: 'Roll No', key: 'roll_number' },
      { header: 'Designation', key: 'designation' },
      { header: 'Phone', key: 'phone' },
      { header: 'Email', key: 'email' },
      { header: 'Borrow Limit', key: 'borrow_limit' },
      { header: 'Active Loans', format: (b: Borrower) => activeLoansMap.countMap.get(b.id) || 0 },
      { header: 'Status', key: 'status' },
      { header: 'Enrollment Date', key: 'joined_date' },
    ];
    SharedCsvWriter.downloadCsv(filteredBorrowers, 'ULM_Borrowers_Export.csv', cols);
  };

  // CSV Template download
  const handleDownloadTemplate = () => {
    const CSV_TEMPLATE_CONTENT = `University_ID,Name,Role,Department,Father_Name,Program,Session,Semester,Designation,Phone,Email,Address,Borrow_Limit,Valid_Until,Status,Notes\r\nULM-FA23-BCS-050,Shahid Afridi,Student,Computer Science,Fazal Afridi,BCS,FA23,4,,0300-1122334,shahid.cs@ulm.edu.pk,Lakki Marwat,3,2027-06-30,active,Class FA23\r\nULM-FAC-PHY-011,Dr. Rehmat Ullah,Faculty,Physics,,,,,Assistant Professor,0345-2233445,rehmat.phy@ulm.edu.pk,Bannu Road Campus,10,,active,Faculty\r\nULM-STF-ADM-004,Muhammad Irfan,Staff,Management Sciences,,,,,Senior Clerk,0312-5566778,irfan.adm@ulm.edu.pk,Admin Block ULM,5,,active,Admin staff`;
    const blob = new Blob(['\uFEFF' + CSV_TEMPLATE_CONTENT], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'ULM_Borrowers_Class_Import_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full h-auto min-h-0 flex flex-col gap-5 p-4 md:p-6 pb-12 max-w-[1700px] mx-auto relative z-10 overflow-visible">
      {/* 1. TOP HEADER BANNER (Frosted Crystal Shell matching Books Catalog / Issue Desk) */}
      <div className="ulm-preserve-glass rounded-[26px] bg-gradient-to-br from-white/85 via-white/70 to-white/55 dark:from-white/[0.08] dark:via-[#1B1130]/75 dark:to-[#120A22]/85 backdrop-blur-2xl backdrop-saturate-[180%] border border-white/80 dark:border-white/[0.15] px-5 py-4 md:px-6 md:py-5 shadow-[inset_1.5px_1.5px_2px_rgba(255,255,255,0.55),inset_-1px_-1px_1.5px_rgba(255,255,255,0.12),0_12px_32px_rgba(15,23,42,0.08)] dark:shadow-[inset_1.5px_1.5px_2px_rgba(255,255,255,0.12),0_14px_36px_rgba(0,0,0,0.38)] flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-purple-500/12 dark:bg-purple-500/20 text-[#541A72] dark:text-[#FFD147] border border-purple-500/25 dark:border-purple-400/30 flex items-center justify-center shadow-inner shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg md:text-xl font-bold font-cinzel text-slate-900 dark:text-white tracking-wide leading-tight truncate">
              Member ID Cards &amp; Borrower Registry
            </h1>
            <p className="text-xs text-slate-600 dark:text-[#B3AABD] font-sans mt-0.5 truncate">
              Manage registered students, faculty, and staff profiles, issue CR80 smart library ID cards, and monitor active circulation.
            </p>
          </div>
        </div>

        {/* Action Buttons Row (Single clean horizontal row) */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setBorrowerToEdit(null);
              setIsAddEditModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 h-9 px-4 rounded-xl bg-gradient-to-r from-[#541A72] via-[#6B21A8] to-[#B4690E] hover:brightness-110 active:scale-[0.98] !text-white text-xs font-bold border border-[#FFD147]/45 shadow-md transition-all cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5 !text-white shrink-0" />
            <span className="!text-white">+ Enroll Borrower</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCsvImportModalOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 h-9 px-3.5 rounded-xl bg-white/85 dark:bg-white/[0.06] border border-slate-300/80 dark:border-white/[0.14] hover:border-emerald-500/50 hover:bg-white dark:hover:bg-white/[0.11] text-slate-800 dark:text-slate-100 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
            title="Import class or departmental list via CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Import CSV</span>
          </button>

          <button
            type="button"
            onClick={handleOpenFilteredPrint}
            disabled={filteredBorrowers.length === 0}
            className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 h-9 px-3.5 rounded-xl bg-white/85 dark:bg-white/[0.06] border border-slate-300/80 dark:border-white/[0.14] hover:border-[#BC881B]/60 hover:bg-white dark:hover:bg-white/[0.11] text-amber-800 dark:text-[#FFD147] text-xs font-semibold shadow-2xs transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
            title="Batch print CR80 identity cards"
          >
            <Printer className="w-3.5 h-3.5 shrink-0" />
            <span>Batch Print ({filteredBorrowers.length})</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 h-9 px-3 rounded-xl bg-white/85 dark:bg-white/[0.06] border border-slate-300/80 dark:border-white/[0.14] hover:border-sky-500/50 hover:bg-white dark:hover:bg-white/[0.11] text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
            title="Export filtered borrowers to CSV"
          >
            <Download className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
            <span>Export</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 h-9 px-3 rounded-xl bg-white/85 dark:bg-white/[0.06] border border-slate-300/80 dark:border-white/[0.14] hover:border-[#BC881B]/50 hover:bg-white dark:hover:bg-white/[0.11] text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
            title="Download CSV import template"
          >
            <IdCard className="w-3.5 h-3.5 text-amber-600 dark:text-[#FFD147] shrink-0" />
            <span>Template</span>
          </button>

          {onReloadData && (
            <button
              type="button"
              onClick={onReloadData}
              className="inline-flex items-center justify-center shrink-0 w-9 h-9 rounded-xl bg-white/85 dark:bg-white/[0.06] border border-slate-300/80 dark:border-white/[0.14] hover:border-purple-400/60 hover:bg-white dark:hover:bg-white/[0.11] text-slate-700 dark:text-slate-200 shadow-2xs transition-all cursor-pointer"
              title="Refresh database records"
            >
              <RefreshCw className="w-3.5 h-3.5 shrink-0" />
            </button>
          )}
        </div>
      </div>

      {/* 2. TOP 4 MEMBER KPI CARDS (Exact 3-Tier Frosted Crystal Spec — Zero Dotted Lines) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* KPI 1: TOTAL MEMBERS */}
        <div className="ulm-preserve-glass rounded-[22px] bg-gradient-to-br from-white/85 via-white/70 to-white/55 dark:from-white/[0.075] dark:via-white/[0.035] dark:to-white/[0.015] backdrop-blur-xl backdrop-saturate-[175%] border border-white/80 dark:border-white/[0.14] p-4 shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.5),0_8px_24px_rgba(15,23,42,0.06)] dark:shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.10),0_10px_28px_rgba(0,0,0,0.28)] flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="ulm-kpi-label text-[10.5px] font-bold uppercase tracking-[0.13em] text-slate-600 dark:text-[#B3AABD]">
              TOTAL MEMBERS
            </span>
            <div className="w-7 h-7 rounded-full bg-amber-500/[0.14] dark:bg-amber-400/[0.16] border border-amber-500/30 flex items-center justify-center text-amber-700 dark:text-[#FFD147] shrink-0">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-['Space_Grotesk'] text-[26px] font-bold tabular-nums leading-none text-slate-900 dark:text-white">
              <CountUp end={totalBorrowers} />
            </span>
            <span className="text-[11.5px] italic text-slate-500 dark:text-[#B3AABD] pr-1">
              registered
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-[#B3AABD] truncate">
            {studentCount} Students · {facultyStaffCount} Faculty &amp; Staff
          </p>
        </div>

        {/* KPI 2: STUDENTS */}
        <div className="ulm-preserve-glass rounded-[22px] bg-gradient-to-br from-white/85 via-white/70 to-white/55 dark:from-white/[0.075] dark:via-white/[0.035] dark:to-white/[0.015] backdrop-blur-xl backdrop-saturate-[175%] border border-white/80 dark:border-white/[0.14] p-4 shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.5),0_8px_24px_rgba(15,23,42,0.06)] dark:shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.10),0_10px_28px_rgba(0,0,0,0.28)] flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="ulm-kpi-label text-[10.5px] font-bold uppercase tracking-[0.13em] text-slate-600 dark:text-[#B3AABD]">
              STUDENTS
            </span>
            <div className="w-7 h-7 rounded-full bg-purple-500/[0.14] dark:bg-purple-400/[0.18] border border-purple-500/30 flex items-center justify-center text-purple-700 dark:text-purple-300 shrink-0">
              <GraduationCap className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-['Space_Grotesk'] text-[26px] font-bold tabular-nums leading-none text-slate-900 dark:text-white">
              <CountUp end={studentCount} />
            </span>
            <span className="text-[11.5px] italic text-slate-500 dark:text-[#B3AABD] pr-1">
              enrolled
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-[#B3AABD] truncate">
            Undergraduate &amp; Postgraduate Scholars
          </p>
        </div>

        {/* KPI 3: FACULTY & STAFF */}
        <div className="ulm-preserve-glass rounded-[22px] bg-gradient-to-br from-white/85 via-white/70 to-white/55 dark:from-white/[0.075] dark:via-white/[0.035] dark:to-white/[0.015] backdrop-blur-xl backdrop-saturate-[175%] border border-white/80 dark:border-white/[0.14] p-4 shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.5),0_8px_24px_rgba(15,23,42,0.06)] dark:shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.10),0_10px_28px_rgba(0,0,0,0.28)] flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="ulm-kpi-label text-[10.5px] font-bold uppercase tracking-[0.13em] text-slate-600 dark:text-[#B3AABD]">
              FACULTY &amp; STAFF
            </span>
            <div className="w-7 h-7 rounded-full bg-sky-500/[0.14] dark:bg-sky-400/[0.18] border border-sky-500/30 flex items-center justify-center text-sky-700 dark:text-sky-300 shrink-0">
              <Briefcase className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-['Space_Grotesk'] text-[26px] font-bold tabular-nums leading-none text-slate-900 dark:text-white">
              <CountUp end={facultyStaffCount} />
            </span>
            <span className="text-[11.5px] italic text-slate-500 dark:text-[#B3AABD] pr-1">
              personnel
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-[#B3AABD] truncate">
            Academic &amp; Administrative Officers
          </p>
        </div>

        {/* KPI 4: ACTIVE BORROWERS / LOANS */}
        <div className="ulm-preserve-glass rounded-[22px] bg-gradient-to-br from-white/85 via-white/70 to-white/55 dark:from-white/[0.075] dark:via-white/[0.035] dark:to-white/[0.015] backdrop-blur-xl backdrop-saturate-[175%] border border-white/80 dark:border-white/[0.14] p-4 shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.5),0_8px_24px_rgba(15,23,42,0.06)] dark:shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.10),0_10px_28px_rgba(0,0,0,0.28)] flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="ulm-kpi-label text-[10.5px] font-bold uppercase tracking-[0.13em] text-slate-600 dark:text-[#B3AABD]">
              ACTIVE BORROWERS
            </span>
            <div className={`w-7 h-7 rounded-full border flex items-center justify-center shrink-0 ${
              suspendedOrOverdueCount > 0
                ? 'bg-rose-500/12 border-rose-500/30 text-rose-600 dark:text-rose-400'
                : 'bg-emerald-500/12 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
            }`}>
              <BookOpen className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className={`font-['Space_Grotesk'] text-[26px] font-bold tabular-nums leading-none ${
              totalActiveLoansCount > 0 ? 'text-amber-700 dark:text-[#FFD147]' : 'text-slate-900 dark:text-white'
            }`}>
              <CountUp end={totalActiveLoansCount} />
            </span>
            <span className="text-[11.5px] italic text-slate-500 dark:text-[#B3AABD] pr-1">
              active loans
            </span>
          </div>
          <p className={`text-[11px] truncate ${
            suspendedOrOverdueCount > 0
              ? 'text-rose-600 dark:text-rose-400 font-semibold'
              : 'text-slate-500 dark:text-[#B3AABD]'
          }`}>
            {suspendedOrOverdueCount > 0
              ? `${suspendedOrOverdueCount} suspended or overdue accounts`
              : 'All member accounts in good standing'}
          </p>
        </div>
      </div>

      {/* 3. SINGLE-ROW COMPACT SEARCH & FILTER TOOLBAR */}
      <div className="ulm-preserve-glass rounded-[22px] bg-gradient-to-br from-white/85 via-white/70 to-white/55 dark:from-white/[0.08] dark:via-white/[0.04] dark:to-white/[0.02] backdrop-blur-2xl backdrop-saturate-[180%] border border-white/80 dark:border-white/[0.15] p-3.5 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.5),0_10px_28px_rgba(15,23,42,0.06)] dark:shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.10),0_12px_30px_rgba(0,0,0,0.28)]">
        {/* Search Input with cleanly padded leading icon */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-amber-700 dark:text-[#FFD147] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, Urdu name, University ID, Roll No, Dept, Phone..."
            className="ulm-compact-control w-full h-10 pl-10 pr-9 rounded-xl bg-white/90 dark:bg-[#110A20]/85 border border-slate-300/90 dark:border-white/[0.14] text-[13px] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#BC881B] focus:ring-2 focus:ring-[#BC881B]/20 transition-all font-sans"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900 dark:hover:text-white z-10 cursor-pointer"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Controls + Grid/List Toggle */}
        <div className="flex flex-wrap items-center gap-2.5">
          <CustomSelect
            value={selectedRole}
            onChange={(val) => setSelectedRole(val as 'ALL' | BorrowerRole)}
            options={[
              { value: 'ALL', label: 'All Roles' },
              { value: 'Student', label: 'Students' },
              { value: 'Faculty', label: 'Faculty' },
              { value: 'Staff', label: 'Staff' },
            ]}
            className="w-[132px]"
            compact
          />

          <CustomSelect
            value={selectedStatus}
            onChange={(val) => setSelectedStatus(val as 'ALL' | BorrowerStatus)}
            options={[
              { value: 'ALL', label: 'All Statuses' },
              { value: 'active', label: 'Active' },
              { value: 'suspended', label: 'Suspended' },
              { value: 'left', label: 'Left / Alumni' },
            ]}
            className="w-[138px]"
            compact
          />

          {departments.length > 0 && (
            <CustomSelect
              value={selectedDepartment}
              onChange={(val) => setSelectedDepartment(val)}
              options={[
                { value: 'ALL', label: 'All Departments' },
                ...departments.map((d) => ({ value: d, label: d })),
              ]}
              className="w-[178px]"
              compact
            />
          )}

          {/* Dual-Theme Frosted Crystal View Mode Toggle */}
          <div
            ref={viewSwitcherRef}
            className="relative isolate inline-flex items-center h-10 bg-slate-200/75 dark:bg-white/[0.06] border border-slate-300/80 dark:border-white/[0.14] rounded-xl p-1 gap-0.5"
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
              className={`relative z-10 px-2.5 h-8 rounded-lg inline-flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                viewMode === 'grid'
                  ? '!text-white'
                  : 'text-slate-600 dark:text-[#B3AABD] hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Card Grid View"
            >
              <span
                className="ulm-nv-ico"
                key={viewMode === 'grid' ? animTick : 0}
                data-fx={viewMode === 'grid' ? iconFxForMode('grid') : undefined}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </span>
              <span className="hidden sm:inline">Grid</span>
            </button>
            <button
              ref={(el) => {
                viewItemRefs.current['table'] = el;
              }}
              type="button"
              onClick={() => handleSelectViewMode('table')}
              data-liquid-active={viewMode === 'table' ? 'true' : undefined}
              className={`relative z-10 px-2.5 h-8 rounded-lg inline-flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                viewMode === 'table'
                  ? '!text-white'
                  : 'text-slate-600 dark:text-[#B3AABD] hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Table List View"
            >
              <span
                className="ulm-nv-ico"
                key={viewMode === 'table' ? animTick : 0}
                data-fx={viewMode === 'table' ? iconFxForMode('table') : undefined}
              >
                <List className="w-3.5 h-3.5" />
              </span>
              <span className="hidden sm:inline">List</span>
            </button>
          </div>
        </div>
      </div>

      {/* FILTER RESULT STATUS */}
      <div className="flex items-center justify-between text-xs text-slate-600 dark:text-[#B3AABD] px-1">
        <span>
          Showing <strong className="text-slate-900 dark:text-white font-semibold tabular-nums">{filteredBorrowers.length}</strong> of{' '}
          <strong className="text-slate-900 dark:text-white font-semibold tabular-nums">{totalBorrowers}</strong> members
          {(searchQuery || selectedRole !== 'ALL' || selectedStatus !== 'ALL' || selectedDepartment !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedRole('ALL');
                setSelectedStatus('ALL');
                setSelectedDepartment('ALL');
              }}
              className="ml-2 text-amber-700 dark:text-[#FFD147] font-semibold hover:underline cursor-pointer"
            >
              (Clear filters)
            </button>
          )}
        </span>
      </div>

      {/* EMPTY STATE */}
      {filteredBorrowers.length === 0 && (
        <div className="ulm-preserve-glass rounded-[22px] bg-gradient-to-br from-white/85 via-white/70 to-white/55 dark:from-white/[0.06] dark:via-white/[0.03] dark:to-white/[0.015] backdrop-blur-xl border border-white/80 dark:border-white/[0.14] p-12 text-center flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-purple-500/12 dark:bg-purple-500/20 border border-purple-500/25 flex items-center justify-center text-purple-700 dark:text-purple-300">
            <Users className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">No members found</h3>
            <p className="text-xs md:text-sm text-slate-600 dark:text-[#B3AABD] max-w-md mx-auto">
              No registered borrowers matched your current search criteria or department filter. Try resetting filters or enroll a new member.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedRole('ALL');
              setSelectedStatus('ALL');
              setSelectedDepartment('ALL');
            }}
            className="h-9 px-4 rounded-xl bg-amber-500/[0.14] hover:bg-amber-500/25 border border-amber-500/35 text-xs font-bold text-amber-900 dark:text-[#FFD147] transition-colors cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* 4. MEMBER REGISTRY CARDS — GRID VIEW */}
      {viewMode === 'grid' && filteredBorrowers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredBorrowers.map((borrower) => {
            const loansCount = activeLoansMap.countMap.get(borrower.id) || 0;
            const overduesCount = activeLoansMap.overdueMap.get(borrower.id) || 0;
            const maxLimit = borrower.borrow_limit || (borrower.role === 'Faculty' ? 10 : borrower.role === 'Staff' ? 5 : 3);
            const isStudent = borrower.role === 'Student';
            const isFaculty = borrower.role === 'Faculty';
            const isQuotaFull = loansCount >= maxLimit;

            return (
              <div
                key={borrower.id}
                className="ulm-preserve-glass group relative rounded-[22px] bg-gradient-to-br from-white/85 via-white/70 to-white/55 dark:from-white/[0.075] dark:via-white/[0.035] dark:to-white/[0.015] backdrop-blur-xl backdrop-saturate-[175%] border border-white/80 dark:border-white/[0.14] hover:border-[#BC881B]/60 dark:hover:border-[#FFD147]/55 p-4 flex flex-col justify-between transition-all duration-[180ms] ease-out hover:-translate-y-0.5 shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.5),0_8px_24px_rgba(15,23,42,0.06)] dark:shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.10),0_10px_28px_rgba(0,0,0,0.28)] overflow-hidden"
              >
                {/* User Card Background Watermark */}
                <img
                  src={ULM_OFFICIAL_CREST_SRC}
                  alt=""
                  aria-hidden="true"
                  className="pointer-events-none select-none absolute -right-4 -bottom-4 w-36 h-36 object-contain opacity-[0.07] z-0"
                />

                {/* Decorative Top Accent Hairline */}
                <div
                  className={`absolute top-0 left-0 right-0 h-[2px] ${
                    isFaculty ? 'bg-[#BC881B]' : isStudent ? 'bg-[#A66BC9]' : 'bg-[#29658E]'
                  }`}
                />

                <div className="relative z-10 flex flex-col justify-between h-full">
                  <div className="space-y-3.5">
                    {/* Top Bar: Role Tag, Architectural Status Micro-Tag, Overdue/Fine Tag, Edit */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md border ${
                            isFaculty
                              ? 'bg-[#BC881B]/[0.14] text-[#8A4B00] dark:text-[#FFD147] border-[#BC881B]/35'
                              : isStudent
                              ? 'bg-[#A66BC9]/[0.14] text-[#541A72] dark:text-[#D8B4FE] border-[#A66BC9]/35'
                              : 'bg-[#29658E]/[0.14] text-[#1E4F73] dark:text-[#7DD3FC] border-[#29658E]/35'
                          }`}
                        >
                          {borrower.role}
                        </span>

                        {/* Architectural Status Micro-Tag with 6px Square LED Dot */}
                        <span
                          className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                            borrower.status === 'active'
                              ? isQuotaFull
                                ? 'bg-amber-500/12 text-amber-800 dark:text-amber-300 border-amber-500/35'
                                : 'bg-emerald-500/12 text-emerald-800 dark:text-emerald-300 border-emerald-500/30'
                              : borrower.status === 'suspended'
                              ? 'bg-rose-500/12 text-rose-700 dark:text-rose-300 border-rose-500/35'
                              : 'bg-slate-200/80 dark:bg-white/[0.08] text-slate-700 dark:text-slate-300 border-slate-300 dark:border-white/[0.15]'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-[1.5px] shrink-0 ${
                              borrower.status === 'active'
                                ? isQuotaFull
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                                : borrower.status === 'suspended'
                                ? 'bg-rose-500'
                                : 'bg-slate-400'
                            }`}
                          />
                          <span>
                            {borrower.status === 'active' && isQuotaFull
                              ? 'QUOTA FULL'
                              : borrower.status.toUpperCase()}
                          </span>
                        </span>

                        {overduesCount > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-500/12 text-rose-700 dark:text-rose-300 border border-rose-500/35">
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            <span>{overduesCount} Overdue</span>
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setBorrowerToEdit(borrower);
                          setIsAddEditModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-slate-500 dark:text-[#B3AABD] hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-white/[0.10] transition-colors cursor-pointer shrink-0"
                        title="Edit Member Profile"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Member Profile Main Block */}
                    <div className="flex items-start gap-3">
                      <div className="relative w-12 h-12 rounded-xl bg-white/90 dark:bg-white/[0.06] border border-slate-200/90 dark:border-white/[0.14] overflow-hidden shrink-0 flex items-center justify-center text-slate-900 dark:text-white font-bold text-sm shadow-inner">
                        {borrower.photo_url || borrower.photo_path ? (
                          <img
                            src={borrower.photo_url || borrower.photo_path}
                            alt={borrower.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-[#8A4B00] dark:text-[#FFD147] font-cinzel">
                            {borrower.name.substring(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <button
                          type="button"
                          onClick={() => setSelectedBorrowerForDetails(borrower)}
                          className="text-left font-['Plus_Jakarta_Sans'] font-bold text-slate-900 dark:text-white text-[14px] hover:text-[#541A72] dark:hover:text-[#FFD147] transition-colors truncate block w-full cursor-pointer"
                          title={borrower.name}
                        >
                          {borrower.name}
                        </button>

                        {borrower.name_urdu && (
                          <p
                            className="text-xs text-[#8A4B00] dark:text-[#FFD147] font-urdu truncate leading-tight mt-0.5"
                            dir="rtl"
                          >
                            {borrower.name_urdu}
                          </p>
                        )}

                        <p className="text-[11px] font-['JetBrains_Mono'] text-[#541A72] dark:text-[#C084FC] font-semibold mt-0.5 truncate">
                          {borrower.university_id || borrower.student_id}
                        </p>
                      </div>
                    </div>

                    {/* Academic / Employment Metadata */}
                    <div className="rounded-xl bg-white/65 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.09] p-2.5 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between gap-2 text-slate-600 dark:text-[#B3AABD]">
                        <span className="shrink-0">Department:</span>
                        <span className="text-slate-900 dark:text-white font-semibold truncate">
                          {borrower.department || 'General'}
                        </span>
                      </div>

                      {isStudent ? (
                        <>
                          <div className="flex items-center justify-between gap-2 text-slate-600 dark:text-[#B3AABD]">
                            <span className="shrink-0">Program:</span>
                            <span className="text-slate-800 dark:text-slate-100 font-semibold truncate">
                              {borrower.program || 'N/A'}{borrower.session ? ` (${borrower.session})` : ''}
                            </span>
                          </div>
                          {borrower.roll_number && (
                            <div className="flex items-center justify-between gap-2 text-slate-600 dark:text-[#B3AABD]">
                              <span className="shrink-0">Roll No:</span>
                              <span className="text-slate-900 dark:text-white font-['JetBrains_Mono'] font-semibold truncate">
                                {borrower.roll_number}
                              </span>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="flex items-center justify-between gap-2 text-slate-600 dark:text-[#B3AABD]">
                            <span className="shrink-0">Designation:</span>
                            <span className="text-slate-800 dark:text-slate-100 font-semibold truncate">
                              {borrower.designation || 'Staff'}
                            </span>
                          </div>
                          {borrower.employee_no && (
                            <div className="flex items-center justify-between gap-2 text-slate-600 dark:text-[#B3AABD]">
                              <span className="shrink-0">Employee ID:</span>
                              <span className="text-slate-900 dark:text-white font-['JetBrains_Mono'] font-semibold truncate">
                                {borrower.employee_no}
                              </span>
                            </div>
                          )}
                        </>
                      )}

                      {borrower.phone && (
                        <div className="flex items-center justify-between gap-2 text-slate-600 dark:text-[#B3AABD] pt-1 border-t border-slate-200/75 dark:border-white/[0.08]">
                          <span className="flex items-center gap-1 shrink-0">
                            <Phone className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> Contact:
                          </span>
                          <span className="text-slate-900 dark:text-white font-['JetBrains_Mono'] font-semibold text-[11px] truncate">
                            {borrower.phone}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Active Loans & Limit Progress */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-600 dark:text-[#B3AABD] flex items-center gap-1 font-medium">
                          <BookOpen className="w-3 h-3 text-amber-700 dark:text-[#FFD147]" /> Active Books:
                        </span>
                        <span className={`font-['JetBrains_Mono'] font-bold tabular-nums ${
                          loansCount >= maxLimit
                            ? 'text-rose-600 dark:text-rose-400'
                            : loansCount > 0
                            ? 'text-amber-700 dark:text-[#FFD147]'
                            : 'text-slate-800 dark:text-white'
                        }`}>
                          {loansCount} / {maxLimit}
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-200/85 dark:bg-white/[0.08] overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            loansCount >= maxLimit
                              ? 'bg-rose-500'
                              : loansCount > 0
                              ? 'bg-[#BC881B]'
                              : 'bg-transparent'
                          }`}
                          style={{ width: `${Math.min(100, (loansCount / maxLimit) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Clean Bottom Action Row (Zero Text Wrapping / Clipping) */}
                  <div className="pt-3 mt-3.5 border-t border-slate-200/80 dark:border-white/[0.10] flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onIssueBook(borrower)}
                      disabled={borrower.status !== 'active' || loansCount >= maxLimit}
                      className="flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 whitespace-nowrap h-8 px-2.5 rounded-lg bg-amber-500/[0.14] hover:bg-amber-500/25 active:scale-[0.98] text-amber-900 dark:text-[#FFD147] text-[11.5px] font-bold border border-amber-500/35 transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                      title={
                        borrower.status !== 'active'
                          ? 'Member suspended/inactive'
                          : loansCount >= maxLimit
                          ? 'Borrow limit reached'
                          : 'Issue new book to member'
                      }
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">Quick Issue</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedBorrowerForDetails(borrower)}
                      className="inline-flex items-center justify-center whitespace-nowrap shrink-0 h-8 px-2.5 rounded-lg bg-white/80 hover:bg-white dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-700 dark:text-slate-200 text-[11.5px] font-semibold border border-slate-300/80 dark:border-white/[0.12] transition-colors cursor-pointer"
                    >
                      History
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenSinglePrint(borrower)}
                      className="inline-flex items-center justify-center shrink-0 w-8 h-8 rounded-lg bg-white/80 hover:bg-white dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-amber-700 dark:text-[#FFD147] border border-slate-300/80 dark:border-white/[0.12] transition-colors cursor-pointer"
                      title="View / Print CR80 ID Card"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteBorrower(borrower)}
                      className="inline-flex items-center justify-center shrink-0 w-8 h-8 rounded-lg bg-white/80 hover:bg-rose-50 dark:bg-white/[0.06] dark:hover:bg-rose-950/50 text-slate-500 hover:text-rose-600 dark:text-[#B3AABD] dark:hover:text-rose-400 border border-slate-300/80 dark:border-white/[0.12] hover:border-rose-400/40 transition-colors cursor-pointer"
                      title="Delete member"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. TABLE LIST VIEW (Dual-Theme Frosted Crystal Table) */}
      {viewMode === 'table' && filteredBorrowers.length > 0 && (
        <div className="ulm-preserve-glass rounded-[22px] bg-gradient-to-br from-white/85 via-white/70 to-white/55 dark:from-white/[0.07] dark:via-white/[0.03] dark:to-white/[0.015] backdrop-blur-2xl backdrop-saturate-[180%] border border-white/80 dark:border-white/[0.14] overflow-hidden shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.5),0_10px_28px_rgba(15,23,42,0.08)] dark:shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.10),0_12px_32px_rgba(0,0,0,0.3)]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm font-sans border-collapse">
              <thead>
                <tr className="bg-slate-100/80 dark:bg-white/[0.05] text-slate-600 dark:text-[#B3AABD] text-[11px] font-bold uppercase tracking-wider border-b border-slate-200/80 dark:border-white/[0.10]">
                  <th className="py-3.5 px-4">Member Name &amp; ID</th>
                  <th className="py-3.5 px-4">Role &amp; Status</th>
                  <th className="py-3.5 px-4">Department / Program</th>
                  <th className="py-3.5 px-4">Contact Phone</th>
                  <th className="py-3.5 px-4">Active Loans</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-white/[0.08]">
                {filteredBorrowers.map((b) => {
                  const loansCount = activeLoansMap.countMap.get(b.id) || 0;
                  const maxLimit = b.borrow_limit || 3;
                  const isQuotaFull = loansCount >= maxLimit;

                  return (
                    <tr
                      key={b.id}
                      className="hover:bg-white/60 dark:hover:bg-white/[0.04] transition-colors group"
                    >
                      {/* Name & ID */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-white/90 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.12] flex items-center justify-center font-bold text-xs text-[#8A4B00] dark:text-[#FFD147] shrink-0 overflow-hidden">
                            {b.photo_url || b.photo_path ? (
                              <img
                                src={b.photo_url || b.photo_path}
                                alt={b.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              b.name.substring(0, 2).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => setSelectedBorrowerForDetails(b)}
                              className="font-['Plus_Jakarta_Sans'] font-bold text-slate-900 dark:text-white text-sm hover:text-[#541A72] dark:hover:text-[#FFD147] transition-colors text-left block truncate cursor-pointer"
                            >
                              {b.name}
                            </button>
                            <div className="flex items-center gap-2">
                              {b.name_urdu && (
                                <span className="text-xs text-[#8A4B00] dark:text-[#FFD147] font-urdu" dir="rtl">
                                  {b.name_urdu}
                                </span>
                              )}
                              <span className="font-['JetBrains_Mono'] text-xs text-[#541A72] dark:text-[#C084FC] font-semibold">
                                {b.university_id || b.student_id}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role & Status */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md border ${
                              b.role === 'Faculty'
                                ? 'bg-[#BC881B]/[0.14] text-[#8A4B00] dark:text-[#FFD147] border-[#BC881B]/35'
                                : b.role === 'Student'
                                ? 'bg-[#A66BC9]/[0.14] text-[#541A72] dark:text-[#D8B4FE] border-[#A66BC9]/35'
                                : 'bg-[#29658E]/[0.14] text-[#1E4F73] dark:text-[#7DD3FC] border-[#29658E]/35'
                            }`}
                          >
                            {b.role}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                              b.status === 'active'
                                ? isQuotaFull
                                  ? 'bg-amber-500/12 text-amber-800 dark:text-amber-300 border-amber-500/35'
                                  : 'bg-emerald-500/12 text-emerald-800 dark:text-emerald-300 border-emerald-500/30'
                                : b.status === 'suspended'
                                ? 'bg-rose-500/12 text-rose-700 dark:text-rose-300 border-rose-500/35'
                                : 'bg-slate-200/80 dark:bg-white/[0.08] text-slate-700 dark:text-slate-300 border-slate-300 dark:border-white/[0.15]'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-[1.5px] shrink-0 ${
                                b.status === 'active'
                                  ? isQuotaFull
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-500'
                                  : b.status === 'suspended'
                                  ? 'bg-rose-500'
                                  : 'bg-slate-400'
                              }`}
                            />
                            <span>
                              {b.status === 'active' && isQuotaFull ? 'QUOTA FULL' : b.status.toUpperCase()}
                            </span>
                          </span>
                        </div>
                      </td>

                      {/* Department / Program */}
                      <td className="py-3 px-4">
                        <div className="text-slate-900 dark:text-white text-xs font-semibold">
                          {b.department || 'N/A'}
                        </div>
                        <div className="text-slate-500 dark:text-[#B3AABD] text-[11px]">
                          {b.role === 'Student'
                            ? `${b.program || ''} ${b.session ? `(${b.session})` : ''}`
                            : b.designation || 'Staff'}
                        </div>
                      </td>

                      {/* Contact Phone */}
                      <td className="py-3 px-4">
                        <div className="text-slate-900 dark:text-white font-['JetBrains_Mono'] text-xs font-medium">
                          {b.phone || 'N/A'}
                        </div>
                        {b.email && (
                          <div className="text-slate-500 dark:text-[#B3AABD] text-[11px] truncate max-w-[160px]">
                            {b.email}
                          </div>
                        )}
                      </td>

                      {/* Active Loans */}
                      <td className="py-3 px-4">
                        <span className={`font-['JetBrains_Mono'] text-xs font-bold tabular-nums ${
                          loansCount >= maxLimit
                            ? 'text-rose-600 dark:text-rose-400'
                            : loansCount > 0
                            ? 'text-amber-700 dark:text-[#FFD147]'
                            : 'text-slate-800 dark:text-white'
                        }`}>
                          {loansCount} / {maxLimit}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onIssueBook(b)}
                            disabled={b.status !== 'active' || loansCount >= maxLimit}
                            className="px-2.5 py-1.5 rounded-lg bg-amber-500/[0.14] hover:bg-amber-500/25 text-amber-900 dark:text-[#FFD147] text-xs font-bold border border-amber-500/35 transition-colors disabled:opacity-35 disabled:pointer-events-none cursor-pointer whitespace-nowrap"
                            title="Issue Book"
                          >
                            Issue
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedBorrowerForDetails(b)}
                            className="p-1.5 rounded-lg text-slate-500 dark:text-[#B3AABD] hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-white/[0.10] transition-colors cursor-pointer"
                            title="View Profile & History"
                          >
                            <Users className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenSinglePrint(b)}
                            className="p-1.5 rounded-lg text-slate-500 dark:text-[#B3AABD] hover:text-amber-700 dark:hover:text-[#FFD147] hover:bg-slate-200/70 dark:hover:bg-white/[0.10] transition-colors cursor-pointer"
                            title="Print Card"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setBorrowerToEdit(b);
                              setIsAddEditModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-500 dark:text-[#B3AABD] hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-200/70 dark:hover:bg-white/[0.10] transition-colors cursor-pointer"
                            title="Edit"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteBorrower(b)}
                            className="p-1.5 rounded-lg text-slate-500 dark:text-[#B3AABD] hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-200/70 dark:hover:bg-white/[0.10] transition-colors cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODALS */}
      {/* 1. Add / Edit Borrower Modal */}
      <AddEditBorrowerModal
        isOpen={isAddEditModalOpen}
        onClose={() => {
          setIsAddEditModalOpen(false);
          setBorrowerToEdit(null);
        }}
        borrowerToEdit={borrowerToEdit}
        allBorrowers={borrowers}
        onSave={(borrowerData) => {
          const res = onAddBorrower(borrowerData);
          if (res.success) {
            setIsAddEditModalOpen(false);
            setBorrowerToEdit(null);
          }
          return res;
        }}
        onUpdate={(id, updates) => {
          const res = onUpdateBorrower(id, updates);
          if (res.success) {
            setIsAddEditModalOpen(false);
            setBorrowerToEdit(null);
          }
          return res;
        }}
        onOpenExisting={(existingId) => {
          const existing = borrowers.find((b) => b.id === existingId);
          if (existing) {
            setIsAddEditModalOpen(false);
            setSelectedBorrowerForDetails(existing);
          }
        }}
      />

      {/* 2. Borrower Details Modal (History, Active Loans, Return Books) */}
      <BorrowerDetailsModal
        isOpen={!!selectedBorrowerForDetails}
        borrower={selectedBorrowerForDetails}
        transactions={transactions}
        onClose={() => setSelectedBorrowerForDetails(null)}
        onReturnLoan={onReturnLoan}
        onOpenBookDetails={onOpenBookDetails}
        onEditBorrower={(b) => {
          setSelectedBorrowerForDetails(null);
          setBorrowerToEdit(b);
          setIsAddEditModalOpen(true);
        }}
        onIssueBook={(b) => {
          setSelectedBorrowerForDetails(null);
          onIssueBook(b);
        }}
        onPrintCard={(b) => {
          handleOpenSinglePrint(b);
        }}
        onToggleStatus={handleToggleStatus}
      />

      {/* 3. CSV Import Modal */}
      <BorrowerCsvImportModal
        isOpen={isCsvImportModalOpen}
        onClose={() => setIsCsvImportModalOpen(false)}
        onBatchImport={onBatchImportBorrowers}
        onImportComplete={() => {
          setIsCsvImportModalOpen(false);
          if (onReloadData) onReloadData();
        }}
      />

      {/* 4. Member Card Print Modal */}
      <MemberCardPrintModal
        isOpen={isPrintModalOpen}
        borrower={printMembersList.length === 1 ? printMembersList[0] : null}
        members={printMembersList}
        onClose={() => {
          setIsPrintModalOpen(false);
          setPrintMembersList([]);
        }}
      />
    </div>
  );
};
