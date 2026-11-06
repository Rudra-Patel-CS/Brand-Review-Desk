/* Brand Review Desk - MongoDB Database Connector & Collections
   Connects to MongoDB cluster and handles tables/collections for:
   - rulesets: Brand rulesets with approved facts & full guidelines
   - rules: Normalized brand rules for fast indexing & toggling
   - drafts: Content drafts (image posters, captions, OCR results)
   - reviews: Full audit trail of approved reviews with decisions & reports
   - brands: Brand profiles supported on the desk
   - analytics: Aggregate statistics for Round 3 insights
*/

const dns = require('node:dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}

const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://db_test:password%402177@project-1.xzfwn9j.mongodb.net/Brand_Review_Desk?retryWrites=true&w=majority&appName=project-1";
const DB_NAME = process.env.DB_NAME || "Brand_Review_Desk";

let client = null;
let db = null;
let isConnected = false;
let lastError = null;

// Default Arka Foods Brand Ruleset for seeding
const defaultRuleset = {
  brand: "Arka Foods (demo)",
  rulesetName: "Arka Foods Brand Rules",
  version: "v3",
  note: "Official brand ruleset stored in MongoDB Brand_Review_Desk database.",
  isDefault: true,
  approvedFacts: [
    {
      id: "FACT-04",
      text: "Gujarat ka apna snacks brand, 2018 se",
      source: {
        doc: "Arka Brand Book",
        version: "v3",
        quote: "Approved non-comparative positioning line: 'Gujarat ka apna snacks brand, 2018 se'."
      }
    },
    {
      id: "FACT-05",
      text: "Made with 100% natural spices sourced directly from local farmers",
      source: {
        doc: "Arka Brand Book",
        version: "v3",
        quote: "Quality claim standard: 'Made with 100% natural spices sourced directly from local farmers'."
      }
    }
  ],
  rules: [
    {
      id: "FACT-01",
      name: "Unsubstantiated Claim",
      category: "Claims & Evidence",
      type: "claim",
      severity: "high",
      patterns: ["\\bno\\.?\\s*1\\b", "\\bnumber\\s+one\\b", "\\bbest\\b", "\\bbiggest\\b", "\\bleading\\b", "\\bmost\\s+trusted\\b", "\\bsabse\\b", "#1"],
      regex: true,
      why: "Brand rule FACT-01 (Claims & Evidence) requires any 'No.1', 'Best' or similar superiority claim to have an approved, up-to-date source on file.",
      suggestion: { kind: "replace", text: "Gujarat ka apna snacks brand, 2018 se", note: "Approved fact FACT-04, non-comparative." },
      source: { doc: "Arka Brand Book", version: "v3", quote: "Superiority claims (No.1, best, biggest, leading) must carry an approved evidence source on file." },
      enabled: true
    },
    {
      id: "TONE-04",
      name: "Tone Mismatch",
      category: "Tone of Voice",
      type: "phrase",
      severity: "medium",
      patterns: ["we're obsessed with", "we are obsessed with", "obsessed", "crazy good", "insanely", "addictive"],
      regex: false,
      why: "Tone rule TONE-04: Arka's voice is warm and family-first, not hype-driven. Words like 'obsessed' push a hype tone the brand book disallows.",
      suggestion: { kind: "replace", text: "we love", note: "Keeps the writer's intent, stays warm without hype." },
      source: { doc: "Arka Tone Guide", version: "v3", quote: "Avoid hype wording (obsessed, addictive, insanely). Prefer warm, family-first language." },
      enabled: true
    },
    {
      id: "TERM-02",
      name: "Terminology",
      category: "Approved Terminology",
      type: "phrase",
      severity: "low",
      patterns: ["vegan-friendly", "vegan friendly"],
      regex: false,
      why: "Terminology rule TERM-02: the approved customer-facing term is 'plant-based'. 'Vegan-friendly' is retired wording from the 2023 guidelines.",
      suggestion: { kind: "replace", text: "plant-based", note: "Approved term per TERM-02." },
      source: { doc: "Arka Terminology List", version: "v3", quote: "Say 'plant-based', not 'vegan-friendly'." },
      enabled: true
    },
    {
      id: "LEGAL-01",
      name: "Guaranteed Delivery Disclaimer",
      category: "Legal & Compliance",
      type: "phrase",
      severity: "high",
      patterns: ["guaranteed delivery", "100% guaranteed delivery"],
      regex: false,
      why: "Legal rule LEGAL-01: 'Guaranteed delivery' creates binding carrier liability. All festive comms must state 'Target delivery before festival, subject to courier SLAs'.",
      suggestion: { kind: "replace", text: "estimated festive delivery", note: "Legal-approved compliant phrasing." },
      source: { doc: "Arka Legal Handbook", version: "v2", quote: "Do not state absolute delivery guarantees without carrier SLA qualification." },
      enabled: true
    },
    {
      id: "PRICE-01",
      name: "Price Transparency",
      category: "Pricing & Offers",
      type: "phrase",
      severity: "medium",
      patterns: ["free gift", "free delivery without terms", "100% free"],
      regex: false,
      why: "Promotional rule PRICE-01: 'Free' claims must explicitly state terms or minimum order criteria to comply with advertising standards.",
      suggestion: { kind: "replace", text: "complimentary gift with select boxes", note: "Compliant offer description." },
      source: { doc: "Arka Promotions Guide", version: "v1.4", quote: "All promotional claims must clearly specify qualifying cart conditions." },
      enabled: true
    }
  ]
};

// Demo brands for multi-brand support
const defaultBrands = [
  {
    name: "Arka Foods (demo)",
    industry: "FMCG / Packaged Foods",
    description: "Traditional mithai and snacks with authentic recipes.",
    rulesCount: 5,
    createdAt: new Date()
  },
  {
    name: "NovaTech Solutions",
    industry: "B2B Software",
    description: "Enterprise cloud software and automation systems.",
    rulesCount: 3,
    createdAt: new Date()
  }
];

// In-memory fallback if MongoDB Atlas is currently offline or unreachable
const memoryStore = {
  rulesets: [JSON.parse(JSON.stringify(defaultRuleset))],
  brands: JSON.parse(JSON.stringify(defaultBrands)),
  drafts: [],
  reviews: [
    {
      reviewId: "REV-20261106-001",
      contentName: "arka-diwali-poster-v2.png",
      brand: "Arka Foods (demo)",
      rulesetName: "Arka Foods Brand Rules",
      rulesVersion: "v3",
      timestamp: new Date(Date.now() - 3600000),
      formattedDate: new Date(Date.now() - 3600000).toLocaleString("en-IN"),
      decisions: [
        {
          decision: "applied",
          ruleId: "TONE-04",
          name: "Tone Mismatch",
          matched: "we're obsessed with",
          sourceType: "caption",
          suggestionText: "we love",
          reason: null,
          sourceRef: { doc: "Arka Tone Guide", version: "v3", quote: "Avoid hype wording (obsessed, addictive, insanely)." }
        },
        {
          decision: "applied",
          ruleId: "TERM-02",
          name: "Terminology",
          matched: "vegan-friendly",
          sourceType: "caption",
          suggestionText: "plant-based",
          reason: null,
          sourceRef: { doc: "Arka Terminology List", version: "v3", quote: "Say 'plant-based', not 'vegan-friendly'." }
        },
        {
          decision: "copy-change",
          ruleId: "FACT-01",
          name: "Unsubstantiated Claim",
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
    console.log(`Connecting to MongoDB at: ${MONGO_URI.replace(/:[^:]*@/, ':***@')}...`);
    client = new MongoClient(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000
    });
    await client.connect();
    db = client.db(DB_NAME);
    isConnected = true;
    lastError = null;
    console.log(`Successfully connected to MongoDB database: "${DB_NAME}"`);

    // Ensure collections and initial seed data exist
    await initDatabaseTables(db);
    return db;
  } catch (err) {
    isConnected = false;
    lastError = err.message;
    console.warn(`MongoDB Atlas connection note: ${err.message}. Using resilient memory storage sync.`);
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
      console.log('Created collection: rulesets');
    }
    const rulesetCount = await database.collection('rulesets').countDocuments();
    if (rulesetCount === 0) {
      await database.collection('rulesets').insertOne({
        ...defaultRuleset,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log('Seeded default ruleset in "rulesets" collection.');
    }

    // 2. Table: rules (individual normalized rule documents)
    if (!colNames.includes('rules')) {
      await database.createCollection('rules');
      console.log('Created collection: rules');
    }
    const ruleCount = await database.collection('rules').countDocuments();
    if (ruleCount === 0) {
      const normalizedRules = defaultRuleset.rules.map(r => ({
        ...r,
        brand: defaultRuleset.brand,
        rulesetName: defaultRuleset.rulesetName,
        createdAt: new Date()
      }));
      await database.collection('rules').insertMany(normalizedRules);
      console.log(`Seeded ${normalizedRules.length} rules in "rules" collection.`);
    }

    // 3. Table: brands
    if (!colNames.includes('brands')) {
      await database.createCollection('brands');
      console.log('Created collection: brands');
    }
    const brandCount = await database.collection('brands').countDocuments();
    if (brandCount === 0) {
      await database.collection('brands').insertMany(defaultBrands);
      console.log('Seeded initial brands in "brands" collection.');
    }

    // 4. Table: drafts
    if (!colNames.includes('drafts')) {
      await database.createCollection('drafts');
      console.log('Created collection: drafts');
    }

    // 5. Table: reviews (History / Audit Trail)
    if (!colNames.includes('reviews')) {
      await database.createCollection('reviews');
      console.log('Created collection: reviews');
    }
    const reviewCount = await database.collection('reviews').countDocuments();
    if (reviewCount === 0 && memoryStore.reviews.length > 0) {
      await database.collection('reviews').insertMany(memoryStore.reviews);
      console.log('Seeded demo review audit record in "reviews" collection.');
    }

    // 6. Table: audit_logs
    if (!colNames.includes('audit_logs')) {
      await database.createCollection('audit_logs');
      console.log('Created collection: audit_logs');
    }

    console.log('Database tables & collections initialized successfully.');
  } catch (err) {
    console.error('Error during table initialization:', err.message);
  }
}

// Database helper functions
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
        provider: "MongoDB Atlas Cluster",
        collections: stats,
        activeRules: stats.rules || 0,
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
    provider: "In-Memory Synchronized Store (Ready to push to Atlas)",
    collections: {
      rulesets: memoryStore.rulesets.length,
      brands: memoryStore.brands.length,
      reviews: memoryStore.reviews.length,
      drafts: memoryStore.drafts.length
    },
    activeRules: (memoryStore.rulesets[0]?.rules || []).length,
    reviewsCount: memoryStore.reviews.length,
    error: lastError
  };
}

// Ruleset operations
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
    // Also sync the normalized rules collection
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

  // Memory fallback
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

// Reviews & History operations
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

// Drafts operations
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

// Brands operations
async function getBrands() {
  const currentDb = await connectDB();
  if (currentDb && isConnected) {
    return await currentDb.collection('brands').find({}).toArray();
  }
  return memoryStore.brands;
}

// Insights aggregation
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
  getInsights,
  defaultRuleset
};
