# P0 engine roadmap

The P0 engine is split into fifteen issues, each delivered by one pull request on its own branch,
in the milestone **v0.1.0 — Engine Core**. Each issue is opened only when the one before it in the
order below has merged or no longer blocks it, and only after this architecture has been reviewed
and merged. ENG-01 is issue #5, ENG-02 issue #7, ENG-03 issue #9, ENG-04 issue #11 and ENG-05
issue #13; the others are not open yet.

Every P0 requirement of the [requirements trace](requirements.md) is delivered by exactly one
issue below; the P1 and P2 requirements that the P0 design already accommodates are listed under
[Deferred requirements](#deferred-requirements).

## Rules for every engine issue

- **Tests first.** The pull request records the failing run of its new tests before the change
  that makes them pass. Each test that proves a requirement names it.
- **Definition of done.** `npm run validate` passes, and `npm run test:e2e` too when the web app
  changes; every acceptance criterion has a test or a recorded manual check; the documents in this
  directory and the requirements' dispositions are updated when a decision changes, with a new or
  superseding ADR when the decision is architectural.
- **Clean room.** No reference code, assets, fonts, icons or text, and no `@excalidraw/*` package;
  reference behaviour is consulted only through the merged baseline, and any new observation needs
  its own investigation issue ([ADR 0003](../../adr/0003-clean-room-reference-policy.md)).
- **Factual UI.** Until the last P0 issue merges, the web app labels itself a pre-release and lists
  what does not work yet.
- **Size.** An issue that grows beyond one reviewable pull request is split before work continues.
- **One delivering issue.** A requirement's field names the first issue whose acceptance criteria
  can show all of it that P0 has, with what that issue and its dependencies deliver; an earlier
  issue may test the engine rule behind it first. A requirement about every tool, control or
  command is delivered by the issue that sets up the rule, and each later issue that adds one
  extends its tests. A part that needs something P0 does not have, such as menus or the dark
  theme, is tested again by the P1 or P2 issue that adds it.

## Order and dependencies

An issue's dependencies, with theirs in turn, include every issue whose deliverables its acceptance
criteria use.

| Issue  | Title                                                         | Depends on             |
| ------ | ------------------------------------------------------------- | ---------------------- |
| ENG-01 | Engine package, math primitives and layer check               | none                   |
| ENG-02 | Document model, order keys and codec                          | ENG-01                 |
| ENG-03 | Scene store, change sets and transactions                     | ENG-02                 |
| ENG-04 | Undo and redo history                                         | ENG-03                 |
| ENG-05 | Camera and viewport controller                                | ENG-01                 |
| ENG-06 | Geometry, hit testing and text layout                         | ENG-02, ENG-03, ENG-05 |
| ENG-07 | Canvas renderer and render loop                               | ENG-03, ENG-05, ENG-06 |
| ENG-08 | Editor surface: canvas host, input, gestures and commands     | ENG-04, ENG-07         |
| ENG-09 | Selection tool and selection chrome                           | ENG-06, ENG-08         |
| ENG-10 | Transforms: move, resize, rotate, duplicate, delete and nudge | ENG-09                 |
| ENG-11 | Shape, line and freehand creation tools                       | ENG-09                 |
| ENG-12 | Text tool and text editing                                    | ENG-11                 |
| ENG-13 | Local persistence and autosave                                | ENG-08 to ENG-11       |
| ENG-14 | Accessible element list, live region and focus order          | ENG-09 to ENG-12       |
| ENG-15 | Performance harness and budgets                               | ENG-07, ENG-08, ENG-13 |

Beyond these dependencies nothing fixes the order: ENG-05 can run beside ENG-02 to ENG-04, ENG-04
beside ENG-05 to ENG-07, ENG-10 beside ENG-11 and ENG-12, and ENG-13, then ENG-15, beside ENG-12
and ENG-14.

## Issues

### ENG-01 Engine package, math primitives and layer check

- **Branch:** `feat/<issue>-engine-foundation`.
- **Delivers:** the `packages/engine` workspace as in [modules](modules.md#packages); its Vitest
  projects; an ESLint block that forbids DOM and Node.js globals, `Math.random`, `Date.now` and
  timers in the engine; engine coverage thresholds of 95, 90, 95 and 95 %; the commitlint scopes
  `engine` and `render-canvas`; the `ports` module with the `Clock`, `Scheduler` and `IdSource`
  interfaces; the `math` layer; the seeded random generator for property tests; and the test that
  enforces the layer order. The other ports need model types and arrive with the issues that first
  use them ([modules](modules.md#ports)): the text measurer with ENG-06, the renderer with ENG-07,
  the repository with ENG-13 and the announcer with ENG-14.
- **Acceptance criteria:**
  - a planted import from a lower layer and a planted `window` reference each fail a check, as
    recorded in the pull request, and the clean tree passes;
  - every `math` function has unit tests and the layer has full branch coverage;
  - `npm run validate` passes with the new workspace.
- **Requirements:** none directly; every later issue builds on it.
- **Out of scope:** any model, geometry or UI code, and the ports that need model types.

### ENG-02 Document model, order keys and codec

- **Delivers:** the [domain model](domain-model.md) types for every kind; identifier, colour,
  order-key and point-normalisation helpers; the initial default style; `decodeDocument` and
  `encodeDocument` with every limit and the migration scaffold.
- **Acceptance criteria:**
  - property tests: a generated key lies strictly between its neighbours and never ends with `0`;
    decoding an encoded document returns it; encoding is byte-stable; renormalising the points of a
    rotated point element keeps every unchanged point at its scene position within 10⁻⁶ units;
  - each limit and invariant of the domain model has a failing-input test that returns an error
    with the right path, and no invalid input yields a partial document;
  - a newer schema number is refused with its own message.
- **Requirements:** REQ-K02, REQ-P07.
- **Out of scope:** storage, the clipboard and file pickers.

### ENG-03 Scene store, change sets and transactions

- **Delivers:** the scene store with atomic `apply`, origins and `SceneUpdate` events; the order,
  spatial, group and attachment indexes; transient previews; transactions that commit net change
  sets ([scene and viewport](scene-and-viewport.md#change-sets)).
- **Acceptance criteria:**
  - a change set with one invalid change leaves the store unchanged;
  - a patch whose `after` sets an optional field to `null` removes it, survives a JSON round trip,
    and its inverse restores the field;
  - index queries agree with a brute-force scan over random scenes;
  - a cancelled transaction leaves the document equal to its start, and a committed one reverts
    its previews and applies one net change set, whose `before` check passes and which inverts
    exactly;
  - `remote` and `load` updates are emitted with their origin.
- **Requirements:** none directly; ENG-04 completes the change-set requirement that it starts.
- **Out of scope:** history, rendering.

### ENG-04 Undo and redo history

- **Delivers:** the [history](history.md) with entries that carry the selection, burst merging,
  conflict-safe undo and redo, limits and availability flags.
- **Acceptance criteria:**
  - property: undo then redo restores the document; undo alone restores the start;
  - only a committed transaction records an entry, so `remote` and `load` change sets never do
    (REQ-K01); undo and redo restore the entry's selection, filtered to elements that exist;
  - undo during an open transaction does nothing;
  - a field changed by a `remote` change set after an entry keeps its remote value on undo.
- **Requirements:** REQ-H07, REQ-K01, REQ-K03.
- **Out of scope:** keyboard shortcuts and buttons (ENG-08).

### ENG-05 Camera and viewport controller

- **Delivers:** the camera of [scene and viewport](scene-and-viewport.md#camera): transforms, pan,
  wheel, zoom about a point, the zoom ladder, zoom to fit, two-pointer maths, limits and resize.
- **Acceptance criteria:**
  - every [test vector](scene-and-viewport.md#test-vectors-from-the-baseline) passes within 0.5
    scene units;
  - properties: screen to scene to screen is the identity; zooming about a point keeps it;
  - camera operations return a new camera and never touch the document.
- **Requirements:** REQ-V01, REQ-V02, REQ-V03, REQ-V04, REQ-V08, REQ-V09.
- **Out of scope:** DOM events (ENG-08).

### ENG-06 Geometry, hit testing and text layout

- **Delivers:** in `geometry`, outlines, bounds and distance functions for the P0 kinds,
  `layoutText` and the `TextMeasurer` port it measures through
  ([rendering and hit testing](rendering-and-hit-testing.md#geometry)); in `selection`, the
  selection state, `hitTest` with its order and tolerances over the scene's spatial index, marquee
  enclosure, and handle layout and hit squares
  ([hit testing](rendering-and-hit-testing.md#hit-testing)).
- **Acceptance criteria:**
  - the REQ-S03 ladder: at zoom 1 with a 2-unit stroke, 4 and 5 px from the centre line hit and 8
    and 9 px miss, for mouse and touch tolerances; and the same ladder at zoom 2 in screen pixels;
  - an unfilled rectangle is not hit at its centre and a filled one is; the topmost of overlapping
    elements wins; a text is hit anywhere in its box;
  - rotated elements hit-test in their local frame;
  - handle hit squares are at least 24 px for touch.
- **Requirements:** REQ-S01, REQ-S02, REQ-S03, REQ-S04.
- **Out of scope:** drawing, input.

### ENG-07 Canvas renderer and render loop

- **Delivers:** the `packages/render-canvas` workspace implementing the renderer port with the
  scene and overlay layers and the path cache; the `Renderer` port, render frames, dirty tracking
  and frame scheduling in the editor façade ([ADR 0006](../../adr/0006-canvas-rendering.md)).
- **Acceptance criteria:**
  - recorded draw calls for fixture scenes match their expected sequences, including the device
    pixel ratio transform;
  - an overlay-only change does not redraw the scene layer; several changes in one frame cause one
    render;
  - a path is rebuilt only when its element's revision changes.
- **Requirements:** none directly; ENG-08 shows the next-frame requirement once input exists.
- **Out of scope:** the canvas host and input (ENG-08).

### ENG-08 Editor surface: canvas host, input, gestures and commands

- **Delivers:** in `apps/web`, the canvas host with two canvases, the input adapter, the editor
  provider and the tool bar; in the engine, the gesture recogniser, the viewport routing, the Hand
  tool, the command registry and the keymap ([interaction](interaction.md)); Undo and Redo controls.
- **Acceptance criteria:**
  - adapter tests map pointer, wheel (pixel, line and page modes) and key events, with Mod as Cmd on
    macOS and Ctrl elsewhere;
  - keymap tests on a US and a French (AZERTY) layout: digits match by physical key, `1` and
    `Shift+1` stay distinct, and Mod with `=`, `+`, `-` or `_` zooms;
  - recogniser tests cover drag thresholds, taps, double taps, long presses and the second touch
    pointer cancelling a tool gesture;
  - end to end: wheel, Shift+wheel, Mod+wheel, keyboard zoom, Space+drag, a middle-button drag, the
    Hand tool and a two-finger pinch and pan move the camera as specified, and a press on the tool
    bar never reaches the canvas;
  - editor integration tests with a fake scheduler: the effect of a pointer move is drawn in the
    next animation frame (REQ-F02);
  - Undo and Redo start disabled, and panning and zooming leave them disabled (REQ-V10, REQ-H04);
    every control has a name, the tool bar is a `toolbar` with arrow-key movement, and each tool
    exposes its shortcut;
  - the page still states what does not work yet.
- **Requirements:** REQ-C11, REQ-C14, REQ-F02, REQ-H04, REQ-V05, REQ-V06, REQ-V07, REQ-V10,
  REQ-Y01, REQ-Y03.
- **Out of scope:** the drawing and selection tools.

### ENG-09 Selection tool and selection chrome

- **Delivers:** the Selection tool's press, Shift-press, marquee, Select all, tap-to-clear and
  Escape behaviour; the selection outline and handles on the overlay.
- **Acceptance criteria:**
  - tool reducer tests for every transition in [Selection tool](interaction.md#selection-tool);
  - editor integration tests over a fixture document, with mouse and touch input: press,
    Shift+press, marquee and Mod+A select as specified, and a press on empty canvas and Escape
    clear (end to end in ENG-11, the first issue whose users can draw elements to select);
  - eight handles and the rotation handle show, side handles hide on small boxes, and a two-point
    line shows end handles;
  - selection changes create no undo step.
- **Requirements:** REQ-S05, REQ-S06, REQ-S09, REQ-S10, REQ-S12, REQ-T07.
- **Out of scope:** transforms (ENG-10).

### ENG-10 Transforms: move, resize, rotate, duplicate, delete and nudge

- **Delivers:** the transform rules of [interaction](interaction.md#transforms) and their commands.
- **Acceptance criteria:**
  - B-15's move by +40, +40 and B-16's resize boxes are reproduced for all eight handles and the
    two-element case; Shift and Alt resize as specified; sizes stop at 1 unit, and zero sizes stay
    0, so horizontal lines, a dot and a flat freehand stroke resize without dividing by zero;
  - rotation follows the pointer and snaps to 15° with Shift;
  - duplicate offsets by +10, +10 and selects the copies; Delete removes and undo restores the
    selection;
  - arrow keys nudge by 1 and 10, and one held key is one undo step;
  - each gesture or command is exactly one undo step; Undo and Redo requested during a move drag are
    ignored (REQ-H06); a selection change after an edit is not undone: Undo reverses the edit and
    restores the selection around it (REQ-S13).
- **Requirements:** REQ-H06, REQ-S13, REQ-T01, REQ-T02, REQ-T03, REQ-T04, REQ-T05, REQ-T06,
  REQ-T08, REQ-T09, REQ-T10, REQ-T11.
- **Out of scope:** flips, snapping, groups.

### ENG-11 Shape, line and freehand creation tools

- **Delivers:** the rectangle, ellipse, diamond, line and freehand tools and tool lock.
- **Acceptance criteria:**
  - B-01's boxes are reproduced by drags, also towards the top-left; taps create the default sizes;
  - after a shape or line the Selection tool is active with the new element selected, and with tool
    lock the tool stays and nothing is selected; freehand stays active;
  - a freehand stroke's box is its input's extent and a tap makes a dot;
  - end to end on desktop and the emulated phone: drawn elements are selected by press,
    Shift+press, marquee and Mod+A, and a press on empty canvas and Escape clear the selection;
  - new elements take the current default style (REQ-C12);
  - each creation is one undo step that leaves nothing selected when undone; Mod+Z undoes it and
    Mod+Shift+Z or Mod+Y redoes it; Undo enables with the first creation, Redo after an undo, and a
    new creation disables Redo (REQ-H01, REQ-H02); with tool lock on, undoing a creation leaves the
    creation tool active (REQ-H05).
- **Requirements:** REQ-C01, REQ-C02, REQ-C03, REQ-C04, REQ-C05, REQ-C06, REQ-C07, REQ-C12,
  REQ-C13, REQ-H01, REQ-H02, REQ-H05.
- **Out of scope:** pressure-sensitive width, arrows, notes.

### ENG-12 Text tool and text editing

- **Delivers:** the Text tool, the text overlay in the web app, measurement through the text
  measurer, and an ADR choosing the open-licence fonts behind the `sans`, `hand` and `mono`
  families.
- **Acceptance criteria:**
  - B-06's placement: the left edge at the click and the first line's centre on it;
  - Escape, Mod+Enter, a press outside and a tool change commit; an empty new text disappears
    without an undo step; one session is one undo step; a double tap re-edits;
  - shortcuts are paused while the text area has focus.
- **Requirements:** REQ-C09, REQ-C10.
- **Out of scope:** labels in shapes, wrapping, the font picker.

### ENG-13 Local persistence and autosave

- **Delivers:** the `DocumentRepository` port, the autosave scheduler, the IndexedDB repository,
  loading, the notices for failed, stale and unavailable storage, and the preferences entry
  ([persistence](persistence.md)).
- **Acceptance criteria:**
  - scheduler tests with a fake clock: saved within 300 ms of the last change and at most 1 s after
    the first; transient previews never saved; retries and notices on failure;
  - repository tests: the repository assigns every stored revision; a stale base is refused and
    nothing is written; a session save neither checks nor raises the revision;
  - two editors over one in-memory repository: both load revision 5 and B saves (revision 6); A
    edits, its save is refused as stale, and A keeps its version, so storage holds exactly A's
    document at revision 7; B's next save is then refused and raises B's notice; had A loaded the
    newer version instead, it would show B's document with an empty history;
  - end to end: after a reload the document, camera and selection are back, the tool is Selection,
    history is empty and deleted elements are gone; a second tab's newer save raises the notice;
  - invalid stored data is left untouched and a new document opens with a notice.
- **Requirements:** REQ-H03, REQ-P01, REQ-P02, REQ-P03, REQ-P05, REQ-P06, REQ-V11.
- **Out of scope:** files, images, the clipboard, offline start.

### ENG-14 Accessible element list, live region and focus order

- **Delivers:** the element list, the `Announcer` port with its live region, focus order and
  indicators, Escape focus return, and keyboard creation ([quality](quality.md#accessibility)).
- **Acceptance criteria:**
  - keyboard-only end-to-end test: create each P0 kind, select, nudge and delete from the list, undo
    and redo, with each step announced;
  - every focusable element shows a visible indicator, and the tab order is as specified;
  - touch targets, handle hit squares included, are at least 24 × 24 CSS px; interface text meets
    4.5:1 contrast in the light theme, the only P0 theme; with reduced motion requested no camera
    change animates (REQ-Y06).
- **Requirements:** REQ-Y02, REQ-Y04, REQ-Y05, REQ-Y06.
- **Out of scope:** menus and the dark theme (P1, P2).

### ENG-15 Performance harness and budgets

- **Delivers:** the benchmarks and Playwright measurements of [quality](quality.md#performance-budgets),
  a bundle-size guardrail, and the CI reporting that becomes a gate after three baseline runs.
- **Acceptance criteria:**
  - each budget has a measurement that runs in CI and reports its value, the next-frame budget of
    the ENG-07 render loop included;
  - the P0 engine meets every budget, or the pull request names the miss and the issue that will fix
    it.
- **Requirements:** REQ-F01, REQ-F03, REQ-F04.
- **Out of scope:** optimisations beyond what a missed budget requires.

## Deferred requirements

These requirements are not delivered by P0, but the P0 model and interfaces already hold them, as
the cited designs show. They go to feature issues derived from the backlog.

| Requirement | Phase | Backlog item            | Prepared by                                                                          |
| ----------- | ----- | ----------------------- | ------------------------------------------------------------------------------------ |
| REQ-C08     | P1    | 2, freehand             | `pressures` on freehand elements ([domain model](domain-model.md#elements))          |
| REQ-S07     | P2    | 3, selection            | the marquee's overlap mode ([hit testing](rendering-and-hit-testing.md#hit-testing)) |
| REQ-S08     | P1    | 10, lock                | `locked` on every element; hit testing skips it                                      |
| REQ-S11     | P1    | 10, groups              | group records and the outermost-group index                                          |
| REQ-S14     | P1    | 10, context menu        | the recogniser's long press                                                          |
| REQ-T12     | P1    | 4, transforms           | transforms in the local frame                                                        |
| REQ-P04     | P2    | 6, persistence          | the `files` store keyed by SHA-256                                                   |
| REQ-P08     | P2    | 21, offline start       | the app shell and IndexedDB, with a service worker to add                            |
| REQ-M01     | P1    | 9, arrows and binding   | single-sided attachments and the attachment index                                    |
| REQ-M02     | P1    | 8, text and labels      | embedded labels and `layoutText` with a maximum width                                |
| REQ-M03     | P1    | 8, sticky notes         | the note kind with an embedded label                                                 |
| REQ-M04     | P1    | 10, groups              | group records with parents                                                           |
| REQ-M05     | P1    | 10, layers              | order keys and `keyBetween`                                                          |
| REQ-M06     | P1    | 7, styles               | the style record and editor defaults                                                 |
| REQ-M07     | P1    | 10, lock                | `locked` on every element                                                            |
| REQ-M08     | P1    | 10, links               | `link` with the codec's scheme check                                                 |
| REQ-M09     | P2    | 10, frames              | the frame kind                                                                       |
| REQ-M10     | P2    | 16, images              | the image kind and the files store                                                   |
| REQ-X01     | P1    | 11, clipboard           | the clipboard payload in the codec                                                   |
| REQ-X02     | P1    | 11, clipboard           | the text kind                                                                        |
| REQ-X03     | P2    | 17, import and export   | the document file format                                                             |
| REQ-X04     | P2    | 17, import and export   | outlines shared by the renderer and export                                           |
| REQ-K04     | P2    | 18, guest collaboration | the collaboration-ready types ([collaboration](collaboration.md))                    |

## The first issue

The first issue to open, once this architecture is reviewed and merged, is **ENG-01 Engine package,
math primitives and layer check**, in the milestone v0.1.0 — Engine Core, with its acceptance
criteria copied from above.
