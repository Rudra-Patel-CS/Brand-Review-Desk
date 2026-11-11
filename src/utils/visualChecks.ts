// Visual Checks: client-side artwork analysis with honest, measurable methods.
// - WCAG contrast ratios on OCR text regions (relative luminance, no AI claims)
// - Reference-logo presence via normalized cross-correlation template matching
// - Logo clear-space measurement against detected text boxes and image edges
// - Text-visibility rollup routed to human review when confidence is low
//
// The core operates on plain RGBA pixel buffers so it is fully testable in Node
// with labelled synthetic fixtures. Browser code (canvas) lives in the component.

export interface PixelImage {
  width: number;
  height: number;
  /** RGBA bytes, length = width * height * 4 */
  data: Uint8ClampedArray | number[];
}

export interface PixelBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PercentBox {
  top: number;
  left: number;
  width: number;
  height: number;
}

export type VisualVerdict = 'pass' | 'fail' | 'human_review';

export interface VisualCheckResult {
  id: 'contrast' | 'logo' | 'clear_space' | 'text_visibility';
  label: string;
  verdict: VisualVerdict;
  headline: string;
  detail: string;
  /** 0..1 where meaningful (e.g. template-match confidence), else null */
  confidence: number | null;
}

// ── WCAG luminance & contrast ────────────────────────────────────────────────

function channelToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** WCAG 2.x relative luminance of an sRGB color (0..1). */
export function relativeLuminance(r: number, g: number, b: number): number {
  return (
    0.2126 * channelToLinear(r) +
    0.7152 * channelToLinear(g) +
    0.0722 * channelToLinear(b)
  );
}

/** WCAG contrast ratio between two relative luminances (1..21). */
export function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function pixelLuminance(img: PixelImage, x: number, y: number): number {
  const xi = Math.max(0, Math.min(img.width - 1, Math.round(x)));
  const yi = Math.max(0, Math.min(img.height - 1, Math.round(y)));
  const idx = (yi * img.width + xi) * 4;
  return relativeLuminance(img.data[idx], img.data[idx + 1], img.data[idx + 2]);
}

export function percentBoxToPixels(box: PercentBox, width: number, height: number): PixelBox {
  const x = Math.max(0, Math.round((box.left / 100) * width));
  const y = Math.max(0, Math.round((box.top / 100) * height));
  return {
    x,
    y,
    width: Math.max(1, Math.min(width - x, Math.round((box.width / 100) * width))),
    height: Math.max(1, Math.min(height - y, Math.round((box.height / 100) * height)))
  };
}

// ── Contrast analysis over text regions ──────────────────────────────────────

export interface RegionContrast {
  box: PixelBox;
  ratio: number;
  measurable: boolean;
}

/**
 * Estimate the text-vs-background contrast inside one region by comparing the
 * darkest and lightest luminance quartiles. Regions that are nearly uniform
 * (no two-tone structure) are reported as not measurable instead of guessing.
 */
export function analyzeRegionContrast(img: PixelImage, box: PixelBox): RegionContrast {
  const lums: number[] = [];
  const x0 = Math.max(0, Math.floor(box.x));
  const y0 = Math.max(0, Math.floor(box.y));
  const x1 = Math.min(img.width, Math.ceil(box.x + box.width));
  const y1 = Math.min(img.height, Math.ceil(box.y + box.height));
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      lums.push(pixelLuminance(img, x, y));
    }
  }
  if (lums.length < 8) {
    return { box, ratio: 1, measurable: false };
  }
  lums.sort((a, b) => a - b);
  const q = Math.max(1, Math.floor(lums.length / 4));
  let darkSum = 0;
  let lightSum = 0;
  for (let i = 0; i < q; i++) darkSum += lums[i];
  for (let i = lums.length - q; i < lums.length; i++) lightSum += lums[i];
  const dark = darkSum / q;
  const light = lightSum / q;
  // Nearly uniform region: no text/background structure to measure.
  if (light - dark < 0.02) {
    return { box, ratio: 1, measurable: false };
  }
  return { box, ratio: contrastRatio(light, dark), measurable: true };
}

export interface ContrastAnalysis {
  regions: RegionContrast[];
  measurableCount: number;
  minRatio: number;
  medianRatio: number;
  result: VisualCheckResult;
}

export function analyzeContrast(
  img: PixelImage,
  textBoxes: PixelBox[],
  passRatio: number = 4.5,
  largeTextRatio: number = 3.0
): ContrastAnalysis {
  const regions = textBoxes.map((box) => analyzeRegionContrast(img, box));
  const measurable = regions.filter((r) => r.measurable);
  const ratios = measurable.map((r) => r.ratio).sort((a, b) => a - b);
  const minRatio = ratios.length ? ratios[0] : 0;
  const medianRatio = ratios.length ? ratios[Math.floor(ratios.length / 2)] : 0;

  let verdict: VisualVerdict;
  let headline: string;
  let detail: string;

  if (measurable.length === 0) {
    verdict = 'human_review';
    headline = 'Not measurable';
    detail =
      'No two-tone text regions could be measured (empty artwork or no OCR boxes). A reviewer must check contrast manually.';
  } else if (minRatio >= passRatio) {
    verdict = 'pass';
    headline = `${minRatio.toFixed(1)}:1`;
    detail = `Weakest measured text region reaches ${minRatio.toFixed(1)}:1, meeting the WCAG AA ${passRatio}:1 normal-text threshold. Median ${medianRatio.toFixed(1)}:1 across ${measurable.length} region(s).`;
  } else if (minRatio >= largeTextRatio) {
    verdict = 'human_review';
    headline = `${minRatio.toFixed(1)}:1`;
    detail = `Weakest measured region is ${minRatio.toFixed(1)}:1 — below the ${passRatio}:1 normal-text threshold; acceptable only for large-scale text (>= ${largeTextRatio}:1). Human judgement required on text size.`;
  } else {
    verdict = 'fail';
    headline = `${minRatio.toFixed(1)}:1`;
    detail = `Weakest measured region is ${minRatio.toFixed(1)}:1, below the ${largeTextRatio}:1 large-text minimum. Text is likely illegible.`;
  }

  return {
    regions,
    measurableCount: measurable.length,
    minRatio,
    medianRatio,
    result: {
      id: 'contrast',
      label: 'Contrast',
      verdict,
      headline,
      detail,
      confidence: measurable.length > 0 ? measurable.length / Math.max(1, regions.length) : null
    }
  };
}

// ── Logo template matching (normalized cross-correlation) ────────────────────

interface GrayImage {
  width: number;
  height: number;
  data: Float32Array;
}

function toGrayscale(img: PixelImage, maxWidth: number = 320): GrayImage {
  const scale = Math.min(1, maxWidth / img.width);
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));
  const data = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcX = Math.min(img.width - 1, Math.round(x / scale));
      const srcY = Math.min(img.height - 1, Math.round(y / scale));
      data[y * width + x] = pixelLuminance(img, srcX, srcY);
    }
  }
  return { width, height, data };
}

function resizeGray(src: GrayImage, width: number, height: number): GrayImage {
  const data = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcX = Math.min(src.width - 1, Math.round((x / width) * src.width));
      const srcY = Math.min(src.height - 1, Math.round((y / height) * src.height));
      data[y * width + x] = src.data[srcY * src.width + srcX];
    }
  }
  return { width, height, data };
}

/** Zero-mean normalized cross-correlation between template and image window. */
function nccAt(img: GrayImage, tpl: GrayImage, ox: number, oy: number): number {
  const n = tpl.width * tpl.height;
  let tplMean = 0;
  for (let i = 0; i < n; i++) tplMean += tpl.data[i];
  tplMean /= n;

  let imgMean = 0;
  for (let ty = 0; ty < tpl.height; ty++) {
    for (let tx = 0; tx < tpl.width; tx++) {
      imgMean += img.data[(oy + ty) * img.width + (ox + tx)];
    }
  }
  imgMean /= n;

  let num = 0;
  let tplVar = 0;
  let imgVar = 0;
  for (let ty = 0; ty < tpl.height; ty++) {
    for (let tx = 0; tx < tpl.width; tx++) {
      const t = tpl.data[ty * tpl.width + tx] - tplMean;
      const v = img.data[(oy + ty) * img.width + (ox + tx)] - imgMean;
      num += t * v;
      tplVar += t * t;
      imgVar += v * v;
    }
  }
  if (tplVar === 0 || imgVar === 0) return 0;
  return num / Math.sqrt(tplVar * imgVar);
}

export interface LogoMatch {
  confidence: number; // 0..1
  box: PixelBox | null; // in original-image pixels
}

/**
 * Find the best match of a reference logo template inside the artwork.
 * Slides the template at several scales and reports the strongest NCC score.
 */
export function matchLogo(img: PixelImage, template: PixelImage): LogoMatch {
  const gray = toGrayscale(img, 320);
  const tplGrayFull = toGrayscale(template, 64);
  // A uniform template (blank logo file) can never match.
  let tplMin = Infinity;
  let tplMax = -Infinity;
  for (let i = 0; i < tplGrayFull.data.length; i++) {
    const v = tplGrayFull.data[i];
    if (v < tplMin) tplMin = v;
    if (v > tplMax) tplMax = v;
  }
  if (tplMax - tplMin < 0.01) {
    return { confidence: 0, box: null };
  }

  const scaleDown = gray.width / img.width; // gray px per original px
  const scaleUp = 1 / scaleDown;
  let best: LogoMatch = { confidence: 0, box: null };

  for (const widthFraction of [0.06, 0.1, 0.14, 0.2]) {
    const tplW = Math.max(6, Math.round(gray.width * widthFraction));
    const tplH = Math.max(
      6,
      Math.round(tplW * (tplGrayFull.height / tplGrayFull.width))
    );
    if (tplW >= gray.width || tplH >= gray.height) continue;
    const tpl = resizeGray(tplGrayFull, tplW, tplH);
    const step = Math.max(1, Math.floor(Math.min(tplW, tplH) / 4));
    for (let oy = 0; oy + tplH <= gray.height; oy += step) {
      for (let ox = 0; ox + tplW <= gray.width; ox += step) {
        const score = nccAt(gray, tpl, ox, oy);
        if (score > best.confidence) {
          best = {
            confidence: score,
            box: {
              x: ox * scaleUp,
              y: oy * scaleUp,
              width: tplW * scaleUp,
              height: tplH * scaleUp
            }
          };
        }
      }
    }
  }
  return best;
}

// ── Clear-space measurement ──────────────────────────────────────────────────

function boxesOverlap(a: PixelBox, b: PixelBox): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/** Edge-to-edge distance between two boxes (0 when overlapping). */
export function boxDistance(a: PixelBox, b: PixelBox): number {
  if (boxesOverlap(a, b)) return 0;
  const dx = Math.max(0, Math.max(a.x - (b.x + b.width), b.x - (a.x + a.width)));
  const dy = Math.max(0, Math.max(a.y - (b.y + b.height), b.y - (a.y + a.height)));
  return Math.sqrt(dx * dx + dy * dy);
}

export function analyzeClearSpace(
  logoBox: PixelBox,
  textBoxes: PixelBox[],
  imageWidth: number,
  imageHeight: number,
  minClearPx?: number
): { minDistance: number; required: number; result: VisualCheckResult } {
  const required = minClearPx ?? Math.max(8, logoBox.height * 0.5);
  const distances = textBoxes.map((box) => boxDistance(logoBox, box));
  // Clear space also counts distance to the artwork edges.
  distances.push(logoBox.x, logoBox.y);
  distances.push(imageWidth - (logoBox.x + logoBox.width));
  distances.push(imageHeight - (logoBox.y + logoBox.height));
  const minDistance = Math.max(0, Math.min(...distances));

  const pass = minDistance >= required;
  return {
    minDistance,
    required,
    result: {
      id: 'clear_space',
      label: 'Clear space',
      verdict: pass ? 'pass' : 'human_review',
      headline: `${Math.round(minDistance)}px`,
      detail: pass
        ? `Nearest element or edge is ${Math.round(minDistance)}px from the logo, meeting the ${Math.round(required)}px clear-space minimum (half the logo height).`
        : `Nearest element or edge is only ${Math.round(minDistance)}px from the logo; brand guidelines require at least ${Math.round(required)}px. A reviewer should confirm crowding.`,
      confidence: null
    }
  };
}

// ── Text visibility rollup ───────────────────────────────────────────────────

export function analyzeTextVisibility(
  contrast: ContrastAnalysis,
  ocrConfidence: number | null
): VisualCheckResult {
  const measurable = contrast.regions.filter((r) => r.measurable);
  if (measurable.length === 0) {
    return {
      id: 'text_visibility',
      label: 'Text visibility',
      verdict: 'human_review',
      headline: 'Low confidence',
      detail:
        'No measurable text regions. Automated visibility scoring is not possible; a reviewer must inspect the artwork.',
      confidence: 0
    };
  }
  const lowContrast = measurable.filter((r) => r.ratio < 3.0).length;
  const lowFraction = lowContrast / measurable.length;
  const weakOcr = typeof ocrConfidence === 'number' && ocrConfidence > 0 && ocrConfidence < 70;
  if (lowFraction > 0.2 || weakOcr) {
    return {
      id: 'text_visibility',
      label: 'Text visibility',
      verdict: 'human_review',
      headline: 'Low confidence',
      detail: `${lowContrast} of ${measurable.length} measured region(s) fall under 3:1 contrast${weakOcr ? ' and OCR confidence is under 70%' : ''}. Routed to human review instead of an automated pass.`,
      confidence: 1 - lowFraction
    };
  }
  return {
    id: 'text_visibility',
    label: 'Text visibility',
    verdict: 'pass',
    headline: `Median ${contrast.medianRatio.toFixed(1)}:1`,
    detail: `${measurable.length} measured text region(s) show a median contrast of ${contrast.medianRatio.toFixed(1)}:1 with no widespread legibility failures.`,
    confidence: 1 - lowFraction
  };
}

// ── Orchestrator ─────────────────────────────────────────────────────────────

export interface VisualChecksInput {
  /** OCR word/line boxes in percent coordinates */
  textBoxes?: PercentBox[];
  ocrConfidence?: number | null;
  referenceLogo?: PixelImage | null;
  /** Pixel dimensions may be capped internally for speed */
}

const LOGO_PASS_CONFIDENCE = 0.75;
const LOGO_REVIEW_CONFIDENCE = 0.45;

export function runVisualChecks(img: PixelImage, input: VisualChecksInput): VisualCheckResult[] {
  if (!img || !img.width || !img.height || !img.data || img.data.length < img.width * img.height * 4) {
    return [
      {
        id: 'contrast',
        label: 'Contrast',
        verdict: 'human_review',
        headline: 'No image',
        detail: 'Artwork pixels were not available for analysis.',
        confidence: null
      }
    ];
  }

  const pixelBoxes = (input.textBoxes || [])
    .filter((b) => b && b.width > 0 && b.height > 0)
    .map((b) => percentBoxToPixels(b, img.width, img.height));

  const contrast = analyzeContrast(img, pixelBoxes);

  // Logo presence
  let logoResult: VisualCheckResult;
  let clearSpaceResult: VisualCheckResult;
  if (!input.referenceLogo) {
    logoResult = {
      id: 'logo',
      label: 'Logo',
      verdict: 'human_review',
      headline: 'No reference logo',
      detail:
        'No approved reference logo is on file for comparison. Upload the brand reference logo to enable template matching; until then a reviewer confirms logo presence manually.',
      confidence: null
    };
    clearSpaceResult = {
      id: 'clear_space',
      label: 'Clear space',
      verdict: 'human_review',
      headline: 'Logo not located',
      detail: 'Clear space is measured from the detected logo position, which is unavailable without a reference logo match.',
      confidence: null
    };
  } else {
    const match = matchLogo(img, input.referenceLogo);
    if (match.confidence >= LOGO_PASS_CONFIDENCE && match.box) {
      logoResult = {
        id: 'logo',
        label: 'Logo',
        verdict: 'pass',
        headline: `Found ${Math.round(match.confidence * 100)}%`,
        detail: `Reference logo matched at ${Math.round(match.confidence * 100)}% template correlation (normalized cross-correlation over grayscale pixels).`,
        confidence: match.confidence
      };
    } else if (match.confidence >= LOGO_REVIEW_CONFIDENCE) {
      logoResult = {
        id: 'logo',
        label: 'Logo',
        verdict: 'human_review',
        headline: `Partial ${Math.round(match.confidence * 100)}%`,
        detail: `Best template match reached only ${Math.round(match.confidence * 100)}% correlation — possibly a recolored, scaled, or cropped logo. Human confirmation required.`,
        confidence: match.confidence
      };
    } else {
      logoResult = {
        id: 'logo',
        label: 'Logo',
        verdict: 'human_review',
        headline: `Not found (${Math.round(match.confidence * 100)}%)`,
        detail: `No region matched the reference logo above ${Math.round(LOGO_REVIEW_CONFIDENCE * 100)}% correlation. The logo may be absent or heavily modified; a reviewer must confirm.`,
        confidence: match.confidence
      };
    }

    if (match.box && match.confidence >= LOGO_REVIEW_CONFIDENCE) {
      clearSpaceResult = analyzeClearSpace(match.box, pixelBoxes, img.width, img.height).result;
    } else {
      clearSpaceResult = {
        id: 'clear_space',
        label: 'Clear space',
        verdict: 'human_review',
        headline: 'Logo not located',
        detail: 'The reference logo could not be located with enough confidence to measure clear space.',
        confidence: null
      };
    }
  }

  const textVisibility = analyzeTextVisibility(contrast, input.ocrConfidence ?? null);

  return [contrast.result, logoResult, clearSpaceResult, textVisibility];
}
