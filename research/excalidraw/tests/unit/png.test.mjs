import { deflateSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import { MASK, decodePng, unmaskedSamples } from '../../lib/png.mjs';

// Builds an RGB PNG whose left half is the mask colour; rows alternate filter types 0 and 1.
function makePng(width, height) {
  const rows = [];
  for (let y = 0; y < height; y += 1) {
    const pixels = [];
    for (let x = 0; x < width; x += 1) pixels.push(...(x < width / 2 ? MASK : [10, 20, 30]));
    if (y % 2 === 0) {
      rows.push(Buffer.from([0, ...pixels]));
    } else {
      const sub = pixels.map((v, i) => (i >= 3 ? (v - pixels[i - 3] + 256) & 0xff : v));
      rows.push(Buffer.from([1, ...sub]));
    }
  }
  const chunk = (type, data) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(data.length, 0);
    head.write(type, 4, 'latin1');
    return Buffer.concat([head, data, Buffer.alloc(4)]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

describe('decodePng and unmaskedSamples', () => {
  const png = decodePng(makePng(40, 20));

  it('decodes size and unfilters rows', () => {
    expect([png.width, png.height, png.bpp]).toEqual([40, 20, 3]);
    expect([...png.rows[1].subarray(0, 3)]).toEqual(MASK);
    expect([...png.rows[1].subarray(117, 120)]).toEqual([10, 20, 30]);
  });

  it('passes a fully masked box and counts misses in an unmasked one', () => {
    expect(unmaskedSamples(png, { x: 0, y: 0, width: 20, height: 20 }).misses).toBe(0);
    const open = unmaskedSamples(png, { x: 20, y: 0, width: 20, height: 20 });
    expect(open.misses).toBe(open.samples);
    expect(open.samples).toBeGreaterThan(0);
  });

  it('refuses unsupported formats', () => {
    const bad = makePng(4, 4);
    bad[24] = 16;
    expect(() => decodePng(bad)).toThrow(/Only 8-bit/u);
  });
});
