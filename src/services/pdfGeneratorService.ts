import { jsPDF } from 'jspdf';
import { Book, Borrower } from '../types/library';
import { encodeCode128B, evaluateScanSafety } from '../utils/code128';
import { ULM_CREST_SRC, ULM_CREST_WATERMARK_SRC } from '../assets/ulmCrest';

export type LabelSizePreset = 'standard' | 'medium' | 'small' | 'thin' | 'custom';
export type LabelSheetLayout = 'avery_l7160' | 'avery_l7651' | 'plain_a4_grid' | 'thermal_roll';

export interface LabelSizeConfig {
  id: LabelSizePreset;
  name: string;
  widthMm: number;
  heightMm: number;
  description: string;
}

export const LABEL_SIZES: Record<LabelSizePreset, LabelSizeConfig> = {
  standard: {
    id: 'standard',
    name: 'Standard (63.5 × 38.1 mm)',
    widthMm: 63.5,
    heightMm: 38.1,
    description: 'Full details: University, library, title, author, call no, barcode, ACC & ULM ID',
  },
  medium: {
    id: 'medium',
    name: 'Medium (50.0 × 25.0 mm)',
    widthMm: 50.0,
    heightMm: 25.0,
    description: 'Compact: Short title, call number, barcode & ULM ID',
  },
  small: {
    id: 'small',
    name: 'Small (38.1 × 21.2 mm)',
    widthMm: 38.1,
    heightMm: 21.2,
    description: 'Miniature: Barcode, ULM number & call number (Avery L7651 size)',
  },
  thin: {
    id: 'thin',
    name: 'Thin Spine (15.0 × 38.0 mm)',
    widthMm: 15.0,
    heightMm: 38.0,
    description: 'Rotated: Barcode runs 90° along narrow spine with ULM ID & call no',
  },
  custom: {
    id: 'custom',
    name: 'Custom Size',
    widthMm: 60.0,
    heightMm: 35.0,
    description: 'Custom millimetre width and height specification',
  },
};

export interface SheetTemplateConfig {
  id: LabelSheetLayout;
  name: string;
  labelsPerPage: number;
  columns: number;
  rows: number;
  labelWidthMm: number;
  labelHeightMm: number;
  topMarginMm: number;
  leftMarginMm: number;
  colGapMm: number;
  rowGapMm: number;
  description: string;
}

export const SHEET_TEMPLATES: Record<LabelSheetLayout, SheetTemplateConfig> = {
  avery_l7160: {
    id: 'avery_l7160',
    name: 'Avery L7160 / J8160 (21 per sheet)',
    labelsPerPage: 21,
    columns: 3,
    rows: 7,
    labelWidthMm: 63.5,
    labelHeightMm: 38.1,
    topMarginMm: 15.1,
    leftMarginMm: 7.2,
    colGapMm: 2.5,
    rowGapMm: 0,
    description: 'Official A4 3×7 die-cut label sheet. Standard European/Asian library format.',
  },
  avery_l7651: {
    id: 'avery_l7651',
    name: 'Avery L7651 (65 per sheet)',
    labelsPerPage: 65,
    columns: 5,
    rows: 13,
    labelWidthMm: 38.1,
    labelHeightMm: 21.2,
    topMarginMm: 10.7,
    leftMarginMm: 4.7,
    colGapMm: 2.5,
    rowGapMm: 0,
    description: 'High-density A4 5×13 die-cut label sheet for compact spine labels.',
  },
  plain_a4_grid: {
    id: 'plain_a4_grid',
    name: 'Plain A4 Paper Grid (Auto layout)',
    labelsPerPage: 24,
    columns: 3,
    rows: 7,
    labelWidthMm: 63.5,
    labelHeightMm: 38.1,
    topMarginMm: 8.0,
    leftMarginMm: 8.0,
    colGapMm: 2.0,
    rowGapMm: 2.0,
    description: 'Standard copier paper with auto-calculated rows, columns, and cutting lines.',
  },
  thermal_roll: {
    id: 'thermal_roll',
    name: 'Continuous Thermal Roll (1 label / page)',
    labelsPerPage: 1,
    columns: 1,
    rows: 1,
    labelWidthMm: 63.5,
    labelHeightMm: 38.1,
    topMarginMm: 0,
    leftMarginMm: 0,
    colGapMm: 0,
    rowGapMm: 0,
    description: 'Direct thermal roll printer (Zebra, TSC, Brother, Xprinter). Continuous feed.',
  },
};

export interface LabelJobOptions {
  sizePreset: LabelSizePreset;
  customWidthMm?: number;
  customHeightMm?: number;
  sheetLayout: LabelSheetLayout;
  startPosition?: number; // 1-based index on first sheet (1 to labelsPerPage)
  showCutLines?: boolean;
  autoThinSpineThreshold?: number; // Auto switch to thin spine if pages < threshold (e.g. 80)
  onProgress?: (current: number, total: number, page: number) => void;
  shouldCancel?: () => boolean;
}

export type CardPdfLayout = 'cr80_single' | 'a4_sheet_10' | 'a4_duplex';

export interface CardPdfOptions {
  layout: CardPdfLayout;
  onProgress?: (current: number, total: number) => void;
  shouldCancel?: () => boolean;
}

export class PdfGeneratorService {
  /**
   * Generates a high-precision Code-128 barcode directly using vector rectangles in jsPDF.
   */
  static drawVectorCode128(
    doc: jsPDF,
    barcodeText: string,
    xMm: number,
    yMm: number,
    availableWidthMm: number,
    heightMm: number,
    options: {
      showText?: boolean;
      fontSizePt?: number;
      textColor?: [number, number, number];
      rotate90?: boolean;
    } = {}
  ): { moduleWidthMm: number; isSafe: boolean; warning?: string } {
    const encoded = encodeCode128B(barcodeText);
    const quietZoneModules = 20; // 10 modules on each side
    const totalModulesWithQuiet = encoded.totalModules + quietZoneModules;

    const moduleWidthMm = availableWidthMm / totalModulesWithQuiet;
    const safety = evaluateScanSafety(encoded.totalModules, availableWidthMm);

    doc.saveGraphicsState();

    if (options.rotate90) {
      // Rotate 90 degrees around (xMm, yMm)
      doc.setCurrentTransformationMatrix(doc.Matrix(0, 1, -1, 0, xMm, yMm));
      xMm = 0;
      yMm = 0;
    }

    // Draw background quiet zone box (white)
    doc.setFillColor(255, 255, 255);
    doc.rect(xMm, yMm, availableWidthMm, heightMm, 'F');

    // Draw bars
    let currentX = xMm + (10 * moduleWidthMm); // 10 modules left quiet zone
    doc.setFillColor(0, 0, 0);

    for (const mod of encoded.modules) {
      const barWidth = mod.widthModules * moduleWidthMm;
      if (mod.isBar) {
        doc.rect(currentX, yMm, barWidth, heightMm, 'F');
      }
      currentX += barWidth;
    }

    // Human readable text underneath barcode
    if (options.showText) {
      doc.setFont('courier', 'bold');
      doc.setFontSize(options.fontSizePt || 7);
      if (options.textColor) {
        doc.setTextColor(options.textColor[0], options.textColor[1], options.textColor[2]);
      } else {
        doc.setTextColor(20, 20, 20);
      }
      const textX = xMm + (availableWidthMm / 2);
      const textY = yMm + heightMm + 2.5;
      doc.text(encoded.text, textX, textY, { align: 'center' });
    }

    doc.restoreGraphicsState();
    return safety;
  }

  /**
   * Generates a batch barcode labels PDF document.
   */
  static async generateLabelsPdf(
    books: Book[],
    options: LabelJobOptions
  ): Promise<{ doc: jsPDF; filename: string; pageCount: number; labelCount: number }> {
    const sizeConfig = LABEL_SIZES[options.sizePreset];
    const targetWidth = options.sizePreset === 'custom' && options.customWidthMm ? options.customWidthMm : sizeConfig.widthMm;
    const targetHeight = options.sizePreset === 'custom' && options.customHeightMm ? options.customHeightMm : sizeConfig.heightMm;

    let template = { ...SHEET_TEMPLATES[options.sheetLayout] };

    // If Plain A4 Grid, calculate dynamic columns and rows for the specified label size
    if (options.sheetLayout === 'plain_a4_grid') {
      const pageW = 210;
      const pageH = 297;
      const margin = 8;
      const gap = 2;
      const availW = pageW - (margin * 2);
      const availH = pageH - (margin * 2);
      const cols = Math.max(1, Math.floor((availW + gap) / (targetWidth + gap)));
      const rows = Math.max(1, Math.floor((availH + gap) / (targetHeight + gap)));
      template = {
        ...template,
        columns: cols,
        rows: rows,
        labelsPerPage: cols * rows,
        labelWidthMm: targetWidth,
        labelHeightMm: targetHeight,
        leftMarginMm: margin,
        topMarginMm: margin,
        colGapMm: gap,
        rowGapMm: gap,
      };
    } else if (options.sheetLayout === 'thermal_roll') {
      template = {
        ...template,
        labelWidthMm: targetWidth,
        labelHeightMm: targetHeight,
      };
    }

    // Initialize jsPDF
    const isThermal = options.sheetLayout === 'thermal_roll';
    const doc = new jsPDF({
      orientation: isThermal ? (targetWidth > targetHeight ? 'landscape' : 'portrait') : 'portrait',
      unit: 'mm',
      format: isThermal ? [targetWidth, targetHeight] : 'a4',
      compress: true,
    });

    const startPos = Math.max(1, Math.min(template.labelsPerPage, options.startPosition || 1)) - 1;
    let currentSheetSlot = startPos;
    let pageCount = 1;
    let labelIndex = 0;

    const totalLabels = books.length;
    const chunkSize = 25; // Process in chunks to prevent UI freezes

    for (let i = 0; i < totalLabels; i++) {
      if (options.shouldCancel && options.shouldCancel()) {
        break;
      }

      const book = books[i];
      const isThinBook = options.autoThinSpineThreshold && book.pages && book.pages < options.autoThinSpineThreshold;
      const isThin = isThinBook || options.sizePreset === 'thin';

      // Check if we need a new page
      if (isThermal) {
        if (i > 0) {
          doc.addPage([targetWidth, targetHeight], targetWidth > targetHeight ? 'landscape' : 'portrait');
          pageCount++;
        }
      } else {
        if (currentSheetSlot >= template.labelsPerPage) {
          doc.addPage('a4', 'portrait');
          pageCount++;
          currentSheetSlot = 0;
        }
      }

      // Compute slot coordinates
      let xMm = 0;
      let yMm = 0;

      if (isThermal) {
        xMm = 0;
        yMm = 0;
      } else {
        const colIdx = currentSheetSlot % template.columns;
        const rowIdx = Math.floor(currentSheetSlot / template.columns);
        xMm = template.leftMarginMm + (colIdx * (template.labelWidthMm + template.colGapMm));
        yMm = template.topMarginMm + (rowIdx * (template.labelHeightMm + template.rowGapMm));
      }

      // Draw cut lines if requested on plain paper
      if (options.showCutLines && !isThermal) {
        doc.setDrawColor(210, 210, 215);
        doc.setLineDashPattern([1.5, 1.5], 0);
        doc.rect(xMm, yMm, template.labelWidthMm, template.labelHeightMm, 'S');
        doc.setLineDashPattern([], 0);
      }

      // Render Label Content
      this.renderSingleLabelContent(doc, book, xMm, yMm, template.labelWidthMm, template.labelHeightMm, isThin);

      currentSheetSlot++;
      labelIndex++;

      // Yield event loop every chunk
      if (i % chunkSize === 0) {
        if (options.onProgress) {
          options.onProgress(i + 1, totalLabels, pageCount);
        }
        await new Promise(r => setTimeout(r, 0));
      }
    }

    if (options.onProgress) {
      options.onProgress(totalLabels, totalLabels, pageCount);
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `ULM_Barcode_Labels_${options.sizePreset}_${options.sheetLayout}_${dateStr}.pdf`;

    return {
      doc,
      filename,
      pageCount,
      labelCount: labelIndex,
    };
  }

  /**
   * Draws a single label with scaled typography and vector barcode.
   */
  private static renderSingleLabelContent(
    doc: jsPDF,
    book: Book,
    x: number,
    y: number,
    w: number,
    h: number,
    isThin: boolean
  ) {
    const pad = 1.8;
    const innerX = x + pad;
    const innerY = y + pad;
    const innerW = w - (pad * 2);
    const innerH = h - (pad * 2);

    const barcode = book.barcode || 'ULM-00001';
    const accNo = book.accession_no || barcode.replace(/^[A-Z]+-/, '');
    const callNo = book.dewey_call_number || '000 ULM';

    if (isThin) {
      // ================= THIN SPINE (15 × 38 mm rotated) =================
      // Border
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.2);
      doc.rect(innerX, innerY, innerW, innerH, 'S');

      // Top: ULM Call Number
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.setTextColor(20, 20, 20);
      doc.text(callNo.slice(0, 14), innerX + (innerW / 2), innerY + 3.2, { align: 'center' });

      // Middle: Rotated Barcode along the spine (vertical)
      const barcodeH = 7.5;
      const barcodeW = innerH - 12; // length along spine
      const bcX = innerX + 3.2;
      const bcY = innerY + 5.5;

      this.drawVectorCode128(doc, barcode, bcX, bcY, barcodeW, barcodeH, {
        showText: false,
        rotate90: true,
      });

      // Bottom: Barcode digits
      doc.setFont('courier', 'bold');
      doc.setFontSize(5);
      doc.text(barcode, innerX + (innerW / 2), innerY + innerH - 1.2, { align: 'center' });
      return;
    }

    // Border
    doc.setDrawColor(220, 220, 225);
    doc.setLineWidth(0.15);
    doc.rect(innerX, innerY, innerW, innerH, 'S');

    if (h < 26) {
      // ================= SMALL / MEDIUM COMPACT (e.g. Avery L7651: 38.1 × 21.2) =================
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.setTextColor(40, 40, 40);
      doc.text(callNo, innerX + 1, innerY + 2.5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.setTextColor(80, 80, 80);
      doc.text(`ACC: ${accNo}`, innerX + innerW - 1, innerY + 2.5, { align: 'right' });

      // Barcode
      const bcH = Math.max(6, innerH - 8);
      const bcW = innerW - 2;
      this.drawVectorCode128(doc, barcode, innerX + 1, innerY + 4, bcW, bcH, {
        showText: true,
        fontSizePt: 5.5,
      });
      return;
    }

    // ================= STANDARD FULL (e.g. Avery L7160: 63.5 × 38.1 mm) =================
    // Header Row: Institutional Branding
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(40, 20, 60);
    doc.text('UNIVERSITY OF LAKKI MARWAT', innerX + (innerW / 2), innerY + 3.0, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.2);
    doc.setTextColor(100, 100, 100);
    doc.text('CENTRAL CAMPUS LIBRARY', innerX + (innerW / 2), innerY + 5.5, { align: 'center' });

    // Hairline divider
    doc.setDrawColor(200, 200, 205);
    doc.line(innerX + 1, innerY + 6.8, innerX + innerW - 1, innerY + 6.8);

    // Book Title (max 2 lines)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(15, 15, 15);
    const titleLines = doc.splitTextToSize(book.book_name || 'Untitled Book', innerW - 2);
    doc.text(titleLines.slice(0, 2), innerX + 1, innerY + 9.5);

    // Author
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6);
    doc.setTextColor(70, 70, 70);
    const authorStr = (book.author || 'Author Unknown').slice(0, 36);
    doc.text(authorStr, innerX + 1, innerY + 16.5);

    // Call number
    doc.setFont('courier', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(30, 70, 120);
    doc.text(`Call: ${callNo}`, innerX + 1, innerY + 20.2);

    // Barcode Vector (exact module widths)
    const bcHeight = 8.5;
    const bcWidth = innerW - 2;
    this.drawVectorCode128(doc, barcode, innerX + 1, innerY + 21.8, bcWidth, bcHeight, {
      showText: false,
    });

    // Footer: ACC and Barcode
    doc.setFont('courier', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(30, 30, 30);
    doc.text(`ACC: ${accNo}`, innerX + 1, innerY + innerH - 0.8);
    doc.text(barcode, innerX + innerW - 1, innerY + innerH - 0.8, { align: 'right' });
  }

  /**
   * Generates Member Cards PDF.
   * Options:
   * (a) exact CR80 pages (85.6 × 54.0 mm)
   * (b) A4 sheet with 10 cards (2 × 5) and crop marks
   * (c) Double-sided A4 mirrored for long-edge flipping
   */
  static async generateMemberCardsPdf(
    members: Borrower[],
    options: CardPdfOptions
  ): Promise<{ doc: jsPDF; filename: string; pageCount: number; cardCount: number }> {
    const cardW = 85.6;
    const cardH = 54.0;
    const totalMembers = members.length;

    let doc: jsPDF;
    let pageCount = 1;

    if (options.layout === 'cr80_single') {
      // Single CR80 pages: Page 1 Front, Page 2 Back, Page 3 Front...
      doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [cardW, cardH],
        compress: true,
      });

      for (let i = 0; i < totalMembers; i++) {
        if (options.shouldCancel && options.shouldCancel()) break;
        const m = members[i];

        if (i > 0) {
          doc.addPage([cardW, cardH], 'landscape');
          pageCount++;
        }
        this.renderSingleCardPdf(doc, m, 0, 0, cardW, cardH, 'front');

        // Back page
        doc.addPage([cardW, cardH], 'landscape');
        pageCount++;
        this.renderSingleCardPdf(doc, m, 0, 0, cardW, cardH, 'back');

        if (options.onProgress) {
          options.onProgress(i + 1, totalMembers);
        }
        await new Promise(r => setTimeout(r, 0));
      }
    } else {
      // A4 Layout (10 cards: 2 columns × 5 rows)
      doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      const a4W = 210;
      const a4H = 297;
      const cols = 2;
      const rows = 5;
      const cardsPerPage = cols * rows;

      // Margins to center 2×5 cards (total width: 2*85.6 = 171.2mm, total height: 5*54 = 270mm)
      const leftMargin = (a4W - (cols * cardW)) / 2; // ~19.4 mm
      const topMargin = (a4H - (rows * cardH)) / 2; // ~13.5 mm

      const totalPages = Math.ceil(totalMembers / cardsPerPage);

      for (let p = 0; p < totalPages; p++) {
        if (options.shouldCancel && options.shouldCancel()) break;

        const pageMembers = members.slice(p * cardsPerPage, (p + 1) * cardsPerPage);

        if (p > 0) {
          doc.addPage('a4', 'portrait');
          pageCount++;
        }

        // Draw Fronts on this page
        for (let idx = 0; idx < pageMembers.length; idx++) {
          const col = idx % cols;
          const row = Math.floor(idx / cols);
          const x = leftMargin + (col * cardW);
          const y = topMargin + (row * cardH);

          this.renderSingleCardPdf(doc, pageMembers[idx], x, y, cardW, cardH, 'front');
          this.drawCardCropMarks(doc, x, y, cardW, cardH);
        }

        // If duplex, add mirrored Backs on next page
        if (options.layout === 'a4_duplex') {
          doc.addPage('a4', 'portrait');
          pageCount++;

          for (let idx = 0; idx < pageMembers.length; idx++) {
            const col = idx % cols;
            // Mirrored column for flip-on-long-edge: col 0 becomes col 1, col 1 becomes col 0!
            const mirroredCol = (cols - 1) - col;
            const row = Math.floor(idx / cols);
            const x = leftMargin + (mirroredCol * cardW);
            const y = topMargin + (row * cardH);

            this.renderSingleCardPdf(doc, pageMembers[idx], x, y, cardW, cardH, 'back');
            this.drawCardCropMarks(doc, x, y, cardW, cardH);
          }
        }

        if (options.onProgress) {
          options.onProgress(Math.min((p + 1) * cardsPerPage, totalMembers), totalMembers);
        }
        await new Promise(r => setTimeout(r, 0));
      }
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `ULM_Member_Cards_${options.layout}_${dateStr}.pdf`;

    return {
      doc,
      filename,
      pageCount,
      cardCount: totalMembers,
    };
  }

  /**
   * Draws crop marks around a card on an A4 sheet.
   */
  private static drawCardCropMarks(doc: jsPDF, x: number, y: number, w: number, h: number) {
    const markLen = 3;
    const gap = 1;
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.1);

    // Top-left
    doc.line(x - gap - markLen, y, x - gap, y);
    doc.line(x, y - gap - markLen, x, y - gap);

    // Top-right
    doc.line(x + w + gap, y, x + w + gap + markLen, y);
    doc.line(x + w, y - gap - markLen, x + w, y - gap);

    // Bottom-left
    doc.line(x - gap - markLen, y + h, x - gap, y + h);
    doc.line(x, y + h + gap, x, y + h + gap + markLen);

    // Bottom-right
    doc.line(x + w + gap, y + h, x + w + gap + markLen, y + h);
    doc.line(x + w, y + h + gap, x + w, y + h + gap + markLen);
  }

  /**
   * Draws a single CR80 Smart ID Card (front or back) at exact physical dimensions (85.60mm x 53.98mm)
   * matching UlmSmartIdCard (Royal Purple #3B1054 header, #C8963E Gold border, White #FFFFFF card body,
   * 6.5% pre-baked watermark, 6-field academic metadata grid, Code-128 barcode, and QR verification matrix).
   */
  private static renderSingleCardPdf(
    doc: jsPDF,
    m: Borrower,
    x: number,
    y: number,
    w: number,
    h: number,
    side: 'front' | 'back'
  ) {
    const rawRole = (m.role || 'Student').toLowerCase();
    const roleBadge =
      rawRole === 'faculty'
        ? 'FACULTY CARD'
        : rawRole === 'staff'
        ? 'STAFF CARD'
        : 'STUDENT CARD';

    const memberId = (m.barcode || m.university_id || m.student_id || 'ULM0329984').toUpperCase();
    const rollNo = m.roll_number || m.employee_no || m.university_id || m.student_id || 'BSCS-23-42';
    const name = m.name || 'Asad Zeb';
    const session = m.session || (rawRole === 'faculty' ? 'Permanent Faculty' : 'FA23 (2023-2027)');
    const program =
      rawRole === 'faculty' || rawRole === 'staff'
        ? m.designation || 'Assistant Professor'
        : m.program
        ? m.program.includes('(')
          ? m.program
          : `${m.degree_level ? m.degree_level + ' ' : ''}${m.program} (Regular)`
        : 'BS Computer Science (Regular)';
    const rawDept = m.department || 'Computer Science';
    const department = rawDept.toLowerCase().startsWith('department') ? rawDept : `Department of ${rawDept}`;
    const bloodGroup = m.blood_group || 'B-';
    const limitNum = m.borrow_limit || (rawRole === 'faculty' ? 10 : rawRole === 'staff' ? 5 : 3);
    const borrowingLimit = `${String(limitNum).padStart(2, '0')} Books (${rawRole === 'faculty' ? 30 : 14} Days)`;
    const phone = m.phone || '0342-5252555';
    const validTill = (m.valid_until || '30 JUN 2027').toUpperCase();

    // 1. White Card Background with 1.5px Gold (#C8963E) Border
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(200, 150, 62);
    doc.setLineWidth(0.45);
    doc.roundedRect(x, y, w, h, 3.18, 3.18, 'FD');

    // 2. Center Watermark at strictly 6.5% opacity
    try {
      const wmSize = 29.6; // ~148px at CR80 scale
      const wmX = x + (w - wmSize) / 2;
      const wmY = y + (h - wmSize) / 2 + 1.5;
      if (typeof (doc as any).saveGraphicsState === 'function' && typeof (doc as any).GState === 'function') {
        (doc as any).saveGraphicsState();
        (doc as any).setGState(new (doc as any).GState({ opacity: 0.065 }));
        doc.addImage(ULM_CREST_SRC, 'PNG', wmX, wmY, wmSize, wmSize);
        (doc as any).restoreGraphicsState();
      } else {
        doc.addImage(ULM_CREST_WATERMARK_SRC, 'PNG', wmX, wmY, wmSize, wmSize);
      }
    } catch {
      // Fallback
    }

    if (side === 'front') {
      // ================= CARD FRONT =================
      const headerH = 11.6;
      // Top Royal Purple Header Band (#3B1054)
      doc.setFillColor(59, 16, 84);
      doc.roundedRect(x + 0.2, y + 0.2, w - 0.4, headerH, 2.9, 2.9, 'F');
      doc.rect(x + 0.2, y + headerH - 3, w - 0.4, 3, 'F');

      // Gold Bottom Border of Header (2.5px -> ~0.5mm)
      doc.setDrawColor(200, 150, 62);
      doc.setLineWidth(0.5);
      doc.line(x + 0.2, y + headerH, x + w - 0.2, y + headerH);

      // Left Crest Ring (White circle with #FFD147 border)
      const crestCx = x + 6.8;
      const crestCy = y + 5.9;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(255, 209, 71);
      doc.setLineWidth(0.4);
      doc.circle(crestCx, crestCy, 4.2, 'FD');
      try {
        doc.addImage(ULM_CREST_SRC, 'PNG', crestCx - 3.6, crestCy - 3.6, 7.2, 7.2);
      } catch {}

      // Header Text Stack
      doc.setFont('times', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(255, 255, 255);
      doc.text('UNIVERSITY OF LAKKI MARWAT', x + 12.5, y + 4.4);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.4);
      doc.setTextColor(255, 209, 71);
      doc.text('CENTRAL DIGITAL LIBRARY', x + 12.5, y + 7.1);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(4.6);
      doc.setTextColor(230, 230, 240);
      doc.text('Khyber Pakhtunkhwa, Pakistan • Est. 2017', x + 12.5, y + 9.6);

      // Right Role Pill (#FFD147 -> #C8963E)
      doc.setFillColor(235, 185, 65);
      doc.roundedRect(x + w - 21.5, y + 3.6, 18.8, 4.4, 1, 1, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(4.8);
      doc.setTextColor(30, 7, 48);
      doc.text(roleBadge, x + w - 12.1, y + 6.4, { align: 'center' });

      // Photo Frame (88px x 108px -> 17.6mm x 21.6mm)
      const photoX = x + 3.2;
      const photoY = y + 13.8;
      const photoW = 17.6;
      const photoH = 21.6;
      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(59, 16, 84);
      doc.setLineWidth(0.4);
      doc.roundedRect(photoX, photoY, photoW, photoH, 1.5, 1.5, 'FD');

      const initials = name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
      doc.setFont('times', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(59, 16, 84);
      doc.text(initials, photoX + photoW / 2, photoY + 11, { align: 'center' });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(4.5);
      doc.setTextColor(71, 85, 105);
      doc.text('ULM MEMBER', photoX + photoW / 2, photoY + 15.5, { align: 'center' });

      // Crimson Blood Group Badge (#DC2626)
      doc.setFillColor(220, 38, 38);
      doc.roundedRect(photoX + photoW - 5.4, photoY + 1, 4.4, 2.8, 0.6, 0.6, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(4.5);
      doc.setTextColor(255, 255, 255);
      doc.text(bloodGroup, photoX + photoW - 3.2, photoY + 2.9, { align: 'center' });

      // Active Member Green Capsule Pill
      doc.setFillColor(236, 253, 245);
      doc.setDrawColor(16, 185, 129);
      doc.setLineWidth(0.25);
      doc.roundedRect(photoX, photoY + photoH + 1.2, photoW, 3.2, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(4.2);
      doc.setTextColor(4, 120, 87);
      doc.text('ACTIVE MEMBER', photoX + photoW / 2, photoY + photoH + 3.3, { align: 'center' });

      // Right Info Column
      const infoX = x + 23.5;
      const infoW = w - 26.5;

      // Borrower Name + Member ID Pill
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.8);
      doc.setTextColor(30, 7, 48);
      doc.text(name.slice(0, 24), infoX, y + 16.8);

      doc.setFillColor(243, 232, 255);
      doc.setDrawColor(233, 213, 255);
      doc.roundedRect(x + w - 22, y + 13.8, 19, 3.8, 0.8, 0.8, 'FD');
      doc.setFont('courier', 'bold');
      doc.setFontSize(5.5);
      doc.setTextColor(84, 26, 114);
      doc.text(memberId, x + w - 12.5, y + 16.3, { align: 'center' });

      // Divider under Name
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.line(infoX, y + 18.2, infoX + infoW, y + 18.2);

      // 6-Field Metadata Grid
      const col2X = infoX + infoW / 2 + 1;

      // Row 1: Roll No | Academic Session
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(4.2);
      doc.setTextColor(100, 116, 139);
      doc.text('ROLL NO / REG ID', infoX, y + 20.8);
      doc.text('ACADEMIC SESSION', col2X, y + 20.8);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.6);
      doc.setTextColor(59, 16, 84);
      doc.text(rollNo.slice(0, 18), infoX, y + 23.2);
      doc.setTextColor(15, 23, 42);
      doc.text(session.slice(0, 18), col2X, y + 23.2);

      // Row 2: Program / Designation
      doc.setFontSize(4.2);
      doc.setTextColor(100, 116, 139);
      doc.text('PROGRAM / DESIGNATION', infoX, y + 26.2);
      doc.setFontSize(5.6);
      doc.setTextColor(15, 23, 42);
      doc.text(program.slice(0, 38), infoX, y + 28.6);

      // Row 3: Department
      doc.setFontSize(4.2);
      doc.setTextColor(100, 116, 139);
      doc.text('DEPARTMENT', infoX, y + 31.6);
      doc.setFontSize(5.6);
      doc.setTextColor(15, 23, 42);
      doc.text(department.slice(0, 38), infoX, y + 34.0);

      // Row 4: Borrowing Limit | Valid Till
      doc.setFontSize(4.2);
      doc.setTextColor(100, 116, 139);
      doc.text('BORROWING LIMIT', infoX, y + 37.0);
      doc.text('VALID TILL', col2X, y + 37.0);

      doc.setFontSize(5.6);
      doc.setTextColor(15, 23, 42);
      doc.text(borrowingLimit.slice(0, 18), infoX, y + 39.4);
      doc.setTextColor(180, 83, 9);
      doc.text(validTill.slice(0, 16), col2X, y + 39.4);

      // Footer Barcode Band (Height: 38px -> 7.6mm)
      const footerY = y + h - 7.8;
      doc.setFillColor(248, 250, 252);
      doc.rect(x + 0.3, footerY, w - 0.6, 7.5, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.25);
      doc.line(x + 0.3, footerY, x + w - 0.3, footerY);

      this.drawVectorCode128(doc, memberId, x + 3.2, footerY + 1.0, 35, 4.0, {
        showText: false,
      });
      doc.setFont('courier', 'bold');
      doc.setFontSize(4.6);
      doc.setTextColor(71, 85, 105);
      doc.text(`*${memberId}*`, x + 3.2, footerY + 6.6);

      // Chief Librarian Authority
      doc.setFont('times', 'bolditalic');
      doc.setFontSize(5.6);
      doc.setTextColor(59, 16, 84);
      doc.text('Chief Librarian', x + w - 3.2, footerY + 3.6, { align: 'right' });
      doc.setDrawColor(148, 163, 184);
      doc.setLineWidth(0.2);
      doc.line(x + w - 22, footerY + 4.3, x + w - 3.2, footerY + 4.3);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(4.2);
      doc.setTextColor(100, 116, 139);
      doc.text('ISSUING AUTHORITY • ULM', x + w - 3.2, footerY + 6.5, { align: 'right' });
    } else {
      // ================= CARD BACK =================
      const topStripH = 5.6;
      doc.setFillColor(30, 7, 48);
      doc.roundedRect(x + 0.2, y + 0.2, w - 0.4, topStripH, 2.9, 2.9, 'F');
      doc.rect(x + 0.2, y + topStripH - 2, w - 0.4, 2, 'F');
      doc.setDrawColor(200, 150, 62);
      doc.setLineWidth(0.4);
      doc.line(x + 0.2, y + topStripH, x + w - 0.2, y + topStripH);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(4.8);
      doc.setTextColor(255, 209, 71);
      doc.text('INSTITUTIONAL LIBRARY MEMBERSHIP TERMS', x + 3.2, y + 3.8);
      doc.text(`ID: ${memberId}`, x + w - 3.2, y + 3.8, { align: 'right' });

      // Left Column: Borrowing Terms & Discipline
      doc.setFont('times', 'bold');
      doc.setFontSize(5.8);
      doc.setTextColor(59, 16, 84);
      doc.text('LIBRARY BORROWING TERMS & DISCIPLINE', x + 3.2, y + 10.2);
      doc.setDrawColor(200, 150, 62);
      doc.setLineWidth(0.2);
      doc.line(x + 3.2, y + 11.2, x + w - 25, y + 11.2);

      const rules = [
        '• This Smart ID Card is strictly non-transferable and must be presented for all loans.',
        '• Overdue fine is Rs. 10/- per day per volume after the 14-day loan window.',
        '• Report loss or damage of card or borrowed material immediately to the Chief Librarian.',
        '• Degree completion clearance requires return of all library assets and settling dues.',
      ];

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(4.7);
      doc.setTextColor(30, 41, 59);
      let ry = y + 15.0;
      for (const rule of rules) {
        const lines = doc.splitTextToSize(rule, w - 29);
        doc.text(lines, x + 3.2, ry);
        ry += lines.length * 3.1 + 1.2;
      }

      // Emergency Contact Strip
      doc.setFillColor(255, 251, 235);
      doc.setDrawColor(252, 211, 77);
      doc.roundedRect(x + 3.2, y + h - 13.5, w - 28.5, 4.8, 0.8, 0.8, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(4.6);
      doc.setTextColor(120, 53, 15);
      doc.text(`Holder Contact: ${phone}`, x + 4.8, y + h - 10.4);
      doc.text(`Blood: ${bloodGroup}`, x + w - 26.8, y + h - 10.4, { align: 'right' });

      // Right Verification QR Box
      const qrBoxX = x + w - 23.2;
      const qrBoxY = y + 9.2;
      const qrBoxW = 20.0;
      const qrBoxH = 35.0;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(qrBoxX, qrBoxY, qrBoxW, qrBoxH, 1.4, 1.4, 'FD');

      // Draw deterministic 29x29 QR Matrix inside PDF
      const matrixSize = 29;
      const qrSizeMm = 14.5;
      const qrStartX = qrBoxX + (qrBoxW - qrSizeMm) / 2;
      const qrStartY = qrBoxY + 3.0;
      const cellMm = qrSizeMm / matrixSize;
      const payload = `ULM|${memberId}|${name}|${rollNo}|${validTill}`;

      const grid: number[][] = Array.from({ length: matrixSize }, () => Array(matrixSize).fill(0));
      const drawFinder = (r0: number, c0: number) => {
        for (let r = 0; r < 7; r++) {
          for (let c = 0; c < 7; c++) {
            if (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
              grid[r0 + r][c0 + c] = 1;
            } else {
              grid[r0 + r][c0 + c] = 2;
            }
          }
        }
      };
      drawFinder(0, 0);
      drawFinder(0, matrixSize - 7);
      drawFinder(matrixSize - 7, 0);

      let hash = 2166136261;
      for (let i = 0; i < payload.length; i++) {
        hash ^= payload.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      for (let r = 0; r < matrixSize; r++) {
        for (let c = 0; c < matrixSize; c++) {
          if (grid[r][c] !== 0) continue;
          if (r === 6 || c === 6) {
            grid[r][c] = (r + c) % 2 === 0 ? 1 : 2;
            continue;
          }
          hash ^= (r * 31 + c * 17) & 0xff;
          hash = Math.imul(hash, 16777619);
          grid[r][c] = Math.abs(hash) % 10 < 5 ? 1 : 0;
        }
      }

      doc.setFillColor(255, 255, 255);
      doc.rect(qrStartX - 0.5, qrStartY - 0.5, qrSizeMm + 1, qrSizeMm + 1, 'F');
      doc.setFillColor(30, 7, 48);
      for (let r = 0; r < matrixSize; r++) {
        for (let c = 0; c < matrixSize; c++) {
          if (grid[r][c] === 1) {
            doc.rect(qrStartX + c * cellMm, qrStartY + r * cellMm, cellMm, cellMm, 'F');
          }
        }
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(4.4);
      doc.setTextColor(59, 16, 84);
      doc.text('SCAN TO VERIFY', qrBoxX + qrBoxW / 2, qrBoxY + 22.5, { align: 'center' });
      doc.setFont('courier', 'bold');
      doc.setFontSize(4.0);
      doc.setTextColor(100, 116, 139);
      doc.text(memberId, qrBoxX + qrBoxW / 2, qrBoxY + 25.5, { align: 'center' });

      // Bottom Return Address Footer Strip (#0F172A)
      const backFooterY = y + h - 6.2;
      doc.setFillColor(15, 23, 42);
      doc.rect(x + 0.3, backFooterY, w - 0.6, 5.9, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(4.5);
      doc.setTextColor(255, 209, 71);
      doc.text(
        'If found, return to: Central Library, University of Lakki Marwat (KP)',
        x + 3.2,
        backFooterY + 3.8
      );
      doc.setTextColor(241, 245, 249);
      doc.text('www.ulm.edu.pk', x + w - 3.2, backFooterY + 3.8, { align: 'right' });
    }
  }

  /**
   * Safe isolated printing via Blob and hidden iframe.
   * Gracefully handles blocked iframes by alerting the user.
   */
  static printPdfBlob(blob: Blob): Promise<{ success: boolean; blocked?: boolean }> {
    return new Promise((resolve) => {
      try {
        const blobUrl = URL.createObjectURL(blob);
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        iframe.src = blobUrl;

        iframe.onload = () => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            resolve({ success: true });
          } catch {
            // Window print blocked in iframe
            resolve({ success: false, blocked: true });
          } finally {
            setTimeout(() => {
              try {
                document.body.removeChild(iframe);
                URL.revokeObjectURL(blobUrl);
              } catch {}
            }, 5000);
          }
        };

        iframe.onerror = () => {
          resolve({ success: false, blocked: true });
        };

        document.body.appendChild(iframe);
      } catch {
        resolve({ success: false, blocked: true });
      }
    });
  }

  /**
   * Triggers download of generated jsPDF instance.
   */
  static downloadPdf(doc: jsPDF, filename: string): void {
    doc.save(filename);
  }
}
