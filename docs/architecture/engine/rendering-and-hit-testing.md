# Rendering and hit testing

This document specifies the renderer boundary ([ADR 0006](../../adr/0006-canvas-rendering.md)),
the shared geometry and the hit-testing rules. Coordinates and the camera are defined in
[scene and viewport](scene-and-viewport.md); element shapes in the [domain model](domain-model.md).

## Render frame and renderer port

The engine describes what to draw; the renderer draws it and holds no editing state.

```ts
export interface ViewportSize {
  readonly width: number; // CSS pixels
  readonly height: number;
  readonly pixelRatio: number; // device pixels per CSS pixel
}

export type HandleId =
  'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw' | 'rotate' | 'start' | 'end';

/** Overlay primitives are in screen space, so their size does not change with zoom. */
export type OverlayPrimitive =
  | { readonly type: 'selection-outline'; readonly corners: readonly [Point, Point, Point, Point] }
  | {
      readonly type: 'handle';
      readonly handle: HandleId;
      readonly center: Point;
      readonly size: number;
    }
  | { readonly type: 'marquee'; readonly box: Box }
  | { readonly type: 'element-outline'; readonly element: ElementId };

export interface RenderFrame {
  readonly camera: Camera;
  readonly viewport: ViewportSize;
  readonly theme: 'light' | 'dark';
  readonly background: Color;
  /** Present when the scene layer must be redrawn. */
  readonly scene?: {
    readonly elements: readonly Element[];
    readonly hidden: readonly ElementId[];
    readonly removed: readonly ElementId[];
  };
  /** Present when the overlay layer must be redrawn. */
  readonly overlay?: { readonly primitives: readonly OverlayPrimitive[] };
}

export interface Renderer {
  render(frame: RenderFrame): void;
  dispose(): void;
}
```

`scene.elements` holds only the visible elements, in drawing order; `hidden` lists elements drawn
by something else, such as the text being edited in the DOM overlay; `removed` lists the elements
removed since the last frame that redrew the scene layer, so that the renderer drops their paths.

## Dirty layers and scheduling

| Event                                                          | Scene layer | Overlay layer |
| -------------------------------------------------------------- | ----------- | ------------- |
| A scene update of any origin, transient previews included      | dirty       | dirty         |
| A camera change, a resize or a pixel-ratio change              | dirty       | dirty         |
| A theme change or a font that finished loading                 | dirty       | dirty         |
| A selection change, a hover change, a marquee or a handle move | clean       | dirty         |

A dirty mark asks the scheduler for the next animation frame once; further marks before it fires
are coalesced. On that frame the editor builds one render frame and calls the renderer. A pointer
move therefore costs at most one render in the next frame (REQ-F02).

## Drawing the scene layer

1. Clear to the canvas background, resolved for the theme.
2. Set the transform to `pixelRatio × zoom` with the camera's offset, so every path is drawn in
   scene units.
3. Draw the visible elements, found by `queryBox` on the viewport's scene box grown by 64 screen
   pixels, in drawing order. For each element: translate to its origin, rotate about its box
   centre, then fill and stroke its cached path with its style. Opacity uses the context's global
   alpha; dashes scale with the stroke width; texts draw their laid-out lines. No state is saved
   per element: each element sets its transform and every other state that differs from what the
   frame has set ([what issue #34 decided](#what-issue-34-decided)).

The canvas renderer caches one path per element, keyed by identifier and revision, and drops the
entry when the element is removed or the cache passes 20,000 entries (least recently used first).

P0 shapes are drawn exactly (`sketch` 0):

- a rectangle with `round` corners has a corner radius of min(16, a quarter of its shorter side),
  and a diamond with `round` corners the same radius along its edges;
- an ellipse is four cubic Bézier arcs;
- a line is a polyline with round joins and caps;
- a freehand stroke is a polyline smoothed by quadratic curves through the midpoints of its points,
  with round joins and caps, and a one-point stroke is a filled disc of the stroke width.

Variable-width pressure strokes, hatch fills, arrowheads and the sketch styles are P1 additions
behind the same path cache. The dark theme draws each stored colour through one mapping function
chosen by the theme issue; a theme change never changes the document (REQ-H04).

## Drawing the overlay layer

The overlay layer is redrawn in screen space with lines aligned to device pixels:

- the selection outline: the element's rotated box for one element, the axis-aligned box of all
  selected elements for several;
- handles: squares of 8 px for a mouse or pen and 12 px for touch, and a circle for rotation, 24 px
  above the top centre in the box's own orientation;
- the marquee during box selection.

Handles are hit through a larger square than they are drawn: 12 px for a mouse or pen and 24 px for
touch (REQ-Y06). Side handles are hidden when that side is shorter on screen than three hit squares,
so that the corners stay reachable; corners and the rotation handle always show (REQ-S12). A
two-point line shows `start` and `end` handles on its ends instead of a box, and a lone text has
no side handles, since texts have none in P0 ([transforms](interaction.md#transforms)); ENG-09
applies this to the handle layout ([what ENG-09 decided](interaction.md#what-eng-09-decided)).

## Geometry

The `geometry` layer gives every kind three pure functions, all in the element's local frame:

```ts
export type PathCommand =
  | { readonly op: 'move'; readonly to: Point }
  | { readonly op: 'line'; readonly to: Point }
  | { readonly op: 'cubic'; readonly c1: Point; readonly c2: Point; readonly to: Point }
  | { readonly op: 'close' };

export interface KindGeometry<E extends Element> {
  outline(element: E): readonly PathCommand[];
  /** Signed distance to the outline's centre line: negative inside closed kinds. */
  distance(element: E, local: Point): number;
  isClosed(element: E): boolean;
}
```

| Kind                                | Distance function                                                                  |
| ----------------------------------- | ---------------------------------------------------------------------------------- |
| rectangle                           | exact signed distance to a box, with rounded corners when `round`                  |
| ellipse                             | closest point on the ellipse by a few Newton steps, exact to 0.01 units            |
| diamond                             | signed distance to its four edges, inside by the polygon test                      |
| line, freehand                      | unsigned distance to the polyline; a one-point stroke is the distance to the point |
| text (and later note, image, frame) | signed distance to the box: the whole box counts as inside                         |

A scene point becomes a local point by subtracting the origin and rotating by −`rotation` about
the box centre. `bounds` (world, axis-aligned) comes from the rotated local box and the stroke.

## Hit testing

Hit testing belongs to the `selection` module (layer 5), not to `geometry`: it reads the scene's
spatial index and the current selection's handles, and applies the geometry's distance functions to
the candidates. Handle layout, the handles' hit squares and marquee enclosure live there too.

`hitTest(at, pointer)` resolves a screen point in this order and returns the first match:

1. **Handles** of the current selection, by their screen hit squares.
2. **Elements**, topmost first (REQ-S04). The tolerance `t` is 5 screen pixels for a mouse or pen
   and 6 for touch, converted to scene units by dividing by the zoom. Candidates come from
   `queryPoint(scenePoint, t)`. An element is hit when its distance `d` satisfies:
   - unfilled closed kind, line or freehand: `|d| ≤ strokeWidth / 2 + t` (REQ-S01);
   - filled closed kind: `d ≤ strokeWidth / 2 + t` (REQ-S01);
   - text: `d ≤ t` (REQ-S02).
3. **The selection box**: a point inside the current selection's outline that hit no element.
4. **Nothing.**

A **small selection** comes before its own handles (ENG-11, for the ENG-10 review's m2). A
selection is small when its frame is shorter on screen than two handle hit squares, 24 px for a
mouse or pen and 48 for touch, along both of its sides; for a lone two-point line, when its ends
are that close along both axes. Its handles then cover most of it: a selected dot's four corners
coincide on it, and a 6 × 6 box lies within one corner's square, so a drag from the element would
resize it from a corner, or do nothing for a dot, instead of moving it (REQ-T01). For a small
selection, a press that hits one of its elements, as the topmost element at the point, or that
lies inside its box goes to the element or the box first, and a drag from it moves the selection;
the handles still take the presses that miss both, around the element and outside its box, and the
rotation handle stays clear of it. An unselected element under a handle never takes the press from
it, and a selection two hit squares or more along either side keeps the order above.

With a 2-unit stroke at zoom 1 the hit limit is 6 px from the centre line for a mouse or pen and
7 px for touch. Read from the centre line, the baseline's distances are 4 and 8 px; read from the
stroke's edge, 5 and 9 px. In both readings the near point hits and the far point misses, for both
pointer types (REQ-S03).

```ts
export type HitResult =
  | { readonly type: 'handle'; readonly handle: HandleId }
  | { readonly type: 'element'; readonly id: ElementId }
  | { readonly type: 'selection-box' }
  | { readonly type: 'none' };
```

In P1, locked elements are skipped (REQ-S08) and a hit on a group member is widened to its
outermost group by the selection layer (REQ-S11).

**Box selection** keeps an element whose kind has a geometry, whose world bounds meet the marquee,
as `queryBox`'s candidates do, and whose whole outline is inside the marquee: the four rotated
corners for box kinds, every point for point kinds (REQ-S06). The outline is geometric: a box
kind's are the corners of its local box, an ellipse's and a diamond's too, and a stroke's width
counts only through the world bounds, its caps and joins not at all. Each scene keeps these numbers
per element between queries and makes them again after a change
([what issue #35 decided](#what-issue-35-decided),
[what issue #43 decided](#what-issue-43-decided)).
The P2 overlap mode keeps an element when its outline meets the marquee (REQ-S07).

## Text layout

`layoutText(block, measurer, maxWidth?)` splits the text at line breaks and, when a maximum width
is given (container labels and notes, P1), wraps at spaces, breaking a word only when it is wider
than the line. It returns the lines with their widths, the line height (`size × lineHeight`) and the
block's size. P0 texts do not wrap: their width is the widest line and their height the number of
lines times the line height. Layouts are cached per element revision.

## What ENG-06 decided

ENG-06 implements the geometry of the P0 kinds, the `TextMeasurer` port and `layoutText` in the
`geometry` layer, and the selection state, `hitTest`, the selection frame, handle layout and
marquee enclosure in the `selection` module. It decided what the rules above leave open:

- **Kinds without a geometry.** The arrow, note, image and frame, which P0 neither creates nor
  draws, get their geometry with the issue that adds each of them; until then hit testing and box
  selection skip them.
- **Outlines.** A round rectangle's corners are quarter circles drawn as one cubic each; one with
  no width or height to round is drawn sharp. A round diamond cuts each corner the corner radius
  along both of its sides and joins the cuts by a curve whose control point is the corner, while
  its distance stays the distance to its four straight edges. A freehand outline runs through the
  midpoints of its points with each inner point as a control point, then on to the last point; a
  one-point stroke is a move and a line to that point, which the renderer draws as a dot. A text's
  box keeps sharp corners whatever its style says.
- **Distances.** The ellipse's nearest point comes from Newton steps that start below the root of
  its defining equation and rise to it without overshooting, exact well within 0.01 units. An
  ellipse or diamond without width or height is the segment it is, with no inside.
- **Local frame.** A scene point is turned back by the rotation only when there is one; an
  unrotated element is only measured from its origin, so no rounding through its centre moves a
  point near an exact limit.
- **The REQ-S03 ladder at zoom 2.** The tolerance is a screen distance around the stroke, and a
  2-unit stroke is 4 px wide on screen at zoom 2, so the ladder keeps each press's screen distance
  from the stroke's edge: 5 and 6 px from the centre line hit and 9 and 10 px miss. The limits are
  7 px from the centre line for a mouse or pen and 8 px for touch, so a touch exactly 8 px from the
  centre line hits.
- **Handles.** Hit squares are centred on their handles in screen space, edges included. Where
  squares overlap, the first in layout order wins: the corners (`nw`, `ne`, `se`, `sw`), the
  rotation handle, then the side handles (`n`, `e`, `s`, `w`); a lone two-point line has `start`
  and `end`.
- **The selection box.** A press is inside the selection box when it lies in the selection's
  frame box, edges included and without tolerance; the frame of several elements is the
  axis-aligned box of their rotated corners, and a lone two-point line has no box. Identifiers
  that the scene does not hold are ignored.
- **Box selection.** The marquee's edges count as inside, and an unrotated element's outline is
  only moved by its origin, so a corner on an edge stays on it.
- **Selection state.** `createSelection` holds the selected identifiers over the scene store and
  drops an element once any change set removes it, a preview included; it is the
  `HistorySelection` the history reads and restores. The text being edited joins it with the text
  tool (ENG-12). `PointerKind` is defined in `selection`, the lowest layer that needs it, and the
  input layer uses it from there.
- **Text layout.** Lines wrap at single spaces, so several spaces stay within a line and the space
  at a break is dropped; a word wider than the line breaks between code points. A maximum width
  must be 0 or more (an infinite one never wraps), and a width from the measurer that is negative
  or not finite is refused. The per-revision cache of layouts arrives with its first caller, the
  renderer (ENG-07).

## What ENG-07 decided

ENG-07 implements the render frames, dirty tracking and frame scheduling in the `editor` layer and
the canvas renderer in `@planewright/render-canvas`. It decided what the rules above leave open:

- **The render loop.** "In the editor façade" is the `editor` layer's render loop,
  `createRenderLoop(scene, scheduler)`, which `createEditor` composes when the editor surface
  (ENG-08) adds input. It follows the scene store and holds the render state: camera, viewport,
  theme, selection, the pointer kind that sizes the handles, the marquee and the hidden elements.
  `update` marks layers dirty by the table above: a pointer-kind change is the handle move, hiding
  an element marks only the scene layer, and `invalidate` marks both for a font that finished
  loading. The state starts at the origin at zoom 1 on an empty viewport, in the light theme.
- **Who calls the renderer.** The renderer is not an editor port. The loop asks the scheduler for
  an animation frame only while a listener is registered with `onFrame`, builds one frame on it
  and hands it to every listener; the web app's listener calls `render`. A new listener gets a
  full frame; a listener that throws keeps the frame from no other, and its error is rethrown
  afterwards. `frame()` pulls the frame of the dirty layers at once, which `Editor.frame()` will
  return.
- **Removed elements.** A frame's scene part lists the elements removed since the scene layer was
  last drawn, even those added back since, because a cache keyed by identifier and revision cannot
  tell a returning element from the one it held.
- **The viewport.** It comes from the page, so the loop refuses a size below 0 or not finite and a
  pixel ratio that is not finite and above 0, and changes nothing.
- **The overlay.** The marquee is given in scene units, as the box selection compares it, and
  becomes a screen box; the primitives are the selection outline, the handles at their drawn size
  and the marquee, in that order. Nothing emits an element outline yet; the renderer draws one
  along the path it drew the element with.
- **The engine's public surface.** The entry exports its first values: `createRenderLoop`, and the
  pure geometry functions a renderer draws with, `geometryOf`, `localBox` and `layoutText`.
- **Placing elements.** Each element's transform is set on its own, with its origin relative to
  the camera computed in double precision, so a canvas whose transform keeps single precision
  never holds a translation of up to 10⁹ units.
- **Painting.** A fill goes under the stroke of a closed kind only; lines and freehand strokes get
  round caps and joins and are never filled; a one-point stroke is a disc filled with its stroke
  colour. Dashes are 4 on and 4 off for `dashed` and 1 on and 2 off for `dotted`, in stroke widths.
  A text fills its box when it has a fill, then draws each line in its stroke colour, vertically
  centred on its line and anchored at the box's left edge, centre or right edge. Until the text
  issue chooses fonts the families map to the generic `sans-serif`, `cursive` and `monospace`;
  hatch fills draw solid and the sketch styles exact until P1; stored colours are drawn as they are
  in both themes until the theme issue chooses the dark mapping; kinds without a geometry are not
  drawn.
- **The path cache.** One entry per element holds its path, its closedness, its local box's size
  and, for a text, its layout, so layouts are cached per revision there. An element at the same
  revision keeps its entry even as a new object. Entries are kept in use order and the oldest goes
  past 20,000; removed elements are dropped before the scene layer is drawn.
- **The overlay's pixels.** The overlay is drawn in device pixels with lines the pixel ratio
  rounded, at least 1, device pixels wide, on the device grid: an odd width on pixel centres, an
  even one on pixel edges. Handles are white squares and the rotation handle a white circle, with
  borders, outlines and the marquee's edge in Planewright's selection colour, Construction Violet
  `#6547b4`, 6.74:1 on the white canvas, and the marquee filled with the same violet at about a
  tenth of its opacity, `#6547b41a`. P0 drew them in `#2a62d0` and `#2a62d01a`, until v0.2's slice
  S11 (issue #79) applied [ADR 0012](../../adr/0012-v02-editor-chrome.md)'s decision D1 and changed
  only those two values.
- **Backing stores.** The renderer sizes a layer's backing store to the CSS size times the pixel
  ratio, rounded, before it draws that layer, and assigns a size only when it changed, since
  assigning one clears the canvas. A canvas without a 2D context is refused.
- **The package boundary.** `@planewright/render-canvas` has its own ESLint block: no browser,
  worker or Node.js global (so no page global such as `window`, `document` or `location`) except
  the Canvas 2D names it draws with, `Path2D` and `CanvasRenderingContext2D`; no timer, clock
  (`Date.now`, `new Date()`, `Date()`) or randomness; and imports of the engine's entry and of its
  own modules by `./` paths only, since its sources sit in one directory. It holds the engine's
  coverage thresholds.

## What issue #34 decided

Issue #34 makes the scene layer's redraw cheaper for budgets B1 and B2
([performance budgets](quality.md#performance-budgets)) without changing a drawn pixel. It decided
what the rules above leave open:

- **What B1 and B2 time.** `performance.measure` wraps the renderer's `render` call and nothing
  else, as ENG-15 decided, and issue #34 keeps that measurement as it is. In headless Chromium a 2D
  context records each call when the renderer makes it and rasterises the recording only when the
  frame is committed, after `render` returns; I1, the main thread's busy time per pan step, counts
  both. Culling runs in the engine before `render`: `visibleElements` took about 3 ms a frame for
  B1's 5,000 elements and 1 ms for B2's tenth, outside both budgets.
- **Where a frame went.** A trace of 100 B1 frames on a 6-core AMD EPYC developer machine (Chromium
  156.0.8078.4, its CPU profile sampled every 50 µs and mapped to the sources) put 16.7 of a
  measured 28.7 ms a frame in the 2D context's own calls: `stroke` 4.4 ms, `save` 4.3, `fillText`
  3.5, `setTransform` 1.7, `restore` 0.9, `fill` 0.8, `rotate` and `translate` 0.7 and `setLineDash`
  0.3. The renderer's functions took the other 12.0 ms, the context's property setters included,
  which the profile counts in their callers: each colour, width and font that an element set after a
  `restore` was parsed again, and the path cache's lookup alone took 3.0 ms. With a context that
  records nothing, the renderer's own JavaScript took about 2 ms of a 20 ms render, so about nine
  tenths of B1 is the context recording calls. No rasterisation ran inside `render`: Chromium
  rasterised each frame while committing it, 38 ms a frame there (`LayerTreeHost::DoUpdateLayers`).
  For B2, `save` alone took 2.1 of 7.4 ms a frame.
- **What the scene layer does now.** It saves no state per element. Each element still sets its
  whole transform, and sets every other state its drawing calls depend on through the frame's
  scene state, which sets a value only when it differs from what the frame has set: the global
  alpha, the fill and stroke colours, the line width, the dash pattern, the caps and joins (round
  for lines and freehand strokes, the default butt caps and miter joins for closed outlines), the
  font, the text alignment and the middle baseline. A frame starts knowing nothing, so it sets
  every state it uses at least once, whatever an earlier frame, a resize or a lost context left,
  and fills the background at full alpha. Every value comes from an element that the scene store
  has checked, so the context takes each one. The path cache keeps its use order in a linked list
  beside its map, so that a hit no longer takes its entry out of the map and puts it back, and an
  element's drawing holds its dash pattern and, for a text, its font with its layout, built once
  per revision. The overlay layer is unchanged; it still saves the state around an element's
  outline.
- **What stays the same.** The drawing calls and their order, so that the z-order, the alpha and
  the compositing of every element are as before. A seeded property replays the calls of random
  scenes of every kind and style over frames that bring elements back at new revisions through a
  model of the context's state, and checks that every drawing call draws with exactly the state its
  element prescribes from a fresh context. An end-to-end test draws a stored drawing of fifteen
  overlapping elements of every kind and style and compares the scene canvas, device pixel for
  device pixel, with the calls that drew it before issue #34 made in the same page, at one and two
  device pixels per CSS pixel and again after a pan back and forth and a resize; it passes against
  the build before issue #34 too. Of fourteen regressions planted outside Git, such as a frame that
  keeps the last frame's alpha or a closed outline that keeps round caps, the renderer's unit tests
  caught all fourteen and the pixel test twelve: the other two change nothing drawn there, the
  cache's use order and the hidden elements.
- **What was measured and not done.** Drawing elements of one style together, even with a free
  sort that ignores overlaps, saved only 2.3 of 15.4 ms a frame of B1 in a harness, and changes
  the z-order of overlapping elements. Merging elements' paths with `addPath` would stroke them in
  device space rather than in each element's frame, and folding the first `translate` of a turned
  element into its `setTransform` would compose its matrix in double rather than in Skia's single
  precision during playback; either can move an edge pixel. Drawing texts from cached bitmaps
  resamples them and rounds their colour twice, and rounding font sizes or skipping small texts
  changes what is drawn. None of them is done.
- **Before and after.** B1, B2 and I1 on that machine, in three runs of each build taken in turn
  (at a load of 2.9 to 3.7):

  | Budget              | Before (`main` at `90a456d`) | After           |
  | ------------------- | ---------------------------- | --------------- |
  | B1, median          | 21.3 to 23.2 ms              | 17.0 to 17.7 ms |
  | B1, 95th percentile | 36.4 to 67.1 ms              | 35.1 to 55.8 ms |
  | B2, median          | 4.6 to 5.2 ms                | 3.6 to 4.2 ms   |
  | B2, 95th percentile | 12.0 to 16.9 ms              | 10.3 to 13.9 ms |
  | I1, median          | 36.3 to 39.3 ms              | 36.4 to 39.7 ms |

  The traces above fell to 25.1 ms a frame for B1, the context's calls from 16.7 to 12.8 ms, and to
  6.3 ms for B2, the context's calls from 4.9 to 2.8 ms; `save` and `restore` are gone from both.

- **In CI.** The CI runs of the pull request (4-core runners, runner image ubuntu24
  20261101.360.1, Chromium 156.0.8078.4, Node.js 24.22.1), the first two and the four at its final
  head `b2d60b3`, reports 1 to 4, beside the runs before it on the same processor models with the
  renderer as it was; a frame of 9 ms or more is one of the slow frames that make a miss:

  | CI run (attempt) | Renderer                   | Processor | B1, median | B1, 95th | B1 frames ≥ 9 ms | B2, 95th |
  | ---------------- | -------------------------- | --------- | ---------- | -------- | ---------------- | -------- |
  | 42627742440 (1)  | before, at `4ce8490`       | EPYC 9V45 | 7.3 ms     | 9.53 ms  | 9 of 100         | 2.105 ms |
  | 42642158624 (1)  | before, `main` `4db483f`   | EPYC 9V45 | 7.25 ms    | 10.61 ms | 18 of 100        | 2 ms     |
  | 42648632465 (1)  | before, at `97808ed`       | EPYC 9V45 | 6.4 ms     | 8.205 ms | 2 of 100         | 2 ms     |
  | 42671462319 (1)  | after, at `791f735`        | EPYC 9V45 | 5.2 ms     | 5.5 ms   | 1 of 100         | 1.7 ms   |
  | 42673197733 (3)  | after, `b2d60b3`, report 2 | EPYC 9V45 | 5.5 ms     | 7.2 ms   | 1 of 100         | 1.7 ms   |
  | 42656464145 (1)  | before, `main` `90a456d`   | EPYC 7763 | 9.5 ms     | 12.11 ms | 94 of 100        | 2.905 ms |
  | 42670318550 (1)  | after, at `0d6b9ff`        | EPYC 7763 | 7.9 ms     | 11 ms    | 29 of 100        | 2.2 ms   |
  | 42677720242 (1)  | after, `b2d60b3`, report 3 | EPYC 7763 | 7 ms       | 7.625 ms | 2 of 100         | 2 ms     |
  | 42641527515 (1)  | before, `main` `4db483f`   | EPYC 9V74 | 8.3 ms     | 11.62 ms | 21 of 100        | 2.3 ms   |
  | 42673197733 (1)  | after, `b2d60b3`, report 1 | EPYC 9V74 | 7.3 ms     | 10.01 ms | 28 of 100        | 1.9 ms   |
  | 42678182735 (1)  | after, `b2d60b3`, report 4 | EPYC 9V74 | 6.4 ms     | 7.6 ms   | 1 of 100         | 1.8 ms   |

  B2 is met in every run. B1 is met in three of the four final-head reports, one on each processor
  model, and missed in report 1. The slow frames vary by run on one processor model, not by model:
  with the same code, report 1 missed on an EPYC 9V74 with 28 of its frames at 9 ms or more and
  report 4 met on that model with one, and on the EPYC 7763 the pull request's first run missed with
  29 such frames and report 3 met with two, where `791f735` only adds a dash comparison without an
  iterator to the first run's `0d6b9ff`. In a missing run the median frame is within the budget and
  about a quarter of the frames form a second group at 9 to 11 ms. The runs before the change on the
  other processor seen in CI missed B1 as well, 10.9 ms on the Xeon Platinum 8370C, and so did the
  first run of ENG-15's pull request, 13.92 ms on an EPYC 9V74. The profile leaves no change of the
  same calls that saves that much: the context's own calls are about nine tenths of the render, and
  the changes that would call the context less are the ones above that can change a pixel. The pull
  request met its A1 with reports 2 to 4. Of the five reports on `main` since its merge, B1 met its
  budget in four and missed it in one, on an EPYC 7763, and B2 met its budget in all five; those
  reports, every other CI report with this renderer and what makes a run miss are recorded in
  [what issue #41 decided](#what-issue-41-decided).

## What issue #35 decided

Issue #35 makes box selection's query cheaper for budget B6
([performance budgets](quality.md#performance-budgets)) without changing what it selects. It
decided what the rules above leave open:

- **What B6 times.** One call of `enclosedBy` on a store of the benchmarks' 10,000 elements, as
  ENG-15 decided: a marquee dragged from the scene's corner to its far corner in 32 steps, 640
  samples after 128, over a scene that does not change between the queries. Before timing, the
  result of each of the 32 marquees is compared with a scan of every element by the rule above, in
  the test support, which keeps nothing between queries. Until this issue the check compared the
  query with itself given every element as a candidate; once a query scans its rows instead of the
  index's candidates, that comparison would have tested nothing. The check's queries make the
  scene's rows, so from this issue on every timed query scans the rows of an unchanged scene: B6
  times a warm query. While a marquee is dragged the editor only draws its box; it runs one query,
  when the marquee is released, which usually follows a change or a load and which B6 does not
  time. Issue #43 measures that query apart ([below](#what-issue-43-decided)).
- **Where a query went.** On a 6-core AMD EPYC developer machine (Node.js 24.22.1, Vitest's
  benchmark mode), the query at `c5bcfd3` took 5.2 ms at the median and 17.6 ms at the 95th
  percentile, and 18 ms for the whole scene, all of whose elements it encloses. A CPU profile of
  1,536 queries of B6's loop, sampled every 50 µs, put 29 % of their time in building the outline
  points, an object for each point and new vectors for each turn, 23 % in the filters, the sort and
  the map that the query ran over its candidates, 17 % in the spatial index gathering the
  candidates through a set, 14 % in looking each candidate up in the store, 11 % in garbage
  collection, 3 % in turning vectors and 3 % in comparing order keys. Timed apart, at the median of
  the 32 marquees, gathering the candidates took 0.7 ms, looking them up 1.1 ms, the outlines
  2.1 ms and the sort 0.4 ms.
- **An element's row.** The selection module computes, for each element, the four edges of its
  world bounds and the smallest and largest x and y of its outline points, operation for operation
  as `worldBounds` and the outline points of the rule above compute them, but without building a
  point; a turned element's cosine and sine are taken once rather than once a point, which gives the
  same numbers. A marquee encloses the element when its kind has a geometry, its bounds meet the
  marquee, edges included, as the spatial index's candidates do, and the extent lies inside, edges
  included. That holds exactly when every outline point lies inside, since the extent's edges are
  coordinates of the points themselves, and an unturned point is still only moved by the origin.
- **Rows kept per scene.** The module keeps each scene's rows, one for each of the store's ordered
  elements, with the scene's revision and the ordered array they came from. While both are the
  same, a query scans the rows in drawing order and keeps the identifiers of the elements it
  encloses, so that no query sorts the scene. Until a query makes them again, the rows keep the
  ordered array they came from, and with it the elements of that revision
  ([how long](#what-issue-43-decided)).
- **After a change.** A marquee that meets at most a sixteenth of the elements, counted by the old
  rows' bounds against the old rows' number or, before the scene has rows, by its candidates against
  the number of ordered elements, is answered from the spatial index's candidates: their rows are
  computed and only the elements they enclose are sorted into drawing order. A marquee that meets
  more than a sixteenth of the old rows makes the rows again, keeping the row of every element that
  is still the same object at the same place and computing the others. Old rows that are empty, or
  that lie elsewhere once every element moved away or most of the elements were added, meet few
  marquees, so in those states every whole-scene marquee was still answered from its candidates and
  the rows were not made again, for good once they were empty; issue #43 changed the count
  ([below](#what-issue-43-decided)). The store gives a new ordered array whenever a change set
  raises its revision, previews included, and never changes an element in place, so a kept row
  always holds its element's numbers; a reader whose revision stays as it was is still followed
  through its ordered elements. A marquee that is not finite or has a negative size is refused by
  the spatial index's own check, as before, even when no box query runs.
- **What stays the same.** The rule and the order of the result. Two properties compare the query
  with the scan, exactly and in order. One loads 250 random scenes of every kind, among them
  elements placed up to a billion units away, turned by quarter turns, by a hair or by almost a
  whole turn, stroked as thinly as the model allows, with points normalised only within the
  model's tolerance, and arrows, which have no geometry yet; it queries them with marquees dragged
  from one corner of the content to the far one and with marquees on an element's outline or
  bounds, some edges moved by one double. The other applies 120 runs of random moves, turns,
  resizes, re-keys, additions and removals, previews included, and queries between the changes. A
  property compares the rows of 3,000 random elements, and those of the benchmarks' 10,000, with
  `worldBounds` and the outline points and finds no difference. Tests also follow what a query
  reads: nothing of an unchanged scene, only the moved element after a move, and only the
  candidates of a marquee over few elements. Of 31 regressions planted outside Git, among them
  rows kept whatever changed, rows reused by identifier, a strict edge, a lost turn and an
  unsorted index path, the tests caught 28, each failing 1 to 17 of them, and B6's check 11; the
  other three, rows kept on the revision alone, a query without its own box check and a path
  counted by enclosed rather than meeting rows, each fail one test added for them.
- **What was measured and not done.** In a harness of B6's loop on the developer machine: a cache
  of each element's row in a weak map, read while scanning the ordered elements, took 1.3 ms at
  the median and 2.7 ms at the 95th percentile, its look-ups costing more than the comparisons;
  rows built through `worldBounds` and `obbToScene` took 12.7 ms to make for 10,000 elements,
  against 3.7 ms for numbers computed without building points into a typed array, and the row
  objects kept now take 4 to 9 ms; rows in a typed array were no faster once made than row
  objects, and strict TypeScript reads each of their numbers as possibly missing; answering every
  query from the index's candidates with rows left B6 at 3.4 ms at the median and 11.9 ms at the
  95th percentile. Making the rows again after every change, with no index path, made a small
  marquee after one moved element take 1.1 ms against 0.13 ms before, and choosing the path by
  the candidates themselves made a large marquee after a move run a box query for nothing, 5.8 ms
  against 1.6 ms when the old rows count.
- **The cost after a change.** A query on that machine, right after the change that each row
  names, at the median of 16 (in ms):

  | Query                               | 10,000 elements, before | after | 100,000, before | after |
  | ----------------------------------- | ----------------------- | ----- | --------------- | ----- |
  | Whole scene, nothing changed        | 18.9                    | 0.22  | 370             | 9.4   |
  | Whole scene, one element moved      | 21.2                    | 1.1   | 349             | 16.4  |
  | Whole scene, 1,000 elements moved   | 21.3                    | 2.5   | 383             | 17.0  |
  | Whole scene, just loaded            | 23.1                    | 14.6  | 339             | 190   |
  | Small marquee, one element moved    | 0.13                    | 0.16  | 0.22            | 0.28  |
  | Small marquee, 1,000 elements moved | 0.16                    | 0.18  | 0.21            | 0.25  |
  | Small marquee, just loaded          | 0.14                    | 0.20  | 0.21            | 0.33  |

  The editor's view reads the store's ordered elements after every change, so they are ready when
  a marquee is released, as the table assumes. A bare store makes them on the first read after a
  change, which a small marquee over a scene that has no rows yet then pays: 3.2 to 3.3 ms for
  10,000 elements and 63 to 73 ms for 100,000, against 0.11 to 0.21 ms before. A scene's rows take
  2.4 MB of heap for 10,000 elements.

- **Before and after.** B6 on that machine, in three runs of each taken in turn (at a load of
  about 3):

  | B6              | Before (`main` at `c5bcfd3`) | After             |
  | --------------- | ---------------------------- | ----------------- |
  | Median          | 5.39 to 6.10 ms              | 0.124 to 0.125 ms |
  | 95th percentile | 18.9 to 24.2 ms              | 0.239 to 0.319 ms |

  Computing rows instead of outline points, before the rows were kept, gave 4.2 to 4.4 ms and 14 to
  16 ms in three runs.

- **In CI.** The marquee query did not change between ENG-15 and this issue, so the CI runs before
  it all measured the same code (4-core runners, runner image ubuntu24 20261101.360.1, Node.js
  24.22.1): twelve runs on four processor models missed B6 in each, at 3.9 to 5.0 ms at the 95th
  percentile on an AMD EPYC 9V45, 5.7 to 7.1 ms on an EPYC 9V74, 7.0 to 8.2 ms on an EPYC 7763 and
  9.2 ms on an Intel Xeon Platinum 8370C. The pull request's first CI run, 42700510340 on an EPYC
  9V74, measured 0.097 ms at the 95th percentile and 0.062 ms at the median, where the last run on
  `main`, 42685994872 at `c5bcfd3`, had measured 5.726 ms. The pull request keeps the record of
  every later run.

## What issue #41 decided

Issue #41 follows the misses of B1 ([performance budgets](quality.md#performance-budgets)) that
remained in CI after issue #34, points the records that named that closed issue away from it, and
looks for what makes a run miss; issue #49 follows B1's misses after it. It changes no code that
B1 measures, no budget, tolerance or pixel, and no processor's gate.

- **The reports.** Every CI performance report from the first run of pull request #40 to the push
  of `0a3116d` to `main`, 26 in all: the pull request's six, the five on `main` since its merge, and
  the fifteen of the pull requests of issues #35, #36, #43 and #45, their manual dispatches
  included. From the second on, the renderer, the web app's source, the browser measurements with
  their configuration, the seeded scenes, the lockfile and the CI workflow are byte for byte those
  of `b2d60b3`, and the first, at `0d6b9ff`, lacks only `791f735`'s dash comparison. The engine is
  not: issues #35, #36, #43 and #45 changed it, its bundle growing from 28.873 to 30.292 KB and
  the web app's from 107.35 to 108.78 KB. Inside the measured `render` call, though, the renderer
  reaches the engine only through `geometryOf`, `layoutText` and `localBox`, when its path cache
  misses and it builds an element's drawing, and of the code that they run only the point extent
  that `localBox` takes of a line or a freehand stroke changed (issue #36). B1's pans change no
  element, and the cache holds 20,000 drawings, more than B1's 5,000 elements, so none of B1's
  measured frames, which follow 20 frames of warm-up, builds a drawing. A pull request's run
  measures GitHub's merge of its head into `main`, whose commit the table gives. All 26 ran on 4
  cores with 15.6 GiB, Linux 7.0.0-1017-azure, runner image ubuntu24 20261101.360.1, runner
  2.338.2, Node.js 24.22.1 and Chromium 156.0.8078.4. Each value is computed from the samples of
  the report's `performance-report` artifact, whose SHA-256 matched the digest GitHub gives, by
  `npm run perf:tail`, which reads `report.json` files and prints these tables; the artifact of
  42673197733's first attempt was replaced by its third, and a copy downloaded before, with the
  digest GitHub gave then, stands in for it.

  | CI run (attempt) | Event             | Branch                         | Commit    | Processor           | B1 median | B1 95th   | B1 frames ≥ 9 ms | B2 median | B2 95th  | Result    |
  | ---------------- | ----------------- | ------------------------------ | --------- | ------------------- | --------- | --------- | ---------------- | --------- | -------- | --------- |
  | 42670318550 (1)  | pull_request      | perf/34-scene-redraw-budgets   | `108dada` | EPYC 7763           | 7.9 ms    | 11 ms     | 29 of 100        | 1.7 ms    | 2.2 ms   | B1 missed |
  | 42671462319 (1)  | pull_request      | perf/34-scene-redraw-budgets   | `0afd455` | EPYC 9V45           | 5.2 ms    | 5.5 ms    | 1 of 100         | 1.3 ms    | 1.7 ms   | met       |
  | 42673197733 (1)  | pull_request      | perf/34-scene-redraw-budgets   | `592a0ac` | EPYC 9V74           | 7.3 ms    | 10.01 ms  | 28 of 100        | 1.6 ms    | 1.9 ms   | B1 missed |
  | 42673197733 (3)  | pull_request      | perf/34-scene-redraw-budgets   | `592a0ac` | EPYC 9V45           | 5.5 ms    | 7.2 ms    | 1 of 100         | 1.4 ms    | 1.7 ms   | met       |
  | 42677720242 (1)  | workflow_dispatch | perf/34-scene-redraw-budgets   | `b2d60b3` | EPYC 7763           | 7 ms      | 7.625 ms  | 2 of 100         | 1.6 ms    | 2 ms     | met       |
  | 42678182735 (1)  | workflow_dispatch | perf/34-scene-redraw-budgets   | `b2d60b3` | EPYC 9V74           | 6.4 ms    | 7.6 ms    | 1 of 100         | 1.4 ms    | 1.8 ms   | met       |
  | 42685994872 (1)  | push              | main                           | `c5bcfd3` | EPYC 9V74           | 6.3 ms    | 6.7 ms    | 0 of 100         | 1.4 ms    | 1.7 ms   | met       |
  | 42700510340 (1)  | pull_request      | perf/35-marquee-query-budget   | `8bf896d` | EPYC 9V74           | 6.9 ms    | 7.805 ms  | 1 of 100         | 1.5 ms    | 1.9 ms   | met       |
  | 42703817412 (1)  | pull_request      | perf/35-marquee-query-budget   | `450f227` | EPYC 7763           | 6.9 ms    | 7.205 ms  | 0 of 100         | 1.5 ms    | 1.905 ms | met       |
  | 42704145240 (1)  | workflow_dispatch | perf/35-marquee-query-budget   | `465b9ae` | EPYC 9V45           | 5.4 ms    | 5.8 ms    | 1 of 100         | 1.4 ms    | 1.7 ms   | met       |
  | 42704460935 (1)  | workflow_dispatch | perf/35-marquee-query-budget   | `465b9ae` | EPYC 9V74           | 7.8 ms    | 10.5 ms   | 13 of 100        | 1.7 ms    | 2.1 ms   | B1 missed |
  | 42704919237 (1)  | workflow_dispatch | perf/35-marquee-query-budget   | `465b9ae` | Xeon Platinum 8573C | 6.2 ms    | 8.7 ms    | 4 of 100         | 1.7 ms    | 2.005 ms | B1 missed |
  | 42720563032 (1)  | push              | main                           | `8a666f4` | EPYC 9V45           | 5.2 ms    | 5.61 ms   | 1 of 100         | 1.3 ms    | 1.605 ms | met       |
  | 42730911670 (1)  | pull_request      | perf/36-change-set-move-budget | `685f8d8` | EPYC 9V74           | 6.4 ms    | 8.905 ms  | 5 of 100         | 1.4 ms    | 1.8 ms   | B1 missed |
  | 42741209810 (1)  | pull_request      | perf/36-change-set-move-budget | `f2fad80` | EPYC 7763           | 6.8 ms    | 7.205 ms  | 0 of 100         | 1.5 ms    | 2.1 ms   | met       |
  | 42741520852 (1)  | workflow_dispatch | perf/36-change-set-move-budget | `c203ab6` | EPYC 9V74           | 6.2 ms    | 6.6 ms    | 0 of 100         | 1.4 ms    | 1.8 ms   | met       |
  | 42741774689 (1)  | workflow_dispatch | perf/36-change-set-move-budget | `c203ab6` | Xeon Platinum 8370C | 6.8 ms    | 10.1 ms   | 23 of 100        | 1.7 ms    | 2.205 ms | B1 missed |
  | 42742147738 (1)  | workflow_dispatch | perf/36-change-set-move-budget | `c203ab6` | EPYC 7763           | 7.2 ms    | 10.005 ms | 23 of 100        | 1.6 ms    | 2 ms     | B1 missed |
  | 42761184353 (1)  | push              | main                           | `f93bcfd` | EPYC 9V74           | 6.3 ms    | 6.705 ms  | 0 of 100         | 1.4 ms    | 1.9 ms   | met       |
  | 42777441360 (1)  | pull_request      | perf/43-cold-marquee-rows      | `605a448` | EPYC 9V45           | 5.4 ms    | 6.1 ms    | 0 of 100         | 1.5 ms    | 1.8 ms   | met       |
  | 42778196743 (1)  | workflow_dispatch | perf/43-cold-marquee-rows      | `56ec6c7` | EPYC 7763           | 7.1 ms    | 10.405 ms | 23 of 100        | 1.5 ms    | 2.205 ms | B1 missed |
  | 42794765703 (1)  | push              | main                           | `285918c` | EPYC 7763           | 7.5 ms    | 10.715 ms | 28 of 100        | 1.8 ms    | 2.31 ms  | B1 missed |
  | 42801523097 (1)  | pull_request      | fix/45-planning-reentry-errors | `a6db55e` | EPYC 9V74           | 6.5 ms    | 6.8 ms    | 0 of 100         | 1.45 ms   | 1.9 ms   | met       |
  | 42801972456 (1)  | pull_request      | fix/45-planning-reentry-errors | `a6db55e` | EPYC 9V74           | 6.5 ms    | 7.6 ms    | 0 of 100         | 1.4 ms    | 1.9 ms   | met       |
  | 42802411087 (1)  | workflow_dispatch | fix/45-planning-reentry-errors | `d377f93` | EPYC 9V74           | 6.5 ms    | 7.005 ms  | 1 of 100         | 1.4 ms    | 1.8 ms   | met       |
  | 42810907279 (1)  | push              | main                           | `0a3116d` | EPYC 9V74           | 6.4 ms    | 6.805 ms  | 0 of 100         | 1.5 ms    | 1.9 ms   | met       |

- **How often B1 missed.** Per processor model, as Node.js names the runner's processor, on `main`
  and in all 26:

  | Processor           | Reports on `main` | B1 missed on `main` | All reports | B1 missed | B2 missed |
  | ------------------- | ----------------- | ------------------- | ----------- | --------- | --------- |
  | EPYC 7763           | 1                 | 1                   | 7           | 4         | 0         |
  | EPYC 9V45           | 1                 | 0                   | 5           | 0         | 0         |
  | EPYC 9V74           | 3                 | 0                   | 12          | 3         | 0         |
  | Xeon Platinum 8573C | 0                 | 0                   | 1           | 1         | 0         |
  | Xeon Platinum 8370C | 0                 | 0                   | 1           | 1         | 0         |
  | All                 | 5                 | 1                   | 26          | 9         | 0         |

  B1 missed in one of the five reports on `main`, on an EPYC 7763, and in 9 of the 26, on four
  processor models; B2 met its budget in all 26, at 1.605 to 2.31 ms, and B1's median frame was
  within B1's budget in all 26, at 5.2 to 7.9 ms. The EPYC 9V45 met B1 in its five reports and
  each Xeon missed in its one; the EPYC 7763 missed in four of seven and the EPYC 9V74 in three of
  twelve, so that one model gives both results with the same tree. On the EPYC 9V74, report 1
  (42673197733, first attempt), whose merge `592a0ac` has `b2d60b3`'s tree, missed, and report 4,
  at `b2d60b3`, met; on the EPYC 7763, 42741209810, whose merge `f2fad80` has `c203ab6`'s tree,
  met, and 42742147738, at `c203ab6`, missed.

- **A second group of frames.** Each of the nine missing reports has, beside its usual frames, a
  second group of 9 to 28 frames at 2 ms or more above its median, whose own median is 1.35 to
  1.48 times that of the usual frames, 2.2 to 3.2 ms more. The seventeen meeting reports have at
  most four such frames each, and eight have none. How many of them reach 9 ms follows the usual
  frames' speed: in 42730911670, on an EPYC 9V74 whose usual frames took 6.3 ms, the second group's
  25 frames took 8.4 to 9.3 ms, only five of them 9 ms or more, and B1 missed at 8.905 ms.

- **Where in the run.** In seven of the nine, the second group is spread over the whole run, in
  every fifth of the 100 frames but the first of 42742147738, whose first slow frame is its 25th:
  the gaps between slow frames run from 1 to 12 frames with no fixed period, successive frames are
  no more often slow together than apart (lag-one autocorrelation −0.18 to +0.08, runs tests within
  1.75 standard deviations of chance), and the slow frames fall on pans of both directions alike,
  94 and 102 in all nine. In the other two they come in one stretch: frames 70 to 99 of
  42704460935, on an EPYC 9V74, and frames 4 to 26 of 42704919237, on the Xeon Platinum 8573C. A
  longer warm-up than B1's 20 frames would have hidden only the latter, so the warm-up explains at
  most one of the nine misses, and the order and the direction of the frames none.

- **The rest of each run.** On the EPYC 9V74 the missing runs were slower runners: their B5, a hit
  test that the job's benchmarks time in Node.js shortly before its browser measurements, was 0.071
  to 0.078 ms and their usual B1 frames 6.3 to 7.8 ms, against 0.054 to 0.059 ms and 6.2 to 6.9 ms
  in its nine meeting runs. On the EPYC 7763 nothing else separates them: B5 was 0.073 to 0.075 ms
  in the four missing runs and 0.072 to 0.074 ms in the three meeting ones, and I1 14.18 to 15.89
  ms against 14.25 to 14.48 ms. B2, timed in a page of its own later in the same job with a tenth of
  the elements in view, shows no second group where B1 has one: its frames at 1.35 times its median
  or more number 1 to 7 in the missing runs and 0 to 8 in the meeting ones.

- **What is the same either way.** Besides the code inside the measured call and the versions
  above, the job's steps run one after another and Playwright runs one test at a time, so no other
  step of the job runs beside B1's test. The run's other jobs run on runners of their own, and they
  overlapped B1's test in missing and meeting runs alike, both of them in 7 of the 9 missing runs
  and in 12 of the 17 meeting ones. The Azure region is not the sole decider: on the EPYC 9V74,
  westus2 and westus3 each ran a missing and a meeting report. On the EPYC 7763 it is unknown: the
  four missing reports ran in westus and westus2 and the three meeting ones in eastus, eastus2 and
  westcentralus, a split that a one-sided Fisher test puts at p ≈ 0.03, but one picked after the
  fact from seven reports.

- **Garbage collection.** Three Chromium traces of B1's loop on the developer machine at
  `0a3116d`, 100 measured frames each, held four minor garbage collections on the page's main
  thread while the measured frames ran, none inside a render, and no major one: too few to slow a
  quarter of the frames, and none in them. `performance.measure` wraps the synchronous `render`
  call only, so no other task of the page's main thread runs inside it.

- **What stays unknown.** The CI reports keep no trace, garbage collection or long task of B1's
  frames and no time of each frame, so what slows a frame on a runner that misses, and whether the
  slow frames recur in time, is not known; a trace of B1 on such a runner would tell, and no CI job
  records one yet, which issue #49 is to do.

- **What it decides.** B1's misses depend on the run, not on its code or on its processor model
  alone. What B1 measures, its budget, its warm-up of 20 frames and the tolerance stay as they are.
  `docs/performance/baseline.json` names issue #49, not this issue, as B1's follow-up, so that it
  names an open issue once this one closes; issue #49 is to trace B1's frames on a CI runner and
  find what slows them. A report that misses B1 says `missed, follow-up #49`, and no issue for B2,
  which every report met; the README, `AGENTS.md`, the engine's README and the architecture
  overview say the same, and tests read the baseline, the report's rendering of it and this
  record. Once a processor model has three runs on `main` and its gate is active, a run like
  42704460935, at 10.5 ms on an EPYC 9V74, after three runs that met B1 would exceed the 9.6 ms
  limit, the budget and 20 %, and fail CI with no change of code; the remedy is then more runs or
  an ADR, as [issue #38 decided](quality.md#what-issue-38-decided), not a wider tolerance in
  passing. The reports are not recorded in the baseline, which would start a processor's gate.

## What issue #43 decided

Issue #43 takes up what the review of issue #35's pull request left for later, its m1, m2, s1, s2
and s3, without changing what a marquee selects or the order of the result:

- **When rows are made again.** After a change, once the scene's revision or its ordered elements
  are no longer those of the kept rows, a query compares counts with a sixteenth of the store's
  ordered elements now:
  1. when the scene kept rows and more than that many of their bounds meet the marquee, the rows
     are made again at once, with no box query;
  2. otherwise the kept rows count as no rows, and the spatial index's candidates are counted: more
     than that many make the rows again;
  3. otherwise the candidates answer the query, as issue #35 decided, and the rows stay as they
     were.

  Making the rows again keeps the row of every element that is the same object at the same index
  of the kept ordered array, computes the others, and puts the new rows, the revision and the
  ordered array in place of the kept ones, so that the next query of the unchanged scene scans
  them. A marquee that meets the bounds of more than a sixteenth of the elements now therefore
  always makes the rows again. Issue #35 counted the kept rows against their own number, and the
  rows of an empty scene, or rows that lie elsewhere, meet few marquees: after delete all, a
  marquee and undo, after every element moved away, and after most of the elements were added,
  every whole-scene marquee was answered from its candidates and the rows were never made again
  (the review's m1).

- **How long rows keep an ordered array (s2).** From a change until the first query after it that
  makes the rows again by the rule above, or until the scene, the weak map's key, is collected. A
  marquee over few elements leaves them, and with them the ordered array and the elements of the
  revision they were made of. Each scene still has its own rows, and a query of one scene never
  reads or replaces another's.
- **What a query after a change reads.** The count reads the store's ordered elements. The
  editor's view reads them after every gesture, so a marquee released after a change finds them
  made; a bare store makes them on that read, which a small marquee then pays: in a native Node.js
  probe on the developer machine, 4.4 to 4.5 ms instead of 0.23 to 0.32 ms right after one of
  10,000 elements moved (three runs of each taken in turn, at the median of 11).
- **Before and after.** In that probe (6-core AMD EPYC, Node.js 24.22.1, at a load of 2.4 to 3.9),
  over the benchmarks' 10,000 elements and a whole-scene marquee, in three runs of each taken in
  turn, at the median of 11 (in ms):

  | After                                     | First query, before | after        | Next query, before | after        |
  | ----------------------------------------- | ------------------- | ------------ | ------------------ | ------------ |
  | Delete all, a marquee and undo            | 20.8 to 30.9        | 12.8 to 17.0 | 23.5 to 33.6       | 0.24 to 0.33 |
  | Every element moved 50,000 units away     | 18.6 to 23.2        | 11.6 to 12.7 | 20.1 to 23.9       | 0.23 to 0.26 |
  | 9,968 elements added to 32 kept elsewhere | 20.0 to 21.0        | 15.0 to 16.1 | 18.9 to 27.7       | 0.23 to 0.24 |

  The first query now makes the rows, at about the cost of the first query after a load (I6
  below), where before it looked up and sorted 10,000 candidates; each query after it scans them.
  In each of the three states the ordered array that the rows had kept was collected after that
  first query, and stayed reachable at `main`. After one or 1,000 elements moved, a whole-scene
  query takes the same path as before: three runs of each taken in turn, at the median of 31,
  measured 1.1 to 1.9 and 4.0 to 5.2 ms, against 1.5 to 2.8 and 3.7 to 4.4 ms at `main`. Each
  query's result equalled the next one's, and the tests compare every result with a scan of every
  element.

- **Tests.** Over the benchmarks' 10,000 elements, a whole-scene marquee after delete all, a
  marquee and undo, after every element moved 50,000 units away, after that and the removal of all
  but 500 of them, and after 9,968 elements were added to 32 kept elsewhere encloses what a scan of
  every element encloses, and the next query reads no element of the scene, which only a scan of
  current rows does; a small marquee after every element moved reads only its candidates and leaves
  the rows. A property loads up to 12 elements of every kind and, over 150 runs of 8 sweeps each
  (removing them all or all but one in twenty, restoring them, moving all of them or one, adding
  twenty times as many), expects the query after any marquee whose candidates are more than a
  sixteenth to read no element. These four tests and the property fail on issue #35's query. Over a
  few squares, a marquee that meets exactly a sixteenth of them reads only its candidates, before
  the scene has rows and after a change; a thin band that meets many kept rows runs no box query;
  and a query of another scene leaves a scene's rows current. Two tests load three squares under
  one order key with the largest identifier first, which the spatial index then lists first, and
  expect a marquee over few elements to give them by identifier before the scene has rows and after
  a change (s1); a sort by order key alone, which passed every test before, fails both. Of 17
  regressions planted outside Git, among them issue #35's count, kept rows trusted, rows not kept or
  kept with their old ordered array, rows reused by index, the revision alone, the kept rows'
  number as the limit, one cache slot for every scene, either limit at exactly a sixteenth and four
  wrong orders, the selection tests, the editor's selection tests and B6's check caught 12, B6's
  check 2 of them; once the tests of the removal of most, of exactly a sixteenth, of the box query
  and of another scene were added, they caught all 17, each failing 1 to 18 tests.
- **What B6 times, and the first query (m2).** B6 is unchanged, a warm query of an unchanged scene
  ([above](#what-issue-35-decided)). Three benchmarks time the first whole-scene query after a
  change or a load apart, as measurements that are no budget, I4 to I6 of the performance report
  ([how](quality.md#what-issue-43-decided)): I4 after one of the 10,000 elements moved, I5 after
  1,000 moved and I6 just after a load. In two runs on the developer machine, of the benchmark file
  alone and of the whole performance pipeline, at a load of about 2 and 2.5 (in ms):

  | Measurement                                  | Median        | 95th percentile |
  | -------------------------------------------- | ------------- | --------------- |
  | I4, the first query after one element moved  | 0.83 and 0.85 | 1.44 and 1.29   |
  | I5, the first query after 1,000 moved        | 2.6 and 2.8   | 7.0 and 6.0     |
  | I6, the first query just after a load        | 12.6 and 15.3 | 36.1 and 43.1   |
  | B6, queries of an unchanged scene (pipeline) | 0.19          | 0.43            |

- **Enclosure stays geometric (s3).** P0 keeps REQ-S06 as ENG-06 defined it: a marquee encloses
  the corners of a box kind's local box, turned with it, and every point of a point kind, and a
  stroke's width counts only through the world bounds that the candidates meet. The rendered
  outline, with the stroke's width, caps and joins and an ellipse's curve, would change which
  elements a marquee selects, so it needs a behavioural investigation of its own under the
  clean-room policy ([ADR 0003](../../adr/0003-clean-room-reference-policy.md)) and then an issue
  with acceptance criteria before any code. Issue #43 has no new behavioural evidence for it, so it
  opened neither and changed nothing about the rule.
- **Not here.** A budget for the first query or a change to what B6 times (an ADR first, as for
  any budget), a cheaper first query after a load, and the rendered outline.

## Export

PNG and SVG export (P2, REQ-X04) reuse the outline commands: PNG through the same renderer on an
offscreen canvas, SVG by writing the commands as path data. The export never reads pixels from the
editing canvas.

## Requirements served

REQ-F01, REQ-F02, REQ-S01 to REQ-S04, REQ-S06, REQ-S07, REQ-S12, REQ-Y06 and REQ-X04.
