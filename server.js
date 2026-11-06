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
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static frontend files
app.use(express.static(path.join(__dirname)));

// 1. Database status & health check
app.get('/api/status', async (req, res) => {
  try {
    const status = await db.getStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update/re-trigger DB connection
app.post('/api/connect', async (req, res) => {
  try {
    if (req.body.uri) process.env.MONGO_URI = req.body.uri;
    const status = await db.getStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
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

// Fallback to index.html for client-side navigation
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
async function start() {
  console.log('Connecting to database...');
  await db.connectDB();
  app.listen(PORT, () => {
    console.log(`Brand Review Desk server listening on http://localhost:${PORT}`);
  });
}

start();
