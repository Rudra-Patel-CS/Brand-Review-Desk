/* Brand Review Desk - Real OCR Engine
   Uses Tesseract.js to extract actual text, genuine confidence scores,
   and accurate bounding-box coordinates scaled to image dimensions.
   No mock data, no fabricated confidence, no invented bounding boxes.
*/

const path = require('path');
const fs = require('fs');
const { createWorker } = require('tesseract.js');
const storage = require('./storage');

let workerInstance = null;
let workerInitializing = null;

/**
 * Gets or initializes a reusable Tesseract worker instance.
 */
async function getWorker(options = {}) {
  if (workerInstance) {
    return workerInstance;
  }
  if (workerInitializing) {
    return workerInitializing;
  }

  workerInitializing = (async () => {
    try {
      const langPath = options.cachePath || path.resolve(__dirname, 'vendor/lang');
      const worker = await createWorker('eng', 1, {
        cachePath: langPath,
        gzip: true,
        ...options
      });
      workerInstance = worker;
      return worker;
    } finally {
      workerInitializing = null;
    }
  })();

  return workerInitializing;
}

/**
 * Terminates the worker instance when shutting down or cleaning up.
 */
async function terminateWorker() {
  if (workerInstance) {
    try {
      await workerInstance.terminate();
    } catch {}
    workerInstance = null;
  }
}

/**
 * Extracts width and height directly from image headers (PNG, JPEG, WebP).
 */
function parseImageDimensions(buf) {
  if (!buf || !Buffer.isBuffer(buf) || buf.length < 24) {
    return null;
  }

  // PNG: width and height are at offset 16 and 20 in the IHDR chunk
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return {
      width: buf.readUInt32BE(16),
      height: buf.readUInt32BE(20)
    };
  }

  // JPEG: scan for SOF0 (0xC0), SOF1 (0xC1), or SOF2 (0xC2) marker
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let offset = 2;
    while (offset < buf.length - 8) {
      if (buf[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = buf[offset + 1];
      if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
        const height = buf.readUInt16BE(offset + 5);
        const width = buf.readUInt16BE(offset + 7);
        return { width, height };
      }
      const len = buf.readUInt16BE(offset + 2);
      offset += 2 + len;
    }
  }

  // WebP: VP8, VP8L, VP8X
  if (buf.length > 30 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const type = buf.toString('ascii', 12, 16);
    if (type === 'VP8 ') {
      const startCode = buf.readUIntBE(23, 3);
      if (startCode === 0x9d012a) {
        return {
          width: buf.readUInt16LE(26) & 0x3fff,
          height: buf.readUInt16LE(28) & 0x3fff
        };
      }
    } else if (type === 'VP8L') {
      const b1 = buf[21];
      const b2 = buf[22];
      const b3 = buf[23];
      const b4 = buf[24];
      return {
        width: 1 + (((b2 & 0x3f) << 8) | b1),
        height: 1 + (((b4 & 0xf) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6))
      };
    } else if (type === 'VP8X') {
      return {
        width: 1 + buf.readUIntLE(24, 3),
        height: 1 + buf.readUIntLE(27, 3)
      };
    }
  }

  return null;
}

/**
 * Converts pixel bounding-box coordinates { x0, y0, x1, y1 } to percentage { top, left, width, height }
 * scaled accurately to image dimensions.
 */
function toPercentageBBox(bbox, imgWidth, imgHeight) {
  if (!bbox || !imgWidth || !imgHeight || imgWidth <= 0 || imgHeight <= 0) {
    return null;
  }
  const x0 = Math.max(0, bbox.x0);
  const y0 = Math.max(0, bbox.y0);
  const x1 = Math.min(imgWidth, bbox.x1);
  const y1 = Math.min(imgHeight, bbox.y1);

  if (x1 <= x0 || y1 <= y0) {
    return null;
  }

  const left = Math.round(((x0 / imgWidth) * 100) * 10) / 10;
  const top = Math.round(((y0 / imgHeight) * 100) * 10) / 10;
  const width = Math.round((((x1 - x0) / imgWidth) * 100) * 10) / 10;
  const height = Math.round((((y1 - y0) / imgHeight) * 100) * 10) / 10;

  return { top, left, width, height };
}

/**
 * Resolves an image source (Buffer, GridFS asset ID, base64 data URL, or local path)
 * into a Buffer.
 * Does NOT allow fetching arbitrary external HTTP URLs (security requirement).
 */
async function resolveImageBuffer(source, options = {}) {
  if (!source) {
    throw new Error('No image source provided for OCR processing.');
  }

  if (Buffer.isBuffer(source)) {
    return source;
  }

  if (typeof source !== 'string') {
    throw new Error('Invalid image source type.');
  }

  // Base64 data URL
  if (source.startsWith('data:image/')) {
    const match = source.match(/^data:image\/[a-zA-Z0-9.+_-]+;base64,(.+)$/);
    if (!match) {
      throw new Error('Malformed base64 image data URL.');
    }
    return Buffer.from(match[1], 'base64');
  }

  // GridFS Asset ID (24-char hex or starts with /api/assets/)
  const assetIdMatch = source.match(/\/api\/assets\/([a-fA-F0-9]{24}|asset-[a-zA-Z0-9_-]+)/) ||
                       source.match(/^([a-fA-F0-9]{24})$/);
  if (assetIdMatch || source.startsWith('asset-')) {
    const assetId = assetIdMatch ? assetIdMatch[1] : source;
    const asset = await storage.getAsset(assetId, {
      database: options.database,
      memoryStore: options.memoryStore
    });
    if (!asset) {
      throw new Error(`Asset not found in storage: ${assetId}`);
    }
    if (asset.buffer) {
      return asset.buffer;
    }
    if (asset.stream) {
      return new Promise((resolve, reject) => {
        const chunks = [];
        asset.stream.on('data', (c) => chunks.push(c));
        asset.stream.on('end', () => resolve(Buffer.concat(chunks)));
        asset.stream.on('error', (err) => reject(err));
      });
    }
  }

  // Reject arbitrary external URLs to prevent SSRF
  if (/^https?:\/\//i.test(source)) {
    const err = new Error('Fetching arbitrary external URLs is restricted for security. Please upload the asset or use a stored asset ID.');
    err.code = 'UNRESTRICTED_URL_RESTRICTED';
    throw err;
  }

  // Direct absolute filesystem path
  if (path.isAbsolute(source) && fs.existsSync(source) && fs.statSync(source).isFile()) {
    return fs.readFileSync(source);
  }

  // Local filesystem path (e.g. /assets/... or assets/...)
  const cleanPath = source.replace(/^\/+/, '');
  const candidatePaths = [
    path.join(__dirname, 'public', cleanPath),
    path.join(__dirname, cleanPath)
  ];

  for (const p of candidatePaths) {
    const relative = path.relative(__dirname, p);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      continue; // Prevent directory traversal
    }
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
      return fs.readFileSync(p);
    }
  }

  throw new Error(`Could not locate image file for OCR: ${source}`);
}

/**
 * Runs genuine Optical Character Recognition on an image buffer or source.
 * Extracts real text, genuine confidence scores, and accurate line/word bounding boxes.
 * Never invents bounding boxes or confidence scores.
 */
async function recognizeImage(imageSource, options = {}) {
  const buffer = await resolveImageBuffer(imageSource, options);
  if (!buffer || buffer.length === 0) {
    throw new Error('Image data is empty.');
  }

  // Determine image dimensions
  let dims = parseImageDimensions(buffer);

  const worker = await getWorker(options);

  let result;
  try {
    result = await worker.recognize(buffer, {}, {
      text: true,
      blocks: true,
      hocr: true
    });
  } catch (err) {
    const ocrErr = new Error(`OCR Engine processing failure: ${err.message || String(err)}`);
    ocrErr.code = 'OCR_ENGINE_ERROR';
    ocrErr.original = err;
    throw ocrErr;
  }

  const rawText = (result.data?.text || '').trim();
  const rawConfidence = typeof result.data?.confidence === 'number'
    ? Math.round(result.data.confidence)
    : 0;

  // Fallback to hocr for dimensions if header parse failed
  if (!dims && result.data?.hocr) {
    const match = result.data.hocr.match(/bbox 0 0 (\d+) (\d+)/);
    if (match) {
      dims = { width: parseInt(match[1], 10), height: parseInt(match[2], 10) };
    }
  }

  const imgWidth = dims?.width || 0;
  const imgHeight = dims?.height || 0;

  // Extract lines and words with accurate percentage bounding boxes
  const lines = [];
  const words = [];

  const blocks = result.data?.blocks || [];
  for (const block of blocks) {
    for (const para of block.paragraphs || []) {
      for (const line of para.lines || []) {
        const lineText = (line.text || '').trim();
        if (!lineText) continue;

        const lineBBox = dims ? toPercentageBBox(line.bbox, imgWidth, imgHeight) : null;
        const lineConf = typeof line.confidence === 'number' ? Math.round(line.confidence) : 0;

        lines.push({
          text: lineText,
          confidence: lineConf,
          bbox: lineBBox
        });

        for (const word of line.words || []) {
          const wordText = (word.text || '').trim();
          if (!wordText) continue;

          const wordBBox = dims ? toPercentageBBox(word.bbox, imgWidth, imgHeight) : null;
          const wordConf = typeof word.confidence === 'number' ? Math.round(word.confidence) : 0;

          words.push({
            text: wordText,
            confidence: wordConf,
            bbox: wordBBox
          });
        }
      }
    }
  }

  return {
    text: rawText,
    confidence: rawText ? rawConfidence : 0,
    imageDimensions: dims || { width: 0, height: 0 },
    lines,
    words
  };
}

/**
 * Maps compliance findings to actual OCR bounding boxes when the matched text appears in OCR words/lines.
 * Does NOT invent bounding boxes if no match or coordinates exist.
 */
function mapRuleFindingsToBBoxes(findings, ocrLines = [], ocrWords = []) {
  if (!Array.isArray(findings)) return [];

  return findings.map((f) => {
    // If finding already has an accurate bbox, preserve it
    if (f.bbox) return f;

    // Only map OCR-derived or dual-source findings
    if (f.source === 'caption') return f;

    const query = String(f.matchedText || '').toLowerCase().trim();
    if (!query) return f;

    // 1. Search for matching line
    const matchedLine = ocrLines.find((l) =>
      l.bbox && l.text.toLowerCase().includes(query)
    );
    if (matchedLine && matchedLine.bbox) {
      return { ...f, bbox: { ...matchedLine.bbox } };
    }

    // 2. Search for matching word
    const matchedWord = ocrWords.find((w) =>
      w.bbox && (w.text.toLowerCase() === query || w.text.toLowerCase().includes(query))
    );
    if (matchedWord && matchedWord.bbox) {
      return { ...f, bbox: { ...matchedWord.bbox } };
    }

    // If query spans multiple words, find consecutive sequence
    const queryParts = query.split(/\s+/).filter(Boolean);
    if (queryParts.length > 1 && ocrWords.length > 0) {
      for (let i = 0; i <= ocrWords.length - queryParts.length; i++) {
        let match = true;
        for (let j = 0; j < queryParts.length; j++) {
          const cleanOcr = ocrWords[i + j].text.toLowerCase().replace(/[^a-z0-9]/g, '');
          const cleanPart = queryParts[j].replace(/[^a-z0-9]/g, '');
          if (!cleanOcr.includes(cleanPart)) {
            match = false;
            break;
          }
        }
        if (match) {
          const firstBBox = ocrWords[i].bbox;
          const lastBBox = ocrWords[i + queryParts.length - 1].bbox;
          if (firstBBox && lastBBox) {
            const top = Math.min(firstBBox.top, lastBBox.top);
            const left = Math.min(firstBBox.left, lastBBox.left);
            const right = Math.max(firstBBox.left + firstBBox.width, lastBBox.left + lastBBox.width);
            const bottom = Math.max(firstBBox.top + firstBBox.height, lastBBox.top + lastBBox.height);
            return {
              ...f,
              bbox: {
                top: Math.round(top * 10) / 10,
                left: Math.round(left * 10) / 10,
                width: Math.round((right - left) * 10) / 10,
                height: Math.round((bottom - top) * 10) / 10
              }
            };
          }
        }
      }
    }

    // No coordinates provided by OCR engine for this finding — do NOT invent a bounding box
    return f;
  });
}

module.exports = {
  getWorker,
  terminateWorker,
  parseImageDimensions,
  toPercentageBBox,
  resolveImageBuffer,
  recognizeImage,
  mapRuleFindingsToBBoxes
};

