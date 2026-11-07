import { jsonEqual } from '../model/json-equal.ts';
import { patchValue } from '../model/patch.ts';
import type { ElementPatch } from '../model/patch.ts';
import type { ChangeSet, ElementChange, GroupChange } from '../scene/change-set.ts';
import type { SceneReader } from '../scene/store.ts';

// Conflict-safe undo and redo (docs/architecture/engine/history.md#conflict-safe-undo): a change
// applies only where the document still holds what the entry left there (REQ-K03).

type Update = Extract<ElementChange, { type: 'update' }>;

const pick = (patch: ElementPatch, keys: readonly string[]): ElementPatch =>
  Object.fromEntries(keys.map((key) => [key, patch[key]]));

/** The fields of an update that still hold its `before`; nothing when none does or it is gone. */
function updatePart(change: Update, reader: SceneReader): ElementChange | undefined {
  const current = reader.get(change.id);
  if (current === undefined) {
    return undefined;
  }
  const keys = Object.keys(change.before).filter((key) =>
    jsonEqual(patchValue(current, key), change.before[key]),
  );
  return keys.length === 0
    ? undefined
    : {
        type: 'update',
        id: change.id,
        before: pick(change.before, keys),
        after: pick(change.after, keys),
      };
}

function elementPart(change: ElementChange, reader: SceneReader): ElementChange | undefined {
  switch (change.type) {
    case 'add':
      return reader.get(change.element.id) === undefined ? change : undefined;
    case 'remove': {
      const current = reader.get(change.element.id);
      return current === undefined ? undefined : { type: 'remove', element: current };
    }
    case 'update':
      return updatePart(change, reader);
  }
}

function groupPart(change: GroupChange, reader: SceneReader): GroupChange | undefined {
  const current = reader.group(change.group.id);
  if (change.type === 'add') {
    return current === undefined ? change : undefined;
  }
  return current === undefined ? undefined : { type: 'remove', group: current };
}

/**
 * The part of a change set that still applies to the document as it is, with the same stamp: each
 * updated field whose current value equals its `before`; each element or group addition whose
 * identifier is free; each removal of an element or group that still exists, which removes it as
 * it is now; and the canvas change while the canvas holds its `before`. Undo passes an entry's
 * inverse and redo the entry itself; with one user every condition holds, so the part is the
 * whole set. Whether the part is valid as a whole is the store's check.
 */
export function applicablePart(changes: ChangeSet, reader: SceneReader): ChangeSet {
  const { canvas } = changes;
  return {
    elements: changes.elements
      .map((change) => elementPart(change, reader))
      .filter((change) => change !== undefined),
    groups: changes.groups
      .map((change) => groupPart(change, reader))
      .filter((change) => change !== undefined),
    ...(canvas === undefined || !jsonEqual(reader.canvas, canvas.before) ? {} : { canvas }),
    author: changes.author,
    seq: changes.seq,
  };
}
