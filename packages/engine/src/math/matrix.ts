import { nearlyEqual } from './tolerance.ts';
import type { Vec } from './vector.ts';

/**
 * A two-dimensional affine transform, with its entries in the order of Canvas 2D's
 * `setTransform(a, b, c, d, e, f)`: a point (x, y) goes to (a·x + c·y + e, b·x + d·y + f).
 */
export interface Matrix {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly e: number;
  readonly f: number;
}

const ENTRIES = ['a', 'b', 'c', 'd', 'e', 'f'] as const;

export const IDENTITY: Matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

export const translationMatrix = (dx: number, dy: number): Matrix => ({
  ...IDENTITY,
  e: dx,
  f: dy,
});

export const scalingMatrix = (sx: number, sy: number): Matrix => ({ ...IDENTITY, a: sx, d: sy });

/** A turn about the origin by an angle in radians, from +x towards +y. */
export function rotationMatrix(radians: number): Matrix {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 };
}

/** The transform that applies `inner` first and then `outer`. */
export function multiplyMatrices(outer: Matrix, inner: Matrix): Matrix {
  return {
    a: outer.a * inner.a + outer.c * inner.b,
    b: outer.b * inner.a + outer.d * inner.b,
    c: outer.a * inner.c + outer.c * inner.d,
    d: outer.b * inner.c + outer.d * inner.d,
    e: outer.a * inner.e + outer.c * inner.f + outer.e,
    f: outer.b * inner.e + outer.d * inner.f + outer.f,
  };
}

/** The factor by which the transform scales areas; negative when it mirrors. */
export const determinant = (m: Matrix): number => m.a * m.d - m.b * m.c;

/** The transform that undoes `m`, or null when `m` flattens the plane or is not finite. */
export function invertMatrix(m: Matrix): Matrix | null {
  const det = determinant(m);
  if (det === 0 || !ENTRIES.every((key) => Number.isFinite(m[key]))) {
    return null;
  }
  return {
    a: m.d / det,
    b: -m.b / det,
    c: -m.c / det,
    d: m.a / det,
    e: (m.c * m.f - m.d * m.e) / det,
    f: (m.b * m.e - m.a * m.f) / det,
  };
}

export const applyToPoint = (m: Matrix, p: Vec): Vec => ({
  x: m.a * p.x + m.c * p.y + m.e,
  y: m.b * p.x + m.d * p.y + m.f,
});

/** Transforms a displacement, which the translation does not move. */
export const applyToVector = (m: Matrix, v: Vec): Vec => ({
  x: m.a * v.x + m.c * v.y,
  y: m.b * v.x + m.d * v.y,
});

/** Whether every entry is equal within the tolerance of {@link nearlyEqual}. */
export const matrixNearlyEqual = (m: Matrix, n: Matrix, tolerance?: number): boolean =>
  ENTRIES.every((key) => nearlyEqual(m[key], n[key], tolerance));
