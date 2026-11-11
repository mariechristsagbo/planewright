// Seeded property checks for the web app's unit tests, in the manner of the engine's checkProperty
// (packages/engine/tests/support/property.ts): a seed fixes the generated values, so that a failure
// names its seed, run and value and replays exactly. The web app's tests import no engine internal,
// and no property library is added, so this module has its own generator.

/** A seeded source of uniform values in [0, 1). */
export interface Seeded {
  next(): number;
}

/** An xorshift32 generator over a seed in [1, 2^32), so that its state is never 0. */
export function seeded(seed: number): Seeded {
  if (!Number.isInteger(seed) || seed < 1 || seed >= 2 ** 32) {
    throw new RangeError(`A seed must be an integer in [1, 2^32), not ${String(seed)}.`);
  }
  let state = seed >>> 0;
  return {
    next() {
      state ^= state << 13;
      state >>>= 0;
      state ^= state >>> 17;
      state ^= state << 5;
      state >>>= 0;
      return state / 2 ** 32;
    },
  };
}

/** A uniform value from `min` to `max`. */
export const between = (random: Seeded, min: number, max: number): number =>
  min + random.next() * (max - min);

/** A uniform integer from `min` to `max`, both included. */
export const integer = (random: Seeded, min: number, max: number): number =>
  min + Math.floor(random.next() * (max - min + 1));

export interface PropertyOptions {
  readonly seed: number;
  /** How many values to check; 100 by default. */
  readonly runs?: number;
}

/**
 * Checks a property on values generated from one seeded sequence; a failure names the seed, the
 * run and the generated value.
 */
export function checkProperty<T>(
  options: PropertyOptions,
  generate: (random: Seeded) => T,
  property: (value: T) => void,
): void {
  const runs = options.runs ?? 100;
  const random = seeded(options.seed);
  for (let run = 1; run <= runs; run += 1) {
    const value = generate(random);
    try {
      property(value);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const where = `seed ${String(options.seed)} on run ${String(run)} of ${String(runs)}`;
      throw new Error(`Property failed for ${where} with ${JSON.stringify(value)}: ${reason}`, {
        cause: error,
      });
    }
  }
}
