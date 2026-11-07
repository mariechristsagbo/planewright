import type { Point } from '../model/elements.ts';
import { cameraShowing, clamp, clampZoom, limitCamera, sceneFromScreen } from './camera.ts';
import type { Camera } from './camera.ts';

/** The wheel zoom curve (REQ-V04): a factor of exp(−deltaY / 1000) per event. */
export const WHEEL_ZOOM_SCALE = 1000;

/** The largest wheel delta, in pixels either way, that one event zooms by. */
export const WHEEL_ZOOM_MAX_DELTA = 200;

/**
 * Zooms to `zoom`, first clamped to the limits, keeping the scene point under a screen anchor
 * where it is (REQ-V02, REQ-V04); only the position limit can move it.
 */
export function zoomAbout(camera: Camera, anchor: Point, zoom: number): Camera {
  return limitCamera(
    cameraShowing(sceneFromScreen(anchor, camera), anchor, clampZoom(zoom)),
    camera,
  );
}

/**
 * The factor that one Mod+wheel or trackpad-pinch event zooms by: one continuous curve, so many
 * small deltas zoom as far as one large one (REQ-V04). A step of −100 px zooms in by 1.105.
 */
export const wheelZoomFactor = (deltaY: number): number =>
  Math.exp(-clamp(deltaY, -WHEEL_ZOOM_MAX_DELTA, WHEEL_ZOOM_MAX_DELTA) / WHEEL_ZOOM_SCALE);

/** Zooms by a Mod+wheel or trackpad-pinch event's vertical delta, about the pointer. */
export const wheelZoom = (camera: Camera, pointer: Point, deltaY: number): Camera =>
  zoomAbout(camera, pointer, camera.zoom * wheelZoomFactor(deltaY));
