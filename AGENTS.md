# Agent instructions

These instructions apply to every AI coding agent working in this repository. Human contributors
follow the same rules through [CONTRIBUTING.md](CONTRIBUTING.md).

## Project state

- Planewright is in its **foundation phase**. P0 engine work has started, but `packages/engine`
  holds only its math layer, ports, document model, scene store, undo history, camera, geometry,
  selection with hit testing, the transform maths, input events with the gesture recogniser, the
  Hand, Selection, rectangle, ellipse, diamond, line, freehand and text tools with tool lock, the
  command registry with its keymap, the persistence layer's repository port and autosave, and the
  editor layer's render loop, text sessions, loading, saving, announcements and `createEditor`, and
  `packages/render-canvas` its Canvas 2D renderer with the bundled fonts' names. Every performance
  budget is measured: Vitest benchmarks, Playwright measurements and a bundle-size guardrail,
  reported in CI, and the heap by hand; B1, the redraw of 5,000 elements in view, misses its budget
  in some CI runs and is named with issue #49, and B2 misses only on a slower machine. The baseline
  holds three runs on `main`, one on each of three processors, and a run is gated only by three runs
  on its own processor, so CI does not gate the statistical budgets yet. The web app shows a
  **pre-release** surface: a canvas that fills the window and pans and zooms, with the controls
  floating over it in islands, most of them as original glyphs with tooltips, on a phone in portrait
  the tool bar a dock at the bottom whose More holds Hand, Diamond and Tool lock and in landscape
  the whole palette in the top row, the view readout hidden on phones, every target 44 px on phones
  and under a coarse pointer and the islands clear of the safe areas, on which rectangles, ellipses,
  diamonds, lines, freehand strokes and texts can be drawn, then selected, moved, resized, rotated,
  duplicated, deleted and nudged, texts edited again in a text area, with Undo and Redo, also from
  the keyboard alone, through a list of the elements in a drawer, which an Elements button showing
  their count opens and which is a sheet on phones, and a live region that announces each change;
  nothing shows about saving while it works, and a "Not saved" chip with the storage notices while
  it needs attention; while a text is edited, a chip under the text area names Esc and Ctrl+Enter,
  or Cmd+Enter on Apple platforms, as the ways to finish it, except on a phone in portrait, where a
  Done bar above the on-screen keyboard finishes it and the dock and history and zoom are hidden;
  keyboard focus on the canvas shows a violet ring at the window's edge with a "Canvas focused"
  chip, except on phones, where the ring shows alone; a line under the palette says what the active
  tool does, except on phones and while a text is edited; pressed tools and selected rows take the
  violet container, every focus ring is violet with a white halo and unavailable controls are grey
  and dashed; while something is selected, a selection panel near the upper left, or on
  phones a bar under the tool bar with a Details sheet, shows its kind or count and its position,
  size and turn read-only and offers Duplicate, Delete and, for a lone text, Edit text; a
  Pre-release tag opens About this build, a menu at the top left runs Select all and the zoom
  commands, shows the elements and opens About this build and a Keyboard shortcuts dialog that lists
  every command's keys, which a button at the bottom right opens too, and the drawing is saved in
  the browser's IndexedDB storage and restored on reload. Text formatting, styles, arrows, notes,
  files, exporting and collaboration features do **not** exist yet.
- **v0.2.0 (Editor Experience).** Slice S0 (issue #50) recorded the approved editor-chrome decisions
  in [ADR 0012](docs/adr/0012-v02-editor-chrome.md) and their slices S1 to S13 in the [v0.2
  plan](docs/architecture/editor-experience.md). Slice S1 (issue #53) added the chrome's design
  tokens, base styles and typeface, `Planewright UI` (Inter at 400 and 500), with no layout rule
  change, though P0's text rewrapped in the new face. Slice S2 (issue #55) replaced P0's page with
  the full-bleed shell: the canvas fills the window, the controls float over it in islands, the
  element list is in a drawer that the Elements toggle opens, and P0's pre-release line, notes and
  footer are in About this build, which a Pre-release tag opens. Slice S3 (issue #62) drew the
  chrome's 35 original glyphs and turned the tool bar into the palette: the tools, Undo, Redo and
  the zoom buttons but Reset zoom show glyphs with their names, keys and descriptions unchanged, the
  tools with their first key in a corner and tool lock with a padlock, the identity island shows the
  mark, and those controls and Reset zoom have tooltips. Slice S4 (issue #64) added the identity
  island's menu, whose button is the first tab stop, with About this build among its items, and the
  Keyboard shortcuts dialog with its button, the last tab stop. Slice S5 (issue #66) gave the
  Elements toggle the count of the elements, hidden from screen readers, and the drawer its 300 px
  and compact 280 px widths, its Close and folded keys, its focus moves to the list box and back to
  the toggle, its rows of a kind glyph, a label and mono figures under P0's names, the list mounted
  only while it is open with its options memoised, and on phones a sheet of at most 62 % of the
  height that makes the tool bar and the bottom islands inert and closes on Escape. Slice S6 (issue
  #69) added the selection panel, 232 px wide at 16 / 72 on desktops and mounted only while
  something drawn is selected and no text is edited, with the kind's glyph and name or the count,
  read-only figures in JetBrains Mono from a pure geometry module, Duplicate and Delete from the
  registry, Edit text only where Enter would edit the lone selected text, and a footnote that style
  controls are not in this build; on phones in portrait a selection bar in its place, above the
  notices, whose Details opens a Details sheet, never open with the Elements sheet, closed at every
  load and stored nowhere. Slice S7 (issue #71) made saving show only when it needs attention: P0's
  save status went, the shell's root carries `data-save-state` for the tests, a "Not saved" chip
  joins the top-right island before Elements while a save failed or was refused as stale or storage
  is unavailable, in the error or warning tone, with its glyph alone on phones, the notices under it
  keep P0's words and gain Hide, which folds them into the chip's button, a new failure, another
  reason or a stale save shows them again, and the web app says "The drawing is saved again." once
  when a failed save succeeds. Slice S8 (issue #73) composed phones: in portrait the tool bar is a
  dock 8 px above the window's bottom, Selection, Rectangle, Ellipse, Line, Freehand and Text, then
  More, whose popover holds Hand, Diamond and Tool lock and which shows the active tool's glyph,
  pressed, while it holds that tool, history and zoom above it, the top bar holding identity and
  Elements alone and the bottom-right island not shown; in landscape the whole palette sits in the
  top row; the view readout is hidden on phones; `index.html` declares `viewport-fit=cover` and
  every anchor adds its safe-area inset; and targets are at least 44 px on phones and under a coarse
  pointer. Slice S9 (issue #75) added the text-editing chrome: while a text is edited outside a
  phone in portrait, a caption chip 8 px under the text area names Esc and Ctrl+Enter, or Cmd+Enter
  on Apple platforms, in key chips and describes the text area; on a phone in portrait a Done bar
  sits above the on-screen keyboard at its inset, which the visual viewport gives and the bar holds
  in `--kb`, and Done commits the text as Escape does, while the dock and history and zoom are
  hidden and an open Elements sheet closes; the caret is not kept above the keyboard and the camera
  is not moved (D6). Slice S10 (issue #77) added the canvas's focus ring, drawn from CSS alone by an
  element of its own after the canvas host while the host matches `:focus-visible`, 2 px of violet
  at the window's edge inset by the safe areas over a 2 px white halo, with a "Canvas focused" chip
  at the bottom centre, hidden from assistive technology and on phones, a press focusing the canvas
  without them; the active tool's hint, one caption line from a constant per tool, centred 8 px
  under the palette on desktops and in an 18 px row of its own from 600 to 1199 px wide and 500 px
  high, which moves the panel, the notices and the drawer 26 px lower, hidden on phones and absent
  while a text is edited; and the tokens' colours for the pressed, unavailable and focus-visible
  rules, the selected row and the text area. S11 to S13 are not implemented yet. Work on a slice
  follows both.
- **Behavioural investigation precedes feature implementation.** Do not implement editor
  features until the relevant investigation issue is complete and a feature issue with
  acceptance criteria exists.
- Keep the web UI factual. Never present the foundation as a finished or working editor.

## Non-negotiable rules

1. **Independent implementation.** Never add `@excalidraw/*` or other Excalidraw-derived
   packages. Never copy, transcribe or adapt Excalidraw source code, assets, fonts, icons or
   documentation text. Reference applications are studied only for observable behaviour; see
   [ADR 0003](docs/adr/0003-clean-room-reference-policy.md).
2. **No affiliation claims.** Excalidraw is a behavioural reference and REA is investigation
   methodology and tooling. Neither is a partner, sponsor or upstream of Planewright.
3. **Issue-driven work.** Every change maps to a GitHub issue. Work on a branch named
   `<type>/<issue>-<kebab-summary>` and merge through a pull request. Do not push to `main`.
   The only direct-to-`main` push was the one-time bootstrap.
4. **Conventional Commits.** Make atomic commits; commitlint runs in the `commit-msg` hook and
   in CI. Do not bypass hooks with `--no-verify`.
5. **No releases.** Do not create tags, GitHub releases or published packages unless a
   maintainer explicitly asks for one.
6. **Report results faithfully.** Record only commands you actually ran and their real output.
   If a check fails or is skipped, say so.
7. **Secrets.** Never commit secrets or `.env` files, and never print tokens in logs.

## Commands

Toolchain: Node.js 24.22.1 and npm 11.19.1, pinned exactly.

```sh
npm ci                     # install (also installs Git hooks)
npm run format             # write formatting
npm run lint               # ESLint, zero warnings allowed
npm run typecheck          # strict TypeScript, all workspaces
npm run test:unit          # unit tests
npm run test:integration   # integration tests
npm run test:coverage      # all Vitest projects with coverage thresholds
npm run test:e2e           # Playwright (Chromium) against the production build
npm run build              # production builds
npm run guardrails         # file-size and dependency-policy checks
npm run check:bundle-size  # bundle sizes against their budgets (after npm run build)
npm run secrets:scan       # secretlint
npm run audit:deps         # npm audit and signature verification
npm run validate           # every local gate except e2e and audit
npm run perf:bench         # Vitest benchmarks of the performance budgets
npm run perf:browser       # Playwright measurements of the budgets (after npm run build)
npm run perf:report        # the performance report from perf-results/
npm run perf:tail          # B1's and B2's values and misses across CI reports' report.json files
```

Run `npm run validate` before proposing a change, plus `npm run test:e2e` for UI changes.

## Code map

- `apps/web`: React 19 and Vite 8 application. Source in `src/`: the editor's shell in `shell/`
  (`EditorShell`, its state, the identity island with the mark and the Pre-release tag, the Elements
  toggle with its count and the drawer with its focus moves and the phone's sheet query, the
  empty-canvas note and the Keyboard shortcuts button, the phone's Done bar in `DoneBar.tsx` with
  the keyboard's inset in `keyboard-inset.ts` and the shell's part of a text session in
  `text-session.ts`, the canvas's focus ring and chip in `CanvasFocusChip.tsx`, the active tool's
  hint line in `ToolHint.tsx` with its words in `tool-hints.ts`, the phone dock's More and its
  popover in `MoreTools.tsx` with the dock's composition in `more-tools.ts`, the menu's button, the
  menu and its items in `shell/menu/`, the 35 original glyphs in `shell/glyphs.ts` drawn by `Icon`
  in `shell/icons.tsx` and the kinds' glyphs in `shell/kind-glyphs.ts`, the selection panel, the
  phone's selection bar and Details sheet, what they read of the view and the selection's pure
  geometry in `shell/selection/`, the tooltip and its delegated listeners in `shell/tooltip/`, and
  the modal dialog, About this build and Keyboard shortcuts in `shell/dialogs/`), the canvas host,
  input adapter and editor provider in `editor/`, the text area with its hint chip and their rules
  (`text-area.ts`) in `editor/text/`, the element list,
  the live region with its messages, the sentence after a failed save succeeds again, the figures'
  rounding and the focus's return in `a11y/`, the tool bar shown as the palette or the phone's dock,
  its buttons' data in `tool-items.ts` and its button in `PaletteButton.tsx`, Undo and Redo, the
  zoom controls, the view readout, the problem chip and the storage notices with their pure rules in
  `ui/`, and the browser ports, text measurer, font loading, Mod key per platform, the IndexedDB
  record backend, storage start-up, page events and the preferences entry in `platform/`, and the
  style sheets in `styles/`: the design tokens, the fonts, the base, the controls', canvas's, list's
  and saving's rules, the shell's layout with the `--shell-safe-*` properties that read the
  safe-area insets, islands and dialogs, the glyph buttons', the phone dock's and More's
  (`dock.css`), the hint chip's and the Done bar's (`text-session.css`), the canvas's ring's and
  chip's and the tool hint's (`canvas-chrome.css`), the Elements toggle's and
  drawer's, the selection panel's, bar's and sheet's (`selection.css`), the menu's and the tooltip's
  rules, and `responsive.css`, the only one with
  media queries, which `main.tsx` adds as a style element of its own so that a breakpoint never
  makes the fonts load again. Unit tests in `tests/unit`, Playwright tests in `tests/e2e`, static
  files in `public/`, the bundled fonts with their licences in `public/fonts/` ([ADR
  0011](docs/adr/0011-bundled-open-licence-fonts.md), with the chrome's Inter 500 of [ADR
  0012](docs/adr/0012-v02-editor-chrome.md)).
- `apps/collab`: Node.js WebSocket service built with `ws` and bundled by esbuild. In
  development it runs TypeScript directly through Node's type stripping.
- `packages/protocol`: source-only, runtime-agnostic protocol package. Keep it free of DOM and
  Node.js APIs.
- `packages/engine`: the source-only canvas engine of
  [ADR 0004](docs/adr/0004-canvas-engine-package-boundaries.md), designed in
  `docs/architecture/engine`. ECMAScript only: its ESLint block forbids browser and Node.js
  globals, `Math.random`, `Date.now` and timers, which come through its ports, and its sources
  import only one another. A layer imports only from its own and earlier layers
  (`scripts/lib/engine-layers.ts`); only `math`, `ports`, `model`, `geometry`, `camera`, `scene`,
  `history`, `selection`, `transform`, `input`, `tools`, `commands`, `persistence` (the repository
  port, its records and autosave) and `editor` (its render frames, render loop and `createEditor`)
  exist so far. Tests run
  in the `engine:unit` and `engine:integration` projects; property tests use
  `tests/support/property.ts`.
- `packages/render-canvas`: the source-only Canvas 2D implementation of the engine's renderer port
  ([ADR 0006](docs/adr/0006-canvas-rendering.md)). Its ESLint block forbids every browser, worker
  and Node.js global except the Canvas 2D names it draws with (`Path2D`), timers, the clock
  (`Date.now`, `new Date()`) and `Math.random`, and its sources import only the engine's entry and
  one another, by `./` paths. Tests run in the `render-canvas:unit` project against a recording fake of the
  2D context.
- `scripts`: guardrail entry points, the bundle-size guardrail, the performance report and
  baseline, and B1's tail across CI reports (`npm run perf:tail`); their pure logic lives in
  `scripts/lib` and is tested in `scripts/tests`.
- Performance: `vitest.bench.config.ts` runs the `tests/bench/*.bench.ts` of the engine and the web
  app (`npm run perf:bench`), `apps/web/tests/perf` the Playwright measurements
  (`npm run perf:browser`), and `npm run perf:report` writes `perf-results/`; the seeded scenes are
  `packages/engine/tests/support/perf-scenes.ts`, and `docs/performance/baseline.json` keeps the
  recorded runs with their machines, which `scripts/lib/perf-baseline.ts` checks
  ([what ENG-15 decided](docs/architecture/engine/quality.md#what-eng-15-decided),
  [what issue #38 decided](docs/architecture/engine/quality.md#what-issue-38-decided)).
- `research/excalidraw`: issue #1 behavioural-research tooling (loopback driver, scenarios,
  evidence builders, container browser, isolation check and self-test), plain Node.js `.mjs`
  under its own ESLint block `planewright/research` with Node and browser globals. Its tests run
  in the `research:unit` and `research:integration` Vitest projects, and the driver uses the
  root devDependency `playwright-core`. Sanitised outputs live in `docs/reverse-engineering`; raw
  evidence stays outside the repository.

## Coding conventions

- Use relative imports with explicit `.ts`/`.tsx` extensions; the code is erasable-syntax
  TypeScript (no enums, namespaces or parameter properties).
- Stay within the ESLint guardrails (complexity 10, depth 3, 4 parameters, 60 lines per function,
  300 lines per module). Split code instead of disabling rules.
- Validate untrusted input at boundaries (environment, network, files) and fail fast with clear
  errors.
- Add or update tests with every behaviour change, and record architectural decisions as ADRs in
  `docs/adr`.
