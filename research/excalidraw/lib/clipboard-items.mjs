// The clipboard items read (R-53, from s79 on), for the copies that leave no plain text, such as
// Copy to clipboard as PNG. After an explicit grant on the reference origin, every item that
// navigator.clipboard.read() returns is reduced to its types and their byte counts: a PNG keeps
// its width and height from its header, and a text type keeps only the clipboard text shape of
// sanitise.mjs (its length, JSON key names and type, or a short redacted preview). The bytes and
// texts stay in this process.
import { clipboardShapeOf, redactSecrets } from './sanitise.mjs';

export const HEAD_BYTES = 24;
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

/** Runs in the page: each item's types, with a text's text or a binary's size and first bytes. */
export async function readClipboardItems(headBytes) {
  const items = [];
  for (const item of await navigator.clipboard.read()) {
    const types = [];
    for (const type of item.types) {
      const blob = await item.getType(type);
      if (type.startsWith('text/') || type === 'image/svg+xml') {
        types.push({ type, bytes: blob.size, text: await blob.text() });
      } else {
        const bytes = new Uint8Array(await blob.arrayBuffer());
        types.push({ type, bytes: bytes.length, head: [...bytes.subarray(0, headBytes)] });
      }
    }
    items.push(types);
  }
  return items;
}

/** Width and height from a PNG's first 24 bytes, or undefined unless they hold its IHDR. */
export function pngSize(head) {
  if (!Array.isArray(head) || head.length < HEAD_BYTES) return undefined;
  if (!PNG_SIGNATURE.every((byte, i) => head[i] === byte)) return undefined;
  if (String.fromCharCode(...head.slice(12, 16)) !== 'IHDR') return undefined;
  const u32 = (i) =>
    ((head[i] << 24) >>> 0) + (head[i + 1] << 16) + (head[i + 2] << 8) + head[i + 3];
  return { width: u32(16), height: u32(20) };
}

function shapeType({ type, bytes, text, head }) {
  const name = redactSecrets(String(type));
  if (typeof text === 'string') {
    // The text shape's own `type` is the JSON payload's, so it is renamed beside the MIME type.
    const { type: textType, ...shape } = clipboardShapeOf(text);
    return { type: name, bytes, ...shape, ...(textType !== undefined && { textType }) };
  }
  const png = name === 'image/png' ? pngSize(head) : undefined;
  return { type: name, bytes, ...(png && { png }) };
}

export function shapeClipboardItems(items) {
  return { items: items.map((types) => types.map(shapeType)) };
}
