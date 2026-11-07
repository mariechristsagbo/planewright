import type { HistoryEntry } from '../../src/history/entry.ts';
import { createHistory } from '../../src/history/history.ts';
import type { History, HistoryLimits } from '../../src/history/history.ts';
import type { ElementId } from '../../src/model/ids.ts';
import type { ChangeSet } from '../../src/scene/change-set.ts';
import type { SceneStore } from '../../src/scene/store.ts';
import { createManualClock } from './fakes.ts';
import type { ManualClock } from './fakes.ts';
import { AUTHOR } from './scene-state.ts';

// A history over a scene store, for the history's tests.

export interface Recorder {
  readonly store: SceneStore;
  readonly history: History;
  /** The clock that gives each committed entry its time; it moves only when the test says so. */
  readonly clock: ManualClock;
  /** The selection, as the test or the history last set it. */
  selection: readonly ElementId[];
  /** Applies a set locally and records it, as a committed transaction does; returns the entry. */
  readonly commit: (changes: ChangeSet, entry?: Partial<HistoryEntry>) => HistoryEntry;
}

/** A history over `store`, stamping its sets with the test's author and sequence numbers from 101. */
export function recorder(store: SceneStore, limits?: HistoryLimits): Recorder {
  let seq = 100;
  const clock = createManualClock();
  const self: Recorder = {
    store,
    clock,
    selection: [],
    history: createHistory({
      store,
      clock,
      selection: {
        get: () => self.selection,
        set: (ids) => {
          self.selection = ids;
        },
      },
      stamp: () => ({ author: AUTHOR, seq: (seq += 1) }),
      ...(limits === undefined ? {} : { limits }),
    }),
    commit: (changes, entry = {}) => {
      store.apply(changes, 'local');
      const recorded: HistoryEntry = {
        label: 'move',
        changes,
        selectionBefore: [],
        selectionAfter: [],
        time: 0,
        ...entry,
      };
      self.history.record(recorded);
      return recorded;
    },
  };
  return self;
}
