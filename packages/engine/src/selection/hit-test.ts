import { sceneFromScreen } from '../camera/camera.ts';
import type { Camera } from '../camera/camera.ts';
import { obbContainsPoint } from '../math/obb.ts';
import type { Point } from '../model/elements.ts';
import type { ElementId } from '../model/ids.ts';
import type { SceneReader } from '../scene/store.ts';
import { topmostAt } from './element-hit.ts';
import { selectionFrame } from './frame.ts';
import type { SelectionFrame } from './frame.ts';
import { HANDLE_HIT_SIZE, handleAt, layoutHandles } from './handles.ts';
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
 * Whether a selection frame is small: shorter on screen than two handle hit squares along both of
 * its sides, or for a lone two-point line along both axes between its ends. Its handles then cover
 * most of it (the ENG-10 review's m2).
 */
function isSmallFrame(frame: SelectionFrame, camera: Camera, pointer: PointerKind): boolean {
  const limit = 2 * HANDLE_HIT_SIZE[pointer];
  const [width, height] =
    frame.type === 'ends'
      ? [frame.end.x - frame.start.x, frame.end.y - frame.start.y]
      : [frame.box.width, frame.box.height];
  return Math.abs(width) * camera.zoom < limit && Math.abs(height) * camera.zoom < limit;
}

/** A press on a small selection, on one of its elements or inside its box, goes to it first. */
function onSmallSelection(view: HitView, frame: SelectionFrame, pointer: PointerKind, hit: Hit) {
  if (!isSmallFrame(frame, view.camera, pointer)) return false;
  return hit.inBox || (hit.id !== undefined && view.selection.includes(hit.id));
}

/** What lies under a press besides the handles: the topmost element and the selection box. */
interface Hit {
  readonly id: ElementId | undefined;
  readonly inBox: boolean;
}

/**
 * What a press at a screen point hits, the first match in this order: a handle of the current
 * selection, by its screen hit square; the topmost element within the pointer's tolerance, 5
 * screen pixels for a mouse or pen and 6 for touch, divided by the zoom to give scene units
 * (REQ-S03); the selection box, for a press inside the current selection's box; nothing. A small
 * selection's handles come after its elements and its box, so that a drag from them moves it;
 * they still take the presses that miss it.
 */
export function hitTest(view: HitView, at: Point, pointer: PointerKind): HitResult {
  const frame = selectionFrame(view.scene, view.selection);
  const point = sceneFromScreen(at, view.camera);
  const hit: Hit = {
    id: topmostAt(view.scene, point, HIT_TOLERANCE[pointer] / view.camera.zoom),
    inBox: frame?.type === 'box' && obbContainsPoint(frame.box, point),
  };
  const handle =
    frame === null ? undefined : handleAt(layoutHandles(frame, view.camera, pointer), at);
  if (handle !== undefined && !(frame !== null && onSmallSelection(view, frame, pointer, hit))) {
    return { type: 'handle', handle };
  }
  if (hit.id !== undefined) return { type: 'element', id: hit.id };
  return hit.inBox ? SELECTION_BOX : NONE;
}
