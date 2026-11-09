import { gzipSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import {
  bundleMeasurements,
  bundleViolations,
  gzipSize,
  initialScripts,
} from '../lib/bundle-size.ts';

// The bundle-size guardrail (docs/architecture/engine/quality.md#performance-budgets, REQ-F04):
// the engine, the renderer and the web app's initial JavaScript, minified and gzip-compressed,
// within 60, 15 and 200 KB of 1,000 bytes.

const HTML = `<!doctype html>
<html lang="en">
  <head>
    <script type="module" crossorigin src="/assets/index-q4i8ZCDh.js"></script>
    <link rel="modulepreload" crossorigin href="/assets/vendor-Ab12.js">
    <link rel="stylesheet" crossorigin href="/assets/index-DdCmcNJL.css">
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  </head>
  <body><div id="root"></div></body>
</html>`;

describe('initialScripts', () => {
  it('lists the module scripts and preloaded modules that the page loads first', () => {
    expect(initialScripts(HTML)).toEqual(['assets/index-q4i8ZCDh.js', 'assets/vendor-Ab12.js']);
  });

  it('refuses a page that loads no script, or one from another origin', () => {
    expect(() => initialScripts('<html></html>')).toThrow('no module script');
    expect(() =>
      initialScripts('<script type="module" src="https://cdn.example/x.js"></script>'),
    ).toThrow('https://cdn.example/x.js');
  });
});

describe('gzipSize', () => {
  it('is the size of the content compressed at gzip level 9', () => {
    const text = new TextEncoder().encode('planewright '.repeat(500));
    const size = gzipSize(text);
    expect(size).toBeGreaterThan(20);
    expect(size).toBeLessThan(text.length / 20);
    expect(size).toBe(gzipSync(text, { level: 9 }).length);
  });
});

describe('bundleMeasurements and bundleViolations', () => {
  const sizes = { engine: 41_234, renderer: 6_000, web: 108_030 };

  it('give B11 to B13 in KB of 1,000 bytes, with the bytes behind them', () => {
    expect(bundleMeasurements(sizes)).toEqual([
      { id: 'B11', samples: [41.234], details: { gzipBytes: 41_234 } },
      { id: 'B12', samples: [6], details: { gzipBytes: 6_000 } },
      { id: 'B13', samples: [108.03], details: { gzipBytes: 108_030 } },
    ]);
    expect(bundleViolations(sizes)).toEqual([]);
  });

  it('name every bundle over its budget, at the budget itself allowed', () => {
    expect(bundleViolations({ engine: 60_000, renderer: 15_001, web: 200_001 })).toEqual([
      'B12 renderer ≤ 15 KB: 15.001 KB',
      "B13 web app's initial JavaScript ≤ 200 KB: 200.001 KB",
    ]);
  });
});
