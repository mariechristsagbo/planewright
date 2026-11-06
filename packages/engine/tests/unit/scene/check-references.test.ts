import { describe, expect, it } from 'vitest';

import type { ArrowElement, Element } from '../../../src/model/elements.ts';
import type { ElementId, GroupId } from '../../../src/model/ids.ts';
import type { ChangeSet, ElementChange, GroupChange } from '../../../src/scene/change-set.ts';
import { planChangeSet } from '../../../src/scene/check.ts';
import { elementId, fixtureDocument, groupId } from '../../support/fixtures.ts';
import { changeSet, stateOf } from '../../support/scene-state.ts';

// The fixture: rectangle 0 is in group 0, ellipse 1 in group 1 (whose parent is group 0), and
// arrow 6 runs from rectangle 0 to ellipse 1.

const e = (index: number) => elementId(index) as ElementId;
const g = (index: number) => groupId(index) as GroupId;

const fixture = (index: number): Element => {
  const found = fixtureDocument().elements.get(e(index));
  if (found === undefined) throw new Error(`The fixture has no element ${String(index)}.`);
  return found;
};

/** The fixture's arrow, from rectangle 0 to ellipse 1. */
function fixtureArrow(): ArrowElement {
  const found = fixture(6);
  if (found.kind !== 'arrow') throw new Error('The fixture element 6 is an arrow.');
  return found;
}

const errorsOf = (changes: ChangeSet) => {
  const result = planChangeSet(stateOf(fixtureDocument()), changes, 'local');
  return result.ok ? [] : result.errors;
};

const remove = (index: number): ElementChange => ({ type: 'remove', element: fixture(index) });
const regroup = (index: number, from: GroupId, to: GroupId | null): ElementChange => ({
  type: 'update',
  id: e(index),
  before: { group: from },
  after: { group: to },
});
const addGroup = (id: GroupId, parent?: GroupId): GroupChange => ({
  type: 'add',
  group: parent === undefined ? { id } : { id, parent },
});
const removeGroup = (index: number): GroupChange => ({
  type: 'remove',
  group: fixtureDocument().groups.get(g(index)) ?? { id: g(index) },
});

describe('the cross-references of a change set', () => {
  it('accepts references to groups and targets that the set adds', () => {
    const arrow = {
      ...fixture(6),
      id: e(20),
      start: { target: e(21), anchor: { x: 0, y: 0 } },
    } as Element;
    const target = { ...fixture(2), id: e(21), group: g(5) };
    expect(
      errorsOf(
        changeSet(
          [
            { type: 'add', element: arrow },
            { type: 'add', element: target },
          ],
          [addGroup(g(5), g(1))],
        ),
      ),
    ).toStrictEqual([]);
  });

  it('refuses a group or a target that will not exist', () => {
    const arrow = {
      ...fixture(6),
      id: e(20),
      end: { target: e(30), anchor: { x: 0, y: 0 } },
    } as Element;
    expect(
      errorsOf(
        changeSet([
          { type: 'add', element: { ...fixture(2), id: e(21), group: g(7) } },
          { type: 'add', element: arrow },
          regroup(1, g(1), g(8)),
          {
            type: 'update',
            id: e(6),
            before: { end: fixtureArrow().end ?? null },
            after: { end: { target: e(31), anchor: { x: 0, y: 0 } } },
          },
        ]),
      ),
    ).toStrictEqual([
      { path: 'elements[0].element.group', problem: 'unknown-reference' },
      { path: 'elements[1].element.end.target', problem: 'unknown-reference' },
      { path: 'elements[2].after.group', problem: 'unknown-reference' },
      { path: 'elements[3].after.end.target', problem: 'unknown-reference' },
    ]);
  });

  it('refuses to remove a target that a connector the set leaves alone still points at', () => {
    expect(errorsOf(changeSet([remove(0)]))).toStrictEqual([
      { path: 'elements[0]', problem: 'still-referenced' },
    ]);
    expect(errorsOf(changeSet([remove(0), remove(6)]))).toStrictEqual([]);
    const detach = {
      type: 'update',
      id: e(6),
      before: { start: fixtureArrow().start ?? null },
      after: { start: null },
    } as const;
    expect(errorsOf(changeSet([remove(0), detach]))).toStrictEqual([]);
  });

  it('refuses a changed connector that keeps an end on a removed target, at the connector', () => {
    const recolour = {
      type: 'update',
      id: e(6),
      before: { locked: false },
      after: { locked: true },
    } as const;
    expect(errorsOf(changeSet([remove(0), recolour]))).toStrictEqual([
      { path: 'elements[1].after.start.target', problem: 'unknown-reference' },
    ]);
  });

  it('refuses to remove a group that still has members or nested groups', () => {
    expect(errorsOf(changeSet([], [removeGroup(1)]))).toStrictEqual([
      { path: 'groups[0]', problem: 'still-referenced' },
    ]);
    expect(errorsOf(changeSet([regroup(1, g(1), g(0))], [removeGroup(1)]))).toStrictEqual([]);
    expect(errorsOf(changeSet([regroup(0, g(0), null)], [removeGroup(0)]))).toStrictEqual([
      { path: 'groups[0]', problem: 'still-referenced' },
    ]);
    expect(
      errorsOf(
        changeSet(
          [regroup(0, g(0), null), regroup(1, g(1), null)],
          [removeGroup(1), removeGroup(0)],
        ),
      ),
    ).toStrictEqual([]);
  });

  it('refuses a changed member that stays in a removed group, at the member', () => {
    const lock = {
      type: 'update',
      id: e(1),
      before: { locked: true },
      after: { locked: false },
    } as const;
    expect(errorsOf(changeSet([lock], [removeGroup(1)]))).toStrictEqual([
      { path: 'elements[0].after.group', problem: 'unknown-reference' },
    ]);
  });

  it('refuses a new group whose parent will not exist, or which closes a cycle of parents', () => {
    expect(errorsOf(changeSet([], [addGroup(g(5), g(9))]))).toStrictEqual([
      { path: 'groups[0].group.parent', problem: 'unknown-reference' },
    ]);
    expect(
      errorsOf(changeSet([], [addGroup(g(5), g(6)), addGroup(g(6), g(5)), addGroup(g(7), g(6))])),
    ).toStrictEqual([
      { path: 'groups[0].group.parent', problem: 'group-cycle' },
      { path: 'groups[1].group.parent', problem: 'group-cycle' },
    ]);
    expect(errorsOf(changeSet([], [addGroup(g(5), g(5))]))).toStrictEqual([
      { path: 'groups[0].group.parent', problem: 'group-cycle' },
    ]);
  });

  it('checks references only once every change is valid on its own', () => {
    expect(errorsOf(changeSet([remove(0), { type: 'add', element: fixture(2) }]))).toStrictEqual([
      { path: 'elements[1].element.id', problem: 'exists' },
    ]);
  });
});
