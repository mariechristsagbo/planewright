# Prioritised implementation backlog (derived from the baseline)

Each item becomes a feature issue only after its residual investigation items are closed (see
AGENTS.md). Acceptance criteria are written as testable behaviour for Planewright, in our own
words. Planewright may intentionally differ from the reference; record any difference in the
feature issue. "Ref" points to the evidence.

Every reference fact carries its label: [O] observed, [S] static, [I] inference, [H]
hypothesis, [U] not observed. A criterion marked **open** has no supporting observation and must
be decided in the feature issue, either after its residual row (`R-xx` in the
[residual matrix](residual-matrix.md)) is observed or as a deliberate Planewright choice.

## P0: core canvas

1. **Infinite canvas viewport.** Ref: [B-36](behavior-analysis.md#b-36-pan-and-zoom).
   - Wheel pans vertically 1:1 at zoom 1, and Shift+wheel pans horizontally [O].
   - Ctrl/Cmd+= and Ctrl/Cmd+− change zoom by 0.1 and keep the viewport-centre point fixed;
     Ctrl/Cmd+0 returns to 100% keeping the centre [O, between 0.9 and 1.1]. Step sizes and
     limits elsewhere are open (R-48).
   - Ctrl/Cmd+wheel zooms [O]. Its anchor is **open**: the reference was probed only with the
     pointer at the viewport centre, so pointer and centre anchoring were not distinguished
     (R-48).
   - Space+drag and a hand tool pan by exactly the pointer delta [O].
   - Zoom-to-fit brings all content into view. The reference kept 100% and centred one small
     scene horizontally but not vertically [O, one scene]; the zoom cap and the vertical rule are
     **open** (R-48).
   - Pinch zooms and a two-finger drag pans. The reference matched the finger-distance ratio and
     delta / zoom in one sample each [O]; as general rules they are [H] (R-48).
2. **Shape creation tools.** Ref: B-01, B-02, B-05, B-06.
   - Rectangle, ellipse, diamond and line created by drag have exactly the drag extent [O].
   - The new element is selected and the tool reverts to selection [O]. Keeping the tool with a
     tool lock is **open** (R-02).
   - A freedraw stroke covers the input extent, and a click without movement creates a dot [O].
   - Tool shortcuts are single letters and digits, exposed in accessible descriptions [O].
3. **Selection model.** Ref: B-10 to B-14.
   - A click on the stroke selects an unfilled shape and a click inside it does not [O]; filled
     shapes are **open** (R-34).
   - Shift+click adds to the selection, and a box selection selects fully enclosed elements [O];
     partial overlap is **open** (R-33).
   - Select-all excludes locked elements [O].
   - The desktop selection shows corner handles and a rotation handle above the top centre; the
     reference showed 8 handles on mobile [O]. What decides the count is open (R-35).
4. **Transforms.** Ref: B-15 to B-18.
   - Move applies the exact pointer delta [O]. A south-east resize keeps the opposite corner fixed
     [O]; the other handles and modifiers are **open** (R-36).
   - The rotation handle rotates around the centre [O].
   - Duplicate offsets the copies by +10/+10 [O]; which elements end up selected is open (R-38).
   - Move, rotation and duplicate are each one undo step [O]; resize is open (R-36).
5. **Undo/redo.** Ref: B-25.
   - Each observed operation is one undo step, and the undo/redo buttons are disabled when there
     is nothing to undo or redo [O]. History across a reload is open (R-52).
6. **Local persistence.** Ref: B-30, B-31.
   - The scene and the scroll position survive a reload [O, scenario 06 in s1 and s6]. Zoom and
     selection across a reload, and a mobile reload, are **open** (R-54).
   - Changes are saved automatically. The reference's save landed after the 224–236 ms read and
     by the 338–376 ms read, counted from the first read after the drag, in 3 of 3 trials
     [O, medium]. Its delay from pointer-up and any effect on input are not established; the
     delay is a Planewright decision.
   - Deleted elements are not kept in local storage [O].
   - Binary files are stored apart from the scene: a design choice. The reference's `files-db`
     database suggests the same [H].

## P1: editing depth

7. **Styles panel.** Ref: B-20, B-21.
   - Changes apply to the selection and become the defaults for new elements [O].
   - Fill options appear only with a background [O].
   - Every control has an accessible name (improving on the reference's unnamed radios).
8. **Text and labels.** Ref: B-06, B-07, B-08.
   - Click-to-type text whose vertical centre is the click; Enter on a shape adds a centred label
     that moves with its container [O].
   - Sticky notes are centred on the click [O].
9. **Arrows and binding.** Ref: B-04.
   - An arrow end released near a shape (5 units outside, or 5 units inside) binds to it, and
     the binding is recorded on both elements [O, two cases].
   - Where a bound end is placed (on the outline, at a gap, or at the pointer) is **open**: the
     two observed ends disagree (R-42).
   - A start 15 units away did not bind [O]; a distance rule is [H] (R-42).
   - Moving a bound shape updates the arrow: [H], **open**, not observed (R-42).
10. **Groups, lock and layers.** Ref: B-19, B-22, B-24, B-34.
    - Group and ungroup with shortcuts; groups move as a unit [O].
    - Locked elements cannot be selected or moved by pointer [O].
    - An element context menu offers the clipboard, style, layer, flip, link, duplicate, lock and
      delete commands with their shortcuts [O]. Layer, flip and style effects are **open**
      (R-09, R-50).
11. **Clipboard.** Ref: B-26.
    - Copy produces a typed JSON payload, and paste centres the copies on the pointer and
      selects them [O].
12. **Eraser.** Ref: B-29.
    - A drag removes a touched freedraw stroke [O].
    - After Escape the reference returned to the tool used before the eraser, once [O]; as a
      rule this is [H] (R-44).

## P2: application features

13. **Menus, command palette and help.** Ref: [feature inventory](feature-inventory.md).
    - Every command is reachable from the palette with its shortcut.
    - Help lists shortcuts consistently with the palette (avoid the reference's Shift+2/Shift+3
      discrepancy).
14. **Themes and view modes.** Ref: [B-37](behavior-analysis.md#b-37-view-modes-and-toggles),
    B-28.
    - The light/dark choice is saved locally (`theme` in the saved app state and an
      `excalidraw-theme` key) [O]. Whether it survives a reload is **open**: no session reloaded
      while dark (R-19). The "System" option is **open** (R-26).
    - Zen, grid and snap set keys in the saved app state [O, raw timelines only]; no view-mode key
      was seen, so view mode is probably not saved [I]. Whether any mode survives a reload is
      **open** (R-19).
15. **Responsive mobile layout.** Ref: feature inventory §6.
    - Bottom toolbar, compact property bar, touch handles and pinch/pan [O].
16. **Image insertion.** Ref: B-09.
    - A dropped image is inserted at native size, centred on the drop point [O].
17. **Import/export.** Pending R-46 and R-18.
    - Picker-based save/open, with a download/upload fallback when pickers are unavailable
      (design choice; the reference's picker is [H]).
18. **Guest collaboration.** Ref: B-33, [network](network-analysis.md).
    - A shareable room link whose key stays in the URL fragment, which is not sent in HTTP
      requests [O/I].
    - End-to-end encrypted updates: a design goal; the reference's encryption is [H] (N-H1).
    - Participant count and a random guest name [O]; a working stop-session flow is **open**
      (R-55).

## Accessibility requirements surfaced by the reference (do better)

- Name the main menu trigger, sidebar tabs and every icon-only radio (stroke width, pressure,
  export scale).
- Expose context menus with `menu`/`menuitem` roles.
- Give arrowhead, arrow-type, font-size and text-align controls human-readable names (the
  reference exposes raw identifiers or no names).
