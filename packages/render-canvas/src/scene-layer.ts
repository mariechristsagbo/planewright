import type { RenderFrame } from '@planewright/engine';

import type { Layer } from './canvas.ts';
import { paint } from './paint.ts';
import type { PathCache } from './path-cache.ts';
import { place } from './place.ts';

// The scene layer (docs/architecture/engine/rendering-and-hit-testing.md#drawing-the-scene-layer).

export type SceneFrame = NonNullable<RenderFrame['scene']>;

/**
 * Redraws the scene layer: forgets the removed elements' paths, clears the backing store to the
 * canvas background, then draws each visible element that is not hidden, bottom first, in its
 * local frame at the pixel ratio times the zoom.
 */
export function drawScene(
  layer: Layer,
  frame: RenderFrame,
  scene: SceneFrame,
  cache: PathCache,
): void {
  const { canvas, context } = layer;
  cache.drop(scene.removed);
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = frame.background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  const scale = frame.viewport.pixelRatio * frame.camera.zoom;
  const hidden = new Set(scene.hidden);
  for (const element of scene.elements) {
    const drawing = hidden.has(element.id) ? undefined : cache.drawingOf(element);
    if (drawing === undefined) continue;
    context.save();
    place(context, drawing, frame.camera, scale);
    paint(context, drawing);
    context.restore();
  }
}
