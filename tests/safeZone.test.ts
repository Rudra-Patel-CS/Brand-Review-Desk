import test from 'node:test';
import assert from 'node:assert/strict';

const safeZoneEngine = require('../safeZoneEngine');

test('Feature 5: Platform format definitions are loaded and valid', () => {
  const platforms = safeZoneEngine.getAllPlatforms();
  assert.ok(Array.isArray(platforms), 'Platforms should be an array');
  assert.ok(platforms.length >= 4, 'Should contain at least Instagram, TikTok, YouTube, and LinkedIn');

  const platformIds = platforms.map((p: any) => p.id);
  assert.ok(platformIds.includes('instagram'), 'Instagram platform should be present');
  assert.ok(platformIds.includes('tiktok'), 'TikTok platform should be present');
  assert.ok(platformIds.includes('youtube'), 'YouTube platform should be present');
  assert.ok(platformIds.includes('linkedin'), 'LinkedIn platform should be present');

  const formats = safeZoneEngine.getAllFormats();
  assert.ok(formats.length >= 7, 'Should contain multiple formats across platforms');

  // Verify all formats have required properties
  for (const fmt of formats) {
    assert.ok(fmt.id, `Format ${fmt.id} must have an id`);
    assert.ok(fmt.name, `Format ${fmt.id} must have a name`);
    assert.ok(fmt.aspectRatio, `Format ${fmt.id} must specify aspectRatio`);
    assert.ok(typeof fmt.aspectRatioNum === 'number', `Format ${fmt.id} must have numeric aspectRatioNum`);
    assert.ok(fmt.targetWidth > 0, `Format ${fmt.id} targetWidth must be positive`);
    assert.ok(fmt.targetHeight > 0, `Format ${fmt.id} targetHeight must be positive`);
    assert.ok(fmt.minWidth > 0, `Format ${fmt.id} minWidth must be positive`);
    assert.ok(fmt.minHeight > 0, `Format ${fmt.id} minHeight must be positive`);
    assert.ok(Array.isArray(fmt.safeZones), `Format ${fmt.id} safeZones must be an array`);
    assert.ok(fmt.layoutGuidance, `Format ${fmt.id} must provide layout guidance`);
  }
});

test('Feature 5: Official documentation references and verified dates', () => {
  const formats = safeZoneEngine.getAllFormats();

  for (const fmt of formats) {
    assert.ok(fmt.officialSourceUrl, `Format ${fmt.id} must have officialSourceUrl`);
    assert.match(
      fmt.officialSourceUrl,
      /^https:\/\//,
      `Format ${fmt.id} officialSourceUrl must be a secure HTTPS URL`
    );
    assert.ok(fmt.officialSourceDoc, `Format ${fmt.id} must have officialSourceDoc title`);
    assert.ok(fmt.lastVerifiedDate, `Format ${fmt.id} must have lastVerifiedDate`);
    assert.match(
      fmt.lastVerifiedDate,
      /^\d{4}-\d{2}-\d{2}$/,
      `Format ${fmt.id} lastVerifiedDate must be in YYYY-MM-DD format`
    );
  }
});

test('Feature 5: Safe-zone coordinates and boundary validation', () => {
  const formats = safeZoneEngine.getAllFormats();

  for (const fmt of formats) {
    for (const sz of fmt.safeZones) {
      assert.ok(sz.id, 'Safe zone must have an id');
      assert.ok(sz.name, 'Safe zone must have a name');
      assert.ok(sz.description, 'Safe zone must have a description');
      assert.ok(sz.top >= 0 && sz.top <= 100, `Safe zone ${sz.id} top must be 0-100%`);
      assert.ok(sz.left >= 0 && sz.left <= 100, `Safe zone ${sz.id} left must be 0-100%`);
      assert.ok(sz.width > 0 && sz.width <= 100, `Safe zone ${sz.id} width must be 0-100%`);
      assert.ok(sz.height > 0 && sz.height <= 100, `Safe zone ${sz.id} height must be 0-100%`);
      assert.ok(
        sz.top + sz.height <= 100,
        `Safe zone ${sz.id} vertical bounds (top + height) must not exceed 100%`
      );
      assert.ok(
        sz.left + sz.width <= 100,
        `Safe zone ${sz.id} horizontal bounds (left + width) must not exceed 100%`
      );
    }
  }
});

test('Feature 5: Aspect ratio string calculation', () => {
  assert.equal(safeZoneEngine.formatAspectRatioString(1080, 1920), '9:16');
  assert.equal(safeZoneEngine.formatAspectRatioString(1080, 1350), '4:5');
  assert.equal(safeZoneEngine.formatAspectRatioString(1080, 1080), '1:1');
  assert.equal(safeZoneEngine.formatAspectRatioString(1200, 627), '1.91:1');
  assert.equal(safeZoneEngine.formatAspectRatioString(1920, 1080), '16:9');
  assert.equal(safeZoneEngine.formatAspectRatioString(0, 0), 'Unknown');
});

test('Feature 5: Dimension analysis - exact match, ratio match, and mismatch', () => {
  const reelsSpec = safeZoneEngine.getFormatSpec('ig_reels_9_16');
  assert.ok(reelsSpec, 'Instagram Reels spec must exist');

  // 1. Exact Match: 1080x1920 for Reels (9:16)
  const exact = safeZoneEngine.analyzeImageDimensions(1080, 1920, reelsSpec);
  assert.equal(exact.status, 'exact_match');
  assert.equal(exact.meetsMinimumResolution, true);
  assert.ok(exact.message.includes('exactly matches'));

  // 2. Aspect Ratio Match (proportional high-res): 720x1280 (9:16)
  const ratioMatch = safeZoneEngine.analyzeImageDimensions(720, 1280, reelsSpec);
  assert.equal(ratioMatch.status, 'aspect_ratio_match');
  assert.equal(ratioMatch.meetsMinimumResolution, true);
  assert.ok(ratioMatch.message.includes('matches target'));

  // 3. Aspect Ratio Match (below min resolution): 360x640 (9:16)
  const lowRes = safeZoneEngine.analyzeImageDimensions(360, 640, reelsSpec);
  assert.equal(lowRes.status, 'aspect_ratio_match');
  assert.equal(lowRes.meetsMinimumResolution, false);
  assert.ok(lowRes.message.includes('below minimum'));

  // 4. Dimension Mismatch: 1080x1080 (Square 1:1) tested against 9:16 Reels
  const mismatch = safeZoneEngine.analyzeImageDimensions(1080, 1080, reelsSpec);
  assert.equal(mismatch.status, 'dimension_mismatch');
  assert.ok(mismatch.message.includes('does not match target'));
});

test('Feature 5: Obscured region detection with bounding boxes', () => {
  const tiktokSpec = safeZoneEngine.getFormatSpec('tiktok_infeed_9_16');
  assert.ok(tiktokSpec, 'TikTok spec must exist');

  // Element 1: Headline in top bar (top: 2%, left: 10%, width: 40%, height: 4%)
  // TikTok top safe zone is top: 0, height: 7
  const topClaim = {
    id: 'f-1',
    text: 'Flash Sale 50% Off',
    bbox: { top: 2, left: 10, width: 40, height: 4 },
    source: 'finding' as const
  };

  // Element 2: Disclaimer at bottom (top: 85%, left: 10%, width: 70%, height: 8%)
  // TikTok bottom safe zone is top: 78, height: 22
  const bottomDisclaimer = {
    id: 'f-2',
    text: 'Terms & conditions apply. See website for full legal details.',
    bbox: { top: 85, left: 10, width: 70, height: 8 },
    source: 'finding' as const
  };

  // Element 3: Centered product logo (top: 45%, left: 25%, width: 50%, height: 15%)
  // Safely in the center viewport
  const centerLogo = {
    id: 'f-3',
    text: 'Brand Logo',
    bbox: { top: 45, left: 25, width: 50, height: 15 },
    source: 'finding' as const
  };

  const analysis = safeZoneEngine.detectSafeZoneOverlaps(
    [topClaim, bottomDisclaimer, centerLogo],
    tiktokSpec.safeZones
  );

  assert.equal(analysis.hasOverlaps, true);
  assert.equal(analysis.totalObscuredCount, 2);

  const topOverlap = analysis.overlaps.find((o: any) => o.elementId === 'f-1');
  assert.ok(topOverlap, 'Top headline should be flagged as obscured');
  assert.ok(topOverlap.warningMessage.includes('Top Header'));

  const bottomOverlap = analysis.overlaps.find((o: any) => o.elementId === 'f-2');
  assert.ok(bottomOverlap, 'Bottom disclaimer should be flagged as obscured');
  assert.ok(bottomOverlap.warningMessage.includes('Bottom Caption'));

  const centerOverlap = analysis.overlaps.find((o: any) => o.elementId === 'f-3');
  assert.equal(centerOverlap, undefined, 'Center logo should NOT overlap any safe zone');
});

test('Feature 5: Unsupported format handling without breaking', () => {
  // Non-existent format
  const nullSpec = safeZoneEngine.getFormatSpec('custom_nonexistent_format');
  assert.equal(nullSpec, null);

  // Analysis with null format spec
  const unsupp = safeZoneEngine.analyzeImageDimensions(1000, 1000, null);
  assert.equal(unsupp.status, 'unsupported_format');
  assert.equal(unsupp.label, 'Custom / Unsupported Format');
  assert.ok(unsupp.message.includes('No pre-configured platform specifications'));

  // Invalid image dimensions
  const zeroDim = safeZoneEngine.analyzeImageDimensions(0, 0, null);
  assert.equal(zeroDim.status, 'unsupported_format');
  assert.equal(zeroDim.actualAspectRatioString, 'Unknown');

  // Overlap detection with empty safe zones (e.g. 1:1 square)
  const emptyAnalysis = safeZoneEngine.detectSafeZoneOverlaps(
    [{ id: 't1', text: 'Text', bbox: { top: 10, left: 10, width: 20, height: 20 } }],
    []
  );
  assert.equal(emptyAnalysis.hasOverlaps, false);
  assert.equal(emptyAnalysis.totalObscuredCount, 0);

  // Disclaimer constant exists and clarifies guidance nature
  assert.ok(safeZoneEngine.SAFE_ZONE_DISCLAIMER);
  assert.ok(safeZoneEngine.SAFE_ZONE_DISCLAIMER.includes('layout guidance'));
  assert.ok(safeZoneEngine.SAFE_ZONE_DISCLAIMER.includes('does not guarantee final platform rendering'));
});
