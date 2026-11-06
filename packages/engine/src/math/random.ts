/**
 * A seeded source of uniform values: the same seed always gives the same sequence, so property
 * tests replay and any rule that must vary can still repeat. Identifiers never come from here but
 * from the IdSource port, because they must be unpredictable.
 */
export interface Random {
  /** The next value in [0, 1). */
  next(): number;
}

const UINT32_RANGE = 2 ** 32;

/** A Mulberry32 generator: 32 bits of state, fast, and well spread for test inputs. */
export function createRandom(seed: number): Random {
  if (!Number.isInteger(seed) || seed < 0 || seed >= UINT32_RANGE) {
    throw new RangeError(`A seed must be an integer in [0, 2^32), not ${String(seed)}.`);
  }
  let state = seed;
  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let mixed = Math.imul(state ^ (state >>> 15), state | 1);
      mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
      return ((mixed ^ (mixed >>> 14)) >>> 0) / UINT32_RANGE;
    },
  };
}

/** A uniform integer from `min` to `max`, both included. */
export function randomInt(random: Random, min: number, max: number): number {
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min > max) {
    throw new RangeError(`[${String(min)}, ${String(max)}] is not a range of integers.`);
  }
  return min + Math.floor(random.next() * (max - min + 1));
}

/** A uniform value from `min` to `max`; it reaches `max` only through floating-point rounding. */
export function randomBetween(random: Random, min: number, max: number): number {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) {
    throw new RangeError(`[${String(min)}, ${String(max)}) is not a finite range.`);
  }
  return min + random.next() * (max - min);
}
