import type { CodecProblem } from '../model/codec.ts';
import type { CanvasState, GroupRecord } from '../model/document.ts';
import { checkElement } from '../model/element-checks.ts';
import type { Element } from '../model/elements.ts';
import { color, groupId } from '../model/field-checks.ts';
import type { ElementId } from '../model/ids.ts';
import { INVALID, fieldPath, itemPath, record } from '../model/json-check.ts';
import type { Invalid, Issues } from '../model/json-check.ts';
import { jsonEqual } from '../model/json-equal.ts';
import { LIMITS } from '../model/limits.ts';
import { matchesPatch, patchElement } from '../model/patch.ts';
import type { ElementPatch } from '../model/patch.ts';
import type { AttachmentIndex } from './attachment-index.ts';
import type {
  CanvasChange,
  ChangeOrigin,
  ChangeSet,
  ElementChange,
  GroupChange,
} from './change-set.ts';
import { checkSceneReferences } from './check-references.ts';
import type { ElementDelta } from './delta.ts';
import type { GroupIndex } from './group-index.ts';

// Step 1 of applying a change set (docs/architecture/engine/scene-and-viewport.md#change-sets):
// every change is checked against the current state, and one failure refuses the whole set.

/**
 * Why a change was refused: a codec problem with the value it writes, or one of these. `exists`:
 * an added identifier is taken; `not-found`: what a change removes or updates is not there;
 * `stale`: a local or history change's `before` is not the current value; `repeated`: two changes
 * of the set name one identifier; `still-referenced`: a removed element or group is still used.
 */
export type ChangeProblem =
  CodecProblem | 'exists' | 'not-found' | 'stale' | 'repeated' | 'still-referenced';

export interface ChangeError {
  /** Where in the change set, for example "elements[2].after.x"; '' is the set itself. */
  readonly path: string;
  readonly problem: ChangeProblem;
}

/** What a change set is checked against: the scene as it is. */
export interface SceneState {
  readonly elements: ReadonlyMap<ElementId, Element>;
  readonly groups: GroupIndex;
  readonly attachments: AttachmentIndex;
  readonly canvas: CanvasState;
}

/** What applying a valid change set does, in the order of its element changes. */
export interface Plan {
  readonly elements: readonly ElementDelta[];
  readonly addedGroups: readonly GroupRecord[];
  readonly removedGroups: readonly GroupRecord[];
  readonly canvas: CanvasState | undefined;
}

export type Planned =
  | { readonly ok: true; readonly plan: Plan }
  | { readonly ok: false; readonly errors: readonly ChangeError[] };

interface Context {
  readonly state: SceneState;
  /** Whether `before` values must match: for the `local` and `history` origins. */
  readonly strict: boolean;
  readonly errors: ChangeError[];
}

const groupRecord = record<GroupRecord>({ id: groupId, parent: { optional: groupId } });
const canvasState = record<CanvasState>({ background: color });

/** Runs a model check, keeping its errors with the others. */
function checked<T>(context: Context, check: (issues: Issues) => T): T {
  const issues: Issues = [];
  const result = check(issues);
  context.errors.push(...issues);
  return result;
}

function refuse(context: Context, path: string, problem: ChangeProblem): Invalid {
  context.errors.push({ path, problem });
  return INVALID;
}

/** Two versions of an element are the same if they differ at most in the revision the scene keeps. */
const sameContent = (a: Element, b: Element): boolean =>
  jsonEqual({ ...a, rev: 0 }, { ...b, rev: 0 });

/** Each field of one side of an update is also on the other, so the update inverts exactly. */
function checkSameFields(
  context: Context,
  path: string,
  before: ElementPatch,
  after: ElementPatch,
): void {
  for (const [side, other, own] of [
    ['before', after, before],
    ['after', before, after],
  ] as const) {
    for (const key of Object.keys(other).filter((field) => !Object.hasOwn(own, field))) {
      refuse(context, fieldPath(fieldPath(path, side), key), 'missing');
    }
  }
}

function planAdd(context: Context, element: Element, path: string): ElementDelta | Invalid {
  if (context.state.elements.has(element.id)) {
    return refuse(context, fieldPath(fieldPath(path, 'element'), 'id'), 'exists');
  }
  const after = checked(context, (issues) =>
    checkElement(element, fieldPath(path, 'element'), issues),
  );
  return after === INVALID ? INVALID : { id: element.id, before: undefined, after };
}

function planRemove(context: Context, element: Element, path: string): ElementDelta | Invalid {
  const before = context.state.elements.get(element.id);
  if (before === undefined) {
    return refuse(context, fieldPath(fieldPath(path, 'element'), 'id'), 'not-found');
  }
  if (context.strict && !sameContent(before, element)) {
    return refuse(context, fieldPath(path, 'element'), 'stale');
  }
  return { id: element.id, before, after: undefined };
}

function planUpdate(
  context: Context,
  change: Extract<ElementChange, { type: 'update' }>,
  path: string,
): ElementDelta | Invalid {
  const before = context.state.elements.get(change.id);
  if (before === undefined) {
    return refuse(context, fieldPath(path, 'id'), 'not-found');
  }
  const count = context.errors.length;
  checkSameFields(context, path, change.before, change.after);
  if (context.strict && !matchesPatch(before, change.before)) {
    refuse(context, fieldPath(path, 'before'), 'stale');
  }
  const after = checked(context, (issues) =>
    patchElement(before, change.after, fieldPath(path, 'after'), issues),
  );
  if (after === INVALID || context.errors.length > count) {
    return INVALID;
  }
  return { id: change.id, before, after: { ...after, rev: before.rev + 1 } };
}

const elementIdOf = (change: ElementChange): ElementId =>
  change.type === 'update' ? change.id : change.element.id;

function planElement(
  context: Context,
  change: ElementChange,
  path: string,
): ElementDelta | Invalid {
  switch (change.type) {
    case 'add':
      return planAdd(context, change.element, path);
    case 'remove':
      return planRemove(context, change.element, path);
    case 'update':
      return planUpdate(context, change, path);
  }
}

/** Refuses, at its second use, an identifier that two changes of a list name. */
function checkRepeated(context: Context, ids: readonly string[], base: string): void {
  const seen = new Set<string>();
  ids.forEach((id, index) => {
    if (seen.has(id)) refuse(context, itemPath(base, index), 'repeated');
    seen.add(id);
  });
}

function planElements(context: Context, changes: readonly ElementChange[]): ElementDelta[] {
  checkRepeated(context, changes.map(elementIdOf), 'elements');
  const deltas = changes.map((change, index) =>
    planElement(context, change, itemPath('elements', index)),
  );
  const planned = deltas.filter((delta) => delta !== INVALID);
  const added = planned.filter(({ before }) => before === undefined).length;
  const removed = planned.filter(({ after }) => after === undefined).length;
  if (context.state.elements.size + added - removed > LIMITS.elements) {
    refuse(context, 'elements', 'too-many');
  }
  return planned;
}

function planGroup(context: Context, change: GroupChange, path: string): GroupRecord | Invalid {
  const at = fieldPath(path, 'group');
  const group = checked(context, (issues) => groupRecord(change.group, at, issues));
  if (group === INVALID) {
    return INVALID;
  }
  const current = context.state.groups.groups.get(group.id);
  if (change.type === 'add') {
    return current === undefined ? group : refuse(context, fieldPath(at, 'id'), 'exists');
  }
  if (current === undefined) {
    return refuse(context, fieldPath(at, 'id'), 'not-found');
  }
  return context.strict && !jsonEqual(current, group) ? refuse(context, at, 'stale') : current;
}

function planGroups(
  context: Context,
  changes: readonly GroupChange[],
): Pick<Plan, 'addedGroups' | 'removedGroups'> {
  checkRepeated(
    context,
    changes.map(({ group }) => group.id),
    'groups',
  );
  const addedGroups: GroupRecord[] = [];
  const removedGroups: GroupRecord[] = [];
  changes.forEach((change, index) => {
    const group = planGroup(context, change, itemPath('groups', index));
    if (group !== INVALID) (change.type === 'add' ? addedGroups : removedGroups).push(group);
  });
  return { addedGroups, removedGroups };
}

function planCanvas(context: Context, change: CanvasChange | undefined): CanvasState | undefined {
  if (change === undefined) {
    return undefined;
  }
  if (context.strict && !jsonEqual(context.state.canvas, change.before)) {
    refuse(context, 'canvas.before', 'stale');
  }
  const after = checked(context, (issues) => canvasState(change.after, 'canvas.after', issues));
  return after === INVALID ? undefined : after;
}

/**
 * Checks a change set against the scene, and returns what applying it does or every reason to
 * refuse it. Additions must be new and valid; removals and updates must find their element or
 * group, and for the `local` and `history` origins match its current value; an update must leave
 * a valid element; and once each change is valid alone, the references that the set leaves must
 * all exist.
 */
export function planChangeSet(
  state: SceneState,
  changes: ChangeSet,
  origin: ChangeOrigin,
): Planned {
  const context: Context = {
    state,
    strict: origin === 'local' || origin === 'history',
    errors: [],
  };
  const elements = planElements(context, changes.elements);
  const plan: Plan = {
    elements,
    ...planGroups(context, changes.groups),
    canvas: planCanvas(context, changes.canvas),
  };
  if (context.errors.length === 0) {
    checkSceneReferences(state, changes, plan, context.errors);
  }
  return context.errors.length === 0 ? { ok: true, plan } : { ok: false, errors: context.errors };
}
