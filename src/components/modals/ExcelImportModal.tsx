import React, { useState, useRef } from 'react';
import { 
  X, 
  FileSpreadsheet, 
  UploadCloud, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  FileText,
  Layers,
  ArrowRight
} from 'lucide-react';
import { 
  importExcelOrCsvToSqlite, 
  ImportProgressEvent, 
  BatchImportSummary,
  syncMasterExcelRegister
} from '../../services/libraryStorageAndMigration';
import { ULM_CREST_LOGO } from '../../constants/branding';

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

  const fileInputRef = useRef<HTMLInputElement>(null);

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
        onDuplicate: 'upsert',
        onProgress: (p) => setProgress(p),
      });

      setSummary(res);
      // Ensure master register is synced
      await syncMasterExcelRegister();
      onImportComplete(res.inserted + res.updated);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to complete Excel batch import.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    if (isImporting) return;
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0B1120] border border-white/10 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-[#131B2E] border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={ULM_CREST_LOGO} alt="ULM" className="w-8 h-8 object-contain" />
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide font-cinzel">
                Excel & CSV Accession Register Importer
              </h3>
              <p className="text-[11px] text-slate-400">
                Non-blocking 250-row chunked stream into SQLite & IndexedDB
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isImporting}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {!summary ? (
            <>
              {/* Drop Area */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => !isImporting && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                  isDragging 
                    ? 'border-[#BC881B] bg-[#BC881B]/5' 
                    : selectedFile 
                      ? 'border-emerald-500/40 bg-emerald-500/5' 
                      : 'border-white/15 hover:border-white/30 bg-[#131B2E]/50'
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
                    <FileSpreadsheet className="w-10 h-10 text-emerald-400 animate-in zoom-in-75 duration-200" />
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-white">{selectedFile.name}</p>
                      <p className="text-xs text-slate-400">
                        {(selectedFile.size / 1024).toFixed(1)} KB · Ready to import
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-10 h-10 text-slate-400" />
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-white">
                        Click to browse or drag and drop spreadsheet
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Supports .xlsx, .xls, and .csv files of any size
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Progress Indicator */}
              {isImporting && progress && (
                <div className="p-4 bg-[#131B2E] border border-white/[0.08] rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 text-[#BC881B] animate-spin" />
                      Streaming records to persistent storage...
                    </span>
                    <span className="font-mono text-[#BC881B] font-bold">
                      {progress.percent}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-[#BC881B] h-full transition-all duration-150 ease-out"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400 font-mono pt-1">
                    <span>Processed: {progress.processed.toLocaleString()} / {progress.total.toLocaleString()}</span>
                    <span>Inserted: {progress.inserted.toLocaleString()}</span>
                  </div>
                </div>
              )}

              {/* Specifications Reminder */}
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                <div className="p-2.5 bg-[#131B2E]/60 border border-white/[0.04] rounded-lg flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Leading zeros preserved in Accession No.</span>
                </div>
                <div className="p-2.5 bg-[#131B2E]/60 border border-white/[0.04] rounded-lg flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>Series: 100000 → 100001 sequential</span>
                </div>
              </div>
            </>
          ) : (
            /* Summary Report */
            <div className="space-y-4">
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white">Import Committed Successfully</h4>
                  <p className="text-xs text-slate-300">
                    All records were written directly to SQLite / IndexedDB and verified in the catalog.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-[#131B2E] border border-white/[0.06] rounded-xl text-center">
                  <p className="text-[11px] uppercase text-slate-400 font-semibold">Total Rows</p>
                  <p className="text-lg font-bold font-mono text-white mt-0.5">{summary.totalInput.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-[#131B2E] border border-white/[0.06] rounded-xl text-center">
                  <p className="text-[11px] uppercase text-slate-400 font-semibold">Inserted</p>
                  <p className="text-lg font-bold font-mono text-emerald-400 mt-0.5">{summary.inserted.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-[#131B2E] border border-white/[0.06] rounded-xl text-center">
                  <p className="text-[11px] uppercase text-slate-400 font-semibold">Duration</p>
                  <p className="text-lg font-bold font-mono text-amber-400 mt-0.5">{((summary.durationMs || 0) / 1000).toFixed(1)}s</p>
                </div>
              </div>

              <p className="text-[11px] text-slate-400">
                Master Excel Register (<span className="font-mono text-slate-300">ULM_Master_Books_Register.xlsx</span>) has been automatically updated.
              </p>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#131B2E] border-t border-white/[0.08] flex items-center justify-end gap-2.5">
          {!summary ? (
            <>
              <button
                type="button"
                onClick={handleClose}
                disabled={isImporting}
                className="px-4 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStartImport}
                disabled={!selectedFile || isImporting}
                className="px-5 h-10 rounded-lg bg-[#BC881B] hover:bg-[#D4A02A] text-slate-950 text-xs font-bold uppercase tracking-wider inline-flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer shadow-sm"
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
            <button
              type="button"
              onClick={handleClose}
              className="px-6 h-10 rounded-lg bg-[#BC881B] hover:bg-[#D4A02A] text-slate-950 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm"
            >
              Done & View Catalog
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
export default ExcelImportModal;
