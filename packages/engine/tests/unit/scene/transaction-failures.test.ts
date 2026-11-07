import { describe, expect, it } from 'vitest';

import type { Element } from '../../../src/model/elements.ts';
import type { ElementId } from '../../../src/model/ids.ts';
import type { ChangeSet } from '../../../src/scene/change-set.ts';
import { ChangeSetError } from '../../../src/scene/store.ts';
import type { SceneStore, SceneUpdate } from '../../../src/scene/store.ts';
import { openTransaction } from '../../../src/scene/transaction.ts';
import { AUTHOR, changeSet, contentOf } from '../../support/scene-state.ts';
import { edit, fixtureId, fixtureStore, present } from '../../support/stores.ts';

// What a transaction does when a scene listener throws or the store refuses its revert: it never
// forgets a preview that the store holds, and it closes only once its revert is applied.

const e = fixtureId;
const STAMP = { author: AUTHOR, seq: 42 };

/** A listener that throws `error` for each update that `when` picks, from the moment it is added. */
function failOn(store: SceneStore, error: Error, when: (update: SceneUpdate) => boolean): void {
  store.subscribe((update) => {
    if (when(update)) throw error;
  });
}

const transient = (update: SceneUpdate) => update.transient;
const lasting = (update: SceneUpdate) => !update.transient;

/** The fixture's arrow, pointed at `target` by another client. */
const pointArrowAt = (target: ElementId): ChangeSet =>
  changeSet([
    {
      type: 'update',
      id: e(6),
      before: { end: null },
      after: { end: { target, anchor: { x: 0, y: 0.5 } } },
    },
  ]);

function withAddition(store: SceneStore): Element {
  return { ...present(store, 3), id: e(20) };
}

describe('a transaction whose listener throws', () => {
  it('remembers a preview that the store applied, so that cancel still restores the start', () => {
    const store = fixtureStore();
    const start = contentOf(store.document());
    const transaction = openTransaction(store);
    let fail = true;
    store.subscribe(() => {
      if (fail) throw new Error('the listener failed');
    });
    expect(() => {
      transaction.preview(edit(store, 2, { x: 300 }));
    }).toThrow('the listener failed');
    expect(present(store, 2).x).toBe(300);
    fail = false;
    transaction.cancel();
    expect(contentOf(store.document())).toStrictEqual(start);
  });

  it('commits a preview that the store applied though a listener threw', () => {
    const store = fixtureStore();
    const added = withAddition(store);
    const transaction = openTransaction(store);
    let fail = true;
    store.subscribe(() => {
      if (fail) throw new Error('the listener failed');
    });
    expect(() => {
      transaction.preview(changeSet([{ type: 'add', element: added }]));
    }).toThrow('the listener failed');
    fail = false;
    expect(transaction.commit(STAMP)?.elements).toStrictEqual([{ type: 'add', element: added }]);
  });

  it('applies the net set after a revert whose listener threw, hands it over, then rethrows the first error', () => {
    const store = fixtureStore();
    const transaction = openTransaction(store);
    transaction.preview(edit(store, 2, { x: 300 }));
    const first = new Error('a revert listener failed');
    failOn(store, first, transient);
    failOn(store, new Error('a net set listener failed'), lasting);
    const handed: ChangeSet[] = [];
    expect(() => transaction.commit(STAMP, (net) => handed.push(net))).toThrow(first);
    expect(present(store, 2).x).toBe(300);
    expect(handed.map(({ elements }) => elements)).toStrictEqual([
      [{ type: 'update', id: e(2), before: { x: 200 }, after: { x: 300 } }],
    ]);
    expect(transaction.open).toBe(false);
  });

  it('hands over the net set that it applied when a listener of that set throws', () => {
    const store = fixtureStore();
    const transaction = openTransaction(store);
    transaction.preview(edit(store, 2, { x: 300 }));
    failOn(store, new Error('a net set listener failed'), lasting);
    const handed: ChangeSet[] = [];
    expect(() => transaction.commit(STAMP, (net) => handed.push(net))).toThrow(
      'a net set listener failed',
    );
    expect(handed).toHaveLength(1);
    expect(store.document().rev).toBe(4);
    expect(transaction.open).toBe(false);
  });

  it('closes a cancel whose revert the store applied though a listener threw, then rethrows', () => {
    const store = fixtureStore();
    const start = contentOf(store.document());
    const transaction = openTransaction(store);
    transaction.preview(edit(store, 2, { x: 300 }));
    failOn(store, new Error('a revert listener failed'), transient);
    expect(() => {
      transaction.cancel();
    }).toThrow('a revert listener failed');
    expect(contentOf(store.document())).toStrictEqual(start);
    expect(transaction.open).toBe(false);
  });
});

describe('a transaction whose revert the store refuses', () => {
  it('stays open, with its preview in place, when a cancel is refused, and cancels once the conflict is gone', () => {
    const store = fixtureStore();
    const start = contentOf(store.document());
    const transaction = openTransaction(store);
    transaction.preview(changeSet([{ type: 'add', element: withAddition(store) }]));
    store.apply(pointArrowAt(e(20)), 'remote');
    const held = contentOf(store.document());
    expect(() => {
      transaction.cancel();
    }).toThrow(ChangeSetError);
    expect(contentOf(store.document())).toStrictEqual(held);
    store.apply(pointArrowAt(e(1)), 'remote');
    transaction.cancel();
    expect(contentOf(store.document())).toStrictEqual(start);
    expect(transaction.open).toBe(false);
  });

  it('stays open when a commit is refused, previews again and commits on a retry once the conflict is gone', () => {
    const store = fixtureStore();
    const added = withAddition(store);
    const transaction = openTransaction(store);
    transaction.preview(changeSet([{ type: 'add', element: added }]));
    store.apply(pointArrowAt(e(20)), 'remote');
    const held = contentOf(store.document());
    const handed: ChangeSet[] = [];
    expect(() => transaction.commit(STAMP, (net) => handed.push(net))).toThrow(ChangeSetError);
    expect(handed).toStrictEqual([]);
    expect(contentOf(store.document())).toStrictEqual(held);
    transaction.preview(edit(store, 2, { x: 300 }));
    expect(transaction.open).toBe(true);
    store.apply(pointArrowAt(e(1)), 'remote');
    const net = transaction.commit(STAMP, (applied) => handed.push(applied));
    expect(net?.elements).toStrictEqual([
      { type: 'add', element: added },
      { type: 'update', id: e(2), before: { x: 200 }, after: { x: 300 } },
    ]);
    expect(handed).toStrictEqual([net]);
    expect(transaction.open).toBe(false);
  });
});

describe('whether a transaction is open', () => {
  it('is true until a commit or a cancel, including one that changes nothing', () => {
    const store = fixtureStore();
    const committed = openTransaction(store);
    expect(committed.open).toBe(true);
    committed.preview(edit(store, 2, { x: 300 }));
    committed.commit(STAMP);
    expect(committed.open).toBe(false);
    const empty = openTransaction(store);
    expect(empty.commit(STAMP)).toBeNull();
    expect(empty.open).toBe(false);
    const cancelled = openTransaction(store);
    cancelled.cancel();
    expect(cancelled.open).toBe(false);
  });
});
