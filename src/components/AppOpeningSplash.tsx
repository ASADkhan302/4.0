import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, 
  Sparkles, 
  Check, 
  ArrowRight,
  GraduationCap
} from 'lucide-react';
import { playClickSound } from '../services/audio';
import { StartScreenHeroDeco } from './decorative/StartScreenHeroDeco';
import { BootSpinesDeco } from './decorative/BootSpinesDeco';
import { ULM_CREST_SRC } from '../assets/brand/crestData';
import { ULM_OFFICIAL_CREST_DATA_URI } from '../constants/ulmOfficialCrest';

interface AppOpeningSplashProps {
  onComplete: () => void;
}

interface StepItem {
  id: string;
  label: string;
  triggerPct: number;
}

const SQLITE_STEPS: StepItem[] = [
  { id: 'wal', label: 'Mounting SQLite WAL Engine', triggerPct: 15 },
  { id: 'register', label: 'Verifying 17-Column Register', triggerPct: 45 },
  { id: 'cache', label: 'Hydrating 50-Row Thumbnail Cache', triggerPct: 75 },
  { id: 'ready', label: 'Win32 Circulation Station Ready', triggerPct: 95 }
];

export const AppOpeningSplash: React.FC<AppOpeningSplashProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const hasFinishedRef = useRef(false);

  const handleFinish = () => {
    if (hasFinishedRef.current) return;
    hasFinishedRef.current = true;
    setIsExiting(true);
    // Exit: splash fades and scales up slightly (400ms)
    setTimeout(() => {
      onComplete();
    }, 400);
  };

  useEffect(() => {
    // Any click or Enter key skips the splash
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

    const duration = 2800; // ~3s total sequence
    const startTime = Date.now();

    const interval = setInterval(() => {
      if (hasFinishedRef.current) {
        clearInterval(interval);
        return;
      }

      const elapsed = Date.now() - startTime;
      const rawProgress = Math.min(100, Math.round((elapsed / duration) * 100));
      setProgress(rawProgress);

      // Check SQLite mounting steps
      SQLITE_STEPS.forEach(step => {
        if (rawProgress >= step.triggerPct) {
          setCompletedSteps(prev => prev.includes(step.id) ? prev : [...prev, step.id]);
        }
      });

      if (rawProgress >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          handleFinish();
        }, 150);
      }
    }, 24);

    return () => clearInterval(interval);
  }, []);

  return (
    <div 
      id="ulm-boot-splash"
      onClick={handleFinish}
      className={`ulm-preserve-glass fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 select-none transition-all duration-300 ${
        isExiting 
          ? 'opacity-0 scale-[1.04] pointer-events-none' 
          : 'opacity-100 scale-100'
      }`}
    >
      <style>{`
        @keyframes crestEntrance {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes crestPulse {
          0% {
            box-shadow: 0 0 0 rgba(188, 136, 27, 0);
          }
          100% {
            box-shadow: 0 0 24px rgba(188, 136, 27, 0.35);
          }
        }
        @keyframes fadeUp12px {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .splash-step-1 {
          animation: fadeUp12px 400ms cubic-bezier(0.16, 1, 0.3, 1) 0ms both;
        }
        .splash-step-2 {
          animation: fadeUp12px 400ms cubic-bezier(0.16, 1, 0.3, 1) 120ms both;
        }
        .splash-step-3 {
          animation: fadeUp12px 400ms cubic-bezier(0.16, 1, 0.3, 1) 240ms both;
        }
        @media (prefers-reduced-motion: reduce) {
          .splash-step-1, .splash-step-2, .splash-step-3 {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>

      {/* Skip Hint (Top Right) */}
      <div className="absolute top-6 right-6 z-20">
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleFinish();
          }}
          className="ulm-preserve-glass bg-white/55 hover:bg-white/80 text-slate-900 border border-slate-300/80 dark:bg-white/10 dark:hover:bg-white/20 dark:text-white dark:border-white/20 backdrop-blur-md px-4 py-1.5 rounded-xl text-xs font-semibold shadow-sm transition cursor-pointer flex items-center gap-2"
        >
          <span>Skip [Enter]</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Centerpiece Stage Container with ID for Transparent Frosted Glass */}
      <div 
        id="ulm-boot-card"
        className="ulm-preserve-glass w-full max-w-md rounded-3xl p-7 text-center transition-all flex flex-col items-center space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Floating Transparent Glass Container for ULM Crest Logo (zero square gray background, unclipped) */}
        <div 
          id="ulm-boot-logo"
          className="ulm-preserve-glass w-28 h-28 rounded-2xl bg-white/10 dark:bg-white/5 backdrop-blur-md border border-[#BC881B]/40 shadow-[0_12px_36px_rgba(188,136,27,0.22)] flex items-center justify-center mx-auto mb-2 overflow-hidden p-2 shrink-0"
        >
          <img 
            src={ULM_OFFICIAL_CREST_DATA_URI} 
            alt="University of Lakki Marwat Official Crest" 
            className="w-24 h-24 object-contain select-none pointer-events-none bg-transparent" 
            style={{ 
              clipPath: 'none',
              imageRendering: '-webkit-optimize-contrast' 
            }}
          />
        </div>

        <div className="w-full space-y-2">
          {/* Top Pill */}
          <div className="splash-step-1">
            <span className="bg-[#541A72]/15 dark:bg-[#541A72]/35 text-[#541A72] dark:text-amber-300 border border-[#BC881B]/45 backdrop-blur-md px-3.5 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase inline-flex items-center gap-1.5 font-mono">
              <Sparkles className="w-3.5 h-3.5 text-[#541A72] dark:text-amber-300" />
              <span>✨ CENTRAL CAMPUS WORKSTATION</span>
            </span>
          </div>

          <h1 className="splash-step-2 text-slate-900 dark:text-white font-extrabold tracking-tight text-xl font-cinzel pt-1 mt-3">
            UNIVERSITY OF LAKKI MARWAT
          </h1>

          <p className="splash-step-3 text-slate-600 dark:text-slate-300 text-xs font-medium font-sans mt-1">
            Library Management System • Win32 Edition
          </p>
        </div>

        {/* Boot Splash Book Spines: 7 spines sliding up and settling one by one */}
        <BootSpinesDeco />

        {/* System Mounting Status Bar & Percentage */}
        <div className="w-full space-y-3 pt-1">
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-[12px] font-mono">
              <span className="text-[#541A72] dark:text-sky-300 font-semibold text-xs">System Mounting Status</span>
              <span className="text-slate-900 dark:text-white font-mono font-bold text-xs tabular-nums">{progress}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-900/10 dark:bg-white/10 overflow-hidden backdrop-blur-sm">
              <div 
                className="h-full bg-gradient-to-r from-[#541A72] via-[#BC881B] to-emerald-500 transition-all duration-150"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Transparent Glass Boot Terminal Console: id="ulm-boot-console" */}
          <div 
            id="ulm-boot-console"
            className="ulm-preserve-glass w-full rounded-2xl p-3.5 mt-4 font-mono text-[11px] text-left space-y-1.5 backdrop-blur-md transition-all min-h-[100px] flex flex-col justify-center"
          >
            {SQLITE_STEPS.map((step) => {
              const isChecked = completedSteps.includes(step.id);
              const isVisible = progress >= step.triggerPct - 5;
              if (!isVisible) return null;

              return (
                <div 
                  key={step.id} 
                  className="flex items-center justify-between text-[11px] font-mono animate-in fade-in slide-in-from-bottom-1 duration-200"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-emerald-500 font-bold">›</span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-bold">[OK]</span>
                    <span className="text-slate-800 dark:text-slate-200">{step.label}...</span>
                  </span>
                  {isChecked ? (
                    <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold animate-in zoom-in-75 duration-150">
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>MOUNTED</span>
                    </span>
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footnote */}
        <div className="text-slate-600 dark:text-slate-300 font-mono text-xs mt-4 opacity-85">
          Click anywhere or press Enter to launch
        </div>

      </div>
    </div>
  );
};
