import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { NODES } from '../../apps/web/tests/e2e/showcase-fixture.ts';
import { E2E, README_SPEC, imageFile, pngSize, shotsIn } from './visual-files.ts';

// The README's screenshots (issue #52): the README opens with the editor, not with a callout, and
// shows the two screenshots below and no other image, the desktop one before its first section.
// Each is a byte-for-byte copy of a baseline of the README showcase's visual spec, which CI's
// Chromium made from the showcase's flow diagram and compares on every run, so a baseline made
// again fails here until the README's copy follows it. Each keeps its size in pixels and its aspect,
// names Planewright, its viewport and every node of the diagram in its alternative text, and stays
// within the README's image budget.

const ROOT = join(import.meta.dirname, '..', '..');
const ASSETS = 'docs/assets/readme';
const README = readFileSync(join(ROOT, 'README.md'), 'utf8');
const MAX_BYTES = 131_072;
const MAX_TOTAL_BYTES = 196_608;

/** A README screenshot: its file, the baseline it copies and how wide the README may show it. */
interface Screenshot {
  readonly file: string;
  readonly name: string;
  readonly size: readonly [number, number];
  readonly viewport: string;
  readonly maxShownWidth: number;
}

const DESKTOP_SHOT: Screenshot = {
  file: 'editor-desktop-1440x900.png',
  name: 'readme-desktop-1440x900',
  size: [1440, 900],
  viewport: '1440 × 900',
  maxShownWidth: 1440,
};

const LANDSCAPE_SHOT: Screenshot = {
  file: 'editor-phone-landscape-844x390.png',
  name: 'readme-landscape-844x390',
  size: [844, 390],
  viewport: '844 × 390',
  maxShownWidth: 844,
};

/** The README's screenshots, in the order that it shows them. */
const SCREENSHOTS = [DESKTOP_SHOT, LANDSCAPE_SHOT];

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

  it(`copies the baselines that ${README_SPEC} captures, one each, and only those`, () => {
    const source = readFileSync(join(E2E, README_SPEC), 'utf8');
    expect(shotsIn(source)).toEqual(SCREENSHOTS.map((shot) => shot.name));
    const directory = `${README_SPEC}-snapshots`;
    const images = SCREENSHOTS.map((shot) =>
      imageFile(README_SPEC, shot.name).slice(directory.length + 1),
    );
    expect(readdirSync(join(E2E, directory)).sort()).toEqual(images.sort());
  });
});

describe.each(SCREENSHOTS)('the README screenshot $file', (shot) => {
  it('is a byte-for-byte copy of its README showcase baseline', () => {
    const baseline = join(E2E, imageFile(README_SPEC, shot.name));
    expect(sha256(join(ROOT, pathOf(shot))), `${pathOf(shot)} copies ${baseline}`).toBe(
      sha256(baseline),
    );
  });

  it('keeps its size in pixels and its aspect, shown no wider than its own width', () => {
    expect(pngSize(join(ROOT, pathOf(shot)))).toEqual(shot.size);
    const attributes = imageOf(shot)?.attributes ?? new Map<string, string>();
    expect(attributes.has('height')).toBe(false);
    const shown = attributes.get('width') ?? String(shot.size[0]);
    expect(shown).toMatch(/^\d+$/u);
    expect(Number(shown)).toBeLessThanOrEqual(Math.min(shot.size[0], shot.maxShownWidth));
  });

  it('names Planewright, its viewport and every node of the diagram in its alternative text', () => {
    const alt = imageOf(shot)?.alt ?? '';
    expect(alt).toContain('Planewright');
    expect(alt).toContain(shot.viewport);
    expect(NODES.map((node) => node.label).filter((label) => !alt.includes(label))).toEqual([]);
  });
});
