import { describe, expect, it } from 'vitest';

import {
  aabbCenter,
  aabbContainsBox,
  aabbContainsPoint,
  aabbExpand,
  aabbFromCorners,
  aabbFromPoints,
  aabbIntersects,
  aabbUnion,
} from '../../../src/math/aabb.ts';
import type { Aabb } from '../../../src/math/aabb.ts';
import { randomBetween, randomInt } from '../../../src/math/random.ts';
import type { Random } from '../../../src/math/random.ts';
import { vec } from '../../../src/math/vector.ts';
import type { Vec } from '../../../src/math/vector.ts';
import { pointWithin } from '../../support/generators.ts';
import { checkProperty } from '../../support/property.ts';

const box = (x: number, y: number, width: number, height: number): Aabb => ({
  x,
  y,
  width,
  height,
});

const anyBox = (random: Random): Aabb => {
  const { x, y } = pointWithin(random, 1_000);
  return box(x, y, randomBetween(random, 0, 500), randomBetween(random, 0, 500));
};

const somePoints = (random: Random): [Vec, ...Vec[]] => [
  pointWithin(random, 1_000),
  ...Array.from({ length: randomInt(random, 0, 20) }, () => pointWithin(random, 1_000)),
];

const unit = box(0, 0, 10, 10);

describe('aabbFromPoints and aabbFromCorners', () => {
  it('wrap points in the smallest box', () => {
    expect(aabbFromPoints([vec(3, 4)])).toEqual(box(3, 4, 0, 0));
    expect(aabbFromPoints([vec(3, 4), vec(-1, 8), vec(2, -2)])).toEqual(box(-1, -2, 4, 10));
  });

  it('give a positive size to a drag in any direction (REQ-C02)', () => {
    const expected = box(10, 20, 30, 40);
    expect(aabbFromCorners(vec(10, 20), vec(40, 60))).toEqual(expected);
    expect(aabbFromCorners(vec(40, 60), vec(10, 20))).toEqual(expected);
    expect(aabbFromCorners(vec(40, 20), vec(10, 60))).toEqual(expected);
    expect(aabbFromCorners(vec(10, 60), vec(40, 20))).toEqual(expected);
  });

  it('contain every point and touch the extremes (property)', () => {
    checkProperty({ seed: 401 }, somePoints, (points) => {
      const bounds = aabbFromPoints(points);
      expect(points.every((point) => aabbContainsPoint(bounds, point))).toBe(true);
      expect(Math.min(...points.map(({ x }) => x))).toBe(bounds.x);
      expect(Math.max(...points.map(({ y }) => y))).toBeCloseTo(bounds.y + bounds.height, 9);
    });
  });
});

describe('aabbCenter', () => {
  it('is the middle of the box', () => {
    expect(aabbCenter(box(10, -10, 4, 6))).toEqual(vec(12, -7));
  });
});

describe('aabbUnion', () => {
  it('is the smallest box around both', () => {
    expect(aabbUnion(unit, box(5, -5, 20, 5))).toEqual(box(0, -5, 25, 15));
    expect(aabbUnion(unit, box(2, 2, 1, 1))).toEqual(unit);
  });

  it('contains both boxes (property)', () => {
    checkProperty(
      { seed: 402 },
      (random) => [anyBox(random), anyBox(random)] as const,
      ([a, b]) => {
        const union = aabbUnion(a, b);
        expect(aabbContainsBox(union, a)).toBe(true);
        expect(aabbContainsBox(union, b)).toBe(true);
        expect(aabbIntersects(a, b)).toBe(aabbIntersects(b, a));
      },
    );
  });
});

describe('aabbIntersects', () => {
  it.each([
    ['overlapping', box(5, 5, 10, 10), true],
    ['touching at an edge', box(10, 0, 5, 5), true],
    ['inside', box(2, 2, 1, 1), true],
    ['to the right', box(11, 0, 5, 5), false],
    ['to the left', box(-6, 0, 5, 5), false],
    ['below', box(0, 11, 5, 5), false],
    ['above', box(0, -6, 5, 5), false],
  ])('treats a box %s as %s', (_, other, expected) => {
    expect(aabbIntersects(unit, other)).toBe(expected);
  });
});

describe('aabbContainsPoint', () => {
  it.each([
    [vec(5, 5), true],
    [vec(0, 10), true],
    [vec(-0.1, 5), false],
    [vec(10.1, 5), false],
    [vec(5, -0.1), false],
    [vec(5, 10.1), false],
  ])('treats %o as %s, edges included', (point, expected) => {
    expect(aabbContainsPoint(unit, point)).toBe(expected);
  });
});

describe('aabbContainsBox', () => {
  it.each([
    ['itself', unit, true],
    ['a box inside', box(2, 2, 3, 3), true],
    ['a box out to the left', box(-1, 2, 3, 3), false],
    ['a box out to the right', box(8, 2, 3, 3), false],
    ['a box out at the top', box(2, -1, 3, 3), false],
    ['a box out at the bottom', box(2, 8, 3, 3), false],
  ])('treats %s as %s', (_, inner, expected) => {
    expect(aabbContainsBox(unit, inner)).toBe(expected);
  });
});

describe('aabbExpand', () => {
  it('grows every side by the margin', () => {
    expect(aabbExpand(unit, 2)).toEqual(box(-2, -2, 14, 14));
  });

  it('shrinks with a negative margin, down to a point at the centre', () => {
    expect(aabbExpand(unit, -2)).toEqual(box(2, 2, 6, 6));
    expect(aabbExpand(box(0, 0, 10, 4), -3)).toEqual(box(3, 2, 4, 0));
    expect(aabbExpand(unit, -20)).toEqual(box(5, 5, 0, 0));
  });
});
