import { jsPDF } from 'jspdf';
import type { Book } from '../types/library';
import { encodeCode128B } from '../utils/code128';
import { saveBinaryExport } from './desktopBridge';
import type { CardPdfLayout, LabelSheetLayout, LabelSizePreset } from './pdfGeneratorService';
import { LABEL_SIZES, SHEET_TEMPLATES } from './pdfGeneratorService';
import { ULM_OFFICIAL_CREST_SRC } from '../constants/ulmOfficialAssets';
import { getInstitutionalIdentity, type InstitutionalIdentity } from '../utils/themeTransition';
import { resolveCardRoleBadge, type CardMemberData } from '../components/library/UlmSmartIdCard';
import { resolveMemberCardStanding } from '../utils/memberStanding';
import { notifyGlassToast } from '../components/ui/LiquidGlassToast';

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const RTL_OR_NON_LATIN_REGEX = /[^\u0000-\u00FF]/;

/**
 * Renders English text as crisp vector text in jsPDF, and automatically renders
 * Urdu / Arabic / Pashto (or any non-Latin Unicode) via a 300-DPI offscreen HTML5
 * canvas so the browser's native HarfBuzz shaper produces perfect connected RTL glyphs!
 */
export function drawSmartPdfText(
  doc: any,
  rawText: string,
  xMm: number,
  yMm: number,
  maxWidthMm: number,
  opts: {
    fontSizePt: number;
    bold?: boolean;
    italic?: boolean;
    color?: string;
    align?: 'left' | 'center' | 'right';
    font?: 'helvetica' | 'times' | 'courier';
    maxLines?: number;
  }
): void {
  const text = String(rawText || '').trim();
  if (!text) return;

  const maxLines = Math.max(1, opts.maxLines || 1);

  // Pure Latin/English → fast vector jsPDF text
  if (!RTL_OR_NON_LATIN_REGEX.test(text)) {
    const style =
      opts.bold && opts.italic
        ? 'bolditalic'
        : opts.bold
        ? 'bold'
        : opts.italic
        ? 'italic'
        : 'normal';
    doc.setFont(opts.font || 'helvetica', style);
    doc.setFontSize(opts.fontSizePt);
    doc.setTextColor(opts.color || '#111827');
    const splitLines: string[] = doc.splitTextToSize(text, maxWidthMm);
    if (maxLines === 1) {
      const clipped = splitLines[0] || text;
      doc.text(clipped, xMm, yMm, { align: opts.align || 'left' });
    } else {
      const lines = splitLines.slice(0, maxLines);
      if (splitLines.length > maxLines && lines.length > 0) {
        const last = lines[lines.length - 1];
        lines[lines.length - 1] = last.length > 3 ? `${last.slice(0, -1).trimEnd()}…` : last;
      }
      doc.text(lines, xMm, yMm, { align: opts.align || 'left' });
    }
    return;
  }

  if (typeof document === 'undefined') return;

  // Urdu / Arabic / Pashto Unicode → 300-DPI native RTL Canvas rasterized into PDF!
  const pxPerMm = 12; // ~305 DPI razor-sharp print quality
  const widthPx = Math.max(40, Math.round(maxWidthMm * pxPerMm));
  const singleLineHeightMm = Math.max(3.6, opts.fontSizePt * 0.56);
  const fontSizePx = Math.round(opts.fontSizePt * 0.3528 * pxPerMm * 1.15);
  const fontSpec = `${opts.italic ? 'italic ' : ''}${opts.bold ? '700' : '500'} ${fontSizePx}px "Noto Nastaliq Urdu", "Jameel Noori Nastaleeq", "Segoe UI", Tahoma, Arial, sans-serif`;

  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d');
  if (!measureCtx) return;
  measureCtx.font = fontSpec;

  const fitWithEllipsis = (str: string): string => {
    let display = str;
    while (display.length > 3 && measureCtx.measureText(display).width > widthPx - 8) {
      display = display.slice(0, -1);
    }
    if (display.length < str.length) {
      display = '…' + display.trim();
    }
    return display;
  };

  let lines: string[] = [];
  if (maxLines === 1 || measureCtx.measureText(text).width <= widthPx - 8) {
    lines = [fitWithEllipsis(text)];
  } else {
    const words = text.split(/\s+/).filter(Boolean);
    let current = '';
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const candidate = current ? `${current} ${word}` : word;
      if (measureCtx.measureText(candidate).width <= widthPx - 8 || !current) {
        current = candidate;
      } else {
        lines.push(current);
        current = word;
        if (lines.length === maxLines - 1) {
          const rest = [current, ...words.slice(i + 1)].join(' ');
          lines.push(fitWithEllipsis(rest));
          current = '';
          break;
        }
      }
    }
    if (current && lines.length < maxLines) {
      lines.push(fitWithEllipsis(current));
    }
  }

  const totalHeightMm =
    lines.length === 1
      ? singleLineHeightMm
      : singleLineHeightMm * 0.92 * lines.length;
  const heightPx = Math.max(24, Math.round(totalHeightMm * pxPerMm));

  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, widthPx, heightPx);
  ctx.font = fontSpec;
  ctx.fillStyle = opts.color || '#111827';
  ctx.direction = 'rtl';
  ctx.textBaseline = 'middle';

  const rowHeightPx = heightPx / lines.length;
  lines.forEach((line, idx) => {
    const cy = rowHeightPx * (idx + 0.5);
    if (opts.align === 'center') {
      ctx.textAlign = 'center';
      ctx.fillText(line, widthPx / 2, cy);
    } else if (opts.align === 'right') {
      ctx.textAlign = 'right';
      ctx.fillText(line, widthPx - 4, cy);
    } else {
      ctx.textAlign = 'right';
      ctx.fillText(line, widthPx - 4, cy);
    }
  });

  const imgData = canvas.toDataURL('image/png');
  const drawX =
    opts.align === 'center'
      ? xMm - maxWidthMm / 2
      : opts.align === 'right'
        ? xMm - maxWidthMm
        : xMm;
  doc.addImage(
    imgData,
    'PNG',
    drawX,
    yMm - singleLineHeightMm * 0.72,
    maxWidthMm,
    totalHeightMm,
    undefined,
    'FAST'
  );
}

/**
 * Detects whether the app is currently running inside a sandboxed preview iframe
 * (e.g., Google AI Studio preview) where direct `window.print()` is blocked.
 */
export function isSandboxedPreviewIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/**
 * Opens a generated jsPDF document in a new printable browser tab via Blob URL,
 * automatically falling back to direct file download if popups are blocked.
 */
export async function openPrintablePdfDocument(
  doc: jsPDF,
  filename: string
): Promise<boolean> {
  const safeName = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;
  try {
    const blob = doc.output('blob');
    const blobUrl = URL.createObjectURL(blob);
    let opened: Window | null = null;
    try {
      opened = window.open(blobUrl, '_blank');
    } catch {
      opened = null;
    }

    if (opened) {
      setTimeout(() => {
        try {
          URL.revokeObjectURL(blobUrl);
        } catch {
          // ignore revoke error
        }
      }, 120000);
      return true;
    }

    // Popup blocked in sandboxed iframe → trigger automatic download cleanly
    URL.revokeObjectURL(blobUrl);
    return await saveJsPdfDocument(doc, safeName);
  } catch {
    return await saveJsPdfDocument(doc, safeName);
  }
}

/**
 * Prints an isolated white-background HTML document via a direct #ulm-print-mount
 * DOM portal with strict @media print isolation and automatic 3-tier routing:
 *  - Priority 1: Windows Desktop .exe native printCurrentView()
 *  - Priority 2: Sandboxed Preview Iframe → executes onIframePdfFallback() + Frosted Crystal toast
 *  - Priority 3: Standalone Browser Tab → native window.print()
 */
export async function printIsolatedHtml(
  title: string,
  bodyHtml: string,
  pageCss: string = '',
  onIframePdfFallback?: () => void | Promise<void>
): Promise<{ success: boolean; blocked?: boolean; usedPdfFallback?: boolean }> {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return { success: false, blocked: true };
  }

  const nativeApi = (window as any).desktopAPI || (window as any).electronAPI;
  const hasNativeDesktopPrint = typeof nativeApi?.printCurrentView === 'function';

  // Priority 2 — Sandboxed Preview Iframe (when NOT running inside native desktop .exe)
  if (!hasNativeDesktopPrint && isSandboxedPreviewIframe() && onIframePdfFallback) {
    try {
      await onIframePdfFallback();
      notifyGlassToast({
        type: 'info',
        title: 'Opened Printable PDF',
        message: 'Preview sandbox blocks direct print — press Ctrl+P on the PDF to print.',
      });
      return { success: true, usedPdfFallback: true };
    } catch {
      return { success: false, blocked: true };
    }
  }

  // Priority 1 (Windows Desktop .exe) & Priority 3 (Standalone Browser Tab)
  return new Promise((resolve) => {
    try {
      // 1. Remove any stale print mount or print stylesheet
      document.getElementById('ulm-print-mount')?.remove();
      document.getElementById('ulm-print-style')?.remove();

      // 2. Inject strict @media print isolation CSS
      const style = document.createElement('style');
      style.id = 'ulm-print-style';
      style.textContent = `
        #ulm-print-mount { display: none; }
        @media print {
          @page { margin: 8mm; }
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body > *:not(#ulm-print-mount) {
            display: none !important;
          }
          #ulm-print-mount,
          #ulm-print-mount * {
            visibility: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #ulm-print-mount {
            display: block !important;
            position: static !important;
            width: 100% !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: "Noto Nastaliq Urdu", "Jameel Noori Nastaleeq", "Segoe UI", Tahoma, Arial, Helvetica, sans-serif;
          }
          #ulm-print-mount *, #ulm-print-mount *::before, #ulm-print-mount *::after {
            box-sizing: border-box;
          }
          ${pageCss}
        }
      `;
      document.head.appendChild(style);

      // 3. Mount clean white printable HTML directly into document.body
      const mount = document.createElement('div');
      mount.id = 'ulm-print-mount';
      mount.innerHTML = bodyHtml;
      document.body.appendChild(mount);

      const prevTitle = document.title;
      document.title = title;

      let cleaned = false;
      const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        document.title = prevTitle;
        document.getElementById('ulm-print-mount')?.remove();
        document.getElementById('ulm-print-style')?.remove();
        window.removeEventListener('afterprint', cleanup);
      };
      window.addEventListener('afterprint', cleanup);

      // 4. Wait for all embedded images (e.g. 300-DPI CR80 canvases) to decode + 2 frames before Print
      const images = Array.from(mount.querySelectorAll('img'));
      const waitImages = Promise.all(
        images.map((img) => {
          if (img.complete && img.naturalWidth > 0) {
            return typeof img.decode === 'function' ? img.decode().catch(() => {}) : Promise.resolve();
          }
          return new Promise<void>((res) => {
            const done = () => res();
            img.addEventListener('load', done, { once: true });
            img.addEventListener('error', done, { once: true });
            setTimeout(done, 1200);
          });
        })
      );

      waitImages.then(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            try {
              if (hasNativeDesktopPrint) {
                nativeApi.printCurrentView().catch(() => window.print());
              } else {
                window.print();
              }
              resolve({ success: true });
            } catch {
              cleanup();
              resolve({ success: false, blocked: true });
              return;
            }
            // Safety cleanup fallback if afterprint does not fire
            setTimeout(cleanup, 60000);
          });
        });
      });
    } catch {
      resolve({ success: false, blocked: true });
    }
  });
}

/**
 * Persists a generated jsPDF document cleanly:
 * - In Windows Desktop `.exe` (`window.desktopAPI.saveBinaryFile`), opens native Windows Save dialog.
 * - In Browser, triggers a reliable Blob `<a download={filename}>` download.
 */
export async function saveJsPdfDocument(doc: jsPDF, filename: string): Promise<boolean> {
  const safeName = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;
  try {
    const dataUri = doc.output('datauristring');
    const base64 = dataUri.includes(',') ? dataUri.split(',')[1] : dataUri;
    const saved = await saveBinaryExport(safeName, base64);
    if (saved) return true;
  } catch {
    // Fall back to direct jsPDF save
  }

  try {
    doc.save(safeName);
    return true;
  } catch {
    return false;
  }
}

/**
 * Unified vector PDF generator & saver.
 */
export async function generateAndSavePdf(
  filename: string,
  buildPdf: (doc: jsPDF) => void | Promise<void>,
  options: {
    orientation?: 'p' | 'l';
    unit?: 'mm' | 'pt';
    format?: string | [number, number];
  } = {}
): Promise<{ ok: boolean; filename: string }> {
  const safeName = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;
  const doc = new jsPDF({
    orientation: options.orientation || 'p',
    unit: options.unit || 'mm',
    format: options.format || 'a4',
    compress: true,
  });

  await buildPdf(doc);
  const ok = await saveJsPdfDocument(doc, safeName);
  return { ok, filename: safeName };
}

/**
 * Generates an inline SVG string for a crisp, scannable Code-128B barcode (pure white background, black bars).
 */
export function buildCode128SvgMarkup(
  barcodeText: string,
  widthMm: number,
  heightMm: number
): string {
  const encoded = encodeCode128B(barcodeText || 'ULM-00001');
  const quietZone = 10;
  const totalModules = encoded.totalModules + quietZone * 2;
  let cursor = quietZone;
  const rects: string[] = [];

  for (const mod of encoded.modules) {
    if (mod.isBar) {
      rects.push(
        `<rect x="${cursor}" y="0" width="${mod.widthModules}" height="40" fill="#000000" />`
      );
    }
    cursor += mod.widthModules;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalModules} 40" preserveAspectRatio="none" style="width:${widthMm.toFixed(
    1
  )}mm;height:${heightMm.toFixed(
    1
  )}mm;display:block;margin:0 auto;background:#ffffff;shape-rendering:crispEdges;">
    <rect x="0" y="0" width="${totalModules}" height="40" fill="#ffffff" />
    ${rects.join('')}
  </svg>`;
}

/**
 * Builds exact physical-millimetre white-background HTML & @page CSS for scoped barcode label printing.
 */
export function buildBarcodeLabelsPrintHtml(
  books: Book[],
  options: {
    sizePreset: LabelSizePreset;
    customWidthMm?: number;
    customHeightMm?: number;
    sheetLayout: LabelSheetLayout;
    startPosition?: number;
    showCutLines?: boolean;
    autoThinSpineThreshold?: number;
    universityName?: string;
    libraryName?: string;
  }
): { html: string; pageCss: string } {
  const sizeSpec = LABEL_SIZES[options.sizePreset] || LABEL_SIZES.standard;
  const template = SHEET_TEMPLATES[options.sheetLayout] || SHEET_TEMPLATES.avery_l7160;
  const targetW =
    options.sizePreset === 'custom'
      ? options.customWidthMm || 60
      : options.sheetLayout === 'avery_l7160'
      ? 63.5
      : options.sheetLayout === 'avery_l7651'
      ? 38.1
      : sizeSpec.widthMm;
  const targetH =
    options.sizePreset === 'custom'
      ? options.customHeightMm || 35
      : options.sheetLayout === 'avery_l7160'
      ? 38.1
      : options.sheetLayout === 'avery_l7651'
      ? 21.2
      : sizeSpec.heightMm;

  const univ = (options.universityName || 'UNIVERSITY OF LAKKI MARWAT').toUpperCase();
  const lib = (options.libraryName || 'CENTRAL CAMPUS LIBRARY').toUpperCase();
  const borderRule = options.showCutLines ? '0.25mm dashed #9ca3af' : 'none';

  const renderLabelCard = (b: Book): string => {
    const barcode = b.barcode || b.accession_no || 'ULM-00001';
    const acc = b.accession_no || barcode.replace(/^[A-Z]+-/, '');
    const callNo = b.dewey_call_number || '000 ULM';
    const isThin =
      options.sizePreset === 'thin' ||
      Boolean(options.autoThinSpineThreshold && b.pages && b.pages < options.autoThinSpineThreshold);

    if (isThin) {
      const svg = buildCode128SvgMarkup(barcode, Math.max(24, targetH - 12), Math.max(7, targetW - 5));
      return `<div class="label-cell thin-cell">
        <div class="call-top">${escapeHtml(callNo)}</div>
        <div class="rot-wrap">${svg}</div>
        <div class="code-foot">${escapeHtml(barcode)}</div>
      </div>`;
    }

    const barcodeW = Math.max(24, targetW - 8);
    const barcodeH = targetH < 26 ? 7.5 : 10.5;
    const svg = buildCode128SvgMarkup(barcode, barcodeW, barcodeH);

    return `<div class="label-cell">
      ${
        targetH >= 26
          ? `<div class="hdr">
              <div class="univ">${escapeHtml(univ)}</div>
              <div class="lib">${escapeHtml(lib)}</div>
            </div>`
          : ''
      }
      <div class="meta">
        <div class="title" dir="auto">${escapeHtml(b.book_name || 'Untitled Volume')}</div>
        <div class="call">Call: ${escapeHtml(callNo)}</div>
      </div>
      <div class="bc-wrap">
        ${svg}
        <div class="bc-text">${escapeHtml(barcode)}</div>
      </div>
      <div class="ftr">
        <span>ACC: ${escapeHtml(acc)}</span>
        <span>${escapeHtml(b.shelf_no ? `S-${b.shelf_no}` : b.shelf || 'ULM')}</span>
      </div>
    </div>`;
  };

  if (options.sheetLayout === 'thermal_roll') {
    const pageCss = `
      @page { size: ${targetW}mm ${targetH}mm; margin: 0; }
      .thermal-page {
        width: ${targetW}mm;
        height: ${targetH}mm;
        page-break-after: always;
        break-after: page;
        display: flex;
        align-items: stretch;
        justify-content: stretch;
        background: #ffffff;
      }
      .thermal-page:last-child { page-break-after: auto; break-after: auto; }
      .label-cell {
        width: 100%;
        height: 100%;
        padding: 1.8mm 2.2mm;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        overflow: hidden;
        background: #ffffff;
        color: #000000;
      }
      .hdr { text-align: center; border-bottom: 0.2mm solid #cbd5e1; padding-bottom: 0.8mm; }
      .univ { font-size: 6.5pt; font-weight: 800; letter-spacing: 0.3px; }
      .lib { font-size: 5.5pt; font-weight: 600; color: #334155; }
      .meta { text-align: center; }
      .title { font-size: 7.2pt; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: "Noto Nastaliq Urdu", "Jameel Noori Nastaleeq", "Segoe UI", Tahoma, Arial, sans-serif; }
      .call { font-size: 6.2pt; font-family: monospace; font-weight: 700; color: #1e3a8a; }
      .bc-wrap { text-align: center; padding: 0.5mm 0; }
      .bc-text { font-family: monospace; font-size: 6.5pt; font-weight: 800; letter-spacing: 0.8px; margin-top: 0.5mm; }
      .ftr { display: flex; justify-content: space-between; border-top: 0.2mm solid #e2e8f0; padding-top: 0.5mm; font-family: monospace; font-size: 5.8pt; font-weight: 700; }
      .thin-cell { align-items: center; text-align: center; }
      .call-top, .code-foot { font-family: monospace; font-size: 6pt; font-weight: 700; }
      .rot-wrap { transform: rotate(90deg); margin: auto 0; }
    `;
    const html = books.map((b) => `<div class="thermal-page">${renderLabelCard(b)}</div>`).join('');
    return { html, pageCss };
  }

  // A4 Sheet layout (Avery L7160 / L7651 / Plain A4 Grid)
  const cols =
    options.sheetLayout === 'plain_a4_grid'
      ? Math.max(1, Math.floor((210 - 16 + 2) / (targetW + 2)))
      : template.columns;
  const rows =
    options.sheetLayout === 'plain_a4_grid'
      ? Math.max(1, Math.floor((297 - 16 + 2) / (targetH + 2)))
      : template.rows;
  const perPage = Math.max(1, cols * rows);
  const offset = Math.max(0, Math.min(perPage - 1, (options.startPosition || 1) - 1));

  const slots: Array<Book | null> = [
    ...Array.from({ length: offset }, () => null),
    ...books,
  ];
  const pages: Array<Array<Book | null>> = [];
  for (let i = 0; i < slots.length; i += perPage) {
    pages.push(slots.slice(i, i + perPage));
  }

  const pageCss = `
    @page { size: A4 portrait; margin: 0; }
    .a4-page {
      width: 210mm;
      height: 297mm;
      padding-top: ${template.topMarginMm}mm;
      padding-left: ${template.leftMarginMm}mm;
      page-break-after: always;
      break-after: page;
      background: #ffffff;
    }
    .a4-page:last-child { page-break-after: auto; break-after: auto; }
    .label-grid {
      display: grid;
      grid-template-columns: repeat(${cols}, ${targetW}mm);
      grid-auto-rows: ${targetH}mm;
      column-gap: ${template.colGapMm}mm;
      row-gap: ${template.rowGapMm}mm;
    }
    .label-slot {
      width: ${targetW}mm;
      height: ${targetH}mm;
      overflow: hidden;
    }
    .label-cell {
      width: 100%;
      height: 100%;
      border: ${borderRule};
      padding: ${targetH < 26 ? '1mm 1.5mm' : '1.6mm 2.2mm'};
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
      background: #ffffff;
      color: #000000;
    }
    .hdr { text-align: center; border-bottom: 0.2mm solid #cbd5e1; padding-bottom: 0.7mm; }
    .univ { font-size: 6.2pt; font-weight: 800; letter-spacing: 0.3px; }
    .lib { font-size: 5.2pt; font-weight: 600; color: #334155; }
    .meta { text-align: center; }
    .title { font-size: ${targetH < 26 ? '6pt' : '7pt'}; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: "Noto Nastaliq Urdu", "Jameel Noori Nastaleeq", "Segoe UI", Tahoma, Arial, sans-serif; }
    .call { font-size: ${targetH < 26 ? '5.5pt' : '6pt'}; font-family: monospace; font-weight: 700; color: #1e3a8a; }
    .bc-wrap { text-align: center; padding: 0.4mm 0; }
    .bc-text { font-family: monospace; font-size: ${targetH < 26 ? '5.5pt' : '6.2pt'}; font-weight: 800; letter-spacing: 0.6px; margin-top: 0.4mm; }
    .ftr { display: flex; justify-content: space-between; border-top: 0.2mm solid #e2e8f0; padding-top: 0.4mm; font-family: monospace; font-size: 5.4pt; font-weight: 700; }
    .thin-cell { align-items: center; text-align: center; }
    .call-top, .code-foot { font-family: monospace; font-size: 5.6pt; font-weight: 700; }
    .rot-wrap { transform: rotate(90deg); margin: auto 0; }
  `;

  const html = pages
    .map(
      (pageSlots) => `<div class="a4-page"><div class="label-grid">${pageSlots
        .map((slot) =>
          slot ? `<div class="label-slot">${renderLabelCard(slot)}</div>` : `<div class="label-slot"></div>`
        )
        .join('')}</div></div>`
    )
    .join('');

  return { html, pageCss };
}

// ============================================================================
// 300-DPI CR80 MASTER CANVAS RENDERER (1011 x 638 px = 85.60 x 53.98 mm)
// Shared by BOTH Save as PDF and Print CR80 Card for 100% Preview Fidelity
// ============================================================================

export const CR80_CANVAS_WIDTH_PX = 1011;
export const CR80_CANVAS_HEIGHT_PX = 638;
export const CR80_WIDTH_MM = 85.6;
export const CR80_HEIGHT_MM = 53.98;

export interface Cr80RenderOptions {
  watermarkAlpha?: number;
  identity?: Partial<InstitutionalIdentity>;
  crestSrc?: string;
}

const imageLoadCache = new Map<string, Promise<HTMLImageElement | null>>();

function loadCanvasImage(src?: string | null): Promise<HTMLImageElement | null> {
  if (!src || typeof Image === 'undefined') return Promise.resolve(null);
  const key = src.slice(0, 256) + `::${src.length}`;
  const cached = imageLoadCache.get(key);
  if (cached) return cached;

  const promise = new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    if (!src.startsWith('data:') && !src.startsWith('blob:')) {
      img.crossOrigin = 'anonymous';
    }
    const timer = setTimeout(() => resolve(null), 2500);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    img.src = src;
  });

  if (imageLoadCache.size > 40) {
    imageLoadCache.clear();
  }
  imageLoadCache.set(key, promise);
  return promise;
}

function traceRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function truncateCanvasText(
  ctx: CanvasRenderingContext2D,
  raw: string,
  maxWidth: number
): string {
  const text = String(raw || '').trim();
  if (!text) return '';
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 2 && ctx.measureText(`${out}…`).width > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out.trimEnd()}…`;
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  raw: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const words = String(raw || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = '';
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) {
        const rest = [current, ...words.slice(i + 1)].join(' ');
        lines.push(truncateCanvasText(ctx, rest, maxWidth));
        return lines;
      }
    }
  }
  if (current && lines.length < maxLines) {
    lines.push(truncateCanvasText(ctx, current, maxWidth));
  }
  return lines;
}

function drawSmartCanvasText(
  ctx: CanvasRenderingContext2D,
  rawText: string,
  x: number,
  y: number,
  maxWidth: number,
  opts: {
    fontSizePx: number;
    weight?: string;
    italic?: boolean;
    family?: string;
    color: string;
    align?: 'left' | 'center' | 'right';
    autoShrinkMinPx?: number;
  }
) {
  const text = String(rawText || '').trim();
  if (!text) return;

  const isRtl = RTL_OR_NON_LATIN_REGEX.test(text);
  const family = isRtl
    ? '"Noto Nastaliq Urdu", "Jameel Noori Nastaleeq", "Segoe UI", Tahoma, Arial, sans-serif'
    : opts.family || '"Plus Jakarta Sans", "Segoe UI", Arial, sans-serif';
  const weight = opts.weight || '700';
  const italic = opts.italic ? 'italic ' : '';

  let size = opts.fontSizePx;
  ctx.save();
  ctx.fillStyle = opts.color;
  ctx.textBaseline = 'alphabetic';
  ctx.direction = isRtl ? 'rtl' : 'ltr';
  ctx.textAlign = opts.align || 'left';

  if (opts.autoShrinkMinPx) {
    while (size > opts.autoShrinkMinPx) {
      ctx.font = `${italic}${weight} ${size}px ${family}`;
      if (ctx.measureText(text).width <= maxWidth) break;
      size -= 0.8;
    }
  }
  ctx.font = `${italic}${weight} ${size}px ${family}`;

  const fitted = truncateCanvasText(ctx, text, maxWidth);
  const drawX = isRtl && (!opts.align || opts.align === 'left') ? x + maxWidth : x;
  if (isRtl && (!opts.align || opts.align === 'left')) {
    ctx.textAlign = 'right';
  }
  ctx.fillText(fitted, drawX, y);
  ctx.restore();
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const imgRatio = img.naturalWidth / Math.max(1, img.naturalHeight);
  const boxRatio = w / Math.max(1, h);
  let sx = 0;
  let sy = 0;
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;

  if (imgRatio > boxRatio) {
    sw = img.naturalHeight * boxRatio;
    sx = (img.naturalWidth - sw) / 2;
  } else {
    sh = img.naturalWidth / boxRatio;
    sy = (img.naturalHeight - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

/**
 * Renders one side ('front' or 'back') of an ISO/IEC 7810 ID-1 CR80 Smart ID Card
 * at exact 300-DPI resolution (1011 x 638 px = 85.60 mm x 53.98 mm).
 * Used identically by BOTH Save as PDF and Print CR80 Card.
 */
export async function renderCr80SideToDataUrl(
  card: CardMemberData,
  side: 'front' | 'back',
  options: Cr80RenderOptions = {}
): Promise<string> {
  if (typeof document === 'undefined') return '';

  const W = CR80_CANVAS_WIDTH_PX;
  const H = CR80_CANVAS_HEIGHT_PX;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const baseIdentity = getInstitutionalIdentity();
  const identity: InstitutionalIdentity = {
    ...baseIdentity,
    ...(options.identity || {}),
  };

  const roleBadge = resolveCardRoleBadge(card);
  const watermarkAlpha = Math.max(2, Math.min(20, options.watermarkAlpha ?? 6.5));
  const crestSrc = options.crestSrc || identity.customCrestUrl || ULM_OFFICIAL_CREST_SRC;

  const [crestImg, photoImg] = await Promise.all([
    loadCanvasImage(crestSrc),
    side === 'front' && card.photoUrl ? loadCanvasImage(card.photoUrl) : Promise.resolve(null),
  ]);

  // 1. Clip entire card to crisp CR80 rounded rectangle (radius 28px = ~2.37mm)
  ctx.save();
  traceRoundedRect(ctx, 2, 2, W - 4, H - 4, 28);
  ctx.clip();

  // Pure white print-safe card base
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);

  // Subtle guilloche dot micro-mesh
  for (let gx = 16; gx < W; gx += 32) {
    for (let gy = 16; gy < H; gy += 32) {
      ctx.fillStyle = (gx + gy) % 64 === 0 ? 'rgba(59, 16, 84, 0.045)' : 'rgba(200, 150, 62, 0.05)';
      ctx.beginPath();
      ctx.arc(gx, gy, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Centered ULM Crest Watermark calibrated by watermarkAlpha
  if (crestImg) {
    ctx.save();
    ctx.globalAlpha = watermarkAlpha / 100;
    const wmSize = side === 'front' ? 338 : 326;
    const wmX = (W - wmSize) / 2;
    const wmY = side === 'front' ? (H - wmSize) / 2 + 24 : (H - wmSize) / 2;
    ctx.drawImage(crestImg, wmX, wmY, wmSize, wmSize);
    ctx.restore();
  }

  if (side === 'front') {
    // ================= FRONT HEADER (0..134) =================
    const headerH = 128;
    const hdrGrad = ctx.createLinearGradient(0, 0, W, 0);
    hdrGrad.addColorStop(0, '#3B0764');
    hdrGrad.addColorStop(0.55, '#581C87');
    hdrGrad.addColorStop(1, '#6B21A8');
    ctx.fillStyle = hdrGrad;
    ctx.fillRect(0, 0, W, headerH);

    // Gold bottom divider of header
    ctx.fillStyle = '#C8963E';
    ctx.fillRect(0, headerH, W, 6);

    // Left Crest Circle
    const crestCx = 58;
    const crestCy = 64;
    const crestR = 36;
    ctx.save();
    ctx.beginPath();
    ctx.arc(crestCx, crestCy, crestR, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#FFD147';
    ctx.stroke();
    if (crestImg) {
      ctx.beginPath();
      ctx.arc(crestCx, crestCy, crestR - 4, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(crestImg, crestCx - 31, crestCy - 31, 62, 62);
    }
    ctx.restore();

    // Right Gold Role Pill (measured first so title NEVER collides with MARWAT)
    ctx.save();
    ctx.font = '900 16.5px "Plus Jakarta Sans", "Segoe UI", Arial, sans-serif';
    const badgeTextW = ctx.measureText(roleBadge).width;
    const pillW = Math.max(146, Math.ceil(badgeTextW + 34));
    const pillH = 38;
    const pillX = W - 24 - pillW;
    const pillY = Math.round((headerH - pillH) / 2);

    const pillGrad = ctx.createLinearGradient(pillX, pillY, pillX + pillW, pillY + pillH);
    pillGrad.addColorStop(0, '#FFD147');
    pillGrad.addColorStop(1, '#C8963E');
    traceRoundedRect(ctx, pillX, pillY, pillW, pillH, 10);
    ctx.fillStyle = pillGrad;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#FFF3B0';
    ctx.stroke();

    ctx.fillStyle = '#1E0730';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(roleBadge, pillX + pillW / 2, pillY + pillH / 2 + 1);
    ctx.restore();

    // University Header Text Stack (strictly bounded before pillX - 18)
    const titleX = 110;
    const titleMaxW = Math.max(200, pillX - titleX - 18);

    drawSmartCanvasText(ctx, identity.universityName.toUpperCase(), titleX, 49, titleMaxW, {
      fontSizePx: 23,
      autoShrinkMinPx: 16,
      weight: '900',
      color: '#FFFFFF',
    });
    drawSmartCanvasText(ctx, identity.libraryDepartmentName.toUpperCase(), titleX, 79, titleMaxW, {
      fontSizePx: 17,
      autoShrinkMinPx: 13,
      weight: '800',
      color: '#FFD147',
    });
    drawSmartCanvasText(ctx, identity.campusAddress, titleX, 106, titleMaxW, {
      fontSizePx: 14.5,
      weight: '600',
      color: 'rgba(255, 255, 255, 0.88)',
    });

    // ================= FRONT LEFT COLUMN: PHOTO & STANDING PILL =================
    const standing = resolveMemberCardStanding(card, card.validTill);
    const isInvalidStanding = standing.state === 'EXPIRED' || standing.state === 'SUSPENDED';

    const photoX = 28;
    const photoY = 160;
    const photoW = 194;
    const photoH = 242;

    // Outer halo + inner frame (red accent when expired or suspended)
    ctx.save();
    traceRoundedRect(ctx, photoX - 3, photoY - 3, photoW + 6, photoH + 6, 20);
    ctx.strokeStyle = isInvalidStanding ? standing.borderColor : '#C8963E';
    ctx.lineWidth = 3;
    ctx.stroke();

    traceRoundedRect(ctx, photoX, photoY, photoW, photoH, 17);
    ctx.fillStyle = '#F8FAFC';
    ctx.fill();

    ctx.save();
    traceRoundedRect(ctx, photoX, photoY, photoW, photoH, 17);
    ctx.clip();
    if (photoImg) {
      drawCoverImage(ctx, photoImg, photoX, photoY, photoW, photoH);
    } else {
      // Crisp stylized avatar placeholder
      const avCx = photoX + photoW / 2;
      const avCy = photoY + 96;
      ctx.beginPath();
      ctx.arc(avCx, avCy, 44, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(59, 16, 84, 0.10)';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = 'rgba(200, 150, 62, 0.65)';
      ctx.stroke();

      // Head & shoulders silhouette
      ctx.fillStyle = '#3B1054';
      ctx.beginPath();
      ctx.arc(avCx, avCy - 12, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(avCx, avCy + 24, 24, Math.PI, 0, false);
      ctx.fill();

      ctx.font = '800 16px "Plus Jakarta Sans", "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = '#3B1054';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PASSPORT PHOTO', avCx, photoY + 178);
    }
    ctx.restore();

    traceRoundedRect(ctx, photoX, photoY, photoW, photoH, 17);
    ctx.strokeStyle = isInvalidStanding ? standing.dotColor : '#3B1054';
    ctx.lineWidth = 4.5;
    ctx.stroke();
    ctx.restore();

    // Crimson Blood Group Badge (top-right inside photo frame)
    const bgText = String(card.bloodGroup || 'B-').toUpperCase();
    ctx.save();
    ctx.font = '900 17px "Plus Jakarta Sans", "Segoe UI", Arial, sans-serif';
    const bgW = Math.max(46, Math.ceil(ctx.measureText(bgText).width + 18));
    const bgH = 28;
    const bgX = photoX + photoW - 10 - bgW;
    const bgY = photoY + 10;
    traceRoundedRect(ctx, bgX, bgY, bgW, bgH, 7);
    ctx.fillStyle = '#DC2626';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(bgText, bgX + bgW / 2, bgY + bgH / 2 + 0.5);
    ctx.restore();

    // Dynamic Account Standing Capsule Pill (ACTIVE MEMBER / EXPIRING SOON / CARD EXPIRED / SUSPENDED)
    const activeX = 24;
    const activeY = 418;
    const activeW = 202;
    const activeH = 34;
    ctx.save();
    traceRoundedRect(ctx, activeX, activeY, activeW, activeH, 17);
    ctx.fillStyle = standing.bgColor;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = standing.borderColor;
    ctx.stroke();

    const pillFontSize = standing.label.length > 12 ? 14.5 : 15.5;
    ctx.font = `900 ${pillFontSize}px "Plus Jakarta Sans", "Segoe UI", Arial, sans-serif`;
    const dotRadius = 5.5;
    const dotGap = 10;
    const labelW = ctx.measureText(standing.label).width;
    const contentW = dotRadius * 2 + dotGap + labelW;
    const startX = activeX + Math.max(12, (activeW - contentW) / 2);

    ctx.beginPath();
    ctx.arc(startX + dotRadius, activeY + activeH / 2, dotRadius, 0, Math.PI * 2);
    ctx.fillStyle = standing.dotColor;
    ctx.fill();

    ctx.fillStyle = standing.textColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(standing.label, startX + dotRadius * 2 + dotGap, activeY + activeH / 2 + 0.5);
    ctx.restore();

    // ================= FRONT RIGHT COLUMN: METADATA GRID =================
    const infoX = 248;
    const infoRight = W - 28;
    const infoW = infoRight - infoX;

    // Member ID Pill (top right of info column)
    const memberIdText = (card.memberId || 'ULM0329984').toUpperCase();
    ctx.save();
    ctx.font = '800 20px "JetBrains Mono", "Consolas", "Courier New", monospace';
    const idPillW = Math.max(142, Math.ceil(ctx.measureText(memberIdText).width + 26));
    const idPillH = 34;
    const idPillX = infoRight - idPillW;
    const idPillY = 182;

    drawSmartCanvasText(ctx, 'MEMBER ID', infoRight, 174, 180, {
      fontSizePx: 14.5,
      weight: '800',
      color: '#64748B',
      align: 'right',
    });

    traceRoundedRect(ctx, idPillX, idPillY, idPillW, idPillH, 8);
    ctx.fillStyle = '#F3E8FF';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(200, 150, 62, 0.65)';
    ctx.stroke();

    ctx.fillStyle = '#3B1054';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(memberIdText, idPillX + idPillW / 2, idPillY + idPillH / 2 + 1);
    ctx.restore();

    // Borrower Full Name (left of Member ID pill, full Urdu/English support)
    const nameMaxW = Math.max(160, idPillX - infoX - 18);
    drawSmartCanvasText(ctx, 'BORROWER FULL NAME', infoX, 174, nameMaxW, {
      fontSizePx: 15,
      weight: '800',
      color: '#64748B',
    });
    drawSmartCanvasText(ctx, card.name || 'Library Member', infoX, 211, nameMaxW, {
      fontSizePx: 29,
      autoShrinkMinPx: 20,
      weight: '900',
      color: '#1A1027',
    });

    // Divider under Name
    ctx.fillStyle = '#E2E8F0';
    ctx.fillRect(infoX, 228, infoW, 2);

    const col1X = infoX;
    const col2X = infoX + Math.round(infoW / 2) + 12;
    const halfW = Math.round(infoW / 2) - 12;

    // Row 1: Roll No / Reg ID | Academic Session
    drawSmartCanvasText(ctx, 'ROLL NO / REG ID', col1X, 256, halfW, {
      fontSizePx: 14.5,
      weight: '800',
      color: '#64748B',
    });
    drawSmartCanvasText(ctx, card.rollNo || 'N/A', col1X, 282, halfW, {
      fontSizePx: 21,
      autoShrinkMinPx: 16,
      weight: '800',
      family: '"JetBrains Mono", "Consolas", "Courier New", monospace',
      color: '#1A1027',
    });

    drawSmartCanvasText(ctx, 'ACADEMIC SESSION', col2X, 256, halfW, {
      fontSizePx: 14.5,
      weight: '800',
      color: '#64748B',
    });
    drawSmartCanvasText(ctx, card.session || 'Active', col2X, 282, halfW, {
      fontSizePx: 21,
      autoShrinkMinPx: 16,
      weight: '800',
      color: '#1A1027',
    });

    // Row 2: Program / Designation
    drawSmartCanvasText(ctx, 'PROGRAM / DESIGNATION', col1X, 318, infoW, {
      fontSizePx: 14.5,
      weight: '800',
      color: '#64748B',
    });
    drawSmartCanvasText(ctx, card.program || 'Academic Program', col1X, 345, infoW, {
      fontSizePx: 22,
      autoShrinkMinPx: 16,
      weight: '900',
      color: '#3B1054',
    });

    // Row 3: Department
    drawSmartCanvasText(ctx, 'DEPARTMENT', col1X, 382, infoW, {
      fontSizePx: 14.5,
      weight: '800',
      color: '#64748B',
    });
    drawSmartCanvasText(ctx, card.department || 'Central Campus', col1X, 408, infoW, {
      fontSizePx: 20.5,
      autoShrinkMinPx: 15,
      weight: '800',
      color: '#1A1027',
    });

    // Row 4: Borrowing Privilege | Valid Till
    drawSmartCanvasText(ctx, 'BORROWING PRIVILEGE', col1X, 446, halfW, {
      fontSizePx: 14.5,
      weight: '800',
      color: '#64748B',
    });
    drawSmartCanvasText(ctx, card.borrowingLimit || '03 Books (14 Days)', col1X, 472, halfW, {
      fontSizePx: 19.5,
      autoShrinkMinPx: 15,
      weight: '800',
      color: '#047857',
    });

    drawSmartCanvasText(ctx, 'VALID TILL', col2X, 446, halfW, {
      fontSizePx: 14.5,
      weight: '800',
      color: '#64748B',
    });
    drawSmartCanvasText(ctx, (card.validTill || '30 JUN 2027').toUpperCase(), col2X, 472, halfW, {
      fontSizePx: 19.5,
      autoShrinkMinPx: 15,
      weight: '800',
      family: '"JetBrains Mono", "Consolas", "Courier New", monospace',
      color: standing.validTillColor,
    });

    // ================= FRONT BOTTOM BARCODE FOOTER (524..638) =================
    const footerY = 524;
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, footerY, W, H - footerY);
    ctx.fillStyle = '#E2E8F0';
    ctx.fillRect(0, footerY, W, 2);

    // Real ISO/IEC 15417 Code-128B Barcode with generous bottom breathing room (24px clear)
    const bcPlateX = 28;
    const bcPlateY = footerY + 14;
    const bcPlateW = 428;
    const bcPlateH = 52;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(bcPlateX, bcPlateY, bcPlateW, bcPlateH);

    const encoded = encodeCode128B(memberIdText);
    const quietModules = 10;
    const totalMods = encoded.totalModules + quietModules * 2;
    const modPx = bcPlateW / Math.max(1, totalMods);
    let cursorX = bcPlateX + quietModules * modPx;
    ctx.fillStyle = '#0F172A';
    for (const mod of encoded.modules) {
      const barW = mod.widthModules * modPx;
      if (mod.isBar) {
        ctx.fillRect(Math.round(cursorX), bcPlateY + 2, Math.max(1, Math.ceil(barW)), bcPlateH - 4);
      }
      cursorX += barW;
    }

    // Human-readable *ID* caption well above bottom border (y=612 vs H=638 -> 26px breathing room)
    drawSmartCanvasText(ctx, `*${memberIdText}*`, bcPlateX + 6, footerY + 89, bcPlateW, {
      fontSizePx: 16.5,
      weight: '800',
      family: '"JetBrains Mono", "Consolas", "Courier New", monospace',
      color: '#334155',
    });

    // Right Issuing Authority Signature Block
    drawSmartCanvasText(ctx, 'Chief Librarian', infoRight, footerY + 42, 260, {
      fontSizePx: 21,
      weight: '700',
      italic: true,
      family: '"Cinzel", Georgia, "Times New Roman", serif',
      color: '#3B1054',
      align: 'right',
    });
    ctx.fillStyle = '#94A3B8';
    ctx.fillRect(infoRight - 228, footerY + 54, 228, 2);
    drawSmartCanvasText(ctx, 'ISSUING AUTHORITY • ULM', infoRight, footerY + 79, 260, {
      fontSizePx: 14.5,
      weight: '800',
      color: '#475569',
      align: 'right',
    });
  } else {
    // ================= BACK TOP PURPLE HEADER (0..82) =================
    const topH = 80;
    const topGrad = ctx.createLinearGradient(0, 0, W, 0);
    topGrad.addColorStop(0, '#3B0764');
    topGrad.addColorStop(0.55, '#581C87');
    topGrad.addColorStop(1, '#6B21A8');
    ctx.fillStyle = topGrad;
    ctx.fillRect(0, 0, W, topH);
    ctx.fillStyle = '#C8963E';
    ctx.fillRect(0, topH, W, 5);

    // Shield badge accent
    ctx.save();
    ctx.fillStyle = '#FFD147';
    ctx.beginPath();
    ctx.moveTo(38, 26);
    ctx.lineTo(52, 31);
    ctx.lineTo(52, 44);
    ctx.quadraticCurveTo(52, 54, 38, 59);
    ctx.quadraticCurveTo(24, 54, 24, 44);
    ctx.lineTo(24, 31);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#3B0764';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(32, 42);
    ctx.lineTo(36.5, 47);
    ctx.lineTo(45, 36);
    ctx.stroke();
    ctx.restore();

    const memberIdText = (card.memberId || 'ULM0329984').toUpperCase();
    drawSmartCanvasText(ctx, 'INSTITUTIONAL LIBRARY MEMBERSHIP TERMS', 64, 49, 680, {
      fontSizePx: 19,
      weight: '900',
      color: '#FFD147',
    });
    drawSmartCanvasText(ctx, `ID: ${memberIdText}`, W - 28, 49, 240, {
      fontSizePx: 18.5,
      weight: '800',
      family: '"JetBrains Mono", "Consolas", "Courier New", monospace',
      color: '#FFFFFF',
      align: 'right',
    });

    // ================= BACK BODY: LEFT RULES + RIGHT QR =================
    const leftX = 30;
    const leftW = 684;

    drawSmartCanvasText(ctx, 'LIBRARY BORROWING TERMS & DISCIPLINE', leftX, 124, leftW, {
      fontSizePx: 19.5,
      weight: '900',
      color: '#3B1054',
    });
    ctx.fillStyle = '#E2E8F0';
    ctx.fillRect(leftX, 136, leftW, 2);

    const rules = [
      'This card is strictly non-transferable and must be presented at the Circulation Desk for every checkout or return.',
      'Overdue fine of Rs. 10/- per day per volume applies after the standard borrowing window.',
      `Loss or damage of this Smart Card must be reported immediately to the ${identity.libraryDepartmentName} administration.`,
      'Final clearance requires returning all issued library books and settling any outstanding dues.',
    ];

    ctx.save();
    ctx.font = '600 17.5px "Plus Jakarta Sans", "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#1E293B';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';

    let ruleY = 170;
    for (const rule of rules) {
      // Gold check-bullet circle
      ctx.fillStyle = '#C8963E';
      ctx.beginPath();
      ctx.arc(leftX + 9, ruleY - 6, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(leftX + 9, ruleY - 6, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#1E293B';
      const lines = wrapCanvasText(ctx, rule, leftW - 28, 3);
      for (const line of lines) {
        ctx.fillText(line, leftX + 26, ruleY);
        ruleY += 24;
      }
      ruleY += 12;
    }
    ctx.restore();

    // Contact & Blood Group Strip
    const stripY = 466;
    const stripH = 54;
    ctx.save();
    traceRoundedRect(ctx, leftX, stripY, leftW, stripH, 12);
    ctx.fillStyle = '#F8FAFC';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#CBD5E1';
    ctx.stroke();

    const bloodText = `Blood: ${String(card.bloodGroup || 'B-').toUpperCase()}`;
    ctx.font = '900 16.5px "Plus Jakarta Sans", "Segoe UI", Arial, sans-serif';
    const bloodPillW = Math.max(108, Math.ceil(ctx.measureText(bloodText).width + 26));
    const bloodPillX = leftX + leftW - 14 - bloodPillW;
    const bloodPillY = stripY + 11;
    traceRoundedRect(ctx, bloodPillX, bloodPillY, bloodPillW, 32, 8);
    ctx.fillStyle = '#FEE2E2';
    ctx.fill();
    ctx.fillStyle = '#991B1B';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(bloodText, bloodPillX + bloodPillW / 2, bloodPillY + 16.5);

    drawSmartCanvasText(
      ctx,
      `Holder Contact: ${card.phone || 'On Record'}`,
      leftX + 18,
      stripY + 34,
      bloodPillX - leftX - 32,
      {
        fontSizePx: 17.5,
        weight: '800',
        family: '"JetBrains Mono", "Plus Jakarta Sans", "Segoe UI", monospace',
        color: '#0F172A',
      }
    );
    ctx.restore();

    // Right Verification QR Card
    const qrBoxX = 738;
    const qrBoxY = 110;
    const qrBoxW = 245;
    const qrBoxH = 410;
    ctx.save();
    traceRoundedRect(ctx, qrBoxX, qrBoxY, qrBoxW, qrBoxH, 18);
    ctx.fillStyle = '#F8FAFC';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#E2E8F0';
    ctx.stroke();

    // White QR plate
    const qrSize = 186;
    const qrPad = 12;
    const qrX = qrBoxX + (qrBoxW - qrSize) / 2;
    const qrY = qrBoxY + 34;
    traceRoundedRect(ctx, qrX - qrPad, qrY - qrPad, qrSize + qrPad * 2, qrSize + qrPad * 2, 10);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#CBD5E1';
    ctx.stroke();

    // Exact 29x29 deterministic QR matrix matching VerificationQr in UlmSmartIdCard
    const grid = 29;
    const matrix: boolean[][] = Array.from({ length: grid }, () => Array(grid).fill(false));
    const drawFinder = (r0: number, c0: number) => {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          const border = r === 0 || r === 6 || c === 0 || c === 6;
          const inner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          if (border || inner) matrix[r0 + r][c0 + c] = true;
        }
      }
    };
    drawFinder(0, 0);
    drawFinder(0, grid - 7);
    drawFinder(grid - 7, 0);

    const payload = `ULM|${memberIdText}|${card.name}|${card.rollNo}|${card.validTill}`;
    let hash = 2166136261;
    for (let i = 0; i < payload.length; i++) {
      hash ^= payload.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    for (let r = 0; r < grid; r++) {
      for (let c = 0; c < grid; c++) {
        const inFinder =
          (r < 8 && c < 8) || (r < 8 && c >= grid - 8) || (r >= grid - 8 && c < 8);
        if (inFinder) continue;
        if (r === 6 || c === 6) {
          matrix[r][c] = (r + c) % 2 === 0;
          continue;
        }
        const seed = Math.imul(r * 31 + c * 17, hash >>> 0);
        matrix[r][c] = ((seed >>> 3) & 1) === 1;
      }
    }

    const cell = qrSize / grid;
    ctx.fillStyle = '#1E0730';
    for (let r = 0; r < grid; r++) {
      for (let c = 0; c < grid; c++) {
        if (matrix[r][c]) {
          ctx.fillRect(
            qrX + c * cell,
            qrY + r * cell,
            Math.ceil(cell + 0.3),
            Math.ceil(cell + 0.3)
          );
        }
      }
    }

    drawSmartCanvasText(ctx, 'SCAN TO VERIFY', qrBoxX + qrBoxW / 2, qrY + qrSize + 44, qrBoxW - 20, {
      fontSizePx: 16.5,
      weight: '900',
      color: '#3B1054',
      align: 'center',
    });
    drawSmartCanvasText(ctx, memberIdText, qrBoxX + qrBoxW / 2, qrY + qrSize + 72, qrBoxW - 24, {
      fontSizePx: 15.5,
      weight: '700',
      family: '"JetBrains Mono", "Consolas", "Courier New", monospace',
      color: '#64748B',
      align: 'center',
    });
    ctx.restore();

    // ================= BACK PURPLE CAMPUS ADDRESS FOOTER (546..638) =================
    const backFooterY = 546;
    const ftrGrad = ctx.createLinearGradient(0, backFooterY, W, backFooterY);
    ftrGrad.addColorStop(0, '#3B0764');
    ftrGrad.addColorStop(0.55, '#581C87');
    ftrGrad.addColorStop(1, '#6B21A8');
    ctx.fillStyle = ftrGrad;
    ctx.fillRect(0, backFooterY, W, H - backFooterY);
    ctx.fillStyle = '#C8963E';
    ctx.fillRect(0, backFooterY, W, 5);

    drawSmartCanvasText(ctx, 'IF FOUND, PLEASE RETURN TO:', 30, backFooterY + 38, 640, {
      fontSizePx: 16,
      weight: '900',
      color: '#FFD147',
    });
    drawSmartCanvasText(ctx, identity.campusAddress, 30, backFooterY + 67, 650, {
      fontSizePx: 15.5,
      weight: '600',
      color: 'rgba(255, 255, 255, 0.95)',
    });

    drawSmartCanvasText(ctx, identity.contactPhone, W - 30, backFooterY + 38, 280, {
      fontSizePx: 16.5,
      weight: '800',
      family: '"JetBrains Mono", "Consolas", "Courier New", monospace',
      color: '#FFD147',
      align: 'right',
    });
    drawSmartCanvasText(ctx, identity.circulationEmail, W - 30, backFooterY + 67, 280, {
      fontSizePx: 15.5,
      weight: '600',
      color: 'rgba(255, 255, 255, 0.88)',
      align: 'right',
    });
  }

  ctx.restore();

  // Outer Gold CR80 Border (#C8963E) drawn cleanly over clipped perimeter
  ctx.save();
  traceRoundedRect(ctx, 2, 2, W - 4, H - 4, 28);
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = '#C8963E';
  ctx.stroke();
  ctx.restore();

  return canvas.toDataURL('image/png');
}

export interface RenderedCr80CardImages {
  memberId: string;
  name: string;
  frontUrl?: string;
  backUrl?: string;
}

/**
 * Builds exact-dimension ISO/IEC 7810 ID-1 CR80 print HTML & @page CSS from
 * pre-rendered 300-DPI master PNGs — zero CSS drift, zero missing gradients,
 * and zero trailing blank pages.
 */
export function buildCr80CardsPrintHtml(
  renderedCards: RenderedCr80CardImages[],
  options: {
    layout: CardPdfLayout;
    activeSide: 'both' | 'front' | 'back';
  }
): { html: string; pageCss: string } {
  const { layout, activeSide } = options;

  if (layout === 'cr80_single') {
    const pages: string[] = [];
    for (const card of renderedCards) {
      if ((activeSide === 'both' || activeSide === 'front') && card.frontUrl) {
        pages.push(
          `<div class="cr80-single-page"><img src="${card.frontUrl}" alt="${escapeHtml(card.name)} Front" class="cr80-img" /></div>`
        );
      }
      if ((activeSide === 'both' || activeSide === 'back') && card.backUrl) {
        pages.push(
          `<div class="cr80-single-page"><img src="${card.backUrl}" alt="${escapeHtml(card.name)} Back" class="cr80-img" /></div>`
        );
      }
    }

    const pageCss = `
      @page { size: 85.6mm 53.98mm; margin: 0; }
      .cr80-single-page {
        width: 85.60mm;
        height: 53.98mm;
        margin: 0;
        padding: 0;
        overflow: hidden;
        background: #ffffff !important;
        page-break-after: always;
        break-after: page;
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .cr80-single-page:last-child {
        page-break-after: auto;
        break-after: auto;
      }
      .cr80-img {
        width: 85.60mm;
        height: 53.98mm;
        display: block;
        object-fit: fill;
      }
    `;

    return { html: pages.join(''), pageCss };
  }

  if (layout === 'a4_duplex') {
    // 10 cards per A4 page (2 cols x 5 rows): Fronts page, then Mirrored Backs page
    const perPage = 10;
    const sheets: string[] = [];
    for (let i = 0; i < renderedCards.length; i += perPage) {
      const chunk = renderedCards.slice(i, i + perPage);
      if (activeSide === 'both' || activeSide === 'front') {
        const frontCells = chunk
          .map(
            (c) =>
              `<div class="a4-card-slot"><img src="${c.frontUrl || ''}" alt="${escapeHtml(c.name)} Front" class="cr80-img" /></div>`
          )
          .join('');
        sheets.push(`<div class="a4-sheet"><div class="a4-grid">${frontCells}</div></div>`);
      }
      if (activeSide === 'both' || activeSide === 'back') {
        // Mirror columns per row for long-edge duplex alignment
        const mirroredCells: string[] = [];
        for (let row = 0; row < Math.ceil(chunk.length / 2); row++) {
          const left = chunk[row * 2];
          const right = chunk[row * 2 + 1];
          mirroredCells.push(
            right
              ? `<div class="a4-card-slot"><img src="${right.backUrl || ''}" alt="${escapeHtml(right.name)} Back" class="cr80-img" /></div>`
              : `<div class="a4-card-slot a4-empty-slot"></div>`
          );
          mirroredCells.push(
            left
              ? `<div class="a4-card-slot"><img src="${left.backUrl || ''}" alt="${escapeHtml(left.name)} Back" class="cr80-img" /></div>`
              : `<div class="a4-card-slot a4-empty-slot"></div>`
          );
        }
        sheets.push(`<div class="a4-sheet"><div class="a4-grid">${mirroredCells.join('')}</div></div>`);
      }
    }

    const pageCss = `
      @page { size: A4 portrait; margin: 10mm; }
      .a4-sheet {
        width: 190mm;
        margin: 0 auto;
        background: #ffffff !important;
        page-break-after: always;
        break-after: page;
      }
      .a4-sheet:last-child {
        page-break-after: auto;
        break-after: auto;
      }
      .a4-grid {
        display: grid;
        grid-template-columns: repeat(2, 85.60mm);
        column-gap: 4mm;
        row-gap: 2.5mm;
        justify-content: center;
      }
      .a4-card-slot {
        width: 85.60mm;
        height: 53.98mm;
        overflow: hidden;
        outline: 0.25mm dashed #94a3b8;
        outline-offset: 0.4mm;
        background: #ffffff !important;
      }
      .a4-empty-slot { outline: none; }
      .cr80-img {
        width: 85.60mm;
        height: 53.98mm;
        display: block;
        object-fit: fill;
      }
    `;

    return { html: sheets.join(''), pageCss };
  }

  // Default A4 Sheet: Front + Back side-by-side in crisp 2-column grid with dashed cut-marks
  const slots: string[] = [];
  for (const card of renderedCards) {
    if (activeSide === 'both') {
      if (card.frontUrl) {
        slots.push(
          `<div class="a4-card-slot"><img src="${card.frontUrl}" alt="${escapeHtml(card.name)} Front" class="cr80-img" /></div>`
        );
      }
      if (card.backUrl) {
        slots.push(
          `<div class="a4-card-slot"><img src="${card.backUrl}" alt="${escapeHtml(card.name)} Back" class="cr80-img" /></div>`
        );
      }
    } else if (activeSide === 'front' && card.frontUrl) {
      slots.push(
        `<div class="a4-card-slot"><img src="${card.frontUrl}" alt="${escapeHtml(card.name)} Front" class="cr80-img" /></div>`
      );
    } else if (activeSide === 'back' && card.backUrl) {
      slots.push(
        `<div class="a4-card-slot"><img src="${card.backUrl}" alt="${escapeHtml(card.name)} Back" class="cr80-img" /></div>`
      );
    }
  }

  const perSheet = 10;
  const sheets: string[] = [];
  for (let i = 0; i < slots.length; i += perSheet) {
    sheets.push(
      `<div class="a4-sheet"><div class="a4-grid">${slots.slice(i, i + perSheet).join('')}</div></div>`
    );
  }

  const pageCss = `
    @page { size: A4 portrait; margin: 10mm; }
    .a4-sheet {
      width: 190mm;
      margin: 0 auto;
      background: #ffffff !important;
      page-break-after: always;
      break-after: page;
    }
    .a4-sheet:last-child {
      page-break-after: auto;
      break-after: auto;
    }
    .a4-grid {
      display: grid;
      grid-template-columns: repeat(2, 85.60mm);
      column-gap: 4mm;
      row-gap: 2.5mm;
      justify-content: center;
    }
    .a4-card-slot {
      width: 85.60mm;
      height: 53.98mm;
      overflow: hidden;
      outline: 0.25mm dashed #94a3b8;
      outline-offset: 0.4mm;
      background: #ffffff !important;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .cr80-img {
      width: 85.60mm;
      height: 53.98mm;
      display: block;
      object-fit: fill;
    }
  `;

  return { html: sheets.join(''), pageCss };
}

