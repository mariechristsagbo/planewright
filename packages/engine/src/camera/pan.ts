import type { Point } from '../model/elements.ts';
import { limitCamera } from './camera.ts';
import type { Camera } from './camera.ts';

// Panning (docs/architecture/engine/scene-and-viewport.md#camera-operations). Deltas are screen
// pixels; the input adapter turns line and page wheel deltas into pixels before they get here.

/**
 * Pans by a drag's screen delta: the camera moves against it by the delta divided by the zoom,
 * so the content follows the pointer exactly (Space+drag, a middle-button drag, the Hand tool).
 */
export const panBy = (camera: Camera, delta: Point): Camera =>
  limitCamera(
    { x: camera.x - delta.x / camera.zoom, y: camera.y - delta.y / camera.zoom, zoom: camera.zoom },
    camera,
  );

/**
 * Pans by a wheel's delta (REQ-V01): the vertical part moves `y` and the horizontal part `x`, each
 * by the delta divided by the zoom. With Shift both parts move `x`, so Shift+wheel pans
 * horizontally whether the browser reports its delta on the vertical axis or, as some do, already
 * on the horizontal one.
 */
export function wheelPan(camera: Camera, delta: Point, shift: boolean): Camera {
  const dx = shift ? delta.x + delta.y : delta.x;
  const dy = shift ? 0 : delta.y;
  return limitCamera(
    { x: camera.x + dx / camera.zoom, y: camera.y + dy / camera.zoom, zoom: camera.zoom },
    camera,
  );
}
