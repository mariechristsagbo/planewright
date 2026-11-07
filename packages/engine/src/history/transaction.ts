import type { ElementId } from '../model/ids.ts';
import type { Clock } from '../ports/ports.ts';
import type { ChangeSet, ChangeStamp } from '../scene/change-set.ts';
import type { SceneStore } from '../scene/store.ts';
import { openTransaction } from '../scene/transaction.ts';
import type { HistoryEntry, HistoryLabel, HistorySelection } from './entry.ts';

// The history's transaction (docs/architecture/engine/history.md#transactions): the scene's
// transaction, with the label, the merge key and the one call that records an entry.

export interface CommitOptions {
  /** Entries with the same key within one burst merge into one (REQ-T10). */
  readonly mergeKey?: string;
}

export interface Transaction {
  /** Applies a transient change: drawn and hit-tested, not recorded or saved. */
  preview(changes: ChangeSet): void;
  /**
   * Reverts the previews, applies their net change set once and records it, with the label, the
   * merge key, the selection when the transaction opened and now, and the clock's time. Returns
   * the entry it recorded, before any merge, or null when nothing changed.
   */
  commit(label: HistoryLabel, options?: CommitOptions): HistoryEntry | null;
  /** Reverts every preview. */
  cancel(): void;
}

export interface TransactionOptions {
  readonly store: SceneStore;
  readonly clock: Clock;
  readonly selection: HistorySelection;
  /** The stamp of the next local change set: the session's client and its next number. */
  readonly stamp: () => ChangeStamp;
}

/** What the history gives the transaction it opens. */
export interface TransactionOwner {
  readonly record: (entry: HistoryEntry) => void;
  /** Called once, when the transaction has closed. */
  readonly ended: () => void;
}

/**
 * Opens a transaction over the scene's, reading the selection before. Its commit records through
 * the owner every net set that the store comes to hold, even when a listener of it throws; a
 * commit or cancel whose revert the store refuses leaves it open, so the owner learns that it has
 * ended only once the scene's transaction has closed.
 */
export function openHistoryTransaction(
  options: TransactionOptions,
  owner: TransactionOwner,
): Transaction {
  const scene = openTransaction(options.store);
  const selectionBefore: readonly ElementId[] = [...options.selection.get()];
  let ended = false;
  const closing = (step: () => void): void => {
    try {
      step();
    } finally {
      if (!ended && !scene.open) {
        ended = true;
        owner.ended();
      }
    }
  };
  return {
    preview: (changes) => {
      scene.preview(changes);
    },
    commit(label, commitOptions) {
      const selectionAfter: readonly ElementId[] = [...options.selection.get()];
      const time = options.clock.now();
      const mergeKey = commitOptions?.mergeKey;
      const recorded: HistoryEntry[] = [];
      closing(() => {
        scene.commit(options.stamp(), (changes) => {
          const keyed = mergeKey === undefined ? {} : { mergeKey };
          const entry = { label, changes, selectionBefore, selectionAfter, ...keyed, time };
          recorded.push(entry);
          owner.record(entry);
        });
      });
      return recorded[0] ?? null;
    },
    cancel: () => {
      closing(() => {
        scene.cancel();
      });
    },
  };
}
