import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';

const workflow = require('../workflow');
const db = require('../db');
const auth = require('../auth');

let testServer: http.Server | null = null;
let serverPort: number = 0;
let reviewerCookie: string = '';
let reviewerCsrf: string = '';
let reviewerUser: any = null;

let approverCookie: string = '';
let approverCsrf: string = '';
let approverUser: any = null;

let adminCookie: string = '';
let adminCsrf: string = '';
let adminUser: any = null;

test('Setup Workflow test server & authenticate accounts (Reviewer, Approver, Admin)', async () => {
  const { app } = require('../server');
  testServer = http.createServer(app);

  await new Promise<void>((resolve) => {
    testServer!.listen(0, '127.0.0.1', () => {
      const addr = testServer!.address();
      if (addr && typeof addr === 'object') {
        serverPort = addr.port;
      }
      resolve();
    });
  });

  const pwdHash = await auth.hashPassword('SuperSecretTest123!');

  // 1. Create Reviewer
  reviewerUser = await db.createUser({
    username: `wf_rev_${Date.now()}`,
    email: `wf_rev_${Date.now()}@example.com`,
    passwordHash: pwdHash,
    role: auth.ROLES.REVIEWER
  });
  const revSessionId = auth.generateSessionId();
  reviewerCsrf = auth.generateCsrfToken();
  await db.createSession({
    sessionId: revSessionId,
    userId: reviewerUser._id,
    username: reviewerUser.username,
    role: reviewerUser.role,
    csrfToken: reviewerCsrf,
    expiresAt: new Date(Date.now() + 3600000),
    ip: '127.0.0.1',
    userAgent: 'test-wf-reviewer'
  });
  reviewerCookie = `${auth.COOKIE_NAME}=${revSessionId}`;

  // 2. Create Approver
  approverUser = await db.createUser({
    username: `wf_app_${Date.now()}`,
    email: `wf_app_${Date.now()}@example.com`,
    passwordHash: pwdHash,
    role: auth.ROLES.APPROVER
  });
  const appSessionId = auth.generateSessionId();
  approverCsrf = auth.generateCsrfToken();
  await db.createSession({
    sessionId: appSessionId,
    userId: approverUser._id,
    username: approverUser.username,
    role: approverUser.role,
    csrfToken: approverCsrf,
    expiresAt: new Date(Date.now() + 3600000),
    ip: '127.0.0.1',
    userAgent: 'test-wf-approver'
  });
  approverCookie = `${auth.COOKIE_NAME}=${appSessionId}`;

  // 3. Create Admin
  adminUser = await db.createUser({
    username: `wf_adm_${Date.now()}`,
    email: `wf_adm_${Date.now()}@example.com`,
    passwordHash: pwdHash,
    role: auth.ROLES.ADMIN
  });
  const admSessionId = auth.generateSessionId();
  adminCsrf = auth.generateCsrfToken();
  await db.createSession({
    sessionId: admSessionId,
    userId: adminUser._id,
    username: adminUser.username,
    role: adminUser.role,
    csrfToken: adminCsrf,
    expiresAt: new Date(Date.now() + 3600000),
    ip: '127.0.0.1',
    userAgent: 'test-wf-admin'
  });
  adminCookie = `${auth.COOKIE_NAME}=${admSessionId}`;
});

test('Feature 4 - Reject invalid status transitions with 400', async () => {
  const campId = `wf-camp-invalid-${Date.now()}`;
  await db.saveWorkspaceCampaign({
    id: campId,
    code: 'WF-001',
    title: 'Draft Campaign',
    status: 'draft',
    caption: 'Clean copy',
    initialFindings: []
  });

  // Attempt draft -> approved directly (skipping in_review)
  const res = await fetch(`http://127.0.0.1:${serverPort}/api/workspace/campaigns/${campId}/transition`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: approverCookie,
      'X-CSRF-Token': approverCsrf
    },
    body: JSON.stringify({ targetStatus: 'approved' })
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.code, 'INVALID_TRANSITION');
  assert.match(data.error, /cannot transition campaign from "draft" to "approved"/i);
});

test('Feature 4 - Enforce role authorization (Reviewers cannot approve or reject)', async () => {
  const campId = `wf-camp-role-${Date.now()}`;
  await db.saveWorkspaceCampaign({
    id: campId,
    code: 'WF-002',
    title: 'In Review Campaign',
    status: 'in_review',
    caption: 'Ready for approver',
    initialFindings: []
  });

  // Reviewer attempts to approve
  const resApprove = await fetch(`http://127.0.0.1:${serverPort}/api/workspace/campaigns/${campId}/transition`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: reviewerCookie,
      'X-CSRF-Token': reviewerCsrf
    },
    body: JSON.stringify({ targetStatus: 'approved' })
  });

  assert.equal(resApprove.status, 403);
  const dataApprove = await resApprove.json();
  assert.equal(dataApprove.code, 'UNAUTHORIZED_ROLE');

  // Reviewer attempts to reject
  const resReject = await fetch(`http://127.0.0.1:${serverPort}/api/workspace/campaigns/${campId}/transition`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: reviewerCookie,
      'X-CSRF-Token': reviewerCsrf
    },
    body: JSON.stringify({ targetStatus: 'rejected', notes: 'Attempted reviewer rejection' })
  });

  assert.equal(resReject.status, 403);
  const dataReject = await resReject.json();
  assert.equal(dataReject.code, 'UNAUTHORIZED_ROLE');
});

test('Feature 4 - Complete valid workflow: Draft -> In Review -> Changes Requested -> In Review -> Approved', async () => {
  const campId = `wf-camp-valid-${Date.now()}`;
  await db.saveWorkspaceCampaign({
    id: campId,
    code: 'WF-003',
    title: 'Multi-stage Campaign',
    status: 'draft',
    caption: 'Draft body copy',
    initialFindings: []
  });

  // Step 1: Reviewer submits Draft -> In Review
  const resSubmit = await fetch(`http://127.0.0.1:${serverPort}/api/workspace/campaigns/${campId}/transition`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: reviewerCookie,
      'X-CSRF-Token': reviewerCsrf
    },
    body: JSON.stringify({ targetStatus: 'in_review', notes: 'Initial audit complete' })
  });
  assert.equal(resSubmit.status, 200);
  const dataSubmit = await resSubmit.json();
  assert.equal(dataSubmit.toStatus, 'in_review');
  assert.equal(dataSubmit.campaign.reviewedBy, reviewerUser.username);

  // Step 2: Approver requests changes (In Review -> Changes Requested)
  const resChanges = await fetch(`http://127.0.0.1:${serverPort}/api/workspace/campaigns/${campId}/transition`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: approverCookie,
      'X-CSRF-Token': approverCsrf
    },
    body: JSON.stringify({
      targetStatus: 'changes_requested',
      requestedChanges: 'Please add dietary allergen disclaimer footnote.'
    })
  });
  assert.equal(resChanges.status, 200);
  const dataChanges = await resChanges.json();
  assert.equal(dataChanges.toStatus, 'changes_requested');
  assert.equal(dataChanges.campaign.requestedChanges, 'Please add dietary allergen disclaimer footnote.');

  // Step 3: Reviewer re-submits (Changes Requested -> In Review)
  const resResubmit = await fetch(`http://127.0.0.1:${serverPort}/api/workspace/campaigns/${campId}/transition`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: reviewerCookie,
      'X-CSRF-Token': reviewerCsrf
    },
    body: JSON.stringify({ targetStatus: 'in_review', notes: 'Allergen footnote appended.' })
  });
  assert.equal(resResubmit.status, 200);
  const dataResubmit = await resResubmit.json();
  assert.equal(dataResubmit.toStatus, 'in_review');

  // Step 4: Approver approves (In Review -> Approved)
  const resApprove = await fetch(`http://127.0.0.1:${serverPort}/api/workspace/campaigns/${campId}/transition`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: approverCookie,
      'X-CSRF-Token': approverCsrf
    },
    body: JSON.stringify({ targetStatus: 'approved', notes: 'Final creative approved.' })
  });
  assert.equal(resApprove.status, 200);
  const dataApprove = await resApprove.json();
  assert.equal(dataApprove.toStatus, 'approved');
  assert.equal(dataApprove.campaign.approvedBy, approverUser.username);
  assert.ok(dataApprove.campaign.approvedAt);
});

test('Feature 4 - Self-approval restriction: Creator/Reviewer cannot approve their own campaign', async () => {
  const campId = `wf-camp-self-${Date.now()}`;
  // Approver user is set as the creator/reviewer of this campaign
  await db.saveWorkspaceCampaign({
    id: campId,
    code: 'WF-SELF',
    title: 'Self-Authored Campaign',
    status: 'in_review',
    createdBy: approverUser.username,
    creatorId: approverUser._id,
    reviewedBy: approverUser.username,
    reviewerId: approverUser._id,
    initialFindings: []
  });

  // Approver attempts to approve their own work
  const res = await fetch(`http://127.0.0.1:${serverPort}/api/workspace/campaigns/${campId}/transition`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: approverCookie,
      'X-CSRF-Token': approverCsrf
    },
    body: JSON.stringify({ targetStatus: 'approved' })
  });

  assert.equal(res.status, 403);
  const data = await res.json();
  assert.equal(data.code, 'SELF_APPROVAL_RESTRICTED');
  assert.match(data.error, /You cannot approve a campaign you created or reviewed/i);

  // An independent Admin can approve it
  const resAdmin = await fetch(`http://127.0.0.1:${serverPort}/api/workspace/campaigns/${campId}/transition`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: adminCookie,
      'X-CSRF-Token': adminCsrf
    },
    body: JSON.stringify({ targetStatus: 'approved', notes: 'Independent administrator sign-off' })
  });
  assert.equal(resAdmin.status, 200);
  const dataAdmin = await resAdmin.json();
  assert.equal(dataAdmin.toStatus, 'approved');
  assert.equal(dataAdmin.campaign.approvedBy, adminUser.username);
});

test('Feature 4 - Require written override justification when approving unresolved critical findings', async () => {
  const campId = `wf-camp-critical-${Date.now()}`;
  await db.saveWorkspaceCampaign({
    id: campId,
    code: 'WF-CRIT',
    title: 'Critical Claim Campaign',
    status: 'in_review',
    createdBy: reviewerUser.username,
    initialFindings: [
      {
        id: 'crit-01',
        ruleId: 'HEALTH-01',
        ruleTitle: 'Curative Disease Claim',
        severity: 'critical',
        matchedText: '100% cure for fatigue',
        status: 'open'
      }
    ]
  });

  // 1. Attempt approval without override reason -> 400 blocked
  const resBlocked = await fetch(`http://127.0.0.1:${serverPort}/api/workspace/campaigns/${campId}/transition`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: approverCookie,
      'X-CSRF-Token': approverCsrf
    },
    body: JSON.stringify({ targetStatus: 'approved' })
  });

  assert.equal(resBlocked.status, 400);
  const dataBlocked = await resBlocked.json();
  assert.equal(dataBlocked.code, 'CRITICAL_OVERRIDE_REQUIRED');
  assert.match(dataBlocked.error, /written override justification/i);

  // 2. Supply written override reason -> approval permitted & logged
  const overrideText = 'Medical advisory board substantiation doc #MED-881 filed and verified by outside counsel.';
  const resAllowed = await fetch(`http://127.0.0.1:${serverPort}/api/workspace/campaigns/${campId}/transition`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: approverCookie,
      'X-CSRF-Token': approverCsrf
    },
    body: JSON.stringify({
      targetStatus: 'approved',
      criticalOverrideReason: overrideText
    })
  });

  assert.equal(resAllowed.status, 200);
  const dataAllowed = await resAllowed.json();
  assert.equal(dataAllowed.toStatus, 'approved');
  assert.equal(dataAllowed.campaign.criticalOverrideReason, overrideText);
  assert.equal(dataAllowed.campaign.overrideApprovedBy, approverUser.username);
});

test('Feature 4 - Chronological event history logging & duplicate event prevention (idempotency)', async () => {
  const campId = `wf-camp-events-${Date.now()}`;
  await db.saveWorkspaceCampaign({
    id: campId,
    code: 'WF-EVT',
    title: 'Event Audit Campaign',
    status: 'draft',
    initialFindings: []
  });

  const idempotencyKey = `idemp-key-${Date.now()}`;

  // Call transition with idempotency key
  const res1 = await fetch(`http://127.0.0.1:${serverPort}/api/workspace/campaigns/${campId}/transition`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: reviewerCookie,
      'X-CSRF-Token': reviewerCsrf
    },
    body: JSON.stringify({
      targetStatus: 'in_review',
      idempotencyKey
    })
  });
  assert.equal(res1.status, 200);

  // Add reviewer comment
  const resComment = await fetch(`http://127.0.0.1:${serverPort}/api/workspace/campaigns/${campId}/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: reviewerCookie,
      'X-CSRF-Token': reviewerCsrf
    },
    body: JSON.stringify({ comment: 'Disclaimers reviewed against FTC guidance.' })
  });
  assert.equal(resComment.status, 201);

  // Fetch chronological event history
  const resEvents = await fetch(`http://127.0.0.1:${serverPort}/api/workspace/campaigns/${campId}/events`, {
    headers: { Cookie: reviewerCookie }
  });
  assert.equal(resEvents.status, 200);
  const events = await resEvents.json();

  assert.ok(Array.isArray(events));
  assert.ok(events.length >= 2, 'Should contain at least submitted event and comment event');

  const submitEvt = events.find((e: any) => e.actionType === 'campaign_submitted');
  assert.ok(submitEvt);
  assert.equal(submitEvt.user.username, reviewerUser.username);
  assert.equal(submitEvt.idempotencyKey, idempotencyKey);

  const commentEvt = events.find((e: any) => e.actionType === 'comment_added');
  assert.ok(commentEvt);
  assert.equal(commentEvt.details.comment, 'Disclaimers reviewed against FTC guidance.');

  // Verify timestamps are in chronological order
  for (let i = 0; i < events.length - 1; i++) {
    const t1 = new Date(events[i].timestamp).getTime();
    const t2 = new Date(events[i + 1].timestamp).getTime();
    assert.ok(t1 <= t2, 'Events must be in chronological order');
  }

  // Idempotency: re-logging event with same key returns existing event without duplicates
  const dupEvent = await workflow.logEvent(
    {
      campaignId: campId,
      actionType: 'campaign_submitted',
      idempotencyKey
    },
    { memoryStore: db.memoryStore }
  );
  assert.equal(dupEvent.id, submitEvt.id);
});

test('Feature 4 - Export review audit packet in JSON format', async () => {
  const campId = `wf-camp-export-${Date.now()}`;
  await db.saveWorkspaceCampaign({
    id: campId,
    code: 'WF-EXP',
    title: 'Audited Creative Export',
    status: 'in_review',
    caption: 'Verified campaign copy',
    ocrText: '100% Organics',
    ocrConfidence: 96,
    initialFindings: [
      { id: 'f1', ruleId: 'FB-012', ruleTitle: 'Claim', severity: 'warning', status: 'open', matchedText: '100%' }
    ]
  });

  const res = await fetch(`http://127.0.0.1:${serverPort}/api/workspace/campaigns/${campId}/export`, {
    headers: { Cookie: adminCookie }
  });

  assert.equal(res.status, 200);
  const cd = res.headers.get('content-disposition');
  assert.ok(cd && cd.includes('attachment'));
  assert.ok(cd && cd.includes('review-audit-'));

  const exportPacket = await res.json();
  assert.equal(exportPacket.exportVersion, '2.0');
  assert.ok(exportPacket.generatedAt);
  assert.equal(exportPacket.exportedBy.username, adminUser.username);
  assert.equal(exportPacket.campaign.code, 'WF-EXP');
  assert.ok(Array.isArray(exportPacket.complianceSummary.findings));
  assert.ok(Array.isArray(exportPacket.auditTrail));
});

test('Teardown Workflow test server', async () => {
  if (testServer) {
    await new Promise<void>((resolve) => testServer!.close(() => resolve()));
  }
});
