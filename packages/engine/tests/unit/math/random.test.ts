import { describe, expect, it } from 'vitest';

import { createRandom, randomBetween, randomInt } from '../../../src/math/random.ts';

const draws = (seed: number, count: number): number[] => {
  const random = createRandom(seed);
  return Array.from({ length: count }, () => random.next());
};

describe('createRandom', () => {
  it('repeats the same sequence for the same seed and differs between seeds', () => {
    expect(draws(7, 50)).toEqual(draws(7, 50));
    expect(draws(7, 3)).not.toEqual(draws(8, 3));
  });

  it('follows the Mulberry32 sequence, so a printed seed replays a failure', () => {
    // Reference values computed from the published algorithm outside this repository.
    expect(draws(1, 3)).toEqual([0.6270739405881613, 0.002735721180215478, 0.5274470399599522]);
    expect(draws(42, 3)).toEqual([0.6011037519201636, 0.44829055899754167, 0.8524657934904099]);
    expect(draws(0xffff_ffff, 3)).toEqual([
      0.8964226141106337, 0.189478256739676, 0.7156526781618595,
    ]);
  });

  it('spreads its values evenly over [0, 1)', () => {
    const values = draws(2026, 10_000);
    const buckets = Array.from({ length: 10 }, () => 0);
    for (const value of values) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      buckets[Math.floor(value * 10)] = (buckets[Math.floor(value * 10)] ?? 0) + 1;
    }
    for (const count of buckets) {
      expect(count).toBeGreaterThan(900);
      expect(count).toBeLessThan(1_100);
    }
  });

  it.each([-1, 1.5, 2 ** 32, Number.NaN])('refuses the seed %d', (seed) => {
    expect(() => createRandom(seed)).toThrow(RangeError);
  });
});

describe('randomInt', () => {
  it('returns every integer of an inclusive range, and only those', () => {
    const random = createRandom(3);
    const seen = new Set<number>();
    for (let draw = 0; draw < 200; draw += 1) {
      const value = randomInt(random, -2, 2);
      expect(Number.isInteger(value)).toBe(true);
      seen.add(value);
    }
    expect([...seen].sort((a, b) => a - b)).toEqual([-2, -1, 0, 1, 2]);
    expect(randomInt(random, 5, 5)).toBe(5);
  });

  it.each([
    [2, 1],
    [0.5, 2],
    [0, 2.5],
  ])('refuses the range [%d, %d]', (min, max) => {
    expect(() => randomInt(createRandom(1), min, max)).toThrow(RangeError);
  });
});

describe('randomBetween', () => {
  it('returns values in [min, max)', () => {
    const random = createRandom(4);
    for (let draw = 0; draw < 200; draw += 1) {
      const value = randomBetween(random, -10, 10);
      expect(value).toBeGreaterThanOrEqual(-10);
      expect(value).toBeLessThan(10);
    }
    expect(randomBetween(random, 3, 3)).toBe(3);
  });

  it.each([
    [1, 0],
    [0, Infinity],
    [Number.NaN, 1],
  ])('refuses the range [%d, %d)', (min, max) => {
    expect(() => randomBetween(createRandom(1), min, max)).toThrow(RangeError);
  });
});
