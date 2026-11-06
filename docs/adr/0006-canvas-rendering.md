# ADR 0006: Canvas rendering behind a renderer port

- Status: Proposed
- Date: 2026-11-06

## Context

The canvas must draw thousands of elements while the camera moves and keep pointer feedback within
a frame (REQ-F01, REQ-F02). Selection chrome, previews and the box-selection rectangle change on
almost every pointer move, while committed elements change rarely. Export to PNG and SVG must draw
with the same geometry as the screen (REQ-X04), and hit testing must agree with what is drawn
(REQ-S01 to REQ-S04).

## Decision

1. **Canvas 2D** draws the editing surface.
2. **Two layers.** The canvas host stacks a scene canvas, for committed and transient elements,
   under an overlay canvas, for selection chrome, handles, the selection box and previews that are
   not elements. Each backing store is the CSS size times the device pixel ratio.
3. **A render frame is data.** The engine produces a render frame: camera, viewport size, theme,
   the visible elements in drawing order, overlay primitives and which layers are dirty. The
   renderer port is `render(frame)` and `dispose()`; the renderer holds no editing state.
4. **Shared geometry.** The engine's geometry module describes each kind's outline as path
   commands in its local frame. The canvas renderer turns them into cached paths keyed by element
   identifier and revision; hit testing uses exact distance functions of the same shapes; SVG export
   will serialise the same commands.
5. **Culling and scheduling.** Only elements whose bounds meet the viewport plus a margin are drawn,
   found through the scene's spatial index. Changes mark layers dirty, and the frame scheduler
   coalesces them into at most one render per animation frame.
6. **Text editing is a DOM overlay.** While a text is edited, the web app positions a text area over
   the canvas with the camera transform, and the renderer skips that element.

## Alternatives considered

- **SVG DOM for editing.** Rejected: thousands of nodes cost layout and memory on every camera
  change. SVG remains the export format.
- **WebGL or WebGPU.** Rejected for P0: text, joins, dashes and hatching would need their own
  implementation, and Canvas 2D meets the budgets at the target scene size. The port lets a later
  renderer replace this one.
- **One canvas.** Rejected: an overlay change would repaint every element.
- **Rendering in a worker with an offscreen canvas.** Deferred: text measurement and input latency
  need study first; the data-only render frame keeps the option open.

## Consequences

- Renderer tests run in Node.js against a recording fake of the 2D context; visual tests compare
  Playwright screenshots of Planewright's own output, never captures of another application.
- A dirty overlay never forces a scene repaint; dragging a large selection may later move to an
  optional third layer behind the same port if the budgets require it.
- Requirements served: REQ-F01, REQ-F02, REQ-X04 and the hit-testing rows REQ-S01 to REQ-S04.
