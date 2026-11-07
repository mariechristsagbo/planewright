import type { Element, Point } from '../model/elements.ts';
import type { ElementId } from '../model/ids.ts';
import { compareCodeUnits, keyBetween } from '../model/order-key.ts';
import type { SceneReader } from '../scene/store.ts';

// Duplicate (docs/architecture/engine/interaction.md#transforms, REQ-T08).

/** How far a copy lies from its original. */
export const DUPLICATE_OFFSET: Point = { x: 10, y: 10 };

/**
 * Copies of the elements that the scene holds, in the order given: each with a new identifier,
 * offset by {@link DUPLICATE_OFFSET} and ordered just above its original, below whatever was next.
 * A copy keeps every other field as it is, its group included, until groups (P1) decide otherwise.
 */
export function duplicatesOf(
  scene: SceneReader,
  ids: readonly ElementId[],
  newId: () => ElementId,
): Element[] {
  const ordered = scene.ordered();
  return ids.flatMap((id) => {
    const index = ordered.findIndex((element) => element.id === id);
    const original = ordered[index];
    if (original === undefined) return [];
    const above = ordered
      .slice(index + 1)
      .find((element) => compareCodeUnits(element.order, original.order) > 0);
    return [
      {
        ...original,
        id: newId(),
        order: keyBetween(original.order, above?.order ?? null),
        x: original.x + DUPLICATE_OFFSET.x,
        y: original.y + DUPLICATE_OFFSET.y,
      },
    ];
  });
}
