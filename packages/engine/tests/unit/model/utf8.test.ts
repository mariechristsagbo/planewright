import { describe, expect, it } from 'vitest';

import { exceedsUtf8Bytes } from '../../../src/model/utf8.ts';

describe('exceedsUtf8Bytes', () => {
  it.each([
    ['ASCII', 'abc', 3],
    ['two-byte letters', 'éé', 4],
    ['three-byte characters', '€€', 6],
    ['a surrogate pair, four bytes', '😀', 4],
    ['a lone high surrogate, written as U+FFFD', '\ud800a', 4],
    ['a lone low surrogate', 'a\udc00', 4],
    ['a high surrogate before another high one', '\ud800😀', 7],
    ['a low surrogate after a pair', '😀\ude00', 7],
    ['a mix', 'aé€😀', 10],
  ])('counts %s as UTF-8 bytes', (_, text, bytes) => {
    expect(exceedsUtf8Bytes(text, bytes)).toBe(false);
    expect(exceedsUtf8Bytes(text, bytes - 1)).toBe(true);
  });

  it('answers from the length alone when it can', () => {
    expect(exceedsUtf8Bytes('a'.repeat(11), 10)).toBe(true);
    expect(exceedsUtf8Bytes('€'.repeat(3), 9)).toBe(false);
    expect(exceedsUtf8Bytes('a'.repeat(5), 5)).toBe(false);
    expect(exceedsUtf8Bytes('', 0)).toBe(false);
  });
});
