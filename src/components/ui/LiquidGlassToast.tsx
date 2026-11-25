import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, Info, AlertTriangle, Trash2, X } from 'lucide-react';

export type GlassToastType = 'success' | 'info' | 'warning' | 'danger';

export interface GlassToastPayload {
  type: GlassToastType;
  title: string;
  message?: string;
  meta?: string; // e.g. "Acc #17 · 0092000000017" or "TEST 1 · Shelf 2"
  durationMs?: number; // Default: 3800ms
}

interface GlassToastItem extends GlassToastPayload {
  id: string;
  durationMs: number;
}

const TOAST_EVENT_NAME = 'ulm-glass-toast';
const MAX_VISIBLE_TOASTS = 3;
const DEFAULT_DURATION_MS = 3800;

export function notifyGlassToast(payload: GlassToastPayload): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<GlassToastPayload>(TOAST_EVENT_NAME, { detail: payload }));
}

const SEMANTIC_STYLES: Record<
  GlassToastType,
  {
    badgeClass: string;
    barClass: string;
    Icon: React.ComponentType<{ className?: string }>;
  }
> = {
  success: {
    badgeClass: 'bg-emerald-500/15 border-emerald-400/35 text-emerald-600 dark:text-emerald-300',
    barClass: 'bg-gradient-to-r from-emerald-400 to-teal-400',
    Icon: CheckCircle2,
  },
  info: {
    badgeClass: 'bg-sky-500/15 border-sky-400/35 text-sky-600 dark:text-sky-300',
    barClass: 'bg-gradient-to-r from-purple-400 to-sky-400',
    Icon: Info,
  },
  warning: {
    badgeClass: 'bg-amber-500/15 border-amber-400/35 text-amber-600 dark:text-amber-300',
    barClass: 'bg-gradient-to-r from-amber-400 to-orange-400',
    Icon: AlertTriangle,
  },
  danger: {
    badgeClass: 'bg-rose-500/15 border-rose-400/35 text-rose-600 dark:text-rose-300',
    barClass: 'bg-gradient-to-r from-rose-400 to-pink-500',
    Icon: Trash2,
  },
};

interface ToastCardProps {
  toast: GlassToastItem;
  onDismiss: (id: string) => void;
}

const LiquidGlassToastCard: React.FC<ToastCardProps> = ({ toast, onDismiss }) => {
  const [isPaused, setIsPaused] = useState(false);
  const remainingRef = useRef<number>(toast.durationMs);
  const progressRef = useRef<HTMLDivElement | null>(null);
  const { badgeClass, barClass, Icon } = SEMANTIC_STYLES[toast.type] || SEMANTIC_STYLES.info;

  useEffect(() => {
    if (isPaused) return;
    let rafId = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const delta = Math.min(100, Math.max(0, now - lastTime));
      lastTime = now;
      remainingRef.current = Math.max(0, remainingRef.current - delta);

      const fraction = toast.durationMs > 0 ? remainingRef.current / toast.durationMs : 0;
      if (progressRef.current) {
        progressRef.current.style.transform = `scaleX(${fraction})`;
      }

      if (remainingRef.current <= 0) {
        onDismiss(toast.id);
        return;
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPaused, toast.id, toast.durationMs, onDismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 36, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 28, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      role={toast.type === 'danger' || toast.type === 'warning' ? 'alert' : 'status'}
      className="pointer-events-auto relative overflow-hidden rounded-[20px] px-4 py-3.5 bg-gradient-to-br from-white/92 via-white/84 to-white/75 dark:from-[#1E1338]/90 dark:via-[#150D2A]/88 dark:to-[#0E081D]/90 backdrop-blur-2xl backdrop-saturate-[195%] border border-white/85 dark:border-white/[0.16] shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.85),0_18px_48px_rgba(15,23,42,0.16)] dark:shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.22),0_20px_55px_rgba(0,0,0,0.72)]"
    >
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border mt-0.5 ${badgeClass}`}>
          <Icon className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0 pr-1">
          <div className="font-['Plus_Jakarta_Sans'] text-[13px] font-bold text-slate-900 dark:text-white leading-snug break-words">
            {toast.title}
          </div>
          {toast.message && (
            <div className="font-['Plus_Jakarta_Sans'] text-[11.5px] text-slate-600 dark:text-slate-300/85 mt-0.5 leading-snug break-words">
              {toast.message}
            </div>
          )}
          {toast.meta && (
            <div className="inline-flex items-center max-w-full truncate mt-1.5 px-2 py-0.5 rounded-md bg-slate-900/[0.05] dark:bg-white/[0.06] border border-slate-200/80 dark:border-white/[0.10] font-['JetBrains_Mono'] text-[10px] font-semibold text-amber-700 dark:text-amber-300">
              {toast.meta}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          aria-label="Dismiss notification"
          className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-colors hover:bg-slate-900/10 dark:hover:bg-white/10 text-slate-400 hover:text-slate-800 dark:hover:text-white cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Synchronized 2px animated bottom countdown bar */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-slate-900/[0.05] dark:bg-white/[0.06]">
        <div
          ref={progressRef}
          style={{ transform: 'scaleX(1)' }}
          className={`h-full w-full origin-left ${barClass}`}
        />
      </div>
    </motion.div>
  );
};

export const LiquidGlassToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<GlassToastItem[]>([]);
  const idCounterRef = useRef(0);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  useEffect(() => {
    const handleToastEvent = (event: Event) => {
      const customEvent = event as CustomEvent<GlassToastPayload>;
      const detail = customEvent.detail;
      if (!detail || !detail.title) return;

      idCounterRef.current += 1;
      const newToast: GlassToastItem = {
        ...detail,
        id: `ulm-toast-${Date.now()}-${idCounterRef.current}`,
        durationMs: typeof detail.durationMs === 'number' && detail.durationMs > 0 ? detail.durationMs : DEFAULT_DURATION_MS,
      };

      setToasts((prev) => {
        const next = [...prev, newToast];
        return next.length > MAX_VISIBLE_TOASTS ? next.slice(next.length - MAX_VISIBLE_TOASTS) : next;
      });
    };

    window.addEventListener(TOAST_EVENT_NAME, handleToastEvent as EventListener);
    return () => {
      window.removeEventListener(TOAST_EVENT_NAME, handleToastEvent as EventListener);
    };
  }, []);

  if (typeof document === 'undefined' || !document.body) {
    return null;
  }

  return createPortal(
    <div
      aria-live="polite"
      aria-relevant="additions removals"
      className="fixed bottom-5 right-5 z-[999999] flex flex-col gap-2.5 pointer-events-none max-w-[92vw] w-[368px]"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <LiquidGlassToastCard key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </AnimatePresence>
    </div>,
    document.body
  );
};
