import React from 'react';
export { AnimatedCounter } from './GlassCharts';

/**
 * Computes a capped GPU stagger delay style object so large catalogs (50,000+ books)
 * animate instantaneously without waiting on deep list indices.
 */
export function staggerDelayStyle(
  index: number,
  stepMs = 45,
  maxIndex = 11,
  durationMs?: number
): React.CSSProperties {
  const clamped = Math.max(0, Math.min(index, maxIndex));
  return durationMs
    ? { animationDelay: `${clamped * stepMs}ms`, animationDuration: `${durationMs}ms` }
    : { animationDelay: `${clamped * stepMs}ms` };
}

interface PageEnterProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Smooth 300ms GPU focus-fade wrapper for page switches, tab panels, and view switchers.
 */
export const PageEnter: React.FC<PageEnterProps> = ({ children, className = '' }) => (
  <div className={`ulm-page-enter ${className}`}>{children}</div>
);

interface StaggerCardProps extends React.HTMLAttributes<HTMLDivElement> {
  index?: number;
  stepMs?: number;
  maxIndex?: number;
  durationMs?: number;
  hoverLift?: boolean;
  children: React.ReactNode;
}

/**
 * GPU-composited staggered entrance container with optional subtle -2px hover lift.
 */
export const StaggerCard: React.FC<StaggerCardProps> = ({
  index = 0,
  stepMs = 45,
  maxIndex = 11,
  durationMs,
  hoverLift = false,
  className = '',
  style,
  children,
  ...rest
}) => (
  <div
    className={`ulm-stagger-card ${hoverLift ? 'ulm-card-hover' : ''} ${className}`}
    style={{ ...staggerDelayStyle(index, stepMs, maxIndex, durationMs), ...style }}
    {...rest}
  >
    {children}
  </div>
);

interface ScannerLaserLineProps {
  active?: boolean;
  className?: string;
}

/**
 * Calm amber-purple 1.5px horizontal laser sweep glow along the bottom edge of the active barcode scan bar.
 */
export const ScannerLaserLine: React.FC<ScannerLaserLineProps> = ({
  active = true,
  className = '',
}) => {
  if (!active) return null;
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-x-3 bottom-0 h-[1.5px] overflow-hidden rounded-full ${className}`}
    >
      <div className="ulm-scanner-sweep h-full w-1/2 bg-gradient-to-r from-transparent via-[#FFD147] via-50% to-[#A855F7]/80 shadow-[0_0_8px_rgba(255,209,71,0.55)]" />
    </div>
  );
};

interface CardFlipContainerProps {
  flipKey: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Smooth 260ms scale + opacity transition container for CR80 Front | Back card flips.
 */
export const CardFlipContainer: React.FC<CardFlipContainerProps> = ({
  flipKey,
  children,
  className = '',
}) => (
  <div key={flipKey} className={`ulm-card-flip ${className}`}>
    {children}
  </div>
);
