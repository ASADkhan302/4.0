# ❄️ ULM LMS — STRICT UI-ONLY FROSTED LIQUID-GLASS & 32-SCREENSHOT FIX MASTER PROMPT

> **How to use this prompt:**
> Copy and paste the entire directive below into **Google AI Studio** (`Labrary-app-3.0`). It enforces an **absolute zero-function-change lock**—updating **ONLY the UI, frosted glass surfaces, typography, and contrast** across all screens while leaving 100% of your functions, state hooks, SQLite queries, Drag & Drop, and exports untouched.

***

# 🏛️ SYSTEM DIRECTIVE: STRICT UI-ONLY FROSTED CRYSTAL LIQUID-GLASS UPGRADE (ZERO FUNCTION CHANGES)

You are the Principal Design Systems Architect for the **University of Lakki Marwat (ULM) Central Campus Library System**.

### ⛔ ABSOLUTE ZERO-FUNCTION-CHANGE LOCK (READ FIRST):
1. **DO NOT TOUCH, RENAME, ADD, OR MODIFY ANY FUNCTION OR LOGIC**:
   - Do NOT alter any `useState`, `useEffect`, `useMemo`, `useRef`, or custom hooks.
   - Do NOT alter any event handlers (`onClick`, `onChange`, `onSubmit`, `onDragStart`, `onDrop`), database queries (`StorageEngine`, `LibraryStorage`, `AlmariService`), barcode listeners, or CSV/Excel/Print functions.
   - Do NOT change any component props, TypeScript interfaces, or data calculations.
2. **UPDATE ONLY VISUAL PRESENTATION (CSS / TAILWIND CLASSES & UI WRAPPERS)**:
   - Apply the **Frosted Crystal Liquid-Glass** surface system (`backdrop-blur-2xl backdrop-saturate-[180%]` with frosted gradient sheen and curved specular rims) to **both the cards AND all outer shells/containers** across the app.
   - Fix all **12 visual, contrast, clipping, and overlap bugs** identified in the 32 screenshots across Dark Glass and White Glass modes.

---

## ❄️ THE FROSTED CRYSTAL LIQUID-GLASS FORMULA (CARDS + OUTER CONTAINERS)

Use these two core frosted glass recipes across all views so both outer shells and inner cards share a cohesive, tactile frosted depth:

1. **Outer Shells & Primary Containers** *(Header, Sidebar, Almari 3D Plaque, Page Banner Headers, Modals)*:
   ```
   rounded-[26px] bg-gradient-to-br from-white/55 via-white/35 to-white/20 dark:from-white/[0.08] dark:via-[#18102B]/55 dark:to-[#120B22]/40 backdrop-blur-2xl backdrop-saturate-[180%] border border-white/65 dark:border-white/[0.16] shadow-[inset_1.5px_1.5px_2px_rgba(255,255,255,0.55),inset_-1px_-1px_1px_rgba(255,255,255,0.16),0_12px_32px_rgba(0,0,0,0.22)]
   ```
2. **Inner Frosted Cards** *(Top 4 KPI Cards, Book Grid Cards, Search/Filter Toolbar, Almari Cupboard Cards, Circulation Cards, Borrower Cards, Reports & Audits Bento Cards, Settings Cards)*:
   ```
   rounded-[22px] bg-gradient-to-br from-white/50 via-white/30 to-white/15 dark:from-white/[0.07] dark:via-white/[0.03] dark:to-white/[0.015] backdrop-blur-xl backdrop-saturate-[175%] border border-white/60 dark:border-white/[0.14] shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.45),inset_-1px_-1px_1px_rgba(255,255,255,0.12),0_8px_24px_rgba(0,0,0,0.16)]
   ```

---

## 🔍 SUMMARY OF ALL 12 UI-ONLY FIXES TO APPLY

| # | Screen / Component | Visual Issue in Screenshots | Strict UI-Only Fix |
| :- | :--- | :--- | :--- |
| **1** | **Outer Shell, Header & Sidebar** (`App.tsx`, `PrimaryHeader.tsx`, `Sidebar.tsx`) | Sharp 90° boxy intersection in top-left corner (`11_33_AM.png`). | Float Header & Sidebar as curved `rounded-[26px]` Frosted Liquid-Glass islands with `p-3 sm:p-4 gap-3.5` outer spacing. |
| **2** | **Catalog Dropdowns & `+ + Add Book`** (`BooksCatalogView.tsx`, `PrimaryHeader.tsx`) | Clicking `All Disciplines` (`1.1.png`) shows an ugly OS grey/blue `<option>` menu; button renders `+ + Add Book`. | Style `<select>` as frosted glass pills, add `className="bg-white dark:bg-[#181028] text-slate-900 dark:text-white"` on every `<option>`, and remove the duplicate `+` text inside `+ Add Book`. |
| **3** | **Top 4 Metric Stat Cards** (`BooksCatalogView.tsx`) | Plain boxy cards lacking frost depth and hierarchy. | Wrap in Frosted `LiquidGlassCard` (`rounded-[22px]`), `Space Grotesk` (`26px`) numerals, `Plus Jakarta Sans` labels, `28×28px` frosted icon badges, subtle italic unit labels, and 12-segment micro tick-bars. |
| **4** | **Almari Search Bar Overlap** (`AlmariView.tsx`) | `<Search />` icon overlaps the `"S"` in `"Search almari code..."` (`2.1.png`, `22.1.png`). | Change search `<input>` padding to `pl-9 pr-8` with `left-3` on `<Search />`. |
| **5** | **Almari View White Glass Mode** (`AlmariView.tsx`) | Plaque title is black-on-dark-purple (`22.1.png`), `SHELF 1` is yellow-on-white, and `51 / 100 vols` is black-on-purple. | Force `!text-white` on dark purple plaques and active cupboard cards; use `text-[#7A4B00] dark:text-[#FFD147] bg-amber-500/15 dark:bg-black/40` for `SHELF {n}` badges. |
| **6** | **Edit Almari Modal Button** (`AlmariView.tsx`) | `Delete Cupboard` button is washed-out pink-on-pink in White Glass (`22.21.png`). | Style with `bg-rose-500/15 hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 border border-rose-500/40 font-extrabold`. |
| **7** | **Borrower Profile Modal Clipping** (`MemberIdCardsView.tsx`) | Modal top header & bottom Save buttons are clipped off-screen (`02_26_PM.png`, `38.png`), and scrolling creates a white gap. | Use `fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md` and `max-h-[90vh] flex flex-col overflow-hidden rounded-[26px]` with sticky header, `overflow-y-auto` body, and sticky footer. |
| **8** | **Borrower Modal White Mode Text** (`02_26_PM.png`) | `"Member Portrait Photo"` and Live CR80 Card Preview text (`Asad Zeb`, `ulm099`) are white-on-white. | Use `text-slate-800 dark:text-slate-100` on upload labels, and scope CR80 card body ink to `text-[#1A1027]`. |
| **9** | **CR80 ID Card Header Banner** (`22.31.png`, `33.png`, `38.png`) | `"UNIVERSITY OF LAKKI MARWAT"` truncates to `"UNIVERSITY OF LA..."` and turns black-on-purple in Barcode Station. | Force `!text-white` on the CR80 purple header, remove `truncate`, and use `text-[10.5px] font-black tracking-wide whitespace-nowrap`. |
| **10** | **Borrowers Directory White Mode** (`36.png`) | `"Computer Science (FA23)"` is invisible white-on-white, and the page icon badge is washed out. | Use `text-slate-800 dark:text-slate-100 font-semibold` for `Program / Class`, and `bg-purple-500/15 text-[#541A72] dark:text-[#FFD147] border border-purple-500/30` on header icon badges. |
| **11** | **Loan Duration Modal Backdrop** (`BarcodeStation.tsx` — `3.1.png`, `32.png`) | Dark blur overlay cuts off halfway down the screen. | Place the modal wrapper at the component root (`fixed inset-0 z-[100] bg-slate-950/75 backdrop-blur-md`) outside transformed child cards. |
| **12** | **Other Pages Frosted Upgrade** (`Reports & Audits`, `Circulation Desk`, `Barcode Station`, `Migration`, `System Settings`) | Cards use flat opaque fills instead of frosted crystal glass. | Apply the Frosted Card classes (`backdrop-blur-xl backdrop-saturate-[175%]` + specular inner rim) to all section headers and cards across every tab. |

---

## 💻 STEP 1: LOAD PREMIUM FONTS IN `index.html`

Inside `<head>` of `index.html`, ensure `Playfair Display`, `Space Grotesk`, `Plus Jakarta Sans`, and `JetBrains Mono` are present:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&family=Playfair+Display:wght@700;800;900&family=Plus+Jakarta+Sans:ital,wght@0,500;0,600;0,700;0,800;1,500&family=Space+Grotesk:wght@600;700&display=swap" rel="stylesheet">
```

---

## 💻 STEP 2: CREATE `src/components/ui/liquid-weather-glass.tsx` (FROSTED CRYSTAL LIQUID GLASS)

Create `src/components/ui/liquid-weather-glass.tsx` (and ensure `motion` is installed) with built-in **frosted crystal blur (`backdrop-blur-xl backdrop-saturate-[180%]`)**, diagonal frost sheen (`from-white/50 via-white/30 to-white/15 dark:from-white/[0.075] dark:via-white/[0.035] dark:to-white/[0.015]`), and `pointer-events-none` on all decorative layers:

```tsx
'use client';
import React, { useId, useState } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

export interface LiquidGlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  draggable?: boolean;
  expandable?: boolean;
  width?: string;
  height?: string;
  expandedWidth?: string;
  expandedHeight?: string;
  blurIntensity?: 'sm' | 'md' | 'lg' | 'xl';
  shadowIntensity?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  borderRadius?: string;
  glowIntensity?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  enableDistortion?: boolean;
}

export const LiquidGlassCard = ({
  children,
  className = '',
  draggable = false,
  expandable = false,
  width,
  height,
  expandedWidth,
  expandedHeight,
  blurIntensity = 'xl',
  borderRadius = '22px',
  glowIntensity = 'sm',
  shadowIntensity = 'sm',
  enableDistortion = false,
  ...props
}: LiquidGlassCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const filterId = useId().replace(/:/g, '');

  const handleToggleExpansion = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!expandable) return;
    if ((e.target as HTMLElement).closest('a, button, input, select, textarea')) return;
    setIsExpanded(!isExpanded);
  };

  const blurClasses = {
    sm: 'backdrop-blur-md backdrop-saturate-150',
    md: 'backdrop-blur-lg backdrop-saturate-[165%]',
    lg: 'backdrop-blur-xl backdrop-saturate-[175%]',
    xl: 'backdrop-blur-2xl backdrop-saturate-[185%]',
  };

  const shadowStyles = {
    none: 'inset 0 0 0 0 rgba(255, 255, 255, 0)',
    xs: 'inset 1px 1px 1.5px 0 rgba(255, 255, 255, 0.42), inset -1px -1px 1px 0 rgba(255, 255, 255, 0.14)',
    sm: 'inset 1.5px 1.5px 2px 0 rgba(255, 255, 255, 0.48), inset -1px -1px 1.5px 0 rgba(255, 255, 255, 0.16)',
    md: 'inset 2px 2px 3px 0 rgba(255, 255, 255, 0.52), inset -2px -2px 2px 0 rgba(255, 255, 255, 0.20)',
    lg: 'inset 3px 3px 4px 0 rgba(255, 255, 255, 0.56), inset -3px -3px 3px 0 rgba(255, 255, 255, 0.24)',
    xl: 'inset 4px 4px 6px 0 rgba(255, 255, 255, 0.60), inset -4px -4px 4px 0 rgba(255, 255, 255, 0.28)',
    '2xl': 'inset 6px 6px 8px 0 rgba(255, 255, 255, 0.65), inset -6px -6px 6px 0 rgba(255, 255, 255, 0.32)',
  };

  const glowStyles = {
    none: '0 4px 16px rgba(0, 0, 0, 0.08)',
    xs: '0 8px 24px rgba(0, 0, 0, 0.14), 0 0 16px rgba(255, 255, 255, 0.04)',
    sm: '0 10px 28px rgba(0, 0, 0, 0.18), 0 0 24px rgba(255, 255, 255, 0.06)',
    md: '0 12px 32px rgba(0, 0, 0, 0.22), 0 0 32px rgba(255, 255, 255, 0.09)',
    lg: '0 14px 36px rgba(0, 0, 0, 0.25), 0 0 40px rgba(255, 255, 255, 0.12)',
    xl: '0 16px 44px rgba(0, 0, 0, 0.28), 0 0 48px rgba(255, 255, 255, 0.16)',
    '2xl': '0 20px 56px rgba(0, 0, 0, 0.32), 0 0 60px rgba(255, 255, 255, 0.20)',
  };

  const MotionComponent: any = draggable || expandable ? motion.div : 'div';

  return (
    <>
      {enableDistortion && (
        <svg className="hidden" aria-hidden="true">
          <defs>
            <filter id={`glass-blur-${filterId}`} x="0" y="0" width="100%" height="100%" filterUnits="objectBoundingBox">
              <feTurbulence type="fractalNoise" baseFrequency="0.003 0.007" numOctaves="1" result="turbulence" />
              <feDisplacementMap in="SourceGraphic" in2="turbulence" scale="35" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </defs>
        </svg>
      )}

      <MotionComponent
        className={cn(
          'relative overflow-hidden border border-white/60 dark:border-white/[0.15] bg-gradient-to-br from-white/50 via-white/30 to-white/15 dark:from-white/[0.075] dark:via-white/[0.035] dark:to-white/[0.015]',
          draggable && 'cursor-grab active:cursor-grabbing',
          expandable && 'cursor-pointer',
          className
        )}
        style={{
          borderRadius,
          ...(width && !expandable && { width }),
          ...(height && !expandable && { height }),
        }}
        onClick={expandable ? handleToggleExpansion : undefined}
        {...props}
      >
        {/* Bend Layer (Frosted Crystal Blur) */}
        <div
          className={cn('absolute inset-0 pointer-events-none z-0', blurClasses[blurIntensity])}
          style={{
            borderRadius,
            ...(enableDistortion ? { filter: `url(#glass-blur-${filterId})` } : {}),
          }}
        />
        {/* Face Layer (Soft Depth Glow) */}
        <div
          className="absolute inset-0 pointer-events-none z-10"
          style={{ borderRadius, boxShadow: glowStyles[glowIntensity] }}
        />
        {/* Edge Layer (Curved Specular Rim Highlights) */}
        <div
          className="absolute inset-0 pointer-events-none z-20"
          style={{ borderRadius, boxShadow: shadowStyles[shadowIntensity] }}
        />
        {/* Foreground Content */}
        <div className="relative z-30 h-full">{children}</div>
      </MotionComponent>
    </>
  );
};

export default LiquidGlassCard;
```

---

## 💻 STEP 3: FROSTED OUTER SHELL, FLOATING HEADER & SIDEBAR (`App.tsx`, `PrimaryHeader.tsx`, `Sidebar.tsx`)

1. **In `src/App.tsx` (Outer Shell & Ambient Twilight Canvas)**:
   - Set the root background to a rich twilight gradient (`from-[#1C1233] via-[#17112B] to-[#1E1836]` in Dark Glass; `from-[#FCFBF7] via-[#F7F2FA] to-[#F3EDE0]` in White Glass) with soft violet and gold ambient glow orbs so the frosted glass layers have luminous depth to refract.
   - Add `p-2.5 sm:p-3.5 gap-3` around the main layout shell so the Header, Sidebar, and Main Content float as separate curved `26px` frosted islands (eliminating the sharp 90° top-left seam).
2. **In `src/components/PrimaryHeader.tsx` (Curved Frosted Header & Fix `+ + Add Book`)**:
   - Style `<header>` with:
     `rounded-[26px] mx-2.5 mt-2.5 sm:mx-3.5 sm:mt-3.5 px-4 sm:px-6 py-2.5 bg-gradient-to-br from-white/55 via-white/35 to-white/20 dark:from-white/[0.08] dark:via-[#18102B]/55 dark:to-[#120B22]/40 backdrop-blur-2xl backdrop-saturate-[180%] border border-white/65 dark:border-white/[0.16] shadow-[inset_1.5px_1.5px_2px_rgba(255,255,255,0.52),inset_-1px_-1px_1px_rgba(255,255,255,0.16),0_12px_32px_rgba(0,0,0,0.22)] transition-all`
   - Inside the Add Book button, change `<span>+ Add Book</span>` to `<span>Add Book</span>` so it does not double-render `+ + Add Book` next to `<Plus />`.
3. **In `src/components/Sidebar.tsx` (Curved Frosted Sidebar Dock)**:
   - Style `<aside>` with:
     `rounded-[26px] ml-2.5 mb-2.5 sm:ml-3.5 sm:mb-3.5 bg-gradient-to-br from-white/50 via-white/32 to-white/18 dark:from-white/[0.07] dark:via-[#160E28]/55 dark:to-[#110A20]/40 backdrop-blur-2xl backdrop-saturate-[180%] border border-white/60 dark:border-white/[0.15] shadow-[inset_1.5px_1.5px_2px_rgba(255,255,255,0.48),inset_-1px_-1px_1px_rgba(255,255,255,0.14),0_12px_32px_rgba(0,0,0,0.22)] overflow-hidden`

---

## 💻 STEP 4: FROSTED CATALOG CARDS & `<select>` DROPDOWN CONTRAST (`BooksCatalogView.tsx`)

1. **Top 4 Frosted Metric Stat Cards**:
   - Wrap each of the 4 cards in `<LiquidGlassCard borderRadius="22px" blurIntensity="xl" shadowIntensity="sm" glowIntensity="xs" className="p-4 flex flex-col justify-between gap-2.5 hover:border-[#FFD147]/65 transition-all">`.
   - Use `Space Grotesk` (`26px` bold upright numerals), `Plus Jakarta Sans` uppercase titles (`10.5px`, `tracking-[0.13em]`), subtle `italic` inline unit labels (`Distinct records`, `Physical items`, `Available now`, `On loan`), `28×28px` frosted glass icon badges (`rounded-xl`), and a **12-segment micro tick-bar** at the bottom of each card.
2. **Frosted Search & Filter Bar + `<option>` Contrast Fix (`1.1.png`)**:
   - Wrap the Search & View Switcher bar in `<LiquidGlassCard borderRadius="22px" blurIntensity="xl" className="p-3 space-y-2.5">`.
   - Style every `<select>` dropdown (`All Disciplines`, `All Languages`, `All Almaris`, `Sort: Newest`) with:
     `h-9 px-3.5 rounded-xl bg-white/55 dark:bg-[#1B1130]/75 backdrop-blur-xl border border-white/60 dark:border-white/15 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#FFD147]/80 cursor-pointer transition-all`
   - Add `className="bg-white dark:bg-[#181028] text-slate-900 dark:text-white py-1"` to **every `<option>` element** so opening a dropdown never displays an ugly OS grey/blue box.
   - Change the toolbar `+ + Add Book` button text to `<span>Add Book</span>`.
3. **Frosted Book Grid Cards**:
   - Style each book card in the grid with:
     `rounded-[22px] bg-gradient-to-br from-white/50 via-white/30 to-white/15 dark:from-white/[0.07] dark:via-white/[0.03] dark:to-white/[0.015] backdrop-blur-xl backdrop-saturate-[175%] border border-white/60 dark:border-white/[0.14] shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.45),inset_-1px_-1px_1px_rgba(255,255,255,0.12),0_8px_24px_rgba(0,0,0,0.16)] hover:border-[#FFD147]/60 hover:-translate-y-0.5 transition-all`

---

## 💻 STEP 5: MANUAL ALMARI VIEW & EDIT MODAL UI-ONLY FIXES (`AlmariView.tsx`)

1. **Frosted Containers**:
   - Apply the Frosted Card classes (`rounded-[22px] bg-gradient-to-br from-white/50 via-white/30 to-white/15 dark:from-white/[0.07] dark:via-white/[0.03] dark:to-white/[0.015] backdrop-blur-xl backdrop-saturate-[175%] border border-white/60 dark:border-white/[0.14]`) to the top toolbar, the Left Cupboards panel, and the Unassigned Queue panel.
2. **Fix Search Input Icon Overlap (`2.1.png`, `22.1.png`)**:
   - Update the cupboard search `<input>` padding from `pl-8` to `pl-9 pr-8` and position `<Search />` at `left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5`.
3. **Fix White Glass Mode Plaque & Shelf Contrast (`22.1.png`)**:
   - Force `!text-white` on the selected cupboard card's title and `{allocated} / {capacity} vols` badge, and force `!text-white` on the right-hand 3D Bookshelf dark purple plaque title (`<h3>{selectedAlmari.name_en}</h3>`).
   - Style each `SHELF {shelfNo}` badge with `text-[#7A4B00] dark:text-[#FFD147] bg-amber-500/15 dark:bg-black/40 border border-[#C8963E]/40 dark:border-[#FFD147]/30`.
4. **Fix `Edit Almari` Modal `Delete Cupboard` Button (`22.21.png`)**:
   - Style the `Delete Cupboard` button with `bg-rose-500/15 hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 border border-rose-500/40 font-extrabold`.

---

## 💻 STEP 6: BORROWERS, CR80 ID CARD, BARCODE STATION & OTHER PAGES FROSTED POLISH

1. **Fix `Edit Library Borrower Profile` Modal Clipping & White Mode Contrast (`02_26_PM.png`, `38.png`)**:
   - Style the modal backdrop with `fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md`.
   - Style the modal container with `w-full max-w-5xl max-h-[90vh] flex flex-col rounded-[26px] bg-white/90 dark:bg-[#140D22]/90 backdrop-blur-2xl backdrop-saturate-[180%] border border-white/60 dark:border-white/15 shadow-2xl overflow-hidden`—with a `shrink-0` header, `flex-1 overflow-y-auto` form body, and `shrink-0` footer so top/bottom controls are never clipped.
   - Set `"Member Portrait Photo (4:5 Crop, 300 x 375 px)"` label to `text-slate-800 dark:text-slate-100 font-bold`.
2. **Fix CR80 Smart ID Card Header & Body Contrast (`UlmSmartIdCard.tsx` / `22.31.png`, `33.png`, `02_26_PM.png`)**:
   - Force `!text-white` on `"UNIVERSITY OF LAKKI MARWAT"` inside the purple CR80 header banner, remove `truncate`, and set `text-[10.5px] font-black tracking-wide whitespace-nowrap`.
   - Scope all text inside the white PVC `.cr80-card` body (`Asad Zeb`, `ulm099`, `BS Computer Science`, `Department`) to `text-[#1A1027]` so it never turns white-on-white in White Glass mode.
3. **Fix `Borrowers & Faculty Directory` (`36.png`) & `Loan Duration Selector` Modal (`3.1.png`, `32.png`)**:
   - Set `Program / Class` on patron cards to `text-slate-800 dark:text-slate-100 font-semibold`.
   - Render the `Loan Duration Selector` modal overlay at the root of `BarcodeStation.tsx` (`fixed inset-0 z-[100] bg-slate-950/75 backdrop-blur-md`) outside any transformed child card so the blur covers the entire screen.
4. **Apply Frosted Crystal Liquid-Glass to All Remaining Views (`Reports & Audits`, `Circulation Desk`, `Barcode Station`, `Excel & PC Migration`, `System Settings`)**:
   - Upgrade all section banners and cards on those pages to the Frosted Card classes (`rounded-[22px] bg-gradient-to-br from-white/50 via-white/30 to-white/15 dark:from-white/[0.07] dark:via-white/[0.03] dark:to-white/[0.015] backdrop-blur-xl backdrop-saturate-[175%] border border-white/60 dark:border-white/[0.14] shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.45),0_8px_24px_rgba(0,0,0,0.16)]`) without altering any underlying handlers or state.