# Prioritised implementation backlog (derived from the baseline)

Each item becomes a feature issue only after its residual investigation items are closed (see
AGENTS.md). Acceptance criteria are written as testable behaviour for Planewright, in our own
words. Planewright may intentionally differ from the reference; record any difference in the
feature issue. "Ref" points to the evidence.

## P0: core canvas

1. **Infinite canvas viewport.** Ref: [pan/zoom](behavior-analysis.md#pan-and-zoom).
   - Wheel pans vertically 1:1 at zoom 1, and Shift+wheel pans horizontally.
   - Ctrl/Cmd+wheel zooms around the pointer, so the scene point under the pointer stays fixed.
   - Keyboard zoom changes by fixed steps around the viewport centre, and a reset returns to 100%
     keeping the centre.
   - Space+drag and a hand tool pan by exactly the pointer delta.
   - Zoom-to-fit centres all content and does not zoom in beyond 100% for small content.
   - Pinch zoom follows the finger-distance ratio, and two-finger pan moves by delta / zoom.
2. **Shape creation tools.** Ref: B-01, B-02, B-05, B-06.
   - Rectangle, ellipse, diamond and line created by drag have exactly the drag extent.
   - The new element is selected and the tool reverts to selection unless the tool is locked.
   - Freedraw keeps every sampled point; a click without movement creates a dot.
   - Tool shortcuts are single letters and digits, and are shown in tooltips and accessible
     descriptions.
3. **Selection model.** Ref: B-10 to B-14.
   - A click selects by stroke hit for unfilled shapes; Shift+click adds to the selection.
   - A box selection selects fully enclosed elements.
   - Select-all excludes locked elements.
   - The selection box shows corner handles and a rotation handle above the top centre.
4. **Transforms.** Ref: B-15 to B-18.
   - Move and resize apply the exact pointer delta, with the opposite corner fixed.
   - The rotation handle rotates around the centre.
   - Duplicate offsets copies and selects them.
   - Every transform is one undo step.
5. **Undo/redo.** Ref: B-25.
   - Each user operation is atomic, and undo/redo buttons reflect availability (disabled when
     empty).
6. **Local persistence.** Ref: B-30, B-31.
   - The scene and view state survive reload.
   - Writes happen shortly after changes without blocking input.
   - Deleted elements are not persisted.
   - Binary files are stored apart from the scene.

## P1: editing depth

7. **Styles panel.** Ref: B-20, B-21.
   - Changes apply to the selection and become the defaults for new elements.
   - Fill options appear only with a background.
   - Every control has an accessible name (improving on the reference's unnamed radios).
8. **Text and labels.** Ref: B-06, B-07, B-08.
   - Click-to-type text; Enter on a shape adds a centred label that moves with its container.
   - Sticky notes are centred on the click.
9. **Arrows and binding.** Ref: B-04.
   - An arrow end dropped on a shape outline binds and snaps to the outline, and the binding is
     recorded on both elements.
   - Moving a bound shape updates the arrow (pending R-arrow investigation).
10. **Groups, lock and layers.** Ref: B-19, B-22.
    - Group and ungroup with shortcuts; groups move as a unit.
    - Locked elements cannot be selected or moved by pointer.
11. **Clipboard.** Ref: B-26.
    - Copy produces a typed JSON payload, and paste centres the copies on the pointer and
      selects them.
12. **Eraser.** Ref: B-29.
    - A drag removes touched elements; leaving the eraser restores the previous tool.

## P2: application features

13. **Menus, command palette and help.** Ref: [feature inventory](feature-inventory.md).
    - Every command is reachable from the palette with its shortcut.
    - Help lists shortcuts consistently with the palette (avoid the reference's Shift+2/Shift+3
      discrepancy).
14. **Themes and view modes.** Ref: [view modes](behavior-analysis.md#view-modes).
    - Light/dark/system setting persisted; zen, view, grid and snap toggles.
15. **Responsive mobile layout.** Ref: feature inventory §6.
    - Bottom toolbar, compact property bar, touch handles and pinch/pan.
16. **Image insertion.** Ref: B-09.
    - A dropped image is inserted at native size, centred on the drop point.
17. **Import/export.** Pending R-io.
    - Picker-based save/open, with a download/upload fallback when pickers are unavailable.
18. **Guest collaboration.** Ref: B-33, [network](network-analysis.md).
    - Shareable room link whose key never leaves the client (fragment).
    - End-to-end encrypted updates.
    - Participant count, a random guest name, and a stop-session flow (pending R-collab).

## Accessibility requirements surfaced by the reference (do better)

- Name the main menu trigger, sidebar tabs and every icon-only radio (stroke width, pressure,
  export scale).
- Expose context menus with `menu`/`menuitem` roles.
