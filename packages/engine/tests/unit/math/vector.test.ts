import { describe, expect, it } from 'vitest';

import { TAU } from '../../../src/math/angle.ts';
import { nearlyEqual } from '../../../src/math/tolerance.ts';
import {
  ZERO,
  add,
  angleOf,
  cross,
  distance,
  dot,
  lerp,
  magnitude,
  midpoint,
  negate,
  normalize,
  rotate,
  rotateAbout,
  scale,
  subtract,
  vec,
  vecNearlyEqual,
} from '../../../src/math/vector.ts';
import { anyAngle, pointWithin } from '../../support/generators.ts';
import { checkProperty } from '../../support/property.ts';

const a = vec(3, 4);
const b = vec(-1, 2);

describe('vec and ZERO', () => {
  it('build plain points', () => {
    expect(vec(1, -2)).toEqual({ x: 1, y: -2 });
    expect(ZERO).toEqual({ x: 0, y: 0 });
  });
});

describe('arithmetic', () => {
  it('adds, subtracts, scales and negates', () => {
    expect(add(a, b)).toEqual(vec(2, 6));
    expect(subtract(a, b)).toEqual(vec(4, 2));
    expect(scale(a, -0.5)).toEqual(vec(-1.5, -2));
    expect(negate(b)).toEqual(vec(1, -2));
  });

  it('never changes its arguments', () => {
    const before = { ...a };
    add(a, b);
    scale(a, 2);
    expect(a).toEqual(before);
  });
});

describe('products and lengths', () => {
  it('computes the dot and cross products', () => {
    expect(dot(a, b)).toBe(5);
    expect(cross(a, b)).toBe(10);
    expect(cross(b, a)).toBe(-10);
  });

  it('measures magnitudes and distances', () => {
    expect(magnitude(a)).toBe(5);
    expect(magnitude(ZERO)).toBe(0);
    expect(distance(a, vec(0, 0))).toBe(5);
    expect(distance(vec(1, 1), vec(4, 5))).toBe(5);
  });

  it('relates both products to the magnitudes (property)', () => {
    checkProperty(
      { seed: 201 },
      (random) => [pointWithin(random, 100), pointWithin(random, 100)] as const,
      ([p, q]) => {
        const product = (magnitude(p) * magnitude(q)) ** 2;
        expect(nearlyEqual(dot(p, q) ** 2 + cross(p, q) ** 2, product, 1e-9)).toBe(true);
        expect(distance(p, q)).toBe(distance(q, p));
      },
    );
  });
});

describe('normalize', () => {
  it('gives a unit vector in the same direction', () => {
    expect(normalize(a)).toEqual(vec(0.6, 0.8));
  });

  it('leaves the zero vector at zero', () => {
    expect(normalize(ZERO)).toEqual(ZERO);
  });
});

describe('interpolation', () => {
  it('interpolates and finds the midpoint', () => {
    expect(lerp(a, b, 0)).toEqual(a);
    expect(lerp(a, b, 1)).toEqual(b);
    expect(lerp(a, b, 0.25)).toEqual(vec(2, 3.5));
    expect(midpoint(a, b)).toEqual(vec(1, 3));
  });
});

describe('rotation', () => {
  it('turns from +x towards +y, which is clockwise on a screen whose y points down', () => {
    expect(vecNearlyEqual(rotate(vec(1, 0), Math.PI / 2), vec(0, 1))).toBe(true);
    expect(vecNearlyEqual(rotate(a, Math.PI), vec(-3, -4))).toBe(true);
    expect(rotate(a, 0)).toEqual(a);
  });

  it('turns a point about a centre', () => {
    expect(vecNearlyEqual(rotateAbout(vec(2, 1), vec(1, 1), Math.PI / 2), vec(1, 2))).toBe(true);
    expect(rotateAbout(a, a, 1)).toEqual(a);
  });

  it('keeps lengths and is undone by the opposite turn (property)', () => {
    checkProperty(
      { seed: 202 },
      (random) => ({
        point: pointWithin(random, 1_000),
        center: pointWithin(random, 1_000),
        angle: anyAngle(random),
      }),
      ({ point, center, angle }) => {
        const turned = rotateAbout(point, center, angle);
        expect(nearlyEqual(distance(turned, center), distance(point, center))).toBe(true);
        expect(vecNearlyEqual(rotateAbout(turned, center, -angle), point)).toBe(true);
      },
    );
  });
});

describe('angleOf', () => {
  it.each([
    [vec(1, 0), 0],
    [vec(0, 1), Math.PI / 2],
    [vec(-1, 0), Math.PI],
    [vec(0, -1), (3 * Math.PI) / 2],
    [ZERO, 0],
  ])('gives the direction of %o in [0, 2π)', (v, expected) => {
    expect(angleOf(v)).toBeCloseTo(expected, 12);
  });

  it('is the angle that rotates +x onto the vector (property)', () => {
    checkProperty(
      { seed: 203 },
      (random) => anyAngle(random),
      (angle) => {
        const direction = rotate(vec(1, 0), angle);
        const found = angleOf(direction);
        expect(found).toBeLessThan(TAU);
        expect(vecNearlyEqual(rotate(vec(1, 0), found), direction)).toBe(true);
      },
    );
  });
});

describe('vecNearlyEqual', () => {
  it('compares both coordinates within the tolerance', () => {
    expect(vecNearlyEqual(vec(1, 2), vec(1 + 1e-12, 2 - 1e-12))).toBe(true);
    expect(vecNearlyEqual(vec(1, 2), vec(1.1, 2))).toBe(false);
    expect(vecNearlyEqual(vec(1, 2), vec(1, 2.1))).toBe(false);
    expect(vecNearlyEqual(vec(1, 2), vec(1.05, 2), 0.1)).toBe(true);
  });
});
