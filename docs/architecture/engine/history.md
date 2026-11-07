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
  wraps it. The net set takes the editor session's next stamp and the entry the `Clock` port's
  time; the history records the set as soon as the store holds it, even when a listener of that
  set throws, and `commit` returns the entry it recorded, before any merge.
- The labels have none for a link edit; the issue that adds the link command adds one.
- Only one transaction is open at a time. Undo and redo requested while one is open are ignored
  (REQ-H06). `History.begin` opens it, and opening another throws until it has closed. A commit or
  cancel whose revert the store refuses leaves it open
  ([transient previews](scene-and-viewport.md#transient-previews)), so undo and redo stay ignored
  until it is retried or cancelled.

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
  readonly inTransaction: boolean;
  begin(): Transaction;
  record(entry: HistoryEntry): void;
  undo(): HistoryEntry | null;
  redo(): HistoryEntry | null;
  clear(): void;
}
```

- `record` pushes an entry and clears the redo stack. An entry whose `mergeKey` equals the top
  entry's and which arrives within the same burst (the same held key, or one continuous control
  drag, ending at most 1 s after the last part) is merged into it: the older `before` and the newer
  `after` (REQ-T10). Two parts merge only when the newer starts from what the older left: a field
  that another origin changed in between keeps them apart, so a merge never takes a remote value
  back, and so does a pair that no single change expresses, such as an element removed and added
  again. An undo, a redo or a clear ends a burst; a commit that changes nothing records nothing,
  so the 1 s runs from the last recorded part; and a burst that ends where it began leaves no
  entry. The merged entry keeps the first part's label and selection before, and the last part's
  selection after and time. `record` ignores an entry that changes nothing.
- The history reads and restores the selection through a `HistorySelection` (`get` and `set`),
  which the selection layer (ENG-06) and the editor provide: the selection before is read when the
  transaction opens and the selection after when it commits.
- Undo applies the inverse of the top entry with the `history` origin and sets the selection to
  `selectionBefore` filtered to elements that exist; redo re-applies it and sets `selectionAfter`
  (REQ-S13, REQ-T09). Neither touches the camera or the tool (REQ-V10, REQ-H05). Each applies its
  set with a new stamp, and the entry moves to the other stack holding only the part that was
  applied, which `undo` and `redo` return. A scene listener that throws never leaves either half
  done: the entry moves and the selection is restored before the error is rethrown; undo asked
  while the store tells a listener of a set throws and changes nothing.
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

ENG-04 decided what the accepted rules leave open:

- A removal applies to the element or group as it is now, so undoing an addition removes the
  element even when another origin has changed its fields since, as the table says.
- P0 builds no derived changes yet (P1 re-routes connectors). Until then, where another origin's
  change makes the applied part invalid, such as a group to remove that a remote element now uses
  or an element to add again whose group is gone, the changes that the store refuses are left out
  and the rest is tried again, until a set applies or nothing is left. Undo and redo therefore
  never throw for a conflict and never break the store's invariants.
- The rule compares values, so a remote change that puts back the very value the entry left (A,
  then B, then A again) is undone like a field nobody touched. Telling them apart needs per-field
  provenance, which is left to the collaboration decision.

## Availability

`canUndo` and `canRedo` drive the Undo and Redo controls and commands: both are false when an
editor starts and after a reload (REQ-H02, REQ-H03); `canUndo` becomes true with the first entry;
`canRedo` becomes true after an undo and false after a new entry. Each undo and redo is announced
with its label and element count, for example "Undid move of 2 elements" (REQ-Y04). Both flags
follow the stacks, also while a transaction is open; an entry that another origin has left with
nothing to apply is found to be so only when undo reaches it, so only then can `canUndo` be true
while `undo` returns `null`.

## Limits

History holds at most 500 entries and an estimated 50 MB of change data; past either limit the
oldest entries are dropped. It is never saved (REQ-H03). The estimate is two bytes per character of
an entry's change set as JSON, measured once per entry, against 50,000,000 bytes. The limits are
applied when an entry is recorded, when the redo stack is empty, and the newest entry always stays,
however large.

## Properties the tests check

- For any valid change set `c` applied to a document `d`, undo then redo returns a document equal
  to `apply(d, c)`, and undo alone returns `d`.
- Merging a burst gives the same document as applying its parts in order.
- With changes of the `remote` origin interleaved, undo never changes a field the remote change
  set touched after the entry: changed, not written again with the same value, and the A, B, A
  case above aside.

## Requirements served

REQ-C13, REQ-H01 to REQ-H07, REQ-K03, REQ-S13, REQ-T09 to REQ-T11, REQ-V10 and REQ-Y04.
