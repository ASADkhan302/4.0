import React, { useEffect, useLayoutEffect, useRef } from 'react';

export const LIQUID_ICON_FX_CSS = `
.ulm-nv-ico {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  will-change: transform;
}
.ulm-nv-ico svg {
  transition: transform 0.42s cubic-bezier(0.3, 1.6, 0.5, 1), color 0.2s ease;
  transform-origin: 50% 50%;
}
[data-liquid-active="true"] .ulm-nv-ico svg {
  transform: translateY(-1px) scale(1.1);
}
.ulm-nv-ico[data-fx="pop"] svg {
  animation: ulmNvPop 0.54s cubic-bezier(0.3, 1.6, 0.5, 1) both !important;
}
@keyframes ulmNvPop {
  0% { transform: scale(0.65); }
  55% { transform: translateY(-1.5px) scale(1.28); }
  80% { transform: translateY(0.5px) scale(0.95); }
  100% { transform: translateY(-1px) scale(1.1); }
}
.ulm-nv-ico[data-fx="hop"] svg {
  animation: ulmNvHop 0.68s cubic-bezier(0.3, 1.4, 0.5, 1) both !important;
  transform-origin: 50% 90%;
}
@keyframes ulmNvHop {
  0% { transform: translateY(0) scale(0.9, 1.1); }
  30% { transform: translateY(-5px) scale(1.08, 0.94); }
  55% { transform: translateY(1px) scale(1.14, 0.86); }
  78% { transform: translateY(-2.5px) scale(0.97, 1.05); }
  100% { transform: translateY(-1px) scale(1.1); }
}
.ulm-nv-ico[data-fx="spin"] svg {
  animation: ulmNvSpin 0.76s cubic-bezier(0.2, 0.75, 0.25, 1) both !important;
}
@keyframes ulmNvSpin {
  0% { transform: perspective(100px) rotateY(0deg) rotateZ(-25deg) scale(0.82); }
  60% { transform: perspective(100px) rotateY(220deg) rotateZ(12deg) scale(1.18); }
  100% { transform: perspective(100px) rotateY(360deg) rotateZ(0deg) translateY(-1px) scale(1.1); }
}
.ulm-nv-ico[data-fx="wave"] svg {
  animation: ulmNvWave 0.72s ease-in-out both !important;
  transform-origin: 50% 85%;
}
@keyframes ulmNvWave {
  0% { transform: rotate(0deg) scale(0.88); }
  20% { transform: rotate(-16deg) scale(1.14); }
  42% { transform: rotate(14deg) scale(1.14); }
  64% { transform: rotate(-9deg) scale(1.1); }
  82% { transform: rotate(5deg) scale(1.08); }
  100% { transform: rotate(0deg) translateY(-1px) scale(1.1); }
}
@media (prefers-reduced-motion: reduce) {
  .ulm-nv-ico svg { animation: none !important; transition: none !important; }
}
`;

export type LiquidIconFx = 'pop' | 'hop' | 'spin' | 'wave';

interface Droplet {
  pos: number;
  cross: number;
  vPos: number;
  vCross: number;
  r: number;
  k: number;
}

interface Ripple {
  x: number;
  y: number;
  age: number;
  amp: number;
}

interface LiquidPillOverlayProps {
  containerRef: React.RefObject<HTMLElement | null>;
  itemRefs: React.MutableRefObject<Record<string, HTMLElement | null>>;
  activeKey: string;
  axis: 'x' | 'y';
  /** Matches ULM existing active pill look (purple glass + gold/violet rim) */
  variant?: 'purple-pill' | 'sidebar-pill';
  /** Optional tick counter to trigger a liquid pulse/ripple even when clicking the already-active item */
  triggerTick?: number;
  /** Optional Tailwind border-radius class override for the pill & ripple */
  roundedClass?: string;
}

export const LiquidPillOverlay: React.FC<LiquidPillOverlayProps> = ({
  containerRef,
  itemRefs,
  activeKey,
  axis,
  variant = 'purple-pill',
  triggerTick = 0,
  roundedClass,
}) => {
  const mainPillRef = useRef<HTMLDivElement | null>(null);
  const satRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rippleRef = useRef<HTMLDivElement | null>(null);
  const activeKeyRef = useRef(activeKey);
  activeKeyRef.current = activeKey;

  const stateRef = useRef({
    a: { p: 0, v: 0 }, // Body A position & velocity along primary axis
    b: { p: 0, v: 0 }, // Body B position & velocity along primary axis
    cross: 0,          // Cross-axis top/left offset
    crossSize: 34,     // Cross-axis height/width
    targetP: 0,        // Target center along primary axis
    halfSpan: 40,      // Half size along primary axis
    currentHalfSpan: 40,
    squash: { s: 1, v: 0 },
    lead: 0 as 0 | 1,
    lagUntil: 0,
    moving: false,
    split: false,
    rippledThisMove: false,
    ready: false,
    sats: [] as Droplet[],
    ripples: [] as Ripple[],
    raf: 0,
    lastTime: 0,
    lastKey: '',
    lastTick: 0,
  });

  const renderFrame = () => {
    const s = stateRef.current;
    const pill = mainPillRef.current;
    if (!pill || !s.ready) return;

    const sep = Math.abs(s.a.p - s.b.p);
    const stretchFactor = Math.min(sep / Math.max(16, 2 * s.currentHalfSpan), 1);
    const minCenter = Math.min(s.a.p, s.b.p);
    const totalLength = sep + s.currentHalfSpan * 2;
    const startEdge = minCenter - s.currentHalfSpan;

    if (axis === 'x') {
      const neckScaleY = Math.max(0.74, Math.min(1.16, s.squash.s * (1 - 0.16 * stretchFactor)));
      pill.style.width = `${Math.max(24, totalLength).toFixed(2)}px`;
      pill.style.height = `${Math.max(20, s.crossSize).toFixed(2)}px`;
      pill.style.transform = `translate3d(${startEdge.toFixed(2)}px, ${s.cross.toFixed(2)}px, 0) scaleY(${neckScaleY.toFixed(3)})`;
    } else {
      const neckScaleX = Math.max(0.78, Math.min(1.12, s.squash.s * (1 - 0.11 * stretchFactor)));
      pill.style.height = `${Math.max(24, totalLength).toFixed(2)}px`;
      pill.style.width = `${Math.max(24, s.crossSize).toFixed(2)}px`;
      pill.style.transform = `translate3d(${s.cross.toFixed(2)}px, ${startEdge.toFixed(2)}px, 0) scaleX(${neckScaleX.toFixed(3)})`;
    }

    // Render up to 3 trailing liquid droplets during jumps
    for (let i = 0; i < 3; i++) {
      const el = satRefs.current[i];
      const d = s.sats[i];
      if (!el) continue;
      if (!d || d.r <= 0.6) {
        el.style.opacity = '0';
      } else {
        const size = d.r * 2.25;
        const x = axis === 'x' ? d.pos - size / 2 : d.cross - size / 2;
        const y = axis === 'x' ? d.cross - size / 2 : d.pos - size / 2;
        el.style.width = `${size.toFixed(1)}px`;
        el.style.height = `${size.toFixed(1)}px`;
        el.style.opacity = `${Math.min(0.92, d.r / 5.2).toFixed(2)}`;
        el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
      }
    }

    // Render landing merge ripple
    const ripEl = rippleRef.current;
    const activeRip = s.ripples[s.ripples.length - 1];
    if (ripEl) {
      if (!activeRip) {
        ripEl.style.opacity = '0';
      } else {
        const progress = Math.min(1, activeRip.age / 0.52);
        const easeOut = 1 - Math.pow(1 - progress, 2.2);
        const scaleX = axis === 'x' ? 0.92 + easeOut * 0.24 : 0.94 + easeOut * 0.14;
        const scaleY = axis === 'x' ? 0.92 + easeOut * 0.32 : 0.92 + easeOut * 0.28;
        const opacity = (1 - progress) * 0.65 * activeRip.amp;
        ripEl.style.width = `${(axis === 'x' ? s.currentHalfSpan * 2 : s.crossSize).toFixed(1)}px`;
        ripEl.style.height = `${(axis === 'x' ? s.crossSize : s.currentHalfSpan * 2).toFixed(1)}px`;
        const rx = axis === 'x' ? s.targetP - s.currentHalfSpan : s.cross;
        const ry = axis === 'x' ? s.cross : s.targetP - s.currentHalfSpan;
        ripEl.style.opacity = `${opacity.toFixed(3)}`;
        ripEl.style.transform = `translate3d(${rx.toFixed(2)}px, ${ry.toFixed(2)}px, 0) scale(${scaleX.toFixed(3)}, ${scaleY.toFixed(3)})`;
      }
    }
  };

  const stepPhysics = (dt: number, now: number) => {
    const s = stateRef.current;
    s.currentHalfSpan += (s.halfSpan - s.currentHalfSpan) * Math.min(1, dt * 16);

    const bodies = [s.a, s.b];
    let still = true;

    bodies.forEach((B, i) => {
      const isLead = i === s.lead;
      // Snappy leading head + elastic trailing tail for signature liquid stretch
      const k = isLead ? 260 : 88;
      const c = isLead ? 25 : 14.5;
      const lagFactor = !isLead && now < s.lagUntil ? 0.06 : 1;
      B.v += (k * (s.targetP - B.p) - c * B.v) * dt * lagFactor;
      B.p += B.v * dt;
      if (Math.abs(s.targetP - B.p) > 0.25 || Math.abs(B.v) > 2.5) {
        still = false;
      } else {
        B.p = s.targetP;
        B.v = 0;
      }
    });

    const leadBody = bodies[s.lead];
    const tailBody = bodies[1 - s.lead];
    const targetSquash = 1 - 0.16 * Math.min(Math.abs(leadBody.v) / 1100, 1);
    s.squash.v += (290 * (targetSquash - s.squash.s) - 12 * s.squash.v) * dt;
    s.squash.s += s.squash.v * dt;
    if (Math.abs(s.squash.s - 1) > 0.002 || Math.abs(s.squash.v) > 0.02) {
      still = false;
    } else {
      s.squash.s = 1;
      s.squash.v = 0;
    }

    // Neck-break: spawn trailing liquid droplets when stretched beyond threshold
    const sep = Math.abs(s.a.p - s.b.p);
    const splitThreshold = axis === 'y' ? Math.max(18, s.currentHalfSpan * 0.95) : Math.max(26, s.currentHalfSpan * 0.8);
    if (!s.split && s.moving && sep > splitThreshold) {
      s.split = true;
      const crossCenter = s.cross + s.crossSize / 2;
      s.sats = [0.22, 0.46, 0.7].map((t, idx) => ({
        pos: tailBody.p + (leadBody.p - tailBody.p) * t,
        cross: crossCenter + (idx === 1 ? -3.5 : idx === 2 ? 3.5 : 1.5),
        vPos: (tailBody.v + leadBody.v) * 0.38,
        vCross: (idx % 2 === 0 ? 1 : -1) * (18 + idx * 8),
        r: 6.2 - idx * 0.85,
        k: 115 + idx * 38,
      }));
    }

    const crossCenter = s.cross + s.crossSize / 2;
    s.sats = s.sats.filter((d) => {
      d.vPos += (d.k * (s.targetP - d.pos) - 10 * d.vPos) * dt;
      d.vCross += (95 * (crossCenter - d.cross) - 9 * d.vCross) * dt;
      d.pos += d.vPos * dt;
      d.cross += d.vCross * dt;
      if (Math.abs(s.targetP - d.pos) < Math.max(12, s.currentHalfSpan * 0.48)) {
        d.r -= dt * 18;
      }
      return d.r > 0.55;
    });

    if (s.sats.length > 0) still = false;

    // Trigger landing merge ripple as the trailing body snaps into the target
    if (
      s.moving &&
      !s.rippledThisMove &&
      Math.abs(s.targetP - tailBody.p) < Math.max(10, s.currentHalfSpan * 0.42)
    ) {
      s.rippledThisMove = true;
      s.squash.v += 1.35; // Elastic merge plop
      s.ripples.push({
        x: s.targetP,
        y: crossCenter,
        age: 0,
        amp: s.split ? 1.25 : 0.85,
      });
    }

    if (s.moving && still) {
      s.moving = false;
    }

    s.ripples.forEach((r) => (r.age += dt));
    s.ripples = s.ripples.filter((r) => r.age < 0.54);
    if (s.ripples.length > 0) still = false;

    return !still;
  };

  const startLoop = () => {
    const s = stateRef.current;
    if (s.raf) return;
    s.lastTime = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(Math.max((now - s.lastTime) / 1000, 0.001), 1 / 24);
      s.lastTime = now;
      const keepGoing = stepPhysics(dt, now);
      renderFrame();
      if (keepGoing) {
        s.raf = requestAnimationFrame(tick);
      } else {
        s.raf = 0;
      }
    };
    s.raf = requestAnimationFrame(tick);
  };

  const measureTarget = (isActionTrigger = false) => {
    const container = containerRef.current;
    const key = activeKeyRef.current;
    const targetEl = itemRefs.current[key];
    if (!container || !targetEl) return;

    const cRect = container.getBoundingClientRect();
    const tRect = targetEl.getBoundingClientRect();
    if (cRect.width === 0 || cRect.height === 0 || tRect.width === 0 || tRect.height === 0) return;

    // Account for any CSS transform scale or container border offset
    const scaleX = container.offsetWidth > 0 ? cRect.width / container.offsetWidth : 1;
    const scaleY = container.offsetHeight > 0 ? cRect.height / container.offsetHeight : 1;

    const relLeft = (tRect.left - cRect.left) / scaleX - (container.clientLeft || 0);
    const relTop = (tRect.top - cRect.top) / scaleY - (container.clientTop || 0);
    const relWidth = tRect.width / scaleX;
    const relHeight = tRect.height / scaleY;

    const s = stateRef.current;
    const nextP = axis === 'x' ? relLeft + relWidth / 2 : relTop + relHeight / 2;
    const nextHalfSpan = (axis === 'x' ? relWidth : relHeight) / 2;
    const nextCross = axis === 'x' ? relTop : relLeft;
    const nextCrossSize = axis === 'x' ? relHeight : relWidth;

    s.halfSpan = nextHalfSpan;
    s.cross = nextCross;
    s.crossSize = nextCrossSize;

    const keyChanged = s.lastKey !== key;
    const tickChanged = s.lastTick !== triggerTick;
    s.lastKey = key;
    s.lastTick = triggerTick;

    if (!s.ready) {
      s.a.p = s.b.p = nextP;
      s.a.v = s.b.v = 0;
      s.currentHalfSpan = nextHalfSpan;
      s.targetP = nextP;
      s.ready = true;
      renderFrame();
      return;
    }

    const dist = Math.abs(nextP - s.targetP);
    if (keyChanged || dist > 1.5) {
      if (isActionTrigger || keyChanged) {
        s.lead = Math.abs(nextP - s.a.p) <= Math.abs(nextP - s.b.p) ? 0 : 1;
        s.lagUntil = performance.now() + 72;
        s.targetP = nextP;
        s.moving = true;
        s.split = false;
        s.rippledThisMove = false;
        startLoop();
      } else {
        // Passive layout shift (e.g. sidebar collapse/expand or scroll): keep pill anchored
        if (!s.moving) {
          s.a.p = s.b.p = nextP;
          s.currentHalfSpan = nextHalfSpan;
          s.targetP = nextP;
          renderFrame();
        } else {
          s.targetP = nextP;
          startLoop();
        }
      }
    } else if (isActionTrigger && tickChanged) {
      // Clicking the already-active item triggers a tactile liquid pulse + ripple
      s.squash.v = -1.65;
      s.ripples.push({
        x: s.targetP,
        y: s.cross + s.crossSize / 2,
        age: 0,
        amp: 0.75,
      });
      startLoop();
    } else {
      if (!s.moving) {
        s.currentHalfSpan = nextHalfSpan;
      }
      renderFrame();
    }
  };

  // Trigger physics immediately on activeKey or triggerTick change without cancelling the RAF loop
  useLayoutEffect(() => {
    measureTarget(true);
  }, [activeKey, triggerTick]);

  // Re-observe active target element when activeKey changes (without cancelling RAF)
  useEffect(() => {
    const container = containerRef.current;
    const activeEl = itemRefs.current[activeKey];
    const ro = new ResizeObserver(() => measureTarget(false));
    if (container) ro.observe(container);
    if (activeEl) ro.observe(activeEl);
    const handleScrollOrResize = () => measureTarget(false);
    window.addEventListener('resize', handleScrollOrResize);
    container?.addEventListener('scroll', handleScrollOrResize, { capture: true, passive: true });
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', handleScrollOrResize);
      container?.removeEventListener('scroll', handleScrollOrResize, { capture: true });
    };
  }, [activeKey]);

  // Cancel RAF ONLY on full component unmount
  useEffect(() => {
    return () => {
      if (stateRef.current.raf) {
        cancelAnimationFrame(stateRef.current.raf);
        stateRef.current.raf = 0;
      }
    };
  }, []);

  const resolvedRadius = roundedClass || (variant === 'sidebar-pill' ? 'rounded-[10px]' : 'rounded-lg');

  const basePillClasses =
    variant === 'sidebar-pill'
      ? `pointer-events-none absolute top-0 left-0 z-0 ${resolvedRadius} bg-gradient-to-r from-[#581C87]/92 via-[#6B21A8]/85 to-[#3B1054]/90 border border-[#FFD147]/55 shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.38),0_6px_18px_rgba(88,28,135,0.48)] will-change-transform`
      : `pointer-events-none absolute top-0 left-0 z-0 ${resolvedRadius} bg-gradient-to-r from-[#581C87]/95 to-[#7E22CE]/90 border border-[#FFD147]/55 shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.42),0_4px_14px_rgba(126,34,206,0.45)] will-change-transform`;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: LIQUID_ICON_FX_CSS }} />
      {/* Main stretching liquid drop */}
      <div
        ref={mainPillRef}
        className={basePillClasses}
        style={{ transformOrigin: 'center center' }}
      />
      {/* Satellite droplets on jumps */}
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          ref={(el) => {
            satRefs.current[i] = el;
          }}
          className="pointer-events-none absolute top-0 left-0 z-[1] rounded-full bg-gradient-to-br from-[#C084FC] via-[#A855F7] to-[#FFD147] shadow-[0_0_8px_rgba(255,209,71,0.7)] opacity-0 will-change-transform"
        />
      ))}
      {/* Merge ripple ring */}
      <div
        ref={rippleRef}
        className={`pointer-events-none absolute top-0 left-0 z-[1] ${resolvedRadius} border-2 border-[#FFD147]/75 dark:border-[#FFD147]/70 shadow-[0_0_14px_rgba(255,209,71,0.35)] opacity-0 will-change-transform`}
        style={{ transformOrigin: 'center center' }}
      />
    </>
  );
};
