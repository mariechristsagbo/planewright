import { describe, expect, it } from 'vitest';

import type { HistorySelection } from '../../../src/history/entry.ts';
import { createHistory } from '../../../src/history/history.ts';
import type { History } from '../../../src/history/history.ts';
import type { ElementId } from '../../../src/model/ids.ts';
import type { SceneStore } from '../../../src/scene/store.ts';
import { createManualClock } from '../../support/fakes.ts';
import { AUTHOR } from '../../support/scene-state.ts';
import { edit, fixtureStore, present } from '../../support/stores.ts';

// The history reads and restores the selection through a port that the editor provides; a port
// that throws must never leave the history open or its steps half done (ENG-04 review, m1).

interface FailingSelection extends HistorySelection {
  ids: readonly ElementId[];
  failGet: boolean;
  failSet: boolean;
}

function failingSelection(): FailingSelection {
  const port: FailingSelection = {
    ids: [],
    failGet: false,
    failSet: false,
    get: () => {
      if (port.failGet) throw new Error('the selection reader failed');
      return port.ids;
    },
    set: (ids) => {
      if (port.failSet) throw new Error('the selection writer failed');
      port.ids = ids;
    },
  };
  return port;
}

function historyOver(store: SceneStore, selection: HistorySelection): History {
  let seq = 100;
  return createHistory({
    store,
    clock: createManualClock(),
    selection,
    stamp: () => ({ author: AUTHOR, seq: (seq += 1) }),
  });
}

describe('a selection reader that throws while a transaction opens', () => {
  it('leaves the history closed, so the next begin, undo and redo work', () => {
    const store = fixtureStore();
    const selection = failingSelection();
    const history = historyOver(store, selection);
    selection.failGet = true;
    expect(() => history.begin()).toThrow('the selection reader failed');
    expect(history.inTransaction).toBe(false);
    selection.failGet = false;
    const transaction = history.begin();
    transaction.preview(edit(store, 2, { x: 300 }));
    expect(transaction.commit('move')).not.toBeNull();
    expect(history.undo()).not.toBeNull();
    expect(present(store, 2).x).toBe(200);
    expect(history.redo()).not.toBeNull();
    expect(present(store, 2).x).toBe(300);
  });
});
