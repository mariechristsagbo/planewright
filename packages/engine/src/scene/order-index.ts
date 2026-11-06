import type { ElementId } from '../model/ids.ts';
import { compareDrawingOrder } from '../model/order-key.ts';
import type { Ordered } from '../model/order-key.ts';
import type { ElementDelta } from './delta.ts';

/** The drawing order of the scene's elements (docs/architecture/engine/scene-and-viewport.md). */
export interface OrderIndex {
  /** Every identifier by ascending key, then identifier: bottom first (REQ-K02). */
  ids(): readonly ElementId[];
  update(deltas: readonly ElementDelta[]): void;
}

interface Entry extends Ordered {
  readonly id: ElementId;
}

/**
 * Keeps the identifiers sorted. A change set that adds, removes or re-keys elements re-sorts two
 * sorted runs, the kept entries and the new ones, which a run-detecting sort such as V8's merges
 * in linear time; a change set that keeps every key, such as a move, costs nothing here.
 */
export function createOrderIndex(): OrderIndex {
  let entries: readonly Entry[] = [];
  let ids: readonly ElementId[] | undefined = [];
  return {
    ids: () => (ids ??= entries.map(({ id }) => id)),
    update(deltas) {
      const moved = deltas.filter(({ before, after }) => before?.order !== after?.order);
      if (moved.length === 0) {
        return;
      }
      const gone = new Set(moved.map(({ id }) => id));
      const added = moved
        .flatMap(({ after }) => (after === undefined ? [] : [{ id: after.id, order: after.order }]))
        .sort(compareDrawingOrder);
      entries = [...entries.filter(({ id }) => !gone.has(id)), ...added].sort(compareDrawingOrder);
      ids = undefined;
    },
  };
}
