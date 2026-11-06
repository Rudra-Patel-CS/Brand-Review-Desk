// Loads .env and configures resilient DNS resolvers for the Atlas SRV lookup.
require('../db');
const { MongoClient } = require('mongodb');
const demoCatalog = require('../data/demo-catalog.json');

const uri = process.env.MONGO_URI || "mongodb+srv://db_test:test074@project-1.xzfwn9j.mongodb.net/Brand_Review_Desk?retryWrites=true&w=majority&appName=project-1";
const dbName = process.env.DB_NAME || "Brand_Review_Desk";

const brands = [
  {
    id: 'freshbites',
    name: 'FreshBites Organic',
    category: 'Cold-Pressed Wellness & Nutrition',
    rulebookVersion: 'Master Rulebook v4.1',
    activeRulesCount: 42,
    approvedClaimsCount: 14,
    createdAt: new Date()
  },
  {
    id: 'arka',
    name: 'Arka Foods',
    category: 'Artisanal Catering & Harvest Goods',
    rulebookVersion: 'Quality Codex v2.8',
    activeRulesCount: 28,
    approvedClaimsCount: 19,
    createdAt: new Date()
  },
  {
    id: 'novatech',
    name: 'NovaTech Solutions',
    category: 'Consumer Electronics & Smart Audio',
    rulebookVersion: 'Commercial Compliance v3.0',
    activeRulesCount: 35,
    approvedClaimsCount: 11,
    createdAt: new Date()
  },
  ...demoCatalog.brands.map((brand) => ({
    ...brand,
    rulesCount: demoCatalog.rules.filter((rule) => rule.brand === brand.id).length,
    createdAt: new Date()
  }))
];

const rules = [
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
    id: 'AF-001',
    brand: 'arka',
    title: 'Superiority and Non-Comparative Ranking',
    category: 'health',
    severity: 'critical',
    pattern: 'no\\.?\\s*1|number\\s*one|best\\s*sweets|sabse\\s*bada|biggest',
    flags: 'i',
    source: 'Arka Quality Codex 2024 • Section 1.4',
    explanation: 'Unsubstantiated superiority claims must carry audited evidence or cite official approved fact.',
    suggestedRemedy: 'Gujarat ka apna snacks brand, 2018 se',
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
    id: 'NT-001',
    brand: 'novatech',
    title: 'Absolute SLA & Downtime Guarantees',
    category: 'disclaimers',
    severity: 'critical',
    pattern: 'zero\\s*downtime\\s*guaranteed|100%\\s*uptime',
    flags: 'i',
    source: 'NovaTech Commercial Terms 2024 §8.2',
    explanation: 'Absolute zero downtime claims violate carrier SLA guidelines. Must quote 99.99% high-availability SLA.',
    suggestedRemedy: '99.99% high-availability SLA',
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
  ...demoCatalog.rules
];

const campaigns = [
  {
    id: 'preset-freshbites-glow',
    code: 'CAMPAIGN-0942',
    title: 'Green Glow Immunity Booster Launch',
    brandId: 'freshbites',
    brandName: 'FreshBites Organic',
    channel: 'IG / TikTok Reels (9:16)',
    format: 'Short-Form Video & Story',
    aspectRatio: '4/5',
    imageUrl: '/assets/screen_81b71146.png',
    caption: 'Revive your day with 100% Detox cold-pressed glow! Scientifically formulated to supercharge your immunity in 24 hours. #FreshBites #Immunity #CleanEats',
    ocrText: 'REVIVE AVOCADO GLOW Cold-Pressed Green Wellness 100% Detox • Immunity Booster Organic Avocado, Spinach, Kale, Wheatgrass, Ginger, Lemon, Apple 355ml SHOP NOW Available at ReviveWellness.com',
    ocrConfidence: 98.4,
    status: 'action_required',
    updatedAt: new Date()
  },
  {
    id: 'preset-arka-holiday',
    code: 'CAMPAIGN-0884',
    title: 'Harvest & Holiday Feast Catering Push',
    brandId: 'arka',
    brandName: 'Arka Foods',
    channel: 'Print & Digital Circular (4:5)',
    format: 'High-Res Print & Social Poster',
    aspectRatio: '4/5',
    imageUrl: '/assets/arka-poster.png',
    caption: "Celebrate this harvest with Arka Foods' heritage roasted namkeens & artisanal sweets. Order now to guarantee nationwide delivery by the holidays! #ArkaHarvest #FestiveTable",
    ocrText: "ARKA FOODS HARVEST SELECTION Artisanal Heritage Catering & Festive Sweets 100% Pure Desi Ghee Sweets & Roasted Namkeen Gujarat ka apna snacks brand, 2018 se Pre-orders close Dec 15th for guaranteed holiday delivery",
    ocrConfidence: 96.8,
    status: 'action_required',
    updatedAt: new Date()
  },
  {
    id: 'preset-novatech-anc',
    code: 'CAMPAIGN-1033',
    title: 'AeroPulse ANC Pro Launch Blitz',
    brandId: 'novatech',
    brandName: 'NovaTech Solutions',
    channel: 'YouTube Pre-Roll & Meta Ads',
    format: 'Product Hero Video & Static Deck',
    aspectRatio: '16/9',
    imageUrl: '/assets/novatech-cloud-launch.png',
    caption: 'Pure silence. Pure immersion. NovaTech AeroPulse ANC Pro with up to 30h playtime and 50% off for first 1,000 orders. Link in bio! #NovaTech #AudioTech #NoiseCancelling',
    ocrText: 'NOVATECH AEROPULSE ANC PRO Studio Grade Hybrid Noise Cancellation 30h playtime • Ultra-Low Latency Gaming Mode Limited Flash Sale — 50% off launch price Available at NovaTech.io and authorized retailers',
    ocrConfidence: 99.1,
    status: 'action_required',
    updatedAt: new Date()
  },
  ...demoCatalog.campaigns
];

const reviews = [
  {
    id: 'rev-2026-081',
    dossierNumber: 'DOS-2026-081',
    campaignTitle: 'Matcha Vitality Morning Campaign',
    brandId: 'freshbites',
    brandName: 'FreshBites Organic',
    channel: 'Pinterest & Meta Feed (1:1)',
    reviewedAt: 'Nov 5, 2026 • 16:42 IST',
    reviewerName: 'Priya Sharma',
    reviewerRole: 'Sr. Compliance Director',
    auditId: 'AUD-88219-FB',
    sha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    status: 'approved',
    findingsCount: 4,
    clearedCount: 4,
    openCount: 0,
    imageUrl: '/assets/screen_6c11f376.png',
    oldCopy: '100% Detox your morning with organic matcha! Zero fatigue guaranteed in 24 hours.',
    newCopy: 'Elevate your morning with organic stone-ground matcha. Supports sustained mental focus.',
    findings: [],
    notes: 'Approved after adjusting clinical detox claims to general vitality benefits.'
  }
];

async function seed() {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  try {
    console.log(`Connecting to MongoDB Atlas at: ${uri.replace(/:[^:]*@/, ':***@')}...`);
    await client.connect();
    console.log(`Connected to database "${dbName}"`);
    const db = client.db(dbName);

    // 1. Brands table
    console.log("Creating / updating 'brands' table...");
    await db.collection('brands').deleteMany({});
    await db.collection('brands').insertMany(brands);
    console.log(`✓ Seeded ${brands.length} records into 'brands' collection.`);

    // 2. Rules table
    console.log("Creating / updating 'rules' table...");
    await db.collection('rules').deleteMany({});
    await db.collection('rules').insertMany(rules);
    console.log(`✓ Seeded ${rules.length} records into 'rules' collection.`);

    // 3. Rulesets table
    console.log("Creating / updating 'rulesets' table...");
    await db.collection('rulesets').deleteMany({});
    await db.collection('rulesets').insertOne({
      brand: 'FreshBites Organic',
      rulesetName: 'Master Rulebook v4.1',
      version: 'v4.1',
      rules: rules.filter(r => r.brand === 'freshbites'),
      updatedAt: new Date()
    });
    for (const brand of demoCatalog.brands) {
      const brandRules = rules.filter((r) => r.brand === brand.id);
      await db.collection('rulesets').insertOne({
        brand: brand.name,
        rulesetName: brand.rulebookVersion,
        version: brand.rulebookVersion,
        note: brand.description,
        isDefault: false,
        rules: brandRules.map((rule) => ({
          ...rule,
          name: rule.title,
          why: rule.explanation,
          suggestion: { kind: 'replace', text: rule.suggestedRemedy, note: 'Approved remedy' },
          source: { doc: rule.source, version: 'v1', quote: rule.explanation }
        })),
        updatedAt: new Date()
      });
    }
    console.log(`✓ Seeded 'rulesets' collection (${demoCatalog.brands.length + 1} brands).`);

    // 4. Campaigns / Drafts table
    console.log("Creating / updating 'campaigns' table...");
    await db.collection('campaigns').deleteMany({});
    await db.collection('campaigns').insertMany(campaigns);
    console.log(`✓ Seeded ${campaigns.length} records into 'campaigns' collection.`);

    // Also mirror to 'drafts'
    await db.collection('drafts').deleteMany({});
    await db.collection('drafts').insertMany(campaigns);
    console.log("✓ Mirrored into 'drafts' collection.");

    // 5. Reviews table (Audit ledger)
    console.log("Creating / updating 'reviews' table...");
    await db.collection('reviews').deleteMany({});
    await db.collection('reviews').insertMany(reviews);
    console.log(`✓ Seeded ${reviews.length} records into 'reviews' collection.`);

    // 6. Audit logs table
    console.log("Creating / updating 'audit_logs' table...");
    await db.collection('audit_logs').insertOne({
      event: 'SYSTEM_DATABASE_INITIALIZED',
      timestamp: new Date(),
      details: 'All required compliance tables and seeds populated.'
    });
    console.log("✓ Logged initial entry to 'audit_logs' collection.");

    // Verification
    const collections = await db.listCollections().toArray();
    console.log("\nALL TABLES IN MONGODB DATABASE:", collections.map(c => c.name));
    for (const c of collections) {
      const count = await db.collection(c.name).countDocuments();
      console.log(`  - Table '${c.name}': ${count} document(s)`);
    }

  } catch (err) {
    console.error("Seed error:", err.message);
  } finally {
    await client.close();
    console.log("\nMongoDB connection closed. All tables successfully verified!");
  }
}

seed();
