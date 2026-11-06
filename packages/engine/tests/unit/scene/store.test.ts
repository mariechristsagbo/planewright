import { describe, expect, it } from 'vitest';

import type { Element } from '../../../src/model/elements.ts';
import type { ElementId, GroupId } from '../../../src/model/ids.ts';
import type { ChangeOrigin, ChangeSet, ElementChange } from '../../../src/scene/change-set.ts';
import { createSceneStore } from '../../../src/scene/store.ts';
import type { SceneStore, SceneUpdate } from '../../../src/scene/store.ts';
import { elementId, fixtureDocument, groupId } from '../../support/fixtures.ts';
import { changeSet, color } from '../../support/scene-state.ts';

const e = (index: number) => elementId(index) as ElementId;
const g = (index: number) => groupId(index) as GroupId;

const fixture = (index: number): Element => {
  const found = fixtureDocument().elements.get(e(index));
  if (found === undefined) throw new Error(`The fixture has no element ${String(index)}.`);
  return found;
};

/** The fixture document as one `load` change set. */
function fixtureLoad(): ChangeSet {
  const { elements, groups } = fixtureDocument();
  return changeSet(
    [...elements.values()].map((element) => ({ type: 'add', element })),
    [...groups.values()].map((group) => ({ type: 'add', group })),
  );
}

/** A store that holds the fixture, and the updates it emits from then on. */
function loaded(): { readonly store: SceneStore; readonly updates: SceneUpdate[] } {
  const store = createSceneStore(fixtureDocument().canvas);
  store.apply(fixtureLoad(), 'load');
  const updates: SceneUpdate[] = [];
  store.subscribe((update) => {
    updates.push(update);
  });
  return { store, updates };
}

const move: ElementChange = { type: 'update', id: e(2), before: { x: 200 }, after: { x: -4_000 } };
const addition: ElementChange = { type: 'add', element: { ...fixture(3), id: e(20) } };

describe('a new scene store', () => {
  it('holds nothing at revision 0 but its canvas', () => {
    const store = createSceneStore({ background: color('#ffffff') });
    expect(store.rev).toBe(0);
    expect(store.canvas).toStrictEqual({ background: '#ffffff' });
    expect(store.ordered()).toStrictEqual([]);
    expect(store.get(e(0))).toBeUndefined();
    expect(store.document()).toStrictEqual({
      elements: new Map(),
      groups: new Map(),
      canvas: { background: '#ffffff' },
      rev: 0,
    });
  });
});

describe('SceneStore.apply', () => {
  it('REQ-K01 emits a load update with its origin, the set, the changed elements and the revision', () => {
    const store = createSceneStore(fixtureDocument().canvas);
    const updates: SceneUpdate[] = [];
    store.subscribe((update) => {
      updates.push(update);
    });
    const load = fixtureLoad();
    store.apply(load, 'load');
    expect(updates).toStrictEqual([
      {
        origin: 'load',
        transient: false,
        changes: load,
        changed: [...fixtureDocument().elements.keys()],
        rev: 1,
      },
    ]);
    expect(store.document()).toStrictEqual({ ...fixtureDocument(), rev: 1 });
  });

  it('REQ-K01 emits a remote update with its origin, and takes its before as it is', () => {
    const { store, updates } = loaded();
    const remote = changeSet([{ ...move, before: { x: 12_345 } }]);
    store.apply(remote, 'remote');
    expect(updates).toStrictEqual([
      { origin: 'remote', transient: false, changes: remote, changed: [e(2)], rev: 2 },
    ]);
    expect(store.get(e(2))?.x).toBe(-4_000);
  });

  it.each(['local', 'history'] as const)(
    'emits a %s update with its origin',
    (origin: ChangeOrigin) => {
      const { store, updates } = loaded();
      store.apply(changeSet([move]), origin);
      expect(updates.map((update) => update.origin)).toStrictEqual([origin]);
    },
  );

  it('raises the document revision once per set and an updated element’s once, and keeps an addition’s', () => {
    const { store } = loaded();
    store.apply(changeSet([move, addition]), 'local');
    expect(store.rev).toBe(2);
    expect(store.get(e(2))?.rev).toBe(fixture(2).rev + 1);
    expect(store.get(e(20))?.rev).toBe(fixture(3).rev);
    store.apply(changeSet([]), 'local');
    expect(store.rev).toBe(3);
  });

  it('flags a transient update, which the indexes follow like any other', () => {
    const { store, updates } = loaded();
    store.apply(changeSet([move]), 'local', { transient: true });
    expect(updates.map(({ transient, rev }) => ({ transient, rev }))).toStrictEqual([
      { transient: true, rev: 2 },
    ]);
    expect(store.queryPoint({ x: -4_000, y: -100 }, 1)).toStrictEqual([e(2)]);
    store.apply(changeSet([{ ...move, before: { x: -4_000 }, after: { x: 200 } }]), 'local', {
      transient: false,
    });
    expect(updates.at(-1)?.transient).toBe(false);
  });

  it('applies a canvas change and adds and removes groups', () => {
    const { store } = loaded();
    const canvas = {
      before: { background: color('#ffffff') },
      after: { background: color('#202020') },
    };
    store.apply(
      changeSet([], [{ type: 'add', group: { id: g(5), parent: g(1) } }], canvas),
      'local',
    );
    expect(store.canvas).toStrictEqual({ background: '#202020' });
    expect(store.group(g(5))).toStrictEqual({ id: g(5), parent: g(1) });
    store.apply(changeSet([], [{ type: 'remove', group: { id: g(5), parent: g(1) } }]), 'local');
    expect(store.group(g(5))).toBeUndefined();
  });

  it('hands out a copy of the document, which changing does not change the store', () => {
    const { store } = loaded();
    const copy = store.document().elements as Map<ElementId, Element>;
    copy.delete(e(0));
    expect(store.document().elements.has(e(0))).toBe(true);
  });
});
