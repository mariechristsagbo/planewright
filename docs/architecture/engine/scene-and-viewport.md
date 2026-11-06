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
its stroke width and, for a label that overflows, by the label's box.

## Change sets

The store changes only by applying a change set ([ADR 0007](../../adr/0007-history-model.md),
[ADR 0010](../../adr/0010-collaboration-ready-change-model.md)):

```ts
export type ChangeOrigin = 'local' | 'history' | 'load' | 'remote';

/** A partial element of the same kind, without `id`, `kind` and `rev`. */
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
only keeps the union of kinds out of every signature.

Applying a change set is atomic:

1. Every change is checked against the current state: an added identifier must be new, a removed or
   updated element must exist and, for `local` and `history` origins, its current fields must equal
   `before`. A failed check rejects the whole set and changes nothing.
2. Element revisions and the document revision increase; the indexes are updated incrementally for
   the changed elements only.
3. One `SceneUpdate` is emitted with the origin, the set, the changed identifiers and the new
   document revision. History records `local` updates, autosave saves every origin but `load`, and
   the editor marks the render layers dirty.

A change set is always complete: the transaction that builds it adds the derived changes before it
is applied, such as re-routing connectors whose target moved (P1, REQ-M01), dropping attachments to
a removed target, or removing a group that lost its last member. Inverting a complete change set
(swapping `add` and `remove`, `before` and `after`) is therefore always valid.

## Transient previews

During a gesture the tool previews its result in the scene, so the renderer and hit testing see it.
The store applies such changes with a `transient` flag: indexes update, but nothing is recorded or
saved. The transaction remembers the first `before` value of every field it touched. On commit it
emits one net change set from those values to the current ones and history records it; on cancel it
applies the remembered values back as another transient change. A transient change never reaches
autosave, so a reload in the middle of a drag restores the last committed state (REQ-P01).

## Store interface

```ts
export interface SceneReader {
  readonly rev: number;
  get(id: ElementId): Element | undefined;
  /** Elements in drawing order, bottom first. */
  ordered(): readonly Element[];
  /** Candidates whose world bounds meet a box; precise tests are the caller's. */
  queryBox(box: Box): readonly ElementId[];
  /** Candidates whose world bounds are within `radius` of a point. */
  queryPoint(point: Point, radius: number): readonly ElementId[];
  outermostGroup(id: ElementId): GroupId | undefined;
  members(group: GroupId): readonly ElementId[];
  connectorsOf(target: ElementId): readonly ElementId[];
}

export interface SceneStore extends SceneReader {
  apply(changes: ChangeSet, origin: ChangeOrigin, options?: { readonly transient: boolean }): void;
  subscribe(listener: (update: SceneUpdate) => void): Cancel;
}
```

## Spatial index

The first implementation is a uniform grid of 512 × 512 scene-unit cells, each listing the
elements whose world bounds touch it. An element whose bounds touch more than 64 cells goes into a
separate list that every query scans, so a huge frame or a long line never fills thousands of
cells. Queries return candidates in no particular order; the caller sorts by drawing order when it
needs to. The index sits behind `queryBox` and `queryPoint`, so it can become a bounding-volume
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
curve for wheels and trackpads; the test accepts zoom in `[1.09, 1.12]`.

## Requirements served

REQ-V01 to REQ-V11, REQ-K01, REQ-K02, REQ-P01 and, through the spatial index, REQ-F01.
