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
      className={`relative overflow-hidden rounded-[14px] bg-white/95 dark:bg-gradient-to-b dark:from-[#221F26] dark:to-[#1A1A1A] border border-slate-200/80 dark:border-[#2E2A33] p-5 shadow-sm dark:shadow-[0_4px_20px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06)] ${className}`}
    >
      {/* 2px Gold Hairline on top edge */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#BC881B]" />

      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Title & Icon Block */}
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded-[10px] bg-amber-500/10 dark:bg-[#BC881B]/15 border border-amber-500/25 dark:border-[#BC881B]/30 flex items-center justify-center text-amber-700 dark:text-[#E0B450] shrink-0 shadow-2xs">
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
            <p className="text-[13px] text-slate-600 dark:text-[#B3AABD] mt-1 leading-normal font-sans" dir="auto">
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
