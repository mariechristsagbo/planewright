# ADR 0005: Document model

- Status: Accepted
- Date: 2026-11-06

## Context

The engine needs one document model for editing, rendering, saving, the clipboard and, later,
collaboration. The baseline shows the relations that users observe: an element's box and rotation
(B-01, B-16, B-17), drawing order changed by layer commands (B-24), labels that move and copy with
their shape (B-07, B-13), groups that select and move as one (B-22), arrow ends bound to shapes
(B-04) and deleted elements that are not kept (B-30). The [hypotheses](../reverse-engineering/architecture-hypotheses.md)
about how the reference stores these (A-02 to A-05) are inferences about another product; they
are not a design input beyond the behaviour they explain.

## Decision

1. **Flat elements in scene coordinates.** A document is a map of elements keyed by identifier.
   Every element is placed directly in scene coordinates; there are no nested coordinate frames.
   Relations are data: drawing-order keys, group records, connector attachments and embedded
   labels.
2. **One geometry rule for every kind.** Each element has an unrotated local box with an origin
   `x, y` (its top-left corner) and a size, and a `rotation` in radians about the box centre. Box
   kinds store their width and height. Point kinds (line, arrow, freehand) store points relative to
   the origin, normalised so that the smallest x and y are 0; their size is derived from the
   points. A text stores its measured size, so that a document can be laid out and hit-tested
   without its fonts.
3. **Drawing order by order keys.** Each element has an order key, a base-62 string compared by
   code unit, with ties broken by identifier. Inserting or moving an element gives it a key between
   its new neighbours, so no other element changes. Keys longer than 32 characters are reassigned
   in one change set.
4. **Single-sided attachments.** A connector end that is bound stores the target's identifier and
   an anchor in the target's local box. The target stores nothing; an index derived in memory
   answers "which connectors end on this element" (REQ-M01).
5. **Embedded labels.** A label is a field of its container (rectangle, ellipse, diamond, note and,
   later, arrow), not a separate element, so it moves, copies and deletes with it by construction
   (REQ-M02, REQ-M03).
6. **Group records.** A group is a record with an identifier and an optional parent group. Each
   element names its innermost group, which allows nesting without lists on every element
   (REQ-M04).
7. **Identifiers and revisions.** Identifiers are random 128-bit values written as 22 base64url
   characters (REQ-K02). Each element has a revision number that every change increments, and the
   document has an in-memory revision that every applied change set increments (REQ-K01). The
   stored revision that refuses stale saves belongs to the repository
   ([ADR 0009](0009-persistence-and-interchange.md)).
8. **No tombstones in saved documents.** A removal is an explicit change; the saved document holds
   only live elements (REQ-P03).
9. **Colours** are stored as theme-independent sRGB hex strings; a theme changes how they are
   drawn, never what is stored.
10. **Versioned schema.** A document says `format: "planewright"` and a schema number, starting at 1.
    Decoding validates every field and rejects the whole input on any error (REQ-P07). Until the
    first release the schema may still change; after it, a new optional field with a default keeps
    the schema number, and a new kind or a changed meaning raises it and adds a migration.

## Alternatives considered

- **Array position as drawing order.** Rejected: a reorder rewrites many positions, and two
  concurrent inserts at the same position conflict.
- **A scene tree with nested transforms.** Rejected: groups need shared selection, not shared
  coordinates, and nested frames complicate hit testing, snapping and merging.
- **Bindings stored on both ends.** Rejected: two sources of truth must be kept consistent through
  every edit, undo and merge; the derived index gives the same answers.
- **Labels as separate text elements.** Rejected: copy, delete, move and undo would each have to
  maintain the container relation.
- **A CRDT library's document type.** Deferred to the collaboration decision
  ([ADR 0010](0010-collaboration-ready-change-model.md)); the model stays plain data.

## Consequences

- Hit testing, transforms and rendering share one local-frame geometry per kind.
- Layer commands, inserts and paste only assign keys; they never renumber the document.
- The arrow, note, image and frame kinds of P1 and P2 add kinds and optional fields to this model
  without changing its rules.
- Requirements served: REQ-K02, REQ-M01 to REQ-M10, REQ-P03 and REQ-P07.
