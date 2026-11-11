// Evidence Library: approved-claim substantiation records with expiry tracking.
// Every factual claim a rule flags should trace to a current evidence record.
// Missing or expired evidence is never auto-resolved: it is flagged for a human.

export interface EvidenceDocument {
  id: string;
  brandId: string;
  /** Lowercase phrases. A document matches a claim when any phrase appears in the claim text. */
  claimKeywords: string[];
  title: string;
  docType: 'certificate' | 'lab_report' | 'policy' | 'license' | 'terms' | 'registration';
  reference?: string; // e.g. certificate or report number
  url?: string; // external document link
  issuedAt?: string; // ISO date
  expiresAt?: string | null; // ISO date; null/undefined = no expiry (e.g. standing policy link)
  notes?: string;
}

export type EvidenceStatus = 'current' | 'expiring_soon' | 'expired' | 'no_expiry';

export interface ClaimEvidenceSummary {
  state: 'ok' | 'expiring' | 'expired' | 'missing';
  /** True when a human must review before approval (missing or expired evidence). */
  flaggedForHumanReview: boolean;
  documents: EvidenceDocument[];
  label: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Parse an ISO date string; returns null for invalid/missing input. */
export function parseEvidenceDate(value?: string | null): Date | null {
  if (!value || typeof value !== 'string') return null;
  const time = Date.parse(value);
  if (Number.isNaN(time)) return null;
  return new Date(time);
}

export function evidenceStatus(
  doc: EvidenceDocument,
  now: Date = new Date(),
  expiringWindowDays: number = 30
): EvidenceStatus {
  const expiry = parseEvidenceDate(doc.expiresAt);
  if (!expiry) return 'no_expiry';
  const diffMs = expiry.getTime() - now.getTime();
  if (diffMs < 0) return 'expired';
  if (diffMs <= expiringWindowDays * DAY_MS) return 'expiring_soon';
  return 'current';
}

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Match evidence documents to a claim/finding text.
 * A document matches when at least one of its claim keywords appears in the
 * claim text (case-insensitive, whitespace-normalized).
 */
export function findEvidenceForClaim(
  claimText: string,
  library: EvidenceDocument[]
): EvidenceDocument[] {
  const haystack = normalizeText(claimText || '');
  if (!haystack) return [];
  return library.filter((doc) =>
    (doc.claimKeywords || []).some((keyword) => {
      const needle = normalizeText(keyword || '');
      return needle.length > 0 && haystack.includes(needle);
    })
  );
}

/**
 * Summarize the evidence situation for one claim.
 * - missing: no evidence on file -> human review flag
 * - expired: worst document expired -> human review flag
 * - expiring: at least one document expires soon (informational)
 * - ok: all matched documents current or without expiry
 */
export function summarizeClaimEvidence(
  claimText: string,
  library: EvidenceDocument[],
  now: Date = new Date()
): ClaimEvidenceSummary {
  const documents = findEvidenceForClaim(claimText, library);
  if (documents.length === 0) {
    return {
      state: 'missing',
      flaggedForHumanReview: true,
      documents,
      label: 'No evidence on file'
    };
  }
  const statuses = documents.map((doc) => evidenceStatus(doc, now));
  if (statuses.includes('expired')) {
    return {
      state: 'expired',
      flaggedForHumanReview: true,
      documents,
      label: 'Evidence expired'
    };
  }
  if (statuses.includes('expiring_soon')) {
    return {
      state: 'expiring',
      flaggedForHumanReview: false,
      documents,
      label: 'Evidence expiring soon'
    };
  }
  return {
    state: 'ok',
    flaggedForHumanReview: false,
    documents,
    label: 'Evidence current'
  };
}

/** Short, display-safe date: 31 Dec 2026 */
export function formatEvidenceDate(value?: string | null): string {
  const date = parseEvidenceDate(value);
  if (!date) return '';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Seed library for the in-browser demo. Dates are relative to the demo period
 * (November 2026) so judges see current, expiring, expired, and missing states.
 */
export const DEFAULT_EVIDENCE_LIBRARY: EvidenceDocument[] = [
  {
    id: 'EVD-FB-ORGANIC-2026',
    brandId: 'freshbites',
    claimKeywords: ['cold-pressed organic', 'certified organic', '100% organic', 'organic'],
    title: 'USDA Organic Certificate',
    docType: 'certificate',
    reference: 'Certificate #FB-OR-88219',
    url: 'https://www.ams.usda.gov/services/organic-certification',
    issuedAt: '2026-01-15',
    expiresAt: '2026-12-31',
    notes: 'Covers cold-pressed juice line; renewal filing due Q4 2026.'
  },
  {
    id: 'EVD-FB-IMMUNITY-2025',
    brandId: 'freshbites',
    claimKeywords: ['in 24 hours', 'immunity in', 'supercharge your immunity'],
    title: 'Immunity Onset Timing Study',
    docType: 'lab_report',
    reference: 'Report #FB-LAB-2214',
    issuedAt: '2025-04-10',
    expiresAt: '2026-09-30',
    notes: 'Pilot study (n=32). Expired: renewal study not yet commissioned.'
  },
  {
    id: 'EVD-AF-ALLERGEN-POLICY',
    brandId: 'arka',
    claimKeywords: ['zero allergens', 'allergen-free', 'tree nuts', 'allergen'],
    title: 'Facility Allergen Handling Policy',
    docType: 'policy',
    reference: 'Arka Ops Policy 2024-B, Section 3',
    url: 'https://www.fda.gov/food/food-labeling-nutrition/food-allergies',
    expiresAt: null,
    notes: 'Standing policy: facility handles tree nuts; absolute claims prohibited.'
  },
  {
    id: 'EVD-AF-CUTOFF-POLICY',
    brandId: 'arka',
    claimKeywords: ['order now', 'book now', 'order by', 'book your'],
    title: 'Pre-order Cutoff & Fulfilment SLA',
    docType: 'terms',
    reference: 'Arka Retail Operations Policy 2024-B',
    url: 'https://www.ftc.gov/business-guidance/advertising-marketing',
    expiresAt: null,
    notes: 'Promotions must display order cutoff date and fulfilment SLA.'
  },
  {
    id: 'EVD-NT-BATTERY-2026',
    brandId: 'novatech',
    claimKeywords: ['30h playtime', 'battery', 'playtime'],
    title: 'Battery Benchmark Lab Report',
    docType: 'lab_report',
    reference: 'Report #NT-IEEE-1625-077',
    issuedAt: '2026-03-01',
    expiresAt: '2026-11-20',
    notes: 'Tested at 50% volume, ANC disabled, per IEEE 1625.'
  },
  {
    id: 'EVD-NT-PRICING-TERMS',
    brandId: 'novatech',
    claimKeywords: ['50% off', 'flash sale', 'limited time deal'],
    title: 'Promotional Pricing Terms',
    docType: 'terms',
    reference: 'NovaTech Promo Terms v3.0',
    url: 'https://www.ftc.gov/legal-library/browse/federal-register-notices/guides-against-deceptive-pricing',
    expiresAt: null,
    notes: 'Discount percentages require displayed promo window and stock terms.'
  },
  {
    id: 'EVD-VRD-DISINFECT-2026',
    brandId: 'verdant',
    claimKeywords: ['kills 99.9% of germs', '99.9%'],
    title: 'Disinfectant Efficacy Lab Certificate',
    docType: 'lab_report',
    reference: 'Report #VRD-MICRO-559',
    issuedAt: '2026-05-20',
    expiresAt: '2027-05-20',
    notes: 'EPA-registered lab protocol; surfaces only, not skin claims.'
  },
  {
    id: 'EVD-TTR-CARBON-2025',
    brandId: 'terratrail',
    claimKeywords: ['100% carbon neutral', 'carbon neutral'],
    title: 'Carbon Offset Registry Entry',
    docType: 'registration',
    reference: 'Registry #TTR-CO2-2025-441',
    issuedAt: '2025-11-01',
    expiresAt: '2026-10-31',
    notes: 'Offset credits expired 31 Oct 2026; renewal audit pending.'
  }
];
