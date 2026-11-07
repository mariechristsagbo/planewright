# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project will
adhere to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) once releases begin. No
release has been published yet.

## [Unreleased]

### Added

- Repository foundation: npm workspaces for `apps/web`, `apps/collab` and `packages/protocol`,
  with Node.js 24.22.1 and npm 11.19.1 pinned.
- Strict TypeScript configuration shared by every workspace.
- Foundation-only web status page built with React and Vite. It is not a drawing editor.
- Collaboration-service skeleton with environment validation, a `/healthz` endpoint and an
  origin-checked WebSocket hello handshake.
- Pre-release protocol package (protocol version 0).
- Quality gates: Prettier, ESLint with complexity guardrails, Vitest unit and integration tests
  with coverage thresholds, Playwright end-to-end scaffolding, file-size and dependency-policy
  guardrails, secret scanning and dependency auditing.
- Commitlint, Husky Git hooks and branch-name validation for `<type>/<issue>-<kebab-summary>`.
- GitHub Actions CI, CodeQL analysis, Dependabot configuration, issue forms and a pull request
  template.
- Governance documents: MIT license, contributing guide, code of conduct, security policy and
  agent instructions.
- Documentation structure with architecture decision records and the investigation process.
- Engine package `@planewright/engine` (ENG-01): the math layer, the clock, scheduler and
  identifier ports, a seeded random source for property tests, an ESLint boundary and a
  layer-order check. It is not a drawing engine yet.
- Document model in the engine (ENG-02): the element, style and document types of every kind,
  identifier, colour, order-key and point-normalisation helpers, the initial default style, and
  `encodeDocument` and `decodeDocument` with the domain model's limits and a migration scaffold.
  Nothing uses it yet.
- Scene store in the engine (ENG-03): element patches checked by the model, change sets and their
  inverse, a store that applies a set whole or not at all with its origin and emits one scene
  update per set, the order, spatial, group and attachment indexes, the world bounds they key on,
  transient previews and transactions that commit one net change set. Nothing uses it yet, and
  history, rendering and input do not exist.
- Undo and redo history in the engine (ENG-04): entries that carry the selection around each
  committed transaction, burst merging by merge key, conflict-safe undo and redo that leave in
  place what another origin changed since, limits of 500 entries and an estimated 50 MB, and the
  availability flags. Committing a transaction is the only way an entry is recorded, and undo and
  redo do nothing while one is open. A throwing scene listener no longer stops the others or
  leaves a transaction half done, and a refused revert leaves its transaction open. Nothing uses
  the history yet, and no Undo or Redo control exists.
- Camera in the engine (ENG-05): the transforms between screen and scene points, panning by a drag
  and by the wheel, zoom about a point, the Mod+wheel zoom curve, the keyboard zoom ladder, zoom to
  fit with the content's bounds, the two-pointer gesture maths, resizing that keeps the viewport
  centre, and the limits of 10 % to 3000 % zoom and a position within 10⁹ units, kept for every
  input. Nothing uses the camera yet: no canvas, input or zoom control exists.
- Geometry, hit testing and text layout in the engine (ENG-06): outlines and signed distances for
  rectangles, ellipses, diamonds, lines, freehand strokes and texts in each element's own frame, a
  text measurer port and text layout, the selection state that the undo history reads and
  restores, hit testing of the selection's handles, then the topmost element within 5 px for a
  mouse or pen and 6 px for touch, then the selection box, handle layout with hit squares of 24 px
  for touch, and box selection of wholly enclosed elements. A selection reader that throws no
  longer leaves the history open. Nothing uses them yet: no canvas, input or selection tool exists.
- Render loop in the engine and the `@planewright/render-canvas` package (ENG-07): render frames
  that carry the visible elements, culled to the viewport and a 64 px margin, and the overlay's
  selection outline, handles and marquee; dirty tracking that redraws only the layers a change
  affects, and at most one frame per animation frame; and a Canvas 2D renderer that draws the scene
  and overlay layers at the device pixel ratio and caches each element's path and text layout per
  revision. Nothing uses them yet: no canvas host or input exists, so nothing is drawn on a page.
- Navigation-only editor surface (ENG-08): in the engine, input events, a gesture recogniser
  (drag thresholds, taps, double taps, long presses, camera drags and two-finger pinch and pan), the
  viewport routing, the Hand tool, a command registry with a keymap that works on US and AZERTY
  layouts, and `createEditor`; in the web app, a canvas host with a scene and an overlay canvas, the
  input adapter with Mod as Cmd on macOS and Ctrl elsewhere, a tool bar and Undo and Redo controls.
  The page pans and zooms an empty canvas and says that nothing can be drawn, selected or edited
  yet; Undo and Redo stay disabled because nothing changes the drawing.
