import type { CanvasState, GroupRecord } from '../model/document.ts';
import type { Element } from '../model/elements.ts';
import type { ClientId, ElementId } from '../model/ids.ts';
import type { ElementPatch } from '../model/patch.ts';

// The one way the document changes (docs/architecture/engine/scene-and-viewport.md#change-sets,
// ADR 0007 and ADR 0010): plain JSON data, so a change set can be saved, sent and inverted.

/**
 * Where a change set comes from. `local` and `history` sets must match the document's current
 * values; `load` and `remote` sets come from elsewhere and are applied as they are.
 */
export type ChangeOrigin = 'local' | 'history' | 'load' | 'remote';

export type ElementChange =
  | { readonly type: 'add'; readonly element: Element }
  | { readonly type: 'remove'; readonly element: Element }
  | {
      readonly type: 'update';
      readonly id: ElementId;
      /** The fields' values before the change; null for a field that was absent. */
      readonly before: ElementPatch;
      /** The same fields after it; null removes a field. */
      readonly after: ElementPatch;
    };

export type GroupChange =
  | { readonly type: 'add'; readonly group: GroupRecord }
  | { readonly type: 'remove'; readonly group: GroupRecord };

export interface CanvasChange {
  readonly before: CanvasState;
  readonly after: CanvasState;
}

/** Who made a change set: the editor session's client and its own sequence number. */
export interface ChangeStamp {
  readonly author: ClientId;
  readonly seq: number;
}

/**
 * Element, group and canvas changes, applied together or not at all. An identifier appears in at
 * most one element change and one group change of a set, so the order of the changes does not
 * matter, and the set is complete: it carries its own derived changes.
 */
export interface ChangeSet extends ChangeStamp {
  readonly elements: readonly ElementChange[];
  readonly groups: readonly GroupChange[];
  readonly canvas?: CanvasChange;
}

/** What a tool or a command asks to change, before the editor stamps it as the session's next set. */
export type UnstampedChangeSet = Omit<ChangeSet, keyof ChangeStamp>;

/** Whether a change set changes nothing: no element, group or canvas change. */
export const isEmptyChangeSet = ({ elements, groups, canvas }: UnstampedChangeSet): boolean =>
  elements.length === 0 && groups.length === 0 && canvas === undefined;

function invertElementChange(change: ElementChange): ElementChange {
  switch (change.type) {
    case 'add':
      return { type: 'remove', element: change.element };
    case 'remove':
      return { type: 'add', element: change.element };
    case 'update':
      return { type: 'update', id: change.id, before: change.after, after: change.before };
  }
}

const invertGroupChange = (change: GroupChange): GroupChange =>
  change.type === 'add'
    ? { type: 'remove', group: change.group }
    : { type: 'add', group: change.group };

/**
 * The change set that undoes `changes`: additions and removals swapped, and `before` and `after`
 * swapped. A complete set inverts into a complete set, so its inverse is always valid where the
 * set has just been applied. The stamp is kept; whoever applies the inverse stamps it anew.
 */
export function invertChangeSet(changes: ChangeSet): ChangeSet {
  const { canvas } = changes;
  return {
    elements: changes.elements.map(invertElementChange),
    groups: changes.groups.map(invertGroupChange),
    ...(canvas === undefined ? {} : { canvas: { before: canvas.after, after: canvas.before } }),
    author: changes.author,
    seq: changes.seq,
  };
}
