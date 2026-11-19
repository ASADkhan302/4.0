import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Database } from 'lucide-react';
import { BackgroundGradientAnimation } from '../components/ui/background-gradient-animation';

export interface HeavyTaskState {
  active: boolean;
  title: string;
  subtitle?: string;
  progress: number;
  processed: number;
  total: number;
}

const DEFAULT_TASK_STATE: HeavyTaskState = {
  active: false,
  title: 'Importing Library Catalog Batch',
  subtitle: 'Indexing barcodes & SQLite records...',
  progress: 0,
  processed: 0,
  total: 0,
};

let currentTaskState: HeavyTaskState = { ...DEFAULT_TASK_STATE };

/**
 * Paint-first double-rAF + 20ms yield so the translucent loading overlay
 * is guaranteed to paint and animate smoothly before heavy CPU work starts.
 */
export function yieldToPaintFirst(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          setTimeout(resolve, 20);
        });
      });
    } else {
      setTimeout(resolve, 20);
    }
  });
}

export function yieldToBrowserFrame(delayMs = 0): Promise<void> {
  return new Promise((resolve) => {
    if (delayMs === 0) {
      setTimeout(resolve, 0);
      return;
    }
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => {
        setTimeout(resolve, delayMs);
      });
    } else {
      setTimeout(resolve, Math.max(4, delayMs));
    }
  });
}

function broadcastTaskState(state: HeavyTaskState): void {
  if (typeof window === 'undefined') return;
  const detail = { ...state };
  window.dispatchEvent(new CustomEvent('ulm-heavy-task', { detail }));
  window.dispatchEvent(new CustomEvent('ulm-loading-gate', { detail }));
}

export async function startHeavyTask(
  titleOrOptions:
    | string
    | {
        title: string;
        subtitle?: string;
        total?: number;
      },
  subtitle?: string,
  total?: number
): Promise<void> {
  const opts =
    typeof titleOrOptions === 'string'
      ? { title: titleOrOptions, subtitle, total }
      : titleOrOptions;

  currentTaskState = {
    active: true,
    title: opts.title || 'Importing Library Catalog Batch',
    subtitle: opts.subtitle || 'Indexing barcodes & SQLite records...',
    progress: 0,
    processed: 0,
    total: opts.total || 0,
  };
  broadcastTaskState(currentTaskState);
  await yieldToPaintFirst();
}

export function updateHeavyTaskProgress(
  processedOrPartial: number | Partial<HeavyTaskState>,
  total?: number,
  subtitle?: string
): void {
  if (typeof processedOrPartial === 'number') {
    const safeTotal = total ?? currentTaskState.total ?? 100;
    const pct =
      safeTotal > 0
        ? Math.min(100, Math.round((processedOrPartial / safeTotal) * 100))
        : 0;
    currentTaskState = {
      ...currentTaskState,
      active: true,
      processed: processedOrPartial,
      total: safeTotal,
      progress: pct,
      subtitle: subtitle ?? currentTaskState.subtitle,
    };
  } else {
    currentTaskState = {
      ...currentTaskState,
      ...processedOrPartial,
      active:
        processedOrPartial.active !== undefined ? processedOrPartial.active : true,
    };
  }
  broadcastTaskState(currentTaskState);
}

export function finishHeavyTask(): void {
  currentTaskState = {
    ...currentTaskState,
    active: false,
    progress: 100,
  };
  broadcastTaskState(currentTaskState);
}

export const showLoadingGate = startHeavyTask;
export const updateLoadingGate = updateHeavyTaskProgress;
export const hideLoadingGate = finishHeavyTask;

export async function runHeavyLibraryTask<T>(
  titleOrOptions:
    | string
    | {
        title: string;
        subtitle?: string;
        total?: number;
      },
  subtitleOrWorkFn: string | ((update: typeof updateHeavyTaskProgress) => Promise<T>),
  maybeWorkFn?: (update: typeof updateHeavyTaskProgress) => Promise<T>
): Promise<T> {
  const opts =
    typeof titleOrOptions === 'string'
      ? {
          title: titleOrOptions,
          subtitle: typeof subtitleOrWorkFn === 'string' ? subtitleOrWorkFn : undefined,
        }
      : titleOrOptions;

  const workFn =
    typeof subtitleOrWorkFn === 'function' ? subtitleOrWorkFn : maybeWorkFn!;

  await startHeavyTask(opts);
  try {
    return await workFn(updateHeavyTaskProgress);
  } finally {
    finishHeavyTask();
  }
}

export const GlobalHeavyTaskOverlay: React.FC = () => {
  const [task, setTask] = useState<HeavyTaskState>(() => ({ ...currentTaskState }));

  useEffect(() => {
    const handleTaskEvent = (e: Event) => {
      const custom = e as CustomEvent<Partial<HeavyTaskState>>;
      if (!custom.detail) return;
      setTask((prev) => ({
        ...prev,
        ...custom.detail,
      }));
    };

    window.addEventListener('ulm-heavy-task', handleTaskEvent);
    window.addEventListener('ulm-loading-gate', handleTaskEvent);
    return () => {
      window.removeEventListener('ulm-heavy-task', handleTaskEvent);
      window.removeEventListener('ulm-loading-gate', handleTaskEvent);
    };
  }, []);

  if (!task.active || typeof document === 'undefined') {
    return null;
  }

  const safePct = Math.max(0, Math.min(100, Math.round(task.progress || 0)));

  return createPortal(
    <BackgroundGradientAnimation
      gradientBackgroundStart="rgb(32, 10, 62)"
      gradientBackgroundEnd="rgb(9, 5, 20)"
      firstColor="126, 34, 206"
      secondColor="221, 74, 255"
      thirdColor="245, 158, 11"
      fourthColor="88, 28, 135"
      fifthColor="56, 189, 248"
      pointerColor="168, 85, 247"
      containerClassName="fixed inset-0 z-[99999] select-none ulm-preserve-dark ulm-preserve-glass"
    >
      <div className="relative z-50 h-full w-full flex items-center justify-center p-4 ulm-preserve-dark ulm-preserve-glass">
        <div
          className="w-full max-w-[480px] rounded-[28px] p-7 bg-[#140B28]/65 backdrop-blur-2xl backdrop-saturate-[190%] border border-white/25 shadow-[inset_1.5px_1.5px_2px_rgba(255,255,255,0.35),0_28px_80px_rgba(0,0,0,0.60)] text-center text-white ulm-preserve-dark ulm-preserve-glass"
        >
          {/* Animated Glass Icon Pedestal */}
          <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400/20 via-purple-500/20 to-transparent border border-amber-300/40 flex items-center justify-center shadow-[0_8px_24px_rgba(0,0,0,0.3)]">
            <Database className="w-6 h-6 text-amber-300 animate-pulse" />
          </div>

          {/* Architectural Status Micro-Tag */}
          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-md bg-white/[0.08] border border-white/[0.16]">
            <span className="w-1.5 h-1.5 rounded-[1.5px] bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]" />
            <span className="font-['JetBrains_Mono'] text-[10px] font-semibold uppercase tracking-[0.15em] text-amber-300">
              PLEASE WAIT · APP IS LOADING DATA
            </span>
          </div>

          {/* Crisp White Title */}
          <h2 className="mt-3 font-['Plus_Jakarta_Sans'] text-[20px] font-bold tracking-tight text-white">
            {task.title || 'Importing Library Catalog Batch'}
          </h2>

          {/* High-Contrast Monospace Progress Telemetry */}
          <p className="mt-1.5 font-['JetBrains_Mono'] text-[12px] font-medium text-purple-100/90 tabular-nums">
            {task.total > 0 ? (
              <>
                Processed{' '}
                <span className="text-amber-300 font-bold">
                  {(task.processed || 0).toLocaleString()}
                </span>{' '}
                of{' '}
                <span className="text-white font-bold">
                  {task.total.toLocaleString()}
                </span>{' '}
                records (
                <span className="text-emerald-300 font-bold">{safePct}%</span>)
              </>
            ) : (
              <>
                <span className="text-purple-100/90">
                  {task.subtitle || 'Hydrating IndexedDB library catalog...'}
                </span>
              </>
            )}
          </p>

          {/* Clearly Visible Progress Bar Track & Purple-Gold Fill */}
          <div className="mt-5 w-full">
            <div className="h-2.5 w-full rounded-full bg-white/15 border border-white/15 overflow-hidden p-[2px]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#A855F7] via-[#E879F9] to-[#FBBF24] shadow-[0_0_12px_rgba(251,191,36,0.55)] transition-all duration-150"
                style={{ width: `${Math.max(4, Math.min(100, safePct))}%` }}
              />
            </div>
            <div className="mt-2.5 flex items-center justify-between font-['JetBrains_Mono'] text-[10.5px] text-white/65">
              <span className="truncate">
                {task.subtitle || 'Indexing barcodes & SQLite records...'}
              </span>
              <span className="shrink-0 ml-2 text-amber-300 font-semibold tabular-nums">
                {safePct}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </BackgroundGradientAnimation>,
    document.body
  );
};

export const GlobalLoadingGate = GlobalHeavyTaskOverlay;
