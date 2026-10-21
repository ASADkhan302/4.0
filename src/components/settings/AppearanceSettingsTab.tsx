import React, { useState, useEffect } from 'react';
import { 
  Sun, 
  Moon, 
  Monitor, 
  Sparkles, 
  Eye, 
  Sliders, 
  RotateCcw, 
  Maximize2, 
  Check, 
  ShieldCheck, 
  Barcode as BarcodeIcon,
  Palette
} from 'lucide-react';
import { 
  getStoredThemeConfig, 
  saveThemeConfig, 
  UlmThemeConfig, 
  WHITE_TONES, 
  GLASS_PRESETS, 
  WhiteTone, 
  GlassPreset,
  getStoredResolutionConfig,
  saveResolutionConfig,
  UlmResolutionConfig,
  ResolutionPreset,
  subscribeThemeConfig,
  subscribeResolutionConfig,
  calculateAutoFitScale
} from '../../services/displayResolutionManager';
import { ULM_CREST_LOGO } from '../../constants/branding';

export const AppearanceSettingsTab: React.FC = () => {
  const [themeConfig, setThemeConfig] = useState<UlmThemeConfig>(getStoredThemeConfig);
  const [resolutionConfig, setResolutionConfig] = useState<UlmResolutionConfig>(getStoredResolutionConfig);
  const [windowDimensions, setWindowDimensions] = useState<{ width: number; height: number }>({
    width: typeof window !== 'undefined' ? window.innerWidth : 1920,
    height: typeof window !== 'undefined' ? window.innerHeight : 1080,
  });

  useEffect(() => {
    const unsubTheme = subscribeThemeConfig(setThemeConfig);
    const unsubRes = subscribeResolutionConfig(setResolutionConfig);

    const handleResize = () => {
      setWindowDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);

    return () => {
      unsubTheme();
      unsubRes();
      window.removeEventListener('resize', handleResize);
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

  const handleEyeBrightnessChange = (val: number) => {
    const updated: UlmThemeConfig = { ...themeConfig, eyeBrightness: val };
    setThemeConfig(updated);
    saveThemeConfig(updated);
  };

  const handleSelectGlassPreset = (preset: GlassPreset) => {
    const p = GLASS_PRESETS[preset];
    const updated: UlmThemeConfig = {
      ...themeConfig,
      glassPreset: preset,
      customTint: p.tint,
      customBlur: p.blur,
    };
    setThemeConfig(updated);
    saveThemeConfig(updated);
  };

  const handleCustomTintChange = (tint: number) => {
    const updated: UlmThemeConfig = { ...themeConfig, customTint: tint };
    setThemeConfig(updated);
    saveThemeConfig(updated);
  };

  const handleCustomBlurChange = (blur: number) => {
    const updated: UlmThemeConfig = { ...themeConfig, customBlur: blur };
    setThemeConfig(updated);
    saveThemeConfig(updated);
  };

  const handleResetGlass = () => {
    const p = GLASS_PRESETS['crystal-air'];
    const updated: UlmThemeConfig = {
      ...themeConfig,
      glassPreset: 'crystal-air',
      customTint: p.tint,
      customBlur: p.blur,
    };
    setThemeConfig(updated);
    saveThemeConfig(updated);
  };

  const handleResolutionPreset = (preset: ResolutionPreset) => {
    let scale = 1.0;
    let mode: 'auto' | 'manual' = 'manual';

    if (preset === 'auto') {
      mode = 'auto';
      scale = calculateAutoFitScale();
    } else if (preset === 'native') {
      scale = 1.0;
    } else if (preset === 'laptop-1366') {
      scale = 0.88;
    } else if (preset === 'desktop-1080') {
      scale = 1.0;
    } else if (preset === 'large-4k') {
      scale = 1.18;
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
      preset: 'custom',
      scale,
    };
    setResolutionConfig(updated);
    saveResolutionConfig(updated);
  };

  const handleResetResolution = () => {
    const updated: UlmResolutionConfig = {
      mode: 'auto',
      preset: 'auto',
      scale: calculateAutoFitScale(),
    };
    setResolutionConfig(updated);
    saveResolutionConfig(updated);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* 1. DUAL-THEME ENGINE */}
      <div className="p-6 rounded-2xl ulm-liquid-glass space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
          <div>
            <h3 className="text-base font-bold font-cinzel text-white flex items-center gap-2">
              <Palette className="w-5 h-5 text-[#BC881B]" />
              <span>Dual-Theme Engine: Soft Eye-Comfort White & Dark Obsidian</span>
            </h3>
            <p className="text-xs text-slate-300 mt-1">
              Engineered for fatigue-free long cataloging shifts. Low-glare alabaster white default with instant dark obsidian toggle.
            </p>
          </div>

          {/* Quick 1-Click Toggle */}
          <div className="flex items-center gap-2 bg-[#131B2E] p-1.5 rounded-xl border border-white/10 shrink-0">
            <button
              type="button"
              onClick={() => handleToggleTheme('light')}
              className={`px-4 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-2 transition-all cursor-pointer ${
                themeConfig.themeMode === 'light'
                  ? 'bg-[#BC881B] text-slate-950 shadow-md scale-105'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Sun className="w-4 h-4 text-amber-900" />
              <span>☀️ Soft White Glass</span>
            </button>
            <button
              type="button"
              onClick={() => handleToggleTheme('dark')}
              className={`px-4 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-2 transition-all cursor-pointer ${
                themeConfig.themeMode === 'dark'
                  ? 'bg-[#1E293B] text-white border border-white/20 shadow-md scale-105'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Moon className="w-4 h-4 text-blue-400" />
              <span>🌙 Dark Obsidian</span>
            </button>
          </div>
        </div>

        {/* Soft White Tone Selection */}
        <div className="space-y-3">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <span>Soft White Tone Selection (Eye-Comfort Parchments)</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(Object.keys(WHITE_TONES) as WhiteTone[]).map((tKey) => {
              const tone = WHITE_TONES[tKey];
              const isSelected = themeConfig.whiteTone === tKey;
              return (
                <button
                  key={tKey}
                  type="button"
                  onClick={() => handleSelectWhiteTone(tKey)}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                    isSelected
                      ? 'border-[#BC881B] bg-[#BC881B]/10 shadow-md ring-1 ring-[#BC881B]'
                      : 'border-white/10 bg-[#131B2E]/60 hover:border-white/25'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{tone.name}</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded-full border border-black/20" style={{ backgroundColor: tone.primary }} />
                      <div className="w-4 h-4 rounded-full border border-black/20" style={{ backgroundColor: tone.secondary }} />
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    {tone.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Eye-Comfort Glare Dimmer Slider */}
        <div className="p-4 rounded-xl bg-[#131B2E]/70 border border-white/10 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-200 flex items-center gap-2">
              <Eye className="w-4 h-4 text-[#BC881B]" />
              <span>Eye-Comfort Glare Dimmer (Warm Shield)</span>
            </span>
            <span className="font-mono font-bold text-amber-400">
              {themeConfig.eyeBrightness}% ({Math.round((100 - themeConfig.eyeBrightness))}% Glare Veil)
            </span>
          </div>
          <input
            type="range"
            min="78"
            max="100"
            value={themeConfig.eyeBrightness}
            onChange={(e) => handleEyeBrightnessChange(Number(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#BC881B]"
          />
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>78% (Deepest Warm Night Veil)</span>
            <span>94% (Recommended Standard)</span>
            <span>100% (Pure Crisp White)</span>
          </div>
        </div>
      </div>

      {/* 2. LIQUID GLASS PHYSICS & REFRACTION */}
      <div className="p-6 rounded-2xl ulm-liquid-glass space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
          <div>
            <h3 className="text-base font-bold font-cinzel text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#BC881B]" />
              <span>Refractive Liquid Glass Physics & Refraction</span>
            </h3>
            <p className="text-xs text-slate-300 mt-1">
              Translucent refractive surfaces with specular top bevels and 3 ambient background color orbs.
            </p>
          </div>
          <button
            type="button"
            onClick={handleResetGlass}
            className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium inline-flex items-center gap-1.5 border border-white/10 cursor-pointer self-start sm:self-auto"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            <span>Reset to Crystal Air</span>
          </button>
        </div>

        {/* 3 Built-in Presets */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(Object.keys(GLASS_PRESETS) as GlassPreset[]).map((pKey) => {
            const preset = GLASS_PRESETS[pKey];
            const isSelected = themeConfig.glassPreset === pKey;
            return (
              <button
                key={pKey}
                type="button"
                onClick={() => handleSelectGlassPreset(pKey)}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                  isSelected
                    ? 'border-[#BC881B] bg-[#BC881B]/10 shadow-md ring-1 ring-[#BC881B]'
                    : 'border-white/10 bg-[#131B2E]/60 hover:border-white/25'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">{preset.name}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-amber-300">
                    {preset.tint}% · {preset.blur}px
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-tight">
                  {preset.description}
                </p>
              </button>
            );
          })}
        </div>

        {/* Fine Sliders: Tint & Blur */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div className="p-4 rounded-xl bg-[#131B2E]/70 border border-white/10 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200">Glass Surface Tint</span>
              <span className="font-mono font-bold text-amber-400">{themeConfig.customTint || 34}%</span>
            </div>
            <input
              type="range"
              min="20"
              max="90"
              value={themeConfig.customTint || 34}
              onChange={(e) => handleCustomTintChange(Number(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#BC881B]"
            />
          </div>

          <div className="p-4 rounded-xl bg-[#131B2E]/70 border border-white/10 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200">Refractive Blur Depth</span>
              <span className="font-mono font-bold text-amber-400">{themeConfig.customBlur || 28}px</span>
            </div>
            <input
              type="range"
              min="8"
              max="40"
              value={themeConfig.customBlur || 28}
              onChange={(e) => handleCustomBlurChange(Number(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#BC881B]"
            />
          </div>
        </div>
      </div>

      {/* 3. SCREEN RESOLUTION & AUTO-FIT ENGINE */}
      <div className="p-6 rounded-2xl ulm-liquid-glass space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
          <div>
            <h3 className="text-base font-bold font-cinzel text-white flex items-center gap-2">
              <Monitor className="w-5 h-5 text-[#BC881B]" />
              <span>Screen Resolution & Auto-Fit Engine</span>
            </h3>
            <p className="text-xs text-slate-300 mt-1">
              Active Viewport: <span className="font-mono font-bold text-amber-300">{windowDimensions.width} × {windowDimensions.height}</span>. Auto-adjusts proportions for 1366×768 laptops up to 4K desktop screens without clipping.
            </p>
          </div>
          <button
            type="button"
            onClick={handleResetResolution}
            className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium inline-flex items-center gap-1.5 border border-white/10 cursor-pointer self-start sm:self-auto"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            <span>Auto-Fit Viewport</span>
          </button>
        </div>

        {/* Resolution Mode Presets */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            type="button"
            onClick={() => handleResolutionPreset('auto')}
            className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
              resolutionConfig.mode === 'auto'
                ? 'border-[#BC881B] bg-[#BC881B]/15 text-white font-bold ring-1 ring-[#BC881B]'
                : 'border-white/10 bg-[#131B2E]/60 text-slate-300 hover:text-white'
            }`}
          >
            <Maximize2 className="w-4 h-4 mx-auto mb-1 text-emerald-400" />
            <p className="text-xs">Live Auto-Fit</p>
            <p className="text-[10px] text-slate-400 font-mono">Dynamic Viewport</p>
          </button>

          <button
            type="button"
            onClick={() => handleResolutionPreset('laptop-1366')}
            className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
              resolutionConfig.preset === 'laptop-1366'
                ? 'border-[#BC881B] bg-[#BC881B]/15 text-white font-bold ring-1 ring-[#BC881B]'
                : 'border-white/10 bg-[#131B2E]/60 text-slate-300 hover:text-white'
            }`}
          >
            <Monitor className="w-4 h-4 mx-auto mb-1 text-amber-400" />
            <p className="text-xs">1366×768 Laptop</p>
            <p className="text-[10px] text-slate-400 font-mono">0.88x Compact</p>
          </button>

          <button
            type="button"
            onClick={() => handleResolutionPreset('desktop-1080')}
            className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
              resolutionConfig.preset === 'desktop-1080'
                ? 'border-[#BC881B] bg-[#BC881B]/15 text-white font-bold ring-1 ring-[#BC881B]'
                : 'border-white/10 bg-[#131B2E]/60 text-slate-300 hover:text-white'
            }`}
          >
            <Monitor className="w-4 h-4 mx-auto mb-1 text-blue-400" />
            <p className="text-xs">1920×1080 Full HD</p>
            <p className="text-[10px] text-slate-400 font-mono">1.00x Balanced</p>
          </button>

          <button
            type="button"
            onClick={() => handleResolutionPreset('large-4k')}
            className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
              resolutionConfig.preset === 'large-4k'
                ? 'border-[#BC881B] bg-[#BC881B]/15 text-white font-bold ring-1 ring-[#BC881B]'
                : 'border-white/10 bg-[#131B2E]/60 text-slate-300 hover:text-white'
            }`}
          >
            <Monitor className="w-4 h-4 mx-auto mb-1 text-purple-400" />
            <p className="text-xs">2K / 4K Ultra HD</p>
            <p className="text-[10px] text-slate-400 font-mono">1.18x Large</p>
          </button>
        </div>

        {/* Custom Zoom Slider */}
        <div className="p-4 rounded-xl bg-[#131B2E]/70 border border-white/10 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-200 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#BC881B]" />
              <span>Manual Workspace Scale Zoom</span>
            </span>
            <span className="font-mono font-bold text-amber-400">
              {Math.round(resolutionConfig.scale * 100)}% ({resolutionConfig.scale.toFixed(2)}x)
            </span>
          </div>
          <input
            type="range"
            min="0.75"
            max="1.40"
            step="0.02"
            value={resolutionConfig.scale}
            onChange={(e) => handleManualScaleChange(Number(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#BC881B]"
          />
          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
            <span>75% (Maximum Data Density)</span>
            <span>100% (Standard 1:1)</span>
            <span>140% (Accessibility Zoom)</span>
          </div>
        </div>
      </div>

      {/* 4. LOCKED BARCODE CONTRAST SAFE-PAD VERIFICATION */}
      <div className="p-6 rounded-2xl ulm-liquid-glass space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold font-cinzel text-white flex items-center gap-2">
              <BarcodeIcon className="w-5 h-5 text-[#BC881B]" />
              <span>Locked Optical Barcode Safe-Pad (Scanner Friendly)</span>
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Strict locked contrast: #FFFFFF card background and crisp black #000000 bars guarantee 100% optical laser/CCD scanner readability in both white and dark modes.
            </p>
          </div>
          <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full inline-flex items-center gap-1.5 text-xs text-emerald-300 shrink-0">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Hardware Compliant</span>
          </div>
        </div>

        {/* Live Barcode Safe-Pad Preview Box */}
        <div className="flex flex-wrap items-center gap-6 p-4 rounded-xl bg-slate-900/60 border border-white/10">
          <div className="ulm-barcode-safepad px-4 py-3 rounded-lg flex flex-col items-center gap-1 shrink-0">
            <div className="font-mono text-[11px] font-bold tracking-widest text-black">
              UNIVERSITY OF LAKKI MARWAT
            </div>
            {/* SVG Sample Code 128 Barcode */}
            <svg className="w-56 h-12" viewBox="0 0 200 40">
              <rect x="0" y="0" width="200" height="40" fill="#FFFFFF" />
              {/* Synthetic Barcode bars */}
              {[4, 10, 14, 18, 26, 32, 38, 42, 50, 56, 60, 68, 74, 80, 88, 96, 102, 110, 118, 126, 134, 142, 150, 158, 164, 172, 180, 188, 194].map((x, i) => (
                <rect key={i} x={x} y={2} width={i % 3 === 0 ? 3 : 2} height={36} fill="#000000" />
              ))}
            </svg>
            <div className="font-mono text-xs font-bold tracking-widest text-black">
              * 0092000100001 *
            </div>
            <div className="text-[10px] font-bold text-black uppercase tracking-wider">
              Acc: 100001 · Central Library
            </div>
          </div>

          <div className="space-y-1 text-xs text-slate-300 max-w-md">
            <p className="font-bold text-white flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Independent of Active Theme Tint & Blur</span>
            </p>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Whenever barcode labels, book circulation stickers, or member cards are rendered on screen or dispatched to thermal/laser printers, they automatically mount within this contrast safe-pad.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
