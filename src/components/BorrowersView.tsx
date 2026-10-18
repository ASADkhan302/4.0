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
    <div className="flex-1 flex flex-col p-4 md:p-6 space-y-5 max-w-[1700px] w-full mx-auto relative z-10">
      {/* TOP HEADER CARD */}
      <div className="rounded-[16px] bg-[#1A1A1A] border border-[#2E2A33] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.4)] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[rgba(84,26,114,0.35)] border border-[#A66BC9]/40 flex items-center justify-center text-[#E0B450] shadow-inner">
              <Users className="w-5 h-5 text-[#E0B450]" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold font-cinzel text-white tracking-wide flex items-center gap-2">
                Borrowers &amp; Faculty Directory
                <span className="text-xs font-sans font-medium px-2.5 py-0.5 rounded-full bg-[#BC881B]/15 text-[#E0B450] border border-[#BC881B]/30">
                  ULM Patron Registry
                </span>
              </h1>
              <p className="text-xs md:text-sm text-[#B3AABD] font-sans">
                Manage registered students, faculty members, and staff profiles, issue smart library cards, and monitor active borrowings.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              setBorrowerToEdit(null);
              setIsAddEditModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-[#BC881B] to-[#D4A02A] hover:brightness-110 active:scale-[0.98] text-[#1A1A1A] text-xs md:text-sm font-bold shadow-[0_2px_12px_rgba(188,136,27,0.3)] transition-all"
          >
            <UserPlus className="w-4 h-4 text-[#1A1A1A]" />
            <span>+ Add Member</span>
          </button>

          <button
            onClick={() => setIsCsvImportModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-[#221F26] border border-[#2E2A33] hover:border-[#A66BC9]/50 hover:bg-[#2B2730] text-[#E7E2EC] text-xs md:text-sm font-medium transition-all"
            title="Import class or departmental list via CSV"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#34D399]" />
            <span>Import CSV</span>
          </button>

          <button
            onClick={handleOpenFilteredPrint}
            disabled={filteredBorrowers.length === 0}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-[#221F26] border border-[#2E2A33] hover:border-[#BC881B]/50 hover:bg-[#2B2730] text-[#E0B450] text-xs md:text-sm font-medium transition-all disabled:opacity-40 disabled:pointer-events-none"
            title="Batch print identity cards"
          >
            <Printer className="w-4 h-4 text-[#E0B450]" />
            <span>Print Cards ({filteredBorrowers.length})</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="p-2.5 rounded-lg bg-[#221F26] border border-[#2E2A33] hover:border-[#6FA8D2]/50 hover:bg-[#2B2730] text-[#B3AABD] hover:text-[#6FA8D2] transition-all"
            title="Export filtered borrowers to CSV"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            onClick={handleDownloadTemplate}
            className="p-2.5 rounded-lg bg-[#221F26] border border-[#2E2A33] hover:border-[#BC881B]/50 hover:bg-[#2B2730] text-[#B3AABD] hover:text-[#E0B450] transition-all"
            title="Download CSV import template"
          >
            <IdCard className="w-4 h-4" />
          </button>

          {onReloadData && (
            <button
              onClick={onReloadData}
              className="p-2.5 rounded-lg bg-[#221F26] border border-[#2E2A33] hover:border-[#A66BC9]/50 hover:bg-[#2B2730] text-[#B3AABD] hover:text-white transition-all"
              title="Refresh database records"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* KPI METRIC CARDS ROW */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <KpiCard
          label="Total Registered"
          value={totalBorrowers}
          icon={Users}
          iconColor="#BC881B"
          accentBarColor="#BC881B"
          subLabel={`${studentCount} Students, ${facultyStaffCount} Faculty/Staff`}
        />
        <KpiCard
          label="Active Students"
          value={studentCount}
          icon={GraduationCap}
          iconColor="#A66BC9"
          accentBarColor="#A66BC9"
          subLabel="Undergraduate & Postgraduate"
        />
        <KpiCard
          label="Faculty & Staff"
          value={facultyStaffCount}
          icon={Briefcase}
          iconColor="#6FA8D2"
          accentBarColor="#29658E"
          subLabel="Academic and Administrative"
        />
        <KpiCard
          label="Books on Loan"
          value={totalActiveLoansCount}
          icon={BookOpen}
          iconColor="#E0B450"
          accentBarColor="#E0B450"
          isGoldNumber={totalActiveLoansCount > 0}
          subLabel="Circulated reading material"
        />
        <KpiCard
          label="Suspended / Overdue"
          value={suspendedOrOverdueCount}
          icon={AlertTriangle}
          iconColor={suspendedOrOverdueCount > 0 ? '#FB7185' : '#34D399'}
          accentBarColor={suspendedOrOverdueCount > 0 ? '#FB7185' : '#34D399'}
          isDanger={suspendedOrOverdueCount > 0}
          subLabel={suspendedOrOverdueCount > 0 ? 'Requires administrative review' : 'No overdue accounts'}
        />
      </div>

      {/* SEARCH AND FILTERS BAR */}
      <div className="rounded-[14px] bg-[#1A1A1A] border border-[#2E2A33] p-3.5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-md">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[260px]">
          <Search className="w-4 h-4 text-[#B3AABD] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, Urdu name, University ID, Roll No, Dept, Phone..."
            className="w-full h-10 pl-10 pr-9 rounded-lg bg-[#221F26] border border-[#2E2A33] text-sm text-white placeholder-[#B3AABD]/60 focus:outline-none focus:border-[#BC881B] focus:ring-1 focus:ring-[#BC881B] transition-all font-sans"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#B3AABD] hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Role Filter */}
          <CustomSelect
            value={selectedRole}
            onChange={(val) => setSelectedRole(val as 'ALL' | BorrowerRole)}
            options={[
              { value: 'ALL', label: 'All Roles' },
              { value: 'Student', label: 'Students' },
              { value: 'Faculty', label: 'Faculty' },
              { value: 'Staff', label: 'Staff' },
            ]}
            className="w-[130px]"
          />

          {/* Status Filter */}
          <CustomSelect
            value={selectedStatus}
            onChange={(val) => setSelectedStatus(val as 'ALL' | BorrowerStatus)}
            options={[
              { value: 'ALL', label: 'All Statuses' },
              { value: 'active', label: 'Active' },
              { value: 'suspended', label: 'Suspended' },
              { value: 'left', label: 'Left/Alumni' },
            ]}
            className="w-[130px]"
          />

          {/* Department Filter */}
          {departments.length > 0 && (
            <CustomSelect
              value={selectedDepartment}
              onChange={(val) => setSelectedDepartment(val)}
              options={[
                { value: 'ALL', label: 'All Departments' },
                ...departments.map((d) => ({ value: d, label: d })),
              ]}
              className="w-[180px]"
            />
          )}

          {/* View Mode Toggle */}
          <div className="flex items-center bg-[#221F26] border border-[#2E2A33] rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'grid'
                  ? 'bg-[#541A72] text-white shadow-sm'
                  : 'text-[#B3AABD] hover:text-white'
              }`}
              title="Card Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'table'
                  ? 'bg-[#541A72] text-white shadow-sm'
                  : 'text-[#B3AABD] hover:text-white'
              }`}
              title="Table List View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* FILTER RESULT STATUS */}
      <div className="flex items-center justify-between text-xs text-[#B3AABD] px-1">
        <span>
          Showing <strong className="text-white font-medium">{filteredBorrowers.length}</strong> of{' '}
          <strong className="text-white font-medium">{totalBorrowers}</strong> members
          {(searchQuery || selectedRole !== 'ALL' || selectedStatus !== 'ALL' || selectedDepartment !== 'ALL') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedRole('ALL');
                setSelectedStatus('ALL');
                setSelectedDepartment('ALL');
              }}
              className="ml-2 text-[#E0B450] hover:underline"
            >
              (Clear filters)
            </button>
          )}
        </span>
      </div>

      {/* EMPTY STATE */}
      {filteredBorrowers.length === 0 && (
        <div className="rounded-[16px] bg-[#1A1A1A] border border-[#2E2A33] p-12 text-center flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-[#221F26] border border-[#2E2A33] flex items-center justify-center text-[#B3AABD]">
            <Users className="w-8 h-8 text-[#A66BC9]" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">No members found</h3>
            <p className="text-xs md:text-sm text-[#B3AABD] max-w-md mx-auto">
              No registered borrowers matched your current search criteria or department filter. Try resetting filters or enroll a new member.
            </p>
          </div>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedRole('ALL');
              setSelectedStatus('ALL');
              setSelectedDepartment('ALL');
            }}
            className="px-4 py-2 rounded-lg bg-[#221F26] border border-[#2E2A33] text-xs font-medium text-[#E0B450] hover:bg-[#2B2730] transition-colors"
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* CARDS GRID VIEW */}
      {viewMode === 'grid' && filteredBorrowers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredBorrowers.map((borrower) => {
            const loansCount = activeLoansMap.countMap.get(borrower.id) || 0;
            const overduesCount = activeLoansMap.overdueMap.get(borrower.id) || 0;
            const maxLimit = borrower.borrow_limit || (borrower.role === 'Faculty' ? 10 : borrower.role === 'Staff' ? 5 : 3);
            const isStudent = borrower.role === 'Student';
            const isFaculty = borrower.role === 'Faculty';

            return (
              <div
                key={borrower.id}
                className="group relative rounded-[14px] bg-[#1A1A1A] border border-[#2E2A33] hover:border-[#A66BC9]/45 p-4 flex flex-col justify-between transition-all duration-[180ms] ease-out hover:-translate-y-[2px] hover:shadow-[0_8px_24px_rgba(0,0,0,0.45)] overflow-hidden"
              >
                {/* Decorative Top Accent Hairline */}
                <div 
                  className={`absolute top-0 left-0 right-0 h-[2px] ${
                    isFaculty ? 'bg-[#BC881B]' : isStudent ? 'bg-[#A66BC9]' : 'bg-[#29658E]'
                  }`} 
                />

                <div className="space-y-3.5">
                  {/* Top Bar: Role Pill, Status, Quick Actions */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${
                          isFaculty
                            ? 'bg-[#BC881B]/15 text-[#E0B450] border-[#BC881B]/40'
                            : isStudent
                            ? 'bg-[#A66BC9]/15 text-[#C084FC] border-[#A66BC9]/40'
                            : 'bg-[#29658E]/15 text-[#6FA8D2] border-[#29658E]/40'
                        }`}
                      >
                        {borrower.role}
                      </span>

                      <StatusPill
                        label={borrower.status.toUpperCase()}
                        variant={borrower.status === 'active' ? 'green' : borrower.status === 'suspended' ? 'danger' : 'muted'}
                        dot
                      />

                      {overduesCount > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {overduesCount} Overdue
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleOpenSinglePrint(borrower)}
                        className="p-1 rounded text-[#B3AABD] hover:text-[#E0B450] hover:bg-[#221F26] transition-colors"
                        title="Print Identity Card"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setBorrowerToEdit(borrower);
                          setIsAddEditModalOpen(true);
                        }}
                        className="p-1 rounded text-[#B3AABD] hover:text-white hover:bg-[#221F26] transition-colors"
                        title="Edit Profile"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Member Profile Main Block */}
                  <div className="flex items-start gap-3">
                    {/* Avatar / Photo */}
                    <div className="relative w-12 h-12 rounded-xl bg-[#221F26] border border-[#2E2A33] overflow-hidden flex-shrink-0 flex items-center justify-center text-white font-bold text-sm shadow-inner">
                      {borrower.photo_url || borrower.photo_path ? (
                        <img
                          src={borrower.photo_url || borrower.photo_path}
                          alt={borrower.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-[#E0B450] font-cinzel">
                          {borrower.name.substring(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => setSelectedBorrowerForDetails(borrower)}
                        className="text-left font-bold text-white text-sm hover:text-[#E0B450] transition-colors truncate block w-full"
                        title={borrower.name}
                      >
                        {borrower.name}
                      </button>

                      {borrower.name_urdu && (
                        <p 
                          className="text-xs text-[#E0B450] font-urdu truncate leading-tight mt-0.5" 
                          dir="rtl"
                        >
                          {borrower.name_urdu}
                        </p>
                      )}

                      <p className="text-[11px] font-mono text-[#A66BC9] mt-0.5 truncate">
                        {borrower.university_id || borrower.student_id}
                      </p>
                    </div>
                  </div>

                  {/* Academic / Employment Metadata */}
                  <div className="rounded-lg bg-[#221F26]/70 border border-[#2E2A33] p-2.5 space-y-1 text-xs">
                    <div className="flex items-center justify-between text-[#B3AABD]">
                      <span>Department:</span>
                      <span className="text-white font-medium truncate max-w-[150px]">
                        {borrower.department || 'General'}
                      </span>
                    </div>

                    {isStudent ? (
                      <>
                        <div className="flex items-center justify-between text-[#B3AABD]">
                          <span>Program / Class:</span>
                          <span className="text-[#E7E2EC] font-medium truncate">
                            {borrower.program || 'N/A'}{borrower.session ? ` (${borrower.session})` : ''}
                          </span>
                        </div>
                        {borrower.roll_number && (
                          <div className="flex items-center justify-between text-[#B3AABD]">
                            <span>Roll Number:</span>
                            <span className="text-white font-mono">{borrower.roll_number}</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between text-[#B3AABD]">
                          <span>Designation:</span>
                          <span className="text-[#E7E2EC] font-medium truncate">
                            {borrower.designation || 'Staff'}
                          </span>
                        </div>
                        {borrower.employee_no && (
                          <div className="flex items-center justify-between text-[#B3AABD]">
                            <span>Employee ID:</span>
                            <span className="text-white font-mono">{borrower.employee_no}</span>
                          </div>
                        )}
                      </>
                    )}

                    {borrower.phone && (
                      <div className="flex items-center justify-between text-[#B3AABD] pt-0.5 border-t border-[#2E2A33]/50">
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-[#34D399]" /> Contact:
                        </span>
                        <span className="text-white font-mono text-[11px]">{borrower.phone}</span>
                      </div>
                    )}
                  </div>

                  {/* Active Loans & Limit Progress */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#B3AABD] flex items-center gap-1">
                        <BookOpen className="w-3 h-3 text-[#E0B450]" /> Active Books on Loan:
                      </span>
                      <span className={`font-mono font-bold ${loansCount > 0 ? 'text-[#E0B450]' : 'text-white'}`}>
                        {loansCount} / {maxLimit}
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-[#221F26] overflow-hidden">
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

                {/* Card Action Buttons Footer */}
                <div className="pt-3 mt-3 border-t border-[#2E2A33] flex items-center justify-between gap-2">
                  <button
                    onClick={() => onIssueBook(borrower)}
                    disabled={borrower.status !== 'active' || loansCount >= maxLimit}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-[rgba(188,136,27,0.15)] hover:bg-[#BC881B]/25 active:scale-[0.98] text-[#E0B450] text-xs font-semibold border border-[#BC881B]/30 transition-all disabled:opacity-40 disabled:pointer-events-none"
                    title={
                      borrower.status !== 'active'
                        ? 'Member suspended/inactive'
                        : loansCount >= maxLimit
                        ? 'Borrow limit reached'
                        : 'Issue new book to member'
                    }
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>Issue Book</span>
                  </button>

                  <button
                    onClick={() => setSelectedBorrowerForDetails(borrower)}
                    className="py-1.5 px-3 rounded-lg bg-[#221F26] hover:bg-[#2B2730] text-[#E7E2EC] text-xs font-medium border border-[#2E2A33] transition-colors"
                  >
                    View History
                  </button>

                  <button
                    onClick={() => onDeleteBorrower(borrower)}
                    className="p-1.5 rounded-lg bg-[#221F26] hover:bg-rose-950/40 hover:text-rose-400 text-[#B3AABD] border border-[#2E2A33] transition-colors"
                    title="Delete member"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TABLE LIST VIEW */}
      {viewMode === 'table' && filteredBorrowers.length > 0 && (
        <div className="rounded-[16px] bg-[#1A1A1A] border border-[#2E2A33] overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm font-sans border-collapse">
              <thead>
                <tr className="bg-[#221F26] text-[#B3AABD] text-xs uppercase tracking-wider border-b border-[#2E2A33]">
                  <th className="py-3 px-4">Member Name &amp; ID</th>
                  <th className="py-3 px-4">Role &amp; Status</th>
                  <th className="py-3 px-4">Department / Program</th>
                  <th className="py-3 px-4">Contact Phone</th>
                  <th className="py-3 px-4">Active Loans</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2E2A33]">
                {filteredBorrowers.map((b) => {
                  const loansCount = activeLoansMap.countMap.get(b.id) || 0;
                  const maxLimit = b.borrow_limit || 3;

                  return (
                    <tr
                      key={b.id}
                      className="hover:bg-[#221F26]/60 transition-colors group"
                    >
                      {/* Name & ID */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-[#2B2730] border border-[#2E2A33] flex items-center justify-center font-bold text-xs text-[#E0B450] flex-shrink-0">
                            {b.photo_url || b.photo_path ? (
                              <img
                                src={b.photo_url || b.photo_path}
                                alt={b.name}
                                className="w-full h-full object-cover rounded-lg"
                              />
                            ) : (
                              b.name.substring(0, 2).toUpperCase()
                            )}
                          </div>
                          <div>
                            <button
                              onClick={() => setSelectedBorrowerForDetails(b)}
                              className="font-bold text-white text-sm hover:text-[#E0B450] transition-colors text-left block"
                            >
                              {b.name}
                            </button>
                            <div className="flex items-center gap-2">
                              {b.name_urdu && (
                                <span className="text-xs text-[#E0B450] font-urdu" dir="rtl">
                                  {b.name_urdu}
                                </span>
                              )}
                              <span className="font-mono text-xs text-[#A66BC9]">
                                {b.university_id || b.student_id}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role & Status */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                              b.role === 'Faculty'
                                ? 'bg-[#BC881B]/15 text-[#E0B450] border-[#BC881B]/40'
                                : b.role === 'Student'
                                ? 'bg-[#A66BC9]/15 text-[#C084FC] border-[#A66BC9]/40'
                                : 'bg-[#29658E]/15 text-[#6FA8D2] border-[#29658E]/40'
                            }`}
                          >
                            {b.role}
                          </span>
                          <StatusPill
                            label={b.status.toUpperCase()}
                            variant={b.status === 'active' ? 'green' : b.status === 'suspended' ? 'danger' : 'muted'}
                            dot
                          />
                        </div>
                      </td>

                      {/* Department / Program */}
                      <td className="py-3 px-4">
                        <div className="text-white text-xs font-medium">
                          {b.department || 'N/A'}
                        </div>
                        <div className="text-[#B3AABD] text-[11px]">
                          {b.role === 'Student'
                            ? `${b.program || ''} ${b.session ? `(${b.session})` : ''}`
                            : b.designation || 'Staff'}
                        </div>
                      </td>

                      {/* Contact Phone */}
                      <td className="py-3 px-4">
                        <div className="text-white font-mono text-xs">{b.phone || 'N/A'}</div>
                        {b.email && <div className="text-[#B3AABD] text-[11px] truncate max-w-[140px]">{b.email}</div>}
                      </td>

                      {/* Active Loans */}
                      <td className="py-3 px-4">
                        <span className={`font-mono text-xs font-bold ${loansCount > 0 ? 'text-[#E0B450]' : 'text-white'}`}>
                          {loansCount} / {maxLimit}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onIssueBook(b)}
                            disabled={b.status !== 'active' || loansCount >= maxLimit}
                            className="px-2.5 py-1 rounded-md bg-[rgba(188,136,27,0.15)] hover:bg-[#BC881B]/30 text-[#E0B450] text-xs font-semibold border border-[#BC881B]/30 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                            title="Issue Book"
                          >
                            Issue
                          </button>
                          <button
                            onClick={() => setSelectedBorrowerForDetails(b)}
                            className="p-1.5 rounded-md text-[#B3AABD] hover:text-white hover:bg-[#221F26] transition-colors"
                            title="View Profile & History"
                          >
                            <Users className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenSinglePrint(b)}
                            className="p-1.5 rounded-md text-[#B3AABD] hover:text-[#E0B450] hover:bg-[#221F26] transition-colors"
                            title="Print Card"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setBorrowerToEdit(b);
                              setIsAddEditModalOpen(true);
                            }}
                            className="p-1.5 rounded-md text-[#B3AABD] hover:text-[#34D399] hover:bg-[#221F26] transition-colors"
                            title="Edit"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onDeleteBorrower(b)}
                            className="p-1.5 rounded-md text-[#B3AABD] hover:text-rose-400 hover:bg-[#221F26] transition-colors"
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
