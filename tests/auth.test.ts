import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { app } from '../server.js';
import db from '../db.js';
import auth from '../auth.js';

let server: http.Server;
let baseUrl: string;

function makeRequest(
  path: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
    cookie?: string;
  } = {}
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: any; cookies: string[] }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const reqHeaders: Record<string, string> = {
      ...(options.headers || {})
    };

    if (options.cookie) {
      reqHeaders['Cookie'] = options.cookie;
    }

    let payload: string | undefined;
    if (options.body !== undefined) {
      payload = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      if (!reqHeaders['Content-Type']) {
        reqHeaders['Content-Type'] = 'application/json';
      }
      reqHeaders['Content-Length'] = Buffer.byteLength(payload).toString();
    }

    const req = http.request(
      url,
      {
        method: options.method || 'GET',
        headers: reqHeaders
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => {
          rawData += chunk;
        });
        res.on('end', () => {
          let parsedBody = rawData;
          try {
            parsedBody = JSON.parse(rawData);
          } catch {
            // Keep as string
          }

          const rawCookies = res.headers['set-cookie'] || [];
          const cookies = Array.isArray(rawCookies) ? rawCookies : [rawCookies];

          resolve({
            status: res.statusCode || 0,
            headers: res.headers,
            body: parsedBody,
            cookies
          });
        });
      }
    );

    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

function extractCookieValue(setCookieHeaders: string[], cookieName: string): string | null {
  for (const header of setCookieHeaders) {
    const parts = header.split(';')[0].split('=');
    if (parts[0].trim() === cookieName) {
      return parts.slice(1).join('=');
    }
  }
  return null;
}

test('Setup test server and clean users/sessions', async () => {
  // Clear memory store users & sessions for isolated testing
  db.setIsolatedTestMode(true);
  db.memoryStore.users = [];
  db.memoryStore.sessions = [];

  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address() as any;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test('Feature 1 - First-admin bootstrap works only when no users exist', async () => {
  // 1. Initial bootstrap status should report bootstrapRequired = true
  const statusRes = await makeRequest('/api/auth/bootstrap-status');
  assert.equal(statusRes.status, 200);
  assert.equal(statusRes.body.bootstrapRequired, true);

  // 2. Initial admin bootstrap
  const bootstrapRes = await makeRequest('/api/auth/bootstrap', {
    method: 'POST',
    body: {
      username: 'admin.lead',
      email: 'admin.lead@branddesk.internal',
      password: 'AdminSecurePassword2026!'
    }
  });

  assert.equal(bootstrapRes.status, 201);
  assert.equal(bootstrapRes.body.success, true);
  assert.equal(bootstrapRes.body.user.role, 'admin');
  assert.equal(bootstrapRes.body.user.username, 'admin.lead');
  assert.ok(bootstrapRes.body.csrfToken, 'Should return a CSRF token');

  // Verify HttpOnly cookie was set
  const cookieValue = extractCookieValue(bootstrapRes.cookies, auth.COOKIE_NAME);
  assert.ok(cookieValue, 'Should set brd_session cookie');
  const cookieHeader = bootstrapRes.cookies.find((c) => c.startsWith(`${auth.COOKIE_NAME}=`)) || '';
  assert.ok(cookieHeader.toLowerCase().includes('httponly'), 'Cookie must have HttpOnly flag');

  // 3. Second bootstrap call must be rejected
  const secondBootstrapRes = await makeRequest('/api/auth/bootstrap', {
    method: 'POST',
    body: {
      username: 'attacker.admin',
      email: 'attacker@evil.corp',
      password: 'AttackerPassword123'
    }
  });
  assert.equal(secondBootstrapRes.status, 403);
  assert.ok(secondBootstrapRes.body.error.includes('disabled'), 'Bootstrap must be rejected when users exist');

  // 4. Public registration must now be disabled
  const registerRes = await makeRequest('/api/auth/register', {
    method: 'POST',
    body: {
      username: 'public.user',
      email: 'public@somewhere.com',
      password: 'Password12345!'
    }
  });
  assert.equal(registerRes.status, 403);
  assert.ok(registerRes.body.error.includes('disabled'), 'Public registration must be disabled');
});

test('Feature 1 - Session management, me endpoint, and CSRF protection', async () => {
  // Login as the bootstrap admin
  const loginRes = await makeRequest('/api/auth/login', {
    method: 'POST',
    body: {
      identifier: 'admin.lead',
      password: 'AdminSecurePassword2026!'
    }
  });

  assert.equal(loginRes.status, 200);
  const sessionCookie = `${auth.COOKIE_NAME}=${extractCookieValue(loginRes.cookies, auth.COOKIE_NAME)}`;
  const csrfToken = loginRes.body.csrfToken;

  // GET /api/auth/me should identify the user
  const meRes = await makeRequest('/api/auth/me', { cookie: sessionCookie });
  assert.equal(meRes.status, 200);
  assert.equal(meRes.body.user.username, 'admin.lead');
  assert.equal(meRes.body.user.role, 'admin');

  // Mutating request without CSRF token must be rejected with 403
  const noCsrfRes = await makeRequest('/api/workspace/campaigns', {
    method: 'POST',
    cookie: sessionCookie,
    body: { title: 'CSRF Test Campaign' }
  });
  assert.equal(noCsrfRes.status, 403, 'Mutating request without CSRF token must fail with 403');

  // Mutating request with invalid CSRF token must be rejected
  const badCsrfRes = await makeRequest('/api/workspace/campaigns', {
    method: 'POST',
    cookie: sessionCookie,
    headers: { 'X-CSRF-Token': 'invalid-token-12345' },
    body: { title: 'CSRF Test Campaign' }
  });
  assert.equal(badCsrfRes.status, 403, 'Mutating request with invalid CSRF token must fail');

  // Mutating request with valid CSRF token succeeds
  const goodCsrfRes = await makeRequest('/api/workspace/campaigns', {
    method: 'POST',
    cookie: sessionCookie,
    headers: { 'X-CSRF-Token': csrfToken },
    body: {
      id: 'camp-test-csrf',
      title: 'Valid CSRF Campaign',
      brandId: 'arka',
      caption: 'Valid caption'
    }
  });
  assert.equal(goodCsrfRes.status, 201);
});

test('Feature 1 - Role-Based Access Control (Admin, Approver, Reviewer)', async () => {
  // 1. Admin logs in
  const adminLogin = await makeRequest('/api/auth/login', {
    method: 'POST',
    body: { identifier: 'admin.lead', password: 'AdminSecurePassword2026!' }
  });
  const adminCookie = `${auth.COOKIE_NAME}=${extractCookieValue(adminLogin.cookies, auth.COOKIE_NAME)}`;
  const adminCsrf = adminLogin.body.csrfToken;

  // 2. Admin provisions a Reviewer and an Approver
  const createReviewerRes = await makeRequest('/api/users', {
    method: 'POST',
    cookie: adminCookie,
    headers: { 'X-CSRF-Token': adminCsrf },
    body: {
      username: 'rita.reviewer',
      email: 'rita@branddesk.internal',
      password: 'ReviewerPassword2026!',
      role: 'reviewer'
    }
  });
  assert.equal(createReviewerRes.status, 201);
  const reviewerId = createReviewerRes.body.user.id;

  const createApproverRes = await makeRequest('/api/users', {
    method: 'POST',
    cookie: adminCookie,
    headers: { 'X-CSRF-Token': adminCsrf },
    body: {
      username: 'arnold.approver',
      email: 'arnold@branddesk.internal',
      password: 'ApproverPassword2026!',
      role: 'approver'
    }
  });
  assert.equal(createApproverRes.status, 201);

  // 3. Reviewer signs in
  const reviewerLogin = await makeRequest('/api/auth/login', {
    method: 'POST',
    body: { identifier: 'rita.reviewer', password: 'ReviewerPassword2026!' }
  });
  assert.equal(reviewerLogin.status, 200);
  const reviewerCookie = `${auth.COOKIE_NAME}=${extractCookieValue(reviewerLogin.cookies, auth.COOKIE_NAME)}`;
  const reviewerCsrf = reviewerLogin.body.csrfToken;

  // 4. Reviewer tries to access user management endpoint -> 403 Forbidden
  const reviewerAccessUsers = await makeRequest('/api/users', { cookie: reviewerCookie });
  assert.equal(reviewerAccessUsers.status, 403, 'Reviewer must not access /api/users');

  // 5. Reviewer tries to approve/file a review -> 403 Forbidden
  const reviewerApproveRes = await makeRequest('/api/workspace/reviews', {
    method: 'POST',
    cookie: reviewerCookie,
    headers: { 'X-CSRF-Token': reviewerCsrf },
    body: {
      campaignTitle: 'Harvest Campaign',
      status: 'approved',
      findings: []
    }
  });
  assert.equal(reviewerApproveRes.status, 403, 'Reviewer cannot approve reviews');

  // 6. Approver signs in
  const approverLogin = await makeRequest('/api/auth/login', {
    method: 'POST',
    body: { identifier: 'arnold.approver', password: 'ApproverPassword2026!' }
  });
  assert.equal(approverLogin.status, 200);
  const approverCookie = `${auth.COOKIE_NAME}=${extractCookieValue(approverLogin.cookies, auth.COOKIE_NAME)}`;
  const approverCsrf = approverLogin.body.csrfToken;

  // 7. Approver approves review -> 201 Created and reviewerName is approver identity
  const approverApproveRes = await makeRequest('/api/workspace/reviews', {
    method: 'POST',
    cookie: approverCookie,
    headers: { 'X-CSRF-Token': approverCsrf },
    body: {
      campaignTitle: 'Harvest Campaign Approval',
      brandId: 'arka',
      status: 'approved',
      findings: []
    }
  });
  assert.equal(approverApproveRes.status, 201);
  assert.equal(approverApproveRes.body.review.reviewerName, 'arnold.approver');
  assert.equal(approverApproveRes.body.review.reviewerRole, 'Senior Compliance Approver');

  // 8. Admin disables reviewer account
  const disableRes = await makeRequest(`/api/users/${reviewerId}`, {
    method: 'PATCH',
    cookie: adminCookie,
    headers: { 'X-CSRF-Token': adminCsrf },
    body: { disabled: true }
  });
  assert.equal(disableRes.status, 200);

  // 9. Reviewer's existing session must immediately be rejected
  const disabledSessionCheck = await makeRequest('/api/workspace', { cookie: reviewerCookie });
  assert.equal(disabledSessionCheck.status, 403, 'Disabled account session must be rejected with 403');

  // 10. Reviewer cannot sign in again
  const disabledLoginAttempt = await makeRequest('/api/auth/login', {
    method: 'POST',
    body: { identifier: 'rita.reviewer', password: 'ReviewerPassword2026!' }
  });
  assert.equal(disabledLoginAttempt.status, 403);
  assert.ok(disabledLoginAttempt.body.error.includes('disabled'));
});

test('Feature 1 - Logout destroys session', async () => {
  const loginRes = await makeRequest('/api/auth/login', {
    method: 'POST',
    body: { identifier: 'arnold.approver', password: 'ApproverPassword2026!' }
  });
  const cookie = `${auth.COOKIE_NAME}=${extractCookieValue(loginRes.cookies, auth.COOKIE_NAME)}`;

  // Verify session works
  const meBefore = await makeRequest('/api/auth/me', { cookie });
  assert.equal(meBefore.status, 200);

  // Logout
  const logoutRes = await makeRequest('/api/auth/logout', { method: 'POST', cookie });
  assert.equal(logoutRes.status, 200);

  // Next request with that cookie fails
  const meAfter = await makeRequest('/api/auth/me', { cookie });
  assert.equal(meAfter.status, 401);
});

test('Feature 1 - Password hashing with bcrypt format verification', async () => {
  const adminUser = await db.findUser('admin.lead');
  assert.ok(adminUser, 'Admin user must exist');
  assert.ok(
    adminUser.passwordHash.startsWith('$2a$') || adminUser.passwordHash.startsWith('$2b$'),
    'Stored password hash must be a bcrypt hash ($2a$ or $2b$)'
  );
  assert.notEqual(adminUser.passwordHash, 'AdminSecurePassword2026!', 'Must not store plaintext password');

  // Verify bcrypt password verification
  const isValid = await auth.verifyPassword('AdminSecurePassword2026!', adminUser.passwordHash);
  assert.equal(isValid, true);
  const isInvalid = await auth.verifyPassword('WrongPassword', adminUser.passwordHash);
  assert.equal(isInvalid, false);
});

test('Feature 1 - Rate limiting on excessive failed authentication attempts', async () => {
  // Fire 16 failed login requests from the same test client
  let rateLimited = false;
  for (let i = 0; i < 18; i++) {
    const res = await makeRequest('/api/auth/login', {
      method: 'POST',
      body: { identifier: 'admin.lead', password: 'WrongPasswordEveryTime' }
    });
    if (res.status === 429) {
      rateLimited = true;
      assert.ok(res.body.error.includes('Too many'), 'Error message should indicate rate limit');
      break;
    }
  }
  assert.ok(rateLimited, 'Rate limiting should trigger on repeated failed logins');
});

test('Teardown test server', async () => {
  db.setIsolatedTestMode(false);
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
