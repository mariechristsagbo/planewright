# Behaviour analysis

Every entry records the eleven fields that issue #1 asks for, in this order: **Initial state**,
**Action**, **Immediate result**, **State and related effects**, **Persistence**,
**Undo/redo**, **Edge cases**, **Desktop/mobile**, **Reproduction**, **Confidence** and
**Limitations**.

A field that this baseline did not observe says **Not observed** and names the residual row
(`R-xx`) in the [residual matrix](residual-matrix.md) that tracks it. Nothing in a field is
filled in by analogy with another entry. **Not applicable** is used only where the action
changes no stored or undoable state, and always says why in parentheses.

Labels follow the [methodology](methodology.md#evidence-labels): **[O]** observed behaviour,
**[S]** static artefact finding (shipped bundle), **[I]** engineering inference with no
plausible alternative reading, **[H]** unverified hypothesis, **[U]** not observed. Confidence
follows the [methodology rule](methodology.md#evidence-labels): **high** means identical results
in at least two sessions, at least one from a fresh profile; **medium** means one session, or
two sessions that disagree; **low** means indirect. Two tools reading the same session count as
one session. A fact read only from raw records outside Git says so (see
[limitations](limitations.md#tooling-limits)).

Geometry is in scene units, zoom 1, scroll (0,0), desktop 1280×720 and light theme unless the
entry says otherwise. Boxes are `[x, y, width, height]` as stored; for arrows and lines `x, y`
is the first point. Reproduction handles name:

- the scenario in `research/excalidraw/scenarios/`;
- the sessions that ran it (s1, s2 and s3 first pass; s6 desktop and s7 mobile fresh reruns);
- probe labels in `evidence/probes-<session>.json`, or screenshot and ARIA names in
  `evidence/sessions.json`.

**What the committed probes hold.** Each probe keeps type, box, angle, group count, bound
element types, start and end binding flags, container flag, lock flag and eight style values,
plus selection count, tool, zoom, scroll and theme. Point counts, font fields and text length
were read from the raw timelines and are **not** in the committed summary, except that the
summaries of s22 on keep point counts (`--points`), those of s52–s57 a text's font size, family and
alignment (`--text`), and those of s51 on a link's origin and path and a freehand stroke's
pressure fields. Scene and appState
probes read `localStorage["excalidraw"]` and `localStorage["excalidraw-state"]`, so every probe
value is a value the page had saved locally.

**Cross-session replay** (computed from the committed probe files):

- s6 shares 45 probe labels with s1, and 45 of 45 are identical.
- s6 shares 31 labels with s2, and 23 of 31 are identical. The 8 that differ are the scenario 05
  labels from `05-shift-1-fit` on, because s2 ran 05 straight after 03 (see B-36).
- In all, 47 of the 80 s6 labels also occur in s1 or s2, and each matches at least one earlier
  occurrence.
- s8 shares 5 labels with s6, and 5 of 5 are identical: all of scenario 12 (B-02).
- s9 shares 20 labels with s6, and 19 of 20 are identical: all of scenario 13 except `13a-t200`,
  where s9 had already saved the new shape (B-30).
- s10 shares 5 labels with s6, and 0 of 5 are identical: s10 ran scenario 15 after 00 and 07c,
  s6 at the end of the desktop chain. s6 had scroll (90,45) and s10 none, and s10's boxes minus
  (90,45) equal s6's boxes; the three elements that 15 draws also have the same type, angle and
  binding flags in both. Their style values differ (the stock defaults in s10, scenario 04's
  styles in s6), and tool, selection, zoom and theme agree [O].
- s7 shares 6 labels with s3, and 2 of 6 are identical. The other 4 differ only in scrollX
  after the pinch (−135 in s3 at DPR 1, −132 in s7 at DPR 3), which carries into later labels.
- s11 shares 9 labels with s7, and 2 of 9 are identical; the other 7 differ only in scrollX
  (−135 in s11, −132 in s7), set by the pinch in scenario 10 and carried into 14's labels. s11
  shares 6 labels with s3, and 6 of 6 are identical. s7 and s11 both ran at DPR 3, so the
  scrollX difference does not follow the DPR [I].
- s12 shares 6 labels with s11, and 6 of 6 are identical, as are the 6 it shares with s3; with
  s7, 2 of 6 are identical, the other 4 differing only in that scrollX.
- s21 shares 34 labels with s19, and 34 of 34 are identical (scenarios 25, 27 and 24); s17 shares 34
  with s19, and 23 of 34 are identical, the other 11 differing only in the background colours and in
  the taps inside the second rectangle, because s17's 25 left it transparent.
- s20 shares 14 labels with s18 (scenario 26), and 1 of 14 is identical, `26-start`; the other 13
  differ only in scroll (B-36).

## Creation

### B-01 Create a shape by drag

- **Initial state:** canvas without the new shape; Selection tool active.
- **Action:** press R and drag (300,180)→(420,280). Likewise O (520,180)→(660,280),
  D (820,170)→(940,290) and L (300,420)→(420,420).
- **Immediate result:** rectangle `[300,180,120,100]`, ellipse `[520,180,140,100]`, diamond
  `[820,170,120,120]`, line `[300,420,120,0]`. Each box equals the drag extent; no snapping at
  default settings [O].
- **State and related effects:** the tool and selection just after a drag: Not observed (R-02,
  R-29). Scenario 02 reads the appState probe `02-tool-probe` three times: after pressing R and
  straight after the rectangle drag, both without a wait, and at the end of 02 after an 800 ms
  wait. The committed entry keeps the first read's time with the last read's values (tool
  Selection, 1 selected), so it describes the end of 02, not the drag. The two early reads (raw
  timelines only) disagree: straight after the drag the saved tool was Rectangle in s2 and
  Selection in s6, with 0 selected in both. That they read the saved state before it caught up
  is [H]. On mobile, read 800 ms after each touch drag, the tool was back to Selection with the new
  shape selected, except after Freedraw, which stayed active with nothing selected (`69-diamond`,
  `69-freedraw`; s74–s76) [O]. Stored
  defaults: stroke `#1e1e1e`, background `transparent`,
  fill `solid`, stroke width 2, stroke style `solid`, roughness 1, opacity 100. Roundness type 3
  for the rectangle; 2 for ellipse, diamond, line, arrow and sticky note; none for freedraw,
  text and image [O].
- **Persistence:** the values were read from local storage, so each shape was saved [O]. Save
  timing is in B-30.
- **Undo/redo:** on mobile one Undo right after each drag removed the new rectangle, diamond,
  ellipse, line, arrow or freehand stroke and left nothing selected (`69-rectangle-undo` to
  `69-freedraw-undo`; s74–s76) [O]. On desktop: Not observed for drag creation (R-29).
- **Edge cases:** a drag that starts on the properties panel creates nothing (B-02).
  Shift/Alt modifiers, drags towards the top-left and very small drags: Not observed (R-31).
- **Desktop/mobile:** a one-finger touch drag (120,250)→(260,350) with the Rectangle tool gives
  `[120,250,140,100]` (`m-rect-touch`, s3, s7 and s11) [O]. On mobile the Rectangle tool's choice
  holds Rectangle, Diamond and Ellipse (s3, s7, s11, s12, s16, s22) and the Arrow tool's Arrow and
  Line (s27, s32, s34, s36) (raw ARIA) [O]; a touch drag with Line gave `[60,420,240,0]` with 2 points (`33-line-drag`; s27,
  s32). A tap with Arrow or Line makes a 2-point element 100 units long, centred on the tap (B-40).
  Diamond and Ellipse, picked by name from the Rectangle tool's choice, gave by touch drags a
  diamond `[100,240,120,80]` and an ellipse `[160,360,120,80]`, each box the drag extent, with
  roundness type 2 (`38-diamond`, `38-ellipse`; s39, s43) [O]; after Diamond was picked the
  toolbar button was named Diamond, and the next tap on it opened the choice with Diamond pressed
  (raw ARIA) [O]. Each of the six drag-made shapes, drawn by touch from (200,480) to (340,600), got
  the box `[200,480,140,120]`, the drag extent (`69-*`; s74–s76) [O].
- **Reproduction:** scenarios 02 (s2, s6: `02-all-shapes`), 12 (s6, s8:
  `12-after-canvas-drag`), 10 (s3, s7, s11: `m-rect-touch`), 33 (s27, s32: `33-line-drag`), 38
  (s39, s43: `38-diamond`, `38-ellipse`), 69 (s74–s76).
- **Confidence:** [O] high (s2 and s6 identical; s3, s7 and s11 identical; s39 and s43
  identical; 69's reads identical in s74, s75 and s76).
- **Limitations:** one size per shape; dark theme only for a rectangle and an arrow
  (scenario 15, s6 and s10); the line's point count (2) is from the raw timeline (R-29).

### B-02 Properties panel occupies the canvas while a tool is active

- **Initial state:** empty canvas; a drawing tool chosen by keyboard (R, then L).
- **Action:** drag from x=200 (on the panel) and, separately, the same drag from x=300.
- **Immediate result:** the panel opens on the left (x≈16–211 at 1280×720, from screenshots)
  and the welcome screen disappears. The rectangle drag from x=200 created nothing
  (`12-after-panel-drag`: 0 elements, tool still Rectangle); the line drag from x=200 added
  nothing (`12-after-panel-line-drag`). The drag from x=300 created `[300,180,120,100]` [O].
- **State and related effects:** after the panel drag the tool stays Rectangle and nothing is
  selected [O].
- **Persistence:** the stored scene did not change [O].
- **Undo/redo:** Not observed (R-29).
- **Edge cases:** a drag that starts on the canvas and ends over the panel: Not observed (R-29).
- **Desktop/mobile:** mobile has no side panel (feature inventory F-33); a drag across its
  compact bar: Not observed (R-11).
- **Reproduction:** scenario 12 (s6, s8). s1's earlier scenario 02 hit the same effect by
  accident.
- **Confidence:** [O] high: s6 and s8, both fresh profiles, gave identical probes for all five
  labels of scenario 12; s8 ran a later build (see [limitations](limitations.md)).
- **Limitations:** the panel extent was read from screenshots, not probed (R-29).

### B-03 Contextual hint line

- **Initial state:** empty canvas; then the Draw tool; then a selected shape; then selected
  text.
- **Action:** none beyond reaching each state.
- **Immediate result:** the line under the toolbar reads, in turn: how to pan; "Click and drag,
  release when you're finished"; "Enter to add text, Ctrl+↑↓ to create a flowchart"; "Double-click
  or press Enter to edit text" [O].
- **State and related effects:** display only; no stored state was read.
- **Persistence:** not applicable (no stored state).
- **Undo/redo:** not applicable (a hint changes no state).
- **Edge cases:** the hint for the other tools and states: Not observed (R-01).
- **Desktop/mobile:** the mobile hint line: Not observed (R-23).
- **Reproduction:** ARIA snapshots of scenarios 01, 02 and 15 (s1, s6; 15 also in s10), for
  example `dark-11-panel-text`.
- **Confidence:** [O] high for the first three (s1 and s6); high for the text hint, whose
  `dark-11-panel-text` snapshots in s6 and s10 are identical (a raw comparison).
- **Limitations:** the text comes from ARIA snapshots outside Git; only their names and line
  counts are committed.

### B-04 Arrow and binding

- **Initial state:** (a) scenario 02: rectangle `[300,180,120,100]` and ellipse
  `[520,180,140,100]`, default settings ("Arrow binding" checked in the canvas context menu).
  (b) scenario 04: rectangle `[340,240,180,150]` with a label, ellipse `[640,240,120,100]`,
  red stroke and "architect" sloppiness as defaults (B-20).
- **Action:** (a) press A and drag (425,230)→(515,230): the start is 5 units right of the
  rectangle's right edge (x=420), the end 5 units left of the ellipse's leftmost point (520,230).
  (b) press A and drag (535,300)→(645,290): the start is 15 units right of the rectangle's
  right edge (x=520), the end 5 units inside the ellipse outline (x=640 at y=290).
- **Immediate result:** (a) arrow `[426,230,88,0]`: its ends are at x=426 and x=514, 1 unit
  from the pointer positions and 6 units from each target's outline; start and end are bound.
  (b) arrow `[535,300,110,10]`: its end is at x=645, the pointer position; the end is bound and
  the start is not [O].
- **State and related effects:** each bound target's `boundElements` gains an `arrow` entry:
  (a) rectangle and ellipse; (b) the ellipse only. Arrow (b) has the defaults set in B-20 [O].
- **Persistence:** read from local storage [O].
- **Undo/redo:** on mobile the Undo button removed a touch-drawn bound arrow and the `arrow`
  entries of both targets, and Redo restored it with both ends bound (`29-arrow-undo`,
  `29-arrow-redo`; s23, s28) [O]. Ctrl+Z on desktop: Not observed (R-42).
- **Edge cases:**
  - **Endpoint placement.** On desktop the bound end of (a) lies 6 units outside the ellipse
    and that of (b) 5 units inside it. An earlier version of this entry said the end "snapped to
    the outline"; the probes do not support that. On mobile (scenario 29, zoom 1, 2 px stroke),
    ends released on R's left stroke or 8 units outside it were bound and placed 6 units outside
    it, at x=244; an end released 16 units inside was bound and stayed where it was released; a
    drag from P's centre to Q's centre bound both ends and kept them at the two centres
    (`29-arrow-centres`: `[90,160,210,0]`) [O].
  - **Distance.** On mobile, ends released 16, 24 and 40 units outside R were not bound
    (`29-end-p16`, `29-end-p24`, `29-end-p40`), so the limit lies between 8 and 16 units at zoom
    1 [O]. On desktop start binding happened at 5 units (a) and not at 15 units (b) [O]. That one
    limit between 8 and 15 units holds for both is [H]: the cases differ in input, target and
    scene.
  - **A moved target.** On mobile, moving Q 40 units up by a touch drag on its top stroke moved
    the bound end with it to Q's new centre (`29-target-moved`: `[90,160,210,40]`) [O]. Scenario
    04 moved a rectangle that was not bound to the arrow; the arrow did not change
    (`04-move-bound-rect`).
  - Ctrl while drawing to prevent binding (listed in Help), unbinding, the "Arrow binding"
    toggle and midpoint snapping: Not observed (R-42).
- **Desktop/mobile:** on mobile, arrows drawn with a one-finger drag bind as above (s23, s28);
  the bar shows an "Arrow type" button while the Arrow tool is active (s27, s32, raw ARIA) [O].
- **Reproduction:** scenario 02 (s2, s6: `02-all-shapes`); scenario 04 (s1, s6:
  `04-arrow-bound`); scenario 29 (s23, s28: `29-*`).
- **Confidence:** [O] high for the stored geometry and the binding flags of both desktop cases and
  of the mobile ladder, the centre arrow, its undo and the moved target (s23 and s28 identical).
- **Limitations:** the probe keeps the arrow's origin, extent and (from s22, `--points`) point
  count, not the points, so end positions are derived [I]; binding gap and focus values were not
  recorded, and on mobile one target size, one zoom and horizontal arrows only (R-42).

### B-05 Freedraw

- **Initial state:** scenario 02's scene; Selection tool.
- **Action:** press P and drag a 6-vertex path (520,400)…(620,440).
- **Immediate result:** a `freedraw` element `[520,400,100,40]`, the extent of the input, with
  stroke width 1 (other shapes default to 2) and no roundness [O].
- **State and related effects:** the raw timelines show 22 stored points for 6 input vertices,
  because the driver interpolates moves; not in the committed summary.
- **Persistence:** read from local storage [O].
- **Undo/redo:** two Ctrl+Z at the start of scenario 05 removed the two dots made after the
  eraser: the next scene probe (`06-paste`) has no freedraw element [O]. On mobile Undo reversed
  the bold stroke width and the second Pressure radio, Redo re-applied each, and Undo removed the
  Autoshape rectangle (`45-width-bold-undo`, `45-width-bold-redo`, `45-pressure-2-undo`,
  `45-pressure-2-redo`, `45-autoshape-undo`; s53, s55, s57) [O].
- **Edge cases:** one click with the Draw tool creates a 0×0 freedraw "dot"
  (`diag-after-eraser`: `[1000,600,0,0]` and `[340,400,0,0]`) [O]. Pressure on desktop: Not
  observed (R-43).
- **Desktop/mobile:** on mobile a one-finger drag with the Draw tool from (60,420) to (300,470)
  gave a freedraw `[60,420,240,50]` with 12 stored points, stroke width 1 and no roundness
  (`36-freedraw`, s37; `40-freedraw-selected`, s41, s45) [O]. The Draw tool's bar offers a choice
  of Freedraw (pressed) and Autoshape, and a selected stroke's second Stroke button opens Stroke
  width, Pressure and Opacity (s37, s41, s45, raw ARIA) [O]. In scenario 45 (s53, s55, s57) the
  Stroke width radios bold and thin, touched at the centres measured on s41's capture, gave stroke
  widths 2 and 0.5 to a stroke drawn with 1, and the second Pressure radio changed its stored
  stroke options' `variability` from `constant` to `variable`, `simulatePressure` staying false
  with 12 pressures stored (`45-freedraw`, `45-width-bold`, `45-width-thin`, `45-pressure-2`) [O].
  With Autoshape picked by name from the Draw tool's choice the tool became `autoshape`, and a
  closed rough rectangle drawn with one finger through nine points between (58,527) and (302,633)
  was stored as a `rectangle` `[58,527,244,106]`, the extent of the input, with stroke width 1 and
  nothing selected (`45-autoshape`) [O].
- **Reproduction:** scenarios 02 (s2, s6), 04b (s1, s6), 05; on mobile 36 (s37), 40 (s41, s45)
  and 45 (s53, s55, s57).
- **Confidence:** [O] high (geometry s2 and s6; dots s1 and s6; mobile s41 and s45 identical, and
  scenario 45's 20 labels identical in s53, s55 and s57).
- **Limitations:** on desktop the point count and smoothing are not in the committed summary; on
  mobile one Autoshape input, a closed rough rectangle, was drawn, and the radios have no
  accessible name, so which one is which is read from the stored results [I] (R-43).

### B-06 Text

- **Initial state:** scenario 02's scene; Selection tool.
- **Action:** press T, click (820,420), type "Hello", press Escape.
- **Immediate result:** a `text` element `[820,407.5,43.2,25]`: its left edge is at the click
  and its vertical centre on it [O].
- **State and related effects:** font size 20, font family id 5 and left alignment were read
  from the raw timelines; not in the committed summary on desktop (the mobile summaries of s53–s57
  keep them).
- **Persistence:** read from local storage [O].
- **Undo/redo:** undo of text creation: Not observed (R-40). On mobile the Undo button reversed a
  font change, a font size and an alignment, and Redo re-applied the first two (see
  Desktop/mobile).
- **Edge cases:** re-edit by double-click, multiline, wrapping, an empty text on Escape and the
  desktop font picker: Not observed (R-40).
- **Desktop/mobile:** dark desktop text: `15-text` `[910,572.5,40,25]` in s6 and
  `[1000,617.5,40,25]` in s10. s10's box minus (90,45), the scroll that s6 had and s10 did not,
  equals s6's box [O, medium: the probes differ as recorded]. On mobile a tap with the Text tool
  at (60,300), the word Plan typed and a tap on empty canvas gave a text `[60,287.5,40.5,25]`,
  placed as on desktop, and left nothing selected (`36-text`, s37); a tap on it selected it
  (`40-text-selected`, `41-text`; s41, s45, s46, s47) [O]. Nunito, picked in the font picker,
  widened it to 40.9, and Undo and Redo reversed and re-applied that (`41-nunito`,
  `41-nunito-undo`, `41-nunito-redo`; s46, s47) [O]; the stored font family went from 5 to 6 and
  back [O, raw timelines]. In scenario 45 (s53, s55, s57) the Font size radios S, L and XL of the
  Text align popover, touched at the centres measured on s46's capture, stored font sizes 16, 28
  and 36 (20 at first) and boxes `[60,290,32.4,20]`, `[60,282.5,56.7,35]` and `[60,277.5,72.9,45]`,
  keeping the left edge and the vertical centre at y 300, and its Text align radios centre and
  right stored `center` and `right` with the box unchanged (`45-size-l`, `45-size-xl`, `45-size-s`,
  `45-align-centre`, `45-align-right`); Undo and Redo reversed and re-applied L, and Undo reversed
  centre (`45-size-l-undo`, `45-size-l-redo`, `45-align-centre-undo`) [O].
- **Reproduction:** scenario 02 (s2, s6: `02-all-shapes`), scenario 15 (s6, s10); on mobile 36
  (s37), 40 (s41, s45), 41 (s46, s47) and 45 (s53, s55, s57).
- **Confidence:** [O] high for the geometry (s2 and s6 identical); medium for the dark text box
  (s6 and s10 differ by the scroll, see the methodology's confidence rule); high for the mobile
  radios (s53, s55 and s57 identical).
- **Limitations:** the width depends on the loaded font; one one-line text, so an alignment inside
  a wider box was not seen (R-40).

### B-07 Container label

- **Initial state:** rectangle `[340,240,180,150]` selected (scenario 04).
- **Action:** press Enter, type "Box", press Escape.
- **Immediate result:** a `text` element `[410.7,302.5,38.6,25]` with a container, centred on
  the rectangle's centre (430,315) [O].
- **State and related effects:** the rectangle's `boundElements` lists `text`. Dragging the
  rectangle by +60 in y moved the label by +60 too (`04-move-bound-rect`) [O].
- **Persistence:** read from local storage [O].
- **Undo/redo:** Not observed (R-40).
- **Edge cases:** long labels, wrapping and resizing the container: Not observed (R-40).
- **Desktop/mobile:** mobile: Not observed (R-40).
- **Reproduction:** scenario 04 (s1, s6: `04-container-label`, `04-move-bound-rect`).
- **Confidence:** [O] high.
- **Limitations:** the centre alignment value is from the raw timelines (R-40).

### B-08 Sticky note

- **Initial state:** scenario 02's scene.
- **Action:** press N, click (1000,520), type "Note", press Escape.
- **Immediate result:** a `stickynote` `[875,395,250,250]`, centred on the click, with background
  `#ffdf6b`, and a bound `text` `[976.8,507.5,46.4,25]` centred in it [O].
- **State and related effects:** the note's `boundElements` lists `text`; typing goes straight
  into the label. A date stamp ("4 Nov") is drawn in the bottom-right corner (screenshot
  `shape-02-all-tools`) [O]; whether it is stored is [U] (R-41).
- **Persistence:** read from local storage [O].
- **Undo/redo:** on mobile one Undo after placing a note and pressing Escape removed the note
  (`70-sticky-undo`; s74–s76) [O]. On desktop: Not observed (R-41).
- **Edge cases:** resizing and long text: Not observed (R-41).
- **Desktop/mobile:** on mobile the Sticky note is in More tools. Picked there, a tap at (195,180)
  placed a note `[70,55,250,250]` centred on the tap, with an empty bound text being edited, and
  left the Selection tool active; Escape dropped the empty text and left the note selected
  (`70-sticky`, `70-sticky-escape`; s74–s76) [O]. Nothing was typed into it.
- **Reproduction:** scenario 02 (s2, s6: `02-all-shapes`); 70 on mobile (s74–s76).
- **Confidence:** [O] high.
- **Limitations:** one note; the screenshot is outside Git, with its digest committed (R-41).

### B-09 Image by file drop

- **Initial state:** scenario 06's end state, scroll (90,45).
- **Action:** drop a self-generated 64×48 PNG at viewport point (1000,200), which is scene point
  (910,155).
- **Immediate result:** an `image` element `[878,131,64,48]`: native size, centred on the drop
  point, and selected [O].
- **State and related effects:** no other element changed [O].
- **Persistence:** the image element is in local storage [O]. The stored scene grew only
  slightly, so the bytes are not inline (raw sizes, not committed). The `files-db` IndexedDB
  database exists [O]; that it holds the bytes is [H], medium (R-45).
- **Undo/redo:** Not observed (R-45).
- **Edge cases:** "Insert image" from More tools produced no Playwright file-chooser event [O];
  large images, crop and resize: Not observed (R-45).
- **Desktop/mobile:** mobile: Not observed (R-45).
- **Reproduction:** scenario 06b (s1, s6: `06b-image-drop`).
- **Confidence:** [O] high for the geometry.
- **Limitations:** one image size (R-45).

### B-40 Lines and multi-point lines by touch

- **Initial state:** mobile, an empty canvas at zoom 1, right after 09 (scenarios 28, 33 and 35).
- **Action:** with the Arrow tool, a tap at (60,560) in 28 or (60,200) in 33; with the Line tool,
  picked from the Arrow tool's choice, taps at (60,280), (200,320) and (320,280); then a line drawn
  by a drag from (60,420) to (300,420), which stays selected, and a one-finger drag from its middle
  to (180,360), after a double tap on the middle in 33 and with none in 35.
- **Immediate result:** the first tap with either tool made a horizontal 2-point element 100
  units long, centred on the tap (`[10,560,100,0]`, `[10,200,100,0]`, `[10,280,100,0]`), and the
  tool went back to Selection; the later taps deselected and added no point (`28-arrow-taps`,
  `33-arrow-tap`, `33-line-taps`) [O]. The drag from the middle of the selected line gave it a
  third point, its box becoming `[60,420,240,60]`, with or without the double tap
  (`33-midpoint-drag`, `35-line-middle-drag`) [O].
- **State and related effects:** after the double tap, the capture shows the line's ends as
  circles and a filled dot at its middle (`m33-04-double-tap`, raw capture) [O]; the bar of a
  selected arrow shows "Arrow type" and "Edit arrow" buttons, and the Arrow type popover holds
  Arrowheads (buttons named `arrowhead_start` and `arrowhead_end`) and three unnamed Arrow type
  radios, the second checked (s34, s36, raw ARIA) [O].
- **Persistence:** read from local storage [O].
- **Undo/redo:** on an arrow drawn from (60,560) to (300,560) (scenario 39), the Undo button
  removed the third point added by a drag from its middle and Redo restored it
  (`39-middle-drag-undo`, `39-middle-drag-redo`), and one Undo moved back an end point dragged
  with Edit arrow (`39-edit-end-drag-undo`; s40, s44) [O]. In Edit arrow, Undo removed a fourth
  point and Redo restored it, the editing going on (no Edit arrow button in the bar,
  `m48-03-after-redo`, raw ARIA), and Undo after Delete restored a deleted point
  (`48-point-4-undo`, `48-point-4-redo`, `48-point-delete-undo`; s55, s57) [O].
- **Edge cases:** so a multi-point line cannot be made by taps alone: a tap makes a 100-unit
  element and ends the tool [O]. The three Arrow type radios, touched at the centres measured on
  s34's capture, made the arrow sharp (no roundness), then elbowed (`elbowed` true, no
  roundness, still 2 points) and round again (roundness type 2, the type it was drawn with), and
  Undo and Redo switched it between elbow and sharp (`39-sharp`, `39-elbow`, `39-elbow-undo`,
  `39-elbow-redo`, `39-round`) [O]. Edit arrow hid its own button while editing, showed the ends
  as circles and a dot at the middle, and a drag of the end point from (300,560) to (330,620)
  moved it by the drag (`39-edit-end-drag`); a tap on empty canvas ended the editing and left the
  arrow selected [O]. A selected sharp arrow with three points showed circles at its points and
  no midpoint handle, and a drag from its first segment's middle, (120,220) to (120,280), moved the
  whole arrow by 60 down instead of adding a point, Undo and Redo moving it back and down again
  (`46-point-3`, `46-point-4`, `46-point-4-undo`, `46-point-4-redo`; s54, s56) [O]; in Edit arrow a
  tap on that segment's midpoint and Delete in the Actions popover changed neither the arrow nor
  its points (`46-point-selected`, `46-point-delete`) [O]. Edit arrow shows a filled midpoint
  handle on each segment (`m46-05-point-selected`, raw capture) [O]: a drag from the first one,
  (120,170) to (120,230), added a fourth point, and a tap on that point and Delete in the Actions
  popover removed it, leaving the arrow with 3 points; the first tap on empty canvas then ended the
  editing with the arrow selected (`48-point-4`, `48-point-delete`, `48-edit-end`; s55, s57) [O].
- **Desktop/mobile:** desktop click sequences: Not observed (R-30).
- **Reproduction:** scenarios 28 (s22), 33 (s27, s32), 35 (s34, s36), 39 (s40, s44), 46 (s54,
  s56) and 48 (s55, s57).
- **Confidence:** [O] high for the 100-unit element made by a tap (s22, s27, s32), for the added
  point (s27, s32, s34, s36), for the arrow types, Edit arrow and the undo (s40 and s44
  identical), and for the moved arrow, the fourth point and the deleted point (s54 and s56, s55 and
  s57 identical).
- **Limitations:** the probe keeps each line's point count (from s22, `--points`), not the points,
  so where the third point lies is derived from the box [I]; taps last 40 ms with a 1 px contact
  radius; the Arrow type radios have no accessible name, so which one is which is read from the
  stored results, not from a label [I]; points were added and deleted on sharp arrows only
  (R-30).

## Selection

### B-10 Click selection

- **Initial state:** transparent rectangle `[300,200,120,100]` and ellipse `[600,200,120,100]`,
  nothing selected (`two-shapes`).
- **Action:** click inside the rectangle, then on its stroke.
- **Immediate result:** inside: 0 selected; on the stroke: 1 selected [O].
- **State and related effects:** selection is part of the saved app state
  (`selectedElementIds`) [O].
- **Persistence:** on mobile a selection survived a reload at zoom 1.5 (B-30; s17, s19, s21) [O]; on
  desktop: Not observed (R-54).
- **Undo/redo:** on mobile, Undo after a deselecting tap restored the selection of 3 and changed
  no element (`34-deselect-undo`; s33, s35), and in s25 and s30 the first Undo after a tap that
  selected a group restored the empty selection before it and kept the group
  (`31-group-undo`) [O]. On desktop: Not observed (R-52).
- **Edge cases:** on mobile at zoom 1 with the 2 px stroke, a tap selected a transparent rectangle
  only within 4 px of its stroke, on either side (8 px or more away, and the centre, missed), and a
  filled one also from anywhere inside, but not from 8 px or more outside (`25-transparent-*`,
  `25-filled-*`; s17, s19, s21) [O]; with a mouse on desktop: Not observed (R-34).
- **Desktop/mobile:** a tap on the stroke of the rectangle selects it (`m-tap-select-stroke`, s3, s7
  and s11) [O]; a tap inside a transparent rectangle does not, and a tap inside a filled one does
  (scenario 25; s17, s19, s21) [O]. A long press of 800 ms on the stroke of an unselected rectangle
  selected it and opened its context menu (`67-element-hold`; s74–s76; B-34) [O].
- **Reproduction:** scenario 03 (s1, s2, s6: `click-inside-transparent-rect`, `click-rect-stroke`);
  scenario 10 (s3, s7, s11); scenario 25 (s17, s19, s21); scenario 67 (s74–s76).
- **Confidence:** [O] high; on mobile, [O] high for the transparent ladder (three sessions) and for
  the filled one (s19, s21).
- **Limitations:** one shape type and one stroke width, and on mobile one zoom; the tolerance lies
  between 4 and 8 px, not finer (R-34).

### B-11 Add to selection

- **Initial state:** the rectangle of B-10 selected.
- **Action:** Shift+click the ellipse's stroke.
- **Immediate result:** 2 selected (`shift-click-ellipse`) [O].
- **State and related effects:** none on the elements [O].
- **Persistence:** the selection is part of the saved app state (B-10); whether it survives a
  reload: Not observed (R-54).
- **Undo/redo:** whether a selection change is an undo step: Not observed (R-52).
- **Edge cases:** Shift+click on a selected element and Ctrl deep select: Not observed (R-33).
- **Desktop/mobile:** mobile multi-select: Not observed (R-33).
- **Reproduction:** scenario 03 (s1, s2, s6).
- **Confidence:** [O] high.
- **Limitations:** two elements only (R-33).

### B-12 Box selection

- **Initial state:** the two shapes after ungrouping (scenario 03).
- **Action:** drag on empty canvas around both whole elements.
- **Immediate result:** 2 selected (`box-select`) [O].
- **State and related effects:** none on the elements [O].
- **Persistence:** the selection is part of the saved app state (B-10); whether it survives a
  reload: Not observed (R-54).
- **Undo/redo:** on mobile, the first Undo after a box selection that followed a deselecting tap
  left nothing selected and changed no element (`31-distribute-horizontally-undo`, where
  Distribute horizontally had changed nothing; s25, s30) [O]. On desktop: Not observed (R-52).
- **Edge cases:** on mobile a box dragged from empty canvas over the top-left quarter of a rectangle
  selected nothing in the default Select on mode, Wrap (stored `contain`), and the rectangle once
  Overlap was picked in Preferences (`64-wrap-partial`, `64-overlap-partial`, s71, s72) [O]. Partial
  overlap on desktop and Ctrl box select: Not observed (R-33).
- **Desktop/mobile:** on mobile a one-finger drag with the Selection tool from empty canvas around
  whole elements selected them: 2 in s22 (`28-box-selected`), 3 in s25, s30, s33 and s35 [O]. The
  Lasso, picked from the Selection tool's choice, drawn as a one-finger loop round a rectangle,
  selected it and stayed the active tool (`70-lasso`; s74–s76) [O].
- **Reproduction:** scenario 03 (s1, s2, s6); scenarios 28 (s22), 31 (s25, s30) and 34 (s33,
  s35); 64 (s71, s72); 70 (s74–s76).
- **Confidence:** [O] high.
- **Limitations:** the probe stores a count, not which elements (R-33).

### B-13 A locked element is left out of select all and copy

- **Initial state:** scenario 04's end scene with a locked ellipse (B-19).
- **Action:** Ctrl+A, Ctrl+C, then paste (B-26).
- **Immediate result:** the paste inserted a rectangle, its label and the arrow, not the ellipse
  (`06-paste`) [O]. The clipboard held the same three element types (raw timelines only, B-26).
- **State and related effects:** the pasted arrow is not bound, because its target was not
  copied [O].
- **Persistence:** read from local storage [O].
- **Undo/redo:** see B-26.
- **Edge cases:** unlocking and selecting a locked element by box: Not observed (R-38).
- **Desktop/mobile:** mobile: Not observed (R-33).
- **Reproduction:** scenario 06 (s1, s6).
- **Confidence:** [O] high for the paste contents (s1, s6). Whether Ctrl+A left the locked
  ellipse unselected, or Ctrl+C skipped it, is not separated: no probe ran between them [H]
  (R-33).
- **Limitations:** no selection probe between Ctrl+A and Ctrl+C (R-33).

### B-14 Selection chrome

- **Initial state:** one selected rectangle.
- **Action:** select it.
- **Immediate result:** desktop: a 180×150 rectangle shows a box padded by about 4 px, 4 corner
  handles and a round rotation handle 16 px above the top centre (`sel-02-rect-handles`).
  Mobile: a 140×100 rectangle shows 8 handles (corners and edge midpoints) plus the rotation
  handle (`m04-rect-selected`) [O].
- **State and related effects:** none [O].
- **Persistence:** not applicable (handles are drawn chrome, not stored state).
- **Undo/redo:** not applicable (showing handles changes no element).
- **Edge cases:** whether the handle count depends on element size or input device: [U] (R-35).
- **Desktop/mobile:** as above.
- **Reproduction:** scenario 03b (s1, s6); scenario 10 (s3 at DPR 1, s7 at DPR 3).
- **Confidence:** [O] high.
- **Limitations:** read from screenshots; pixel offsets are approximate (R-35).

## Transform

### B-15 Move

- **Initial state:** grouped rectangle `[300,200,120,100]` and ellipse `[600,200,120,100]`.
- **Action:** drag from (300,250) to (340,290).
- **Immediate result:** both move by exactly +40/+40 (`drag-group-by-40`), with no snapping [O].
- **State and related effects:** both keep their group [O].
- **Persistence:** read from local storage [O].
- **Undo/redo:** Ctrl+Z restores the old positions (`undo-move`) and Ctrl+Shift+Z re-applies them
  (`redo-move`) [O].
- **Edge cases:** snapping to objects while moving, Shift-constrained moves: Not observed
  (R-36).
- **Desktop/mobile:** mobile: Not observed (R-36).
- **Reproduction:** scenario 03 (s1, s2, s6).
- **Confidence:** [O] high.
- **Limitations:** one delta (R-36).

### B-16 Resize

- **Initial state:** rectangle `[340,240,120,100]` selected.
- **Action:** drag the south-east handle by (+60,+50).
- **Immediate result:** `[340,240,180,150]`: the top-left corner stays fixed and the aspect ratio
  is free (`resize-se-handle`) [O].
- **State and related effects:** none on other elements [O].
- **Persistence:** read from local storage [O].
- **Undo/redo:** on mobile the Undo button restored a north-side resize and Redo re-applied it
  (`30-n-undo`, `30-n-redo`; s24, s29), and did the same for a south-side resize and for the
  two-element resize below (`37-s-undo`, `37-s-redo`, `37-pair-se-undo`, `37-pair-se-redo`; s38,
  s42) [O]. Ctrl+Z on desktop: Not observed (R-36).
- **Edge cases:** on mobile, a one-finger drag that started 4 units outside a selected
  rectangle's corner or side middle moved the dragged corner or side by exactly the drag and kept
  the opposite one fixed, with a free aspect ratio: south-east by (30,30) gave `[30,100,150,110]`,
  north-west by (−20,−20) `[220,90,140,100]`, east by (40,0) `[30,280,160,80]` and north by
  (0,−30) `[240,260,120,110]` (`30-se`, `30-nw`, `30-e`, `30-n`) [O]. The other four did the
  same: south-west by (−20,30) gave `[20,100,140,110]`, north-east by (20,−20)
  `[220,90,140,100]`, west by (−20,0) `[20,280,140,80]` and south by (0,30) `[220,290,120,110]`
  (`37-sw`, `37-ne`, `37-w`, `37-s`) [O]. A drag of the south-east handle of a two-element
  selection, started 6 units outside the pair's corner, by (100,20) turned `[40,460,80,60]` and
  `[160,500,80,60]` into `[40,460,120,72]` and `[220,508,120,72]` (`37-pair-se`) [O]: both
  rectangles and the gap between them scaled by 1.5 across and 1.2 down about the pair's
  north-west corner, the ratios of the drag to the pair's 200×100 box, so the aspect ratio was
  not kept [I, from the committed boxes]. Shift (aspect lock) and Alt (from the centre): Not
  observed (R-36).
- **Desktop/mobile:** mobile handles respond to touch as above (scenarios 30 and 37).
- **Reproduction:** scenario 03 (s1, s2, s6); scenarios 30 (s24, s29) and 37 (s38, s42).
- **Confidence:** [O] high (s24 and s29 identical; s38 and s42 identical).
- **Limitations:** on desktop one handle; on mobile the eight handles of one rectangle size and
  one corner of one two-element selection, at zoom 1 (R-36).

### B-17 Rotate

- **Initial state:** rectangle `[340,240,180,150]` selected.
- **Action:** drag the rotation handle (430,220) round the centre to (530,315).
- **Immediate result:** angle 1.6 in the probe, which rounds to one decimal; consistent with
  π/2 ≈ 1.571. Size unchanged (`04-rotate-90`) [O].
- **State and related effects:** none on other elements [O].
- **Persistence:** read from local storage [O].
- **Undo/redo:** Ctrl+Z restored angle 0 (`04-styles-applied`) [O].
- **Edge cases:** missing the handle deselects instead (`rotate-handle`) [O]. Shift snapping: Not
  observed (R-36).
- **Desktop/mobile:** on mobile a one-finger drag from 20 units above the middle of the top edge
  to 100 units right of the centre turned a 120×80 rectangle to angle 1.6, size unchanged; Undo
  restored 0 and Redo 1.6 (`30-rotate`, `30-rotate-undo`, `30-rotate-redo`; s24, s29) [O].
- **Reproduction:** scenarios 03 and 04 (s1, s2 for 03, s6); scenario 30 (s24, s29).
- **Confidence:** [O] high.
- **Limitations:** the exact stored angle was not captured (R-36).

### B-18 Duplicate

- **Initial state:** rectangle and ellipse selected.
- **Action:** Ctrl+D.
- **Immediate result:** copies at +10/+10 (`duplicate`: 4 elements) and 2 selected [O].
- **State and related effects:** the committed probe stores the selection count only, so the
  earlier statement that the copies are the selected pair cannot be checked from Git [U]
  (R-38).
- **Persistence:** read from local storage [O].
- **Undo/redo:** Ctrl+Z removed the copies (next probe has 2 elements) [O].
- **Edge cases:** Alt+drag duplicate: Not observed (R-38).
- **Desktop/mobile:** on mobile Duplicate in the Actions popover added one copy at +10/+10,
  `[50,130,120,80]` beside `[40,120,120,80]`, with 1 element selected; Undo removed it and Redo
  restored it (`40-duplicate`, `40-duplicate-undo`, `40-duplicate-redo`; s41, s45) [O].
- **Reproduction:** scenario 03 (s1, s2, s6); scenario 40 (s41, s45).
- **Confidence:** [O] high for offset and count.
- **Limitations:** which elements are selected (R-38).

### B-19 Lock

- **Initial state:** ellipse `[640,240,120,100]` selected.
- **Action:** Ctrl+Shift+L, then click the ellipse, then drag from it.
- **Immediate result:** `locked: true` and nothing selected (`04-lock-ellipse`); the click
  selects nothing and the drag does not move it (`04-drag-locked`) [O].
- **State and related effects:** its arrow binding is kept [O].
- **Persistence:** read from local storage [O].
- **Undo/redo:** on mobile, Undo after Lock from the context menu unlocked the rectangle and
  selected it again, and Redo locked it again with nothing selected (`75-locked-undo`,
  `75-locked-redo`; s75, s76) [O]. On desktop: Not observed (R-38).
- **Edge cases:** on mobile a long press on the locked rectangle opened its menu with Unlock in
  place of Lock, and Unlock cleared the flag and selected it (`m75-05-locked-hold`,
  `75-unlock-element`; s75, s76) [O]; unlocking on desktop: Not observed (R-38). Ctrl+A then Ctrl+C
  left it out of the copy (B-13).
- **Desktop/mobile:** on mobile, Lock picked in the long-press menu set `locked` and cleared the
  selection, a tap on the locked rectangle's stroke then selected nothing, and an Eraser stroke
  across it left it in place (`75-locked`, `75-locked-tap`, `75-locked-erase`; s75, s76; B-29)
  [O].
- **Reproduction:** scenario 04 (s1, s6); 75 on mobile (s75, s76).
- **Confidence:** [O] high.
- **Limitations:** one element type (R-38).

### B-42 Element link

- **Initial state:** mobile, scenario 46's scene, then a rectangle `[200,100,120,60]` drawn and
  left selected (scenario 47).
- **Action:** Add link in the Actions popover, a click on the textbox it opened, the self-authored
  URL `https://example.com/planewright-r11` typed with the keyboard standing in for the phone's
  own, and Enter; then Undo, Redo and a tap on empty canvas.
- **Immediate result:** Add link opened a textbox named "Type or paste your link here" beside a
  Link to object button (raw ARIA) [O]. After Enter the element stored a link whose origin is
  `https://example.com` and whose path is `/planewright-r11` (`47-link`), and the page showed it as
  a link with Edit, Link to object and Remove buttons (raw ARIA) [O].
- **State and related effects:** the element stayed selected (`47-link`) [O]; no request to the
  link's origin, or any other, was written after the load (netlog) [O].
- **Persistence:** read from local storage [O].
- **Undo/redo:** one Undo removed the linked rectangle itself, leaving nothing selected, and Redo
  restored the rectangle without its link (`47-link-undo`, `47-link-redo`; s54, s56) [O]; that the
  link edit is not recorded in the history is [H].
- **Edge cases:** Link to object, Edit, Remove and following the link: Not observed (R-11); the
  link was never followed.
- **Desktop/mobile:** links on desktop: Not observed (R-09).
- **Reproduction:** scenario 47 (s54, s56), right after 46.
- **Confidence:** [O] high (s54 and s56 identical).
- **Limitations:** one URL, on a reserved example domain, typed with the keyboard; the probe
  keeps a link's origin and path only (R-11).

## Style

### B-20 Style changes apply to the selection and become defaults

- **Initial state:** rectangle selected after B-17's undo.
- **Action:** choose stroke red (`#e03131`), background light red (`#ffc9c9`) and sloppiness
  "architect" by coordinate clicks in the panel.
- **Immediate result:** the rectangle updates; later probes show roughness 0 [O].
- **State and related effects:** elements created afterwards inherit stroke `#e03131`,
  background `#ffc9c9` and roughness 0 (the arrow of `04-arrow-bound`) [O].
- **Persistence:** read from local storage [O]; the `currentItem…` defaults are in the saved app
  state [O].
- **Undo/redo:** Not observed (R-52).
- **Edge cases:** see B-21 for clicks that missed after the panel reflowed.
- **Desktop/mobile:** on mobile (scenario 32, s26 and s31), each change applied to the selected
  rectangle: Stroke width thin and extra bold gave stroke widths 1 and 4, Stroke style dashed and
  dotted, Sloppiness architect and cartoonist roughness 0 and 2, Edges sharp roundness none, the
  Opacity slider dragged to its middle opacity 50, Red in the Stroke colour popover `#e03131` and
  Yellow in the Background popover `#ffec99` with fill `solid`; a rectangle drawn next had all of
  them (`32-next-shape`) [O]. Hachure (Alt-Click) and Cross-hatch, picked by name after a
  background was set, gave fill `hachure` and `cross-hatch` (scenario 35; s34, s36) [O]. The
  second of the five buttons named Shade, after Blue, gave stroke `#a5d8ff`, and `123abc` typed
  into the hex box with Enter gave `#123abc` (`40-shade`, `40-hex`; s41, s45) [O]; each became
  the default stroke colour [O, raw timelines], and the text, stroke and arrow drawn after Blue in
  s37 took it [O].
- **Reproduction:** scenario 04 (s1, s6); scenarios 32 (s26, s31), 35 (s34, s36) and 40 (s41,
  s45).
- **Confidence:** [O] high (on mobile, s26 and s31, s34 and s36, and s41 and s45, identical).
- **Limitations:** desktop coordinate clicks, not named controls (R-39); on mobile the style
  radios have no accessible name, so they were touched at the button centres of s22's capture,
  and only the colours above, one other shade and one typed code were picked (R-39).

### B-21 Panel layout is dynamic

- **Initial state:** rectangle selected, transparent background.
- **Action:** choose a background colour; then clicks at fixed coordinates.
- **Immediate result:** a Fill row appears and shifts every row below it down, so clicks meant
  for stroke width, stroke style, edges and layers landed elsewhere. Their results are not used
  as findings [O].
- **State and related effects:** the rectangle's roundness stayed 3 throughout, its value from
  creation (B-01), not an effect of these clicks [O]. Sections by element type (s6 and s10 dark
  ARIA, `dark-08`, `dark-10`, `dark-11`):
  - rectangle: stroke, background, fill, stroke width, stroke style, sloppiness, edges, opacity,
    layers, actions;
  - arrow: "Arrow type" (3 options) and "Arrowheads" replace edges, and "Edit arrow" joins the
    actions;
  - text: "Font family", "Font size" (4) and "Text align" (3); no stroke width, stroke style,
    sloppiness or edges.
- **Persistence:** the layout itself is not stored; the background colour that triggers it is
  saved with the element (B-20) [O].
- **Undo/redo:** undo of the background change: Not observed (R-52).
- **Edge cases:** at 1280×720 the panel is cut off at "Actions"; a wheel over it scrolls it
  (`dark-09-panel-rect-scrolled`) [O].
- **Desktop/mobile:** mobile uses a compact bar instead (summary table below). For a selected
  rectangle its style popover holds the groups Stroke width, Stroke style, Sloppiness and Edges,
  whose radios have no accessible name, and the Opacity slider; for an arrow, the same without
  Edges; once the rectangle has a background, a Fill group with the named buttons Hachure
  (Alt-Click), Cross-hatch and Solid comes first. The Actions popover holds Layers and Actions for
  one element, and adds Align (six buttons) and Group selection for two, and Distribute
  horizontally and vertically for three (s22, s25, s26, raw ARIA) [O]. For a text the bar holds
  Stroke, a second Stroke whose popover holds only Opacity, Show font picker (Excalifont in the
  scene; Comic Shanns, Lilita One and Nunito available) and Text align, which holds a Font size
  group of four and a Text align group of three unnamed radios, and Actions once the text is
  selected; for the Draw tool and a freehand stroke, Stroke, Background and a second Stroke
  holding Stroke width, Pressure and Opacity, and Actions once the stroke is selected; a selected
  elbow arrow's bar has no Edit arrow (s37, s40, s41, s44–s47, raw ARIA) [O]. By the stored
  results of touching them (scenario 45; s53, s55, s57), the Font size radios are S, M, L and XL
  (16, 20, 28 and 36), the Text align radios left, centre and right, a freehand stroke's Stroke
  width radios 0.5, 1 and 2, and its Pressure radios constant and variable stroke options (B-05,
  B-06) [O]. In Edit arrow the bar holds Stroke, a second Stroke and Actions, whose popover is the
  same as the arrow's (s54–s57, raw ARIA) [O].
- **Reproduction:** scenarios 04 (s1, s6) and 15 (s6, s10); on mobile 28 (s22), 36 (s37), 39–41
  (s40, s41, s44–s47), 45 (s53, s55, s57) and 46 (s54, s56).
- **Confidence:** [O] high for the Fill row (s1, s6); in s10, whose rectangle kept a
  transparent background, `dark-08` has no Fill group. High for the text section (`dark-11`
  identical in s6 and s10); medium for the rectangle and arrow sections, whose s10 snapshots
  differ from s6 in the Fill group and in which Sloppiness radio is checked, following the
  styles in use (raw comparisons).
- **Limitations:** desktop light-theme per-type sections not captured (R-10); on mobile the
  radios have no accessible name, so they were touched at measured centres and which one is which
  is read from the stored results [I] (R-10).

## Grouping, layers, alignment

### B-22 Group and ungroup

- **Initial state:** rectangle and ellipse selected (B-11).
- **Action:** Ctrl+G; later Ctrl+Shift+G.
- **Immediate result:** both get one shared group id (`group`); after ungrouping both have none
  and 2 stay selected (`ungroup`) [O].
- **State and related effects:** a click on one member then moves the group as a unit (B-15)
  [O].
- **Persistence:** read from local storage [O].
- **Undo/redo:** undoing the move keeps the group (`undo-move`). On mobile, Undo straight after
  Group selection removed the group and Redo restored it, the 3 staying selected (`34-group-undo`,
  `34-group-redo`; s33, s35) [O]. Ctrl+Z after Ctrl+G on desktop: Not observed (R-49).
- **Edge cases:** on mobile a tap on a member's stroke selected the whole group of 3
  (`31-group-tap`; s25, s30) [O]. Nested groups and selecting inside a group: Not observed
  (R-49).
- **Desktop/mobile:** on mobile, Group selection in the Actions popover gave 3 box-selected
  rectangles one group each, and Ungroup selection removed it, the 3 staying selected
  (`31-grouped`, `31-ungrouped`; s25, s30) [O], and two box-selected rectangles one group
  (`46-grouped`; s54, s56) [O].
- **Reproduction:** scenario 03 (s1, s2, s6); scenarios 31 (s25, s30), 34 (s33, s35) and 46 (s54,
  s56).
- **Confidence:** [O] high.
- **Limitations:** two elements (R-49).

### B-23 Alignment and distribution

- **Initial state:** desktop: two elements whose top edges are both at y=240. Mobile (scenario
  31): rectangles A `[40,120,120,80]`, B `[100,180,120,80]` and C `[160,240,120,80]`, box-selected;
  scenario 34: a row of 60×60 rectangles at x 20, 100 and 300 and a column of 60×40 rectangles at
  y 260, 320 and 520, each box-selected.
- **Action:** desktop: Ctrl+Shift+Up. Mobile: Align left, Align top, Center vertically,
  Distribute horizontally and Distribute vertically in the Actions popover.
- **Immediate result:** desktop: no change (`align-top`) [O], which does not test alignment.
  Mobile: Align left put every x at 40, the leftmost edge; Align top every y at 120, the topmost;
  Center vertically every y at 180, centring all three on the selection's middle (y 220)
  (`31-align-left`, `31-align-top`, `31-center-vertically`; s25, s30) [O]. Distribute
  horizontally moved the row's middle rectangle from x 100 to 160 and Distribute vertically the
  column's from y 320 to 390, making both gaps equal (80 and 90) while the outer elements stayed
  (`34-distribute-horizontally`, `34-distribute-vertically`; s33, s35) [O]. On a rectangle
  `[40,120,120,80]`, a diamond `[100,240,120,80]` and an ellipse `[160,360,120,80]` (scenario 38),
  Align right put every x at 160, so every right edge at 280, the rightmost; Align bottom every y
  at 360, every bottom edge at 440; and Center horizontally every x at 100, centring all three on
  the selection's middle (x 160) (`38-align-right`, `38-align-bottom`,
  `38-center-horizontally`; s39, s43) [O].
- **State and related effects:** on mobile the selection stayed 3 after each, and the element
  order did not change [O].
- **Persistence:** read from local storage [O].
- **Undo/redo:** on mobile one Undo after each alignment and distribution that moved an element
  restored every position, and Redo re-applied Distribute horizontally (`31-align-left-undo`,
  `31-align-top-undo`, `31-center-vertically-undo`, `34-distribute-horizontally-undo`,
  `34-distribute-horizontally-redo`, `34-distribute-vertically-undo`, `38-align-right-undo`,
  `38-align-bottom-undo`, `38-center-horizontally-undo`, `46-align-left-undo`,
  `46-align-bottom-undo`) [O]. On desktop: Not observed (R-51).
- **Edge cases:** on mobile, Distribute horizontally on three rectangles already spaced evenly
  (scenario 31) changed nothing [O]; the alignments of scenario 38 treated a diamond and an
  ellipse by their boxes, like the rectangle [O]. A group of two rectangles, `[40,330,100,50]`
  and `[200,400,100,50]`, box-selected with a wider rectangle `[20,500,320,60]` (scenario 46),
  moved as one unit: Align left put the group's left edge at 20, the members at x 20 and 180, and
  Align bottom its bottom edge at 560, the members at y 440 and 510, the wider rectangle staying in
  place (`46-align-left`, `46-align-bottom`; s54, s56) [O].
- **Desktop/mobile:** desktop alignment of shapes that are not aligned: Not observed (R-51).
- **Reproduction:** scenario 03 (s1, s2, s6); scenarios 31 (s25, s30), 34 (s33, s35), 38
  (s39, s43) and 46 (s54, s56).
- **Confidence:** [O] high for the mobile results (each in two sessions, identical) and for
  desktop's "no change".
- **Limitations:** on mobile three elements of one size per command, or one group of two with
  one rectangle, at zoom 1 (R-51).

### B-24 Layer order

- **Initial state:** desktop: rectangle selected (scenario 04). Mobile (scenario 31): A, B and C
  of B-23, stored in that order, overlapping in pairs; A selected by a tap on its left stroke.
- **Action:** desktop: a coordinate click meant for "Bring to front". Mobile: Bring forward, Bring
  to front, Send backward and Send to back in the Actions popover, each after a fresh selection
  of A.
- **Immediate result:** desktop: element order unchanged (`04-bring-to-front`); the click missed
  after the panel reflow (B-21). Mobile: the stored order became B, A, C; then B, C, A; then B, A,
  C; then A, B, C (`31-bring-forward`, `31-bring-to-front`, `31-send-backward`,
  `31-send-to-back`; s25, s30) [O].
- **State and related effects:** on mobile no element moved and A stayed selected; the Actions
  popover stayed open after Bring forward (`m31-01-after-bring-forward`, raw ARIA) [O]. That the
  stored order is the drawing order is [I].
- **Persistence:** read from local storage [O].
- **Undo/redo:** on mobile Undo after Send to back gave B, A, C again and Redo A, B, C
  (`31-layer-undo`, `31-layer-redo`) [O]. On desktop: Not observed (R-50).
- **Edge cases:** layer commands on several or grouped elements: Not observed (R-50).
- **Desktop/mobile:** desktop layer commands: Not observed (R-50).
- **Reproduction:** scenario 04 (s1, s6); scenario 31 (s25, s30). The four layer commands are
  listed in the panel and the element context menu (B-34).
- **Confidence:** [O] high for mobile (s25 and s30 identical); [U] on desktop.
- **Limitations:** on mobile one element moved among three (R-50).

## History

### B-25 Undo and redo

- **Initial state:** a fresh page; then scenes with changes.
- **Action:** Ctrl+Z and Ctrl+Shift+Z after various operations.
- **Immediate result:** undo reverses a move (B-15), a rotation (B-17), a duplicate (B-18), a
  paste (B-26) and dot creation (B-05); redo re-applies a move [O].
- **State and related effects:** Undo and Redo buttons start disabled; Undo becomes enabled after
  the first change (ARIA) [O].
- **Persistence:** history across a reload: Not observed (R-52).
- **Undo/redo:** as above.
- **Edge cases:** on desktop, undo of style, delete, group and resize, and Ctrl+Y: Not observed
  (R-52).
- **Desktop/mobile:** the mobile Undo and Redo buttons reverse and re-apply an arrow with its
  bindings (B-04), a resize and a rotation (B-16, B-17), a layer change (B-24), alignment and
  distribution (B-23) and grouping (B-22), and Undo also reverses a selection change (B-10,
  B-12) (s23–s35) [O]. Delete in the Actions popover removed a selected rectangle, Undo restored it
  selected and Redo removed it again (`46-delete`, `46-delete-undo`, `46-delete-redo`; s54, s56)
  [O]. The buttons also reverse and re-apply a text's font size and alignment, a stroke width, a
  pressure style and an Autoshape stroke (B-05, B-06), a fourth point and a deleted point (B-40)
  and a group's alignment (B-23) (s53–s57) [O]. After Add link, Undo removed the linked element
  and Redo restored it without the link (B-42).
- **Reproduction:** scenarios 03, 04, 05, 06 (s1, s2, s6); on mobile 46 (s54, s56).
- **Confidence:** [O] high.
- **Limitations:** the undo stack depth was not probed (R-52).

## Clipboard

### B-26 Copy and paste

- **Initial state:** scenario 05's end scene, scroll (90,45).
- **Action:** Ctrl+A, Ctrl+C, move the pointer to viewport (900,600), Ctrl+V.
- **Immediate result:** copies of the rectangle, its label and the arrow, whose bounding box is
  centred on the pointer's scene point (810,555); 2 selected (`06-paste`) [O].
- **State and related effects:** Ctrl+C wrote JSON text with top-level keys `type`
  (`"excalidraw/clipboard"`), `elements` and `files` (Clipboard API read, permission granted)
  [O, raw timelines only: the same shape in s1 and s6; the committed index counts the step only].
  The copied arrow lost its binding (B-13).
- **Persistence:** read from local storage [O].
- **Undo/redo:** Ctrl+Z removed the paste (`06-undo-paste`) [O].
- **Edge cases:** cut, paste of external text or images, and paste with the pointer outside the
  canvas: Not observed (R-53).
- **Desktop/mobile:** mobile: Not observed (R-53).
- **Reproduction:** scenario 06 (s1, s6).
- **Confidence:** [O] high.
- **Limitations:** the clipboard shape came from the driver, values redacted, and is in the raw
  timelines only (R-53).

### B-27 Other clipboard formats

- **Initial state:** a selected rectangle; on mobile (78) a rectangle with the Yellow background
  and a transparent one, drawn before the background was picked.
- **Action:** open the element context menu (B-34); on mobile, by long presses, Copy styles on the
  yellow rectangle, then Paste styles on the transparent one.
- **Immediate result:** the menu offers "Copy to clipboard as PNG", "as SVG", "Copy styles" and
  "Paste styles" [O]. On mobile the paste gave the second rectangle the yellow background
  (`78-pasted`; s77, s78) [O].
- **State and related effects:** no clipboard permission had been granted, so that the copied
  styles are kept by the app rather than the system clipboard is [I]. The PNG and SVG items: Not
  observed (R-53).
- **Persistence:** the pasted background was read from local storage [O].
- **Undo/redo:** on mobile Undo after Paste styles brought the transparent background back and
  Redo the yellow one (`78-pasted-undo`, `78-pasted-redo`; s77, s78) [O]. The PNG and SVG items and
  desktop: Not observed (R-53).
- **Edge cases:** in s75, 75's paste went onto a rectangle that had been drawn with the same
  background, because the background picked for the first one had become the default (B-20), so
  it changed nothing (`75-pasted`) [O]. In s76, 77's long presses on its right-hand rectangle at
  (220,490) selected it but left no menu item to pick, so its paste did not run (`77-pasted`) [O];
  78 repeated 77 at 75's height. Styles between element types: Not observed (R-53).
- **Desktop/mobile:** the mobile menu offers the same four items (`m67-02-element-hold`) [O]; on
  desktop none was clicked: Not observed (R-53).
- **Reproduction:** scenario 15 (s6: `dark-07-element-context-menu`); 75 (s75, s76), 77 (s76) and
  78 (s77, s78) on mobile.
- **Confidence:** [O] medium for the listing; [O] high for Copy and Paste styles on mobile (s77 and
  s78 identical); the PNG and SVG effects [U].
- **Limitations:** the PNG and SVG items were not clicked, and the styles were pasted between two
  rectangles only (R-53).

## View

### B-36 Pan and zoom

- **Initial state:** scenario 05 after two undos: zoom 1, scroll (0,0).
- **Action:** the inputs in the table, each starting from the previous row's state.
- **Immediate result:**

  | Input                                   | Probe                  | Zoom, scroll          | Observation [O]                                                                |
  | --------------------------------------- | ---------------------- | --------------------- | ------------------------------------------------------------------------------ |
  | Wheel dy=+200 at (640,360)              | `05-wheel-down-200`    | 1, (0,−200)           | 1:1 vertical pan at zoom 1                                                     |
  | Shift+wheel dy=+200                     | `05-shift-wheel-200`   | 1, (−200,−200)        | horizontal pan                                                                 |
  | Ctrl+wheel dy=−100 at (640,360)         | `05-ctrl-wheel-up-100` | 1.1, (−258,−233)      | the scene point under (640,360), (840,560), stays put within rounding          |
  | Ctrl+0                                  | `05-ctrl-0`            | 1, (−200,−200)        | back to 1, same centre point                                                   |
  | Ctrl+=                                  | `05-ctrl-plus`         | 1.1, (−258,−233)      | +0.1, same centre point                                                        |
  | Ctrl+− twice                            | `05-ctrl-minus-x2`     | 0.9, (−129,−160)      | −0.1 per press, same centre point                                              |
  | Shift+1                                 | `05-shift-1-fit`       | 1, (90,45)            | content x 340–760 centred (scroll 90); y not centred (would be 15); no zoom-in |
  | Space+drag (−100,−50)                   | `05-space-drag`        | 1, (−10,−5)           | scroll moves by the drag delta; tool unchanged                                 |
  | Hand tool drag (+50,+50)                | `05-hand-drag`         | 1, (40,45)            | scroll moves by the drag delta                                                 |
  | Mobile pinch, fingers 90 → 190 px apart | `m-pinch-out`          | 2.111111, (−132,−263) | zoom equals 190/90 in s3, s7 and s11; scrollX −135 in s3 and s11               |
  | Mobile two-finger pan 80 px up          | `m-two-finger-pan`     | 2.111111, (−132,−301) | scrollY −38 = −80/zoom, rounded, in s3, s7 and s11                             |

- **State and related effects:** zoom and scroll are saved in the app state [O]. No element
  changes [O].
- **Persistence:** scroll (90,45) survived a reload (B-30) [O]. On mobile, zoom 0.875 (s16) and 1.5
  (s17, s19, s21) survived a reload (B-30) [O]; zoom across a desktop reload: Not observed, because
  zoom was 1 before the reload (R-54).
- **Undo/redo:** viewport changes are not elements; whether undo touches them: Not observed
  (R-52).
- **Edge cases:**
  - **Pointer anchoring is not established.** The Ctrl+wheel probe had the pointer at
    (640,360), the viewport centre, so pointer-anchored and centre-anchored zoom give the same
    numbers. An earlier version of this entry and of the backlog said Ctrl+wheel zooms around
    the pointer; that is [U] (R-48).
  - Shift+1's vertical rule and whether it ever zooms above 100%: [U]; one scene only (R-48).
  - Pinch zoom followed the finger-distance ratio for six more ratios (2, 0.5, 1.5, 1/3, 0.2 and 5)
    in scenario 26 (s18, s20: `26-p01` … `26-p13`) [O], within limits of 0.1 and 30, which held in
    both sessions [O]. That two-finger pan always moves by delta / zoom is [H] from one input,
    repeated in three sessions (R-48).
  - The pinch anchor: across the pinch axis the fixed point was the finger midpoint within 2.2 px;
    along it, 34.5 to 111.5 px from the midpoint toward the second finger, up to 9.3 px apart
    between s18 and s20 for the same pinch [I, from the committed scroll], which fits the spread of
    scrollX after scenario 10's pinch (−135 in s3 and s11, −132 in s7). At a limit a pinch still
    moved the scroll along its axis, by 180 or 200 px of the view at zoom 0.1 [O]. The cause is [H]
    ([limitations](limitations.md#environment-limits)).
  - Desktop zoom limits, step sizes outside 0.9–1.1, PgUp/PgDn and the zoom buttons: Not observed
    (R-48).
- **Desktop/mobile:** as in the table; mobile has no zoom buttons (F-28). On mobile, run from the
  command palette by typing a command's name and pressing Enter with one rectangle selected, Zoom
  to selection zoomed to 2.85, Reset zoom went back to 1 with the scroll at (15,29), and Zoom to fit
  all elements kept zoom 1 and moved the scroll, to (35,101) with three rectangles (s74), (15,101)
  with five (s75) and (15,36) with six (s76) (`71-*`) [O].
- **Reproduction:** scenario 05 (s1, s2, s6), scenario 10 (s3, s7, s11), scenario 26 (s18, s20)
  and scenario 71 (s74–s76).
- **Confidence:** desktop rows [O] high (s1 and s6 identical; s2 differs from Shift+1 on because
  05 ran straight after 03 there, see the [research README](../../research/excalidraw/README.md#scenario-order-and-dependencies)).
  Mobile rows [O] high for zoom and the pan delta (s3, s7 and s11); scrollX after the pinch differs
  between sessions (see the cross-session replay above). The scenario 26 ratios and limits are [O]
  high (s18 and s20 agree in every zoom); the anchor along the pinch axis is [O] medium, because the
  two sessions differ.
- **Limitations:** the "scene point stays put" reading uses the convention
  scene = viewport / zoom − scroll, which also makes the wheel rows consistent [I] (R-48).

### B-37 View modes and toggles

- **Initial state:** scenario 05's scene, zoom 1, scroll (40,45).
- **Action:** Alt+Z, Alt+R, Ctrl+' and Alt+S, each toggled on and off again; theme by Alt+Shift+D
  or the menu radio.
- **Immediate result:**

  | Toggle        | Visible effect                                                                                    | Key in the saved app state (raw) |
  | ------------- | ------------------------------------------------------------------------------------------------- | -------------------------------- |
  | Zen (Alt+Z)   | Hides the menu, share, library, undo/redo, zoom in/out and help; keeps the toolbar and zoom reset | yes (`zenModeEnabled`)           |
  | View (Alt+R)  | Hides the toolbar and editing UI; keeps zoom, share, help and the promotion link                  | **no** key observed              |
  | Grid (Ctrl+') | Draws a grid (`view-03-grid`)                                                                     | yes (`gridModeEnabled`)          |
  | Snap (Alt+S)  | Flag toggles                                                                                      | yes (`objectsSnapModeEnabled`)   |
  | Theme         | Switches light/dark                                                                               | yes (`theme`)                    |

- **State and related effects:** zoom and scroll unchanged by each toggle (`05-zen-on` …
  `05-snap-toggled`) [O].
- **Persistence:** the theme is saved locally as `theme` in the committed probes [O]. An
  `excalidraw-theme` key was already present at the first, light, load (REA initial inspection,
  values redacted), so that it stores the choice is [I]. The zen, grid and snap keys in the table were read from the raw
  timelines only [O, raw only]; no view-mode key was seen there, so view mode is probably not
  saved [I, raw only]. No desktop session reloaded while dark or with zen, grid or snap on: s1's last
  reload and s6's scenario 06 reload both came before `07-dark`, and nothing after 07 reloads.
  On desktop whether the theme or any mode survives a reload: Not observed (R-19). On mobile the
  dark theme, zen mode, snap to objects, Overlap and Mouse were all kept across a reload
  (`65-before-reload`, `65-after-reload`, s71, s72), and view mode, which stored no key, was gone
  after the next one (`65-view-reloaded`) [O].
- **Undo/redo:** on mobile, with a deselecting tap as the last history step, Undo after Toggle grid
  and after the Dark mode radio left the grid and the theme as they were and selected the rectangle
  again, so a toggle is not an undo step, nor is a theme change (`63-grid-undo`, `63-dark-undo`,
  s71, s72) [O]. On desktop: Not observed (R-19).
- **Edge cases:** on mobile, Snap to objects turned on while the grid was on turned the grid off
  (`65-snap`); Tool lock kept the Rectangle tool over two drags, read 800 ms after each, left the
  new rectangles unselected and stayed on after Selection was picked (`63-locked-2`,
  `63-selection`); with Arrow binding off, an arrow drawn between two rectangles bound neither end
  (`64-arrow-unbound`) (s71, s72) [O]. The same 17 px touch drag of a rectangle's top stroke left
  its top 3 px below another's with Snap to objects off and aligned the two tops with it on
  (`76-moved-free`, `76-moved-snap`; s75–s78) [O]. With Snap to midpoints on, as stored by default,
  an arrow drawn to 6 px beside the midpoint of a rectangle's bottom stroke, and 6 px below it,
  was 5.5 wide, so its end lay within 0.5 px of the midpoint's vertical (the capture shows it
  slanted onto the midpoint), and with it off it went straight up (0 wide); both bound their end (`72-arrow-first`, `72-arrow-second`;
  s74–s78) [O]. In 72 a drag from the middle of a selected rectangle's left stroke, where a resize
  handle sits, moved nothing (`72-moved-free`, `72-moved-snap`) [O]. On desktop the snaps' effect:
  Not observed (R-19).
- **Desktop/mobile:** mobile theme in B-28. On mobile the toggles sit in the main menu's Preferences
  submenu, which stays open after one is picked; zen mode left every named control of the first load
  and the menu trigger in place, the welcome screen aside, and view mode left only the unnamed menu
  trigger and an unnamed button with a pencil where Library was (raw ARIA and captures, s71, s72)
  [O].
- **Reproduction:** scenarios 05 and 07 (s1, s6); 63–65 (s71, s72); 72 (s74–s78) and 76 (s75–s78).
- **Confidence:** [O] high for the visible effects and the unchanged zoom and scroll (s1 and s6),
  and for the mobile toggles, Undo and reload reads (s71 and s72 identical).
- **Limitations:** visible effects from screenshots and ARIA outside Git; for s1 and s6 the zen,
  grid, snap and view-mode keys come from raw timelines and are not in the committed probes, while
  the s71 and s72 summaries keep the stored flags (R-19).

### B-28 System colour scheme

- **Initial state:** mobile, light theme, default settings.
- **Action:** emulate `prefers-color-scheme: dark`; then choose Dark in the main menu.
- **Immediate result:** emulation did **not** switch the theme (`m-dark-scheme-emulated`);
  choosing Dark did (`m-dark-via-menu`) [O].
- **State and related effects:** `theme` in the saved app state follows the menu choice [O].
- **Persistence:** read from local storage [O]; the dark theme was kept across a mobile reload (s16;
  `65-after-reload`, s71, s72) [O]; on desktop: Not observed (R-19).
- **Undo/redo:** on mobile Undo after the Dark mode radio kept the dark theme, so a theme change is
  not an undo step (`63-dark-undo`, s71, s72; B-37) [O]; on desktop: Not observed (R-19).
- **Edge cases:** on mobile, System mode picked under an emulated dark scheme stored the theme as
  dark, and emulating light and then dark again turned it light and dark with no input
  (`64-system-dark`, `64-system-light`, `64-system-dark-again`, s71, s72) [O]. The "System" radio on
  desktop: Not observed (R-26).
- **Desktop/mobile:** desktop dark by shortcut and menu (B-37); desktop emulation: Not observed
  (R-26).
- **Reproduction:** scenario 10 (s3, s7, s11); 64 (s71, s72).
- **Confidence:** [O] high; the System mode reads are high too, both runs identical.
- **Limitations:** default settings only (R-26); the colour scheme was emulated, not a phone's own
  setting (limitations).

### B-28a Export defaults follow the theme

- **Initial state:** dark theme.
- **Action:** open the Export image dialog.
- **Immediate result:** "Dark mode" is already checked (desktop `dark-05-export` in s1 and s6;
  mobile `m12-dark-export` in s7 and s11) [O].
- **State and related effects:** Not observed (R-16).
- **Persistence:** Not observed (R-16).
- **Undo/redo:** not applicable (opening the dialog changes no scene state).
- **Edge cases:** unchecking it and exporting: Not observed (R-16).
- **Desktop/mobile:** same on both [O].
- **Reproduction:** scenarios 07 (s1, s6) and 14 (s7, s11).
- **Confidence:** [O] high.
- **Limitations:** the export itself could not complete headless (B-32, R-16).

## Eraser

### B-29 Eraser

- **Initial state:** scenario 04's scene; a freedraw path drawn just before.
- **Action:** press P and draw (400,550)…(550,580); press E and drag (470,520)→(480,620);
  press Escape; click twice on the canvas.
- **Immediate result:** the scene after the eraser drag has no freedraw element (`04-eraser`)
  [O]. That the path had first created one is [I] from B-05; no probe ran in between.
- **State and related effects:** after Escape the tool was **freedraw**, the tool before the
  eraser, and the clicks made dots (`diag-after-eraser`) [O]. That Escape returns to the
  previous tool in general is [H] (R-44).
- **Persistence:** read from local storage [O].
- **Undo/redo:** on mobile, after erasing a rectangle drawn just before and still selected, Undo
  brought it back, selected, and left the Selection tool active, and Redo erased it again
  (`62-erased-free-undo`, s71–s73) [O]; after an erase with nothing selected, Undo brought back the
  element and its bindings with the Eraser still active, and Redo removed them again
  (`66-erased-target-undo`, s72, s73) [O]. That the tool follows the selection Undo brings back is
  [I]. On desktop: Not observed (R-44).
- **Edge cases:** on mobile, erasing an arrow's end target removed it and the arrow's end binding,
  keeping the start binding (`66-erased-target`), and erasing the arrow emptied both rectangles'
  bound lists (`66-erased-arrow`); Undo restored each (s72, s73) [O]. A stroke across a locked
  rectangle left it in place, still locked (`75-locked-erase`; s75, s76; B-19) [O]. Bound and locked
  targets on desktop: Not observed (R-44).
- **Desktop/mobile:** on mobile a one-finger stroke with the Eraser across an element's edge erased
  it (`62-erased-free`, s71–s73), and Escape with the Eraser active left the Selection tool
  (`66-escape`, s72, s73) [O].
- **Reproduction:** scenarios 04 and 04b (s1, s6); 62 and 66 (s71–s73); 75 (s75, s76).
- **Confidence:** [O] high for the removal and the tool after Escape; on mobile high, 62 run in
  three fresh profiles and 66 in two, with identical probes.
- **Limitations:** no probe before the desktop eraser (R-44); in s71 the strokes of 62 after its
  first Undo ran with the Selection tool and erased nothing.

## Persistence

### B-30 Local save and reload

- **Initial state:** empty canvas (scenario 13) or scenario 06's scene.
- **Action:** draw a shape and read local storage at fixed delays; reload the page.
- **Immediate result:** the scene is written to `localStorage["excalidraw"]` as an array of
  elements and the UI state to `localStorage["excalidraw-state"]` [O]. Save timing (scenario 13,
  three shapes per session; offsets from the first scene read after the drag step returned): in
  s6, each new shape was absent at 0, 114–120 and 224–236 ms and present at 338–376 ms and
  later, in 3 of 3 trials [O]. In s9, a second fresh profile on a later build, it was absent at
  0 and 116–138 ms in 3 of 3 trials, absent at 244–245 ms in 2 and already present at 255 ms in
  1 (13a), and present at 368–371 ms and later in 3 of 3 [O]. The pointer-up time was not
  recorded, so in 5 of the 6 trials the save came more than about 224 ms after pointer-up and in
  the sixth more than about 138 ms; the upper bound is not known. A debounce of about 300 ms
  is [H].
- **State and related effects:** the reload in scenario 06 restored the identical element list
  and scroll (90,45) (`06-image-inserted` → `06-after-reload`, s1 and s6) [O]. In s6 the
  9-element scene of `02-all-shapes` was read again, identical, as `diag-rect-before` after the
  `00b` and `00c` reloads that ran between them [O]; scroll was not read there. The later `00b`
  reload, between scenarios 13 and 03, has no scene probe after it before 03 clears the canvas.
- **Persistence:** after Ctrl+A and Delete the stored array is empty (`12-end`, `13-end`; s6, s8
  and s9): the
  probe counts every stored element, including flagged ones, so deleted elements are dropped
  from storage [O].
- **Undo/redo:** on mobile, the Undo button was enabled before the reloads of s16, s17, s19 and
  s21 and disabled after them, so the history was not kept [O, raw ARIA]; on desktop, history across a reload: Not observed
  (R-52).
- **Edge cases:** zoom and selection across a desktop reload (zoom was 1, nothing selected),
  several tabs and storage quota: Not observed (R-54).
- **Desktop/mobile:** mobile reload (s16, scenario 24 after 10, 22 and 16): the document came from
  the service worker, the stored scene (22 elements) and app state (60 keys: dark, zoom 0.875, the
  same scroll and tool, nothing selected) read the same before and after (`24-before-reload`,
  `24-after-reload`) [O], and the two captures show the same view but for the Undo button
  [O, raw captures and ARIA]. In s17, s19 and s21, 24 ran after 27, which pinched to zoom 1.5 and
  left a newly drawn rectangle selected: the stored scene (3 elements), the selection (1 element,
  with the same id on both sides [O, raw timeline]), zoom 1.5 and the scroll read the same after the
  reload, whose document again came from the service worker [O], and the captures show the same view
  with the selection's handles but for the Undo button [O, raw captures and ARIA]. Scenario `09b`
  ran first in s68 and s69, after 60: its reload, again from the service worker, kept every
  emulated metric at its assertion, and 50 then read 60's two rectangles (`50-online`) [O].
- **Reproduction:** scenario 13 (s6, s9: `13a-t0` … `13c-t1500`, `13-end`); scenario 06 (s1,
  s6); scenario 24 (s16; after 27 in s17, s19 and s21); scenario 09b, after 60 (s68, s69).
- **Confidence:** [O] high for the scenario 06 reload and for deletion (s1 and s6; deletion also in
  s8 and s9); [O] medium for the timing: s6 and s9 differ at the third read of one of six trials,
  and an s1 timing reading is not in the committed index; [O] high for the mobile reload with a
  selection at zoom 1.5 (s17, s19 and s21) and medium for s16's reload of a larger scene (one
  session).
- **Limitations:** `excalidraw-state` keeps 60 keys (raw count); the read cadence bounds the save
  time only to the 100–150 ms gaps between reads (R-54).

### B-31 Storage keys

- **Initial state:** after the first load (s1, and s8–s11 with mobile in s11) and during
  scenario 13 (s6).
- **Action:** REA page inspection and driver storage probes, values redacted.
- **Immediate result:** `localStorage`: `excalidraw`, `excalidraw-state`, `excalidraw-theme`,
  `i18nextLng`, `version-dataState`, `version-files`. `sessionStorage`: empty. IndexedDB:
  `excalidraw-library-db`, `excalidraw-ttd-chats-db`, `files-db`. Cache Storage: the Workbox
  precache only. These are the committed inventories of the first load in s1 and in each of
  s8–s11, identical in all five, mobile included [O]. Later inspections held more caches: 2 in
  s6 (`ev_13a4756f`), 3 at a later s1 inspection and 3 at the end of s11's window during
  scenario 14, while the desktop R-76 windows kept 1; the counts are in
  `evidence/rea-windows.json` [O]. From the raw REA record only: s6 also listed
  `workbox-expiration` in IndexedDB, and its 2 caches were the precache and `fonts` [O, raw
  only].
- **State and related effects:** key names only.
- **Persistence:** these are the persistent stores.
- **Undo/redo:** not applicable (an inventory read changes nothing).
- **Edge cases:** contents of `files-db` and the library database: Not observed (R-45, R-15).
- **Desktop/mobile:** the mobile first-load inventory (s11) is the same as on desktop [O];
  inventories after interaction on mobile: raw only (R-61).
- **Reproduction:** `evidence/rea-inspect-initial.summary.json` (s1 first load) and
  `evidence/rea-inspect-initial-<session>.summary.json` (s8–s11 first loads). The s6, later s1
  and R-76 window storage names are not in a committed file: `evidence/rea-windows.json` keeps
  only their cache counts.
- **Confidence:** [O] high for the first-load inventory: identical in five committed
  inventories (s1 and s8–s11), each from a fresh profile and across a build change. Medium for
  the stores after interaction, which differ from it in IndexedDB and Cache Storage and whose
  names are raw only.
- **Limitations:** values are redacted by design; the storage names after interaction (s6, later
  s1, the R-76 windows and driver reads) are raw only (R-61).

## Import, export and collaboration

### B-32 Export and save

- **Initial state:** a scene; headless Chromium.
- **Action:** Export to PNG and to SVG from the dialog, Ctrl+S, and Save to….
- **Immediate result:** no download event and no in-page UI [O]. Only s6 recorded failed steps;
  s1 ran scenario 06 too, but its failures were not recorded (see limitations).
- **State and related effects:** Not observed (R-46).
- **Persistence:** Not observed (R-46).
- **Undo/redo:** not applicable (no export or save completed).
- **Edge cases:** File System Access identifiers are in the bundle [S]; a native save picker,
  invisible headless, is [H], medium. The file formats: [U] (R-46).
- **Desktop/mobile:** mobile export: dialog only (B-28a); exporting: Not observed (R-46).
- **Reproduction:** scenario 06 (s6: 3 failed `download` steps and 1 failed `fileChooser` step in
  `evidence/sessions.json`).
- **Confidence:** [O] medium for the absence of events: one session with recorded failures.
- **Limitations:** headless only (R-18).

### B-33 Guest collaboration lifecycle

- **Initial state:** a scene, no session.
- **Action:** Live collaboration → Start session; Escape; Stop session.
- **Immediate result:** within about 5 s the URL gains `#room=<20 chars>,<22 chars>` (s1, s6)
  [O, high]. The dialog shows an editable "Your name" with a random two-word name, the link,
  Copy link, a QR code and Stop session [O, high].
- **State and related effects:** the share button's accessible name becomes the participant
  count ("1"); a Laser pointer button joins the toolbar and an avatar initial appears, also with
  the dialog closed in s6 [O, high]. One WebSocket and Firebase requests start (network
  analysis) [O].
- **Persistence:** Not observed (R-55).
- **Undo/redo:** undo during a session: Not observed (R-55).
- **Edge cases:** Escape did not dismiss the dialog in either session [O]. Stop session is [U]:
  an early role click timed out in s6 (recorded) and, by the earlier documents, in s1 (not
  recorded); in s6 the reopened dialog's Stop session click
  reported success, but 2.5 s later the fragment and the dialog were still present
  (`collab-04-stopped`); in s1 a native-dialog attempt left the page unresponsive to the driver
  (R-55).
- **Desktop/mobile:** mobile: pre-session dialog only (s7); a session: Not observed (R-14).
- **Reproduction:** scenarios 08 and 08b (s1, s6), run last.
- **Confidence:** as marked.
- **Limitations:** one client per room; s1 captures retired; s6 captures masked (R-55).

### B-41 Export to Link

- **Initial state:** mobile, right after 09 in a fresh profile: a rectangle `[40,120,120,80]` drawn
  and deselected (scenario 44, s52).
- **Action:** Save to... in the main menu, then Export to Link, once; then Close.
- **Immediate result:** the dialog became one headed Shareable link with a Link textbox holding a
  URL of the reference origin with a `#json=` fragment, a Copy link button and a note that the
  upload is end-to-end encrypted (raw ARIA, the fragment's value redacted by the driver) [O]. The
  page's own URL kept no fragment (`url` probes) [O].
- **State and related effects:** the tap started one analytics beacon with an `event` query key
  and one POST to `https://json.excalidraw.com/api/v2/post/` (HTTP 200), 0.3 s after it, and the
  Firebase SDK chunk, served by the service worker, 0.7 s after it [I, raw netlog and timeline
  times]. One Close closed the dialog; the scenario's second Close found none and failed, as its
  description allows [O].
- **Persistence:** the stored scene, the tool and selection and the storage key inventory (6 keys,
  the same value lengths) were the same before and after (`44-drawn`, `44-after-export`,
  `44-after-close`) [O]. What the server keeps, and for how long, is [U] (R-56).
- **Undo/redo:** not applicable (the export changed no element, selection or stored key).
- **Edge cases:** Copy link, opening the link and its view: Not observed (R-56).
- **Desktop/mobile:** desktop: Not observed (R-56); scenario 20 met the verification page in s13
  and s14.
- **Reproduction:** scenario 44 (s52), once, by design.
- **Confidence:** [O] medium: one session, by design (one upload in total).
- **Limitations:** the link is a secret: the driver redacted its value in ARIA text, every capture
  was refused while a dialog was open, the clipboard was never granted and no REA call ran during
  or after the export, so REA did not observe it and no record keeps the value (R-56).

## Element context menu and confirmations

### B-34 Element context menu

- **Initial state:** a selected rectangle, dark theme (s6; in s10 on an otherwise empty
  scene); on mobile, light, a rectangle selected or not (s74–s77).
- **Action:** right-click on its stroke; on mobile also a long press of 800 ms on it.
- **Immediate result:** a list of buttons (no `menu` role), in groups: Cut, Copy, Paste / Wrap
  selection in frame / Copy to clipboard as PNG, as SVG / Copy styles, Paste styles / Add to
  library / four layer commands / Flip horizontal, Flip vertical / Add link, Copy link to object
  / Duplicate, Lock / Delete (`dark-07-element-context-menu`) [O]. On mobile the same groups
  without the four layer commands and without shortcut text, after a long press and after a right
  click alike (`m67-02-element-hold`, `m68-03-element-right`; s74–s76) [O]; on a locked shape Unlock
  replaces Lock (`m75-05-locked-hold`; s75, s76) [O].
- **State and related effects:** on mobile Wrap selection in frame added a frame
  `[204,214,132,122]` round a `[220,230,100,90]` rectangle, 16 px larger on each side
  (`75-framed`), Delete removed the shape (`78-deleted-q`), and Copy styles, Paste styles, Lock and
  Unlock did what B-27 and B-19 say (s75–s78) [O]. Flip, Add to library, the links, Duplicate and
  the clipboard items: Not observed (R-09).
- **Persistence:** each mobile change was read from local storage [O].
- **Undo/redo:** on mobile Undo removed the frame, unlocked a locked shape and brought a deleted
  one back (`75-framed-undo`, `75-locked-undo`, `78-deleted-q-undo`) [O]. On desktop: Not observed
  (R-09).
- **Edge cases:** on mobile a long press on a selected rectangle opened the same menu
  (`m67-03-selected-hold`) [O]; in s76 the presses at (220,490) on 77's right-hand rectangle
  selected it and showed no menu (capture `m77-01-pasted`), while the presses at (40,490) did [O];
  why is [U]. Menu on multi-selection or groups: Not observed (R-09).
- **Desktop/mobile:** light desktop: Not observed (R-09). On mobile a long press on an unselected
  shape selected it and opened the menu (`67-element-hold`), while a long press on empty canvas
  opened no menu; the canvas menu (F-14) opened there by a right click only (`m75-01-canvas-hold`,
  `m68-01-canvas-right`) [O].
- **Reproduction:** scenario 15 (s6, s10); 67 and 68 (s74–s76), 75 (s75, s76), 77 (s76) and 78
  (s77, s78) on mobile.
- **Confidence:** [O] medium. The menu entries are identical in s6 and s10, but the snapshots
  are not: the panel behind the menu has no Fill group in s10 and another Sloppiness radio
  checked, following the styles in use (a raw comparison). By the rule applied to the secondary
  surfaces in the feature inventory, that stays medium. Effects of Duplicate are known only
  through its shortcut (B-18). On mobile [O] high: the menus and each item's effect are identical
  in the two or three fresh profiles that ran them.
- **Limitations:** no item was clicked on desktop; on mobile Flip, Add to library, the links,
  Duplicate and the clipboard items were not (R-09).

### B-35 Clear canvas confirmation

- **Initial state:** mobile dark, one rectangle.
- **Action:** main menu → "Reset the canvas", then Escape.
- **Immediate result:** a "Clear canvas" dialog with Cancel and Confirm (`m15-dark-reset-confirm`);
  Escape dismissed it [O].
- **State and related effects:** the scene kept its element (`14-end`) [O].
- **Persistence:** read from local storage [O].
- **Undo/redo:** on mobile Undo after Confirm brought every element back (`73-cleared-undo`;
  s74–s76) [O]. On desktop: Not observed (R-13).
- **Edge cases:** on mobile, light, with three or five rectangles, Confirm emptied the stored scene
  and set the scroll to (0,0) at zoom 1 (`73-cleared`; s74–s76) [O].
- **Desktop/mobile:** desktop: Not observed (R-13).
- **Reproduction:** scenario 14 (s7, s11); 73 (s74–s76).
- **Confidence:** [O] high: s7 and s11 give identical `m15-dark-reset-confirm` snapshots (a raw
  comparison) and byte-identical captures, and `14-end` keeps the element in both; s11 ran a
  later build.
- **Limitations:** mobile dark only (R-13).

## Generation features

### B-38 Mermaid to Excalidraw

- **Initial state:** mobile dark, the rectangle of scenario 10, zoom 2.11 after its pinch
  (`m-dark-via-menu`).
- **Action:** More tools → "Mermaid to Excalidraw", then Insert with the definition the dialog
  offered.
- **Immediate result:** a dialog with two tabs, "Text to diagram" (marked AI and Beta) and
  "Mermaid", selected. The Mermaid tab names the diagram types it converts, with links to their
  syntax pages, says that other types are inserted as an image, and offers an example flowchart
  in a textbox, an Insert button and a Ctrl+Enter hint (`m22-01-mermaid`) [O]. Opening it wrote
  2 aborted script requests and then 14 scripts [I, raw netlog and timeline times].
- **State and related effects:** after Insert the scene held 22 elements: the rectangle and 21
  new ones, 5 rectangles, 1 diamond, 5 arrows with bindings and 10 text labels in containers,
  none in a group (`22-mermaid-inserted`) [O]. The next probe read zoom 0.875; which step
  changed it is [U].
- **Persistence:** read from local storage [O]; in s16 the 22 elements read the same after a reload
  (B-30) [O].
- **Undo/redo:** on mobile, in light theme on an empty canvas (scenario 42), Insert added the
  same 21 elements with 11 selected, as many as are not labels (which ones is [I]), and closed the
  dialog; one Undo left the stored scene empty and Redo restored the 21 (`42-inserted`,
  `42-inserted-undo`, `42-inserted-redo`; s48, s49) [O]. Desktop: Not observed (R-63).
- **Edge cases:** Not observed (R-63): an own definition, an invalid one, a type inserted as an
  image.
- **Desktop/mobile:** desktop: Not observed (R-63; scenario 21 did not run).
- **Reproduction:** scenario 22 after 09 and 10 (s12, s16); scenario 42 after 09 (s48, s49).
- **Confidence:** [O] high for the dialog, the script requests and the inserted elements' types,
  sizes, bindings and styles: identical in s12 and s16, both fresh profiles (the dialog by a raw
  ARIA comparison); medium for the insert's position, which follows the view: in s16 every inserted
  element's x was 3.4 smaller, with the scroll after scenario 10's pinch at −132 instead of −135.
- **Limitations:** four mobile sessions, s12 and s16 in dark theme, s12 most likely with a
  landscape-primary orientation reported (limitations), and s48 and s49 in light theme; the
  dialog's links were not followed (R-63).

### B-39 Text to diagram and Wireframe to code

- **Initial state:** mobile dark, after B-38's insert.
- **Action:** More tools → "Text to diagram", then Escape; More tools → "Wireframe to code", then
  Escape.
- **Immediate result:** Text to diagram opened B-38's dialog on its own tab: a heading, two
  paragraphs naming the diagram kinds it knows, a prompt textbox and an unnamed button that was
  disabled while the box was empty (`m22-02-ttd`) [O]. Wireframe to code opened no dialog; the
  tool became `magicframe`, and Selection was no longer pressed (`m22-03-wireframe`,
  `22-wireframe`) [O]. In s49 (scenario 43, light theme, after 42) one self-authored prompt,
  typed into the prompt box and submitted with Enter, started one POST to
  `https://oss-ai.excalidraw.com/v1/ai/text-to-diagram/chat-streaming`, which the netlog wrote as
  aborted (`net::ERR_ABORTED`) 2.8 s later; 25 s after Enter the tab showed a chat with the result,
  the buttons New Chat, Menu, Insert, View as Mermaid and Delete message, a box for refining the
  diagram, an unnamed disabled button and a count of 9 requests left for the day [O, raw netlog
  and ARIA]. Insert added 20 elements, 5 rectangles, 1 diamond, 6 arrows bound at both ends and 8
  text labels in containers, with 12 selected, as many as are not labels (which ones is [I]),
  and closed the dialog (`43-inserted`) [O].
- **State and related effects:** opening Text to diagram wrote one analytics beacon [I, raw
  netlog and timeline times]; in s12 and s16 nothing was typed, so nothing was generated or sent.
  That the netlog reports the completed streamed response as aborted is [H].
- **Persistence:** the `magicframe` tool was read from local storage [O]; a reload was not
  observed (R-63).
- **Undo/redo:** on mobile one Undo after the generated insert removed exactly its 20 elements
  (`43-inserted-undo`; s49) [O]; desktop: Not observed (R-63).
- **Edge cases:** one prompt asked for no sign-in or consent [O]. Not observed (R-63): reaching
  the daily limit, a second prompt or a refinement, and a frame drawn with the Wireframe to code
  tool.
- **Desktop/mobile:** desktop: Not observed (R-63; scenario 21 did not run).
- **Reproduction:** scenario 22 (s12, s16); scenario 43 once, after 42 (s49).
- **Confidence:** [O] high for the Text to diagram tab and the `magicframe` tool: identical in s12
  and s16, both fresh profiles (the tab by a raw ARIA comparison).
- **Limitations:** scenario 22 generated nothing, by design, and scenario 43 sent one prompt in
  one session, to keep the requests to one, so the generation, its timing and its insert are
  single observations [O, medium]; the result text stays in the raw ARIA; the unnamed button has
  no accessible name (R-63).

## Keyboard, offline, layout and menu features (mobile)

These entries come from the keyboard, offline and layout batch (s58–s64) and its replays in
s65–s67, on mobile 390×844 at DPR 3 with touch unless the entry says otherwise. The keyboard is the driver's, standing in for an
external one.

### B-43 Keyboard focus and Tab order

- **Initial state:** mobile, the first load (scenario 49), or a fresh page with the Library
  button, the Selection tool, the main menu or Help used first (scenario 56).
- **Action:** Tab 30 times and Shift+Tab 4 times from the first load, then Escape (49); a click on
  Library, then Enter and Space; a click on the active Selection tool, then Tab 8 times and
  Shift+Tab twice; a tap on the main menu, then Tab 5 times and Escape; Help from the menu, then
  Tab 6 times and Escape (56). The focused element and every live region were read after each
  press.
- **Immediate result:** from the first load the focus stayed on a full-viewport container, a `DIV`
  with tab index 0, through every Tab and Shift+Tab (`49-start` to `49-escape`) [O]. After the
  click, the Library button held the focus with no ring; Enter closed the sidebar and showed a
  1 px box-shadow ring on the button, and Space changed nothing (`56-library-*`) [O]. The click on
  Selection opened its Selection and Lasso choice, and Tab and Shift+Tab moved between those two
  only, with a 2 px ring (`56-tab-*`) [O]. The main menu put the focus on its menu container,
  which 5 Tab presses never left (`56-menu-*`) [O]. Help put the focus on the first of its four
  links, and Tab went through the four links and Close and back to the first (`56-help-*`) [O].
- **State and related effects:** Escape closed the menu and the dialog and left the focus on the
  body, not on the control that had opened them [O]. No live region (`aria-live`, `status`, `alert`
  or `log`) existed at any read, so nothing was announced [O]. The container matched
  `:focus-visible` with an outline style of `none` and no box shadow, so no ring was drawn on it
  [O]; the links in Help showed the browser's own outline [O].
- **Persistence:** not applicable (moving the focus changes no stored state; the scene stayed empty
  in 49).
- **Undo/redo:** not applicable (moving the focus changes no element or history entry).
- **Edge cases:** Tab from other controls than Selection and the Library button, and a keyboard
  shortcut while a control holds the focus: Not observed (R-27).
- **Desktop/mobile:** the desktop Tab order and focus return: Not observed (R-27).
- **Reproduction:** scenario 49 (s59, s62, s65) and 56 (s62, s65).
- **Confidence:** [O] high for 49 (s59, s62 and s65 identical) and for 56 (s62 and s65 identical).
- **Limitations:** emulated mobile with a CDP keyboard and no screen reader; why Tab does not
  leave the container is [H] (a key handler of the app that keeps Tab).

### B-44 Offline start and reconnection

- **Initial state:** mobile, a fresh profile after one online load, with a rectangle
  `[60,200,160,120]` drawn and the service worker active (scenario 50).
- **Action:** the `offline` step (CDP network conditions for the page and its service workers),
  a reload while offline, a second rectangle `[60,400,160,120]` drawn offline (51), the `offline`
  step back online with a 6 s wait, then 24's online reload.
- **Immediate result:** offline, `navigator.onLine` read false (`50-offline`) [O]. The offline
  reload got HTTP 200 and the app started: its document, scripts, stylesheet, fonts, manifest and
  icons came from the service worker, and the stored rectangle was drawn (`50-offline-reloaded`)
  [O]. The analytics beacon and the error-report POST failed with
  `net::ERR_INTERNET_DISCONNECTED`; the analytics script loaded with 200 without the service
  worker, most likely from the HTTP cache [I].
- **State and related effects:** no offline indicator in ARIA or the captures [O]. With the
  conditions set by Playwright alone, `navigator.onLine` read true in the reloaded page although
  its requests still failed as offline (`50-offline-reloaded`, `51-offline`; s60, s63) [O]; that
  emulated online state does not carry over a reload [I], so the app started believing it was
  online. With the driver also setting them on its own session (s68, s69), it read false after the
  offline reload and until 51 went back online [O], and the ARIA at every offline read was
  identical to s63's byte for byte, so reading offline showed nothing more [O, raw ARIA]. Back
  online, the page made no request in the 6 s that followed, and REA's windows over 51 kept none
  [O].
- **Persistence:** the rectangle drawn offline was stored (`51-offline-drawn`) and both stayed
  after 24's online reload, which the service worker served again, with the beacon sent
  (`24-after-reload`) [O].
- **Undo/redo:** after the offline reload Undo was disabled, as after any reload (raw ARIA) [O].
- **Edge cases:** 61's repeated offline step after the reload changed nothing once the reload had
  kept the offline state (`61-reapplied`, s68, s69) [O]; a longer reconnection window: Not observed
  (R-57).
- **Desktop/mobile:** the desktop: Not observed (R-57).
- **Reproduction:** scenarios 50, 51 and 24 (s60, s63); 50, 61, 51 and 24 after 60 and 09b
  (s68, s69).
- **Confidence:** [O] high (s60 and s63 identical in all 8 shared probe rows, s68 and s69 in all 19).
- **Limitations:** Chromium's offline emulation, not a lost network; no collaboration room. In s68
  and s69 the first read came 4.5 s and 5.6 s after the offline reload, so whether the app read
  offline from its start is not known.

### B-45 Layout by viewport

- **Initial state:** mobile 390×844 portrait after 09, an empty canvas (scenarios 52 and 57).
- **Action:** live resizes on the loaded page, with no reload and 09's user agent: 19 viewports
  from 390×844 to 1366×1024, portrait and landscape, each asserted and read.
- **Immediate result:** the phone layout (tools at the bottom, Library at the top right) at
  390×844, 480×844, 500, 540 and 580×960, 844×390 and 844×450; the wide layout (the Shapes toolbar
  at the top, Canvas actions with zoom buttons, Undo at the bottom left) from 600×960 up and at
  844×520 and above (`52-*`, `57-*`) [O]. So the switch lies at a width between 580 and 600 px and
  a height between 450 and 520 px [I].
- **State and related effects:** in the wide layout the hints showed at heights of 800 px and
  more, not at 768 or less [O]; the shortcut letters and the trial banner showed at 1024×1366,
  1280×800, 1280×720, 1366×1024 and 844×520 but not at 1024×768, 1180×820, 1100×1000 or 844×600,
  which no single width or height explains [O]. The document language stayed `en` and `ltr` [O].
- **Persistence:** not applicable (a resize changes no stored state).
- **Undo/redo:** not applicable (a resize changes no element or history entry).
- **Edge cases:** the exact switch point and what shows the shortcut letters: Not observed (R-23).
- **Desktop/mobile:** a desktop client at these sizes: Not observed (R-23).
- **Reproduction:** scenario 52 (s59, s62, s65) and 57 (s62, s65).
- **Confidence:** [O] high for 52 (s59, s62 and s65 identical but for a choice popover that 56 left
  open in s62 and s65) and for 57 (s62 and s65 identical).
- **Limitations:** emulated with DPR 3, touch and a phone user agent at every size (R-23).

### B-46 Find on canvas

- **Initial state:** mobile, the self-authored words Plan at (60,300) and Planet at (60,500)
  (scenario 53).
- **Action:** Find on canvas from the main menu, Plan typed into its search box, Enter twice,
  Escape.
- **Immediate result:** a sidebar tab opened with the focus in its search box, named "Find text on
  canvas..." (`53-find-open`) [O]. Typing Plan listed both words and showed 1 / 2 results (raw
  ARIA) [O].
- **State and related effects:** Enter twice changed neither the selection nor the zoom or scroll
  (`53-find-enter-1`, `53-find-enter-2`) [O]; Escape closed the sidebar and left the focus on the
  body (`53-after-escape`) [O].
- **Persistence:** not applicable (the search changes no stored element: `53-texts` and `53-end`
  are the same).
- **Undo/redo:** not applicable (the search changes no element or history entry).
- **Edge cases:** a match outside the view and no match: Not observed (R-05).
- **Desktop/mobile:** Ctrl+F and the desktop panel: Not observed (R-05).
- **Reproduction:** scenario 53 (s61, s64, s66, s67).
- **Confidence:** [O] high (s61, s64, s66 and s67 identical).
- **Limitations:** two words, both already in view.

### B-47 Language switch

- **Initial state:** mobile, the main menu open (scenario 54).
- **Action:** Français picked in the Select language list, then English twice.
- **Immediate result:** the document language became `fr-FR` (`54-fr`) [O]. In s61 and s70 the
  labels turned French after one request for the `fr-FR` locale chunk, answered through the
  service worker (with HTTP 200 in s70's REA window); in s64 that request got HTTP 403 and the
  labels stayed English (raw ARIA, netlog, REA) [O]. English came back with no request (`54-back`)
  [O].
- **State and related effects:** the button boxes stayed where they were (`54-fr`) [O].
- **Persistence:** reload after a switch: Not observed (R-05).
- **Undo/redo:** Not observed (R-05).
- **Edge cases:** a right-to-left language: Not observed (R-05).
- **Desktop/mobile:** the desktop: Not observed (R-05).
- **Reproduction:** scenario 54 (s61, s64, s70).
- **Confidence:** [O] high (s61 and s70 identical in all 13 shared probe rows and 11 ARIA
  snapshots; s64 differs, because of the 403).
- **Limitations:** one language besides English.

### B-48 Library item added and placed

- **Initial state:** mobile, a rectangle `[20,600,60,80]` drawn and selected (scenario 58).
- **Action:** the Library button, the add tile at (136,214), Close, a deselect, the Library
  button again and a tap on the first tile at the same point.
- **Immediate result:** the add tile put the selection into the personal library and cleared the
  selection (`58-added`) [O]. The tile then placed a copy of the rectangle centred in the
  viewport, at `[165,382,60,80]`, selected (`58-placed`), and the sidebar closed by itself, so the
  next Close failed [O].
- **State and related effects:** with a selection the sidebar shows a search box, Personal Library
  and the add tile; empty, a note and the off-site Browse libraries link (raw ARIA, s61) [O].
- **Persistence:** the placed copy stayed after 09b's reload (`50-online`, s68, s69) [O]; the
  library across a reload: Not observed (R-15).
- **Undo/redo:** Undo after the add did not take it back: it removed the rectangle itself, the step
  before, so the stored scene held no element and Undo was disabled, and Redo restored it, selected
  (`60-added-undo`, `60-added-redo`) [O]. Undo after placing removed the copy and cleared the
  selection, and Redo restored it, selected (`60-placed-undo`, `60-placed-redo`) [O]. The library
  held its one item throughout (raw ARIA) [O].
- **Edge cases:** export, import and a second item: Not observed (R-15).
- **Desktop/mobile:** the desktop: Not observed (R-15).
- **Reproduction:** scenario 58 (s64, s66); scenario 60 (s68, s69).
- **Confidence:** [O] high (s64 and s66 identical, although s66 ran it without 54 before it; s68
  and s69 identical).
- **Limitations:** the tile was tapped at a point measured on s61's capture.

### B-49 Canvas background colour

- **Initial state:** mobile, after 58 in s64 and s66 (scenario 59).
- **Action:** Canvas background from the main menu, its hex box selected with Control+A and
  `ffc9c9` typed with Enter; a tap on empty canvas; Undo; Redo.
- **Immediate result:** the stored background became `#ffc9c9` (`59-typed`) [O].
- **State and related effects:** the tap on empty canvas closed the picker and deselected the
  placed rectangle (`59-closed`) [O].
- **Persistence:** read from local storage [O].
- **Undo/redo:** Undo reselected the rectangle and Redo deselected it, while the background stayed
  `#ffc9c9` (`59-undo`, `59-redo`) [O]; whether the change is recorded in the history at all is
  [H].
- **Edge cases:** a swatch instead of a typed code: Not observed (R-05).
- **Desktop/mobile:** the desktop: Not observed (R-05).
- **Reproduction:** scenario 59 (s64, s66).
- **Confidence:** [O] high (s64 and s66 identical).
- **Limitations:** one colour, typed.

## Desktop and mobile differences (summary)

All rows are [O] high (s1/s6 desktop, s3/s7 mobile) except where marked.

| Aspect               | Desktop                 | Mobile                                                      |
| -------------------- | ----------------------- | ----------------------------------------------------------- |
| Toolbar              | top, 13 buttons         | bottom, 8 buttons                                           |
| Zoom controls        | buttons, bottom left    | none visible; pinch                                         |
| Share and promo      | top right               | absent from the top bar; share via the main menu or welcome |
| Properties           | left side panel         | compact bar of 4 buttons above the toolbar                  |
| Handles              | 4 corners plus rotation | 8 handles plus rotation                                     |
| Lasso in More        | yes                     | no                                                          |
| Diamond/Ellipse/Line | toolbar                 | in the choices of the Rectangle and Arrow tools (raw ARIA)  |
