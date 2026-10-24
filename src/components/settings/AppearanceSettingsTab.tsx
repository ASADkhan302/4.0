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

  const handleToggleTheme = (mode: 'light' | 'dark') => {
    const updated: UlmThemeConfig = { ...themeConfig, themeMode: mode };
    setThemeConfig(updated);
    saveThemeConfig(updated);
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
    <div className="bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-white/10 rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[10px] bg-[#BC881B]/15 border border-[#BC881B]/30 flex items-center justify-center text-[#BC881B] shrink-0 shadow-2xs">
            <Palette className="w-5 h-5 stroke-[2]" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-tight tracking-tight">
              Card 1 — Appearance &amp; Display Scaling
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Workstation visual style, low-glare surface tone, and fluid resolution scaling.
            </p>
          </div>
        </div>

        <span className="px-3 py-1 rounded-[8px] text-[11px] font-mono font-semibold uppercase tracking-wider bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10">
          Dual-Theme Engine
        </span>
      </div>

      {/* 2-Column Consolidated Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left Column: Theme Mode & Surface Tones */}
        <div className="space-y-4">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
            Color Theme (روشن یا تاریک موڈ)
          </span>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleToggleTheme('light')}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                themeConfig.themeMode === 'light'
                  ? 'border-[#BC881B] bg-amber-50/70 dark:bg-[#BC881B]/15 shadow-sm ring-1 ring-[#BC881B]'
                  : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0B1220] hover:border-slate-300'
              }`}
            >
              <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center text-amber-600 shrink-0">
                <Sun className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-white">☀️ White Mode</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Eye-Comfort Alabaster</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleToggleTheme('dark')}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                themeConfig.themeMode === 'dark'
                  ? 'border-[#BC881B] bg-slate-900 text-white shadow-sm ring-1 ring-[#BC881B]'
                  : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0B1220] hover:border-slate-300'
              }`}
            >
              <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center text-blue-400 shrink-0">
                <Moon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-white">🌙 Dark Mode</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Deep Obsidian Night</div>
              </div>
            </button>
          </div>

          {/* 3 Clean Surface Tones */}
          <div className="pt-2 space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
              Surface Tones (سطحی شیڈز)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {(Object.keys(WHITE_TONES) as WhiteTone[]).map((tKey) => {
                const tone = WHITE_TONES[tKey];
                const isSelected = themeConfig.whiteTone === tKey;
                return (
                  <button
                    key={tKey}
                    type="button"
                    onClick={() => handleSelectWhiteTone(tKey)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                      isSelected
                        ? 'border-[#BC881B] bg-amber-50/60 dark:bg-[#BC881B]/15 ring-1 ring-[#BC881B]'
                        : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0B1220] hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">{tone.name}</span>
                      <div className="w-3.5 h-3.5 rounded-full border border-slate-300 shadow-2xs" style={{ backgroundColor: tone.primary }} />
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                      {tone.primary}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Display Scaling Presets */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
              Display Scaling Presets (اسکرین زوم اور ریزولوشن)
            </span>
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#BC881B]/15 text-[#BC881B] border border-[#BC881B]/30">
              {Math.round(resolutionConfig.scale * 100)}% ({resolutionConfig.mode === 'auto' ? 'Auto-Fit' : 'Manual'})
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleSelectResolutionPreset('auto')}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                resolutionConfig.mode === 'auto'
                  ? 'border-[#BC881B] bg-amber-50/60 dark:bg-[#BC881B]/15 ring-1 ring-[#BC881B]'
                  : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0B1220] hover:border-slate-300'
              }`}
            >
              <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Maximize2 className="w-3.5 h-3.5 text-[#BC881B]" />
                <span>Auto-Fit</span>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Auto calculate</div>
            </button>

            <button
              type="button"
              onClick={() => handleManualScaleChange(0.30)}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                resolutionConfig.mode === 'manual' && Math.round(resolutionConfig.scale * 100) === 30
                  ? 'border-[#BC881B] bg-amber-50/60 dark:bg-[#BC881B]/15 ring-1 ring-[#BC881B]'
                  : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0B1220] hover:border-slate-300'
              }`}
            >
              <div className="text-xs font-bold text-slate-900 dark:text-white">Micro 30%</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Ultra dense</div>
            </button>

            <button
              type="button"
              onClick={() => handleManualScaleChange(0.45)}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                resolutionConfig.mode === 'manual' && Math.round(resolutionConfig.scale * 100) === 45
                  ? 'border-[#BC881B] bg-amber-50/60 dark:bg-[#BC881B]/15 ring-1 ring-[#BC881B]'
                  : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0B1220] hover:border-slate-300'
              }`}
            >
              <div className="text-xs font-bold text-slate-900 dark:text-white">Compact 45%</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Small screens</div>
            </button>

            <button
              type="button"
              onClick={() => handleManualScaleChange(0.75)}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                resolutionConfig.mode === 'manual' && Math.round(resolutionConfig.scale * 100) === 75
                  ? 'border-[#BC881B] bg-amber-50/60 dark:bg-[#BC881B]/15 ring-1 ring-[#BC881B]'
                  : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0B1220] hover:border-slate-300'
              }`}
            >
              <div className="text-xs font-bold text-slate-900 dark:text-white">Laptop 75%</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">1366×768</div>
            </button>

            <button
              type="button"
              onClick={() => handleManualScaleChange(1.00)}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                resolutionConfig.mode === 'manual' && Math.round(resolutionConfig.scale * 100) === 100
                  ? 'border-[#BC881B] bg-amber-50/60 dark:bg-[#BC881B]/15 ring-1 ring-[#BC881B]'
                  : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0B1220] hover:border-slate-300'
              }`}
            >
              <div className="text-xs font-bold text-slate-900 dark:text-white">Standard 100%</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Full HD 1080p</div>
            </button>

            <button
              type="button"
              onClick={() => handleManualScaleChange(1.25)}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                resolutionConfig.mode === 'manual' && Math.round(resolutionConfig.scale * 100) === 125
                  ? 'border-[#BC881B] bg-amber-50/60 dark:bg-[#BC881B]/15 ring-1 ring-[#BC881B]'
                  : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0B1220] hover:border-slate-300'
              }`}
            >
              <div className="text-xs font-bold text-slate-900 dark:text-white">Large 125%</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">High-DPI / 4K</div>
            </button>
          </div>

          {/* Fine Zoom Slider */}
          <div className="pt-1 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
              <span>Fine Adjustment Slider (30% – 125%):</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
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
              className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#BC881B]"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
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
