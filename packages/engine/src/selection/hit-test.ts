import { sceneFromScreen } from '../camera/camera.ts';
import type { Camera } from '../camera/camera.ts';
import { obbContainsPoint } from '../math/obb.ts';
import type { Point } from '../model/elements.ts';
import type { ElementId } from '../model/ids.ts';
import type { SceneReader } from '../scene/store.ts';
import { topmostAt } from './element-hit.ts';
import { selectionFrame } from './frame.ts';
import { handleAt, layoutHandles } from './handles.ts';
import type { HandleId } from './handles.ts';
import { HIT_TOLERANCE } from './pointer.ts';
import type { PointerKind } from './pointer.ts';

// Hit testing (docs/architecture/engine/rendering-and-hit-testing.md#hit-testing).

export type HitResult =
  | { readonly type: 'handle'; readonly handle: HandleId }
  | { readonly type: 'element'; readonly id: ElementId }
  | { readonly type: 'selection-box' }
  | { readonly type: 'none' };

/** What a hit test reads: the scene, the current selection and the camera that shows them. */
export interface HitView {
  readonly scene: SceneReader;
  readonly selection: readonly ElementId[];
  readonly camera: Camera;
}

const NONE: HitResult = { type: 'none' };
const SELECTION_BOX: HitResult = { type: 'selection-box' };

/**
 * What a press at a screen point hits, the first match in this order: a handle of the current
 * selection, by its screen hit square; the topmost element within the pointer's tolerance, 5
 * screen pixels for a mouse or pen and 6 for touch, divided by the zoom to give scene units
 * (REQ-S03); the selection box, for a press inside the current selection's box; nothing.
 */
export function hitTest(view: HitView, at: Point, pointer: PointerKind): HitResult {
  const frame = selectionFrame(view.scene, view.selection);
  const handles = frame === null ? [] : layoutHandles(frame, view.camera, pointer);
  const handle = handleAt(handles, at);
  if (handle !== undefined) return { type: 'handle', handle };
  const point = sceneFromScreen(at, view.camera);
  const id = topmostAt(view.scene, point, HIT_TOLERANCE[pointer] / view.camera.zoom);
  if (id !== undefined) return { type: 'element', id };
  return frame?.type === 'box' && obbContainsPoint(frame.box, point) ? SELECTION_BOX : NONE;
}
