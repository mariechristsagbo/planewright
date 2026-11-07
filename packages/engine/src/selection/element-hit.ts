import { geometryOf, toLocal } from '../geometry/kinds.ts';
import type { Element, Point } from '../model/elements.ts';
import type { ElementId } from '../model/ids.ts';
import { compareDrawingOrder } from '../model/order-key.ts';
import type { SceneReader } from '../scene/store.ts';

// Whether a press hits an element, and which element it hits
// (docs/architecture/engine/rendering-and-hit-testing.md#hit-testing).

/**
 * Whether a scene point hits an element, with a tolerance `t` in scene units, by the distance `d`
 * from the point, in the element's local frame, to its outline: a text when d ≤ t (REQ-S02); a
 * filled closed kind when d ≤ strokeWidth / 2 + t; an unfilled closed kind, a line or a freehand
 * stroke when |d| ≤ strokeWidth / 2 + t (REQ-S01). A kind without a geometry is never hit.
 */
export function hitsElement(element: Element, point: Point, tolerance: number): boolean {
  const geometry = geometryOf(element);
  if (geometry === undefined) return false;
  const d = geometry.distance(element, toLocal(element, point));
  if (element.kind === 'text') return d <= tolerance;
  const limit = element.style.stroke.width / 2 + tolerance;
  const filled = geometry.isClosed(element) && element.style.fill !== null;
  return filled ? d <= limit : Math.abs(d) <= limit;
}

/**
 * The topmost element in drawing order that a scene point hits (REQ-S04). The candidates are the
 * spatial index's elements whose world bounds, which hold half the stroke, lie within the
 * tolerance of the point, so no element that the point hits is missed.
 */
export function topmostAt(
  scene: SceneReader,
  point: Point,
  tolerance: number,
): ElementId | undefined {
  const candidates = scene
    .queryPoint(point, tolerance)
    .map((id) => scene.get(id))
    .filter((element): element is Element => element !== undefined)
    .sort(compareDrawingOrder);
  return candidates.reverse().find((element) => hitsElement(element, point, tolerance))?.id;
}
