# v0.2 editor experience: implementation and test plan

**Status: slice S0 (issue #50) wrote this plan and [ADR 0012](../adr/0012-v02-editor-chrome.md),
slice S1 (issue #53) added the chrome's tokens, base styles and typeface ([what S1
delivered](#what-s1-delivered)), slice S2 (issue #55) the full-bleed shell with its islands, the
Elements drawer and About this build ([what S2 delivered](#what-s2-delivered)), slice S3 (issue #62)
the original glyphs, the palette and the tooltips ([what S3 delivered](#what-s3-delivered)), slice
S4 (issue #64) the menu and the Keyboard shortcuts dialog ([what S4 delivered](#what-s4-delivered)),
slice S5 (issue #66) the Elements drawer's count, rows and phone sheet ([what S5
delivered](#what-s5-delivered)), and slice S6 (issue #69) the selection panel, the phone selection
bar and the Details sheet ([what S6 delivered](#what-s6-delivered)), slice S7 (issue #71) saving's
visibility ([what S7 delivered](#what-s7-delivered)), and slice S8 (issue #73) the phone composition
and the safe areas ([what S8 delivered](#what-s8-delivered)); slices S9 to S13 are not
implemented.** This plan turns ADR 0012's decisions into thirteen issues for milestone v0.2.0
(Editor Experience): what each slice contains, what must land before it, the tests it writes first,
how it is validated and which documents it updates. The decisions themselves, the tests to migrate
and the visual-regression matrix are in the ADR; where this plan and the ADR differ, the ADR
governs.

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
- **Delivered** by issue #62 ([what S3 delivered](#what-s3-delivered)).

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
- **Delivered** by issue #64 ([what S4 delivered](#what-s4-delivered)).

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
- **Delivered** by issue #66 ([what S5 delivered](#what-s5-delivered)).

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
- **Delivered** by issue #69 ([what S6 delivered](#what-s6-delivered)).

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
- **Delivered** by issue #71 ([what S7 delivered](#what-s7-delivered)).

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
- **Delivered** by issue #73 ([what S8 delivered](#what-s8-delivered)).

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
  sets a control's pressed, disabled or focus styles, except that S2 draws P0's ring 3 px inside
  the canvas host, which fills the window, and the Pre-release tag sets its own text and background
  colours (the S1 review's first suggestion, issue #55's A14).
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

| Component                                            | Where (`apps/web/src`)               | Slice  | Owns                                                                                |
| ---------------------------------------------------- | ------------------------------------ | ------ | ----------------------------------------------------------------------------------- |
| `EditorShell`                                        | `shell/EditorShell.tsx`              | S2, S7 | The islands' layout, the hidden h1, the shell's state and `data-save-state`         |
| `IdentityIsland`, `PrereleaseTag`, `AboutDialog`     | `shell/`, `shell/dialogs/`           | S2     | The mark, the wordmark, the tag and About, from `foundation.ts`                     |
| `MainMenu`, `ShortcutsDialog`                        | `shell/menu/`, `shell/dialogs/`      | S4     | The menu pattern and the shortcuts list, from `editor.commands`                     |
| `Toolbar`, `MoreTools`                               | `ui/Toolbar.tsx`, `shell/`           | S3, S8 | The palette, the phone dock and More; labels, order and shortcuts from the registry |
| `Icon`                                               | `shell/icons.tsx`, `shell/glyphs.ts` | S3     | The 35 original glyphs, in one typed record                                         |
| `ToolHint`, `CanvasFocusChip`                        | `shell/`                             | S10    | The hint line and the canvas's focus chip                                           |
| `CanvasHost`, `TextEditor`                           | `editor/`, `editor/text/`            | S2, S9 | The two canvases, input and resizing, and the text area with its hint chip          |
| `EmptyCanvasNote`                                    | `shell/`                             | S2     | The note while there are no elements and no text session                            |
| `SelectionPanel`, `DetailsSheet`, `geometry.ts`      | `shell/selection/`                   | S6     | The contextual panel, the phone bar and sheet, and their pure geometry              |
| `TopRightIsland`, `ElementsToggle`, `ElementsDrawer` | `shell/`                             | S2, S5 | The Elements toggle and the drawer or sheet around the list                         |
| `ElementList`                                        | `a11y/ElementList.tsx`               | S5     | The list box, its rows' markup; its behaviour, names and keys stay P0's             |
| `StorageProblemChip`, `StorageNotices`               | `ui/Saving.tsx`                      | S7     | The chip and the notices, with P0's words                                           |
| `useSaveRecovery`                                    | `a11y/save-recovery.ts`              | S7     | The one polite sentence after a failed save succeeds again                          |
| `HistoryControls`, `ZoomControls`, `ViewReadout`     | `ui/`                                | S2, S3 | Undo, Redo, zoom and the readout, from the registry and the view                    |
| `DoneBar`                                            | `shell/DoneBar.tsx`                  | S9     | The phone's Done bar above the keyboard                                             |
| Tooltip layer                                        | `shell/tooltip/`                     | S3     | One tooltip and its listeners, delegated to the shell's root and its document       |

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

- `apps/web/src/shell/EditorShell.tsx` replaces `App`. Its root, a `main` element and so the page's
  main landmark, as P0's `main` was, and where S7 will put `data-save-state`, holds a visually
  hidden h1 and the islands in the tab order of ADR 0012's decision 14: Pre-release, the tool bar's
  one stop, the canvas, the storage notices' buttons while storage needs attention, Elements and the
  list while its drawer is open, Undo, Redo and the zoom controls. The islands are siblings of the
  canvas host, never inside it, so no press on them reaches the canvas. The shell's state, the
  drawer and the open dialog, is one reducer (`shell/shell-state.ts`) that nothing stores.
- The canvas host fills `100vw` × `100dvh` and keeps its 1 px border, made transparent, so the
  scene canvas is the viewport less 2 px; `html` and `body` never scroll. The canvas's
  instructions stay its description, visually hidden, and P0's focus ring is drawn 3 px inside the
  host, since a ring outside a host as large as the window would not show; S10 replaces it. The
  focus tests check that each indicator they read, the canvas's included, lies inside the viewport.
- `apps/web/src/styles/shell.css` places the islands in a grid at 16, 12 and 8 px anchors: the
  identity island (the wordmark and the Pre-release tag), the tool bar at the top centre, the
  top-right island with Elements alone, the storage notices and then the open drawer under it,
  history and zoom at the bottom left, and the view readout with P0's save status at the bottom
  right. The top row's side tracks are as wide as their islands and the tool bar, which keeps P0's
  words until S3, wraps within the middle one rather than crossing them; on phones it takes a row of
  its own, so the islands at the top of a 390 px screen reach 152 px down until S8's dock. The
  notices and the open drawer share the height that the top and bottom rows leave, each up to its
  content and scrolling within its share, the drawer's padding being on the list's area so that it
  can shrink to its border, and the bottom row stays at the window's bottom; the shell clips rather
  than scrolls, so that the focus never scrolls it and the canvas stays under the whole window (the
  S2 review's M1). The tests check that every island lies inside the window and that no two
  intersect at 1280 × 720 and 390 × 844, at rest and with the drawer open under the
  storage-unavailable notice; at 844 × 390, 667 × 375 and 568 × 320, under the stale and the
  storage-unavailable notices, with the drawer closed and open; and at 844 × 140, with the drawer
  open under the stale notice. A window shorter than the top and bottom islands need, such as
  568 × 200, cuts the bottom islands off at its edge until S8 recomposes phones. Two choices differ
  from the [responsive rules](#responsive-rules): compact widths hide the wordmark but keep
  Elements' word, since the toggle has no glyph before S3, and the open drawer stacks under the
  notices instead of moving them left of it. The islands' text buttons are set in `label-md`, 13 px
  at 500, and the view readout and save status in `numeric-sm`; the notices gain a white background
  over the canvas.
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
  other style sheet under `apps/web/src`, beside a component too, and an end-to-end test resizes
  across both breakpoints and back and finds the same faces, loaded, and the stored texts unchanged.
- From the S1 review: `scripts/tests/base-styles.test.ts` reads a bold only in `font-weight`,
  `font`, `font-variation-settings` and the `--pw-type-*` properties, so a planted `z-index: 700` or
  `order: 600` is accepted while `font: 700 …` and `font-weight: 600` are still refused; the
  scene-pixels spec has a direct test of the font-load filter, which failed with `watchPage`
  measuring on every `loadingdone`; and no S2 class rule sets a control's pressed, disabled or focus
  styles beyond drawing the canvas host's ring 3 px inside it, so P0's pressed, disabled and focus
  rules in `base.css` still apply, while the Pre-release tag sets its own text and background
  colours.
- Tests: new end-to-end specs for About (`about.spec.ts`), the drawer (`drawer.spec.ts`), the
  shell's layout (`shell-layout.spec.ts`: the host's box, no scroll, islands inside the window that
  do not intersect at the viewports above, Tab past the stale notice to Undo at 667 × 375 scrolling
  the notices but never the shell, Tab to Undo at 568 × 200 leaving the canvas at the window's top,
  and presses on islands that create nothing) and the empty canvas (`empty-canvas.spec.ts`), and
  unit tests of the shell, the note and the modal dialog. ADR 0012's 19 test migrations marked S2
  are done for S2's part, and decision 16 migrated two more assumptions of `chrome-type.spec.ts`:
  the count of headings and terms on the page, now read in About, and its font samples, Inter 400
  now read from the view readout.
- Performance, on the developer machine, a 6-core virtual machine without a GPU where B1, B2 and B7
  miss with unchanged code: two runs each of `perf:bench`, `perf:browser` and `perf:report` at S2's
  `c6717be`, before the identifier renames and the review's fixes, and on `main` (`a766687`). The
  scene canvas at 1280 × 720 now has 1.67 times P0's pixels. B1 was 26.8 and 36.7 ms against 25.2
  and 47.3 ms on `main`, B2 9.0 and 9.6 ms against 8.2 and 20.5 ms, and B3 0.1 and 0.2 ms against
  0.3 and 0.2 ms, within the machine's spread from run to run; B10 was 0.54 and 0.68 s against 0.48
  and 0.72 s. I2, which now opens the drawer, was 88 ms in both runs against 63 and 70 ms. B9 saw
  one task of 51 ms in one of S2's runs and none in the other three. The web app's initial
  JavaScript is 109.9 KB, 1.1 KB more than `main`'s, within B13's 200 KB, and B11 and B12 are
  unchanged.
- S3 to S13 are not implemented.

## What S3 delivered

Issue #62 delivered slice S3.

- `apps/web/src/shell/glyphs.ts` holds the 35 original glyphs, 34 interface glyphs and the mark, in
  one typed record keyed by `IconName`, and `apps/web/src/shell/icons.tsx` the `Icon` component,
  which draws one at a requested size, 20 px by default, stroked 1.5 px wide in `currentColor` with
  round caps and joins and hidden from assistive technology, since the control that shows a glyph
  carries its name. Each glyph was drawn for Planewright from what its control does, on the 20 px
  grid inside a 2 px margin, from lines, rectangles, circles, ellipses, polylines, polygons, dots
  and paths of straight segments and circular arcs alone; none is traced from a screenshot or taken
  from an icon set, the reference application or the design package's files. They are the eight
  tools' glyphs (`hand`, `selection`, `rectangle`, `ellipse`, `diamond`, `line`, `freehand` and
  `text`), `lock-open` and `lock-closed`, `undo`, `redo`, `zoom-out`, `zoom-in`, `zoom-fit`,
  `zoom-reset`, `select-all`, `menu`, `more`, `elements`, `keyboard`, `info`, `external-link`,
  `close`, `check`, `chevron-down`, `chevron-up`, `status-problem`, `status-tabs`, `duplicate`,
  `delete`, `edit-text`, `details`, `multiple` and `mark`. S3 uses 16 of them, 15 at a time since
  the padlock shows one of its two; the others wait for the controls of S4 to S10. One change this
  plan did not foresee: the record is in a module of its own, beside `icons.tsx`, because the web
  app's lint wants a `.tsx` module to export components alone.
- The palette: P0's tool bar keeps its `toolbar` role, its name Tools, its one tab stop and arrow
  keys, and every button's name, `aria-keyshortcuts` and description, while each button shows its
  tool's glyph, 36 px square on desktops and 32 px at compact widths, with its first key in the
  bottom-right corner in JetBrains Mono, against the button's inner edge at compact widths so that
  it keeps clear of the glyph, hidden from assistive technology since the name,
  `aria-keyshortcuts` and the description carry every key. Hairlines, also hidden, split Hand and
  Selection, the drawing tools and tool lock, whose padlock is closed while tool lock is on, beside
  its pressed state. The buttons are named by `aria-label`, from the registry's labels.
  `styles/palette.css` sets the glyph buttons' size, the corner keys and the hairlines, and keeps
  the base's pressed, disabled and focus rules, which S10 coordinates, so the chosen tool still
  shows P0's blue; the compact size and corner are in `responsive.css`.
- Undo, Redo, Zoom out, Zoom in and Zoom to fit show their glyphs with their names unchanged, Reset
  zoom keeps showing the zoom and its name, "Reset zoom, 100%", and Elements keeps its word until
  S5's count. The identity island shows the mark before the wordmark, both hidden from assistive
  technology, and at compact widths, where the wordmark hides, the mark stays.
- Tooltips: `shell/tooltip/Tooltip.tsx` shows one tip, the name and keys of the control that the
  pointer rests on or the keyboard focuses, for the 15 controls that show a glyph or the zoom, from
  their `data-chrome-tip` and `data-chrome-keys`, which repeat the registry's label and the keys
  that the control's `aria-keyshortcuts` and description give. It opens after `--pw-delay-tooltip`,
  500 ms, which it reads from the page, at once on keyboard focus and never on touch, neither from a
  touch hover nor from the focus that a tap or a click gives, and closes on Escape, on a press, when
  the focus leaves its control and when the pointer leaves both the control and the tip. The Escape
  that closes a showing tip goes no further, as in the APG's tooltip pattern, so that dismissing a
  tip never also clears the selection or the chosen tool through the keymap's Escape; the next
  Escape does, and an Escape while no tip shows goes on as before. A press or an Escape keeps the
  tip of the control under the pointer closed until the pointer leaves that control, while a focus
  tip's control elsewhere stays free to open its hover tip. It sits 8 px under its control, or over
  it near the window's bottom, in `styles/tooltip.css`. The pointer can move onto it and rest there
  (WCAG 2.1's success criterion 1.4.13): the 8 px gap is part of the tip, through a `::before` that
  `Tooltip.tsx` sizes to the measured gap on the tip's side, so crossing it has no time limit, and a
  press on the tip closes it rather than reaching the canvas behind.
  `shell/tooltip/tooltip-events.ts` delegates its events: the shell's root has one listener for each
  pointer and focus event, and one keydown listener sits on the root's document, in the capture
  phase, so that Escape closes a hovered tip while the focus is outside the shell, as it is after a
  load, and a key that moves the focus counts before the focus moves. This plan said one listener on
  the shell's root. The tip has the `tooltip` role, a description, but no control points to it with
  `aria-describedby`, so that each control keeps S2's name and description and a screen reader never
  hears the name twice; the tip repeats only what the name, `aria-keyshortcuts` and description
  already say.
- Tests: `icons.test.tsx`, `Palette.test.tsx` (one button per registry tool in registry order with
  its glyph and `aria-keyshortcuts`, the corner keys, the hairlines and the padlock with
  `aria-pressed`), `Tooltip.test.tsx`, and new tests of Undo's and Redo's glyphs and of the mark;
  end-to-end, `palette.spec.ts` toggles the padlock from the keyboard and `tooltip.spec.ts` opens a
  tip on focus, closes it with Escape, opens one after the hover delay, closes it by leaving, and
  opens none after a tap. ADR 0012's rows for `Toolbar.test.tsx` lines 21 to 40, for S3's part of
  `ZoomControls.test.tsx` lines 20 to 38 and for `contrast-motion.spec.ts` lines 20 to 22 and 50 are
  migrated; the last also gains a test that measures every glyph and its control's border against
  their surfaces at a device pixel ratio of 2, from the colours the page computes and from a
  screenshot's pixels. Decision 16 migrated one more assumption, `chrome-type.spec.ts` line 86,
  which read Inter Medium on a tool button: it now reads it on Elements, and JetBrains Mono on the
  tool buttons, whose corner keys it checks are hidden and set in `Planewright Mono`. The review's
  fixes added tests that the Escape closing a tip goes no further, the chosen tool and the selection
  staying until a second Escape cancels; that an Escape on a focus tip keeps no hover tip of its
  control from opening; that the pointer can move onto a tip under or over its control; and that a
  hover tip shows 450 to 700 ms after the pointer arrives, measured in the page, with the page's
  token at 500 ms. `icons.test.tsx` now reads each arc's bulge by SVG 1.1's centre
  parametrisation, and `palette.spec.ts` checks at 800 × 720 that each corner key's box keeps clear
  of what its glyph paints.
- Contrast, measured by the new test, which reads both 1280 × 720 with the desktop's 36 px buttons
  and 800 × 720 with the compact 32 px ones, at a device pixel ratio of 2, with a rectangle drawn:
  every glyph at rest and the mark 16.70:1 (`on-surface` on the white islands) and its button's
  border the same, the chosen tool's white glyph and its border 5.59:1 on P0's `#2a62d0`, and the
  unavailable Redo's glyph and dashed border 7.56:1; the screenshots' most contrasting pixels read
  16.70 to 16.89, 5.59 and 7.68, at both sizes, before the review's fixes and after them. P0's focus
  ring, which S3 does not change, keeps the focus tests' 3:1 check.
- Cost: the glyphs and `Icon` alone are 4,276 bytes minified and 1,663 bytes gzip, under the 3 to 4
  KB estimated. At `471c733` the tooltip was 1,172 bytes gzip and the web app's initial JavaScript
  112,781 bytes gzip against `main`'s 109,944 at `0e31b0d`, 2,837 bytes more for the whole slice,
  within B13's 200 KB; B11 and B12 are unchanged. They were 1,176 and 112,782 bytes at `cbe6ccd`,
  and after the review's fixes, at `4fbd873`, they are 1,374 and 112,960 bytes, 3,016 bytes more
  than `main`.
- Performance, on the developer machine, a 6-core virtual machine without a GPU where B1 and B2 miss
  with unchanged code: two runs each of `npm run build`, `perf:browser` and `perf:report` on the
  head (`9971572`, before these documents) and on `main` (`0e31b0d`) in a worktree. B1 was 48.9 and
  30.1 ms against 32.4 and 64.7 ms on `main`, B2 12.4 and 10.3 ms against 13.8 and 13.9 ms, B3 0.2
  ms against 0.1 ms, B4 one frame in every run, and B10 0.50 and 0.59 s against 0.87 and 0.99 s; B9
  saw no long task in either first run and one, of 62 and 51 ms, in each second run. I1 was 89.4 and
  80.8 ms against 90.4 and 70.4 ms. I2 was 141.7 and 170.4 ms against 78.2 and 87.9 ms, so I2 alone
  was run six more times on each, alternating, in copies: its 95th percentile was 71 to 129 ms on
  the head and 79 to 108 ms on `main`, and its median 41.7 to 48.6 ms against 41.3 to 49.0 ms, so
  the difference lies within the machine's spread; I2 has no budget, and S5 changes what it
  measures. `perf:report` exits 1 in that sequence only because B5 to B8 and B11 to B13 are not
  measured there. After the review's fixes, which change the tooltip's pointer handling and one
  compact-width rule, two more runs each on `4fbd873` and on `cbe6ccd` in a worktree, in the order
  head, base, base, head, gave B1 36.0 and 56.7 ms against 30.1 and 43.0 ms, B2 17.2 and 21.0 ms
  against 21.7 and 18.7 ms, B3 0.23 and 0.20 ms against 0.20 and 0.65 ms, B4 one frame and B9 no
  long task in every run, B10 0.49 and 0.76 s against 0.34 and 0.51 s, and the 95th percentiles of
  I1 93.2 and 147.9 ms against 182.0 and 181.7 ms and of I2 58.7 and 74.2 ms against 219.5 and
  76.0 ms, differences within the machine's spread. B1's misses remain follow-up #49's.
- S4 to S13 are not implemented.

## What S4 delivered

Issue #64 delivered slice S4.

- `apps/web/src/shell/menu/MenuButton.tsx`: the identity island now starts with a glyph button
  showing S3's `menu` glyph, before the mark, the wordmark and the Pre-release tag, which keeps its
  place and behaviour. It is named "Planewright menu", the design's name, which its tooltip
  repeats, has `aria-haspopup="menu"` and `aria-expanded`, and `aria-controls` while its menu is
  open, and it is the first tab stop of ADR 0012's decision 14. A press, Enter, Space or ArrowDown
  opens the menu with the focus on its first item, and a second press closes it; since a mouse
  press takes the focus out of the open menu, which closes it, before the click, the click
  remembers whether the menu was open when the press began.
- `apps/web/src/shell/menu/MainMenu.tsx`, with its items in `menu-items.ts`: a `menu` named by its
  button, holding Select all, Zoom to fit and Reset zoom, whose labels and keys come from the
  registry and which run `selection.select-all`, `view.zoom-to-fit` and `view.zoom-reset` through
  `editor.run`; Show elements, a `menuitemcheckbox` whose `aria-checked` is the drawer's state and
  which opens and closes the drawer as the Elements toggle does, with a check glyph while it is
  open; Keyboard shortcuts and About this build, which open the dialogs; and Source on GitHub, a
  link to the repository, whose address `foundation.ts` now holds for About and the menu. Each item
  shows one of S3's glyphs, hairlines with the `separator` role split the three groups, and a
  command that the registry lacked would be left out, not invented. The keys show in JetBrains Mono,
  hidden from assistive technology, since the name and `aria-keyshortcuts` carry them; the check is
  hidden too. ArrowDown and ArrowUp move, wrapping at the ends, and Home and End go to them; Enter
  or a press runs an item, closes the menu and returns the focus to the button; Escape closes it
  and returns the focus; the focus leaving it, by Tab or a press elsewhere, closes it where the
  focus went, so that Tab goes on to Pre-release; and a press inside it keeps the focus on its
  items. One choice that the plan did not foresee: the menu closes when the focus leaves it rather
  than on Tab's key press, since closing it then would remove the focused item before the browser
  moved the focus. `styles/menu.css` puts it under the island from its left edge, 264 px wide or the
  window less its anchors, scrolling inside itself in a window too short for it, such as 568 × 320,
  with its items 36 px high, the surface's hover colour behind the item that the pointer or the
  keyboard is on, and P0's focus ring inside its padding; while it is open the island takes the
  menus' layer, through a class that it sets rather than a `:has()` rule (see the performance
  below), so that on a phone, where it covers the tool bar, presses reach its items. It is a
  popover at every width: the phone's menu sheet is S8's.
- `apps/web/src/shell/ShortcutsButton.tsx` and `shell/dialogs/ShortcutsDialog.tsx`: a Keyboard
  shortcuts button with S3's `keyboard` glyph and a tooltip ends the bottom-right island, the last
  tab stop, and opens, as the menu does, a dialog that lists every command of the registry, 28 at
  this slice, with its label and its keys as `shortcutText()` writes them, each chord in a key chip
  in JetBrains Mono. The commands are grouped in five tables, Tools, History, Selection, View and
  Canvas, by the area that their identifiers start with, in registry order; the type asks for a
  heading for every area of `CommandId`, so that no command can fall outside them. A sentence says
  that the keys work while the drawing canvas has the focus. It shares About's `ModalDialog`: the
  focus on Close, Tab wrapping, and Escape, Close or the scrim closing it. The shell's state now
  remembers which control opened a dialog, the menu button, the Pre-release tag or this button, and
  gives the focus back to it, so that a dialog opened from the menu returns it to the menu button.
  One change that the plan did not foresee: `ui/shortcuts.ts` wrote every produced key upper case,
  so the registry's Escape, Enter, Delete, Backspace and arrow keys would have read ESCAPE or
  Shift+ARROWLEFT; it now writes them for people as Esc, Enter, Delete, Backspace and Left arrow,
  and for `aria-keyshortcuts` as their key values, such as Escape and ArrowLeft. No control showed
  such a key before.
- About this build opens from the Pre-release tag and from the menu, one `AboutDialog` with the
  same content, which a unit test compares from both.
- Tests: `MainMenu.test.tsx` (11 tests), `ShortcutsDialog.test.tsx` (4) and a case in
  `shortcuts.test.ts`; end to end, `menu.spec.ts` (11: the four ways to open it, the arrows, Home
  and End, Escape, Tab, presses outside and inside, the commands, Show elements, the keys' face and
  hiding, the dialogs from the menu with the focus kept inside and returned, the menu over the tool
  bar at 390 × 844 and inside a 568 × 320 window), `shortcuts.spec.ts` (4) and a contrast test of
  the menu and the dialog. ADR 0012's rows whose slice names S4 are migrated for S4's part:
  `e2e/foundation.spec.ts` lines 24 to 48 and `e2e/keyboard.spec.ts` lines 29 to 30, where the
  first Tab lands on the menu button and the second on Pre-release, then Hand;
  `e2e/focus.spec.ts` lines 12 to 37, with the menu first, Keyboard shortcuts last and the link in
  the menu and About; and `unit/App.test.tsx` lines 71 to 91, now `EditorShell.test.tsx`, likewise.
  The keyboard row's lines 63 to 64 need nothing from S4, since Tab from the canvas still lands on
  Elements until S6. Decision 16 migrated the tests that assumed S2's or S3's identity island and
  first stops: `EditorShell.test.tsx`'s identity island test (its buttons and its first glyph),
  `Tooltip.test.tsx`'s list of tipped controls and its reading of a control without a description,
  three tests of `tooltip.spec.ts` and one of `palette.spec.ts` that counted Tabs from the top, and
  `contrast-motion.spec.ts` measures the two new glyphs at 3:1. No test was deleted.
- Contrast: every text of the open menu and of the dialog is 4.5:1 or more, the nearest the
  highlighted item's keys, `on-surface-muted` on `surface-hover`, 4.71:1 in the
  [table](#contrast-pairs); the new glyphs pass the 3:1 test of S3.
- Cost: S4's new modules alone, bundled and minified with what they share with earlier slices left
  out, are 5,140 bytes, 2,150 bytes gzip. The web app's initial JavaScript is 114,612 bytes gzip at
  `01882eb` (114,596 at `dc7a507`) against `main`'s 112,960 at `db8b3e7`, 1,652 bytes more, within
  B13's 200 KB; B11 (30,292) and B12 (2,524) are unchanged, and the style sheet grows from 3,237 to
  3,525 bytes gzip, measured with the bundle-size guardrail's `gzipSize`, at level 9 with no file
  name (the 3,267 and 3,552 first written here are the `gzip` command's, whose own compressor and
  the file name that it stores both add bytes).
- Performance, on the developer machine, a 6-core virtual machine without a GPU under a load
  average of 3 to 5 from other work, where B1 and B2 miss with unchanged code: `npm run build`,
  `perf:browser` and `perf:report` on the head and on `main` (`db8b3e7`) in a worktree, in
  alternating order. At `dc7a507`, four runs each gave B1 27.7, 47.7, 53.2 and 34.9 ms against
  24.1, 34.5, 27.3 and 62.3 ms on `main`, B2 10.8, 25.0, 15.6 and 7.7 ms against 9.6, 12.9, 11.0
  and 14.1 ms, B3 0.10 to 0.35 ms against 0.20 to 0.53 ms, B4 one frame and B9 no long task in
  every run but one of `main`'s, which saw one, and B10 0.51, 0.65, 0.55 and 0.71 s against 0.39,
  0.39, 0.43 and 0.67 s; the third head run overlapped a tooling test run. Since B10 read higher on
  the head, it was run alone, 12 loads a run, alternating builds: the pooled median was 0.360 s
  against 0.321 s over 14 runs each, and, head against head over 8 runs each, 0.347 s with the
  menu's `:has()` rule against 0.303 s without it. The rule's cost is inferred from those medians,
  not traced, and the island now raises itself with a class (`01882eb`). At `01882eb`, B10 alone
  gave 0.384 s against 0.359 s over 8 runs each, under a higher load, and two full runs each gave
  B1 37.3 and 34.2 ms against 34.8 and 29.9 ms, B2 14.9 and 13.5 ms against 23.3 and 15.7 ms, B3
  0.20 ms against 0.20 and 0.23 ms, B4 one frame and B9 no long task in every run, B10 0.82 and
  1.11 s against 1.21 and 0.33 s, all within its 1.5 s, and the 95th percentiles of I1 103.9 and
  94.8 ms against 126.8 and 77.0 ms and of I2 101.8 and 71.6 ms against 137.1 and 71.1 ms,
  differences within the machine's spread. `perf:report` exits 1 in this sequence only because B5
  to B8 and B11 to B13 are not measured there. B1's misses remain follow-up #49's.
- From the S4 review: the menu button's hover tip no longer covers its open menu (m1). The tip, on
  the tooltip's layer above the raised island, lay over the top of Select all, so that a mouse that
  came back to rest on the button showed it and a press there landed on the tip; now a hover rest
  that ends while its control's popup is open, with `aria-expanded` true, opens no tip
  (`tooltip/tooltip-events.ts`), and the closed button keeps its hover and focus tips. The window
  losing the focus to another window closed the menu with the focus left on the page's body (m2);
  the menu now leaves a focusout to no element, while the document has lost the focus, to the
  window's own blur, which closes it with the focus on the button, where it is when the window
  comes back, and a focusout to an element, or to none while the window keeps the focus, still
  closes it where the focus went. Two tests in `Tooltip.test.tsx`, two in `MainMenu.test.tsx`, now
  13, and one in `menu.spec.ts`, now 12, a press on the top of Select all after a rest on the
  button, cover the fixes. The two tip tests, the end-to-end test and the window blur's test failed
  against `d2f316d`, and the test of the focus going elsewhere passed there, since it pins what was
  kept. The window blur was also checked in headed Chromium under Xvfb, since Playwright's headless
  focus emulation sends no window blur. The style sheet is unchanged, and the initial JavaScript is
  114,703 bytes gzip at `549efa7`, 91 bytes more than at `d2f316d`.
- S5 to S13 are not implemented.

## What S5 delivered

Issue #66 delivered slice S5.

- `apps/web/src/shell/ElementsToggle.tsx`: the Elements toggle shows S3's `elements` glyph, its word
  and the count of the drawn elements in `numeric-sm`, Inter's tabular figures, on the muted
  surface, 36 px high on desktops and 32 px at compact widths. The glyph and the count are hidden
  from assistive technology, so that the name stays exactly "Elements", and nothing in or around
  the toggle is a live region, so that a change, which the polite region already says, is never
  said again by the count. The count reads the view's elements through a subscription that renders
  again only when their number changes. One choice that this plan did not foresee: the toggle
  keeps its word at compact widths, which the [responsive rules](#responsive-rules) would hide,
  since a toggle of a glyph and a number alone would need a tooltip to name it, and S8's phone top
  bar recomposes that island.
- `apps/web/src/shell/ElementsDrawer.tsx`: the drawer, still closed at every load and stored
  nowhere (D4), is 300 px wide on desktops and 280 px at compact widths, in `responsive.css`.
  While it is closed it mounts no list, and its own element stays, empty and hidden, for the
  toggle's `aria-controls`. While it is open, a Close button, a glyph button named and tipped
  "Close Elements", sits beside the list's heading, and the list's keys are folded under a Keys
  summary, so that decision 14's stops follow Elements: Close, the summary and the list.
  `shell/drawer-focus.ts` moves the focus as the drawer opens, to the list box, and as it closes,
  to the toggle, whichever control did it: the toggle, the menu's Show elements, which now closes
  the menu without giving the focus back to its button, or Close; the shell's state gains a
  `close-drawer` action. A probe of Chromium's own accessibility tree found that the folded keys no
  longer described the list box, since Chromium describes nothing by what a closed `details`
  element holds; the description is now a visually hidden copy of P0's sentence outside the fold,
  as the zoom buttons' descriptions are, and an end-to-end test reads Chromium's tree through CDP.
  P0's focus ring now covers a `summary` too.
- `apps/web/src/a11y/ElementList.tsx`: the options are a memoised component whose props are the
  view's elements and selection, the active position and the way to choose, which `useActive`
  keeps stable while the elements and the selection keep their identity, as a camera change keeps
  them, so that a pan step renders and names no option again. Each row shows its kind's glyph, the
  drawing tool's, hidden from assistive technology, then a label, the kind's name or a text's
  words in quotation marks, cut as the name cuts them, then its figures in JetBrains Mono
  (`geometry`), as "100 × 100 · 350, 250", with a turn such as "45°" when there is one, from
  `elementRow` in `a11y/element-names.ts`, which shares the name's rounding and cut. The option
  keeps P0's name through `aria-label`, so that a screen reader says P0's words and never the
  row's shorter text, and the row's words and figures are each words of that name (WCAG 2.5.3). A
  row is memoised on its element, so that moving the active option or the selection builds no row
  again. A selected row keeps P0's colours, which S10 coordinates, its figures taking its text
  colour; the kinds that P0 does not draw, which the view never lists, would show the list's glyph.
- The phone's sheet: on a phone in portrait, under 600 px wide and at least 500 px high, the open
  drawer is a sheet along the window's bottom, its top corners rounded, on the sheets' layer and
  elevation, at most 62 % of the window's height, with its list scrolling inside it.
  `shell/sheet.ts` follows the query through `matchMedia`, and `responsive.css` holds the same one,
  which a tooling test keeps equal; a phone in landscape keeps the 280 px side drawer. While the
  sheet is open, the tool bar, which S8 makes the phone's dock, and the bottom-left group are
  `inert`, as this plan asks, and so is the bottom-right group, which the sheet covers too until S8
  recomposes phones. Their controls sit in a box that adds nothing to the island's layout and takes
  the attribute, so that a tap on them reaches their island, which takes it, rather than the canvas
  that an inert island would let it reach. Escape inside the sheet closes it and goes no further,
  so that the list keeps the selection, as the Escape that closes a tooltip does, and the focus
  returns to the toggle; on desktops and in landscape Escape in the list still reaches the editor.
  The sheet lies in the shell's grid, below the storage notices (the S5 review's M1, below). The
  tool bar stays at the top until S8 and shows while inert.
- Tests: `ElementsToggle.test.tsx` (4), `ElementsDrawer.test.tsx` (6, among them the mounting, the
  options' and rows' memoisation counted through spied names, the focus moves, the folded keys and
  nothing written to storage) and `ElementsSheet.test.tsx` (3); tests of `elementRow` in
  `element-names.test.ts` and of the rows in `ElementList.test.tsx`; a tooling test of the sheet's
  query; end to end, `drawer.spec.ts` (the count's face and figures, the 300 and 280 px drawer and
  its focus moves, the folded keys in Chromium's tree, the rows' glyphs, labels and faces, the
  mounting and the storage after a reload) and `elements-sheet.spec.ts` (4: the sheet's place, cap
  and scrolling, the inert islands and Escape, Close and the toggle, and the landscape drawer).
  ADR 0012's rows whose slice names S5 are migrated: `unit/App.test.tsx` lines 58 to 69 and 71 to
  91, now `EditorShell.test.tsx`, which finds no list box in the page while the drawer is closed
  and Close, the summary and the list after Elements while it is open; `unit/TextEditor.test.tsx`
  lines 121 to 137, whose session ends as the drawer's opening focuses the list box;
  `e2e/focus.spec.ts` lines 12 to 37, which walks back from the list through the summary and Close;
  `unit/ElementList.test.tsx` lines 31 to 38, `e2e/focus.spec.ts` lines 59 and 117,
  `e2e/keyboard.spec.ts` lines 20 to 23 and 52 to 59 and `e2e/targets-phone.spec.ts` lines 34 to
  37 and 59, which read the options' accessible names, through `expectOptionNames` and `nameOf` in
  `e2e/a11y.ts` end to end; `e2e/a11y.ts` line 13 and its users, which open the drawer first, as S2
  made them, and find the list box focused once it opens; and `perf/panning.spec.ts` with I1's
  label and reference in `scripts/lib/perf-budgets.ts`, below. Decision 16 migrated seven more
  tests that assumed S2's to S4's behaviour: `chrome-type.spec.ts`'s faces of the toggle, now its
  word in Inter Medium beside its count in Inter; `MainMenu.test.tsx`'s and `menu.spec.ts`'s Show
  elements, which now focuses the list box and then the toggle, where they expected the menu
  button; `contrast-motion.spec.ts`'s check that no visible text names a tool, read before the
  drawer opens since its rows name kinds; `drawer.spec.ts`'s keys test, which read the options'
  text; `shell-layout.spec.ts`'s test at 390 × 844, where the sheet may meet only the islands whose
  controls are inert; and `ElementList.test.tsx`'s large drawing, given 20 s since its rows' glyphs
  and spans cost jsdom about twice P0's time. No test was deleted.
- Cost: S5's new and changed modules, `ElementsToggle`, `ElementsDrawer`, `ElementList`,
  `element-names`, `drawer-focus` and `sheet`, bundled and minified together with React, the engine
  and the modules of earlier slices left out, are 6,738 bytes, 2,962 bytes gzip, against 4,221 and
  2,011 bytes for the four of them that `main` has, 951 bytes gzip more. The web app's initial
  JavaScript is 115,604 bytes gzip at `7de6db0` against `main`'s 114,703 at `731e7b0`, 901 bytes
  more, within B13's 200 KB; B11 (30.3 KB) and B12 (2.5 KB) measure packages that S5 does not
  touch, and the style sheet grows from 3,525 to 3,769 bytes gzip, measured with the bundle-size
  guardrail's `gzipSize`.
- Performance, on the developer machine, a 6-core virtual machine without a GPU under a load
  average of 3 to 5 from other work, where B1 and B2 miss with unchanged code: `npm run build`,
  `perf:browser` and `perf:report` on the head (`7de6db0`) and on `main` (`731e7b0`) in a worktree,
  in the order head, main, main, head. B1 was 67.6 and 187.5 ms against 90.9 and 152.3 ms on
  `main`, B2 21.5 and 20.3 ms against 35.1 and 28.7 ms, B3 0.32 and 0.10 ms against 0.20 and 0.10
  ms, B4 one frame and B9 no long task in every run, and B10 2.11 and 1.64 s against 1.57 and 1.60
  s, over its 1.5 s in all four runs on this machine. I1's 95th percentile was 173.6 and 197.7 ms
  against 343.0 and 256.8 ms and its median 65.1 and 61.5 ms against 69.9 and 77.0 ms; I2's 95th
  percentile was 266.1 and 454.1 ms against 260.5 and 190.3 ms and its median 106.1 and 103.1 ms
  against 90.2 and 71.2 ms. `perf:report` exits 1 in this sequence only because B5 to B8 and B11 to
  B13 are not measured there. Since I2 read higher, `panning.spec.ts` alone ran four times on each,
  alternating, in copies: I1's medians were 58.8 to 105.7 ms against 79.4 to 124.4 ms, so the
  closed drawer's pan step is level with `main`'s or cheaper, and I2's 115.5 to 145.1 ms against
  74.3 to 123.6 ms. A probe of I2's loop, reading Chromium's metrics at each step, found the
  task time with the drawer open at 137.5 to 180.6 ms over seven runs on the head (median 154.9)
  against 81.4 to 135.4 ms over six on `main` (101.2), while the script time was 18.7 to 23.6 ms
  against 16.4 to 23.5 ms, as the memoised options predict, and layout under 1 ms and style
  recalculation none in both. The added time is therefore outside script, style and layout. In one
  round, a variant without the rows' glyphs read 137.6 ms against the head's 180.6 and `main`'s
  135.4, and one with P0's text rows 147.5; a drawer with `will-change: transform` read 129.1,
  131.8 and 174.1 ms, paint containment on the list 161.4 to 175.1 ms, 20 px glyphs 152.7 and 171.0
  ms and rows with `content-visibility: auto` 174.9 and 191.7 ms. Single runs here vary by 40 ms,
  so no cause is established and none of these was adopted; I2 has no budget, and a pan step with
  the drawer open costing more than on `main` is left to a follow-up. B1's misses remain #49's.
- From the S5 review: on a phone in portrait the sheet no longer covers the storage notices (M1).
  Fixed to the window's bottom on the sheets' layer, it lay over the stale notice's two buttons,
  which stayed in the tab order, so that Shift+Tab from Elements focused "Keep this version" under
  it at 390 × 844, 375 × 667 and 360 × 560 with a full list. The sheet is now a grid item again in
  `responsive.css`: it spans the shell's drawer and bottom rows, so that it lies below the notices,
  which keep their height and their own scrolling, and over the bottom islands, still inert while
  it is open. It is bottom-aligned, its negative margins take it over the shell's 8 px padding to
  the window's edges, and it is at most 62 % of the window's height and no taller than those rows:
  with 40 rectangles and no notice it is 523 px at 390 × 844, as before, and under the stale notice
  480 px there, 303 px at 375 × 667, 196 px at 360 × 560 and 136 px at 360 × 500, where its list
  shows 45 px. The notices take their height first: in a probe that added copies of the notice's
  words, the sheet shrank to 108 px at 360 × 500, with Close in view, its list 17 px high and the
  notices scrolling. The side drawer of landscape and short windows is unchanged. Six tests in
  `elements-sheet.spec.ts`, now 10, at 390 × 844, 375 × 667 and 360 × 560 with 41 rectangles under
  the stale notice, check that the sheet lies along the bottom below the notices in the height that
  they leave and that Shift+Tab from Elements focuses both answers in the window with nothing over
  their centres; all six failed against `df3c98b`. `responsive.css` ships in the JavaScript, whose
  initial bundle is 115,625 bytes gzip at `bc22567`, 21 bytes more than at `df3c98b`; the style
  sheet is unchanged.
- S6 to S13 are not implemented.

## What S6 delivered

Issue #69 delivered slice S6.

- `apps/web/src/shell/selection/geometry.ts`: the selection's figures as a pure module, with no
  React, DOM, editor, storage or timer, which imports only the engine's types and `localBox` and the
  rounding of `a11y/rounding.ts`, the module that the element list's names and rows now share, so
  that the three never disagree. For one element it gives the kind, the unrotated local box, the
  same figures as the element's list name and row, the turn normalised to degrees from 0 to 360, a
  turn that rounds to 360 read as 0, and the kind's figure: a line's length, the sum of its
  segments, a freehand stroke's points, 1 for a dot, or a text's lines, those its line breaks make,
  since P0 texts do not wrap. For several it gives their count and the union of each one's
  `rotatedBounds`, the axis-aligned box of its local box's corners turned about the box's centre,
  with no stroke width, which the canvas's selection frame adds and the panel does not. Identifiers
  that the view does not list are skipped. `figuresOf` writes X, Y, W and H, with Width and Height
  for assistive technology, the angle with a degree sign, and the length to one decimal. The kinds'
  glyph map moved from `a11y/ElementList.tsx` to `shell/kind-glyphs.ts`, shared by the list's rows
  and the selection's heading.
- `shell/selection/SelectionPanel.tsx`: the panel, 232 px wide, mounted only while something drawn
  is selected and no text is edited, and out of the page otherwise, so that with no selection it has
  no tab stop and no cost. It is a group named by its heading, the kind's glyph and name or the
  multiple glyph and "N elements", neither a landmark nor a live region; its figures are static text
  in a description list, the values in JetBrains Mono and the terms in Inter Medium; Duplicate and
  Delete take their names, keys, descriptions and tooltips from the registry and run
  `selection.duplicate` and `selection.delete` through `editor.run`, Delete in the error tone; Edit
  text runs `canvas.enter` and shows only when the Selection tool is active and one element, a text,
  is selected, which is when `canvas.enter` edits it; and the footnote says "Style controls are not
  in this build.". Each action shows its glyph and its word, which names it, 32 px high and 44 px
  under a coarse pointer. `use-selected.ts` subscribes to the view's elements, selection and tool
  and to whether a text is edited, values that keep their identity across camera changes, and
  memoises the geometry, so that a pan or zoom step renders the panel, the bar and the sheet not at
  all, which a Profiler's count shows. When a surface goes with the focus inside it, as after
  Delete, the canvas takes the focus before the surface leaves the page.
- Where the panel sits: `styles/selection.css`, imported from `main.tsx` with no media query, places
  it from the notices' row to a new room row of the shell's grid, a fraction of the height between
  the drawer's row and the bottom row, so that it adds nothing to the rows' sizes, lies beside the
  notices and the drawer, and is no taller than the room above the bottom islands, scrolling inside
  itself. The bottom row's box reaches one gap above its row, so that the notices, the drawer and
  S5's sheet keep exactly their places: a probe of every box under the shell's main element in 70
  states with no selection, at 14 viewports from 1440 × 900 to 568 × 200, found no difference from
  `f57481d`. The panel starts 2 px under the grid's row, the shell's gap below the 46 px top row
  ending at 70 px, so that it sits at the design's 16 / 72 on desktops; at compact widths it sits at
  the 12 px anchor, 64 px down.
- The phone's bar and sheet: under the sheet query that `shell/sheet.ts` follows,
  `shell/selection/SelectionBar.tsx` shows a bar in the panel's place with the same heading and
  actions under the same rules, then Details, each a 44 px glyph button whose word is visually
  hidden and still names it, and `DetailsSheet.tsx` a region named "Details" along the window's
  bottom, at most 62 % of its height, which repeats the heading and shows the figures, the footnote
  and a Close Details glyph button. The shell's reducer holds the sheet's open state, closed at
  every load and stored nowhere; opening it closes the Elements sheet and opening the Elements sheet
  closes it, the one that opens taking the focus. Opening it puts the focus on Close Details; Close
  or Escape closes it with the focus back on Details, the Escape going no further; it closes when
  the selection empties, the focus going to the canvas, when a text session starts and when the
  window leaves the query; and while it is open the tool bar and the bottom islands are inert, as
  under the Elements sheet.
- Choices that this plan or the issue did not foresee. The [responsive rules](#responsive-rules) put
  the bar and the notices in one flex column; `responsive.css` instead puts the bar in the notices'
  grid row and the notices in the next one, and starts both sheets at the room row, so that the bar
  comes first and the notices after it and, with no bar, the grid is S5's. The bar shows its
  actions' glyphs without their words, since four words and a heading would not fit a 360 px row.
  The panel's terms use the `label-sm` role, Inter at 500, as the base styles set every term.
  Windows under 500 px high keep the panel rather than the bar, as the ADR's 844 × 390 states read
  "selection and drawer", scrolling in the room left; at 568 × 320 and 844 × 140 it lies apart from
  every island and notice, but under about 556 px wide and 500 px high, where no test reaches, the
  panel and the right-hand notices or drawer may not fit side by side. The issue said that tool lock
  leaves a new element selected; a creation under tool lock selects nothing, as P0's tool lock
  description says, so a lone text is selected with the Text tool active through Select all or the
  element list, and the tests reach that state so. Edit text also needs one selected identifier, as
  `canvas.enter` does, so a text selected with an arrow that the view does not list shows none. With
  the keyboard, the Escape that follows Details' opening first closes Close Details' tooltip, as
  S3's tooltips do.
- Tests: `selection-geometry.test.ts` (9 examples) and `selection-geometry-properties.test.ts` (7
  seeded properties, over `tests/support/property.ts`, a generator of the web app's own),
  `SelectionPanel.test.tsx` (5), `SelectionPanel-actions.test.tsx` (5), `DetailsSheet.test.tsx` (6),
  `SelectionBar.test.tsx` (2), `shell-state.test.ts` (3), a tab-order case in `EditorShell.test.tsx`
  and a tooltip case in `Tooltip.test.tsx`, and the tooling test `selection-styles.test.ts` (3); end
  to end, `selection-panel.spec.ts` (7 tests, 10 runs at 1440 × 900, 1280 × 720, 800 × 720 and
  1024 × 768 with touch), `selection-panel-actions.spec.ts` (5), `selection-bar.spec.ts` (8 tests,
  14 runs at 390 × 844, 375 × 667 and 360 × 560 with touch, and 844 × 390), `shell-layout.spec.ts`'s
  cases with a selection at three wider viewports and with the Details sheet at 390 × 844, and
  `contrast-motion.spec.ts`'s case of the bar's and sheet's texts and glyphs. ADR 0012's row for
  `e2e/keyboard.spec.ts` lines 63 to 64, S6's part now at lines 62 to 64, is migrated: Tab from the
  canvas reaches Duplicate, Delete and Edit text, then Elements. Decision 16 migrated
  `focus.spec.ts`'s Escape test, where Tab from the text area still reaches Elements, since the
  panel is out of the page during the session, as the ADR's row for its lines 56 to 57 says when no
  panel shows, and which now walks back through Edit text, Delete and Duplicate to the canvas, and
  its stale-notice tab loop, with Duplicate and Delete first; `shell-layout.spec.ts`'s counts under
  the stale notice, one more with the panel, and its Tab loop at 667 × 375;
  `creation-history.spec.ts`'s pair, probes and presses, moved 300 px right, clear of the panel; and
  `contrast-motion.spec.ts`'s check that no visible text names a tool, read before anything is
  drawn, its texts with the panel's, Delete at 6.52:1 and the footnote at 5.50:1, and its glyphs
  with the panel's. The audit found `creation-phone.spec.ts` unaffected, its touches below the bar,
  which ends 162 px down at 412 × 915, and `targets-phone.spec.ts`, the S5 sheet's tests,
  `chrome-type.spec.ts` and the dark-scheme contrast test pass unchanged. No test was deleted.
- Cost: S6's selection modules, bundled and minified with React, the engine and the earlier slices'
  modules left out, are 7,539 bytes, 2,930 bytes gzip. The web app's initial JavaScript is
  117,523 bytes gzip against `main`'s 115,625 at `f57481d`, 1,898 bytes more, within B13's 200 KB;
  B11 (30,292) and B12 (2,524) are unchanged, and the style sheet grows from 3,769 to 4,220 bytes
  gzip, measured with the bundle-size guardrail's `gzipSize`.
- Performance, on the developer machine, a 6-core virtual machine without a GPU under a load average
  of 3 to 5 from other work: `npm run build`, `perf:browser` and `perf:report` on the head
  (`5ba20b7`, whose application code is `4174f98`'s) and on `main` (`f57481d`) in a scratch
  worktree, in the order head, main, main, head. B1 was 56.6 and 30.7 ms against 59.3 and 29.5 ms on
  `main` and B2 15.7 and 12.2 ms against 8.3 and 12.2 ms, both over their budgets on both, B1's
  misses remaining #49's; B3 was 0.13 and 0.25 ms against 0.23 and 0.20 ms, B4 one frame and B9 no
  long task in every run, B4's pan and B9's nudges running with a selection and so with the panel
  mounted, and B10 0.51 and 0.50 s against 0.56 and 0.43 s. The 95th percentiles of I1 were 126.6
  and 71.9 ms against 67.9 and 89.7 ms, its medians 41.5 and 39.7 ms against 37.3 and 41.8 ms, and
  those of I2 93.3 and 126.7 ms against 121.2 and 99.8 ms, its medians 58.9 and 61.7 ms against 61.4
  and 57.5 ms. Since I1's first head run read higher, `panning.spec.ts` alone ran three times on
  each, alternating: I1's medians were 36.2, 42.1 and 44.6 ms against 41.5, 39.8 and 37.4 ms, and
  I2's 59.3, 53.6 and 66.3 ms against 58.0, 61.6 and 58.6 ms, with one I2 95th percentile of
  170.2 ms on the head among values of 95.9 to 111.1 ms, differences within the machine's spread;
  the panning scene selects nothing, so no panel is mounted there. `perf:report` exits 1 in this
  sequence only because B5 to B8 and B11 to B13 are not measured there.
- S7 to S13 are not implemented.

## What S7 delivered

Issue #71 delivered slice S7. Each choice that the plan or the ADR did not make is marked
[Inferred], as in the issue.

- P0's save status and its three texts went. While `view.save` is `saved` or `pending` nothing about
  saving shows or is said: no `#save-status` exists, the top-right island holds Elements alone and
  the bottom-right island the view readout and Keyboard shortcuts, and no saving message reaches
  either live region.
- The shell's root, `ShellRoot` in `shell/EditorShell.tsx`, carries `data-save-state`,
  `view.save?.type ?? 'none'`, for the tests alone; no style sheet under `apps/web/src` selects it
  and no production code reads it (`scripts/tests/saving-styles.test.ts`). It reads `view.save`
  through `useViewValue`, which moved from S6's selection hooks to `editor/surface.ts` rather than
  being copied [Inferred], so that a camera step renders neither the root nor the shell, and a new
  status renders the root without the islands it is given.
- `StorageProblemChip` in `ui/Saving.tsx`, its pure rules in `ui/save-problem.ts`, keeps the id
  `save-status` and P0's "Not saved", in the top-right island before Elements after an
  `aria-hidden` hairline, in `caption` type with a 6 px radius: the error tone and `status-problem`
  for a failed save, the warning tone and `status-tabs` for a stale one, and the warning tone and
  `status-problem` without storage. It is a `<p>` while its notices show and a
  `<button aria-expanded="false" aria-controls="notices">` once they are hidden, which shows
  `chevron-down` outside phone landscape [Inferred]. A hidden unreadable-data notice alone gives the
  same element reading "Storage notice" in the warning tone with `status-problem` [Inferred], and a
  save problem with it says "Not saved" [Inferred]. Its glyphs are `aria-hidden`, so its name is its
  words in every form.
- `StorageNotices` keeps the region "Storage notices", now with the id `notices`, P0's words byte
  for byte and no `role=alert`, the failed notice in the error tone and the stale and start-up
  notices in the warning tone, at e2 with an 8 px radius in `body-sm`, from the tokens alone; the
  hard-coded `#b3261e` went. One Hide control serves the region, since the shell's state holds one
  flag: its visible word is "Hide", its name "Hide storage notices", and it is the region's last
  control, after the stale answers [Inferred]. Hidden, the section stays in the page with `hidden`,
  so that `aria-controls` resolves [Inferred]. The stale answers take no accent: the plan names no
  primary action, and both drop data in different ways (the issue's autonomous default).
- The shell's reducer holds `noticesHidden` with `hide-notices` and `show-notices`, never stored,
  so that the notices show at every load. `reopensNotices` in `shell/shell-state.ts` shows them
  again on a failure after a status that was no failure or failed for another reason, or a stale
  save after one that was not stale, the engine's own condition for announcing a status, so that
  they come back exactly when the assertive region speaks and a same-reason retry keeps them hidden
  [Inferred]. `useNoticesControls` in `ui/use-notices.ts` applies it at every view the editor
  publishes. A reopening is a shell-state update from the editor's listener, so React may commit it
  just after the commit that renders the new status in the attribute, the chip and the notices'
  words.
- The focus (decision 14, [Inferred] moves): Hide gives the focus to the chip's button and the
  button gives it to Hide; a focused chip button or Hide that leaves the page gives it to the shown
  notices' Hide, or else to the canvas, never to the body, as when the problem clears or a new
  failure reopens the notices; the stale answers keep P0's move to the canvas. The tab order puts
  the notices' buttons, Hide last, or the chip's button once they are hidden, between the canvas,
  or the selection panel's actions, and Elements, and nothing while saving works.
- `useSaveRecovery` in `a11y/save-recovery.ts` says "The drawing is saved again." politely, once,
  after `failed` then `saved` with any `pending` between, and never otherwise. Its pure step keeps a
  failure through further failures, whatever their reason, and through `pending`, and forgets it at
  `stale`, at no storage and once it speaks, so that Keep, Load and a failure that turned stale say
  nothing [Inferred]. It follows every publish through `editor.subscribe`, not what React renders
  [Inferred], and `EditorSurface` gained the live region, which `main.tsx` passes and the test
  harness records [Inferred]. The engine's announcement keys and announcer are unchanged. The polite
  region still writes only the latest of messages within 100 ms, so a change's announcement and the
  sentence, should they coincide, replace one another; S7 leaves the region as it is.
- `styles/saving.css` was rewritten from the tokens alone, with no motion, blur or weight, and the
  media rules are in `responsive.css`. On phones the chip shows its glyph alone, at least 44 px wide,
  its words visually hidden and never `display: none`, and no chevron; the chip's button and Hide are
  at least 44 by 44 px on phones and under a coarse pointer, S7's own controls only. The plan gives
  the glyph-only form in landscape; in portrait at 360 to 390 px the worded chip made the top row
  444 px wide and the glyph alone 393 px, so in portrait the chip is its glyph alone too, and
  Elements beside it shows its glyph and count with its word visually hidden and its name kept, as
  the plan's compact rule has it, which brings the row to the window's width. The layout tests at
  390 × 844 and 360 × 560 failed with the plan's form, every island outside the window, and pass
  with this one.
- Tests: `Saving.test.tsx` rewritten and `Saving-hide.test.tsx`, `save-recovery.test.tsx`,
  `saving-renders.test.tsx` (no render of the shell, its root, the chip or the notices across ten
  camera steps under `saved` and `failed`), the state tests and EditorShell's; end to end,
  `saving.spec.ts`, `saving-focus.spec.ts` and `saving-layout.spec.ts`, with the layout checks moved
  to `tests/e2e/layout.ts`. The ADR's S7 migrations and those the audit found were made:
  `e2e/storage.ts`'s `saveState` and `expectSaved`, whose callers in `persistence.spec.ts`,
  `focus.spec.ts`, `empty-canvas.spec.ts` and `selection-bar.spec.ts` did not change; B9 in
  `perf/autosave.spec.ts`; Hide in the Tab orders of `focus.spec.ts` A5, `shell-layout.spec.ts` M1,
  `elements-sheet.spec.ts` D5 M1 and `selection-panel-actions.spec.ts` D2 A5; hidden notices left
  out of the layout checks; the chip's
  absence and each notice's own words in `persistence.spec.ts`, since the region holds Hide too; the
  first state test's initial state; and EditorShell's A7, which expected `#save-status` at the
  bottom right. No test was deleted. The 27 mutants of the issue's 18 kinds, the variants included,
  each failed at least one new test.
- B9's measurement point moved from P0's words to `data-save-state="saved"`. At `db57f31`, where
  both existed, a page observer found the attribute's change and the words' change in the same
  callback in each of B9's 8 rounds, in two runs, 0 ms apart, and no long task in any window,
  whether it ended at the attribute, at the words, or where the test saw either. The inference that
  React writes the attribute in the same commit as P0's words, so that B9's window keeps its
  meaning, therefore held there.
- Performance, on the developer machine, a 6-core virtual machine without a GPU under a load average
  of 1.4 to 4.3 from other work: `npm run build`, `perf:browser` and `perf:report` on the head
  (`eb886ef`, whose application code is `6155b71`'s) and on `main` (`37b8bf5`) in a scratch
  worktree, in the order head, main, main, head. B9 found no long task in any of its 8 rounds and a
  longest task of 0 ms in all four runs, measured to `data-save-state="saved"` on the head and to
  P0's words on `main`, and B4 one frame in each, both with a selection. B1 was 74.45 and 43.86 ms
  against 26.41 and 30.03 ms on `main`, over its budget on both, its misses remaining #49's; B2 was
  10.61 and 12.05 ms against 8.21 and 21.06 ms, B3 0.32 and 0.42 ms against 0.20 and 0.10 ms, and
  B10 0.44 and 0.45 s against 0.41 and 0.35 s. The 95th percentiles of I1 were 65.2 and 71.6 ms
  against 52.1 and 106.9 ms, its medians 36.6 and 34.9 ms against 34.6 and 40.2 ms, and those of I2
  112.3 and 115.4 ms against 115.1 and 143.1 ms, its medians 54.2 and 56.8 ms against 54.5 and
  55.0 ms. Since B1 read higher on the head, and B1 times only the engine's scene-layer drawing,
  which S7 does not change, `frames.spec.ts` alone ran again, alternating: head 32.56 and 31.71 ms
  against `main`'s 27.11 and 27.52 ms, then `db57f31`, `main` and the head twice more at 27.48,
  26.35 and 26.21 ms and at 30.88, 37.7 and 31.62 ms, so the head's B1 moved with the machine's
  spread rather than consistently. `perf:report` exits 1 in this sequence only because B5 to B8 and
  B11 to B13 are not measured there.
- Cost: S7's modules (`ui/Saving.tsx`, `ui/save-problem.ts`, `ui/use-notices.ts` and
  `a11y/save-recovery.ts`), bundled and minified with React, the engine and the earlier slices'
  modules left out, are 4,987 bytes, 2,041 bytes gzip, against 2,028 and 905 bytes for `main`'s
  `ui/Saving.tsx` alone. The web app's initial JavaScript is 118,535 bytes gzip against `main`'s
  117,523, 1,012 bytes more, within B13's 200 KB; B11 (30.3 KB) and B12 (2.5 KB) are unchanged, and
  the style sheet grows from 4,220 to 4,323 bytes gzip, measured with the bundle-size guardrail's
  `gzipSize`; `responsive.css`, whose rules are inlined in the JavaScript, is counted there.
- S8 to S13 are not implemented.

## What S8 delivered

Issue #73 delivered slice S8. Each choice that the plan or the ADR did not make is marked
[Inferred], as in the issue; each of the issue's was kept unless this section says otherwise.

- **One switch.** The shell renders the tool bar as the dock where `SHEET_QUERY` matches, through
  `useSheet()`, and as the palette elsewhere; `SHEET_QUERY` is reused, and `responsive.css`'s dock
  block is under the same query, which `scripts/tests/media-queries.test.ts` checks, so the dock
  exists exactly where the sheets cover it and a window under 600 px wide and under 500 px high is
  landscape [Inferred]. The rules that put the tool bar in a row of its own under
  `(max-width: 599px)` stay as they were: the dock block, after them, overrides them in portrait, so
  that they hold only in such narrow, short windows, where the palette keeps its own row under
  identity and Elements, now one row of 44 px buttons at 568 × 320 [Inferred].
- **The dock.** The same `Toolbar`, still the toolbar "Tools" in `data-island="tools"` [Inferred],
  holds Selection, Rectangle, Ellipse, Line, Freehand and Text in the registry's order with their
  names, states, keys, descriptions and tooltips, then More, seven 44 px buttons spread over one row
  8 px plus the bottom inset above the window's bottom, with no hairline [Inferred; one row at
  360 × 560]. Its roving tab stop is kept by command, falling back to the first button when the
  composition lacks it [Inferred], and a button that leaves the page with the focus on it, Tool
  lock when the palette becomes the dock, More when it goes back, or More's item when its popover
  closes on a press outside, gives the focus to that stop, never to the body
  (`ui/focus-lost.ts`). The palette's data and button moved, unchanged, to `ui/tool-items.ts` and
  `ui/PaletteButton.tsx`, which More shares.
- **More.** `shell/more-tools.ts` holds the shell's constant, Hand and Diamond plus `tool.lock`, and
  reads the dock and More from `editor.commands` in the registry's order, leaving out what it
  lacks. `shell/MoreTools.tsx` renders More, named and tipped "More", with `aria-expanded`,
  `aria-controls="more-tools"`, no keys, and `aria-pressed`, true with the hand's or the diamond's
  glyph while that tool is active, never for tool lock [Inferred]. Its popover, `#more-tools`, a
  group labelled by More [Inferred] inside the tool bar, holds Hand, Diamond and Tool lock as the
  palette's buttons in one row [Inferred], above the dock, right-aligned with More, at e3 on the
  menus' layer, which the tools island takes through the `more-tools-open` class rather than
  `:has()`; its items are mounted only while it is open, its element staying, empty and hidden
  [Inferred]. A press, Enter or Space opens it on Hand [Inferred]; its items have one tab stop of
  their own, so they join the order after More only while it is open; the arrow keys, wrapping,
  Home and End move among them and never the dock's stop; other keys reach the keymap. An item
  runs its command through `editor.run` and closes More with the focus on it [Inferred], as Escape
  does, going no further [Inferred]. S3's tooltip shows an item's tip at once on keyboard focus, and
  the Escape that closes a tip does only that, so from the keyboard a second Escape closes More;
  the tests press both. It also closes when the focus leaves it, on a pointer press outside it
  [Inferred], when the drawer, the Details sheet, the menu or a dialog opens, in the shell's
  reducer, and when the window leaves the query, as the dock unmounts. A press on its padding keeps
  the focus and reaches the island, never the canvas. The shell's state holds `more`, closed at
  every load and never stored.
- **Top and bottom.** The portrait top row is `'identity . top-right'` alone; Elements keeps its
  word at rest [Inferred], it fits at 360 px, and S7's rule hides it beside the chip; the
  identity-gap fallback was not needed. History and zoom sit 8 px above the dock, and the
  bottom-right island is not shown in portrait [Inferred], Keyboard shortcuts staying in the menu;
  in landscape that island keeps Keyboard shortcuts alone. The Elements and Details sheets now span
  to the dock's row, over history, zoom and the dock, which stay inert as before.
- **Landscape.** The whole palette, 44 px with its hairlines, is one row in the top row at
  844 × 390 at rest and under the failed chip, beside which Elements' word is visually hidden, its
  name kept [Inferred]. One choice the issue did not foresee: S2's and S7's layout tests at
  844 × 140 keep every island inside the window, and with 54 px islands the rows needed 160 px,
  since the selection panel cannot shrink below its 26 px of padding and border. In phone
  landscape the rows are therefore 4 px apart instead of 8, the bottom row reaching one such gap
  above its row, and the panel's padding becomes its children's margins, which look the same and
  let it shrink to its border; the rows then need 136 px.
- **Readout, safe areas and targets.** The view readout is `display: none` on phones and stays
  mounted with its text. `index.html` declares `viewport-fit=cover`; `shell.css` reads the four
  insets once on `:root` into `--shell-safe-top`, `-right`, `-bottom` and `-left`, outside the
  tokens [Inferred], which every padding of the shell, the sheets' margins and inner bottom padding
  and the menu's and More's size limits add, while the canvas still fills the window; the tests set
  the properties, with test inputs of 47, 34 and 21 px [Inferred]. One block after the compact rules
  makes the islands' buttons, the menu's items, the drawer's Close, its keys' summary, the list's
  options and the Details sheet's Close at least 44 by 44 px on phones and under a coarse pointer;
  desktops and compact layouts keep 36 and 32 px with a fine pointer.
- **Render cost and style ownership.** The tool bar reads `view.tool` and `view.toolLock` through
  `useViewValue` [Inferred], so `dock-renders.test.tsx` counts no render of the palette, the dock,
  More or its open popover across ten camera steps, while the readout still renders at each. The
  dock's and More's rules without media queries are in `styles/dock.css` [Inferred], imported after
  `palette.css`; `responsive.css`, at 323 lines, holds every media query; no token, font, weight,
  glyph or command was added, and no rule uses `:has()` or `backdrop-filter`.
- **The menu at phone widths.** S4's delivered section says the phone's menu sheet is S8's, but
  neither ADR 0012, whose shell state and matrix list no menu sheet, nor this plan's S8 defines one.
  S8 keeps S4's menu as a popover at every width, with 44 px items on phones; a menu sheet needs a
  maintainer's decision and an issue of its own.
- **Tests.** New: `more-tools.test.ts`, `Dock.test.tsx`, `MoreTools.test.tsx`,
  `dock-renders.test.tsx`, the `more` state tests, `viewport-meta.test.ts`, `safe-areas.test.ts`,
  the dock's query in `media-queries.test.ts`, and end to end `dock.spec.ts`, `more.spec.ts`,
  `landscape.spec.ts`, `safe-areas.spec.ts`, `phone-layout.spec.ts`, the new targets cases and
  contrast with More open. Migrated: `targets-phone.spec.ts` (44 px, no minimum count, the header),
  `creation-phone.spec.ts` (Tool lock and Diamond through More, Diamond's state read on More, the
  header), `drawing.ts` (`moreButton`), `layout.ts` (islands with no area left out, a sheet and an
  inert island in either order, history and zoom measured against the dock or the bottom inset),
  `shell-layout.spec.ts`, `selection-bar.spec.ts`, `menu.spec.ts`, `contrast-motion.spec.ts`,
  `elements-sheet.spec.ts`'s comments, the targets reading's `summary`, and the first state test.
  `support.ts`'s `readout` did not change: its users read its text or read it at desktop
  viewports. The pointer points of the phone specs needed no change. No test was deleted. Each
  new test failed on the sources before its change, and each migrated test's old version failed on
  the new sources; each mutant of the issue's 27 kinds failed at least one of them.
- **Known limitations,** as the issue lists them: the dock holds one row from 358 px wide; the
  landscape palette may wrap within its track at 667 × 375 or with large side insets; tool lock
  shows on the dock only in More's open popover; More exposes `aria-expanded` and `aria-pressed`;
  the dock is third in the tab order while it sits at the bottom; until S9 the dock and history stay
  during a phone text session; the hidden readout still renders per camera step; and `env()` on real
  devices is not exercised in CI.
- Performance, on the developer machine, a 6-core virtual machine without a GPU under a load average
  of 2.9 to 3.9 from other work: `npm run build`, `perf:browser` and `perf:report` on the head
  (`b4271c9`, whose application code the documents' commits leave as it is) and on `main`
  (`a6b96d0`) in a scratch worktree, in the order head, main, main, head. The perf specs run at
  desktop viewports, so they measure S8's tool-bar subscription and B10's tree, not the dock. B1 was
  59.31 and 31.98 ms against 41.78 and 43.30 ms on `main`, over its budget on both, its misses
  remaining #49's; B2 was 12.71 and 8.87 ms against 22.03 and 8.61 ms, over its 4 ms on both; B3
  0.20 and 0.28 ms against 0.55 and 0.10 ms; B4 one frame in every run; B10 0.36 and 0.40 s against
  0.57 and 0.42 s. B9 found one task over 50 ms in one of its 8 rounds in the first head run, a miss
  that the report records, and none in the second head run or on `main`; S8 changes nothing on
  saving's path, and the budgets stay report-only. The 95th percentiles of I1 were 66.2 and 50.8 ms
  against 102.8 and 59.8 ms, its medians 36.6 and 35.2 ms against 38.4 and 37.1 ms, and those of I2
  155.6 and 88.2 ms against 127.2 and 90.4 ms, its medians 56.6 and 55.2 ms against 62.9 and 55.5
  ms. `perf:report` exits 1 in this sequence only because B5 to B8 and B11 to B13 are not measured
  there.
- Cost: S8's modules (`ui/Toolbar.tsx`, `shell/MoreTools.tsx`, `shell/more-tools.ts`,
  `ui/tool-items.ts`, `ui/PaletteButton.tsx`, `ui/focus-lost.ts`, `shell/shell-state.ts` and
  `shell/sheet.ts`), bundled and minified with React, the engine and the earlier slices' modules
  left out, are 10,239 bytes, 4,096 bytes gzip, against 6,136 and 2,593 bytes for `main`'s
  `ui/Toolbar.tsx`, `shell/shell-state.ts` and `shell/sheet.ts`. The web app's initial JavaScript is
  119,904 bytes gzip against `main`'s 118,535, 1,369 bytes more, within B13's 200 KB, B11 (30.3 KB)
  and B12 (2.5 KB) are unchanged, and the style sheet grows from 4,323 to 4,480 bytes gzip, measured
  with the bundle-size guardrail's `gzipSize`; `responsive.css`, whose rules are inlined in the
  JavaScript, is counted there. The plan gave no estimate for S8.
- S9 to S13 are not implemented.
