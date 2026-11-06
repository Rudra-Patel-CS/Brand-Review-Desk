import { BrandRule, CampaignPreset, ReviewRecord, DEFAULT_RULES } from '../utils/rulesEngine.js';

export interface Brand {
  id: string;
  name: string;
  category: string;
  rulebookVersion: string;
  activeRulesCount: number;
  approvedClaimsCount: number;
}

export const BRANDS: Brand[] = [
  {
    id: 'freshbites',
    name: 'FreshBites Organic',
    category: 'Cold-Pressed Wellness & Nutrition',
    rulebookVersion: 'Master Rulebook v4.1',
    activeRulesCount: 42,
    approvedClaimsCount: 14
  },
  {
    id: 'arka',
    name: 'Arka Foods',
    category: 'Artisanal Catering & Harvest Goods',
    rulebookVersion: 'Quality Codex v2.8',
    activeRulesCount: 28,
    approvedClaimsCount: 19
  },
  {
    id: 'novatech',
    name: 'NovaTech Solutions',
    category: 'Consumer Electronics & Smart Audio',
    rulebookVersion: 'Commercial Compliance v3.0',
    activeRulesCount: 35,
    approvedClaimsCount: 11
  }
];

export const INITIAL_PRESETS: CampaignPreset[] = [
  {
    id: 'preset-freshbites-glow',
    code: 'CAMPAIGN-0942',
    title: 'Green Glow Immunity Booster Launch',
    brandId: 'freshbites',
    brandName: 'FreshBites Organic',
    channel: 'IG / TikTok Reels (9:16)',
    format: 'Short-Form Video & Story',
    aspectRatio: '4/5',
    imageUrl: '/assets/aistudio/screen_81b71146.png',
    caption: 'Revive your day with 100% Detox cold-pressed glow! Scientifically formulated to supercharge your immunity in 24 hours. #FreshBites #Immunity #CleanEats',
    ocrText: 'REVIVE AVOCADO GLOW Cold-Pressed Green Wellness 100% Detox • Immunity Booster Organic Avocado, Spinach, Kale, Wheatgrass, Ginger, Lemon, Apple 355ml SHOP NOW Available at ReviveWellness.com',
    ocrConfidence: 98.4,
    status: 'action_required',
    initialFindings: [
      {
        id: 'finding-fb-012',
        ruleId: 'FB-012',
        ruleTitle: 'Unsubstantiated Detox & Cure Claims',
        matchedText: '100% Detox',
        severity: 'critical',
        source: 'both',
        ruleSource: 'FDA/FTC Sec. 4.1 • FreshBites Rule FB-012',
        explanation: "Absolute clinical detox claims ('100% Detox') require double-blind peer-reviewed substantiation under FTC Health Products Guidance. Unauthorized for commercial social syndication without disclaimer.",
        suggestedCorrection: 'Daily Refreshing Wellness Support',
        status: 'open',
        bbox: { top: 59.5, left: 41.5, width: 19.0, height: 4.2 }
      },
      {
        id: 'finding-fb-028',
        ruleId: 'FB-028',
        ruleTitle: 'Time-Bound Metabolic Efficacy Limit',
        matchedText: 'in 24 hours',
        severity: 'warning',
        source: 'caption',
        ruleSource: 'Rule FB-028 • Time-bound Efficacy Limit',
        explanation: 'Time-bound metabolic assertions ("in 24 hours") trigger strict NAD advertising review without qualifying lifestyle disclosures.',
        suggestedCorrection: 'with regular healthy diet',
        status: 'open',
        bbox: { top: 64.2, left: 43.5, width: 18.5, height: 3.8 }
      },
      {
        id: 'finding-fb-004',
        ruleId: 'FB-004',
        ruleTitle: '“Cold-Pressed Organic” Claim',
        matchedText: 'Cold-Pressed Organic',
        severity: 'advisory',
        source: 'both',
        ruleSource: 'NOP USDA Organic Regulations 7 CFR Part 205',
        explanation: 'Verified against USDA Organic Certificate #FB-OR-88219 (Valid through Q4 2026). No revisions necessary.',
        suggestedCorrection: 'Verified Organic Standard',
        status: 'applied'
      }
    ]
  },
  {
    id: 'preset-arka-holiday',
    code: 'CAMPAIGN-0884',
    title: 'Harvest & Holiday Feast Catering Push',
    brandId: 'arka',
    brandName: 'Arka Foods',
    channel: 'Instagram Carousel & Print Ad',
    format: 'Multi-Asset Feast Promotion',
    aspectRatio: '4/3',
    imageUrl: '/assets/aistudio/screen_d1dae6af.png',
    caption: 'Celebrate the season with Gourmet Organic Selections! Book your festive catering now. Order by Dec 15th at FestiveHoliday.com. Prepared in a facility handling tree nuts. #HolidayFeast #ArkaFoods',
    ocrText: 'HARVEST & HOLIDAY FEAST CELEBRATE THE SEASON Gourmet Organic Selections BOOK YOUR FESTIVE CATERING NOW! ORDER BY DEC 15TH | FESTIVEHOLIDAY.COM THE GOURMET TABLE',
    ocrConfidence: 99.2,
    status: 'approved',
    initialFindings: [
      {
        id: 'finding-af-014',
        ruleId: 'AF-014',
        ruleTitle: 'Allergen Advisory Compliance',
        matchedText: 'Prepared in a facility handling tree nuts',
        severity: 'critical',
        source: 'caption',
        ruleSource: 'FALCPA Allergen Guidelines',
        explanation: 'Standard FDA allergen footnote confirmed and attached to footer.',
        status: 'applied'
      },
      {
        id: 'finding-af-022',
        ruleId: 'AF-022',
        ruleTitle: 'Pre-Order Cutoff Date Disclosure',
        matchedText: 'Order by Dec 15th',
        severity: 'warning',
        source: 'both',
        ruleSource: 'Arka Operations SLA-2024',
        explanation: 'Fulfillment cut-off date synchronized with POS terms.',
        status: 'applied',
        bbox: { top: 83.5, left: 34.0, width: 32.0, height: 3.5 }
      }
    ]
  },
  {
    id: 'preset-novatech-titanium',
    code: 'CAMPAIGN-0719',
    title: 'Titanium Cyber Flash Sale 50% Off',
    brandId: 'novatech',
    brandName: 'NovaTech Solutions',
    channel: 'Paid Social & Display Banner',
    format: '16:9 Display & Story Ad',
    aspectRatio: '16/9',
    imageUrl: '/assets/aistudio/screen_4c96d80f.png',
    caption: 'Flash Sale 50% Off! Limited time deal on AURA Titanium Noise-Cancelling Headphones. Shop now before countdown ends! Active Noise Cancellation, 30H Playtime, Hi-Res Audio. #AudioGear #NovaTech',
    ocrText: 'FLASH SALE 50% OFF! LIMITED TIME DEAL 02:45:38 Hours Mins Secs AURA SHOP NOW ACTIVE NOISE CANCELLATION 30H PLAYTIME HI-RES AUDIO',
    ocrConfidence: 97.9,
    status: 'action_required',
    initialFindings: [
      {
        id: 'finding-nt-008',
        ruleId: 'NT-008',
        ruleTitle: 'Missing Pricing Asterisk / Disclaimer',
        matchedText: '50% OFF!',
        severity: 'warning',
        source: 'both',
        ruleSource: 'FTC Guides Against Deceptive Pricing 16 CFR §233.1',
        explanation: 'Flash sale countdowns and discount percentages require clear disclosure of promotional window and terms.',
        suggestedCorrection: '*Discount applies to MSRP. Limited stock available.',
        status: 'open',
        bbox: { top: 32.0, left: 38.0, width: 14.0, height: 14.0 }
      },
      {
        id: 'finding-nt-015',
        ruleId: 'NT-015',
        ruleTitle: 'Battery Life Claims Substantiation',
        matchedText: '30H PLAYTIME',
        severity: 'advisory',
        source: 'ocr',
        ruleSource: 'IEEE Battery Benchmark Standard 1625',
        explanation: 'Battery life performance metrics must include volume level test parameters (*tested at 50% volume with ANC disabled).',
        suggestedCorrection: 'Up to 30h playtime at 50% volume',
        status: 'open',
        bbox: { top: 78.5, left: 83.5, width: 6.5, height: 6.0 }
      }
    ]
  }
];

export const INITIAL_REVIEWS: ReviewRecord[] = [
  {
    id: 'rev-9042',
    dossierNumber: 'BRD-9042',
    campaignTitle: 'Harvest & Holiday Feast Catering Push',
    brandId: 'arka',
    brandName: 'Arka Foods',
    channel: 'Instagram Carousel & Print Ad',
    reviewedAt: 'Yesterday, 4:15 PM',
    reviewerName: 'Elena Rostova, JD',
    reviewerRole: 'Senior Brand Counsel, Global Food Group',
    auditId: 'E8F-21-CERT',
    sha256Hash: '4f9ca821d7b3e098a72e8b919318a42b1029c78df18903e4810a99182fe310ad',
    status: 'approved',
    findingsCount: 3,
    clearedCount: 3,
    openCount: 0,
    imageUrl: '/assets/aistudio/screen_d1dae6af.png',
    oldCopy: 'The healthiest feast in the county with zero allergens. Book now!',
    newCopy: 'Gourmet Organic Selections. Prepared in a facility handling tree nuts. Order by Dec 15th.',
    findings: [
      {
        id: 'f-1',
        ruleId: 'AF-014',
        ruleTitle: 'Allergen Advisory Compliance',
        matchedText: 'zero allergens',
        severity: 'critical',
        source: 'caption',
        ruleSource: 'FALCPA Allergen Guidelines',
        explanation: 'Pre-order deadline typography adjusted to 12pt minimum with nut allergen footnote confirmed.',
        status: 'applied'
      },
      {
        id: 'f-2',
        ruleId: 'AF-022',
        ruleTitle: 'Pre-Order Cutoff Disclosure',
        matchedText: 'Book now',
        severity: 'warning',
        source: 'both',
        ruleSource: 'Arka Operations SLA-2024',
        explanation: 'Dec 15 cutoff date synchronized with POS terms.',
        status: 'applied'
      }
    ],
    notes: 'Approved without objections. Cryptographic attestation filed with corporate counsel.'
  },
  {
    id: 'rev-8991',
    dossierNumber: 'BRD-8991',
    campaignTitle: 'Titanium Cyber Flash Sale 50% Off',
    brandId: 'novatech',
    brandName: 'NovaTech Solutions',
    channel: 'Paid Social & Display Banner',
    reviewedAt: 'Oct 24, 2024, 11:20 AM',
    reviewerName: 'VP Brand Ops (Override)',
    reviewerRole: 'Brand Operations Executive',
    auditId: 'NT-8991-WAIVER',
    sha256Hash: '8b3c1099eac89271a5b810938ff716029381cbb4719280ab9102837465910293',
    status: 'conditional',
    findingsCount: 2,
    clearedCount: 1,
    openCount: 1,
    imageUrl: '/assets/aistudio/screen_4c96d80f.png',
    oldCopy: 'Flash Sale 50% Off! Unlimited supply. Shop now.',
    newCopy: 'Flash Sale 50% Off! *Discount applies to MSRP. Limited stock available.',
    findings: [
      {
        id: 'f-3',
        ruleId: 'NT-008',
        ruleTitle: 'Pricing Asterisk Limitation',
        matchedText: '50% Off',
        severity: 'warning',
        source: 'both',
        ruleSource: 'FTC Guides §233.1',
        explanation: 'Countdown badge duration claim is restricted to 48-hour live window. Legal indemnification form on file.',
        status: 'manual_reviewed',
        dismissNote: 'Waived by VP Brand Ops with signed 48h expiration agreement.'
      }
    ],
    notes: 'Conditional sign-off granted for 48 hours only.'
  },
  {
    id: 'rev-8920',
    dossierNumber: 'BRD-8920',
    campaignTitle: 'Immunity Miracle Elixir Series',
    brandId: 'freshbites',
    brandName: 'FreshBites Organic',
    channel: 'TikTok Video Campaign',
    reviewedAt: 'Oct 22, 2024, 2:40 PM',
    reviewerName: 'Marcus Vance',
    reviewerRole: 'Regulatory Compliance Officer',
    auditId: 'FB-8920-REJ',
    sha256Hash: '93a001928374bb291a0c89172635418290384756192039485710293847561029',
    status: 'rejected',
    findingsCount: 3,
    clearedCount: 1,
    openCount: 2,
    imageUrl: '/assets/aistudio/screen_81b71146.png',
    oldCopy: 'Guaranteed complete cold defense in 24 hours. The miracle cure.',
    findings: [
      {
        id: 'f-4',
        ruleId: 'FB-012',
        ruleTitle: 'Medical Cure Claim',
        matchedText: 'miracle cure',
        severity: 'critical',
        source: 'caption',
        ruleSource: 'FDA 21 CFR §101.93',
        explanation: 'Unsubstantiated medical claims detected in hero typography: "Guaranteed complete cold defense in 24 hours". Breach of FTC Health Claims Policy §4.1.',
        status: 'open'
      }
    ],
    notes: 'Rejected. Agency must revise creative headline and resubmit proof.'
  }
];

export const APPROVED_CLAIMS = [
  {
    id: 'claim-1',
    title: 'Non-GMO Project Verified',
    details: 'Certificate #88219 • Expiration Oct 2026',
    status: 'Unrestricted',
    brandId: 'freshbites'
  },
  {
    id: 'claim-2',
    title: 'Zero Added Sugars',
    details: 'Lab Assay QA-304 • Valid on all SKU sizes',
    status: 'Unrestricted',
    brandId: 'freshbites'
  },
  {
    id: 'claim-3',
    title: 'Cold-Pressed Within 4 Hours of Harvest',
    details: 'Logistics SLA-2023 • Fresh Line only',
    status: 'Requires Batch ID',
    brandId: 'freshbites'
  },
  {
    id: 'claim-4',
    title: 'Certified Farm-to-Table Organic',
    details: 'USDA Accredited Cert #AG-9912 • Annual Audit Passed',
    status: 'Unrestricted',
    brandId: 'arka'
  },
  {
    id: 'claim-5',
    title: 'Bluetooth 5.3 Low-Latency Certified',
    details: 'SIG Declaration D059124 • Firmware 2.4+',
    status: 'Unrestricted',
    brandId: 'novatech'
  }
];
