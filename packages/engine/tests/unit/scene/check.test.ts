import { describe, expect, it } from 'vitest';

import type { GroupRecord } from '../../../src/model/document.ts';
import type { Element } from '../../../src/model/elements.ts';
import type { ElementId, GroupId } from '../../../src/model/ids.ts';
import { LIMITS } from '../../../src/model/limits.ts';
import type { ChangeOrigin, ChangeSet, ElementChange } from '../../../src/scene/change-set.ts';
import { planChangeSet } from '../../../src/scene/check.ts';
import { elementId, fixtureDocument, groupId } from '../../support/fixtures.ts';
import { changeSet, color, stateOf } from '../../support/scene-state.ts';

const e = (index: number) => elementId(index) as ElementId;
const g = (index: number) => groupId(index) as GroupId;

const fixture = (index: number): Element => {
  const found = fixtureDocument().elements.get(e(index));
  if (found === undefined) throw new Error(`The fixture has no element ${String(index)}.`);
  return found;
};

/** An element of the fixture's kind at `index`, under a new identifier. */
const fresh = (index: number, id: number): Element => ({ ...fixture(index), id: e(id) });

const plan = (changes: ChangeSet, origin: ChangeOrigin = 'local') =>
  planChangeSet(stateOf(fixtureDocument()), changes, origin);

const errorsOf = (changes: ChangeSet, origin: ChangeOrigin = 'local') => {
  const result = plan(changes, origin);
  return result.ok ? [] : result.errors;
};

const move: ElementChange = { type: 'update', id: e(2), before: { x: 200 }, after: { x: 210 } };

describe('planChangeSet', () => {
  it('plans each change with the element before and after it, raising an update’s revision', () => {
    const added = fresh(3, 20);
    const result = plan(
      changeSet(
        [{ type: 'add', element: added }, { type: 'remove', element: fixture(9) }, move],
        [{ type: 'add', group: { id: g(5), parent: g(1) } }],
        { before: { background: color('#ffffff') }, after: { background: color('#101010') } },
      ),
    );
    expect(result).toStrictEqual({
      ok: true,
      plan: {
        elements: [
          { id: e(20), before: undefined, after: added },
          { id: e(9), before: fixture(9), after: undefined },
          { id: e(2), before: fixture(2), after: { ...fixture(2), x: 210, rev: 2 } },
        ],
        addedGroups: [{ id: g(5), parent: g(1) }],
        removedGroups: [],
        canvas: { background: '#101010' },
      },
    });
  });

  it('removes an optional field that an update sets to null', () => {
    const result = plan(
      changeSet([
        {
          type: 'update',
          id: e(0),
          before: { link: 'https://example.test/a' },
          after: { link: null },
        },
      ]),
    );
    expect(result.ok && Object.hasOwn(result.plan.elements[0]?.after ?? {}, 'link')).toBe(false);
    expect(result.ok).toBe(true);
  });

  it.each([
    [
      'an added identifier that exists',
      { type: 'add', element: fixture(2) },
      'elements[0].element.id',
      'exists',
    ],
    [
      'an added element that is not valid',
      { type: 'add', element: { ...fresh(2, 20), x: Number.NaN } },
      'elements[0].element.x',
      'not-finite',
    ],
    [
      'a removed element that does not exist',
      { type: 'remove', element: fresh(2, 20) },
      'elements[0].element.id',
      'not-found',
    ],
    [
      'an updated element that does not exist',
      { ...move, id: e(20) },
      'elements[0].id',
      'not-found',
    ],
    [
      'an update that makes the element invalid',
      { ...move, before: { width: 0 }, after: { width: -1 } },
      'elements[0].after.width',
      'out-of-range',
    ],
    [
      'an update of the identifier',
      { ...move, before: { id: e(2) }, after: { id: e(21) } },
      'elements[0].after.id',
      'unknown-field',
    ],
    [
      'an update whose before lacks a field of its after',
      { ...move, before: {}, after: { x: 1 } },
      'elements[0].before.x',
      'missing',
    ],
    [
      'an update whose after lacks a field of its before',
      { ...move, after: {} },
      'elements[0].after.x',
      'missing',
    ],
  ] as const)('refuses %s', (_, change, path, problem) => {
    expect(errorsOf(changeSet([change]))).toStrictEqual([{ path, problem }]);
  });

  it('refuses, for local and history sets, a change whose before is not the current value', () => {
    const stale = changeSet(
      [
        { ...move, before: { x: 199 } },
        { type: 'remove', element: { ...fixture(3), x: 1 } },
      ],
      [{ type: 'remove', group: { id: g(1) } }],
      { before: { background: color('#000000') }, after: { background: color('#ffffff') } },
    );
    const expected = [
      { path: 'elements[0].before', problem: 'stale' },
      { path: 'elements[1].element', problem: 'stale' },
      { path: 'groups[0].group', problem: 'stale' },
      { path: 'canvas.before', problem: 'stale' },
    ];
    expect(errorsOf(stale, 'local')).toStrictEqual(expected);
    expect(errorsOf(stale, 'history')).toStrictEqual(expected);
  });

  it('REQ-K01 applies load and remote sets as they are, but checks that what they change exists', () => {
    const elsewhere = changeSet([
      { ...move, before: { x: 199 } },
      { type: 'remove', element: { ...fixture(3), x: 1 } },
    ]);
    expect(plan(elsewhere, 'load').ok).toBe(true);
    expect(plan(elsewhere, 'remote').ok).toBe(true);
    expect(errorsOf(changeSet([{ ...move, id: e(20) }]), 'remote')).toStrictEqual([
      { path: 'elements[0].id', problem: 'not-found' },
    ]);
  });

  it('ignores the revision when it compares a removed element with the current one', () => {
    expect(plan(changeSet([{ type: 'remove', element: { ...fixture(3), rev: 99 } }])).ok).toBe(
      true,
    );
  });

  it('refuses an identifier that two changes of the set use, at the second', () => {
    expect(errorsOf(changeSet([move, { type: 'remove', element: fixture(2) }]))).toStrictEqual([
      { path: 'elements[1]', problem: 'repeated' },
    ]);
    const group: GroupRecord = { id: g(5) };
    expect(
      errorsOf(
        changeSet(
          [],
          [
            { type: 'add', group },
            { type: 'add', group },
          ],
        ),
      ),
    ).toStrictEqual([{ path: 'groups[1]', problem: 'repeated' }]);
  });

  it.each([
    [
      'an added group that exists',
      { type: 'add', group: { id: g(0) } },
      'groups[0].group.id',
      'exists',
    ],
    [
      'a malformed group identifier',
      { type: 'add', group: { id: 'g' as GroupId } },
      'groups[0].group.id',
      'malformed-id',
    ],
    [
      'a removed group that does not exist',
      { type: 'remove', group: { id: g(5) } },
      'groups[0].group.id',
      'not-found',
    ],
  ] as const)('refuses %s', (_, change, path, problem) => {
    expect(errorsOf(changeSet([], [change]))).toStrictEqual([{ path, problem }]);
  });

  it('refuses a canvas whose background is not a colour', () => {
    const canvas = {
      before: { background: color('#ffffff') },
      after: { background: color('white') },
    };
    expect(errorsOf(changeSet([], [], canvas))).toStrictEqual([
      { path: 'canvas.after.background', problem: 'malformed-color' },
    ]);
  });

  it('refuses an addition past the element limit of a document', () => {
    const element = fixture(2);
    const full = new Map(
      Array.from({ length: LIMITS.elements }, (_, index) => [String(index) as ElementId, element]),
    );
    const state = { ...stateOf(fixtureDocument()), elements: full };
    const result = planChangeSet(
      state,
      changeSet([{ type: 'add', element: fresh(2, 20) }]),
      'local',
    );
    expect(result).toStrictEqual({
      ok: false,
      errors: [{ path: 'elements', problem: 'too-many' }],
    });
  });

  it('reports every refused change of the set, and plans nothing', () => {
    const result = plan(
      changeSet([
        move,
        { type: 'add', element: fixture(4) },
        { type: 'remove', element: fresh(2, 20) },
      ]),
    );
    expect(result).toStrictEqual({
      ok: false,
      errors: [
        { path: 'elements[1].element.id', problem: 'exists' },
        { path: 'elements[2].element.id', problem: 'not-found' },
      ],
    });
  });
});
