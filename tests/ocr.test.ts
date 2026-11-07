import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';

const ocrEngine = require('../ocrEngine');
const db = require('../db');
const auth = require('../auth');
const storage = require('../storage');
const { runComplianceAudit, calculateComplianceScore, DEFAULT_RULES } = require('../src/utils/rulesEngine');

let testServer: http.Server | null = null;
let serverPort: number = 0;
let adminCookie: string = '';
let adminCsrf: string = '';
let testAdminId: string = '';

const TEST_PNG_PATH = path.resolve(__dirname, '../assets/freshbites-organic-promo.png');

test('Setup OCR test server & authenticate session', async () => {
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

  const pwdHash = await auth.hashPassword('SuperSecretAdmin123!');
  const adminUser = await db.createUser({
    username: `ocr_admin_${Date.now()}`,
    email: `ocr_admin_${Date.now()}@example.com`,
    passwordHash: pwdHash,
    role: auth.ROLES.ADMIN
  });
  testAdminId = String(adminUser._id || adminUser.id);

  const sessionId = auth.generateSessionId();
  adminCsrf = auth.generateCsrfToken();
  await db.createSession({
    sessionId,
    userId: testAdminId,
    username: adminUser.username,
    role: adminUser.role,
    csrfToken: adminCsrf,
    expiresAt: new Date(Date.now() + 3600000),
    ip: '127.0.0.1',
    userAgent: 'test-ocr-agent'
  });
  adminCookie = `${auth.COOKIE_NAME}=${sessionId}`;
});

test('Feature 3 - Parse image dimensions from PNG, JPEG, and WebP headers', () => {
  const buf = fs.readFileSync(TEST_PNG_PATH);
  const dims = ocrEngine.parseImageDimensions(buf);
  assert.ok(dims, 'Should parse dimensions from PNG header');
  assert.equal(dims.width, 800);
  assert.equal(dims.height, 1000);

  // Invalid buffer
  assert.equal(ocrEngine.parseImageDimensions(Buffer.from('notanimage')), null);
});

test('Feature 3 - Accurate percentage bounding-box scaling', () => {
  const imgWidth = 800;
  const imgHeight = 1000;
  const rawBBox = { x0: 200, y0: 400, x1: 600, y1: 500 };

  const scaled = ocrEngine.toPercentageBBox(rawBBox, imgWidth, imgHeight);
  assert.ok(scaled, 'Scaled bbox should not be null');
  assert.equal(scaled.left, 25.0); // 200 / 800 * 100 = 25%
  assert.equal(scaled.top, 40.0);  // 400 / 1000 * 100 = 40%
  assert.equal(scaled.width, 50.0); // (600 - 200) / 800 * 100 = 50%
  assert.equal(scaled.height, 10.0); // (500 - 400) / 1000 * 100 = 10%

  // Invalid dimensions or coordinates should return null (never invent coordinates)
  assert.equal(ocrEngine.toPercentageBBox(null, 800, 1000), null);
  assert.equal(ocrEngine.toPercentageBBox(rawBBox, 0, 1000), null);
  assert.equal(ocrEngine.toPercentageBBox({ x0: 500, y0: 500, x1: 200, y1: 200 }, 800, 1000), null);
});

test('Feature 3 - Real OCR extraction on test image extracts actual words and real confidence', async () => {
  const result = await ocrEngine.recognizeImage(TEST_PNG_PATH);

  assert.ok(result.text.length > 20, 'Text should be extracted');
  assert.match(result.text, /boosts immunity/i, 'Should detect immunity claim');
  assert.match(result.text, /100% vegan-friendly/i, 'Should detect 100% claim');
  assert.match(result.text, /cold-pressed/i, 'Should detect cold-pressed phrase');

  // Confidence handling: genuine number between 0 and 100
  assert.ok(typeof result.confidence === 'number');
  assert.ok(result.confidence >= 75 && result.confidence <= 100, `Confidence was ${result.confidence}`);

  // Image dimensions
  assert.equal(result.imageDimensions.width, 800);
  assert.equal(result.imageDimensions.height, 1000);

  // Bounding boxes for lines
  assert.ok(result.lines.length >= 2, 'Should detect multiple lines');
  for (const line of result.lines) {
    assert.ok(line.text.length > 0);
    assert.ok(line.confidence >= 0 && line.confidence <= 100);
    if (line.bbox) {
      assert.ok(line.bbox.top >= 0 && line.bbox.top <= 100);
      assert.ok(line.bbox.left >= 0 && line.bbox.left <= 100);
      assert.ok(line.bbox.width > 0 && line.bbox.width <= 100);
      assert.ok(line.bbox.height > 0 && line.bbox.height <= 100);
    }
  }

  // Bounding boxes for words
  assert.ok(result.words.length >= 10, 'Should detect individual words');
  const immunityWord = result.words.find((w: any) => /immunity/i.test(w.text));
  assert.ok(immunityWord, 'Should find individual word "immunity"');
  assert.ok(immunityWord.bbox, 'Word should have real bounding box');
  assert.ok(immunityWord.confidence > 0, 'Word should have genuine confidence');
});

test('Feature 3 - Zero fabrication on blank image (no text, 0 confidence, no bboxes)', async () => {
  const blankPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  const result = await ocrEngine.recognizeImage(blankPng);

  assert.equal(result.text, '', 'Blank image should yield empty text');
  assert.equal(result.confidence, 0, 'Blank image confidence must be 0 (never fabricated)');
  assert.equal(result.lines.length, 0, 'No lines should be fabricated');
  assert.equal(result.words.length, 0, 'No words should be fabricated');
});

test('Feature 3 - Bounding box mapping links rule findings to real coordinates without inventing boxes', () => {
  const mockLines = [
    { text: 'Permanently boosts immunity and rejuvenates body cells', confidence: 96, bbox: { top: 40.2, left: 18.6, width: 62.7, height: 1.9 } },
    { text: '100% vegan-friendly farm fresh extracts', confidence: 93, bbox: { top: 62.2, left: 26.4, width: 47.4, height: 2.0 } }
  ];
  const mockWords = [
    { text: 'Permanently', confidence: 96, bbox: { top: 40.2, left: 18.6, width: 13.7, height: 1.9 } },
    { text: 'boosts', confidence: 96, bbox: { top: 40.2, left: 33.2, width: 7.1, height: 1.5 } },
    { text: 'immunity', confidence: 96, bbox: { top: 40.2, left: 41.3, width: 9.8, height: 1.9 } }
  ];

  const findings = [
    { id: 'f1', matchedText: 'Permanently boosts immunity', source: 'ocr' },
    { id: 'f2', matchedText: '100% vegan-friendly', source: 'both' },
    { id: 'f3', matchedText: 'Completely unmentioned claim', source: 'ocr' },
    { id: 'f4', matchedText: 'Caption only claim', source: 'caption' }
  ];

  const mapped = ocrEngine.mapRuleFindingsToBBoxes(findings, mockLines, mockWords);

  assert.deepEqual(mapped[0].bbox, { top: 40.2, left: 18.6, width: 62.7, height: 1.9 });
  assert.deepEqual(mapped[1].bbox, { top: 62.2, left: 26.4, width: 47.4, height: 2.0 });
  assert.equal(mapped[2].bbox, undefined, 'Must never invent bounding boxes when text is not found');
  assert.equal(mapped[3].bbox, undefined, 'Caption only finding should not have OCR bbox');
});

test('Feature 3 - Restrict arbitrary external URL fetching', async () => {
  await assert.rejects(
    async () => {
      await ocrEngine.recognizeImage('https://evil-attacker.example.com/exploit.png');
    },
    (err: any) => {
      return err.code === 'UNRESTRICTED_URL_RESTRICTED' ||
        /Fetching arbitrary external URLs is restricted/i.test(err.message);
    }
  );
});

test('Feature 3 - Reject unauthenticated /api/ocr/extract request with 401', async () => {
  const res = await fetch(`http://127.0.0.1:${serverPort}/api/ocr/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageUrl: '/assets/freshbites-organic-promo.png' })
  });
  assert.equal(res.status, 401);
});

test('Feature 3 - Authenticated POST /api/ocr/extract endpoint processes image and returns real metadata', async () => {
  const res = await fetch(`http://127.0.0.1:${serverPort}/api/ocr/extract`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: adminCookie,
      'X-CSRF-Token': adminCsrf
    },
    body: JSON.stringify({ imageUrl: '/assets/freshbites-organic-promo.png' })
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.match(data.text, /boosts immunity/i);
  assert.ok(data.confidence > 70);
  assert.equal(data.imageDimensions.width, 800);
  assert.equal(data.imageDimensions.height, 1000);
  assert.ok(Array.isArray(data.lines) && data.lines.length >= 2);
  assert.ok(Array.isArray(data.words) && data.words.length >= 10);
});

test('Feature 3 - Persist extracted and user-corrected artwork text in MongoDB workspace', async () => {
  const campaignId = `campaign-ocr-test-${Date.now()}`;
  const rawOcrText = 'Permanently boosts immunity and rejuvenates body cells\n100% vegan-friendly farm fresh extracts';
  const correctedText = 'Supports daily immunity and vitality\n100% vegan-friendly farm fresh extracts';

  const testCampaign = {
    id: campaignId,
    code: 'CAMPAIGN-OCR-01',
    title: 'Immunity Juice Campaign',
    brandId: 'freshbites',
    brandName: 'FreshBites Organic',
    channel: 'IG / TikTok Reels (9:16)',
    format: 'Short-Form Video',
    aspectRatio: '4/5',
    imageUrl: '/assets/freshbites-organic-promo.png',
    caption: 'Try our refreshing daily juice! 100% natural.',
    ocrText: rawOcrText,
    extractedText: rawOcrText,
    correctedArtworkText: correctedText,
    ocrConfidence: 94,
    status: 'under_review',
    initialFindings: []
  };

  const saveRes = await fetch(`http://127.0.0.1:${serverPort}/api/workspace/campaigns`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: adminCookie,
      'X-CSRF-Token': adminCsrf
    },
    body: JSON.stringify(testCampaign)
  });
  assert.equal(saveRes.status, 201);

  // Retrieve workspace snapshot and verify persistence
  const snapRes = await fetch(`http://127.0.0.1:${serverPort}/api/workspace`, {
    headers: { Cookie: adminCookie }
  });
  assert.equal(snapRes.status, 200);
  const snapshot = await snapRes.json();

  const retrieved = snapshot.campaigns.find((c: any) => c.id === campaignId);
  assert.ok(retrieved, 'Saved campaign should be present in workspace snapshot');
  assert.equal(retrieved.ocrText, rawOcrText);
  assert.equal(retrieved.extractedText, rawOcrText);
  assert.equal(retrieved.correctedArtworkText, correctedText);
  assert.equal(retrieved.ocrConfidence, 94);
});

test('Feature 3 - Rule evaluation against extracted and corrected artwork text', () => {
  const extractedText = 'Permanently boosts immunity and rejuvenates body cells. 100% Detox your liver!';
  const caption = 'Drink daily for health!';

  // Test against default rules
  const findings = runComplianceAudit(caption, extractedText, DEFAULT_RULES, 'freshbites');
  assert.ok(findings.length > 0, 'Should flag violations in OCR text');

  const detoxFinding = findings.find((f: any) => /detox/i.test(f.matchedText));
  assert.ok(detoxFinding, 'Should detect detox claim in OCR artwork text');
  assert.equal(detoxFinding.source, 'ocr');

  // When user corrects the text:
  const correctedText = 'Supports everyday vitality. Refreshing taste!';
  const correctedFindings = runComplianceAudit(caption, correctedText, DEFAULT_RULES, 'freshbites');
  const correctedDetoxFinding = correctedFindings.find((f: any) => /detox/i.test(f.matchedText));
  assert.equal(correctedDetoxFinding, undefined, 'Corrected text should resolve the detox claim finding');

  const scoreBefore = calculateComplianceScore(findings);
  const scoreAfter = calculateComplianceScore(correctedFindings);
  assert.ok(scoreAfter.score > scoreBefore.score, 'Compliance score should improve after correcting artwork text');
});

test('Teardown OCR test server', async () => {
  await ocrEngine.terminateWorker();
  if (testServer) {
    await new Promise<void>((resolve) => testServer!.close(() => resolve()));
  }
});

