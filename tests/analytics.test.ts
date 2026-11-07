import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

const analytics = require('../analytics');
const db = require('../db');
const auth = require('../auth');

let testServer: http.Server | null = null;
let serverPort: number = 0;
let reviewerCookie: string = '';
let reviewerCsrf: string = '';

test('Setup Analytics test server and authenticated reviewer session', async () => {
  db.setIsolatedTestMode(true);
  db.memoryStore.users = [];
  db.memoryStore.sessions = [];
  db.memoryStore.campaigns = [];
  db.memoryStore.events = [];

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

  const pwdHash = await auth.hashPassword('ReviewerSecret2026!');
  const user = await db.createUser({
    username: 'analyst_lead',
    email: 'analyst@branddesk.internal',
    passwordHash: pwdHash,
    role: auth.ROLES.REVIEWER
  });

  const sessionId = auth.generateSessionId();
  reviewerCsrf = auth.generateCsrfToken();
  await db.createSession({
    sessionId,
    userId: user._id || user.id,
    username: user.username,
    role: user.role,
    csrfToken: reviewerCsrf,
    expiresAt: new Date(Date.now() + 3600000)
  });

  reviewerCookie = `${auth.COOKIE_NAME}=${sessionId}`;
});

test('Feature 6: Metric calculations from database records', async () => {
  const now = new Date();
  const t0 = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago
  const t1 = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago

  const testCampaigns = [
    {
      id: 'camp-101',
      code: 'CMP-101',
      title: 'Spark Energy Drink Social Reel',
      brandId: 'arka',
      brandName: 'Arka Foods',
      agency: 'Apex Creative',
      channel: 'Social Reels',
      format: '9:16',
      status: 'approved',
      isDemo: false,
      createdAt: t0,
      approvedAt: t1,
      initialFindings: [
        { id: 'f-1', ruleId: 'FB-012', severity: 'critical', status: 'applied', source: 'caption' },
        { id: 'f-2', ruleId: 'FB-019', severity: 'warning', status: 'applied', source: 'ocr' }
      ]
    },
    {
      id: 'camp-102',
      code: 'CMP-102',
      title: 'Arka Organic Crisps Banner',
      brandId: 'arka',
      brandName: 'Arka Foods',
      agency: 'Apex Creative',
      channel: 'Display',
      format: '4:5',
      status: 'rejected',
      isDemo: false,
      createdAt: t0,
      initialFindings: [
        { id: 'f-3', ruleId: 'FB-012', severity: 'critical', status: 'open', source: 'caption' }
      ]
    },
    {
      id: 'camp-103',
      code: 'CMP-103',
      title: 'NovaTech AI Cloud Poster',
      brandId: 'novatech',
      brandName: 'NovaTech',
      agency: 'PixelCraft Studio',
      channel: 'Social Feed',
      format: '1:1',
      status: 'in_review',
      isDemo: false,
      createdAt: t0,
      initialFindings: [
        { id: 'f-4', ruleId: 'NT-008', severity: 'advisory', status: 'open', source: 'caption' }
      ]
    },
    {
      id: 'camp-104',
      code: 'REF-001',
      title: 'Wikimedia Reference Sample',
      brandId: 'global',
      brandName: 'Reference library',
      agency: 'Unassigned',
      channel: 'Reference',
      format: '4:3',
      status: 'draft',
      isDemo: true,
      referenceOnly: true,
      createdAt: t0,
      initialFindings: []
    }
  ];

  const testEvents = [
    {
      campaignId: 'camp-101',
      actionType: 'campaign_submitted',
      timestamp: t0
    },
    {
      campaignId: 'camp-101',
      actionType: 'campaign_approved',
      timestamp: t1 // 60 mins later
    },
    {
      campaignId: 'camp-102',
      actionType: 'campaign_submitted',
      timestamp: t0
    },
    {
      campaignId: 'camp-102',
      actionType: 'campaign_rejected',
      timestamp: new Date(t0.getTime() + 30 * 60 * 1000) // 30 mins later
    }
  ];

  const result = await analytics.calculateAnalytics({
    memoryStore: { campaigns: testCampaigns, events: testEvents },
    isConnected: false,
    filters: { timeframe: 'all', includeSample: true }
  });

  assert.equal(result.insufficientData, false);
  assert.equal(result.totalCampaigns, 4);
  assert.equal(result.productionCampaignsCount, 3);
  assert.equal(result.sampleCampaignsCount, 1);

  // Outcomes
  assert.equal(result.outcomes.approved, 1);
  assert.equal(result.outcomes.rejected, 1);
  assert.equal(result.outcomes.in_review, 1);
  assert.equal(result.outcomes.draft, 1);
  assert.equal(result.outcomes.approvalRate, 50); // 1 approved of 2 decided

  // Findings
  assert.equal(result.findingsSummary.total, 4);
  assert.equal(result.findingsSummary.resolved, 2);
  assert.equal(result.findingsSummary.open, 2);
  assert.equal(result.findingsSummary.resolutionRate, 50);
  assert.equal(result.findingsSummary.critical, 2);
  assert.equal(result.findingsSummary.warning, 1);
  assert.equal(result.findingsSummary.advisory, 1);
});

test('Feature 6: Turnaround-time calculations using real timestamps', async () => {
  const t0 = new Date('2026-02-10T10:00:00Z');
  const t1 = new Date('2026-02-10T10:45:00Z'); // 45 mins
  const t2 = new Date('2026-02-10T11:30:00Z'); // 90 mins

  const campaigns = [
    {
      id: 'c-turn-1',
      status: 'approved',
      isDemo: false,
      initialFindings: []
    },
    {
      id: 'c-turn-2',
      status: 'rejected',
      isDemo: false,
      initialFindings: []
    }
  ];

  const events = [
    { campaignId: 'c-turn-1', actionType: 'campaign_submitted', timestamp: t0 },
    { campaignId: 'c-turn-1', actionType: 'campaign_approved', timestamp: t1 },
    { campaignId: 'c-turn-2', actionType: 'campaign_submitted', timestamp: t0 },
    { campaignId: 'c-turn-2', actionType: 'campaign_rejected', timestamp: t2 }
  ];

  const result = await analytics.calculateAnalytics({
    memoryStore: { campaigns, events },
    isConnected: false,
    filters: { timeframe: 'all' }
  });

  // Average = (45 + 90) / 2 = 67.5 -> 68 minutes
  assert.equal(result.turnaround.completedReviewsCount, 2);
  assert.equal(result.turnaround.averageMinutes, 68);
  assert.equal(result.turnaround.averageDisplay, '1.1 hrs');
  assert.equal(result.turnaround.message, null);
});

test('Feature 6: Filtering by brand, agency, and date range', async () => {
  const campaigns = [
    {
      id: 'c-f1',
      brandId: 'arka',
      brandName: 'Arka Foods',
      agency: 'Apex Creative',
      status: 'approved',
      isDemo: false,
      createdAt: new Date()
    },
    {
      id: 'c-f2',
      brandId: 'freshbites',
      brandName: 'FreshBites',
      agency: 'PixelCraft',
      status: 'approved',
      isDemo: false,
      createdAt: new Date()
    },
    {
      id: 'c-f3',
      brandId: 'arka',
      brandName: 'Arka Foods',
      agency: 'PixelCraft',
      status: 'rejected',
      isDemo: false,
      createdAt: new Date()
    }
  ];

  // Filter by brand 'arka'
  const brandFiltered = await analytics.calculateAnalytics({
    memoryStore: { campaigns, events: [] },
    isConnected: false,
    filters: { brand: 'arka', timeframe: 'all' }
  });
  assert.equal(brandFiltered.totalCampaigns, 2);
  assert.ok(brandFiltered.campaigns.every((c: any) => c.brandId === 'arka'));

  // Filter by agency 'Apex Creative'
  const agencyFiltered = await analytics.calculateAnalytics({
    memoryStore: { campaigns, events: [] },
    isConnected: false,
    filters: { agency: 'Apex Creative', timeframe: 'all' }
  });
  assert.equal(agencyFiltered.totalCampaigns, 1);
  assert.equal(agencyFiltered.campaigns[0].agency, 'Apex Creative');

  // Filter by status 'rejected'
  const statusFiltered = await analytics.calculateAnalytics({
    memoryStore: { campaigns, events: [] },
    isConnected: false,
    filters: { status: 'rejected', timeframe: 'all' }
  });
  assert.equal(statusFiltered.totalCampaigns, 1);
  assert.equal(statusFiltered.campaigns[0].id, 'c-f3');
});

test('Feature 6: Separation of sample/demo and real data', async () => {
  const campaigns = [
    { id: 'c-real', isDemo: false, status: 'approved', title: 'Real Campaign' },
    { id: 'c-sample-1', isDemo: true, status: 'draft', title: 'Sample 1' },
    { id: 'c-sample-2', referenceOnly: true, status: 'draft', title: 'Reference 2' }
  ];

  // 1. With sample data included
  const withSample = await analytics.calculateAnalytics({
    memoryStore: { campaigns, events: [] },
    isConnected: false,
    filters: { includeSample: true, timeframe: 'all' }
  });
  assert.equal(withSample.totalCampaigns, 3);
  assert.equal(withSample.sampleCampaignsCount, 2);
  assert.equal(withSample.productionCampaignsCount, 1);

  // 2. With sample data excluded (strictly production)
  const strictlyProduction = await analytics.calculateAnalytics({
    memoryStore: { campaigns, events: [] },
    isConnected: false,
    filters: { includeSample: false, timeframe: 'all' }
  });
  assert.equal(strictlyProduction.totalCampaigns, 1);
  assert.equal(strictlyProduction.productionCampaignsCount, 1);
  assert.equal(strictlyProduction.sampleCampaignsCount, 0);
  assert.equal(strictlyProduction.campaigns[0].id, 'c-real');
});

test('Feature 6: Handling empty and insufficient data without fabricating metrics', async () => {
  const result = await analytics.calculateAnalytics({
    memoryStore: { campaigns: [], events: [] },
    isConnected: false,
    filters: { brand: 'nonexistent', timeframe: 'all' }
  });

  assert.equal(result.insufficientData, true);
  assert.equal(result.totalCampaigns, 0);
  assert.ok(result.message.includes('No campaign records match'));
  assert.equal(result.outcomes.approvalRate, 0);
  assert.equal(result.findingsSummary.total, 0);
  assert.equal(result.turnaround.averageMinutes, null);
  assert.equal(result.agencyScorecards.length, 0);
  assert.equal(result.crossBrandComparison.length, 0);
});

test('Feature 6: Agency scorecards calculation and grading', async () => {
  const campaigns = [
    {
      id: 'c-ag1',
      agency: 'Studio Alpha',
      status: 'approved',
      initialFindings: [
        { id: 'f1', ruleId: 'R1', severity: 'warning', status: 'applied' }
      ]
    },
    {
      id: 'c-ag2',
      agency: 'Studio Alpha',
      status: 'approved',
      initialFindings: []
    },
    {
      id: 'c-ag3',
      agency: 'Studio Beta',
      status: 'rejected',
      initialFindings: [
        { id: 'f2', ruleId: 'R2', severity: 'critical', status: 'open' }
      ]
    }
  ];

  const result = await analytics.calculateAnalytics({
    memoryStore: { campaigns, events: [] },
    isConnected: false,
    filters: { timeframe: 'all' }
  });

  assert.equal(result.agencyScorecards.length, 2);

  const alpha = result.agencyScorecards.find((s: any) => s.agencyName === 'Studio Alpha');
  assert.ok(alpha);
  assert.equal(alpha.campaignsHandled, 2);
  assert.equal(alpha.approvedCount, 2);
  assert.equal(alpha.approvalRate, 100);
  assert.equal(alpha.criticalFindingsRate, 0);
  assert.equal(alpha.grade, 'A');

  const beta = result.agencyScorecards.find((s: any) => s.agencyName === 'Studio Beta');
  assert.ok(beta);
  assert.equal(beta.campaignsHandled, 1);
  assert.equal(beta.rejectedCount, 1);
  assert.equal(beta.approvalRate, 0);
  assert.equal(beta.criticalFindings, 1);
  assert.equal(beta.grade, 'C');
});

test('Feature 6: CSV and JSON export generation', async () => {
  const campaigns = [
    {
      id: 'c-exp',
      code: 'CMP-EXP-01',
      title: 'Summer Launch "Special"',
      brandName: 'FreshBites',
      agency: 'Studio Alpha',
      channel: 'Social',
      format: '1:1',
      status: 'approved',
      isDemo: false,
      createdAt: new Date('2026-02-01T00:00:00Z'),
      initialFindings: [
        { id: 'f1', severity: 'critical', status: 'applied' }
      ]
    }
  ];

  const result = await analytics.calculateAnalytics({
    memoryStore: { campaigns, events: [] },
    isConnected: false,
    filters: { timeframe: 'all' }
  });

  const csv = analytics.generateAnalyticsCsv(result);
  assert.ok(typeof csv === 'string');
  assert.ok(csv.includes('Campaign Code,Title,Brand Name,Agency'));
  assert.ok(csv.includes('CMP-EXP-01'));
  assert.ok(csv.includes('FreshBites'));
  assert.ok(csv.includes('Studio Alpha'));
});

test('Feature 6: Authenticated REST API endpoints for analytics and exports', async () => {
  // 1. Unauthenticated request to /api/workspace/analytics -> 401
  const unauthRes = await fetch(`http://127.0.0.1:${serverPort}/api/workspace/analytics`);
  assert.equal(unauthRes.status, 401);

  // 2. Authenticated request to /api/workspace/analytics -> 200 JSON
  const authRes = await fetch(`http://127.0.0.1:${serverPort}/api/workspace/analytics?timeframe=all`, {
    headers: { Cookie: reviewerCookie }
  });
  assert.equal(authRes.status, 200);
  const data = await authRes.json();
  assert.ok(data.outcomes);
  assert.ok(data.findingsSummary);

  // 3. Authenticated request to /api/workspace/analytics/export?format=csv -> 200 text/csv
  const csvRes = await fetch(
    `http://127.0.0.1:${serverPort}/api/workspace/analytics/export?format=csv&timeframe=all`,
    {
      headers: { Cookie: reviewerCookie }
    }
  );
  assert.equal(csvRes.status, 200);
  assert.ok(csvRes.headers.get('content-type')?.includes('text/csv'));
  const csvText = await csvRes.text();
  assert.ok(csvText.includes('Campaign Code,Title,Brand Name,Agency'));

  // 4. Authenticated request to /api/workspace/analytics/export?format=json -> 200 application/json
  const jsonRes = await fetch(
    `http://127.0.0.1:${serverPort}/api/workspace/analytics/export?format=json&timeframe=all`,
    {
      headers: { Cookie: reviewerCookie }
    }
  );
  assert.equal(jsonRes.status, 200);
  assert.ok(jsonRes.headers.get('content-type')?.includes('application/json'));
});

test('Teardown Analytics test server', async () => {
  db.setIsolatedTestMode(false);
  if (testServer) {
    if (typeof (testServer as any).closeAllConnections === 'function') {
      (testServer as any).closeAllConnections();
    }
    await new Promise<void>((resolve) => testServer!.close(() => resolve()));
  }
});

