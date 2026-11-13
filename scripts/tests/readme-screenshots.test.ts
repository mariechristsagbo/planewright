import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { DESKTOP, E2E, TOUCH, imageFile, pngSize, shotsIn, testsOf } from './visual-files.ts';

// The README's screenshots (issue #52): the README opens with the editor, not with a callout, and
// shows the two screenshots below and no other image, the desktop one before its first section.
// Each is a byte-for-byte copy of a visual baseline of S13, which CI's Chromium made from the
// seeded fixture, so a baseline adopted again fails here until the README's copy follows it. Each
// keeps its size in pixels and its aspect, names Planewright and its viewport in its alternative
// text, and stays within the README's image budget.

const ROOT = join(import.meta.dirname, '..', '..');
const ASSETS = 'docs/assets/readme';
const README = readFileSync(join(ROOT, 'README.md'), 'utf8');
const MAX_BYTES = 131_072;
const MAX_TOTAL_BYTES = 196_608;

/** A README screenshot: its file, the baseline it copies and how wide the README may show it. */
interface Screenshot {
  readonly file: string;
  readonly state: string;
  readonly spec: string;
  readonly name: string;
  readonly size: readonly [number, number];
  readonly viewport: string;
  readonly maxShownWidth: number;
}

const DESKTOP_SHOT: Screenshot = {
  file: 'editor-desktop-1440x900.png',
  state: 'V09',
  spec: DESKTOP,
  name: '1440x900-drawer-open',
  size: [1440, 900],
  viewport: '1440 × 900',
  maxShownWidth: 1440,
};

const PHONE_SHOT: Screenshot = {
  file: 'editor-phone-390x844.png',
  state: 'V19',
  spec: TOUCH,
  name: '390x844-touch-selection-bar',
  size: [390, 844],
  viewport: '390 × 844',
  maxShownWidth: 320,
};

/** The README's screenshots, in the order that it shows them. */
const SCREENSHOTS = [DESKTOP_SHOT, PHONE_SHOT];

/** An image of a Markdown document, as `![alt](src)` or `<img>`, with its attributes and offset. */
interface Image {
  readonly src: string;
  readonly alt: string;
  readonly attributes: ReadonlyMap<string, string>;
  readonly index: number;
}

/** The images of a Markdown document, in the order written. */
function imagesOf(markdown: string): Image[] {
  const written = [...markdown.matchAll(/!\[(?<alt>[^\]]*)\]\((?<src>[^)\s]+)\)/gu)].map(
    ({ groups, index }) => ({
      src: groups?.['src'] ?? '',
      alt: groups?.['alt'] ?? '',
      attributes: new Map<string, string>(),
      index,
    }),
  );
  const tags = [...markdown.matchAll(/<img\b(?<attributes>[^>]*)>/giu)].map(({ groups, index }) => {
    const pairs = (groups?.['attributes'] ?? '').matchAll(/([\w-]+)="([^"]*)"/gu);
    const attributes = new Map([...pairs].map(([, key = '', value = '']) => [key, value]));
    return {
      src: attributes.get('src') ?? '',
      alt: attributes.get('alt') ?? '',
      attributes,
      index,
    };
  });
  return [...written, ...tags].sort((first, second) => first.index - second.index);
}

const IMAGES = imagesOf(README);
const pathOf = (shot: Screenshot) => `${ASSETS}/${shot.file}`;
const imageOf = (shot: Screenshot) => IMAGES.find((image) => image.src === pathOf(shot));
const sha256 = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');

describe('the README', () => {
  it('opens with no GitHub alert and the desktop screenshot before its first section', () => {
    expect(README).not.toMatch(/^>\s*\[!(?:NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/imu);
    expect(IMAGES[0]?.src).toBe(pathOf(DESKTOP_SHOT));
    expect(IMAGES[0]?.index).toBeLessThan(README.indexOf('\n## '));
  });

  it('shows exactly its screenshots, in order, and no other image', () => {
    expect(IMAGES.map((image) => image.src)).toEqual(SCREENSHOTS.map(pathOf));
  });

  it(`keeps only those screenshots in ${ASSETS}`, () => {
    const files = SCREENSHOTS.map((shot) => shot.file);
    expect(readdirSync(join(ROOT, ASSETS)).sort()).toEqual(files.sort());
  });

  it('keeps each screenshot within 131,072 bytes and all within 196,608', () => {
    const sizes = SCREENSHOTS.map((shot) => readFileSync(join(ROOT, pathOf(shot))).length);
    expect(sizes.filter((bytes) => bytes > MAX_BYTES)).toEqual([]);
    expect(sizes.reduce((total, bytes) => total + bytes, 0)).toBeLessThanOrEqual(MAX_TOTAL_BYTES);
  });
});

describe.each(SCREENSHOTS)('the README screenshot $file', (shot) => {
  it("is a byte-for-byte copy of its visual baseline, its V number's one capture", () => {
    expect(shotsIn(testsOf(shot.spec).get(shot.state) ?? '')).toEqual([shot.name]);
    const baseline = join(E2E, imageFile(shot.spec, shot.name));
    expect(sha256(join(ROOT, pathOf(shot)))).toBe(sha256(baseline));
    expect(README).toContain(shot.state);
  });

  it('keeps its size in pixels and its aspect, shown no wider than its own width', () => {
    expect(pngSize(join(ROOT, pathOf(shot)))).toEqual(shot.size);
    const attributes = imageOf(shot)?.attributes ?? new Map<string, string>();
    expect(attributes.has('height')).toBe(false);
    const shown = attributes.get('width') ?? String(shot.size[0]);
    expect(shown).toMatch(/^\d+$/u);
    expect(Number(shown)).toBeLessThanOrEqual(Math.min(shot.size[0], shot.maxShownWidth));
  });

  it('names Planewright and its viewport in its alternative text', () => {
    const alt = imageOf(shot)?.alt ?? '';
    expect(alt).toContain('Planewright');
    expect(alt).toContain(shot.viewport);
  });
});
