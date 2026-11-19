import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  FileSpreadsheet, 
  Download, 
  Upload, 
  CheckCircle2, 
  AlertTriangle, 
  Database,
  ArrowDownToLine,
  HardDrive,
  RefreshCw,
  FileCheck,
  Layers,
  Users,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  Check,
  Loader2,
  ChevronDown,
  ChevronRight,
  FileText,
  Clock,
  Laptop,
  Sparkles,
  Trash2,
  X
} from 'lucide-react';
import { Book, Borrower, Transaction, HistoryEntry } from '../types/library';
import { LibraryStorage } from '../services/storage';
import { ImporterEngine } from '../services/importerEngine';
import { LibraryDataFilesService } from '../services/libraryDataFilesService';
import { UsbBackupService } from '../services/usbBackupService';
import { SharedCsvWriter } from '../utils/csvWriter';
import { generateAndInsert25000TestBooks } from '../services/excel';
import { getTrueDatabaseBookCount } from '../services/libraryStorageAndMigration';
import {
  startHeavyTask,
  updateHeavyTaskProgress,
  finishHeavyTask,
  runHeavyLibraryTask,
} from '../utils/heavyTaskRunner';
import { PageHeaderCard } from './shared/PageHeaderCard';
import { TabCards, TabCardItem } from './shared/TabCards';
import { PanelCard } from './shared/SharedCards';
import { StatusPill } from './shared/StatusPill';

export type MigrationTabId = 'import' | 'move' | 'export';

interface ExcelCenterProps {
  books: Book[];
  borrowers: Borrower[];
  transactions: Transaction[];
  history: HistoryEntry[];
  onRefreshData: () => void;
  onOpenImportEntrySheet?: () => void;
  onOpenTransferZipModal?: () => void;
}

export const ExcelCenterView: React.FC<ExcelCenterProps> = ({
  books,
  borrowers,
  transactions,
  history,
  onRefreshData,
  onOpenImportEntrySheet,
  onOpenTransferZipModal,
}) => {
  const [activeTab, setActiveTab] = useState<MigrationTabId>('import');
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [migrationStats, setMigrationStats] = useState<{ books: number; borrowers: number; transactions: number } | null>(null);
  const [csvText, setCsvText] = useState('');
  const [importMode, setImportMode] = useState<'merge' | 'overwrite'>('merge');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccessMorph, setIsSuccessMorph] = useState(false);

  // Collapsed sections in Tab 2
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [isDevToolsOpen, setIsDevToolsOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const todayStr = new Date().toISOString().split('T')[0];

  // High-Scale +25,000 Test Books & Sync State
  const [isGeneratingTestBooks, setIsGeneratingTestBooks] = useState(false);
  const [testBooksProgress, setTestBooksProgress] = useState<{ inserted: number; total: number; percent: number } | null>(null);
  const [showResetZeroModal, setShowResetZeroModal] = useState(false);

  useEffect(() => {
    if (!showResetZeroModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isProcessing) setShowResetZeroModal(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showResetZeroModal, isProcessing]);

  const handleGenerate25000TestBooks = async () => {
    if (isGeneratingTestBooks) return;
    setIsGeneratingTestBooks(true);
    setImportStatus(null);
    setImportError(null);
    await startHeavyTask(
      'Generating +25,000 Library Volumes',
      'Allocating continuous Accession & 13-digit Barcode series in 500-record chunks...',
      25000
    );
    try {
      try {
        localStorage.removeItem('ulm_database_cleared');
      } catch (_) {}
      const res = await generateAndInsert25000TestBooks((prog) => {
        setTestBooksProgress(prog);
        updateHeavyTaskProgress(
          prog.inserted,
          prog.total,
          `Bulk inserting 25,000 books in 500-record chunks... ${prog.inserted.toLocaleString()} / 25,000 (${prog.percent}%)`
        );
        setImportStatus(`Bulk inserting 25,000 books in 500-record chunks... ${prog.inserted.toLocaleString()} / 25,000 (${prog.percent}%)`);
      });
      if (res.success) {
        setImportStatus(`Successfully added +25,000 volumes! Database total is now ${res.newTotal.toLocaleString()} books.`);
        setIsSuccessMorph(true);
        setTimeout(() => setIsSuccessMorph(false), 1500);
        onRefreshData();
      }
    } catch (e: any) {
      setImportError(`Failed to insert test books: ${e.message}`);
    } finally {
      finishHeavyTask();
      setIsGeneratingTestBooks(false);
      setTestBooksProgress(null);
    }
  };

  const handleRecountDbBooks = async () => {
    try {
      const count = await getTrueDatabaseBookCount();
      onRefreshData();
      setImportStatus(`Database sync verified: Total verified active books across SQLite / IndexedDB = ${count.toLocaleString()}.`);
      setIsSuccessMorph(true);
      setTimeout(() => setIsSuccessMorph(false), 1200);
    } catch (e: any) {
      setImportError(`Recount failed: ${e.message}`);
    }
  };

  const handleResetAllBooksToZero = () => {
    setShowResetZeroModal(true);
  };

  const executeResetAllBooksToZero = async () => {
    setShowResetZeroModal(false);
    setIsProcessing(true);
    setImportStatus(null);
    setImportError(null);
    try {
      try {
        localStorage.setItem('ulm_database_cleared', 'true');
        localStorage.removeItem('ulm_books');
        localStorage.removeItem('ulm_lms_books');
        localStorage.removeItem('books');
        localStorage.removeItem('ulm_library_books');
        localStorage.removeItem('library_books');
        localStorage.removeItem('ulm_first_open_thumbnail_boot_cache_v1');
        localStorage.removeItem('ulm_sqlite_migration_verified_v1');
      } catch (_) {}
      await LibraryStorage.clearAllDatabaseStores();
      LibraryStorage.saveBooks([]);
      onRefreshData();
      setImportStatus('Library completely wiped to 0 books. Database reset to zero.');
      setIsSuccessMorph(true);
      setTimeout(() => setIsSuccessMorph(false), 1500);
    } catch (e: any) {
      setImportError(`Reset failed: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // TAB 1: Blank Entry Sheet
  const handleDownloadBlankEntrySheet = async () => {
    try {
      const blob = await ImporterEngine.generateBlankEntrySheet();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ULM_Book_Entry_Sheet.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setImportError(`Failed to generate entry sheet: ${e.message}`);
    }
  };

  // TAB 3: Comprehensive LibraryData.xlsx
  const handleDownloadLibraryData = async () => {
    try {
      await LibraryDataFilesService.downloadLibraryDataXlsx();
      setImportStatus('Generated and downloaded comprehensive LibraryData.xlsx workbook.');
    } catch (e: any) {
      setImportError(`Failed to download LibraryData.xlsx: ${e.message}`);
    }
  };

  // TAB 2: Transfer ZIP
  const handleExportZipArchive = async () => {
    setIsProcessing(true);
    await startHeavyTask(
      'Packaging Workstation Transfer ZIP',
      'Bundling catalog, borrowers, active loans, and Almari placements...',
      100
    );
    try {
      const res = await UsbBackupService.exportToUsb((pct, stage) => {
        updateHeavyTaskProgress(pct, 100, `Creating ZIP Transfer Archive (${pct}%): ${stage}`);
        setImportStatus(`Creating ZIP Transfer Archive (${pct}%): ${stage}`);
      });
      if (res.success) {
        setImportStatus(`ZIP Transfer Archive saved successfully (${res.filename}).`);
        setIsSuccessMorph(true);
        setTimeout(() => setIsSuccessMorph(false), 1200);
      } else {
        setImportError(res.message);
      }
    } catch (e: any) {
      setImportError(`ZIP transfer export failed: ${e.message}`);
    } finally {
      finishHeavyTask();
      setIsProcessing(false);
    }
  };

  // TAB 2: Master PC-to-PC Migration Exports
  const handleExportMasterCsv = () => {
    LibraryStorage.exportMasterMigrationCsv();
    setImportStatus('Generated Master Migration CSV package. Transfer this file to your other PC via USB or network.');
  };

  const handleExportMasterJson = () => {
    LibraryStorage.exportMasterMigrationJson();
    setImportStatus('Generated complete SQLite JSON database clone. Transfer this file to your other PC for setup.');
  };

  // TAB 3: Dedicated Departmental Sheet Exports using SharedCsvWriter
  const handleExportBooks = () => {
    const data = books.filter(b => b.is_active).map(b => ({
      Barcode: b.barcode,
      AccessionNo: b.accession_no || '',
      ISBN: b.isbn,
      BookTitle: b.book_name,
      Author: b.author,
      Category: b.category,
      Language: b.language || 'English',
      TitleRoman: b.title_roman || '',
      AuthorRoman: b.author_roman || '',
      Publisher: b.publisher,
      TotalCopies: b.total_quantity,
      AvailableCopies: b.available_quantity,
      IssuedCopies: Math.max(0, b.total_quantity - b.available_quantity),
      Shelf: b.shelf,
      Row: b.row,
      CallNumber: b.dewey_call_number,
      DateAdded: b.date_added || (b.created_at ? b.created_at.split(' ')[0] : todayStr),
    }));
    SharedCsvWriter.downloadCsv(data, `ULM_Books_Catalog_${todayStr}.csv`);
  };

  const handleExportBorrowers = () => {
    const data = borrowers.filter(b => b.is_active).map(b => ({
      UniversityID: b.university_id || b.student_id,
      FullName: b.name,
      Role: b.role,
      Department: b.department,
      Program: b.program || '',
      Phone: b.phone,
      Email: b.email,
      Status: b.status,
    }));
    SharedCsvWriter.downloadCsv(data, `ULM_Borrowers_Register_${todayStr}.csv`);
  };

  const handleExportTransactions = () => {
    const data = transactions.map(t => ({
      TransactionID: t.id,
      Barcode: t.barcode,
      BookTitle: t.book_name,
      BorrowerName: t.borrower_name,
      UniversityID: t.student_id,
      Action: t.action,
      IssueDate: t.issue_date,
      DueDate: t.due_date,
      ReturnDate: t.return_date || 'N/A',
      Status: t.status,
    }));
    SharedCsvWriter.downloadCsv(data, `ULM_Circulation_Ledger_${todayStr}.csv`);
  };

  const handleExportHistory = () => {
    const data = history.map(h => ({
      ID: h.id,
      Action: h.action,
      Description: h.description,
      Barcode: h.barcode,
      User: h.user,
      Timestamp: h.created_at,
    }));
    SharedCsvWriter.downloadCsv(data, `ULM_Audit_Log_${todayStr}.csv`);
  };

  // Master Ingestion from uploaded file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputEl = e.target;
    const file = inputEl.files?.[0];
    if (!file) {
      inputEl.value = '';
      return;
    }

    setIsProcessing(true);
    setImportStatus(null);
    setImportError(null);

    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          if (!content || !content.trim()) {
            setImportError('File is empty or could not be read. Live database was not modified.');
            setIsProcessing(false);
            return;
          }
          setCsvText(content);
          executeMigration(content);
        } catch (parseErr: any) {
          setImportError(`Malformed migration file: ${parseErr?.message || 'Unable to parse file'}. Live database was not modified.`);
          setIsProcessing(false);
        }
      };
      reader.onerror = () => {
        setImportError('Failed to read migration file. Live database was not modified.');
        setIsProcessing(false);
      };
      reader.readAsText(file);
    } catch (err: any) {
      setImportError(`File upload error: ${err?.message || 'Unknown error'}`);
      setIsProcessing(false);
    } finally {
      inputEl.value = '';
    }
  };

  // Ingestion Execution
  const executeMigration = (rawText: string) => {
    setIsProcessing(true);
    setImportStatus(null);
    setImportError(null);

    void runHeavyLibraryTask(
      'Restoring Master Migration Package',
      'Validating & reconciling books, borrowers, and circulation records...',
      async () => {
        try {
          const res = LibraryStorage.importMasterMigrationFile(rawText, importMode);
          if (res.success) {
            setImportStatus(res.message);
            setMigrationStats(res.stats);
            setIsSuccessMorph(true);
            setTimeout(() => setIsSuccessMorph(false), 1200);
            onRefreshData();
          } else {
            setImportError(res.message);
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          setImportError(`Migration process failed: ${msg}`);
        } finally {
          setIsProcessing(false);
        }
      }
    );
  };

  const loadSampleMigrationFile = () => {
    const sample = `# ====================================================================
# UNIVERSITY OF LAKKI MARWAT - LIBRARY MANAGEMENT SYSTEM (LMS)
# MASTER PC-TO-PC DATA MIGRATION PACKAGE (SAMPLE TEST FILE)
# ====================================================================

# === SECTION: SETTINGS ===
StationID,LibraryName,UniversityName,CampusAddress,Phone,Email,ScannerSound,ErrorSound,WalMode
"LMS-WIN-02","Central Campus Library","University of Lakki Marwat","Lakki Marwat, KPK","+92-969-510015","library@ulm.edu.pk",true,true,true

# === SECTION: BOOKS ===
Barcode,ISBN,BookTitle,Author,Category,TotalCopies,AvailableCopies,Shelf,Row,DeweyCallNumber,Publisher,Edition,Year,Language,IsActive
"9780262033848","978-0262033848","Introduction to Algorithms","Thomas H. Cormen","Computer Science",8,7,"CS-Rack-05","2","518.1 COR","MIT Press","4th Edition",2022,"English",1
"9789694151014","978-9694151014","بانگِ درا","علامہ محمد اقبال","Urdu Literature",6,5,"URDU-Rack-01","1","891.4391 IQB","اقبال اکادمی پاکستان","1st Edition",2021,"Urdu",1
"9780134685991","978-0134685991","Effective Java","Joshua Bloch","Computer Science",5,5,"CS-Rack-06","1","005.133 BLO","Addison-Wesley","3rd Edition",2018,"English",1
"9780199535569","978-0199535569","Principles of Islamic Jurisprudence","Mohammad Hashim Kamali","Islamic Studies",7,6,"IS-Rack-01","1","297.14 KAM","Islamic Texts","3rd Edition",2021,"English",1

# === SECTION: BORROWERS ===
StudentID,FullName,Department,Program,ClassName,Phone,Email,IsActive
"ULM-2023-CS-0101","Muhammad Tariq Khan","Computer Science","BS Computer Science","BS-CS-7A","0345-9876543","tariq.khan@ulm.edu.pk",1
"ULM-2023-ENG-0202","Ayesha Bibi","Electrical Engineering","BS Electrical","BSEE-5B","0333-1234567","ayesha.bibi@ulm.edu.pk",1
"ULM-2022-ISL-0303","Hafiz Bilal Ahmad","Islamic Studies","MPhil Islamic Studies","MPHIL-1","0300-5551234","bilal.ahmad@ulm.edu.pk",1

# === SECTION: TRANSACTIONS ===
TransactionID,Barcode,BookTitle,BorrowerName,StudentID,Action,IssueDate,DueDate,ReturnDate,Quantity,Status
"tx-sample-001","9780262033848","Introduction to Algorithms","Muhammad Tariq Khan","ULM-2023-CS-0101","ISSUE","${todayStr}","2026-10-10","N/A",1,"ACTIVE"`;
    setCsvText(sample);
  };

  const tabs: TabCardItem<MigrationTabId>[] = [
    { id: 'import', label: 'Import Books', icon: FileSpreadsheet },
    { id: 'move', label: 'Move to Another PC', icon: Laptop },
    { id: 'export', label: 'Export Spreadsheets', icon: Download },
  ];

  return (
    <div className="w-full h-auto min-h-0 flex flex-col gap-4 px-4 sm:px-6 lg:px-8 pt-4 pb-12 overflow-visible">
      <div className="max-w-[1920px] w-full mx-auto space-y-4">

        {/* =========================================================================
            1. TOP HEADER BANNER (rounded-[26px] Frosted Crystal Shell)
            ========================================================================= */}
        <div className="ulm-preserve-glass rounded-[26px] px-6 py-4 bg-gradient-to-br from-white/80 via-white/65 to-white/50 dark:from-white/[0.08] dark:via-[#18102B]/60 dark:to-[#120B22]/45 backdrop-blur-2xl backdrop-saturate-[180%] border border-slate-200/85 dark:border-white/[0.15] shadow-[inset_1.5px_1.5px_2px_rgba(255,255,255,0.85),0_12px_32px_rgba(15,23,42,0.06)] dark:shadow-[inset_1.5px_1.5px_2px_rgba(255,255,255,0.22),0_12px_32px_rgba(0,0,0,0.28)] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5 text-amber-600 dark:text-amber-300" />
            </div>
            <div className="min-w-0">
              <h2 className="font-['Plus_Jakarta_Sans'] text-[18px] font-bold tracking-tight text-slate-900 dark:text-white truncate">
                Excel &amp; PC Migration
              </h2>
              <p className="text-[12px] text-slate-500 dark:text-slate-300/80 truncate">
                Import books, move the library to another PC, and export spreadsheets.
              </p>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/70 dark:bg-white/[0.05] border border-slate-200/80 dark:border-white/[0.12] font-['JetBrains_Mono'] text-[11px] font-semibold text-slate-700 dark:text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Unified Migration &amp; Export Console</span>
          </div>
        </div>

        {/* Status / Error Banner */}
        {importStatus && (
          <div className="p-4 rounded-[18px] bg-emerald-500/12 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs space-y-2 animate-in fade-in">
            <div className="flex items-center gap-2 font-bold text-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{importStatus}</span>
            </div>
            {migrationStats && (
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-emerald-500/20 text-center font-mono">
                <div className="p-2 rounded-xl bg-white/70 dark:bg-emerald-950/40 border border-emerald-500/20">
                  <span className="block text-[10px] text-emerald-700 dark:text-emerald-400">Books Loaded</span>
                  <span className="text-base font-bold text-slate-900 dark:text-white">{migrationStats.books}</span>
                </div>
                <div className="p-2 rounded-xl bg-white/70 dark:bg-emerald-950/40 border border-emerald-500/20">
                  <span className="block text-[10px] text-emerald-700 dark:text-emerald-400">Members Loaded</span>
                  <span className="text-base font-bold text-slate-900 dark:text-white">{migrationStats.borrowers}</span>
                </div>
                <div className="p-2 rounded-xl bg-white/70 dark:bg-emerald-950/40 border border-emerald-500/20">
                  <span className="block text-[10px] text-emerald-700 dark:text-emerald-400">Loans Restored</span>
                  <span className="text-base font-bold text-slate-900 dark:text-white">{migrationStats.transactions}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {importError && (
          <div className="p-3.5 rounded-[18px] bg-rose-500/12 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2.5 animate-in fade-in">
            <AlertTriangle className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0" />
            <span className="font-medium">{importError}</span>
          </div>
        )}

        {/* =========================================================================
            2. ROW 1 (MERGED JSX): 2-COLUMN BENTO SPLIT (Book Entry Sheet Import + Move to Another PC)
            ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          {/* Left Card (lg:col-span-5): Book Entry Sheet Import */}
          <div className="ulm-preserve-glass lg:col-span-5 h-full rounded-[22px] p-5 bg-gradient-to-br from-white/80 via-white/65 to-white/50 dark:from-white/[0.075] dark:via-white/[0.03] dark:to-white/[0.015] backdrop-blur-xl backdrop-saturate-[180%] border border-slate-200/85 dark:border-white/[0.14] shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.85),0_8px_24px_rgba(15,23,42,0.05)] dark:shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.22),0_8px_24px_rgba(0,0,0,0.22)] flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 font-['JetBrains_Mono'] text-[10px] font-semibold uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-[1.5px] bg-amber-400 shrink-0" />
                  <span>ENTRY SHEET</span>
                </span>
                <h3 className="text-[14px] font-bold text-slate-900 dark:text-white font-['Plus_Jakarta_Sans']">
                  Book Entry Sheet Import
                </h3>
              </div>

              <p className="text-[12px] leading-relaxed text-slate-600 dark:text-slate-300/85 my-3">
                The official <strong>ULM_Master_Books_Register.xlsx</strong> spreadsheet supports universal unlimited rows for entering library acquisitions with dropdown validations.
                Physical barcodes and sequential accession series are assigned automatically upon import.
              </p>
            </div>

            {/* Buttons: Import Book Entry Sheet (.xlsx) and Blank Entry Sheet (.xlsx) */}
            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              {onOpenImportEntrySheet ? (
                <button
                  type="button"
                  onClick={onOpenImportEntrySheet}
                  className="h-10 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-semibold text-[12px] inline-flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <Upload className="w-4 h-4 stroke-[2.5]" />
                  <span>Import Book Entry Sheet (.xlsx)</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-10 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-semibold text-[12px] inline-flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <Upload className="w-4 h-4 stroke-[2.5]" />
                  <span>Import Book Entry Sheet (.xlsx)</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleDownloadBlankEntrySheet}
                className="h-10 px-4 rounded-xl bg-gradient-to-r from-[#581C87] to-[#6B21A8] hover:from-[#6B21A8] hover:to-[#7E22CE] text-white border border-purple-400/30 font-semibold text-[12px] inline-flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <Download className="w-4 h-4 text-purple-200" />
                <span>Blank Entry Sheet (.xlsx)</span>
              </button>
            </div>
          </div>

          {/* Right Card (lg:col-span-7): Move to Another PC 3-Step Pipeline */}
          <div className="ulm-preserve-glass lg:col-span-7 h-full rounded-[22px] p-5 bg-gradient-to-br from-white/80 via-white/65 to-white/50 dark:from-white/[0.075] dark:via-white/[0.03] dark:to-white/[0.015] backdrop-blur-xl backdrop-saturate-[180%] border border-slate-200/85 dark:border-white/[0.14] shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.85),0_8px_24px_rgba(15,23,42,0.05)] dark:shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.22),0_8px_24px_rgba(0,0,0,0.22)] flex flex-col justify-between space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-purple-500/12 border border-purple-500/30 text-purple-700 dark:text-purple-300 font-['JetBrains_Mono'] text-[10px] font-semibold uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-[1.5px] bg-purple-400 shrink-0" />
                  <span>WORKSTATION TRANSFER</span>
                </span>
                <h3 className="text-[14px] font-bold text-slate-900 dark:text-white font-['Plus_Jakarta_Sans']">
                  Move to Another PC
                </h3>
              </div>
              <span className="font-['JetBrains_Mono'] text-[10.5px] text-slate-500 dark:text-slate-400">
                3-Step Offline ZIP Pipeline
              </span>
            </div>

            {/* 3-Column Step Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-1">
              {/* Step 1 */}
              <div className="rounded-2xl p-3.5 bg-white/60 dark:bg-white/[0.035] border border-slate-200/80 dark:border-white/[0.10] flex flex-col justify-between space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/35 text-amber-700 dark:text-amber-300 font-mono font-bold text-[11px] flex items-center justify-center shrink-0">
                      1
                    </div>
                    <h4 className="text-[11.5px] font-bold text-slate-900 dark:text-white uppercase tracking-wider font-['Plus_Jakarta_Sans']">
                      Step 1: Export from this PC
                    </h4>
                  </div>
                  <p className="text-[11.5px] text-slate-600 dark:text-slate-300/85 leading-relaxed">
                    Packages all local library records, active borrower accounts, book barcodes, and SQLite database tables into a single Transfer ZIP archive.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleExportZipArchive}
                  disabled={isProcessing}
                  className="w-full h-9 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-semibold text-[11.5px] shadow-sm transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Export Transfer ZIP</span>
                </button>
              </div>

              {/* Step 2 */}
              <div className="rounded-2xl p-3.5 bg-white/60 dark:bg-white/[0.035] border border-slate-200/80 dark:border-white/[0.10] flex flex-col justify-between space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-sky-500/15 border border-sky-500/35 text-sky-700 dark:text-sky-300 font-mono font-bold text-[11px] flex items-center justify-center shrink-0">
                      2
                    </div>
                    <h4 className="text-[11.5px] font-bold text-slate-900 dark:text-white uppercase tracking-wider font-['Plus_Jakarta_Sans']">
                      Step 2: Install app on new PC
                    </h4>
                  </div>
                  <p className="text-[11.5px] text-slate-600 dark:text-slate-300/85 leading-relaxed">
                    Copy the Transfer ZIP to a USB flash drive. Launch the LMS application on the destination computer and open this Migration screen.
                  </p>
                </div>

                <div className="h-9 px-2.5 rounded-xl bg-slate-100/80 dark:bg-white/[0.04] text-[10.5px] font-mono text-slate-700 dark:text-slate-300 flex items-center justify-center border border-slate-200/80 dark:border-white/[0.08]">
                  Ready on Destination Workstation
                </div>
              </div>

              {/* Step 3 */}
              <div className="rounded-2xl p-3.5 bg-white/60 dark:bg-white/[0.035] border border-slate-200/80 dark:border-white/[0.10] flex flex-col justify-between space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-purple-500/15 border border-purple-500/35 text-purple-700 dark:text-purple-300 font-mono font-bold text-[11px] flex items-center justify-center shrink-0">
                      3
                    </div>
                    <h4 className="text-[11.5px] font-bold text-slate-900 dark:text-white uppercase tracking-wider font-['Plus_Jakarta_Sans']">
                      Step 3: Restore on new PC
                    </h4>
                  </div>
                  <p className="text-[11.5px] text-slate-600 dark:text-slate-300/85 leading-relaxed">
                    Select the Transfer ZIP archive from your USB drive to restore library data, active circulation loans, and user configuration.
                  </p>
                </div>

                {onOpenTransferZipModal ? (
                  <button
                    type="button"
                    onClick={onOpenTransferZipModal}
                    className="w-full h-9 rounded-xl bg-gradient-to-r from-[#581C87] to-[#6B21A8] hover:from-[#6B21A8] hover:to-[#7E22CE] text-white border border-purple-400/30 font-semibold text-[11.5px] transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Upload className="w-3.5 h-3.5 text-purple-200" />
                    <span>Restore Transfer ZIP</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-9 rounded-xl bg-gradient-to-r from-[#581C87] to-[#6B21A8] hover:from-[#6B21A8] hover:to-[#7E22CE] text-white border border-purple-400/30 font-semibold text-[11.5px] transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Upload className="w-3.5 h-3.5 text-purple-200" />
                    <span>Restore Transfer ZIP</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            3. ROW 2 (MERGED JSX): 5-CARD SPREADSHEET EXPORTS ROW
            ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* 1. Master LibraryData.xlsx */}
          <div className="ulm-preserve-glass rounded-[22px] p-4 bg-gradient-to-br from-white/80 via-white/65 to-white/50 dark:from-white/[0.075] dark:via-white/[0.03] dark:to-white/[0.015] backdrop-blur-xl backdrop-saturate-[180%] border border-slate-200/85 dark:border-white/[0.14] shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.85),0_8px_24px_rgba(15,23,42,0.05)] dark:shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.22),0_8px_24px_rgba(0,0,0,0.22)] flex flex-col justify-between space-y-3.5 transition-all duration-200 hover:-translate-y-[1px]">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-amber-500/15 border border-amber-400/30 text-amber-600 dark:text-amber-300 shrink-0">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <span className="font-['JetBrains_Mono'] text-[10px] font-semibold px-2 py-0.5 rounded-md border bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300">
                  XLSX
                </span>
              </div>
              <h4 className="text-[14px] font-bold text-slate-900 dark:text-white leading-tight font-['Plus_Jakarta_Sans']">
                LibraryData.xlsx
              </h4>
              <p className="text-[11.5px] text-slate-600 dark:text-slate-300/85 line-clamp-2 leading-snug">
                Comprehensive multi-sheet workbook containing catalog, members, circulation, and audit logs.
              </p>
            </div>

            <button
              type="button"
              onClick={handleDownloadLibraryData}
              className="w-full h-9 rounded-xl bg-gradient-to-r from-[#581C87]/90 to-[#6B21A8]/90 hover:from-[#6B21A8] hover:to-[#7E22CE] text-white border border-purple-400/30 text-[11.5px] font-semibold inline-flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-purple-200" />
              <span>Download LibraryData.xlsx</span>
            </button>
          </div>

          {/* 2. Books & Copies CSV */}
          <div className="ulm-preserve-glass rounded-[22px] p-4 bg-gradient-to-br from-white/80 via-white/65 to-white/50 dark:from-white/[0.075] dark:via-white/[0.03] dark:to-white/[0.015] backdrop-blur-xl backdrop-saturate-[180%] border border-slate-200/85 dark:border-white/[0.14] shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.85),0_8px_24px_rgba(15,23,42,0.05)] dark:shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.22),0_8px_24px_rgba(0,0,0,0.22)] flex flex-col justify-between space-y-3.5 transition-all duration-200 hover:-translate-y-[1px]">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-sky-500/15 border border-sky-400/30 text-sky-600 dark:text-sky-300 shrink-0">
                  <BookOpen className="w-4 h-4" />
                </div>
                <span className="font-['JetBrains_Mono'] text-[10px] font-semibold px-2 py-0.5 rounded-md border bg-sky-500/10 border-sky-500/30 text-sky-700 dark:text-sky-300">
                  CSV
                </span>
              </div>
              <h4 className="text-[14px] font-bold text-slate-900 dark:text-white leading-tight font-['Plus_Jakarta_Sans']">
                Books &amp; Copies
              </h4>
              <p className="text-[11.5px] text-slate-600 dark:text-slate-300/85 line-clamp-2 leading-snug">
                Barcodes, accession numbers, Dewey call numbers, shelf locations, and availability stock.
              </p>
            </div>

            <button
              type="button"
              onClick={handleExportBooks}
              className="w-full h-9 rounded-xl bg-gradient-to-r from-[#581C87]/90 to-[#6B21A8]/90 hover:from-[#6B21A8] hover:to-[#7E22CE] text-white border border-purple-400/30 text-[11.5px] font-semibold inline-flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-purple-200" />
              <span>Download Books CSV</span>
            </button>
          </div>

          {/* 3. Campus Members CSV */}
          <div className="ulm-preserve-glass rounded-[22px] p-4 bg-gradient-to-br from-white/80 via-white/65 to-white/50 dark:from-white/[0.075] dark:via-white/[0.03] dark:to-white/[0.015] backdrop-blur-xl backdrop-saturate-[180%] border border-slate-200/85 dark:border-white/[0.14] shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.85),0_8px_24px_rgba(15,23,42,0.05)] dark:shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.22),0_8px_24px_rgba(0,0,0,0.22)] flex flex-col justify-between space-y-3.5 transition-all duration-200 hover:-translate-y-[1px]">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-purple-500/15 border border-purple-400/30 text-purple-600 dark:text-purple-300 shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <span className="font-['JetBrains_Mono'] text-[10px] font-semibold px-2 py-0.5 rounded-md border bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-300">
                  CSV
                </span>
              </div>
              <h4 className="text-[14px] font-bold text-slate-900 dark:text-white leading-tight font-['Plus_Jakarta_Sans']">
                Campus Members
              </h4>
              <p className="text-[11.5px] text-slate-600 dark:text-slate-300/85 line-clamp-2 leading-snug">
                Student IDs, department affiliations, academic degree programs, and contact profiles.
              </p>
            </div>

            <button
              type="button"
              onClick={handleExportBorrowers}
              className="w-full h-9 rounded-xl bg-gradient-to-r from-[#581C87]/90 to-[#6B21A8]/90 hover:from-[#6B21A8] hover:to-[#7E22CE] text-white border border-purple-400/30 text-[11.5px] font-semibold inline-flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-purple-200" />
              <span>Download Members CSV</span>
            </button>
          </div>

          {/* 4. Circulation Ledger CSV */}
          <div className="ulm-preserve-glass rounded-[22px] p-4 bg-gradient-to-br from-white/80 via-white/65 to-white/50 dark:from-white/[0.075] dark:via-white/[0.03] dark:to-white/[0.015] backdrop-blur-xl backdrop-saturate-[180%] border border-slate-200/85 dark:border-white/[0.14] shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.85),0_8px_24px_rgba(15,23,42,0.05)] dark:shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.22),0_8px_24px_rgba(0,0,0,0.22)] flex flex-col justify-between space-y-3.5 transition-all duration-200 hover:-translate-y-[1px]">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-emerald-500/15 border border-emerald-400/30 text-emerald-600 dark:text-emerald-300 shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <span className="font-['JetBrains_Mono'] text-[10px] font-semibold px-2 py-0.5 rounded-md border bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300">
                  CSV
                </span>
              </div>
              <h4 className="text-[14px] font-bold text-slate-900 dark:text-white leading-tight font-['Plus_Jakarta_Sans']">
                Circulation Ledger
              </h4>
              <p className="text-[11.5px] text-slate-600 dark:text-slate-300/85 line-clamp-2 leading-snug">
                Complete loan transaction history, checkout dates, return dates, and overdue records.
              </p>
            </div>

            <button
              type="button"
              onClick={handleExportTransactions}
              className="w-full h-9 rounded-xl bg-gradient-to-r from-[#581C87]/90 to-[#6B21A8]/90 hover:from-[#6B21A8] hover:to-[#7E22CE] text-white border border-purple-400/30 text-[11.5px] font-semibold inline-flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-purple-200" />
              <span>Download Circulation CSV</span>
            </button>
          </div>

          {/* 5. System Audit Trail CSV */}
          <div className="ulm-preserve-glass rounded-[22px] p-4 bg-gradient-to-br from-white/80 via-white/65 to-white/50 dark:from-white/[0.075] dark:via-white/[0.03] dark:to-white/[0.015] backdrop-blur-xl backdrop-saturate-[180%] border border-slate-200/85 dark:border-white/[0.14] shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.85),0_8px_24px_rgba(15,23,42,0.05)] dark:shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.22),0_8px_24px_rgba(0,0,0,0.22)] flex flex-col justify-between space-y-3.5 transition-all duration-200 hover:-translate-y-[1px]">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-amber-500/15 border border-amber-400/30 text-amber-600 dark:text-amber-300 shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <span className="font-['JetBrains_Mono'] text-[10px] font-semibold px-2 py-0.5 rounded-md border bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300">
                  CSV
                </span>
              </div>
              <h4 className="text-[14px] font-bold text-slate-900 dark:text-white leading-tight font-['Plus_Jakarta_Sans']">
                System Audit Trail
              </h4>
              <p className="text-[11.5px] text-slate-600 dark:text-slate-300/85 line-clamp-2 leading-snug">
                Chronological activity ledger, staff logins, record updates, and administrative modifications.
              </p>
            </div>

            <button
              type="button"
              onClick={handleExportHistory}
              className="w-full h-9 rounded-xl bg-gradient-to-r from-[#581C87]/90 to-[#6B21A8]/90 hover:from-[#6B21A8] hover:to-[#7E22CE] text-white border border-purple-400/30 text-[11.5px] font-semibold inline-flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-purple-200" />
              <span>Download Audit Log CSV</span>
            </button>
          </div>
        </div>

        {/* =========================================================================
            4. ROW 3 (MERGED JSX): FROSTED CRYSTAL ACCORDION FOR Advanced: Master Migration files (CSV / JSON)
            ========================================================================= */}
        <div className="ulm-preserve-glass rounded-[22px] p-5 bg-gradient-to-br from-white/80 via-white/65 to-white/50 dark:from-white/[0.07] dark:via-white/[0.03] dark:to-white/[0.015] backdrop-blur-xl backdrop-saturate-[180%] border border-slate-200/85 dark:border-white/[0.14] shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.85),0_8px_24px_rgba(15,23,42,0.05)] dark:shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.22),0_8px_24px_rgba(0,0,0,0.22)] overflow-hidden">
          <button
            type="button"
            onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
            className="w-full flex items-center justify-between text-left transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              {isAdvancedOpen ? (
                <ChevronDown className="w-4 h-4 text-amber-600 dark:text-[#E0B450]" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-500 dark:text-[#B3AABD]" />
              )}
              <span className="text-[14px] font-bold text-slate-900 dark:text-white tracking-wide font-['Plus_Jakarta_Sans']">
                Advanced: Master Migration files (CSV / JSON)
              </span>
            </div>
            <span className="text-[11.5px] font-['JetBrains_Mono'] text-slate-500 dark:text-slate-300/80">
              {isAdvancedOpen ? 'Collapse' : 'Expand Options'}
            </span>
          </button>

          {isAdvancedOpen && (
            <div className="pt-4 mt-4 border-t border-slate-200/80 dark:border-white/[0.12] space-y-4 animate-in fade-in">
              {/* Master Export Buttons */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleExportMasterCsv}
                  className="h-10 px-4 rounded-xl bg-gradient-to-r from-[#581C87] to-[#6B21A8] hover:from-[#6B21A8] hover:to-[#7E22CE] text-white font-semibold text-[12px] border border-purple-400/30 transition-all inline-flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  <Download className="w-4 h-4 text-purple-200" />
                  <span>Export Master Migration Excel/CSV</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportMasterJson}
                  className="h-10 px-4 rounded-xl bg-white/80 dark:bg-white/[0.06] hover:bg-white dark:hover:bg-white/[0.12] text-slate-800 dark:text-white font-semibold text-[12px] border border-slate-200/90 dark:border-white/[0.14] transition-all inline-flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  <Database className="w-4 h-4 text-amber-600 dark:text-[#E0B450]" />
                  <span>Export System Database Clone (.JSON)</span>
                </button>
              </div>

              {/* Mode Selector Toggle: Safe Merge vs Full Clone & Overwrite */}
              <div className="p-4 rounded-2xl bg-white/60 dark:bg-white/[0.035] border border-slate-200/80 dark:border-white/[0.12] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-[13px] font-bold text-slate-900 dark:text-white font-['Plus_Jakarta_Sans']">
                      Ingest / Restore Master Package on this PC
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-300/80">
                      Select your migration package from USB or external disk.
                    </p>
                  </div>

                  {/* Segmented Mode Toggle */}
                  <div className="h-9 flex items-center bg-slate-100 dark:bg-black/30 p-1 rounded-xl border border-slate-200/80 dark:border-white/[0.12] gap-1">
                    <button
                      type="button"
                      onClick={() => setImportMode('merge')}
                      className={`px-3 h-7 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                        importMode === 'merge'
                          ? 'bg-[#BC881B] text-[#1A1A1A] shadow-xs'
                          : 'text-slate-600 dark:text-[#B3AABD] hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Safe Merge
                    </button>
                    <button
                      type="button"
                      onClick={() => setImportMode('overwrite')}
                      className={`px-3 h-7 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                        importMode === 'overwrite'
                          ? 'bg-rose-500 text-white shadow-xs'
                          : 'text-slate-600 dark:text-[#B3AABD] hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Full Clone &amp; Overwrite
                    </button>
                  </div>
                </div>

                {/* Visible line under toggle for Overwrite per Part 5 */}
                {importMode === 'overwrite' && (
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold animate-in fade-in flex items-center gap-1.5 pt-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Replaces ALL data on this PC.</span>
                  </p>
                )}

                {/* Dashed Drop Zone */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const file = e.dataTransfer.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (evt) => {
                        const text = evt.target?.result as string;
                        if (text) {
                          setCsvText(text);
                          executeMigration(text);
                        }
                      };
                      reader.readAsText(file);
                    }
                  }}
                  className="border-[1.5px] border-dashed border-purple-400/45 hover:border-purple-500/80 bg-white/50 dark:bg-white/[0.02] hover:bg-white/80 dark:hover:bg-white/[0.04] rounded-2xl p-6 text-center cursor-pointer transition-all select-none space-y-2"
                >
                  <div className="w-10 h-10 rounded-full bg-purple-500/15 border border-purple-400/30 text-purple-600 dark:text-purple-300 flex items-center justify-center mx-auto">
                    <HardDrive className="w-5 h-5 stroke-[1.8]" />
                  </div>
                  <p className="text-[14px] font-bold text-slate-900 dark:text-white">
                    Click to browse Master Migration file from USB or Computer
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-300/80 font-mono">
                    Supports ULM_LMS_Master_Migration_Package_*.csv and ULM_LMS_System_Database_Clone_*.json
                  </p>
                </div>

                {/* Toolbar Actions: Choose Migration File, Clear Buffer, Incorporate Data */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-9 px-3.5 rounded-xl bg-white/80 dark:bg-white/[0.06] hover:bg-white dark:hover:bg-white/[0.12] text-slate-800 dark:text-white text-[12px] font-semibold border border-slate-200/90 dark:border-white/[0.12] transition-colors cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5 text-amber-600 dark:text-[#E0B450]" />
                      <span>Choose Migration File</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setCsvText('');
                        setImportStatus(null);
                        setImportError(null);
                      }}
                      className="h-9 px-3 rounded-xl bg-slate-100 dark:bg-white/[0.04] hover:bg-slate-200/80 dark:hover:bg-white/[0.08] text-slate-600 dark:text-[#B3AABD] text-[12px] font-medium transition-colors cursor-pointer"
                    >
                      Clear Buffer
                    </button>
                  </div>

                  {/* Incorporate Data button follows mode color */}
                  <button
                    type="button"
                    onClick={() => {
                      if (csvText.trim()) {
                        executeMigration(csvText);
                      } else {
                        fileInputRef.current?.click();
                      }
                    }}
                    disabled={isProcessing}
                    className={`h-10 px-5 rounded-xl text-[12px] font-bold transition-all cursor-pointer inline-flex items-center gap-2 shadow-sm ${
                      importMode === 'overwrite'
                        ? 'bg-rose-600 hover:bg-rose-700 text-white'
                        : 'bg-[#BC881B] hover:bg-[#D4A02A] text-[#1A1A1A]'
                    }`}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Incorporate Data...</span>
                      </>
                    ) : isSuccessMorph ? (
                      <>
                        <Check className="w-4 h-4 stroke-[3]" />
                        <span>Incorporate Data (Success)</span>
                      </>
                    ) : (
                      <>
                        <ArrowDownToLine className="w-4 h-4" />
                        <span>Incorporate Data</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Collapsed Block 2: Developer Tools */}
              <div className="rounded-2xl bg-white/60 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.12] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setIsDevToolsOpen(!isDevToolsOpen)}
                  className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-slate-100/60 dark:hover:bg-white/[0.02] text-xs font-mono text-slate-600 dark:text-[#B3AABD] cursor-pointer"
                >
                  <span>Developer tools (Buffer inspection &amp; synthetic test files)</span>
                  <span>{isDevToolsOpen ? 'Hide' : 'Show'}</span>
                </button>

                {isDevToolsOpen && (
                  <div className="p-4 border-t border-slate-200/80 dark:border-white/[0.10] space-y-3 animate-in fade-in">
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-600 dark:text-[#B3AABD]">
                      <span>Direct Migration Data Buffer</span>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={loadSampleMigrationFile}
                          className="text-amber-700 dark:text-[#E0B450] hover:underline cursor-pointer"
                        >
                          Load Sample Transfer File
                        </button>
                        <span>•</span>
                        <button
                          type="button"
                          onClick={() => {
                            loadSampleMigrationFile();
                            const sample = `# ====================================================================
# UNIVERSITY OF LAKKI MARWAT - LIBRARY MANAGEMENT SYSTEM (LMS)
# MASTER PC-TO-PC DATA MIGRATION PACKAGE (SAMPLE TEST FILE)
# ====================================================================

# === SECTION: SETTINGS ===
StationID,LibraryName,UniversityName,CampusAddress,Phone,Email,ScannerSound,ErrorSound,WalMode
"LMS-WIN-02","Central Campus Library","University of Lakki Marwat","Lakki Marwat, KPK","+92-969-510015","library@ulm.edu.pk",true,true,true

# === SECTION: BOOKS ===
Barcode,ISBN,BookTitle,Author,Category,TotalCopies,AvailableCopies,Shelf,Row,DeweyCallNumber,Publisher,Edition,Year,Language,IsActive
"9780262033848","978-0262033848","Introduction to Algorithms","Thomas H. Cormen","Computer Science",8,7,"CS-Rack-05","2","518.1 COR","MIT Press","4th Edition",2022,"English",1

# === SECTION: BORROWERS ===
StudentID,FullName,Department,Program,ClassName,Phone,Email,IsActive
"ULM-2023-CS-0101","Muhammad Tariq Khan","Computer Science","BS Computer Science","BS-CS-7A","0345-9876543","tariq.khan@ulm.edu.pk",1

# === SECTION: TRANSACTIONS ===
TransactionID,Barcode,BookTitle,BorrowerName,StudentID,Action,IssueDate,DueDate,ReturnDate,Quantity,Status
"tx-sample-001","9780262033848","Introduction to Algorithms","Muhammad Tariq Khan","ULM-2023-CS-0101","ISSUE","${todayStr}","2026-10-10","N/A",1,"ACTIVE"`;
                            executeMigration(sample);
                          }}
                          className="text-emerald-600 dark:text-emerald-400 hover:underline font-bold cursor-pointer"
                        >
                          Test Sample Migration
                        </button>
                      </div>
                    </div>

                    <textarea
                      value={csvText}
                      onChange={(e) => setCsvText(e.target.value)}
                      rows={4}
                      placeholder="Raw migration CSV or JSON contents..."
                      className="w-full bg-white/80 dark:bg-black/30 border border-slate-200/90 dark:border-white/[0.12] rounded-xl p-2.5 text-[11px] font-mono text-slate-800 dark:text-[#E7E2EC] focus:outline-none focus:border-[#BC881B]"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Hidden File Input for Master Migration file picker */}
      <input
        id="master-migration-file-input"
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".csv,.json,.txt,.xlsx"
        className="sr-only"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '1px',
          height: '1px',
          opacity: 0,
          pointerEvents: 'none',
        }}
      />

      {/* Portaled Frosted Crystal Confirmation Dialog for Reset All Books to 0 */}
      {showResetZeroModal && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xl animate-in fade-in duration-150"
          onClick={() => !isProcessing && setShowResetZeroModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="ulm-preserve-glass ulm-dark-plaque w-full max-w-md rounded-[26px] bg-gradient-to-br from-[#23173D]/95 via-[#18102B]/95 to-[#120B22]/98 backdrop-blur-2xl border border-rose-400/35 shadow-[inset_1.5px_1.5px_2px_rgba(255,255,255,0.20),0_32px_90px_rgba(0,0,0,0.65)] overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-white/[0.12] flex items-center justify-between bg-rose-500/12">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-400/40 flex items-center justify-center text-rose-300">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-white">Clear All Books to Zero?</h3>
                  <p className="text-[11px] text-rose-200/80">Irreversible catalog wipe operation</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowResetZeroModal(false)}
                className="w-8 h-8 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] border border-white/[0.12] flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-[13px] text-slate-200 leading-relaxed">
                This will completely wipe all book volumes from SQLite, IndexedDB, and local storage and reset the catalog count to <strong className="text-white font-mono">0</strong>. Export a Transfer ZIP backup first if you need to preserve your catalog.
              </p>
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowResetZeroModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.14] text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={executeResetAllBooksToZero}
                  className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-md transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Wipe Catalog to 0</span>
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default ExcelCenterView;
