import type { Vec } from './vector.ts';

/**
 * An axis-aligned box: its top-left corner and a size that is never negative, the same shape as
 * the model's `Box`. Edges belong to the box, so boxes that touch intersect.
 */
export interface Aabb {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** The smallest box around one or more points. */
export function aabbFromPoints(points: readonly [Vec, ...Vec[]]): Aabb {
  const [first] = points;
  let minX = first.x;
  let minY = first.y;
  let maxX = first.x;
  let maxY = first.y;
  for (const { x, y } of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** The box with two opposite corners given in any order, as a drag in any direction gives. */
export const aabbFromCorners = (a: Vec, b: Vec): Aabb => aabbFromPoints([a, b]);

export const aabbCenter = (box: Aabb): Vec => ({
  x: box.x + box.width / 2,
  y: box.y + box.height / 2,
});

/** The smallest box around two boxes. */
export const aabbUnion = (a: Aabb, b: Aabb): Aabb =>
  aabbFromPoints([
    { x: a.x, y: a.y },
    { x: a.x + a.width, y: a.y + a.height },
    { x: b.x, y: b.y },
    { x: b.x + b.width, y: b.y + b.height },
  ]);

export const aabbIntersects = (a: Aabb, b: Aabb): boolean =>
  a.x <= b.x + b.width && b.x <= a.x + a.width && a.y <= b.y + b.height && b.y <= a.y + a.height;

export const aabbContainsPoint = (box: Aabb, p: Vec): boolean =>
  p.x >= box.x && p.x <= box.x + box.width && p.y >= box.y && p.y <= box.y + box.height;

/** Whether `inner` lies wholly inside `outer`, edges included. */
export const aabbContainsBox = (outer: Aabb, inner: Aabb): boolean =>
  inner.x >= outer.x &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y >= outer.y &&
  inner.y + inner.height <= outer.y + outer.height;

/** Moves every side out by `margin`; a negative margin shrinks the box, at most to its centre. */
export function aabbExpand(box: Aabb, margin: number): Aabb {
  const width = Math.max(0, box.width + 2 * margin);
  const height = Math.max(0, box.height + 2 * margin);
  return {
    x: box.x + (box.width - width) / 2,
    y: box.y + (box.height - height) / 2,
    width,
    height,
  };
}
