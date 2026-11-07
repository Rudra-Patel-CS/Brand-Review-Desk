import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { app } from '../server.js';
import db from '../db.js';
import auth from '../auth.js';
import storage from '../storage.js';
import { parseBase64DataUrl } from '../scripts/migrate_base64_to_gridfs.js';

let server: http.Server;
let baseUrl: string;
let adminCookie: string;
let adminCsrf: string;

// Minimal valid PNG image buffer
const VALID_PNG_BUFFER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
  0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
  0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82
]);

// Minimal valid JPEG image buffer
const VALID_JPEG_BUFFER = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46,
  0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
  0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
  0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
  0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c,
  0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
  0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00,
  0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00,
  0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01, 0x01,
  0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00,
  0x3f, 0x00, 0xbf, 0x80, 0xff, 0xd9
]);

// Minimal valid WebP buffer
const VALID_WEBP_BUFFER = Buffer.concat([
  Buffer.from('RIFF', 'ascii'),
  Buffer.from([0x1a, 0x00, 0x00, 0x00]),
  Buffer.from('WEBPVP8 ', 'ascii'),
  Buffer.from([0x0e, 0x00, 0x00, 0x00, 0x30, 0x01, 0x00, 0x9d, 0x01, 0x2a, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00])
]);

function makeRequest(
  path: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
    cookie?: string;
    rawBuffer?: Buffer;
  } = {}
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: any; raw: Buffer }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const reqHeaders: Record<string, string> = {
      ...(options.headers || {})
    };

    if (options.cookie) {
      reqHeaders['Cookie'] = options.cookie;
    }

    let payload: Buffer | undefined;
    if (options.rawBuffer) {
      payload = options.rawBuffer;
      reqHeaders['Content-Length'] = payload.length.toString();
    } else if (options.body !== undefined) {
      const str = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      payload = Buffer.from(str, 'utf8');
      if (!reqHeaders['Content-Type']) {
        reqHeaders['Content-Type'] = 'application/json';
      }
      reqHeaders['Content-Length'] = payload.length.toString();
    }

    const req = http.request(
      url,
      {
        method: options.method || 'GET',
        headers: reqHeaders,
        agent: false
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => {
          const raw = Buffer.concat(chunks);
          let parsed: any = raw.toString('utf8');
          try {
            parsed = JSON.parse(parsed);
          } catch {
            // Keep as string
          }

          resolve({
            status: res.statusCode || 0,
            headers: res.headers,
            body: parsed,
            raw
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

function createMultipartBody(fieldName: string, filename: string, mimeType: string, fileBuffer: Buffer) {
  const boundary = `----WebKitFormBoundary${Math.random().toString(36).slice(2, 10)}`;
  const header = `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`;
  const footer = `\r\n--${boundary}--\r\n`;
  const body = Buffer.concat([
    Buffer.from(header, 'utf8'),
    fileBuffer,
    Buffer.from(footer, 'utf8')
  ]);
  return { boundary, body };
}

test('Setup storage test server & authenticate admin', async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address() as any;
  baseUrl = `http://127.0.0.1:${address.port}`;

  // Find or create admin
  let admin = await db.findUser('admin.lead');
  if (!admin) {
    const passwordHash = await auth.hashPassword('AdminPassword2026!');
    admin = await db.createUser({
      username: 'admin.lead',
      email: 'admin@branddesk.test',
      passwordHash,
      role: 'admin'
    });
  }

  // Create session
  const sessionId = auth.generateSessionId();
  adminCsrf = auth.generateCsrfToken();
  await db.createSession({
    sessionId,
    userId: admin._id,
    username: admin.username,
    role: admin.role,
    csrfToken: adminCsrf,
    expiresAt: new Date(Date.now() + 3600000),
    ip: '127.0.0.1',
    userAgent: 'test-agent'
  });

  adminCookie = `${auth.COOKIE_NAME}=${sessionId}`;
});

test('Feature 2 - Magic byte verification accurately identifies supported formats', () => {
  assert.equal(storage.detectImageType(VALID_PNG_BUFFER)?.mimeType, 'image/png');
  assert.equal(storage.detectImageType(VALID_JPEG_BUFFER)?.mimeType, 'image/jpeg');
  assert.equal(storage.detectImageType(VALID_WEBP_BUFFER)?.mimeType, 'image/webp');

  // Corrupted / disguised file
  const fakePng = Buffer.from('FAKE-PNG-NOT-REAL-CONTENT');
  assert.equal(storage.detectImageType(fakePng), null);
});

test('Feature 2 - Reject unauthorized uploads', async () => {
  const { boundary, body } = createMultipartBody('file', 'test.png', 'image/png', VALID_PNG_BUFFER);
  const res = await makeRequest('/api/assets/upload', {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    rawBuffer: body
  });

  assert.equal(res.status, 401, 'Upload without cookie must return 401 Unauthorized');
});

test('Feature 2 - Reject invalid or disguised image contents', async () => {
  const fakeContent = Buffer.from('<?xml version="1.0"?><script>alert("hacked")</script>');
  const { boundary, body } = createMultipartBody('file', 'malicious.png', 'image/png', fakeContent);

  const res = await makeRequest('/api/assets/upload', {
    method: 'POST',
    cookie: adminCookie,
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'X-CSRF-Token': adminCsrf
    },
    rawBuffer: body
  });

  assert.equal(res.status, 400, 'Invalid image contents must be rejected with 400');
  assert.ok(
    res.body.error.includes('malformed') || res.body.error.includes('Unsupported'),
    'Must explain that image content is unsupported or corrupted'
  );
});

test('Feature 2 - Reject oversized file uploads (> 15MB)', async () => {
  const oversized = Buffer.alloc(16 * 1024 * 1024); // 16MB
  const { boundary, body } = createMultipartBody('file', 'huge.png', 'image/png', oversized);

  const res = await makeRequest('/api/assets/upload', {
    method: 'POST',
    cookie: adminCookie,
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'X-CSRF-Token': adminCsrf
    },
    rawBuffer: body
  });

  assert.equal(res.status, 400);
  assert.ok(res.body.error.includes('15MB'), 'Error message must cite 15MB limit');
});

test('Feature 2 - Upload valid PNG, retrieve via GridFS asset endpoint, and verify content', async () => {
  // 1. Upload valid PNG
  const { boundary, body } = createMultipartBody('file', 'hero-adboard.png', 'image/png', VALID_PNG_BUFFER);

  const uploadRes = await makeRequest('/api/assets/upload', {
    method: 'POST',
    cookie: adminCookie,
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'X-CSRF-Token': adminCsrf
    },
    rawBuffer: body
  });

  assert.equal(uploadRes.status, 201);
  assert.equal(uploadRes.body.success, true);
  assert.ok(uploadRes.body.assetId, 'Must return assetId');
  assert.equal(uploadRes.body.mimeType, 'image/png');
  assert.equal(uploadRes.body.url, `/api/assets/${uploadRes.body.assetId}`);

  const assetId = uploadRes.body.assetId;

  // 2. Retrieve image asset via GET /api/assets/:id
  const getRes = await makeRequest(`/api/assets/${assetId}`, {
    cookie: adminCookie
  });

  assert.equal(getRes.status, 200);
  assert.equal(getRes.headers['content-type'], 'image/png');
  assert.equal(Number(getRes.headers['content-length']), VALID_PNG_BUFFER.length);
  assert.ok(getRes.headers['etag'], 'Must provide ETag header');
  assert.equal(getRes.headers['x-content-type-options'], 'nosniff');
  assert.deepEqual(getRes.raw, VALID_PNG_BUFFER, 'Retrieved bytes must match uploaded image exactly');

  // 3. Conditional request returns 304 Not Modified
  const etag = getRes.headers['etag'] as string;
  const cachedRes = await makeRequest(`/api/assets/${assetId}`, {
    cookie: adminCookie,
    headers: { 'If-None-Match': etag }
  });
  assert.equal(cachedRes.status, 304);
});

test('Feature 2 - Upload valid JPEG and associate asset ID with campaign record', async () => {
  const { boundary, body } = createMultipartBody('file', 'product-poster.jpg', 'image/jpeg', VALID_JPEG_BUFFER);

  const uploadRes = await makeRequest('/api/assets/upload', {
    method: 'POST',
    cookie: adminCookie,
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'X-CSRF-Token': adminCsrf
    },
    rawBuffer: body
  });

  assert.equal(uploadRes.status, 201);
  assert.equal(uploadRes.body.mimeType, 'image/jpeg');

  // Save campaign referencing the GridFS asset
  const campaignRes = await makeRequest('/api/workspace/campaigns', {
    method: 'POST',
    cookie: adminCookie,
    headers: { 'X-CSRF-Token': adminCsrf },
    body: {
      id: 'camp-gridfs-test-01',
      title: 'GridFS Autumn Campaign',
      brandId: 'arka',
      channel: 'Paid Social',
      imageUrl: uploadRes.body.url,
      assetId: uploadRes.body.assetId,
      assetMetadata: uploadRes.body.metadata
    }
  });

  assert.equal(campaignRes.status, 201);
  assert.equal(campaignRes.body.campaign.assetId, uploadRes.body.assetId);
  assert.equal(campaignRes.body.campaign.imageUrl, uploadRes.body.url);
});

test('Feature 2 - Reject unauthorized asset access (no session)', async () => {
  const res = await makeRequest('/api/assets/nonexistent-id');
  assert.equal(res.status, 401, 'Accessing assets without session must return 401');
});

test('Feature 2 - Base64 data URL parser accurately parses valid data URLs', () => {
  const sampleDataUrl = `data:image/png;base64,${VALID_PNG_BUFFER.toString('base64')}`;
  const parsed = parseBase64DataUrl(sampleDataUrl);
  assert.ok(parsed);
  assert.equal(parsed.mimeType, 'image/png');
  assert.deepEqual(parsed.buffer, VALID_PNG_BUFFER);

  // Invalid data URL returns null
  assert.equal(parseBase64DataUrl('https://example.com/image.jpg'), null);
  assert.equal(parseBase64DataUrl('data:text/plain;base64,aGVsbG8='), null);
});

test('Feature 2 - Commons references and external URLs remain preserved', async () => {
  const workspaceRes = await makeRequest('/api/workspace', { cookie: adminCookie });
  assert.equal(workspaceRes.status, 200);

  const campaigns = workspaceRes.body.campaigns;
  const commonsRef = campaigns.find((c: any) => c.id.startsWith('commons-'));
  assert.ok(commonsRef, 'Commons reference campaigns must be present');
  assert.ok(commonsRef.sourceName.includes('Wikimedia'), 'Commons sourceName must be preserved');
  assert.ok(commonsRef.sourceUrl.includes('wikimedia.org'), 'Commons sourceUrl must be preserved');
});

test('Teardown storage test server', async () => {
  if (server) {
    if (typeof (server as any).closeAllConnections === 'function') {
      (server as any).closeAllConnections();
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
