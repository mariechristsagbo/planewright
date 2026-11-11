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
- Transforms (ENG-10): in the engine, a `transform` layer for moving, resizing by eight handles (one
  element or several, Shift and Alt, a 1-unit floor and zero sizes kept), rotating with 15° Shift
  steps, moving a line's end, duplicating and deleting; drags of the Selection tool that move,
  resize and rotate the selection, each one undo step that Undo and Redo cannot interrupt; Duplicate
  (Mod+D), Delete (Delete, Backspace) and nudges (arrow keys, 10 units with Shift) as commands. The
  page says so, and still has nothing to transform because nothing can be drawn yet.
- Creation tools (ENG-11): in the engine, the rectangle (R), ellipse (O), diamond (D), line (L) and
  freehand (P) tools and tool lock (Q). A drag draws over its box or along the stroke and a tap
  draws a 100-unit shape or line or a dot; each creation is one undo step, and after a shape or line
  the new element alone is selected in the Selection tool unless tool lock is on. A press on a
  selection smaller on screen than two handle hit squares now moves it instead of resizing it. In
  the web app, the tool bar shows the tools and the tool lock toggle, freehand strokes read
  coalesced pointer events, and the page says what can be drawn; text, styles, saving and
  collaboration do not exist yet.
- Text tool and text editing (ENG-12): in the engine, the Text tool (T) places an empty text with
  its left edge at the tap and its first line centred on it, and a text session takes the text
  area's values, measured again through the editor's new text measurer port, until Escape,
  Mod+Enter, a press outside or a tool change ends it. A session is one undo step, a new text left
  empty leaves none, an emptied text is deleted, and a double tap on a text edits it again. In the
  web app, a text area over the canvas edits the text with the shortcuts paused, and the renderer,
  the measurer and the text area use the bundled open-licence fonts of ADR 0011 (Inter, Patrick Hand
  and JetBrains Mono, with their licences), which the page loads before it starts; text formatting,
  styles, saving and collaboration do not exist yet.
- Local persistence and autosave (ENG-13): in the engine, a `persistence` layer with the
  `DocumentRepository` port, the revision rule and the codec over stored records, and an autosave
  scheduler that saves committed changes 300 ms after the last one and at most 1 s after the first,
  never a preview or a text being edited, retries failed saves and stops at another tab's newer
  save; `createEditor` opens a stored document with its camera and selection, the Selection tool and
  an empty history, and texts are measured again when a font finishes loading. A camera that holds
  NaN now gives the default camera, and a creation in a document at the 100,000-element limit makes
  nothing instead of locking the history. In the web app, the drawing is saved in IndexedDB and
  restored on reload, with notices for failed, stale, unavailable and invalid storage and the
  preferences entry; files, exporting and collaboration do not exist yet.
- Accessible element list, live region and focus order (ENG-14): in the engine, the optional
  `Announcer` port, through which the editor announces each selection change, creation, other
  change, undo and redo with its element count, and failed and stale saves; the view's list of the
  drawn elements as last committed; and Enter on the canvas, which creates the active tool's element
  at the centre of the view or edits the one selected text. In the web app, a keyboard-operable list
  of the elements beside the canvas that selects, nudges and deletes them, polite and assertive live
  regions that say the announcements and the storage notices, zoom controls, the specified tab order
  with a visible focus indicator on every focusable element, focus kept off the page when Undo or
  Redo becomes unavailable, the text area closes or the stale notice is answered, interface text at
  4.5:1 or more in the light theme, the only P0 theme, which the page keeps whatever the operating
  system prefers since ENG-15, and touch targets of 24 px or more. Menus and the dark theme do not
  exist yet, and no human accessibility audit has been made.
- Performance harness and budgets (ENG-15): seeded scenes of up to 10,000 elements; Vitest
  benchmarks of hit testing, the marquee, a 1,000-element move and autosave, and of the element
  list's names; Playwright measurements of scene and overlay redraws, the frame that shows a pointer
  move, long tasks while saving and a cached load, read from `performance.measure` around each
  render of a page opened with `?measure`; a bundle-size guardrail that fails `npm run validate` and
  CI; and a CI job that reports every value with the machine it ran on and keeps the report, whose
  statistical budgets fail CI only once three runs on `main` are recorded in
  `docs/performance/baseline.json`. The redraw of 5,000 elements in view, the marquee over 10,000
  and the 1,000-element move miss their budgets in CI, and the redraw while panning misses on a
  slower machine; they went to issues #34 to #36. The renderer's path cache no longer walks itself
  on every lookup, the element list names a long text from its first words only, and the page
  declares the light colour scheme only.
- Performance baseline (issue #38): the three CI runs on `main` that make the baseline, each with
  the machine it ran on, and a gate that compares a run only with the runs on `main` on its own
  processor model, once that model has three; with one run on each of three processors, CI still
  reports the statistical budgets only. Only a push or a manual dispatch of the repository's CI on
  `main`, at its first attempt, with a report that does not fail, is recorded as a run on `main`,
  once and in the order of the runs; other runs are kept only as information. The browser
  measurements remove an earlier run's files before they start, and a page opened with `?measure`
  stops measuring after 10,000 renders.
- Scene redraw (issue #34): the canvas renderer no longer saves and restores the context around each
  element, and sets a colour, width, dash pattern, font or alignment only when it changes within a
  frame; its path cache keeps its use order without taking an entry out and back on each lookup, and
  an element's dash pattern and font are built once per revision. Every pixel and every drawing call
  is unchanged, which a seeded property of the calls and an end-to-end comparison of the scene
  canvas with the earlier drawing check. In CI the redraw of 5,000 elements in view met its budget
  in three of the four reports at the pull request's final head, on AMD EPYC 9V45, 7763 and 9V74
  runners, and missed it in the other, on an EPYC 9V74, with the same code: its slow frames vary by
  run on one processor model (issue #41), and issue #49 follows them. The redraw while panning met
  its budget in every report.
- Marquee query (issue #35): box selection keeps, for each scene, one row per element in drawing
  order, with the edges of the element's world bounds and the extent of its outline points,
  computed as the bounds and the points are but without building a point, and scans the rows while
  the scene is unchanged, so that no query sorts the scene. After a change, a marquee over few
  elements is answered from the spatial index's candidates, and one that meets many of the rows kept
  from before the change makes the rows again, keeping those of the unchanged elements. What a
  marquee selects, and the order of the result, are unchanged, which properties against a scan of
  every element check. On a developer machine the marquee query over 10,000 elements (budget B6)
  fell from 18.9 to 24.2 ms to 0.24 to 0.32 ms at the 95th percentile, and in CI it measured 0.097
  ms on an AMD EPYC 9V74 runner, where `main` had measured 5.7 to 7.1 ms.
- Change sets (issue #36): an update whose patch writes only fields that its element holds is
  checked field by field, with each field's own check, the kind's checks across fields and the
  element's revision, and the new version shares the fields that the update leaves with the one
  before it, which the store checked when it took it; every other update is checked whole as
  before, and a refused set lists the same errors. The spatial index keeps a moved element's entry
  while its bounds touch the same cells, world bounds are computed without building points, and the
  path of a problem is built only once it is found. What a set does and refuses is unchanged, which
  properties against the planner as it was check. On a developer machine a change set moving 1,000
  of 10,000 elements (budget B7) fell from 45.6 to 100.6 ms to 9.5 to 14.4 ms at the 95th
  percentile, and in CI it measured 1.103 ms on an AMD EPYC 9V74 runner, where `main` had measured
  7.5 to 13.3 ms.
- Marquee rows (issue #43): after a change, rows that a change left empty or elsewhere count as no
  rows, and a marquee that meets more than a sixteenth of the elements now, counted among the
  spatial index's candidates or among the kept rows, makes the rows again, so that the next query
  scans them; after delete all and undo, after every element moved away and after most of the
  elements were added, every whole-scene marquee had been answered from its candidates, 18.9 to 33.6
  ms each on a developer machine, where the query after the one that makes the rows again now takes
  0.23 to 0.33 ms. A marquee over few elements still leaves the rows, and with them the ordered
  array they came from, until such a marquee. What a marquee selects, and the order of the result,
  are unchanged, and a marquee still encloses an element by its geometric outline. The performance
  report also lists I4 to I6, the first whole-scene marquee query over 10,000 elements after one or
  1,000 of them moved and just after a load, beside B6, which times queries of an unchanged scene
  only; they have no budget.
- Change-set planning (issue #45): each call of the held-field path reports its checks into a list
  of its own, and a scene store refuses to apply a change set while it plans one, as it refuses one
  while it tells its listeners, so that a value that runs code when it is read, which no change set
  may hold, can neither clear what planning a set reports nor change the scene under the plan; a
  preview, a commit, an undo or a redo asked from such a value is refused the same way. What a
  JSON change set does or refuses, with its errors, is unchanged.
- B1's slow frames in CI (issue #41): `npm run perf:tail` reads the `report.json` files of CI
  performance reports and prints, for each, the median and 95th percentile of the redraw of 5,000
  elements in view (B1) and of the redraw while panning (B2) and B1's frames of 9 ms or more, then
  how many reports missed each budget per processor model. Of the five reports on `main` since the
  merge of issue #34, B1 met its budget in four and missed it in one, on an AMD EPYC 7763, and B2
  met its budget in all five; of all 26 CI reports with the same renderer, B1 missed in 9, on four
  processor models, and B2 in none. A run that misses has a second group of 9 to 28 of its 100
  frames, 1.35 to 1.48 times as long as the others; one processor model gives both results with the
  same code, and on the AMD EPYC 9V74 the runs that missed were slower at the job's hit-test
  benchmark too. Neither the order or direction of the frames, the job's other steps and jobs nor,
  in traces on a developer machine, garbage collection explains it; the warm-up explains at most
  one of the nine misses, and the Azure region is not the sole decider and is unknown on the AMD
  EPYC 7763. What slows such a frame on a runner is not known. The performance report names
  issue #49, which is to trace such frames in CI, as the follow-up of a missed B1 and no issue for
  B2, and the entry of issue #34 above and the rendering design record B1's results by run, not by
  processor model.
- The v0.2 chrome's tokens and typeface (slice S1, issue #53, ADR 0012 decision 8):
  `apps/web/src/styles/tokens.css` holds the v0.2 plan's 114 design tokens as `--pw-*` custom
  properties, P0's style sheet is split into files under `apps/web/src/styles/` with every element
  rule inside `:where()`, and the page's text is set in `Planewright UI`, Inter at 400 and 500 behind
  a metric-matched local fallback. Its 400 face is the canvas's own Inter file, which the browser
  downloads once, and Inter 500 (24,272 bytes, Fontsource 5.3.0) is the one file added. 500 is the
  only emphasis weight, so P0's headings, terms and pre-release pill show 500 instead of 700 or 600.
  Canvas text, its fonts and its measurement are unchanged, and a chrome face that finishes loading
  no longer has every text measured again. No layout rule changed; the new face only wraps P0's text
  differently, so that at 390 px wide the canvas starts 24 px higher.
- The v0.2 full-bleed shell (slice S2, issue #55, ADR 0012 decisions 10 and 13): `EditorShell`
  replaces P0's page. The canvas fills the window and the page never scrolls; the controls float
  over the canvas in islands at its edges, never inside it, so no press on them reaches it: the
  wordmark and a Pre-release tag at the top left, the tool bar at the top centre, an Elements
  toggle at the top right with the storage notices under it, history and zoom at the bottom left,
  and the view readout with the save status at the bottom right. The Reset zoom button shows the
  zoom and is named "Reset zoom, 100%". The element list is in a drawer that the toggle opens,
  closed at every load. The Pre-release tag opens About this build, a modal dialog that holds what
  P0's pre-release pill, notes and footer said, and an empty canvas repeats the pre-release
  sentence. The tab order is Pre-release, the tool bar, the canvas, the notices' buttons while
  storage needs attention, Elements and the list while the drawer is open, then Undo, Redo and the
  zoom controls. The shell is the page's main landmark. While storage needs attention, the notices
  and an open drawer share the height between the top and bottom islands, each scrolling within
  its share, so that every island stays inside the window at the short sizes tested, down to a
  phone's 568 × 320 in landscape, and the focus never scrolls the shell. The layout's media
  queries are in a style sheet of their own, so that a resize across a breakpoint does not make
  the fonts load again and every text be measured again. The tool bar keeps its words until S3
  and wraps at narrower widths; S3 to S13 are not implemented.
- The v0.2 original glyphs and palette (slice S3, issue #62, ADR 0012 decision 3): 35 glyphs drawn
  for Planewright from geometric primitives on a 20 px grid, 34 interface glyphs and the mark, in
  one typed record with an `Icon` component that strokes them 1.5 px wide in the text colour. The
  tool bar is now a palette: each tool shows its glyph with its first key in a corner, hidden from
  screen readers, hairlines split its groups, and tool lock shows a padlock that is closed while it
  is on. Undo, Redo, Zoom out, Zoom in and Zoom to fit show glyphs, Reset zoom keeps showing the
  zoom, Elements keeps its word, and the identity island shows the mark. Every control keeps its
  name, keys and description. The glyph controls and Reset zoom show a tooltip of their name and
  keys after 500 ms of hover or at once on keyboard focus, never on touch, closed by Escape, a press
  or leaving the control. Glyphs and their controls' borders measure 3:1 or more against their
  surfaces. S4 to S13 are not implemented.
