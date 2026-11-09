# Accessibility, testing, performance and security

This document states how the engine and editor meet the accessibility and performance
requirements, how every requirement is tested, and the security rules that cross all layers.

## Accessibility

A canvas is opaque to assistive technology, so the editor offers a structured, keyboard-operable
equivalent beside it and holds every control to the backlog's "do better" list (REQ-Y01 to
REQ-Y06).

| Part               | Design                                                                                                                                                                                               | Requirements              |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Tool bar           | `role="toolbar"` with a label; one tab stop, arrow keys move between tools; each tool a toggle button with `aria-pressed`, a name, its shortcut in `aria-keyshortcuts` and in its description        | REQ-C14, REQ-Y01, REQ-Y03 |
| Canvas host        | a focusable region labelled "Drawing canvas", described by short instructions; it receives the editor's shortcuts                                                                                    | REQ-Y02                   |
| Element list       | a list box beside the canvas with one option per element, topmost first, named by kind, text and geometry ("Rectangle, 120 by 100, at 300, 180"); see below                                          | REQ-Y05                   |
| Live region        | one polite region for selection counts, created and deleted elements, undo and redo; save failures use an assertive message                                                                          | REQ-Y04                   |
| Focus              | a visible indicator of at least 2 px with 3:1 contrast on every focusable element; Escape closes a menu or dialog and returns focus to the control that opened it                                    | REQ-Y02                   |
| Menus (P1)         | `menu` and `menuitem` roles; toggles as `menuitemcheckbox` with `aria-checked`, never a check mark in the name                                                                                       | REQ-Y01, REQ-Y03          |
| Targets and colour | every touch target at least 24 × 24 CSS px; text contrast at least 4.5:1 and control contrast 3:1 in each theme; forced-colours mode uses system colours for the interface and the selection outline | REQ-Y06                   |
| Motion             | no camera animation in P0; any later animation is skipped when reduced motion is requested                                                                                                           | REQ-Y06                   |

**Element list.** Up and Down move through the options; Space toggles an element in the selection
and Enter selects it alone; Delete deletes the selection; Alt+arrow keys nudge it by 1 unit and
Alt+Shift+arrow keys by 10. The list selects through `Editor.select` and reads the editor's view,
so selection is shared with the canvas both ways. The list renders only the options near the
focused one for large documents, with `aria-setsize` and `aria-posinset`, so its cost stays flat.

**Keyboard creation.** With a creation tool active and the canvas focused, Enter creates the
tool's default-size element at the centre of the viewport, so no element kind needs a pointer
(REQ-C04, REQ-Y05).

**Order of tab stops.** Tool bar, canvas, element list, history controls, zoom controls.

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
  nothing, since the notices stay until then. The selection a stored document opens with is not
  announced. The web app says each key in English, as in "Rectangle created. 1 element selected."
  or "Undid move of 2 elements. 2 elements selected."
- **The live region.** Two visually hidden regions, `aria-live` polite and assertive and
  `aria-atomic`, are put at the end of the page's body at start-up, before anything is said, and
  carry no role, so that the page's status keeps the only `status` role. A message empties its
  region at once and is written 100 ms later, so that a repeat is announced again and only the
  latest of quick messages is written. Failed and stale saves and the start-up notices for
  unavailable or invalid storage are assertive. The notices below the canvas are no longer
  `role="alert"` elements but a "Storage notices" region shown only while one applies (the ENG-13
  review's s2).
- **The element list.** The editor's view gains `elements`, the drawn elements in drawing order as
  last committed: while a gesture or a text session holds the history's transaction it keeps the
  list from before, so that the list never shows a preview and a drag publishes no view. The list
  box sits under the canvas and its instructions, so that the canvas keeps its size, and names each
  element "Kind, width by height, at x, y" from its unrotated box in scene units to one decimal, a
  text by its first 40 characters on one line, with ", turned N degrees" for a turn. It keeps the
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
- **Focus.** The tab stops are the tool bar's one stop, the canvas, the element list, Undo, Redo,
  Zoom out, Reset zoom, Zoom in and Zoom to fit; the zoom controls read the command registry and
  show each command's first shortcut. Every focusable element shows a 3 px outline in `#2a62d0`,
  5.3:1 against the page, and the text area a 2 px one. Undo and Redo are unavailable through
  `aria-disabled`, not `disabled`, because Chromium moves the focus of a button that becomes
  disabled to the page's body. Escape or Mod+Enter in the text area returns the focus to the canvas,
  which opened it; moving the focus to another control ends the session, while a page that loses
  the focus keeps it; answering the stale notice focuses the canvas first (the ENG-13 review's m5).
  P0 has no menu or dialog; Escape's return applies to them when they come (P1).
- **Targets, colour and motion.** Controls are at least 24 px, the page's link is a 24 px inline
  block, and touch handle hit squares stay 24 px. Measured in Chromium, the shortcut hint in a
  pressed tool button was 4.19:1 and is now opaque, 5.59:1, and an unavailable control is dark grey
  with a dashed border, 7.2:1, instead of half transparent, 3.36:1. Each camera command and wheel
  event sets the camera once, drawn whole in the next frame with no frame after it, and nothing in
  the page animates, with or without reduced motion.
- **No rule engine.** No automated rule engine, such as axe-core, is added: it would be a new
  dependency, and the checks P0 needs, focus order and indicators, contrast measured from computed
  colours, target sizes and roles, run in Playwright and Vitest without one. A manual screen-reader
  pass stays a task before each release; no human accessibility audit has been made.
- **Not here.** Menus and the dark theme (P1, P2), forced colours, other languages, a type-ahead in
  the list and the list's performance measurements (ENG-15).

## Testing strategy

Each issue writes its failing tests first and records that failing run in its pull request. A test
that proves a requirement names it in its title, for example
`it('REQ-V02 keeps the viewport centre when zooming in', …)`, so a search for an identifier lists
its tests.

| Level              | Runs in                                                | Covers                                                                                                                                                           |
| ------------------ | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Engine unit        | Vitest `engine:unit`, Node.js, no DOM                  | math, codec, order keys, geometry and distances, camera, scene store and indexes, history, selection, transforms, gestures, each tool reducer, commands          |
| Engine properties  | Vitest, seeded generators in the engine's test helpers | invariants over random inputs: see below                                                                                                                         |
| Engine integration | Vitest `engine:integration`                            | an editor with fake ports driven by scripted input sessions: document, selection, history, autosave and `remote` change sets                                     |
| Renderer unit      | Vitest `render-canvas:unit`                            | draw calls recorded by a fake 2D context for fixture scenes; device-pixel transforms; path-cache invalidation                                                    |
| Web unit           | Vitest `web:unit`, jsdom                               | the input adapter's event mapping (pointer, wheel modes, Mod per platform), the tool bar, element list and live region by role                                   |
| End-to-end         | Playwright, Chromium, production build                 | desktop 1280 × 720 and an emulated phone (390 × 844, DPR 3, touch): every P0 flow, reload, keyboard-only use; state read from the element list and the ARIA tree |
| Visual             | Playwright screenshots                                 | Planewright's own rendering of fixture documents at DPR 1 and 2, compared with committed baselines of its own output                                             |
| Benchmarks         | Vitest bench and a Playwright trace                    | the budgets below                                                                                                                                                |

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

Benchmarks start as reports. Once three consecutive runs on `main` give a baseline, a result more
than 20 % worse than its budget or baseline fails CI. Raising a budget needs an ADR, like raising a
guardrail.

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
