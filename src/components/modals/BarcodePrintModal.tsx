import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, Bookmark, FileDown, Loader2, AlertTriangle, Layers, CheckCircle2 } from 'lucide-react';
import { Book } from '../../types/library';
import { PdfGeneratorService } from '../../services/pdfGeneratorService';
import {
  buildBarcodeLabelsPrintHtml,
  openPrintablePdfDocument,
  printIsolatedHtml,
  saveJsPdfDocument,
} from '../../services/printAndPdfEngine';
import { useInstitutionalIdentity } from '../../utils/themeTransition';
import { CrispCode128BarcodeSvg } from '../shared/CrispCode128BarcodeSvg';
import { notifyGlassToast } from '../ui/LiquidGlassToast';

interface BarcodePrintModalProps {
  book: Book | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenBatchStudio?: (bookId: string) => void;
}

export const BarcodePrintModal: React.FC<BarcodePrintModalProps> = ({
  book,
  isOpen,
  onClose,
  onOpenBatchStudio,
}) => {
  const identity = useInstitutionalIdentity();
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [statusNotice, setStatusNotice] = useState<{ type: 'warn' | 'success'; text: string } | null>(
    null
  );

  useEffect(() => {
    if (!isOpen) return;
    setStatusNotice(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !book) return null;

  const handleSaveAsPdf = async () => {
    setIsGeneratingPdf(true);
    setStatusNotice(null);
    try {
      const res = await PdfGeneratorService.generateLabelsPdf([book], {
        sizePreset: 'standard',
        sheetLayout: 'thermal_roll',
        universityName: identity.universityName,
        libraryName: identity.libraryDepartmentName,
      });
      const filename = `ULM_Spine_Label_${(book.barcode || book.accession_no || 'book').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
      const saved = await saveJsPdfDocument(res.doc, filename);
      setStatusNotice(
        saved
          ? { type: 'success', text: `Saved PDF label (${filename}).` }
          : { type: 'warn', text: 'Unable to save PDF file. Please try again.' }
      );
      if (saved) {
        notifyGlassToast({
          type: 'success',
          title: 'Spine Label PDF Saved',
          message: `Exported barcode label for "${book.book_name}".`,
          meta: filename,
        });
      }
    } catch (e: any) {
      setStatusNotice({
        type: 'warn',
        text: e?.message || 'Failed to export spine label PDF.',
      });
      notifyGlassToast({
        type: 'danger',
        title: 'PDF Export Failed',
        message: e?.message || 'Failed to export spine label PDF.',
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrint = async () => {
    setIsGeneratingPdf(true);
    setStatusNotice(null);
    try {
      const { html, pageCss } = buildBarcodeLabelsPrintHtml([book], {
        sizePreset: 'standard',
        sheetLayout: 'thermal_roll',
        showCutLines: false,
        universityName: identity.universityName,
        libraryName: identity.libraryDepartmentName,
      });
      const printRes = await printIsolatedHtml(
        `${identity.universityName} — Spine Label ${book.barcode}`,
        html,
        pageCss,
        async () => {
          const res = await PdfGeneratorService.generateLabelsPdf([book], {
            sizePreset: 'standard',
            sheetLayout: 'thermal_roll',
            universityName: identity.universityName,
            libraryName: identity.libraryDepartmentName,
          });
          const filename = `ULM_Spine_Label_${(book.barcode || book.accession_no || 'book').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
          await openPrintablePdfDocument(res.doc, filename);
        }
      );
      if (printRes.usedPdfFallback) {
        setStatusNotice({
          type: 'success',
          text: `Opened printable PDF label (${book.barcode}) — press Ctrl+P to print.`,
        });
      } else if (!printRes.success && printRes.blocked) {
        setStatusNotice({
          type: 'warn',
          text: 'Direct printing is blocked in this preview frame. Click "Save as PDF" to download and print.',
        });
        notifyGlassToast({
          type: 'warning',
          title: 'Print Unavailable',
          message: 'Use "Save as PDF" to download and print this spine label.',
        });
      } else {
        setStatusNotice({
          type: 'success',
          text: `Print dialog dispatched for 1 spine label (${book.barcode}).`,
        });
        notifyGlassToast({
          type: 'info',
          title: 'Spine Label Print Ready',
          message: `Dispatched 1 spine label to print dialog.`,
          meta: book.barcode,
        });
      }
    } catch {
      setStatusNotice({
        type: 'warn',
        text: 'Direct printing is unavailable here. Use "Save as PDF" to download your label.',
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 ulm-modal-backdrop bg-black/80 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="ulm-modal-dialog w-full max-w-md bg-white dark:bg-[#18151D] border border-slate-300 dark:border-white/10 rounded-[20px] shadow-2xl overflow-hidden flex flex-col text-slate-900 dark:text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-[#121014] border-b border-slate-200 dark:border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-mono text-amber-700 dark:text-[#E0B450] font-semibold uppercase tracking-wider">
            <Printer className="w-4 h-4" />
            <span>BARCODE LABEL THERMAL GENERATOR</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {statusNotice && (
          <div
            className={`px-4 py-2 border-b text-xs flex items-center gap-2 ${
              statusNotice.type === 'warn'
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-600/30 text-amber-900 dark:text-amber-200'
                : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-600/30 text-emerald-900 dark:text-emerald-200'
            }`}
          >
            {statusNotice.type === 'warn' ? (
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            )}
            <span>{statusNotice.text}</span>
          </div>
        )}

        {/* Printable Label Preview Area */}
        <div className="p-6 bg-slate-100 dark:bg-[#0E0D10] flex flex-col items-center justify-center space-y-3">
          <span className="text-xs font-mono text-slate-600 dark:text-[#B3AABD]">
            Standard 63.5 × 38.1 mm Adhesive Spine Label (1 Volume):
          </span>

          {/* Printable Sticker Container (Locked Optical Barcode Safe-Pad) */}
          <div
            id="printable-barcode-label"
            className="w-72 bg-white text-slate-950 p-4 rounded-lg shadow-md border-2 border-slate-300 space-y-2 text-center select-none ulm-barcode-safepad"
          >
            {/* Header */}
            <div className="border-b border-slate-300 pb-1.5 flex items-center justify-center gap-1.5">
              <Bookmark className="w-3.5 h-3.5 text-amber-600 fill-amber-600 shrink-0" />
              <span className="font-cinzel text-[10.5px] font-bold tracking-wider uppercase text-slate-900 truncate">
                {identity.universityName}
              </span>
            </div>

            {/* Book Name */}
            <div>
              <p className="font-semibold text-xs text-slate-950 line-clamp-1">
                {book.book_name}
              </p>
              <p className="text-xs text-slate-700 font-mono font-medium mt-0.5">
                Call: {book.dewey_call_number || '000 ULM'} · Shelf: {book.shelf || 'Main'}
              </p>
            </div>

            {/* Barcode vector graphic (Pure-White Crisp Code-128) */}
            <div className="py-1 flex flex-col items-center justify-center">
              <CrispCode128BarcodeSvg
                value={book.barcode}
                height={38}
                showValue={true}
                className="w-full max-w-[210px] mx-auto drop-shadow-2xs"
              />
            </div>

            {/* Footer */}
            <div className="border-t border-slate-300 pt-1 text-[9.5px] font-mono font-bold text-slate-700 uppercase tracking-wider truncate">
              {identity.libraryDepartmentName} • {identity.workstationNodeId || 'ULM'}
            </div>
          </div>
        </div>

        {/* Action Footer */}
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-[#121014] border-t border-slate-200 dark:border-white/[0.08] flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            {onOpenBatchStudio && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenBatchStudio(book.id);
                }}
                className="px-3 py-1.5 rounded-xl bg-purple-900/40 hover:bg-purple-900/60 text-purple-200 border border-purple-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Open this volume in Batch Label Studio"
              >
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Batch</span>
                <span>Studio</span>
              </button>
            )}

            <button
              type="button"
              disabled={isGeneratingPdf}
              onClick={handleSaveAsPdf}
              className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-[#BC881B] to-[#D4A02A] hover:from-[#D4A02A] hover:to-[#E0B450] text-[#1A1A1A] font-bold text-xs shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
            >
              {isGeneratingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileDown className="w-3.5 h-3.5" />
              )}
              <span>Save as PDF</span>
            </button>

            <button
              type="button"
              disabled={isGeneratingPdf}
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs flex items-center gap-1.5 border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
              <span>Print</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default BarcodePrintModal;
