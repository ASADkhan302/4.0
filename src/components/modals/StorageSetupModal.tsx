import React, { useState } from 'react';
import { 
  FolderOpen, 
  Database, 
  FileSpreadsheet, 
  CheckCircle2, 
  HardDrive, 
  ArrowRight,
  ShieldCheck,
  Hash,
  AlertCircle
} from 'lucide-react';
import { ULM_CREST_LOGO } from '../../constants/branding';
import { syncMasterExcelRegister } from '../../services/libraryStorageAndMigration';

export interface StorageSetupModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onConfigured: (folderPath: string, action?: 'add_manual' | 'import_excel') => void;
  isResetMode?: boolean;
}

export const StorageSetupModal: React.FC<StorageSetupModalProps> = ({
  isOpen,
  onConfigured,
  isResetMode = false,
}) => {
  const [folderPath, setFolderPath] = useState<string>('Documents\\ULM Library Data');
  const [isSelecting, setIsSelecting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelectFolder = async () => {
    setIsSelecting(true);
    setErrorMsg(null);
    try {
      // 1. Electron Native folder selection
      if (typeof window !== 'undefined' && window.ulmLibraryApi?.selectCustomDataFolder) {
        const res = await window.ulmLibraryApi.selectCustomDataFolder();
        if (res && !res.canceled && res.activeDataDir) {
          setFolderPath(res.activeDataDir);
          return;
        }
      }

      // 2. Browser File System Access API
      if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
        try {
          const dirHandle = await (window as any).showDirectoryPicker({
            mode: 'readwrite',
            startIn: 'documents',
          });
          if (dirHandle && dirHandle.name) {
            (window as any).__ulm_data_dir_handle = dirHandle;
            const fullPath = `Documents\\${dirHandle.name}`;
            setFolderPath(fullPath);
            return;
          }
        } catch (pickerErr: any) {
          if (pickerErr.name !== 'AbortError') {
            console.warn('[StorageSetup] Picker note:', pickerErr);
          }
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Folder selection error');
    } finally {
      setIsSelecting(false);
    }
  };

  const handleInitializeStorage = async (action?: 'add_manual' | 'import_excel') => {
    const finalPath = folderPath.trim() || 'Documents\\ULM Library Data';
    try {
      // Bind folder config to localStorage
      const config = {
        folderPath: finalPath,
        configuredAt: new Date().toISOString(),
        isConfigured: true,
      };
      localStorage.setItem('ulm_storage_location_configured_v1', 'true');
      localStorage.setItem('ulm_data_folder_config_v1', JSON.stringify(config));
      localStorage.removeItem('ulm_database_cleared');

      // Initialize Master Excel Register in persistent folder
      await syncMasterExcelRegister([]);

      onConfigured(finalPath, action);
    } catch (err: any) {
      setErrorMsg(`Initialization failed: ${err.message || 'Unknown error'}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-white/10 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Institutional Header with ULM Crest */}
        <div className="p-6 bg-slate-50 dark:bg-gradient-to-b dark:from-[#131B2E] dark:to-[#0B1120] border-b border-slate-200 dark:border-white/[0.08] text-center flex flex-col items-center">
          <img
            src={ULM_CREST_LOGO}
            alt="University of Lakki Marwat Crest"
            className="w-16 h-16 object-contain mb-3 drop-shadow-md select-none"
          />
          <h2 className="text-xl font-bold font-cinzel text-slate-900 dark:text-white tracking-wide">
            University of Lakki Marwat
          </h2>
          <p className="text-xs font-semibold text-[#BC881B] tracking-[0.16em] uppercase mt-0.5">
            Central Campus Library · System Setup Gate
          </p>
          <div className="mt-3 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              {isResetMode ? 'Post-Reset Data Initialization' : 'First-Install Storage & Master Excel Binding'}
            </span>
          </div>
        </div>

        {/* Setup Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 text-slate-800 dark:text-slate-200">
          <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed space-y-1">
            <p>
              Please designate or confirm your official <strong>Library Data Folder</strong>. All physical book accession records, circulation data, and the live <strong>Master Excel Register</strong> will be bound to this directory.
            </p>
          </div>

          {/* Folder Path Input & Picker */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <FolderOpen className="w-3.5 h-3.5 text-[#BC881B]" />
              <span>Library Data Folder</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={folderPath}
                onChange={(e) => setFolderPath(e.target.value)}
                placeholder="C:\Users\Librarian\Documents\ULM Library Data"
                className="flex-1 h-11 px-3.5 bg-slate-50 dark:bg-[#131B2E] border border-slate-300 dark:border-white/10 rounded-lg text-xs font-mono text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#BC881B] transition-colors"
              />
              <button
                type="button"
                onClick={handleSelectFolder}
                disabled={isSelecting}
                className="h-11 px-4 bg-slate-200 dark:bg-[#1F293D] hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-900 dark:text-white rounded-lg text-xs font-semibold inline-flex items-center gap-2 border border-slate-300 dark:border-white/10 transition-colors cursor-pointer shrink-0"
              >
                <FolderOpen className="w-4 h-4 text-[#BC881B]" />
                <span>{isSelecting ? 'Selecting...' : 'Browse...'}</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Native SQLite database and Master Excel will be bound inside this folder.
            </p>
          </div>

          {/* Verification & Storage Binding Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="p-3 bg-slate-50 dark:bg-[#131B2E] border border-slate-200 dark:border-white/[0.06] rounded-xl flex items-start gap-3">
              <Database className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-slate-900 dark:text-white">Unlimited SQLite / IDB</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                  1,000,000+ books capacity with 0 MB localStorage overhead.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-[#131B2E] border border-slate-200 dark:border-white/[0.06] rounded-xl flex items-start gap-3">
              <FileSpreadsheet className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-slate-900 dark:text-white">Master Excel Register</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                  <span className="font-mono text-amber-600 dark:text-amber-300">ULM_Master_Books_Register.xlsx</span> live sync.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-[#131B2E] border border-slate-200 dark:border-white/[0.06] rounded-xl flex items-start gap-3">
              <Hash className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-slate-900 dark:text-white">Monotonic Series Engine</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                  Strict numbering: <span className="font-mono text-blue-600 dark:text-blue-300">100000 → 100001</span>.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-[#131B2E] border border-slate-200 dark:border-white/[0.06] rounded-xl flex items-start gap-3">
              <HardDrive className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-slate-900 dark:text-white">Zero Demo Data Policy</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                  Starts with exactly 0 books. Zero synthetic mixing.
                </p>
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-rose-600 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer Actions: Direct Onboarding */}
        <div className="p-4 bg-slate-50 dark:bg-[#131B2E] border-t border-slate-200 dark:border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
          <div className="text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>Ready for official campus inventory</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleInitializeStorage('add_manual')}
              className="h-9 px-3.5 bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>➕ Add Books Manually</span>
            </button>
            <button
              type="button"
              onClick={() => handleInitializeStorage('import_excel')}
              className="h-9 px-3.5 bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>📥 Import Books from Excel / CSV</span>
            </button>
            <button
              type="button"
              onClick={() => handleInitializeStorage()}
              className="h-9 px-4 bg-[#BC881B] hover:bg-[#D4A02A] text-slate-950 text-xs font-bold uppercase tracking-wider rounded-lg inline-flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <span>Enter Workspace</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default StorageSetupModal;
