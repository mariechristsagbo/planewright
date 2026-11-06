# Persistence and the import and export boundary

This document specifies local saving, what a reload restores, and the single validating boundary
that every stored or imported document crosses ([ADR 0009](../../adr/0009-persistence-and-interchange.md)).
The encoded form and the limits are in the [domain model](domain-model.md#invariants-and-limits).

## What is saved where

| Data                                | Where                                               | When                                                                 | Requirements     |
| ----------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------- | ---------------- |
| Elements, groups, canvas background | IndexedDB: one record per element, one per document | autosave after committed changes                                     | REQ-P01, REQ-P03 |
| Session state: camera and selection | IndexedDB, on the document record                   | with the next save, or 1 s after the last camera or selection change | REQ-P02, REQ-V11 |
| Preferences: theme and view toggles | one `localStorage` entry                            | at once, on change                                                   | REQ-H04          |
| Binary files (P2)                   | IndexedDB, keyed by SHA-256                         | when an image is inserted                                            | REQ-P04          |
| History, the active tool            | nowhere                                             | never                                                                | REQ-H03, REQ-P02 |

Session state is never a history entry and never raises the stored revision. A save that carries
only session state skips the revision check and writes only the session field of the document
record, so it can neither be refused as stale nor make another tab's next save stale; a selection
that names elements another tab has removed since is filtered when it is loaded.

## Repository port

```ts
export type DocumentId = Brand<string, 'DocumentId'>;

export interface SessionState {
  readonly camera: Camera;
  readonly selection: readonly ElementId[];
}

export interface StoredDocument {
  readonly id: DocumentId;
  readonly rev: number; // the stored revision, assigned by the repository
  readonly document: DocumentState;
  readonly session: SessionState;
}

export type LoadResult =
  | { readonly type: 'empty' }
  | { readonly type: 'loaded'; readonly stored: StoredDocument }
  | { readonly type: 'invalid'; readonly errors: readonly CodecError[] }
  | { readonly type: 'unavailable' };

export interface DocumentDelta {
  readonly upserts: readonly Element[];
  readonly removals: readonly ElementId[];
  readonly groups: {
    readonly upserts: readonly GroupRecord[];
    readonly removals: readonly GroupId[];
  };
  readonly canvas: CanvasState;
}

export type SaveRequest =
  | {
      /** The changes since the last save. */
      readonly type: 'delta';
      readonly id: DocumentId;
      readonly baseRev: number; // the stored revision this editor last loaded or wrote
      readonly delta: DocumentDelta;
      readonly session: SessionState;
    }
  | {
      /** The whole document, written over the stored one when the user keeps this version. */
      readonly type: 'replace';
      readonly id: DocumentId;
      readonly baseRev: number; // the stored revision that the refused save reported
      readonly document: DocumentState;
      readonly session: SessionState;
    }
  | {
      /** Camera and selection only: no revision check and no new revision. */
      readonly type: 'session';
      readonly id: DocumentId;
      readonly session: SessionState;
    };

export type SaveResult =
  | { readonly ok: true; readonly rev: number } // the stored revision after the save
  | { readonly ok: false; readonly reason: 'stale'; readonly storedRev: number }
  | { readonly ok: false; readonly reason: 'quota' | 'unavailable' | 'failed' };

export interface DocumentRepository {
  load(): Promise<LoadResult>;
  save(request: SaveRequest): Promise<SaveResult>;
}
```

The repository owns the stored revision; the editor never chooses one, and the in-memory
`DocumentState.rev` is a different counter that is never saved. A document with no record yet is
at revision 0. Inside one transaction, a `delta` or `replace` save checks that the stored revision
still equals `baseRev`: if it does, the save writes and sets the stored revision to `baseRev + 1`,
which it returns; if not, it changes nothing and returns `stale` with the stored revision
(REQ-P06). Every write raises the stored revision, so a base that has been passed never matches
again, whatever the other tab's own edits. A `session` save writes only the session field and
keeps the revision. The in-memory test repository applies the same rules.

## Autosave

The `persistence` layer's scheduler tracks the elements and groups changed since the last save,
from scene updates of every origin except `load`; transient previews never count (REQ-P01). It
keeps the stored revision returned by the load or by the last successful save as the base of the
next one.

| State  | On a committed change                                                          | On the timer                | On the save's result                                           |
| ------ | ------------------------------------------------------------------------------ | --------------------------- | -------------------------------------------------------------- |
| clean  | becomes dirty; timer at 300 ms                                                 | none                        | none                                                           |
| dirty  | timer reset to 300 ms, but never later than 1 s after the first unsaved change | start a save, become saving | none                                                           |
| saving | stays saving; the change waits                                                 | none                        | success: clean, or dirty if changes waited; failure: see below |

- When the page is hidden or unloaded, the web app calls `Editor.saveNow`, and a dirty scheduler
  starts a save at once. Writes during unload are best effort, so the 1 s ceiling bounds what a
  crash can lose.
- **Failures** (`quota`, `unavailable`, `failed`) keep the changes pending, retry after 1, 2, 4, 8,
  16 and then every 30 s, and raise a notice that stays until a save succeeds (REQ-P05). Editing
  continues in memory meanwhile.
- **Stale** stops autosave, session saves included, and raises a notice: another tab saved a newer
  version. Nothing is overwritten without the user's choice, which the notice passes to
  `Editor.resolveStale` (REQ-P06):
  - **Load the newer version** discards this tab's unsaved changes and loads the stored document as
    a reload would, through a change set with the `load` origin: its camera and selection, the
    Selection tool and an empty history.
  - **Keep this one** saves this tab's whole document as a `replace` whose base is the revision the
    `stale` result reported. The repository removes every stored element and group that the
    document does not hold and writes the rest, so storage then holds exactly this tab's document
    at a new revision, and the other tab's next save is refused as stale in turn. If yet another
    save landed in between, the replacement is stale too and the notice comes back.
- A save serialises only the changed elements, so its main-thread cost depends on the change, not on
  the document's size (REQ-F03). A replacement writes every element, so it issues its writes in
  batches, each started when the previous one completes, and no main-thread task exceeds a frame.

## Loading

At start-up the editor asks the repository for the most recently updated document:

- `empty`: a new document with a new identifier.
- `loaded`: the decoded document, its camera and its selection filtered to existing elements; the
  Selection tool; empty history (REQ-P02, REQ-H03).
- `invalid`: the stored data is left untouched and a new, empty document with a new identifier is
  opened beside it, with a notice that offers to download the stored data as a file. Nothing is
  partially loaded (REQ-P07).
- `unavailable` (private modes, disabled storage): editing works in memory, with a notice that
  nothing will be saved.

## IndexedDB layout

The web adapter opens the database `planewright`, version 1, with three object stores:

| Store       | Key                       | Value                                                             |
| ----------- | ------------------------- | ----------------------------------------------------------------- |
| `documents` | `id`                      | schema, revision, canvas, groups, session state, last update time |
| `elements`  | `[documentId, elementId]` | the encoded element, as in the file format; indexed by document   |
| `files`     | SHA-256 of the bytes (P2) | media type, byte length, the bytes as a `Blob`                    |

A save is one `readwrite` transaction over `documents` and `elements`. A delta or a replacement
reads the document record and aborts with `stale` if its revision differs from `baseRev`. A delta
then writes the upserts and deletes the removals; a replacement deletes every element record of the
document and writes all of its elements. Both write the record with the revision `baseRev + 1`, the
canvas, the groups and the session. A session save writes only the record's session field and update
time. Database upgrades run migrations inside the version-change transaction.

## The codec boundary

Every untrusted document input goes through one decoder:

```ts
export interface CodecError {
  readonly path: string; // JSON path, for example "elements[3].style.stroke.width"
  readonly problem: MessageKey;
}

export type Decoded<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly errors: readonly CodecError[] };

export function decodeDocument(text: string): Decoded<DocumentState>;
export function decodeClipboard(text: string): Decoded<ClipboardContent>;
export function encodeDocument(document: DocumentState): string;
```

1. Refuse input above the size limit before parsing it.
2. Parse JSON; a syntax error is one error at the root.
3. Check the structure field by field, collecting errors with their paths.
4. Check the cross-references: groups, parents, attachments and files.
5. Migrate from an older schema number, one step at a time; refuse a newer one with a message that
   the document was made by a newer version.
6. Return the whole document, or the errors and nothing else.

Encoding writes keys in a fixed order and elements in drawing order, so that the same document
always gives the same text.

## Interchange formats

| Format          | Shape                                                                                                                                                                       | Phase | Requirements     |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ---------------- |
| Document file   | the encoded document; extension `.planewright`, media type `application/vnd.planewright+json`                                                                               | P2    | REQ-X03          |
| Clipboard       | JSON text with `"type": "planewright/clipboard"`, a schema number and encoded elements; plain text pastes as one text element; JSON of any other shape pastes as plain text | P1    | REQ-X01, REQ-X02 |
| Images          | PNG, JPEG, WebP or GIF recognised by their first bytes, at most 20 MB, decoded as bitmaps; SVG images are rasterised, never inserted into the page                          | P2    | REQ-M10, REQ-P04 |
| PNG, SVG export | drawn from the shared geometry                                                                                                                                              | P2    | REQ-X04          |

Opening and saving files use the platform's file picker where it exists and a download or file
input elsewhere (REQ-X03). Other applications' formats are not imported: each would need its own
investigation issue and ADR.

## Security at the boundary

- Text from documents reaches the page only as canvas text or as a text area's value, never as
  HTML.
- Links are accepted only with the `http`, `https` or `mailto` scheme, shown with their origin and
  opened only by an explicit action, with `noopener` and `noreferrer` (REQ-M08).
- Numbers, sizes, counts and string lengths are limited by the codec, so a hostile file cannot make
  the editor allocate without bound.
- P0 makes no network request beyond the web app's own assets; documents never leave the device.

## Requirements served

REQ-F03, REQ-H03, REQ-H04, REQ-M08, REQ-M10, REQ-P01 to REQ-P07, REQ-V11 and REQ-X01 to REQ-X04.
