import React, { useRef, useState } from 'react';
import { CampaignPreset, OcrToken } from '../utils/rulesEngine.js';
import {
  PixelImage,
  VisualCheckResult,
  runVisualChecks
} from '../utils/visualChecks.js';

interface VisualChecksCardProps {
  campaign: CampaignPreset;
  ocrWords?: OcrToken[];
  ocrConfidence: number;
  results: VisualCheckResult[] | null;
  onResults: (results: VisualCheckResult[] | null) => void;
}

const MAX_ANALYSIS_EDGE = 1024;

async function loadPixelImage(src: string): Promise<PixelImage> {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.src = src;
  await image.decode();
  const scale = Math.min(1, MAX_ANALYSIS_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D is unavailable in this browser.');
  ctx.drawImage(image, 0, 0, width, height);
  const data = ctx.getImageData(0, 0, width, height);
  return { width, height, data: data.data };
}

async function fileToPixelImage(file: File): Promise<PixelImage> {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Canvas 2D is unavailable in this browser.');
    ctx.drawImage(bitmap, 0, 0);
    const data = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    return { width: bitmap.width, height: bitmap.height, data: data.data };
  } finally {
    bitmap.close();
  }
}

export function VerdictChip({ result, compact = false }: { result: VisualCheckResult; compact?: boolean }) {
  const styles =
    result.verdict === 'pass'
      ? 'bg-secondary-container text-on-secondary-container border-secondary-fixed-dim/60'
      : result.verdict === 'fail'
        ? 'bg-error-container text-on-error-container border-error/40'
        : 'bg-amber-100 text-amber-900 border-amber-300';
  const label =
    result.verdict === 'pass' ? 'PASS' : result.verdict === 'fail' ? 'FAIL' : 'HUMAN REVIEW';
  return (
    <span
      title={result.detail}
      className={`inline-flex items-center gap-1 rounded-full border font-mono font-bold ${
        compact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]'
      } ${styles}`}
    >
      <span className="material-symbols-outlined text-[12px]">
        {result.verdict === 'pass' ? 'check_circle' : result.verdict === 'fail' ? 'cancel' : 'rate_review'}
      </span>
      <span>
        {result.label} {result.headline} · {label}
      </span>
    </span>
  );
}

/**
 * Visual Checks card: contrast (WCAG), reference-logo presence, clear space,
 * and text visibility from real canvas pixels. Uncertain outcomes are routed
 * to human review rather than auto-passed.
 */
export const VisualChecksCard: React.FC<VisualChecksCardProps> = ({
  campaign,
  ocrWords,
  ocrConfidence,
  results,
  onResults
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const logoPixelsRef = useRef<PixelImage | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  const handleLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      logoPixelsRef.current = await fileToPixelImage(file);
      setLogoPreview(URL.createObjectURL(file));
      onResults(null);
      setError(null);
    } catch {
      setError('Could not read the reference logo file. Use a PNG or JPEG image.');
    }
  };

  const handleRun = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setError(null);
    try {
      const pixels = await loadPixelImage(campaign.imageUrl);
      const textBoxes = (ocrWords || [])
        .filter((w) => w.bbox)
        .map((w) => w.bbox!) as { top: number; left: number; width: number; height: number }[];
      const next = runVisualChecks(pixels, {
        textBoxes,
        ocrConfidence,
        referenceLogo: logoPixelsRef.current
      });
      onResults(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Visual analysis failed.');
      onResults(null);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="bg-surface-container-lowest rounded-2xl border border-surface-container-high shadow-md overflow-hidden">
      <div className="px-4 py-3 bg-surface-container-low border-b border-surface-container-high flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <span className="material-symbols-outlined text-secondary text-[20px]">visibility</span>
          <span className="text-xs font-bold text-on-surface uppercase tracking-wide">Visual Checks</span>
          <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] font-semibold text-on-surface-variant">
            Canvas pixel analysis
          </span>
        </div>
        <button
          type="button"
          onClick={handleRun}
          disabled={isRunning}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-on-primary hover:bg-primary-container text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
        >
          <span className={`material-symbols-outlined text-[15px] ${isRunning ? 'animate-spin' : ''}`}>
            {isRunning ? 'sync' : 'play_arrow'}
          </span>
          {isRunning ? 'Analyzing…' : results ? 'Re-run Checks' : 'Run Visual Checks'}
        </button>
      </div>

      <div className="p-4 space-y-3">
        {/* Reference logo uploader */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            {logoPreview ? (
              <img
                src={logoPreview}
                alt="Reference logo"
                className="w-8 h-8 rounded border border-surface-container-high object-contain bg-white"
              />
            ) : (
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant">image</span>
            )}
            <span className="text-[11px] text-on-surface-variant">
              {logoPreview
                ? 'Reference logo loaded — used for presence & clear-space checks.'
                : 'Upload the approved reference logo to enable presence & clear-space checks.'}
            </span>
          </div>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleLogoFile}
          />
          <button
            type="button"
            onClick={() => logoInputRef.current?.click()}
            className="px-2.5 py-1 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface text-[11px] font-semibold border border-surface-container-high transition-colors"
          >
            {logoPreview ? 'Replace Logo' : 'Upload Reference Logo'}
          </button>
        </div>

        {error && (
          <div className="p-2.5 rounded-lg bg-error-container text-on-error-container text-[11px] flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[15px]">error</span>
            <span>{error}</span>
          </div>
        )}

        {results ? (
          <div className="space-y-1.5">
            {results.map((result) => (
              <div
                key={result.id}
                className="flex items-center justify-between gap-2 p-2 rounded-lg bg-surface-container-low border border-surface-container-high"
                title={result.detail}
              >
                <div className="min-w-0">
                  <span className="block text-[11px] font-semibold text-on-surface">{result.label}</span>
                  <span className="block font-mono text-[10px] text-on-surface-variant truncate">
                    {result.headline}
                  </span>
                </div>
                <VerdictChip result={result} />
              </div>
            ))}
            <p className="text-[10px] text-on-surface-variant/80 italic leading-tight pt-0.5">
              Measured from artwork pixels with documented thresholds (WCAG contrast, template correlation).
              Low-confidence outcomes always route to a human reviewer — nothing here is an automated certification.
            </p>
          </div>
        ) : (
          !error && (
            <p className="text-[11px] text-on-surface-variant leading-relaxed">
              Runs contrast, logo, clear-space, and text-visibility checks on the artwork pixels in this
              browser. Results appear here and as chips on the poster viewport.
            </p>
          )
        )}
      </div>
    </div>
  );
};
