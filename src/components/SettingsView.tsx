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
import { ULM_OFFICIAL_CREST_SRC, syncAppDesktopAndFaviconIcon } from '../constants/ulmOfficialAssets';
import { ButtonAuditPanel } from './ui/ButtonAuditPanel';
import { LiquidPillOverlay } from './ui/liquid-pill-physics';
import { GroupsSettingsTab } from './settings/GroupsSettingsTab';
import { AlmarisSettingsTab } from './settings/AlmarisSettingsTab';
import { AppearanceSettingsTab } from './settings/AppearanceSettingsTab';
import { saveInstitutionalIdentity } from '../utils/themeTransition';
import { AlmariService } from '../services/almariService';
import { syncMasterExcelToDisk } from '../services/masterExcelSync';
import {
  isDesktopRuntime,
  getRepoPath,
  openRepoFolder,
  checkDiskFile,
  saveRepoDirHandle,
} from '../services/desktopBridge';
import { idbSet } from '../services/indexedDbStorage';
import { notifyGlassToast } from './ui/LiquidGlassToast';

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
  const [activeSettingsTab, setActiveSettingsTab] = useState<'general' | 'groups' | 'almaris'>('general');
  const [settingsSection, setSettingsSection] = useState<'branding' | 'hardware' | 'groups' | 'almaris'>('branding');
  const [settingsNavAnimTick, setSettingsNavAnimTick] = useState(1);
  const settingsNavRef = React.useRef<HTMLElement | null>(null);
  const settingsNavItemRefs = React.useRef<Record<string, HTMLElement | null>>({});
  const [taxonomyTick, setTaxonomyTick] = useState(0);
  const folderInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleSelectSettingsSection = (section: 'branding' | 'hardware' | 'groups' | 'almaris') => {
    setSettingsSection(section);
    setSettingsNavAnimTick((t) => t + 1);
  };

  useEffect(() => {
    const syncTaxonomyCounts = () => setTaxonomyTick((t) => t + 1);
    window.addEventListener('ulm-library-sync', syncTaxonomyCounts);
    window.addEventListener('ulm-library-data-changed', syncTaxonomyCounts);
    return () => {
      window.removeEventListener('ulm-library-sync', syncTaxonomyCounts);
      window.removeEventListener('ulm-library-data-changed', syncTaxonomyCounts);
    };
  }, []);

  const bookGroups = React.useMemo(() => AlmariService.getGroups(), [taxonomyTick]);
  const almaris = React.useMemo(() => AlmariService.getAlmaris(), [taxonomyTick]);

  useEffect(() => {
    const el = folderInputRef.current;
    if (el) {
      (el as any).webkitdirectory = true;
      el.setAttribute('webkitdirectory', '');
      el.setAttribute('directory', '');
    }
  }, []);

  // Barcode & Transfer Actions State
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [backfillMessage, setBackfillMessage] = useState<string | null>(null);
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [showButtonAudit, setShowButtonAudit] = useState(false);

  const [desktopRepoPath, setDesktopRepoPath] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem('ulm_library_repo_path_v1');
      if (saved && saved.trim()) return saved.trim();
    } catch {}
    const loc = LibraryStorage.getStorageLocation();
    return loc.folderPath && loc.folderPath.trim() ? loc.folderPath.trim() : null;
  });
  const storageConfig = LibraryStorage.getStorageLocation();
  const effectiveFolderPath = desktopRepoPath || storageConfig.folderPath || 'Documents\\ULM Library';
  const currentDbPath = effectiveFolderPath
    ? `${effectiveFolderPath}\\Library.ulmlib`
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
    const hasSavedRepoPath = (() => {
      try {
        return Boolean(localStorage.getItem('ulm_library_repo_path_v1')?.trim());
      } catch {
        return false;
      }
    })();
    if (isDesktopRuntime() && !hasSavedRepoPath) {
      getRepoPath()
        .then((p) => {
          if (p && p.trim()) setDesktopRepoPath(p.trim());
        })
        .catch(() => {});
    }

    const onRepoPathSync = (ev: Event) => {
      const nextPath = (ev as CustomEvent<{ path?: string }>).detail?.path;
      if (typeof nextPath === 'string' && nextPath.trim()) {
        setDesktopRepoPath(nextPath.trim());
      } else {
        try {
          const saved = localStorage.getItem('ulm_library_repo_path_v1');
          if (saved && saved.trim()) setDesktopRepoPath(saved.trim());
        } catch {}
      }
    };

    const onStorageSync = (ev: StorageEvent) => {
      if (ev.key === 'ulm_library_repo_path_v1' && ev.newValue && ev.newValue.trim()) {
        setDesktopRepoPath(ev.newValue.trim());
      }
    };

    window.addEventListener('ulm-repo-path-sync', onRepoPathSync);
    window.addEventListener('storage', onStorageSync);
    return () => {
      window.removeEventListener('ulm-repo-path-sync', onRepoPathSync);
      window.removeEventListener('storage', onStorageSync);
    };
  }, []);

  const applySelectedLocationPath = async (selectedPath: string, noticeSuffix?: string) => {
    const cleanPath = (selectedPath || '').trim() || 'Documents\\ULM Library Data';
    setDesktopRepoPath(cleanPath);
    try {
      localStorage.setItem('ulm_library_repo_path_v1', cleanPath);
      const loc = LibraryStorage.getStorageLocation();
      LibraryStorage.saveStorageLocation({
        ...loc,
        folderPath: cleanPath,
        isConfigured: true,
      });
      const updatedSettings: SystemSettings = {
        ...formData,
        db_path: `${cleanPath}\\Library.ulmlib`,
      };
      setFormData(updatedSettings);
      LibraryStorage.saveSettings(updatedSettings);
      onUpdateSettings(updatedSettings);
    } catch {}
    window.dispatchEvent(new CustomEvent('ulm-repo-path-sync', { detail: { path: cleanPath } }));
    await syncMasterExcelToDisk(
      LibraryStorage.getBooks(),
      LibraryStorage.getBorrowers(),
      LibraryStorage.getTransactions(),
      AlmariService.getAlmaris()
    ).catch(() => {});
    setLocationNotice(
      noticeSuffix
        ? `✓ Path updated · ${cleanPath} ${noticeSuffix}`
        : `✓ Path updated · ${cleanPath}`
    );
    await refreshRealStorageStatus();
    notifyGlassToast({
      type: 'success',
      title: 'Repository Folder Updated',
      message: noticeSuffix ? `Path saved (${noticeSuffix.replace(/^·\s*/, '')}).` : 'Library repository folder updated.',
      meta: cleanPath,
    });
    setTimeout(() => setLocationNotice(null), 5000);
  };

  // Synchronous Windows File Explorer Folder Picker (Zero await before .click() to preserve user-gesture!)
  const handleChangeLocation = () => {
    // 1. Native Windows Desktop .exe (C# WPF + WebView2 / Electron)
    const nativeApi = (window as any).desktopAPI || (window as any).electronAPI;
    if (nativeApi?.selectLibraryFolder || nativeApi?.selectFolder) {
      setIsChangingLocation(true);
      const call = nativeApi.selectLibraryFolder
        ? nativeApi.selectLibraryFolder()
        : nativeApi.selectFolder();
      Promise.resolve(call)
        .then((res: any) => {
          const selectedPath =
            typeof res === 'string'
              ? res.trim()
              : res && !res.canceled && typeof res.path === 'string'
              ? res.path.trim()
              : '';
          if (selectedPath) {
            void applySelectedLocationPath(selectedPath);
          } else {
            setLocationNotice('Folder selection canceled.');
            setTimeout(() => setLocationNotice(null), 3500);
          }
        })
        .catch(() => {})
        .finally(() => setIsChangingLocation(false));
      return;
    }

    if ((window as any).ulmLibraryApi?.selectCustomDataFolder) {
      setIsChangingLocation(true);
      Promise.resolve((window as any).ulmLibraryApi.selectCustomDataFolder())
        .then((res: any) => {
          if (res && !res.canceled && res.activeDataDir) {
            void applySelectedLocationPath(res.activeDataDir);
          }
        })
        .catch(() => {})
        .finally(() => setIsChangingLocation(false));
      return;
    }

    // 2. Standalone Browser Tab (NOT inside a cross-origin iframe)
    let isInIframe = true;
    try {
      isInIframe = window.self !== window.top;
    } catch {
      isInIframe = true;
    }
    if (!isInIframe && typeof (window as any).showDirectoryPicker === 'function') {
      setIsChangingLocation(true);
      (window as any)
        .showDirectoryPicker({ mode: 'readwrite' })
        .then(async (dirHandle: any) => {
          if (dirHandle?.name) {
            await idbSet('ulm_repo_dir_handle', dirHandle).catch(() => {});
            await saveRepoDirHandle(dirHandle).catch(() => {});
            await applySelectedLocationPath(`Documents\\${dirHandle.name}`, '· Master Excel synced');
          }
        })
        .catch((err: any) => {
          if (err?.name === 'AbortError') {
            setLocationNotice('Folder selection canceled.');
            setTimeout(() => setLocationNotice(null), 3500);
          }
        })
        .finally(() => setIsChangingLocation(false));
      return;
    }

    // 3. Inside Google AI Studio Preview Iframe (or Firefox/Safari):
    // Fire .click() SYNCHRONOUSLY inside the click handler with ZERO await!
    const el = folderInputRef.current;
    if (el) {
      (el as any).webkitdirectory = true;
      el.setAttribute('webkitdirectory', '');
      el.setAttribute('directory', '');
      el.value = '';
      el.click();
    } else if (onOpenStorageModal) {
      onOpenStorageModal();
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

      let diskFileInfo: { exists: boolean; sizeBytes: number; lastModified: string | null; fullPath?: string } | null = null;
      if (isDesktopRuntime()) {
        diskFileInfo = await checkDiskFile('Library.ulmlib');
      }

      const resolvedSize = diskFileInfo?.exists ? diskFileInfo.sizeBytes : st.fileSizeBytes;
      const resolvedLastSaved = diskFileInfo?.exists ? diskFileInfo.lastModified : st.lastSavedIso;
      const resolvedMessage = diskFileInfo
        ? diskFileInfo.exists
          ? `${st.quickCheckMessage} — Verified on disk (${diskFileInfo.fullPath || currentDbPath})`
          : `${st.quickCheckMessage} — Desktop repository file ready for initial sync`
        : st.quickCheckMessage;

      setQuickCheckInfo({
        open: true,
        passed: st.quickCheckOk,
        message: resolvedMessage,
        journalMode: st.journalMode,
        synchronous: 'FULL',
        foreignKeys: true,
        fileSizeBytes: resolvedSize,
        lastSaved: resolvedLastSaved,
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
        notifyGlassToast({
          type: 'info',
          title: 'Catalog Snapshot Restored',
          message: res.message,
        });
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } else {
        setUndoNotice(`Undo failed: ${res.message}`);
        notifyGlassToast({
          type: 'danger',
          title: 'Undo Reset Failed',
          message: res.message,
        });
      }
    } catch (err: any) {
      setUndoNotice(`Undo failed: ${err.message}`);
      notifyGlassToast({
        type: 'danger',
        title: 'Undo Reset Failed',
        message: err.message,
      });
    } finally {
      setIsUndoingReset(false);
    }
  };

  const folderStatus = LibraryFolderService.getFolderStatus();

  useEffect(() => {
    setFormData({ ...settings });
  }, [settings]);

  const [copiedCoreDoc, setCopiedCoreDoc] = useState(false);

  const handleCopyPath = async () => {
    try {
      const pathToCopy = isDesktopRuntime()
        ? `${await getRepoPath()}\\Library.ulmlib`
        : currentDbPath;
      await navigator.clipboard.writeText(pathToCopy);
      setCopiedPath(true);
      notifyGlassToast({
        type: 'info',
        title: 'Database Path Copied',
        message: 'Copied storage file path to clipboard.',
        meta: pathToCopy,
      });
      setTimeout(() => setCopiedPath(false), 2000);
    } catch {
      // Fallback when clipboard permissions are unavailable
    }
  };

  const handleCopyCoreDoc = async () => {
    const ok = await CoreSystemDocService.copyToClipboard();
    if (ok) {
      setCopiedCoreDoc(true);
      notifyGlassToast({
        type: 'info',
        title: 'System Doc Copied',
        message: 'Core system documentation copied to clipboard.',
      });
      setTimeout(() => setCopiedCoreDoc(false), 2500);
    }
  };

  const handleDownloadCoreDoc = () => {
    CoreSystemDocService.downloadMarkdownFile();
    notifyGlassToast({
      type: 'info',
      title: 'Documentation Downloaded',
      message: 'Saved core system documentation markdown file.',
    });
  };

  const handleOpenFolder = async () => {
    const targetFolder = effectiveFolderPath || 'Documents\\ULM Library';
    if (isDesktopRuntime()) {
      const opened = await openRepoFolder(targetFolder);
      if (opened) {
        setMoveNotice(`Opened Windows Explorer at "${targetFolder}"`);
        notifyGlassToast({
          type: 'info',
          title: 'Library Folder Opened',
          message: 'Opened repository folder in Windows Explorer.',
          meta: targetFolder,
        });
        setTimeout(() => setMoveNotice(null), 4000);
        return;
      }
    }
    setMoveNotice(`Library Folder: "${targetFolder}" (contains Library.ulmlib, Book Sheet, Data Files, Backups)`);
    notifyGlassToast({
      type: 'info',
      title: 'Repository Folder Path',
      message: 'Contains Library.ulmlib, Book Sheet, Data Files, and Backups.',
      meta: targetFolder,
    });
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
        notifyGlassToast({
          type: 'success',
          title: 'Transfer Package Exported',
          message: 'Packaged database, book sheet, data files, and assets.',
          meta: res.filename,
        });
      } else {
        setPackageNotice(`Export notice: ${res.message}`);
        notifyGlassToast({
          type: 'warning',
          title: 'Package Export Notice',
          message: res.message,
        });
      }
    } catch (e: any) {
      setPackageNotice(`Export failed: ${e.message}`);
      notifyGlassToast({
        type: 'danger',
        title: 'Package Export Failed',
        message: e.message,
      });
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
        notifyGlassToast({
          type: 'danger',
          title: 'Invalid Backup Package',
          message: val.errors.join(' | '),
          meta: file.name,
        });
        return;
      }
      const res = await UsbBackupService.importFromUsb(bytes, 'REPLACE', (pct, stage) => {
        setPackageNotice(`${stage} (${pct}%)`);
      });
      if (res.success) {
        await LibraryFolderService.saveDatabaseFile();
        await LibraryFolderService.refreshDataFiles(true);
        setPackageNotice(res.message);
        notifyGlassToast({
          type: 'success',
          title: 'Backup Package Restored',
          message: res.message,
          meta: file.name,
        });
      } else {
        setPackageNotice(res.message);
        notifyGlassToast({
          type: 'danger',
          title: 'Package Restore Notice',
          message: res.message,
          meta: file.name,
        });
      }
    } catch (e: any) {
      setPackageNotice(`Package restore failed: ${e.message}`);
      notifyGlassToast({
        type: 'danger',
        title: 'Package Restore Failed',
        message: e.message,
        meta: file.name,
      });
    } finally {
      setTimeout(() => setPackageNotice(null), 5000);
    }
  };

  const handleBackupNow = async () => {
    setIsBackingUpNow(true);
    try {
      await LibraryFolderService.createAutoBackup();
      setPackageNotice('Saved safety backup to Backups\\ subfolder (maintaining up to 14 rolling backups).');
      notifyGlassToast({
        type: 'success',
        title: 'Safety Backup Saved',
        message: 'Created rolling snapshot in Backups\\ subfolder.',
      });
    } catch (e: any) {
      setPackageNotice(`Backup notice: ${e.message}`);
      notifyGlassToast({
        type: 'danger',
        title: 'Safety Backup Failed',
        message: e.message,
      });
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
      notifyGlassToast({
        type: 'info',
        title: 'Data Files Refreshed',
        message: res.message,
      });
    } catch (e: any) {
      setPackageNotice(`Data files refresh error: ${e.message}`);
      notifyGlassToast({
        type: 'danger',
        title: 'Data Files Refresh Failed',
        message: e.message,
      });
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
    notifyGlassToast({
      type: 'success',
      title: 'Preferences & Branding Saved',
      message: 'Workstation appearance, scaling, and institutional identity synchronized.',
      meta: `${syncedIdentity.universityName} · Node ${updated.station_id || 'ULM-01'}`,
    });
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
    const fileName = `ULM_LMS_Database_Snapshot_${new Date().toISOString().split('T')[0]}.json`;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    notifyGlassToast({
      type: 'success',
      title: 'Database Snapshot Saved',
      message: 'Exported complete JSON library database snapshot.',
      meta: fileName,
    });
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
        notifyGlassToast({
          type: 'info',
          title: 'Barcode Backfill Complete',
          message: `${res.backfilledCount} volumes assigned institutional 0092 barcodes.`,
        });
      } else {
        setBackfillMessage(`Notice: ${res.message}`);
        notifyGlassToast({
          type: 'warning',
          title: 'Barcode Backfill Notice',
          message: res.message,
        });
      }
    } catch (e: any) {
      setBackfillMessage(`Error: ${e.message}`);
      notifyGlassToast({
        type: 'danger',
        title: 'Barcode Backfill Failed',
        message: e.message,
      });
    } finally {
      setIsBackfilling(false);
      setTimeout(() => setBackfillMessage(null), 5000);
    }
  };

  const handleDownloadLibraryData = async () => {
    try {
      await LibraryDataFilesService.downloadLibraryDataXlsx();
      setMoveNotice('Downloaded comprehensive LibraryData.xlsx workbook.');
      notifyGlassToast({
        type: 'success',
        title: 'Library Workbook Exported',
        message: 'Downloaded comprehensive LibraryData.xlsx workbook.',
        meta: 'LibraryData.xlsx',
      });
      setTimeout(() => setMoveNotice(null), 3500);
    } catch (e: any) {
      setMoveNotice(`Failed to export LibraryData.xlsx: ${e.message}`);
      notifyGlassToast({
        type: 'danger',
        title: 'Workbook Export Failed',
        message: e.message,
      });
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
        notifyGlassToast({
          type: 'success',
          title: 'ZIP Archive Exported',
          message: 'Saved full portable library transfer archive.',
          meta: res.filename,
        });
      } else {
        setMoveNotice(res.message);
        notifyGlassToast({
          type: 'warning',
          title: 'ZIP Export Notice',
          message: res.message,
        });
      }
    } catch (e: any) {
      setMoveNotice(`Failed: ${e.message}`);
      notifyGlassToast({
        type: 'danger',
        title: 'ZIP Export Failed',
        message: e.message,
      });
    } finally {
      setIsExportingZip(false);
      setTimeout(() => setMoveNotice(null), 4000);
    }
  };

  return (
    <div className="w-full h-auto min-h-0 flex flex-col gap-4 bg-fluent-matrix px-4 sm:px-6 lg:px-8 pt-4 pb-12 overflow-visible">
      {/* Visually-Hidden Universal Windows File Explorer Folder Picker (sr-only avoids display:none iframe blocks) */}
      <input
        ref={folderInputRef}
        type="file"
        multiple
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        onChange={(e) => {
          const files = e.target.files;
          if (files && files.length > 0) {
            const relPath = (files[0] as any).webkitRelativePath || '';
            const folderName = relPath.split('/')[0] || 'ULM Library Data';
            void applySelectedLocationPath(`Documents\\${folderName}`);
          } else {
            setLocationNotice('Selected folder has no files yet. Choose a folder with files or open the desktop app to mount an empty folder.');
            setTimeout(() => setLocationNotice(null), 5000);
          }
          e.target.value = '';
        }}
      />
      <div className="max-w-[1920px] w-full mx-auto space-y-5">

        {/* 1. Clean Minimal Top Header Banner — Frosted Crystal Shell */}
        <div className="ulm-preserve-glass rounded-[26px] px-6 py-4 bg-gradient-to-br from-white/85 via-white/70 to-white/55 dark:from-white/[0.08] dark:via-white/[0.035] dark:to-white/[0.015] backdrop-blur-xl backdrop-saturate-[180%] border border-slate-200/85 dark:border-white/[0.14] shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.85),0_10px_28px_rgba(15,23,42,0.06)] dark:shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.22),0_10px_28px_rgba(0,0,0,0.28)] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500/20 to-purple-500/15 dark:from-amber-400/20 dark:to-purple-500/20 border border-amber-500/35 dark:border-amber-400/30 flex items-center justify-center text-amber-600 dark:text-amber-300 shrink-0 shadow-2xs">
              <Settings className="w-5 h-5 stroke-[2]" />
            </div>
            <div className="min-w-0">
              <h2 className="font-['Plus_Jakarta_Sans'] text-[18px] font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
                System Settings
              </h2>
              <p className="text-[12.5px] text-slate-600 dark:text-slate-400 mt-0.5 truncate">
                Manage workstation appearance, institutional branding, storage, and catalog taxonomy.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className={`h-10 px-5 rounded-xl font-['Plus_Jakarta_Sans'] text-[12.5px] font-bold transition-all duration-150 inline-flex items-center justify-center gap-2 cursor-pointer shadow-md whitespace-nowrap shrink-0 ${
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

        {/* Developer & QA Button Audit Panel */}
        {showButtonAudit && (
          <ButtonAuditPanel onClose={() => setShowButtonAudit(false)} />
        )}

        {/* 2. Executive 2-Column Settings Architecture */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">

          {/* A. Left Category Navigation Rail */}
          <aside className="lg:col-span-3 lg:sticky lg:top-4">
            <nav
              ref={settingsNavRef}
              aria-label="Settings Categories"
              className="relative isolate overflow-hidden ulm-preserve-glass rounded-[22px] p-3 bg-gradient-to-br from-white/85 via-white/70 to-white/55 dark:from-white/[0.075] dark:via-white/[0.03] dark:to-white/[0.015] backdrop-blur-xl backdrop-saturate-[180%] border border-slate-200/85 dark:border-white/[0.14] shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.85),0_8px_24px_rgba(15,23,42,0.05)] dark:shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.22),0_8px_24px_rgba(0,0,0,0.22)] space-y-1.5"
            >
              <LiquidPillOverlay
                containerRef={settingsNavRef}
                itemRefs={settingsNavItemRefs}
                activeKey={settingsSection}
                axis="y"
                variant="sidebar-pill"
                roundedClass="rounded-2xl"
                triggerTick={settingsNavAnimTick}
              />

              {/* Category 1: Appearance & Branding */}
              <button
                type="button"
                ref={(el) => {
                  settingsNavItemRefs.current['branding'] = el;
                }}
                onClick={() => handleSelectSettingsSection('branding')}
                data-liquid-active={settingsSection === 'branding' ? 'true' : undefined}
                className={`group relative z-10 w-full px-3.5 py-3 !rounded-2xl text-left flex items-center gap-3 transition-colors duration-150 cursor-pointer border border-transparent ${
                  settingsSection === 'branding'
                    ? '!text-white'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.05]'
                }`}
              >
                {settingsSection === 'branding' && (
                  <span className="!absolute left-0 top-2 bottom-2 w-[3px] bg-[#FFD147] rounded-r-full pointer-events-none" />
                )}
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition-colors ${
                    settingsSection === 'branding'
                      ? 'bg-white/15 border-white/25 text-[#FFD147]'
                      : 'bg-slate-900/[0.04] dark:bg-white/[0.05] border-slate-200/80 dark:border-white/[0.10] text-amber-600 dark:text-amber-300'
                  }`}
                >
                  <span
                    className="ulm-nv-ico"
                    key={settingsSection === 'branding' ? settingsNavAnimTick : 0}
                    data-fx={settingsSection === 'branding' ? 'pop' : undefined}
                  >
                    <Palette className="w-4 h-4" />
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className={`font-['Plus_Jakarta_Sans'] text-[13px] font-bold leading-tight truncate ${
                      settingsSection === 'branding' ? '!text-white' : 'text-slate-900 dark:text-white'
                    }`}
                  >
                    Appearance &amp; Branding
                  </div>
                  <div
                    className={`text-[11px] leading-snug truncate mt-0.5 ${
                      settingsSection === 'branding' ? '!text-purple-100/90' : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    Theme, scaling, crest &amp; header
                  </div>
                </div>
              </button>

              {/* Category 2: Scanner & Storage */}
              <button
                type="button"
                ref={(el) => {
                  settingsNavItemRefs.current['hardware'] = el;
                }}
                onClick={() => handleSelectSettingsSection('hardware')}
                data-liquid-active={settingsSection === 'hardware' ? 'true' : undefined}
                className={`group relative z-10 w-full px-3.5 py-3 !rounded-2xl text-left flex items-center gap-3 transition-colors duration-150 cursor-pointer border border-transparent ${
                  settingsSection === 'hardware'
                    ? '!text-white'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.05]'
                }`}
              >
                {settingsSection === 'hardware' && (
                  <span className="!absolute left-0 top-2 bottom-2 w-[3px] bg-[#FFD147] rounded-r-full pointer-events-none" />
                )}
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition-colors ${
                    settingsSection === 'hardware'
                      ? 'bg-white/15 border-white/25 text-[#FFD147]'
                      : 'bg-slate-900/[0.04] dark:bg-white/[0.05] border-slate-200/80 dark:border-white/[0.10] text-sky-600 dark:text-sky-400'
                  }`}
                >
                  <span
                    className="ulm-nv-ico"
                    key={settingsSection === 'hardware' ? settingsNavAnimTick : 0}
                    data-fx={settingsSection === 'hardware' ? 'hop' : undefined}
                  >
                    <HardDrive className="w-4 h-4" />
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className={`font-['Plus_Jakarta_Sans'] text-[13px] font-bold leading-tight truncate ${
                      settingsSection === 'hardware' ? '!text-white' : 'text-slate-900 dark:text-white'
                    }`}
                  >
                    Scanner &amp; Storage
                  </div>
                  <div
                    className={`text-[11px] leading-snug truncate mt-0.5 ${
                      settingsSection === 'hardware' ? '!text-purple-100/90' : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    Barcode node, folder &amp; reset
                  </div>
                </div>
              </button>

              {/* Category 3: Book Groups (گروپس) */}
              <button
                type="button"
                ref={(el) => {
                  settingsNavItemRefs.current['groups'] = el;
                }}
                onClick={() => handleSelectSettingsSection('groups')}
                data-liquid-active={settingsSection === 'groups' ? 'true' : undefined}
                className={`group relative z-10 w-full px-3.5 py-3 !rounded-2xl text-left flex items-center gap-3 transition-colors duration-150 cursor-pointer border border-transparent ${
                  settingsSection === 'groups'
                    ? '!text-white'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.05]'
                }`}
              >
                {settingsSection === 'groups' && (
                  <span className="!absolute left-0 top-2 bottom-2 w-[3px] bg-[#FFD147] rounded-r-full pointer-events-none" />
                )}
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition-colors ${
                    settingsSection === 'groups'
                      ? 'bg-white/15 border-white/25 text-[#FFD147]'
                      : 'bg-slate-900/[0.04] dark:bg-white/[0.05] border-slate-200/80 dark:border-white/[0.10] text-purple-600 dark:text-purple-300'
                  }`}
                >
                  <span
                    className="ulm-nv-ico"
                    key={settingsSection === 'groups' ? settingsNavAnimTick : 0}
                    data-fx={settingsSection === 'groups' ? 'wave' : undefined}
                  >
                    <Layers className="w-4 h-4" />
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className={`font-['Plus_Jakarta_Sans'] text-[13px] font-bold leading-tight truncate ${
                      settingsSection === 'groups' ? '!text-white' : 'text-slate-900 dark:text-white'
                    }`}
                  >
                    Book Groups (گروپس)
                  </div>
                  <div
                    className={`text-[11px] leading-snug truncate mt-0.5 tabular-nums ${
                      settingsSection === 'groups' ? '!text-purple-100/90' : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {bookGroups.length} classification groups
                  </div>
                </div>
              </button>

              {/* Category 4: Almaris & Shelves (الماریاں) */}
              <button
                type="button"
                ref={(el) => {
                  settingsNavItemRefs.current['almaris'] = el;
                }}
                onClick={() => handleSelectSettingsSection('almaris')}
                data-liquid-active={settingsSection === 'almaris' ? 'true' : undefined}
                className={`group relative z-10 w-full px-3.5 py-3 !rounded-2xl text-left flex items-center gap-3 transition-colors duration-150 cursor-pointer border border-transparent ${
                  settingsSection === 'almaris'
                    ? '!text-white'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.05]'
                }`}
              >
                {settingsSection === 'almaris' && (
                  <span className="!absolute left-0 top-2 bottom-2 w-[3px] bg-[#FFD147] rounded-r-full pointer-events-none" />
                )}
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition-colors ${
                    settingsSection === 'almaris'
                      ? 'bg-white/15 border-white/25 text-[#FFD147]'
                      : 'bg-slate-900/[0.04] dark:bg-white/[0.05] border-slate-200/80 dark:border-white/[0.10] text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  <span
                    className="ulm-nv-ico"
                    key={settingsSection === 'almaris' ? settingsNavAnimTick : 0}
                    data-fx={settingsSection === 'almaris' ? 'spin' : undefined}
                  >
                    <Archive className="w-4 h-4" />
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className={`font-['Plus_Jakarta_Sans'] text-[13px] font-bold leading-tight truncate ${
                      settingsSection === 'almaris' ? '!text-white' : 'text-slate-900 dark:text-white'
                    }`}
                  >
                    Almaris &amp; Shelves (الماریاں)
                  </div>
                  <div
                    className={`text-[11px] leading-snug truncate mt-0.5 tabular-nums ${
                      settingsSection === 'almaris' ? '!text-purple-100/90' : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {almaris.length} physical cupboards
                  </div>
                </div>
              </button>
            </nav>
          </aside>

          {/* B. Right Focused Content Pane */}
          <div key={settingsSection} className="ulm-page-enter lg:col-span-9 space-y-5 min-w-0">

            {/* SECTION 1: Appearance & Branding */}
            {settingsSection === 'branding' && (
              <form onSubmit={handleSave} className="space-y-5">
                {/* Panel 1 — Appearance, Display Scaling & Official Crest */}
                <div className="ulm-preserve-glass rounded-[24px] p-6 bg-gradient-to-br from-white/85 via-white/70 to-white/55 dark:from-white/[0.075] dark:via-white/[0.03] dark:to-white/[0.015] backdrop-blur-xl backdrop-saturate-[180%] border border-slate-200/85 dark:border-white/[0.14] shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.85),0_8px_24px_rgba(15,23,42,0.05)] dark:shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.22),0_8px_24px_rgba(0,0,0,0.22)]">
                  <AppearanceSettingsTab />

                  {/* Official ULM Crest Row */}
                  <div className="border-t border-slate-200/70 dark:border-white/[0.09] pt-5 mt-5 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5 min-w-0">
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
                          <h4 className="font-['Plus_Jakarta_Sans'] text-[13.5px] font-bold text-slate-900 dark:text-white truncate">
                            {formData.university_name || 'University of Lakki Marwat'} LMS
                          </h4>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-500/12 border border-amber-400/35 font-['JetBrains_Mono'] ulm-kpi-label text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                            {formData.customLogoDataUri ? 'Custom Crest Active' : 'Official 2017 Crest'}
                          </span>
                        </div>
                        <p className="text-[11.5px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          Synced across Splash Gate, App Header, CR80 ID Cards &amp; Watermark.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                      <label className="!inline-flex !mb-0 items-center justify-center gap-2 h-9 px-4 !rounded-xl bg-white/85 hover:bg-white dark:bg-white/[0.06] dark:hover:bg-white/[0.12] border border-slate-200/90 dark:border-white/[0.14] text-slate-800 dark:text-slate-100 text-[12px] font-semibold transition-all cursor-pointer whitespace-nowrap">
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
                                notifyGlassToast({
                                  type: 'success',
                                  title: 'Institutional Crest Updated',
                                  message: 'Custom institutional crest applied across Header, Splash, and ID Cards.',
                                  meta: file.name,
                                });
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
                          notifyGlassToast({
                            type: 'success',
                            title: 'Institutional Crest Reset',
                            message: 'Restored official ULM 2017 institutional crest.',
                          });
                          setSaveSuccess(true);
                          setInstitutionalSaved(true);
                          setTimeout(() => {
                            setSaveSuccess(false);
                            setInstitutionalSaved(false);
                          }, 2600);
                        }}
                        className="ulm-btn-tactile inline-flex items-center justify-center gap-2 h-9 px-4 !rounded-xl bg-amber-500/12 hover:bg-amber-500/22 border border-amber-400/40 text-amber-800 dark:text-amber-300 text-[12px] font-semibold transition-all cursor-pointer whitespace-nowrap"
                      >
                        <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                        <span>Reset to Official ULM 2017 Crest</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Panel 2 — Institutional Identity & Header Details */}
                <div className="ulm-preserve-glass rounded-[24px] p-6 bg-gradient-to-br from-white/85 via-white/70 to-white/55 dark:from-white/[0.075] dark:via-white/[0.03] dark:to-white/[0.015] backdrop-blur-xl backdrop-saturate-[180%] border border-slate-200/85 dark:border-white/[0.14] shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.85),0_8px_24px_rgba(15,23,42,0.05)] dark:shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.22),0_8px_24px_rgba(0,0,0,0.22)] space-y-5">
                  <div className="flex items-center gap-3 pb-4 border-b border-slate-200/70 dark:border-white/[0.09]">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/12 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-['Plus_Jakarta_Sans'] text-[15px] font-bold text-slate-900 dark:text-white leading-tight">
                        Institutional Identity &amp; Header Details
                      </h3>
                      <p className="text-[12px] text-slate-600 dark:text-slate-400 mt-0.5">
                        University name, library sub-header, and live contact credentials.
                      </p>
                    </div>
                  </div>

                  {/* Spacious 2-Column Form Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="ulm-kpi-label text-[10.5px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 block">
                        University / Institution Name <span className="text-amber-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.university_name}
                        onChange={(e) => setFormData({ ...formData, university_name: e.target.value })}
                        placeholder="e.g. University of Lakki Marwat"
                        className="ulm-compact-control w-full h-10 py-0 px-3.5 !rounded-xl bg-white/85 dark:bg-white/[0.05] border border-slate-300/85 dark:border-white/[0.14] text-slate-900 dark:text-white text-[12.5px] leading-normal focus:border-amber-500/60 outline-none transition-colors"
                      />
                    </div>

                    <div>
                      <label className="ulm-kpi-label text-[10.5px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 block">
                        Library Facility / Department <span className="text-amber-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.library_name}
                        onChange={(e) => setFormData({ ...formData, library_name: e.target.value })}
                        placeholder="e.g. Central Campus Library"
                        className="ulm-compact-control w-full h-10 py-0 px-3.5 !rounded-xl bg-white/85 dark:bg-white/[0.05] border border-slate-300/85 dark:border-white/[0.14] text-slate-900 dark:text-white text-[12.5px] leading-normal focus:border-amber-500/60 outline-none transition-colors"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="ulm-kpi-label text-[10.5px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 block">
                        Campus Physical Address
                      </label>
                      <input
                        type="text"
                        value={formData.campus_address}
                        onChange={(e) => setFormData({ ...formData, campus_address: e.target.value })}
                        placeholder="e.g. Main Campus, Bannu-Mianwali Road, Lakki Marwat, KPK, Pakistan"
                        className="ulm-compact-control w-full h-10 py-0 px-3.5 !rounded-xl bg-white/85 dark:bg-white/[0.05] border border-slate-300/85 dark:border-white/[0.14] text-slate-900 dark:text-white text-[12.5px] leading-normal focus:border-amber-500/60 outline-none transition-colors"
                      />
                    </div>

                    <div>
                      <label className="ulm-kpi-label text-[10.5px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 block">
                        Official Contact Phone
                      </label>
                      <input
                        type="text"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="e.g. +92-969-510015"
                        className="ulm-compact-control font-mono w-full h-10 py-0 px-3.5 !rounded-xl bg-white/85 dark:bg-white/[0.05] border border-slate-300/85 dark:border-white/[0.14] text-slate-900 dark:text-white text-[12.5px] leading-normal focus:border-amber-500/60 outline-none transition-colors"
                      />
                    </div>

                    <div>
                      <label className="ulm-kpi-label text-[10.5px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 block">
                        Official Circulation Email
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="e.g. library@ulm.edu.pk"
                        className="ulm-compact-control font-mono w-full h-10 py-0 px-3.5 !rounded-xl bg-white/85 dark:bg-white/[0.05] border border-slate-300/85 dark:border-white/[0.14] text-slate-900 dark:text-white text-[12.5px] leading-normal focus:border-amber-500/60 outline-none transition-colors"
                      />
                    </div>
                  </div>

                  {/* Sleek Live Title Bar & Header Preview Strip */}
                  <div className="px-4 py-3 rounded-xl border border-slate-200/80 dark:border-white/[0.10] bg-white/60 dark:bg-white/[0.035] flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10.5px] font-['JetBrains_Mono'] uppercase tracking-wider text-amber-700 dark:text-amber-300 font-semibold">
                      Live Title Bar &amp; Header Preview
                    </span>
                    <div className="flex items-center gap-2 text-[12.5px] text-slate-900 dark:text-white truncate">
                      <span className="font-bold font-cinzel tracking-wide text-slate-900 dark:text-white truncate">
                        {formData.university_name.trim() || 'University of Lakki Marwat'}
                      </span>
                      <span className="text-amber-500 font-sans">|</span>
                      <span className="text-slate-700 dark:text-amber-300 font-cinzel text-[11.5px] truncate">
                        {formData.library_name.trim() || 'Central Campus Library'}
                      </span>
                    </div>
                  </div>

                  {/* Apply Details Footer */}
                  <div className="pt-4 border-t border-slate-200/70 dark:border-white/[0.09] flex flex-wrap items-center justify-between gap-3">
                    <span className="text-[11.5px] text-slate-500 dark:text-slate-400">
                      Synchronize headers &amp; title bars live across workstation.
                    </span>

                    <div className="flex items-center gap-2.5">
                      {institutionalSaved && (
                        <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/12 px-3 py-1 rounded-lg border border-emerald-500/30">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Synchronized</span>
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={handleSave}
                        className="ulm-btn-tactile h-9 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-[12px] inline-flex items-center gap-1.5 cursor-pointer shadow-sm transition-all whitespace-nowrap"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Apply Details to App</span>
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            )}

            {/* SECTION 2: Scanner & Storage */}
            {settingsSection === 'hardware' && (
              <form onSubmit={handleSave} className="space-y-5">
                {/* Panel 1 — Barcode Scanner & Peripherals */}
                <div className="ulm-preserve-glass rounded-[24px] p-6 bg-gradient-to-br from-white/85 via-white/70 to-white/55 dark:from-white/[0.075] dark:via-white/[0.03] dark:to-white/[0.015] backdrop-blur-xl backdrop-saturate-[180%] border border-slate-200/85 dark:border-white/[0.14] shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.85),0_8px_24px_rgba(15,23,42,0.05)] dark:shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.22),0_8px_24px_rgba(0,0,0,0.22)] space-y-5">
                  <div className="flex items-center gap-3 pb-4 border-b border-slate-200/70 dark:border-white/[0.09]">
                    <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0">
                      <Volume2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-['Plus_Jakarta_Sans'] text-[15px] font-bold text-slate-900 dark:text-white leading-tight">
                        Barcode Scanner &amp; Peripherals
                      </h3>
                      <p className="text-[12px] text-slate-600 dark:text-slate-400 mt-0.5">
                        Hardware audio triggers, auto-submission, and workstation node tagging.
                      </p>
                    </div>
                  </div>

                  {/* 2-Column Toggle Tiles */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <label className="!flex !mb-0 items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-200/80 dark:border-white/[0.10] bg-white/65 dark:bg-white/[0.035] hover:border-amber-500/40 transition-colors cursor-pointer">
                      <div className="min-w-0">
                        <p className="text-[12.5px] font-bold text-slate-900 dark:text-white truncate">Hardware Audio Feedback</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">Chirp on barcode detection</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={formData.scanner_sound}
                        onChange={(e) => setFormData({ ...formData, scanner_sound: e.target.checked })}
                        className="w-4 h-4 rounded accent-amber-500 cursor-pointer shrink-0"
                      />
                    </label>

                    <label className="!flex !mb-0 items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-200/80 dark:border-white/[0.10] bg-white/65 dark:bg-white/[0.035] hover:border-amber-500/40 transition-colors cursor-pointer">
                      <div className="min-w-0">
                        <p className="text-[12.5px] font-bold text-slate-900 dark:text-white truncate">Auto-Submit Scan</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">Execute on 13-digit EAN</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={formData.auto_submit_scan}
                        onChange={(e) => setFormData({ ...formData, auto_submit_scan: e.target.checked })}
                        className="w-4 h-4 rounded accent-amber-500 cursor-pointer shrink-0"
                      />
                    </label>
                  </div>

                  {/* 2x2 Workstation Inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10.5px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 block">
                        Workstation Node ID
                      </label>
                      <input
                        type="text"
                        value={formData.station_id}
                        onChange={(e) => setFormData({ ...formData, station_id: e.target.value })}
                        className="w-full h-10 px-3.5 rounded-xl bg-white/75 dark:bg-white/[0.045] border border-slate-300/85 dark:border-white/[0.14] font-['JetBrains_Mono'] text-slate-900 dark:text-white text-[12.5px] focus:border-amber-500/60 outline-none transition-colors"
                      />
                    </div>

                    <div>
                      <label className="text-[10.5px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 block">
                        Windows Title Bar Badge
                      </label>
                      <div className="px-3.5 h-10 rounded-xl border border-slate-200/85 dark:border-white/[0.12] text-[11.5px] font-['JetBrains_Mono'] bg-white/60 dark:bg-white/[0.035] text-slate-600 dark:text-slate-400 flex items-center justify-between gap-2">
                        <span className="truncate">Top bar node:</span>
                        <span className="rounded-lg px-2.5 py-1 bg-amber-500/12 border border-amber-400/35 font-['JetBrains_Mono'] ulm-kpi-label text-[11px] font-bold text-amber-700 dark:text-amber-300 shrink-0">
                          {formData.station_id}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10.5px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 block">
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
                        className="w-full h-10 px-3.5 rounded-xl bg-white/75 dark:bg-white/[0.045] border border-slate-300/85 dark:border-white/[0.14] font-['JetBrains_Mono'] text-slate-900 dark:text-amber-300 font-bold text-[12.5px] focus:border-amber-500/60 outline-none transition-colors uppercase"
                      />
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        Format: <span className="font-['JetBrains_Mono'] text-slate-800 dark:text-white">{formData.barcode_prefix || 'ULM'}-00123</span>
                      </p>
                    </div>

                    <div>
                      <label className="text-[10.5px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 block">
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
                        className="w-full h-10 px-3.5 rounded-xl bg-white/75 dark:bg-white/[0.045] border border-slate-300/85 dark:border-white/[0.14] font-['JetBrains_Mono'] tabular-nums text-slate-900 dark:text-amber-300 font-bold text-[12.5px] focus:border-amber-500/60 outline-none transition-colors"
                      />
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        Starting catalog sequence number.
                      </p>
                    </div>
                  </div>

                  {/* Full-width Auto-Backfill Barcodes Button */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={handleBackfillBarcodes}
                      disabled={isBackfilling}
                      className="ulm-btn-tactile w-full h-10 px-4 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 dark:bg-purple-500/20 dark:hover:bg-purple-500/30 text-purple-900 dark:text-purple-200 border border-purple-500/35 text-[12px] font-bold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60 shadow-2xs"
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
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-2 font-['JetBrains_Mono'] text-center">
                        {backfillMessage}
                      </p>
                    )}
                  </div>
                </div>

                {/* Panel 2 — Library Folder Storage & Data Maintenance */}
                <div className="ulm-preserve-glass rounded-[24px] p-6 bg-gradient-to-br from-white/85 via-white/70 to-white/55 dark:from-white/[0.075] dark:via-white/[0.03] dark:to-white/[0.015] backdrop-blur-xl backdrop-saturate-[180%] border border-slate-200/85 dark:border-white/[0.14] shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.85),0_8px_24px_rgba(15,23,42,0.05)] dark:shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.22),0_8px_24px_rgba(0,0,0,0.22)] space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200/70 dark:border-white/[0.09]">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-500/12 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                        <HardDrive className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-['Plus_Jakarta_Sans'] text-[15px] font-bold text-slate-900 dark:text-white leading-tight">
                          Library Folder Storage &amp; Data Maintenance
                        </h3>
                        <p className="text-[12px] text-slate-600 dark:text-slate-400 mt-0.5">
                          Primary database file (Library.ulmlib), linked Excel book entry sheet, and reset controls.
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-slate-900/[0.04] dark:bg-white/[0.04] border border-slate-300/70 dark:border-white/[0.12] font-['JetBrains_Mono'] ulm-kpi-label text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-600 dark:text-emerald-400 whitespace-nowrap shrink-0">
                      <span className="w-1.5 h-1.5 rounded-[1.5px] bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.8)] shrink-0" />
                      OFFLINE SECURE · DATABASE MOUNTED
                    </span>
                  </div>

                  {/* 3-Column Storage Telemetry */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div className="bg-white/60 dark:bg-white/[0.035] border border-slate-200/80 dark:border-white/[0.10] rounded-xl p-3.5 space-y-1">
                      <span className="text-[10px] font-['JetBrains_Mono'] uppercase tracking-wider text-slate-500 dark:text-slate-400 block font-bold">
                        Current Location
                      </span>
                      <span
                        className="text-[11.5px] font-['JetBrains_Mono'] font-semibold text-sky-700 dark:text-sky-300 truncate block"
                        title={desktopRepoPath || realStorageStatus?.folderPath || currentDbPath}
                      >
                        {desktopRepoPath || realStorageStatus?.folderPath || currentDbPath}
                      </span>
                    </div>

                    <div className="bg-white/60 dark:bg-white/[0.035] border border-slate-200/80 dark:border-white/[0.10] rounded-xl p-3.5 space-y-1">
                      <span className="text-[10px] font-['JetBrains_Mono'] uppercase tracking-wider text-slate-500 dark:text-slate-400 block font-bold">
                        File Size
                      </span>
                      <span className="text-[11.5px] font-['JetBrains_Mono'] tabular-nums font-bold text-slate-900 dark:text-white truncate block">
                        {realStorageStatus && realStorageStatus.fileSizeBytes > 0
                          ? `${(realStorageStatus.fileSizeBytes / 1024).toFixed(1)} KB (${realStorageStatus.fileSizeBytes.toLocaleString()} B)`
                          : 'Verified SQLite File'}
                      </span>
                    </div>

                    <div className="bg-white/60 dark:bg-white/[0.035] border border-slate-200/80 dark:border-white/[0.10] rounded-xl p-3.5 space-y-1">
                      <span className="text-[10px] font-['JetBrains_Mono'] uppercase tracking-wider text-slate-500 dark:text-slate-400 block font-bold">
                        Last Saved
                      </span>
                      <span className="text-[11.5px] font-['JetBrains_Mono'] tabular-nums font-semibold text-emerald-700 dark:text-emerald-300 truncate block">
                        {realStorageStatus?.lastSavedIso
                          ? new Date(realStorageStatus.lastSavedIso).toLocaleDateString() + ' ' + new Date(realStorageStatus.lastSavedIso).toLocaleTimeString()
                          : 'Active Session'}
                      </span>
                    </div>
                  </div>

                  {/* Single-Row Calm Frosted Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={handleOpenFolder}
                      className="h-9 px-3.5 rounded-xl text-[11.5px] font-semibold border border-slate-200/90 dark:border-white/[0.12] bg-white/75 hover:bg-white dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-800 dark:text-slate-200 transition-all cursor-pointer inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap"
                    >
                      <Folder className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                      <span>Open Folder</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleChangeLocation}
                      disabled={isChangingLocation}
                      className="h-9 px-3.5 !rounded-xl ulm-kpi-label text-[11.5px] font-semibold border border-amber-500/35 dark:border-amber-400/30 bg-amber-500/[0.08] hover:bg-amber-500/[0.16] dark:bg-amber-500/[0.10] dark:hover:bg-amber-500/[0.20] text-slate-900 dark:text-amber-200 transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap disabled:opacity-50"
                    >
                      {isChangingLocation ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500 shrink-0" />
                      ) : (
                        <ArrowRightLeft className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                      )}
                      <span>{isChangingLocation ? 'Selecting...' : 'Change Location'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCheckLibraryFile}
                      disabled={isCheckingLibraryFile}
                      className="h-9 px-3.5 rounded-xl text-[11.5px] font-semibold border border-slate-200/90 dark:border-white/[0.12] bg-white/75 hover:bg-white dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-800 dark:text-slate-200 transition-all cursor-pointer inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap disabled:opacity-50"
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
                      className="h-9 px-3.5 rounded-xl text-[11.5px] font-semibold border border-slate-200/90 dark:border-white/[0.12] bg-white/75 hover:bg-white dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-800 dark:text-slate-200 transition-all cursor-pointer inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap"
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
                          notifyGlassToast({
                            type: 'success',
                            title: 'Master Excel Synchronized',
                            message: 'Synced and downloaded master Excel catalog register.',
                          });
                        } catch (e: any) {
                          setLocationNotice(`Master Excel sync notice: ${e.message}`);
                          notifyGlassToast({
                            type: 'danger',
                            title: 'Master Excel Sync Failed',
                            message: e.message,
                          });
                        }
                      }}
                      className="h-9 px-3.5 rounded-xl text-[11.5px] font-semibold border border-slate-200/90 dark:border-white/[0.12] bg-white/75 hover:bg-white dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-800 dark:text-slate-200 transition-all cursor-pointer inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Sync Master Excel</span>
                    </button>
                  </div>

                  {/* Quick Check Result Banner */}
                  {quickCheckInfo?.open && (
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[11.5px] text-slate-800 dark:text-slate-200 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 font-['JetBrains_Mono'] tabular-nums">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>
                          SQLite Integrity: <strong>{quickCheckInfo.passed ? 'OK' : 'WARN'}</strong> · Books: {quickCheckInfo.booksCount} · Members: {quickCheckInfo.borrowersCount} · Loans: {quickCheckInfo.loansCount}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setQuickCheckInfo(null)}
                        className="text-slate-500 hover:text-slate-900 dark:hover:text-white text-[11px] font-bold cursor-pointer shrink-0"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}

                  {locationNotice && (
                    <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/35 text-amber-900 dark:text-amber-200 text-[11.5px] flex items-center gap-2">
                      <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>{locationNotice}</span>
                    </div>
                  )}

                  {/* Bottom Full-Width Horizontal Danger Strip */}
                  <div className="pt-5 border-t border-slate-200/70 dark:border-white/[0.09]">
                    <div className="rounded-2xl p-4 bg-rose-500/[0.07] border border-rose-500/30 flex flex-wrap items-center justify-between gap-4">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-rose-900 dark:text-rose-300">
                          <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                          <h5 className="text-[12px] font-bold">
                            Reset App / Clear All Data
                          </h5>
                        </div>
                        <p className="text-[11.5px] text-rose-900/85 dark:text-rose-200/80 leading-relaxed">
                          Permanently clears all books, borrowers, and loans back to 0 records and launches Workstation Setup.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsResetToZeroModalOpen(true)}
                        className="ulm-btn-tactile h-9 px-4 rounded-xl border border-rose-500/45 bg-white/85 hover:bg-rose-50 dark:bg-rose-500/20 dark:hover:bg-rose-500/30 text-rose-900 dark:text-rose-200 text-[11.5px] font-bold transition-all cursor-pointer inline-flex items-center gap-2 shrink-0 whitespace-nowrap"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                        <span>Reset App / Clear All Data</span>
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            )}

            {/* SECTION 3: Book Groups (گروپس) */}
            {settingsSection === 'groups' && (
              <div>
                <GroupsSettingsTab onGroupsChanged={() => setTaxonomyTick((t) => t + 1)} />
              </div>
            )}

            {/* SECTION 4: Almaris & Shelves (الماریاں) */}
            {settingsSection === 'almaris' && (
              <div>
                <AlmarisSettingsTab onAlmarisChanged={() => setTaxonomyTick((t) => t + 1)} />
              </div>
            )}

          </div>
        </div>

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
              setIsResetToZeroModalOpen(false);
              setTaxonomyTick((t) => t + 1);
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

