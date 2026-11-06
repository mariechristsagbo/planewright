import type { GroupRecord } from '../model/document.ts';
import type { ElementId, GroupId } from '../model/ids.ts';
import type { ElementDelta } from './delta.ts';

/**
 * The scene's groups (docs/architecture/engine/scene-and-viewport.md#the-scene-graph): the group
 * records, the elements whose innermost group each one is, and the groups nested in each one.
 */
export interface GroupIndex {
  readonly groups: ReadonlyMap<GroupId, GroupRecord>;
  /** The group reached by following parents from the element's innermost group. */
  outermostGroup(id: ElementId): GroupId | undefined;
  /** The elements in the group or in any group nested in it, in no particular order. */
  members(group: GroupId): ElementId[];
  /** The elements whose innermost group this is. */
  directMembers(group: GroupId): ReadonlySet<ElementId>;
  /** The groups whose parent this is. */
  childGroups(group: GroupId): ReadonlySet<GroupId>;
  addGroups(groups: readonly GroupRecord[]): void;
  update(deltas: readonly ElementDelta[]): void;
  removeGroups(groups: readonly GroupRecord[]): void;
}

const NONE: ReadonlySet<never> = new Set();

/** Adds or removes a value in the set kept under `key`, dropping a set that empties. */
function file<K, V>(sets: Map<K, Set<V>>, key: K, value: V, present: boolean): void {
  const set = sets.get(key) ?? new Set<V>();
  if (present) {
    set.add(value);
    sets.set(key, set);
  } else {
    set.delete(value);
    if (set.size === 0) sets.delete(key);
  }
}

/**
 * A group's parent never changes while it exists, and a change set may remove a group only once
 * nothing is in it, so a membership changes only when an element's own `group` does. Membership of
 * nested groups is found by walking the forest when asked.
 */
export function createGroupIndex(): GroupIndex {
  const groups = new Map<GroupId, GroupRecord>();
  const direct = new Map<GroupId, Set<ElementId>>();
  const children = new Map<GroupId, Set<GroupId>>();
  const groupOf = new Map<ElementId, GroupId>();
  return {
    groups,
    outermostGroup(id) {
      let group = groupOf.get(id);
      for (let parent = group; parent !== undefined; parent = groups.get(parent)?.parent) {
        group = parent;
      }
      return group;
    },
    members(group) {
      const found: ElementId[] = [];
      const stack = [group];
      for (let next = stack.pop(); next !== undefined; next = stack.pop()) {
        found.push(...(direct.get(next) ?? NONE));
        stack.push(...(children.get(next) ?? NONE));
      }
      return found;
    },
    directMembers: (group) => direct.get(group) ?? NONE,
    childGroups: (group) => children.get(group) ?? NONE,
    addGroups(records) {
      for (const record of records) {
        groups.set(record.id, record);
        if (record.parent !== undefined) file(children, record.parent, record.id, true);
      }
    },
    update(deltas) {
      for (const { id, before, after } of deltas) {
        if (before?.group !== undefined) file(direct, before.group, id, false);
        if (after?.group === undefined) groupOf.delete(id);
        else {
          file(direct, after.group, id, true);
          groupOf.set(id, after.group);
        }
      }
    },
    removeGroups(records) {
      for (const record of records) {
        groups.delete(record.id);
        if (record.parent !== undefined) file(children, record.parent, record.id, false);
      }
    },
  };
}
