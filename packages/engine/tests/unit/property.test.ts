import { describe, expect, it } from 'vitest';

import { checkProperty } from '../support/property.ts';

describe('checkProperty', () => {
  it('checks the property on 100 generated values by default', () => {
    const seen: number[] = [];
    checkProperty(
      { seed: 9 },
      (random) => random.next(),
      (value) => {
        seen.push(value);
      },
    );
    expect(seen).toHaveLength(100);
    expect(new Set(seen).size).toBe(100);
  });

  it('generates the same values again from the same seed', () => {
    const collect = (): number[] => {
      const values: number[] = [];
      checkProperty(
        { seed: 9, runs: 5 },
        (random) => random.next(),
        (value) => {
          values.push(value);
        },
      );
      return values;
    };
    expect(collect()).toEqual(collect());
  });

  it('names the seed, the run and the value of a failure', () => {
    const failing = (): void => {
      checkProperty(
        { seed: 31, runs: 10 },
        (random) => ({ x: Math.floor(random.next() * 4) }),
        ({ x }) => {
          expect(x).toBeLessThan(3);
        },
      );
    };
    expect(failing).toThrow(/^Property failed for seed 31 on run \d of 10 with \{"x":3\}: /u);
    expect(failing).toThrow(/expected 3 to be less than 3/u);
  });
});
