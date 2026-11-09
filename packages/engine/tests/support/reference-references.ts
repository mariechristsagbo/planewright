import type { GroupRecord } from '../../src/model/document.ts';
import type { Element } from '../../src/model/elements.ts';
import type { ElementId, GroupId } from '../../src/model/ids.ts';
import { fieldPath, itemPath } from '../../src/model/json-check.ts';
import type { ChangeSet, GroupChange } from '../../src/scene/change-set.ts';
import type { ChangeError, Plan, SceneState } from '../../src/scene/check.ts';

// The reference check of the planner as it was at 8a666f4 (scene/check-references.ts), kept
// unchanged as part of the oracle in reference-plan.ts. Only its imports and its name differ.

/** The scene as it will be once the set is applied, as far as references go. */
interface After {
  element(id: ElementId): Element | undefined;
  group(id: GroupId): GroupRecord | undefined;
  readonly changed: ReadonlySet<ElementId>;
  readonly removedGroups: ReadonlySet<GroupId>;
}

function afterOf(state: SceneState, plan: Plan): After {
  const deltas = new Map(plan.elements.map((delta) => [delta.id, delta]));
  const added = new Map(plan.addedGroups.map((group) => [group.id, group]));
  const removed = new Set(plan.removedGroups.map(({ id }) => id));
  return {
    element: (id) => {
      const delta = deltas.get(id);
      return delta === undefined ? state.elements.get(id) : delta.after;
    },
    group: (id) => added.get(id) ?? (removed.has(id) ? undefined : state.groups.groups.get(id)),
    changed: new Set(deltas.keys()),
    removedGroups: removed,
  };
}

/** An added or updated element's group and attachment targets must exist afterwards. */
function checkHeld(after: After, element: Element, base: string, errors: ChangeError[]): void {
  if (element.group !== undefined && after.group(element.group) === undefined) {
    errors.push({ path: fieldPath(base, 'group'), problem: 'unknown-reference' });
  }
  if (element.kind !== 'arrow') {
    return;
  }
  for (const end of ['start', 'end'] as const) {
    const target = element[end]?.target;
    if (target !== undefined && after.element(target) === undefined) {
      errors.push({
        path: fieldPath(fieldPath(base, end), 'target'),
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
    const members = [...state.groups.directMembers(id)].some(
      (member) => !after.changed.has(member),
    );
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
export function referenceSceneReferences(
  state: SceneState,
  changes: ChangeSet,
  plan: Plan,
  errors: ChangeError[],
): void {
  const after = afterOf(state, plan);
  plan.elements.forEach((delta, index) => {
    const path = itemPath('elements', index);
    if (delta.after !== undefined) {
      checkHeld(
        after,
        delta.after,
        fieldPath(path, delta.before === undefined ? 'element' : 'after'),
        errors,
      );
    } else if (
      state.attachments.connectorsOf(delta.id).some((connector) => !after.changed.has(connector))
    ) {
      errors.push({ path, problem: 'still-referenced' });
    }
  });
  changes.groups.forEach((change, index) => {
    checkGroup({ state, after }, change, itemPath('groups', index), errors);
  });
}
