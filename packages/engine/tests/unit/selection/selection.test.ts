import { describe, expect, it } from 'vitest';

import { createHistory } from '../../../src/history/history.ts';
import { createSelection } from '../../../src/selection/selection.ts';
import { createManualClock } from '../../support/fakes.ts';
import { AUTHOR, changeSet } from '../../support/scene-state.ts';
import { edit, fixtureId, fixtureStore, present } from '../../support/stores.ts';

const e = fixtureId;
const removal = (store: ReturnType<typeof fixtureStore>, index: number) =>
  changeSet([{ type: 'remove', element: present(store, index) }]);

describe('the selection state', () => {
  it('starts empty and is replaced by the given elements that the scene holds, each once', () => {
    const selection = createSelection(fixtureStore());
    expect(selection.get()).toStrictEqual([]);
    selection.set([e(3), e(1), e(3), e(42), e(2)]);
    expect(selection.get()).toStrictEqual([e(3), e(1), e(2)]);
  });

  it('adds elements after those already selected, and removes and clears them', () => {
    const selection = createSelection(fixtureStore());
    selection.set([e(2)]);
    selection.add([e(4), e(2), e(42), e(0)]);
    expect(selection.get()).toStrictEqual([e(2), e(4), e(0)]);
    selection.remove([e(4), e(9)]);
    expect(selection.get()).toStrictEqual([e(2), e(0)]);
    selection.clear();
    expect(selection.get()).toStrictEqual([]);
  });

  it('never holds a removed element, whatever removed it, and keeps the updated ones', () => {
    const store = fixtureStore();
    const selection = createSelection(store);
    selection.set([e(2), e(3), e(4)]);
    store.apply(edit(store, 2, { x: 5 }), 'remote');
    expect(selection.get()).toStrictEqual([e(2), e(3), e(4)]);
    store.apply(removal(store, 3), 'remote');
    expect(selection.get()).toStrictEqual([e(2), e(4)]);
    store.apply(removal(store, 4), 'local', { transient: true });
    expect(selection.get()).toStrictEqual([e(2)]);
  });

  it('stops following the scene once disposed', () => {
    const store = fixtureStore();
    const selection = createSelection(store);
    selection.set([e(2)]);
    selection.dispose();
    store.apply(removal(store, 2), 'remote');
    expect(selection.get()).toStrictEqual([e(2)]);
  });
});

describe('the selection as the history reads and restores it', () => {
  it('REQ-S13 is never an undo step, and undo and redo restore it around each entry', () => {
    const store = fixtureStore();
    const selection = createSelection(store);
    let seq = 100;
    const history = createHistory({
      store,
      clock: createManualClock(),
      selection,
      stamp: () => ({ author: AUTHOR, seq: (seq += 1) }),
    });
    selection.set([e(2)]);
    expect(history.canUndo).toBe(false);
    const transaction = history.begin();
    transaction.preview(edit(store, 2, { x: 300 }));
    selection.set([e(3)]);
    transaction.commit('move');
    selection.set([e(4)]);
    history.undo();
    expect(selection.get()).toStrictEqual([e(2)]);
    history.redo();
    expect(selection.get()).toStrictEqual([e(3)]);
  });
});
