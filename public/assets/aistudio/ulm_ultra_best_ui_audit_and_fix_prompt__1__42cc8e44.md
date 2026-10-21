# 🎨 ULM CENTRAL CAMPUS LIBRARY — PURE WHITE & DARK MODE UI FIX PROMPT (NO FEATURES REMOVED)

Copy and paste the prompt block below into **Google AI Studio**. It **preserves 100% of your existing screens, tabs, fields, and features** while fixing every visual, contrast, and layout bug across both **White Glass (`a1.png`–`a18.png`)** and **Dark Glass (`1.png`–`27.png`)** modes.

```markdown
TASK: FIX ONLY THE UI STYLING, CONTRAST, AND INPUT/LAYOUT ALIGNMENT IN BOTH WHITE GLASS (`html.light-theme`) AND DARK GLASS (`html.dark`) MODES ACROSS ALL SCREENS AND MODALS — DO NOT REMOVE ANY EXISTING SCREENS, TABS, BUTTONS, OR FEATURES

Keep 100% of existing views, sidebar items, sub-tabs, form fields, and features intact. Apply ONLY the 8 visual, contrast, and layout fixes below across `index.html`, `Sidebar.tsx`, `PrimaryHeader.tsx`, `BooksCatalogView.tsx`, `AlmariView.tsx`, `BarcodeStationView.tsx`, `CirculationDeskView.tsx`, `BorrowersView.tsx`, `ReportsView.tsx`, `ExcelMigrationView.tsx`, `SettingsView.tsx`, `BookDetailsModal.tsx`, `EditBookModal.tsx`, and `BorrowerModal.tsx`:

---

### 1. GLOBAL WHITE GLASS (`html.light-theme`) & DARK GLASS (`html.dark`) CONTRAST ENGINE (`index.html`)
Replace the broken `html.light-theme` CSS overrides in `index.html` with this complete ruleset so that:
- **No banner, card, modal, analytics chart, or settings panel stays pitch-black (`#14151a` / `#0b0f19`) with unreadable dark-navy text (`#0f172a`) in White Mode** (`a2.png`, `a3.png`, `a5.png`, `a7.png`–`a10.png`, `a13.png`, `a15.png`–`a18.png`).
- **No converted white/cream card ever renders invisible white-on-white text (`#ffffff` on `#ffffff`)** (`a1.png`, `a2.png`, `a5.png`, `a11.png`, `a12.png`, `a14.png`).

```css
/* ============================================================================
   ULM DUAL-THEME (WHITE GLASS & DARK GLASS) COMPLETE CONTRAST ENGINE
   ============================================================================ */
html.light-theme {
  --ulm-page-bg: #EEF2F7;
  --ulm-card-bg: rgba(255, 255, 255, 0.90);
  --ulm-card-elevated: rgba(248, 250, 252, 0.96);
  --ulm-input-bg: #FFFFFF;
  --ulm-border-subtle: rgba(15, 23, 42, 0.12);
  --ulm-border-strong: rgba(15, 23, 42, 0.22);
  --ulm-text-primary: #0F172A;
  --ulm-text-secondary: #334155;
  --ulm-text-muted: #475569;
  --ulm-gold-accent: #8F4F00;
}

html.light-theme body {
  background: linear-gradient(135deg, #F1F5F9 0%, #E6EDF5 50%, #F5F2EB 100%) !important;
  color: var(--ulm-text-primary) !important;
}

/* 1A. Convert ALL hardcoded dark backgrounds (banners, filter bars, cards, modals, settings panels,
       analytics charts, empty states) to crisp White Glass in Light Mode —
       EXCEPT intentional dark previews marked .ulm-preserve-dark */
html.light-theme [class*="bg-[#0"]:not(.ulm-preserve-dark):not(.ulm-preserve-dark *),
html.light-theme [class*="bg-[#1"]:not(.ulm-preserve-dark):not(.ulm-preserve-dark *),
html.light-theme [class*="bg-slate-9"]:not(.ulm-preserve-dark):not(.ulm-preserve-dark *),
html.light-theme [class*="bg-zinc-9"]:not(.ulm-preserve-dark):not(.ulm-preserve-dark *),
html.light-theme [class*="bg-neutral-9"]:not(.ulm-preserve-dark):not(.ulm-preserve-dark *),
html.light-theme [class*="bg-gray-9"]:not(.ulm-preserve-dark):not(.ulm-preserve-dark *),
html.light-theme [class*="bg-black/"]:not(.ulm-modal-backdrop):not(.ulm-preserve-dark):not(.ulm-preserve-dark *) {
  background-color: var(--ulm-card-bg) !important;
  background-image: linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(248,250,252,0.88) 100%) !important;
  border-color: var(--ulm-border-subtle) !important;
  color: var(--ulm-text-primary) !important;
  box-shadow: 0 8px 24px -6px rgba(15, 23, 42, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.95) !important;
}

/* Inner panels, Shelf Rack Inspector boxes, and table headers in Light Mode */
html.light-theme [class*="bg-slate-8"]:not(.ulm-preserve-dark):not(.ulm-preserve-dark *),
html.light-theme [class*="bg-zinc-8"]:not(.ulm-preserve-dark):not(.ulm-preserve-dark *) {
  background-color: #F1F5F9 !important;
  border-color: rgba(15, 23, 42, 0.14) !important;
  color: #0F172A !important;
}

/* 1B. Fix ALL white/light text classes on White Glass surfaces so nothing is invisible white-on-white */
html.light-theme .text-white:not(.ulm-preserve-dark *):not([class*="bg-purple-"]):not([class*="bg-[#541A72]"]):not([class*="bg-emerald-6"]):not([class*="bg-rose-6"]):not([class*="bg-amber-6"]),
html.light-theme .text-slate-50:not(.ulm-preserve-dark *),
html.light-theme .text-slate-100:not(.ulm-preserve-dark *),
html.light-theme .text-slate-200:not(.ulm-preserve-dark *),
html.light-theme .text-zinc-100:not(.ulm-preserve-dark *),
html.light-theme .text-zinc-200:not(.ulm-preserve-dark *) {
  color: #0F172A !important;
}

html.light-theme .text-slate-300:not(.ulm-preserve-dark *),
html.light-theme .text-zinc-300:not(.ulm-preserve-dark *) {
  color: #1E293B !important;
}

html.light-theme .text-slate-400:not(.ulm-preserve-dark *),
html.light-theme .text-slate-500:not(.ulm-preserve-dark *),
html.light-theme .text-zinc-400:not(.ulm-preserve-dark *),
html.light-theme .text-zinc-500:not(.ulm-preserve-dark *) {
  color: #475569 !important;
}

/* 1C. Unify ALL Form Inputs, Selects & Textareas in Light Mode (Fixes dull #8e96a4 gray inputs in a9, a10, a15, a17) */
html.light-theme input:not([type="checkbox"]):not([type="radio"]):not([type="range"]),
html.light-theme select,
html.light-theme textarea {
  background-color: #FFFFFF !important;
  color: #0F172A !important;
  border: 1.5px solid #CBD5E1 !important;
  box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.04) !important;
}
html.light-theme input::placeholder,
html.light-theme textarea::placeholder {
  color: #64748B !important;
}

/* 1D. Protect Intentional Dark Previews (3D Book Cover in Book Details Modal & CR80 Live ID Card Preview) */
.ulm-preserve-dark {
  background: linear-gradient(145deg, #0F172A 0%, #1E1B4B 55%, #2E1065 100%) !important;
  color: #F8FAFC !important;
  border-color: rgba(188, 136, 27, 0.55) !important;
}
html.light-theme .ulm-preserve-dark h1,
html.light-theme .ulm-preserve-dark h2,
html.light-theme .ulm-preserve-dark h3,
html.light-theme .ulm-preserve-dark h4,
html.light-theme .ulm-preserve-dark p,
html.light-theme .ulm-preserve-dark span,
html.light-theme .ulm-preserve-dark div {
  color: #F8FAFC !important;
}
html.light-theme .ulm-preserve-dark .ulm-cover-gold {
  color: #FDE68A !important;
}
```

---

### 2. FIX LEFT SIDEBAR CONTRAST, ACTIVE HIGHLIGHT & COUNT BADGES IN BOTH MODES (`Sidebar.tsx`)
- **Inactive Sidebar Items**: Style with `text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/5 font-medium` so links are never washed-out in White Mode (`a1.png`–`a18.png`).
- **Active Sidebar Item**: Style with `bg-[#541A72] !text-white border border-[#BC881B]/60 shadow-sm` (and keep child text `#FFFFFF` and active count badge `#FFD147` in both modes).
- **Inactive Count Badges (`5,000`, `20`, `1`)**: Style with `bg-slate-200/90 text-slate-800 border border-slate-300 dark:bg-slate-800 dark:text-slate-200 font-mono text-xs font-semibold` so they never render as pitch-black circles in White Mode (`a1.png`–`a18.png`).

---

### 3. FIX BOOKS CATALOG LIST & GRID VIEW CONTRAST IN WHITE & DARK MODES (`1.png`, `2.png`, `a1.png`, `a14.png` — `BooksCatalogView.tsx`)
- **Fix Invisible Barcodes in List View (`a14.png`)**:
  * In the `BARCODE / CALL NO` column, style the 13-digit barcode (`0092000005000`) with `font-mono text-xs font-bold text-slate-900 dark:text-slate-100` (fixing the white-on-white invisible barcode in `a14.png`) and the Call Number (`000 ULM`) below it with `font-mono text-[11px] font-semibold text-amber-700 dark:text-amber-400`.
- **Fix Grid Card Contrast in Both Modes (`2.png`, `a1.png`)**:
  * Style card shells with `bg-white/90 dark:bg-[#131B2E] border border-slate-200/80 dark:border-white/10 rounded-2xl p-4 shadow-sm`.
  * Style inner metadata boxes (`Added: date`, barcode box, and footer) with `bg-slate-50 dark:bg-[#0B1220] border border-slate-200/80 dark:border-white/10 text-slate-800 dark:text-slate-200`.

---

### 4. FIX ALMARIS & SHELVES + ALMARI INSPECTOR UI IN WHITE & DARK MODES (`3.png`, `14.png`, `15.png`, `a2.png`, `a3.png` — `AlmariView.tsx`)
- **Fix Duplicate `+ Add Almari` Button & Overlapping Search Icons (`3.png`, `a2.png`)**:
  * Keep only ONE `+ Add Almari` button in the top-right header (fixing the two identical stacked gold buttons in `3.png` and `a2.png`).
  * Add `pl-10` padding to both `"Find a book (Title, Author, Barcode)..."` and `"Search almaris..."` inputs, with the `<Search />` icon positioned at `left-3.5 top-1/2 -translate-y-1/2 pointer-events-none` so the magnifying glass never overlaps the placeholder text.
- **Fix Almari Cards & Shelf Inspector in White Mode (`a2.png`, `a3.png`)**:
  * Style the top banner (`Physical Cupboards & Shelves`), filter bar, `No Almari (Unassigned)` card, and Single Almari Inspector container (`a3.png`) with `bg-white/90 dark:bg-[#131B2E] border border-slate-200/80 dark:border-white/10 text-slate-900 dark:text-white`.
  * Style Almari card titles (`Computer Science & Systems`, `Mathematics & Pure Sciences`, etc.) with `text-slate-900 dark:text-white font-bold text-base` (fixing the white-on-white invisible titles in `a2.png`).
  * Style `EMPTY` / `OPTIMAL` badges and `Edit` buttons with `bg-slate-100 text-slate-800 border border-slate-300 dark:bg-slate-800 dark:text-slate-200` so they are clearly visible on white cards.
  * Style the 5 Shelf boxes (`Shelf 1`–`Shelf 5` in `14.png`, `15.png`, `a3.png`) with `bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white`.

---

### 5. FIX BARCODE STATION & CIRCULATION DESK UI IN WHITE & DARK MODES (`16.png`, `17.png`, `a4.png`, `a5.png`)
- **Barcode Scanner Station (`BarcodeStationView.tsx` — `16.png`, `a4.png`)**:
  * Style both the left `Live Borrower ID Card Desk` and right `Live Scanned Book Desk` outer cards with matching `bg-white/90 dark:bg-[#131B2E] border border-slate-200/80 dark:border-white/10 text-slate-900 dark:text-white` so the left panel is not dark charcoal in White Mode (`a4.png`), while keeping `.ulm-preserve-dark` on the inner CR80 ID Card graphic.
- **Circulation Desk KPI Counters & Banner (`CirculationDeskView.tsx` — `17.png`, `a5.png`)**:
  * Style the top banner, search bar, and all 4 KPI cards (`ALL LOANS`, `ACTIVE LOANS`, `OVERDUE`, `RETURNED`) with `bg-white/90 dark:bg-[#131B2E] border border-slate-200/80 dark:border-white/10`.
  * Style the 4 large KPI numbers (`1`, `1`, `0`, `0`) with `text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums` and labels with `text-slate-600 dark:text-slate-400 font-bold text-xs` so they are never invisible white-on-white (`a5.png`).

---

### 6. FIX ALL MODALS & INPUT ICON CLIPPING IN BOTH MODES (`6.png`–`12.png`, `19.png`, `a8.png`–`a10.png`, `a15.png`–`a17.png`)
- **Fix Modal Backgrounds, Titles & Labels in White Mode (`EditBookModal.tsx`, `BorrowerModal.tsx`, `MemberDossierModal.tsx`, `BookDetailsModal.tsx`)**:
  * Style all modal shells with `bg-white dark:bg-[#131B2E] border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white rounded-2xl shadow-2xl` so modals never stay pitch-black with unreadable dark-navy titles and labels (`a8.png`, `a9.png`, `a10.png`, `a15.png`, `a17.png`).
  * Style all `<label>` elements with `text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 block`.
- **Fix Floating Left Icons Clipping Input Text (`7.png`–`12.png`, `a9.png`, `a15.png`)**:
  * In `EditBookModal.tsx` and `BorrowerModal.tsx`, fix the small `#` / copy-link icon badges inside the top-left of inputs (`Author`, `Place of Pub.`, `Publisher`, `Date Added`, `Source`, `Full Name`, `Roll Number`) by either removing the overlapping inside-left badge or placing the icon cleanly in the label row above the input, and styling all inputs/selects uniformly:
    ```tsx
    className="w-full h-10 px-3.5 rounded-lg bg-white dark:bg-[#0B1220] border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-amber-600 outline-none text-sm"
    ```
  * This guarantees `"Arun Abbasi"`, `"Lakki Marwat"`, and `"ULM Press"` are never overlapped or clipped in Dark or White mode, and fixes the mismatched gray `#8e96a4` inputs vs. black dropdowns in `a15.png`.
- **Fix Book Details Modal & Live ID Card Preview (`6.png`, `a8.png`, `a9.png`)**:
  * Add `ulm-preserve-dark` to the **3D Book Cover** (`BookDetailsModal.tsx`) and **Live CR80 ID Card Preview** (`BorrowerModal.tsx`) so the book title, author (`by Arun Abbasi`), and `UNIVERSITY OF LAKKI MARWAT` card header stay crisp white (`#FFFFFF`) and gold (`#FDE68A`) in both themes.
  * Style the `Stack Location` pill in `BookDetailsModal.tsx` with `bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40`.

---

### 7. FIX REPORTS, ANALYTICS CHARTS & EXCEL MIGRATION TABS IN WHITE & DARK MODES (`4.png`, `5.png`, `20.png`–`23.png`, `a11.png`, `a12.png`, `a18.png`)
- **Catalog Visual Analytics & Reports (`ReportsView.tsx` — `4.png`, `20.png`, `a11.png`, `a18.png`)**:
  * Convert the Analytics banner and all 4 chart cards (`Volumes by Academic Discipline`, `Inventory Availability Rate`, `Publication Era`, `Library Stacks & Shelf Density`) to `bg-white/90 dark:bg-[#131B2E] border border-slate-200/80 dark:border-white/10` with `text-slate-900 dark:text-white font-bold` headings and `#475569` (`dark:text-slate-400`) chart labels so titles are never dark-navy on black (`a18.png`).
  * Style the inner `Stack-01` box inside `Library Stacks & Shelf Density` with `bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white`.
- **Excel & PC Migration Cards & Sub-Tabs (`ExcelMigrationView.tsx` — `21.png`–`23.png`, `a12.png`)**:
  * Style all cards across `Import Books` (`Book Entry Sheet Import`, `Full-Library Scaling`), `Move to Another PC` (`Steps 1–3`), and `Export Spreadsheets` with `bg-white/90 dark:bg-[#131B2E] border border-slate-200/80 dark:border-white/10` and `text-slate-900 dark:text-white` titles and `text-slate-600 dark:text-slate-300` descriptions (fixing the white-on-cream invisible text in `a12.png`).
  * Style active sub-tabs (`Overview`, `Import Books`, `Move to Another PC`, `Export Spreadsheets`) with `bg-[#541A72] !text-white font-semibold shadow-sm` and inactive sub-tabs with `bg-white/80 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300`.

---

### 8. FIX SYSTEM SETTINGS CARDS & SUB-TABS IN WHITE & DARK MODES (`24.png`–`27.png`, `a13.png` — `SettingsView.tsx`)
- Convert all 6 Settings cards (`Theme & Liquid Glass`, `Screen Resolution`, `Campus Identity`, `Storage Folder`, `Circulation Rules`, `Factory Reset`) and all Settings sub-tabs (`General & Theme`, `Book Groups`, `Almaris & Shelves`, `Book Sheets Sync`) in `SettingsView.tsx` to `bg-white/90 dark:bg-[#131B2E] border border-slate-200/80 dark:border-white/10 text-slate-900 dark:text-white` so none of the 6 settings panels remain pitch-black with unreadable dark-navy headings in White Mode (`a13.png`).
```
