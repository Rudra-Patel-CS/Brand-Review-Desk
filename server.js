/* Brand Review Desk - Express Server with MongoDB Atlas integration
   Serves the Brand Review Desk client and exposes REST endpoints
   with secure authentication, server-managed sessions, HttpOnly cookies,
   CSRF protection, and role-based access control (Admin, Approver, Reviewer).
*/

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const db = require('./db');
const auth = require('./auth');

const app = express();
// Render provides PORT for the public web service. Keep BACKEND_PORT as a
// local-development fallback only so it cannot override Render's assigned port.
const PORT = process.env.PORT || process.env.BACKEND_PORT || 3000;

// CORS configured for credentials (cookies)
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl) or any localhost/origin in dev
    callback(null, true);
  },
  credentials: true
}));

app.use(cookieParser());
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

// ── Rate Limiting for Authentication ──────────────────────────────────────────
const authAttempts = new Map();
const AUTH_WINDOW_MS = 15 * 60 * 1000;
const AUTH_MAX_ATTEMPTS = 15;

function authRateLimit(req, res, next) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = authAttempts.get(ip);

  if (!entry || now - entry.startedAt > AUTH_WINDOW_MS) {
    authAttempts.set(ip, { startedAt: now, count: 1 });
    return next();
  }

  entry.count += 1;
  if (entry.count > AUTH_MAX_ATTEMPTS) {
    return res.status(429).json({
      error: 'Too many authentication attempts. Please wait 15 minutes before trying again.'
    });
  }
  next();
}

// Helper to extract session ID from cookie or Authorization header
function extractSessionId(req) {
  if (req.cookies && req.cookies[auth.COOKIE_NAME]) {
    return req.cookies[auth.COOKIE_NAME];
  }
  const header = req.headers.authorization || '';
  const [scheme, value] = header.split(' ');
  if (scheme && scheme.toLowerCase() === 'bearer' && value) {
    return value;
  }
  return null;
}

// ── Public Authentication Endpoints ───────────────────────────────────────────

// Check whether initial admin bootstrap is required (database has 0 users)
app.get('/api/auth/bootstrap-status', async (req, res) => {
  try {
    const userCount = await db.countUsers();
    res.json({
      bootstrapRequired: userCount === 0,
      userCount
    });
  } catch (err) {
    res.status(500).json({ error: 'Could not determine bootstrap status' });
  }
});

// First-admin bootstrap: works ONLY when database contains zero users
app.post('/api/auth/bootstrap', authRateLimit, async (req, res) => {
  try {
    const userCount = await db.countUsers();
    if (userCount > 0) {
      return res.status(403).json({
        error: 'Initial administrator already exists. Public bootstrap is disabled.'
      });
    }

    const { username, email, password } = req.body || {};
    const validationError = auth.validateRegistration({
      username,
      email,
      password,
      role: auth.ROLES.ADMIN
    });
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const passwordHash = await auth.hashPassword(password);
    const user = await db.createUser({
      username: String(username).trim(),
      email: String(email).trim(),
      passwordHash,
      role: auth.ROLES.ADMIN
    });

    const sessionId = auth.generateSessionId();
    const csrfToken = auth.generateCsrfToken();
    const expiresAt = new Date(Date.now() + auth.TOKEN_TTL_SECONDS * 1000);

    const session = await db.createSession({
      sessionId,
      userId: user._id,
      username: user.username,
      role: user.role,
      csrfToken,
      expiresAt,
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    res.cookie(auth.COOKIE_NAME, sessionId, auth.getCookieOptions());

    return res.status(201).json({
      success: true,
      user: auth.normalizeUser(user),
      csrfToken: session.csrfToken,
      message: 'Initial administrator account created. Welcome to Brand Review Desk!'
    });
  } catch (err) {
    if (err.code === 'USER_EXISTS') {
      return res.status(409).json({ error: err.message });
    }
    console.error('Bootstrap error:', err.message);
    return res.status(500).json({ error: 'Failed to bootstrap administrator account' });
  }
});

// Public registration endpoint: disabled once initial administrator exists
app.post('/api/auth/register', authRateLimit, async (req, res) => {
  try {
    const userCount = await db.countUsers();
    if (userCount > 0) {
      return res.status(403).json({
        error: 'Public registration is disabled. Please contact your workspace administrator to provision an account.'
      });
    }

    // If 0 users, redirect logic to bootstrap
    const { username, email, password } = req.body || {};
    const validationError = auth.validateRegistration({
      username,
      email,
      password,
      role: auth.ROLES.ADMIN
    });
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const passwordHash = await auth.hashPassword(password);
    const user = await db.createUser({
      username: String(username).trim(),
      email: String(email).trim(),
      passwordHash,
      role: auth.ROLES.ADMIN
    });

    const sessionId = auth.generateSessionId();
    const csrfToken = auth.generateCsrfToken();
    const expiresAt = new Date(Date.now() + auth.TOKEN_TTL_SECONDS * 1000);

    const session = await db.createSession({
      sessionId,
      userId: user._id,
      username: user.username,
      role: user.role,
      csrfToken,
      expiresAt,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.cookie(auth.COOKIE_NAME, sessionId, auth.getCookieOptions());

    return res.status(201).json({
      success: true,
      user: auth.normalizeUser(user),
      csrfToken: session.csrfToken,
      message: 'Initial administrator account created.'
    });
  } catch (err) {
    if (err.code === 'USER_EXISTS') {
      return res.status(409).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Could not create account.' });
  }
});

// Sign in with username or email
app.post('/api/auth/login', authRateLimit, async (req, res) => {
  try {
    const { identifier, username, email, password } = req.body || {};
    const validationError = auth.validateLogin({ identifier, username, email, password });
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const loginId = identifier || username || email;
    const user = await db.findUser(loginId);
    const isValid = user ? await auth.verifyPassword(password, user.passwordHash) : false;

    if (!user || !isValid) {
      return res.status(401).json({ error: 'Invalid username/email or password.' });
    }

    if (user.disabled || user.status === 'disabled') {
      return res.status(403).json({ error: 'Your account has been disabled. Please contact an administrator.' });
    }

    // Create a new server-managed session
    const sessionId = auth.generateSessionId();
    const csrfToken = auth.generateCsrfToken();
    const expiresAt = new Date(Date.now() + auth.TOKEN_TTL_SECONDS * 1000);

    const session = await db.createSession({
      sessionId,
      userId: user._id,
      username: user.username,
      role: user.role,
      csrfToken,
      expiresAt,
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    res.cookie(auth.COOKIE_NAME, sessionId, auth.getCookieOptions());

    return res.json({
      success: true,
      user: auth.normalizeUser(user),
      csrfToken: session.csrfToken,
      expiresIn: auth.TOKEN_TTL_SECONDS
    });
  } catch (err) {
    console.error('Login error:', err.message);
    return res.status(500).json({ error: 'Could not sign you in. Please try again.' });
  }
});

// Current user and session verification
app.get('/api/auth/me', async (req, res) => {
  try {
    const sessionId = extractSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: 'Not authenticated. Please sign in.' });
    }

    const session = await db.findSession(sessionId);
    if (!session) {
      res.clearCookie(auth.COOKIE_NAME, { path: '/' });
      return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    }

    const user = await db.findUserById(session.userId);
    if (!user) {
      await db.deleteSession(sessionId);
      res.clearCookie(auth.COOKIE_NAME, { path: '/' });
      return res.status(401).json({ error: 'Account no longer exists.' });
    }

    if (user.disabled || user.status === 'disabled') {
      await db.deleteSession(sessionId);
      res.clearCookie(auth.COOKIE_NAME, { path: '/' });
      return res.status(403).json({ error: 'Your account has been disabled.' });
    }

    return res.json({
      user: auth.normalizeUser(user),
      csrfToken: session.csrfToken
    });
  } catch (err) {
    return res.status(500).json({ error: 'Could not verify your session.' });
  }
});

// End session & clear cookie
app.post('/api/auth/logout', async (req, res) => {
  try {
    const sessionId = extractSessionId(req);
    if (sessionId) {
      await db.deleteSession(sessionId);
    }
  } catch (err) {
    // Ignore error on logout
  }
  res.clearCookie(auth.COOKIE_NAME, { path: '/' });
  res.json({ success: true, message: 'Signed out successfully.' });
});

// ── Authentication & CSRF Middleware for Protected Endpoints ──────────────────
async function requireAuth(req, res, next) {
  const sessionId = extractSessionId(req);
  if (!sessionId) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }

  const session = await db.findSession(sessionId);
  if (!session) {
    res.clearCookie(auth.COOKIE_NAME, { path: '/' });
    return res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
  }

  const user = await db.findUserById(session.userId);
  if (!user) {
    await db.deleteSession(sessionId);
    res.clearCookie(auth.COOKIE_NAME, { path: '/' });
    return res.status(401).json({ error: 'User account no longer exists.' });
  }

  if (user.disabled || user.status === 'disabled') {
    await db.deleteSession(sessionId);
    res.clearCookie(auth.COOKIE_NAME, { path: '/' });
    return res.status(403).json({ error: 'Your account has been disabled. Please contact an administrator.' });
  }

  // CSRF Protection for state-mutating requests when using Cookie session
  const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase());
  const isCookieAuth = Boolean(req.cookies && req.cookies[auth.COOKIE_NAME]);

  if (isMutating && isCookieAuth) {
    const clientCsrfToken = req.headers['x-csrf-token'];
    if (!clientCsrfToken || clientCsrfToken !== session.csrfToken) {
      return res.status(403).json({ error: 'Invalid or missing CSRF token.' });
    }
  }

  req.user = auth.normalizeUser(user);
  req.session = session;
  next();
}

// Role-Based Authorization Middleware
function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden: This action requires one of the following roles: ${allowedRoles.join(', ')}.`
      });
    }
    next();
  };
}

// ── Admin User Management Endpoints ───────────────────────────────────────────

// List all users (admin only)
app.get('/api/users', requireAuth, requireRole([auth.ROLES.ADMIN]), async (req, res) => {
  try {
    const users = await db.listUsers();
    res.json(users.map(auth.normalizeUser));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create user with assigned role (admin only)
app.post('/api/users', requireAuth, requireRole([auth.ROLES.ADMIN]), async (req, res) => {
  try {
    const { username, email, password, role } = req.body || {};
    const validationError = auth.validateRegistration({ username, email, password, role });
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const passwordHash = await auth.hashPassword(password);
    const user = await db.createUser({
      username: String(username).trim(),
      email: String(email).trim(),
      passwordHash,
      role: role || auth.ROLES.REVIEWER
    });

    res.status(201).json({
      success: true,
      user: auth.normalizeUser(user),
      message: `User ${user.username} created with role ${user.role}.`
    });
  } catch (err) {
    if (err.code === 'USER_EXISTS') {
      return res.status(409).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

// Update user role or disabled status (admin only)
app.patch('/api/users/:id', requireAuth, requireRole([auth.ROLES.ADMIN]), async (req, res) => {
  try {
    const targetId = req.params.id;
    const { role, disabled, email } = req.body || {};

    if (role && !auth.VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${auth.VALID_ROLES.join(', ')}` });
    }

    const targetUser = await db.findUserById(targetId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Safety: prevent self-demoting or self-disabling the active admin
    if (String(req.user.id) === String(targetId)) {
      if (disabled === true) {
        return res.status(400).json({ error: 'Administrators cannot disable their own account.' });
      }
      if (role && role !== auth.ROLES.ADMIN) {
        return res.status(400).json({ error: 'Administrators cannot remove their own admin role.' });
      }
    }

    const updated = await db.updateUser(targetId, { role, disabled, email });

    res.json({
      success: true,
      user: auth.normalizeUser(updated),
      message: `User ${updated.username} updated.`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Workspace & Campaign Endpoints ────────────────────────────────────────────

// Full workspace snapshot (requires authentication)
app.get('/api/workspace', requireAuth, async (req, res) => {
  try {
    const snapshot = await db.getWorkspaceSnapshot();
    res.json(snapshot);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save or update a workspace campaign (reviewer, approver, admin)
app.post('/api/workspace/campaigns', requireAuth, async (req, res) => {
  try {
    const campaign = req.body;
    if (!campaign || !campaign.title) {
      return res.status(400).json({ error: 'Campaign title is required' });
    }
    campaign.id = String(campaign.id || `campaign-${Date.now()}`);
    const saved = await db.saveWorkspaceCampaign(campaign);
    res.status(201).json({ success: true, campaign: saved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/workspace/campaigns/:id', requireAuth, async (req, res) => {
  try {
    const campaign = req.body;
    if (!campaign || !campaign.title) {
      return res.status(400).json({ error: 'Campaign title is required' });
    }
    campaign.id = req.params.id;
    const saved = await db.saveWorkspaceCampaign(campaign);
    res.json({ success: true, campaign: saved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save or update a brand rule (admin or approver)
app.put('/api/workspace/rules/:id', requireAuth, requireRole([auth.ROLES.ADMIN, auth.ROLES.APPROVER]), async (req, res) => {
  try {
    const rule = req.body;
    if (!rule || !rule.brand || !rule.title) {
      return res.status(400).json({ error: 'Rule title and brand are required' });
    }
    rule.id = req.params.id;
    const saved = await db.saveWorkspaceRule(rule);
    res.json({ success: true, rule: saved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a brand rule (admin only)
app.delete('/api/workspace/rules/:id', requireAuth, requireRole([auth.ROLES.ADMIN]), async (req, res) => {
  try {
    const result = await db.deleteWorkspaceRule(req.params.id, String(req.query.brand || ''));
    res.json({ success: true, deleted: result.deletedCount > 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// File and approve a review (approver or admin only!)
app.post('/api/workspace/reviews', requireAuth, requireRole([auth.ROLES.ADMIN, auth.ROLES.APPROVER]), async (req, res) => {
  try {
    const reviewData = req.body;
    if (!reviewData || !reviewData.campaignTitle) {
      return res.status(400).json({ error: 'A campaign title is required' });
    }

    // Bind real authenticated user identity to the review record
    const review = {
      ...reviewData,
      reviewerName: req.user.username,
      reviewerRole: req.user.role === auth.ROLES.ADMIN ? 'Workspace Administrator' : 'Senior Compliance Approver',
      reviewerId: req.user.id,
      timestamp: new Date()
    };

    const saved = await db.addWorkspaceReview(review);
    res.status(201).json({ success: true, review: saved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Legacy Routes (Preserved with auth protection) ─────────────────────────────
app.get('/api/ruleset', requireAuth, async (req, res) => {
  try {
    const ruleset = await db.getActiveRuleset(req.query.brand);
    res.json(ruleset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ruleset', requireAuth, requireRole([auth.ROLES.ADMIN, auth.ROLES.APPROVER]), async (req, res) => {
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

app.post('/api/ruleset/reset', requireAuth, requireRole([auth.ROLES.ADMIN]), async (req, res) => {
  try {
    const reset = await db.resetRuleset();
    res.json({ success: true, ruleset: reset });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/draft', requireAuth, async (req, res) => {
  try {
    const draft = await db.getLatestDraft();
    res.json(draft || { empty: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/draft', requireAuth, async (req, res) => {
  try {
    const saved = await db.saveDraft(req.body);
    res.json({ success: true, draft: saved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reviews', requireAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const reviews = await db.getReviews(limit);
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/reviews', requireAuth, requireRole([auth.ROLES.ADMIN, auth.ROLES.APPROVER]), async (req, res) => {
  try {
    const review = req.body;
    if (!review || !review.contentName) {
      return res.status(400).json({ error: 'contentName is required' });
    }
    review.reviewerName = req.user.username;
    review.reviewerRole = req.user.role === auth.ROLES.ADMIN ? 'Workspace Administrator' : 'Senior Compliance Approver';
    const saved = await db.addReview(review);
    res.json({ success: true, review: saved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/reviews/:id', requireAuth, requireRole([auth.ROLES.ADMIN]), async (req, res) => {
  try {
    const result = await db.deleteReview(req.params.id);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/brands', requireAuth, async (req, res) => {
  try {
    const brands = await db.getBrands();
    res.json(brands);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/insights', requireAuth, async (req, res) => {
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

// Start the server immediately
function start() {
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Brand Review Desk server listening on http://localhost:${PORT}`);
  });
  db.connectDB().then(() => {
    console.log('Database connection initialized.');
  }).catch((err) => {
    console.warn('Initial database connection notice:', err.message);
  });
  return server;
}

if (require.main === module) {
  start();
}

module.exports = { app, start };
