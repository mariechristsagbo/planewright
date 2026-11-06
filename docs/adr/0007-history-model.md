# ADR 0007: History as transactional change sets

- Status: Proposed
- Date: 2026-11-06

## Context

The baseline observed that each user operation is one undo step (B-15 to B-18, B-25), that undo
brings back the selection around a change (B-10, B-29, B-34), that toggles, the theme and the
camera are not undo steps (B-37, B-28) and that history does not survive a reload (B-30). A drag
sends hundreds of pointer moves that must become one step. Later, edits from other participants
will arrive between local ones ([ADR 0010](0010-collaboration-ready-change-model.md)).

## Decision

1. **One mutation path.** Every document change is a change set applied by the scene store. An
   element change carries its `before` and `after` values: an addition carries the element, a
   removal the removed element, an update only the fields it changes.
2. **Transactions.** A gesture or command opens a transaction. Previews during a gesture are
   applied as transient changes, which are neither recorded nor saved; committing reverts them,
   applies their net change set once and records it as one history entry, and cancelling reverts
   them (REQ-C13, REQ-T11, REQ-H07). Committing a transaction is the only way an entry is
   recorded.
3. **Entries.** A history entry holds a label, the change set, and the selection before and after.
   Undo applies the inverse and restores the earlier selection, filtered to elements that exist;
   redo re-applies and restores the later one. A new entry clears the redo stack (REQ-H01,
   REQ-H02).
4. **What is not history.** Selection-only changes create no entry (REQ-S13, an intentional
   difference). The camera, view toggles, theme, preferences and the active tool never enter the
   history (REQ-V10, REQ-H04, REQ-H05).
5. **Gestures.** Undo and redo requested during a pointer gesture are ignored (REQ-H06).
6. **Scope and size.** History lives in memory, per editor session, up to 500 entries, and is not
   saved (REQ-H03).
7. **Conflict-safe undo.** Undo restores a field only if its current value still equals the entry's
   `after` value; otherwise that field is left as it is (REQ-K03). With a single user the condition
   always holds. An entry left with nothing to undo is dropped and undo moves to the next one.
8. **Merging.** Entries with the same merge key inside one burst, such as a held arrow key or one
   slider drag, merge into one (REQ-T10).

## Alternatives considered

- **Snapshots of the whole document per step.** Rejected: memory grows with document size, and a
  snapshot cannot be undone selectively once remote changes arrive.
- **Command objects with their own undo methods.** Rejected: every command would have to invert
  itself correctly; inverting generic before/after data is one function, tested once.
- **History saved with the document.** Rejected: not observed, larger saves, and a privacy cost for
  shared files.

## Consequences

- Tools and commands never mutate the store directly; they describe changes.
- The property "undo then redo restores the same document" is tested for random change sets.
- Requirements served: REQ-C13, REQ-H01 to REQ-H07, REQ-K03, REQ-S13, REQ-T10, REQ-T11 and
  REQ-V10.
