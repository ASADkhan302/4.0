# 🚀 ULM CENTRAL CAMPUS LIBRARY — UNIFIED MASTER PROMPT (TRANSPARENT OPENING SPLASH IN DARK & WHITE MODE + LOGO TRANSPARENCY + STORAGE GATE + UNIQUE BARCODES + SMART BARCODE STATION + WHITE MODE & SETTINGS OVERHAUL)

Copy and paste the single unified prompt block below into **Google AI Studio**. It updates the **Opening Splash Screen (`001714.png`)** so that **both Dark Mode and White Mode have a true Transparent / Frosted Crystal Glass look** (removing the ugly square gray box around the ULM Crest logo, making the splash backdrop & card genuinely transparent over the live workspace, and making the boot console a sleek transparent glass terminal instead of a solid white rectangle), alongside all workflow and UI fixes:

```markdown
TASK: IMPLEMENT THE COMPLETE UNIFIED PRODUCTION WORKFLOW & TRANSPARENT DARK/WHITE MODE FIXES FOR ULM CENTRAL CAMPUS LIBRARY —
(1) MAKE THE APP OPENING / BOOT SPLASH SCREEN, ULM CREST LOGO & BOOT CONSOLE 100% TRANSPARENT GLASS IN BOTH DARK MODE AND WHITE MODE (`001714.png`),
(2) FIRST-INSTALL & POST-FORMAT/RESET STORAGE LOCATION SETUP GATE,
(3) AUTO-UNIQUE 13-DIGIT BARCODES & SEQUENTIAL ACCESSION NUMBERS FOR ALL IMPORTED & DUPLICATE BOOKS,
(4) SMART TWO-WAY BARCODE STATION (BOOK-FIRST OR STUDENT-FIRST SCAN + INLINE ALMARI PLACEMENT + AUTO LOAN-DURATION PROMPT),
(5) FIX FULL-SCREEN WHITE MODE BLUR/DIM VEIL (`ee.png`), SOLID-WHITE MODAL BACKDROPS (`033520.png`), OVERLAPPING MODAL/ALMARI INPUT ICONS (`033520.png`, `033650.png`), AND REDESIGN `SettingsView.tsx` INTO A CLEAN 4-CARD ENTERPRISE LAYOUT (`033728.png`–`033846.png`)

Update `index.html`, `App.tsx`, `BootSplash.tsx` (or the boot intro component in `App.tsx`), `StorageSetupModal.tsx`, `BarcodeStationView.tsx`, `BooksCatalogView.tsx`, `AlmariView.tsx`, `EditBookModal.tsx`, `BorrowerModal.tsx`, `SettingsView.tsx`, and `src/services/libraryStorageAndMigration.ts` with all 7 requirements below:

---

### 1. MAKE THE APP OPENING / BOOT SPLASH SCREEN, ULM CREST LOGO & CONSOLE 100% TRANSPARENT GLASS IN BOTH DARK MODE & WHITE MODE (`001714.png` — `BootSplash.tsx` / `App.tsx`)
Locate the App Opening / Boot Splash component (`BootSplash.tsx`, `SplashScreen.tsx`, `OpeningIntro.tsx`, or the boot overlay in `App.tsx`). Currently in `001714.png`, the ULM Crest has a solid gray square box around it, the center card is an opaque slate block, and the inner console box is a solid blank white rectangle in both Dark Mode and White Mode. Replace it with a **true Transparent Glass look in BOTH Dark Mode and White Mode**:

1. **Full-Screen Transparent Glass Backdrop (`id="ulm-boot-splash"`)**:
   - Add `id="ulm-boot-splash"` and `className="ulm-preserve-glass fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 select-none transition-all duration-300"` to the root splash wrapper.
   - **In White Mode (`html.light-theme`)**: Use a **translucent crystal glass veil** (`bg-white/35 backdrop-blur-xl`) with subtle radial gold/purple ambient glow so the library workspace softly refracts through behind it.
   - **In Dark Mode (`html:not(.light-theme)`)**: Use a **translucent dark obsidian glass veil** (`bg-[#070B14]/45 backdrop-blur-xl`) so it has the exact same airy, transparent glass feel in Dark Mode too.

2. **Remove the Gray Square Box Around the ULM Crest Logo (`id="ulm-boot-logo"`)**:
   - The ULM Crest image in `001714.png` has non-transparent light-gray square corners around the circular seal.
   - Fix this permanently in **both** Dark Mode and White Mode by:
     a) Running a 1-time offscreen `<canvas>` pixel-transparency pass (or circular `clip-path: circle(45% at 50% 50%)` + `rounded-full overflow-hidden scale-[1.12]`) that strips the outer square gray background pixels (`RGB > 205` outside the circle) to `alpha = 0`, AND
     b) Rendering the crest inside a **floating transparent glass ring** with zero square background:
     ```tsx
     <div
       id="ulm-boot-logo"
       className="ulm-preserve-glass w-28 h-28 rounded-full bg-white/15 dark:bg-white/5 backdrop-blur-md border-2 border-[#BC881B]/70 shadow-[0_12px_36px_rgba(188,136,27,0.28)] flex items-center justify-center mx-auto mb-5 overflow-hidden p-0"
     >
       <img
         src={ULM_CREST_LOGO}
         alt="University of Lakki Marwat Crest"
         className="w-full h-full object-cover rounded-full scale-[1.14]"
         style={{ clipPath: 'circle(44.5% at 50% 50%)' }}
       />
     </div>
     ```

3. **Transparent Frosted Glass Center Workstation Card (`id="ulm-boot-card"`)**:
   - Add `id="ulm-boot-card"` and `className="ulm-preserve-glass w-full max-w-md rounded-3xl p-7 text-center transition-all"` to the center splash card.
   - **In White Mode**: `bg-white/45 backdrop-blur-2xl border border-white/80 shadow-[0_24px_60px_-15px_rgba(15,23,42,0.14),inset_0_1px_1px_rgba(255,255,255,0.9)]` (never an opaque dark-slate `#525866` block!).
   - **In Dark Mode**: `dark:bg-[#0F172A]/45 dark:backdrop-blur-2xl dark:border-white/20 dark:shadow-[0_24px_60px_-15px_rgba(0,0,0,0.65),inset_0_1px_1px_rgba(255,255,255,0.2)]`.
   - **Top Pill (`✨ CENTRAL CAMPUS WORKSTATION`)**:
     * `bg-[#541A72]/15 dark:bg-[#541A72]/35 text-[#541A72] dark:text-amber-300 border border-[#BC881B]/45 backdrop-blur-md px-3.5 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase inline-flex items-center gap-1.5`
   - **Main Title (`UNIVERSITY OF LAKKI MARWAT`)**:
     * `text-slate-900 dark:text-white font-extrabold tracking-tight text-xl mt-3`
   - **Subtitle (`Library Management System • Win32 Edition`)**:
     * `text-slate-600 dark:text-slate-300 text-xs font-medium mt-1`

4. **System Mounting Status Bar & Percentage (`7%` → `100%`)**:
   - Label (`System Mounting Status`): `text-[#541A72] dark:text-sky-300 font-semibold text-xs`
   - Percentage (`7%` → `100%`): `text-slate-900 dark:text-white font-mono font-bold text-xs`
   - Progress Track: `w-full h-2 rounded-full bg-slate-900/10 dark:bg-white/10 overflow-hidden backdrop-blur-sm`
   - Progress Fill: `h-full bg-gradient-to-r from-[#541A72] via-[#BC881B] to-emerald-500 transition-all duration-150`

5. **Fix the Blank White Box — Make the Boot-Log Console Transparent Glass (`id="ulm-boot-console"`)**:
   - Add `id="ulm-boot-console"` and `className="ulm-preserve-glass w-full rounded-2xl p-3.5 mt-4 font-mono text-[11px] text-left space-y-1.5 backdrop-blur-md transition-all"` to the inner log box so it **never** turns into a solid white rectangle (`001714.png`)!
   - **In White Mode**: Translucent frosted glass terminal (`bg-slate-900/10 border border-slate-900/15 text-slate-800`) with emerald status tags (`[OK]` in `text-emerald-700 font-bold`).
   - **In Dark Mode**: Translucent dark crystal terminal (`dark:bg-black/30 dark:border-white/15 dark:text-slate-200`) with luminous emerald status tags (`[OK]` in `dark:text-emerald-400 font-bold`).
   - Ensure the mounting log lines (`[OK] Mounting SQLite WAL Engine...`, `[OK] Verifying 17-Column Register...`, `[OK] Hydrating 50-Row Thumbnail Cache...`) render clearly inside `#ulm-boot-console` in both modes.

6. **Bottom Prompt (`Click anywhere or press Enter to launch`) & Top-Right `Skip [Enter] →` Button**:
   - Bottom prompt: `text-slate-600 dark:text-slate-300 font-mono text-xs mt-4 opacity-85`
   - Top-Right `Skip [Enter] →` button: `ulm-preserve-glass bg-white/55 hover:bg-white/80 text-slate-900 border border-slate-300/80 dark:bg-white/10 dark:hover:bg-white/20 dark:text-white dark:border-white/20 backdrop-blur-md px-4 py-1.5 rounded-xl text-xs font-semibold shadow-sm transition`

---

### 2. FIRST-INSTALL & POST-FORMAT/RESET STORAGE LOCATION SETUP GATE (`StorageSetupModal.tsx`, `App.tsx`, `SettingsView.tsx`)
- **Trigger Condition (Show ONLY on First Install or After Format/Reset)**:
  * Check `localStorage.getItem('ulm_storage_location_configured_v1')` on startup.
  * Show the **"System Storage & Library Asset Location Setup"** modal ONLY on first open after installation OR immediately after the user executes **`Format / Reset App`** in `SettingsView.tsx`.
  * Allow the librarian to select or confirm the local storage folder path where all library assets are stored:
    - Primary SQLite / IndexedDB database (`ulm-library.sqlite` / `ulm_library_idb_v1`)
    - Auto-synced Master Excel Register (`ULM_Master_Books_Register.xlsx`)
    - Book cover thumbnails (`book-covers/`) & Borrower ID photos (`member-photos/`)
    - Verified automatic backups (`backups/`)
  * Once confirmed, set `ulm_storage_location_configured_v1 = 'true'`, start with a clean `0`-book catalog (zero fake demo books), and display two direct onboarding actions: **`[➕ Add Books Manually]`** and **`[📥 Import Books from Excel / CSV]`**.

---

### 3. AUTO-UNIQUE 13-DIGIT BARCODES & SEQUENTIAL SERIES FOR EVERY IMPORTED BOOK & DUPLICATE COPIES (`src/services/libraryStorageAndMigration.ts`, `AddBookModal.tsx`)
- **Strict Sequential Series (`MAX(numeric_serial) + 1`) & 100% Unique Barcodes**:
  * During **Excel / CSV Import** and **Manual Add Book (`+ Add Book`)**:
    1. Every imported row—and every duplicate copy (`Copies > 1` in Manual Add or repeated book titles/ISBNs in Excel)—MUST receive its own **unique sequential Accession Number** (`00001`, `00002`, `00003`... or `100001`, `100002` after `100000` via `++maxSerial`) AND its own **100% unique 13-digit Code-128 Barcode** (`0092000000001`, `0092000000002`, `0092000000003`...).
    2. Track `seenAccessions` and `seenBarcodes` sets across the entire database and current import batch so two physical copies of the same book title NEVER share the same barcode or overwrite each other.
    3. Sort all catalog queries and Master Excel exports numerically (`CAST(accession_number AS INTEGER) ASC`) so `100000` is always followed immediately by `100001`.

---

### 4. SMART TWO-WAY BARCODE STATION WORKFLOW (`BarcodeStationView.tsx`)
Support scanning or typing **either** a Book Barcode/Accession # **or** a Student/Faculty Unique ID Barcode in the main scanner bar (`max-w-2xl w-full h-12 pl-11 pr-32`):
- **Mode A — Scan/Enter Book Barcode First (`0092...` or `Acc #`)**:
  * Immediately display the **Scanned Book Card** (Cover, Title, Author, Acc #, Barcode, Current Status, and Current Almari/Shelf) with two primary action buttons:
    1. **`[📤 Issue This Book]`** (or **`[📥 Return Book]`** if currently issued)
    2. **`[🗄️ Place in Almari & Shelf]`**: Opens an inline selector for Almari (`ALM-01`..`ALM-06+`) and Shelf (`Shelf 1`..`Shelf 5`) with 1-click **`[Save Location ↵]`** that updates both the book's location and the Almari shelf occupancy count.
  * **Chained Scan (Book → Student ID Barcode → Auto Loan-Duration Prompt)**:
    - When `[📤 Issue This Book]` is active and the librarian scans/enters a **Student ID Barcode (`ULM-STD-001`)** (or searches the student by Name/Roll #), automatically pop up the **Loan Duration Selector ("How much time does the student want this book?")** with quick presets (`7 Days`, `14 Days — Standard`, `30 Days`, `Full Semester (120 Days)`, or `Custom Days` input), auto-calculate the exact **Due Date** and **Rs. 10/day** overdue policy, and complete the issue on `Enter ↵`.
- **Mode B — Scan/Enter Student Unique Barcode First (`ULM-STD-001`, `ULM-FAC-002`)**:
  * **Left Column**: Display the **Full Student Profile & Printable CR80 ID Card** (`.ulm-preserve-dark` with circular clipped ULM Crest watermark, Name, Roll #, Department, Eligibility Badge `ELIGIBLE` / `QUOTA FULL` / `BLOCKED — OVERDUE FINE`, Quota `1 / 3 Books`, Payable Fine `Rs. 0`, and **Currently Issued Books** with 1-click `[Return Book ↵]`).
  * **Right Column**: Display **"Which Book Does This Student Want? (Scan Book Barcode or Search Title/Author)"**. As soon as a book is scanned or clicked, **automatically prompt for Loan Duration ("How much time?")** and issue the book immediately.

---

### 5. FIX `EditBookModal.tsx`, `BorrowerModal.tsx` & `AlmariView.tsx` INPUT OVERLAPS (`033520.png`, `033650.png`)
- **In `EditBookModal.tsx` & `BorrowerModal.tsx` (`033520.png`)**:
  * Remove the tiny floating copy-icon (`📋`) / `#` badges sitting inside the top-left of `4 Author / Editor / Org` (`"Arun Abbasi"`), `10 Place of Pub.` (`"Lakki Marwat"`), `11 Publisher` (`"ULM Press"`), `16 Date Added` (`"21-Oct-2026"`), `Full Name`, and `Roll Number`.
  * Replace Field `15 Binding & Code` (`033520.png`) with a single clean `<select>` dropdown (`01 — Hardbound`, `02 — Paperback`, `03 — Spiral / Report`, `04 — Leather Archival`) without the detached left `v` button.
  * Style all modal inputs and selects uniformly with `w-full h-10 px-3.5 rounded-lg bg-white dark:bg-[#0B1220] border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white text-sm focus:border-[#BC881B] outline-none`.
- **In `AlmariView.tsx` (`033650.png`)**:
  * Add `pl-10 pr-3.5` to both `"Find a book (Title, Author, Barcode)..."` and `"Search almaris..."` inputs with the `<Search />` icon at `absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none` so the icon never overlaps `"Find"`.
  * Compact the `Shelf 1`–`Shelf 5` rows in the Single Almari Inspector from tall `180px` empty boxes into clean, scannable `min-h-[84px] p-4 rounded-xl bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-white/10` shelf cards.

---

### 6. REDESIGN `SettingsView.tsx` INTO A CLEAN, PROFESSIONAL 4-CARD ENTERPRISE LAYOUT (`033728.png` – `033846.png`)
Overhaul `SettingsView.tsx` so **zero cards or banners render as pitch-black boxes in White Mode** and all headings/labels are crisp and legible:
- **Header Banner**: Clean white card (`bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm flex items-center justify-between`) with title `"System Settings & Workstation Configuration"` (`text-slate-900 dark:text-white font-bold text-lg`) and gold `[Save Preferences]` button.
- **Card 1 — Appearance & Display Scaling** (`033728.png`, `033744.png`): Consolidate Color Theme (`☀️ White Mode` vs `🌙 Dark Mode`), 3 clean Surface Tones (`Crisp White #FFFFFF`, `Warm Alabaster #F8FAFC`, `Soft Slate #F1F5F9`), and 4 Display Scaling presets (`Auto-Fit Window`, `Compact 85%`, `Standard 100%`, `Large HD 115%`) into one clean 2-column white card (`bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm`). **Remove** the `Eye-Comfort Glare Dimmer` slider and **remove** the `Refractive Liquid Glass Physics` clutter cards.
- **Card 2 — Institutional Identity & Campus Header Details** (`033803.png`): White card (`bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm`) with high-contrast labels (`text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 block`) for all 5 fields (`UNIVERSITY / INSTITUTION NAME *`, `LIBRARY FACILITY / DEPARTMENT NAME *`, `CAMPUS PHYSICAL ADDRESS`, `OFFICIAL CONTACT PHONE`, `OFFICIAL CIRCULATION EMAIL`) and a light `LIVE TITLE BAR & HEADER PREVIEW` box (`bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-white/10 rounded-xl p-3.5`).
- **Card 3 — Barcode Scanner & Peripherals** (`033818.png`): White card (`bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm`) with `bg-slate-50 dark:bg-[#0B1220]` toggle boxes for `Hardware Audio Feedback` and `Auto-Submit Scan`, readable slate labels (`text-slate-700 dark:text-slate-300`), and a clean `[|||| Auto-Backfill Barcodes]` footer button.
- **Card 4 — Library Folder Storage & Data Maintenance** (`033818.png`, `033846.png`): White card (`bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm`) with light KPI boxes (`bg-slate-50 dark:bg-[#0B1220]`) for `CURRENT LOCATION`, `FILE SIZE`, and `LAST SAVED`, uniform secondary action buttons (`bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300`), a soft amber card for `Action 1: Clear Demo Data` (`bg-amber-50/80 border-amber-300 text-amber-950`), and a soft rose card for `Action 2: Format / Reset App (Clear All Data & Re-Select Storage Folder)` (`bg-rose-50/80 border-rose-300 text-rose-950`).

---

### 7. GLOBAL CSS FOR TRANSPARENT OPENING SPLASH (DARK & WHITE MODE), LOGO CIRCLE CLIPPING & ANTI-BLUR (`index.html`)
Add/replace these exact CSS rules in `index.html` so regular pages are 100% razor-sharp (`ee.png`), the **Opening Splash Screen, ULM Crest Logo, Center Card, and Boot Console have a true Transparent Frosted Glass look in BOTH Dark Mode and White Mode (`001714.png`)**, and open modals dim properly (`033520.png`):

```css
/* ============================================================================
   1. ENSURE ALL REGULAR PAGES IN WHITE MODE ARE 100% SHARP & BRIGHT (FIXES ee.png)
   ============================================================================ */
html.light-theme,
html.light-theme body,
html.light-theme #root {
  background-color: #F4F6FA !important;
  color: #0F172A !important;
  filter: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

/* Completely disable any full-screen dimmer veil or pointer-events-none blur overlay */
#ulm-eye-comfort-veil,
html.light-theme #ulm-eye-comfort-veil {
  display: none !important;
  opacity: 0 !important;
  background: transparent !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

html.light-theme .fixed.inset-0.pointer-events-none,
html.light-theme [class*="fixed"][class*="inset-0"][class*="pointer-events-none"] {
  background-color: transparent !important;
  background-image: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  filter: none !important;
  box-shadow: none !important;
}

/* ============================================================================
   2. TRANSPARENT GLASS OPENING SPLASH SCREEN, LOGO & CONSOLE IN BOTH DARK & WHITE MODE
      (Fixes 001714.png — Removes gray square box on logo & solid white console box)
   ============================================================================ */
/* 2A. Transparent Full-Screen Splash Backdrop */
#ulm-boot-splash {
  background: radial-gradient(circle at 50% 35%, rgba(84, 26, 114, 0.28) 0%, rgba(7, 11, 20, 0.52) 100%) !important;
  backdrop-filter: blur(18px) saturate(180%) !important;
  -webkit-backdrop-filter: blur(18px) saturate(180%) !important;
}
html.light-theme #ulm-boot-splash {
  background: radial-gradient(circle at 50% 35%, rgba(255, 255, 255, 0.45) 0%, rgba(241, 245, 249, 0.58) 100%) !important;
  backdrop-filter: blur(18px) saturate(180%) !important;
  -webkit-backdrop-filter: blur(18px) saturate(180%) !important;
}

/* 2B. Strip the Gray Square Background from the ULM Crest Logo in Both Modes */
#ulm-boot-logo,
html.light-theme #ulm-boot-logo {
  background: rgba(255, 255, 255, 0.12) !important;
  backdrop-filter: blur(12px) !important;
  -webkit-backdrop-filter: blur(12px) !important;
  border-radius: 9999px !important;
  border: 2px solid rgba(188, 136, 27, 0.75) !important;
  overflow: hidden !important;
  box-shadow: 0 12px 32px rgba(188, 136, 27, 0.25) !important;
}
#ulm-boot-logo img,
html.light-theme #ulm-boot-logo img,
header img[alt*="ULM"],
header img[alt*="Crest"],
header img[alt*="University"] {
  border-radius: 9999px !important;
  clip-path: circle(44.5% at 50% 50%) !important;
  transform: scale(1.14) !important;
  background: transparent !important;
}

/* 2C. Transparent Frosted Glass Splash Card in Dark & White Mode */
#ulm-boot-card {
  background: rgba(15, 23, 42, 0.42) !important;
  background-image: linear-gradient(135deg, rgba(255, 255, 255, 0.16) 0%, rgba(255, 255, 255, 0.03) 60%, rgba(188, 136, 27, 0.10) 100%) !important;
  backdrop-filter: blur(24px) saturate(200%) !important;
  -webkit-backdrop-filter: blur(24px) saturate(200%) !important;
  border: 1.5px solid rgba(255, 255, 255, 0.22) !important;
  box-shadow: 0 24px 60px -12px rgba(0, 0, 0, 0.55), inset 0 1px 1px rgba(255, 255, 255, 0.25) !important;
  color: #F8FAFC !important;
}
html.light-theme #ulm-boot-card {
  background: rgba(255, 255, 255, 0.48) !important;
  background-image: linear-gradient(135deg, rgba(255, 255, 255, 0.75) 0%, rgba(255, 255, 255, 0.25) 60%, rgba(188, 136, 27, 0.10) 100%) !important;
  backdrop-filter: blur(24px) saturate(200%) !important;
  -webkit-backdrop-filter: blur(24px) saturate(200%) !important;
  border: 1.5px solid rgba(255, 255, 255, 0.88) !important;
  box-shadow: 0 24px 54px -12px rgba(15, 23, 42, 0.14), inset 0 1.5px 1px rgba(255, 255, 255, 0.95) !important;
  color: #0F172A !important;
}

/* 2D. Transparent Glass Boot Terminal Console (Never a solid white rectangle!) */
#ulm-boot-console {
  background: rgba(7, 11, 20, 0.38) !important;
  backdrop-filter: blur(12px) !important;
  -webkit-backdrop-filter: blur(12px) !important;
  border: 1px solid rgba(255, 255, 255, 0.14) !important;
  color: #34D399 !important;
}
html.light-theme #ulm-boot-console {
  background: rgba(15, 23, 42, 0.08) !important;
  backdrop-filter: blur(12px) !important;
  -webkit-backdrop-filter: blur(12px) !important;
  border: 1px solid rgba(15, 23, 42, 0.14) !important;
  color: #047857 !important;
}
html.light-theme #ulm-boot-console * {
  color: #1E293B !important;
}
html.light-theme #ulm-boot-console .text-emerald-400,
html.light-theme #ulm-boot-console .text-green-400 {
  color: #047857 !important;
  font-weight: 700 !important;
}

/* ============================================================================
   3. MODAL BACKDROPS ONLY: DIM & BLUR ONLY WHEN AN INTERACTIVE MODAL IS OPEN
      (Fixes 033520.png & 033542.png without ever blurring regular pages!)
   ============================================================================ */
html.light-theme .ulm-modal-backdrop:not(.pointer-events-none),
html.light-theme div.fixed.inset-0.z-50.flex:not(.pointer-events-none),
html.light-theme div.fixed.inset-0.z-\[60\].flex:not(.pointer-events-none),
html.light-theme div.fixed.inset-0.z-\[70\].flex:not(.pointer-events-none),
html.light-theme div.fixed.inset-0.z-\[80\].flex:not(.pointer-events-none),
html.light-theme div.fixed.inset-0.z-\[90\].flex:not(.pointer-events-none),
html.light-theme div.fixed.inset-0.z-\[100\].flex:not(.pointer-events-none):not(#ulm-boot-splash) {
  background-color: rgba(15, 23, 42, 0.42) !important;
  background-image: none !important;
  backdrop-filter: blur(4px) !important;
  -webkit-backdrop-filter: blur(4px) !important;
}

/* ============================================================================
   4. CONVERT ALL DARK CARDS/BANNERS/PANELS TO CRISP WHITE CARDS IN WHITE MODE
      (Excludes #ulm-boot-splash, #ulm-boot-card, #ulm-boot-console, .ulm-preserve-glass, and .ulm-preserve-dark)
   ============================================================================ */
html.light-theme [class*="bg-[#0"]:not(.fixed.inset-0):not(.pointer-events-none):not(#ulm-boot-splash):not(#ulm-boot-card):not(#ulm-boot-console):not(.ulm-preserve-glass):not(.ulm-preserve-glass *):not(.ulm-preserve-dark):not(.ulm-preserve-dark *),
html.light-theme [class*="bg-[#1"]:not(.fixed.inset-0):not(.pointer-events-none):not(#ulm-boot-splash):not(#ulm-boot-card):not(#ulm-boot-console):not(.ulm-preserve-glass):not(.ulm-preserve-glass *):not(.ulm-preserve-dark):not(.ulm-preserve-dark *),
html.light-theme [class*="bg-[#2"]:not(.fixed.inset-0):not(.pointer-events-none):not(#ulm-boot-splash):not(#ulm-boot-card):not(#ulm-boot-console):not(.ulm-preserve-glass):not(.ulm-preserve-glass *):not(.ulm-preserve-dark):not(.ulm-preserve-dark *),
html.light-theme [class*="bg-slate-9"]:not(.fixed.inset-0):not(.pointer-events-none):not(#ulm-boot-splash):not(#ulm-boot-card):not(#ulm-boot-console):not(.ulm-preserve-glass):not(.ulm-preserve-glass *):not(.ulm-preserve-dark):not(.ulm-preserve-dark *),
html.light-theme [class*="bg-zinc-9"]:not(.fixed.inset-0):not(.pointer-events-none):not(#ulm-boot-splash):not(#ulm-boot-card):not(#ulm-boot-console):not(.ulm-preserve-glass):not(.ulm-preserve-glass *):not(.ulm-preserve-dark):not(.ulm-preserve-dark *),
html.light-theme [class*="bg-neutral-9"]:not(.fixed.inset-0):not(.pointer-events-none):not(#ulm-boot-splash):not(#ulm-boot-card):not(#ulm-boot-console):not(.ulm-preserve-glass):not(.ulm-preserve-glass *):not(.ulm-preserve-dark):not(.ulm-preserve-dark *) {
  background-color: #FFFFFF !important;
  background-image: none !important;
  border-color: #E2E8F0 !important;
  color: #0F172A !important;
  box-shadow: 0 4px 18px -4px rgba(15, 23, 42, 0.06) !important;
}
```
```
