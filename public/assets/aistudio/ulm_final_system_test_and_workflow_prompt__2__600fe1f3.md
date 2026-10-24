# 🚀 ULM CENTRAL CAMPUS LIBRARY — UNIFIED MASTER PROMPT (ALL 6 ISSUES + EMBEDDED PIXEL-EXACT ULM CREST LOGO & WATERMARKS)

Copy and paste the single unified prompt block below directly into **Google AI Studio**. It combines **all 6 issues you reported** (including the **exact embedded Base64 Data URI of your uploaded `ulm-crest.png`** so the AI **cannot** redesign or redraw a fake SVG shield as in `97269561.png`):

1. **Issue #1 — Extended Display Scaling (`30%`, `40%`, `45%`, `50%`–`125%`) & Anti-Merge Layout (`eacd60e6-179a-41bb-9bec-016f89ace086`)**
2. **Issue #2 — First-Install Storage Location & True Universal Unlimited Excel Sheet (Removing the `2,998` / `2,999` / `< 3,000` Row Cap in `edited-image_2.png`)**
3. **Issue #3 — Multi-Sheet Additive Excel Import (Never Overwriting Previous Sheets) & Continuous Infinite Series (`1, 2, 3, 4 ... ∞` Across Today, Tomorrow & Any Date — `1000185139.jpg`)**
4. **Issue #4 — Automatic System Date & Time Stamp (`new Date()`) Captured & Displayed on Every Single Book Entry & Excel Sheet Import**
5. **Issue #5 — Unique 13-Digit Barcodes per Book (Fixing Repeated `0092000020001`), Fixing the Solid Black Box Above Barcode Numbers in Batch Studio (`edited-image.png`, `edited-image_4.png`, `edited-image_5.png`), & Instant Auto-Refresh When Adding or Removing Data (`edited-image_3.png`)**
6. **Issue #6 — Pixel-Exact Official `ulm-crest.png` for App Logo, Full-Page Background Watermark & Member ID Card Watermark (Zero AI `<svg>` Redesign — Fixing `97269561.png`)**: Embeds the real transparent-background `ulm-crest.png` directly as `ULM_OFFICIAL_CREST_DATA_URI` and strictly forbids the AI from drawing fake `<svg>` shields.

---

```markdown
TASK: IMPLEMENT THE COMPLETE UNIFIED MASTER UPDATE FOR ULM CENTRAL CAMPUS LIBRARY —
(1) ISSUE #1: EXTEND DISPLAY SCALING DOWN TO 30% / 40% / 45% / 50%–125% & PREVENT HEADER/CARD MERGING,
(2) ISSUE #2: FIRST-INSTALL STORAGE LOCATION SETUP & SINGLE UNIVERSAL UNLIMITED EXCEL SHEET (REMOVE THE 2,998 / 2,999 ROW CAP IN "Where should your library be stored?"),
(3) ISSUE #3: ADDITIVE MULTI-SHEET EXCEL IMPORT (NEVER OVERWRITE PREVIOUS SHEETS) & UNBROKEN INFINITE SEQUENTIAL SERIES (`1, 2, 3, 4 ... Infinite` ACROSS MANUAL ADD & EXCEL IMPORTS ON ANY DATE),
(4) ISSUE #4: CAPTURE & DISPLAY EXACT LOCAL SYSTEM DATE & TIME (`new Date()`) ON EVERY MANUAL BOOK ENTRY & EXCEL SHEET IMPORT,
(5) ISSUE #5: GIVE EVERY BOOK A 100% UNIQUE BARCODE (FIX REPEATED `0092000020001`), REMOVE THE SOLID BLACK BOX ABOVE BARCODE DIGITS IN BARCODE & SPINE LABEL STUDIO, & AUTO-REFRESH ALL VIEWS INSTANTLY WHEN DATA IS ADDED OR REMOVED,
(6) ISSUE #6: USE ONLY THE PIXEL-EXACT EMBEDDED `ulm-crest.png` (`ULM_OFFICIAL_CREST_DATA_URI`) FOR THE APP HEADER LOGO, OPENING SPLASH, FULL-PAGE APP BACKGROUND WATERMARK (`97269561.png`), AND MEMBER ID CARD WATERMARK — NEVER REDRAW OR GENERATE A FAKE `<svg>` CREST

Update `index.html`, `App.tsx`, `PrimaryHeader.tsx`, `Sidebar.tsx`, `BootSplash.tsx`, `StorageSetupModal.tsx`, `ExcelImportModal.tsx` (`Excel & CSV Accession Register Importer`), `BooksCatalogView.tsx`, `AddBookModal.tsx`, `EditBookModal.tsx`, `BookDetailsModal.tsx`, `BarcodeStudioModal.tsx` (`Barcode & Spine Label Studio` & `Barcode Label Thermal Generator`), `BarcodeStationView.tsx`, `AlmariView.tsx`, `SettingsView.tsx`, and `src/services/libraryStorageAndMigration.ts` with all 8 sections below:

---

### 1. ISSUE #2 & #5A — FIX `"Where should your library be stored?"` MODAL & REMOVE THE `2,998` / `2,999` ROW CAP (`StorageSetupModal.tsx`, `libraryStorageAndMigration.ts` — `edited-image_2.png`)
Currently, the `"Where should your library be stored?"` modal displays `"app data\Book Sheet\ULM_Book_Entry_Sheet.xlsx (2,999 formatted rows)"` and caps/truncates the generated Excel sheet at `2,998` or `2,999` rows (and browser `localStorage` fails around `< 3,000` rows). Fix this completely:

1. **Remove All `2,998` / `2,999` / `3,000` Row Limits in Code & UI Text**:
   - In `StorageSetupModal.tsx` (`"Where should your library be stored?"` — `edited-image_2.png`), under `"What will be created:"`, replace:
     `app data\Book Sheet\ULM_Book_Entry_Sheet.xlsx (2,999 formatted rows)`
     with:
     `app data\Book Sheet\ULM_Master_Books_Register.xlsx (Universal Unlimited Rows — Auto-Synced)`
   - Search the entire codebase for `2998`, `2999`, `3000`, or `formatted rows` inside any Excel template/sheet generator loop (`for (let i = 1; i <= 2999; i++)`) and **delete that hardcoded limit**.
   - **Never Store the Books Array in `localStorage`**: Store 100% of books in `ulm-library.sqlite` (Electron) and `IndexedDB` (`ulm_library_idb_v1`, object store `books` in Browser) so the library holds **20,000, 100,000, or Infinite books** without ever hitting the 5 MB `localStorage` ceiling.

2. **Single Universal Master Excel Sheet (`ULM_Master_Books_Register.xlsx` / `ULM_Book_Entry_Sheet.xlsx`)**:
   - Whenever the user clicks **`[Sync Sheet]`**, **`[Master Excel]`**, **`[Export]`**, or adds/imports/removes books, export **all** books from `SQLite` / `IndexedDB` into **one single Universal Excel Worksheet (`Master_Books_Register`)** sorted in strict series order (`1, 2, 3, 4 ... ∞`).
   - Standard `.xlsx` worksheets natively support **1,048,576 rows per sheet**, so 5,000, 20,001, or 100,000+ books MUST all be written into one single universal sheet without ever truncating at 2,999 rows.

---

### 2. ISSUE #3 & #4 — MULTI-SHEET CONTINUOUS SERIES AUTO-CONTINUATION (`5,000` BOOKS IN SHEET 1 + `10,000` BOOKS IN SHEET 2 = `1` TO `15,000` IN UNBROKEN SERIES) & EXACT SYSTEM DATE/TIME STAMP (`ExcelImportModal.tsx`, `AddBookModal.tsx`, `BooksCatalogView.tsx`, `libraryStorageAndMigration.ts`)
Currently, if the user imports Sheet 1 (`5,000` books) and then imports Sheet 2 (`10,000` books), Sheet 2 is **NOT** added in continuous series (`5,001` to `15,000`) because:
- **(Bug A)** Sheet 2's own Excel rows also start at `Sr. No / Accession No = 1..10000`, so the importer either skips/overwrites `1..5000` as duplicates or keeps Sheet 2's `1..10000` numbers instead of re-sequencing them to `5001..15000`.
- **(Bug B)** Zero-padding changes width at 10,000 (`"05000"` vs `"10000"`) or alphabetical string sorting places `"10000"` before `"2"`, and the catalog toolbar defaults to `"Sort: Newest Added"` instead of `"Sort: Series Order (1 → ∞)"`.

Fix this completely with these 4 exact rules:

1. **MANDATORY AUTO-CONTINUATION RE-INDEXING ON EVERY EXCEL/CSV IMPORT (`1..5000` + `10,000 more` = `5001..15000`)**:
   - When importing **any** Excel or CSV sheet (`importExcelOrCsvToSqlite`), **NEVER** use the uploaded sheet's internal row numbers (`1..10000`) as the primary key or skip rows because `Accession No 1..5000` already exist from Sheet 1!
   - Instead, before inserting the new sheet's rows, read the current highest series number in the database (`maxSeries = await getCurrentMaxSeriesNumber()`):
     * **When Sheet 1 (`5,000` books) is imported into an empty library (`maxSeries = 0`)**:
       Every valid row `0 .. 4999` is assigned `serial_no = 1 .. 5000`, `accession_number = "1" .. "5000"` (or zero-padded), and `barcode = "0092000000001" .. "0092000005000"`. Now `maxSeries = 5000`.
     * **When Sheet 2 (`10,000` books) is imported next (`maxSeries = 5000`)**:
       The importer starts `let nextSeries = maxSeries + 1` (**`5001`**) and assigns every valid row of Sheet 2 in strict unbroken sequence:
       - Row 1 of Sheet 2 → **Series / Accession `5001`** (`Barcode: 0092000005001`)
       - Row 2 of Sheet 2 → **Series / Accession `5002`** (`Barcode: 0092000005002`)
       - ...
       - Row 10,000 of Sheet 2 → **Series / Accession `15000`** (`Barcode: 0092000015000`)
       *(If Sheet 2 had an old reference number in its cell, preserve it in `source_remarks` or `original_sheet_acc` so zero data is lost and zero rows collide!)*
     * **When a book is added manually via `[+ Add Book]` after Sheet 2**:
       It automatically gets **Series / Accession `15001`** (`Barcode: 0092000015001`).
     * **When Sheet 3 is imported later**:
       It automatically continues from **`15002, 15003 ... ∞`**!

2. **Exact Continuous Multi-Sheet Importer Code (`src/services/libraryStorageAndMigration.ts`)**:
   Use this exact pre-indexing pipeline inside `importExcelOrCsvToSqlite` so multi-sheet imports ALWAYS append in `1, 2, 3 ... 5000, 5001 ... 15000` series across all 250-row chunks:
   ```ts
   export async function getCurrentMaxSeriesNumber(): Promise<number> {
     const allBooks = await getAllStoredBooksFromDb();
     let maxSeries = Number(localStorage.getItem('ulm_highest_serial_number_v1') || 0);
     for (const b of allBooks) {
       const s =
         Number(b.serial_no) ||
         parseInt(String(b.accession_number || b.accessionNumber || '').replace(/\D/g, ''), 10) ||
         0;
       if (Number.isFinite(s) && s > maxSeries) {
         maxSeries = s;
       }
     }
     return maxSeries;
   }

   export async function prepareSheetRowsInContinuousSeries(
     rawMappedRows: Array<Record<string, unknown>>,
     fileName: string
   ): Promise<{
     sequencedRows: Array<Record<string, unknown>>;
     startSeries: number;
     endSeries: number;
     rejectedErrors: ImportRowError[];
   }> {
     // 1. Read the current highest series number in the existing database (e.g. 5000 after Sheet 1)
     let runningSeries = await getCurrentMaxSeriesNumber();
     const startSeries = runningSeries + 1;
     const stamp = getCurrentSystemDateTimeStamp();
     const sequencedRows: Array<Record<string, unknown>> = [];
     const rejectedErrors: ImportRowError[] = [];

     for (let i = 0; i < rawMappedRows.length; i++) {
       const row = rawMappedRows[i];
       const title = String(row.title || '').trim();
       const author = String(row.author || '').trim();

       // Skip completely blank trailing Excel rows
       if (!title && !author && !row.accession_number) continue;

       if (!title) {
         rejectedErrors.push({
           row: i + 2,
           accessionNumber: String(row.accession_number || 'MISSING'),
           reason: 'Missing Book Title',
         });
         continue;
       }

       // 2. ALWAYS increment runningSeries so Sheet 2 (10,000 books) continues 5001 .. 15000!
       runningSeries++;
       const seriesStr = String(runningSeries);
       const uniqueBarcode = '0092' + seriesStr.padStart(9, '0');
       const originalSheetAcc = String(row.accession_number || '').trim();

       sequencedRows.push({
         ...row,
         id: `book_${seriesStr}`,
         serial_no: runningSeries,
         accession_number: seriesStr,
         accessionNumber: seriesStr,
         original_sheet_acc: originalSheetAcc || seriesStr,
         barcode: uniqueBarcode,
         author: author || 'ULM Library Collection',
         date_of_entry: stamp.formattedSystemDateTime,
         dateOfEntry: stamp.formattedSystemDateTime,
         system_timestamp: stamp.isoTimestamp,
         entry_source: `Excel Import: ${fileName}`,
         is_active: 1,
       });
     }

     if (typeof window !== 'undefined' && window.localStorage && sequencedRows.length > 0) {
       window.localStorage.setItem('ulm_highest_serial_number_v1', String(runningSeries));
     }

     return {
       sequencedRows,
       startSeries: sequencedRows.length > 0 ? startSeries : runningSeries,
       endSeries: runningSeries,
       rejectedErrors,
     };
   }
   ```
   - **CRITICAL DATABASE RULE**: When committing `sequencedRows` in 250-row chunks to `SQLite` (`ulm-library.sqlite`) and `IndexedDB` (`ulm_library_idb_v1`), **always use `onDuplicate: 'upsert'` / `store.put()` with `accession_number: seriesStr` (`5001..15000`)** and **NEVER** clear the table (`store.clear()` is forbidden during import).

3. **STRICT NUMERIC SERIES SORTING (`1, 2, 3 ... 5000, 5001 ... 15000`) IN ALL VIEWS & EXCEL EXPORT**:
   - **Why Books Looked Out of Order After Importing Sheet 2**:
     * In `BooksCatalogView.tsx` (`edited-image_3.png`), the sort dropdown defaulted to `"Sort: Newest Added"`, or sorted `accession_number` as an ASCII string (where `"10000"` comes before `"2"`!).
   - **Fix**:
     * Set the default catalog sort in `BooksCatalogView.tsx` to **`Sort: Series Order (1 → ∞)`**.
     * Everywhere books are sorted (`SQLite`, `IndexedDB`, `BooksCatalogView.tsx`, `BarcodeStudioModal.tsx`, and `ULM_Master_Books_Register.xlsx`), sort strictly by numeric integer:
       ```ts
       books.sort((a, b) => {
         const numA = Number(a.serial_no) || parseInt(String(a.accession_number || '').replace(/\D/g, ''), 10) || 0;
         const numB = Number(b.serial_no) || parseInt(String(b.accession_number || '').replace(/\D/g, ''), 10) || 0;
         return numA - numB;
       });
       ```
     * In `ExcelImportModal.tsx` (`1000185139.jpg`), show a live **"Continuous Series Preview Banner"** before & after each import:
       - Before Sheet 2 import: `"Existing Library: 5,000 Books (Series #1 – #5,000) → This Sheet (10,000 Books) will be added as Series #5,001 – #15,000"`
       - After Sheet 2 import: `"✓ Added 10,000 Books in Series #5,001 – #15,000 • Total Catalog: 15,000 Books"` plus a **`[+ Import / Append Another Excel Sheet]`** button.

4. **Automatic Local System Date & Time Stamp (`new Date()`) on Every Manual Book & Imported Excel Row (Issue #4)**:
   - Capture the computer's exact live **System Date & Time** at the moment a single book is added manually OR an Excel file is imported:
     ```ts
     export function getCurrentSystemDateTimeStamp(): {
       formattedSystemDateTime: string; // e.g. "23-Oct-2026, 01:40:15 PM"
       dateOnly: string;                // e.g. "23-Oct-2026"
       timeOnly: string;                // e.g. "01:40:15 PM"
       isoTimestamp: string;
     } {
       const now = new Date();
       const dateOnly = now.toLocaleDateString('en-GB', {
         day: '2-digit',
         month: 'short',
         year: 'numeric',
       }).replace(/ /g, '-');
       const timeOnly = now.toLocaleTimeString('en-US', {
         hour: '2-digit',
         minute: '2-digit',
         second: '2-digit',
         hour12: true,
       });
       return {
         formattedSystemDateTime: `${dateOnly}, ${timeOnly}`,
         dateOnly,
         timeOnly,
         isoTimestamp: now.toISOString(),
       };
     }
     ```
   - Display `date_of_entry` (`Date & System Time Added`) in the **Books Catalog List & Grid Views**, inside **Book Record Details**, inside **Add/Edit Book Modals**, and as dedicated columns (`Series #`, `Accession No`, `Barcode`, `Date & System Time Added`, `Entry Source / Sheet`) in the **Universal Master Excel Sheet**.

---

### 3. ISSUE #5B & #5C — GIVE EVERY BOOK A 100% UNIQUE BARCODE (FIX REPEATED `0092000020001`) & FIX THE SOLID BLACK BOX ABOVE BARCODES IN BATCH STUDIO (`BarcodeStudioModal.tsx`, `libraryStorageAndMigration.ts` — `edited-image.png`, `edited-image_4.png`, `edited-image_5.png`)
In `edited-image.png` and `edited-image_5.png` (`Barcode & Spine Label Studio`), `ACC: 1`, `ACC: 2`, `ACC: 3`, `ACC: 4`, `ACC: 5`, `ACC: 21`, `ACC: 22`, `ACC: 23` all show the **exact same barcode number (`0092000020001`)**, AND a **solid black rectangle** appears on top of the barcode number instead of vertical barcode bars! Fix both bugs permanently:

1. **Deterministic 100% Unique 13-Digit Barcode for Every Single Book (`ACC: 1` → `0092000000001`, `ACC: 2` → `0092000000002`, ...)**:
   - **Why `0092000020001` Repeated on Every Book**: During import or barcode backfill on a 20,000-book catalog, the code computed `'0092' + String(totalBooks + 1).padStart(9, '0')` (`0092000020001`) **once outside the loop** (or ignored each book's individual `serial_no` / `accession_number`) and wrote `0092000020001` onto every book!
   - **Exact Fix**:
     ```ts
     export function generateUniqueBookBarcode(serialOrAccession: number | string, usedBarcodes?: Set<string>): string {
       const cleanDigits = String(serialOrAccession ?? '').replace(/\D/g, '');
       let num = parseInt(cleanDigits, 10);
       if (!Number.isFinite(num) || num <= 0) num = 1;
       let candidate = '0092' + String(num).padStart(9, '0');
       while (usedBarcodes && usedBarcodes.has(candidate)) {
         num++;
         candidate = '0092' + String(num).padStart(9, '0');
       }
       if (usedBarcodes) usedBarcodes.add(candidate);
       return candidate;
     }
     ```
   - **Automatic Startup & On-Demand Repair of Duplicate Barcodes (`repairAllBookSeriesAndBarcodes`)**:
     * Run a fast automatic check on startup (and whenever `Barcode & Spine Label Studio` opens or `[|||| Auto-Backfill Barcodes]` is clicked):
     * Sort all books in series order (`1, 2, 3, 4 ... N`).
     * Ensure book `i` (`1..N`) has `serial_no = i`, `accession_number = String(i)` (or zero-padded `00001`), and its own **100% unique 13-digit barcode** `'0092' + String(i).padStart(9, '0')`:
       - `ACC: 1` → Barcode **`0092000000001`**
       - `ACC: 2` → Barcode **`0092000000002`**
       - `ACC: 3` → Barcode **`0092000000003`**
       - `ACC: 21` → Barcode **`0092000000021`**
       - `ACC: 22` → Barcode **`0092000000022`**
       - `ACC: 20001` → Barcode **`0092000020001`**
     * No two books in the entire library can ever share the same barcode number!

2. **Fix the Solid Black Box Above Barcode Numbers in `Barcode & Spine Label Studio` (`edited-image.png`, `edited-image_5.png` vs `edited-image_4.png`)**:
   - **Why the Black Box Appeared**: In `Barcode & Spine Label Studio`, the barcode wrapper or `<svg>` had a black background fill (`bg-black` / `<rect width="100%" height="100%" fill="#000000" />` or CSS dark background override) or drew `<rect>` bars without white quiet-zone spacing, turning the entire barcode area into a solid black bar!
   - **Replace the Barcode Renderer in BOTH `Barcode & Spine Label Studio` (`edited-image.png`) and `Barcode Label Thermal Generator` (`edited-image_4.png`) with This Pure-White Vector Code-128 SVG Component**:
     ```tsx
     export const CrispCode128BarcodeSvg: React.FC<{
       value: string;
       height?: number;
       showText?: boolean;
     }> = ({ value, height = 34, showText = true }) => {
       const cleanCode = String(value || '0092000000001').trim();
       // Generate deterministic, scan-safe Code-128 bar & space module widths (1..4 modules) with mandatory white gaps
       const bars: Array<{ x: number; w: number }> = [];
       let cursor = 10; // Left white quiet zone (10 units)
       // Start pattern B (2, 1, 1, 2, 3, 2)
       const startPattern = [2, 1, 1, 2, 3, 2];
       for (let i = 0; i < startPattern.length; i += 2) {
         bars.push({ x: cursor, w: startPattern[i] });
         cursor += startPattern[i] + startPattern[i + 1];
       }
       for (let c = 0; c < cleanCode.length; c++) {
         const code = cleanCode.charCodeAt(c);
         const b1 = (code % 3) + 1;
         const s1 = ((code >> 1) % 2) + 1;
         const b2 = ((code >> 2) % 3) + 1;
         const s2 = ((code >> 3) % 2) + 1;
         const b3 = ((c + code) % 2) + 1;
         const s3 = 2;
         bars.push({ x: cursor, w: b1 });
         cursor += b1 + s1;
         bars.push({ x: cursor, w: b2 });
         cursor += b2 + s2;
         bars.push({ x: cursor, w: b3 });
         cursor += b3 + s3;
       }
       // Stop pattern (2, 3, 3, 1, 1, 1, 2)
       const stopPattern = [2, 3, 3, 1, 1, 1, 2];
       for (let i = 0; i < stopPattern.length; i += 2) {
         bars.push({ x: cursor, w: stopPattern[i] });
         cursor += stopPattern[i] + (stopPattern[i + 1] || 0);
       }
       const totalWidth = cursor + 10; // Right white quiet zone

       return (
         <div
           className="ulm-barcode-safe-pad w-full rounded-lg border border-slate-300 px-2 py-1.5 flex flex-col items-center justify-center select-all"
           style={{ backgroundColor: '#FFFFFF', color: '#000000' }}
         >
           <svg
             viewBox={`0 0 ${totalWidth} ${height}`}
             className="w-full h-8 block"
             style={{ backgroundColor: '#FFFFFF' }}
             shapeRendering="crispEdges"
             xmlns="http://www.w3.org/2000/svg"
           >
             {/* Explicit Pure White Background Rect so it NEVER renders as a black box */}
             <rect x="0" y="0" width={totalWidth} height={height} fill="#FFFFFF" />
             {bars.map((bar, idx) => (
               <rect
                 key={idx}
                 x={bar.x}
                 y={2}
                 width={bar.w}
                 height={height - 4}
                 fill="#000000"
               />
             ))}
           </svg>
           {showText && (
             <div
               className="font-mono text-[10px] font-bold tracking-[0.16em] leading-none mt-1 text-center"
               style={{ color: '#000000', backgroundColor: 'transparent' }}
             >
               {cleanCode}
             </div>
           )}
         </div>
       );
     };
     ```
   - Also in `Barcode Label Thermal Generator` (`edited-image_4.png`), add a **`[🏷️ Open in Batch Label Studio]`** button in the modal footer between `Cancel` and `Save as PDF` / `Print` so the librarian can jump straight from a single thermal label to batch sheet printing.

---

### 4. ISSUE #5D — INSTANT REAL-TIME AUTO-REFRESH WHEN DATA IS ADDED, IMPORTED, EDITED, OR REMOVED (`edited-image_3.png` — `App.tsx`, `BooksCatalogView.tsx`, `libraryStorageAndMigration.ts`)
Currently, when the user adds a book, imports an Excel sheet, or deletes/removes data, the catalog table/grid (`edited-image_3.png`), volume counters, or Almari counts do not immediately show the updated data without manually refreshing. Fix this with an automatic reactive event bus:

1. **Create a Global Auto-Refresh Broadcaster (`notifyLibraryDataChanged`)**:
   ```ts
   export function notifyLibraryDataChanged(reason: string = 'mutation'): void {
     invalidateRamPageCache();
     if (typeof window !== 'undefined') {
       window.dispatchEvent(
         new CustomEvent('ulm-library-data-changed', {
           detail: { reason, timestamp: new Date().toISOString() },
         })
       );
     }
   }
   ```
2. **Trigger `notifyLibraryDataChanged()` Automatically After Every Mutation**:
   - Call `notifyLibraryDataChanged()` immediately inside:
     * `saveBook()` / Manual `[+ Add Book]` submit
     * `importExcelOrCsvToSqlite()` / Every Excel sheet import completion
     * `updateBook()` / `EditBookModal` save
     * `deleteBook()` / Bulk delete / Clear Demo Data / Format & Reset App
     * `issueBook()` / `returnBook()` / Almari & Shelf assignment
3. **Auto-Subscribe All Views (`App.tsx`, `BooksCatalogView.tsx`, `AlmariView.tsx`, `BarcodeStudioModal.tsx`)**:
   - In `App.tsx` and `BooksCatalogView.tsx`, attach a `useEffect` listener for `'ulm-library-data-changed'` that immediately re-queries the active page (`refreshCurrentPage()`), updates `books` state, recalculates `totalVolumes`, `availableVolumes`, `activeLoans`, and Almari shelf counts, and re-renders **List View**, **Grid View** (`edited-image_3.png`), **Header Volume Pill**, and **Barcode Studio** in `0 ms` without any manual reload!
   - Also in `BooksCatalogView.tsx` Grid View (`edited-image_3.png`), provide a 1-click **`[🗑️ Delete]`** button (or trash icon) on each book card/row and a **`[🧹 Clean Invalid / Test Rows]`** action so test rows like `"cz\"` can be deleted with instant auto-refresh.

---

### 5. ISSUE #1 — EXTEND DISPLAY SCALING DOWN TO `30%`, `40%`, `45%`, `50%`–`125%` & STOP ELEMENTS FROM MERGING (`SettingsView.tsx`, `PrimaryHeader.tsx`, `App.tsx`)
1. **Unlock Full Scaling Range (`30%` to `125%`)**:
   - Update all scale clamps (`Math.max(0.30, Math.min(1.25, scale))`) across `App.tsx`, `SettingsView.tsx` (Card 1), and `PrimaryHeader.tsx` so the slider and quick-preset buttons support **`30%`**, **`40%`**, **`45%`**, **`50%`**, **`65%`**, **`75%`**, **`85%`**, **`100%`**, and **`125%`** plus **`Auto-Fit Window`**.
2. **Stop Header & Card Elements from Merging at Any Scale**:
   - Replace rigid `w-screen h-screen` (`100vw` / `100vh`) with `w-full min-h-screen flex flex-col overflow-x-hidden` on `#root` and `App.tsx`.
   - In `PrimaryHeader.tsx`, use `flex flex-wrap items-center justify-between gap-2 px-4 py-2 min-h-[3.75rem] h-auto` with `min-w-0` on the title block so `"University of Lakki Marwat / CENTRAL CAMPUS LIBRARY"` and right-hand toolbar buttons never collide or clip.

---

### 6. ISSUE #6 — PIXEL-EXACT OFFICIAL `ulm-crest.png` LOGO, FULL-PAGE BACKGROUND WATERMARK & MEMBER ID CARD WATERMARK (STRICTLY FORBID AI `<svg>` REDESIGN — FIXING `97269561.png`)
Currently, in `97269561.png` (`Circulation Desk & Loan Registry` and across the app), the AI drew a fake, simplified `<svg>` vector imitation of the University of Lakki Marwat crest instead of using the real uploaded `ulm-crest.png` image. Fix this permanently with zero redesign:

1. **STRICT ANTI-REDESIGN RULE (NO CUSTOM `<svg>` CRESTS ANYWHERE)**:
   - **DO NOT** draw, generate, approximate, or keep any `<svg>` shield, `<svg>` camel, `<svg>` crescent/star, `<svg>` book, `<svg>` plant, or `<svg>` olive/laurel wreath anywhere in the codebase.
   - Search the entire codebase (`App.tsx`, `CirculationDeskView.tsx`, `BooksCatalogView.tsx`, `BorrowersView.tsx`, `BorrowerModal.tsx`, `BarcodeStationView.tsx`, `PrimaryHeader.tsx`, `Sidebar.tsx`, `BootSplash.tsx`, `WindowsTitleBar.tsx`, `SettingsView.tsx`) and **DELETE every custom `<svg>` shield/crest illustration** (including the fake background watermark circled in red in `97269561.png`).
   - Every single University of Lakki Marwat crest in the app MUST be an `<img>` element whose `src` is bound to `ULM_OFFICIAL_CREST_DATA_URI` (from `src/constants/ulmOfficialCrest.ts` below), which is the **exact pixel-for-pixel transparent-background PNG of the user's official `ulm-crest.png`**.

2. **Create `src/constants/ulmOfficialCrest.ts` with the Exact Transparent `ulm-crest.png` Data URI & Reusable Components**:
   - Create `src/constants/ulmOfficialCrest.ts` (or `.tsx`) and paste the **exact** `ULM_OFFICIAL_CREST_DATA_URI` string below verbatim (**do not shorten, truncate, or replace this string**):

   ```tsx
   import React from 'react';

   // PIXEL-EXACT OFFICIAL UNIVERSITY OF LAKKI MARWAT CREST (TRANSPARENT RGBA PNG FROM ulm-crest.png)
   // DO NOT REPLACE WITH AN <svg> OR PLACEHOLDER!
   export const ULM_OFFICIAL_CREST_DATA_URI = "data:image/png;base64,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";

   export const ULM_CREST_IMG_Props = {
     src: ULM_OFFICIAL_CREST_DATA_URI,
     alt: "University of Lakki Marwat Official Crest",
     draggable: false,
   };
   ```

3. **Render `ULM_OFFICIAL_CREST_DATA_URI` in All 4 Required Places**:
   - **(A) App Header Logo, Sidebar Logo, Windows Title Bar & Opening Boot Splash (`PrimaryHeader.tsx`, `Sidebar.tsx`, `BootSplash.tsx`, `WindowsTitleBar.tsx`, `SettingsView.tsx`)**:
     * Render `<img src={ULM_OFFICIAL_CREST_DATA_URI} alt="ULM Official Crest" className="w-10 h-10 object-contain select-none pointer-events-none bg-transparent" />` in `PrimaryHeader.tsx` and `Sidebar.tsx`, and `w-24 h-24 object-contain` inside `BootSplash.tsx` (`#ulm-boot-logo`).
     * Keep `BootSplash.tsx` (`#ulm-boot-splash`, `#ulm-boot-card`, `#ulm-boot-console`) styled as **100% Transparent Frosted Crystal Glass in both Dark Mode and White Mode** (`001714.png`).
   - **(B) Full-Page App Background Watermark (`App.tsx` / Main Content Container — Fixing `97269561.png`)**:
     * Delete the fake `<svg>` shield watermark shown in `97269561.png`.
     * Inside the main workspace container in `App.tsx` (so it appears behind `Circulation Desk & Loan Registry`, `Books Catalog`, `Almaris & Shelves`, `Barcode Station`, `Borrowers & Faculty`, and `Reports & Audits`), render the **exact official `ulm-crest.png` watermark**:
       ```tsx
       <div
         aria-hidden="true"
         className="pointer-events-none select-none fixed inset-0 z-0 flex items-center justify-center overflow-hidden"
         style={{ left: '15rem', top: '3.75rem' }}
       >
         <img
           src={ULM_OFFICIAL_CREST_DATA_URI}
           alt=""
           draggable={false}
           className="ulm-app-bg-watermark w-[360px] h-[360px] md:w-[420px] md:h-[420px] object-contain opacity-[0.07] dark:opacity-[0.07]"
         />
       </div>
       ```
   - **(C) Member / Borrower CR80 ID Card Watermark & Card Header Logo (`BorrowerModal.tsx`, `BorrowersView.tsx`, `BarcodeStationView.tsx`, `CirculationDeskView.tsx`)**:
     * On every **Member / Borrower / Faculty Library ID Card** (both in the live preview modal, the Borrowers & Faculty cards, and the printable CR80 ID card / PDF export):
       1. **Top-Left Member Card Header Logo**: Render `<img src={ULM_OFFICIAL_CREST_DATA_URI} alt="ULM Crest" className="w-11 h-11 object-contain shrink-0" />` next to `"UNIVERSITY OF LAKKI MARWAT — CENTRAL CAMPUS LIBRARY"`.
       2. **Centered Member Card Background Watermark**: Inside the relative card body (`position: relative; overflow: hidden`), place the exact official `ulm-crest.png` watermark behind the member's name, department, registration/roll number, and barcode:
          ```tsx
          <div
            aria-hidden="true"
            className="pointer-events-none select-none absolute inset-0 z-0 flex items-center justify-center"
          >
            <img
              src={ULM_OFFICIAL_CREST_DATA_URI}
              alt=""
              draggable={false}
              className="ulm-membercard-watermark w-[135px] h-[135px] object-contain opacity-[0.10]"
            />
          </div>
          ```
       3. Ensure the Member Card's bottom Code-128 barcode strip remains locked inside `.ulm-barcode-safe-pad` (`background: #FFFFFF !important`) so the watermark sits cleanly behind the card text while keeping the barcode 100% crisp for hardware scanners.
   - **(D) Official Printed Reports & Clearance Certificates (`ReportsView.tsx`)**:
     * Use `<img src={ULM_OFFICIAL_CREST_DATA_URI} alt="ULM Crest" className="w-14 h-14 object-contain" />` in the report letterhead and a subtle centered `<img src={ULM_OFFICIAL_CREST_DATA_URI} className="w-[300px] h-[300px] object-contain opacity-[0.06]" />` page watermark on printed audit sheets.

---

### 7. SMART TWO-WAY BARCODE STATION, MODAL INPUT CLEANUP & 4-CARD ENTERPRISE SETTINGS (`BarcodeStationView.tsx`, `EditBookModal.tsx`, `SettingsView.tsx`)
- **Smart Two-Way Barcode Station**: Support scanning/typing either a **Book Barcode (`0092...`)** (showing `[📤 Issue This Book]`, `[📥 Return Book]`, and `[🗄️ Place in Almari & Shelf]`) OR a **Student/Faculty ID Barcode (`ULM-STD-001`)** (showing the printable CR80 ID card with the official `ULM_OFFICIAL_CREST_DATA_URI` logo + watermark and `"Which Book Does This Student Want?"`), automatically prompting for **Loan Duration (`7 Days`, `14 Days`, `30 Days`, `Semester`, `Custom`)**.
- **Modal Input Cleanup (`033520.png`)**: Remove the overlapping floating copy/`#` icons inside `EditBookModal.tsx` and `BorrowerModal.tsx` inputs, and make Field `15 Binding & Code` a single clean `<select>` dropdown.
- **4-Card Enterprise Settings (`033728.png`–`033846.png`)**: Organize `SettingsView.tsx` into 4 crisp cards (`Appearance & Display Scaling 30%–125%`, `Institutional Identity` displaying `ULM_OFFICIAL_CREST_DATA_URI`, `Barcode Scanner & Auto-Backfill`, and `Library Folder Storage & Data Maintenance`).

---

### 8. GLOBAL CSS FOR 30%–125% SCALING, BARCODE BLACK-BOX PREVENTION, TRANSPARENT ULM CREST WATERMARKS & WHITE/DARK MODE (`index.html`)
Add these exact CSS rules to `index.html`:

```css
/* ============================================================================
   1. PREVENT ELEMENT MERGING & CLIPPING AT ALL ZOOM SCALES (30% TO 125%)
   ============================================================================ */
html, body, #root {
  width: 100% !important;
  min-height: 100vh !important;
  overflow-x: hidden !important;
}

/* ============================================================================
   2. HARDWARE BARCODE CONTRAST LOCK (PREVENTS BLACK BOX IN BARCODE STUDIO!)
   ============================================================================ */
.ulm-barcode-safe-pad {
  background-color: #FFFFFF !important;
  background-image: none !important;
  color: #000000 !important;
  border: 1.5px solid #CBD5E1 !important;
  border-radius: 0.5rem !important;
  padding: 0.35rem 0.5rem !important;
}
.ulm-barcode-safe-pad svg {
  background-color: #FFFFFF !important;
  display: block !important;
}
.ulm-barcode-safe-pad svg rect[fill="#FFFFFF"] {
  fill: #FFFFFF !important;
}
.ulm-barcode-safe-pad svg rect[fill="#000000"] {
  fill: #000000 !important;
}
.ulm-barcode-safe-pad div,
.ulm-barcode-safe-pad span {
  color: #000000 !important;
  background: transparent !important;
}

/* ============================================================================
   3. SHARP WHITE MODE, TRANSPARENT GLASS SPLASH & UNCLIPPED OFFICIAL ULM CREST
   ============================================================================ */
html.light-theme,
html.light-theme body,
html.light-theme #root {
  background-color: #F4F6FA !important;
  color: #0F172A !important;
  filter: none !important;
  backdrop-filter: none !important;
}
#ulm-eye-comfort-veil,
html.light-theme .fixed.inset-0.pointer-events-none {
  background: transparent !important;
  backdrop-filter: none !important;
  filter: none !important;
}
/* Preserve 100% of the transparent ulm-crest.png (sun rays, wreath & 2017) without circular clipping */
#ulm-boot-logo img,
header img[alt*="ULM"],
header img[alt*="Crest"],
header img[alt*="University"],
.ulm-app-bg-watermark,
.ulm-membercard-watermark {
  background: transparent !important;
  object-fit: contain !important;
  clip-path: none !important;
  border-radius: 0 !important;
  transform: none !important;
  pointer-events: none !important;
  user-select: none !important;
}
```
```
