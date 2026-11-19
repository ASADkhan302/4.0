import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
import { ULM_OFFICIAL_CREST_SRC, syncAppDesktopAndFaviconIcon } from '../constants/ulmOfficialAssets';
import { ButtonAuditPanel } from './ui/ButtonAuditPanel';
import { GroupsSettingsTab } from './settings/GroupsSettingsTab';
import { AlmarisSettingsTab } from './settings/AlmarisSettingsTab';
import { AppearanceSettingsTab } from './settings/AppearanceSettingsTab';
import { saveInstitutionalIdentity } from '../utils/themeTransition';

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
    const updated: SystemSettings = { ...formData };
    LibraryStorage.saveSettings(updated);
    const syncedIdentity = saveInstitutionalIdentity({
      universityName: updated.university_name,
      libraryDepartmentName: updated.library_name,
      campusAddress: updated.campus_address,
      contactPhone: updated.phone,
      circulationEmail: updated.email,
      workstationNodeId: updated.station_id,
      customCrestUrl: updated.customLogoDataUri || null,
    });
    if (typeof document !== 'undefined') {
      document.title = `${syncedIdentity.universityName} — ${syncedIdentity.libraryDepartmentName}`;
    }
    onUpdateSettings(updated);
    setTimeout(() => {
      setIsSaving(false);
      setIsSaved(true);
      setSaveSuccess(true);
      setInstitutionalSaved(true);
      setTimeout(() => {
        setIsSaved(false);
        setSaveSuccess(false);
        setInstitutionalSaved(false);
      }, 2600);
    }, 150);
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
    <div className="w-full h-auto min-h-0 flex flex-col gap-4 bg-fluent-matrix px-4 sm:px-6 lg:px-8 pt-4 pb-12 overflow-visible">
      <div className="max-w-[1920px] w-full mx-auto space-y-4">

        {/* Top Header Banner — Frosted Crystal Shell */}
        <div className="ulm-preserve-glass rounded-[26px] p-4 sm:p-5 bg-gradient-to-br from-white/85 via-white/70 to-white/55 dark:from-white/[0.08] dark:via-white/[0.035] dark:to-white/[0.015] backdrop-blur-xl backdrop-saturate-[180%] border border-slate-200/85 dark:border-white/[0.14] shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.85),0_10px_28px_rgba(15,23,42,0.06)] dark:shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.22),0_10px_28px_rgba(0,0,0,0.28)] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500/20 to-purple-500/15 dark:from-amber-400/20 dark:to-purple-500/20 border border-amber-500/35 dark:border-amber-400/30 flex items-center justify-center text-amber-600 dark:text-amber-300 shrink-0 shadow-2xs">
              <Settings className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <h2 className="font-['Plus_Jakarta_Sans'] text-[18px] font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <span>System Settings &amp; Workstation Configuration</span>
              </h2>
              <p className="text-[12px] text-slate-600 dark:text-slate-400 mt-0.5">
                Configure institutional credentials, workstation peripheral hooks, appearance, book groups, and local SQLite data.
              </p>
            </div>
          </div>

          {/* Right: Quick Section Filter / Anchor Pills + Primary Save Preferences Button */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex items-center gap-1 p-1 rounded-2xl bg-white/65 dark:bg-white/[0.04] border border-slate-200/85 dark:border-white/[0.12]">
              <button
                type="button"
                onClick={() => setActiveSettingsTab('general')}
                className={`h-8 px-3 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeSettingsTab === 'general'
                    ? 'bg-amber-500/20 text-amber-900 dark:text-amber-300 border border-amber-500/40 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white border border-transparent'
                }`}
              >
                <Palette className="w-3.5 h-3.5" />
                <span>All Settings Merged</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSettingsTab('groups')}
                className={`h-8 px-3 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeSettingsTab === 'groups'
                    ? 'bg-amber-500/20 text-amber-900 dark:text-amber-300 border border-amber-500/40 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white border border-transparent'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Book Groups (گروپس)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSettingsTab('almaris')}
                className={`h-8 px-3 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeSettingsTab === 'almaris'
                    ? 'bg-amber-500/20 text-amber-900 dark:text-amber-300 border border-amber-500/40 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white border border-transparent'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Almaris &amp; Shelves (الماریاں)</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className={`h-10 px-5 rounded-xl font-['Plus_Jakarta_Sans'] text-[12px] font-bold uppercase tracking-wider transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer shadow-md ${
                isSaved
                  ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                  : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 border border-amber-400/50'
              } ${isSaving ? 'opacity-80 cursor-wait' : ''}`}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Saving...</span>
                </>
              ) : isSaved ? (
                <span className="inline-flex items-center gap-1.5 font-bold">
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
        </div>

        {/* Save / Move / Package Toast Notifications */}
        {saveSuccess && (
          <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-800 dark:text-emerald-300 text-[12px] font-semibold flex items-center gap-2.5 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>✓ App Name, Header &amp; Splash Branding Synchronized!</span>
          </div>
        )}
        {(moveNotice || packageNotice || undoNotice) && (
          <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/35 text-amber-900 dark:text-amber-200 text-[12px] font-semibold flex items-center gap-2.5 animate-in fade-in">
            <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>{moveNotice || packageNotice || undoNotice}</span>
          </div>
        )}

        {/* Developer & QA Button Audit Panel */}
        {showButtonAudit && (
          <ButtonAuditPanel onClose={() => setShowButtonAudit(false)} />
        )}

        {/* BENTO ROW 1 & ROW 2: Shown in Unified "All Settings Merged" ('general') mode */}
        {activeSettingsTab === 'general' && (
          <form onSubmit={handleSave} className="space-y-4">
            {/* BENTO ROW 1: Left (lg:col-span-7 Merged Appearance + ULM Crest) | Right (lg:col-span-5 Card 2 Institutional Identity) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">

              {/* Left Column (lg:col-span-7) — Merged Card 1: Liquid Glass Appearance, Display Scaling & Official ULM Crest Branding */}
              <div className="lg:col-span-7 ulm-preserve-glass rounded-[22px] p-5 bg-gradient-to-br from-white/80 via-white/65 to-white/50 dark:from-white/[0.075] dark:via-white/[0.03] dark:to-white/[0.015] backdrop-blur-xl backdrop-saturate-[180%] border border-slate-200/85 dark:border-white/[0.14] shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.85),0_8px_24px_rgba(15,23,42,0.05)] dark:shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.22),0_8px_24px_rgba(0,0,0,0.22)] flex flex-col justify-between">
                <div>
                  <AppearanceSettingsTab />
                </div>

                {/* Bottom Integrated Official ULM 2017 Crest Strip */}
                <div className="mt-4 pt-4 border-t border-slate-200/70 dark:border-white/[0.10] flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0 w-12 h-12 rounded-2xl p-1.5 bg-white/85 dark:bg-white/[0.06] border border-amber-500/40 ring-1 ring-amber-500/20 flex items-center justify-center shadow-2xs">
                      <img
                        src={formData.customLogoDataUri || ULM_OFFICIAL_CREST_SRC}
                        alt={formData.university_name || 'University of Lakki Marwat Official 2017 Crest'}
                        width={44}
                        height={44}
                        className="w-10 h-10 object-contain select-none"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-['Plus_Jakarta_Sans'] text-[13px] font-bold text-slate-900 dark:text-white truncate">
                          {formData.university_name || 'University of Lakki Marwat'} LMS
                        </h4>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-['JetBrains_Mono'] font-semibold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/35">
                          {formData.customLogoDataUri ? 'Custom Crest Active' : 'Official 2017 Crest Edition'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        Authentic Crest synced across Splash Gate, App Header, CR80 ID Cards &amp; Watermark.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <label className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-xl bg-white/80 hover:bg-white dark:bg-white/[0.06] dark:hover:bg-white/[0.12] border border-slate-200/90 dark:border-white/[0.14] text-slate-800 dark:text-slate-100 text-[11px] font-bold transition-all cursor-pointer">
                      <span>Upload Custom Crest PNG</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () => {
                            const dataUri = typeof reader.result === 'string' ? reader.result : undefined;
                            if (dataUri) {
                              const updated: SystemSettings = { ...formData, customLogoDataUri: dataUri };
                              setFormData(updated);
                              LibraryStorage.saveSettings(updated);
                              saveInstitutionalIdentity({ customCrestUrl: dataUri });
                              onUpdateSettings(updated);
                              syncAppDesktopAndFaviconIcon(dataUri);
                              setSaveSuccess(true);
                              setInstitutionalSaved(true);
                              setTimeout(() => {
                                setSaveSuccess(false);
                                setInstitutionalSaved(false);
                              }, 2600);
                            }
                          };
                          reader.readAsDataURL(file);
                          e.target.value = '';
                        }}
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => {
                        const updated: SystemSettings = { ...formData, customLogoDataUri: undefined };
                        setFormData(updated);
                        LibraryStorage.saveSettings(updated);
                        saveInstitutionalIdentity({ customCrestUrl: null });
                        onUpdateSettings(updated);
                        syncAppDesktopAndFaviconIcon(ULM_OFFICIAL_CREST_SRC);
                        setSaveSuccess(true);
                        setInstitutionalSaved(true);
                        setTimeout(() => {
                          setSaveSuccess(false);
                          setInstitutionalSaved(false);
                        }, 2600);
                      }}
                      className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-amber-800 dark:text-amber-300 text-[11px] font-bold transition-all cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3 shrink-0" />
                      <span>Reset to Official ULM 2017 Crest</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column (lg:col-span-5) — Card 2: Institutional Identity & Campus Header Details */}
              <div className="lg:col-span-5 ulm-preserve-glass rounded-[22px] p-5 bg-gradient-to-br from-white/80 via-white/65 to-white/50 dark:from-white/[0.075] dark:via-white/[0.03] dark:to-white/[0.015] backdrop-blur-xl backdrop-saturate-[180%] border border-slate-200/85 dark:border-white/[0.14] shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.85),0_8px_24px_rgba(15,23,42,0.05)] dark:shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.22),0_8px_24px_rgba(0,0,0,0.22)] flex flex-col justify-between space-y-4">
                <div className="space-y-4">
                  {/* Card 2 Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200/70 dark:border-white/[0.10]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-['Plus_Jakarta_Sans'] text-[14px] font-bold text-slate-900 dark:text-white leading-tight">
                          Card 2 — Institutional Identity &amp; Campus Header Details
                        </h3>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                          University name, library sub-header, and live contact credentials.
                        </p>
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-md text-[10px] font-['JetBrains_Mono'] font-semibold uppercase tracking-wider bg-white/70 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-white/[0.12]">
                      LIVE HEADER BRANDING
                    </span>
                  </div>

                  {/* 2-Column Form Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1 block">
                        University / Institution Name <span className="text-amber-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.university_name}
                        onChange={(e) => setFormData({ ...formData, university_name: e.target.value })}
                        placeholder="e.g. University of Lakki Marwat"
                        className="w-full h-9 px-3 rounded-xl bg-white/75 dark:bg-white/[0.045] border border-slate-300/85 dark:border-white/[0.14] text-slate-900 dark:text-white text-[12px] focus:border-amber-500/60 outline-none transition-colors"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1 block">
                        Library Facility / Department Name <span className="text-amber-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.library_name}
                        onChange={(e) => setFormData({ ...formData, library_name: e.target.value })}
                        placeholder="e.g. Central Campus Library"
                        className="w-full h-9 px-3 rounded-xl bg-white/75 dark:bg-white/[0.045] border border-slate-300/85 dark:border-white/[0.14] text-slate-900 dark:text-white text-[12px] focus:border-amber-500/60 outline-none transition-colors"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1 block">
                        Campus Physical Address
                      </label>
                      <input
                        type="text"
                        value={formData.campus_address}
                        onChange={(e) => setFormData({ ...formData, campus_address: e.target.value })}
                        placeholder="e.g. Main Campus, Bannu-Mianwali Road, Lakki Marwat, KPK, Pakistan"
                        className="w-full h-9 px-3 rounded-xl bg-white/75 dark:bg-white/[0.045] border border-slate-300/85 dark:border-white/[0.14] text-slate-900 dark:text-white text-[12px] focus:border-amber-500/60 outline-none transition-colors"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1 block">
                        Official Contact Phone
                      </label>
                      <input
                        type="text"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="e.g. +92-969-510015"
                        className="w-full h-9 px-3 rounded-xl bg-white/75 dark:bg-white/[0.045] border border-slate-300/85 dark:border-white/[0.14] text-slate-900 dark:text-white text-[12px] font-['JetBrains_Mono'] focus:border-amber-500/60 outline-none transition-colors"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1 block">
                        Official Circulation Email
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="e.g. library@ulm.edu.pk"
                        className="w-full h-9 px-3 rounded-xl bg-white/75 dark:bg-white/[0.045] border border-slate-300/85 dark:border-white/[0.14] text-slate-900 dark:text-white text-[12px] font-['JetBrains_Mono'] focus:border-amber-500/60 outline-none transition-colors"
                      />
                    </div>
                  </div>

                  {/* Compact Live Title Bar & Header Preview Strip */}
                  <div className="p-3 rounded-xl border border-slate-200/80 dark:border-white/[0.10] bg-white/60 dark:bg-white/[0.035] space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-['JetBrains_Mono'] uppercase tracking-wider text-amber-700 dark:text-amber-300 font-semibold">
                      <Sparkles className="w-3 h-3" />
                      <span>Live Title Bar &amp; Header Preview</span>
                    </div>
                    <div className="flex items-center gap-2 text-[12px] text-slate-900 dark:text-white truncate">
                      <span className="font-bold font-cinzel tracking-wide text-slate-900 dark:text-white truncate">
                        {formData.university_name.trim() || 'University of Lakki Marwat'}
                      </span>
                      <span className="text-amber-500 font-sans">|</span>
                      <span className="text-slate-700 dark:text-amber-300 font-cinzel text-[11px] truncate">
                        {formData.library_name.trim() || 'Central Campus Library'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Apply Details Footer */}
                <div className="pt-3 border-t border-slate-200/70 dark:border-white/[0.10] flex flex-wrap items-center justify-between gap-2.5">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Synchronize headers &amp; title bars live across workstation.
                  </span>

                  <div className="flex items-center gap-2">
                    {institutionalSaved && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 px-2.5 py-1 rounded-lg border border-emerald-500/30">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>✓ App Name, Header &amp; Splash Branding Synchronized!</span>
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={handleSave}
                      className="h-9 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-[11px] uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
                    >
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Apply Details to App</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* BENTO ROW 2: Left (lg:col-span-5 Card 3 Barcode Scanner) | Right (lg:col-span-7 Card 4 Library Folder Storage & Data Maintenance) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">

              {/* Left Column (lg:col-span-5) — Card 3: Barcode Scanner & Peripherals */}
              <div className="lg:col-span-5 ulm-preserve-glass rounded-[22px] p-5 bg-gradient-to-br from-white/80 via-white/65 to-white/50 dark:from-white/[0.075] dark:via-white/[0.03] dark:to-white/[0.015] backdrop-blur-xl backdrop-saturate-[180%] border border-slate-200/85 dark:border-white/[0.14] shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.85),0_8px_24px_rgba(15,23,42,0.05)] dark:shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.22),0_8px_24px_rgba(0,0,0,0.22)] flex flex-col justify-between space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200/70 dark:border-white/[0.10]">
                    <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0">
                      <Volume2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-['Plus_Jakarta_Sans'] text-[14px] font-bold text-slate-900 dark:text-white leading-tight">
                        Card 3 — Barcode Scanner &amp; Peripherals
                      </h3>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                        Hardware audio triggers, auto-submission, and workstation node tagging.
                      </p>
                    </div>
                  </div>

                  {/* 2-Column Frosted Toggle Tiles */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <label className="flex items-center justify-between gap-2 p-3 rounded-xl border border-slate-200/80 dark:border-white/[0.10] bg-white/65 dark:bg-white/[0.035] hover:border-amber-500/40 transition-colors cursor-pointer">
                      <div className="min-w-0">
                        <p className="text-[12px] font-bold text-slate-900 dark:text-white truncate">Hardware Audio Feedback</p>
                        <p className="text-[10.5px] text-slate-500 dark:text-slate-400 truncate">Chirp on barcode detection</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={formData.scanner_sound}
                        onChange={(e) => setFormData({ ...formData, scanner_sound: e.target.checked })}
                        className="w-4 h-4 rounded accent-amber-500 cursor-pointer shrink-0"
                      />
                    </label>

                    <label className="flex items-center justify-between gap-2 p-3 rounded-xl border border-slate-200/80 dark:border-white/[0.10] bg-white/65 dark:bg-white/[0.035] hover:border-amber-500/40 transition-colors cursor-pointer">
                      <div className="min-w-0">
                        <p className="text-[12px] font-bold text-slate-900 dark:text-white truncate">Auto-Submit Scan</p>
                        <p className="text-[10.5px] text-slate-500 dark:text-slate-400 truncate">Execute on 13-digit EAN</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={formData.auto_submit_scan}
                        onChange={(e) => setFormData({ ...formData, auto_submit_scan: e.target.checked })}
                        className="w-4 h-4 rounded accent-amber-500 cursor-pointer shrink-0"
                      />
                    </label>
                  </div>

                  {/* 2x2 Compact Input Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1 block">
                        Workstation Node ID
                      </label>
                      <input
                        type="text"
                        value={formData.station_id}
                        onChange={(e) => setFormData({ ...formData, station_id: e.target.value })}
                        className="w-full h-9 px-3 rounded-xl bg-white/75 dark:bg-white/[0.045] border border-slate-300/85 dark:border-white/[0.14] font-['JetBrains_Mono'] text-slate-900 dark:text-white text-[12px] focus:border-amber-500/60 outline-none transition-colors"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1 block">
                        Windows Title Bar Badge
                      </label>
                      <div className="px-3 h-9 rounded-xl border border-slate-200/85 dark:border-white/[0.12] text-[11px] font-['JetBrains_Mono'] bg-white/60 dark:bg-white/[0.035] text-slate-600 dark:text-slate-400 flex items-center justify-between">
                        <span className="truncate">Top bar node:</span>
                        <span className="text-amber-700 dark:text-amber-300 font-bold px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30">
                          {formData.station_id}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1 block">
                        Institutional Barcode Prefix
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
                        className="w-full h-9 px-3 rounded-xl bg-white/75 dark:bg-white/[0.045] border border-slate-300/85 dark:border-white/[0.14] font-['JetBrains_Mono'] text-slate-900 dark:text-amber-300 font-bold text-[12px] focus:border-amber-500/60 outline-none transition-colors uppercase"
                      />
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                        Format: <span className="font-['JetBrains_Mono'] text-slate-800 dark:text-white">{formData.barcode_prefix || 'ULM'}-00123</span>
                      </p>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1 block">
                        First Accession Number
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={formData.first_accession_number || 1}
                        onChange={(e) => {
                          const num = parseInt(e.target.value, 10);
                          setFormData({ ...formData, first_accession_number: isNaN(num) || num < 1 ? 1 : num });
                        }}
                        className="w-full h-9 px-3 rounded-xl bg-white/75 dark:bg-white/[0.045] border border-slate-300/85 dark:border-white/[0.14] font-['JetBrains_Mono'] text-slate-900 dark:text-amber-300 font-bold text-[12px] focus:border-amber-500/60 outline-none transition-colors"
                      />
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                        Starting catalog sequence number.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Full-width Auto-Backfill Barcodes Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleBackfillBarcodes}
                    disabled={isBackfilling}
                    className="w-full h-10 px-4 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 dark:bg-purple-500/20 dark:hover:bg-purple-500/30 text-purple-900 dark:text-purple-200 border border-purple-500/35 text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60 shadow-2xs"
                    title="Generate institutional barcodes for any volumes missing a barcode"
                  >
                    {isBackfilling ? (
                      <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                    ) : (
                      <Barcode className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    )}
                    <span>{isBackfilling ? 'Assigning Barcodes...' : 'Auto-Backfill Barcodes'}</span>
                  </button>
                  {backfillMessage && (
                    <p className="text-[10.5px] text-emerald-600 dark:text-emerald-400 mt-1.5 font-['JetBrains_Mono'] text-center">
                      {backfillMessage}
                    </p>
                  )}
                </div>
              </div>

              {/* Right Column (lg:col-span-7) — Card 4: Library Folder Storage & Data Maintenance */}
              <div className="lg:col-span-7 ulm-preserve-glass rounded-[22px] p-5 bg-gradient-to-br from-white/80 via-white/65 to-white/50 dark:from-white/[0.075] dark:via-white/[0.03] dark:to-white/[0.015] backdrop-blur-xl backdrop-saturate-[180%] border border-slate-200/85 dark:border-white/[0.14] shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.85),0_8px_24px_rgba(15,23,42,0.05)] dark:shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.22),0_8px_24px_rgba(0,0,0,0.22)] flex flex-col justify-between space-y-4">
                <div className="space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200/70 dark:border-white/[0.10]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                        <HardDrive className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-['Plus_Jakarta_Sans'] text-[14px] font-bold text-slate-900 dark:text-white leading-tight">
                          Card 4 — Library Folder Storage &amp; Data Maintenance
                        </h3>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                          Primary database file (Library.ulmlib), linked Excel book entry sheet, and reset controls.
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-['JetBrains_Mono'] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                      <span className="w-1.5 h-1.5 rounded-xs bg-emerald-500" />
                      <span>OFFLINE SECURE · DATABASE MOUNTED</span>
                    </span>
                  </div>

                  {/* Top 3-Column Telemetry Strip */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="bg-white/60 dark:bg-white/[0.035] border border-slate-200/80 dark:border-white/[0.10] rounded-xl p-3 space-y-0.5">
                      <span className="text-[9.5px] font-['JetBrains_Mono'] uppercase tracking-wider text-slate-500 dark:text-slate-400 block font-bold">
                        CURRENT LOCATION
                      </span>
                      <span
                        className="text-[11px] font-['JetBrains_Mono'] font-semibold text-sky-700 dark:text-sky-300 truncate block"
                        title={realStorageStatus?.folderPath || currentDbPath}
                      >
                        {realStorageStatus?.folderPath || currentDbPath}
                      </span>
                    </div>

                    <div className="bg-white/60 dark:bg-white/[0.035] border border-slate-200/80 dark:border-white/[0.10] rounded-xl p-3 space-y-0.5">
                      <span className="text-[9.5px] font-['JetBrains_Mono'] uppercase tracking-wider text-slate-500 dark:text-slate-400 block font-bold">
                        FILE SIZE
                      </span>
                      <span className="text-[11px] font-['JetBrains_Mono'] font-bold text-slate-900 dark:text-white truncate block">
                        {realStorageStatus && realStorageStatus.fileSizeBytes > 0
                          ? `${(realStorageStatus.fileSizeBytes / 1024).toFixed(1)} KB (${realStorageStatus.fileSizeBytes.toLocaleString()} B)`
                          : 'Verified SQLite File'}
                      </span>
                    </div>

                    <div className="bg-white/60 dark:bg-white/[0.035] border border-slate-200/80 dark:border-white/[0.10] rounded-xl p-3 space-y-0.5">
                      <span className="text-[9.5px] font-['JetBrains_Mono'] uppercase tracking-wider text-slate-500 dark:text-slate-400 block font-bold">
                        LAST SAVED
                      </span>
                      <span className="text-[11px] font-['JetBrains_Mono'] font-semibold text-emerald-700 dark:text-emerald-300 truncate block">
                        {realStorageStatus?.lastSavedIso
                          ? new Date(realStorageStatus.lastSavedIso).toLocaleDateString() + ' ' + new Date(realStorageStatus.lastSavedIso).toLocaleTimeString()
                          : 'Active Session'}
                      </span>
                    </div>
                  </div>

                  {/* Single-Row Compact Action Bar */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleOpenFolder}
                      className="h-9 px-3 rounded-xl text-[11px] font-bold uppercase tracking-wider border border-slate-200/90 dark:border-white/[0.12] bg-white/75 hover:bg-white dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-800 dark:text-slate-200 transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                    >
                      <Folder className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                      <span>Open Folder</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleChangeLocation}
                      disabled={isChangingLocation}
                      className="h-9 px-3 rounded-xl text-[11px] font-bold uppercase tracking-wider border border-slate-200/90 dark:border-white/[0.12] bg-white/75 hover:bg-white dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-800 dark:text-slate-200 transition-all cursor-pointer flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                    >
                      {isChangingLocation ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                      ) : (
                        <ArrowRightLeft className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      )}
                      <span>Change Location</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCheckLibraryFile}
                      disabled={isCheckingLibraryFile}
                      className="h-9 px-3 rounded-xl text-[11px] font-bold uppercase tracking-wider border border-slate-200/90 dark:border-white/[0.12] bg-white/75 hover:bg-white dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-800 dark:text-slate-200 transition-all cursor-pointer flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                    >
                      {isCheckingLibraryFile ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                      ) : (
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      )}
                      <span>Check Library File</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCopyPath}
                      className="h-9 px-3 rounded-xl text-[11px] font-bold uppercase tracking-wider border border-slate-200/90 dark:border-white/[0.12] bg-white/75 hover:bg-white dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-800 dark:text-slate-200 transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                    >
                      {copiedPath ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 stroke-[2.5]" />
                          <span className="text-emerald-700 dark:text-emerald-300 font-bold">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-500" />
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
                      className="h-9 px-3 rounded-xl text-[11px] font-bold uppercase tracking-wider border border-slate-200/90 dark:border-white/[0.12] bg-white/75 hover:bg-white dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-800 dark:text-slate-200 transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Sync Master Excel</span>
                    </button>
                  </div>

                  {/* Quick Check Result Banner */}
                  {quickCheckInfo?.open && (
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-slate-800 dark:text-slate-200 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 font-['JetBrains_Mono']">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>
                          SQLite Integrity: <strong>{quickCheckInfo.passed ? 'OK' : 'WARN'}</strong> · Books: {quickCheckInfo.booksCount} · Members: {quickCheckInfo.borrowersCount} · Loans: {quickCheckInfo.loansCount}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setQuickCheckInfo(null)}
                        className="text-slate-500 hover:text-slate-900 dark:hover:text-white text-[10px] font-bold cursor-pointer"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}

                  {locationNotice && (
                    <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/35 text-amber-900 dark:text-amber-200 text-[11px] flex items-center gap-2">
                      <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>{locationNotice}</span>
                    </div>
                  )}
                </div>

                {/* Bottom 2-Column Danger/Maintenance Grid */}
                <div className="pt-3 border-t border-slate-200/70 dark:border-white/[0.10] space-y-2.5">
                  <h4 className="text-[10.5px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Data Maintenance &amp; Reset Control
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Action 1: Clear Demo Data */}
                    <div className="bg-amber-500/[0.06] dark:bg-amber-500/[0.08] border border-amber-500/30 rounded-2xl p-3.5 flex flex-col justify-between space-y-2.5">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-amber-900 dark:text-amber-300">
                          <Trash2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                          <h5 className="text-[11px] font-bold uppercase tracking-wider">Action 1: Clear Demo Data</h5>
                        </div>
                        <p className="text-[11px] text-amber-900/85 dark:text-amber-200/80 leading-relaxed">
                          Removes <strong>ONLY</strong> sample/demo records. Real catalog books &amp; loans stay untouched.
                        </p>
                      </div>

                      <div>
                        <button
                          type="button"
                          onClick={() => setConfirmClearDemo(true)}
                          className="h-9 px-3.5 rounded-xl border border-amber-500/45 bg-white/80 hover:bg-amber-50 dark:bg-amber-500/20 dark:hover:bg-amber-500/30 text-amber-900 dark:text-amber-200 text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          <span>Clear Demo Data</span>
                        </button>
                      </div>
                    </div>

                    {/* Action 2: Reset App / Clear All Data */}
                    <div className="bg-rose-500/[0.06] dark:bg-rose-500/[0.08] border border-rose-500/30 rounded-2xl p-3.5 flex flex-col justify-between space-y-2.5">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-rose-900 dark:text-rose-300">
                          <ShieldAlert className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                          <h5 className="text-[11px] font-bold uppercase tracking-wider">Action 2: Reset App / Clear All Data</h5>
                        </div>
                        <p className="text-[11px] text-rose-900/85 dark:text-rose-200/80 leading-relaxed">
                          Clears SQLite tables, resets catalog to strictly 0 books, and opens Setup Gate.
                        </p>
                      </div>

                      <div>
                        <button
                          type="button"
                          onClick={() => setIsResetToZeroModalOpen(true)}
                          className="h-9 px-3.5 rounded-xl border border-rose-500/45 bg-white/80 hover:bg-rose-50 dark:bg-rose-500/20 dark:hover:bg-rose-500/30 text-rose-900 dark:text-rose-200 text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                          <span>Reset App / Clear All Data</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </form>
        )}

        {/* BENTO ROW 3: Left (lg:col-span-5 Book Groups) | Right (lg:col-span-7 Almaris & Master Almari Plan) */}
        {activeSettingsTab === 'general' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            <div className="lg:col-span-5">
              <GroupsSettingsTab />
            </div>
            <div className="lg:col-span-7">
              <AlmarisSettingsTab />
            </div>
          </div>
        )}

        {activeSettingsTab === 'groups' && (
          <div className="animate-in fade-in duration-150">
            <GroupsSettingsTab />
          </div>
        )}

        {activeSettingsTab === 'almaris' && (
          <div className="animate-in fade-in duration-150">
            <AlmarisSettingsTab />
          </div>
        )}

        {/* Clear Demo Data Full-Viewport Portal Modal */}
        {confirmClearDemo && typeof document !== 'undefined' && createPortal(
          <div
            className="fixed inset-0 z-[9999] w-screen h-screen flex items-center justify-center p-4 sm:p-6 bg-slate-900/35 dark:bg-[#090514]/80 backdrop-blur-xl backdrop-saturate-[180%] animate-in fade-in duration-150"
            onClick={() => setConfirmClearDemo(false)}
          >
            <div
              className="ulm-preserve-glass relative w-full max-w-md rounded-[26px] p-6 bg-gradient-to-br from-white/95 via-white/90 to-white/85 dark:from-[#170F2A]/95 dark:via-[#120B22]/90 dark:to-[#0D0819]/90 backdrop-blur-2xl backdrop-saturate-[200%] border border-amber-500/40 shadow-[0_24px_64px_rgba(15,23,42,0.28)] dark:shadow-[0_24px_64px_rgba(0,0,0,0.65)] space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/35 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-['Plus_Jakarta_Sans'] text-[16px] font-bold text-slate-900 dark:text-white">
                    Clear Sample / Demo Data?
                  </h4>
                  <p className="text-[11.5px] text-slate-600 dark:text-slate-400">
                    Removes only sample catalog books, demo members, and demo loans.
                  </p>
                </div>
              </div>

              <p className="text-[12px] text-slate-700 dark:text-slate-300 leading-relaxed bg-amber-500/[0.08] border border-amber-500/25 rounded-xl p-3">
                Your real library catalog records, institutional settings, and custom cupboards will remain <strong>100% untouched</strong>.
              </p>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmClearDemo(false)}
                  className="h-9 px-4 rounded-xl bg-white/75 hover:bg-white dark:bg-white/[0.06] dark:hover:bg-white/[0.12] border border-slate-300/80 dark:border-white/[0.12] text-slate-700 dark:text-slate-200 text-[12px] font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onClearDemoData) onClearDemoData();
                    else {
                      LibraryStorage.clearDemoData();
                    }
                    setConfirmClearDemo(false);
                  }}
                  className="h-9 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-[12px] font-bold cursor-pointer shadow-sm"
                >
                  Confirm Clear Demo Data
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Reset to Zero Danger Modal (already portals to document.body) */}
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

