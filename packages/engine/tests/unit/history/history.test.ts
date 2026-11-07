import { describe, expect, it } from 'vitest';

import type { SceneUpdate } from '../../../src/scene/store.ts';
import { recorder } from '../../support/histories.ts';
import { changeSet, contentOf } from '../../support/scene-state.ts';
import { edit, fixtureId, fixtureStore, present } from '../../support/stores.ts';

const e = fixtureId;

describe('a new history', () => {
  it('REQ-H02 can neither undo nor redo, and undo and redo change nothing', () => {
    const { store, history } = recorder(fixtureStore());
    const start = store.rev;
    expect([history.canUndo, history.canRedo]).toStrictEqual([false, false]);
    expect(history.undo()).toBeNull();
    expect(history.redo()).toBeNull();
    expect(store.rev).toBe(start);
  });
});

describe('recording', () => {
  it('REQ-H02 enables undo with the first entry, redo after an undo, and disables redo with a new entry', () => {
    const { store, history, commit } = recorder(fixtureStore());
    commit(edit(store, 2, { x: 300 }));
    expect([history.canUndo, history.canRedo]).toStrictEqual([true, false]);
    history.undo();
    expect([history.canUndo, history.canRedo]).toStrictEqual([false, true]);
    commit(edit(store, 3, { x: 1 }));
    expect([history.canUndo, history.canRedo]).toStrictEqual([true, false]);
  });

  it('ignores an entry that changes nothing, which keeps the redo stack', () => {
    const { store, history, commit } = recorder(fixtureStore());
    commit(edit(store, 2, { x: 300 }));
    history.undo();
    history.record({
      label: 'move',
      changes: changeSet([]),
      selectionBefore: [],
      selectionAfter: [],
      time: 0,
    });
    expect([history.canUndo, history.canRedo]).toStrictEqual([false, true]);
  });
});

describe('undo and redo', () => {
  it('undo applies the inverse with the history origin, and redo the entry again, each stamped anew', () => {
    const { store, history, commit } = recorder(fixtureStore());
    const start = contentOf(store.document());
    const entry = commit(
      changeSet([
        { type: 'add', element: { ...present(store, 3), id: e(20) } },
        { type: 'update', id: e(2), before: { x: 200 }, after: { x: 300 } },
      ]),
    );
    const end = contentOf(store.document());
    const updates: SceneUpdate[] = [];
    store.subscribe((update) => updates.push(update));
    expect(history.undo()).toStrictEqual({ ...entry, changes: { ...entry.changes, seq: 101 } });
    expect(contentOf(store.document())).toStrictEqual(start);
    expect(history.redo()?.changes.seq).toBe(102);
    expect(contentOf(store.document())).toStrictEqual(end);
    expect(
      updates.map(({ origin, transient, changes }) => [origin, transient, changes.seq]),
    ).toStrictEqual([
      ['history', false, 101],
      ['history', false, 102],
    ]);
  });

  it('undoes entries newest first and redoes them in their order', () => {
    const { store, history, commit } = recorder(fixtureStore());
    const documents = [contentOf(store.document())];
    for (const [index, label] of [
      [2, 'move'],
      [3, 'style'],
      [2, 'nudge'],
    ] as const) {
      commit(edit(store, index, { x: documents.length * 1_000 }), { label });
      documents.push(contentOf(store.document()));
    }
    const undone = [history.undo(), history.undo(), history.undo()].map((entry) => entry?.label);
    expect(undone).toStrictEqual(['nudge', 'style', 'move']);
    expect(contentOf(store.document())).toStrictEqual(documents[0]);
    expect(history.undo()).toBeNull();
    const redone = [history.redo(), history.redo()].map((entry) => entry?.label);
    expect(redone).toStrictEqual(['move', 'style']);
    expect(contentOf(store.document())).toStrictEqual(documents[2]);
  });

  it('restore the selection around the entry, filtered to the elements that exist', () => {
    const rec = recorder(fixtureStore());
    const { store, history, commit } = rec;
    commit(
      changeSet([
        { type: 'add', element: { ...present(store, 3), id: e(20) } },
        { type: 'update', id: e(2), before: { x: 200 }, after: { x: 300 } },
      ]),
      { selectionBefore: [e(2), e(7)], selectionAfter: [e(20), e(2)] },
    );
    store.apply(changeSet([{ type: 'remove', element: present(store, 7) }]), 'remote');
    rec.selection = [e(9)];
    history.undo();
    expect(rec.selection).toStrictEqual([e(2)]);
    history.redo();
    expect(rec.selection).toStrictEqual([e(20), e(2)]);
  });
});

describe('clearing', () => {
  it('empties both stacks', () => {
    const { store, history, commit } = recorder(fixtureStore());
    commit(edit(store, 2, { x: 300 }));
    commit(edit(store, 3, { x: 1 }));
    history.undo();
    history.clear();
    expect([history.canUndo, history.canRedo]).toStrictEqual([false, false]);
    expect(history.undo()).toBeNull();
    expect(history.redo()).toBeNull();
  });
});

describe('undo and redo beside a listener that throws', () => {
  it('finish their step, the selection included, before rethrowing the listener error', () => {
    const rec = recorder(fixtureStore());
    const { store, history, commit } = rec;
    commit(edit(store, 2, { x: 300 }), { selectionBefore: [e(2)], selectionAfter: [e(3)] });
    store.subscribe(() => {
      throw new Error('the listener failed');
    });
    expect(() => history.undo()).toThrow('the listener failed');
    expect([present(store, 2).x, history.canUndo, history.canRedo]).toStrictEqual([
      200,
      false,
      true,
    ]);
    expect(rec.selection).toStrictEqual([e(2)]);
    expect(() => history.redo()).toThrow('the listener failed');
    expect([present(store, 2).x, history.canUndo, history.canRedo]).toStrictEqual([
      300,
      true,
      false,
    ]);
    expect(rec.selection).toStrictEqual([e(3)]);
  });

  it('leave the entry in place when asked while the store tells a listener of a set', () => {
    const { store, history, commit } = recorder(fixtureStore());
    commit(edit(store, 2, { x: 300 }));
    const caught: unknown[] = [];
    const stop = store.subscribe(() => {
      try {
        history.undo();
      } catch (error) {
        caught.push(error);
      }
    });
    store.apply(edit(store, 3, { x: 1 }), 'remote');
    stop();
    expect(caught).toHaveLength(1);
    expect([present(store, 2).x, history.canUndo, history.canRedo]).toStrictEqual([
      300,
      true,
      false,
    ]);
  });
});
