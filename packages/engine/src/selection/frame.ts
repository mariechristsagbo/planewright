import { localBox } from '../geometry/world-bounds.ts';
import { aabbUnion } from '../math/aabb.ts';
import { obbBounds, obbToScene } from '../math/obb.ts';
import type { Obb } from '../math/obb.ts';
import type { Element, Point } from '../model/elements.ts';
import type { ElementId } from '../model/ids.ts';
import type { SceneReader } from '../scene/store.ts';

// What a selection shows around its elements, in scene space
// (docs/architecture/engine/interaction.md#selection-model).

/** A box with resize and rotation handles, or the two ends of a lone two-point line. */
export type SelectionFrame =
  | {
      readonly type: 'box';
      readonly box: Obb;
      /** False for a lone text, which has no side handles in P0; absent for every other box. */
      readonly sideHandles?: false;
    }
  | { readonly type: 'ends'; readonly start: Point; readonly end: Point };

const boxOf = (element: Element): Obb => ({ ...localBox(element), rotation: element.rotation });

function frameOf(element: Element): SelectionFrame {
  const box = boxOf(element);
  if (element.kind === 'text') return { type: 'box', box, sideHandles: false };
  const [start, end, ...more] = element.kind === 'line' ? element.points : [];
  if (start === undefined || end === undefined || more.length > 0) return { type: 'box', box };
  return { type: 'ends', start: obbToScene(box, start), end: obbToScene(box, end) };
}

/**
 * The frame of the selected elements that the scene holds: one element's rotated box, without side
 * handles for a text, the ends of a lone two-point line, or the axis-aligned box of the rotated
 * corners of several elements; null when none is selected.
 */
export function selectionFrame(
  scene: SceneReader,
  ids: readonly ElementId[],
): SelectionFrame | null {
  const elements = ids.map((id) => scene.get(id)).filter((element) => element !== undefined);
  const [first, ...others] = elements;
  if (first === undefined) return null;
  if (others.length === 0) return frameOf(first);
  const bounds = others.reduce(
    (union, element) => aabbUnion(union, obbBounds(boxOf(element))),
    obbBounds(boxOf(first)),
  );
  return { type: 'box', box: { ...bounds, rotation: 0 } };
}
