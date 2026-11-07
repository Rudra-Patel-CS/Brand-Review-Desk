import assert from 'node:assert/strict';
import { test } from 'node:test';
import { downloadBlob } from './download.js';

test('downloadBlob attaches a named download and delays object URL cleanup', () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const originalDocumentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const originalSetTimeout = globalThis.setTimeout;

  let clicked = false;
  let removed = false;
  let revokedUrl: string | undefined;
  let scheduledDelay: number | undefined;
  const link = {
    href: '',
    download: '',
    style: { display: '' },
    click: () => { clicked = true; },
    remove: () => { removed = true; }
  } as unknown as HTMLAnchorElement;
  const blobUrl = 'blob:test-download';

  try {
    URL.createObjectURL = () => blobUrl;
    URL.revokeObjectURL = (url) => { revokedUrl = url; };
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        createElement: () => link,
        body: { appendChild: () => link }
      }
    });
    globalThis.setTimeout = ((callback: TimerHandler, delay?: number) => {
      scheduledDelay = delay;
      assert.equal(typeof callback, 'function');
      return 1 as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout;

    downloadBlob(new Blob(['{"approved":true}'], { type: 'application/json' }), 'review.json');

    assert.equal(link.href, blobUrl);
    assert.equal(link.download, 'review.json');
    assert.equal(clicked, true);
    assert.equal(removed, true);
    assert.equal(scheduledDelay, 1000);
    assert.equal(revokedUrl, undefined);
  } finally {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    if (originalDocumentDescriptor) {
      Object.defineProperty(globalThis, 'document', originalDocumentDescriptor);
    } else {
      delete (globalThis as { document?: Document }).document;
    }
    globalThis.setTimeout = originalSetTimeout;
  }
});
