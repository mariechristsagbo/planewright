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

Session state does not raise the document revision and is never a history entry.

## Repository port

```ts
export type DocumentId = Brand<string, 'DocumentId'>;

export interface SessionState {
  readonly camera: Camera;
  readonly selection: readonly ElementId[];
}

export interface StoredDocument {
  readonly id: DocumentId;
  readonly document: DocumentState; // its `rev` is the stored revision
  readonly session: SessionState;
}

export type LoadResult =
  | { readonly type: 'empty' }
  | { readonly type: 'loaded'; readonly stored: StoredDocument }
  | { readonly type: 'invalid'; readonly errors: readonly CodecError[] }
  | { readonly type: 'unavailable' };

export interface SaveDelta {
  readonly id: DocumentId;
  readonly baseRev: number; // the revision this editor last loaded or saved
  readonly rev: number; // the revision being written
  readonly upserts: readonly Element[];
  readonly removals: readonly ElementId[];
  readonly groups: {
    readonly upserts: readonly GroupRecord[];
    readonly removals: readonly GroupId[];
  };
  readonly canvas: CanvasState;
  readonly session: SessionState;
}

export type SaveResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'stale' | 'quota' | 'unavailable' | 'failed' };

export interface DocumentRepository {
  load(): Promise<LoadResult>;
  save(delta: SaveDelta): Promise<SaveResult>;
}
```

A save succeeds only if the stored revision still equals `baseRev`; otherwise it changes nothing
and returns `stale` (REQ-P06). The in-memory test repository applies the same rule.

## Autosave

The `persistence` layer's scheduler tracks the elements and groups changed since the last save,
from scene updates of every origin except `load`; transient previews never count (REQ-P01).

| State  | On a committed change                                                          | On the timer                | On the save's result                                           |
| ------ | ------------------------------------------------------------------------------ | --------------------------- | -------------------------------------------------------------- |
| clean  | becomes dirty; timer at 300 ms                                                 | none                        | none                                                           |
| dirty  | timer reset to 300 ms, but never later than 1 s after the first unsaved change | start a save, become saving | none                                                           |
| saving | stays saving; the change waits                                                 | none                        | success: clean, or dirty if changes waited; failure: see below |

- When the page is hidden or unloaded, a dirty scheduler starts a save at once. Writes during
  unload are best effort, so the 1 s ceiling bounds what a crash can lose.
- **Failures** (`quota`, `unavailable`, `failed`) keep the changes pending, retry after 1, 2, 4, 8,
  16 and then every 30 s, and raise a notice that stays until a save succeeds (REQ-P05). Editing
  continues in memory meanwhile.
- **Stale** stops autosave and raises a notice: another tab saved a newer version. The user chooses
  to load the newer version, discarding unsaved changes here, or to keep this one, which saves with
  the stored revision as the new base. Nothing is overwritten without that choice (REQ-P06).
- A save serialises only the changed elements, so its main-thread cost depends on the change, not on
  the document's size (REQ-F03).

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

A save is one `readwrite` transaction over `documents` and `elements`: it reads the document
record, aborts with `stale` if its revision differs from `baseRev`, then writes the upserts, deletes
the removals and writes the record with the new revision. Database upgrades run migrations inside
the version-change transaction.

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
