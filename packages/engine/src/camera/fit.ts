import { aabbCenter } from '../math/aabb.ts';
import type { Box } from '../model/elements.ts';
import { cameraShowing, clampZoom, limitCamera } from './camera.ts';
import type { Camera } from './camera.ts';
import { viewportCenter } from './viewport.ts';
import type { ViewportSize } from './viewport.ts';

/** The screen pixels left free around the content on each side by zoom to fit. */
export const FIT_PADDING = 32;

/** The zoom at which `extent` scene units fill `available` pixels; no limit without extent. */
const fitRatio = (available: number, extent: number): number =>
  extent > 0 ? available / extent : Infinity;

/**
 * Zoom to fit (REQ-V09): the content's bounds, padded by 32 screen pixels on each side, centred on
 * both axes at the largest zoom that shows them whole, but never above 1 and never below 0.1. A
 * side without extent, such as a straight vertical line's width, leaves the zoom to the other.
 * Without content (`null`, an empty document) the camera stays where it is.
 */
export function zoomToFit(camera: Camera, content: Box | null, viewport: ViewportSize): Camera {
  if (content === null) return limitCamera(camera, camera);
  const zoom = clampZoom(
    Math.min(
      1,
      fitRatio(viewport.width - 2 * FIT_PADDING, content.width),
      fitRatio(viewport.height - 2 * FIT_PADDING, content.height),
    ),
  );
  return limitCamera(cameraShowing(aabbCenter(content), viewportCenter(viewport), zoom), camera);
}
