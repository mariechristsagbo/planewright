import { geometryOf } from '../geometry/kinds.ts';
import { localBox } from '../geometry/world-bounds.ts';
import { aabbContainsPoint } from '../math/aabb.ts';
import { obbToScene } from '../math/obb.ts';
import type { Box, Element, Point } from '../model/elements.ts';
import type { ElementId } from '../model/ids.ts';
import { compareDrawingOrder } from '../model/order-key.ts';
import type { SceneReader } from '../scene/store.ts';

// Box selection (docs/architecture/engine/rendering-and-hit-testing.md#hit-testing).

/**
 * The scene points that an element's outline must keep inside a marquee: every point of a point
 * kind, and the four rotated corners of a box kind. An unrotated element is only moved by its
 * origin, so that no rounding through its centre moves a point off an edge it lies on.
 */
function outlinePoints(element: Element): readonly Point[] {
  const box = localBox(element);
  const locals =
    'points' in element
      ? element.points
      : [
          { x: 0, y: 0 },
          { x: box.width, y: 0 },
          { x: box.width, y: box.height },
          { x: 0, y: box.height },
        ];
  if (element.rotation === 0)
    return locals.map(({ x, y }) => ({ x: element.x + x, y: element.y + y }));
  const turned = { ...box, rotation: element.rotation };
  return locals.map((local) => obbToScene(turned, local));
}

/**
 * The elements that a marquee in scene space wholly encloses, edges included, in drawing order
 * (REQ-S06): the scene's spatial index gives the candidates whose world bounds meet the marquee,
 * and an element stays when its whole outline is inside. A kind without a geometry never does.
 */
export function enclosedBy(scene: SceneReader, marquee: Box): readonly ElementId[] {
  return scene
    .queryBox(marquee)
    .map((id) => scene.get(id))
    .filter((element): element is Element => element !== undefined)
    .filter((element) => geometryOf(element) !== undefined)
    .filter((element) => outlinePoints(element).every((point) => aabbContainsPoint(marquee, point)))
    .sort(compareDrawingOrder)
    .map(({ id }) => id);
}
