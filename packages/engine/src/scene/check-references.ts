import type { GroupRecord } from '../model/document.ts';
import type { Element } from '../model/elements.ts';
import type { ElementId, GroupId } from '../model/ids.ts';
import { fieldPath, itemPath } from '../model/json-check.ts';
import type { ChangeSet, GroupChange } from './change-set.ts';
import type { ChangeError, Plan, SceneState } from './check.ts';
import type { ElementDelta } from './delta.ts';

// The last check of a change set whose changes are each valid: the references that the scene
// will hold must exist (docs/architecture/engine/domain-model.md#invariants-and-limits). Only the
// changed elements and groups are read, through the indexes, never the whole scene, and the path
// of a problem is built only once it is found.

/** The scene as it will be once the set is applied, as far as references go. */
interface After {
  element(id: ElementId): Element | undefined;
  group(id: GroupId): GroupRecord | undefined;
  /** Whether the set adds, removes or updates the element. */
  changes(id: ElementId): boolean;
  readonly removedGroups: ReadonlySet<GroupId>;
}

function afterOf(state: SceneState, plan: Plan): After {
  // Made at the first look-up: a set whose elements refer to nothing and remove nothing needs none.
  let deltas: ReadonlyMap<ElementId, ElementDelta> | undefined;
  const byId = (): ReadonlyMap<ElementId, ElementDelta> =>
    (deltas ??= new Map(plan.elements.map((delta) => [delta.id, delta])));
  const added = new Map(plan.addedGroups.map((group) => [group.id, group]));
  const removed = new Set(plan.removedGroups.map(({ id }) => id));
  return {
    element: (id) => {
      const delta = byId().get(id);
      return delta === undefined ? state.elements.get(id) : delta.after;
    },
    group: (id) => added.get(id) ?? (removed.has(id) ? undefined : state.groups.groups.get(id)),
    changes: (id) => byId().has(id),
    removedGroups: removed,
  };
}

/** Where an added or updated element is in the set: the change's element, or the update's after. */
const heldAt = (delta: ElementDelta, index: number): string =>
  fieldPath(itemPath('elements', index), delta.before === undefined ? 'element' : 'after');

/**
 * An added or updated element's group and attachment targets must exist afterwards. The path of
 * a problem is built once there is one.
 */
function checkHeld(
  after: After,
  { delta, element }: { readonly delta: ElementDelta; readonly element: Element },
  index: number,
  errors: ChangeError[],
): void {
  if (element.group !== undefined && after.group(element.group) === undefined) {
    errors.push({ path: fieldPath(heldAt(delta, index), 'group'), problem: 'unknown-reference' });
  }
  if (element.kind !== 'arrow') {
    return;
  }
  for (const end of ['start', 'end'] as const) {
    const target = element[end]?.target;
    if (target !== undefined && after.element(target) === undefined) {
      errors.push({
        path: fieldPath(fieldPath(heldAt(delta, index), end), 'target'),
        problem: 'unknown-reference',
      });
    }
  }
}

/** Whether following parents from a new group's parent leads back to the group. */
function closesCycle(after: After, id: GroupId, parent: GroupId): boolean {
  const seen = new Set<GroupId>();
  for (
    let group: GroupId | undefined = parent;
    group !== undefined;
    group = after.group(group)?.parent
  ) {
    if (group === id) return true;
    if (seen.has(group)) return false;
    seen.add(group);
  }
  return false;
}

function checkGroup(
  { state, after }: { readonly state: SceneState; readonly after: After },
  change: GroupChange,
  path: string,
  errors: ChangeError[],
): void {
  const { id, parent } = change.group;
  if (change.type === 'remove') {
    const members = [...state.groups.directMembers(id)].some((member) => !after.changes(member));
    const nested = [...state.groups.childGroups(id)].some(
      (child) => !after.removedGroups.has(child),
    );
    if (members || nested) errors.push({ path, problem: 'still-referenced' });
    return;
  }
  const at = fieldPath(fieldPath(path, 'group'), 'parent');
  if (parent !== undefined && after.group(parent) === undefined) {
    errors.push({ path: at, problem: 'unknown-reference' });
  } else if (parent !== undefined && closesCycle(after, id, parent)) {
    errors.push({ path: at, problem: 'group-cycle' });
  }
}

/**
 * Reports a group or attachment target that will not exist, at the element that holds it; a
 * removed element that an unchanged connector still points at, and a removed group that an
 * unchanged element or a group the set keeps still uses, at the removal; and a new group whose
 * parent will not exist or whose parents lead back to it. The plan's element deltas are in the
 * order of the set's element changes.
 */
export function checkSceneReferences(
  state: SceneState,
  changes: ChangeSet,
  plan: Plan,
  errors: ChangeError[],
): void {
  const after = afterOf(state, plan);
  plan.elements.forEach((delta, index) => {
    if (delta.after !== undefined) {
      checkHeld(after, { delta, element: delta.after }, index, errors);
    } else if (
      state.attachments.connectorsOf(delta.id).some((connector) => !after.changes(connector))
    ) {
      errors.push({ path: itemPath('elements', index), problem: 'still-referenced' });
    }
  });
  changes.groups.forEach((change, index) => {
    checkGroup({ state, after }, change, itemPath('groups', index), errors);
  });
}
