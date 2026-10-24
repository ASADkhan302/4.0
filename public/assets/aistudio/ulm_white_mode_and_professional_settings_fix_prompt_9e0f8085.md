# 🛠️ ULM CENTRAL CAMPUS LIBRARY — WHITE MODE UI FIXES & PROFESSIONAL SYSTEM SETTINGS REDESIGN (GOOGLE AI STUDIO PROMPT)

## 🔍 Part 1: Root-Cause Diagnosis of All 8 Screenshots (`033520.png` – `033846.png`)

| Screenshot | Exact UI Bug Marked in Your Screenshot | Why It Happens & How This Prompt Fixes It |
| :--- | :--- | :--- |
| **1. `033520.png`**<br>(`Edit Accession Record` Modal) | • **Full-screen background behind the modal turns 100% solid white**.<br>• **Small floating copy icons (`📋`)** sit on top of `"Arun Abbasi"` (Field 4), `"Lakki Marwat"` (Field 10), `"ULM Press"` (Field 11), and `"21-Oct-2026"` (Field 16), clipping the first letter.<br>• **Field `15 Binding & Code` (red dot)** has a detached floating `v` button next to `01`. | • The global `html.light-theme [class*="bg-black/"]` CSS rule accidentally matched the modal's `fixed inset-0 bg-black/80` backdrop and turned it solid white (`#FFFFFF`).<br>• **Fix**: Exclude `.fixed.inset-0` from white-card conversion and force modal backdrops to a soft translucent blur (`rgba(15, 23, 42, 0.45)` + `backdrop-filter: blur(6px)`). Remove all floating copy badges inside inputs and make `15 Binding & Code` a single clean `<select>` (`01 — Hardbound`, `02 — Paperback`). |
| **2. `033542.png`**<br>(`Barcode Label Thermal Generator` Modal — Red Dot) | • **Blinding white full-screen overlay** hides the entire application workspace behind the small thermal label dialog. | • Same modal backdrop bug: `html.light-theme` converted the dark overlay to opaque white.<br>• **Fix**: Use `.ulm-modal-backdrop` (`bg-slate-900/45 backdrop-blur-sm`) so the catalog page stays softly visible behind the modal in White Mode. |
| **3. `033650.png`**<br>(`A-01: Computer Science & Systems` — Red Dot) | • **Search icon (`🔍`) overlaps the `"F"`** in `"Find a book (Title, Author, Barcode"`.<br>• **Oversized empty shelf boxes (red dot)**: `Shelf 1` and `Shelf 2` take up huge vertical space (`180px+`) for empty shelves.<br>• Left sidebar still highlights `Books Catalog` instead of `Almaris & Shelves`. | • Input is missing `pl-10` left padding.<br>• **Fix**: Add `pl-10 pr-3` to the search input with `left-3.5 top-1/2 -translate-y-1/2 pointer-events-none` on the icon; make each Shelf row a compact, scannable `min-h-[84px] p-3.5` card; and sync Sidebar highlight to `Almaris & Shelves`. |
| **4. `033728.png` & `033744.png`**<br>(`System Settings` Top Cards — Red Dots) | • **Top Header Banner (`Campus System Preferences & Hardware Configuration`)** is pitch-black (`#16171d`) with unreadable dark-navy title text (`#0f172a`).<br>• **Bloated, unprofessional "AI-vibe" physics cards (red dots)**: `Eye-Comfort Glare Dimmer (78%)` puts a muddy yellow-brown stain across the screen, and `Refractive Liquid Glass Physics` / `Screen Resolution` take up 3 giant cards of technical jargon. | • Hardcoded dark gradient/hex classes on the Settings banner bypassed Light Mode CSS.<br>• **Fix**: Remove the muddy `Eye-Comfort Glare Dimmer` overlay (`--ulm-eye-dimmer: 0`), and consolidate Theme, Surface Style, and Screen Resolution into **ONE clean, professional "Appearance & Display Scaling" section** with crisp White Mode cards. |
| **5. `033803.png`**<br>(`Institutional Identity` Card — Red Dot) | • **About Card (`University of Lakki Marwat LMS`)** and **`Institutional Identity & Campus Header Details` Card** are pitch-black (`#14161d`) while their titles, all 5 uppercase field labels (`UNIVERSITY / INSTITUTION NAME`, `OFFICIAL CONTACT PHONE`, etc.), preview text, and `"Apply Details to App"` link are **dark navy (`#0f172a`) on black — completely invisible!** | • The card container used an unconverted dark class while global `html.light-theme label, h3` forced the text to dark navy.<br>• **Fix**: Convert all Settings section cards to clean White Mode surfaces (`bg-white dark:bg-[#131B2E] border border-slate-200/90 dark:border-white/10 text-slate-900 dark:text-white shadow-sm`) with `text-slate-700 dark:text-slate-300` field labels and a crisp light preview box (`bg-slate-50 dark:bg-[#0B1220]`). |
| **6. `033818.png` & `033846.png`**<br>(`Barcode Scanner`, `Library Folder` & `Data Maintenance` Cards — Red Dots) | • **`Barcode Scanner & Peripherals`**, **`Library Folder & Data Storage`**, and **`Data Maintenance & Reset Control`** are all pitch-black containers with invisible dark-navy headings and labels (`WORKSTATION NODE ID`, `INSTITUTIONAL BARCODE PREFIX`, `CATALOG BARCODES AUTO-BACKFILL`, `Format: ULM-00012`), plus dark-maroon text on black in `ACTION 2: RESET APP`. | • **Fix**: Redesign all 3 hardware, storage, and maintenance sections into a **clean, structured enterprise Settings layout** with white cards (`bg-white dark:bg-[#131B2E]`), high-contrast slate labels (`#334155`), clean status pills, and properly styled action buttons in both White Mode and Dark Mode. |

---

## 📋 Part 2: Copy-Paste Master Prompt for Google AI Studio

Copy and paste the entire prompt block below into **Google AI Studio**:

```markdown
TASK: FIX ALL WHITE MODE (`html.light-theme`) UI BUGS (SOLID WHITE MODAL BACKDROPS, OVERLAPPING INPUT ICONS, PITCH-BLACK CARDS WITH DARK-NAVY TEXT) AND REDESIGN `SettingsView.tsx` INTO A CLEAN, PROFESSIONAL INSTITUTIONAL SETTINGS PAGE IN BOTH WHITE & DARK MODES

Update `index.html`, `SettingsView.tsx`, `EditBookModal.tsx`, `BorrowerModal.tsx`, `BarcodeStationView.tsx` (and thermal label modal), and `AlmariView.tsx` with the following exact fixes:

---

### 1. FIX WHITE-OUT MODAL BACKDROPS & MUDDY GLARE VEIL IN `index.html`
- **Problem (`033520.png`, `033542.png`, `033728.png`)**:
  1. When any modal (`Edit Accession Record` or `Barcode Label Thermal Generator`) opens in White Mode, the global `html.light-theme` background rule accidentally matches the full-screen modal overlay (`fixed inset-0 bg-black/80` or `bg-slate-950/80`) and turns the entire screen behind the modal into **solid opaque white (`#FFFFFF`)**!
  2. The `Eye-Comfort Glare Dimmer` overlay (`#ulm-eye-comfort-veil`) puts a muddy brown/yellow tint across the right side of White Mode.
- **Fix in `index.html`**:
  * Remove/disable any warm glare dimmer veil (`--ulm-eye-dimmer: 0 !important; display: none !important;`) so White Mode is always crisp, clean, and neutral (`#F4F6FA` background with `#FFFFFF` cards).
  * Exclude modal backdrops (`:not(.fixed.inset-0):not(.ulm-modal-backdrop)`) from the `html.light-theme` white-card conversion rule, and explicitly style all full-screen modal overlays in Light Mode with a soft translucent blur so the underlying library page remains visible behind the modal:
    ```css
    /* Keep full-screen modal backdrops translucent with soft blur in White Mode (NEVER solid white!) */
    html.light-theme .fixed.inset-0[class*="bg-black"],
    html.light-theme .fixed.inset-0[class*="bg-slate-9"],
    html.light-theme .fixed.inset-0[class*="bg-zinc-9"],
    html.light-theme .ulm-modal-backdrop {
      background-color: rgba(15, 23, 42, 0.45) !important;
      background-image: none !important;
      backdrop-filter: blur(6px) !important;
      -webkit-backdrop-filter: blur(6px) !important;
    }

    /* Convert all non-backdrop dark containers/banners/cards to crisp White Mode surfaces */
    html.light-theme [class*="bg-[#0"]:not(.fixed.inset-0):not(.ulm-preserve-dark):not(.ulm-preserve-dark *),
    html.light-theme [class*="bg-[#1"]:not(.fixed.inset-0):not(.ulm-preserve-dark):not(.ulm-preserve-dark *),
    html.light-theme [class*="bg-[#2"]:not(.fixed.inset-0):not(.ulm-preserve-dark):not(.ulm-preserve-dark *),
    html.light-theme [class*="bg-slate-9"]:not(.fixed.inset-0):not(.ulm-preserve-dark):not(.ulm-preserve-dark *),
    html.light-theme [class*="bg-zinc-9"]:not(.fixed.inset-0):not(.ulm-preserve-dark):not(.ulm-preserve-dark *),
    html.light-theme [class*="bg-neutral-9"]:not(.fixed.inset-0):not(.ulm-preserve-dark):not(.ulm-preserve-dark *) {
      background-color: #FFFFFF !important;
      background-image: none !important;
      border-color: #E2E8F0 !important;
      color: #0F172A !important;
      box-shadow: 0 4px 20px -4px rgba(15, 23, 42, 0.06) !important;
    }
    ```

---

### 2. FIX `EditBookModal.tsx` & `BorrowerModal.tsx` — REMOVE OVERLAPPING COPY ICONS & FIX FIELD 15 (`033520.png`)
- **Remove Floating Copy-Icon Badges Inside Inputs (`033520.png`)**:
  * Remove the tiny floating copy-icon (`📋`) / `#` buttons sitting inside the top-left of `4 Author / Editor / Org` (`"Arun Abbasi"`), `10 Place of Pub.` (`"Lakki Marwat"`), `11 Publisher` (`"ULM Press"`), and `16 Date Added` (`"21-Oct-2026"`). Those floating badges overlap and clip the first letters of the input text.
  * Give all text inputs and selects a clean, uniform `h-10 px-3.5 rounded-lg bg-white dark:bg-[#0B1220] border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white text-sm focus:border-[#BC881B] outline-none` style.
- **Fix Field `15 Binding & Code` (`033520.png` — Red Dot)**:
  * Remove the detached left `v` chevron button next to `01`. Replace `15 Binding & Code` with a single clean `<select>` dropdown (`01 — Hardbound`, `02 — Paperback`, `03 — Spiral / Report`, `04 — Leather Archival`) with a standard right-aligned chevron.

---

### 3. FIX SINGLE ALMARI VIEW (`AlmariView.tsx` — `033650.png`)
- **Fix Overlapping Search Icon**:
  * In the `"Find a book (Title, Author, Barcode)..."` input, add `pl-10 pr-3.5` to the `<input>` and position the `<Search />` icon at `absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none` so the icon never overlaps `"Find"`.
- **Make Shelf Rows Compact & Professional (`033650.png` — Red Dot)**:
  * Reduce the height of `Shelf 1`–`Shelf 5` containers from huge `180px` empty boxes to compact, structured shelf cards (`min-h-[88px] p-4 rounded-xl bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-white/10`) showing the Shelf Header (`Shelf 1 • Range 0092000004996–0092000005000` on left, `5 / 120 books • 4% full` + `Filter table to this shelf →` on right) and a sleek `h-10` visual book-spine shelf bar below.

---

### 4. REDESIGN `SettingsView.tsx` INTO A CLEAN, PROFESSIONAL ENTERPRISE SETTINGS PAGE (FIXING `033728.png` – `033846.png`)
Completely overhaul `SettingsView.tsx` so that **zero cards or banners render as pitch-black boxes in White Mode** and all bloated "AI physics/glare" clutter is replaced by a clean, professional university administration layout:

- **A. Clean Institutional Settings Header Banner (`033728.png`)**:
  * Replace the pitch-black header banner with a crisp card (`bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm flex flex-wrap items-center justify-between gap-4`):
    - Left: Gold settings badge (`w-11 h-11 rounded-xl bg-amber-50 dark:bg-[#541A72]/40 border border-amber-300 dark:border-[#BC881B]/50 flex items-center justify-center text-[#BC881B]`) + Title `"System Settings & Workstation Configuration"` (`text-lg font-bold text-slate-900 dark:text-white`) + Subtitle `"Manage appearance, display scaling, institutional branding, barcode peripherals, and SQLite database storage."` (`text-xs text-slate-600 dark:text-slate-400`).
    - Right: Version pill (`v2.4.0 Enterprise`) + Primary Gold **`[Save Preferences]`** button (`h-10 px-4 rounded-xl bg-[#BC881B] text-slate-950 font-semibold text-xs shadow-sm`).
- **B. Clean Sub-Navigation Tabs**:
  * Style the sub-tabs (`General & Appearance`, `Book Groups (گروپس)`, `Almaris & Shelves (الماریاں)`) with active tab `bg-[#541A72] !text-white font-semibold border border-[#BC881B]/60 rounded-xl px-4 py-2 text-xs shadow-sm` and inactive tabs `bg-white dark:bg-[#131B2E] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10 hover:bg-slate-50 rounded-xl px-4 py-2 text-xs font-medium`.
- **C. Section 1 — Appearance & Display Scaling (Replaces the 3 Bloated Theme/Physics/Resolution Cards in `033728.png` & `033744.png`)**:
  * Render ONE clean 2-column card (`bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm`):
    - **Left Column (`Color Theme & Surface Tone`)**:
      * Segmented toggle for **`☀️ White Mode (Default)`** vs. **`🌙 Dark Obsidian Mode`**.
      * 3 clean surface tone pills (`Crisp Pure White #FFFFFF`, `Warm Alabaster #F8FAFC`, `Soft Slate #F1F5F9`) — **remove** the `Eye-Comfort Glare Dimmer` slider and **remove** the `Refractive Liquid Glass Physics / Blur / Tint` sliders and the `Locked Optical Barcode Safe-Pad` filler card.
    - **Right Column (`Display Resolution & Workspace Zoom`)**:
      * 4 clean preset buttons in a 2×2 or 4-col grid: `Auto-Fit Window (Dynamic)`, `Compact Laptop (85%)`, `Standard Desktop (100%)`, `Large HD / 4K (115%)`, plus a single compact zoom bar (`75%` to `125%`).
- **D. Section 2 — Institutional Identity & Campus Header Details (`033803.png` Fix)**:
  * Style the card container with `bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm` (NEVER pitch-black in White Mode!).
  * Style the section heading `"Institutional Identity & Campus Header Details"` with `text-base font-bold text-slate-900 dark:text-white` and subtitle with `text-xs text-slate-600 dark:text-slate-400`.
  * Style all 5 field labels (`UNIVERSITY / INSTITUTION NAME *`, `LIBRARY FACILITY / DEPARTMENT NAME *`, `CAMPUS PHYSICAL ADDRESS`, `OFFICIAL CONTACT PHONE`, `OFFICIAL CIRCULATION EMAIL`) with `text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 block` (fixing the invisible dark-navy labels on black in `033803.png`).
  * Style all 5 inputs with `w-full h-10 px-3.5 rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white text-sm focus:bg-white focus:border-[#BC881B] outline-none`.
  * Style the **`LIVE TITLE BAR & HEADER PREVIEW`** box with `bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#BC881B]/40 rounded-xl p-3.5 flex items-center justify-between` where `"University of Lakki Marwat"` renders in `font-serif font-bold text-slate-900 dark:text-white` and `"| Central Campus Library"` renders in `font-semibold text-[#8F4F00] dark:text-[#FFD147]` alongside the **`[✓ Apply Details to App]`** button.
- **E. Section 3 — Barcode Scanner & Peripherals (`033818.png` Fix)**:
  * Style the card container with `bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm`.
  * Style the two toggle cards (`Hardware Audio Feedback` and `Auto-Submit Scan`) with `bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-white/10 rounded-xl p-3.5 flex items-center justify-between`.
  * Style all 4 field labels (`WORKSTATION NODE ID`, `WINDOWS TITLE BAR BADGE`, `INSTITUTIONAL BARCODE PREFIX (MAX 6 CHARS)`, `FIRST ACCESSION NUMBER (DEFAULT 1)`) with `text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 block`, and make the `Format: ULM-00012 (Code-128 standard)` helper text `text-xs text-slate-600 dark:text-slate-400 font-mono`.
  * Place the **`[|||| Auto-Backfill Barcodes]`** button cleanly in the card footer (`h-10 px-4 rounded-xl bg-[#541A72] hover:bg-purple-800 !text-white font-semibold text-xs`).
- **F. Section 4 — Library Folder, Master Excel Sync & Data Maintenance (`033818.png` & `033846.png` Fix)**:
  * Style both the **`Library Folder & Data Storage`** card and the **`Data Maintenance & Reset Control`** card with `bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm`.
  * Style the 3 storage KPI boxes (`CURRENT LOCATION: Documents\ULM Library`, `FILE SIZE (ON DISK)`, `LAST SAVED`) with `bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-white/10 rounded-xl p-3.5`.
  * Style the action buttons (`[Open Folder]`, `[Change Location]`, `[Check Library File]`, `[Copy Path]`, `[Sync Master Excel (.xlsx)]`, `[Export Library Package]`, `[Open Library Package]`, `[Backup Now]`) as clean, consistent buttons (`h-9 px-3.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-white/15 text-xs font-semibold`) so there are no dark-brown/green/purple outlines on pitch-black backgrounds.
  * In **`Data Maintenance & Reset Control`** (`033846.png`), style the two inner boxes cleanly for White Mode:
    - **Box 1 (`Action 1: Clear Demo Data`)**: `bg-amber-50/70 dark:bg-amber-950/25 border border-amber-300 dark:border-amber-500/40 rounded-xl p-4` with heading `text-amber-900 dark:text-amber-300 font-bold text-xs uppercase`, description `text-slate-700 dark:text-slate-300 text-xs`, and button `bg-amber-600 hover:bg-amber-700 !text-white font-semibold px-4 py-2 rounded-lg text-xs`.
    - **Box 2 (`Action 2: Reset App / Clear All Data`)**: `bg-rose-50/70 dark:bg-rose-950/25 border border-rose-300 dark:border-rose-500/40 rounded-xl p-4` with heading `text-rose-900 dark:text-rose-300 font-bold text-xs uppercase`, description `text-slate-700 dark:text-slate-300 text-xs`, and button `bg-rose-600 hover:bg-rose-700 !text-white font-semibold px-4 py-2 rounded-lg text-xs`.
```
