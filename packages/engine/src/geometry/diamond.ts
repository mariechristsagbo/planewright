import { distance, lerp } from '../math/vector.ts';
import type { Point, ShapeElement } from '../model/elements.ts';
import { CLOSE, cornerRadius, lineTo, moveTo, quadraticTo } from './path.ts';
import type { KindGeometry, PathCommand } from './path.ts';
import { distanceToSegment } from './polyline.ts';

// The diamond: the four midpoints of its box sides, joined by straight edges
// (docs/architecture/engine/rendering-and-hit-testing.md#geometry).

type Corners = readonly [top: Point, right: Point, bottom: Point, left: Point];

const cornersOf = ({ width, height }: ShapeElement): Corners => [
  { x: width / 2, y: 0 },
  { x: width, y: height / 2 },
  { x: width / 2, y: height },
  { x: 0, y: height / 2 },
];

/**
 * Each corner cut `r` along both of its sides, and the cuts joined by a quadratic curve whose
 * control point is the corner. Every side has the same length, at least twice `r`.
 */
function roundOutline(corners: Corners, r: number): readonly PathCommand[] {
  const [top, right, bottom, left] = corners;
  const t = r / distance(top, right);
  const turns = [
    [top, right, bottom],
    [right, bottom, left],
    [bottom, left, top],
    [left, top, right],
  ] as const;
  const commands = [moveTo(lerp(top, right, t))];
  for (const [before, corner, after] of turns) {
    const cut = lerp(corner, before, t);
    commands.push(lineTo(cut), quadraticTo(cut, corner, lerp(corner, after, t)));
  }
  commands.push(CLOSE);
  return commands;
}

/** Whether a local point lies strictly inside; a diamond without width or height has no inside. */
function isInside({ width, height }: ShapeElement, local: Point): boolean {
  const a = width / 2;
  const b = height / 2;
  return Math.abs(local.x - a) * b + Math.abs(local.y - b) * a < a * b;
}

/** Round corners change how a diamond is drawn, not its distance, which is to its four edges. */
export const DIAMOND: KindGeometry<ShapeElement> = {
  outline(element) {
    const corners = cornersOf(element);
    const r = element.style.corners === 'round' ? cornerRadius(element.width, element.height) : 0;
    if (r > 0) return roundOutline(corners, r);
    return [
      ...corners.map((corner, index) => (index === 0 ? moveTo(corner) : lineTo(corner))),
      CLOSE,
    ];
  },
  distance(element, local) {
    const [top, right, bottom, left] = cornersOf(element);
    const edge = Math.min(
      distanceToSegment(local, top, right),
      distanceToSegment(local, right, bottom),
      distanceToSegment(local, bottom, left),
      distanceToSegment(local, left, top),
    );
    return isInside(element, local) ? -edge : edge;
  },
  isClosed: () => true,
};
