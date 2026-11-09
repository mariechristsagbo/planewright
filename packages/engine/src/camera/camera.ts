import type { Point } from '../model/elements.ts';

/**
 * The camera over the unbounded scene (docs/architecture/engine/scene-and-viewport.md#camera).
 * Screen points are CSS pixels from the canvas's top-left corner; scene points are scene units.
 */
export interface Camera {
  /** The scene point shown at the canvas's top-left corner. */
  readonly x: number;
  readonly y: number;
  /** CSS pixels per scene unit, in [0.1, 30]. */
  readonly zoom: number;
}

/** The zoom limits, 10 % and 3000 %, which every camera operation keeps (REQ-V08). */
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 30;

/** How far the camera's position may go from the origin on each axis, in scene units. */
export const POSITION_LIMIT = 1e9;

/** The camera of a new editor: the scene's origin at the canvas's top-left corner, at zoom 1. */
export const DEFAULT_CAMERA: Camera = Object.freeze({ x: 0, y: 0, zoom: 1 });

export const sceneFromScreen = (p: Point, c: Camera): Point => ({
  x: p.x / c.zoom + c.x,
  y: p.y / c.zoom + c.y,
});

export const screenFromScene = (q: Point, c: Camera): Point => ({
  x: (q.x - c.x) * c.zoom,
  y: (q.y - c.y) * c.zoom,
});

/** A value within [min, max]; NaN stays NaN. */
export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

/** A zoom within the limits; NaN stays NaN, for {@link limitCamera} to catch. */
export const clampZoom = (zoom: number): number => clamp(zoom, MIN_ZOOM, MAX_ZOOM);

/** The camera at `zoom` that shows the scene point `scene` at the screen point `screen`. */
export const cameraShowing = (scene: Point, screen: Point, zoom: number): Camera => ({
  x: scene.x - screen.x / zoom,
  y: scene.y - screen.y / zoom,
  zoom,
});

const isNumber = (c: Camera): boolean =>
  !Number.isNaN(c.x) && !Number.isNaN(c.y) && !Number.isNaN(c.zoom);

/**
 * The camera that an operation returns, always a new object: `next` with its zoom and position
 * clamped to the limits, so an infinite input stops at them. A NaN in `next`, which only a
 * non-finite input can cause, keeps the `previous` camera instead, and the default camera
 * replaces a `previous` camera that holds NaN too, such as a stored one, so that the camera stays
 * within the limits for every input and every camera (REQ-V08).
 */
export function limitCamera(next: Camera, previous: Camera): Camera {
  const fallback = isNumber(previous) ? previous : DEFAULT_CAMERA;
  const chosen = isNumber(next) ? next : fallback;
  return {
    x: clamp(chosen.x, -POSITION_LIMIT, POSITION_LIMIT),
    y: clamp(chosen.y, -POSITION_LIMIT, POSITION_LIMIT),
    zoom: clampZoom(chosen.zoom),
  };
}
