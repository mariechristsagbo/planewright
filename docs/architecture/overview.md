# Architecture overview

This document describes the foundation as it exists today. It will grow as investigations
complete and ADRs are accepted.

## Components

```text
┌───────────────────────┐        WebSocket /ws         ┌───────────────────────────┐
│ apps/web              │  ─────────────────────────▶  │ apps/collab               │
│ React + Vite          │  (not connected yet)         │ Node.js http + ws         │
│ pre-release editor    │                              │ /healthz, hello handshake │
└──────────┬────────────┘                              └─────────────┬─────────────┘
           │ imports                                                 │ imports
           ▼                                                         ▼
                    ┌──────────────────────────────────┐
                    │ packages/protocol                │
                    │ protocol version 0, message types │
                    └──────────────────────────────────┘
```

### apps/web

A React 19 application built with Vite 8. It renders the editor surface of ENG-08, ENG-11, ENG-12,
ENG-13 and ENG-14: a canvas host whose scene and overlay canvases the canvas renderer draws, an input
adapter that sends DOM events to the engine's editor, a text area over the canvas for the text being
edited, a tool bar with the Hand, Selection, creation and text tools and tool lock, a keyboard-operable
list of the drawn elements, Undo and Redo and zoom controls, a live region that says the editor's
announcements, and the save status with the notices for failed, stale, unavailable and invalid storage;
it bundles and loads the fonts of [ADR 0011](../adr/0011-bundled-open-licence-fonts.md), and sets its
own text in the chrome's family, `Planewright UI` (Inter at 400 and 500), over the design tokens of
[ADR 0012](../adr/0012-v02-editor-chrome.md), decision 8.
Since slice S2 (issue #55) these sit in the editor's shell, `EditorShell`: the canvas fills the
window and the page never scrolls, and the controls float over it in islands, siblings of the canvas
host, so that no press on them reaches the canvas. The identity island at the top left holds the
menu button, the mark, the wordmark and a Pre-release tag, the tool bar sits at the top centre, the
top-right island holds an Elements toggle that opens the element list in a drawer, closed at every
load, with the storage notices under it, history and zoom sit at the bottom left, with the zoom
shown on the Reset zoom button, and the view readout and the save status at the bottom right. Since
slice S3, issue #62, the tool bar is a palette whose buttons show the tools' original glyphs, with
their first keys in a corner and tool lock's padlock, Undo, Redo, Zoom out, Zoom in and Zoom to fit
show glyphs too, all with their names, keys and descriptions unchanged, and those controls and Reset
zoom show tooltips of their names and keys. Since slice S4, issue #64, the menu button, the first
tab stop, opens a menu of Select all, Zoom to fit and Reset zoom, which run the registry's commands,
Show elements, which opens and closes the drawer, Keyboard shortcuts, About this build and Source on
GitHub, and a Keyboard shortcuts button after the view readout, the last tab stop, opens the same
dialog, which lists every command of the registry with its keys. Since slice S5, issue #66, the
Elements toggle shows its glyph and the count of the drawn elements, hidden from screen readers so
that its name stays "Elements"; the drawer, 300 px wide and 280 px at compact widths, mounts the
list only while it is open, puts the focus on the list box when it opens and on the toggle when it
closes, holds a Close button and the list's keys folded under a summary, and shows in each row the
kind's glyph, a label and the figures in mono while each option keeps P0's name; on a phone in
portrait it is a sheet of at most 62 % of the height, which makes the tool bar and the bottom
islands inert and closes on Escape. Since slice S6, issue #69, a selection panel, 232 px wide near
the upper left, shows while something drawn is selected and no text is edited: the kind's glyph and
name, or the count, the selection's position, size and turn read-only in mono, with a line's length,
a freehand stroke's points or a text's lines, Duplicate and Delete, which run the registry's
commands, Edit text for a lone text that Enter would edit, and a line saying that style controls are
not in this build; on a phone in portrait a bar under the tool bar takes its place, with Details,
which opens the figures in a sheet along the bottom, never together with the Elements sheet. Its
IndexedDB record backend
(database `planewright`) stores what the engine's autosave saves, so the drawing, its camera and its
selection are kept in the browser, and at start-up the page opens the most recently updated document
again; it also saves at once when the page is hidden or left, and reads its preferences entry from
`localStorage` at start-up. The Pre-release tag opens About this build, a dialog that says that
shapes, lines, freehand strokes and texts can be drawn, selected, transformed and undone and that
the drawing is saved in this browser, and lists the capabilities that are not implemented, text
formatting, styles, files and collaboration among them; an empty canvas repeats its pre-release
sentence. It imports the protocol version to prove that workspace linking works.

### apps/collab

A Node.js service with no framework:

- `src/config.ts` reads `PLANEWRIGHT_COLLAB_*` variables and rejects invalid values at startup.
- `src/server.ts` serves `GET /healthz` and accepts WebSocket upgrades only on `/ws` and only
  from allowlisted `Origin` values. Every accepted client receives `server.hello`; any client
  message is answered with `server.error` / `not_implemented`. Message size is limited by
  `maxPayload`.
- `src/main.ts` wires configuration, logging and graceful shutdown on `SIGINT` and `SIGTERM`.

Logs are JSON lines on stdout.

### packages/protocol

Runtime-agnostic TypeScript definitions with no DOM or Node.js dependencies. Protocol version 0
contains only the server hello and error messages and has no compatibility guarantees.

### packages/engine

The canvas engine's package ([ADR 0004](../adr/0004-canvas-engine-package-boundaries.md)):
ECMAScript-only TypeScript that reaches the platform through ports. It holds the `math` layer
(vectors, affine matrices, axis-aligned and oriented boxes, angles, tolerances and a seeded random
source), the clock, scheduler and identifier ports, the `model` layer (the document's types,
order keys, point normalisation, the initial default style, element patches and the validating
codec), the `geometry` layer (world and content bounds, per-kind outlines and distances, the text
measurer port and text layout), the `camera` layer (screen and scene transforms, pan, zoom, the
zoom ladder, zoom to fit, two-pointer maths, resizing and limits), the `scene` layer (the scene
store with its change sets, indexes, transient previews and transactions), the `history` module
(undo and redo entries, burst merging and conflict-safe undo), the `selection` module (the
selection state, hit testing, handle layout and box selection), the `transform` module (move,
resize, rotate, line-end, duplicate and delete maths), the `input` layer (input events, the gesture
recogniser and the viewport routing), the `tools` layer (the Hand tool and the Selection tool with
its transforms), the `commands` layer (the command registry, its keymap, Duplicate, Delete and the
nudges), the `persistence` layer (the `DocumentRepository` port with its revision rule, the stored
records read through the codec, a repository over any record backend, and the autosave scheduler)
and the `editor` layer (render frames, the renderer
port, culling, the render loop with its dirty tracking and frame scheduling, and `createEditor`,
which opens a stored document, saves through the repository port, reports the save status, lists
the drawn elements in its view and announces each change through the announcer port).
The web app imports it.

### packages/render-canvas

The Canvas 2D implementation of the engine's renderer port
([ADR 0006](../adr/0006-canvas-rendering.md)), which depends on the engine only. It draws a render
frame's scene part on a scene canvas and its overlay part on an overlay canvas, sizes their backing
stores to the device pixel ratio, and caches each element's path and text layout per revision. It
is tested against a recording fake of the 2D context; the web app's canvas host draws with it.

## Decisions and what stays open

The [canvas-engine architecture](engine/README.md) (issue #3) decides how the editor is built,
traced to the behavioural baseline of issue #1. Its ADRs are accepted. ENG-01 (issue #5) created the
engine package with its boundary checks, its math layer and its ports, ENG-02 (issue #7) added the
document model and its codec, ENG-03 (issue #9) the scene store, ENG-04 (issue #11) the undo and
redo history, ENG-05 (issue #13) the camera, ENG-06 (issue #15) the geometry, text layout and hit
testing, ENG-07 (issue #17) the render loop and the canvas renderer, ENG-08 (issue #19) the editor
surface, ENG-09 (issue #21) the Selection tool, ENG-10 (issue #23) the transforms, ENG-11 (issue
#25) the shape, line and freehand creation tools, ENG-12 (issue #27) the Text tool, text editing and
the bundled fonts, ENG-13 (issue #29) local persistence and autosave in the browser's IndexedDB
storage, ENG-14 (issue #31) the element list, the live region, focus order and creation from the
keyboard, and ENG-15 (issue #33) the measurements of the performance budgets, reported in CI, with
budgets B1, B6 and B7 missed in CI and B2 on a slower machine, named with issues #34 to #36, of
which issue #34 has since made the scene redraw cheaper, B2 being met in every CI report and B1 in
most, with B1's misses in some runs followed by issue #49, issue #35 has brought the marquee query
within B6 and issue #36 a change set that moves 1,000 elements within B7, and issue #38 their
baseline, three runs on `main` on three processors, which gates a run only by runs on its own
processor and so gates none yet; the rest is not implemented yet:

- storage beyond the element model and codec of ENG-02, the scene store of ENG-03 and the browser
  storage and autosave of ENG-13: the binary files of images, opening and saving document files and
  offline start, all P2:
  [ADR 0005](../adr/0005-document-model.md) and [ADR 0009](../adr/0009-persistence-and-interchange.md);
- drawing arrows, notes and images, beyond the render loop, culling and canvas renderer of ENG-07,
  the shapes, lines and freehand strokes of ENG-11 and the texts of ENG-12:
  [ADR 0006](../adr/0006-canvas-rendering.md);
- the P1 tools, beyond the Hand tool and commands of ENG-08, the Selection tool of ENG-09, the
  transforms of ENG-10, the creation tools of ENG-11 and the Text tool of ENG-12:
  [ADR 0007](../adr/0007-history-model.md) and [ADR 0008](../adr/0008-input-tools-and-commands.md);
- package boundaries for the engine, in place since ENG-01, and for its renderer:
  [ADR 0004](../adr/0004-canvas-engine-package-boundaries.md);
- file formats and the clipboard: Planewright's own document format (P2) and clipboard format (P1)
  ([ADR 0009](../adr/0009-persistence-and-interchange.md)); no other application's format.

The editor chrome of milestone v0.2.0 (Editor Experience) is decided in
[ADR 0012](../adr/0012-v02-editor-chrome.md) and split into slices S1 to S13 by the
[v0.2 plan](editor-experience.md). Issue #50 (slice S0) recorded both, issue #53 (slice S1) added
the chrome's design tokens, base styles and typeface, with no layout rule change, though P0's text
rewrapped in the new face, issue #55 (slice S2) replaced P0's page with the full-bleed shell
described above, and issue #62 (slice S3) drew the chrome's 35 original glyphs, turned the tool bar
into the palette and added tooltips, issue #64 (slice S4) added the menu and the Keyboard
shortcuts dialog, issue #66 (slice S5) gave the Elements drawer its count, its rows and its phone
sheet, and issue #69 (slice S6) added the selection panel, the phone's selection bar and the
Details sheet; S7 to S13 are not implemented yet.

Still open, each for its own issue and ADR:

- the collaboration model (merge policy, transport, presence, room lifecycle, authentication and
  server persistence); [ADR 0010](../adr/0010-collaboration-ready-change-model.md) only fixes the
  interfaces that the engine keeps ready for it;
- the sketch styles and the dark-theme colour mapping, decided in the feature issues that need
  them; the fonts behind the text families are decided by
  [ADR 0011](../adr/0011-bundled-open-licence-fonts.md) (ENG-12).
