import type { Box, ElementId, OverlayPrimitive, Point, RenderFrame } from '@planewright/engine';

import type { Context2D, Layer } from './canvas.ts';
import type { PathCache } from './path-cache.ts';
import { place } from './place.ts';

// The overlay layer (docs/architecture/engine/rendering-and-hit-testing.md#drawing-the-overlay-layer).

/**
 * Planewright's selection colour, Construction Violet (ADR 0012's decision D1), for outlines,
 * handle borders and the marquee's edge.
 */
export const SELECTION_COLOR = '#6547b4';
export const HANDLE_FILL = '#ffffff';
/** The selection colour at about a tenth of its opacity. */
export const MARQUEE_FILL = '#6547b41a';

export type OverlayFrame = NonNullable<RenderFrame['overlay']>;

/** What every primitive is drawn with: the context in device pixels and the device grid. */
interface Pen {
  readonly context: Context2D;
  readonly frame: RenderFrame;
  readonly cache: PathCache;
  /** Device pixels per CSS pixel. */
  readonly ratio: number;
  /** The line width in whole device pixels, at least 1. */
  readonly line: number;
  /** A screen coordinate in device pixels, moved so that a line of the pen's width is sharp. */
  readonly snap: (value: number) => number;
}

function penFor(context: Context2D, frame: RenderFrame, cache: PathCache): Pen {
  const ratio = frame.viewport.pixelRatio;
  const line = Math.max(1, Math.round(ratio));
  // An odd width is centred on a pixel's middle, an even one on a pixel's edge.
  const offset = (line % 2) / 2;
  return {
    context,
    frame,
    cache,
    ratio,
    line,
    snap: (value) => Math.round(value * ratio - offset) + offset,
  };
}

function outline(pen: Pen, corners: readonly [Point, Point, Point, Point]): void {
  const { context, snap } = pen;
  const [first, ...rest] = corners;
  context.beginPath();
  context.moveTo(snap(first.x), snap(first.y));
  for (const corner of rest) context.lineTo(snap(corner.x), snap(corner.y));
  context.closePath();
  context.stroke();
}

function handle(pen: Pen, center: Point, size: number, round: boolean): void {
  const { context, snap, ratio } = pen;
  if (round) {
    context.beginPath();
    context.arc(center.x * ratio, center.y * ratio, (size * ratio) / 2, 0, 2 * Math.PI);
    context.fillStyle = HANDLE_FILL;
    context.fill();
    context.stroke();
    return;
  }
  const side = Math.round(size * ratio);
  const x = snap(center.x - size / 2);
  const y = snap(center.y - size / 2);
  context.fillStyle = HANDLE_FILL;
  context.fillRect(x, y, side, side);
  context.strokeRect(x, y, side, side);
}

function marquee(pen: Pen, box: Box): void {
  const { context, snap } = pen;
  const x = snap(box.x);
  const y = snap(box.y);
  const width = snap(box.x + box.width) - x;
  const height = snap(box.y + box.height) - y;
  context.fillStyle = MARQUEE_FILL;
  context.fillRect(x, y, width, height);
  context.strokeRect(x, y, width, height);
}

/** An element's outline along the path the scene layer drew it with, if it drew it. */
function elementOutline(pen: Pen, id: ElementId): void {
  const drawing = pen.cache.peek(id);
  if (drawing === undefined) return;
  const { context, frame } = pen;
  const scale = pen.ratio * frame.camera.zoom;
  context.save();
  place(context, drawing, frame.camera, scale);
  context.lineWidth = pen.line / scale;
  context.stroke(drawing.path);
  context.restore();
}

function drawPrimitive(pen: Pen, primitive: OverlayPrimitive): void {
  switch (primitive.type) {
    case 'selection-outline':
      outline(pen, primitive.corners);
      break;
    case 'handle':
      handle(pen, primitive.center, primitive.size, primitive.handle === 'rotate');
      break;
    case 'marquee':
      marquee(pen, primitive.box);
      break;
    case 'element-outline':
      elementOutline(pen, primitive.element);
      break;
  }
}

/**
 * Redraws the overlay layer in screen space: it clears the backing store, then draws each
 * primitive in order in device pixels, with lines a whole number of device pixels wide on the
 * device grid, so that the selection chrome stays sharp at every pixel ratio.
 */
export function drawOverlay(
  layer: Layer,
  frame: RenderFrame,
  overlay: OverlayFrame,
  cache: PathCache,
): void {
  const { canvas, context } = layer;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  const pen = penFor(context, frame, cache);
  context.lineWidth = pen.line;
  context.strokeStyle = SELECTION_COLOR;
  for (const primitive of overlay.primitives) drawPrimitive(pen, primitive);
}
