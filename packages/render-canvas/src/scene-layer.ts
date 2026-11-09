import type { RenderFrame } from '@planewright/engine';

import type { Layer } from './canvas.ts';
import { paint } from './paint.ts';
import type { PathCache } from './path-cache.ts';
import { place } from './place.ts';
import { sceneState } from './scene-state.ts';

// The scene layer (docs/architecture/engine/rendering-and-hit-testing.md#drawing-the-scene-layer).

export type SceneFrame = NonNullable<RenderFrame['scene']>;

/**
 * Redraws the scene layer: forgets the removed elements' paths, clears the backing store to the
 * canvas background, then draws each visible element that is not hidden, bottom first, in its
 * local frame at the pixel ratio times the zoom. No state is saved per element: each element sets
 * its whole transform and, through the frame's scene state, every other state it draws with that
 * differs from what is set, so that it draws as it would in a state of its own (issue #34).
 */
export function drawScene(
  layer: Layer,
  frame: RenderFrame,
  scene: SceneFrame,
  cache: PathCache,
): void {
  const { canvas, context } = layer;
  cache.drop(scene.removed);
  const state = sceneState(context);
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  state.alpha(1);
  state.fillStyle(frame.background);
  context.fillRect(0, 0, canvas.width, canvas.height);
  const scale = frame.viewport.pixelRatio * frame.camera.zoom;
  const hidden = scene.hidden.length === 0 ? null : new Set(scene.hidden);
  for (const element of scene.elements) {
    const drawing = hidden?.has(element.id) === true ? undefined : cache.drawingOf(element);
    if (drawing === undefined) continue;
    place(context, drawing, frame.camera, scale);
    paint(context, state, drawing);
  }
}
