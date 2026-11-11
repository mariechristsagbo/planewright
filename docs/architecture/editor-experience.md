# v0.2 editor experience: implementation and test plan

**Status: slice S0 (issue #50) wrote this plan and [ADR 0012](../adr/0012-v02-editor-chrome.md),
slice S1 (issue #53) added the chrome's tokens, base styles and typeface
([what S1 delivered](#what-s1-delivered)), and slice S2 (issue #55) the full-bleed shell with its
islands, the Elements drawer and About this build ([what S2 delivered](#what-s2-delivered));
slices S3 to S13 are not implemented.** This plan turns ADR
0012's decisions into thirteen issues for milestone v0.2.0 (Editor Experience): what each slice
contains, what must land before it, the tests it writes first, how it is validated and which
documents it updates. The decisions themselves, the tests to migrate and the visual-regression
matrix are in the ADR; where this plan and the ADR differ, the ADR governs.

The approved design package that both derive from stays outside the repository. Its values that
the slices need (the tokens and the contrast pairs) are written out [below](#tokens), so that a
slice reads them here and not in files outside Git. Nothing in this plan is the prototype's code.

## Rules for every slice

- **One issue, one pull request.** Each slice is an issue in milestone v0.2.0 whose acceptance
  criteria come from this plan and the ADR, worked on a branch named `<type>/<issue>-<summary>` and
  merged through one pull request of atomic Conventional Commits that each say `Refs #<issue>`.
- **Test first.** Write the failing unit tests (`apps/web/tests/unit`, Vitest with jsdom) and
  end-to-end tests (`apps/web/tests/e2e`, Playwright on Chromium) first, see them fail for the right
  reason, implement the minimum, then refactor within the lint limits: complexity 10, depth 3, four
  parameters, 60 lines per function and 300 per module, and 400 lines and 256 KB per `.ts`, `.tsx`,
  `.css` or `.html` file.
- **Migrate, never delete.** A slice that changes what a test assumes migrates that test in the same
  pull request, as the ADR's [test migrations](../adr/0012-v02-editor-chrome.md#test-migrations)
  say. A test is removed only with the behaviour it checked, and the pull request says so.
- **Validation.** `npm run validate` (which includes `check:bundle-size`) and `npm run test:e2e`
  pass before the pull request is proposed. A slice that can move a browser budget (B1 to B3, B9 or
  B10) also runs `npm run perf:browser` and `npm run perf:report` on its head and on `main`, and
  reports both, remembering that B1 misses in some CI runs with unchanged code (issue #49).
- **No engine change and no new dependency.** The engine's packages stay as they are, except the
  renderer's overlay colour in S11. An accessibility rule engine such as `@axe-core/playwright` is
  added only through its own issue, if the maintainer accepts it; until then the hand-written
  checks stay.
- **Clean room.** Icons come from the design's original glyphs, never traced from a screenshot.
  Words are P0's or the design's own. No reference source, style, asset or string is used
  ([ADR 0003](../adr/0003-clean-room-reference-policy.md)), and no slice claims an affiliation.
- **Nothing from the do-not-implement list.** Style pickers, arrows, notes, images, the eraser,
  frames, groups, layers, locking, links, a context menu, the clipboard, files and export, sharing
  and collaboration, settings such as a dark theme, a command palette, find, "reset the canvas",
  any saved or saving indicator, a "restored" toast, geometry input fields, per-element outlines in
  a multi-selection, the phone caret (D6), and any third chrome family or other Inter weight.
- **Factual status.** A slice that changes the visible page updates the status documents (the
  README, `AGENTS.md`, the [engine README](engine/README.md) and the
  [overview](overview.md)) and adds a `CHANGELOG.md` entry under Unreleased, so that they never
  describe a page that no longer exists or one that does not exist yet.

## Slices

The order, contents and risks are the handoff's. "Lands after" is derived from what each slice
builds on; the handoff adds only that S7 may land before S2.

### S1: tokens, base styles and the chrome font

- **Lands after:** S0. **Risk:** low.
- **Contents.** `apps/web/src/styles/tokens.css`, the `--pw-*` custom properties generated once from
  the design's tokens, with the values [below](#tokens); `fonts.css` with ADR 0011's three faces
  unchanged, then `Planewright UI` 400 (the URL of the canvas's Inter 400), 500 and the fallback
  face (ADR 0012, decision 8); `inter-latin-500-normal.woff2` in `apps/web/public/fonts`; base
  styles, with element resets inside `:where()` so that single-class rules win and
  `:where(strong, b, h1, h2, h3, th) { font-weight: 500 }`, and the text area at
  `font-weight: 400`. P0's `styles.css` is split into files under the guardrail. No layout changes.
- **Tests first.** Unit: each token value equals [the tables](#tokens); the 23
  [contrast pairs](#contrast-pairs) as data, one assertion per ratio. End-to-end: a chrome button's
  computed `font-family` starts with `"Planewright UI"`; Chromium requests
  `inter-latin-400-normal.woff2` once; no chrome element computes `font-weight` 600 or 700.
- **Also changes.** `scripts/tests/bundled-fonts.test.ts` reads `apps/web/src/styles.css` and
  expects exactly three `@font-face` rules and six files in `apps/web/public/fonts`. It follows the
  faces into `fonts.css`, keeps its ADR 0011 checks for the three canvas faces, and admits the
  chrome's faces and the 500 file.
- **Validation.** The rules above. `npm run perf:browser` only if the optional
  `<link rel="preload">` of the 500 file is added, which stays only if B10 is unchanged.
- **Documents.** If the base styles change the focus ring to 2 px of Construction Violet outside a
  2 px white halo, `engine/quality.md`'s "Focus" bullet, which gives 3 px of `#2a62d0`.
- **Delivered** by issue #53, which kept P0's focus ring ([what S1 delivered](#what-s1-delivered)).

### S2: the full-bleed shell

- **Lands after:** S1. **Risk:** high, since most end-to-end migrations land here.
- **Contents.** `EditorShell` replaces `App`, with the visually hidden h1. The canvas host fills
  `100dvh` × `100vw` and keeps its 1 px border, made transparent, so that the check of
  `canvas-geometry.spec.ts` that the scene canvas sits inside the border and the text layer's 1 px
  inset stay valid; the spec's fractional-height case does not, since a `100dvh` host has a
  whole-pixel height, and S2 migrates it (ADR 0012's test migrations). `html` and `body` never
  scroll. Islands sit at their anchors ([responsive rules](#responsive-rules)). The element list
  moves into a closed drawer with a plain Elements toggle (S5 completes it). The Pre-release tag
  opens About this build, a modal dialog with the focus on Close, Tab wrapping inside, and Escape or
  the scrim closing it and returning the focus; it holds P0's pre-release sentence, the
  not-implemented list, the independence note and the "Source on GitHub" link, since S2 removes the
  lines that held them. The empty-canvas note shows while there are no elements and no text session.
  History and zoom move to the bottom left, with the zoom readout as the Reset zoom button named
  "Reset zoom, 100%", and the view readout to the bottom right.
- **Tests first.** End-to-end: the canvas box equals the viewport less its 2 px of border at
  1280 × 720 and 390 × 844; the page does not scroll; no two islands intersect; the tab order of
  ADR 0012, decision 14, so far as S2's controls exist; About opens from the tag, holds the
  sentence and returns the focus.
- **Migrations.** The ADR's rows marked S2.
- **Validation.** The rules above, with `perf:browser`: the canvas grows to the whole viewport, so
  B1 to B3 draw more pixels than on P0's page, and B10 loads a new tree.
- **Documents.** The [overview](overview.md#appsweb)'s web app paragraph, `engine/modules.md`'s web
  app structure (a `shell/` directory), `engine/quality.md` (the tab stops, the list's place under
  the canvas, and the live regions' note that the page's status keeps the only `status` role), the
  status documents and the CHANGELOG.
- **Delivered** by issue #55 ([what S2 delivered](#what-s2-delivered)).

### S3: icons and the palette

- **Lands after:** S2. **Risk:** medium.
- **Contents.** `shell/icons.tsx`, a typed record of the 35 original glyphs with an `Icon`
  component, kept under 400 lines or split. The tool bar restyled as the palette: glyphs, groups
  split by hairlines, corner keys in JetBrains Mono (`aria-hidden`, since `aria-keyshortcuts` and
  the description carry them), and a padlock that closes when tool lock is on. Tooltips from one
  delegated listener on the shell's root: after 500 ms of hover, at once on focus, never on touch,
  closed by Escape, and never the only place of a piece of information.
- **Tests first.** Unit: one button per registry tool in registry order, each with its
  `aria-keyshortcuts`; the lock's open or closed padlock with `aria-pressed`. End-to-end: a
  tooltip appears on focus and closes on Escape.
- **Migrations.** The ADR's rows marked S3.
- **Validation.** The rules above; the icons' cost, estimated at 3 to 4 KB gzip, shows in
  `check:bundle-size`.

### S4: the menu and the Keyboard shortcuts dialog

- **Lands after:** S2 and S3. **Risk:** medium.
- **Contents.** The identity island's menu button and `MainMenu`, with `menu`, `menuitem` and a
  `menuitemcheckbox` for Show elements: Select all (`selection.select-all`), Zoom to fit
  (`view.zoom-to-fit`), Reset zoom (`view.zoom-reset`), Show elements, Keyboard shortcuts, About
  this build and Source on GitHub, each with its shortcut in mono. It opens on click, Enter, Space
  or ArrowDown with the focus on its first item; arrows, Home and End move; Enter runs an item and
  closes it; Escape closes it and returns the focus to the button, and Tab closes it without moving
  the focus back. The Keyboard shortcuts dialog, opened from the bottom-right button and the menu,
  lists every registry command with `shortcutText()`, and shares About's dialog behaviour.
- **Tests first.** End-to-end: the menu opens, arrows move through it and Escape returns the focus;
  a dialog keeps the focus inside and returns it on closing. Unit: the dialog lists every registry
  command with its shortcut text.
- **Migrations.** The ADR's rows marked S4.
- **Documents.** `engine/quality.md`'s note that P0 has no menu or dialog.

### S5: the Elements drawer and the phone sheet

- **Lands after:** S2 and S3. **Risk:** medium.
- **Contents.** The Elements toggle with its count, which is `aria-hidden` so that the name stays
  "Elements"; the drawer, 300 px wide (280 px compact), whose opening focuses the list box and
  whose closing focuses the toggle; on phones a sheet of at most 62 % of the height that makes the
  dock and the bottom-left group `inert` and closes on Escape; closed at every load (D4). While it
  is closed the list is not mounted; while it is open its options are memoised on the elements,
  the selection and the active position, since `view.elements` keeps its identity across camera
  changes. Each row shows a kind glyph, a primary label and mono metadata, and keeps P0's
  accessible name.
- **Tests first.** End-to-end: the toggle opens the drawer and focuses the list box; every P0 list
  key still works; the phone sheet makes the dock inert; after a reload the drawer is closed.
- **Migrations.** The ADR's rows marked S5.
- **Validation.** The rules above, with `perf:browser` on `main` and the head, to show that the
  closed drawer removes the list's cost from a pan step: I1 pans with the drawer closed and is
  compared with I1 on `main`, and I2 pans with the drawer open (the ADR's row for
  `perf/panning.spec.ts`).

### S6: the selection panel, the phone selection bar and the Details sheet

- **Lands after:** S2 and S3. **Risk:** medium.
- **Contents.** A panel, 232 px wide at 16 / 72 on desktops, shown only with a selection and no
  text session: the kind glyph and name ("Rectangle", or "3 elements"), read-only geometry in mono
  (X, Y, W, H and Angle; Length for a line, Points for a freehand stroke, Lines for a text),
  Duplicate, Delete in the error tone, Edit text for a lone text (it runs `canvas.enter`), and the
  footnote that style controls are not in this build. `shell/selection/geometry.ts` is pure: a
  single element's values from `localBox` and its rotation normalised to 0–360 as
  `element-names.ts` does, and a multi-selection's bounds as the axis-aligned box of each element's
  rotated `localBox` corners, without widening the engine's entry. Duplicate and Delete are
  available while something is selected and no text is edited. On phones a selection bar sits
  under the top bar, and Details opens the geometry in a sheet that closes when the selection
  empties.
- **Tests first.** Unit: `geometry.ts` for a rotated element, a multi-selection and a line, as
  properties over random elements in the style of `packages/engine/tests/support/property.ts`.
  End-to-end: the Duplicate and Delete buttons run their commands, and Edit text opens the text
  area.

### S7: saving visibility (D7)

- **Lands after:** S1, and S2 for anchoring the notices under the top-right island. It may land
  before S2, with the chip in P0's row beside the view readout. **Risk:** medium.
- **Contents.** The visible save status goes. `StorageProblemChip` keeps the id `save-status` and
  P0's "Not saved": a static `<p>` while its notices show, and a
  `<button aria-expanded="false" aria-controls="notices">` once they are hidden; in phone landscape
  it shows only its glyph, its words visually hidden (never `display: none`) and no chevron, at
  least 44 px wide. The shell's root carries `data-save-state` (`view.save?.type ?? 'none'`).
  `useSaveRecovery` in `apps/web/src/a11y/` remembers a `failed` status through `pending`, and on
  the next `saved` says "The drawing is saved again." in the polite region, once. Notices get a
  Hide button, and come back on a new failure, a stale save or a changed reason.

  | `view.save`                           | Chip                                                            | Notice                             | Live region                                                                          |
  | ------------------------------------- | --------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------ |
  | `saved`                               | none                                                            | —                                  | nothing; after a `failed` status only, "The drawing is saved again.", politely, once |
  | `pending`                             | none                                                            | —                                  | nothing                                                                              |
  | `failed`                              | error tone, triangle, "Not saved"                               | `failedText(reason)`               | assertive (P0)                                                                       |
  | `stale`                               | warning tone, two-tabs glyph, "Not saved"                       | `STALE_TEXT` with its two answers  | assertive (P0)                                                                       |
  | null                                  | warning tone, triangle, "Not saved"                             | `STORAGE_NOTICE_TEXTS.unavailable` | assertive at start-up (P0)                                                           |
  | `saved` or `pending`, unreadable data | none while the notice shows; "Storage notice" once it is hidden | `STORAGE_NOTICE_TEXTS.invalid`     | assertive at start-up (P0)                                                           |

- **Tests first.** Unit, `Saving.test.tsx` rewritten: no chip for `saved` and `pending`, "Not
  saved" for `failed`, `stale` and null, and a "Storage notice" button for a hidden unreadable-data
  notice. Unit, the recovery: `failed`, `pending`, `saved` says the sentence once and politely;
  `pending`, `saved` and `stale`, `saved` say nothing. End-to-end, `persistence.spec.ts` extended:
  after a change no "Saved in this browser" or "Saving…" shows and `data-save-state` reaches
  `saved`; a failure shows the chip and the notice; Hide folds the notices into the chip's button
  and a new failure shows them again; the notices' sentences are unchanged; the stale answers clear
  the chip.
- **Migrations.** The ADR's rows marked S7, B9's included.
- **Validation.** The rules above, with `perf:browser` on `main` and the head for B9. That React
  writes `data-save-state` in the same commit as P0's text, so that B9's window keeps its meaning,
  is inferred; this slice shows it or reports the difference.
- **Documents.** `engine/persistence.md`'s web app bullet and `engine/quality.md`'s live-region
  bullet.

### S8: the phone composition and safe areas

- **Lands after:** S3, S5 and S6. **Risk:** medium.
- **Contents.** In portrait, a bottom dock of Selection, Rectangle, Ellipse, Line, Freehand, Text
  and More, where More holds Hand, Diamond and Tool lock (a constant of the shell, not the engine)
  and takes the active tool's glyph when that tool is in it; history and zoom above the dock; a top
  bar with identity and Elements only. In landscape, the whole palette at 44 px in the top row.
  `viewport-fit=cover` in `index.html`, anchors offset by `env(safe-area-inset-*)`, and targets of
  at least 44 px. The view readout is hidden on phones.
- **Tests first.** End-to-end at 390 × 844 and 844 × 390 with touch: the dock holds six tools and
  More; More's items work; every target is at least 44 px; the safe-area offsets apply (emulated
  with custom properties, since the emulator has no inset); the top bar at rest holds identity and
  Elements only.
- **Migrations.** The ADR's rows marked S8.

### S9: text-editing chrome

- **Lands after:** S2 and S8. **Risk:** medium.
- **Contents.** On desktops a caption chip under the text area naming the ways to finish (Escape,
  and Enter with the platform's Mod key). On phones a Done bar at `bottom: var(--kb)`, where `--kb`
  is the keyboard's inset read from `visualViewport`, with the dock, the bottom-left group and the
  selection panel hidden during the session. The caret is not kept above the keyboard (D6), and
  the camera is not moved.
- **Tests first.** End-to-end on a phone: Done commits the text, and the dock is hidden while
  editing. On a desktop: the chip shows while editing. Composition with an input method stays
  covered by the existing tests that a composition never ends the session.

### S10: the canvas focus ring, chip and hint line

- **Lands after:** S2 and S3. **Risk:** low.
- **Contents.** The canvas's focus as the focus ring drawn inset on the viewport's edge with a
  "Canvas focused" chip, from CSS alone. The tool hint, one caption line under the palette saying
  what the active tool does, from a constant per tool identifier in the shell; it owns a row from
  600 to 1199 px, which moves the panels, notices and drawer 26 px lower, and is hidden on phones
  and while text is edited.
- **Tests first.** End-to-end: focusing the canvas shows the ring and the chip; the hint follows the
  active tool.
- **Coordinates** any change to P0's pressed, disabled and focus-visible rules, which S1 left in
  `base.css` inside `:where()`, at no specificity, and which S2's islands keep: no S2 class rule
  sets a control's colour, border or outline, and S2 only draws P0's ring 3 px inside the canvas
  host, which fills the window (the S1 review's first suggestion, issue #55's A14).
- **Documents.** `engine/quality.md`'s "Focus" bullet.

### S11: the overlay's colour (D1)

- **Lands after:** S0. **Risk:** low to medium.
- **Contents.** `SELECTION_COLOR` and `MARQUEE_FILL` in
  `packages/render-canvas/src/overlay-layer.ts` become `#6547b4` and `#6547b41a`.
- **Tests first.** `packages/render-canvas/tests/unit/overlay-layer.test.ts` pins the old values at
  its lines 66–69; it expects the new ones first. No end-to-end pixel check reads the overlay's
  colour at `1f8188f`: `overlayInk` in `apps/web/tests/e2e/drawing.ts` counts painted pixels by
  their alpha.
- **Documents.** `engine/rendering-and-hit-testing.md`'s "The overlay's pixels" bullet, which gives
  `#2a62d0` and `#2a62d01a`.

### S12: motion (D2)

- **Lands after:** S4 to S8, whose surfaces it animates. **Risk:** low.
- **Contents.** Entrances by opacity and a 4 to 16 px translation, over the
  [durations](#elevation-layers-and-motion) below; no animation under
  `prefers-reduced-motion: reduce`; the camera never animated.
- **Tests first.** End-to-end with `reducedMotion: 'reduce'`: after opening the menu and the
  drawer, `document.getAnimations()` is empty.
- **Migrations.** The ADR's row for `contrast-motion.spec.ts:84`.
- **Documents.** `engine/quality.md`'s statement that nothing in the page animates.

### S13: the visual-regression baselines

- **Lands after:** S1 to S12. **Risk:** low.
- **Contents.** The 30 baselines of the ADR's
  [matrix](../adr/0012-v02-editor-chrome.md#visual-regression-matrix), with `toHaveScreenshot`, the
  seeded scene of `apps/web/tests/e2e/scene-fixture.ts` and `animations: 'disabled'`. The storage
  states come from the end-to-end storage helpers. The baselines are made where CI renders them
  (Linux, the CI job's Chromium), since a developer machine may rasterise differently, and each
  image is reviewed in the pull request.

## Component ownership

Every new component is web-app chrome; the engine is unchanged.

| Component                                            | Where (`apps/web/src`)          | Slice  | Owns                                                                                |
| ---------------------------------------------------- | ------------------------------- | ------ | ----------------------------------------------------------------------------------- |
| `EditorShell`                                        | `shell/EditorShell.tsx`         | S2, S7 | The islands' layout, the hidden h1, the shell's state and `data-save-state`         |
| `IdentityIsland`, `PrereleaseTag`, `AboutDialog`     | `shell/`, `shell/dialogs/`      | S2     | The mark, the wordmark, the tag and About, from `foundation.ts`                     |
| `MainMenu`, `ShortcutsDialog`                        | `shell/menu/`, `shell/dialogs/` | S4     | The menu pattern and the shortcuts list, from `editor.commands`                     |
| `Toolbar`, `MoreTools`                               | `ui/Toolbar.tsx`, `shell/`      | S3, S8 | The palette, the phone dock and More; labels, order and shortcuts from the registry |
| `Icon`                                               | `shell/icons.tsx`               | S3     | The 35 original glyphs                                                              |
| `ToolHint`, `CanvasFocusChip`                        | `shell/`                        | S10    | The hint line and the canvas's focus chip                                           |
| `CanvasHost`, `TextEditor`                           | `editor/`, `editor/text/`       | S2, S9 | The two canvases, input and resizing, and the text area with its hint chip          |
| `EmptyCanvasNote`                                    | `shell/`                        | S2     | The note while there are no elements and no text session                            |
| `SelectionPanel`, `DetailsSheet`, `geometry.ts`      | `shell/selection/`              | S6     | The contextual panel, the phone bar and sheet, and their pure geometry              |
| `TopRightIsland`, `ElementsToggle`, `ElementsDrawer` | `shell/`                        | S2, S5 | The Elements toggle and the drawer or sheet around the list                         |
| `ElementList`                                        | `a11y/ElementList.tsx`          | S5     | The list box, its rows' markup; its behaviour, names and keys stay P0's             |
| `StorageProblemChip`, `StorageNotices`               | `ui/Saving.tsx`                 | S7     | The chip and the notices, with P0's words                                           |
| `useSaveRecovery`                                    | `a11y/save-recovery.ts`         | S7     | The one polite sentence after a failed save succeeds again                          |
| `HistoryControls`, `ZoomControls`, `ViewReadout`     | `ui/`                           | S2, S3 | Undo, Redo, zoom and the readout, from the registry and the view                    |
| `DoneBar`                                            | `shell/DoneBar.tsx`             | S9     | The phone's Done bar above the keyboard                                             |
| Tooltip layer                                        | `shell/tooltip/`                | S3     | One portal and one delegated listener                                               |

The shell's own state is one reducer, `useShellState`, holding the open menu, the More popover,
the drawer, the open dialog (`'shortcuts'`, `'about'` or none), whether the notices are hidden and
the Details sheet. It is never stored. Contextual components derive everything else from the
editor's view, memoised so that a camera change, which publishes a new view at every pan step,
does not re-render them; the problem chip depends on `view.save` alone, which keeps its identity
across camera changes.

## Responsive rules

1. **Anchors.** Each island is placed at its edge plus `env(safe-area-inset-*)`: 16 px on desktops
   (1200 px wide and more), 12 px from 600 to 1199 px, 8 px on phones.
2. **Media queries on the viewport**, not container queries: `(max-width: 599px)` is a phone in
   portrait, `(max-height: 499px)` a phone in landscape, `(max-width: 1199px)` compact, and
   `(pointer: coarse)` raises targets to 44 px. The landscape rules come after the compact ones,
   since a short landscape window also matches `max-width: 1199px`, and phones undo the compact
   rule that starts side surfaces under the hint row.
3. **The top row.** Identity, palette and the top-right island never overlap. At rest the top-right
   island holds Elements alone. While storage needs attention the chip joins it, before Elements,
   with a hairline. Compact layouts hide the wordmark and Elements' word (kept in its name).
4. **Notices** sit under the top-right island, aligned to its right edge, 340 px wide (320 compact,
   300 in landscape, the full width on phones). An open drawer moves the notices and the
   bottom-right group left by its width plus 12 px. On phones the notices and the selection bar
   share one flex column under the top bar.
5. **The soft keyboard** during a phone text session: `--kb` from `visualViewport`, the dock, the
   bottom-left group and the selection panel hidden, the Done bar at `bottom: var(--kb)`.
6. **Targets** of at least 44 px for `.pw-btn`, menu items, the chip's button and `summary` on
   phones and under `pointer: coarse`.

## Tokens

These are the values that S1's `tokens.css` holds, from the approved design, under the
[custom properties](#custom-properties) below. Colours are sRGB hex; an eight-digit value carries
its alpha.

| Token                  | Value       | Role                                                    |
| ---------------------- | ----------- | ------------------------------------------------------- |
| `primary`              | `#6547B4`   | Active tool edge, focus ring, selection, primary button |
| `on-primary`           | `#FFFFFF`   | Text on `primary`                                       |
| `primary-container`    | `#EEEAFF`   | Active tool, selected row                               |
| `on-primary-container` | `#513991`   | Content on `primary-container`                          |
| `primary-tint`         | `#F7F5FF`   | Pre-release tag                                         |
| `primary-line`         | `#DCD6FF`   | Active tool or selected row on hover                    |
| `primary-strong`       | `#513991`   | Primary button on hover                                 |
| `secondary`            | `#4F4E5B`   | The same value as `on-surface-variant`                  |
| `canvas`               | `#FFFFFF`   | The canvas, the engine's default background             |
| `surface`              | `#FFFFFF`   | Islands                                                 |
| `surface-muted`        | `#F6F6F9`   | Readouts and key chips                                  |
| `surface-hover`        | `#EDEDF1`   | Hover                                                   |
| `surface-pressed`      | `#E6E6EB`   | Pressed                                                 |
| `on-surface`           | `#1D1D27`   | Chrome text and glyphs                                  |
| `on-surface-variant`   | `#4F4E5B`   | Secondary text                                          |
| `on-surface-muted`     | `#686873`   | Hints, the lightest text allowed                        |
| `outline-subtle`       | `#DDDDE4`   | Island hairlines and dividers                           |
| `outline`              | `#CACAD2`   | Button edges                                            |
| `outline-strong`       | `#7F7F8A`   | Non-text boundaries that must meet 3:1                  |
| `disabled-content`     | `#686873`   | Unavailable glyphs                                      |
| `focus-ring`           | `#6547B4`   | The focus ring                                          |
| `focus-halo`           | `#FFFFFF`   | The ring's halo                                         |
| `selection`            | `#6547B4`   | The canvas's selection overlay (D1)                     |
| `selection-fill`       | `#6547B41A` | The marquee's fill (D1)                                 |
| `ink`                  | `#1E2430`   | Canvas content                                          |
| `error`                | `#B02B27`   | Delete                                                  |
| `on-error`             | `#FFFFFF`   | Text on `error`                                         |
| `error-container`      | `#FFF1EF`   | Failed save chip and notice                             |
| `on-error-container`   | `#901E1C`   | Content on `error-container`                            |
| `warning-container`    | `#FFF6DD`   | Stale and start-up chip and notices                     |
| `on-warning-container` | `#834B14`   | Content on `warning-container`                          |
| `inverse-surface`      | `#1D1D27`   | Tooltips and the canvas chip                            |
| `on-inverse-surface`   | `#FFFFFF`   | Content on `inverse-surface`                            |
| `scrim`                | `#1D1D273D` | Behind a dialog                                         |

There is no success colour.

### Type

Chrome text is `Planewright UI` (Inter); keys and geometry are `Planewright Mono` (JetBrains
Mono). Sizes and line heights are in px; tracking is −0.011em at 16 px, −0.006em at 14 px and 0
otherwise.

| Role          | Face, weight         | Size / line | Used for                            |
| ------------- | -------------------- | ----------- | ----------------------------------- |
| `title-md`    | UI 500               | 16 / 22     | Dialog titles                       |
| `title-sm`    | UI 500               | 14 / 20     | Panel and drawer headings           |
| `body-md`     | UI 400               | 14 / 20     | Menu items, dialog prose            |
| `body-sm`     | UI 400               | 13 / 18     | Panels, list rows, notices          |
| `label-md`    | UI 500               | 13 / 16     | Text buttons                        |
| `label-sm`    | UI 500               | 12 / 16     | Section labels, the Pre-release tag |
| `caption`     | UI 400               | 12 / 16     | Hints, the problem chip, tooltips   |
| `numeric-md`  | UI 400, tabular      | 13 / 16     | The zoom readout                    |
| `numeric-sm`  | UI 400, tabular      | 12 / 16     | The view readout and counts         |
| `geometry`    | Mono 400             | 12 / 16     | Selection readouts, list metadata   |
| `kbd`         | Mono 400             | 11 / 14     | Keys                                |
| `kbd-corner`  | Mono 400             | 10 / 10     | A tool button's corner letter       |
| `canvas-text` | Sans 400 (unchanged) | 20 / 1.25   | Canvas text, as in P0               |

### Shape and size

- **Radii:** 3 px (keys and the Pre-release tag), 6 px (every control), 8 px (islands, panels, menus
  and notices), 12 px (dialogs and the top corners of sheets); no pill shapes in the chrome.
- **Spacing:** a 4 px base with steps of 2, 4, 8, 12, 16, 24 and 32 px; 4 px inside islands, 8 px
  between them, 12 px inside panels and 24 px inside dialogs.
- **Controls:** 32 px compact, 36 px on desktops, 40 px on tablets, 44 px for touch.
- **Widths:** the selection panel 232 px, the drawer 300 px, the menu 264 px, a dialog 560 px;
  sheets at most 62 % of the viewport's height.

### Elevation, layers and motion

| Level | Used for                                   | Shadow, after a 1 px `outline-subtle` hairline                     |
| ----- | ------------------------------------------ | ------------------------------------------------------------------ |
| e0    | The canvas                                 | none                                                               |
| e1    | Islands                                    | `0 1px 2px rgb(29 29 39 / 0.06), 0 2px 8px rgb(29 29 39 / 0.04)`   |
| e2    | Selection panel, drawer, notices           | `0 2px 4px rgb(29 29 39 / 0.06), 0 8px 24px rgb(29 29 39 / 0.08)`  |
| e3    | Menus, popovers, tooltips, sheets, dialogs | `0 4px 8px rgb(29 29 39 / 0.08), 0 16px 40px rgb(29 29 39 / 0.12)` |

No blur, glass or gradient. Layers, bottom to top: the scene canvas 0, the overlay canvas 1, the
text area 10, the tool hint and canvas chip 20, islands 30, the selection panel and drawer 40,
notices 50, menus and More 60, tooltips 70, sheets 80, dialogs 90.

Motion, eased by `cubic-bezier(0.2, 0, 0, 1)`: hover and press feedback fades colours in 90 ms;
menus and popovers, the selection panel, notices and dialogs enter in 140 ms, settling 4 px; the
Elements drawer enters in 180 ms from 8 px to its side, and sheets in 220 ms from 16 px below. A
tooltip waits 500 ms on hover. Every duration is 0 under reduced motion.

### Contrast pairs

Measured from the approved tokens in Chromium; text needs 4.5:1, the last six (non-text) 3:1.

| Foreground on background                      | Ratio |
| --------------------------------------------- | ----- |
| `on-surface` on `surface`                     | 16.70 |
| `on-surface-variant` on `surface`             | 8.16  |
| `on-surface-muted` on `surface`               | 5.50  |
| `on-surface-muted` on `surface-hover`         | 4.71  |
| `on-surface-muted` on `surface-muted`         | 5.10  |
| `on-surface` on `surface-muted`               | 15.48 |
| `on-surface-variant` on `surface-muted`       | 7.57  |
| `disabled-content` on `surface`               | 5.50  |
| `on-primary-container` on `primary-container` | 7.61  |
| `on-primary-container` on `primary-line`      | 6.44  |
| `on-primary-container` on `primary-tint`      | 8.30  |
| `on-primary` on `primary`                     | 6.74  |
| `on-primary` on `primary-strong`              | 8.96  |
| `error` on `surface`                          | 6.52  |
| `on-error-container` on `error-container`     | 7.99  |
| `on-warning-container` on `warning-container` | 6.53  |
| `on-inverse-surface` on `inverse-surface`     | 16.70 |
| `focus-ring` on `surface`                     | 6.74  |
| `focus-ring` on `canvas`                      | 6.74  |
| `selection` on `canvas`                       | 6.74  |
| `primary` on `primary-container`              | 5.73  |
| `outline-strong` on `surface`                 | 3.96  |
| `ink` on `canvas`                             | 15.55 |

### Custom properties

`apps/web/src/styles/tokens.css` declares each value above once, on `:root`, as a `--pw-*` custom
property; hex colours are in lower case, as Prettier writes them. S12 sets the durations to 0 under
reduced motion and decides whether the tooltip's delay follows them.

| Tokens              | Custom properties                                                                                                                                                                            |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Colours             | `--pw-color-<token>`, such as `--pw-color-primary` and `--pw-color-on-surface-muted`                                                                                                         |
| Font stacks         | `--pw-font-ui` (`'Planewright UI', 'Planewright UI Fallback', sans-serif`), `--pw-font-mono` and `--pw-font-canvas`                                                                          |
| Type                | `--pw-type-<role>`, a `font` shorthand such as `500 16px/22px var(--pw-font-ui)`; `--pw-type-<role>-tracking`; `--pw-type-numeric-md-figures` and `-sm-figures`                              |
| Radii               | `--pw-rounded-xs`, `-sm`, `-md` and `-lg`                                                                                                                                                    |
| Spacing             | `--pw-spacing-unit`; the steps `--pw-spacing-2xs`, `-xs`, `-sm`, `-md`, `-lg`, `-xl` and `-2xl`; `--pw-spacing-island-padding`, `-island-gap`, `-panel-padding` and `-dialog-padding`        |
| Controls and widths | `--pw-spacing-control-compact`, `-desktop`, `-tablet` and `-touch`; `--pw-spacing-panel-width`, `-drawer-width`, `-menu-width` and `-dialog-width`; `--pw-spacing-sheet-max-height`, `62dvh` |
| Elevation           | `--pw-shadow-e0` to `--pw-shadow-e3`                                                                                                                                                         |
| Layers              | `--pw-layer-canvas`, `-overlay`, `-text-editor`, `-hint`, `-island`, `-panel`, `-notice`, `-popover`, `-tooltip`, `-sheet` and `-dialog`                                                     |
| Motion              | `--pw-ease`; `--pw-dur-quick`, `-enter`, `-panel` and `-sheet`; `--pw-shift-enter`, `-panel` and `-sheet`, their distances; `--pw-delay-tooltip`                                             |

## What S0 delivered

- [ADR 0012](../adr/0012-v02-editor-chrome.md), Proposed until its pull request's last commit
  before merging, and this plan.
- `scripts/tests/adr-index.test.ts`, which checks that the [ADR index](../adr/README.md) lists each
  record once with the title and status it gives, so that accepting ADR 0012 changes both.
- Pointers to both from the [documentation index](../README.md), the
  [overview](overview.md#decisions-and-what-stays-open), the
  [persistence design](engine/persistence.md) (for D7) and `AGENTS.md`.

S0 changed no production code, font, token, icon, layout or test behaviour.

## What S1 delivered

Issue #53 delivered slice S1 with no layout rule change; P0's text rewrapped in the new face.

- `apps/web/src/styles/tokens.css`: the 114 [custom properties](#custom-properties), generated once
  from this plan's tables by a script kept outside the repository and maintained in Git since.
  `scripts/tests/chrome-tokens.test.ts` checks each value and that nothing else is declared, and
  `scripts/tests/chrome-contrast.test.ts` measures the 23 [contrast pairs](#contrast-pairs) from
  them, one test each. They are tooling tests, since the web project's Vitest empties CSS imports.
- `apps/web/src/styles/fonts.css`: ADR 0011's three faces as they were, then `Planewright UI` 400 at
  the canvas's Inter 400 URL, `Planewright UI` 500 and `Planewright UI Fallback` (ADR 0012, decision
  8), with `inter-latin-500-normal.woff2` from Fontsource 5.3.0 in `apps/web/public/fonts`.
  `scripts/tests/bundled-fonts.test.ts` reads the faces there, keeps its ADR 0011 checks, checks
  that each canvas face is unchanged, and admits the chrome's faces and the 500 file by its size and
  hash.
- P0's `styles.css`, split into `base.css`, `page.css`, `canvas.css`, `element-list.css` and
  `saving.css` beside them. `base.css` keeps every element rule inside `:where()` and gives
  `strong`, `b`, `h1` to `h3` and `th` the weight 500, the only emphasis weight, and the text area
  keeps `Planewright Sans` at 400; `scripts/tests/base-styles.test.ts` checks both and that no style
  sheet sets another weight.
- `apps/web/tests/e2e/chrome-type.spec.ts`: a tool button computes `"Planewright UI"` first and is
  drawn in Inter, a heading in Inter Medium; Chromium requests each font file once, the Inter 400
  file included; and no element computes a weight but 400 or 500.
- One change this plan did not foresee: the web app measured every text again whenever a font
  finished loading, and the chrome's faces finish loading after the editor starts. `watchPage`
  (`apps/web/src/platform/page-events.ts`) now measures only when a canvas family's face loads, so
  that canvas text and its measurement stay as ADR 0011 decided; without it the scene-pixels spec,
  whose stored texts are not sized as measured, failed.
- P0's colours, focus ring, save status and layout rules are unchanged, and no
  `<link rel="preload">` was added. The new face changes only how P0's text wraps: at 390 px wide
  the canvas starts 24 px higher, since the pre-release sentence above it takes one line fewer, and
  the canvas host keeps its size. S2 to S13 are not implemented.

## What S2 delivered

Issue #55 delivered slice S2.

- `apps/web/src/shell/EditorShell.tsx` replaces `App`. Its root, where S7 will put
  `data-save-state`, holds a visually hidden h1 and the islands in the tab order of ADR 0012's
  decision 14: Pre-release, the tool bar's one stop, the canvas, the storage notices' buttons while
  storage needs attention, Elements and the list while its drawer is open, Undo, Redo and the zoom
  controls. The islands are siblings of the canvas host, never inside it, so no press on them
  reaches the canvas. The shell's state, the drawer and the open dialog, is one reducer
  (`shell/shell-state.ts`) that nothing stores.
- The canvas host fills `100vw` × `100dvh` and keeps its 1 px border, made transparent, so the
  scene canvas is the viewport less 2 px; `html` and `body` never scroll. The canvas's
  instructions stay its description, visually hidden, and P0's focus ring is drawn 3 px inside the
  host, since a ring outside a host as large as the window would not show; S10 replaces it.
- `apps/web/src/styles/shell.css` places the islands in a grid at 16, 12 and 8 px anchors: the
  identity island (the wordmark and the Pre-release tag), the tool bar at the top centre, the
  top-right island with Elements alone, the storage notices and then the open drawer under it,
  history and zoom at the bottom left, and the view readout with P0's save status at the bottom
  right. The top row's side tracks are as wide as their islands and the tool bar, which keeps P0's
  words until S3, wraps within the middle one, so no two islands intersect at any width; on phones
  it takes a row of its own, so the islands at the top of a 390 px screen reach 152 px down until
  S8's dock. Two choices differ from the [responsive rules](#responsive-rules): compact widths
  hide the wordmark but keep Elements' word, since the toggle has no glyph before S3, and the open
  drawer stacks under the notices instead of moving them left of it. The islands' text buttons are
  set in `label-md`, 13 px at 500, and the view readout and save status in `numeric-sm`; the
  notices gain a white background over the canvas.
- Reset zoom shows the zoom, such as "100%", and is named "Reset zoom, 100%"; it reads the zoom
  through a subscription that renders again only when the zoom changes.
- `ElementsToggle` and `ElementsDrawer`: a plain toggle with `aria-expanded` and `aria-controls`
  opens and closes the drawer around P0's element list, closed at every load (D4). The closed
  drawer keeps the list mounted but hidden, out of the tab order and the accessibility tree: S5
  unmounts it and memoises its options together, so that I1, which still pans with the 101 options
  rendered, changes what it measures once, in S5.
- `PrereleaseTag`, `shell/dialogs/ModalDialog.tsx` and `shell/dialogs/AboutDialog.tsx`: the tag
  opens About this build, a native modal dialog with the focus on Close, Tab wrapping inside, and
  Escape, Close or the scrim closing it and returning the focus to the tag. It holds P0's
  pre-release sentence, the "Not implemented yet" region with its paragraph, the "What this build
  contains" region, the protocol version and MIT line, the independence note and the "Source on
  GitHub" link, which answers the S0 review's m1. P0's `role=status` pill goes, and the page has no
  `status` role.
- `EmptyCanvasNote` repeats the pre-release sentence over the canvas while there are no elements
  and no text session; presses go through it to the canvas.
- One change this plan did not foresee: the layout's media queries are in `styles/responsive.css`,
  which `main.tsx` adds as a style element of its own. In the bundled style sheet, which declares
  the fonts, a resize across a breakpoint made Chromium recreate every font face of that sheet, so
  the canvas's faces loaded again and `watchPage` measured every text again; the scene-pixels
  spec's resize failed. `scripts/tests/media-queries.test.ts` keeps media queries out of every
  other style sheet, and an end-to-end test resizes across both breakpoints and back and finds the
  same faces, loaded, and the stored texts unchanged.
- From the S1 review: `scripts/tests/base-styles.test.ts` reads a bold only in `font-weight`,
  `font`, `font-variation-settings` and the `--pw-type-*` properties, so a planted `z-index: 700`
  or `order: 600` is accepted while `font: 700 …` and `font-weight: 600` are still refused; the
  scene-pixels spec has a direct test of the font-load filter, which failed with `watchPage`
  measuring on every `loadingdone`; and no S2 class rule sets a control's colour, border or
  outline, so P0's pressed, disabled and focus rules in `base.css` still apply.
- Tests: new end-to-end specs for About (`about.spec.ts`), the drawer (`drawer.spec.ts`),
  the shell's layout (`shell-layout.spec.ts`: the host's box, no scroll, islands that do not
  intersect at 1280 × 720 and 390 × 844, at rest and with the drawer open under a storage notice,
  and presses on islands that create nothing) and the empty canvas (`empty-canvas.spec.ts`), and
  unit tests of the shell, the note and the modal dialog. ADR 0012's 19 test migrations marked S2
  are done for S2's part, and decision 16 migrated two more assumptions of
  `chrome-type.spec.ts`: the count of headings and terms on the page, now read in About, and its
  font samples, Inter 400 now read from the view readout.
- Performance, on the developer machine, a 6-core virtual machine without a GPU where B1, B2 and
  B7 miss with unchanged code: two runs each of `perf:bench`, `perf:browser` and `perf:report` on
  S2's head and on `main` (`a766687`). The scene canvas at 1280 × 720 now has 1.67 times P0's
  pixels. B1 was 26.8 and 36.7 ms against 25.2 and 47.3 ms on `main`, B2 9.0 and 9.6 ms against 8.2
  and 20.5 ms, and B3 0.1 and 0.2 ms against 0.3 and 0.2 ms, within the machine's spread from run
  to run; B10 was 0.54 and 0.68 s against 0.48 and 0.72 s. I2, which now opens the drawer, was 88
  ms in both runs against 63 and 70 ms. B9 saw one task of 51 ms in one of the head's runs and none
  in the other three. The web app's initial JavaScript is 109.9 KB, 1.1 KB more than `main`'s, within
  B13's 200 KB, and B11 and B12 are unchanged.
- S3 to S13 are not implemented.
