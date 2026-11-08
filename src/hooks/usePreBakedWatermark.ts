import { useState, useEffect } from 'react';
import { ULM_OFFICIAL_CREST_SRC } from '../constants/ulmOfficialAssets';

/**
 * Offscreen HTML5 Canvas Watermark Pre-Baker
 * Fixes the Chromium/Electron print bug where CSS opacity: 0.065 on PNGs is ignored
 * and blown up to 100% opacity by printer spoolers, obscuring degree, session, and barcode text.
 * Renders the authentic ULM 2017 Crest into an offscreen 320x320 <canvas> with globalAlpha = 0.065
 * (configurable 2% - 20%) and outputs a transparent PNG Data URL.
 */
export function usePreBakedWatermark(
  crestSrc: string = ULM_OFFICIAL_CREST_SRC,
  alphaPercent: number = 6.5
): string {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    const srcToLoad = crestSrc || ULM_OFFICIAL_CREST_SRC;
    if (!srcToLoad) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const size = 320;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, size, size);
        ctx.globalAlpha = Math.max(0.02, Math.min(0.20, alphaPercent / 100));
        ctx.drawImage(img, 0, 0, size, size);
        setDataUrl(canvas.toDataURL('image/png'));
      } catch {
        setDataUrl(srcToLoad);
      }
    };
    img.onerror = () => {
      setDataUrl(srcToLoad);
    };
    img.src = srcToLoad;
  }, [crestSrc, alphaPercent]);

  return dataUrl;
}

export default usePreBakedWatermark;
