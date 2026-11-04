// Exercises the screenshot step with a stub page and CDP session: no browser is started and no
// website is contacted.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { isUsableBox, screenshot } from '../../lib/capture.mjs';
import { MASK, decodePng, encodePng } from '../../lib/png.mjs';

// Synthetic, low-entropy room value built at run time (see sanitise.test.mjs).
const ROOM_HREF = `https://excalidraw.com/#room=${'a1B2'.repeat(5)},${'k_L-'.repeat(5)}m1`;
const CLEAN_HREF = 'https://excalidraw.com/';
const root = mkdtempSync(join(tmpdir(), 'pw-capture-test-'));
const outDir = join(root, 'session');
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
afterAll(() => rmSync(root, { recursive: true, force: true }));

// A 4x4 grey RGB image, as Page.captureScreenshot returns it.
const rows = Array.from({ length: 4 }, () => Buffer.alloc(12, 128));
const SHOT = encodePng({ width: 4, height: 4, bpp: 3, rows }).toString('base64');
const BOX = { x: 0, y: 0, width: 2, height: 2 };

function stubCtx({ hrefs = [CLEAN_HREF], boxes = {}, present = {} } = {}) {
  let reads = 0;
  const captures = [];
  const page = {
    locator: (selector) => ({
      all: async () => (boxes[selector] ?? []).map((box) => ({ boundingBox: async () => box })),
      count: async () => present[selector] ?? 0,
    }),
    evaluate: async () => {
      reads += 1;
      return { href: hrefs[Math.min(reads, hrefs.length) - 1], cssWidth: 4 };
    },
  };
  const cdp = {
    send: async (method) => {
      captures.push(method);
      return { data: SHOT };
    },
  };
  return { ctx: { page, cdp, outDir }, captures };
}
const shotFile = (name) => join(outDir, 'screenshots', `${name}.png`);

describe('screenshot refusal while the URL holds a collaboration value', () => {
  it('writes an unmasked capture when the fragment holds no value', async () => {
    const result = await screenshot(stubCtx().ctx, { name: 'clean' });
    expect(result).toMatchObject({ file: 'clean.png', masks: 0, maskBoxes: [], width: 4 });
    expect(existsSync(shotFile('clean'))).toBe(true);
  });

  it.each([
    ['a room value', [ROOM_HREF]],
    ['an encoded room value', ['https://excalidraw.com/#room%3Dabc']],
    ['a json link value', ['https://excalidraw.com/#json=abc,def']],
  ])(
    'refuses before capturing when the fragment holds %s and no mask is set',
    async (_l, hrefs) => {
      const { ctx, captures } = stubCtx({ hrefs });
      await expect(screenshot(ctx, { name: 'room-nomask' })).rejects.toThrow(
        /collaboration value/u,
      );
      expect(captures).toEqual([]);
      expect(existsSync(shotFile('room-nomask'))).toBe(false);
    },
  );

  it('refuses when the value appears while the capture runs, and writes nothing', async () => {
    const { ctx, captures } = stubCtx({ hrefs: [CLEAN_HREF, ROOM_HREF] });
    await expect(screenshot(ctx, { name: 'late-room' })).rejects.toThrow(/collaboration value/u);
    expect(captures).toEqual(['Page.captureScreenshot']);
    expect(existsSync(shotFile('late-room'))).toBe(false);
  });

  it('captures a room view only with masks that produced boxes, painted before writing', async () => {
    const { ctx } = stubCtx({ hrefs: [ROOM_HREF], boxes: { '.link': [BOX] } });
    const result = await screenshot(ctx, { name: 'room-masked', mask: ['.link'] });
    expect(result).toMatchObject({ masks: 1, maskBoxes: [BOX], scale: 1 });
    const png = decodePng(readFileSync(shotFile('room-masked')));
    expect([...png.rows[0].subarray(0, 3)]).toEqual(MASK);
    expect([...png.rows[3].subarray(9, 12)]).toEqual([128, 128, 128]);
  });
});

describe('screenshot masks fail closed', () => {
  it.each([
    ['matches nothing', [], /mask 0 matched nothing/u],
    ['matches only hidden elements', [null], /mask 0 has no usable box/u],
    ['matches only empty boxes', [{ ...BOX, width: 0 }], /mask 0 has no usable box/u],
    ['matches only non-finite boxes', [{ ...BOX, x: Number.NaN }], /mask 0 has no usable box/u],
  ])('refuses when a mask %s', async (_label, found, message) => {
    const { ctx, captures } = stubCtx({ boxes: { '.m': found } });
    await expect(screenshot(ctx, { name: 'bad-mask', mask: ['.m'] })).rejects.toThrow(message);
    expect(captures).toEqual([]);
    expect(existsSync(shotFile('bad-mask'))).toBe(false);
  });

  it('refuses when any one of several masks yields no box', async () => {
    const { ctx } = stubCtx({ hrefs: [ROOM_HREF], boxes: { '.a': [BOX], '.b': [null] } });
    await expect(screenshot(ctx, { name: 'one-bad', mask: ['.a', '.b'] })).rejects.toThrow(
      /mask 1 has no usable box/u,
    );
  });

  it('rejects a mask that is not an array', async () => {
    await expect(screenshot(stubCtx().ctx, { name: 'x', mask: '.a' })).rejects.toThrow(/array/u);
  });

  it('refuses while a refuseIf selector is present', async () => {
    const { ctx } = stubCtx({ present: { dialog: 1 } });
    await expect(screenshot(ctx, { name: 'refused', refuseIf: ['dialog'] })).rejects.toThrow(
      /refuseIf/u,
    );
  });

  it('never overwrites an existing capture', async () => {
    writeFileSync(shotFile('taken'), 'earlier capture');
    await expect(screenshot(stubCtx().ctx, { name: 'taken' })).rejects.toThrow(/EEXIST/u);
    expect(readFileSync(shotFile('taken'), 'utf8')).toBe('earlier capture');
  });

  it('accepts only finite boxes with a positive size', () => {
    expect(isUsableBox(BOX)).toBe(true);
    expect(isUsableBox({ ...BOX, height: -1 })).toBe(false);
    expect(isUsableBox({ ...BOX, width: Number.POSITIVE_INFINITY })).toBe(false);
    expect(isUsableBox(undefined)).toBe(false);
  });
});
