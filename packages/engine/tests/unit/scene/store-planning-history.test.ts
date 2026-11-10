import { describe, expect, it } from 'vitest';

import type { HistoryEntry } from '../../../src/history/entry.ts';
import { createHistory } from '../../../src/history/history.ts';
import type { History } from '../../../src/history/history.ts';
import type { ElementId } from '../../../src/model/ids.ts';
import type { ChangeSetError } from '../../../src/scene/store.ts';
import type { SceneStore } from '../../../src/scene/store.ts';
import { createManualClock } from '../../support/fakes.ts';
import {
  PATHS,
  PLANNING_REFUSAL,
  expectRefusedForPlanning,
  readingStyle,
  refusedPlain,
  thrownBy,
  watched,
} from '../../support/planning-sets.ts';
import { AUTHOR } from '../../support/scene-state.ts';
import { expectNoneWritten, expectUnchanged, heldBy } from '../../support/store-model.ts';
import { edit, fixtureStore, present } from '../../support/stores.ts';

// The history, previewing, committing, undoing or redoing from a value that runs code while the
// store plans a set (issue 45): the store refuses its apply as it refuses any other, so the
// transaction and the history stay as they were, and the transaction still commits its previews
// afterwards.

const STAMP = { author: AUTHOR, seq: 45 };

/** A history over the store that stamps every set alike, so that two runs record equal entries. */
function historyOver(store: SceneStore): History {
  let selection: readonly ElementId[] = [];
  return createHistory({
    store,
    clock: createManualClock(),
    selection: {
      get: () => selection,
      set: (ids) => {
        selection = ids;
      },
    },
    stamp: () => STAMP,
  });
}

const flags = (history: History) => [history.inTransaction, history.canUndo, history.canRedo];

/** The entry that a transaction moving the fixture's line to 900 records, on a store of its own. */
function movedLineEntry(): HistoryEntry | null {
  const store = fixtureStore();
  const transaction = historyOver(store).begin();
  transaction.preview(edit(store, 3, { x: 900 }));
  return transaction.commit('move');
}

describe('a history transaction, called while the store plans a set', () => {
  it.each(PATHS)('cannot preview while the store plans %s', (_, setOf) => {
    const { store, held, told } = watched();
    const history = historyOver(store);
    const transaction = history.begin();
    const refusals: unknown[] = [];
    const style = readingStyle(
      present(store, 2).style,
      () => {
        refusals.push(
          thrownBy(() => {
            transaction.preview(edit(store, 3, { x: 900 }));
          }),
        );
      },
      true,
    );
    const thrown = thrownBy(() => {
      store.apply(setOf(store, style), 'local');
    });
    expect((thrown as ChangeSetError).errors).toStrictEqual(refusedPlain(setOf));
    expectRefusedForPlanning(refusals);
    expectUnchanged(store, held);
    expect(told).toStrictEqual([]);
    expect(flags(history)).toStrictEqual([true, false, false]);
    expect(transaction.commit('move')).toBeNull();
    expect(flags(history)).toStrictEqual([false, false, false]);
  });

  it.each(PATHS)('cannot commit while the store plans %s, and commits later', (_, setOf) => {
    const { store, told } = watched();
    const history = historyOver(store);
    const transaction = history.begin();
    transaction.preview(edit(store, 3, { x: 900 }));
    const held = heldBy(store);
    const refusals: unknown[] = [];
    const style = readingStyle(
      present(store, 2).style,
      () => {
        refusals.push(thrownBy(() => transaction.commit('move')));
      },
      true,
    );
    const thrown = thrownBy(() => {
      store.apply(setOf(store, style), 'local');
    });
    expect((thrown as ChangeSetError).errors).toStrictEqual(refusedPlain(setOf));
    expectRefusedForPlanning(refusals);
    expectUnchanged(store, held);
    expectNoneWritten(held);
    expect(told.map(({ rev }) => rev)).toStrictEqual([2]);
    expect(flags(history)).toStrictEqual([true, false, false]);
    expect(transaction.commit('move')).toStrictEqual(movedLineEntry());
    expect(flags(history)).toStrictEqual([false, true, false]);
    history.undo();
    expect(present(store, 3).x).toBe(300);
  });

  it.each(['preview', 'commit'] as const)(
    'fails the set and changes nothing when a refused %s leaves the getter',
    (call) => {
      const { store, told } = watched();
      const history = historyOver(store);
      const transaction = history.begin();
      transaction.preview(edit(store, 3, { x: 900 }));
      const held = heldBy(store);
      const style = readingStyle(
        present(store, 2).style,
        () => {
          if (call === 'preview') transaction.preview(edit(store, 3, { x: 950 }));
          else transaction.commit('move');
        },
        false,
      );
      expect(() => {
        store.apply(edit(store, 2, { style }), 'local');
      }).toThrow(PLANNING_REFUSAL);
      expectUnchanged(store, held);
      expect(told).toHaveLength(1);
      expect(flags(history)).toStrictEqual([true, false, false]);
      expect(transaction.commit('move')).toStrictEqual(movedLineEntry());
    },
  );

  it.each(['undo', 'redo'] as const)(
    'cannot %s while the store plans a set, and leaves the stacks as they were',
    (step) => {
      const { store, told } = watched();
      const history = historyOver(store);
      const transaction = history.begin();
      transaction.preview(edit(store, 3, { x: 900 }));
      transaction.commit('move');
      if (step === 'redo') history.undo();
      const held = heldBy(store);
      const [before, toldBefore] = [flags(history), told.length];
      const refusals: unknown[] = [];
      const style = readingStyle(
        present(store, 2).style,
        () => {
          refusals.push(thrownBy(() => history[step]()));
        },
        true,
      );
      const thrown = thrownBy(() => {
        store.apply(edit(store, 2, { style }), 'local');
      });
      expect((thrown as ChangeSetError).errors).toStrictEqual([
        { path: 'elements[0].after.style.extra', problem: 'unknown-field' },
      ]);
      expectRefusedForPlanning(refusals);
      expectUnchanged(store, held);
      expect(told).toHaveLength(toldBefore);
      expect(flags(history)).toStrictEqual(before);
      expect(history[step]()).not.toBeNull();
      expect(present(store, 3).x).toBe(step === 'undo' ? 300 : 900);
    },
  );
});
