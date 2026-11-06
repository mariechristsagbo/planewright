import { describe, expect, it } from 'vitest';

import { aabbContainsPoint } from '../../../src/math/aabb.ts';
import { applyToPoint } from '../../../src/math/matrix.ts';
import {
  obbBounds,
  obbCenter,
  obbContainsPoint,
  obbCorners,
  obbMatrix,
  obbToLocal,
  obbToScene,
} from '../../../src/math/obb.ts';
import type { Obb } from '../../../src/math/obb.ts';
import { randomBetween } from '../../../src/math/random.ts';
import type { Random } from '../../../src/math/random.ts';
import { nearlyEqual } from '../../../src/math/tolerance.ts';
import { vec, vecNearlyEqual } from '../../../src/math/vector.ts';
import type { Vec } from '../../../src/math/vector.ts';
import { anyAngle, pointWithin } from '../../support/generators.ts';
import { checkProperty } from '../../support/property.ts';

const anyObb = (random: Random): Obb => {
  const { x, y } = pointWithin(random, 1_000);
  return {
    x,
    y,
    width: randomBetween(random, 1, 400),
    height: randomBetween(random, 1, 400),
    rotation: anyAngle(random),
  };
};

/** A point inside the box, given as fractions of its width and height. */
const localAt = (obb: Obb, u: number, v: number): Vec => vec(obb.width * u, obb.height * v);

const allNearlyEqual = (actual: readonly Vec[], expected: readonly Vec[]): boolean =>
  actual.length === expected.length &&
  actual.every((point, index) => {
    const other = expected[index];
    return other !== undefined && vecNearlyEqual(point, other);
  });

const flat: Obb = { x: 10, y: 20, width: 4, height: 2, rotation: 0 };
const quarter: Obb = { x: 0, y: 0, width: 4, height: 2, rotation: Math.PI / 2 };

describe('an unrotated oriented box', () => {
  it('is its axis-aligned box', () => {
    expect(obbCenter(flat)).toEqual(vec(12, 21));
    expect(obbCorners(flat)).toEqual([vec(10, 20), vec(14, 20), vec(14, 22), vec(10, 22)]);
    expect(obbBounds(flat)).toEqual({ x: 10, y: 20, width: 4, height: 2 });
    expect(obbToScene(flat, vec(1, 1))).toEqual(vec(11, 21));
    expect(obbToLocal(flat, vec(11, 21))).toEqual(vec(1, 1));
  });
});

describe('a box turned a quarter about its centre', () => {
  it('keeps its centre and swaps its extent', () => {
    expect(obbCenter(quarter)).toEqual(vec(2, 1));
    expect(
      allNearlyEqual(obbCorners(quarter), [vec(3, -1), vec(3, 3), vec(1, 3), vec(1, -1)]),
    ).toBe(true);
    const bounds = obbBounds(quarter);
    expect(vecNearlyEqual(vec(bounds.x, bounds.y), vec(1, -1))).toBe(true);
    expect(vecNearlyEqual(vec(bounds.width, bounds.height), vec(2, 4))).toBe(true);
  });

  it('maps scene points to local ones about the centre (rendering-and-hit-testing.md)', () => {
    expect(vecNearlyEqual(obbToLocal(quarter, vec(3, -1)), vec(0, 0))).toBe(true);
    expect(vecNearlyEqual(obbToScene(quarter, vec(4, 2)), vec(1, 3))).toBe(true);
  });

  it('contains the points of its turned outline only', () => {
    expect(obbContainsPoint(quarter, vec(2, 1))).toBe(true);
    expect(obbContainsPoint(quarter, vec(2.9, 2.9))).toBe(true);
    expect(obbContainsPoint(quarter, vec(3.5, 1))).toBe(false);
    expect(obbContainsPoint(quarter, vec(0, 1))).toBe(false);
  });
});

describe('a box turned by 45°', () => {
  it('has bounds as wide as its diagonal', () => {
    const square: Obb = { x: 0, y: 0, width: 2, height: 2, rotation: Math.PI / 4 };
    const bounds = obbBounds(square);
    expect(bounds.width).toBeCloseTo(2 * Math.SQRT2, 12);
    expect(bounds.height).toBeCloseTo(2 * Math.SQRT2, 12);
    expect(vecNearlyEqual(obbCenter(square), vec(1, 1))).toBe(true);
    expect(obbContainsPoint(square, vec(1.9, 1.9))).toBe(false);
    expect(obbContainsPoint(square, vec(1, -0.3))).toBe(true);
  });
});

describe('oriented boxes (properties)', () => {
  it('map local points to the scene and back, the same way as their matrix', () => {
    checkProperty(
      { seed: 501 },
      (random) => ({ obb: anyObb(random), u: random.next(), v: random.next() }),
      ({ obb, u, v }) => {
        const local = localAt(obb, u, v);
        const scene = obbToScene(obb, local);
        expect(vecNearlyEqual(applyToPoint(obbMatrix(obb), local), scene)).toBe(true);
        expect(vecNearlyEqual(obbToLocal(obb, scene), local)).toBe(true);
        const interior = localAt(obb, 0.01 + u * 0.98, 0.01 + v * 0.98);
        expect(obbContainsPoint(obb, obbToScene(obb, interior))).toBe(true);
      },
    );
  });

  it('keep every corner inside their bounds and their centre fixed', () => {
    checkProperty({ seed: 502 }, anyObb, (obb) => {
      const bounds = obbBounds(obb);
      for (const corner of obbCorners(obb)) {
        const inside = aabbContainsPoint(
          {
            x: bounds.x - 1e-6,
            y: bounds.y - 1e-6,
            width: bounds.width + 2e-6,
            height: bounds.height + 2e-6,
          },
          corner,
        );
        expect(inside).toBe(true);
      }
      expect(vecNearlyEqual(obbToScene(obb, localAt(obb, 0.5, 0.5)), obbCenter(obb))).toBe(true);
      expect(nearlyEqual(bounds.x + bounds.width / 2, obbCenter(obb).x, 1e-9)).toBe(true);
    });
  });

  it('leave points beyond an edge outside', () => {
    checkProperty(
      { seed: 503 },
      (random) => ({ obb: anyObb(random), u: random.next() }),
      ({ obb, u }) => {
        expect(obbContainsPoint(obb, obbToScene(obb, vec(obb.width * u, -0.5)))).toBe(false);
        expect(obbContainsPoint(obb, obbToScene(obb, vec(obb.width + 0.5, obb.height * u)))).toBe(
          false,
        );
      },
    );
  });
});
