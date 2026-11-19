# 📊 ULM LMS — UNIFIED REPORTS & AUDITS BENTO DASHBOARD MASTER PROMPT

> **How to use this prompt:**
> Copy and paste the entire directive below into **Google AI Studio** (`Labrary-app-3.0`). It consolidates all **5 separate Reports & Audits tabs** (`Overview`, `Circulation`, `Collection`, `Overdue & Fines`, `Data Health`) into **one unified, zero-clutter Bento Dashboard page** modeled directly on your reference layout—with tight `16px` gutters, 32-segment KPI tick-bars, smooth area curves, a Donut + segmented share table, and a monospace Database Health & Overdue console—while preserving **100% of your live data, CSV exports, official printing, and real SQLite audit logic**.

# 🏛️ SYSTEM DIRECTIVE: UNIFY ALL 5 REPORTS & AUDITS TABS INTO ONE BENTO DASHBOARD

You are the Principal Lead Architect and Design Systems Engineer for the **University of Lakki Marwat (ULM) Central Campus Library System**.

### 🎯 OBJECTIVE:

Locate the **Reports & Audits** view component (the page rendering `"Campus Library Analytics & Inventory Audit"` with the 5 sub-tabs: `Overview`, `Circulation`, `Collection`, `Overdue & Fines`, `Data Health`).

Refactor its layout to **combine ALL 5 tabs into ONE unified Bento Dashboard page** (removing the 5-tab navigation strip) using the exact structural grid, spacing, and card anatomy below, while **preserving 100% of existing data calculations, SQLite queries, CSV export functions, and print handlers**.

## ⛔ STRICT PRESERVATION RULES (ZERO FUNCTION LOSS):

1. **Keep all live data sources & props intact**:

   * Keep all calculations for `totalTitles`, `totalCopies`, `onShelf`, `onLoan`, `overdueLoans`, `activeBorrowers`, `circulationOverTime`, `topBorrowedTitles`, `departmentBorrowing`, `disciplineHoldings`, `languageDistribution`, `overdueActionList`, and `runRealAudit`.

2. **Keep all action buttons working**:

   * Top-right filter dropdown (`All Records` / timeframe), `Export CSV`, `Print Official Report`, `Print Action List`, and `Run Real Audit`.

3. **Support both Dark Glass and White Glass themes**:

   * Use semantic Tailwind tokens (`bg-white/75 dark:bg-[#140D22]/80`, `border-slate-200/80 dark:border-white/10`, `text-slate-900 dark:text-white`) with ULM Royal Purple (`#541A72`) and 24K Gold (`#FFD147` / `#C8963E`) accents.

## 📐 UNIFIED BENTO ARCHITECTURE (ALL 5 TABS IN ONE PAGE)

### HEADER BAR (Compact Single Row)

* **Left**: `28×28px` bordered icon badge + `"Campus Library Analytics & Inventory Audit"` + subtitle `"Unified inventory, circulation velocity, collection mix, overdue action & SQLite integrity."`

* **Right**: Filter dropdown (`All Records`), `Run Real Audit` button (emerald pill), `Export CSV` button (purple pill), and `Print Official Report` button (gold pill).

### ROW 1: 4-COLUMN KPI STRIP (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4`)

Consolidate the 6 legacy KPIs into **4 crisp Segmented Tick-Bar KPI Cards** (preserving every metric):

1. **Card 1 — Cataloged Holdings**:

   * Top: `"Cataloged Holdings"` + `28×28px` `⋮` / icon button.

   * Hero: `{totalTitles.toLocaleString()}` (`text-3xl font-extrabold tabular-nums`).

   * Context: Left `"of {totalCopies.toLocaleString()} copies"` | Right `"{totalTitles} / {totalCopies}"`.

   * Footer: **32-segment vertical tick-bar** (filled emerald/purple pills representing catalog completeness).

2. **Card 2 — Shelf Availability**:

   * Top: `"On Shelf Available"`.

   * Hero: `{onShelf.toLocaleString()}`.

   * Context: Left `"of {totalCopies.toLocaleString()} total"` | Right `"{availabilityPct}%"`.

   * Footer: **32-segment vertical tick-bar** (filled emerald `#10B981` pills proportional to `onShelf / totalCopies`).

3. **Card 3 — Active Loans & Borrowers**:

   * Top: `"On Loan & Borrowers"`.

   * Hero: `{onLoan.toLocaleString()}`.

   * Context: Left `"{activeBorrowers} active borrowers"` | Right `"{onLoan} / {totalCopies}"`.

   * Footer: **32-segment vertical tick-bar** (filled royal blue/gold pills).

4. **Card 4 — Overdue & Fines**:

   * Top: `"Overdue & Delinquency"`.

   * Hero: `{overdueLoans.toLocaleString()}`.

   * Context: Left `"Rs. {totalFines.toLocaleString()} accrued"` | Right `"{overdueLoans} / {onLoan || 1}"`.

   * Footer: **32-segment vertical tick-bar** (filled crimson `#F43F5E` when `overdueLoans > 0`, or muted/emerald when `0`).

**Segmented Tick-Bar Helper Component** (render inside each Row 1 card):

```
function SegmentedTickBar({
  ratio,
  colorClass = "bg-emerald-500",
  segments = 32,
}: {
  ratio: number;
  colorClass?: string;
  segments?: number;
}) {
  const filled = Math.max(
    ratio > 0 ? 1 : 0,
    Math.min(segments, Math.round(ratio * segments))
  );
  return (
    <div className="flex items-center gap-[3px] mt-3" aria-hidden>
      {Array.from({ length: segments }).map((_, i) => (
        <span
          key={i}
          className={`h-3.5 flex-1 rounded-[2px] transition-all ${
            i < filled ? colorClass : "bg-slate-200 dark:bg-white/[0.08]"
          }`}
        />
      ))}
    </div>
  );
}

```

### ROW 2: ASYMMETRIC 60 / 40 SPLIT (`grid-cols-1 lg:grid-cols-12 gap-4`)

1. **Left (`lg:col-span-7`) — Circulation Activity Over Time** *(from Tab 1: Overview)*:

   * Header: `28×28px` bordered icon badge + `"Circulation Activity Over Time"` on left; segmented toggle (`7d` | `30d` | `All`) on right.

   * Sub-header: Bold total circulation count on left; inline dot legend (`• {issuedCount} issued` `• {returnedCount} returned`) on right.

   * Chart: Smooth `AreaChart` (Recharts `type="monotone"`) with subtle vertical gradient fill under the primary curve, faint horizontal gridlines (`strokeDasharray="3 3"`), and clean `tabular-nums` axes.

2. **Right (`lg:col-span-5`) — Shelf vs Loan Ratio & Language Mix** *(from Tab 3: Collection)*:

   * Header: `28×28px` bordered icon badge + `"Collection & Language Ratio"` + `"{totalCopies.toLocaleString()} vols"` pill.

   * Hero Ratio: `"{availPct}% / {loanPct}%"` above a sleek **dual-color horizontal split bar** (`emerald` vs `amber/purple`) with exact counts underneath (`"{onShelf.toLocaleString()} on shelf"` vs `"{onLoan.toLocaleString()} on loan"`).

   * **Inset 2-Column Sub-Box** (`rounded-xl bg-slate-100/70 dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/10 grid grid-cols-2 divide-x divide-slate-200/70 dark:divide-white/10 p-3 my-3`):

     * Left: `{totalTitles.toLocaleString()}` / `"Cataloged Titles"`

     * Right: `{disciplineCount}` / `"Academic Disciplines"`

   * **Language Breakdown List** (`English`, `Urdu`, `Pashto`, `Arabic`):

     * Each row: colored dot + language name on left; `"{count.toLocaleString()} ({pct}%)"` in `font-mono tabular-nums` on right.

   * Footer: `"Official Fine Rate: Rs. 10/day"` on left | `"Sync: 100%"` on right.

### ROW 3: ASYMMETRIC 3-COLUMN BENTO (`grid-cols-1 lg:grid-cols-12 gap-4`)

1. **Left (`lg:col-span-3`) — Top Borrowed & Department Activity** *(from Tab 2: Circulation)*:

   * Header: `28×28px` bordered icon badge + `"Circulation Leaders"`.

   * Compact `divide-y` list:

     * **Top Borrowed Titles**: Rank badge (`#1`), book title, monospace barcode (`0092000000002`), and right-aligned `"{loans} loans"` pill.

     * **Active Borrowing by Department**: Compact department rows (`Computer Science · 100%`) with thin progress indicator.

2. **Center (`lg:col-span-5`) — Discipline & Language Donut + Segmented Share Table** *(from Tab 3: Collection)*:

   * Header: `28×28px` bordered icon badge + `"Holdings Distribution"` + toggle (`By Language` | `By Discipline`).

   * Side-by-side layout (`grid-cols-1 sm:grid-cols-12 gap-4 items-center`):

     * **Left (5 cols)**: Thick-ring Donut chart with centered total (`{totalCopies.toLocaleString()}` / `"total"`).

     * **Right (7 cols)**: Clean 3-column table (`Category` | `Copies` | `Share`) where the **Share** column renders an **8-segment mini pill bar** matching the Row 1 KPI cards:

       ```
       function MiniShareBar({ ratio }: { ratio: number }) {
         const filled = Math.max(ratio > 0 ? 1 : 0, Math.min(8, Math.round(ratio * 8)));
         return (
           <div className="flex items-center gap-[2px]">
             {Array.from({ length: 8 }).map((_, i) => (
               <span
                 key={i}
                 className={`h-2.5 w-1.5 rounded-[2px] ${
                   i < filled ? "bg-[#541A72] dark:bg-[#FFD147]" : "bg-slate-200 dark:bg-white/10"
                 }`}
               />
             ))}
           </div>
         );
       }
       
       ```

3. **Right (`lg:col-span-4`) — Live Database Health & Overdue Console** *(from Tabs 4 & 5: Overdue & Data Health)*:

   * Header: `28×28px` bordered icon badge + `"Integrity & Overdue Console"` + inline mini pill switcher (`Data Health` | `Overdue ({overdueLoans})`) + `Run Real Audit` / `Print Action List` icon buttons.

   * **Data Health View (Monospace Console Style)**:

     * Renders real SQLite/LocalStorage invariant check rows in crisp `font-mono text-xs` with `divide-y` hairlines:

       * Timestamp / Check Name | `PASS` (emerald) or `WARN` (amber) badge | Detail (e.g., `Foreign Keys · 0 orphans`, `Counter Drift · 0 mismatches`, `Barcode Collisions · 0 dupes`, `Catalog Sync · 100%`).

     * If audit hasn't been run yet, displays a compact `"Click Run Real Audit to scan SQLite records"` prompt with an inline `Run Real Audit` button.

   * **Overdue View**:

     * Shows `Overdue Action List ({overdueLoans} Volumes)` with borrower name, book title, days overdue, and fine (`Rs. 10/day`), or the clean `"Zero Overdue Records"` state, plus `Export CSV` and `Print Action List` buttons.

### ROW 4 (CONDITIONAL FULL-WIDTH ACTION LEDGER — ONLY WHEN OVERDUE > 0 OR AUDIT EXPANDED)

* Whenever `overdueActionList.length > 0` or the user clicks `"Expand Full Audit Ledger"`, render a clean full-width Bento table card below Row 3 showing the complete itemized Overdue Action List or Database Health Invariant Table with `Export CSV` and `Print` controls so no record is ever hidden or clipped.

## 🎨 VISUAL & SPACING TOKENS (STRICTLY ENFORCE)

* **Outer Container**: `space-y-4` (`16px` vertical rhythm between all rows).

* **Grid Gutters**: `gap-4` (`16px` uniform horizontal & vertical gaps).

* **Card Shell**: `rounded-2xl bg-white/75 dark:bg-[#140D22]/80 backdrop-blur-2xl border border-slate-200/80 dark:border-white/10 p-4 sm:p-5 shadow-xs`.

* **Card Header Icon Badge**: `w-7 h-7 rounded-lg bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-600 dark:text-[#FFD147] shrink-0`.

* **Numbers**: Always apply `tabular-nums` on every metric, fraction, percentage, and table cell.

## ✅ FINAL CHECK

1. Confirm **all 5 tabs' data** (`Overview`, `Circulation`, `Collection`, `Overdue & Fines`, `Data Health`) is visible and interactive on **one unified Bento page** without needing to click through 5 separate tabs.

2. Confirm `Export CSV`, `Print Official Report`, `Print Action List`, and `Run Real Audit` continue executing against real SQLite/LocalStorage data.