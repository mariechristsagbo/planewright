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

**Box selection** uses `queryBox` for candidates and keeps an element when its whole outline is
inside the marquee: the four rotated corners for box kinds, every point for point kinds (REQ-S06).
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
  borders, outlines and the marquee's edge in Planewright's selection colour `#2a62d0` and the
  marquee filled with `#2a62d01a`.
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

- **In CI.** The first two CI runs of the pull request (4-core runners, runner image ubuntu24
  20261101.360.1, Chromium 156.0.8078.4, Node.js 24.22.1), beside the runs before it on the same
  processor models with the renderer as it was:

  | CI run      | Renderer                 | Processor | B1, median | B1, 95th | B2, 95th |
  | ----------- | ------------------------ | --------- | ---------- | -------- | -------- |
  | 42627742440 | before, at `4ce8490`     | EPYC 9V45 | 7.3 ms     | 9.53 ms  | 2.11 ms  |
  | 42642158624 | before, `main` `4db483f` | EPYC 9V45 | 7.25 ms    | 10.61 ms | 2 ms     |
  | 42648632465 | before, at `97808ed`     | EPYC 9V45 | 6.4 ms     | 8.21 ms  | 2 ms     |
  | 42671462319 | after, at `791f735`      | EPYC 9V45 | 5.2 ms     | 5.5 ms   | 1.7 ms   |
  | 42656464145 | before, `main` `90a456d` | EPYC 7763 | 9.5 ms     | 12.11 ms | 2.9 ms   |
  | 42670318550 | after, at `0d6b9ff`      | EPYC 7763 | 7.9 ms     | 11 ms    | 2.2 ms   |

  B2 is met on both processors. B1 is met on the EPYC 9V45, where the slow frames are gone, and
  still missed on the EPYC 7763, where the median frame is within its budget but about a quarter of
  the frames took 10 to 11 ms; `791f735` only adds a dash comparison without an iterator to
  `0d6b9ff`. The runs before the change on the two other processors seen in CI missed B1 as well:
  10.9 ms on the Xeon Platinum 8370C and 11.62 and 13.92 ms on the EPYC 9V74. The profile leaves no
  change of the same calls that saves that much: the context's own calls are about nine tenths of
  the render, and the changes that would call the context less are the ones above that can change a
  pixel. Whether B1 holds in CI so depends on the runner's processor, and the pull request keeps the
  record of each run.

## Export

PNG and SVG export (P2, REQ-X04) reuse the outline commands: PNG through the same renderer on an
offscreen canvas, SVG by writing the commands as path data. The export never reads pixels from the
editing canvas.

## Requirements served

REQ-F01, REQ-F02, REQ-S01 to REQ-S04, REQ-S06, REQ-S07, REQ-S12, REQ-Y06 and REQ-X04.
