import { createWorker } from 'tesseract.js';
import { OcrToken } from './rulesEngine.js';
import { publicAssetUrl } from './publicDemo.js';

export interface BrowserOcrResult {
  text: string;
  confidence: number;
  lines: OcrToken[];
  words: OcrToken[];
}

let workerPromise: ReturnType<typeof createWorker> | null = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker('eng', 1, {
      workerPath: publicAssetUrl('vendor/worker.min.js'),
      corePath: publicAssetUrl('vendor/core'),
      langPath: publicAssetUrl('vendor/lang'),
      cacheMethod: 'none',
      gzip: true,
      workerBlobURL: false
    });
  }
  return workerPromise;
}

function percentageBox(
  bbox: { x0: number; y0: number; x1: number; y1: number },
  width: number,
  height: number
) {
  const left = Math.max(0, Math.min(100, (bbox.x0 / width) * 100));
  const top = Math.max(0, Math.min(100, (bbox.y0 / height) * 100));
  const right = Math.max(left, Math.min(100, (bbox.x1 / width) * 100));
  const bottom = Math.max(top, Math.min(100, (bbox.y1 / height) * 100));
  return {
    top,
    left,
    width: right - left,
    height: bottom - top
  };
}

export async function recognizeInBrowser(source: string | File): Promise<BrowserOcrResult> {
  const imageUrl = typeof source === 'string' ? source : URL.createObjectURL(source);
  const temporaryUrl = typeof source === 'string' ? null : imageUrl;
  const image = new Image();

  try {
    image.src = imageUrl;
    await image.decode();

    const worker = await getWorker();
    const { data } = await worker.recognize(source, {}, { blocks: true });
    const rawLines = data.blocks?.flatMap((block) =>
      block.paragraphs.flatMap((paragraph) => paragraph.lines)
    ) || [];
    const lines: OcrToken[] = rawLines.map((line) => ({
      text: line.text,
      confidence: line.confidence,
      bbox: percentageBox(line.bbox, image.naturalWidth, image.naturalHeight)
    }));
    const words: OcrToken[] = rawLines.flatMap((line) =>
      line.words.map((word) => ({
        text: word.text,
        confidence: word.confidence,
        bbox: percentageBox(word.bbox, image.naturalWidth, image.naturalHeight)
      }))
    );

    return {
      text: data.text,
      confidence: data.confidence,
      lines,
      words
    };
  } catch (error) {
    workerPromise = null;
    throw error;
  } finally {
    if (temporaryUrl) URL.revokeObjectURL(temporaryUrl);
  }
}
