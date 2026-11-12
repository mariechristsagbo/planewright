# Accessibility, testing, performance and security

This document states how the engine and editor meet the accessibility and performance
requirements, how every requirement is tested, and the security rules that cross all layers.

## Accessibility

A canvas is opaque to assistive technology, so the editor offers a structured, keyboard-operable
equivalent beside it and holds every control to the backlog's "do better" list (REQ-Y01 to
REQ-Y06).

| Part               | Design                                                                                                                                                                                                                                                                                 | Requirements              |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Tool bar           | `role="toolbar"` with a label; one tab stop, arrow keys move between tools; each tool a toggle button with `aria-pressed`, a name, its shortcut in `aria-keyshortcuts` and in its description                                                                                          | REQ-C14, REQ-Y01, REQ-Y03 |
| Canvas host        | a focusable region labelled "Drawing canvas", described by short instructions; it receives the editor's shortcuts                                                                                                                                                                      | REQ-Y02                   |
| Element list       | a list box in the Elements drawer with one option per element, topmost first, named by kind, text and geometry ("Rectangle, 120 by 100, at 300, 180"); see below                                                                                                                       | REQ-Y05                   |
| Live region        | one polite region for selection counts, created and deleted elements, undo and redo, and once that a failed save is saved again; save failures use an assertive message                                                                                                                | REQ-Y04                   |
| Selection          | the selection panel, or on phones the bar and its Details sheet: a `group` named by its heading, read-only figures, no live region; actions named by the registry; see below                                                                                                           | REQ-C14, REQ-Y01, REQ-Y02 |
| Focus              | a visible indicator of at least 2 px with 3:1 contrast on every focusable element; Escape closes a menu or dialog and returns focus to the control that opened it                                                                                                                      | REQ-Y02                   |
| Menus              | `menu` and `menuitem` roles; toggles as `menuitemcheckbox` with `aria-checked`, never a check mark in the name                                                                                                                                                                         | REQ-Y01, REQ-Y03          |
| Targets and colour | every touch target at least 24 × 24 CSS px, and since v0.2's S8 at least 44 × 44 CSS px on phones and under a coarse pointer; text contrast at least 4.5:1 and control contrast 3:1 in each theme; forced-colours mode uses system colours for the interface and the selection outline | REQ-Y06                   |
| Motion             | no camera animation in P0; any later animation is skipped when reduced motion is requested                                                                                                                                                                                             | REQ-Y06                   |

**Element list.** Up and Down move through the options; Space toggles an element in the selection
and Enter selects it alone; Delete deletes the selection; Alt+arrow keys nudge it by 1 unit and
Alt+Shift+arrow keys by 10. The list selects through `Editor.select` and reads the editor's view,
so selection is shared with the canvas both ways. The list renders only the options near the
focused one for large documents, with `aria-setsize` and `aria-posinset`, so its cost stays flat.

**Keyboard creation.** With a creation tool active and the canvas focused, Enter creates the
tool's default-size element at the centre of the viewport, so no element kind needs a pointer
(REQ-C04, REQ-Y05).

**Order of tab stops.** The menu button, Pre-release, the tool bar, the canvas, the selection
panel's actions while something drawn is selected and no text is edited (Duplicate, Delete and, for
a text that Enter would edit, Edit text, or on a phone in portrait the bar's actions and Details,
then the open Details sheet's Close), the storage notices' buttons while storage needs attention,
Elements and, while its drawer is open, the drawer's Close, its keys' summary and the element list,
history controls, zoom controls and Keyboard shortcuts (ADR 0012, decision 14, as far as slices S2
to S6's controls go). On a phone in portrait the open Elements or Details sheet makes the tool bar
and the bottom islands inert, so that they leave the order while it is open. On phones since S8 the
order is the same in every layout: the tool bar's one stop is third, Selection first in the portrait
dock, which sits at the window's bottom, and Hand first in the landscape palette; More's items join
the order only while its popover is open, after More; Keyboard shortcuts follows only where it
shows, in landscape, its island not shown in portrait; and when More, its popover or a window that
turns takes away the focused control, the focus goes to the tool bar's stop, or from Keyboard
shortcuts to the menu button, as it does when that button's dialog closes in portrait, never to the
body. P0's order was the tool bar, the canvas, the element list, history and zoom.

All interface text comes from message keys; P0 ships English and sets the document language.

### What ENG-14 decided

ENG-14 implements this section: the announcer port, the view's elements and keyboard creation in
the engine, and the element list, the live region, the zoom controls and focus management in
`apps/web`. It decided what the rules above leave open:

- **Announcements.** `announcer` is an optional port of `createEditor`; an editor without one
  announces nothing. After each input, command or call the editor announces at most one thing: the
  last history entry that a commit, an undo or a redo made, as `change`, `undo` or `redo` with its
  label, its element count, a lone element's kind and the selection count after it, or else, when
  the selection holds other elements than it last said, `selection` with the new count. A save that
  has just failed, or failed for another reason, is `save-failed` with its reason, and one refused
  as stale is `save-stale`; a retry that fails for the same reason and a save that succeeds again say
  nothing, since the notices stay until then. Since v0.2's slice S7 the web app, not the engine,
  says "The drawing is saved again." politely, once, when a failed save, with any pending saves
  after it, succeeds; a stale save or no storage forgets the failure, and routine saves say
  nothing. The selection a stored document opens with is not
  announced. The web app says each key in English, as in "Rectangle created. 1 element selected."
  or "Undid move of 2 elements. 2 elements selected."
- **The live region.** Two visually hidden regions, `aria-live` polite and assertive and
  `aria-atomic`, are put at the end of the page's body at start-up, before anything is said, and
  carry no role, so that the page's status kept the only `status` role; since slice S2 the
  pre-release sentence that it held is in About this build, and the page has no `status` role. A
  message empties its
  region at once and is written 100 ms later, so that a repeat is announced again and only the
  latest of quick messages is written. Failed and stale saves and the start-up notices for
  unavailable or invalid storage are assertive. The notices, below the canvas in P0 and under the
  top-right island since S2, are no longer `role="alert"` elements but a "Storage notices" region
  shown only while one applies (the ENG-13 review's s2). Since S7 the region has a Hide button,
  last, which folds it into the "Not saved" chip's button, `aria-expanded="false"` and
  `aria-controls="notices"`; nothing about saving shows or is said while saving works. The polite
  region writes only the latest of messages that come within 100 ms, so a change's announcement and
  the recovery sentence, should they coincide, replace one another; S7 leaves the region as it is.
- **The element list.** The editor's view gains `elements`, the drawn elements in drawing order as
  last committed: while a gesture or a text session holds the history's transaction it keeps the
  list from before, so that the list never shows a preview and a drag publishes no view. The list
  box sat under the canvas and its instructions, so that the canvas kept its size; since slice S2 it
  is in the Elements drawer, closed at every load, which since S5 mounts the list only while it is
  open. It names each
  element "Kind, width by height, at x, y" from its unrotated box in scene units to one decimal, a
  text by its first 40 characters on one line, with ", turned N degrees" for a turn. Since S5 each
  row shows its kind's glyph, a label, the kind or a text's words in quotation marks, and its
  figures in JetBrains Mono, as "120 × 100 · 300, 180", while the option keeps that name as its accessible
  name, through `aria-label`, so that a screen reader says P0's words and never the row's shorter
  text; the row's words and figures are each words of the name. The open list's options are
  memoised on the elements, the selection and the active position, which a camera change keeps, so
  that a pan step renders none of them again, and each row on its element. It keeps the
  focus and points at its active option with `aria-activedescendant`, so that a deletion never moves
  the focus: the next option becomes active. Home and End go to the ends; the list's own keys ignore
  Shift; Left and Right without Alt do nothing; Alt+arrow keys reach the editor as the canvas's
  arrow keys, so that a held key's repeats make one undo step; every other key reaches the keymap. A
  click selects an element alone, and a Shift or Mod click adds or removes it. A drawing of more
  than 101 elements renders the 101 options around the active one.
- **Keyboard creation.** `canvas.enter` (Enter) lets go of any press and gives the active creation
  tool a tap at the centre of the viewport, so that it makes what a tap there makes, a 100 × 100
  shape, a 100-unit line, a freehand dot or a text opened for editing, as one undo step. With the
  Selection tool and one selected text it edits that text again, as a double tap does. It does
  nothing while a transaction is open, and the tool bar leaves Enter and Space to its focused
  button.
- **Focus.** The tab stops were the tool bar's one stop, the canvas, the element list, Undo, Redo,
  Zoom out, Reset zoom, Zoom in and Zoom to fit; since slice S2 they are those of the order above.
  The zoom controls read the command registry and show each command's first shortcut, and since S2
  Reset zoom shows the zoom and is named by it, "Reset zoom, 100%". Every focusable element shows a
  3 px outline in `#2a62d0`, 5.3:1 against the page, and the text area a 2 px one; since S2 the
  canvas host, as large as the window, draws its outline 3 px inside its edge. Undo and Redo are
  unavailable through `aria-disabled`, not `disabled`, because Chromium moves the focus of a button
  that becomes disabled to the page's body. Escape or Mod+Enter in the text area returns the focus
  to the canvas, which opened it; moving the focus to another control ends the session, while a page
  that loses the focus keeps it; answering the stale notice focuses the canvas first (the ENG-13
  review's m5). P0 had no menu or dialog. Slice S2 added About this build, a modal dialog that the
  Pre-release tag opens with the focus on Close, Tab wrapping inside, and Escape or the scrim
  closing it and returning the focus to the tag. Slice S4 added the identity island's menu, the
  first tab stop: its button, with `aria-haspopup`, `aria-expanded` and, while it is open,
  `aria-controls`, opens it on a press, Enter, Space or ArrowDown with the focus on its first item;
  the arrow keys, wrapping, Home and End move; Enter or a press runs an item, closes the menu and
  returns the focus to the button; Escape closes it and returns the focus; the focus leaving it, by
  Tab or a press elsewhere, closes it where the focus went; and the window losing the focus to
  another window closes it with the focus on the button, where it is when the window comes back,
  rather than on the page's body (the S4 review's m2). Its items are `menuitem`s and one
  `menuitemcheckbox`, Show elements, whose `aria-checked` is the drawer's state; their keys,
  shown in JetBrains Mono, are hidden from assistive technology, since each name and
  `aria-keyshortcuts` carry them. S4 also added the Keyboard shortcuts dialog, the same modal dialog
  as About, which the menu and a button at the bottom right, the last tab stop, open. A dialog
  returns the focus to the control that opened it, the menu button for one opened from the menu.
  Slice S5 gave the Elements drawer its focus: its opening, by the toggle or the menu's Show
  elements, puts the focus on the list box, and its closing, by the toggle, Show elements, its
  Close or, on a phone, Escape, on the toggle, so that the focus never stays on a control that went
  with it. The toggle's count of the elements is hidden from assistive technology, so that its name
  stays "Elements" and a change is said once, by the live region. The list's keys are folded under
  a Keys summary, which P0's focus ring now covers, while a visually hidden copy outside the fold
  keeps describing the list box, since Chromium describes nothing by what a closed details element
  holds. On a phone in portrait, under 600 px wide and at least 500 px high, the open drawer is a
  sheet along the window's bottom, at most 62 % of its height, whose list scrolls inside it; while
  it is open the tool bar, which S8 makes the phone's dock, and the bottom islands are `inert`,
  their controls in a box that keeps a press on them from reaching the canvas, and Escape in the
  sheet closes it and goes no further, so that the selection stays. Slice S6 added the selection
  panel, out of the page unless something drawn is selected and no text is edited, so that it has
  no tab stop otherwise: a `group` named by its heading, the kind's name or "N elements", neither a
  landmark nor a live region, since the polite region already says every selection and command;
  its figures are static text in a description list, W and H read as Width and Height. Duplicate
  and Delete take their names, `aria-keyshortcuts`, descriptions and tooltips from the registry, and
  Edit text is described as doing what Enter on the canvas does; each shows its word, which names
  it. Duplicate keeps the focus; Delete, or the panel going for any reason with the focus inside
  it, gives the focus to the canvas, never to the page's body; Edit text gives it to the text area,
  and when the session ends the canvas takes it back. On a phone in portrait the selection bar takes
  the panel's place and tab stops, its actions 44 px glyph buttons whose words are visually hidden,
  then Details, with `aria-expanded` and `aria-controls`, which opens the Details sheet, a region
  named "Details" with the focus on its Close; Close or Escape closes it with the focus back on
  Details, the Escape going no further. Opening the Details or the Elements sheet closes the other,
  the one that opens taking the focus. The sheet closes when the selection empties, the focus going
  to the canvas if it was in the sheet or the bar, when a text session starts and when the window
  leaves the phone's query; it is closed at every load and stored nowhere.
- **Targets, colour and motion.** Controls are at least 24 px, the page's link, in About this build
  since S2, is a 24 px inline block, the menu's items, its link among them, are 36 px high since S4,
  and touch handle hit squares stay 24 px; the selection panel's actions are 32 px high, 44 px under
  a coarse pointer, and the phone's bar's targets and the Details sheet's Close 44 px. Since S8
  every target is at least 44 by 44 px on phones, in portrait and in landscape, and under a coarse
  pointer (REQ-Y06, the v0.2 plan's responsive rule 6): the islands' buttons, the menu's items, the
  drawer's Close, its keys' summary, the list's options and the Details sheet's Close; desktops keep
  36 px and compact layouts 32 px with a fine pointer, and touch handle hit squares stay 24 px.
  Measured in Chromium, the shortcut hint in a pressed tool button was 4.19:1 and is now opaque,
  5.59:1, and an unavailable control is dark grey with a dashed border, 7.2:1, instead of half
  transparent, 3.36:1. Each camera command and wheel event sets the camera once, drawn whole in the
  next frame with no frame after it, and nothing in the page animates, with or without reduced
  motion.
- **No rule engine.** No automated rule engine, such as axe-core, is added: it would be a new
  dependency, and the checks P0 needs, focus order and indicators, contrast measured from computed
  colours, target sizes and roles, run in Playwright and Vitest without one. A manual screen-reader
  pass stays a task before each release; no human accessibility audit has been made.
- **Not here.** Menus other than slice S4's (P1), the dark theme (P2), forced colours, other
  languages, a type-ahead in the list and the list's performance measurements (ENG-15).

## Testing strategy

Each issue writes its failing tests first and records that failing run in its pull request. A test
that proves a requirement names it in its title, for example
`it('REQ-V02 keeps the viewport centre when zooming in', …)`, so a search for an identifier lists
its tests.

| Level              | Runs in                                                | Covers                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------ | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Engine unit        | Vitest `engine:unit`, Node.js, no DOM                  | math, codec, order keys, geometry and distances, camera, scene store and indexes, history, selection, transforms, gestures, each tool reducer, commands                                                                                                                                                                                                                    |
| Engine properties  | Vitest, seeded generators in the engine's test helpers | invariants over random inputs: see below                                                                                                                                                                                                                                                                                                                                   |
| Engine integration | Vitest `engine:integration`                            | an editor with fake ports driven by scripted input sessions: document, selection, history, autosave and `remote` change sets                                                                                                                                                                                                                                               |
| Renderer unit      | Vitest `render-canvas:unit`                            | draw calls recorded by a fake 2D context for fixture scenes; device-pixel transforms; path-cache invalidation                                                                                                                                                                                                                                                              |
| Web unit           | Vitest `web:unit`, jsdom                               | the input adapter's event mapping (pointer, wheel modes, Mod per platform), the tool bar, element list and live region by role                                                                                                                                                                                                                                             |
| End-to-end         | Playwright, Chromium, production build                 | desktop 1280 × 720 and an emulated phone (390 × 844, DPR 3, touch, in portrait, where S8 puts the tool bar in a dock at the bottom with More; S8's tests add 375 × 667, 360 × 560, 844 × 390 and 568 × 320, and emulate safe-area insets with the shell's custom properties): every P0 flow, reload, keyboard-only use; state read from the element list and the ARIA tree |
| Visual             | Playwright screenshots                                 | Planewright's own rendering of fixture documents at DPR 1 and 2, compared with committed baselines of its own output                                                                                                                                                                                                                                                       |
| Benchmarks         | Vitest bench and a Playwright trace                    | the budgets below                                                                                                                                                                                                                                                                                                                                                          |

- **Test vectors from the baseline.** The camera table in [scene and viewport](scene-and-viewport.md#test-vectors-from-the-baseline),
  the hit ladder of REQ-S03, the creation boxes of B-01, the resize boxes of B-16, the duplicate
  offset of B-18 and, in P1, the paste centring of B-26 become fixed expectations. They are
  numbers the baseline observed, not code.
- **Properties.** Screen to scene to screen is the identity; zooming about a point keeps that point;
  a generated order key lies strictly between its neighbours and never ends with `0`; renormalising
  a rotated point element moves none of its unchanged points; decoding an encoded document gives it
  back; undo then redo restores the document; a cancelled transaction leaves the document unchanged.
  Generators are seeded, and a failure prints its seed. They use no new dependency: `createRandom`
  in `math` is the seeded source, and `checkProperty` in the engine's test helpers names the seed,
  the run and the generated value of a failure.
- **Determinism.** Engine code never calls `Math.random`, `Date.now` or timers directly; an ESLint
  rule in the engine block enforces it, and the ports supply them.
- **Coverage.** The repository thresholds stay at 90 % statements, 85 % branches, 90 % functions
  and 90 % lines; the engine package adds its own thresholds of 95, 90, 95 and 95 %, and its `math`
  layer must be covered in full; the renderer package holds the engine's thresholds too.
- **Storage.** The repository's revision and delta logic is unit-tested with the in-memory
  repository; the IndexedDB adapter is tested end to end in Chromium, so no IndexedDB emulation is
  added.
- **Accessibility checks.** Role and name assertions run in unit and end-to-end tests. Whether an
  automated rule engine is added is decided, with a dependency review, in the accessibility issue.
  A manual screen-reader pass is recorded before each release.
- **Comparison with the baseline.** The later behavioural comparison phase measures Planewright
  against the baseline's committed numbers. It never contacts the reference application without a
  new investigation issue.

## Performance budgets

Automated budgets run on the CI runner (`ubuntu-24.04`); the frame budgets are also checked by hand
in Chromium with a 4× CPU slowdown as a low-end proxy. "Scene" means a mix of the P0 kinds.

| Budget                                                            | Target                                                                  | Measured by                                       | Requirements |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------- | ------------ |
| Scene layer redraw, 5,000 elements all visible                    | ≤ 8 ms, 95th percentile                                                 | `performance.measure` around `render`, Playwright | REQ-F01      |
| Scene layer redraw while panning, 5,000 elements, a tenth visible | ≤ 4 ms, 95th percentile                                                 | the same                                          | REQ-F01      |
| Overlay layer redraw                                              | ≤ 1 ms, 95th percentile                                                 | the same                                          | REQ-F02      |
| From a pointer event to the frame that shows it                   | the next animation frame                                                | event and frame timestamps, Playwright            | REQ-F02      |
| Hit test at a point, 10,000 elements                              | ≤ 0.2 ms                                                                | Vitest bench                                      | REQ-F01      |
| Marquee query, 10,000 elements                                    | ≤ 2 ms                                                                  | Vitest bench                                      | REQ-F01      |
| Apply a change set moving 1,000 elements, indexes included        | ≤ 4 ms                                                                  | Vitest bench                                      | REQ-F01      |
| Autosave of a 50-element change, main-thread time                 | ≤ 4 ms, and no task over 50 ms                                          | Vitest bench; long-task observer, Playwright      | REQ-F03      |
| Cached load to the first editor frame, 1,000 elements             | ≤ 1.5 s                                                                 | navigation and frame timestamps, Playwright       | REQ-F04      |
| Bundle size, minified and gzip-compressed                         | engine ≤ 60 KB, renderer ≤ 15 KB, web app's initial JavaScript ≤ 200 KB | a guardrail script over the build output          | REQ-F04      |
| JavaScript heap, 10,000 elements and a full history               | ≤ 150 MB                                                                | a heap snapshot, by hand, before each release     | REQ-F01      |

Benchmarks start as reports. Once three runs on `main` on the runner's processor model give a
baseline ([what issue #38 decided](#what-issue-38-decided)), a result more than 20 % worse than its
budget or baseline fails CI. Raising a budget needs an ADR, like raising a guardrail.

### What ENG-15 decided

ENG-15 (issue #33) measures every row of the table above in CI and reports its value. It decided
what the rules above leave open:

- **Where each budget is measured.** B5 to B8 are Vitest benchmarks of engine code in Vitest's
  benchmark mode, `npm run perf:bench` with `vitest.bench.config.ts`, apart from the test and
  coverage runs; they import natively, since Vitest's module runner puts export getters on every
  call between modules and warns that they distort the results. B1 to B4, B9 and B10 are Playwright
  tests in `apps/web/tests/perf`, `npm run perf:browser`, against the production build at
  1280 × 720 in Chromium, one test at a time and without retries. A page opened with `?measure`
  wraps each `render` in `performance.measure`, named `planewright:render-scene` for a frame that
  redraws the scene layer, with the overlay drawn with it, or `planewright:render-overlay` for one
  that redraws only the overlay; without the parameter nothing is measured. B11 to B13 are
  `npm run check:bundle-size`: the engine's and the renderer's entries bundled and minified on their
  own by esbuild, the renderer without the engine, and the build's initial scripts, each compressed
  at gzip level 9 and read in KB of 1,000 bytes. B14 stays a heap snapshot by hand before each
  release, as no automated measurement of a full history ran reliably enough for CI. The table's
  rows are budgets B1 to B14 in `scripts/lib/perf-budgets.ts`, one per target, and a test fails when
  the two differ.
- **Scenes.** Every measurement draws a seeded scene of the six P0 kinds, five, four, three, three,
  three and two of every twenty, a quarter of them turned and three tenths of the closed ones
  filled, each element in its own cell of a grid over an area (`perfElements` in the engine's test
  support). The engine's benchmarks use 10,000 elements over 8,000 × 4,500 units; B1, B3 and B4 use
  5,000 elements all in view at zoom 1; B2 and the pan steps use 5,000 over ten times the view, of
  which the renderer draws 719 to 774, since it also draws what lies within 64 px of the view; B9
  uses 5,000 and B10 1,000. The browser tests store a scene in IndexedDB as a whole save writes it
  and open the page again, so the page loads it as a cached drawing.
- **What each sample is.** B1: one scene render during wheel pans of 2 px back and forth, 100 after
  20 warm-up frames. B2: one scene render of a loop of 110 wheel steps of 20 px, 100 after 10. B3:
  one overlay render of a marquee dragged in 60 steps, those after the first 5. B4: for each pointer
  move of that marquee and of a Hand tool drag, the animation frames from the move to the frame of
  the first render after it, from probes that the page runs before its own scripts; 1 is the next
  frame. B5: one hit test at one of 64 seeded points, 2,000 after 400 warm-up iterations. B6: one
  marquee query of a marquee dragged from the scene's corner to its far corner in 32 steps, 640
  after 128, over a scene that does not change, whose rows the check before timing has made since
  issue #35, so a warm query ([what issue #43 decided](#what-issue-43-decided)). B7: one change set
  moving 1,000 elements by one unit and back, 400 after 80. B8: the save that autosave starts for a
  50-element change made untimed before it, from its timer to its result, over the in-memory record
  backend, 300 after 60. B9: the long tasks that overlap each of eight saves, from the frame after a
  50-element nudge until the stored revision rises and the page says it is saved, which since v0.2's
  slice S7 the shell's root says with `data-save-state="saved"`, since the page shows nothing. B10:
  the end of the first render that draws all 1,000 elements, from the navigation's start, over
  twelve loads after one that fills the cache. Every test first checks what it measured, such as the
  hit test
  against a scan of every element or the number of elements each frame drew, and fails at once when
  the check does.
- **Statistics and clocks.** A budget's value is the 95th percentile of its samples, interpolated
  linearly between the closest ranks, the largest sample for B4 and B9, or the one value of a
  bundle. Vitest's runner times benchmarks with `performance.now()`. Chromium coarsens
  `performance.now()` to 100 µs on a page that is not cross-origin isolated, so the browser's render
  times are multiples of 0.1 ms, which B3's 1 ms budget can still tell apart. No test sleeps to
  measure or compares a timing with a fixed value.
- **The report and the baseline.** `npm run perf:report` merges the results in `perf-results/` with
  the machine (processor, cores, memory, system, runner image, Node.js and Chromium versions,
  commit, branch, event and run) into `report.json` and `report.md`, and writes the Markdown to the
  CI job's summary. The CI job "Performance report" runs it on every pull request, every push to
  `main` and every manual dispatch, and keeps `perf-results/` as the `performance-report` artifact
  for 90 days; it is not a required check. `docs/performance/baseline.json` keeps recorded runs,
  with the issue that will fix each missed budget. A run on another branch, such as this pull
  request's first run, is kept there as information and never counts.
- **When a statistical budget starts to fail CI.** A budget measured in CI that was not measured,
  a failed check and a bundle over its budget fail at once. Every other budget reports only, until
  the baseline holds three runs on `main`, recorded in this order:
  1. Run 1/3 is the CI run of the push that merges this pull request: download its report with
     `gh run download <run id> --name performance-report --dir perf-results/main-1`.
  2. Runs 2/3 and 3/3 are the next two CI runs on `main`, from pushes or from
     `gh workflow run CI --ref main`, with no failed or cancelled performance job between them;
     after one, the count starts again from the next run. Download each in the same way.
  3. A pull request for its own issue records them with
     `npm run perf:baseline -- --label "main run 1/3" perf-results/main-1/report.json`, and so on
     for 2/3 and 3/3, and commits the baseline.
  4. From that commit on, a budget that all three runs measured fails CI when its value is more than
     20 % above the larger of its target and its baseline, the slowest of the three runs: a met
     budget may not drift more than 20 % past its target, and a missed one more than 20 % past what
     `main` measured while its issue is open. Issue #38 keeps this rule and applies it to the runs
     on each processor model on its own ([below](#what-issue-38-decided)).
- **Misses, in CI.** The first CI run, on this pull request's merge (run 42626128521, a 4-core AMD
  EPYC 9V74, runner image ubuntu24 20261101.360.1, Chromium 156.0.8078.4, Node.js 24.22.1), misses
  B1 at 13.92 ms (issue #34), B6 at 7.13 ms (issue #35) and B7 at 13.34 ms (issue #36), all at the
  95th percentile. It meets every other budget measured in CI: B2 at 2.8 ms, B3 at 0.1 ms, every
  pointer move of B4 shown in the next frame, B5 at 0.078 ms, B8 at 0.118 ms, no long task in any
  save of B9, B10 at 0.122 s, and the engine at 28.873 KB, the renderer at 2.082 KB and the web
  app's initial JavaScript at 106.889 KB. The baseline keeps that run as information; it is none of
  the runs on `main`, which issue #38 recorded.
- **Misses, on a slower machine.** On a shared developer machine (a 6-core AMD EPYC at a load of 2
  to 3.5, the same Chromium and Node.js), three runs of each benchmark and four to seven of each
  browser measurement gave B1 41 to 52 ms, B2 10 to 27 ms (missed there, so issue #34 took it too),
  B6 19 to 21 ms and B7 42 to 133 ms; B5 0.149 to 0.501 ms, over its budget in two of the three runs
  whose samples were kept, and B10 0.56 to 1.82 s, over its budget in one of five; B3, B4, B8, B9
  and B11 to B13 met in every run. These values say how much a budget moves with the machine and its
  load; CI's are the ones the gate reads. The measurement found one quadratic cost and ENG-15
  removed it: the renderer's path cache walked its whole map on each lookup, which had put B1's
  median at 68 ms there.
- **Low-end check.** With Chromium's CPU slowed down four times, once on the same machine at
  54425f4, B1 was 87 ms at the median and 433 ms at the 95th percentile, B2 17 and 61 ms, B3 0.8 ms
  at the 95th percentile, and every pointer move was shown in the next frame.
- **The element list (the ENG-14 review's s4).** A pan renders the list's 101 options again. I1
  reads the main thread's busy time from each pan step of B2's loop to the frame after its render:
  15.1 ms at the median and 16.7 ms at the 95th percentile in CI, and 38 to 46 ms at the median on
  the developer machine, most of it Chromium committing both canvas layers there, 13 to 24 ms a
  frame without a GPU, and the render, not the list. I2 does the same with the 101 listed options
  texts of 100,000 characters, which took 141 ms while a name processed a text's whole content; a
  name now reads a text only until its 41st character, and I2 fell to 38 to 42 ms there, as I1, and
  is 15.5 ms at the median in CI. I3, the naming of those 101 texts in Vitest, fell from 129 ms to
  0.41 ms at the median, so names are not cached. The list still renders only the options around its
  active one: a screen reader reaches only those in the page, and Up, Down, Home and End move the
  window. Since slice S2, I1 pans with the Elements drawer closed and I2 opens the drawer through
  its toggle before it pans (ADR 0012's test migrations). Since S5 the closed drawer mounts no list, so
  that I1 measures a pan step without it, and the open list's options are memoised, so that I2's pan
  steps render and name none of them again; I3 times the names that a change of the elements, the
  selection or the active option makes again.
- **The heap (B14).** By hand before each release: open the production build in Chromium with a
  stored drawing of 10,000 elements all selected, which the browser tests' `storeScene` can store,
  nudge them with the arrow keys until the history holds its 50 MB of change data, collect garbage
  and read the JavaScript heap from a heap snapshot in the developer tools. Measured once that way
  at 54425f4, through the DevTools protocol's garbage collection and heap usage rather than a
  snapshot, it was 16.8 MB after loading and at most 57 MB with the history full after 60 nudges,
  within its 150 MB.
- **Light only.** P0 ships the light theme only, so the page declares `color-scheme: light` and has
  no `prefers-color-scheme` rule (the ENG-14 review's m1): a dark preference of the operating
  system changes nothing, and an end-to-end test with that preference measures the interface text
  at 4.5:1 or more and the list's active-option outline at 3:1 or more.
- **Not here.** The fixes of the misses (issues #34 to #36), any budget raised, the dark theme, and
  the ENG-11 review's m2 (the freehand preview's cost), which no budget measures.

### What issue #38 decided

Issue #38 recorded the baseline that ENG-15 planned and decided how its gate deals with CI runners
that differ in processor (the ENG-15 review's m1, s2, s3 and s4).

- **The three runs on `main`.** CI runs 87, 88 and 89 of `main` at `4db483f` are its first three
  runs with the performance report: the push that merged ENG-15 and two manual dispatches, every
  job of each successful, with no other CI run on `main` between them. Each ran on 4 cores with
  15.6 GiB, runner image ubuntu24 20261101.360.1, Node.js 24.22.1 and Chromium 156.0.8078.4, and
  each on another processor:

  | Run | CI run      | Event             | Processor                 | `performance-report` artifact |
  | --- | ----------- | ----------------- | ------------------------- | ----------------------------- |
  | 1/3 | 42640366479 | push              | Intel Xeon Platinum 8370C | 13684528982                   |
  | 2/3 | 42641527515 | workflow_dispatch | AMD EPYC 9V74             | 13686076108                   |
  | 3/3 | 42642158624 | workflow_dispatch | AMD EPYC 9V45             | 13686341225                   |

  `docs/performance/baseline.json` holds them, recorded with `npm run perf:baseline` from the
  `report.json` of each artifact, after the pull-request run that ENG-15 kept as information.

- **What they measured.** At each budget's statistic, in the order of the runs: B1 10.9, 11.62 and
  10.61 ms; B2 3.205, 2.3 and 2 ms; B3 0.1 ms in each; B4 1 frame in each; B5 0.075, 0.058 and
  0.15 ms; B6 9.247, 5.911 and 4.302 ms; B7 15.134, 11.681 and 5.815 ms; B8 0.155, 0.11 and
  0.075 ms; B9 no task in each; B10 0.123, 0.1 and 0.082 s; and the bundles 28.873, 2.082 and
  106.889 KB in each. B1, B6 and B7 miss in all three (issues #34 to #36), and every other budget
  is met in all three. The largest of the three values of B1, B2, B5 to B8 and B10 is 1.1 (B1) to
  2.6 (B5, B7) times the smallest. The two pull-request runs of ENG-15 ran on the two AMD models
  with the same engine code, and differ from the run on `main` on the same model by up to 1.23 times
  for a missed budget (B7 on the EPYC 9V45, 7.161 and 5.815 ms) and 3.5 times for B5 (0.043 and
  0.15 ms on the EPYC 9V45), which is met far below its limit.
- **A baseline per processor.** A baseline of every run on `main` takes its limit from the slowest
  processor: B7's would be 18.16 ms, from the Xeon, so a run on the EPYC 9V45 could become three
  times slower and pass, and a baseline from a faster processor would fail a slower one with no
  regression. So a run is compared only with the runs on `main` recorded on its own processor
  model, the name that Node.js gives the runner's first CPU. Once a model has three, a budget that
  the last three measured fails when its value is more than 20 % above the larger of its target and
  the slowest of those three; the tolerance, the budgets and the rest of ENG-15's rule are
  unchanged. Until then the run reports only, and its report says how many of the three runs its
  processor has. Runs on other processors never move its limit, and runs kept as information never
  count. A budget measured in CI that was not measured, a failed check and a bundle over its budget
  still fail at once.
- **The gate today.** Each of the three processors has one run on `main`, so none has a baseline
  and CI reports the statistical budgets only. No tolerance was widened to make up for the
  variance: a processor is gated once its own runs show what it measures. A test reads the committed
  baseline, so this paragraph changes with it.
- **What counts as a run on `main`.** A run of this repository's CI on `main`, from a push or a
  manual dispatch, at its first attempt, at a full commit id, whose report has no failure.
  `npm run perf:baseline` records it only after the last recorded run on `main`: with a larger run
  id, and at a commit on `origin/main` that is that run's commit or a later one, as Git shows. A run
  id is never recorded twice, whatever its attempt. A pull request's run, a fork's run, a re-run or
  a run from any other event is refused, and `--information` keeps one as information, which never
  counts; a local report is refused even then. The report reads only a baseline whose runs on `main`
  are in increasing run-id order, each once, and whose every run keeps its machine (processor,
  cores, memory, system, runner image, Node.js and Chromium).
- **Consecutive runs, audited.** Every recorded run keeps its address, with its run id and attempt,
  so a run on `main` left out between two recorded ones shows in the list of CI runs on `main`,
  `gh run list --workflow CI --branch main --json databaseId,number,event,conclusion,headSha`. Runs
  are recorded in order as they come, the slower ones too, so that no processor's baseline is a
  choice of its fastest runs; the tool refuses an older run but cannot see one left out.
- **The next runs.** Further runs on `main`, from pushes or `gh workflow run CI --ref main`, are
  recorded by a pull request in the same way until a processor has three, whose own runs then gate
  its runs. The spread between runs on one model above is why the reference is the slowest of the
  three rather than their median; should a processor's gate fail with no change to the code it
  measures, the remedy is more runs or an ADR, as for any budget, not a wider tolerance in passing.
- **Local runs.** `npm run perf:browser` removes an earlier run's measurements at the same CPU
  slowdown before its first test, so that the report can no longer read a file that a failing test
  did not write again (s3). A page opened with `?measure` measures at most 10,000 renders, about
  three minutes at 60 frames a second, and then draws without measuring, so that its timeline stays
  bounded (s4).
- **Not here.** Fixing B1, B6 and B7 (issues #34 to #36), raising a budget or the tolerance, the
  runs a processor still needs, and a key finer than the processor model: runs on one model with
  another runner image, Chromium or Node.js share its baseline, and each run records them so that
  such a change shows.

### What issue #43 decided

Issue #43 measures the marquee query that B6 does not time (the review of issue #35's pull
request, its m2), with no budget:

- **B6 is a warm query.** B6 is as ENG-15 defined it: one query of a marquee dragged from the
  scene's corner to its far corner in 32 steps, 640 samples after 128. Since issue #35 the check
  before timing makes the scene's rows, so every sample scans the rows of a scene that has not
  changed since. The editor runs one query, when a marquee is released, and that query usually
  follows a change or a load
  ([what issue #43 decided](rendering-and-hit-testing.md#what-issue-43-decided)).
- **I4 to I6.** `packages/engine/tests/bench/marquee-cold.bench.ts` times the first query of a
  marquee 100 units larger than the scene's area on every side after a change or a load of the
  benchmarks' 10,000 elements (seed 15): I4 after the element at 5,000 in drawing order moved by
  one unit, I5 after every tenth element, B7's 1,000, moved so, each 200 samples after 40, and I6
  of the scene just loaded into a new store as one load change set, 50 samples after 10, since a
  load takes about a quarter of a second on the developer machine. Before each sample, warm-up
  included, an untimed change moves those elements by a unit and back in turn, or a new store
  loads the scene, and the store's ordered elements are read, as the editor's view reads them after
  every gesture. Vitest drops the warm-up samples, which warm the code but never the rows, so every
  timed query is the first after its change or load. Each benchmark first checks that the first
  query after two such changes or loads encloses what a scan of every element encloses, all 10,000,
  and afterwards that every iteration, warm-up included, followed its own change or load.
- **In the report.** The report lists I4 to I6 under "Other measurements, no budget" at the 95th
  percentile, read against B6's 2 ms, and its `report.json` in the `performance-report` artifact
  keeps every sample. No value of theirs fails CI, while a failed check fails the benchmarks as any
  other benchmark's does, and a test checks that each measurement Vitest takes, B5 to B8 and I3 to
  I6, is recorded by one of the benchmarks.
- **Values.** On the developer machine, in a run of the benchmark file alone and in the whole
  performance pipeline, at a load of about 2 and 2.5, I4 took 0.83 and 0.85 ms at the median and
  1.44 and 1.29 ms at the 95th percentile, I5 2.6 and 2.8 ms and 7.0 and 6.0 ms, and I6 12.6 and
  15.3 ms and 36.1 and 43.1 ms, where B6 took 0.19 and 0.43 ms in the pipeline. The first query
  after a load costs the most, since it makes every row.
- **Not here.** A budget for the first query, or a change to what B6 times, needs an ADR first, as
  raising any budget does.

## Security

| Threat                                 | Control                                                                                                   |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| A hostile document, file or clipboard  | one validating codec with limits, all-or-nothing ([persistence](persistence.md#the-codec-boundary))       |
| Script injection through text or links | text only as canvas text or a text area's value; link scheme allow-list; links opened with `noopener`     |
| Oversized or malformed images (P2)     | type by first bytes, size cap, decoding into bitmaps; SVG rasterised                                      |
| Storage exhaustion                     | quota errors reported and retried; editing continues in memory                                            |
| Supply chain                           | no runtime dependency in the engine; every new dependency reviewed in its pull request against the policy |
| Privacy                                | documents stay on the device; no analytics; P0 makes no network request beyond its own assets             |

## Requirements served

REQ-C04, REQ-C14, REQ-F01 to REQ-F04 and REQ-Y01 to REQ-Y06.
