import platformSpecsData from '../data/platformSpecs.json';

export interface SafeZoneRegion {
  id: string;
  name: string;
  description: string;
  top: number;    // % from top (0 - 100)
  left: number;   // % from left (0 - 100)
  width: number;  // % width (0 - 100)
  height: number; // % height (0 - 100)
  severity?: 'high' | 'medium' | 'low';
}

export interface PlatformFormatSpec {
  id: string;
  name: string;
  aspectRatio: string;
  aspectRatioNum: number;
  targetWidth: number;
  targetHeight: number;
  minWidth: number;
  minHeight: number;
  officialSourceUrl: string;
  officialSourceDoc: string;
  lastVerifiedDate: string;
  safeZones: SafeZoneRegion[];
  layoutGuidance: string;
}

export interface PlatformSpec {
  id: string;
  name: string;
  formats: PlatformFormatSpec[];
}

export interface DimensionAnalysisResult {
  status: 'exact_match' | 'aspect_ratio_match' | 'dimension_mismatch' | 'unsupported_format';
  label: string;
  actualWidth: number;
  actualHeight: number;
  actualAspectRatio: number;
  actualAspectRatioString: string;
  targetWidth?: number;
  targetHeight?: number;
  targetAspectRatio?: number;
  targetAspectRatioString?: string;
  meetsMinimumResolution: boolean;
  minWidth?: number;
  minHeight?: number;
  message: string;
}

export interface OverlapItem {
  elementId: string;
  text: string;
  source: 'finding' | 'ocr_word' | 'ocr_line';
  severity?: string;
  safeZoneId: string;
  safeZoneName: string;
  overlapPercentage: number;
  warningMessage: string;
}

export interface OverlapDetectionResult {
  overlaps: OverlapItem[];
  hasOverlaps: boolean;
  totalObscuredCount: number;
}

export const SAFE_ZONE_DISCLAIMER =
  'Platform safe-zone analysis provides layout guidance based on official creative guidelines and does not guarantee final platform rendering across all client device viewports.';

export function getAllPlatforms(): PlatformSpec[] {
  return (platformSpecsData.platforms || []) as PlatformSpec[];
}

export function getAllFormats(): PlatformFormatSpec[] {
  const formats: PlatformFormatSpec[] = [];
  for (const plat of getAllPlatforms()) {
    if (Array.isArray(plat.formats)) {
      formats.push(...plat.formats);
    }
  }
  return formats;
}

export function getFormatSpec(formatId: string): PlatformFormatSpec | null {
  for (const plat of getAllPlatforms()) {
    const found = plat.formats?.find((f) => f.id === formatId);
    if (found) return found;
  }
  return null;
}

export function getPlatformByFormatId(
  formatId: string
): { platform: PlatformSpec; format: PlatformFormatSpec } | null {
  for (const plat of getAllPlatforms()) {
    const found = plat.formats?.find((f) => f.id === formatId);
    if (found) {
      return { platform: plat, format: found };
    }
  }
  return null;
}

export function formatAspectRatioString(width: number, height: number): string {
  if (!width || !height || height === 0) return 'Unknown';
  const ratio = width / height;

  // Check known standard ratios with small tolerance
  if (Math.abs(ratio - 9 / 16) < 0.02) return '9:16';
  if (Math.abs(ratio - 4 / 5) < 0.02) return '4:5';
  if (Math.abs(ratio - 1) < 0.02) return '1:1';
  if (Math.abs(ratio - 16 / 9) < 0.02) return '16:9';
  if (Math.abs(ratio - 1.91) < 0.03) return '1.91:1';

  // Fallback to reduced fraction or decimal
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(Math.round(width), Math.round(height));
  const simpW = Math.round(width) / divisor;
  const simpH = Math.round(height) / divisor;
  if (simpW <= 20 && simpH <= 20) {
    return `${simpW}:${simpH}`;
  }
  return `${ratio.toFixed(2)}:1`;
}

export function analyzeImageDimensions(
  actualWidth: number,
  actualHeight: number,
  formatSpec: PlatformFormatSpec | null | undefined
): DimensionAnalysisResult {
  if (!actualWidth || !actualHeight || actualWidth <= 0 || actualHeight <= 0) {
    return {
      status: 'unsupported_format',
      label: 'Image Dimensions Unavailable',
      actualWidth: 0,
      actualHeight: 0,
      actualAspectRatio: 0,
      actualAspectRatioString: 'Unknown',
      meetsMinimumResolution: false,
      message: 'Could not inspect image dimensions.'
    };
  }

  const actualRatio = actualWidth / actualHeight;
  const actualRatioStr = formatAspectRatioString(actualWidth, actualHeight);

  if (!formatSpec) {
    return {
      status: 'unsupported_format',
      label: 'Custom / Unsupported Format',
      actualWidth,
      actualHeight,
      actualAspectRatio: actualRatio,
      actualAspectRatioString: actualRatioStr,
      meetsMinimumResolution: true,
      message:
        'No pre-configured platform specifications found for this format. Standard center-weighting recommended.'
    };
  }

  const targetRatio = formatSpec.aspectRatioNum;
  const ratioTolerance = 0.035;
  const ratioDiff = Math.abs(actualRatio - targetRatio) / targetRatio;
  const isRatioMatch = ratioDiff < ratioTolerance;

  const isExactMatch =
    actualWidth === formatSpec.targetWidth && actualHeight === formatSpec.targetHeight;

  const meetsMin =
    actualWidth >= (formatSpec.minWidth || 0) && actualHeight >= (formatSpec.minHeight || 0);

  if (isExactMatch) {
    return {
      status: 'exact_match',
      label: 'Exact Specification Match',
      actualWidth,
      actualHeight,
      actualAspectRatio: actualRatio,
      actualAspectRatioString: actualRatioStr,
      targetWidth: formatSpec.targetWidth,
      targetHeight: formatSpec.targetHeight,
      targetAspectRatio: targetRatio,
      targetAspectRatioString: formatSpec.aspectRatio,
      meetsMinimumResolution: true,
      minWidth: formatSpec.minWidth,
      minHeight: formatSpec.minHeight,
      message: `Asset resolution (${actualWidth} × ${actualHeight} px) exactly matches recommended target for ${formatSpec.name}.`
    };
  }

  if (isRatioMatch) {
    return {
      status: 'aspect_ratio_match',
      label: meetsMin ? 'Aspect Ratio Matches' : 'Ratio Matches (Low Resolution)',
      actualWidth,
      actualHeight,
      actualAspectRatio: actualRatio,
      actualAspectRatioString: actualRatioStr,
      targetWidth: formatSpec.targetWidth,
      targetHeight: formatSpec.targetHeight,
      targetAspectRatio: targetRatio,
      targetAspectRatioString: formatSpec.aspectRatio,
      meetsMinimumResolution: meetsMin,
      minWidth: formatSpec.minWidth,
      minHeight: formatSpec.minHeight,
      message: meetsMin
        ? `Asset aspect ratio (${actualRatioStr}) matches target (${formatSpec.aspectRatio}), though resolution differs from target ${formatSpec.targetWidth} × ${formatSpec.targetHeight} px.`
        : `Asset aspect ratio (${actualRatioStr}) matches target, but resolution (${actualWidth} × ${actualHeight} px) is below minimum recommended ${formatSpec.minWidth} × ${formatSpec.minHeight} px.`
    };
  }

  return {
    status: 'dimension_mismatch',
    label: 'Aspect Ratio Mismatch',
    actualWidth,
    actualHeight,
    actualAspectRatio: actualRatio,
    actualAspectRatioString: actualRatioStr,
    targetWidth: formatSpec.targetWidth,
    targetHeight: formatSpec.targetHeight,
    targetAspectRatio: targetRatio,
    targetAspectRatioString: formatSpec.aspectRatio,
    meetsMinimumResolution: meetsMin,
    minWidth: formatSpec.minWidth,
    minHeight: formatSpec.minHeight,
    message: `Asset aspect ratio (${actualRatioStr}) does not match target ${formatSpec.aspectRatio}. The creative may be cropped or padded with letterboxing/pillarboxing.`
  };
}

export function detectSafeZoneOverlaps(
  elements: Array<{
    id: string;
    text: string;
    bbox?: { top: number; left: number; width: number; height: number };
    severity?: string;
    source?: 'finding' | 'ocr_word' | 'ocr_line';
  }>,
  safeZones: SafeZoneRegion[]
): OverlapDetectionResult {
  const overlaps: OverlapItem[] = [];

  if (!safeZones || safeZones.length === 0 || !elements || elements.length === 0) {
    return { overlaps, hasOverlaps: false, totalObscuredCount: 0 };
  }

  for (const elem of elements) {
    if (!elem.bbox) continue;

    const eb = elem.bbox;
    // Bounding boxes are in percentage 0..100
    for (const sz of safeZones) {
      const x1 = Math.max(eb.left, sz.left);
      const y1 = Math.max(eb.top, sz.top);
      const x2 = Math.min(eb.left + eb.width, sz.left + sz.width);
      const y2 = Math.min(eb.top + eb.height, sz.top + sz.height);

      if (x2 > x1 && y2 > y1) {
        const intersectionArea = (x2 - x1) * (y2 - y1);
        const elemArea = eb.width * eb.height;
        const overlapPercentage =
          elemArea > 0 ? Math.min(100, Math.round((intersectionArea / elemArea) * 100)) : 100;

        // Only register if at least 15% of the element overlaps the safe-zone obstruction
        if (overlapPercentage >= 15) {
          overlaps.push({
            elementId: elem.id,
            text: elem.text,
            source: elem.source || 'finding',
            severity: elem.severity || 'warning',
            safeZoneId: sz.id,
            safeZoneName: sz.name,
            overlapPercentage,
            warningMessage: `"${elem.text}" falls inside "${sz.name}" (${sz.description}) with ~${overlapPercentage}% overlap.`
          });
        }
      }
    }
  }

  return {
    overlaps,
    hasOverlaps: overlaps.length > 0,
    totalObscuredCount: overlaps.length
  };
}

