# ULM Central Campus Library — Live Data Analytics & Charts Integration

Replaces all static, hardcoded fallback metrics in the Catalog Analytics dashboard with 100% live, dynamic calculations derived directly from the real book catalog, active circulation loan records, and physical Almari cupboards (including drag-and-drop master placement overrides).

## User Review & Critical Decisions

> [!IMPORTANT]
> Both design and data-binding decisions have been confirmed and incorporated into this plan:

- **Confirmed Decision 1 (100% Live Catalog & Circulation Metrics)**: All KPI cards, discipline bar charts, classification donut slices, and circulation velocity curves will compute directly from live catalog books and active loan records without inflating to static 5,000-volume or 142-loan mock numbers.
- **Confirmed Decision 2 (Master Placement Override Resolution)**: Physical Stacks & Density will merge `ulm_almari_placements_master_v3` overrides with book properties so any volumes dragged onto shelves in the 3D Almari view are immediately reflected in each cupboard's volume count.

---

## 1. Overview & Core Concept

- **What It Does**: Dynamically aggregates the active library catalog, circulation transactions, and registered Almari cupboards into real-time executive KPIs, area trend curves, faculty bar comparisons, classification donut charts, and physical stack density cards.
- **Target Audience / Persona**: University Librarians, Chief Librarian, and Academic Deans inspecting real-time campus collection holdings and borrowing activity.
- **Key Value**: Eliminates discrepancy between the main catalog metric cards (e.g., 11 cataloged volumes) and the Analytics tab, providing a single source of truth across all views.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Real-Time KPI Inspection**: Switching to the **Analytics** tab in the Books Catalog immediately displays the exact count of cataloged volumes, active circulation loans, shelf availability percentage (`((available / total) * 100).toFixed(1)%`), and overdue loans.
  2. **Interactive Timeframe Switching**: Selecting between `Past 7 Days`, `Past 30 Days`, `Fall 2026 Semester`, and `Academic Year 2026-27` dynamically recalculates the Circulation Velocity (Issue vs Return Flow) area chart based on live loan activity.
  3. **Faculty & Classification Breakdown**: Viewing the bar chart and donut chart shows every real academic discipline and classification category present in the catalog, with accurate `On Shelf Available` vs `Currently Issued` counts and a live center total on the donut chart.
  4. **Physical Cupboard Density**: Inspecting the **Physical Stacks & Density** panel displays all registered cupboards from `AlmariService.getAlmaris()` along with their exact assigned book counts (including 3D drag-and-drop placements).
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: High-craft institutional dashboard blending ULM Royal Purple (`#541A72`) and 24K Academic Gold (`#C8963E`) with crisp dual-theme (Light White Glass / Dark Obsidian) surfaces.
  - *Color Palette & Mood*: Semantic chart tokens (`--chart-1: #541A72`, `--chart-2: #C8963E`, `--chart-3: #10B981`, `--chart-4: #F59E0B`, `--chart-5: #3B82F6`) paired with `bg-white/70 dark:bg-[#140D22]/70` frosted glass containers and `border-slate-200/80 dark:border-white/10` hairline borders.
  - *Typography & Hierarchy*: Crisp display headings, `font-mono tabular-nums` for all numeric counters, percentages, and volume badges to prevent layout jitter.
  - *Component Styling & Layout*: 1440px+ responsive multi-row grid: Row 1 (4-column KPI strip), Row 2 (2-column Area Trend + Discipline Bar Compare), Row 3 (3-column split with 2-col Classification Donut + 1-col Physical Stacks & Density card).

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Zero Artificial Floor on KPIs & Charts**
  - *Chosen Approach*: Compute `totalPhysicalVolumes`, `activeLoansCount`, `availabilityPercentage`, and `overdueCount` directly from the live `books` and `transactions` / `ulm_circulation_records_v1` arrays.
  - *Why*: Previously, `Math.max(totalCopies, 5000)` and `Math.max(..., 142)` forced small or newly imported catalogs (e.g., 11 books) to display 5,000 volumes and 142 loans. Removing the artificial floor ensures 100% accuracy.
- **Decision 2: Dual-Key Placement Resolution in Stack Density**
  - *Chosen Approach*: Read `ulm_almari_placements_master_v3` alongside `book.almari_id`, `book.almari_code`, and `book.cupboard` when counting volumes per Almari cupboard.
  - *Why*: Ensures that books dragged between shelves in the 3D Almari Cupboard view are immediately counted in the Analytics tab without requiring a page reload.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         BooksCatalogView                                │
│  • Holds live `books` & `transactions` state                            │
│  • Passes `books={books}` & `transactions={transactions}`               │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      CatalogVisualAnalytics                             │
│                                                                         │
│  ┌───────────────────────┐  ┌───────────────────────┐                   │
│  │ Live Data Resolvers   │  │ Master Placement Sync │                   │
│  │ • Prop `books`        │  │ • `AlmariService`     │                   │
│  │ • `localStorage` sync │  │ • `ulm_almari_place…` │                   │
│  └───────────┬───────────┘  └───────────┬───────────┘                   │
│              └──────────────┬───────────┘                               │
│                             ▼                                           │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ Dynamic Aggregation Engine (`useMemo`)                            │  │
│  │ • Core KPIs: Total Volumes, Active Loans, Availability %, Overdue │  │
│  │ • Circulation Velocity: 7d / 30d / semester / year series         │  │
│  │ • Discipline Breakdown: Available vs Issued per real category     │  │
│  │ • Classification Donut: Real volume distribution + center total   │  │
│  │ • Stacks Density: Live Almari list with assigned volume counts    │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Interactive Component & State Mapping

- **Timeframe Switcher (`7d` | `30d` | `semester` | `year`)**: Updates `timeframe` state and recomputes `circulationVelocityData` from live active loan and return counts.
- **KPI Strip (`KpiCard` x4)**: Displays live `totalPhysicalVolumes`, `activeLoansCount`, `availabilityPercentage`, and `overdueCount` with proportional sparkline trends.
- **Discipline Bar Chart (`BarCompare`)**: Groups all live books by `discipline || category || 'General Stack'`, summing available and issued copies per faculty.
- **Classification Donut (`DonutBreakdown`)**: Groups all live books by classification/material type and renders the exact `totalPhysicalVolumes` in the donut center.
- **Physical Stacks & Density List**: Iterates through `AlmariService.getAlmaris()`, resolves each book's effective cupboard via `ulm_almari_placements_master_v3` and book fields, and displays the live volume count per cupboard.
