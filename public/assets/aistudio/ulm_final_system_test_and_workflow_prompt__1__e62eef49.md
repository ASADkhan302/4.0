# 🚀 ULM CENTRAL CAMPUS LIBRARY — UNIFIED MASTER PROMPT (COVERING ALL 5 NEW ISSUES + ALL CORE SYSTEM FIXES)

Copy and paste the single unified prompt block below directly into **Google AI Studio**. It combines **all 5 issues you listed** plus all previous UI/UX, Splash Screen, Barcode Station, and White/Dark Mode fixes without any conflicts:

1. **Issue #1 — Extended Display Scaling (`30%`, `40%`, `45%`, `50%`–`125%`) & Anti-Merge Layout (`eacd60e6-179a-41bb-9bec-016f89ace086`)**
2. **Issue #2 — First-Install Storage Location & True Universal Unlimited Excel Sheet (Removing the `2,998` / `2,999` / `< 3,000` Row Cap in `edited-image_2.png`)**
3. **Issue #3 — Multi-Sheet Additive Excel Import (Never Overwriting Previous Sheets) & Continuous Infinite Series (`1, 2, 3, 4 ... ∞` Across Today, Tomorrow & Any Date — `1000185139.jpg`)**
4. **Issue #4 — Automatic System Date & Time Stamp (`new Date()`) Captured & Displayed on Every Single Book Entry & Excel Sheet Import**
5. **Issue #5 — Unique 13-Digit Barcodes per Book (Fixing Repeated `0092000020001`), Fixing the Solid Black Box Above Barcode Numbers in Batch Studio (`edited-image.png`, `edited-image_4.png`, `edited-image_5.png`), & Instant Auto-Refresh When Adding or Removing Data (`edited-image_3.png`)**
6. **Core Polish Kept Intact**: Transparent Glass Opening Splash Screen & ULM Crest Logo in Dark & White Mode (`001714.png`), Smart Two-Way Barcode Station, Modal Input Cleanup (`033520.png`), and 4-Card Enterprise Settings Layout (`033728.png`–`033846.png`).

---

```markdown
TASK: IMPLEMENT THE COMPLETE UNIFIED MASTER UPDATE FOR ULM CENTRAL CAMPUS LIBRARY —
(1) ISSUE #1: EXTEND DISPLAY SCALING DOWN TO 30% / 40% / 45% / 50%–125% & PREVENT HEADER/CARD MERGING,
(2) ISSUE #2: FIRST-INSTALL STORAGE LOCATION SETUP & SINGLE UNIVERSAL UNLIMITED EXCEL SHEET (REMOVE THE 2,998 / 2,999 ROW CAP IN "Where should your library be stored?"),
(3) ISSUE #3: ADDITIVE MULTI-SHEET EXCEL IMPORT (NEVER OVERWRITE PREVIOUS SHEETS) & UNBROKEN INFINITE SEQUENTIAL SERIES (`1, 2, 3, 4 ... Infinite` ACROSS MANUAL ADD & EXCEL IMPORTS ON ANY DATE),
(4) ISSUE #4: CAPTURE & DISPLAY EXACT LOCAL SYSTEM DATE & TIME (`new Date()`) ON EVERY MANUAL BOOK ENTRY & EXCEL SHEET IMPORT,
(5) ISSUE #5: GIVE EVERY BOOK A 100% UNIQUE BARCODE (FIX REPEATED `0092000020001`), REMOVE THE SOLID BLACK BOX ABOVE BARCODE DIGITS IN BARCODE & SPINE LABEL STUDIO, & AUTO-REFRESH ALL VIEWS INSTANTLY WHEN DATA IS ADDED OR REMOVED,
(6) KEEP TRANSPARENT GLASS OPENING SPLASH SCREEN (DARK & WHITE MODE), SMART TWO-WAY BARCODE STATION, AND 4-CARD ENTERPRISE SETTINGS

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

### 2. ISSUE #3 & #4 — ADDITIVE MULTI-SHEET IMPORT, UNBROKEN INFINITE SERIES (`1, 2, 3, 4 ... ∞`), & EXACT SYSTEM DATE/TIME STAMP (`ExcelImportModal.tsx`, `AddBookModal.tsx`, `libraryStorageAndMigration.ts` — `1000185139.jpg`)
Currently, importing a second Excel sheet overwrites/removes the first sheet's data, there is no button to append another sheet after importing, series numbers do not continue in order (`1, 2, 3, 4 ...`), and the system time of entry/import is not recorded. Fix all 4 parts:

1. **Strictly Additive Multi-Sheet Import (NEVER Overwrite Previous Sheets)**:
   - When importing any `.xlsx`, `.xls`, or `.csv` file in `Excel & CSV Accession Register Importer` (`1000185139.jpg`), **NEVER** call `store.clear()`, `DELETE FROM books`, or replace `books` state with only the new file's rows!
   - Always **APPEND** the newly imported sheet's books to the existing catalog (`existingBooks + newSheetBooks`) so importing Sheet 1 today, Sheet 2 tomorrow, and Sheet 3 next week combines all sheets into **one single universal catalog and one Universal Master Excel Sheet**.
   - Inside the `Excel & CSV Accession Register Importer` modal (`1000185139.jpg`) AND on the `Books Catalog` toolbar, always show a prominent **`[+ Import / Append Another Excel Sheet]`** button (allowing the user to import another sheet immediately or on any future date) plus an **"Imported Sheets History Log"** badge showing how many sheets have been merged, each sheet's filename, how many rows were added, the series range assigned (e.g., `Series #1 – #2,998`, `Series #2,999 – #5,450`), and the exact **System Date & Time** it was imported.

2. **Unbroken Infinite Sequential Series (`1, 2, 3, 4 ... Infinite`) Across All Sheets & Manual Entries (And Vice Versa)**:
   - Maintain a single global sequential series counter (`serial_no: 1, 2, 3, 4 ... ∞`) shared by **both** Excel/CSV Imports and Manual `[+ Add Book]` entries:
     ```ts
     export async function getCurrentMaxSeriesNumber(): Promise<number> {
       const allBooks = await getAllStoredBooksFromDb();
       let maxSeries = 0;
       for (const b of allBooks) {
         const s = Number(b.serial_no) || parseInt(String(b.accession_number || '').replace(/\D/g, ''), 10) || 0;
         if (Number.isFinite(s) && s > maxSeries) maxSeries = s;
       }
       return maxSeries;
     }
     ```
   - **How the Infinite Series Works**:
     * When the database is empty (`0` books) and Sheet 1 is imported (e.g., `2,998` rows), its books are stored in strict series **`1, 2, 3, 4 ... 2998`**.
     * When Sheet 2 is imported (today, tomorrow, or any date), the importer reads `maxSeries = 2998` and assigns Sheet 2's rows **`2999, 3000, 3001, 3002 ...`** continuously to infinity!
     * **Vice Versa**: If the user adds 1 book manually today via `[+ Add Book]`, it gets **`2999`**; if they import another Excel sheet tomorrow, its first row automatically starts at **`3000, 3001, 3002 ...`**. All manual entries and all imported sheets live together in one unbroken `1, 2, 3, 4 ... ∞` sequence.

3. **Automatic Local System Date & Time Stamp (`new Date()`) on Every Manual Book & Imported Excel Row (Issue #4)**:
   - Capture the computer's exact live **System Date & Time** at the moment a single book is added manually OR an Excel file is imported:
     ```ts
     export function getCurrentSystemDateTimeStamp(): {
       formattedSystemDateTime: string; // e.g. "23-Oct-2026, 12:39:07 PM"
       dateOnly: string;                // e.g. "23-Oct-2026"
       timeOnly: string;                // e.g. "12:39:07 PM"
       isoTimestamp: string;            // e.g. "2026-10-23T12:39:07.000+05:00"
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
   - Save on every book record:
     * `date_of_entry`: `formattedSystemDateTime` (e.g., `"23-Oct-2026, 12:39:07 PM"`)
     * `system_timestamp`: `isoTimestamp`
     * `entry_source`: `"Manual Entry"` or `"Excel Import: <filename>"`
   - Display `date_of_entry` (`Date & System Time Added`) in the **Books Catalog List & Grid Views**, inside **Book Record Details**, inside **Add/Edit Book Modals** (auto-filled with live system date & time), and as dedicated columns (`Series #`, `Accession No`, `Barcode`, `Date & System Time Added`, `Entry Source / Sheet`) in the **Universal Master Excel Sheet**.

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

### 6. TRANSPARENT GLASS OPENING SPLASH SCREEN & ULM CREST LOGO IN BOTH DARK & WHITE MODE (`001714.png` — `BootSplash.tsx`)
- Add `id="ulm-boot-splash"`, `id="ulm-boot-logo"`, `id="ulm-boot-card"`, and `id="ulm-boot-console"` to the Opening Splash Screen.
- Style the backdrop, center card, and boot-log console as **100% Transparent Frosted Crystal Glass in BOTH Dark Mode and White Mode** (fixing the opaque white box in `001714.png`), and clip the ULM Crest logo in a clean circle (`clip-path: circle(44.5% at 50% 50%)`) so its outer gray square corners are invisible.

---

### 7. SMART TWO-WAY BARCODE STATION, MODAL INPUT CLEANUP & 4-CARD ENTERPRISE SETTINGS (`BarcodeStationView.tsx`, `EditBookModal.tsx`, `SettingsView.tsx`)
- **Smart Two-Way Barcode Station**: Support scanning/typing either a **Book Barcode (`0092...`)** (showing `[📤 Issue This Book]`, `[📥 Return Book]`, and `[🗄️ Place in Almari & Shelf]`) OR a **Student/Faculty ID Barcode (`ULM-STD-001`)** (showing the printable CR80 ID card + `"Which Book Does This Student Want?"`), automatically prompting for **Loan Duration (`7 Days`, `14 Days`, `30 Days`, `Semester`, `Custom`)**.
- **Modal Input Cleanup (`033520.png`)**: Remove the overlapping floating copy/`#` icons inside `EditBookModal.tsx` and `BorrowerModal.tsx` inputs, and make Field `15 Binding & Code` a single clean `<select>` dropdown.
- **4-Card Enterprise Settings (`033728.png`–`033846.png`)**: Organize `SettingsView.tsx` into 4 crisp cards (`Appearance & Display Scaling 30%–125%`, `Institutional Identity`, `Barcode Scanner & Auto-Backfill`, and `Library Folder Storage & Data Maintenance`).

---

### 8. GLOBAL CSS FOR 30%–125% SCALING, BARCODE BLACK-BOX PREVENTION & WHITE/DARK MODE (`index.html`)
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
   3. SHARP WHITE MODE & TRANSPARENT GLASS OPENING SPLASH (DARK & WHITE MODE)
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
#ulm-boot-logo img,
header img[alt*="ULM"],
header img[alt*="Crest"],
header img[alt*="University"] {
  border-radius: 9999px !important;
  clip-path: circle(44.5% at 50% 50%) !important;
  transform: scale(1.14) !important;
  background: transparent !important;
}
```
```
