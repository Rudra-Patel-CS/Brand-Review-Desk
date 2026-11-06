/* Brand Review Desk - Express Server with MongoDB Atlas integration
   Serves the Brand Review Desk client and exposes REST endpoints
   for managing rulesets, content drafts, reviews, brands, and insights.
*/

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const db = require('./db');

const app = express();
// Render provides PORT for the public web service. Keep BACKEND_PORT as a
// local-development fallback only so it cannot override Render's assigned port.
const PORT = process.env.PORT || process.env.BACKEND_PORT || 3000;
const CLIENT_BUILD_DIR = path.join(__dirname, 'dist');

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Serve the production Vite build. In development, use `npm run dev` instead.
app.use(express.static(CLIENT_BUILD_DIR));

// 1. Database status & health check
app.get('/api/status', async (req, res) => {
  try {
    const status = await db.getStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// React workspace data: every visible record is read from MongoDB collections.
app.get('/api/workspace', async (req, res) => {
  try {
    res.json(await db.getWorkspaceSnapshot());
  } catch (err) {
    res.status(503).json({ error: err.message, connected: false });
  }
});

// Update/re-trigger DB connection
app.post('/api/connect', async (req, res) => {
  try {
    const status = await db.getStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/workspace/rules/:id', async (req, res) => {
  try {
    const rule = req.body;
    if (!rule || !rule.brand || !rule.pattern || !rule.title) {
      return res.status(400).json({ error: 'Rule title, brand, and pattern are required' });
    }
    rule.id = req.params.id;
    res.json({ success: true, rule: await db.saveWorkspaceRule(rule) });
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

function isAllowedImageUrl(value) {
  return typeof value === 'string' && (
    /^https?:\/\//i.test(value) ||
    /^data:image\/(png|jpeg|webp);base64,/i.test(value)
  );
}

app.delete('/api/workspace/rules/:id', async (req, res) => {
  try {
    const result = await db.deleteWorkspaceRule(req.params.id, String(req.query.brand || ''));
    res.json({ success: true, deleted: result.deletedCount > 0 });
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

app.post('/api/workspace/campaigns', async (req, res) => {
  try {
    const campaign = req.body;
    if (!campaign || !campaign.title || !isAllowedImageUrl(campaign.imageUrl)) {
      return res.status(400).json({ error: 'Campaign title and image URL are required' });
    }
    campaign.id = String(campaign.id || `campaign-${Date.now()}`);
    res.status(200).json({ success: true, campaign: await db.saveWorkspaceCampaign(campaign) });
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

app.put('/api/workspace/campaigns/:id', async (req, res) => {
  try {
    const campaign = req.body;
    if (!campaign || !campaign.title || !isAllowedImageUrl(campaign.imageUrl)) {
      return res.status(400).json({ error: 'Campaign title and image URL are required' });
    }
    campaign.id = req.params.id;
    res.json({ success: true, campaign: await db.saveWorkspaceCampaign(campaign) });
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

app.post('/api/workspace/reviews', async (req, res) => {
  try {
    const review = req.body;
    if (!review || !review.campaignTitle || !Array.isArray(review.findings)) {
      return res.status(400).json({ error: 'A campaign title and findings list are required' });
    }
    res.status(201).json({ success: true, review: await db.addWorkspaceReview(review) });
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

// 2. Ruleset endpoints
app.get('/api/ruleset', async (req, res) => {
  try {
    const brand = req.query.brand;
    const ruleset = await db.getActiveRuleset(brand);
    res.json(ruleset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ruleset', async (req, res) => {
  try {
    const ruleset = req.body;
    if (!ruleset || !ruleset.rules || !Array.isArray(ruleset.rules)) {
      return res.status(400).json({ error: 'Invalid ruleset payload' });
    }
    const saved = await db.saveRuleset(ruleset);
    res.json({ success: true, ruleset: saved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ruleset/reset', async (req, res) => {
  try {
    const reset = await db.resetRuleset();
    res.json({ success: true, ruleset: reset });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Drafts endpoints
app.get('/api/draft', async (req, res) => {
  try {
    const draft = await db.getLatestDraft();
    res.json(draft || { empty: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/draft', async (req, res) => {
  try {
    const saved = await db.saveDraft(req.body);
    res.json({ success: true, draft: saved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Reviews & History endpoints
app.get('/api/reviews', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const reviews = await db.getReviews(limit);
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/reviews', async (req, res) => {
  try {
    const review = req.body;
    if (!review || !review.contentName) {
      return res.status(400).json({ error: 'contentName is required' });
    }
    const saved = await db.addReview(review);
    res.json({ success: true, review: saved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/reviews/:id', async (req, res) => {
  try {
    const result = await db.deleteReview(req.params.id);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Brands endpoints
app.get('/api/brands', async (req, res) => {
  try {
    const brands = await db.getBrands();
    res.json(brands);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Insights & Analytics endpoints
app.get('/api/insights', async (req, res) => {
  try {
    const insights = await db.getInsights();
    res.json(insights);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Keep unknown API paths as JSON 404s; serve the React app for frontend routes.
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  res.sendFile(path.join(CLIENT_BUILD_DIR, 'index.html'));
});

// Start the server immediately so web UI & APIs are instantly responsive
function start() {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Brand Review Desk server listening on http://localhost:${PORT}`);
  });
  // Connect to database in background
  console.log('Connecting to database...');
  db.connectDB().then(() => {
    console.log('Database connection initialized.');
  }).catch((err) => {
    console.warn('Initial database connection notice:', err.message);
  });
}

start();
