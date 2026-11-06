# Feature inventory (guest mode)

Labels: see [methodology](methodology.md#evidence-labels). This inventory covers what the
baseline **discovered**. It is not proven exhaustive; the gaps are listed in the
[residual matrix](residual-matrix.md).

Sources:

- The desktop shell (§1) comes from REA page inspection of the initial page (`ev_e87d6771`,
  35 named controls, the same in s8–s10) and driver ARIA snapshots.
- Secondary surfaces and the mobile shell come from driver ARIA snapshots and screenshots (REA
  inspected only the initial mobile page, in s11): s1, the fresh-profile reruns s6 (desktop) and s7 (mobile), and the R-76 runs s10 (desktop
  dark, scenario 15) and s11 (mobile, scenarios 09, 10 and 14).
- Confidence follows the [methodology rule](methodology.md#evidence-labels): **high** means the
  same surface was captured identically in at least two sessions, at least one from a fresh
  profile; **medium** means once. A desktop and a mobile capture are different surfaces, each
  captured once.

## 1. Desktop shell (1280×720) [O, high]

| Area         | Controls (accessible name → shortcut shown in its description)                                                                                                                                                                                                                                                              |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Top left     | Main menu button. **It has no accessible name.**                                                                                                                                                                                                                                                                            |
| Top centre   | Region "Shapes" (heading level 2): Keep selected tool active (Q), Hand (H), Selection (V or 1, pressed by default), Rectangle (R or 2), Diamond (D or 3), Ellipse (O or 4), Arrow (A or 5), Line (L or 6), Draw (P or 7), Text (T or 8), Sticky note (N), Eraser (E or 0), More tools. Tool buttons expose `pressed` state. |
| Under bar    | A contextual hint line that changes with the tool and selection (see B-03).                                                                                                                                                                                                                                                 |
| Top right    | "Try Excalidraw+ 14-day free trial" link, Live collaboration button, Library button.                                                                                                                                                                                                                                        |
| Bottom left  | Region "Canvas actions": Zoom out, Reset zoom (shows the percentage), Zoom in, Undo, Redo. Undo and Redo start `disabled`.                                                                                                                                                                                                  |
| Bottom right | Link to a blog post on end-to-end encryption (shield icon) and a Help button.                                                                                                                                                                                                                                               |
| Canvas       | Two stacked `<canvas>` elements (a "static" layer and an "interactive" layer), each sized to the viewport × DPR. The accessible text is "Drawing canvas".                                                                                                                                                                   |
| Welcome      | Shown on an empty canvas: logo heading, a three-line local-storage warning, and Open (Ctrl+O), Help (?), Live collaboration… and Sign up. It disappears once a tool is chosen or content exists. The initial capture `d01-initial-light` is byte-identical in s1, s5, s6 and s8–s10, across the build change of 2026-11-05. |

## 2. Secondary surfaces [O; s1 and s6; confidence in the note below the table]

| Surface              | How opened                           | Contents                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Main menu            | Top-left button                      | Menu items: Open (Ctrl+O), Save to…, Export image… (Ctrl+Shift+E), Live collaboration…, Command palette (Ctrl+/), Find on canvas (Ctrl+F), Help (?), Reset the canvas, Excalidraw+, GitHub, X, Discord, Sign up, Preferences. Inline below them: theme radios (Light, Dark, System; Light checked by default), language combobox (25 languages, English selected), and canvas background (5 swatches + custom picker).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| More tools           | "More tools" in the toolbar          | Insert image (9), Frame tool (F), Web Embed, Draw to shape (Shift+X), Laser pointer (K), Bucket fill (B), Lasso selection, then a generation group: Text to diagram (AI), Mermaid to Excalidraw, Wireframe to code (AI).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Help dialog          | `?` or the Help button               | Links (documentation, blog, issue tracker, video channel) and the keyboard-shortcut reference in three groups (Tools, View, Editor). See §5.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Command palette      | Ctrl+/ (also Ctrl+Shift+P)           | Search textbox plus grouped commands: App, Export, Editor, Tools, Elements, Links. It includes items not seen elsewhere: "Install … locally (PWA)", "Save to disk" (Ctrl+S), "Export to Excalidraw+", "Zoom to fit in viewport", "Zoom to selection", "Switch shape".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Share dialog         | Live collaboration button            | Before a session: an explanation, "Start session", and "Shareable link → Export to Link". In a session: an editable "Your name" textbox (pre-filled with a random two-word name), the read-only link, Copy link, a QR code image, two explanatory paragraphs, and "Stop session".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Canvas context menu  | Right-click on empty canvas          | Paste (Ctrl+V), Select all (Ctrl+A), Toggle grid (Ctrl+'), Snap to objects (Alt+S), Arrow binding (checked), Snap to midpoints (checked), Zen mode (Alt+Z), View mode (Alt+R), Canvas & Shape properties (Alt+/). **Items are plain buttons; there is no `menu` role.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Library sidebar      | Library button                       | A tablist with 4 tabs that have **no accessible names** (the second, the library, is selected), "Keep sidebar open", Close, an options button, an empty state, and a "Browse libraries" link to an external library site.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Export image dialog  | Ctrl+Shift+E or the menu             | Checkboxes Background (on), Dark mode (pre-checked when the app theme is dark), Embed scene; scale radios 1×/2×/3× (**unnamed**); buttons Export to PNG, Export to SVG, Copy PNG to clipboard. It opens on an empty canvas too.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Properties panel     | A drawing tool or a selection        | Left floating panel. For a rectangle: Stroke (5 swatches + custom), Background (transparent + 4 + custom), Fill (appears only when the background is not transparent: Hachure, Cross-hatch, Solid), Stroke width (3 **unnamed** radios), Stroke style (3), Sloppiness (3), Edges (2), Opacity slider 0–100, Layers (4 buttons), Actions (Duplicate, Delete, Add link; below the fold at 720 px, visible after scrolling the panel). For an arrow, Edges is replaced by Arrow type (3 **unnamed** radios) and Arrowheads (start and end buttons whose accessible names are the raw identifiers `arrowhead_start` and `arrowhead_end`), and Actions adds Edit arrow. For text: Font family (Hand-drawn, Normal, Code, and a font picker), Font size (4 **unnamed** radios), Text align (3 **unnamed** radios), Opacity, Layers, Actions. For freedraw: Stroke, Background, Fill, Stroke width, Pressure (2 unnamed radios), Opacity. Per-type sections, dark: the text section [O, high], identical in s6 and s10; the rectangle and arrow sections [O, medium], whose s10 snapshots differ from s6 in the Fill group and the checked Sloppiness radio, following the styles in use. Freedraw: [O, medium]. |
| Element context menu | Right-click on a shape               | Buttons in groups, without a `menu` role: Cut, Copy, Paste / Wrap selection in frame / Copy to clipboard as PNG (Shift+Alt+C), as SVG / Copy styles (Ctrl+Alt+C), Paste styles (Ctrl+Alt+V) / Add to library / Send backward, Bring forward, Send to back, Bring to front / Flip horizontal (Shift+H), Flip vertical (Shift+V) / Add link (Ctrl+K), Copy link to object / Duplicate (Ctrl+D), Lock (Ctrl+Shift+L) / Delete. [O, medium], dark in s6 and s10: the entries are identical, the whole snapshots are not (B-34).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Preferences submenu  | Main menu → Preferences              | "Select on" radios Wrap (checked) and Overlap; input radios Trackpad (checked) and Mouse; menu items Tool lock (Q), Snap to objects (Alt+S), Toggle grid (Ctrl+'), Zen mode (Alt+Z), View mode (Alt+R), Canvas & Shape properties (Alt+/), Arrow binding, Snap to midpoints. [O, high] for each surface: desktop dark, identical in s6 and s10, and mobile dark, identical in s7 and s11, where the items show no shortcut text. Choosing the radios was not tested [U].                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Clear canvas dialog  | Main menu → Reset the canvas         | Heading "Clear canvas", Close, Cancel, Confirm. Escape dismissed it without clearing. [O, high], mobile dark in s7 and s11: identical snapshots and byte-identical captures.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Native file pickers  | Open, Save to…, Ctrl+S, Insert image | No in-page UI and no Playwright chooser or download event appeared [O]. See B-32 and the limitations.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

**Confidence of §2.** Rows without their own label are [O, medium]: the s1 and s6 snapshots are
not identical, so the confidence rule in the [methodology](methodology.md) does not allow high,
and even that rating rests on a comparison of raw snapshots. The committed index keeps only ARIA line counts, and the light
snapshots differ in every pair: for example ui-01-main-menu has 97 lines in s1 and 89 in s6, and
`ui-08-export-image-dialog` 83 and 75. For this correction the retained raw snapshots of s1 and
s6 were compared outside Git. In `ui-01` to `ui-08` the only differences are the welcome-screen
block (8 lines) and the Undo button's disabled state, because s1 captured these surfaces on a
fresh page and s6 after drawing, plus a per-load query value in the library link. The dark main
menu, Help and Export snapshots are identical, s1's `dark-03-props-panel` matches s6's
`dark-03b-props-panel`, and the in-session share dialog differs only in the random guest name and
its initial. The rating of these rows rests on that raw comparison, which cannot be
re-checked from Git. The R-76 ratings in the rows above rest on raw comparisons too: the s6 and
s10 snapshots of scenario 15, and the s7 and s11 snapshots of scenarios 09, 10 and 14, were
compared outside Git. The committed index keeps their line counts and, for the captures that are
byte-identical, the shared digest.

## 3. Modes and toggles [O, high]

Zen mode (Alt+Z), view mode (Alt+R), grid (Ctrl+'), snap to objects (Alt+S), theme (Alt+Shift+D),
keep-tool-active (Q), arrow binding and snap to midpoints (context-menu checkboxes). Their
effects are in [behaviour](behavior-analysis.md#b-37-view-modes-and-toggles).

## 4. Element types created in this baseline [O, high]

`rectangle`, `ellipse`, `diamond`, `arrow`, `line`, `freedraw`, `text`, `stickynote` (with an
auto-created bound `text`), and `image` (by file drop). Frame, embed, laser, bucket fill, lasso,
draw-to-shape and the generation tools appear in the inventory but were **not exercised** [U],
except on mobile in s12 and s16: Mermaid to Excalidraw inserted its offered example as rectangles, a
diamond, arrows and labels (B-38), and Wireframe to code switched to a frame tool (B-39).

## 5. Keyboard shortcuts listed by the Help dialog [O, high as listed; behaviour verified only where noted]

- **Tools:** H, V/1, R/2, D/3, O/4, A/5, L/6, P/7, T/8, N, 9 (image), E/0, F (frame), K (laser), B (bucket fill), I or Shift+S or Shift+G (pick colour), Ctrl+Enter (edit line points), Enter (edit text / add label), Esc or Ctrl+Enter (finish text), A or L with repeated clicks (curved arrow or line), double-click or Enter (crop image), Q (keep tool), Ctrl while drawing (prevent arrow binding), Ctrl+K (link), Tab / Shift+Tab (toggle shape type).
- **View:** Ctrl+= / Ctrl+- / Ctrl+0 (zoom), Shift+1 (fit all), Shift+2 (zoom to selection; see the discrepancy below), PgUp/PgDn and Shift+PgUp/PgDn (page move), Alt+Z (zen), Alt+S (snap), Ctrl+' (grid), Alt+R (view mode), Alt+Shift+D (theme), Alt+/ (properties), Ctrl+F (find), Ctrl+/ or Ctrl+Shift+P (palette).
- **Editor:** Ctrl+Arrow (flowchart from element), Alt+Arrow (navigate flowchart), Space+drag or wheel-drag (pan), Ctrl+Delete (reset canvas), Delete, Ctrl+X/C/V, Ctrl+Shift+V (paste as plain text), Ctrl+A, Shift+click (add to selection), Ctrl+click (deep select), Ctrl+drag (deep box select without dragging), Shift+Alt+C (copy as PNG), Ctrl+Alt+C / Ctrl+Alt+V (copy/paste styles), Ctrl+Shift+[ and ] (send to back / bring to front), Ctrl+[ and ] (backward / forward), Ctrl+Shift+Arrow (align), Ctrl+D or Alt+drag (duplicate), Ctrl+Shift+L (lock), Ctrl+Z / Ctrl+Shift+Z (undo/redo), Ctrl+G / Ctrl+Shift+G (group/ungroup), W (wrap selection), Shift+H / Shift+V (flip), S / G (stroke / background picker), Shift+F (font picker), Ctrl+Shift+< and > (font size).

Verified by interaction in this baseline: tool letters R, O, D, A, L, P, T, N, E, H, V; Ctrl+A,
Delete, Ctrl+G, Ctrl+Shift+G, Ctrl+Z, Ctrl+Shift+Z, Ctrl+D, Ctrl+C, Ctrl+V, Ctrl+Shift+L,
Ctrl+=, Ctrl+-, Ctrl+0, Shift+1, Space+drag, Alt+Z, Alt+R, Ctrl+', Alt+S,
Alt+Shift+D, ?, Ctrl+/, Ctrl+Shift+E, and Enter (add label). Ctrl+Shift+Up was pressed, but
on two elements that were already aligned, so its effect is not verified (B-23). Every other
shortcut is [U].

**Discrepancy [O, medium]:** the Help dialog lists "Zoom to selection = Shift+2". The command
palette lists "Zoom to selection = Shift+3" and "Zoom to fit in viewport = Shift+2". Which is
effective was not tested [U].

## 6. Mobile shell (390×844 touch emulation) [O, high; sessions `s3-mobile`, `s7-mobile-fresh` and `s11-mobile-r76-14`]

s7, and s11 at the same points, asserted DPR 3, a 390×844 screen, 5 touch points, a coarse pointer and 1170×2532 canvas
backing stores at 5 points: after 09's load, and at the start and end of 10 and of 14. 10b's
single capture falls between the end of 10 and the start of 14, and 11's emulate step asserts its
own read-back. s3 ran at DPR 1 after its first
screenshot (see [limitations](limitations.md)). The layout facts below were identical in s3 and s7, and all 16 s11 snapshots match s7's.

- **Top bar:** main menu (left) and Library (right) only. There is no share button, no promotion
  link, no zoom controls and no visible Help button. The Library button opens a sidebar over most
  of the canvas with the desktop's four unnamed tabs and Close; empty, it shows a note and the
  off-site Browse libraries link, and with a selection a search box, Personal Library and an add
  tile, which adds the selection; an item's tile places a copy (s61, s64, s66, s67; B-48) [O, high:
  each replay identical]. Undo takes the placed copy back, and Redo restores it; after an add, Undo
  takes back the step before it (s68, s69; B-48) [O, high: both runs identical].
- **Layout by viewport:** the phone layout above holds at widths up to 580 px and heights up to
  450 px; from 600 px wide and 520 px high the desktop's layout shows, with the Shapes toolbar at
  the top, even on this touch client (s59, s62, s65; B-45) [O, high].
- **Bottom toolbar (8):** Hand, Selection, Draw, Eraser, Rectangle, Arrow, Text, More tools.
  Undo and Redo float above it on the right.
- **Main menu:** the same menu items as desktop. Save to... opens a dialog with three entries:
  Save to file under Save to disk, Export to Link under Shareable link, and an Export button under
  Excalidraw+ (s37, raw ARIA) [O, medium: one session]. Export to Link was used once, in s52: the
  dialog became a Shareable link dialog with the link in a textbox, a Copy link button and a note
  on end-to-end encryption (B-41) [O, medium: one session, by design]; Save to file and the
  Excalidraw+ entry were not used (R-46, R-62). Find on canvas opens a sidebar tab with a search
  box, a result count and a list of the matching texts (B-46); the Select language list changed
  the document language and, once its locale chunk arrived, the labels (B-47); Canvas background
  opens a hex box of that name (B-49) (s61, s64, s66, s70) [O, high: the French labels loaded in
  s61 and s70, not in s64, after a 403; Find and the background replayed identically].
- **More tools on mobile:** Insert image, Sticky note, Frame tool, Web Embed, Draw to shape,
  Laser pointer, Bucket fill, and the three generation entries. Unlike desktop, there is **no
  Lasso selection**. Mermaid to Excalidraw and Text to diagram open one dialog with a tab each;
  Wireframe to code opens no dialog (B-38, B-39; s12 and s16, high). After one prompt, the Text
  to diagram tab showed a chat with New Chat, Menu, Insert, View as Mermaid and Delete message
  buttons, a box for refining the diagram and a count of the requests left for the day (B-39;
  s49, raw ARIA) [O, medium: one session, by design].
- **Diamond, Ellipse and Line** appear in neither the mobile toolbar nor More tools. A tap on
  the Rectangle tool opens a choice of Rectangle, Diamond and Ellipse: the ARIA saved after that
  tap lists it in s3, s7, s11, s12, s16 and s22, so the earlier statement that the access path was
  unknown missed it. A tap on the Arrow tool opens a choice of Arrow and Line, and after Line was
  picked the toolbar button was named Line (s27, s32, s34, s36) [O, high; raw ARIA]. Line,
  Diamond and Ellipse were all drawn from them, and after Diamond was picked the Rectangle tool's
  button was named Diamond (B-01, B-40; s39, s43) [O, high; R-24]. The Draw tool offers a choice
  of Freedraw and Autoshape (s37, s53, s55, s57, raw ARIA) [O, high]; with Autoshape the tool is
  stored as `autoshape`, and a closed rough rectangle drawn with it became a rectangle (B-05).
- **With an element selected,** a compact bar above the toolbar shows "Stroke", "Background", a
  second "Stroke" (properties) and "Actions" buttons instead of the desktop side panel. The Actions
  popover holds Add link, Duplicate and Delete (s7 and s11, `m17-dark-actions`, identical snapshots)
  [O, high]. Add link opens a textbox named "Type or paste your link here" beside a Link to object
  button, and a linked element shows its link with Edit, Link to object and Remove buttons (B-42;
  s54, s56, raw ARIA) [O, high]. In s22–s36 the Stroke colour popover held 15 colours named with a
  shortcut letter, a shades row and a hex box, like the Background popover; the style popover Stroke
  width, Stroke style, Sloppiness and Edges groups of unnamed radios and an Opacity slider, with a
  Fill group first once a background is set; and the Actions popover Layers, then Align and Group
  selection for two elements and Distribute for three. A selected arrow's bar adds "Arrow type" and
  "Edit arrow" (B-21, B-40; raw ARIA) [O, high]. Once a colour with shades is picked, the shades row
  holds five buttons named Shade (s37, s41, s45). A text's bar holds Stroke, a second Stroke with
  only Opacity, Show font picker, Text align (Font size and Text align groups of unnamed radios)
  and, once selected, Actions; a selected freehand stroke's bar holds Stroke, Background, a second
  Stroke with Stroke width, Pressure and Opacity, and Actions; an elbow arrow's bar has no "Edit
  arrow" (B-21; s37, s40, s41, s44–s47, raw ARIA) [O, high: the pairs' snapshots are identical]. By
  their stored results the Font size radios are S, M, L and XL, the Text align radios left, centre
  and right, a stroke's Stroke width radios 0.5, 1 and 2 and its Pressure radios two stroke-option
  styles (B-05, B-06; s53, s55, s57) [O, high]. In Edit arrow the bar holds Stroke, a second Stroke
  and Actions (s54–s57, raw ARIA) [O, high]. The Draw tool's own bar, without Actions, saved in s37
  and again in s53, s55 and s57 (`m45-05-draw-choice`), is byte-identical in all four [O, high].
- **Dark dialogs (s7, s11):** Help, Export image, Command palette (its search box only), the
  pre-session Live collaboration dialog and Clear canvas open from the main menu as dialogs
  with a Close button. Preferences opens as a submenu with the same items as on desktop, shown
  without shortcut text. [O, high]: the s7 and s11 snapshots are identical, and the Help,
  Command palette and Clear canvas captures are byte-identical.

## 7. Theme coverage [O, high]

The theme was captured in light and dark on desktop: canvas, main menu, properties panel, help
and export dialogs in s1 and s6, plus the element context menu, the per-type panels and
Preferences in s6 and s10. On mobile, s7 and s11 captured the canvas, main menu, Help, Export, Command palette,
Live collaboration, Clear canvas, Preferences and Actions in dark theme. Dark mode is an app-level setting
stored separately (see B-37). The `<html>` element gets no class and keeps
`color-scheme: normal`.

## Inventory IDs

Every entry above has an ID. The [residual matrix](residual-matrix.md) has at least one row for
each, with its status, evidence, limitations and next observation; `documentation.test.mjs`
checks that every §1 and §2 table row is listed here and that every ID has a matrix row.

| ID   | Section | Entry                         |
| ---- | ------- | ----------------------------- |
| F-01 | §1      | Top left                      |
| F-02 | §1      | Top centre                    |
| F-03 | §1      | Under bar                     |
| F-04 | §1      | Top right                     |
| F-05 | §1      | Bottom left                   |
| F-06 | §1      | Bottom right                  |
| F-07 | §1      | Canvas                        |
| F-08 | §1      | Welcome                       |
| F-09 | §2      | Main menu                     |
| F-10 | §2      | More tools                    |
| F-11 | §2      | Help dialog                   |
| F-12 | §2      | Command palette               |
| F-13 | §2      | Share dialog                  |
| F-14 | §2      | Canvas context menu           |
| F-15 | §2      | Library sidebar               |
| F-16 | §2      | Export image dialog           |
| F-17 | §2      | Properties panel              |
| F-18 | §2      | Element context menu          |
| F-19 | §2      | Preferences submenu           |
| F-20 | §2      | Clear canvas dialog           |
| F-21 | §2      | Native file pickers           |
| F-22 | §3      | Modes and toggles             |
| F-23 | §4      | Element types                 |
| F-24 | §5      | Tool shortcuts                |
| F-25 | §5      | View shortcuts                |
| F-26 | §5      | Editor shortcuts              |
| F-27 | §5      | Zoom-to-selection discrepancy |
| F-28 | §6      | Mobile top bar                |
| F-29 | §6      | Mobile bottom toolbar         |
| F-30 | §6      | Mobile main menu              |
| F-31 | §6      | More tools on mobile          |
| F-32 | §6      | Diamond, Ellipse and Line     |
| F-33 | §6      | Mobile compact property bar   |
| F-34 | §6      | Mobile dark dialogs           |
| F-35 | §7      | Theme coverage                |
