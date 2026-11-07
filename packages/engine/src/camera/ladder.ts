import { nearlyEqual } from '../math/tolerance.ts';
import { MAX_ZOOM, MIN_ZOOM } from './camera.ts';
import type { Camera } from './camera.ts';
import { viewportCenter } from './viewport.ts';
import type { ViewportSize } from './viewport.ts';
import { zoomAbout } from './zoom.ts';

/**
 * The keyboard zoom levels (REQ-V03). They hold 0.9, 1 and 1.1, so one step in from 1 gives 1.1
 * and two steps out from 1.1 give 0.9, as observed (REQ-V02).
 */
export const ZOOM_LADDER: readonly number[] = [
  0.1, 0.25, 0.5, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 2, 3, 4, 6, 8, 12, 16, 24, 30,
];

/**
 * The next level of the ladder above the zoom (in) or below it (out). A level that the zoom
 * equals but for rounding does not count, so a step always moves; past either end the end stays.
 */
export function nextZoomLevel(zoom: number, direction: 'in' | 'out'): number {
  const differs = (level: number): boolean => !nearlyEqual(level, zoom);
  return direction === 'in'
    ? (ZOOM_LADDER.find((level) => level > zoom && differs(level)) ?? MAX_ZOOM)
    : (ZOOM_LADDER.findLast((level) => level < zoom && differs(level)) ?? MIN_ZOOM);
}

/** Zooms in to the next level of the ladder, about the viewport's centre (REQ-V02, REQ-V03). */
export const zoomIn = (camera: Camera, viewport: ViewportSize): Camera =>
  zoomAbout(camera, viewportCenter(viewport), nextZoomLevel(camera.zoom, 'in'));

/** Zooms out to the next level of the ladder, about the viewport's centre (REQ-V02, REQ-V03). */
export const zoomOut = (camera: Camera, viewport: ViewportSize): Camera =>
  zoomAbout(camera, viewportCenter(viewport), nextZoomLevel(camera.zoom, 'out'));

/** Goes back to zoom 1, about the viewport's centre (REQ-V02). */
export const resetZoom = (camera: Camera, viewport: ViewportSize): Camera =>
  zoomAbout(camera, viewportCenter(viewport), 1);
