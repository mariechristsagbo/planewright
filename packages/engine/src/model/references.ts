import type { GroupRecord } from './document.ts';
import type { Element } from './elements.ts';
import type { GroupId } from './ids.ts';
import { fieldPath, itemPath } from './json-check.ts';
import type { Issues } from './json-check.ts';

// The cross-references of a document whose fields are all valid (docs/architecture/engine/domain-model.md#groups).

export interface DocumentParts {
  readonly groups: readonly GroupRecord[];
  readonly elements: readonly Element[];
}

/** Each identifier at its first index; a later use of one is a duplicate (REQ-K02). */
function indexById(
  items: readonly { readonly id: string }[],
  base: string,
  issues: Issues,
): Set<string> {
  const ids = new Set<string>();
  items.forEach(({ id }, index) => {
    if (ids.has(id)) {
      issues.push({ path: fieldPath(itemPath(base, index), 'id'), problem: 'duplicate-id' });
    }
    ids.add(id);
  });
  return ids;
}

/** The groups on a cycle of parents, found by following each group's parents once. */
function groupsOnCycles(groups: readonly GroupRecord[]): Set<GroupId> {
  const parentOf = new Map(groups.map(({ id, parent }) => [id, parent]));
  const visited = new Set<GroupId>();
  const onCycle = new Set<GroupId>();
  for (const { id } of groups) {
    const walk: GroupId[] = [];
    let current: GroupId | undefined = id;
    while (current !== undefined && !visited.has(current)) {
      visited.add(current);
      walk.push(current);
      current = parentOf.get(current);
    }
    // The walk ran into itself, so its part from that group onwards is a cycle.
    const start = current === undefined ? -1 : walk.indexOf(current);
    walk.slice(start === -1 ? walk.length : start).forEach((member) => onCycle.add(member));
  }
  return onCycle;
}

function checkGroups(groups: readonly GroupRecord[], groupIds: Set<string>, issues: Issues): void {
  groups.forEach(({ parent }, index) => {
    if (parent !== undefined && !groupIds.has(parent)) {
      issues.push({
        path: fieldPath(itemPath('groups', index), 'parent'),
        problem: 'unknown-reference',
      });
    }
  });
  const onCycle = groupsOnCycles(groups);
  groups.forEach(({ id }, index) => {
    if (onCycle.has(id)) {
      issues.push({ path: fieldPath(itemPath('groups', index), 'parent'), problem: 'group-cycle' });
    }
  });
}

interface Reference {
  readonly path: string;
  readonly id: string;
  /** Whether the identifier names a group or an element. */
  readonly to: 'group' | 'element';
}

/** What an element refers to: its group and its attachments' targets. */
function referencesOf(element: Element, path: string): Reference[] {
  const found: Reference[] =
    element.group === undefined
      ? []
      : [{ path: fieldPath(path, 'group'), id: element.group, to: 'group' }];
  if (element.kind === 'arrow') {
    for (const end of ['start', 'end'] as const) {
      const target = element[end]?.target;
      if (target !== undefined) {
        found.push({ path: fieldPath(fieldPath(path, end), 'target'), id: target, to: 'element' });
      }
    }
  }
  return found;
}

/**
 * Reports duplicate identifiers, unknown parents, cycles of groups, and an element's group or an
 * attachment's target that does not exist.
 */
export function checkReferences({ groups, elements }: DocumentParts, issues: Issues): void {
  const elementIds = indexById(elements, 'elements', issues);
  const groupIds = indexById(groups, 'groups', issues);
  checkGroups(groups, groupIds, issues);
  elements.forEach((element, index) => {
    for (const { path, id, to } of referencesOf(element, itemPath('elements', index))) {
      if (!(to === 'group' ? groupIds : elementIds).has(id)) {
        issues.push({ path, problem: 'unknown-reference' });
      }
    }
  });
}
