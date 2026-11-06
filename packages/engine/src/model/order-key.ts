import type { Brand } from './brand.ts';

/** A position in the drawing order (docs/architecture/engine/domain-model.md#drawing-order). */
export type OrderKey = Brand<string, 'OrderKey'>;

/** The 62 digits of a key in code-unit order; a key reads as a base-62 fraction in [0, 1). */
export const KEY_DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

const BASE = KEY_DIGITS.length;
const HIGHEST = KEY_DIGITS.charAt(BASE - 1);
// At least one digit and never a trailing 0, or no key could fall between k and k0.
const KEY = /^[0-9A-Za-z]*[1-9A-Za-z]$/;

export const isOrderKey = (text: string): text is OrderKey => KEY.test(text);

/** Compares by UTF-16 code unit, never by locale, so that every machine sorts alike. */
export function compareCodeUnits(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}

export interface Ordered {
  readonly order: OrderKey;
  readonly id: string;
}

/** The drawing order: ascending key, and equal keys by identifier, so it is total (REQ-K02). */
export const compareDrawingOrder = (a: Ordered, b: Ordered): number =>
  compareCodeUnits(a.order, b.order) || compareCodeUnits(a.id, b.id);

/** The digit at `index`; past the end the fraction goes on with zeros. */
const digitAt = (key: string, index: number): number =>
  index < key.length ? KEY_DIGITS.indexOf(key.charAt(index)) : 0;

/** The middle of the shortest keys above `lower`, where '' stands for 0. */
function keyAbove(lower: string): string {
  let index = 0;
  while (lower.charAt(index) === HIGHEST) {
    index += 1;
  }
  return lower.slice(0, index) + KEY_DIGITS.charAt(Math.floor((digitAt(lower, index) + BASE) / 2));
}

/** The middle of the shortest keys strictly between `lower` ('' for 0) and a greater `upper`. */
function keyWithin(lower: string, upper: string): string {
  let index = 0;
  while (digitAt(lower, index) === digitAt(upper, index)) {
    index += 1;
  }
  const low = digitAt(lower, index);
  const high = digitAt(upper, index);
  const shared = upper.slice(0, index);
  if (upper.length > index + 1) {
    // The upper key goes on, so its digit here is below it: any digit above `low` up to it fits.
    return shared + KEY_DIGITS.charAt(Math.floor((low + 1 + high) / 2));
  }
  if (high - low > 1) {
    return shared + KEY_DIGITS.charAt(Math.floor((low + high) / 2));
  }
  // Adjacent digits where the upper key ends: keep the lower digit and go above the lower key's rest.
  return shared + KEY_DIGITS.charAt(low) + keyAbove(lower.slice(index + 1));
}

function checkBounds(lower: OrderKey | null, upper: OrderKey | null): void {
  for (const bound of [lower, upper]) {
    if (bound !== null && !isOrderKey(bound)) {
      throw new RangeError(`${JSON.stringify(bound)} is not an order key.`);
    }
  }
  if (lower !== null && upper !== null && lower >= upper) {
    throw new RangeError(`The order key "${lower}" is not below "${upper}".`);
  }
}

/**
 * The shortest key strictly between two keys, the middle one when several are as short; a null
 * bound stands for an end of the order.
 */
export function keyBetween(lower: OrderKey | null, upper: OrderKey | null): OrderKey {
  checkBounds(lower, upper);
  const key = upper === null ? keyAbove(lower ?? '') : keyWithin(lower ?? '', upper);
  return key as OrderKey;
}

/**
 * `count` ascending keys strictly between two keys, spread by halving the gap, so that many keys
 * inserted at one place stay short.
 */
export function keysBetween(
  lower: OrderKey | null,
  upper: OrderKey | null,
  count: number,
): OrderKey[] {
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new RangeError(`A count of keys must be a non-negative integer, not ${String(count)}.`);
  }
  checkBounds(lower, upper);
  if (count === 0) {
    return [];
  }
  const middle = keyBetween(lower, upper);
  const below = Math.floor((count - 1) / 2);
  return [
    ...keysBetween(lower, middle, below),
    middle,
    ...keysBetween(middle, upper, count - 1 - below),
  ];
}
