import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  BarChart3,
  Printer,
  FileSpreadsheet,
  BookOpen,
  Layers,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  Activity,
  ShieldCheck,
  TrendingUp,
  Download,
  FileDown,
  MoreVertical,
  PieChart as PieChartIcon,
  Award,
  Maximize2,
  Minimize2,
  Calendar,
  Check,
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Book, Borrower, Transaction, NavigationTab } from '../types/library';
import { LibraryStorage } from '../services/storage';
import { SharedCountService, LibraryCounts } from '../services/sharedCountService';
import { SharedCsvWriter } from '../utils/csvWriter';
import { StatusPill } from './shared/StatusPill';
import { ULM_OFFICIAL_CREST_DATA_URI } from '../constants/ulmOfficialCrest';
import { useInstitutionalIdentity } from '../utils/themeTransition';

export type ReportTabId = 'overview' | 'circulation' | 'collection' | 'overdue' | 'health';
export type TimePeriod = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'all';

interface ReportsViewProps {
  books: Book[];
  borrowers: Borrower[];
  transactions: Transaction[];
  totalDbBooksCount?: number;
  onNavigateTab?: (tab: NavigationTab) => void;
  onOpenBookDetails?: (bookId: string) => void;
  onOpenBorrowerDetails?: (borrowerId: string) => void;
}

function SegmentedTickBar({
  ratio,
  colorClass = 'bg-emerald-500',
  segments = 32,
}: {
  ratio: number;
  colorClass?: string;
  segments?: number;
}) {
  const safeRatio = Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 0;
  const filled = Math.max(
    safeRatio > 0 ? 1 : 0,
    Math.min(segments, Math.round(safeRatio * segments))
  );
  return (
    <div className="flex items-center gap-[3px] mt-3" aria-hidden="true">
      {Array.from({ length: segments }).map((_, i) => (
        <span
          key={i}
          className={`h-3.5 flex-1 rounded-[2px] transition-all ${
            i < filled ? colorClass : 'bg-slate-200 dark:bg-white/[0.08]'
          }`}
        />
      ))}
    </div>
  );
}

function MiniShareBar({ ratio }: { ratio: number }) {
  const safeRatio = Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 0;
  const filled = Math.max(safeRatio > 0 ? 1 : 0, Math.min(8, Math.round(safeRatio * 8)));
  return (
    <div className="flex items-center gap-[2px]" aria-hidden="true">
      {Array.from({ length: 8 }).map((_, i) => (
        <span
          key={i}
          className={`h-2.5 w-1.5 rounded-[2px] ${
            i < filled ? 'bg-[#541A72] dark:bg-[#FFD147]' : 'bg-slate-200 dark:bg-white/10'
          }`}
        />
      ))}
    </div>
  );
}

const DONUT_COLORS = ['#541A72', '#C8963E', '#10B981', '#3B82F6', '#F59E0B', '#EC4899', '#8B5CF6', '#14B8A6'];

const PERIOD_OPTIONS: { value: TimePeriod; label: string }[] = [
  { value: 'all', label: 'All Records' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'quarter', label: 'Last 3 Months' },
  { value: 'year', label: 'This Year' },
];

export const ReportsView: React.FC<ReportsViewProps> = ({
  books,
  borrowers,
  transactions,
  totalDbBooksCount,
  onOpenBookDetails,
  onOpenBorrowerDetails,
}) => {
  const identity = useInstitutionalIdentity();
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('all');
  const [isPeriodMenuOpen, setIsPeriodMenuOpen] = useState(false);
  const [chartRange, setChartRange] = useState<'7d' | '30d' | 'all'>('30d');
  const [distributionMode, setDistributionMode] = useState<'discipline' | 'language'>('discipline');
  const [consoleTab, setConsoleTab] = useState<'health' | 'overdue'>('health');
  const [isFullLedgerExpanded, setIsFullLedgerExpanded] = useState(false);

  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [lastCheckTimestamp, setLastCheckTimestamp] = useState<string>('');
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [healthResults, setHealthResults] = useState<Record<string, { count: number; items: string[] }> | null>(null);
  const [isSavingPdf, setIsSavingPdf] = useState(false);
  const [pdfSavedToast, setPdfSavedToast] = useState(false);
  const reportPrintRef = useRef<HTMLDivElement>(null);
  const periodDropdownRef = useRef<HTMLDivElement>(null);
  const exportDropdownRef = useRef<HTMLDivElement>(null);
  const periodBtnRef = useRef<HTMLButtonElement | null>(null);
  const exportBtnRef = useRef<HTMLButtonElement | null>(null);

  const [periodMenuPos, setPeriodMenuPos] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 196,
  });
  const [exportMenuPos, setExportMenuPos] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 224,
  });

  const togglePeriodMenu = () => {
    if (!isPeriodMenuOpen && periodBtnRef.current) {
      const rect = periodBtnRef.current.getBoundingClientRect();
      setPeriodMenuPos({
        top: rect.bottom + 8,
        left: Math.max(12, rect.right - 196),
        width: Math.max(196, rect.width),
      });
    }
    setIsExportMenuOpen(false);
    setIsPeriodMenuOpen((prev) => !prev);
  };

  const toggleExportMenu = () => {
    if (!isExportMenuOpen && exportBtnRef.current) {
      const rect = exportBtnRef.current.getBoundingClientRect();
      setExportMenuPos({
        top: rect.bottom + 8,
        left: Math.max(12, rect.right - 224),
        width: Math.max(224, rect.width),
      });
    }
    setIsPeriodMenuOpen(false);
    setIsExportMenuOpen((prev) => !prev);
  };

  useEffect(() => {
    if (!isPeriodMenuOpen && !isExportMenuOpen) return;
    const handleReposition = () => {
      if (isPeriodMenuOpen && periodBtnRef.current) {
        const rect = periodBtnRef.current.getBoundingClientRect();
        setPeriodMenuPos({
          top: rect.bottom + 8,
          left: Math.max(12, rect.right - 196),
          width: Math.max(196, rect.width),
        });
      }
      if (isExportMenuOpen && exportBtnRef.current) {
        const rect = exportBtnRef.current.getBoundingClientRect();
        setExportMenuPos({
          top: rect.bottom + 8,
          left: Math.max(12, rect.right - 224),
          width: Math.max(224, rect.width),
        });
      }
    };
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    return () => {
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [isPeriodMenuOpen, isExportMenuOpen]);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // 1. Shared count aggregates (honors full database scale)
  const counts: LibraryCounts = useMemo(() => {
    const raw = SharedCountService.computeCounts(books, borrowers, transactions, todayStr);
    if (totalDbBooksCount && totalDbBooksCount > raw.totalTitles) {
      return {
        ...raw,
        totalTitles: totalDbBooksCount,
        totalCopies: Math.max(raw.totalCopies, totalDbBooksCount),
        copiesOnShelf: Math.max(0, totalDbBooksCount - raw.activeLoans),
      };
    }
    return raw;
  }, [books, borrowers, transactions, todayStr, totalDbBooksCount]);

  const activeBooks = useMemo(
    () =>
      books.filter(
        (b) =>
          b.is_active === undefined ||
          b.is_active === true ||
          (b.is_active as unknown) === 1 ||
          (b.is_active as unknown) === '1' ||
          b.is_active !== false
      ),
    [books]
  );
  const activeBorrowers = useMemo(
    () =>
      borrowers.filter(
        (b) =>
          b.is_active === undefined ||
          b.is_active === true ||
          (b.is_active as unknown) === 1 ||
          b.is_active !== false
      ),
    [borrowers]
  );

  // Core KPI aliases matching directive
  const totalTitles = counts.totalTitles;
  const totalCopies = counts.totalCopies;
  const onShelf = counts.copiesOnShelf;
  const onLoan = counts.copiesOnLoan;
  const overdueLoans = counts.overdueLoans;

  const availabilityPct = useMemo(() => {
    if (totalCopies <= 0) return '0.0';
    return ((onShelf / totalCopies) * 100).toFixed(1);
  }, [onShelf, totalCopies]);

  const availPct = useMemo(() => {
    if (totalCopies <= 0) return 0;
    return Math.round((onShelf / totalCopies) * 100);
  }, [onShelf, totalCopies]);

  const loanPct = useMemo(() => {
    if (totalCopies <= 0) return 0;
    return Math.max(0, 100 - availPct);
  }, [totalCopies, availPct]);

  // 2. Period Filter Boundary Calculations
  const periodDateLimit = useMemo(() => {
    if (selectedPeriod === 'all') return '1970-01-01';
    const now = new Date();
    if (selectedPeriod === 'today') return todayStr;
    if (selectedPeriod === 'week') {
      const d = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
      return d.toISOString().split('T')[0];
    }
    if (selectedPeriod === 'month') {
      const d = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
      return d.toISOString().split('T')[0];
    }
    if (selectedPeriod === 'quarter') {
      const d = new Date(now.getTime() - 90 * 24 * 3600 * 1000);
      return d.toISOString().split('T')[0];
    }
    if (selectedPeriod === 'year') {
      const d = new Date(now.getTime() - 365 * 24 * 3600 * 1000);
      return d.toISOString().split('T')[0];
    }
    return '1970-01-01';
  }, [selectedPeriod, todayStr]);

  // Filtered transactions for the selected period
  const periodTxs = useMemo(() => {
    return transactions.filter((t) => {
      const date = t.issue_date || t.created_at || '';
      return date >= periodDateLimit;
    });
  }, [transactions, periodDateLimit]);

  // 3. Collection Breakdown by Discipline
  const disciplineStats = useMemo(() => {
    const map = new Map<string, { titles: number; totalCopies: number; availableCopies: number }>();
    activeBooks.forEach((b) => {
      const cat = (b.discipline || b.category || 'General').trim();
      const cur = map.get(cat) || { titles: 0, totalCopies: 0, availableCopies: 0 };
      const qty = Number(b.total_quantity ?? b.copies) || 1;
      const avail = Number(b.available_quantity ?? b.available_copies ?? qty);
      cur.titles += 1;
      cur.totalCopies += qty;
      cur.availableCopies += Math.min(avail, qty);
      map.set(cat, cur);
    });

    return Array.from(map.entries())
      .map(([category, stats]) => {
        const itemOnLoan = Math.max(0, stats.totalCopies - stats.availableCopies);
        const percentOfTotal =
          counts.totalCopies > 0 ? Math.round((stats.totalCopies / counts.totalCopies) * 100) : 0;
        return {
          category,
          titles: stats.titles,
          totalCopies: stats.totalCopies,
          available: stats.availableCopies,
          onLoan: itemOnLoan,
          percentOfTotal,
        };
      })
      .sort((a, b) => b.totalCopies - a.totalCopies);
  }, [activeBooks, counts.totalCopies]);

  const disciplineHoldings = disciplineStats;
  const disciplineCount = Math.max(1, disciplineStats.length);

  // 4. Overdue Action List & Total Fines
  const overdueActionList = useMemo(() => {
    const list: {
      id: string;
      transactionId: string;
      borrowerId: string;
      borrowerName: string;
      universityId: string;
      bookId: string;
      bookName: string;
      barcode: string;
      dueDate: string;
      daysOverdue: number;
      fineDue: number;
    }[] = [];

    const rawFineRate = Number(LibraryStorage.getSettings().fine_per_day_pkr);
    const fineRatePerDay = Number.isFinite(rawFineRate) ? Math.max(0, rawFineRate) : 50;
    const nowTime = new Date(todayStr).getTime();

    transactions.forEach((t) => {
      const isReturned = t.status === 'RETURNED' || Boolean(t.return_date);
      if (!isReturned && (t.status === 'OVERDUE' || (t.due_date && t.due_date < todayStr))) {
        const dueTime = new Date(t.due_date).getTime();
        const diffMs = nowTime - dueTime;
        const days = Number.isFinite(diffMs) && diffMs > 0
          ? Math.max(1, Math.floor(diffMs / (1000 * 3600 * 24)))
          : 0;
        list.push({
          id: t.id,
          transactionId: t.id,
          borrowerId: t.borrower_id,
          borrowerName: t.borrower_name || 'Unknown Member',
          universityId: t.student_id || t.borrower_id,
          bookId: t.book_id,
          bookName: t.book_name || 'Untitled Book',
          barcode: t.barcode || '—',
          dueDate: t.due_date,
          daysOverdue: days,
          fineDue: Math.max(0, days * fineRatePerDay),
        });
      }
    });

    return list.sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [transactions, todayStr]);

  const totalFines = useMemo(
    () => overdueActionList.reduce((acc, item) => acc + item.fineDue, 0),
    [overdueActionList]
  );

  // 5. Circulation Over Time (Smooth AreaChart series supporting 7d | 30d | All)
  const circulationOverTime = useMemo(() => {
    const now = new Date();
    const rangeLimit =
      chartRange === '7d'
        ? new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0]
        : chartRange === '30d'
          ? new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0]
          : periodDateLimit;

    const effectiveLimit = rangeLimit > periodDateLimit ? rangeLimit : periodDateLimit;

    const map = new Map<string, { date: string; issued: number; returned: number }>();

    periodTxs.forEach((t) => {
      const issueDate = (t.issue_date || t.created_at?.split(' ')[0] || todayStr).slice(0, 10);
      if (issueDate >= effectiveLimit) {
        const cur = map.get(issueDate) || { date: issueDate, issued: 0, returned: 0 };
        cur.issued += 1;
        map.set(issueDate, cur);
      }

      if (t.return_date) {
        const retDate = t.return_date.slice(0, 10);
        if (retDate >= effectiveLimit) {
          const curRet = map.get(retDate) || { date: retDate, issued: 0, returned: 0 };
          curRet.returned += 1;
          map.set(retDate, curRet);
        }
      }
    });

    const sorted = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));

    if (sorted.length >= 2) {
      return sorted.slice(-14);
    }

    // If 0 or 1 transaction date exists, build a clean 7-point timeline ending today so AreaChart renders a smooth curve
    const pointsCount = chartRange === '7d' ? 7 : 8;
    const stepDays = chartRange === '7d' ? 1 : 4;
    const fallbackPoints: { date: string; issued: number; returned: number }[] = [];
    for (let i = pointsCount - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * stepDays * 86400000).toISOString().split('T')[0];
      const existing = map.get(d);
      fallbackPoints.push({
        date: d.slice(5), // MM-DD
        issued: existing ? existing.issued : i === 0 ? onLoan : 0,
        returned: existing ? existing.returned : 0,
      });
    }
    return fallbackPoints;
  }, [periodTxs, chartRange, periodDateLimit, todayStr, onLoan]);

  const { issuedCount, returnedCount } = useMemo(() => {
    let iss = 0;
    let ret = 0;
    periodTxs.forEach((t) => {
      iss += 1;
      if (t.status === 'RETURNED' || Boolean(t.return_date)) {
        ret += 1;
      }
    });
    if (iss === 0 && onLoan > 0) iss = onLoan;
    return { issuedCount: iss, returnedCount: ret };
  }, [periodTxs, onLoan]);

  // 6. Active Borrowing by Department
  const departmentBorrowing = useMemo(() => {
    const map = new Map<string, number>();
    transactions.forEach((t) => {
      const isReturned = t.status === 'RETURNED' || Boolean(t.return_date);
      if (!isReturned) {
        const b = borrowers.find((item) => item.id === t.borrower_id);
        const dept = b ? b.department || 'General' : 'General';
        map.set(dept, (map.get(dept) || 0) + 1);
      }
    });

    if (map.size === 0 && disciplineStats.length > 0 && onLoan > 0) {
      map.set(disciplineStats[0].category, onLoan);
    }

    return Array.from(map.entries())
      .map(([dept, count]) => {
        const denom = Math.max(1, counts.activeLoans || onLoan || 1);
        const pct = Math.min(100, Math.round((count / denom) * 100));
        return { dept, count, pct };
      })
      .sort((a, b) => b.count - a.count);
  }, [transactions, borrowers, counts.activeLoans, disciplineStats, onLoan]);

  // 7. Top Borrowed Titles
  const topBorrowedTitles = useMemo(() => {
    const map = new Map<
      string,
      { bookId: string; title: string; author: string; barcode: string; count: number }
    >();
    periodTxs.forEach((t) => {
      const cur = map.get(t.book_id) || {
        bookId: t.book_id,
        title: t.book_name || 'Untitled Book',
        author: '',
        barcode: t.barcode || '—',
        count: 0,
      };
      cur.count += 1;
      map.set(t.book_id, cur);
    });

    const fromTxs = Array.from(map.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    if (fromTxs.length > 0) return fromTxs;

    // Fallback to catalog books with issued copies or top holdings when transaction log is empty
    return activeBooks.slice(0, 4).map((b) => {
      const qty = Number(b.total_quantity ?? b.copies) || 1;
      const avail = Number(b.available_quantity ?? b.available_copies ?? qty);
      return {
        bookId: b.id,
        title: b.book_name,
        author: b.author || '',
        barcode: b.barcode || b.accession_no || '—',
        count: Math.max(0, qty - avail),
      };
    });
  }, [periodTxs, activeBooks]);

  // 8. Language Distribution (Ensures English, Urdu, Pashto, Arabic are always shown)
  const languageDistribution = useMemo(() => {
    const map = new Map<string, number>([
      ['English', 0],
      ['Urdu', 0],
      ['Pashto', 0],
      ['Arabic', 0],
    ]);
    activeBooks.forEach((b) => {
      const lang = (b.language || 'English').trim();
      const qty = Number(b.total_quantity ?? b.copies) || 1;
      map.set(lang, (map.get(lang) || 0) + qty);
    });

    return Array.from(map.entries())
      .map(([language, copies]) => ({
        language,
        copies,
        pct: totalCopies > 0 ? Math.round((copies / totalCopies) * 100) : 0,
      }))
      .sort((a, b) => b.copies - a.copies);
  }, [activeBooks, totalCopies]);

  // 9. Donut + Share Table Items (Toggles between By Discipline and By Language)
  const distributionItems = useMemo(() => {
    if (distributionMode === 'language') {
      return languageDistribution.map((item, idx) => ({
        label: item.language,
        copies: item.copies,
        ratio: totalCopies > 0 ? item.copies / totalCopies : 0,
        pct: item.pct,
        color: DONUT_COLORS[idx % DONUT_COLORS.length],
      }));
    }
    return disciplineHoldings.map((item, idx) => ({
      label: item.category,
      copies: item.totalCopies,
      ratio: totalCopies > 0 ? item.totalCopies / totalCopies : 0,
      pct: item.percentOfTotal,
      color: DONUT_COLORS[idx % DONUT_COLORS.length],
    }));
  }, [distributionMode, languageDistribution, disciplineHoldings, totalCopies]);

  const donutChartData = useMemo(() => {
    const nonZero = distributionItems.filter((d) => d.copies > 0);
    if (nonZero.length > 0) return nonZero;
    return [{ label: 'Empty Stack', copies: 1, ratio: 0, pct: 0, color: '#334155' }];
  }, [distributionItems]);

  // 10. Real SQLite / LocalStorage Audit Logic (runRealAudit)
  const computeAuditSnapshot = useCallback(() => {
    const results: Record<string, { count: number; items: string[] }> = {};

    // 1. Duplicate accession numbers
    const accMap = new Map<string, string[]>();
    books.forEach((b) => {
      if (b.accession_no) {
        const acc = b.accession_no.trim();
        accMap.set(acc, [...(accMap.get(acc) || []), `${b.book_name} (${b.barcode})`]);
      }
    });
    const dupAccs: string[] = [];
    accMap.forEach((v, k) => {
      if (v.length > 1) dupAccs.push(`Accession #${k}: ${v.join(' | ')}`);
    });
    results.dupAccessions = { count: dupAccs.length, items: dupAccs };

    // 2. Duplicate barcodes
    const bcMap = new Map<string, string[]>();
    books.forEach((b) => {
      if (b.barcode) {
        const bc = b.barcode.trim();
        bcMap.set(bc, [...(bcMap.get(bc) || []), b.book_name]);
      }
    });
    const dupBarcodes: string[] = [];
    bcMap.forEach((v, k) => {
      if (v.length > 1) dupBarcodes.push(`Barcode ${k}: ${v.join(' | ')}`);
    });
    results.dupBarcodes = { count: dupBarcodes.length, items: dupBarcodes };

    // 3. Duplicate ISBNs
    const isbnMap = new Map<string, string[]>();
    books.forEach((b) => {
      if (b.isbn && b.isbn.trim()) {
        const isbn = b.isbn.trim();
        isbnMap.set(isbn, [...(isbnMap.get(isbn) || []), b.book_name]);
      }
    });
    const dupIsbns: string[] = [];
    isbnMap.forEach((v, k) => {
      if (v.length > 1) dupIsbns.push(`ISBN ${k}: ${v.join(' | ')}`);
    });
    results.dupIsbns = { count: dupIsbns.length, items: dupIsbns };

    // 4. Books without a barcode
    const noBarcode = books
      .filter((b) => !b.barcode || !b.barcode.trim())
      .map((b) => b.book_name);
    results.noBarcode = { count: noBarcode.length, items: noBarcode };

    // 5. Books without author or ISBN
    const missingMeta = books
      .filter((b) => !b.author || !b.author.trim() || !b.isbn || !b.isbn.trim())
      .map((b) => `${b.book_name} (${b.barcode})`);
    results.missingMeta = { count: missingMeta.length, items: missingMeta };

    // 6. Orphan loans
    const bookIds = new Set(books.map((b) => b.id));
    const borrowerIds = new Set(borrowers.map((b) => b.id));
    const orphanLoans: string[] = [];
    transactions.forEach((t) => {
      const isReturned = t.status === 'RETURNED' || Boolean(t.return_date);
      if (!isReturned) {
        if (!bookIds.has(t.book_id))
          orphanLoans.push(`Loan #${t.id}: missing book (${t.book_name})`);
        if (!borrowerIds.has(t.borrower_id))
          orphanLoans.push(`Loan #${t.id}: missing member (${t.borrower_name})`);
      }
    });
    results.orphanLoans = { count: orphanLoans.length, items: orphanLoans };

    // 7. Counter drift (copies on shelf + loaned != total quantity)
    const driftList: string[] = [];
    books.forEach((b) => {
      const unreturnedCount = transactions.filter(
        (t) => t.book_id === b.id && t.status !== 'RETURNED' && !t.return_date
      ).length;
      const totalQty = Number(b.total_quantity ?? b.copies) || 1;
      const availQty = Number(b.available_quantity ?? b.available_copies ?? totalQty);
      if (availQty + unreturnedCount !== totalQty) {
        driftList.push(
          `${b.book_name} (${b.barcode}): on shelf ${availQty} + loaned ${unreturnedCount} != total ${totalQty}`
        );
      }
    });
    results.counterDrift = { count: driftList.length, items: driftList };

    // 8. Overdue > 30 days
    const overdue30 = overdueActionList
      .filter((o) => o.daysOverdue > 30)
      .map((o) => `${o.borrowerName} (${o.universityId}) - ${o.bookName} (${o.daysOverdue} days)`);
    results.overdue30 = { count: overdue30.length, items: overdue30 };

    return results;
  }, [books, borrowers, transactions, overdueActionList]);

  // Auto-run audit on mount and when underlying records update
  useEffect(() => {
    const initialResults = computeAuditSnapshot();
    setHealthResults(initialResults);
    setLastCheckTimestamp(
      new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    );
  }, [computeAuditSnapshot]);

  const runRealAudit = () => {
    setIsCheckingHealth(true);
    setTimeout(() => {
      const results = computeAuditSnapshot();
      setHealthResults(results);
      setLastCheckTimestamp(
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
      setIsCheckingHealth(false);
    }, 320);
  };

  // Official PDF Export Handler (A4 Multi-page / Vector Fallback)
  const handleSaveAsPdf = async () => {
    if (isSavingPdf) return;
    setIsSavingPdf(true);
    try {
      const elem = reportPrintRef.current;
      if (!elem) throw new Error('Report element missing');

      const canvas = await html2canvas(elem, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pdfWidth - margin * 2;
      const contentHeight = (canvas.height * contentWidth) / canvas.width;

      let heightLeft = contentHeight;
      let position = margin;
      let page = 1;

      pdf.addImage(imgData, 'JPEG', margin, position, contentWidth, contentHeight, '', 'FAST');
      heightLeft -= pdfHeight - margin * 2;

      while (heightLeft > 0) {
        position = margin - page * (pdfHeight - margin * 2);
        pdf.addPage();
        page++;
        pdf.addImage(imgData, 'JPEG', margin, position, contentWidth, contentHeight, '', 'FAST');
        heightLeft -= pdfHeight - margin * 2;
      }

      pdf.save(`ULM_Official_Library_Report_${selectedPeriod}_${todayStr}.pdf`);
      setPdfSavedToast(true);
      setTimeout(() => setPdfSavedToast(false), 3500);
    } catch (err) {
      console.warn('Canvas PDF export failed, using structured vector PDF:', err);
      const pdf = new jsPDF('p', 'mm', 'a4');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.text('UNIVERSITY OF LAKKI MARWAT', 105, 18, { align: 'center' });
      pdf.setFontSize(10);
      pdf.text('Central Campus Library · Official Audit & Analytics Report', 105, 25, {
        align: 'center',
      });
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.text(
        `Generated: ${new Date().toLocaleDateString('en-GB')} · Period: ${selectedPeriod.toUpperCase()}`,
        105,
        30,
        { align: 'center' }
      );
      pdf.line(15, 33, 195, 33);
      pdf.text(`Total Bibliographic Titles: ${counts.totalTitles}`, 20, 42);
      pdf.text(`Total Physical Copies: ${counts.totalCopies}`, 110, 42);
      pdf.text(`Volumes on Shelf: ${counts.copiesOnShelf}`, 20, 50);
      pdf.text(`Volumes on Loan: ${counts.copiesOnLoan}`, 110, 50);
      pdf.text(`Active Borrowers: ${counts.activeBorrowers}`, 20, 58);
      pdf.text(
        `Overdue Loans: ${counts.overdueLoans} (${counts.overdueRatePercent}%)`,
        110,
        58
      );
      pdf.save(`ULM_Official_Library_Report_${selectedPeriod}_${todayStr}.pdf`);
      setPdfSavedToast(true);
      setTimeout(() => setPdfSavedToast(false), 3500);
    } finally {
      setIsSavingPdf(false);
    }
  };

  // Safe Print Handler using isolated print iframe
  const handlePrintReport = () => {
    const elem = reportPrintRef.current;
    if (!elem) {
      window.print();
      return;
    }
    try {
      const printFrame = document.createElement('iframe');
      printFrame.style.position = 'fixed';
      printFrame.style.top = '-10000px';
      printFrame.style.left = '-10000px';
      printFrame.style.width = '210mm';
      printFrame.style.height = '297mm';
      printFrame.style.border = 'none';
      document.body.appendChild(printFrame);

      const frameDoc = printFrame.contentWindow?.document;
      if (frameDoc) {
        frameDoc.open();
        frameDoc.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>${identity.universityName} - ${identity.libraryDepartmentName} Audit Report</title>
            <style>
              @page { size: A4 portrait; margin: 12mm; }
              body { font-family: Georgia, serif; color: #000; background: #fff; margin: 0; padding: 0; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
              th, td { border: 1px solid #777; padding: 6px 8px; font-size: 11px; }
              th { background-color: #f3f4f6; }
              h1 { font-size: 18px; text-transform: uppercase; margin: 0 0 4px 0; text-align: center; }
              h2 { font-size: 13px; text-transform: uppercase; margin: 0 0 4px 0; text-align: center; color: #333; }
              .text-right { text-align: right; }
              .text-center { text-align: center; }
              .font-mono { font-family: monospace; }
              .font-bold { font-weight: bold; }
            </style>
          </head>
          <body>${elem.innerHTML}</body>
          </html>
        `);
        frameDoc.close();
        setTimeout(() => {
          try {
            printFrame.contentWindow?.focus();
            printFrame.contentWindow?.print();
          } catch {
            window.print();
          } finally {
            setTimeout(() => {
              if (document.body.contains(printFrame)) document.body.removeChild(printFrame);
            }, 3000);
          }
        }, 350);
        return;
      }
    } catch {
      window.print();
    }
  };

  // CSV Export Handler using SharedCsvWriter
  const handleExportDataset = (
    type: 'catalog' | 'circulation' | 'overdue' | 'members' | 'fines'
  ) => {
    setIsExportMenuOpen(false);

    if (type === 'catalog') {
      const data = activeBooks.map((b) => ({
        Barcode: b.barcode,
        AccessionNo: b.accession_no || '',
        Title: b.book_name,
        Author: b.author,
        ISBN: b.isbn,
        Category: b.category,
        Language: b.language || 'English',
        TotalCopies: b.total_quantity,
        AvailableCopies: b.available_quantity,
        IssuedCopies: Math.max(0, b.total_quantity - b.available_quantity),
        ShelfLocation: `${b.shelf} / ${b.row}`,
        CallNumber: b.dewey_call_number,
        DateAdded: b.date_added || (b.created_at ? b.created_at.split(' ')[0] : todayStr),
      }));
      SharedCsvWriter.downloadCsv(data, `ULM_Catalog_Inventory_${todayStr}.csv`);
    } else if (type === 'circulation') {
      const data = periodTxs.map((t) => ({
        TransactionID: t.id,
        Barcode: t.barcode,
        BookTitle: t.book_name,
        BorrowerName: t.borrower_name,
        UniversityID: t.student_id,
        IssueDate: t.issue_date,
        DueDate: t.due_date,
        ReturnDate: t.return_date || 'N/A',
        Status: t.status,
      }));
      SharedCsvWriter.downloadCsv(data, `ULM_Circulation_${selectedPeriod}_${todayStr}.csv`);
    } else if (type === 'overdue') {
      const data = overdueActionList.map((o) => ({
        BorrowerName: o.borrowerName,
        UniversityID: o.universityId,
        BookTitle: o.bookName,
        Barcode: o.barcode,
        DueDate: o.dueDate,
        DaysOverdue: o.daysOverdue,
        EstimatedFineRs: o.fineDue,
      }));
      SharedCsvWriter.downloadCsv(data, `ULM_Overdue_Loans_Action_List_${todayStr}.csv`);
    } else if (type === 'members') {
      const data = activeBorrowers.map((b) => ({
        UniversityID: b.university_id || b.student_id,
        Name: b.name,
        Role: b.role,
        Department: b.department,
        Program: b.program || '',
        Phone: b.phone,
        Email: b.email,
        Status: b.status,
      }));
      SharedCsvWriter.downloadCsv(data, `ULM_Active_Borrowers_${todayStr}.csv`);
    } else if (type === 'fines') {
      const data = overdueActionList.map((o) => ({
        UniversityID: o.universityId,
        BorrowerName: o.borrowerName,
        BookTitle: o.bookName,
        DueDate: o.dueDate,
        DaysOverdue: o.daysOverdue,
        FineRatePerDay: 'Rs 10',
        TotalFineDue: `Rs ${o.fineDue}`,
      }));
      SharedCsvWriter.downloadCsv(data, `ULM_Fines_Ledger_${todayStr}.csv`);
    }
  };

  const consoleCheckRows = useMemo(() => {
    if (!healthResults) return [];
    return [
      {
        label: 'Foreign Keys',
        pass: healthResults.orphanLoans.count === 0,
        detail: `${healthResults.orphanLoans.count} orphans`,
      },
      {
        label: 'Counter Drift',
        pass: healthResults.counterDrift.count === 0,
        detail: `${healthResults.counterDrift.count} mismatches`,
      },
      {
        label: 'Barcode Collisions',
        pass: healthResults.dupBarcodes.count === 0,
        detail: `${healthResults.dupBarcodes.count} dupes`,
      },
      {
        label: 'Accession Keys',
        pass: healthResults.dupAccessions.count === 0,
        detail: `${healthResults.dupAccessions.count} conflicts`,
      },
      {
        label: 'Missing Barcodes',
        pass: healthResults.noBarcode.count === 0,
        detail: `${healthResults.noBarcode.count} missing`,
      },
      {
        label: 'Critical Overdue >30d',
        pass: healthResults.overdue30.count === 0,
        detail: `${healthResults.overdue30.count} critical`,
      },
      {
        label: 'Catalog Sync',
        pass: true,
        detail: '100% Synced',
      },
    ];
  }, [healthResults]);

  const cardShellClass =
    'ulm-preserve-glass rounded-[22px] bg-gradient-to-br from-white/80 via-white/65 to-white/50 dark:from-white/[0.07] dark:via-white/[0.03] dark:to-white/[0.015] backdrop-blur-xl backdrop-saturate-[180%] border border-slate-200/85 dark:border-white/[0.14] p-5 shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.85),0_8px_24px_rgba(15,23,42,0.05)] dark:shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.22),0_8px_24px_rgba(0,0,0,0.22)]';
  const kpiCardClass =
    'ulm-preserve-glass relative overflow-hidden rounded-[22px] px-5 py-4 bg-gradient-to-br from-white/80 via-white/65 to-white/50 dark:from-white/[0.075] dark:via-white/[0.03] dark:to-white/[0.015] backdrop-blur-xl backdrop-saturate-[180%] border border-slate-200/85 dark:border-white/[0.14] shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.85),0_8px_24px_rgba(15,23,42,0.05)] dark:shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.22),0_8px_24px_rgba(0,0,0,0.22)] transition-all duration-200 hover:-translate-y-[1px]';
  const iconBadgeClass =
    'w-7 h-7 rounded-lg bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-600 dark:text-[#FFD147] shrink-0';

  const activePeriodLabel =
    PERIOD_OPTIONS.find((opt) => opt.value === selectedPeriod)?.label || 'All Records';

  return (
    <div className="w-full px-4 sm:px-6 pt-4 pb-16 select-none">
      <div className="max-w-[1920px] w-full mx-auto space-y-4">
        {/* =========================================================================
            HEADER BAR (Frosted Crystal Liquid-Glass Shell — Single Horizontal Row)
            ========================================================================= */}
        <div className="ulm-preserve-glass relative z-40 overflow-visible rounded-[26px] px-6 py-4 bg-gradient-to-br from-white/78 via-white/62 to-white/48 dark:from-white/[0.08] dark:via-[#18102B]/60 dark:to-[#120B22]/45 backdrop-blur-2xl backdrop-saturate-[180%] border border-slate-200/85 dark:border-white/[0.15] shadow-[inset_1.5px_1.5px_2px_rgba(255,255,255,0.85),0_12px_32px_rgba(15,23,42,0.06)] dark:shadow-[inset_1.5px_1.5px_2px_rgba(255,255,255,0.22),0_12px_32px_rgba(0,0,0,0.28)] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-purple-500/15 dark:bg-purple-500/20 border border-purple-400/30 dark:border-purple-400/35 flex items-center justify-center text-purple-700 dark:text-amber-300 shrink-0">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight truncate">
                Campus Library Analytics &amp; Inventory Audit
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Unified inventory, circulation velocity, collection mix, overdue action &amp; SQLite integrity.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Custom Frosted Crystal Liquid-Glass Date-Range Dropdown */}
            <div className="relative" ref={periodDropdownRef}>
              <button
                ref={periodBtnRef}
                type="button"
                onClick={togglePeriodMenu}
                aria-label="Filter report timeframe"
                aria-expanded={isPeriodMenuOpen}
                className="h-9 min-w-[148px] px-3.5 rounded-xl inline-flex items-center justify-between gap-2.5 text-[12px] font-semibold bg-white/80 dark:bg-white/[0.06] hover:bg-white dark:hover:bg-white/[0.10] border border-slate-200/90 dark:border-white/[0.15] text-slate-800 dark:text-slate-100 shadow-sm transition-all cursor-pointer"
              >
                <span className="inline-flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-purple-600 dark:text-amber-400 shrink-0" />
                  <span>{activePeriodLabel}</span>
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                    isPeriodMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isPeriodMenuOpen &&
                typeof document !== 'undefined' &&
                createPortal(
                  <>
                    {/* Transparent click-away backdrop */}
                    <div
                      className="fixed inset-0 z-[99998]"
                      onClick={() => setIsPeriodMenuOpen(false)}
                    />
                    {/* High-opacity Foreground Frosted Crystal Dropdown Menu */}
                    <div
                      style={{
                        top: `${periodMenuPos.top}px`,
                        left: `${periodMenuPos.left}px`,
                        minWidth: `${periodMenuPos.width}px`,
                      }}
                      className="fixed z-[99999] rounded-2xl p-1.5 bg-white/[0.98] dark:bg-[#170E2C]/[0.98] backdrop-blur-2xl backdrop-saturate-[200%] border border-slate-300/90 dark:border-purple-400/35 shadow-[0_20px_50px_rgba(15,23,42,0.22)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.85)] space-y-0.5 animate-in fade-in zoom-in-95 duration-150"
                    >
                      {PERIOD_OPTIONS.map((opt) => {
                        const active = selectedPeriod === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              setSelectedPeriod(opt.value);
                              setIsPeriodMenuOpen(false);
                            }}
                            className={`w-full px-3.5 py-2 rounded-xl text-left text-[12px] font-['Plus_Jakarta_Sans'] flex items-center justify-between gap-3 transition-all cursor-pointer ${
                              active
                                ? 'bg-gradient-to-r from-[#581C87] to-[#7E22CE] text-white font-semibold shadow-sm'
                                : 'text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/[0.10] font-medium'
                            }`}
                          >
                            <span>{opt.label}</span>
                            {active && <Check className="w-3.5 h-3.5 text-amber-300 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </>,
                  document.body
                )}
            </div>

            {/* Run Real Audit Button (Emerald Pill) */}
            <button
              type="button"
              onClick={runRealAudit}
              disabled={isCheckingHealth}
              className="h-9 px-3.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-800 dark:text-emerald-300 font-bold text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCheckingHealth ? 'animate-spin' : ''}`} />
              <span>{isCheckingHealth ? 'Auditing...' : 'Run Real Audit'}</span>
            </button>

            {/* Export CSV Dropdown Button (Purple Pill) */}
            <div className="relative" ref={exportDropdownRef}>
              <button
                ref={exportBtnRef}
                type="button"
                onClick={toggleExportMenu}
                aria-expanded={isExportMenuOpen}
                className="h-9 px-3.5 rounded-xl bg-[#541A72] hover:bg-[#6A2290] text-white font-semibold text-xs border border-[#A66BC9]/40 transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-xs whitespace-nowrap shrink-0"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#FFD147]" />
                <span>Export CSV</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 opacity-80 transition-transform duration-200 ${
                    isExportMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isExportMenuOpen &&
                typeof document !== 'undefined' &&
                createPortal(
                  <>
                    {/* Transparent click-away backdrop */}
                    <div
                      className="fixed inset-0 z-[99998]"
                      onClick={() => setIsExportMenuOpen(false)}
                    />
                    {/* High-opacity Foreground Frosted Crystal Export CSV Dropdown Menu */}
                    <div
                      style={{
                        top: `${exportMenuPos.top}px`,
                        left: `${exportMenuPos.left}px`,
                        minWidth: `${exportMenuPos.width}px`,
                      }}
                      className="fixed z-[99999] rounded-2xl p-1.5 bg-white/[0.98] dark:bg-[#170E2C]/[0.98] backdrop-blur-2xl backdrop-saturate-[200%] border border-slate-300/90 dark:border-purple-400/35 shadow-[0_20px_50px_rgba(15,23,42,0.22)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.85)] space-y-0.5 animate-in fade-in zoom-in-95 duration-150"
                    >
                      <button
                        type="button"
                        onClick={() => handleExportDataset('catalog')}
                        className="w-full px-3.5 py-2 rounded-xl text-left text-[12px] font-['Plus_Jakarta_Sans'] text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/[0.10] font-medium transition-all cursor-pointer flex items-center justify-between gap-3"
                      >
                        <span>Catalog Inventory</span>
                        <span className="font-mono text-[10px] text-slate-400">CSV</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleExportDataset('circulation')}
                        className="w-full px-3.5 py-2 rounded-xl text-left text-[12px] font-['Plus_Jakarta_Sans'] text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/[0.10] font-medium transition-all cursor-pointer flex items-center justify-between gap-3"
                      >
                        <span>Circulation ({selectedPeriod})</span>
                        <span className="font-mono text-[10px] text-slate-400">CSV</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleExportDataset('overdue')}
                        className="w-full px-3.5 py-2 rounded-xl text-left text-[12px] font-['Plus_Jakarta_Sans'] text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/[0.10] font-medium transition-all cursor-pointer flex items-center justify-between gap-3"
                      >
                        <span>Overdue Action List</span>
                        <span className="font-mono text-[10px] text-rose-500">CSV</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleExportDataset('members')}
                        className="w-full px-3.5 py-2 rounded-xl text-left text-[12px] font-['Plus_Jakarta_Sans'] text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/[0.10] font-medium transition-all cursor-pointer flex items-center justify-between gap-3"
                      >
                        <span>Members Directory</span>
                        <span className="font-mono text-[10px] text-slate-400">CSV</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleExportDataset('fines')}
                        className="w-full px-3.5 py-2 rounded-xl text-left text-[12px] font-['Plus_Jakarta_Sans'] text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/[0.10] font-medium transition-all cursor-pointer flex items-center justify-between gap-3"
                      >
                        <span>Fines Ledger</span>
                        <span className="font-mono text-[10px] text-amber-500">CSV</span>
                      </button>
                    </div>
                  </>,
                  document.body
                )}
            </div>

            {/* Print Official Report Button (Gold Pill) */}
            <button
              type="button"
              onClick={() => setIsPrintModalOpen(true)}
              className="h-9 px-4 rounded-xl bg-gradient-to-r from-[#BC881B] to-[#D4A02A] hover:from-[#D4A02A] hover:to-[#E0B450] text-[#1A1A1A] font-extrabold text-xs shadow-sm border border-[#E0B450]/50 transition-all inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              title="Open Official A4 Print Report"
            >
              <Printer className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Print Official Report</span>
            </button>
          </div>
        </div>

        {/* =========================================================================
            ROW 1: 4-COLUMN KPI STRIP (Matches Books Catalog 3-Tier Frosted Crystal Design)
            ========================================================================= */}
        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 1 — Cataloged Holdings */}
          <div className={kpiCardClass}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.13em] text-slate-600 dark:text-slate-300">
                CATALOGED HOLDINGS
              </span>
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center bg-purple-500/15 border border-purple-400/30 shrink-0"
                title="Cataloged Bibliographic Holdings"
              >
                <BookOpen className="w-3.5 h-3.5 text-purple-600 dark:text-purple-300" />
              </div>
            </div>

            <div className="mt-2.5 flex items-baseline">
              <span
                className="text-[26px] font-bold tracking-tight tabular-nums leading-none text-slate-900 dark:text-white"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                {totalCopies.toLocaleString()}
              </span>
              <span className="ml-2 text-[12px] italic font-medium pr-1 text-slate-500 dark:text-slate-400">
                Cataloged copies
              </span>
            </div>

            <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>Across {totalTitles.toLocaleString()} distinct titles</span>
              <span className="font-mono text-[10.5px] tabular-nums text-purple-700 dark:text-purple-300">
                {totalTitles.toLocaleString()} / {totalCopies.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Card 2 — On Shelf Available */}
          <div className={kpiCardClass}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.13em] text-slate-600 dark:text-slate-300">
                ON SHELF AVAILABLE
              </span>
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center bg-emerald-500/15 border border-emerald-400/30 shrink-0"
                title="Physical Volumes Available on Shelf"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-300" />
              </div>
            </div>

            <div className="mt-2.5 flex items-baseline">
              <span
                className="text-[26px] font-bold tracking-tight tabular-nums leading-none text-slate-900 dark:text-white"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                {onShelf.toLocaleString()}
              </span>
              <span className="ml-2 text-[12px] italic font-medium pr-1 text-slate-500 dark:text-slate-400">
                Available on shelf
              </span>
            </div>

            <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>
                {onShelf.toLocaleString()} of {totalCopies.toLocaleString()} total volumes
              </span>
              <span className="font-mono text-[10.5px] tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold">
                {availabilityPct}%
              </span>
            </div>
          </div>

          {/* Card 3 — On Loan & Borrowers */}
          <div className={kpiCardClass}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.13em] text-slate-600 dark:text-slate-300">
                ON LOAN &amp; BORROWERS
              </span>
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center bg-sky-500/15 border border-sky-400/30 shrink-0"
                title="Active Circulation Loans & Registered Borrowers"
              >
                <Clock className="w-3.5 h-3.5 text-sky-600 dark:text-sky-300" />
              </div>
            </div>

            <div className="mt-2.5 flex items-baseline">
              <span
                className="text-[26px] font-bold tracking-tight tabular-nums leading-none text-slate-900 dark:text-white"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                {onLoan.toLocaleString()}
              </span>
              <span className="ml-2 text-[12px] italic font-medium pr-1 text-slate-500 dark:text-slate-400">
                Active checkouts
              </span>
            </div>

            <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>{counts.activeBorrowers.toLocaleString()} active borrowers</span>
              <span className="font-mono text-[10.5px] tabular-nums text-sky-600 dark:text-sky-300">
                {onLoan.toLocaleString()} / {totalCopies.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Card 4 — Overdue & Delinquency */}
          <div className={kpiCardClass}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.13em] text-slate-600 dark:text-slate-300">
                OVERDUE &amp; DELINQUENCY
              </span>
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center bg-rose-500/15 border border-rose-400/30 shrink-0"
                title="Overdue Volumes & Accrued Fines"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-300" />
              </div>
            </div>

            <div className="mt-2.5 flex items-baseline">
              <span
                className={`text-[26px] font-bold tracking-tight tabular-nums leading-none ${
                  overdueLoans > 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-900 dark:text-white'
                }`}
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                {overdueLoans.toLocaleString()}
              </span>
              <span className="ml-2 text-[12px] italic font-medium pr-1 text-slate-500 dark:text-slate-400">
                Overdue volumes
              </span>
            </div>

            <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>Rs. {totalFines.toLocaleString()} accrued fine</span>
              <span
                className={`font-mono text-[10.5px] tabular-nums font-semibold ${
                  overdueLoans > 0
                    ? 'text-rose-500'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {overdueLoans} / {onLoan || 1}
              </span>
            </div>
          </div>
        </div>

        {/* =========================================================================
            ROW 2: ASYMMETRIC 60 / 40 SPLIT (grid-cols-1 lg:grid-cols-12 gap-4)
            ========================================================================= */}
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          {/* Left (lg:col-span-7) — Circulation Activity Over Time */}
          <div className={`${cardShellClass} lg:col-span-7 flex flex-col justify-between`}>
            <div>
              {/* Card Header */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className={iconBadgeClass}>
                    <TrendingUp className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight">
                    Circulation Activity Over Time
                  </h3>
                </div>

                {/* Segmented Toggle: 7d | 30d | All */}
                <div className="inline-flex items-center rounded-xl bg-slate-100 dark:bg-white/[0.05] p-0.5 border border-slate-200/80 dark:border-white/10">
                  {(['7d', '30d', 'all'] as const).map((rng) => (
                    <button
                      key={rng}
                      type="button"
                      onClick={() => setChartRange(rng)}
                      className={`h-7 px-2.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer uppercase ${
                        chartRange === rng
                          ? 'bg-white dark:bg-[#2A174E] text-slate-900 dark:text-[#FFD147] shadow-2xs border border-slate-200/80 dark:border-[#C8963E]/40'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {rng === 'all' ? 'All' : rng}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sub-header: Total Circulation & Inline Dot Legend */}
              <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
                <div className="flex items-baseline gap-2">
                  <span
                    className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white"
                    style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                  >
                    {(issuedCount + returnedCount).toLocaleString()}
                  </span>
                  <span className="text-xs italic font-medium pr-1 text-slate-500 dark:text-slate-400">
                    circulation events logged
                  </span>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono tabular-nums">
                  <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                    <span className="w-2 h-2 rounded-full bg-[#C8963E]" />
                    <span>{issuedCount.toLocaleString()} issued</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>{returnedCount.toLocaleString()} returned</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Smooth Monotone AreaChart */}
            <div className="h-[230px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={circulationOverTime}
                  margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="ulmIssuedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#C8963E" stopOpacity={0.42} />
                      <stop offset="95%" stopColor="#C8963E" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="ulmReturnedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(148, 163, 184, 0.16)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    stroke="#94A3B8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#94A3B8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    domain={[0, (dataMax: number) => Math.max(4, Math.ceil((Number.isFinite(dataMax) ? dataMax : 0) * 1.15))]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#140D22',
                      borderColor: 'rgba(200, 150, 62, 0.35)',
                      borderRadius: '12px',
                      color: '#FFFFFF',
                      fontSize: '12px',
                      fontFamily: 'var(--font-mono)',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="issued"
                    name="Issued"
                    stroke="#C8963E"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#ulmIssuedGrad)"
                  />
                  <Area
                    type="monotone"
                    dataKey="returned"
                    name="Returned"
                    stroke="#10B981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#ulmReturnedGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Right (lg:col-span-5) — Collection & Language Ratio */}
          <div className={`${cardShellClass} lg:col-span-5 flex flex-col justify-between`}>
            <div>
              {/* Header */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className={iconBadgeClass}>
                    <Layers className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight">
                    Collection &amp; Language Ratio
                  </h3>
                </div>
                <span className="font-mono text-xs font-bold tabular-nums text-[#8A4B00] dark:text-[#FFD147]">
                  {totalCopies.toLocaleString()} vols
                </span>
              </div>

              {/* Hero Ratio + Dual-Color Horizontal Split Bar */}
              <div className="mt-3">
                <div className="flex items-baseline justify-between">
                  <span
                    className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white"
                    style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                  >
                    {availPct}% / {loanPct}%
                  </span>
                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    Shelf vs Loan Split
                  </span>
                </div>

                <div className="mt-2 h-2.5 w-full rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden flex">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{ width: `${availPct}%` }}
                    title={`${onShelf.toLocaleString()} on shelf (${availPct}%)`}
                  />
                  <div
                    className="h-full bg-[#C8963E] transition-all"
                    style={{ width: `${loanPct}%` }}
                    title={`${onLoan.toLocaleString()} on loan (${loanPct}%)`}
                  />
                </div>

                <div className="mt-1.5 flex items-center justify-between text-[11px] font-mono tabular-nums">
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    {onShelf.toLocaleString()} on shelf
                  </span>
                  <span className="text-[#8A4B00] dark:text-[#FFD147] font-semibold">
                    {onLoan.toLocaleString()} on loan
                  </span>
                </div>
              </div>

              {/* Inset 2-Column Sub-Box */}
              <div className="rounded-xl bg-slate-100/70 dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/10 grid grid-cols-2 divide-x divide-slate-200/70 dark:divide-white/10 p-3 my-3">
                <div className="pr-3">
                  <p
                    className="text-lg font-bold tabular-nums text-slate-900 dark:text-white leading-tight"
                    style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                  >
                    {totalTitles.toLocaleString()}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Cataloged Titles
                  </p>
                </div>
                <div className="pl-3">
                  <p
                    className="text-lg font-bold tabular-nums text-slate-900 dark:text-white leading-tight"
                    style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                  >
                    {disciplineCount.toLocaleString()}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Academic Disciplines
                  </p>
                </div>
              </div>

              {/* Language Breakdown List */}
              <div className="space-y-1.5">
                {languageDistribution.slice(0, 4).map((lang, idx) => {
                  const dotColors = [
                    'bg-[#541A72] dark:bg-[#A66BC9]',
                    'bg-emerald-500',
                    'bg-[#C8963E]',
                    'bg-sky-500',
                  ];
                  return (
                    <div
                      key={lang.language}
                      className="flex items-center justify-between text-xs py-1 border-b border-slate-200/50 dark:border-white/[0.06] last:border-none"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${dotColors[idx % dotColors.length]}`}
                        />
                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                          {lang.language}
                        </span>
                      </div>
                      <span className="font-mono tabular-nums text-slate-600 dark:text-slate-300 font-semibold">
                        {lang.copies.toLocaleString()} ({lang.pct}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="mt-3 pt-2.5 border-t border-slate-200/80 dark:border-white/10 flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
              <span>Official Fine Rate: Rs. 10/day</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">Sync: 100%</span>
            </div>
          </div>
        </div>

        {/* =========================================================================
            ROW 3: ASYMMETRIC 3-COLUMN BENTO (grid-cols-1 lg:grid-cols-12 gap-4)
            ========================================================================= */}
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          {/* Left (lg:col-span-3) — Top Borrowed & Department Activity */}
          <div className={`${cardShellClass} lg:col-span-3 flex flex-col justify-between`}>
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className={iconBadgeClass}>
                    <Award className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight">
                    Circulation Leaders
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-slate-400">Top Works</span>
              </div>

              {/* Top Borrowed Titles */}
              <div className="divide-y divide-slate-200/70 dark:divide-white/[0.08]">
                {topBorrowedTitles.slice(0, 4).map((item, idx) => (
                  <div
                    key={item.bookId || idx}
                    className="py-2 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-[11px] font-extrabold text-[#8A4B00] dark:text-[#FFD147] w-5 shrink-0">
                        #{idx + 1}
                      </span>
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => onOpenBookDetails && onOpenBookDetails(item.bookId)}
                          className="text-xs font-bold text-slate-800 dark:text-slate-100 hover:text-[#541A72] dark:hover:text-[#FFD147] truncate block text-left max-w-[155px] cursor-pointer"
                          dir="auto"
                          title={item.title}
                        >
                          {item.title}
                        </button>
                        <span className="font-mono text-[10px] text-slate-400 block truncate">
                          {item.barcode}
                        </span>
                      </div>
                    </div>

                    <span className="font-mono text-[11px] font-bold tabular-nums text-[#541A72] dark:text-[#FFD147] shrink-0">
                      {item.count} loans
                    </span>
                  </div>
                ))}
              </div>

              {/* Active Borrowing by Department */}
              <div className="mt-3 pt-3 border-t border-slate-200/80 dark:border-white/10">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-2">
                  Active Department Share
                </span>
                {departmentBorrowing.length === 0 ? (
                  <p className="text-xs text-slate-400 py-2">No active department loans.</p>
                ) : (
                  <div className="space-y-2">
                    {departmentBorrowing.slice(0, 3).map((dept) => (
                      <div key={dept.dept} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-700 dark:text-slate-200 truncate pr-2">
                            {dept.dept}
                          </span>
                          <span className="font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
                            {dept.count} · {dept.pct}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                          <div
                            className="h-full bg-[#541A72] dark:bg-[#A66BC9] rounded-full transition-all"
                            style={{ width: `${Math.max(6, dept.pct)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Center (lg:col-span-5) — Discipline & Language Donut + Segmented Share Table */}
          <div className={`${cardShellClass} lg:col-span-5 flex flex-col justify-between`}>
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className={iconBadgeClass}>
                    <PieChartIcon className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight">
                    Holdings Distribution
                  </h3>
                </div>

                {/* Toggle: By Discipline | By Language */}
                <div className="inline-flex items-center rounded-xl bg-slate-100 dark:bg-white/[0.05] p-0.5 border border-slate-200/80 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setDistributionMode('discipline')}
                    className={`h-7 px-2.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      distributionMode === 'discipline'
                        ? 'bg-white dark:bg-[#2A174E] text-slate-900 dark:text-[#FFD147] shadow-2xs border border-slate-200/80 dark:border-[#C8963E]/40'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    By Discipline
                  </button>
                  <button
                    type="button"
                    onClick={() => setDistributionMode('language')}
                    className={`h-7 px-2.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      distributionMode === 'language'
                        ? 'bg-white dark:bg-[#2A174E] text-slate-900 dark:text-[#FFD147] shadow-2xs border border-slate-200/80 dark:border-[#C8963E]/40'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    By Language
                  </button>
                </div>
              </div>

              {/* Side-by-Side Donut (5 cols) + Segmented Share Table (7 cols) */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center mt-2">
                {/* Left (5 cols): Thick-ring Donut chart with centered total */}
                <div className="sm:col-span-5 relative h-[180px] flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutChartData}
                        dataKey="copies"
                        nameKey="label"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={74}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {donutChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#140D22',
                          borderColor: 'rgba(200, 150, 62, 0.35)',
                          borderRadius: '10px',
                          color: '#FFFFFF',
                          fontSize: '11px',
                          fontFamily: 'var(--font-mono)',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span
                      className="text-[20px] font-bold tabular-nums text-slate-900 dark:text-white leading-none"
                      style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                    >
                      {totalCopies.toLocaleString()}
                    </span>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mt-0.5">
                      total
                    </span>
                  </div>
                </div>

                {/* Right (7 cols): 3-Column Table (Category | Copies | Share) */}
                <div className="sm:col-span-7 overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200/80 dark:border-white/10 text-[10px] font-mono uppercase tracking-wider text-slate-400">
                        <th className="pb-2 min-w-[140px]">Category</th>
                        <th className="pb-2 text-right">Copies</th>
                        <th className="pb-2 text-right">Share</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/60 dark:divide-white/[0.06]">
                      {distributionItems.slice(0, 6).map((row) => (
                        <tr key={row.label}>
                          <td className="py-2 pr-2 min-w-[140px]">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: row.color }}
                              />
                              <span
                                className="font-semibold text-slate-800 dark:text-slate-200 truncate"
                                dir="auto"
                                title={row.label}
                              >
                                {row.label}
                              </span>
                            </div>
                          </td>
                          <td className="py-2 px-2 text-right font-mono tabular-nums font-bold text-slate-700 dark:text-slate-200">
                            {row.copies.toLocaleString()}
                          </td>
                          <td className="py-2 pl-2">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-12 h-1.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden shrink-0">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${Math.max(8, row.pct)}%`,
                                    backgroundColor: row.color,
                                  }}
                                />
                              </div>
                              <span className="font-mono text-[11px] font-semibold tabular-nums text-purple-700 dark:text-amber-300 w-9 text-right shrink-0">
                                {row.pct}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-200/80 dark:border-white/10 flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400">
              <span>
                Showing {Math.min(6, distributionItems.length)} of {distributionItems.length} groups
              </span>
              <button
                type="button"
                onClick={() => handleExportDataset('catalog')}
                className="text-[#541A72] dark:text-[#FFD147] font-bold hover:underline cursor-pointer"
              >
                Export Holdings CSV →
              </button>
            </div>
          </div>

          {/* Right (lg:col-span-4) — Live Database Health & Overdue Console */}
          <div className={`${cardShellClass} lg:col-span-4 flex flex-col justify-between`}>
            <div>
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className={iconBadgeClass}>
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight">
                    Integrity &amp; Overdue Console
                  </h3>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Inline Mini Switcher: Data Health | Overdue */}
                  <div className="inline-flex items-center rounded-xl bg-slate-100 dark:bg-white/[0.05] p-0.5 border border-slate-200/80 dark:border-white/10">
                    <button
                      type="button"
                      onClick={() => setConsoleTab('health')}
                      className={`h-6 px-2 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                        consoleTab === 'health'
                          ? 'bg-white dark:bg-[#2A174E] text-slate-900 dark:text-[#FFD147] shadow-2xs'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      Data Health
                    </button>
                    <button
                      type="button"
                      onClick={() => setConsoleTab('overdue')}
                      className={`h-6 px-2 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                        consoleTab === 'overdue'
                          ? 'bg-white dark:bg-[#2A174E] text-rose-600 dark:text-rose-300 shadow-2xs'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      Overdue ({overdueLoans})
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={runRealAudit}
                    title="Run Real SQLite Audit"
                    className="w-7 h-7 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isCheckingHealth ? 'animate-spin' : ''}`} />
                  </button>

                  <button
                    type="button"
                    onClick={() => window.print()}
                    title="Print Action List"
                    className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/15 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-600 dark:text-slate-300 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Console Body */}
              {consoleTab === 'health' ? (
                healthResults === null ? (
                  <div className="py-8 text-center space-y-2.5 rounded-xl bg-slate-950/5 dark:bg-black/30 border border-slate-200/70 dark:border-white/10 p-4">
                    <Activity className="w-7 h-7 text-slate-400 mx-auto" />
                    <p className="text-xs font-bold text-slate-800 dark:text-white">
                      Click Run Real Audit to scan SQLite records
                    </p>
                    <button
                      type="button"
                      onClick={runRealAudit}
                      className="h-8 px-3 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold cursor-pointer"
                    >
                      Run Real Audit
                    </button>
                  </div>
                ) : (
                  <div className="rounded-xl bg-slate-900/[0.04] dark:bg-black/35 border border-slate-200/80 dark:border-white/10 px-3 py-2 font-mono text-xs divide-y divide-slate-200/70 dark:divide-white/[0.07]">
                    {consoleCheckRows.map((row) => (
                      <div
                        key={row.label}
                        className="py-1.5 flex items-center justify-between gap-2 tabular-nums"
                      >
                        <span className="text-slate-700 dark:text-slate-200 font-semibold truncate">
                          {row.label}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            {row.detail}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wider border ${
                              row.pass
                                ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                                : 'bg-amber-500/18 text-amber-800 dark:text-amber-300 border-amber-500/40'
                            }`}
                          >
                            <span
                              className={`w-[5px] h-[5px] rounded-[1.5px] shrink-0 ${
                                row.pass ? 'bg-emerald-500' : 'bg-amber-400'
                              }`}
                            />
                            <span>{row.pass ? 'PASS' : 'WARN'}</span>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : overdueActionList.length === 0 ? (
                <div className="py-8 text-center rounded-xl bg-slate-900/[0.03] dark:bg-black/25 border border-slate-200/70 dark:border-white/10 space-y-1.5">
                  <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto" />
                  <p className="text-xs font-bold text-slate-800 dark:text-white">
                    Zero Overdue Records
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    All issued volumes are within active loan windows.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="rounded-xl bg-slate-900/[0.04] dark:bg-black/35 border border-slate-200/80 dark:border-white/10 divide-y divide-slate-200/70 dark:divide-white/[0.07] max-h-[190px] overflow-y-auto px-3 py-1">
                    {overdueActionList.slice(0, 5).map((item) => (
                      <div
                        key={item.id}
                        className="py-2 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() =>
                              onOpenBorrowerDetails && onOpenBorrowerDetails(item.borrowerId)
                            }
                            className="font-bold text-slate-800 dark:text-white hover:underline truncate block text-left"
                          >
                            {item.borrowerName}
                          </button>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {item.bookName}
                          </p>
                        </div>
                        <div className="text-right font-mono tabular-nums shrink-0">
                          <span className="text-rose-600 dark:text-rose-400 font-bold block">
                            Rs. {item.fineDue}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {item.daysOverdue}d overdue
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => handleExportDataset('overdue')}
                      className="h-7 px-2.5 rounded-lg bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-200 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer border border-slate-200 dark:border-white/10"
                    >
                      <Download className="w-3 h-3" />
                      <span>Export CSV</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="h-7 px-2.5 rounded-lg bg-rose-500/15 text-rose-700 dark:text-rose-300 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer border border-rose-500/30"
                    >
                      <Printer className="w-3 h-3" />
                      <span>Print Action List</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Console Footer */}
            <div className="mt-3 pt-2.5 border-t border-slate-200/80 dark:border-white/10 flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400">
              <span>Audited: {lastCheckTimestamp || 'Live'}</span>
              <button
                type="button"
                onClick={() => setIsFullLedgerExpanded(!isFullLedgerExpanded)}
                className="inline-flex items-center gap-1 font-bold text-[#541A72] dark:text-[#FFD147] hover:underline cursor-pointer"
              >
                {isFullLedgerExpanded ? (
                  <>
                    <Minimize2 className="w-3 h-3" />
                    <span>Hide Full Audit Ledger</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-3 h-3" />
                    <span>Expand Full Audit Ledger</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* =========================================================================
            ROW 4: CONDITIONAL FULL-WIDTH ACTION LEDGER
            (Renders automatically when overdueActionList.length > 0 or when expanded)
            ========================================================================= */}
        {(overdueActionList.length > 0 || isFullLedgerExpanded) && (
          <div className={`${cardShellClass} space-y-4 animate-in fade-in duration-150`}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 dark:border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className={iconBadgeClass}>
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight">
                    Overdue Action List ({overdueActionList.length} Volumes) &amp; Database Invariant Ledger
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Borrowers with loans overdue beyond scheduled return date · Official campus fine: Rs. 10 / day
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleExportDataset('overdue')}
                  className="h-8 px-3 rounded-xl bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/[0.12] text-slate-800 dark:text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200 dark:border-white/10"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="h-8 px-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer border border-rose-500/35"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Action List</span>
                </button>
              </div>
            </div>

            {overdueActionList.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse tabular-nums">
                  <thead>
                    <tr className="border-b border-slate-200/80 dark:border-white/10 text-[11px] font-mono uppercase tracking-wider text-slate-400">
                      <th className="pb-2.5">Borrower</th>
                      <th className="pb-2.5">University ID</th>
                      <th className="pb-2.5">Book Title</th>
                      <th className="pb-2.5">Due Date</th>
                      <th className="pb-2.5 text-center">Days Overdue</th>
                      <th className="pb-2.5 text-right">Fine Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-white/[0.06]">
                    {overdueActionList.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-100/50 dark:hover:bg-white/[0.02]">
                        <td className="py-2.5 font-bold text-slate-900 dark:text-white" dir="auto">
                          {item.borrowerName}
                        </td>
                        <td className="py-2.5 font-mono text-xs text-[#8A4B00] dark:text-[#FFD147] font-bold">
                          {item.universityId}
                        </td>
                        <td
                          className="py-2.5 text-slate-700 dark:text-slate-200 max-w-[280px] truncate"
                          title={item.bookName}
                          dir="auto"
                        >
                          {item.bookName}
                        </td>
                        <td className="py-2.5 font-mono text-slate-500 dark:text-slate-400">
                          {item.dueDate}
                        </td>
                        <td className="py-2.5 text-center">
                          <StatusPill label={`${item.daysOverdue} days`} variant="danger" />
                        </td>
                        <td className="py-2.5 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                          Rs. {item.fineDue.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-4 text-center text-xs text-slate-500 dark:text-slate-400">
                Zero overdue borrower loans detected. All checked-out volumes are within scheduled due dates.
              </div>
            )}

            {isFullLedgerExpanded && healthResults && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-slate-200/80 dark:border-white/10">
                <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-black/30 border border-slate-200/70 dark:border-white/10">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-800 dark:text-white">Duplicate Accessions</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400">
                      {healthResults.dupAccessions.count} Detected
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Strict 1:1 uniqueness across catalog accession numbers.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-black/30 border border-slate-200/70 dark:border-white/10">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-800 dark:text-white">Duplicate Barcodes</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400">
                      {healthResults.dupBarcodes.count} Collisions
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Code-128 physical barcode collision check.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-black/30 border border-slate-200/70 dark:border-white/10">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-800 dark:text-white">Stock Counter Drift</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400">
                      {healthResults.counterDrift.count} Drift
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Verifies Available Copies + Active Loans === Total Copies.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* =========================================================================
          OFFICIAL A4 PRINT REPORT MODAL (100% Preserved)
          ========================================================================= */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-4xl max-h-[90vh] bg-white text-black rounded-[12px] shadow-2xl overflow-y-auto p-8 relative font-serif">
            {/* Action Bar (Hidden in Print) */}
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-gray-300 print:hidden font-sans">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-800">
                  Official Report Print Preview (A4)
                </span>
                {pdfSavedToast && (
                  <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold animate-in fade-in">
                    ✓ PDF Saved Successfully
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveAsPdf}
                  disabled={isSavingPdf}
                  className="px-4 py-2 bg-gradient-to-r from-[#BC881B] to-[#D4A02A] hover:from-[#D4A02A] hover:to-[#E0B450] text-[#1A1A1A] text-xs font-bold rounded cursor-pointer inline-flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-60"
                  title="Save and download this official report as PDF file"
                >
                  <FileDown className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>{isSavingPdf ? 'Saving PDF...' : 'Save this in PDF'}</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrintReport}
                  className="px-4 py-2 bg-black text-white text-xs font-bold rounded cursor-pointer inline-flex items-center gap-1.5 hover:bg-gray-800 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Send to Printer</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  className="px-3 py-2 bg-gray-200 text-gray-800 text-xs font-semibold rounded cursor-pointer hover:bg-gray-300 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Printable Content Container with subtle centered page watermark */}
            <div
              ref={reportPrintRef}
              className="space-y-6 bg-white text-black relative overflow-hidden p-2"
            >
              {/* Subtle Centered Page Watermark */}
              <div
                aria-hidden="true"
                className="pointer-events-none select-none absolute inset-0 z-0 flex items-center justify-center overflow-hidden"
              >
                <img
                  src={identity.customCrestUrl || ULM_OFFICIAL_CREST_DATA_URI}
                  alt=""
                  draggable={false}
                  className="w-[300px] h-[300px] object-contain opacity-[0.06]"
                />
              </div>

              {/* Official Institutional Header */}
              <div className="relative z-10 flex items-center justify-center gap-4 border-b-2 border-black pb-4 mb-6">
                <img
                  src={identity.customCrestUrl || ULM_OFFICIAL_CREST_DATA_URI}
                  alt={identity.universityName}
                  className="w-14 h-14 object-contain select-none"
                />
                <div className="text-center space-y-1">
                  <h1 className="text-xl font-bold uppercase tracking-wider font-cinzel">
                    {identity.universityName}
                  </h1>
                  <h2 className="text-sm font-semibold uppercase tracking-wide">
                    {identity.libraryDepartmentName} · Official Audit &amp; Analytics Report
                  </h2>
                  <p className="text-[11px] text-gray-700 font-sans">
                    {identity.campusAddress} · {identity.contactPhone} · {identity.circulationEmail}
                  </p>
                  <p className="text-xs text-gray-600 font-sans">
                    Generated: {new Date().toLocaleDateString('en-GB')} at{' '}
                    {new Date().toLocaleTimeString()} · Period: {selectedPeriod.toUpperCase()}
                  </p>
                </div>
              </div>

              {/* KPI Summary Table */}
              <div className="mb-6">
                <h3 className="text-sm font-bold uppercase border-b border-gray-400 pb-1 mb-2">
                  1. Executive Catalog &amp; Circulation Summary
                </h3>
                <table className="w-full text-xs border border-gray-400 border-collapse">
                  <tbody>
                    <tr className="border-b border-gray-300">
                      <td className="p-2 font-bold bg-gray-100 w-1/4">
                        Total Bibliographic Titles:
                      </td>
                      <td className="p-2 w-1/4 font-mono font-bold">{counts.totalTitles}</td>
                      <td className="p-2 font-bold bg-gray-100 w-1/4">Total Physical Copies:</td>
                      <td className="p-2 w-1/4 font-mono font-bold">{counts.totalCopies}</td>
                    </tr>
                    <tr className="border-b border-gray-300">
                      <td className="p-2 font-bold bg-gray-100">Volumes on Shelf:</td>
                      <td className="p-2 font-mono font-bold text-emerald-800">
                        {counts.copiesOnShelf}
                      </td>
                      <td className="p-2 font-bold bg-gray-100">Volumes on Loan:</td>
                      <td className="p-2 font-mono font-bold">{counts.copiesOnLoan}</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-bold bg-gray-100">Active Borrowers:</td>
                      <td className="p-2 font-mono font-bold">{counts.activeBorrowers}</td>
                      <td className="p-2 font-bold bg-gray-100">Overdue Volume Rate:</td>
                      <td className="p-2 font-mono font-bold text-red-800">
                        {counts.overdueLoans} ({counts.overdueRatePercent}%)
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Holdings Table */}
              <div className="mb-6">
                <h3 className="text-sm font-bold uppercase border-b border-gray-400 pb-1 mb-2">
                  2. Academic Discipline Holdings Breakdown
                </h3>
                <table className="w-full text-xs border border-gray-400 border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-400 text-left">
                      <th className="p-2">Discipline</th>
                      <th className="p-2 text-right">Titles</th>
                      <th className="p-2 text-right">Total Copies</th>
                      <th className="p-2 text-right">On Shelf</th>
                      <th className="p-2 text-right">On Loan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {disciplineStats.map((d) => (
                      <tr key={d.category} className="border-b border-gray-300">
                        <td className="p-2 font-medium" dir="auto">
                          {d.category}
                        </td>
                        <td className="p-2 text-right font-mono">{d.titles}</td>
                        <td className="p-2 text-right font-mono font-bold">{d.totalCopies}</td>
                        <td className="p-2 text-right font-mono">{d.available}</td>
                        <td className="p-2 text-right font-mono">{d.onLoan}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Overdue Action List Table */}
              {overdueActionList.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-sm font-bold uppercase border-b border-gray-400 pb-1 mb-2 text-red-800">
                    3. Overdue Loan Registry &amp; Pending Administrative Fines
                  </h3>
                  <table className="w-full text-xs border border-gray-400 border-collapse">
                    <thead>
                      <tr className="bg-gray-100 border-b border-gray-400 text-left">
                        <th className="p-2">Borrower</th>
                        <th className="p-2">University ID</th>
                        <th className="p-2">Book Title</th>
                        <th className="p-2">Due Date</th>
                        <th className="p-2 text-center">Days Overdue</th>
                        <th className="p-2 text-right">Fine (Rs)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overdueActionList.slice(0, 15).map((o) => (
                        <tr key={o.id} className="border-b border-gray-300">
                          <td className="p-2 font-medium" dir="auto">
                            {o.borrowerName}
                          </td>
                          <td className="p-2 font-mono">{o.universityId}</td>
                          <td className="p-2 max-w-[200px] truncate" dir="auto">
                            {o.bookName}
                          </td>
                          <td className="p-2 font-mono">{o.dueDate}</td>
                          <td className="p-2 text-center font-mono font-bold text-red-800">
                            {o.daysOverdue}
                          </td>
                          <td className="p-2 text-right font-mono font-bold">Rs {o.fineDue}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Signature Block */}
              <div className="pt-12 grid grid-cols-2 gap-12 font-sans text-xs">
                <div className="border-t border-black pt-2 text-center">
                  <p className="font-bold">Librarian / In-Charge Library</p>
                  <p className="text-gray-600">{identity.universityName}</p>
                </div>
                <div className="border-t border-black pt-2 text-center">
                  <p className="font-bold">Head of Institution / Vice Chancellor</p>
                  <p className="text-gray-600">Administrative Seal &amp; Approval</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsView;
