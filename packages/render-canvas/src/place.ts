import type { Camera } from '@planewright/engine';

import type { Context2D } from './canvas.ts';
import type { Drawing } from './trace.ts';

/**
 * Sets the transform that draws an element's local frame: `scale` device pixels per scene unit,
 * the pixel ratio times the zoom, with the element's origin placed relative to the camera, then a
 * turn about the local box's centre. The camera's offset is taken per element in double
 * precision, so a canvas whose transform keeps single precision never holds a translation of up to
 * 10⁹ units.
 */
export function place(context: Context2D, drawing: Drawing, camera: Camera, scale: number): void {
  const { element, width, height } = drawing;
  const dx = scale * (element.x - camera.x);
  const dy = scale * (element.y - camera.y);
  context.setTransform(scale, 0, 0, scale, dx, dy);
  if (element.rotation === 0) return;
  context.translate(width / 2, height / 2);
  context.rotate(element.rotation);
  context.translate(-width / 2, -height / 2);
}
