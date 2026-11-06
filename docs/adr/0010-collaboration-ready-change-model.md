# ADR 0010: A collaboration-ready change model, without collaboration

- Status: Accepted
- Date: 2026-11-06

## Context

Guest collaboration is a P2 feature (backlog 18). The baseline saw a room link whose key stays in
the URL fragment and a participant count (B-33), and hypothesised client-side encryption; the
session lifecycle and a second client were not observed (R-55). Designing transport, merging and
encryption now would be premature, but the P0 engine must not make them expensive later: retrofitting
a single mutation path, stable identifiers and conflict-free ordering into a finished editor is far
harder than building them in.

## Decision

1. **One apply path with an origin.** Every change set is applied by the scene store with an origin:
   `local`, `history`, `load` or `remote`. Only `local` changes create history entries; `load` and
   `remote` changes never do; autosave saves every origin except `load` (REQ-K01).
2. **Plain data.** Change sets contain only JSON values: no functions, class instances, maps or
   sets. Removing an optional field is written as `null` in a patch, never as `undefined`. A remote
   change set will pass through the same validating decoder as a file.
3. **Authorship.** Each editor session has a random client identifier; each change set carries it
   and a per-client sequence number.
4. **Revisions and order.** Element revisions, order keys, group records and single-sided
   attachments ([ADR 0005](0005-document-model.md)) avoid conflicts over array positions and
   back-references (REQ-K02). Undo skips fields changed by another origin since
   ([ADR 0007](0007-history-model.md), REQ-K03).
5. **Presence is not the document.** Pointer position, selection, name and colour of other
   participants have their own ephemeral type and never enter the document or the history.
6. **Interfaces only.** The engine exports types for a sync port and for presence, with no
   implementation. The protocol package and the collaboration service do not change now.
7. **Deferred to a later ADR.** Transport, the merge policy (per-element or per-field last writer
   wins with a deterministic tie-break, or a CRDT), end-to-end encryption with the key kept out of
   requests (REQ-K04), rooms and server-side persistence are decided under their own issue.

## Alternatives considered

- **Adopt a CRDT library now.** Rejected for P0: a heavy dependency that would shape the model
  before any collaboration requirement is specified.
- **Server-authoritative operational transformation.** Deferred with the rest of the merge policy.

## Consequences

- Integration tests apply change sets with the `remote` origin to prove that they bypass history
  and that undo leaves their values in place.
- The protocol package can later wrap change sets without changing the engine.
- Requirements served: REQ-K01 to REQ-K04.
