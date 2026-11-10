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

An update that writes only fields its element holds is checked field by field rather than whole,
which gives the same element and, for a refused set, the same errors
([what issue #36 decided](#what-issue-36-decided)).

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
are missed. An element whose new bounds touch the same cells as before keeps its entry
([what issue #36 decided](#what-issue-36-decided)).

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

## What issue #36 decided

Issue #36 makes applying a change set cheaper for budget B7
([performance budgets](quality.md#performance-budgets)) without dropping or weakening any check
that the store applies to a set ([change sets](#change-sets)). It decided what the rules above
leave open:

- **What B7 times.** As ENG-15 decided: one `local` set that moves 1,000 of the benchmarks' 10,000
  elements by one unit, applied with the order, spatial, group and attachment indexes, then the set
  that moves them back, in turn, 400 samples after 80. Its check, that the moved elements end where
  the last set put them and that the spatial index lists each of them there, is unchanged.
- **Where an application went.** On a 6-core AMD EPYC developer machine (Node.js 24.22.1), B7's loop
  run natively at `8a666f4` took 24.7 to 27.5 ms at the median and 68 to 110 ms at the 95th
  percentile. A CPU profile of 480 applications, sampled every 50 µs, put 76 % of `apply` in
  planning the set: 41 % in checking each updated element whole with the codec's element check,
  which built the path of every field with a regular expression and new strings (11 % of `apply`),
  and 15 % in building the updated element from the entries of the element and the patch. Committing
  took 23 %, 15 % in the spatial index taking every moved element out of its cells and filing it
  again. Garbage collection took 10 % of all samples, with 112 scavenges and 3 mark-compacts over
  the run.
- **An update of fields that its element holds.** An update whose two sides name the same fields,
  each a field that the element holds, is planned without the generic patch path. The `before` of
  a `local` or `history` set must still match the element; each value written must pass its field's
  own check, the one that the kind's element check runs, which also copies it; the element must
  pass the kind's checks across its fields, a freehand's pressures one per point and an arrow never
  attached to itself; and its revision must pass the revision check, because the store raises a
  revision by one without a check and the element check reads it. The new version is the element
  with those fields replaced, in its own field order, its revision one higher: the element that the
  generic path makes. Every other update, one that adds, removes or names a field the element does
  not hold, one of `id`, `kind` and `rev`, a value that a check refuses, a stale value, sides that
  name other fields or a patch that is not a record, goes to the generic path as before, which
  reports every reason with its path, so a refused set lists the same errors in the same order.
- **What is checked once.** The fields that an update leaves are not checked again. The store
  checked them when it took the element, through the element check of an addition or of an update,
  and it never changes an element in place, so the new version shares them with the one before it.
  The revision is the one exception, above. A value that an update writes is its field check's own
  copy, so the store never holds an object of a change set.
- **The indexes.** A spatial entry keeps the span of cells that its bounds touch, and an element
  whose new bounds touch the same cells, as nearly every element of a drag does, keeps its entry,
  whose bounds are replaced; any other change of cells goes as before. The entry is the index's own
  data, a query reads each entry's bounds when it runs, and every caller sorts the candidates into
  drawing order. The world bounds of a turned element are computed corner by corner with the
  operations that the corner and bounds functions use, in their order, with the cosine and the sine
  taken once, and the extent of points in four numbers, so that they are the same to the bit and
  no point is built. The group index passes over an element that is in no group before or after,
  and the attachment index over a change that is not an arrow's, before or after; neither changes a
  list for them.
- **Paths and look-ups.** The planner builds an update's path only when the generic path plans it,
  and the reference check builds the path of a problem once it finds one, and the map of the set's
  deltas at its first look-up, which a set whose elements refer to nothing and remove nothing never
  needs. The planner counts what a set adds and removes in the loop that plans it.
- **What stays the same.** A set is still checked whole before any of it is applied, and a refused
  set throws the same `ChangeSetError` and changes nothing, not even the reader's order array; the
  revisions, the drawing order, the indexes, the one update for each listener, a listener's error
  rethrown once the set is applied, and the history are as before. The tests keep a copy of the
  planner as it was at `8a666f4` as an oracle: for each of the four origins, the planner must give
  the oracle's plan, field order included, or its errors in its order, or its thrown error, over 60
  random sets of up to 1,000 updates mixing valid changes with changes that some or every origin
  refuses, 28 named cases, the element limit and a revision raised past the largest safe integer.
  The store must apply 96 such sets in turn as a model built on the oracle does, and a refused one
  must leave every element, the revision and the order array as they were. Large transactions of the
  history must keep each element's last preview, cancel back to their start, and undo and redo at
  every size, and world bounds must equal the composition they were computed with, to the bit, for
  13,000 elements and 200 random documents. Of 40 regressions planted outside Git, among them a
  revision left unchecked, a removed or an unknown field let through, a value written uncopied, a
  check across fields skipped, a stale `before` let through, a spatial entry kept after its cells
  changed and a turned corner computed in another order, the tests caught 37, each failing 1 to 129
  of them, and B7's own check none, since a bound one unit stale still meets the query of the new
  one. Of the other three, two are equivalent: the path's own refusal of a
  null value, which every field check refuses, and its own check that both sides are records, which
  listing their keys already reads as the generic path does. The third, lines patched with the
  freehand's field checks, let a line cut to one point through, and two cases added for it fail
  with it.
- **What was measured and not done.** In a harness that planned B7's sets and stored the elements,
  building the new versions with nothing checked, the floor of any planner that keeps elements
  immutable, took 0.57 to 0.66 ms at the median where the planner took 1.40 to 1.62 ms. A path only
  for moves was not written: the held-field path serves every edit of fields that the elements hold,
  moves, turns, resizes, restyles and text edits alike, and B7's set is one of them. The old bounds
  moved by the move's offset, instead of computed, differed from `worldBounds` for 4 of B7's 1,000
  moved elements, and the index keeps exactly `worldBounds`.
- **Where an application goes now.** The same profile after the change puts 42 % of B7's loop in
  planning and 53 % in committing, 35 % in the spatial index, whose world bounds take 11 %; garbage
  collection takes 8 % of the loop's time, with 33 scavenges and 2 mark-compacts over the run. Each
  stage timed apart, at the median of 400 applications at a load of about 2.5 (in ms):

  | Stage                | Before (`8a666f4`) | After |
  | -------------------- | ------------------ | ----- |
  | Planning the set     | 20.0               | 1.86  |
  | Storing the elements | 0.42               | 0.17  |
  | The order index      | 0.41               | 0.06  |
  | The spatial index    | 4.35               | 1.44  |
  | The group index      | 0.38               | 0.04  |
  | The attachment index | 0.17               | 0.05  |
  | All of them          | 27.1               | 3.67  |

- **Before and after.** B7 on that machine, in three runs of each taken in turn (at a load of about
  2.5):

  | B7              | Before (`main` at `8a666f4`) | After           |
  | --------------- | ---------------------------- | --------------- |
  | Median          | 24.4 to 26.7 ms              | 4.66 to 4.88 ms |
  | 95th percentile | 45.6 to 100.6 ms             | 9.5 to 14.4 ms  |

- **In CI.** The code that B7 runs did not change between ENG-15 and this issue, so the 19 CI runs
  before it measured the same code (4-core runners, runner image ubuntu24 20261101.360.1, Node.js
  24.22.1) and missed B7 in each, at 5.5 to 7.4 ms at the 95th percentile on an AMD EPYC 9V45 (seven
  runs), 7.5 to 13.3 ms on an EPYC 9V74 (six), 9.8 to 13.5 ms on an EPYC 7763 (four), 15.1 ms on an
  Intel Xeon Platinum 8370C and 12.4 ms on a Xeon Platinum 8573C. The pull request's first CI run,
  42730911670 on an EPYC 9V74, measured 1.103 ms at the 95th percentile and 0.837 ms at the median,
  where the last run on `main` on that processor, 42685994872 at `c5bcfd3`, had measured 7.621 ms.
  The pull request keeps the record of every later run.

## Requirements served

REQ-V01 to REQ-V11, REQ-K01, REQ-K02, REQ-P01 and, through the spatial index, REQ-F01.
