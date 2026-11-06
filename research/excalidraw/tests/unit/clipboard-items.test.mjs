// Runs the clipboard items probe (R-53, from s79 on) on a stubbed page whose evaluate calls the
// page function in this process with a stubbed navigator.clipboard. No browser is started.
import { afterEach, describe, expect, it, vi } from 'vitest';

import { pngSize, shapeClipboardItems } from '../../lib/clipboard-items.mjs';
import { probes } from '../../lib/probes.mjs';

const ctx = { page: { evaluate: async (fn, arg) => fn(arg) } };
afterEach(() => vi.unstubAllGlobals());

// The first 33 bytes of a PNG: signature, then the IHDR chunk of a 1170x699 image.
const u32 = (n) => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const IHDR = [0, 0, 0, 13, ...Buffer.from('IHDR'), ...u32(1170), ...u32(699), 8, 6, 0, 0, 0];
const PNG = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, ...IHDR, 1, 2, 3, 4]);
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90">${'<rect/>'.repeat(40)}</svg>`;
const JSON_TEXT = JSON.stringify({ type: 'demo/clipboard', elements: [{ type: 'rectangle' }] });

const item = (blobs) => ({
  types: Object.keys(blobs),
  getType: async (type) => new Blob([blobs[type]], { type }),
});
const clipboard = (items) =>
  vi.stubGlobal('navigator', { clipboard: { read: async () => items.map(item) } });

describe('clipboard items probe', () => {
  it('keeps a PNG item as its type, byte count and header size, never its bytes', async () => {
    clipboard([{ 'image/png': PNG }]);
    const result = await probes.clipboardItems(ctx, {});
    expect(result).toEqual({
      items: [[{ type: 'image/png', bytes: PNG.length, png: { width: 1170, height: 699 } }]],
    });
    expect(JSON.stringify(result).includes('"head"')).toBe(false);
  });

  it('reduces each text type to the clipboard text shape and its byte count', async () => {
    clipboard([{ 'text/plain': JSON_TEXT, 'image/svg+xml': SVG }]);
    const [[plain, svg]] = (await probes.clipboardItems(ctx, {})).items;
    expect(plain).toEqual({
      type: 'text/plain',
      bytes: JSON_TEXT.length,
      chars: JSON_TEXT.length,
      json: true,
      keys: ['type', 'elements'],
      textType: 'demo/clipboard',
      elements: ['rectangle'],
    });
    expect(svg).toMatchObject({ type: 'image/svg+xml', bytes: SVG.length, json: false });
    expect(svg.startsWith).toBe(SVG.slice(0, 24));
    expect(JSON.stringify(svg).includes(SVG.slice(0, 40))).toBe(false);
  });

  it('lists every item in the order the clipboard returns them', async () => {
    clipboard([{ 'image/png': PNG }, { 'text/html': '<p>x</p>' }]);
    const { items } = await probes.clipboardItems(ctx, {});
    const typeNames = (types) => types.map((t) => t.type);
    expect(items.map(typeNames)).toEqual([['image/png'], ['text/html']]);
  });
});

describe('the clipboard item shapes', () => {
  it('read a PNG size only from a full signature and IHDR header', () => {
    expect(pngSize([...PNG])).toEqual({ width: 1170, height: 699 });
    expect(pngSize([...PNG].slice(0, 23))).toBeUndefined();
    const broken = [...PNG];
    broken[1] = 0;
    expect(pngSize(broken)).toBeUndefined();
    const other = [...PNG];
    other[12] = 0x58;
    expect(pngSize(other)).toBeUndefined();
  });

  it('keep a binary type other than PNG as its byte count only', () => {
    const shaped = shapeClipboardItems([[{ type: 'image/webp', bytes: 9, head: [1, 2, 3] }]]);
    expect(shaped).toEqual({ items: [[{ type: 'image/webp', bytes: 9 }]] });
  });
});
