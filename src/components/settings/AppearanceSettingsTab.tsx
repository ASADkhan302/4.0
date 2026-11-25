import React, { useState, useEffect } from 'react';
import { 
  Sun, 
  Moon, 
  Monitor, 
  Sparkles, 
  Check, 
  Palette,
  Maximize2
} from 'lucide-react';
import { 
  getStoredThemeConfig, 
  saveThemeConfig, 
  UlmThemeConfig, 
  WHITE_TONES, 
  WhiteTone, 
  getStoredResolutionConfig, 
  saveResolutionConfig, 
  UlmResolutionConfig, 
  ResolutionPreset, 
  subscribeThemeConfig, 
  subscribeResolutionConfig, 
  calculateAutoFitScale 
} from '../../services/displayResolutionManager';
import { triggerCircularThemeTransition } from '../../utils/themeTransition';

export const AppearanceSettingsTab: React.FC = () => {
  const [themeConfig, setThemeConfig] = useState<UlmThemeConfig>(getStoredThemeConfig);
  const [resolutionConfig, setResolutionConfig] = useState<UlmResolutionConfig>(getStoredResolutionConfig);

  useEffect(() => {
    const unsubTheme = subscribeThemeConfig(setThemeConfig);
    const unsubRes = subscribeResolutionConfig(setResolutionConfig);
    return () => {
      unsubTheme();
      unsubRes();
    };
  }, []);

  const handleToggleTheme = (mode: 'light' | 'dark', triggerEl?: HTMLElement | null) => {
    void triggerCircularThemeTransition(triggerEl || null, () => {
      const updated: UlmThemeConfig = { ...themeConfig, themeMode: mode };
      setThemeConfig(updated);
      saveThemeConfig(updated);
    });
  };

  const handleSelectWhiteTone = (tone: WhiteTone) => {
    const updated: UlmThemeConfig = { ...themeConfig, whiteTone: tone };
    setThemeConfig(updated);
    saveThemeConfig(updated);
  };

  const handleSelectResolutionPreset = (preset: ResolutionPreset) => {
    let scale = 1.0;
    let mode: 'auto' | 'manual' = 'manual';

    if (preset === 'auto') {
      mode = 'auto';
      scale = calculateAutoFitScale();
    } else if (preset === 'native') {
      scale = 0.85;
    } else if (preset === 'desktop-1080') {
      scale = 1.0;
    } else if (preset === 'large-4k') {
      scale = 1.15;
    }

    const updated: UlmResolutionConfig = {
      mode,
      preset,
      scale,
    };
    setResolutionConfig(updated);
    saveResolutionConfig(updated);
  };

  const handleManualScaleChange = (scale: number) => {
    const updated: UlmResolutionConfig = {
      mode: 'manual',
      preset: 'desktop-1080',
      scale,
    };
    setResolutionConfig(updated);
    saveResolutionConfig(updated);
  };

  return (
    <div className="space-y-5">
      {/* Section Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-slate-200/70 dark:border-white/[0.09]">
        <div className="w-9 h-9 rounded-xl bg-amber-500/12 border border-amber-400/30 flex items-center justify-center text-amber-600 dark:text-amber-300 shrink-0">
          <Palette className="w-4 h-4 stroke-[2]" />
        </div>
        <div>
          <h3 className="text-[15px] font-bold text-slate-900 dark:text-white leading-tight tracking-tight font-['Plus_Jakarta_Sans']">
            Appearance, Display Scaling &amp; Official Crest
          </h3>
          <p className="text-[12px] text-slate-500 dark:text-slate-300/80 mt-0.5">
            Workstation visual style, low-glare surface tone, fluid resolution scaling, and institutional crest.
          </p>
        </div>
      </div>

      {/* 2-Column Consolidated Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
        {/* Left Column: Theme Mode & Surface Tones */}
        <div className="space-y-3.5">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300 block">
            Color Theme (روشن یا تاریک موڈ)
          </span>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={(e) => handleToggleTheme('light', e.currentTarget)}
              className={`p-3 !rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                themeConfig.themeMode === 'light'
                  ? 'border-amber-500/60 bg-amber-500/12 dark:bg-amber-500/[0.14] shadow-xs ring-1 ring-amber-500/40'
                  : 'border-slate-200/80 dark:border-white/[0.10] bg-white/60 dark:bg-white/[0.035] hover:bg-white/90 dark:hover:bg-white/[0.06]'
              }`}
            >
              <div className="w-8 h-8 rounded-xl bg-amber-500/12 border border-amber-400/30 flex items-center justify-center text-amber-600 dark:text-amber-300 shrink-0">
                <Sun className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-white truncate">White Mode</div>
                <div className="text-[10.5px] text-slate-500 dark:text-slate-400 truncate">Eye-Comfort Alabaster</div>
              </div>
            </button>

            <button
              type="button"
              onClick={(e) => handleToggleTheme('dark', e.currentTarget)}
              className={`p-3 !rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                themeConfig.themeMode === 'dark'
                  ? 'border-amber-500/60 bg-purple-950/50 dark:bg-amber-500/[0.14] shadow-xs ring-1 ring-amber-500/40'
                  : 'border-slate-200/80 dark:border-white/[0.10] bg-white/60 dark:bg-white/[0.035] hover:bg-white/90 dark:hover:bg-white/[0.06]'
              }`}
            >
              <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-400/30 flex items-center justify-center text-purple-600 dark:text-purple-300 shrink-0">
                <Moon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-white truncate">Dark Mode</div>
                <div className="text-[10.5px] text-slate-500 dark:text-slate-400 truncate">Deep Obsidian Night</div>
              </div>
            </button>
          </div>

          {/* 3 Clean Surface Tones */}
          <div className="pt-1 space-y-2">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300 block">
              Surface Tones (سطحی شیڈز)
            </span>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(WHITE_TONES) as WhiteTone[]).map((tKey) => {
                const tone = WHITE_TONES[tKey];
                const shortLabel =
                  tKey === 'pearl'
                    ? 'Cream Pearl'
                    : tKey === 'soft-alabaster'
                    ? 'Warm Alabaster'
                    : 'Dove Mist';
                const isSelected = themeConfig.whiteTone === tKey;
                return (
                  <button
                    key={tKey}
                    type="button"
                    onClick={() => handleSelectWhiteTone(tKey)}
                    className={`p-2.5 !rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1 ${
                      isSelected
                        ? 'border-amber-500/60 bg-amber-500/12 dark:bg-amber-500/[0.14] ring-1 ring-amber-500/40'
                        : 'border-slate-200/80 dark:border-white/[0.10] bg-white/60 dark:bg-white/[0.035] hover:bg-white/90 dark:hover:bg-white/[0.06]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 w-full">
                      <span className="ulm-kpi-label text-[11px] font-bold text-slate-900 dark:text-white whitespace-nowrap">{shortLabel}</span>
                      <div className="w-3 h-3 rounded-full border border-slate-300 shadow-2xs shrink-0" style={{ backgroundColor: tone.primary }} />
                    </div>
                    <span className="ulm-kpi-label text-[10px] text-slate-500 dark:text-slate-400 font-['JetBrains_Mono']">
                      {tone.primary}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Display Scaling Presets */}
        <div className="space-y-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300 block">
              Display Scaling Presets (اسکرین زوم)
            </span>
            <span className="font-['JetBrains_Mono'] ulm-kpi-label text-[11px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/12 text-amber-700 dark:text-amber-300 border border-amber-500/30">
              {Math.round(resolutionConfig.scale * 100)}% ({resolutionConfig.mode === 'auto' ? 'Auto-Fit' : 'Manual'})
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleSelectResolutionPreset('auto')}
              className={`p-2.5 !rounded-xl border text-left transition-all cursor-pointer ${
                resolutionConfig.mode === 'auto'
                  ? 'border-amber-500/60 bg-amber-500/12 dark:bg-amber-500/[0.14] ring-1 ring-amber-500/40'
                  : 'border-slate-200/80 dark:border-white/[0.10] bg-white/60 dark:bg-white/[0.035] hover:bg-white/90 dark:hover:bg-white/[0.06]'
              }`}
            >
              <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Maximize2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-300" />
                <span>Auto-Fit</span>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Auto calculate</div>
            </button>

            <button
              type="button"
              onClick={() => handleManualScaleChange(0.30)}
              className={`p-2.5 !rounded-xl border text-left transition-all cursor-pointer ${
                resolutionConfig.mode === 'manual' && Math.round(resolutionConfig.scale * 100) === 30
                  ? 'border-amber-500/60 bg-amber-500/12 dark:bg-amber-500/[0.14] ring-1 ring-amber-500/40'
                  : 'border-slate-200/80 dark:border-white/[0.10] bg-white/60 dark:bg-white/[0.035] hover:bg-white/90 dark:hover:bg-white/[0.06]'
              }`}
            >
              <div className="text-xs font-bold text-slate-900 dark:text-white">Micro 30%</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Ultra dense</div>
            </button>

            <button
              type="button"
              onClick={() => handleManualScaleChange(0.45)}
              className={`p-2.5 !rounded-xl border text-left transition-all cursor-pointer ${
                resolutionConfig.mode === 'manual' && Math.round(resolutionConfig.scale * 100) === 45
                  ? 'border-amber-500/60 bg-amber-500/12 dark:bg-amber-500/[0.14] ring-1 ring-amber-500/40'
                  : 'border-slate-200/80 dark:border-white/[0.10] bg-white/60 dark:bg-white/[0.035] hover:bg-white/90 dark:hover:bg-white/[0.06]'
              }`}
            >
              <div className="text-xs font-bold text-slate-900 dark:text-white">Compact 45%</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Small screens</div>
            </button>

            <button
              type="button"
              onClick={() => handleManualScaleChange(0.75)}
              className={`p-2.5 !rounded-xl border text-left transition-all cursor-pointer ${
                resolutionConfig.mode === 'manual' && Math.round(resolutionConfig.scale * 100) === 75
                  ? 'border-amber-500/60 bg-amber-500/12 dark:bg-amber-500/[0.14] ring-1 ring-amber-500/40'
                  : 'border-slate-200/80 dark:border-white/[0.10] bg-white/60 dark:bg-white/[0.035] hover:bg-white/90 dark:hover:bg-white/[0.06]'
              }`}
            >
              <div className="text-xs font-bold text-slate-900 dark:text-white">Laptop 75%</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">1366×768</div>
            </button>

            <button
              type="button"
              onClick={() => handleManualScaleChange(1.00)}
              className={`p-2.5 !rounded-xl border text-left transition-all cursor-pointer ${
                resolutionConfig.mode === 'manual' && Math.round(resolutionConfig.scale * 100) === 100
                  ? 'border-amber-500/60 bg-amber-500/12 dark:bg-amber-500/[0.14] ring-1 ring-amber-500/40'
                  : 'border-slate-200/80 dark:border-white/[0.10] bg-white/60 dark:bg-white/[0.035] hover:bg-white/90 dark:hover:bg-white/[0.06]'
              }`}
            >
              <div className="text-xs font-bold text-slate-900 dark:text-white">Standard 100%</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Full HD 1080p</div>
            </button>

            <button
              type="button"
              onClick={() => handleManualScaleChange(1.25)}
              className={`p-2.5 !rounded-xl border text-left transition-all cursor-pointer ${
                resolutionConfig.mode === 'manual' && Math.round(resolutionConfig.scale * 100) === 125
                  ? 'border-amber-500/60 bg-amber-500/12 dark:bg-amber-500/[0.14] ring-1 ring-amber-500/40'
                  : 'border-slate-200/80 dark:border-white/[0.10] bg-white/60 dark:bg-white/[0.035] hover:bg-white/90 dark:hover:bg-white/[0.06]'
              }`}
            >
              <div className="text-xs font-bold text-slate-900 dark:text-white">Large 125%</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">High-DPI / 4K</div>
            </button>
          </div>

          {/* Fine Zoom Slider */}
          <div className="pt-1 space-y-1">
            <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
              <span>Fine Adjustment Slider (30% – 125%):</span>
              <span className="font-['JetBrains_Mono'] font-bold text-slate-900 dark:text-white">
                {Math.round(resolutionConfig.scale * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.30"
              max="1.25"
              step="0.05"
              value={resolutionConfig.scale}
              onChange={(e) => handleManualScaleChange(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 dark:bg-white/[0.12] rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-['JetBrains_Mono']">
              <span>30%</span>
              <span>50%</span>
              <span>75%</span>
              <span>100%</span>
              <span>125%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
