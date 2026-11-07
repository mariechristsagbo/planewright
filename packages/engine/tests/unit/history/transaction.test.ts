import { describe, expect, it } from 'vitest';

import type { ElementId } from '../../../src/model/ids.ts';
import type { ChangeSet } from '../../../src/scene/change-set.ts';
import { ChangeSetError } from '../../../src/scene/store.ts';
import { recorder } from '../../support/histories.ts';
import { AUTHOR, changeSet, contentOf } from '../../support/scene-state.ts';
import { edit, fixtureId, fixtureStore, present } from '../../support/stores.ts';

const e = fixtureId;

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

describe('a history transaction', () => {
  it('REQ-K01 is the only way to record: previews and a cancel record nothing, a commit one entry', () => {
    const { store, history } = recorder(fixtureStore());
    const cancelled = history.begin();
    cancelled.preview(edit(store, 2, { x: 300 }));
    expect(history.canUndo).toBe(false);
    cancelled.cancel();
    expect(history.canUndo).toBe(false);
    const committed = history.begin();
    committed.preview(edit(store, 2, { x: 300 }));
    committed.commit('move');
    expect(history.canUndo).toBe(true);
  });

  it('records the net set with its label, merge key, selection when opened and committed, time and stamp', () => {
    const rec = recorder(fixtureStore());
    const { store, history, clock } = rec;
    rec.selection = [e(2)];
    const transaction = history.begin();
    const added = { ...present(store, 3), id: e(20) };
    transaction.preview(changeSet([{ type: 'add', element: added }]));
    transaction.preview(edit(store, 20, { x: 7 }));
    rec.selection = [e(20)];
    clock.advance(1_234);
    const entry = transaction.commit('create', { mergeKey: 'draw' });
    expect(entry).toStrictEqual({
      label: 'create',
      changes: {
        elements: [{ type: 'add', element: { ...added, x: 7, rev: added.rev + 1 } }],
        groups: [],
        author: AUTHOR,
        seq: 101,
      },
      selectionBefore: [e(2)],
      selectionAfter: [e(20)],
      mergeKey: 'draw',
      time: 1_234,
    });
    expect(history.undo()?.label).toBe('create');
    expect(store.get(e(20))).toBeUndefined();
    expect(rec.selection).toStrictEqual([e(2)]);
  });

  it('records nothing, and returns null, when every field ended where it began', () => {
    const { store, history } = recorder(fixtureStore());
    const transaction = history.begin();
    transaction.preview(edit(store, 2, { x: 300 }));
    transaction.preview(edit(store, 2, { x: 200 }));
    expect(transaction.commit('move')).toBeNull();
    expect(history.canUndo).toBe(false);
    expect(history.inTransaction).toBe(false);
  });

  it('REQ-H07 makes a command, adding a link included, exactly one undo step', () => {
    const { store, history } = recorder(fixtureStore());
    const start = contentOf(store.document());
    const transaction = history.begin();
    transaction.preview(edit(store, 3, { link: 'https://example.test/a' }));
    transaction.preview(edit(store, 3, { link: 'https://example.test/b' }));
    transaction.preview(edit(store, 5, { x: 1 }));
    transaction.commit('style');
    expect(history.undo()).not.toBeNull();
    expect(contentOf(store.document())).toStrictEqual(start);
    expect(history.canUndo).toBe(false);
  });

  it('REQ-K01 leaves out of its entry what remote and load change sets applied while it was open', () => {
    const { store, history } = recorder(fixtureStore());
    const transaction = history.begin();
    transaction.preview(edit(store, 2, { x: 300 }));
    store.apply(edit(store, 2, { y: 5 }), 'remote');
    store.apply(changeSet([{ type: 'add', element: { ...present(store, 3), id: e(20) } }]), 'load');
    expect(transaction.commit('move')?.changes.elements).toStrictEqual([
      { type: 'update', id: e(2), before: { x: 200 }, after: { x: 300 } },
    ]);
    history.undo();
    expect([present(store, 2).x, present(store, 2).y, history.canUndo]).toStrictEqual([
      200,
      5,
      false,
    ]);
    expect(store.get(e(20))).toBeDefined();
  });
});

describe('the one open transaction', () => {
  it('REQ-H06 makes undo and redo do nothing while it is open', () => {
    const { store, history } = recorder(fixtureStore());
    const first = history.begin();
    first.preview(edit(store, 2, { x: 300 }));
    first.commit('move');
    const second = history.begin();
    second.preview(edit(store, 3, { x: 1 }));
    const during = contentOf(store.document());
    expect(history.inTransaction).toBe(true);
    expect(history.undo()).toBeNull();
    expect(history.redo()).toBeNull();
    expect(contentOf(store.document())).toStrictEqual(during);
    second.cancel();
    expect(history.inTransaction).toBe(false);
    expect(history.undo()?.label).toBe('move');
    expect(present(store, 2).x).toBe(200);
  });

  it('is the only one: opening another throws until it is committed or cancelled', () => {
    const { history } = recorder(fixtureStore());
    const open = history.begin();
    expect(() => history.begin()).toThrow('A transaction is open');
    open.commit('move');
    history.begin().cancel();
    expect(history.inTransaction).toBe(false);
    expect(() => history.begin()).not.toThrow();
  });

  it('stays open after a commit whose revert the store refuses, and commits on a retry', () => {
    const { store, history } = recorder(fixtureStore());
    const transaction = history.begin();
    transaction.preview(changeSet([{ type: 'add', element: { ...present(store, 3), id: e(20) } }]));
    store.apply(pointArrowAt(e(20)), 'remote');
    expect(() => transaction.commit('create')).toThrow(ChangeSetError);
    expect([history.inTransaction, history.canUndo]).toStrictEqual([true, false]);
    expect(history.undo()).toBeNull();
    store.apply(pointArrowAt(e(1)), 'remote');
    expect(transaction.commit('create')).not.toBeNull();
    expect([history.inTransaction, history.canUndo]).toStrictEqual([false, true]);
  });

  it('records the net set even when one of its listeners throws, and then rethrows', () => {
    const { store, history } = recorder(fixtureStore());
    const transaction = history.begin();
    transaction.preview(edit(store, 2, { x: 300 }));
    store.subscribe((update) => {
      if (!update.transient) throw new Error('the listener failed');
    });
    expect(() => transaction.commit('move')).toThrow('the listener failed');
    expect([history.inTransaction, history.canUndo]).toStrictEqual([false, true]);
  });

  it('cannot be ended by an older transaction that is already closed', () => {
    const { history } = recorder(fixtureStore());
    const older = history.begin();
    older.cancel();
    history.begin();
    expect(() => {
      older.cancel();
    }).toThrow('closed');
    expect(() => older.commit('move')).toThrow('closed');
    expect(history.inTransaction).toBe(true);
  });
});
