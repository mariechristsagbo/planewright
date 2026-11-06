# Undo and redo history

This document specifies transactions, history entries and the rules of undo and redo
([ADR 0007](../../adr/0007-history-model.md)). Change sets and transient previews are defined in
[scene and viewport](scene-and-viewport.md#change-sets).

## Transactions

```ts
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

export interface Transaction {
  /** Apply a transient change: drawn and hit-tested, not recorded or saved. */
  preview(changes: ChangeSet): void;
  /** Revert the previews, apply their net change set once and record it; null if unchanged. */
  commit(label: HistoryLabel, options?: { readonly mergeKey?: string }): HistoryEntry | null;
  /** Revert every preview. */
  cancel(): void;
}
```

- A gesture opens one transaction on its first preview and closes it on release, Escape, a second
  touch pointer or a lost focus; a command opens and commits one at once.
- The net change set compares, per touched field, the first `before` with the current value; fields
  that ended where they started drop out. A tap with the Selection tool or a zero-length move
  therefore records nothing.
- `commit` is the only place that records: it reverts the previews with a transient change,
  applies the net change set with the `local` origin
  ([transient previews](scene-and-viewport.md#transient-previews)) and calls `History.record` with
  the label, the merge key and the selection before and after. The scene layer supplies the revert
  and the net set (ENG-03): its transaction previews, cancels, and commits with a stamp, returning
  the net set it applied or `null`; recording is the history layer's (ENG-04), whose `Transaction`
  wraps it.
- Only one transaction is open at a time. Undo and redo requested while one is open are ignored
  (REQ-H06).

## Entries and selection

```ts
export interface HistoryEntry {
  readonly label: HistoryLabel;
  readonly changes: ChangeSet;
  readonly selectionBefore: readonly ElementId[];
  readonly selectionAfter: readonly ElementId[];
  readonly mergeKey?: string;
  readonly time: number;
}

export interface History {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  record(entry: HistoryEntry): void;
  undo(): HistoryEntry | null;
  redo(): HistoryEntry | null;
  clear(): void;
}
```

- `record` pushes an entry and clears the redo stack. An entry whose `mergeKey` equals the top
  entry's and which arrives within the same burst (the same held key, or one continuous control
  drag, ending at most 1 s after the last part) is merged into it: the older `before` and the newer
  `after` (REQ-T10).
- Undo applies the inverse of the top entry with the `history` origin and sets the selection to
  `selectionBefore` filtered to elements that exist; redo re-applies it and sets `selectionAfter`
  (REQ-S13, REQ-T09). Neither touches the camera or the tool (REQ-V10, REQ-H05).
- Selection-only changes, camera moves, view toggles, theme and preference changes, and saving
  never call `record` (REQ-S13, REQ-H04).

## Conflict-safe undo

Undo and redo apply a change only where the document still holds the value the entry left there
(REQ-K03):

| Change in the entry | Undo applies                                                        | Redo applies                                                   |
| ------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------- |
| update              | each field whose current value equals `after` goes back to `before` | each field whose current value equals `before` goes to `after` |
| add                 | removes the element if it still exists                              | adds it again if its identifier is free                        |
| remove              | adds the element again if its identifier is free                    | removes it if it still exists                                  |

With one user every condition holds, so undo and redo are exact. When another origin has changed a
field since, that field keeps the other value. An entry that has nothing left to apply is dropped
and undo continues with the next entry, so pressing Undo always changes something when the stack is
not empty. The applied part is completed with its derived changes, like any change set, before it
is applied.

## Availability

`canUndo` and `canRedo` drive the Undo and Redo controls and commands: both are false when an
editor starts and after a reload (REQ-H02, REQ-H03); `canUndo` becomes true with the first entry;
`canRedo` becomes true after an undo and false after a new entry. Each undo and redo is announced
with its label and element count, for example "Undid move of 2 elements" (REQ-Y04).

## Limits

History holds at most 500 entries and an estimated 50 MB of change data; past either limit the
oldest entries are dropped. It is never saved (REQ-H03).

## Properties the tests check

- For any valid change set `c` applied to a document `d`, undo then redo returns a document equal
  to `apply(d, c)`, and undo alone returns `d`.
- Merging a burst gives the same document as applying its parts in order.
- With changes of the `remote` origin interleaved, undo never changes a field the remote change
  set touched after the entry.

## Requirements served

REQ-C13, REQ-H01 to REQ-H07, REQ-K03, REQ-S13, REQ-T09 to REQ-T11, REQ-V10 and REQ-Y04.
