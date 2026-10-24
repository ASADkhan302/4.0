# 🛠️ ULM CENTRAL CAMPUS LIBRARY — FIX BLURRY/DIM WHITE MODE VEIL (`ee.png`) + ALL WHITE MODE UI & PROFESSIONAL SETTINGS FIXES

## 🔍 Why All Pages Turned Blurry & Dim in `ee.png` (And How This Prompt Fixes It)

1. **Root Cause of `ee.png` (Full-Screen Blur & Gray Dimmer Across All Pages)**:
   - Your app has an always-mounted full-screen overlay div (`<div className="fixed inset-0 pointer-events-none z-50 bg-black/..." />` / `#ulm-eye-comfort-veil`) sitting on top of the entire viewport.
   - When the CSS rule `html.light-theme .fixed.inset-0[class*="bg-black"]` applied `background-color: rgba(15, 23, 42, 0.45) !important; backdrop-filter: blur(6px) !important;`, it matched that **always-mounted `pointer-events-none` overlay** and placed a **permanent 6px Gaussian blur + 45% dark slate curtain over every single page** in White Mode!
2. **The Exact Fix**:
   - **Strip all blur and background fill from every `pointer-events-none` full-screen layer** (`html.light-theme .fixed.inset-0.pointer-events-none, html.light-theme #ulm-eye-comfort-veil { display: none !important; background: transparent !important; backdrop-filter: none !important; }`) and remove the dimmer veil div in `App.tsx` / `index.html` so **every page in White Mode is 100% razor-sharp, bright, and crystal-clear**.
   - **Target ONLY open Modal Dialog wrappers** (`div.fixed.inset-0.flex:not(.pointer-events-none)[class*="z-"]`) for the modal backdrop dim, so modals never turn solid white (`033520.png`, `033542.png`) and regular pages are never blurred (`ee.png`).

---

## 📋 Copy-Paste Master Prompt for Google AI Studio

Copy and paste the entire prompt block below into **Google AI Studio**:

```markdown
TASK: IMMEDIATELY FIX THE FULL-SCREEN BLURRY/DARK VEIL OVER ALL PAGES IN WHITE MODE (`ee.png`), FIX SOLID-WHITE MODAL BACKDROPS (`033520.png`, `033542.png`), FIX INPUT OVERLAPS (`033520.png`, `033650.png`), AND MAKE `SettingsView.tsx` CLEAN & PROFESSIONAL IN WHITE MODE (`033728.png`–`033846.png`)

Update `index.html`, `App.tsx` (or `Layout.tsx`), `SettingsView.tsx`, `EditBookModal.tsx`, `BorrowerModal.tsx`, and `AlmariView.tsx` with the following exact fixes:

---

### 1. FIX THE FULL-SCREEN BLURRY & DIM OVERLAY ON ALL PAGES IN WHITE MODE (`ee.png`) IN `index.html` & `App.tsx`
- **Why All Pages Are Blurred in `ee.png`**:
  * The rule `html.light-theme .fixed.inset-0[class*="bg-black"]` / `html.light-theme .fixed.inset-0[class*="bg-slate-9"]` with `backdrop-filter: blur(6px) !important; background-color: rgba(15, 23, 42, 0.45) !important;` accidentally matched an always-mounted full-screen overlay (`#ulm-eye-comfort-veil` or `<div className="fixed inset-0 pointer-events-none ...">`) in `App.tsx` / `index.html`, putting a permanent blurry dark curtain over the entire app!
- **Fix in `App.tsx` / `Layout.tsx` / `index.html`**:
  1. Remove any full-screen glare/dimmer overlay div (`#ulm-eye-comfort-veil` or any `<div className="fixed inset-0 pointer-events-none ... bg-black/..." />` / `backdrop-blur` overlay) from `App.tsx`, `Layout.tsx`, and `index.html` (keep only the centered ULM Crest watermark image at `z-0` with `backdrop-filter: none`).
  2. Replace the modal backdrop & card contrast CSS in `index.html` with this exact ruleset that **never blurs `pointer-events-none` layers or the app shell**, while keeping open modal dialogs properly dimmed:

```css
/* ============================================================================
   1. ENSURE ALL PAGES IN WHITE MODE ARE 100% SHARP & BRIGHT (FIXES ee.png)
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
   2. MODAL BACKDROPS ONLY: DIM & BLUR ONLY WHEN AN INTERACTIVE MODAL IS OPEN
      (Fixes 033520.png & 033542.png without ever blurring regular pages!)
   ============================================================================ */
html.light-theme .ulm-modal-backdrop:not(.pointer-events-none),
html.light-theme div.fixed.inset-0.z-50.flex:not(.pointer-events-none),
html.light-theme div.fixed.inset-0.z-\[60\].flex:not(.pointer-events-none),
html.light-theme div.fixed.inset-0.z-\[70\].flex:not(.pointer-events-none),
html.light-theme div.fixed.inset-0.z-\[80\].flex:not(.pointer-events-none),
html.light-theme div.fixed.inset-0.z-\[90\].flex:not(.pointer-events-none),
html.light-theme div.fixed.inset-0.z-\[100\].flex:not(.pointer-events-none) {
  background-color: rgba(15, 23, 42, 0.42) !important;
  background-image: none !important;
  backdrop-filter: blur(4px) !important;
  -webkit-backdrop-filter: blur(4px) !important;
}

/* ============================================================================
   3. CONVERT ALL DARK CARDS/BANNERS/PANELS TO CRISP WHITE CARDS IN WHITE MODE
      (Excludes modal backdrops, pointer-events-none layers, and .ulm-preserve-dark)
   ============================================================================ */
html.light-theme [class*="bg-[#0"]:not(.fixed.inset-0):not(.pointer-events-none):not(.ulm-preserve-dark):not(.ulm-preserve-dark *),
html.light-theme [class*="bg-[#1"]:not(.fixed.inset-0):not(.pointer-events-none):not(.ulm-preserve-dark):not(.ulm-preserve-dark *),
html.light-theme [class*="bg-[#2"]:not(.fixed.inset-0):not(.pointer-events-none):not(.ulm-preserve-dark):not(.ulm-preserve-dark *),
html.light-theme [class*="bg-slate-9"]:not(.fixed.inset-0):not(.pointer-events-none):not(.ulm-preserve-dark):not(.ulm-preserve-dark *),
html.light-theme [class*="bg-zinc-9"]:not(.fixed.inset-0):not(.pointer-events-none):not(.ulm-preserve-dark):not(.ulm-preserve-dark *),
html.light-theme [class*="bg-neutral-9"]:not(.fixed.inset-0):not(.pointer-events-none):not(.ulm-preserve-dark):not(.ulm-preserve-dark *) {
  background-color: #FFFFFF !important;
  background-image: none !important;
  border-color: #E2E8F0 !important;
  color: #0F172A !important;
  box-shadow: 0 4px 18px -4px rgba(15, 23, 42, 0.06) !important;
}
```

---

### 2. FIX `EditBookModal.tsx` & `BorrowerModal.tsx` — REMOVE OVERLAPPING COPY ICONS & FIX FIELD 15 (`033520.png`)
- Remove the tiny floating copy-icon (`📋`) / `#` badges sitting inside the top-left of `4 Author / Editor / Org` (`"Arun Abbasi"`), `10 Place of Pub.` (`"Lakki Marwat"`), `11 Publisher` (`"ULM Press"`), and `16 Date Added` (`"21-Oct-2026"`).
- Replace Field `15 Binding & Code` (`033520.png` — Red Dot) with a single clean `<select>` dropdown (`01 — Hardbound`, `02 — Paperback`, `03 — Spiral / Report`, `04 — Leather Archival`) without the detached left `v` button.
- Give all modal inputs and selects a uniform `h-10 px-3.5 rounded-lg bg-white dark:bg-[#0B1220] border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white text-sm focus:border-[#BC881B] outline-none` style.

---

### 3. FIX SINGLE ALMARI VIEW (`AlmariView.tsx` — `033650.png`)
- Add `pl-10 pr-3.5` to the `"Find a book (Title, Author, Barcode)..."` input with the `<Search />` icon at `absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none` so the icon never overlaps `"Find"`.
- Compact the `Shelf 1`–`Shelf 5` rows from tall `180px` empty boxes into clean, scannable `min-h-[84px] p-4 rounded-xl bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-white/10` shelf cards.

---

### 4. REDESIGN `SettingsView.tsx` INTO A CLEAN, PROFESSIONAL 4-CARD ENTERPRISE LAYOUT (`033728.png` – `033846.png`)
Overhaul `SettingsView.tsx` so **zero cards or banners render as pitch-black boxes in White Mode** and all headings/labels are crisp and legible:
- **Header Banner**: Clean white card (`bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm flex items-center justify-between`) with title `"System Settings & Workstation Configuration"` (`text-slate-900 dark:text-white font-bold text-lg`) and gold `[Save Preferences]` button.
- **Card 1 — Appearance & Display Scaling** (`033728.png`, `033744.png`): Consolidate Color Theme (`☀️ White Mode` vs `🌙 Dark Mode`), 3 clean Surface Tones (`Crisp White #FFFFFF`, `Warm Alabaster #F8FAFC`, `Soft Slate #F1F5F9`), and 4 Display Scaling presets (`Auto-Fit Window`, `Compact 85%`, `Standard 100%`, `Large HD 115%`) into one clean 2-column white card. **Remove** the `Eye-Comfort Glare Dimmer` slider and **remove** the `Refractive Liquid Glass Physics` clutter cards.
- **Card 2 — Institutional Identity & Campus Header Details** (`033803.png`): White card (`bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm`) with high-contrast labels (`text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 block`) for all 5 fields (`UNIVERSITY / INSTITUTION NAME *`, `LIBRARY FACILITY / DEPARTMENT NAME *`, `CAMPUS PHYSICAL ADDRESS`, `OFFICIAL CONTACT PHONE`, `OFFICIAL CIRCULATION EMAIL`) and a light `LIVE TITLE BAR & HEADER PREVIEW` box (`bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-white/10 rounded-xl p-3.5`).
- **Card 3 — Barcode Scanner & Peripherals** (`033818.png`): White card (`bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm`) with `bg-slate-50 dark:bg-[#0B1220]` toggle boxes for `Hardware Audio Feedback` and `Auto-Submit Scan`, readable slate labels (`text-slate-700 dark:text-slate-300`), and a clean `[|||| Auto-Backfill Barcodes]` footer button.
- **Card 4 — Library Folder Storage & Data Maintenance** (`033818.png`, `033846.png`): White card (`bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm`) with light KPI boxes (`bg-slate-50 dark:bg-[#0B1220]`) for `CURRENT LOCATION`, `FILE SIZE`, and `LAST SAVED`, uniform secondary action buttons (`bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300`), a soft amber card for `Action 1: Clear Demo Data` (`bg-amber-50/80 border-amber-300 text-amber-950`), and a soft rose card for `Action 2: Reset App / Clear All Data` (`bg-rose-50/80 border-rose-300 text-rose-950`).
```
