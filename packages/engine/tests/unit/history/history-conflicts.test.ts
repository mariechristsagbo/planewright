import { describe, expect, it } from 'vitest';

import type { GroupId } from '../../../src/model/ids.ts';
import { groupId } from '../../support/fixtures.ts';
import { recorder } from '../../support/histories.ts';
import { changeSet, color } from '../../support/scene-state.ts';
import { edit, fixtureId, fixtureStore, present } from '../../support/stores.ts';

const e = fixtureId;
const g = (index: number) => groupId(index) as GroupId;

describe('conflict-safe undo and redo', () => {
  it('REQ-K03 keep the remote value of a field that a remote change set changed after the entry', () => {
    const { store, history, commit } = recorder(fixtureStore());
    commit(edit(store, 2, { x: 300, y: 5 }));
    store.apply(edit(store, 2, { x: 999 }), 'remote');
    const undone = history.undo();
    expect([present(store, 2).x, present(store, 2).y]).toStrictEqual([999, -100]);
    expect(undone?.changes.elements).toStrictEqual([
      { type: 'update', id: e(2), before: { y: -100 }, after: { y: 5 } },
    ]);
    history.redo();
    expect([present(store, 2).x, present(store, 2).y]).toStrictEqual([999, 5]);
  });

  it('REQ-K03 keep a field that a remote change set changed after an undo, on redo', () => {
    const { store, history, commit } = recorder(fixtureStore());
    commit(edit(store, 2, { x: 300, y: 5 }));
    history.undo();
    store.apply(edit(store, 2, { y: 77 }), 'remote');
    history.redo();
    expect([present(store, 2).x, present(store, 2).y]).toStrictEqual([300, 77]);
  });

  it('keep the remote canvas, and an element or group that another origin removed or added', () => {
    const { store, history, commit } = recorder(fixtureStore());
    const white = { background: color('#ffffff') };
    commit(changeSet([], [], { before: white, after: { background: color('#202020') } }));
    commit(changeSet([{ type: 'remove', element: present(store, 9) }]));
    commit(edit(store, 5, { x: 1 }));
    store.apply(
      changeSet([], [], { before: white, after: { background: color('#000000') } }),
      'remote',
    );
    store.apply(
      changeSet([{ type: 'add', element: { ...present(store, 8), id: e(9) } }]),
      'remote',
    );
    store.apply(changeSet([{ type: 'remove', element: present(store, 5) }]), 'remote');
    expect(history.undo()).toBeNull();
    expect(store.canvas).toStrictEqual({ background: '#000000' });
    expect(present(store, 9).kind).toBe('image');
    expect(store.get(e(5))).toBeUndefined();
    expect([history.canUndo, history.canRedo]).toStrictEqual([false, false]);
  });

  it('drop an entry that has nothing left to apply, and undo the next one', () => {
    const { store, history, commit } = recorder(fixtureStore());
    commit(edit(store, 2, { x: 300 }), { label: 'move' });
    commit(edit(store, 3, { x: 1 }), { label: 'nudge' });
    store.apply(edit(store, 3, { x: 2 }), 'remote');
    expect(history.undo()?.label).toBe('move');
    expect([present(store, 2).x, present(store, 3).x]).toStrictEqual([200, 2]);
    expect([history.canUndo, history.canRedo]).toStrictEqual([false, true]);
    expect(history.redo()?.label).toBe('move');
    expect(history.redo()).toBeNull();
  });

  it('remove an element that the entry added, even when a remote change set changed it since', () => {
    const { store, history, commit } = recorder(fixtureStore());
    commit(changeSet([{ type: 'add', element: { ...present(store, 3), id: e(20) } }]));
    store.apply(edit(store, 20, { x: 42 }), 'remote');
    history.undo();
    expect(store.get(e(20))).toBeUndefined();
    history.redo();
    expect(present(store, 20).x).toBe(42);
  });

  it('leave out a change that the store refuses since another origin changed the document', () => {
    const { store, history, commit } = recorder(fixtureStore());
    commit(
      changeSet(
        [{ type: 'update', id: e(2), before: { x: 200 }, after: { x: 300 } }],
        [{ type: 'add', group: { id: g(5) } }],
      ),
    );
    store.apply(
      changeSet([{ type: 'add', element: { ...present(store, 3), id: e(21), group: g(5) } }]),
      'remote',
    );
    const undone = history.undo();
    expect(present(store, 2).x).toBe(200);
    expect(store.group(g(5))).toStrictEqual({ id: g(5) });
    expect(undone?.changes.groups).toStrictEqual([]);
    history.redo();
    expect(present(store, 2).x).toBe(300);
  });

  it('REQ-K01 never record what another origin applied: remote and load sets make no entry', () => {
    const { store, history } = recorder(fixtureStore());
    store.apply(edit(store, 2, { x: 300 }), 'remote');
    store.apply(changeSet([{ type: 'add', element: { ...present(store, 3), id: e(20) } }]), 'load');
    store.apply(edit(store, 3, { x: 1 }), 'local', { transient: true });
    expect([history.canUndo, history.canRedo]).toStrictEqual([false, false]);
    expect(history.undo()).toBeNull();
    expect(present(store, 2).x).toBe(300);
  });
});
