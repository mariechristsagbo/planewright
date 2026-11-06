import { invertChangeSet } from './change-set.ts';
import type { ChangeSet, ChangeStamp } from './change-set.ts';
import type { SceneStore } from './store.ts';
import { netChanges, noTouches, remember, touchedBy } from './touches.ts';

/**
 * The scene's part of a transaction (docs/architecture/engine/history.md#transactions): previews,
 * and the revert and net change set that end them. Recording the net set is the history's.
 */
export interface SceneTransaction {
  /** Applies a transient change set: drawn and hit-tested, never recorded or saved. */
  preview(changes: ChangeSet): void;
  /**
   * Reverts the previews with one transient change and applies their net change set once, with the
   * `local` origin and the given stamp; returns that set, or null when nothing changed.
   */
  commit(stamp: ChangeStamp): ChangeSet | null;
  /** Reverts every preview with one transient change. */
  cancel(): void;
}

const isEmpty = ({ elements, groups, canvas }: ChangeSet): boolean =>
  elements.length === 0 && groups.length === 0 && canvas === undefined;

/**
 * Opens a transaction over the store. Each preview is applied as a transient `local` change, and
 * the transaction remembers the first value of every field it touched. On commit the store goes
 * back to the start of every touched field, so the net set's `before` check holds, and the net set
 * is applied once; on cancel only the revert is applied. Both run before the next frame, so the
 * reverted state is never drawn. A transaction is used once.
 */
export function openTransaction(store: SceneStore): SceneTransaction {
  const touches = noTouches();
  let open = true;
  let last: ChangeStamp | undefined;
  const ensureOpen = (): void => {
    if (!open) {
      throw new Error('The transaction is closed: it was committed or cancelled.');
    }
  };
  const revert = (net: ChangeSet): void => {
    store.apply(invertChangeSet(net), 'local', { transient: true });
  };
  return {
    preview(changes) {
      ensureOpen();
      const touched = touchedBy(touches, store, changes);
      store.apply(changes, 'local', { transient: true });
      remember(touches, touched);
      last = { author: changes.author, seq: changes.seq };
    },
    commit(stamp) {
      ensureOpen();
      open = false;
      const net = { ...netChanges(touches, store), ...stamp };
      if (isEmpty(net)) {
        return null;
      }
      revert(net);
      store.apply(net, 'local');
      return net;
    },
    cancel() {
      ensureOpen();
      open = false;
      const net = last === undefined ? undefined : { ...netChanges(touches, store), ...last };
      if (net !== undefined && !isEmpty(net)) revert(net);
    },
  };
}
