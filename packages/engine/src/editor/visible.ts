import type { Camera } from '../camera/camera.ts';
import type { ViewportSize } from '../camera/viewport.ts';
import type { Element } from '../model/elements.ts';
import { compareDrawingOrder } from '../model/order-key.ts';
import type { SceneReader } from '../scene/store.ts';

// Culling (docs/architecture/engine/rendering-and-hit-testing.md#drawing-the-scene-layer).

/** How far around the viewport, in screen pixels, elements are still drawn. */
export const CULL_MARGIN = 64;

/**
 * The elements that the scene layer draws, bottom first: those whose world bounds meet the
 * viewport's scene box grown by {@link CULL_MARGIN} screen pixels, found through the scene's
 * spatial index (REQ-F01).
 */
export function visibleElements(
  scene: SceneReader,
  camera: Camera,
  viewport: ViewportSize,
): readonly Element[] {
  const margin = CULL_MARGIN / camera.zoom;
  const box = {
    x: camera.x - margin,
    y: camera.y - margin,
    width: viewport.width / camera.zoom + 2 * margin,
    height: viewport.height / camera.zoom + 2 * margin,
  };
  return scene
    .queryBox(box)
    .map((id) => scene.get(id))
    .filter((element) => element !== undefined)
    .sort(compareDrawingOrder);
}
