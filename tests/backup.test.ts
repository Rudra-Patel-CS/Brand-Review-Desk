import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

const db = require('../db');
const auth = require('../auth');

let testServer: http.Server | null = null;
let serverPort = 0;
let adminCookie = '';
let adminCsrf = '';
let reviewerCookie = '';
let reviewerCsrf = '';

function api(path: string, options: any = {}) {
  return fetch(`http://127.0.0.1:${serverPort}${path}`, options);
}

test('Setup Backup/Evidence test server with admin + reviewer accounts', async () => {
  db.setIsolatedTestMode(true);
  db.memoryStore.users = [];
  db.memoryStore.sessions = [];
  db.memoryStore.campaigns = [];
  db.memoryStore.events = [];
  db.memoryStore.evidence = [];
  const { app } = require('../server');
  testServer = http.createServer(app);
  await new Promise<void>((resolve) => {
    testServer!.listen(0, '127.0.0.1', () => {
      const addr = testServer!.address();
      if (addr && typeof addr === 'object') serverPort = addr.port;
      resolve();
    });
  });

  const pwdHash = await auth.hashPassword('SuperSecretTest123!');

  const admin = await db.createUser({
    username: `bk_adm_${Date.now()}`,
    email: `bk_adm_${Date.now()}@example.com`,
    passwordHash: pwdHash,
    role: auth.ROLES.ADMIN
  });
  const adminSessionId = auth.generateSessionId();
  adminCsrf = auth.generateCsrfToken();
  await db.createSession({
    sessionId: adminSessionId,
    userId: admin._id,
    username: admin.username,
    role: admin.role,
    csrfToken: adminCsrf,
    expiresAt: new Date(Date.now() + 3600000),
    ip: '127.0.0.1',
    userAgent: 'test-bk-admin'
  });
  adminCookie = `${auth.COOKIE_NAME}=${adminSessionId}`;

  const reviewer = await db.createUser({
    username: `bk_rev_${Date.now()}`,
    email: `bk_rev_${Date.now()}@example.com`,
    passwordHash: pwdHash,
    role: auth.ROLES.REVIEWER
  });
  const revSessionId = auth.generateSessionId();
  reviewerCsrf = auth.generateCsrfToken();
  await db.createSession({
    sessionId: revSessionId,
    userId: reviewer._id,
    username: reviewer.username,
    role: reviewer.role,
    csrfToken: reviewerCsrf,
    expiresAt: new Date(Date.now() + 3600000),
    ip: '127.0.0.1',
    userAgent: 'test-bk-reviewer'
  });
  reviewerCookie = `${auth.COOKIE_NAME}=${revSessionId}`;
});

test('Evidence API - create, list, update, delete round trip', async () => {
  const doc = {
    id: 'EVD-TEST-001',
    brandId: 'freshbites',
    claimKeywords: ['organic'],
    title: 'Test Certificate',
    docType: 'certificate',
    expiresAt: '2027-01-01'
  };
  const createRes = await api('/api/evidence', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie, 'X-CSRF-Token': adminCsrf },
    body: JSON.stringify(doc)
  });
  assert.equal(createRes.status, 201);

  const listRes = await api('/api/evidence', { headers: { Cookie: reviewerCookie } });
  assert.equal(listRes.status, 200);
  const list = await listRes.json();
  assert.ok(list.evidence.some((d: any) => d.id === 'EVD-TEST-001'));

  const updateRes = await api('/api/evidence/EVD-TEST-001', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie, 'X-CSRF-Token': adminCsrf },
    body: JSON.stringify({ ...doc, title: 'Updated Certificate' })
  });
  assert.equal(updateRes.status, 200);
  const updated = await updateRes.json();
  assert.equal(updated.document.title, 'Updated Certificate');

  const deleteRes = await api('/api/evidence/EVD-TEST-001', {
    method: 'DELETE',
    headers: { Cookie: adminCookie, 'X-CSRF-Token': adminCsrf }
  });
  assert.equal(deleteRes.status, 200);
  const after = await (await api('/api/evidence', { headers: { Cookie: reviewerCookie } })).json();
  assert.ok(!after.evidence.some((d: any) => d.id === 'EVD-TEST-001'));
});

test('Evidence API - reviewers cannot mutate evidence (403)', async () => {
  const res = await api('/api/evidence', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: reviewerCookie, 'X-CSRF-Token': reviewerCsrf },
    body: JSON.stringify({ id: 'EVD-NOPE', title: 'Nope', claimKeywords: ['x'] })
  });
  assert.equal(res.status, 403);
});

test('Evidence API - rejects malformed documents (400)', async () => {
  const res = await api('/api/evidence', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie, 'X-CSRF-Token': adminCsrf },
    body: JSON.stringify({ title: 'Missing id and keywords' })
  });
  assert.equal(res.status, 400);
});

test('Backup export - returns all collections in the documented format', async () => {
  await db.saveEvidenceDocument({
    id: 'EVD-BK-001',
    brandId: 'arka',
    claimKeywords: ['allergen'],
    title: 'Backup Test Doc',
    docType: 'policy'
  });
  const res = await api('/api/backup/export', { headers: { Cookie: adminCookie } });
  assert.equal(res.status, 200);
  const backup = await res.json();
  assert.equal(backup.format, 'brand-review-desk-backup');
  assert.equal(backup.version, 1);
  for (const name of ['brands', 'rules', 'rulesets', 'campaigns', 'reviews', 'drafts', 'events', 'evidence', 'users']) {
    assert.ok(Array.isArray(backup.collections[name]), `missing collection ${name}`);
  }
  assert.ok(backup.collections.evidence.some((d: any) => d.id === 'EVD-BK-001'));
});

test('Backup export - reviewers are denied (403)', async () => {
  const res = await api('/api/backup/export', { headers: { Cookie: reviewerCookie } });
  assert.equal(res.status, 403);
});

test('Backup import - requires explicit confirm flag', async () => {
  const res = await api('/api/backup/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie, 'X-CSRF-Token': adminCsrf },
    body: JSON.stringify({ backup: { format: 'brand-review-desk-backup', version: 1, collections: {} } })
  });
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.match(data.error, /confirm/);
});

test('Backup import - rejects wrong format and unknown collections', async () => {
  const badFormat = await api('/api/backup/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie, 'X-CSRF-Token': adminCsrf },
    body: JSON.stringify({ confirm: true, backup: { format: 'nope', version: 1, collections: {} } })
  });
  assert.equal(badFormat.status, 400);

  const unknownCollection = await api('/api/backup/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie, 'X-CSRF-Token': adminCsrf },
    body: JSON.stringify({
      confirm: true,
      backup: { format: 'brand-review-desk-backup', version: 1, collections: { secrets: [] } }
    })
  });
  assert.equal(unknownCollection.status, 400);
});

test('Backup round trip - export, mutate, restore returns original state', async () => {
  const exportRes = await api('/api/backup/export', { headers: { Cookie: adminCookie } });
  const backup = await exportRes.json();

  // Mutate: wipe evidence and add a marker campaign.
  db.memoryStore.evidence = [];
  db.memoryStore.campaigns = [{ id: 'marker-campaign', code: 'MARK-1', title: 'Marker', status: 'draft' }];

  const importRes = await api('/api/backup/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie, 'X-CSRF-Token': adminCsrf },
    body: JSON.stringify({ confirm: true, backup })
  });
  assert.equal(importRes.status, 200);
  const result = await importRes.json();
  assert.equal(result.ok, true);
  assert.ok(result.restored.evidence >= 1);

  const evidence = await db.listEvidence();
  assert.ok(evidence.some((d: any) => d.id === 'EVD-BK-001'));
  const campaigns = db.memoryStore.campaigns;
  assert.ok(!campaigns.some((c: any) => c.id === 'marker-campaign'));
});

test('Teardown Backup/Evidence test server', async () => {
  if (testServer) {
    await new Promise<void>((resolve) => testServer!.close(() => resolve()));
  }
});
