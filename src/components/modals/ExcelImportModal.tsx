import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Layers,
  ArrowRight,
} from 'lucide-react';
import {
  importExcelOrCsvToSqlite,
  ImportProgressEvent,
  BatchImportSummary,
  syncMasterExcelRegister,
  getImportedSheetsLog,
  getCurrentMaxSeriesNumber,
  getTrueDatabaseBookCount,
  markWorkstationSetupCompleted,
} from '../../services/libraryStorageAndMigration';
import { ULM_OFFICIAL_CREST_DATA_URI, handleCrestFallback } from '../../constants/ulmOfficialCrest';

export interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (importedCount: number) => void;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [progress, setProgress] = useState<ImportProgressEvent | null>(null);
  const [summary, setSummary] = useState<BatchImportSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [existingCount, setExistingCount] = useState<number>(0);
  const [maxSeries, setMaxSeries] = useState<number>(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    let isSubscribed = true;
    const loadStats = async () => {
      try {
        const count = await getTrueDatabaseBookCount();
        const max = await getCurrentMaxSeriesNumber();
        if (isSubscribed) {
          setExistingCount(count);
          setMaxSeries(max);
        }
      } catch (e) {
        console.warn('[ExcelImportModal] Error loading existing series stats:', e);
      }
    };
    loadStats();
    return () => {
      isSubscribed = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setErrorMessage(null);
      setSummary(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv'))) {
      setSelectedFile(file);
      setErrorMessage(null);
      setSummary(null);
    } else {
      setErrorMessage('Please select a valid Excel (.xlsx, .xls) or CSV (.csv) spreadsheet file.');
    }
  };

  const handleStartImport = async () => {
    if (!selectedFile) return;

    setIsImporting(true);
    setErrorMessage(null);
    setProgress({
      processed: 0,
      total: 0,
      percent: 0,
      inserted: 0,
      updated: 0,
      skippedDuplicates: 0,
      rejected: 0,
    });

    try {
      const buffer = await selectedFile.arrayBuffer();
      const res = await importExcelOrCsvToSqlite(buffer, {
        chunkSize: 250,
        onDuplicate: 'append',
        fileName: selectedFile.name,
        onProgress: (p) => setProgress(p),
      });

      setSummary(res);
      markWorkstationSetupCompleted('excel_imported');
      try {
        await syncMasterExcelRegister();
      } catch (syncErr) {
        console.warn('[ExcelImport] Master register sync notice:', syncErr);
      }
      if (res) {
        setExistingCount(res.finalDbBooks || (existingCount || 0) + res.inserted);
        setMaxSeries(res.finalDbBooks || (maxSeries || 0) + res.inserted);
      }
      if (res && typeof onImportComplete === 'function') {
        onImportComplete((res.inserted || 0) + (res.updated || 0));
      }
    } catch (err: any) {
      console.warn('[ExcelImportModal] Import warning:', err);
      const msg =
        err && typeof err === 'object' && typeof err.message === 'string'
          ? err.message
          : typeof err === 'string'
          ? err
          : 'Failed to complete Excel batch import.';
      setErrorMessage(msg || 'An unexpected error occurred during import.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    if (isImporting) return;
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-gradient-to-b from-[#FFFDF9] via-[#FAF6EC] to-[#F3EBD9] dark:from-[#0B1120] dark:via-[#0F172A] dark:to-[#0B1120] border-2 border-[#D4B475]/65 dark:border-white/15 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[88dvh]">
        {/* Header */}
        <div className="px-6 py-4 bg-white/80 dark:bg-[#131B2E] border-b border-[#DCCB9E] dark:border-white/[0.08] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <img
              src={ULM_OFFICIAL_CREST_DATA_URI}
              alt="ULM"
              onError={handleCrestFallback}
              className="w-9 h-9 object-contain"
              draggable={false}
            />
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-[#1A1027] dark:text-white tracking-wide font-display">
                Excel & CSV Accession Register Importer
              </h3>
              <p className="text-[11px] text-[#4A3B5C] dark:text-slate-400">
                Non-blocking 250-row chunked stream into SQLite & IndexedDB
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isImporting}
            className="p-1.5 text-[#4A3B5C] hover:text-[#1A1027] dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 flex-1 min-h-0 overflow-y-auto custom-scrollbar">
          {!summary ? (
            <>
              {/* Continuous Series Preview Banner */}
              <div className="p-3.5 bg-amber-500/15 dark:bg-amber-500/10 border border-amber-600/30 dark:border-amber-500/25 rounded-xl flex items-start gap-3">
                <Layers className="w-4 h-4 text-[#8A4B00] dark:text-[#BC881B] mt-0.5 shrink-0" />
                <div className="space-y-0.5">
                  <p className="text-xs font-extrabold text-[#1A1027] dark:text-white">
                    Continuous Series Auto-Continuation
                  </p>
                  <p className="text-[11px] text-[#5E3200] dark:text-amber-200/90 leading-relaxed font-medium">
                    {existingCount > 0
                      ? `Existing Library: ${existingCount.toLocaleString()} Books (Series #1 – #${maxSeries.toLocaleString()}) → This Sheet will be added as Series #${(maxSeries + 1).toLocaleString()} – #...`
                      : `Existing Library: 0 Books → This Sheet will be added starting as Series #1 – #... in strict sequential series`}
                  </p>
                </div>
              </div>

              {/* Drop Area */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => !isImporting && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                  isDragging
                    ? 'border-[#B8731B] bg-[#B8731B]/10'
                    : selectedFile
                    ? 'border-emerald-600/50 bg-emerald-500/10'
                    : 'border-[#C8963E]/60 hover:border-[#B8731B] bg-white/80 dark:border-white/15 dark:hover:border-white/30 dark:bg-[#131B2E]/50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {selectedFile ? (
                  <>
                    <FileSpreadsheet className="w-10 h-10 text-emerald-600 dark:text-emerald-400 animate-in zoom-in-75 duration-200" />
                    <div className="space-y-1">
                      <p className="text-sm font-extrabold text-[#1A1027] dark:text-white">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-[#4A3B5C] dark:text-slate-400">
                        {(selectedFile.size / 1024).toFixed(1)} KB · Ready to import
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-10 h-10 text-[#8A4B00] dark:text-slate-400" />
                    <div className="space-y-1">
                      <p className="text-xs font-extrabold text-[#1A1027] dark:text-white">
                        Click to browse or drag and drop spreadsheet
                      </p>
                      <p className="text-[11px] text-[#4A3B5C] dark:text-slate-400">
                        Supports .xlsx, .xls, and .csv files of any size
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Progress Indicator */}
              {isImporting && progress && (
                <div className="p-4 bg-white dark:bg-[#131B2E] border border-[#DCCB9E] dark:border-white/[0.08] rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#1A1027] dark:text-slate-300 font-bold flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 text-[#BC881B] animate-spin" />
                      Streaming records to persistent storage...
                    </span>
                    <span className="font-mono text-[#8A4B00] dark:text-[#BC881B] font-extrabold">
                      {progress.percent}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-[#BC881B] h-full transition-all duration-150 ease-out"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-[#4A3B5C] dark:text-slate-400 font-mono pt-1">
                    <span>
                      Processed: {progress.processed.toLocaleString()} / {progress.total.toLocaleString()}
                    </span>
                    <span>Inserted: {progress.inserted.toLocaleString()}</span>
                  </div>
                </div>
              )}

              {/* Specifications Reminder */}
              <div className="grid grid-cols-2 gap-2 text-[11px] text-[#4A3B5C] dark:text-slate-300 font-medium">
                <div className="p-2.5 bg-white/80 dark:bg-[#131B2E]/60 border border-[#DCCB9E] dark:border-white/[0.06] rounded-lg flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Leading zeros preserved in Accession No.</span>
                </div>
                <div className="p-2.5 bg-white/80 dark:bg-[#131B2E]/60 border border-[#DCCB9E] dark:border-white/[0.06] rounded-lg flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span>Series: 100000 → 100001 sequential</span>
                </div>
              </div>
            </>
          ) : (
            /* Summary Report */
            <div className="space-y-4">
              <div className="p-4 bg-emerald-500/15 border border-emerald-500/35 rounded-xl flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-sm font-extrabold text-[#1A1027] dark:text-white">
                    ✓ Added {summary.inserted.toLocaleString()} Books in Series #
                    {Math.max(1, summary.finalDbBooks - summary.inserted + 1).toLocaleString()} – #
                    {summary.finalDbBooks.toLocaleString()}
                  </h4>
                  <p className="text-xs text-emerald-900 dark:text-emerald-200/90 font-medium">
                    Total Catalog:{' '}
                    <span className="font-extrabold text-[#1A1027] dark:text-white">
                      {summary.finalDbBooks.toLocaleString()} Books
                    </span>{' '}
                    • All records committed to SQLite & IndexedDB with continuous series.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-white dark:bg-[#131B2E] border border-[#DCCB9E] dark:border-white/[0.06] rounded-xl text-center">
                  <p className="text-[11px] uppercase text-[#4A3B5C] dark:text-slate-400 font-bold">
                    Total Rows
                  </p>
                  <p className="text-lg font-extrabold font-mono text-[#1A1027] dark:text-white mt-0.5">
                    {summary.totalInput.toLocaleString()}
                  </p>
                </div>
                <div className="p-3 bg-white dark:bg-[#131B2E] border border-[#DCCB9E] dark:border-white/[0.06] rounded-xl text-center">
                  <p className="text-[11px] uppercase text-[#4A3B5C] dark:text-slate-400 font-bold">
                    Inserted
                  </p>
                  <p className="text-lg font-extrabold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {summary.inserted.toLocaleString()}
                  </p>
                </div>
                <div className="p-3 bg-white dark:bg-[#131B2E] border border-[#DCCB9E] dark:border-white/[0.06] rounded-xl text-center">
                  <p className="text-[11px] uppercase text-[#4A3B5C] dark:text-slate-400 font-bold">
                    Duration
                  </p>
                  <p className="text-lg font-extrabold font-mono text-[#8A4B00] dark:text-amber-400 mt-0.5">
                    {((summary.durationMs || 0) / 1000).toFixed(1)}s
                  </p>
                </div>
              </div>

              {/* Imported Sheets Ledger Badge History */}
              <div className="p-3.5 bg-white/85 dark:bg-[#131B2E]/60 border border-[#DCCB9E] dark:border-white/[0.06] rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-[#1A1027] dark:text-slate-300">
                  <span className="flex items-center gap-1.5 text-[#8A4B00] dark:text-amber-400">
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Permanent Multi-Sheet Ledger</span>
                  </span>
                  <span className="font-mono text-[11px] text-[#4A3B5C] dark:text-slate-400">
                    {getImportedSheetsLog().length} sheet(s) tracked
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar">
                  {getImportedSheetsLog().map((item, idx) => (
                    <span
                      key={item.id || idx}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-[#FAF6EC] dark:bg-white/[0.04] text-[#1A1027] dark:text-slate-300 border border-[#DCCB9E] dark:border-white/10"
                    >
                      <span className="text-[#8A4B00] dark:text-amber-400 font-bold">#{idx + 1}</span>
                      <span className="truncate max-w-[120px]">{item.filename}</span>
                      <span className="text-emerald-700 dark:text-emerald-400">(+{item.rowsCount})</span>
                    </span>
                  ))}
                </div>
              </div>

              <p className="text-[11px] text-[#4A3B5C] dark:text-slate-400">
                Master Excel Register (
                <span className="font-mono font-semibold text-[#1A1027] dark:text-slate-300">
                  ULM_Master_Books_Register.xlsx
                </span>
                ) has been automatically updated with continuous sequential series.
              </p>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/25 rounded-lg text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#F3EBD9]/90 dark:bg-[#131B2E] border-t border-[#DCCB9E] dark:border-white/[0.08] flex items-center justify-end gap-2.5 shrink-0">
          {!summary ? (
            <>
              <button
                type="button"
                onClick={handleClose}
                disabled={isImporting}
                className="px-4 h-10 rounded-xl bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-[#1A1027] dark:text-slate-300 border border-[#DCCB9E] dark:border-white/10 text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStartImport}
                disabled={!selectedFile || isImporting}
                className="px-5 h-10 rounded-xl bg-[#BC881B] hover:bg-[#D4A02A] text-slate-950 text-xs font-extrabold uppercase tracking-wider inline-flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer shadow-sm"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Importing...</span>
                  </>
                ) : (
                  <>
                    <span>Start Import</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSummary(null);
                  setSelectedFile(null);
                  setProgress(null);
                  setErrorMessage(null);
                }}
                className="px-4 h-10 rounded-xl bg-white hover:bg-slate-100 dark:bg-[#151C2C] dark:hover:bg-[#1C263B] text-[#1A1027] dark:text-slate-200 border border-[#DCCB9E] dark:border-white/10 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#BC881B]" />
                <span>+ Import / Append Another Excel Sheet</span>
              </button>

              <button
                type="button"
                onClick={handleClose}
                className="px-6 h-10 rounded-xl bg-[#BC881B] hover:bg-[#D4A02A] text-slate-950 text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer shadow-sm"
              >
                Done & View Catalog
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default ExcelImportModal;
