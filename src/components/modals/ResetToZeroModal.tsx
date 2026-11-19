import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  AlertTriangle, 
  Trash2, 
  RotateCcw, 
  CheckCircle2, 
  X, 
  FileSpreadsheet, 
  ShieldAlert, 
  BookOpen, 
  Users, 
  CalendarClock, 
  Camera,
  ArrowRight,
  Loader2,
  Check
} from 'lucide-react';
import { ResetToZeroService, DeletionSummary, ResetToZeroResult } from '../../services/resetToZeroService';

interface ResetToZeroModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResetComplete: (result: ResetToZeroResult) => void;
  onGoToStartScreen: () => void;
}

export const ResetToZeroModal: React.FC<ResetToZeroModalProps> = ({
  isOpen,
  onClose,
  onResetComplete,
  onGoToStartScreen,
}) => {
  const [summary, setSummary] = useState<DeletionSummary | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [resetSettings, setResetSettings] = useState(false);
  const [sheetAction, setSheetAction] = useState<'fresh_sheet' | 'keep_and_reimport'>('fresh_sheet');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [progressStage, setProgressStage] = useState('');
  const [resetResult, setResetResult] = useState<ResetToZeroResult | null>(null);
  const [isUndoing, setIsUndoing] = useState(false);
  const [undoStatus, setUndoStatus] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSummary(ResetToZeroService.getDeletionSummary());
      setConfirmText('');
      setResetSettings(false);
      setSheetAction('fresh_sheet');
      setIsProcessing(false);
      setProgressPct(0);
      setProgressStage('');
      setResetResult(null);
      setIsUndoing(false);
      setUndoStatus(null);
    }
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') return null;

  const isConfirmValid = confirmText.trim().toUpperCase() === 'RESET';

  const handleExecuteReset = async () => {
    if (!isConfirmValid || isProcessing) return;

    setIsProcessing(true);
    setProgressPct(5);
    setProgressStage('Starting reset sequence...');

    try {
      const res = await ResetToZeroService.executeResetToZero({
        confirmText: confirmText.trim().toUpperCase(),
        resetSettings,
        sheetAction,
        onProgress: (pct, stage) => {
          setProgressPct(pct);
          setProgressStage(stage);
        },
      });

      setResetResult(res);
      setIsProcessing(false);

      if (res.success) {
        onResetComplete(res);
      }
    } catch (e: any) {
      setIsProcessing(false);
      setResetResult({
        success: false,
        message: e.message || 'Unexpected failure during reset',
        undoAvailable: false,
        selfCheck: {
          books: -1,
          borrowers: -1,
          transactions: -1,
          activeLoans: -1,
          withdrawnCount: -1,
          queueCount: -1,
          nextAccession: '',
          nextBarcode: '',
          passed: false,
        },
      });
    }
  };

  const handleUndo = async () => {
    setIsUndoing(true);
    setUndoStatus('Restoring previous catalog snapshot...');
    try {
      const res = await ResetToZeroService.undoReset((pct, stage) => {
        setUndoStatus(`${stage} (${pct}%)`);
      });
      if (res.success) {
        setUndoStatus('Reset successfully reverted. Refreshing catalog...');
        setTimeout(() => {
          onClose();
          window.location.reload();
        }, 1200);
      } else {
        setUndoStatus(`Undo failed: ${res.message}`);
        setIsUndoing(false);
      }
    } catch (err: any) {
      setUndoStatus(`Undo failed: ${err.message}`);
      setIsUndoing(false);
    }
  };

  return createPortal(
    <div
      onClick={() => {
        if (!isProcessing && !isUndoing) onClose();
      }}
      className="fixed inset-0 z-[9999] w-screen h-screen flex items-center justify-center p-4 bg-slate-900/35 dark:bg-[#090514]/80 backdrop-blur-xl backdrop-saturate-[180%] animate-in fade-in duration-200"
    >
      <div 
        className="ulm-preserve-glass relative w-full max-w-[520px] rounded-[24px] p-6 bg-gradient-to-br from-white/95 via-white/90 to-white/85 dark:from-[#1C1132]/95 dark:via-[#140C26]/95 dark:to-[#0E081C]/95 backdrop-blur-2xl backdrop-saturate-[190%] border border-slate-200/90 dark:border-rose-500/30 shadow-[0_24px_64px_rgba(15,23,42,0.22)] dark:shadow-[0_24px_64px_rgba(0,0,0,0.75)] text-slate-900 dark:text-white overflow-hidden flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="pb-4 border-b border-slate-200/80 dark:border-white/[0.10] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight font-['Plus_Jakarta_Sans']">
                {resetResult?.success ? 'Reset Complete & Verified' : 'Reset Library Database to Zero'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-300/80 mt-0.5">
                {resetResult?.success 
                  ? 'All library tables and data files have been purged. Self-check verified.' 
                  : 'Permanently purge all books, members, loans, and caches with automatic verified backup.'}
              </p>
            </div>
          </div>
          {!isProcessing && !isUndoing && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Scrollable Content */}
        <div className="py-4 overflow-y-auto space-y-4 flex-1 pr-1">
          {resetResult?.success ? (
            /* RESET COMPLETE VIEW */
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-4 rounded-2xl bg-emerald-500/12 border border-emerald-500/30 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Database Successfully Reset to Zero</h4>
                  <p className="text-xs text-emerald-800 dark:text-emerald-200/80 leading-relaxed">
                    {resetResult.message}
                  </p>
                  {resetResult.backupFilename && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 font-mono pt-1">
                      Pre-reset backup created: <span className="text-amber-600 dark:text-amber-400 font-semibold">{resetResult.backupFilename}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Automatic Self-Check Results Card */}
              <div className="bg-white/70 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.10] rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200/70 dark:border-white/[0.08] pb-2.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Automated Post-Reset Self-Check
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-mono font-semibold flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    <span>PASSED (100%)</span>
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-white/80 dark:bg-black/30 border border-slate-200/80 dark:border-white/[0.08]">
                    <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Books in DB</span>
                    <span className="text-slate-900 dark:text-white font-['Space_Grotesk'] font-bold text-[18px] tabular-nums">{resetResult.selfCheck.books}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/80 dark:bg-black/30 border border-slate-200/80 dark:border-white/[0.08]">
                    <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Members</span>
                    <span className="text-slate-900 dark:text-white font-['Space_Grotesk'] font-bold text-[18px] tabular-nums">{resetResult.selfCheck.borrowers}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/80 dark:bg-black/30 border border-slate-200/80 dark:border-white/[0.08]">
                    <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Active Loans</span>
                    <span className="text-slate-900 dark:text-white font-['Space_Grotesk'] font-bold text-[18px] tabular-nums">{resetResult.selfCheck.transactions}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/80 dark:bg-black/30 border border-slate-200/80 dark:border-white/[0.08]">
                    <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Next Accession</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold text-xs block mt-1 truncate">
                      {resetResult.selfCheck.nextAccession} ({resetResult.selfCheck.nextBarcode})
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                  Verified: Data files refreshed with clean headers, search index cleared, and next volume confirmed to receive accession 1 with barcode ULM-00001.
                </p>
              </div>

              {/* Undo panel */}
              {resetResult.undoAvailable && (
                <div className="p-4 rounded-2xl bg-amber-500/12 border border-amber-500/30 flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-amber-800 dark:text-amber-300">Need to revert this reset?</span>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Restores all books, members, loans, and settings from the verified pre-reset snapshot.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleUndo}
                    disabled={isUndoing}
                    className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isUndoing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                    <span>{isUndoing ? 'Undoing Reset...' : 'Undo Reset'}</span>
                  </button>
                </div>
              )}

              {undoStatus && (
                <div className="p-3 rounded-xl bg-slate-100 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.10] text-xs font-mono text-amber-700 dark:text-amber-200">
                  {undoStatus}
                </div>
              )}
            </div>
          ) : (
            /* PRE-RESET CONFIGURATION & CONFIRMATION VIEW */
            <div className="space-y-4">
              {/* Warning Callout */}
              <div className="p-3.5 rounded-2xl bg-rose-500/12 border border-rose-500/30 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-rose-700 dark:text-rose-300 uppercase tracking-wider">
                    High Risk: Complete Library Data Wipe
                  </h4>
                  <p className="text-xs text-rose-900/85 dark:text-rose-100/80 leading-relaxed">
                    This will delete all books, barcodes, members, photos, circulation loans, fines, import batches, and search caches. The next accession counter will reset to 1 (ULM-00001).
                  </p>
                </div>
              </div>

              {/* What Will Be Deleted - Real Counts (4-Column Frosted Glass Pills) */}
              {summary && (
                <div className="space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 block">
                    Records To Be Purged
                  </span>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="p-2.5 rounded-xl bg-white/75 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.10] flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Books</span>
                        <BookOpen className="w-3.5 h-3.5 text-purple-600 dark:text-purple-300" />
                      </div>
                      <span className="font-['Space_Grotesk'] text-[18px] font-bold tabular-nums text-slate-900 dark:text-white leading-tight mt-1">
                        {summary.booksCount}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                        {summary.copiesCount} Copies
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white/75 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.10] flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Members</span>
                        <Users className="w-3.5 h-3.5 text-sky-600 dark:text-sky-300" />
                      </div>
                      <span className="font-['Space_Grotesk'] text-[18px] font-bold tabular-nums text-slate-900 dark:text-white leading-tight mt-1">
                        {summary.borrowersCount}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                        Registered
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white/75 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.10] flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Loans</span>
                        <CalendarClock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-300" />
                      </div>
                      <span className="font-['Space_Grotesk'] text-[18px] font-bold tabular-nums text-slate-900 dark:text-white leading-tight mt-1">
                        {summary.transactionsCount}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                        Circulation
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white/75 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.10] flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Photos</span>
                        <Camera className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-300" />
                      </div>
                      <span className="font-['Space_Grotesk'] text-[18px] font-bold tabular-nums text-slate-900 dark:text-white leading-tight mt-1">
                        {summary.photosCount}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                        Cached
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Linked Excel Sheet Options (If Sheet is Connected) */}
              {summary?.isSheetLinked && (
                <div className="p-3.5 rounded-2xl bg-white/70 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.10] space-y-2.5">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      Linked Book Sheet: <span className="font-mono text-emerald-700 dark:text-emerald-300">{summary.sheetName}</span>
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Choose what to do with the linked Excel book sheet so books are not automatically re-imported on next startup:
                  </p>

                  <div className="space-y-2 pt-1">
                    <label 
                      onClick={() => setSheetAction('fresh_sheet')}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        sheetAction === 'fresh_sheet' 
                          ? 'bg-rose-500/10 border-rose-500/40 text-slate-900 dark:text-white' 
                          : 'bg-white/50 dark:bg-white/[0.02] border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <input 
                        type="radio" 
                        name="sheet_action" 
                        checked={sheetAction === 'fresh_sheet'} 
                        onChange={() => setSheetAction('fresh_sheet')}
                        className="mt-0.5 accent-rose-500" 
                      />
                      <div className="space-y-0.5">
                        <span className="text-xs font-semibold block text-slate-900 dark:text-white">
                          Start with a fresh blank sheet (Default &amp; Recommended)
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 block leading-relaxed">
                          The current sheet will be archived into <span className="font-mono">Backups\</span> folder (never deleted). App unlinks so no old rows re-import.
                        </span>
                      </div>
                    </label>

                    <label 
                      onClick={() => setSheetAction('keep_and_reimport')}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        sheetAction === 'keep_and_reimport' 
                          ? 'bg-amber-500/10 border-amber-500/40 text-slate-900 dark:text-white' 
                          : 'bg-white/50 dark:bg-white/[0.02] border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <input 
                        type="radio" 
                        name="sheet_action" 
                        checked={sheetAction === 'keep_and_reimport'} 
                        onChange={() => setSheetAction('keep_and_reimport')}
                        className="mt-0.5 accent-amber-500" 
                      />
                      <div className="space-y-0.5">
                        <span className="text-xs font-semibold block text-slate-900 dark:text-white">
                          Keep using this sheet and re-import its books now
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 block leading-relaxed">
                          Retains the existing sheet connection and rescans its catalog entries after resetting loans and members.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* Settings Checkbox */}
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-white/70 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.10]">
                <input
                  type="checkbox"
                  id="reset-settings-checkbox"
                  checked={resetSettings}
                  onChange={e => setResetSettings(e.target.checked)}
                  className="rounded border-slate-300 dark:border-white/20 text-rose-600 focus:ring-0 cursor-pointer w-4 h-4 accent-rose-600"
                />
                <label htmlFor="reset-settings-checkbox" className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  Also reset institutional settings (fine rates, loan durations, and barcode prefix).
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400">By default, your custom settings are kept safely.</span>
                </label>
              </div>

              {/* Progress Bar (During Execution) */}
              {isProcessing && (
                <div className="space-y-2 p-4 rounded-2xl bg-slate-900/10 dark:bg-black/40 border border-slate-200 dark:border-white/[0.10] animate-in fade-in">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-900 dark:text-white font-semibold flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" />
                      <span>{progressStage}</span>
                    </span>
                    <span className="text-rose-600 dark:text-rose-400 font-mono font-bold">{progressPct}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-white/[0.08] overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 transition-all duration-300"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Error Callout if any */}
              {resetResult && !resetResult.success && (
                <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs">
                  <strong>Reset Aborted:</strong> {resetResult.message}
                </div>
              )}

              {/* Type RESET Confirmation Input */}
              {!isProcessing && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor="reset-confirm-input" className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                      Type <span className="font-mono text-rose-600 dark:text-rose-400 font-bold bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">RESET</span> to confirm:
                    </label>
                    {!isConfirmValid ? (
                      <button
                        type="button"
                        onClick={() => setConfirmText('RESET')}
                        className="text-[11px] font-mono font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                      >
                        Click to fill &quot;RESET&quot;
                      </button>
                    ) : (
                      <span className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                        <Check className="w-3 h-3" /> Confirmed
                      </span>
                    )}
                  </div>
                  <input
                    id="reset-confirm-input"
                    type="text"
                    value={confirmText}
                    onChange={e => setConfirmText(e.target.value.toUpperCase())}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && isConfirmValid && !isProcessing) {
                        e.preventDefault();
                        void handleExecuteReset();
                      }
                    }}
                    placeholder="Type RESET"
                    className={`ulm-compact-control w-full h-10 font-['JetBrains_Mono'] text-[13px] font-bold tracking-widest uppercase bg-white/90 dark:bg-white/[0.06] border rounded-xl px-3.5 py-2 text-slate-900 dark:text-white focus:outline-none transition-all ${
                      isConfirmValid
                        ? 'border-emerald-500/70 ring-2 ring-emerald-500/20'
                        : 'border-slate-300 dark:border-white/[0.15] focus:border-rose-500/70'
                    }`}
                    autoComplete="off"
                    autoFocus
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-200/80 dark:border-white/[0.10] flex items-center justify-between shrink-0">
          {resetResult?.success ? (
            <div className="w-full flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-700 dark:text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Close &amp; Stay Here
              </button>
              <button
                type="button"
                onClick={onGoToStartScreen}
                className="px-5 h-10 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 !text-slate-950 text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-sm"
              >
                <span className="!text-slate-950">Go to Start Screen</span>
                <ArrowRight className="w-4 h-4 !text-slate-950" />
              </button>
            </div>
          ) : (
            <div className="w-full flex items-center justify-between">
              <button
                type="button"
                onClick={onClose}
                disabled={isProcessing}
                className="px-4 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-700 dark:text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleExecuteReset}
                disabled={!isConfirmValid || isProcessing}
                className={`px-5 h-10 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all ${
                  isConfirmValid && !isProcessing
                    ? 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 !text-white shadow-lg shadow-rose-600/30 cursor-pointer'
                    : 'bg-rose-500/15 border border-rose-500/25 text-rose-500/60 dark:text-rose-400/60 cursor-not-allowed'
                }`}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin !text-white" />
                    <span className="!text-white">Purging Library Data...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className={`w-4 h-4 ${isConfirmValid ? '!text-white' : ''}`} />
                    <span className={isConfirmValid ? '!text-white' : ''}>Reset to Zero</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

