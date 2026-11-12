import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// The web app's viewport (ADR 0012, decision 14; the v0.2 plan's S8, issue #73's D8): the page
// covers the whole screen, under a phone's notch and home indicator too, so that the browser reports
// the safe-area insets that the shell's anchors add.

const HTML = readFileSync(
  join(import.meta.dirname, '..', '..', 'apps', 'web', 'index.html'),
  'utf8',
);

describe("the web app's viewport", () => {
  it('declares viewport-fit=cover beside the device width and the initial scale', () => {
    const metas = [...HTML.matchAll(/<meta name="viewport" content="(?<content>[^"]+)"/gu)];
    expect(metas).toHaveLength(1);
    expect(metas[0]?.groups?.['content']?.split(',').map((part) => part.trim())).toEqual([
      'width=device-width',
      'initial-scale=1.0',
      'viewport-fit=cover',
    ]);
  });
});
