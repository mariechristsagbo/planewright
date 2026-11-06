import { describe, expect, it } from 'vitest';

import {
  TAU,
  angleDelta,
  degreesToRadians,
  normalizeAngle,
  radiansToDegrees,
  snapAngle,
} from '../../../src/math/angle.ts';
import { randomBetween } from '../../../src/math/random.ts';
import { nearlyEqual } from '../../../src/math/tolerance.ts';
import { checkProperty } from '../../support/property.ts';

/** Whether two angles point the same way. */
const sameDirection = (a: number, b: number): boolean =>
  nearlyEqual(Math.cos(a), Math.cos(b)) && nearlyEqual(Math.sin(a), Math.sin(b));

describe('TAU', () => {
  it('is a full turn', () => {
    expect(TAU).toBe(Math.PI * 2);
  });
});

describe('normalizeAngle', () => {
  it.each([
    [0, 0],
    [Math.PI, Math.PI],
    [TAU, 0],
    [-Math.PI / 2, (3 * Math.PI) / 2],
    [5 * Math.PI, Math.PI],
  ])('turns %d into %d', (radians, expected) => {
    expect(normalizeAngle(radians)).toBeCloseTo(expected, 12);
  });

  it('gives +0 for -0 and for a negative angle that rounds up to a full turn', () => {
    expect(Object.is(normalizeAngle(-0), 0)).toBe(true);
    expect(Object.is(normalizeAngle(-1e-17), 0)).toBe(true);
    expect(normalizeAngle(TAU * 3)).toBe(0);
  });

  it('gives NaN for a value that is not finite', () => {
    expect(normalizeAngle(Infinity)).toBeNaN();
    expect(normalizeAngle(Number.NaN)).toBeNaN();
  });

  it('keeps the direction and lands in [0, 2π) (property)', () => {
    checkProperty(
      { seed: 101 },
      (random) => randomBetween(random, -1_000, 1_000),
      (radians) => {
        const normal = normalizeAngle(radians);
        expect(normal).toBeGreaterThanOrEqual(0);
        expect(normal).toBeLessThan(TAU);
        expect(sameDirection(normal, radians)).toBe(true);
      },
    );
  });
});

describe('angleDelta', () => {
  it.each([
    [0, Math.PI / 2, Math.PI / 2],
    [Math.PI / 2, 0, -Math.PI / 2],
    [(7 * Math.PI) / 4, Math.PI / 4, Math.PI / 2],
    [Math.PI / 4, (7 * Math.PI) / 4, -Math.PI / 2],
    [0, Math.PI, Math.PI],
    [1, 1, 0],
  ])('turns from %d to %d by %d', (from, to, expected) => {
    expect(angleDelta(from, to)).toBeCloseTo(expected, 12);
  });

  it('is the shortest signed turn, in (−π, π] (property)', () => {
    checkProperty(
      { seed: 102 },
      (random) => [randomBetween(random, -20, 20), randomBetween(random, -20, 20)] as const,
      ([from, to]) => {
        const delta = angleDelta(from, to);
        expect(delta).toBeGreaterThan(-Math.PI);
        expect(delta).toBeLessThanOrEqual(Math.PI);
        expect(sameDirection(from + delta, to)).toBe(true);
      },
    );
  });
});

describe('degreesToRadians and radiansToDegrees', () => {
  it('convert the usual angles', () => {
    expect(degreesToRadians(180)).toBe(Math.PI);
    expect(degreesToRadians(-90)).toBe(-Math.PI / 2);
    expect(radiansToDegrees(Math.PI / 12)).toBeCloseTo(15, 12);
    expect(radiansToDegrees(TAU)).toBe(360);
  });

  it('undo each other (property)', () => {
    checkProperty(
      { seed: 103 },
      (random) => randomBetween(random, -720, 720),
      (degrees) => {
        expect(nearlyEqual(radiansToDegrees(degreesToRadians(degrees)), degrees)).toBe(true);
      },
    );
  });
});

describe('snapAngle', () => {
  const step = degreesToRadians(15);

  it.each([
    [7, 0],
    [8, 15],
    [44, 45],
    [-7, 0],
    [-8, 345],
    [353, 0],
    [367, 0],
  ])('snaps %d° to %d° in 15° steps (REQ-T06)', (degrees, expected) => {
    expect(radiansToDegrees(snapAngle(degreesToRadians(degrees), step))).toBeCloseTo(expected, 9);
  });

  it.each([0, -1, Infinity, Number.NaN])('refuses the step %d', (badStep) => {
    expect(() => snapAngle(1, badStep)).toThrow(RangeError);
  });
});
