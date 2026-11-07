import demoCatalog from '../../data/demo-catalog.json';

export interface BrandRule {
  id: string;
  brand: string; // 'freshbites' | 'arka' | 'novatech' | 'global'
  title: string;
  category: 'health' | 'trademark' | 'disclaimers' | 'pricing' | 'general';
  severity: 'critical' | 'warning' | 'advisory';
  pattern: string; // Regex string e.g. "100%\\s*detox|cure\\s*disease"
  flags?: string; // Regex flags e.g. "i"
  source: string; // e.g. "FTC Health Products Guidance 2024 & FDA 21 CFR §101.93"
  explanation: string;
  suggestedRemedy?: string;
  enabled: boolean;
  appliesTo: ('caption' | 'ocr')[];
}

export interface ComplianceFinding {
  id: string;
  ruleId: string;
  ruleTitle: string;
  matchedText: string;
  severity: 'critical' | 'warning' | 'advisory';
  source: 'caption' | 'ocr' | 'both';
  ruleSource: string;
  explanation: string;
  suggestedCorrection?: string;
  status: 'open' | 'applied' | 'dismissed' | 'manual_reviewed';
  dismissNote?: string;
  bbox?: { top: number; left: number; width: number; height: number }; // Percentage coords on image
}

export interface CampaignPreset {
  id: string;
  code: string;
  title: string;
  brandId: string;
  brandName: string;
  channel: string;
  format: string;
  aspectRatio: string;
  imageUrl: string;
  assetId?: string;
  assetMetadata?: {
    mimeType?: string;
    size?: number;
    extension?: string;
    uploadedBy?: string;
    uploadedAt?: string | Date;
  };
  caption: string;
  ocrText: string;
  ocrConfidence: number;
  extractedText?: string;
  correctedArtworkText?: string;
  initialFindings: ComplianceFinding[];
  status: 'action_required' | 'under_review' | 'approved' | 'rejected';
  sourceName?: string;
  sourceUrl?: string;
  licenseName?: string;
  licenseUrl?: string;
  attribution?: string;
  sourceDescription?: string;
  referenceOnly?: boolean;
  isDemo?: boolean;
  updatedAt?: string | Date;
  createdAt?: string | Date;
}

export interface ReviewRecord {
  id: string;
  dossierNumber: string;
  campaignTitle: string;
  brandId: string;
  brandName: string;
  channel: string;
  reviewedAt: string;
  reviewerName: string;
  reviewerRole: string;
  auditId: string;
  sha256Hash: string;
  status: 'approved' | 'conditional' | 'rejected';
  findingsCount: number;
  clearedCount: number;
  openCount: number;
  imageUrl: string;
  oldCopy?: string;
  newCopy?: string;
  findings: ComplianceFinding[];
  notes?: string;
}

export const DEFAULT_RULES: BrandRule[] = [
  {
    id: 'FB-012',
    brand: 'freshbites',
    title: 'Unsubstantiated Detox & Cure Claims',
    category: 'health',
    severity: 'critical',
    pattern: '100%\\s*detox|detoxify|cure\\s*disease|cancer\\s*defense',
    flags: 'i',
    source: 'FTC Health Products Compliance Guide 2024 & FDA 21 CFR §101.93',
    explanation: 'Absolute clinical detox claims require double-blind peer-reviewed substantiation. Prohibited on commercial social syndication without disclaimer.',
    suggestedRemedy: 'Daily Refreshing Wellness Support',
    enabled: true,
    appliesTo: ['caption', 'ocr']
  },
  {
    id: 'FB-004',
    brand: 'freshbites',
    title: 'Express Organic Certification Verification',
    category: 'trademark',
    severity: 'critical',
    pattern: 'certified organic|100% organic',
    flags: 'i',
    source: 'NOP USDA Organic Regulations 7 CFR Part 205',
    explanation: 'Express "Certified Organic" assertions require companion USDA organic seal visible on the creative artboard proof.',
    suggestedRemedy: 'USDA Certified Organic',
    enabled: true,
    appliesTo: ['caption', 'ocr']
  },
  {
    id: 'FB-028',
    brand: 'freshbites',
    title: 'Time-Bound Metabolic Efficacy Limit',
    category: 'health',
    severity: 'warning',
    pattern: 'in\\s*24\\s*hours|instant\\s*cure|overnight\\s*results',
    flags: 'i',
    source: 'Rule FB-028 • NAD Advertising substantiation framework',
    explanation: 'Time-bound metabolic assertions trigger strict regulatory review without qualifying lifestyle disclosures.',
    suggestedRemedy: 'with regular healthy diet',
    enabled: true,
    appliesTo: ['caption']
  },
  {
    id: 'FB-019',
    brand: 'freshbites',
    title: 'Comparative Superiority Superlatives',
    category: 'pricing',
    severity: 'warning',
    pattern: 'best\\s*juice\\s*in\\s*market|#1\\s*rated|superior\\s*to\\s*leading\\s*brands',
    flags: 'i',
    source: 'FTC Deceptive Advertising Guidelines 16 CFR Part 255',
    explanation: 'Comparative superiority claims mandate independent third-party consumer survey or lab study substantiation.',
    suggestedRemedy: 'Customer-favorite wellness blend',
    enabled: true,
    appliesTo: ['caption', 'ocr']
  },
  {
    id: 'FB-031',
    brand: 'freshbites',
    title: 'Mandatory Allergen & Cold Storage Advisory',
    category: 'disclaimers',
    severity: 'advisory',
    pattern: 'raw\\s*juice|unpasteurized',
    flags: 'i',
    source: 'FDA Juice HACCP 21 CFR Part 120',
    explanation: 'Must append standard unpasteurized cold-storage advisory footnote when retail visual shows product bottles without refrigeration context.',
    suggestedRemedy: 'Keep refrigerated • Perishable',
    enabled: true,
    appliesTo: ['caption', 'ocr']
  },
  {
    id: 'AF-014',
    brand: 'arka',
    title: 'Allergen Advisory Placement',
    category: 'disclaimers',
    severity: 'critical',
    pattern: 'zero\\s*allergens|100%\\s*allergen-free',
    flags: 'i',
    source: 'Food Allergen Labeling and Consumer Protection Act (FALCPA)',
    explanation: 'Prepared catering claims cannot assert absolute absence of allergens without facility cross-contamination certification.',
    suggestedRemedy: 'Prepared in a facility handling tree nuts',
    enabled: true,
    appliesTo: ['caption', 'ocr']
  },
  {
    id: 'AF-022',
    brand: 'arka',
    title: 'Pre-order Cutoff Disclosure',
    category: 'pricing',
    severity: 'warning',
    pattern: 'order\\s*now|book\\s*now',
    flags: 'i',
    source: 'Arka Foods Retail Operations Policy 2024-B',
    explanation: 'Catering promotions must explicitly display the order cutoff date and fulfillment SLA.',
    suggestedRemedy: 'Order by Dec 15th for Holiday Delivery',
    enabled: true,
    appliesTo: ['caption', 'ocr']
  },
  {
    id: 'NT-008',
    brand: 'novatech',
    title: 'Pricing Asterisk & Limitation Disclaimer',
    category: 'pricing',
    severity: 'warning',
    pattern: '50%\\s*off|flash\\s*sale|limited\\s*time\\s*deal',
    flags: 'i',
    source: 'FTC Guides Against Deceptive Pricing 16 CFR §233.1',
    explanation: 'Flash sale countdowns and discount percentages require clear disclosure of promotional window and terms.',
    suggestedRemedy: '*Discount applies to MSRP. Limited stock available.',
    enabled: true,
    appliesTo: ['caption', 'ocr']
  },
  {
    id: 'NT-015',
    brand: 'novatech',
    title: 'Battery Life Claims Substantiation',
    category: 'health',
    severity: 'advisory',
    pattern: '30h\\s*playtime|infinite\\s*battery',
    flags: 'i',
    source: 'IEEE Battery Benchmark Standard 1625',
    explanation: 'Battery life performance metrics must include volume level test parameters (*tested at 50% volume with ANC disabled).',
    suggestedRemedy: 'Up to 30h playtime at 50% volume',
    enabled: true,
    appliesTo: ['caption', 'ocr']
  },
  ...(demoCatalog.rules as unknown as BrandRule[])
];

export function runComplianceAudit(
  caption: string,
  ocrText: string,
  rules: BrandRule[],
  brandId?: string
): ComplianceFinding[] {
  const activeRules = rules.filter(r => r.enabled && (!brandId || r.brand === brandId || r.brand === 'global'));
  const findings: ComplianceFinding[] = [];

  for (const rule of activeRules) {
    let regex: RegExp;
    try {
      regex = new RegExp(rule.pattern, rule.flags || 'i');
    } catch {
      continue;
    }

    const matchedCaption = rule.appliesTo.includes('caption') && regex.exec(caption);
    const matchedOcr = rule.appliesTo.includes('ocr') && regex.exec(ocrText);

    if (matchedCaption || matchedOcr) {
      const source: 'caption' | 'ocr' | 'both' =
        matchedCaption && matchedOcr ? 'both' : matchedCaption ? 'caption' : 'ocr';
      const matchedPhrase = matchedCaption ? matchedCaption[0] : matchedOcr ? matchedOcr[0] : '';

      findings.push({
        id: `finding-${rule.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        ruleId: rule.id,
        ruleTitle: rule.title,
        matchedText: matchedPhrase,
        severity: rule.severity,
        source,
        ruleSource: rule.source,
        explanation: rule.explanation,
        suggestedCorrection: rule.suggestedRemedy,
        status: 'open'
      });
    }
  }

  return findings;
}

export function calculateComplianceScore(findings: ComplianceFinding[]): {
  score: number;
  status: 'approved' | 'action_required' | 'critical';
  criticalOpen: number;
  warningOpen: number;
  advisoryOpen: number;
  totalResolved: number;
} {
  const openFindings = findings.filter(f => f.status === 'open');
  const criticalOpen = openFindings.filter(f => f.severity === 'critical').length;
  const warningOpen = openFindings.filter(f => f.severity === 'warning').length;
  const advisoryOpen = openFindings.filter(f => f.severity === 'advisory').length;
  const totalResolved = findings.filter(f => f.status === 'applied' || f.status === 'dismissed' || f.status === 'manual_reviewed').length;

  let score = 100;
  score -= criticalOpen * 35;
  score -= warningOpen * 15;
  score -= advisoryOpen * 5;
  if (score < 0) score = 0;

  let status: 'approved' | 'action_required' | 'critical' = 'approved';
  if (criticalOpen > 0) {
    status = 'critical';
  } else if (warningOpen > 0 || advisoryOpen > 0) {
    status = 'action_required';
  }

  return {
    score,
    status,
    criticalOpen,
    warningOpen,
    advisoryOpen,
    totalResolved
  };
}

export function applyCorrectionToCaption(
  currentCaption: string,
  matchedText: string,
  suggestedCorrection: string
): string {
  if (!matchedText || !suggestedCorrection) return currentCaption;
  // Replace case-insensitively
  const regex = new RegExp(escapeRegex(matchedText), 'i');
  return currentCaption.replace(regex, suggestedCorrection);
}

function escapeRegex(string: string): string {
  return string.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');
}

export function filterBrandRules(
  rules: BrandRule[],
  filter: { search?: string; category?: string; severity?: string; brandId?: string }
): BrandRule[] {
  return rules.filter(rule => {
    if (filter.brandId && filter.brandId !== 'all' && rule.brand !== filter.brandId && rule.brand !== 'global') {
      return false;
    }
    if (filter.category && filter.category !== 'all' && rule.category !== filter.category) {
      return false;
    }
    if (filter.severity && filter.severity !== 'all' && rule.severity !== filter.severity) {
      return false;
    }
    if (filter.search && filter.search.trim().length > 0) {
      const q = filter.search.toLowerCase().trim();
      const match =
        rule.id.toLowerCase().includes(q) ||
        rule.title.toLowerCase().includes(q) ||
        rule.pattern.toLowerCase().includes(q) ||
        rule.explanation.toLowerCase().includes(q) ||
        rule.source.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });
}
