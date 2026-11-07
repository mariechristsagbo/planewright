import type { ElementId } from '../model/ids.ts';
import { invertChangeSet, isEmptyChangeSet } from '../scene/change-set.ts';
import type { ChangeSet, ChangeStamp } from '../scene/change-set.ts';
import { rethrowFirst } from '../scene/listener-errors.ts';
import type { SceneStore } from '../scene/store.ts';
import { applicablePart } from './conflict.ts';
import type { HistoryEntry, HistorySelection } from './entry.ts';
import { applyWhatFits } from './fit.ts';
import { mergeChangeSets } from './merge.ts';

// The undo and redo history (docs/architecture/engine/history.md): the entries of committed
// transactions, merged within a burst, and undone and redone where the document still allows it.

export interface HistoryLimits {
  readonly entries: number;
  /** The entries' estimated size: two bytes per character of their change sets' JSON. */
  readonly bytes: number;
}

/** At most 500 entries and an estimated 50 MB of change data; past either, the oldest go. */
export const HISTORY_LIMITS: HistoryLimits = { entries: 500, bytes: 50_000_000 };

/** A burst ends when its next part comes more than 1 s after the last one (REQ-T10). */
export const BURST_MS = 1_000;

export interface History {
  /** Whether there is an entry to undo: false when an editor starts (REQ-H02). */
  readonly canUndo: boolean;
  /** Whether there is an entry to redo: true after an undo, false after a new entry. */
  readonly canRedo: boolean;
  /**
   * Pushes an entry, or merges it into the top one when both are parts of one burst, and clears
   * the redo stack. An entry that changes nothing is ignored.
   */
  record(entry: HistoryEntry): void;
  /**
   * Applies, with the `history` origin, the part of the top entry's inverse that still applies,
   * restores its selection before, and returns the entry with that part; an entry with nothing
   * left is dropped for the next one. Returns null when nothing was undone.
   */
  undo(): HistoryEntry | null;
  /** Like undo, with the top undone entry itself and its selection after. */
  redo(): HistoryEntry | null;
  clear(): void;
}

export interface HistoryOptions {
  readonly store: SceneStore;
  readonly selection: HistorySelection;
  /** The stamp of the next local change set: the session's client and its next number. */
  readonly stamp: () => ChangeStamp;
  /** {@link HISTORY_LIMITS} unless a test sets others. */
  readonly limits?: HistoryLimits;
}

interface State {
  readonly options: HistoryOptions;
  readonly limits: HistoryLimits;
  /** The entries to undo, the next one last. */
  readonly done: HistoryEntry[];
  /** The entries to redo, the next one last. */
  readonly undone: HistoryEntry[];
  /** Whether the next entry may merge into the top one: not after an undo, a redo or a clear. */
  mergeable: boolean;
}

const sizes = new WeakMap<HistoryEntry, number>();

/** An entry's estimated size, measured once. */
function sizeOf(entry: HistoryEntry): number {
  const known = sizes.get(entry);
  if (known !== undefined) {
    return known;
  }
  const size = JSON.stringify(entry.changes).length * 2;
  sizes.set(entry, size);
  return size;
}

/** Drops the oldest entries past either limit; the newest one always stays. */
function trim({ done, limits }: State): void {
  const measured = done.map(sizeOf);
  let bytes = measured.reduce((sum, size) => sum + size, 0);
  let dropped = 0;
  for (const size of measured) {
    const kept = done.length - dropped;
    if (kept === 1 || (kept <= limits.entries && bytes <= limits.bytes)) break;
    bytes -= size;
    dropped += 1;
  }
  done.splice(0, dropped);
}

/** The top entry merged with `entry`, when both carry one merge key and are parts of one burst. */
function mergedWithTop({ done, mergeable }: State, entry: HistoryEntry): HistoryEntry | undefined {
  const top = done.at(-1);
  if (
    !mergeable ||
    top?.mergeKey === undefined ||
    top.mergeKey !== entry.mergeKey ||
    entry.time - top.time > BURST_MS
  ) {
    return undefined;
  }
  const changes = mergeChangeSets(top.changes, entry.changes);
  return changes === undefined
    ? undefined
    : { ...top, changes, selectionAfter: entry.selectionAfter, time: entry.time };
}

function record(state: State, entry: HistoryEntry): void {
  if (isEmptyChangeSet(entry.changes)) {
    return;
  }
  const merged = mergedWithTop(state, entry);
  if (merged !== undefined) state.done.pop();
  const next = merged ?? entry;
  // A burst that ends where it began leaves nothing to undo, and the next part starts afresh.
  state.mergeable = !isEmptyChangeSet(next.changes);
  if (state.mergeable) state.done.push(next);
  state.undone.length = 0;
  trim(state);
}

/** Applies the part of a set that still applies, stamped anew; returns what was applied. */
function applyPart({ options }: State, changes: ChangeSet, failures: unknown[]): ChangeSet | null {
  const part = { ...applicablePart(changes, options.store), ...options.stamp() };
  return applyWhatFits(options.store, part, 'history', failures);
}

function restoreSelection({ options }: State, ids: readonly ElementId[]): void {
  options.selection.set(ids.filter((id) => options.store.get(id) !== undefined));
}

/**
 * One undo or redo: the top entry's part that still applies is applied, the entry moves to the
 * other stack holding only that part, and its selection is restored; an entry with nothing left
 * is dropped. A listener's error is rethrown once all of that is done.
 */
function step(state: State, undoing: boolean): HistoryEntry | null {
  const [from, to] = undoing ? [state.done, state.undone] : [state.undone, state.done];
  const failures: unknown[] = [];
  state.mergeable = false;
  for (let top = from.at(-1); top !== undefined; top = from.at(-1)) {
    const applied = applyPart(
      state,
      undoing ? invertChangeSet(top.changes) : top.changes,
      failures,
    );
    from.pop();
    if (applied !== null) {
      const entry = { ...top, changes: undoing ? invertChangeSet(applied) : applied };
      to.push(entry);
      restoreSelection(state, undoing ? entry.selectionBefore : entry.selectionAfter);
      rethrowFirst(failures);
      return entry;
    }
  }
  return null;
}

/**
 * An empty history over the store, which holds at most its limits and is never saved (REQ-H03).
 * Undo and redo never touch the camera or the tool (REQ-V10, REQ-H05).
 */
export function createHistory(options: HistoryOptions): History {
  const state: State = {
    options,
    limits: options.limits ?? HISTORY_LIMITS,
    done: [],
    undone: [],
    mergeable: false,
  };
  return {
    get canUndo() {
      return state.done.length > 0;
    },
    get canRedo() {
      return state.undone.length > 0;
    },
    record: (entry) => {
      record(state, entry);
    },
    undo: () => step(state, true),
    redo: () => step(state, false),
    clear() {
      state.done.length = 0;
      state.undone.length = 0;
      state.mergeable = false;
    },
  };
}
