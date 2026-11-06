import type { CanvasState, GroupRecord } from '../model/document.ts';
import type { Element } from '../model/elements.ts';
import type { ElementId, GroupId } from '../model/ids.ts';
import { jsonEqual } from '../model/json-equal.ts';
import { UNPATCHED_FIELDS, applyPatch, patchValue } from '../model/patch.ts';
import type { ElementPatch } from '../model/patch.ts';
import type { ChangeSet, ElementChange, GroupChange } from './change-set.ts';
import type { SceneReader } from './store.ts';

// What a transaction remembers of its previews (docs/architecture/engine/scene-and-viewport.md#transient-previews):
// the first value of every field it touched, from which the net change set is computed.

/**
 * How a transaction touched an element: a whole element that it added or removed, with the
 * element as it was before (absent for an addition), or some of its fields, with each one's
 * first `before` value.
 */
type Touch =
  | { readonly whole: true; readonly start: Element | undefined }
  | { readonly whole: false; readonly firsts: ReadonlyMap<string, unknown> };

export interface Touches {
  readonly elements: Map<ElementId, Touch>;
  /** Each touched group as it was before, or undefined for one the transaction added. */
  readonly groups: Map<GroupId, GroupRecord | undefined>;
  /** The canvas before the first preview that changed it. */
  canvas: CanvasState | undefined;
}

/** What one preview adds to the touches, worked out before the preview is applied. */
export interface Touched {
  readonly elements: readonly (readonly [ElementId, Touch])[];
  readonly groups: readonly (readonly [GroupId, GroupRecord | undefined])[];
  readonly canvas: CanvasState | undefined;
}

export const noTouches = (): Touches => ({
  elements: new Map(),
  groups: new Map(),
  canvas: undefined,
});

function refuseOtherForm(what: string, id: string): never {
  throw new RangeError(
    `A transaction cannot add the ${what} ${id} again in another form than the one it removed.`,
  );
}

/** A whole touch stays as it is; re-adding its element under another kind is refused. */
function keepWhole(touch: Extract<Touch, { whole: true }>, change: ElementChange): Touch {
  if (
    change.type === 'add' &&
    touch.start !== undefined &&
    touch.start.kind !== change.element.kind
  ) {
    refuseOtherForm('element', change.element.id);
  }
  return touch;
}

/** The first `before` of each field, kept from the earliest preview that touched it. */
function touchFields(
  firsts: ReadonlyMap<string, unknown> | undefined,
  before: ElementPatch,
): Touch {
  const kept = new Map(firsts);
  for (const [key, value] of Object.entries(before)) {
    if (!kept.has(key)) kept.set(key, value);
  }
  return { whole: false, firsts: kept };
}

function touchElement(
  touch: Touch | undefined,
  change: ElementChange,
  current: Element | undefined,
): Touch {
  if (touch?.whole === true) {
    return keepWhole(touch, change);
  }
  if (change.type === 'update') {
    return touchFields(touch?.firsts, change.before);
  }
  if (change.type === 'add' || current === undefined) {
    return { whole: true, start: undefined };
  }
  // A removal: the element as it was, with the fields that earlier previews changed put back;
  // it keeps the revision it has now, which only grows.
  const firsts = Object.fromEntries(touch?.firsts ?? []);
  return { whole: true, start: { ...applyPatch(current, firsts), rev: current.rev } as Element };
}

function touchGroup(touches: Touches, change: GroupChange, reader: SceneReader) {
  const { id } = change.group;
  if (!touches.groups.has(id)) {
    return [id, change.type === 'add' ? undefined : reader.group(id)] as const;
  }
  const start = touches.groups.get(id);
  if (change.type === 'add' && start !== undefined && !jsonEqual(start, change.group)) {
    refuseOtherForm('group', id);
  }
  return [id, start] as const;
}

const elementIdOf = (change: ElementChange): ElementId =>
  change.type === 'update' ? change.id : change.element.id;

/** What a preview adds to the touches; it throws, before anything changes, for a form it refuses. */
export function touchedBy(touches: Touches, reader: SceneReader, changes: ChangeSet): Touched {
  return {
    elements: changes.elements.map((change) => {
      const id = elementIdOf(change);
      return [id, touchElement(touches.elements.get(id), change, reader.get(id))] as const;
    }),
    groups: changes.groups.map((change) => touchGroup(touches, change, reader)),
    canvas: touches.canvas ?? (changes.canvas === undefined ? undefined : reader.canvas),
  };
}

/** Keeps what an applied preview touched. */
export function remember(touches: Touches, touched: Touched): void {
  for (const [id, touch] of touched.elements) touches.elements.set(id, touch);
  for (const [id, start] of touched.groups) touches.groups.set(id, start);
  touches.canvas = touched.canvas;
}

/** An update of the given fields from `start` to `end`, or nothing when every one is unchanged. */
function update(
  id: ElementId,
  keys: Iterable<string>,
  startOf: (key: string) => unknown,
  end: Element,
): ElementChange | undefined {
  const changed = [...new Set(keys)].filter(
    (key) => !jsonEqual(startOf(key), patchValue(end, key)),
  );
  if (changed.length === 0) {
    return undefined;
  }
  const before = Object.fromEntries(changed.map((key) => [key, startOf(key)]));
  return {
    type: 'update',
    id,
    before,
    after: Object.fromEntries(changed.map((key) => [key, patchValue(end, key)])),
  };
}

const patchable = (element: Element): string[] =>
  Object.keys(element).filter((key) => !(UNPATCHED_FIELDS as readonly string[]).includes(key));

function elementNet(
  id: ElementId,
  touch: Touch,
  end: Element | undefined,
): ElementChange | undefined {
  if (!touch.whole) {
    // Another origin may have removed the element since: nothing of it is left to commit.
    return end === undefined
      ? undefined
      : update(id, touch.firsts.keys(), (key) => touch.firsts.get(key), end);
  }
  const { start } = touch;
  if (start === undefined || end === undefined) {
    if (end !== undefined) return { type: 'add', element: end };
    return start === undefined ? undefined : { type: 'remove', element: start };
  }
  return update(id, [...patchable(start), ...patchable(end)], (key) => patchValue(start, key), end);
}

function groupNet(
  start: GroupRecord | undefined,
  end: GroupRecord | undefined,
): GroupChange | undefined {
  if (end !== undefined) {
    return start === undefined ? { type: 'add', group: end } : undefined;
  }
  return start === undefined ? undefined : { type: 'remove', group: start };
}

/**
 * The net change set of a transaction's previews: per touched field, from its first `before` to
 * its current value, and per added or removed element or group, from its state at the first touch
 * to the current one. What ended where it began drops out.
 */
export function netChanges(
  touches: Touches,
  reader: SceneReader,
): Omit<ChangeSet, 'author' | 'seq'> {
  const elements = [...touches.elements].map(([id, touch]) =>
    elementNet(id, touch, reader.get(id)),
  );
  const groups = [...touches.groups].map(([id, start]) => groupNet(start, reader.group(id)));
  const { canvas } = touches;
  return {
    elements: elements.filter((change) => change !== undefined),
    groups: groups.filter((change) => change !== undefined),
    ...(canvas === undefined || jsonEqual(canvas, reader.canvas)
      ? {}
      : { canvas: { before: canvas, after: reader.canvas } }),
  };
}
