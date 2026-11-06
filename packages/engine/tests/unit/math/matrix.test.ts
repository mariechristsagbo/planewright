import { describe, expect, it } from 'vitest';

import {
  IDENTITY,
  applyToPoint,
  applyToVector,
  determinant,
  invertMatrix,
  matrixNearlyEqual,
  multiplyMatrices,
  rotationMatrix,
  scalingMatrix,
  translationMatrix,
} from '../../../src/math/matrix.ts';
import type { Matrix } from '../../../src/math/matrix.ts';
import { randomBetween } from '../../../src/math/random.ts';
import type { Random } from '../../../src/math/random.ts';
import { vec, vecNearlyEqual } from '../../../src/math/vector.ts';
import { anyAngle, pointWithin } from '../../support/generators.ts';
import { checkProperty } from '../../support/property.ts';

/** An invertible transform: a scale away from zero, a rotation and a translation. */
const invertible = (random: Random): Matrix => {
  const sign = (): number => (random.next() < 0.5 ? -1 : 1);
  const scaling = scalingMatrix(
    sign() * randomBetween(random, 0.1, 10),
    sign() * randomBetween(random, 0.1, 10),
  );
  const { x, y } = pointWithin(random, 1_000);
  return multiplyMatrices(
    translationMatrix(x, y),
    multiplyMatrices(rotationMatrix(anyAngle(random)), scaling),
  );
};

describe('the basic transforms', () => {
  it('leave a point alone (identity), move it, scale it and turn it', () => {
    expect(applyToPoint(IDENTITY, vec(3, -4))).toEqual(vec(3, -4));
    expect(applyToPoint(translationMatrix(10, -5), vec(3, -4))).toEqual(vec(13, -9));
    expect(applyToPoint(scalingMatrix(2, -3), vec(3, -4))).toEqual(vec(6, 12));
    expect(vecNearlyEqual(applyToPoint(rotationMatrix(Math.PI / 2), vec(1, 0)), vec(0, 1))).toBe(
      true,
    );
  });

  it('follow the order of Canvas 2D setTransform(a, b, c, d, e, f)', () => {
    const m: Matrix = { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 };
    expect(applyToPoint(m, vec(1, 0))).toEqual(vec(6, 8));
    expect(applyToPoint(m, vec(0, 1))).toEqual(vec(8, 10));
  });

  it('move a vector without the translation', () => {
    const m = multiplyMatrices(translationMatrix(100, 100), scalingMatrix(2, 3));
    expect(applyToVector(m, vec(1, 1))).toEqual(vec(2, 3));
    expect(applyToPoint(m, vec(1, 1))).toEqual(vec(102, 103));
  });
});

describe('multiplyMatrices', () => {
  it('applies the inner transform first', () => {
    const scaleThenMove = multiplyMatrices(translationMatrix(10, 0), scalingMatrix(2, 2));
    const moveThenScale = multiplyMatrices(scalingMatrix(2, 2), translationMatrix(10, 0));
    expect(applyToPoint(scaleThenMove, vec(1, 1))).toEqual(vec(12, 2));
    expect(applyToPoint(moveThenScale, vec(1, 1))).toEqual(vec(22, 2));
    expect(multiplyMatrices(IDENTITY, scaleThenMove)).toEqual(scaleThenMove);
  });

  it('matches applying one transform after the other (property)', () => {
    checkProperty(
      { seed: 301 },
      (random) => ({ m: invertible(random), n: invertible(random), p: pointWithin(random, 100) }),
      ({ m, n, p }) => {
        const product = applyToPoint(multiplyMatrices(m, n), p);
        expect(vecNearlyEqual(product, applyToPoint(m, applyToPoint(n, p)), 1e-9)).toBe(true);
      },
    );
  });
});

describe('determinant', () => {
  it('is the area factor, negative for a mirror', () => {
    expect(determinant(IDENTITY)).toBe(1);
    expect(determinant(scalingMatrix(2, 3))).toBe(6);
    expect(determinant(scalingMatrix(-1, 1))).toBe(-1);
    expect(determinant(translationMatrix(5, 5))).toBe(1);
    expect(determinant(rotationMatrix(1))).toBeCloseTo(1, 15);
  });
});

describe('invertMatrix', () => {
  it('undoes a transform', () => {
    const m = multiplyMatrices(translationMatrix(4, -2), scalingMatrix(2, 0.5));
    const inverse = invertMatrix(m);
    expect(inverse).not.toBeNull();
    expect(applyToPoint(inverse ?? IDENTITY, vec(6, -1))).toEqual(vec(1, 2));
  });

  it('undoes any invertible transform (property)', () => {
    checkProperty(
      { seed: 302 },
      (random) => ({ m: invertible(random), p: pointWithin(random, 1_000) }),
      ({ m, p }) => {
        const inverse = invertMatrix(m);
        expect(inverse).not.toBeNull();
        if (inverse !== null) {
          expect(matrixNearlyEqual(multiplyMatrices(inverse, m), IDENTITY, 1e-9)).toBe(true);
          expect(vecNearlyEqual(applyToPoint(inverse, applyToPoint(m, p)), p, 1e-9)).toBe(true);
        }
      },
    );
  });

  it.each([
    ['a zero scale', scalingMatrix(0, 1)],
    ['a flattening shear', { a: 1, b: 2, c: 2, d: 4, e: 0, f: 0 }],
    ['an infinite scale', scalingMatrix(Infinity, 1)],
    ['a NaN translation', translationMatrix(Number.NaN, 0)],
  ])('has no inverse for %s', (_, m) => {
    expect(invertMatrix(m)).toBeNull();
  });
});

describe('matrixNearlyEqual', () => {
  it.each(['a', 'b', 'c', 'd', 'e', 'f'] as const)('compares the %s entry', (key) => {
    expect(matrixNearlyEqual(IDENTITY, { ...IDENTITY, [key]: IDENTITY[key] + 1e-12 })).toBe(true);
    expect(matrixNearlyEqual(IDENTITY, { ...IDENTITY, [key]: IDENTITY[key] + 0.1 })).toBe(false);
    expect(matrixNearlyEqual(IDENTITY, { ...IDENTITY, [key]: IDENTITY[key] + 0.1 }, 0.2)).toBe(
      true,
    );
  });
});
