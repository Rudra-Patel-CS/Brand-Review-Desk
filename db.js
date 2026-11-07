/* Brand Review Desk - Database Connector & Collection Management
   Manages collections for rulesets, rules, drafts, reviews, brands, users, sessions, campaigns, and audit logs.
*/

require('dotenv').config();

const dns = require('node:dns');
const fs = require('node:fs');
const net = require('node:net');
const { MongoClient, ObjectId } = require('mongodb');
const demoCatalog = require('./data/demo-catalog.json');

// Resolver override for networks where the system DNS cannot resolve MongoDB SRV records.
const DNS_SERVERS = (process.env.DNS_SERVERS || '8.8.8.8,1.1.1.1')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const SYSTEM_DNS_SERVERS = discoverSystemDnsServers();
try {
  dns.setServers([...new Set([...DNS_SERVERS, ...SYSTEM_DNS_SERVERS])]);
} catch (e) {}

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://db_test:password%402177@project-1.xzfwn9j.mongodb.net/Brand_Review_Desk?retryWrites=true&w=majority&appName=project-1";
const DB_NAME = process.env.DB_NAME || "Brand_Review_Desk";

let client = null;
let db = null;
let isConnected = false;
let lastError = null;
let lastConnectAttempt = 0;
const CONNECT_RETRY_COOLDOWN = 20000; // 20s cooldown before retrying connection

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
    id: "freshbites",
    name: "FreshBites Organic",
    industry: "Health Beverages & Superfoods",
    category: "Cold-Pressed Wellness & Nutrition",
    rulebookVersion: "Master Rulebook v4.1",
    description: "Cold-pressed juices, organic wellness drinks, and pantry staples.",
    rulesCount: 4,
    createdAt: new Date()
  },
  {
    id: "arka",
    name: "Arka Foods",
    industry: "FMCG / Packaged Foods",
    category: "Artisanal Catering & Harvest Goods",
    rulebookVersion: "Quality Codex v2.8",
    description: "Traditional sweets, namkeen, and festive gift boxes.",
    rulesCount: 6,
    createdAt: new Date()
  },
  {
    id: "novatech",
    name: "NovaTech Solutions",
    industry: "Enterprise Cloud & AI",
    category: "Consumer Electronics & Smart Audio",
    rulebookVersion: "Commercial Compliance v3.0",
    description: "Cloud computing, storage infrastructure, and SLA-backed services.",
    rulesCount: 3,
    createdAt: new Date()
  },
  ...demoCatalog.brands.map((brand) => ({
    ...brand,
    rulesCount: demoCatalog.rules.filter((rule) => rule.brand === brand.id).length,
    createdAt: new Date()
  }))
];

// Curated 10 Wikimedia Commons reference campaigns
const curatedCommonsFallbacks = [
  { title: 'Apple juice glass.jpg', creator: 'JeanBono', licenseName: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', description: 'Apple juice in a glass.' },
  { title: 'Green smoothie.jpg', creator: 'Joanna Slodownik', licenseName: 'CC BY 2.0', licenseUrl: 'https://creativecommons.org/licenses/by/2.0/', description: 'Green smoothie with banana, pear, celery, spinach.' },
  { title: 'Green smoothie bowl.jpg', creator: 'Miscellaneous contributor', licenseName: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', description: 'Green smoothie bowl with muesli and chia seeds.' },
  { title: 'Salad greens in pot.jpg', creator: 'Ruth Hartnup', licenseName: 'CC BY 2.0', licenseUrl: 'https://creativecommons.org/licenses/by/2.0/', description: 'Salad greens in a bowl.' },
  { title: 'Tea Leaves.jpg', creator: 'Sathish', licenseName: 'CC BY 3.0', licenseUrl: 'https://creativecommons.org/licenses/by/3.0/', description: 'Tea leaves photographed in Ooty.' },
  { title: 'Breads from a local bakery.jpg', creator: 'Elmer B. Domingo', licenseName: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', description: 'Assorted breads from a local bakery.' },
  { title: 'Buffet foods.jpg', creator: 'Michael Coté', licenseName: 'CC BY 2.0', licenseUrl: 'https://creativecommons.org/licenses/by/2.0/', description: 'Food displayed at a buffet.' },
  { title: 'Common Indian household spices in a bowl.jpg', creator: 'Pamri (author assumed on Commons)', licenseName: 'Public domain', licenseUrl: 'https://creativecommons.org/publicdomain/mark/1.0/', description: 'Common Indian household spices in a bowl.' },
  { title: 'Headphones.jpg', creator: 'Atorero (Alexander Kozlov)', licenseName: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/', description: 'Koss headphones.' },
  { title: 'Laptop image.jpg', creator: 'Darakshanehaluddin', licenseName: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', description: 'Laptop computer.' }
];

const commonsCampaigns = curatedCommonsFallbacks.map((fallback, index) => {
  const encodedName = encodeURIComponent(fallback.title);
  const id = `commons-${fallback.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 55)}`;
  return {
    id,
    code: `REF-${String(index + 1).padStart(3, '0')}`,
    title: fallback.title.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' '),
    brandId: 'global',
    brandName: 'Reference library',
    channel: 'Image reference',
    format: 'Reference artwork',
    aspectRatio: '4/3',
    imageUrl: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodedName}?width=1200`,
    caption: '',
    ocrText: '',
    ocrConfidence: 0,
    initialFindings: [],
    status: 'action_required',
    referenceOnly: true,
    isDemo: true,
    sourceName: 'Wikimedia Commons',
    sourceUrl: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(fallback.title.replace(/ /g, '_'))}`,
    licenseName: fallback.licenseName,
    licenseUrl: fallback.licenseUrl,
    attribution: fallback.creator,
    sourceDescription: fallback.description,
    createdAt: new Date(),
    updatedAt: new Date()
  };
});

const defaultCampaigns = [
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
        explanation: "Absolute clinical detox claims require double-blind peer-reviewed substantiation. Unauthorized for commercial social syndication without disclaimer.",
        suggestedCorrection: 'Daily Refreshing Wellness Support',
        status: 'open',
        bbox: { top: 59.5, left: 41.5, width: 19.0, height: 4.2 }
      }
    ],
    updatedAt: new Date(),
    createdAt: new Date()
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
    caption: "Celebrate the season with Gourmet Organic Selections! Book your festive catering now. Order by Dec 15th at FestiveHoliday.com. Prepared in a facility handling tree nuts. #HolidayFeast #ArkaFoods",
    ocrText: "HARVEST & HOLIDAY FEAST CELEBRATE THE SEASON Gourmet Organic Selections BOOK YOUR FESTIVE CATERING NOW! ORDER BY DEC 15TH | FESTIVEHOLIDAY.COM THE GOURMET TABLE",
    ocrConfidence: 99.2,
    status: 'action_required',
    initialFindings: [],
    updatedAt: new Date(),
    createdAt: new Date()
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
    initialFindings: [],
    updatedAt: new Date(),
    createdAt: new Date()
  },
  ...demoCatalog.campaigns.map((c) => ({
    ...c,
    initialFindings: c.initialFindings || [],
    createdAt: new Date(),
    updatedAt: new Date()
  })),
  ...commonsCampaigns
];

// In-memory fallback store
const memoryStore = {
  rulesets: [JSON.parse(JSON.stringify(defaultRuleset))],
  brands: JSON.parse(JSON.stringify(defaultBrands)),
  drafts: [],
  reviews: [
    {
      id: "rev-20261106-001",
      reviewId: "REV-20261106-001",
      dossierNumber: "BRD-9042",
      campaignTitle: "arka-diwali-poster-v2.png",
      contentName: "arka-diwali-poster-v2.png",
      brandId: "arka",
      brandName: "Arka Foods (demo)",
      brand: "Arka Foods (demo)",
      rulesetName: "Arka Foods Brand Compliance Guidelines",
      rulesVersion: "v3.2",
      timestamp: new Date(Date.now() - 3600000),
      formattedDate: new Date(Date.now() - 3600000).toLocaleString("en-IN"),
      reviewerName: "Portal Administrator",
      reviewerRole: "Workspace Administrator",
      decisions: [],
      findings: [],
      status: "approved",
      findingsCount: 3,
      clearedCount: 3,
      openCount: 0,
      createdAt: new Date()
    }
  ],
  campaigns: JSON.parse(JSON.stringify(defaultCampaigns)),
  rules: defaultRuleset.rules.map(r => ({
    ...r,
    brand: 'arka',
    title: r.name,
    pattern: Array.isArray(r.patterns) ? r.patterns.join('|') : String(r.patterns || ''),
    explanation: r.why,
    suggestedRemedy: r.suggestion?.text || '',
    appliesTo: ['caption', 'ocr']
  })),
  users: [],
  sessions: [],
  audit_logs: []
};

function isDnsLookupError(err) {
  const msg = `${err?.message || ''} ${err?.code || ''}`.toLowerCase();
  return /querysrv|etimedout|enotfound|econnrefused|dns/.test(msg);
}

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
  return null;
}

async function connectDB(forceRetry = false) {
  if (isConnected && db) return db;

  const now = Date.now();
  if (!forceRetry && !isConnected && now - lastConnectAttempt < CONNECT_RETRY_COOLDOWN) {
    return null;
  }
  lastConnectAttempt = now;

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

    if (!colNames.includes('rulesets')) await database.createCollection('rulesets');
    if (!colNames.includes('rules')) await database.createCollection('rules');
    if (!colNames.includes('brands')) await database.createCollection('brands');
    if (!colNames.includes('drafts')) await database.createCollection('drafts');
    if (!colNames.includes('reviews')) await database.createCollection('reviews');
    if (!colNames.includes('audit_logs')) await database.createCollection('audit_logs');
    if (!colNames.includes('users')) await database.createCollection('users');
    if (!colNames.includes('sessions')) await database.createCollection('sessions');
    if (!colNames.includes('campaigns')) await database.createCollection('campaigns');

    await ensureUserIndexes(database);
    await ensureSessionIndexes(database);
    await ensureDemoCatalog(database);
    await ensureCommonsReferences(database);
  } catch (err) {
    console.error('Table initialization note:', err.message);
  }
}

async function ensureSessionIndexes(database) {
  try {
    await database.collection('sessions').createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0, name: 'ttl_session_expires' }
    );
    await database.collection('sessions').createIndex(
      { sessionId: 1 },
      { unique: true, name: 'uniq_session_id' }
    );
    await database.collection('sessions').createIndex(
      { userId: 1 },
      { name: 'idx_session_user' }
    );
  } catch (err) {
    // Indexes might already exist
  }
}

async function ensureUserIndexes(database) {
  try {
    await database.collection('users').createIndex(
      { usernameLower: 1 },
      { unique: true, name: 'uniq_username_lower' }
    );
    await database.collection('users').createIndex(
      { emailLower: 1 },
      { unique: true, name: 'uniq_email_lower' }
    );
  } catch (err) {
    // Indexes might already exist
  }
}

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
  } catch (err) {
    console.warn('Demo catalog seed note:', err.message);
  }
}

async function ensureCommonsReferences(database) {
  try {
    for (const campaign of commonsCampaigns) {
      await database.collection('campaigns').updateOne(
        { id: campaign.id },
        {
          $setOnInsert: {
            ...campaign,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        },
        { upsert: true }
      );
    }
  } catch (err) {
    console.warn('Commons reference note:', err.message);
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
        provider: "MongoDB Atlas",
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
      rules: memoryStore.rules.length,
      campaigns: memoryStore.campaigns.length,
      users: memoryStore.users.length,
      sessions: memoryStore.sessions.length
    },
    activeRules: memoryStore.rules.length,
    reviewsCount: memoryStore.reviews.length,
    error: lastError
  };
}

// ── User Management ───────────────────────────────────────────────────────────
async function createUser({ username, email, passwordHash, role = 'reviewer', disabled = false }) {
  const cleanUsername = String(username).trim();
  const cleanEmail = String(email || '').trim();
  const usernameLower = cleanUsername.toLowerCase();
  const emailLower = cleanEmail.toLowerCase();

  const currentDb = await connectDB();
  if (currentDb && isConnected) {
    const existing = await currentDb.collection('users').findOne({
      $or: [
        { usernameLower },
        { emailLower },
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
      role: role || 'reviewer',
      disabled: Boolean(disabled),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await currentDb.collection('users').insertOne(doc);
    return { ...doc, _id: result.insertedId };
  }

  // Memory fallback
  const existingMem = memoryStore.users.find(
    (u) => u.usernameLower === usernameLower || (cleanEmail && u.emailLower === emailLower)
  );
  if (existingMem) {
    const err = new Error(
      existingMem.usernameLower === usernameLower
        ? 'That username is already taken.'
        : 'An account with that email already exists.'
    );
    err.code = 'USER_EXISTS';
    throw err;
  }

  const memDoc = {
    _id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    username: cleanUsername,
    usernameLower,
    email: cleanEmail,
    emailLower,
    passwordHash,
    role: role || 'reviewer',
    disabled: Boolean(disabled),
    createdAt: new Date(),
    updatedAt: new Date()
  };
  memoryStore.users.push(memDoc);
  return memDoc;
}

async function countUsers() {
  const currentDb = await connectDB();
  if (currentDb && isConnected) {
    return currentDb.collection('users').countDocuments();
  }
  return memoryStore.users.length;
}

async function findUser(identifier) {
  const raw = String(identifier || '').trim();
  if (!raw) return null;
  const key = raw.toLowerCase();

  const currentDb = await connectDB();
  if (currentDb && isConnected) {
    const user = await currentDb.collection('users').findOne({
      $or: [{ usernameLower: key }, { emailLower: key }]
    });
    if (user) return user;
    return currentDb.collection('users').findOne({
      $or: [{ username: raw }, { email: raw }]
    });
  }

  return memoryStore.users.find(
    (u) => u.usernameLower === key || u.emailLower === key || u.username === raw || u.email === raw
  ) || null;
}

async function findUserById(id) {
  if (!id) return null;
  const currentDb = await connectDB();
  if (currentDb && isConnected) {
    try {
      const objId = typeof id === 'string' && id.length === 24 ? new ObjectId(id) : id;
      return await currentDb.collection('users').findOne({ _id: objId });
    } catch {
      return await currentDb.collection('users').findOne({ _id: id });
    }
  }

  return memoryStore.users.find((u) => String(u._id) === String(id) || String(u.id) === String(id)) || null;
}

async function listUsers() {
  const currentDb = await connectDB();
  if (currentDb && isConnected) {
    return currentDb.collection('users')
      .find({}, { projection: { passwordHash: 0 } })
      .sort({ createdAt: -1 })
      .toArray();
  }

  return memoryStore.users.map(({ passwordHash, ...rest }) => rest);
}

async function updateUser(id, updates) {
  if (!id) throw new Error('User ID is required');
  const allowed = ['role', 'disabled', 'email'];
  const updatePayload = { updatedAt: new Date() };

  for (const key of allowed) {
    if (updates[key] !== undefined) {
      updatePayload[key] = updates[key];
    }
  }
  if (updates.email) {
    updatePayload.emailLower = String(updates.email).toLowerCase().trim();
  }

  const currentDb = await connectDB();
  if (currentDb && isConnected) {
    let filter;
    try {
      filter = { _id: typeof id === 'string' && id.length === 24 ? new ObjectId(id) : id };
    } catch {
      filter = { _id: id };
    }
    await currentDb.collection('users').updateOne(filter, { $set: updatePayload });
    return findUserById(id);
  }

  const idx = memoryStore.users.findIndex((u) => String(u._id) === String(id) || String(u.id) === String(id));
  if (idx !== -1) {
    memoryStore.users[idx] = { ...memoryStore.users[idx], ...updatePayload };
    const { passwordHash, ...safe } = memoryStore.users[idx];
    return safe;
  }
  return null;
}

// ── Session Management ────────────────────────────────────────────────────────
async function createSession({ sessionId, userId, username, role, csrfToken, expiresAt, ip, userAgent }) {
  const sessionDoc = {
    sessionId,
    userId: String(userId),
    username,
    role,
    csrfToken,
    expiresAt: new Date(expiresAt),
    createdAt: new Date(),
    ip: ip || 'unknown',
    userAgent: userAgent || 'unknown'
  };

  const currentDb = await connectDB();
  if (currentDb && isConnected) {
    await currentDb.collection('sessions').insertOne(sessionDoc);
    return sessionDoc;
  }

  memoryStore.sessions.push(sessionDoc);
  return sessionDoc;
}

async function findSession(sessionId) {
  if (!sessionId) return null;
  const now = new Date();

  const currentDb = await connectDB();
  if (currentDb && isConnected) {
    const session = await currentDb.collection('sessions').findOne({ sessionId });
    if (!session) return null;
    if (session.expiresAt && session.expiresAt <= now) {
      await currentDb.collection('sessions').deleteOne({ sessionId });
      return null;
    }
    return session;
  }

  const found = memoryStore.sessions.find((s) => s.sessionId === sessionId);
  if (!found) return null;
  if (found.expiresAt && new Date(found.expiresAt) <= now) {
    memoryStore.sessions = memoryStore.sessions.filter((s) => s.sessionId !== sessionId);
    return null;
  }
  return found;
}

async function deleteSession(sessionId) {
  if (!sessionId) return;
  const currentDb = await connectDB();
  if (currentDb && isConnected) {
    await currentDb.collection('sessions').deleteOne({ sessionId });
    return;
  }

  memoryStore.sessions = memoryStore.sessions.filter((s) => s.sessionId !== sessionId);
}

async function deleteUserSessions(userId) {
  if (!userId) return;
  const currentDb = await connectDB();
  if (currentDb && isConnected) {
    await currentDb.collection('sessions').deleteMany({ userId: String(userId) });
    return;
  }

  memoryStore.sessions = memoryStore.sessions.filter((s) => String(s.userId) !== String(userId));
}

// ── Workspace Operations ──────────────────────────────────────────────────────
function normalizeBrand(raw) {
  if (!raw) return { id: 'global', name: 'Reference library' };
  const name = String(raw.name || raw.brandName || raw.brand || raw.id || 'global');
  const lower = name.toLowerCase();
  if (lower.includes('freshbites')) return { id: 'freshbites', name: 'FreshBites Organic' };
  if (lower.includes('arka')) return { id: 'arka', name: 'Arka Foods' };
  if (lower.includes('novatech')) return { id: 'novatech', name: 'NovaTech Solutions' };
  const catalogBrand = demoCatalog.brands.find((b) => b.id === raw.id || b.name.toLowerCase() === lower);
  if (catalogBrand) return { id: catalogBrand.id, name: catalogBrand.name };
  if (lower === 'global' || lower.includes('reference')) return { id: 'global', name: 'Reference library' };
  return { id: raw.id || lower.replace(/[^a-z0-9]+/g, '-'), name };
}

function normalizeWorkspaceRule(record) {
  const { _id, ...plainRecord } = record;
  const escapePattern = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = record.pattern || (Array.isArray(record.patterns)
    ? record.patterns.map((val) => record.regex ? String(val) : escapePattern(val)).join('|')
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
    source,
    explanation: record.explanation || record.why || '',
    suggestedRemedy: record.suggestedRemedy || record.suggestion?.text || '',
    enabled: record.enabled !== false,
    appliesTo: Array.isArray(record.appliesTo) ? record.appliesTo : ['caption', 'ocr']
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
    brandName: record.brandName || record.brand || 'Reference library',
    channel: record.channel || 'Image reference',
    format: record.format || 'Image',
    aspectRatio: record.aspectRatio || '4/3',
    imageUrl: imageUrl.replace(/^\/assets\/screen_/, '/assets/aistudio/screen_'),
    caption: record.caption || '',
    ocrText: record.ocrText || '',
    ocrConfidence: Number(record.ocrConfidence || 0),
    extractedText: record.extractedText || record.ocrText || '',
    correctedArtworkText: record.correctedArtworkText || '',
    ocrLines: Array.isArray(record.ocrLines) ? record.ocrLines : [],
    ocrWords: Array.isArray(record.ocrWords) ? record.ocrWords : [],
    initialFindings: Array.isArray(record.initialFindings) ? record.initialFindings : [],
    status: record.status || 'action_required',
    sourceName: record.sourceName || '',
    sourceUrl: record.sourceUrl || '',
    licenseName: record.licenseName || '',
    licenseUrl: record.licenseUrl || '',
    attribution: record.attribution || '',
    sourceDescription: record.sourceDescription || '',
    isDemo: Boolean(record.isDemo || String(record.id || '').startsWith('preset-') || String(record.id || '').startsWith('commons-'))
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
      reviewerName: record.reviewerName || 'Authenticated Reviewer',
      reviewerRole: record.reviewerRole || 'Brand Compliance Reviewer',
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
    id: String(record.id || record._id),
    dossierNumber: record.dossierNumber || String(record.id || record._id),
    campaignTitle: record.campaignTitle || 'Untitled review',
    brandId: normalizeBrand({ name: record.brandId || record.brandName || 'global' }).id,
    brandName: record.brandName || 'Unassigned',
    channel: record.channel || 'Unspecified',
    reviewedAt: record.reviewedAt || record.formattedDate || '',
    reviewerName: record.reviewerName || 'Authenticated Reviewer',
    reviewerRole: record.reviewerRole || 'Brand Compliance Reviewer',
    auditId: record.auditId || '',
    sha256Hash: record.sha256Hash || '',
    status: record.status || 'approved',
    findingsCount: Number(record.findingsCount || 0),
    clearedCount: Number(record.clearedCount || 0),
    openCount: Number(record.openCount || 0),
    imageUrl: record.imageUrl || '',
    findings: Array.isArray(record.findings) ? record.findings : [],
    notes: record.notes || '',
    isDemo: Boolean(record.isDemo)
  };
}

async function getWorkspaceSnapshot() {
  const currentDb = await connectDB();
  if (currentDb && isConnected) {
    const [brandRows, ruleRows, campaignRows, reviewRows] = await Promise.all([
      currentDb.collection('brands').find({}).toArray(),
      currentDb.collection('rules').find({}).toArray(),
      currentDb.collection('campaigns').find({}).sort({ updatedAt: -1, createdAt: -1 }).toArray(),
      currentDb.collection('reviews').find({}).sort({ timestamp: -1, createdAt: -1 }).limit(500).toArray()
    ]);
    const brands = (brandRows.length ? brandRows : defaultBrands).map(normalizeBrand);
    const rules = ruleRows.map(normalizeWorkspaceRule).filter((rule) => rule.id && rule.pattern);
    const campaigns = (campaignRows.length ? campaignRows : defaultCampaigns).map(normalizeWorkspaceCampaign);
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

  return {
    connected: false,
    database: DB_NAME,
    updatedAt: new Date().toISOString(),
    brands: memoryStore.brands.map(normalizeBrand),
    rules: memoryStore.rules.map(normalizeWorkspaceRule).filter((r) => r.id && r.pattern),
    campaigns: memoryStore.campaigns.map(normalizeWorkspaceCampaign),
    reviews: memoryStore.reviews.map(normalizeWorkspaceReview)
  };
}

async function saveWorkspaceRule(rule) {
  const { _id, createdAt, ...ruleFields } = rule;
  const value = { ...ruleFields, updatedAt: new Date() };

  const currentDb = await connectDB();
  if (currentDb && isConnected) {
    const storedBrandNames = {
      freshbites: ['freshbites', 'FreshBites Organic', 'FreshBites Organic (demo)'],
      arka: ['arka', 'Arka Foods', 'Arka Foods (demo)'],
      novatech: ['novatech', 'NovaTech Solutions'],
      global: ['global']
    }[rule.brand] || [rule.brand];

    await currentDb.collection('rules').updateOne(
      { id: String(rule.id), brand: { $in: storedBrandNames } },
      { $set: value, $setOnInsert: { createdAt: createdAt ? new Date(createdAt) : new Date() } },
      { upsert: true }
    );
    return currentDb.collection('rules').findOne({ id: String(rule.id), brand: rule.brand });
  }

  const idx = memoryStore.rules.findIndex((r) => r.id === rule.id);
  if (idx !== -1) {
    memoryStore.rules[idx] = { ...memoryStore.rules[idx], ...value };
    return memoryStore.rules[idx];
  }
  const newRule = { ...value, createdAt: new Date() };
  memoryStore.rules.push(newRule);
  return newRule;
}

async function deleteWorkspaceRule(id, brand) {
  const currentDb = await connectDB();
  if (currentDb && isConnected) {
    const storedBrandNames = {
      freshbites: ['freshbites', 'FreshBites Organic', 'FreshBites Organic (demo)'],
      arka: ['arka', 'Arka Foods', 'Arka Foods (demo)'],
      novatech: ['novatech', 'NovaTech Solutions'],
      global: ['global']
    }[brand] || [brand];
    return currentDb.collection('rules').deleteOne({ id: String(id), brand: { $in: storedBrandNames } });
  }

  const initialCount = memoryStore.rules.length;
  memoryStore.rules = memoryStore.rules.filter((r) => !(r.id === id && (!brand || r.brand === brand)));
  return { deletedCount: initialCount - memoryStore.rules.length };
}

async function saveWorkspaceCampaign(campaign) {
  const { _id, createdAt, ...campaignFields } = campaign;
  const value = { ...campaignFields, updatedAt: new Date() };

  const currentDb = await connectDB();
  if (currentDb && isConnected) {
    await currentDb.collection('campaigns').updateOne(
      { id: String(campaign.id) },
      { $set: value, $setOnInsert: { createdAt: createdAt ? new Date(createdAt) : new Date() } },
      { upsert: true }
    );
    return currentDb.collection('campaigns').findOne({ id: String(campaign.id) });
  }

  const idx = memoryStore.campaigns.findIndex((c) => c.id === campaign.id);
  if (idx !== -1) {
    memoryStore.campaigns[idx] = { ...memoryStore.campaigns[idx], ...value };
    return memoryStore.campaigns[idx];
  }
  const newCampaign = { ...value, createdAt: new Date() };
  memoryStore.campaigns.unshift(newCampaign);
  return newCampaign;
}

async function addWorkspaceReview(review) {
  const value = {
    ...review,
    id: String(review.id || `review-${Date.now()}`),
    timestamp: new Date(),
    createdAt: new Date()
  };

  const currentDb = await connectDB();
  if (currentDb && isConnected) {
    await currentDb.collection('reviews').insertOne(value);
    return value;
  }

  memoryStore.reviews.unshift(value);
  return value;
}

// ── Legacy API operations (Preserved for compatibility) ───────────────────────
async function getActiveRuleset(brandName) {
  const currentDb = await connectDB();
  if (currentDb && isConnected) {
    const query = brandName ? { brand: new RegExp(`^${brandName}`, 'i') } : { isDefault: true };
    const rs = await currentDb.collection('rulesets').findOne(query);
    if (rs) return rs;
    return (await currentDb.collection('rulesets').findOne({})) || defaultRuleset;
  }
  if (brandName) {
    const found = memoryStore.rulesets.find((r) => r.brand.toLowerCase().includes(brandName.toLowerCase()));
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
      await currentDb.collection('rulesets').updateOne({ brand: ruleset.brand }, { $set: ruleset }, { upsert: true });
    }
    return ruleset;
  }
  const idx = memoryStore.rulesets.findIndex((r) => r.brand === ruleset.brand);
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
    return resetCopy;
  }
  memoryStore.rulesets = [resetCopy];
  return resetCopy;
}

async function getReviews(limit = 50) {
  const currentDb = await connectDB();
  if (currentDb && isConnected) {
    return currentDb.collection('reviews').find({}).sort({ timestamp: -1 }).limit(limit).toArray();
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
  memoryStore.reviews = memoryStore.reviews.filter((r) => r.reviewId !== id && String(r._id) !== id);
  return { deleted: true };
}

async function getLatestDraft() {
  const currentDb = await connectDB();
  if (currentDb && isConnected) {
    return currentDb.collection('drafts').findOne({}, { sort: { updatedAt: -1 } });
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
    return currentDb.collection('brands').find({}).toArray();
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

  reviews.forEach((r) => {
    totalApplied += r.appliedCount || 0;
    totalDismissed += r.dismissedCount || 0;
    totalCopyChanges += r.copyChangesCount || 0;

    (r.decisions || []).forEach((d) => {
      totalDecisions++;
      const rid = d.ruleId || 'OTHER';
      ruleStats[rid] = (ruleStats[rid] || 0) + 1;
    });
  });

  (ruleset.rules || []).forEach((r) => {
    categoryStats[r.category] = (categoryStats[r.category] || 0) + (ruleStats[r.id] || 0);
  });

  const topFlagged = Object.keys(ruleStats).map((k) => ({
    ruleId: k,
    count: ruleStats[k],
    ruleName: (ruleset.rules || []).find((r) => r.id === k)?.name || k
  })).sort((a, b) => b.count - a.count);

  return {
    totalReviews: reviews.length,
    totalDecisions,
    totalApplied,
    totalDismissed,
    totalCopyChanges,
    approvalRate: reviews.length ? Math.round((reviews.filter((r) => r.status === 'approved').length / reviews.length) * 100) : 100,
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
  defaultRuleset,
  createUser,
  findUser,
  findUserById,
  countUsers,
  listUsers,
  updateUser,
  createSession,
  findSession,
  deleteSession,
  deleteUserSessions,
  getWorkspaceSnapshot,
  saveWorkspaceRule,
  deleteWorkspaceRule,
  saveWorkspaceCampaign,
  addWorkspaceReview,
  commonsCampaigns,
  memoryStore
};
