import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PixelImage,
  PixelBox,
  relativeLuminance,
  contrastRatio,
  analyzeRegionContrast,
  analyzeContrast,
  matchLogo,
  analyzeClearSpace,
  boxDistance,
  runVisualChecks
} from '../src/utils/visualChecks.js';

// ── Labelled synthetic fixtures ──────────────────────────────────────────────

function makeImage(width: number, height: number, rgba: [number, number, number, number]): PixelImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = rgba[0];
    data[i + 1] = rgba[1];
    data[i + 2] = rgba[2];
    data[i + 3] = rgba[3];
  }
  return { width, height, data };
}

function fillRect(img: PixelImage, box: PixelBox, rgb: [number, number, number]): void {
  for (let y = box.y; y < box.y + box.height; y++) {
    for (let x = box.x; x < box.x + box.width; x++) {
      if (x < 0 || y < 0 || x >= img.width || y >= img.height) continue;
      const idx = (y * img.width + x) * 4;
      img.data[idx] = rgb[0];
      img.data[idx + 1] = rgb[1];
      img.data[idx + 2] = rgb[2];
      img.data[idx + 3] = 255;
    }
  }
}

/** 24x24 checkerboard patch used as the labelled "reference logo" fixture. */
function checkerPatch(size: number): PixelImage {
  const img = makeImage(size, size, [255, 255, 255, 255]);
  const cell = Math.max(2, Math.floor(size / 4));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if ((Math.floor(x / cell) + Math.floor(y / cell)) % 2 === 0) {
        const idx = (y * size + x) * 4;
        img.data[idx] = 20;
        img.data[idx + 1] = 20;
        img.data[idx + 2] = 20;
      }
    }
  }
  return img;
}

test('fixture "wcag anchors": black on white is 21:1, identical colors 1:1', () => {
  const black = relativeLuminance(0, 0, 0);
  const white = relativeLuminance(255, 255, 255);
  assert.ok(Math.abs(contrastRatio(white, black) - 21) < 0.01);
  assert.ok(Math.abs(contrastRatio(white, white) - 1) < 0.001);
});

test('fixture "high-contrast label": black text patch on white poster measures near 21:1', () => {
  const img = makeImage(120, 60, [255, 255, 255, 255]);
  const textBox: PixelBox = { x: 20, y: 15, width: 80, height: 30 };
  // Simulate glyph strokes: half the pixels dark.
  for (let y = textBox.y; y < textBox.y + textBox.height; y += 2) {
    fillRect(img, { x: textBox.x, y, width: textBox.width, height: 1 }, [0, 0, 0]);
  }
  const region = analyzeRegionContrast(img, textBox);
  assert.equal(region.measurable, true);
  assert.ok(region.ratio > 15, `expected strong contrast, got ${region.ratio}`);
});

test('fixture "washed-out label": light gray on white fails the 3:1 minimum', () => {
  const img = makeImage(120, 60, [255, 255, 255, 255]);
  const textBox: PixelBox = { x: 20, y: 15, width: 80, height: 30 };
  for (let y = textBox.y; y < textBox.y + textBox.height; y += 2) {
    fillRect(img, { x: textBox.x, y, width: textBox.width, height: 1 }, [220, 220, 220]);
  }
  const analysis = analyzeContrast(img, [textBox]);
  assert.equal(analysis.result.verdict, 'fail');
  assert.ok(analysis.minRatio < 3);
});

test('fixture "uniform panel": a flat color region is not measurable, never faked as a pass', () => {
  const img = makeImage(120, 60, [200, 200, 200, 255]);
  const region = analyzeRegionContrast(img, { x: 10, y: 10, width: 50, height: 40 });
  assert.equal(region.measurable, false);
});

test('fixture "logo present": embedded checker patch matches its template near 100%', () => {
  const img = makeImage(160, 120, [250, 248, 240, 255]);
  const patch = checkerPatch(16);
  fillRect(img, { x: 100, y: 20, width: 16, height: 16 }, [255, 255, 255]);
  // paste patch pixels
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const s = (y * 16 + x) * 4;
      fillRect(img, { x: 100 + x, y: 20 + y, width: 1, height: 1 }, [
        patch.data[s],
        patch.data[s + 1],
        patch.data[s + 2]
      ]);
    }
  }
  const match = matchLogo(img, checkerPatch(24));
  assert.ok(match.confidence >= 0.75, `expected strong match, got ${match.confidence}`);
  assert.ok(match.box, 'expected a located box');
});

test('fixture "logo absent": blank poster against checker template stays below pass threshold', () => {
  const img = makeImage(160, 120, [250, 248, 240, 255]);
  const match = matchLogo(img, checkerPatch(24));
  assert.ok(match.confidence < 0.75, `expected weak match, got ${match.confidence}`);
});

test('fixture "blank template": a uniform reference logo yields zero confidence, not a crash', () => {
  const img = makeImage(80, 60, [255, 255, 255, 255]);
  const match = matchLogo(img, makeImage(16, 16, [255, 255, 255, 255]));
  assert.equal(match.confidence, 0);
  assert.equal(match.box, null);
});

test('fixture "crowded logo": text touching the logo fails the clear-space minimum', () => {
  const logo: PixelBox = { x: 40, y: 40, width: 20, height: 20 };
  const touchingText: PixelBox = { x: 62, y: 42, width: 30, height: 10 };
  const { result, minDistance } = analyzeClearSpace(logo, [touchingText], 120, 120);
  assert.ok(minDistance < 10, `expected tight clearance, got ${minDistance}`);
  assert.equal(result.verdict, 'human_review');
});

test('fixture "spacious logo": distant text passes clear-space', () => {
  const logo: PixelBox = { x: 60, y: 50, width: 20, height: 20 };
  const farText: PixelBox = { x: 60, y: 100, width: 40, height: 10 };
  const { result } = analyzeClearSpace(logo, [farText], 200, 200);
  assert.equal(result.verdict, 'pass');
});

test('fixture "box distance": overlapping boxes are zero, separated boxes positive', () => {
  assert.equal(
    boxDistance({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5, width: 10, height: 10 }),
    0
  );
  assert.ok(
    boxDistance({ x: 0, y: 0, width: 10, height: 10 }, { x: 20, y: 0, width: 10, height: 10 }) === 10
  );
});

test('fixture "full pipeline, no reference logo": logo and clear space route to human review', () => {
  const img = makeImage(120, 120, [255, 255, 255, 255]);
  const results = runVisualChecks(img, {
    textBoxes: [{ top: 10, left: 10, width: 30, height: 10 }],
    ocrConfidence: 95
  });
  assert.equal(results.length, 4);
  const logo = results.find((r) => r.id === 'logo');
  const clear = results.find((r) => r.id === 'clear_space');
  assert.equal(logo?.verdict, 'human_review');
  assert.equal(logo?.headline, 'No reference logo');
  assert.equal(clear?.verdict, 'human_review');
});

test('fixture "full pipeline, corrupt image": zero-size input degrades gracefully', () => {
  const results = runVisualChecks({ width: 0, height: 0, data: new Uint8ClampedArray(0) }, {});
  assert.equal(results[0].verdict, 'human_review');
});
