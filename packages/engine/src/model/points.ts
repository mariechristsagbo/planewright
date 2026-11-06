import { rotate } from '../math/vector.ts';
import { nearlyZero } from '../math/tolerance.ts';
import type { Point } from './elements.ts';

/** The geometry of a line, arrow or freehand element (docs/architecture/engine/domain-model.md). */
export interface PointGeometry {
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
  readonly points: readonly Point[];
}

export type NormalizedPoints = Omit<PointGeometry, 'rotation'>;

/** How far from 0 a normalised element's smallest x and y may be. */
export const NORMALIZATION_TOLERANCE = 1e-9;

interface Bounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

function boundsOf(points: readonly Point[]): Bounds {
  if (points.length === 0) {
    throw new RangeError('A point element needs at least one point.');
  }
  let bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const { x, y } of points) {
    bounds = {
      minX: Math.min(bounds.minX, x),
      minY: Math.min(bounds.minY, y),
      maxX: Math.max(bounds.maxX, x),
      maxY: Math.max(bounds.maxY, y),
    };
  }
  return bounds;
}

/** The width and height of the box around the points: a point element's derived size. */
export function pointExtent(points: readonly Point[]): {
  readonly width: number;
  readonly height: number;
} {
  const { minX, minY, maxX, maxY } = boundsOf(points);
  return { width: maxX - minX, height: maxY - minY };
}

/** Whether the smallest x and the smallest y are 0 within {@link NORMALIZATION_TOLERANCE}. */
export function pointsAreNormalized(points: readonly Point[]): boolean {
  const { minX, minY } = boundsOf(points);
  return nearlyZero(minX, NORMALIZATION_TOLERANCE) && nearlyZero(minY, NORMALIZATION_TOLERANCE);
}

/**
 * Normalises a point element's edited points, given in its old local frame, so that their
 * smallest x and y are 0, and moves the origin so that the drawing does not move. The element
 * turns about its box centre, which moves when the size changes, so the new origin is
 * `o + R(m + d / 2) − d / 2`, where the points shift by `−m` and the size changes by `d`; without
 * a rotation it is exactly `o + m`. `previous` must be normalised, as in any valid document.
 */
export function normalizePoints(
  previous: PointGeometry,
  points: readonly Point[],
): NormalizedPoints {
  const before = boundsOf(previous.points);
  const after = boundsOf(points);
  const shifted = points.map(({ x, y }) => ({ x: x - after.minX, y: y - after.minY }));
  if (previous.rotation === 0) {
    return { x: previous.x + after.minX, y: previous.y + after.minY, points: shifted };
  }
  const grow = {
    x: after.maxX - after.minX - (before.maxX - before.minX),
    y: after.maxY - after.minY - (before.maxY - before.minY),
  };
  const turned = rotate(
    { x: after.minX + grow.x / 2, y: after.minY + grow.y / 2 },
    previous.rotation,
  );
  return {
    x: previous.x + turned.x - grow.x / 2,
    y: previous.y + turned.y - grow.y / 2,
    points: shifted,
  };
}
