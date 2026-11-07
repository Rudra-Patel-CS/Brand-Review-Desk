/* Brand Review Desk - Secure Authentication & Session Module
   - Password hashing with bcrypt (12 rounds) + legacy scrypt verification fallback
   - Server-managed sessions (MongoDB sessions collection with in-memory fallback)
   - HttpOnly, Secure, SameSite cookies
   - CSRF protection for state-mutating requests
   - Role-Based Access Control (Admin, Approver, Reviewer)
*/

const crypto = require('crypto');
const { promisify } = require('util');
const bcrypt = require('bcryptjs');

const scrypt = promisify(crypto.scrypt);

const TOKEN_TTL_SECONDS = parseInt(process.env.AUTH_TOKEN_TTL, 10) || 60 * 60 * 24 * 7; // 7 days
const COOKIE_NAME = 'brd_session';

const ROLES = {
  ADMIN: 'admin',
  APPROVER: 'approver',
  REVIEWER: 'reviewer'
};

const VALID_ROLES = [ROLES.ADMIN, ROLES.APPROVER, ROLES.REVIEWER];

const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: {
    canManageUsers: true,
    canEditRules: true,
    canDeleteRules: true,
    canUploadCampaigns: true,
    canEditCampaigns: true,
    canApproveReviews: true,
    canExportAuditPacks: true,
    canRunOcr: true
  },
  [ROLES.APPROVER]: {
    canManageUsers: false,
    canEditRules: true,
    canDeleteRules: false,
    canUploadCampaigns: true,
    canEditCampaigns: true,
    canApproveReviews: true,
    canExportAuditPacks: true,
    canRunOcr: true
  },
  [ROLES.REVIEWER]: {
    canManageUsers: false,
    canEditRules: false,
    canDeleteRules: false,
    canUploadCampaigns: true,
    canEditCampaigns: true,
    canApproveReviews: false, // Cannot approve final review
    canExportAuditPacks: false,
    canRunOcr: true
  }
};

// ── Password Hashing ──────────────────────────────────────────────────────────
const BCRYPT_ROUNDS = 12;
const SCRYPT_KEYLEN = 64;
const SCRYPT_PREFIX = 'scrypt';

async function hashPassword(password) {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

async function verifyPassword(password, storedHash) {
  if (!password || !storedHash) return false;

  // Modern bcrypt hash check (starts with $2a$, $2b$, or $2y$)
  if (/^\$2[aby]\$/.test(storedHash)) {
    return bcrypt.compare(password, storedHash);
  }

  // Legacy scrypt hash compatibility
  if (storedHash.startsWith(`${SCRYPT_PREFIX}$`)) {
    const parts = String(storedHash).split('$');
    if (parts.length !== 3) return false;
    const [, salt, expectedHex] = parts;
    const expected = Buffer.from(expectedHex, 'hex');
    if (expected.length !== SCRYPT_KEYLEN) return false;
    const derived = await scrypt(password, salt, SCRYPT_KEYLEN);
    return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
  }

  return false;
}

// ── Session & CSRF Token Generation ───────────────────────────────────────────
function generateSessionId() {
  return crypto.randomBytes(32).toString('hex');
}

function generateCsrfToken() {
  return crypto.randomBytes(24).toString('hex');
}

function getCookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: TOKEN_TTL_SECONDS * 1000,
    path: '/'
  };
}

// ── Validation ────────────────────────────────────────────────────────────────
const USERNAME_RE = /^[a-zA-Z0-9._-]{3,32}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateRegistration({ username, email, password, role }) {
  if (!username || !USERNAME_RE.test(String(username).trim())) {
    return 'Username must be 3-32 characters and use only letters, numbers, dots, dashes or underscores.';
  }
  if (!email || !EMAIL_RE.test(String(email).trim())) {
    return 'Please enter a valid email address.';
  }
  if (!password || String(password).length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (String(password).length > 200) {
    return 'Password is too long (maximum 200 characters).';
  }
  if (role && !VALID_ROLES.includes(role)) {
    return `Invalid role specified. Valid roles are: ${VALID_ROLES.join(', ')}.`;
  }
  return null;
}

function validateLogin({ identifier, username, email, password }) {
  const loginId = identifier || username || email;
  if (!loginId || !String(loginId).trim()) {
    return 'Username or email is required.';
  }
  if (!password) {
    return 'Password is required.';
  }
  return null;
}

function normalizeUser(user) {
  if (!user) return null;
  return {
    id: String(user._id || user.id),
    username: user.username,
    email: user.email || '',
    role: user.role || ROLES.REVIEWER,
    disabled: Boolean(user.disabled || user.status === 'disabled'),
    createdAt: user.createdAt || null
  };
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateSessionId,
  generateCsrfToken,
  getCookieOptions,
  validateRegistration,
  validateLogin,
  normalizeUser,
  ROLES,
  VALID_ROLES,
  ROLE_PERMISSIONS,
  COOKIE_NAME,
  TOKEN_TTL_SECONDS
};
