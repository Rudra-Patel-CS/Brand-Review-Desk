/* Brand Review Desk - Database Connector & Collection Management
   Manages collections for rulesets, rules, drafts, reviews, brands, and audit logs.
*/

require('dotenv').config();

const dns = require('node:dns');
const fs = require('node:fs');
const net = require('node:net');
// Resolver override for networks where the system DNS cannot resolve MongoDB SRV
// records. Set DNS_SERVERS="8.8.8.8,1.1.1.1" in .env to customise.
const DNS_SERVERS = (process.env.DNS_SERVERS || '8.8.8.8,1.1.1.1')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// Public resolvers first, then the resolvers this machine actually uses.
// Some networks block direct public DNS but answer through their own resolver.
const SYSTEM_DNS_SERVERS = discoverSystemDnsServers();
try {
  dns.setServers([...new Set([...DNS_SERVERS, ...SYSTEM_DNS_SERVERS])]);
} catch (e) {}

const { MongoClient, ObjectId } = require('mongodb');
const demoCatalog = require('./data/demo-catalog.json');

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://db_test:password%402177@project-1.xzfwn9j.mongodb.net/Brand_Review_Desk?retryWrites=true&w=majority&appName=project-1";
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
  },
  ...demoCatalog.brands.map((brand) => ({
    ...brand,
    rulesCount: demoCatalog.rules.filter((rule) => rule.brand === brand.id).length,
    createdAt: new Date()
  }))
];

// In-memory fallback
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

function isDnsLookupError(err) {
  const msg = `${err?.message || ''} ${err?.code || ''}`.toLowerCase();
  return /querysrv|etimedout|enotfound|econnrefused|dns/.test(msg);
}

// Best-effort discovery of the operating system's DNS resolvers. Some networks
// (VPNs, corporate DNS, sandboxes) cannot reach public resolvers for the Atlas
// SRV lookup, so we retry with whatever the OS is actually using.
function discoverSystemDnsServers() {
  const found = [];
  try {
    if (process.platform === 'win32') {
      const { execFileSync } = require('node:child_process');
      const out = execFileSync(
        'powershell.exe',
        [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          "(Get-DnsClientServerAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.ServerAddresses } | ForEach-Object { $_.ServerAddresses }) -join ','"
        ],
        { encoding: 'utf8', timeout: 4000, windowsHide: true }
      );
      found.push(...String(out).split(','));
    } else {
      const conf = fs.readFileSync('/etc/resolv.conf', 'utf8');
      for (const line of conf.split(/\r?\n/)) {
        const match = line.match(/^\s*nameserver\s+(\S+)/i);
        if (match) found.push(match[1]);
      }
    }
  } catch {
    // Discovery is optional; fall through with whatever we already have.
  }

  return [...new Set(found.map((s) => s.trim()).filter((s) => net.isIPv4(s)))];
}

async function openConnection() {
  client = new MongoClient(MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000
  });
  await client.connect();
  db = client.db(DB_NAME);
}

function connectionFailed(err) {
  isConnected = false;
  lastError = err.message;
  console.warn(`Database connection note: ${err.message}. Running resilient sync storage.`);
  return null;
}

async function connectDB() {
  if (isConnected && db) return db;

  try {
    await openConnection();
  } catch (firstErr) {
    if (!isDnsLookupError(firstErr)) {
      return connectionFailed(firstErr);
    }

    const discovered = discoverSystemDnsServers();
    if (!discovered.length) {
      return connectionFailed(firstErr);
    }

    try {
      dns.setServers([...new Set([...dns.getServers(), ...discovered])]);
      if (client) {
        try { await client.close(); } catch { /* ignore */ }
      }
      console.warn(
        `Database SRV lookup failed; retrying with system DNS: ${discovered.join(', ')}`
      );
      await openConnection();
    } catch (retryErr) {
      return connectionFailed(retryErr);
    }
  }

  isConnected = true;
  lastError = null;
  console.log(`Connected to database: "${DB_NAME}"`);

  await initDatabaseTables(db);
  return db;
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
      await database.collection('rules').insertMany(normalizedRules);
    }

    // 3. Table: brands
    if (!colNames.includes('brands')) {
      await database.createCollection('brands');
    }
    const brandCount = await database.collection('brands').countDocuments();
    if (brandCount === 0) {
      await database.collection('brands').insertMany(defaultBrands);
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
      await database.collection('reviews').insertMany(memoryStore.reviews);
    }

    // 6. Table: audit_logs
    if (!colNames.includes('audit_logs')) {
      await database.createCollection('audit_logs');
    }

    // 7. Table: users (portal accounts)
    if (!colNames.includes('users')) {
      await database.createCollection('users');
    }
    await ensureUserIndexes(database);

    // 8. Table: campaigns
    if (!colNames.includes('campaigns')) {
      await database.createCollection('campaigns');
    }

    // 9. Idempotently add the extended 10-brand demo catalog.
    await ensureDemoCatalog(database);
  } catch (err) {
    console.error('Table initialization note:', err.message);
  }
}

// Adds the 10 extra demo brands, their rules, campaigns, and per-brand rulesets
// without deleting anything. Safe to run on every startup.
async function ensureDemoCatalog(database) {
  try {
    for (const brand of demoCatalog.brands) {
      await database.collection('brands').updateOne(
        { id: brand.id },
        {
          $set: {
            ...brand,
            rulesCount: demoCatalog.rules.filter((r) => r.brand === brand.id).length,
            updatedAt: new Date()
          },
          $setOnInsert: { createdAt: new Date() }
        },
        { upsert: true }
      );
    }

    for (const rule of demoCatalog.rules) {
      await database.collection('rules').updateOne(
        { id: rule.id },
        {
          $set: { ...rule, updatedAt: new Date() },
          $setOnInsert: { createdAt: new Date() }
        },
        { upsert: true }
      );
    }

    for (const campaign of demoCatalog.campaigns) {
      await database.collection('campaigns').updateOne(
        { id: campaign.id },
        {
          $set: { ...campaign, updatedAt: new Date() },
          $setOnInsert: { createdAt: new Date() }
        },
        { upsert: true }
      );
    }

    for (const brand of demoCatalog.brands) {
      const brandRules = demoCatalog.rules.filter((r) => r.brand === brand.id);
      await database.collection('rulesets').updateOne(
        { brand: brand.name },
        {
          $set: {
            brand: brand.name,
            rulesetName: brand.rulebookVersion,
            version: brand.rulebookVersion,
            note: brand.description,
            isDefault: false,
            rules: brandRules.map((rule) => ({
              ...rule,
              name: rule.title,
              why: rule.explanation,
              suggestion: {
                kind: 'replace',
                text: rule.suggestedRemedy,
                note: 'Approved remedy'
              },
              source: {
                doc: rule.source,
                version: 'v1',
                quote: rule.explanation
              }
            })),
            updatedAt: new Date()
          },
          $setOnInsert: { createdAt: new Date() }
        },
        { upsert: true }
      );
    }

    console.log(
      `Demo catalog ready: ${demoCatalog.brands.length} extra brands, ` +
      `${demoCatalog.rules.length} rules, ${demoCatalog.campaigns.length} campaigns.`
    );
  } catch (err) {
    console.warn('Demo catalog seed note:', err.message);
  }
}

async function ensureUserIndexes(database) {
  try {
    // Case-insensitive uniqueness for usernames and emails.
    await database.collection('users').createIndex(
      { usernameLower: 1 },
      { unique: true, name: 'uniq_username_lower' }
    );
    await database.collection('users').createIndex(
      { emailLower: 1 },
      { unique: true, name: 'uniq_email_lower' }
    );
  } catch (err) {
    // Index creation can fail if legacy duplicates exist. Do not block startup.
    console.warn('User index note:', err.message);
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

// ── User management ──────────────────────────────────────────────────────────
async function requireDatabase() {
  const database = await connectDB();
  if (!database || !isConnected) {
    const err = new Error(
      'Account storage is unavailable. Could not connect to MongoDB Atlas.'
    );
    err.code = 'DB_UNAVAILABLE';
    throw err;
  }
  return database;
}

async function createUser({ username, email, passwordHash }) {
  const database = await requireDatabase();
  const cleanUsername = String(username).trim();
  const cleanEmail = String(email || '').trim();
  const usernameLower = cleanUsername.toLowerCase();
  const emailLower = cleanEmail.toLowerCase();

  const existing = await database.collection('users').findOne({
    $or: [
      { usernameLower },
      { emailLower },
      // Legacy documents created before the normalised fields existed.
      { username: cleanUsername },
      { email: cleanEmail }
    ]
  });

  if (existing) {
    const err = new Error(
      existing.usernameLower === usernameLower
        ? 'That username is already taken.'
        : 'An account with that email already exists.'
    );
    err.code = 'USER_EXISTS';
    throw err;
  }

  const doc = {
    username: cleanUsername,
    usernameLower,
    email: cleanEmail,
    emailLower,
    passwordHash,
    role: 'user',
    createdAt: new Date()
  };

  try {
    const result = await database.collection('users').insertOne(doc);
    return { ...doc, _id: result.insertedId };
  } catch (err) {
    if (err && err.code === 11000) {
      const conflict = new Error(
        'That username or email is already registered.'
      );
      conflict.code = 'USER_EXISTS';
      throw conflict;
    }
    throw err;
  }
}

// Finds a user by username OR email (case-insensitive).
async function findUser(identifier) {
  const database = await requireDatabase();
  const raw = String(identifier || '').trim();
  if (!raw) return null;
  const key = raw.toLowerCase();

  const user = await database.collection('users').findOne({
    $or: [{ usernameLower: key }, { emailLower: key }]
  });
  if (user) return user;

  // Legacy documents without normalised fields.
  return database.collection('users').findOne({
    $or: [{ username: raw }, { email: raw }]
  });
}

async function findUserById(id) {
  const database = await requireDatabase();
  try {
    const { ObjectId } = require('mongodb');
    return await database.collection('users').findOne({ _id: new ObjectId(id) });
  } catch {
    return null;
  }
}

async function countUsers() {
  const database = await requireDatabase();
  return database.collection('users').countDocuments();
}

async function listUsers() {
  const database = await requireDatabase();
  return database
    .collection('users')
    .find({}, { projection: { passwordHash: 0 } })
    .toArray();
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
  defaultRuleset,
  createUser,
  findUser,
  findUserById,
  countUsers,
  listUsers
};

