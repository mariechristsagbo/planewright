import type { Element } from '../model/elements.ts';
import { jsonEqual } from '../model/json-equal.ts';
import { applyPatch, matchesPatch } from '../model/patch.ts';
import type { ElementPatch } from '../model/patch.ts';
import type { CanvasChange, ChangeSet, ElementChange, GroupChange } from '../scene/change-set.ts';

// Burst merging (docs/architecture/engine/history.md#entries-and-selection): two change sets of
// one burst, the newer applied right after the older, become one set from the older `before` to
// the newer `after` (REQ-T10).

/** Two changes that do not follow each other, or that no single change can express. */
const APART: unique symbol = Symbol('apart');

/** A merged change, null when the two cancel out, or {@link APART}. */
type Merged<T> = T | null | typeof APART;

type Update = Extract<ElementChange, { type: 'update' }>;

const pick = (patch: ElementPatch, keys: readonly string[]): ElementPatch =>
  Object.fromEntries(keys.map((key) => [key, patch[key]]));

/** Two versions of an element are the same if they differ at most in the revision the scene keeps. */
const sameContent = (a: Element, b: Element): boolean =>
  jsonEqual({ ...a, rev: 0 }, { ...b, rev: 0 });

/** Updates follow each other when each field of both holds, in the newer `before`, the older `after`. */
function mergeUpdates(older: Update, newer: Update): Merged<ElementChange> {
  const shared = Object.keys(newer.before).filter((key) => Object.hasOwn(older.after, key));
  if (!shared.every((key) => jsonEqual(older.after[key], newer.before[key]))) {
    return APART;
  }
  const before = { ...newer.before, ...older.before };
  const after = { ...older.after, ...newer.after };
  const keys = Object.keys(before).filter((key) => !jsonEqual(before[key], after[key]));
  return keys.length === 0
    ? null
    : { type: 'update', id: older.id, before: pick(before, keys), after: pick(after, keys) };
}

function addThenUpdate(added: Element, newer: Update): Merged<ElementChange> {
  if (!matchesPatch(added, newer.before)) {
    return APART;
  }
  // The element as the update leaves it, with the revision the scene gives an updated element.
  const element = { ...applyPatch(added, newer.after), rev: added.rev + 1 } as Element;
  return { type: 'add', element };
}

function updateThenRemove(older: Update, removed: Element): Merged<ElementChange> {
  if (!matchesPatch(removed, older.after)) {
    return APART;
  }
  // The element as it was before both, with the revision it had when it was removed.
  const element = { ...applyPatch(removed, older.before), rev: removed.rev } as Element;
  return { type: 'remove', element };
}

function mergeElements(older: ElementChange, newer: ElementChange): Merged<ElementChange> {
  if (older.type === 'update') {
    if (newer.type === 'update') return mergeUpdates(older, newer);
    return newer.type === 'remove' ? updateThenRemove(older, newer.element) : APART;
  }
  if (older.type === 'add' && newer.type === 'update') {
    return addThenUpdate(older.element, newer);
  }
  const cancels =
    older.type === 'add' && newer.type === 'remove' && sameContent(older.element, newer.element);
  return cancels ? null : APART;
}

/** A group record cannot change, so only an addition and a removal of the same one merge: to nothing. */
const mergeGroups = (older: GroupChange, newer: GroupChange): Merged<GroupChange> =>
  older.type !== newer.type && jsonEqual(older.group, newer.group) ? null : APART;

/** Merges two lists of changes by identifier: the older list's order first, then the newer's own. */
function mergeLists<C>(
  older: readonly C[],
  newer: readonly C[],
  idOf: (change: C) => string,
  merge: (older: C, newer: C) => Merged<C>,
): C[] | typeof APART {
  const later = new Map(newer.map((change) => [idOf(change), change]));
  const merged: C[] = [];
  for (const change of older) {
    const next = later.get(idOf(change));
    later.delete(idOf(change));
    const result = next === undefined ? change : merge(change, next);
    if (result === APART) return APART;
    if (result !== null) merged.push(result);
  }
  return [...merged, ...later.values()];
}

function mergeCanvas(
  older: CanvasChange | undefined,
  newer: CanvasChange | undefined,
): { readonly canvas?: CanvasChange } | typeof APART {
  if (older === undefined || newer === undefined) {
    const one = older ?? newer;
    return one === undefined ? {} : { canvas: one };
  }
  if (!jsonEqual(older.after, newer.before)) {
    return APART;
  }
  return jsonEqual(older.before, newer.after)
    ? {}
    : { canvas: { before: older.before, after: newer.after } };
}

const elementIdOf = (change: ElementChange): string =>
  change.type === 'update' ? change.id : change.element.id;

/**
 * One change set equal to `older` followed by `newer`, with the newer stamp: per element, group
 * or canvas, the older `before` and the newer `after`, and nothing for what ends where it began.
 * Undefined when the two do not follow each other, as when another origin changed a field between
 * them, or when no single change can express a pair, such as an element removed and added again;
 * the two then stay apart.
 */
export function mergeChangeSets(older: ChangeSet, newer: ChangeSet): ChangeSet | undefined {
  const elements = mergeLists(older.elements, newer.elements, elementIdOf, mergeElements);
  const groups = mergeLists(older.groups, newer.groups, ({ group }) => group.id, mergeGroups);
  const canvas = mergeCanvas(older.canvas, newer.canvas);
  if (elements === APART || groups === APART || canvas === APART) {
    return undefined;
  }
  return { elements, groups, ...canvas, author: newer.author, seq: newer.seq };
}
