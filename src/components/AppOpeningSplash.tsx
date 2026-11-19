import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { playClickSound } from '../services/audio';
import { ULM_OFFICIAL_CREST_SRC } from '../constants/ulmOfficialAssets';
import { ULM_OFFICIAL_CREST_DATA_URI, handleCrestFallback } from '../constants/ulmOfficialCrest';
import { useInstitutionalIdentity } from '../utils/themeTransition';

export interface AppOpeningSplashProps {
  onComplete: () => void;
  booksCount?: number;
  almarisCount?: number;
}

interface StepItem {
  id: string;
  label: string;
  triggerPct: number;
}

const SQLITE_STEPS: StepItem[] = [
  { id: 'wal', label: 'Mounting SQLite WAL Engine', triggerPct: 15 },
  { id: 'register', label: 'Verifying 17-Column Register', triggerPct: 45 },
  { id: 'cache', label: 'Hydrating IndexedDB Catalog Cache', triggerPct: 75 },
  { id: 'ready', label: 'Workstation Circulation Engine Ready', triggerPct: 95 },
];

const ROMAN_BOOK_SPINES = [
  {
    numeral: 'I',
    heightClass: 'h-9',
    bgClass: 'from-[#6B21A8] to-[#3B0764] border-purple-300/40 text-amber-200',
    threshold: 10,
  },
  {
    numeral: 'II',
    heightClass: 'h-11',
    bgClass: 'from-[#9F1239] to-[#4C0519] border-rose-300/40 text-amber-200',
    threshold: 24,
  },
  {
    numeral: 'III',
    heightClass: 'h-10',
    bgClass: 'from-[#047857] to-[#064E3B] border-emerald-300/40 text-amber-200',
    threshold: 38,
  },
  {
    numeral: 'IV',
    heightClass: 'h-12',
    bgClass: 'from-[#D97706] to-[#78350F] border-amber-200/60 text-white',
    threshold: 52,
  },
  {
    numeral: 'V',
    heightClass: 'h-10',
    bgClass: 'from-[#1D4ED8] to-[#1E3A8A] border-sky-300/40 text-amber-200',
    threshold: 66,
  },
  {
    numeral: 'VI',
    heightClass: 'h-11',
    bgClass: 'from-[#7E22CE] to-[#4C1D95] border-fuchsia-300/40 text-amber-200',
    threshold: 80,
  },
  {
    numeral: 'VII',
    heightClass: 'h-9',
    bgClass: 'from-[#0F766E] to-[#134E4A] border-teal-300/40 text-amber-200',
    threshold: 92,
  },
];

export const AppOpeningSplash: React.FC<AppOpeningSplashProps> = ({
  onComplete,
}) => {
  const identity = useInstitutionalIdentity();
  const [progress, setProgress] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const hasFinishedRef = useRef(false);

  const currentMountStepText = useMemo(() => {
    let activeStep = SQLITE_STEPS[0].label;
    for (const step of SQLITE_STEPS) {
      if (progress >= step.triggerPct - 10) {
        activeStep = step.label;
      }
    }
    return activeStep;
  }, [progress]);

  const handleFinish = () => {
    if (hasFinishedRef.current) return;
    hasFinishedRef.current = true;
    setIsExiting(true);
    setTimeout(() => {
      onComplete();
    }, 300);
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        handleFinish();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  useEffect(() => {
    try {
      playClickSound();
    } catch {
      // Audio autoplay policy fallback
    }

    const duration = 2600;
    const startTime = Date.now();

    const interval = setInterval(() => {
      if (hasFinishedRef.current) {
        clearInterval(interval);
        return;
      }

      const elapsed = Date.now() - startTime;
      const rawProgress = Math.min(100, Math.round((elapsed / duration) * 100));
      setProgress(rawProgress);

      if (rawProgress >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          handleFinish();
        }, 150);
      }
    }, 24);

    return () => clearInterval(interval);
  }, []);

  const officialCrestUrl = ULM_OFFICIAL_CREST_SRC || ULM_OFFICIAL_CREST_DATA_URI;
  const primaryCampus =
    (identity.campusAddress || '').split(',')[0]?.trim() || 'Main Campus';

  const splashContent = (
    <div
      id="ulm-boot-splash"
      onClick={handleFinish}
      className={`ulm-preserve-glass fixed inset-0 z-[99999] flex items-center justify-center p-4 select-none transition-opacity duration-300 bg-slate-900/15 dark:bg-[#090514]/70 backdrop-blur-md dark:backdrop-blur-xl backdrop-saturate-[165%] dark:backdrop-saturate-[180%] ${
        isExiting ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Top-Right Frosted Crystal Skip [Enter] Button */}
      <div className="absolute top-5 right-5 z-20">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleFinish();
          }}
          className="ulm-preserve-glass bg-white/80 hover:bg-white text-slate-900 border border-slate-300/85 dark:bg-white/10 dark:hover:bg-white/20 dark:text-white dark:border-white/20 backdrop-blur-xl px-3.5 py-1.5 rounded-xl text-xs font-semibold shadow-sm transition cursor-pointer inline-flex items-center gap-1.5"
        >
          <span>Skip [Enter] →</span>
        </button>
      </div>

      {/* Compact Vertical Portrait Splash Card (max-w-[370px]) */}
      <div
        id="ulm-boot-card"
        onClick={handleFinish}
        className="ulm-preserve-glass w-full max-w-[370px] rounded-[26px] px-6 py-7 text-center relative overflow-hidden cursor-pointer bg-gradient-to-br from-white/94 via-white/88 to-white/80 dark:from-[#23173D]/90 dark:via-[#19102E]/90 dark:to-[#120A22]/92 backdrop-blur-2xl backdrop-saturate-[185%] border border-white/90 dark:border-white/[0.16] shadow-[inset_1.5px_1.5px_3px_rgba(255,255,255,0.95),0_24px_70px_rgba(15,23,42,0.16)] dark:shadow-[inset_1.5px_1.5px_2px_rgba(255,255,255,0.22),0_28px_80px_rgba(0,0,0,0.78)]"
      >
        {/* 1. Larger Centered Live Crest Pedestal (w-20 h-20) */}
        <div
          id="ulm-boot-logo"
          className="mx-auto w-20 h-20 rounded-2xl p-2 bg-gradient-to-br from-amber-500/15 via-purple-500/10 to-transparent border border-amber-400/35 shadow-[0_0_28px_rgba(245,158,11,0.16)] flex items-center justify-center"
        >
          <img
            src={identity.customCrestUrl || officialCrestUrl}
            alt={identity.universityName}
            onError={handleCrestFallback}
            className="w-full h-full object-contain drop-shadow-sm"
          />
        </div>

        {/* 2. Pill-Shaped Department Badge (rounded-full, Zero Emojis) */}
        <div className="mt-4 inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/[0.08] border border-amber-400/45">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.9)]" />
          <span className="font-['Plus_Jakarta_Sans'] text-[10px] font-bold uppercase tracking-[0.12em] text-amber-700 dark:text-amber-300">
            {identity.libraryDepartmentName} · {identity.workstationNodeId || 'LMS-WIN-01'}
          </span>
        </div>

        {/* 3. Live Institution Heading & Crisp Subtitle */}
        <h1 className="mt-3.5 font-['Plus_Jakarta_Sans'] text-[19px] font-extrabold uppercase tracking-wide text-slate-900 dark:text-white leading-tight">
          {identity.universityName}
        </h1>
        <p className="mt-1 font-['Plus_Jakarta_Sans'] text-[11.5px] font-medium text-slate-600 dark:text-slate-300/80">
          Digital Library &amp; Accession Ledger · {primaryCampus}
        </p>

        {/* 4. Centered 7-Volume Roman-Numeral Book Spine Illustration (I II III IV V VI VII) */}
        <div
          aria-hidden="true"
          className="my-5 flex items-end justify-center gap-1.5 h-12"
        >
          {ROMAN_BOOK_SPINES.map((spine, idx) => {
            const isMounted = progress >= spine.threshold;
            const isActivePulse =
              progress >= spine.threshold - 14 && progress < spine.threshold + 16;
            return (
              <div
                key={spine.numeral}
                style={{
                  transitionDelay: `${idx * 35}ms`,
                }}
                className={`ulm-preserve-dark ulm-preserve-glass w-[22px] ${spine.heightClass} rounded-[4px] bg-gradient-to-b ${spine.bgClass} border shadow-[0_4px_12px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.25)] flex flex-col items-center justify-between py-1.5 transition-all duration-300 hover:-translate-y-1 ${
                  isActivePulse
                    ? '-translate-y-1.5 scale-[1.06] ring-1 ring-amber-300/70'
                    : isMounted
                    ? 'translate-y-0 opacity-100'
                    : 'translate-y-1 opacity-55'
                }`}
              >
                <span className="w-3 h-[1.5px] rounded-full bg-amber-300/70" />
                <span className="font-['Playfair_Display'] text-[9px] font-bold leading-none tracking-tight">
                  {spine.numeral}
                </span>
                <span className="w-3 h-[1.5px] rounded-full bg-amber-300/50" />
              </div>
            );
          })}
        </div>

        {/* 5. Clean Progress Header & Purple-Gold Progress Bar */}
        <div className="mt-2 flex items-center justify-between text-[11px] font-semibold font-['Plus_Jakarta_Sans']">
          <span className="text-sky-600 dark:text-sky-400">System Mounting Status</span>
          <span className="font-['JetBrains_Mono'] text-slate-800 dark:text-white tabular-nums">
            {progress}%
          </span>
        </div>
        <div className="mt-1.5 h-2 w-full rounded-full bg-slate-200/80 dark:bg-white/[0.10] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#6B21A8] via-[#A855F7] to-[#F59E0B] transition-all duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* 6. Compact Rounded Console Status Box */}
        <div
          id="ulm-boot-console"
          className="mt-4 rounded-2xl px-4 py-3.5 bg-slate-900/[0.04] dark:bg-[#0D071A]/75 border border-slate-200/85 dark:border-white/[0.10] flex items-center justify-between gap-2 font-['JetBrains_Mono'] text-[10.5px]"
        >
          <span className="text-emerald-600 dark:text-emerald-400 truncate">
            &gt; [OK] {currentMountStepText}
          </span>
          <span className="text-emerald-600 dark:text-emerald-400 font-bold shrink-0">
            ✓ MOUNTED
          </span>
        </div>

        {/* 7. Clean Footer Hint */}
        <p className="mt-4 font-['JetBrains_Mono'] text-[10.5px] text-slate-500 dark:text-slate-400">
          Click anywhere or press Enter to launch
        </p>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(splashContent, document.body);
  }

  return splashContent;
};

export default AppOpeningSplash;
