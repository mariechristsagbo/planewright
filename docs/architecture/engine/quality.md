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
Alt+Shift+arrow keys by 10. Selection is shared with the canvas both ways. The list renders only
the options near the focused one for large documents, with `aria-setsize` and `aria-posinset`, so
its cost stays flat.

**Keyboard creation.** With a creation tool active and the canvas focused, Enter creates the
tool's default-size element at the centre of the viewport, so no element kind needs a pointer
(REQ-C04, REQ-Y05).

**Order of tab stops.** Tool bar, canvas, element list, history controls, zoom controls.

All interface text comes from message keys; P0 ships English and sets the document language.

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
  a generated order key lies strictly between its neighbours and never ends with `0`; decoding an
  encoded document gives it back; undo then redo restores the document; a cancelled transaction
  leaves the document unchanged. Generators are seeded, and a failure prints its seed. They use no
  new dependency.
- **Determinism.** Engine code never calls `Math.random`, `Date.now` or timers directly; an ESLint
  rule in the engine block enforces it, and the ports supply them.
- **Coverage.** The repository thresholds stay at 90 % statements, 85 % branches, 90 % functions
  and 90 % lines; the engine package adds its own thresholds of 95, 90, 95 and 95 %.
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
