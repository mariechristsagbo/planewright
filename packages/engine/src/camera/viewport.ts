import type { Point } from '../model/elements.ts';
import { cameraShowing, limitCamera, sceneFromScreen } from './camera.ts';
import type { Camera } from './camera.ts';

/**
 * The canvas size in CSS pixels and its device pixel ratio, as the editor's `resize` reports them
 * (docs/architecture/engine/rendering-and-hit-testing.md#render-frame-and-renderer-port). It is
 * defined here, the lowest layer that needs it; the camera reads only the size, since device
 * pixels exist only inside the renderer.
 */
export interface ViewportSize {
  readonly width: number;
  readonly height: number;
  /** Device pixels per CSS pixel. */
  readonly pixelRatio: number;
}

/** The screen point at the middle of the canvas, which keyboard zoom and resizing keep. */
export const viewportCenter = (size: ViewportSize): Point => ({
  x: size.width / 2,
  y: size.height / 2,
});

/** Keeps the scene point at the viewport's centre at its centre when the canvas changes size. */
export const resizeViewport = (camera: Camera, from: ViewportSize, to: ViewportSize): Camera =>
  limitCamera(
    cameraShowing(sceneFromScreen(viewportCenter(from), camera), viewportCenter(to), camera.zoom),
    camera,
  );
