import type { HistorySelection } from '../history/entry.ts';
import type { ElementId } from '../model/ids.ts';
import type { SceneStore } from '../scene/store.ts';

// The selection state (docs/architecture/engine/interaction.md#selection-model): which elements
// are selected, in the order they were selected. It is the HistorySelection that the history
// reads and restores, and changing it is never an undo step (REQ-S13).

export interface Selection extends HistorySelection {
  /** The selected elements, each once, in the order they were selected. */
  get(): readonly ElementId[];
  /** Replaces the selection with the given elements that the scene holds, each once, in order. */
  set(ids: readonly ElementId[]): void;
  /** Selects the given elements that the scene holds after those already selected. */
  add(ids: readonly ElementId[]): void;
  remove(ids: readonly ElementId[]): void;
  clear(): void;
  /** Stops following the scene. */
  dispose(): void;
}

/** Whether two selections hold the same elements in the same order. */
export const sameIds = (a: readonly ElementId[], b: readonly ElementId[]): boolean =>
  a.length === b.length && a.every((id, index) => id === b[index]);

/**
 * An empty selection over a scene store. It never holds a missing element: once any change set,
 * a preview, a remote set or an undo included, removes a selected element, it is dropped.
 */
export function createSelection(store: SceneStore): Selection {
  let selected: readonly ElementId[] = [];
  const present = (id: ElementId): boolean => store.get(id) !== undefined;
  const keep = (ids: readonly ElementId[]): readonly ElementId[] =>
    [...new Set(ids)].filter(present);
  const stop = store.subscribe(() => {
    if (!selected.every(present)) selected = selected.filter(present);
  });
  return {
    get: () => selected,
    set(ids) {
      selected = keep(ids);
    },
    add(ids) {
      selected = keep([...selected, ...ids]);
    },
    remove(ids) {
      const removed = new Set(ids);
      selected = selected.filter((id) => !removed.has(id));
    },
    clear() {
      selected = [];
    },
    dispose: stop,
  };
}
