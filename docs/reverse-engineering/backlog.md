# Prioritised implementation backlog (derived from the baseline)

Each item becomes a feature issue only after its residual investigation items are closed (see
AGENTS.md). Acceptance criteria are written as testable behaviour for Planewright, in our own
words. Planewright may intentionally differ from the reference; record any difference in the
feature issue. "Ref" points to the evidence.

Every reference fact carries its label: [O] observed, [S] static, [I] inference, [H]
hypothesis, [U] not observed. A criterion marked **open** has no supporting observation and must
be decided in the feature issue, either after its residual row (`R-xx` in the
[residual matrix](residual-matrix.md)) is observed or as a deliberate Planewright choice. No live
session runs after s84: [readiness.md](readiness.md) says which open
criteria wait for the desktop (verification page) or a headed browser (native file pickers), and
which are refinements that the feature issue must observe or decide.

## P0: core canvas

1. **Infinite canvas viewport.** Ref: [B-36](behavior-analysis.md#b-36-pan-and-zoom).
   - Wheel pans vertically 1:1 at zoom 1, and Shift+wheel pans horizontally [O].
   - Ctrl+= and Ctrl+− change zoom by 0.1 and keep the viewport-centre point fixed; Ctrl+0
     returns to 100% keeping the centre [O, between 0.9 and 1.1]. Step sizes and limits
     elsewhere are open (R-48).
   - The scenarios pressed Control only, so whether Cmd does the same on macOS is **open**; no
     residual row plans a macOS session, so it is a Planewright decision.
   - Ctrl+wheel zooms [O]. Its anchor is **open**: the reference was probed only with the
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
   - Whether a creation tool selects the new element and returns to Selection is open (R-02,
     R-29): the two reads straight after the reference's rectangle drag ran without a wait and
     disagree between s2 and s6 [O, raw timelines only]; that they read the saved state before
     it caught up is [H] (B-01). The freedraw tool stayed active across clicks
     after Escape (B-29) [O]. On mobile Tool lock kept the Rectangle tool over two drags and left
     the new rectangles unselected (s71, s72; B-37) [O]; on desktop it is **open** (R-02). On
     mobile, read 800 ms after a touch drag, each of rectangle, diamond, ellipse, line and arrow
     left the new element selected with the Selection tool, while Freedraw stayed active with
     nothing selected (s74–s76; B-01) [O]. On mobile Draw to shape is the same shape-recognising
     tool as the Draw tool's Autoshape, and an embed box drawn with Web Embed asks for its link at
     once and loads nothing while it is empty, even when Redo restores it (s79–s84; B-05, B-50)
     [O].
   - A freedraw stroke covers the input extent, and a click without movement creates a dot [O].
   - Tool shortcuts are single letters and digits, exposed in accessible descriptions [O].
3. **Selection model.** Ref: B-10 to B-14.
   - A click on the stroke selects an unfilled shape and a click inside it does not [O]; filled
     shapes are **open** (R-34).
   - Shift+click adds to the selection, and a box selection selects fully enclosed elements [O];
     on mobile a partial box selects nothing by default and the element once Overlap is picked
     (s71, s72; B-12) [O]; on desktop partial overlap is **open** (R-33).
   - Ctrl+A then Ctrl+C left a locked element out of the copy [O]; whether select-all or copy
     excludes it is **open** (R-33).
   - On touch, two fingers pan and pinch and never select (s79, s80; B-12) [O]; a long press on
     one of several selected shapes narrows the selection to it, while a right click keeps it
     (s79–s82; B-11, B-34) [O]. Which one Planewright follows is a decision.
   - The desktop selection shows corner handles and a rotation handle above the top centre; the
     reference showed 8 handles on mobile [O]. What decides the count is open (R-35).
4. **Transforms.** Ref: B-15 to B-18.
   - Move applies the exact pointer delta [O]. A resize moves only the dragged corner or side, by
     the drag, and keeps the opposite one fixed, with a free aspect ratio [O: south-east on desktop,
     all eight handles on mobile]. Several selected elements scale, with the gaps between them,
     about the fixed corner by the drag's ratios [O, mobile, one case]. Modifiers are **open**
     (R-36).
   - The rotation handle rotates around the centre [O].
   - Duplicate offsets the copies by +10/+10 [O], from the mobile Actions popover and the
     long-press menu too; which elements end up selected is open (R-38).
   - Flip horizontal and vertical mirror the selection about the middle of its box, an arrow by
     moving its first point to the other end, each one undo step [O, mobile; B-34]; on desktop they
     are **open** (R-09).
   - Move, rotation and duplicate are each one undo step [O]; so is a resize on mobile [O], while
     the desktop resize undo is open (R-36).
5. **Undo/redo.** Ref: B-25.
   - Each observed operation is one undo step [O]. On a fresh page both buttons were disabled,
     and Undo became enabled after the first change [O]; the buttons' state after everything is
     undone, and when Redo enables, are **open** (R-04, R-52). History across a reload is open
     (R-52). On mobile one Undo removes a shape just drawn, a sticky note, a frame, a pasted style,
     a lock, a deletion from the context menu and a cleared canvas (s74–s78), and a flip, a paste,
     a cut, an embed box, a fill and a note's resize (s79–s82) [O]; Redo puts back an empty embed, a
     fill and a pasted text (s83, s84) [O]. Adding a link made no undo step of its own on mobile
     (s54, s56, s83, s84; B-42) [I]; Planewright should make it one.
6. **Local persistence.** Ref: B-30, B-31.
   - The scene and the scroll position survive a reload [O, scenario 06 in s1 and s6]. Zoom and
     selection across a reload, and a mobile reload, are **open** (R-54).
   - Changes are saved automatically. Counted from the first read after the drag, the
     reference's save landed after the 114–138 ms read and by the 338–376 ms read in 6 of 6
     trials (s6 and s9); after the 224–245 ms read in 5 of them, and by the 255 ms read in the
     sixth [O, medium: the sessions differ]. Its delay from pointer-up and any effect on input are not established; the
     delay is a Planewright decision.
   - Deleted elements are not kept in local storage [O].
   - Binary files are stored apart from the scene: a design choice. The reference's `files-db`
     database suggests the same [H].

## P1: editing depth

7. **Styles panel.** Ref: B-20, B-21.
   - Changes apply to the selection and become the defaults for new elements [O].
   - Fill options appear only with a background [O].
   - A colour is picked from 15 named colours, five shades of the chosen one or a typed hex code
     [O, mobile].
   - Every control has an accessible name (improving on the reference's unnamed radios).
8. **Text and labels.** Ref: B-06, B-07, B-08.
   - Click-to-type text whose vertical centre is the click; Enter on a shape adds a centred label
     that moves with its container [O].
   - Sticky notes are centred on the click [O]; typed text goes into the note's centred label,
     and a corner resize keeps the note square and scales its label's font with it [O, mobile;
     B-08].
   - The font is picked from a list, as one undo step, beside font size and alignment controls
     [O, mobile]; re-editing and the undo of typing are **open** (R-40). In a sticky note a long
     text wraps, the label drops from font size 20 to 16 and the note grows downwards, keeping its
     width (s83, s84; B-08) [O, mobile].
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
      delete commands with their shortcuts [O]. Layer and flip effects are **open** (R-09, R-50).
      On touch a long press on a shape opens it, without the layer commands; Copy styles and
      Paste styles carry the background to another shape, Lock leaves a shape unselectable and
      unerasable until Unlock, and Wrap selection in frame adds a frame 16 px larger on each side,
      each undoable (s74–s78; B-19, B-27, B-34) [O]. Add link from it stores a link, and Copy link
      to object copies a link to the reference with an `element` query key (s83, s84; B-42) [O];
      Planewright's own element-link format is a decision.
11. **Clipboard.** Ref: B-26.
    - Copy produces a typed JSON payload [O, raw timelines only], and paste centres the copies
      on the pointer, with 2 of the 3 copies selected [O]. The committed probes keep the count
      only, so which copies those were is not recorded; the selection rule is a Planewright
      decision.
    - On mobile Cut and Copy write the same payload, Paste in the canvas menu adds a selected copy
      that one Undo removes, and the image items write one PNG of the selection (360×300 for a
      100×80 shape) or one SVG text (s79, s80; B-26, B-27) [O, raw timelines only for the clipboard]. Desktop
      cut and the image items are **open** (R-53), and so, on mobile, are the canvas menu's image
      items with nothing selected and the element menu's Paste (R-08, R-09, R-53).
    - A plain text on the clipboard pastes as one selected text element at font size 20, one Undo
      step (s83, s84; B-26) [O, mobile, a text the driver wrote]; text from another app and an
      image are **open** (R-53).
12. **Eraser.** Ref: B-29.
    - After an eraser drag across a freshly drawn freedraw stroke, the scene held no freedraw
      element [O]. That the stroke existed just before is [I] from B-05, because no probe ran in
      between (R-44).
    - After Escape the reference returned to the tool used before the eraser, once [O]; as a
      rule this is [H] (R-44).
    - On mobile a touch stroke with the eraser erases the element it crosses; erasing an arrow's
      end target drops that end's binding, and Undo brings back the element and its bindings
      (s71–s73) [O]. After erasing the element selected just before, Undo brought back that
      selection and the Selection tool [O]; that the tool follows the selection is [I] (B-29).

## P2: application features

13. **Menus, command palette and help.** Ref: [feature inventory](feature-inventory.md).
    - Every command is reachable from the palette with its shortcut. On mobile the reference's
      palette ran a command typed by name with Enter (s74–s76; B-36) [O]; a canvas context menu
      reached only by a right click there is a gap to close, not to copy (R-08). A toggle's
      check mark is part of its accessible name there ("✓ Toggle grid"), so its name changes with
      its state (s79–s82; B-37) [O]; Planewright should expose the state instead. The other
      toggles of that menu are named the same way, and in view mode the menu offers "✓ View mode"
      as the way back (s83, s84; B-37) [O].
    - Help lists shortcuts consistently with the palette (avoid the reference's Shift+2/Shift+3
      discrepancy).
14. **Themes and view modes.** Ref: [B-37](behavior-analysis.md#b-37-view-modes-and-toggles),
    B-28.
    - The light/dark choice is saved locally as `theme` in the saved app state [O]. An
      `excalidraw-theme` key was already present at the first, light, load and REA redacts its
      value, so that it also stores the choice is [I]. On mobile the dark choice was kept across
      reloads (s16, s71, s72) and the "System" option followed the emulated scheme (s71, s72) [O];
      on desktop both are **open** (R-19, R-26). A toggle or theme change is not an undo step on
      mobile (s71, s72) [O].
    - Zen, grid and snap set keys in the saved app state [O, raw timelines only]; no view-mode key
      was seen, so view mode is probably not saved [I, raw only]. On mobile zen, snap, Overlap
      and Mouse were kept across a reload and view mode was not (s71, s72) [O]; on desktop this is
      **open** (R-19).
15. **Responsive mobile layout.** Ref: feature inventory §6.
    - Bottom toolbar, compact property bar, touch handles and pinch/pan [O, one phone
      viewport]. Breakpoints, tablet widths and orientation are **open** (R-23).
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

## Pending observation: scope items without observed behaviour

These issue #1 scope items have no observed behaviour yet, apart from the mobile commands of
item 20. The first bullet of each item records only what was inventoried or seen [O]; every other
behaviour criterion is **open** until its residual row is observed. Their priority is set when the
feature issue is written.

19. **Libraries.** Ref: feature inventory §2 (Library sidebar), R-15.
    - The sidebar, its four unnamed tabs, an empty state and a link to an external library site
      were inventoried [O].
    - On mobile the add tile put a selection into the library and cleared the selection, and the
      item's tile placed a copy centred in the viewport, selected [O, mobile, once; B-48].
    - On mobile, Undo after placing removed the copy and Redo restored it; after an add, Undo took
      back the step before it [O, mobile, two sessions; B-48].
    - On mobile Add to library in the element menu added the selected shape as one item and
      changed neither the scene nor the selection [O, mobile, two sessions; B-48].
    - Desktop use and exporting or importing a library file are **open** (R-15).
20. **Alignment and distribution.** Ref: B-23, R-51.
    - The Help dialog lists Ctrl+Shift+Arrow for alignment [O]. One press on two shapes that
      were already aligned changed nothing [O], which does not test alignment.
    - On mobile each of the six align commands lined up the selected boxes' edges or centres
      with the selection's, the two distribute commands equalised the gaps, and each was one undo
      step [O, mobile, three elements; B-23]. A group aligned with a rectangle moved as one unit,
      and one undo restored it [O, mobile; B-23].
    - Desktop alignment and its undo are **open** (R-51).
21. **Offline start and reconnection.** Ref: network analysis, R-57, R-55.
    - Reloads in a profile that had loaded the page were served by a service worker [O].
    - On mobile, after one online load, the app started offline from the service worker with the
      stored scene, kept a shape drawn offline, showed no offline indicator, and made no request
      in the 6 s after the connection returned [O, mobile, two sessions; B-44].
    - With the offline state kept across the reload, so that the app read offline, it still showed
      no offline indicator [O, mobile, two sessions; B-44].
    - The desktop, reconnecting a collaboration session and what the UI shows meanwhile are
      **open** (R-57, R-55).
22. **Keyboard accessibility.** Ref: R-27, R-28.
    - The unnamed and raw-named controls are listed in the next section [O].
    - On mobile, Tab never left the app container from the first load, which drew no ring; the
      Help dialog kept Tab within its links and Close; the main menu held the focus on its
      container; Escape left the focus on the body; no live region existed [O, mobile; B-43].
    - Desktop Tab order, focus return and screen-reader announcements are **open** (R-27).
    - Do better: let Tab reach every control, draw a visible ring on every focused element,
      return the focus to the opening control on Escape and announce state changes in a live
      region.

## Accessibility requirements surfaced by the reference (do better)

- Name the main menu trigger, sidebar tabs and every icon-only radio (stroke width, pressure,
  export scale).
- Expose context menus with `menu`/`menuitem` roles.
- Give arrowhead, arrow-type, font-size and text-align controls human-readable names (the
  reference exposes raw identifiers or no names).
