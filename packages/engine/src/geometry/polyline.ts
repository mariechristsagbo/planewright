import { distance, dot, lerp, midpoint, subtract } from '../math/vector.ts';
import type { FreehandElement, LineElement, Point } from '../model/elements.ts';
import { lineTo, moveTo, quadraticTo } from './path.ts';
import type { KindGeometry, PathCommand } from './path.ts';

// Point kinds: a line is its polyline, and a freehand stroke is drawn smoothed but measured as
// its polyline (docs/architecture/engine/rendering-and-hit-testing.md#geometry).

/** The distance from a point to a segment; a segment of no length is its one point. */
export function distanceToSegment(point: Point, start: Point, end: Point): number {
  const along = subtract(end, start);
  const lengthSquared = dot(along, along);
  const t = lengthSquared === 0 ? 0 : dot(subtract(point, start), along) / lengthSquared;
  return distance(point, lerp(start, end, Math.min(1, Math.max(0, t))));
}

/**
 * The unsigned distance from a point to the polyline through `points`: to the point itself when
 * there is only one, and Infinity when there is none.
 */
export function distanceToPolyline(points: readonly Point[], point: Point): number {
  let nearest = Infinity;
  points.forEach((end, index) => {
    const start = points[index - 1] ?? end;
    nearest = Math.min(nearest, distanceToSegment(point, start, end));
  });
  return nearest;
}

/**
 * A freehand outline: quadratic curves through the midpoints of its points, with each inner point
 * as a control point, then a line to the last point. A one-point stroke is a move and a line to
 * the same point, which the renderer draws as a dot.
 */
function smoothedOutline(points: readonly Point[]): readonly PathCommand[] {
  const [first, ...rest] = points;
  if (first === undefined) return [];
  const commands = [moveTo(first)];
  let from = first;
  rest.slice(0, -1).forEach((control, index) => {
    const to = midpoint(control, rest[index + 1] ?? control);
    commands.push(quadraticTo(from, control, to));
    from = to;
  });
  commands.push(lineTo(rest.at(-1) ?? first));
  return commands;
}

export const LINE: KindGeometry<LineElement> = {
  outline: ({ points }) =>
    points.map((point, index) => (index === 0 ? moveTo(point) : lineTo(point))),
  distance: (element, local) => distanceToPolyline(element.points, local),
  isClosed: () => false,
};

export const FREEHAND: KindGeometry<FreehandElement> = {
  outline: (element) => smoothedOutline(element.points),
  distance: (element, local) => distanceToPolyline(element.points, local),
  isClosed: () => false,
};
