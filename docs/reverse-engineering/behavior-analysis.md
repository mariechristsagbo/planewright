# Behaviour analysis

Each entry gives: **Initial** state → **Action** → **Result**, then state effects, persistence
and undo, edge cases, desktop/mobile differences, evidence, and label/confidence. Geometry is in
scene units at zoom 1 with no scroll unless stated otherwise.

Evidence names refer to:

- probe labels in `evidence/probes-<session>.json`;
- screenshot or ARIA names in `evidence/sessions.json`;
- scenarios in `research/excalidraw/scenarios/`.

**Fresh-profile replay.** s6 (desktop) and s7 (mobile) replayed every scenario below from a fresh
profile. All 47 desktop probe labels that s6 shares with s1 or s2 gave identical geometry,
angles, groups, bindings, locks, style values, selection counts, tools, zoom, scroll and theme.
Confidence follows the [methodology](methodology.md#evidence-labels): **high** means identical in
at least two sessions, at least one of them from a fresh profile.

## Creation

### B-01 Create a shape by drag

- **Initial:** empty canvas, selection tool active, desktop.
- **Action:** press R, drag from (300,180) to (420,280).
- **Result:** a rectangle at x=300, y=180, 120×100. Dimensions equal the drag delta exactly, with
  no snapping at default settings. Ellipse (O), diamond (D) and line (L) behave the same; the line
  stores 2 points.
- **State:**
  - The new element is selected and the active tool returns to Selection.
  - Defaults: stroke `#1e1e1e`, background transparent, fill style `solid`, stroke width 2,
    stroke style solid, roughness 1, opacity 100.
  - Rounded corners are on by default. The stored roundness type is **3 for rectangles** (from
    creation, in every session) and **2 for ellipse, diamond, line, arrow and sticky note**.
    Freedraw, text and image have none.
- **Persistence:** written to `localStorage["excalidraw"]` (see B-30).
- **Mobile:** a one-finger touch drag with the rectangle tool gives an exact 140×100 rectangle
  (`m-rect-touch`, identical in s3 and in s7 at a verified DPR 3) [O, high].
- **Evidence:** `02-all-shapes` (s2, s6), `12-after-canvas-drag` (s6), scenarios 02, 10 and 12.
- **Label:** [O], high.

### B-02 Properties panel occupies the canvas while a tool is active

- **Initial:** a drawing tool chosen by keyboard.
- **Result:** the properties panel opens immediately on the left (x≈16–211 at 1280×720) and the
  welcome screen disappears.
- **Edge case:** a pointer drag that starts on the panel does not create a shape. In s6 (scenario
  12), a rectangle drag and a line drag starting at x=200 created nothing
  (`12-after-panel-drag`, `12-after-panel-line-drag`). The same rectangle drag starting at x=300
  created a 120×100 rectangle (`12-after-canvas-drag`). s1 had shown the same effect by accident.
- **Label:** [O], high.

### B-03 Contextual hint line

The line under the toolbar changes with context:

- empty canvas: how to pan;
- Draw tool: "Click and drag, release when you're finished";
- shape selected: "Enter to add text, Ctrl+↑↓ to create a flowchart";
- text selected: "Double-click or press Enter to edit text" (`dark-11-panel-text`, s6).

**Label:** [O], high.

### B-04 Arrow and binding

- **Action:** press A, drag from (425,230), 5 units right of a rectangle's edge, to (515,230), on
  the edge of an ellipse at x=520.
- **Result:**
  - The arrow ends at x=514, so its end snapped to the ellipse outline rather than the pointer.
  - `endBinding` is set, and the ellipse's `boundElements` gains `arrow`.
  - **Start binding:** a start 5 units from the rectangle's edge **was bound**
    (`02-all-shapes`, s2 and s6). In scenario 04, a start 15 units from a rectangle's edge was
    **not** bound (`04-arrow-bound`, s1 and s6).
- **Label:** [O], high, for end binding and for each start-binding case.
- **Inference [I], low:** at zoom 1, the start-binding distance limit lies somewhere between 5
  and 15 units. Not measured further.
- **Edge cases:**
  - Ctrl while drawing should prevent binding (Help) [U].
  - Moving the bound target was not exercised for a bound arrow end [U].
- **Evidence:** `04-arrow-bound`, `02-all-shapes`.

### B-05 Freedraw

- **Action:** press P and drag a 6-vertex polyline.
- **Result:** a `freedraw` element with 22 stored points from 6 input vertices, because the driver
  interpolates moves. The bounding box equals the extent of the input, and the default stroke
  width is 1, not 2.
- **Edge case:** a single click with the Draw tool creates a 0×0 freedraw element, a "dot"
  (`diag-after-eraser`, s1 and s6).
- **Label:** [O], high.

### B-06 Text

- **Action:** press T, click (820,420), type "Hello", press Escape.
- **Result:** a `text` element: font size 20, font family id 5, left aligned, height 25. It is
  anchored with its vertical centre at the click (y=407.5 for a 25-high line). The width depends
  on the glyphs (43.2 for 5 characters).
- **Label:** [O], high (s1, s2 and s6 identical).

### B-07 Container label

- **Action:** select a rectangle and press Enter, type "Box", press Escape.
- **Result:** a `text` element with a `containerId`, centred in the rectangle and horizontally
  centre-aligned. The rectangle's `boundElements` lists `text`.
- **Effect:** moving the rectangle moves its label by the same delta (`04-move-bound-rect`:
  +60 in y for both).
- **Label:** [O], high (s1 and s6).

### B-08 Sticky note

- **Action:** press N, click a point, type "Note", press Escape.
- **Result:**
  - A 250×250 `stickynote` **centred on the click point**, with background `#ffdf6b`.
  - A bound centred `text` holds the typed content.
  - A small date stamp ("4 Nov") is drawn in the note's bottom-right corner (screenshot
    `shape-02-all-tools`).
  - Typing goes straight into the note's label.
- **Label:** [O], high (s2 and s6). Whether the date stamp is stored in the scene or only
  rendered is [U].

### B-09 Image by file drop

- **Action:** at scroll (90,45), drop a self-generated 64×48 PNG at viewport point (1000,200),
  which is scene point (910,155).
- **Result:** an `image` element of 64×48 (native size), **centred on the drop point**. Its
  top-left corner is (878,131) in scene units. It is selected.
- **Persistence:** the scene in `localStorage` grows only slightly, so the bytes are not inline.
  The `files-db` IndexedDB database exists [O]; that it holds the image bytes is [I] (medium).
- **Label:** [O], high for geometry (`06b-image-drop`, s1 and s6).
- **Not observed:** inserting through the "Insert image" picker produced no Playwright
  file-chooser event (N-06) [U].

## Selection

### B-10 Click selection

- **Click inside an unfilled (transparent) rectangle:** selects nothing.
- **Click on its stroke:** selects it.
- **Label:** [O], high (s1, s2 and s6). Hit-testing inside a filled shape was not tested [U].

### B-11 Add to selection

Shift+click a second element: both are selected (2). **Label:** [O], high.

### B-12 Box selection

Drag on empty canvas around two whole elements: 2 selected. Partial overlap was not tested [U].
**Label:** [O], high.

### B-13 Select all ignores locked elements

Ctrl+A with one locked ellipse selected the other three elements only. The clipboard then
contained rectangle, text and arrow (scenario 06, s1 and s6). **Label:** [O], high.

### B-14 Selection chrome

- **Desktop:** a rectangle 180×150 at zoom 1 shows a box padded about 4 px, 4 corner handles,
  and a round rotation handle 16 px above the top centre (`sel-02-rect-handles`, s1 and s6).
- **Mobile:** a 140×100 rectangle in the 390×844 touch emulation shows 8 handles (corners and
  edge midpoints) plus the rotation handle (`m04-rect-selected`). This was seen at DPR 1 in s3
  and at a verified DPR 3 in s7.
- **Label:** [O], high. Whether the handle count depends on element size or on input device is
  [U].

## Transform

### B-15 Move

Drag a grouped selection from (300,250) to (340,290): both elements move by exactly +40/+40, with
no snapping. **Label:** [O], high (s1, s2 and s6).

### B-16 Resize

Drag the south-east handle by (+60,+50): width 120→180 and height 100→150. The top-left corner
stays fixed and the aspect ratio is free. Shift (aspect lock) and Alt (resize from centre) were
not tested [U]. **Label:** [O], high (s1, s2 and s6).

### B-17 Rotate

- **Action:** drag the rotation handle (430,220) through 90° around the centre (430,315) to
  (530,315).
- **Result:** angle = 1.6 in the probe, which rounds to one decimal. That is consistent with
  π/2 ≈ 1.571; the exact stored value was not captured. The size is unchanged, and undo restores 0.
- **Edge cases:** Shift snapping was not tested [U]. A miss of the handle deselects instead
  (`rotate-handle`).
- **Label:** [O], high (s1, s2 and s6).

### B-18 Duplicate

Ctrl+D with 2 selected: copies at +10/+10, and the **copies** become the selection. Undo removes
them. **Label:** [O], high.

### B-19 Lock

- **Action:** Ctrl+Shift+L on the selected ellipse.
- **Result:** `locked: true` and the selection is cleared. A later click on the ellipse does not
  select it, and a drag starting on it does not move it.
- **Label:** [O], high (s1 and s6). Unlocking was not exercised [U].

## Style

### B-20 Style changes apply to the selection and become defaults

- **Action:** with a rectangle selected, set stroke red (`#e03131`), background light red
  (`#ffc9c9`), then sloppiness "architect".
- **Result:** the rectangle updates (roughness 0). Elements created afterwards (an arrow and a
  container label) inherit stroke `#e03131`, background `#ffc9c9` and roughness 0
  (`04-arrow-bound`).
- **Label:** [O], high (s1 and s6).

### B-21 Panel layout is dynamic

- **Fill row:** choosing a non-transparent background inserts a Fill row, which shifts every row
  below it down. Coordinate clicks intended for stroke width, stroke style, edges and layers
  therefore landed elsewhere. The results of those clicks are **not** used as findings.
- **Roundness:** the rectangle's roundness stayed 3 throughout. That was its value from creation
  (B-01), not an effect of these clicks.
- **Sections by element type** (s6 ARIA in dark theme, `dark-08`, `dark-10`, `dark-11`):
  - **rectangle:** stroke, background, fill, stroke width, stroke style, sloppiness, edges,
    opacity, layers, actions;
  - **arrow:** edges are replaced by "Arrow type" (3 options) and "Arrowheads" (start and end
    buttons), and "Edit arrow" joins the actions;
  - **text:** "Font family" (three presets plus a font picker), "Font size" (4 options) and
    "Text align" (3 options); there is no stroke width, stroke style, sloppiness or edges.
- **Scrolling:** at 1280×720 the panel is cut off at "Actions"; a wheel over the panel scrolls it
  (`dark-09-panel-rect-scrolled`).
- **Label:** [O], high for the Fill row insertion (s1 and s6); [O], medium for the per-type
  sections (s6 only).

## Grouping, layers, alignment

### B-22 Group and ungroup

- **Group:** Ctrl+G gives both elements one shared group id. A click on one member then moves the
  group as a unit (B-15).
- **Ungroup:** Ctrl+Shift+G clears the group ids; the selection stays at 2.
- **Undo:** restores positions but keeps the grouping step separate.
- **Label:** [O], high.

### B-23 Align top

Ctrl+Shift+Up with two elements already sharing a top edge: no change. This **does not** test the
alignment itself [U]. **Label:** [O], low value.

### B-24 Layer order

The four layer commands appear in the panel and in the element context menu (s6), but their
effect was not established, because the coordinate click missed after the panel reflow (B-21)
[U].

## History

### B-25 Undo and redo

- Ctrl+Z after a move restores the previous positions, and Ctrl+Shift+Z re-applies them (s1, s2
  and s6).
- Undo also reverses rotation, duplication, paste and dot creation.
- Undo and Redo buttons start disabled; Undo becomes enabled after the first change.
- **Label:** [O], high. Ctrl+Y and undo across a reload were not tested [U].

## Clipboard

### B-26 Copy and paste

- **Copy:** Ctrl+C writes JSON text to the system clipboard with top-level keys `type`
  (`"excalidraw/clipboard"`), `elements` and `files`.
- **Paste:** Ctrl+V with the pointer at a canvas point inserts copies **centred on the pointer**
  and selects them.
- **Undo:** removes the paste.
- **Label:** [O], high (s1 and s6; clipboard shape read through the permission-granted Clipboard
  API).

### B-27 Other clipboard formats

The element context menu offers "Copy to clipboard as PNG", "Copy to clipboard as SVG", "Copy
styles" and "Paste styles" (s6). Their effects, and pasting plain text, were not tested [U].

## Pan and zoom

The desktop rows are [O], high: identical in s1, s2 and s6, except fit-to-content, which depends
on the scene. The mobile rows are [O], high: identical in s3 and s7, except the note on the pinch
row.

| Input                                   | Effect                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wheel, dy=+200                          | scrollY −200 (1:1 at zoom 1)                                                                                                                                                                                                                                                                                                                                                 |
| Shift+wheel, dy=+200                    | scrollX −200 (horizontal pan)                                                                                                                                                                                                                                                                                                                                                |
| Ctrl+wheel, dy=−100 at (640,360)        | zoom 1 → 1.1; scroll adjusted so the pointer's scene point stays fixed                                                                                                                                                                                                                                                                                                       |
| Ctrl+0                                  | zoom 1, keeping the viewport centre                                                                                                                                                                                                                                                                                                                                          |
| Ctrl+= / Ctrl+- (×2)                    | zoom 1.1 / 0.9: steps of 0.1 around the viewport centre                                                                                                                                                                                                                                                                                                                      |
| Shift+1                                 | Zoom stayed **1.0** for the small test scenes (no zoom-in beyond 100% was observed). In s1 and s6 the horizontal scroll (90) matches centring the content's bounding box; the vertical scroll (45) does not match simple centring (15 expected), so the vertical placement rule is [U]. In s2 the result (90,100) differs because 05's leading undos reverted 03 steps there |
| Space + drag (−100,−50)                 | scroll changes by exactly the drag delta; the tool is unchanged                                                                                                                                                                                                                                                                                                              |
| Hand tool drag (+50,+50)                | scroll changes by exactly the drag delta                                                                                                                                                                                                                                                                                                                                     |
| Mobile pinch, fingers 90 → 190 px apart | zoom 2.1111 = 190/90: zoom follows the finger-distance ratio. The resulting scrollX differed by 3 scene units between s3 (−135, DPR 1) and s7 (−132, DPR 3), so the exact pinch anchor is [U]                                                                                                                                                                                |
| Mobile two-finger pan, 80 px up         | scrollY changes by −80/zoom (−38)                                                                                                                                                                                                                                                                                                                                            |

## View modes

All rows are [O], high (s1 and s6).

| Toggle        | Visible effect                                                                                    | Persisted in `excalidraw-state`?     |
| ------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Zen (Alt+Z)   | Hides the menu, share, library, undo/redo, zoom in/out and help; keeps the toolbar and zoom reset | yes (`zenModeEnabled`)               |
| View (Alt+R)  | Hides the toolbar and editing UI; keeps zoom, share, help and the promotion link                  | **no** key observed                  |
| Grid (Ctrl+') | Draws a grid (`view-03-grid`)                                                                     | yes (`gridModeEnabled`)              |
| Snap (Alt+S)  | Flag toggles                                                                                      | yes (`objectsSnapModeEnabled`)       |
| Theme         | Alt+Shift+D or the menu radio switches light/dark                                                 | yes (`theme` and `excalidraw-theme`) |

### B-28 System colour scheme

With the default settings, emulating `prefers-color-scheme: dark` did **not** switch the theme
(mobile, `m-dark-scheme-emulated`, s3 and s7); choosing Dark in the menu did. A "System" radio
exists; its behaviour was not exercised [U]. **Label:** [O], high.

### B-28a Export defaults follow the theme

In dark theme, the Export image dialog opens with "Dark mode" already checked (desktop
`dark-05-export` in s1 and s6; mobile `m12-dark-export` in s7). **Label:** [O], high.

## Eraser

### B-29 Eraser

- **Action:** press E and drag across a freedraw stroke.
- **Result:** the stroke is removed from the scene.
- **Edge case:** after Escape, the active tool was **freedraw**, the tool used before the eraser,
  rather than selection. Clicks then created dots (B-05). Seen in s1 and s6.
- **Label:** [O], high for the removal and for the tool after Escape; [I], medium for the reading
  "Escape returns to the previous tool".

## Persistence

### B-30 Local save and reload

- **Save:** after each change, the scene is written to `localStorage["excalidraw"]` as an array
  of elements, and the UI state to `localStorage["excalidraw-state"]` (60 keys).
- **Timing** (scenario 13, s6, three independent shapes; offsets from the first read after
  pointer-up): each new shape was **absent** at 0, about 115 and about 230 ms, and **present** at
  about 340–375 ms and later. s1 measured the same once (absent at about 100 ms, present at about
  300 ms) [O, high]. That this is a debounce of roughly 300 ms is [H].
- **Reload:** restores the identical scene and scroll (`06-after-reload`, s1 and s6; also every
  `00b` reload in s6).
- **Deleted elements:** removed from the stored array; Ctrl+A then Delete leaves `[]`
  (`12-end`, `13-end`).
- **Label:** [O], high.

### B-31 Storage keys

- `localStorage`: `excalidraw`, `excalidraw-state`, `excalidraw-theme`, `i18nextLng`,
  `version-dataState`, `version-files`.
- `sessionStorage`: empty.
- IndexedDB: `excalidraw-library-db`, `excalidraw-ttd-chats-db`, `files-db`, plus
  `workbox-expiration` in s6 (REA `ev_13a4756f`), which the s1 inventory did not list.
- Cache Storage: one Workbox precache.
- **Label:** [O], high (REA, values redacted, and the driver).

## Import, export and collaboration

### B-32 Export and save

- Export to PNG or SVG from the dialog, Ctrl+S, and Save to… produced no download event and no
  in-page UI in headless Chromium (s1 and s6) [O].
- File System Access identifiers are present in the bundle [S]. A native save picker (invisible
  in headless mode) is therefore [H], medium.
- The exported file formats are [U].

### B-33 Guest collaboration lifecycle

- **Start session:** within about 5 s the URL gains `#room=<20 chars>,<22 chars>` (s1 and s6)
  [O, high].
- **Dialog:** shows an editable "Your name" textbox with a random two-word name, the link, Copy
  link, a QR code and Stop session [O, high].
- **Share button:** its accessible name becomes the participant count ("1"); a Laser pointer
  button joins the toolbar, and an avatar initial appears. In s6 this was also seen with the
  dialog closed (`collab-03-after-stop` ARIA) [O, high].
- **Escape:** pressing Escape did not dismiss the dialog in either session. In s6 the in-session
  screenshot was therefore refused by the driver's privacy check.
- **Stop session:** this is [U].
  - A role click on "Stop session" right after closing the dialog timed out in both sessions.
  - Reopening the dialog through the "1" button and clicking Stop session (scenario 08b)
    reported success in s6, but 2.5 s later the URL fragment and the dialog with its Stop session
    button were still present (`collab-04-stopped`).
  - In s1 a later native-dialog attempt left the page unresponsive to CDP evaluation.
- **Captures:** s1's dialog screenshots were retired for privacy. s6's dialog screenshots have
  every input and image masked (pixel-checked).

## Element context menu and confirmations

### B-34 Element context menu

- **Action:** right-click on the stroke of a selected rectangle (s6, dark theme,
  `dark-07-element-context-menu`).
- **Result:** a list of buttons (no `menu` role), separated into groups:
  - Cut, Copy, Paste;
  - Wrap selection in frame;
  - Copy to clipboard as PNG, Copy to clipboard as SVG;
  - Copy styles, Paste styles;
  - Add to library;
  - the four layer commands;
  - Flip horizontal (Shift+H), Flip vertical (Shift+V);
  - Add link (Ctrl+K), Copy link to object;
  - Duplicate (Ctrl+D), Lock (Ctrl+Shift+L);
  - Delete.
- **Label:** [O], medium (s6 only). The effects of the items other than Duplicate, Lock and Delete
  (B-18, B-19) are [U].

### B-35 Clear canvas confirmation

- **Action:** main menu → "Reset the canvas" (mobile dark, s7, `m15-dark-reset-confirm`).
- **Result:** a "Clear canvas" dialog with Cancel and Confirm. Escape dismissed it and the scene
  kept its element (`14-selected`).
- **Label:** [O], medium (s7 only). Confirming was not tested [U].

## Desktop and mobile differences (summary)

| Aspect               | Desktop                 | Mobile                                                      |
| -------------------- | ----------------------- | ----------------------------------------------------------- |
| Toolbar              | top, 13 buttons         | bottom, 8 buttons                                           |
| Zoom controls        | buttons, bottom left    | none visible; pinch                                         |
| Share and promo      | top right               | absent from the top bar; share via the main menu or welcome |
| Properties           | left side panel         | compact bar of 4 buttons above the toolbar                  |
| Handles              | 4 corners plus rotation | 8 handles plus rotation                                     |
| Lasso in More        | yes                     | no                                                          |
| Diamond/Ellipse/Line | toolbar                 | access path [U]                                             |
