import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// The visual baselines (ADR 0012, decision 17; the v0.2 plan's S13): exactly the 30 states of the
// ADR's visual-regression matrix, V01 to V30, each one Linux image that CI's Chromium made, used by
// one toHaveScreenshot call in the test of its V number, at its viewport's size, the pixel-ratio
// check at twice it, and within the repository's 262,144-byte file limit. The visual specs capture
// the whole viewport with no mask, clip or loosened comparison.

const E2E = join(import.meta.dirname, '..', '..', 'apps', 'web', 'tests', 'e2e');
const DESKTOP = 'visual-desktop.spec.ts';
const TOUCH = 'visual-touch.spec.ts';
const MAX_BYTES = 262_144;

/** The matrix's states: V number, spec, image name and the image's size in pixels. */
const STATES: readonly (readonly [string, string, string, number, number])[] = [
  ['V01', DESKTOP, '1440x900-rest', 1440, 900],
  ['V02', DESKTOP, '1440x900-single-selection', 1440, 900],
  ['V03', DESKTOP, '1440x900-multi-selection', 1440, 900],
  ['V04', DESKTOP, '1440x900-text-selected', 1440, 900],
  ['V05', DESKTOP, '1440x900-text-editing', 1440, 900],
  ['V06', DESKTOP, '1440x900-menu', 1440, 900],
  ['V07', DESKTOP, '1440x900-shortcuts', 1440, 900],
  ['V08', DESKTOP, '1440x900-about', 1440, 900],
  ['V09', DESKTOP, '1440x900-drawer-open', 1440, 900],
  ['V10', DESKTOP, '1440x900-stale-notice', 1440, 900],
  ['V11', DESKTOP, '1440x900-failed-notice', 1440, 900],
  ['V12', DESKTOP, '1440x900-notices-hidden', 1440, 900],
  ['V13', DESKTOP, '1440x900-empty', 1440, 900],
  ['V14', DESKTOP, '1440x900-canvas-focus', 1440, 900],
  ['V15', TOUCH, '1024x768-touch-rest', 1024, 768],
  ['V16', TOUCH, '1024x768-touch-selection-and-drawer', 1024, 768],
  ['V17', TOUCH, '1024x768-touch-startup-unavailable', 1024, 768],
  ['V18', TOUCH, '390x844-touch-rest', 390, 844],
  ['V19', TOUCH, '390x844-touch-selection-bar', 390, 844],
  ['V20', TOUCH, '390x844-touch-details-sheet', 390, 844],
  ['V21', TOUCH, '390x844-touch-more-open', 390, 844],
  ['V22', TOUCH, '390x844-touch-elements-sheet', 390, 844],
  ['V23', TOUCH, '390x844-touch-text-editing', 390, 844],
  ['V24', TOUCH, '390x844-touch-stale-notice', 390, 844],
  ['V25', TOUCH, '390x844-touch-empty', 390, 844],
  ['V26', TOUCH, '844x390-touch-rest', 844, 390],
  ['V27', TOUCH, '844x390-touch-selection-and-drawer', 844, 390],
  ['V28', TOUCH, '844x390-touch-tool-lock', 844, 390],
  ['V29', TOUCH, '844x390-touch-failed-notice', 844, 390],
  ['V30', DESKTOP, '1440x900-dpr2-rest', 2880, 1800],
];

const imageFile = (spec: string, name: string) => `${spec}-snapshots/${name}-chromium-linux.png`;

/** Every file in the e2e directory's snapshot directories, as `<directory>/<file>`. */
function snapshotFiles(): string[] {
  const directories = readdirSync(E2E).filter((entry) => entry.endsWith('-snapshots'));
  return directories.flatMap((directory) =>
    readdirSync(join(E2E, directory)).map((file) => `${directory}/${file}`),
  );
}

/** A spec's tests, by V number: the source from its title to the next test's. */
function testsOf(spec: string): Map<string, string> {
  const source = readFileSync(join(E2E, spec), 'utf8');
  const starts = [...source.matchAll(/\btest\(\s*'(?<id>V\d{2}) /gu)];
  return new Map(
    starts.map((start, index) => [
      start.groups?.['id'] ?? '',
      source.slice(start.index, starts[index + 1]?.index ?? source.length),
    ]),
  );
}

const SPECS = new Map([DESKTOP, TOUCH].map((spec) => [spec, testsOf(spec)]));

/** The image names of a test's toHaveScreenshot calls. */
const shotsIn = (test: string) =>
  [...test.matchAll(/toHaveScreenshot\('(?<name>[^']+)\.png'/gu)].map(
    (call) => call.groups?.['name'],
  );

/** A PNG's width and height from its IHDR chunk, after checking its signature. */
function pngSize(path: string): [number, number] {
  const head = readFileSync(path).subarray(0, 24);
  expect(head.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(head.subarray(12, 16).toString('latin1')).toBe('IHDR');
  return [head.readUInt32BE(16), head.readUInt32BE(20)];
}

describe('the visual baselines', () => {
  it('are exactly the 30 Linux Chromium images of the matrix, in the snapshot directories', () => {
    const expected = STATES.map(([, spec, name]) => imageFile(spec, name));
    expect(snapshotFiles().sort()).toEqual([...expected].sort());
  });

  it.each(STATES)('%s is %s’s one capture %s, at %i × %i pixels', (...state) => {
    const [id, spec, name, width, height] = state;
    expect(shotsIn(SPECS.get(spec)?.get(id) ?? '')).toEqual([name]);
    expect(pngSize(join(E2E, imageFile(spec, name)))).toEqual([width, height]);
  });

  it('are each at most 262,144 bytes, the file-size guardrail’s limit', () => {
    const sizes = STATES.map(([, spec, name]) => statSync(join(E2E, imageFile(spec, name))).size);
    expect(sizes.filter((bytes) => bytes > MAX_BYTES)).toEqual([]);
  });
});

describe('the visual specs', () => {
  const tests = [...SPECS.values()].flatMap((byId) => [...byId.entries()]);

  it('hold one test per V number, V01 to V30, each with one capture by its own name', () => {
    expect(tests.map(([id]) => id).sort()).toEqual(STATES.map(([id]) => id));
    const names = tests.flatMap(([, test]) => shotsIn(test));
    expect(names).toHaveLength(30);
    expect(new Set(names).size).toBe(30);
  });

  it('capture the whole viewport with no mask, style path, clip or loosened comparison', () => {
    const source = [DESKTOP, TOUCH].map((spec) => readFileSync(join(E2E, spec), 'utf8')).join('');
    const options =
      /\b(mask|maskColor|stylePath|clip|fullPage|threshold|maxDiffPixels|maxDiffPixelRatio)\b/gu;
    expect(source.match(options) ?? []).toEqual([]);
  });

  it('ask for the device scale only in V30, the pixel-ratio check', () => {
    const scaled = tests.filter(([, test]) => test.includes("scale: 'device'")).map(([id]) => id);
    expect(scaled).toEqual(['V30']);
  });
});
