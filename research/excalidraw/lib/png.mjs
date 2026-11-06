// Minimal PNG codec for our own screenshots: decodes and re-encodes 8-bit, non-interlaced
// RGB/RGBA images, paints mask boxes and samples regions. Pure functions; no image is displayed.
import { deflateSync, inflateSync } from 'node:zlib';

export const MASK = [255, 0, 255];

function paeth(a, b, c) {
  const p = a + b - c;
  const [pa, pb, pc] = [Math.abs(p - a), Math.abs(p - b), Math.abs(p - c)];
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

function unfilterRow(filter, row, prev, bpp) {
  for (let i = 0; i < row.length; i += 1) {
    const left = i >= bpp ? row[i - bpp] : 0;
    const up = prev[i];
    const upLeft = i >= bpp ? prev[i - bpp] : 0;
    const add = [0, left, up, (left + up) >> 1, paeth(left, up, upLeft)][filter];
    row[i] = (row[i] + add) & 0xff;
  }
}

/** Decodes an 8-bit, non-interlaced RGB or RGBA PNG into rows of bytes. */
export function decodePng(bytes) {
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const [depth, colour, , , interlace] = bytes.subarray(24, 29);
  if (depth !== 8 || (colour !== 2 && colour !== 6) || interlace !== 0) {
    throw new Error('Only 8-bit non-interlaced RGB/RGBA PNGs are supported.');
  }
  const idat = [];
  for (let at = 8; at < bytes.length;) {
    const length = bytes.readUInt32BE(at);
    if (bytes.toString('latin1', at + 4, at + 8) === 'IDAT') {
      idat.push(bytes.subarray(at + 8, at + 8 + length));
    }
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const bpp = colour === 6 ? 4 : 3;
  const stride = width * bpp;
  const rows = [];
  let prev = new Uint8Array(stride);
  for (let y = 0; y < height; y += 1) {
    const start = y * (stride + 1);
    const row = Uint8Array.from(raw.subarray(start + 1, start + 1 + stride));
    unfilterRow(raw[start], row, prev, bpp);
    rows.push(row);
    prev = row;
  }
  return { width, height, bpp, rows };
}

/** Counts sampled pixels inside the box (inset by 2 px) that are not the mask colour. */
export function unmaskedSamples(png, box, scale = 1) {
  let misses = 0;
  let samples = 0;
  const x0 = Math.ceil((box.x + 2) * scale);
  const y0 = Math.ceil((box.y + 2) * scale);
  const x1 = Math.floor((box.x + box.width - 2) * scale);
  const y1 = Math.floor((box.y + box.height - 2) * scale);
  for (let y = y0; y <= y1 && y < png.height; y += 2) {
    for (let x = x0; x <= x1 && x < png.width; x += 2) {
      const px = png.rows[y].subarray(x * png.bpp, x * png.bpp + 3);
      samples += 1;
      if (px[0] !== MASK[0] || px[1] !== MASK[1] || px[2] !== MASK[2]) misses += 1;
    }
  }
  return { samples, misses };
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes) {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

/** Encodes decoded rows back into a PNG (filter 0 on every row). */
export function encodePng({ width, height, bpp, rows }) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, bpp === 4 ? 6 : 2, 0, 0, 0], 8);
  const raw = Buffer.concat(rows.map((row) => Buffer.concat([Buffer.from([0]), row])));
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Paints CSS-pixel boxes, scaled to image pixels, with the mask colour (opaque). */
export function paintBoxes(png, boxes, scale = 1) {
  for (const box of boxes) {
    const x0 = Math.max(0, Math.floor(box.x * scale));
    const y0 = Math.max(0, Math.floor(box.y * scale));
    const x1 = Math.min(png.width, Math.ceil((box.x + box.width) * scale));
    const y1 = Math.min(png.height, Math.ceil((box.y + box.height) * scale));
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        png.rows[y].set(png.bpp === 4 ? [...MASK, 255] : MASK, x * png.bpp);
      }
    }
  }
  return png;
}
