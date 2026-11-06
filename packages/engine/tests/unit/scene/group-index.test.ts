import { describe, expect, it } from 'vitest';

import { createRandom } from '../../../src/math/random.ts';
import type { Random } from '../../../src/math/random.ts';
import type { GroupRecord } from '../../../src/model/document.ts';
import type { Element } from '../../../src/model/elements.ts';
import type { ElementId, GroupId } from '../../../src/model/ids.ts';
import type { ElementDelta } from '../../../src/scene/delta.ts';
import { createGroupIndex } from '../../../src/scene/group-index.ts';
import type { GroupIndex } from '../../../src/scene/group-index.ts';
import { checkProperty } from '../../support/property.ts';
import {
  anyGroups,
  anySceneElement,
  anyStep,
  bruteMembers,
  bruteOutermost,
  sceneElementId,
  sceneGroupId,
  sortedIds,
} from '../../support/scenes.ts';

const g = sceneGroupId;
const noRefs = { elements: [], groups: [] };

/** Groups 0 and 3 are roots; 1 and 2 are nested in 0, and 4 in 2. */
const FOREST: readonly GroupRecord[] = [
  { id: g(0) },
  { id: g(1), parent: g(0) },
  { id: g(2), parent: g(0) },
  { id: g(3) },
  { id: g(4), parent: g(2) },
];

/** A scene element in the given group, or in none. */
function member(index: number, group?: GroupId): Element {
  // With no groups to pick from, the generator puts the element in none.
  const element = anySceneElement(createRandom(index), sceneElementId(index), noRefs);
  return group === undefined ? element : { ...element, group };
}

const added = (...elements: Element[]): ElementDelta[] =>
  elements.map((after) => ({ id: after.id, before: undefined, after }));

function forest(): GroupIndex {
  const index = createGroupIndex();
  index.addGroups(FOREST);
  return index;
}

/** A forest of random groups and random steps over elements in them. */
function anyRun(random: Random) {
  const groups = anyGroups(random, 6);
  const elements = new Map<ElementId, Element>();
  let next = 0;
  const fresh = () => sceneElementId((next += 1));
  const refs = () => ({ elements: [], groups: groups.map(({ id }) => id) });
  const steps = Array.from({ length: 10 }, () => anyStep(random, elements, refs, fresh));
  return { groups, steps };
}

describe('the group index', () => {
  it('holds the group records it is given until they are removed', () => {
    const index = forest();
    expect([...index.groups.keys()]).toStrictEqual(FOREST.map(({ id }) => id));
    expect(sortedIds(index.childGroups(g(0)))).toStrictEqual([g(1), g(2)]);
    index.removeGroups(FOREST.slice(3).reverse());
    expect([...index.groups.keys()]).toStrictEqual([g(0), g(1), g(2)]);
    expect([...index.childGroups(g(2))]).toStrictEqual([]);
    expect([...index.childGroups(g(9))]).toStrictEqual([]);
  });

  it('finds the outermost group by following parents from the innermost group', () => {
    const index = forest();
    const [deep, shallow, alone] = [member(1, g(4)), member(2, g(3)), member(3)];
    index.update(added(deep, shallow, alone));
    expect(index.outermostGroup(deep.id)).toBe(g(0));
    expect(index.outermostGroup(shallow.id)).toBe(g(3));
    expect(index.outermostGroup(alone.id)).toBeUndefined();
    expect(index.outermostGroup(sceneElementId(99))).toBeUndefined();
  });

  it('lists the members of a group and of every group nested in it', () => {
    const index = forest();
    const elements = [
      member(1, g(4)),
      member(2, g(1)),
      member(3, g(0)),
      member(4, g(3)),
      member(5),
    ];
    index.update(added(...elements));
    expect(sortedIds(index.members(g(0)))).toStrictEqual([1, 2, 3].map(sceneElementId));
    expect(index.members(g(2))).toStrictEqual([sceneElementId(1)]);
    expect([...index.directMembers(g(0))]).toStrictEqual([sceneElementId(3)]);
    expect(index.members(g(9))).toStrictEqual([]);
    expect([...index.directMembers(g(9))]).toStrictEqual([]);
  });

  it('follows an element that changes group or leaves the scene', () => {
    const index = forest();
    const element = member(1, g(1));
    const moved = { ...element, group: g(3) };
    index.update(added(element));
    index.update([{ id: element.id, before: element, after: moved }]);
    expect(index.members(g(0))).toStrictEqual([]);
    expect(index.outermostGroup(element.id)).toBe(g(3));
    index.update([{ id: element.id, before: moved, after: member(1) }]);
    expect(index.members(g(3))).toStrictEqual([]);
    expect(index.outermostGroup(element.id)).toBeUndefined();
    index.update([{ id: element.id, before: member(1), after: undefined }]);
    expect(index.outermostGroup(element.id)).toBeUndefined();
  });

  it('agrees with following every element’s parents over random scenes', () => {
    checkProperty({ seed: 3401, runs: 60 }, anyRun, ({ groups, steps }) => {
      const index = createGroupIndex();
      index.addGroups(groups);
      const records = new Map(groups.map((group) => [group.id, group]));
      const elements = new Map<ElementId, Element>();
      for (const step of steps) {
        index.update(step);
        for (const { id, after } of step) {
          if (after === undefined) elements.delete(id);
          else elements.set(id, after);
        }
        for (const element of elements.values()) {
          expect(index.outermostGroup(element.id)).toBe(bruteOutermost(records, element));
        }
        for (const { id } of groups) {
          expect(sortedIds(index.members(id))).toStrictEqual(
            bruteMembers(elements.values(), records, id),
          );
        }
      }
    });
  });
});
