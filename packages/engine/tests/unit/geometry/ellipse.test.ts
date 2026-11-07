import { describe, expect, it } from 'vitest';

import { ELLIPSE } from '../../../src/geometry/ellipse.ts';
import type { PathCommand } from '../../../src/geometry/path.ts';
import { TAU } from '../../../src/math/angle.ts';
import { randomBetween } from '../../../src/math/random.ts';
import type { Random } from '../../../src/math/random.ts';
import type { Point } from '../../../src/model/elements.ts';
import { shapeElement } from '../../support/elements.ts';
import { checkProperty } from '../../support/property.ts';
import { chance, pick } from '../../support/scenes.ts';

/** The control-point factor of a quarter circle drawn as one cubic. */
const K = (4 * (Math.SQRT2 - 1)) / 3;

/** The path with every number rounded to 10⁻⁹. */
const rounded = (path: readonly PathCommand[]): unknown =>
  JSON.parse(
    JSON.stringify(path, (_key, value: unknown) =>
      typeof value === 'number' ? Math.round(value * 1e9) / 1e9 + 0 : value,
    ),
  );

/**
 * The distance from a local point to the ellipse inscribed in a width by height box, found by
 * sampling the curve and refining the nearest sample: the test's own definition, negative inside.
 */
function sampledDistance(width: number, height: number, local: Point): number {
  const a = width / 2;
  const b = height / 2;
  const at = (angle: number) =>
    Math.hypot(a + a * Math.cos(angle) - local.x, b + b * Math.sin(angle) - local.y);
  const samples = 4096;
  let nearest = 0;
  for (let index = 1; index < samples; index += 1) {
    if (at((index * TAU) / samples) < at((nearest * TAU) / samples)) nearest = index;
  }
  let low = ((nearest - 1) * TAU) / samples;
  let high = ((nearest + 1) * TAU) / samples;
  for (let step = 0; step < 100; step += 1) {
    const third = (high - low) / 3;
    if (at(low + third) < at(high - third)) high -= third;
    else low += third;
  }
  const inside = ((local.x - a) / a) ** 2 + ((local.y - b) / b) ** 2 < 1;
  return inside ? -at((low + high) / 2) : at((low + high) / 2);
}

/**
 * A box from 0.02 to 20,000 units on each side, and a point inside, near or outside it, sometimes
 * on one of its axes or at its centre.
 */
function anyEllipseProbe(random: Random) {
  const width = Math.exp(randomBetween(random, Math.log(0.02), Math.log(20_000)));
  const height = Math.exp(randomBetween(random, Math.log(0.02), Math.log(20_000)));
  const angle = randomBetween(random, 0, TAU);
  const reach = randomBetween(random, 0, 2.5);
  const axis = chance(random, 0.3)
    ? pick(random, ['horizontal', 'vertical', 'centre'] as const)
    : 'off';
  const local = {
    x:
      width / 2 +
      (axis === 'vertical' || axis === 'centre' ? 0 : (reach * width * Math.cos(angle)) / 2),
    y:
      height / 2 +
      (axis === 'horizontal' || axis === 'centre' ? 0 : (reach * height * Math.sin(angle)) / 2),
  };
  return { width, height, local };
}

describe('the ellipse geometry', () => {
  it('outlines the ellipse inscribed in its box as four cubic arcs', () => {
    const ellipse = shapeElement('ellipse', 80, 40);
    expect(rounded(ELLIPSE.outline(ellipse))).toStrictEqual(
      rounded([
        { op: 'move', to: { x: 80, y: 20 } },
        {
          op: 'cubic',
          c1: { x: 80, y: 20 + 20 * K },
          c2: { x: 40 + 40 * K, y: 40 },
          to: { x: 40, y: 40 },
        },
        {
          op: 'cubic',
          c1: { x: 40 - 40 * K, y: 40 },
          c2: { x: 0, y: 20 + 20 * K },
          to: { x: 0, y: 20 },
        },
        {
          op: 'cubic',
          c1: { x: 0, y: 20 - 20 * K },
          c2: { x: 40 - 40 * K, y: 0 },
          to: { x: 40, y: 0 },
        },
        {
          op: 'cubic',
          c1: { x: 40 + 40 * K, y: 0 },
          c2: { x: 80, y: 20 - 20 * K },
          to: { x: 80, y: 20 },
        },
        { op: 'close' },
      ]),
    );
    expect(ELLIPSE.isClosed(ellipse)).toBe(true);
  });

  it('measures the signed distance on the axes and inside a circle exactly', () => {
    const ellipse = shapeElement('ellipse', 80, 40);
    expect(ELLIPSE.distance(ellipse, { x: 90, y: 20 })).toBe(10);
    expect(ELLIPSE.distance(ellipse, { x: 40, y: -5 })).toBe(5);
    expect(ELLIPSE.distance(ellipse, { x: 40, y: 20 })).toBe(-20);
    expect(ELLIPSE.distance(ellipse, { x: 75, y: 20 })).toBe(-5);
    expect(ELLIPSE.distance(ellipse, { x: 50, y: 20 })).toBeCloseTo(
      -Math.hypot(40 / 3 - 10, 20 * Math.sqrt(1 - 1 / 9)),
      12,
    );
    const circle = shapeElement('ellipse', 100, 100);
    expect(ELLIPSE.distance(circle, { x: 50, y: 50 })).toBe(-50);
    expect(ELLIPSE.distance(circle, { x: 50 + 30, y: 50 + 40 })).toBeCloseTo(0, 12);
  });

  it('measures a tall ellipse on its long vertical axis as exactly as a wide one', () => {
    const tall = shapeElement('ellipse', 40, 80);
    expect(ELLIPSE.distance(tall, { x: 20, y: 50 })).toBeCloseTo(
      -Math.hypot(40 / 3 - 10, 20 * Math.sqrt(1 - 1 / 9)),
      12,
    );
    expect(ELLIPSE.distance(tall, { x: 20, y: 90 })).toBe(10);
    expect(ELLIPSE.distance(tall, { x: 25, y: 40 })).toBe(-15);
  });

  it('measures an ellipse without width or height as the segment it is, with no inside', () => {
    const flat = shapeElement('ellipse', 0, 40);
    expect(ELLIPSE.distance(flat, { x: 3, y: 20 })).toBe(3);
    expect(ELLIPSE.distance(flat, { x: 0, y: 45 })).toBe(5);
    expect(ELLIPSE.distance(flat, { x: 0, y: 10 })).toBe(0);
  });

  it('finds the nearest point within 0.01 units of a sampled search, on random ellipses', () => {
    checkProperty({ seed: 6101, runs: 300 }, anyEllipseProbe, ({ width, height, local }) => {
      const found = ELLIPSE.distance(shapeElement('ellipse', width, height), local);
      expect(Math.abs(found - sampledDistance(width, height, local))).toBeLessThanOrEqual(0.01);
    });
  });
});
