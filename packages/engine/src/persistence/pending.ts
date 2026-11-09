import type { CanvasState, DocumentState, GroupRecord } from '../model/document.ts';
import type { Element } from '../model/elements.ts';
import type { ElementId, GroupId } from '../model/ids.ts';
import type { SceneStore, SceneUpdate } from '../scene/store.ts';
import type { DocumentDelta } from './repository.ts';

// What autosave has to save (docs/architecture/engine/persistence.md#autosave): its own copy of the
// committed document, which follows every committed change set and never a preview, and the
// elements and groups changed since the last save. A save therefore never holds a transient
// value, such as a text being edited or a shape being dragged, even while one is shown.

/** The changes that a save took, to give back if it does not land. */
export interface Taken {
  readonly elements: readonly ElementId[];
  readonly groups: readonly GroupId[];
  readonly canvas: boolean;
}

export interface Pending {
  /** Whether committed changes wait for a save. */
  readonly dirty: () => boolean;
  /** Follows an applied set: committed ones of every origin but `load` mark what they change. */
  readonly follow: (update: SceneUpdate) => void;
  /** The waiting changes as a delta of committed values; they no longer wait. */
  readonly take: () => { readonly delta: DocumentDelta; readonly taken: Taken };
  /** Changes that a save took but did not land wait again. */
  readonly giveBack: (taken: Taken) => void;
  /** The whole committed document. */
  readonly document: () => DocumentState;
  /** The store's document as it is now, with nothing waiting. */
  readonly reset: () => void;
}

const idOf = (change: SceneUpdate['changes']['elements'][number]): ElementId =>
  change.type === 'update' ? change.id : change.element.id;

/** The committed document, and what changed in it since the last save. */
interface Committed {
  elements: Map<ElementId, Element>;
  groups: Map<GroupId, GroupRecord>;
  canvas: CanvasState;
  readonly changed: {
    readonly elements: Set<ElementId>;
    readonly groups: Set<GroupId>;
    canvas: boolean;
  };
}

/** The values the map holds for the identifiers, in their order. */
const present = <K, V>(map: ReadonlyMap<K, V>, ids: readonly K[]): V[] =>
  ids.flatMap((id) => {
    const value = map.get(id);
    return value === undefined ? [] : [value];
  });

/** A committed set: its elements as the store now holds them, its groups and its canvas. */
function follow(committed: Committed, store: SceneStore, { origin, changes }: SceneUpdate): void {
  const counts = origin !== 'load';
  for (const change of changes.elements) {
    const id = idOf(change);
    const now = store.get(id);
    if (now === undefined) committed.elements.delete(id);
    else committed.elements.set(id, now);
    if (counts) committed.changed.elements.add(id);
  }
  for (const { type, group } of changes.groups) {
    if (type === 'add') committed.groups.set(group.id, group);
    else committed.groups.delete(group.id);
    if (counts) committed.changed.groups.add(group.id);
  }
  if (changes.canvas !== undefined) {
    committed.canvas = changes.canvas.after;
    committed.changed.canvas ||= counts;
  }
}

/** Takes the waiting changes as a delta of their committed values. */
function take(committed: Committed): { readonly delta: DocumentDelta; readonly taken: Taken } {
  const { changed, elements, groups } = committed;
  const taken = {
    elements: [...changed.elements],
    groups: [...changed.groups],
    canvas: changed.canvas,
  };
  changed.elements.clear();
  changed.groups.clear();
  changed.canvas = false;
  const delta: DocumentDelta = {
    upserts: present(elements, taken.elements),
    removals: taken.elements.filter((id) => !elements.has(id)),
    groups: {
      upserts: present(groups, taken.groups),
      removals: taken.groups.filter((id) => !groups.has(id)),
    },
    canvas: committed.canvas,
  };
  return { delta, taken };
}

/**
 * Follows the store from its current document, which must hold no preview. The value of an
 * element that a committed set changed is read from the store as that set is applied, when the
 * store holds the committed value.
 */
export function createPending(store: SceneStore): Pending {
  const changed = { elements: new Set<ElementId>(), groups: new Set<GroupId>(), canvas: false };
  const committed: Committed = {
    elements: new Map(),
    groups: new Map(),
    canvas: store.canvas,
    changed,
  };
  const reset = (): void => {
    const document = store.document();
    committed.elements = new Map(document.elements);
    committed.groups = new Map(document.groups);
    committed.canvas = document.canvas;
    changed.elements.clear();
    changed.groups.clear();
    changed.canvas = false;
  };
  reset();
  return {
    dirty: () => changed.elements.size > 0 || changed.groups.size > 0 || changed.canvas,
    follow: (update) => {
      if (!update.transient) follow(committed, store, update);
    },
    take: () => take(committed),
    giveBack(taken) {
      for (const id of taken.elements) changed.elements.add(id);
      for (const id of taken.groups) changed.groups.add(id);
      changed.canvas ||= taken.canvas;
    },
    document: () => ({
      elements: new Map(committed.elements),
      groups: new Map(committed.groups),
      canvas: committed.canvas,
      rev: 0,
    }),
    reset,
  };
}
