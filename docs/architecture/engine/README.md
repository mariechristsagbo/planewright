# Canvas-engine architecture

**Status: accepted in issue #3; implementation started with ENG-01 (issue #5).** These documents
design Planewright's canvas engine and split its first usable version into issues. The engine
package holds only its `math`, `ports`, `model`, `scene`, `history` and `camera` modules and the
world and content bounds of `geometry` so far, the camera since ENG-05 (issue #13); nothing uses
the scene, the history or the camera yet, no renderer, input or editor code exists, and the web
app is still the foundation status page.

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
@planewright/engine ── editor ─ commands ─ input and tools ─ history, selection, transform
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
