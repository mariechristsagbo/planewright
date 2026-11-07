import { distance, midpoint } from '../math/vector.ts';
import type { Point } from '../model/elements.ts';
import { cameraShowing, clampZoom, limitCamera, sceneFromScreen } from './camera.ts';
import type { Camera } from './camera.ts';

/** The screen points of two touch pointers, in either order. */
export type PointerPair = readonly [Point, Point];

/**
 * The camera during a two-pointer gesture, computed from where it started rather than step by
 * step, so no rounding builds up (REQ-V07): the start zoom times the ratio of the pointers' current
 * distance to their start distance, with the scene point under the start midpoint kept under the
 * current midpoint. Two pointers that started at one point have no ratio, so they only pan.
 */
export function twoPointerCamera(start: Camera, from: PointerPair, to: PointerPair): Camera {
  const startDistance = distance(from[0], from[1]);
  const ratio = startDistance === 0 ? 1 : distance(to[0], to[1]) / startDistance;
  const held = sceneFromScreen(midpoint(from[0], from[1]), start);
  return limitCamera(
    cameraShowing(held, midpoint(to[0], to[1]), clampZoom(start.zoom * ratio)),
    start,
  );
}
