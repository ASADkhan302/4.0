# ULM Central Campus Library — Complete Atom-by-Atom Engineering & UI Blueprint for OpenAI Codex

> **Target Application:** University of Lakki Marwat — Central Campus Library Management System (`university-of-lakki-marwat-lms`)  
> **Runtime Targets:** 100% Offline Desktop App (C# .NET WPF + Edge WebView2 mapped to `https://ulm-library.local/`, Electron preload bridge compatible) AND Modern Browser SPA (Vite + React 19 + IndexedDB + File System Access API).  
> **Architecture Guarantee:** Zero external CDN dependencies, zero cloud/auth walls, deterministic offline storage up to 100,000+ books via IndexedDB + optional SQLite (`sql.js` WASM / native IPC), live auto-synced 4-sheet Master Excel (`.xlsx`), and Frosted Crystal Liquid-Glass dual-theme UI (`Dark Glass` & `White Glass`).

---

## SECTION 1: COMPLETE TECH STACK, CONFIGURATION & FILE TREE

### 1.1 Exact `package.json` Dependencies & Scripts

```json
{
  "name": "university-of-lakki-marwat-lms",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite --port=3000 --host=0.0.0.0",
    "build": "vite build",
    "preview": "vite preview --port=3000 --host=0.0.0.0",
    "clean": "rm -rf dist",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@fontsource/noto-naskh-arabic": "^5.2.9",
    "@fontsource/noto-nastaliq-urdu": "^5.2.8",
    "@fontsource/playfair-display": "^5.2.8",
    "@radix-ui/react-avatar": "^1.1.11",
    "@radix-ui/react-dropdown-menu": "^2.1.16",
    "@radix-ui/react-select": "^2.2.6",
    "@radix-ui/react-separator": "^1.1.8",
    "@radix-ui/react-slot": "^1.2.4",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "exceljs": "^4.4.0",
    "fflate": "^0.8.3",
    "html2canvas": "^1.4.1",
    "jspdf": "^4.2.1",
    "lucide-react": "^0.546.0",
    "motion": "^12.23.24",
    "react": "^19.0.1",
    "react-dom": "^19.0.1",
    "recharts": "^3.10.1",
    "sql.js": "^1.14.2",
    "tailwind-merge": "^3.5.0",
    "xlsx": "^0.18.5"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.3.3",
    "@types/node": "^22.14.0",
    "@types/react": "^19.0.1",
    "@types/react-dom": "^19.0.1",
    "@types/sql.js": "^1.4.9",
    "@vitejs/plugin-react": "^6.0.1",
    "autoprefixer": "^10.4.21",
    "tailwindcss": "^4.3.3",
    "tsx": "^4.21.0",
    "typescript": "^7.0.2",
    "vite": "^8.3.0"
  }
}
```

### 1.2 Exact `vite.config.ts`

- Uses `base: './'` so built `dist/` loads cleanly inside Edge WebView2 (`https://ulm-library.local/`), Electron `file://`, and local HTTP servers.
- Uses `@vitejs/plugin-react` and `@tailwindcss/vite` (Tailwind CSS v4 native Vite plugin).
- Alias `'@': path.resolve(__dirname, '.')`.
- `build.outDir: 'dist'`, `assetsDir: 'assets'`, `target: 'es2020'`, `chunkSizeWarningLimit: 2500`.
- `server`: `{ port: 3000, host: '0.0.0.0', hmr: process.env.DISABLE_HMR !== 'true' }`.

### 1.3 Exact `tsconfig.json`

- `target: "ES2022"`, `lib: ["ES2022", "DOM", "DOM.Iterable"]`, `module: "ESNext"`, `moduleResolution: "bundler"`, `jsx: "react-jsx"`.
- `isolatedModules: true`, `moduleDetection: "force"`, `allowJs: true`, `allowImportingTsExtensions: true`, `noEmit: true`, `skipLibCheck: true`.
- `paths: { "@/*": ["./*"] }`, `types: ["node"]`.

### 1.4 Exact `index.html`

- Contains **zero external CDN links** (no Google Fonts `<link>`, no unpkg scripts, no importmap scripts).
- Sets `<meta charset="UTF-8" />`, `<meta name="viewport" content="width=device-width, initial-scale=1.0" />`.
- Sets `<title>University of Lakki Marwat — Central Campus Library</title>`, `<meta name="description">`, `og:title`, `og:description`.
- Inline `<script>` inside `<head>` before React mounts:
  1. Reads `localStorage.getItem('ulm_theme_config_v1')` (defaults to `mode: 'dark'`, `whiteTone: 'pearl'`).
  2. Applies `dark` class to `document.documentElement` when `mode === 'dark'` (removes when `'white'`), and sets `data-theme` and `data-white-tone` attributes synchronously to prevent white-flash on dark boot.
  3. Reads `localStorage.getItem('ulm_resolution_config_v1')` and applies `--ulm-ui-scale` CSS custom property immediately.
- Mounts `<div id="root"></div>` and loads `<script type="module" src="/src/main.tsx"></script>`.

### 1.5 Exact `src/main.tsx` Entry Point

- Imports bundled offline fonts (`@fontsource/playfair-display/600.css`, `700.css`, `800.css`, `@fontsource/noto-nastaliq-urdu`, `@fontsource/noto-naskh-arabic`).
- Imports `./index.css`.
- Calls `createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)`.

### 1.6 Complete `src/` File Tree & Single-Line Responsibility Map

#### Root & Entry
- `src/main.tsx` — Boots React 19 root, loads offline `@fontsource` bundles and Tailwind v4 `index.css`.
- `src/App.tsx` — Master shell orchestrating navigation tabs, data state hydration, keyboard shortcuts, global custom event bus, splash screen, toast manager, ambient glass orbs, watermark, and all 14 portaled application modals.
- `src/index.css` — Tailwind CSS v4 (`@import "tailwindcss";` + `@custom-variant dark (&:where(.dark, .dark *));`), theme CSS variables, 3 white surface tones, liquid-glass presets, ambient orb gradients, View Transition circular clip-path rules, toast/screen transitions, and `@media print` isolation rules.

#### Brand Assets & Constants
- `src/assets/brand/crestData.ts` — Embedded fallback Data URI for the official ULM 2017 Crest.
- `src/assets/images/index.ts` — Barrel exports for local bundled book covers and crest PNGs.
- `src/assets/ulmCrest.ts` — Re-exports bundled crest assets (`ulm-crest.png`, `ulm_crest_logo_4x.png`, `ulm_university_crest.png`, 6%-opacity watermark PNGs).
- `src/constants/branding.ts` — Institutional default strings (University of Lakki Marwat, Central Campus Library, address, contact email/phone, code prefixes).
- `src/constants/ulmCrest.ts` — `ULM_CREST_URL` resolver and `handleCrestFallback` `onError` handler.
- `src/constants/ulmOfficialAssets.ts` — `ULM_OFFICIAL_CREST_SRC` + `syncAppDesktopAndFaviconIcon(src)` dynamic `<link rel="icon">` updater.
- `src/constants/ulmOfficialCrest.ts` — `ULM_OFFICIAL_CREST_DATA_URI` high-res offline Data URI for PDF/Canvas embedding without CORS taint.

#### TypeScript Contracts
- `src/types/library.ts` — All domain interfaces (`Book`, `Borrower`, `Transaction`, `Almari`, `BookGroup`, `AlmariGroup`, `AlmariShelf`, `BookLocationHistory`, `HistoryEntry`, `SystemSettings`, `StorageLocationConfig`, `ImportJob`, `NavigationTab`, `LibraryViewMode`, etc.).
- `src/types/desktop.d.ts` — Global `window.desktopAPI`, `window.chrome.webview`, `window.electronAPI`, and `window.ulmLibraryApi` TypeScript declarations for WebView2 & Electron hosts.
- `src/types/assets.d.ts` — Module declarations for `*.png`, `*.jpg`, `*.svg`, `*.wasm` imports.

#### Hooks & Utilities
- `src/hooks/usePreBakedWatermark.ts` — Renders any crest image once onto a `320×320` offscreen canvas at `0.065` alpha (`6.5%`) and caches the resulting PNG Data URI so CR80 ID cards print razor-sharp transparent watermarks.
- `src/lib/utils.ts` — `cn(...inputs)` class-merging utility combining `clsx` and `tailwind-merge`.
- `src/lib/buttonAnimations.ts` — Micro-interaction spring helpers (`pop`, `wave`, `hop`, `spin`) for sidebar & toolbar icons.
- `src/utils/almariSortUtils.ts` — Deterministic sorting of cupboards (`A-01`, `A-02` natural numeric order) and shelf spines (accession numeric / author / title).
- `src/utils/code128.ts` — Pure TypeScript Code-128B encoder returning exact bar-width sequences & checksums for deterministic SVG/Canvas/jsPDF vector barcode rendering (zero external barcode library required).
- `src/utils/contrastChecker.ts` — WCAG contrast ratio helper for dynamic book group badge pills.
- `src/utils/contrastChecker.empty.ts` — No-op stub for production tree-shaking.
- `src/utils/csvWriter.ts` — RFC-4180 UTF-8 BOM CSV serializer & downloadable blob helper supporting Urdu/Arabic script in Excel.
- `src/utils/dateUtils.ts` — `getTodayIso()`, `addDaysIso()`, overdue day calculators, and Pakistani `DD MMM YYYY` formatters.
- `src/utils/heavyTaskRunner.tsx` — Imperative global store (`startHeavyTask`, `updateHeavyTaskProgress`, `finishHeavyTask`, `runHeavyLibraryTask`) + `<GlobalHeavyTaskOverlay />` full-viewport shader modal.
- `src/utils/themeTransition.ts` — `triggerCircularThemeTransition()` (View Transitions API radial wave), `useInstitutionalIdentity()` hook, and `InstitutionalIdentity` persistence (`ulm_institutional_identity_v1`).
- `src/utils/urduUtils.ts` — `isArabicOrUrduScript()`, `sanitizeBidiOverrides()`, `computeSortKey()`, and `computeSearchText()` bilingual English/Urdu/Romanized search normalization.

#### Services (Storage, Engines, Printing, Desktop IPC)
- `src/services/storage.ts` — Authoritative `LibraryStorage` facade, `STORAGE_KEYS`, `reconcileBooksWithLoans()`, `hardDeleteBooksCascade()`, `loadAllBooksFromDb()`, `saveBooks()`, `saveBooksAsync()`, borrowers/transactions/history/settings CRUD, and custom event broadcasters.
- `src/services/indexedDbStorage.ts` — Async IndexedDB key-value engine (`ulm_central_library_idb_v1`, store `kv_store`) handling 100,000+ books and persisting `FileSystemDirectoryHandle` across sessions.
- `src/services/accessionSeriesEngine.ts` — `AccessionSeriesEngine` (continuous sequential accession numbers + unique 13-digit `ULM0000000001` Code-128 barcodes, never reusing withdrawn accessions), `generateUniqueBarcodeCopies()`, and `importBooksInChunks()` (250-row non-blocking async chunked importer for 50,000+ books).
- `src/services/almariService.ts` — Full CRUD for `BookGroup`, `Almari`, `AlmariGroup`, `AlmariShelf`, `BookLocationHistory`, `ulm_almari_placements_master_v3`, zero-reseed guard (`ulm_factory_reset_empty_v1`), `clearAllToZero()`, `loadDefaultGroups()`, and soft-delete migration.
- `src/services/masterExcelSync.ts` — Live auto-synced 4-sheet Master Excel (`ULM_Master_Library_Register.xlsx`) generator using `exceljs`/`xlsx` with sheets: `Catalog (Books)`, `Members (Borrowers)`, `Circulation (Loans)`, `Almaris & Shelves`, writing directly via `desktopBridge` or `FileSystemDirectoryHandle` (or queuing fallback download).
- `src/services/printAndPdfEngine.ts` — Unified print & vector PDF engine: isolated white-background print window (`printHtmlIsolated`), Avery L7160 / L7651 / Plain A4 Grid / Thermal Roll label layout calculations in exact millimeters, CR80 PVC ID card PDF/print sheets, and A4 Audit Report PDF export.
- `src/services/pdfGeneratorService.ts` — High-precision `jsPDF` vector drawing routines for crisp 300-DPI Code-128 barcodes, book spine/cover labels, CR80 Front+Back cards, and executive library reports.
- `src/services/desktopBridge.ts` — Unified desktop runtime adapter detecting WebView2 (`window.chrome.webview` / `window.desktopAPI`) and Electron (`window.electronAPI`), providing `browseDirectoryNative()`, `writeBinaryFileNative()`, `readBinaryFileNative()`, `controlWindow()`, and `isDesktopRuntime()`.
- `src/services/desktopHostBridge.ts` — Low-level message-channel promise bridge for C# WPF WebView2 `postMessage` JSON-RPC envelopes.
- `src/services/displayResolutionManager.ts` — Manages `WHITE_TONES` (`pearl`, `soft-alabaster`, `dove-mist`), `GLASS_PRESETS` (`crystal-air`, `frosted`, `obsidian-deep`), UI zoom scaling (`Auto-Fit`, `30%`, `45%`, `75%`, `100%`, `125%`, plus custom slider), and dispatches `ulm-theme-changed` / `ulm-resolution-changed`.
- `src/services/resetToZeroService.ts` — Nuclear True-Zero Factory Reset wiping React state, SQLite WASM, `window.ulmLibraryApi`, primary IndexedDB (`ulm_central_library_idb_v1`), legacy IndexedDB (`ulm_library_idb_v1`), `AlmariService` cupboards & groups, and all 30+ `localStorage` keys while setting `ulm_factory_reset_empty_v1 = 'true'` and `ulm_setup_completed_v1 = 'false'`.
- `src/services/libraryStorageAndMigration.ts` — First-launch setup gate checker (`isWorkstationAlreadyInstalledAndConfigured`, `markWorkstationSetupCompleted`), legacy localStorage-to-IndexedDB migrator, `getTrueDatabaseBookCount()`, `computeNextSerial()`, `repairAllBookSeriesAndBarcodes()`, and `resetEntireDatabaseToZero()`.
- `src/services/barcodeService.ts` — 13-digit sequential barcode generator (`ULM` + 10-digit zero-padded serial), Code-128 validation, and scan-safety bar module-width evaluator (`evaluateScanSafety`).
- `src/services/bookSheetService.ts` — Linked Book Entry Sheet queue, withdrawn accession ledger (`ulm_withdrawn_accessions_v1`), and sequential accession allocator.
- `src/services/excel.ts` — Workbook reader/writer helpers for `.xlsx`/`.csv` import & 5-card spreadsheet exports (Catalog, Borrowers, Active Loans, Overdue Report, Almari Placement Register).
- `src/services/smartBookImporter.ts` — Intelligent 40+ column header fuzzy-mapper mapping arbitrary Excel columns (Title, Author, ISBN, Acc #, Dewey, Publisher, Price, Cupboard, Shelf, Copies, Urdu Title, etc.) to `Book` fields.
- `src/services/importerEngine.ts` & `src/services/stagedImportEngine.ts` — Preview, deduplication, validation error reporting, and staged batch commit pipeline for Excel/CSV sheets.
- `src/services/usbBackupService.ts` — Offline `.ulmpack` / `.zip` (via `fflate`) 3-step backup & PC-to-PC transfer packager bundling JSON state + SQLite snapshot + cover images + checksum manifest.
- `src/services/libraryFolderService.ts` & `src/services/libraryDataFilesService.ts` — Manages folder-bound JSON/Excel data files and computes external diff summaries (`DataFilesDiffModal`).
- `src/services/sqliteDatabaseService.ts` & `src/services/sqlWasmBase64.ts` — Offline embedded SQLite (`sql.js`) WASM engine with WAL-like atomic export to `Library.ulmlib` and inline base64 WASM fallback.
- `src/services/realStorageService.ts`, `src/services/storageEngine.ts`, `src/services/db.ts` — Storage abstraction adapters syncing between RAM cache, IndexedDB, SQLite WASM, and Desktop IPC.
- `src/services/audio.ts` — Web Audio API synthesized scanner chimes (`playSuccessBarcodeBeep`, `playErrorBeep`, `playClickSound`) with zero external MP3 assets.
- `src/services/sharedCountService.ts` — Authoritative live KPI counter reconciler ensuring sidebar badges, header badges, catalog KPIs, and reports always show identical counts.
- `src/services/coreSystemDocService.ts` — Runtime diagnostic snapshot generator for Reports & Audits 8-point integrity check.
- `src/services/initialData.ts` & `src/services/initialAlmariData.ts` — Optional default ULM Book Groups & sample presets (strictly gated behind `ulm_factory_reset_empty_v1 !== 'true'` and explicit user action — never auto-seeded on empty reset).

#### Top-Level Views & Chrome
- `src/components/WindowsTitleBar.tsx` — 32px frameless desktop window bar (auto-hidden when `isDesktopRuntime()` returns true) with Minimize/Maximize/Close controls.
- `src/components/PrimaryHeader.tsx` — Persistent frosted-glass top header with ULM Crest, dynamic University & Library titles, Theme circular-wave switch, UI Scale badge, quick actions (`+ Add Book`, `Master Excel`, `Export`, `Backup`, `ID Card`), and Global Quick Search (`⌘K`).
- `src/components/Sidebar.tsx` & `src/components/LmsSidebar.tsx` — Collapsible 240px / 72px frosted-glass navigation rail with `LiquidPillOverlay` vertical waterline glide, 3 grouped sections, live count badges, keyboard shortcut hints, bottom-pinned `System Settings` + `Collapse Sidebar`, and `⌘K` Command Search modal.
- `src/components/AppOpeningSplash.tsx` — 2.2-second portrait institutional boot ceremony featuring concentric rotating golden crest rings, ULM 2017 Crest, serif typography, and smooth dissolve into workspace.
- `src/components/BooksCatalogView.tsx` — Primary catalog screen: 4 KPI cards, filter/search bar with `CatalogGlassDropdown`, 4-mode view switcher (`grid | list | almaris | analytics`), multi-select checkboxes + floating bulk action bar (`Print Labels`, `Bulk Assign Almari`, `Delete Selected`), Grid cards & paginated virtual-friendly List table.
- `src/components/AlmariView.tsx` & `src/components/catalog/AlmariView.tsx` & `src/components/catalog/AlmariErrorBoundary.tsx` — Interactive visual Almari cupboard & shelf manager with horizontal scroll rail (`Prev`/`Next` `±320px`), 4 Drag-and-Drop placement flows, jitter-free spine hover popouts, Unassigned Books staging dock, and 4 portaled modals.
- `src/components/BarcodeScannerView.tsx` — Dedicated USB/HID Barcode Laser Station supporting unified Book/Member auto-detection, implicit Issue/Return pairing, chained rapid scanning, 4-layer atomic Almari shelf assignment with sibling-copy toggle, Quick Create Cupboard, and Post-Return Reshelving prompt.
- `src/components/CirculationDeskView.tsx` & `src/components/circulation/CirculationKpiCard.tsx` — Issue/Return Desk with inline Issue Drawer, 4 interactive KPI filter cards, Grid/List switcher with `LiquidPillOverlay`, 4px semantic status bar, `StatusPill`, and `idle -> loading -> success` Return Copy state machine.
- `src/components/BorrowersView.tsx` & `src/components/cards/MemberCard.tsx` — Member ID Cards & Borrowers directory with 6 header actions, 4 `CountUp` KPI cards, Role/Status/Dept filters, Grid/Table switcher, watermarked member cards, CSV export/template, and one-click CR80 Card Studio launcher.
- `src/components/library/UlmSmartIdCard.tsx` & `src/components/UlmSmartIdCard.tsx` — Pixel-exact CR80 (`428×276px` / `85.60×53.98mm`) bilingual PVC Member ID Card component (Front & Back) with pre-baked 6.5% crest watermark, deterministic Code-128 SVG barcode, and deterministic 29×29 FNV-1a verification QR SVG.
- `src/components/ReportsView.tsx` & `src/components/library/CatalogVisualAnalytics.tsx` & `src/components/catalog/CatalogChartsView.tsx` — Executive Reports & Audits screen: Period dropdown, CSV export menu, 5 KPI cards + `SegmentedTickBar`, Recharts `AreaChart` & Discipline/Language `PieChart` Donut, 8-point real storage integrity audit, Overdue Action List, vector/canvas PDF export, and isolated white A4 printing.
- `src/components/ExcelCenterView.tsx` — 3-row Bento Excel & PC Migration Center: Row 1 (Book Entry Sheet Import + 3-Step Offline `.ulmpack` ZIP Pipeline), Row 2 (5-Card Spreadsheet Export Grid), Row 3 (Collapsible Master CSV/JSON Migration & Developer Stress/Reset Tools).
- `src/components/SettingsView.tsx` — 3-tab Bento System Settings (`general | groups | almaris`): Card 1 Appearance & ULM Crest, Card 2 Institutional Identity & Live Header Preview, Card 3 Barcode Scanner & Peripherals, Card 4 Library Folder Storage & Data Maintenance (with full-width horizontal `RESET APP / CLEAR ALL DATA` danger bar), and Row 3 `GroupsSettingsTab` + `AlmarisSettingsTab`.
- `src/components/settings/AppearanceSettingsTab.tsx` — Circular-wave Dark/White Glass toggle, 3 White Surface Tone cards, and 6 Display Scaling presets + continuous slider.
- `src/components/settings/GroupsSettingsTab.tsx` — Book Groups CRUD table with reorder arrows, inline edit, color swatches, bilingual English/Urdu labels, auto-match rules, architectural status micro-tags, and true-zero empty state (`+ Add New Group` & `Load Default Groups`).
- `src/components/settings/AlmarisSettingsTab.tsx` — Physical Almaris CRUD table with collapsible Unassigned Book Groups bar, capacity utilization bars, lock-name toggle, multi-group checkboxes, soft-delete reassignment modal, and true-zero empty state.

#### Portaled Modals (`src/components/modals/`)
- `WorkstationSetupModal.tsx` — Authoritative First-Launch & Post-Reset Workstation Setup Gate: editable `DESIGNATED LIBRARY REPOSITORY PATH` + synchronous `Browse Folder` + 3 initialization cards (`Start as a New Library`, `Import My Existing Excel Sheet`, `Restore Library Package (.ulmpack)`).
- `AddEditBookModal.tsx` — Full 26-field Accession Register modal supporting New Book, Edit Book, Duplicate Copy mode, ISBN-10/13 advisory checksum, `Copy Previous` ditto, 500×700 JPEG cover compression, and `Save & Next` rapid entry.
- `BookDetailsModal.tsx` — Read-only Book Specification Inspector with cover preview, Code-128 barcode, Almari location badge, loan history, and direct Edit/Issue/Return/Print/Delete actions.
- `DeleteBookConfirmModal.tsx` — Single & Multi-Select Book Deletion modal offering `Archive & Remove` vs `Permanent Purge`, active-loan force-close warning, and direct invocation of `hardDeleteBooksCascade`.
- `AddEditBorrowerModal.tsx` — 12-column Member Registration modal with Student/Faculty/Staff selector, ULM registration regex auto-parser (`ULM-FA23-BCS-042`), Pakistani phone formatter (`03XX-XXXXXXX`), `PhotoCropModal`, draft auto-save (`ulm_borrower_form_draft_v3`), and live CR80 card preview.
- `BorrowerDetailsModal.tsx` — Member Profile & Loan Ledger modal with status toggle (`active`/`suspended`), active loans quick-return, and direct Issue trigger.
- `DeleteBorrowerConfirmModal.tsx` — Safe member deletion guard blocking or force-closing active loans.
- `MemberCardPrintModal.tsx` — CR80 PVC ID Card Studio modal (Both/Front/Back view, 4 sample presets, 3 sheet layouts `cr80_single | a4_sheet_10 | a4_duplex`, 12 live editable fields, watermark opacity slider `2–15%`, `Save as PDF`, isolated white `Print CR80 Card`).
- `BatchLabelPrintModal.tsx` & `BarcodePrintModal.tsx` — Scoped Barcode & Spine Label Studio with 4 Print Scope tabs (`Selected | Range (Acc #) | Recent Batch | All Catalog`), 5 label sizes, 4 sheet templates, Start Position `#`, Cut Guidelines, Thin Spine `<80pp` toggle, live scan-safety gauge, paginated preview, vector PDF & isolated print.
- `IssueBookFlowModal.tsx` — Unified 3-step Circulation Flow (`Book -> Member -> Due Date` or `Member -> Book -> Due Date`) with inline new-member registration shortcut.
- `ExcelImportModal.tsx`, `BookImportModal.tsx`, `ImportModal.tsx`, `BorrowerCsvImportModal.tsx` — Drag-and-drop Excel/CSV import wizards with column mapping preview, row validation, 250-row chunked progress overlay, and post-import batch barcode print shortcut.
- `BulkAssignModal.tsx` & `AutoArrangeModal.tsx` — Bulk Almari/Shelf assignment and discipline-based auto-arrangement dialogs.
- `AddEditAlmariModal.tsx` & `DeleteAlmariModal.tsx` — Cupboard creation/editing and safe delete with book reassignment (`move` to another Almari or `unassign`).
- `StorageLocationModal.tsx`, `StorageSetupModal.tsx`, `WelcomeLibraryModal.tsx`, `ResetToZeroModal.tsx`, `DataFilesDiffModal.tsx` — Repository folder path picker, nuclear zero-reset confirmation (`TYPE RESET`), and external data-file diff resolver.

#### Shared UI & Glass Primitives (`src/components/ui/`, `src/components/shared/`, `src/components/decorative/`)
- `src/components/ui/liquid-pill-physics.tsx` — `LiquidPillOverlay` spring-physics sliding indicator (horizontal & vertical waterline glide with specular top edge).
- `src/components/ui/liquid-weather-glass.tsx` — `LiquidGlassCard` multi-layer frosted glass container (blur bend, specular rim, curved inner edge highlight, optional SVG turbulence distortion).
- `src/components/ui/background-gradient-animation.tsx` — GPU-composited multi-orb animated radial gradient canvas used by `GlobalHeavyTaskOverlay` for heavy async tasks.
- `src/components/ui/count-up.tsx` — Smooth tabular numeral count-up animation for KPI cards.
- `src/components/ui/CustomSelect.tsx`, `button.tsx`, `button-colorful.tsx`, `badge.tsx`, `card.tsx`, `chart.tsx`, `avatar.tsx`, `dropdown-menu.tsx`, `select.tsx`, `separator.tsx`, `skeleton.tsx`, `item.tsx` — Radix-backed accessible UI primitives.
- `src/components/shared/CrispCode128BarcodeSvg.tsx` — Pure SVG Code-128B renderer with quiet zones and optional human-readable text.
- `src/components/shared/StatusPill.tsx` — Architectural status micro-tags (`AVAILABLE`, `ISSUED`, `OVERDUE`, `RETURNED`, `ACTIVE`, `SUSPENDED`) using `rounded-md` geometry with crisp 5×5px glowing status squares.
- `src/components/shared/PhotoCropModal.tsx` — Interactive circular/portrait `86×106` ratio photo cropper & JPEG compressor for Member ID avatars.
- `src/components/shared/DataTable.tsx`, `PageHeaderCard.tsx`, `SearchFilterBar.tsx`, `SharedCards.tsx`, `TabCards.tsx` — Reusable layout blocks.
- `src/components/decorative/BookSpinesLoader.tsx`, `BootSpinesDeco.tsx`, `EmptyStateBooksDeco.tsx`, `StartScreenHeroDeco.tsx`, `ToastSuccessDeco.tsx` — Pure SVG lightweight decorative illustrations (zero external image fetches).
- `src/components/StateGalleryView.tsx`, `SystemLimitsAuditPanel.tsx`, `ui/ButtonAuditPanel.tsx`, `ui/dashboard-4.tsx` (+ `dashboard-4-utils/*`), `ui/dashboard-sidebar.tsx`, `ui/demo.tsx`, `ui/library-charts-kpi.tsx` — Internal visual QA & analytics helper modules.

---

## SECTION 2: EXACT VISUAL DESIGN SYSTEM, TYPOGRAPHY & ANIMATION TOKENS

### 2.1 Typography Scale & Font Families (100% Offline)

| Role | Font Family | Weights | Usage |
| :--- | :--- | :--- | :--- |
| **Institutional Serif** | `'Playfair Display', Georgia, serif` | `600, 700, 800` | University header, Splash title, Card hero titles, CR80 card title |
| **UI Display Sans** | `'Plus Jakarta Sans', 'Inter', system-ui, sans-serif` | `600, 700, 800` | Section headers, modal titles, buttons, sidebar labels |
| **Body Sans** | `'Inter', system-ui, -apple-system, sans-serif` | `400, 500, 600` | Descriptions, table cells, form labels, helper text |
| **Tabular Numerals** | `'Space Grotesk', 'Plus Jakarta Sans', sans-serif` (`tabular-nums`) | `700, 800` | KPI metrics, shelf capacities, chart counters |
| **Monospace Technical** | `'JetBrains Mono', ui-monospace, monospace` | `500, 600, 700` | Accession `#`, 13-digit Barcodes, Dewey Call `#`, File Paths, Shortcuts (`⌘1`), Micro-Tags |
| **Urdu / Arabic RTL** | `'Noto Nastaliq Urdu', 'Noto Naskh Arabic', serif` (`.font-urdu`, `dir="auto"`) | `400, 700` | Urdu book titles, authors, bilingual Almari/Group names (`الماریاں`, `گروپس`) |

### 2.2 Dual-Theme Color Architecture & 3 White Surface Tones

Tailwind CSS v4 dark variant declaration in `src/index.css`:
```css
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));
```

#### Dark Glass Mode (Default — `html.dark`)
- **Canvas Background:** `#0A0614` -> radial obsidian-amethyst depth `#120B22` to `#090514`
- **Primary Text:** `#F8FAFC` (`text-white`), Secondary: `#CBD5E1` (`text-slate-300`), Muted: `#94A3B8` (`text-slate-400`)
- **Brand Royal Amethyst:** `#541A72` / `#7C3AED` / `#9333EA`
- **Brand 24K Institutional Gold:** `#BC881B` / `#D97706` / `#F59E0B` / `#FFD147`
- **Semantic Accents:** Emerald `#10B981` (Available / Synced / Active), Amber `#F59E0B` (Due Soon / Warning / Gold CTA), Rose `#EF4444` (Overdue / Destructive), Cyan `#06B6D4` (Info / Barcode), Purple `#8B5CF6` (Almari / Backup)
- **Glass Card Fill:** `bg-gradient-to-br from-white/[0.075] via-white/[0.03] to-white/[0.015]`
- **Glass Border:** `border border-white/[0.14]`
- **Glass Inner Rim & Elevation:** `shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.22),0_8px_24px_rgba(0,0,0,0.22)]`

#### White Glass Mode (`html:not(.dark)`) — 3 Calibrated Surface Tones (`data-white-tone`)
1. **`pearl` (Default Warm Ivory):**
   - Primary Canvas: `#F0EDE6`, Secondary Elevated: `#E5E1D8`
2. **`soft-alabaster` (Parchment Stone):**
   - Primary Canvas: `#EAE6DF`, Secondary Elevated: `#DFDBD2`
3. **`dove-mist` (Cool Architectural Slate):**
   - Primary Canvas: `#E5EAF0`, Secondary Elevated: `#DAE1EA`
- **White Glass Card Fill:** `bg-gradient-to-br from-white/80 via-white/65 to-white/50`
- **White Glass Border:** `border border-slate-200/85`
- **White Glass Inner Rim & Elevation:** `shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.85),0_8px_24px_rgba(15,23,42,0.05)]`
- **Primary Text:** `#0F172A` (`text-slate-900`), Secondary: `#475569` (`text-slate-600`)

#### Glass Intensity Presets (`GLASS_PRESETS` in `displayResolutionManager.ts`)
- `crystal-air`: `{ tint: 34, blur: 28 }`
- `frosted`: `{ tint: 64, blur: 16 }`
- `obsidian-deep`: `{ tint: 78, blur: 20 }`

#### Ambient Refractive Background Orbs (`#ulm-liquid-orbs` in `App.tsx`)
Five non-interactive `pointer-events-none fixed inset-0 z-0` radial-blurred orbs behind the frosted glass workspace:
1. Header Gold Junction Glow: `w-[460px] h-[220px] bg-[#FFD147]/20 dark:bg-[#FFD147]/12 blur-3xl -top-20 left-8`
2. Header Amethyst Junction Glow: `w-[520px] h-[240px] bg-[#541A72]/15 dark:bg-[#541A72]/28 blur-3xl -top-24 right-12`
3. ULM Royal Amethyst Orb: `w-[580px] h-[580px] -top-48 -left-48 opacity-80` (`radial-gradient` `#541A72`)
4. ULM 24K Liquid Gold Orb: `w-[640px] h-[640px] -bottom-56 -right-56 opacity-75` (`radial-gradient` `#BC881B`)
5. Campus Sky Cyan (`520px`, `-top-32 right-1/4`), Emerald Scholar Mist (`480px`, `-bottom-36 left-1/3`), and Liquid Amber (`500px`, centered) orbs.
- Centered Official ULM 2017 Crest Watermark (`#app-bg-watermark`): `w-[380px] md:w-[460px] object-contain opacity-[0.045] dark:opacity-[0.055]`, offset `left: 15rem; top: 3.75rem`.

#### Architectural Micro-Tag & Zero-Oval-Pill Discipline
- **No mismatched `rounded-full` oval badges** on status tags, card footers, or table pills.
- All status indicators and metadata badges use architectural micro-tags:
  `inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-['JetBrains_Mono'] text-[10px] font-semibold uppercase tracking-wider border` paired with a crisp `w-[5px] h-[5px] rounded-[1px]` glowing square indicator dot.
- Standard container radii: Cards `rounded-[22px]`, Modals `rounded-[24px]`–`rounded-[26px]`, Sub-panels `rounded-2xl`, Buttons/Inputs `rounded-xl`, Icon buttons `rounded-lg`, Micro-tags `rounded-md`.

### 2.3 Verbatim Frosted Crystal Liquid-Glass Component (`LiquidGlassCard`)

Located in `src/components/ui/liquid-weather-glass.tsx`:
- Renders 4 stacked layers inside a `motion.div` with `borderRadius = '22px'`:
  1. **Base Surface:** `bg-gradient-to-br from-white/50 via-white/30 to-white/15 dark:from-white/[0.08] dark:via-white/[0.04] dark:to-white/[0.02] border border-white/60 dark:border-white/[0.16]`
  2. **Frosted Bend Layer (`z-0`):** `backdrop-blur-md/lg/xl/2xl` + `backdrop-saturate-[160%|170%|175%|180%]` (optional SVG `<feTurbulence baseFrequency="0.003 0.007" />` + `<feDisplacementMap scale="120" />`).
  3. **Specular Rim & Depth Layer (`z-10`):** Drop shadow + subtle ambient white halo (`glowStyles`: `sm = 0 10px 30px rgba(0,0,0,0.2), 0 0 18px rgba(255,255,255,0.08)`).
  4. **Curved Inner Edge Highlight (`z-20`):** `inset 1.5px 1.5px 2px 0 rgba(255,255,255,0.45), inset -1.5px -1.5px 1.5px 0 rgba(255,255,255,0.15)`.
  5. **Content (`z-30`):** Interactive children.

### 2.4 Verbatim Animation Specifications

#### A. `LiquidPillOverlay` (`src/components/ui/liquid-pill-physics.tsx`)
- Measures active target element rect via `ResizeObserver` + `getBoundingClientRect()` relative to its container ref.
- Supports `axis: 'x' | 'y'` and `variant: 'sidebar-pill' | 'segmented-pill' | 'tab-pill'`.
- Animates `x`, `y`, `width`, `height` via `motion.div` spring physics: `{ type: 'spring', stiffness: 420, damping: 32, mass: 0.75 }`.
- Renders a subtle **waterline specular top sheen** (`h-[1px] bg-gradient-to-r from-transparent via-amber-400/70 to-transparent`) and a left active indicator accent bar on `sidebar-pill` (`w-[3px] rounded-r-full bg-gradient-to-b from-amber-400 via-amber-500 to-purple-500 shadow-[0_0_10px_rgba(245,158,11,0.75)]`).

#### B. `triggerCircularThemeTransition` (`src/utils/themeTransition.ts`)
- Accepts `(triggerEl: HTMLElement | null, applyThemeFn: () => void)`.
- Computes origin `(x, y)` at the geometric center of `triggerEl` (fallback: viewport top-right `innerWidth - 40, 28`) and maximum radius `endRadius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))`.
- If `document.startViewTransition` is supported and `prefers-reduced-motion` is not enabled:
  - Runs `const transition = document.startViewTransition(() => { applyThemeFn(); })`.
  - Awaits `transition.ready` and animates `document.documentElement`:
    `clipPath: ['circle(0px at ${x}px ${y}px)', 'circle(${endRadius}px at ${x}px ${y}px)']`, `duration: 700`, `easing: 'cubic-bezier(0.4, 0, 0.2, 1)'`, `pseudoElement: '::view-transition-new(root)'`.
- CSS rules in `src/index.css` disable default crossfade on `::view-transition-old(root)` and `::view-transition-new(root)` (`animation: none; mix-blend-mode: normal;`).

#### C. `BackgroundGradientAnimation` & `GlobalHeavyTaskOverlay` (`src/components/ui/background-gradient-animation.tsx`, `src/utils/heavyTaskRunner.tsx`)
- Full-viewport `fixed inset-0 z-[99999]` animated shader backdrop with 5 CSS-keyframed drifting liquid blobs (Royal Amethyst `84, 26, 114`, Deep Violet `124, 58, 237`, Liquid Gold `245, 158, 11`, Emerald `16, 185, 129`, Cyan `6, 182, 212`) blended via `mix-blend-hard-light` + SVG gooey blur filter (`stdDeviation="10"`).
- Displays a centered frosted crystal progress card with ULM Crest, task title, live status message, processed/total numeric counter (`Space Grotesk tabular-nums`), animated percentage progress bar, and smooth unmount fade (`220ms`).
- Used automatically during initial IndexedDB hydration, 50,000+ Excel chunked imports, bulk deletion (>20 books), Master Excel builds, and True Zero Factory Reset.

#### D. `AppOpeningSplash` (`src/components/AppOpeningSplash.tsx`)
- Full-viewport `fixed inset-0 z-[10000]` dark-obsidian ceremony (`bg-[#07040F]`).
- Portrait-centered institutional emblem: outer slow-rotating dashed gold ring (`border-amber-400/30`), counter-rotating inner amethyst halo, central ULM 2017 Crest (`w-28 h-28`) with subtle drop-shadow glow.
- Staggered `Playfair Display` university title + `CENTRAL CAMPUS LIBRARY` gold tracked subtitle + live indexed book count pill (`0 Volumes` or `N Volumes Ready`) + slim gold shimmer progress bar.
- Total duration ~`2200ms` (or immediate skip on click / `Escape` / `Enter`), then fades out (`400ms`) and invokes `onComplete()`.

#### E. Screen Switch & Toast Transitions (`src/index.css`)
- Screen switch: Outgoing view fades out `120ms` (`screen-view-exit`), incoming view translates up `6px` + fades in `200ms` (`screen-view-enter`).
- Floating System Toast (`bottom-6 right-6 z-50`): Slides in from right (`200ms`), pauses countdown bar on hover (`onMouseEnter` / `onMouseLeave`), slides out right (`150ms`) after `3500ms`.


---

## SECTION 3: COMPLETE DATA MODELS & TYPESCRIPT INTERFACES

All core domain models live in `src/types/library.ts` (and `InstitutionalIdentity` in `src/utils/themeTransition.ts`). Every field below is preserved for backwards compatibility across Excel imports, `.ulmpack` backups, IndexedDB, and SQLite.

### 3.1 `Book` (26+ Accession Register Fields)

```ts
export interface Book {
  id: string;                      // Unique UUID/prefixed ID: `book-${Date.now()}-${rand}` or `book_${acc}_${idx}`
  barcode: string;                 // Unique 13-digit Code-128B: `ULM0000000001` (prefix + 10-digit serial)
  accession_no: string;            // Continuous sequential accession number: `1`, `2`, ... (never reused after withdrawal)
  isbn: string;                    // ISBN-10 or ISBN-13 (optional/advisory checksum)
  book_name: string;               // Primary title (supports English, Urdu, Arabic, Pashto)
  title?: string;                  // Mirror alias of `book_name` for SQLite/Excel compatibility
  author: string;                  // Primary author / editor
  publisher: string;               // Publisher name
  category: string;                // Subject / Discipline (e.g., "Computer Science", "Islamic Studies", "Urdu Literature")
  discipline?: string;             // Mirror alias of `category`
  edition: string;                 // e.g., "1st Edition", "7th Ed."
  description: string;             // Synopsis / remarks
  book_image_path: string;         // Compressed JPEG Data URI (max 500x700, quality 0.85) or local asset path
  row: string;                     // Row/Stack identifier (default "1")
  section: string;                 // Wing/Section (default "General")
  total_quantity: number;          // Total copies represented by this record (1..500; copy-per-barcode uses 1)
  available_quantity: number;      // Copies currently on shelf (reconciled live against active loans)
  total_copies?: number;           // Compatibility alias of `total_quantity`
  available_copies?: number;       // Compatibility alias of `available_quantity`
  copies?: number;                 // Compatibility alias of `total_quantity`
  quantity?: number;               // Compatibility alias of `total_quantity`
  language: string;                // 'English' | 'Urdu' | 'Arabic' | 'Pashto' | string
  title_roman?: string;            // Optional Romanized Urdu/Arabic title for Latin search
  author_roman?: string;           // Optional Romanized author
  title_sort?: string;             // Normalized collation sort key (`computeSortKey`)
  author_sort?: string;            // Normalized collation sort key
  search_text?: string;            // Precomputed lowercase search haystack (`computeSearchText`)
  shelf: string;                   // Human-readable shelf label (e.g., "A-01 / Shelf 2")
  group_id?: string | null;        // Foreign key to `BookGroup.id`
  almari_id?: string | null;       // Foreign key to `Almari.id`
  almari_code?: string | null;     // Cupboard code (e.g., "A-01")
  cupboard?: string | null;        // Alias of `almari_code`
  shelf_no?: number | null;        // 1-indexed shelf tier inside the Almari (1..12)
  position_index?: number;         // Horizontal order index on shelf
  placement_locked?: boolean;      // Prevents Auto-Arrange from moving this copy
  dewey_call_number: string;       // DDC Call No. (e.g., "005.133 COR")
  dewey_call_no?: string;          // Alias of `dewey_call_number`
  status?: 'AVAILABLE' | 'ISSUED' | 'LOST' | 'DAMAGED' | 'WITHDRAWN';
  price?: number;                  // Purchase price in PKR
  price_pkr?: number;              // Alias of `price`
  publication_year?: number;       // 4-digit year (e.g., 2024)
  place?: string;                  // Place of publication (default "Lakki Marwat")
  place_of_pub?: string;           // Alias of `place`
  pages?: number;                  // Total pages (used to detect thin spines < 80pp)
  total_pages?: number;            // Alias of `pages`
  binding?: string;                // 'HB' (Hardbound) | 'PB' (Paperback) | 'Spiral' | 'Leather'
  source_remarks?: string;         // Purchase / Donation / HEC Grant source & bill no.
  bill_no?: string;                // Invoice / Voucher number
  date_added: string;              // YYYY-MM-DD
  import_batch_id?: string;        // Batch UUID if imported via Excel/CSV
  imported_at?: string;            // ISO timestamp of import
  is_active: boolean;              // Active catalog flag
  created_at: string;              // "YYYY-MM-DD HH:mm:ss"
  updated_at: string;              // "YYYY-MM-DD HH:mm:ss"
}
```

### 3.2 `Borrower` (Member / Library Card Holder)

```ts
export type BorrowerRole = 'student' | 'faculty' | 'staff';
export type BorrowerStatus = 'active' | 'suspended' | 'graduated' | 'expired';

export interface Borrower {
  id: string;                      // `bor-${Date.now()}-${rand}`
  member_code: string;             // Unique library card ID / barcode payload: `ULM-FA23-BCS-042` or `ULM-FAC-001`
  full_name: string;
  father_name?: string;            // Optional guardian/father name printed on CR80 card
  role: BorrowerRole;              // 'student' | 'faculty' | 'staff'
  department: string;              // e.g., "Computer Science", "Physics", "English"
  program?: string;                // e.g., "BS Computer Science", "MPhil", "PhD"
  session?: string;                // e.g., "Fall 2023", "2023-2027"
  semester?: string;               // e.g., "6th Semester"
  roll_no?: string;                // University Roll / Registration No.
  cnic?: string;                   // 13-digit Pakistani CNIC `11201-1234567-1`
  phone: string;                   // Normalized `03XX-XXXXXXX`
  email?: string;
  address?: string;
  photo_data_uri?: string;         // Cropped 86x106 aspect portrait JPEG Data URI
  blood_group?: string;            // e.g., "B+", "O+"
  max_books_allowed: number;       // Default: Student = 3, Staff = 5, Faculty = 10
  valid_until: string;             // YYYY-MM-DD (auto-computed for students from session + 4 yrs)
  status: BorrowerStatus;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}
```

### 3.3 `Transaction` (Circulation Loan Record)

```ts
export type TransactionStatus = 'ISSUED' | 'RETURNED' | 'OVERDUE' | 'LOST';

export interface Transaction {
  id: string;                      // `tx-${Date.now()}-${rand}`
  book_id: string;                 // Foreign key -> Book.id
  book_name: string;
  barcode: string;                 // Snapshot of issued copy's 13-digit barcode
  accession_no?: string;
  borrower_id: string;             // Foreign key -> Borrower.id
  borrower_name: string;
  borrower_code?: string;
  borrower_role?: BorrowerRole;
  borrower_department?: string;
  issue_date: string;              // YYYY-MM-DD
  due_date: string;                // YYYY-MM-DD (default: +14 days student, +30 days faculty)
  return_date?: string | null;     // YYYY-MM-DD when returned
  status: TransactionStatus;
  fine_amount?: number;            // PKR overdue fine (computed at configurable daily rate)
  fine_paid?: boolean;
  issued_by?: string;              // Station/Librarian identifier
  returned_by?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
}
```

### 3.4 `Almari`, `BookGroup`, `AlmariGroup`, `AlmariShelf`, `BookLocationHistory`

```ts
export interface BookGroup {
  id: string;
  name_en: string;                 // e.g., "Computer Science"
  name_ur: string;                 // e.g., "کمپیوٹر سائنس"
  color: string;                   // Hex swatch e.g., "#3B82F6"
  sort_order: number;
  is_active: boolean;
  match_category?: string;         // Auto-suggestion rule matching Book.category
  match_language?: string;         // Auto-suggestion rule matching Book.language
}

export interface Almari {
  id: string;                      // e.g., `alm-1` or `alm-${timestamp}`
  code: string;                    // Uppercase code: `A-01`, `A-02`
  name_en: string;                 // e.g., "Computer Science & IT"
  name_ur: string;                 // e.g., "کمپیوٹر سائنس اور آئی ٹی"
  shelf_count: number;             // 1..12 (default 5)
  books_per_shelf: number;         // 5..100 (default 30)
  notes?: string;                  // Physical location / wing notes
  name_locked?: boolean;           // Prevents accidental automated rename
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AlmariGroup {
  almari_id: string;
  group_id: string;
}

export interface AlmariShelf {
  id: string;
  almari_id: string;
  shelf_no: number;                // 1-based tier
  label?: string;                  // Custom shelf label
  capacity: number;                // Override capacity for this shelf
}

export interface BookLocationHistory {
  id: string;
  book_id: string;
  barcode: string;
  from_almari_id?: string | null;
  from_shelf_no?: number | null;
  to_almari_id?: string | null;
  to_shelf_no?: number | null;
  moved_at: string;
  moved_by: string;
  reason?: string;
}
```

### 3.5 `SystemSettings`, `InstitutionalIdentity`, `StorageLocationConfig`, `HistoryEntry`, `NavigationTab`

```ts
export type NavigationTab =
  | 'catalog'
  | 'almaris'
  | 'scanner'
  | 'circulation'
  | 'borrowers'
  | 'reports'
  | 'excel'
  | 'settings';

export interface SystemSettings {
  university_name: string;         // Default: "University of Lakki Marwat"
  library_name: string;            // Default: "Central Campus Library"
  address: string;                 // Default: "Main Bannu–Mianwali Road, Lakki Marwat, Khyber Pakhtunkhwa"
  phone: string;
  email: string;                   // Default: "library@ulm.edu.pk"
  station_id: string;              // Default: "LMS-WIN-01"
  customLogoDataUri?: string;      // Uploaded custom crest PNG Data URI
  default_loan_days_student: number; // Default: 14
  default_loan_days_faculty: number; // Default: 30
  default_loan_days_staff: number;   // Default: 21
  fine_per_day_pkr: number;          // Default: 10
  barcode_prefix: string;            // Default: "ULM"
  scanner_auto_submit_ms: number;    // Default: 65ms HID burst threshold
  scanner_sound_enabled: boolean;    // Default: true
  scanner_auto_focus: boolean;       // Default: true
  auto_sync_master_excel: boolean;   // Default: true
}

export interface InstitutionalIdentity {
  universityName: string;
  libraryDepartmentName: string;
  campusAddress: string;
  contactPhone: string;
  contactEmail: string;
  customCrestUrl?: string;
}

export interface StorageLocationConfig {
  folderPath: string;              // Authoritative default: "Documents\\ULM Library Data"
  mode: 'desktop_native' | 'browser_fs_api' | 'indexeddb_fallback';
  lastSyncedAt?: string;
  masterExcelFileName: string;     // "ULM_Master_Library_Register.xlsx"
  sqliteFileName: string;          // "Library.ulmlib"
  autoBackupEnabled: boolean;
}

export interface HistoryEntry {
  id: string;
  action:
    | 'BOOK_ADDED'
    | 'BOOK_UPDATED'
    | 'BOOK_DELETED'
    | 'BOOK_ISSUED'
    | 'BOOK_RETURNED'
    | 'LOAN_FORCE_CLOSED'
    | 'BORROWER_ADDED'
    | 'BORROWER_UPDATED'
    | 'BORROWER_DELETED'
    | 'EXCEL_IMPORT'
    | 'SCHEMA_MIGRATION'
    | 'FACTORY_RESET';
  description: string;
  barcode?: string;
  book_id?: string;
  borrower_id?: string;
  user: string;
  timestamp: string;
}
```

---

## SECTION 4: STORAGE ARCHITECTURE, EVENT BUSES & CORE ALGORITHMS

### 4.1 Multi-Layer Offline Persistence Architecture

The app supports **50,000–100,000+ books** with zero browser `QuotaExceededError` or UI freeze by separating large-scale durable storage from fast synchronous mirrors:

1. **Layer 1 — Primary Async IndexedDB (`ulm_central_library_idb_v1`, Object Store: `kv_store`)**:
   - Implemented in `src/services/indexedDbStorage.ts` (`idbGet`, `idbSet`, `idbDelete`, `idbClearAll`).
   - Keys stored:
     - `'books_catalog'` — Authoritative `Book[]` array (handles 100k+ records in ~80ms).
     - `'circulation_loans'` — Authoritative `Transaction[]` array.
     - `'ulm_repo_dir_handle'` / `'repo_dir_handle'` — Persisted browser `FileSystemDirectoryHandle` across reloads.
2. **Layer 2 — Optional Desktop Native SQLite / WASM (`Library.ulmlib`)**:
   - Accessed via `window.ulmLibraryApi` (Electron/WebView2 SQLite host) or `RealStorageService.getActiveSqliteEngine()` (`sql.js` WASM).
3. **Layer 3 — Legacy IndexedDB (`ulm_library_idb_v1`)**:
   - Object stores: `books`, `loans`, `borrowers`. Kept strictly in sync for datasets `<= 1500` books and cursor-deleted on every deletion (`deleteBooksFromLegacyIdb`) so deleted books can **never** resurrect on reload.
4. **Layer 4 — `localStorage` Mirror (ONLY when `books.length <= 1500`)**:
   - When `books.length <= 1500`, `LibraryStorage.saveBooks()` mirrors JSON to `ulm_lms_books_v1`, `ulm_library_books_master_v1`, and `ulm_storage_engine_books_v1`.
   - When `books.length > 1500`, those 3 `localStorage` book keys are explicitly **removed** so IndexedDB becomes the sole source of truth and `JSON.stringify` never stalls the main thread.
5. **Layer 5 — Live Auto-Synced Master Excel (`.xlsx`) & Folder JSON AutoBackup**:
   - Triggered automatically (debounced `500ms` or immediate on delete/import) by `syncMasterExcelToDisk()`.

### 4.2 Complete Authoritative `localStorage` Key Registry

| Key | Purpose |
| :--- | :--- |
| `ulm_lms_books_v1` | Primary synchronous book mirror (`<= 1500` books) |
| `ulm_library_books_master_v1` | Master catalog mirror (`<= 1500` books) |
| `ulm_storage_engine_books_v1` | StorageEngine mirror (`<= 1500` books) |
| `ulm_archived_books_v1` | Soft-archived/withdrawn book metadata (capped at 2000) |
| `ulm_lms_borrowers_v1` / `ulm_lms_members_v1` | Registered library members (`Borrower[]`) |
| `ulm_lms_transactions_v1` / `ulm_circulation_records_v1` | Circulation loans (`Transaction[]`) |
| `ulm_lms_history_v1` | Audit trail log (`HistoryEntry[]`) |
| `ulm_lms_settings_v1` | `SystemSettings` object |
| `ulm_institutional_identity_v1` | `InstitutionalIdentity` object (synced live to Header, Splash, ID Cards, Reports) |
| `ulm_lms_storage_location_v1` | `StorageLocationConfig` object |
| `ulm_library_repo_path_v1` | Single authoritative string for `DESIGNATED LIBRARY REPOSITORY PATH` (default `'Documents\\ULM Library Data'`) |
| `ulm_almaris_registry_v2` / `ulm_lms_almaris_v1` | Physical `Almari[]` definitions |
| `ulm_book_groups_v1` / `ulm_lms_book_groups_v1` | `BookGroup[]` definitions |
| `ulm_lms_almari_groups_v1` | `AlmariGroup[]` many-to-many join links |
| `ulm_lms_almari_shelves_v1` | `AlmariShelf[]` custom shelf overrides |
| `ulm_lms_location_history_v1` | `BookLocationHistory[]` movement audit trail |
| `ulm_almari_placements_master_v3` | Keyed map `{ [bookIdOrBarcode]: { almari_id, almari_code, cupboard, shelf_no, placement_locked, updated_at } }` |
| `ulm_shelf_capacities_v3` | Per-shelf capacity overrides |
| `ulm_active_almari_id_v3` | Last selected Almari ID in `AlmariView` |
| `ulm_highest_serial_number_v1` | Highest assigned numeric accession serial |
| `ulm_catalog_total_count_v1` | Cached exact total book count for instant boot badge |
| `ulm_withdrawn_accessions_v1` | Permanent ledger of withdrawn accession numbers (never reused) |
| `ulm_factory_reset_empty_v1` | `'true'` after True Zero Factory Reset — **strictly blocks** auto-reseeding default Almaris or Book Groups |
| `ulm_setup_completed_v1` | `'true'` once Workstation Setup finishes; `'false'` forces Setup Gate on next boot / post-reset |
| `ulm_database_cleared` / `ulm_initialized_empty` | `'true'` when catalog is intentionally at 0 volumes |
| `ulm_lms_last_tab` / `ulm_lms_active_view` | Persisted active `NavigationTab` |
| `ulm_lms_last_entry_cache` | Last saved `AddEditBookModal` fields for `Copy Previous` ditto button |
| `ulm_borrower_form_draft_v3` | Auto-saved draft for `AddEditBorrowerModal` |
| `ulm_borrower_last_saved_fields_v2` | Last saved department/program/session for rapid member entry |
| `ulm_theme_config_v1` | `{ mode: 'dark' | 'white', whiteTone: 'pearl' | 'soft-alabaster' | 'dove-mist', glassPreset: 'crystal-air' | 'frosted' | 'obsidian-deep' }` |
| `ulm_resolution_config_v1` | `{ scaleMode: 'auto' | 'manual', manualScale: number }` |
| `ulm_db_user_version` | Schema migration version (`'3'`) |

### 4.3 Global Custom Event Bus (`window.dispatchEvent`)

| Event Name | Payload `detail` | Subscribers |
| :--- | :--- | :--- |
| `ulm-library-sync` | `{ books?: Book[], loans?: Transaction[], members?: Borrower[], almaris?: Almari[], bookGroups?: BookGroup[], deletedCount?: number, reason?: string }` | `App.tsx` (authoritatively replaces state without resurrecting deleted rows), `GroupsSettingsTab`, `AlmarisSettingsTab`, `AlmariView`, `Sidebar` |
| `ulm-library-data-changed` | `{ reason?: 'mutation' | 'import' | 'reset', timestamp: string }` | `App.tsx` (reloads when `reason !== 'mutation'`), `GroupsSettingsTab`, `AlmarisSettingsTab` |
| `ulm-repo-path-sync` | `{ path: string }` | `WorkstationSetupModal`, `SettingsView`, `StorageLocationModal` — keeps `DESIGNATED LIBRARY REPOSITORY PATH` and `System Settings → CURRENT LOCATION` 100% live-synced |
| `ulm-institutional-identity-updated` | `InstitutionalIdentity` | `useInstitutionalIdentity()` hook across `App.tsx`, `PrimaryHeader`, `Sidebar`, `AppOpeningSplash`, `UlmSmartIdCard`, `ReportsView` |
| `ulm-theme-changed` | `ThemeConfig` | `AppearanceSettingsTab`, `PrimaryHeader`, chart theme adapters |
| `ulm-resolution-changed` | `ResolutionConfig` | `PrimaryHeader`, `AppearanceSettingsTab` |

### 4.4 Core Algorithms (Exact Rules)

#### 1. `AccessionSeriesEngine` (`src/services/accessionSeriesEngine.ts`)
- **Strict Monotonic Accession Numbers:** Computes `nextAccession = Math.max(highestExistingAccessionInBooks, highestStoredSerial, highestWithdrawnAccession) + 1`. Never reuses deleted/withdrawn accession numbers.
- **Deterministic 13-Digit Code-128 Barcode Format:**
  `ULM` + `String(accessionNumber).padStart(10, '0')` (e.g., Accession `1` -> `ULM0000000001`, Accession `42` -> `ULM0000000042`).
- **Multi-Copy Expansion (`generateUniqueBarcodeCopies`):** When a librarian registers `copiesCount = N` (`N > 1`), generates `N` individual `Book` records with consecutive accession numbers `[start, start+1, ..., start+N-1]`, unique 13-digit barcodes, `total_quantity = 1`, `available_quantity = 1`, and identical bibliographic metadata + Almari placement so every physical copy has its own scannable barcode and independent loan lifecycle.
- **Duplicate/Legacy Repair (`repairAllBookSeriesAndBarcodes`):** Runs non-destructively on app launch to detect any legacy duplicate or non-standard barcodes and assign unique sequential 13-digit barcodes without losing metadata.

#### 2. `reconcileBooksWithLoans(books, loans)` (`src/services/storage.ts`)
- Pure reconciliation function invoked on EVERY read (`getBooks`, `loadAllBooksFromDb`) and EVERY write (`saveBooks`, `saveBooksAsync`, `hardDeleteBooksCascade`).
- Indexes all active loans (`status === 'ISSUED' || status === 'OVERDUE'`, `!return_date`) by `book_id` AND normalized `barcode`.
- For each book:
  - Counts active loans matching that book (`activeLoanCount`).
  - Sets `available_quantity = Math.max(0, total_quantity - activeLoanCount)`, mirrors to `available_copies`.
  - Sets `status = available_quantity === 0 && activeLoanCount > 0 ? 'ISSUED' : 'AVAILABLE'`.
- Guarantees zero desynchronization between Circulation Desk counts, Catalog availability badges, and Barcode Station loan checks.

#### 3. `hardDeleteBooksCascade(targetBooks, currentBooks, options)` (`src/services/storage.ts`)
Solves multi-layer resurrection and ID-vs-barcode mismatch across **all 9 atomic steps**:
1. **Build 4 Composite Match Sets** from `targetBooks`:
   - `deletedIds` (`String(b.id).trim()`)
   - `deletedBarcodes` (`String(b.barcode).trim().toUpperCase()`)
   - `deletedAccessionsRaw` (`String(b.accession_no).trim()`)
   - `deletedAccessionsDigits` (`raw.replace(/\D/g, '')`)
2. **Active Loan Guard / Force-Close:** Checks active loans matching any of the 4 sets. If `forceCloseLoans: true`, marks matching active loans `status: 'RETURNED', return_date: todayIso`, logs `LOAN_FORCE_CLOSED` audit entries, and persists `workingLoans`. If `forceCloseLoans: false`, skips checked-out volumes and returns them in `skippedCheckedOut`.
3. **Authoritative Filter & Cache Update:** Filters `currentBooks` against all 4 match sets, reconciles via `reconcileBooksWithLoans`, and immediately updates `LibraryStorage.setBooksCache(remainingBooks)`.
4. **Optional Archive:** If `mode === 'archive'`, prepends deleted items (`is_active: false, archived_at`) to `localStorage['ulm_archived_books_v1']` (capped at 2000).
5. **Almari Placements & Withdrawn Accessions Cleanup:** Removes matching `id`, `barcode`, and `barcode.toUpperCase()` keys from `ulm_almari_placements_master_v3` and registers each deleted `accession_no` into `BookSheetService.registerWithdrawnAccession()`.
6. **6-Layer Persistence Purge:**
   - **6A:** Active SQLite WASM (`sqliteEngine.deleteBooksBatch(ids, barcodes, accessions, true)`).
   - **6B:** `StorageEngine.deleteBooksBatch(ids, barcodes, accessions)`.
   - **6C:** `window.ulmLibraryApi.deleteBooksBatch(...)` (fallback per-item `deleteBook`).
   - **6D:** Primary IndexedDB `await idbSet('books_catalog', remainingBooks)` AND cursor-based `await LibraryStorage.deleteBooksFromLegacyIdb(...)`.
   - **6E:** Recomputes `ulm_highest_serial_number_v1` & `ulm_catalog_total_count_v1`, writes all 3 `localStorage` book keys (`ulm_lms_books_v1`, `ulm_library_books_master_v1`, `ulm_storage_engine_books_v1`) when `remainingBooks.length <= 1500` (or removes them if `> 1500`; sets `[]` + `ulm_database_cleared = 'true'` when `0`).
7. **Audit Log:** Writes `BOOK_DELETED` to `HistoryEntry[]`.
8. **Live Master Excel Sync:** Immediately invokes `await syncMasterExcelToDisk(remainingBooks, borrowers, workingLoans, almaris)`.
9. **Broadcast Sync:** Dispatches `ulm-library-data-changed` (`reason: 'mutation'`) and `ulm-library-sync` (`books: remainingBooks, loans: workingLoans, reason: 'delete'`).

#### 4. 50,000+ Book Async Chunked Importer (`importBooksInChunks` in `accessionSeriesEngine.ts`)
- Reads Excel/CSV rows via SheetJS (`xlsx`), maps columns with `smartBookImporter.ts`, and processes in **`CHUNK_SIZE = 250`** row batches.
- Between every chunk:
  - Updates `<GlobalHeavyTaskOverlay />` via `updateHeavyTaskProgress(processed, total, message)`.
  - Yields to the browser paint loop via `await new Promise(r => setTimeout(r, 0))` (or `requestAnimationFrame`) so animations stay at 60 FPS and the window never shows "Not Responding".
- Assigns continuous sequential accession numbers and unique 13-digit barcodes in a single monotonic counter pass.
- Commits the combined array **once** via `await LibraryStorage.saveBooksAsync(combined)` to IndexedDB, updates placements, and triggers `syncMasterExcelToDisk()`.

#### 5. True Zero Factory Reset (`ResetToZeroService` + `AlmariService.clearAllToZero()`)
- Triggered only from **System Settings → Card 4 Horizontal Danger Bar (`RESET APP / CLEAR ALL DATA`)** or **Excel Center → Developer Tools** after typing `RESET` in `ResetToZeroModal`.
- Wipes:
  1. SQLite WASM (`Library.ulmlib`) tables & `window.ulmLibraryApi` stores.
  2. Primary IndexedDB (`ulm_central_library_idb_v1` via `idbClearAll()`).
  3. Legacy IndexedDB (`ulm_library_idb_v1`: `books`, `loans`, `borrowers`, `almaris`, `shelves`, `system_settings`).
  4. All `AlmariService` registries (`ulm_almaris_registry_v2 = '[]'`, `ulm_lms_almaris_v1 = '[]'`, `ulm_book_groups_v1 = '[]'`, `ulm_lms_book_groups_v1 = '[]'`, `ulm_lms_almari_groups_v1 = '[]'`, `ulm_almari_placements_master_v3 = '{}'`).
  5. All book, borrower, loan, history, serial, and cache `localStorage` keys.
- Sets authoritative sentinel flags:
  - `localStorage.setItem('ulm_factory_reset_empty_v1', 'true')`
  - `localStorage.setItem('ulm_database_cleared', 'true')`
  - `localStorage.setItem('ulm_initialized_empty', 'true')`
  - `localStorage.setItem('ulm_setup_completed_v1', 'false')`
- **Zero-Reseed Invariant:** Both `AlmariService.getAlmaris()` and `AlmariService.getGroups()` check `localStorage.getItem('ulm_factory_reset_empty_v1') === 'true'`; when true (or when the stored value is an explicit `'[]'`), they strictly return `[]` and **NEVER** auto-reseed default Almaris or Book Groups. Users can explicitly click `Load Default Groups` or `+ Add New Almari` / `+ Add New Group` to repopulate on demand.
- Immediately opens `WorkstationSetupModal` in `isResetMode = true` (`POST-RESET WORKSTATION INITIALIZATION`).

#### 6. Live Auto-Synced 4-Sheet Master Excel (`src/services/masterExcelSync.ts`)
- Builds `ULM_Master_Library_Register.xlsx` containing 4 styled sheets with auto-fitted column widths, frozen header row (`ySplit: 1`), and Royal Amethyst `#541A72` header fill + white bold text:
  1. **`Catalog (Books)`** — Accession #, 13-Digit Barcode, Title, Author, Discipline/Category, Language, ISBN, Edition, Year, Publisher, Place, Pages, Binding, Price (PKR), Dewey Call #, Almari Code, Shelf #, Copies, Available, Status, Source/Remarks, Date Added.
  2. **`Members (Borrowers)`** — Member Code, Full Name, Father Name, Role, Department, Program, Session, Phone, Email, CNIC, Max Books, Valid Until, Status.
  3. **`Circulation (Loans)`** — Loan ID, Barcode, Book Title, Member Code, Member Name, Issue Date, Due Date, Return Date, Status, Fine (PKR).
  4. **`Almaris & Shelves`** — Almari Code, English Name, Urdu Name, Shelves, Books/Shelf, Total Capacity, Current Load, Occupancy %, Assigned Groups, Location Notes.
- Write priority:
  1. Native Desktop IPC (`desktopBridge.writeBinaryFileNative(repoPath + '\\ULM_Master_Library_Register.xlsx', uint8Array)`).
  2. Browser File System Access API (`FileSystemDirectoryHandle` retrieved from IndexedDB `'ulm_repo_dir_handle'`).
  3. Silent in-memory buffer + manual download trigger via Header `Master Excel` button if browser has no folder handle granted yet.


---

## SECTION 5: SCREEN-BY-SCREEN & MODAL-BY-MODAL ATOMIC SPECIFICATION

### 5.1 Top Header (`PrimaryHeader.tsx`), Frameless Window Bar (`WindowsTitleBar.tsx`) & Navigation Sidebar (`Sidebar.tsx`)

#### WindowsTitleBar (`h-8`, hidden automatically when `isDesktopRuntime() === true`)
- Dark obsidian strip `bg-[#0B1220] border-b border-white/[0.08]` with top gold hairline (`via-[#BC881B]/30`).
- Right-aligned Windows controls: `Minimize` (`w-10`), `Maximize / Restore` (`w-10`), `Close` (`w-11 hover:bg-[#DC2626]`). Calls `controlWindow('minimize' | 'maximize' | 'close')`.

#### PrimaryHeader (`h-[60px]` / frosted crystal pill bar)
- **Left Brand Lockup:** Official ULM 2017 Crest (`w-10 h-10 rounded-xl object-contain`, fallback `ULM_OFFICIAL_CREST_SRC`) + `Playfair Display` bold `identity.universityName` (`University of Lakki Marwat`) + uppercase amber subtitle `identity.libraryDepartmentName` (`CENTRAL CAMPUS LIBRARY`).
- **Right Quick Action Cluster:**
  1. **Theme Toggle Button:** Displays `Dark Glass` / `White Glass` with moon/sun icon; triggers `triggerCircularThemeTransition(btnRef.current, toggleMode)`.
  2. **Display Scale Pill (`Auto` / `75%` / `100%` etc.):** Cycles or opens scaling preset selector.
  3. **`ID Card`** — Quick-opens `MemberCardPrintModal` or navigates to `borrowers`.
  4. **`Backup`** — Quick-opens `.ulmpack` backup export or navigates to `excel`.
  5. **`Export`** — Quick-exports active catalog Excel sheet.
  6. **`Master Excel`** — Builds & downloads/syncs `ULM_Master_Library_Register.xlsx` immediately.
  7. **`+ Add Book`** — Gold-amethyst gradient primary CTA opening `AddEditBookModal`.

#### Sidebar (`Sidebar.tsx` / `LmsSidebar.tsx`)
- **Geometry:** Expanded `w-[240px]`, Collapsed rail `w-[72px]`. Responsive auto-collapse when `window.innerWidth < 1024`. Row height `36px` if `innerHeight < 800`, else `40px`.
- **Active Indicator:** `<LiquidPillOverlay axis="y" variant="sidebar-pill" />` glides vertically with spring physics between tabs.
- **Navigation Groups & Exact Keyboard Shortcuts:**
  1. **`CATALOG & INVENTORY`**
     - `Books Catalog` (`tab: 'catalog'`, `⌘1`, icon animation `pop`, live badge: `totalBooksCount`)
     - `Manual Almari View` (`tab: 'almaris'`, `⌘A`, icon animation `wave`)
     - `Barcode Station` (`tab: 'scanner'`, `⌘2`, icon animation `hop`)
  2. **`CIRCULATION & CARDS`**
     - `Issue / Return Desk` (`tab: 'circulation'`, `⌘3`, icon animation `pop`, live badge: `activeLoansCount`)
     - `Member ID Cards` (`tab: 'borrowers'`, `⌘4`, icon animation `hop`, live badge: `totalBorrowersCount`)
  3. **`ADMINISTRATION`**
     - `Reports & Audits` (`tab: 'reports'`, `⌘5`, icon animation `wave`)
     - `Excel & PC Migration` (`tab: 'excel'`, `⌘6`, icon animation `hop`)
- **Bottom Pinned Footer:**
  - `System Settings` (`tab: 'settings'`, `⌘,`, icon animation `spin`)
  - `Collapse Sidebar` toggle (`⌘B`)
- **Global Quick Search (`⌘K`):** Portaled spotlight modal searching live across Books (Title, Author, Barcode, Accession, ISBN, Dewey), Borrowers (Name, Member Code, Department), and Quick Actions; keyboard arrow navigation + `Enter` to open details.

---

### 5.2 Opening Splash (`AppOpeningSplash.tsx`) & Workstation Setup Modal (`WorkstationSetupModal.tsx`)

#### AppOpeningSplash
- Displays on startup (and replayable via System Settings → `Replay Boot Splash`).
- Concentric rotating golden/amethyst crest rings + ULM 2017 Crest + dynamic `identity.universityName` + `identity.libraryDepartmentName` + total catalog volume counter. Auto-dismisses after `2200ms` (click or `Esc` skips).
- On completion (`handleSplashComplete`), checks `isWorkstationAlreadyInstalledAndConfigured(trueBookCount)`. Opens `WorkstationSetupModal` ONLY on fresh first install (0 books & `ulm_setup_completed_v1 !== 'true'`) OR immediately after a Factory Reset (`ulm_setup_completed_v1 === 'false'`).

#### WorkstationSetupModal (`WorkstationSetupModal.tsx`)
- Portaled full-viewport overlay (`fixed inset-0 z-[9999] bg-slate-950/75 backdrop-blur-xl`), card `max-w-3xl rounded-[26px]` with ULM crest badge, micro-tag (`FIRST-LAUNCH WORKSTATION SETUP` or `POST-RESET WORKSTATION INITIALIZATION`), title `University of Lakki Marwat`, subtitle `CENTRAL CAMPUS LIBRARY · WORKSTATION SETUP SUITE`, and close `X` button.
- **Section 1 — Authoritative Repository Path Card:**
  - Header row: `DESIGNATED LIBRARY REPOSITORY PATH` + emerald micro-tag `AUTO-SYNCS MASTER EXCEL (.XLSX)`.
  - Single authoritative editable `<input type="text">` bound directly to `repoPath` initialized from `localStorage.getItem('ulm_library_repo_path_v1') || 'Documents\\ULM Library Data'` (never overwritten back to default by any effect!).
  - Typing or blurring calls `commitRepoPath(val)` which updates React state, persists `ulm_library_repo_path_v1` + `ulm_lms_storage_location_v1`, and broadcasts `window.dispatchEvent(new CustomEvent('ulm-repo-path-sync', { detail: { path } }))`.
  - **`Browse Folder` Button (Synchronous File Explorer Fix):**
    - Calls `showDirectoryPicker()` (browser File System Access API) **synchronously as the very first statement inside the `onClick` handler** (preserving browser user-gesture activation so Windows File Explorer ALWAYS opens), OR calls `desktopBridge.browseDirectoryNative()` inside native WebView2/Electron.
    - On folder pick: stores `FileSystemDirectoryHandle` in IndexedDB `'ulm_repo_dir_handle'`, updates `repoPath` via `commitRepoPath`, and immediately triggers initial Master Excel verification.
- **Section 2 — 3-Column Initialization Cards:**
  1. **`Start as a New Library`** (`RECOMMENDED` micro-tag, amber gradient CTA `Initialize Clean Catalog →`): Sets `ulm_setup_completed_v1 = 'true'`, initializes clean 0-book catalog starting at Accession `#1`, creates initial Master Excel file, closes modal to `catalog`.
  2. **`Import My Existing Excel Sheet`** (`EXCEL / CSV` micro-tag, emerald CTA `Select Excel / CSV File →`): Opens hidden `.xlsx/.csv` file input or `ExcelImportModal`, streams up to 100,000+ books via `importBooksInChunks()`, marks setup complete.
  3. **`Restore Library Package (.ulmpack)`** (`BACKUP RESTORE` micro-tag, violet CTA `Restore Backup →`): Opens `.ulmpack/.zip/.json` file picker, restores books, borrowers, loans, almaris, book groups, and settings atomically, marks setup complete.
- **Footer Bar:** Left emerald indicator `100% Offline Local Storage · Never overwrites an existing catalog` + Right primary CTA `Enter Library Workstation →`.

---

### 5.3 Books Catalog (`BooksCatalogView.tsx`) & Its Modals

#### Main Catalog Screen
- **4 Top KPI Cards:** `Total Volumes` (live reconciled DB count), `Available On Shelf`, `Currently Issued`, `Unique Disciplines / Almaris` (tabular `Space Grotesk` numbers).
- **Control & Filter Toolbar:**
  - Real-time search input matching `book_name`, `author`, `barcode`, `accession_no`, `isbn`, `dewey_call_number`, `title_roman`, `author_roman` (handles English + Urdu RTL).
  - Custom frosted glass dropdowns (`CatalogGlassDropdown`):
    - **Discipline / Category Filter** (dynamically derived from catalog + Book Groups)
    - **Language Filter** (`All Languages | English | Urdu | Arabic | Pashto`)
    - **Availability Status Filter** (`All | Available | Issued`)
    - **Almari Filter** (`All Almaris | Unassigned | A-01 ...`)
    - **Sort Order** (`Newest Added | Accession Asc/Desc | Title A–Z | Author A–Z`)
  - **4-Tab View Switcher** (with `LiquidPillOverlay` horizontal glide): `Grid` | `List` | `Almaris` (navigates to `almaris`) | `Analytics` (inline `CatalogChartsView`).
  - **Toolbar Action Buttons:** `+ Add Book`, `Import Excel`, `Print Labels` (opens `BatchLabelPrintModal` scoped to selection if `selectedIds.size > 0`, otherwise opens scoped modal).
- **Multi-Select & Floating Bulk Action Bar:**
  - Every Book Card (Grid) and Table Row (List) includes an explicit selection checkbox + header "Select All on Page" & "Select All Matching Filter" toggles.
  - When `selectedIds.size > 0`, a floating glass action bar animates in at bottom center showing:
    - `{N} Selected` count + `Clear`
    - `Print Barcode Labels ({N})` — opens `BatchLabelPrintModal` pre-locked to `scope = 'selected'` with `selectedIds`.
    - `Assign Almari` — opens `BulkAssignModal`.
    - `Delete Selected ({N})` — opens `DeleteBookConfirmModal` in bulk mode -> executes `hardDeleteBooksCascade()`.
- **Grid View:** Responsive 1–4 col frosted book cards showing cover thumbnail (or stylized discipline spine fallback), Accession `#` & 13-digit Barcode mono chip, Title (`dir="auto"`), Author, Discipline badge, Almari/Shelf pill (`A-01 · S2`), Availability `StatusPill`, and quick action row (`View`, `Edit`, `Issue/Return`, `Barcode`, `Delete`).
- **List View:** Dense sortable table with sticky frosted header, pagination (`25 | 50 | 100 | 250` rows/page for smooth 50,000+ catalog browsing), inline quick actions, and row selection.

#### `AddEditBookModal.tsx` (26-Field Accession Register)
- **Modes:** `Add New Book` | `Edit Existing Book` | `Duplicate Copy` (copies bibliographic fields while advancing Accession `#` and generating a fresh 13-digit barcode).
- **Header Utilities:** `Copy Previous` (hydrates from `ulm_lms_last_entry_cache` for rapid multi-book cataloging) and `Save & Next` (saves current record, keeps modal open, increments Accession `#` + barcode, resets title/ISBN).
- **26 Accession Fields:**
  1. Accession No. (auto-monotonic via `AccessionSeriesEngine`, locked against withdrawn accessions)
  2. 13-Digit Barcode (auto `ULM0000000001`, customizable with uniqueness check)
  3. Copies Count (`1..500`; if `> 1` on new entry, calls `generateUniqueBarcodeCopies` to mint consecutive unique barcoded volumes)
  4. Book Title (`book_name`, `dir="auto"`) + 5. Romanized Title (`title_roman`)
  6. Author (`author`, `dir="auto"`) + 7. Romanized Author (`author_roman`)
  8. Discipline / Category + 9. Book Group (`group_id` auto-suggested by `match_category`/`match_language`)
  10. Language (`English | Urdu | Arabic | Pashto | Other`)
  11. ISBN-10 / ISBN-13 (live advisory checksum validator — warns if invalid without hard-blocking legacy unnumbered books)
  12. Edition, 13. Publication Year, 14. Publisher, 15. Place of Publication
  16. Total Pages (auto-flags Thin Spine `< 80pp` for label printing), 17. Binding (`HB | PB | Spiral | Leather`)
  18. Price (PKR), 19. Bill / Invoice No., 20. Source / Remarks (Purchase / Donation / HEC Grant)
  21. Dewey Decimal Call No. (`dewey_call_number`)
  22. Physical Almari (`almari_id`) + 23. Shelf Tier (`shelf_no`, `1..almari.shelf_count`) + 24. Section / Row
  25. Date Added (`YYYY-MM-DD`)
  26. Book Cover Image Uploader (client-side `<canvas>` resize to max `500×700` JPEG quality `0.85` to keep IndexedDB lean).

#### `BatchLabelPrintModal.tsx` (Scoped Barcode & Spine Label Studio)
- **4-Tab Print Scope Selector** (zero accidental printing of the entire 50k catalog):
  1. `Selected ({N})` — auto-active whenever launched from Catalog checkboxes or single-book Print.
  2. `Range (Acc #)` — `From Acc #` and `To Acc #` numeric range inputs with live matched volume count.
  3. `Recent Batch` — filters to the latest Excel import batch (`import_batch_id`) or last 24h additions.
  4. `All Catalog` — requires explicit selection; warns if `> 500` labels.
- **Configuration Sidebar:**
  - **Label Size Presets (5):** Standard (`63.5×38.1mm`), Medium (`50×25mm`), Small (`38.1×21.2mm`), Thin Spine (`15×38mm`), Custom (`60×35mm`).
  - **Sheet Layout Templates (4):** `Avery L7160 (21/sheet A4)`, `Avery L7651 (65/sheet A4)`, `Plain A4 Grid`, `Thermal Roll (1/label)`.
  - **Start Position `#`** (skip already-used slots on a partially used Avery sticker sheet, e.g., start at slot `7`).
  - **Toggles:** `Show Cut Guidelines`, `Include Dewey Call No.`, `Include Almari & Shelf`, `Thin Spine Mode (<80pp)` (rotates compact barcode + call # vertically for narrow spines).
  - **Live Scan-Safety Meter (`evaluateScanSafety`):** Calculates physical X-dimension bar module width in `mm` (`>= 0.25mm` Safe Emerald, `0.19–0.24mm` Caution Amber, `< 0.19mm` Too Narrow Rose).
- **Live Paginated Sheet Preview** + **`Save Vector PDF`** (`pdfGeneratorService`) + **`Print Labels`** (isolated white-bg `@media print` window via `printAndPdfEngine.ts`).

---

### 5.4 Manual Almari View (`AlmariView.tsx`)

- **Purpose:** Visual physical shelf & cupboard management mimicking real library wooden/steel Almaris (`A-01`, `A-02`, ...).
- **Top Control Rail:**
  - Horizontal scrollable Almari Selector Strip with **dedicated Left (`Prev`) and Right (`Next`) chevron scroll buttons** scrolling smoothly by `±320px` per click (prevents clipping on narrow screens).
  - Each cupboard tab shows Code (`A-01`), Bilingual Name, Assigned Group color dots, and Occupancy counter (`42 / 150`).
  - Actions: `+ Add Almari`, `Edit Almari`, `Delete Almari`, `Auto-Arrange`, `Search Shelf Books`.
- **Two-Column Spatial Workspace:**
  - **Left/Main Visual Almari Cabinet:** Renders `1..almari.shelf_count` horizontal wooden/glass shelf tiers. Each shelf displays:
    - Shelf header (`Shelf 1`, occupancy bar `N / books_per_shelf`, capacity warning when `>= 90%`).
    - Horizontal row of interactive **Book Spines**:
      - **Zero-Jitter Stationary Hit-Target Hover Pattern:** Outer spine wrapper stays strictly stationary (`relative shrink-0`) as the mouse hit target, while the inner visual spine card carries `pointer-events-none transition-transform duration-150 group-hover:-translate-y-2.5 group-hover:scale-[1.03]` — eliminating infinite hover flicker at shelf edges!
      - Spine shows vertical/angled title, accession #, availability dot, and click opens Quick-Move Popover or `BookDetailsModal`.
  - **Right Dock — Unassigned Books Staging Panel:** Searchable list of books with `!almari_id || !shelf_no`, ready to drag onto any shelf or quick-assign.
- **4 Supported Drag-and-Drop (HTML5 DnD) Flows:**
  1. Unassigned Dock -> Any Shelf Tier (assigns `almari_id`, `almari_code`, `shelf_no`, locks placement).
  2. Shelf Tier A -> Shelf Tier B within the same Almari (moves shelf + logs `BookLocationHistory`).
  3. Shelf Tier -> Different Almari Tab in top rail (moves cupboard + defaults to Shelf 1 with space).
  4. Shelf Spine -> Unassigned Dock (unassigns cupboard location cleanly).
- **4 Portaled Modals:** `Add Almari`, `Edit Almari`, `Confirm Delete Almari` (move books to target Almari or unassign), and `Quick-Move Popover` (1-click shelf transfer + toggle `placement_locked`).

---

### 5.5 Barcode Station (`BarcodeScannerView.tsx`)

- **Hardware-First Design:** Always-listening USB/Bluetooth HID keyboard-wedge capture (`scanner_auto_submit_ms` burst detection) + dedicated focused scan input bar with audio feedback (`playSuccessBarcodeBeep`, `playErrorBeep`).
- **Unified Auto-Detection Engine:**
  - Automatically distinguishes a **Book Barcode** (`ULM0000000001` or matching `accession_no`/`isbn`) from a **Member Card Barcode** (`ULM-FA23-BCS-042` / matching `member_code`/`roll_no`).
- **Smart Workflow Modes:**
  1. **Implicit Pairing (Issue Mode):** Scan Book -> Scan Member (OR Scan Member -> Scan Book). Validates member status (`active`), quota (`activeLoans < max_books_allowed` with librarian override toggle), and copy availability. Opens inline **Loan Duration Selector** (`7 | 14 | 21 | 30 | Custom Days`) or instant 1-click Issue.
  2. **Chained Rapid Scanning:** Keep Member pinned to issue multiple books sequentially by scanning book after book without re-scanning the member card.
  3. **Instant Return & Post-Return Reshelving Prompt:** Scanning an already-`ISSUED` book immediately offers 1-click Return (computes overdue fine if `today > due_date`) and displays a **Post-Return Reshelving Banner** highlighting the book's exact home Almari & Shelf (`Return to A-03 · Shelf 2`).
  4. **4-Layer Atomic Almari Shelving Mode:** Toggle `Shelf Assignment Mode`: pick target Almari & Shelf (or click `Quick Create Cupboard`), then scan books to assign their physical placement across React state, `ulm_almari_placements_master_v3`, IndexedDB, and Master Excel simultaneously. Includes **"Apply to All Sibling Copies"** toggle to shelve all copies of the same title together.
  5. **Unknown Barcode Recovery:** If a scanned barcode is not in the catalog, displays an immediate `+ Register New Book with Barcode [CODE]` button pre-filling `AddEditBookModal`.

---

### 5.6 Issue / Return Desk (`CirculationDeskView.tsx`)

- **Header:** Title `Circulation & Issue/Return Desk` + Primary CTA `+ Issue New Book` (toggles inline **Issue Drawer** OR opens `IssueBookFlowModal`).
- **Inline Issue Drawer:** Fast 3-field horizontal bar: Search/Select Available Book + Search/Select Active Member + Due Date picker (auto-defaults by role: Student `14d`, Staff `21d`, Faculty `30d`) + `Confirm Issue`.
- **4 Interactive KPI Filter Cards (`CirculationKpiCard`):** Clicking any card filters the loan list:
  1. `Active Loans` (Amber)
  2. `Overdue Copies` (Rose — `status === 'ISSUED' && due_date < todayIso`)
  3. `Due Within 3 Days` (Cyan)
  4. `Returned History` (Emerald)
- **Filter & View Bar:** Search by Book Title / Barcode / Member Name / Member Code + Status filter + Grid/List switcher animated by `<LiquidPillOverlay axis="x" variant="segmented-pill" />`.
- **Loan Cards & Table Rows:**
  - Left `4px` semantic status bar (`emerald` Returned, `amber` Active, `rose` Overdue).
  - Displays Book Title (clickable -> `BookDetailsModal`), Barcode mono tag, Member Name & Role (clickable -> `BorrowerDetailsModal`), Issue Date, Due Date, Overdue Days + calculated PKR fine, and architectural `StatusPill`.
  - **`Return Copy` Button State Machine:** Transitions cleanly `idle -> loading (spinner) -> success (emerald checkmark + audio chime)` -> updates `Transaction.status = 'RETURNED'`, reconciles book availability via `reconcileBooksWithLoans`, and syncs Master Excel.

---

### 5.7 Member ID Cards (`BorrowersView.tsx`), CR80 Smart Card (`UlmSmartIdCard.tsx`) & Print Studio (`MemberCardPrintModal.tsx`)

#### BorrowersView (`BorrowersView.tsx`)
- **6 Header Actions:** `+ Register Member`, `CR80 ID Card Studio`, `Import Members CSV`, `Download CSV Template`, `Export Members CSV`, `Refresh`.
- **4 KPI Cards (`CountUp` animations):** `Total Members`, `Active Cards`, `Students`, `Faculty & Staff`.
- **Filter Bar:** Search (Name, Member Code, Roll No, Dept, Phone, CNIC) + Role Filter (`All | Student | Faculty | Staff`) + Status Filter (`All | Active | Suspended | Expired`) + Department dropdown + Grid/Table switcher.
- **Member Cards (Grid):** Frosted card with faint ULM crest watermark, portrait avatar (or initials), architectural status micro-tag (`ACTIVE` / `SUSPENDED`), Member Code mono badge, Active Loans count (`2 / 3 Books`), Valid Until date, and quick actions (`View Profile`, `Print CR80 ID`, `Issue Book`, `Edit`, `Delete`).

#### `AddEditBorrowerModal.tsx` (12-Column Live Preview Registration)
- **Left 7 Columns (Form):**
  - Role segmented selector (`Student | Faculty | Staff`) automatically setting `max_books_allowed` (`3 | 10 | 5`).
  - Member Code / University Reg No. input with **ULM Regex Auto-Parser** (`/^ULM-(FA|SP)(\d{2})-([A-Z]{2,5})-(\d+)$/i`, e.g., `ULM-FA23-BCS-042`): auto-populates `Session` (`Fall 2023`), `Program` (`BS Computer Science`), `Department` (`Computer Science`), and computes `valid_until` (`computeStudentValidUntil` = admission year + 4 years).
  - Full Name, Father Name, Department, Program, Session, Semester, CNIC, Email, Blood Group.
  - **Pakistani Phone Normalizer:** Automatically formats digits into `03XX-XXXXXXX`.
  - **Portrait Photo Uploader:** Opens `PhotoCropModal` locking exact `86:106` portrait ratio and compressing to JPEG Data URI.
  - **Draft Auto-Persistence:** Automatically saves in-progress edits to `ulm_borrower_form_draft_v3` and remembers last Department/Program/Session in `ulm_borrower_last_saved_fields_v2`.
- **Right 5 Columns:** Real-time interactive `<UlmSmartIdCard />` preview updating keystroke-by-keystroke as the librarian types.

#### `UlmSmartIdCard.tsx` (Pixel-Exact CR80 PVC Library Card)
- **Dimensions:** Physical `85.60mm × 53.98mm` (ISO/IEC 7810 ID-1 CR80), screen reference `428px × 276px`.
- **Watermark:** `<img src={preBakedWatermarkUri} />` generated by `usePreBakedWatermark(crestSrc, opacity)` on a `320×320` offscreen canvas (default `6.5%` alpha, user-adjustable `2%–15%`) so CSS opacity bugs never wash out printed PDFs.
- **Front Face:**
  - `60px` Royal Amethyst `#541A72` -> `#2E0D42` institutional header band with 24K Gold `#BC881B` bottom trim, ULM 2017 Crest (`42×42px`), `Playfair Display` University Name, `CENTRAL CAMPUS LIBRARY · MEMBER ID CARD` gold subtitle.
  - Body: Left `86×106px` framed portrait photo with role color border + Right structured metadata grid (Full Name, Father Name, Role badge, Member Code mono, Department, Program/Session, Valid Until).
  - `46px` Footer: Deterministic pure-SVG `<Code128Barcode value={member.member_code} />` with quiet zones and monospace caption.
- **Back Face:**
  - `34px` header strip (`LIBRARY BORROWING RULES & VERIFICATION`).
  - Left: 4 numbered official ULM library rules (non-transferable card, 14-day/30-day return policy, fine notice, lost-card reporting) + Authorized Librarian signature line.
  - Right: Deterministic `29×29` module `<VerificationQr />` SVG generated via FNV-1a hash matrix from `ULM|${member_code}|${full_name}|${valid_until}` (100% offline, zero external QR CDN).
  - `38px` Return Address Footer: Campus address, phone, `library@ulm.edu.pk`, "If found, please return to Central Campus Library, University of Lakki Marwat."
- **4 Built-In Sample Presets** in `MemberCardPrintModal`: Undergraduate Student, MPhil Scholar, Assistant Professor (Faculty), Library Staff.

#### `MemberCardPrintModal.tsx`
- View toggle: `Both Sides | Front Only | Back Only`.
- Preset selector + 12 Live Editable Card Fields + Watermark Opacity Slider (`2%–15%`).
- Sheet Layout Selector:
  1. `cr80_single` — Exact `85.60 × 53.98mm` single PVC card printer output (Front page 1, Back page 2).
  2. `a4_sheet_10` — `2 × 5 = 10` CR80 cards per A4 sheet with corner crop marks.
  3. `a4_duplex` — A4 Front sheet + horizontally mirrored A4 Back sheet for double-sided duplex alignment.
- Actions: **`Save as PDF`** (high-DPI vector/canvas PDF via `printAndPdfEngine.ts`) and **`Print CR80 Card`** (isolated white-bg print window).

---

### 5.8 Reports & Audits (`ReportsView.tsx`)

- **Header:** Title `Reports, Analytics & System Audits` + Portaled Period Filter Dropdown (`Last 7 Days | Last 30 Days | All Time`) + Export CSV Dropdown (`Full Catalog CSV`, `Active Loans CSV`, `Overdue Notices CSV`, `Member Directory CSV`) + **`Export PDF Report`** + **`Print A4 Report`**.
- **5 Executive KPI Cards + `SegmentedTickBar`:**
  1. Total Collection Volumes (`totalDbBooksCount`)
  2. Circulation Utilization % (Issued / Total)
  3. Active Members Count
  4. Overdue Loans & Total Estimated Fines (PKR)
  5. Almari Shelf Fill Ratio % (visualized with `SegmentedTickBar` 20-tick gauge).
- **Interactive Charts (Recharts):**
  - **Circulation Activity `AreaChart`** (`7d | 30d | all`): Dual smoothed gradient areas for Daily Issues (Amethyst `#8B5CF6`) vs Daily Returns (Emerald `#10B981`).
  - **Collection Distribution `PieChart` Donut:** Toggleable between `By Discipline` and `By Language` (English/Urdu/Arabic/Pashto) paired with ranked `MiniShareBar` progress breakdown.
- **8-Point Real Storage & Integrity Audit Panel:** Runs live checks against actual IndexedDB/SQLite/localStorage state (no fake numbers):
  1. IndexedDB Primary Catalog Integrity (`books_catalog` readable & count matches)
  2. Accession Series Continuity & Monotonic Serial Guard
  3. 13-Digit Code-128 Barcode Uniqueness Audit (0 duplicates)
  4. Loan-to-Book Availability Reconciliation Status
  5. Almari Placement Orphan Check
  6. Member Card Code Uniqueness & Active Status Check
  7. Master Excel Auto-Sync Readiness & Folder Path Binding
  8. LocalStorage Mirror Safety Threshold (`<= 1500` guard active)
- **Overdue Action List:** Table of all overdue loans sorted by days overdue descending, showing Member Phone (`03XX-XXXXXXX`), Book Barcode, Due Date, Days Overdue, Fine (PKR), and 1-click navigate to Circulation Desk.
- **PDF & Print Output:** Captures charts via `html2canvas` -> `jsPDF` with automatic clean vector table fallback (`pdfGeneratorService`) + isolated pure-white A4 `@media print` document.

---

### 5.9 Excel & PC Migration (`ExcelCenterView.tsx`)

3-Row Bento Grid Layout:
- **Row 1 (2 Columns):**
  1. **Book Entry Sheet Import Card:** Drag-and-drop or file-pick `.xlsx`/`.csv`, launches `BookImportModal` / `ExcelImportModal` with 40+ smart column auto-mapping, live preview, 250-row async chunked importer (`importBooksInChunks`), and post-import Barcode Studio trigger.
  2. **3-Step Offline `.ulmpack` ZIP Pipeline Card (`usbBackupService.ts`):**
     - Step 1: Export complete portable `.ulmpack` (ZIP via `fflate` containing `catalog.json`, `members.json`, `loans.json`, `almaris.json`, `groups.json`, `settings.json`, `identity.json`, `manifest.json` with SHA/count checksums).
     - Step 2: Copy `.ulmpack` via USB drive to target Campus PC.
     - Step 3: Import & Verify `.ulmpack` on target PC (atomic replace with rollback point).
- **Row 2 (5-Card Spreadsheet Export Grid):**
  1. `Full Catalog Register (.xlsx)`
  2. `Member Directory (.xlsx)`
  3. `Active & Historical Loans (.xlsx)`
  4. `Overdue & Fine Notice Sheet (.xlsx)`
  5. `Almari & Shelf Placement Map (.xlsx)`
- **Row 3 (Collapsible `Advanced Migration & Developer Tools`):**
  - Master CSV / JSON Full Export & Import.
  - **Stress Benchmark Generator:** `+25,000 Test Books` generator (runs in async chunks via `GlobalHeavyTaskOverlay`) to verify 50k+ performance.
  - **Reset to Zero** trigger (opens `ResetToZeroModal`).

---

### 5.10 System Settings (`SettingsView.tsx` + Sub-Tabs)

- **Top Sub-Navigation Tabs:** `General & Workstation` (`general`) | `Book Groups` (`groups`) | `Almaris & Shelves` (`almaris`) (in `general`, all Bento rows are accessible or quick-scrolled; clicking `groups` / `almaris` focuses the dedicated configuration view).
- **Bento Row 1 (2 Equal-Height Glass Cards):**
  - **Card 1 — Appearance, Display Scaling & Official ULM 2017 Crest (`AppearanceSettingsTab.tsx`):**
    - Circular-wave Dark Glass / White Glass mode switcher.
    - 3 White Surface Tone cards (`Warm Pearl #F0EDE6`, `Soft Alabaster #EAE6DF`, `Dove Mist #E5EAF0`).
    - 6 Display Scaling Preset Buttons (`Auto-Fit`, `30%`, `45%`, `75%`, `100%`, `125%`) + continuous percentage slider.
    - Official ULM Crest uploader (`Upload PNG` / `Reset Official 2017 Crest`) + Crest Footer (`University of Lakki Marwat LMS` + architectural `rounded-md` micro-tag `Official 2017 Crest Edition`) + `Replay Boot Splash` button.
  - **Card 2 — Institutional Identity & Campus Header Details:**
    - Editable inputs: `University / Institution Name *`, `Library Facility / Department Name *`, `Campus Physical Address`, `Official Contact Phone`, `Official Circulation Email`.
    - **`LIVE TITLE BAR & HEADER PREVIEW`** box showing exact synchronized branding before/after saving.
    - **`Save & Sync Branding`** button updating `ulm_institutional_identity_v1`, `ulm_lms_settings_v1`, `document.title`, favicon, Header, Splash, ID Cards, and Reports instantaneously.
- **Bento Row 2 (2 Equal-Height Glass Cards):**
  - **Card 3 — Barcode Scanner & Circulation Policy:**
    - USB HID Auto-Submit threshold (`ms`), Auto-Focus input toggle, Audio Scanner Chimes toggle, Barcode Prefix (`ULM`).
    - Default Loan Days (`Student: 14`, `Staff: 21`, `Faculty: 30`) and Daily Overdue Fine (`PKR`).
  - **Card 4 — Library Folder Storage & Data Maintenance:**
    - Displays live-synced **`CURRENT LOCATION`** (subscribed to `ulm-repo-path-sync` and `ulm_library_repo_path_v1`) + **`CHANGE LOCATION`** button (opens `WorkstationSetupModal` / `StorageLocationModal`) + **`Sync Master Excel Now`** button.
    - **Note:** `CLEAR DEMO DATA` and the static `Almari Plan (12 Disciplines)` panel are **permanently removed** to keep Settings executive and uncluttered.
    - Bottom full-width horizontal Danger Bar (`rounded-2xl border-rose-500/35 bg-rose-500/[0.07]`): **`RESET APP / CLEAR ALL DATA`** — opens `ResetToZeroModal` (requires typing `RESET`) and executes the True Zero Factory Reset wiping books, members, loans, Almaris, and Book Groups to strictly `0`.
- **Bento Row 3 — Book Groups & Almaris Management:**
  - **`GroupsSettingsTab.tsx`:** Scrollable table with `#` reorder up/down arrows, Bilingual Name (`name_en` + Urdu `name_ur`), Color swatch + hex mono, Auto-Match Rules (`Lang:` / `Cat:` `rounded-md` chips), Architectural Status Toggle (`ACTIVE` / `HIDDEN` `rounded-md` micro-tag with `5×5px` square indicator), Edit/Delete actions, Portaled `Add New Group` & `Delete Group` modals. When `groups.length === 0`, renders a crisp **0-Item Empty State** with `+ Add New Group` and optional `Load Default Groups`.
  - **`AlmarisSettingsTab.tsx`:** Collapsible amber status bar for `N Unassigned Book Groups` (hidden when `groups.length === 0`), scrollable table with Code (`A-01`), Bilingual Name + `Locked` micro-tag + Location Notes, Shelves & Capacity (`5 Shelves · ~30/shelf`), Assigned Group colored `rounded-md` chips, Current Load progress bar (`emerald <70%`, `amber 70–89%`, `rose >=90%`), inline Edit & `DeleteAlmariModal`, Portaled `Add New Almari` modal. When `almaris.length === 0`, renders a crisp **0-Item Empty State** with `+ Add New Almari` (never auto-reseeds).

---

## SECTION 6: UNIFIED PRINT & PDF ENGINE + DESKTOP IPC CONTRACT

### 6.1 Unified Print & Vector PDF Engine (`printAndPdfEngine.ts` + `pdfGeneratorService.ts`)

#### Isolated White-Paper Printing Protocol (`printHtmlIsolated`)
- **Critical Rule:** Never print the dark frosted-glass SPA directly (which wastes black ink and clips `overflow-hidden` scroll containers).
- Instead, `printHtmlIsolated(title, bodyHtml, pageCss)` creates either a hidden temporary `<iframe>` (preferred inside Edge WebView2 / Electron / iframe sandboxes where `window.open` is blocked) or dedicated `#ulm-print-root` sibling container while `@media print` hides `#root` completely, forcing pure `#FFFFFF` background, `#000000` crisp text, and `-webkit-print-color-adjust: exact; print-color-adjust: exact;`.

#### Exact Barcode Label Millimeter Geometry

| Preset ID | Label Width (mm) | Label Height (mm) | Primary Use |
| :--- | :---: | :---: | :--- |
| `standard` | `63.5 mm` | `38.1 mm` | Avery L7160 standard cover/inside barcode + Dewey + Almari |
| `medium` | `50.0 mm` | `25.0 mm` | Compact thermal roll / inside cover barcode |
| `small` | `38.1 mm` | `21.2 mm` | Avery L7651 mini accession sticker |
| `thin` | `15.0 mm` | `38.0 mm` | Vertical book spine label for thin volumes (`< 80 pages`) |
| `custom` | `60.0 mm` | `35.0 mm` | User-adjustable thermal/sheet size |

#### Exact Sheet Template Millimeter Geometry (A4 = `210mm × 297mm`)

| Template ID | Columns × Rows | Labels / Sheet | Top Margin | Left Margin | Col Gap | Row Gap |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `avery_l7160` | `3 × 7` | `21` | `15.1 mm` | `7.2 mm` | `2.5 mm` | `0.0 mm` |
| `avery_l7651` | `5 × 13` | `65` | `10.7 mm` | `4.7 mm` | `2.5 mm` | `0.0 mm` |
| `plain_a4_grid` | Dynamic (`floor((210-16+2)/(w+2))`) | Auto | `8.0 mm` | `8.0 mm` | `2.0 mm` | `2.0 mm` |
| `thermal_roll` | `1 × 1` | `1` | `0.0 mm` | `0.0 mm` | `0.0 mm` | `0.0 mm` |

- **Start Slot Offset (`startSlot >= 1`):** Skips the first `startSlot - 1` blank slots on page 1 so partially used sticker sheets are never wasted.
- **Vector Code-128B in `jsPDF`:** Draws each bar as an exact `doc.rect(x, y, barW, barH, 'F')` filled black vector rectangle using `encodeCode128B()` from `src/utils/code128.ts` — guaranteeing razor-sharp laser scanner readability at any DPI without raster blur.

#### Exact CR80 Member ID Card Millimeter Geometry
- **ISO/IEC 7810 ID-1 (CR80):** `85.60 mm × 53.98 mm`, corner radius `3.18 mm`.
- **`cr80_single`:** Custom PDF page size `[85.60, 53.98]` landscape (Page 1 = Front, Page 2 = Back) for direct PVC Fargo/Evolis/Zebra card printers.
- **`a4_sheet_10`:** A4 Portrait `210 × 297 mm`, `2 columns × 5 rows = 10 cards`, Left Margin `14.4 mm`, Top Margin `8.55 mm`, Col Gap `10.0 mm`, Row Gap `2.5 mm`, plus `3mm` hair-line corner crop marks.
- **`a4_duplex`:** Page 1 renders Fronts `[Col 0, Col 1]`; Page 2 renders horizontally mirrored Backs `[Col 1, Col 0]` so duplex long-edge printing aligns Front & Back to `< 0.3mm` tolerance.

---

### 6.2 Desktop IPC Contract (`src/types/desktop.d.ts` & `src/services/desktopBridge.ts`)

Pre-wired to run identically in **C# .NET 8 WPF + Edge WebView2** (serving `dist/` via `SetVirtualHostNameToFolderMapping("ulm-library.local", distPath, Allow)` -> `https://ulm-library.local/`) AND **Electron**.

#### Runtime Detection (`isDesktopRuntime()`)
Returns `true` if ANY of the following host bridges exist on `window`:
1. `window.desktopAPI` (preferred unified bridge injected by WebView2 `AddHostObjectToScript` / preload script)
2. `window.chrome?.webview?.postMessage` (raw C# WPF Edge WebView2 host)
3. `window.electronAPI` (Electron `contextBridge.exposeInMainWorld`)

#### Exact `window.desktopAPI` Interface (`src/types/desktop.d.ts`)

```ts
export interface DesktopAPI {
  platform: 'windows-wpf-webview2' | 'electron' | 'tauri';
  appVersion: string;

  // 1. Native Windows Folder Picker (Vista+ IFileOpenDialog / CommonOpenFileDialog)
  selectFolder: (defaultPath?: string) => Promise<{
    canceled: boolean;
    folderPath?: string;
  }>;

  // 2. Native File I/O inside Designated Library Repository Path
  writeBinaryFile: (absolutePath: string, base64Data: string) => Promise<{
    success: boolean;
    path?: string;
    bytesWritten?: number;
    error?: string;
  }>;

  readBinaryFile: (absolutePath: string) => Promise<{
    success: boolean;
    base64Data?: string;
    error?: string;
  }>;

  writeTextFile: (absolutePath: string, content: string) => Promise<{
    success: boolean;
    error?: string;
  }>;

  fileExists: (absolutePath: string) => Promise<boolean>;
  openFolderInExplorer: (folderPath: string) => Promise<void>;

  // 3. Native Silent / Dialog Print & PDF Save
  printCurrentView?: (options?: { landscape?: boolean; pageSize?: string }) => Promise<boolean>;
  savePdfFile?: (defaultFileName: string, base64Pdf: string) => Promise<{
    canceled: boolean;
    savedPath?: string;
  }>;

  // 4. Native Frameless Window Controls (if custom chrome desired)
  windowControl?: (action: 'minimize' | 'maximize' | 'restore' | 'close') => void;
}
```

#### C# WPF Edge WebView2 JSON-RPC Fallback Envelope (`desktopHostBridge.ts`)
When only `window.chrome.webview.postMessage` is present, `desktopBridge.ts` dispatches a structured JSON envelope:
```json
{
  "requestId": "req-1732345678-a1b2",
  "method": "selectFolder" | "writeBinaryFile" | "readBinaryFile" | "openFolderInExplorer" | "windowControl",
  "params": { "defaultPath": "Documents\\ULM Library Data" }
}
```
And listens on `window.chrome.webview.addEventListener('message', handler)` for `{ requestId, ok, result, error }` to resolve the Promise with a `30s` timeout guard.

---

### 6.3 Codex Rebuild & Verification Checklist

When rebuilding this application from scratch using this blueprint, verify all 10 acceptance gates before shipping:
1. **Zero-CDN Offline Build:** `npm run build` succeeds with zero TypeScript errors (`npm run lint`) and zero network font/script requests in `index.html`.
2. **Dual-Theme & Circular Wave:** Toggling `Dark Glass` <-> `White Glass` animates a 700ms radial View Transition wave from the button center; all 3 White Surface Tones (`pearl`, `soft-alabaster`, `dove-mist`) and Display Scaling presets persist across reloads.
3. **First-Launch & Post-Reset Setup Gate:** Fresh launch opens `WorkstationSetupModal`; editing `DESIGNATED LIBRARY REPOSITORY PATH` persists across reloads and syncs live to `System Settings → CURRENT LOCATION`; `Browse Folder` invokes `showDirectoryPicker()` synchronously (or `desktopAPI.selectFolder()`).
4. **True Zero Factory Reset:** Clicking `RESET APP / CLEAR ALL DATA` -> typing `RESET` wipes Books, Members, Loans, Almaris, and Book Groups to strictly `0` with `ulm_factory_reset_empty_v1 = 'true'`; reloading the app keeps Almaris at `0` and Book Groups at `0` (never auto-reseeds).
5. **50,000+ Book Performance:** Importing 25,000+ Excel rows runs in 250-row async chunks behind `<GlobalHeavyTaskOverlay />`, stores in IndexedDB `ulm_central_library_idb_v1`, removes truncated `localStorage` book mirrors (`> 1500`), and maintains smooth 60 FPS scrolling & pagination.
6. **Bulletproof Single & Bulk Deletion:** Deleting 1 book or 500 selected books removes them across React state, SQLite, IndexedDB (`books_catalog` + legacy `ulm_library_idb_v1`), all 3 `localStorage` book keys, Almari placements, and Master Excel — zero resurrection on reload.
7. **Almari Visual Interaction:** Horizontal Almari rail Prev/Next buttons scroll `±320px`; book spines lift smoothly on hover with zero jitter (stationary wrapper + `pointer-events-none` inner spine); all 4 DnD flows persist immediately.
8. **Scoped Barcode Printing & Vector PDF:** Printing selected books prints ONLY those books; Avery L7160/L7651/Plain A4/Thermal millimeter layouts match exact specs; `Start #` skips used sticker slots; isolated white-bg printing produces crisp black-on-white Code-128B bars.
9. **CR80 PVC Member ID Cards:** Renders `85.60×53.98mm` Front & Back with pre-baked 6.5% crest watermark, deterministic SVG Code-128B barcode, and deterministic `29×29` FNV-1a verification QR; exports `cr80_single`, `a4_sheet_10`, and mirrored `a4_duplex` PDFs.
10. **Live Master Excel Auto-Sync:** Every catalog, member, loan, or Almari mutation updates `ULM_Master_Library_Register.xlsx` (4 styled sheets) automatically to the designated repository folder.
