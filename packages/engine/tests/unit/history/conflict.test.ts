import { describe, expect, it } from 'vitest';

import type { GroupId } from '../../../src/model/ids.ts';
import { applicablePart } from '../../../src/history/conflict.ts';
import { invertChangeSet } from '../../../src/scene/change-set.ts';
import type { ChangeSet } from '../../../src/scene/change-set.ts';
import { groupId } from '../../support/fixtures.ts';
import { changeSet, color } from '../../support/scene-state.ts';
import { edit, fixtureId, fixtureStore, present } from '../../support/stores.ts';

const e = fixtureId;
const g = (index: number) => groupId(index) as GroupId;
const WHITE = { background: color('#ffffff') };
const DARK = { background: color('#202020') };

describe('the part of a change set that still applies', () => {
  it('REQ-K03 keeps of an update only the fields whose current value is still its before', () => {
    const store = fixtureStore();
    const update = changeSet([
      { type: 'update', id: e(2), before: { x: 200, y: 7 }, after: { x: 1, y: 2 } },
    ]);
    expect(applicablePart(update, store).elements).toStrictEqual([
      { type: 'update', id: e(2), before: { x: 200 }, after: { x: 1 } },
    ]);
    expect(applicablePart(edit(store, 3, { link: 'https://example.test/' }), store)).toStrictEqual(
      edit(store, 3, { link: 'https://example.test/' }),
    );
  });

  it('drops an update when no field still holds its before, or its element is gone', () => {
    const store = fixtureStore();
    const stale = changeSet([{ type: 'update', id: e(2), before: { x: 5 }, after: { x: 6 } }]);
    const gone = changeSet([{ type: 'update', id: e(20), before: { x: 5 }, after: { x: 6 } }]);
    expect(applicablePart(stale, store).elements).toStrictEqual([]);
    expect(applicablePart(gone, store).elements).toStrictEqual([]);
  });

  it('keeps an addition whose identifier is free, and drops one whose identifier is taken', () => {
    const store = fixtureStore();
    const free = { ...present(store, 3), id: e(20) };
    const set = changeSet([
      { type: 'add', element: free },
      { type: 'add', element: present(store, 4) },
    ]);
    expect(applicablePart(set, store).elements).toStrictEqual([{ type: 'add', element: free }]);
  });

  it('removes an element that still exists as it is now, and drops a removal of one that is gone', () => {
    const store = fixtureStore();
    store.apply(edit(store, 2, { x: 999 }), 'remote');
    const set = changeSet([
      { type: 'remove', element: { ...present(store, 2), x: 200 } },
      { type: 'remove', element: { ...present(store, 3), id: e(20) } },
    ]);
    expect(applicablePart(set, store).elements).toStrictEqual([
      { type: 'remove', element: present(store, 2) },
    ]);
  });

  it('keeps a group addition whose identifier is free and a removal of a group that exists', () => {
    const store = fixtureStore();
    const set = changeSet(
      [],
      [
        { type: 'add', group: { id: g(5) } },
        { type: 'add', group: { id: g(0) } },
        { type: 'remove', group: { id: g(1) } },
        { type: 'remove', group: { id: g(6) } },
      ],
    );
    expect(applicablePart(set, store).groups).toStrictEqual([
      { type: 'add', group: { id: g(5) } },
      { type: 'remove', group: { id: g(1), parent: g(0) } },
    ]);
  });

  it('keeps a canvas change only while the canvas still holds its before', () => {
    const store = fixtureStore();
    const set = changeSet([], [], { before: WHITE, after: DARK });
    expect(applicablePart(set, store).canvas).toStrictEqual({ before: WHITE, after: DARK });
    store.apply(
      changeSet([], [], { before: WHITE, after: { background: color('#000000') } }),
      'remote',
    );
    expect(applicablePart(set, store)).not.toHaveProperty('canvas');
  });

  it('is the whole set, with its stamp, where it has just been applied', () => {
    const store = fixtureStore();
    const set: ChangeSet = {
      ...changeSet(
        [
          { type: 'add', element: { ...present(store, 3), id: e(20) } },
          { type: 'remove', element: present(store, 9) },
          { type: 'update', id: e(2), before: { x: 200 }, after: { x: 1 } },
        ],
        [{ type: 'add', group: { id: g(5), parent: g(1) } }],
        { before: WHITE, after: DARK },
      ),
      seq: 77,
    };
    store.apply(set, 'local');
    const inverse = invertChangeSet(set);
    expect(applicablePart(inverse, store)).toStrictEqual({
      ...inverse,
      elements: [{ type: 'remove', element: present(store, 20) }, ...inverse.elements.slice(1)],
    });
  });
});
