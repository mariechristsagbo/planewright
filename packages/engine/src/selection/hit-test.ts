import { sceneFromScreen } from '../camera/camera.ts';
import type { Camera } from '../camera/camera.ts';
import type { Point } from '../model/elements.ts';
import type { ElementId } from '../model/ids.ts';
import type { SceneReader } from '../scene/store.ts';
import { topmostAt } from './element-hit.ts';
import { HIT_TOLERANCE } from './pointer.ts';
import type { PointerKind } from './pointer.ts';

// Hit testing (docs/architecture/engine/rendering-and-hit-testing.md#hit-testing).

export type HitResult =
  { readonly type: 'element'; readonly id: ElementId } | { readonly type: 'none' };

/** What a hit test reads: the scene and the camera that shows it. */
export interface HitView {
  readonly scene: SceneReader;
  readonly camera: Camera;
}

const NONE: HitResult = { type: 'none' };

/**
 * What a press at a screen point hits: the topmost element within the pointer's tolerance, 5
 * screen pixels for a mouse or pen and 6 for touch, which is divided by the zoom to give scene
 * units (REQ-S03), or nothing.
 */
export function hitTest(view: HitView, at: Point, pointer: PointerKind): HitResult {
  const point = sceneFromScreen(at, view.camera);
  const id = topmostAt(view.scene, point, HIT_TOLERANCE[pointer] / view.camera.zoom);
  return id === undefined ? NONE : { type: 'element', id };
}
