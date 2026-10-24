/**
 * University of Lakki Marwat (ULM) Central Campus Library
 * Display Resolution Manager & Liquid Glass Theme Orchestrator
 *
 * Handles:
 * 1. Dual-Theme Engine: Soft Eye-Comfort White (Default: Muted Pearl) & Dark Obsidian
 * 2. 3-Preset Liquid Glass Physics: Crystal Air (Default), Frosted, Obsidian Deep
 * 3. Auto-Fit Viewport Scaler & Manual Screen Resolution / Zoom Selector
 */

export type ThemeMode = 'light' | 'dark';
export type WhiteTone = 'pearl' | 'soft-alabaster' | 'dove-mist';
export type GlassPreset = 'crystal-air' | 'frosted' | 'obsidian-deep';

export interface UlmThemeConfig {
  themeMode: ThemeMode;
  whiteTone: WhiteTone;
  eyeBrightness: number; // 78 to 100 (default 94)
  glassPreset: GlassPreset;
  customTint?: number; // 20 to 90
  customBlur?: number; // 8 to 40
}

export type ResolutionMode = 'auto' | 'manual';
export type ResolutionPreset = 'auto' | 'native' | 'laptop-1366' | 'desktop-1080' | 'large-4k' | 'custom';

export interface UlmResolutionConfig {
  mode: ResolutionMode;
  preset: ResolutionPreset;
  scale: number; // e.g. 0.85 to 1.35
  viewportWidth?: number;
  viewportHeight?: number;
}

const THEME_CONFIG_KEY = 'ulm_theme_config_v1';
const RESOLUTION_CONFIG_KEY = 'ulm_resolution_config_v1';

// Preset Tone definitions
export const WHITE_TONES: Record<WhiteTone, { name: string; primary: string; secondary: string; description: string }> = {
  'pearl': {
    name: 'Muted Cream Pearl',
    primary: '#F0EDE6',
    secondary: '#E5E1D8',
    description: 'Subtle ivory tone with low glare for comfortable cataloging',
  },
  'soft-alabaster': {
    name: 'Soft Warm Alabaster',
    primary: '#EAE6DF',
    secondary: '#DFDBD2',
    description: 'Warm natural parchment tone with zero blue-light fatigue',
  },
  'dove-mist': {
    name: 'Dove Mist',
    primary: '#E5EAF0',
    secondary: '#DAE1EA',
    description: 'Balanced cool stone-slate white for high-clarity ledgers',
  },
};

// Preset Glass definitions
export const GLASS_PRESETS: Record<GlassPreset, { name: string; tint: number; blur: number; description: string }> = {
  'crystal-air': {
    name: 'Crystal Air',
    tint: 34,
    blur: 28,
    description: 'High refraction translucent glass with 28px blur depth',
  },
  'frosted': {
    name: 'Frosted Glass',
    tint: 64,
    blur: 16,
    description: 'Medium diffusion milky glass for balanced contrast',
  },
  'obsidian-deep': {
    name: 'Obsidian Deep',
    tint: 78,
    blur: 20,
    description: 'Deep high-density obsidian tint for maximum focus',
  },
};

// Default Configurations
export const DEFAULT_THEME_CONFIG: UlmThemeConfig = {
  themeMode: 'light', // User choice: Soft White default
  whiteTone: 'pearl', // User choice: Muted Cream Pearl
  eyeBrightness: 94,
  glassPreset: 'crystal-air', // User choice: Crystal Air
  customTint: 34,
  customBlur: 28,
};

export const DEFAULT_RESOLUTION_CONFIG: UlmResolutionConfig = {
  mode: 'auto',
  preset: 'auto',
  scale: 1.0,
};

// Subscriber listeners
type ThemeListener = (config: UlmThemeConfig) => void;
type ResolutionListener = (config: UlmResolutionConfig) => void;

const themeListeners: ThemeListener[] = [];
const resolutionListeners: ResolutionListener[] = [];

/**
 * Reads stored theme configuration or defaults
 */
export function getStoredThemeConfig(): UlmThemeConfig {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...DEFAULT_THEME_CONFIG };
  }
  try {
    const raw = localStorage.getItem(THEME_CONFIG_KEY);
    if (!raw) return { ...DEFAULT_THEME_CONFIG };
    const parsed = JSON.parse(raw);
    return {
      themeMode: parsed.themeMode === 'dark' ? 'dark' : 'light',
      whiteTone: parsed.whiteTone in WHITE_TONES ? parsed.whiteTone : 'pearl',
      eyeBrightness: typeof parsed.eyeBrightness === 'number' ? Math.min(100, Math.max(78, parsed.eyeBrightness)) : 94,
      glassPreset: parsed.glassPreset in GLASS_PRESETS ? parsed.glassPreset : 'crystal-air',
      customTint: typeof parsed.customTint === 'number' ? parsed.customTint : 34,
      customBlur: typeof parsed.customBlur === 'number' ? parsed.customBlur : 28,
    };
  } catch {
    return { ...DEFAULT_THEME_CONFIG };
  }
}

/**
 * Saves and applies theme configuration
 */
export function saveThemeConfig(config: UlmThemeConfig): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(THEME_CONFIG_KEY, JSON.stringify(config));
    } catch (_) {}
  }
  applyThemeToDom(config);
  themeListeners.forEach((fn) => {
    try { fn(config); } catch (_) {}
  });
}

/**
 * Applies CSS Variables and root classes for Theme & Liquid Glass
 */
export function applyThemeToDom(config: UlmThemeConfig): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  // 1. Root theme classes
  if (config.themeMode === 'light') {
    root.classList.add('light-theme');
    root.classList.remove('dark');
    root.style.colorScheme = 'light';
  } else {
    root.classList.remove('light-theme');
    root.classList.add('dark');
    root.style.colorScheme = 'dark';
  }

  // 2. White tone variables
  const tone = WHITE_TONES[config.whiteTone] || WHITE_TONES.pearl;
  root.style.setProperty('--ulm-tone-primary', tone.primary);
  root.style.setProperty('--ulm-tone-secondary', tone.secondary);

  // 3. Eye comfort glare veil opacity
  const glareAlpha = Math.max(0, Math.min(0.22, (100 - config.eyeBrightness) / 100));
  root.style.setProperty('--ulm-glare-opacity', String(glareAlpha));
  root.style.setProperty('--ulm-eye-brightness', `${config.eyeBrightness}%`);

  // 4. Liquid Glass Physics variables
  const preset = GLASS_PRESETS[config.glassPreset] || GLASS_PRESETS['crystal-air'];
  const blurPx = config.customBlur || preset.blur;
  const tintPercent = config.customTint || preset.tint;
  const tintDecimal = tintPercent / 100;

  root.style.setProperty('--ulm-blur', `${blurPx}px`);
  root.style.setProperty('--ulm-glass-tint', String(tintDecimal));

  if (config.themeMode === 'light') {
    root.style.setProperty('--ulm-glass-bg', `rgba(240, 237, 230, ${Math.max(0.28, tintDecimal * 0.72)})`);
    root.style.setProperty('--ulm-glass-border', 'rgba(28, 25, 20, 0.08)');
    root.style.setProperty('--ulm-spec-top', 'rgba(255, 255, 255, 0.75)');
    root.style.setProperty('--ulm-spec-side', 'rgba(255, 255, 255, 0.35)');
    root.style.setProperty('--ulm-shadow', '0 8px 32px 0 rgba(28, 25, 20, 0.08), 0 2px 8px 0 rgba(28, 25, 20, 0.04)');
    root.style.setProperty('--ulm-gold-text', '#9A5800'); // Burnished royal gold in light mode
    root.style.setProperty('--ulm-crest-opacity', '0.075');
  } else {
    root.style.setProperty('--ulm-glass-bg', `rgba(11, 18, 32, ${Math.max(0.45, tintDecimal)})`);
    root.style.setProperty('--ulm-glass-border', 'rgba(255, 255, 255, 0.09)');
    root.style.setProperty('--ulm-spec-top', 'rgba(255, 255, 255, 0.22)');
    root.style.setProperty('--ulm-spec-side', 'rgba(255, 255, 255, 0.08)');
    root.style.setProperty('--ulm-shadow', '0 12px 40px 0 rgba(0, 0, 0, 0.55), 0 2px 10px 0 rgba(0, 0, 0, 0.35)');
    root.style.setProperty('--ulm-gold-text', '#FFD147'); // 24K Gold in dark mode
    root.style.setProperty('--ulm-crest-opacity', '0.06');
  }
}

/**
 * Reads stored resolution config or defaults
 */
export function getStoredResolutionConfig(): UlmResolutionConfig {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...DEFAULT_RESOLUTION_CONFIG };
  }
  try {
    const raw = localStorage.getItem(RESOLUTION_CONFIG_KEY);
    if (!raw) return { ...DEFAULT_RESOLUTION_CONFIG };
    const parsed = JSON.parse(raw);
    return {
      mode: parsed.mode === 'manual' ? 'manual' : 'auto',
      preset: parsed.preset || 'auto',
      scale: typeof parsed.scale === 'number' ? Math.min(1.25, Math.max(0.30, parsed.scale)) : 1.0,
    };
  } catch {
    return { ...DEFAULT_RESOLUTION_CONFIG };
  }
}

/**
 * Calculates optimal scale based on current viewport
 */
export function calculateAutoFitScale(): number {
  if (typeof window === 'undefined') return 1.0;
  const w = window.innerWidth;
  const h = window.innerHeight;

  // Target standard reference workspace: 1440 x 900
  if (w <= 1280 || h <= 720) {
    return 0.85; // Compact 1366x768 / 720p laptop
  }
  if (w <= 1440 || h <= 800) {
    return 0.92; // 1440x900 / 1600x900
  }
  if (w <= 1920) {
    return 1.0; // Standard 1080p Full HD
  }
  if (w <= 2560) {
    return 1.12; // 2K QHD (1440p)
  }
  return 1.25; // 4K UHD
}

/**
 * Applies Resolution Scale to DOM
 */
export function applyResolutionToDom(config: UlmResolutionConfig): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  let finalScale = config.scale;
  if (config.mode === 'auto') {
    finalScale = calculateAutoFitScale();
  }

  // Bound scale safely between 0.30x and 1.25x
  finalScale = Math.min(1.25, Math.max(0.30, Math.round(finalScale * 100) / 100));

  root.style.setProperty('--ulm-scale', String(finalScale));
  root.style.setProperty('--ulm-zoom-percent', `${Math.round(finalScale * 100)}%`);

  // Target the #root or .ulm-scalable-viewport container
  const appContainer = document.getElementById('root') || document.body;
  if (appContainer) {
    // We adjust font-size baseline or css zoom where appropriate
    root.style.fontSize = `${Math.round(14 * finalScale)}px`;
  }
}

/**
 * Saves and applies resolution configuration
 */
export function saveResolutionConfig(config: UlmResolutionConfig): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(RESOLUTION_CONFIG_KEY, JSON.stringify(config));
    } catch (_) {}
  }
  applyResolutionToDom(config);
  resolutionListeners.forEach((fn) => {
    try { fn(config); } catch (_) {}
  });
}

/**
 * Subscribes to Theme updates
 */
export function subscribeThemeConfig(listener: ThemeListener): () => void {
  themeListeners.push(listener);
  return () => {
    const idx = themeListeners.indexOf(listener);
    if (idx !== -1) themeListeners.splice(idx, 1);
  };
}

/**
 * Subscribes to Resolution updates
 */
export function subscribeResolutionConfig(listener: ResolutionListener): () => void {
  resolutionListeners.push(listener);
  return () => {
    const idx = resolutionListeners.indexOf(listener);
    if (idx !== -1) resolutionListeners.splice(idx, 1);
  };
}

/**
 * Initializes the Display & Theme subsystem on startup
 */
export function initDisplayAndThemeSystem(): void {
  if (typeof window === 'undefined') return;

  // Apply Theme
  const theme = getStoredThemeConfig();
  applyThemeToDom(theme);

  // Apply Resolution
  const resolution = getStoredResolutionConfig();
  applyResolutionToDom(resolution);

  // Live resize listener for Auto-fit
  let resizeTimer: ReturnType<typeof setTimeout> | null = null;
  window.addEventListener('resize', () => {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const cur = getStoredResolutionConfig();
      if (cur.mode === 'auto') {
        applyResolutionToDom(cur);
      }
    }, 150);
  });
}
