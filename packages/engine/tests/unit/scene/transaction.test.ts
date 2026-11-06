import { describe, expect, it } from 'vitest';

import type { Element } from '../../../src/model/elements.ts';
import type { ElementId, GroupId } from '../../../src/model/ids.ts';
import { matchesPatch } from '../../../src/model/patch.ts';
import { invertChangeSet } from '../../../src/scene/change-set.ts';
import type { ChangeSet, ElementChange } from '../../../src/scene/change-set.ts';
import { ChangeSetError, createSceneStore } from '../../../src/scene/store.ts';
import type { SceneStore, SceneUpdate } from '../../../src/scene/store.ts';
import { openTransaction } from '../../../src/scene/transaction.ts';
import { elementId, fixtureDocument, groupId } from '../../support/fixtures.ts';
import { AUTHOR, changeSet, color, contentOf } from '../../support/scene-state.ts';

const e = (index: number) => elementId(index) as ElementId;
const g = (index: number) => groupId(index) as GroupId;
const STAMP = { author: AUTHOR, seq: 42 };

const fixture = (index: number): Element => {
  const found = fixtureDocument().elements.get(e(index));
  if (found === undefined) throw new Error(`The fixture has no element ${String(index)}.`);
  return found;
};

function loaded(): { readonly store: SceneStore; readonly updates: SceneUpdate[] } {
  const { elements, groups, canvas } = fixtureDocument();
  const store = createSceneStore(canvas);
  store.apply(
    changeSet(
      [...elements.values()].map((element) => ({ type: 'add', element })),
      [...groups.values()].map((group) => ({ type: 'add', group })),
    ),
    'load',
  );
  const updates: SceneUpdate[] = [];
  store.subscribe((update) => {
    updates.push(update);
  });
  return { store, updates };
}

/** The element that the store holds under the fixture identifier `index`. */
function present(store: SceneStore, index: number): Element {
  const found = store.get(e(index));
  if (found === undefined) throw new Error(`The store holds no element ${String(index)}.`);
  return found;
}

/** The net set of a commit that changed something. */
function committed(net: ChangeSet | null): ChangeSet {
  if (net === null) throw new Error('The transaction committed nothing.');
  return net;
}

/** An update of one element's fields from their current values in the store. */
function edit(store: SceneStore, index: number, after: Record<string, unknown>): ChangeSet {
  const current = store.get(e(index)) as unknown as Record<string, unknown>;
  const before = Object.fromEntries(Object.keys(after).map((key) => [key, current[key] ?? null]));
  return changeSet([{ type: 'update', id: e(index), before, after }]);
}

const added = { ...fixture(3), id: e(20) };

describe('a transaction', () => {
  it('commits nothing, and emits nothing, when no preview ran or every field ended where it began', () => {
    const { store, updates } = loaded();
    expect(openTransaction(store).commit(STAMP)).toBeNull();
    const back = openTransaction(store);
    back.preview(edit(store, 2, { x: 300 }));
    back.preview(edit(store, 2, { x: 200 }));
    expect(back.commit(STAMP)).toBeNull();
    expect(updates.map(({ transient }) => transient)).toStrictEqual([true, true]);
  });

  it('reverts its previews, then applies one net change set from each first before to the current value', () => {
    const { store, updates } = loaded();
    const start = contentOf(store.document());
    const transaction = openTransaction(store);
    transaction.preview(edit(store, 2, { x: 300 }));
    transaction.preview(edit(store, 2, { x: 400, y: 10 }));
    transaction.preview(edit(store, 5, { link: 'https://example.test/t' }));
    const end = contentOf(store.document());
    const seen: unknown[] = [];
    store.subscribe(() => seen.push(contentOf(store.document())));
    const net = transaction.commit(STAMP);
    expect(net).toStrictEqual({
      elements: [
        { type: 'update', id: e(2), before: { x: 200, y: -100 }, after: { x: 400, y: 10 } },
        {
          type: 'update',
          id: e(5),
          before: { link: null },
          after: { link: 'https://example.test/t' },
        },
      ],
      groups: [],
      ...STAMP,
    });
    const [revert, applied] = updates.slice(3);
    expect(updates).toHaveLength(5);
    expect(revert).toMatchObject({
      origin: 'local',
      transient: true,
      changes: invertChangeSet(committed(net)),
    });
    expect(applied).toStrictEqual({
      origin: 'local',
      transient: false,
      changes: net,
      changed: [e(2), e(5)],
      rev: store.rev,
    });
    expect(seen).toStrictEqual([start, end]);
  });

  it('commits a set whose before check passes at the start and which inverts exactly', () => {
    const { store } = loaded();
    const start = store.document();
    const transaction = openTransaction(store);
    transaction.preview(
      changeSet([
        { type: 'add', element: added },
        { type: 'remove', element: fixture(9) },
      ]),
    );
    transaction.preview(edit(store, 20, { x: 5 }));
    transaction.preview(changeSet([], [{ type: 'add', group: { id: g(5) } }]));
    transaction.preview(
      changeSet([], [], {
        before: { background: color('#ffffff') },
        after: { background: color('#111111') },
      }),
    );
    transaction.preview(edit(store, 2, { x: 250 }));
    const end = contentOf(store.document());
    const net = committed(transaction.commit(STAMP));
    expect(net.elements).toStrictEqual([
      { type: 'add', element: { ...added, x: 5, rev: added.rev + 1 } },
      { type: 'remove', element: fixture(9) },
      { type: 'update', id: e(2), before: { x: 200 }, after: { x: 250 } },
    ]);
    expect(net.groups).toStrictEqual([{ type: 'add', group: { id: g(5) } }]);
    expect(net.canvas).toStrictEqual({
      before: { background: '#ffffff' },
      after: { background: '#111111' },
    });
    const updated = net.elements.filter(
      (change): change is Extract<ElementChange, { type: 'update' }> => change.type === 'update',
    );
    expect(updated).toHaveLength(1);
    expect(
      updated.every(({ id, before }) => {
        const element = start.elements.get(id);
        return element !== undefined && matchesPatch(element, before);
      }),
    ).toBe(true);
    store.apply(invertChangeSet(net), 'local');
    expect(contentOf(store.document())).toStrictEqual(contentOf(start));
    store.apply(net, 'local');
    expect(contentOf(store.document())).toStrictEqual(end);
  });

  it('removes, at its start, an element whose fields it changed before removing it', () => {
    const { store } = loaded();
    const transaction = openTransaction(store);
    transaction.preview(edit(store, 2, { x: 9, width: 3 }));
    transaction.preview(changeSet([{ type: 'remove', element: present(store, 2) }]));
    const net = committed(transaction.commit(STAMP));
    expect(net.elements).toStrictEqual([
      { type: 'remove', element: { ...fixture(2), rev: fixture(2).rev + 1 } },
    ]);
    expect(store.get(e(2))).toBeUndefined();
  });

  it('commits nothing for an element that it added and removed again', () => {
    const { store } = loaded();
    const transaction = openTransaction(store);
    transaction.preview(changeSet([{ type: 'add', element: added }]));
    transaction.preview(changeSet([{ type: 'remove', element: added }]));
    expect(transaction.commit(STAMP)).toBeNull();
  });

  it('cancels by reverting every preview, and leaves the document equal to its start', () => {
    const { store, updates } = loaded();
    const start = contentOf(store.document());
    const transaction = openTransaction(store);
    transaction.preview(edit(store, 2, { x: 300 }));
    transaction.preview(
      changeSet(
        [{ type: 'add', element: added }],
        [{ type: 'add', group: { id: g(5), parent: g(0) } }],
      ),
    );
    transaction.preview(edit(store, 0, { group: null, link: null }));
    transaction.cancel();
    expect(contentOf(store.document())).toStrictEqual(start);
    expect(updates.every(({ transient }) => transient)).toBe(true);
  });

  it('cancels without a change when no preview ran', () => {
    const { store, updates } = loaded();
    openTransaction(store).cancel();
    expect(updates).toStrictEqual([]);
  });
});

describe('a transaction beside other origins', () => {
  it('keeps out of its net set the fields that it never touched', () => {
    const { store } = loaded();
    const transaction = openTransaction(store);
    transaction.preview(edit(store, 2, { x: 300 }));
    store.apply(edit(store, 2, { y: 77, locked: true }), 'remote');
    const net = committed(transaction.commit(STAMP));
    expect(net.elements).toStrictEqual([
      { type: 'update', id: e(2), before: { x: 200 }, after: { x: 300 } },
    ]);
    expect(store.get(e(2))).toMatchObject({ x: 300, y: 77, locked: true });
  });

  it('commits nothing for an element that another origin removed after a preview changed it', () => {
    const { store } = loaded();
    const transaction = openTransaction(store);
    transaction.preview(edit(store, 2, { x: 300 }));
    store.apply(changeSet([{ type: 'remove', element: present(store, 2) }]), 'remote');
    expect(transaction.commit(STAMP)).toBeNull();
    expect(store.get(e(2))).toBeUndefined();
  });

  it('adds an element that another origin removed and a preview added again', () => {
    const { store } = loaded();
    const transaction = openTransaction(store);
    transaction.preview(edit(store, 2, { x: 300 }));
    store.apply(changeSet([{ type: 'remove', element: present(store, 2) }]), 'remote');
    transaction.preview(changeSet([{ type: 'add', element: fixture(2) }]));
    const net = committed(transaction.commit(STAMP));
    expect(net.elements).toStrictEqual([{ type: 'add', element: fixture(2) }]);
  });
});

describe('a transaction’s rules', () => {
  it('forgets a refused preview, which changes nothing', () => {
    const { store } = loaded();
    const transaction = openTransaction(store);
    transaction.preview(edit(store, 2, { x: 300 }));
    expect(() => {
      transaction.preview(
        changeSet([
          { type: 'update', id: e(2), before: { x: 1 }, after: { x: 2 } },
          { type: 'update', id: e(3), before: { x: 300 }, after: { x: 0 } },
        ]),
      );
    }).toThrow(ChangeSetError);
    const net = committed(transaction.commit(STAMP));
    expect(net.elements).toStrictEqual([
      { type: 'update', id: e(2), before: { x: 200 }, after: { x: 300 } },
    ]);
  });

  it('refuses to add an element or a group again in another form than it removed', () => {
    const { store } = loaded();
    const transaction = openTransaction(store);
    transaction.preview(changeSet([{ type: 'remove', element: fixture(2) }]));
    expect(() => {
      transaction.preview(changeSet([{ type: 'add', element: { ...fixture(3), id: e(2) } }]));
    }).toThrow(RangeError);
    expect(store.get(e(2))).toBeUndefined();
    transaction.preview(changeSet([{ type: 'add', element: fixture(2) }]));
    expect(transaction.commit(STAMP)).toBeNull();
    store.apply(changeSet([], [{ type: 'add', group: { id: g(5) } }]), 'local');
    const regroup = openTransaction(store);
    regroup.preview(changeSet([], [{ type: 'remove', group: { id: g(5) } }]));
    expect(() => {
      regroup.preview(changeSet([], [{ type: 'add', group: { id: g(5), parent: g(0) } }]));
    }).toThrow(RangeError);
    regroup.preview(changeSet([], [{ type: 'add', group: { id: g(5) } }]));
    expect(regroup.commit(STAMP)).toBeNull();
  });

  it('refuses every call once it is committed or cancelled', () => {
    const { store } = loaded();
    const committed = openTransaction(store);
    committed.commit(STAMP);
    const cancelled = openTransaction(store);
    cancelled.cancel();
    for (const transaction of [committed, cancelled]) {
      expect(() => {
        transaction.preview(edit(store, 2, { x: 1 }));
      }).toThrow('closed');
      expect(() => transaction.commit(STAMP)).toThrow('closed');
      expect(() => {
        transaction.cancel();
      }).toThrow('closed');
    }
  });
});
