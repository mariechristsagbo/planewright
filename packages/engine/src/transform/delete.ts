import type { GroupRecord } from '../model/document.ts';
import type { Element } from '../model/elements.ts';
import type { ElementId, GroupId } from '../model/ids.ts';
import type { ElementChange, UnstampedChangeSet } from '../scene/change-set.ts';
import type { SceneReader } from '../scene/store.ts';

// Delete (docs/architecture/engine/interaction.md#transforms, REQ-T09): the change set is complete,
// so it also drops the attachments and empty groups that depended on what it removes.

const ENDS = ['start', 'end'] as const;

/** A connector's update that drops its ends attached to removed elements, if any is. */
function detached(connector: Element, removed: ReadonlySet<ElementId>): ElementChange[] {
  if (connector.kind !== 'arrow' || removed.has(connector.id)) return [];
  const ends = ENDS.filter((end) => {
    const target = connector[end]?.target;
    return target !== undefined && removed.has(target);
  });
  if (ends.length === 0) return [];
  const before = Object.fromEntries(ends.map((end) => [end, connector[end]]));
  const after = Object.fromEntries(ends.map((end) => [end, null]));
  return [{ type: 'update', id: connector.id, before, after }];
}

/** The groups, from each removed element's own up through its parents, that it leaves empty. */
function emptiedGroups(
  scene: SceneReader,
  elements: readonly Element[],
  removed: ReadonlySet<ElementId>,
): GroupRecord[] {
  const emptied = new Map<GroupId, GroupRecord>();
  for (const element of elements) {
    for (
      let id = element.group;
      id !== undefined && !emptied.has(id);
      id = scene.group(id)?.parent
    ) {
      const group = scene.group(id);
      if (group === undefined || !scene.members(id).every((member) => removed.has(member))) break;
      emptied.set(id, group);
    }
  }
  return [...emptied.values()];
}

/** The change set that removes the elements that the scene holds, with what depended on them. */
export function deletionOf(scene: SceneReader, ids: readonly ElementId[]): UnstampedChangeSet {
  const elements = ids.map((id) => scene.get(id)).filter((element) => element !== undefined);
  const removed = new Set(elements.map(({ id }) => id));
  const connectors = [...new Set(elements.flatMap(({ id }) => scene.connectorsOf(id)))]
    .map((id) => scene.get(id))
    .filter((element) => element !== undefined);
  return {
    elements: [
      ...elements.map((element): ElementChange => ({ type: 'remove', element })),
      ...connectors.flatMap((connector) => detached(connector, removed)),
    ],
    groups: emptiedGroups(scene, elements, removed).map((group) => ({ type: 'remove', group })),
  };
}
