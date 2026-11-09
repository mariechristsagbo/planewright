# Scene store and infinite viewport

This document specifies the `scene` and `camera` layers ([modules](modules.md#engine-layers)): how
the document is held and changed in memory, which relations are indexed, and how screen and scene
coordinates relate on an unbounded canvas.

## The scene graph

Planewright's scene is a flat set of elements ([domain model](domain-model.md)) plus four relations,
each held as data and indexed in memory. There is no tree of nested transforms
([ADR 0005](../../adr/0005-document-model.md)).

| Relation      | Stored as                                | Index kept by the store                                | Used by                                        |
| ------------- | ---------------------------------------- | ------------------------------------------------------ | ---------------------------------------------- |
| Drawing order | each element's `order` key               | the element identifiers sorted by key, then identifier | rendering, hit testing (topmost first), layers |
| Space         | each element's box and rotation          | a spatial index of each element's world bounds         | culling, hit testing, box selection            |
| Groups        | group records and each element's `group` | members per group, outermost group per element         | selection expansion, group moves (P1)          |
| Attachments   | a connector end's `target`               | connector ends per target                              | moving bound ends, removing targets (P1)       |

An element's **world bounds** are the axis-aligned bounds of its rotated local box, grown by half
its stroke width and, for a label that overflows, by the label's box. ENG-03 computes them in the
`geometry` layer, the home of bounds, without the label's term: measuring a label needs the text
layout, which the geometry issue (ENG-06) delivers, and a measurer, which the store does not hold,
so a label's box counts from the P1 label issue (REQ-M02) on.

The group index lists, for each group, the elements in it or in any group nested in it, so
`members` of an outermost group is what selection expands to; a group's parent never changes while
it exists, so an element's outermost group changes only when its own `group` does.

## Change sets

The store changes only by applying a change set ([ADR 0007](../../adr/0007-history-model.md),
[ADR 0010](../../adr/0010-collaboration-ready-change-model.md)):

```ts
export type ChangeOrigin = 'local' | 'history' | 'load' | 'remote';

/** A partial element of the same kind, without `id`, `kind` and `rev`; `null` means absent. */
export type ElementPatch = Readonly<Record<string, unknown>>;

export type ElementChange =
  | { readonly type: 'add'; readonly element: Element }
  | { readonly type: 'remove'; readonly element: Element }
  | {
      readonly type: 'update';
      readonly id: ElementId;
      readonly before: ElementPatch;
      readonly after: ElementPatch;
    };

export type GroupChange =
  | { readonly type: 'add'; readonly group: GroupRecord }
  | { readonly type: 'remove'; readonly group: GroupRecord };

export interface ChangeSet {
  readonly elements: readonly ElementChange[];
  readonly groups: readonly GroupChange[];
  readonly canvas?: { readonly before: CanvasState; readonly after: CanvasState };
  readonly author: ClientId;
  readonly seq: number;
}
```

`ElementPatch` is checked per kind by the model layer before it reaches the store; the loose type
only keeps the union of kinds out of every signature. The patched element must pass the codec's own
element check, so the store never holds what a document could not. An identifier appears in at most
one element change and at most one group change of a set, so the order of a set's changes does not
matter, and an update names the same fields in `before` and `after`, so that it inverts exactly. No element field holds `null` at the top
level, so there `null` means that an optional field is absent: an `after` of `null` removes the
field and a `before` of `null` says that it was absent. Clearing a `group`, `link`, `label`,
`pressures`, `crop` or an arrow's `start` or `end` is therefore valid JSON, where `undefined` would
vanish. A nested value such as `style` is replaced whole, so its own `fill: null` keeps its
meaning.

Applying a change set is atomic:

1. Every change is checked against the current state: an added identifier must be new, a removed or
   updated element or a removed group must exist and, for `local` and `history` origins, its
   current fields must equal `before` (a removed element or group must equal the current one, the
   element's revision aside, and so must the canvas's `before`). What the set leaves is checked
   too: valid elements, at most 100,000 of them, and references that exist, namely each element's
   group, each arrow's targets and each new group's parent, with no cycle of parents; so an element
   or group that something the set leaves alone still uses cannot be removed. Only the changed
   elements and groups are read, through the indexes. A failed check rejects the whole set and
   changes nothing: `apply` throws a `ChangeSetError` that lists every reason with its path in the
   set, such as `elements[2].before` and `stale`.
2. The document revision increases by one per applied set, transient sets included, and an updated
   element's revision by one; an added element keeps the revision it carries, so a `load` keeps the
   stored revisions and an undone deletion brings the element back as it was. The indexes are
   updated incrementally for the changed elements only.
3. One `SceneUpdate` is emitted with the origin, whether it is transient, the set, the changed
   identifiers and the new document revision. Autosave saves every origin but `load`, and the
   editor marks the render layers dirty. History does not watch updates: the transaction that
   commits a `local` set records it ([history](history.md#transactions)), so no set is recorded
   twice. A listener cannot apply a set of its own while it is told of one. A listener that throws
   cannot keep the update from the others: every listener is told, and the first error is then
   rethrown, with the set applied.

A change set is always complete: the transaction that builds it adds the derived changes before it
is applied, such as re-routing connectors whose target moved (P1, REQ-M01), dropping attachments to
a removed target, or removing a group that lost its last member. Inverting a complete change set
(swapping `add` and `remove`, `before` and `after`) is therefore always valid.

## Transient previews

During a gesture the tool previews its result in the scene, so the renderer and hit testing see it.
The store applies such changes with a `transient` flag: indexes update, but nothing is recorded or
saved. The transaction remembers the first `before` value of every field it touched. On commit it
computes the net change set from those values to the current ones, reverts the previews with one
transient change, and applies the net set once with the `local` origin: the store is back at the
start, so the set's `before` check holds, and autosave sees that one set. Both happen before the
next frame is built, so the reverted state is never drawn. On cancel it applies the remembered
values back as a transient change and nothing else. A transient change never reaches autosave, so
a reload in the middle of a drag restores the last committed state (REQ-P01).

The scene's part is `openTransaction(store)`, which ENG-03 adds: `preview` applies a set as a
transient `local` change, `commit(stamp)` returns the net set it applied with that stamp, or `null`
when every touched field ended where it began, and `cancel` reverts. For an element or group that
the previews added or removed, the net set compares its state at the first touch with its current
one, so an element that a gesture adds and then resizes is one addition. A field that another
origin changed meanwhile and that no preview touched stays out of the net set. A transaction
refuses to add again, in another form, an element or group that it removed, since no change could
express it, and it is used once. History's `Transaction` (ENG-04) adds the label, the merge key and
the recording. A document after a cancel is equal to its start in its elements, groups and canvas;
revisions only grow.

A listener that throws, or a revert that the store refuses, never leaves a transaction half done.
A preview that the store applied is remembered even when one of its listeners throws, so cancel
and commit still account for it. A commit whose revert is applied also applies the net set, and
hands it to an optional callback as soon as the store holds it, before the first listener error is
rethrown; the history records through that callback, so every set the document holds is recorded.
Commit and cancel close the transaction only once their revert is applied, and its `open` flag says
whether it still accepts calls. A revert that the store refuses throws its `ChangeSetError`,
changes nothing and leaves the transaction open with its previews in place: the caller may preview
again, retry the commit or the cancel, or wait. Only another origin can make a revert invalid, for
example a remote arrow that now points at an element a preview added; until that reference goes,
neither the commit nor the cancel can go through, which the collaboration decision revisits
([collaboration](collaboration.md#left-to-the-collaboration-decision)).

## Store interface

```ts
export interface SceneUpdate {
  readonly origin: ChangeOrigin;
  readonly transient: boolean;
  readonly changes: ChangeSet;
  /** The elements added, removed or updated, in the order of the set's changes. */
  readonly changed: readonly ElementId[];
  readonly rev: number;
}

export interface SceneReader {
  readonly rev: number;
  readonly canvas: CanvasState;
  get(id: ElementId): Element | undefined;
  group(id: GroupId): GroupRecord | undefined;
  /** Elements in drawing order, bottom first. */
  ordered(): readonly Element[];
  /** Candidates whose world bounds meet a box; precise tests are the caller's. */
  queryBox(box: Box): readonly ElementId[];
  /** Candidates whose world bounds are within `radius` of a point. */
  queryPoint(point: Point, radius: number): readonly ElementId[];
  outermostGroup(id: ElementId): GroupId | undefined;
  /** The elements in a group or in any group nested in it. */
  members(group: GroupId): readonly ElementId[];
  connectorsOf(target: ElementId): readonly ElementId[];
  /** A copy of the document as it is now. */
  document(): DocumentState;
}

export interface SceneStore extends SceneReader {
  /** Applies the whole set, or throws a ChangeSetError and changes nothing. */
  apply(changes: ChangeSet, origin: ChangeOrigin, options?: { readonly transient: boolean }): void;
  subscribe(listener: (update: SceneUpdate) => void): Cancel;
}
```

A store starts empty, at revision 0, with a canvas, and a document is loaded by applying it as a
`load` change set. ENG-03 added `canvas`, `group` and `document` to the reader, the last for saving
and tests.

## Spatial index

The first implementation is a uniform grid of 512 × 512 scene-unit cells, each listing the
elements whose world bounds touch it. An element whose bounds touch more than 64 cells goes into a
separate list that every query scans, so a huge frame or a long line never fills thousands of
cells. A query reads the cells that its box touches, or scans the occupied cells when those are
fewer, and keeps exactly the elements whose world bounds pass the test; a point query reads one
more cell on each side, so that rounding at a cell's edge never loses one. A box with a negative or
non-finite side, or a negative or non-finite radius, is refused. Queries return candidates in no
particular order; the caller sorts by drawing order when it needs to. The index sits behind `queryBox` and `queryPoint`, so it can become a bounding-volume
hierarchy without any caller changing if the [performance budgets](requirements.md#performance)
are missed.

## Coordinate spaces

- **Screen space**: CSS pixels relative to the canvas host's top-left corner, as the input adapter
  reports them.
- **Scene space**: the document's unbounded plane, in scene units.
- **Device pixels** exist only inside the renderer, which multiplies by the device pixel ratio.

## Camera

```ts
export interface Camera {
  /** The scene point shown at the canvas's top-left corner. */
  readonly x: number;
  readonly y: number;
  /** CSS pixels per scene unit, in [0.1, 30]. */
  readonly zoom: number;
}

export const sceneFromScreen = (p: Point, c: Camera): Point => ({
  x: p.x / c.zoom + c.x,
  y: p.y / c.zoom + c.y,
});

export const screenFromScene = (q: Point, c: Camera): Point => ({
  x: (q.x - c.x) * c.zoom,
  y: (q.y - c.y) * c.zoom,
});
```

The baseline expressed its readings with the convention scene = viewport / zoom − scroll (B-36
[I]); in Planewright's terms the reference's scroll is the negated camera position, which is how
the test vectors below translate its numbers.

### Camera operations

| Operation                 | Rule                                                                                                                                                                                               | Requirements      |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Pan by a drag             | camera position minus the screen delta divided by zoom, so the content follows the pointer exactly                                                                                                 | REQ-V06           |
| Wheel                     | `y` plus `deltaY / zoom`; with Shift, or for a horizontal delta, `x` plus the delta / zoom. Line deltas count 16 px, page deltas one viewport                                                      | REQ-V01           |
| Zoom about a point        | keep the scene point under the anchor: `x' = s.x − anchor.x / zoom'`, likewise for `y`                                                                                                             | REQ-V02, REQ-V04  |
| Mod+wheel, trackpad pinch | factor `exp(−deltaY / 1000)` per event, `deltaY` clamped to ±200, about the pointer; a browser reports a trackpad pinch as a wheel event with Ctrl                                                 | REQ-V04           |
| Keyboard zoom             | next level of the ladder above (in) or below (out) the current zoom, about the viewport centre; reset goes to 1                                                                                    | REQ-V02, REQ-V03  |
| Two-pointer gesture       | zoom = start zoom × current distance / start distance; the scene point under the start midpoint stays under the current midpoint                                                                   | REQ-V07           |
| Limits                    | zoom clamped to `[0.1, 30]` after every operation; position clamped to ±10⁹                                                                                                                        | REQ-V08           |
| Zoom to fit               | content bounds padded by 32 screen px; zoom = min(1, available width / content width, available height / content height), at least 0.1; centred on both axes; nothing happens on an empty document | REQ-V09           |
| Resize                    | the scene point at the viewport centre stays at the centre                                                                                                                                         | none (a decision) |

The keyboard **zoom ladder** is 0.1, 0.25, 0.5, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 2, 3, 4, 6, 8, 12, 16,
24 and 30 (REQ-V03). It contains 0.9, 1 and 1.1, so the observed single steps hold (REQ-V02).

Camera changes are never history entries (REQ-V10); the camera is saved with the session state and
restored on reload (REQ-V11). When reduced motion is requested no camera change is animated, and in
P0 none is animated at all (REQ-Y06).

ENG-05 implements these rules in the `camera` layer as pure functions of a camera and screen-space
input: `panBy`, `wheelPan`, `zoomAbout`, `wheelZoom`, `zoomIn`, `zoomOut`, `resetZoom`,
`zoomToFit`, `twoPointerCamera` and `resizeViewport`, beside `sceneFromScreen` and
`screenFromScene`. Each returns a new camera through one limiting step and never reads or changes
the document; the editor surface (ENG-08) routes input events to them. `ViewportSize`, the canvas
size and pixel ratio of the [render frame](rendering-and-hit-testing.md#render-frame-and-renderer-port),
is defined in this layer, the lowest that needs it; the camera reads only its size.

ENG-05 decided what the accepted rules leave open:

- **Wheel deltas.** The camera takes pixel deltas, as the engine's wheel event carries them; the
  input adapter (ENG-08) turns line deltas into 16 px and page deltas into one viewport. Without
  Shift the vertical part pans `y` and the horizontal part `x`, so a trackpad pans both ways at
  once; with Shift both parts pan `x`, whichever axis the browser reports the delta on. A zoom
  event uses only its vertical delta.
- **Limits.** Zooming clamps the asked zoom before it places the camera, so the anchor stays put
  even when the zoom stops at 0.1 or 30; the position is clamped last, so only the ±10⁹ limit can
  move an anchor. An infinite input stops at the limits, and an input that would leave a NaN in the
  camera, which only a non-finite number can, leaves the camera as it was; a camera that itself
  holds NaN, as stored data could, gives way to the default camera, the origin at zoom 1 (the
  ENG-05 review's m1, fixed by ENG-13), so the camera stays within the limits for every input
  (REQ-V08).
- **Ladder steps.** A level that the zoom equals but for rounding (within 10⁻⁹ of it, relatively)
  does not count, so every step moves; past the last level in either direction the zoom stays at 30
  or 0.1.
- **Zoom to fit.** The content's bounds are the union of the elements' world bounds
  (`contentBounds`, beside the world bounds in `geometry`; a label's box joins them with the P1
  label issue). A
  side without extent, such as a vertical line's width or a dot, leaves the zoom to the other side,
  and a canvas smaller than the padding zooms to 0.1. Without any element the camera stays where it
  is.
- **Two pointers.** The camera is computed each time from the camera and pointers at the gesture's
  start, so no rounding builds up; two pointers that started at one point have no ratio and only
  pan.
- **Results.** Every operation returns a new object, even when nothing changes.

### Test vectors from the baseline

These come from the B-36 table at a 1280 × 720 viewport; each row states the camera it starts
from, translated with camera = −scroll. The camera unit tests must reproduce them within 0.5 scene
units.

| Start camera (x, y, zoom) | Input                                  | Expected camera                                           | Baseline row                |
| ------------------------- | -------------------------------------- | --------------------------------------------------------- | --------------------------- |
| (0, 0, 1)                 | wheel `deltaY` +200                    | (0, 200, 1)                                               | wheel                       |
| (0, 200, 1)               | Shift+wheel `deltaY` +200              | (200, 200, 1)                                             | Shift+wheel                 |
| (200, 200, 1)             | Mod+wheel `deltaY` −100 at (640, 360)  | zoom 1.105, scene point (840, 560) still under (640, 360) | Ctrl+wheel (zoom 1.1 there) |
| (200, 200, 1)             | zoom in by keyboard                    | (258.2, 232.7, 1.1)                                       | Ctrl+=                      |
| (258.2, 232.7, 1.1)       | zoom out by keyboard, twice            | (128.9, 160, 0.9)                                         | Ctrl+− twice                |
| (128.9, 160, 0.9)         | reset zoom                             | (200, 200, 1)                                             | Ctrl+0 (centre kept)        |
| any, zoom 1               | zoom to fit content spanning x 340–760 | x = −90, zoom 1                                           | Shift+1 (x only, REQ-V09)   |
| (−90, −45, 1)             | Space+drag by (−100, −50)              | (10, 5, 1)                                                | Space+drag                  |
| (10, 5, 1)                | Hand drag by (+50, +50)                | (−40, −45, 1)                                             | Hand tool                   |
| zoom 1                    | two fingers from 90 to 190 px apart    | zoom 2.111                                                | pinch                       |
| zoom 2.111                | two fingers moved 80 px up together    | `y` + 37.9                                                | two-finger pan              |
| any                       | pinch to ratios 0.05 and 40            | zoom 0.1 and 30                                           | scenario 26 limits          |

The Mod+wheel factor differs from the reference's 1.1 by design: Planewright uses one continuous
curve for wheels and trackpads ([REQ-V04](requirements.md#intentional-differences)); the test
accepts zoom in `[1.09, 1.12]`.

## Requirements served

REQ-V01 to REQ-V11, REQ-K01, REQ-K02, REQ-P01 and, through the spatial index, REQ-F01.
