# University of Lakki Marwat (ULM) Central Campus Library — All-in-One Ultimate Master Prompt (All Bug Fixes, UI Upgrades, SQLite/IndexedDB Engine & Desktop `.exe` Readiness)

Copy and paste the **Single Unified Master Prompt** in **Section 1** below directly into **Google AI Studio** (and use **Section 2** in **Antigravity** when compiling the Windows `.exe` installer). It merges **every bug fix and architectural update** from all of your prompts and backend files (`sqliteEngine.cjs`, `main.cjs`, `preload.cjs`, `libraryStorageAndMigration.ts`) into one conflict-free specification.

## Summary of All Consolidated Fixes & Updates Included

| Area / Module | Bug Fixed / Update Applied | Target Files |
| :--- | :--- | :--- |
| **1. First-Install Welcome Modal** | Opens **only once** on fresh installation (`ulm_workstation_setup_completed_v1 = 'true'`); wide `max-w-4xl` 3-card layout; fixes invisible dark-on-black `"UNIVERSITY OF LAKKI MARWAT"` title in White Mode; replaces fake `<svg>` shield with real ULM 2017 Crest | `App.tsx`, `StorageSetupModal.tsx`, `WelcomeModal.tsx` |
| **2. Full-Width Executive Header** | Taller `96px–108px` edge-to-edge header (`w-full max-w-none mx-0`); flush-left `64px–80px` crest pedestal + `30px–34px` title (`mr-auto`); flush-right `48px–52px` action buttons (`ml-auto`); removes duplicate `[Barcode Station]` and `[● ULM Library]` top buttons | `PrimaryHeader.tsx`, `Sidebar.tsx` |
| **3. Locked Sidebar & Smooth Vertical Scroll** | Locks Left Sidebar (`Sidebar.tsx`) in place; restores smooth mouse-wheel vertical scrolling (`#ulm-main-scroll-view`) across all 8 views and all modals at every zoom level (`30%–125%`) | `index.html`, `App.tsx`, `Sidebar.tsx`, All 8 Views |
| **4. Unlimited Storage & Multi-Sheet Series (`1 → ∞`)** | Removes `2,998`/`2,999` Excel row cap and `localStorage` 5 MB limit; stores 100,000+ books in `SQLite` (`ulm-library.sqlite`) + `IndexedDB` (`ulm_library_idb_v1`); Sheet 1 (`1..5000`) + Sheet 2 (`10,000` books) auto-sequences as `5001..15000`; strict numeric sorting (`1 → ∞`) | `libraryStorageAndMigration.ts`, `ExcelImportModal.tsx`, `sqliteEngine.cjs`, `main.cjs`, `preload.cjs` |
| **5. System Date/Time & Instant Auto-Refresh** | Captures live local system date & time (`new Date()`) on every manual book entry and Excel import; broadcasts `'ulm-library-data-changed'` so tables, grids, and KPI counters refresh in `0 ms` | `AddBookModal.tsx`, `BooksCatalogView.tsx`, `libraryStorageAndMigration.ts` |
| **6. Unique 13-Digit Barcodes & Pure-White SVG** | Fixes repeated `0092000020001` (`ACC: 1` → `0092000000001`, `ACC: 2` → `0092000000002`); replaces solid black box above barcode digits with `CrispCode128BarcodeSvg` (`#FFFFFF` background lock) | `BarcodeStudioModal.tsx`, `BarcodeStationView.tsx` |
| **7. Pixel-Exact Official ULM 2017 Crest** | Embeds exact transparent `ulm-crest.png` (`ULM_OFFICIAL_CREST_DATA_URI` / `./image_0.png`) in Header, Welcome Modal, Boot Splash, Full-Page Watermark, CR80 Member ID Cards, and Reports; strictly forbids fake AI `<svg>` shields | `constants/ulmOfficialCrest.ts`, `MembersSection.tsx`, `App.tsx` |
| **8. White/Dark Mode Contrast & Clean Modals** | Removes full-screen blurry/dim veil (`#ulm-eye-comfort-veil`); dims only open modal backdrops; removes overlapping `#`/copy icons inside modal inputs; cleans up `SettingsView.tsx` into 4 high-contrast enterprise cards | `index.html`, `EditBookModal.tsx`, `BorrowerModal.tsx`, `SettingsView.tsx` |
| **9. Offline Antigravity `.exe` Readiness** | Removes all external CDN scripts/fonts; bundles `xlsx`, `lucide-react`, and Tailwind locally; adds WebView2 (`window.chrome.webview`) + Electron (`window.ulmLibraryApi`) desktop bridge | `index.html`, `package.json`, `vite.config.ts`, `desktopHostBridge.ts` |

## Section 1 — Copy-Paste Master Prompt for Google AI Studio

```markdown
TASK: APPLY THE COMPLETE ALL-IN-ONE MASTER FIX & ARCHITECTURAL UPGRADE FOR THE UNIVERSITY OF LAKKI MARWAT — CENTRAL CAMPUS LIBRARY MANAGEMENT SYSTEM (`ULMLibrary`)

Please update the project files (`index.html`, `package.json`, `vite.config.ts`, `src/constants/ulmOfficialCrest.ts`, `src/services/libraryStorageAndMigration.ts`, `src/services/desktopHostBridge.ts`, `src/App.tsx`, `src/components/PrimaryHeader.tsx`, `src/components/Sidebar.tsx`, `src/components/StorageSetupModal.tsx` / `WelcomeModal.tsx`, `src/components/BootSplash.tsx`, `src/components/BooksCatalogView.tsx`, `src/components/AlmariView.tsx`, `src/components/BarcodeStationView.tsx`, `src/components/BarcodeStudioModal.tsx`, `src/components/CirculationDeskView.tsx`, `src/components/BorrowersView.tsx` / `MembersSection.tsx`, `src/components/ReportsView.tsx`, `src/components/ExcelMigrationView.tsx`, `src/components/ExcelImportModal.tsx`, `src/components/SettingsView.tsx`, `src/components/AddBookModal.tsx`, `src/components/EditBookModal.tsx`, `src/components/BookDetailsModal.tsx`, and `src/components/BorrowerModal.tsx`) so that EVERY single requirement below is implemented cleanly without breaking or reverting any existing feature:

================================================================================
PART 1: PIXEL-EXACT OFFICIAL ULM 2017 CREST (`ULM_OFFICIAL_CREST_DATA_URI` / `image_0.png`) — STRICTLY FORBID FAKE `<svg>` SHIELDS
================================================================================
1. **Strict Anti-SVG Crest Rule**:
   - **DO NOT** draw, generate, approximate, or keep any custom `<svg>` shield, `<svg>` camel, `<svg>` crescent/star, `<svg>` open book, or `<svg>` wreath anywhere in the codebase.
   - Delete every fake `<svg>` crest illustration across `App.tsx`, `StorageSetupModal.tsx`, `PrimaryHeader.tsx`, `Sidebar.tsx`, `BootSplash.tsx`, `CirculationDeskView.tsx`, `BorrowersView.tsx`, `BorrowerModal.tsx`, and `ReportsView.tsx`.
   - Every University of Lakki Marwat logo and watermark in the app MUST be an `<img>` element bound to `ULM_OFFICIAL_CREST_DATA_URI` (from `src/constants/ulmOfficialCrest.ts` below, with automatic fallback to `./image_0.png`).

2. **Create `src/constants/ulmOfficialCrest.ts` Verbatim**:
   Create `src/constants/ulmOfficialCrest.ts` and paste the exact `ULM_OFFICIAL_CREST_DATA_URI` string below verbatim (do not truncate or replace):
   ```ts
   export const ULM_OFFICIAL_CREST_DATA_URI = "data:image/png;base64,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";
   export const ULM_CREST_URL = ULM_OFFICIAL_CREST_DATA_URI;
   export const ULM_CREST_IMG_PROPS = {
     src: ULM_OFFICIAL_CREST_DATA_URI,
     alt: "University of Lakki Marwat Official Crest",
     draggable: false,
   };
   ```

3. **Render `ULM_OFFICIAL_CREST_DATA_URI` in All 5 Required Places**:
   - **Top Executive Header (`PrimaryHeader.tsx`) & Windows Title Bar (`WindowTitleBar.tsx`)**: Inside the luxury left-docked pedestal (`w-16 h-16 xl:w-20 xl:h-20`).
   - **First-Install Welcome Onboarding Modal (`StorageSetupModal.tsx` / `WelcomeModal.tsx`)**: Inside the modal hero header pedestal (`w-16 h-16 sm:w-20 sm:h-20`) and subtle corner watermark.
   - **Opening Boot Splash (`BootSplash.tsx`)**: `w-24 h-24 object-contain` inside a 100% transparent frosted crystal glass splash card in both White Mode and Dark Mode.
   - **Full-Page Application Background Watermark (`App.tsx`)**:
     ```tsx
     <div
       id="app-bg-watermark"
       aria-hidden="true"
       className="pointer-events-none select-none fixed inset-0 z-0 flex items-center justify-center overflow-hidden"
       style={{ left: '16rem', top: '6rem' }}
     >
       <img
         src={ULM_OFFICIAL_CREST_DATA_URI}
         alt=""
         draggable={false}
         className="ulm-app-bg-watermark w-[360px] h-[360px] md:w-[420px] md:h-[420px] object-contain opacity-[0.06] dark:opacity-[0.06]"
       />
     </div>
     ```
   - **Student & Faculty CR80 Identity Cards (`BorrowerModal.tsx`, `BorrowersView.tsx`, `MembersSection.tsx`, `BarcodeStationView.tsx`) & Printed Reports (`ReportsView.tsx`)**: Render `ULM_OFFICIAL_CREST_DATA_URI` as the top-left official card header logo (`w-11 h-11 object-contain`) AND as a centered `opacity-[0.10]` security watermark (`w-[135px] h-[135px] object-contain pointer-events-none`) behind the member's details, while keeping the bottom Code-128 barcode strip inside a pure white `.ulm-barcode-safe-pad` (`#FFFFFF`) box.

================================================================================
PART 2: FIRST-INSTALL WELCOME ONBOARDING MODAL — SHOW ONLY ONCE ON FIRST INSTALLATION & ULTRA-PREMIUM EXECUTIVE DESIGN (`StorageSetupModal.tsx` / `App.tsx`)
================================================================================
1. **Show ONLY ONCE When the App Is First Installed (Never Pop Up on Every Launch)**:
   - In `App.tsx` and `libraryStorageAndMigration.ts`, implement persistent first-install detection:
     ```ts
     const SETUP_COMPLETED_KEY = 'ulm_workstation_setup_completed_v1';
     const LEGACY_SETUP_KEYS = [
       'ulm_setup_complete',
       'ulm_onboarding_complete',
       'ulm_data_folder_config_v1',
       'ulm_library_initialized'
     ];

     export function isWorkstationAlreadyInstalledAndConfigured(existingBookCount: number = 0): boolean {
       try {
         if (localStorage.getItem(SETUP_COMPLETED_KEY) === 'true') return true;
         for (const key of LEGACY_SETUP_KEYS) {
           const val = localStorage.getItem(key);
           if (val && val !== 'false' && val !== 'null') {
             localStorage.setItem(SETUP_COMPLETED_KEY, 'true');
             return true;
           }
         }
         if (existingBookCount > 0) {
           localStorage.setItem(SETUP_COMPLETED_KEY, 'true');
           return true;
         }
       } catch (_) {}
       return false;
     }

     export function markWorkstationSetupCompleted(mode: string = 'default'): void {
       try {
         localStorage.setItem(SETUP_COMPLETED_KEY, 'true');
         localStorage.setItem('ulm_library_initialized', 'true');
         localStorage.setItem(
           'ulm_data_folder_config_v1',
           JSON.stringify({
             isConfigured: true,
             setupMode: mode,
             folderPath: 'Documents\\ULM Library',
             masterSheet: 'ULM_Master_Books_Register.xlsx (Universal Unlimited Rows — Auto-Synced)',
             completedAt: new Date().toISOString(),
           })
         );
       } catch (_) {}
     }
     ```
   - Initialize `const [isSetupModalOpen, setIsSetupModalOpen] = useState<boolean>(() => !isWorkstationAlreadyInstalledAndConfigured(0));` and also auto-close/mark completed once `IndexedDB` / `SQLite` hydrates if `existingBookCount > 0`.
   - Immediately call `markWorkstationSetupCompleted(...)` and `setIsSetupModalOpen(false)` when the user clicks **"Start as a New Library"**, **"Import My Existing Excel Sheet"**, **"Restore Library Package (.ulmpack)"**, **"Enter Library Workstation →"**, or the top-right **`✕`** button.
   - Only clear `ulm_workstation_setup_completed_v1` if the user explicitly triggers **Factory Reset** inside `System Settings`.

2. **Redesign Welcome Modal (`StorageSetupModal.tsx`) for High-Contrast White Mode & Dark Mode**:
   - Fix the bug where the Welcome Modal body stayed dark (`#1C191E`) in White Mode while `"UNIVERSITY OF LAKKI MARWAT"` turned dark navy (`#0F172A`), making the title invisible.
   - Use a wide **Executive Institutional Onboarding Suite (`max-w-4xl w-full rounded-3xl`)** with adaptive Ivory-Gold in White Mode (`bg-gradient-to-b from-[#FFFDF9] via-[#FAF6EC] to-[#F3EBD9]`) and Royal Obsidian in Dark Mode (`dark:from-[#150E22] dark:via-[#110B1C] dark:to-[#0C0814]`), a top 24K gold accent bar (`h-2 bg-gradient-to-r from-[#541A72] via-[#D49B27] to-[#541A72]`), the official `ULM_OFFICIAL_CREST_DATA_URI` crest pedestal, a 3-column horizontal grid (`grid-cols-1 md:grid-cols-3 gap-5`) for the 3 setup options, and a bottom assurance bar with **"Enter Library Workstation →"**.
   - Remove any mention of `(2,999 formatted rows)` and display `ULM_Master_Books_Register.xlsx (Universal Unlimited Rows — Auto-Synced)`.

================================================================================
PART 3: BIGGER FULL-WIDTH EXECUTIVE HEADER (`PrimaryHeader.tsx`) & DE-DUPLICATED SIDEBAR (`Sidebar.tsx`)
================================================================================
1. **Full-Width Edge-to-Edge Header Shell (`PrimaryHeader.tsx`)**:
   - Remove any `max-w-7xl`, `max-w-[1600px]`, `container`, or `mx-auto` inside `<header>` so content is never pulled toward the center.
   - Use `<header className="shrink-0 w-full max-w-none mx-0 min-h-[96px] xl:min-h-[108px] px-5 lg:px-8 py-4 bg-gradient-to-r from-[#FFFDF9]/95 via-[#FAF5E8]/95 to-[#F6EFE0]/95 dark:from-[#160D22]/95 dark:via-[#1C112B]/95 dark:to-[#120B1B]/95 backdrop-blur-2xl border-b-2 border-[#D4B475]/55 dark:border-[#FFD147]/25 shadow-[0_10px_30px_-10px_rgba(30,20,43,0.10)] z-30 select-none">`.
   - **Far-Left Identity Block (`mr-auto shrink-0 flex items-center gap-4 xl:gap-5`)**:
     * Official ULM 2017 Crest inside a double-rimmed pedestal (`w-16 h-16 xl:w-20 xl:h-20 rounded-2xl p-2 bg-gradient-to-br from-[#FFFFFF] via-[#FBF4E4] to-[#EFE0BE] dark:from-white/15 dark:to-white/5 border-2 border-[#C8963E]/65 dark:border-[#FFD147]/40 shadow-md`).
     * University Title (`"University of Lakki Marwat"`): `font-display text-3xl xl:text-[34px] font-extrabold tracking-tight leading-[1.08] text-[#1A1027] dark:text-white`.
     * Subtitle (`"CENTRAL CAMPUS LIBRARY"`): `text-sm xl:text-[15px] font-extrabold uppercase tracking-[0.24em] text-[#8A4B00] dark:text-[#FFD147]`.
     * Dynamic Volumes Pill Badge (`"{totalVolumes.toLocaleString()} Volumes"`): `px-4 py-1 rounded-full text-xs xl:text-sm font-extrabold bg-gradient-to-r from-[#F5E1B0] to-[#EBC97E] dark:from-[#FFD147]/25 dark:to-[#B8731B]/25 text-[#5E3200] dark:text-[#FFD147] border border-[#C59032]/55 tabular-nums`.
   - **Far-Right Action Buttons Cluster (`ml-auto shrink-0 flex items-center gap-3 xl:gap-3.5 flex-wrap justify-end`)**:
     * **Remove** duplicate `[Barcode Station]` and `[● ULM Library]` buttons from the top header.
     * Keep only the streamlined executive buttons (`White Glass / Dark Glass`, `Zoom % (30%–125% / Auto-Fit)`, `Sync Sheet`, `Export`, `Master Excel`, and one primary gold `+ Add Book` CTA).
     * Style secondary buttons with `h-12 xl:h-[52px] px-5 xl:px-6 rounded-2xl text-[15px] xl:text-base font-extrabold flex items-center gap-2.5 bg-white/95 hover:bg-white dark:bg-white/10 dark:hover:bg-white/15 text-[#1E142B] dark:text-white border border-[#DCCB9E] dark:border-white/15 hover:border-[#B8731B] shadow-sm transition-all` and `+ Add Book` with `h-12 xl:h-[52px] px-6 xl:px-7 rounded-2xl text-[15px] xl:text-base font-extrabold flex items-center gap-2.5 bg-gradient-to-r from-[#8E4F0B] via-[#B4690E] to-[#CE851D] text-white border border-[#E7BC61]/60 shadow-md`.

2. **Left Sidebar Cleanup (`Sidebar.tsx`)**:
   - Remove `"Quick Search"` (duplicate of `Books Catalog` search).
   - Keep the 8 core modules: `Books Catalog`, `Almaris & Shelves`, `Barcode Station`, `Circulation Desk`, `Borrowers & Faculty`, `Reports & Audits`, `Excel & PC Migration`, and `System Settings`.

================================================================================
PART 4: LOCKED LEFT SIDEBAR & SMOOTH VERTICAL SCROLLING ACROSS ALL 8 PAGES AND MODALS AT EVERY ZOOM SCALE (30%–125%)
================================================================================
1. **Global Viewport & Scrollbar Engine (`index.html` / `index.css`)**:
   - Lock `html, body` (`width: 100% !important; height: 100% !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important;`) and `#root` (`width: 100% !important; height: 100dvh !important; max-height: 100dvh !important; overflow: hidden !important; display: flex !important; flex-direction: column !important;`).
   - Configure `#ulm-main-scroll-view, .ulm-page-scroll-container` with:
     `flex: 1 1 0% !important; min-height: 0 !important; min-width: 0 !important; height: 100% !important; overflow-y: auto !important; overflow-x: hidden !important; overscroll-behavior-y: contain !important; pointer-events: auto !important;`

2. **Master App Shell Flex Hierarchy & Zoom Compensation (`App.tsx`)**:
   - Support full display scaling from **`30%`, `40%`, `45%`, `50%`, `65%`, `75%`, `85%`, `100%`, `115%`, to `125%`** plus **`Auto-Fit Window`** (`Math.max(0.30, Math.min(1.25, scale))`).
   - Compensate outer container height when zoomed (`height: appZoom && appZoom !== 1 ? `calc(100dvh / ${appZoom})` : '100dvh'`).
   - Below the `shrink-0` top header, use `<div className="flex-1 min-h-0 w-full flex flex-row overflow-hidden relative">` containing:
     * `<aside>` (`Sidebar.tsx`): `shrink-0 h-full min-h-0 flex flex-col justify-between overflow-hidden z-20` (pinned top header, `flex-1 min-h-0 overflow-y-auto` nav list, and `shrink-0` bottom footer with `System Settings` & `Collapse Sidebar`).
     * `<main id="ulm-main-scroll-view" ref={mainScrollRef} className="ulm-page-scroll-container flex-1 min-w-0 min-h-0 h-full overflow-y-auto overflow-x-hidden relative z-10 p-4 md:p-6">`, automatically resetting `mainScrollRef.current?.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })` whenever `activeTab` changes.

3. **Remove Scroll-Blocking `h-full overflow-hidden` from All 8 Page Views & All Modals**:
   - In `BooksCatalogView.tsx`, `AlmariView.tsx`, `BarcodeStationView.tsx`, `CirculationDeskView.tsx`, `BorrowersView.tsx`, `ReportsView.tsx`, `ExcelMigrationView.tsx`, and `SettingsView.tsx`, ensure the root view wrapper uses `w-full h-auto min-h-0 flex flex-col gap-5 pb-16 overflow-visible` (NEVER `h-full overflow-hidden` or `h-screen overflow-hidden`).
   - Wrap every modal dialog (`AddBookModal`, `EditBookModal`, `BookDetailsModal`, `BorrowerModal`, `BarcodeStudioModal`, `ExcelImportModal`) in `max-h-[88dvh] flex flex-col overflow-hidden` with a `shrink-0` header, `flex-1 min-h-0 overflow-y-auto custom-scrollbar p-5` body, and `shrink-0` footer.

================================================================================
PART 5: UNLIMITED STORAGE (`SQLite` + `IndexedDB`), ADDITIVE MULTI-SHEET CONTINUOUS SERIES (`1, 2, 3 ... 5000, 5001 ... 15000 ... ∞`), SYSTEM DATE/TIME STAMP & INSTANT AUTO-REFRESH
================================================================================
1. **Remove the `2,998` / `2,999` Row Cap & `localStorage` 5 MB Bottleneck (`libraryStorageAndMigration.ts`, `sqliteEngine.cjs`, `main.cjs`, `preload.cjs`)**:
   - Delete any `2998`, `2999`, or `3000` row loop limit in Excel sheet generation or import.
   - Never store the full `books` array in `localStorage`. Store 100% of books in `ulm-library.sqlite` (when running in Electron via `window.ulmLibraryApi` with 250-row chunked IPC `importSingleChunk` and deferred shelf recount `skipShelfRecalc`) and `IndexedDB` (`ulm_library_idb_v1`, store `books`) in Browser / WebView2.
   - Render catalog tables and grids using **50-row pagination (`DEFAULT_CATALOG_PAGE_SIZE = 50`)** with 200ms debounced search so 4,000 to 100,000+ books browse in `< 15 ms` with zero UI freeze.
   - Export all books into one single **Universal Master Excel Worksheet (`ULM_Master_Books_Register.xlsx`)** sorted in strict numeric series order (`1, 2, 3 ... ∞`).

2. **Additive Multi-Sheet Continuous Series Auto-Continuation (`1..5000` + `10,000 more` = `5001..15000`)**:
   - When importing any Excel/CSV sheet, **never** clear existing books (`store.clear()` is forbidden during import) and **never** overwrite or skip rows because Sheet 2's internal rows also start at `1..10000`.
   - Read the current highest series number (`let runningSeries = await getCurrentMaxSeriesNumber()`).
   - For every valid imported row, increment `runningSeries++`, set `serial_no = runningSeries`, `accession_number = String(runningSeries)`, `barcode = '0092' + String(runningSeries).padStart(9, '0')`, preserve the sheet's original accession cell in `original_sheet_acc`, and commit in 250-row chunks using `upsert` / `store.put()`.
   - When a book is added manually via `[+ Add Book]`, assign `runningSeries = (await getCurrentMaxSeriesNumber()) + 1`.
   - Set default catalog sort in `BooksCatalogView.tsx` to **`Sort: Series Order (1 → ∞)`** using strict numeric comparison (`Number(a.serial_no) - Number(b.serial_no)`), never ASCII string sorting.
   - In `ExcelImportModal.tsx`, display a live **Continuous Series Preview Banner** (`"Existing Library: 5,000 Books (Series #1 – #5,000) → This Sheet will be appended as Series #5,001 – #15,000"`).

3. **Automatic Local System Date & Time Stamp (`new Date()`) on Every Book Entry & Import**:
   - Capture the computer's live local date and time (`e.g. "25-Oct-2026, 02:45:10 PM"`) via `getCurrentSystemDateTimeStamp()` on every manual book addition and every imported Excel row, storing `date_of_entry`, `system_timestamp`, and `entry_source` (`"Manual Entry"` or `"Excel Import: <filename>"`).
   - Display `date_of_entry` in Catalog List View, Book Details, Edit Book Modal, and the Master Excel export.

4. **Instant Real-Time UI Auto-Refresh (`notifyLibraryDataChanged`)**:
   - Broadcast `window.dispatchEvent(new CustomEvent('ulm-library-data-changed', { detail: { reason, timestamp: new Date().toISOString() } }))` immediately after `saveBook`, `importExcelOrCsvToSqlite`, `updateBook`, `deleteBook`, `issueBook`, `returnBook`, `clearDemoData`, and `resetApp`.
   - Subscribe `App.tsx`, `BooksCatalogView.tsx`, `AlmariView.tsx`, and `BarcodeStudioModal.tsx` to `'ulm-library-data-changed'` so all views, volume pills, and shelf counts refresh in `0 ms` without reloading.

================================================================================
PART 6: 100% UNIQUE 13-DIGIT BARCODES (`0092` + 9-DIGIT SERIAL) & PURE-WHITE VECTOR CODE-128 BARCODE RENDERER (FIXING REPEATED `0092000020001` & SOLID BLACK BOX)
================================================================================
1. **100% Unique 13-Digit Barcode per Book (`generateUniqueBookBarcode` & `repairAllBookSeriesAndBarcodes`)**:
   - Ensure every book `i` (`1..N`) has its own unique 13-digit barcode `'0092' + String(i).padStart(9, '0')` (`ACC: 1` → `0092000000001`, `ACC: 2` → `0092000000002`, ..., `ACC: 20001` → `0092000020001`).
   - Automatically run a fast de-duplication check on startup and when opening `Barcode & Spine Label Studio` so no two books ever share `0092000020001`.

2. **Fix the Solid Black Box Above Barcode Numbers (`CrispCode128BarcodeSvg` + `.ulm-barcode-safe-pad`)**:
   - In `BarcodeStudioModal.tsx` (`Barcode & Spine Label Studio` and `Barcode Label Thermal Generator`), `BookDetailsModal.tsx`, and `BorrowerModal.tsx`, render all barcodes using `CrispCode128BarcodeSvg` wrapped in `.ulm-barcode-safe-pad` (`backgroundColor: '#FFFFFF', color: '#000000'`) with an explicit `<rect x="0" y="0" width={totalWidth} height={height} fill="#FFFFFF" />` behind the black `<rect fill="#000000" />` bars and a `10`-unit white quiet zone on both sides.
   - Add a **`[🏷️ Open in Batch Label Studio]`** button inside the single Thermal Barcode Generator footer.

================================================================================
PART 7: WHITE MODE & DARK MODE CONTRAST POLISH, REMOVAL OF BLURRY VEIL (`#ulm-eye-comfort-veil`), CLEAN MODALS & 4-CARD ENTERPRISE SETTINGS
================================================================================
1. **Eliminate the Full-Screen Blurry/Dim Veil in White Mode (`index.html`, `App.tsx`)**:
   - Remove `#ulm-eye-comfort-veil` and strip all `backdrop-filter: blur(...)` and dark background fills from `.fixed.inset-0.pointer-events-none` layers so every page in White Mode is 100% razor-sharp and bright (`#F4F6FA`).
   - Apply modal backdrop dimming (`background-color: rgba(15, 23, 42, 0.42) !important; backdrop-filter: blur(4px) !important;`) **ONLY** to active interactive modal wrappers (`div.fixed.inset-0.flex:not(.pointer-events-none)`).
   - Convert dark cards (`bg-[#0...]`, `bg-[#1...]`, `bg-slate-9...`) to crisp `#FFFFFF` cards with `#E2E8F0` borders and `#0F172A` text in `html.light-theme`, while preserving `.ulm-preserve-dark` on 3D Book Covers and CR80 Member ID Card headers.

2. **Clean Up UI Clutter Across Views & Modals**:
   - **`BooksCatalogView.tsx`**: Remove the duplicate `[+ Add Book]` and `[Almari View]` buttons from the filter bar; place secondary filters (`Groups`, `Copies`, `Date From/To`) inside a `[Filters ▾]` popover; replace `"Low Stock (1 copies)"` with an emerald `"1 Available"` badge; ensure the `BARCODE / CALL NO` column renders in `font-mono text-xs font-bold text-slate-900 dark:text-slate-100`.
   - **`AlmariView.tsx`**: Remove the second duplicate `[+ Add Almari]` button; add `pl-10` left padding to `"Find a book..."` and `"Search almaris..."` inputs so the `<Search />` icon never overlaps text; compact `Shelf 1`–`Shelf 5` rows into `min-h-[84px] p-4 rounded-xl` cards.
   - **`EditBookModal.tsx` & `BorrowerModal.tsx`**: Remove all floating `#` and copy-link icon badges from inside the top-left of text inputs (`Author`, `Place of Pub.`, `Publisher`, `Date Added`, `Full Name`, `Roll Number`); make Field `15 Binding & Code` a single clean `<select>` dropdown (`01 — Hardbound`, `02 — Paperback`, `03 — Spiral / Report`, `04 — Leather Archival`).
   - **`CirculationDeskView.tsx`**: Replace raw transaction hashes (`tx-177667...`) on Loan Cards with Book Accession Number (`Acc #00009`) + Issue Date; style all 4 KPI numbers (`ALL LOANS`, `ACTIVE LOANS`, `OVERDUE`, `RETURNED`) with `text-slate-900 dark:text-white`.
   - **`ExcelMigrationView.tsx`**: Remove the manual `"Full-Library Scaling & Live Database Recount"` debug card (recounting runs automatically after every mutation).
   - **`SettingsView.tsx`**: Remove the duplicate `"Book Sheets Sync"` sub-tab and organize Settings into **4 clean, high-contrast enterprise cards**:
     1. *Appearance & Display Scaling* (`☀️ White Mode` vs `🌙 Dark Mode`, Surface Tones, and Display Scaling `30%–125%` + `Auto-Fit Window`; remove `Eye-Comfort Glare Dimmer` and `Liquid Glass Physics` clutter).
     2. *Institutional Identity & Campus Header Details* (with live preview showing `ULM_OFFICIAL_CREST_DATA_URI`).
     3. *Barcode Scanner & Peripherals* (`Hardware Audio Feedback`, `Auto-Submit Scan`, and `[|||| Auto-Backfill Barcodes]`).
     4. *Library Folder Storage & Data Maintenance* (`CURRENT LOCATION`, `FILE SIZE`, `LAST SAVED`, `Action 1: Clear Demo Data`, and `Action 2: Reset App / Clear All Data`).

================================================================================
PART 8: 100% OFFLINE BUNDLE & ANTIGRAVITY DESKTOP `.exe` READINESS (`WebView2` / `Electron`)
================================================================================
1. **Zero External CDN Dependencies (`index.html` & `package.json`)**:
   - Remove any external `<script src="https://cdn...">`, `<link href="https://fonts.googleapis.com/...">`, or `<script type="importmap">` pointing to external CDNs so the app works 100% offline.
   - Bundle `react`, `react-dom`, `lucide-react`, `xlsx`, and `tailwindcss` locally in `package.json` and attach `(window as any).XLSX = XLSX;`.
   - Configure `vite.config.ts` with `base: './'` and `build: { outDir: 'dist', assetsDir: 'assets', emptyOutDir: true, sourcemap: false, chunkSizeWarningLimit: 2500 }`.
2. **Native Desktop Bridge (`src/services/desktopHostBridge.ts`)**:
   - Support window controls (`minimize`, `maximize`, `close`) across both **C# .NET 8 WPF + WebView2** (`window.chrome?.webview?.postMessage({ type: 'WINDOW_CONTROL', action })`) and **Electron** (`window.ulmLibraryApi`), plus production keyboard guards (`F5`, `Ctrl+R`, `F12`).
```

## Section 2 — Companion Antigravity Prompt (For Compiling `ULMLibrary.exe`, `ULMLibrary-Setup.exe` & `Uninstall.exe`)

After Google AI Studio applies Section 1 and you click **Download ZIP**, extract the folder, place `image_0.png` in the project root and `public/image_0.png`, open the folder in **Antigravity**, and paste:

```markdown
Convert this web project into a standalone, 100% offline Windows desktop application (`.exe`) for the **University of Lakki Marwat — Central Campus Library (`ULMLibrary`)** targeting Windows 10/11 x64 with zero external prerequisites:

1. **Unified ULM 2017 Crest Identity (`image_0.png` → `app.ico`)**:
   - Convert `image_0.png` into a multi-size Windows icon (`app.ico`: 16x16, 32x32, 48x48, 64x64, 128x128, 256x256) and embed it into `ULMLibrary.exe`, `ULMLibrary-Setup.exe`, `Uninstall.exe`, desktop/start-menu shortcuts, and the window taskbar.
2. **Offline Frontend Build & Virtual Host Mapping (`https://app.local/`)**:
   - Run `npm run build` and bundle `dist/` inside a C# .NET 8 (`net8.0-windows`) WPF + WebView2 host (`desktop-host/ULMLibrary.Host.csproj`).
   - Map `https://app.local/` to the local asset folder via `SetVirtualHostNameToFolderMapping(..., CoreWebView2HostResourceAccessKind.Allow)` and set `CoreWebView2Environment` user data folder to `%LOCALAPPDATA%\ULMLibrary\UserData` so `IndexedDB` (`ulm_library_idb_v1`) and `localStorage` (`ulm_workstation_setup_completed_v1`) persist permanently across sessions.
   - Handle `WebMessageReceived` for `{ type: "WINDOW_CONTROL", action: "minimize" | "maximize" | "close" }` from the React title bar.
3. **Single-File Self-Contained Compilation (`dist-desktop/`)**:
   - Publish with `SelfContained=true`, `RuntimeIdentifier=win-x64`, `PublishSingleFile=true`, `IncludeNativeLibrariesForSelfExtract=true`, and `EnableCompressionInSingleFile=true` to produce:
     * `dist-desktop/ULMLibrary.exe` (Portable Edition)
     * `dist-desktop/ULMLibrary-Setup.exe` (Per-user Windows Installer installing to `%LOCALAPPDATA%\Programs\ULMLibrary`, creating Desktop & Start Menu shortcuts, and registering in Windows Installed Apps)
     * `dist-desktop/Uninstall.exe` (Bulletproof Uninstaller that terminates running `ULMLibrary.exe` / `msedgewebview2.exe` processes, removes shortcuts and registry keys, optionally preserves or removes `%LOCALAPPDATA%\ULMLibrary\UserData`, and cleanly self-deletes).
```
