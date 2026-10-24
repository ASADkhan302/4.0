# ULM Central Campus Library — Locked Left Sidebar & Universal Vertical Scrolling Architecture

This update resolves the root viewport and flex-container conflict where unconstrained `min-h-screen` wrappers combined with `body { overflow: hidden }` prevented both the browser window and the inner workspace from scrolling, while causing the left navigation rail to stretch and drift out of position. It locks the top institutional header and left navigation sidebar in place and establishes a single unified vertical scroll container across all 8 workstation views and all modal dialogs at every display scale (`30%`–`125%`).

## User Review & Confirmed Decisions

> [!IMPORTANT]
> The following architectural and UX behaviors were confirmed during interactive clarification and govern this implementation:

- **Confirmed Decision 1 — Unified Page Scrolling**: The entire active view (including KPI summary cards, search/filter toolbars, catalog tables/grids, and pagination controls) scrolls smoothly as one unified workspace inside the right-hand main scroll container, with automatic scroll-to-top reset when switching tabs.
- **Confirmed Decision 2 — Locked Left Sidebar with Collapsible Icon-Rail**: The left navigation sidebar stays permanently locked on the left edge of the workstation frame with a pinned top header (`NAVIGATION`), an internal navigation list, and a pinned bottom footer (`System Settings` & `Collapse Sidebar`), supporting instant toggling between full width and compact icon-rail mode across all viewport widths and zoom scales.

---

## 1. Overview & Core Concept

- **What It Does**: Establishes a strict fixed-frame desktop shell (`100dvh` locked outer frame) where the Windows Title Bar, University Header, and Left Navigation Sidebar remain anchored in place while the right-hand main workspace scrolls effortlessly from top to bottom on every screen.
- **Target Audience / Persona**: University librarians, catalogers, and circulation desk staff operating the ULM Central Campus Library workstation across laptops, Full HD monitors, and 4K displays at custom display scales (`30%` to `125%`).
- **Key Value**: Eliminates clipped tables, unreachable pagination bars, and cut-off settings or modal forms so every book record, Almari shelf rack, loan card, report chart, and dialog button is smoothly reachable via mouse wheel, trackpad, or scrollbar.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Switching Workstation Views**: Clicking any destination in the left sidebar (`Books Catalog`, `Almaris & Shelves`, `Circulation Desk`, `Borrowers & Faculty`, `Barcode Station`, `Reports & Audits`, `Excel & PC Migration`, or `System Settings`) keeps the sidebar and top header completely stationary, resets the right-hand workspace scroll position to `0`, and renders the full vertical flow of the selected view.
  2. **Deep Catalog & Shelf Inspection**: Scrolling down inside `Books Catalog` (List, Grid, Almari, or Analytics modes) smoothly glides past the KPI strip and filter bar down through all 50+ displayed rows/cards to the bottom pagination bar (`Previous / Page X of Y / Next`).
  3. **Collapsible Icon-Rail Navigation**: Clicking the sidebar collapse toggle smoothly transitions the left rail between expanded mode (`240px`) and compact icon-rail mode (`72px` with live counter badges and tooltips) while keeping `System Settings` and `Collapse Sidebar` pinned at the bottom of the rail.
  4. **Scrollable Modal Forms**: Opening any modal (`Add/Edit Book`, `Book Details`, `Borrower ID Card`, `Batch Label Studio`, `Excel Importer`) constrains the dialog to `88dvh` with a pinned header, an independently scrollable body, and a pinned action footer so buttons never overflow off-screen.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Institutional enterprise workstation with crisp dual-theme support (Soft Pearl White Mode and Obsidian Dark Mode).
  - *Color Palette & Mood*: Neutral structural surfaces (`#F4F6FA` light / `#0B1220` dark), royal amethyst active accents (`#541A72`), burnished ULM gold highlights (`#BC881B`), and custom thin scrollbars that highlight in gold on hover.
  - *Typography & Hierarchy*: Institutional display headers (`Cinzel` / `Playfair Display`), clean UI labels (`Plus Jakarta Sans` / `Inter`), and strict tabular numerals (`JetBrains Mono`, `tabular-nums`) for accession numbers, 13-digit barcodes, and counters.
- **Interactive Feedback & Motion**:
  - Instant scroll-to-top (`scrollTop = 0`) on tab switch, `150ms` sidebar width transition, and `pointer-events: none` enforcement on all ambient background orbs and the centered ULM crest watermark so they never intercept mouse-wheel scrolling.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1 — Single Outer Scroll Container vs. Nested Inner Scroll Boxes**:
  - *Chosen Approach*: Delegate all vertical page scrolling to `<main id="ulm-main-scroll-view">` (`flex-1 min-h-0 h-full overflow-y-auto overflow-x-hidden`) and set all 8 child page views to `h-auto min-h-0 overflow-visible`.
  - *Why*: Nested `h-full overflow-hidden` containers inside flex children trap wheel events and clip bottom pagination controls when display scaling is adjusted. A single unified scroll container guarantees predictable mouse-wheel and scrollbar behavior across all 8 pages.
  - *Alternatives Considered*: Per-table internal scroll containers, which left too little vertical space for rows on `1366×768` laptop screens or at `115%–125%` zoom.
- **Decision 2 — Locked `100dvh` Root Frame with Zoom Compensation**:
  - *Chosen Approach*: Lock `html, body` to `height: 100%; overflow: hidden` and `#root` + the app shell wrapper to `height: 100dvh; max-height: 100dvh; overflow: hidden; display: flex; flex-direction: column`.
  - *Why*: Previously, `App.tsx` used `min-h-screen` while `body` had `overflow: hidden`. That caused the app wrapper to expand beyond the viewport without triggering `<main>`'s scrollbar, while `body` blocked window scrolling. Locking the shell to `100dvh` forces `<main>` to compute a bounded viewport height and activate its vertical scrollbar reliably.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Viewport Scroll Hierarchy**:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ #root (100% width × 100dvh locked height, flex-col, overflow-hidden)         │
├──────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ Top Bars Wrapper (shrink-0, z-30)                                        │ │
│ │  ├─ WindowsTitleBar (Station ID, Clock, Quick Replay)                    │ │
│ │  └─ PrimaryHeader (ULM Crest, Volume Counter, Scale Controls, Actions)   │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│ ┌──────────────────────┬───────────────────────────────────────────────────┐ │
│ │ Locked Left Sidebar  │ Right Main Scroll Workspace                       │ │
│ │ (shrink-0, h-full,   │ <main id="ulm-main-scroll-view">                  │ │
│ │  w-60 / w-18 rail,   │ (flex-1, min-w-0, min-h-0, h-full,                │ │
│ │  flex-col, z-20)     │  overflow-y-auto, overflow-x-hidden, p-4 md:p-6)  │ │
│ │                      │                                                   │ │
│ │ ┌──────────────────┐ │ ┌───────────────────────────────────────────────┐ │ │
│ │ │ Pinned Top Bar   │ │ │ Active Page View (h-auto, overflow-visible)   │ │ │
│ │ │ ("NAVIGATION")   │ │ │  • Page 1: Books Catalog (List/Grid/Almari)   │ │ │
│ │ ├──────────────────┤ │ │  • Page 2: Almaris & Shelves Inspector        │ │ │
│ │ │ Scrollable Nav   │ │ │  • Page 3: Barcode Station (2-Way Desk + Log) │ │ │
│ │ │ (flex-1 min-h-0) │ │ │  • Page 4: Circulation Desk & Loan Registry   │ │ │
│ │ │  • Catalog       │ │ │  • Page 5: Borrowers & Faculty Directory      │ │ │
│ │ │  • Almaris       │ │ │  • Page 6: Reports & Audits (5 Sub-Tabs)      │ │ │
│ │ │  • Circulation   │ │ │  • Page 7: Excel & PC Migration Center        │ │ │
│ │ │  • Borrowers     │ │ │  • Page 8: System Settings (4 Enterprise Cards│ │ │
│ │ │  • Barcode Desk  │ │ └───────────────────────────────────────────────┘ │ │
│ │ │  • Reports       │ │                                                   │ │
│ │ │  • Excel Center  │ │ [Fixed Background Watermark: pointer-events-none] │ │
│ │ ├──────────────────┤ │                                                   │ │
│ │ │ Pinned Footer    │ │ ┌───────────────────────────────────────────────┐ │ │
│ │ │  • Settings      │ │ │ Modal Dialogs (max-h-[88dvh], flex-col)       │ │ │
│ │ │  • Collapse Rail │ │ │  Header (shrink-0) → Body (overflow-y-auto)   │ │ │
│ │ └──────────────────┘ │ │  → Footer (shrink-0)                          │ │ │
│ └──────────────────────┴─┴───────────────────────────────────────────────┴─┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **Interactive Component & State Mapping**:
  - **Root & Shell Viewport (`#root` & App Shell)**: Enforces `height: 100dvh; max-height: 100dvh; overflow: hidden` so the flex child row (`flex-1 min-h-0 w-full flex flex-row overflow-hidden`) receives an exact bounded height at all scales (`30%`–`125%`).
  - **Main Scroll Controller (`mainScrollRef`)**: Attached to `<main id="ulm-main-scroll-view">`. A `useEffect` watching `activeTab` executes `mainScrollRef.current?.scrollTo({ top: 0, behavior: 'instant' })` on every navigation change.
  - **Sidebar Lock (`LmsSidebar`)**: Renders as a permanently visible flex sibling (`shrink-0 h-full min-h-0 flex flex-col justify-between overflow-hidden`) that switches cleanly between `240px` expanded width and `72px` icon-rail width without disappearing or scrolling away with page content.
  - **Unclipped Page Containers (All 8 Views)**: Strips `h-full overflow-hidden` and inner scroll traps from all 8 view components and their sub-views so content expands naturally (`h-auto overflow-visible pb-12`) inside `<main id="ulm-main-scroll-view">`.
  - **Modal Scroll Safety**: Constrains modal panels to `max-h-[88dvh] flex flex-col overflow-hidden` with `shrink-0` headers/footers and `flex-1 min-h-0 overflow-y-auto` bodies.
