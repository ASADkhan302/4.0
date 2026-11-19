import React from 'react';
import { motion, HTMLMotionProps, Variants } from 'motion/react';
import { cn } from '../../lib/utils';

type LiquidGlassCardProps = HTMLMotionProps<'div'> & {
  children: React.ReactNode;
  className?: string;
  draggable?: boolean;
  expandable?: boolean;
  width?: string;
  height?: string;
  expandedWidth?: string;
  expandedHeight?: string;
  blurIntensity?: 'sm' | 'md' | 'lg' | 'xl';
  shadowIntensity?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  borderRadius?: string;
  glowIntensity?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  enableDistortion?: boolean;
};

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
  const [isExpanded, setIsExpanded] = React.useState(false);

  const handleToggleExpansion = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!expandable) return;
    if ((e.target as HTMLElement).closest('a, button, input, select, textarea')) return;
    setIsExpanded(!isExpanded);
  };

  const blurClasses = {
    sm: 'backdrop-blur-md backdrop-saturate-[160%]',
    md: 'backdrop-blur-lg backdrop-saturate-[170%]',
    lg: 'backdrop-blur-xl backdrop-saturate-[175%]',
    xl: 'backdrop-blur-2xl backdrop-saturate-[180%]',
  };

  const shadowStyles = {
    none: 'inset 0 0 0 0 rgba(255, 255, 255, 0)',
    xs: 'inset 1px 1px 1px 0 rgba(255, 255, 255, 0.35), inset -1px -1px 1px 0 rgba(255, 255, 255, 0.12)',
    sm: 'inset 1.5px 1.5px 2px 0 rgba(255, 255, 255, 0.45), inset -1.5px -1.5px 1.5px 0 rgba(255, 255, 255, 0.15)',
    md: 'inset 2px 2px 3px 0 rgba(255, 255, 255, 0.52), inset -2px -2px 2px 0 rgba(255, 255, 255, 0.18)',
    lg: 'inset 3px 3px 5px 0 rgba(255, 255, 255, 0.58), inset -3px -3px 3px 0 rgba(255, 255, 255, 0.22)',
    xl: 'inset 4px 4px 8px 0 rgba(255, 255, 255, 0.65), inset -4px -4px 4px 0 rgba(255, 255, 255, 0.28)',
  };

  const glowStyles = {
    none: '0 4px 12px rgba(0, 0, 0, 0.12)',
    xs: '0 8px 24px rgba(0, 0, 0, 0.16), 0 0 12px rgba(255, 255, 255, 0.05)',
    sm: '0 10px 30px rgba(0, 0, 0, 0.2), 0 0 18px rgba(255, 255, 255, 0.08)',
    md: '0 14px 36px rgba(0, 0, 0, 0.24), 0 0 24px rgba(255, 255, 255, 0.12)',
    lg: '0 18px 44px rgba(0, 0, 0, 0.28), 0 0 32px rgba(255, 255, 255, 0.16)',
    xl: '0 24px 56px rgba(0, 0, 0, 0.32), 0 0 40px rgba(255, 255, 255, 0.22)',
  };

  const containerVariants: Variants | undefined = expandable
    ? {
        collapsed: { width: width || 'auto', height: height || 'auto', transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const } },
        expanded: { width: expandedWidth || 'auto', height: expandedHeight || 'auto', transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const } },
      }
    : undefined;

  return (
    <>
      {enableDistortion && (
        <svg className="hidden" aria-hidden="true">
          <defs>
            <filter id="glass-blur" x="0" y="0" width="100%" height="100%" filterUnits="objectBoundingBox">
              <feTurbulence type="fractalNoise" baseFrequency="0.003 0.007" numOctaves="1" result="turbulence" />
              <feDisplacementMap in="SourceGraphic" in2="turbulence" scale="120" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </defs>
        </svg>
      )}
      <motion.div
        className={cn(
          'relative overflow-hidden transition-all duration-300',
          'bg-gradient-to-br from-white/50 via-white/30 to-white/15 dark:from-white/[0.08] dark:via-white/[0.04] dark:to-white/[0.02]',
          'border border-white/60 dark:border-white/[0.16]',
          draggable && 'cursor-grab active:cursor-grabbing',
          expandable && 'cursor-pointer',
          className
        )}
        style={{
          borderRadius,
          ...(width && !expandable && { width }),
          ...(height && !expandable && { height }),
        }}
        variants={containerVariants}
        animate={expandable ? (isExpanded ? 'expanded' : 'collapsed') : undefined}
        onClick={expandable ? handleToggleExpansion : undefined}
        drag={draggable}
        dragConstraints={draggable ? { left: 0, right: 0, top: 0, bottom: 0 } : undefined}
        dragElastic={draggable ? 0.3 : undefined}
        dragTransition={draggable ? { bounceStiffness: 300, bounceDamping: 10, power: 0.3 } : undefined}
        whileDrag={draggable ? { scale: 1.02 } : undefined}
        {...props}
      >
        {/* Frosted Bend Layer */}
        <div
          className={cn('absolute inset-0 z-0 pointer-events-none', blurClasses[blurIntensity])}
          style={{
            borderRadius,
            ...(enableDistortion ? { filter: 'url(#glass-blur)' } : {}),
          }}
        />
        {/* Specular Rim & Depth Layer */}
        <div
          className="absolute inset-0 z-10 pointer-events-none"
          style={{
            borderRadius,
            boxShadow: glowStyles[glowIntensity],
          }}
        />
        {/* Curved Inner Edge Highlight */}
        <div
          className="absolute inset-0 z-20 pointer-events-none"
          style={{
            borderRadius,
            boxShadow: shadowStyles[shadowIntensity],
          }}
        />
        {/* Card Content */}
        <div className="relative z-30 h-full w-full">{children}</div>
      </motion.div>
    </>
  );
};
