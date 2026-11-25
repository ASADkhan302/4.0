import React, { useEffect, useState, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Printer,
  FileDown,
  AlertTriangle,
  Check,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Info,
  Hash,
  Layers,
  CheckSquare,
  Clock,
} from 'lucide-react';
import { Book } from '../../types/library';
import { LibraryStorage } from '../../services/storage';
import {
  PdfGeneratorService,
  LABEL_SIZES,
  SHEET_TEMPLATES,
  LabelSizePreset,
  LabelSheetLayout,
} from '../../services/pdfGeneratorService';
import {
  buildBarcodeLabelsPrintHtml,
  openPrintablePdfDocument,
  printIsolatedHtml,
  saveJsPdfDocument,
} from '../../services/printAndPdfEngine';
import { useInstitutionalIdentity } from '../../utils/themeTransition';
import { evaluateScanSafety } from '../../utils/code128';
import { CrispCode128BarcodeSvg } from '../shared/CrispCode128BarcodeSvg';
import { notifyGlassToast } from '../ui/LiquidGlassToast';

type PrintScopeMode = 'selected' | 'range' | 'recent' | 'all';

interface BatchLabelPrintModalProps {
  isOpen: boolean;
  bookIds?: string[];
  books?: Book[];
  onClose: () => void;
}

function extractNumericAccession(book: Book): number | null {
  const serialNo = (book as Book & { serial_number?: number }).serial_number;
  if (typeof serialNo === 'number' && Number.isFinite(serialNo) && serialNo > 0) {
    return serialNo;
  }
  const raw = String(book.accession_no || book.barcode || '');
  const match = raw.match(/(\d+)/g);
  if (!match || match.length === 0) return null;
  const parsed = parseInt(match[match.length - 1], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export const BatchLabelPrintModal: React.FC<BatchLabelPrintModalProps> = ({
  isOpen,
  bookIds,
  books: passedBooks,
  onClose,
}) => {
  const identity = useInstitutionalIdentity();

  const [allActiveBooks, setAllActiveBooks] = useState<Book[]>([]);
  const [sizePreset, setSizePreset] = useState<LabelSizePreset>('standard');
  const [sheetLayout, setSheetLayout] = useState<LabelSheetLayout>('avery_l7160');
  const [startPosition, setStartPosition] = useState<number>(1);
  const [showCutLines, setShowCutLines] = useState<boolean>(true);
  const [autoThinSpine, setAutoThinSpine] = useState<boolean>(true);
  const [thinPageThreshold] = useState<number>(80);
  const [customWidth, setCustomWidth] = useState<number>(60);
  const [customHeight, setCustomHeight] = useState<number>(35);

  const [printScope, setPrintScope] = useState<PrintScopeMode>('selected');
  const [rangeFrom, setRangeFrom] = useState<number>(1);
  const [rangeTo, setRangeTo] = useState<number>(21);

  const [previewPage, setPreviewPage] = useState<number>(1);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [pdfProgress, setPdfProgress] = useState<{ current: number; total: number; page: number } | null>(null);
  const [statusNotification, setStatusNotification] = useState<{
    type: 'info' | 'success' | 'warn';
    message: string;
  } | null>(null);
  const cancelGenerationRef = useRef<boolean>(false);

  // Hydrate catalog snapshot & select default scope safely on open
  useEffect(() => {
    if (!isOpen) return;

    const catalog = LibraryStorage.getBooks().filter((b) => b.is_active !== false);
    setAllActiveBooks(catalog);

    const hasExplicitSelection = Boolean(
      (bookIds && bookIds.length > 0) || (passedBooks && passedBooks.length > 0)
    );
    setPrintScope(hasExplicitSelection ? 'selected' : 'recent');

    // Compute smart default accession range from catalog
    const accNumbers = catalog
      .map(extractNumericAccession)
      .filter((n): n is number => n !== null)
      .sort((a, b) => a - b);
    if (accNumbers.length > 0) {
      const minAcc = accNumbers[0];
      const maxAcc = accNumbers[Math.min(accNumbers.length - 1, 20)];
      setRangeFrom(minAcc);
      setRangeTo(Math.max(minAcc, maxAcc));
    } else {
      setRangeFrom(1);
      setRangeTo(21);
    }

    setPreviewPage(1);
    setStatusNotification(null);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, bookIds, passedBooks, onClose]);

  // Precompute the 4 scoped slices cleanly
  const selectedBooks = useMemo(() => {
    if (passedBooks && passedBooks.length > 0) {
      return passedBooks;
    }
    if (bookIds && bookIds.length > 0) {
      const idSet = new Set(bookIds);
      return allActiveBooks.filter((b) => idSet.has(b.id));
    }
    return [];
  }, [allActiveBooks, bookIds, passedBooks]);

  const recentBatchBooks = useMemo(() => {
    if (allActiveBooks.length === 0) return [];
    // Prefer latest import_batch_id if present, otherwise most recently added 21 volumes (1 full Avery L7160 sheet)
    const sortedByDate = [...allActiveBooks].sort((a, b) => {
      const ta = new Date(a.created_at || a.date_added || 0).getTime() || 0;
      const tb = new Date(b.created_at || b.date_added || 0).getTime() || 0;
      if (tb !== ta) return tb - ta;
      return (extractNumericAccession(b) || 0) - (extractNumericAccession(a) || 0);
    });
    const latestBatchId = sortedByDate[0]?.import_batch_id;
    if (latestBatchId) {
      const batch = sortedByDate.filter((b) => b.import_batch_id === latestBatchId);
      if (batch.length > 0 && batch.length <= 210) {
        return batch;
      }
    }
    return sortedByDate.slice(0, 21);
  }, [allActiveBooks]);

  const rangeBooks = useMemo(() => {
    const low = Math.min(rangeFrom || 1, rangeTo || 1);
    const high = Math.max(rangeFrom || 1, rangeTo || 1);
    return allActiveBooks
      .filter((b) => {
        const acc = extractNumericAccession(b);
        return acc !== null && acc >= low && acc <= high;
      })
      .sort((a, b) => (extractNumericAccession(a) || 0) - (extractNumericAccession(b) || 0));
  }, [allActiveBooks, rangeFrom, rangeTo]);

  const booksToPrint = useMemo(() => {
    if (printScope === 'selected') {
      return selectedBooks;
    }
    if (printScope === 'range') {
      return rangeBooks;
    }
    if (printScope === 'recent') {
      return recentBatchBooks;
    }
    return allActiveBooks;
  }, [printScope, selectedBooks, rangeBooks, recentBatchBooks, allActiveBooks]);

  // Reset preview page whenever scope or range changes
  useEffect(() => {
    setPreviewPage(1);
  }, [printScope, rangeFrom, rangeTo, sheetLayout, sizePreset, startPosition]);

  // Adjust sheet template recommendation based on size preset
  const handleSizeChange = (preset: LabelSizePreset) => {
    setSizePreset(preset);
    if (preset === 'small') {
      setSheetLayout('avery_l7651');
    } else if (preset === 'thin') {
      setSheetLayout('plain_a4_grid');
    } else if (preset === 'standard') {
      setSheetLayout('avery_l7160');
    }
  };

  if (!isOpen) return null;

  const currentTemplate = SHEET_TEMPLATES[sheetLayout];
  const currentSize = LABEL_SIZES[sizePreset];
  const targetW = sizePreset === 'custom' ? customWidth : currentSize.widthMm;
  const targetH = sizePreset === 'custom' ? customHeight : currentSize.heightMm;

  const sampleScanSafety = evaluateScanSafety(134, Math.max(10, targetW - 6));

  const labelsPerPage = Math.max(1, currentTemplate.labelsPerPage);
  const effectiveOffset = sheetLayout === 'thermal_roll' ? 0 : Math.max(0, startPosition - 1);
  const totalPreviewPages = Math.max(
    1,
    Math.ceil((booksToPrint.length + effectiveOffset) / labelsPerPage)
  );
  const safePreviewPage = Math.min(previewPage, totalPreviewPages);
  const pageStartIdx =
    safePreviewPage === 1
      ? 0
      : (safePreviewPage - 1) * labelsPerPage - effectiveOffset;
  const pageCountLimit =
    safePreviewPage === 1 ? Math.max(1, labelsPerPage - effectiveOffset) : labelsPerPage;
  const pageBooks = booksToPrint.slice(
    Math.max(0, pageStartIdx),
    Math.max(0, pageStartIdx) + pageCountLimit
  );

  // Handle Save as PDF (Scoped ONLY to booksToPrint)
  const handleSaveAsPdf = async () => {
    if (booksToPrint.length === 0) {
      setStatusNotification({
        type: 'warn',
        message: 'No volumes match the current print scope. Adjust your scope or accession range first.',
      });
      return;
    }
    setIsGeneratingPdf(true);
    cancelGenerationRef.current = false;
    setPdfProgress({ current: 0, total: booksToPrint.length, page: 1 });
    setStatusNotification({
      type: 'info',
      message: `Generating exact physical PDF for ${booksToPrint.length} volume(s)...`,
    });

    try {
      const result = await PdfGeneratorService.generateLabelsPdf(booksToPrint, {
        sizePreset,
        customWidthMm: customWidth,
        customHeightMm: customHeight,
        sheetLayout,
        startPosition,
        showCutLines,
        autoThinSpineThreshold: autoThinSpine ? thinPageThreshold : undefined,
        universityName: identity.universityName,
        libraryName: identity.libraryDepartmentName,
        onProgress: (current, total, page) => {
          setPdfProgress({ current, total, page });
        },
        shouldCancel: () => cancelGenerationRef.current,
      });

      if (!cancelGenerationRef.current) {
        await saveJsPdfDocument(result.doc, result.filename);
        setStatusNotification({
          type: 'success',
          message: `Saved ${result.labelCount} label(s) across ${result.pageCount} page(s) to ${result.filename}`,
        });
        notifyGlassToast({
          type: 'success',
          title: 'Barcode Labels PDF Saved',
          message: `Exported ${result.labelCount} label(s) across ${result.pageCount} page(s).`,
          meta: result.filename,
        });
      } else {
        setStatusNotification({ type: 'warn', message: 'PDF export was cancelled.' });
      }
    } catch (err: any) {
      setStatusNotification({
        type: 'warn',
        message: `Export error: ${err?.message || 'Failed to generate PDF'}`,
      });
      notifyGlassToast({
        type: 'danger',
        title: 'PDF Export Failed',
        message: err?.message || 'Failed to generate barcode labels PDF.',
      });
    } finally {
      setIsGeneratingPdf(false);
      setPdfProgress(null);
    }
  };

  // Handle Direct Isolated Print (Scoped ONLY to booksToPrint — never prints dark app shell or full catalog!)
  const handlePrint = async () => {
    if (booksToPrint.length === 0) {
      setStatusNotification({
        type: 'warn',
        message: 'No volumes match the current print scope. Select books or adjust the accession range.',
      });
      return;
    }
    setIsGeneratingPdf(true);
    setStatusNotification({
      type: 'info',
      message: `Preparing clean white-background print sheet for ${booksToPrint.length} label(s)...`,
    });

    try {
      const { html, pageCss } = buildBarcodeLabelsPrintHtml(booksToPrint, {
        sizePreset,
        customWidthMm: customWidth,
        customHeightMm: customHeight,
        sheetLayout,
        startPosition,
        showCutLines,
        autoThinSpineThreshold: autoThinSpine ? thinPageThreshold : undefined,
        universityName: identity.universityName,
        libraryName: identity.libraryDepartmentName,
      });

      const printRes = await printIsolatedHtml(
        `${identity.universityName} — Barcode Labels (${booksToPrint.length} Volumes)`,
        html,
        pageCss,
        async () => {
          const result = await PdfGeneratorService.generateLabelsPdf(booksToPrint, {
            sizePreset,
            customWidthMm: customWidth,
            customHeightMm: customHeight,
            sheetLayout,
            startPosition,
            showCutLines,
            autoThinSpineThreshold: autoThinSpine ? thinPageThreshold : undefined,
            universityName: identity.universityName,
            libraryName: identity.libraryDepartmentName,
          });
          await openPrintablePdfDocument(result.doc, result.filename);
        }
      );

      if (printRes.usedPdfFallback) {
        setStatusNotification({
          type: 'success',
          message: `Opened printable PDF for ${booksToPrint.length} label(s) (${totalPreviewPages} page${
            totalPreviewPages === 1 ? '' : 's'
          }) — press Ctrl+P to print.`,
        });
      } else if (!printRes.success && printRes.blocked) {
        setStatusNotification({
          type: 'warn',
          message:
            'Direct printing is blocked in this preview frame. Click "Save as PDF" to download and print cleanly.',
        });
        notifyGlassToast({
          type: 'warning',
          title: 'Print Unavailable',
          message: 'Use "Save as PDF" to download and print your barcode labels.',
        });
      } else {
        setStatusNotification({
          type: 'success',
          message: `Print dialog dispatched for ${booksToPrint.length} label(s) (${totalPreviewPages} page${
            totalPreviewPages === 1 ? '' : 's'
          }).`,
        });
        notifyGlassToast({
          type: 'info',
          title: 'Barcode Print Ready',
          message: `Dispatched ${booksToPrint.length} label(s) (${totalPreviewPages} page${
            totalPreviewPages === 1 ? '' : 's'
          }) to print dialog.`,
        });
      }
    } catch {
      setStatusNotification({
        type: 'warn',
        message: 'Direct printing is unavailable here. Use "Save as PDF" to download and print.',
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="ulm-modal-backdrop fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="ulm-modal-dialog w-full max-w-5xl max-h-[92vh] bg-gradient-to-b from-[#221F26] to-[#1A1A1A] border border-white/10 rounded-[20px] shadow-2xl overflow-hidden flex flex-col relative text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-[#BC881B]" />

        {/* Single-Row Studio Header */}
        <div className="px-5 py-3.5 border-b border-white/[0.08] flex items-center justify-between gap-3 shrink-0 bg-[#1A1A1A]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#BC881B]/15 border border-[#BC881B]/30 flex items-center justify-center text-[#E0B450] shrink-0">
              <Printer className="w-4.5 h-4.5 stroke-[2]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold text-white tracking-tight truncate">
                  Barcode &amp; Spine Label Studio
                </h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md font-mono text-[11px] font-bold bg-[#BC881B]/20 text-[#FFD147] border border-[#BC881B]/40 shrink-0">
                  {booksToPrint.length.toLocaleString()} {booksToPrint.length === 1 ? 'Volume' : 'Volumes'}
                </span>
                <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-md font-mono text-[10.5px] font-semibold bg-white/[0.06] text-slate-300 border border-white/10 shrink-0">
                  {totalPreviewPages} {totalPreviewPages === 1 ? 'Page' : 'Pages'}
                </span>
              </div>
              <p className="text-[11px] text-[#B3AABD] truncate mt-0.5">
                Exact physical millimetre dimensions · Avery die-cut sheets · Thermal roll · Vector Code-128 barcodes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isGeneratingPdf ? (
              <button
                type="button"
                onClick={() => {
                  cancelGenerationRef.current = true;
                }}
                className="h-8 px-3 rounded-xl bg-rose-600/20 border border-rose-500/40 text-rose-300 font-bold text-xs hover:bg-rose-600/30 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={booksToPrint.length === 0}
                  onClick={handleSaveAsPdf}
                  className="h-8 px-3.5 rounded-xl bg-gradient-to-r from-[#BC881B] to-[#D4A02A] hover:from-[#D4A02A] hover:to-[#E0B450] disabled:opacity-40 text-[#1A1A1A] font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  title="Generate high-resolution 300 DPI vector PDF for scoped volumes"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>Save as PDF</span>
                </button>

                <button
                  type="button"
                  disabled={booksToPrint.length === 0}
                  onClick={handlePrint}
                  className="h-8 px-3.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] disabled:opacity-40 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 border border-white/15 cursor-pointer whitespace-nowrap"
                  title="Print ONLY the scoped barcode labels on clean white paper"
                >
                  <Printer className="w-3.5 h-3.5 text-[#FFD147]" />
                  <span>Print ({booksToPrint.length})</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Close Barcode Label Studio"
              className="w-8 h-8 rounded-xl flex items-center justify-center text-[#B3AABD] hover:text-white bg-white/[0.05] hover:bg-white/[0.12] border border-white/10 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Dedicated 4-Tab Print Scope Bar */}
        <div className="px-5 py-2.5 bg-[#15121B] border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-slate-400 mr-1">
              Print Scope:
            </span>

            <button
              type="button"
              disabled={selectedBooks.length === 0}
              onClick={() => setPrintScope('selected')}
              className={`h-7 px-2.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 border transition-all cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed ${
                printScope === 'selected'
                  ? 'bg-[#BC881B] text-[#1A1A1A] border-[#FFD147]/70 font-bold shadow-xs'
                  : 'bg-white/[0.05] text-slate-300 border-white/10 hover:bg-white/[0.1]'
              }`}
              title="Print labels ONLY for the currently selected book(s)"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Selected ({selectedBooks.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setPrintScope('range')}
              className={`h-7 px-2.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 border transition-all cursor-pointer ${
                printScope === 'range'
                  ? 'bg-[#BC881B] text-[#1A1A1A] border-[#FFD147]/70 font-bold shadow-xs'
                  : 'bg-white/[0.05] text-slate-300 border-white/10 hover:bg-white/[0.1]'
              }`}
              title="Print labels for a specific Accession Number range"
            >
              <Hash className="w-3.5 h-3.5" />
              <span>Range (Acc #)</span>
            </button>

            <button
              type="button"
              onClick={() => setPrintScope('recent')}
              className={`h-7 px-2.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 border transition-all cursor-pointer ${
                printScope === 'recent'
                  ? 'bg-[#BC881B] text-[#1A1A1A] border-[#FFD147]/70 font-bold shadow-xs'
                  : 'bg-white/[0.05] text-slate-300 border-white/10 hover:bg-white/[0.1]'
              }`}
              title="Print labels for the most recent import batch or latest 21 additions"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Recent Batch ({recentBatchBooks.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setPrintScope('all')}
              className={`h-7 px-2.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 border transition-all cursor-pointer ${
                printScope === 'all'
                  ? 'bg-[#BC881B] text-[#1A1A1A] border-[#FFD147]/70 font-bold shadow-xs'
                  : 'bg-white/[0.05] text-slate-300 border-white/10 hover:bg-white/[0.1]'
              }`}
              title="Print labels for all active volumes in catalog"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>All Catalog ({allActiveBooks.length.toLocaleString()})</span>
            </button>
          </div>

          {/* Inline Accession Range Controls when Range tab is active */}
          {printScope === 'range' && (
            <div className="flex items-center gap-2 bg-white/[0.04] border border-amber-400/30 rounded-lg px-2.5 py-1">
              <span className="text-[11px] font-mono text-amber-300 font-semibold">Acc # From:</span>
              <input
                type="number"
                min={1}
                value={rangeFrom}
                onChange={(e) => setRangeFrom(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-20 h-6 bg-[#242129] border border-white/15 rounded-md px-2 text-xs font-mono text-white text-center outline-hidden focus:border-[#FFD147]"
              />
              <span className="text-[11px] font-mono text-amber-300 font-semibold">To:</span>
              <input
                type="number"
                min={1}
                value={rangeTo}
                onChange={(e) => setRangeTo(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-20 h-6 bg-[#242129] border border-white/15 rounded-md px-2 text-xs font-mono text-white text-center outline-hidden focus:border-[#FFD147]"
              />
              <span className="text-[10.5px] font-mono text-slate-300">
                ({rangeBooks.length} matched)
              </span>
            </div>
          )}
        </div>

        {/* Progress Notification Bar */}
        {pdfProgress && (
          <div className="px-5 py-2.5 bg-[#BC881B]/15 border-b border-[#BC881B]/30 flex items-center justify-between gap-4 text-xs shrink-0">
            <div className="flex items-center gap-2 text-[#E0B450] font-medium">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <span>
                Generating labels: {pdfProgress.current} / {pdfProgress.total} (Page {pdfProgress.page})...
              </span>
            </div>
            <div className="w-48 bg-black/40 h-2 rounded-full overflow-hidden border border-[#BC881B]/30">
              <div
                className="bg-[#E0B450] h-full transition-all duration-150"
                style={{ width: `${Math.round((pdfProgress.current / Math.max(1, pdfProgress.total)) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {statusNotification && !pdfProgress && (
          <div
            className={`px-5 py-2 border-b flex items-center justify-between text-xs shrink-0 ${
              statusNotification.type === 'warn'
                ? 'bg-amber-950/40 border-amber-600/30 text-amber-200'
                : statusNotification.type === 'success'
                ? 'bg-emerald-950/40 border-emerald-600/30 text-emerald-200'
                : 'bg-blue-950/40 border-blue-600/30 text-blue-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {statusNotification.type === 'warn' ? (
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              ) : (
                <Info className="w-4 h-4 shrink-0" />
              )}
              <span>{statusNotification.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusNotification(null)}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Configuration Controls Bar */}
        <div className="px-5 py-2.5 bg-[#17151A] border-b border-white/[0.06] flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex flex-wrap items-center gap-3">
            {/* Label Size */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-medium">Size:</span>
              <select
                value={sizePreset}
                onChange={(e) => handleSizeChange(e.target.value as LabelSizePreset)}
                className="bg-[#242129] border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white outline-hidden focus:border-[#BC881B] cursor-pointer"
              >
                {Object.values(LABEL_SIZES).map((sz) => (
                  <option key={sz.id} value={sz.id}>
                    {sz.name}
                  </option>
                ))}
              </select>
            </div>

            {sizePreset === 'custom' && (
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={20}
                  max={120}
                  value={customWidth}
                  onChange={(e) => setCustomWidth(Math.max(20, parseFloat(e.target.value) || 60))}
                  className="w-14 bg-[#242129] border border-white/10 rounded-lg px-1.5 py-1 text-xs text-center text-white font-mono"
                  title="Custom width (mm)"
                />
                <span className="text-slate-400">×</span>
                <input
                  type="number"
                  min={15}
                  max={100}
                  value={customHeight}
                  onChange={(e) => setCustomHeight(Math.max(15, parseFloat(e.target.value) || 35))}
                  className="w-14 bg-[#242129] border border-white/10 rounded-lg px-1.5 py-1 text-xs text-center text-white font-mono"
                  title="Custom height (mm)"
                />
                <span className="text-slate-400">mm</span>
              </div>
            )}

            {/* Sheet Template */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-medium">Layout:</span>
              <select
                value={sheetLayout}
                onChange={(e) => setSheetLayout(e.target.value as LabelSheetLayout)}
                className="bg-[#242129] border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white outline-hidden focus:border-[#BC881B] cursor-pointer"
              >
                {Object.values(SHEET_TEMPLATES).map((tmpl) => (
                  <option key={tmpl.id} value={tmpl.id}>
                    {tmpl.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Start at Position N */}
            {sheetLayout !== 'thermal_roll' && (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-medium">Start #:</span>
                <input
                  type="number"
                  min={1}
                  max={currentTemplate.labelsPerPage}
                  value={startPosition}
                  onChange={(e) => setStartPosition(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-14 bg-[#242129] border border-white/10 rounded-lg px-2 py-1 text-xs text-center text-white outline-hidden focus:border-[#BC881B]"
                  title="Skip used sticker slots on partially used sheets"
                />
              </div>
            )}

            {/* Cut Lines toggle */}
            {sheetLayout !== 'thermal_roll' && (
              <label className="!flex !mb-0 items-center gap-1.5 text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showCutLines}
                  onChange={(e) => setShowCutLines(e.target.checked)}
                  className="rounded border-slate-700 text-[#BC881B] focus:ring-0"
                />
                <span>Cut Guidelines</span>
              </label>
            )}

            {/* Auto thin spine for books < 80 pages */}
            <label className="!flex !mb-0 items-center gap-1.5 text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoThinSpine}
                onChange={(e) => setAutoThinSpine(e.target.checked)}
                className="rounded border-slate-700 text-[#BC881B] focus:ring-0"
              />
              <span>Thin spine (&lt; {thinPageThreshold} pp)</span>
            </label>
          </div>

          {/* Scannability Indicator */}
          <div className="flex items-center gap-2 text-[11px] font-mono">
            {!sampleScanSafety.isSafe ? (
              <span className="flex items-center gap-1 text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/30">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Module: {sampleScanSafety.moduleWidthMm.toFixed(2)}mm (tight)</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/30">
                <Check className="w-3.5 h-3.5" />
                <span>Module: {sampleScanSafety.moduleWidthMm.toFixed(2)}mm (Scan Safe)</span>
              </span>
            )}
          </div>
        </div>

        {/* Labels Scroll Preview Area */}
        <div className="flex-1 overflow-y-auto p-5 bg-[#121014]">
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
              <span>
                Previewing Page {safePreviewPage} of {totalPreviewPages} ({pageBooks.length} label
                {pageBooks.length === 1 ? '' : 's'} on this sheet)
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={safePreviewPage <= 1}
                  onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                  className="p-1 rounded-lg bg-[#242129] border border-white/10 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#2B2730] transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2">
                  {safePreviewPage} / {totalPreviewPages}
                </span>
                <button
                  type="button"
                  disabled={safePreviewPage >= totalPreviewPages}
                  onClick={() => setPreviewPage((p) => Math.min(totalPreviewPages, p + 1))}
                  className="p-1 rounded-lg bg-[#242129] border border-white/10 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#2B2730] transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {pageBooks.length === 0 ? (
              <div className="py-12 px-6 rounded-2xl bg-[#0A090D] border border-white/10 text-center space-y-2">
                <p className="text-sm font-bold text-white">No volumes match this print scope</p>
                <p className="text-xs text-slate-400">
                  Switch to Recent Batch, All Catalog, or broaden your Accession Number range above.
                </p>
              </div>
            ) : (
              <div
                className={`grid gap-3.5 p-4 rounded-xl bg-[#0A090D] border border-white/5 shadow-inner ${
                  sizePreset === 'thin'
                    ? 'grid-cols-2 sm:grid-cols-4 md:grid-cols-6'
                    : sizePreset === 'small'
                    ? 'grid-cols-1 sm:grid-cols-3 md:grid-cols-4'
                    : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                }`}
              >
                {pageBooks.map((b, idx) => {
                  const isThin =
                    (autoThinSpine && b.pages && b.pages < thinPageThreshold) || sizePreset === 'thin';
                  const barcode = b.barcode || 'ULM-00001';
                  const acc = b.accession_no || barcode.replace(/^[A-Z]+-/, '');

                  if (isThin) {
                    return (
                      <div
                        key={b.id || idx}
                        className="bg-white text-black p-2 rounded-[6px] border border-dashed border-gray-400 flex flex-col justify-between items-center text-center shadow-xs"
                        style={{ width: '100%', minHeight: '130px' }}
                      >
                        <div className="font-bold text-[8px] truncate max-w-full font-mono text-slate-800">
                          {b.dewey_call_number || '000 ULM'}
                        </div>

                        <div className="my-1.5 flex flex-col items-center justify-center">
                          <div className="w-16 h-4 bg-slate-100 flex items-center justify-center p-0.5 border border-slate-300 transform rotate-90 my-3">
                            <div className="w-full h-full bg-black flex items-center justify-between px-0.5">
                              <span className="text-[5px] text-white font-mono">|||||||||</span>
                            </div>
                          </div>
                        </div>

                        <div className="font-mono text-[7.5px] font-bold text-slate-800 pt-1 border-t border-slate-200 w-full truncate">
                          {barcode}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={b.id || idx}
                      className="bg-white text-black p-3 rounded-[8px] border border-dashed border-gray-400 flex flex-col justify-between space-y-1.5 shadow-sm"
                      style={{ minHeight: targetH < 26 ? '90px' : '140px' }}
                    >
                      {targetH >= 26 && (
                        <div className="text-center border-b border-gray-300 pb-1">
                          <p className="text-[8.5px] font-bold tracking-wider uppercase text-gray-800 leading-tight truncate">
                            {identity.universityName}
                          </p>
                          <p className="text-[7.5px] text-gray-600 font-semibold leading-tight truncate">
                            {identity.libraryDepartmentName}
                          </p>
                        </div>
                      )}

                      <div className="space-y-0.5 text-center">
                        <p className="text-[11px] font-bold leading-tight line-clamp-1">
                          {b.book_name}
                        </p>
                        {targetH >= 26 && (
                          <p className="text-[9.5px] text-gray-700 italic truncate">
                            {b.author || 'Author Unknown'}
                          </p>
                        )}
                        <p className="text-[9px] font-mono font-bold text-blue-900">
                          Call: {b.dewey_call_number || '000 ULM'}
                        </p>
                      </div>

                      <div className="w-full py-0.5 flex flex-col items-center justify-center">
                        <CrispCode128BarcodeSvg
                          value={barcode}
                          height={26}
                          showValue={true}
                          className="w-full max-w-[140px] drop-shadow-2xs"
                        />
                      </div>

                      <div className="flex items-center justify-between text-[8.5px] font-mono font-bold text-gray-800 pt-0.5 border-t border-gray-200">
                        <span>ACC: {acc}</span>
                        <span className="text-[8px] text-gray-500 font-normal">
                          {sheetLayout === 'thermal_roll'
                            ? 'Thermal'
                            : sheetLayout === 'avery_l7651'
                            ? 'L7651'
                            : 'A4 L7160'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="px-5 py-3 bg-[#1A1A1A] border-t border-white/[0.08] flex items-center justify-between text-xs text-[#B3AABD] shrink-0">
          <span className="font-mono truncate">
            Spec: {currentTemplate.name} • {targetW} × {targetH} mm • {booksToPrint.length} label
            {booksToPrint.length === 1 ? '' : 's'}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="h-8 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              disabled={booksToPrint.length === 0 || isGeneratingPdf}
              onClick={handlePrint}
              className="h-8 px-3.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] disabled:opacity-40 text-white border border-white/15 font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-[#FFD147]" />
              <span>Print</span>
            </button>
            <button
              type="button"
              disabled={booksToPrint.length === 0 || isGeneratingPdf}
              onClick={handleSaveAsPdf}
              className="h-8 px-4 rounded-xl bg-gradient-to-r from-[#BC881B] to-[#D4A02A] disabled:opacity-40 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Save as PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default BatchLabelPrintModal;
