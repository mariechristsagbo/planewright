# Engine requirements and their trace

This is the list of behavioural requirements that the Planewright canvas engine is designed to
meet. Each one is written in Planewright's own words and traced to the merged behavioural baseline
of issue #1: a behaviour entry (`B-xx`) in the [behaviour analysis](../../reverse-engineering/behavior-analysis.md),
an item of the [backlog](../../reverse-engineering/backlog.md), a hypothesis (`A-xx`) in the
[architecture hypotheses](../../reverse-engineering/architecture-hypotheses.md) or a residual row
(`R-xx`) of the [residual matrix](../../reverse-engineering/residual-matrix.md). The baseline's
evidence labels are kept as they are there: **[O]** observed, **[I]** inference, **[H]**
hypothesis, **[U]** not observed.

The baseline describes what a reference application did, never how it is built. Nothing here
copies its code, structure, names, assets or text ([ADR 0003](../../adr/0003-clean-room-reference-policy.md)),
and the baseline itself is not reopened: no live session runs for this design.

## How to read the tables

- **Disposition**
  - **Adopt**: every part of the requirement was observed on at least one platform, and
    Planewright reproduces it.
  - **Decide**: at least one part was not observed, or the baseline left it open; the value is a
    Planewright decision, recorded in the design document named for its area.
  - **Differ**: Planewright intentionally behaves differently from an observation; the reason is
    in [Intentional differences](#intentional-differences).
- **Phase**: P0 is the first usable engine, split into issues by the roadmap in this directory;
  P1 and P2 follow the
  [backlog](../../reverse-engineering/backlog.md) priorities. A P1 or P2 requirement is listed
  here when the P0 model or interfaces must already be able to hold it.
- Units are scene units unless a requirement says screen pixels. Zoom 1 shows one scene unit as
  one CSS pixel.

## Viewport

| ID      | Requirement                                                                                                                                      | Basis                                                                                                           | Disposition | Phase |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | ----------- | ----- |
| REQ-V01 | The wheel pans vertically by its delta in screen pixels (1:1 at zoom 1); Shift+wheel pans horizontally.                                          | B-36 wheel and Shift+wheel rows [O, high]; backlog 1                                                            | Adopt       | P0    |
| REQ-V02 | Keyboard zoom keeps the viewport centre fixed: one step in from 100 % gives 110 %, two steps out from 110 % give 90 %, and reset gives 100 %.    | B-36 Ctrl+=, Ctrl+− and Ctrl+0 rows [O, high]                                                                   | Adopt       | P0    |
| REQ-V03 | Outside 90–110 %, keyboard zoom moves along a fixed ladder of zoom levels.                                                                       | B-36: steps outside 0.9–1.1 not observed (R-48)                                                                 | Decide      | P0    |
| REQ-V04 | Mod+wheel and trackpad pinch zoom about the pointer: the scene point under the pointer stays within 0.5 px.                                      | B-36 Ctrl+wheel row [O, high, pointer at the viewport centre only]; the anchor [U] (R-48)                       | Decide      | P0    |
| REQ-V05 | Mod is Cmd on macOS and Ctrl elsewhere, for every shortcut.                                                                                      | backlog 1: macOS left open, no residual row plans it                                                            | Decide      | P0    |
| REQ-V06 | Space+drag, a middle-button drag and the Hand tool pan by exactly the pointer delta; Space+drag leaves the active tool unchanged.                | B-36 Space+drag and Hand rows [O, high]; the middle button not observed                                         | Decide      | P0    |
| REQ-V07 | Two touch pointers pan by their midpoint's delta and zoom by their distance ratio about the midpoint, and never select, create or move elements. | B-36 pinch and two-finger rows [O, high], anchor along the pinch axis [I, medium]; B-12 two fingers [O, mobile] | Differ      | P0    |
| REQ-V08 | Zoom stays within 10 %–3000 % for every input.                                                                                                   | B-36 scenario 26 limits 0.1 and 30 [O, high, mobile]; desktop limits (R-48)                                     | Adopt       | P0    |
| REQ-V09 | Zoom to fit centres the content's bounds on both axes and never zooms above 100 %.                                                               | B-36 Shift+1 [O, one scene: 100 % kept, centred horizontally only]; mobile Zoom to fit kept 1 [O]               | Differ      | P0    |
| REQ-V10 | Camera changes are never undo steps.                                                                                                             | B-36 undo not observed (R-52); B-37 toggles are not undo steps [O, mobile]                                      | Decide      | P0    |
| REQ-V11 | The camera position and zoom survive a reload.                                                                                                   | B-30 scroll [O, high]; B-36 zoom across a mobile reload [O]; desktop zoom (R-54)                                | Adopt       | P0    |

## Creation

| ID      | Requirement                                                                                                                                                      | Basis                                                                                 | Disposition | Phase |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------- | ----- |
| REQ-C01 | A drag with the rectangle, ellipse, diamond or line tool creates an element whose box is exactly the drag extent, with no snapping by default.                   | B-01 [O, high]; backlog 2                                                             | Adopt       | P0    |
| REQ-C02 | A drag in any direction gives a normalised box with positive width and height.                                                                                   | B-01 edge cases not observed (R-31)                                                   | Decide      | P0    |
| REQ-C03 | A tap with the line tool creates a 100-unit horizontal line centred on the tap.                                                                                  | B-40 [O, high, mobile]                                                                | Adopt       | P0    |
| REQ-C04 | A tap with a closed-shape tool creates a 100 × 100 shape centred on the tap.                                                                                     | not observed (R-29)                                                                   | Decide      | P0    |
| REQ-C05 | After a creation gesture the Selection tool is active and only the new element is selected; with tool lock on, the tool stays and the new element is unselected. | B-01 mobile reads [O, high]; B-37 tool lock [O, mobile]; desktop (R-02, R-29)         | Adopt       | P0    |
| REQ-C06 | The freehand tool stays active after a stroke and leaves nothing selected.                                                                                       | B-01 `69-freedraw` [O, mobile]; B-29 [O]                                              | Adopt       | P0    |
| REQ-C07 | A freehand stroke's box is the extent of its input, and a press without movement makes a dot of zero size.                                                       | B-05 [O, high]                                                                        | Adopt       | P0    |
| REQ-C08 | Freehand keeps per-point pressure when the pointer reports it, and draws a constant width otherwise.                                                             | B-05 pressure options [O, mobile]; desktop pressure (R-43)                            | Decide      | P1    |
| REQ-C09 | A click with the text tool starts a text whose left edge is at the click and whose vertical centre is on it; Escape or a press on empty canvas commits it.       | B-06 [O, high]                                                                        | Adopt       | P0    |
| REQ-C10 | An empty text is discarded when committed, a whole editing session is one undo step, and a double-click on a text edits it again.                                | B-08 empty note text dropped on Escape [O, mobile]; re-edit and undo of typing (R-40) | Decide      | P0    |
| REQ-C11 | A press that starts on interface chrome never reaches the canvas.                                                                                                | B-02 [O, high]                                                                        | Adopt       | P0    |
| REQ-C12 | New elements take the current default style; the default values are Planewright's own.                                                                           | B-01 stored defaults [O]; B-20 [O]                                                    | Adopt       | P0    |
| REQ-C13 | Each creation is one undo step, and undoing it removes the element and leaves nothing selected.                                                                  | B-01 mobile undo [O, high]                                                            | Adopt       | P0    |
| REQ-C14 | Each tool has a single-key shortcut that its button exposes in its accessible description.                                                                       | backlog 2 [O]; feature inventory §1 [O, high]                                         | Adopt       | P0    |

## Selection

| ID      | Requirement                                                                                                                                                    | Basis                                                                                 | Disposition | Phase |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------- | ----- |
| REQ-S01 | A press on the outline of an unfilled shape selects it and a press inside it does not; a filled shape is hit anywhere inside its outline.                      | B-10 [O, high; filled shapes on mobile]; desktop filled shapes (R-34)                 | Adopt       | P0    |
| REQ-S02 | A text element is hit anywhere inside its box.                                                                                                                 | not observed (R-34)                                                                   | Decide      | P0    |
| REQ-S03 | Hit tolerance is a screen distance around the stroke: at zoom 1 with a 2-unit stroke, a press 4 px from the stroke hits and one 8 px away misses.              | B-10 mobile ladder [O, high]; the mouse not observed (R-34)                           | Adopt       | P0    |
| REQ-S04 | When several elements are hit, the topmost in drawing order wins.                                                                                              | not separated in the baseline (R-34)                                                  | Decide      | P0    |
| REQ-S05 | Shift+press adds an element to the selection, and Shift+press on a selected element removes it.                                                                | B-11 [O, adding]; removal (R-33)                                                      | Decide      | P0    |
| REQ-S06 | A drag from empty canvas with the Selection tool selects the elements its box fully encloses.                                                                  | B-12 [O, high]                                                                        | Adopt       | P0    |
| REQ-S07 | An overlap preference makes the box select every element it touches.                                                                                           | B-12 Overlap [O, mobile]                                                              | Adopt       | P2    |
| REQ-S08 | Locked elements are never selected by a press, a box or Select all, and never moved, erased or copied through them.                                            | B-19 [O]; B-13 which step excluded [H] (R-33); B-29 eraser [O, mobile]                | Decide      | P1    |
| REQ-S09 | Select all (Mod+A) selects every selectable element.                                                                                                           | B-11 Select all [O, mobile]; B-13 [O]                                                 | Adopt       | P0    |
| REQ-S10 | A press on empty canvas clears the selection, and Escape clears it when no gesture is active.                                                                  | B-10 deselecting tap [O, mobile]; Escape not observed                                 | Decide      | P0    |
| REQ-S11 | A press on a group member selects the whole group.                                                                                                             | B-22 [O]                                                                              | Adopt       | P1    |
| REQ-S12 | A selection shows its box, eight resize handles and a rotation handle above the top centre; side handles hide when the box is too small on screen to hit them. | B-14 [O: four corners on desktop, eight on mobile]; what decides the count (R-35)     | Decide      | P0    |
| REQ-S13 | Selection-only changes are not undo steps; undo and redo restore the selection that surrounded each change.                                                    | B-10, B-12 and B-34 [O, mobile: a selection change was an undo step]                  | Differ      | P0    |
| REQ-S14 | A long press on an element opens its context menu like a secondary click: it selects an unselected element and keeps a selection the element belongs to.       | B-34 and B-11 [O, mobile: a long press narrowed the selection, a right click kept it] | Differ      | P1    |

## Transforms

| ID      | Requirement                                                                                                                                             | Basis                                                               | Disposition | Phase |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------- | ----- |
| REQ-T01 | Dragging a selected element moves the whole selection by exactly the pointer delta, with no snapping by default; dragging an unselected one selects it. | B-15 [O, high]; selecting on drag not observed (R-36)               | Decide      | P0    |
| REQ-T02 | Dragging a resize handle moves only that corner or side by the drag, in the element's own frame, with the opposite one fixed and a free aspect ratio.   | B-16 [O, high: south-east on desktop, all eight handles on mobile]  | Adopt       | P0    |
| REQ-T03 | Resizing several elements scales their positions, sizes and gaps about the fixed corner or side of the selection box by the drag's ratios.              | B-16 pair [O, mobile, one case; the ratios I]                       | Adopt       | P0    |
| REQ-T04 | Shift keeps the aspect ratio and Alt resizes about the centre.                                                                                          | not observed (R-36)                                                 | Decide      | P0    |
| REQ-T05 | A resize never makes a positive size negative or zero: it stops at one scene unit, a zero size stays zero, and mirroring is the flip command's job.     | not observed (R-36)                                                 | Decide      | P0    |
| REQ-T06 | Dragging the rotation handle rotates the selection about its centre to follow the pointer, sizes unchanged; Shift snaps to 15° steps.                   | B-17 [O, high]; snapping (R-36)                                     | Decide      | P0    |
| REQ-T07 | A press that misses every handle and element clears the selection instead of transforming it.                                                           | B-17 edge case [O]                                                  | Adopt       | P0    |
| REQ-T08 | Duplicate offsets the copies by +10, +10 and selects the copies.                                                                                        | B-18 [O, high]; which elements end up selected (R-38)               | Decide      | P0    |
| REQ-T09 | Delete and Backspace remove the selection, and undo restores the elements, selected.                                                                    | B-25 `46-delete-undo` [O, mobile]; B-30 deletion [O, high]          | Adopt       | P0    |
| REQ-T10 | Arrow keys nudge the selection by 1 unit and Shift+arrow by 10; one held-key burst is one undo step.                                                    | not observed (R-37)                                                 | Decide      | P0    |
| REQ-T11 | Each move, resize, rotation, duplicate and delete is exactly one undo step.                                                                             | B-15, B-16, B-17, B-18 and B-25 [O]; the desktop resize undo (R-36) | Adopt       | P0    |
| REQ-T12 | Flip horizontal and flip vertical mirror the selection about the middle of its box, each as one undo step.                                              | B-34 [O, mobile]; desktop (R-09)                                    | Adopt       | P1    |

## History

| ID      | Requirement                                                                                                                        | Basis                                                                                   | Disposition | Phase |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ----------- | ----- |
| REQ-H01 | Mod+Z undoes the last document change, and Mod+Shift+Z or Mod+Y redoes it.                                                         | B-25 Ctrl+Z and Ctrl+Shift+Z [O, high]; Ctrl+Y (R-52)                                   | Decide      | P0    |
| REQ-H02 | Undo and Redo start disabled; Undo enables after the first change, and Redo enables after an undo and disables after a new change. | B-25 [O: both start disabled, Undo enables]; the rest (R-04, R-52)                      | Decide      | P0    |
| REQ-H03 | History lives in memory for the session and is empty after a reload.                                                               | B-30 [O, mobile, raw ARIA]                                                              | Adopt       | P0    |
| REQ-H04 | The camera, view toggles, the theme and preferences never enter the history.                                                       | B-37 and B-28 [O, mobile]                                                               | Adopt       | P0    |
| REQ-H05 | Undo and redo never change the active tool.                                                                                        | B-29 [O, mobile: the tool changed with the restored selection; that it follows it is I] | Differ      | P0    |
| REQ-H06 | Undo and redo requested during a pointer gesture are ignored.                                                                      | not observed                                                                            | Decide      | P0    |
| REQ-H07 | Every document command, adding a link included, is exactly one undo step.                                                          | backlog 5; B-42 [I: adding a link made no undo step of its own]                         | Differ      | P0    |

## Persistence

| ID      | Requirement                                                                                                                                        | Basis                                                                         | Disposition | Phase |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------- | ----- |
| REQ-P01 | A committed change is saved automatically within 1 s of its gesture ending, without blocking input; a gesture in progress is saved once committed. | B-30 [O, medium: saved by the 338–376 ms read]; where the delay starts (R-54) | Decide      | P0    |
| REQ-P02 | A reload restores the document, the camera and the selection; the tool restarts as Selection.                                                      | B-30 [O: scene and scroll on desktop; zoom, selection and tool on mobile]     | Differ      | P0    |
| REQ-P03 | Deleted elements are not kept in the saved document.                                                                                               | B-30 [O, high]                                                                | Adopt       | P0    |
| REQ-P04 | Binary files are stored apart from the document and addressed by their content.                                                                    | backlog 6, a design choice; the reference's file store [H] (R-45)             | Decide      | P2    |
| REQ-P05 | A failed save is reported and retried, never dropped silently.                                                                                     | not observed (R-54)                                                           | Decide      | P0    |
| REQ-P06 | Two tabs never silently overwrite each other's newer saved document.                                                                               | several tabs not observed (R-54)                                              | Decide      | P0    |
| REQ-P07 | Stored and imported documents are validated before use; invalid input is rejected whole with a message, never partially applied.                   | the boundary rule in AGENTS.md                                                | Decide      | P0    |
| REQ-P08 | After one online load, the app starts offline with the stored document.                                                                            | B-44 [O, mobile]                                                              | Adopt       | P2    |

## Model-shaping behaviour

These are implemented after P0, but the P0 document model must be able to hold them without a
breaking schema change.

| ID      | Requirement                                                                                                                                                      | Basis                                                                                                 | Disposition | Phase |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------- | ----- |
| REQ-M01 | An arrow end released near a shape binds to it; the binding is visible from both elements, and moving or erasing the target moves or drops the end.              | B-04 [O: two desktop cases, the mobile ladder and a moved target]; B-29 [O, mobile]; placement (R-42) | Decide      | P1    |
| REQ-M02 | A shape's text label is centred in it and moves, copies and deletes with it.                                                                                     | B-07 [O]; B-13 paste [O]                                                                              | Adopt       | P1    |
| REQ-M03 | A sticky note is a square centred on the click whose text goes into its centred label; a long text lowers the label's font to 16, then grows the note downwards. | B-08 [O, mobile]; A-18 order [I]                                                                      | Adopt       | P1    |
| REQ-M04 | Elements form groups, nested groups included; grouping and ungrouping are one undo step each.                                                                    | B-22 [O]; nesting (R-49)                                                                              | Decide      | P1    |
| REQ-M05 | Four layer commands move the selection one step or all the way forward or backward in the drawing order.                                                         | B-24 [O, mobile]; A-02 [I]                                                                            | Adopt       | P1    |
| REQ-M06 | Style changes apply to the selection and become the defaults; fill options show only when there is a background.                                                 | B-20 and B-21 [O]                                                                                     | Adopt       | P1    |
| REQ-M07 | Elements can be locked and unlocked, and a lock keeps their bindings.                                                                                            | B-19 [O]                                                                                              | Adopt       | P1    |
| REQ-M08 | An element can carry one link with a safe scheme, opened only by an explicit action.                                                                             | B-42 [O, mobile]; following a link (R-11)                                                             | Decide      | P1    |
| REQ-M09 | A frame holds elements and can wrap a selection with a margin.                                                                                                   | B-34 Wrap selection in frame [O, mobile]                                                              | Decide      | P2    |
| REQ-M10 | An image element refers to a stored file and is inserted at its natural size, centred on the drop point.                                                         | B-09 [O, high]                                                                                        | Adopt       | P2    |

## Interchange

| ID      | Requirement                                                                                                   | Basis                                                           | Disposition | Phase |
| ------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ----------- | ----- |
| REQ-X01 | Copy writes a typed, versioned Planewright payload; paste centres the copies on the pointer and selects them. | B-26 [O; the payload shape raw only]; the selection rule (R-53) | Decide      | P1    |
| REQ-X02 | Pasting plain text creates one selected text element, as one undo step.                                       | B-26 [O, mobile]                                                | Adopt       | P1    |
| REQ-X03 | Open and save use the platform file picker where there is one, with a download and upload fallback.           | backlog 17; B-32 [H for the reference's picker] (R-46, R-18)    | Decide      | P2    |
| REQ-X04 | PNG and SVG export draw with the canvas's geometry, and the export's dark-mode default follows the theme.     | B-28a [O]; B-27 [O, mobile, raw only] (R-16, R-53)              | Decide      | P2    |

## Collaboration readiness

| ID      | Requirement                                                                                                                    | Basis                                                | Disposition | Phase |
| ------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- | ----------- | ----- |
| REQ-K01 | Every document change is a serialisable change set that can be applied from another origin without entering the local history. | backlog 18; B-33 (R-55)                              | Decide      | P0    |
| REQ-K02 | Element identifiers are unique without coordination, and drawing order and concurrent edits merge deterministically.           | A-02 [I]                                             | Decide      | P0    |
| REQ-K03 | Undo of a local change leaves in place a property that another origin has changed since.                                       | not observed (R-55)                                  | Decide      | P0    |
| REQ-K04 | A room's key stays in the URL fragment, and room updates are end-to-end encrypted.                                             | B-33 [O]; backlog 18; the reference's encryption [H] | Decide      | P2    |

## Accessibility

| ID      | Requirement                                                                                                                                                      | Basis                                                                                | Disposition | Phase |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------- | ----- |
| REQ-Y01 | Every control has an accessible name, and a toggle exposes its state as a state, not in its name.                                                                | R-28 [O: unnamed and raw-named controls]; B-37 a check mark in the name [O, mobile]  | Differ      | P0    |
| REQ-Y02 | Tab reaches every control in a logical order, every focused element shows a visible focus indicator, and Escape returns focus to the control that opened a menu. | B-43 [O, mobile: Tab never left a container, no ring, focus left on the body] (R-27) | Differ      | P0    |
| REQ-Y03 | Toolbars use the toolbar role with arrow-key movement, and menus use menu and menuitem roles.                                                                    | feature inventory §2 [O: no menu role]; backlog accessibility section                | Differ      | P0    |
| REQ-Y04 | Selection changes, command results, undo and redo are announced in a polite live region.                                                                         | B-43 [O: no live region]                                                             | Differ      | P0    |
| REQ-Y05 | The canvas content is also a keyboard-operable list of elements with their kind, text and geometry, from which elements are selected, nudged and deleted.        | not observed (R-27)                                                                  | Decide      | P0    |
| REQ-Y06 | Touch targets are at least 24 × 24 CSS px, interface text meets 4.5:1 contrast in each theme, and the camera never animates when reduced motion is requested.    | not observed                                                                         | Decide      | P0    |

## Performance

| ID      | Requirement                                                                              | Basis                   | Disposition | Phase |
| ------- | ---------------------------------------------------------------------------------------- | ----------------------- | ----------- | ----- |
| REQ-F01 | Panning, zooming and dragging a selection keep 60 frames per second with 5,000 elements. | not observed            | Decide      | P0    |
| REQ-F02 | A pointer move shows its effect in the next frame.                                       | not observed            | Decide      | P0    |
| REQ-F03 | Saving never blocks input for longer than one frame.                                     | B-30 timing [O, medium] | Decide      | P0    |
| REQ-F04 | The editor is interactive within 1.5 s of a cached load holding 1,000 elements.          | not observed            | Decide      | P0    |

The budgets that make these measurable, and how each is measured, are in the quality document of
this directory.

## Intentional differences

Planewright differs from these observations on purpose. Each difference is repeated in the feature
issue that implements it.

- **REQ-V07, pinch anchor.** Along the pinch axis the reference's fixed point lay 34.5–111.5 px
  from the finger midpoint, varying between sessions (B-36). Planewright anchors exactly at the
  midpoint, so the content under the fingers stays under them.
- **REQ-V09, vertical fit.** The reference centred one scene horizontally but not vertically.
  Planewright centres both axes, so the result does not depend on the content's position.
- **REQ-S13, selection and undo.** On mobile, Undo after a selection-only change restored the
  earlier selection without touching any element. Planewright keeps undo for document changes, so
  Undo after a few clicks still reverses the last edit; each entry restores the selection around
  its change, which keeps the observed "undo brings back what was selected" effect.
- **REQ-S14, long press.** The reference narrowed a multi-selection on a long press but kept it on
  a right click. Planewright treats both as the same request for a context menu.
- **REQ-H05, tool after undo.** Planewright never switches tools on undo; a restored selection is
  shown with whatever tool is active.
- **REQ-H07, link edits.** A link edit made no undo step of its own in the reference [I];
  Planewright makes every document command one step, as the backlog asks.
- **REQ-P02, tool after reload.** The reference restored the tool; Planewright starts with the
  Selection tool so that a reload never starts in a creation tool.
- **REQ-Y01 to REQ-Y04, accessibility.** The baseline lists unnamed controls, names that carry
  state, no menu roles, Tab trapped in a container and no live region. Planewright meets the
  backlog's "do better" list instead.

## What stays open

- The desktop observations that the verification page stopped (readiness) and the native file
  pickers are not reopened. Each requirement they touch is a **Decide** row, and its feature issue
  may observe the reference again only through a new investigation issue.
- The final review's 8 minor findings and 6 suggestions concern the research tooling and records,
  not engine behaviour; none changes a requirement here.
- Values that a Decide row fixes, such as the zoom ladder or the hit tolerances, are defined once
  in the design document of their area and tested there.
