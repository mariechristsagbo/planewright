# ADR 0009: Local persistence and the interchange format

- Status: Proposed
- Date: 2026-11-06

## Context

The baseline observed automatic local saving within a few hundred milliseconds of a change, a
reload that restored the scene and camera, deleted elements dropped from storage and binary files
kept apart from the scene (B-30, B-31). It did not observe several tabs, storage limits or save
failures (R-54). Every stored document, file, clipboard payload and, later, network message is
untrusted input that must be validated before use (AGENTS.md). Saving must never block input for
more than a frame (REQ-F03).

## Decision

1. **A repository port.** The engine saves through a document repository that loads a stored
   document and saves a delta against an expected document revision; a save whose expected
   revision is stale is refused, so another tab's newer document is never overwritten silently
   (REQ-P06).
2. **IndexedDB in the web app.** One database holds a store of document records (metadata,
   revision, camera and selection), a store of element records keyed by document and element, and,
   from P2, a store of files keyed by the SHA-256 of their bytes (REQ-P04). An autosave writes only
   the elements changed since the last save and deletes the removed ones, in one transaction.
3. **Autosave timing.** A save starts 300 ms after the last committed change, at most 1 s after the
   first unsaved one, and at once when the page is hidden or unloaded (REQ-P01). A failed save is
   retried with back-off and reported to the user (REQ-P05).
4. **Preferences** such as the theme and view toggles are stored apart from the document, in one
   small `localStorage` entry read synchronously at start-up so that the first frame has the right
   theme. They are not part of the document or its history.
5. **What a reload restores.** The document, the camera and the selection; the tool always starts
   as Selection (REQ-P02, REQ-V11).
6. **One validating codec.** Stored data, opened files and clipboard payloads all pass through the
   same decoder, which checks types, finite numbers, coordinate and size limits, string lengths,
   element counts and link schemes, and returns either a document or a list of errors (REQ-P07).
7. **Interchange format.** A file is JSON with `format: "planewright"`, its schema number and its
   elements in drawing order, saved with the extension `.planewright` and the media type
   `application/vnd.planewright+json`. The clipboard payload has its own type tag and the same
   element encoding (REQ-X01).
8. **No foreign formats yet.** Importing another application's format needs its own investigation
   issue and ADR.

## Alternatives considered

- **`localStorage` for the document.** Rejected: a few megabytes at most, and every save
  serialises the whole document on the main thread.
- **One IndexedDB record per document.** Rejected: every save rewrites every element.
- **The origin private file system.** Deferred: it fits large files, but support and test tooling
  are not needed for P0.

## Consequences

- Tests use an in-memory repository with the same revision rule; end-to-end tests reload the real
  page and read the restored state through the accessible element list.
- A multi-tab conflict shows a notice that offers to reload the newer document.
- Requirements served: REQ-F03, REQ-P01 to REQ-P07, REQ-V11, REQ-X01 and REQ-X03.
