# University of Lakki Marwat (ULM) Library — Almari & Shelves (`AlmariView.tsx`) Complete Fix & Liquid-Glass Upgrade Prompt

Copy and paste the prompt below directly into **Google AI Studio**. It fixes **every visual, data-binding, theme contrast, book-spine rendering, and navigation bug** in the **Almaris & Shelves (`AlmariView.tsx`)** module—along with the **Translucent Liquid-Glass Header & Sidebar** and **White Glass card contrast fixes** observed in your screenshots (`3.png`, `14.png`, `15.png`, `a2.png`, `a3.png`, and `Screenshot 2026-10-21 033650.png`–`033846.png`).

## Summary of Bugs Fixed by This Prompt

| # | Bug Seen in Screenshots | Root Cause | Exact Fix Implemented |
| :--- | :--- | :--- | :--- |
| **1** | **All 5,000 books stuck in `"No Almari (Unassigned)"` while `A-01`–`A-05` show `0 / 600 Vol (EMPTY)`** (`3.png`, `a2.png`, `a3.png`) | Catalog books store `almari: "Stack-01"` / `shelf: "Row 1"` or discipline names, while `AlmariView.tsx` checks `book.almari_id === "A-01"` with strict equality. | Adds `resolveBookAlmariAndShelf()` to automatically map `Stack-01`/`ALM-01`/`1` and Academic Disciplines (`Computer Science` → `A-01`, `Mathematics` → `A-02`, `Islamic Studies` → `A-03`, `Urdu/Pashto` → `A-04`, `General/Law` → `A-05`) across `Shelf 1`–`Shelf 5`, plus a 1-click **`[⚡ Auto-Organize All Books into Almaris]`** button. |
| **2** | **Sidebar highlights `Books Catalog 5000` while viewing `Almaris & Shelves`** (`3.png`, `a2.png`, `a3.png`, `033650.png`) | `BooksCatalogView` renders an internal `Almari View` mode or `App.tsx` doesn't sync `activeTab = 'almaris'`. | Synchronizes `activeTab === 'almaris'` in `App.tsx` and `Sidebar.tsx` so viewing any Almari Overview or Single Almari Inspector always highlights **`Almaris & Shelves`** in the royal purple-and-gold glass capsule. |
| **3** | **White-on-White Invisible Titles & Pitch-Black Inner Cards in White Glass Mode** (`a2.png`, `a3.png`, `033650.png`) | Almari titles (`Computer Science & Systems`) and `Edit` buttons use hardcoded `text-white`, while the top banner, `No Almari` card, and `Shelf Rack Inspector` boxes use hardcoded `bg-[#0B1220]` / `bg-black/60`. | Replaces hardcoded dark/white classes with theme-aware Liquid Glass classes (`bg-white/85 dark:bg-[#140D22]/75`, `text-slate-900 dark:text-white`, `border-[#C8963E]/35 dark:border-white/10`) and crisp `Delete Almari` danger button contrast (`bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300`). |
| **4** | **Duplicate `+ Add Almari` Buttons & Overlapping Search Icon on `"Find a book..."`** (`3.png`, `14.png`, `a2.png`, `033650.png`) | Two `+ Add Almari` buttons render in the header and filter bar, and the `<Search />` icon lacks `pl-10` padding so it collides with the `"F"` in `"Find"`. | Removes the duplicate `+ Add Almari` button, gives all search inputs `pl-10 pr-4` with `left-3.5 top-1/2 -translate-y-1/2 pointer-events-none` on the icon, and widens the Range Lookup input (`e.g. 1-500 or 0092...`). |
| **5** | **Dull Gray Book Spines, Giant Empty Shelf Boxes & `"No group"` in Almari Table** (`14.png`, `15.png`, `033650.png`) | Books with missing `group` fall back to `#666` gray bars with tiny dots, and empty shelves force a `160px` vertical height per shelf. | Renders color-coded 3D library book spines with gold foil bands and readable vertical Call No / Accession labels, collapses empty shelves into sleek `56px` bars, and resolves every book's Discipline Group badge in the bottom table. |
| **6** | **Translucent Liquid-Glass Header, Sidebar, Ambient Glow & Settings Cards** (`033728.png`–`033846.png`) | Header/sidebar mismatch in Dark Mode and pitch-black Settings cards (`Campus System Preferences`, `Institutional Identity`, `Library Folder`) with dark-blue text in White Mode. | Applies unified Translucent Liquid-Glass surfaces to `PrimaryHeader.tsx`, `Sidebar.tsx`, and `App.tsx`, and converts all remaining black cards in `SettingsView.tsx` to high-contrast light/dark surfaces. |

## Copy-Paste Prompt for Google AI Studio

```markdown
TASK: COMPLETE OVERHAUL & BUG FIX FOR ALMARIS & SHELVES (`AlmariView.tsx`), TRANSLUCENT LIQUID-GLASS HEADER & SIDEBAR (`PrimaryHeader.tsx`, `Sidebar.tsx`, `App.tsx`), CATALOG SEARCH INPUT (`BooksCatalogView.tsx`), AND WHITE-MODE SETTINGS CARDS (`SettingsView.tsx`)

Please update `src/components/AlmariView.tsx`, `src/components/PrimaryHeader.tsx`, `src/components/Sidebar.tsx`, `src/App.tsx`, `src/components/BooksCatalogView.tsx`, `src/components/SettingsView.tsx`, and `src/services/libraryStorageAndMigration.ts` to fix all visual, data-binding, contrast, and layout bugs shown in the screenshots:

================================================================================
1. FIX ALMARI DATA BINDING & AUTO-ALLOCATION SO ALL 5,000+ BOOKS MAP TO ALMARIS & SHELVES (`AlmariView.tsx` & `libraryStorageAndMigration.ts`)
================================================================================
1. **Smart Almari & Shelf Resolution (`resolveBookAlmariAndShelf`)**:
   - Currently, catalog books have values such as `almari: "Stack-01"`, `shelf: "Row 1"`, `almari: "ALM-01"`, or only a `category` / `discipline` (`"General"`, `"Computer Science"`, `"Islamic Studies"`, `"Urdu"`, etc.), causing all 5,000 books to fall into `"No Almari (Unassigned)"` while `A-01` through `A-05` show `0 / 600 Vol (EMPTY)`.
   - Create and use a deterministic helper `resolveBookAlmariAndShelf(book, index, almaris)` in `AlmariView.tsx` and `libraryStorageAndMigration.ts`:
     * **Direct Code / Alias Match**: Normalize codes so `"A-01"`, `"ALM-01"`, `"Stack-01"`, `"Almari 1"`, `"Cupboard 1"`, and `"1"` all match Almari `A-01` (and similarly `02` → `A-02`, `03` → `A-03`, `04` → `A-04`, `05` → `A-05`).
     * **Discipline / Subject Fallback Match**: If a book's `almari` is unset, `"Unassigned"`, or `"Stack-01"` default seed data, map it automatically by its `discipline` / `category` / `group` / `language`:
       - **Almari `A-01` (`Computer Science & Systems`)**: `Computer Science`, `Information Systems`, `Software`, `IT`, `Engineering`, `Technology`, `AI`, `Data Science`.
       - **Almari `A-02` (`Mathematics & Pure Sciences`)**: `Mathematics`, `Physics`, `Chemistry`, `Biology`, `Botany`, `Zoology`, `Statistics`, `Pure Sciences`.
       - **Almari `A-03` (`Islamic Studies & Humanities`)**: `Islamic Studies`, `Islamiyat`, `History`, `Arabic`, `Philosophy`, `Political Science`, `Sociology`, `Humanities`.
       - **Almari `A-04` (`Urdu & Pashto Literature`)**: `Urdu`, `Pashto`, `Persian`, `English`, `Literature`, `Poetry`, `Linguistics` (or books whose `language` is `Urdu` or `Pashto`).
       - **Almari `A-05` (`General Reference & Law`)**: `Law`, `Corporate Governance`, `Education`, `Economics`, `Business`, `Management`, `General`, `General Reference`, and any remaining general titles.
     * **Balanced Shelf Distribution (`Shelf 1` – `Shelf 5`)**:
       - Normalize shelf values (`"Row 1"` / `"Stack-01"` / `"S1"` / `"1"` → `"Shelf 1"`, `"Row 2"` → `"Shelf 2"`, etc.).
       - When distributing books into an Almari with 5 shelves (`Shelf 1` to `Shelf 5`, capacity 120 books per shelf = 600 Vol per Almari, or dynamic capacity for larger collections), assign shelves evenly (`Shelf ${((serialNo - 1) % 5) + 1}`) whenever an explicit shelf `1..5` wasn't manually overridden, so books are balanced across `Shelf 1` through `Shelf 5`.
   - **Never Show `"No group"` in the Almari Table (`15.png`)**:
     * Ensure every book has a resolved `displayGroup` (`book.group || book.discipline || book.category || almari.defaultGroup || 'General Reference'`) so the `BOOK GROUP` column in `"All Books in this Almari"` always renders a crisp, color-coded discipline badge instead of italic `"No group"`.
   - **One-Click `[⚡ Auto-Assign Shelves]` Button**:
     * In the `AlmariView` top toolbar (and inside the `No Almari (Unassigned)` banner if any books are unassigned), provide a **`[⚡ Auto-Organize Books into Almaris]`** button that persists the resolved `almari_id`, `almari_code` (`A-01`–`A-05`), `shelf_no` (`Shelf 1`–`Shelf 5`), and `group` back to SQLite / IndexedDB and broadcasts `'ulm-library-data-changed'`.
     * If `No Almari (Unassigned)` has `0` books, **hide** the giant empty `"No Almari (Unassigned)"` card completely (or show a compact 1-line green badge: `"✓ All 5,000 volumes are assigned to physical Almaris & Shelves"`).

================================================================================
2. FIX SIDEBAR ACTIVE TAB HIGHLIGHTING WHEN VIEWING `ALMARIS & SHELVES` (`App.tsx`, `Sidebar.tsx`, `BooksCatalogView.tsx`)
================================================================================
1. **Strict Active Route Synchronization (`3.png`, `a2.png`, `a3.png`, `033650.png`)**:
   - In `App.tsx`, ensure that when `activeTab === 'almaris'` (or when the user clicks `[Almari View]` from `BooksCatalogView.tsx` or clicks an Almari location badge like `A-01 · Shelf 1` in the catalog table), `activeTab` is set to `'almaris'`.
   - Remove the embedded duplicate `<AlmariView />` render inside `BooksCatalogView.tsx`; clicking `Almari View` in `BooksCatalogView` must call `onNavigateToAlmaris()` so there is only **one** canonical `Almaris & Shelves` screen and the Left Sidebar **always** highlights **`Almaris & Shelves`** (and never leaves `Books Catalog 5000` highlighted while inside `AlmariView`).

================================================================================
3. REDESIGN `AlmariView.tsx` TOOLBAR, OVERVIEW CARDS & SINGLE ALMARI INSPECTOR (BOTH WHITE GLASS & DARK GLASS MODES)
================================================================================
1. **Clean Single Toolbar with Zero Overlapping Icons (`3.png`, `14.png`, `a2.png`, `033650.png`)**:
   - **Remove Duplicate `+ Add Almari` Button**: Keep only **ONE** `+ Add Almari` primary gold CTA button (`bg-gradient-to-r from-[#C8963E] to-[#A67522] text-white font-semibold px-4 h-10 rounded-xl shadow-sm`) in the top-right header of `AlmariView.tsx`. Remove the second `+ Add Almari` button from the filter row.
   - **Fix Overlapping Search Icon in `"Find a book (Title, Author, Barcode)"` & `"Search almaris..."`**:
     * Wrap each search input in `<div className="relative flex-1 min-w-[240px]">`.
     * Position `<Search className="w-4 h-4 text-slate-400 dark:text-slate-400 pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" />`.
     * Add `pl-10 pr-4 h-10 w-full rounded-xl bg-white/90 dark:bg-[#1A1429]/90 border border-slate-200/90 dark:border-white/10 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#C8963E]/50` so the magnifying glass icon **never** touches or overlaps the `"F"` in `"Find"` or `"S"` in `"Search"`.
   - **Fix Truncated `"Range lookup (e.g. ULM-0000..."` Input**:
     * Give the Range Lookup input `w-56 sm:w-64 pl-9 pr-3 h-10` with a `<Hash className="w-4 h-4 text-slate-400 pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" />` icon and clear placeholder `"Range (e.g. 1-500)"`.

2. **Fix White Glass Contrast on Almari Overview Cards (`a2.png`)**:
   - **Top Page Banner (`Physical Cupboards & Shelves`)**:
     * Replace the pitch-black background (`bg-[#0B1220]`) with a theme-aware Liquid Glass card:
       `bg-white/80 dark:bg-[#140D22]/80 backdrop-blur-xl border border-[#C8963E]/35 dark:border-white/10 rounded-2xl p-5 shadow-sm`
     * Title `Physical Cupboards & Shelves`: `text-xl font-bold text-slate-900 dark:text-white`.
     * Subtitle (`Organize books by Almari -> Shelf -> Book Group...`): `text-xs text-slate-600 dark:text-slate-300`.
   - **Almari Grid Cards (`A-01` through `A-05`)**:
     * Card container: `bg-white/85 dark:bg-[#161024]/85 backdrop-blur-xl border border-[#C8963E]/30 dark:border-white/10 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between`.
     * Almari Code Pill (`A-01`): `px-2.5 py-1 rounded-lg bg-[#541A72]/10 dark:bg-[#FFD147]/15 text-[#541A72] dark:text-[#FFD147] font-mono text-xs font-bold border border-[#541A72]/20 dark:border-[#FFD147]/30`.
     * Almari Name (`Computer Science & Systems`): **`text-base font-bold text-slate-900 dark:text-white`** (NEVER hardcoded `text-white`, which turns invisible on white cards in `a2.png`!).
     * Location & Shelf subtitle (`Main Hall — North Wall · 5 Shelves`): `text-xs text-slate-500 dark:text-slate-400`.
     * `Edit` button on card: `px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-white/10 dark:hover:bg-white/15 dark:text-slate-200 border border-slate-200/80 dark:border-white/10`.
     * **Inner `SHELF RACK INSPECTOR` Mini-Box**:
       - Replace the pitch-black box (`bg-black/60` in `a2.png`) with `bg-slate-50/90 dark:bg-[#0D0917]/80 border border-slate-200/80 dark:border-white/10 rounded-xl p-3 my-3`.
       - Render 5 crisp mini shelf progress bars (`S1`–`S5`) showing live book counts and color-coded spine indicators.
     * **Card Footer Availability & Action**:
       - Show live counts: e.g. `1,000 / 1,000 Vol` (or `120 / 600 Vol`), `Available` count in `text-emerald-700 dark:text-emerald-400 font-semibold`, `Issued` count in `text-amber-700 dark:text-amber-400`, and a crisp **`[Open Shelves →]`** button (`bg-[#541A72] hover:bg-[#3B1054] text-white dark:bg-[#C8963E] dark:hover:bg-[#b08130] dark:text-slate-950 font-semibold px-3.5 py-1.5 rounded-lg text-xs`).

3. **Fix Single Almari Detail View (`A-01 — Computer Science & Systems`) (`14.png`, `15.png`, `a3.png`, `033650.png`)**:
   - **Header & Group Pills**:
     * Back button `[← All Almaris]`: `bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 dark:bg-white/10 dark:text-white dark:border-white/10 px-3.5 py-2 rounded-xl text-xs font-semibold`.
     * Show **ONLY the discipline groups assigned to this Almari** (e.g., `Computer Science`, `Information Systems`, `Engineering` for `A-01`) plus a single `[All Groups in A-01]` filter pill and a compact `[+ Manage Groups]` popover button—do **not** dump all 15 library groups across the header row.
     * **`Delete Almari` Button Contrast Fix (`033650.png`)**: Style `Delete Almari` as `px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 dark:text-rose-300 dark:border-rose-800/60 transition-colors` so it never renders with muddy dark-gray fill in White Mode.
   - **Interactive Shelf Rack (`Shelf 1` to `Shelf 5`) & Realistic Color-Coded Book Spines**:
     * **Populated Shelf Row**:
       - Container: `bg-white/95 dark:bg-[#140E21]/90 border border-[#C8963E]/35 dark:border-white/10 rounded-2xl p-4 shadow-sm`.
       - Shelf Header: `Shelf 1` title (`text-sm font-bold text-slate-900 dark:text-white`), capacity badge (`24 / 120 books · 20% full`), and `[Filter table to this shelf]` button.
       - **Realistic Book Spines**: Instead of plain `#666` gray rectangles (`033650.png`), render each book on the shelf as an interactive 3D spine (`w-7 sm:w-8 h-28 rounded-t-sm cursor-pointer transition-transform hover:-translate-y-1.5 hover:scale-105 shadow-md flex flex-col items-center justify-between py-1.5 px-0.5 select-none relative group`) colored by its Discipline Group:
         * `Computer Science` / `IT`: Royal Purple (`bg-gradient-to-b from-[#541A72] to-[#38104D] text-white border-x border-white/15`)
         * `Mathematics` / `Physics` / `Science`: Deep Sapphire (`bg-gradient-to-b from-[#1E40AF] to-[#1E3A8A] text-white`)
         * `Islamic Studies` / `History` / `Arabic`: Emerald Archival (`bg-gradient-to-b from-[#047857] to-[#064E3B] text-white`)
         * `Urdu` / `Pashto` / `Literature`: Warm Amber Gold (`bg-gradient-to-b from-[#B45309] to-[#78350F] text-white`)
         * `Law` / `Governance` / `General`: Crimson Burgundy (`bg-gradient-to-b from-[#991B1B] to-[#7F1D1D] text-white`)
       - Each spine displays top & bottom 24K gold foil trim lines (`w-full h-[2px] bg-[#FFD147]/75`), a crisp vertical rotated Accession/Title label (`writing-mode: vertical-rl`, `text-[10px] font-mono font-semibold tracking-tight text-white/95 truncate max-h-[76px]`), and an availability status dot (`bg-emerald-400` for On Shelf, `bg-amber-400` for Issued). Hovering shows a rich tooltip with Full Title, Author, Accession No, Barcode, and Status; clicking opens the Book Details / Edit Modal.
       - If a shelf has more than 35 books, display the first 35 interactive spines plus a crisp **`[+ N more books on Shelf X — Click to view in table ↓]`** badge so rendering stays 60 FPS.
     * **Empty Shelf Row (`0 books`)**:
       - Collapse empty shelves into a sleek **`h-14` (`56px`) single-line bar** (`flex items-center justify-between px-4 py-2.5 rounded-xl bg-slate-50/80 dark:bg-white/[0.03] border border-dashed border-slate-300 dark:border-white/10`) showing `Shelf X · Empty (0 / 120 books)` and a `[+ Assign Books to Shelf X]` button—eliminating the giant `160px` empty boxes (`14.png`, `15.png`, `a3.png`).

================================================================================
4. TRANSLUCENT LIQUID-GLASS HEADER, MATCHING SIDEBAR, AMBIENT GLOW & CATALOG SEARCH ICON (`PrimaryHeader.tsx`, `Sidebar.tsx`, `App.tsx`, `BooksCatalogView.tsx`, `SettingsView.tsx`)
================================================================================
1. **Translucent Liquid-Glass Header (`PrimaryHeader.tsx`)**:
   - Replace the flat opaque fill with a frosted crystal glass surface (`bg-white/65 dark:bg-[#140D22]/68 backdrop-blur-2xl backdrop-saturate-200`) featuring a top specular highlight rim (`shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]`), a 24K gold bottom border (`border-b border-[#C8963E]/45 dark:border-[#FFD147]/25`), a double-rimmed glass pedestal for the official ULM 2017 crest (`ULM_OFFICIAL_CREST_DATA_URI`), and glassmorphic pill buttons (`bg-white/70 dark:bg-white/[0.07] backdrop-blur-md`) that stay sleek and never clip `+ Add Book`.
2. **Matching Translucent Liquid-Glass Sidebar (`Sidebar.tsx`)**:
   - Unify the sidebar tone with the header in both modes (`bg-white/60 dark:bg-[#120C1F]/65 backdrop-blur-2xl backdrop-saturate-200 border-r border-[#C8963E]/35 dark:border-white/10`) so Dark Mode no longer mixes a purple header with a flat gray sidebar, and style the active tab as a royal purple-and-gold glass capsule (`bg-gradient-to-r from-[#541A72]/90 to-[#3B1054]/90 text-white border border-[#FFD147]/55 shadow-md`) with frosted hover transitions on inactive items.
3. **Subtle Ambient Glow Behind Header & Sidebar (`App.tsx`)**:
   - Add soft, non-interactive radial gold and royal-purple ambient light orbs (`pointer-events-none fixed`) behind the top-left header/sidebar junction so the frosted glass visibly refracts warm institutional color in both White and Dark modes.
4. **Catalog Search Input Icon Fix (`BooksCatalogView.tsx`)**:
   - Add `pl-10` left padding and `left-3.5 top-1/2 -translate-y-1/2 pointer-events-none` on the magnifying glass icon so it never overlaps the `"S"` in `"Search title, author, barcode, accession, ISBN..."`.
5. **Fix Pitch-Black Cards in `SettingsView.tsx` in White Glass Mode (`033728.png`–`033846.png`)**:
   - In `SettingsView.tsx`, replace the hardcoded dark backgrounds (`bg-[#111318]`, `bg-[#0B1220]`, `bg-slate-900`) on the top banner (`Campus System Preferences & Hardware Configuration`) and on the `University of Lakki Marwat LMS Version 2.4.0`, `Institutional Identity & Campus Header Details`, `Barcode Scanner & Peripherals`, `Library Folder & Data Storage`, and `Data Maintenance & Reset Control` cards with `bg-white/90 dark:bg-[#140D22]/85 border border-slate-200/90 dark:border-white/10 text-slate-900 dark:text-white shadow-sm`, and change all dark-on-black field labels (`UNIVERSITY / INSTITUTION NAME`, `WORKSTATION NODE ID`, etc.) to `text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300`.
```
