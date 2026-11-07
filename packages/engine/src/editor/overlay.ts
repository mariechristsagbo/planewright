import { screenFromScene } from '../camera/camera.ts';
import type { Camera } from '../camera/camera.ts';
import { obbCorners } from '../math/obb.ts';
import type { Box, Point } from '../model/elements.ts';
import type { ElementId } from '../model/ids.ts';
import type { SceneReader } from '../scene/store.ts';
import { selectionFrame } from '../selection/frame.ts';
import type { SelectionFrame } from '../selection/frame.ts';
import { layoutHandles } from '../selection/handles.ts';
import type { PointerKind } from '../selection/pointer.ts';
import type { OverlayPrimitive } from './render-frame.ts';

// The overlay layer's content (docs/architecture/engine/rendering-and-hit-testing.md#drawing-the-overlay-layer).

/** What the overlay shows besides the scene: the selection, its handles' pointer and the marquee. */
export interface OverlayState {
  readonly camera: Camera;
  readonly selection: readonly ElementId[];
  /** The pointer that handles are sized for: 8 px for a mouse or pen, 12 px for touch. */
  readonly pointer: PointerKind;
  /** The box selection's rectangle in scene units, or null when none is being drawn. */
  readonly marquee: Box | null;
}

function outlineOf(frame: SelectionFrame, camera: Camera): OverlayPrimitive[] {
  if (frame.type === 'ends') return [];
  const [a, b, c, d] = obbCorners(frame.box);
  const screen = (corner: Point): Point => screenFromScene(corner, camera);
  return [{ type: 'selection-outline', corners: [screen(a), screen(b), screen(c), screen(d)] }];
}

function selectionChrome(scene: SceneReader, state: OverlayState): OverlayPrimitive[] {
  const frame = selectionFrame(scene, state.selection);
  if (frame === null) return [];
  const handles = layoutHandles(frame, state.camera, state.pointer).map(
    ({ handle, center, size }): OverlayPrimitive => ({ type: 'handle', handle, center, size }),
  );
  return [...outlineOf(frame, state.camera), ...handles];
}

function marqueeOf(marquee: Box | null, camera: Camera): OverlayPrimitive[] {
  if (marquee === null) return [];
  const { x, y } = screenFromScene(marquee, camera);
  const box = { x, y, width: marquee.width * camera.zoom, height: marquee.height * camera.zoom };
  return [{ type: 'marquee', box }];
}

/**
 * The overlay's primitives in screen space, in drawing order: the selection outline (one
 * element's turned box, or the axis-aligned box of several; none for a lone two-point line), the
 * handles at their drawn size, then the marquee.
 */
export function overlayPrimitives(
  scene: SceneReader,
  state: OverlayState,
): readonly OverlayPrimitive[] {
  return [...selectionChrome(scene, state), ...marqueeOf(state.marquee, state.camera)];
}
