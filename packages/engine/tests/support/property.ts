import { createRandom } from '../../src/math/random.ts';
import type { Random } from '../../src/math/random.ts';

export interface PropertyOptions {
  /** Fixes the generated values, so that a failure replays exactly. */
  readonly seed: number;
  /** How many values to check; 100 by default. */
  readonly runs?: number;
}

/**
 * Checks a property on values generated from one seeded sequence. A failure names the seed, the
 * run and the generated value, so the same seed reproduces it.
 */
export function checkProperty<T>(
  options: PropertyOptions,
  generate: (random: Random) => T,
  property: (value: T) => void,
): void {
  const runs = options.runs ?? 100;
  const random = createRandom(options.seed);
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
