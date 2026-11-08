# Selection, transforms, input and tools

This document specifies how input becomes document changes: the input pipeline and gesture
recogniser, the tool state machines, the selection and transform model, text editing and the
command registry ([ADR 0008](../../adr/0008-input-tools-and-commands.md)). Hit testing is in
[rendering and hit testing](rendering-and-hit-testing.md#hit-testing); how changes become undo
steps is in [history](history.md).

## Input pipeline

```text
DOM pointer, wheel and key events (canvas host, apps/web)
  → input adapter: canvas-relative screen points, pointer kind, modifiers, Mod per platform
  → engine InputEvent
  → gesture recogniser ──► camera gestures → viewport controller (any tool)
                       └─► tool gestures   → active tool reducer → effects → editor
```

```ts
export type PointerKind = 'mouse' | 'pen' | 'touch';

export interface Modifiers {
  readonly shift: boolean;
  readonly alt: boolean;
  readonly mod: boolean; // Cmd on macOS, Ctrl elsewhere (REQ-V05)
}

export type InputEvent =
  | {
      readonly type: 'pointer-down' | 'pointer-move' | 'pointer-up' | 'pointer-cancel';
      readonly pointerId: number;
      readonly pointer: PointerKind;
      readonly button: 'primary' | 'middle' | 'secondary';
      readonly at: Point; // screen space
      readonly pressure?: number; // [0, 1] when the device reports it
      readonly modifiers: Modifiers;
      readonly time: number;
    }
  | {
      readonly type: 'wheel';
      readonly at: Point;
      readonly delta: Point; // pixels
      readonly zoom: boolean; // Mod held, or Ctrl as browsers report a trackpad pinch
      readonly modifiers: Modifiers;
      readonly time: number;
    }
  | {
      readonly type: 'key-down' | 'key-up';
      readonly key: string;
      readonly code: string;
      readonly repeat: boolean;
      readonly modifiers: Modifiers;
      readonly time: number;
    }
  | { readonly type: 'focus-lost'; readonly time: number };
```

The adapter reads coalesced pointer events for freehand strokes, captures the pointer on press,
releases it on release or cancel, and sends `focus-lost` when the window loses focus so that a held
Space or an open gesture is released. Events that start on interface chrome never reach the adapter,
because chrome sits outside the canvas host (REQ-C11).

## Gesture recogniser

The recogniser turns input events into gestures with thresholds in screen pixels:

| Gesture     | Rule                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------ |
| drag        | the pointer moves more than 3 px (mouse, pen) or 6 px (touch) from where it was pressed          |
| tap         | released before becoming a drag; a touch or pen tap must also be shorter than 500 ms             |
| double tap  | two taps within 400 ms and 8 px                                                                  |
| long press  | a touch or pen press held 500 ms without becoming a drag (opens the context menu in P1, REQ-S14) |
| two-pointer | a second touch pointer goes down: the current tool gesture is cancelled and pinch and pan begin  |
| camera drag | a middle-button drag, a primary drag while Space is held, or any drag with the Hand tool         |

Camera gestures and every wheel event go to the viewport controller whatever the tool (REQ-V01,
REQ-V04, REQ-V06, REQ-V07). After a two-pointer gesture, a finger left on the screen does nothing
until it lifts, so lifting fingers one at a time never draws. Space+drag leaves the tool unchanged.

## Tools

Each tool is a reducer over its own state. Tools never mutate the scene; they return effects.

```ts
export type GestureEvent =
  | {
      readonly type: 'press' | 'drag-start' | 'drag' | 'release';
      readonly at: Point;
      readonly scene: Point;
      readonly pointer: PointerKind;
      readonly modifiers: Modifiers;
      readonly pressure?: number;
    }
  | {
      readonly type: 'tap' | 'double-tap';
      readonly at: Point;
      readonly scene: Point;
      readonly pointer: PointerKind;
      readonly modifiers: Modifiers;
    }
  | { readonly type: 'key'; readonly key: string; readonly modifiers: Modifiers }
  | { readonly type: 'cancel' };

export type ToolEffect =
  | { readonly type: 'preview'; readonly changes: ChangeSet }
  | { readonly type: 'commit'; readonly label: HistoryLabel; readonly mergeKey?: string }
  | { readonly type: 'cancel' }
  | { readonly type: 'select'; readonly ids: readonly ElementId[] }
  | { readonly type: 'set-tool'; readonly tool: ToolId }
  | { readonly type: 'cursor'; readonly cursor: CursorKind }
  | { readonly type: 'marquee'; readonly box: Box | null }
  | { readonly type: 'edit-text'; readonly id: ElementId };

export interface ToolContext {
  readonly scene: SceneReader;
  readonly camera: Camera;
  readonly selection: SelectionState;
  readonly hit: (at: Point, pointer: PointerKind) => HitResult;
  readonly defaults: Style;
  readonly toolLock: boolean;
  readonly newId: () => ElementId;
}

export interface Tool<State> {
  readonly id: ToolId;
  readonly initial: State;
  reduce(
    state: State,
    event: GestureEvent,
    context: ToolContext,
  ): { readonly state: State; readonly effects: readonly ToolEffect[] };
}
```

### P0 tools

| Tool                        | States                                                                                                    | Behaviour                                                                                                                                                                  | Requirements                                         |
| --------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Selection                   | idle, pressing element, pressing selection box, pressing empty, moving, resizing, rotating, box selecting | see [Selection tool](#selection-tool)                                                                                                                                      | REQ-S01 to REQ-S13, REQ-T01 to REQ-T07               |
| Hand                        | idle, panning                                                                                             | a drag pans the camera by the pointer delta                                                                                                                                | REQ-V06                                              |
| Rectangle, ellipse, diamond | idle, drawing                                                                                             | a drag previews the shape over the normalised drag box and commits it on release; a tap commits a 100 × 100 shape centred on the tap                                       | REQ-C01, REQ-C02, REQ-C04, REQ-C05, REQ-C12, REQ-C13 |
| Line                        | idle, drawing                                                                                             | a drag previews a two-point line from press to pointer; a tap commits a 100-unit horizontal line centred on the tap                                                        | REQ-C01, REQ-C03, REQ-C05                            |
| Freehand                    | idle, stroking                                                                                            | a drag appends a point whenever the pointer has moved 1 screen pixel, with its pressure if reported; release commits; a tap commits a one-point dot; the tool stays active | REQ-C06, REQ-C07, REQ-C08                            |
| Text                        | idle                                                                                                      | a tap creates an empty text whose left edge is at the tap and whose first line is centred vertically on it, and starts editing it                                          | REQ-C09, REQ-C10                                     |

After a shape or line is committed the editor selects it alone and switches to the Selection tool,
unless tool lock (Q) is on: then the tool stays and nothing new is selected (REQ-C05). Choosing a
creation tool clears the selection. Escape during a gesture cancels it and reverts its preview;
Escape with no gesture clears the selection and returns to the Selection tool (REQ-S10).

### Selection tool

- **Press on a handle** then drag: resize or rotate (below).
- **Press on an element**: if it is not selected, it becomes the selection (or is added with
  Shift); a drag then moves the selection (REQ-T01). A Shift+tap on a selected element removes it
  (REQ-S05). A double tap on a text edits it (REQ-C10).
- **Press inside the selection box** on no element: a drag moves the selection; a tap falls through
  to what is under the point, or clears the selection.
- **Press on empty canvas**: a drag draws a marquee and selects the elements it encloses on release,
  added to the selection with Shift (REQ-S06); a tap clears the selection (REQ-S10, REQ-T07).
- **Mod+A** selects every selectable element (REQ-S09).

## Selection model

```ts
export interface SelectionState {
  readonly ids: readonly ElementId[]; // unique, in the order they were selected
  readonly editing?: ElementId; // the text being edited, if any
}
```

- The selection never holds a missing element: a removal or an undo filters it.
- ENG-06 holds the identifiers in `createSelection` in the `selection` module, which also defines
  `PointerKind`; `editing` joins the state with the text tool (ENG-12).
- In P1, a selected group member widens to all members of its outermost group (REQ-S11), and locked
  elements are never selected by pointer, marquee or Select all (REQ-S08).
- The **selection outline** is the element's rotated box when one element is selected and the
  axis-aligned box of the selected elements' rotated corners when several are.
- Selection-only changes are not history entries, but every entry records the selection before and
  after it (REQ-S13, [history](history.md#entries-and-selection)). The announcer reports the new
  count after each selection change (REQ-Y04).

## Transforms

A transform gesture records the selected elements' values when it starts and recomputes the whole
result from them on every move, so rounding errors never accumulate. Each gesture commits one
history entry (REQ-T11).

- **Move.** The delta runs from the press's scene point, read with the camera of the press, to
  `sceneFromScreen(current)` with the current camera, so a wheel pan during a drag keeps the
  selection under the pointer (ENG-10). No snapping in P0 (REQ-T01).
- **Resize, one element.** The pointer is turned into the element's local frame about its starting
  centre. The dragged edges follow it and the opposite corner or side stays fixed in scene space;
  the new origin is solved from that fixed point (REQ-T02). Shift keeps the aspect ratio by taking
  the larger scale; Alt fixes the centre instead and doubles the change (REQ-T04). Sizes stop at 1
  unit and never flip (REQ-T05). Point kinds scale their points by the box's ratios and are
  normalised again. A text's corner handle scales its font size by the height ratio; texts have no
  side handles in P0.
- **Resize, several elements.** The fixed point is the opposite corner or side of the selection
  outline; each element's centre and size scale by the drag's ratios (REQ-T03). If any selected
  element is rotated by an angle that is not a multiple of 90°, the aspect ratio is kept, so no
  element is skewed.
- **Zero sizes.** A ratio is a box's new size over its old size along one axis. Where the box, or
  the selection outline, has no extent along an axis, as for a horizontal line, a row of them, a
  freehand dot or a flat stroke, that axis keeps the ratio 1. A dimension that is already 0 stays
  0, so nothing divides by zero, and only positive sizes stop at 1 unit (REQ-T05).
- **Rotate.** The angle is the change in the pointer's direction around the outline's centre;
  Shift rounds the total to 15° steps (REQ-T06). One element turns about its centre; several turn
  their centres about the outline's centre and add the angle to their own rotation.
- **Two-point line ends.** Dragging the `start` or `end` handle moves that point only.
- **Duplicate (Mod+D).** Copies with new identifiers, offset by +10, +10, ordered just above their
  originals, and selected (REQ-T08).
- **Delete (Delete, Backspace).** Removes the selection; the change set also drops attachments and
  empty groups that depended on it (REQ-T09).
- **Nudge.** Arrow keys move the selection by 1 unit, Shift+arrow by 10; repeats of one held key
  merge into one entry (REQ-T10).

## Text editing

The engine holds a text session: the element, whether it is new, and its starting content. The web
app shows a text area over the canvas at the element's screen position, scaled by the zoom and
rotated by the element, with the element hidden from the scene layer.

```ts
export type TextEdit =
  | { readonly type: 'value'; readonly text: string } // the text area's whole value
  | { readonly type: 'commit' }; // Escape or Mod+Enter in the text area
```

- The web app sends each input as `editText({ type: 'value', text })`, which updates the element
  transiently and re-measures its size; a new left-aligned text keeps its top-left corner after
  creation.
- Enter inserts a line break. Escape and Mod+Enter in the text area send a `commit` edit; a press
  outside the text, which reaches the engine through `input`, and a tool change commit too.
- A session is one history entry; a new text left empty is removed without an entry, and an
  existing text emptied is deleted as one entry (REQ-C10).
- While the text area has focus, editor shortcuts are paused.

## Commands and shortcuts

```ts
export interface KeyChord {
  /** The produced character in lower case or, with `physical`, a `KeyboardEvent.code`. */
  readonly key: string;
  readonly physical?: true;
  readonly mod?: true;
  readonly shift?: true;
  readonly alt?: true;
}

export interface Command {
  readonly id: CommandId;
  readonly label: MessageKey;
  readonly shortcuts: readonly KeyChord[];
  isEnabled(view: EditorView): boolean;
  run(context: CommandContext): CommandOutcome;
}
```

The toolbar, menus, palette, help, accessible descriptions (REQ-C14) and the keymap all read this
registry. P0 commands and their shortcuts; digits follow the order of Planewright's toolbar:

| Command                     | Shortcuts            | Requirements |
| --------------------------- | -------------------- | ------------ |
| Selection tool              | V, 1                 | REQ-C14      |
| Hand tool                   | H                    | REQ-V06      |
| Rectangle, ellipse, diamond | R, 2; O, 3; D, 4     | REQ-C14      |
| Line, freehand, text        | L, 5; P, 6; T, 7     | REQ-C14      |
| Tool lock                   | Q                    | REQ-C05      |
| Undo                        | Mod+Z                | REQ-H01      |
| Redo                        | Mod+Shift+Z, Mod+Y   | REQ-H01      |
| Select all                  | Mod+A                | REQ-S09      |
| Duplicate                   | Mod+D                | REQ-T08      |
| Delete                      | Delete, Backspace    | REQ-T09      |
| Nudge                       | arrows; Shift+arrows | REQ-T10      |
| Zoom in, out, reset         | Mod+=, Mod+−, Mod+0  | REQ-V02      |
| Zoom to fit                 | Shift+1              | REQ-V09      |
| Cancel, clear selection     | Escape               | REQ-S10      |

Letter shortcuts match the produced character in lower case and fall back to the physical key on
layouts without Latin letters. Digit shortcuts, Mod+0 included, match the physical key (`Digit0` to
`Digit9`), so they work on layouts such as AZERTY where a digit needs Shift, and `1` and `Shift+1`
stay apart by the Shift modifier alone. Zoom in accepts the produced `=` or `+`, and zoom out `-`,
`−` or `_`, with or without Shift, wherever the layout puts them. The editor prevents the browser's
default action only for chords it handles while the canvas host or a toolbar has focus, so browser
zoom stays available elsewhere.

## What ENG-08 decided

ENG-08 implements the input events, the gesture recogniser and the viewport routing in the
engine's `input` layer, the Hand tool in `tools`, the command registry, keymap and default commands
in `commands`, and `createEditor` in `editor`; in `apps/web` it adds the canvas host, the input
adapter, the editor provider, the tool bar and the Undo and Redo controls. It decided what the rules
above leave open:

- **Gestures.** A drag starts once the pointer is strictly farther from where it was pressed than
  the threshold, measured as a distance. A tap is reported at the press point; the second tap of a
  double tap is reported as the double tap alone, and counting then starts again, the 400 ms running
  from one release to the next. A touch or pen press that became a long press, or lasted 500 ms,
  ends with a release, not a tap. The long-press timer runs on the `Scheduler` port, and nothing
  acts on a long press until the context menu (P1); secondary-button presses are ignored until then
  too.
- **Camera drags.** A middle-button drag and a primary drag while Space is held pan by each move's
  delta from the press and never reach the tool. Space is read from key events with the code
  `Space` and released on focus loss. A pointer the recogniser never saw pressed, such as one
  pressed on the tool bar, is ignored (REQ-C11).
- **The Hand tool.** A reducer with idle and panning states whose drag returns a `pan` effect by the
  pointer delta, so a second finger cancels it like any tool gesture. The tool effects so far are
  `pan` and `cursor`, and the tool context holds only the camera; the others join with the tools
  that need them.
- **Two pointers.** A second touch pointer cancels the tool's gesture and starts a pinch from where
  both pointers are; a third is ignored. When one of the two lifts, the other does nothing until it
  lifts, and a new finger pinches with it again.
- **The default tool.** The Selection tool is registered with V and 1 as the default tool, so that
  the tool bar and Space+drag have a tool that is not the camera's, but it had no behaviour until
  ENG-09 gave it one; until then its description and the page said that selecting did not work.
- **Commands.** A command's label is its English name until the interface has message keys. The
  registry refuses a repeated identifier and a shortcut that two commands share, and a chord's
  modifiers must match exactly. Zoom in and out list one chord per produced key, with and without
  Shift. The commands so far are the Hand and Selection tools, Undo, Redo, zoom in, zoom out, reset
  zoom and zoom to fit.
- **The editor.** `createEditor(ports)` has the parts the editor surface needs: `view`, `commands`,
  `input`, `run`, `resize`, `onFrame`, `subscribe` and `dispose`; `select`, `editText`, `saveNow`,
  `resolveStale` and a stored document join with their issues. Its ports are those its parts use:
  the clock and the identifier source, for the history's entries and change stamps, and the
  scheduler. The text measurer joins with its first engine caller; the web app gives the renderer
  one of its own. `input` returns true for a wheel event and for a key press that is a command's
  chord, and the canvas host prevents the browser's default for those, and for Space so that the
  page does not scroll. The first viewport the canvas host reports keeps the camera; later ones keep
  the viewport's centre in place.
- **Frames.** The editor exposes `onFrame` and no pull of a frame, so the render loop's pull and
  push, which share its dirty marks, never compete. The loop does not check the camera in `update`:
  the editor gives it only cameras from the camera layer, which are finite and within the limits.
- **The web app.** The page creates one editor for its lifetime and gives it, with the platform and
  the renderer factory, to the editor provider; components read the view through
  `useSyncExternalStore`. Mod is Cmd when `navigator.userAgentData.platform`, or else
  `navigator.platform`, names a Mac, iPhone, iPad or iPod. Coalesced pointer events are read with
  the freehand tool (ENG-11). Panning an empty canvas changes no pixel, so the page shows the
  camera's position and zoom as text.

## What ENG-09 decided

ENG-09 implements the Selection tool in the engine's `tools` layer, Select all and Escape in
`commands`, and the selection's place in `createEditor`; in `apps/web` it updates the factual text
and fixes two adapter defects that broke selection presses. It decided what the rules above leave
open:

- **Presses.** The tool reads the hit test's first match at the press: a handle, an element, the
  selection box or nothing. A press on an unselected element selects it at once, or adds it with
  Shift, so that the drag ENG-10 adds moves it; a press on a selected element, a handle or the
  selection box changes nothing. A Shift+tap removes an element only if it was selected before its
  press, so the Shift+press that added an element never removes it on release.
- **Shift.** Each effect reads the modifiers of the gesture that makes it: the press for adding an
  element, the tap for removing one and the release for adding a marquee's elements.
- **Taps.** A tap inside the selection box on no element falls through to what is under the
  point; the hit order already puts every element before the selection box, so nothing is there,
  and the tap clears the selection like a tap on empty canvas, with or without Shift (REQ-S10,
  REQ-T07). A double tap acts as a tap until a double tap on a text edits it (ENG-12), so the false
  double taps of the ENG-08 review's s6 cannot lose a removal or a clearing tap, and the recogniser
  keeps its rule until then. A touch press held for 500 ms ends with a release, not a tap, so it
  changes nothing until the context menu (P1).
- **The marquee.** It runs from the press's scene point to the pointer's, in scene units, so its
  start stays on the content if the camera moves during the drag. The selection changes only on
  release: the enclosed elements replace it, or join it with Shift, and a marquee that encloses
  nothing clears it. A cancel, from a second finger, a cancelled pointer, focus loss or Escape,
  removes the marquee and leaves the selection as it was.
- **Before ENG-10.** The states are `idle`, `pressing-handle`, `pressing-element`,
  `pressing-selection-box`, `pressing-empty` and `box-selecting`. Drags from a handle, an element
  or the selection box change nothing and only wait for the release; ENG-10 adds moving, resizing
  and rotating.
- **Select all and Escape.** Mod+A runs `selection.select-all`, which selects every element of a
  kind that has a geometry, in drawing order, since only those are drawn, hit and box-selected in
  P0; a locked element stays selectable until locks (P1, REQ-S08). Escape runs `selection.cancel`:
  if the tool has an open gesture, the recogniser cancels it as a cancelled pointer would, and the
  pointer does nothing until it lifts; otherwise the selection clears and the Selection tool
  becomes active. A camera drag is not a tool gesture, so Escape during one clears the selection
  while the drag goes on. Both work in any tool, and neither is an undo step.
- **Tool changes.** Choosing another tool, by its key or from the tool bar, first cancels the
  active tool's gesture, as Escape does: the old tool removes what its gesture shows, such as a
  marquee, and the pointer does nothing until it lifts. Choosing the tool that is already active
  changes nothing. (The independent review of ENG-09 found the marquee stuck on the overlay
  without this.)
- **The editor.** It holds the selection beside the scene store and the history, reports it in
  `view.selection` and replaces it with `select(ids)`, which keeps the elements the document holds,
  each once, in order. Before each publish it gives the selection to the render loop, whoever
  changed it (a tool, a command, the history or a removal); a selection with the same elements in
  the same order asks for no frame and publishes no view. The handles are drawn for the pointer of
  the last press. The tool context holds the camera, the scene, the selection and the hit test.
- **Opening a document.** Until persistence (ENG-13) gives `createEditor` a stored document, the
  editor opens an empty one. `openEditor(ports, document)` loads a document as one `load` change
  set, without an undo step and with nothing selected; the entry does not export it. The engine's
  integration tests open fixture documents with it, and drawing elements to select them end to end
  is ENG-11's check.
- **Handles.** A lone text has its corners and rotation handle and no side handles (the ENG-06
  review's m3); a selection of several elements keeps its side handles, on the selection outline.
- **The web app.** The canvas host lets Space go when it loses focus, and the input adapter ignores
  the back and forward buttons only on a press, taking the buttons held for their move, release or
  cancel (the ENG-08 review's m1 and m2), so that a selection press is never turned into a camera
  drag and a marquee always ends. The Selection button and the page say that the tool selects but
  that nothing can be drawn yet to select.

## What ENG-10 decided

ENG-10 implements the transform maths in the engine's `transform` layer, the Selection tool's
transform gestures in `tools`, Duplicate, Delete and the nudges in `commands`, and the transaction
of a gesture in `editor`; in `apps/web` it updates the factual text. It decided what the rules above
leave open:

- **Gestures.** A transform starts at the drag that follows a press: from an element or the
  selection box it moves the selection, and from a handle it resizes, rotates or moves a line's end;
  with nothing selected it does nothing. It keeps the selected elements and the press's scene point
  as they were, and each move previews the whole result as updates of the fields that differ. The
  delta runs from the press's scene point, read with the camera of the press, to the pointer's, read
  with the current one: that is what keeps the content under the pointer after a wheel pan, which
  the first wording of the move rule above did not. The release commits; a cancel from Escape, a
  tool change, a second finger, a cancelled pointer or focus loss reverts with no undo step.
- **Effects and transactions.** A tool returns `preview` with a change set that the editor stamps,
  `commit` with a history label and `cancel`. The editor opens the history's transaction at a
  gesture's first preview, even an empty one, so from the drag's start Undo and Redo change nothing
  and their commands report that they are disabled (REQ-H06); a press that has not become a drag is
  not a gesture yet. The labels are `move`, `resize`, which a line's end uses too, and `rotate`.
  Each gesture's entry holds the selection when its transaction opened, after the press selected,
  and when it committed (REQ-S13).
- **Resizing.** The dragged edges follow the pointer's delta, not its position, so a drag started a
  few units outside a handle, as B-16's were, moves the side by exactly the drag. Shift takes the
  larger ratio of the dragged axes that have extent, and on a side handle the other side follows
  about its middle; Shift and Alt combine. A size stops at 1 unit, or at its own size when that is
  already smaller, so nothing jumps. A text always keeps its aspect ratio and its font size stays
  within the document's limits, 1 to 1000: the ratios stop there, and the scaled size is clamped to
  them too, because the ratios come from divisions and could otherwise land one rounding step past
  them, which the scene store refuses (the independent review's M1); its measured size scales with
  the font and is measured again only once the text measurer joins the engine (ENG-12). In a
  selection, a text scales by the ratio along its own height, a quarter-turned element scales each
  of its sides by the ratio of the scene axis it lies along, and the ratios also stop where any
  element's positive size or font size would go below 1.
- **Rotating.** One element's own rotation plus the turn is the total that Shift rounds; several
  elements turn by the turn, which Shift rounds, since their outline has no rotation of its own.
- **Commands.** `selection.duplicate` (Mod+D), `selection.delete` (Delete, Backspace) and
  `selection.nudge-left`, `-right`, `-up` and `-down`, each also with `-10` for Shift, run only with
  a selection and while no gesture's transaction is open. Each applies one change set through the
  command target's `edit`, one transaction and one undo step. A copy is ordered between its original
  and the next key above it, keeps every other field, its group included, and the copies are
  selected in the selection's order. Delete also drops the attachments of connectors that point at
  what it removes and the groups it leaves empty, up through their parents.
- **Held keys.** A nudge's merge key names its key press: the editor counts each key press that is
  not a repeat and each `run`, so the repeats of one held key merge into one undo step within the
  history's 1 s burst, and the next press, another arrow or a Shift change makes another.
- **The selection after a command.** `edit` selects before the commit, which records the selection
  for redo, and again after it, because the commit's transient revert drops the elements that its
  preview added from the selection. That is the ENG-06 review's m2, which stays open for the
  selection layer.
- **Cameras.** Selection (the ENG-09 review's m2) and transforms are also tested at zoom 2 with a
  panned camera, where a screen point is not the scene point.
- **Not here.** Handle cursors; arrows that follow the elements they are attached to (P1);
  re-measuring texts (ENG-12); flips (P1), snapping and groups, which are out of scope. The web app
  has nothing to transform until ENG-11 lets people draw.

## Requirements served

REQ-C01 to REQ-C14, REQ-S01 to REQ-S14, REQ-T01 to REQ-T11, REQ-V01, REQ-V02, REQ-V04 to
REQ-V07, REQ-V09 and REQ-Y04.
