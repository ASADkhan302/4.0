# Google AI Studio Master Prompt: Fix Fixed Sidebar & Restore Vertical Scrolling Across ALL 8 Pages / Views (ULM Library)

Copy and paste the prompt block below directly into **Google AI Studio**. It fixes the **Left Sidebar** so it stays locked in place and restores smooth **up/down vertical scrolling on EVERY single page and sub-view** of the application (`Books Catalog`, `Almaris & Shelves`, `Barcode Station`, `Circulation Desk`, `Borrowers & Faculty`, `Reports & Audits`, `Excel & PC Migration`, `System Settings`, and all Modal dialogs).

---

```markdown
TASK: CRITICAL GLOBAL LAYOUT & SCROLLING FIX — LOCK THE LEFT SIDEBAR IN PLACE AND RESTORE SMOOTH VERTICAL SCROLLING (UP & DOWN) ON ALL 8 PAGES / VIEWS AND MODALS AT EVERY ZOOM SCALE (30%–125%)

Currently, vertical scrolling is broken across ALL pages of the application while the left navigation sidebar scrolls out of place. This is caused by conflicting `overflow-hidden` / `h-screen` / `h-full` rules in `index.html`, `App.tsx` (or `Layout.tsx`), `Sidebar.tsx`, and the individual view containers (`BooksCatalogView.tsx`, `AlmariView.tsx`, `BarcodeStationView.tsx`, `CirculationDeskView.tsx`, `BorrowersView.tsx`, `ReportsView.tsx`, `ExcelMigrationView.tsx`, `SettingsView.tsx`).

Apply the following exact structural fixes across `index.html`, `App.tsx` / `Layout.tsx`, `Sidebar.tsx`, and ALL 8 page view components:

---

### 1. GLOBAL VIEWPORT, ZOOM COMPENSATION & SCROLLBAR ENGINE (`index.html` / `index.css`)
Replace the conflicting `html, body, #root` overflow rules in `index.html` with this exact ruleset so the outer desktop frame stays locked to the screen while the right-hand `<main id="ulm-main-scroll-view">` container scrolls smoothly on every page and at every CSS zoom level (`30%` to `125%`):

```css
/* ============================================================================
   1. LOCK OUTER DESKTOP FRAME & ENABLE SMOOTH INNER WORKSPACE SCROLLING
   ============================================================================ */
html, body {
  width: 100% !important;
  height: 100% !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
}

#root {
  width: 100% !important;
  height: 100dvh !important;
  max-height: 100dvh !important;
  overflow: hidden !important;
  display: flex !important;
  flex-direction: column !important;
}

/* Primary Scrollable Workspace Container (Used by ALL 8 Pages) */
#ulm-main-scroll-view,
.ulm-page-scroll-container {
  flex: 1 1 0% !important;
  min-height: 0 !important;
  min-width: 0 !important;
  height: 100% !important;
  overflow-y: auto !important;
  overflow-x: hidden !important;
  overscroll-behavior-y: contain !important;
  -webkit-overflow-scrolling: touch !important;
  pointer-events: auto !important;
  scrollbar-width: thin;
  scrollbar-color: rgba(84, 26, 114, 0.45) rgba(15, 23, 42, 0.05);
}

#ulm-main-scroll-view::-webkit-scrollbar,
.ulm-page-scroll-container::-webkit-scrollbar {
  width: 9px;
  height: 9px;
}
#ulm-main-scroll-view::-webkit-scrollbar-track,
.ulm-page-scroll-container::-webkit-scrollbar-track {
  background: rgba(15, 23, 42, 0.04);
  border-radius: 9999px;
}
#ulm-main-scroll-view::-webkit-scrollbar-thumb,
.ulm-page-scroll-container::-webkit-scrollbar-thumb {
  background: rgba(84, 26, 114, 0.40);
  border-radius: 9999px;
  border: 2px solid transparent;
  background-clip: padding-box;
}
#ulm-main-scroll-view::-webkit-scrollbar-thumb:hover,
.ulm-page-scroll-container::-webkit-scrollbar-thumb:hover {
  background: rgba(188, 136, 27, 0.85);
}

/* Background Watermark & Ambient Layers MUST NEVER Block Mouse-Wheel Scrolling */
#app-bg-watermark,
#ulm-liquid-orbs,
#ulm-eye-comfort-veil,
.ulm-app-bg-watermark,
div.fixed.inset-0.pointer-events-none {
  pointer-events: none !important;
  user-select: none !important;
}
```

---

### 2. FIX MASTER APP SHELL FLEX HIERARCHY (`App.tsx` / `Layout.tsx`)
In `App.tsx` (and `Layout.tsx` if present), update the outer layout wrapper so that:
- The **Top Title Bar + University Header** are `shrink-0` (fixed at the top).
- The **Workspace Row** below the header has `flex-1 min-h-0 w-full flex flex-row overflow-hidden relative`.
- The **Left Sidebar (`<Sidebar />`)** is `shrink-0 h-full min-h-0 overflow-hidden` (fixed in place on the left).
- The **Right Main Workspace (`<main id="ulm-main-scroll-view">`)** is the single unified vertical scroll container for **all pages**, and automatically resets its scroll position to the top (`scrollTop = 0`) whenever `activeTab` changes:

```tsx
// Inside App.tsx / Layout.tsx:
const mainScrollRef = React.useRef<HTMLElement | null>(null);

React.useEffect(() => {
  if (mainScrollRef.current) {
    mainScrollRef.current.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }
}, [activeTab]);

return (
  <div
    className="w-full flex flex-col overflow-hidden bg-[#F4F6FA] dark:bg-[#0B1220] text-slate-900 dark:text-slate-100 select-none"
    style={{
      // Compensate height if CSS zoom is applied so 100% of the window height is always scrollable
      height: appZoom && appZoom !== 1 ? `calc(100dvh / ${appZoom})` : '100dvh',
      maxHeight: appZoom && appZoom !== 1 ? `calc(100dvh / ${appZoom})` : '100dvh',
    }}
  >
    {/* 1. Fixed Top Bars (Windows TitleBar + Primary University Header) */}
    <div className="shrink-0 z-30">
      <WindowsTitleBar />
      <PrimaryHeader ... />
    </div>

    {/* 2. Main Desktop Body Row (MUST have flex-1, min-h-0, overflow-hidden) */}
    <div className="flex-1 min-h-0 w-full flex flex-row overflow-hidden relative">
      
      {/* 2A. Fixed Left Navigation Sidebar (Never scrolls out of place) */}
      <Sidebar ... />

      {/* 2B. Scrollable Right Page Workspace (Scrolls ALL 8 Pages Smoothly!) */}
      <main
        id="ulm-main-scroll-view"
        ref={mainScrollRef}
        className="ulm-page-scroll-container flex-1 min-w-0 min-h-0 h-full overflow-y-auto overflow-x-hidden relative z-10 p-4 md:p-6"
      >
        <div className="w-full max-w-[1600px] mx-auto pb-20 flex flex-col gap-5">
          {/* Active Page View (BooksCatalogView, AlmariView, BarcodeStationView, CirculationDeskView, BorrowersView, ReportsView, ExcelMigrationView, SettingsView) */}
          {renderActivePageView()}
        </div>
      </main>

    </div>
  </div>
);
```

---

### 3. LOCK THE LEFT SIDEBAR IN PLACE (`Sidebar.tsx`)
Update `Sidebar.tsx` so the sidebar stays 100% fixed on the left side of the screen and its top header and bottom buttons (`System Settings` and `Collapse Sidebar`) never scroll away or float up:
```tsx
<aside
  className={`${
    isCollapsed ? 'w-20' : 'w-64'
  } shrink-0 h-full min-h-0 flex flex-col justify-between bg-[#F4EFE6]/95 dark:bg-[#0E1525]/95 backdrop-blur-md border-r border-stone-200/80 dark:border-white/10 select-none overflow-hidden transition-all duration-200 z-20`}
>
  {/* 1. Pinned Top Sidebar Header ("NAVIGATION") */}
  <div className="shrink-0 px-4 py-3 border-b border-stone-200/70 dark:border-white/10 flex items-center justify-between">
    {/* NAVIGATION title + collapse icon */}
  </div>

  {/* 2. Middle Navigation Items (Pinned in place; only scrolls internally if screen height < 480px) */}
  <nav className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-3 px-2.5 space-y-4 scrollbar-none">
    {/* CATALOG & INVENTORY, CIRCULATION, ADMINISTRATION buttons */}
  </nav>

  {/* 3. Pinned Bottom Footer ("System Settings" & "Collapse Sidebar") */}
  <div className="shrink-0 border-t border-stone-200/80 dark:border-white/10 bg-[#EFE9DE]/90 dark:bg-[#090D16]/90 p-2.5 space-y-1">
    {/* System Settings button + Collapse Sidebar button */}
  </div>
</aside>
```

---

### 4. REMOVE SCROLL-BLOCKING `h-full overflow-hidden` / `h-screen overflow-hidden` FROM ALL 8 PAGE VIEWS
Currently, individual page components have `h-full overflow-hidden` or `max-h-full overflow-hidden` on their outer wrapper `<div>`, which clips the page content and blocks `<main id="ulm-main-scroll-view">` from scrolling!
Update **every single page view component** below so its root wrapper uses `w-full h-auto min-h-0 flex flex-col gap-5 pb-12 overflow-visible` (NEVER `h-full overflow-hidden` or `h-screen overflow-hidden`):

1. **Page 1 — `BooksCatalogView.tsx` (`Books Catalog` — List View, Grid View, Almari View, Analytics)**:
   - Remove `h-full overflow-hidden` from the root `<div>` of `BooksCatalogView.tsx` and from the Grid View / List View wrappers.
   - Change the root wrapper to `<div className="w-full h-auto flex flex-col gap-5 pb-12">`.
   - Ensure the **Grid View** card grid (`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4`), **List View** table, and the bottom **Pagination Bar** (`Showing 1–50 of 20,000 books • Previous / Page 1 of 400 / Next`) flow naturally inside `<main>` so the user can scroll all the way down to the last row and pagination buttons.
2. **Page 2 — `AlmariView.tsx` (`Almaris & Shelves` & Single Almari Shelf Inspector)**:
   - Remove `h-full overflow-hidden` from `AlmariView.tsx` and from the Single Almari Inspector view (`Shelf 1`–`Shelf 5` list).
   - Change the root wrapper to `<div className="w-full h-auto flex flex-col gap-5 pb-12">` so all 20+ Almari cards (`A-01` to `A-20`) and all 5 Shelf racks scroll smoothly from top to bottom.
3. **Page 3 — `BarcodeStationView.tsx` (`Barcode Station`)**:
   - Remove `h-full overflow-hidden` from `BarcodeStationView.tsx`.
   - Allow the scanner bar, the 2-column **Scanned Borrower ID Card + Scanned Book Desk**, and the **Recent Scan Log** table below it to scroll vertically without clipping.
4. **Page 4 — `CirculationDeskView.tsx` (`Circulation Desk & Loan Registry`)**:
   - Remove `h-full overflow-hidden` from `CirculationDeskView.tsx`.
   - Allow the 4 KPI cards (`ALL LOANS`, `ACTIVE LOANS`, `OVERDUE`, `RETURNED`), search/filter bar, and the full list of Loan Cards to scroll smoothly down the page.
5. **Page 5 — `BorrowersView.tsx` (`Borrowers & Faculty`)**:
   - Remove `h-full overflow-hidden` from `BorrowersView.tsx` so the member KPI cards, filter bar, and Borrower/Faculty member cards grid/table scroll vertically all the way to the bottom pagination bar.
6. **Page 6 — `ReportsView.tsx` (`Reports & Audits` — Overview, Circulation, Collection, Overdue & Fines, Data Health)**:
   - Remove `h-full overflow-hidden` from `ReportsView.tsx` and all 5 sub-tab panels so all analytics charts, financial valuation tables, and audit trail logs scroll smoothly from top to bottom.
7. **Page 7 — `ExcelMigrationView.tsx` (`Excel & PC Migration` — Import Books, Move to Another PC, Export Spreadsheets)**:
   - Remove `h-full overflow-hidden` from `ExcelMigrationView.tsx` so all import dropzones, validation error reports, 3-step PC migration cards, and 5 spreadsheet export cards are 100% scrollable.
8. **Page 8 — `SettingsView.tsx` (`System Settings & Workstation Configuration`)**:
   - Remove `h-full overflow-hidden` from `SettingsView.tsx` so all 4 enterprise configuration cards (`Appearance & Display Scaling`, `Institutional Identity`, `Barcode Scanner & Peripherals`, and `Library Folder Storage & Data Maintenance` including `Clear Demo Data` and `Reset App`) scroll smoothly to the very bottom.

---

### 5. ENSURE ALL OPEN MODAL DIALOGS ALSO SCROLL SMOOTHLY (`AddBookModal`, `EditBookModal`, `BookDetailsModal`, `BorrowerModal`, `BarcodeStudioModal`, `ExcelImportModal`)
- On every Modal dialog box, wrap the modal panel with `max-h-[88dvh] flex flex-col overflow-hidden` where:
  * The **Modal Header** is `shrink-0`,
  * The **Modal Body** has `flex-1 min-h-0 overflow-y-auto custom-scrollbar p-5`, and
  * The **Modal Footer** (`Cancel` / `Save` / `Print`) is `shrink-0` pinned at the bottom, so even on small laptop screens or high zoom levels (`115%`–`125%`), modal forms never get cut off.
```