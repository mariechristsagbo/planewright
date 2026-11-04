# Feature inventory (guest mode)

Labels: see [methodology](methodology.md#evidence-labels). This inventory covers what the
baseline **discovered**. It is not proven exhaustive; the gaps are listed in the
[residual matrix](residual-matrix.md). Unless marked otherwise, entries come from REA page
inspection (`ev_e87d6771…` accessibility tree) and driver ARIA snapshots in session
`s1-desktop`.

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
| Welcome      | Shown on an empty canvas: logo heading, a three-line local-storage warning, and Open (Ctrl+O), Help (?), Live collaboration… and Sign up. It disappears once a tool is chosen or content exists.                                                                                                                            |

## 2. Secondary surfaces [O, high unless noted]

| Surface             | How opened                           | Contents                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Main menu           | Top-left button                      | Menu items: Open (Ctrl+O), Save to…, Export image… (Ctrl+Shift+E), Live collaboration…, Command palette (Ctrl+/), Find on canvas (Ctrl+F), Help (?), Reset the canvas, Excalidraw+, GitHub, X, Discord, Sign up, Preferences. Inline below them: theme radios (Light, Dark, System; Light checked by default), language combobox (25 languages, English selected), and canvas background (5 swatches + custom picker).                                                                 |
| More tools          | "More tools" in the toolbar          | Insert image (9), Frame tool (F), Web Embed, Draw to shape (Shift+X), Laser pointer (K), Bucket fill (B), Lasso selection, then a generation group: Text to diagram (AI), Mermaid to Excalidraw, Wireframe to code (AI).                                                                                                                                                                                                                                                               |
| Help dialog         | `?` or the Help button               | Links (documentation, blog, issue tracker, video channel) and the keyboard-shortcut reference in three groups (Tools, View, Editor). See §5.                                                                                                                                                                                                                                                                                                                                           |
| Command palette     | Ctrl+/ (also Ctrl+Shift+P)           | Search textbox plus grouped commands: App, Export, Editor, Tools, Elements, Links. It includes items not seen elsewhere: "Install … locally (PWA)", "Save to disk" (Ctrl+S), "Export to Excalidraw+", "Zoom to fit in viewport", "Zoom to selection", "Switch shape".                                                                                                                                                                                                                  |
| Share dialog        | Live collaboration button            | Before a session: an explanation, "Start session", and "Shareable link → Export to Link". In a session: an editable "Your name" textbox (pre-filled with a random two-word name), the read-only link, Copy link, a QR code image, two explanatory paragraphs, and "Stop session".                                                                                                                                                                                                      |
| Canvas context menu | Right-click on empty canvas          | Paste (Ctrl+V), Select all (Ctrl+A), Toggle grid (Ctrl+'), Snap to objects (Alt+S), Arrow binding (checked), Snap to midpoints (checked), Zen mode (Alt+Z), View mode (Alt+R), Canvas & Shape properties (Alt+/). **Items are plain buttons; there is no `menu` role.**                                                                                                                                                                                                                |
| Library sidebar     | Library button                       | A tablist with 4 tabs that have **no accessible names** (the second, the library, is selected), "Keep sidebar open", Close, an options button, an empty state, and a "Browse libraries" link to an external library site.                                                                                                                                                                                                                                                              |
| Export image dialog | Ctrl+Shift+E or the menu             | Checkboxes Background (on), Dark mode, Embed scene; scale radios 1×/2×/3× (**unnamed**); buttons Export to PNG, Export to SVG, Copy PNG to clipboard. It opens on an empty canvas too.                                                                                                                                                                                                                                                                                                 |
| Properties panel    | A drawing tool or a selection        | Left floating panel. For a rectangle: Stroke (5 swatches + custom), Background (transparent + 4 + custom), Fill (appears only when the background is not transparent: Hachure, Cross-hatch, Solid), Stroke width (3 **unnamed** radios), Stroke style (3), Sloppiness (3), Edges (2), Opacity slider 0–100, Layers (4 buttons), Actions (below the fold at 720 px; contents not captured). For freedraw: Stroke, Background, Fill, Stroke width, Pressure (2 unnamed radios), Opacity. |
| Native file pickers | Open, Save to…, Ctrl+S, Insert image | No in-page UI and no Playwright chooser or download event appeared [O]. See N-06 and the limitations.                                                                                                                                                                                                                                                                                                                                                                                  |

## 3. Modes and toggles [O, high]

Zen mode (Alt+Z), view mode (Alt+R), grid (Ctrl+'), snap to objects (Alt+S), theme (Alt+Shift+D),
keep-tool-active (Q), arrow binding and snap to midpoints (context-menu checkboxes). Their
effects are in [behaviour](behavior-analysis.md#view-modes).

## 4. Element types created in this baseline [O, high]

`rectangle`, `ellipse`, `diamond`, `arrow`, `line`, `freedraw`, `text`, `stickynote` (with an
auto-created bound `text`), and `image` (by file drop). Frame, embed, laser, bucket fill, lasso,
draw-to-shape and the generation tools appear in the inventory but were **not exercised** [U].

## 5. Keyboard shortcuts listed by the Help dialog [O, high as listed; behaviour verified only where noted]

- **Tools:** H, V/1, R/2, D/3, O/4, A/5, L/6, P/7, T/8, N, 9 (image), E/0, F (frame), K (laser), B (bucket fill), I or Shift+S or Shift+G (pick colour), Ctrl+Enter (edit line points), Enter (edit text / add label), Esc or Ctrl+Enter (finish text), A or L with repeated clicks (curved arrow or line), double-click or Enter (crop image), Q (keep tool), Ctrl while drawing (prevent arrow binding), Ctrl+K (link), Tab / Shift+Tab (toggle shape type).
- **View:** Ctrl+= / Ctrl+- / Ctrl+0 (zoom), Shift+1 (fit all), Shift+2 (zoom to selection; see the discrepancy below), PgUp/PgDn and Shift+PgUp/PgDn (page move), Alt+Z (zen), Alt+S (snap), Ctrl+' (grid), Alt+R (view mode), Alt+Shift+D (theme), Alt+/ (properties), Ctrl+F (find), Ctrl+/ or Ctrl+Shift+P (palette).
- **Editor:** Ctrl+Arrow (flowchart from element), Alt+Arrow (navigate flowchart), Space+drag or wheel-drag (pan), Ctrl+Delete (reset canvas), Delete, Ctrl+X/C/V, Ctrl+Shift+V (paste as plain text), Ctrl+A, Shift+click (add to selection), Ctrl+click (deep select), Ctrl+drag (deep box select without dragging), Shift+Alt+C (copy as PNG), Ctrl+Alt+C / Ctrl+Alt+V (copy/paste styles), Ctrl+Shift+[ and ] (send to back / bring to front), Ctrl+[ and ] (backward / forward), Ctrl+Shift+Arrow (align), Ctrl+D or Alt+drag (duplicate), Ctrl+Shift+L (lock), Ctrl+Z / Ctrl+Shift+Z (undo/redo), Ctrl+G / Ctrl+Shift+G (group/ungroup), W (wrap selection), Shift+H / Shift+V (flip), S / G (stroke / background picker), Shift+F (font picker), Ctrl+Shift+< and > (font size).

Verified by interaction in this baseline: tool letters R, O, D, A, L, P, T, N, E, H, V; Ctrl+A,
Delete, Ctrl+G, Ctrl+Shift+G, Ctrl+Z, Ctrl+Shift+Z, Ctrl+D, Ctrl+C, Ctrl+V, Ctrl+Shift+L,
Ctrl+Shift+Up, Ctrl+=, Ctrl+-, Ctrl+0, Shift+1, Space+drag, Alt+Z, Alt+R, Ctrl+', Alt+S,
Alt+Shift+D, ?, Ctrl+/, Ctrl+Shift+E, and Enter (add label). Every other shortcut is [U].

**Discrepancy [O, medium]:** the Help dialog lists "Zoom to selection = Shift+2". The command
palette lists "Zoom to selection = Shift+3" and "Zoom to fit in viewport = Shift+2". Which is
effective was not tested [U].

## 6. Mobile shell (390×844 touch emulation) [O, high; session `s3-mobile`]

DPR 3 was verified only for scenario 09 (initial load). Scenario 10 re-applied the emulation;
after that, `devicePixelRatio` read 1 (see [limitations](limitations.md)). The layout facts
below do not depend on DPR.

- **Top bar:** main menu (left) and Library (right) only. There is no share button, no promotion
  link, no zoom controls and no visible Help button.
- **Bottom toolbar (8):** Hand, Selection, Draw, Eraser, Rectangle, Arrow, Text, More tools.
  Undo and Redo float above it on the right.
- **Main menu:** the same menu items as desktop.
- **More tools on mobile:** Insert image, Sticky note, Frame tool, Web Embed, Draw to shape,
  Laser pointer, Bucket fill, and the three generation entries. Unlike desktop, there is **no
  Lasso selection**.
- **Diamond, Ellipse and Line** appear in neither the mobile toolbar nor More tools. How a
  mobile user reaches them is [U].
- **With an element selected,** a compact bar above the toolbar shows "Stroke", "Background",
  a second "Stroke" (properties) and "Actions" buttons instead of the desktop side panel.

## 7. Theme coverage [O, high]

The theme was captured in light and dark on desktop (canvas, main menu, properties panel, help
and export dialogs) and on mobile (canvas and main menu). Dark mode is an app-level setting
stored separately (see S-03). The `<html>` element gets no class and keeps
`color-scheme: normal`.
