/* Brand Review Desk - Express Server with MongoDB Atlas integration
   Serves the Brand Review Desk client and exposes REST endpoints
   for managing rulesets, content drafts, reviews, brands, and insights.
*/

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const db = require('./db');
const auth = require('./auth');

const app = express();
const PORT = process.env.BACKEND_PORT || process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static frontend files.
// Only the built client and public assets are exposed: never the project root,
// so .env, server source, and node_modules cannot be downloaded.
const PUBLIC_DIR = path.join(__dirname, 'public');
const DIST_DIR = path.join(__dirname, 'dist');

app.use(express.static(PUBLIC_DIR));
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
}

// 1. Database status & health check
app.get('/api/status', async (req, res) => {
  try {
    const status = await db.getStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Authentication ───────────────────────────────────────────────────────────
// Simple in-memory throttle to slow down credential stuffing / brute force.
const authAttempts = new Map();
const AUTH_WINDOW_MS = 15 * 60 * 1000;
const AUTH_MAX_ATTEMPTS = 20;

function authRateLimit(req, res, next) {
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = authAttempts.get(key);

  if (!entry || now - entry.startedAt > AUTH_WINDOW_MS) {
    authAttempts.set(key, { startedAt: now, count: 1 });
    return next();
  }

  entry.count += 1;
  if (entry.count > AUTH_MAX_ATTEMPTS) {
    return res.status(429).json({
      error: 'Too many attempts. Please wait a few minutes and try again.'
    });
  }
  next();
}

function publicUser(user) {
  return auth.normalizeUser(user);
}

// Register a new portal account
app.post('/api/auth/register', authRateLimit, async (req, res) => {
  try {
    const { username, email, password } = req.body || {};

    const validationError = auth.validateRegistration({ username, email, password });
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const passwordHash = await auth.hashPassword(password);
    const user = await db.createUser({
      username: String(username).trim(),
      email: String(email).trim(),
      passwordHash
    });

    return res.status(201).json({
      success: true,
      user: publicUser(user),
      message: 'Account created. Please sign in to continue.'
    });
  } catch (err) {
    if (err.code === 'USER_EXISTS') {
      return res.status(409).json({ error: err.message });
    }
    if (err.code === 'DB_UNAVAILABLE') {
      return res.status(503).json({ error: err.message });
    }
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Could not create your account. Please try again.' });
  }
});

// Sign in with username or email
app.post('/api/auth/login', authRateLimit, async (req, res) => {
  try {
    const { username, email, identifier, password } = req.body || {};
    const loginId = identifier || username || email;

    if (!loginId || !password) {
      return res.status(400).json({ error: 'Username/email and password are required.' });
    }

    const user = await db.findUser(loginId);
    const valid = user ? await auth.verifyPassword(password, user.passwordHash) : false;

    if (!user || !valid) {
      return res.status(401).json({ error: 'Invalid username/email or password.' });
    }

    const token = auth.createToken(user);
    return res.json({
      success: true,
      token,
      user: publicUser(user),
      expiresIn: auth.TOKEN_TTL_SECONDS
    });
  } catch (err) {
    if (err.code === 'DB_UNAVAILABLE') {
      return res.status(503).json({ error: err.message });
    }
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Could not sign you in. Please try again.' });
  }
});

// Return the signed-in user for a valid bearer token
app.get('/api/auth/me', async (req, res) => {
  try {
    const token = bearerToken(req);
    const payload = auth.verifyToken(token);
    if (!payload) {
      return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    }

    const user = await db.findUserById(payload.sub);
    if (!user) {
      return res.status(401).json({ error: 'Account no longer exists.' });
    }

    return res.json({ user: publicUser(user) });
  } catch (err) {
    if (err.code === 'DB_UNAVAILABLE') {
      return res.status(503).json({ error: err.message });
    }
    console.error('Session check error:', err);
    return res.status(500).json({ error: 'Could not verify your session.' });
  }
});

// Stateless tokens: the client discards its copy. Endpoint kept for a clean API.
app.post('/api/auth/logout', (req, res) => {
  res.json({ success: true });
});

function bearerToken(req) {
  const header = req.headers.authorization || '';
  const [scheme, value] = header.split(' ');
  return scheme && scheme.toLowerCase() === 'bearer' ? value : null;
}

// Every route below this line requires a valid portal session.
function requireAuth(req, res, next) {
  const token = bearerToken(req);
  const payload = auth.verifyToken(token);

  if (!payload) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }

  req.user = payload;
  next();
}

app.use('/api', requireAuth);

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

// Unknown API routes must never fall through to HTML.
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API route not found.' });
});

// Fallback to the built client for client-side navigation.
app.use((req, res) => {
  const builtIndex = path.join(DIST_DIR, 'index.html');
  if (fs.existsSync(builtIndex)) {
    return res.sendFile(builtIndex);
  }
  res
    .status(200)
    .type('text')
    .send(
      'Brand Review Desk API is running. Start the client with "npm run dev" and open http://localhost:3000.'
    );
});

// Start the server immediately so web UI & APIs are instantly responsive
function start() {
  app.listen(PORT, () => {
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
