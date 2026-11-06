// The plain-text clipboard step and the clipboard link probe (from s83 on). clipboardWrite puts a
// self-authored plain text on the clipboard, so that Paste can be observed with a text the session
// wrote itself (R-53); it refuses anything that reads as a link, so a paste can never make a link
// or an embed that would load a page. clipboardUrl reads what Copy link to object leaves (R-09)
// and keeps only the link's shape: its origin and path, each query key with its value length, and
// each fragment key with its part lengths. The text itself stays in this process.
import { LINK_KEY_TEXT, urlShapeOf } from './sanitise.mjs';

export const PLAIN_TEXT_MAX = 200;
const PRINTABLE = /^[\x20-\x7e]+$/u;
const LINK_LIKE = /:\/\/|^\/\/|\bwww\./iu;
const KEY_NAME = /^[A-Za-z][A-Za-z0-9_-]{0,31}$/u;

function plainText(text) {
  if (typeof text !== 'string' || text.length > PLAIN_TEXT_MAX || !PRINTABLE.test(text)) {
    throw new Error(
      `clipboardWrite needs a plain text of 1 to ${String(PLAIN_TEXT_MAX)} printable ASCII characters.`,
    );
  }
  if (LINK_LIKE.test(text) || LINK_KEY_TEXT.test(text)) {
    throw new Error('clipboardWrite refuses a link-like text.');
  }
  return text;
}

export async function clipboardWrite(ctx, step) {
  const text = plainText(step.text);
  await ctx.page.evaluate((value) => navigator.clipboard.writeText(value), text);
  return { chars: text.length };
}

/** Shape of a clipboard text read as a web link, or its length when it is not one. */
export function clipboardUrlShape(text) {
  const raw = String(text);
  let url;
  try {
    url = new URL(raw);
  } catch {
    return { url: false, chars: raw.length };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:')
    return { url: false, chars: raw.length };
  const { origin, path, fragment } = urlShapeOf(raw);
  const query = [...url.searchParams].map(([key, value]) => ({
    key: KEY_NAME.test(key) ? key : '<non-identifier>',
    valueLength: value.length,
  }));
  return { url: true, chars: raw.length, origin, path, query, fragment };
}

export async function clipboardUrlProbe(ctx) {
  return clipboardUrlShape(await ctx.page.evaluate(() => navigator.clipboard.readText()));
}
