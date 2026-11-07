import { invertChangeSet } from './change-set.ts';
import type { ChangeSet, ChangeStamp } from './change-set.ts';
import { keepListenerErrors, rethrowFirst } from './listener-errors.ts';
import type { SceneStore } from './store.ts';
import { netChanges, noTouches, remember, touchedBy } from './touches.ts';

/**
 * The scene's part of a transaction (docs/architecture/engine/history.md#transactions): previews,
 * and the revert and net change set that end them. Recording the net set is the history's.
 */
export interface SceneTransaction {
  /**
   * Whether it can still preview, commit or cancel: until a commit or a cancel has applied its
   * revert, or found nothing to revert. A revert that the store refuses leaves it open.
   */
  readonly open: boolean;
  /** Applies a transient change set: drawn and hit-tested, never recorded or saved. */
  preview(changes: ChangeSet): void;
  /**
   * Reverts the previews with one transient change and applies their net change set once, with the
   * `local` origin and the given stamp; returns that set, or null when nothing changed. `applied`
   * receives the set as soon as the store holds it, before a listener's error is rethrown, so that
   * the history can record every set that the document holds.
   */
  commit(stamp: ChangeStamp, applied?: (net: ChangeSet) => void): ChangeSet | null;
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
 *
 * A listener that throws never leaves it half done: a preview the store applied is remembered,
 * and a commit whose revert is applied also applies the net set; the first listener error is then
 * rethrown. A revert that the store refuses throws and changes nothing, and the transaction stays
 * open with its previews in place, so that the caller can preview again, commit or cancel.
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
  const apply = (failures: unknown[], step: () => void): void => {
    keepListenerErrors(store, failures, step);
  };
  const revert = (net: ChangeSet, failures: unknown[]): void => {
    apply(failures, () => {
      store.apply(invertChangeSet(net), 'local', { transient: true });
    });
  };
  return {
    get open() {
      return open;
    },
    preview(changes) {
      ensureOpen();
      const touched = touchedBy(touches, store, changes);
      const failures: unknown[] = [];
      apply(failures, () => {
        store.apply(changes, 'local', { transient: true });
      });
      remember(touches, touched);
      last = { author: changes.author, seq: changes.seq };
      rethrowFirst(failures);
    },
    commit(stamp, applied) {
      ensureOpen();
      const net = { ...netChanges(touches, store), ...stamp };
      const failures: unknown[] = [];
      if (!isEmpty(net)) revert(net, failures);
      open = false;
      if (isEmpty(net)) return null;
      apply(failures, () => {
        store.apply(net, 'local');
      });
      applied?.(net);
      rethrowFirst(failures);
      return net;
    },
    cancel() {
      ensureOpen();
      const net = last === undefined ? undefined : { ...netChanges(touches, store), ...last };
      const failures: unknown[] = [];
      if (net !== undefined && !isEmpty(net)) revert(net, failures);
      open = false;
      rethrowFirst(failures);
    },
  };
}
