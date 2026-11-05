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
were read from the raw timelines and are **not** in the committed summary. Scene and appState
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
  s6 at the end of the desktop chain. With s6's scroll (90,45) subtracted, the three elements
  that 15 draws have the same type, box, angle and binding flags in both; their style values
  differ (the stock defaults in s10, scenario 04's styles in s6), and tool, selection, zoom and
  theme agree [O].
- s7 shares 6 labels with s3, and 2 of 6 are identical. The other 4 differ only in scrollX
  after the pinch (−135 in s3 at DPR 1, −132 in s7 at DPR 3), which carries into later labels.
- s11 shares 9 labels with s7, and 2 of 9 are identical; the other 7 differ only in scrollX
  (−135 in s11, −132 in s7), set by the pinch in scenario 10 and carried into 14's labels. s11
  shares 6 labels with s3, and 6 of 6 are identical. s7 and s11 both ran at DPR 3, so the
  scrollX difference does not follow the DPR [I].

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
  is [H]. Stored
  defaults: stroke `#1e1e1e`, background `transparent`,
  fill `solid`, stroke width 2, stroke style `solid`, roughness 1, opacity 100. Roundness type 3
  for the rectangle; 2 for ellipse, diamond, line, arrow and sticky note; none for freedraw,
  text and image [O].
- **Persistence:** the values were read from local storage, so each shape was saved [O]. Save
  timing is in B-30.
- **Undo/redo:** Not observed for drag creation (R-29).
- **Edge cases:** a drag that starts on the properties panel creates nothing (B-02).
  Shift/Alt modifiers, drags towards the top-left and very small drags: Not observed (R-31).
- **Desktop/mobile:** a one-finger touch drag (120,250)→(260,350) with the Rectangle tool gives
  `[120,250,140,100]` (`m-rect-touch`, s3, s7 and s11) [O]. Ellipse, diamond and line on mobile: Not
  observed (R-24).
- **Reproduction:** scenarios 02 (s2, s6: `02-all-shapes`), 12 (s6, s8:
  `12-after-canvas-drag`), 10 (s3, s7, s11: `m-rect-touch`).
- **Confidence:** [O] high (s2 and s6 identical; s3, s7 and s11 identical).
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
- **Undo/redo:** Not observed for arrows (R-42).
- **Edge cases:**
  - **Endpoint placement is not established.** The bound end of (a) lies 6 units outside the
    ellipse and that of (b) 5 units inside it. An earlier version of this entry said the end
    "snapped to the outline"; the probes do not support that.
  - Start binding happened at 5 units (a) and not at 15 units (b) [O]. That a distance limit
    between 5 and 15 units decides this is [H]: the two cases also differ in target size, style
    and scene.
  - Ctrl while drawing to prevent binding (listed in Help), moving a bound target, unbinding,
    the "Arrow binding" toggle and midpoint snapping: Not observed (R-42). Scenario 04 moved
    the rectangle, which was not bound to the arrow; the arrow did not change
    (`04-move-bound-rect`).
- **Desktop/mobile:** arrows on mobile: Not observed (R-42).
- **Reproduction:** scenario 02 (s2, s6: `02-all-shapes`); scenario 04 (s1, s6:
  `04-arrow-bound`).
- **Confidence:** [O] high for the stored geometry and the binding flags of both cases.
- **Limitations:** the probe keeps the arrow's origin and extent, not its points, so end
  positions are derived [I]; binding gap and focus values were not recorded (R-42).

### B-05 Freedraw

- **Initial state:** scenario 02's scene; Selection tool.
- **Action:** press P and drag a 6-vertex path (520,400)…(620,440).
- **Immediate result:** a `freedraw` element `[520,400,100,40]`, the extent of the input, with
  stroke width 1 (other shapes default to 2) and no roundness [O].
- **State and related effects:** the raw timelines show 22 stored points for 6 input vertices,
  because the driver interpolates moves; not in the committed summary.
- **Persistence:** read from local storage [O].
- **Undo/redo:** two Ctrl+Z at the start of scenario 05 removed the two dots made after the
  eraser: the next scene probe (`06-paste`) has no freedraw element [O].
- **Edge cases:** one click with the Draw tool creates a 0×0 freedraw "dot"
  (`diag-after-eraser`: `[1000,600,0,0]` and `[340,400,0,0]`) [O]. Pressure: Not observed
  (R-43).
- **Desktop/mobile:** Draw on mobile: Not observed (R-43).
- **Reproduction:** scenarios 02 (s2, s6), 04b (s1, s6), 05.
- **Confidence:** [O] high (geometry s2 and s6; dots s1 and s6).
- **Limitations:** point count and smoothing not in the committed summary (R-43).

### B-06 Text

- **Initial state:** scenario 02's scene; Selection tool.
- **Action:** press T, click (820,420), type "Hello", press Escape.
- **Immediate result:** a `text` element `[820,407.5,43.2,25]`: its left edge is at the click
  and its vertical centre on it [O].
- **State and related effects:** font size 20, font family id 5 and left alignment were read
  from the raw timelines; not in the committed summary.
- **Persistence:** read from local storage [O].
- **Undo/redo:** Not observed (R-40).
- **Edge cases:** re-edit by double-click, multiline, wrapping, an empty text on Escape and the
  font picker: Not observed (R-40).
- **Desktop/mobile:** dark desktop text: `15-text` `[910,572.5,40,25]` in s6 and
  `[1000,617.5,40,25]` in s10, the same box once s6's scroll (90,45) is subtracted [O, high].
  Text on mobile: Not observed (R-40).
- **Reproduction:** scenario 02 (s2, s6: `02-all-shapes`), scenario 15 (s6, s10).
- **Confidence:** [O] high for the geometry (s2 and s6 identical).
- **Limitations:** the width depends on the loaded font (R-40).

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
- **Undo/redo:** Not observed (R-41).
- **Edge cases:** resizing and long text: Not observed (R-41).
- **Desktop/mobile:** on mobile the Sticky note is in More tools; creating one: Not observed
  (R-41).
- **Reproduction:** scenario 02 (s2, s6: `02-all-shapes`).
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

## Selection

### B-10 Click selection

- **Initial state:** transparent rectangle `[300,200,120,100]` and ellipse `[600,200,120,100]`,
  nothing selected (`two-shapes`).
- **Action:** click inside the rectangle, then on its stroke.
- **Immediate result:** inside: 0 selected; on the stroke: 1 selected [O].
- **State and related effects:** selection is part of the saved app state
  (`selectedElementIds`) [O].
- **Persistence:** whether a selection survives a reload: Not observed (R-54).
- **Undo/redo:** whether a selection change is an undo step: Not observed (R-52).
- **Edge cases:** filled shapes and hit tolerance: Not observed (R-34).
- **Desktop/mobile:** a tap on the stroke of the rectangle selects it (`m-tap-select-stroke`,
  s3, s7 and s11) [O]; a tap inside: Not observed (R-33).
- **Reproduction:** scenario 03 (s1, s2, s6: `click-inside-transparent-rect`,
  `click-rect-stroke`); scenario 10 (s3, s7, s11).
- **Confidence:** [O] high.
- **Limitations:** one shape type and one stroke width (R-34).

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
- **Undo/redo:** whether a selection change is an undo step: Not observed (R-52).
- **Edge cases:** partial overlap and Ctrl box select: Not observed (R-33).
- **Desktop/mobile:** mobile: Not observed (R-33).
- **Reproduction:** scenario 03 (s1, s2, s6).
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
- **Undo/redo:** Not observed (R-36).
- **Edge cases:** other handles, Shift (aspect lock), Alt (from the centre), multi-element
  resize: Not observed (R-36).
- **Desktop/mobile:** mobile: Not observed (R-36).
- **Reproduction:** scenario 03 (s1, s2, s6).
- **Confidence:** [O] high.
- **Limitations:** one handle (R-36).

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
- **Desktop/mobile:** mobile: Not observed (R-36).
- **Reproduction:** scenarios 03 and 04 (s1, s2 for 03, s6).
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
- **Desktop/mobile:** the mobile Actions popover lists Duplicate; its effect: Not observed
  (R-11).
- **Reproduction:** scenario 03 (s1, s2, s6).
- **Confidence:** [O] high for offset and count.
- **Limitations:** which elements are selected (R-38).

### B-19 Lock

- **Initial state:** ellipse `[640,240,120,100]` selected.
- **Action:** Ctrl+Shift+L, then click the ellipse, then drag from it.
- **Immediate result:** `locked: true` and nothing selected (`04-lock-ellipse`); the click
  selects nothing and the drag does not move it (`04-drag-locked`) [O].
- **State and related effects:** its arrow binding is kept [O].
- **Persistence:** read from local storage [O].
- **Undo/redo:** Not observed (R-38).
- **Edge cases:** unlocking: Not observed (R-38). Ctrl+A then Ctrl+C left it out of the copy (B-13).
- **Desktop/mobile:** mobile: Not observed (R-38).
- **Reproduction:** scenario 04 (s1, s6).
- **Confidence:** [O] high.
- **Limitations:** one element type (R-38).

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
- **Desktop/mobile:** mobile Stroke and Background popovers: Not observed (R-11).
- **Reproduction:** scenario 04 (s1, s6).
- **Confidence:** [O] high.
- **Limitations:** coordinate clicks, not named controls (R-39).

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
- **Desktop/mobile:** mobile uses a compact bar instead (summary table below, R-11).
- **Reproduction:** scenarios 04 (s1, s6) and 15 (s6, s10).
- **Confidence:** [O] high for the Fill row (s1, s6); in s10, whose rectangle kept a
  transparent background, `dark-08` has no Fill group. High for the text section (`dark-11`
  identical in s6 and s10); medium for the rectangle and arrow sections, whose s10 snapshots
  differ from s6 in the Fill group and in which Sloppiness radio is checked, following the
  styles in use (raw comparisons).
- **Limitations:** light-theme per-type sections not captured (R-10).

## Grouping, layers, alignment

### B-22 Group and ungroup

- **Initial state:** rectangle and ellipse selected (B-11).
- **Action:** Ctrl+G; later Ctrl+Shift+G.
- **Immediate result:** both get one shared group id (`group`); after ungrouping both have none
  and 2 stay selected (`ungroup`) [O].
- **State and related effects:** a click on one member then moves the group as a unit (B-15)
  [O].
- **Persistence:** read from local storage [O].
- **Undo/redo:** undoing the move keeps the group (`undo-move`); undoing the grouping itself:
  Not observed (R-49).
- **Edge cases:** nested groups and selecting inside a group: Not observed (R-49).
- **Desktop/mobile:** mobile: Not observed (R-49).
- **Reproduction:** scenario 03 (s1, s2, s6).
- **Confidence:** [O] high.
- **Limitations:** two elements (R-49).

### B-23 Align top

- **Initial state:** two elements whose top edges are both at y=240.
- **Action:** Ctrl+Shift+Up.
- **Immediate result:** no change (`align-top`) [O]. This does not test alignment.
- **State and related effects:** Not observed (R-51).
- **Persistence:** Not observed (R-51).
- **Undo/redo:** Not observed (R-51).
- **Edge cases:** Not observed (R-51).
- **Desktop/mobile:** Not observed (R-51).
- **Reproduction:** scenario 03 (s1, s2, s6).
- **Confidence:** [O] high for "no change"; the alignment behaviour is [U].
- **Limitations:** the shapes were already aligned (R-51).

### B-24 Layer order

- **Initial state:** rectangle selected (scenario 04).
- **Action:** a coordinate click meant for "Bring to front".
- **Immediate result:** element order unchanged (`04-bring-to-front`); the click missed after
  the panel reflow (B-21).
- **State and related effects:** Not observed (R-50).
- **Persistence:** Not observed (R-50).
- **Undo/redo:** Not observed (R-50).
- **Edge cases:** Not observed (R-50).
- **Desktop/mobile:** Not observed (R-50).
- **Reproduction:** scenario 04 (s1, s6). The four layer commands are listed in the panel and
  the element context menu (B-34).
- **Confidence:** [U] for the behaviour.
- **Limitations:** no layer command took effect (R-50).

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
- **Edge cases:** undo of style, delete, group and resize; Ctrl+Y: Not observed (R-52).
- **Desktop/mobile:** the mobile Undo and Redo buttons: Not observed (R-52).
- **Reproduction:** scenarios 03, 04, 05, 06 (s1, s2, s6).
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

- **Initial state:** a selected rectangle.
- **Action:** open the element context menu (B-34).
- **Immediate result:** it offers "Copy to clipboard as PNG", "as SVG", "Copy styles" and "Paste
  styles" [O].
- **State and related effects:** Not observed (R-53).
- **Persistence:** Not observed (R-53).
- **Undo/redo:** Not observed (R-53).
- **Edge cases:** Not observed (R-53).
- **Desktop/mobile:** Not observed (R-53).
- **Reproduction:** scenario 15 (s6: `dark-07-element-context-menu`).
- **Confidence:** [O] medium for the listing; effects [U].
- **Limitations:** none of the items was clicked (R-53).

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
- **Persistence:** scroll (90,45) survived a reload (B-30) [O]. Zoom across a reload: Not
  observed, because zoom was 1 before the reload (R-54).
- **Undo/redo:** viewport changes are not elements; whether undo touches them: Not observed
  (R-52).
- **Edge cases:**
  - **Pointer anchoring is not established.** The Ctrl+wheel probe had the pointer at
    (640,360), the viewport centre, so pointer-anchored and centre-anchored zoom give the same
    numbers. An earlier version of this entry and of the backlog said Ctrl+wheel zooms around
    the pointer; that is [U] (R-48).
  - Shift+1's vertical rule and whether it ever zooms above 100%: [U]; one scene only (R-48).
  - That pinch zoom always follows the finger-distance ratio, and that two-finger pan always
    moves by delta / zoom, is [H] from one input each, repeated in three sessions (R-48).
  - Zoom limits, step sizes outside 0.9–1.1, PgUp/PgDn, the zoom buttons and the exact pinch
    anchor (scrollX −135 in s3 and s11 vs −132 in s7): Not observed (R-48).
- **Desktop/mobile:** as in the table; mobile has no zoom buttons (F-28).
- **Reproduction:** scenario 05 (s1, s2, s6) and scenario 10 (s3, s7, s11).
- **Confidence:** desktop rows [O] high (s1 and s6 identical; s2 differs from Shift+1 on because
  05 ran straight after 03 there, see the [research README](../../research/excalidraw/README.md#scenario-order-and-dependencies)).
  Mobile rows [O] high for zoom and the pan delta (s3, s7 and s11); scrollX after the pinch
  differs between sessions (see the cross-session replay above).
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
  saved [I, raw only]. No session reloaded while dark or with zen, grid or snap on: s1's last
  reload and s6's scenario 06 reload both came before `07-dark`, and nothing after 07 reloads.
  Whether the theme or any mode survives a reload: Not observed (R-19).
- **Undo/redo:** whether a toggle or theme change is an undo step: Not observed (R-19).
- **Edge cases:** snap's effect on dragging, Keep tool active, Arrow binding and Snap to
  midpoints: Not observed (R-19).
- **Desktop/mobile:** mobile theme in B-28; mobile zen/view/grid: Not observed (R-19).
- **Reproduction:** scenarios 05 and 07 (s1, s6).
- **Confidence:** [O] high for the visible effects and the unchanged zoom and scroll (s1 and s6).
- **Limitations:** visible effects from screenshots and ARIA outside Git; the zen, grid, snap
  and view-mode keys come from raw timelines and are not in the committed probes (R-19).

### B-28 System colour scheme

- **Initial state:** mobile, light theme, default settings.
- **Action:** emulate `prefers-color-scheme: dark`; then choose Dark in the main menu.
- **Immediate result:** emulation did **not** switch the theme (`m-dark-scheme-emulated`);
  choosing Dark did (`m-dark-via-menu`) [O].
- **State and related effects:** `theme` in the saved app state follows the menu choice [O].
- **Persistence:** read from local storage [O]; across a reload: Not observed (R-19).
- **Undo/redo:** whether a theme change is an undo step: Not observed (R-19).
- **Edge cases:** the "System" radio: Not observed (R-26).
- **Desktop/mobile:** desktop dark by shortcut and menu (B-37); desktop emulation: Not observed
  (R-26).
- **Reproduction:** scenario 10 (s3, s7, s11).
- **Confidence:** [O] high.
- **Limitations:** default settings only (R-26).

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
- **Undo/redo:** Not observed for erasing (R-44).
- **Edge cases:** erasing bound or locked elements: Not observed (R-44).
- **Desktop/mobile:** mobile eraser: Not observed (R-44).
- **Reproduction:** scenarios 04 and 04b (s1, s6).
- **Confidence:** [O] high for the removal and the tool after Escape.
- **Limitations:** no probe before the eraser (R-44).

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
- **Undo/redo:** history across a reload: Not observed (R-52).
- **Edge cases:** zoom across a reload (zoom was 1), selection across a reload, several tabs,
  storage quota and mobile reload: Not observed (R-54).
- **Desktop/mobile:** mobile reload: Not observed. Scenario `09b` exists but never ran: s3, s4
  and s7 each record 0 reloads (R-54).
- **Reproduction:** scenario 13 (s6, s9: `13a-t0` … `13c-t1500`, `13-end`); scenario 06 (s1,
  s6).
- **Confidence:** [O] high for the scenario 06 reload and for deletion (s1 and s6; deletion also
  in s8 and s9); [O] medium for the timing: s6 and s9 differ at the third read of one of six
  trials, and an s1 timing reading is not in the committed index.
- **Limitations:** `excalidraw-state` keeps 60 keys (raw count); the read cadence bounds the save
  time only to the 100–150 ms gaps between reads (R-54).

### B-31 Storage keys

- **Initial state:** after the first load (s1) and during scenario 13 (s6).
- **Action:** REA page inspection and driver storage probes, values redacted.
- **Immediate result:** `localStorage`: `excalidraw`, `excalidraw-state`, `excalidraw-theme`,
  `i18nextLng`, `version-dataState`, `version-files`. `sessionStorage`: empty. IndexedDB:
  `excalidraw-library-db`, `excalidraw-ttd-chats-db`, `files-db`. Cache Storage: the Workbox
  precache only. These are the committed inventory of s1's first load [O]. Later inspections
  held more caches: 2 in s6 (`ev_13a4756f`) and 3 at a later s1 inspection, counts kept in
  `evidence/rea-windows.json` [O]. From the raw REA record only: s6 also listed
  `workbox-expiration` in IndexedDB, and its 2 caches were the precache and `fonts` [O, raw
  only].
- **State and related effects:** key names only.
- **Persistence:** these are the persistent stores.
- **Undo/redo:** not applicable (an inventory read changes nothing).
- **Edge cases:** contents of `files-db` and the library database: Not observed (R-45, R-15).
- **Desktop/mobile:** mobile storage inventory: Not observed (R-61).
- **Reproduction:** `evidence/rea-inspect-initial.summary.json` (s1 first load). The s6 and later
  s1 storage names are not in a committed file: `evidence/rea-windows.json` keeps only their
  cache counts.
- **Confidence:** [O] medium: one committed inventory, and the raw inventories differ from it
  in IndexedDB and Cache Storage.
- **Limitations:** values are redacted by design; the s6 and later s1 storage names are raw only
  (R-61).

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

## Element context menu and confirmations

### B-34 Element context menu

- **Initial state:** a selected rectangle, dark theme (s6; in s10 on an otherwise empty
  scene).
- **Action:** right-click on its stroke.
- **Immediate result:** a list of buttons (no `menu` role), in groups: Cut, Copy, Paste / Wrap
  selection in frame / Copy to clipboard as PNG, as SVG / Copy styles, Paste styles / Add to
  library / four layer commands / Flip horizontal, Flip vertical / Add link, Copy link to object
  / Duplicate, Lock / Delete (`dark-07-element-context-menu`) [O].
- **State and related effects:** Not observed for the menu items (R-09).
- **Persistence:** Not observed (R-09).
- **Undo/redo:** Not observed (R-09).
- **Edge cases:** menu on multi-selection or groups: Not observed (R-09).
- **Desktop/mobile:** light desktop and mobile: Not observed (R-09).
- **Reproduction:** scenario 15 (s6, s10).
- **Confidence:** [O] medium. The menu entries are identical in s6 and s10, but the snapshots
  are not: the panel behind the menu has no Fill group in s10 and another Sloppiness radio
  checked, following the styles in use (a raw comparison). By the rule applied to the secondary
  surfaces in the feature inventory, that stays medium. Effects of Duplicate and Lock are known
  only through their shortcuts (B-18, B-19).
- **Limitations:** no item was clicked (R-09).

### B-35 Clear canvas confirmation

- **Initial state:** mobile dark, one rectangle.
- **Action:** main menu → "Reset the canvas", then Escape.
- **Immediate result:** a "Clear canvas" dialog with Cancel and Confirm (`m15-dark-reset-confirm`);
  Escape dismissed it [O].
- **State and related effects:** the scene kept its element (`14-end`) [O].
- **Persistence:** read from local storage [O].
- **Undo/redo:** Not observed (R-13).
- **Edge cases:** Confirm: Not observed (R-13).
- **Desktop/mobile:** desktop: Not observed (R-13).
- **Reproduction:** scenario 14 (s7, s11).
- **Confidence:** [O] high: s7 and s11 give identical `m15-dark-reset-confirm` snapshots (a raw
  comparison) and byte-identical captures, and `14-end` keeps the element in both; s11 ran a
  later build.
- **Limitations:** mobile dark only (R-13).

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
| Diamond/Ellipse/Line | toolbar                 | access path [U] (R-24)                                      |
