// Runs the plain-text clipboard step and the clipboard link probe (R-53, R-09, from s83 on) on a
// stubbed page whose evaluate calls the page function in this process with a stubbed
// navigator.clipboard. No browser is started.
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PLAIN_TEXT_MAX, clipboardUrlShape } from '../../lib/clipboard-text.mjs';
import { probes } from '../../lib/probes.mjs';
import { handlers } from '../../lib/steps.mjs';

afterEach(() => vi.unstubAllGlobals());

// A page whose clipboard holds `text` and records every write.
function page(text = '') {
  const writes = [];
  vi.stubGlobal('navigator', {
    clipboard: {
      readText: async () => text,
      writeText: async (value) => {
        writes.push(value);
      },
    },
  });
  const calls = [];
  const evaluate = async (fn, arg) => {
    calls.push(arg);
    return fn(arg);
  };
  return { ctx: { page: { evaluate } }, writes, calls };
}

describe('clipboardWrite', () => {
  it('writes a self-authored plain text through the page and returns only its length', async () => {
    const { ctx, writes } = page();
    const result = await handlers.clipboardWrite(ctx, { text: 'Planewright plain text' });
    expect(writes).toEqual(['Planewright plain text']);
    expect(result).toEqual({ chars: 22 });
  });

  it.each([
    ['an empty text', ''],
    ['a number', 42],
    ['a text over the limit', 'a'.repeat(PLAIN_TEXT_MAX + 1)],
    ['a line break', 'one\ntwo'],
    ['a non-ASCII character', 'café'],
  ])('refuses %s before the page is reached', async (_name, text) => {
    const { ctx, calls } = page();
    await expect(handlers.clipboardWrite(ctx, { text })).rejects.toThrow(
      /^clipboardWrite needs a plain text of 1 to 200 printable ASCII characters\.$/u,
    );
    expect(calls).toHaveLength(0);
  });

  it.each([
    ['a URL', 'see https://example.invalid/x'],
    ['a scheme-relative link', '//example.invalid'],
    ['a www host', 'www.example.invalid'],
    ['a room key', 'x room=abc'],
    ['an encoded json key', 'x json%3Dabc'],
  ])('refuses %s, so a paste can never make a link or an embed', async (_name, text) => {
    const { ctx, calls } = page();
    await expect(handlers.clipboardWrite(ctx, { text })).rejects.toThrow(
      /^clipboardWrite refuses a link-like text\.$/u,
    );
    expect(calls).toHaveLength(0);
  });

  it('accepts a text of exactly the limit', async () => {
    const { ctx, writes } = page();
    const text = 'b'.repeat(PLAIN_TEXT_MAX);
    expect(await handlers.clipboardWrite(ctx, { text })).toEqual({ chars: PLAIN_TEXT_MAX });
    expect(writes).toEqual([text]);
  });
});

describe('clipboardUrl', () => {
  it('keeps a link as its origin, path, query key names and value lengths only', async () => {
    const { ctx } = page('https://excalidraw.com/?element=AbCdEfGhIjKlMnOpQrStU');
    expect(await probes.clipboardUrl(ctx, {})).toEqual({
      url: true,
      chars: 53,
      origin: 'https://excalidraw.com',
      path: '/',
      query: [{ key: 'element', valueLength: 21 }],
      fragment: [],
    });
  });

  it('keeps a fragment as key names and part lengths, never a room value', async () => {
    const room = 'Zz09Zz09Zz09Zz09Zz09';
    const text = `https://excalidraw.com/#room=${room},${'k'.repeat(22)}`;
    const shape = clipboardUrlShape(text);
    // The boolean comes first, so a failure never prints the room value.
    expect(JSON.stringify(shape).includes(room)).toBe(false);
    expect(shape.fragment).toEqual([{ key: 'room', valueLengths: [20, 22] }]);
  });

  it('reduces a text that is not a web link to its length', () => {
    expect(clipboardUrlShape('Planewright plain text')).toEqual({ url: false, chars: 22 });
    expect(clipboardUrlShape('mailto:someone@example.invalid')).toEqual({ url: false, chars: 30 });
  });

  it('replaces a query key that is not an identifier', () => {
    const shape = clipboardUrlShape('https://excalidraw.com/?room%3Dabc=1');
    expect(shape.query).toEqual([{ key: '<non-identifier>', valueLength: 1 }]);
  });
});
