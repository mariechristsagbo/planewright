import { describe, expect, it } from 'vitest';

import { randomInt } from '../../../src/math/random.ts';
import type { Random } from '../../../src/math/random.ts';
import {
  KEY_DIGITS,
  compareCodeUnits,
  compareDrawingOrder,
  isOrderKey,
  keyBetween,
  keysBetween,
} from '../../../src/model/order-key.ts';
import type { OrderKey } from '../../../src/model/order-key.ts';
import { randomText, shuffled } from '../../support/generators.ts';
import { checkProperty } from '../../support/property.ts';

const key = (text: string): OrderKey => text as OrderKey;

/** A valid key of 1 to 5 digits, often made of the edge digits 0, 1, y and z. */
function anyKey(random: Random): OrderKey {
  const alphabet = random.next() < 0.5 ? '01yz' : KEY_DIGITS;
  const body = randomText(random, alphabet, randomInt(random, 0, 4));
  return key(`${body}${randomText(random, KEY_DIGITS.slice(1), 1)}`);
}

type Bounds = readonly [OrderKey | null, OrderKey | null];

/** Two ordered bounds, either of which may be absent, sometimes one a prefix of the other. */
function anyBounds(random: Random): Bounds {
  const lower = anyKey(random);
  const choice = randomInt(random, 0, 4);
  if (choice === 0) return [null, null];
  if (choice === 1) return [lower, null];
  if (choice === 2) return [null, lower];
  const upper = choice === 3 ? key(`${lower}${anyKey(random)}`) : anyKey(random);
  const sorted = [lower, upper].sort(compareCodeUnits);
  return sorted[0] === sorted[1] ? [lower, null] : [sorted[0] ?? null, sorted[1] ?? null];
}

/** The key's first `length` digits, followed by zeros, as an integer. */
const digitsValue = (text: string, length: number): bigint =>
  Array.from({ length }, (_, index) => text.charAt(index) || '0').reduce(
    (value, digit) => value * 62n + BigInt(KEY_DIGITS.indexOf(digit)),
    0n,
  );

/**
 * An independent oracle: for each length, the integers strictly between the bounds scaled by
 * 62^length; the first length with one gives the shortest keys, and the middle one is expected.
 */
function oracle(lower: string | null, upper: string | null): string {
  for (let length = 1; ; length += 1) {
    const low = digitsValue(lower ?? '', length) + 1n;
    const scale = 62n ** BigInt(length);
    const high =
      upper === null ? scale - 1n : digitsValue(upper, length) - (upper.length <= length ? 1n : 0n);
    if (low <= high) {
      let value = (low + high) / 2n;
      let text = '';
      for (let place = 0; place < length; place += 1) {
        text = `${KEY_DIGITS.charAt(Number(value % 62n))}${text}`;
        value /= 62n;
      }
      return text;
    }
  }
}

describe('order keys', () => {
  it('have 62 digits in code-unit order', () => {
    expect(KEY_DIGITS).toHaveLength(62);
    const digits = Array.from({ length: 62 }, (_, index) => KEY_DIGITS.charAt(index));
    expect(digits.sort(compareCodeUnits).join('')).toBe(KEY_DIGITS);
  });

  it.each(['V', '1', 'z', 'a1', '0V', 'zzzzV', '00001'])('accept %s', (text) => {
    expect(isOrderKey(text)).toBe(true);
  });

  it.each([
    ['the empty string', ''],
    ['a lone 0', '0'],
    ['a trailing 0', 'V0'],
    ['a hyphen', 'a-'],
    ['a dot', 'a.b'],
    ['a space', ' a'],
    ['a letter outside ASCII', 'é'],
    ['a trailing line break', 'V\n'],
  ])('refuse %s', (_, text) => {
    expect(isOrderKey(text)).toBe(false);
  });
});

describe('keyBetween', () => {
  it.each([
    [null, null, 'V'],
    ['V', null, 'k'],
    [null, 'V', 'F'],
    ['z', null, 'zV'],
    ['zzA5', null, 'zza'],
    [null, '1', '0V'],
    [null, '01', '00V'],
    ['A', 'C5', 'B'],
    ['A', 'C', 'B'],
    ['V', 'W', 'VV'],
    ['V', 'W5', 'W'],
    ['Vz', 'W', 'VzV'],
    ['V', 'V1', 'V0V'],
    ['V', 'V01', 'V00V'],
  ])(
    'REQ-K02 gives the middle of the shortest keys between %s and %s: %s',
    (lower, upper, expected) => {
      const between = keyBetween(
        lower === null ? null : key(lower),
        upper === null ? null : key(upper),
      );
      expect(between).toBe(expected);
      expect(between).toBe(oracle(lower, upper));
    },
  );

  it('REQ-K02 gives a key strictly between its neighbours that never ends with 0', () => {
    checkProperty({ seed: 0x0de7, runs: 2000 }, anyBounds, ([lower, upper]) => {
      const between = keyBetween(lower, upper);
      expect(isOrderKey(between)).toBe(true);
      expect(between.endsWith('0')).toBe(false);
      if (lower !== null) expect(compareCodeUnits(lower, between)).toBe(-1);
      if (upper !== null) expect(compareCodeUnits(between, upper)).toBe(-1);
      expect(between).toBe(oracle(lower, upper));
    });
  });

  it.each([
    ['V', 'V'],
    ['W', 'V'],
    ['a', 'Z'],
  ])('refuses %s and %s, which are not in ascending order', (lower, upper) => {
    expect(() => keyBetween(key(lower), key(upper))).toThrow(
      new RangeError(`The order key "${lower}" is not below "${upper}".`),
    );
  });

  it.each([
    ['V0', null, '"V0"'],
    [null, '', '""'],
    ['V', 'W-', '"W-"'],
  ])('refuses the malformed bound in %s and %s', (lower, upper, bad) => {
    expect(() =>
      keyBetween(lower === null ? null : key(lower), upper === null ? null : key(upper)),
    ).toThrow(new RangeError(`${bad} is not an order key.`));
  });
});

describe('keysBetween', () => {
  it('spreads keys strictly between their bounds, in ascending order', () => {
    checkProperty(
      { seed: 0x5e7, runs: 300 },
      (random) => ({ bounds: anyBounds(random), count: randomInt(random, 0, 40) }),
      ({ bounds: [lower, upper], count }) => {
        const keys = keysBetween(lower, upper, count);
        expect(keys).toHaveLength(count);
        const all = [lower, ...keys, upper].filter((item) => item !== null);
        for (let index = 1; index < all.length; index += 1) {
          expect(compareCodeUnits(all[index - 1] ?? '', all[index] ?? '')).toBe(-1);
        }
        expect(keys.every((item) => isOrderKey(item))).toBe(true);
      },
    );
  });

  it('uses every one-digit key before a longer one', () => {
    expect(keysBetween(null, null, 61).join('')).toBe(KEY_DIGITS.slice(1));
  });

  it('keeps many keys inserted at one place short, unlike repeated single inserts', () => {
    const spread = keysBetween(key('V'), key('W'), 1000);
    expect(Math.max(...spread.map((item) => item.length))).toBeLessThanOrEqual(3);
    let last = key('V');
    for (let index = 0; index < 1000; index += 1) last = keyBetween(last, key('W'));
    expect(last.length).toBeGreaterThan(32);
  });

  it('returns nothing for a count of 0 but still checks its bounds', () => {
    expect(keysBetween(key('V'), null, 0)).toEqual([]);
    expect(() => keysBetween(key('W'), key('V'), 0)).toThrow(RangeError);
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('refuses a count of %s', (count) => {
    expect(() => keysBetween(null, null, count)).toThrow(
      new RangeError(`A count of keys must be a non-negative integer, not ${String(count)}.`),
    );
  });
});

describe('the drawing order', () => {
  it('compares by code unit, never by locale', () => {
    expect(compareCodeUnits('Z', 'a')).toBe(-1);
    expect(compareCodeUnits('a', 'B')).toBe(1);
    expect(compareCodeUnits('a', 'a')).toBe(0);
    expect(compareCodeUnits('a', 'aa')).toBe(-1);
  });

  it('REQ-K02 orders by key, then equal keys by identifier, the same from any start', () => {
    const items = [
      { order: key('V'), id: 'b' },
      { order: key('F'), id: 'z' },
      { order: key('V'), id: 'B' },
      { order: key('V'), id: 'a' },
      { order: key('k'), id: 'a' },
    ];
    const expected = ['F z', 'V B', 'V a', 'V b', 'k a'];
    checkProperty(
      { seed: 0x04d, runs: 20 },
      (random) => shuffled(random, items),
      (shuffled) => {
        const sorted = [...shuffled].sort(compareDrawingOrder);
        expect(sorted.map(({ order, id }) => `${order} ${id}`)).toEqual(expected);
      },
    );
  });
});
