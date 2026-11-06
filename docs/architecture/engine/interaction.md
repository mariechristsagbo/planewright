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

- **Move.** The delta is `sceneFromScreen(current) − sceneFromScreen(start)` with the current
  camera, so a wheel pan during a drag keeps the selection under the pointer. No snapping in P0
  (REQ-T01).
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
  readonly key: string;
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
layouts without Latin letters. The editor prevents the browser's default action only for chords it
handles while the canvas host or a toolbar has focus, so browser zoom stays available elsewhere.

## Requirements served

REQ-C01 to REQ-C14, REQ-S01 to REQ-S14, REQ-T01 to REQ-T11, REQ-V01, REQ-V02, REQ-V04 to
REQ-V07, REQ-V09 and REQ-Y04.
