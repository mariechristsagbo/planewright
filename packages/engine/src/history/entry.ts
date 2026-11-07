import type { ElementId } from '../model/ids.ts';
import type { ChangeSet } from '../scene/change-set.ts';

// History entries (docs/architecture/engine/history.md#entries-and-selection).

/** What an entry did, for the Undo and Redo controls and announcements. */
export type HistoryLabel =
  | 'create'
  | 'move'
  | 'resize'
  | 'rotate'
  | 'duplicate'
  | 'delete'
  | 'nudge'
  | 'edit-text'
  | 'paste'
  | 'style'
  | 'arrange'
  | 'group'
  | 'ungroup';

/** One undo step: the change set of a committed transaction, with the selection around it. */
export interface HistoryEntry {
  readonly label: HistoryLabel;
  readonly changes: ChangeSet;
  /** The selection when the transaction opened, which undo restores. */
  readonly selectionBefore: readonly ElementId[];
  /** The selection when it committed, which redo restores. */
  readonly selectionAfter: readonly ElementId[];
  /** Entries with the same key within one burst merge into one. */
  readonly mergeKey?: string;
  /** When it was committed, in milliseconds from the clock port. */
  readonly time: number;
}

/**
 * The editor's selection, as the history reads and restores it. The selection layer (ENG-06) and
 * the editor provide it; setting it is never an undo step.
 */
export interface HistorySelection {
  get(): readonly ElementId[];
  set(ids: readonly ElementId[]): void;
}
