import type { Box, Element } from '../model/elements.ts';
import type { ElementId } from '../model/ids.ts';
import { compareDrawingOrder } from '../model/order-key.ts';
import type { SceneReader } from '../scene/store.ts';
import { enclosureRow, encloses, marqueeEdges } from './marquee-rows.ts';

// Box selection (docs/architecture/engine/rendering-and-hit-testing.md#hit-testing and
// #what-issue-35-decided).

/**
 * The elements that a marquee in scene space wholly encloses, edges included, in drawing order
 * (REQ-S06): the scene's spatial index gives the candidates whose world bounds meet the marquee,
 * and an element stays when its kind has a geometry and its whole outline is inside, which its
 * row tells without building the outline's points.
 */
export function enclosedBy(scene: SceneReader, marquee: Box): readonly ElementId[] {
  const edges = marqueeEdges(marquee);
  return scene
    .queryBox(marquee)
    .map((id) => scene.get(id))
    .filter((element): element is Element => element !== undefined)
    .filter((element) => encloses(enclosureRow(element), edges))
    .sort(compareDrawingOrder)
    .map(({ id }) => id);
}
