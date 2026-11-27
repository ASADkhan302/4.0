import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ZoomIn, ZoomOut, Check, RotateCcw, Image as ImageIcon, Maximize2 } from 'lucide-react';

interface PhotoCropModalProps {
  isOpen: boolean;
  imageSrc: string;
  onCropComplete: (croppedDataUrl: string) => void;
  onClose: () => void;
}

const CROP_WIDTH = 240;
const CROP_HEIGHT = 300; // Strict 4:5 portrait ratio
const EXPORT_WIDTH = 300;
const EXPORT_HEIGHT = 375; // 300 x 375 px (300 DPI crisp on CR80 card)

export const PhotoCropModal: React.FC<PhotoCropModalProps> = ({
  isOpen,
  imageSrc,
  onCropComplete,
  onClose,
}) => {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

  const dragOriginRef = useRef({ pointerX: 0, pointerY: 0, startX: 0, startY: 0 });
  const loadedImageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!isOpen || !imageSrc) return;
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setImageSize({ width: 0, height: 0 });

    const img = new Image();
    img.onload = () => {
      loadedImageRef.current = img;
      setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = imageSrc;
  }, [isOpen, imageSrc]);

  // Close ONLY the cropper on Escape without bubbling to Enroll Borrower modal
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [isOpen, onClose]);

  const baseScale =
    imageSize.width > 0 && imageSize.height > 0
      ? Math.max(CROP_WIDTH / imageSize.width, CROP_HEIGHT / imageSize.height)
      : 1;

  const clampOffset = useCallback(
    (nextX: number, nextY: number, nextZoom: number) => {
      if (imageSize.width <= 0 || imageSize.height <= 0) return { x: nextX, y: nextY };
      const scaledW = imageSize.width * baseScale * nextZoom;
      const scaledH = imageSize.height * baseScale * nextZoom;
      const maxPanX = Math.max(0, (scaledW - CROP_WIDTH) / 2);
      const maxPanY = Math.max(0, (scaledH - CROP_HEIGHT) / 2);
      return {
        x: Math.max(-maxPanX, Math.min(maxPanX, nextX)),
        y: Math.max(-maxPanY, Math.min(maxPanY, nextY)),
      };
    },
    [imageSize, baseScale]
  );

  const handleZoomChange = (nextZoomRaw: number) => {
    const nextZoom = Math.min(3, Math.max(1, Number(nextZoomRaw.toFixed(2))));
    setZoom(nextZoom);
    setOffset((prev) => clampOffset(prev.x, prev.y, nextZoom));
  };

  const handleReset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    dragOriginRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      startX: offset.x,
      startY: offset.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    e.preventDefault();
    const dx = e.clientX - dragOriginRef.current.pointerX;
    const dy = e.clientY - dragOriginRef.current.pointerY;
    setOffset(
      clampOffset(dragOriginRef.current.startX + dx, dragOriginRef.current.startY + dy, zoom)
    );
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore release errors
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    handleZoomChange(zoom + delta);
  };

  const renderCroppedDataUrl = useCallback(
    (useZoom: number, useOffset: { x: number; y: number }) => {
      const renderFromImage = (img: HTMLImageElement) => {
        const canvas = document.createElement('canvas');
        canvas.width = EXPORT_WIDTH;
        canvas.height = EXPORT_HEIGHT;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Pure white background fill first (preserves crisp CR80 look for transparent PNGs)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);

        const scaleToExport = EXPORT_WIDTH / CROP_WIDTH;
        const imgBaseScale = Math.max(
          CROP_WIDTH / img.naturalWidth,
          CROP_HEIGHT / img.naturalHeight
        );
        const effectiveScale = imgBaseScale * useZoom * scaleToExport;

        const drawWidth = img.naturalWidth * effectiveScale;
        const drawHeight = img.naturalHeight * effectiveScale;

        const centerX = EXPORT_WIDTH / 2 + useOffset.x * scaleToExport;
        const centerY = EXPORT_HEIGHT / 2 + useOffset.y * scaleToExport;

        ctx.drawImage(
          img,
          centerX - drawWidth / 2,
          centerY - drawHeight / 2,
          drawWidth,
          drawHeight
        );

        const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.90);
        onCropComplete(croppedDataUrl);
        onClose();
      };

      if (loadedImageRef.current && loadedImageRef.current.complete && loadedImageRef.current.naturalWidth > 0) {
        renderFromImage(loadedImageRef.current);
        return;
      }

      const img = new Image();
      img.onload = () => renderFromImage(img);
      img.src = imageSrc;
    },
    [imageSrc, onCropComplete, onClose]
  );

  const handleApplyPhoto = () => {
    renderCroppedDataUrl(zoom, offset);
  };

  const handleUseFullPhoto = () => {
    renderCroppedDataUrl(1, { x: 0, y: 0 });
  };

  if (!isOpen || !imageSrc || typeof document === 'undefined') return null;

  const previewImgWidth = imageSize.width > 0 ? imageSize.width * baseScale * zoom : CROP_WIDTH;
  const previewImgHeight = imageSize.height > 0 ? imageSize.height * baseScale * zoom : CROP_HEIGHT;

  return createPortal(
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="crop-portrait-dialog-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[440px] rounded-[24px] bg-white/95 dark:bg-[#170E2C]/96 backdrop-blur-2xl backdrop-saturate-[190%] border border-white/80 dark:border-amber-400/35 shadow-[0_28px_80px_rgba(15,23,42,0.45)] dark:shadow-[0_28px_80px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col text-slate-900 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 bg-white/75 dark:bg-white/[0.04] border-b border-slate-200/80 dark:border-white/[0.10] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/35 flex items-center justify-center text-amber-700 dark:text-[#FFD147] shrink-0">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h4
                id="crop-portrait-dialog-title"
                className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white font-cinzel truncate"
              >
                Crop Portrait Photo (4:5)
              </h4>
              <p className="text-[10.5px] text-slate-500 dark:text-slate-400 truncate">
                CR80 Smart Card · 300 × 375 px print output
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close portrait cropper"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-white/[0.10] transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Fixed 4:5 Portrait Drag-and-Zoom Viewport */}
        <div className="p-5 flex flex-col items-center justify-center bg-slate-950/[0.06] dark:bg-black/45">
          <div
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{ width: `${CROP_WIDTH}px`, height: `${CROP_HEIGHT}px` }}
            className="relative rounded-2xl overflow-hidden bg-white dark:bg-slate-900 border-2 border-[#C8963E] dark:border-[#FFD147] shadow-[0_14px_36px_rgba(15,23,42,0.28)] cursor-grab active:cursor-grabbing select-none touch-none flex items-center justify-center"
          >
            {imageSize.width > 0 ? (
              <img
                src={imageSrc}
                alt="Portrait crop preview"
                draggable={false}
                style={{
                  width: `${previewImgWidth}px`,
                  height: `${previewImgHeight}px`,
                  maxWidth: 'none',
                  maxHeight: 'none',
                  transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`,
                  pointerEvents: 'none',
                  userSelect: 'none',
                }}
              />
            ) : (
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Loading image...
              </div>
            )}

            {/* Rule-of-thirds & corner alignment guides */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-1.5 left-1.5 w-3.5 h-3.5 border-t-2 border-l-2 border-[#FFD147]/90 rounded-tl-sm" />
              <div className="absolute top-1.5 right-1.5 w-3.5 h-3.5 border-t-2 border-r-2 border-[#FFD147]/90 rounded-tr-sm" />
              <div className="absolute bottom-1.5 left-1.5 w-3.5 h-3.5 border-b-2 border-l-2 border-[#FFD147]/90 rounded-bl-sm" />
              <div className="absolute bottom-1.5 right-1.5 w-3.5 h-3.5 border-b-2 border-r-2 border-[#FFD147]/90 rounded-br-sm" />

              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-25">
                <div className="border-r border-b border-white/80" />
                <div className="border-r border-b border-white/80" />
                <div className="border-b border-white/80" />
                <div className="border-r border-b border-white/80" />
                <div className="border-r border-b border-white/80" />
                <div className="border-b border-white/80" />
                <div className="border-r border-white/80" />
                <div className="border-r border-white/80" />
                <div />
              </div>
            </div>
          </div>

          <p className="mt-2.5 text-[11px] text-slate-600 dark:text-slate-400 text-center">
            Drag photo to position · Scroll or slide to zoom (1.0× – 3.0×)
          </p>
        </div>

        {/* Zoom Controls & Footer Actions */}
        <div className="px-5 py-4 bg-white/80 dark:bg-white/[0.03] border-t border-slate-200/80 dark:border-white/[0.10] space-y-3.5">
          {/* Zoom Slider + Reset */}
          <div className="flex items-center gap-2.5">
            <ZoomOut className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
            <input
              type="range"
              min="1"
              max="3"
              step="0.02"
              value={zoom}
              onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
              aria-label="Zoom portrait photo"
              className="flex-1 accent-[#C8963E] dark:accent-[#FFD147] cursor-pointer"
            />
            <ZoomIn className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
            <span className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-200 w-10 text-right tabular-nums">
              {zoom.toFixed(1)}×
            </span>
            <button
              type="button"
              onClick={handleReset}
              className="h-7 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.07] dark:hover:bg-white/[0.13] border border-slate-300/80 dark:border-white/[0.14] text-slate-700 dark:text-slate-200 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors shrink-0"
              title="Reset zoom and position"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={handleUseFullPhoto}
              className="h-9 px-3 rounded-xl bg-slate-100 hover:bg-slate-200/90 dark:bg-white/[0.07] dark:hover:bg-white/[0.14] border border-slate-300/80 dark:border-white/[0.14] text-slate-700 dark:text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
              title="Auto center-crop full photo to 4:5 immediately"
            >
              <Maximize2 className="w-3.5 h-3.5 text-amber-600 dark:text-[#FFD147]" />
              <span>Use Full Photo</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="h-9 px-3.5 rounded-xl bg-slate-200/80 hover:bg-slate-300/80 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] border border-slate-300/80 dark:border-white/[0.12] text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyPhoto}
                className="h-9 px-4 rounded-xl bg-gradient-to-r from-[#BC881B] to-[#D4A02A] hover:brightness-110 active:scale-[0.98] text-[#1A1A1A] text-xs font-bold inline-flex items-center gap-1.5 shadow-md border border-[#FFD147]/60 cursor-pointer transition-all whitespace-nowrap"
              >
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Apply Photo</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PhotoCropModal;
