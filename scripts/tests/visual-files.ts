import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect } from 'vitest';

// What the tooling tests of the visual baselines share: where the visual specs and their images
// are, a spec's tests by V number, the images that a test captures and a PNG's size in pixels.

/** The web app's end-to-end directory, which holds the visual specs and their images. */
export const E2E = join(import.meta.dirname, '..', '..', 'apps', 'web', 'tests', 'e2e');
export const DESKTOP = 'visual-desktop.spec.ts';
export const TOUCH = 'visual-touch.spec.ts';

/** An image's path in the e2e directory: the spec's snapshot directory and the Linux name. */
export const imageFile = (spec: string, name: string) =>
  `${spec}-snapshots/${name}-chromium-linux.png`;

/** A spec's tests, by V number: the source from its title to the next test's. */
export function testsOf(spec: string): Map<string, string> {
  const source = readFileSync(join(E2E, spec), 'utf8');
  const starts = [...source.matchAll(/\btest\(\s*'(?<id>V\d{2}) /gu)];
  return new Map(
    starts.map((start, index) => [
      start.groups?.['id'] ?? '',
      source.slice(start.index, starts[index + 1]?.index ?? source.length),
    ]),
  );
}

/** The image names of a test's toHaveScreenshot calls. */
export const shotsIn = (test: string) =>
  [...test.matchAll(/toHaveScreenshot\('(?<name>[^']+)\.png'/gu)].map(
    (call) => call.groups?.['name'],
  );

/** A PNG's width and height from its IHDR chunk, after checking its signature. */
export function pngSize(path: string): [number, number] {
  const head = readFileSync(path).subarray(0, 24);
  expect(head.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(head.subarray(12, 16).toString('latin1')).toBe('IHDR');
  return [head.readUInt32BE(16), head.readUInt32BE(20)];
}
