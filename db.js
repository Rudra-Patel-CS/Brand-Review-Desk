/* Brand Review Desk - Database Connector & Collection Management
   Manages collections for rulesets, rules, drafts, reviews, brands, and audit logs.
*/

const dns = require('node:dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}

const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME || "Brand_Review_Desk";

let client = null;
let db = null;
let isConnected = false;
let lastError = null;

// Comprehensive Brand Ruleset for seeding
const defaultRuleset = {
  brand: "Arka Foods (demo)",
  rulesetName: "Arka Foods Brand Compliance Guidelines",
  version: "v3.2",
  note: "Official brand compliance ruleset governing advertising claims, tone of voice, terminology, and legal requirements.",
  isDefault: true,
  isDemo: true,
  approvedFacts: [
    {
      id: "FACT-04",
      text: "Gujarat ka apna snacks brand, 2018 se",
      source: { doc: "Arka Brand Book", version: "v3", quote: "Approved non-comparative positioning line: 'Gujarat ka apna snacks brand, 2018 se'." }
    },
    {
      id: "FACT-05",
      text: "Made with 100% natural spices sourced directly from local farmers",
      source: { doc: "Arka Quality Standards", version: "v2", quote: "Standard: 'Made with 100% natural spices sourced directly from local farmers'." }
    }
  ],
  rules: [
    {
      id: "FACT-01",
      name: "Unsubstantiated Superiority Claim",
      category: "Claims & Evidence",
      type: "claim",
      severity: "high",
      patterns: ["\\bno\\.?\\s*1\\b", "\\bnumber\\s+one\\b", "\\bbest\\b", "\\bbiggest\\b", "\\bleading\\b", "\\bmost\\s+trusted\\b", "\\bsabse\\s+bada\\b", "\\bsabse\\b", "#1"],
      regex: true,
      why: "Brand rule FACT-01 requires any 'No.1', 'Best', or superiority claim to carry an audited, documented source on file before publication.",
      suggestion: { kind: "replace", text: "Gujarat ka apna snacks brand, 2018 se", note: "Approved non-comparative fact FACT-04." },
      source: { doc: "Arka Brand Book", version: "v3", quote: "Superiority claims (No.1, best, biggest, leading) must carry an approved evidence source on file." },
      enabled: true
    },
    {
      id: "TONE-04",
      name: "Tone Mismatch / Hype Wording",
      category: "Tone of Voice",
      type: "phrase",
      severity: "medium",
      patterns: ["we're obsessed with", "we are obsessed with", "obsessed", "crazy good", "insanely", "addictive", "insanely crunchy"],
      regex: false,
      why: "Tone rule TONE-04: Arka's voice is warm and family-first. Hype adjectives like 'obsessed', 'insanely', and 'addictive' dilute the authentic heritage tone.",
      suggestion: { kind: "replace", text: "we love", note: "Maintains heartfelt warmth without aggressive marketing hype." },
      source: { doc: "Arka Tone Guide", version: "v3", quote: "Avoid hype wording (obsessed, addictive, insanely). Prefer warm, family-first language." },
      enabled: true
    },
    {
      id: "TERM-02",
      name: "Retired Terminology",
      category: "Approved Terminology",
      type: "phrase",
      severity: "low",
      patterns: ["vegan-friendly", "vegan friendly"],
      regex: false,
      why: "Terminology rule TERM-02: 'plant-based' is the approved current customer-facing standard. 'Vegan-friendly' is retired wording.",
      suggestion: { kind: "replace", text: "plant-based", note: "Approved standard term per TERM-02." },
      source: { doc: "Arka Terminology List", version: "v3", quote: "Say 'plant-based', not 'vegan-friendly'." },
      enabled: true
    },
    {
      id: "LEGAL-01",
      name: "Guaranteed Delivery Disclaimer",
      category: "Legal & Compliance",
      type: "phrase",
      severity: "high",
      patterns: ["guaranteed delivery", "100% guaranteed delivery", "guaranteed diwali delivery"],
      regex: false,
      why: "Legal rule LEGAL-01: Absolute delivery guarantees create strict commercial liability. Must state target delivery subject to courier SLAs.",
      suggestion: { kind: "replace", text: "estimated festive delivery (courier SLAs apply)", note: "Compliant wording per legal handbook." },
      source: { doc: "Arka Legal Handbook", version: "v2", quote: "Do not promise unqualified delivery guarantees in advertising." },
      enabled: true
    },
    {
      id: "LEGAL-02",
      name: "Unqualified Money Back Guarantee",
      category: "Legal & Compliance",
      type: "phrase",
      severity: "high",
      patterns: ["100% money back guaranteed", "money back guaranteed", "money back guarantee"],
      regex: false,
      why: "Legal rule LEGAL-02: Food products cannot advertise unqualified money-back guarantees without specific terms regarding product return conditions.",
      suggestion: { kind: "replace", text: "satisfaction guaranteed per terms", note: "Qualified refund policy statement." },
      source: { doc: "Arka Legal Handbook", version: "v2", quote: "Money-back guarantees must refer to clear invoice terms." },
      enabled: true
    },
    {
      id: "PRICE-01",
      name: "Promotional & Free Gift Transparency",
      category: "Pricing & Offers",
      type: "phrase",
      severity: "medium",
      patterns: ["free gift", "100% free gift", "free without conditions", "100% free"],
      regex: false,
      why: "Pricing rule PRICE-01: Promotional 'free gift' statements must state minimum order criteria or qualifying box types.",
      suggestion: { kind: "replace", text: "complimentary gift with select festive boxes", note: "Compliant promotional description." },
      source: { doc: "Arka Promotions Guide", version: "v1.4", quote: "All promotional claims must clearly specify qualifying cart conditions." },
      enabled: true
    },
    {
      id: "TECH-01",
      name: "Absolute Zero-Downtime Guarantee",
      category: "Technical & SLA",
      type: "phrase",
      severity: "high",
      patterns: ["zero downtime guaranteed", "zero downtime guaranteed 100%"],
      regex: false,
      why: "Technical rule TECH-01: Absolute zero-downtime claims violate SLA policies; state 99.99% high availability instead.",
      suggestion: { kind: "replace", text: "99.99% high-availability SLA", note: "Standard enterprise cloud SLA standard." },
      source: { doc: "Enterprise Cloud SLA Policy", version: "v4", quote: "Advertise high-availability percentages, never absolute zero downtime." },
      enabled: true
    },
    {
      id: "COMP-01",
      name: "Unsubstantiated Comparative Pricing",
      category: "Competitive Claims",
      type: "phrase",
      severity: "medium",
      patterns: ["cheapest cloud storage", "cheapest in asia", "cheapest"],
      regex: false,
      why: "Competitive rule COMP-01: Price superiority claims ('cheapest') require third-party benchmark disclosures.",
      suggestion: { kind: "replace", text: "cost-optimized enterprise tier", note: "Compliant pricing tier description." },
      source: { doc: "Enterprise Compliance Code", version: "v2", quote: "Comparative pricing claims must cite published third-party audits." },
      enabled: true
    },
    {
      id: "HEALTH-01",
      name: "Curative / Medical Disease Claim",
      category: "Health & Nutrition",
      type: "phrase",
      severity: "high",
      patterns: ["100% cure for daily fatigue", "100% cure", "cure for fatigue", "permanently boosts immunity", "cure"],
      regex: false,
      why: "Health rule HEALTH-01: Food and juice products cannot claim to cure medical conditions or diseases under FSSAI / advertising standards.",
      suggestion: { kind: "replace", text: "nourishing blend supporting daily wellness", note: "Compliant wellness positioning." },
      source: { doc: "Food Advertising Guidelines", version: "v3", quote: "Food products must not claim therapeutic or curative disease benefits." },
      enabled: true
    }
  ]
};

// Multi-brand catalog
const defaultBrands = [
  {
    name: "Arka Foods (demo)",
    industry: "FMCG / Packaged Foods",
    description: "Traditional sweets, namkeen, and festive gift boxes.",
    rulesCount: 6,
    createdAt: new Date()
  },
  {
    name: "NovaTech Solutions",
    industry: "Enterprise Cloud & AI",
    description: "Cloud computing, storage infrastructure, and SLA-backed services.",
    rulesCount: 3,
    createdAt: new Date()
  },
  {
    name: "FreshBites Organic",
    industry: "Health Beverages & Superfoods",
    description: "Cold-pressed juices, organic wellness drinks, and pantry staples.",
    rulesCount: 4,
    createdAt: new Date()
  }
];

// In-memory fallback

// ---------- USER COLLECTION ----------
async function createUser(username, passwordHash) {
  const usersColl = db.collection('users');
  return await usersColl.insertOne({ username, passwordHash });
}
async function findUser(username) {
  const usersColl = db.collection('users');
  return await usersColl.findOne({ username });
}

// Export user helpers
module.exports.createUser = createUser;
module.exports.findUser = findUser;

// Existing in-memory fallback continues below
const memoryStore = {
  rulesets: [JSON.parse(JSON.stringify(defaultRuleset))],
  brands: JSON.parse(JSON.stringify(defaultBrands)),
  drafts: [],
  reviews: [
    {
      reviewId: "REV-20261106-001",
      contentName: "arka-diwali-poster-v2.png",
      brand: "Arka Foods (demo)",
      rulesetName: "Arka Foods Brand Compliance Guidelines",
      rulesVersion: "v3.2",
      timestamp: new Date(Date.now() - 3600000),
      formattedDate: new Date(Date.now() - 3600000).toLocaleString("en-IN"),
      decisions: [
        {
          decision: "applied",
          ruleId: "TONE-04",
          name: "Tone Mismatch / Hype Wording",
          matched: "we're obsessed with",
          sourceType: "caption",
          suggestionText: "we love",
          reason: null,
          sourceRef: { doc: "Arka Tone Guide", version: "v3", quote: "Avoid hype wording (obsessed, addictive, insanely)." }
        },
        {
          decision: "applied",
          ruleId: "TERM-02",
          name: "Retired Terminology",
          matched: "vegan-friendly",
          sourceType: "caption",
          suggestionText: "plant-based",
          reason: null,
          sourceRef: { doc: "Arka Terminology List", version: "v3", quote: "Say 'plant-based', not 'vegan-friendly'." }
        },
        {
          decision: "copy-change",
          ruleId: "FACT-01",
          name: "Unsubstantiated Superiority Claim",
          matched: "No. 1 Sweets",
          sourceType: "creative",
          suggestionText: "Gujarat ka apna snacks brand, 2018 se",
          reason: null,
          sourceRef: { doc: "Arka Brand Book", version: "v3", quote: "Superiority claims must carry approved evidence." }
        }
      ],
      decisionsCount: 3,
      appliedCount: 2,
      dismissedCount: 0,
      copyChangesCount: 1,
      copyChanges: [{ from: "No. 1 Sweets", to: "Gujarat ka apna snacks brand, 2018 se" }],
      finalCaption: "This festive season, we love bringing your family together over sweets that taste like home. Six handmade mithai classics, plant-based options included. Order before 18 October for guaranteed Diwali delivery.",
      status: "approved"
    }
  ],
  audit_logs: []
};

async function connectDB() {
  if (isConnected && db) return db;

  try {
    if (!MONGO_URI) throw new Error('MONGO_URI is not configured');
    client = new MongoClient(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000
    });
    await client.connect();
    db = client.db(DB_NAME);
    isConnected = true;
    lastError = null;
    console.log(`Connected to database: "${DB_NAME}"`);

    await initDatabaseTables(db);
    return db;
  } catch (err) {
    isConnected = false;
    lastError = err.message;
    console.warn(`Database connection note: ${err.message}. Running resilient sync storage.`);
    return null;
  }
}

async function initDatabaseTables(database) {
  try {
    const collections = await database.listCollections().toArray();
    const colNames = collections.map(c => c.name);

    // 1. Table: rulesets
    if (!colNames.includes('rulesets')) {
      await database.createCollection('rulesets');
    }
    const rulesetCount = await database.collection('rulesets').countDocuments();
    if (rulesetCount === 0) {
      await database.collection('rulesets').insertOne({
        ...defaultRuleset,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    // 2. Table: rules
    if (!colNames.includes('rules')) {
      await database.createCollection('rules');
    }
    const ruleCount = await database.collection('rules').countDocuments();
    if (ruleCount === 0) {
      const normalizedRules = defaultRuleset.rules.map(r => ({
        ...r,
        brand: defaultRuleset.brand,
        rulesetName: defaultRuleset.rulesetName,
        createdAt: new Date()
      }));
      await database.collection('rules').insertMany(normalizedRules.map(rule => ({ ...rule, isDemo: true })));
    }

    // 3. Table: brands
    if (!colNames.includes('brands')) {
      await database.createCollection('brands');
    }
    const brandCount = await database.collection('brands').countDocuments();
    if (brandCount === 0) {
      await database.collection('brands').insertMany(defaultBrands.map(brand => ({ ...brand, isDemo: true })));
    }

    // 4. Table: drafts
    if (!colNames.includes('drafts')) {
      await database.createCollection('drafts');
    }

    // 5. Table: reviews
    if (!colNames.includes('reviews')) {
      await database.createCollection('reviews');
    }
    const reviewCount = await database.collection('reviews').countDocuments();
    if (reviewCount === 0 && memoryStore.reviews.length > 0) {
      await database.collection('reviews').insertMany(memoryStore.reviews.map(review => ({ ...review, isDemo: true })));
    }

    // 6. Table: audit_logs
    if (!colNames.includes('audit_logs')) {
      await database.createCollection('audit_logs');
    }
  } catch (err) {
    console.error('Table initialization note:', err.message);
  }
}

async function getStatus() {
  const currentDb = await connectDB();
  if (currentDb && isConnected) {
    try {
      const cols = await currentDb.listCollections().toArray();
      const stats = {};
      for (const c of cols) {
        stats[c.name] = await currentDb.collection(c.name).countDocuments();
      }
      return {
        connected: true,
        database: DB_NAME,
        provider: "Enterprise Cloud Database",
        collections: stats,
        activeRules: stats.rules || defaultRuleset.rules.length,
        reviewsCount: stats.reviews || 0,
        error: null
      };
    } catch (e) {
      return { connected: false, error: e.message, fallback: true };
    }
  }
  return {
    connected: false,
    database: DB_NAME,
    provider: "Secure Synchronized Storage",
    collections: {
      rulesets: memoryStore.rulesets.length,
      brands: memoryStore.brands.length,
      reviews: memoryStore.reviews.length,
      drafts: memoryStore.drafts.length,
      rules: defaultRuleset.rules.length
    },
    activeRules: (memoryStore.rulesets[0]?.rules || defaultRuleset.rules).length,
    reviewsCount: memoryStore.reviews.length,
    error: lastError
  };
}

async function getActiveRuleset(brandName) {
  const currentDb = await connectDB();
  if (currentDb && isConnected) {
    const query = brandName ? { brand: new RegExp(`^${brandName}`, 'i') } : { isDefault: true };
    const rs = await currentDb.collection('rulesets').findOne(query);
    if (rs) return rs;
    return await currentDb.collection('rulesets').findOne({}) || defaultRuleset;
  }
  if (brandName) {
    const found = memoryStore.rulesets.find(r => r.brand.toLowerCase().includes(brandName.toLowerCase()));
    if (found) return found;
  }
  return memoryStore.rulesets[0] || defaultRuleset;
}

async function saveRuleset(ruleset) {
  ruleset.updatedAt = new Date();
  const currentDb = await connectDB();
  if (currentDb && isConnected) {
    if (ruleset._id) {
      const id = typeof ruleset._id === 'string' ? new ObjectId(ruleset._id) : ruleset._id;
      delete ruleset._id;
      await currentDb.collection('rulesets').updateOne({ _id: id }, { $set: ruleset }, { upsert: true });
    } else {
      await currentDb.collection('rulesets').updateOne(
        { brand: ruleset.brand },
        { $set: ruleset },
        { upsert: true }
      );
    }
    if (ruleset.rules && Array.isArray(ruleset.rules)) {
      await currentDb.collection('rules').deleteMany({ brand: ruleset.brand });
      const normalized = ruleset.rules.map(r => ({
        ...r,
        brand: ruleset.brand,
        rulesetName: ruleset.rulesetName,
        createdAt: new Date()
      }));
      if (normalized.length) await currentDb.collection('rules').insertMany(normalized);
    }
    return ruleset;
  }

  const idx = memoryStore.rulesets.findIndex(r => r.brand === ruleset.brand);
  if (idx >= 0) memoryStore.rulesets[idx] = ruleset;
  else memoryStore.rulesets.push(ruleset);
  return ruleset;
}

async function resetRuleset() {
  const resetCopy = JSON.parse(JSON.stringify(defaultRuleset));
  resetCopy.updatedAt = new Date();
  const currentDb = await connectDB();
  if (currentDb && isConnected) {
    await currentDb.collection('rulesets').deleteMany({ brand: resetCopy.brand });
    await currentDb.collection('rulesets').insertOne(resetCopy);
    await currentDb.collection('rules').deleteMany({ brand: resetCopy.brand });
    await currentDb.collection('rules').insertMany(resetCopy.rules.map(r => ({ ...r, brand: resetCopy.brand })));
    return resetCopy;
  }
  memoryStore.rulesets = [resetCopy];
  return resetCopy;
}

async function getReviews(limit = 50) {
  const currentDb = await connectDB();
  if (currentDb && isConnected) {
    return await currentDb.collection('reviews').find({}).sort({ timestamp: -1 }).limit(limit).toArray();
  }
  return memoryStore.reviews.slice(0, limit);
}

async function addReview(reviewData) {
  const review = {
    ...reviewData,
    timestamp: reviewData.timestamp ? new Date(reviewData.timestamp) : new Date(),
    formattedDate: new Date().toLocaleString("en-IN"),
    createdAt: new Date()
  };

  const currentDb = await connectDB();
  if (currentDb && isConnected) {
    const result = await currentDb.collection('reviews').insertOne(review);
    review._id = result.insertedId;
    return review;
  }

  memoryStore.reviews.unshift(review);
  return review;
}

async function deleteReview(id) {
  const currentDb = await connectDB();
  if (currentDb && isConnected) {
    try {
      const objId = new ObjectId(id);
      return await currentDb.collection('reviews').deleteOne({ _id: objId });
    } catch (e) {
      return await currentDb.collection('reviews').deleteOne({ reviewId: id });
    }
  }
  memoryStore.reviews = memoryStore.reviews.filter(r => r.reviewId !== id && String(r._id) !== id);
  return { deleted: true };
}

async function getLatestDraft() {
  const currentDb = await connectDB();
  if (currentDb && isConnected) {
    return await currentDb.collection('drafts').findOne({}, { sort: { updatedAt: -1 } });
  }
  return memoryStore.drafts[0] || null;
}

async function saveDraft(draft) {
  draft.updatedAt = new Date();
  const currentDb = await connectDB();
  if (currentDb && isConnected) {
    await currentDb.collection('drafts').deleteMany({});
    const res = await currentDb.collection('drafts').insertOne(draft);
    draft._id = res.insertedId;
    return draft;
  }
  memoryStore.drafts = [draft];
  return draft;
}

async function getBrands() {
  const currentDb = await connectDB();
  if (currentDb && isConnected) {
    return await currentDb.collection('brands').find({}).toArray();
  }
  return memoryStore.brands;
}

function normalizeBrand(record) {
  const { _id, ...plainRecord } = record;
  const name = record.name || record.brandName || record.brand || 'Unknown brand';
  const rawId = String(record.id || record.brandId || name)
    .toLowerCase()
    .replace(/\s*\(demo\)/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const normalizedId = rawId.includes('freshbites') ? 'freshbites'
    : rawId.includes('arka') ? 'arka'
      : rawId.includes('novatech') ? 'novatech'
        : rawId;
  return {
    ...plainRecord,
    id: normalizedId,
    name,
    category: record.category || record.industry || '',
    rulebookVersion: record.rulebookVersion || record.rulesetName || 'Unversioned',
    activeRulesCount: record.activeRulesCount || record.rulesCount || 0,
    approvedClaimsCount: record.approvedClaimsCount || 0,
    isDemo: Boolean(
      record.isDemo ||
      name.includes('(demo)') ||
      record.approvedClaimsCount > 0 ||
      /Master Rulebook v4\.1|Quality Codex v2\.8|Commercial Compliance v3\.0/.test(record.rulebookVersion || '') ||
      (name === 'FreshBites Organic' && record.industry === 'Health Beverages & Superfoods') ||
      (name === 'NovaTech Solutions' && record.industry === 'Enterprise Cloud & AI')
    )
  };
}

const sampleRuleIds = new Set(['FB-012', 'FB-004', 'FB-028', 'FB-019', 'FB-031', 'AF-001', 'AF-014', 'AF-022', 'NT-001', 'NT-008', 'NT-015', 'FACT-01', 'TONE-04', 'TERM-02', 'LEGAL-01', 'LEGAL-02', 'PRICE-01', 'TECH-01', 'COMP-01', 'HEALTH-01']);

function normalizeWorkspaceRule(record) {
  const { _id, ...plainRecord } = record;
  const escapePattern = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = record.pattern || (Array.isArray(record.patterns)
    ? record.patterns.map(value => record.regex ? String(value) : escapePattern(value)).join('|')
    : '');
  const source = typeof record.source === 'string'
    ? record.source
    : record.source?.doc || record.source?.quote || '';
  const rawSeverity = String(record.severity || 'advisory').toLowerCase();
  const severity = ['critical', 'high'].includes(rawSeverity) ? 'critical'
    : ['warning', 'medium', 'moderate'].includes(rawSeverity) ? 'warning'
      : 'advisory';
  const rawCategory = String(record.category || '').toLowerCase();
  const category = /health|claim|nutrition/.test(rawCategory) ? 'health'
    : /trademark|brand|logo/.test(rawCategory) ? 'trademark'
      : /disclaimer|legal|allergen|sla/.test(rawCategory) ? 'disclaimers'
        : /pricing|offer|promo|competitive/.test(rawCategory) ? 'pricing'
          : 'general';
  return {
    ...plainRecord,
    id: String(record.id || record.ruleId || ''),
    brand: normalizeBrand({ name: record.brand || record.brandId || 'global' }).id,
    title: record.title || record.name || 'Untitled rule',
    category,
    severity,
    pattern,
    flags: record.flags || (record.regex ? 'i' : ''),
    source,
    explanation: record.explanation || record.why || '',
    suggestedRemedy: record.suggestedRemedy || record.suggestion?.text || record.suggestion || undefined,
    enabled: record.enabled !== false,
    appliesTo: record.appliesTo || (record.sourceType === 'caption' ? ['caption'] : record.sourceType === 'creative' ? ['ocr'] : ['caption', 'ocr']),
    isDemo: Boolean(record.isDemo || String(record.brand || '').includes('(demo)') || sampleRuleIds.has(String(record.id || record.ruleId || '')))
  };
}

function normalizeWorkspaceCampaign(record) {
  const { _id, ...plainRecord } = record;
  const imageUrl = String(record.imageUrl || record.image || '');
  return {
    ...plainRecord,
    id: String(record.id || record.campaignId || record._id || ''),
    code: record.code || record.campaignCode || String(record.id || 'REFERENCE'),
    title: record.title || record.name || record.contentName || 'Untitled campaign',
    brandId: normalizeBrand({ name: record.brandId || record.brandName || record.brand || 'global' }).id,
    brandName: record.brandName || record.brand || 'Unassigned',
    channel: record.channel || 'Unspecified',
    format: record.format || 'Image',
    aspectRatio: record.aspectRatio || '4/3',
    imageUrl: imageUrl.replace(/^\/assets\/screen_/, '/assets/aistudio/screen_'),
    caption: record.caption || '',
    ocrText: record.ocrText || '',
    ocrConfidence: Number(record.ocrConfidence || 0),
    initialFindings: Array.isArray(record.initialFindings) ? record.initialFindings : [],
    status: record.status || 'action_required',
    sourceName: record.sourceName || '',
    sourceUrl: record.sourceUrl || '',
    licenseName: record.licenseName || '',
    licenseUrl: record.licenseUrl || '',
    attribution: record.attribution || '',
    sourceDescription: record.sourceDescription || '',
    isDemo: Boolean(record.isDemo || String(record.id || '').startsWith('preset-')),
    referenceOnly: Boolean(record.referenceOnly),
    updatedAt: record.updatedAt || record.createdAt || null
  };
}

function normalizeWorkspaceReview(record) {
  const { _id, ...plainRecord } = record;
  if (!record.campaignTitle && record.contentName) {
    return {
      ...plainRecord,
      id: String(record.reviewId || record._id),
      dossierNumber: String(record.reviewId || record._id),
      campaignTitle: record.contentName,
      brandId: normalizeBrand({ name: record.brand || 'global' }).id,
      brandName: record.brand || 'Unassigned',
      channel: record.channel || 'Unspecified',
      reviewedAt: record.formattedDate || record.timestamp || '',
      reviewerName: record.reviewerName || 'Unassigned reviewer',
      reviewerRole: record.reviewerRole || '',
      auditId: record.auditId || '',
      sha256Hash: '',
      status: record.status || 'approved',
      findingsCount: record.findingsCount || record.decisionsCount || 0,
      clearedCount: record.clearedCount || record.appliedCount || 0,
      openCount: record.openCount || 0,
      imageUrl: record.imageUrl || '',
      findings: record.findings || [],
      isDemo: Boolean(record.isDemo || record.reviewId === 'REV-20261106-001' || String(record.contentName || '').includes('diwali-poster-v2'))
    };
  }
  return {
    ...plainRecord,
    id: String(record.id || record._id || ''),
    dossierNumber: record.dossierNumber || record.reviewId || String(record.id || record._id || ''),
    campaignTitle: record.campaignTitle || record.contentName || 'Untitled review',
    brandId: normalizeBrand({ name: record.brandId || record.brandName || record.brand || 'global' }).id,
    brandName: record.brandName || record.brand || 'Unassigned',
    channel: record.channel || 'Unspecified',
    reviewedAt: record.reviewedAt || record.formattedDate || record.timestamp || '',
    imageUrl: String(record.imageUrl || ''),
    reviewerName: record.reviewerName || 'Reviewer not recorded',
    reviewerRole: record.reviewerRole || '',
    sha256Hash: record.sha256Hash || '',
    auditId: record.auditId || '',
    findings: Array.isArray(record.findings) ? record.findings : [],
    findingsCount: Number(record.findingsCount || record.decisionsCount || 0),
    clearedCount: Number(record.clearedCount || record.appliedCount || 0),
    openCount: Number(record.openCount || 0),
    status: record.status || 'conditional',
    isDemo: Boolean(record.isDemo || String(record.id || '').startsWith('rev-2026-'))
  };
}

async function getWorkspaceSnapshot() {
  const database = await connectDB();
  if (!database || !isConnected) throw new Error(lastError || 'MongoDB is not connected');
  const [brandRows, ruleRows, campaignRows, reviewRows] = await Promise.all([
    database.collection('brands').find({}).toArray(),
    database.collection('rules').find({}).toArray(),
    database.collection('campaigns').find({}).sort({ updatedAt: -1, createdAt: -1 }).toArray(),
    database.collection('reviews').find({}).sort({ timestamp: -1, createdAt: -1 }).limit(500).toArray()
  ]);
  const brands = brandRows.map(normalizeBrand);
  const rules = ruleRows.map(normalizeWorkspaceRule).filter(rule => rule.id && rule.pattern);
  const campaigns = campaignRows.map(normalizeWorkspaceCampaign);
  const reviews = reviewRows.map(normalizeWorkspaceReview);
  return {
    connected: true,
    database: DB_NAME,
    updatedAt: new Date().toISOString(),
    brands,
    rules,
    campaigns,
    reviews
  };
}

async function saveWorkspaceRule(rule) {
  const database = await connectDB();
  if (!database || !isConnected) throw new Error(lastError || 'MongoDB is not connected');
  const { _id, createdAt, ...ruleFields } = rule;
  const value = { ...ruleFields, updatedAt: new Date() };
  const storedBrandNames = {
    freshbites: ['freshbites', 'FreshBites Organic', 'FreshBites Organic (demo)'],
    arka: ['arka', 'Arka Foods', 'Arka Foods (demo)'],
    novatech: ['novatech', 'NovaTech Solutions'],
    global: ['global']
  }[rule.brand] || [rule.brand];
  await database.collection('rules').updateOne(
    { id: String(rule.id), brand: { $in: storedBrandNames } },
    { $set: value, $setOnInsert: { createdAt: createdAt ? new Date(createdAt) : new Date() } },
    { upsert: true }
  );
  return database.collection('rules').findOne({ id: String(rule.id), brand: rule.brand });
}

async function deleteWorkspaceRule(id, brand) {
  const database = await connectDB();
  if (!database || !isConnected) throw new Error(lastError || 'MongoDB is not connected');
  const storedBrandNames = {
    freshbites: ['freshbites', 'FreshBites Organic', 'FreshBites Organic (demo)'],
    arka: ['arka', 'Arka Foods', 'Arka Foods (demo)'],
    novatech: ['novatech', 'NovaTech Solutions'],
    global: ['global']
  }[brand] || [brand];
  return database.collection('rules').deleteOne({ id: String(id), brand: { $in: storedBrandNames } });
}

async function saveWorkspaceCampaign(campaign) {
  const database = await connectDB();
  if (!database || !isConnected) throw new Error(lastError || 'MongoDB is not connected');
  const { _id, createdAt, ...campaignFields } = campaign;
  const value = { ...campaignFields, updatedAt: new Date() };
  await database.collection('campaigns').updateOne(
    { id: String(campaign.id) },
    { $set: value, $setOnInsert: { createdAt: createdAt ? new Date(createdAt) : new Date() } },
    { upsert: true }
  );
  return database.collection('campaigns').findOne({ id: String(campaign.id) });
}

async function addWorkspaceReview(review) {
  const database = await connectDB();
  if (!database || !isConnected) throw new Error(lastError || 'MongoDB is not connected');
  const value = { ...review, id: String(review.id || `review-${Date.now()}`), timestamp: new Date(), createdAt: new Date() };
  await database.collection('reviews').insertOne(value);
  return value;
}

async function getInsights() {
  const reviews = await getReviews(100);
  const ruleset = await getActiveRuleset();

  const ruleStats = {};
  const categoryStats = {};
  let totalDecisions = 0;
  let totalApplied = 0;
  let totalDismissed = 0;
  let totalCopyChanges = 0;

  reviews.forEach(r => {
    totalApplied += r.appliedCount || 0;
    totalDismissed += r.dismissedCount || 0;
    totalCopyChanges += r.copyChangesCount || 0;

    (r.decisions || []).forEach(d => {
      totalDecisions++;
      const rid = d.ruleId || 'OTHER';
      ruleStats[rid] = (ruleStats[rid] || 0) + 1;
    });
  });

  (ruleset.rules || []).forEach(r => {
    categoryStats[r.category] = (categoryStats[r.category] || 0) + (ruleStats[r.id] || 0);
  });

  const topFlagged = Object.keys(ruleStats).map(k => ({
    ruleId: k,
    count: ruleStats[k],
    ruleName: (ruleset.rules || []).find(r => r.id === k)?.name || k
  })).sort((a, b) => b.count - a.count);

  return {
    totalReviews: reviews.length,
    totalDecisions,
    totalApplied,
    totalDismissed,
    totalCopyChanges,
    approvalRate: reviews.length ? Math.round((reviews.filter(r => r.status === 'approved').length / reviews.length) * 100) : 100,
    topFlagged,
    categoryBreakdown: categoryStats,
    rulesCount: (ruleset.rules || []).length
  };
}

module.exports = {
  connectDB,
  getStatus,
  getActiveRuleset,
  saveRuleset,
  resetRuleset,
  getReviews,
  addReview,
  deleteReview,
  getLatestDraft,
  saveDraft,
  getBrands,
  getWorkspaceSnapshot,
  saveWorkspaceRule,
  deleteWorkspaceRule,
  saveWorkspaceCampaign,
  addWorkspaceReview,
  getInsights,
  defaultRuleset
};
