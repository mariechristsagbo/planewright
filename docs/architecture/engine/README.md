# Canvas-engine architecture

**Status: accepted in issue #3; implementation started with ENG-01 (issue #5).** These documents
design Planewright's canvas engine and split its first usable version into issues. The engine
package holds only its `math`, `ports`, `model`, `geometry`, `camera`, `scene`, `history`,
`selection`, `transform`, `input`, `tools`, `commands`, `persistence` and `editor` modules so far,
the geometry's outlines, distances and text layout and the selection module since ENG-06 (issue
#15), and the `editor` layer's render frames and render loop, with the `@planewright/render-canvas`
renderer, since ENG-07 (issue #17), and the `input`, `tools` and `commands` layers with
`createEditor` since ENG-08 (issue #19); the Selection tool came with ENG-09 (issue #21), the
transforms with ENG-10 (issue #23), the shape, line and freehand tools with ENG-11 (issue #25), the
Text tool with text editing with ENG-12 (issue #27), and the `persistence` layer's repository port
and autosave scheduler, with loading and saving in the editor, with ENG-13 (issue #29), and the
announcer port, the view's elements and creation with Enter with ENG-14 (issue #31). The web app
shows a pre-release editor surface on them: a canvas that fills the window and pans and zooms, with
the controls floating over it since v0.2's slice S2 (issue #55), most of them shown as original
glyphs with tooltips since slice S3 (issue #62), with a menu and a Keyboard shortcuts dialog since
slice S4 (issue #64), on which shapes, lines, freehand
strokes and texts can be drawn, selected, transformed and undone, and texts edited again, also from
the keyboard alone through a list of its elements in a drawer, with its count, its rows and its
phone sheet since slice S5 (issue #66), with a selection panel, or on phones a bar and a Details
sheet, that shows the selection's figures read-only and offers Duplicate, Delete and Edit text
since slice S6 (issue #69), with each change said in a live
region, and whose drawing is saved in the browser's IndexedDB storage and restored on reload, with
nothing shown while saving works and a "Not saved" chip with the storage notices while it needs
attention since slice S7 (issue #71), and, since slice S8 (issue #73), the tools in a dock with More
at the bottom of a phone in portrait, 44 px targets on phones and the islands clear of the safe
areas, and, since slice S9 (issue #75), a chip under the text area that names the keys that finish a
text, or on a phone in portrait a Done bar above the on-screen keyboard, and, since slice S10
(issue #77), a violet ring at the window's edge with a "Canvas focused" chip while the canvas has
keyboard focus, a line under the palette saying what the active tool does, and the tokens' colours
for pressed, unavailable and focused controls, and, since slice S11 (issue #79), the renderer's
selection outline, handle borders and marquee in the same violet, and, since slice S12 (issue #81),
the chrome's surfaces entering by a short fade and slide, none of them under reduced motion, and the
camera never animated, and, since slice S13 (issue #83), 30 visual-regression baselines of that
chrome on the seeded fixture, Linux images that CI's Chromium made and compares on every run
([visual baselines](quality.md#visual-baselines)). ENG-15 (issue
#33) measures every performance budget, in CI with its benchmarks, browser measurements and
bundle-size guardrail, and the heap by hand; B1, B6 and B7 missed their budgets in CI and B2 on a
slower machine, and they went to issues #34 to #36
([what ENG-15 decided](quality.md#what-eng-15-decided)). Issue #34 has since made the scene layer's
redraw cheaper ([what issue #34 decided](rendering-and-hit-testing.md#what-issue-34-decided)): B2 is
met in every CI report, as before, and B1 in most; B1's misses vary by run on one processor model
([what issue #41 decided](rendering-and-hit-testing.md#what-issue-41-decided)), and issue #49
follows them. Issue #35 has since brought the marquee query within B6 in CI
([what issue #35 decided](rendering-and-hit-testing.md#what-issue-35-decided)), and issue #36 a
change set that moves 1,000 elements within B7 in CI
([what issue #36 decided](scene-and-viewport.md#what-issue-36-decided)). Issue #43 makes the
marquee's kept rows again after a change that left them empty or elsewhere, and reports the first
marquee query after a change or a load beside B6, which times queries of an unchanged scene, with no
budget ([what issue #43 decided](rendering-and-hit-testing.md#what-issue-43-decided)). Issue #38
recorded three runs on `main` as the baseline, one on each of three processors, and gates a run only
by three runs on its own processor, so CI reports only for now
([what issue #38 decided](quality.md#what-issue-38-decided)). The clipboard (P1), document files,
images and offline start (P2) do not exist yet.

The design is derived from two sources only: the merged clean-room behavioural baseline of issue #1
([reverse engineering](../../reverse-engineering/README.md)), which says what users observe, and
Planewright's own engineering judgement, which decides how to build it. No reference source,
package, asset or source map was consulted, and the reference application was not contacted for
this work ([ADR 0003](../../adr/0003-clean-room-reference-policy.md)).

## Principles

1. **Traced behaviour.** Every requirement has an identifier, a basis in the baseline with its
   evidence label, and a disposition: adopted, decided where the baseline is open, or intentionally
   different.
2. **A pure core.** The engine is TypeScript without DOM or Node.js APIs; the platform reaches it
   through ports, so its rules are unit-tested in milliseconds.
3. **One mutation path.** Every document change is a plain-data change set applied by the scene
   store with an origin; history, autosave, rendering and later collaboration all observe that
   path.
4. **Data, not objects.** Documents, change sets, render frames and tool states are serialisable
   values; tools are reducers that return effects.
5. **Incremental delivery.** Each P0 issue adds one tested layer or feature and leaves `main`
   working.
6. **Measured performance.** Each performance requirement has a budget and a measurement.
7. **Accessible by construction.** Every control is named, the canvas content has a
   keyboard-operable equivalent, and state changes are announced.

## Layers

```text
apps/web ─ React shell, canvas host, input adapter, text overlay, IndexedDB, accessibility layer
   │  InputEvent                                  ▲ RenderFrame
   ▼                                              │
@planewright/engine ── editor ─ persistence ─ commands ─ input and tools ─ history, selection, transform
   (no DOM, no Node.js)     └─ scene ─ geometry and camera ─ model ─ math
   ports: clock, scheduler, identifiers, text measurer, repository, announcer
   │  RenderFrame
   ▼
@planewright/render-canvas ── scene canvas and overlay canvas (Canvas 2D)
```

## Documents

| Document                                                       | Covers                                                                                           | Decisions                                                      |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| [Requirements trace](requirements.md)                          | 94 requirements with their basis, disposition and phase; the intentional differences             | none                                                           |
| [Packages, modules and ports](modules.md)                      | package boundaries, the nine engine layers, the ports and the public surface                     | [ADR 0004](../../adr/0004-canvas-engine-package-boundaries.md) |
| [Domain model](domain-model.md)                                | element kinds, geometry, styles, text, groups, order keys, limits and the encoded form           | [ADR 0005](../../adr/0005-document-model.md)                   |
| [Scene store and infinite viewport](scene-and-viewport.md)     | relations and indexes, change sets, previews, the spatial index, the camera and its test vectors | [ADR 0005](../../adr/0005-document-model.md)                   |
| [Rendering and hit testing](rendering-and-hit-testing.md)      | render frames, layers, drawing rules, geometry, hit testing, text layout                         | [ADR 0006](../../adr/0006-canvas-rendering.md)                 |
| [Selection, transforms, input and tools](interaction.md)       | input events, gestures, tool reducers, selection, transforms, text editing, commands             | [ADR 0008](../../adr/0008-input-tools-and-commands.md)         |
| [Undo and redo history](history.md)                            | transactions, entries, merging, conflict-safe undo, limits                                       | [ADR 0007](../../adr/0007-history-model.md)                    |
| [Persistence and import/export](persistence.md)                | what is saved where, autosave, loading, IndexedDB, the codec boundary, interchange formats       | [ADR 0009](../../adr/0009-persistence-and-interchange.md)      |
| [Collaboration-ready interfaces](collaboration.md)             | the guarantees P0 keeps, the exported types, what a later decision settles                       | [ADR 0010](../../adr/0010-collaboration-ready-change-model.md) |
| [Accessibility, testing, performance and security](quality.md) | the accessibility design, the test levels, the performance budgets, security controls            | none                                                           |
| [P0 roadmap](roadmap.md)                                       | ENG-01 to ENG-15 with their dependencies, acceptance criteria and requirements                   | none                                                           |

## Where each requirement area is designed

| Requirement area                   | Designed in                                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Viewport (REQ-V01 to REQ-V11)      | [scene and viewport](scene-and-viewport.md#camera), [interaction](interaction.md#gesture-recogniser)   |
| Creation (REQ-C01 to REQ-C14)      | [interaction](interaction.md#tools), [domain model](domain-model.md#style)                             |
| Selection (REQ-S01 to REQ-S14)     | [hit testing](rendering-and-hit-testing.md#hit-testing), [interaction](interaction.md#selection-model) |
| Transforms (REQ-T01 to REQ-T12)    | [interaction](interaction.md#transforms)                                                               |
| History (REQ-H01 to REQ-H07)       | [history](history.md)                                                                                  |
| Persistence (REQ-P01 to REQ-P08)   | [persistence](persistence.md)                                                                          |
| Model-shaping (REQ-M01 to REQ-M10) | [domain model](domain-model.md#elements)                                                               |
| Interchange (REQ-X01 to REQ-X04)   | [persistence](persistence.md#interchange-formats)                                                      |
| Collaboration (REQ-K01 to REQ-K04) | [collaboration](collaboration.md)                                                                      |
| Accessibility (REQ-Y01 to REQ-Y06) | [quality](quality.md#accessibility)                                                                    |
| Performance (REQ-F01 to REQ-F04)   | [quality](quality.md#performance-budgets)                                                              |

## Changing the architecture

A change to a decision updates the document that states it and, when the decision is
architectural, adds a superseding ADR in the same pull request. A change to a requirement's
disposition updates the requirements trace and the roadmap together; the documentation tests check
that every cited requirement and research identifier exists and that every requirement is planned.
