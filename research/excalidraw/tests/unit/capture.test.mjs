// Exercises the screenshot step with a stub page and CDP session: no browser is started and no
// website is contacted.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { isCovered, isUsableBox, screenshot } from '../../lib/capture.mjs';
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
const VIEW = { cssWidth: 4, cssHeight: 4 };

const matchesOf = (list) => (list ?? []).map((box) => ({ boundingBox: async () => box }));

function stubCtx({ hrefs = [CLEAN_HREF], boxes = {}, present = {}, text = [] } = {}) {
  let reads = 0;
  const captures = [];
  // A box list may be a function of the number of captures taken, for content that appears late.
  const listOf = (value) => (typeof value === 'function' ? value(captures.length) : value);
  const page = {
    locator: (selector) => ({
      all: async () => matchesOf(listOf(boxes[selector])),
      count: async () => present[selector] ?? 0,
    }),
    getByText: (pattern) => ({
      all: async () =>
        pattern instanceof RegExp && pattern.test('#room=x') ? matchesOf(text) : [],
    }),
    evaluate: async () => {
      reads += 1;
      return { href: hrefs[Math.min(reads, hrefs.length) - 1], cssWidth: 4, cssHeight: 4 };
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
    ['matches only boxes left of the viewport', [{ ...BOX, x: -50 }], /mask 0 has no usable box/u],
    ['matches only boxes below the viewport', [{ ...BOX, y: 4 }], /mask 0 has no usable box/u],
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
    expect(isUsableBox(BOX, VIEW)).toBe(true);
    expect(isUsableBox({ ...BOX, height: -1 }, VIEW)).toBe(false);
    expect(isUsableBox({ ...BOX, width: Number.POSITIVE_INFINITY }, VIEW)).toBe(false);
    expect(isUsableBox(undefined, VIEW)).toBe(false);
  });

  it('accepts a box only when part of it lies inside the viewport', () => {
    expect(isUsableBox({ x: -1, y: -1, width: 2, height: 2 }, VIEW)).toBe(true);
    expect(isUsableBox({ x: 3, y: 3, width: 9, height: 9 }, VIEW)).toBe(true);
    expect(isUsableBox({ x: -5000, y: -5000, width: 100, height: 40 }, VIEW)).toBe(false);
    expect(isUsableBox({ x: 4, y: 0, width: 2, height: 2 }, VIEW)).toBe(false);
    expect(isUsableBox({ x: 0, y: -2, width: 2, height: 2 }, VIEW)).toBe(false);
    expect(isUsableBox(BOX, undefined)).toBe(false);
  });

  it('does not let an off-screen mask unlock a capture of a room view', async () => {
    const offscreen = { x: 0, y: 900, width: 2, height: 2 };
    const { ctx, captures } = stubCtx({ hrefs: [ROOM_HREF], boxes: { '.link': [offscreen] } });
    await expect(screenshot(ctx, { name: 'room-offscreen', mask: ['.link'] })).rejects.toThrow(
      /mask 0 has no usable box/u,
    );
    expect(captures).toEqual([]);
    expect(existsSync(shotFile('room-offscreen'))).toBe(false);
  });
});

describe('masks must cover what may show the room value', () => {
  const INPUT = { x: 0, y: 0, width: 2, height: 1 };
  const room = (extra) => stubCtx({ hrefs: [ROOM_HREF], ...extra });

  it('captures when every on-screen link field and image lies inside a mask box', async () => {
    const { ctx } = room({
      boxes: { '.masks': [BOX], '[role=dialog] input': [INPUT], '[role=dialog] img': [BOX] },
    });
    const result = await screenshot(ctx, { name: 'covered', mask: ['.masks'] });
    expect(result.maskBoxes).toEqual([BOX]);
  });

  it.each([
    ['a dialog input', { '[role=dialog] input': [{ x: 2, y: 2, width: 2, height: 1 }] }, []],
    ['a dialog image', { '[role=dialog] img': [{ x: 1, y: 1, width: 3, height: 3 }] }, []],
    ['a dialog canvas', { '[role=dialog] canvas': [{ x: 3, y: 0, width: 1, height: 1 }] }, []],
    ['a dialog textarea', { '[role=dialog] textarea': [{ x: 0, y: 3, width: 1, height: 1 }] }, []],
    ['text that holds a room value', {}, [{ x: 2, y: 0, width: 2, height: 1 }]],
  ])('refuses, before capturing, when %s lies outside every mask', async (_l, extra, text) => {
    const { ctx, captures } = room({ boxes: { '.masks': [BOX], ...extra }, text });
    await expect(screenshot(ctx, { name: 'uncovered', mask: ['.masks'] })).rejects.toThrow(
      /1 element\(s\) that may show the collaboration value are not masked/u,
    );
    expect(captures).toEqual([]);
    expect(existsSync(shotFile('uncovered'))).toBe(false);
  });

  it.each([
    ['a dialog image (a QR code)', '[role=dialog] img'],
    ['a dialog input', '[role=dialog] input'],
  ])('refuses, and writes nothing, when %s appears during the capture', async (_l, selector) => {
    const late = (shots) => (shots > 0 ? [{ x: 2, y: 2, width: 2, height: 2 }] : []);
    const { ctx, captures } = room({ boxes: { '.masks': [BOX], [selector]: late } });
    await expect(screenshot(ctx, { name: 'late-surface', mask: ['.masks'] })).rejects.toThrow(
      /1 element\(s\) that may show the collaboration value are not masked after the capture/u,
    );
    expect(captures).toEqual(['Page.captureScreenshot']);
    expect(existsSync(shotFile('late-surface'))).toBe(false);
  });

  it('ignores off-screen elements, which the capture cannot show', async () => {
    const offscreen = { x: 0, y: 900, width: 2, height: 1 };
    const { ctx } = room({ boxes: { '.masks': [BOX], '[role=dialog] input': [offscreen] } });
    await expect(
      screenshot(ctx, { name: 'offscreen-field', mask: ['.masks'] }),
    ).resolves.toMatchObject({
      masks: 1,
    });
  });

  it('applies only while the URL holds a room or link value', async () => {
    const { ctx } = stubCtx({ boxes: { '[role=dialog] input': [{ ...BOX, x: 2 }] } });
    await expect(screenshot(ctx, { name: 'clean-dialog' })).resolves.toMatchObject({ masks: 0 });
  });

  it('refuses a masked capture when the URL gains a value while it runs', async () => {
    const { ctx, captures } = stubCtx({ hrefs: [CLEAN_HREF, ROOM_HREF], boxes: { '.m': [BOX] } });
    await expect(screenshot(ctx, { name: 'late-masked', mask: ['.m'] })).rejects.toThrow(
      /gained a collaboration value/u,
    );
    expect(captures).toEqual(['Page.captureScreenshot']);
    expect(existsSync(shotFile('late-masked'))).toBe(false);
  });
});

describe('isCovered', () => {
  const view = { cssWidth: 100, cssHeight: 50 };
  const mask = { x: 10, y: 10, width: 30, height: 20 };

  it('needs one mask box to contain the whole element, within 1 px', () => {
    expect(isCovered({ x: 10, y: 10, width: 30, height: 20 }, [mask], view)).toBe(true);
    expect(isCovered({ x: 9.5, y: 10, width: 31, height: 20 }, [mask], view)).toBe(true);
    expect(isCovered({ x: 5, y: 10, width: 30, height: 20 }, [mask], view)).toBe(false);
    const halves = [
      { x: 0, y: 0, width: 50, height: 50 },
      { x: 50, y: 0, width: 50, height: 50 },
    ];
    expect(isCovered({ x: 40, y: 10, width: 20, height: 10 }, halves, view)).toBe(false);
  });

  it('compares only the parts inside the viewport', () => {
    const edge = { x: 80, y: 40, width: 40, height: 40 };
    expect(isCovered(edge, [{ x: 79, y: 39, width: 21, height: 11 }], view)).toBe(true);
    expect(isCovered(edge, [], view)).toBe(false);
  });
});
