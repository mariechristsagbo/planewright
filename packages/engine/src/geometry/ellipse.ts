import type { Point, ShapeElement } from '../model/elements.ts';
import { ARC_KAPPA, CLOSE, cubicTo, moveTo } from './path.ts';
import type { KindGeometry, PathCommand } from './path.ts';

// The ellipse inscribed in an element's box
// (docs/architecture/engine/rendering-and-hit-testing.md#geometry).

/** A cap on the Newton steps, which rise to the root and stop once a step no longer moves. */
const MAX_STEPS = 200;

/** The distance from (x, 0), x ≥ 0, to the ellipse with semi-axes a ≥ b > 0 about the origin. */
function majorAxisDistance(a: number, b: number, x: number): number {
  const edge = (a * a - b * b) / a;
  if (x >= edge) return Math.abs(x - a);
  const nearestX = (a * a * x) / (a * a - b * b);
  return Math.hypot(nearestX - x, b * Math.sqrt(Math.max(0, 1 - (nearestX / a) ** 2)));
}

/**
 * The distance from (x, y), both ≥ 0, to the ellipse with semi-axes a ≥ b > 0 about the origin.
 * The nearest point is (a²x / (t + a²), b²y / (t + b²)) for the root t of
 * F(t) = (ax / (t + a²))² + (by / (t + b²))² − 1, which is convex and decreasing for t > −b².
 * Newton steps from a t where F ≥ 0 rise towards that root without overshooting it.
 */
function quadrantDistance(a: number, b: number, x: number, y: number): number {
  if (y === 0) return majorAxisDistance(a, b, x);
  if (x === 0) return Math.abs(y - b);
  const aa = a * a;
  const bb = b * b;
  let t = Math.max(b * y - bb, a * x - aa);
  for (let step = 0; step < MAX_STEPS; step += 1) {
    const u = (a * x) / (t + aa);
    const v = (b * y) / (t + bb);
    const slope = -2 * ((u * u) / (t + aa) + (v * v) / (t + bb));
    const next = t - (u * u + v * v - 1) / slope;
    if (!(next > t)) break;
    t = next;
  }
  return Math.hypot((aa * x) / (t + aa) - x, (bb * y) / (t + bb) - y);
}

/**
 * The signed distance from a local point to the ellipse inscribed in a width by height box:
 * negative inside. Without width or height the ellipse is a segment, with no inside.
 */
export function ellipseDistance(width: number, height: number, local: Point): number {
  const a = width / 2;
  const b = height / 2;
  const x = Math.abs(local.x - a);
  const y = Math.abs(local.y - b);
  if (a === 0 || b === 0) return Math.hypot(Math.max(x - a, 0), Math.max(y - b, 0));
  const unsigned = a >= b ? quadrantDistance(a, b, x, y) : quadrantDistance(b, a, y, x);
  return (x / a) ** 2 + (y / b) ** 2 < 1 ? -unsigned : unsigned;
}

/** Four cubic arcs, one per quarter, starting at the right end of the horizontal axis. */
function ellipseOutline(width: number, height: number): readonly PathCommand[] {
  const a = width / 2;
  const b = height / 2;
  const ka = ARC_KAPPA * a;
  const kb = ARC_KAPPA * b;
  return [
    moveTo({ x: width, y: b }),
    cubicTo({ x: width, y: b + kb }, { x: a + ka, y: height }, { x: a, y: height }),
    cubicTo({ x: a - ka, y: height }, { x: 0, y: b + kb }, { x: 0, y: b }),
    cubicTo({ x: 0, y: b - kb }, { x: a - ka, y: 0 }, { x: a, y: 0 }),
    cubicTo({ x: a + ka, y: 0 }, { x: width, y: b - kb }, { x: width, y: b }),
    CLOSE,
  ];
}

export const ELLIPSE: KindGeometry<ShapeElement> = {
  outline: (element) => ellipseOutline(element.width, element.height),
  distance: (element, local) => ellipseDistance(element.width, element.height, local),
  isClosed: () => true,
};
