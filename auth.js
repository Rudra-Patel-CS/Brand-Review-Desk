/* Brand Review Desk - Authentication utilities
   Password hashing (scrypt) and stateless, signed session tokens (HMAC-SHA256).
   No external dependencies: everything uses Node's built-in crypto module.
*/

const crypto = require('crypto');
const { promisify } = require('util');

const scrypt = promisify(crypto.scrypt);

const TOKEN_TTL_SECONDS = parseInt(process.env.AUTH_TOKEN_TTL, 10) || 60 * 60 * 24 * 7; // 7 days
const AUTH_SECRET =
  process.env.AUTH_SECRET ||
  'brand-review-desk-dev-secret-change-me-in-env';

if (!process.env.AUTH_SECRET) {
  console.warn(
    '[auth] AUTH_SECRET is not set. Using an insecure development secret. Add AUTH_SECRET to .env before deploying.'
  );
}

// ── Password hashing ─────────────────────────────────────────────────────────
const SCRYPT_KEYLEN = 64;
const HASH_PREFIX = 'scrypt';

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = await scrypt(password, salt, SCRYPT_KEYLEN);
  return `${HASH_PREFIX}$${salt}$${derived.toString('hex')}`;
}

async function verifyPassword(password, storedHash) {
  if (!password || !storedHash) return false;

  const parts = String(storedHash).split('$');
  if (parts.length !== 3 || parts[0] !== HASH_PREFIX) return false;

  const [, salt, expectedHex] = parts;
  const expected = Buffer.from(expectedHex, 'hex');
  if (expected.length !== SCRYPT_KEYLEN) return false;

  const derived = await scrypt(password, salt, SCRYPT_KEYLEN);
  return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
}

// ── Signed tokens ────────────────────────────────────────────────────────────
function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64url(input) {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(padded, 'base64').toString('utf8');
}

function sign(data) {
  return base64url(crypto.createHmac('sha256', AUTH_SECRET).update(data).digest());
}

function createToken(user) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: String(user._id || user.id),
    username: user.username,
    role: user.role || 'user',
    iat: now,
    exp: now + TOKEN_TTL_SECONDS
  };

  const body = base64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;

  const [body, signature] = token.split('.');
  if (!body || !signature) return null;

  const expected = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(fromBase64url(body));
    if (!payload || !payload.sub || !payload.exp) return null;
    if (Math.floor(Date.now() / 1000) >= payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

// ── Validation ───────────────────────────────────────────────────────────────
const USERNAME_RE = /^[a-zA-Z0-9._-]{3,32}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateRegistration({ username, email, password }) {
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
    return 'Password is too long.';
  }
  return null;
}

function normalizeUser(user) {
  if (!user) return null;
  return {
    id: String(user._id || user.id),
    username: user.username,
    email: user.email || '',
    role: user.role || 'user',
    createdAt: user.createdAt || null
  };
}

module.exports = {
  hashPassword,
  verifyPassword,
  createToken,
  verifyToken,
  validateRegistration,
  normalizeUser,
  TOKEN_TTL_SECONDS
};
