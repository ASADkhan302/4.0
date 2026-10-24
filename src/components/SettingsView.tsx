import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Save, 
  RotateCcw, 
  HardDrive, 
  Volume2, 
  CheckCircle2, 
  Building2, 
  Download,
  FolderOpen,
  Check,
  Sparkles,
  Loader2,
  Copy,
  ArrowRightLeft,
  ShieldCheck,
  Folder,
  Trash2,
  Barcode,
  FileSpreadsheet,
  Archive,
  RefreshCw,
  AlertCircle,
  Info,
  Package,
  ShieldAlert,
  Layers,
  Library,
  FileCode,
  Palette
} from 'lucide-react';
import { CoreSystemDocService } from '../services/coreSystemDocService';
import { SystemSettings, LinkedSheetInfo } from '../types/library';
import { LibraryStorage } from '../services/storage';
import { BarcodeService } from '../services/barcodeService';
import { LibraryDataFilesService } from '../services/libraryDataFilesService';
import { UsbBackupService } from '../services/usbBackupService';
import { BookSheetService } from '../services/bookSheetService';
import { LibraryFolderService } from '../services/libraryFolderService';
import { RealStorageService, StorageStatus } from '../services/realStorageService';
import { ResetToZeroService, UndoResetMeta } from '../services/resetToZeroService';
import { ResetToZeroModal } from './modals/ResetToZeroModal';
import { syncMasterExcelRegister, downloadMasterExcelRegister } from '../services/libraryStorageAndMigration';
import { ULM_CREST_LOGO } from '../constants/branding';
import { ButtonAuditPanel } from './ui/ButtonAuditPanel';
import { GroupsSettingsTab } from './settings/GroupsSettingsTab';
import { AlmarisSettingsTab } from './settings/AlmarisSettingsTab';
import { AppearanceSettingsTab } from './settings/AppearanceSettingsTab';

interface SettingsViewProps {
  settings: SystemSettings;
  onUpdateSettings: (newSettings: SystemSettings) => void;
  onResetDemoData: () => void;
  onClearDemoData?: () => void;
  onResetToZeroComplete?: () => void;
  onPlayBootAnimation?: () => void;
  onOpenStorageModal?: () => void;
  onOpenWelcomeModal?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  onResetDemoData,
  onClearDemoData,
  onResetToZeroComplete,
  onPlayBootAnimation,
  onOpenStorageModal,
  onOpenWelcomeModal,
}) => {
  const [formData, setFormData] = useState<SystemSettings>({ ...settings });
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [institutionalSaved, setInstitutionalSaved] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);
  const [moveNotice, setMoveNotice] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmClearDemo, setConfirmClearDemo] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<'general' | 'groups' | 'almaris'>('general');

  // Barcode & Transfer Actions State
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [backfillMessage, setBackfillMessage] = useState<string | null>(null);
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [showButtonAudit, setShowButtonAudit] = useState(false);

  const storageConfig = LibraryStorage.getStorageLocation();
  const currentDbPath = storageConfig.folderPath 
    ? `${storageConfig.folderPath}\\Library.ulmlib`
    : (formData.db_path || 'Documents\\ULM Library\\Library.ulmlib');

  const [realStorageStatus, setRealStorageStatus] = useState<StorageStatus | null>(null);
  const [isCheckingLibraryFile, setIsCheckingLibraryFile] = useState<boolean>(false);
  const [quickCheckInfo, setQuickCheckInfo] = useState<{
    open: boolean;
    passed: boolean;
    message: string;
    journalMode: string;
    synchronous: string;
    foreignKeys: boolean;
    fileSizeBytes: number;
    lastSaved: string | null;
    booksCount: number;
    borrowersCount: number;
    loansCount: number;
  } | null>(null);
  const [isChangingLocation, setIsChangingLocation] = useState<boolean>(false);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);

  const refreshRealStorageStatus = async () => {
    try {
      const st = await RealStorageService.getStatus();
      setRealStorageStatus(st);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    refreshRealStorageStatus();
  }, []);

  const handleChangeLocation = async () => {
    if (onOpenStorageModal) {
      onOpenStorageModal();
      return;
    }
    setIsChangingLocation(true);
    setLocationNotice('Selecting destination folder...');
    try {
      const pickRes = await RealStorageService.pickDirectory();
      if (pickRes.success) {
        const candidate = pickRes.handle || pickRes.path;
        setLocationNotice('Copying SQLite database bytes & verifying integrity...');
        const changeRes = await RealStorageService.changeLocation(candidate);
        if (changeRes.success) {
          setLocationNotice(changeRes.message);
          await refreshRealStorageStatus();
        } else {
          setLocationNotice(`Relocation canceled: ${changeRes.message}`);
        }
      } else {
        setLocationNotice(pickRes.error || 'Folder selection was not completed');
      }
    } catch (err: any) {
      setLocationNotice(`Relocation error: ${err.message}`);
    } finally {
      setIsChangingLocation(false);
      setTimeout(() => setLocationNotice(null), 5000);
    }
  };

  const handleCheckLibraryFile = async () => {
    setIsCheckingLibraryFile(true);
    try {
      const st = await RealStorageService.getStatus();
      setRealStorageStatus(st);
      const bCount = LibraryStorage.getBooks().length;
      const mCount = LibraryStorage.getBorrowers().length;
      const lCount = LibraryStorage.getTransactions().length;
      setQuickCheckInfo({
        open: true,
        passed: st.quickCheckOk,
        message: st.quickCheckMessage,
        journalMode: st.journalMode,
        synchronous: 'FULL',
        foreignKeys: true,
        fileSizeBytes: st.fileSizeBytes,
        lastSaved: st.lastSavedIso,
        booksCount: bCount,
        borrowersCount: mCount,
        loansCount: lCount,
      });
    } catch (err: any) {
      setQuickCheckInfo({
        open: true,
        passed: false,
        message: `Quick check error: ${err.message}`,
        journalMode: 'UNKNOWN',
        synchronous: 'UNKNOWN',
        foreignKeys: false,
        fileSizeBytes: 0,
        lastSaved: null,
        booksCount: 0,
        borrowersCount: 0,
        loansCount: 0,
      });
    } finally {
      setIsCheckingLibraryFile(false);
    }
  };

  const [isExportingPackage, setIsExportingPackage] = useState(false);
  const [isBackingUpNow, setIsBackingUpNow] = useState(false);
  const [isRefreshingDataFiles, setIsRefreshingDataFiles] = useState(false);
  const [packageNotice, setPackageNotice] = useState<string | null>(null);
  const packageInputRef = React.useRef<HTMLInputElement>(null);

  // Reset to Zero & Undo State
  const [isResetToZeroModalOpen, setIsResetToZeroModalOpen] = useState(false);
  const [undoAvailability, setUndoAvailability] = useState(() => ResetToZeroService.getUndoAvailability());
  const [isUndoingReset, setIsUndoingReset] = useState(false);
  const [undoNotice, setUndoNotice] = useState<string | null>(null);

  const refreshUndoState = () => {
    setUndoAvailability(ResetToZeroService.getUndoAvailability());
  };

  const handleUndoResetFromSettings = async () => {
    setIsUndoingReset(true);
    setUndoNotice('Restoring previous catalog snapshot...');
    try {
      const res = await ResetToZeroService.undoReset((pct, stage) => {
        setUndoNotice(`${stage} (${pct}%)`);
      });
      if (res.success) {
        setUndoNotice(res.message);
        refreshUndoState();
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } else {
        setUndoNotice(`Undo failed: ${res.message}`);
      }
    } catch (err: any) {
      setUndoNotice(`Undo failed: ${err.message}`);
    } finally {
      setIsUndoingReset(false);
    }
  };

  const folderStatus = LibraryFolderService.getFolderStatus();

  useEffect(() => {
    setFormData({ ...settings });
  }, [settings]);

  const [copiedCoreDoc, setCopiedCoreDoc] = useState(false);

  const handleCopyPath = () => {
    navigator.clipboard.writeText(currentDbPath);
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 2000);
  };

  const handleCopyCoreDoc = async () => {
    const ok = await CoreSystemDocService.copyToClipboard();
    if (ok) {
      setCopiedCoreDoc(true);
      setTimeout(() => setCopiedCoreDoc(false), 2500);
    }
  };

  const handleDownloadCoreDoc = () => {
    CoreSystemDocService.downloadMarkdownFile();
  };

  const handleOpenFolder = () => {
    setMoveNotice(`Library Folder: "${storageConfig.folderPath || 'Documents\\ULM Library'}" (contains Library.ulmlib, Book Sheet, Data Files, Backups)`);
    setTimeout(() => setMoveNotice(null), 4000);
  };

  const handleExportLibraryPackage = async () => {
    setIsExportingPackage(true);
    setPackageNotice('Building transfer package (.ulmpack) with database, book sheet, data files, and images...');
    try {
      const res = await UsbBackupService.exportLibraryPackage((pct, stage) => {
        setPackageNotice(`Exporting Package (${pct}%): ${stage}`);
      });
      if (res.success) {
        setPackageNotice(`Package exported successfully: ${res.filename}`);
      } else {
        setPackageNotice(`Export notice: ${res.message}`);
      }
    } catch (e: any) {
      setPackageNotice(`Export failed: ${e.message}`);
    } finally {
      setIsExportingPackage(false);
      setTimeout(() => setPackageNotice(null), 4000);
    }
  };

  const handleOpenLibraryPackage = async (file: File) => {
    setPackageNotice('Validating package manifest and SHA-256 signatures...');
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const val = await UsbBackupService.validateBackupZip(bytes);
      if (!val.valid) {
        setPackageNotice(`Invalid package: ${val.errors.join(' | ')}`);
        return;
      }
      const res = await UsbBackupService.importFromUsb(bytes, 'REPLACE', (pct, stage) => {
        setPackageNotice(`${stage} (${pct}%)`);
      });
      if (res.success) {
        await LibraryFolderService.saveDatabaseFile();
        await LibraryFolderService.refreshDataFiles(true);
        setPackageNotice(res.message);
      } else {
        setPackageNotice(res.message);
      }
    } catch (e: any) {
      setPackageNotice(`Package restore failed: ${e.message}`);
    } finally {
      setTimeout(() => setPackageNotice(null), 5000);
    }
  };

  const handleBackupNow = async () => {
    setIsBackingUpNow(true);
    try {
      await LibraryFolderService.createAutoBackup();
      setPackageNotice('Saved safety backup to Backups\\ subfolder (maintaining up to 14 rolling backups).');
    } catch (e: any) {
      setPackageNotice(`Backup notice: ${e.message}`);
    } finally {
      setIsBackingUpNow(false);
      setTimeout(() => setPackageNotice(null), 4000);
    }
  };

  const handleRefreshDataFilesNow = async () => {
    setIsRefreshingDataFiles(true);
    try {
      const res = await LibraryFolderService.refreshDataFiles(true);
      setPackageNotice(res.message);
    } catch (e: any) {
      setPackageNotice(`Data files refresh error: ${e.message}`);
    } finally {
      setIsRefreshingDataFiles(false);
      setTimeout(() => setPackageNotice(null), 4000);
    }
  };

  const handleMoveData = () => {
    if (onOpenStorageModal) {
      onOpenStorageModal();
    }
  };

  const handleSwitchDatabase = () => {
    if (onOpenStorageModal) {
      onOpenStorageModal();
    }
  };

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    setTimeout(() => {
      const updated: SystemSettings = { ...formData };
      LibraryStorage.saveSettings(updated);
      onUpdateSettings(updated);
      setIsSaving(false);
      setIsSaved(true);
      setSaveSuccess(true);
      setInstitutionalSaved(true);
      setTimeout(() => {
        setIsSaved(false);
        setSaveSuccess(false);
        setInstitutionalSaved(false);
      }, 1200);
    }, 200);
  };

  const handleBackupDatabase = () => {
    const backupObj = {
      timestamp: new Date().toISOString(),
      station: formData.station_id,
      books: LibraryStorage.getBooks(),
      borrowers: LibraryStorage.getBorrowers(),
      transactions: LibraryStorage.getTransactions(),
      history: LibraryStorage.getHistory(),
      settings: formData,
    };
    const jsonStr = JSON.stringify(backupObj, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ULM_LMS_Database_Snapshot_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleBackfillBarcodes = async () => {
    setIsBackfilling(true);
    setBackfillMessage('Starting automatic barcode backfill...');
    try {
      const res = await BarcodeService.backfillMissingBarcodes((pct, stage) => {
        setBackfillMessage(`${stage} (${pct}%)`);
      });
      if (res.success) {
        setBackfillMessage(`Backfill complete: ${res.backfilledCount} volumes assigned institutional barcodes.`);
      } else {
        setBackfillMessage(`Notice: ${res.message}`);
      }
    } catch (e: any) {
      setBackfillMessage(`Error: ${e.message}`);
    } finally {
      setIsBackfilling(false);
      setTimeout(() => setBackfillMessage(null), 5000);
    }
  };

  const handleDownloadLibraryData = async () => {
    try {
      await LibraryDataFilesService.downloadLibraryDataXlsx();
      setMoveNotice('Downloaded comprehensive LibraryData.xlsx workbook.');
      setTimeout(() => setMoveNotice(null), 3500);
    } catch (e: any) {
      setMoveNotice(`Failed to export LibraryData.xlsx: ${e.message}`);
      setTimeout(() => setMoveNotice(null), 3500);
    }
  };

  const handleExportZipArchive = async () => {
    setIsExportingZip(true);
    try {
      const res = await UsbBackupService.exportToUsb((pct, stage) => {
        setMoveNotice(`Packaging Transfer ZIP (${pct}%)...`);
      });
      if (res.success) {
        setMoveNotice(`ZIP Transfer Archive saved successfully (${res.filename}).`);
      } else {
        setMoveNotice(res.message);
      }
    } catch (e: any) {
      setMoveNotice(`Failed: ${e.message}`);
    } finally {
      setIsExportingZip(false);
      setTimeout(() => setMoveNotice(null), 4000);
    }
  };

  return (
    <div className="w-full h-auto min-h-0 flex flex-col gap-5 bg-fluent-matrix px-4 sm:px-6 lg:px-8 pt-5 pb-12 overflow-visible">
      <div className="max-w-[1280px] w-full mx-auto space-y-6">

        {/* Top Header Banner */}
        <div className="bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-white/10 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-[10px] bg-[#BC881B]/15 border border-[#BC881B]/30 flex items-center justify-center text-[#BC881B] shrink-0 shadow-2xs">
              <Settings className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <span>System Settings &amp; Workstation Configuration</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Configure institutional credentials, workstation peripheral hooks, appearance, and local SQLite data.
              </p>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`min-w-[160px] h-11 px-5 rounded-[10px] text-xs font-semibold uppercase tracking-wider transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#29658E]/60 ${
              isSaved
                ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-600 dark:text-emerald-300'
                : 'bg-gradient-to-b from-[#BC881B] to-[#9E7216] hover:from-[#CD9520] hover:to-[#B07F19] text-white shadow-sm border border-[#D4A338]/40 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]'
            } ${isSaving ? 'opacity-80 cursor-wait' : ''}`}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Saving...</span>
              </>
            ) : isSaved ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-300 font-bold animate-in zoom-in-75 duration-200">
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Saved</span>
              </span>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Preferences</span>
              </>
            )}
          </button>
        </div>

        {/* Settings Navigation Sub-Tabs */}
        <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveSettingsTab('general')}
            className={`px-4 py-2 rounded-[8px] text-[13px] font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeSettingsTab === 'general'
                ? 'bg-[#BC881B]/20 text-[#E0B450] border border-[#BC881B]/40'
                : 'text-[var(--text-muted)] hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Palette className="w-4 h-4" />
            General &amp; Theme (تھیم اور عمومی ترتیبات)
          </button>
          <button
            type="button"
            onClick={() => setActiveSettingsTab('groups')}
            className={`px-4 py-2 rounded-[8px] text-[13px] font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeSettingsTab === 'groups'
                ? 'bg-[#BC881B]/20 text-[#E0B450] border border-[#BC881B]/40'
                : 'text-[var(--text-muted)] hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Layers className="w-4 h-4" />
            Book Groups (گروپس)
          </button>
          <button
            type="button"
            onClick={() => setActiveSettingsTab('almaris')}
            className={`px-4 py-2 rounded-[8px] text-[13px] font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeSettingsTab === 'almaris'
                ? 'bg-[#BC881B]/20 text-[#E0B450] border border-[#BC881B]/40'
                : 'text-[var(--text-muted)] hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Almaris &amp; Shelves (الماریاں)
          </button>
        </div>

        {activeSettingsTab === 'groups' && (
          <GroupsSettingsTab />
        )}

        {activeSettingsTab === 'almaris' && (
          <AlmarisSettingsTab />
        )}

        {activeSettingsTab === 'general' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Liquid Glass, Theme & Resolution Controls */}
          <AppearanceSettingsTab />

        {saveSuccess && (
          <div className="p-3.5 rounded-[10px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5 shadow-sm animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Settings successfully committed to local SQLite database.</span>
          </div>
        )}

        {/* Settings > About Application & Institutional Crest */}
        <div className="bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-white/10 rounded-2xl p-5 sm:p-6 shadow-sm relative overflow-hidden">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 sm:gap-6">
            {/* Crest with Refined Institutional Styling */}
            <div className="relative shrink-0 flex items-center justify-center p-2 rounded-2xl bg-slate-50 dark:bg-[#0B1220] border border-[#BC881B]/40 shadow-xs">
              <img
                src={ULM_CREST_LOGO}
                alt="University of Lakki Marwat Crest"
                width={88}
                height={88}
                className="w-20 h-20 sm:w-22 sm:h-22 object-contain drop-shadow-xs select-none"
              />
            </div>

            <div className="space-y-2 text-center sm:text-left flex-1 min-w-0">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-cinzel tracking-wide">
                  University of Lakki Marwat LMS
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-[#BC881B]/20 text-[#8F4F00] dark:text-[#E0B450] border border-[#BC881B]/40">
                  Version 2.4.0
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-[#CBD5E1] leading-relaxed">
                Central Campus Library Management System with offline SQLite transaction engine, multi-user file synchronization, and Code-128 barcode circulation desk.
              </p>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 pt-1 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                <span>Build: 2026.1 Enterprise Desktop</span>
                <span>•</span>
                <span>Lakki Marwat, Khyber Pakhtunkhwa, Pakistan</span>
                <span>•</span>
                <span>Copyright © 2026 University of Lakki Marwat</span>
              </div>
            </div>
          </div>
        </div>

        {/* Developer & QA Button Audit Panel */}
        {showButtonAudit && (
          <ButtonAuditPanel onClose={() => setShowButtonAudit(false)} />
        )}

        <form onSubmit={handleSave} className="space-y-6">
          {/* Card 2: Institutional Identity & Campus Header Details */}
          <div className="bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-white/10 rounded-2xl p-5 sm:p-6 space-y-5 shadow-sm relative overflow-hidden">
            {/* Section Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[10px] bg-[#BC881B]/15 border border-[#BC881B]/30 flex items-center justify-center text-[#BC881B] shrink-0 shadow-2xs">
                  <Building2 className="w-5 h-5 stroke-[2]" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-tight tracking-tight">
                    Card 2 — Institutional Identity &amp; Campus Header Details
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Modifies university name, library sub-header, and contact credentials live across the application.
                  </p>
                </div>
              </div>

              <span className="px-3 py-1 rounded-[8px] text-[11px] font-mono font-semibold uppercase tracking-wider bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10">
                Live System Header Branding
              </span>
            </div>

            {/* Input Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 block">
                  University / Institution Name <span className="text-[#BC881B]">*</span>
                </label>
                <input
                  type="text"
                  value={formData.university_name}
                  onChange={(e) => setFormData({ ...formData, university_name: e.target.value })}
                  placeholder="e.g. University of Lakki Marwat"
                  className="w-full h-10 px-3.5 rounded-lg bg-white dark:bg-[#0B1220] border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white text-sm focus:border-[#BC881B] outline-none transition-colors"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Displayed in native Windows title bar, top navigation header, and member ID cards.
                </p>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 block">
                  Library Facility / Department Name <span className="text-[#BC881B]">*</span>
                </label>
                <input
                  type="text"
                  value={formData.library_name}
                  onChange={(e) => setFormData({ ...formData, library_name: e.target.value })}
                  placeholder="e.g. Central Campus Library"
                  className="w-full h-10 px-3.5 rounded-lg bg-white dark:bg-[#0B1220] border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white text-sm focus:border-[#BC881B] outline-none transition-colors"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Displayed as primary library header, sidebar campus title, and circulation receipts.
                </p>
              </div>

              <div className="md:col-span-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 block">
                  Campus Physical Address
                </label>
                <input
                  type="text"
                  value={formData.campus_address}
                  onChange={(e) => setFormData({ ...formData, campus_address: e.target.value })}
                  placeholder="e.g. Main Campus, Bannu-Mianwali Road, Lakki Marwat, KPK, Pakistan"
                  className="w-full h-10 px-3.5 rounded-lg bg-white dark:bg-[#0B1220] border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white text-sm focus:border-[#BC881B] outline-none transition-colors"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Printed on institutional circulation vouchers, export manifests, and overdue notices.
                </p>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 block">
                  Official Contact Phone
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="e.g. +92-969-510015"
                  className="w-full h-10 px-3.5 rounded-lg bg-white dark:bg-[#0B1220] border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white text-sm focus:border-[#BC881B] outline-none transition-colors"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Circulation desk helpline for book renewals and student queries.
                </p>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 block">
                  Official Circulation Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="e.g. library@ulm.edu.pk"
                  className="w-full h-10 px-3.5 rounded-lg bg-white dark:bg-[#0B1220] border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white text-sm focus:border-[#BC881B] outline-none transition-colors"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Institutional contact address for inter-library loan requests.
                </p>
              </div>
            </div>

            {/* Live Header Branding Preview */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0B1220] space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-[#BC881B] font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Live Title Bar &amp; Header Preview</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs font-mono text-slate-900 dark:text-white truncate py-0.5">
                <span className="font-bold font-cinzel text-sm sm:text-base tracking-wide text-slate-900 dark:text-white">
                  {formData.university_name.trim() || 'University of Lakki Marwat'}
                </span>
                <span className="text-[#BC881B] font-sans">|</span>
                <span className="text-slate-700 dark:text-[#E0B450] font-cinzel text-xs sm:text-sm">
                  {formData.library_name.trim() || 'Central Campus Library'}
                </span>
              </div>
            </div>

            {/* Dedicated Apply Action Footer */}
            <div className="pt-4 border-t border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">
                Click <strong className="text-slate-900 dark:text-white">Apply Details to App</strong> to instantly synchronize headers, title bars, and commit changes to local SQLite storage.
              </p>

              <div className="flex items-center gap-3">
                {institutionalSaved && (
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-3.5 py-2 rounded-lg border border-emerald-300 dark:border-emerald-500/30 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Applied to App!</span>
                  </span>
                )}

                <button
                  type="button"
                  onClick={handleSave}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-b from-[#BC881B] to-[#9E7216] hover:from-[#CD9520] hover:to-[#B07F19] text-white font-semibold text-xs uppercase tracking-wider transition-all shadow-sm border border-[#D4A338]/40 cursor-pointer hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
                >
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>Apply Details to App</span>
                </button>
              </div>
            </div>
          </div>

          {/* Card 3: Barcode Scanner & Peripherals */}
          <div className="bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-white/10 rounded-2xl p-5 sm:p-6 space-y-5 shadow-sm relative overflow-hidden">
            <div className="flex items-center gap-3 border-b border-slate-200 dark:border-white/10 pb-4">
              <div className="w-10 h-10 rounded-[10px] bg-[#29658E]/20 border border-[#29658E]/40 flex items-center justify-center text-[#29658E] dark:text-[#58A6DF] shrink-0 shadow-2xs">
                <Volume2 className="w-5 h-5 stroke-[2]" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">Card 3 — Barcode Scanner &amp; Peripherals</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Configure hardware audio triggers, auto-submission, and workstation node tagging.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0B1220] hover:border-slate-300 transition-colors">
                <div>
                  <p className="text-xs font-semibold text-slate-800 dark:text-white">Hardware Audio Feedback</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Play pleasant frequency chirp on barcode detection</p>
                </div>
                <input
                  type="checkbox"
                  checked={formData.scanner_sound}
                  onChange={(e) => setFormData({ ...formData, scanner_sound: e.target.checked })}
                  className="w-4 h-4 rounded text-[#BC881B] focus:ring-0 focus:outline-none accent-[#BC881B] cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0B1220] hover:border-slate-300 transition-colors">
                <div>
                  <p className="text-xs font-semibold text-slate-800 dark:text-white">Auto-Submit Scan</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Execute search immediately upon receiving 13-digit EAN</p>
                </div>
                <input
                  type="checkbox"
                  checked={formData.auto_submit_scan}
                  onChange={(e) => setFormData({ ...formData, auto_submit_scan: e.target.checked })}
                  className="w-4 h-4 rounded text-[#BC881B] focus:ring-0 focus:outline-none accent-[#BC881B] cursor-pointer"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 block">
                  Workstation Node ID
                </label>
                <input
                  type="text"
                  value={formData.station_id}
                  onChange={(e) => setFormData({ ...formData, station_id: e.target.value })}
                  className="w-full h-10 px-3.5 rounded-lg bg-white dark:bg-[#0B1220] border border-slate-300 dark:border-white/15 font-mono text-slate-900 dark:text-white text-sm focus:border-[#BC881B] outline-none transition-colors"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 block">
                  Windows Title Bar Badge
                </label>
                <div className="p-3 rounded-lg border border-slate-300 dark:border-white/10 text-xs font-mono bg-slate-50 dark:bg-[#0B1220] text-slate-600 dark:text-slate-400 flex items-center justify-between h-10">
                  <span>Visible in native top bar:</span>
                  <span className="text-[#BC881B] font-bold font-mono px-2 py-0.5 rounded bg-[#BC881B]/15 border border-[#BC881B]/30">{formData.station_id}</span>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 block">
                  Institutional Barcode Prefix (Max 6 Chars)
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={formData.barcode_prefix || 'ULM'}
                  onChange={(e) => {
                    const clean = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
                    setFormData({ ...formData, barcode_prefix: clean });
                  }}
                  placeholder="ULM"
                  className="w-full h-10 px-3.5 rounded-lg bg-white dark:bg-[#0B1220] border border-slate-300 dark:border-white/15 font-mono text-slate-900 dark:text-[#E0B450] font-bold text-sm focus:border-[#BC881B] outline-none transition-colors uppercase"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Format: <span className="text-slate-800 dark:text-white font-mono">{formData.barcode_prefix || 'ULM'}-00123</span> (Code-128 standard).
                </p>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 block">
                  First Accession Number (Default 1)
                </label>
                <input
                  type="number"
                  min={1}
                  value={formData.first_accession_number || 1}
                  onChange={(e) => {
                    const num = parseInt(e.target.value, 10);
                    setFormData({ ...formData, first_accession_number: isNaN(num) || num < 1 ? 1 : num });
                  }}
                  className="w-full h-10 px-3.5 rounded-lg bg-white dark:bg-[#0B1220] border border-slate-300 dark:border-white/15 font-mono text-slate-900 dark:text-[#E0B450] font-bold text-sm focus:border-[#BC881B] outline-none transition-colors"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Initial accession sequence number when starting a new catalog with no existing books.
                </p>
              </div>

              <div className="md:col-span-2">
                <button
                  type="button"
                  onClick={handleBackfillBarcodes}
                  disabled={isBackfilling}
                  className="w-full h-11 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-purple-950/40 dark:hover:bg-purple-900/60 text-slate-900 dark:text-purple-200 border border-slate-300 dark:border-purple-800/40 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60 shadow-xs"
                  title="Generate institutional barcodes for any volumes missing a barcode"
                >
                  {isBackfilling ? <Loader2 className="w-4 h-4 animate-spin text-[#BC881B]" /> : <Barcode className="w-4 h-4 text-[#BC881B]" />}
                  <span>{isBackfilling ? 'Assigning Barcodes...' : 'Auto-Backfill Barcodes'}</span>
                </button>
                {backfillMessage && (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1.5 font-mono text-center">{backfillMessage}</p>
                )}
              </div>
            </div>
          </div>

          {/* Card 4: Library Folder Storage & Data Maintenance */}
          <div className="bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-white/10 rounded-2xl p-5 sm:p-6 space-y-5 shadow-sm relative overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[10px] bg-[#BC881B]/15 border border-[#BC881B]/35 flex items-center justify-center text-[#BC881B] shrink-0 shadow-2xs">
                  <HardDrive className="w-5 h-5 stroke-[2]" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">Card 4 — Library Folder Storage &amp; Data Maintenance</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Primary database file (Library.ulmlib), linked Excel book entry sheet, and data files.</p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-[8px] text-[11px] font-mono font-bold bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 shadow-2xs">
                OFFLINE SECURE · DATABASE MOUNTED
              </span>
            </div>

            {/* KPI Boxes: CURRENT LOCATION, FILE SIZE, and LAST SAVED */}
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-white/10 space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 block font-bold">CURRENT LOCATION</span>
                  <span className="text-xs font-mono font-semibold text-blue-600 dark:text-[#85C4F0] truncate block" title={realStorageStatus?.folderPath || currentDbPath}>
                    {realStorageStatus?.folderPath || currentDbPath}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-white/10 space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 block font-bold">FILE SIZE</span>
                  <span className="text-xs font-mono font-bold text-slate-900 dark:text-white block">
                    {realStorageStatus && realStorageStatus.fileSizeBytes > 0
                      ? `${(realStorageStatus.fileSizeBytes / 1024).toFixed(1)} KB (${realStorageStatus.fileSizeBytes.toLocaleString()} B)`
                      : 'Verified SQLite File'}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-white/10 space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 block font-bold">LAST SAVED</span>
                  <span className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400 block">
                    {realStorageStatus?.lastSavedIso
                      ? new Date(realStorageStatus.lastSavedIso).toLocaleDateString() + ' ' + new Date(realStorageStatus.lastSavedIso).toLocaleTimeString()
                      : 'Active Session'}
                  </span>
                </div>
              </div>

              {/* Uniform Secondary Action Buttons */}
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleOpenFolder}
                  className="px-3.5 h-10 rounded-lg text-xs font-semibold uppercase tracking-wider border border-slate-300 dark:border-white/10 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-slate-200 transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                  title="Open library folder on this computer"
                >
                  <Folder className="w-4 h-4 text-blue-600 dark:text-[#58A6DF]" />
                  <span>Open folder</span>
                </button>

                <button
                  type="button"
                  onClick={handleChangeLocation}
                  disabled={isChangingLocation}
                  className="px-3.5 h-10 rounded-lg text-xs font-semibold uppercase tracking-wider border border-slate-300 dark:border-white/10 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-slate-200 transition-all cursor-pointer flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                  title="Copies with SQLite backup API, verifies counts, switches location, preserves old copy"
                >
                  {isChangingLocation ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#BC881B]" />
                  ) : (
                    <ArrowRightLeft className="w-4 h-4 text-[#BC881B]" />
                  )}
                  <span>Change location</span>
                </button>

                <button
                  type="button"
                  onClick={handleCheckLibraryFile}
                  disabled={isCheckingLibraryFile}
                  className="px-3.5 h-10 rounded-lg text-xs font-semibold uppercase tracking-wider border border-slate-300 dark:border-white/10 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-slate-200 transition-all cursor-pointer flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                  title="Runs PRAGMA quick_check and verifies SQLite database integrity"
                >
                  {isCheckingLibraryFile ? (
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  )}
                  <span>Check library file</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyPath}
                  className="px-3.5 h-10 rounded-lg text-xs font-semibold uppercase tracking-wider border border-slate-300 dark:border-white/10 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-slate-200 transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                  title="Copy full database file path to clipboard"
                >
                  {copiedPath ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 stroke-[2.5]" />
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-slate-500" />
                      <span>Copy Path</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await syncMasterExcelRegister();
                      await downloadMasterExcelRegister();
                    } catch (e: any) {
                      setLocationNotice(`Master Excel sync notice: ${e.message}`);
                    }
                  }}
                  className="px-3.5 h-10 rounded-lg text-xs font-semibold uppercase tracking-wider border border-slate-300 dark:border-white/10 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-slate-200 transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                  title="Auto-Sync & Download Live Master Excel Register (ULM_Master_Books_Register.xlsx)"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Sync Master Excel</span>
                </button>
              </div>

              {/* Location Notification Banner */}
              {locationNotice && (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-500/15 border border-amber-300 dark:border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2 animate-in fade-in">
                  <Info className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{locationNotice}</span>
                </div>
              )}
            </div>

            {/* Data Maintenance & Reset Control */}
            <div className="pt-2 border-t border-slate-200 dark:border-white/10 space-y-3">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Data Maintenance &amp; Reset Control</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Action 1: Clear Demo Data */}
                <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-300 text-amber-950 dark:bg-amber-950/20 dark:border-amber-500/30 dark:text-amber-300 flex flex-col justify-between space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Trash2 className="w-4 h-4 text-[#BC881B]" />
                      <h4 className="text-xs font-bold uppercase tracking-wider">Action 1: Clear Demo Data</h4>
                    </div>
                    <p className="text-xs text-amber-900/90 dark:text-amber-200/80 leading-relaxed">
                      Removes <strong>ONLY</strong> rows marked as demo/sample (sample catalog books, demo student &amp; faculty members, and their loans). Real records stay untouched.
                    </p>
                  </div>

                  <div className="pt-2">
                    {confirmClearDemo ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold">Remove demo records?</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (onClearDemoData) onClearDemoData();
                            else {
                              LibraryStorage.clearDemoData();
                            }
                            setConfirmClearDemo(false);
                          }}
                          className="px-3.5 py-1.5 rounded-lg bg-[#BC881B] text-white text-xs font-bold transition-colors cursor-pointer"
                        >
                          Confirm Clear
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmClearDemo(false)}
                          className="px-3.5 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmClearDemo(true)}
                        className="flex items-center gap-1.5 px-4 h-10 rounded-lg border border-amber-400 bg-white dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer hover:bg-amber-100"
                        title="Removes only rows marked as demo/sample"
                      >
                        <Trash2 className="w-4 h-4 text-amber-600" />
                        <span>Clear Demo Data</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Action 2: Reset App / Clear All Data */}
                <div className="p-4 rounded-xl bg-rose-50/80 border border-rose-300 text-rose-950 dark:bg-rose-950/20 dark:border-rose-500/30 dark:text-rose-300 flex flex-col justify-between space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-rose-600" />
                      <h4 className="text-xs font-bold uppercase tracking-wider">Action 2: Reset App / Clear All Data</h4>
                    </div>
                    <p className="text-xs text-rose-900/90 dark:text-rose-200/80 leading-relaxed">
                      Clears SQLite tables, removes folder configuration, resets catalog to strictly 0 books, and opens Setup Gate.
                    </p>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setIsResetToZeroModalOpen(true)}
                      className="flex items-center gap-2 px-4 h-10 rounded-lg border border-rose-400 bg-white dark:bg-rose-900/40 text-rose-900 dark:text-rose-200 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer hover:bg-rose-100"
                      title="Reset app, purge all data to zero, and configure fresh folder"
                    >
                      <Trash2 className="w-4 h-4 text-rose-600" />
                      <span>Reset App / Clear All Data</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
        </div>
        )}

        {/* Reset to Zero Danger Modal */}
        {isResetToZeroModalOpen && (
          <ResetToZeroModal
            isOpen={isResetToZeroModalOpen}
            onClose={() => {
              setIsResetToZeroModalOpen(false);
              refreshUndoState();
            }}
            onResetComplete={() => {
              refreshUndoState();
              if (onResetToZeroComplete) {
                onResetToZeroComplete();
              }
            }}
            onGoToStartScreen={() => {
              setIsResetToZeroModalOpen(false);
              if (onOpenWelcomeModal) {
                onOpenWelcomeModal();
              } else {
                window.location.reload();
              }
            }}
          />
        )}

      </div>
    </div>
  );
};
export default SettingsView;
