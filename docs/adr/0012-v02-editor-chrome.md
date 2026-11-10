# ADR 0012: v0.2 editor chrome: tokens, type, icons, motion and saving

- Status: Proposed
- Date: 2026-11-10

## Context

P0 (milestone v0.1.0) ends with an engineering page around the canvas: a visible heading, a
pre-release sentence in a `role=status` element, the tool bar, a bordered canvas with the element
list under it, Undo, Redo, the zoom controls, the view readout, a save status that always reads
"Saved in this browser", "Saving…" or "Not saved", the storage notices, and a list of what is not
implemented ([overview](../architecture/overview.md#appsweb)). Milestone v0.2.0 (Editor Experience)
turns that page into an editor's chrome over the same engine: the canvas fills the window and the
controls float over it.

On 2026-11-10 the maintainer approved a design package for that chrome, its revision 2, with two
requested changes: Inter as the chrome's typeface, and no visible saved or saving status. Its
implementation handoff lists seven decisions, D1 to D7, as final and splits the work into slices
S0 to S13. The package (a prototype, a component lab, token files, icons, screenshots and a
verification report) stays outside the repository, and its prototype's script is a visual
reference, not production code to port. This record states in the repository's own words what the
package decided, so that every later slice cites one decision in Git rather than files outside it.
Where the package's prose disagrees with the handoff's list of approved decisions (its style guide
still gives 120–200 ms and 4 px of motion, and its colour section still calls D1 a proposal), the
approved decisions recorded here govern.

## Decision

### The surface

1. **Archetype.** The chrome serves a Command / Inspect surface first (pick a tool, act on the
   canvas, inspect and correct the result) and an Operate surface second (undo, zoom and recovery
   from a storage problem). At rest it covers less than 8 % of a 1440 × 900 viewport. Chrome appears
   with what needs it: the selection panel with a selection, notices with a problem, a tool's hint
   with that tool. Every control maps to an existing command, view field or editor method, and
   nothing the engine cannot do is shown.
2. **A layout grammar derived clean-room.** A full-bleed canvas with floating islands: identity and
   the menu at the top left, a centred tool palette (a bottom dock on phones), the Elements toggle
   alone at the top right, history and zoom at the bottom left, keyboard help at the bottom right,
   and a selection panel near the upper left only while something is selected. This spatial grammar
   comes from observing the reference editor's guest interface, in two screenshots that the
   maintainer supplied, as a user sees it. No source code, source map, package, component, style
   sheet, asset, font or icon of the reference was opened or used for it, and no slice may use one
   ([ADR 0003](0003-clean-room-reference-policy.md)). Planewright is not affiliated with the
   reference.
3. **Planewright's own identity.** The tokens, the icons, the mark and the new words are
   Planewright's:
   - colours, type scale, radii, spacing, elevation, layers and durations, as `--pw-*` custom
     properties, with one restrained accent, Construction Violet `#6547B4`, kept for state (the
     active tool, the selection, the focus ring and a notice's one primary action) and never for
     fills or decoration, text at 4.5:1 or more and glyphs, rings and control boundaries at 3:1 or
     more on their surfaces, and no success colour, since a working save shows nothing;
   - 35 original glyphs (34 interface glyphs and the mark) drawn from geometric primitives on a
     20 px grid with a 1.5 px stroke in `currentColor`, traced from nothing and taken from no icon
     set, under the repository's MIT licence once committed;
   - P0's own words kept verbatim for notices, element names and announcements
     (`apps/web/src/ui/notices.ts`, `apps/web/src/a11y/element-names.ts`,
     `apps/web/src/a11y/announcements.ts`), and new words, such as tool hints, menu items and About
     this build, written for Planewright without copying any reference string.

### The stack

4. **React 19 and Vite stay.** The web app stays a React 19 single-page application built by Vite.
   No Next.js or other framework, router or server rendering is added. No slice changes the engine;
   only S11 changes `packages/render-canvas`, for the overlay's colour.
5. **Plain CSS with generated custom properties.** The chrome is styled with plain CSS: a
   `tokens.css` of custom properties generated once from the design's tokens (S1), and component
   style sheets each under the file-size guardrail's 400 lines, imported from `main.tsx`. Tailwind,
   PostCSS plugins, CSS-in-JS and CSS modules are not added unless a later issue shows a concrete
   need that plain CSS cannot meet; the token generator is neither a dependency nor a build step.

### The approved decisions

6. **D1, the selection overlay's colour.** The canvas's selection outlines, handle borders and
   marquee edge change from P0's `#2a62d0` to Construction Violet `#6547B4`, and the marquee's fill
   from `#2a62d01a` to `#6547B41A`, so that chrome and canvas state share one colour (6.74:1 on the
   white canvas). It lands in S11, in `packages/render-canvas/src/overlay-layer.ts`.
7. **D2, restrained motion.** Surfaces enter by opacity and a short translation in 140 to 220 ms:
   menus and popovers, the selection panel, notices and dialogs in 140 ms, settling 4 px; the
   Elements drawer in 180 ms, from 8 px to its side; sheets in 220 ms, from 16 px below. Hover and
   press feedback may fade colours in 90 ms. Under `prefers-reduced-motion: reduce` nothing
   animates. The camera never animates, with or without reduced motion. It lands in S12.
8. **D3, the chrome's typeface.** The chrome uses Inter at 400 and 500, declared as the family
   `Planewright UI` with `font-display: swap` behind a metric-matched local fallback,
   `Planewright UI Fallback` (Arial, Helvetica or Liberation Sans at `size-adjust: 106.8%`,
   `ascent-override: 90.7%`, `descent-override: 22.6%` and `line-gap-override: 0%`). It lands in S1.
   - The 400 face points at the canvas's existing `inter-latin-400-normal.woff2`, at the same URL,
     so the file is downloaded once. S1 adds a single file, `inter-latin-500-normal.woff2` from the
     Fontsource 5.3.0 release that ADR 0011 used (24,272 bytes, SHA-256
     `f3779f1efccc4bdcdf9c0a02ab95bf6bd092ed09c48c08cedc725889edd1d19f`), copied beside
     `Inter-OFL.txt`, which already covers it. No package is added.
   - 500 is the only emphasis weight: no 600, 700 or synthesised bold, and no third chrome family.
   - JetBrains Mono, the existing `Planewright Mono`, appears in the chrome only for keys (key
     chips, the tool buttons' corner letters and the menu's shortcut column) and for element
     geometry (the selection readouts and the list's metadata). Changing numbers, such as the zoom
     readout, the view readout and the Elements count, use Inter's tabular figures.
   - This **amends [ADR 0011](0011-bundled-open-licence-fonts.md)** by adding the chrome family.
     ADR 0011's three faces with `font-display: block`, `loadFonts()`, the text measurer, the
     renderer's font mapping and canvas text (Inter 400 at 20 px with a line height of 1.25) do not
     change. `loadFonts()` does not await the chrome's faces, and the text area keeps
     `Planewright Sans` at 400.
9. **D4, the drawer's state is not persisted.** The Elements drawer is closed at every load. Its
   open state lives in the shell's own state and is never stored, and the preferences entry keeps
   the theme alone. It lands in S5.
10. **D5, the pre-release placement.** A persistent Pre-release tag in the identity island opens an
    About this build dialog, which holds P0's pre-release sentence, what is not implemented and the
    independence note, and the empty-canvas note repeats the sentence. P0's `role=status` pill goes.
    The tag and the dialog land with the shell in S2, which removes the line that held the sentence,
    and S4 adds the menu's way to About.
11. **D6, the phone caret stays out of scope.** Keeping the caret above a phone's on-screen keyboard
    needs a new engine camera behaviour, so no v0.2 slice does it. S9 only puts a Done bar above the
    keyboard, placed with `visualViewport`.
12. **D7, saving shows only when it needs attention.** While saving works (`view.save` is `saved` or
    `pending`), the chrome shows nothing about it: no "Saving…", "Saved" or "Saved in this browser",
    no icon, dot, spinner or toast, no last-saved time, and no announcement. It lands in S7.
    - A "Not saved" chip, which keeps the id `save-status`, and P0's notices, with their exact words
      and no `role=alert`, appear only for a failed save (error tone), a stale save from another tab
      (warning tone, with P0's two answers) and storage unavailable at start-up (`view.save` is
      null; warning tone). The start-up notice about unreadable stored data stays; once it is
      hidden, a "Storage notice" button reopens it.
    - Notices can be hidden into the chip, which then becomes a button that reopens them. A new
      failure, a stale save or a changed failure reason shows them again.
    - A failed save that succeeds again is said once in the polite live region, "The drawing is
      saved again.", by the web app rather than an engine announcement. Routine saves are never
      announced.
    - For tests only, the shell's root carries `data-save-state` (`saved`, `pending`, `failed`,
      `stale` or `none`), which is never styled.

    REQ-P05, REQ-P06 and REQ-P07 stay met by the chip and the notices. No requirement asks for a
    visible saved state.

### How the work is split and kept safe

13. **Ownership, and the canvas kept apart from the chrome.** The engine stays the source of truth.
    The chrome reads the editor's view and `editor.commands` and acts only through the editor's
    existing methods (`run`, `select`, `editText`, `saveNow` and `resolveStale`), while the canvas
    host keeps `input` and `resize`. The command registry stays the single source of tool and
    command labels, shortcuts and order (REQ-C14). An `EditorShell` replaces `App` and owns the
    islands under `apps/web/src/shell/`, while the canvas host, the text area, the element list's
    behaviour, the live regions and the notices' words keep their modules. The shell's own state
    (the open menu, More popover, drawer, dialog, hidden notices and Details sheet) stays in the
    shell, never in the engine, the history, the document or storage. Chrome is a sibling of the
    drawing canvas, never inside it, so no press on chrome reaches the canvas (REQ-C11). The canvas
    host fills the viewport and keeps its 1 px border, made transparent, the page never scrolls, and
    chrome adds no work to a frame.
14. **Invariants.** Every slice keeps:
    - accessibility: every control named and every toggle exposing its state as a state (REQ-Y01),
      one tab stop for the palette with arrow keys, `menu` and `menuitem` roles for menus (REQ-Y03),
      Escape returning the focus to the opener (REQ-Y02), a focus ring of at least 2 px and 3:1 on
      every focusable element, text at 4.5:1 or more, and P0's live regions, words, element names
      and list keys (REQ-Y04, REQ-Y05);
    - the tab order on a desktop at rest: the menu, Pre-release, the palette's one stop, the canvas,
      the selection panel's actions when it shows, Elements (then the drawer's Close, its keys
      summary and the list while it is open), Undo, Redo, Zoom out, Reset zoom, Zoom in, Zoom to fit
      and Keyboard shortcuts; while storage needs attention the notices' buttons, and then the
      chip's button once they are hidden, come before Elements, and there is no persistence stop
      while saving works;
    - responsive layouts: desktop from 1200 px wide, compact from 600 to 1199 px wide, phone
      portrait under 600 px wide and phone landscape under 500 px high, its rules after the compact
      ones, anchors offset by `env(safe-area-inset-*)`, islands that never overlap, and targets of
      at least 44 × 44 px on phones and under `pointer: coarse`, with P0's 24 px minimum (REQ-Y06)
      everywhere else;
    - the light theme only, with `color-scheme: light`;
    - the performance budgets: the web app's initial JavaScript within B13's 200 KB (108.78 KB in
      `main`'s CI report at `1f8188f`, against an estimated 10 to 18 KB for the shell), B10's cached
      load, B9's save with no long task, and the frame budgets B1 to B3. No `backdrop-filter` is
      used, contextual chrome is memoised so that a pan step does not re-render it, and the element
      list is not mounted while the drawer is closed.
15. **Slices.** Each slice is one issue in milestone v0.2.0 with acceptance criteria, and one pull
    request, test-first, that passes `npm run validate` and `npm run test:e2e`. The slices change
    chrome over existing behaviour and add no engine behaviour, so they need no new behavioural
    investigation. Anything that would add behaviour (the handoff's do-not-implement list, or D6)
    needs its investigation and feature issue first, as AGENTS.md requires. The order and risks are
    the handoff's (see [Slices](#slices) below); which slices must land first is derived from their
    contents, the handoff adding only that S7 may land before S2. The
    [implementation and test plan](../architecture/editor-experience.md) details each slice's
    contents, first tests, validation and documents, and the token values.
16. **Test migrations.** The slice that changes a behaviour migrates the tests that assume it, in
    the same pull request, and no test is deleted to make a slice pass. The stable selectors are:
    - `page.locator('[data-save-state]')` for the save state: `expectSaved` waits for
      `data-save-state="saved"`, and `saveStatus` (`#save-status`) stays for the problem chip, which
      exists only while storage needs attention;
    - `getByRole('button', { name: /^Elements/ })` to open the drawer before using the list box,
      whose name and keys stay P0's;
    - the Pre-release tag, by its role and name, to open About this build before reading the
      pre-release sentence and the not-implemented region;
    - `/^Reset zoom/` for the zoom readout's button, whose name becomes "Reset zoom, 100%";
    - roles and accessible names everywhere else, never the prototype's class names.

    The tests found at `1f8188f` to assume P0's chrome are listed under
    [Test migrations](#test-migrations) below, each with the slice that changes what it assumes. A
    slice that finds another such test migrates it by the same rule and says so in its pull
    request.

17. **Visual regression.** S13 adds Playwright `toHaveScreenshot` baselines of the seeded scene
    (`apps/web/tests/e2e/scene-fixture.ts`) with `animations: 'disabled'`: the 30 states of
    [the matrix](#visual-regression-matrix) below, stored for Linux, the platform CI runs on, and
    reviewed in the pull request.
18. **S0 changes no behaviour.** This record, its plan and the documents that point to them are
    slice S0. It changes no production code, font, token, icon, layout or test behaviour; the page
    stays P0's until S1 to S13 land.

### Slices

| Slice | Contents                                                                   | Lands after | Risk          |
| ----- | -------------------------------------------------------------------------- | ----------- | ------------- |
| S0    | This record and its plan; no behaviour change                              | —           | —             |
| S1    | Tokens, base styles and the chrome font (D3), with no layout change        | S0          | Low           |
| S2    | The full-bleed shell and islands, the list in a closed drawer, About (D5)  | S1          | High          |
| S3    | Icons, the palette's glyphs, corner keys, groups and padlock, and tooltips | S2          | Medium        |
| S4    | The menu and the Keyboard shortcuts dialog, with About from the menu (D5)  | S2, S3      | Medium        |
| S5    | The Elements drawer and the phone sheet, closed at every load (D4)         | S2, S3      | Medium        |
| S6    | The selection panel, the phone selection bar and the Details sheet         | S2, S3      | Medium        |
| S7    | Saving visibility (D7)                                                     | S1          | Medium        |
| S8    | The phone composition: the dock, More, landscape and safe areas            | S3, S5, S6  | Medium        |
| S9    | Text-editing chrome: the hint chip and the phone Done bar, within D6       | S2, S8      | Medium        |
| S10   | The canvas focus ring, the canvas chip and the tool hint line              | S2, S3      | Low           |
| S11   | The overlay's colour (D1)                                                  | S0          | Low to medium |
| S12   | Motion (D2)                                                                | S4 to S8    | Low           |
| S13   | The visual-regression baselines                                            | S1 to S12   | Low           |

### Test migrations

Paths are under `apps/web/tests` unless they start with `scripts/`, and lines are those of
`1f8188f`.

| Test                                                                                                                                                                | P0 assumption                                                                                                                                                                            | v0.2 change                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Slice  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `e2e/foundation.spec.ts:6–22`, "states what the build draws…"                                                                                                       | A visible h1, the `role=status` sentence, the "Not implemented yet" region                                                                                                               | The h1 is visually hidden; open About through the Pre-release tag, then assert the sentence and the regions there                                                                                                                                                                                                                                                                                                                                                                      | S2     |
| `unit/App.test.tsx:5` and `:12`, `unit/TextEditor.test.tsx:5` and `:27`                                                                                             | They render `App`                                                                                                                                                                        | Render `EditorShell`, which replaces it                                                                                                                                                                                                                                                                                                                                                                                                                                                | S2     |
| `unit/App.test.tsx:18`, `:24–38`, `:40–56` and `:93–99`                                                                                                             | `getByRole('status')` holds `BUILD_STATUS`, and the "Not implemented yet" and "What this build contains" regions, the protocol version and the independence note are on the page at load | Open About, then assert each of them in the dialog                                                                                                                                                                                                                                                                                                                                                                                                                                     | S2     |
| `unit/App.test.tsx:58–69` (`:62`) and `unit/TextEditor.test.tsx:121–137` (`:128`)                                                                                   | The list box is mounted at load                                                                                                                                                          | Open the drawer through the Elements button before reading or focusing the list box                                                                                                                                                                                                                                                                                                                                                                                                    | S2, S5 |
| `unit/App.test.tsx:71–91`, "puts the tab stops in the specified order…"                                                                                             | The tab stops inside P0's `.workspace` are the tool bar's, the canvas, the list box, Undo, Redo and the zoom buttons                                                                     | The stops of decision 14, found in the shell rather than under `.workspace`; the list only while the drawer is open                                                                                                                                                                                                                                                                                                                                                                    | S2–S5  |
| `e2e/foundation.spec.ts:24–48`, "…has a named tool bar…"                                                                                                            | The first Tab lands on Hand                                                                                                                                                              | The first Tab lands on the menu button, the second on Pre-release, then Hand; Hand's description and `aria-keyshortcuts` are unchanged                                                                                                                                                                                                                                                                                                                                                 | S2, S4 |
| `e2e/focus.spec.ts:12–37`, "Tab visits…"                                                                                                                            | Tools, canvas, list, Undo, …, then the "Source on GitHub" link                                                                                                                           | The tab order of decision 14; the list only while the drawer is open; the link in the menu and About                                                                                                                                                                                                                                                                                                                                                                                   | S2–S5  |
| `e2e/focus.spec.ts:56–57`, "Escape in the text area…"                                                                                                               | Tab from the text area lands on the element list                                                                                                                                         | It lands on the next control after the canvas: Elements when no selection panel shows                                                                                                                                                                                                                                                                                                                                                                                                  | S2     |
| `e2e/keyboard.spec.ts:29–30` and `:63–64`, "every P0 kind made…"                                                                                                    | The first Tab lands on Hand, and Tab from the canvas, with a text selected, lands on the element list                                                                                    | The tab order of decision 14: the menu and Pre-release come before the palette, and from the canvas Tab reaches the selection panel's actions, then Elements; the drawer is opened to reach the list                                                                                                                                                                                                                                                                                   | S2–S6  |
| `unit/Toolbar.test.tsx:21–40`, "is a toolbar named Tools…"                                                                                                          | Each button's text content is its label and its keys, from `'HandH'` and `'SelectionV or 1'` to `'Tool lockQ'` (`:28–36`)                                                                | Buttons show a glyph and an `aria-hidden` corner key: assert their accessible names in registry order, and the keys through `aria-keyshortcuts` and the description, as the tests from `:42` do                                                                                                                                                                                                                                                                                        | S3     |
| `unit/ZoomControls.test.tsx:20–38`, "are four named buttons in a Zoom group…"                                                                                       | The buttons' text content is their names, 'Zoom out', 'Reset zoom', 'Zoom in' and 'Zoom to fit' (`:22–26`)                                                                               | Zoom out, Zoom in and Zoom to fit show glyphs, and Reset zoom shows the zoom, such as "100%": assert the buttons' accessible names instead, with `/^Reset zoom/`                                                                                                                                                                                                                                                                                                                       | S2, S3 |
| `unit/ElementList.test.tsx:31–38` (`names`, `active`), `e2e/focus.spec.ts:59` and `:117`, `e2e/keyboard.spec.ts:52–59`, `e2e/targets-phone.spec.ts:34–37` and `:59` | An option's text content is its accessible name                                                                                                                                          | Each row shows a kind glyph, a label and mono metadata and keeps P0's name: assert the options' accessible names (`toHaveAccessibleName`), not their text                                                                                                                                                                                                                                                                                                                              | S5     |
| `e2e/keyboard.spec.ts:20–23` (`placeOf`)                                                                                                                            | It reads an option's place from its text content, "…, at x, y"                                                                                                                           | Read it from the option's accessible name, which keeps P0's words                                                                                                                                                                                                                                                                                                                                                                                                                      | S5     |
| `e2e/storage.ts:52` (`saveStatus`) and `:62–63` (`expectSaved`)                                                                                                     | `#save-status` always exists and reads "Saved in this browser"                                                                                                                           | Add `saveState`; `expectSaved` waits for `data-save-state="saved"`; `saveStatus` stays for the chip                                                                                                                                                                                                                                                                                                                                                                                    | S7     |
| `e2e/persistence.spec.ts` (10 `expectSaved`, 2 `saveStatus`), `e2e/focus.spec.ts` (4 `expectSaved`)                                                                 | The save text is always present                                                                                                                                                          | No caller changes; both "Not saved" checks (`persistence.spec.ts:100`, `:174`) keep passing; add a check that the chip is absent                                                                                                                                                                                                                                                                                                                                                       | S7     |
| `perf/autosave.spec.ts:50`, `:60` and `:82` (B9)                                                                                                                    | Waits until the page says "Saved in this browser"                                                                                                                                        | Waits for `data-save-state="saved"`; its `by:` text says so, and the pull request notes the moved measurement point                                                                                                                                                                                                                                                                                                                                                                    | S7     |
| `unit/Saving.test.tsx:39–45`, "the save status"                                                                                                                     | "Saved in this browser" for `saved` and "Saving…" for `pending`                                                                                                                          | No chip for `saved` and `pending`, "Not saved" for `failed`, `stale` and null, and a button for a hidden invalid-data notice                                                                                                                                                                                                                                                                                                                                                           | S7     |
| `e2e/selection.spec.ts:39`                                                                                                                                          | Clicks the h1 to blur                                                                                                                                                                    | Click a neutral point of the page, or press Escape                                                                                                                                                                                                                                                                                                                                                                                                                                     | S2     |
| `e2e/contrast-motion.spec.ts:19`                                                                                                                                    | More than 40 visible texts                                                                                                                                                               | Every visible text at 4.5:1 or more, with no minimum count                                                                                                                                                                                                                                                                                                                                                                                                                             | S2     |
| `e2e/contrast-motion.spec.ts:20–22` and `:50`                                                                                                                       | The visible texts include 'Undo', 'Rectangle', 'Zoom in' and 'Elements' (`:21`), and 'Undo' and 'Redo' (`:50`)                                                                           | Undo, Redo, Zoom in and the tools show glyphs, not words: expect only texts that stay visible, such as 'Elements' on a desktop, and check the glyphs at 3:1 (decision 3)                                                                                                                                                                                                                                                                                                               | S3     |
| `e2e/contrast-motion.spec.ts:84`                                                                                                                                    | `document.getAnimations()` is empty                                                                                                                                                      | Empty at rest and always under reduced motion; without it, checked once the transitions end                                                                                                                                                                                                                                                                                                                                                                                            | S12    |
| `e2e/targets-phone.spec.ts:40–47` and `:49–60`                                                                                                                      | At least 20 targets of at least 24 px; the list below the canvas                                                                                                                         | Every phone target at least 44 px with no minimum count; open the sheet to reach the list                                                                                                                                                                                                                                                                                                                                                                                              | S2, S8 |
| `e2e/creation-phone.spec.ts:111–129`, "with tool lock the tool stays…"                                                                                              | At 412 × 915 it taps Tool lock (`:114–115`) and Diamond (`:116`, `:123`, `:128`) in the tool bar, through `toolButton` (`e2e/drawing.ts:125–126`)                                        | On phones both are in More: open More before tapping either, and read Diamond's pressed state on the More slot, which takes the active tool's glyph and state                                                                                                                                                                                                                                                                                                                          | S8     |
| `e2e/support.ts:12` (`readout`, `#view-readout`)                                                                                                                    | Always visible                                                                                                                                                                           | Hidden on phones; `toHaveText` still works, and a desktop viewport is used where visibility matters                                                                                                                                                                                                                                                                                                                                                                                    | S8     |
| `e2e/focus.spec.ts:23`, `e2e/contrast-motion.spec.ts:82`, `unit/ZoomControls.test.tsx`                                                                              | The exact name "Reset zoom"                                                                                                                                                              | `/^Reset zoom/`                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | S2     |
| `e2e/a11y.ts:13` (`elementList`) and its users in `contrast-motion`, `focus`, `keyboard` and `targets-phone`                                                        | The list is visible at load                                                                                                                                                              | Open the drawer through the Elements button first                                                                                                                                                                                                                                                                                                                                                                                                                                      | S2, S5 |
| `e2e/canvas-geometry.spec.ts:46–51` and `:68`, "a fractional canvas height"                                                                                         | P0's host is `60vh` tall, so at 1280 × 901 the scene canvas's height, 60 % of 901 px, is fractional, as the case expects                                                                 | A `100dvh` host leaves 899 px, a whole number, so `:68` fails: give the case a fractional height by other means, such as a height that the test sets on the host, and keep the check                                                                                                                                                                                                                                                                                                   | S2     |
| `perf/panning.spec.ts:75–107` (B2 and I1), `:109–120` (I2) and their comment at `:17–22`; I1's label and reference in `scripts/lib/perf-budgets.ts:114` and `:118`  | The element list is mounted at load and renders its 101 options again at each pan step; I2 waits for them (`:113`)                                                                       | The drawer is closed at load, so `:113` finds no option. I1 keeps its loop with the drawer closed: from S5, which unmounts the closed list, it shows the list's cost leaving a pan step against I1 on `main`, and its label stops saying that 101 options are listed. I2 opens the drawer through the Elements button and waits for the 101 options before panning, so it measures a pan step with the drawer open, whose options S5 memoises                                          | S2, S5 |
| Pointer tests near the canvas's edges, such as the drags from canvas (40, 40) in `e2e/creation-phone.spec.ts`                                                       | The canvas starts below the page's header and tool bar, and nothing covers it                                                                                                            | Chrome floats over the canvas, so audit every drag, tap and wheel point: on desktops the top 72 px across the width (identity, the palette and the top-right island), 72 px at the bottom corners (history and zoom at the left, the view readout and Keyboard shortcuts at the right), 260 px from the left edge and an open drawer's 300 px at the right; on phones the 60 px bands at the top and bottom, the selection bar under the top band, and history and zoom above the dock | S2, S8 |
| `e2e/scene-pixels.spec.ts:126`, "and again after frames that leave state behind…"                                                                                   | It wheels 20 px inside the scene canvas's bottom-right corner                                                                                                                            | On desktops that point is under the bottom-right island (the view readout and Keyboard shortcuts), so the wheel never reaches the canvas: wheel at a point that no island covers, such as the canvas's centre                                                                                                                                                                                                                                                                          | S2     |

### Visual-regression matrix

| Viewport                          | States                                                                                                                                                                                                                               |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1440 × 900                        | Rest (the top-right island holds only Elements), single selection, multi-selection, text selected, text editing, menu, shortcuts, About, drawer open, stale notice, failed notice, notices hidden (chip button), empty, canvas focus |
| 1024 × 768, touch                 | Rest, selection and drawer, start-up unavailable                                                                                                                                                                                     |
| 390 × 844, touch                  | Rest, selection bar, Details sheet, More open, Elements sheet, text editing with the Done bar, stale notice, empty                                                                                                                   |
| 844 × 390, touch                  | Rest, selection and drawer, tool lock, failed notice (icon-only chip)                                                                                                                                                                |
| 1440 × 900, `deviceScaleFactor` 2 | Rest, as a pixel-ratio check                                                                                                                                                                                                         |

That is 14 + 3 + 8 + 4 + 1 = 30 baselines.

## Alternatives considered

- **Tailwind CSS v4.** Rejected for now: two new dependencies and a Vite plugin in the build that
  the bundle guardrail measures, and class-heavy markup against the 60-line function limit, for
  nothing that plain custom properties cannot do.
- **Next.js.** Rejected: the editor is one client-side page, so a framework's routing and server
  rendering would bring nothing it needs and would replace the Vite build that the bundle guardrail
  and the end-to-end tests' preview server use.
- **IBM Plex Sans for the chrome**, the design's first proposal. Withdrawn by the maintainer: 46,840
  bytes in two files plus a licence file, against one 24,272-byte file for Inter 500, which shares
  its 400 file with the canvas.
- **A visible saved or saving status**, as P0 shows. Rejected by the maintainer (D7): a working save
  shows nothing, so the canvas stays quieter, and a polite message after every save would replace
  the change's own announcement in the atomic live region.
- **Keeping P0's blue overlay.** Rejected (D1): chrome state and canvas state would use two accents.
- **Restoring the drawer's open state.** Rejected (D4): closed at every load, the drawer keeps the
  canvas free and the list's re-rendering off every pan step until it is opened, and the
  preferences entry keeps holding the theme alone.

## Consequences

- The design package stays outside Git; this record and its plan are what reviews cite. Tokens,
  fonts, icons and layout reach the repository only through their slices.
- The pre-release facts move from an always-visible line into About this build, one step from every
  screen through the persistent tag.
- Tests stop reading "Saved in this browser" and read `data-save-state`, and B9 is measured to that
  attribute. That React writes it in the same commit as P0's text, so that B9's window keeps its
  meaning, is inferred and not yet measured; S7 shows it.
- `docs/architecture/engine/quality.md` and `rendering-and-hit-testing.md`, and the web app's
  descriptions in the overview and the status documents, describe P0's chrome until the slices that
  change it update them.
- Requirements served: REQ-C11, REQ-C14, REQ-P05 to REQ-P07 and REQ-Y01 to REQ-Y06.
