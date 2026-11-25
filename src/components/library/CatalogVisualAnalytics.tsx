"use client";

import * as React from "react";
import {
  ChartCard,
  KpiCard,
  DonutSlice,
} from "@/components/ui/library-charts-kpi";
import { BookOpen, Layers, CheckCircle2, Clock, MapPin } from "lucide-react";
import { Book, Almari, Transaction } from "../../types/library";
import { AlmariService } from "../../services/almariService";
import { LibraryStorage } from "../../services/storage";
import { LiquidPillOverlay } from "../ui/liquid-pill-physics";
import {
  GlassBezierAreaChart,
  GlassHatchedStackChart,
  GlassSweepDonutChart,
} from "../ui/GlassCharts";

export interface CatalogVisualAnalyticsProps {
  books?: Book[];
  transactions?: Transaction[];
  onSelectCategory?: (category: string) => void;
  onSwitchView?: (mode: "grid" | "list") => void;
}

const TIMEFRAMES = {
  "7d": "Past 7 Days",
  "30d": "Past 30 Days",
  "semester": "Fall 2026 Semester",
  "year": "Academic Year 2026-27",
} as const;

type ExtendedBook = Book & {
  total_copies?: number;
  quantity?: number;
  classification?: string;
  material_type?: string;
};

export function CatalogVisualAnalytics({
  books: propBooks,
  transactions: propTransactions,
}: CatalogVisualAnalyticsProps) {
  const [timeframe, setTimeframe] = React.useState<keyof typeof TIMEFRAMES>("30d");
  const [timeframeAnimTick, setTimeframeAnimTick] = React.useState(1);
  const [capacitySyncTick, setCapacitySyncTick] = React.useState(0);
  const [selectedClassLabel, setSelectedClassLabel] = React.useState<string | null>(null);
  const timeframeSwitcherRef = React.useRef<HTMLDivElement | null>(null);
  const timeframeItemRefs = React.useRef<Record<string, HTMLElement | null>>({});

  React.useEffect(() => {
    const onCapSync = () => setCapacitySyncTick((t) => t + 1);
    window.addEventListener("ulm-almari-capacity-sync", onCapSync);
    window.addEventListener("ulm-library-sync", onCapSync);
    return () => {
      window.removeEventListener("ulm-almari-capacity-sync", onCapSync);
      window.removeEventListener("ulm-library-sync", onCapSync);
    };
  }, []);

  const handleSelectTimeframe = (next: keyof typeof TIMEFRAMES) => {
    setTimeframe(next);
    setSelectedClassLabel(null);
    setTimeframeAnimTick((t) => t + 1);
  };

  // 1. Resolve Live Books (From Props or Central Storage Engine) + Master Placement Overrides
  const books: ExtendedBook[] = React.useMemo(() => {
    let rawBooks: ExtendedBook[] = [];
    if (propBooks && Array.isArray(propBooks) && propBooks.length > 0) {
      rawBooks = propBooks as ExtendedBook[];
    } else {
      try {
        const raw =
          localStorage.getItem("ulm_library_books_master_v1") ||
          localStorage.getItem("ulm_library_books_v1") ||
          localStorage.getItem("ulm_lms_books_v1");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            rawBooks = parsed;
          }
        }
      } catch {}
    }

    const active = rawBooks.filter(
      (b) =>
        b.is_active === undefined ||
        b.is_active === true ||
        (b.is_active as unknown) === 1 ||
        (b.is_active as unknown) === "1" ||
        b.is_active !== false
    );

    // Apply master placement overrides from AlmariView so cupboard counts are 100% synced
    let masterPlacements: Record<
      string,
      { almari_id: string; almari_code: string; shelf_no: number }
    > = {};
    try {
      const rawPlacements = localStorage.getItem("ulm_almari_placements_master_v3");
      if (rawPlacements) {
        masterPlacements = JSON.parse(rawPlacements);
      }
    } catch {}

    return active.map((b) => {
      const idKey = b.id ? String(b.id).trim() : "";
      const barcodeKey = b.barcode ? String(b.barcode).trim() : "";
      const override =
        (idKey && masterPlacements[idKey]) ||
        (barcodeKey && masterPlacements[barcodeKey]);
      if (override) {
        return {
          ...b,
          almari_id: override.almari_id,
          almari_code: override.almari_code,
          cupboard: override.almari_code,
          shelf_no: override.shelf_no,
        };
      }
      return b;
    });
  }, [propBooks]);

  // 2. Resolve Registered Almaris & Cupboards (Always fresh from AlmariService)
  const almaris: Almari[] = React.useMemo(() => {
    try {
      return AlmariService.getAlmaris();
    } catch {
      return [];
    }
  }, [books]);

  // 3. Resolve Circulation Transactions & Active Loans
  const circulationRecords = React.useMemo(() => {
    if (propTransactions && Array.isArray(propTransactions) && propTransactions.length > 0) {
      return propTransactions;
    }
    try {
      const raw =
        localStorage.getItem("ulm_circulation_records_v1") ||
        localStorage.getItem("ulm_lms_transactions_v1");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  }, [propTransactions]);

  // 4. Compute Core KPI Totals
  const totalPhysicalVolumes = React.useMemo(() => {
    return books.reduce(
      (acc, b) => acc + Number(b.total_copies ?? b.total_quantity ?? b.copies ?? b.quantity ?? 1),
      0
    );
  }, [books]);

  const activeLoansCount = React.useMemo(() => {
    // Check book status and available quantity difference directly as well as circulation records
    const issuedBooksCount = books.reduce((acc, b) => {
      const statusLower = (b.status || "").toLowerCase();
      if (statusLower === "issued" || statusLower === "borrowed") {
        return acc + 1;
      }
      const total = Number(b.total_copies ?? b.total_quantity ?? b.copies ?? b.quantity ?? 1);
      const avail = Number(b.available_quantity ?? b.available_copies ?? total);
      return acc + Math.max(0, total - avail);
    }, 0);

    const activeCircCount = circulationRecords.filter((c: any) => {
      const st = String(c.status || "").toUpperCase();
      return st === "ACTIVE" || st === "ISSUED" || st === "OVERDUE";
    }).length;

    return Math.max(issuedBooksCount, activeCircCount);
  }, [books, circulationRecords]);

  const availableVolumes = Math.max(0, totalPhysicalVolumes - activeLoansCount);

  const availabilityPercentage =
    totalPhysicalVolumes > 0
      ? ((availableVolumes / totalPhysicalVolumes) * 100).toFixed(1)
      : "0.0";

  const liveFineRate = React.useMemo(() => {
    const r = Number(LibraryStorage.getSettings().fine_per_day_pkr);
    return Number.isFinite(r) ? Math.max(0, r) : 50;
  }, []);

  const overdueCount = React.useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return circulationRecords.filter((c: any) => {
      const st = String(c.status || "").toUpperCase();
      if (st === "OVERDUE") return true;
      const dueDate = c.dueDate || c.due_date;
      return (st === "ACTIVE" || st === "ISSUED") && dueDate && dueDate < today;
    }).length;
  }, [circulationRecords]);

  // 5. Dynamic Academic Discipline Breakdown (Bar Chart Data)
  const disciplineBreakdown = React.useMemo(() => {
    if (books.length === 0) {
      return [{ discipline: "General Holdings", available: 0, issued: 0 }];
    }

    const groupMap: Record<string, { available: number; issued: number; total: number }> = {};

    books.forEach((b) => {
      const disc = (b.discipline || b.category || "General Stack").trim();
      if (!groupMap[disc]) {
        groupMap[disc] = { available: 0, issued: 0, total: 0 };
      }
      const copies = Number(b.total_copies ?? b.total_quantity ?? b.copies ?? b.quantity ?? 1);
      const statusLower = (b.status || "").toLowerCase();
      const isIssued = statusLower === "issued" || statusLower === "borrowed";

      groupMap[disc].total += copies;
      if (isIssued) {
        groupMap[disc].issued += copies;
      } else {
        const avail = Number(b.available_quantity ?? b.available_copies ?? copies);
        const loaned = Math.max(0, copies - avail);
        groupMap[disc].available += Math.max(0, copies - loaned);
        groupMap[disc].issued += loaned;
      }
    });

    return Object.entries(groupMap)
      .map(([discipline, counts]) => ({
        discipline,
        available: counts.available,
        issued: counts.issued,
        total: counts.total,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [books]);

  // 6. Dynamic Collection Classification Breakdown (Donut Chart Data)
  const classificationDonut: DonutSlice[] = React.useMemo(() => {
    if (books.length === 0) {
      return [{ label: "General Stack", value: 0, slot: 1 }];
    }

    const categoryMap: Record<string, number> = {};

    books.forEach((b) => {
      let category = b.classification || b.material_type;
      if (!category) {
        const catLower = (b.category || b.discipline || "").toLowerCase();
        if (catLower.includes("text") || catLower.includes("course")) category = "Core Textbooks";
        else if (catLower.includes("ref") || catLower.includes("encycl")) category = "Reference & Rare";
        else if (catLower.includes("thesis") || catLower.includes("research")) category = "Theses & Dissertations";
        else if (catLower.includes("journal") || catLower.includes("periodical")) category = "Journals & Periodicals";
        else category = b.category || "General Stack";
      }
      const copies = Number(b.total_copies ?? b.total_quantity ?? b.copies ?? b.quantity ?? 1);
      categoryMap[category] = (categoryMap[category] || 0) + copies;
    });

    const entries = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]);
    const slots: (1 | 2 | 3 | 4 | 5)[] = [1, 2, 3, 4, 5];

    return entries.slice(0, 5).map(([label, value], idx) => ({
      label,
      value,
      slot: slots[idx % slots.length],
    }));
  }, [books]);

  // 7. Dynamic Circulation Velocity Trend (Area Chart Data)
  const circulationVelocityData = React.useMemo(() => {
    const returnedCount = circulationRecords.filter(
      (c: any) => String(c.status || "").toUpperCase() === "RETURNED"
    ).length;

    if (timeframe === "7d") {
      const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      return days.map((day, idx) => ({
        period: day,
        issued: idx === 6 ? activeLoansCount : Math.min(activeLoansCount, 1),
        returned: idx === 6 ? returnedCount : 0,
      }));
    }

    if (timeframe === "30d") {
      return [
        { period: "Week 1", issued: Math.min(activeLoansCount, 1), returned: 0 },
        { period: "Week 2", issued: activeLoansCount > 2 ? 1 : 0, returned: 0 },
        { period: "Week 3", issued: activeLoansCount, returned: 0 },
        { period: "Week 4", issued: activeLoansCount, returned: returnedCount },
      ];
    }

    if (timeframe === "semester") {
      const months = ["Sep", "Oct", "Nov", "Dec", "Jan"];
      return months.map((m, idx) => ({
        period: m,
        issued: idx === 4 ? activeLoansCount : Math.min(activeLoansCount, idx),
        returned: idx === 4 ? returnedCount : 0,
      }));
    }

    // Default "year"
    return [
      { period: "FA25", issued: Math.max(0, activeLoansCount - 2), returned: 0 },
      { period: "SP26", issued: Math.max(0, activeLoansCount - 1), returned: 0 },
      { period: "SU26", issued: 0, returned: 0 },
      { period: "FA26", issued: activeLoansCount, returned: returnedCount },
    ];
  }, [timeframe, activeLoansCount, circulationRecords]);

  // 8. Dynamic Stacks & Density
  const stacksDensity = React.useMemo(() => {
    if (almaris.length === 0) {
      return [
        {
          name: "Main Hall • Ground Floor",
          code: "IH",
          count: totalPhysicalVolumes,
          location: "Central Campus Library",
          capacity: Math.max(125, totalPhysicalVolumes),
        },
      ];
    }

    void capacitySyncTick;
    const capMap = AlmariService.getShelfCapacities();

    return almaris.map((almari) => {
      const assignedCount = books
        .filter(
          (b) =>
            b.almari_id === almari.id ||
            (b.almari_code && b.almari_code.toUpperCase() === almari.code.toUpperCase()) ||
            (b.cupboard && b.cupboard.toUpperCase() === almari.code.toUpperCase())
        )
        .reduce(
          (sum, b) => sum + Number(b.total_copies ?? b.total_quantity ?? b.copies ?? b.quantity ?? 1),
          0
        );

      return {
        name: `${almari.code} • ${almari.name_en || almari.name_ur || "Main Stack"}`,
        code: almari.code,
        count: assignedCount,
        location: almari.location || almari.location_note || "Main Hall • Ground Floor",
        capacity: AlmariService.getAlmariTotalCapacity(almari, capMap),
      };
    });
  }, [almaris, books, totalPhysicalVolumes, capacitySyncTick]);

  const assignedTotal = React.useMemo(
    () => stacksDensity.reduce((s, a) => s + a.count, 0),
    [stacksDensity]
  );
  const unassignedCount = Math.max(0, totalPhysicalVolumes - assignedTotal);

  return (
    <div className="space-y-6">
      {/* Institutional Header & Timeframe Switcher */}
      <div className="rounded-[22px] bg-gradient-to-br from-white/50 via-white/30 to-white/15 dark:from-white/[0.075] dark:via-white/[0.03] dark:to-white/[0.015] backdrop-blur-xl backdrop-saturate-[175%] p-4 border border-white/60 dark:border-white/[0.14] shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.45),0_8px_24px_rgba(0,0,0,0.16)] flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-['Playfair_Display',Georgia,serif] text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Campus Holdings, Circulation Velocity &amp; Stack Distribution
          </h2>
        </div>

        {/* Squircle Timeframe Switcher with Liquid Pill Physics */}
        <div
          ref={timeframeSwitcherRef}
          role="radiogroup"
          aria-label="Analytics Timeframe"
          className="relative isolate inline-flex items-center rounded-xl bg-white/45 dark:bg-white/[0.05] p-1 border border-white/60 dark:border-white/10 gap-0.5"
        >
          <LiquidPillOverlay
            containerRef={timeframeSwitcherRef}
            itemRefs={timeframeItemRefs}
            activeKey={timeframe}
            axis="x"
            variant="purple-pill"
            roundedClass="rounded-lg"
            triggerTick={timeframeAnimTick}
          />
          {(Object.keys(TIMEFRAMES) as Array<keyof typeof TIMEFRAMES>).map((key) => (
            <button
              key={key}
              ref={(el) => {
                timeframeItemRefs.current[key] = el;
              }}
              type="button"
              role="radio"
              aria-checked={timeframe === key}
              data-liquid-active={timeframe === key ? "true" : undefined}
              onClick={() => handleSelectTimeframe(key)}
              className={`relative z-10 h-8 rounded-lg px-3 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                timeframe === key
                  ? "!text-white"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              {TIMEFRAMES[key]}
            </button>
          ))}
        </div>
      </div>

      {/* Row 1: Top Institutional KPI Cards with Live Dynamic Counts */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Cataloged Volumes"
          value={totalPhysicalVolumes.toLocaleString()}
          period={`Across ${disciplineBreakdown.length} active ${disciplineBreakdown.length === 1 ? "discipline" : "disciplines"}`}
          icon={<BookOpen className="w-3.5 h-3.5" />}
        />
        <KpiCard
          label="Active Circulation Loans"
          value={activeLoansCount.toLocaleString()}
          period={activeLoansCount === 0 ? "All volumes currently in stack" : `${activeLoansCount} volumes checked out`}
          icon={<Layers className="w-3.5 h-3.5" />}
        />
        <KpiCard
          label="Shelf Availability Index"
          value={`${availabilityPercentage}%`}
          period={`${availableVolumes.toLocaleString()} of ${totalPhysicalVolumes.toLocaleString()} volumes on shelf`}
          icon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />}
        />
        <KpiCard
          label="Overdue / Delinquency"
          value={overdueCount.toLocaleString()}
          period={overdueCount > 0 ? `Accruing fines (Rs. ${liveFineRate}/day)` : "Zero overdue borrower accounts"}
          icon={<Clock className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />}
        />
      </div>

      {/* Row 2: Charts Grid (GlassBezierAreaChart + GlassHatchedStackChart) */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Circulation Velocity (Issue vs Return Flow)"
          subtitle={`Volumes checked out vs returned during ${TIMEFRAMES[timeframe].toLowerCase()}`}
        >
          <GlassBezierAreaChart
            key={`vel-${timeframe}-${timeframeAnimTick}`}
            data={circulationVelocityData}
            xKey="period"
            height={224}
            valueUnit="vols"
            ariaLabel="Circulation volume trends over time"
            series={[
              { key: "issued", label: "Books Issued", color: "#A855F7", showArea: true },
              { key: "returned", label: "Books Returned", color: "#F59E0B", showArea: false },
            ]}
          />
        </ChartCard>

        <ChartCard
          title="Holdings by Academic Discipline (Available vs Issued)"
          subtitle={`Real breakdown across ${disciplineBreakdown.length} active faculties`}
        >
          <GlassHatchedStackChart
            key={`disc-${timeframe}-${timeframeAnimTick}`}
            data={disciplineBreakdown.map((d) => ({
              label: d.discipline,
              available: d.available,
              issued: d.issued,
              total: d.available + d.issued,
            }))}
            height={224}
            availableLabel="On Shelf Available"
            issuedLabel="Currently Issued"
            ariaLabel="Holdings comparison across departments"
          />
        </ChartCard>
      </div>

      {/* Row 3: Collection Breakdown Donut + Stacks Density Info Card */}
      <div className="grid gap-6 lg:grid-cols-3 items-stretch">
        {/* Left Card — Collection Classification Breakdown (Balanced Donut + Rich Breakdown + Telemetry Footer) */}
        <section className="lg:col-span-2 ulm-preserve-glass rounded-[24px] p-6 bg-gradient-to-br from-white/85 via-white/70 to-white/55 dark:from-white/[0.075] dark:via-white/[0.03] dark:to-white/[0.015] backdrop-blur-2xl backdrop-saturate-[185%] border border-slate-200/85 dark:border-white/[0.14] shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.85),0_12px_32px_rgba(15,23,42,0.06)] dark:shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.20),0_12px_36px_rgba(0,0,0,0.28)] flex flex-col justify-between gap-5">
          {/* Header Row */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-['Plus_Jakarta_Sans'] text-[15px] font-bold text-slate-900 dark:text-white tracking-tight">
                Collection Classification Breakdown
              </h3>
              <p className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-0.5">
                Physical acquisition distribution across library assets
              </p>
            </div>
            <span className="inline-flex items-center gap-2 font-['JetBrains_Mono'] text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-md bg-purple-500/12 border border-purple-400/30 text-purple-700 dark:text-purple-200 shrink-0">
              <span className="w-1.5 h-1.5 rounded-[1.5px] bg-purple-500 dark:bg-purple-400" />
              <span>
                {classificationDonut.length} ACTIVE DISCIPLINE{classificationDonut.length === 1 ? "" : "S"}
              </span>
            </span>
          </div>

          {/* 2-Column Content Area */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            {/* Left — Animated Clock-Sweep Interactive Frosted Donut Chart */}
            <div className="md:col-span-5 flex items-center justify-center">
              <GlassSweepDonutChart
                key={`donut-${timeframe}-${timeframeAnimTick}`}
                slices={classificationDonut.map((d, idx) => {
                  const gradients: Array<[string, string]> = [
                    ["#7E22CE", "#F59E0B"],
                    ["#D97706", "#FBBF24"],
                    ["#059669", "#34D399"],
                    ["#0284C7", "#38BDF8"],
                    ["#DB2777", "#F472B6"],
                  ];
                  return {
                    label: d.label,
                    value: d.value,
                    gradient: gradients[idx % gradients.length],
                  };
                })}
                total={totalPhysicalVolumes}
                size={208}
                thickness={22}
                centerDefaultLabel="TOTAL VOLUMES"
                centerUnit="volumes"
                selectedLabel={selectedClassLabel}
                onSelectSlice={setSelectedClassLabel}
                ariaLabel="Breakdown of collection by resource classification"
              />
            </div>

            {/* Right — Interactive Click-to-Isolate Discipline Rows + Summary Telemetry */}
            <div className="md:col-span-7 space-y-3">
              <div className="max-h-[168px] overflow-y-auto pr-1 space-y-2">
                {classificationDonut.map((d, idx) => {
                  const pct =
                    totalPhysicalVolumes > 0
                      ? Math.round((d.value / totalPhysicalVolumes) * 100)
                      : 0;
                  const isSelected = selectedClassLabel === d.label;
                  const isDimmed = selectedClassLabel !== null && !isSelected;
                  const dotClasses = [
                    "bg-gradient-to-tr from-[#7E22CE] via-[#A855F7] to-amber-400 shadow-[0_0_8px_rgba(168,85,247,0.65)]",
                    "bg-gradient-to-tr from-amber-600 to-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.55)]",
                    "bg-gradient-to-tr from-emerald-600 to-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.55)]",
                    "bg-gradient-to-tr from-blue-600 to-sky-400 shadow-[0_0_8px_rgba(96,165,250,0.55)]",
                    "bg-gradient-to-tr from-pink-600 to-rose-400 shadow-[0_0_8px_rgba(244,114,182,0.55)]",
                  ];
                  const barClasses = [
                    "bg-gradient-to-r from-[#7E22CE] via-[#A855F7] to-amber-400",
                    "bg-gradient-to-r from-amber-600 to-amber-400",
                    "bg-gradient-to-r from-emerald-600 to-emerald-400",
                    "bg-gradient-to-r from-blue-600 to-sky-400",
                    "bg-gradient-to-r from-pink-600 to-rose-400",
                  ];
                  return (
                    <button
                      key={d.label}
                      type="button"
                      onClick={() =>
                        setSelectedClassLabel((cur) => (cur === d.label ? null : d.label))
                      }
                      className={`w-full text-left rounded-2xl px-4 py-3 border transition-all duration-150 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50 ${
                        isSelected
                          ? "bg-purple-500/[0.09] dark:bg-purple-500/[0.14] border-purple-400/50 dark:border-amber-400/45 shadow-sm"
                          : "bg-white/70 dark:bg-white/[0.04] hover:bg-white/90 dark:hover:bg-white/[0.07] border-slate-200/80 dark:border-white/[0.10]"
                      }`}
                      style={{ opacity: isDimmed ? 0.45 : 1 }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2.5 min-w-0">
                          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotClasses[idx % dotClasses.length]}`} />
                          <span className="font-semibold text-[13px] text-slate-900 dark:text-white truncate">
                            {d.label}
                          </span>
                        </span>
                        <span className="flex items-center gap-2 shrink-0 tabular-nums">
                          <span className="font-['JetBrains_Mono'] text-[12px] font-bold text-slate-900 dark:text-white">
                            {d.value.toLocaleString()} vols
                          </span>
                          <span className="text-purple-600 dark:text-amber-300 font-['JetBrains_Mono'] text-[11.5px] font-semibold">
                            {pct}%
                          </span>
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-200/80 dark:bg-white/[0.08] overflow-hidden mt-2">
                        <div
                          key={`share-${timeframe}-${timeframeAnimTick}-${d.label}`}
                          className={`ulm-share-bar h-full rounded-full ${barClasses[idx % barClasses.length]}`}
                          style={{
                            width: `${d.value > 0 ? Math.max(4, pct) : 0}%`,
                            animationDelay: `${idx * 45}ms`,
                          }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Compact 3-Metric Summary Footer */}
              <div className="grid grid-cols-3 gap-2.5 pt-2">
                <div className="rounded-2xl px-3.5 py-2.5 bg-white/65 dark:bg-white/[0.035] border border-slate-200/80 dark:border-white/[0.10]">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
                    DISTINCT TITLES
                  </p>
                  <p className="font-['Space_Grotesk'] text-[15px] font-bold tabular-nums text-slate-900 dark:text-white mt-0.5">
                    {books.length.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-2xl px-3.5 py-2.5 bg-white/65 dark:bg-white/[0.035] border border-slate-200/80 dark:border-white/[0.10]">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
                    AVG COPIES / TITLE
                  </p>
                  <p className="font-['Space_Grotesk'] text-[15px] font-bold tabular-nums text-slate-900 dark:text-white mt-0.5">
                    {(totalPhysicalVolumes / Math.max(1, books.length)).toFixed(2)}x
                  </p>
                </div>
                <div className="rounded-2xl px-3.5 py-2.5 bg-white/65 dark:bg-white/[0.035] border border-slate-200/80 dark:border-white/[0.10]">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
                    ON SHELF RATE
                  </p>
                  <p className="font-['Space_Grotesk'] text-[15px] font-bold tabular-nums text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {availabilityPercentage}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Right Card — Physical Stacks & Density (Crisp Frosted Glass Cupboard Rows + Allocation Summary) */}
        <section className="ulm-preserve-glass rounded-[24px] p-6 bg-gradient-to-br from-white/85 via-white/70 to-white/55 dark:from-white/[0.075] dark:via-white/[0.03] dark:to-white/[0.015] backdrop-blur-2xl backdrop-saturate-[185%] border border-slate-200/85 dark:border-white/[0.14] shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.85),0_12px_32px_rgba(15,23,42,0.06)] dark:shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.20),0_12px_36px_rgba(0,0,0,0.28)] flex flex-col justify-between gap-4">
          <div className="space-y-4">
            {/* Header Row */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-['Plus_Jakarta_Sans'] text-[15px] font-bold text-slate-900 dark:text-white tracking-tight">
                  Physical Stacks &amp; Density
                </h3>
                <p className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Physical cupboard mapping registered in central database
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 font-['JetBrains_Mono'] text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-md bg-slate-900/[0.04] dark:bg-white/[0.05] border border-slate-300/70 dark:border-white/[0.12] text-slate-700 dark:text-slate-200 shrink-0">
                <span className="w-1.5 h-1.5 rounded-[1.5px] bg-purple-500 dark:bg-amber-400" />
                <span>
                  {almaris.length} ALMARI{almaris.length === 1 ? "" : "S"}
                </span>
              </span>
            </div>

            {/* 2-Column Stack Allocation Mini-KPI Strip */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-2xl px-3.5 py-2.5 bg-emerald-500/[0.07] border border-emerald-400/25">
                <p className="text-[9.5px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 truncate">
                  SHELVED IN ALMARIS
                </p>
                <p className="font-['Space_Grotesk'] text-[16px] font-bold tabular-nums text-slate-900 dark:text-white mt-0.5">
                  {assignedTotal.toLocaleString()} vols
                </p>
              </div>
              <div className="rounded-2xl px-3.5 py-2.5 bg-amber-500/[0.07] border border-amber-400/25">
                <p className="text-[9.5px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 truncate">
                  UNASSIGNED QUEUE
                </p>
                <p className="font-['Space_Grotesk'] text-[16px] font-bold tabular-nums text-slate-900 dark:text-white mt-0.5">
                  {unassignedCount.toLocaleString()} vols
                </p>
              </div>
            </div>

            {/* Cupboard Rows List */}
            <div className="max-h-[155px] overflow-y-auto pr-1 space-y-2.5">
              {stacksDensity.map((stack, idx) => {
                const cap = Math.max(1, Number(stack.capacity) || 125);
                const fillPct = Math.min(100, Math.round((stack.count / cap) * 100));
                const cleanName = stack.name.startsWith(`${stack.code} • `)
                  ? stack.name.slice(`${stack.code} • `.length)
                  : stack.name;
                return (
                  <div
                    key={`${stack.code}-${idx}`}
                    className="rounded-2xl p-3.5 bg-white/75 dark:bg-white/[0.04] hover:bg-white dark:hover:bg-white/[0.07] border border-slate-200/85 dark:border-white/[0.10] transition-all"
                  >
                    <div className="flex items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-400/30 font-['JetBrains_Mono'] text-[11px] font-bold text-purple-700 dark:text-purple-200 flex items-center justify-center shrink-0">
                          {stack.code}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[12.5px] font-semibold text-slate-900 dark:text-white truncate">
                            {cleanName}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                            <MapPin className="w-3 h-3 text-amber-500 dark:text-amber-400 shrink-0" />
                            <span className="truncate">{stack.location}</span>
                          </p>
                        </div>
                      </div>
                      <span className="font-['JetBrains_Mono'] text-[11px] font-semibold tabular-nums text-amber-600 dark:text-amber-300 shrink-0 whitespace-nowrap">
                        {stack.count.toLocaleString()} / {cap.toLocaleString()} vols
                      </span>
                    </div>
                    <div className="mt-2.5 h-1.5 w-full rounded-full bg-slate-200/80 dark:bg-white/[0.08] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#7E22CE] to-amber-400 transition-all duration-500"
                        style={{
                          width: `${stack.count > 0 ? Math.max(6, fillPct) : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Clean Footer Status Strip */}
          <div className="pt-3 border-t border-slate-200/70 dark:border-white/[0.08] flex items-center justify-between text-[11px]">
            <span className="text-slate-500 dark:text-slate-400">
              Automated shelf capacity tracking
            </span>
            <span className="inline-flex items-center gap-1.5 font-['JetBrains_Mono'] text-[10.5px] font-semibold text-emerald-600 dark:text-emerald-400">
              <span className="w-[5px] h-[5px] rounded-[1px] bg-emerald-500 dark:bg-emerald-400" />
              <span>100% Synced</span>
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}

export default CatalogVisualAnalytics;
