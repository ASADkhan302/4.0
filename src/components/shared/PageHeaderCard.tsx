import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface PageHeaderCardProps {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  badgeContent?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeaderCard: React.FC<PageHeaderCardProps> = ({
  title,
  subtitle,
  icon: Icon,
  badgeContent,
  actions,
  className = '',
}) => {
  return (
    <div 
      className={`ulm-preserve-glass relative overflow-hidden rounded-[22px] bg-gradient-to-br from-white/50 via-white/30 to-white/15 dark:from-white/[0.08] dark:via-white/[0.04] dark:to-white/[0.02] backdrop-blur-2xl backdrop-saturate-[180%] border border-white/60 dark:border-white/[0.16] p-5 shadow-[inset_1.5px_1.5px_2px_rgba(255,255,255,0.45),inset_-1.5px_-1.5px_1.5px_rgba(255,255,255,0.15),0_10px_30px_rgba(0,0,0,0.2)] ${className}`}
    >
      {/* 2px Gold Hairline on top edge */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#541A72] via-[#FFD147] to-[#BC881B]" />

      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Title & Icon Block */}
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-purple-500/15 dark:bg-[#BC881B]/15 border border-purple-500/30 dark:border-[#FFD147]/30 flex items-center justify-center text-[#541A72] dark:text-[#FFD147] shrink-0 shadow-2xs">
            <Icon className="w-5 h-5 stroke-[2]" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 
                className="font-cinzel text-slate-900 dark:text-white font-bold tracking-tight text-[clamp(22px,2vw,28px)] leading-tight"
                dir="auto"
              >
                {title}
              </h1>
              {badgeContent}
            </div>
            <p className="text-[13px] text-slate-600 dark:text-slate-300 mt-1 leading-normal font-sans" dir="auto">
              {subtitle}
            </p>
          </div>
        </div>

        {/* Header Actions Toolbar (Wrapped on narrow screens, min-height 40px, never truncated) */}
        {actions && (
          <div className="flex flex-wrap items-center gap-2.5 shrink-0 ml-auto">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};
